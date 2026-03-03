/**
 * projects.js - Quản lý Dự án
 */

let allProjects = [];

async function loadProjects() {
    try {
        allProjects = await fetchAPI('/projects');
        renderProjectsTable(allProjects);
    } catch (error) {
        showToast('Lỗi tải danh sách dự án: ' + error.message, 'error');
    }
}

function getStatusBadge(status) {
    const map = {
        'SIZING': { label: 'Sizing', cls: 'status-sizing' },
        'THAM_DINH': { label: 'Thẩm định', cls: 'status-thamdinh' },
        'PHE_DUYET': { label: 'Phê duyệt', cls: 'status-pheduyet' },
        'HOAN_THANH': { label: 'Hoàn thành', cls: 'status-hoanthanh' },
        'Draft': { label: 'Nháp', cls: 'status-draft' }
    };
    const info = map[status] || { label: status || 'N/A', cls: 'status-draft' };
    return `<span class="status-badge ${info.cls}">${info.label}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderProjectsTable(projects) {
    const tbody = document.getElementById('tbody-projects');
    if (!projects || projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fas fa-inbox"></i> Không có dự án nào</td></tr>';
        return;
    }
    tbody.innerHTML = projects.map(p => `
        <tr>
            <td><strong>${escapeHtml(p.name || '')}</strong></td>
            <td>${escapeHtml(p.devUnit || '-')}</td>
            <td>${escapeHtml(p.ownerName || '-')}</td>
            <td>${getStatusBadge(p.status)}</td>
            <td class="text-center">${p.statusRound || 1}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td class="actions-cell">
                ${(p.status === 'THAM_DINH' || p.status === 'PHE_DUYET') ? `
                <button class="btn-icon btn-icon-approve" title="Phê duyệt nhanh" onclick="quickApproveProject('${p.id}', '${escapeHtml(p.name)}')">
                    <i class="fas fa-check-double"></i>
                </button>` : ''}
                <button class="btn-icon btn-icon-delete" title="Xóa" onclick="deleteProject('${p.id}', '${escapeHtml(p.name)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterProjects() {
    const search = (document.getElementById('search-projects').value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-project-status').value;

    let filtered = allProjects;
    if (search) {
        filtered = filtered.filter(p =>
            (p.name || '').toLowerCase().includes(search) ||
            (p.devUnit || '').toLowerCase().includes(search) ||
            (p.ownerName || '').toLowerCase().includes(search)
        );
    }
    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    renderProjectsTable(filtered);
}

async function refreshProjects() {
    showLoading(true, 'Đang tải dự án...');
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
        // Update project status to HOAN_THANH
        const project = allProjects.find(p => p.id === id);
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
        await loadProjects();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Lỗi phê duyệt: ' + error.message, 'error');
    }
}
