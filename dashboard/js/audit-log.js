/**
 * audit-log.js - Lịch sử hoạt động
 * Hiển thị activity logs từ backend.
 */

const ACTIVITY_ACTIONS = {
    SAVE: 'Lưu',
    EVALUATE: 'Đánh giá',
    CREATE: 'Tạo mới',
    UPDATE: 'Cập nhật',
    DELETE: 'Xóa',
    ASSIGN: 'Chỉ định',
    UNASSIGN: 'Bỏ chỉ định',
    LOGIN: 'Đăng nhập',
    LOGOUT: 'Đăng xuất',
    VIEW: 'Xem'
};

const ACTIVITY_TARGETS = {
    USER: 'User',
    PROJECT: 'Dự án',
    SYSTEM: 'Hệ thống'
};

const ActivityLogApi = {
    async getAll() {
        const logs = await fetchAPI('/activity-logs', { useCache: false });
        return Array.isArray(logs) ? logs : [];
    },

    async clearAll() {
        await fetchAPI('/activity-logs', { method: 'DELETE' });
    }
};

function getActionLabel(action) {
    return ACTIVITY_ACTIONS[action] || action || '-';
}

function getActionBadge(action) {
    const classMap = {
        SAVE: 'audit-create',
        EVALUATE: 'audit-approve',
        CREATE: 'audit-create',
        UPDATE: 'audit-update',
        DELETE: 'audit-delete',
        ASSIGN: 'audit-update',
        UNASSIGN: 'audit-update',
        LOGIN: 'audit-login',
        LOGOUT: 'audit-logout',
        VIEW: 'audit-view'
    };
    const cls = classMap[action] || 'audit-view';
    return `<span class="audit-badge ${cls}">${getActionLabel(action)}</span>`;
}

function getTargetLabel(target) {
    return ACTIVITY_TARGETS[target] || target || '-';
}

function formatTimestamp(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function getLogText(log) {
    return [log.detail, log.targetName, log.user, log.action, log.target]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

let allActivityLogs = [];
let filteredActivityLogs = [];
const auditPaginator = new Paginator({
    containerId: 'pagination-audit',
    pageSize: 15,
    onPageChange: () => renderAuditLogTable()
});

async function loadAuditLog() {
    try {
        allActivityLogs = await ActivityLogApi.getAll();
        filteredActivityLogs = [...allActivityLogs];
        auditPaginator.reset();
        renderAuditLogTable();
        renderAuditStats();
    } catch (error) {
        console.error('Load activity log error:', error);
        const tbody = document.getElementById('tbody-audit-log');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Không tải được lịch sử hoạt động</td></tr>';
        }
    }
}

function renderAuditStats() {
    const logs = allActivityLogs;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logs.filter(l => new Date(l.createdAt || l.timestamp) >= today);
    const saves = logs.filter(l => l.action === 'SAVE').length;
    const evaluates = logs.filter(l => l.action === 'EVALUATE').length;
    const updates = logs.filter(l => l.action === 'UPDATE').length;

    const statsEl = document.getElementById('audit-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="audit-stat-item">
                <span class="audit-stat-value">${logs.length}</span>
                <span class="audit-stat-label">Tổng hoạt động</span>
            </div>
            <div class="audit-stat-item">
                <span class="audit-stat-value">${todayLogs.length}</span>
                <span class="audit-stat-label">Hôm nay</span>
            </div>
            <div class="audit-stat-item audit-stat-create">
                <span class="audit-stat-value">${saves}</span>
                <span class="audit-stat-label">Lưu</span>
            </div>
            <div class="audit-stat-item audit-stat-update">
                <span class="audit-stat-value">${evaluates}</span>
                <span class="audit-stat-label">Đánh giá</span>
            </div>
            <div class="audit-stat-item audit-stat-delete">
                <span class="audit-stat-value">${updates}</span>
                <span class="audit-stat-label">Cập nhật</span>
            </div>
        `;
    }
}

function renderAuditLogTable() {
    const tbody = document.getElementById('tbody-audit-log');
    if (!tbody) return;

    if (!filteredActivityLogs || filteredActivityLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">
            <div class="empty-state"><span class="empty-icon">📝</span><span>Chưa có hoạt động nào được ghi nhận</span></div>
        </td></tr>`;
        const pgContainer = document.getElementById('pagination-audit');
        if (pgContainer) pgContainer.innerHTML = '';
        return;
    }

    const pageItems = auditPaginator.paginate(filteredActivityLogs);
    tbody.innerHTML = pageItems.map(log => `
        <tr>
            <td class="text-nowrap">${formatTimestamp(log.createdAt || log.timestamp)}</td>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${(log.user || '?').charAt(0).toUpperCase()}</div>
                    <span>${escapeHtml(log.user || '-')}</span>
                </div>
            </td>
            <td>${getActionBadge(log.action)}</td>
            <td><span class="target-badge target-${String(log.target || '').toLowerCase()}">${getTargetLabel(log.target)}</span></td>
            <td><strong>${escapeHtml(log.targetName || '-')}</strong></td>
            <td>${escapeHtml(log.detail || '-')}</td>
        </tr>
    `).join('');
}

function filterAuditLog() {
    const action = document.getElementById('filter-audit-action')?.value || '';
    const target = document.getElementById('filter-audit-target')?.value || '';
    const dateFrom = document.getElementById('filter-audit-from')?.value || '';
    const dateTo = document.getElementById('filter-audit-to')?.value || '';
    const search = (document.getElementById('search-audit')?.value || '').trim().toLowerCase();

    filteredActivityLogs = allActivityLogs.filter(log => {
        if (action && log.action !== action) return false;
        if (target && log.target !== target) return false;
        if (dateFrom) {
            const from = new Date(dateFrom);
            from.setHours(0, 0, 0, 0);
            if (new Date(log.createdAt || log.timestamp) < from) return false;
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(log.createdAt || log.timestamp) > to) return false;
        }
        if (search) {
            return getLogText(log).includes(search);
        }
        return true;
    });

    auditPaginator.reset();
    renderAuditLogTable();
}

async function clearAuditLog() {
    const confirmed = await showConfirm(
        'Xóa lịch sử',
        'Bạn có chắc muốn xóa toàn bộ lịch sử hoạt động?<br>Thao tác này không thể hoàn tác.'
    );
    if (!confirmed) return;

    try {
        await ActivityLogApi.clearAll();
        await loadAuditLog();
        showToast('Đã xóa lịch sử hoạt động', 'success');
    } catch (error) {
        showToast('Lỗi xóa lịch sử: ' + error.message, 'error');
    }
}

function exportAuditLog() {
    const logs = filteredActivityLogs.length > 0 ? filteredActivityLogs : allActivityLogs;
    if (logs.length === 0) {
        showToast('Không có dữ liệu để xuất', 'warning');
        return;
    }

    const headers = ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Tên', 'Chi tiết'];
    const rows = logs.map(l => [
        formatTimestamp(l.createdAt || l.timestamp),
        l.user || '',
        getActionLabel(l.action),
        getTargetLabel(l.target),
        l.targetName || '',
        l.detail || ''
    ]);

    let csv = '\uFEFF';
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Đã xuất ${logs.length} bản ghi`, 'success');
}

// Backward compatibility: các script cũ có thể còn gọi logAudit nhưng giờ không ghi localStorage nữa.
function logAudit() {
    return null;
}

// ==================== SETUP FILTER LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    const searchAudit = document.getElementById('search-audit');
    if (searchAudit) searchAudit.addEventListener('input', debounce(filterAuditLog, 300));

    ['filter-audit-action', 'filter-audit-target', 'filter-audit-from', 'filter-audit-to'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', filterAuditLog);
    });
});
