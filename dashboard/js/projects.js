/**
 * projects.js - Enhanced Quản lý Dự án
 * Features: Pagination, event delegation cho actions, debounced search
 */

let allProjects = [];
let filteredProjects = [];

// Paginator instance
const projectsPaginator = new Paginator({
    containerId: 'pagination-projects',
    pageSize: 10,
    onPageChange: () => renderProjectsTable(filteredProjects)
});

async function loadProjects() {
    try {
        allProjects = await fetchAPI('/projects');
        filteredProjects = [...allProjects];
        projectsPaginator.reset();
        renderProjectsTable(filteredProjects);
    } catch (error) {
        showToast('Lỗi tải danh sách dự án: ' + error.message, 'error');
    }
}

function renderProjectsTable(projects) {
    const tbody = document.getElementById('tbody-projects');
    if (!projects || projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><div class="empty-state"><span class="empty-icon">📁</span><span>Không có dự án nào</span></div></td></tr>';
        // Clear pagination
        const pgContainer = document.getElementById('pagination-projects');
        if (pgContainer) pgContainer.innerHTML = '';
        return;
    }

    // Phân trang
    const pageItems = projectsPaginator.paginate(projects);

    tbody.innerHTML = pageItems.map(p => `
        <tr>
            <td>${escapeHtml(p.name || '')}</td>
            <td>${escapeHtml(p.devUnit || '-')}</td>
            <td>${escapeHtml(p.ownerName || '-')}</td>
            <td>${getStatusBadge(p.status)}</td>
            <td class="text-center">${p.statusRound || 1}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td class="actions-cell">
                ${(p.status === 'THAM_DINH' || p.status === 'PHE_DUYET') ? `
                <button class="btn-icon btn-icon-approve" title="Phê duyệt nhanh"
                    data-action="approve-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}">D</button>` : ''}
                <button class="btn-icon btn-icon-delete" title="Xóa"
                    data-action="delete-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}">X</button>
            </td>
        </tr>
    `).join('');
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
        const project = allProjects.find(p => p.id === id || String(p.id) === String(id));
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
