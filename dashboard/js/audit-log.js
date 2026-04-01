/**
 * audit-log.js - Lịch sử hoạt động (Audit Log)
 * Ghi nhận mọi thao tác quan trọng của admin trên dashboard.
 * Lưu trữ trong localStorage (tồn tại giữa các phiên), hiển thị bảng lọc theo thời gian & loại thao tác.
 * Tự động hook vào các action: tạo/sửa/xóa user, xóa/phê duyệt dự án, đăng nhập/đăng xuất.
 */

// ==================== AUDIT STORE ====================
const AuditLog = {
    _key: 'audit_log_data',      // Dùng prefix khác "dash_" để tránh bị SecureStorage.clear() xóa
    _maxEntries: 500,
    _storage: localStorage,       // Dùng localStorage để dữ liệu tồn tại giữa các phiên

    getAll() {
        try {
            const raw = this._storage.getItem(this._key);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    },

    add(entry) {
        const logs = this.getAll();
        const record = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            user: (typeof getCurrentUser === 'function' && getCurrentUser() ? getCurrentUser().username : null) || 'admin',
            ...entry
        };
        logs.unshift(record); // newest first
        if (logs.length > this._maxEntries) logs.length = this._maxEntries;
        try {
            this._storage.setItem(this._key, JSON.stringify(logs));
        } catch (e) {
            // localStorage full - xóa bớt entries cũ rồi thử lại
            logs.length = Math.floor(this._maxEntries / 2);
            try { this._storage.setItem(this._key, JSON.stringify(logs)); } catch (e2) { /* ignore */ }
        }
        return record;
    },

    clear() {
        this._storage.removeItem(this._key);
    },

    /**
     * Lọc logs theo bộ lọc
     * @param {Object} filters - { action, target, dateFrom, dateTo, search }
     */
    filter(filters = {}) {
        let logs = this.getAll();

        if (filters.action) {
            logs = logs.filter(l => l.action === filters.action);
        }
        if (filters.target) {
            logs = logs.filter(l => l.target === filters.target);
        }
        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            from.setHours(0, 0, 0, 0);
            logs = logs.filter(l => new Date(l.timestamp) >= from);
        }
        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            logs = logs.filter(l => new Date(l.timestamp) <= to);
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            logs = logs.filter(l =>
                (l.detail || '').toLowerCase().includes(q) ||
                (l.targetName || '').toLowerCase().includes(q) ||
                (l.user || '').toLowerCase().includes(q)
            );
        }

        return logs;
    }
};

// ==================== ACTION TYPES ====================
const AUDIT_ACTIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    APPROVE: 'APPROVE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    VIEW: 'VIEW'
};

const AUDIT_TARGETS = {
    USER: 'USER',
    PROJECT: 'PROJECT',
    SYSTEM: 'SYSTEM'
};

// ==================== HELPERS ====================
function getActionLabel(action) {
    const map = {
        'CREATE': 'Tạo mới',
        'UPDATE': 'Cập nhật',
        'DELETE': 'Xóa',
        'APPROVE': 'Phê duyệt',
        'LOGIN': 'Đăng nhập',
        'LOGOUT': 'Đăng xuất',
        'VIEW': 'Xem'
    };
    return map[action] || action;
}

function getActionBadge(action) {
    const map = {
        'CREATE': 'audit-create',
        'UPDATE': 'audit-update',
        'DELETE': 'audit-delete',
        'APPROVE': 'audit-approve',
        'LOGIN': 'audit-login',
        'LOGOUT': 'audit-logout',
        'VIEW': 'audit-view'
    };
    const cls = map[action] || 'audit-view';
    return `<span class="audit-badge ${cls}">${getActionLabel(action)}</span>`;
}

function getTargetLabel(target) {
    const map = { 'USER': 'User', 'PROJECT': 'Dự án', 'SYSTEM': 'Hệ thống' };
    return map[target] || target;
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

// ==================== LOG HELPER FUNCTIONS ====================
/**
 * Gọi sau khi thực hiện thao tác thành công
 */
function logAudit(action, target, targetName, detail) {
    AuditLog.add({ action, target, targetName, detail });
    // Nếu đang hiển thị trang audit log, refresh real-time
    const auditPage = document.getElementById('page-audit-log');
    if (auditPage && auditPage.style.display !== 'none') {
        filteredAuditLogs = AuditLog.getAll();
        renderAuditLogTable();
        renderAuditStats();
    }
}

// ==================== RENDERING ====================
let filteredAuditLogs = [];
const auditPaginator = new Paginator({
    containerId: 'pagination-audit',
    pageSize: 15,
    onPageChange: () => renderAuditLogTable()
});

function loadAuditLog() {
    filteredAuditLogs = AuditLog.getAll();
    auditPaginator.reset();
    renderAuditLogTable();
    renderAuditStats();
}

function renderAuditStats() {
    const logs = AuditLog.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logs.filter(l => new Date(l.timestamp) >= today);
    const creates = logs.filter(l => l.action === 'CREATE').length;
    const updates = logs.filter(l => l.action === 'UPDATE' || l.action === 'APPROVE').length;
    const deletes = logs.filter(l => l.action === 'DELETE').length;

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
                <span class="audit-stat-value">${creates}</span>
                <span class="audit-stat-label">Tạo mới</span>
            </div>
            <div class="audit-stat-item audit-stat-update">
                <span class="audit-stat-value">${updates}</span>
                <span class="audit-stat-label">Cập nhật</span>
            </div>
            <div class="audit-stat-item audit-stat-delete">
                <span class="audit-stat-value">${deletes}</span>
                <span class="audit-stat-label">Xóa</span>
            </div>
        `;
    }
}

function renderAuditLogTable() {
    const tbody = document.getElementById('tbody-audit-log');
    if (!tbody) return;

    if (!filteredAuditLogs || filteredAuditLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">
            <div class="empty-state"><span class="empty-icon">📝</span><span>Chưa có hoạt động nào được ghi nhận</span></div>
        </td></tr>`;
        const pgContainer = document.getElementById('pagination-audit');
        if (pgContainer) pgContainer.innerHTML = '';
        return;
    }

    const pageItems = auditPaginator.paginate(filteredAuditLogs);

    tbody.innerHTML = pageItems.map(log => `
        <tr>
            <td class="text-nowrap">${formatTimestamp(log.timestamp)}</td>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${(log.user || '?').charAt(0).toUpperCase()}</div>
                    <span>${escapeHtml(log.user)}</span>
                </div>
            </td>
            <td>${getActionBadge(log.action)}</td>
            <td><span class="target-badge target-${(log.target || '').toLowerCase()}">${getTargetLabel(log.target)}</span></td>
            <td><strong>${escapeHtml(log.targetName || '-')}</strong></td>
            <td>${escapeHtml(log.detail || '-')}</td>
        </tr>
    `).join('');
}

function filterAuditLog() {
    const action = document.getElementById('filter-audit-action').value;
    const target = document.getElementById('filter-audit-target').value;
    const dateFrom = document.getElementById('filter-audit-from').value;
    const dateTo = document.getElementById('filter-audit-to').value;
    const search = document.getElementById('search-audit').value;

    filteredAuditLogs = AuditLog.filter({ action, target, dateFrom, dateTo, search });
    auditPaginator.reset();
    renderAuditLogTable();
}

async function clearAuditLog() {
    const confirmed = await showConfirm(
        'Xóa lịch sử',
        'Bạn có chắc muốn xóa toàn bộ lịch sử hoạt động?<br>Thao tác này không thể hoàn tác.'
    );
    if (!confirmed) return;

    AuditLog.clear();
    loadAuditLog();
    showToast('Đã xóa lịch sử hoạt động', 'success');
}

function exportAuditLog() {
    const logs = filteredAuditLogs.length > 0 ? filteredAuditLogs : AuditLog.getAll();
    if (logs.length === 0) {
        showToast('Không có dữ liệu để xuất', 'warning');
        return;
    }

    // CSV Export
    const headers = ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Tên', 'Chi tiết'];
    const rows = logs.map(l => [
        formatTimestamp(l.timestamp),
        l.user || '',
        getActionLabel(l.action),
        getTargetLabel(l.target),
        l.targetName || '',
        l.detail || ''
    ]);

    let csv = '\uFEFF'; // BOM for UTF-8
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Đã xuất ${logs.length} bản ghi`, 'success');
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
