/**
 * projects.js - Enhanced Quản lý Dự án
 * Features: Pagination, event delegation, role-based filtering, assign admin1
 */

let allProjects = [];
let filteredProjects = [];
let admin1UsersList = []; // Cache danh sách admin1 users

function getProjectStore() {
    return window.DashboardProjectStore || null;
}

function setAllProjectsState(projects) {
    const safeProjects = Array.isArray(projects) ? projects : [];
    allProjects = safeProjects;
    filteredProjects = [...safeProjects];

    const store = getProjectStore();
    if (store && typeof store.setAllProjects === 'function') {
        store.setAllProjects(safeProjects);
    }

    return filteredProjects;
}

function setFilteredProjectsState(projects) {
    const safeProjects = Array.isArray(projects) ? projects : [];
    filteredProjects = safeProjects;

    const store = getProjectStore();
    if (store && typeof store.setFilteredProjects === 'function') {
        store.setFilteredProjects(safeProjects);
    }

    return filteredProjects;
}

function getAllProjectsState() {
    const store = getProjectStore();
    if (store && typeof store.getAllProjects === 'function') {
        const projects = store.getAllProjects();
        if (Array.isArray(projects)) {
            allProjects = projects;
            return projects;
        }
    }
    return allProjects;
}

function getFilteredProjectsState() {
    const store = getProjectStore();
    if (store && typeof store.getFilteredProjects === 'function') {
        const projects = store.getFilteredProjects();
        if (Array.isArray(projects)) {
            filteredProjects = projects;
            return projects;
        }
    }
    return filteredProjects;
}

function setAdmin1UsersState(users) {
    const safeUsers = Array.isArray(users) ? users : [];
    admin1UsersList = safeUsers;

    const store = getProjectStore();
    if (store && typeof store.setAdmin1Users === 'function') {
        store.setAdmin1Users(safeUsers);
    }

    return admin1UsersList;
}

function getAdmin1UsersState() {
    const store = getProjectStore();
    if (store && typeof store.getAdmin1Users === 'function') {
        const users = store.getAdmin1Users();
        if (Array.isArray(users)) {
            admin1UsersList = users;
            return users;
        }
    }
    return admin1UsersList;
}

function findProjectByIdState(projectId) {
    const store = getProjectStore();
    if (store && typeof store.findProjectById === 'function') {
        const project = store.findProjectById(projectId);
        if (project) return project;
    }
    return getAllProjectsState().find(p => p.id === projectId || String(p.id) === String(projectId));
}

function findAdmin1ByIdState(admin1Id) {
    const store = getProjectStore();
    if (store && typeof store.findAdmin1ById === 'function') {
        const user = store.findAdmin1ById(admin1Id);
        if (user) return user;
    }
    return getAdmin1UsersState().find(u => u.id === admin1Id);
}

// Paginator instance
const projectsPaginator = new Paginator({
    containerId: 'pagination-projects',
    pageSize: 10,
    onPageChange: () => renderProjectsTable(getFilteredProjectsState())
});

async function loadProjects() {
    try {
        const currentUser = getCurrentUser();
        
        // Nếu là admin2, load danh sách admin1 users trước để hiện tên
        if (currentUser.role === 'admin2' && getAdmin1UsersState().length === 0) {
            await loadAdmin1Users();
        }

        // Sử dụng API /my-projects để lấy danh sách theo quyền
        const projects = await fetchAPI('/projects/my-projects');
        setAllProjectsState(projects);
        projectsPaginator.reset();
        renderProjectsTable(getFilteredProjectsState());
    } catch (error) {
        showToast('Lỗi tải danh sách dự án: ' + error.message, 'error');
    }
}

/**
 * Load danh sách user admin1 (để admin2 chỉ định thẩm định).
 */
async function loadAdmin1Users() {
    try {
        const users = await fetchAPI('/projects/admin1-users');
        setAdmin1UsersState(users);
    } catch (error) {
        console.error('Error loading admin1 users:', error);
        setAdmin1UsersState([]);
    }
}

/**
 * Lấy tên admin1 đã được chỉ định từ danh sách cache.
 */
function getAssignedAdmin1Name(admin1Id) {
    if (!admin1Id) return null;
    const admin1 = findAdmin1ByIdState(admin1Id);
    return admin1 ? admin1.username : 'ID: ' + admin1Id.substring(0, 8);
}

function renderProjectsTable(projects) {
    const currentUser = getCurrentUser();
    const isAdmin2 = currentUser.role === 'admin2';

    if (window.DashboardProjectView && typeof window.DashboardProjectView.renderProjectsTable === 'function') {
        return window.DashboardProjectView.renderProjectsTable(projects, projectsPaginator, {
            isAdmin2,
            getAssignedAdmin1Name,
            updateProjectTableHeader
        });
    }

    const tbody = document.getElementById('tbody-projects');

    if (!projects || projects.length === 0) {
        const colspan = isAdmin2 ? 8 : 7;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-row"><div class="empty-state"><span class="empty-icon">📁</span><span>Không có dự án nào</span></div></td></tr>`;
        const pgContainer = document.getElementById('pagination-projects');
        if (pgContainer) pgContainer.innerHTML = '';
        return;
    }

    // Phân trang
    const pageItems = projectsPaginator.paginate(projects);

    tbody.innerHTML = pageItems.map(p => {
        const assignedName = getAssignedAdmin1Name(p.assignedAdmin1Id);
        const assignBadge = assignedName 
            ? `<span class="badge badge-info" title="Người thẩm định">${escapeHtml(assignedName)}</span>`
            : `<span class="badge badge-secondary">Chưa chỉ định</span>`;

        return `
            <tr>
                <td>${escapeHtml(p.name || '')}</td>
                <td>${escapeHtml(p.devUnit || '-')}</td>
                <td>${escapeHtml(p.ownerName || '-')}</td>
                <td>${getStatusBadge(p.status)}</td>
                <td class="text-center">${p.statusRound || 1}</td>
                <td>${formatDate(p.createdAt)}</td>
                ${isAdmin2 ? `<td>${assignBadge}</td>` : ''}
                <td class="actions-cell">
                    ${isAdmin2 ? `
                    <button class="btn-icon btn-icon-assign" title="Chỉ định thẩm định"
                        data-action="assign-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}" 
                        data-assigned="${p.assignedAdmin1Id || ''}">⇄</button>` : ''}
                    ${(p.status === 'THAM_DINH' || p.status === 'PHE_DUYET') ? `
                    <button class="btn-icon btn-icon-approve" title="Phê duyệt nhanh"
                        data-action="approve-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}">D</button>` : ''}
                    ${isAdmin2 ? `
                    <button class="btn-icon btn-icon-delete" title="Xóa"
                        data-action="delete-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}">X</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Cập nhật header bảng cho admin2 (thêm cột Người thẩm định)
    updateProjectTableHeader(isAdmin2);
}

/**
 * Cập nhật header bảng dự án dựa vào role.
 */
function updateProjectTableHeader(isAdmin2) {
    const thead = document.querySelector('#table-projects thead tr');
    if (!thead) return;
    
    const expectedCols = isAdmin2 ? 8 : 7;
    if (thead.children.length === expectedCols) return; // Đã đúng

    if (isAdmin2 && thead.children.length === 7) {
        // Thêm cột "Người thẩm định" trước cột "Hành động"
        const th = document.createElement('th');
        th.textContent = 'Người thẩm định';
        const actionTh = thead.lastElementChild;
        thead.insertBefore(th, actionTh);
    }
}

// ==================== EVENT DELEGATION cho project actions ====================
document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('table-projects');
    if (table) {
        table.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const name = btn.dataset.name;

            if (action === 'delete-project') {
                deleteProject(id, name);
            } else if (action === 'approve-project') {
                quickApproveProject(id, name);
            } else if (action === 'assign-project') {
                openAssignModal(id, name, btn.dataset.assigned);
            }
        });
    }
});

function filterProjects() {
    const search = (document.getElementById('search-projects').value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-project-status').value;

    let nextProjects = getAllProjectsState();
    if (search) {
        nextProjects = nextProjects.filter(p =>
            (p.name || '').toLowerCase().includes(search) ||
            (p.devUnit || '').toLowerCase().includes(search) ||
            (p.ownerName || '').toLowerCase().includes(search)
        );
    }
    if (statusFilter) {
        nextProjects = nextProjects.filter(p => p.status === statusFilter);
    }

    setFilteredProjectsState(nextProjects);

    projectsPaginator.reset();
    renderProjectsTable(getFilteredProjectsState());
}

async function refreshProjects() {
    showLoading(true, 'Đang tải dự án...');
    // Xóa cache để lấy dữ liệu mới
    RequestCache.invalidate('projects');
    await loadProjects();
    showLoading(false);
    showToast('Đã làm mới danh sách dự án', 'success');
}

async function deleteProject(id, name) {
    const confirmed = await showConfirm(
        'Xóa Dự án',
        `Bạn có chắc muốn xóa dự án <strong>${escapeHtml(name)}</strong>?<br>Tất cả dữ liệu liên quan sẽ bị mất.`
    );
    if (!confirmed) return;

    try {
        await fetchAPI(`/projects/${id}`, { method: 'DELETE' });
        showToast(`Đã xóa dự án "${name}"`, 'success');
        if (typeof logAudit === 'function') logAudit('DELETE', 'PROJECT', name, `Xóa dự án ID=${id}`);
        await loadProjects();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Lỗi xóa dự án: ' + error.message, 'error');
    }
}

async function quickApproveProject(id, name) {
    const confirmed = await showConfirm(
        'Phê duyệt Dự án',
        `Bạn có chắc muốn phê duyệt dự án <strong>${escapeHtml(name)}</strong>?<br>Dự án sẽ chuyển sang trạng thái <strong>Hoàn thành</strong>.`
    );
    if (!confirmed) return;

    try {
        const project = findProjectByIdState(id);
        if (!project) throw new Error('Không tìm thấy dự án');

        await fetchAPI(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: project.name,
                devUnit: project.devUnit,
                ownerName: project.ownerName,
                status: 'HOAN_THANH',
                statusRound: project.statusRound
            })
        });
        showToast(`Đã phê duyệt dự án "${name}"`, 'success');
        if (typeof logAudit === 'function') logAudit('APPROVE', 'PROJECT', name, `Phê duyệt dự án → HOAN_THANH`);
        await loadProjects();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Lỗi phê duyệt: ' + error.message, 'error');
    }
}

// ==================== ASSIGN ADMIN1 MODAL ====================

/**
 * Mở modal chỉ định admin1 thẩm định dự án.
 */
function openAssignModal(projectId, projectName, currentAssigned) {
    const modal = document.getElementById('modal-assign-admin1');
    if (!modal) return;

    document.getElementById('assign-project-id').value = projectId;
    document.getElementById('assign-project-name').textContent = projectName;

    // Populate dropdown admin1 users
    const select = document.getElementById('assign-admin1-select');
    select.innerHTML = '<option value="">-- Không chỉ định --</option>';
    
    getAdmin1UsersState().forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.username} (${u.email || ''})`;
        if (u.id === currentAssigned) opt.selected = true;
        select.appendChild(opt);
    });

    modal.style.display = 'flex';
    setTimeout(() => select.focus(), 100);
}

function closeAssignModal() {
    const modal = document.getElementById('modal-assign-admin1');
    if (modal) modal.style.display = 'none';
}

/**
 * Lưu chỉ định admin1 cho dự án.
 */
async function saveAssignAdmin1() {
    const projectId = document.getElementById('assign-project-id').value;
    const admin1Id = document.getElementById('assign-admin1-select').value;
    const projectName = document.getElementById('assign-project-name').textContent;

    try {
        await fetchAPI(`/projects/${projectId}/assign-reviewer`, {
            method: 'PUT',
            body: JSON.stringify({ admin1Id: admin1Id || null })
        });

        closeAssignModal();

        if (admin1Id) {
            const admin1Name = findAdmin1ByIdState(admin1Id)?.username || admin1Id;
            showToast(`Đã chỉ định "${admin1Name}" thẩm định dự án "${projectName}"`, 'success');
            if (typeof logAudit === 'function') logAudit('ASSIGN', 'PROJECT', projectName, `Chỉ định admin1 "${admin1Name}" thẩm định`);
        } else {
            showToast(`Đã bỏ chỉ định thẩm định cho dự án "${projectName}"`, 'success');
            if (typeof logAudit === 'function') logAudit('UNASSIGN', 'PROJECT', projectName, `Bỏ chỉ định admin1 thẩm định`);
        }

        // Refresh danh sách
        RequestCache.invalidate('projects');
        await loadProjects();
    } catch (error) {
        showToast('Lỗi chỉ định: ' + error.message, 'error');
    }
}
