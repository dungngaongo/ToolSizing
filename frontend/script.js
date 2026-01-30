// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu Project ID và ProjectData ID hiện tại
let currentProjectId = localStorage.getItem('currentProjectId') || null;
let currentProjectDataId = localStorage.getItem('currentProjectDataId') || null;

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
        document.querySelectorAll('.admin-eval, .admin-note').forEach(el => el.disabled = false);
        // Disable user-editable inputs inside the three sections
        document.querySelectorAll('#page-request input, #page-request textarea, #page-request select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note')) el.disabled = true;
        });
        document.querySelectorAll('#page-input input, #page-input textarea, #page-input select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note')) el.disabled = true;
        });
        document.querySelectorAll('#page-model input, #page-model textarea, #page-model select').forEach(el => {
            if (!el.classList.contains('admin-eval') && !el.classList.contains('admin-note')) el.disabled = true;
        });
    } else {
        // Regular user: admin fields readonly, user inputs editable
        document.querySelectorAll('.admin-eval, .admin-note').forEach(el => el.disabled = true);
        document.querySelectorAll('#page-request input, #page-request textarea, #page-request select').forEach(el => el.disabled = false);
        document.querySelectorAll('#page-input input, #page-input textarea, #page-input select').forEach(el => el.disabled = false);
        document.querySelectorAll('#page-model input, #page-model textarea, #page-model select').forEach(el => el.disabled = false);
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
        const statusText = getStatusText(project.status);
        
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
    switch (status?.toLowerCase()) {
        case 'draft': return 'draft';
        case 'pending': return 'pending';
        case 'approved': return 'approved';
        case 'rejected': return 'rejected';
        default: return 'draft';
    }
}

function getStatusText(status) {
    switch (status?.toLowerCase()) {
        case 'draft': return 'Nháp';
        case 'pending': return 'Chờ duyệt';
        case 'approved': return 'Đã duyệt';
        case 'rejected': return 'Từ chối';
        default: return 'Nháp';
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

async function openProject(projectId) {
    saveProjectIdToStorage(projectId);
    
    document.getElementById('project-list-page').style.display = 'none';
    document.getElementById('project-detail-page').style.display = 'flex';
    document.getElementById('btn-back-to-list').style.display = 'inline-block';
    
    currentProjectDataId = null;
    localStorage.removeItem('currentProjectDataId');
    
    await loadAllDataFromDB();
}

function showProjectList() {
    document.getElementById('project-list-page').style.display = 'block';
    document.getElementById('project-detail-page').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';
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
                status: 'Draft'
            })
        });
        
        if (response.ok) {
            const project = await response.json();
            saveProjectIdToStorage(project.id);
            
            document.getElementById('project-list-page').style.display = 'none';
            document.getElementById('project-detail-page').style.display = 'flex';
            document.getElementById('btn-back-to-list').style.display = 'inline-block';
            
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
}

function createArchTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${stt}</td>
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
            module: cells[1]?.querySelector('select')?.value || '',
            zoneMang: cells[2]?.querySelector('input')?.value || '',
            heDieuHanh: cells[3]?.querySelector('select')?.value || '',
            soLuongVIP: cells[4]?.querySelector('textarea')?.value || ''
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
}

function previewModelImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px;">`;
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

    if (!currentProjectId) {
        document.getElementById('project-list-page').style.display = 'block';
        document.getElementById('project-detail-page').style.display = 'none';
        document.getElementById('btn-back-to-list').style.display = 'none';
        await loadProjectList();
    } else {
        document.getElementById('project-list-page').style.display = 'none';
        document.getElementById('project-detail-page').style.display = 'flex';
        document.getElementById('btn-back-to-list').style.display = 'inline-block';
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
    }
});

