// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu Project ID và ProjectData ID hiện tại
let currentProjectId = localStorage.getItem('currentProjectId') || null;
let currentProjectDataId = localStorage.getItem('currentProjectDataId') || null;

// Biến lưu trạng thái dự án hiện tại
let currentProjectStatus = null;
let currentProjectStatusRound = 1;

// Biến lưu danh sách dự án
let allProjects = [];

// ==================== UTILS (TIỆN ÍCH) ====================

// Hàm đổi màu Select Box Admin (OK -> Xanh, NOK -> Đỏ)
function updateColor(selectElement) {
    selectElement.classList.remove('status-ok', 'status-nok');
    if (selectElement.value === 'OK') {
        selectElement.classList.add('status-ok');
    } else if (selectElement.value === 'NOK') {
        selectElement.classList.add('status-nok');
    }
}

// Format ngày tháng cho API
function formatDateForAPI(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Format ngày tháng hiển thị
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} <span class="time">${hours}:${minutes}</span>`;
}

// ==================== AUTHENTICATION ====================

function checkAuthStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const displayName = localStorage.getItem('displayName');
    
    const userInfo = document.getElementById('user-info');
    const loginLink = document.getElementById('login-link');
    const userDisplayName = document.getElementById('user-display-name');
    
    if (isLoggedIn === 'true' && displayName) {
        if (userInfo) userInfo.style.display = 'flex';
        if (loginLink) loginLink.style.display = 'none';
        if (userDisplayName) userDisplayName.textContent = displayName;
    } else {
        if (userInfo) userInfo.style.display = 'none';
        if (loginLink) loginLink.style.display = 'inline';
    }
}

function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('rememberMe');
        clearProjectIds();
        window.location.href = 'login.html';
    }
}

function getCurrentUser() {
    return {
        username: localStorage.getItem('username'),
        displayName: localStorage.getItem('displayName'),
        role: localStorage.getItem('userRole'),
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true'
    };
}

function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
}

function applyRolePermissions() {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();

    // Admin (admin1) can edit admin fields, other inputs read-only
    if (role === 'admin1') {
        // remove page-level 'role-user' marker so CSS allows interaction
        document.body.classList.remove('role-user');
        document.querySelectorAll('.admin-eval, .admin-note').forEach(el => {
            el.disabled = false;
            el.classList.remove('readonly-admin');
        });
        // Disable user-editable inputs inside the three sections (admin only edits admin fields)
        document.querySelectorAll('#page-request input, #page-request textarea, #page-request select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note')) el.disabled = true;
        });
        document.querySelectorAll('#page-input input, #page-input textarea, #page-input select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note')) el.disabled = true;
        });
        document.querySelectorAll('#page-model input, #page-model textarea, #page-model select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note')) el.disabled = true;
        });

        // Disable file inputs (uploads) in those sections
        document.querySelectorAll('#page-request input[type="file"], #page-input input[type="file"], #page-model input[type="file"]').forEach(fi => fi.disabled = true);

        // Disable action buttons that manipulate user content but keep evaluate buttons enabled
        // DISABLE nút Lưu cho admin1 (btn-submit), chỉ cho bấm nút Đánh giá (btn-evaluate)
        document.querySelectorAll('#page-request button, #page-input button, #page-model button').forEach(btn => {
            // Admin1 chỉ được bấm nút Đánh giá, btn-view-evidence, btn-logout
            const allow = btn.classList.contains('btn-evaluate') || btn.classList.contains('btn-logout') || btn.classList.contains('btn-view-evidence');
            if (!allow) btn.disabled = true;
        });
        
        // Disable nút Lưu chính (saveBtn, saveInputDataBtn, saveModelBtn, saveSummaryBtn)
        const saveButtons = ['saveBtn', 'saveInputDataBtn', 'saveModelBtn', 'saveSummaryBtn'];
        saveButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                btn.title = 'Admin không được phép lưu dữ liệu, chỉ được đánh giá';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
    } else {
        // Regular user: admin fields readonly, user inputs editable
        // add a body class so CSS can make admin controls visually and interactively disabled
        document.body.classList.add('role-user');
        document.querySelectorAll('.admin-eval, .admin-note').forEach(el => {
            el.disabled = true;
            el.classList.add('readonly-admin');
        });
        document.querySelectorAll('#page-request input, #page-request textarea, #page-request select').forEach(el => el.disabled = false);
        document.querySelectorAll('#page-input input, #page-input textarea, #page-input select').forEach(el => el.disabled = false);
        document.querySelectorAll('#page-model input, #page-model textarea, #page-model select').forEach(el => el.disabled = false);
        // Re-enable file inputs and buttons for regular users
        document.querySelectorAll('#page-request input[type="file"], #page-input input[type="file"], #page-model input[type="file"]').forEach(fi => fi.disabled = false);
        document.querySelectorAll('#page-request button, #page-input button, #page-model button').forEach(btn => btn.disabled = false);
        
        // DISABLE nút Đánh giá cho user (chỉ admin mới được đánh giá)
        document.querySelectorAll('.btn-evaluate').forEach(btn => {
            btn.disabled = true;
            btn.title = 'Chỉ admin mới có quyền đánh giá';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    }
}

// ==================== PROJECT MANAGEMENT ====================

function saveProjectIdToStorage(id) {
    currentProjectId = id;
    localStorage.setItem('currentProjectId', id);
    console.log('Saved Project ID to localStorage:', id);
}

function saveProjectDataIdToStorage(id) {
    currentProjectDataId = id;
    localStorage.setItem('currentProjectDataId', id);
    console.log('Saved ProjectData ID to localStorage:', id);
}

function clearProjectIds() {
    currentProjectId = null;
    currentProjectDataId = null;
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectDataId');
    console.log('Cleared Project IDs');
}

// ==================== PROJECT LIST ====================

async function loadProjectList() {
    const tbody = document.getElementById('project-list-body');
    const loadingEl = document.getElementById('project-list-loading');
    const emptyEl = document.getElementById('project-list-empty');
    const tableWrapper = document.querySelector('.project-list-table-wrapper');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    
    try {
        console.log('DEBUG: loadProjectList called');
        const response = await fetch(`${API_BASE_URL}/projects`);
        if (response.ok) {
            allProjects = await response.json();
            
            if (loadingEl) loadingEl.style.display = 'none';
            
            if (allProjects.length === 0) {
                if (emptyEl) emptyEl.style.display = 'block';
            } else {
                if (tableWrapper) tableWrapper.style.display = 'block';
                renderProjectList(allProjects);
            }
        } else {
            throw new Error('Không thể tải danh sách dự án');
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.innerHTML = `<i class="fa-solid fa-exclamation-triangle"></i><p>Lỗi: ${error.message}</p>`;
        }
    }
}

function renderProjectList(projects) {
    const tbody = document.getElementById('project-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    projects.forEach((project, index) => {
        const tr = document.createElement('tr');
        tr.onclick = () => openProject(project.id);
        
        const createdDate = project.createdAt ? formatDate(project.createdAt) : 'N/A';
        const modifiedDate = project.updatedAt ? formatDate(project.updatedAt) : 'N/A';
        const statusClass = getStatusClass(project.status);
        const statusText = getStatusText(project.status, project.statusRound);
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="project-name-cell">${project.name || 'Chưa có tên'}</td>
            <td>${project.devUnit || 'N/A'}</td>
            <td>${project.ownerName || 'Chưa xác định'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="date-cell">${createdDate}</td>
            <td class="date-cell">${modifiedDate}</td>
            <td>
                <div class="project-actions">
                    <button class="btn-action view" title="Xem chi tiết" onclick="event.stopPropagation(); openProject('${project.id}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-action delete" title="Xóa dự án" onclick="event.stopPropagation(); deleteProject('${(project.id || '').toString().replace(/'/g, "\\'")}', '${(project.name || '').replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusClass(status) {
    const s = (status || '').toUpperCase();
    if (s.includes('SIZING') || s === 'SIZING') return 'sizing';
    if (s.includes('THAM_DINH') || s === 'THAM_DINH') return 'tham-dinh';
    if (s.includes('PHE_DUYET') || s === 'PHE_DUYET') return 'phe-duyet';
    if (s.includes('HOAN_THANH') || s === 'HOAN_THANH') return 'hoan-thanh';
    // Legacy support
    switch (status?.toLowerCase()) {
        case 'draft': return 'sizing';
        case 'pending': return 'tham-dinh';
        case 'approved': return 'phe-duyet';
        case 'rejected': return 'sizing';
        default: return 'sizing';
    }
}

function getStatusText(status, statusRound) {
    const round = statusRound || 1;
    const s = (status || '').toUpperCase();
    
    if (s === 'SIZING' || s.includes('SIZING')) return `Sizing lần ${round}`;
    if (s === 'THAM_DINH' || s.includes('THAM_DINH')) return `Thẩm định lần ${round}`;
    if (s === 'PHE_DUYET' || s.includes('PHE_DUYET')) return `Phê duyệt lần ${round}`;
    if (s === 'HOAN_THANH' || s.includes('HOAN_THANH')) return 'Hoàn thành';
    
    // Legacy support
    switch (status?.toLowerCase()) {
        case 'draft': return `Sizing lần ${round}`;
        case 'pending': return `Thẩm định lần ${round}`;
        case 'approved': return 'Hoàn thành';
        case 'rejected': return `Sizing lần ${round}`;
        default: return `Sizing lần ${round}`;
    }
}

function filterProjects() {
    const searchText = document.getElementById('search-project')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';
    
    let filtered = allProjects;
    
    if (searchText) {
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchText)) ||
            (p.devUnit && p.devUnit.toLowerCase().includes(searchText)) ||
            (p.ownerName && p.ownerName.toLowerCase().includes(searchText))
        );
    }
    
    if (statusFilter) {
        filtered = filtered.filter(p => p.status?.toUpperCase() === statusFilter);
    }
    
    renderProjectList(filtered);
}

// ==================== PROJECT STATUS MANAGEMENT ====================

/**
 * Cập nhật hiển thị trạng thái dự án trên UI
 */
function updateProjectStatusDisplay() {
    const statusBadge = document.getElementById('current-project-status');
    if (!statusBadge) return;
    
    const statusClass = getStatusClass(currentProjectStatus);
    const statusText = getStatusText(currentProjectStatus, currentProjectStatusRound);
    
    statusBadge.className = `project-status-badge ${statusClass}`;
    statusBadge.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${statusText}`;
    statusBadge.style.display = 'inline-flex';
    
    // Hiển thị/ẩn nút Phê duyệt cho admin2
    updateApproveButtonVisibility();
}

/**
 * Cập nhật trạng thái dự án dựa trên role người dùng
 * @param {string} actionType - Loại hành động: 'user_edit', 'admin1_review', 'admin2_review', 'admin2_approve'
 */
async function updateProjectStatus(actionType) {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    let newStatus = currentProjectStatus;
    let newRound = currentProjectStatusRound;
    
    switch (actionType) {
        case 'user_edit':
            // User chỉnh sửa: nếu đang ở Thẩm định hoặc Phê duyệt -> quay về Sizing với round+1
            if (currentProjectStatus === 'THAM_DINH' || currentProjectStatus === 'PHE_DUYET') {
                newStatus = 'SIZING';
                newRound = currentProjectStatusRound + 1;
            } else if (!currentProjectStatus || currentProjectStatus === 'Draft') {
                newStatus = 'SIZING';
                newRound = 1;
            }
            break;
            
        case 'admin1_review':
            // Admin1 đánh giá: Sizing -> Thẩm định (giữ nguyên round)
            if (currentProjectStatus === 'SIZING' || currentProjectStatus === 'Draft' || !currentProjectStatus) {
                newStatus = 'THAM_DINH';
                // Giữ nguyên round
            }
            break;
            
        case 'admin2_review':
            // Admin2 đánh giá: Thẩm định -> Phê duyệt (giữ nguyên round)
            if (currentProjectStatus === 'THAM_DINH') {
                newStatus = 'PHE_DUYET';
                // Giữ nguyên round
            }
            break;
            
        case 'admin2_approve':
            // Admin2 phê duyệt: Phê duyệt -> Hoàn thành
            if (currentProjectStatus === 'PHE_DUYET') {
                newStatus = 'HOAN_THANH';
            }
            break;
    }
    
    // Nếu không thay đổi thì không cần update
    if (newStatus === currentProjectStatus && newRound === currentProjectStatusRound) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({
                status: newStatus,
                statusRound: newRound
            })
        });
        
        if (response.ok) {
            currentProjectStatus = newStatus;
            currentProjectStatusRound = newRound;
            updateProjectStatusDisplay();
            console.log(`✅ Đã cập nhật trạng thái: ${newStatus} lần ${newRound}`);
        }
    } catch (error) {
        console.error('Lỗi cập nhật trạng thái:', error);
    }
}

/**
 * Hiển thị/ẩn nút Phê duyệt dự án cho admin2
 */
function updateApproveButtonVisibility() {
    const approveBtn = document.getElementById('btn-approve-project');
    if (!approveBtn) return;
    
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    // Chỉ hiển thị nút Phê duyệt khi:
    // - User là admin2
    // - Dự án đang ở trạng thái PHE_DUYET
    if (role === 'admin2' && currentProjectStatus === 'PHE_DUYET') {
        approveBtn.style.display = 'inline-flex';
    } else {
        approveBtn.style.display = 'none';
    }
}

/**
 * Xử lý khi admin2 bấm nút Phê duyệt
 */
async function approveProject() {
    if (!confirm('Bạn có chắc muốn phê duyệt dự án này? Dự án sẽ chuyển sang trạng thái Hoàn thành.')) {
        return;
    }
    
    await updateProjectStatus('admin2_approve');
    alert('✅ Dự án đã được phê duyệt thành công!');
}

async function openProject(projectId) {
    saveProjectIdToStorage(projectId);
    
    document.getElementById('project-list-page').style.display = 'none';
    document.getElementById('project-detail-page').style.display = 'flex';
    document.getElementById('btn-back-to-list').style.display = 'inline-block';

    // Hiển thị page-request mặc định
    showSection('page-request', document.querySelector('.side-menu a'));
    
    // Hiện nút Lịch sử phiên bản
    const btnVersionHistory = document.getElementById('btn-version-history');
    if (btnVersionHistory) btnVersionHistory.style.display = 'inline-block';
    
    currentProjectDataId = null;
    localStorage.removeItem('currentProjectDataId');
    
    await loadAllDataFromDB();
}

function showProjectList() {
    document.getElementById('project-list-page').style.display = 'block';
    document.getElementById('project-detail-page').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';
    
    // Ẩn nút Lịch sử phiên bản
    const btnVersionHistory = document.getElementById('btn-version-history');
    if (btnVersionHistory) btnVersionHistory.style.display = 'none';
    
    // Đóng panel lịch sử nếu đang mở
    closeVersionHistory();
    
    loadProjectList();
}

async function deleteProject(projectId, projectName) {
    if (!confirm(`Bạn có chắc muốn xóa dự án "${projectName}"? Thao tác này không thể hoàn tác.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Xóa dự án thành công!');
            loadProjectList();
        } else {
            throw new Error('Không thể xóa dự án');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Lỗi: ' + error.message);
    }
}

async function startNewProject() {
    const user = getCurrentUser();
    const projectName = 'Dự án mới - ' + new Date().toLocaleString('vi-VN');
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({
                name: projectName,
                ownerName: user.displayName || user.username || 'Chưa xác định',
                status: 'SIZING',
                statusRound: 1
            })
        });
        
        if (response.ok) {
            const project = await response.json();
            saveProjectIdToStorage(project.id);
            
            // Cập nhật trạng thái dự án
            currentProjectStatus = 'SIZING';
            currentProjectStatusRound = 1;
            updateProjectStatusDisplay();
            
            document.getElementById('project-list-page').style.display = 'none';
            document.getElementById('project-detail-page').style.display = 'flex';
            document.getElementById('btn-back-to-list').style.display = 'inline-block';
            
            // Hiện nút Lịch sử phiên bản
            const btnVersionHistory = document.getElementById('btn-version-history');
            if (btnVersionHistory) btnVersionHistory.style.display = 'inline-block';
            
            resetAllForms();
            await loadAllDataFromDB();
            
            console.log('Created new project:', project.id);
        } else {
            throw new Error('Không thể tạo dự án mới');
        }
    } catch (error) {
        console.error('Error creating project:', error);
        alert('Lỗi: ' + error.message);
    }
}

function resetAllForms() {
    // Reset inputs, textareas, selects
    document.querySelectorAll('input').forEach(input => input.value = '');
    document.querySelectorAll('textarea').forEach(ta => ta.value = '');
    document.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
        select.classList.remove('status-ok', 'status-nok');
    });

    // Reset bảng input
    const inputBody = document.getElementById('input-table-body');
    if (inputBody) {
        inputBody.innerHTML = `
            <tr>
                <td>1</td>
                <td><textarea rows="3" placeholder="Ví dụ: Tổng số người dùng CCU" class="input-textarea"></textarea></td>
                <td><textarea rows="3" class="input-textarea"></textarea></td>
                <td><textarea rows="3" class="input-textarea"></textarea></td>
                <td><input type="text"></td>
                <td><textarea rows="3" class="input-textarea"></textarea></td>
                <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
            </tr>
        `;
    }
    
    // Reset tabs
    const menuLinks = document.querySelectorAll(".side-menu a");
    const pages = document.querySelectorAll(".page-section");
    
    menuLinks.forEach(l => l.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));
    
    if (menuLinks[0]) menuLinks[0].classList.add("active");
    const firstPage = document.getElementById('page-request');
    if (firstPage) firstPage.classList.add("active");
}

// ==================== LOAD DATA FROM DATABASE ====================
async function loadAllDataFromDB() {
    try {
        // Load project info để lấy trạng thái
        const projectResponse = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (projectResponse.ok) {
            const project = await projectResponse.json();
            currentProjectStatus = project.status || 'SIZING';
            currentProjectStatusRound = project.statusRound || 1;
            updateProjectStatusDisplay();
        }
        
        const sizingIframe = document.getElementById('sizing-iframe');
        if (sizingIframe && currentProjectId) {
            const baseUrl = sizingIframe.src.split('?')[0];
            sizingIframe.src = `${baseUrl}?projectId=${currentProjectId}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'GET',
            headers: Object.assign({}, getAuthHeaders())
        });
        if (response.ok) {
            const projectData = await response.json();
            saveProjectDataIdToStorage(projectData.id);
            // Prefer separate admin review columns when present
            if (projectData.yeuCauBaiToanContent) {
                let content = JSON.parse(projectData.yeuCauBaiToanContent);
                if (projectData.yeuCauAdminReview) {
                    try { content.adminReview = JSON.parse(projectData.yeuCauAdminReview); } catch(e) { /* ignore */ }
                }
                loadYeuCauBaiToan(content);
            }
            if (projectData.thongTinDauVaoContent) {
                let content = JSON.parse(projectData.thongTinDauVaoContent);
                if (projectData.thongTinAdminReview) {
                    try { content.adminReview = JSON.parse(projectData.thongTinAdminReview); } catch(e) { /* ignore */ }
                }
                loadThongTinDauVao(content);
            }
            // If moHinhHeThongContent exists, use it; otherwise still render admin review if present
            if (projectData.moHinhHeThongContent || projectData.moHinhAdminReview) {
                const content = projectData.moHinhHeThongContent ? JSON.parse(projectData.moHinhHeThongContent) : {};
                // Parse the separate admin review column and pass it into the loader
                let mohinhAdmin = null;
                if (projectData.moHinhAdminReview) {
                    try {
                        mohinhAdmin = JSON.parse(projectData.moHinhAdminReview);
                    } catch (e) {
                        mohinhAdmin = { _raw: projectData.moHinhAdminReview };
                    }
                }
                console.log('DEBUG: projectData.moHinhAdminReview (raw):', projectData.moHinhAdminReview);
                console.log('DEBUG: parsed mohinhAdmin:', mohinhAdmin);
                loadMoHinhHeThong(content, mohinhAdmin);
            }
            if (projectData.tongHopVaDeXuatContent) {
                loadTongHop(JSON.parse(projectData.tongHopVaDeXuatContent));
            }
            
            console.log('Đã tải dữ liệu từ database thành công!');
        } else if (response.status === 404) {
            console.log('Chưa có ProjectData cho project này');
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
    }
}

// ==================== 1. YÊU CẦU BÀI TOÁN ====================

function loadYeuCauBaiToan(data) {
    const rows = document.querySelectorAll('#request-table-body tr');
    
    // Helper function để load dữ liệu vào 1 dòng (Input + Admin)
    const loadRowData = (rowIndex, value, adminData) => {
        const row = rows[rowIndex];
        if (!row) return;
        
        // Cột User Input (Cột 2)
        const userInput = row.cells[1].querySelector('input');
        const userSelect = row.cells[1].querySelector('select');
        
        if (userInput) userInput.value = value || '';
        if (userSelect) userSelect.value = value || '';

        // Cột Admin (Cột 3 & 4)
        if (adminData) {
            const adminEval = row.cells[2].querySelector('select');
            const adminNote = row.cells[3].querySelector('input');
            if (adminEval) {
                adminEval.value = adminData.eval || '';
                updateColor(adminEval); // Cập nhật màu
            }
            if (adminNote) adminNote.value = adminData.note || '';
        }
    };

    // Dòng 1: Đơn vị
    loadRowData(0, data.devUnit, data.adminReview?.row0);
    // Dòng 2: Tên dự án
    loadRowData(1, data.projectName, data.adminReview?.row1);
    // Dòng 3: Chức năng
    loadRowData(2, data.sysFeature, data.adminReview?.row2);
    
    // Dòng 4: Đầu mối (Tách chuỗi contactPerson)
    const contactRow = rows[3];
    if (contactRow) {
        // Giả sử contactPerson lưu dạng "Email - Đơn vị - SĐT"
        const contactParts = (data.contactPerson || '').split(' - ');
        // Nếu có ít hơn 3 phần, điền lần lượt
        document.getElementById('contact-email').value = contactParts[0] || '';
        document.getElementById('contact-unit').value = contactParts[1] || '';
        document.getElementById('contact-phone').value = contactParts[2] || '';
        
        // Load admin
        const adminData = data.adminReview?.row3;
        if(adminData) {
            const adminEval = contactRow.cells[2].querySelector('select');
            const adminNote = contactRow.cells[3].querySelector('input');
            if (adminEval) { adminEval.value = adminData.eval || ''; updateColor(adminEval); }
            if (adminNote) adminNote.value = adminData.note || '';
        }
    }

    // Dòng 5: Mục đích
    loadRowData(4, data.sizingPurpose, data.adminReview?.row4);
    // Dòng 6: Cơ sở
    loadRowData(5, data.sizingBasis, data.adminReview?.row5);
    // Dòng 7: Nguyên tắc
    loadRowData(6, data.sizingRule, data.adminReview?.row6);
    // Dòng 8: Mức độ
    loadRowData(7, data.importance, data.adminReview?.row7);
    // Dòng 9: Thời gian
    loadRowData(8, data.deploymentTime, data.adminReview?.row8);
}

function loadMoHinhHeThong(data, admin) {
    // Load images (use helper if available)
    try {
        if (typeof loadImagesToContainer === 'function') {
            if (data.physicalImages) loadImagesToContainer('physical', data.physicalImages);
            if (data.logicalImages) loadImagesToContainer('logical', data.logicalImages);
            if (data.flowImages) loadImagesToContainer('flow', data.flowImages);
        } else {
            const physicalContainer = document.getElementById('container-physical');
            const logicalContainer = document.getElementById('container-logical');
            const flowContainer = document.getElementById('container-flow');
            if (physicalContainer) {
                physicalContainer.innerHTML = '';
                (data.physicalImages || []).forEach((img, idx) => {
                    const el = document.createElement('div');
                    el.className = 'model-image-item';
                    el.innerHTML = `<img src="${img.base64 || img}" alt="physical-${idx}" onclick="openModal(this.src)" style="cursor: zoom-in; max-width:100%;">`;
                    physicalContainer.appendChild(el);
                });
            }
            if (logicalContainer) {
                logicalContainer.innerHTML = '';
                (data.logicalImages || []).forEach((img, idx) => {
                    const el = document.createElement('div');
                    el.className = 'model-image-item';
                    el.innerHTML = `<img src="${img.base64 || img}" alt="logical-${idx}" onclick="openModal(this.src)" style="cursor: zoom-in; max-width:100%;">`;
                    logicalContainer.appendChild(el);
                });
            }
            if (flowContainer) {
                flowContainer.innerHTML = '';
                (data.flowImages || []).forEach((img, idx) => {
                    const el = document.createElement('div');
                    el.className = 'model-image-item';
                    el.innerHTML = `<img src="${img.base64 || img}" alt="flow-${idx}" onclick="openModal(this.src)" style="cursor: zoom-in; max-width:100%;">`;
                    flowContainer.appendChild(el);
                });
            }
        }

        // flow explanation
        const flowExp = document.getElementById('flow-explanation');
        if (flowExp) flowExp.value = data.flowExplanation || '';

        // Build canonical admin object: prefer explicit admin param (separate column)
        const adminObj = admin || data.mohinhAdminReview || data.adminReview || {
            physical: data.adminPhysical || null,
            logical: data.adminLogical || null,
            flow: data.adminFlow || null
        };
        console.log('DEBUG: resolved adminObj in loadMoHinhHeThong:', adminObj);

        const setAdmin = (type, adminData) => {
            const select = document.getElementById(`eval-${type}`);
            const note = document.getElementById(`note-${type}`);
            if (adminData) {
                if (select) { select.value = adminData.eval || ''; updateColor(select); }
                if (note) note.value = adminData.note || '';
            } else {
                if (select) { select.value = ''; updateColor(select); }
                if (note) note.value = '';
            }
        };

        setAdmin('physical', adminObj.physical || data.adminPhysical);
        setAdmin('logical',  adminObj.logical  || data.adminLogical);
        setAdmin('flow',     adminObj.flow     || data.adminFlow);

        // Architecture rows
        const archBody = document.getElementById('arch-table-body');
        if (archBody) {
            archBody.innerHTML = '';
            if (data.archRows && data.archRows.length > 0) {
                data.archRows.forEach((row, index) => {
                    const tr = createArchTableRow(index + 1, row);
                    archBody.appendChild(tr);
                });
            }
        }
        // Ensure role permissions applied after building model section
        try { applyRolePermissions(); } catch (e) {}
    } catch (e) {
        console.error('loadMoHinhHeThong error', e);
    }
}

async function saveMoHinhHeThong() {
    if (!currentProjectId) {
        alert('Vui lòng lưu Yêu cầu bài toán trước!');
        return;
    }

    const statusDiv = document.getElementById('model-save-status');
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';

        // collect data: images are not re-uploaded here; collect flow explanation
        const flowExplanation = document.getElementById('flow-explanation')?.value || '';
        // For simplicity, do not attempt to collect images here (existing images are kept server-side)
        const payload = { flowExplanation };

        // send without admin fields to avoid overwriting admin columns
        const headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        const resp = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ moHinhHeThongContent: JSON.stringify(payload) })
        });

        if (resp.ok) {
            if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
            alert('Đã lưu Mô hình hệ thống thành công!');
        } else {
            const txt = await resp.text();
            throw new Error(txt || 'Server error');
        }
    } catch (err) {
        console.error('saveMoHinhHeThong error', err);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi!</span>';
        alert('Lỗi: ' + err.message);
    }
}

function collectYeuCauBaiToan() {
    const rows = document.querySelectorAll('#request-table-body tr');

    // Helper lấy value User Input
    const getVal = (rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return '';
        const input = row.cells[1].querySelector('input');
        const select = row.cells[1].querySelector('select');
        return input ? input.value : (select ? select.value : '');
    };

    // Helper lấy Admin Data
    const getAdminData = (rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return { eval: '', note: '' };
        return {
            eval: row.cells[2].querySelector('select')?.value || '',
            note: row.cells[3].querySelector('input')?.value || ''
        };
    };

    // Gộp thông tin đầu mối
    const email = document.getElementById('contact-email')?.value || '';
    const unit = document.getElementById('contact-unit')?.value || '';
    const phone = document.getElementById('contact-phone')?.value || '';
    const contactCombined = [email, unit, phone].join(' - '); // Luôn join để giữ vị trí khi split
    
    return {
        devUnit: getVal(0),
        projectName: getVal(1),
        sysFeature: getVal(2),
        contactPerson: contactCombined,
        sizingPurpose: getVal(4), // Dòng 5 là index 4
        sizingBasis: getVal(5),
        sizingRule: getVal(6),
        importance: getVal(7),
        deploymentTime: getVal(8),

        // Gom dữ liệu Admin thành object
        adminReview: {
            row0: getAdminData(0),
            row1: getAdminData(1),
            row2: getAdminData(2),
            row3: getAdminData(3),
            row4: getAdminData(4),
            row5: getAdminData(5),
            row6: getAdminData(6),
            row7: getAdminData(7),
            row8: getAdminData(8)
        }
    };
}

async function saveYeuCauBaiToan() {
    const statusDiv = document.getElementById('save-status');
    const data = collectYeuCauBaiToan();

    if (!data.projectName) {
        alert("Vui lòng nhập Tên dự án!");
        return;
    }
    
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        // 1. Tạo hoặc Cập nhật Project
        if (!currentProjectId) {
            const projectResponse = await fetch(`${API_BASE_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.projectName,
                    devUnit: data.devUnit,
                    ownerName: data.contactPerson,
                    status: 'Draft'
                })
            });
            
            if (!projectResponse.ok) throw new Error('Không thể tạo Project mới.');
            const project = await projectResponse.json();
            saveProjectIdToStorage(project.id);
        } else {
                await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
                method: 'PUT',
                headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
                body: JSON.stringify({
                    name: data.projectName,
                    devUnit: data.devUnit,
                    ownerName: data.contactPerson
                })
            });
        }

        // 2. Lưu System Info (Chứa cả data user và admin review)
        // Nếu người dùng không phải admin, bỏ qua phần adminReview để tránh overwrite
        const user = getCurrentUser();
        const payloadData = Object.assign({}, data);
        if ((user.role || '').toLowerCase() !== 'admin1') {
            delete payloadData.adminReview;
        }

        const systemInfoPayload = {
            projectId: currentProjectId,
            ...payloadData
        };

        const method = currentProjectDataId ? 'PUT' : 'POST';
        const url = currentProjectDataId 
            ? `${API_BASE_URL}/project-data/${currentProjectDataId}` // Giả sử BE hỗ trợ update qua ID này
            : `${API_BASE_URL}/project-data`; // Hoặc tạo mới

        // Logic cũ của bạn đang dùng API khác nhau cho create/update project data
        // Tôi sẽ điều chỉnh theo luồng chuẩn: Update vào bảng ProjectData
        // Lưu nội dung Yêu cầu bài toán vào cột yeuCauBaiToanContent
        
        let response;
        const baseHeaders = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        if(currentProjectDataId) {
             response = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                method: 'PUT',
                headers: baseHeaders,
                body: JSON.stringify({ yeuCauBaiToanContent: JSON.stringify(systemInfoPayload) })
            });
        } else {
            response = await fetch(`${API_BASE_URL}/project-data`, {
                method: 'POST',
                headers: baseHeaders,
                body: JSON.stringify({
                    projectId: currentProjectId,
                    yeuCauBaiToanContent: JSON.stringify(systemInfoPayload)
                })
            });
        }
        
        if (response.ok) {
            const result = await response.json();
            if(!currentProjectDataId) saveProjectDataIdToStorage(result.id);
            if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công!</span>`;
            
            // Cập nhật trạng thái dự án dựa trên role
            const role = (user.role || '').toLowerCase();
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'user' || !role) {
                await updateProjectStatus('user_edit');
            }
            
            // Tạo revision sau khi lưu thành công
            await createRevision(`${user.displayName || user.username || 'User'} cập nhật Yêu cầu bài toán`);
            
            alert('Đã lưu thông tin thành công!');
        } else {
            throw new Error(await response.text());
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = `<span style="color: red;">✗ Lỗi: ${error.message}</span>`;
        alert('Có lỗi xảy ra: ' + error.message);
    }
}

// ==================== CÁC PHẦN KHÁC (GIỮ NGUYÊN) ====================
// (Phần Thông tin đầu vào, Mô hình hệ thống, Tổng hợp... vẫn giữ nguyên code cũ
// vì bạn chưa yêu cầu đổi giao diện các phần đó trong lần prompt này)

// ==================== THÔNG TIN ĐẦU VÀO ====================

function loadThongTinDauVao(data) {
    // Load bảng thông tin đầu vào
    const tbody = document.getElementById('input-table-body');
    if (!tbody) {
        console.warn("loadThongTinDauVao: missing element with id='input-table-body', skipping input table load.");
    } else {
        tbody.innerHTML = '';
    }
    
    if (data.inputRows && data.inputRows.length > 0) {
        // If adminReview.rows provided, merge admin eval/note into each row object
        const adminRows = (data.adminReview && data.adminReview.rows) ? data.adminReview.rows : null;
        data.inputRows.forEach((row, index) => {
            const rowCopy = Object.assign({}, row);
            if (adminRows && adminRows[index]) {
                rowCopy.adminEval = adminRows[index].eval || '';
                rowCopy.adminNote = adminRows[index].note || '';
            }
            const tr = createInputTableRow(index + 1, rowCopy);
            tbody.appendChild(tr);
        });
    }
    
    // Note: baselineRows and global evidenceImages have been removed from storage structure
    // Load per-row images (pocEvidenceImages / sizingEvidenceImages) when present
    // (the per-row image loading is handled inside createInputTableRow below)
}
// Ensure role permissions applied after loading input table
try { applyRolePermissions(); } catch (e) {}

// 2. Hàm xử lý khi chọn ảnh từ icon dấu hỏi (?)
// Hàm xử lý khi chọn file ảnh
// 1. Hàm xử lý khi chọn ảnh
// Clear all evidence images in the same cell-wrapper (used by legacy clear buttons in markup)
function clearRowImages(btn) {
    const wrapper = btn.parentElement;
    const container = wrapper.querySelector('.row-evidence-container');
    if (container) container.innerHTML = '';
    const label = wrapper.querySelector('.upload-icon-btn');
    const input = wrapper.querySelector('input[type="file"]');
    if (input) input.value = '';
    if (label) label.classList.remove('has-file');
}
function createInputTableRow(stt, data = {}) {
    const tr = document.createElement('tr');

    // --- 1. XỬ LÝ ẢNH (POC) ---
    // Support multiple images per row: data.taiHeThongPOC = { text: '', pocEvidenceImages: [ {base64}, ... ] }
    const pocText = (data.taiHeThongPOC && data.taiHeThongPOC.text) ? data.taiHeThongPOC.text : (data.taiHeThongPOC || '');
    const pocImages = (data.taiHeThongPOC && Array.isArray(data.taiHeThongPOC.pocEvidenceImages)) ? data.taiHeThongPOC.pocEvidenceImages : (data.pocImage ? [{ base64: data.pocImage }] : []);

    // --- 2. XỬ LÝ ẢNH (ĐỊNH CỠ) ---
    const sizingText = (data.dinhCo && typeof data.dinhCo === 'object' && data.dinhCo.text) ? data.dinhCo.text : (typeof data.dinhCo === 'string' ? data.dinhCo : '');
    const sizingImages = (data.dinhCo && Array.isArray(data.dinhCo.sizingEvidenceImages)) ? data.dinhCo.sizingEvidenceImages : (data.sizingImage ? [{ base64: data.sizingImage }] : []);

    tr.innerHTML = `
        <td style="text-align: center;">${stt}</td>
        
        <td><textarea rows="2" class="input-full" placeholder="Nhập nội dung...">${data.dauVao || ''}</textarea></td>

        <td>
            <div class="cell-wrapper">
                <input type="text" value="${escapeHtml(pocText)}" placeholder="Giá trị...">
                <div class="row-evidence-controls">
                    <label class="upload-icon-btn" title="Tải ảnh/Xem ảnh">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                           <input type="file" accept="image/*" class="hidden-file-input" 
                               onclick="event.stopPropagation()" 
                               onchange="handleRowEvidenceUpload(this, 'poc')">
                    </label>
                </div>
                <div class="row-evidence-container">
                    ${pocImages.map(img => `<div class="row-evidence-item"><button type="button" class="btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)">Xem</button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)">✖</button></div>`).join('')}
                </div>
            </div>
        </td>
        
        <td>
            <div class="cell-wrapper">
                <input type="text" value="${escapeHtml(sizingText)}" placeholder="Giá trị...">
                <div class="row-evidence-controls">
                    <label class="upload-icon-btn" title="Tải ảnh/Xem ảnh">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                           <input type="file" accept="image/*" class="hidden-file-input" 
                               onclick="event.stopPropagation()" 
                               onchange="handleRowEvidenceUpload(this, 'sizing')">
                    </label>
                </div>
                <div class="row-evidence-container">
                    ${sizingImages.map(img => `<div class="row-evidence-item"><button type="button" class="btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)">Xem</button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)">✖</button></div>`).join('')}
                </div>
            </div>
        </td>
        
        <td><input type="text" class="input-full" value="${data.module || ''}" placeholder="Module..."></td>
        
        <td><textarea rows="2" class="input-full" placeholder="Ghi chú...">${data.ghiChu || ''}</textarea></td>
        
        <td>
            <select class="admin-eval" onchange="updateColor(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td>
            <textarea rows="1" class="input-full admin-note" 
                      placeholder="..." 
                      style="resize: vertical; min-height: 36px;">${data.adminNote || ''}</textarea>
        </td>
        
        <td style="text-align: center;">
            <button class="btn-delete-row-item" onclick="deleteRow(this)" title="Xóa dòng này">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;

    // Kích hoạt màu sắc cho ô Select nếu đã có dữ liệu (OK xanh / NOK đỏ)
    const select = tr.querySelector('select');
    if(select && select.value) updateColor(select);

    // Nếu vai trò hiện tại không phải admin, vô hiệu hóa các ô Admin trong dòng mới
    try {
        const user = getCurrentUser();
        if ((user.role || '').toLowerCase() !== 'admin1') {
            tr.querySelectorAll('.admin-eval, .admin-note').forEach(el => {
                el.disabled = true;
                el.classList.add('readonly-admin');
            });
        }
    } catch (e) {
        // ignore
    }

    // Nếu đã có ảnh tải sẵn, ẩn icon upload để tránh upload thêm
    const pocContainer = tr.querySelector('.row-evidence-container');
    if (pocContainer && pocContainer.children.length > 0) {
        const pocLabel = tr.querySelector('td .upload-icon-btn');
        if (pocLabel) pocLabel.style.display = 'none';
    }
    // Sizing column (nếu tồn tại ảnh) - tìm label trong cùng row, cột 4
    const sizingContainers = tr.querySelectorAll('td .row-evidence-container');
    if (sizingContainers && sizingContainers.length > 1) {
        const sizingContainer = sizingContainers[1];
        if (sizingContainer && sizingContainer.children.length > 0) {
            const sizingLabel = tr.querySelectorAll('td .upload-icon-btn')[1];
            if (sizingLabel) sizingLabel.style.display = 'none';
        }
    }

    return tr;
}

// legacy single-file handlers removed; use per-row handlers instead

// 4. [MỚI] Hàm xóa dòng cụ thể
function deleteRow(btn) {
    if(confirm("Bạn có chắc muốn xóa dòng này không?")) {
        const row = btn.closest('tr');
        const tbody = row.parentElement;
        row.remove();
        
        // Cập nhật lại số thứ tự (STT)
        Array.from(tbody.rows).forEach((r, index) => {
            r.cells[0].innerText = index + 1;
        });
    }
}
// 2. Hàm Thêm Dòng (Được gọi khi bấm nút)
function addInputRow() {
    const tbody = document.getElementById('input-table-body');
    if (!tbody) {
        console.error("Không tìm thấy tbody có id='input-table-body'");
        return;
    }
    
    const nextSTT = tbody.rows.length + 1;
    // Gọi hàm tạo dòng ở trên
    const tr = createInputTableRow(nextSTT); 
    tbody.appendChild(tr);
    // Re-apply role permissions so dynamically added row gets correct disabled state
    try { applyRolePermissions(); } catch (e) { /* ignore */ }
}

// 3. Hàm Xóa Dòng Cuối
function removeLastRow(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (tbody && tbody.rows.length > 1) { // Giữ lại ít nhất 1 dòng
        tbody.deleteRow(tbody.rows.length - 1);
    } else {
        alert("Phải giữ lại ít nhất một dòng!");
    }
}


function collectThongTinDauVao() {
    // Thu thập bảng đầu vào
    const inputRows = [];
    document.querySelectorAll('#input-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');

        // Helper: Lấy ảnh base64 (từ <img> hoặc từ nút xem có data-base64)
        const getRowImages = (cellIndex) => {
            const container = cells[cellIndex]?.querySelector('.row-evidence-container');
            if (!container) return [];
            // Buttons that store base64 in data-base64
            const btns = container.querySelectorAll('.btn-view-evidence');
            const results = [];
            btns.forEach(b => {
                const b64 = b.getAttribute('data-base64');
                if (b64) results.push({ base64: b64 });
            });
            // Fallback: any <img> tags (older behavior)
            const imgs = container.querySelectorAll('img');
            imgs.forEach(i => { if (i.src) results.push({ base64: i.src }); });
            return results;
        };

        // Helper: Lấy text input trong wrapper
        const getWrapperInput = (cellIndex) => {
            return cells[cellIndex]?.querySelector('input[type="text"]')?.value || '';
        }

        inputRows.push({
            dauVao: cells[1]?.querySelector('textarea')?.value || '',
            taiHeThongPOC: {
                text: getWrapperInput(2),
                pocEvidenceImages: getRowImages(2)
            },

            dinhCo: {
                text: getWrapperInput(3),
                sizingEvidenceImages: getRowImages(3)
            },
            
            module: cells[4]?.querySelector('input')?.value || '', // Cột 4
            ghiChu: cells[5]?.querySelector('textarea')?.value || '', // Cột 5
            
            adminEval: cells[6]?.querySelector('select')?.value || '', // Cột 6
            adminNote: cells[7]?.querySelector('textarea')?.value || ''   // Cột 7
        });
    });
    
    // Thu thập bảng Baseline
    // NOTE: baselineRows and global evidenceImages were removed from storage per new spec
    return {
        inputRows: inputRows
    };
}

async function saveThongTinDauVao() {
    const statusDiv = document.getElementById('input-save-status');
    
    if (!currentProjectId) {
        alert('Vui lòng lưu "Yêu cầu bài toán" trước!');
        return;
    }
    
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectThongTinDauVao();
        // If user is not admin, strip any admin eval/note fields from payload to avoid overwriting admin columns
        const user = getCurrentUser();
        if ((user.role || '').toLowerCase() !== 'admin1') {
            // remove adminEval/adminNote from each row
            data.inputRows = data.inputRows.map(r => {
                const copy = Object.assign({}, r);
                delete copy.adminEval;
                delete copy.adminNote;
                return copy;
            });
        }

        const content = JSON.stringify(data);

        await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({
                thongTinDauVaoContent: content
            })
        });
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        
        // Cập nhật trạng thái dự án dựa trên role
        const role = (user.role || '').toLowerCase();
        if (role === 'admin1') {
            await updateProjectStatus('admin1_review');
        } else if (role === 'user' || !role) {
            await updateProjectStatus('user_edit');
        }
        
        // Tạo revision sau khi lưu thành công
        await createRevision(`${user.displayName || user.username || 'User'} cập nhật Thông tin đầu vào`);
        
        alert('Đã lưu Thông tin đầu vào thành công!');
        
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi!</span>';
        alert('Lỗi: ' + error.message);
    }
}

function addInputRow() {
    const tbody = document.getElementById('input-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createInputTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

// 7. Hàm thêm dòng Baseline (Giữ nguyên)
function createBaselineTableRow(data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <select style="width: 100%; padding: 8px; border: 1px solid transparent; background: transparent;">
                <option value="APP" ${data.module === 'APP' ? 'selected' : ''}>APP</option>
                <option value="DB" ${data.module === 'DB' ? 'selected' : ''}>DB</option>
            </select>
        </td>
        <td><input type="text" placeholder="10.240.x.x" value="${data.ip || ''}"></td>
        <td><input type="text" placeholder="Intel Xeon..." value="${data.cpu || ''}"></td>
        <td><input type="number" class="ram-val" placeholder="0" value="${data.ram || ''}" oninput="calculateBaselineTotal()"></td>
        <td><input type="number" class="cint-val" placeholder="0" value="${data.cintRate2017 || ''}" oninput="calculateBaselineTotal()"></td>
        <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();">✖</button></td>
    `;
    return tr;
}

function addBaselineRow() {
    const tbody = document.getElementById('baseline-specs-body');
    const tr = createBaselineTableRow();
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

function createArchTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${stt}</td>
        <td><input type="text" placeholder="Tên nghiệp vụ" value="${data.nghiepVu || ''}"></td>
        <td>
            <select style="width: 100%; padding: 8px; border: 1px solid transparent; background: transparent;">
                <option value="">-- Chọn --</option>
                <option value="Web App" ${data.module === 'Web App' ? 'selected' : ''}>Web App</option>
                <option value="Redis" ${data.module === 'Redis' ? 'selected' : ''}>Redis</option>
                <option value="Oracle RAC" ${data.module === 'Oracle RAC' ? 'selected' : ''}>Oracle RAC</option>
                <option value="MariaDB" ${data.module === 'MariaDB' ? 'selected' : ''}>MariaDB</option>
                <option value="PostgreSQL" ${data.module === 'PostgreSQL' ? 'selected' : ''}>PostgreSQL</option>
                <option value="MongoDB" ${data.module === 'MongoDB' ? 'selected' : ''}>MongoDB</option>
                <option value="MinIO" ${data.module === 'MinIO' ? 'selected' : ''}>MinIO</option>
                <option value="Kafka" ${data.module === 'Kafka' ? 'selected' : ''}>Kafka</option>
                <option value="Other" ${data.module === 'Other' ? 'selected' : ''}>Khác</option>
            </select>
        </td>
        <td><input type="text" placeholder="Ví dụ: Zone Internet" value="${data.zoneMang || ''}"></td>
        <td>
            <select style="width: 100%; padding: 8px; border: 1px solid transparent; background: transparent;">
                <option value="">-- Chọn --</option>
                <option value="Ubuntu 22.04 trở lên" ${data.heDieuHanh === 'Ubuntu 22.04 trở lên' ? 'selected' : ''}>Ubuntu 22.04 trở lên</option>
                <option value="CentOS" ${data.heDieuHanh === 'CentOS' ? 'selected' : ''}>CentOS</option>
                <option value="Windows Server" ${data.heDieuHanh === 'Windows Server' ? 'selected' : ''}>Windows Server</option>
                <option value="RedHat" ${data.heDieuHanh === 'RedHat' ? 'selected' : ''}>RedHat</option>
            </select>
        </td>
        <td><textarea rows="1" placeholder="Ví dụ: 02 VIP">${data.soLuongVIP || ''}</textarea></td>
        <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
    `;
    return tr;
}

function collectMoHinhHeThong() {
    // Thu thập bảng Zone mạng
    const archRows = [];
    document.querySelectorAll('#arch-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        
        archRows.push({
            nghiepVu: cells[1]?.querySelector('input')?.value || '',
            module: cells[2]?.querySelector('select')?.value || '',
            zoneMang: cells[3]?.querySelector('input')?.value || '',
            heDieuHanh: cells[4]?.querySelector('select')?.value || '',
            soLuongVIP: cells[5]?.querySelector('textarea')?.value || ''
        });
    });

    // Helper lấy giá trị Admin cho gọn
    const getAdmin = (type) => ({
        eval: document.getElementById(`eval-${type}`)?.value || '',
        note: document.getElementById(`note-${type}`)?.value || ''
    });
    
    return {
        physicalImages: collectImagesFromContainer('physical'),
        logicalImages: collectImagesFromContainer('logical'),
        flowImages: collectImagesFromContainer('flow'),
        flowExplanation: document.getElementById('flow-explanation')?.value || '',
        archRows: archRows,

        // Dữ liệu Admin (3 phần riêng biệt)
        adminPhysical: getAdmin('physical'),
        adminLogical: getAdmin('logical'),
        adminFlow: getAdmin('flow')
    };
}

async function saveMoHinhHeThong() {
    const statusDiv = document.getElementById('model-save-status');
    if (!currentProjectId) { alert('Vui lòng lưu "Yêu cầu bài toán" trước!'); return; }
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectMoHinhHeThong();
        
            await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ moHinhHeThongContent: JSON.stringify(data) })
        });
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        
        // Cập nhật trạng thái dự án dựa trên role
        const user = getCurrentUser();
        const role = (user.role || '').toLowerCase();
        if (role === 'admin1') {
            await updateProjectStatus('admin1_review');
        } else if (role === 'user' || !role) {
            await updateProjectStatus('user_edit');
        }
        
        // Tạo revision sau khi lưu thành công
        await createRevision(`${user.displayName || user.username || 'User'} cập nhật Mô hình hệ thống`);
        
        alert('Đã lưu Mô hình hệ thống thành công!');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Lỗi: ' + error.message);
    }
}

function addArchRow() {
    const tbody = document.getElementById('arch-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createArchTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

// ==================== TỔNG HỢP VÀ ĐỀ XUẤT ====================

function loadTongHop(data) {
    const tbody = document.getElementById('summary-table-body');
    tbody.innerHTML = '';
    
    if (data.summaryRows && data.summaryRows.length > 0) {
        data.summaryRows.forEach((row, index) => {
            const tr = createSummaryTableRow(index + 1, row);
            tbody.appendChild(tr);
        });
    }
}

function createSummaryTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${stt}</td>
        <td><input type="text" placeholder="Ví dụ: APP Service" value="${data.module || ''}"></td>
        <td><input type="number" value="${data.soLuong || 1}"></td>
        <td><input type="number" value="${data.vCPU || 1}"></td>
        <td><input type="text" placeholder="Ví dụ: 24" value="${data.ram || ''}"></td>
        <td><input type="text" placeholder="/u01: 100" value="${data.volume || ''}"></td>
        <td><textarea rows="1">${data.ghiChu || ''}</textarea></td>
        <td><button class="btn-delete" onclick="removeSummaryRow(this)">✖</button></td>
    `;
    return tr;
}

function collectTongHop() {
    const summaryRows = [];
    document.querySelectorAll('#summary-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        summaryRows.push({
            module: cells[1]?.querySelector('input')?.value || '',
            soLuong: parseInt(cells[2]?.querySelector('input')?.value) || 1,
            vCPU: parseInt(cells[3]?.querySelector('input')?.value) || 1,
            ram: cells[4]?.querySelector('input')?.value || '',
            volume: cells[5]?.querySelector('input')?.value || '',
            ghiChu: cells[6]?.querySelector('textarea')?.value || ''
        });
    });
    
    return { summaryRows: summaryRows };
}

async function saveTongHop() {
    const statusDiv = document.getElementById('summary-save-status');
    if (!currentProjectId) { alert('Vui lòng lưu "Yêu cầu bài toán" trước!'); return; }
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectTongHop();
        
        await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ tongHopVaDeXuatContent: JSON.stringify(data) })
        });
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        
        // Cập nhật trạng thái dự án dựa trên role
        const user = getCurrentUser();
        const role = (user.role || '').toLowerCase();
        if (role === 'admin1') {
            await updateProjectStatus('admin1_review');
        } else if (role === 'admin2') {
            await updateProjectStatus('admin2_review');
        } else if (role === 'user' || !role) {
            await updateProjectStatus('user_edit');
        }
        
        // Tạo revision sau khi lưu thành công
        await createRevision(`${user.displayName || user.username || 'User'} cập nhật Tổng hợp và đề xuất`);
        
        alert('Đã lưu Tổng hợp và đề xuất thành công!');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Lỗi: ' + error.message);
    }
}

function addSummaryRow() {
    const tbody = document.getElementById('summary-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createSummaryTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

// ==================== UTILITY FUNCTIONS ====================

function removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

function removeSummaryRow(btn) { removeRow(btn); }
function removeArchRow(btn) { removeRow(btn); }

function updateSTT(tbody) {
    Array.from(tbody.rows).forEach((r, index) => {
        if (r.cells[0]) r.cells[0].innerText = index + 1;
    });
}

function calculateBaselineTotal() {
    let totalRam = 0;
    let totalCint = 0;
    document.querySelectorAll('.ram-val').forEach(input => totalRam += parseFloat(input.value) || 0);
    document.querySelectorAll('.cint-val').forEach(input => totalCint += parseFloat(input.value) || 0);
    
    const ramEl = document.getElementById('total-ram-baseline');
    const cintEl = document.getElementById('total-cint-baseline');
    
    if (ramEl) ramEl.innerText = totalRam;
    if (cintEl) cintEl.innerText = totalCint;
}

// ==================== IMAGE UPLOAD ====================

// Hàm thu thập ảnh từ container (lấy base64)
function collectImagesFromContainer(type) {
    const containerId = 'container-' + type;
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const images = [];
    const boxes = container.querySelectorAll('.upload-box');
    
    boxes.forEach(box => {
        const img = box.querySelector('.preview-area img');
        if (img && img.src) {
            images.push({ id: box.id, base64: img.src });
        }
    });
    
    return images;
}

// Hàm load ảnh vào container từ dữ liệu đã lưu
function loadImagesToContainer(type, images) {
    const containerId = 'container-' + type;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Xóa các box cũ
    container.innerHTML = '';
    
    // Tạo lại các box với ảnh đã lưu
    images.forEach(imgData => {
        const boxId = imgData.id || 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const div = document.createElement('div');
        div.className = 'upload-box';
        div.id = boxId;
        div.innerHTML = `
            <div class="upload-controls">
                <input type="file" accept="image/*" onchange="previewModelImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
                <label for="input-${boxId}" class="upload-label">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>Đổi ảnh</span>
                </label>
                <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove()">✖</button>
            </div>
            <div class="preview-area" id="preview-${boxId}">
                <img src="${imgData.base64}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px;">
            </div>
        `;
        container.appendChild(div);
    });
}

function createUploadBox(type) {
    const containerId = 'container-' + type;
    const container = document.getElementById(containerId);
    if (!container) return;

    const boxId = 'img-' + Date.now();
    const div = document.createElement('div');
    div.className = 'upload-box';
    div.id = boxId;
    div.innerHTML = `
        <div class="upload-controls">
            <input type="file" accept="image/*" onchange="previewModelImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
            <label for="input-${boxId}" class="upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Chọn ảnh</span>
            </label>
            <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove()">✖</button>
        </div>
        <div class="preview-area" id="preview-${boxId}"></div>
    `;
    container.appendChild(div);
    // enforce role permissions (disable upload box for admin if needed)
    try { applyRolePermissions(); } catch (e) {}
}

function addEvidenceSlot() {
    const container = document.getElementById('evidence-grid');
    if (!container) return;
    const boxId = 'evidence-' + Date.now();
    const div = document.createElement('div');
    div.className = 'upload-box';
    div.id = boxId;
    div.innerHTML = `
        <div class="upload-controls">
            <input type="file" accept="image/*" onchange="previewEvidenceImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
            <label for="input-${boxId}" class="upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Chọn ảnh</span>
            </label>
            <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove()">✖</button>
        </div>
        <div class="preview-area" id="preview-${boxId}"></div>
    `;
    container.appendChild(div);
}

function previewModelImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px; cursor: zoom-in;" onclick="openModal(this.src)">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewEvidenceImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="max-width: 100%; height: auto; margin-top: 10px; cursor: zoom-in;" onclick="openModal(this.src)">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function addEvidenceSizingSlot() {
    const container = document.getElementById('evidence-sizing-grid');
    if (!container) return;
    const boxId = 'evidence-sizing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'upload-box';
    div.id = boxId;
    div.innerHTML = `
        <div class="upload-controls">
            <input type="file" accept="image/*" onchange="previewEvidenceSizingImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
            <label for="input-${boxId}" class="upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Chọn ảnh</span>
            </label>
            <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove()">✖</button>
        </div>
        <div class="preview-area" id="preview-${boxId}"></div>
    `;
    container.appendChild(div);
}

function previewEvidenceSizingImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="max-width: 100%; height: auto; margin-top: 10px; cursor: zoom-in;" onclick="openModal(this.src)">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Handle multiple images uploaded per input-table row (POC or sizing)
function handleRowEvidenceUpload(input, kind) {
    const files = input.files;
    if (!files || files.length === 0) return;
    const cellWrapper = input.closest('.cell-wrapper');
    const container = cellWrapper?.querySelector('.row-evidence-container');
    if (!container) return;
    // Only accept the first file (single image per cell)
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const div = document.createElement('div');
        div.className = 'row-evidence-item';
        const safeBase64 = e.target.result.replace(/"/g, '&quot;');
        div.innerHTML = `<button type="button" class="btn-view-evidence" data-base64="${safeBase64}" onclick="openModalFromElement(this)">Xem</button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)">✖</button>`;
        // append and then hide upload icon to prevent uploading more
        container.appendChild(div);
        const label = cellWrapper.querySelector('.upload-icon-btn');
        if (label) label.style.display = 'none';
    };
    reader.readAsDataURL(file);
    // Clear input so same file can be selected again if needed
    input.value = '';
}

function removeRowEvidence(btn) {
    const item = btn.closest('.row-evidence-item');
    if (item) {
        const container = item.parentElement;
        item.remove();
        // nếu không còn ảnh nào trong container, hiện lại icon upload
        if (container && container.children.length === 0) {
            const cellWrapper = container.closest('.cell-wrapper');
            const label = cellWrapper?.querySelector('.upload-icon-btn');
            if (label) label.style.display = '';
        }
    }
}

// Simple HTML escaper for values inserted into row markup
function escapeHtml(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Handler for Đánh giá button clicks
async function evaluateSection(sectionKey) {
    const names = {
        request: 'Yêu cầu bài toán',
        input: 'Thông tin đầu vào',
        model: 'Mô hình hệ thống',
        summary: 'Tổng hợp và đề xuất'
    };
    const label = names[sectionKey] || sectionKey;
    if (!confirm(`Gửi đánh giá cho "${label}"?`)) return;

    const statusIdMap = {
        request: 'save-status',
        input: 'input-save-status',
        model: 'model-save-status',
        summary: 'summary-save-status'
    };
    const statusDiv = document.getElementById(statusIdMap[sectionKey]);
    if (statusDiv) statusDiv.innerHTML = '<span style="color: #b8860b;">⏳ Đang gửi đánh giá...</span>';

    const user = getCurrentUser();
    if ((user.role || '').toLowerCase() !== 'admin1') {
        alert('Chỉ admin mới được gửi đánh giá');
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Chỉ admin mới có quyền đánh giá</span>';
        return;
    }

    if (!currentProjectId) {
        alert('Chưa chọn dự án');
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Chưa chọn dự án</span>';
        return;
    }

    // Build reviewJson depending on section
    let reviewObj = {};
    try {
        if (sectionKey === 'request') {
            const data = collectYeuCauBaiToan();
            reviewObj = data.adminReview || {};
        } else if (sectionKey === 'input') {
            // collect admin evals and notes per input row
            const rows = Array.from(document.querySelectorAll('#input-table-body tr'));
            reviewObj.rows = rows.map(row => ({ eval: row.querySelector('.admin-eval')?.value || '', note: row.querySelector('.admin-note')?.value || '' }));
        } else if (sectionKey === 'model') {
            reviewObj = {
                physical: { eval: document.getElementById('eval-physical')?.value || '', note: document.getElementById('note-physical')?.value || '' },
                logical: { eval: document.getElementById('eval-logical')?.value || '', note: document.getElementById('note-logical')?.value || '' },
                flow: { eval: document.getElementById('eval-flow')?.value || '', note: document.getElementById('note-flow')?.value || '' }
            };
        } else {
            reviewObj = { message: 'unsupported section' };
        }
    } catch (e) {
        console.error('Error collecting review data', e);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi thu thập dữ liệu đánh giá</span>';
        return;
    }

    // Send to backend evaluate endpoint
    try {
        const resp = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ section: sectionKey, reviewJson: JSON.stringify(reviewObj) })
        });

        if (resp.ok) {
            if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Đã gửi đánh giá</span>';
            
            // Đợi một chút để đảm bảo database đã commit transaction
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Tạo revision khi admin1 đánh giá thành công
            await createRevision(`${user.displayName || user.username || 'Admin'} đánh giá ${label}`);
            
            // Cập nhật trạng thái dự án (admin1 review)
            await updateProjectStatus('admin1_review');
            
            alert('Đã gửi đánh giá cho "' + label + '"');
            // reload data to reflect saved admin review
            await loadAllDataFromDB();
        } else {
            const txt = await resp.text();
            throw new Error(txt || 'Server error');
        }
    } catch (err) {
        console.error('Evaluate error', err);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi gửi đánh giá</span>';
        alert('Lỗi khi gửi đánh giá: ' + err.message);
    }
}

// Open modal when clicking a 'Xem' button; read base64 from data attribute
function openModalFromElement(el) {
    const base64 = el.getAttribute('data-base64');
    if (base64) {
        openModal(base64);
    } else {
        // If an <img> exists inside (fallback), open its src
        const img = el.querySelector && el.querySelector('img');
        if (img && img.src) openModal(img.src);
    }
}

// ==================== EXPORT TO WORD ====================

async function exportToWord() {
    const statusDiv = document.getElementById('summary-save-status');
    
    if (!currentProjectId) {
        alert('Chưa có dữ liệu để xuất! Vui lòng lưu dữ liệu trước.');
        return;
    }

    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang tạo file DOCX...</span>';
        
        // Gọi API export từ backend1
        const response = await fetch(`${API_BASE_URL}/export/project/${currentProjectId}`, {
            method: 'GET',
            headers: { 'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
        });
        
        if (response.ok) {
            // Lấy blob từ response
            const blob = await response.blob();
            
            // Lấy filename từ header Content-Disposition nếu có
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `project-report-${currentProjectId}.docx`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // Tạo URL và download file
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Xuất file DOCX thành công!</span>';
        } else {
            throw new Error('Không thể xuất file');
        }
    } catch (e) {
        console.error('Export error:', e);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi xuất file!</span>';
        alert('Không thể xuất báo cáo: ' + e.message);
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    console.log('Current Project ID:', currentProjectId);
    checkAuthStatus();
    applyRolePermissions();

    // Luôn chuyển hướng đến danh sách dự án khi đã đăng nhập (trừ khi đang xem dự án cụ thể)
    // Nếu không có project đang mở, hiện danh sách dự án
    if (!currentProjectId) {
        document.getElementById('project-list-page').style.display = 'block';
        document.getElementById('project-detail-page').style.display = 'none';
        document.getElementById('btn-back-to-list').style.display = 'none';
        
        // Ẩn nút Lịch sử phiên bản khi ở trang danh sách
        const btnVersionHistory = document.getElementById('btn-version-history');
        if (btnVersionHistory) btnVersionHistory.style.display = 'none';
        
        await loadProjectList();
    } else {
        document.getElementById('project-list-page').style.display = 'none';
        document.getElementById('project-detail-page').style.display = 'flex';
        document.getElementById('btn-back-to-list').style.display = 'inline-block';
        
        // Hiện nút Lịch sử phiên bản khi ở trang chi tiết
        const btnVersionHistory = document.getElementById('btn-version-history');
        if (btnVersionHistory) btnVersionHistory.style.display = 'inline-block';
        
        await loadAllDataFromDB();
        applyRolePermissions();
    }

    const menuLinks = document.querySelectorAll(".side-menu a");
    const pages = document.querySelectorAll(".page-section");
    menuLinks.forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            menuLinks.forEach(l => l.classList.remove("active"));
            this.classList.add("active");
            pages.forEach(page => page.classList.remove("active"));
            const targetId = "page-" + this.getAttribute("data-target");
            const targetPage = document.getElementById(targetId);
            if (targetPage) {
                targetPage.classList.add("active");
                if (this.getAttribute("data-target") === 'sizing') {
                    const sizingIframe = document.getElementById('sizing-iframe');
                    if (sizingIframe && currentProjectId) {
                        const baseUrl = sizingIframe.src.split('?')[0];
                        sizingIframe.src = `${baseUrl}?projectId=${currentProjectId}`;
                    }
                }
            }
        });
    });

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.onclick = saveYeuCauBaiToan;
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.onclick = addInputRow;
    const saveInputDataBtn = document.getElementById('saveInputDataBtn');
    if (saveInputDataBtn) saveInputDataBtn.onclick = saveThongTinDauVao;
    const addBaselineBtn = document.getElementById('addBaselineRowBtn');
    if (addBaselineBtn) addBaselineBtn.onclick = addBaselineRow;
    const addArchBtn = document.getElementById('addArchRowBtn');
    if (addArchBtn) addArchBtn.onclick = addArchRow;
    const saveModelBtn = document.getElementById('saveModelBtn');
    if (saveModelBtn) saveModelBtn.onclick = saveMoHinhHeThong;
    const addSummaryBtn = document.getElementById('addSummaryRowBtn');
    if (addSummaryBtn) addSummaryBtn.onclick = addSummaryRow;
    const saveSummaryBtn = document.getElementById('saveSummaryBtn');
    if (saveSummaryBtn) saveSummaryBtn.onclick = saveTongHop;
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = exportToWord;
});
// Hàm xóa dòng cuối cùng của bảng
function removeLastRow(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    // Chỉ xóa nếu có nhiều hơn 1 dòng (để lại dòng đầu tiên)
    if (tbody && tbody.rows.length > 1) {
        tbody.deleteRow(tbody.rows.length - 1);
    } else {
        alert("Không thể xóa dòng duy nhất!");
    }
}
// --- CÁC HÀM XỬ LÝ MODAL ---

// Hàm mở Modal xem ảnh to
function openModal(imgSrc) {
    const modal = document.getElementById("evidence-modal");
    const modalImg = document.getElementById("modal-img");
    
    if (modal && modalImg && imgSrc) {
        modal.style.display = "flex"; // Hiện modal
        modalImg.src = imgSrc;
    }
}

// Hàm đóng Modal
function closeModal() {
    const modal = document.getElementById("evidence-modal");
    if (modal) {
        modal.style.display = "none";
    }
}

// Đóng modal khi nhấn phím ESC
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        closeModal();
        closeVersionHistory();
        closeVersionPreview();
    }
});

// ============================================================
// LOGIC XỬ LÝ TRANG ĐỊNH CỠ (BASELINE) - FULL TÍNH NĂNG
// ============================================================

// 1. Danh sách Module để hiển thị trong Dropdown
const MODULE_LIST = [
    "APP (Application)", 
    "DB (Database)", 
    "WEB (Web Server)", 
    "LB (Load Balancer)", 
    "CACHE (Redis/Memcached)", 
    "SEARCH (Elasticsearch)", 
    "MQ (Kafka/RabbitMQ)", 
    "OTHER"
];

// 2. Hàm Thêm dòng mới
function addBaselineRow() {
    const tbody = document.getElementById('baseline-table-body');
    const inputConfigTbody = document.getElementById('input-config-table-body');
    if (!tbody) return;

    // Tính số thứ tự (STT)
    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    
    // Tạo chuỗi HTML các option cho Select Box
    let optionsHtml = '<option value="">-- Chọn --</option>';
    MODULE_LIST.forEach(mod => {
        optionsHtml += `<option value="${mod}">${mod}</option>`;
    });

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        
        <td>
            <select class="input-full module-select">
                ${optionsHtml}
            </select>
        </td>
        
        <td><input type="text" class="input-full text-center ip-input" placeholder="10.x.x.x" oninput="syncIPToInputConfig(this)"></td>
        
        <td><input type="text" class="input-full cpu-input" placeholder="Intel Xeon..."></td>
        
        <td>
            <input type="number" class="input-full text-center ram-input" value="0" min="0" oninput="updateBaselineTotal(); recalculateInputConfigForRow(this)">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-input" value="0" min="0" oninput="updateBaselineTotal(); recalculateInputConfigForRow(this)">
        </td>
        
        <td>
            <input type="number" class="input-full text-center cint-input" value="0" min="0" oninput="updateBaselineTotal(); recalculateInputConfigForRow(this)">
        </td>
        
        <td class="admin-cell">
            <select class="admin-eval-select" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        
        <td class="admin-cell">
            <input type="text" class="input-full admin-note" placeholder="Nhận xét...">
        </td>
        
        <td class="text-center">
            <button class="btn-delete-row-item" onclick="deleteBaselineRow(this)">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    // Tự động thêm dòng tương ứng vào bảng input config
    if (inputConfigTbody) {
        addInputConfigRow();
    }
}

// 3. Hàm Xóa dòng & Cập nhật lại STT
function deleteBaselineRow(btn) {
    if(confirm('Bạn có chắc muốn xóa dòng này?')) {
        const baselineRow = btn.closest('tr');
        const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
        
        baselineRow.remove();
        
        // Xóa dòng tương ứng trong input config table
        const inputConfigTbody = document.getElementById('input-config-table-body');
        if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
            inputConfigTbody.rows[baselineRowIndex].remove();
        }
        updateRowNumbers();   // Đánh lại số STT
        updateInputConfigRowNumbers();
        updateBaselineTotal(); // Tính lại tổng
        updateInputConfigTotal();
    }
}

// 4. Helper: Cập nhật lại số thứ tự (1, 2, 3...) khi xóa dòng giữa
function updateRowNumbers() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if(sttCell) sttCell.innerText = index + 1;
    });
}

// 5. Hàm Tính Tổng (RAM & Cint)
function updateBaselineTotal() {
    const totalRamEl = document.getElementById('total-ram');
    const totalCintEl = document.getElementById('total-cint');
    const totalDiskEl = document.getElementById('total-disk');
    if (!totalRamEl || !totalCintEl) return;

    let totalRam = 0;
    let totalCint = 0;
    let totalDisk = 0;

    document.querySelectorAll('.ram-input').forEach(input => {
        totalRam += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.cint-input').forEach(input => {
        totalCint += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.disk-input').forEach(input => {
        totalDisk += parseFloat(input.value) || 0;
    });

    totalRamEl.innerText = totalRam;
    totalCintEl.innerText = totalCint;
    if (totalDiskEl) totalDiskEl.innerText = totalDisk;
}

// 6. Helper: Đổi màu xanh/đỏ cho ô Admin Select
function styleAdminSelect(select) {
    select.classList.remove('ok-status', 'nok-status');
    if(select.value === 'OK') select.classList.add('ok-status');
    if(select.value === 'NOK') select.classList.add('nok-status');
}

// 6a. Helper: Đồng bộ IP từ bảng baseline sang input config
function syncIPToInputConfig(ipInput) {
    const baselineRow = ipInput.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    const inputConfigTbody = document.getElementById('input-config-table-body');
    
    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        const inputConfigRow = inputConfigTbody.rows[baselineRowIndex];
        const ipConfigInput = inputConfigRow.querySelector('.ip-config-input');
        if (ipConfigInput) {
            ipConfigInput.value = ipInput.value;
        }
    }
}

// 6b. Helper: Tính lại kết quả cho dòng input config tương ứng khi baseline thay đổi
function recalculateInputConfigForRow(baselineInput) {
    const baselineRow = baselineInput.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    const inputConfigTbody = document.getElementById('input-config-table-body');
    
    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        const inputConfigRow = inputConfigTbody.rows[baselineRowIndex];
        // Lấy input bất kỳ từ input config row để tính toán
        const cpuLoadInput = inputConfigRow.querySelector('.cpu-load-input');
        if (cpuLoadInput) {
            calculateInputConfigRow(cpuLoadInput);
        }
    }
}

// 7. HÀM LƯU DỮ LIỆU (VALIDATE NGHIÊM NGẶT)
function saveBaselineData() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    
    // Check 1: Phải có ít nhất 1 dòng
    if(rows.length === 0) {
        alert("Vui lòng thêm ít nhất một Server tham chiếu!");
        return;
    }

    let isValid = true;
    let firstError = null;
    const dataToSave = [];

    // Xóa lỗi cũ
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    rows.forEach((row, index) => {
        const moduleSel = row.querySelector('.module-select');
        const adminEval = row.querySelector('.admin-eval-select');
        const inputs = row.querySelectorAll('input');

        // Rule 1: User bắt buộc chọn Module
        if(!moduleSel.value) {
            moduleSel.classList.add('input-error');
            isValid = false;
            if(!firstError) firstError = moduleSel;
        }

        // Rule 2: Admin bắt buộc phải đánh giá (OK/NOK)
        if(!adminEval.value) {
            adminEval.classList.add('input-error');
            isValid = false;
            if(!firstError) firstError = adminEval;
        }

        if(isValid) {
            dataToSave.push({
                stt: index + 1,
                module: moduleSel.value,
                ip: inputs[0].value, // IP
                cpu: inputs[1].value, // CPU
                ram: inputs[2].value, // RAM
                cint: inputs[3].value, // Cint
                adminRating: adminEval.value,
                adminNote: inputs[4].value // Ghi chú Admin
            });
        }
    });

    if(!isValid) {
        alert("KHÔNG THỂ LƯU!\nVui lòng điền các ô bị báo đỏ:\n1. Chọn tên Module.\n2. Admin phải Đánh giá từng dòng.");
        if(firstError) firstError.focus();
        return;
    }

    console.log("Dữ liệu chuẩn bị lưu:", dataToSave);
    alert("✓ Đã lưu cấu hình tham chiếu thành công!");
    
    // TODO: Viết code gọi API lưu vào DB ở đây
}

// Hàm chuyển Tab (Ẩn hiện các mục nội dung)
function showSection(sectionId, linkElement) {
    // 1. Ẩn tất cả các trang nội dung (có class .page-section)
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(sec => {
        sec.classList.remove('active'); // Xóa class active
        sec.style.display = 'none'; // Ẩn bằng style
    });

    // 2. Hiện trang nội dung được chọn
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active'); // Thêm class active
        target.style.display = 'block'; // Hiện bằng style
    } else {
        console.error('Không tìm thấy ID: ' + sectionId);
    }

    // 3. Cập nhật trạng thái "active" (màu đỏ) cho Menu bên trái
    const menuLinks = document.querySelectorAll('.side-menu a');
    menuLinks.forEach(link => link.classList.remove('active')); // Xóa active cũ
    
    // Thêm active cho link vừa bấm
    if (linkElement) {
        linkElement.classList.add('active');
    }
}

// Tự động thêm 1 dòng trắng khi load trang lần đầu
document.addEventListener("DOMContentLoaded", function() {
    const tbody = document.getElementById('baseline-table-body');
    if(tbody && tbody.children.length === 0) {
        addBaselineRow();
    }
    // Tính tổng khi trang load
    updateBaselineTotal();
    updateInputConfigTotal();
});
// ==================== XỬ LÝ BẢNG TÍNH TOÁN (INPUT CONFIG) ====================

function addInputConfigRow() {
    const tbody = document.getElementById('input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        
        <td><input type="text" class="input-full text-center ip-config-input" placeholder="10.x.x.x"></td>
        
        <td>
            <input type="number" class="input-full text-center cpu-load-input" value="0" min="0" max="100" step="0.01" oninput="calculateInputConfigRow(this)">
        </td>

        <td>
            <input type="number" class="input-full text-center ram-load-input" value="0" min="0" max="100" step="0.01" oninput="calculateInputConfigRow(this)">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-load-input" value="0" min="0" max="100" step="0.01" oninput="calculateInputConfigRow(this)">
        </td>
        
        <td>
            <input type="number" class="input-full text-center cint-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;">
        </td>

        <td>
            <input type="number" class="input-full text-center ram-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;">
        </td>
        
        <td class="text-center">
            <button class="btn-delete-row-item" onclick="deleteInputConfigRow(this)">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
}

function calculateInputConfigRow(input) {
    const row = input.closest('tr');
    const cpuLoadInput = row.querySelector('.cpu-load-input');
    const ramLoadInput = row.querySelector('.ram-load-input');
    const cintUsedInput = row.querySelector('.cint-used-input');
    const ramUsedInput = row.querySelector('.ram-used-input');
    const diskUsedInput = row.querySelector('.disk-used-input');
    
    // Lấy giá trị từ bảng baseline tương ứng
    const baselineRows = document.querySelectorAll('#baseline-table-body tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    
    if (rowIndex < baselineRows.length) {
        const baselineRow = baselineRows[rowIndex];
        const baselineCint = parseFloat(baselineRow.querySelector('.cint-input').value) || 0;
        const baselineRam = parseFloat(baselineRow.querySelector('.ram-input').value) || 0;
        const baselineDisk = parseFloat(baselineRow.querySelector('.disk-input').value) || 0;
        
        const cpuLoad = parseFloat(cpuLoadInput.value) || 0;
        const ramLoad = parseFloat(ramLoadInput.value) || 0;
        const diskLoad = parseFloat(row.querySelector('.disk-load-input')?.value) || 0;
        
        // Công thức:
        // Cint_rate used (Cint) = Cint_rate_2017 (hệ thống tham chiếu) × Tải CPU 95th percentile (%)
        // RAM used (GB) = RAM (hệ thống tham chiếu) × Tải RAM 95th percentile (%)
        const cintUsed = (baselineCint * cpuLoad / 100).toFixed(2);
        const ramUsed = (baselineRam * ramLoad / 100).toFixed(2);
        const diskUsed = (baselineDisk * diskLoad / 100).toFixed(2);
        
        cintUsedInput.value = cintUsed;
        ramUsedInput.value = ramUsed;
        diskUsedInput.value = diskUsed;
    }
    
    updateInputConfigTotal();
}

function deleteInputConfigRow(btn) {
    if(confirm('Bạn có chắc muốn xóa dòng này?')) {
        btn.closest('tr').remove();
        updateInputConfigRowNumbers();
        updateInputConfigTotal();
    }
}

function updateInputConfigRowNumbers() {
    const rows = document.querySelectorAll('#input-config-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if(sttCell) sttCell.innerText = index + 1;
    });
}

function updateInputConfigTotal() {
    const totalCintUsedEl = document.getElementById('total-cint-used');
    const totalRamUsedEl = document.getElementById('total-ram-used');
    const totalDiskUsedEl = document.getElementById('total-disk-used');
    
    if (!totalCintUsedEl || !totalRamUsedEl || !totalDiskUsedEl) return;

    let totalCintUsed = 0;
    let totalRamUsed = 0;
    let totalDiskUsed = 0;

    document.querySelectorAll('.cint-used-input').forEach(input => {
        totalCintUsed += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.ram-used-input').forEach(input => {
        totalRamUsed += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.disk-used-input').forEach(input => {
        totalDiskUsed += parseFloat(input.value) || 0;
    });

    totalCintUsedEl.innerText = totalCintUsed.toFixed(2);
    totalRamUsedEl.innerText = totalRamUsed.toFixed(2);
    totalDiskUsedEl.innerText = totalDiskUsed.toFixed(2);
}

// Tính toán đề xuất số server & hiển thị bảng kết quả (lấy POC/Định cỡ từ phần THÔNG TIN ĐẦU VÀO)
function calculateSizingRecommendations() {
    const poc = parseFloat(document.getElementById('poc-value')?.value) || 0;
    const sizing = parseFloat(document.getElementById('sizing-value')?.value) || 0;
    if (!poc || !sizing) {
        alert('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".');
        return;
    }

    const totalCint = parseFloat(document.getElementById('total-cint-used')?.innerText) || 0;
    const totalRam = parseFloat(document.getElementById('total-ram-used')?.innerText) || 0;
    const totalDisk = parseFloat(document.getElementById('total-disk-used')?.innerText) || 0;

    // Tính toán các thông số cơ bản
    const factor = sizing / poc;
    
    // Các giá trị cần cho TPS
    const cintForTPS = totalCint * factor;
    const ramForTPS = totalRam * factor;
    const diskForTPS = totalDisk * factor;
    
    // Các giá trị sau khi nhân hệ số dự phòng và đảm bảo KPI
    const cintAfterKPI = cintForTPS / 0.75 * 1.1;
    const ramAfterKPI = ramForTPS / 0.9 * 1.1;
    const diskAfterKPI = diskForTPS / 0.8 * 1.1;

    // Tính N = RAM sau KPI / 64 (làm tròn lên)
    const ketqua = Math.ceil(ramAfterKPI / 32);

    let html = '';
    
    // ==================== BẢNG 1: Thông số Máy chủ Tiến trình ====================
    html += `<h4 style="margin-top:16px; margin-bottom:8px; color:#2c5282;"Bảng tính toán Máy chủ Tiến trình</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:50px;">STT</th>
                        <th style="width:350px;">Thông số</th>
                        <th style="width:150px;">Máy chủ Tiến trình</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="text-center">1</td>
                        <td>Cintrate cần cho TPS</td>
                        <td class="text-center">${cintForTPS.toFixed(2)}</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>RAM (GB) cần cho TPS</td>
                        <td class="text-center">${ramForTPS.toFixed(2)}</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td class="text-center">3</td>
                        <td>Disk (GB) cần cho TPS</td>
                        <td class="text-center">${diskForTPS.toFixed(2)}</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td class="text-center">4</td>
                        <td>Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td>KPI 75%. Sai số 1.1</td>
                    </tr>
                    <tr>
                        <td class="text-center">5</td>
                        <td>RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        <td>KPI 90%. Sai số 1.1</td>
                    </tr>
                    <tr>
                        <td class="text-center">6</td>
                        <td>Disk cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${diskAfterKPI.toFixed(2)}</td>
                        <td>KPI 80%. Sai số 1.1</td>
                    </tr>
                </tbody>
            </table>`;

    // ==================== ĐỀ XUẤT ====================
    html += `<div style="margin-top:16px; padding:12px; background:#e6fffa; border-left:4px solid #38b2ac; border-radius:4px;">
                <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa <strong>≈ 32 GB RAM</strong>, lựa chọn số N theo RAM: 
                N = ${ramAfterKPI.toFixed(2)} / 32 ≈ <strong>${ketqua}</strong>
            </div>`;

    // ==================== BẢNG 2: Giá trị N với Cint/RAM/Disk ====================
    const nValues = [
        { label: 'Ketqua - 1', value: Math.max(1, ketqua - 1) },
        { label: 'Ketqua', value: ketqua },
        { label: 'Ketqua + 1', value: ketqua + 1 }
    ];

    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Bảng phân bổ theo số lượng N</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:120px;">Giá trị N</th>
                        <th>Cint CPU yêu cầu</th>
                        <th>RAM yêu cầu</th>
                        <th>Disk yêu cầu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0f4f8;">
                        <td class="text-center">1</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        <td class="text-center">${diskAfterKPI.toFixed(2)}</td>
                    </tr>`;

    nValues.forEach(item => {
        const cintPerN = cintAfterKPI / item.value;
        const ramPerN = ramAfterKPI / item.value;
        const diskPerN = diskAfterKPI / item.value;
        const isMain = item.label === 'Ketqua';
        
        html += `<tr${isMain ? ' style="background:#e6ffed; font-weight:600;"' : ''}>
                    <td class="text-center">${item.value}</td>
                    <td class="text-center">${cintPerN.toFixed(2)}</td>
                    <td class="text-center">${ramPerN.toFixed(2)}</td>
                    <td class="text-center">${diskPerN.toFixed(2)}</td>
                </tr>`;
    });

    html += `</tbody></table>`;

    // ==================== BẢNG 3: Đề xuất thiết bị ====================
    const cintPerServer = Math.ceil(cintAfterKPI / ketqua);
    const ramPerServer = Math.ceil(ramAfterKPI / ketqua);
    const diskPerServer = Math.ceil(diskAfterKPI / ketqua);
    
    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Đề xuất thiết bị</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:250px;">Cấu hình</th>
                        <th style="width:100px;">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#e6ffed;">
                        <td>
                            <ul style="margin:0; padding-left:20px;">
                                <li>CPU: = ${cintPerServer} Cint</li>
                                <li>RAM: = ${ramPerServer} GB</li>
                                <li>DISK: = ${diskPerServer} GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>${ketqua + 1}</strong></td>
                        <td>Dự phòng N+1</td>
                    </tr>
                </tbody>
            </table>`;

    const container = document.getElementById('sizing-result-container');
    if (container) container.innerHTML = html;
}

// ==================== VERSION HISTORY SYSTEM ====================

// Biến lưu phiên bản đang xem trước
let currentPreviewRevisionId = null;
let currentPreviewSnapshot = null;
let previousPreviewSnapshot = null; // Phiên bản trước để so sánh
let allRevisionsList = []; // Lưu danh sách tất cả revisions

/**
 * Tạo một revision (snapshot) mới
 * @param {string} changeDescription - Mô tả thay đổi
 */
async function createRevision(changeDescription = '') {
    if (!currentProjectId) {
        console.warn('Không có projectId để tạo revision');
        return null;
    }
    
    const user = getCurrentUser();
    const changeLog = changeDescription || `Lưu dữ liệu lúc ${new Date().toLocaleString('vi-VN')}`;
    
    try {
        const response = await fetch(`${API_BASE_URL}/project-revisions`, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({
                projectId: currentProjectId,
                userId: user.username || user.displayName || 'User',
                changeLog: changeLog
            })
        });
        
        if (response.ok) {
            const revision = await response.json();
            console.log('✅ Đã tạo revision mới:', revision.id);
            return revision;
        } else {
            console.error('Lỗi tạo revision:', await response.text());
            return null;
        }
    } catch (error) {
        console.error('Lỗi khi tạo revision:', error);
        return null;
    }
}

/**
 * Mở panel lịch sử phiên bản
 */
async function openVersionHistory() {
    const panel = document.getElementById('version-history-panel');
    if (!panel) return;
    
    panel.classList.add('open');
    
    // Load danh sách revisions
    await loadVersionHistoryList();
}

/**
 * Đóng panel lịch sử phiên bản
 */
function closeVersionHistory() {
    const panel = document.getElementById('version-history-panel');
    if (panel) {
        panel.classList.remove('open');
    }
}

/**
 * Load danh sách lịch sử phiên bản
 */
async function loadVersionHistoryList() {
    const listContainer = document.getElementById('version-list');
    const loadingDiv = document.getElementById('version-list-loading');
    const emptyDiv = document.getElementById('version-list-empty');
    
    if (!listContainer) return;
    
    // Show loading
    listContainer.innerHTML = '';
    if (loadingDiv) loadingDiv.style.display = 'flex';
    if (emptyDiv) emptyDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/project-revisions/project/${currentProjectId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        if (response.ok) {
            const revisions = await response.json();
            allRevisionsList = revisions; // Lưu lại danh sách để dùng khi preview
            
            if (revisions.length === 0) {
                if (emptyDiv) emptyDiv.style.display = 'flex';
                return;
            }
            
            // Render danh sách
            listContainer.innerHTML = revisions.map((rev, index) => {
                const isFirst = index === 0;
                const versionNumber = revisions.length - index;
                const createdDate = formatVersionDate(rev.createdAt);
                
                return `
                    <div class="version-item ${isFirst ? 'current' : ''}" data-revision-id="${rev.id}">
                        <div class="version-header">
                            <div class="version-badge">${versionNumber}</div>
                            <div class="version-info">
                                <div class="version-user">
                                    <i class="fa-solid fa-user"></i> ${rev.userId || 'User'}
                                </div>
                                <div class="version-time">
                                    <i class="fa-solid fa-clock"></i> ${createdDate}
                                </div>
                            </div>
                        </div>
                        <div class="version-description">
                            ${rev.changeLog || 'Không có mô tả'}
                        </div>
                        <div class="version-actions">
                            <button class="btn-preview-version" onclick="event.stopPropagation(); previewVersion('${rev.id}')">
                                <i class="fa-solid fa-eye"></i> Xem trước
                            </button>
                            ${!isFirst ? `
                                <button class="btn-restore-mini" onclick="event.stopPropagation(); restoreVersion('${rev.id}')">
                                    <i class="fa-solid fa-rotate-left"></i> Khôi phục
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
        } else {
            listContainer.innerHTML = '<p style="color: red; text-align: center;">Lỗi khi tải lịch sử phiên bản</p>';
        }
    } catch (error) {
        console.error('Lỗi load version history:', error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        listContainer.innerHTML = '<p style="color: red; text-align: center;">Lỗi kết nối server</p>';
    }
}

/**
 * Format ngày cho version history
 */
function formatVersionDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Xem trước một phiên bản
 */
async function previewVersion(revisionId) {
    const modal = document.getElementById('version-preview-modal');
    const metaInfo = document.getElementById('vp-meta-info');
    const contentArea = document.getElementById('vp-content-area');
    
    if (!modal) return;
    
    currentPreviewRevisionId = revisionId;
    previousPreviewSnapshot = null; // Reset
    
    try {
        // Load revision data
        const response = await fetch(`${API_BASE_URL}/project-revisions/${revisionId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải phiên bản');
        }
        
        const revision = await response.json();
        currentPreviewSnapshot = JSON.parse(revision.snapshotContent || '{}');
        
        // Tìm và load phiên bản trước đó để so sánh
        const currentIndex = allRevisionsList.findIndex(r => r.id === revisionId);
        if (currentIndex >= 0 && currentIndex < allRevisionsList.length - 1) {
            const prevRevisionId = allRevisionsList[currentIndex + 1].id;
            try {
                const prevResponse = await fetch(`${API_BASE_URL}/project-revisions/${prevRevisionId}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });
                if (prevResponse.ok) {
                    const prevRevision = await prevResponse.json();
                    previousPreviewSnapshot = JSON.parse(prevRevision.snapshotContent || '{}');
                }
            } catch(e) {
                console.warn('Không thể load phiên bản trước:', e);
            }
        }
        
        // Show meta info
        if (metaInfo) {
            const hasPrevious = previousPreviewSnapshot !== null;
            metaInfo.innerHTML = `
                <div class="vp-meta-item">
                    <i class="fa-solid fa-user"></i>
                    <span>Người sửa: <strong>${revision.userId || 'User'}</strong></span>
                </div>
                <div class="vp-meta-item">
                    <i class="fa-solid fa-clock"></i>
                    <span>Thời gian: <strong>${formatVersionDate(revision.createdAt)}</strong></span>
                </div>
                <div class="vp-meta-item">
                    <i class="fa-solid fa-edit"></i>
                    <span>Ghi chú: <strong>${revision.changeLog || 'Không có'}</strong></span>
                </div>
                <div class="vp-meta-item" style="margin-left: auto;">
                    <i class="fa-solid fa-code-compare" style="color: ${hasPrevious ? '#10b981' : '#999'};"></i>
                    <span style="color: ${hasPrevious ? '#10b981' : '#999'};">
                        ${hasPrevious ? 'Hiển thị thay đổi so với phiên bản trước' : 'Phiên bản đầu tiên'}
                    </span>
                </div>
            `;
        }
        
        // Show modal
        modal.style.display = 'flex';
        
        // Default tab
        switchPreviewTab('request');
        
    } catch (error) {
        console.error('Lỗi xem trước phiên bản:', error);
        alert('Không thể tải phiên bản: ' + error.message);
    }
}

/**
 * Chuyển tab trong preview modal
 */
function switchPreviewTab(tabName) {
    // Update active tab
    document.querySelectorAll('.vp-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });
    
    const contentArea = document.getElementById('vp-content-area');
    if (!contentArea || !currentPreviewSnapshot) return;
    
    let html = '';
    
    switch(tabName) {
        case 'request':
            html = renderRequestDiff(currentPreviewSnapshot, previousPreviewSnapshot);
            break;
        case 'input':
            html = renderInputDiff(currentPreviewSnapshot, previousPreviewSnapshot);
            break;
        case 'model':
            html = renderModelDiff(currentPreviewSnapshot, previousPreviewSnapshot);
            break;
        case 'summary':
            html = renderSummaryDiff(currentPreviewSnapshot, previousPreviewSnapshot);
            break;
    }
    
    contentArea.innerHTML = html;
}

// ==================== DIFF HELPER FUNCTIONS ====================

/**
 * So sánh 2 giá trị và trả về HTML với highlight
 */
function renderDiffValue(newVal, oldVal) {
    const newStr = (newVal || '').toString().trim();
    const oldStr = (oldVal || '').toString().trim();
    
    if (newStr === oldStr) {
        // Không thay đổi - không hiển thị
        return null;
    }
    
    let html = '';
    if (oldStr && oldStr !== newStr) {
        html += `<span class="diff-removed">${oldStr}</span>`;
    }
    if (newStr && newStr !== oldStr) {
        html += `<span class="diff-added">${newStr}</span>`;
    }
    return html || null;
}

/**
 * Kiểm tra xem có sự thay đổi giữa 2 object không
 */
function hasChanges(newObj, oldObj, keys) {
    if (!oldObj) return true; // Phiên bản đầu tiên, hiển thị tất cả
    for (const key of keys) {
        const newVal = (newObj[key] || '').toString().trim();
        const oldVal = (oldObj[key] || '').toString().trim();
        if (newVal !== oldVal) return true;
    }
    return false;
}

/**
 * Render preview cho Yêu cầu bài toán - DIFF MODE
 */
function renderRequestDiff(snapshot, prevSnapshot) {
    const content = snapshot.yeuCauBaiToanContent;
    if (!content) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = {};
    if (prevSnapshot && prevSnapshot.yeuCauBaiToanContent) {
        try {
            prevData = typeof prevSnapshot.yeuCauBaiToanContent === 'string' 
                ? JSON.parse(prevSnapshot.yeuCauBaiToanContent) 
                : prevSnapshot.yeuCauBaiToanContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review
    let adminReview = {};
    if (snapshot.yeuCauAdminReview) {
        try {
            adminReview = typeof snapshot.yeuCauAdminReview === 'string' 
                ? JSON.parse(snapshot.yeuCauAdminReview) 
                : snapshot.yeuCauAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.yeuCauAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.yeuCauAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.yeuCauAdminReview) 
                : prevSnapshot.yeuCauAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    // Danh sách các field
    const fields = [
        { label: 'Đơn vị phát triển', key: 'devUnit', adminKey: 'row0' },
        { label: 'Tên dự án', key: 'projectName', adminKey: 'row1' },
        { label: 'Chức năng hệ thống', key: 'sysFeature', adminKey: 'row2' },
        { label: 'Đầu mối định cỡ', key: 'contactPerson', adminKey: 'row3' },
        { label: 'Mục đích định cỡ', key: 'sizingPurpose', adminKey: 'row4' },
        { label: 'Cơ sở định cỡ', key: 'sizingBasis', adminKey: 'row5' },
        { label: 'Nguyên tắc định cỡ', key: 'sizingRule', adminKey: 'row6' },
        { label: 'Mức độ quan trọng', key: 'importance', adminKey: 'row7' },
        { label: 'Thời gian triển khai', key: 'deploymentTime', adminKey: 'row8' }
    ];
    
    // Chỉ lấy những field có thay đổi
    const changedFields = fields.filter(field => {
        const newVal = (data[field.key] || '').toString().trim();
        const oldVal = (prevData[field.key] || '').toString().trim();
        const newAdmin = adminReview[field.adminKey] || {};
        const oldAdmin = prevAdminReview[field.adminKey] || {};
        
        return newVal !== oldVal || 
               (newAdmin.eval || '') !== (oldAdmin.eval || '') ||
               (newAdmin.note || '') !== (oldAdmin.note || '');
    });
    
    if (changedFields.length === 0 && prevSnapshot) {
        return `
            <div class="vp-section">
                <div class="vp-no-changes">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>Không có thay đổi trong phần Yêu cầu bài toán</span>
                </div>
            </div>
        `;
    }
    
    const fieldsHtml = changedFields.map(field => {
        const newVal = data[field.key] || '';
        const oldVal = prevData[field.key] || '';
        const admin = adminReview[field.adminKey] || {};
        const prevAdmin = prevAdminReview[field.adminKey] || {};
        
        // Render diff cho giá trị
        let valueHtml = '';
        if (oldVal && oldVal !== newVal) {
            valueHtml += `<div class="diff-removed">${oldVal}</div>`;
        }
        if (newVal && newVal !== oldVal) {
            valueHtml += `<div class="diff-added">${newVal}</div>`;
        }
        if (newVal === oldVal && newVal) {
            valueHtml = newVal;
        }
        
        // Render diff cho admin eval
        let evalHtml = renderEvalDiff(admin.eval, prevAdmin.eval);
        
        // Render diff cho admin note
        let noteHtml = '';
        const newNote = admin.note || '';
        const oldNote = prevAdmin.note || '';
        if (oldNote && oldNote !== newNote) {
            noteHtml += `<div class="diff-removed">${oldNote}</div>`;
        }
        if (newNote && newNote !== oldNote) {
            noteHtml += `<div class="diff-added">${newNote}</div>`;
        }
        if (newNote === oldNote) {
            noteHtml = newNote || '-';
        }
        
        return `
            <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 500; background: #f8fafc; width: 180px;">${field.label}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${valueHtml || '-'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; width: 80px;">${evalHtml}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; width: 200px; color: #6366f1; font-style: italic;">${noteHtml}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Yêu cầu bài toán 
                <span class="diff-count">(${changedFields.length} thay đổi)</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Tiêu chí</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Nội dung</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; width: 80px;">Đánh giá</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; width: 200px;">Ghi chú Admin</th>
                    </tr>
                </thead>
                <tbody>
                    ${fieldsHtml}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Helper render diff cho eval badge
 */
function renderEvalDiff(newEval, oldEval) {
    const renderBadge = (val) => {
        if (!val) return '';
        if (val === 'OK') return '<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">OK</span>';
        if (val === 'NOK') return '<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">NOK</span>';
        return `<span>${val}</span>`;
    };
    
    if ((newEval || '') === (oldEval || '')) {
        return renderBadge(newEval) || '-';
    }
    
    let html = '';
    if (oldEval) {
        html += `<div class="diff-removed">${renderBadge(oldEval)}</div>`;
    }
    if (newEval) {
        html += `<div class="diff-added">${renderBadge(newEval)}</div>`;
    }
    return html || '-';
}

/**
 * Render diff cho Thông tin đầu vào
 */
function renderInputDiff(snapshot, prevSnapshot) {
    const content = snapshot.thongTinDauVaoContent;
    const hasAdminReview = snapshot.thongTinAdminReview;
    const prevHasAdminReview = prevSnapshot && prevSnapshot.thongTinAdminReview;
    
    // Kiểm tra xem có dữ liệu gì không (user content hoặc admin review)
    if (!content && !hasAdminReview) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data = { inputRows: [] };
    if (content) {
        try {
            data = typeof content === 'string' ? JSON.parse(content) : content;
        } catch(e) {
            console.error('Lỗi parse thongTinDauVaoContent:', e);
        }
    }
    
    // Parse previous data
    let prevData = { inputRows: [] };
    if (prevSnapshot && prevSnapshot.thongTinDauVaoContent) {
        try {
            prevData = typeof prevSnapshot.thongTinDauVaoContent === 'string' 
                ? JSON.parse(prevSnapshot.thongTinDauVaoContent) 
                : prevSnapshot.thongTinDauVaoContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review - có thể ở format { rows: [...] } hoặc { row0: {...}, row1: {...} }
    let adminReview = {};
    let adminReviewRows = []; // Array format
    console.log('DEBUG renderInputDiff - snapshot.thongTinAdminReview:', snapshot.thongTinAdminReview);
    console.log('DEBUG renderInputDiff - prevSnapshot?.thongTinAdminReview:', prevSnapshot?.thongTinAdminReview);
    if (snapshot.thongTinAdminReview) {
        try {
            const parsed = typeof snapshot.thongTinAdminReview === 'string' 
                ? JSON.parse(snapshot.thongTinAdminReview) 
                : snapshot.thongTinAdminReview;
            console.log('DEBUG parsed adminReview:', parsed);
            if (parsed.rows && Array.isArray(parsed.rows)) {
                // Format { rows: [{ eval, note }, ...] }
                adminReviewRows = parsed.rows;
            } else {
                // Format { row0: {...}, row1: {...} }
                adminReview = parsed;
            }
        } catch(e) { /* ignore */ }
    }
    
    let prevAdminReview = {};
    let prevAdminReviewRows = []; // Array format
    if (prevSnapshot && prevSnapshot.thongTinAdminReview) {
        try {
            const parsed = typeof prevSnapshot.thongTinAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.thongTinAdminReview) 
                : prevSnapshot.thongTinAdminReview;
            if (parsed.rows && Array.isArray(parsed.rows)) {
                prevAdminReviewRows = parsed.rows;
            } else {
                prevAdminReview = parsed;
            }
        } catch(e) { /* ignore */ }
    }
    
    // Nếu không có inputRows nhưng có admin review thay đổi, vẫn hiển thị
    const hasAdminReviewChange = JSON.stringify(adminReviewRows) !== JSON.stringify(prevAdminReviewRows) ||
                                  JSON.stringify(adminReview) !== JSON.stringify(prevAdminReview);
    
    console.log('DEBUG hasAdminReviewChange:', hasAdminReviewChange);
    console.log('DEBUG adminReviewRows:', adminReviewRows);
    console.log('DEBUG prevAdminReviewRows:', prevAdminReviewRows);
    console.log('DEBUG data.inputRows length:', data.inputRows?.length);
    
    if ((!data.inputRows || data.inputRows.length === 0) && !hasAdminReviewChange) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu đầu vào</p>';
    }
    
    // Nếu không có inputRows nhưng có admin review, tạo rows ảo từ số lượng admin review
    if (!data.inputRows || data.inputRows.length === 0) {
        const numRows = Math.max(adminReviewRows.length, prevAdminReviewRows.length, 
                                 Object.keys(adminReview).filter(k => k.startsWith('row')).length,
                                 Object.keys(prevAdminReview).filter(k => k.startsWith('row')).length);
        data.inputRows = Array(numRows).fill({});
    }
    
    const prevRows = prevData.inputRows || [];
    
    // Tìm những hàng có thay đổi
    let changedRowsHtml = [];
    let changeCount = 0;
    
    data.inputRows.forEach((row, index) => {
        const prevRow = prevRows[index] || {};
        
        // Lấy admin data từ array hoặc object format
        const adminData = adminReviewRows[index] || adminReview['row' + index] || {};
        const prevAdminData = prevAdminReviewRows[index] || prevAdminReview['row' + index] || {};
        
        console.log(`DEBUG row ${index}: adminData=`, adminData, 'prevAdminData=', prevAdminData);
        
        // So sánh các trường
        const fields = ['dauVao', 'module', 'ghiChu'];
        const pocText = typeof row.taiHeThongPOC === 'object' ? row.taiHeThongPOC.text : (row.taiHeThongPOC || '');
        const prevPocText = typeof prevRow.taiHeThongPOC === 'object' ? prevRow.taiHeThongPOC.text : (prevRow.taiHeThongPOC || '');
        const sizingText = typeof row.dinhCo === 'object' ? row.dinhCo.text : (row.dinhCo || '');
        const prevSizingText = typeof prevRow.dinhCo === 'object' ? prevRow.dinhCo.text : (prevRow.dinhCo || '');
        
        let hasChange = false;
        for (const f of fields) {
            if ((row[f] || '').trim() !== (prevRow[f] || '').trim()) hasChange = true;
        }
        if (pocText.trim() !== prevPocText.trim()) hasChange = true;
        if (sizingText.trim() !== prevSizingText.trim()) hasChange = true;
        if ((adminData.eval || '') !== (prevAdminData.eval || '')) hasChange = true;
        if ((adminData.note || '') !== (prevAdminData.note || '')) hasChange = true;
        
        // Nếu là row mới (không có trong prev)
        const isNewRow = index >= prevRows.length;
        
        if (hasChange || isNewRow) {
            changeCount++;
            const rowClass = isNewRow ? 'diff-row-added' : '';
            
            changedRowsHtml.push(`
                <tr class="${rowClass}">
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(row.dauVao, prevRow.dauVao)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(pocText, prevPocText)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(sizingText, prevSizingText)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(row.module, prevRow.module)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(row.ghiChu, prevRow.ghiChu)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
                        ${renderEvalDiff(adminData.eval, prevAdminData.eval)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; color: #6366f1; font-style: italic;">
                        ${renderTextDiff(adminData.note, prevAdminData.note)}
                    </td>
                </tr>
            `);
        }
    });
    
    // Kiểm tra các hàng bị xóa
    if (prevRows.length > data.inputRows.length) {
        for (let i = data.inputRows.length; i < prevRows.length; i++) {
            const prevRow = prevRows[i];
            const prevPocText = typeof prevRow.taiHeThongPOC === 'object' ? prevRow.taiHeThongPOC.text : (prevRow.taiHeThongPOC || '');
            const prevSizingText = typeof prevRow.dinhCo === 'object' ? prevRow.dinhCo.text : (prevRow.dinhCo || '');
            changeCount++;
            changedRowsHtml.push(`
                <tr class="diff-row-removed">
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${i + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.dauVao || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevPocText || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevSizingText || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.module || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
                </tr>
            `);
        }
    }
    
    if (changedRowsHtml.length === 0 && prevSnapshot) {
        return `
            <div class="vp-section">
                <div class="vp-no-changes">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>Không có thay đổi trong phần Thông tin đầu vào</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Thông tin đầu vào 
                <span class="diff-count">(${changeCount} dòng thay đổi)</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0; width: 50px;">STT</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Đầu vào</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Tải POC</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Định cỡ</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Module</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Ghi chú</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; width: 80px; background: #fef3c7;">Đánh giá</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; width: 150px; background: #fef3c7;">Ghi chú Admin</th>
                    </tr>
                </thead>
                <tbody>
                    ${changedRowsHtml.join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Helper render diff cho text
 */
function renderTextDiff(newVal, oldVal) {
    const newStr = (newVal || '').toString().trim();
    const oldStr = (oldVal || '').toString().trim();
    
    if (newStr === oldStr) {
        return newStr || '-';
    }
    
    let html = '';
    if (oldStr) {
        html += `<div class="diff-removed">${oldStr}</div>`;
    }
    if (newStr) {
        html += `<div class="diff-added">${newStr}</div>`;
    }
    return html || '-';
}

/**
 * Render diff cho Mô hình hệ thống
 */
function renderModelDiff(snapshot, prevSnapshot) {
    const content = snapshot.moHinhHeThongContent;
    if (!content) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = {};
    if (prevSnapshot && prevSnapshot.moHinhHeThongContent) {
        try {
            prevData = typeof prevSnapshot.moHinhHeThongContent === 'string' 
                ? JSON.parse(prevSnapshot.moHinhHeThongContent) 
                : prevSnapshot.moHinhHeThongContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review
    let moHinhAdmin = {};
    if (snapshot.moHinhAdminReview) {
        try {
            moHinhAdmin = typeof snapshot.moHinhAdminReview === 'string' 
                ? JSON.parse(snapshot.moHinhAdminReview) 
                : snapshot.moHinhAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let prevMoHinhAdmin = {};
    if (prevSnapshot && prevSnapshot.moHinhAdminReview) {
        try {
            prevMoHinhAdmin = typeof prevSnapshot.moHinhAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.moHinhAdminReview) 
                : prevSnapshot.moHinhAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let changes = [];
    
    // So sánh số ảnh
    const physicalCount = (data.physicalImages || []).length;
    const prevPhysicalCount = (prevData.physicalImages || []).length;
    if (physicalCount !== prevPhysicalCount) {
        changes.push(`<div class="diff-item"><strong>Mô hình Vật lý:</strong> ${renderTextDiff(physicalCount + ' ảnh', prevPhysicalCount + ' ảnh')}</div>`);
    }
    
    const logicalCount = (data.logicalImages || []).length;
    const prevLogicalCount = (prevData.logicalImages || []).length;
    if (logicalCount !== prevLogicalCount) {
        changes.push(`<div class="diff-item"><strong>Mô hình Logic:</strong> ${renderTextDiff(logicalCount + ' ảnh', prevLogicalCount + ' ảnh')}</div>`);
    }
    
    const flowCount = (data.flowImages || []).length;
    const prevFlowCount = (prevData.flowImages || []).length;
    if (flowCount !== prevFlowCount) {
        changes.push(`<div class="diff-item"><strong>Luồng nghiệp vụ (ảnh):</strong> ${renderTextDiff(flowCount + ' ảnh', prevFlowCount + ' ảnh')}</div>`);
    }
    
    // So sánh mô tả
    const flowExpl = (data.flowExplanation || '').trim();
    const prevFlowExpl = (prevData.flowExplanation || '').trim();
    if (flowExpl !== prevFlowExpl) {
        changes.push(`<div class="diff-item"><strong>Mô tả luồng nghiệp vụ:</strong><br>${renderTextDiff(flowExpl || '(trống)', prevFlowExpl || '(trống)')}</div>`);
    }
    
    // So sánh admin review
    const adminPhysical = moHinhAdmin.physical || {};
    const prevAdminPhysical = prevMoHinhAdmin.physical || {};
    if ((adminPhysical.eval || '') !== (prevAdminPhysical.eval || '') || (adminPhysical.note || '') !== (prevAdminPhysical.note || '')) {
        changes.push(`<div class="diff-item"><strong>Admin đánh giá Mô hình Vật lý:</strong> ${renderEvalDiff(adminPhysical.eval, prevAdminPhysical.eval)} ${renderTextDiff(adminPhysical.note, prevAdminPhysical.note)}</div>`);
    }
    
    const adminLogical = moHinhAdmin.logical || {};
    const prevAdminLogical = prevMoHinhAdmin.logical || {};
    if ((adminLogical.eval || '') !== (prevAdminLogical.eval || '') || (adminLogical.note || '') !== (prevAdminLogical.note || '')) {
        changes.push(`<div class="diff-item"><strong>Admin đánh giá Mô hình Logic:</strong> ${renderEvalDiff(adminLogical.eval, prevAdminLogical.eval)} ${renderTextDiff(adminLogical.note, prevAdminLogical.note)}</div>`);
    }
    
    const adminFlow = moHinhAdmin.flow || {};
    const prevAdminFlow = prevMoHinhAdmin.flow || {};
    if ((adminFlow.eval || '') !== (prevAdminFlow.eval || '') || (adminFlow.note || '') !== (prevAdminFlow.note || '')) {
        changes.push(`<div class="diff-item"><strong>Admin đánh giá Luồng nghiệp vụ:</strong> ${renderEvalDiff(adminFlow.eval, prevAdminFlow.eval)} ${renderTextDiff(adminFlow.note, prevAdminFlow.note)}</div>`);
    }
    
    // So sánh archRows
    const archRows = data.archRows || [];
    const prevArchRows = prevData.archRows || [];
    if (archRows.length !== prevArchRows.length) {
        changes.push(`<div class="diff-item"><strong>Chi tiết thành phần:</strong> ${renderTextDiff(archRows.length + ' dòng', prevArchRows.length + ' dòng')}</div>`);
    } else {
        // Chi tiết từng dòng
        archRows.forEach((row, i) => {
            const prevRow = prevArchRows[i] || {};
            const fields = ['nghiepVu', 'module', 'zoneMang', 'heDieuHanh', 'soLuongVIP'];
            for (const f of fields) {
                if ((row[f] || '').trim() !== (prevRow[f] || '').trim()) {
                    changes.push(`<div class="diff-item"><strong>Thành phần dòng ${i+1} - ${f}:</strong> ${renderTextDiff(row[f], prevRow[f])}</div>`);
                }
            }
        });
    }
    
    if (changes.length === 0 && prevSnapshot) {
        return `
            <div class="vp-section">
                <div class="vp-no-changes">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>Không có thay đổi trong phần Mô hình hệ thống</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Mô hình hệ thống 
                <span class="diff-count">(${changes.length} thay đổi)</span>
            </div>
            <div class="diff-list">
                ${changes.join('')}
            </div>
        </div>
    `;
}

/**
 * Render diff cho Tổng hợp và đề xuất
 */
function renderSummaryDiff(snapshot, prevSnapshot) {
    const content = snapshot.tongHopVaDeXuatContent;
    if (!content) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = { summaryRows: [] };
    if (prevSnapshot && prevSnapshot.tongHopVaDeXuatContent) {
        try {
            prevData = typeof prevSnapshot.tongHopVaDeXuatContent === 'string' 
                ? JSON.parse(prevSnapshot.tongHopVaDeXuatContent) 
                : prevSnapshot.tongHopVaDeXuatContent;
        } catch(e) { /* ignore */ }
    }
    
    if (!data.summaryRows || data.summaryRows.length === 0) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Chưa có đề xuất</p>';
    }
    
    const prevRows = prevData.summaryRows || [];
    let changedRowsHtml = [];
    let changeCount = 0;
    
    data.summaryRows.forEach((row, index) => {
        const prevRow = prevRows[index] || {};
        const fields = ['module', 'soLuong', 'vCPU', 'ram', 'volume', 'ghiChu'];
        
        let hasChange = false;
        for (const f of fields) {
            if ((row[f] || '').toString().trim() !== (prevRow[f] || '').toString().trim()) hasChange = true;
        }
        
        const isNewRow = index >= prevRows.length;
        
        if (hasChange || isNewRow) {
            changeCount++;
            const rowClass = isNewRow ? 'diff-row-added' : '';
            
            changedRowsHtml.push(`
                <tr class="${rowClass}">
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(row.module, prevRow.module)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${renderTextDiff(row.soLuong, prevRow.soLuong)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${renderTextDiff(row.vCPU, prevRow.vCPU)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${renderTextDiff(row.ram, prevRow.ram)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(row.volume, prevRow.volume)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(row.ghiChu, prevRow.ghiChu)}</td>
                </tr>
            `);
        }
    });
    
    // Kiểm tra các hàng bị xóa
    if (prevRows.length > data.summaryRows.length) {
        for (let i = data.summaryRows.length; i < prevRows.length; i++) {
            const prevRow = prevRows[i];
            changeCount++;
            changedRowsHtml.push(`
                <tr class="diff-row-removed">
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${i + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.module || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.soLuong || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.vCPU || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.ram || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.volume || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
                </tr>
            `);
        }
    }
    
    if (changedRowsHtml.length === 0 && prevSnapshot) {
        return `
            <div class="vp-section">
                <div class="vp-no-changes">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>Không có thay đổi trong phần Tổng hợp</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Tổng hợp đề xuất 
                <span class="diff-count">(${changeCount} dòng thay đổi)</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">STT</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Module</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Số lượng</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">vCPU</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">RAM</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Volume</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>${changedRowsHtml.join('')}</tbody>
            </table>
        </div>
    `;
}

/**
 * Đóng modal xem trước phiên bản
 */
function closeVersionPreview() {
    const modal = document.getElementById('version-preview-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentPreviewRevisionId = null;
    currentPreviewSnapshot = null;
}

/**
 * Khôi phục từ phiên bản đang preview
 */
function restoreCurrentPreviewVersion() {
    if (currentPreviewRevisionId) {
        restoreVersion(currentPreviewRevisionId);
    }
}

/**
 * Khôi phục phiên bản
 */
async function restoreVersion(revisionId) {
    if (!confirm('⚠️ Bạn có chắc muốn khôi phục phiên bản này?\n\nDữ liệu hiện tại sẽ được thay thế bằng nội dung của phiên bản đã chọn.\n\nLưu ý: Một bản snapshot của dữ liệu hiện tại sẽ được tạo trước khi khôi phục.')) {
        return;
    }
    
    try {
        // 1. Tạo snapshot dữ liệu hiện tại trước khi khôi phục
        await createRevision('Backup trước khi khôi phục phiên bản');
        
        // 2. Gọi API restore
        const response = await fetch(`${API_BASE_URL}/project-revisions/${revisionId}/restore`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            alert('✅ Đã khôi phục phiên bản thành công!\n\nTrang sẽ được tải lại để hiển thị dữ liệu.');
            closeVersionPreview();
            closeVersionHistory();
            
            // Reload dữ liệu
            await loadAllDataFromDB();
            
        } else {
            throw new Error(await response.text() || 'Không thể khôi phục phiên bản');
        }
    } catch (error) {
        console.error('Lỗi khôi phục phiên bản:', error);
        alert('❌ Lỗi khi khôi phục phiên bản: ' + error.message);
    }
}

/**
 * Wrapper để lưu kèm tạo revision
 */
async function saveWithRevision(saveFunction, sectionName) {
    // Thực hiện save gốc
    await saveFunction();
    
    // Tạo revision
    const user = getCurrentUser();
    await createRevision(`${user.displayName || user.username || 'User'} cập nhật ${sectionName}`);
}

