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
        localStorage.removeItem('authToken');
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

// Xử lý lỗi 401 - chuyển hướng đến trang đăng nhập
function handleUnauthorized(response) {
    if (response.status === 401) {
        alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
        return true;
    }
    return false;
}

function applyRolePermissions() {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    // Check if project is completed (read-only for everyone)
    if (currentProjectStatus === 'HOAN_THANH') {
        applyReadOnlyMode();
        return;
    }

    // Admin (admin1 or admin2) can edit admin fields, other inputs read-only
    if (role === 'admin1' || role === 'admin2') {
        // remove page-level 'role-user' marker so CSS allows interaction
        document.body.classList.remove('role-user');
        document.body.classList.add('role-admin1');
        document.querySelectorAll('.admin-eval, .admin-note, .admin-eval-select').forEach(el => {
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
        // MODEL PAGE: Disable user fields, enable admin fields
        document.querySelectorAll('#page-model input, #page-model textarea, #page-model select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note') && !el.classList.contains('admin-eval-select')) {
                el.disabled = true;
            } else {
                el.disabled = false;
            }
        });
        
        // SIZING PAGE: Disable ALL user inputs (baseline table, input config table, etc.)
        document.querySelectorAll('#page-sizing input, #page-sizing textarea, #page-sizing select').forEach(el => {
            // Only enable admin fields
            if (!el.classList.contains('admin-eval') && 
                !el.classList.contains('admin-note') && 
                !el.classList.contains('admin-eval-select') &&
                !el.id?.startsWith('eval-') && 
                !el.id?.startsWith('note-')) {
                el.disabled = true;
            }
        });
        
        // Disable user buttons on sizing page
        document.querySelectorAll('#page-sizing button.sizing-user-btn, #page-sizing button.btn-add, #page-sizing button.btn-add-img').forEach(btn => {
            // Allow method toggle buttons (btn-method) to remain clickable for admin to view data
            if (btn.classList.contains('btn-method')) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
        
        // Disable delete buttons in sizing tables
        document.querySelectorAll('#page-sizing .btn-delete-row-item, #page-sizing .btn-delete').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
        
        // Enable admin fields on sizing page
        document.querySelectorAll('#page-sizing .admin-eval, #page-sizing .admin-note, #page-sizing .admin-eval-select').forEach(el => {
            el.disabled = false;
        });
        document.querySelectorAll('#page-sizing button.sizing-admin-btn, #page-sizing button.btn-evaluate').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });

        // Disable file inputs (uploads) in those sections
        document.querySelectorAll('#page-request input[type="file"], #page-input input[type="file"], #page-model input[type="file"], #page-sizing input[type="file"]').forEach(fi => fi.disabled = true);

        // Disable action buttons that manipulate user content but keep evaluate buttons enabled
        // DISABLE nút Lưu cho admin1 (btn-submit), chỉ cho bấm nút Đánh giá (btn-evaluate)
        document.querySelectorAll('#page-request button, #page-input button, #page-model button').forEach(btn => {
            // Admin1 chỉ được bấm nút Đánh giá, btn-view-evidence, btn-logout
            const allow = btn.classList.contains('btn-evaluate') || btn.classList.contains('btn-logout') || btn.classList.contains('btn-view-evidence');
            if (!allow) btn.disabled = true;
        });
        
        // Disable nút Lưu chính (saveBtn, saveInputDataBtn, saveModelBtn, saveSummaryBtn, saveSizingBtn)
        const saveButtons = ['saveBtn', 'saveInputDataBtn', 'saveModelBtn', 'saveSummaryBtn', 'saveSizingBtn'];
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
        document.body.classList.remove('role-admin1');
        document.querySelectorAll('.admin-eval, .admin-note, .admin-eval-select').forEach(el => {
            el.disabled = true;
            el.classList.add('readonly-admin');
        });
        document.querySelectorAll('#page-request input, #page-request textarea, #page-request select').forEach(el => el.disabled = false);
        document.querySelectorAll('#page-input input, #page-input textarea, #page-input select').forEach(el => el.disabled = false);
        
        // MODEL PAGE: Enable user fields, disable admin fields
        document.querySelectorAll('#page-model input, #page-model textarea, #page-model select').forEach(el => {
            if (el.classList.contains('admin-eval') || el.classList.contains('admin-note') || el.classList.contains('admin-eval-select')) {
                el.disabled = true;
                el.classList.add('readonly-admin');
            } else {
                el.disabled = false;
            }
        });
        
        // SIZING PAGE: Enable user inputs, disable admin inputs
        document.querySelectorAll('#page-sizing input, #page-sizing textarea, #page-sizing select').forEach(el => {
            // Enable by default for user
            el.disabled = false;
        });
        
        // Re-disable admin fields on sizing page for regular users
        document.querySelectorAll('#page-sizing .admin-eval, #page-sizing .admin-note, #page-sizing .admin-eval-select').forEach(el => {
            el.disabled = true;
            el.classList.add('readonly-admin');
        });
        // Also disable admin fields by ID pattern
        document.querySelectorAll('#page-sizing select[id^="eval-"], #page-sizing textarea[id^="note-"]').forEach(el => {
            el.disabled = true;
            el.classList.add('readonly-admin');
        });
        
        // Enable user buttons on sizing page
        document.querySelectorAll('#page-sizing button.sizing-user-btn, #page-sizing button.btn-add, #page-sizing button.btn-add-img').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
        
        // Disable admin evaluate button for users
        document.querySelectorAll('#page-sizing button.sizing-admin-btn, #page-sizing button.btn-evaluate').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Chỉ admin mới có quyền đánh giá';
        });
        
        // Re-enable file inputs and buttons for regular users
        document.querySelectorAll('#page-request input[type="file"], #page-input input[type="file"], #page-model input[type="file"], #page-sizing input[type="file"]').forEach(fi => fi.disabled = false);
        document.querySelectorAll('#page-request button, #page-input button, #page-model button').forEach(btn => btn.disabled = false);
        
        // DISABLE nút Đánh giá cho user (chỉ admin mới được đánh giá)
        document.querySelectorAll('.btn-evaluate').forEach(btn => {
            btn.disabled = true;
            btn.title = 'Chỉ admin mới có quyền đánh giá';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    }
    
    // Update project status display after applying permissions
    updateProjectStatusDisplay();
}

// Apply read-only mode for completed projects
function applyReadOnlyMode() {
    document.body.classList.add('role-readonly');
    document.body.classList.remove('role-user', 'role-admin1');
    
    // Disable ALL inputs, textareas, selects across all pages
    document.querySelectorAll('input, textarea, select').forEach(el => {
        el.disabled = true;
    });
    
    // Disable ALL buttons except navigation, logout, and image viewing
    document.querySelectorAll('button').forEach(btn => {
        const isNavOrLogout = btn.classList.contains('btn-logout') || 
                             btn.closest('.side-menu') || 
                             btn.closest('.header') ||
                             btn.id === 'exportBtn' ||
                             btn.classList.contains('btn-close-panel') ||
                             btn.classList.contains('btn-close-modal') ||
                             btn.classList.contains('btn-view-evidence') ||
                             btn.onclick?.toString().includes('openModal') ||
                             btn.onclick?.toString().includes('openModalFromElement') ||
                             btn.onclick?.toString().includes('openImageModal');
        if (!isNavOrLogout) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    // Ensure all image view buttons are explicitly enabled
    document.querySelectorAll('.btn-view-evidence').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
    });
    
    // Ensure images with onclick for modal are clickable
    document.querySelectorAll('img[onclick]').forEach(img => {
        img.style.pointerEvents = 'auto';
        img.style.cursor = 'zoom-in';
    });
    
    // Hide approve button
    const approveBtn = document.getElementById('btn-approve-project');
    if (approveBtn) approveBtn.style.display = 'none';
    
    // Show completed notification
    const notif = document.createElement('div');
    notif.style.cssText = 'position:fixed;top:20px;right:20px;background:#28a745;color:#fff;padding:12px 24px;border-radius:8px;z-index:99999;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    notif.textContent = 'Dự án đã hoàn thành - Chế độ chỉ đọc';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
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
            // User chỉnh sửa: quay về Sizing
            // Round chỉ tăng khi quay về từ PHE_DUYET (tức admin2 đã từ chối)
            if (currentProjectStatus === 'PHE_DUYET') {
                newStatus = 'SIZING';
                newRound = currentProjectStatusRound + 1;
            } else if (currentProjectStatus === 'THAM_DINH') {
                // Quay về từ Thẩm định -> giữ nguyên round (vẫn trong cùng chu kỳ phê duyệt)
                newStatus = 'SIZING';
                // Giữ nguyên round
            } else if (!currentProjectStatus || currentProjectStatus === 'Draft') {
                newStatus = 'SIZING';
                newRound = 1;
            }
            // Nếu đang ở SIZING thì giữ nguyên round
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
    const approveHeaderBtn = document.getElementById('btn-approve-header');
    if (!approveHeaderBtn) return;
    
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    // Nút phê duyệt luôn hiển thị trên header khi đang ở trong project detail
    const inProject = document.getElementById('project-detail-page')?.style.display !== 'none';
    approveHeaderBtn.style.display = inProject ? 'inline-flex' : 'none';
    
    // Chỉ admin2 mới bấm được, và chỉ khi dự án ở trạng thái PHE_DUYET
    const canApprove = (role === 'admin2' && currentProjectStatus === 'PHE_DUYET');
    approveHeaderBtn.disabled = !canApprove;
    approveHeaderBtn.style.opacity = canApprove ? '1' : '0.5';
    approveHeaderBtn.style.cursor = canApprove ? 'pointer' : 'not-allowed';
    approveHeaderBtn.title = canApprove ? 'Phê duyệt dự án' : (role !== 'admin2' ? 'Chỉ admin2 mới có quyền phê duyệt' : 'Dự án chưa sẵn sàng phê duyệt');
}

/**
 * Xử lý khi admin2 bấm nút Phê duyệt
 */
async function approveProject() {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin2') {
        alert('Chỉ admin2 mới có quyền phê duyệt dự án.');
        return;
    }
    if (currentProjectStatus !== 'PHE_DUYET') {
        alert('Dự án chưa sẵn sàng để phê duyệt.');
        return;
    }
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
    
    // Kiểm tra session editor: nếu account mới mở project -> tạo revision cho account cũ
    const user = getCurrentUser();
    const currentUsername = user.username || user.displayName || 'unknown';
    await checkAndCreateRevisionForPreviousEditor(currentUsername);
    
    // Cập nhật nút Phê duyệt sau khi load dữ liệu
    updateApproveButtonVisibility();
}

function showProjectList() {
    document.getElementById('project-list-page').style.display = 'block';
    document.getElementById('project-detail-page').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';
    
    // Ẩn nút Lịch sử phiên bản
    const btnVersionHistory = document.getElementById('btn-version-history');
    if (btnVersionHistory) btnVersionHistory.style.display = 'none';
    
    // Ẩn nút Phê duyệt khi không ở trong dự án
    updateApproveButtonVisibility();
    
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
    // Lưu vị trí scroll hiện tại trước khi reload dữ liệu
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    // Lưu tab đang active
    const activeSection = document.querySelector('.page-section.active');
    const activeSectionId = activeSection ? activeSection.id : null;
    const activeMenuLink = document.querySelector('.side-menu a.active');

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
        if (handleUnauthorized(response)) return;
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
            
            // Load sizing data (dinhCoHeThongContent)
            if (projectData.dinhCoHeThongContent) {
                loadSizingData(projectData.dinhCoHeThongContent);
            }
            
            // Load sizing admin review (dinhCoAdminReview)
            if (projectData.dinhCoAdminReview) {
                try {
                    const adminReview = JSON.parse(projectData.dinhCoAdminReview);
                    loadSizingAdminReview(adminReview);
                } catch (e) {
                    console.error('Error parsing sizing admin review:', e);
                }
            }
            
            console.log('Đã tải dữ liệu từ database thành công!');
        } else if (response.status === 404) {
            console.log('Chưa có ProjectData cho project này');
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
    }

    // Khôi phục tab đang xem
    if (activeSectionId) {
        showSection(activeSectionId, activeMenuLink);
    }
    // Khôi phục vị trí scroll sau khi DOM đã cập nhật
    // Dùng double requestAnimationFrame + setTimeout để đảm bảo DOM đã render xong
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo(scrollX, scrollY);
        });
    });
    // Fallback: setTimeout để xử lý trường hợp DOM render chậm (ảnh, bảng lớn)
    setTimeout(() => {
        window.scrollTo(scrollX, scrollY);
    }, 150);
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
            const adminNote = row.cells[3].querySelector('textarea') || row.cells[3].querySelector('input');
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
            const adminNote = contactRow.cells[3].querySelector('textarea') || contactRow.cells[3].querySelector('input');
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
            
            // Load admin review for each arch row
            if (adminObj.archRowReviews && Array.isArray(adminObj.archRowReviews)) {
                const rows = archBody.querySelectorAll('tr');
                adminObj.archRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const cells = rows[index].querySelectorAll('td');
                        const adminEval = cells[6]?.querySelector('.admin-eval-select');
                        const adminNote = cells[7]?.querySelector('.admin-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) {
                            adminNote.value = review.note || '';
                        }
                    }
                });
            }
        }
        // Load connection info table
        if (data.connectionRows) loadConnectionInfo(data.connectionRows);
        if (data.connectionImages && typeof loadImagesToContainer === 'function') {
            loadImagesToContainer('connection', data.connectionImages);
        }

        // Load connection admin review
        if (adminObj && adminObj.connection) {
            const connEval = document.getElementById('eval-connection');
            const connNote = document.getElementById('note-connection');
            if (connEval) { connEval.value = adminObj.connection.eval || ''; styleAdminSelect(connEval); }
            if (connNote) connNote.value = adminObj.connection.note || '';
        }
        if (adminObj && adminObj.connectionRowReviews && Array.isArray(adminObj.connectionRowReviews)) {
            const connBody = document.getElementById('connection-info-table-body');
            if (connBody) {
                const rows = connBody.querySelectorAll('tr');
                adminObj.connectionRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const cells = rows[index].querySelectorAll('td');
                        const adminEval = cells[6]?.querySelector('.admin-eval-select');
                        const adminNote = cells[7]?.querySelector('.admin-note');
                        if (adminEval) { adminEval.value = review.eval || ''; styleAdminSelect(adminEval); }
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }
        }

        // Ensure role permissions applied after building model section
        try { applyRolePermissions(); } catch (e) {}
    } catch (e) {
        console.error('loadMoHinhHeThong error', e);
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
            note: row.cells[3].querySelector('textarea')?.value || row.cells[3].querySelector('input')?.value || ''
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
        if ((user.role || '').toLowerCase() !== 'admin1' && (user.role || '').toLowerCase() !== 'admin2') {
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
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
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
                    ${pocImages.map(img => `<div class="row-evidence-item"><button type="button" class="btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh">✖</button></div>`).join('')}
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
                    ${sizingImages.map(img => `<div class="row-evidence-item"><button type="button" class="btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh">✖</button></div>`).join('')}
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
        if ((user.role || '').toLowerCase() !== 'admin1' && (user.role || '').toLowerCase() !== 'admin2') {
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
        if ((user.role || '').toLowerCase() !== 'admin1' && (user.role || '').toLowerCase() !== 'admin2') {
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
        } else if (role === 'admin2') {
            await updateProjectStatus('admin2_review');
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
        <td class="admin-cell">
            <select class="admin-eval admin-eval-select" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note" placeholder="Nhận xét..." value="${data.adminNote || ''}">
        </td>
        <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
    `;
    return tr;
}

function collectMoHinhHeThong() {
    // Thu thập bảng Zone mạng (USER DATA ONLY - no admin fields)
    const archRows = [];
    document.querySelectorAll('#arch-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        
        archRows.push({
            nghiepVu: cells[1]?.querySelector('input')?.value || '',
            module: cells[2]?.querySelector('select')?.value || '',
            zoneMang: cells[3]?.querySelector('input')?.value || '',
            heDieuHanh: cells[4]?.querySelector('select')?.value || '',
            soLuongVIP: cells[5]?.querySelector('textarea')?.value || ''
            // NOTE: Admin eval/note NOT saved here - goes to moHinhAdminReview
        });
    });
    
    return {
        physicalImages: collectImagesFromContainer('physical'),
        logicalImages: collectImagesFromContainer('logical'),
        flowImages: collectImagesFromContainer('flow'),
        flowExplanation: document.getElementById('flow-explanation')?.value || '',
        archRows: archRows,
        connectionRows: collectConnectionInfo(),
        connectionImages: collectImagesFromContainer('connection')
        // NOTE: Admin data is NOT included in user content - goes to separate admin review column
    };
}

// Collect admin review data for Mo Hinh He Thong (ADMIN ONLY)
function collectMoHinhAdminReview() {
    // Helper lấy giá trị Admin cho gọn
    const getAdmin = (type) => ({
        eval: document.getElementById(`eval-${type}`)?.value || '',
        note: document.getElementById(`note-${type}`)?.value || ''
    });
    
    // Collect admin review for each arch row
    const archRowReviews = [];
    document.querySelectorAll('#arch-table-body tr').forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        archRowReviews.push({
            rowIndex: index,
            eval: cells[6]?.querySelector('.admin-eval-select')?.value || '',
            note: cells[7]?.querySelector('.admin-note')?.value || ''
        });
    });
    
    // Collect admin review for each connection row
    const connectionRowReviews = [];
    document.querySelectorAll('#connection-info-table-body tr').forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        connectionRowReviews.push({
            rowIndex: index,
            eval: cells[6]?.querySelector('.admin-eval-select')?.value || '',
            note: cells[7]?.querySelector('.admin-note')?.value || ''
        });
    });

    return {
        physical: getAdmin('physical'),
        logical: getAdmin('logical'),
        flow: getAdmin('flow'),
        connection: getAdmin('connection'),
        archRowReviews: archRowReviews,
        connectionRowReviews: connectionRowReviews
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
        } else if (role === 'admin2') {
            await updateProjectStatus('admin2_review');
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
                <img src="${imgData.base64}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px; cursor: zoom-in;" onclick="openModal(this.src)">
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
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
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
        <input type="file" accept="image/*" onchange="previewEvidenceSizingImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
        <div class="preview-area" id="preview-${boxId}"></div>
        <div class="upload-placeholder" onclick="document.getElementById('input-${boxId}').click()">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Click để upload</span>
        </div>
    `;
    container.appendChild(div);
}

function previewEvidenceSizingImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    const placeholder = document.querySelector(`#${boxId} .upload-placeholder`);
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${e.target.result}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteEvidenceSizingSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
                </div>
            `;
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function deleteEvidenceSizingSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.upload-box');
        slot.remove();
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
        div.innerHTML = `<button type="button" class="btn-view-evidence" data-base64="${safeBase64}" onclick="openModalFromElement(this)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh">✖</button>`;
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
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin1' && role !== 'admin2') {
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
            // Use the new collectMoHinhAdminReview function
            reviewObj = collectMoHinhAdminReview();
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
            
            // Tạo revision khi admin đánh giá thành công
            await createRevision(`${user.displayName || user.username || 'Admin'} đánh giá ${label}`);
            
            // Cập nhật trạng thái dự án (admin review)
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
            }
            
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
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Authorization': 'Bearer ' + localStorage.getItem('authToken')
            }
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
    
    // Kiểm tra xem người dùng đã đăng nhập chưa
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const authToken = localStorage.getItem('authToken');
    if (!isLoggedIn || !authToken) {
        // Chưa đăng nhập hoặc không có token, chuyển hướng đến trang đăng nhập
        window.location.href = 'login.html';
        return;
    }
    
    checkAuthStatus();
    applyRolePermissions();

    // Luôn hiển thị danh sách dự án khi load/reload trang
    // Clear currentProjectId để luôn về trang danh sách trước
    clearProjectIds();
    document.getElementById('project-list-page').style.display = 'block';
    document.getElementById('project-detail-page').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';
    
    // Ẩn nút Lịch sử phiên bản khi ở trang danh sách
    const btnVersionHistory = document.getElementById('btn-version-history');
    if (btnVersionHistory) btnVersionHistory.style.display = 'none';
    
    await loadProjectList();

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

    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.onclick = addInputRow;
    const addBaselineBtn = document.getElementById('addBaselineRowBtn');
    if (addBaselineBtn) addBaselineBtn.onclick = addBaselineRow;
    const addArchBtn = document.getElementById('addArchRowBtn');
    if (addArchBtn) addArchBtn.onclick = addArchRow;
    const addSummaryBtn = document.getElementById('addSummaryRowBtn');
    if (addSummaryBtn) addSummaryBtn.onclick = addSummaryRow;
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = exportToWord;
    const addConnectionBtn = document.getElementById('addConnectionRowBtn');
    if (addConnectionBtn) addConnectionBtn.onclick = addConnectionRow;
    
    // Khởi tạo auto-save
    initAutoSave();
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
    const rowId = 'baseline-row-' + Date.now() + '-' + rowCount;

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        
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
    
    // Re-apply role permissions for new row (disable admin fields for user, disable user fields for admin)
    applyRolePermissions();
}

// Handle baseline row image upload - DEPRECATED, now using separate grid
// function handleBaselineImageUpload - removed, use addBaselineEvidenceSlot instead

// Baseline Evidence Grid functions
function addBaselineEvidenceSlot() {
    const grid = document.getElementById('baseline-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleBaselineEvidenceUpload(this)" style="display:none">
        <div class="preview-area"></div>
        <div class="upload-placeholder" onclick="this.parentElement.querySelector('input[type=file]').click()">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Click để upload</span>
        </div>
    `;
    grid.appendChild(slot);
}

function handleBaselineEvidenceUpload(input) {
    const slot = input.closest('.upload-box');
    const previewArea = slot.querySelector('.preview-area');
    const placeholder = slot.querySelector('.upload-placeholder');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${e.target.result}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteBaselineEvidenceSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
                </div>
            `;
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function deleteBaselineEvidenceSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.upload-box');
        slot.remove();
    }
}

function collectBaselineEvidenceData() {
    const grid = document.getElementById('baseline-evidence-grid');
    if (!grid) return [];
    
    const images = [];
    grid.querySelectorAll('.upload-box').forEach(slot => {
        const img = slot.querySelector('.preview-area img');
        if (img && img.src) {
            images.push({ dataUrl: img.src });
        }
    });
    return images;
}

// Open image modal for viewing
function openImageModal(src) {
    // Check if modal exists, if not create it
    let modal = document.getElementById('image-view-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-view-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;';
        modal.innerHTML = `
            <img id="modal-image" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
            <button onclick="closeImageModal()" style="position: absolute; top: 20px; right: 30px; background: none; border: none; color: white; font-size: 40px; cursor: pointer;">&times;</button>
        `;
        modal.onclick = function(e) {
            if (e.target === modal) closeImageModal();
        };
        document.body.appendChild(modal);
    }
    
    document.getElementById('modal-image').src = src;
    modal.style.display = 'flex';
}

function closeImageModal() {
    const modal = document.getElementById('image-view-modal');
    if (modal) modal.style.display = 'none';
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

// ==================== MODULE COLLAPSIBLE FUNCTIONS ====================

// Toggle collapsible module section
function toggleModuleCollapsible(contentId) {
    const content = document.getElementById(contentId);
    const header = content.previousElementSibling;
    const icon = header.querySelector('.module-toggle-icon');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        header.classList.remove('active');
    } else {
        content.classList.add('expanded');
        header.classList.add('active');
    }
}

// Collect all baseline/sizing data (USER DATA ONLY - no admin fields)
function collectBaselineTableData() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    const data = [];
    
    rows.forEach((row, index) => {
        // Collect user data
        data.push({
            stt: index + 1,
            ip: row.querySelector('.ip-input')?.value || '',
            cpu: row.querySelector('.cpu-input')?.value || '',
            ram: row.querySelector('.ram-input')?.value || '',
            disk: row.querySelector('.disk-input')?.value || '',
            cintRate: row.querySelector('.cint-input')?.value || ''
        });
    });
    
    return data;
}

// Collect admin review data for baseline table rows (ADMIN ONLY)
function collectBaselineAdminReviewData() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    const data = [];
    
    rows.forEach((row, index) => {
        const adminEval = row.querySelector('.admin-eval-select');
        const adminNoteInput = row.querySelector('.admin-note');
        
        data.push({
            rowIndex: index,
            eval: adminEval?.value || '',
            note: adminNoteInput?.value || ''
        });
    });
    
    return data;
}

// Collect input config table data
function collectInputConfigTableData() {
    const rows = document.querySelectorAll('#input-config-table-body tr');
    const data = [];
    
    rows.forEach((row, index) => {
        data.push({
            stt: index + 1,
            ip: row.querySelector('.ip-config-input')?.value || '',
            cpuLoad: row.querySelector('.cpu-load-input')?.value || '',
            ramLoad: row.querySelector('.ram-load-input')?.value || '',
            diskLoad: row.querySelector('.disk-load-input')?.value || '',
            cintUsed: row.querySelector('.cint-used-input')?.value || '',
            ramUsed: row.querySelector('.ram-used-input')?.value || '',
            diskUsed: row.querySelector('.disk-used-input')?.value || '',
            adminEval: row.querySelector('.input-config-eval')?.value || '',
            adminNote: row.querySelector('.input-config-note')?.value || ''
        });
    });
    
    return data;
}

// Collect evidence images from sizing section
function collectEvidenceSizingData() {
    const grid = document.getElementById('evidence-sizing-grid');
    if (!grid) return [];
    
    const images = [];
    // Try the upload-box structure first (from addEvidenceSizingSlot)
    grid.querySelectorAll('.upload-box').forEach((box, index) => {
        const img = box.querySelector('.preview-area img');
        if (img && img.src && !img.src.includes('placeholder') && !img.src.endsWith('#')) {
            images.push({
                index: index,
                dataUrl: img.src
            });
        }
    });
    
    // Also try image-upload-item structure (alternate structure)
    if (images.length === 0) {
        grid.querySelectorAll('.image-upload-item').forEach((item, index) => {
            const img = item.querySelector('.image-preview');
            if (img && img.src && img.style.display !== 'none' && !img.src.includes('placeholder') && !img.src.endsWith('#')) {
                images.push({
                    index: index,
                    dataUrl: img.src
                });
            }
        });
    }
    
    return images;
}

// Collect all sizing data for saving (USER DATA ONLY)
function collectAllSizingData() {
    return {
        moduleApp: {
            baselineTable: collectBaselineTableData(),
            baselineEvidence: collectBaselineEvidenceData(),
            inputConfigTable: collectInputConfigTableData(),
            evidenceImages: collectEvidenceSizingData(),
            pocValue: document.getElementById('poc-value')?.value || '',
            sizingValue: document.getElementById('sizing-value')?.value || '',
            sizingResult: (() => {
                // Sync textarea values into DOM trước khi lấy innerHTML
                // (textarea.value không tự phản ánh vào innerHTML)
                const container = document.getElementById('sizing-result-container');
                if (container) {
                    container.querySelectorAll('textarea').forEach(ta => {
                        ta.textContent = ta.value;
                    });
                    return container.innerHTML;
                }
                return '';
            })()
            // NOTE: Admin review is NOT saved here - it goes to dinhCoAdminReview
        },
        moduleMariaDB: collectMariaDBData(),
        moduleRedis: collectRedisData(),
        moduleKafka: collectKafkaData()
    };
}

// Collect admin review data for MariaDB ref table rows
function collectMariaDBRefAdminReviewData() {
    const rows = document.querySelectorAll('#mariadb-ref-table-body tr');
    const data = [];
    rows.forEach((row, index) => {
        data.push({
            rowIndex: index,
            eval: row.querySelector('.mariadb-ref-eval')?.value || '',
            note: row.querySelector('.mariadb-ref-note')?.value || ''
        });
    });
    return data;
}

// Collect all admin review data for sizing section (ADMIN ONLY)
function collectSizingAdminReviewData() {
    return {
        moduleApp: {
            // Admin review for the whole Module App section
            overallReview: {
                eval: document.getElementById('eval-module-app')?.value || '',
                note: document.getElementById('note-module-app')?.value || ''
            },
            // Admin review for each row in baseline table
            baselineRowReviews: collectBaselineAdminReviewData(),
            // Admin review for each row in input config table
            inputConfigRowReviews: (() => {
                const reviews = [];
                document.querySelectorAll('#input-config-table-body tr').forEach(row => {
                    reviews.push({
                        eval: row.querySelector('.input-config-eval')?.value || '',
                        note: row.querySelector('.input-config-note')?.value || ''
                    });
                });
                return reviews;
            })()
        },
        moduleMariaDB: {
            overallReview: {
                eval: document.getElementById('eval-module-mariadb')?.value || '',
                note: document.getElementById('note-module-mariadb')?.value || ''
            },
            refRowReviews: collectMariaDBRefAdminReviewData(),
            storageReview: {
                eval: document.getElementById('eval-mariadb-storage')?.value || '',
                note: document.getElementById('note-mariadb-storage')?.value || ''
            }
        },
        moduleRedis: {
            overallReview: {
                eval: document.getElementById('eval-module-redis')?.value || '',
                note: document.getElementById('note-module-redis')?.value || ''
            },
            configRowReviews: (() => {
                const reviews = [];
                document.querySelectorAll('#redis-config-table-body tr').forEach(row => {
                    reviews.push({
                        eval: row.querySelector('.redis-config-eval')?.value || '',
                        note: row.querySelector('.redis-config-note')?.value || ''
                    });
                });
                return reviews;
            })()
        },
        moduleKafka: {
            overallReview: {
                eval: document.getElementById('eval-module-kafka')?.value || '',
                note: document.getElementById('note-module-kafka')?.value || ''
            },
            linearRowReviews: (() => {
                const reviews = [];
                document.querySelectorAll('#kafka-linear-table-body tr').forEach(row => {
                    reviews.push({
                        eval: row.querySelector('.kafka-linear-eval')?.value || '',
                        note: row.querySelector('.kafka-linear-note')?.value || ''
                    });
                });
                return reviews;
            })()
        },
        // POC/Sizing admin evaluation
        pocSizing: {
            eval: document.getElementById('eval-poc-sizing')?.value || '',
            note: document.getElementById('note-poc-sizing')?.value || ''
        }
    };
}

// Save all sizing data to database
async function saveSizingData() {
    if (!currentProjectId) {
        alert('Vui lòng tạo hoặc chọn dự án trước!');
        return;
    }

    const user = getCurrentUser();
    if (user.role?.toLowerCase() === 'admin1' || user.role?.toLowerCase() === 'admin2') {
        alert('Admin không được phép lưu dữ liệu người dùng. Chỉ được phép đánh giá!');
        return;
    }

    try {
        const sizingData = collectAllSizingData();
        
        const headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        const response = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ dinhCoHeThongContent: JSON.stringify(sizingData) })
        });

        if (handleUnauthorized(response)) return;

        if (response.ok) {
            // Tạo revision sau khi lưu thành công
            await createRevision(`${user.displayName || user.username || 'User'} cập nhật Định cỡ hệ thống`);
            alert('✓ Đã lưu dữ liệu Định cỡ hệ thống thành công!');
        } else {
            const errorText = await response.text();
            throw new Error(errorText || 'Lỗi server');
        }
    } catch (error) {
        console.error('Error saving sizing data:', error);
        alert('Lỗi khi lưu dữ liệu: ' + error.message);
    }
}

// Evaluate sizing section (Admin only)
async function evaluateSizingSection() {
    if (!currentProjectId) {
        alert('Vui lòng chọn dự án trước!');
        return;
    }

    const user = getCurrentUser();
    if (user.role?.toLowerCase() !== 'admin1' && user.role?.toLowerCase() !== 'admin2') {
        alert('Chỉ Admin mới được phép đánh giá!');
        return;
    }

    // Check at least one module has evaluation
    const evalModuleApp = document.getElementById('eval-module-app')?.value;
    const evalModuleMariaDB = document.getElementById('eval-module-mariadb')?.value;
    const evalModuleRedis = document.getElementById('eval-module-redis')?.value;
    const evalModuleKafka = document.getElementById('eval-module-kafka')?.value;
    
    if (!evalModuleApp && !evalModuleMariaDB && !evalModuleRedis && !evalModuleKafka) {
        alert('Vui lòng chọn đánh giá (OK/NOK) cho ít nhất một module!');
        return;
    }

    try {
        // Collect all admin review data using the new function
        const adminData = collectSizingAdminReviewData();

        const headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        const response = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
                section: 'sizing',
                reviewJson: JSON.stringify(adminData)
            })
        });

        if (handleUnauthorized(response)) return;

        if (response.ok) {
            // Tạo revision khi admin đánh giá thành công
            await createRevision(`${user.displayName || user.username || 'Admin'} đánh giá Định cỡ hệ thống`);
            
            // Cập nhật trạng thái dự án (admin review)
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
            }
            
            alert('✓ Đã lưu đánh giá Định cỡ hệ thống thành công!');
            // reload data to reflect saved admin review
            await loadAllDataFromDB();
        } else {
            const errorText = await response.text();
            throw new Error(errorText || 'Lỗi server');
        }
    } catch (error) {
        console.error('Error evaluating sizing:', error);
        alert('Lỗi khi lưu đánh giá: ' + error.message);
    }
}

// Load sizing data from database
function loadSizingData(data) {
    if (!data) return;
    
    try {
        const sizingData = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Load Module App data
        if (sizingData.moduleApp) {
            const moduleApp = sizingData.moduleApp;
            
            // Load baseline table data
            if (moduleApp.baselineTable && Array.isArray(moduleApp.baselineTable) && moduleApp.baselineTable.length > 0) {
                const tbody = document.getElementById('baseline-table-body');
                if (tbody) {
                    tbody.innerHTML = ''; // Clear existing rows
                    // Also clear input-config-table-body since addBaselineRow adds rows there
                    const inputConfigTbody = document.getElementById('input-config-table-body');
                    if (inputConfigTbody) inputConfigTbody.innerHTML = '';
                    
                    moduleApp.baselineTable.forEach((row, idx) => {
                        addBaselineRow(); // Add a new row
                        const lastRow = tbody.lastElementChild;
                        if (lastRow) {
                            // Use specific class selectors
                            const ipInput = lastRow.querySelector('.ip-input');
                            const cpuInput = lastRow.querySelector('.cpu-input');
                            const ramInput = lastRow.querySelector('.ram-input');
                            const diskInput = lastRow.querySelector('.disk-input');
                            const cintInput = lastRow.querySelector('.cint-input');
                            
                            if (ipInput) ipInput.value = row.ip || '';
                            if (cpuInput) cpuInput.value = row.cpu || '';
                            if (ramInput) ramInput.value = row.ram || '';
                            if (diskInput) diskInput.value = row.disk || '';
                            if (cintInput) cintInput.value = row.cintRate || '';
                        }
                    });
                    updateBaselineTotal();
                }
            }
            
            // Load baseline evidence images
            if (moduleApp.baselineEvidence && Array.isArray(moduleApp.baselineEvidence) && moduleApp.baselineEvidence.length > 0) {
                const grid = document.getElementById('baseline-evidence-grid');
                if (grid) {
                    grid.innerHTML = ''; // Clear existing
                    moduleApp.baselineEvidence.forEach(img => {
                        addBaselineEvidenceSlot();
                        const lastSlot = grid.lastElementChild;
                        if (lastSlot && img.dataUrl) {
                            const previewArea = lastSlot.querySelector('.preview-area');
                            const placeholder = lastSlot.querySelector('.upload-placeholder');
                            if (previewArea) {
                                previewArea.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                                        <img src="${img.dataUrl}" alt="Evidence" style="display:none;">
                                        <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                        <button type="button" class="btn-remove-evidence" onclick="deleteBaselineEvidenceSlot(this)" title="Xóa ảnh">
                                            ✖
                                        </button>
                                    </div>
                                `;
                            }
                            if (placeholder) placeholder.style.display = 'none';
                        }
                    });
                }
            }
            
            // Load input config table data
            if (moduleApp.inputConfigTable && Array.isArray(moduleApp.inputConfigTable) && moduleApp.inputConfigTable.length > 0) {
                const tbody = document.getElementById('input-config-table-body');
                if (tbody) {
                    tbody.innerHTML = ''; // Clear existing rows
                    moduleApp.inputConfigTable.forEach((row, idx) => {
                        addInputConfigRow(); // Add a new row
                        const lastRow = tbody.lastElementChild;
                        if (lastRow) {
                            const ipInput = lastRow.querySelector('.ip-config-input');
                            const cpuLoadInput = lastRow.querySelector('.cpu-load-input');
                            const ramLoadInput = lastRow.querySelector('.ram-load-input');
                            const diskLoadInput = lastRow.querySelector('.disk-load-input');
                            const cintUsedInput = lastRow.querySelector('.cint-used-input');
                            const ramUsedInput = lastRow.querySelector('.ram-used-input');
                            const diskUsedInput = lastRow.querySelector('.disk-used-input');
                            if (ipInput) ipInput.value = row.ip || '';
                            if (cpuLoadInput) cpuLoadInput.value = row.cpuLoad || '';
                            if (ramLoadInput) ramLoadInput.value = row.ramLoad || '';
                            if (diskLoadInput) diskLoadInput.value = row.diskLoad || '';
                            if (cintUsedInput) cintUsedInput.value = row.cintUsed || '';
                            if (ramUsedInput) ramUsedInput.value = row.ramUsed || '';
                            if (diskUsedInput) diskUsedInput.value = row.diskUsed || '';
                            // Admin eval/note
                            const evalSelect = lastRow.querySelector('.input-config-eval');
                            const noteInput = lastRow.querySelector('.input-config-note');
                            if (evalSelect && row.adminEval) { evalSelect.value = row.adminEval; styleAdminSelect(evalSelect); }
                            if (noteInput && row.adminNote) noteInput.value = row.adminNote;
                        }
                    });
                    updateInputConfigTotal();
                }
            }
            
            // Load evidence images
            if (moduleApp.evidenceImages && Array.isArray(moduleApp.evidenceImages) && moduleApp.evidenceImages.length > 0) {
                const grid = document.getElementById('evidence-sizing-grid');
                if (grid) {
                    grid.innerHTML = ''; // Clear existing
                    moduleApp.evidenceImages.forEach(img => {
                        addEvidenceSizingSlot();
                        const lastSlot = grid.lastElementChild;
                        if (lastSlot && img.dataUrl) {
                            const previewArea = lastSlot.querySelector('.preview-area');
                            const placeholder = lastSlot.querySelector('.upload-placeholder');
                            if (previewArea) {
                                previewArea.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                                        <img src="${img.dataUrl}" alt="Evidence" style="display:none;">
                                        <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                        <button type="button" class="btn-remove-evidence" onclick="deleteEvidenceSizingSlot(this)" title="Xóa ảnh">
                                            ✖
                                        </button>
                                    </div>
                                `;
                            }
                            if (placeholder) placeholder.style.display = 'none';
                        }
                    });
                }
            }
            
            // Load POC and Sizing values
            if (moduleApp.pocValue && document.getElementById('poc-value')) {
                document.getElementById('poc-value').value = moduleApp.pocValue;
            }
            if (moduleApp.sizingValue && document.getElementById('sizing-value')) {
                document.getElementById('sizing-value').value = moduleApp.sizingValue;
            }
            
            // Load sizing result
            if (moduleApp.sizingResult && document.getElementById('sizing-result-container')) {
                document.getElementById('sizing-result-container').innerHTML = moduleApp.sizingResult;
            }
            
            // Auto expand the module if has data
            if (moduleApp.pocValue || moduleApp.sizingValue || moduleApp.sizingResult || 
                (moduleApp.baselineTable && moduleApp.baselineTable.length > 0)) {
                const content = document.getElementById('module-app-content');
                const header = content?.previousElementSibling;
                if (content && !content.classList.contains('expanded')) {
                    content.classList.add('expanded');
                    if (header) header.classList.add('active');
                }
            }
        }
        
        // Load Module MariaDB data
        if (sizingData.moduleMariaDB) {
            loadMariaDBData(sizingData.moduleMariaDB);
            
            // Auto expand if has data
            const mariadb = sizingData.moduleMariaDB;
            if ((mariadb.refTable && mariadb.refTable.length > 0) || 
                (mariadb.storageTable && mariadb.storageTable.length > 0) ||
                mariadb.inputCCU || mariadb.sizingCCU) {
                const content = document.getElementById('module-mariadb-content');
                const header = content?.previousElementSibling;
                if (content && !content.classList.contains('expanded')) {
                    content.classList.add('expanded');
                    if (header) header.classList.add('active');
                }
            }
        }
        
        // Load Module Redis data
        if (sizingData.moduleRedis) {
            loadRedisData(sizingData.moduleRedis);
            
            // Auto expand if has data
            const redis = sizingData.moduleRedis;
            if ((redis.keyMethod && (redis.keyMethod.keyCount || redis.keyMethod.recordSize)) ||
                (redis.configMethod && redis.configMethod.configTable && redis.configMethod.configTable.length > 0)) {
                const content = document.getElementById('module-redis-content');
                const header = content?.previousElementSibling;
                if (content && !content.classList.contains('expanded')) {
                    content.classList.add('expanded');
                    if (header) header.classList.add('active');
                }
            }
        }
        
        // Load Module Kafka data
        if (sizingData.moduleKafka) {
            loadKafkaData(sizingData.moduleKafka);
            
            // Auto expand if has data
            const kafka = sizingData.moduleKafka;
            const hasThroughputData = kafka.throughputMethod && (kafka.throughputMethod.throughputA || kafka.throughputMethod.retentionT);
            const hasLinearData = kafka.linearMethod && kafka.linearMethod.linearTable && kafka.linearMethod.linearTable.length > 0;
            
            if (hasThroughputData || hasLinearData) {
                const content = document.getElementById('module-kafka-content');
                const header = content?.previousElementSibling;
                if (content && !content.classList.contains('expanded')) {
                    content.classList.add('expanded');
                    if (header) header.classList.add('active');
                }
            }
        }
        
        // Re-apply role permissions after loading data (disable admin fields for user, etc.)
        applyRolePermissions();
        
        console.log('Loaded sizing data successfully');
    } catch (e) {
        console.error('Error loading sizing data:', e);
    }
}

// Load sizing admin review from separate column
function loadSizingAdminReview(adminReview) {
    if (!adminReview) return;
    
    try {
        // Load module app admin review
        if (adminReview.moduleApp) {
            // Load overall review
            if (adminReview.moduleApp.overallReview) {
                const moduleAppReview = adminReview.moduleApp.overallReview;
                if (document.getElementById('eval-module-app')) {
                    document.getElementById('eval-module-app').value = moduleAppReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-app'));
                }
                if (document.getElementById('note-module-app')) {
                    document.getElementById('note-module-app').value = moduleAppReview.note || '';
                }
            }
            
            // Load baseline row reviews
            if (adminReview.moduleApp.baselineRowReviews) {
                const rows = document.querySelectorAll('#baseline-table-body tr');
                adminReview.moduleApp.baselineRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.admin-eval-select');
                        const adminNote = rows[index].querySelector('.admin-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) {
                            adminNote.value = review.note || '';
                        }
                    }
                });
            }
            
            // Load input config row reviews
            if (adminReview.moduleApp.inputConfigRowReviews) {
                const rows = document.querySelectorAll('#input-config-table-body tr');
                adminReview.moduleApp.inputConfigRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.input-config-eval');
                        const adminNote = rows[index].querySelector('.input-config-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) {
                            adminNote.value = review.note || '';
                        }
                    }
                });
            }
        }
        
        // Load module MariaDB admin review
        if (adminReview.moduleMariaDB) {
            if (adminReview.moduleMariaDB.overallReview) {
                const mariadbReview = adminReview.moduleMariaDB.overallReview;
                if (document.getElementById('eval-module-mariadb')) {
                    document.getElementById('eval-module-mariadb').value = mariadbReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-mariadb'));
                }
                if (document.getElementById('note-module-mariadb')) {
                    document.getElementById('note-module-mariadb').value = mariadbReview.note || '';
                }
            }
            
            // Load ref table row reviews
            if (adminReview.moduleMariaDB.refRowReviews) {
                const rows = document.querySelectorAll('#mariadb-ref-table-body tr');
                adminReview.moduleMariaDB.refRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.mariadb-ref-eval');
                        const adminNote = rows[index].querySelector('.mariadb-ref-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) {
                            adminNote.value = review.note || '';
                        }
                    }
                });
            }
            
            // Load storage review
            if (adminReview.moduleMariaDB.storageReview) {
                const storageReview = adminReview.moduleMariaDB.storageReview;
                if (document.getElementById('eval-mariadb-storage')) {
                    document.getElementById('eval-mariadb-storage').value = storageReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-mariadb-storage'));
                }
                if (document.getElementById('note-mariadb-storage')) {
                    document.getElementById('note-mariadb-storage').value = storageReview.note || '';
                }
            }
        }
        
        // Load module Redis admin review
        if (adminReview.moduleRedis) {
            if (adminReview.moduleRedis.overallReview) {
                const redisReview = adminReview.moduleRedis.overallReview;
                if (document.getElementById('eval-module-redis')) {
                    document.getElementById('eval-module-redis').value = redisReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-redis'));
                }
                if (document.getElementById('note-module-redis')) {
                    document.getElementById('note-module-redis').value = redisReview.note || '';
                }
            }
            
            // Load Redis config row reviews
            if (adminReview.moduleRedis.configRowReviews) {
                const rows = document.querySelectorAll('#redis-config-table-body tr');
                adminReview.moduleRedis.configRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.redis-config-eval');
                        const adminNote = rows[index].querySelector('.redis-config-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) {
                            adminNote.value = review.note || '';
                        }
                    }
                });
            }
        }
        
        // Load module Kafka admin review
        if (adminReview.moduleKafka) {
            if (adminReview.moduleKafka.overallReview) {
                const kafkaReview = adminReview.moduleKafka.overallReview;
                if (document.getElementById('eval-module-kafka')) {
                    document.getElementById('eval-module-kafka').value = kafkaReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-kafka'));
                }
                if (document.getElementById('note-module-kafka')) {
                    document.getElementById('note-module-kafka').value = kafkaReview.note || '';
                }
            }
            
            // Load Kafka linear row reviews
            if (adminReview.moduleKafka.linearRowReviews) {
                const rows = document.querySelectorAll('#kafka-linear-table-body tr');
                adminReview.moduleKafka.linearRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.kafka-linear-eval');
                        const adminNote = rows[index].querySelector('.kafka-linear-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) {
                            adminNote.value = review.note || '';
                        }
                    }
                });
            }
        }
        
        // Load POC/Sizing admin evaluation
        if (adminReview.pocSizing) {
            const pocEval = document.getElementById('eval-poc-sizing');
            const pocNote = document.getElementById('note-poc-sizing');
            if (pocEval) { pocEval.value = adminReview.pocSizing.eval || ''; styleAdminSelect(pocEval); }
            if (pocNote) pocNote.value = adminReview.pocSizing.note || '';
        }

        // Re-apply role permissions after loading admin review
        applyRolePermissions();
        
        console.log('Loaded sizing admin review successfully');
    } catch (e) {
        console.error('Error loading sizing admin review:', e);
    }
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

        <td class="admin-cell">
            <select class="admin-eval-select input-config-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note input-config-note" placeholder="Nhận xét...">
        </td>
        
        <td class="text-center">
            <button class="btn-delete-row-item" onclick="deleteInputConfigRow(this)">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    applyRolePermissions();
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
                        <td>Cintrate cần cho hệ thống</td>
                        <td class="text-center">${cintForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" placeholder="Ghi chú..." style="resize:vertical;min-height:30px;"></textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>RAM (GB) cần cho hệ thống</td>
                        <td class="text-center">${ramForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" placeholder="Ghi chú..." style="resize:vertical;min-height:30px;"></textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">3</td>
                        <td>Disk (GB) cần cho hệ thống</td>
                        <td class="text-center">${diskForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" placeholder="Ghi chú..." style="resize:vertical;min-height:30px;"></textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">4</td>
                        <td>Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">KPI 75%. Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">5</td>
                        <td>RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">KPI 90%. Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">6</td>
                        <td>Disk cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${diskAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">KPI 80%. Sai số 1.1</textarea></td>
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
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">Dự phòng N+1</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    const container = document.getElementById('sizing-result-container');
    if (container) container.innerHTML = html;
}

// ==================== MODULE MARIADB FUNCTIONS ====================

// Thêm dòng vào bảng thông tin CPU/RAM MariaDB
function addMariaDBRefRow(data = {}) {
    const tbody = document.getElementById('mariadb-ref-table-body');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input mariadb-ip" value="${data.ip || ''}" placeholder="192.168.x.x"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-cpu" value="${data.cpu || ''}" placeholder="CPU" min="0"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-ram" value="${data.ram || ''}" placeholder="RAM" min="0"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-cpu-load" value="${data.cpuLoad || ''}" placeholder="%" min="0" max="100"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" max="100"></td>
        <td class="text-center">
            <input type="radio" name="mariadb-master" class="mariadb-master-radio" ${data.isMaster ? 'checked' : ''}>
        </td>
        <td class="admin-cell">
            <select class="admin-eval-select mariadb-ref-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note mariadb-ref-note" placeholder="Nhận xét..." value="${data.adminNote || ''}">
        </td>
        <td class="text-center">
            <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('tr').remove()">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    
    // Apply role permissions for new row
    applyRolePermissions();
}

// Thêm dòng vào bảng Storage MariaDB (DEPRECATED - storage is now fixed inputs)
// function addMariaDBStorageRow is no longer used

// Thu thập dữ liệu bảng tham chiếu MariaDB (user data only)
function collectMariaDBRefTableData() {
    const rows = document.querySelectorAll('#mariadb-ref-table-body tr');
    const data = [];
    rows.forEach(row => {
        data.push({
            ip: row.querySelector('.mariadb-ip')?.value || '',
            cpu: row.querySelector('.mariadb-cpu')?.value || '',
            ram: row.querySelector('.mariadb-ram')?.value || '',
            cpuLoad: row.querySelector('.mariadb-cpu-load')?.value || '',
            ramLoad: row.querySelector('.mariadb-ram-load')?.value || '',
            isMaster: row.querySelector('.mariadb-master-radio')?.checked || false
        });
    });
    return data;
}

// Thu thập dữ liệu storage MariaDB (now fixed inputs)
function collectMariaDBStorageData() {
    return {
        data: document.getElementById('mariadb-storage-data')?.value || '',
        log: document.getElementById('mariadb-storage-log')?.value || '',
        backup: document.getElementById('mariadb-storage-backup')?.value || ''
    };
}

// Lấy dữ liệu Master row
function getMariaDBMasterData() {
    const rows = document.querySelectorAll('#mariadb-ref-table-body tr');
    for (const row of rows) {
        const radio = row.querySelector('.mariadb-master-radio');
        if (radio && radio.checked) {
            return {
                ip: row.querySelector('.mariadb-ip')?.value || '',
                cpu: parseFloat(row.querySelector('.mariadb-cpu')?.value) || 0,
                ram: parseFloat(row.querySelector('.mariadb-ram')?.value) || 0,
                cpuLoad: parseFloat(row.querySelector('.mariadb-cpu-load')?.value) || 0,
                ramLoad: parseFloat(row.querySelector('.mariadb-ram-load')?.value) || 0
            };
        }
    }
    return null;
}

// Lấy storage (now fixed inputs, not per IP)
function getMariaDBStorage() {
    return {
        data: parseFloat(document.getElementById('mariadb-storage-data')?.value) || 0,
        log: parseFloat(document.getElementById('mariadb-storage-log')?.value) || 0,
        backup: parseFloat(document.getElementById('mariadb-storage-backup')?.value) || 0
    };
}

// Tính toán sizing MariaDB
function calculateMariaDBSizing() {
    const inputCCU = parseFloat(document.getElementById('mariadb-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('mariadb-sizing-ccu')?.value) || 0;
    
    if (!inputCCU || !sizingCCU) {
        alert('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".');
        return;
    }
    
    const masterData = getMariaDBMasterData();
    if (!masterData) {
        alert('Vui lòng chọn một IP làm Master trong bảng thông tin hệ thống tham chiếu.');
        return;
    }
    
    const storage = getMariaDBStorage();
    if (!storage.data && !storage.log && !storage.backup) {
        alert('Vui lòng nhập thông tin storage (/data, /log, /backup).');
        return;
    }
    
    // Hệ số
    const factor = sizingCCU / inputCCU;
    
    // Công thức tính theo ảnh:
    // CPU cần = CPU * Tải CPU * (Định cỡ / Đầu vào) * 1.1 / 0.75
    // RAM cần = RAM * Tải RAM * (Định cỡ / Đầu vào) * 1.1 / 0.9
    // /data cần = /data * (Định cỡ / Đầu vào) * 1.1 / 0.8
    // /log cần = /log * (Định cỡ / Đầu vào) * 1.1 / 0.8
    // /backup cần = /backup * (Định cỡ / Đầu vào) * 1.1 / 0.8
    
    const cpuNeeded = masterData.cpu * (masterData.cpuLoad / 100) * factor * 1.1 / 0.75;
    const ramNeeded = masterData.ram * (masterData.ramLoad / 100) * factor * 1.1 / 0.9;
    const dataNeeded = storage.data * factor * 1.1 / 0.8;
    const logNeeded = storage.log * factor * 1.1 / 0.8;
    const backupNeeded = storage.backup * factor * 1.1 / 0.8;
    
    // Tổng NAS = /data + /log + /backup
    const nasTotal = dataNeeded + logNeeded + backupNeeded;
    
    let html = '';
    
    // ==================== CÔNG THỨC TÍNH ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Công thức tính toán (dựa trên IP Master: ${masterData.ip})</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>CPU cần</strong> = CPU × Tải CPU × (Định cỡ / Đầu vào) × 1.1 / 0.75 = ${masterData.cpu} × ${(masterData.cpuLoad/100).toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.75 = <strong>${cpuNeeded.toFixed(2)} vCPU</strong></li>
            <li><strong>RAM cần</strong> = RAM × Tải RAM × (Định cỡ / Đầu vào) × 1.1 / 0.9 = ${masterData.ram} × ${(masterData.ramLoad/100).toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9 = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/data cần</strong> = /data × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.data} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${dataNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/log cần</strong> = /log × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.log} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${logNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/backup cần</strong> = /backup × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.backup} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${backupNeeded.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // ==================== BẢNG KẾT QUẢ ====================
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 120px;">Thành phần</th>
                <th style="width: 250px;">Cấu hình đề xuất</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #f0f9ff;">
                <td><strong>MaxScale</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
                        <li>4 vCPU</li>
                        <li>8 GB RAM</li>
                        <li>/u01: 100 GB</li>
                    </ul>
                </td>
                <td class="text-center"><strong>2</strong></td>
                <td>Cấu hình tối thiểu<br>+1 VIP</td>
            </tr>
            <tr style="background: #e6ffed;">
                <td><strong>MariaDB</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
                        <li><strong>${Math.ceil(cpuNeeded)} vCPU</strong></li>
                        <li><strong>${Math.ceil(ramNeeded)} GB RAM</strong></li>
                        <li>/data: ${Math.ceil(dataNeeded)} GB</li>
                        <li>/log: ${Math.ceil(logNeeded)} GB</li>
                    </ul>
                </td>
                <td class="text-center"><strong>3</strong></td>
                <td>(Giá trị MariaDB lấy giá trị tính được ở trên)</td>
            </tr>
            <tr style="background: #fff9e6;">
                <td><strong>NAS</strong></td>
                <td class="text-center"><strong>${Math.ceil(nasTotal)} GB</strong></td>
                <td class="text-center">-</td>
                <td>Mount chung<br>(/data + /log + /backup)</td>
            </tr>
        </tbody>
    </table>`;
    
    const container = document.getElementById('mariadb-result-container');
    if (container) container.innerHTML = html;
}

// Load dữ liệu MariaDB từ DB
function loadMariaDBData(data) {
    if (!data) return;
    
    // Clear existing rows
    document.getElementById('mariadb-ref-table-body').innerHTML = '';
    
    // Load bảng ref
    if (data.refTable && Array.isArray(data.refTable)) {
        data.refTable.forEach(row => addMariaDBRefRow(row));
    }
    
    // Load storage (now fixed inputs)
    if (data.storage) {
        const dataEl = document.getElementById('mariadb-storage-data');
        const logEl = document.getElementById('mariadb-storage-log');
        const backupEl = document.getElementById('mariadb-storage-backup');
        if (dataEl) dataEl.value = data.storage.data || '';
        if (logEl) logEl.value = data.storage.log || '';
        if (backupEl) backupEl.value = data.storage.backup || '';
    }
    // Backward compatibility for old data format
    else if (data.storageTable && Array.isArray(data.storageTable) && data.storageTable.length > 0) {
        const firstRow = data.storageTable[0];
        const dataEl = document.getElementById('mariadb-storage-data');
        const logEl = document.getElementById('mariadb-storage-log');
        const backupEl = document.getElementById('mariadb-storage-backup');
        if (dataEl) dataEl.value = firstRow.data || '';
        if (logEl) logEl.value = firstRow.log || '';
        if (backupEl) backupEl.value = firstRow.backup || '';
    }
    
    // Load note
    const noteEl = document.getElementById('mariadb-note');
    if (noteEl && data.note) noteEl.value = data.note;
    
    // Load input values
    const inputCCU = document.getElementById('mariadb-input-ccu');
    const sizingCCU = document.getElementById('mariadb-sizing-ccu');
    if (inputCCU && data.inputCCU) inputCCU.value = data.inputCCU;
    if (sizingCCU && data.sizingCCU) sizingCCU.value = data.sizingCCU;
    
    // Load result if exists
    if (data.resultHTML) {
        const container = document.getElementById('mariadb-result-container');
        if (container) container.innerHTML = data.resultHTML;
    }
    
    // Load evidence images
    if (data.evidence && Array.isArray(data.evidence)) {
        const grid = document.getElementById('mariadb-evidence-grid');
        if (grid) {
            grid.innerHTML = '';
            data.evidence.forEach(img => {
                const slot = document.createElement('div');
                slot.className = 'upload-box';
                slot.innerHTML = `
                    <input type="file" accept="image/*" onchange="handleMariaDBEvidenceUpload(this)" style="display:none;">
                    <div class="preview-area">
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                            <img src="${img.dataUrl}" alt="Evidence" style="display:none;">
                            <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBEvidenceSlot(this)" title="Xóa ảnh">
                                ✖
                            </button>
                        </div>
                    </div>
                    <div class="upload-placeholder" style="display: none;">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span>Click để upload</span>
                    </div>
                `;
                grid.appendChild(slot);
            });
        }
    }
    
    // Load reference evidence images
    loadMariaDBRefEvidence(data);
    
    // Apply role permissions
    applyRolePermissions();
}

// Load ảnh sở cứ bảng tham chiếu MariaDB
function loadMariaDBRefEvidence(data) {
    if (!data || !data.refEvidence || !Array.isArray(data.refEvidence)) return;
    
    const grid = document.getElementById('mariadb-ref-evidence-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    data.refEvidence.forEach(img => {
        const slot = document.createElement('div');
        slot.className = 'upload-box';
        slot.innerHTML = `
            <input type="file" accept="image/*" onchange="handleMariaDBRefEvidenceUpload(this)" style="display:none;">
            <div class="preview-area">
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${img.dataUrl}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBRefEvidenceSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
                </div>
            </div>
            <div class="upload-placeholder" style="display: none;">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Click để upload</span>
            </div>
        `;
        grid.appendChild(slot);
    });
}

// Thu thập dữ liệu MariaDB để lưu (user data only)
function collectMariaDBData() {
    return {
        refTable: collectMariaDBRefTableData(),
        storage: collectMariaDBStorageData(),
        evidence: collectMariaDBEvidenceData(),
        refEvidence: collectMariaDBRefEvidenceData(),
        note: document.getElementById('mariadb-note')?.value || '',
        inputCCU: document.getElementById('mariadb-input-ccu')?.value || '',
        sizingCCU: document.getElementById('mariadb-sizing-ccu')?.value || '',
        resultHTML: document.getElementById('mariadb-result-container')?.innerHTML || ''
    };
}

// Thêm slot ảnh sở cứ cho MariaDB
function addMariaDBEvidenceSlot() {
    const grid = document.getElementById('mariadb-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleMariaDBEvidenceUpload(this)" style="display:none;">
        <div class="preview-area"></div>
        <div class="upload-placeholder" onclick="this.parentElement.querySelector('input[type=file]').click()">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Click để upload</span>
        </div>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh MariaDB
function handleMariaDBEvidenceUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const slot = input.closest('.upload-box');
    const previewArea = slot.querySelector('.preview-area');
    const placeholder = slot.querySelector('.upload-placeholder');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewArea.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                <img src="${e.target.result}" alt="Evidence" style="display:none;">
                <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBEvidenceSlot(this)" title="Xóa ảnh">
                    ✖
                </button>
            </div>
        `;
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Xóa slot ảnh MariaDB
function deleteMariaDBEvidenceSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.upload-box');
        slot.remove();
    }
}

// Thu thập dữ liệu ảnh sở cứ MariaDB
function collectMariaDBEvidenceData() {
    const grid = document.getElementById('mariadb-evidence-grid');
    if (!grid) return [];
    
    const images = [];
    grid.querySelectorAll('.upload-box').forEach(slot => {
        const img = slot.querySelector('.preview-area img');
        if (img && img.src) {
            images.push({ dataUrl: img.src });
        }
    });
    return images;
}

// Thêm slot ảnh sở cứ cho bảng hệ thống tham chiếu MariaDB
function addMariaDBRefEvidenceSlot() {
    const grid = document.getElementById('mariadb-ref-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleMariaDBRefEvidenceUpload(this)" style="display:none;">
        <div class="preview-area"></div>
        <div class="upload-placeholder" onclick="this.parentElement.querySelector('input[type=file]').click()">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Click để upload</span>
        </div>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh sở cứ bảng tham chiếu MariaDB
function handleMariaDBRefEvidenceUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const slot = input.closest('.upload-box');
    const previewArea = slot.querySelector('.preview-area');
    const placeholder = slot.querySelector('.upload-placeholder');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewArea.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                <img src="${e.target.result}" alt="Evidence" style="display:none;">
                <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBRefEvidenceSlot(this)" title="Xóa ảnh">
                    ✖
                </button>
            </div>
        `;
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Xóa slot ảnh sở cứ bảng tham chiếu MariaDB
function deleteMariaDBRefEvidenceSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.upload-box');
        slot.remove();
    }
}

// Thu thập dữ liệu ảnh sở cứ bảng tham chiếu MariaDB
function collectMariaDBRefEvidenceData() {
    const grid = document.getElementById('mariadb-ref-evidence-grid');
    if (!grid) return [];
    
    const images = [];
    grid.querySelectorAll('.upload-box').forEach(slot => {
        const img = slot.querySelector('.preview-area img');
        if (img && img.src) {
            images.push({ dataUrl: img.src });
        }
    });
    return images;
}

// ==================== MODULE REDIS FUNCTIONS ====================

// Chọn phương pháp tính toán Redis
function selectRedisMethod(method) {
    const keyBtn = document.getElementById('redis-method-key');
    const configBtn = document.getElementById('redis-method-config');
    const keyContent = document.getElementById('redis-method-key-content');
    const configContent = document.getElementById('redis-method-config-content');
    
    if (method === 'key') {
        keyBtn.classList.add('active');
        keyBtn.style.border = '2px solid #0066cc';
        keyBtn.style.background = '#e6f3ff';
        configBtn.classList.remove('active');
        configBtn.style.border = '2px solid #ccc';
        configBtn.style.background = '#f8f9fa';
        keyContent.style.display = 'block';
        configContent.style.display = 'none';
    } else {
        configBtn.classList.add('active');
        configBtn.style.border = '2px solid #0066cc';
        configBtn.style.background = '#e6f3ff';
        keyBtn.classList.remove('active');
        keyBtn.style.border = '2px solid #ccc';
        keyBtn.style.background = '#f8f9fa';
        configContent.style.display = 'block';
        keyContent.style.display = 'none';
    }
}

// Thêm slot ảnh sở cứ cho phương pháp Key
function addRedisKeyEvidenceSlot() {
    const grid = document.getElementById('redis-key-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <div class="preview-area"></div>
        <input type="file" accept="image/*" onchange="handleRedisKeyImageUpload(this)" style="display:none;">
        <button type="button" class="btn-upload sizing-user-btn" onclick="this.previousElementSibling.click()">
            <i class="fa-solid fa-upload"></i> Chọn ảnh
        </button>
        <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('.upload-box').remove()" style="margin-left: 5px;">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh
function handleRedisKeyImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewArea = input.closest('.upload-box').querySelector('.preview-area');
        previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
    };
    reader.readAsDataURL(file);
}

// Thêm dòng vào bảng cấu hình Redis
function addRedisConfigRow(data = {}) {
    const tbody = document.getElementById('redis-config-table-body');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input redis-config-ip" value="${data.ip || ''}" placeholder="192.168.x.x"></td>
        <td><input type="number" class="input-full sizing-user-input redis-config-ram" value="${data.ram || ''}" placeholder="RAM (GB)" min="0" onchange="updateRedisTotalMasterRAM()"></td>
        <td><input type="number" class="input-full sizing-user-input redis-config-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" max="100" onchange="updateRedisTotalMasterRAM()"></td>
        <td class="text-center">
            <input type="checkbox" class="redis-master-checkbox" ${data.isMaster ? 'checked' : ''} onchange="updateRedisTotalMasterRAM()">
        </td>
        <td class="admin-cell">
            <select class="admin-eval-select redis-config-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note redis-config-note" placeholder="Nhận xét..." value="${data.adminNote || ''}">
        </td>
        <td class="text-center">
            <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('tr').remove(); updateRedisTotalMasterRAM();">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    
    // Apply role permissions for new row
    applyRolePermissions();
}

// Cập nhật tổng RAM của các Master
function updateRedisTotalMasterRAM() {
    const rows = document.querySelectorAll('#redis-config-table-body tr');
    let totalMasterRAM = 0;
    
    rows.forEach(row => {
        const isMaster = row.querySelector('.redis-master-checkbox')?.checked;
        if (isMaster) {
            const ram = parseFloat(row.querySelector('.redis-config-ram')?.value) || 0;
            const ramLoad = parseFloat(row.querySelector('.redis-config-ram-load')?.value) || 0;
            totalMasterRAM += ram * (ramLoad / 100);
        }
    });
    
    const totalEl = document.getElementById('redis-total-master-ram');
    if (totalEl) totalEl.innerText = totalMasterRAM.toFixed(2);
}

// Thu thập dữ liệu bảng cấu hình Redis
function collectRedisConfigTableData() {
    const rows = document.querySelectorAll('#redis-config-table-body tr');
    const data = [];
    rows.forEach(row => {
        data.push({
            ip: row.querySelector('.redis-config-ip')?.value || '',
            ram: row.querySelector('.redis-config-ram')?.value || '',
            ramLoad: row.querySelector('.redis-config-ram-load')?.value || '',
            isMaster: row.querySelector('.redis-master-checkbox')?.checked || false,
            adminEval: row.querySelector('.redis-config-eval')?.value || '',
            adminNote: row.querySelector('.redis-config-note')?.value || ''
        });
    });
    return data;
}

// Thu thập ảnh sở cứ Redis Key
function collectRedisKeyEvidenceData() {
    const grid = document.getElementById('redis-key-evidence-grid');
    if (!grid) return [];
    
    const images = [];
    grid.querySelectorAll('.upload-box').forEach(slot => {
        const img = slot.querySelector('.preview-area img');
        if (img) {
            images.push({ dataUrl: img.src });
        }
    });
    return images;
}

// Tìm số N (số lẻ > 1 sao cho RAM1svr < 64)
function findOptimalN(totalRAM) {
    const targetRAM = totalRAM * 1.1 / 0.8;
    let N = 1;
    
    // Nếu targetRAM < 64, N = 1 là đủ
    if (targetRAM < 64) {
        return 1;
    }
    
    // Tìm N là số lẻ > 1 sao cho RAM/N < 64
    N = 3; // Bắt đầu từ 3 (số lẻ > 1)
    while (targetRAM / N >= 64) {
        N += 2; // Tăng lên số lẻ tiếp theo
    }
    
    return N;
}

// Tính toán theo phương pháp Key dự kiến
function calculateRedisKeyMethod() {
    const keyCount = parseFloat(document.getElementById('redis-key-count')?.value) || 0;
    const recordSize = parseFloat(document.getElementById('redis-record-size')?.value) || 0;
    const importance = document.getElementById('redis-key-importance')?.value || 'normal';
    
    if (!keyCount || !recordSize) {
        alert('Vui lòng nhập đầy đủ thông tin: Tổng lượng Key và Kích thước bản ghi!');
        return;
    }
    
    // Tính C = A * B (bytes -> GB)
    const C = (keyCount * recordSize) / (1024 * 1024 * 1024); // Convert to GB
    
    // Update display
    document.getElementById('redis-total-capacity').innerText = C.toFixed(4);
    
    let html = '';
    let model = '';
    let vcpu = 0;
    let ramPerServer = 0;
    let diskPerServer = 0;
    let masterCount = 1;
    let slavePerMaster = importance === 'dbqt' ? 2 : 1;
    let totalServers = 0;
    
    if (C < 32) {
        // Redis Sentinel: 1 master 2 slave
        model = 'Redis Sentinel';
        vcpu = 8;
        ramPerServer = C * 1.1 / 0.8;
        diskPerServer = 4 * ramPerServer;
        masterCount = 1;
        slavePerMaster = 2;
        totalServers = 1 + 2; // 1 master + 2 slave
    } else {
        // Redis Cluster
        model = 'Redis Cluster';
        vcpu = 16;
        
        // Tìm N
        const N = findOptimalN(C);
        masterCount = N;
        ramPerServer = (C * 1.1 / 0.8) / N;
        diskPerServer = 4 * ramPerServer;
        totalServers = N * (1 + slavePerMaster); // N master * (1 + số slave mỗi master)
    }
    
    // ==================== HIỂN THỊ KẾT QUẢ ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Tổng số Key:</strong> ${keyCount.toLocaleString()}</li>
            <li><strong>Kích thước trung bình 1 bản ghi:</strong> ${recordSize} bytes</li>
            <li><strong>Tổng dung lượng Key Redis (C):</strong> ${keyCount.toLocaleString()} × ${recordSize} = <strong>${C.toFixed(4)} GB</strong></li>
            <li><strong>Mức độ quan trọng:</strong> ${importance === 'dbqt' ? 'DBQT - Đảm bảo quốc gia' : 'Bình thường'}</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;"><i class="fa-solid fa-lightbulb"></i> Đề xuất mô hình</h4>
        <p style="margin: 0; font-size: 15px;">
            <strong>${model}</strong> - ${masterCount} master ${slavePerMaster} slave
            ${C >= 32 ? `<br><em>(C = ${C.toFixed(2)} GB > 32 GB → Sử dụng Cluster với N = ${masterCount} master)</em>` : `<br><em>(C = ${C.toFixed(2)} GB < 32 GB → Sử dụng Sentinel)</em>`}
        </p>
    </div>`;
    
    html += `<div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #856404;">Công thức tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>RAM mỗi server:</strong> RAM1svr = C × 1.1 / 0.8${masterCount > 1 ? ' / N' : ''} = ${C.toFixed(2)} × 1.1 / 0.8${masterCount > 1 ? ` / ${masterCount}` : ''} = <strong>${ramPerServer.toFixed(2)} GB</strong></li>
            <li><strong>vCPU mỗi server:</strong> ${vcpu} vCPU (mặc định cho ${model})</li>
            <li><strong>DISK mỗi server:</strong> 4 × RAM = 4 × ${ramPerServer.toFixed(2)} = <strong>${diskPerServer.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // Bảng kết quả
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 200px;">Cấu hình đề xuất</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Redis ${model === 'Redis Sentinel' ? 'Sentinel' : 'Cluster'}</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
                        <li><strong>${vcpu} vCPU</strong></li>
                        <li><strong>${Math.ceil(ramPerServer)} GB RAM</strong></li>
                        <li><strong>${Math.ceil(diskPerServer)} GB DISK</strong></li>
                    </ul>
                </td>
                <td class="text-center"><strong>${totalServers}</strong></td>
                <td>${masterCount} master × (1 + ${slavePerMaster} slave)</td>
            </tr>
        </tbody>
    </table>`;
    
    // Bảng tổng hợp
    const totalVCPU = vcpu * totalServers;
    const totalRAM = Math.ceil(ramPerServer) * totalServers;
    const totalDisk = Math.ceil(diskPerServer) * totalServers;
    
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-table"></i> Bảng tổng hợp tài nguyên
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th>Module</th>
                <th>Số lượng</th>
                <th>vCPU/server</th>
                <th>RAM/server (GB)</th>
                <th>Disk/server (GB)</th>
                <th>Tổng vCPU</th>
                <th>Tổng RAM (GB)</th>
                <th>Tổng Disk (GB)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #f0f9ff;">
                <td><strong>Redis</strong></td>
                <td class="text-center">${totalServers}</td>
                <td class="text-center">${vcpu}</td>
                <td class="text-center">${Math.ceil(ramPerServer)}</td>
                <td class="text-center">${Math.ceil(diskPerServer)}</td>
                <td class="text-center"><strong>${totalVCPU}</strong></td>
                <td class="text-center"><strong>${totalRAM}</strong></td>
                <td class="text-center"><strong>${totalDisk}</strong></td>
            </tr>
        </tbody>
    </table>`;
    
    const container = document.getElementById('redis-key-result-container');
    if (container) container.innerHTML = html;
}

// Tính toán theo phương pháp cấu hình hiện có
function calculateRedisConfigMethod() {
    const inputCCU = parseFloat(document.getElementById('redis-config-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('redis-config-sizing-ccu')?.value) || 0;
    const importance = document.getElementById('redis-config-importance')?.value || 'normal';
    const currentModel = document.getElementById('redis-current-model')?.value || 'cluster';
    
    if (!inputCCU || !sizingCCU) {
        alert('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".');
        return;
    }
    
    // Lấy tổng RAM từ các Master
    const totalMasterRAM = parseFloat(document.getElementById('redis-total-master-ram')?.innerText) || 0;
    
    if (totalMasterRAM <= 0) {
        alert('Vui lòng nhập thông tin và tick chọn ít nhất một Master trong bảng cấu hình!');
        return;
    }
    
    // Hệ số
    const factor = sizingCCU / inputCCU;
    
    // RAM cần = RAM * Tải RAM * (Định cỡ / Đầu vào) * 1.1 / 0.9
    const ramNeeded = totalMasterRAM * factor * 1.1 / 0.9;
    
    // Sau đó áp dụng công thức tương tự phương pháp Key
    const C = ramNeeded;
    
    let html = '';
    let model = '';
    let vcpu = 0;
    let ramPerServer = 0;
    let diskPerServer = 0;
    let masterCount = 1;
    let slavePerMaster = importance === 'dbqt' ? 2 : 1;
    let totalServers = 0;
    
    if (C < 32) {
        // Redis Sentinel
        model = 'Redis Sentinel';
        vcpu = 8;
        ramPerServer = C * 1.1 / 0.8;
        diskPerServer = 4 * ramPerServer;
        masterCount = 1;
        slavePerMaster = 2;
        totalServers = 1 + 2;
    } else {
        // Redis Cluster
        model = 'Redis Cluster';
        vcpu = 16;
        
        const N = findOptimalN(C);
        masterCount = N;
        ramPerServer = (C * 1.1 / 0.8) / N;
        diskPerServer = 4 * ramPerServer;
        totalServers = N * (1 + slavePerMaster);
    }
    
    // ==================== HIỂN THỊ KẾT QUẢ ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Mô hình hiện tại:</strong> ${currentModel === 'cluster' ? 'Redis Cluster' : 'Redis Sentinel'}</li>
            <li><strong>Tổng RAM Master hiện tại (đã nhân tải):</strong> ${totalMasterRAM.toFixed(2)} GB</li>
            <li><strong>Hệ số (Định cỡ/Đầu vào):</strong> ${sizingCCU} / ${inputCCU} = ${factor.toFixed(2)}</li>
            <li><strong>RAM cần cho hệ thống mới:</strong> ${totalMasterRAM.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9 = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>Mức độ quan trọng:</strong> ${importance === 'dbqt' ? 'DBQT - Đảm bảo quốc gia' : 'Bình thường'}</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;"><i class="fa-solid fa-lightbulb"></i> Đề xuất mô hình</h4>
        <p style="margin: 0; font-size: 15px;">
            <strong>${model}</strong> - ${masterCount} master ${slavePerMaster} slave
            ${C >= 32 ? `<br><em>(RAM = ${C.toFixed(2)} GB > 32 GB → Sử dụng Cluster với N = ${masterCount} master)</em>` : `<br><em>(RAM = ${C.toFixed(2)} GB < 32 GB → Sử dụng Sentinel)</em>`}
        </p>
    </div>`;
    
    html += `<div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #856404;">Công thức tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>RAM mỗi server:</strong> RAM1svr = C × 1.1 / 0.8${masterCount > 1 ? ' / N' : ''} = ${C.toFixed(2)} × 1.1 / 0.8${masterCount > 1 ? ` / ${masterCount}` : ''} = <strong>${ramPerServer.toFixed(2)} GB</strong></li>
            <li><strong>vCPU mỗi server:</strong> ${vcpu} vCPU (mặc định cho ${model})</li>
            <li><strong>DISK mỗi server:</strong> 4 × RAM = 4 × ${ramPerServer.toFixed(2)} = <strong>${diskPerServer.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // Bảng kết quả
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 200px;">Cấu hình đề xuất</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Redis ${model === 'Redis Sentinel' ? 'Sentinel' : 'Cluster'}</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
                        <li><strong>${vcpu} vCPU</strong></li>
                        <li><strong>${Math.ceil(ramPerServer)} GB RAM</strong></li>
                        <li><strong>${Math.ceil(diskPerServer)} GB DISK</strong></li>
                    </ul>
                </td>
                <td class="text-center"><strong>${totalServers}</strong></td>
                <td>${masterCount} master × (1 + ${slavePerMaster} slave)</td>
            </tr>
        </tbody>
    </table>`;
    
    // Bảng tổng hợp
    const totalVCPU = vcpu * totalServers;
    const totalRAM = Math.ceil(ramPerServer) * totalServers;
    const totalDisk = Math.ceil(diskPerServer) * totalServers;
    
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-table"></i> Bảng tổng hợp tài nguyên
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th>Module</th>
                <th>Số lượng</th>
                <th>vCPU/server</th>
                <th>RAM/server (GB)</th>
                <th>Disk/server (GB)</th>
                <th>Tổng vCPU</th>
                <th>Tổng RAM (GB)</th>
                <th>Tổng Disk (GB)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #f0f9ff;">
                <td><strong>Redis</strong></td>
                <td class="text-center">${totalServers}</td>
                <td class="text-center">${vcpu}</td>
                <td class="text-center">${Math.ceil(ramPerServer)}</td>
                <td class="text-center">${Math.ceil(diskPerServer)}</td>
                <td class="text-center"><strong>${totalVCPU}</strong></td>
                <td class="text-center"><strong>${totalRAM}</strong></td>
                <td class="text-center"><strong>${totalDisk}</strong></td>
            </tr>
        </tbody>
    </table>`;
    
    const container = document.getElementById('redis-config-result-container');
    if (container) container.innerHTML = html;
}

// Thu thập dữ liệu Redis để lưu
function collectRedisData() {
    // Xác định phương pháp đang chọn
    const keyBtn = document.getElementById('redis-method-key');
    const selectedMethod = keyBtn?.classList.contains('active') ? 'key' : 'config';
    
    return {
        selectedMethod: selectedMethod,
        // Phương pháp Key
        keyMethod: {
            keyCount: document.getElementById('redis-key-count')?.value || '',
            recordSize: document.getElementById('redis-record-size')?.value || '',
            importance: document.getElementById('redis-key-importance')?.value || 'normal',
            evidenceImages: collectRedisKeyEvidenceData(),
            resultHTML: document.getElementById('redis-key-result-container')?.innerHTML || ''
        },
        // Phương pháp Config
        configMethod: {
            currentModel: document.getElementById('redis-current-model')?.value || 'cluster',
            configTable: collectRedisConfigTableData(),
            inputCCU: document.getElementById('redis-config-input-ccu')?.value || '',
            sizingCCU: document.getElementById('redis-config-sizing-ccu')?.value || '',
            importance: document.getElementById('redis-config-importance')?.value || 'normal',
            resultHTML: document.getElementById('redis-config-result-container')?.innerHTML || ''
        }
    };
}

// Load dữ liệu Redis từ DB
function loadRedisData(data) {
    if (!data) return;
    
    // Load phương pháp đã chọn
    if (data.selectedMethod) {
        selectRedisMethod(data.selectedMethod);
    }
    
    // Load phương pháp Key
    if (data.keyMethod) {
        const km = data.keyMethod;
        if (km.keyCount) document.getElementById('redis-key-count').value = km.keyCount;
        if (km.recordSize) document.getElementById('redis-record-size').value = km.recordSize;
        if (km.importance) document.getElementById('redis-key-importance').value = km.importance;
        
        // Load ảnh sở cứ
        if (km.evidenceImages && Array.isArray(km.evidenceImages)) {
            const grid = document.getElementById('redis-key-evidence-grid');
            if (grid) {
                grid.innerHTML = '';
                km.evidenceImages.forEach(img => {
                    addRedisKeyEvidenceSlot();
                    const lastSlot = grid.lastElementChild;
                    if (lastSlot && img.dataUrl) {
                        const previewArea = lastSlot.querySelector('.preview-area');
                        if (previewArea) {
                            previewArea.innerHTML = `<img src="${img.dataUrl}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
                        }
                    }
                });
            }
        }
        
        // Load kết quả
        if (km.resultHTML) {
            const container = document.getElementById('redis-key-result-container');
            if (container) container.innerHTML = km.resultHTML;
        }
    }
    
    // Load phương pháp Config
    if (data.configMethod) {
        const cm = data.configMethod;
        if (cm.currentModel) document.getElementById('redis-current-model').value = cm.currentModel;
        if (cm.inputCCU) document.getElementById('redis-config-input-ccu').value = cm.inputCCU;
        if (cm.sizingCCU) document.getElementById('redis-config-sizing-ccu').value = cm.sizingCCU;
        if (cm.importance) document.getElementById('redis-config-importance').value = cm.importance;
        
        // Load bảng config
        if (cm.configTable && Array.isArray(cm.configTable)) {
            document.getElementById('redis-config-table-body').innerHTML = '';
            cm.configTable.forEach(row => addRedisConfigRow(row));
            updateRedisTotalMasterRAM();
        }
        
        // Load kết quả
        if (cm.resultHTML) {
            const container = document.getElementById('redis-config-result-container');
            if (container) container.innerHTML = cm.resultHTML;
        }
    }
}

// ==================== MODULE KAFKA FUNCTIONS ====================

// Chọn phương pháp tính toán Kafka
function selectKafkaMethod(method) {
    const throughputBtn = document.getElementById('kafka-method-throughput');
    const linearBtn = document.getElementById('kafka-method-linear');
    const throughputContent = document.getElementById('kafka-method-throughput-content');
    const linearContent = document.getElementById('kafka-method-linear-content');
    
    if (method === 'throughput') {
        throughputBtn.classList.add('active');
        throughputBtn.style.border = '2px solid #0066cc';
        throughputBtn.style.background = '#e6f3ff';
        linearBtn.classList.remove('active');
        linearBtn.style.border = '2px solid #ccc';
        linearBtn.style.background = '#f8f9fa';
        throughputContent.style.display = 'block';
        linearContent.style.display = 'none';
    } else {
        linearBtn.classList.add('active');
        linearBtn.style.border = '2px solid #0066cc';
        linearBtn.style.background = '#e6f3ff';
        throughputBtn.classList.remove('active');
        throughputBtn.style.border = '2px solid #ccc';
        throughputBtn.style.background = '#f8f9fa';
        linearContent.style.display = 'block';
        throughputContent.style.display = 'none';
    }
}

// Thêm ảnh sở cứ cho Throughput
function addKafkaThroughputEvidenceSlot() {
    const grid = document.getElementById('kafka-throughput-evidence-grid');
    if (!grid) return;
    addImageUploadSlot(grid, 'handleKafkaImageUpload');
}

// Thêm ảnh sở cứ cho Compression
function addKafkaCompressionEvidenceSlot() {
    const grid = document.getElementById('kafka-compression-evidence-grid');
    if (!grid) return;
    addImageUploadSlot(grid, 'handleKafkaImageUpload');
}

// Helper function để thêm image upload slot
function addImageUploadSlot(grid, handlerName) {
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <div class="preview-area"></div>
        <input type="file" accept="image/*" onchange="${handlerName}(this)" style="display:none;">
        <button type="button" class="btn-upload sizing-user-btn" onclick="this.previousElementSibling.click()">
            <i class="fa-solid fa-upload"></i> Chọn ảnh
        </button>
        <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('.upload-box').remove()" style="margin-left: 5px;">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh Kafka
function handleKafkaImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewArea = input.closest('.upload-box').querySelector('.preview-area');
        previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
    };
    reader.readAsDataURL(file);
}

// Mở Helper Tool popup
function openKafkaHelperTool() {
    document.getElementById('kafka-helper-modal').style.display = 'flex';
}

// Đóng Helper Tool popup
function closeKafkaHelperTool() {
    document.getElementById('kafka-helper-modal').style.display = 'none';
}

// Thêm ảnh sở cứ cho Helper Tool - Message count
function addKafkaHelperMsgEvidenceSlot() {
    const grid = document.getElementById('kafka-helper-msg-evidence-grid');
    if (!grid) return;
    addImageUploadSlot(grid, 'handleKafkaImageUpload');
}

// Thêm ảnh sở cứ cho Helper Tool - Message size
function addKafkaHelperSizeEvidenceSlot() {
    const grid = document.getElementById('kafka-helper-size-evidence-grid');
    if (!grid) return;
    addImageUploadSlot(grid, 'handleKafkaImageUpload');
}

// Tính throughput từ Helper Tool
function calculateKafkaHelperThroughput() {
    const msgCount = parseFloat(document.getElementById('kafka-helper-msg-count')?.value) || 0;
    const msgSize = parseFloat(document.getElementById('kafka-helper-msg-size')?.value) || 0;
    
    if (!msgCount || !msgSize) {
        alert('Vui lòng nhập đầy đủ thông tin!');
        return;
    }
    
    // A = msgCount * msgSize / 1024 (KB -> MB)
    const A = (msgCount * msgSize) / 1024;
    document.getElementById('kafka-helper-result').innerText = A.toFixed(4);
}

// Áp dụng kết quả từ Helper Tool
function applyKafkaHelperResult() {
    const result = parseFloat(document.getElementById('kafka-helper-result')?.innerText) || 0;
    if (result <= 0) {
        alert('Vui lòng tính toán trước khi áp dụng!');
        return;
    }
    
    document.getElementById('kafka-throughput-a').value = result.toFixed(4);
    closeKafkaHelperTool();
}

// Thêm dòng vào bảng Linear (Existing System)
function addKafkaLinearRow(data = {}) {
    const tbody = document.getElementById('kafka-linear-table-body');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input kafka-linear-ip" value="${data.ip || ''}" placeholder="192.168.x.x"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-vcpu" value="${data.vcpu || ''}" placeholder="vCPU" min="0" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-ram" value="${data.ram || ''}" placeholder="RAM" min="0" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-disk" value="${data.disk || ''}" placeholder="Disk" min="0" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-cpu-load" value="${data.cpuLoad || ''}" placeholder="%" min="0" max="100" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" max="100" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-disk-load" value="${data.diskLoad || ''}" placeholder="%" min="0" max="100" onchange="updateKafkaLinearTotal()"></td>
        <td class="admin-cell">
            <select class="admin-eval-select kafka-linear-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note kafka-linear-note" placeholder="Nhận xét..." value="${data.adminNote || ''}">
        </td>
        <td class="text-center">
            <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('tr').remove(); updateKafkaLinearTotal();">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    
    // Apply role permissions for new row
    applyRolePermissions();
}

// Cập nhật tổng cho bảng Linear
function updateKafkaLinearTotal() {
    const rows = document.querySelectorAll('#kafka-linear-table-body tr');
    let totalCPU = 0, totalRAM = 0, totalDisk = 0;
    
    rows.forEach(row => {
        const vcpu = parseFloat(row.querySelector('.kafka-linear-vcpu')?.value) || 0;
        const ram = parseFloat(row.querySelector('.kafka-linear-ram')?.value) || 0;
        const disk = parseFloat(row.querySelector('.kafka-linear-disk')?.value) || 0;
        const cpuLoad = parseFloat(row.querySelector('.kafka-linear-cpu-load')?.value) || 0;
        const ramLoad = parseFloat(row.querySelector('.kafka-linear-ram-load')?.value) || 0;
        const diskLoad = parseFloat(row.querySelector('.kafka-linear-disk-load')?.value) || 0;
        
        totalCPU += vcpu * (cpuLoad / 100);
        totalRAM += ram * (ramLoad / 100);
        totalDisk += disk * (diskLoad / 100);
    });
    
    document.getElementById('kafka-linear-total-cpu').innerText = totalCPU.toFixed(2);
    document.getElementById('kafka-linear-total-ram').innerText = totalRAM.toFixed(2);
    document.getElementById('kafka-linear-total-disk').innerText = totalDisk.toFixed(2);
}

// Thu thập dữ liệu bảng Linear
function collectKafkaLinearTableData() {
    const rows = document.querySelectorAll('#kafka-linear-table-body tr');
    const data = [];
    rows.forEach(row => {
        data.push({
            ip: row.querySelector('.kafka-linear-ip')?.value || '',
            vcpu: row.querySelector('.kafka-linear-vcpu')?.value || '',
            ram: row.querySelector('.kafka-linear-ram')?.value || '',
            disk: row.querySelector('.kafka-linear-disk')?.value || '',
            cpuLoad: row.querySelector('.kafka-linear-cpu-load')?.value || '',
            ramLoad: row.querySelector('.kafka-linear-ram-load')?.value || '',
            diskLoad: row.querySelector('.kafka-linear-disk-load')?.value || '',
            adminEval: row.querySelector('.kafka-linear-eval')?.value || '',
            adminNote: row.querySelector('.kafka-linear-note')?.value || ''
        });
    });
    return data;
}

// Thu thập ảnh sở cứ
function collectKafkaEvidenceData(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return [];
    
    const images = [];
    grid.querySelectorAll('.upload-box').forEach(slot => {
        const img = slot.querySelector('.preview-area img');
        if (img) {
            images.push({ dataUrl: img.src });
        }
    });
    return images;
}

// Tìm số N tối ưu cho Kafka (N >= 3, RAM mục tiêu 16 < RAM < 64, ~32GB)
function findOptimalKafkaN(S, R) {
    // RAM = S * R / N + 8GB
    // Tìm N sao cho 16 < RAM < 64 (mục tiêu ~32GB)
    let N = 3; // Kafka cluster tối thiểu 3 broker
    
    while (N < 100) { // Giới hạn tìm kiếm
        const RAM = (S * R / N) + 8;
        if (RAM < 64) {
            // Kiểm tra nếu RAM > 16
            if (RAM > 16) {
                return N;
            }
        }
        N++;
    }
    
    return 3; // Mặc định
}

// Tính toán theo phương pháp Throughput
function calculateKafkaThroughputMethod() {
    const A = parseFloat(document.getElementById('kafka-throughput-a')?.value) || 0;
    const T = parseFloat(document.getElementById('kafka-retention-time')?.value) || 168;
    const R = parseFloat(document.getElementById('kafka-replication-factor')?.value) || 3;
    const C = parseFloat(document.getElementById('kafka-compression')?.value) || 0.5;
    
    if (!A) {
        alert('Vui lòng nhập Lưu lượng vào (Write) - A!');
        return;
    }
    
    // Tổng Disk Cluster: D = A * 3600 * T * R * C * 1.1 / 0.8 (MB)
    const D_MB = A * 3600 * T * R * C * 1.1 / 0.8;
    const D_GB = D_MB / 1024;
    const D_TB = D_GB / 1024;
    
    // S = A * 1800 (dữ liệu trong 30 phút)
    const S = A * 1800 / 1024;
    
    // Tìm N tối ưu
    const optimalN = findOptimalKafkaN(S, R);
    
    // vCPU: A < 50MB/s: 8 vCPU; A >= 50MB/s: 16 vCPU
    const vCPU = A < 50 ? 8 : 16;
    
    let html = '';
    
    // ==================== CÔNG THỨC TÍNH ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin đầu vào</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Lưu lượng vào (A):</strong> ${A} MB/s</li>
            <li><strong>Thời gian lưu trữ (T):</strong> ${T} giờ (${T/24} ngày)</li>
            <li><strong>Hệ số nhân bản (R):</strong> ${R}</li>
            <li><strong>Hệ số nén (C):</strong> ${C}</li>
            <li><strong>S (dữ liệu 30 phút):</strong> A × 1800 / 1024 = ${A} × 1800 = ${S.toFixed(2)} GB</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;"><i class="fa-solid fa-hard-drive"></i> Tổng Disk Cluster</h4>
        <p style="margin: 0; font-size: 14px;">
            <strong>D = A × 3600 × T × R × C × 1.1 / 0.8</strong><br>
            D = ${A} × 3600 × ${T} × ${R} × ${C} × 1.1 / 0.8<br>
            D = <strong>${D_MB.toFixed(2)} MB</strong> = <strong>${D_GB.toFixed(2)} GB</strong> = <strong>${D_TB.toFixed(4)} TB</strong>
        </p>
    </div>`;
    
    // ==================== BẢNG PHÂN BỔ THEO N ====================
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-table"></i> Bảng phân bổ theo số lượng Broker (N)
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 80px;">N (Broker)</th>
                <th>Disk/Server</th>
                <th>RAM/Server</th>
                <th>vCPU/Server</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>`;
    
    for (let n = 3; n <= 7; n++) {
        const diskPerServer = D_GB / n;
        const ramPerServer = (S * R / n) + 8;
        const isOptimal = n === optimalN;
        const ramStatus = ramPerServer >= 16 && ramPerServer <= 64 ? '✓' : '✗';
        const rowStyle = isOptimal ? 'background: #e6ffed; font-weight: 600;' : '';
        
        html += `<tr style="${rowStyle}">
            <td class="text-center">${n}${isOptimal ? ' ★' : ''}</td>
            <td class="text-center">${diskPerServer >= 1024 ? (diskPerServer/1024).toFixed(2) + ' TB' : diskPerServer.toFixed(2) + ' GB'}</td>
            <td class="text-center">${ramPerServer.toFixed(2)} GB ${ramStatus}</td>
            <td class="text-center">${vCPU}</td>
            <td>${isOptimal ? 'Khuyến nghị (16 < RAM < 64)' : (ramPerServer > 64 ? 'RAM quá cao' : (ramPerServer < 16 ? 'RAM thấp' : ''))}</td>
        </tr>`;
    }
    
    html += `</tbody></table>`;
    
    // ==================== KẾT QUẢ ĐỀ XUẤT ====================
    const diskPerServer = D_GB / optimalN;
    const ramPerServer = (S * R / optimalN) + 8;
    
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình (N = ${optimalN})
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 100px;">Số lượng Node</th>
                <th style="width: 100px;">vCPU/Node</th>
                <th style="width: 100px;">RAM/Node</th>
                <th style="width: 150px;">Disk/Node (SSD)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Kafka Broker</strong></td>
                <td class="text-center"><strong>${optimalN}</strong></td>
                <td class="text-center"><strong>${vCPU}</strong></td>
                <td class="text-center"><strong>${Math.ceil(ramPerServer)} GB</strong></td>
                <td class="text-center"><strong>${diskPerServer >= 1024 ? (diskPerServer/1024).toFixed(2) + ' TB' : Math.ceil(diskPerServer) + ' GB'}</strong></td>
            </tr>
            <tr style="background: #fff3cd;">
                <td><strong>Zookeeper/KRaft</strong></td>
                <td class="text-center"><strong>3</strong></td>
                <td class="text-center"><strong>2</strong></td>
                <td class="text-center"><strong>4 GB</strong></td>
                <td class="text-center"><strong>100 GB</strong></td>
            </tr>
        </tbody>
        
    </table>`;
    
    html += `<div style="background: #d4edda; padding: 15px; border-radius: 6px; margin-top: 15px; border-left: 4px solid #28a745;">
        <h4 style="margin: 0 0 10px 0; color: #155724;"><i class="fa-solid fa-info-circle"></i> Khuyến nghị</h4>
        <p style="margin: 0; font-size: 13px; color: #155724;">
            Tách rời 3 node Zookeeper/KRaft Controller (2 vCPU / 4GB RAM / 100GB DISK) để đảm bảo độ ổn định cao nhất.
        </p>
    </div>`;
    
    const container = document.getElementById('kafka-throughput-result-container');
    if (container) container.innerHTML = html;
}

// Tính toán theo phương pháp Linear (Existing System)
function calculateKafkaLinearMethod() {
    const inputCCU = parseFloat(document.getElementById('kafka-linear-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('kafka-linear-sizing-ccu')?.value) || 0;
    
    if (!inputCCU || !sizingCCU) {
        alert('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".');
        return;
    }
    
    // Lấy tổng từ bảng
    const totalCPU = parseFloat(document.getElementById('kafka-linear-total-cpu')?.innerText) || 0;
    const totalRAM = parseFloat(document.getElementById('kafka-linear-total-ram')?.innerText) || 0;
    const totalDisk = parseFloat(document.getElementById('kafka-linear-total-disk')?.innerText) || 0;
    
    if (totalCPU <= 0 && totalRAM <= 0 && totalDisk <= 0) {
        alert('Vui lòng nhập thông tin các Broker hiện tại!');
        return;
    }
    
    // Hệ số
    const factor = sizingCCU / inputCCU;
    
    // Tính toán cần
    const cpuNeeded = totalCPU * factor * 1.1 / 0.75;
    const ramNeeded = totalRAM * factor * 1.1 / 0.9;
    const diskNeeded = totalDisk * factor * 1.1 / 0.8;
    
    // Tìm N tối ưu (RAM mục tiêu ~32GB)
    let optimalN = 3;
    for (let n = 3; n <= 20; n++) {
        const ramPerNode = ramNeeded / n;
        if (ramPerNode >= 16 && ramPerNode <= 64) {
            optimalN = n;
            break;
        }
        if (ramPerNode < 16) {
            optimalN = Math.max(3, n - 1);
            break;
        }
    }
    
    const cpuPerNode = Math.ceil(cpuNeeded / optimalN);
    const ramPerNode = Math.ceil(ramNeeded / optimalN);
    const diskPerNode = Math.ceil(diskNeeded / optimalN);
    
    let html = '';
    
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Tổng CPU sử dụng hiện tại:</strong> ${totalCPU.toFixed(2)} vCPU</li>
            <li><strong>Tổng RAM sử dụng hiện tại:</strong> ${totalRAM.toFixed(2)} GB</li>
            <li><strong>Tổng Disk sử dụng hiện tại:</strong> ${totalDisk.toFixed(2)} GB</li>
            <li><strong>Hệ số (Định cỡ/Đầu vào):</strong> ${sizingCCU} / ${inputCCU} = ${factor.toFixed(2)}</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;">Tài nguyên cần cho hệ thống mới</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>CPU cần:</strong> ${totalCPU.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.75 = <strong>${cpuNeeded.toFixed(2)} vCPU</strong></li>
            <li><strong>RAM cần:</strong> ${totalRAM.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9 = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>Disk cần:</strong> ${totalDisk.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${diskNeeded.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // Bảng kết quả
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình (N = ${optimalN})
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 100px;">Số lượng Node</th>
                <th style="width: 100px;">vCPU/Node</th>
                <th style="width: 100px;">RAM/Node</th>
                <th style="width: 150px;">Disk/Node (SSD)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Kafka Broker</strong></td>
                <td class="text-center"><strong>${optimalN}</strong></td>
                <td class="text-center"><strong>${cpuPerNode}</strong></td>
                <td class="text-center"><strong>${ramPerNode} GB</strong></td>
                <td class="text-center"><strong>${diskPerNode >= 1024 ? (diskPerNode/1024).toFixed(2) + ' TB' : diskPerNode + ' GB'}</strong></td>
            </tr>
            <tr style="background: #fff3cd;">
                <td><strong>Zookeeper/KRaft</strong></td>
                <td class="text-center"><strong>3</strong></td>
                <td class="text-center"><strong>2</strong></td>
                <td class="text-center"><strong>4 GB</strong></td>
                <td class="text-center"><strong>100 GB</strong></td>
            </tr>
        </tbody>
        <tfoot>
            <tr style="background: #f0f9ff; font-weight: bold;">
                <td>Tổng cộng</td>
                <td class="text-center">${optimalN + 3}</td>
                <td class="text-center">${cpuPerNode * optimalN + 6}</td>
                <td class="text-center">${ramPerNode * optimalN + 12} GB</td>
                <td class="text-center">${(diskPerNode * optimalN + 300) >= 1024 ? ((diskPerNode * optimalN + 300)/1024).toFixed(2) + ' TB' : (diskPerNode * optimalN + 300) + ' GB'}</td>
            </tr>
        </tfoot>
    </table>`;
    
    const container = document.getElementById('kafka-linear-result-container');
    if (container) container.innerHTML = html;
}

// Thu thập dữ liệu Kafka để lưu
function collectKafkaData() {
    const throughputBtn = document.getElementById('kafka-method-throughput');
    const selectedMethod = throughputBtn?.classList.contains('active') ? 'throughput' : 'linear';
    
    return {
        selectedMethod: selectedMethod,
        // Phương pháp Throughput
        throughputMethod: {
            throughputA: document.getElementById('kafka-throughput-a')?.value || '',
            retentionTime: document.getElementById('kafka-retention-time')?.value || '168',
            replicationFactor: document.getElementById('kafka-replication-factor')?.value || '3',
            compression: document.getElementById('kafka-compression')?.value || '0.5',
            throughputEvidence: collectKafkaEvidenceData('kafka-throughput-evidence-grid'),
            compressionEvidence: collectKafkaEvidenceData('kafka-compression-evidence-grid'),
            resultHTML: document.getElementById('kafka-throughput-result-container')?.innerHTML || '',
            // Helper tool data
            helperMsgCount: document.getElementById('kafka-helper-msg-count')?.value || '',
            helperMsgSize: document.getElementById('kafka-helper-msg-size')?.value || '',
            helperMsgEvidence: collectKafkaEvidenceData('kafka-helper-msg-evidence-grid'),
            helperSizeEvidence: collectKafkaEvidenceData('kafka-helper-size-evidence-grid')
        },
        // Phương pháp Linear
        linearMethod: {
            linearTable: collectKafkaLinearTableData(),
            inputCCU: document.getElementById('kafka-linear-input-ccu')?.value || '',
            sizingCCU: document.getElementById('kafka-linear-sizing-ccu')?.value || '',
            resultHTML: document.getElementById('kafka-linear-result-container')?.innerHTML || ''
        }
    };
}

// Load dữ liệu Kafka từ DB
function loadKafkaData(data) {
    if (!data) return;
    
    // Load phương pháp đã chọn
    if (data.selectedMethod) {
        selectKafkaMethod(data.selectedMethod);
    }
    
    // Load phương pháp Throughput
    if (data.throughputMethod) {
        const tm = data.throughputMethod;
        if (tm.throughputA) document.getElementById('kafka-throughput-a').value = tm.throughputA;
        if (tm.retentionTime) document.getElementById('kafka-retention-time').value = tm.retentionTime;
        if (tm.replicationFactor) document.getElementById('kafka-replication-factor').value = tm.replicationFactor;
        if (tm.compression) document.getElementById('kafka-compression').value = tm.compression;
        
        // Load ảnh sở cứ throughput
        loadKafkaEvidenceImages('kafka-throughput-evidence-grid', tm.throughputEvidence, addKafkaThroughputEvidenceSlot);
        loadKafkaEvidenceImages('kafka-compression-evidence-grid', tm.compressionEvidence, addKafkaCompressionEvidenceSlot);
        
        // Load helper tool data
        if (tm.helperMsgCount) document.getElementById('kafka-helper-msg-count').value = tm.helperMsgCount;
        if (tm.helperMsgSize) document.getElementById('kafka-helper-msg-size').value = tm.helperMsgSize;
        loadKafkaEvidenceImages('kafka-helper-msg-evidence-grid', tm.helperMsgEvidence, addKafkaHelperMsgEvidenceSlot);
        loadKafkaEvidenceImages('kafka-helper-size-evidence-grid', tm.helperSizeEvidence, addKafkaHelperSizeEvidenceSlot);
        
        // Load kết quả
        if (tm.resultHTML) {
            const container = document.getElementById('kafka-throughput-result-container');
            if (container) container.innerHTML = tm.resultHTML;
        }
    }
    
    // Load phương pháp Linear
    if (data.linearMethod) {
        const lm = data.linearMethod;
        if (lm.inputCCU) document.getElementById('kafka-linear-input-ccu').value = lm.inputCCU;
        if (lm.sizingCCU) document.getElementById('kafka-linear-sizing-ccu').value = lm.sizingCCU;
        
        // Load bảng linear
        if (lm.linearTable && Array.isArray(lm.linearTable)) {
            document.getElementById('kafka-linear-table-body').innerHTML = '';
            lm.linearTable.forEach(row => addKafkaLinearRow(row));
            updateKafkaLinearTotal();
        }
        
        // Load kết quả
        if (lm.resultHTML) {
            const container = document.getElementById('kafka-linear-result-container');
            if (container) container.innerHTML = lm.resultHTML;
        }
    }
}

// Helper để load ảnh sở cứ
function loadKafkaEvidenceImages(gridId, images, addSlotFn) {
    if (!images || !Array.isArray(images) || images.length === 0) return;
    
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    grid.innerHTML = '';
    images.forEach(img => {
        addSlotFn();
        const lastSlot = grid.lastElementChild;
        if (lastSlot && img.dataUrl) {
            const previewArea = lastSlot.querySelector('.preview-area');
            if (previewArea) {
                previewArea.innerHTML = `<img src="${img.dataUrl}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
            }
        }
    });
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
        case 'sizing':
            html = renderSizingDiff(currentPreviewSnapshot, previousPreviewSnapshot);
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
    
    let html = '';
    
    // Helper: render image gallery
    const renderImageGallery = (title, images, adminData) => {
        if (!images || images.length === 0) return '';
        const thumbs = images.map((img, i) => {
            const src = img.base64 || img.dataUrl || img;
            return `<img src="${src}" alt="${title}-${i}" onclick="openModal(this.src)" style="cursor:zoom-in; max-width:180px; max-height:120px; border-radius:6px; border:1px solid #e2e8f0; margin:4px;">`;
        }).join('');
        const evalHtml = adminData && adminData.eval ? renderEvalDiff(adminData.eval, null) : '';
        const noteHtml = adminData && adminData.note ? `<span style="color:#6366f1; font-style:italic; margin-left:8px;">${adminData.note}</span>` : '';
        return `
            <div class="diff-item" style="margin-bottom:16px;">
                <strong>${title}</strong> (${images.length} ảnh) ${evalHtml} ${noteHtml}
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${thumbs}</div>
            </div>
        `;
    };
    
    // Render images
    html += renderImageGallery('Mô hình Vật lý', data.physicalImages, moHinhAdmin.physical);
    html += renderImageGallery('Mô hình Logic', data.logicalImages, moHinhAdmin.logical);
    html += renderImageGallery('Luồng nghiệp vụ', data.flowImages, moHinhAdmin.flow);
    
    // Mô tả luồng nghiệp vụ
    const flowExpl = (data.flowExplanation || '').trim();
    if (flowExpl) {
        const prevFlowExpl = (prevData.flowExplanation || '').trim();
        html += `<div class="diff-item"><strong>Mô tả luồng nghiệp vụ:</strong><br>${flowExpl !== prevFlowExpl && prevSnapshot ? renderTextDiff(flowExpl, prevFlowExpl) : `<div style="margin-top:4px; white-space:pre-wrap;">${flowExpl}</div>`}</div>`;
    }
    
    // Architecture table
    const archRows = data.archRows || [];
    const prevArchRows = prevData.archRows || [];
    const archAdminReviews = moHinhAdmin.archRowReviews || [];
    const prevArchAdminReviews = prevMoHinhAdmin.archRowReviews || [];
    
    if (archRows.length > 0) {
        const fieldLabels = { nghiepVu: 'Nghiệp vụ', module: 'Module', zoneMang: 'Zone mạng', heDieuHanh: 'Hệ điều hành', soLuongVIP: 'Số lượng/VIP' };
        let archRowsHtml = '';
        archRows.forEach((row, i) => {
            const prevRow = prevArchRows[i] || {};
            const adminRow = archAdminReviews[i] || {};
            const prevAdminRow = prevArchAdminReviews[i] || {};
            const isNew = i >= prevArchRows.length;
            const rowClass = isNew ? 'diff-row-added' : '';
            
            archRowsHtml += `
                <tr class="${rowClass}">
                    <td style="padding:8px; border:1px solid #e2e8f0; text-align:center;">${i + 1}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.nghiepVu, prevRow.nghiepVu) : (row.nghiepVu || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.module, prevRow.module) : (row.module || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.zoneMang, prevRow.zoneMang) : (row.zoneMang || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.heDieuHanh, prevRow.heDieuHanh) : (row.heDieuHanh || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.soLuongVIP, prevRow.soLuongVIP) : (row.soLuongVIP || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(adminRow.eval, prevSnapshot ? (prevAdminRow.eval || '') : null)}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${prevSnapshot ? renderTextDiff(adminRow.note, prevAdminRow.note) : (adminRow.note || '-')}</td>
                </tr>
            `;
        });
        
        html += `
            <div class="diff-item" style="margin-top:16px;">
                <strong>Chi tiết thành phần kiến trúc</strong>
                <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:8px;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:8px; border:1px solid #e2e8f0; width:40px;">STT</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Nghiệp vụ</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Module</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Zone mạng</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Hệ ĐH</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">SL/VIP</th>
                            <th style="padding:8px; border:1px solid #e2e8f0; width:70px; background:#fef3c7;">Đánh giá</th>
                            <th style="padding:8px; border:1px solid #e2e8f0; width:140px; background:#fef3c7;">Ghi chú Admin</th>
                        </tr>
                    </thead>
                    <tbody>${archRowsHtml}</tbody>
                </table>
            </div>
        `;
    }
    
    if (!html.trim()) {
        if (prevSnapshot) {
            return `
                <div class="vp-section">
                    <div class="vp-no-changes">
                        <i class="fa-solid fa-check-circle"></i>
                        <span>Không có thay đổi trong phần Mô hình hệ thống</span>
                    </div>
                </div>
            `;
        }
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-sitemap" style="color: #6366f1;"></i> 
                Mô hình hệ thống
            </div>
            <div class="diff-list">
                ${html}
            </div>
        </div>
    `;
}

/**
 * Render diff cho Định cỡ hệ thống
 */
function renderSizingDiff(snapshot, prevSnapshot) {
    const content = snapshot.dinhCoHeThongContent;
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
    let prevData = { moduleApp: {} };
    if (prevSnapshot && prevSnapshot.dinhCoHeThongContent) {
        try {
            prevData = typeof prevSnapshot.dinhCoHeThongContent === 'string' 
                ? JSON.parse(prevSnapshot.dinhCoHeThongContent) 
                : prevSnapshot.dinhCoHeThongContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review
    let adminReview = {};
    if (snapshot.dinhCoAdminReview) {
        try {
            adminReview = typeof snapshot.dinhCoAdminReview === 'string' 
                ? JSON.parse(snapshot.dinhCoAdminReview) 
                : snapshot.dinhCoAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.dinhCoAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.dinhCoAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.dinhCoAdminReview) 
                : prevSnapshot.dinhCoAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let html = '';
    
    // ===================== MODULE APP =====================
    const moduleApp = data.moduleApp || {};
    const prevModuleApp = prevData.moduleApp || {};
    const moduleAppAdmin = (adminReview.moduleApp || {}).overallReview || {};
    
    let appHtml = '';
    
    // POC / Sizing
    const pocVal = moduleApp.pocValue || '';
    const sizVal = moduleApp.sizingValue || '';
    if (pocVal || sizVal) {
        appHtml += `<div class="diff-item"><strong>Tải hệ thống POC:</strong> ${prevSnapshot ? renderTextDiff(pocVal, prevModuleApp.pocValue) : (pocVal || '-')} &nbsp; | &nbsp; <strong>Định cỡ:</strong> ${prevSnapshot ? renderTextDiff(sizVal, prevModuleApp.sizingValue) : (sizVal || '-')}</div>`;
    }
    
    // Baseline table
    const baselineRows = moduleApp.baselineTable || [];
    if (baselineRows.length > 0) {
        const prevBaselineRows = prevModuleApp.baselineTable || [];
        const baselineAdminReviews = ((adminReview.moduleApp || {}).baselineRowReviews) || [];
        let bRowsHtml = baselineRows.map((row, i) => {
            const prev = prevBaselineRows[i] || {};
            const ar = baselineAdminReviews[i] || {};
            return `<tr>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${i+1}</td>
                <td style="padding:6px; border:1px solid #e2e8f0;">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.cpu, prev.cpu) : (row.cpu || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.ram, prev.ram) : (row.ram || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.disk, prev.disk) : (row.disk || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.cintRate, prev.cintRate) : (row.cintRate || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(ar.eval, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${ar.note || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Hệ thống tham chiếu</strong>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:6px; border:1px solid #e2e8f0;">STT</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">CPU</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">RAM</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Disk</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Cint</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                </tr></thead>
                <tbody>${bRowsHtml}</tbody>
            </table></div>`;
    }
    
    // Input config table
    const inputConfigRows = moduleApp.inputConfigTable || [];
    const inputConfigReviews = ((adminReview.moduleApp || {}).inputConfigRowReviews) || [];
    if (inputConfigRows.length > 0) {
        const prevInputConfigRows = prevModuleApp.inputConfigTable || [];
        let icRowsHtml = inputConfigRows.map((row, i) => {
            const prev = prevInputConfigRows[i] || {};
            const ar = inputConfigReviews[i] || {};
            const evalVal = ar.eval || row.adminEval || '';
            const noteVal = ar.note || row.adminNote || '';
            return `<tr>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${i+1}</td>
                <td style="padding:6px; border:1px solid #e2e8f0;">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.cpuLoad, prev.cpuLoad) : (row.cpuLoad || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.ramLoad, prev.ramLoad) : (row.ramLoad || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.diskLoad, prev.diskLoad) : (row.diskLoad || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.cintUsed || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramUsed || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.diskUsed || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(evalVal, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${noteVal || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Thông tin tải đầu vào</strong>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:6px; border:1px solid #e2e8f0;">STT</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">CPU Load %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">RAM Load %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Disk Load %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Cint used</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">RAM used</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Disk used</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                </tr></thead>
                <tbody>${icRowsHtml}</tbody>
            </table></div>`;
    }
    
    // Evidence images
    const evidenceImgs = moduleApp.evidenceImages || [];
    if (evidenceImgs.length > 0) {
        const thumbs = evidenceImgs.map((img, i) => {
            const src = img.dataUrl || img.base64 || img;
            return `<img src="${src}" alt="evidence-${i}" onclick="openModal(this.src)" style="cursor:zoom-in; max-width:150px; max-height:100px; border-radius:4px; border:1px solid #e2e8f0; margin:3px;">`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Ảnh sở cứ Module App</strong> (${evidenceImgs.length} ảnh)<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">${thumbs}</div></div>`;
    }
    
    // Admin overall review
    if (moduleAppAdmin.eval || moduleAppAdmin.note) {
        appHtml += `<div class="diff-item"><strong>Admin đánh giá Module App:</strong> ${renderEvalDiff(moduleAppAdmin.eval, null)} <span style="color:#6366f1; font-style:italic;">${moduleAppAdmin.note || ''}</span></div>`;
    }
    
    if (appHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#f8fafc; border-radius:8px; border-left:4px solid #3b82f6;">
            <h4 style="margin:0 0 10px 0; color:#1e40af;"><i class="fa-solid fa-server"></i> Module App</h4>${appHtml}</div>`;
    }
    
    // ===================== MODULE MARIADB =====================
    const moduleMariaDB = data.moduleMariaDB || {};
    const prevModuleMariaDB = prevData.moduleMariaDB || {};
    const mariadbAdmin = (adminReview.moduleMariaDB || {}).overallReview || {};
    let mariadbHtml = '';
    
    // Ref table
    const refRows = moduleMariaDB.refTable || [];
    const mariadbRefReviews = ((adminReview.moduleMariaDB || {}).refRowReviews) || [];
    if (refRows.length > 0) {
        let rRowsHtml = refRows.map((row, i) => {
            const ar = mariadbRefReviews[i] || {};
            return `<tr>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${i+1}</td>
            <td style="padding:6px; border:1px solid #e2e8f0;">${row.dbName || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.cpuLoad || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramLoad || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.storage || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(ar.eval, null)}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${ar.note || '-'}</td>
        </tr>`;
        }).join('');
        mariadbHtml += `<div class="diff-item"><strong>Bảng tham chiếu</strong>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:6px; border:1px solid #e2e8f0;">STT</th><th style="padding:6px; border:1px solid #e2e8f0;">Database</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">CPU %</th><th style="padding:6px; border:1px solid #e2e8f0;">RAM %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Storage</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                </tr></thead><tbody>${rRowsHtml}</tbody>
            </table></div>`;
    }
    
    // Storage review
    const mariadbStorageReview = (adminReview.moduleMariaDB || {}).storageReview || {};
    if (mariadbStorageReview.eval || mariadbStorageReview.note) {
        mariadbHtml += `<div class="diff-item"><strong>Đánh giá Storage:</strong> ${renderEvalDiff(mariadbStorageReview.eval, null)} <span style="color:#6366f1; font-style:italic;">${mariadbStorageReview.note || ''}</span></div>`;
    }
    
    if (mariadbAdmin.eval || mariadbAdmin.note) {
        mariadbHtml += `<div class="diff-item"><strong>Admin đánh giá tổng thể:</strong> ${renderEvalDiff(mariadbAdmin.eval, null)} <span style="color:#6366f1; font-style:italic;">${mariadbAdmin.note || ''}</span></div>`;
    }
    
    if (mariadbHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#fefce8; border-radius:8px; border-left:4px solid #eab308;">
            <h4 style="margin:0 0 10px 0; color:#854d0e;"><i class="fa-solid fa-database"></i> Module MariaDB</h4>${mariadbHtml}</div>`;
    }
    
    // ===================== MODULE REDIS =====================
    const moduleRedis = data.moduleRedis || {};
    const prevModuleRedis = prevData.moduleRedis || {};
    const redisAdmin = (adminReview.moduleRedis || {}).overallReview || {};
    let redisHtml = '';
    
    if (moduleRedis.selectedMethod) {
        redisHtml += `<div class="diff-item"><strong>Phương pháp:</strong> ${moduleRedis.selectedMethod === 'key' ? 'Tính theo Key' : 'Tính theo cấu hình hiện có'}</div>`;
    }
    
    // Key method
    if (moduleRedis.keyMethod) {
        const km = moduleRedis.keyMethod;
        if (km.keyCount || km.recordSize) {
            redisHtml += `<div class="diff-item"><strong>Key Count:</strong> ${km.keyCount || '-'} &nbsp; <strong>Record Size:</strong> ${km.recordSize || '-'}</div>`;
        }
    }
    
    // Config method
    if (moduleRedis.configMethod) {
        const cm = moduleRedis.configMethod;
        const configRows = cm.configTable || [];
        const redisConfigReviews = ((adminReview.moduleRedis || {}).configRowReviews) || [];
        if (configRows.length > 0) {
            let cRowsHtml = configRows.map((row, i) => {
                const ar = redisConfigReviews[i] || {};
                const evalVal = ar.eval || row.adminEval || '';
                const noteVal = ar.note || row.adminNote || '';
                return `<tr>
                <td style="padding:6px; border:1px solid #e2e8f0;">${row.ip || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ram || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.isMaster ? '✓' : ''}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(evalVal, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${noteVal || '-'}</td>
            </tr>`;
            }).join('');
            redisHtml += `<div class="diff-item"><strong>Bảng cấu hình Redis</strong>
                <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                    <thead><tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM Load</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">Master</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                    </tr></thead><tbody>${cRowsHtml}</tbody>
                </table></div>`;
        }
        if (cm.inputCCU || cm.sizingCCU) {
            redisHtml += `<div class="diff-item"><strong>CCU đầu vào:</strong> ${cm.inputCCU || '-'} &nbsp; <strong>CCU Định cỡ:</strong> ${cm.sizingCCU || '-'}</div>`;
        }
    }
    
    if (redisAdmin.eval || redisAdmin.note) {
        redisHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(redisAdmin.eval, null)} <span style="color:#6366f1; font-style:italic;">${redisAdmin.note || ''}</span></div>`;
    }
    
    if (redisHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#fef2f2; border-radius:8px; border-left:4px solid #ef4444;">
            <h4 style="margin:0 0 10px 0; color:#991b1b;"><i class="fa-solid fa-memory"></i> Module Redis</h4>${redisHtml}</div>`;
    }
    
    // ===================== MODULE KAFKA =====================
    const moduleKafka = data.moduleKafka || {};
    const prevModuleKafka = prevData.moduleKafka || {};
    const kafkaAdmin = (adminReview.moduleKafka || {}).overallReview || {};
    let kafkaHtml = '';
    
    if (moduleKafka.selectedMethod) {
        kafkaHtml += `<div class="diff-item"><strong>Phương pháp:</strong> ${moduleKafka.selectedMethod === 'throughput' ? 'Throughput' : 'Linear (Phương án B)'}</div>`;
    }
    
    // Throughput method
    if (moduleKafka.throughputMethod) {
        const tm = moduleKafka.throughputMethod;
        if (tm.throughputA) {
            kafkaHtml += `<div class="diff-item"><strong>Throughput A:</strong> ${tm.throughputA} &nbsp; <strong>Retention:</strong> ${tm.retentionTime || '168'}h &nbsp; <strong>Replication:</strong> ${tm.replicationFactor || '3'} &nbsp; <strong>Compression:</strong> ${tm.compression || '0.5'}</div>`;
        }
    }
    
    // Linear method
    if (moduleKafka.linearMethod) {
        const lm = moduleKafka.linearMethod;
        const linearRows = lm.linearTable || [];
        const kafkaLinearReviews = ((adminReview.moduleKafka || {}).linearRowReviews) || [];
        if (linearRows.length > 0) {
            let lRowsHtml = linearRows.map((row, i) => {
                const ar = kafkaLinearReviews[i] || {};
                const evalVal = ar.eval || row.adminEval || '';
                const noteVal = ar.note || row.adminNote || '';
                return `<tr>
                <td style="padding:6px; border:1px solid #e2e8f0;">${row.ip || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.vcpu || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ram || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.disk || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.cpuLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.diskLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(evalVal, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${noteVal || '-'}</td>
            </tr>`;
            }).join('');
            kafkaHtml += `<div class="diff-item"><strong>Bảng Linear (Existing System)</strong>
                <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                    <thead><tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">vCPU</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">Disk</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">CPU %</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM %</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">Disk %</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                    </tr></thead><tbody>${lRowsHtml}</tbody>
                </table></div>`;
        }
        if (lm.inputCCU || lm.sizingCCU) {
            kafkaHtml += `<div class="diff-item"><strong>CCU đầu vào:</strong> ${lm.inputCCU || '-'} &nbsp; <strong>CCU Định cỡ:</strong> ${lm.sizingCCU || '-'}</div>`;
        }
    }
    
    if (kafkaAdmin.eval || kafkaAdmin.note) {
        kafkaHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(kafkaAdmin.eval, null)} <span style="color:#6366f1; font-style:italic;">${kafkaAdmin.note || ''}</span></div>`;
    }
    
    if (kafkaHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#f0fdf4; border-radius:8px; border-left:4px solid #22c55e;">
            <h4 style="margin:0 0 10px 0; color:#166534;"><i class="fa-solid fa-stream"></i> Module Kafka</h4>${kafkaHtml}</div>`;
    }
    
    if (!html.trim()) {
        if (prevSnapshot) {
            return `<div class="vp-section"><div class="vp-no-changes"><i class="fa-solid fa-check-circle"></i><span>Không có thay đổi trong phần Định cỡ hệ thống</span></div></div>`;
        }
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-sliders" style="color: #6366f1;"></i> 
                Định cỡ hệ thống
            </div>
            ${html}
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

// ==================== AUTO-SAVE SYSTEM ====================

let autoSaveTimer = null;
let isAutoSaving = false;
let lastEditorUsername = localStorage.getItem('lastEditorUsername') || null;

/**
 * Khởi tạo hệ thống auto-save: lắng nghe sự kiện input/change trên toàn bộ form
 */
function initAutoSave() {
    // Debounce save sau 3 giây khi user ngừng typing
    const debounceSave = () => {
        if (!currentProjectId) return; // Chưa có project thì không save
        if (currentProjectStatus === 'HOAN_THANH') return; // Đã hoàn thành thì không save

        clearTimeout(autoSaveTimer);
        showAutoSaveStatus('pending');
        autoSaveTimer = setTimeout(() => {
            performAutoSave();
        }, 3000);
    };

    // Lắng nghe input/change trên project-detail-page
    const detailPage = document.getElementById('project-detail-page');
    if (detailPage) {
        detailPage.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea, select')) {
                debounceSave();
            }
        });
        detailPage.addEventListener('change', (e) => {
            if (e.target.matches('select')) {
                debounceSave();
            }
        });
    }
}

/**
 * Thực hiện auto-save: lưu tất cả dữ liệu hiện tại
 */
async function performAutoSave() {
    if (isAutoSaving || !currentProjectId) return;
    if (currentProjectStatus === 'HOAN_THANH') return;
    
    isAutoSaving = true;
    showAutoSaveStatus('saving');
    
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    try {
        // Kiểm tra xem có phải account mới edit không -> tạo revision cho account trước
        const currentUsername = user.username || user.displayName || 'unknown';
        await checkAndCreateRevisionForPreviousEditor(currentUsername);
        
        const headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        
        // Xác định section đang active để chỉ save section đó
        const activeSection = document.querySelector('.page-section.active');
        const activeSectionId = activeSection ? activeSection.id : null;
        
        let payload = {};
        
        if (activeSectionId === 'page-request') {
            const data = collectYeuCauBaiToan();
            // Nếu không phải admin thì bỏ adminReview
            if (role !== 'admin1' && role !== 'admin2') {
                delete data.adminReview;
            }
            payload.yeuCauBaiToanContent = JSON.stringify(data);
            // Cập nhật project name/devUnit
            if (data.projectName) {
                await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
                    method: 'PUT', headers,
                    body: JSON.stringify({ name: data.projectName, devUnit: data.devUnit, ownerName: data.contactPerson })
                }).catch(() => {});
            }
        } else if (activeSectionId === 'page-input') {
            const data = collectThongTinDauVao();
            if (role !== 'admin1' && role !== 'admin2') {
                data.inputRows = data.inputRows.map(r => { const c = Object.assign({}, r); delete c.adminEval; delete c.adminNote; return c; });
            }
            payload.thongTinDauVaoContent = JSON.stringify(data);
        } else if (activeSectionId === 'page-model') {
            const data = collectMoHinhHeThong();
            payload.moHinhHeThongContent = JSON.stringify(data);
        } else if (activeSectionId === 'page-sizing') {
            // Save sizing data for both user and admin
            if (typeof collectAllSizingData === 'function') {
                const sizingData = collectAllSizingData();
                payload.dinhCoHeThongContent = JSON.stringify(sizingData);
            }
        } else if (activeSectionId === 'page-summary') {
            const data = collectTongHop();
            payload.tongHopVaDeXuatContent = JSON.stringify(data);
        }
        
        if (Object.keys(payload).length > 0) {
            // Đảm bảo projectData tồn tại
            if (!currentProjectDataId) {
                payload.projectId = currentProjectId;
                const resp = await fetch(`${API_BASE_URL}/project-data`, {
                    method: 'POST', headers,
                    body: JSON.stringify(payload)
                });
                if (resp.ok) {
                    const result = await resp.json();
                    saveProjectDataIdToStorage(result.id);
                }
            } else {
                await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                    method: 'PUT', headers,
                    body: JSON.stringify(payload)
                });
            }
            
            // Auto-save: chỉ thay đổi trạng thái khi dự án ở trạng thái khởi tạo
            // Không thay đổi từ THAM_DINH/PHE_DUYET → SIZING qua auto-save
            // (việc đó chỉ nên xảy ra khi admin trả về qua evaluateSection)
            if (role === 'user' || !role || role === '') {
                if (!currentProjectStatus || currentProjectStatus === 'Draft') {
                    await updateProjectStatus('user_edit');
                }
            }
        }
        
        // Auto-save admin review data nếu là admin
        if (role === 'admin1' || role === 'admin2') {
            let reviewObj = null;
            let sectionKey = null;
            
            if (activeSectionId === 'page-request') {
                sectionKey = 'request';
                const data = collectYeuCauBaiToan();
                reviewObj = data.adminReview || {};
            } else if (activeSectionId === 'page-input') {
                sectionKey = 'input';
                const rows = Array.from(document.querySelectorAll('#input-table-body tr'));
                reviewObj = { rows: rows.map(row => ({ eval: row.querySelector('.admin-eval')?.value || '', note: row.querySelector('.admin-note')?.value || '' })) };
            } else if (activeSectionId === 'page-model') {
                sectionKey = 'model';
                reviewObj = collectMoHinhAdminReview();
            } else if (activeSectionId === 'page-sizing') {
                sectionKey = 'sizing';
                reviewObj = collectSizingAdminReviewData();
            } else if (activeSectionId === 'page-summary') {
                sectionKey = 'summary';
                reviewObj = {};
            }
            
            if (reviewObj && sectionKey) {
                await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ section: sectionKey, reviewJson: JSON.stringify(reviewObj) })
                }).catch(e => console.error('Auto-save admin review error:', e));
            }
        }
        
        showAutoSaveStatus('saved');
    } catch (error) {
        console.error('Auto-save error:', error);
        showAutoSaveStatus('error');
    } finally {
        isAutoSaving = false;
    }
}

/**
 * Kiểm tra và tạo revision cho editor trước đó khi account mới bắt đầu edit
 */
async function checkAndCreateRevisionForPreviousEditor(currentUsername) {
    const prevEditor = localStorage.getItem('lastEditorUsername');
    
    if (prevEditor && prevEditor !== currentUsername && currentProjectId) {
        // Account mới bắt đầu edit -> tạo revision cho account trước
        try {
            await fetch(`${API_BASE_URL}/project-revisions`, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
                body: JSON.stringify({
                    projectId: currentProjectId,
                    userId: prevEditor,
                    changeLog: `${prevEditor} - Lưu phiên làm việc`
                })
            });
            console.log(`✅ Đã tạo revision cho editor trước: ${prevEditor}`);
        } catch (e) {
            console.error('Lỗi tạo revision cho editor trước:', e);
        }
    }
    
    // Cập nhật editor hiện tại
    localStorage.setItem('lastEditorUsername', currentUsername);
}

/**
 * Hiển thị trạng thái auto-save
 */
function showAutoSaveStatus(status) {
    // Tìm tất cả các status div và cập nhật
    const statusDivs = ['save-status', 'input-save-status', 'model-save-status', 'summary-save-status'];
    const activeSection = document.querySelector('.page-section.active');
    
    let targetStatusId = null;
    if (activeSection) {
        if (activeSection.id === 'page-request') targetStatusId = 'save-status';
        else if (activeSection.id === 'page-input') targetStatusId = 'input-save-status';
        else if (activeSection.id === 'page-model') targetStatusId = 'model-save-status';
        else if (activeSection.id === 'page-sizing') targetStatusId = 'sizing-save-status';
        else if (activeSection.id === 'page-summary') targetStatusId = 'summary-save-status';
    }
    
    const statusDiv = targetStatusId ? document.getElementById(targetStatusId) : null;
    if (!statusDiv) return;
    
    switch (status) {
        case 'pending':
            statusDiv.innerHTML = '<span style="color: #999; font-size: 12px;"><i class="fa-solid fa-clock"></i> Chờ lưu...</span>';
            break;
        case 'saving':
            statusDiv.innerHTML = '<span style="color: #b8860b; font-size: 12px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tự động lưu...</span>';
            break;
        case 'saved':
            statusDiv.innerHTML = '<span style="color: green; font-size: 12px;"><i class="fa-solid fa-check"></i> Đã tự động lưu</span>';
            setTimeout(() => {
                if (statusDiv.innerHTML.includes('Đã tự động lưu')) {
                    statusDiv.innerHTML = '';
                }
            }, 5000);
            break;
        case 'error':
            statusDiv.innerHTML = '<span style="color: red; font-size: 12px;"><i class="fa-solid fa-exclamation-triangle"></i> Lỗi tự động lưu</span>';
            break;
    }
}

// ==================== CONNECTION INFO TABLE ====================

function createConnectionTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${stt}</td>
        <td><input type="text" class="input-full" value="${escapeHtml(data.source || '')}" placeholder="VD: 10.0.0.1"></td>
        <td><input type="text" class="input-full" value="${escapeHtml(data.destination || '')}" placeholder="VD: 10.0.0.2"></td>
        <td><input type="text" class="input-full" value="${escapeHtml(data.port || '')}" placeholder="VD: 8080"></td>
        <td>
            <select class="input-full">
                <option value="">-- Chọn --</option>
                <option value="TCP" ${data.protocol === 'TCP' ? 'selected' : ''}>TCP</option>
                <option value="UDP" ${data.protocol === 'UDP' ? 'selected' : ''}>UDP</option>
                <option value="HTTP" ${data.protocol === 'HTTP' ? 'selected' : ''}>HTTP</option>
                <option value="HTTPS" ${data.protocol === 'HTTPS' ? 'selected' : ''}>HTTPS</option>
                <option value="gRPC" ${data.protocol === 'gRPC' ? 'selected' : ''}>gRPC</option>
                <option value="WebSocket" ${data.protocol === 'WebSocket' ? 'selected' : ''}>WebSocket</option>
                <option value="Other" ${data.protocol === 'Other' ? 'selected' : ''}>Khác</option>
            </select>
        </td>
        <td><input type="text" class="input-full" value="${escapeHtml(data.description || '')}" placeholder="Mô tả kết nối..."></td>
        <td class="admin-cell">
            <select class="admin-eval admin-eval-select" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <textarea rows="1" class="input-full admin-note" placeholder="Nhận xét..." style="resize: vertical; min-height: 34px;">${data.adminNote || ''}</textarea>
        </td>
        <td class="text-center">
            <button class="btn-delete" onclick="removeConnectionRow(this)">✖</button>
        </td>
    `;
    return tr;
}

function addConnectionRow(data = {}) {
    const tbody = document.getElementById('connection-info-table-body');
    if (!tbody) return;
    const stt = tbody.rows.length + 1;
    const tr = createConnectionTableRow(stt, data);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

function removeConnectionRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    // Update STT
    Array.from(tbody.rows).forEach((r, idx) => {
        if (r.cells[0]) r.cells[0].innerText = idx + 1;
    });
}

function collectConnectionInfo() {
    const rows = [];
    document.querySelectorAll('#connection-info-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        rows.push({
            source: cells[1]?.querySelector('input')?.value || '',
            destination: cells[2]?.querySelector('input')?.value || '',
            port: cells[3]?.querySelector('input')?.value || '',
            protocol: cells[4]?.querySelector('select')?.value || '',
            description: cells[5]?.querySelector('input')?.value || '',
            adminEval: cells[6]?.querySelector('select')?.value || '',
            adminNote: cells[7]?.querySelector('textarea')?.value || ''
        });
    });
    return rows;
}

function loadConnectionInfo(data) {
    const tbody = document.getElementById('connection-info-table-body');
    if (!tbody || !data) return;
    tbody.innerHTML = '';
    
    if (Array.isArray(data) && data.length > 0) {
        data.forEach((row, idx) => {
            const tr = createConnectionTableRow(idx + 1, row);
            tbody.appendChild(tr);
        });
    }
}

