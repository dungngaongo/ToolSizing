// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu Project ID và ProjectData ID hiện tại
let currentProjectId = localStorage.getItem('currentProjectId') || null;
let currentProjectDataId = localStorage.getItem('currentProjectDataId') || null;

// Biến lưu danh sách dự án
let allProjects = [];

// ==================== AUTHENTICATION ====================

// Kiểm tra trạng thái đăng nhập
function checkAuthStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const displayName = localStorage.getItem('displayName');
    
    const userInfo = document.getElementById('user-info');
    const loginLink = document.getElementById('login-link');
    const userDisplayName = document.getElementById('user-display-name');
    
    if (isLoggedIn === 'true' && displayName) {
        // Đã đăng nhập - hiện user info, ẩn link đăng nhập
        if (userInfo) userInfo.style.display = 'flex';
        if (loginLink) loginLink.style.display = 'none';
        if (userDisplayName) userDisplayName.textContent = displayName;
    } else {
        // Chưa đăng nhập - ẩn user info, hiện link đăng nhập
        if (userInfo) userInfo.style.display = 'none';
        if (loginLink) loginLink.style.display = 'inline';
    }
}

// Đăng xuất
function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('rememberMe');
        clearProjectIds();
        
        // Chuyển về trang login
        window.location.href = 'login.html';
    }
}

// Lấy thông tin user hiện tại
function getCurrentUser() {
    return {
        username: localStorage.getItem('username'),
        displayName: localStorage.getItem('displayName'),
        role: localStorage.getItem('userRole'),
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true'
    };
}

// ==================== PROJECT MANAGEMENT ====================

// Hàm lưu Project ID vào localStorage
function saveProjectIdToStorage(id) {
    currentProjectId = id;
    localStorage.setItem('currentProjectId', id);
    console.log('Saved Project ID to localStorage:', id);
}

// Hàm lưu ProjectData ID vào localStorage
function saveProjectDataIdToStorage(id) {
    currentProjectDataId = id;
    localStorage.setItem('currentProjectDataId', id);
    console.log('Saved ProjectData ID to localStorage:', id);
}

// Hàm xóa IDs (khi muốn tạo mới)
function clearProjectIds() {
    currentProjectId = null;
    currentProjectDataId = null;
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectDataId');
    console.log('Cleared Project IDs');
}

// ==================== PROJECT LIST ====================

// Load danh sách dự án từ API
async function loadProjectList() {
    const tbody = document.getElementById('project-list-body');
    const loadingEl = document.getElementById('project-list-loading');
    const emptyEl = document.getElementById('project-list-empty');
    const tableWrapper = document.querySelector('.project-list-table-wrapper');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    
    try {
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

// Render danh sách dự án ra bảng
function renderProjectList(projects) {
    const tbody = document.getElementById('project-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    projects.forEach((project, index) => {
        const tr = document.createElement('tr');
        tr.onclick = () => openProject(project.id);
        
        // Format ngày
        const createdDate = project.createdAt ? formatDate(project.createdAt) : 'N/A';
        const modifiedDate = project.updatedAt ? formatDate(project.updatedAt) : 'N/A';
        
        // Status badge class
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

// Format ngày tháng
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

// Lấy class cho status badge
function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'draft': return 'draft';
        case 'pending': return 'pending';
        case 'approved': return 'approved';
        case 'rejected': return 'rejected';
        default: return 'draft';
    }
}

// Lấy text hiển thị cho status
function getStatusText(status) {
    switch (status?.toLowerCase()) {
        case 'draft': return 'Nháp';
        case 'pending': return 'Chờ duyệt';
        case 'approved': return 'Đã duyệt';
        case 'rejected': return 'Từ chối';
        default: return 'Nháp';
    }
}

// Lọc danh sách dự án
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

// Mở dự án để xem/chỉnh sửa
async function openProject(projectId) {
    saveProjectIdToStorage(projectId);
    
    // Ẩn trang danh sách, hiện trang chi tiết
    document.getElementById('project-list-page').style.display = 'none';
    document.getElementById('project-detail-page').style.display = 'flex';
    document.getElementById('btn-back-to-list').style.display = 'inline-block';
    
    // Reset projectDataId để load lại
    currentProjectDataId = null;
    localStorage.removeItem('currentProjectDataId');
    
    // Load dữ liệu dự án
    await loadAllDataFromDB();
}

// Quay về trang danh sách dự án
function showProjectList() {
    document.getElementById('project-list-page').style.display = 'block';
    document.getElementById('project-detail-page').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';
    
    // Reload danh sách để cập nhật thay đổi
    loadProjectList();
}

// Xóa dự án
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

// Tạo dự án mới
async function startNewProject() {
    const user = getCurrentUser();
    const projectName = 'Dự án mới - ' + new Date().toLocaleString('vi-VN');
    
    try {
        // Tạo project mới qua API
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                ownerName: user.displayName || user.username || 'Chưa xác định',
                status: 'Draft'
            })
        });
        
        if (response.ok) {
            const project = await response.json();
            saveProjectIdToStorage(project.id);
            
            // Ẩn trang danh sách, hiện trang chi tiết
            document.getElementById('project-list-page').style.display = 'none';
            document.getElementById('project-detail-page').style.display = 'flex';
            document.getElementById('btn-back-to-list').style.display = 'inline-block';
            
            // Reset form
            resetAllForms();
            
            // Load ProjectData (đã tự động tạo bởi backend)
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

// Reset tất cả form
function resetAllForms() {
    // Reset form Yêu cầu bài toán
    const pageRequest = document.getElementById('page-request');
    if (pageRequest) {
        pageRequest.querySelectorAll('input').forEach(input => input.value = '');
        pageRequest.querySelectorAll('textarea').forEach(ta => ta.value = '');
        pageRequest.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    }
    
    // Reset các bảng
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
    
    // Reset active tab về tab đầu tiên
    const menuLinks = document.querySelectorAll(".side-menu a");
    const pages = document.querySelectorAll(".page-section");
    
    menuLinks.forEach(l => l.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));
    
    if (menuLinks[0]) menuLinks[0].classList.add("active");
    const firstPage = document.getElementById('page-request');
    if (firstPage) firstPage.classList.add("active");
}

// ==================== PAGE LOAD ====================
document.addEventListener("DOMContentLoaded", async function () {
    console.log('Current Project ID from localStorage:', currentProjectId);
    console.log('Current ProjectData ID from localStorage:', currentProjectDataId);

    // --- KIỂM TRA ĐĂNG NHẬP ---
    checkAuthStatus();

    // --- KHỞI TẠO TRANG ---
    // Nếu không có project ID, hiển thị trang danh sách
    if (!currentProjectId) {
        document.getElementById('project-list-page').style.display = 'block';
        document.getElementById('project-detail-page').style.display = 'none';
        document.getElementById('btn-back-to-list').style.display = 'none';
        await loadProjectList();
    } else {
        // Nếu có project ID, hiển thị trang chi tiết
        document.getElementById('project-list-page').style.display = 'none';
        document.getElementById('project-detail-page').style.display = 'flex';
        document.getElementById('btn-back-to-list').style.display = 'inline-block';
        await loadAllDataFromDB();
    }

    // --- 1. XỬ LÝ CHUYỂN TAB (NAVIGATION) ---
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
                
                // Xử lý riêng cho trang Sizing (Load iframe)
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

    // --- 2. GÁN SỰ KIỆN CHO CÁC NÚT ---
    
    // Nút lưu Yêu cầu bài toán
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.onclick = saveYeuCauBaiToan;

    // Nút thêm dòng Thông tin đầu vào
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.onclick = addInputRow;

    // Nút lưu Thông tin đầu vào
    const saveInputDataBtn = document.getElementById('saveInputDataBtn');
    if (saveInputDataBtn) saveInputDataBtn.onclick = saveThongTinDauVao;

    // Nút thêm dòng Baseline
    const addBaselineBtn = document.getElementById('addBaselineRowBtn');
    if (addBaselineBtn) addBaselineBtn.onclick = addBaselineRow;

    // Nút thêm dòng Zone mạng
    const addArchBtn = document.getElementById('addArchRowBtn');
    if (addArchBtn) addArchBtn.onclick = addArchRow;

    // Nút lưu Mô hình hệ thống
    const saveModelBtn = document.getElementById('saveModelBtn');
    if (saveModelBtn) saveModelBtn.onclick = saveMoHinhHeThong;

    // Nút thêm dòng Tổng hợp
    const addSummaryBtn = document.getElementById('addSummaryRowBtn');
    if (addSummaryBtn) addSummaryBtn.onclick = addSummaryRow;

    // Nút lưu Tổng hợp
    const saveSummaryBtn = document.getElementById('saveSummaryBtn');
    if (saveSummaryBtn) saveSummaryBtn.onclick = saveTongHop;

    // Nút xuất báo cáo
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = exportToWord;
});

// ==================== LOAD DATA FROM DATABASE ====================
async function loadAllDataFromDB() {
    try {
        // Cập nhật iframe sizing với projectId
        const sizingIframe = document.getElementById('sizing-iframe');
        if (sizingIframe && currentProjectId) {
            const baseUrl = sizingIframe.src.split('?')[0];
            sizingIframe.src = `${baseUrl}?projectId=${currentProjectId}`;
        }
        
        // Lấy ProjectData theo projectId
        const response = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`);
        if (response.ok) {
            const projectData = await response.json();
            saveProjectDataIdToStorage(projectData.id);
            
            // Load từng phần
            if (projectData.yeuCauBaiToanContent) {
                loadYeuCauBaiToan(JSON.parse(projectData.yeuCauBaiToanContent));
            }
            if (projectData.thongTinDauVaoContent) {
                loadThongTinDauVao(JSON.parse(projectData.thongTinDauVaoContent));
            }
            if (projectData.moHinhHeThongContent) {
                loadMoHinhHeThong(JSON.parse(projectData.moHinhHeThongContent));
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

// ==================== YÊU CẦU BÀI TOÁN ====================

function loadYeuCauBaiToan(data) {
    const pageRequest = document.getElementById('page-request');
    const inputs = pageRequest.querySelectorAll('.form-grid input');
    
    if (inputs[0]) inputs[0].value = data.devUnit || '';
    if (inputs[1]) inputs[1].value = data.projectName || '';
    if (inputs[2]) inputs[2].value = data.sysFeature || '';
    if (inputs[3]) inputs[3].value = data.contactPerson || '';
    if (inputs[4]) inputs[4].value = data.sizingPurpose || '';
    if (inputs[5]) inputs[5].value = data.sizingBasis || '';
    if (inputs[6]) inputs[6].value = data.sizingRule || '';
    if (inputs[7]) inputs[7].value = data.importance || '';
    if (inputs[8]) inputs[8].value = data.deploymentTime || '';
    
    // Admin đánh giá và ghi chú
    const adminRating = document.getElementById('request-admin-rating');
    const adminComment = document.getElementById('request-admin-comment');
    if (adminRating) adminRating.value = data.adminRating || '';
    if (adminComment) adminComment.value = data.adminComment || '';
}

function collectYeuCauBaiToan() {
    const pageRequest = document.getElementById('page-request');
    const inputs = pageRequest.querySelectorAll('.form-grid input');
    
    return {
        devUnit: inputs[0]?.value || '',
        projectName: inputs[1]?.value || '',
        sysFeature: inputs[2]?.value || '',
        contactPerson: inputs[3]?.value || '',
        sizingPurpose: inputs[4]?.value || '',
        sizingBasis: inputs[5]?.value || '',
        sizingRule: inputs[6]?.value || '',
        importance: inputs[7]?.value || '',
        deploymentTime: inputs[8]?.value || '',
        adminRating: document.getElementById('request-admin-rating')?.value || '',
        adminComment: document.getElementById('request-admin-comment')?.value || ''
    };
}

async function saveYeuCauBaiToan() {
    const statusDiv = document.getElementById('save-status');
    const data = collectYeuCauBaiToan();
    
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        // Nếu chưa có Project, tạo mới
        if (!currentProjectId) {
            const projectName = data.projectName || 'Dự án mới ' + new Date().toLocaleString();
            const projectResponse = await fetch(`${API_BASE_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: projectName,
                    devUnit: data.devUnit || '',
                    ownerName: data.contactPerson || '',
                    status: 'Draft'
                })
            });
            
            if (projectResponse.ok) {
                const project = await projectResponse.json();
                saveProjectIdToStorage(project.id);
            } else {
                throw new Error('Không thể tạo project');
            }
        } else {
            // Cập nhật thông tin project nếu đã tồn tại
            await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.projectName,
                    devUnit: data.devUnit || '',
                    ownerName: data.contactPerson || ''
                })
            });
        }
        
        // Lưu hoặc cập nhật ProjectData
        const yeuCauContent = JSON.stringify(data);
        
        if (currentProjectDataId) {
            // Update
            await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    yeuCauBaiToanContent: yeuCauContent
                })
            });
        } else {
            // Create
            const response = await fetch(`${API_BASE_URL}/project-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProjectId,
                    yeuCauBaiToanContent: yeuCauContent
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                saveProjectDataIdToStorage(result.id);
            }
        }
        
        if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công! (Project ID: ${currentProjectId})</span>`;
        alert('Đã lưu thông tin Yêu cầu bài toán thành công!');
        
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi kết nối!</span>';
        alert('Lỗi: ' + error.message);
    }
}

// ==================== THÔNG TIN ĐẦU VÀO ====================

function loadThongTinDauVao(data) {
    // Load bảng thông tin đầu vào
    const tbody = document.getElementById('input-table-body');
    tbody.innerHTML = '';
    
    if (data.inputRows && data.inputRows.length > 0) {
        data.inputRows.forEach((row, index) => {
            const tr = createInputTableRow(index + 1, row);
            tbody.appendChild(tr);
        });
    }
    
    // Load bảng Baseline
    const baselineBody = document.getElementById('baseline-specs-body');
    baselineBody.innerHTML = '';
    
    if (data.baselineRows && data.baselineRows.length > 0) {
        data.baselineRows.forEach(row => {
            const tr = createBaselineTableRow(row);
            baselineBody.appendChild(tr);
        });
        calculateBaselineTotal();
    }
    
    // Load ảnh sở cứ - Đầu vào
    if (data.inputEvidenceImages && data.inputEvidenceImages.length > 0) {
        loadImagesToContainer('input-evidence', data.inputEvidenceImages);
    }
    
    // Load ảnh sở cứ - Tải hệ thống POC
    if (data.pocEvidenceImages && data.pocEvidenceImages.length > 0) {
        loadImagesToContainer('poc-evidence', data.pocEvidenceImages);
    }
    
    // Load ảnh sở cứ - Định cỡ
    if (data.sizingEvidenceImages && data.sizingEvidenceImages.length > 0) {
        loadImagesToContainer('sizing-evidence', data.sizingEvidenceImages);
    }
    
    // Load ảnh sở cứ giá trị định cỡ (evidence)
    if (data.evidenceImages && data.evidenceImages.length > 0) {
        loadImagesToContainer('evidence', data.evidenceImages);
    }
    
    // Admin đánh giá và ghi chú
    const adminRating = document.getElementById('input-admin-rating');
    const adminComment = document.getElementById('input-admin-comment');
    if (adminRating) adminRating.value = data.adminRating || '';
    if (adminComment) adminComment.value = data.adminComment || '';
}

function createInputTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${stt}</td>
        <td><textarea rows="3" placeholder="Ví dụ: Tổng số người dùng CCU" class="input-textarea">${data.dauVao || ''}</textarea></td>
        <td><textarea rows="3" class="input-textarea">${data.taiHeThongPOC || ''}</textarea></td>
        <td><textarea rows="3" class="input-textarea">${data.dinhCo || ''}</textarea></td>
        <td><input type="text" value="${data.module || ''}"></td>
        <td><textarea rows="3" class="input-textarea">${data.ghiChu || ''}</textarea></td>
        <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
    `;
    return tr;
}

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

function collectThongTinDauVao() {
    // Thu thập bảng đầu vào
    const inputRows = [];
    document.querySelectorAll('#input-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        inputRows.push({
            dauVao: cells[1]?.querySelector('textarea')?.value || '',
            taiHeThongPOC: cells[2]?.querySelector('textarea')?.value || '',
            dinhCo: cells[3]?.querySelector('textarea')?.value || '',
            module: cells[4]?.querySelector('input')?.value || '',
            ghiChu: cells[5]?.querySelector('textarea')?.value || ''
        });
    });
    
    // Thu thập bảng Baseline
    const baselineRows = [];
    document.querySelectorAll('#baseline-specs-body tr').forEach(row => {
        const moduleSelect = row.querySelector('select');
        const inputs = row.querySelectorAll('input');
        baselineRows.push({
            module: moduleSelect?.value || 'APP',
            ip: inputs[0]?.value || '',
            cpu: inputs[1]?.value || '',
            ram: parseFloat(inputs[2]?.value) || 0,
            cintRate2017: parseFloat(inputs[3]?.value) || 0
        });
    });
    
    // Thu thập ảnh từ các container
    const inputEvidenceImages = collectImagesFromContainer('input-evidence');
    const pocEvidenceImages = collectImagesFromContainer('poc-evidence');
    const sizingEvidenceImages = collectImagesFromContainer('sizing-evidence');
    const evidenceImages = collectImagesFromContainer('evidence');
    
    return {
        inputRows: inputRows,
        baselineRows: baselineRows,
        inputEvidenceImages: inputEvidenceImages,
        pocEvidenceImages: pocEvidenceImages,
        sizingEvidenceImages: sizingEvidenceImages,
        evidenceImages: evidenceImages,
        adminRating: document.getElementById('input-admin-rating')?.value || '',
        adminComment: document.getElementById('input-admin-comment')?.value || ''
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
        const content = JSON.stringify(data);
        
        await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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

function addBaselineRow() {
    const tbody = document.getElementById('baseline-specs-body');
    const tr = createBaselineTableRow();
    tbody.appendChild(tr);
}

// ==================== MÔ HÌNH HỆ THỐNG ====================

function loadMoHinhHeThong(data) {
    // Load luồng nghiệp vụ explanation
    const flowExplanation = document.getElementById('flow-explanation');
    if (flowExplanation) flowExplanation.value = data.flowExplanation || '';
    
    // Load bảng Zone mạng
    const archBody = document.getElementById('arch-table-body');
    archBody.innerHTML = '';
    
    if (data.archRows && data.archRows.length > 0) {
        data.archRows.forEach((row, index) => {
            const tr = createArchTableRow(index + 1, row);
            archBody.appendChild(tr);
        });
    }
    
    // Load ảnh mô hình vật lý
    if (data.physicalImages && data.physicalImages.length > 0) {
        loadImagesToContainer('physical', data.physicalImages);
    }
    
    // Load ảnh mô hình logic
    if (data.logicalImages && data.logicalImages.length > 0) {
        loadImagesToContainer('logical', data.logicalImages);
    }
    
    // Load ảnh luồng nghiệp vụ
    if (data.flowImages && data.flowImages.length > 0) {
        loadImagesToContainer('flow', data.flowImages);
    }
    
    // Admin đánh giá và ghi chú
    const adminRating = document.getElementById('model-admin-rating');
    const adminComment = document.getElementById('model-admin-comment');
    if (adminRating) adminRating.value = data.adminRating || '';
    if (adminComment) adminComment.value = data.adminComment || '';
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
        const moduleSelect = cells[1]?.querySelector('select');
        const zoneInput = cells[2]?.querySelector('input');
        const osSelect = cells[3]?.querySelector('select');
        const vipTextarea = cells[4]?.querySelector('textarea');
        
        archRows.push({
            module: moduleSelect?.value || '',
            zoneMang: zoneInput?.value || '',
            heDieuHanh: osSelect?.value || '',
            soLuongVIP: vipTextarea?.value || ''
        });
    });
    
    return {
        flowExplanation: document.getElementById('flow-explanation')?.value || '',
        archRows: archRows,
        physicalImages: collectImagesFromContainer('physical'),
        logicalImages: collectImagesFromContainer('logical'),
        flowImages: collectImagesFromContainer('flow'),
        adminRating: document.getElementById('model-admin-rating')?.value || '',
        adminComment: document.getElementById('model-admin-comment')?.value || ''
    };
}

async function saveMoHinhHeThong() {
    const statusDiv = document.getElementById('model-save-status');
    
    if (!currentProjectId) {
        alert('Vui lòng lưu "Yêu cầu bài toán" trước!');
        return;
    }
    
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectMoHinhHeThong();
        const content = JSON.stringify(data);
        
        await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                moHinhHeThongContent: content
            })
        });
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu mô hình thành công!</span>';
        alert('Đã lưu Mô hình hệ thống thành công!');
        
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi!</span>';
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
    
    return {
        summaryRows: summaryRows
    };
}

async function saveTongHop() {
    const statusDiv = document.getElementById('summary-save-status');
    
    if (!currentProjectId) {
        alert('Vui lòng lưu "Yêu cầu bài toán" trước!');
        return;
    }
    
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectTongHop();
        const content = JSON.stringify(data);
        
        await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tongHopVaDeXuatContent: content
            })
        });
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        alert('Đã lưu Tổng hợp và đề xuất thành công!');
        
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi!</span>';
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

function removeSummaryRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

function removeArchRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

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
            images.push({
                id: box.id,
                base64: img.src
            });
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
                'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
            const errorText = await response.text();
            throw new Error(errorText || 'Không thể xuất file');
        }
    } catch (e) {
        console.error('Export error:', e);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi xuất file!</span>';
        alert('Không thể xuất báo cáo: ' + e.message);
    }
}
