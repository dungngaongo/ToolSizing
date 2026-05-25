/**
 * utils.js - Shared Utilities Module
 * Debounce, throttle, escapeHtml, formatDate, Paginator, sanitize, etc.
 * Loaded FIRST before all other scripts.
 */

// ==================== STRING UTILITIES ====================

/**
 * Escape HTML entities để chống XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, c => map[c]);
}

/**
 * Format date sang dd/MM/yyyy theo locale vi-VN
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return '-';
    }
}

/**
 * Tạo badge HTML cho trạng thái dự án
 */
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

/**
 * Sanitize input - loại bỏ ký tự nguy hiểm
 */
function sanitizeInput(str) {
    if (!str) return '';
    return String(str).replace(/[<>'"`;()\\/]/g, '').trim();
}

// ==================== TIMING UTILITIES ====================

/**
 * Debounce - delay thực thi function cho đến khi user ngừng action
 */
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle - giới hạn tần suất gọi function
 */
function throttle(fn, limit = 200) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            fn.apply(this, args);
        }
    };
}

// ==================== PAGINATION ====================

/**
 * Paginator class - Phân trang client-side có thể tái sử dụng
 * 
 * Usage:
 *   const pager = new Paginator({
 *       containerId: 'pagination-users',
 *       pageSize: 10,
 *       onPageChange: (page) => renderUsersTable(filteredUsers)
 *   });
 *   const pageItems = pager.paginate(allItems);
 */
class Paginator {
    constructor({ containerId, pageSize = 10, onPageChange }) {
        this.containerId = containerId;
        this.pageSize = pageSize;
        this.currentPage = 1;
        this.totalItems = 0;
        this.onPageChange = onPageChange;
        this._listenerAttached = false;
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    }

    get startIndex() {
        return (this.currentPage - 1) * this.pageSize;
    }

    get endIndex() {
        return Math.min(this.startIndex + this.pageSize, this.totalItems);
    }

    setPageSize(size) {
        this.pageSize = size;
        this.currentPage = 1;
        if (this.onPageChange) this.onPageChange(this.currentPage);
    }

    /**
     * Phân trang một mảng items, trả về items cho trang hiện tại
     */
    paginate(items) {
        this.totalItems = items.length;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        this.render();
        return items.slice(this.startIndex, this.endIndex);
    }

    goTo(page) {
        const p = Math.max(1, Math.min(page, this.totalPages));
        if (p !== this.currentPage) {
            this.currentPage = p;
            this.render();
            if (this.onPageChange) this.onPageChange(this.currentPage);
        }
    }

    reset() {
        this.currentPage = 1;
    }

    _attachListener() {
        if (this._listenerAttached) return;
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-pg-page]') || e.target.closest('[data-pg-action]');
            if (!btn || btn.disabled) return;
            
            if (btn.dataset.pgPage) {
                this.goTo(parseInt(btn.dataset.pgPage));
            } else if (btn.dataset.pgAction === 'prev') {
                this.goTo(this.currentPage - 1);
            } else if (btn.dataset.pgAction === 'next') {
                this.goTo(this.currentPage + 1);
            }
        });
        this._listenerAttached = true;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (this.totalItems <= this.pageSize) {
            container.innerHTML = '';
            return;
        }

        const pages = this.totalPages;
        let html = '<div class="pagination">';
        html += `<span class="pagination-info">Hiển thị ${this.startIndex + 1}-${this.endIndex} / ${this.totalItems}</span>`;
        html += '<div class="pagination-buttons">';

        // Prev
        html += `<button class="pg-btn" ${this.currentPage <= 1 ? 'disabled' : ''} data-pg-action="prev">&laquo;</button>`;

        // Page numbers (max 5 around current)
        const start = Math.max(1, this.currentPage - 2);
        const end = Math.min(pages, start + 4);

        if (start > 1) {
            html += '<button class="pg-btn" data-pg-page="1">1</button>';
            if (start > 2) html += '<span class="pagination-ellipsis">...</span>';
        }

        for (let i = start; i <= end; i++) {
            html += `<button class="pg-btn ${i === this.currentPage ? 'active' : ''}" data-pg-page="${i}">${i}</button>`;
        }

        if (end < pages) {
            if (end < pages - 1) html += '<span class="pagination-ellipsis">...</span>';
            html += `<button class="pg-btn" data-pg-page="${pages}">${pages}</button>`;
        }

        // Next
        html += `<button class="pg-btn" ${this.currentPage >= pages ? 'disabled' : ''} data-pg-action="next">&raquo;</button>`;

        html += '</div></div>';
        container.innerHTML = html;
        
        this._attachListener();
    }
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validate email format
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Đánh giá độ mạnh mật khẩu
 * @returns {Object} { score: 0-4, label: string, cls: string }
 */
function getPasswordStrength(password) {
    if (!password) return { score: 0, label: '', cls: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { label: 'Rất yếu', cls: 'strength-very-weak' },
        { label: 'Yếu', cls: 'strength-weak' },
        { label: 'Trung bình', cls: 'strength-medium' },
        { label: 'Mạnh', cls: 'strength-strong' },
        { label: 'Rất mạnh', cls: 'strength-very-strong' }
    ];
    const level = levels[Math.min(score, 4)];
    return { score, ...level };
}
