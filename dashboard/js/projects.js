/**
 * projects.js - Enhanced Quan ly Du an
 * Features: Pagination, event delegation, role-based filtering, assign admin1
 */

let allProjects = [];
let filteredProjects = [];
let admin1UsersList = []; // Cache danh sach admin1 users

// Paginator instance
const projectsPaginator = new Paginator({
    containerId: 'pagination-projects',
    pageSize: 10,
    onPageChange: () => renderProjectsTable(filteredProjects)
});

async function loadProjects() {
    try {
        const currentUser = getCurrentUser();

        // Neu la admin2, load danh sach admin1 users truoc de hien ten
        if (currentUser.role === 'admin2' && admin1UsersList.length === 0) {
            await loadAdmin1Users();
        }

        // Su dung API /my-projects de lay danh sach theo quyen
        allProjects = await fetchAPI('/projects/my-projects');
        filteredProjects = [...allProjects];
        projectsPaginator.reset();
        renderProjectsTable(filteredProjects);
    } catch (error) {
        showToast('Loi tai danh sach du an: ' + error.message, 'error');
    }
}

/**
 * Load danh sach user admin1 (de admin2 chi dinh tham dinh).
 */
async function loadAdmin1Users() {
    try {
        admin1UsersList = await fetchAPI('/projects/admin1-users');
    } catch (error) {
        console.error('Error loading admin1 users:', error);
        admin1UsersList = [];
    }
}

/**
 * Lay ten admin1 da duoc chi dinh tu danh sach cache.
 */
function getAssignedAdmin1Name(admin1Id) {
    if (!admin1Id) return null;
    const admin1 = admin1UsersList.find(u => u.id === admin1Id);
    return admin1 ? admin1.username : 'ID: ' + admin1Id.substring(0, 8);
}

function renderProjectsTable(projects) {
    const tbody = document.getElementById('tbody-projects');
    const currentUser = getCurrentUser();
    const isAdmin2 = currentUser.role === 'admin2';

    if (!projects || projects.length === 0) {
        const colspan = isAdmin2 ? 8 : 7;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-row"><div class="empty-state"><span class="empty-icon">📁</span><span>Khong co du an nao</span></div></td></tr>`;
        const pgContainer = document.getElementById('pagination-projects');
        if (pgContainer) pgContainer.innerHTML = '';
        return;
    }

    // Phan trang
    const pageItems = projectsPaginator.paginate(projects);

    tbody.innerHTML = pageItems.map(p => {
        const assignedName = getAssignedAdmin1Name(p.assignedAdmin1Id);
        const assignBadge = assignedName
            ? `<span class="badge badge-info" title="Nguoi tham dinh">${escapeHtml(assignedName)}</span>`
            : `<span class="badge badge-secondary">Chua chi dinh</span>`;

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
                    <button class="btn-icon btn-icon-assign" title="Chi dinh tham dinh"
                        data-action="assign-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}"
                        data-assigned="${p.assignedAdmin1Id || ''}">⇄</button>` : ''}
                    ${isAdmin2 ? `
                    <button class="btn-icon btn-icon-delete" title="Xoa"
                        data-action="delete-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}">X</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Cap nhat header bang cho admin2 (them cot Nguoi tham dinh)
    updateProjectTableHeader(isAdmin2);
}

/**
 * Cap nhat header bang du an dua vao role.
 */
function updateProjectTableHeader(isAdmin2) {
    const thead = document.querySelector('#table-projects thead tr');
    if (!thead) return;

    const expectedCols = isAdmin2 ? 8 : 7;
    if (thead.children.length === expectedCols) return; // Da dung

    if (isAdmin2 && thead.children.length === 7) {
        // Them cot "Nguoi tham dinh" truoc cot "Hanh dong"
        const th = document.createElement('th');
        th.textContent = 'Nguoi tham dinh';
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
            } else if (action === 'assign-project') {
                openAssignModal(id, name, btn.dataset.assigned);
            }
        });
    }
});

function filterProjects() {
    const search = (document.getElementById('search-projects').value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-project-status').value;

    filteredProjects = allProjects;
    if (search) {
        filteredProjects = filteredProjects.filter(p =>
            (p.name || '').toLowerCase().includes(search) ||
            (p.devUnit || '').toLowerCase().includes(search) ||
            (p.ownerName || '').toLowerCase().includes(search)
        );
    }
    if (statusFilter) {
        filteredProjects = filteredProjects.filter(p => p.status === statusFilter);
    }

    projectsPaginator.reset();
    renderProjectsTable(filteredProjects);
}

async function refreshProjects() {
    showLoading(true, 'Dang tai du an...');
    // Xoa cache de lay du lieu moi
    RequestCache.invalidate('projects');
    await loadProjects();
    showLoading(false);
    showToast('Da lam moi danh sach du an', 'success');
}

async function deleteProject(id, name) {
    const confirmed = await showConfirm(
        'Xoa Du An',
        `Ban co chac muon xoa du an <strong>${escapeHtml(name)}</strong>?<br>Tat ca du lieu lien quan se bi mat.`
    );
    if (!confirmed) return;

    try {
        await fetchAPI(`/projects/${id}`, { method: 'DELETE' });
        showToast(`Da xoa du an "${name}"`, 'success');
        if (typeof logAudit === 'function') logAudit('DELETE', 'PROJECT', name, `Xoa du an ID=${id}`);
        await loadProjects();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Loi xoa du an: ' + error.message, 'error');
    }
}

// ==================== ASSIGN ADMIN1 MODAL ====================

/**
 * Mo modal chi dinh admin1 tham dinh du an.
 */
function openAssignModal(projectId, projectName, currentAssigned) {
    const modal = document.getElementById('modal-assign-admin1');
    if (!modal) return;

    document.getElementById('assign-project-id').value = projectId;
    document.getElementById('assign-project-name').textContent = projectName;

    // Populate dropdown admin1 users
    const select = document.getElementById('assign-admin1-select');
    select.innerHTML = '<option value="">-- Khong chi dinh --</option>';

    admin1UsersList.forEach(u => {
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
 * Luu chi dinh admin1 cho du an.
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
            const admin1Name = admin1UsersList.find(u => u.id === admin1Id)?.username || admin1Id;
            showToast(`Da chi dinh "${admin1Name}" tham dinh du an "${projectName}"`, 'success');
            if (typeof logAudit === 'function') logAudit('ASSIGN', 'PROJECT', projectName, `Chi dinh admin1 "${admin1Name}" tham dinh`);
        } else {
            showToast(`Da bo chi dinh tham dinh cho du an "${projectName}"`, 'success');
            if (typeof logAudit === 'function') logAudit('UNASSIGN', 'PROJECT', projectName, 'Bo chi dinh admin1 tham dinh');
        }

        // Refresh danh sach
        RequestCache.invalidate('projects');
        await loadProjects();
    } catch (error) {
        showToast('Loi chi dinh: ' + error.message, 'error');
    }
}
