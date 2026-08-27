const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu Project ID và ProjectData ID hiện tại
let currentProjectId = localStorage.getItem('currentProjectId') || null;
let currentProjectDataId = localStorage.getItem('currentProjectDataId') || null;

// Biến lưu trạng thái dự án hiện tại
let currentProjectStatus = null;
let currentProjectStatusRound = 1;
let currentProjectMeta = createEmptyProjectMeta();
let workflowModalRuntime = null;

// Biến lưu danh sách dự án
let allProjects = [];

// ==================== HISTORY API / URL ROUTING ====================
// Map sectionId <-> URL slug
const TAB_SLUG_MAP = {
    'page-request': 'request',
    'page-input': 'input',
    'page-model': 'model',
    'page-sizing': 'sizing',
    'page-summary': 'summary'
};
const SLUG_TAB_MAP = Object.fromEntries(
    Object.entries(TAB_SLUG_MAP).map(([k, v]) => [v, k])
);
const TAB_FLOW_ORDER = ['page-request', 'page-input', 'page-model', 'page-sizing', 'page-summary'];
const SECTION_DISPLAY_NAMES = {
    'page-request': 'Yêu cầu bài toán',
    'page-input': 'Thông tin đầu vào',
    'page-model': 'Mô hình hệ thống',
    'page-sizing': 'Định cỡ hệ thống',
    'page-summary': 'Tổng hợp và đề xuất'
};
const adminReviewDirtySections = new Set();

/**
 * Tạo hash URL từ trạng thái hiện tại
 * @param {'projects'|'project'} view
 * @param {string|null} projectId
 * @param {string|null} tab - sectionId (vd 'page-request')
 */
function buildAppHash(view, projectId, tab) {
    if (view === 'project' && projectId) {
        const slug = TAB_SLUG_MAP[tab] || tab || 'request';
        return `#/project/${projectId}/${slug}`;
    }
    return '#/projects';
}

function renderSummaryDiffLegacy(snapshot, prevSnapshot) {
    const content = snapshot.tongHopVaDeXuatContent;
    const hasAdminReview = snapshot.tongHopAdminReview;
    if (!content && !hasAdminReview) {
        return '<p class="u-text-muted u-text-center u-p-40">KhÃ´ng cÃ³ dá»¯ liá»‡u cho pháº§n nÃ y</p>';
    }

    let data = { summaryRows: [] };
    if (content) {
        try {
            data = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (e) {
            return '<p class="u-text-danger">Lá»—i parse dá»¯ liá»‡u</p>';
        }
    }

    let prevData = { summaryRows: [] };
    if (prevSnapshot && prevSnapshot.tongHopVaDeXuatContent) {
        try {
            prevData = typeof prevSnapshot.tongHopVaDeXuatContent === 'string'
                ? JSON.parse(prevSnapshot.tongHopVaDeXuatContent)
                : prevSnapshot.tongHopVaDeXuatContent;
        } catch (e) { /* ignore */ }
    }

    let adminReview = {};
    if (snapshot.tongHopAdminReview) {
        try {
            adminReview = typeof snapshot.tongHopAdminReview === 'string'
                ? JSON.parse(snapshot.tongHopAdminReview)
                : snapshot.tongHopAdminReview;
        } catch (e) { /* ignore */ }
    }

    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.tongHopAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.tongHopAdminReview === 'string'
                ? JSON.parse(prevSnapshot.tongHopAdminReview)
                : prevSnapshot.tongHopAdminReview;
        } catch (e) { /* ignore */ }
    }

    const adminReviewChanged =
        (adminReview.eval || '') !== (prevAdminReview.eval || '') ||
        (adminReview.note || '') !== (prevAdminReview.note || '');

    const rows = Array.isArray(data.summaryRows) ? data.summaryRows : [];
    const prevRows = prevData.summaryRows || [];
    let changedRowsHtml = [];
    let changeCount = 0;

    rows.forEach((row, index) => {
        const prevRow = prevRows[index] || {};
        const fields = ['moduleType', 'moduleName', 'module', 'cauHinh', 'soLuong', 'ghiChu'];

        let hasChange = false;
        for (const f of fields) {
            if ((row[f] || '').toString().trim() !== (prevRow[f] || '').toString().trim()) {
                hasChange = true;
            }
        }

        const isNewRow = index >= prevRows.length;
        if (!hasChange && !isNewRow) return;

        changeCount++;
        const rowClass = isNewRow ? 'diff-row-added' : '';
        const rowModuleType = row.moduleType || row.module || '';
        const prevModuleType = prevRow.moduleType || prevRow.module || '';
        const rowModuleName = row.moduleName || '';
        const prevModuleName = prevRow.moduleName || '';
        const rowCauHinh = row.cauHinh || row.volume || '';
        const prevCauHinh = prevRow.cauHinh || prevRow.volume || '';

        changedRowsHtml.push(`
            <tr class="${rowClass}">
                <td class="diff-cell diff-cell-center">${index + 1}</td>
                <td class="diff-cell">${renderTextDiff(rowModuleType, prevModuleType)}</td>
                <td class="diff-cell">${renderTextDiff(rowModuleName, prevModuleName)}</td>
                <td class="diff-cell">${renderTextDiff(rowCauHinh, prevCauHinh)}</td>
                <td class="diff-cell diff-cell-center">${renderTextDiff(row.soLuong, prevRow.soLuong)}</td>
                <td class="diff-cell">${renderTextDiff(row.ghiChu, prevRow.ghiChu)}</td>
            </tr>
        `);
    });

    if (prevRows.length > rows.length) {
        for (let i = rows.length; i < prevRows.length; i++) {
            const prevRow = prevRows[i];
            const prevModuleType = prevRow.moduleType || prevRow.module || '-';
            const prevModuleName = prevRow.moduleName || '-';
            const prevCauHinh = prevRow.cauHinh || prevRow.volume || '-';
            changeCount++;
            changedRowsHtml.push(`
                <tr class="diff-row-removed">
                    <td class="diff-cell diff-cell-center">${i + 1}</td>
                    <td class="diff-cell"><div class="diff-removed">${prevModuleType}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevModuleName}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevCauHinh}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.soLuong || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
                </tr>
            `);
        }
    }

    const adminReviewHtml = (adminReviewChanged || adminReview.eval || adminReview.note)
        ? `
            <div class="admin-review-panel">
                <div class="admin-review-title">Admin đánh giá</div>
                <div><strong>Đánh giá:</strong> ${prevSnapshot ? renderEvalDiff(adminReview.eval || '', prevAdminReview.eval || '') : renderEvalDiff(adminReview.eval || '', null)}</div>
                <div class="admin-review-note-row"><strong>Ghi chú:</strong> ${prevSnapshot ? renderTextDiff(adminReview.note || '', prevAdminReview.note || '') : (adminReview.note || '-')}</div>
            </div>
        `
        : '';

    if (changedRowsHtml.length === 0 && !adminReviewHtml && prevSnapshot) {
        return `
            <div class="vp-section">
                <div class="vp-no-changes">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>KhÃ´ng cÃ³ thay Ä‘á»•i trong pháº§n Tá»•ng há»£p</span>
                </div>
            </div>
        `;
    }

    if (changedRowsHtml.length === 0 && adminReviewHtml) {
        return `
            <div class="vp-section">
                <div class="vp-section-title">
                    <i class="fa-solid fa-code-compare u-text-success"></i>
                    Thay Ä‘á»•i trong Tá»•ng há»£p Ä‘á» xuáº¥t
                </div>
                ${adminReviewHtml}
            </div>
        `;
    }

    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare u-text-success"></i>
                Thay Ä‘á»•i trong Tá»•ng há»£p Ä‘á» xuáº¥t
                <span class="diff-count">(${changeCount} dÃ²ng thay Ä‘á»•i)</span>
            </div>
            <table class="diff-table">
                <thead>
                    <tr class="diff-row-muted">
                        <th class="diff-cell">STT</th>
                        <th class="diff-cell">Loáº¡i module</th>
                        <th class="diff-cell">TÃªn module</th>
                        <th class="diff-cell">Cáº¥u hÃ¬nh</th>
                        <th class="diff-cell">Sá»‘ lÆ°á»£ng</th>
                        <th class="diff-cell">Ghi chÃº</th>
                    </tr>
                </thead>
                <tbody>${changedRowsHtml.join('')}</tbody>
            </table>
            ${adminReviewHtml}
        </div>
    `;
}

/**
 * Parse hash URL thành trạng thái app
 */
function parseAppHash(hash) {
    const parts = (hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] === 'project' && parts[1]) {
        return {
            view: 'project',
            projectId: parts[1],
            tab: SLUG_TAB_MAP[parts[2]] || 'page-request'
        };
    }
    return { view: 'projects', projectId: null, tab: null };
}

/**
 * Push một trạng thái mới vào history (tạo entry mới cho back/forward)
 */
function pushAppState(view, projectId, tab) {
    const hash = buildAppHash(view, projectId, tab);
    const state = { view, projectId: projectId || null, tab: tab || null };
    history.pushState(state, '', hash);
}

/**
 * Replace trạng thái hiện tại (không tạo entry mới)
 */
function replaceAppState(view, projectId, tab) {
    const hash = buildAppHash(view, projectId, tab);
    const state = { view, projectId: projectId || null, tab: tab || null };
    history.replaceState(state, '', hash);
}

// Flag ngăn popstate handler gọi lại pushState
let _historyNavigation = false;

/**
 * Xử lý nút Back/Forward của trình duyệt
 * Khi người dùng bấm Back/Forward, trình duyệt fire event 'popstate'
 * Ta đọc state đã lưu để khôi phục giao diện tương ứng
 */
window.addEventListener('popstate', async function (event) {
    const state = event.state || parseAppHash(location.hash);
    _historyNavigation = true;
    try {
        if (state && state.view === 'project' && state.projectId) {
            await openProject(state.projectId, { tab: state.tab, skipPushState: true });
        } else {
            showProjectList({ skipPushState: true });
        }
    } finally {
        _historyNavigation = false;
    }
});

// ==================== LOGGER WRAPPER ====================
// Bật DEBUG_MODE = true để hiển thị log debug trên console
const Logger = {
    DEBUG_MODE: false,
    debug: function (...args) { if (this.DEBUG_MODE) console.log('[DEBUG]', ...args); },
    info: function (...args) { console.log('[INFO]', ...args); },
    warn: function (...args) { console.warn('[WARN]', ...args); },
    error: function (...args) { console.error('[ERROR]', ...args); }
};

// ==================== TOAST NOTIFICATION SYSTEM ====================
function _createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Hiển thị thông báo toast thay cho showToast()
 * @param {string} message - Nội dung thông báo
 * @param {'success'|'error'|'warning'|'info'} type - Loại thông báo
 * @param {number} duration - Thời gian hiển thị (ms), mặc định 3500
 */
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container') || _createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span><button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs toast-close" onclick="this.parentElement.remove()" title="Đóng" aria-label="Đóng"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// ==================== GLOBAL LOADING OVERLAY ====================
/**
 * Hiển thị/ẩn loading overlay toàn trang
 * @param {boolean} show - true để hiển thị, false để ẩn
 * @param {string} message - Nội dung hiển thị (mặc định "Đang xử lý...")
 */
let _loadingActive = false;
let _loadingRafId = null;

function showLoading(show = true, message = 'Đang xử lý...') {
    let overlay = document.getElementById('global-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${message}</div>`;
        document.body.appendChild(overlay);
    }
    if (show) {
        overlay.querySelector('.loading-text').textContent = message;
        if (_loadingRafId !== null) {
            cancelAnimationFrame(_loadingRafId);
            _loadingRafId = null;
        }
        _loadingActive = true;
        _loadingRafId = requestAnimationFrame(() => {
            _loadingRafId = null;
            if (_loadingActive) {
                overlay.classList.add('active');
            }
        });
    } else {
        _loadingActive = false;
        if (_loadingRafId !== null) {
            cancelAnimationFrame(_loadingRafId);
            _loadingRafId = null;
        }
        overlay.classList.remove('active');
    }
}

// ==================== CUSTOM CONFIRM DIALOG ====================
/**
 * Hiển thị hộp thoại xác nhận đẹp thay cho confirm() mặc định
 * @param {string} title - Tiêu đề
 * @param {string} message - Nội dung
 * @param {object} options - { confirmText, cancelText, danger }
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message, options = {}) {
    return new Promise(resolve => {
        const { confirmText = 'Xác nhận', cancelText = 'Hủy', danger = false } = options;
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        const iconClass = danger ? 'fa-exclamation-triangle' : 'fa-question-circle';
        const iconToneClass = danger ? 'confirm-icon-danger' : 'confirm-icon-primary';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <h3><i class="fa-solid ${iconClass} ${iconToneClass}"></i> ${title}</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="ui-btn ui-btn-secondary btn-confirm-cancel">${cancelText}</button>
                    <button class="ui-btn ${danger ? 'ui-btn-danger danger' : 'ui-btn-primary'} btn-confirm-ok">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.btn-confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
        overlay.querySelector('.btn-confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
}

// ==================== INPUT VALIDATION ====================
/**
 * Validate một input field và hiển thị lỗi nếu có
 * @param {HTMLElement} input - Element cần validate
 * @param {string} errorMessage - Thông báo lỗi
 * @param {Function} validatorFn - Hàm kiểm tra, trả về true nếu hợp lệ
 * @returns {boolean} true nếu hợp lệ
 */
function validateField(input, errorMessage, validatorFn) {
    // Xóa lỗi cũ
    clearFieldError(input);

    if (!validatorFn(input.value)) {
        input.classList.add('field-error');
        const errDiv = document.createElement('div');
        errDiv.className = 'field-error-message';
        errDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> ${errorMessage}`;
        input.parentElement.appendChild(errDiv);
        input.focus();
        return false;
    }
    return true;
}

function clearStrictValidationErrors(container) {
    if (!container) return;
    container.querySelectorAll('[data-strict-required-error="1"]').forEach(el => {
        el.classList.remove('field-error');
        delete el.dataset.strictRequiredError;
    });
    container.querySelectorAll('[data-model-image-required-message="1"]').forEach(el => el.remove());
}

function clearModelImageRequiredError(container) {
    if (!container) return;
    container.classList.remove('field-error');
    delete container.dataset.strictRequiredError;
    delete container.dataset.modelImageRequiredError;
    const errorMessage = container.nextElementSibling;
    if (errorMessage?.dataset?.modelImageRequiredMessage === '1') {
        errorMessage.remove();
    }
}

function hasModelImage(type) {
    return collectImagesFromContainer(type).length > 0;
}

function addModelImageRequiredError(container, message) {
    if (!container) return;
    container.classList.add('field-error');
    container.dataset.strictRequiredError = '1';
    container.dataset.modelImageRequiredError = '1';

    const errDiv = document.createElement('div');
    errDiv.className = 'field-error-message';
    errDiv.dataset.modelImageRequiredMessage = '1';
    errDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> ${message}`;
    container.insertAdjacentElement('afterend', errDiv);
}

function validateModelRequiredImages() {
    const requiredImages = [
        { type: 'physical', containerId: 'container-physical', message: 'Vui lòng thêm Mô hình Vật lý.' },
        { type: 'logical', containerId: 'container-logical', message: 'Vui lòng thêm Mô hình Logic.' }
    ];

    const invalidItems = [];
    requiredImages.forEach(item => {
        const container = document.getElementById(item.containerId);
        clearModelImageRequiredError(container);
        if (container && !hasModelImage(item.type)) {
            addModelImageRequiredError(container, item.message);
            invalidItems.push({ container, message: item.message });
        }
    });

    return {
        isValid: invalidItems.length === 0,
        firstInvalidElement: invalidItems[0]?.container || null,
        invalidCount: invalidItems.length
    };
}

function isElementVisibleForValidation(element) {
    if (!element) return false;

    // Respect explicit hidden markers first
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
        return false;
    }

    // Walk up the tree to detect hidden ancestors (display:none, collapsed modules, etc.)
    let node = element;
    while (node && node !== document.body) {
        if (node.hidden || node.getAttribute?.('aria-hidden') === 'true') {
            return false;
        }

        if (node.classList?.contains('module-collapsible-content') && !node.classList.contains('expanded')) {
            return false;
        }

        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        node = node.parentElement;
    }

    return true;
}

function shouldValidateAsRequired(element) {
    if (!element || element.disabled || element.readOnly) return false;
    if (!isElementVisibleForValidation(element)) return false;

    // Bỏ qua các trường admin để chỉ validate dữ liệu user cần nhập.
    if (element.closest('.admin-cell')) return false;
    if (element.classList.contains('admin-eval') ||
        element.classList.contains('admin-note') ||
        element.classList.contains('admin-eval-select')) {
        return false;
    }
    if (element.id && (element.id.startsWith('eval-') || element.id.startsWith('note-'))) return false;

    // Sizing section: validate only fields explicitly marked as required.
    if (element.closest('#page-sizing')) {
        return element.dataset.sizingRequired === '1';
    }

    const tag = element.tagName.toLowerCase();
    if (tag === 'input') {
        const type = (element.type || 'text').toLowerCase();
        if (['hidden', 'file', 'button', 'submit', 'reset', 'image'].includes(type)) return false;
        if (['checkbox', 'radio'].includes(type)) return false;
    }

    return true;
}

function validateLoadInput(input) {
    const value = parseFloat(input.value);
    const fieldName = input.classList.contains('cpu-load-input') || input.classList.contains('mariadb-cpu-load') || input.classList.contains('k8s-cpu-load-input') || input.classList.contains('kafka-linear-cpu-load')
        ? 'Tải CPU'
        : 'Tải RAM';

    if (input.value !== '' && (isNaN(value) || value < 0 || value > 100)) {
        input.style.borderColor = 'red';
        input.style.backgroundColor = '#ffe6e6';

        // Remove existing error message if any
        const existingError = input.parentNode.querySelector('.load-error-msg');
        if (existingError) existingError.remove();

        // Add error message below the input
        const errorDiv = document.createElement('div');
        errorDiv.className = 'load-error-msg';
        errorDiv.style.cssText = 'color:#dc3545;font-size:12px;margin-top:4px;font-weight:500;';
        errorDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + fieldName + ' không hợp lệ. Giá trị phải là số từ 0 đến 100.';
        input.parentNode.appendChild(errorDiv);
        return false;
    }

    input.style.borderColor = '';
    input.style.backgroundColor = '';

    // Remove error message if exists
    const existingError = input.parentNode.querySelector('.load-error-msg');
    if (existingError) existingError.remove();

    return true;
}

function isRequiredControlFilled(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'select') {
        return (element.value || '').trim() !== '';
    }

    if (tag === 'input') {
        if (element.classList.contains('date-display-input')) {
            return parseDateToISODate(element.value) !== '';
        }

        const type = (element.type || 'text').toLowerCase();
        if (type === 'number') {
            return element.value !== '';
        }
    }

    return (element.value || '').trim() !== '';
}

const SIZING_REQUIRED_SELECTOR_GROUPS = {
    App: [
        'select[id^="app-input-row-select"]',
        '#baseline-table-body .ip-input',
        '#baseline-table-body .cpu-input',
        '#baseline-table-body .ram-input',
        '#baseline-table-body .disk-input',
        '#baseline-table-body .cint-input',
        '#input-config-table-body .cpu-load-input',
        '#input-config-table-body .ram-load-input',
        '#storage-input-table-body .storage-ip-input',
        '#storage-input-table-body .storage-partition-input',
        '#storage-input-table-body .storage-used-input'
    ],
    MariaDB: [
        'select[id^="mariadb-input-row-select"]',
        '#mariadb-ref-table-body .mariadb-ip',
        '#mariadb-ref-table-body .mariadb-cpu',
        '#mariadb-ref-table-body .mariadb-ram',
        '#mariadb-ref-table-body .mariadb-cpu-load',
        '#mariadb-ref-table-body .mariadb-ram-load',
        'input[id^="mariadb-storage-data-used"]',
        'input[id^="mariadb-storage-log-used"]'
    ],
    Redis: [
        'select[id^="redis-key-input-row-select"]',
        'select[id^="redis-config-input-row-select"]',
        '#redis-method-key-content input[id^="redis-key-count-poc"]',
        '#redis-method-key-content input[id^="redis-record-size"]',
        '#redis-method-config-content .redis-config-ram',
        '#redis-method-config-content .redis-config-ram-load'
    ],
    Kafka: [
        'select[id^="kafka-throughput-input-row-select"]',
        'select[id^="kafka-linear-input-row-select"]',
        '#kafka-method-throughput-content input[id^="kafka-throughput-a"]',
        '#kafka-method-linear-content .kafka-linear-vcpu',
        '#kafka-method-linear-content .kafka-linear-ram',
        '#kafka-method-linear-content .kafka-linear-disk',
        '#kafka-method-linear-content .kafka-linear-cpu-load',
        '#kafka-method-linear-content .kafka-linear-ram-load',
        '#kafka-method-linear-content .kafka-linear-disk-load'
    ],
    K8S: [
        'select[id^="k8s-input-row-select"]',
        '#k8s-baseline-table-body .k8s-ip-input',
        '#k8s-baseline-table-body .k8s-cpu-input',
        '#k8s-baseline-table-body .k8s-ram-input',
        '#k8s-baseline-table-body .k8s-disk-input',
        '#k8s-baseline-table-body .k8s-cint-input',
        '#k8s-input-config-table-body .k8s-cpu-load-input',
        '#k8s-input-config-table-body .k8s-ram-load-input',
        '#k8s-storage-input-table-body .k8s-storage-ip-input',
        '#k8s-storage-input-table-body .k8s-storage-partition-input',
        '#k8s-storage-input-table-body .k8s-storage-used-input'
    ],
    'Khác': [
        'select[id^="custom-input-row-select"]',
        '#custom-baseline-table-body .ip-input',
        '#custom-baseline-table-body .cpu-input',
        '#custom-baseline-table-body .ram-input',
        '#custom-baseline-table-body .disk-input',
        '#custom-baseline-table-body .cint-input',
        '#custom-input-config-table-body .cpu-load-input',
        '#custom-input-config-table-body .ram-load-input',
        '#custom-storage-input-table-body .custom-storage-ip-input',
        '#custom-storage-input-table-body .custom-storage-partition-input',
        '#custom-storage-input-table-body .custom-storage-used-input'
    ],
    'LB/FW': [
        'select[id^="lbfw-input-row-select"]',
        'input[id^="lbfw-peak-upload"]',
        'input[id^="lbfw-peak-download"]'
    ]
};

const SIZING_REQUIRED_SELECTORS = Object.values(SIZING_REQUIRED_SELECTOR_GROUPS).flat();

function refreshSizingRequiredMarkers(section = null) {
    const sizingSection = section || document.getElementById('page-sizing');
    if (!sizingSection) return;

    sizingSection.querySelectorAll('[data-sizing-required="1"]').forEach(el => {
        delete el.dataset.sizingRequired;
    });

    SIZING_REQUIRED_SELECTORS.forEach(selector => {
        sizingSection.querySelectorAll(selector).forEach(el => {
            if (el.closest('.admin-cell')) return;
            if (el.classList.contains('admin-eval') || el.classList.contains('admin-note') || el.classList.contains('admin-eval-select')) return;
            el.dataset.sizingRequired = '1';
        });
    });
}

function validateTabCompletion(sectionId, options = {}) {
    const { focusFirstInvalid = true, showToastMessage = true } = options;
    const section = document.getElementById(sectionId);
    if (!section) return { isValid: true, firstInvalidElement: null };

    if (sectionId === 'page-sizing') {
        refreshSizingRequiredMarkers(section);
    }

    clearStrictValidationErrors(section);

    const controls = Array.from(section.querySelectorAll('input, textarea, select'))
        .filter(shouldValidateAsRequired);

    const invalidControls = controls.filter(el => !isRequiredControlFilled(el));
    const modelImageValidation = sectionId === 'page-model'
        ? validateModelRequiredImages()
        : { isValid: true, firstInvalidElement: null, invalidCount: 0 };

    if (invalidControls.length === 0 && modelImageValidation.isValid) {
        return { isValid: true, firstInvalidElement: null };
    }

    invalidControls.forEach(el => {
        el.classList.add('field-error');
        el.dataset.strictRequiredError = '1';
    });

    const firstInvalidElement = invalidControls[0] || modelImageValidation.firstInvalidElement;
    if (focusFirstInvalid && firstInvalidElement) {
        if (typeof firstInvalidElement.focus === 'function' && firstInvalidElement.matches?.('input, textarea, select, button')) {
            firstInvalidElement.focus();
        }
        firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (showToastMessage) {
        showToast('Vui lòng điền đầy đủ dữ liệu bắt buộc trước khi tiếp tục.', 'warning');
    }

    return {
        isValid: false,
        firstInvalidElement,
        invalidCount: invalidControls.length + (modelImageValidation.invalidCount || 0)
    };
}

function getNextSectionId(currentSectionId) {
    const currentIndex = TAB_FLOW_ORDER.indexOf(currentSectionId);
    if (currentIndex < 0 || currentIndex >= TAB_FLOW_ORDER.length - 1) return null;
    return TAB_FLOW_ORDER[currentIndex + 1];
}

function getSectionMenuLink(sectionId) {
    return Array.from(document.querySelectorAll('.side-menu a'))
        .find(link => (link.getAttribute('onclick') || '').includes(`'${sectionId}'`)) || null;
}

function getStickyTopBoundary() {
    const header = document.querySelector('.header');
    const tabs = document.querySelector('.horizontal-tabs');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    const tabsBottom = tabs ? tabs.getBoundingClientRect().bottom : 0;
    return Math.max(0, headerBottom, tabsBottom);
}

function positionSingleHelpTooltip(icon) {
    if (!icon) return;
    const tooltip = icon.querySelector('.help-content');
    if (!tooltip) return;

    tooltip.classList.remove('tooltip-up', 'tooltip-down');

    const iconRect = icon.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth || 280;
    const tooltipHeight = tooltip.offsetHeight || 170;
    const stickyTopBoundary = getStickyTopBoundary();
    const viewportHeight = window.innerHeight;
    const gap = 12;
    const margin = 10;

    const spaceAbove = iconRect.top - stickyTopBoundary;
    const spaceBelow = viewportHeight - iconRect.bottom;
    const requiredHeight = tooltipHeight + gap;

    const nearTopBoundary = iconRect.top <= stickyTopBoundary + 24;
    const nearBottomBoundary = iconRect.bottom + requiredHeight >= viewportHeight - margin;

    let direction;
    if (nearTopBoundary) {
        direction = 'down';
    } else if (nearBottomBoundary) {
        direction = 'up';
    } else {
        direction = spaceBelow >= spaceAbove ? 'down' : 'up';
    }

    if (direction === 'down' && spaceBelow < requiredHeight && spaceAbove > spaceBelow) {
        direction = 'up';
    }
    if (direction === 'up' && spaceAbove < requiredHeight && spaceBelow > spaceAbove) {
        direction = 'down';
    }

    tooltip.classList.add(direction === 'up' ? 'tooltip-up' : 'tooltip-down');

    const iconCenterX = iconRect.left + iconRect.width / 2;
    const idealLeft = iconCenterX - tooltipWidth / 2;
    const minLeft = margin;
    const maxLeft = window.innerWidth - tooltipWidth - margin;
    const clampedLeft = Math.max(minLeft, Math.min(idealLeft, maxLeft));
    const leftRelativeToIcon = clampedLeft - iconRect.left;

    tooltip.style.left = `${leftRelativeToIcon}px`;
}

function initHelpTooltipSmartPositioning() {
    if (window.__helpTooltipSmartInited) return;
    window.__helpTooltipSmartInited = true;

    const helpIcons = Array.from(document.querySelectorAll('.help-icon'));
    if (helpIcons.length === 0) return;

    helpIcons.forEach(icon => {
        let hideTimer = null;
        const tooltip = icon.querySelector('.help-content');

        const openTooltip = () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            icon.classList.add('is-open');
            positionSingleHelpTooltip(icon);
        };

        const closeTooltipWithDelay = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                icon.classList.remove('is-open');
            }, 160);
        };

        icon.addEventListener('mouseenter', openTooltip);
        icon.addEventListener('focusin', openTooltip);
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            openTooltip();
        });
        icon.addEventListener('mouseleave', closeTooltipWithDelay);
        icon.addEventListener('focusout', closeTooltipWithDelay);

        if (tooltip) {
            tooltip.addEventListener('mouseenter', openTooltip);
            tooltip.addEventListener('mouseleave', closeTooltipWithDelay);
        }
    });

    document.addEventListener('click', (event) => {
        helpIcons.forEach(icon => {
            if (!icon.contains(event.target)) {
                icon.classList.remove('is-open');
            }
        });
    });

    const repositionVisible = () => {
        helpIcons.forEach(icon => {
            const tooltip = icon.querySelector('.help-content');
            if (!tooltip) return;
            const style = window.getComputedStyle(tooltip);
            if (style.visibility === 'visible' || icon.matches(':hover') || icon.classList.contains('is-open')) {
                positionSingleHelpTooltip(icon);
            }
        });
    };

    window.addEventListener('resize', repositionVisible);
    window.addEventListener('scroll', repositionVisible, { passive: true });
}

function ensureFirstRowExists(tbodyId, addRowFn) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (tbody.querySelectorAll('tr').length === 0 && typeof addRowFn === 'function') {
        addRowFn();
    }
}

function ensureDefaultAppSizingRows() {
    ensureFirstRowExists('baseline-table-body', () => addBaselineRow());
    ensureFirstRowExists('input-config-table-body', () => addInputConfigRow());
    ensureFirstRowExists('storage-input-table-body', () => addStorageInputRow());
}

function ensureDefaultRedisConfigRows() {
    ensureFirstRowExists('redis-config-table-body', () => addRedisConfigRow({}));
}

function ensureDefaultMariaDBRefRows() {
    ensureFirstRowExists('mariadb-ref-table-body', () => addMariaDBRefRow({}));
}

function ensureDefaultKafkaLinearRows() {
    ensureFirstRowExists('kafka-linear-table-body', () => addKafkaLinearRow({}));
}

function ensureDefaultK8SSizingRows() {
    ensureFirstRowExists('k8s-baseline-table-body', () => addK8SBaselineRow());
    ensureFirstRowExists('k8s-input-config-table-body', () => addK8SInputConfigRow());
    ensureFirstRowExists('k8s-storage-input-table-body', () => addK8SStorageInputRow());
}

function ensureDefaultCustomLinearRows() {
    ensureFirstRowExists('custom-baseline-table-body', () => addCustomBaselineRow());
    ensureFirstRowExists('custom-input-config-table-body', () => addCustomInputConfigRow());
    ensureFirstRowExists('custom-storage-input-table-body', () => addCustomStorageInputRow());
}

function initFirstRowGuards() {
    if (window.__firstRowGuardsInited) return;
    window.__firstRowGuardsInited = true;

    const managedTables = [
        { id: 'input-table-body', add: () => addInputRow() },
        { id: 'connection-info-table-body', add: () => addConnectionRow() },
        { id: 'logic-component-table-body', add: () => addLogicComponentRow() },
        { id: 'arch-table-body', add: () => addArchRow() },
        { id: 'baseline-table-body', add: () => addBaselineRow() },
        { id: 'input-config-table-body', add: () => addInputConfigRow() },
        { id: 'storage-input-table-body', add: () => addStorageInputRow() },
        { id: 'mariadb-ref-table-body', add: () => addMariaDBRefRow({}) },
        { id: 'redis-config-table-body', add: () => addRedisConfigRow({}) },
        { id: 'kafka-linear-table-body', add: () => addKafkaLinearRow({}) },
        { id: 'k8s-baseline-table-body', add: () => addK8SBaselineRow() },
        { id: 'k8s-input-config-table-body', add: () => addK8SInputConfigRow() },
        { id: 'summary-table-body', add: () => addSummaryRow() }
    ];

    managedTables.forEach(item => {
        // Seed default rows only once on startup; allow tables to become empty after deletion.
        ensureFirstRowExists(item.id, item.add);
    });
}

/**
 * Xóa trạng thái lỗi của một field
 */
function clearFieldError(input) {
    input.classList.remove('field-error');
    const existing = input.parentElement?.querySelector('.field-error-message');
    if (existing) existing.remove();
}

/**
 * Xóa tất cả lỗi validation trên form
 */
function clearAllFieldErrors(container) {
    (container || document).querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
    (container || document).querySelectorAll('.field-error-message').forEach(el => el.remove());
}

/**
 * Parse error response từ backend (ErrorResponse DTO)
 * @param {Response} response - fetch Response object
 * @returns {Promise<string>} - Error message đã format
 */
async function parseApiError(response) {
    try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const body = await response.json();
            // Backend ErrorResponse format: { status, error, message, path, timestamp, validationErrors }
            if (body.validationErrors && Object.keys(body.validationErrors).length > 0) {
                const validationMsgs = Object.entries(body.validationErrors)
                    .map(([field, msg]) => `${field}: ${msg}`)
                    .join(', ');
                return `${body.message || 'Lỗi validation'}: ${validationMsgs}`;
            }
            return body.message || body.error || `Lỗi ${response.status}`;
        }
        const text = await response.text();
        return text || `Lỗi ${response.status}`;
    } catch {
        return `Lỗi ${response.status}: ${response.statusText}`;
    }
}

async function parseApiErrorBody(response) {
    try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
    } catch (e) {
        Logger.warn('Unable to parse API error body', e);
    }
    return null;
}

// ==================== FETCH API WRAPPER (Auth chuẩn hóa) ====================
/**
 * Wrapper cho fetch() tự động thêm auth headers và xử lý 401
 * Tự động parse error response từ backend ErrorResponse DTO
 * @param {string} url - URL API
 * @param {object} options - fetch options (method, body, headers, ...)
 * @param {object} config - { showError: true, showLoading: false, loadingMessage: '' }
 * @returns {Promise<Response>}
 */
async function fetchAPI(url, options = {}, config = {}) {
    const { showError = false, showLoadingOverlay = false, loadingMessage = 'Đang xử lý...' } = config;

    if (showLoadingOverlay) showLoading(true, loadingMessage);

    options.headers = Object.assign({}, getAuthHeaders(), options.headers || {});

    try {
        const response = await fetch(url, options);

        if (showLoadingOverlay) showLoading(false);

        if (handleUnauthorized(response)) {
            throw new Error('Unauthorized');
        }

        // Tự động hiển thị toast lỗi cho non-ok response nếu showError = true
        if (!response.ok && showError) {
            const errorMsg = await parseApiError(response.clone());
            showToast(errorMsg, 'error', 5000);
        }

        return response;
    } catch (error) {
        if (showLoadingOverlay) showLoading(false);

        // Network error (mất kết nối, timeout, ...)
        if (error.message !== 'Unauthorized') {
            if (showError) {
                showToast('Lỗi kết nối: Không thể liên lạc với máy chủ. Vui lòng kiểm tra kết nối mạng.', 'error', 5000);
            }
        }
        throw error;
    }
}

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

function parseDateToISODate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const viMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (viMatch) {
        const day = Number(viMatch[1]);
        const month = Number(viMatch[2]);
        const year = Number(viMatch[3]);
        const date = new Date(year, month - 1, day);
        if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        ) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        return '';
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, '0'),
        String(parsed.getDate()).padStart(2, '0')
    ].join('-');
}

function formatDateForVietnameseInput(value) {
    const isoValue = parseDateToISODate(value);
    if (!isoValue) return '';
    const [year, month, day] = isoValue.split('-');
    return `${day}/${month}/${year}`;
}

function setVietnameseDateInputValue(nativeInput, value) {
    if (!nativeInput) return;
    nativeInput.value = parseDateToISODate(value);
    syncVietnameseDateDisplay(nativeInput);
}

function syncVietnameseDateDisplay(nativeInput) {
    const wrapper = nativeInput?.closest('.date-input-wrap');
    const displayInput = wrapper?.querySelector('.date-display-input');
    if (!displayInput) return;
    displayInput.value = formatDateForVietnameseInput(nativeInput.value);
}

function initVietnameseDateInputs(scope = document) {
    scope.querySelectorAll('.date-input-wrap').forEach(wrapper => {
        const displayInput = wrapper.querySelector('.date-display-input');
        const nativeInput = wrapper.querySelector('.date-picker-native');
        const pickerButton = wrapper.querySelector('.date-picker-button');
        if (!displayInput || !nativeInput || wrapper.dataset.dateInputInited === '1') return;

        wrapper.dataset.dateInputInited = '1';
        syncVietnameseDateDisplay(nativeInput);

        displayInput.addEventListener('input', () => {
            nativeInput.value = parseDateToISODate(displayInput.value);
        });

        displayInput.addEventListener('blur', () => {
            const isoValue = parseDateToISODate(displayInput.value);
            displayInput.value = isoValue ? formatDateForVietnameseInput(isoValue) : displayInput.value.trim();
        });

        nativeInput.addEventListener('change', () => syncVietnameseDateDisplay(nativeInput));

        pickerButton?.addEventListener('click', () => {
            if (nativeInput.disabled || displayInput.disabled) return;
            try {
                if (typeof nativeInput.showPicker === 'function') {
                    nativeInput.showPicker();
                    return;
                }
            } catch (e) {
                Logger.debug('Date picker showPicker fallback:', e);
            }
            try {
                nativeInput.focus();
                nativeInput.click();
            } catch (e) { /* ignore */ }
        });
    });
}

function isTextBoxInTab(element) {
    return !!element?.closest?.('.page-section');
}

function isTextBoxMeasurable(textBox) {
    return !!(textBox && textBox.getClientRects && textBox.getClientRects().length > 0);
}

function autoResizeTextBox(textBox) {
    if (!textBox || textBox.tagName !== 'TEXTAREA') return;
    if (!isTextBoxMeasurable(textBox)) {
        textBox.dataset.pendingAutoResize = '1';
        return;
    }

    textBox.style.height = 'auto';
    const minHeight = parseFloat(window.getComputedStyle(textBox).minHeight) || 0;
    textBox.style.height = `${Math.max(textBox.scrollHeight, minHeight)}px`;
    delete textBox.dataset.pendingAutoResize;
}

function copyTextInputToTextarea(input) {
    if (!input || input.tagName !== 'INPUT' || (input.type || '').toLowerCase() !== 'text') return input;
    if (!isTextBoxInTab(input)) return input;

    const textarea = document.createElement('textarea');
    Array.from(input.attributes).forEach(attr => {
        if (attr.name.toLowerCase() !== 'type' && attr.name.toLowerCase() !== 'value') {
            textarea.setAttribute(attr.name, attr.value);
        }
    });
    textarea.rows = textarea.getAttribute('rows') || '1';
    textarea.value = input.value || input.getAttribute('value') || '';
    textarea.defaultValue = textarea.value;
    textarea.classList.add('global-auto-resize-textbox');

    if (input.disabled) textarea.disabled = true;
    if (input.readOnly) textarea.readOnly = true;
    if (input.required) textarea.required = true;

    input.replaceWith(textarea);
    return textarea;
}

function getTextBoxCandidates(scope = document) {
    const candidates = [];
    const addCandidate = (element) => {
        if (!element || !isTextBoxInTab(element)) return;
        if (element.matches?.('textarea, input[type="text"]')) {
            candidates.push(element);
        }
    };

    addCandidate(scope);
    if (scope.querySelectorAll) {
        const selector = isTextBoxInTab(scope)
            ? 'textarea, input[type="text"]'
            : '.page-section textarea, .page-section input[type="text"]';
        scope.querySelectorAll(selector).forEach(addCandidate);
    }

    return candidates;
}

function initGlobalAutoResizeTextBoxes(scope = document) {
    getTextBoxCandidates(scope).forEach(candidate => {
        const textBox = candidate.tagName === 'INPUT'
            ? copyTextInputToTextarea(candidate)
            : candidate;
        if (!textBox || textBox.tagName !== 'TEXTAREA') return;

        textBox.classList.add('global-auto-resize-textbox');
        if (textBox.dataset.globalAutoResizeInited !== '1') {
            textBox.dataset.globalAutoResizeInited = '1';
            textBox.addEventListener('input', () => autoResizeTextBox(textBox));
        }
        autoResizeTextBox(textBox);
    });
}

function refreshAutoResizeTextBoxes(scope = document) {
    initGlobalAutoResizeTextBoxes(scope);
    if (scope.querySelectorAll) {
        scope.querySelectorAll('.connection-auto-textarea').forEach(autoResizeConnectionTextarea);
        scope.querySelectorAll('.custom-proposal-config, .app-custom-proposal-config, .redis-custom-proposal-config, .mariadb-custom-proposal-config, .k8s-custom-proposal-config, .lbfw-custom-proposal-config').forEach(autoResizeCustomProposalTextarea);
    }
}

function scheduleAutoResizeTextBoxes(scope = document) {
    const run = () => refreshAutoResizeTextBoxes(scope);

    requestAnimationFrame(() => {
        requestAnimationFrame(run);
    });
    [0, 120, 350, 800].forEach(delay => setTimeout(run, delay));

    if (document.fonts?.ready) {
        document.fonts.ready.then(run).catch(() => {});
    }
}

function initGlobalAutoResizeTextBoxObserver() {
    if (window.__globalAutoResizeTextBoxObserverInited) return;
    window.__globalAutoResizeTextBoxObserverInited = true;

    const root = document.getElementById('project-detail-page') || document.body;
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    initGlobalAutoResizeTextBoxes(node);
                    scheduleAutoResizeTextBoxes(node);
                }
            });
        });
    });
    observer.observe(root, { childList: true, subtree: true });
}

function getTextControlValue(container, selector = 'textarea, input[type="text"]') {
    return container?.querySelector(selector)?.value || '';
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

async function logout() {
    const confirmed = await showConfirm(
        'Đăng xuất',
        'Bạn có chắc muốn đăng xuất khỏi hệ thống?',
        { confirmText: 'Đăng xuất', cancelText: 'Hủy' }
    );
    if (confirmed) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        clearProjectIds();
        window.location.href = 'login.html';
    }
}

function getCurrentUser() {
    return {
        userId: localStorage.getItem('userId'),
        username: localStorage.getItem('username'),
        displayName: localStorage.getItem('displayName'),
        phoneNumber: localStorage.getItem('userPhoneNumber'),
        role: localStorage.getItem('userRole'),
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true'
    };
}

function getCurrentUserRole() {
    return (getCurrentUser().role || '').toLowerCase();
}

function canDeleteProjects() {
    return ['user', 'admin2'].includes(getCurrentUserRole());
}

function escapeInlineHandlerArg(value) {
    return (value || '').toString().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function createEmptyProjectMeta() {
    return {
        id: null,
        name: '',
        devUnit: '',
        ownerName: '',
        userId: null,
        assignedAdmin1Id: null,
        assignedAdmin1Name: '',
        assignedAdmin1Phone: '',
        admin2Users: [],
        contact: {
            email: '',
            unit: '',
            phone: ''
        }
    };
}

function resetCurrentProjectContext() {
    currentProjectMeta = createEmptyProjectMeta();
    workflowModalRuntime = null;
}

function parseContactComposite(rawValue) {
    const parts = String(rawValue || '').split(' - ');
    return {
        email: (parts[0] || '').trim(),
        unit: (parts[1] || '').trim(),
        phone: parts.slice(2).join(' - ').trim()
    };
}

function normalizePhone(value) {
    return String(value || '').replace(/[^\d+]/g, '').trim();
}

function hasValidPhone(value) {
    return normalizePhone(value).replace(/\+/g, '').length >= 8;
}

function maskPhone(value) {
    const normalized = normalizePhone(value);
    if (!normalized) return 'Chưa có số';
    if (normalized.length <= 6) return normalized;
    return `${normalized.slice(0, 4)}***${normalized.slice(-3)}`;
}

function setCurrentProjectMetaFromProject(project) {
    if (!project) return;
    const fallbackContact = parseContactComposite(project.ownerName || currentProjectMeta.ownerName);
    currentProjectMeta = {
        id: project.id || currentProjectId || currentProjectMeta.id,
        name: project.name || currentProjectMeta.name || 'Chưa đặt tên',
        devUnit: project.devUnit || currentProjectMeta.devUnit || '',
        ownerName: project.ownerName || currentProjectMeta.ownerName || '',
        userId: project.userId || currentProjectMeta.userId || null,
        assignedAdmin1Id: project.assignedAdmin1Id || null,
        assignedAdmin1Name: project.assignedAdmin1Id === currentProjectMeta.assignedAdmin1Id
            ? currentProjectMeta.assignedAdmin1Name
            : '',
        contact: {
            email: currentProjectMeta.contact.email || fallbackContact.email,
            unit: currentProjectMeta.contact.unit || fallbackContact.unit,
            phone: currentProjectMeta.contact.phone || fallbackContact.phone
        }
    };
}

function applyProjectRequestDataToContext(requestData) {
    if (!requestData) return;
    const contact = parseContactComposite(requestData.contactPerson || currentProjectMeta.ownerName);
    currentProjectMeta.name = requestData.projectName || currentProjectMeta.name;
    currentProjectMeta.devUnit = requestData.devUnit || currentProjectMeta.devUnit;
    currentProjectMeta.ownerName = requestData.contactPerson || currentProjectMeta.ownerName;
    currentProjectMeta.contact = {
        email: contact.email,
        unit: contact.unit,
        phone: contact.phone
    };
}

async function hydrateCurrentProjectParticipants() {
    // Fetch admin1 info if assigned
    if (currentProjectMeta.assignedAdmin1Id) {
        try {
            const response = await fetchAPI(`${API_BASE_URL}/users/${currentProjectMeta.assignedAdmin1Id}`);
            if (response.ok) {
                const reviewer = await response.json();
                currentProjectMeta.assignedAdmin1Name = reviewer.displayName || reviewer.username || reviewer.email || currentProjectMeta.assignedAdmin1Id;
                currentProjectMeta.assignedAdmin1Phone = reviewer.phoneNumber || '';
            }
        } catch (error) {
            Logger.warn('Không tải được thông tin reviewer cho workflow UI', error);
        }
    } else {
        currentProjectMeta.assignedAdmin1Name = '';
        currentProjectMeta.assignedAdmin1Phone = '';
    }

    // Fetch all admin2 users for workflow notifications
    try {
        const response = await fetchAPI(`${API_BASE_URL}/users/role/admin2`);
        if (response.ok) {
            const admin2Users = await response.json();
            currentProjectMeta.admin2Users = admin2Users || [];
        } else {
            currentProjectMeta.admin2Users = [];
        }
    } catch (error) {
        Logger.warn('Không tải được danh sách admin2 cho workflow UI', error);
        currentProjectMeta.admin2Users = [];
    }
}

function getWorkflowHistoryStorageKey(projectId = currentProjectId) {
    return `workflow-ui-history:${projectId || 'none'}`;
}

function readStoredJsonArray(key) {
    try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveJsonToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        Logger.warn('Không thể ghi localStorage cho workflow UI', error);
    }
}

function persistWorkflowUiRecord(entry) {
    if (!currentProjectId || !entry) return;
    const key = getWorkflowHistoryStorageKey();
    const history = readStoredJsonArray(key);
    history.unshift(entry);
    saveJsonToStorage(key, history.slice(0, 12));
}

function getLatestWorkflowUiRecord() {
    return readStoredJsonArray(getWorkflowHistoryStorageKey())[0] || null;
}

function formatDateTimeValue(value) {
    if (!value) return 'Chua ghi nhan';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getSectionDisplayName(sectionId) {
    return SECTION_DISPLAY_NAMES[sectionId] || sectionId || 'tab hiện tại';
}

function isAdminReviewField(element) {
    return !!element && (
        element.classList?.contains('admin-eval') ||
        element.classList?.contains('admin-eval-select') ||
        element.classList?.contains('admin-note')
    );
}

function markAdminReviewSectionDirty(sectionId) {
    if (sectionId) adminReviewDirtySections.add(sectionId);
}

function markAdminReviewSectionClean(sectionId) {
    if (sectionId) adminReviewDirtySections.delete(sectionId);
}

function resetAdminReviewDirtySections() {
    adminReviewDirtySections.clear();
}

function getFirstDirtyAdminSectionId() {
    return TAB_FLOW_ORDER.find(sectionId => adminReviewDirtySections.has(sectionId)) || null;
}

function initAdminReviewDirtyTracking() {
    if (window.__adminReviewDirtyTrackingInited) return;
    window.__adminReviewDirtyTrackingInited = true;

    const handleDirtyEvent = (event) => {
        const target = event.target;
        if (!isAdminReviewField(target)) return;
        const sectionId = target.closest('.page-section')?.id || null;
        markAdminReviewSectionDirty(sectionId);
    };

    document.addEventListener('input', handleDirtyEvent, true);
    document.addEventListener('change', handleDirtyEvent, true);
}

function isElementApplicableForApproval(element) {
    if (!element || element.disabled) return false;
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;

    let node = element;
    while (node && node !== document.body) {
        const isTabSection = node.classList?.contains('page-section') && TAB_FLOW_ORDER.includes(node.id);
        if (!isTabSection) {
            if (node.hidden || node.getAttribute?.('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        node = node.parentElement;
    }

    return true;
}

function buildApprovalIssue(sectionId, message, element, extra = {}) {
    return Object.assign({ sectionId, message, element }, extra);
}

function addApprovalFieldIssue(issues, sectionId, element, message, extra = {}) {
    if (!element || !isElementApplicableForApproval(element)) return false;
    const value = String(element.value || '').trim().toUpperCase();
    if (value !== 'OK') {
        issues.push(buildApprovalIssue(sectionId, message, element, extra));
    }
    return true;
}

function getFirstAdminReviewElementForSection(sectionId, instanceKey = null) {
    const section = document.getElementById(sectionId);
    if (!section) return null;

    let scope = section;
    if (instanceKey) {
        const wrapper = section.querySelector(`.module-instance-wrapper[data-instance-key="${instanceKey}"]`);
        if (wrapper) scope = wrapper;
    }

    return Array.from(scope.querySelectorAll('.admin-eval, .admin-eval-select, .admin-note'))
        .find(isElementApplicableForApproval) || null;
}

function resolveApprovalIssueElement(issue) {
    if (!issue) return null;

    const isBlockingEvalElement = (element) => {
        if (!element || !isElementApplicableForApproval(element)) return false;
        if (element.classList?.contains('admin-note')) return false;
        return String(element.value || '').trim().toUpperCase() !== 'OK';
    };

    if (issue.element && isElementApplicableForApproval(issue.element)) {
        if (issue.element.classList?.contains('admin-note') || isBlockingEvalElement(issue.element)) {
            return issue.element;
        }
    }

    const section = document.getElementById(issue.sectionId);
    if (!section) return issue.element || null;

    let scope = section;
    if (issue.instanceKey) {
        const wrapper = section.querySelector(`.module-instance-wrapper[data-instance-key="${issue.instanceKey}"]`);
        if (wrapper) scope = wrapper;
    }

    const firstBlockingEval = Array.from(scope.querySelectorAll('.admin-eval, .admin-eval-select'))
        .find(isBlockingEvalElement);
    if (firstBlockingEval) return firstBlockingEval;

    return getFirstAdminReviewElementForSection(issue.sectionId, issue.instanceKey) || issue.element || null;
}

function expandApprovalTarget(issue) {
    if (!issue?.element) return;
    const collapsibleContent = issue.element.closest('.module-collapsible-content');
    if (collapsibleContent && !collapsibleContent.classList.contains('expanded')) {
        collapsibleContent.classList.add('expanded');
        collapsibleContent.previousElementSibling?.classList.add('active');
        scheduleAutoResizeTextBoxes(collapsibleContent);
    }
}

function highlightApprovalElement(element) {
    if (!element) return;
    element.classList.add('field-error');
    element.dataset.approvalHighlight = '1';
    window.setTimeout(() => {
        if (element.dataset.approvalHighlight === '1' && !element.dataset.strictRequiredError) {
            element.classList.remove('field-error');
            delete element.dataset.approvalHighlight;
        }
    }, 3500);
}

function navigateToApprovalIssue(issue) {
    if (!issue) return;
    const link = getSectionMenuLink(issue.sectionId);
    showSection(issue.sectionId, link, { skipValidation: true, skipPushState: false });

    const fallbackElement = resolveApprovalIssueElement(issue);
    if (!fallbackElement) return;

    expandApprovalTarget({ element: fallbackElement });
    highlightApprovalElement(fallbackElement);
    fallbackElement.focus();
    fallbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning', 4000);
        // Xóa toàn bộ auth data
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        // Delay redirect để user thấy toast
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return true;
    }
    if (response.status === 403) {
        showToast('Bạn không có quyền thực hiện thao tác này.', 'error', 4000);
        return false; // Không redirect, chỉ thông báo
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
            // Allow method toggle buttons and save buttons to remain clickable for admin
            if (btn.classList.contains('btn-method') || btn.classList.contains('btn-save-section')) {
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

        document.querySelectorAll('#page-summary input, #page-summary textarea, #page-summary select').forEach(el => {
            if (el.classList.contains('admin-eval') || el.classList.contains('admin-note') || el.classList.contains('admin-eval-select')) {
                el.disabled = false;
            } else {
                el.disabled = true;
            }
        });
        document.querySelectorAll('#page-summary button.sizing-user-btn, #page-summary .btn-delete').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
        document.querySelectorAll('#page-summary .btn-save-section, #page-summary #exportBtn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });

        // Disable custom method editors for admin (read-only)
        document.querySelectorAll('.custom-doc-editor').forEach(editor => {
            editor.contentEditable = 'false';
            editor.style.pointerEvents = 'none';
            editor.style.opacity = '0.7';
        });

        // Disable custom doc toolbar buttons for admin
        document.querySelectorAll('.custom-doc-toolbar button').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });

        // Disable file inputs (uploads) in those sections
        document.querySelectorAll('#page-request input[type="file"], #page-input input[type="file"], #page-model input[type="file"], #page-sizing input[type="file"]').forEach(fi => fi.disabled = true);

        // Disable action buttons that manipulate user content but keep evaluate & save buttons enabled
        document.querySelectorAll('#page-request button, #page-input button, #page-model button').forEach(btn => {
            // Admin được bấm nút Đánh giá, Lưu dữ liệu, btn-view-evidence, btn-logout
            const allow = btn.classList.contains('btn-evaluate') ||
                btn.classList.contains('btn-logout') ||
                btn.classList.contains('btn-view-evidence') ||
                btn.classList.contains('btn-save-section');
            if (!allow) btn.disabled = true;
        });

        // Enable nút Lưu dữ liệu cho admin (btn-save-section)
        document.querySelectorAll('.btn-save-section').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.title = '';
        });

        const importConnectionBtn = document.getElementById('importConnectionBtn');
        const importConnectionInput = document.getElementById('connection-import-input');
        if (importConnectionBtn) {
            importConnectionBtn.disabled = true;
            importConnectionBtn.style.opacity = '0.5';
            importConnectionBtn.style.cursor = 'not-allowed';
        }
        if (importConnectionInput) importConnectionInput.disabled = true;
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

        // Enable custom method editors for user (editable)
        document.querySelectorAll('.custom-doc-editor').forEach(editor => {
            editor.contentEditable = 'true';
            editor.style.pointerEvents = 'auto';
            editor.style.opacity = '1';
        });

        // Enable custom doc toolbar buttons for user
        document.querySelectorAll('.custom-doc-toolbar button').forEach(btn => {
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

        document.querySelectorAll('#page-summary input, #page-summary textarea, #page-summary select').forEach(el => {
            el.disabled = false;
        });
        document.querySelectorAll('#page-summary .admin-eval, #page-summary .admin-note, #page-summary .admin-eval-select').forEach(el => {
            el.disabled = true;
            el.classList.add('readonly-admin');
        });
        document.querySelectorAll('#page-summary button.sizing-user-btn, #page-summary .btn-delete, #page-summary .btn-save-section, #page-summary #exportBtn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.title = '';
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

        const importConnectionBtn = document.getElementById('importConnectionBtn');
        const importConnectionInput = document.getElementById('connection-import-input');
        if (importConnectionBtn) {
            importConnectionBtn.disabled = false;
            importConnectionBtn.style.opacity = '1';
            importConnectionBtn.style.cursor = 'pointer';
        }
        if (importConnectionInput) importConnectionInput.disabled = false;
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
    Logger.debug('Saved Project ID to localStorage:', id);
}

function saveProjectDataIdToStorage(id) {
    currentProjectDataId = id;
    localStorage.setItem('currentProjectDataId', id);
    Logger.debug('Saved ProjectData ID to localStorage:', id);
}

function clearProjectIds() {
    currentProjectId = null;
    currentProjectDataId = null;
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectDataId');
    resetAdminReviewDirtySections();
    resetCurrentProjectContext();
    Logger.debug('Cleared Project IDs');
}

// ==================== PROJECT LIST ====================

async function loadProjectList() {
    const tbody = document.getElementById('project-list-body');
    const loadingEl = document.getElementById('project-list-loading');
    const emptyEl = document.getElementById('project-list-empty');
    const tableWrapper = document.querySelector('.project-list-table-wrapper');

    syncProjectActionsColumn();

    if (loadingEl) loadingEl.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';

    // Hiển thị skeleton rows trong khi chờ load
    if (tbody) {
        tbody.innerHTML = '';
        const skeletonCellCount = canDeleteProjects() ? 8 : 7;
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            tr.innerHTML = '<td></td>'.repeat(skeletonCellCount);
            tbody.appendChild(tr);
        }
        if (tableWrapper) tableWrapper.style.display = 'block';
    }

    try {
        Logger.debug('DEBUG: loadProjectList called');
        const response = await fetchAPI(`${API_BASE_URL}/projects/my-projects`, {}, { showError: true });
        if (response.ok) {
            allProjects = await response.json();

            if (loadingEl) loadingEl.style.display = 'none';

            if (allProjects.length === 0) {
                if (tableWrapper) tableWrapper.style.display = 'none';
                if (emptyEl) {
                    emptyEl.innerHTML = '<i class="fa-solid fa-inbox"></i><p>Chưa có dự án nào. Hãy tạo dự án mới!</p>';
                    emptyEl.style.display = 'block';
                }
            } else {
                if (tableWrapper) tableWrapper.style.display = 'block';
                renderProjectList(allProjects);
            }
        } else {
            const errorMsg = await parseApiError(response);
            throw new Error(errorMsg);
        }
    } catch (error) {
        Logger.error('Error loading projects:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.innerHTML = `<i class="fa-solid fa-exclamation-triangle u-text-danger"></i><p class="u-text-danger">Lỗi tải dữ liệu: ${error.message}</p><button class="ui-btn ui-btn-primary ui-btn-sm" onclick="loadProjectList()"><i class="fa-solid fa-rotate"></i> Thử lại</button>`;
        }
    }
}

function renderProjectDeleteAction(project) {
    if (!canDeleteProjects()) return '';

    const projectId = escapeInlineHandlerArg(project.id);
    const projectName = escapeInlineHandlerArg(project.name);

    return `
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-action delete" title="Xóa dự án" aria-label="Xóa dự án" onclick="event.stopPropagation(); deleteProject('${projectId}', '${projectName}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>`;
}

function syncProjectActionsColumn() {
    document.querySelectorAll('.project-actions-column').forEach(el => {
        el.classList.toggle('is-hidden', !canDeleteProjects());
    });
}

function renderProjectList(projects) {
    const tbody = document.getElementById('project-list-body');
    if (!tbody) return;

    syncProjectActionsColumn();
    tbody.innerHTML = '';

    projects.forEach((project, index) => {
        const tr = document.createElement('tr');
        tr.onclick = () => openProject(project.id);

        const createdDate = project.createdAt ? formatDate(project.createdAt) : 'N/A';
        const modifiedDate = project.updatedAt ? formatDate(project.updatedAt) : 'N/A';
        const statusClass = getStatusClass(project.status);
        const statusText = getStatusText(project.status, project.statusRound);
        const actionsCellHtml = canDeleteProjects()
            ? `
            <td class="project-actions-column">
                <div class="project-actions">
${renderProjectDeleteAction(project)}
                </div>
            </td>`
            : '';

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="project-name-cell">${project.name || 'Chưa có tên'}</td>
            <td>${project.devUnit || 'N/A'}</td>
            <td>${project.ownerName || 'Chưa xác định'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="date-cell">${createdDate}</td>
            <td class="date-cell">${modifiedDate}</td>
${actionsCellHtml}
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

function getWorkflowActionContext() {
    const user = getCurrentUser();
    const role = (user.role || 'user').toLowerCase();
    const baseContext = {
        role,
        title: 'Kết luận giai đoạn',
        subtitle: 'Chốt nghiệp vụ và xem trước thông báo SMS liên quan.',
        buttonLabel: 'Kết luận giai đoạn',
        buttonIcon: 'fa-diagram-project',
        buttonTone: role,
        helperText: 'Lưu dữ liệu các tab trước khi chốt giai đoạn để đảm bảo xem trước thông báo chính xác.',
        disabledReason: '',
        options: []
    };

    if (!currentProjectId) {
        baseContext.disabledReason = 'Vui lòng lưu dự án trước khi kết luận giai đoạn.';
        return baseContext;
    }

    if (currentProjectStatus === 'HOAN_THANH') {
        baseContext.disabledReason = 'Dự án đã hoàn thành và đang ở chế độ chỉ đọc.';
        return baseContext;
    }

    if (role === 'admin1') {
        baseContext.title = 'Kết luận thẩm định';
        baseContext.buttonLabel = 'Kết luận thẩm định';
        baseContext.buttonIcon = 'fa-list-check';
        baseContext.helperText = 'Admin1 chốt kết quả thẩm định, có thể chuyển phê duyệt hoặc trả sizing lại.';
        baseContext.options = [
            {
                id: 'admin1_forward_approval',
                label: 'Đạt yêu cầu, chuyển phê duyệt',
                description: 'Chốt thẩm định đạt và chuyển dự án sang bước phê duyệt.',
                kind: 'transition',
                nextStatus: 'PHE_DUYET',
                eventLabel: 'Admin1 hoàn tất thẩm định',
                confirmLabel: 'Xác nhận chuyển phê duyệt'
            },
            {
                id: 'admin1_return_sizing',
                label: 'Chưa đạt, trả user sizing lại',
                description: 'Đưa dự án về sizing và tạo preview SMS thông báo nội dung cần sửa.',
                kind: 'transition',
                nextStatus: 'SIZING',
                eventLabel: 'Admin1 trả sizing lại',
                confirmLabel: 'Xác nhận trả sizing lại'
            }
        ];

        if (currentProjectStatus !== 'SIZING' && currentProjectStatus !== 'THAM_DINH') {
            baseContext.disabledReason = 'Admin1 chỉ kết luận khi dự án đang ở Sizing hoặc Thẩm định.';
        }
        return baseContext;
    }

    if (role === 'admin2') {
        baseContext.title = 'Kết luận phê duyệt';
        baseContext.buttonLabel = 'Kết luận phê duyệt';
        baseContext.buttonIcon = 'fa-stamp';
        baseContext.helperText = 'Admin2 chốt phê duyệt cuối cùng hoặc trả sizing lại cho user/admin1.';
        baseContext.options = [
            {
                id: 'admin2_approve_final',
                label: 'Phê duyệt hoàn tất',
                description: 'Phê duyệt dự án và chuyển sang trạng thái hoàn thành.',
                kind: 'approve',
                eventLabel: 'Admin2 phê duyệt xong',
                confirmLabel: 'Xác nhận phê duyệt'
            },
            {
                id: 'admin2_return_sizing',
                label: 'Chưa phê duyệt, trả sizing lại',
                description: 'Trả sizing lại và gửi preview thông báo cho user và reviewer liên quan.',
                kind: 'transition',
                nextStatus: 'SIZING',
                eventLabel: 'Admin2 trả sizing lại',
                confirmLabel: 'Xác nhận trả sizing lại'
            }
        ];

        if (currentProjectStatus !== 'THAM_DINH' && currentProjectStatus !== 'PHE_DUYET') {
            baseContext.disabledReason = 'Admin2 chỉ phê duyệt khi dự án đã qua bước thẩm định.';
        }
        return baseContext;
    }

    baseContext.title = 'Gửi kết quả sizing';
    baseContext.buttonLabel = 'Gửi kết quả sizing';
    baseContext.buttonIcon = 'fa-paper-plane';
    baseContext.helperText = 'User chốt kết quả sizing và preview thông báo cho bước thẩm định.';
    baseContext.options = [
        {
            id: 'user_submit_review',
            label: 'Hoàn tất sizing, gửi thẩm định',
            description: 'Chuyển dự án sang bước thẩm định và preview thông báo cho người liên quan.',
            kind: 'transition',
            nextStatus: 'THAM_DINH',
            eventLabel: 'User hoàn tất sizing',
            confirmLabel: 'Xác nhận chuyển thẩm định'
        }
    ];

    return baseContext;
}

function getDefaultWorkflowOption(options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    return options[0];
}

function getWorkflowOptionById(optionId, context = workflowModalRuntime?.context) {
    return (context?.options || []).find(option => option.id === optionId) || null;
}

function getActiveWorkflowOption() {
    return getWorkflowOptionById(workflowModalRuntime?.state?.optionId);
}

function getWorkflowFieldValue(fieldId, fallbackValue = '') {
    if (!workflowModalRuntime) return fallbackValue;
    const value = workflowModalRuntime.state.values[fieldId];
    return value === undefined ? fallbackValue : value;
}

function computeWorkflowOutcome(option) {
    if (!option) {
        return {
            status: currentProjectStatus || 'SIZING',
            round: currentProjectStatusRound || 1,
            statusText: getStatusText(currentProjectStatus || 'SIZING', currentProjectStatusRound || 1)
        };
    }

    const baseRound = currentProjectStatusRound || 1;
    const returningToSizing = option.nextStatus === 'SIZING' &&
        (currentProjectStatus === 'THAM_DINH' || currentProjectStatus === 'PHE_DUYET');
    const round = returningToSizing ? baseRound + 1 : baseRound;
    const status = option.kind === 'approve' ? 'HOAN_THANH' : option.nextStatus;

    return {
        status,
        round,
        statusText: getStatusText(status, round)
    };
}

function createWorkflowRecipient(label, detail, phone) {
    return {
        label,
        detail,
        phone,
        valid: hasValidPhone(phone)
    };
}

function buildWorkflowRecipients(option) {
    if (!option) return [];

    const reviewerLabel = currentProjectMeta.assignedAdmin1Name
        ? `${currentProjectMeta.assignedAdmin1Name}`
        : (currentProjectMeta.assignedAdmin1Id ? 'Người được chỉ định' : 'Chưa chỉ định admin1');

    const contactUnit = currentProjectMeta.contact.unit || currentProjectMeta.devUnit || 'Đầu mối dự án';
    const contactPhone = currentProjectMeta.contact.phone || '';
    const recipients = [];

    switch (option.id) {
        case 'user_submit_review':
            {
                const admin2Users = currentProjectMeta.admin2Users || [];
                if (admin2Users.length === 0) {
                    recipients.push(createWorkflowRecipient('Người thẩm định', 'Chưa có admin2 trong hệ thống', ''));
                } else {
                    admin2Users.forEach(admin2 => {
                        const name = admin2.displayName || admin2.username || admin2.email || 'Admin2';
                        recipients.push(createWorkflowRecipient('Người thẩm định', name, admin2.phoneNumber || ''));
                    });
                }
            }
            break;

        case 'admin1_forward_approval':
            {
                const admin2Users = currentProjectMeta.admin2Users || [];
                if (admin2Users.length === 0) {
                    recipients.push(createWorkflowRecipient('Admin2 phê duyệt', 'Chưa có admin2 trong hệ thống', ''));
                } else {
                    admin2Users.forEach(admin2 => {
                        const name = admin2.displayName || admin2.username || admin2.email || 'Admin2';
                        recipients.push(createWorkflowRecipient('Admin2 phê duyệt', name, admin2.phoneNumber || ''));
                    });
                }
            }
            break;

        case 'admin1_return_sizing':
            recipients.push(createWorkflowRecipient('Đầu mối sizing', contactUnit, contactPhone));
            {
                const admin2Users = currentProjectMeta.admin2Users || [];
                admin2Users.forEach(admin2 => {
                    const name = admin2.displayName || admin2.username || admin2.email || 'Admin2';
                    recipients.push(createWorkflowRecipient('Admin2', name, admin2.phoneNumber || ''));
                });
            }
            break;

        case 'admin2_approve_final':
            recipients.push(createWorkflowRecipient('Đầu mối sizing', contactUnit, contactPhone));
            recipients.push(createWorkflowRecipient('Người thẩm định', reviewerLabel, currentProjectMeta.assignedAdmin1Phone || ''));
            {
                const currentUserId = getCurrentUser().userId;
                const admin2Users = currentProjectMeta.admin2Users || [];
                admin2Users.forEach(admin2 => {
                    if (admin2.id === currentUserId) return; // exclude the one who is approving
                    const name = admin2.displayName || admin2.username || admin2.email || 'Admin2';
                    recipients.push(createWorkflowRecipient('Admin2', name, admin2.phoneNumber || ''));
                });
            }
            break;

        case 'admin2_return_sizing':
            recipients.push(createWorkflowRecipient('Đầu mối sizing', contactUnit, contactPhone));
            recipients.push(createWorkflowRecipient('Người thẩm định', reviewerLabel, currentProjectMeta.assignedAdmin1Phone || ''));
            {
                const currentUserId = getCurrentUser().userId;
                const admin2Users = currentProjectMeta.admin2Users || [];
                admin2Users.forEach(admin2 => {
                    if (admin2.id === currentUserId) return; // exclude the one who is returning
                    const name = admin2.displayName || admin2.username || admin2.email || 'Admin2';
                    recipients.push(createWorkflowRecipient('Admin2', name, admin2.phoneNumber || ''));
                });
            }
            break;

        default:
            break;
    }

    return recipients;
}

function getWorkflowArrayLabel(option, fieldId) {
    const field = (option?.fields || []).find(item => item.id === fieldId);
    const selectedValues = Array.isArray(getWorkflowFieldValue(fieldId, []))
        ? getWorkflowFieldValue(fieldId, [])
        : [];
    const labels = (field?.options || [])
        .filter(item => selectedValues.includes(item.value))
        .map(item => item.label);
    return labels.join(', ');
}

function removeDiacritics(input) {
    if (!input) return input;
    return input
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/Đ/g, 'D')
        .replace(/đ/g, 'd');
}

function buildWorkflowSmsPreview(option) {
    if (!option) return '';

    const projectName = removeDiacritics(currentProjectMeta.name) || 'Du an chua dat ten';

    switch (option.id) {
        case 'user_submit_review':
            return `He thong ${projectName} da duoc gui tham dinh. Vui long kiem tra va danh gia.`;

        case 'admin1_forward_approval':
            return `He thong ${projectName} da duoc Admin1 chuyen tien phep duyet. Vui long xem xet va phe duyet.`;

        case 'admin1_return_sizing':
            return `He thong ${projectName} da bi tra ve Sizing de chinh sua. Vui long kiem tra va cap nhat.`;

        case 'admin2_approve_final':
            return `He thong ${projectName} da duoc phe duyet hoan thanh.`;

        case 'admin2_return_sizing':
            return `He thong ${projectName} da bi tra ve Sizing de chinh sua. Vui long kiem tra va cap nhat.`;

        default:
            return `Thong bao He thong ${projectName}.`;
    }
}

function renderWorkflowRecipientList(recipients, emptyMessage = 'Chưa có người nhận dự kiến.') {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return `<div class="workflow-empty-state">${emptyMessage}</div>`;
    }

    return recipients.map(recipient => `
        <div class="workflow-recipient-item">
            <div class="workflow-recipient-main">
                <strong>${escapeHtml(recipient.label || '--')}</strong>
                <span>${escapeHtml(recipient.detail || 'Chưa có mô tả')}</span>
            </div>
            <span class="recipient-phone-badge ${recipient.valid ? 'valid' : 'missing'}">
                ${escapeHtml(recipient.valid ? maskPhone(recipient.phone) : 'Thiếu SĐT')}
            </span>
        </div>
    `).join('');
}

function renderWorkflowSummaryRecipientList(recipients) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return '<div class="workflow-empty-state">Chưa có người nhận dự kiến cho sự kiện này.</div>';
    }

    return recipients.map(recipient => `
        <div class="summary-recipient-item">
            <div class="summary-recipient-main">
                <strong>${escapeHtml(recipient.label || '--')}</strong>
                <span>${escapeHtml(recipient.detail || 'Chưa có mô tả')}</span>
            </div>
            <span class="recipient-phone-badge ${recipient.valid ? 'valid' : 'missing'}">
                ${escapeHtml(recipient.valid ? maskPhone(recipient.phone) : 'Thiếu SĐT')}
            </span>
        </div>
    `).join('');
}

function updateProjectContextPanel() {
    const projectDetailPage = document.getElementById('project-detail-page');
    const inProject = projectDetailPage && getComputedStyle(projectDetailPage).display !== 'none' && !!currentProjectId;
    if (!inProject) return;

    const activeOption = workflowModalRuntime
        ? (getActiveWorkflowOption() || getDefaultWorkflowOption(workflowModalRuntime.context.options))
        : getDefaultWorkflowOption(getWorkflowActionContext().options);

    const outcome = computeWorkflowOutcome(activeOption);
    const el = id => document.getElementById(id);

    if (el('workflow-outcome-status')) el('workflow-outcome-status').textContent = outcome.statusText;
    if (el('workflow-outcome-event')) el('workflow-outcome-event').textContent = activeOption?.eventLabel || '--';
    if (el('workflow-outcome-phase')) el('workflow-outcome-phase').textContent =
        activeOption?.kind === 'approve' ? 'Phê duyệt hoàn tất' : 'Chuyển trạng thái';
}

function createWorkflowRuntimeState() {
    const context = getWorkflowActionContext();
    return {
        context,
        state: { optionId: '', values: {} }
    };
}

function renderWorkflowOptionCards(context, selectedOptionId) {
    return (context.options || []).map(option => `
        <label class="workflow-option-card ${selectedOptionId === option.id ? 'selected' : ''}">
            <input type="radio" name="workflow-option" value="${escapeHtml(option.id)}"
                ${selectedOptionId === option.id ? 'checked' : ''}
                onchange="setWorkflowDecisionOption('${escapeHtml(option.id)}')">
            <strong>${escapeHtml(option.label)}</strong>
            <p>${escapeHtml(option.description)}</p>
        </label>
    `).join('');
}

function renderWorkflowField(option, field) {
    const currentValue = getWorkflowFieldValue(field.id, field.type === 'checkbox-group' ? [] : (field.type === 'checkbox' ? false : ''));
    const requiredMark = field.required ? '<span class="workflow-required">*</span>' : '';

    if (field.type === 'textarea') {
        return `
            <div class="workflow-field" id="workflow-field-${escapeHtml(field.id)}">
                <label for="workflow-input-${escapeHtml(field.id)}">${escapeHtml(field.label)} ${requiredMark}</label>
                <textarea id="workflow-input-${escapeHtml(field.id)}" rows="${field.rows || 3}"
                    placeholder="${escapeHtml(field.placeholder || '')}"
                    oninput="updateWorkflowModalValue('${escapeHtml(field.id)}', this.value)">${escapeHtml(currentValue || '')}</textarea>
            </div>
        `;
    }

    if (field.type === 'text' || field.type === 'date') {
        return `
            <div class="workflow-field" id="workflow-field-${escapeHtml(field.id)}">
                <label for="workflow-input-${escapeHtml(field.id)}">${escapeHtml(field.label)} ${requiredMark}</label>
                <input id="workflow-input-${escapeHtml(field.id)}" type="${field.type}"
                    value="${escapeHtml(currentValue || '')}"
                    placeholder="${escapeHtml(field.placeholder || '')}"
                    oninput="updateWorkflowModalValue('${escapeHtml(field.id)}', this.value)">
            </div>
        `;
    }

    if (field.type === 'select') {
        const optionsHtml = (field.options || []).map(item => `
            <option value="${escapeHtml(item.value)}" ${item.value === currentValue ? 'selected' : ''}>${escapeHtml(item.label)}</option>
        `).join('');

        return `
            <div class="workflow-field" id="workflow-field-${escapeHtml(field.id)}">
                <label for="workflow-input-${escapeHtml(field.id)}">${escapeHtml(field.label)} ${requiredMark}</label>
                <select id="workflow-input-${escapeHtml(field.id)}"
                    onchange="updateWorkflowModalValue('${escapeHtml(field.id)}', this.value)">${optionsHtml}</select>
            </div>
        `;
    }

    if (field.type === 'checkbox') {
        return `
            <div class="workflow-field" id="workflow-field-${escapeHtml(field.id)}">
                <label class="workflow-check-card">
                    <input type="checkbox" ${currentValue ? 'checked' : ''}
                        onchange="updateWorkflowModalChecked('${escapeHtml(field.id)}', this.checked)">
                    <span>${escapeHtml(field.label)} ${field.required ? '(bắt buộc)' : ''}</span>
                </label>
            </div>
        `;
    }

    if (field.type === 'checkbox-group') {
        const selectedValues = Array.isArray(currentValue) ? currentValue : [];
        const groupHtml = (field.options || []).map(item => `
            <label class="workflow-check-card">
                <input type="checkbox"
                    ${selectedValues.includes(item.value) ? 'checked' : ''}
                    onchange="updateWorkflowModalArrayField('${escapeHtml(field.id)}', '${escapeHtml(item.value)}', this.checked)">
                <span>${escapeHtml(item.label)}</span>
            </label>
        `).join('');

        return `
            <div class="workflow-field" id="workflow-field-${escapeHtml(field.id)}">
                <span class="workflow-field-legend">${escapeHtml(field.label)} ${requiredMark}</span>
                <div class="workflow-checkbox-group">${groupHtml}</div>
            </div>
        `;
    }

    return '';
}

function renderWorkflowFieldsForOption(option) {
    if (!option) return '<div class="workflow-empty-state">Không tìm thấy lựa chọn workflow phù hợp.</div>';

    const fieldsHtml = (option.fields || [])
        .map(field => renderWorkflowField(option, field))
        .join('');

    return fieldsHtml || '<div class="workflow-empty-state">Lựa chọn này không yêu cầu nhập thêm thông tin.</div>';
}

function renderWorkflowActionModal() {
    if (!workflowModalRuntime) return;

    const { context, state } = workflowModalRuntime;
    const option = getActiveWorkflowOption() || getDefaultWorkflowOption(context.options);

    document.getElementById('workflow-modal-kicker').textContent = context.buttonLabel;
    document.getElementById('workflow-modal-title').textContent = context.title;
    document.getElementById('workflow-modal-subtitle').textContent =
        `Dự án: ${currentProjectMeta.name || 'Chưa đặt tên'}`;

    document.getElementById('workflow-current-status').textContent =
        `Trạng thái hiện tại: ${getStatusText(currentProjectStatus || 'SIZING', currentProjectStatusRound || 1)}`;

    document.getElementById('workflow-option-list').innerHTML =
        renderWorkflowOptionCards(context, state.optionId);

    document.getElementById('workflow-form-title').textContent =
        option?.formTitle || 'Nội dung nghiệp vụ';

    document.getElementById('workflow-form-fields').innerHTML =
        renderWorkflowFieldsForOption(option);

    refreshWorkflowModalPreview();
}
function openWorkflowActionModal() {
    const context = getWorkflowActionContext();
    if (context.disabledReason) {
        showToast(context.disabledReason, 'warning');
        return;
    }

    workflowModalRuntime = createWorkflowRuntimeState();
    const modal = document.getElementById('workflow-action-modal');
    if (!modal) return;

    renderWorkflowActionModal();
    modal.style.display = 'flex';
}

function closeWorkflowActionModal() {
    const modal = document.getElementById('workflow-action-modal');
    if (modal) modal.style.display = 'none';
    workflowModalRuntime = null;
}

function setWorkflowDecisionOption(optionId) {
    if (!workflowModalRuntime) return;
    workflowModalRuntime.state.optionId = optionId;
    renderWorkflowActionModal();
}

function updateWorkflowModalValue(fieldId, value) {
    if (!workflowModalRuntime) return;
    workflowModalRuntime.state.values[fieldId] = value;
    clearWorkflowFieldError(fieldId);
    refreshWorkflowModalPreview();
}

function updateWorkflowModalChecked(fieldId, checked) {
    if (!workflowModalRuntime) return;
    workflowModalRuntime.state.values[fieldId] = !!checked;
    clearWorkflowFieldError(fieldId);
    refreshWorkflowModalPreview();
}

function updateWorkflowModalArrayField(fieldId, value, checked) {
    if (!workflowModalRuntime) return;
    const currentValues = Array.isArray(workflowModalRuntime.state.values[fieldId])
        ? [...workflowModalRuntime.state.values[fieldId]]
        : [];
    const nextValues = checked
        ? Array.from(new Set([...currentValues, value]))
        : currentValues.filter(item => item !== value);
    workflowModalRuntime.state.values[fieldId] = nextValues;
    clearWorkflowFieldError(fieldId);
    refreshWorkflowModalPreview();
}

function refreshWorkflowModalPreview() {
    if (!workflowModalRuntime) return;

    const option = getActiveWorkflowOption();
    const recipients = buildWorkflowRecipients(option);
    const confirmBtn = document.getElementById('workflow-confirm-btn');

    document.getElementById('workflow-recipient-list').innerHTML =
        renderWorkflowRecipientList(recipients);

    document.getElementById('workflow-sms-preview').textContent =
        buildWorkflowSmsPreview(option);

    const outcome = computeWorkflowOutcome(option);

    document.getElementById('workflow-outcome-status').textContent =
        escapeHtml(outcome.statusText);

    document.getElementById('workflow-outcome-event').textContent =
        escapeHtml(option?.eventLabel || 'Chưa sẵn sàng');

    document.getElementById('workflow-outcome-phase').textContent =
        escapeHtml(option?.kind === 'approve' ? 'Phê duyệt hoàn tất' : 'Chuyển trạng thái');

    if (confirmBtn) {
        confirmBtn.textContent = option?.confirmLabel || 'Xác nhận & thực hiện';
    }

    updateProjectContextPanel();
}

function clearWorkflowFieldError(fieldId) {
    const fieldEl = document.getElementById(`workflow-field-${fieldId}`);
    if (fieldEl) {
        fieldEl.querySelectorAll('input, textarea, select').forEach(el => el.classList.remove('workflow-field-error'));
    }
}

function markWorkflowFieldError(fieldId) {
    const fieldEl = document.getElementById(`workflow-field-${fieldId}`);
    if (fieldEl) {
        fieldEl.querySelectorAll('input, textarea, select').forEach(el => el.classList.add('workflow-field-error'));
    }
}

function validateWorkflowDecision(option) {
    const invalidFieldIds = [];
    (option?.fields || []).forEach(field => {
        const value = getWorkflowFieldValue(field.id, field.type === 'checkbox-group' ? [] : (field.type === 'checkbox' ? false : ''));
        if (!field.required) return;

        if (field.type === 'checkbox-group' && (!Array.isArray(value) || value.length === 0)) invalidFieldIds.push(field.id);
        else if (field.type === 'checkbox' && !value) invalidFieldIds.push(field.id);
        else if ((field.type === 'textarea' || field.type === 'text' || field.type === 'date' || field.type === 'select') && !String(value || '').trim()) invalidFieldIds.push(field.id);
    });

    invalidFieldIds.forEach(markWorkflowFieldError);
    return invalidFieldIds;
}

function buildWorkflowAuditEntry(option, executed) {
    const recipients = buildWorkflowRecipients(option);
    const outcome = computeWorkflowOutcome(option);
    return {
        createdAt: new Date().toISOString(),
        optionId: option?.id || 'unknown',
        optionLabel: option?.label || 'Không rõ hành động',
        outcomeText: outcome.statusText,
        smsEnabled: true,
        recipients: recipients,
        preview: buildWorkflowSmsPreview(option),
        executed: !!executed
    };
}

async function transitionProjectStatusDirect(nextStatus) {
    const response = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response.clone()));
    }

    return response.json();
}

function applyProjectStatusFromResponse(project) {
    if (!project) return;
    currentProjectStatus = project.status || currentProjectStatus || 'SIZING';
    currentProjectStatusRound = project.statusRound || currentProjectStatusRound || 1;
    setCurrentProjectMetaFromProject(project);
    updateProjectStatusDisplay();
    updateProjectContextPanel();
}

async function executeAdmin2ApprovalAction() {
    const dirtySectionId = getFirstDirtyAdminSectionId();

    if (dirtySectionId) {
        const dirtyIssue = buildApprovalIssue(
            dirtySectionId,
            `Có thay đổi đánh giá chưa lưu ở tab ${getSectionDisplayName(dirtySectionId)}. Vui lòng lưu trước khi phê duyệt.`,
            getFirstAdminReviewElementForSection(dirtySectionId)
        );

        showToast(dirtyIssue.message, 'warning');
        navigateToApprovalIssue(dirtyIssue);
        throw new Error('ApprovalBlocked');
    }

    const blockingIssues = collectApprovalBlockingIssues();

    if (blockingIssues.length > 0) {
        showToast('Không thể phê duyệt. Vui lòng hoàn tất đánh giá admin trước.', 'warning');
        navigateToApprovalIssue(blockingIssues[0]);
        throw new Error('ApprovalBlocked');
    }

    const response = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        const body = await parseApiErrorBody(response.clone());
        const firstServerIssue = body?.approvalIssues?.[0];
        if (firstServerIssue) {
            const sectionId = mapApprovalSectionToPage(firstServerIssue.section) || 'page-request';
            const fallbackIssue = buildApprovalIssue(
                sectionId,
                firstServerIssue.message || 'Không thể phê duyệt dự án.',
                getFirstAdminReviewElementForSection(sectionId, firstServerIssue.instanceKey || null),
                { instanceKey: firstServerIssue.instanceKey || null }
            );
            showToast(body?.message || fallbackIssue.message, 'warning');
            navigateToApprovalIssue(fallbackIssue);
        }
        throw new Error(await parseApiError(response.clone()));
    }

    return response.json();
}

async function confirmWorkflowDecision() {
    if (!workflowModalRuntime) return;

    const option = getActiveWorkflowOption();

    if (!option) {
        showToast('Vui lòng chọn một hướng xử lý.', 'warning');
        return;
    }

    const invalidFieldIds = validateWorkflowDecision(option);

    if (invalidFieldIds.length > 0) {
        showToast('Vui lòng hoàn thiện các trường bắt buộc trong modal.', 'warning');
        document.getElementById(`workflow-field-${invalidFieldIds[0]}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Validate admin2 users and phone numbers for options that send to admin2
    if (option.id === 'user_submit_review' || option.id === 'admin1_forward_approval' || option.id === 'admin1_return_sizing' || option.id === 'admin2_approve_final' || option.id === 'admin2_return_sizing') {
        const admin2Users = currentProjectMeta.admin2Users || [];
        if (admin2Users.length === 0) {
            showToast('Không có Admin2 nào trong hệ thống. Vui lòng tạo tài khoản Admin2 trước khi thực hiện.', 'warning');
            return;
        }
        const anyHasPhone = admin2Users.some(u => u.phoneNumber && hasValidPhone(u.phoneNumber));
        if (!anyHasPhone) {
            showToast('Không có Admin2 nào có số điện thoại hợp lệ. Vui lòng cập nhật SĐT cho Admin2 trước khi thực hiện.', 'warning');
            return;
        }
    }

    if (option.id === 'admin1_forward_approval') {
        const blockingIssues = collectApprovalBlockingIssues();

        if (blockingIssues.length > 0) {
            showToast('Vui lòng hoàn tất đánh giá admin trước khi chuyển phê duyệt.', 'warning');
            navigateToApprovalIssue(blockingIssues[0]);
            closeWorkflowActionModal();
            return;
        }
    }

    const confirmBtn = document.getElementById('workflow-confirm-btn');
    if (confirmBtn) confirmBtn.classList.add('btn-loading');

    showLoading(true, 'Đang xử lý workflow...');

    try {
        let updatedProject = null;

        if (option.kind === 'approve') {
            updatedProject = await executeAdmin2ApprovalAction();
        } else {
            updatedProject = await transitionProjectStatusDirect(option.nextStatus);
        }

        persistWorkflowUiRecord(buildWorkflowAuditEntry(option, true));
        resetAdminReviewDirtySections();
        applyProjectStatusFromResponse(updatedProject);

        try {
            applyRolePermissions();
        } catch (error) { }

        closeWorkflowActionModal();

        showToast('Đã cập nhật workflow thành công. UI thông báo SMS đã sẵn sàng cho backend.', 'success');

    } catch (error) {
        if (error.message === 'ApprovalBlocked') {
            closeWorkflowActionModal();
        } else {
            Logger.error('Workflow confirm error:', error);
            showToast('Lỗi khi xử lý workflow: ' + error.message, 'error');
        }
    } finally {
        showLoading(false);

        if (confirmBtn) {
            confirmBtn.classList.remove('btn-loading');
        }
    }
}

function filterProjects() {
    const searchText = document.getElementById('search-project')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';

    // Show/hide clear button
    const clearBtn = document.getElementById('btn-clear-search');
    if (clearBtn) clearBtn.style.display = searchText ? 'flex' : 'none';

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

function clearProjectSearch() {
    const searchInput = document.getElementById('search-project');
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    const clearBtn = document.getElementById('btn-clear-search');
    if (clearBtn) clearBtn.style.display = 'none';
    filterProjects();
}

// ==================== PROJECT STATUS MANAGEMENT ====================

/**
 * Cập nhật hiển thị trạng thái dự án trên UI
 */
function updateProjectStatusDisplay() {
    const statusBadge = document.getElementById('current-project-status');

    const statusClass = getStatusClass(currentProjectStatus);
    const statusText = getStatusText(currentProjectStatus, currentProjectStatusRound);

    if (statusBadge) {
        statusBadge.className = `project-status-badge ${statusClass}`;
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${statusText}`;
        statusBadge.style.display = 'inline-flex';
    }
    updateProjectContextPanel();

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
            // Admin2 phê duyệt: Thẩm định/Phê duyệt -> Hoàn thành
            if (currentProjectStatus === 'THAM_DINH' || currentProjectStatus === 'PHE_DUYET') {
                newStatus = 'HOAN_THANH';
            }
            break;
    }

    // Nếu không thay đổi thì không cần update
    if (newStatus === currentProjectStatus && newRound === currentProjectStatusRound) {
        return;
    }

    try {
        const response = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: newStatus,
                statusRound: newRound
            })
        });

        if (response.ok) {
            currentProjectStatus = newStatus;
            currentProjectStatusRound = newRound;
            updateProjectStatusDisplay();
            Logger.debug(`✅ Đã cập nhật trạng thái: ${newStatus} lần ${newRound}`);
        }
    } catch (error) {
        Logger.error('Lỗi cập nhật trạng thái:', error);
    }
}

/**
 * Hiển thị/ẩn nút Phê duyệt dự án cho admin2
 */
function mapApprovalSectionToPage(section) {
    switch (section) {
        case 'request': return 'page-request';
        case 'input': return 'page-input';
        case 'model': return 'page-model';
        case 'sizing': return 'page-sizing';
        case 'summary': return 'page-summary';
        default: return null;
    }
}

function validateRequestApprovalIssues(issues) {
    let reviewCount = 0;
    document.querySelectorAll('#request-table-body tr').forEach((row, index) => {
        const found = addApprovalFieldIssue(issues, 'page-request', row.cells[2]?.querySelector('select.admin-eval'), `Tab ${getSectionDisplayName('page-request')} - dòng ${index + 1} phải được đánh giá OK.`, { rowIndex: index });
        if (found) reviewCount++;
    });
    if (reviewCount === 0) {
        issues.push(buildApprovalIssue('page-request', `Tab ${getSectionDisplayName('page-request')} chưa được đánh giá.`, getFirstAdminReviewElementForSection('page-request')));
    }
}

function validateInputApprovalIssues(issues) {
    let reviewCount = 0;
    document.querySelectorAll('#input-table-body tr').forEach((row, index) => {
        const found = addApprovalFieldIssue(issues, 'page-input', row.cells[6]?.querySelector('select.admin-eval'), `Tab ${getSectionDisplayName('page-input')} - dòng ${index + 1} phải được đánh giá OK.`, { rowIndex: index });
        if (found) reviewCount++;
    });
    if (reviewCount === 0) {
        issues.push(buildApprovalIssue('page-input', `Tab ${getSectionDisplayName('page-input')} chưa được đánh giá.`, getFirstAdminReviewElementForSection('page-input')));
    }
}

function validateModelApprovalIssues(issues) {
    let reviewCount = 0;
    [
        { id: 'eval-physical', label: 'Mô hình vật lý' },
        { id: 'eval-logical', label: 'Mô hình logic' },
        { id: 'eval-flow', label: 'Luồng nghiệp vụ' }
    ].forEach(item => {
        const found = addApprovalFieldIssue(issues, 'page-model', document.getElementById(item.id), `Tab ${getSectionDisplayName('page-model')} - ${item.label} phải được đánh giá OK.`, { fieldKey: item.id });
        if (found) reviewCount++;
    });

    document.querySelectorAll('#arch-table-body tr').forEach((row, index) => {
        const found = addApprovalFieldIssue(issues, 'page-model', row.cells[6]?.querySelector('.admin-eval-select'), `Tab ${getSectionDisplayName('page-model')} - bảng thành phần/dòng ${index + 1} phải được đánh giá OK.`, { rowIndex: index, fieldKey: 'archRowReviews' });
        if (found) reviewCount++;
    });

    document.querySelectorAll('#connection-info-table-body tr').forEach((row, index) => {
        const found = addApprovalFieldIssue(issues, 'page-model', row.cells[6]?.querySelector('.admin-eval-select'), `Tab ${getSectionDisplayName('page-model')} - bảng kết nối/dòng ${index + 1} phải được đánh giá OK.`, { rowIndex: index, fieldKey: 'connectionRowReviews' });
        if (found) reviewCount++;
    });

    if (reviewCount === 0) {
        issues.push(buildApprovalIssue('page-model', `Tab ${getSectionDisplayName('page-model')} chưa được đánh giá.`, getFirstAdminReviewElementForSection('page-model')));
    }
}

function validateSizingInstanceApproval(instance, issues, tracker) {
    const sectionId = 'page-sizing';
    const instanceKey = getModuleInstanceKey(instance);
    const instanceLabel = getModuleInstanceDisplayName(instance);
    const redisSelectedMethod = document.getElementById('redis-method-key')?.classList.contains('active') ? 'key' : 'config';
    const kafkaSelectedMethod = document.getElementById('kafka-method-throughput')?.classList.contains('active') ? 'throughput' : 'linear';
    const lbfwSelectedMethod = document.getElementById('lbfw-method-select')?.value || 'bandwidthMethod';
    const customSelectedMethod = document.getElementById('custom-method-select')?.value || 'linearEquivalentApp';
    const addInstanceIssue = (element, label, extra = {}) => {
        const found = addApprovalFieldIssue(issues, sectionId, element, `Tab ${getSectionDisplayName(sectionId)} - ${instanceLabel} - ${label} phải được đánh giá OK.`, Object.assign({ instanceKey }, extra));
        if (found) tracker.count++;
    };

    switch (instance.moduleType) {
        case 'App':
            addInstanceIssue(document.getElementById('eval-module-app'), 'đánh giá tổng quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('app-flavor-eval'), 'đánh giá flavor', { fieldKey: 'flavorReview' });
            document.querySelectorAll('#baseline-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.admin-eval-select'), `baseline dòng ${index + 1}`, { rowIndex: index, fieldKey: 'baselineRowReviews' }));
            document.querySelectorAll('#input-config-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.input-config-eval'), `input config dòng ${index + 1}`, { rowIndex: index, fieldKey: 'inputConfigRowReviews' }));
            document.querySelectorAll('#storage-input-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.storage-eval'), `storage dòng ${index + 1}`, { rowIndex: index, fieldKey: 'storageRowReviews' }));
            break;
        case 'MariaDB':
            addInstanceIssue(document.getElementById('eval-module-mariadb'), 'đánh giá tổng quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('eval-mariadb-storage'), 'đánh giá storage', { fieldKey: 'storageReview' });
            document.querySelectorAll('#mariadb-ref-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.mariadb-ref-eval'), `ref dòng ${index + 1}`, { rowIndex: index, fieldKey: 'refRowReviews' }));
            break;
        case 'Redis':
            addInstanceIssue(document.getElementById('eval-module-redis'), 'đánh giá tổng quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('eval-redis-key-method'), 'đánh giá phương án key', { fieldKey: 'keyMethodReview' });
            addInstanceIssue(document.getElementById('eval-redis-config-method'), 'đánh giá phương án cấu hình', { fieldKey: 'configMethodReview' });
            document.querySelectorAll('#redis-config-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.redis-config-eval'), `config dòng ${index + 1}`, { rowIndex: index, fieldKey: 'configRowReviews' }));
            break;
        case 'Kafka':
            addInstanceIssue(document.getElementById('eval-module-kafka'), 'đánh giá tổng quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('eval-kafka-throughput-method'), 'đánh giá phương án throughput', { fieldKey: 'throughputMethodReview' });
            addInstanceIssue(document.getElementById('eval-kafka-linear-method'), 'đánh giá phương án linear', { fieldKey: 'linearMethodReview' });
            getKafkaLinearRows().forEach((row, index) => addInstanceIssue(row.querySelector('.kafka-linear-eval'), `linear dòng ${index + 1}`, { rowIndex: index, fieldKey: 'linearRowReviews' }));
            break;
        case 'K8S':
            addInstanceIssue(document.getElementById('eval-module-k8s'), 'đánh giá tổng quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('k8s-flavor-eval'), 'đánh giá flavor', { fieldKey: 'flavorReview' });
            getK8SBaselineRows().forEach((row, index) => addInstanceIssue(row.querySelector('.k8s-baseline-eval'), `baseline dòng ${index + 1}`, { rowIndex: index, fieldKey: 'baselineRowReviews' }));
            getK8SInputConfigRows().forEach((row, index) => addInstanceIssue(row.querySelector('.k8s-input-config-eval'), `input config dòng ${index + 1}`, { rowIndex: index, fieldKey: 'inputConfigRowReviews' }));
            document.querySelectorAll('#k8s-storage-input-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.k8s-storage-eval'), `storage dòng ${index + 1}`, { rowIndex: index, fieldKey: 'storageRowReviews' }));
            break;
        case 'LB/FW':
            addInstanceIssue(document.getElementById('eval-lbfw-linear-method'), 'đánh giá phương án linear', { fieldKey: 'linearMethodReview' });
            addInstanceIssue(document.getElementById('eval-lbfw-custom-method'), 'đánh giá phương án custom', { fieldKey: 'customMethodReview' });
            document.querySelectorAll('#lbfw-custom-proposal-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.lbfw-custom-proposal-eval'), `proposal dòng ${index + 1}`, { rowIndex: index, fieldKey: 'proposalRowReviews' }));
            break;
        case 'Khác':
        case 'KhÃ¡c':
            if (customSelectedMethod === 'customMethod') {
                addInstanceIssue(document.getElementById('eval-custom-method'), 'đánh giá phương án custom', { fieldKey: 'customMethodReview' });
                document.querySelectorAll('#custom-proposal-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.custom-proposal-eval'), `proposal dòng ${index + 1}`, { rowIndex: index, fieldKey: 'proposalRowReviews' }));
            } else {
                addInstanceIssue(document.getElementById('eval-custom-linear-method'), 'đánh giá phương án linear', { fieldKey: 'linearMethodReview' });
                document.querySelectorAll('#custom-baseline-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.admin-eval-select'), `baseline dòng ${index + 1}`, { rowIndex: index, fieldKey: 'baselineRowReviews' }));
                document.querySelectorAll('#custom-input-config-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.custom-input-config-eval'), `input config dòng ${index + 1}`, { rowIndex: index, fieldKey: 'inputConfigRowReviews' }));
                document.querySelectorAll('#custom-storage-input-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.custom-storage-eval'), `storage dòng ${index + 1}`, { rowIndex: index, fieldKey: 'storageRowReviews' }));
            }
            break;
    }
}

function validateSizingApprovalIssues(issues) {
    const instances = getModuleInstancesFromArchTable();
    if (!instances.length) {
        issues.push(buildApprovalIssue('page-sizing', `Tab ${getSectionDisplayName('page-sizing')} chưa có module cần đánh giá.`, getFirstAdminReviewElementForSection('page-sizing')));
        return;
    }

    const tracker = { count: 0 };
    instances.forEach(instance => {
        runInInstanceContext(getModuleInstanceKey(instance), () => validateSizingInstanceApproval(instance, issues, tracker));
    });

    if (tracker.count === 0) {
        const firstInstanceKey = getModuleInstanceKey(instances[0]);
        issues.push(buildApprovalIssue('page-sizing', `Tab ${getSectionDisplayName('page-sizing')} chưa được đánh giá.`, getFirstAdminReviewElementForSection('page-sizing', firstInstanceKey), { instanceKey: firstInstanceKey }));
    }
}

function validateSummaryApprovalIssues(issues) {
    const found = addApprovalFieldIssue(issues, 'page-summary', document.getElementById('eval-summary'), `Tab ${getSectionDisplayName('page-summary')} phải được đánh giá OK.`, { fieldKey: 'summary' });
    if (!found) {
        issues.push(buildApprovalIssue('page-summary', `Tab ${getSectionDisplayName('page-summary')} chưa được đánh giá.`, getFirstAdminReviewElementForSection('page-summary')));
    }
}

function collectApprovalBlockingIssues() {
    const issues = [];
    validateRequestApprovalIssues(issues);
    validateInputApprovalIssues(issues);
    validateModelApprovalIssues(issues);
    validateSizingApprovalIssues(issues);
    validateSummaryApprovalIssues(issues);
    return issues;
}

function validateSizingInstanceApproval(instance, issues, tracker) {
    const sectionId = 'page-sizing';
    const instanceKey = getModuleInstanceKey(instance);
    const instanceLabel = getModuleInstanceDisplayName(instance);
    const redisSelectedMethod = document.getElementById('redis-method-key')?.classList.contains('active') ? 'key' : 'config';
    const kafkaSelectedMethod = document.getElementById('kafka-method-throughput')?.classList.contains('active') ? 'throughput' : 'linear';
    const lbfwSelectedMethod = document.getElementById('lbfw-method-select')?.value || 'bandwidthMethod';
    const customSelectedMethod = document.getElementById('custom-method-select')?.value || 'linearEquivalentApp';
    const addInstanceIssue = (element, label, extra = {}) => {
        const found = addApprovalFieldIssue(issues, sectionId, element, `Tab ${getSectionDisplayName(sectionId)} - ${instanceLabel} - ${label} phai duoc danh gia OK.`, Object.assign({ instanceKey }, extra));
        if (found) tracker.count++;
    };

    switch (instance.moduleType) {
        case 'App':
            addInstanceIssue(document.getElementById('eval-module-app'), 'danh gia tong quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('app-flavor-eval'), 'danh gia flavor', { fieldKey: 'flavorReview' });
            document.querySelectorAll('#baseline-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.admin-eval-select'), `baseline dong ${index + 1}`, { rowIndex: index, fieldKey: 'baselineRowReviews' }));
            document.querySelectorAll('#input-config-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.input-config-eval'), `input config dong ${index + 1}`, { rowIndex: index, fieldKey: 'inputConfigRowReviews' }));
            document.querySelectorAll('#storage-input-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.storage-eval'), `storage dong ${index + 1}`, { rowIndex: index, fieldKey: 'storageRowReviews' }));
            break;
        case 'MariaDB':
            addInstanceIssue(document.getElementById('eval-module-mariadb'), 'danh gia tong quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('eval-mariadb-storage'), 'danh gia storage', { fieldKey: 'storageReview' });
            document.querySelectorAll('#mariadb-ref-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.mariadb-ref-eval'), `ref dong ${index + 1}`, { rowIndex: index, fieldKey: 'refRowReviews' }));
            break;
        case 'Redis':
            addInstanceIssue(document.getElementById('eval-module-redis'), 'danh gia tong quan', { fieldKey: 'overallReview' });
            if (redisSelectedMethod === 'key') {
                addInstanceIssue(document.getElementById('eval-redis-key-method'), 'danh gia phuong an key', { fieldKey: 'keyMethodReview' });
            } else {
                addInstanceIssue(document.getElementById('eval-redis-config-method'), 'danh gia phuong an cau hinh', { fieldKey: 'configMethodReview' });
                document.querySelectorAll('#redis-config-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.redis-config-eval'), `config dong ${index + 1}`, { rowIndex: index, fieldKey: 'configRowReviews' }));
            }
            break;
        case 'Kafka':
            addInstanceIssue(document.getElementById('eval-module-kafka'), 'danh gia tong quan', { fieldKey: 'overallReview' });
            if (kafkaSelectedMethod === 'throughput') {
                addInstanceIssue(document.getElementById('eval-kafka-throughput-method'), 'danh gia phuong an throughput', { fieldKey: 'throughputMethodReview' });
            } else {
                addInstanceIssue(document.getElementById('eval-kafka-linear-method'), 'danh gia phuong an linear', { fieldKey: 'linearMethodReview' });
                getKafkaLinearRows().forEach((row, index) => addInstanceIssue(row.querySelector('.kafka-linear-eval'), `linear dong ${index + 1}`, { rowIndex: index, fieldKey: 'linearRowReviews' }));
            }
            break;
        case 'K8S':
            addInstanceIssue(document.getElementById('eval-module-k8s'), 'danh gia tong quan', { fieldKey: 'overallReview' });
            addInstanceIssue(document.getElementById('k8s-flavor-eval'), 'danh gia flavor', { fieldKey: 'flavorReview' });
            getK8SBaselineRows().forEach((row, index) => addInstanceIssue(row.querySelector('.k8s-baseline-eval'), `baseline dong ${index + 1}`, { rowIndex: index, fieldKey: 'baselineRowReviews' }));
            getK8SInputConfigRows().forEach((row, index) => addInstanceIssue(row.querySelector('.k8s-input-config-eval'), `input config dong ${index + 1}`, { rowIndex: index, fieldKey: 'inputConfigRowReviews' }));
            document.querySelectorAll('#k8s-storage-input-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.k8s-storage-eval'), `storage dong ${index + 1}`, { rowIndex: index, fieldKey: 'storageRowReviews' }));
            break;
        case 'LB/FW':
            if (lbfwSelectedMethod === 'customMethod') {
                addInstanceIssue(document.getElementById('eval-lbfw-custom-method'), 'danh gia phuong an custom', { fieldKey: 'customMethodReview' });
                document.querySelectorAll('#lbfw-custom-proposal-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.lbfw-custom-proposal-eval'), `proposal dong ${index + 1}`, { rowIndex: index, fieldKey: 'proposalRowReviews' }));
            } else {
                addInstanceIssue(document.getElementById('eval-lbfw-linear-method'), 'danh gia phuong an linear', { fieldKey: 'linearMethodReview' });
            }
            break;
        case 'Khác':
        case 'KhÃ¡c':
            if (customSelectedMethod === 'customMethod') {
                addInstanceIssue(document.getElementById('eval-custom-method'), 'danh gia phuong an custom', { fieldKey: 'customMethodReview' });
                document.querySelectorAll('#custom-proposal-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.custom-proposal-eval'), `proposal dong ${index + 1}`, { rowIndex: index, fieldKey: 'proposalRowReviews' }));
            } else {
                addInstanceIssue(document.getElementById('eval-custom-linear-method'), 'danh gia phuong an linear', { fieldKey: 'linearMethodReview' });
                document.querySelectorAll('#custom-baseline-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.admin-eval-select'), `baseline dong ${index + 1}`, { rowIndex: index, fieldKey: 'baselineRowReviews' }));
                document.querySelectorAll('#custom-input-config-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.custom-input-config-eval'), `input config dong ${index + 1}`, { rowIndex: index, fieldKey: 'inputConfigRowReviews' }));
                document.querySelectorAll('#custom-storage-input-table-body tr').forEach((row, index) => addInstanceIssue(row.querySelector('.custom-storage-eval'), `storage dong ${index + 1}`, { rowIndex: index, fieldKey: 'storageRowReviews' }));
            }
            break;
    }
}

function updateApproveButtonVisibility() {
    const approveHeaderBtn = document.getElementById('btn-approve-header');
    if (!approveHeaderBtn) return;

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();

    // Nút phê duyệt luôn hiển thị trên header khi đang ở trong project detail
    const projectDetailPage = document.getElementById('project-detail-page');
    const inProject = projectDetailPage && getComputedStyle(projectDetailPage).display !== 'none';
    approveHeaderBtn.style.display = inProject ? 'inline-flex' : 'none';

    // Chỉ admin2 mới bấm được, enable khi dự án ở trạng thái THAM_DINH hoặc PHE_DUYET
    const canApprove = (role === 'admin2' && (currentProjectStatus === 'THAM_DINH' || currentProjectStatus === 'PHE_DUYET'));
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
        showToast('Chỉ admin2 mới có quyền phê duyệt dự án.', 'warning');
        return;
    }
    if (currentProjectStatus !== 'THAM_DINH' && currentProjectStatus !== 'PHE_DUYET') {
        showToast('Dự án chưa sẵn sàng để phê duyệt.', 'warning');
        return;
    }
    const confirmed = await showConfirm(
        'Phê duyệt dự án',
        'Bạn có chắc muốn phê duyệt dự án này?<br>Dự án sẽ chuyển sang trạng thái <strong>Hoàn thành</strong>.',
        { confirmText: 'Phê duyệt', cancelText: 'Hủy' }
    );
    if (!confirmed) return;

    showLoading(true, 'Đang phê duyệt dự án...');
    await updateProjectStatus('admin2_approve');
    showLoading(false);
    showToast('Dự án đã được phê duyệt thành công!', 'success');
}

approveProject = async function () {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin2') {
        showToast('Chỉ admin2 mới có quyền phê duyệt dự án.', 'warning');
        return;
    }
    if (currentProjectStatus !== 'THAM_DINH' && currentProjectStatus !== 'PHE_DUYET') {
        showToast('Dự án chưa sẵn sàng để phê duyệt.', 'warning');
        return;
    }

    const dirtySectionId = getFirstDirtyAdminSectionId();
    if (dirtySectionId) {
        const dirtyIssue = buildApprovalIssue(
            dirtySectionId,
            `Có thay đổi đánh giá chưa lưu ở tab ${getSectionDisplayName(dirtySectionId)}. Vui lòng lưu/gửi đánh giá trước khi phê duyệt.`,
            getFirstAdminReviewElementForSection(dirtySectionId)
        );
        showToast(dirtyIssue.message, 'warning');
        navigateToApprovalIssue(dirtyIssue);
        return;
    }

    const blockingIssues = collectApprovalBlockingIssues();
    if (blockingIssues.length > 0) {
        showToast('Không thể phê duyệt. Vui lòng hoàn tất đánh giá admin và bảo đảm tất cả đều OK.', 'warning');
        navigateToApprovalIssue(blockingIssues[0]);
        return;
    }

    const confirmed = await showConfirm(
        'Phê duyệt dự án',
        'Bạn có chắc muốn phê duyệt dự án này?<br>Dự án sẽ chuyển sang trạng thái <strong>Hoàn thành</strong>.',
        { confirmText: 'Phê duyệt', cancelText: 'Hủy' }
    );
    if (!confirmed) return;

    showLoading(true, 'Đang phê duyệt dự án...');
    try {
        const response = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const body = await parseApiErrorBody(response.clone());
            const firstServerIssue = body?.approvalIssues?.[0];
            if (firstServerIssue) {
                const sectionId = mapApprovalSectionToPage(firstServerIssue.section) || 'page-request';
                const fallbackIssue = buildApprovalIssue(
                    sectionId,
                    firstServerIssue.message || 'Không thể phê duyệt dự án.',
                    getFirstAdminReviewElementForSection(sectionId, firstServerIssue.instanceKey || null),
                    { instanceKey: firstServerIssue.instanceKey || null }
                );
                showToast(body?.message || fallbackIssue.message, 'warning');
                navigateToApprovalIssue(fallbackIssue);
                return;
            }
            throw new Error(await parseApiError(response.clone()));
        }

        const approvedProject = await response.json();
        currentProjectStatus = approvedProject.status || 'HOAN_THANH';
        currentProjectStatusRound = approvedProject.statusRound || currentProjectStatusRound;
        updateProjectStatusDisplay();
        resetAdminReviewDirtySections();
        applyRolePermissions();
        showToast('Dự án đã được phê duyệt thành công!', 'success');
    } catch (error) {
        Logger.error('Approve error:', error);
        showToast('Lỗi khi phê duyệt dự án: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
};

updateApproveButtonVisibility = function () {
    const legacyApproveBtn = document.getElementById('btn-approve-header');
    const workflowBtn = document.getElementById('btn-workflow-header');
    if (legacyApproveBtn) legacyApproveBtn.style.display = 'none';
    if (!workflowBtn) return;

    const context = getWorkflowActionContext();
    const projectDetailPage = document.getElementById('project-detail-page');
    const inProject = projectDetailPage && getComputedStyle(projectDetailPage).display !== 'none';
    workflowBtn.style.display = inProject ? 'inline-flex' : 'none';

    if (!inProject) return;

    workflowBtn.innerHTML = `<i class="fa-solid ${context.buttonIcon || 'fa-diagram-project'}"></i> ${context.buttonLabel || 'Ket luan giai doan'}`;
    workflowBtn.disabled = !!context.disabledReason;
    workflowBtn.style.opacity = '';
    workflowBtn.style.cursor = '';
    workflowBtn.title = context.disabledReason || context.helperText || context.buttonLabel;
    workflowBtn.classList.remove(
        'is-user-action',
        'is-admin1-action',
        'is-admin2-action',
        'ui-btn-primary',
        'ui-btn-success',
        'ui-btn-warning'
    );

    if (context.role === 'admin1') workflowBtn.classList.add('is-admin1-action', 'ui-btn-warning');
    else if (context.role === 'admin2') workflowBtn.classList.add('is-admin2-action', 'ui-btn-success');
    else workflowBtn.classList.add('is-user-action', 'ui-btn-success');
};

approveProject = async function () {
    openWorkflowActionModal();
};

async function openProject(projectId, options = {}) {
    saveProjectIdToStorage(projectId);
    resetCurrentProjectContext();

    showLoading(true, 'Đang tải dữ liệu dự án...');

    document.getElementById('project-list-page').style.display = 'none';
    document.getElementById('project-detail-page').style.display = 'flex';
    document.getElementById('btn-back-to-list').style.display = 'inline-block';
    updateProjectContextPanel();

    // Hiển thị tab được chỉ định hoặc page-request mặc định
    const targetTab = options.tab || 'page-request';
    showSection(targetTab, document.querySelector(`.side-menu a[onclick*="${targetTab}"]`), { skipPushState: true });

    currentProjectDataId = null;
    localStorage.removeItem('currentProjectDataId');
    revisionCheckedForSession = false; // Reset revision check cho project mới

    // Reset toàn bộ form trước khi load dữ liệu mới để tránh hiển thị dữ liệu cũ từ dự án trước
    resetAllForms();

    try {
        await loadAllDataFromDB();

        // Kiểm tra session editor: nếu account mới mở project -> tạo revision cho account cũ
        const user = getCurrentUser();
        const currentUsername = user.username || user.displayName || 'unknown';
        await checkAndCreateRevisionForPreviousEditor(currentUsername);
        revisionCheckedForSession = true; // Đã check xong

        // Cập nhật nút Phê duyệt sau khi load dữ liệu
        updateApproveButtonVisibility();
    } catch (error) {
        Logger.error('Error loading project:', error);
        showToast('Lỗi khi tải dự án: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }

    // Cập nhật URL/history
    if (!options.skipPushState) {
        pushAppState('project', projectId, targetTab);
    }
}

function showProjectList(options = {}) {
    document.getElementById('project-list-page').style.display = 'block';
    document.getElementById('project-detail-page').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';
    closeWorkflowActionModal();
    updateProjectContextPanel();

    // Ẩn nút Phê duyệt khi không ở trong dự án
    updateApproveButtonVisibility();

    loadProjectList();

    // Cập nhật URL/history
    if (!options.skipPushState) {
        pushAppState('projects', null, null);
    }
}

async function deleteProject(projectId, projectName) {
    if (!canDeleteProjects()) {
        showToast('Bạn không có quyền xóa dự án.', 'error');
        return;
    }

    const confirmed = await showConfirm(
        'Xóa dự án',
        `Bạn có chắc muốn xóa dự án "<strong>${projectName}</strong>"?<br>Thao tác này không thể hoàn tác.`,
        { confirmText: 'Xóa dự án', danger: true }
    );
    if (!confirmed) return;

    showLoading(true, 'Đang xóa dự án...');

    try {
        const response = await fetchAPI(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'DELETE'
        }, { showError: false });

        showLoading(false);

        if (response.ok) {
            showToast('Xóa dự án thành công!', 'success');
            loadProjectList();
        } else if (response.status !== 403) {
            const errorMsg = await parseApiError(response);
            showToast('Lỗi xóa dự án: ' + errorMsg, 'error');
        }
    } catch (error) {
        showLoading(false);
        Logger.error('Error deleting project:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

async function startNewProject() {
    const user = getCurrentUser();
    const projectName = 'Dự án mới - ' + new Date().toLocaleString('vi-VN');

    showLoading(true, 'Đang tạo dự án mới...');

    try {
        const response = await fetchAPI(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                ownerName: user.displayName || user.username || 'Chưa xác định',
                status: 'SIZING',
                statusRound: 1
            })
        }, { showError: true });

        showLoading(false);

        if (response.ok) {
            const project = await response.json();
            saveProjectIdToStorage(project.id);
            resetCurrentProjectContext();
            setCurrentProjectMetaFromProject(project);

            // Cập nhật trạng thái dự án
            currentProjectStatus = 'SIZING';
            currentProjectStatusRound = 1;
            updateProjectStatusDisplay();

            document.getElementById('project-list-page').style.display = 'none';
            document.getElementById('project-detail-page').style.display = 'flex';
            document.getElementById('btn-back-to-list').style.display = 'inline-block';
            updateProjectContextPanel();

            resetAllForms();
            await loadAllDataFromDB();

            // Cập nhật URL/history cho dự án mới
            pushAppState('project', project.id, 'page-request');

            showToast('Tạo dự án mới thành công!', 'success');
            Logger.debug('Created new project:', project.id);
        } else {
            const errorMsg = await parseApiError(response);
            showToast('Lỗi tạo dự án: ' + errorMsg, 'error');
        }
    } catch (error) {
        showLoading(false);
        Logger.error('Error creating project:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

function resetAllForms() {
    // Reset inputs, textareas, selects
    document.querySelectorAll('input').forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
    document.querySelectorAll('textarea').forEach(ta => ta.value = '');
    document.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
        select.classList.remove('status-ok', 'status-nok');
    });

    // Reset bảng input - sử dụng createInputTableRow để đảm bảo đúng cấu trúc có upload ảnh
    const inputBody = document.getElementById('input-table-body');
    if (inputBody) {
        inputBody.innerHTML = '';
        const tr = createInputTableRow(1);
        inputBody.appendChild(tr);
    }

    // ========== CLEAR MÔ HÌNH HỆ THỐNG ==========
    // Clear image containers (physical, logical, flow)
    ['container-physical', 'container-logical', 'container-flow'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    // Clear architecture table
    const archBody = document.getElementById('arch-table-body');
    if (archBody) {
        archBody.innerHTML = '';
        const tr = createArchTableRow(1, {});
        tr.dataset.rowId = 'arch-row-' + (++archRowIdCounter);
        archBody.appendChild(tr);
    }

    // Clear logic component table
    const logicBody = document.getElementById('logic-component-table-body');
    if (logicBody) {
        logicBody.innerHTML = '';
        logicBody.appendChild(createLogicComponentTableRow(1, {}));
    }

    // Clear connection info table
    const connBody = document.getElementById('connection-info-table-body');
    if (connBody) {
        connBody.innerHTML = '';
        connBody.appendChild(createConnectionTableRow(1, {}));
    }

    // ========== CLEAR ĐỊNH CỠ HỆ THỐNG ==========
    // Clear all sizing table bodies
    [
        'baseline-table-body',
        'input-config-table-body',
        'storage-input-table-body',
        'custom-storage-input-table-body',
        'mariadb-ref-table-body',
        'redis-config-table-body',
        'kafka-linear-table-body',
        'k8s-baseline-table-body',
        'k8s-input-config-table-body',
        'k8s-storage-input-table-body'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    // Clear all result containers
    [
        'sizing-result-container',
        'mariadb-result-container',
        'redis-key-result-container',
        'redis-config-result-container',
        'kafka-throughput-result-container',
        'kafka-linear-result-container',
        'k8s-result-container',
        'lbfw-result-container'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    // Clear all evidence grids
    [
        'redis-key-evidence-grid',
        'kafka-throughput-evidence-grid',
        'kafka-compression-evidence-grid',
        'kafka-helper-msg-evidence-grid',
        'kafka-helper-size-evidence-grid',
        'lbfw-evidence-grid'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    // Reset totals displays
    [
        'total-ram', 'total-disk', 'total-cint',
        'total-cint-used', 'total-ram-used',
        'custom-total-cint-used', 'custom-total-ram-used',
        'redis-total-master-ram', 'redis-total-capacity',
        'kafka-linear-total-cpu', 'kafka-linear-total-ram', 'kafka-linear-total-disk',
        'k8s-total-ram', 'k8s-total-disk', 'k8s-total-cint',
        'k8s-total-cint-used', 'k8s-total-ram-used'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '0';
    });

    // Reset summary table
    const summaryBody = document.getElementById('summary-table-body');
    if (summaryBody) {
        summaryBody.innerHTML = `<tr>
            <td colspan="6" class="text-center u-text-muted u-p-30">
                <i class="fa-solid fa-info-circle"></i> Chưa có dữ liệu định cỡ. Vui lòng thực hiện tính toán ở các module trước.
            </td>
        </tr>`;
    }

    if (document.getElementById('app-virtualization-mode')) {
        document.getElementById('app-virtualization-mode').value = 'ram';
    }
    if (document.getElementById('app-vcpu-flavor')) {
        document.getElementById('app-vcpu-flavor').value = '8';
    }
    if (document.getElementById('app-ram-flavor')) {
        document.getElementById('app-ram-flavor').value = '32';
    }
    if (document.getElementById('k8s-virtualization-mode')) {
        document.getElementById('k8s-virtualization-mode').value = 'ram';
    }
    if (document.getElementById('k8s-vcpu-flavor')) {
        document.getElementById('k8s-vcpu-flavor').value = '8';
    }
    if (document.getElementById('k8s-ram-flavor')) {
        document.getElementById('k8s-ram-flavor').value = '32';
    }
    if (document.getElementById('custom-virtualization-mode')) {
        document.getElementById('custom-virtualization-mode').value = 'ram';
    }
    if (document.getElementById('custom-vcpu-flavor')) {
        document.getElementById('custom-vcpu-flavor').value = '8';
    }
    if (document.getElementById('custom-ram-flavor')) {
        document.getElementById('custom-ram-flavor').value = '32';
    }
    if (document.getElementById('mariadb-replication-model')) {
        document.getElementById('mariadb-replication-model').value = 'asynchronous';
    }
    onVirtualizationModeChange('app');
    onVirtualizationModeChange('k8s');
    onVirtualizationModeChange('custom');

    // Clear all inline evidence previews (e.g. mariadb storage, etc.)
    document.querySelectorAll('.inline-evidence-preview').forEach(el => {
        el.innerHTML = '';
    });
    document.querySelectorAll('.btn-inline-evidence').forEach(btn => {
        btn.style.display = '';
    });
    // Clear mariadb storage evidence grid (multi-image)
    const storageEvidenceGrid = document.getElementById('mariadb-storage-evidence-grid');
    if (storageEvidenceGrid) storageEvidenceGrid.innerHTML = '';

    // Collapse all module sections (remove expanded state)
    document.querySelectorAll('.module-collapsible-content').forEach(el => {
        el.classList.remove('expanded');
    });
    document.querySelectorAll('.module-collapsible-header').forEach(el => {
        el.classList.remove('active');
    });
    // Keep module-app expanded by default
    const appContent = document.getElementById('module-app-content');
    if (appContent) appContent.classList.add('expanded');

    // Reset tabs
    const menuLinks = document.querySelectorAll(".side-menu a");
    const pages = document.querySelectorAll(".page-section");

    menuLinks.forEach(l => l.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));

    if (menuLinks[0]) menuLinks[0].classList.add("active");
    const firstPage = document.getElementById('page-request');
    if (firstPage) firstPage.classList.add("active");

    try { updateModuleVisibility(); } catch (e) { }
    ensureDefaultAppSizingRows();

    // Always restore fixed sizing rule after global reset.
    applyFixedSizingRule();
    initGlobalAutoResizeTextBoxes();
    resizeRequestTextareas();
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
        resetAdminReviewDirtySections();
        // Load project info để lấy trạng thái
        const projectResponse = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}`);
        if (projectResponse.ok) {
            const project = await projectResponse.json();
            setCurrentProjectMetaFromProject(project);
            currentProjectStatus = project.status || 'SIZING';
            currentProjectStatusRound = project.statusRound || 1;
            await hydrateCurrentProjectParticipants();
            updateProjectStatusDisplay();
        }

        const sizingIframe = document.getElementById('sizing-iframe');
        if (sizingIframe && currentProjectId) {
            const baseUrl = sizingIframe.src.split('?')[0];
            sizingIframe.src = `${baseUrl}?projectId=${currentProjectId}`;
        }

        const response = await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`);
        if (response.ok) {
            const projectData = await response.json();
            saveProjectDataIdToStorage(projectData.id);
            // Prefer separate admin review columns when present
            if (projectData.yeuCauBaiToanContent) {
                let content = JSON.parse(projectData.yeuCauBaiToanContent);
                applyProjectRequestDataToContext(content);
                if (projectData.yeuCauAdminReview) {
                    try { content.adminReview = JSON.parse(projectData.yeuCauAdminReview); } catch (e) { /* ignore */ }
                }
                loadYeuCauBaiToan(content);
            }
            if (projectData.thongTinDauVaoContent) {
                let content = JSON.parse(projectData.thongTinDauVaoContent);
                if (projectData.thongTinAdminReview) {
                    try { content.adminReview = JSON.parse(projectData.thongTinAdminReview); } catch (e) { /* ignore */ }
                }
                loadThongTinDauVao(content);
                // After loading input table, populate POC/Sizing dropdowns and attach listeners
                populatePocSizingDropdowns();
                attachInputTableChangeListeners();
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
                Logger.debug('DEBUG: projectData.moHinhAdminReview (raw):', projectData.moHinhAdminReview);
                Logger.debug('DEBUG: parsed mohinhAdmin:', mohinhAdmin);
                loadMoHinhHeThong(content, mohinhAdmin);
            }
            if (projectData.tongHopVaDeXuatContent) {
                loadTongHop(JSON.parse(projectData.tongHopVaDeXuatContent));
            }
            if (projectData.tongHopAdminReview) {
                try {
                    loadSummaryAdminReview(JSON.parse(projectData.tongHopAdminReview));
                } catch (e) {
                    Logger.error('Error parsing summary admin review:', e);
                    clearSummaryAdminReview();
                }
            } else {
                clearSummaryAdminReview();
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
                    Logger.error('Error parsing sizing admin review:', e);
                }
            }

            Logger.debug('Đã tải dữ liệu từ database thành công!');
        } else if (response.status === 404) {
            Logger.debug('Chưa có ProjectData cho project này');
        }
    } catch (error) {
        Logger.error('Lỗi khi tải dữ liệu:', error);
        showToast('Lỗi khi tải dữ liệu dự án: ' + error.message, 'error', 5000);
    }

    updateProjectContextPanel();

    // Keep fixed sizing rule visible even when project has no saved request content yet.
    applyFixedSizingRule();
    initGlobalAutoResizeTextBoxes();
    scheduleAutoResizeTextBoxes();

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
    scheduleAutoResizeTextBoxes();
}

// ==================== 1. YÊU CẦU BÀI TOÁN ====================

const FIXED_SIZING_RULE = `Tính toán tăng trưởng mở rộng hệ thống trong vòng 01 năm theo yêu cầu kinh doanh
Đảm bảo khả năng dự phòng: Các thiết bị phần cứng phải đảm bảo hoạt động với cơ chế dự phòng active-active hoặc active-standby,
Đảm bảo hiệu suất hoạt động (KPI): Tải CPU không quá 75%, RAM không vượt quá 90% và ổ cứng không vượt quá 80%, Datanode không vượt quá 50%,
Hệ số dự phòng sai số tính toán: 1.1`;

function applyFixedSizingRule() {
    const sizingRuleEl = document.getElementById('sizing-rule-fixed');
    if (!sizingRuleEl) return;
    sizingRuleEl.value = FIXED_SIZING_RULE;
    sizingRuleEl.readOnly = true;
}

function autoResizeRequestTextarea(textarea) {
    autoResizeConnectionTextarea(textarea);
}

function resizeRequestTextareas(scope = document) {
    scope.querySelectorAll('#request-table-body textarea').forEach(autoResizeRequestTextarea);
}

function initRequestAutoResizeTextareas(scope = document) {
    scope.querySelectorAll('#request-table-body textarea').forEach(textarea => {
        if (textarea.dataset.requestAutoResizeInited === '1') {
            autoResizeRequestTextarea(textarea);
            return;
        }
        textarea.dataset.requestAutoResizeInited = '1';
        textarea.addEventListener('input', () => autoResizeRequestTextarea(textarea));
        autoResizeRequestTextarea(textarea);
    });
}

function loadYeuCauBaiToan(data) {
    const rows = document.querySelectorAll('#request-table-body tr');

    // Helper function để load dữ liệu vào 1 dòng (Input + Admin)
    const loadRowData = (rowIndex, value, adminData) => {
        const row = rows[rowIndex];
        if (!row) return;

        // Cột User Input (Cột 2)
        const userInput = row.cells[1].querySelector('input[type="text"]');
        const userSelect = row.cells[1].querySelector('select');
        const userTextarea = row.cells[1].querySelector('textarea');
        const dateInput = row.cells[1].querySelector('.date-picker-native');

        if (dateInput) {
            setVietnameseDateInputValue(dateInput, value || '');
        } else if (userInput) {
            userInput.value = value || '';
        }
        if (userSelect) userSelect.value = value || '';
        if (userTextarea) {
            userTextarea.value = value || '';
            autoResizeRequestTextarea(userTextarea);
        }

        // Cột Admin (Cột 3 & 4)
        if (adminData) {
            const adminEval = row.cells[2].querySelector('select');
            const adminNote = row.cells[3].querySelector('textarea') || row.cells[3].querySelector('input[type="text"]');
            if (adminEval) {
                adminEval.value = adminData.eval || '';
                updateColor(adminEval); // Cập nhật màu
            }
            if (adminNote) {
                adminNote.value = adminData.note || '';
                if (adminNote.tagName === 'TEXTAREA') autoResizeRequestTextarea(adminNote);
            }
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
        ['contact-email', 'contact-unit', 'contact-phone'].forEach(id => {
            autoResizeRequestTextarea(document.getElementById(id));
        });

        // Load admin
        const adminData = data.adminReview?.row3;
        if (adminData) {
            const adminEval = contactRow.cells[2].querySelector('select');
            const adminNote = contactRow.cells[3].querySelector('textarea') || contactRow.cells[3].querySelector('input[type="text"]');
            if (adminEval) { adminEval.value = adminData.eval || ''; updateColor(adminEval); }
            if (adminNote) {
                adminNote.value = adminData.note || '';
                if (adminNote.tagName === 'TEXTAREA') autoResizeRequestTextarea(adminNote);
            }
        }
    }

    // Dòng 5: Mục đích
    loadRowData(4, data.sizingPurpose, data.adminReview?.row4);
    // Dòng 6: Cơ sở
    loadRowData(5, data.sizingBasis, data.adminReview?.row5);
    // Dòng 7: Nguyên tắc định cỡ luôn cố định, không lấy theo dữ liệu lưu cũ
    loadRowData(6, FIXED_SIZING_RULE, data.adminReview?.row6);
    applyFixedSizingRule();
    // Dòng 8: Mức độ
    loadRowData(7, data.importance, data.adminReview?.row7);
    // Dòng 9: Thời gian
    loadRowData(8, data.deploymentTime, data.adminReview?.row8);
    resizeRequestTextareas();
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
                    el.innerHTML = `<img src="${img.base64 || img}" alt="physical-${idx}" onclick="openModal(this.src)" class="zoomable-image">`;
                    physicalContainer.appendChild(el);
                });
            }
            if (logicalContainer) {
                logicalContainer.innerHTML = '';
                (data.logicalImages || []).forEach((img, idx) => {
                    const el = document.createElement('div');
                    el.className = 'model-image-item';
                    el.innerHTML = `<img src="${img.base64 || img}" alt="logical-${idx}" onclick="openModal(this.src)" class="zoomable-image">`;
                    logicalContainer.appendChild(el);
                });
            }
            if (flowContainer) {
                flowContainer.innerHTML = '';
                (data.flowImages || []).forEach((img, idx) => {
                    const el = document.createElement('div');
                    el.className = 'model-image-item';
                    el.innerHTML = `<img src="${img.base64 || img}" alt="flow-${idx}" onclick="openModal(this.src)" class="zoomable-image">`;
                    flowContainer.appendChild(el);
                });
            }
        }

        const logicComponentBody = document.getElementById('logic-component-table-body');
        if (logicComponentBody) {
            logicComponentBody.innerHTML = '';
            if (Array.isArray(data.logicComponentRows) && data.logicComponentRows.length > 0) {
                data.logicComponentRows.forEach((row, index) => {
                    const tr = createLogicComponentTableRow(index + 1, row);
                    logicComponentBody.appendChild(tr);
                });
            } else {
                logicComponentBody.appendChild(createLogicComponentTableRow(1, {}));
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
        Logger.debug('DEBUG: resolved adminObj in loadMoHinhHeThong:', adminObj);

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
        setAdmin('logical', adminObj.logical || data.adminLogical);
        setAdmin('flow', adminObj.flow || data.adminFlow);

        // Architecture rows
        const archBody = document.getElementById('arch-table-body');
        if (archBody) {
            archBody.innerHTML = '';
            if (data.archRows && data.archRows.length > 0) {
                data.archRows.forEach((row, index) => {
                    const tr = createArchTableRow(index + 1, row);
                    tr.dataset.rowId = row.rowId || 'arch-row-' + (++archRowIdCounter);
                    archBody.appendChild(tr);
                });
            } else {
                const tr = createArchTableRow(1, {});
                tr.dataset.rowId = 'arch-row-' + (++archRowIdCounter);
                archBody.appendChild(tr);
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
        if (data.connectionRows && Array.isArray(data.connectionRows) && data.connectionRows.length > 0) {
            loadConnectionInfo(data.connectionRows);
        } else {
            loadConnectionInfo([]);
        }
        if (data.connectionImages && typeof loadImagesToContainer === 'function') {
            loadImagesToContainer('connection', data.connectionImages);
        }

        // Load connection row admin reviews
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
                        if (adminNote) {
                            adminNote.value = review.note || '';
                            autoResizeConnectionTextarea(adminNote);
                        }
                    }
                });
            }
        }

        // Ensure role permissions applied after building model section
        try { applyRolePermissions(); } catch (e) { }

        // Update module visibility in sizing section based on selected modules
        updateModuleVisibility();
    } catch (e) {
        Logger.error('loadMoHinhHeThong error', e);
    }
}

function collectYeuCauBaiToan() {
    const rows = document.querySelectorAll('#request-table-body tr');
    applyFixedSizingRule();

    // Helper lấy value User Input
    const getVal = (rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return '';
        const dateInput = row.cells[1].querySelector('.date-picker-native');
        if (dateInput) {
            return dateInput.value || parseDateToISODate(row.cells[1].querySelector('.date-display-input')?.value || '');
        }
        const input = row.cells[1].querySelector('input[type="text"]');
        const select = row.cells[1].querySelector('select');
        const textarea = row.cells[1].querySelector('textarea');
        return input ? input.value : (select ? select.value : (textarea ? textarea.value : ''));
    };

    // Helper lấy Admin Data
    const getAdminData = (rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return { eval: '', note: '' };
        return {
            eval: row.cells[2].querySelector('select')?.value || '',
            note: row.cells[3].querySelector('textarea')?.value || row.cells[3].querySelector('input[type="text"]')?.value || ''
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
        sizingRule: FIXED_SIZING_RULE,
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
        showToast("Vui lòng nhập Tên dự án!", 'warning');
        return;
    }

    try {
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">⏳ Đang lưu...</span>';

        // 1. Tạo hoặc Cập nhật Project
        if (!currentProjectId) {
            const projectResponse = await fetchAPI(`${API_BASE_URL}/projects`, {
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
            await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
        const baseHeaders = { 'Content-Type': 'application/json' };
        if (currentProjectDataId) {
            response = await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                method: 'PUT',
                headers: baseHeaders,
                body: JSON.stringify({ yeuCauBaiToanContent: JSON.stringify(systemInfoPayload) })
            });
        } else {
            response = await fetchAPI(`${API_BASE_URL}/project-data`, {
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
            if (!currentProjectDataId) saveProjectDataIdToStorage(result.id);
            if (statusDiv) statusDiv.innerHTML = `<span class="u-text-success">✓ Lưu thành công!</span>`;

            // Cập nhật trạng thái dự án dựa trên role
            const role = (user.role || '').toLowerCase();
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
            } else if (role === 'user' || !role) {
                await updateProjectStatus('user_edit');
            }

            showToast('Đã lưu thông tin thành công!', 'success');
        } else {
            throw new Error(await response.text());
        }

    } catch (error) {
        Logger.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = `<span class="u-text-danger">✗ Lỗi: ${error.message}</span>`;
        showToast('Có lỗi xảy ra: ' + error.message, 'error');
    }
}

// ==================== THÔNG TIN ĐẦU VÀO ====================

function loadThongTinDauVao(data) {
    // Load bảng thông tin đầu vào
    const tbody = document.getElementById('input-table-body');
    if (!tbody) {
        Logger.warn("loadThongTinDauVao: missing element with id='input-table-body', skipping input table load.");
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
            resizeConnectionTextareasInRow(tr);
        });
    }

    // Note: baselineRows and global evidenceImages have been removed from storage structure
    // Load per-row images (pocEvidenceImages / sizingEvidenceImages) when present
    // (the per-row image loading is handled inside createInputTableRow below)
}
// Ensure role permissions applied after loading input table
try { applyRolePermissions(); } catch (e) { }

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

    // --- 0. XỬ LÝ dauVao: hỗ trợ cả format cũ (string) và mới ({type, custom})
    // Old format: data.dauVao = "some text"
    // New format: data.dauVao = { type: "CCU", custom: "custom value" }
    const DAU_VAO_OPTIONS = [
        { value: 'CCU', label: 'CCU' },
        { value: 'TPS', label: 'TPS' },
        { value: 'Số người dùng', label: 'Số người dùng' },
        { value: 'Số hệ thống', label: 'Số hệ thống' },
        { value: 'Thời gian lưu trữ', label: 'Thời gian lưu trữ' },
        { value: 'Khác', label: 'Khác' }
    ];

    let dauVaoType = '';
    let dauVaoCustom = '';

    if (data.dauVao && typeof data.dauVao === 'object' && data.dauVao.type) {
        // New structured format
        dauVaoType = data.dauVao.type || '';
        dauVaoCustom = data.dauVao.custom || '';
    } else if (typeof data.dauVao === 'string' && data.dauVao.trim()) {
        // Old plain-text format: treat as "Khác" with the text as custom value
        dauVaoType = 'Khác';
        dauVaoCustom = data.dauVao.trim();
    }

    const dauVaoOptionsHtml = DAU_VAO_OPTIONS.map(opt =>
        `<option value="${escapeHtml(opt.value)}" ${dauVaoType === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    // --- 1. XỬ LÝ ẢNH (POC) ---
    // Support multiple images per row: data.taiHeThongPOC = { text: '', pocEvidenceImages: [ {base64}, ... ] }
    const pocText = (data.taiHeThongPOC && typeof data.taiHeThongPOC === 'object' && typeof data.taiHeThongPOC.text === 'string') ? data.taiHeThongPOC.text : '';
    const pocImages = (data.taiHeThongPOC && Array.isArray(data.taiHeThongPOC.pocEvidenceImages)) ? data.taiHeThongPOC.pocEvidenceImages : (data.pocImage ? [{ base64: data.pocImage }] : []);

    // --- 2. XỬ LÝ ẢNH (ĐỊNH CỠ) ---
    const sizingText = (data.dinhCo && typeof data.dinhCo === 'object' && typeof data.dinhCo.text === 'string') ? data.dinhCo.text : (typeof data.dinhCo === 'string' ? data.dinhCo : '');
    const sizingImages = (data.dinhCo && Array.isArray(data.dinhCo.sizingEvidenceImages)) ? data.dinhCo.sizingEvidenceImages : (data.sizingImage ? [{ base64: data.sizingImage }] : []);
    // Show custom input only when "Khác" is selected
    const showCustomInput = dauVaoType === 'Khác' || (!dauVaoType);

    tr.innerHTML = `
        <td class="u-text-center">${stt}</td>

        <td>
            <select class="input-full dau-vao-type-select u-mb-4" onchange="onDauVaoTypeChange(this)">
                <option value="">-- Chọn loại đầu vào --</option>
                ${dauVaoOptionsHtml}
            </select>
            <input type="text" class="input-full connection-auto-textarea dau-vao-custom-input ${showCustomInput ? '' : 'is-hidden'}"
                   value="${escapeHtml(dauVaoCustom)}"
                   placeholder="Nhập giá trị tùy chỉnh..."
                   oninput="autoResizeConnectionTextarea(this)"
                   ${!showCustomInput ? 'disabled' : ''}>
        </td>

        <td>
            <div class="cell-wrapper">
                <textarea rows="2" class="input-full connection-auto-textarea" placeholder="Giá trị..." oninput="autoResizeConnectionTextarea(this)">${escapeHtml(pocText)}</textarea>
                <div class="row-evidence-controls">
                    <label class="upload-icon-btn" title="Tải ảnh/Xem ảnh">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                           <input type="file" accept="image/*" multiple class="hidden-file-input"
                               onclick="event.stopPropagation()"
                               onchange="handleRowEvidenceUpload(this, 'poc')">
                    </label>
                </div>
                <div class="row-evidence-container">
                    ${pocImages.map(img => `<div class="row-evidence-item"><button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)" title="Xem ảnh" aria-label="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>`).join('')}
                </div>
            </div>
        </td>

        <td>
            <div class="cell-wrapper">
                <textarea rows="2" class="input-full connection-auto-textarea" placeholder="Giá trị..." oninput="autoResizeConnectionTextarea(this)">${escapeHtml(sizingText)}</textarea>
                <div class="row-evidence-controls">
                    <label class="upload-icon-btn" title="Tải ảnh/Xem ảnh">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                           <input type="file" accept="image/*" multiple class="hidden-file-input"
                               onclick="event.stopPropagation()"
                               onchange="handleRowEvidenceUpload(this, 'sizing')">
                    </label>
                </div>
                <div class="row-evidence-container">
                    ${sizingImages.map(img => `<div class="row-evidence-item"><button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)" title="Xem ảnh" aria-label="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>`).join('')}
                </div>
            </div>
        </td>

        <td><input type="text" class="input-full" value="${data.module || ''}" placeholder="Module..."></td>

        <td><textarea rows="2" class="input-full connection-auto-textarea" placeholder="Ghi chú..." oninput="autoResizeConnectionTextarea(this)">${data.ghiChu || ''}</textarea></td>

        <td>
            <select class="admin-eval" onchange="updateColor(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td>
            <textarea rows="1" class="input-full admin-note connection-auto-textarea textarea-min-md"
                      placeholder="..."
                      oninput="autoResizeConnectionTextarea(this)">${data.adminNote || ''}</textarea>
        </td>

        <td class="u-text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="deleteRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    // Kích hoạt màu sắc cho ô Select nếu đã có dữ liệu (OK xanh / NOK đỏ)
    const select = tr.querySelector('select');
    if (select && select.value) updateColor(select);

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

    // Nếu đã có ảnh tải sẵn, đánh dấu icon upload nhưng vẫn cho phép tải thêm ảnh
    const pocContainer = tr.querySelector('.row-evidence-container');
    if (pocContainer && pocContainer.children.length > 0) {
        const pocLabel = tr.querySelector('td .upload-icon-btn');
        if (pocLabel) pocLabel.classList.add('has-file');
    }
    // Sizing column (nếu tồn tại ảnh) - tìm label trong cùng row, cột 4
    const sizingContainers = tr.querySelectorAll('td .row-evidence-container');
    if (sizingContainers && sizingContainers.length > 1) {
        const sizingContainer = sizingContainers[1];
        if (sizingContainer && sizingContainer.children.length > 0) {
            const sizingLabel = tr.querySelectorAll('td .upload-icon-btn')[1];
            if (sizingLabel) sizingLabel.classList.add('has-file');
        }
    }

    return tr;
}

function onDauVaoTypeChange(selectEl) {
    const td = selectEl.closest('td');
    if (!td) return;
    const customInput = td.querySelector('.dau-vao-custom-input');
    if (!customInput) return;

    if (selectEl.value === 'Khác' || selectEl.value === '') {
        customInput.classList.remove('is-hidden');
        customInput.disabled = false;
        customInput.required = true;
        if (selectEl.value === '') {
            customInput.placeholder = 'Vui lòng chọn loại đầu vào...';
        } else {
            customInput.placeholder = 'Nhập giá trị tùy chỉnh...';
        }
    } else {
        customInput.classList.add('is-hidden');
        customInput.disabled = true;
        customInput.required = false;
    }
}

// 4. [MỚI] Hàm xóa dòng cụ thể
function deleteRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();

    // Cập nhật lại số thứ tự (STT)
    Array.from(tbody.rows).forEach((r, index) => {
        r.cells[0].innerText = index + 1;
    });
    // Update POC/Sizing dropdowns after row deletion
    populatePocSizingDropdowns();
}
// 2. Hàm Thêm Dòng (Được gọi khi bấm nút)
function addInputRow() {
    const tbody = document.getElementById('input-table-body');
    if (!tbody) {
        Logger.error("Không tìm thấy tbody có id='input-table-body'");
        return;
    }

    const nextSTT = tbody.rows.length + 1;
    // Gọi hàm tạo dòng ở trên
    const tr = createInputTableRow(nextSTT);
    tbody.appendChild(tr);
    resizeConnectionTextareasInRow(tr);
    // Re-apply role permissions so dynamically added row gets correct disabled state
    try { applyRolePermissions(); } catch (e) { /* ignore */ }
    // Update POC/Sizing dropdowns in case new row data matters
    populatePocSizingDropdowns();
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

        // Helper: Lấy text box trong wrapper
        const getWrapperInput = (cellIndex) => {
            const cell = cells[cellIndex];
            if (!cell) return '';
            return getTextControlValue(cell);
        }

        // Read the new "Đầu vào" dropdown and custom text input
        const dauVaoType = cells[1]?.querySelector('.dau-vao-type-select')?.value || '';
        const dauVaoCustom = cells[1]?.querySelector('.dau-vao-custom-input')?.value?.trim() || '';

        // Build dauVao for DOC export / backward compatibility
        let dauVaoText = dauVaoType;
        if (dauVaoType === 'Khác' && dauVaoCustom) {
            dauVaoText = dauVaoCustom;
        } else if (dauVaoType && dauVaoCustom) {
            dauVaoText = `${dauVaoType}: ${dauVaoCustom}`;
        }

        inputRows.push({
            // dauVao: plain string for DOC export template / backward compat
            dauVao: dauVaoText,
            // dauVaoType + dauVaoCustom: structured format for programmatic access
            dauVaoType: dauVaoType,
            dauVaoCustom: dauVaoCustom,
            taiHeThongPOC: {
                text: getWrapperInput(2),
                pocEvidenceImages: getRowImages(2)
            },

            dinhCo: {
                text: getWrapperInput(3),
                sizingEvidenceImages: getRowImages(3)
            },

            module: getTextControlValue(cells[4]), // Cột 4
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

// ========== Populate POC/Sizing dropdowns from input table ==========
// This function reads the input table rows and populates all POC and Sizing <select> dropdowns
// across all modules with the values entered in the "Thông tin đầu vào" table.
function populatePocSizingDropdowns() {
    // Collect rows from input table — each row has POC and Sizing values
    const inputRows = [];

    document.querySelectorAll('#input-table-body tr').forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        // Read new dropdown structure: type + optional custom text
        const dauVaoType = cells[1]?.querySelector('.dau-vao-type-select')?.value || '';
        const dauVaoCustom = cells[1]?.querySelector('.dau-vao-custom-input')?.value?.trim() || '';
        // Build display string for dropdown options
        let dauVaoDisplay = dauVaoType;
        if (dauVaoType === 'Khác' && dauVaoCustom) {
            dauVaoDisplay = dauVaoCustom;
        } else if (dauVaoType && dauVaoCustom) {
            dauVaoDisplay = `${dauVaoType}: ${dauVaoCustom}`;
        }

        // POC: column 2 (cell-wrapper > textarea/input)
        const pocField = cells[2]?.querySelector('textarea') || cells[2]?.querySelector('input[type="text"]');
        const pocVal = pocField?.value?.trim() || '';

        // Sizing: column 3 (cell-wrapper > textarea/input)
        const sizingField = cells[3]?.querySelector('textarea') || cells[3]?.querySelector('input[type="text"]');
        const sizingVal = sizingField?.value?.trim() || '';

        if (pocVal || sizingVal) {
            inputRows.push({
                index: index,
                dauVao: dauVaoDisplay,
                poc: pocVal,
                sizing: sizingVal
            });
        }
    });

    // All combined row-selector dropdown IDs and their associated POC/Sizing display input IDs
    const rowSelectors = [
        { selectId: 'app-input-row-select', pocId: 'poc-value', sizingId: 'sizing-value' },
        { selectId: 'mariadb-input-row-select', pocId: 'mariadb-input-ccu', sizingId: 'mariadb-sizing-ccu' },
        { selectId: 'redis-key-input-row-select', pocId: 'redis-key-poc', sizingId: 'redis-key-sizing' },
        { selectId: 'redis-config-input-row-select', pocId: 'redis-config-input-ccu', sizingId: 'redis-config-sizing-ccu' },
        { selectId: 'kafka-throughput-input-row-select', pocId: 'kafka-throughput-input-ccu', sizingId: 'kafka-throughput-sizing-ccu' },
        { selectId: 'kafka-linear-input-row-select', pocId: 'kafka-linear-input-ccu', sizingId: 'kafka-linear-sizing-ccu' },
        { selectId: 'k8s-input-row-select', pocId: 'k8s-poc-value', sizingId: 'k8s-sizing-value' },
        { selectId: 'lbfw-input-row-select', pocId: 'lbfw-poc-value', sizingId: 'lbfw-sizing-value' },
        { selectId: 'custom-input-row-select', pocId: 'custom-poc-value', sizingId: 'custom-sizing-value' }
    ];

    const repopulateSingleSelector = (select, pocInput, sizingInput) => {
        if (!select) return;
        const currentVal = select.value;

        select.innerHTML = '<option value="">-- Chọn từ bảng đầu vào --</option>';
        inputRows.forEach(row => {
            const option = document.createElement('option');
            option.value = row.index;
            // Ensure dataset values are strings, not objects
            option.dataset.poc = (typeof row.poc === 'object' ? '' : String(row.poc || ''));
            option.dataset.sizing = (typeof row.sizing === 'object' ? '' : String(row.sizing || ''));
            const label = row.dauVao?.trim() || `Dòng ${row.index + 1}`;
            option.textContent = label;
            select.appendChild(option);
        });

        if (currentVal !== '' && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        } else {
            if (pocInput) pocInput.value = '';
            if (sizingInput) sizingInput.value = '';
        }

        if (select.value !== '') {
            const selectedOption = select.options[select.selectedIndex];
            if (pocInput) pocInput.value = selectedOption.dataset.poc || '';
            if (sizingInput) sizingInput.value = selectedOption.dataset.sizing || '';
            initGlobalAutoResizeTextBoxes(pocInput);
            initGlobalAutoResizeTextBoxes(sizingInput);
        }
    };

    rowSelectors.forEach(({ selectId, pocId, sizingId }) => {
        const baseSelect = document.getElementById(selectId);
        repopulateSingleSelector(baseSelect, document.getElementById(pocId), document.getElementById(sizingId));

        document.querySelectorAll(`[id^="${selectId}__inst_"]`).forEach(instanceSelect => {
            const suffix = instanceSelect.id.substring(selectId.length);
            const instancePoc = document.getElementById(`${pocId}${suffix}`);
            const instanceSizing = document.getElementById(`${sizingId}${suffix}`);
            repopulateSingleSelector(instanceSelect, instancePoc, instanceSizing);
        });
    });
}

function getSelectedInputRowLabel(selectId) {
    const select = document.getElementById(selectId);
    if (!select || select.selectedIndex < 0 || !select.value) return '';

    const option = select.options[select.selectedIndex];
    return option?.textContent?.trim() || '';
}

// Called when user selects a row from combined POC & Sizing dropdown
function onInputRowSelect(selectEl, pocInputId, sizingInputId) {
    const normalizedSelectEl = (() => {
        if (selectEl && typeof selectEl === 'object' && typeof selectEl.tagName === 'string' && selectEl.tagName.toUpperCase() === 'SELECT') {
            return selectEl;
        }
        if (selectEl && typeof selectEl === 'object') {
            const target = selectEl.target || selectEl.currentTarget || selectEl.srcElement;
            if (target && typeof target.tagName === 'string' && target.tagName.toUpperCase() === 'SELECT') {
                return target;
            }
        }
        if (typeof selectEl === 'string') {
            return document.getElementById(selectEl);
        }
        const activeEl = document.activeElement;
        if (activeEl && typeof activeEl.tagName === 'string' && activeEl.tagName.toUpperCase() === 'SELECT') {
            return activeEl;
        }

        const selectorCandidates = Array.from(document.querySelectorAll('select[onchange*="onInputRowSelect"]'));
        const matched = selectorCandidates.find(el => {
            const raw = el.getAttribute('onchange') || '';
            return raw.includes(`'${pocInputId}'`) && raw.includes(`'${sizingInputId}'`) && el.value !== '';
        }) || selectorCandidates.find(el => {
            const raw = el.getAttribute('onchange') || '';
            return raw.includes(`'${pocInputId}'`) && raw.includes(`'${sizingInputId}'`);
        });
        if (matched) return matched;

        return null;
    })();

    const resolveInputBySelectContext = (baseId, fieldKind) => {
        if (!baseId) return null;

        // Instance element with suffix (e.g. __inst_App-1)
        const selectId = normalizedSelectEl?.id || '';
        const marker = '__inst_';
        const markerIndex = selectId.indexOf(marker);
        if (markerIndex >= 0) {
            const suffix = selectId.substring(markerIndex);
            const instanceEl = document.getElementById(`${baseId}${suffix}`);
            if (instanceEl) return instanceEl;
        }

        // If select has no suffixed id, infer suffix from closest instance wrapper.
        const getClosest = (el, selector) => {
            if (el && typeof el.closest === 'function') return el.closest(selector);
            return null;
        };
        const instanceWrapper = getClosest(normalizedSelectEl, '.module-instance-wrapper');
        const instanceKey = instanceWrapper?.dataset?.instanceKey;
        if (instanceKey) {
            const inferred = document.getElementById(`${baseId}__inst_${instanceKey}`);
            if (inferred) return inferred;
        }

        // Prefer search in the same module block as the select to avoid writing to hidden/template nodes.
        const scope = getClosest(normalizedSelectEl, '.module-instance-wrapper') || getClosest(normalizedSelectEl, '.module-content') || null;
        if (scope) {
            const scopedById = scope.querySelector(`[id="${baseId}"]`);
            if (scopedById) return scopedById;

            // Last local fallback for App-like UI blocks: pick readonly input by field order.
            const localReadonlyInputs = Array.from(scope.querySelectorAll('textarea[readonly], input[readonly]'));
            if (localReadonlyInputs.length >= 2) {
                if (fieldKind === 'poc') return localReadonlyInputs[0] || null;
                if (fieldKind === 'sizing') return localReadonlyInputs[1] || null;
            }
        }

        // Global fallback for instance ids: choose the first match.
        const globalInstanceCandidates = document.querySelectorAll(`[id^="${baseId}__inst_"]`);
        if (globalInstanceCandidates.length > 0) {
            return globalInstanceCandidates[0];
        }

        // Base page element (non-instance)
        return document.getElementById(baseId);
    };

    const pocInput = resolveInputBySelectContext(pocInputId, 'poc');
    const sizingInput = resolveInputBySelectContext(sizingInputId, 'sizing');
    if (!pocInput || !sizingInput) return;

    if (!normalizedSelectEl || !normalizedSelectEl.options || typeof normalizedSelectEl.selectedIndex !== 'number' || normalizedSelectEl.selectedIndex < 0) {
        pocInput.value = '';
        sizingInput.value = '';
        return;
    }

    const selectedOption = normalizedSelectEl.options[normalizedSelectEl.selectedIndex];
    if (!selectedOption || normalizedSelectEl.value === '') {
        pocInput.value = '';
        sizingInput.value = '';
        return;
    }

    let pocValue = selectedOption.dataset?.poc || '';
    let sizingValue = selectedOption.dataset?.sizing || '';

    // Ensure values are strings, not objects
    if (pocValue && typeof pocValue !== 'string') {
        pocValue = String(pocValue);
    }
    if (sizingValue && typeof sizingValue !== 'string') {
        sizingValue = String(sizingValue);
    }

    // Fallback: đọc trực tiếp từ bảng Thông tin đầu vào theo chỉ số dòng
    if (!pocValue && !sizingValue) {
        const rowIndex = Number.parseInt(normalizedSelectEl.value, 10);
        if (!Number.isNaN(rowIndex) && rowIndex >= 0) {
            const sourceRows = document.querySelectorAll('#input-table-body tr');
            const sourceRow = sourceRows[rowIndex];
            if (sourceRow) {
                const cells = sourceRow.querySelectorAll('td');
                const pocField = cells[2]?.querySelector('textarea') || cells[2]?.querySelector('input[type="text"]');
                const sizingField = cells[3]?.querySelector('textarea') || cells[3]?.querySelector('input[type="text"]');
                pocValue = pocField?.value?.trim() || '';
                sizingValue = sizingField?.value?.trim() || '';
            }
        }
    }

    // Last resort: parse values from option label text (e.g. "POC=100, Định cỡ=600")
    if (!pocValue && !sizingValue && selectedOption?.textContent) {
        const label = selectedOption.textContent;
        const pocMatch = label.match(/POC\s*=\s*([^,\)]+)/i);
        const sizingMatch = label.match(/Định\s*cỡ\s*=\s*([^,\)]+)/i);
        pocValue = (pocMatch?.[1] || '').trim();
        sizingValue = (sizingMatch?.[1] || '').trim();
    }

    pocInput.value = pocValue;
    sizingInput.value = sizingValue;
    initGlobalAutoResizeTextBoxes(pocInput);
    initGlobalAutoResizeTextBoxes(sizingInput);
}

function attachInputTableChangeListeners() {
    const tbody = document.getElementById('input-table-body');
    if (!tbody) return;

    // Use event delegation on the tbody
    tbody.addEventListener('input', (e) => {
        // Only react to changes in POC (col 2) or Sizing (col 3) input fields, or dauVao textarea
        const target = e.target;
        if (target.matches('input[type="text"]') || target.matches('textarea')) {
            // Debounce to avoid excessive updates
            clearTimeout(tbody._dropdownUpdateTimer);
            tbody._dropdownUpdateTimer = setTimeout(populatePocSizingDropdowns, 300);
        }
    });
}

// (onPocSizingDropdownChange removed — replaced by onInputRowSelect)

async function saveThongTinDauVao() {
    const statusDiv = document.getElementById('input-save-status');

    if (!currentProjectId) {
        showToast('Vui lòng lưu "Yêu cầu bài toán" trước!', 'warning');
        return;
    }

    try {
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">⏳ Đang lưu...</span>';

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

        await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                thongTinDauVaoContent: content
            })
        });

        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-success">✓ Lưu thành công!</span>';

        // Cập nhật trạng thái dự án dựa trên role
        const role = (user.role || '').toLowerCase();
        if (role === 'admin1') {
            await updateProjectStatus('admin1_review');
        } else if (role === 'admin2') {
            await updateProjectStatus('admin2_review');
        } else if (role === 'user' || !role) {
            await updateProjectStatus('user_edit');
        }

        showToast('Đã lưu Thông tin đầu vào thành công!', 'success');

    } catch (error) {
        Logger.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">✗ Lỗi!</span>';
        showToast('Lỗi: ' + error.message, 'error');
    }
}

function ensureAppSelectHandler() {
    const sel = document.getElementById('app-input-row-select');
    if (sel && !sel.getAttribute('onchange')) {
        sel.setAttribute('onchange', "onInputRowSelect(this,'poc-value','sizing-value')");
    }
}

function rewireInputTableListeners() {
    const tbody = document.getElementById('input-table-body');
    if (!tbody) return;

    if (tbody._listener) {
        tbody.removeEventListener('input', tbody._listener);
    }

    const listener = (e) => {
        clearTimeout(tbody._dropdownUpdateTimer);
        tbody._dropdownUpdateTimer = setTimeout(() => {
            populatePocSizingDropdowns();
            ensureAppSelectHandler();
        }, 300);
    };
    tbody._listener = listener;
    tbody.addEventListener('input', listener);
}

// 7. Hàm thêm dòng Baseline (Giữ nguyên)
function createBaselineTableRow(data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <select class="inline-control-select">
                <option value="APP" ${data.module === 'APP' ? 'selected' : ''}>APP</option>
                <option value="DB" ${data.module === 'DB' ? 'selected' : ''}>DB</option>
            </select>
        </td>
        <td><input type="text" placeholder="10.240.x.x" value="${data.ip || ''}"></td>
        <td><input type="text" placeholder="Intel Xeon..." value="${data.cpu || ''}"></td>
        <td><input type="number" class="ram-val" placeholder="0" value="${data.ram || ''}" oninput="calculateBaselineTotal()"></td>
        <td><input type="number" class="cint-val" placeholder="0" value="${data.cintRate2017 || ''}" oninput="calculateBaselineTotal()"></td>
        <td><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td>
    `;
    return tr;
}

function autoResizeFlowExplanation(textarea) {
    if (!textarea) return;
    if (!isTextBoxMeasurable(textarea)) {
        textarea.dataset.pendingAutoResize = '1';
        return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 150)}px`;
    delete textarea.dataset.pendingAutoResize;
}

function autoGrowTextarea(textarea) {
    if (!textarea) return;
    if (!isTextBoxMeasurable(textarea)) {
        textarea.dataset.pendingAutoResize = '1';
        return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 44)}px`;
    delete textarea.dataset.pendingAutoResize;
}

function createLogicComponentTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${stt}</td>
        <td>
            <textarea class="input-full logic-name-textarea" rows="2" oninput="handleLogicComponentNameInput(this)" placeholder="Ví dụ: MariaDB, WebService, Redis,...">${escapeHtml(data.componentName || '')}</textarea>
        </td>
        <td>
            <textarea class="input-full logic-task-textarea" rows="2" oninput="autoGrowTextarea(this)" placeholder="Mô tả nhiệm vụ chính của thành phần/module...">${escapeHtml(data.mainTask || '')}</textarea>
        </td>
        <td><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete" onclick="removeLogicComponentRow(this)"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td>
    `;
    const nameTextarea = tr.querySelector('.logic-name-textarea');
    const taskTextarea = tr.querySelector('.logic-task-textarea');
    autoGrowTextarea(nameTextarea);
    autoGrowTextarea(taskTextarea);
    return tr;
}

function addLogicComponentRow() {
    const tbody = document.getElementById('logic-component-table-body');
    if (!tbody) return;
    const nextSTT = tbody.rows.length + 1;
    const tr = createLogicComponentTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) { }
}

function removeLogicComponentRow(btn) {
    removeRow(btn);
    const tbody = document.getElementById('logic-component-table-body');
    updateSTT(tbody);
    refreshArchModuleDropdowns();
}

function handleLogicComponentNameInput(textarea) {
    autoGrowTextarea(textarea);
    refreshArchModuleDropdowns();
}

function getLogicComponentModuleNames() {
    const names = [];
    const seen = new Set();

    document.querySelectorAll('#logic-component-table-body .logic-name-textarea').forEach(textarea => {
        const name = textarea.value.trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        names.push(name);
    });

    return names;
}

function buildArchModuleOptions(selectedValue = '') {
    const selected = String(selectedValue || '').trim();
    const logicModuleNames = getLogicComponentModuleNames();
    const hasSelected = logicModuleNames.includes(selected);
    const options = ['<option value="">-- Chọn module --</option>'];

    if (selected && !hasSelected) {
        options.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (không còn trong bảng Logic)</option>`);
    }

    logicModuleNames.forEach(name => {
        const isSelected = name === selected ? ' selected' : '';
        options.push(`<option value="${escapeHtml(name)}"${isSelected}>${escapeHtml(name)}</option>`);
    });

    return options.join('');
}

function refreshArchModuleDropdowns() {
    document.querySelectorAll('#arch-table-body .arch-module-select').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = buildArchModuleOptions(currentValue);
    });
}

function getArchRowModuleName(row) {
    const select = row?.querySelector('.arch-module-select');
    if (select) return select.value || '';

    // Backward compatibility for rows rendered before the Module cell became a dropdown.
    return row?.querySelector('.module-cell-textarea')?.value || '';
}

function createArchTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${stt}</td>
        <td>
            <select class="inline-control-select arch-module-select" onchange="updateModuleVisibility()">
                ${buildArchModuleOptions(data.moduleName || '')}
            </select>
        </td>
        <td>
            <select class="inline-control-select" onchange="updateModuleVisibility()">
                <option value="">-- Chọn --</option>
                <option value="App" ${data.loaiModule === 'App' ? 'selected' : ''}>App</option>
                <option value="Redis" ${data.loaiModule === 'Redis' ? 'selected' : ''}>Redis</option>
                <option value="MariaDB" ${data.loaiModule === 'MariaDB' ? 'selected' : ''}>MariaDB</option>
                <option value="Kafka" ${data.loaiModule === 'Kafka' ? 'selected' : ''}>Kafka</option>
                <option value="K8S" ${data.loaiModule === 'K8S' ? 'selected' : ''}>K8S</option>
                <option value="LB/FW" ${data.loaiModule === 'LB/FW' ? 'selected' : ''}>LB/FW</option>
                <option value="Khác" ${data.loaiModule === 'Khác' ? 'selected' : ''}>Khác</option>
            </select>
        </td>
        <td>
            <select class="inline-control-select">
                <option value="">-- Chọn --</option>
                <option value="Public" ${data.zoneMang === 'Public' ? 'selected' : ''}>Public</option>
                <option value="Private" ${data.zoneMang === 'Private' ? 'selected' : ''}>Private</option>
            </select>
        </td>
        <td>
            <select class="inline-control-select">
                <option value="">-- Chọn --</option>
                <option value="Ubuntu 22.04" ${data.heDieuHanh === 'Ubuntu 22.04' ? 'selected' : ''}>Ubuntu 22.04</option>
                <option value="Oracle Linux 9" ${data.heDieuHanh === 'Oracle Linux 9' ? 'selected' : ''}>Oracle Linux 9</option>
                <option value="Windows Server 2016" ${data.heDieuHanh === 'Windows Server 2016' ? 'selected' : ''}>Windows Server 2016</option>
            </select>
        </td>
        <td><textarea rows="1" placeholder="0">${data.soLuongVIP ?? '0'}</textarea></td>
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
        <td><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete" onclick="removeArchRow(this)"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td>
    `;
    return tr;
}

function collectMoHinhHeThong() {
    const logicComponentRows = [];
    document.querySelectorAll('#logic-component-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        logicComponentRows.push({
            componentName: cells[1]?.querySelector('textarea')?.value?.trim() || '',
            mainTask: cells[2]?.querySelector('textarea')?.value || ''
        });
    });

    // Thu thập bảng Zone mạng (USER DATA ONLY - no admin fields)
    const archRows = [];
    document.querySelectorAll('#arch-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');

        archRows.push({
            moduleName: getArchRowModuleName(row),
            loaiModule: cells[2]?.querySelector('select')?.value || '',
            zoneMang: cells[3]?.querySelector('select')?.value || '',
            heDieuHanh: cells[4]?.querySelector('select')?.value || '',
            soLuongVIP: cells[5]?.querySelector('textarea')?.value || '0',
            rowId: row.dataset.rowId || ''
            // NOTE: Admin eval/note NOT saved here - goes to moHinhAdminReview
        });
    });

    return {
        physicalImages: collectImagesFromContainer('physical'),
        logicalImages: collectImagesFromContainer('logical'),
        logicComponentRows: logicComponentRows,
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
        archRowReviews: archRowReviews,
        connectionRowReviews: connectionRowReviews
    };
}

async function saveMoHinhHeThong() {
    const statusDiv = document.getElementById('model-save-status');
    if (!currentProjectId) { showToast('Vui lòng lưu "Yêu cầu bài toán" trước!', 'warning'); return; }
    try {
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">⏳ Đang lưu...</span>';

        const data = collectMoHinhHeThong();

        await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moHinhHeThongContent: JSON.stringify(data) })
        });
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-success">✓ Lưu thành công!</span>';

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

        showToast('Đã lưu Mô hình hệ thống thành công!', 'success');

    } catch (error) {
        Logger.error('Error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

let archRowIdCounter = 0;
function addArchRow() {
    const tbody = document.getElementById('arch-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createArchTableRow(nextSTT);
    tr.dataset.rowId = 'arch-row-' + (++archRowIdCounter);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) { }
    updateModuleVisibility();
}

// ==================== MODULE VISIBILITY MANAGEMENT ====================

/**
 * Lấy danh sách các module được chọn từ bảng Chi tiết thành phần
 * @returns {Array} Mảng các loại module được chọn (App, Redis, MariaDB, Kafka, K8S, LB/FW)
 */
function getModuleInstancesFromArchTable() {
    const instances = [];
    const moduleCounters = {};

    document.querySelectorAll('#arch-table-body tr').forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        const moduleName = getArchRowModuleName(row).trim();
        const moduleType = cells[2]?.querySelector('select')?.value?.trim() || '';

        if (!moduleType) return;

        // Assign persistent rowId if not present (backward compat for existing rows)
        let rowId = row.dataset.rowId;
        if (!rowId) {
            rowId = 'arch-row-' + (++archRowIdCounter);
            row.dataset.rowId = rowId;
        }

        moduleCounters[moduleType] = (moduleCounters[moduleType] || 0) + 1;
        instances.push({
            rowIndex,
            rowId,
            moduleType,
            moduleName,
            sequence: moduleCounters[moduleType]
        });
    });

    return instances;
}

function getModuleInstancesByType() {
    const grouped = {};
    getModuleInstancesFromArchTable().forEach(instance => {
        if (!grouped[instance.moduleType]) {
            grouped[instance.moduleType] = [];
        }
        grouped[instance.moduleType].push(instance);
    });
    return grouped;
}

function getSelectedModules() {
    return Object.keys(getModuleInstancesByType());
}

function getModuleInstanceDisplayName(instance) {
    if (instance.moduleName) return instance.moduleName;
    return `${instance.moduleType} #${instance.sequence}`;
}

const MODULE_TEMPLATE_MAPPING = {
    'App': 'module-app-content',
    'Redis': 'module-redis-content',
    'MariaDB': 'module-mariadb-content',
    'Kafka': 'module-kafka-content',
    'K8S': 'module-k8s-content',
    'LB/FW': 'module-lbfw-content',
    'Khác': 'module-custom-content'
};

const MODULE_ICON_MAPPING = {
    'App': 'fa-solid fa-cube',
    'Redis': 'fa-solid fa-database',
    'MariaDB': 'fa-solid fa-database',
    'Kafka': 'fa-solid fa-stream',
    'K8S': 'fa-solid fa-dharmachakra',
    'LB/FW': 'fa-solid fa-shield-alt',
    'Khác': 'fa-solid fa-puzzle-piece'
};

const moduleTemplateRegistry = {};
let moduleTemplatesInitialized = false;

function getModuleInstanceKey(instance) {
    // Use instance.rowId (persistent ID assigned to each arch table row) instead of
    // computed values like rowIndex or sequence. This ensures instanceKey is stable
    // across any module deletions/reorders — only the row's own ID matters.
    const id = instance.rowId || `arch-${instance.rowIndex}-${instance.sequence || instance.rowIndex + 1}`;
    return `${instance.moduleType}-${id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function initializeModuleInstanceTemplates() {
    if (moduleTemplatesInitialized) return;

    Object.entries(MODULE_TEMPLATE_MAPPING).forEach(([moduleName, contentId]) => {
        const content = document.getElementById(contentId);
        const wrapper = content?.closest('.module-collapsible');
        if (!wrapper || !wrapper.parentNode) return;

        const anchorId = `module-anchor-${contentId}`;
        const anchor = document.createElement('div');
        anchor.id = anchorId;
        wrapper.parentNode.replaceChild(anchor, wrapper);

        moduleTemplateRegistry[moduleName] = {
            anchorId,
            templateHtml: wrapper.outerHTML
        };
    });

    moduleTemplatesInitialized = true;
}

function runInInstanceContext(instanceKey, callback, thisArg) {
    const suffix = `__inst_${instanceKey}`;
    const nodes = Array.from(document.querySelectorAll(`[id$="${suffix}"]`));
    const renamed = [];

    nodes.forEach(node => {
        const currentId = node.id;
        const baseId = currentId.substring(0, currentId.length - suffix.length);
        renamed.push({ node, currentId });
        node.id = baseId;
    });

    const previousKey = window.__activeInstanceKey;
    window.__activeInstanceKey = instanceKey;
    try {
        if (typeof callback === 'function') {
            return callback.call(thisArg);
        }
    } finally {
        renamed.forEach(item => {
            item.node.id = item.currentId;
        });
        window.__activeInstanceKey = previousKey;
    }
}

function buildInstanceAwareHandler(handlerCode) {
    if (window.__activeInstanceKey) {
        return `return runInInstanceContext('${window.__activeInstanceKey}', function(){ ${handlerCode} }, this);`;
    }
    return handlerCode;
}

function rewriteInlineHandlersForInstance(root, instanceKey) {
    const candidates = root.querySelectorAll('*');
    candidates.forEach(el => {
        ['onclick', 'onchange', 'oninput'].forEach(attr => {
            const raw = el.getAttribute(attr);
            if (!raw) return;
            const wrapped = `return runInInstanceContext('${instanceKey}', function(){ ${raw} }, this);`;
            el.setAttribute(attr, wrapped);
        });
    });
}

function applyModuleInstanceHeader(wrapper, moduleName, instance) {
    if (!wrapper || !instance) return;

    const header = wrapper.querySelector('.module-collapsible-header');
    const titleSpan = header?.querySelector('span');
    const displayName = getModuleInstanceDisplayName(instance);

    if (titleSpan) {
        const iconClass = MODULE_ICON_MAPPING[moduleName] || 'fa-solid fa-cube';
        titleSpan.innerHTML = `<i class="${iconClass}"></i> Module ${escapeHtml(displayName)}`;
    }

    if (header) {
        header.title = displayName;
    }
}

function syncModuleWrapperState(wrapper) {
    if (!wrapper) return;

    const header = wrapper.querySelector('.module-collapsible-header');
    const content = wrapper.querySelector('.module-collapsible-content');
    if (!header || !content) return;

    const isExpanded = content.classList.contains('expanded');
    header.classList.toggle('active', isExpanded);
}

function createModuleCloneForInstance(moduleName, instance) {
    const registryItem = moduleTemplateRegistry[moduleName];
    if (!registryItem) return null;

    const holder = document.createElement('div');
    holder.innerHTML = registryItem.templateHtml;
    const wrapper = holder.firstElementChild;
    if (!wrapper) return null;

    const instanceKey = getModuleInstanceKey(instance);
    wrapper.classList.add('module-instance-wrapper');
    wrapper.dataset.moduleType = moduleName;
    wrapper.dataset.instanceKey = instanceKey;

    wrapper.querySelectorAll('[id]').forEach(node => {
        node.id = `${node.id}__inst_${instanceKey}`;
    });

    rewriteInlineHandlersForInstance(wrapper, instanceKey);
    applyModuleInstanceHeader(wrapper, moduleName, instance);
    syncModuleWrapperState(wrapper);

    if (moduleName === 'App' || moduleName === 'K8S') {
        const prefix = moduleName === 'App' ? 'app' : 'k8s';
        runInInstanceContext(instanceKey, () => onVirtualizationModeChange(prefix));
    }

    return wrapper;
}

function captureFormControlStates(scope) {
    if (!scope) return [];

    return Array.from(scope.querySelectorAll('input, textarea, select')).map((el, index) => ({
        index,
        id: el.id || '',
        tag: el.tagName.toLowerCase(),
        type: (el.type || '').toLowerCase(),
        value: el.value,
        checked: typeof el.checked === 'boolean' ? el.checked : undefined,
        selectedIndex: typeof el.selectedIndex === 'number' ? el.selectedIndex : undefined
    }));
}

function applyFormControlStates(scope, states) {
    if (!scope || !Array.isArray(states) || states.length === 0) return;

    const controls = Array.from(scope.querySelectorAll('input, textarea, select'));
    if (controls.length === 0) return;

    const stateById = new Map();
    states.forEach(state => {
        if (state && state.id) stateById.set(state.id, state);
    });

    controls.forEach((el, index) => {
        let state = null;

        if (el.id && stateById.has(el.id)) {
            state = stateById.get(el.id);
        } else if (states[index]) {
            state = states[index];
        }

        if (!state) return;

        const tag = el.tagName.toLowerCase();
        const type = (el.type || '').toLowerCase();

        if (tag === 'input') {
            if (type === 'file') return;
            if (type === 'checkbox' || type === 'radio') {
                if (typeof state.checked === 'boolean') el.checked = state.checked;
                return;
            }
            el.value = state.value ?? '';
            return;
        }

        if (tag === 'textarea') {
            el.value = state.value ?? '';
            return;
        }

        if (tag === 'select') {
            const stateValue = state.value ?? '';
            const hasOption = Array.from(el.options).some(opt => opt.value === stateValue);
            if (hasOption) {
                el.value = stateValue;
            } else if (typeof state.selectedIndex === 'number' && state.selectedIndex >= 0 && state.selectedIndex < el.options.length) {
                el.selectedIndex = state.selectedIndex;
            }
        }
    });
}

function captureCurrentModuleInstanceSnapshots() {
    const snapshots = new Map();
    document.querySelectorAll('.module-instance-wrapper[data-instance-key]').forEach(wrapper => {
        const instanceKey = wrapper.dataset.instanceKey;
        if (!instanceKey) return;
        snapshots.set(instanceKey, {
            html: wrapper.innerHTML,
            moduleType: wrapper.dataset.moduleType || '',
            controlStates: captureFormControlStates(wrapper)
        });
    });
    return snapshots;
}

function renderModuleInstances(moduleName, moduleInstances, preservedSnapshots = null) {
    const registryItem = moduleTemplateRegistry[moduleName];
    if (!registryItem) return;

    const anchor = document.getElementById(registryItem.anchorId);
    if (!anchor || !anchor.parentNode) return;

    document.querySelectorAll(`.module-instance-wrapper[data-module-type="${moduleName}"]`).forEach(node => {
        node.remove();
    });

    let cursor = anchor;
    moduleInstances.forEach(instance => {
        const clone = createModuleCloneForInstance(moduleName, instance);
        if (!clone) return;

        const instanceKey = getModuleInstanceKey(instance);
        const snapshot = preservedSnapshots?.get(instanceKey);
        if (snapshot && snapshot.moduleType === moduleName && typeof snapshot.html === 'string') {
            clone.innerHTML = snapshot.html;
            rewriteInlineHandlersForInstance(clone, instanceKey);
            applyFormControlStates(clone, snapshot.controlStates);
        }

        applyModuleInstanceHeader(clone, moduleName, instance);
        syncModuleWrapperState(clone);

        cursor.after(clone);
        cursor = clone;
    });
}

function renderModuleInstancesInOrder(instances, preservedSnapshots = null) {
    const container = document.getElementById('sizing-modules-container');
    if (!container) return;

    container.innerHTML = '';

    instances.forEach(instance => {
        const moduleName = instance.moduleType;
        const clone = createModuleCloneForInstance(moduleName, instance);
        if (!clone) return;

        const instanceKey = getModuleInstanceKey(instance);
        const snapshot = preservedSnapshots?.get(instanceKey);
        if (snapshot && snapshot.moduleType === moduleName && typeof snapshot.html === 'string') {
            clone.innerHTML = snapshot.html;
            rewriteInlineHandlersForInstance(clone, instanceKey);
            applyFormControlStates(clone, snapshot.controlStates);
        }

        applyModuleInstanceHeader(clone, moduleName, instance);
        syncModuleWrapperState(clone);

        container.appendChild(clone);

        if (moduleName === 'App') {
            runInInstanceContext(instanceKey, () => ensureDefaultAppSizingRows());
        }
        if (moduleName === 'MariaDB') {
            runInInstanceContext(instanceKey, () => ensureDefaultMariaDBRefRows());
        }
        if (moduleName === 'Redis') {
            runInInstanceContext(instanceKey, () => ensureDefaultRedisConfigRows());
        }
        if (moduleName === 'Kafka') {
            runInInstanceContext(instanceKey, () => ensureDefaultKafkaLinearRows());
        }
        if (moduleName === 'K8S') {
            runInInstanceContext(instanceKey, () => ensureDefaultK8SSizingRows());
        }
        if (moduleName === 'Khác') {
            runInInstanceContext(instanceKey, () => ensureDefaultCustomLinearRows());
        }
    });
}

/**
 * Cập nhật visibility của các module sections dựa trên các module được chọn
 * Chỉ hiển thị module được chọn, ẩn các module khác
 */
function updateModuleVisibility() {
    initializeModuleInstanceTemplates();
    const instancesByType = getModuleInstancesByType();
    const preservedSnapshots = captureCurrentModuleInstanceSnapshots();
    const orderedInstances = getModuleInstancesFromArchTable();
    renderModuleInstancesInOrder(orderedInstances, preservedSnapshots);
    if (!document.getElementById('sizing-modules-container')) {
        Object.keys(MODULE_TEMPLATE_MAPPING).forEach(moduleName => {
            renderModuleInstances(moduleName, instancesByType[moduleName] || [], preservedSnapshots);
        });
    }

    syncMariaDBMasterRadioNames();

    try { populatePocSizingDropdowns(); } catch (e) { }

    try { refreshSizingRequiredMarkers(); } catch (e) { }

    try { applyRolePermissions(); } catch (e) { }
}

// ==================== TỔNG HỢP VÀ ĐỀ XUẤT ====================

let summaryDeletedRowKeys = new Set();
let summaryManualOverrideActive = false;
let summaryNeedsRefreshFromSizing = false;
let summaryAutosaveTimer = null;
const SUMMARY_AUTOSAVE_DELAY_MS = 500;

function resetSummaryManualOverrideState() {
    summaryDeletedRowKeys = new Set();
    summaryManualOverrideActive = false;
}

function getSummaryDeletedRowKeysArray() {
    return Array.from(summaryDeletedRowKeys);
}

function cancelSummaryAutosave() {
    if (summaryAutosaveTimer) {
        clearTimeout(summaryAutosaveTimer);
        summaryAutosaveTimer = null;
    }
}

function setSummarySaveStatusMessage(html, clearAfterMs = 0) {
    const statusDiv = document.getElementById('summary-save-status');
    if (!statusDiv) return;

    statusDiv.innerHTML = html || '';

    if (clearAfterMs > 0 && html) {
        setTimeout(() => {
            if (statusDiv.innerHTML === html) {
                statusDiv.innerHTML = '';
            }
        }, clearAfterMs);
    }
}

function markSummaryNeedsSizingRefresh() {
    summaryNeedsRefreshFromSizing = true;
}

function clearSummaryNeedsSizingRefresh() {
    summaryNeedsRefreshFromSizing = false;
}

function loadSummaryAdminReview(reviewData = {}) {
    const evalSelect = document.getElementById('eval-summary');
    const noteInput = document.getElementById('note-summary');
    const normalizedReview = reviewData && typeof reviewData === 'object' ? reviewData : {};

    if (evalSelect) {
        evalSelect.value = normalizedReview.eval || '';
        styleAdminSelect(evalSelect);
    }
    if (noteInput) {
        noteInput.value = normalizedReview.note || '';
    }
}

function clearSummaryAdminReview() {
    loadSummaryAdminReview({});
}

function collectSummaryAdminReview() {
    return {
        eval: document.getElementById('eval-summary')?.value || '',
        note: document.getElementById('note-summary')?.value || ''
    };
}

function markSummaryPendingManualSave(message = 'Có thay đổi chưa lưu. Vui lòng bấm "Lưu dữ liệu".') {
    setSummarySaveStatusMessage(
        `<span class="u-text-warning u-text-sm"><i class="fa-solid fa-circle-exclamation"></i> ${message}</span>`
    );
}

async function persistSummarySnapshot(options = {}) {
    const {
        showToastOnSuccess = false,
        successMessage = 'Da luu bang tong hop thanh cong!',
        savingMessage = 'Dang luu bang tong hop...',
        savedMessage = 'Da tu luu thay doi bang tong hop.',
        errorMessagePrefix = 'Loi khi luu bang tong hop: '
    } = options;

    cancelSummaryAutosave();

    if (!currentProjectId) return false;

    const summaryData = collectTongHop();
    setSummarySaveStatusMessage(
        `<span class="u-text-warning u-text-sm"><i class="fa-solid fa-spinner fa-spin"></i> ${savingMessage}</span>`
    );

    try {
        const summaryPayload = {
            tongHopVaDeXuatContent: JSON.stringify(summaryData)
        };
        const response = currentProjectDataId
            ? await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(summaryPayload)
            })
            : await fetchAPI(`${API_BASE_URL}/project-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProjectId,
                    ...summaryPayload
                })
            });

        if (!response.ok) {
            throw new Error(await response.text() || 'Save summary failed');
        }

        if (!currentProjectDataId && typeof response.json === 'function') {
            try {
                const result = await response.json();
                if (result?.id) {
                    saveProjectDataIdToStorage(result.id);
                }
            } catch (e) { }
        }

        setSummarySaveStatusMessage(
            `<span class="u-text-success u-text-sm"><i class="fa-solid fa-check"></i> ${savedMessage}</span>`,
            4000
        );

        if (showToastOnSuccess) {
            showToast(successMessage, 'success');
        }

        return true;
    } catch (error) {
        Logger.error('Error saving summary snapshot:', error);
        setSummarySaveStatusMessage(
            '<span class="u-text-danger u-text-sm"><i class="fa-solid fa-exclamation-triangle"></i> Loi khi tu luu bang tong hop</span>'
        );
        if (options.showToastOnError !== false) {
            showToast(errorMessagePrefix + error.message, 'error');
        }
        return false;
    }
}

function scheduleSummaryAutosave() {
    cancelSummaryAutosave();

    if (!currentProjectId) return;

    summaryAutosaveTimer = setTimeout(() => {
        persistSummarySnapshot({
            savingMessage: 'Dang tu luu thay doi bang tong hop...',
            savedMessage: 'Da tu luu thay doi bang tong hop.',
            errorMessagePrefix: 'Loi khi tu luu bang tong hop: ',
            showToastOnError: true
        });
    }, SUMMARY_AUTOSAVE_DELAY_MS);
}

function normalizeSummaryKeyPart(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').replace(/[|]/g, '/');
}

function buildSummaryRowKey(parts, occurrence = 1) {
    const normalizedParts = (Array.isArray(parts) ? parts : [parts])
        .map(normalizeSummaryKeyPart)
        .filter(Boolean);
    normalizedParts.push(String(occurrence || 1));
    return normalizedParts.join('::');
}

function renderSummaryEmptyState(tbody) {
    if (!tbody) return;
    tbody.innerHTML = `<tr>
        <td colspan="6" class="text-center u-text-muted u-p-30">
            <i class="fa-solid fa-info-circle"></i> Chưa có dữ liệu định cỡ. Vui lòng thực hiện tính toán ở các module trước.
        </td>
    </tr>`;
}

function renderSummaryResults(tbody, rows) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(rows) || rows.length === 0) {
        renderSummaryEmptyState(tbody);
        return;
    }

    rows.forEach((row, index) => {
        const tr = createSummaryTableRow(index + 1, row);
        tbody.appendChild(tr);
    });

    try { applyRolePermissions(); } catch (e) { }
}

function loadTongHop(data) {
    const tbody = document.getElementById('summary-table-body');
    if (!tbody) return;

    const deletedRowKeys = Array.isArray(data?.deletedRowKeys) ? data.deletedRowKeys : [];
    summaryDeletedRowKeys = new Set(
        deletedRowKeys
            .map(key => String(key || '').trim())
            .filter(Boolean)
    );
    summaryManualOverrideActive = data?.manualOverrideActive === true;
    clearSummaryNeedsSizingRefresh();
    cancelSummaryAutosave();

    renderSummaryResults(tbody, Array.isArray(data?.summaryRows) ? data.summaryRows : []);
}

function createSummaryTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    const moduleType = String(data.moduleType || data.module || '').trim();
    const moduleName = escapeHtml(data.moduleName || '');
    const escapedGhiChu = escapeHtml(data.ghiChu || '').replace(/\r?\n/g, '<br>');
    const hasHtmlConfig = /<[^>]+>/.test(data.cauHinh || '');
    const rowKey = String(data.rowKey || '').trim();
    const renderedCauHinh = hasHtmlConfig
        ? `<div class="summary-multiline-cell">${data.cauHinh || ''}</div>`
        : `<div class="summary-multiline-cell">${escapeHtml(data.cauHinh || '').replace(/\r?\n/g, '<br>')}</div>`;

    if (rowKey) {
        tr.dataset.rowKey = rowKey;
    }
    if (moduleType) {
        tr.dataset.moduleType = moduleType;
    }

    tr.innerHTML = `
        <td>${stt}</td>
        <td>${moduleName}</td>
        <td class="summary-config-cell">${renderedCauHinh}</td>
        <td class="text-center">${data.soLuong || ''}</td>
        <td class="summary-note-cell"><div class="summary-multiline-cell">${escapedGhiChu}</div></td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeSummaryRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
        </td>
    `;
    return tr;
}

function collectTongHop() {
    const summaryRows = [];
    document.querySelectorAll('#summary-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6 && !cells[0].hasAttribute('colspan')) {
            summaryRows.push({
                rowKey: row.dataset.rowKey || '',
                moduleType: row.dataset.moduleType || '',
                moduleName: cells[1]?.textContent?.trim() || '',
                cauHinh: cells[2]?.innerText?.trim() || '',
                soLuong: cells[3]?.textContent?.trim() || '',
                ghiChu: cells[4]?.innerText?.trim() || ''
            });
        }
    });

    return {
        summaryRows,
        deletedRowKeys: getSummaryDeletedRowKeysArray(),
        manualOverrideActive: summaryManualOverrideActive
    };
}

function aggregateSizingResults(options = {}) {
    const tbody = document.getElementById('summary-table-body');
    if (!tbody) return [];

    const resetManualDeletes = options.resetManualDeletes === true;
    if (resetManualDeletes) {
        resetSummaryManualOverrideState();
    }

    const preserveDeletedRows = options.preserveDeletedRows ?? summaryManualOverrideActive;
    const orderedInstances = getModuleInstancesFromArchTable();
    const selectedModules = orderedInstances.map(instance => instance.moduleType);
    const hasAppSelected = selectedModules.includes('App');

    const results = [];
    const rowKeyCounters = {};
    let stt = 1;

    const pushSummaryResult = (instanceKey, rowData, rowKeyParts = []) => {
        const normalizedRow = {
            stt: stt++,
            moduleType: rowData.moduleType || '',
            moduleName: rowData.moduleName || '',
            cauHinh: rowData.cauHinh || '',
            soLuong: rowData.soLuong || '',
            ghiChu: rowData.ghiChu || ''
        };
        const baseParts = [
            instanceKey,
            normalizedRow.moduleType,
            normalizedRow.moduleName,
            ...rowKeyParts
        ];
        const counterKey = baseParts.map(normalizeSummaryKeyPart).join('::');
        rowKeyCounters[counterKey] = (rowKeyCounters[counterKey] || 0) + 1;
        normalizedRow.rowKey = buildSummaryRowKey(baseParts, rowKeyCounters[counterKey]);
        results.push(normalizedRow);
    };

    orderedInstances.forEach(instance => {
        const instanceKey = getModuleInstanceKey(instance);

        if (instance.moduleType === 'App') {
            const appData = runInInstanceContext(instanceKey, () => {
                const container = document.getElementById('sizing-result-container');
                if (container) syncTextareasInContainer(container);
                return resolveEffectiveAppProposalResult({
                    sizingResult: container?.innerHTML || '',
                    selectedProposalSource: getAppSelectedProposalSource(container),
                    customProposalTable: collectAppCustomProposalTableData(container)
                });
            });
            if (appData) {
                const instanceName = getModuleInstanceDisplayName(instance);
                const appRows = Array.isArray(appData.rows) && appData.rows.length > 0 ? appData.rows : [appData];
                appRows.forEach((row, rowIndex) => {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'App',
                        moduleName: (row.component || '').trim() || instanceName,
                        cauHinh: row.cauHinh,
                        soLuong: row.soLuong,
                        ghiChu: row.ghiChu
                    }, [row.component || '', rowIndex + 1]);
                });
            }
            return;
        }

        if (instance.moduleType === 'MariaDB') {
            const mariaData = runInInstanceContext(instanceKey, () => {
                const mariaContainer = document.getElementById('mariadb-result-container');
                return resolveEffectiveMariaDBProposalResult({
                    resultHTML: mariaContainer?.innerHTML || '',
                    selectedProposalSource: getMariaDBSelectedProposalSource(mariaContainer),
                    customProposalTable: collectMariaDBCustomProposalTableData(mariaContainer)
                });
            });
            if (mariaData) {
                const instanceName = getModuleInstanceDisplayName(instance);
                pushSummaryResult(instanceKey, {
                    moduleType: 'MariaDB',
                    moduleName: instanceName,
                    cauHinh: mariaData.cauHinh,
                    soLuong: mariaData.soLuong,
                    ghiChu: mariaData.ghiChu
                }, ['mariadb']);
                if (mariaData.maxScale) {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'MaxScale',
                        moduleName: instanceName,
                        cauHinh: mariaData.maxScale.cauHinh,
                        soLuong: mariaData.maxScale.soLuong,
                        ghiChu: mariaData.maxScale.ghiChu
                    }, ['maxscale']);
                }
                if (mariaData.nas) {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'NAS',
                        moduleName: instanceName,
                        cauHinh: mariaData.nas.cauHinh,
                        soLuong: mariaData.nas.soLuong,
                        ghiChu: mariaData.nas.ghiChu
                    }, ['nas']);
                }
            }
            return;
        }

        if (instance.moduleType === 'Redis') {
            const redisData = runInInstanceContext(instanceKey, () => {
                const redisKeyBtn = document.getElementById('redis-method-key');
                const isKeyMethodSelected = redisKeyBtn?.classList.contains('active') === true;
                const activeContainer = isKeyMethodSelected
                    ? document.getElementById('redis-key-result-container')
                    : document.getElementById('redis-config-result-container');
                return resolveEffectiveRedisProposalResult({
                    resultHTML: activeContainer?.innerHTML || '',
                    selectedProposalSource: getRedisSelectedProposalSource(activeContainer),
                    customProposalTable: collectRedisCustomProposalTableData(activeContainer)
                });
            });
            if (redisData) {
                const instanceName = getModuleInstanceDisplayName(instance);
                const redisRows = Array.isArray(redisData.rows) && redisData.rows.length > 0 ? redisData.rows : [redisData];
                redisRows.forEach(row => {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'Redis',
                        moduleName: row.component ? `${instanceName} - ${row.component}` : instanceName,
                        cauHinh: row.cauHinh,
                        soLuong: row.soLuong,
                        ghiChu: row.ghiChu
                    }, [row.component || 'redis']);
                });
            }
            return;
        }

        if (instance.moduleType === 'Kafka') {
            const kafkaData = runInInstanceContext(instanceKey, () => {
                const kafkaMethodThroughputBtn = document.getElementById('kafka-method-throughput');
                const isThroughputMethodSelected = kafkaMethodThroughputBtn?.classList.contains('active') === true;
                const kafkaContainer = isThroughputMethodSelected
                    ? document.getElementById('kafka-throughput-result-container')
                    : document.getElementById('kafka-linear-result-container');
                return resolveEffectiveKafkaProposalResult({
                    resultHTML: kafkaContainer?.innerHTML || '',
                    selectedProposalSource: getKafkaSelectedProposalSource(kafkaContainer),
                    customProposalTable: collectKafkaCustomProposalTableData(kafkaContainer)
                });
            });
            if (kafkaData) {
                const instanceName = getModuleInstanceDisplayName(instance);
                pushSummaryResult(instanceKey, {
                    moduleType: 'Kafka',
                    moduleName: instanceName,
                    cauHinh: kafkaData.cauHinh,
                    soLuong: kafkaData.soLuong,
                    ghiChu: kafkaData.ghiChu
                }, ['kafka']);
                if (kafkaData.zookeeper) {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'Zookeeper/KRaft',
                        moduleName: instanceName,
                        cauHinh: kafkaData.zookeeper.cauHinh,
                        soLuong: kafkaData.zookeeper.soLuong,
                        ghiChu: kafkaData.zookeeper.ghiChu
                    }, ['zookeeper-kraft']);
                }
            }
            return;
        }

        if (instance.moduleType === 'K8S') {
            const k8sData = runInInstanceContext(instanceKey, () => {
                const k8sContainer = document.getElementById('k8s-result-container');
                return resolveEffectiveK8SProposalResult({
                    resultHTML: k8sContainer?.innerHTML || '',
                    selectedProposalSource: getK8SSelectedProposalSource(k8sContainer),
                    customProposalTable: collectK8SCustomProposalTableData(k8sContainer)
                });
            });
            if (k8sData && Array.isArray(k8sData)) {
                const instanceName = getModuleInstanceDisplayName(instance);
                k8sData.forEach(item => {
                    pushSummaryResult(instanceKey, {
                        moduleType: item.module,
                        moduleName: instanceName,
                        cauHinh: item.cauHinh,
                        soLuong: item.soLuong,
                        ghiChu: item.ghiChu
                    }, [item.module]);
                });
            }
            return;
        }

        if (instance.moduleType === 'LB/FW') {
            const instanceName = getModuleInstanceDisplayName(instance);
            const summaryRows = runInInstanceContext(instanceKey, () => resolveLBFWSummaryRows(collectLBFWData(), instanceName));
            if (Array.isArray(summaryRows) && summaryRows.length > 0) {
                summaryRows.forEach((row, rowIndex) => {
                    pushSummaryResult(instanceKey, {
                        moduleType: row.moduleType,
                        moduleName: row.moduleName,
                        cauHinh: row.cauHinh,
                        soLuong: row.soLuong,
                        ghiChu: row.ghiChu
                    }, ['lbfw', row.moduleName || '', rowIndex + 1]);
                });
            } else if (hasAppSelected) {
                const appData = runInInstanceContext(instanceKey, () => {
                    const appResult = document.getElementById('sizing-result-container')?.innerHTML || '';
                    return parseAppSizingResult(appResult);
                });
                if (appData && appData.fwlb) {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'FW/LB',
                        moduleName: getModuleInstanceDisplayName(instance),
                        cauHinh: appData.fwlb.cauHinh,
                        soLuong: '',
                        ghiChu: ''
                    }, ['app-fallback-lbfw']);
                }
            }
            return;
        }

        if (instance.moduleType === 'Khác') {
            const customData = runInInstanceContext(instanceKey, () => collectCustomModuleData());
            const instanceName = getModuleInstanceDisplayName(instance);

            if (customData.selectedMethod === 'linearEquivalentApp') {
                const parsed = resolveEffectiveAppProposalResult(customData.linearEquivalentApp || {});
                if (parsed) {
                    const customRows = Array.isArray(parsed.rows) && parsed.rows.length > 0 ? parsed.rows : [parsed];
                    customRows.forEach((row, rowIndex) => {
                        pushSummaryResult(instanceKey, {
                            moduleType: 'Khác',
                            moduleName: instanceName,
                            cauHinh: row.cauHinh,
                            soLuong: row.soLuong,
                            ghiChu: row.ghiChu
                        }, [row.component || '', rowIndex + 1]);
                    });
                }
            } else {
                const docText = (customData.customMethodDocText || '').trim();
                const proposalRows = Array.isArray(customData.customProposalTable) ? customData.customProposalTable : [];
                const nonEmptyRows = proposalRows.filter(r =>
                    (r.component || '').trim() || (r.configuration || '').trim() || (r.quantity || '').trim() || (r.note || '').trim()
                );
                if (nonEmptyRows.length > 0) {
                    nonEmptyRows.forEach(row => {
                        pushSummaryResult(instanceKey, {
                            moduleType: 'Khác',
                            moduleName: (row.component || '').trim() || instanceName,
                            cauHinh: row.configuration ? row.configuration.replace(/\r?\n/g, '<br>') : 'Theo phương pháp khác (xem chi tiết)',
                            soLuong: (row.quantity || '').trim(),
                            ghiChu: (row.note || '').trim()
                        }, [(row.component || '').trim() || 'custom-proposal']);
                    });
                } else {
                    pushSummaryResult(instanceKey, {
                        moduleType: 'Khác',
                        moduleName: instanceName,
                        cauHinh: 'Theo phương pháp khác (xem chi tiết)',
                        soLuong: '',
                        ghiChu: ''
                    }, ['custom-doc']);
                }
            }
        }
    });

    const visibleResults = preserveDeletedRows
        ? results.filter(row => !summaryDeletedRowKeys.has(row.rowKey))
        : results;

    visibleResults.forEach((row, index) => {
        row.stt = index + 1;
    });

    renderSummaryResults(tbody, visibleResults);
    clearSummaryNeedsSizingRefresh();
    return visibleResults;
}

function stripUnsafeHtml(rawHtml) {
    if (!rawHtml) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    doc.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            const value = (attr.value || '').trim().toLowerCase();
            if (name.startsWith('on')) el.removeAttribute(attr.name);
            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return doc.body.innerHTML;
}

function getCustomDocEditor() {
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const baseId = 'custom-method-editor';
    return instanceKey
        ? document.getElementById(`${baseId}__inst_${instanceKey}`)
        : document.getElementById(baseId);
}

function getLBFWCustomDocEditor() {
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const baseId = 'lbfw-custom-method-editor';
    return instanceKey
        ? document.getElementById(`${baseId}__inst_${instanceKey}`)
        : document.getElementById(baseId);
}

const STORAGE_IP_DROPDOWN_CONFIG = {
    app: {
        baselineSelector: '#baseline-table-body .ip-input',
        storageSelector: '#storage-input-table-body .storage-ip-input'
    },
    k8s: {
        baselineSelector: '#k8s-baseline-table-body .k8s-ip-input',
        storageSelector: '#k8s-storage-input-table-body .k8s-storage-ip-input'
    },
    custom: {
        baselineSelector: '#custom-baseline-table-body .ip-input',
        storageSelector: '#custom-storage-input-table-body .custom-storage-ip-input'
    }
};

function getBaselineIpsForStorageDropdown(moduleKey) {
    const config = STORAGE_IP_DROPDOWN_CONFIG[moduleKey];
    if (!config) return [];

    const seen = new Set();
    return Array.from(document.querySelectorAll(config.baselineSelector))
        .map(input => (input.value || '').trim())
        .filter(ip => {
            if (!ip || seen.has(ip)) return false;
            seen.add(ip);
            return true;
        });
}

function buildStorageIpOptions(moduleKey, selectedValue = '') {
    const selected = String(selectedValue || '').trim();
    const ips = getBaselineIpsForStorageDropdown(moduleKey);
    const options = ['<option value="">-- Chọn IP --</option>'];

    if (selected && !ips.includes(selected)) {
        const escapedSelected = escapeHtml(selected);
        options.push(`<option value="${escapedSelected}" selected>${escapedSelected} (không còn trong tham chiếu)</option>`);
    }

    ips.forEach(ip => {
        const escapedIp = escapeHtml(ip);
        const selectedAttr = ip === selected ? ' selected' : '';
        options.push(`<option value="${escapedIp}"${selectedAttr}>${escapedIp}</option>`);
    });

    return options.join('');
}

function setStorageIpSelectValue(select, moduleKey, value) {
    if (!select) return;
    const selected = String(value || '').trim();
    select.innerHTML = buildStorageIpOptions(moduleKey, selected);
    select.value = selected;
}

function refreshStorageIpDropdowns(moduleKey) {
    const config = STORAGE_IP_DROPDOWN_CONFIG[moduleKey];
    if (!config) return;

    document.querySelectorAll(config.storageSelector).forEach(select => {
        setStorageIpSelectValue(select, moduleKey, select.value);
    });
}

// Collect custom baseline table data
function collectCustomBaselineTableData() {
    const rows = document.querySelectorAll('#custom-baseline-table-body tr');
    const data = [];
    rows.forEach((row, index) => {
        const ip = row.querySelector('.ip-input')?.value || '';
        const cpu = row.querySelector('.cpu-input')?.value || '';
        const ram = row.querySelector('.ram-input')?.value || '';
        const disk = row.querySelector('.disk-input')?.value || '';
        const cint = row.querySelector('.cint-input')?.value || '';

        const evidenceImages = collectInlineEvidenceFromScope(row);

        const adminEval = row.querySelector('.admin-eval-select')?.value || '';
        const adminNote = row.querySelector('.admin-note')?.value || '';

        if (ip || cpu || ram || disk || cint) {
            data.push({
                stt: index + 1,
                ip, cpu, ram, disk, cintRate: cint,
                evidenceImages,
                adminRating: adminEval,
                adminNote
            });
        }
    });
    return data.length > 0 ? data : null;
}

// Collect custom input config table data
function collectCustomInputConfigTableData() {
    const rows = document.querySelectorAll('#custom-input-config-table-body tr');
    const data = [];
    rows.forEach((row, index) => {
        const ip = row.querySelector('.ip-config-input')?.value || '';
        const cpuLoad = row.querySelector('.cpu-load-input')?.value || '0';
        const ramLoad = row.querySelector('.ram-load-input')?.value || '0';
        const cintUsed = row.querySelector('.cint-used-input')?.value || '0';
        const ramUsed = row.querySelector('.ram-used-input')?.value || '0';

        const evidenceImages = collectInlineEvidenceFromScope(row);

        const adminEval = row.querySelector('.custom-input-config-eval')?.value || '';
        const adminNote = row.querySelector('.custom-input-config-note')?.value || '';

        if (ip || cpuLoad !== '0' || ramLoad !== '0') {
            data.push({
                stt: index + 1,
                ip, cpuLoad, ramLoad, cintUsed, ramUsed,
                evidenceImages,
                adminEval,
                adminNote
            });
        }
    });
    return data.length > 0 ? data : null;
}

function collectCustomStorageInputTableData() {
    const rows = document.querySelectorAll('#custom-storage-input-table-body tr');
    const data = [];
    rows.forEach((row, index) => {
        data.push({
            stt: index + 1,
            ip: row.querySelector('.custom-storage-ip-input')?.value || '',
            partition: row.querySelector('.custom-storage-partition-input')?.value || '',
            used: row.querySelector('.custom-storage-used-input')?.value || '',
            note: row.querySelector('.custom-storage-note-input')?.value || '',
            adminEval: row.querySelector('.custom-storage-eval')?.value || '',
            adminNote: row.querySelector('.custom-storage-admin-note')?.value || ''
        });
    });
    return data.length > 0 ? data : null;
}

// Add custom baseline row
function addCustomBaselineRow() {
    const tbody = document.getElementById('custom-baseline-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');

    // Build instance-aware event handlers
    const syncIpHandler = buildInstanceAwareHandler('updateCustomIPToInputConfig(this)');
    const baselineRamHandler = buildInstanceAwareHandler('updateCustomBaselineTotal(); recalculateCustomInputConfigRow(this)');
    const baselineDiskHandler = buildInstanceAwareHandler('updateCustomBaselineTotal()');
    const baselineCintHandler = buildInstanceAwareHandler('updateCustomBaselineTotal(); recalculateCustomInputConfigRow(this)');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler('deleteCustomBaselineRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><input type="text" class="input-full text-center ip-input" placeholder="10.x.x.x" oninput="${syncIpHandler}"></td>
        <td><input type="text" class="input-full cpu-input" placeholder="Intel Xeon..."></td>
        <td><input type="number" class="input-full text-center ram-input" min="0" oninput="${baselineRamHandler}"></td>
        <td><input type="number" class="input-full text-center disk-input" min="0" oninput="${baselineDiskHandler}"></td>
        <td><input type="number" class="input-full text-center cint-input" min="0" oninput="${baselineCintHandler}"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="baseline-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
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
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete" onclick="${deleteRowHandler}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </td>
    `;
    tbody.appendChild(tr);

    // Thêm dòng tương ứng vào input config table
    addCustomInputConfigRow();

    refreshStorageIpDropdowns('custom');
    try { applyRolePermissions(); } catch (e) {}
    return tr;
}

// Add custom input config row
function addCustomInputConfigRow() {
    const tbody = document.getElementById('custom-input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');

    // Build instance-aware event handlers
    const calcHandler = buildInstanceAwareHandler('calculateCustomInputConfigRow(this)');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler('removeRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><input type="text" class="input-full text-center ip-config-input" placeholder="10.x.x.x"></td>
        <td><input type="number" class="input-full text-center cpu-load-input" min="0" step="0.01" oninput="validateLoadInput(this); ${calcHandler}"></td>
        <td><input type="number" class="input-full text-center ram-load-input" min="0" step="0.01" oninput="validateLoadInput(this); ${calcHandler}"></td>
        <td><input type="number" class="input-full text-center cint-used-input field-readonly" min="0" readonly></td>
        <td><input type="number" class="input-full text-center ram-used-input field-readonly" min="0" readonly></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="input-config-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
        </td>
        <td class="admin-cell">
            <select class="admin-eval-select custom-input-config-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note custom-input-config-note" placeholder="Nhận xét...">
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete" onclick="${deleteRowHandler}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

function addCustomStorageInputRow() {
    const tbody = document.getElementById('custom-storage-input-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler('deleteCustomStorageInputRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><select class="input-full text-center sizing-user-input custom-storage-ip-input">${buildStorageIpOptions('custom')}</select></td>
        <td><input type="text" class="input-full text-center sizing-user-input custom-storage-partition-input" placeholder="/u01, /u02,..."></td>
        <td><input type="number" class="input-full text-center sizing-user-input custom-storage-used-input" min="0" step="0.01"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="custom-storage-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
        </td>
        <td><input type="text" class="input-full sizing-user-input custom-storage-note-input" placeholder="Lưu /data, /logs, /backup, NAS, ..."></td>
        <td class="admin-cell">
            <select class="admin-eval-select custom-storage-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note custom-storage-admin-note" placeholder="Nhận xét...">
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="${deleteRowHandler}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </td>
    `;

    tbody.appendChild(tr);
    refreshStorageIpDropdowns('custom');
    try { applyRolePermissions(); } catch (e) {}
}

function deleteCustomStorageInputRow(btn) {
    btn.closest('tr').remove();
    updateCustomStorageInputRowNumbers();
}

// Update custom baseline total
function updateCustomBaselineTotal() {
    const totalRamEl = document.getElementById('custom-total-ram');
    const totalDiskEl = document.getElementById('custom-total-disk');
    const totalCintEl = document.getElementById('custom-total-cint');

    if (!totalRamEl || !totalDiskEl || !totalCintEl) return;

    const tbody = document.getElementById('custom-baseline-table-body');
    if (!tbody) return;

    let totalRam = 0, totalDisk = 0, totalCint = 0;
    tbody.querySelectorAll('tr').forEach(row => {
        const ram = parseFloat(row.querySelector('.ram-input')?.value) || 0;
        const disk = parseFloat(row.querySelector('.disk-input')?.value) || 0;
        const cint = parseFloat(row.querySelector('.cint-input')?.value) || 0;
        totalRam += ram;
        totalDisk += disk;
        totalCint += cint;
    });

    totalRamEl.innerText = totalRam.toFixed(0);
    totalDiskEl.innerText = totalDisk.toFixed(0);
    totalCintEl.innerText = totalCint.toFixed(0);
}

// Update custom input config total
function updateCustomInputConfigTotal() {
    const totalCintUsedEl = document.getElementById('custom-total-cint-used');
    const totalRamUsedEl = document.getElementById('custom-total-ram-used');

    if (!totalCintUsedEl || !totalRamUsedEl) return;

    const tbody = document.getElementById('custom-input-config-table-body');
    if (!tbody) return;

    let totalCintUsed = 0, totalRamUsed = 0;
    tbody.querySelectorAll('tr').forEach(row => {
        totalCintUsed += parseFloat(row.querySelector('.cint-used-input')?.value) || 0;
        totalRamUsed += parseFloat(row.querySelector('.ram-used-input')?.value) || 0;
    });

    totalCintUsedEl.innerText = totalCintUsed.toFixed(2);
    totalRamUsedEl.innerText = totalRamUsed.toFixed(2);
}

// Sync IP to input config for custom module
function updateCustomIPToInputConfig(ipInput) {
    const row = ipInput.closest('tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    const inputConfigTbody = document.getElementById('custom-input-config-table-body');
    if (inputConfigTbody && inputConfigTbody.rows[rowIndex]) {
        const ipConfigInput = inputConfigTbody.rows[rowIndex].querySelector('.ip-config-input');
        if (ipConfigInput) ipConfigInput.value = ipInput.value;
    }
    refreshStorageIpDropdowns('custom');
}

// Calculate custom input config row
function calculateCustomInputConfigRow(inputElement) {
    if (!inputElement) return;
    const row = inputElement.closest('tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    const baselineTbody = document.getElementById('custom-baseline-table-body');
    if (!baselineTbody || !baselineTbody.rows[rowIndex]) return;

    const baselineRow = baselineTbody.rows[rowIndex];
    const cintUsedInput = row.querySelector('.cint-used-input');
    const ramUsedInput = row.querySelector('.ram-used-input');

    if (!cintUsedInput || !ramUsedInput) return;

    const baselineCint = parseFloat(baselineRow.querySelector('.cint-input').value) || 0;
    const baselineRam = parseFloat(baselineRow.querySelector('.ram-input').value) || 0;

    const cpuLoad = parseFloat(row.querySelector('.cpu-load-input')?.value) || 0;
    const ramLoad = parseFloat(row.querySelector('.ram-load-input')?.value) || 0;

    const cintUsed = (baselineCint * cpuLoad / 100).toFixed(2);
    const ramUsed = (baselineRam * ramLoad / 100).toFixed(2);

    cintUsedInput.value = cintUsed;
    ramUsedInput.value = ramUsed;

    updateCustomInputConfigTotal();
}

function getCustomStorageTotalsByPartition() {
    const partitionMap = new Map();

    document.querySelectorAll('#custom-storage-input-table-body tr').forEach(row => {
        const partition = (row.querySelector('.custom-storage-partition-input')?.value || '').trim();
        const used = parseFloat(row.querySelector('.custom-storage-used-input')?.value) || 0;
        if (!partition || used <= 0) return;

        const key = partition.toLowerCase();
        const current = partitionMap.get(key) || { name: partition, totalUsed: 0 };
        current.totalUsed += used;
        partitionMap.set(key, current);
    });

    return Array.from(partitionMap.values());
}

function updateCustomStorageInputRowNumbers() {
    document.querySelectorAll('#custom-storage-input-table-body tr').forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function generateCustomLinearSizingResultHTML(data) {
    const {
        totalCint, totalRam,
        poc, sizing, factor,
        cintForTPS, ramForTPS,
        cintAfterKPI, ramAfterKPI,
        virtualization, ketqua, storageAfterKPI
    } = data;

    const machineRows = [
        {
            label: 'Cintrate cần cho hệ thống',
            value: cintForTPS.toFixed(2),
            note: `= ${totalCint.toFixed(2)} x (${sizing} / ${poc}) = ${totalCint.toFixed(2)} x ${factor.toFixed(4)}`
        },
        {
            label: 'RAM (GB) cần cho hệ thống',
            value: ramForTPS.toFixed(2),
            note: `= ${totalRam.toFixed(2)} x (${sizing} / ${poc}) = ${totalRam.toFixed(2)} x ${factor.toFixed(4)}`
        }
    ];

    storageAfterKPI.forEach(item => {
        machineRows.push({
            label: `${item.name} (GB) cần cho hệ thống`,
            value: item.forTPS.toFixed(2),
            note: `= ${item.totalUsed.toFixed(2)} x (${sizing} / ${poc}) = ${item.totalUsed.toFixed(2)} x ${factor.toFixed(4)}`
        });
    });

    machineRows.push(
        {
            label: 'Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
            value: cintAfterKPI.toFixed(2),
            note: `= ${cintForTPS.toFixed(2)} / 0.75 x 1.1. KPI 75%, Sai số 1.1`
        },
        {
            label: 'RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
            value: ramAfterKPI.toFixed(2),
            note: `= ${ramForTPS.toFixed(2)} / 0.9 x 1.1. KPI 90%, Sai số 1.1`
        }
    );

    storageAfterKPI.forEach(item => {
        machineRows.push({
            label: `${item.name} cần sau khi nhân hệ số dự phòng và đảm bảo KPI`,
            value: item.afterKPI.toFixed(2),
            note: `= ${item.forTPS.toFixed(2)} / 0.8 x 1.1. KPI 80%, Sai số 1.1`
        });
    });

    const recommendationFormula = virtualization.mode === 'vcpu'
        ? `N = ${cintAfterKPI.toFixed(2)} / ${virtualization.vcpu}`
        : `N = ${ramAfterKPI.toFixed(2)} / ${virtualization.ram}`;
    const recommendationTarget = virtualization.mode === 'vcpu'
        ? `theo vCPU <strong>${virtualization.selectedLabel}</strong>`
        : `theo RAM <strong>${virtualization.selectedLabel}</strong>`;
    const cintPerServer = Math.ceil(cintAfterKPI / ketqua);
    const ramPerServer = Math.ceil(ramAfterKPI / ketqua);
    const storagePerServer = storageAfterKPI.map(item => ({
        name: item.name,
        perServer: Math.ceil(item.afterKPI / ketqua)
    }));

    let html = '';
    html += `<h4 class="u-mt-16 u-mb-8 u-text-section">Bảng tính toán Máy chủ Tiến trình</h4>`;
    html += `<table class="sizing-table app-machine-table u-mt-8" data-app-machine-table="1">
                <thead>
                    <tr>
                        <th class="col-w-50">STT</th>
                        <th class="col-w-350">Thông số</th>
                        <th class="col-w-150">Máy chủ Tiến trình</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>`;
    machineRows.forEach((row, index) => {
        html += `<tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${escapeHtml(row.label)}</td>
                    <td class="text-center">${row.value}</td>
                    <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">${row.note}</textarea></td>
                </tr>`;
    });
    html += `</tbody></table>`;

    html += `<div data-app-recommendation="1" class="recommendation-panel">
                <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa ${recommendationTarget}, lựa chọn số N theo mode đã chọn:
                ${recommendationFormula} = <strong>${ketqua}</strong>
            </div>`;

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Bảng phân bổ theo số lượng N</h4>`;
    html += `<table class="sizing-table app-n-table u-mt-8" data-app-n-table="1">
                <thead>
                    <tr>
                        <th class="col-w-120">Giá trị N</th>
                        <th>Cint CPU yêu cầu</th>
                        <th>RAM yêu cầu</th>
                        ${storageAfterKPI.map(item => `<th>${escapeHtml(item.name)} yêu cầu</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr class="diff-row-muted">
                        <td class="text-center">1</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        ${storageAfterKPI.map(item => `<td class="text-center">${item.afterKPI.toFixed(2)}</td>`).join('')}
                    </tr>
                    <tr class="diff-row-success diff-row-strong">
                        <td class="text-center">${ketqua}</td>
                        <td class="text-center">${(cintAfterKPI / ketqua).toFixed(2)}</td>
                        <td class="text-center">${(ramAfterKPI / ketqua).toFixed(2)}</td>
                        ${storageAfterKPI.map(item => `<td class="text-center">${(item.afterKPI / ketqua).toFixed(2)}</td>`).join('')}
                    </tr>
                </tbody>
            </table>`;

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table app-proposal-table u-mt-8" data-app-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-250">Cấu hình</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="diff-row-success">
                        <td>
                            <ul data-app-config-list="1" class="list-compact">
                                <li>CPU: = ${cintPerServer} Cint</li>
                                <li>RAM: = ${ramPerServer} GB</li>
                                ${storagePerServer.map(item => `<li>${escapeHtml(item.name)}: = ${item.perServer} GB</li>`).join('')}
                            </ul>
                        </td>
                        <td class="text-center"><strong>${ketqua + 1}</strong></td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">Dự phòng N+1</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    return html;
}

// Calculate custom sizing recommendations
function calculateCustomSizingRecommendations() {
    const poc = parseFloat(document.getElementById('custom-poc-value')?.value) || 0;
    const sizing = parseFloat(document.getElementById('custom-sizing-value')?.value) || 0;
    if (!poc || !sizing) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".', 'warning');
        return;
    }

    const totalCint = parseFloat(document.getElementById('custom-total-cint-used')?.innerText) || 0;
    const totalRam = parseFloat(document.getElementById('custom-total-ram-used')?.innerText) || 0;
    const storageTotals = getCustomStorageTotalsByPartition();
    if (storageTotals.length === 0) {
        showToast('Vui lòng nhập ít nhất một phân vùng trong "THÔNG TIN LƯU TRỮ ĐẦU VÀO".', 'warning');
        return;
    }

    const factor = sizing / poc;
    const resultContainer = document.getElementById('sizing-result-container');
    const existingProposalState = getCurrentAppProposalState(resultContainer);

    const cintForTPS = totalCint * factor;
    const ramForTPS = totalRam * factor;
    const storageAfterKPI = storageTotals.map(item => ({
        name: item.name,
        totalUsed: item.totalUsed,
        forTPS: item.totalUsed * factor,
        afterKPI: item.totalUsed * factor / 0.8 * 1.1
    }));

    const cintAfterKPI = cintForTPS / 0.75 * 1.1;
    const ramAfterKPI = ramForTPS / 0.9 * 1.1;

    const virtualization = getVirtualizationChoice('custom');
    if (!virtualization.selectedValue) {
        showToast('Vui lòng chọn cấu hình ảo hóa hợp lệ trước khi tính toán.', 'warning');
        return;
    }

    const ketqua = Math.max(1, virtualization.mode === 'vcpu'
        ? Math.ceil(cintAfterKPI / virtualization.vcpu)
        : Math.ceil(ramAfterKPI / virtualization.ram));

    if (!resultContainer) return;

    resultContainer.innerHTML = generateCustomLinearSizingResultHTML({
        poc, sizing,
        totalCint, totalRam,
        factor, cintForTPS, ramForTPS,
        cintAfterKPI, ramAfterKPI,
        virtualization, ketqua, storageAfterKPI
    });

    resultContainer.innerHTML += buildAppCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);
    ensureAppProposalSelectionUI(resultContainer, existingProposalState);
}

function clearCustomSizingResult() {
    const container = document.getElementById('custom-sizing-result-container');
    if (container) container.innerHTML = '';
}

function onCustomMethodChanged(selectEl) {
    const instanceKey = window.__activeInstanceKey || '';
    const cleanKey = instanceKey.includes('__inst_') ? instanceKey.split('__inst_')[0] : instanceKey;

    let method;
    let linearBox, docBox, tbody;

    if (selectEl) {
        method = selectEl.value || 'linearEquivalentApp';
        const wrapper = selectEl.closest('.module-instance-wrapper') || selectEl.closest('body');
        const wrapperInstKey = wrapper.dataset.instanceKey || '';
        linearBox = wrapper.querySelector(`#custom-linear-wrapper__inst_${wrapperInstKey}, #custom-linear-wrapper`);
        docBox = wrapper.querySelector(`#custom-doc-wrapper__inst_${wrapperInstKey}, #custom-doc-wrapper`);
        tbody = wrapper.querySelector(`#custom-proposal-table-body__inst_${wrapperInstKey}, #custom-proposal-table-body`);
    } else if (cleanKey) {
        method = document.getElementById(`custom-method-select__inst_${cleanKey}`)?.value || 'linearEquivalentApp';
        linearBox = document.getElementById(`custom-linear-wrapper__inst_${cleanKey}`);
        docBox = document.getElementById(`custom-doc-wrapper__inst_${cleanKey}`);
        tbody = document.getElementById(`custom-proposal-table-body__inst_${cleanKey}`);
    } else {
        method = document.getElementById('custom-method-select')?.value || 'linearEquivalentApp';
        linearBox = document.getElementById('custom-linear-wrapper');
        docBox = document.getElementById('custom-doc-wrapper');
        tbody = document.getElementById('custom-proposal-table-body');
    }

    if (linearBox) linearBox.style.display = method === 'linearEquivalentApp' ? 'block' : 'none';
    if (docBox) docBox.style.display = method === 'customMethod' ? 'block' : 'none';
    if (method === 'customMethod') {
        if (tbody && tbody.children.length === 0) {
            addCustomProposalRow({});
        }
    }
}

// 3. Delete custom baseline row
function deleteCustomBaselineRow(btn) {
    const baselineRow = btn.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);

    baselineRow.remove();

    // Xóa dòng tương ứng trong input config table
    const inputConfigTbody = document.getElementById('custom-input-config-table-body');
    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        inputConfigTbody.rows[baselineRowIndex].remove();
    }
    updateCustomBaselineRowNumbers();   // Đánh lại số STT
    updateCustomInputConfigRowNumbers();
    updateCustomBaselineTotal(); // Tính lại tổng
    updateCustomInputConfigTotal();
    refreshStorageIpDropdowns('custom');
}

// 4. Helper: Cập nhật lại số thứ tự (1, 2, 3...) khi xóa dòng giữa
function updateCustomBaselineRowNumbers() {
    const rows = document.querySelectorAll('#custom-baseline-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

// 5. Helper: Cập nhật lại số thứ tự cho input config table
function updateCustomInputConfigRowNumbers() {
    const rows = document.querySelectorAll('#custom-input-config-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

// 6. Helper: Tính lại kết quả cho dòng input config tương ứng khi baseline thay đổi
function recalculateCustomInputConfigRow(baselineInput) {
    const baselineRow = baselineInput.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    const inputConfigTbody = document.getElementById('custom-input-config-table-body');

    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        const inputConfigRow = inputConfigTbody.rows[baselineRowIndex];
        // Lấy input bất kỳ từ input config row để tính toán
        const cpuLoadInput = inputConfigRow.querySelector('.cpu-load-input');
        if (cpuLoadInput) {
            calculateCustomInputConfigRow(cpuLoadInput);
        }
    }
}

function formatCustomDoc(command, value = null) {
    const editor = getCustomDocEditor();
    if (!editor) return;
    editor.focus();
    if (command === 'createLink') {
        const url = prompt('Nhập URL');
        if (!url) return;
        document.execCommand(command, false, url);
        return;
    }
    document.execCommand(command, false, value);
}

function collectCustomModuleData() {
    const selectedMethod = document.getElementById('custom-method-select')?.value || 'linearEquivalentApp';
    const editor = getCustomDocEditor();
    const html = stripUnsafeHtml(editor?.innerHTML || '');
    const text = (editor?.innerText || '').trim();
    const resultContainer = document.getElementById('custom-sizing-result-container');
    if (resultContainer) syncTextareasInContainer(resultContainer);
    const linearCustomProposalTable = collectAppCustomProposalTableData(resultContainer);
    const linearSelectedProposalSource = normalizeAppProposalSource(getAppSelectedProposalSource(resultContainer), linearCustomProposalTable);
    const linearEquivalentApp = {
        baselineTable: collectCustomBaselineTableData(),
        inputConfigTable: collectCustomInputConfigTableData(),
        storageInputTable: collectCustomStorageInputTableData(),
        selectedInputRow: document.getElementById('custom-input-row-select')?.value || '',
        selectedInputRowLabel: getSelectedInputRowLabel('custom-input-row-select'),
        pocValue: document.getElementById('custom-poc-value')?.value || '',
        sizingValue: document.getElementById('custom-sizing-value')?.value || '',
        virtualizationMode: document.getElementById('custom-virtualization-mode')?.value || 'ram',
        vcpuFlavor: document.getElementById('custom-vcpu-flavor')?.value || '8',
        ramFlavor: document.getElementById('custom-ram-flavor')?.value || '32',
        flavorEval: '',
        flavorNote: '',
        selectedProposalSource: linearSelectedProposalSource,
        customProposalTable: linearCustomProposalTable,
        sizingResult: resultContainer?.innerHTML || ''
    };
    return {
        selectedMethod,
        linearEquivalentApp,
        customMethodDocHtml: html,
        customMethodDocText: text,
        customProposalTable: collectCustomProposalTableData(),
        editorMeta: { type: 'contenteditable', version: 1 }
    };
}

function createCustomProposalRow(data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input custom-proposal-component" placeholder="Thành phần" value="${escapeHtml(data.component || '')}"></td>
        <td><textarea rows="2" class="input-full sizing-user-input custom-proposal-config" placeholder="Cấu hình đề xuất" oninput="autoResizeCustomProposalTextarea(this)">${escapeHtml(data.configuration || '')}</textarea></td>
        <td><input type="text" class="input-full sizing-user-input custom-proposal-qty" placeholder="Số lượng" value="${escapeHtml(data.quantity || '')}"></td>
        <td><input type="text" class="input-full sizing-user-input custom-proposal-note" placeholder="Ghi chú" value="${escapeHtml(data.note || '')}"></td>
        <td class="admin-cell">
            <select class="admin-eval-select custom-proposal-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note custom-proposal-admin-note" placeholder="Nhận xét...">
        </td>
        <td><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td>
    `;
    return tr;
}

function autoResizeCustomProposalTextarea(textarea) {
    if (!textarea) return;
    if (!isTextBoxMeasurable(textarea)) {
        textarea.dataset.pendingAutoResize = '1';
        return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 56)}px`;
    delete textarea.dataset.pendingAutoResize;
}

function autoResizeAllCustomProposalConfig(container) {
    if (!container) return;
    const selectors = [
        '.custom-proposal-config',
        '.app-custom-proposal-config',
        '.mariadb-custom-proposal-config',
        '.redis-custom-proposal-config',
        '.k8s-custom-proposal-config',
        '.lbfw-custom-proposal-config'
    ];
    selectors.forEach(sel => {
        container.querySelectorAll(sel).forEach(el => {
            el.style.height = 'auto';
            el.style.height = `${Math.max(el.scrollHeight, 56)}px`;
        });
    });
}

function addCustomProposalRow(data = {}) {
    const tbody = document.getElementById('custom-proposal-table-body');
    if (!tbody) return;
    const row = createCustomProposalRow(data);
    tbody.appendChild(row);
    autoResizeCustomProposalTextarea(row.querySelector('.custom-proposal-config'));
    try { applyRolePermissions(); } catch (e) { }
}

function collectCustomProposalTableData() {
    const rows = [];
    document.querySelectorAll('#custom-proposal-table-body tr').forEach(row => {
        rows.push({
            component: row.querySelector('.custom-proposal-component')?.value?.trim() || '',
            configuration: row.querySelector('.custom-proposal-config')?.value?.trim() || '',
            quantity: row.querySelector('.custom-proposal-qty')?.value?.trim() || '',
            note: row.querySelector('.custom-proposal-note')?.value?.trim() || ''
        });
    });
    return rows;
}

function loadCustomProposalTableData(rows) {
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const withId = (baseId) => instanceKey ? `${baseId}__inst_${instanceKey}` : baseId;
    const tbody = document.getElementById(withId('custom-proposal-table-body'));
    if (!tbody) return;
    tbody.innerHTML = '';
    if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach(row => addCustomProposalRow(row));
    } else if (!instanceKey) {
        // Only add default row if NOT inside an instance (inside instance already has snapshot data)
        addCustomProposalRow({});
    }
}

function loadCustomLinearLikeApp(moduleApp) {
    if (!moduleApp) return;
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const withId = (baseId) => instanceKey ? `${baseId}__inst_${instanceKey}` : baseId;
    const baselineBody = document.getElementById(withId('custom-baseline-table-body'));
    const inputBody = document.getElementById(withId('custom-input-config-table-body'));
    const storageBody = document.getElementById(withId('custom-storage-input-table-body'));
    if (baselineBody) baselineBody.innerHTML = '';
    if (inputBody) inputBody.innerHTML = '';
    if (storageBody) storageBody.innerHTML = '';

    if (Array.isArray(moduleApp.baselineTable)) {
        moduleApp.baselineTable.forEach(row => {
            addCustomBaselineRow();
            const lastRow = baselineBody?.lastElementChild;
            if (!lastRow) return;
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
            const imgs = getEvidenceImagesFromRowData(row);
            if (imgs.length > 0) {
                const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                if (evidenceCell) loadInlineEvidence(evidenceCell, imgs);
            }
        });
    }

    if (Array.isArray(moduleApp.inputConfigTable)) {
        moduleApp.inputConfigTable.forEach(row => {
            addCustomInputConfigRow();
            const lastRow = inputBody?.lastElementChild;
            if (!lastRow) return;
            const ipInput = lastRow.querySelector('.ip-config-input');
            const cpuLoadInput = lastRow.querySelector('.cpu-load-input');
            const ramLoadInput = lastRow.querySelector('.ram-load-input');
            const cintUsedInput = lastRow.querySelector('.cint-used-input');
            const ramUsedInput = lastRow.querySelector('.ram-used-input');
            if (ipInput) ipInput.value = row.ip || '';
            if (cpuLoadInput) cpuLoadInput.value = row.cpuLoad || '';
            if (ramLoadInput) ramLoadInput.value = row.ramLoad || '';
            if (cintUsedInput) cintUsedInput.value = row.cintUsed || '';
            if (ramUsedInput) ramUsedInput.value = row.ramUsed || '';
            const imgs = getEvidenceImagesFromRowData(row);
            if (imgs.length > 0) {
                const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                if (evidenceCell) loadInlineEvidence(evidenceCell, imgs);
            }
        });
    }

    if (Array.isArray(moduleApp.storageInputTable)) {
        moduleApp.storageInputTable.forEach(row => {
            addCustomStorageInputRow();
            const lastRow = storageBody?.lastElementChild;
            if (!lastRow) return;
            const ipInput = lastRow.querySelector('.custom-storage-ip-input');
            const partitionInput = lastRow.querySelector('.custom-storage-partition-input');
            const usedInput = lastRow.querySelector('.custom-storage-used-input');
            const noteInput = lastRow.querySelector('.custom-storage-note-input');
            const evalSelect = lastRow.querySelector('.custom-storage-eval');
            const adminNoteInput = lastRow.querySelector('.custom-storage-admin-note');
            setStorageIpSelectValue(ipInput, 'custom', row.ip || '');
            if (partitionInput) partitionInput.value = row.partition || '';
            if (usedInput) usedInput.value = row.used || '';
            const imgs = getEvidenceImagesFromRowData(row);
            if (imgs.length > 0) {
                const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                if (evidenceCell) loadInlineEvidence(evidenceCell, imgs);
            }
            if (noteInput) noteInput.value = row.note || '';
            if (evalSelect) {
                evalSelect.value = row.adminEval || '';
                styleAdminSelect(evalSelect);
            }
            if (adminNoteInput) adminNoteInput.value = row.adminNote || '';
        });
    }

    ensureDefaultCustomLinearRows();
    refreshStorageIpDropdowns('custom');

    updateCustomBaselineTotal();
    updateCustomInputConfigTotal();

    const setValue = (id, val) => { const el = document.getElementById(withId(id)); if (el && val !== undefined) el.value = val; };
    setValue('custom-input-row-select', moduleApp.selectedInputRow || '');
    setValue('custom-poc-value', moduleApp.pocValue || '');
    setValue('custom-sizing-value', moduleApp.sizingValue || '');
    setValue('custom-virtualization-mode', moduleApp.virtualizationMode || 'ram');
    setValue('custom-vcpu-flavor', moduleApp.vcpuFlavor || '8');
    setValue('custom-ram-flavor', moduleApp.ramFlavor || '32');
    if (instanceKey) {
        onVirtualizationModeChange('custom');
    } else {
        onVirtualizationModeChange('custom');
    }
    const result = document.getElementById(withId('custom-sizing-result-container'));
    if (result) {
        result.innerHTML = moduleApp.sizingResult || '';
        ensureAppProposalSelectionUI(result, {
            selectedProposalSource: moduleApp.selectedProposalSource || 'auto',
            customProposalTable: moduleApp.customProposalTable || getEmptyAppCustomProposalTable()
        });
    }
}

function loadCustomModuleData(data) {
    if (!data) return;
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const withId = (baseId) => instanceKey ? `${baseId}__inst_${instanceKey}` : baseId;
    const selectedMethod = data.selectedMethod || 'linearEquivalentApp';
    const select = document.getElementById(withId('custom-method-select'));
    if (select) select.value = selectedMethod;
    loadCustomLinearLikeApp(data.linearEquivalentApp || {});
    const editor = getCustomDocEditor();
    if (editor) editor.innerHTML = stripUnsafeHtml(data.customMethodDocHtml || '');
    loadCustomProposalTableData(data.customProposalTable);
    onCustomMethodChanged();
}

function handleCustomDocPaste(event) {
    if (!event || !event.clipboardData) return;
    const items = event.clipboardData.items || [];
    for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target?.result || '';
                if (!src) return;
                const probe = new Image();
                probe.onload = () => {
                    const naturalWidth = probe.naturalWidth || '';
                    const naturalHeight = probe.naturalHeight || '';
                    document.execCommand(
                        'insertHTML',
                        false,
                        `<img src="${src}" alt="Pasted Image" data-origin-width="${naturalWidth}" data-origin-height="${naturalHeight}" class="pasted-image">`
                    );
                };
                probe.onerror = () => {
                    document.execCommand(
                        'insertHTML',
                        false,
                        `<img src="${src}" alt="Pasted Image" class="pasted-image">`
                    );
                };
                probe.src = src;
            };
            reader.readAsDataURL(file);
            return;
        }
    }
}

// Parse kết quả Module App
function parseAppSizingResult(html) {
    if (!html || html.trim() === '') return null;

    const proposalTableRowsMatch = html.match(/<table[^>]*data-app-proposal-table="1"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/i);
    if (proposalTableRowsMatch) {
        const rowMatches = Array.from(proposalTableRowsMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
        const defaultComponentName = resolveCurrentModuleInstanceDisplayName('App');
        const toText = (raw) => (raw || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/[ \t]+/g, ' ').trim();
        const parsedRows = [];

        rowMatches.forEach(match => {
            const tdMatches = Array.from(match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1]);
            if (tdMatches.length < 4) return;

            const componentText = toText(tdMatches[0]);
            const configHtml = tdMatches[1];
            const quantityText = toText(tdMatches[2]);
            const noteText = toText(tdMatches[3]);
            const listItems = Array.from(configHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => toText(m[1])).filter(Boolean);
            const configLines = listItems.length > 0
                ? listItems
                : toText(configHtml).split(/\r?\n/).map(line => line.trim()).filter(Boolean);

            if (configLines.length === 0) return;

            parsedRows.push({
                component: componentText || defaultComponentName,
                cauHinh: configLines.map(item => `- ${item}`).join('<br>'),
                soLuong: (quantityText.match(/\d+/) || [quantityText])[0] || '',
                ghiChu: noteText
            });
        });

        if (parsedRows.length > 0) {
            const throughputMatch = html.match(/Throughput[^:]*:\s*([\d.]+)\s*Gbps/i);
            const result = {
                rows: parsedRows,
                component: parsedRows[0].component || defaultComponentName,
                cauHinh: parsedRows[0].cauHinh,
                soLuong: parsedRows[0].soLuong,
                ghiChu: parsedRows[0].ghiChu
            };
            if (throughputMatch) {
                result.fwlb = {
                    cauHinh: `Thông lượng < ${throughputMatch[1]} Gbps`
                };
            }
            return result;
        }
    }

    const proposalTableMatch = html.match(/<table[^>]*data-app-proposal-table="1"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/i);
    if (proposalTableMatch) {
        const rowMatch = proposalTableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
        if (rowMatch) {
            const tdMatches = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1]);
            if (tdMatches.length >= 3) {
                const toText = (raw) => (raw || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/[ \t]+/g, ' ').trim();
                const listItems = Array.from(tdMatches[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => toText(m[1])).filter(Boolean);
                const quantityText = toText(tdMatches[1]);
                const noteText = toText(tdMatches[2]);
                const throughputMatch = html.match(/Throughput[^:]*:\s*([\d.]+)\s*Gbps/i);
                if (listItems.length > 0) {
                    const result = {
                        component: resolveCurrentModuleInstanceDisplayName('App'),
                        cauHinh: listItems.map(item => `- ${item}`).join('<br>'),
                        soLuong: (quantityText.match(/\d+/) || [quantityText])[0] || '',
                        ghiChu: noteText
                    };
                    if (throughputMatch) {
                        result.fwlb = {
                            cauHinh: `ThÃ´ng lÆ°á»£ng < ${throughputMatch[1]} Gbps`
                        };
                    }
                    return result;
                }
            }
        }
    }

    // Tìm CPU (Cint format): CPU: = 30 Cint
    const cpuCintMatch = html.match(/CPU[:\s]*=?\s*(\d+)\s*Cint/i);
    // Tìm vCPU format: <strong>32 vCPU</strong>
    const vcpuMatch = html.match(/<strong>(\d+)\s*vCPU<\/strong>/i);

    // Tìm RAM: RAM: = 30 GB hoặc <strong>64 GB RAM</strong>
    const ramMatch = html.match(/RAM[:\s]*=?\s*(\d+)\s*GB/i) || html.match(/<strong>(\d+)\s*GB\s*RAM<\/strong>/i);

    // Tìm DISK: DISK: = 100 GB hoặc <strong>200 GB DISK</strong>
    const diskMatch = html.match(/DISK[:\s]*=?\s*(\d+)\s*GB/i) || html.match(/<strong>(\d+)\s*GB\s*DISK<\/strong>/i);

    // Tìm /os và /u01 từ text format
    const diskOsMatch = html.match(/\/os[:\s]*(\d+)\s*GB/i);
    const diskU01Match = html.match(/\/u01[:\s]*(\d+)\s*GB/i);

    // Tìm số lượng: <td class="text-center"><strong>7</strong></td>
    const soLuongMatch = html.match(/<td[^>]*class="text-center"[^>]*><strong>(\d+)<\/strong><\/td>/i);

    // Tìm ghi chú từ textarea: Dự phòng N+1
    const ghiChuMatch = html.match(/Dự phòng\s*(N\+\d+)/i) || html.match(/N\s*\+\s*1/i);

    // Tìm throughput cho FW/LB
    const throughputMatch = html.match(/Throughput[^:]*:\s*([\d.]+)\s*Gbps/i);

    // Kiểm tra xem có dữ liệu không
    if (!cpuCintMatch && !vcpuMatch && !ramMatch) return null;

    let cauHinh = '';
    if (vcpuMatch) {
        cauHinh += `- vCPU = ${vcpuMatch[1]}\n`;
    } else if (cpuCintMatch) {
        cauHinh += `- CPU = ${cpuCintMatch[1]} Cint\n`;
    }

    if (ramMatch) cauHinh += `- RAM = ${ramMatch[1]}GB\n`;

    if (diskOsMatch || diskU01Match) {
        cauHinh += `- Disk:\n`;
        if (diskOsMatch) cauHinh += `  + /os: ${diskOsMatch[1]}GB\n`;
        if (diskU01Match) cauHinh += `  + /u01: ${diskU01Match[1]} GB`;
    } else if (diskMatch) {
        cauHinh += `- Disk = ${diskMatch[1]}GB`;
    }

    const result = {
        component: resolveCurrentModuleInstanceDisplayName('App'),
        cauHinh: cauHinh.replace(/\n/g, '<br>'),
        soLuong: soLuongMatch ? soLuongMatch[1] : '',
        ghiChu: ghiChuMatch ? `Dự phòng ${ghiChuMatch[1] || 'N+1'}` : ''
    };

    // FW/LB info
    if (throughputMatch) {
        result.fwlb = {
            cauHinh: `Thông lượng < ${throughputMatch[1]} Gbps`
        };
    }

    return result;
}

// Parse kết quả Module MariaDB
function parseMariaDBSizingResult(html) {
    if (!html || html.trim() === '') return null;

    const getResultRowByLabel = (label) => {
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        const labelRegex = new RegExp(`<td[^>]*>\\s*<strong>${escapedLabel}<\\/strong>\\s*<\\/td>`, 'i');
        return rowMatches.find(row => labelRegex.test(row)) || '';
    };

    const extractQuantity = (rowHtml) => {
        if (!rowHtml) return '';
        const qtyMatch = rowHtml.match(/<td[^>]*class="text-center"[^>]*>\s*<strong>([^<]+)<\/strong>\s*<\/td>/i);
        return qtyMatch ? qtyMatch[1].trim() : '';
    };

    const extractListContent = (rowHtml) => {
        if (!rowHtml) return '';
        const listMatch = rowHtml.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
        return listMatch ? listMatch[1] : '';
    };

    const mariaRow = getResultRowByLabel('MariaDB');
    const maxScaleRow = getResultRowByLabel('MaxScale');
    const nasRow = getResultRowByLabel('NAS');

    const mariaList = extractListContent(mariaRow);
    const vcpuMatch = mariaList.match(/<strong>(\d+)\s*vCPU<\/strong>/i) || html.match(/<strong>(\d+)\s*vCPU<\/strong>/i);
    const ramMatch = mariaList.match(/<strong>(\d+)\s*GB\s*RAM<\/strong>/i) || html.match(/<strong>(\d+)\s*GB\s*RAM<\/strong>/i);
    const dataMatch = mariaList.match(/\/data[:\s]*(\d+)\s*GB/i) || html.match(/\/data[:\s]*(\d+)\s*GB/i);
    const logMatch = mariaList.match(/\/log[:\s]*(\d+)\s*GB/i) || html.match(/\/log[:\s]*(\d+)\s*GB/i);

    if (!vcpuMatch && !ramMatch && !dataMatch && !logMatch) return null;

    let cauHinh = '';
    if (vcpuMatch) cauHinh += `- vCPU = ${vcpuMatch[1]}\n`;
    if (ramMatch) cauHinh += `- RAM = ${ramMatch[1]}GB\n`;
    if (dataMatch || logMatch) {
        cauHinh += '- Disk:\n';
        if (dataMatch) cauHinh += `  + /data: ${dataMatch[1]}GB\n`;
        if (logMatch) cauHinh += `  + /log: ${logMatch[1]}GB`;
    }

    const mariaCells = mariaRow.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    const quantityCell = mariaCells[2] || '';
    const noteCell = mariaCells[3] || '';
    const mariaQuantity = (quantityCell.match(/<strong>([^<]+)<\/strong>/i)?.[1] || '').trim();
    const mariaNoteText = noteCell
        ? noteCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : '';

    const result = {
        cauHinh: cauHinh.trim().replace(/\n/g, '<br>'),
        soLuong: mariaQuantity || extractQuantity(mariaRow) || '3',
        ghiChu: mariaNoteText
    };

    const maxScaleList = extractListContent(maxScaleRow);
    if (maxScaleList) {
        const msVcpu = maxScaleList.match(/(\d+)\s*vCPU/i);
        const msRam = maxScaleList.match(/(\d+)\s*GB\s*RAM/i);
        const msDisk = maxScaleList.match(/\/u01[:\s]*(\d+)\s*GB/i);
        let msCauHinh = '';
        if (msVcpu) msCauHinh += `- vCPU = ${msVcpu[1]}\n`;
        if (msRam) msCauHinh += `- RAM = ${msRam[1]}GB\n`;
        if (msDisk) msCauHinh += `- /u01: ${msDisk[1]}GB`;
        result.maxScale = {
            cauHinh: msCauHinh.trim().replace(/\n/g, '<br>'),
            soLuong: extractQuantity(maxScaleRow) || '2',
            ghiChu: 'Cấu hình tối thiểu + 1 VIP'
        };
    }

    const nasMatch = nasRow.match(/<strong>(\d+)\s*GB<\/strong>/i);
    if (nasMatch) {
        result.nas = {
            cauHinh: `${nasMatch[1]} GB`,
            soLuong: '-',
            ghiChu: 'Mount chung (/backup cần)'
        };
    }

    return result;
}

function getDefaultMariaDBCustomProposalTable() {
    return [
        {
            component: 'MaxScale',
            configurationText: '4 vCPU\n8 GB RAM\n/u01: 100 GB',
            quantity: '2',
            note: 'Cấu hình tối thiểu +1 VIP'
        },
        { component: 'MariaDB', configurationText: '', quantity: '', note: '' },
        { component: 'NAS', configurationText: '', quantity: '', note: '' }
    ];
}

function normalizeMariaDBCustomProposalTable(rows) {
    const defaults = getDefaultMariaDBCustomProposalTable();
    if (!Array.isArray(rows)) return defaults;

    const rowMap = new Map();
    rows.forEach(row => {
        const component = String(row?.component || '').trim();
        if (component) {
            rowMap.set(component.toLowerCase(), {
                component,
                configurationText: String(row?.configurationText || ''),
                quantity: String(row?.quantity || ''),
                note: String(row?.note || '')
            });
        }
    });

    return defaults.map(defaultRow => {
        const current = rowMap.get(defaultRow.component.toLowerCase()) || {};
        const isLocked = defaultRow.component === 'MaxScale';
        return {
            component: defaultRow.component,
            configurationText: isLocked
                ? String(defaultRow.configurationText || '')
                : String(current.configurationText || ''),
            quantity: isLocked
                ? String(defaultRow.quantity || '')
                : String(current.quantity || ''),
            note: isLocked
                ? String(defaultRow.note || '')
                : String(current.note || '')
        };
    });
}

function isMariaDBCustomProposalTableFilled(customProposalTable) {
    return normalizeMariaDBCustomProposalTable(customProposalTable)
        .some(row => row.component === 'MariaDB' && row.configurationText.trim());
}

function normalizeMariaDBProposalSource(source, customProposalTable) {
    return source === 'custom' && isMariaDBCustomProposalTableFilled(customProposalTable) ? 'custom' : 'auto';
}

function collectMariaDBCustomProposalTableData(container) {
    if (!container) return getDefaultMariaDBCustomProposalTable();
    const rows = [];
    container.querySelectorAll('.mariadb-custom-proposal-row').forEach(row => {
        rows.push({
            component: row.dataset.component || '',
            configurationText: row.querySelector('.mariadb-custom-proposal-config')?.value || '',
            quantity: row.querySelector('.mariadb-custom-proposal-qty')?.value || '',
            note: row.querySelector('.mariadb-custom-proposal-note')?.value || ''
        });
    });
    return normalizeMariaDBCustomProposalTable(rows);
}

function getMariaDBSelectedProposalSource(container) {
    const value = container?.querySelector('.mariadb-proposal-source-select')?.value || 'auto';
    return value === 'custom' ? 'custom' : 'auto';
}

function getCurrentMariaDBProposalState(container) {
    return {
        selectedProposalSource: getMariaDBSelectedProposalSource(container),
        customProposalTable: collectMariaDBCustomProposalTableData(container)
    };
}

function updateMariaDBProposalSourceUI(container, selectedSource = 'auto') {
    if (!container) return;

    const normalizedSource = selectedSource === 'custom' ? 'custom' : 'auto';
    const effectiveSource = normalizeMariaDBProposalSource(normalizedSource, collectMariaDBCustomProposalTableData(container));
    const select = container.querySelector('.mariadb-proposal-source-select');
    const toolHeading = container.querySelector('.mariadb-tool-proposal-heading');
    const customHeading = container.querySelector('.mariadb-custom-proposal-heading');
    const customSection = container.querySelector('.mariadb-custom-proposal-section');
    const autoTable = container.querySelector('[data-mariadb-proposal-table="1"]');
    const customTable = container.querySelector('[data-mariadb-custom-proposal-table="1"]');

    if (select) select.value = normalizedSource;
    if (toolHeading) toolHeading.textContent = effectiveSource === 'auto'
        ? 'Đề xuất cấu hình do tool tạo (đang dùng)'
        : 'Đề xuất cấu hình do tool tạo';
    if (customHeading) customHeading.textContent = effectiveSource === 'custom'
        ? 'Đề xuất cấu hình tùy chỉnh (đang dùng)'
        : 'Đề xuất cấu hình tùy chỉnh';

    if (customSection) {
        customSection.classList.toggle('is-hidden', normalizedSource !== 'custom');
    }

    if (autoTable) {
        autoTable.style.outline = effectiveSource === 'auto' ? '2px solid #38b2ac' : 'none';
        autoTable.style.outlineOffset = effectiveSource === 'auto' ? '2px' : '0';
    }
    if (customTable) {
        customTable.style.outline = effectiveSource === 'custom' ? '2px solid #38b2ac' : 'none';
        customTable.style.outlineOffset = effectiveSource === 'custom' ? '2px' : '0';
    }
}

function handleMariaDBProposalSourceChange(selectEl) {
    const container = selectEl?.closest('#mariadb-result-container');
    if (!container) return;

    const selectedSource = selectEl.value === 'custom' ? 'custom' : 'auto';

    updateMariaDBProposalSourceUI(container, selectedSource);
    markSummaryNeedsSizingRefresh();
}

function buildMariaDBCustomProposalSectionHtml(selectedProposalSource, customProposalTable) {
    const normalizedRows = normalizeMariaDBCustomProposalTable(customProposalTable);
    const normalizedSource = selectedProposalSource === 'custom' ? 'custom' : 'auto';

    return `
        <div class="mariadb-proposal-source-panel proposal-source-panel">
            <label class="panel-label-compact">Bạn có muốn chỉnh sửa cấu hình không?</label>
            <select class="input-full mariadb-proposal-source-select" onchange="handleMariaDBProposalSourceChange(this)">
                <option value="auto" ${normalizedSource === 'auto' ? 'selected' : ''}>Không</option>
                <option value="custom" ${normalizedSource === 'custom' ? 'selected' : ''}>Có</option>
            </select>
        </div>
        <div class="mariadb-custom-proposal-section ${normalizedSource === 'custom' ? '' : 'is-hidden'}">
            <h4 class="mariadb-custom-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình tùy chỉnh</h4>
            <table class="sizing-table mariadb-custom-proposal-table u-mt-8" data-mariadb-custom-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-120">Thành phần</th>
                        <th class="col-w-250">Cấu hình đề xuất</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${normalizedRows.map(row => {
                        const isLocked = row.component === 'MaxScale';
                        const readOnlyAttr = isLocked ? 'readonly' : '';
                        const lockedClass = isLocked ? 'proposal-locked-control' : '';
                        return `
                        <tr class="mariadb-custom-proposal-row" data-component="${escapeHtml(row.component)}">
                            <td><strong>${escapeHtml(row.component)}</strong></td>
                            <td><textarea class="input-full mariadb-custom-proposal-config u-resize-none u-overflow-hidden ${lockedClass}" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình" ${readOnlyAttr}>${escapeHtml(row.configurationText)}</textarea></td>
                            <td class="text-center"><input type="text" class="input-full text-center mariadb-custom-proposal-qty ${lockedClass}" value="${escapeHtml(row.quantity)}" placeholder="Số lượng" ${readOnlyAttr}></td>
                            <td><textarea class="input-full mariadb-custom-proposal-note textarea-min-lg u-resize-y ${lockedClass}" rows="2" placeholder="Ghi chú" ${readOnlyAttr}>${escapeHtml(row.note)}</textarea></td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

function ensureMariaDBProposalSelectionUI(container, options = {}) {
    if (!container) return;

    const autoTable = container.querySelector('[data-mariadb-proposal-table="1"]');
    if (!autoTable) return;

    const toolHeading = autoTable.previousElementSibling;
    if (toolHeading && toolHeading.tagName === 'H4') {
        toolHeading.classList.add('mariadb-tool-proposal-heading');
    }

    if (!container.querySelector('[data-mariadb-custom-proposal-table="1"]')) {
        autoTable.insertAdjacentHTML(
            'afterend',
            buildMariaDBCustomProposalSectionHtml(
                options.selectedProposalSource || 'auto',
                options.customProposalTable || getDefaultMariaDBCustomProposalTable()
            )
        );
    }

    const normalizedRows = normalizeMariaDBCustomProposalTable(options.customProposalTable || collectMariaDBCustomProposalTableData(container));
    container.querySelectorAll('.mariadb-custom-proposal-row').forEach(row => {
        const component = row.dataset.component || '';
        const rowData = normalizedRows.find(item => item.component === component) || { configurationText: '', quantity: '', note: '' };
        const configInput = row.querySelector('.mariadb-custom-proposal-config');
        const qtyInput = row.querySelector('.mariadb-custom-proposal-qty');
        const noteInput = row.querySelector('.mariadb-custom-proposal-note');
        if (configInput) configInput.value = rowData.configurationText;
        if (qtyInput) qtyInput.value = rowData.quantity;
        if (noteInput) noteInput.value = rowData.note;
    });

    try { autoResizeAllCustomProposalConfig(container); } catch (e) { }

    updateMariaDBProposalSourceUI(container, options.selectedProposalSource || 'auto');
}

function buildEffectiveMariaDBCustomProposalData(customProposalTable) {
    const normalizedRows = normalizeMariaDBCustomProposalTable(customProposalTable);
    const toConfigHtml = (text) => text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `- ${escapeHtml(line)}`)
        .join('<br>');
    const getRow = (component) => normalizedRows.find(row => row.component === component) || null;
    const mariaRow = getRow('MariaDB');

    if (!mariaRow || !mariaRow.configurationText.trim()) return null;

    const result = {
        cauHinh: toConfigHtml(mariaRow.configurationText),
        soLuong: mariaRow.quantity.trim(),
        ghiChu: mariaRow.note.trim()
    };

    const maxScaleRow = getRow('MaxScale');
    if (maxScaleRow && maxScaleRow.configurationText.trim()) {
        result.maxScale = {
            cauHinh: toConfigHtml(maxScaleRow.configurationText),
            soLuong: maxScaleRow.quantity.trim(),
            ghiChu: maxScaleRow.note.trim()
        };
    }

    const nasRow = getRow('NAS');
    if (nasRow && nasRow.configurationText.trim()) {
        result.nas = {
            cauHinh: toConfigHtml(nasRow.configurationText),
            soLuong: nasRow.quantity.trim(),
            ghiChu: nasRow.note.trim()
        };
    }

    return result;
}

function resolveEffectiveMariaDBProposalResult(mariaState = {}) {
    const resultHTML = mariaState.resultHTML || '';
    const autoParsed = parseMariaDBSizingResult(resultHTML);
    const customProposalTable = normalizeMariaDBCustomProposalTable(mariaState.customProposalTable);
    const selectedProposalSource = normalizeMariaDBProposalSource(mariaState.selectedProposalSource || 'auto', customProposalTable);

    if (selectedProposalSource === 'custom') {
        const customParsed = buildEffectiveMariaDBCustomProposalData(customProposalTable);
        if (customParsed) {
            return customParsed;
        }
    }

    return autoParsed;
}

// Parse kết quả Module Redis
function parseRedisSizingResult(html) {
    if (!html || html.trim() === '') return null;

    const proposalTableMatch = html.match(/<table[^>]*data-redis-proposal-table="1"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/i);
    if (proposalTableMatch) {
        const rowMatch = proposalTableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
        if (rowMatch) {
            const tdMatches = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1]);
            if (tdMatches.length >= 4) {
                const toText = (raw) => (raw || '')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+\n/g, '\n')
                    .replace(/\n\s+/g, '\n')
                    .replace(/[ \t]+/g, ' ')
                    .trim();
                const componentText = toText(tdMatches[0]);
                const configHtml = tdMatches[1];
                const quantityText = toText(tdMatches[2]);
                const noteText = toText(tdMatches[3]);
                const listItems = Array.from(configHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
                    .map(m => toText(m[1]))
                    .filter(Boolean);

                if (listItems.length > 0) {
                    return {
                        cauHinh: listItems.map(item => `- ${item}`).join('<br>'),
                        soLuong: (quantityText.match(/\d+/) || [quantityText])[0] || '',
                        ghiChu: noteText
                    };
                }
            }
        }
    }

    const vcpuMatch = html.match(/<strong>(\d+)\s*vCPU<\/strong>/i);
    const ramMatch = html.match(/<strong>(\d+)\s*GB\s*RAM<\/strong>/i);
    const diskMatch = html.match(/<strong>(\d+)\s*GB\s*DISK<\/strong>/i);
    const soLuongMatch = html.match(/<td[^>]*class="text-center"[^>]*><strong>(\d+)<\/strong><\/td>/i);
    const modelMatch = html.match(/Redis\s*(Sentinel|Cluster)/i);
    const masterSlaveMatch = html.match(/(\d+)\s*master\s*.*?(\d+)\s*slave/i);

    if (!vcpuMatch && !ramMatch) return null;

    let cauHinh = '';
    if (vcpuMatch) cauHinh += `- vCPU = ${vcpuMatch[1]}\n`;
    if (ramMatch) cauHinh += `- RAM = ${ramMatch[1]}GB\n`;
    if (diskMatch) cauHinh += `- Disk = ${diskMatch[1]}GB`;

    let ghiChu = modelMatch ? `Redis ${modelMatch[1]}` : '';
    if (masterSlaveMatch) ghiChu += ` (${masterSlaveMatch[1]} master ${masterSlaveMatch[2]} slave)`;

    return {
        cauHinh: cauHinh.replace(/\n/g, '<br>'),
        soLuong: soLuongMatch ? soLuongMatch[1] : '',
        ghiChu: ghiChu
    };
}

function getEmptyRedisCustomProposalTable() {
    return {
        component: '',
        configurationText: '',
        quantity: '',
        note: ''
    };
}

function normalizeRedisCustomProposalTable(data) {
    const empty = getEmptyRedisCustomProposalTable();
    if (!data || typeof data !== 'object') return empty;
    return {
        component: String(data.component || ''),
        configurationText: String(data.configurationText || ''),
        quantity: String(data.quantity || ''),
        note: String(data.note || '')
    };
}

// Normalize array of rows or single object to always return array
function normalizeRedisCustomProposalTableList(data) {
    if (!data) return [];

    // If it's already an array, normalize each item
    if (Array.isArray(data)) {
        return data.map(item => normalizeRedisCustomProposalTable(item));
    }

    // If it's a single object, wrap in array
    return [normalizeRedisCustomProposalTable(data)];
}

function isRedisCustomProposalTableFilled(customProposalTable) {
    const list = normalizeRedisCustomProposalTableList(customProposalTable);
    return list.some(row => row.configurationText.trim() !== '');
}

function normalizeRedisProposalSource(source, customProposalTable) {
    return source === 'custom' && isRedisCustomProposalTableFilled(customProposalTable) ? 'custom' : 'auto';
}

function resolveRedisProposalContainer(source = null) {
    const containerSelector = '[id="redis-key-result-container"], [id^="redis-key-result-container__inst_"], [id="redis-config-result-container"], [id^="redis-config-result-container__inst_"]';
    if (source && typeof source === 'object') {
        if (typeof source.matches === 'function' && source.matches(containerSelector)) {
            return source;
        }
        if (typeof source.closest === 'function') {
            const closestContainer = source.closest(containerSelector);
            if (closestContainer) return closestContainer;
        }
        if (typeof source.querySelector === 'function' && source.querySelector('[data-redis-proposal-table="1"], [data-redis-custom-proposal-table="1"]')) {
            return source;
        }
    }

    return document.querySelector('#redis-key-result-container, #redis-config-result-container');
}

function collectRedisCustomProposalTableData(container) {
    container = resolveRedisProposalContainer(container);
    if (!container) return getEmptyRedisCustomProposalTable();

    const tbody = container.querySelector('.redis-custom-proposal-tbody');
    if (!tbody) return getEmptyRedisCustomProposalTable();

    const rows = [];
    tbody.querySelectorAll('tr').forEach(row => {
        const component = row.querySelector('.redis-custom-proposal-component')?.value || '';
        const config = row.querySelector('.redis-custom-proposal-config')?.value || '';
        const qty = row.querySelector('.redis-custom-proposal-qty')?.value || '';
        const note = row.querySelector('.redis-custom-proposal-note')?.value || '';

        // Only include rows that have some content
        if (component.trim() || config.trim() || qty.trim() || note.trim()) {
            rows.push({
                component: component,
                configurationText: config,
                quantity: qty,
                note: note
            });
        }
    });

    // Return first row if only one row, otherwise return array
    if (rows.length === 0) return getEmptyRedisCustomProposalTable();
    if (rows.length === 1) return normalizeRedisCustomProposalTable(rows[0]);
    return rows;
}

function getRedisSelectedProposalSource(container) {
    container = resolveRedisProposalContainer(container);
    const value = container?.querySelector('.redis-proposal-source-select')?.value || 'auto';
    return value === 'custom' ? 'custom' : 'auto';
}

function getCurrentRedisProposalState(container) {
    container = resolveRedisProposalContainer(container);
    return {
        selectedProposalSource: getRedisSelectedProposalSource(container),
        customProposalTable: collectRedisCustomProposalTableData(container)
    };
}

function updateRedisProposalSourceUI(container, selectedSource = 'auto') {
    container = resolveRedisProposalContainer(container);
    if (!container) return;

    const normalizedSource = selectedSource === 'custom' ? 'custom' : 'auto';
    const effectiveSource = normalizeRedisProposalSource(normalizedSource, collectRedisCustomProposalTableData(container));
    const select = container.querySelector('.redis-proposal-source-select');
    const toolHeading = container.querySelector('.redis-tool-proposal-heading');
    const customHeading = container.querySelector('.redis-custom-proposal-heading');
    const customSection = container.querySelector('.redis-custom-proposal-section');
    const autoTable = container.querySelector('[data-redis-proposal-table="1"]');
    const customTable = container.querySelector('[data-redis-custom-proposal-table="1"]');

    if (select) select.value = normalizedSource;
    if (toolHeading) toolHeading.textContent = effectiveSource === 'auto'
        ? 'Đề xuất cấu hình do tool tạo (đang dùng)'
        : 'Đề xuất cấu hình do tool tạo';
    if (customHeading) customHeading.textContent = effectiveSource === 'custom'
        ? 'Đề xuất cấu hình tùy chỉnh (đang dùng)'
        : 'Đề xuất cấu hình tùy chỉnh';
    if (customSection) {
        customSection.classList.toggle('is-hidden', normalizedSource !== 'custom');
    }

    if (autoTable) {
        autoTable.style.outline = effectiveSource === 'auto' ? '2px solid #38b2ac' : 'none';
        autoTable.style.outlineOffset = effectiveSource === 'auto' ? '2px' : '0';
    }
    if (customTable) {
        customTable.style.outline = effectiveSource === 'custom' ? '2px solid #38b2ac' : 'none';
        customTable.style.outlineOffset = effectiveSource === 'custom' ? '2px' : '0';
    }
}

function handleRedisProposalSourceChange(selectEl) {
    const container = resolveRedisProposalContainer(selectEl);
    if (!container) return;

    const selectedSource = selectEl.value === 'custom' ? 'custom' : 'auto';

    updateRedisProposalSourceUI(container, selectedSource);
    markSummaryNeedsSizingRefresh();
}

function buildRedisCustomProposalSectionHtml(selectedProposalSource, customProposalTable) {
    const normalizedTable = normalizeRedisCustomProposalTable(customProposalTable);
    const normalizedSource = selectedProposalSource === 'custom' ? 'custom' : 'auto';
    const sourceChangeHandler = buildInstanceAwareHandler('handleRedisProposalSourceChange(this)');
    const addRowHandler = buildInstanceAwareHandler('addRedisProposalRow(this)');
    const deleteRowHandler = buildInstanceAwareHandler('removeRow(this)');

    // Support multiple rows if data is array
    let rows = [];
    if (Array.isArray(normalizedTable)) {
        rows = normalizedTable.map(row => normalizeRedisCustomProposalTable(row));
    } else {
        rows = [normalizedTable];
    }

    const buildRows = () => rows.map(row => `
        <tr>
            <td><input type="text" class="input-full redis-custom-proposal-component sizing-user-input" value="${escapeHtml(row.component)}" placeholder="Redis"></td>
            <td><textarea class="input-full redis-custom-proposal-config sizing-user-input u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình, ví dụ:&#10;16 vCPU&#10;64 GB RAM&#10;256 GB DISK">${escapeHtml(row.configurationText)}</textarea></td>
            <td class="text-center"><input type="text" class="input-full text-center redis-custom-proposal-qty sizing-user-input" value="${escapeHtml(row.quantity)}" placeholder="Số lượng"></td>
            <td><textarea class="input-full redis-custom-proposal-note sizing-user-input u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(row.note)}</textarea></td>
            <td class="text-center">
                <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                    <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                </button>
            </td>
        </tr>
    `).join('');

    return `
        <div class="redis-proposal-source-panel proposal-source-panel">
            <label class="panel-label-compact">Bạn có muốn chỉnh sửa cấu hình không?</label>
            <select class="input-full redis-proposal-source-select" onchange="${sourceChangeHandler}">
                <option value="auto" ${normalizedSource === 'auto' ? 'selected' : ''}>Không</option>
                <option value="custom" ${normalizedSource === 'custom' ? 'selected' : ''}>Có</option>
            </select>
        </div>
        <div class="redis-custom-proposal-section ${normalizedSource === 'custom' ? '' : 'is-hidden'}">
            <h4 class="redis-custom-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình tùy chỉnh</h4>
            <table class="sizing-table redis-custom-proposal-table u-mt-8" data-redis-custom-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-150">Thành phần</th>
                        <th class="col-w-200">Cấu hình đề xuất</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                        <th class="col-w-50"><i class="fa-solid fa-trash-can"></i></th>
                    </tr>
                </thead>
                <tbody class="redis-custom-proposal-tbody">
                    ${buildRows()}
                </tbody>
            </table>
            <button type="button" class="ui-btn ui-btn-outline btn-add sizing-user-btn u-mt-10" onclick="${addRowHandler}">
                <i class="fa-solid fa-plus"></i> Thêm thành phần
            </button>
        </div>`;
}

function ensureRedisProposalSelectionUI(container, options = {}) {
    if (!container) return;

    const autoTable = container.querySelector('[data-redis-proposal-table="1"]');
    if (!autoTable) return;

    const toolHeading = autoTable.previousElementSibling;
    if (toolHeading && toolHeading.tagName === 'H4') {
        toolHeading.classList.add('redis-tool-proposal-heading');
    }

    if (!container.querySelector('[data-redis-custom-proposal-table="1"]')) {
        autoTable.insertAdjacentHTML(
            'afterend',
            buildRedisCustomProposalSectionHtml(
                options.selectedProposalSource || 'auto',
                options.customProposalTable || getEmptyRedisCustomProposalTable()
            )
        );
    }

    // Ensure at least one row exists
    const tbody = container.querySelector('.redis-custom-proposal-tbody');
    if (tbody && tbody.children.length === 0) {
        addRedisProposalRow(container);
    }

    // Load data into rows
    const tableData = options.customProposalTable || collectRedisCustomProposalTableData(container);
    const dataList = normalizeRedisCustomProposalTableList(tableData);

    // Clear existing rows and rebuild
    if (tbody) {
        tbody.innerHTML = '';
        dataList.forEach(rowData => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" class="input-full redis-custom-proposal-component sizing-user-input" value="${escapeHtml(rowData.component)}" placeholder="Redis"></td>
                <td><textarea class="input-full redis-custom-proposal-config sizing-user-input u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình, ví dụ:&#10;16 vCPU&#10;64 GB RAM&#10;256 GB DISK">${escapeHtml(rowData.configurationText)}</textarea></td>
                <td class="text-center"><input type="text" class="input-full text-center redis-custom-proposal-qty sizing-user-input" value="${escapeHtml(rowData.quantity)}" placeholder="Số lượng"></td>
                <td><textarea class="input-full redis-custom-proposal-note sizing-user-input u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(rowData.note)}</textarea></td>
                <td class="text-center">
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                        <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Apply permissions to new rows
    try { applyRolePermissions(); } catch (e) { }

    // Update source selection UI
    updateRedisProposalSourceUI(container, options.selectedProposalSource || 'auto');

    try { autoResizeAllCustomProposalConfig(container); } catch (e) { }
}

function buildEffectiveRedisCustomProposalData(customProposalTable) {
    const dataList = normalizeRedisCustomProposalTableList(customProposalTable);
    if (dataList.length === 0) return null;

    const resultRows = [];
    dataList.forEach(row => {
        const lines = row.configurationText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        if (lines.length === 0) return;

        resultRows.push({
            component: row.component.trim() || 'Redis',
            cauHinh: lines.map(line => `- ${escapeHtml(line)}`).join('<br>'),
            soLuong: row.quantity.trim(),
            ghiChu: row.note.trim()
        });
    });

    if (resultRows.length === 0) return null;
    if (resultRows.length === 1) return resultRows[0];

    return {
        rows: resultRows,
        component: resultRows[0].component,
        cauHinh: resultRows.map(row => row.cauHinh).join('<br>'),
        soLuong: resultRows[resultRows.length - 1].soLuong,
        ghiChu: resultRows[resultRows.length - 1].ghiChu
    };
}

function resolveEffectiveRedisProposalResult(methodState = {}) {
    const resultHTML = methodState.resultHTML || '';
    const autoParsed = parseRedisSizingResult(resultHTML);
    const customProposalTable = normalizeRedisCustomProposalTableList(methodState.customProposalTable);
    const selectedProposalSource = normalizeRedisProposalSource(methodState.selectedProposalSource || 'auto', customProposalTable);

    if (selectedProposalSource === 'custom') {
        const customParsed = buildEffectiveRedisCustomProposalData(customProposalTable);
        if (customParsed) {
            return customParsed;
        }
    }

    return autoParsed;
}

// Parse kết quả Module Kafka
function parseKafkaSizingResult(html) {
    if (!html || html.trim() === '') return null;

    // Kafka Broker row: Số lượng Node | vCPU/Node | RAM/Node | Disk/Node
    // Format: <td><strong>Kafka Broker</strong></td> <td>...</td> ...

    let vcpu = '', ram = '', disk = '', soLuong = '';

    // Tìm dòng Kafka Broker: <tr>...<td><strong>Kafka Broker</strong></td>...<td>...</td>...<td>...</td>...<td>...</td></tr>
    const brokerRowMatch = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*><strong>Kafka\s*Broker<\/strong><\/td>([\s\S]*?)<\/tr>/i);

    if (brokerRowMatch) {
        const brokerRowContent = brokerRowMatch[1];
        // Trích xuất 4 thẻ <td> tiếp theo (Số lượng, vCPU, RAM, Disk)
        const tdMatches = brokerRowContent.match(/<td[^>]*class="text-center"[^>]*><strong>([^<]+)<\/strong><\/td>/gi);
        if (tdMatches && tdMatches.length >= 4) {
            const numMatch = tdMatches[0].match(/<strong>([\d]+)<\/strong>/);
            const vcpuMatch = tdMatches[1].match(/<strong>([\d]+)<\/strong>/);
            const ramMatch = tdMatches[2].match(/<strong>([\d.]+)\s*GB<\/strong>/i);
            const diskMatch = tdMatches[3].match(/<strong>([\d.]+)\s*(GB|TB)<\/strong>/i);

            if (numMatch) soLuong = numMatch[1];
            if (vcpuMatch) vcpu = vcpuMatch[1];
            if (ramMatch) ram = ramMatch[1];
            if (diskMatch) disk = diskMatch[1] + ' ' + diskMatch[2];
        }
    }

    // Kiểm tra xem có dữ liệu Kafka Broker không
    if (!vcpu && !ram) return null;

    let cauHinh = '';
    if (vcpu) cauHinh += `- vCPU = ${vcpu}\n`;
    if (ram) cauHinh += `- RAM = ${ram}GB\n`;
    if (disk) cauHinh += `- Disk = ${disk}`;

    // Parse Zookeeper/KRaft data
    let zookeeper = null;
    // Tìm dòng Zookeeper/KRaft: <tr>...<td><strong>Zookeeper/KRaft</strong></td>...<td>...</td>...<td>...</td>...<td>...</td></tr>
    const zkRowMatch = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*><strong>Zookeeper\/KRaft<\/strong><\/td>([\s\S]*?)<\/tr>/i);
    if (zkRowMatch) {
        const zkRowContent = zkRowMatch[1];
        // Trích xuất 4 thẻ <td> tiếp theo (Số lượng, vCPU, RAM, Disk)
        const zkTdMatches = zkRowContent.match(/<td[^>]*class="text-center"[^>]*><strong>([^<]+)<\/strong><\/td>/gi);
        if (zkTdMatches && zkTdMatches.length >= 4) {
            const zkNumMatch = zkTdMatches[0].match(/<strong>([\d]+)<\/strong>/);
            const zkVcpuMatch = zkTdMatches[1].match(/<strong>([\d]+)<\/strong>/);
            const zkRamMatch = zkTdMatches[2].match(/<strong>([\d.]+)\s*GB<\/strong>/i);
            const zkDiskMatch = zkTdMatches[3].match(/<strong>([\d.]+)\s*(GB|TB)<\/strong>/i);

            let zkCauHinh = '';
            if (zkVcpuMatch) zkCauHinh += `- vCPU = ${zkVcpuMatch[1]}\n`;
            if (zkRamMatch) zkCauHinh += `- RAM = ${zkRamMatch[1]}GB\n`;
            if (zkDiskMatch) zkCauHinh += `- Disk = ${zkDiskMatch[1]} ${zkDiskMatch[2]}`;

            zookeeper = {
                cauHinh: zkCauHinh.replace(/\n/g, '<br>'),
                soLuong: zkNumMatch ? zkNumMatch[1] : '3',
                ghiChu: 'Zookeeper/KRaft Controller'
            };
        }
    }

    return {
        cauHinh: cauHinh.replace(/\n/g, '<br>'),
        soLuong: soLuong,
        ghiChu: soLuong ? `${soLuong} Broker` : 'Kafka Cluster',
        zookeeper: zookeeper
    };
}

function getDefaultKafkaCustomProposalTable() {
    return [
        {
            component: 'Kafka Broker',
            quantity: '',
            vcpu: '',
            ram: '',
            disk: ''
        },
        {
            component: 'Zookeeper/KRaft',
            quantity: '3',
            vcpu: '4',
            ram: '8 GB',
            disk: '100 GB'
        }
    ];
}

function normalizeKafkaCustomProposalTable(customProposalTable) {
    const defaults = getDefaultKafkaCustomProposalTable();
    const rows = Array.isArray(customProposalTable) ? customProposalTable : [];
    return defaults.map(defaultRow => {
        const matchedRow = rows.find(row => (row?.component || '').trim() === defaultRow.component) || {};
        if (defaultRow.component === 'Zookeeper/KRaft') {
            return { ...defaultRow };
        }
        return {
            component: defaultRow.component,
            quantity: matchedRow.quantity || '',
            vcpu: matchedRow.vcpu || '',
            ram: matchedRow.ram || '',
            disk: matchedRow.disk || ''
        };
    });
}

function isKafkaCustomProposalTableFilled(customProposalTable) {
    const brokerRow = normalizeKafkaCustomProposalTable(customProposalTable)
        .find(row => row.component === 'Kafka Broker');
    return !!(brokerRow && brokerRow.quantity.trim() && brokerRow.vcpu.trim() && brokerRow.ram.trim() && brokerRow.disk.trim());
}

function normalizeKafkaProposalSource(source, customProposalTable) {
    return source === 'custom' && isKafkaCustomProposalTableFilled(customProposalTable) ? 'custom' : 'auto';
}

function collectKafkaCustomProposalTableData(container) {
    const normalizedDefaults = getDefaultKafkaCustomProposalTable();
    if (!container) return normalizedDefaults;

    return normalizeKafkaCustomProposalTable(normalizedDefaults.map(defaultRow => {
        const row = container.querySelector(`.kafka-custom-proposal-row[data-component="${defaultRow.component}"]`);
        if (!row || defaultRow.component === 'Zookeeper/KRaft') {
            return { ...defaultRow };
        }
        return {
            component: defaultRow.component,
            quantity: row.querySelector('.kafka-custom-proposal-qty')?.value || '',
            vcpu: row.querySelector('.kafka-custom-proposal-vcpu')?.value || '',
            ram: row.querySelector('.kafka-custom-proposal-ram')?.value || '',
            disk: row.querySelector('.kafka-custom-proposal-disk')?.value || ''
        };
    }));
}

function getKafkaSelectedProposalSource(container) {
    const value = container?.querySelector('.kafka-proposal-source-select')?.value || 'auto';
    return value === 'custom' ? 'custom' : 'auto';
}

function getCurrentKafkaProposalState(container) {
    return {
        selectedProposalSource: getKafkaSelectedProposalSource(container),
        customProposalTable: collectKafkaCustomProposalTableData(container)
    };
}

function updateKafkaProposalSourceUI(container, selectedSource = 'auto') {
    if (!container) return;

    const normalizedSource = selectedSource === 'custom' ? 'custom' : 'auto';
    const effectiveSource = normalizeKafkaProposalSource(normalizedSource, collectKafkaCustomProposalTableData(container));
    const select = container.querySelector('.kafka-proposal-source-select');
    const toolHeading = container.querySelector('.kafka-tool-proposal-heading');
    const customHeading = container.querySelector('.kafka-custom-proposal-heading');
    const customSection = container.querySelector('.kafka-custom-proposal-section');
    const autoTable = container.querySelector('[data-kafka-proposal-table="1"]');
    const customTable = container.querySelector('[data-kafka-custom-proposal-table="1"]');

    if (select) select.value = normalizedSource;
    if (toolHeading) toolHeading.innerText = effectiveSource === 'auto'
        ? 'Đề xuất cấu hình do tool tạo (đang dùng)'
        : 'Đề xuất cấu hình do tool tạo';
    if (customHeading) customHeading.innerText = effectiveSource === 'custom'
        ? 'Đề xuất cấu hình tùy chỉnh (đang dùng)'
        : 'Đề xuất cấu hình tùy chỉnh';
    if (customSection) {
        customSection.classList.toggle('is-hidden', normalizedSource !== 'custom');
    }

    if (autoTable) {
        autoTable.style.opacity = effectiveSource === 'auto' ? '1' : '0.7';
        autoTable.style.border = effectiveSource === 'auto' ? '2px solid #38a169' : '';
    }
    if (customTable) {
        customTable.style.opacity = effectiveSource === 'custom' ? '1' : '0.7';
        customTable.style.border = effectiveSource === 'custom' ? '2px solid #38a169' : '';
    }
}

function handleKafkaProposalSourceChange(selectEl) {
    const container = selectEl?.closest('#kafka-throughput-result-container, #kafka-linear-result-container');
    if (!container) return;

    const selectedSource = selectEl.value === 'custom' ? 'custom' : 'auto';

    updateKafkaProposalSourceUI(container, selectedSource);
    markSummaryNeedsSizingRefresh();
}

function buildKafkaCustomProposalSectionHtml(selectedProposalSource, customProposalTable) {
    const normalizedRows = normalizeKafkaCustomProposalTable(customProposalTable);
    const normalizedSource = selectedProposalSource === 'custom' ? 'custom' : 'auto';

    return `
        <div class="kafka-proposal-source-panel proposal-source-panel">
            <label class="panel-label-compact">Bạn có muốn chỉnh sửa cấu hình không?</label>
            <select class="input-full kafka-proposal-source-select" onchange="handleKafkaProposalSourceChange(this)">
                <option value="auto" ${normalizedSource === 'auto' ? 'selected' : ''}>Không</option>
                <option value="custom" ${normalizedSource === 'custom' ? 'selected' : ''}>Có</option>
            </select>
        </div>
        <div class="kafka-custom-proposal-section ${normalizedSource === 'custom' ? '' : 'is-hidden'}">
            <h4 class="kafka-custom-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình tùy chỉnh</h4>
            <table class="sizing-table kafka-custom-proposal-table u-mt-8" data-kafka-custom-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-150">Thành phần</th>
                        <th class="col-w-100">Số lượng Node</th>
                        <th class="col-w-100">vCPU/Node</th>
                        <th class="col-w-100">RAM/Node</th>
                        <th class="col-w-150">Disk/Node (SSD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${normalizedRows.map(row => {
                        const isLocked = row.component === 'Zookeeper/KRaft';
                        const readOnlyAttr = isLocked ? 'readonly' : '';
                        const lockedClass = isLocked ? 'proposal-locked-control' : '';
                        const rowStateClass = isLocked ? 'is-locked' : 'is-active';
                        return `
                            <tr class="kafka-custom-proposal-row ${rowStateClass}" data-component="${escapeHtml(row.component)}">
                                <td><strong>${escapeHtml(row.component)}</strong></td>
                                <td class="text-center"><input type="text" class="input-full text-center kafka-custom-proposal-qty ${lockedClass}" value="${escapeHtml(row.quantity)}" placeholder="Số lượng" ${readOnlyAttr}></td>
                                <td class="text-center"><input type="text" class="input-full text-center kafka-custom-proposal-vcpu ${lockedClass}" value="${escapeHtml(row.vcpu)}" placeholder="vCPU" ${readOnlyAttr}></td>
                                <td class="text-center"><input type="text" class="input-full text-center kafka-custom-proposal-ram ${lockedClass}" value="${escapeHtml(row.ram)}" placeholder="RAM" ${readOnlyAttr}></td>
                                <td class="text-center"><input type="text" class="input-full text-center kafka-custom-proposal-disk ${lockedClass}" value="${escapeHtml(row.disk)}" placeholder="Disk" ${readOnlyAttr}></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

function ensureKafkaProposalSelectionUI(container, options = {}) {
    if (!container) return;

    let autoTable = container.querySelector('[data-kafka-proposal-table="1"]');
    if (!autoTable) {
        const tables = container.querySelectorAll('table.sizing-table');
        autoTable = tables.length ? tables[tables.length - 1] : null;
        if (autoTable) {
            autoTable.setAttribute('data-kafka-proposal-table', '1');
        }
    }
    if (!autoTable) return;

    const toolHeading = autoTable.previousElementSibling;
    if (toolHeading && toolHeading.tagName === 'H4') {
        toolHeading.classList.add('kafka-tool-proposal-heading');
    }

    if (!container.querySelector('[data-kafka-custom-proposal-table="1"]')) {
        autoTable.insertAdjacentHTML(
            'afterend',
            buildKafkaCustomProposalSectionHtml(
                options.selectedProposalSource || 'auto',
                options.customProposalTable || getDefaultKafkaCustomProposalTable()
            )
        );
    }

    const normalizedRows = normalizeKafkaCustomProposalTable(options.customProposalTable || collectKafkaCustomProposalTableData(container));
    container.querySelectorAll('.kafka-custom-proposal-row').forEach(row => {
        const component = row.dataset.component || '';
        const rowData = normalizedRows.find(item => item.component === component) || { quantity: '', vcpu: '', ram: '', disk: '' };
        const qtyInput = row.querySelector('.kafka-custom-proposal-qty');
        const vcpuInput = row.querySelector('.kafka-custom-proposal-vcpu');
        const ramInput = row.querySelector('.kafka-custom-proposal-ram');
        const diskInput = row.querySelector('.kafka-custom-proposal-disk');
        if (qtyInput) qtyInput.value = rowData.quantity;
        if (vcpuInput) vcpuInput.value = rowData.vcpu;
        if (ramInput) ramInput.value = rowData.ram;
        if (diskInput) diskInput.value = rowData.disk;
    });

    updateKafkaProposalSourceUI(container, options.selectedProposalSource || 'auto');
}

function buildKafkaConfigurationTextFromRow(row) {
    const lines = [];
    if (row.vcpu) lines.push(`- vCPU = ${row.vcpu}`);
    if (row.ram) lines.push(`- RAM = ${row.ram}`);
    if (row.disk) lines.push(`- Disk = ${row.disk}`);
    return lines.join('<br>');
}

function buildEffectiveKafkaCustomProposalData(customProposalTable) {
    const normalizedRows = normalizeKafkaCustomProposalTable(customProposalTable);
    const brokerRow = normalizedRows.find(row => row.component === 'Kafka Broker');
    const zkRow = normalizedRows.find(row => row.component === 'Zookeeper/KRaft');

    if (!brokerRow || !brokerRow.quantity.trim() || !brokerRow.vcpu.trim() || !brokerRow.ram.trim() || !brokerRow.disk.trim()) {
        return null;
    }

    return {
        cauHinh: buildKafkaConfigurationTextFromRow(brokerRow),
        soLuong: brokerRow.quantity.trim(),
        ghiChu: `${brokerRow.quantity.trim()} Broker`,
        zookeeper: zkRow ? {
            cauHinh: buildKafkaConfigurationTextFromRow(zkRow),
            soLuong: zkRow.quantity.trim(),
            ghiChu: 'Zookeeper/KRaft Controller'
        } : null
    };
}

function resolveEffectiveKafkaProposalResult(kafkaState = {}) {
    const customProposalTable = normalizeKafkaCustomProposalTable(kafkaState.customProposalTable);
    const selectedProposalSource = normalizeKafkaProposalSource(kafkaState.selectedProposalSource || 'auto', customProposalTable);

    if (selectedProposalSource === 'custom') {
        const customParsed = buildEffectiveKafkaCustomProposalData(customProposalTable);
        if (customParsed) return customParsed;
    }

    return parseKafkaSizingResult(kafkaState.resultHTML || '');
}

async function saveTongHop() {
    const statusDiv = document.getElementById('summary-save-status');
    if (!currentProjectId) { showToast('Vui lòng lưu "Yêu cầu bài toán" trước!', 'warning'); return; }
    try {
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">⏳ Đang lưu...</span>';

        const data = collectTongHop();

        await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tongHopVaDeXuatContent: JSON.stringify(data) })
        });

        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-success">✓ Lưu thành công!</span>';

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

        showToast('Đã lưu Tổng hợp và đề xuất thành công!', 'success');

    } catch (error) {
        Logger.error('Error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

async function saveTongHop() {
    if (!currentProjectId) { showToast('Vui long luu "Yeu cau bai toan" truoc!', 'warning'); return; }

    const saved = await persistSummarySnapshot({
        showToastOnSuccess: true,
        successMessage: 'Da luu Tong hop va de xuat thanh cong!',
        savingMessage: 'Dang luu bang tong hop...',
        savedMessage: 'Da luu bang tong hop thanh cong.',
        errorMessagePrefix: 'Loi khi luu bang tong hop: '
    });
    if (!saved) {
        return;
    }

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role === 'admin1') {
        await updateProjectStatus('admin1_review');
    } else if (role === 'admin2') {
        await updateProjectStatus('admin2_review');
    } else if (role === 'user' || !role) {
        await updateProjectStatus('user_edit');
    }
}

function addSummaryRow() {
    const tbody = document.getElementById('summary-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createSummaryTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) { }
}

// ==================== UTILITY FUNCTIONS ====================

function removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

// Add new row to App Custom Proposal table
function addAppCustomProposalRow(sourceOrData = {}, rowData = null) {
    const isElementSource = sourceOrData
        && typeof sourceOrData === 'object'
        && (typeof sourceOrData.matches === 'function'
            || typeof sourceOrData.closest === 'function'
            || typeof sourceOrData.querySelector === 'function');
    const container = resolveAppProposalContainer(isElementSource ? sourceOrData : null);
    if (!container) return;

    const tbody = container.querySelector('.app-custom-proposal-tbody');
    if (!tbody) return;

    const data = isElementSource ? (rowData || {}) : sourceOrData;
    const normalizedData = normalizeAppCustomProposalTable(data);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <input type="text" class="input-full app-custom-proposal-component sizing-user-input" value="${escapeHtml(normalizedData.component)}" placeholder="Tên thành phần">
        </td>
        <td>
            <textarea class="input-full app-custom-proposal-config sizing-user-input u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình, ví dụ:&#10;CPU: = 16 Cint&#10;RAM: = 64 GB">${escapeHtml(normalizedData.configurationText)}</textarea>
        </td>
        <td class="text-center">
            <input type="text" class="input-full text-center app-custom-proposal-qty sizing-user-input" value="${escapeHtml(normalizedData.quantity)}" placeholder="Số lượng">
        </td>
        <td>
            <textarea class="input-full app-custom-proposal-note sizing-user-input u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(normalizedData.note)}</textarea>
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    autoResizeCustomProposalTextarea(tr.querySelector('.app-custom-proposal-config'));

    // Apply role permissions to new row
    try { applyRolePermissions(); } catch (e) { }
}

// Add new row to Redis Custom Proposal table
function addRedisProposalRow(sourceOrData = {}, rowData = null) {
    const isElementSource = sourceOrData
        && typeof sourceOrData === 'object'
        && (typeof sourceOrData.matches === 'function'
            || typeof sourceOrData.closest === 'function'
            || typeof sourceOrData.querySelector === 'function');
    const container = resolveRedisProposalContainer(isElementSource ? sourceOrData : null);
    if (!container) return;

    const tbody = container.querySelector('.redis-custom-proposal-tbody');
    if (!tbody) return;

    const data = isElementSource ? (rowData || {}) : sourceOrData;
    const normalizedData = normalizeRedisCustomProposalTable(data);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full redis-custom-proposal-component sizing-user-input" value="${escapeHtml(normalizedData.component)}" placeholder="Redis"></td>
        <td><textarea class="input-full redis-custom-proposal-config sizing-user-input u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình, ví dụ:&#10;16 vCPU&#10;64 GB RAM&#10;256 GB DISK">${escapeHtml(normalizedData.configurationText)}</textarea></td>
        <td class="text-center"><input type="text" class="input-full text-center redis-custom-proposal-qty sizing-user-input" value="${escapeHtml(normalizedData.quantity)}" placeholder="Số lượng"></td>
        <td><textarea class="input-full redis-custom-proposal-note sizing-user-input u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(normalizedData.note)}</textarea></td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    autoResizeCustomProposalTextarea(tr.querySelector('.redis-custom-proposal-config'));

    // Apply role permissions to new row
    try { applyRolePermissions(); } catch (e) { }
}

function removeSummaryRow(btn) {
    const row = btn?.closest('tr');
    const tbody = row?.parentElement;
    if (!row || !tbody) return;

    const rowKey = String(row.dataset.rowKey || '').trim();
    if (rowKey) {
        summaryDeletedRowKeys.add(rowKey);
    }

    row.remove();
    summaryManualOverrideActive = true;

    const remainingRows = Array.from(tbody.querySelectorAll('tr')).filter(tr => {
        const firstCell = tr.querySelector('td');
        return firstCell && !firstCell.hasAttribute('colspan');
    });

    if (remainingRows.length === 0) {
        renderSummaryEmptyState(tbody);
    } else {
        updateSTT(tbody);
    }
}

function removeSummaryRow(btn) {
    const row = btn?.closest('tr');
    const tbody = row?.parentElement;
    if (!row || !tbody) return;

    const rowKey = String(row.dataset.rowKey || '').trim();
    if (rowKey) {
        summaryDeletedRowKeys.add(rowKey);
    }

    row.remove();
    summaryManualOverrideActive = true;

    const remainingRows = Array.from(tbody.querySelectorAll('tr')).filter(tr => {
        const firstCell = tr.querySelector('td');
        return firstCell && !firstCell.hasAttribute('colspan');
    });

    if (remainingRows.length === 0) {
        renderSummaryEmptyState(tbody);
    } else {
        updateSTT(tbody);
    }

    markSummaryPendingManualSave();
}

function ensureLBFWCustomMethodUI(passedWrapper = null, passedCleanKey = '') {
    // Prefer passed context, fall back to __activeInstanceKey
    const rawKey = window.__activeInstanceKey || '';
    const activeCleanKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const cleanKey = passedCleanKey || activeCleanKey;

    let docWrapper;
    if (passedWrapper) {
        docWrapper = passedWrapper;
    } else if (cleanKey) {
        docWrapper = document.getElementById(`lbfw-doc-wrapper__inst_${cleanKey}`);
    } else {
        docWrapper = document.getElementById('lbfw-doc-wrapper');
    }
    if (!docWrapper) return;
    docWrapper.style.display = 'block';

    if (!docWrapper.querySelector('.custom-doc-toolbar')) {
        const adminBox = docWrapper.querySelector('.model-admin-box');
        const editorId = cleanKey ? `lbfw-custom-method-editor__inst_${cleanKey}` : 'lbfw-custom-method-editor';
        const tableBodyId = cleanKey ? `lbfw-custom-proposal-table-body__inst_${cleanKey}` : 'lbfw-custom-proposal-table-body';
        const toolbarHtml = `
            <div class="custom-doc-toolbar">
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('undo')" title="Undo" aria-label="Undo"><i class="fa-solid fa-rotate-left"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('redo')" title="Redo" aria-label="Redo"><i class="fa-solid fa-rotate-right"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('bold')" title="Bold" aria-label="Bold"><b>B</b></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('italic')" title="Italic" aria-label="Italic"><i>I</i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('underline')" title="Underline" aria-label="Underline"><u>U</u></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('insertUnorderedList')" title="List" aria-label="List"><i class="fa-solid fa-list-ul"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('insertOrderedList')" title="Numbered" aria-label="Numbered"><i class="fa-solid fa-list-ol"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('justifyLeft')" title="Align Left" aria-label="Align Left"><i class="fa-solid fa-align-left"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('justifyCenter')" title="Align Center" aria-label="Align Center"><i class="fa-solid fa-align-center"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('justifyRight')" title="Align Right" aria-label="Align Right"><i class="fa-solid fa-align-right"></i></button>
                <button type="button" class="ui-icon-btn ui-icon-btn-ghost ui-icon-btn-xs" onclick="formatLBFWCustomDoc('createLink')" title="Link" aria-label="Link"><i class="fa-solid fa-link"></i></button>
            </div>
            <div id="${editorId}" class="custom-doc-editor sizing-user-input" contenteditable="true"
                onpaste="handleLBFWCustomDocPaste(event)"></div>
        `;
        if (adminBox) {
            adminBox.insertAdjacentHTML('beforebegin', toolbarHtml);
        } else {
            docWrapper.insertAdjacentHTML('afterbegin', toolbarHtml);
        }
    }

    const tableBodyId = cleanKey ? `lbfw-custom-proposal-table-body__inst_${cleanKey}` : 'lbfw-custom-proposal-table-body';
    if (!document.getElementById(tableBodyId)) {
        const adminBox = docWrapper.querySelector('.model-admin-box');
        const tableHtml = `
            <div class="u-mt-20">
                <h4 class="u-text-body u-text-md u-font-semibold u-mb-10">
                    <i class="fa-solid fa-table u-text-primary"></i> Cấu hình đề xuất
                </h4>
                <div class="table-responsive">
                    <table class="sizing-table">
                        <thead>
                            <tr>
                                <th class="col-w-180">Thành phần</th>
                                <th>Cấu hình đề xuất</th>
                                <th class="col-w-120">Số lượng</th>
                                <th class="col-w-220">Ghi chú</th>
                                <th class="admin-cell admin-head-cell col-w-120">Đánh giá</th>
                                <th class="admin-cell admin-head-cell col-w-200">Ghi chú Admin</th>
                                <th class="col-w-50"><i class="fa-solid fa-trash-can"></i></th>
                            </tr>
                        </thead>
                        <tbody id="${tableBodyId}"></tbody>
                    </table>
                </div>
                <button type="button" class="ui-btn ui-btn-outline btn-add sizing-user-btn" onclick="addLBFWCustomProposalRow()">
                    <i class="fa-solid fa-plus"></i> Thêm dòng
                </button>
            </div>
        `;
        if (adminBox) {
            adminBox.insertAdjacentHTML('afterend', tableHtml);
        } else {
            docWrapper.insertAdjacentHTML('beforeend', tableHtml);
        }
    }
}

function onLBFWMethodChanged(selectEl) {
    let method;
    let linearBox, docBox, tbody;
    let cleanKey = '';
    let wrapper = null;
    let wrapperInstKey = '';

    if (selectEl) {
        method = selectEl.value || 'bandwidthMethod';
        wrapper = selectEl.closest('.module-instance-wrapper') || selectEl.closest('body');
        wrapperInstKey = wrapper?.dataset.instanceKey || '';
        cleanKey = wrapperInstKey.includes('__inst_')
            ? wrapperInstKey.split('__inst_')[0]
            : wrapperInstKey;
        // ID suffixing in createModuleCloneForInstance only goes 1 level deep,
        // so deep elements (lbfw-doc-wrapper, lbfw-linear-wrapper) keep their original IDs.
        // Find them globally with instance suffix first, fall back to base ID.
        linearBox = document.getElementById(`lbfw-linear-wrapper__inst_${wrapperInstKey}`)
            || wrapper.querySelector('#lbfw-linear-wrapper');
        docBox = document.getElementById(`lbfw-doc-wrapper__inst_${wrapperInstKey}`)
            || wrapper.querySelector('#lbfw-doc-wrapper');
        tbody = document.getElementById(`lbfw-custom-proposal-table-body__inst_${wrapperInstKey}`)
            || wrapper.querySelector('#lbfw-custom-proposal-table-body');
    } else {
        const instanceKey = window.__activeInstanceKey || '';
        cleanKey = instanceKey.includes('__inst_') ? instanceKey.split('__inst_')[0] : instanceKey;
        if (cleanKey) {
            method = document.getElementById(`lbfw-method-select__inst_${cleanKey}`)?.value || 'bandwidthMethod';
            linearBox = document.getElementById(`lbfw-linear-wrapper__inst_${cleanKey}`);
            docBox = document.getElementById(`lbfw-doc-wrapper__inst_${cleanKey}`);
            tbody = document.getElementById(`lbfw-custom-proposal-table-body__inst_${cleanKey}`);
        } else {
            method = document.getElementById('lbfw-method-select')?.value || 'bandwidthMethod';
            linearBox = document.getElementById('lbfw-linear-wrapper');
            docBox = document.getElementById('lbfw-doc-wrapper');
            tbody = document.getElementById('lbfw-custom-proposal-table-body');
        }
    }

    if (linearBox) linearBox.style.display = method === 'bandwidthMethod' ? 'block' : 'none';
    if (docBox) docBox.style.display = method === 'customMethod' ? 'block' : 'none';
    if (method === 'customMethod') {
        ensureLBFWCustomMethodUI(wrapper, cleanKey);
        if (tbody && tbody.children.length === 0) addLBFWCustomProposalRow({}, wrapper, cleanKey);
    }
}

function formatLBFWCustomDoc(command, value = null) {
    const editor = getLBFWCustomDocEditor();
    if (!editor) return;
    editor.focus();
    if (command === 'createLink') {
        const url = prompt('Nhập URL');
        if (!url) return;
        document.execCommand(command, false, url);
        return;
    }
    document.execCommand(command, false, value);
}

function handleLBFWCustomDocPaste(event) {
    if (!event || !event.clipboardData) return;
    const items = event.clipboardData.items || [];
    for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target?.result || '';
                if (!src) return;
                const probe = new Image();
                probe.onload = () => {
                    const naturalWidth = probe.naturalWidth || '';
                    const naturalHeight = probe.naturalHeight || '';
                    document.execCommand(
                        'insertHTML',
                        false,
                        `<img src="${src}" alt="Pasted Image" data-origin-width="${naturalWidth}" data-origin-height="${naturalHeight}" class="pasted-image">`
                    );
                };
                probe.onerror = () => {
                    document.execCommand(
                        'insertHTML',
                        false,
                        `<img src="${src}" alt="Pasted Image" class="pasted-image">`
                    );
                };
                probe.src = src;
            };
            reader.readAsDataURL(file);
            return;
        }
    }
}

function createLBFWCustomProposalRow(data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input lbfw-custom-proposal-component" placeholder="Thành phần" value="${escapeHtml(data.component || '')}"></td>
        <td><textarea rows="2" class="input-full sizing-user-input lbfw-custom-proposal-config" placeholder="Cấu hình đề xuất" oninput="autoResizeCustomProposalTextarea(this)">${escapeHtml(data.configuration || '')}</textarea></td>
        <td><input type="text" class="input-full sizing-user-input lbfw-custom-proposal-qty" placeholder="Số lượng" value="${escapeHtml(data.quantity || '')}"></td>
        <td><input type="text" class="input-full sizing-user-input lbfw-custom-proposal-note" placeholder="Ghi chú" value="${escapeHtml(data.note || '')}"></td>
        <td class="admin-cell">
            <select class="admin-eval-select lbfw-custom-proposal-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note lbfw-custom-proposal-admin-note" placeholder="Nhận xét...">
        </td>
        <td><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td>
    `;
    return tr;
}

function addLBFWCustomProposalRow(data = {}, passedWrapper = null, passedCleanKey = '') {
    ensureLBFWCustomMethodUI(passedWrapper, passedCleanKey);
    const rawKey = window.__activeInstanceKey || '';
    const activeCleanKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const cleanKey = passedCleanKey || activeCleanKey;
    const tbody = cleanKey
        ? document.getElementById(`lbfw-custom-proposal-table-body__inst_${cleanKey}`)
        : document.getElementById('lbfw-custom-proposal-table-body');
    if (!tbody) return;
    const row = createLBFWCustomProposalRow(data);
    tbody.appendChild(row);
    autoResizeCustomProposalTextarea(row.querySelector('.lbfw-custom-proposal-config'));
    try { applyRolePermissions(); } catch (e) { }
}

function collectLBFWCustomMethodProposalTableData() {
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const tableId = instanceKey ? `lbfw-custom-proposal-table-body__inst_${instanceKey}` : 'lbfw-custom-proposal-table-body';
    const rows = [];
    document.querySelectorAll(`#${tableId} tr`).forEach(row => {
        rows.push({
            component: row.querySelector('.lbfw-custom-proposal-component')?.value?.trim() || '',
            configuration: row.querySelector('.lbfw-custom-proposal-config')?.value?.trim() || '',
            quantity: row.querySelector('.lbfw-custom-proposal-qty')?.value?.trim() || '',
            note: row.querySelector('.lbfw-custom-proposal-note')?.value?.trim() || ''
        });
    });
    return rows;
}

function loadLBFWCustomMethodProposalTableData(rows) {
    ensureLBFWCustomMethodUI();
    const rawKey = window.__activeInstanceKey || '';
    const instanceKey = rawKey.includes('__inst_') ? rawKey.split('__inst_')[0] : rawKey;
    const tbody = instanceKey
        ? document.getElementById(`lbfw-custom-proposal-table-body__inst_${instanceKey}`)
        : document.getElementById('lbfw-custom-proposal-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach(row => addLBFWCustomProposalRow(row));
    } else {
        addLBFWCustomProposalRow({});
    }
}

function collectLBFWCustomMethodData() {
    ensureLBFWCustomMethodUI();
    const editor = getLBFWCustomDocEditor();
    const html = stripUnsafeHtml(editor?.innerHTML || '');
    const text = (editor?.innerText || '').trim();
    return {
        customMethodDocHtml: html,
        customMethodDocText: text,
        customProposalTable: collectLBFWCustomMethodProposalTableData()
    };
}

function loadLBFWCustomMethodData(data = {}) {
    ensureLBFWCustomMethodUI();
    const editor = getLBFWCustomDocEditor();
    if (editor) editor.innerHTML = stripUnsafeHtml(data.customMethodDocHtml || '');
    loadLBFWCustomMethodProposalTableData(data.customProposalTable);
}
function removeArchRow(btn) {
    removeRow(btn);
    updateModuleVisibility();
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
        container.appendChild(createModelUploadCard(boxId, imgData.base64));
    });
}

function createModelUploadCard(boxId, imageSrc = '', options = {}) {
    const previewHandler = options.previewHandler || 'previewModelImage';
    const previewAlt = options.previewAlt || 'Ảnh mô hình hệ thống';
    const emptyLabel = options.emptyLabel || 'Chọn ảnh';
    const div = document.createElement('div');
    div.className = 'upload-box model-upload-card' + (imageSrc ? ' has-image' : ' is-empty');
    div.id = boxId;
    div.innerHTML = `
        <input type="file" accept="image/*" onchange="${previewHandler}(this, '${boxId}')" class="is-hidden" id="input-${boxId}">
        <button type="button" class="model-card-remove" onclick="document.getElementById('${boxId}')?.remove()" title="Xóa ảnh" aria-label="Xóa ảnh">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <label for="input-${boxId}" class="model-card-change" title="Đổi ảnh">
            <i class="fa-solid fa-arrow-rotate-right" aria-hidden="true"></i>
        </label>
        <div class="preview-area model-preview-area" id="preview-${boxId}">
            ${imageSrc ? createModelPreviewMarkup(imageSrc, previewAlt) : createModelEmptyMarkup(boxId, emptyLabel)}
        </div>
    `;
    return div;
}

function createModelPreviewMarkup(src, alt = 'Ảnh mô hình hệ thống') {
    return `
        <button type="button" class="model-preview-button btn-view-evidence" onclick="openModal(this.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
            <img src="${src}" alt="${alt}" class="model-preview-img">
            <span class="model-preview-overlay">
                <i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>
                <span>Xem ảnh</span>
            </span>
        </button>
    `;
}

function createModelEmptyMarkup(boxId, label = 'Chọn ảnh') {
    return `
        <label class="model-empty-state" for="input-${boxId}">
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
            <span>${label}</span>
        </label>
    `;
}

function createEvidenceUploadCard(boxId, imageSrc = '') {
    return createModelUploadCard(boxId, imageSrc, {
        previewHandler: 'previewEvidenceCardImage',
        previewAlt: 'Ảnh sở cứ',
        emptyLabel: 'Chọn ảnh'
    });
}

function appendEvidenceImageCard(container, file, prefix = 'evidence-img') {
    const boxId = prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const card = createEvidenceUploadCard(boxId);
    container.appendChild(card);

    const reader = new FileReader();
    reader.onload = function (e) {
        const previewArea = document.getElementById(`preview-${boxId}`);
        if (previewArea) previewArea.innerHTML = createModelPreviewMarkup(e.target.result, 'Ảnh sở cứ');
        card.classList.remove('is-empty');
        card.classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

function appendModelImageCard(container, file) {
    const boxId = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const card = createModelUploadCard(boxId);
    container.appendChild(card);

    const reader = new FileReader();
    reader.onload = function (e) {
        const previewArea = document.getElementById(`preview-${boxId}`);
        if (previewArea) previewArea.innerHTML = createModelPreviewMarkup(e.target.result);
        card.classList.remove('is-empty');
        card.classList.add('has-image');
        clearModelImageRequiredError(container);
    };
    reader.readAsDataURL(file);
}

function createUploadBox(type) {
    const containerId = 'container-' + type;
    const container = document.getElementById(containerId);
    if (!container) return;

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.multiple = true;
    picker.className = 'is-hidden';
    picker.addEventListener('cancel', () => picker.remove());
    picker.onchange = function () {
        Array.from(picker.files || []).forEach(file => appendModelImageCard(container, file));
        picker.remove();
        try { applyRolePermissions(); } catch (e) { }
    };
    document.body.appendChild(picker);
    picker.click();
    // enforce role permissions (disable upload box for admin if needed)
    try { applyRolePermissions(); } catch (e) { }
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
            <input type="file" accept="image/*" onchange="previewEvidenceImage(this, '${boxId}')" class="is-hidden" id="input-${boxId}">
            <label for="input-${boxId}" class="upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Chọn ảnh</span>
            </label>
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-img" onclick="document.getElementById('${boxId}').remove()"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div class="preview-area" id="preview-${boxId}"></div>
    `;
    container.appendChild(div);
}

function previewModelImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (previewArea) previewArea.innerHTML = createModelPreviewMarkup(e.target.result);
            const card = document.getElementById(boxId);
            if (card) {
                card.classList.remove('is-empty');
                card.classList.add('has-image');
                clearModelImageRequiredError(card.closest('.model-upload-grid'));
            }
        };
        reader.readAsDataURL(input.files[0]);
        input.value = '';
    }
}

function previewEvidenceCardImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (previewArea) previewArea.innerHTML = createModelPreviewMarkup(e.target.result, 'Ảnh sở cứ');
            const card = document.getElementById(boxId);
            if (card) {
                card.classList.remove('is-empty');
                card.classList.add('has-image');
            }
        };
        reader.readAsDataURL(input.files[0]);
        input.value = '';
    }
}

function previewEvidenceImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" class="is-hidden"><button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh" aria-label="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
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
        <input type="file" accept="image/*" onchange="previewEvidenceSizingImage(this, '${boxId}')" class="is-hidden" id="input-${boxId}">
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
        reader.onload = function (e) {
            previewArea.innerHTML = `
                <div class="u-flex u-align-center u-gap-8 u-p-8">
                    <img src="${e.target.result}" alt="Evidence" class="is-hidden">
                    <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteEvidenceSizingSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
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
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const div = document.createElement('div');
            div.className = 'row-evidence-item';
            const safeBase64 = e.target.result.replace(/"/g, '&quot;');
            div.innerHTML = `<button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" data-base64="${safeBase64}" onclick="openModalFromElement(this)" title="Xem ảnh" aria-label="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
            container.appendChild(div);
            const label = cellWrapper.querySelector('.upload-icon-btn');
            if (label) label.classList.add('has-file');
        };
        reader.readAsDataURL(file);
    });
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
            if (label) label.classList.remove('has-file');
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
    const confirmed = await showConfirm(
        'Gửi đánh giá',
        `Bạn có chắc muốn gửi đánh giá cho phần "<strong>${label}</strong>"?`,
        { confirmText: 'Gửi đánh giá' }
    );
    if (!confirmed) return;

    const statusIdMap = {
        request: 'save-status',
        input: 'input-save-status',
        model: 'model-save-status',
        summary: 'summary-save-status'
    };
    const statusDiv = document.getElementById(statusIdMap[sectionKey]);
    if (statusDiv) statusDiv.innerHTML = '<span class="u-text-warning">⏳ Đang gửi đánh giá...</span>';

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin1' && role !== 'admin2') {
        showToast('Chỉ admin mới được gửi đánh giá', 'warning');
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">✗ Chỉ admin mới có quyền đánh giá</span>';
        return;
    }

    if (!currentProjectId) {
        showToast('Chưa chọn dự án', 'warning');
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">✗ Chưa chọn dự án</span>';
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
        } else if (sectionKey === 'summary') {
            reviewObj = collectSummaryAdminReview();
        } else {
            reviewObj = { message: 'unsupported section' };
        }
    } catch (e) {
        Logger.error('Error collecting review data', e);
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">✗ Lỗi thu thập dữ liệu đánh giá</span>';
        return;
    }

    // Send to backend evaluate endpoint
    try {
        const resp = await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: sectionKey, reviewJson: JSON.stringify(reviewObj) })
        });

        if (resp.ok) {
            if (statusDiv) statusDiv.innerHTML = '<span class="u-text-success">✓ Đã gửi đánh giá</span>';

            // Đợi một chút để đảm bảo database đã commit transaction
            await new Promise(resolve => setTimeout(resolve, 300));

            // Cập nhật trạng thái dự án (admin review)
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
            }

            showToast('Đã gửi đánh giá cho "' + label + '"', 'success');
            // reload data to reflect saved admin review
            await loadAllDataFromDB();
        } else {
            const txt = await resp.text();
            throw new Error(txt || 'Server error');
        }
    } catch (err) {
        Logger.error('Evaluate error', err);
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">✗ Lỗi gửi đánh giá</span>';
        showToast('Lỗi khi gửi đánh giá: ' + err.message, 'error');
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

async function exportSavedSnapshotToWord() {
    const statusDiv = document.getElementById('summary-save-status');

    if (!currentProjectId) {
        showToast('Chua co du lieu de xuat! Vui long luu du lieu truoc.', 'warning');
        return;
    }

    try {
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">Dang xuat file DOCX tu du lieu da luu...</span>';

        const response = await fetchAPI(`${API_BASE_URL}/export/project/${currentProjectId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }
        });

        if (response.ok) {
            const blob = await response.blob();

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `project-report-${currentProjectId}.docx`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            if (statusDiv) statusDiv.innerHTML = '<span class="u-text-success">Xuat file DOCX thanh cong!</span>';
        } else {
            throw new Error('Khong the xuat file');
        }
    } catch (e) {
        Logger.error('Export error:', e);
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">Loi xuat file!</span>';
        showToast('Khong the xuat bao cao: ' + e.message, 'error');
    }
}

// ==================== EXPORT TO WORD ====================

async function exportToWord() {
    return exportSavedSnapshotToWord();

    const statusDiv = document.getElementById('summary-save-status');

    if (!currentProjectId) {
        showToast('Chưa có dữ liệu để xuất! Vui lòng lưu dữ liệu trước.', 'warning');
        return;
    }

    try {
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">⏳ Đang tổng hợp và lưu dữ liệu...</span>';

        // 1. Lưu full payload (bao gồm dữ liệu định cỡ + kết quả tổng hợp)
        // để DOCX luôn lấy đúng dữ liệu Kafka mới tính toán.
        const exportActiveSectionId = document.querySelector('.page-section.active')?.id || null;
        const payload = buildSectionSavePayload({
            activeSectionId: exportActiveSectionId,
            summaryMode: exportActiveSectionId === 'page-sizing' ? 'regenerate' : 'snapshot',
            summaryAggregateOptions: exportActiveSectionId === 'page-sizing'
                ? { resetManualDeletes: true }
                : {}
        });
        if (!payload) {
            throw new Error('Không thể tổng hợp dữ liệu để xuất báo cáo');
        }

        await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-primary">⏳ Đang tạo file DOCX...</span>';

        // 2. Gọi API export từ backend1
        const response = await fetchAPI(`${API_BASE_URL}/export/project/${currentProjectId}`, {
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

            if (statusDiv) statusDiv.innerHTML = '<span class="u-text-success">✓ Xuất file DOCX thành công!</span>';
        } else {
            throw new Error('Không thể xuất file');
        }
    } catch (e) {
        Logger.error('Export error:', e);
        if (statusDiv) statusDiv.innerHTML = '<span class="u-text-danger">✗ Lỗi xuất file!</span>';
        showToast('Không thể xuất báo cáo: ' + e.message, 'error');
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    Logger.debug('Current Project ID:', currentProjectId);
    applyFixedSizingRule();
    initAdminReviewDirtyTracking();

    // Kiểm tra xem người dùng đã đăng nhập chưa
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const authToken = localStorage.getItem('authToken');
    if (!isLoggedIn || !authToken) {
        // Chưa đăng nhập hoặc không có token, chuyển hướng đến trang đăng nhập
        window.location.href = 'login.html';
        return;
    }

    checkAuthStatus();
    initGlobalAutoResizeTextBoxes();
    initGlobalAutoResizeTextBoxObserver();
    scheduleAutoResizeTextBoxes();
    initVietnameseDateInputs();
    initRequestAutoResizeTextareas();
    applyRolePermissions();
    initHelpTooltipSmartPositioning();
    initFirstRowGuards();
    onVirtualizationModeChange('app');
    onVirtualizationModeChange('k8s');
    onVirtualizationModeChange('custom');

    // ===== URL-based routing: khôi phục trạng thái từ URL hash =====
    const initState = parseAppHash(location.hash);
    if (initState.view === 'project' && initState.projectId) {
        // URL chỉ đến một project cụ thể -> mở project đó
        replaceAppState('project', initState.projectId, initState.tab);
        await openProject(initState.projectId, { tab: initState.tab, skipPushState: true });
    } else {
        // Mặc định: hiển thị danh sách dự án
        clearProjectIds();
        document.getElementById('project-list-page').style.display = 'block';
        document.getElementById('project-detail-page').style.display = 'none';
        document.getElementById('btn-back-to-list').style.display = 'none';

        // Ẩn nút Lịch sử phiên bản khi ở trang danh sách
        const btnVersionHistory = document.getElementById('btn-version-history');
        if (btnVersionHistory) btnVersionHistory.style.display = 'none';

        await loadProjectList();
        replaceAppState('projects', null, null);
    }

    // Menu click đã được xử lý qua onclick="showSection(...)" trong HTML.
    // showSection() sẽ tự động pushState khi chuyển tab.

    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.onclick = addInputRow;
    const addBaselineBtn = document.getElementById('addBaselineRowBtn');
    if (addBaselineBtn) addBaselineBtn.onclick = addBaselineRow;
    const addArchBtn = document.getElementById('addArchRowBtn');
    if (addArchBtn) addArchBtn.onclick = addArchRow;
    const addLogicComponentBtn = document.getElementById('addLogicComponentRowBtn');
    if (addLogicComponentBtn) addLogicComponentBtn.onclick = addLogicComponentRow;
    const addSummaryBtn = document.getElementById('addSummaryRowBtn');
    if (addSummaryBtn) addSummaryBtn.onclick = addSummaryRow;
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = exportSavedSnapshotToWord;
    const addConnectionBtn = document.getElementById('addConnectionRowBtn');
    if (addConnectionBtn) addConnectionBtn.onclick = addConnectionRow;

    document.addEventListener('pointerdown', (event) => {
        if (event.target && event.target.classList && event.target.classList.contains('mariadb-master-radio')) {
            syncMariaDBMasterRadioNames();
        }
    }, true);
});

// --- CÁC HÀM XỬ LÝ MODAL ---
const IMAGE_VIEWER_MIN_SCALE = 1;
const IMAGE_VIEWER_MAX_SCALE = 8;
const IMAGE_VIEWER_ZOOM_STEP = 1.18;

const imageViewerState = {
    scale: 1,
    x: 0,
    y: 0,
    isDragging: false,
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    startX: 0,
    startY: 0,
    eventsBound: false
};

function getImageViewerElements() {
    return {
        modal: document.getElementById("evidence-modal"),
        viewport: document.getElementById("image-viewer-viewport"),
        img: document.getElementById("modal-img"),
        zoomLabel: document.getElementById("image-viewer-zoom-label")
    };
}

function clampImageViewerScale(scale) {
    return Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(IMAGE_VIEWER_MIN_SCALE, scale));
}

function clampImageViewerPan(viewport, img) {
    if (!viewport || !img || imageViewerState.scale <= 1.01) {
        imageViewerState.x = 0;
        imageViewerState.y = 0;
        return;
    }

    const overflowX = Math.max(0, (img.offsetWidth * imageViewerState.scale - viewport.clientWidth) / 2);
    const overflowY = Math.max(0, (img.offsetHeight * imageViewerState.scale - viewport.clientHeight) / 2);
    imageViewerState.x = Math.min(overflowX, Math.max(-overflowX, imageViewerState.x));
    imageViewerState.y = Math.min(overflowY, Math.max(-overflowY, imageViewerState.y));
}

function updateImageViewer() {
    const { viewport, img, zoomLabel } = getImageViewerElements();
    if (!img) return;

    clampImageViewerPan(viewport, img);
    img.style.transform = `translate3d(${imageViewerState.x}px, ${imageViewerState.y}px, 0) scale(${imageViewerState.scale})`;

    const isZoomed = imageViewerState.scale > 1.01;
    if (viewport) {
        viewport.classList.toggle('is-draggable', isZoomed);
        viewport.classList.toggle('is-dragging', imageViewerState.isDragging);
    }
    img.classList.toggle('is-interacting', imageViewerState.isDragging);

    if (zoomLabel) {
        zoomLabel.textContent = `${Math.round(imageViewerState.scale * 100)}%`;
    }
}

function resetImageViewer() {
    imageViewerState.scale = 1;
    imageViewerState.x = 0;
    imageViewerState.y = 0;
    imageViewerState.isDragging = false;
    imageViewerState.pointerId = null;
    updateImageViewer();
}

function zoomImageViewerTo(nextScale, anchorEvent) {
    const { viewport } = getImageViewerElements();
    const previousScale = imageViewerState.scale;
    const scale = clampImageViewerScale(nextScale);
    if (Math.abs(scale - previousScale) < 0.001) return;

    if (viewport && anchorEvent) {
        const rect = viewport.getBoundingClientRect();
        const localX = anchorEvent.clientX - rect.left - rect.width / 2;
        const localY = anchorEvent.clientY - rect.top - rect.height / 2;
        const ratio = scale / previousScale;
        imageViewerState.x = localX - (localX - imageViewerState.x) * ratio;
        imageViewerState.y = localY - (localY - imageViewerState.y) * ratio;
    } else {
        const ratio = scale / previousScale;
        imageViewerState.x *= ratio;
        imageViewerState.y *= ratio;
    }

    imageViewerState.scale = scale;
    if (scale <= 1.01) {
        imageViewerState.x = 0;
        imageViewerState.y = 0;
    }
    updateImageViewer();
}

function zoomImageViewerIn() {
    zoomImageViewerTo(imageViewerState.scale * IMAGE_VIEWER_ZOOM_STEP);
}

function zoomImageViewerOut() {
    zoomImageViewerTo(imageViewerState.scale / IMAGE_VIEWER_ZOOM_STEP);
}

function bindImageViewerEvents() {
    const { viewport } = getImageViewerElements();
    if (!viewport || imageViewerState.eventsBound) return;

    viewport.addEventListener('wheel', function (event) {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY < 0 ? IMAGE_VIEWER_ZOOM_STEP : 1 / IMAGE_VIEWER_ZOOM_STEP;
        zoomImageViewerTo(imageViewerState.scale * direction, event);
    }, { passive: false });

    viewport.addEventListener('pointerdown', function (event) {
        if (event.button !== 0 || imageViewerState.scale <= 1.01) return;
        event.preventDefault();
        imageViewerState.isDragging = true;
        imageViewerState.pointerId = event.pointerId;
        imageViewerState.dragStartX = event.clientX;
        imageViewerState.dragStartY = event.clientY;
        imageViewerState.startX = imageViewerState.x;
        imageViewerState.startY = imageViewerState.y;
        viewport.setPointerCapture(event.pointerId);
        updateImageViewer();
    });

    viewport.addEventListener('pointermove', function (event) {
        if (!imageViewerState.isDragging || imageViewerState.pointerId !== event.pointerId) return;
        imageViewerState.x = imageViewerState.startX + event.clientX - imageViewerState.dragStartX;
        imageViewerState.y = imageViewerState.startY + event.clientY - imageViewerState.dragStartY;
        updateImageViewer();
    });

    function stopDragging(event) {
        if (imageViewerState.pointerId !== null && viewport.hasPointerCapture(imageViewerState.pointerId)) {
            viewport.releasePointerCapture(imageViewerState.pointerId);
        }
        imageViewerState.isDragging = false;
        imageViewerState.pointerId = null;
        updateImageViewer();
        if (event) event.stopPropagation();
    }

    viewport.addEventListener('pointerup', stopDragging);
    viewport.addEventListener('pointercancel', stopDragging);
    viewport.addEventListener('dblclick', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (imageViewerState.scale > 1.01) {
            resetImageViewer();
        } else {
            zoomImageViewerTo(2, event);
        }
    });

    imageViewerState.eventsBound = true;
}

// Hàm mở Modal xem ảnh to
function openModal(imgSrc) {
    const { modal, img } = getImageViewerElements();

    if (modal && img && imgSrc) {
        bindImageViewerEvents();
        resetImageViewer();
        modal.classList.remove('initially-hidden');
        modal.style.display = "flex"; // Hiện modal
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('image-viewer-open');
        img.src = imgSrc;
    }
}

// Hàm đóng Modal
function closeModal() {
    const { modal, img } = getImageViewerElements();
    if (modal) {
        modal.style.display = "none";
        modal.classList.add('initially-hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (img) {
        img.removeAttribute('src');
    }
    document.body.classList.remove('image-viewer-open');
    resetImageViewer();
}

function downloadModalImage() {
    const { img } = getImageViewerElements();
    if (!img || !img.src) return;

    const link = document.createElement('a');
    link.href = img.src;
    link.download = 'evidence-image';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// Đóng modal khi nhấn phím ESC
document.addEventListener('keydown', function (event) {
    if (event.key === "Escape") {
        closeModal();
        closeWorkflowActionModal();
        closeBulkBaselineModal();
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

let bulkBaselineTargetInstanceKey = '';
let bulkBaselineTargetModuleKey = 'app';

const BULK_BASELINE_MODULE_CONFIG = {
    app: {
        title: 'Nhập Server tham chiếu hàng loạt',
        successLabel: 'Server tham chiếu',
        tableBodyId: 'baseline-table-body',
        inputConfigBodyId: 'input-config-table-body',
        selectors: {
            ip: '.ip-input',
            cpu: '.cpu-input',
            ram: '.ram-input',
            disk: '.disk-input',
            cint: '.cint-input'
        },
        addRow: () => addBaselineRow(),
        syncIp: (ipInput) => syncIPToInputConfig(ipInput),
        recalculateRow: (row) => recalculateInputConfigForRow(row.querySelector('.cint-input') || row),
        updateAfterApply: () => {
            updateRowNumbers();
            updateInputConfigRowNumbers();
            updateBaselineTotal();
            updateInputConfigTotal();
            refreshStorageIpDropdowns('app');
        }
    },
    custom: {
        title: 'Nhập Server tương đương hàng loạt',
        successLabel: 'Server tương đương',
        tableBodyId: 'custom-baseline-table-body',
        inputConfigBodyId: 'custom-input-config-table-body',
        selectors: {
            ip: '.ip-input',
            cpu: '.cpu-input',
            ram: '.ram-input',
            disk: '.disk-input',
            cint: '.cint-input'
        },
        addRow: () => addCustomBaselineRow(),
        syncIp: (ipInput) => updateCustomIPToInputConfig(ipInput),
        recalculateRow: (row) => recalculateCustomInputConfigRow(row.querySelector('.cint-input') || row),
        updateAfterApply: () => {
            updateCustomBaselineRowNumbers();
            updateCustomInputConfigRowNumbers();
            updateCustomBaselineTotal();
            updateCustomInputConfigTotal();
            refreshStorageIpDropdowns('custom');
        }
    },
    k8s: {
        title: 'Nhập Server tham chiếu K8S hàng loạt',
        successLabel: 'Server tham chiếu K8S',
        tableBodyId: 'k8s-baseline-table-body',
        inputConfigBodyId: 'k8s-input-config-table-body',
        selectors: {
            ip: '.k8s-ip-input',
            cpu: '.k8s-cpu-input',
            ram: '.k8s-ram-input',
            disk: '.k8s-disk-input',
            cint: '.k8s-cint-input'
        },
        addRow: () => addK8SBaselineRow(),
        syncIp: (ipInput) => syncK8SIPToInputConfig(ipInput),
        recalculateRow: (row) => recalculateK8SInputConfigForRow(row.querySelector('.k8s-cint-input') || row),
        updateAfterApply: () => {
            updateK8SRowNumbers();
            updateK8SInputConfigRowNumbers();
            updateK8SBaselineTotal();
            updateK8SInputConfigTotal();
            refreshStorageIpDropdowns('k8s');
        }
    }
};

function getBulkBaselineModuleConfig(moduleKey = bulkBaselineTargetModuleKey) {
    return BULK_BASELINE_MODULE_CONFIG[moduleKey] || BULK_BASELINE_MODULE_CONFIG.app;
}

// 2. Hàm Thêm dòng mới
function addBaselineRow() {
    const tbody = document.getElementById('baseline-table-body');
    const inputConfigTbody = document.getElementById('input-config-table-body');
    if (!tbody) return;

    // Tính số thứ tự (STT)
    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const rowId = 'baseline-row-' + Date.now() + '-' + rowCount;
    const syncIpHandler = buildInstanceAwareHandler('syncIPToInputConfig(this)');
    const recalcHandler = buildInstanceAwareHandler('updateBaselineTotal(); recalculateInputConfigForRow(this)');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler('deleteBaselineRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>

        <td><input type="text" class="input-full text-center ip-input" placeholder="10.x.x.x" oninput="${syncIpHandler}"></td>

        <td><input type="text" class="input-full cpu-input" placeholder="Intel Xeon..."></td>

        <td>
            <input type="number" class="input-full text-center ram-input" min="0" oninput="${recalcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-input" min="0" oninput="${recalcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center cint-input" min="0" oninput="${recalcHandler}">
        </td>

        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="baseline-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
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
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="${deleteRowHandler}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    // Tự động thêm dòng tương ứng vào bảng input config
    if (inputConfigTbody) {
        addInputConfigRow();
    }

    // Re-apply role permissions for new row (disable admin fields for user, disable user fields for admin)
    refreshStorageIpDropdowns('app');
    applyRolePermissions();
    return tr;
}

// Generic inline evidence upload handler for per-row image columns
function handleInlineEvidenceUpload(input) {
    const cell = input.closest('.inline-evidence-cell');
    if (!cell) return;
    const previewSpan = cell.querySelector('.inline-evidence-preview');
    const uploadBtn = cell.querySelector('.btn-inline-evidence');

    const files = Array.from(input.files || []);
    if (!previewSpan || files.length === 0) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewSpan.insertAdjacentHTML('beforeend', createInlineEvidenceItemMarkup(e.target.result));
        };
        reader.readAsDataURL(file);
    });

    // Keep upload button visible to allow appending more images.
    if (uploadBtn) uploadBtn.style.display = '';
    input.value = '';
}

function createInlineEvidenceItemMarkup(dataUrl) {
    return `
        <span class="row-evidence-item">
            <img src="${dataUrl}" alt="Evidence" class="inline-evidence-img is-hidden">
            <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence sizing-user-btn" onclick="removeInlineEvidence(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </span>
    `;
}

function removeInlineEvidence(btn) {
    const cell = btn.closest('.inline-evidence-cell');
    if (!cell) return;
    const previewSpan = cell.querySelector('.inline-evidence-preview');
    const uploadBtn = cell.querySelector('.btn-inline-evidence');
    const fileInput = cell.querySelector('input[type=file]');

    const item = btn.closest('.row-evidence-item');
    if (item) {
        item.remove();
    } else if (previewSpan) {
        previewSpan.innerHTML = '';
    }

    if (uploadBtn) {
        const hasAnyEvidence = !!cell.querySelector('.inline-evidence-img');
        uploadBtn.style.display = hasAnyEvidence ? '' : '';
    }

    if (fileInput) fileInput.value = '';
}

function getEvidenceImagesFromRowData(row) {
    if (!row || typeof row !== 'object') return [];
    if (Array.isArray(row.evidenceImages)) {
        return row.evidenceImages.filter(Boolean);
    }

    const fallback = [row.evidenceImage, row.evidenceDataUrl].filter(Boolean);
    return fallback;
}

function collectInlineEvidenceFromScope(scope) {
    if (!scope) return [];
    return Array.from(scope.querySelectorAll('.inline-evidence-preview .inline-evidence-img'))
        .map(img => img.src)
        .filter(Boolean);
}

// Load inline evidence image(s) into a cell
function loadInlineEvidence(cell, dataUrlOrList) {
    if (!cell || !dataUrlOrList) return;
    const previewSpan = cell.querySelector('.inline-evidence-preview');
    const uploadBtn = cell.querySelector('.btn-inline-evidence');

    if (!previewSpan) return;

    const images = Array.isArray(dataUrlOrList) ? dataUrlOrList.filter(Boolean) : [dataUrlOrList];
    if (images.length === 0) return;

    images.forEach(dataUrl => {
        previewSpan.insertAdjacentHTML('beforeend', createInlineEvidenceItemMarkup(dataUrl));
    });

    if (uploadBtn) {
        uploadBtn.style.display = '';
    }
}

// Baseline Evidence Grid functions
function addBaselineEvidenceSlot() {
    const grid = document.getElementById('baseline-evidence-grid');
    if (!grid) return;

    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleBaselineEvidenceUpload(this)" class="is-hidden">
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
        reader.onload = function (e) {
            previewArea.innerHTML = `
                <div class="u-flex u-align-center u-gap-8 u-p-8">
                    <img src="${e.target.result}" alt="Evidence" class="is-hidden">
                    <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteBaselineEvidenceSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
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
    openModal(src);
}

function closeImageModal() {
    closeModal();
}

// 3. Hàm Xóa dòng & Cập nhật lại STT
function deleteBaselineRow(btn) {
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
    refreshStorageIpDropdowns('app');
}

// 4. Helper: Cập nhật lại số thứ tự (1, 2, 3...) khi xóa dòng giữa
function updateRowNumbers() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
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

    document.querySelectorAll('#baseline-table-body tr').forEach(row => {
        const ram = parseFloat(row.querySelector('.ram-input')?.value) || 0;
        const cint = parseFloat(row.querySelector('.cint-input')?.value) || 0;
        const disk = parseFloat(row.querySelector('.disk-input')?.value) || 0;
        totalRam += ram;
        totalCint += cint;
        totalDisk += disk;
    });

    totalRamEl.innerText = totalRam;
    totalCintEl.innerText = totalCint;
    if (totalDiskEl) totalDiskEl.innerText = totalDisk;
}

function getBulkBaselineControls() {
    return {
        modal: document.getElementById('bulk-baseline-modal'),
        title: document.getElementById('bulk-baseline-title'),
        cpu: document.getElementById('bulk-baseline-cpu'),
        ram: document.getElementById('bulk-baseline-ram'),
        disk: document.getElementById('bulk-baseline-disk'),
        cint: document.getElementById('bulk-baseline-cint'),
        ipList: document.getElementById('bulk-baseline-ip-list'),
        error: document.getElementById('bulk-baseline-error')
    };
}

function setBulkBaselineError(message, field = null) {
    const controls = getBulkBaselineControls();
    if (controls.error) controls.error.textContent = message || '';
    Object.values(controls).forEach(el => el?.classList?.remove('field-error'));
    if (field) {
        field.classList.add('field-error');
        field.focus();
    }
}

function openBulkBaselineModal(sourceElement = null, moduleKey = 'app') {
    const role = (getCurrentUser()?.role || '').toLowerCase();
    if (role === 'admin1' || role === 'admin2') {
        showToast('Chỉ user mới có thể nhập hàng loạt Server tham chiếu.', 'warning');
        return;
    }

    const sourceWrapper = sourceElement?.closest?.('.module-instance-wrapper[data-instance-key]');
    bulkBaselineTargetInstanceKey = sourceWrapper?.dataset?.instanceKey || window.__activeInstanceKey || '';
    bulkBaselineTargetModuleKey = BULK_BASELINE_MODULE_CONFIG[moduleKey] ? moduleKey : 'app';

    const controls = getBulkBaselineControls();
    if (!controls.modal) return;
    if (controls.title) controls.title.textContent = getBulkBaselineModuleConfig().title;
    setBulkBaselineError('');
    controls.modal.classList.remove('initially-hidden', 'is-hidden');
    controls.modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => controls.cpu?.focus(), 0);
}

function closeBulkBaselineModal() {
    const { modal } = getBulkBaselineControls();
    if (!modal) return;
    modal.classList.add('initially-hidden');
    modal.setAttribute('aria-hidden', 'true');
    bulkBaselineTargetInstanceKey = '';
    bulkBaselineTargetModuleKey = 'app';
}

function resetBulkBaselineForm() {
    const controls = getBulkBaselineControls();
    ['cpu', 'ram', 'disk', 'cint', 'ipList'].forEach(key => {
        if (controls[key]) controls[key].value = '';
    });
    setBulkBaselineError('');
}

function isValidIpv4Address(value) {
    const parts = String(value || '').trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
        if (!/^\d{1,3}$/.test(part)) return false;
        const number = Number(part);
        return number >= 0 && number <= 255;
    });
}

function parseBulkBaselineIpList(rawValue) {
    const tokens = String(rawValue || '')
        .split(/[\s,;]+/)
        .map(item => item.trim())
        .filter(Boolean);
    const seen = new Set();
    const duplicateIps = [];
    const invalidIps = [];
    const ips = [];

    tokens.forEach(ip => {
        if (!isValidIpv4Address(ip)) {
            invalidIps.push(ip);
            return;
        }
        if (seen.has(ip)) {
            duplicateIps.push(ip);
            return;
        }
        seen.add(ip);
        ips.push(ip);
    });

    return { ips, invalidIps, duplicateIps };
}

function getExistingBaselineIps(moduleKey = bulkBaselineTargetModuleKey) {
    const config = getBulkBaselineModuleConfig(moduleKey);
    return new Set(Array.from(document.querySelectorAll(`#${config.tableBodyId} ${config.selectors.ip}`))
        .map(input => input.value.trim())
        .filter(Boolean));
}

function isBulkReplaceableBaselineSeedRow(row, moduleKey = bulkBaselineTargetModuleKey) {
    if (!row) return false;
    const selectors = getBulkBaselineModuleConfig(moduleKey).selectors;
    const getValue = selector => row.querySelector(selector)?.value?.trim() || '';
    const hasUserData = [
        selectors.ip,
        selectors.cpu,
        selectors.ram,
        selectors.disk,
        selectors.cint
    ].some(selector => getValue(selector) !== '');
    const hasAdminData = getValue('.admin-eval-select') !== '' || getValue('.admin-note') !== '';
    const hasEvidence = row.querySelectorAll('.inline-evidence-img').length > 0;
    return !hasUserData && !hasAdminData && !hasEvidence;
}

function removeBulkReplaceableSeedRows(moduleKey = bulkBaselineTargetModuleKey) {
    const config = getBulkBaselineModuleConfig(moduleKey);
    const baselineTbody = document.getElementById(config.tableBodyId);
    const inputConfigTbody = document.getElementById(config.inputConfigBodyId);
    if (!baselineTbody || baselineTbody.rows.length !== 1) return;
    if (!isBulkReplaceableBaselineSeedRow(baselineTbody.rows[0], moduleKey)) return;

    baselineTbody.rows[0].remove();
    if (inputConfigTbody?.rows?.[0]) inputConfigTbody.rows[0].remove();
}

function setBaselineRowValue(row, selector, value) {
    const input = row?.querySelector(selector);
    if (input) input.value = value;
    return input;
}

function applyBulkBaselineRows() {
    if (bulkBaselineTargetInstanceKey && window.__activeInstanceKey !== bulkBaselineTargetInstanceKey) {
        return runInInstanceContext(bulkBaselineTargetInstanceKey, () => applyBulkBaselineRows());
    }
    const moduleKey = bulkBaselineTargetModuleKey;
    const moduleConfig = getBulkBaselineModuleConfig(moduleKey);

    const role = (getCurrentUser()?.role || '').toLowerCase();
    if (role === 'admin1' || role === 'admin2') {
        showToast('Chỉ user mới có thể nhập hàng loạt Server tham chiếu.', 'warning');
        return;
    }

    const controls = getBulkBaselineControls();
    if (!controls.modal) return;
    setBulkBaselineError('');

    const requiredFields = [
        { key: 'cpu', label: 'CPU' },
        { key: 'ram', label: 'RAM' },
        { key: 'disk', label: 'Disk' },
        { key: 'cint', label: 'Cint_rate' },
        { key: 'ipList', label: 'Danh sách IP' }
    ];
    for (const item of requiredFields) {
        if (!controls[item.key]?.value?.trim()) {
            setBulkBaselineError(`Vui lòng nhập ${item.label}.`, controls[item.key]);
            return;
        }
    }

    const numericFields = [
        { key: 'ram', label: 'RAM' },
        { key: 'disk', label: 'Disk' },
        { key: 'cint', label: 'Cint_rate' }
    ];
    for (const item of numericFields) {
        const value = Number(controls[item.key].value);
        if (!Number.isFinite(value) || value < 0) {
            setBulkBaselineError(`${item.label} phải là số không âm.`, controls[item.key]);
            return;
        }
    }

    const parsed = parseBulkBaselineIpList(controls.ipList.value);
    if (parsed.invalidIps.length > 0) {
        setBulkBaselineError(`IP không hợp lệ: ${parsed.invalidIps.slice(0, 5).join(', ')}`, controls.ipList);
        return;
    }
    if (parsed.duplicateIps.length > 0) {
        setBulkBaselineError(`Danh sách IP bị trùng: ${parsed.duplicateIps.slice(0, 5).join(', ')}`, controls.ipList);
        return;
    }
    if (parsed.ips.length === 0) {
        setBulkBaselineError('Vui lòng nhập ít nhất một IP hợp lệ.', controls.ipList);
        return;
    }

    const existingIps = getExistingBaselineIps(moduleKey);
    const duplicatedExistingIps = parsed.ips.filter(ip => existingIps.has(ip));
    if (duplicatedExistingIps.length > 0) {
        setBulkBaselineError(`IP đã tồn tại trong bảng: ${duplicatedExistingIps.slice(0, 5).join(', ')}`, controls.ipList);
        return;
    }

    removeBulkReplaceableSeedRows(moduleKey);

    parsed.ips.forEach(ip => {
        const row = moduleConfig.addRow();
        if (!row) return;
        const selectors = moduleConfig.selectors;

        const ipInput = setBaselineRowValue(row, selectors.ip, ip);
        setBaselineRowValue(row, selectors.cpu, controls.cpu.value.trim());
        setBaselineRowValue(row, selectors.ram, controls.ram.value);
        setBaselineRowValue(row, selectors.disk, controls.disk.value);
        setBaselineRowValue(row, selectors.cint, controls.cint.value);

        if (ipInput) moduleConfig.syncIp(ipInput);
        moduleConfig.recalculateRow(row);
    });

    moduleConfig.updateAfterApply();
    refreshSizingRequiredMarkers(document.getElementById('page-sizing'));
    applyRolePermissions();

    showToast(`Đã tạo ${parsed.ips.length} dòng ${moduleConfig.successLabel}.`, 'success');
    resetBulkBaselineForm();
    closeBulkBaselineModal();
}

// 6. Helper: Đổi màu xanh/đỏ cho ô Admin Select
function styleAdminSelect(select) {
    select.classList.remove('ok-status', 'nok-status');
    if (select.value === 'OK') select.classList.add('ok-status');
    if (select.value === 'NOK') select.classList.add('nok-status');
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
    refreshStorageIpDropdowns('app');
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
    if (rows.length === 0) {
        showToast("Vui lòng thêm ít nhất một Server tham chiếu!", 'warning');
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
        const inputs = row.querySelectorAll('textarea, input');

        // Rule 1: User bắt buộc chọn Module
        if (!moduleSel.value) {
            moduleSel.classList.add('input-error');
            isValid = false;
            if (!firstError) firstError = moduleSel;
        }

        // Rule 2: Admin bắt buộc phải đánh giá (OK/NOK)
        if (!adminEval.value) {
            adminEval.classList.add('input-error');
            isValid = false;
            if (!firstError) firstError = adminEval;
        }

        if (isValid) {
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

    if (!isValid) {
        showToast("KHÔNG THỂ LƯU!\nVui lòng điền các ô bị báo đỏ:\n1. Chọn tên Module.\n2. Admin phải Đánh giá từng dòng.", 'warning');
        if (firstError) firstError.focus();
        return;
    }

    Logger.debug("Dữ liệu chuẩn bị lưu:", dataToSave);
    showToast("✓ Đã lưu cấu hình tham chiếu thành công!", 'success');

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
        scheduleAutoResizeTextBoxes(content);
    }
}

// Collect all baseline/sizing data (USER DATA ONLY - no admin fields)
function collectBaselineTableData() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    const data = [];

    rows.forEach((row, index) => {
        // Collect user data
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            stt: index + 1,
            ip: row.querySelector('.ip-input')?.value || '',
            cpu: row.querySelector('.cpu-input')?.value || '',
            ram: row.querySelector('.ram-input')?.value || '',
            disk: row.querySelector('.disk-input')?.value || '',
            cintRate: row.querySelector('.cint-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages
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
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            stt: index + 1,
            ip: row.querySelector('.ip-config-input')?.value || '',
            cpuLoad: row.querySelector('.cpu-load-input')?.value || '',
            ramLoad: row.querySelector('.ram-load-input')?.value || '',
            cintUsed: row.querySelector('.cint-used-input')?.value || '',
            ramUsed: row.querySelector('.ram-used-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
            adminEval: row.querySelector('.input-config-eval')?.value || '',
            adminNote: row.querySelector('.input-config-note')?.value || ''
        });
    });

    return data;
}

function collectStorageInputTableData() {
    const rows = document.querySelectorAll('#storage-input-table-body tr');
    const data = [];

    rows.forEach((row, index) => {
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            stt: index + 1,
            ip: row.querySelector('.storage-ip-input')?.value || '',
            partition: row.querySelector('.storage-partition-input')?.value || '',
            used: row.querySelector('.storage-used-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
            note: row.querySelector('.storage-note-input')?.value || '',
            adminEval: row.querySelector('.storage-eval')?.value || '',
            adminNote: row.querySelector('.storage-admin-note')?.value || ''
        });
    });

    return data;
}

function collectStorageAdminReviewData() {
    const rows = document.querySelectorAll('#storage-input-table-body tr');
    const data = [];

    rows.forEach((row, index) => {
        data.push({
            rowIndex: index,
            eval: row.querySelector('.storage-eval')?.value || '',
            note: row.querySelector('.storage-admin-note')?.value || ''
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
    const instances = getModuleInstancesFromArchTable();
    const moduleInstances = [];

    const collectByTypeInContext = (moduleType) => {
        if (moduleType === 'App') {
            const container = document.getElementById('sizing-result-container');
            if (container) syncTextareasInContainer(container);
            const customProposalTable = collectAppCustomProposalTableData(container);
            const selectedProposalSource = normalizeAppProposalSource(getAppSelectedProposalSource(container), customProposalTable);
            return {
                baselineTable: collectBaselineTableData(),
                inputConfigTable: collectInputConfigTableData(),
                storageInputTable: collectStorageInputTableData(),
                selectedInputRow: document.getElementById('app-input-row-select')?.value || '',
                selectedInputRowLabel: getSelectedInputRowLabel('app-input-row-select'),
                pocValue: document.getElementById('poc-value')?.value || '',
                sizingValue: document.getElementById('sizing-value')?.value || '',
                virtualizationMode: document.getElementById('app-virtualization-mode')?.value || 'ram',
                vcpuFlavor: document.getElementById('app-vcpu-flavor')?.value || '8',
                ramFlavor: document.getElementById('app-ram-flavor')?.value || '32',
                flavorEval: document.getElementById('app-flavor-eval')?.value || '',
                flavorNote: document.getElementById('app-flavor-note')?.value || '',
                selectedProposalSource,
                customProposalTable,
                sizingResult: container?.innerHTML || ''
            };
        }
        if (moduleType === 'MariaDB') return collectMariaDBData();
        if (moduleType === 'Redis') return collectRedisData();
        if (moduleType === 'Kafka') return collectKafkaData();
        if (moduleType === 'K8S') return collectK8SData();
        if (moduleType === 'LB/FW') return collectLBFWData();
        if (moduleType === 'Khác') return collectCustomModuleData();
        return {};
    };

    instances.forEach(instance => {
        const instanceKey = getModuleInstanceKey(instance);
        const data = runInInstanceContext(instanceKey, () => collectByTypeInContext(instance.moduleType));
        moduleInstances.push({
            instanceKey,
            moduleType: instance.moduleType,
            moduleName: instance.moduleName || '',
            sequence: instance.sequence,
            data
        });
    });

    const firstByType = {};
    moduleInstances.forEach(item => {
        if (!firstByType[item.moduleType]) {
            firstByType[item.moduleType] = item.data;
        }
    });

    const moduleInstanceSnapshots = Array.from(document.querySelectorAll('.module-instance-wrapper')).map(wrapper => ({
        instanceKey: wrapper.dataset.instanceKey || '',
        moduleType: wrapper.dataset.moduleType || '',
        html: wrapper.innerHTML,
        controlStates: captureFormControlStates(wrapper)
    }));

    return {
        moduleApp: firstByType.App || {},
        moduleMariaDB: firstByType.MariaDB || {},
        moduleRedis: firstByType.Redis || {},
        moduleKafka: firstByType.Kafka || {},
        moduleK8S: firstByType.K8S || {},
        moduleLBFW: firstByType['LB/FW'] || {},
        moduleCustom: firstByType['Khác'] || {},
        moduleInstances,
        moduleInstanceSnapshots
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
    const instances = getModuleInstancesFromArchTable();
    const moduleInstanceReviews = [];

    const collectReviewByTypeInContext = (moduleType) => {
        if (moduleType === 'App') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-app')?.value || '',
                    note: document.getElementById('note-module-app')?.value || ''
                },
                baselineRowReviews: collectBaselineAdminReviewData(),
                inputConfigRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#input-config-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.input-config-eval')?.value || '',
                            note: row.querySelector('.input-config-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                storageRowReviews: collectStorageAdminReviewData(),
                flavorReview: {
                    eval: document.getElementById('app-flavor-eval')?.value || '',
                    note: document.getElementById('app-flavor-note')?.value || ''
                }
            };
        }
        if (moduleType === 'MariaDB') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-mariadb')?.value || '',
                    note: document.getElementById('note-module-mariadb')?.value || ''
                },
                refRowReviews: collectMariaDBRefAdminReviewData(),
                storageReview: {
                    eval: document.getElementById('eval-mariadb-storage')?.value || '',
                    note: document.getElementById('note-mariadb-storage')?.value || ''
                }
            };
        }
        if (moduleType === 'Redis') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-redis')?.value || '',
                    note: document.getElementById('note-module-redis')?.value || ''
                },
                keyMethodReview: {
                    eval: document.getElementById('eval-redis-key-method')?.value || '',
                    note: document.getElementById('note-redis-key-method')?.value || ''
                },
                configMethodReview: {
                    eval: document.getElementById('eval-redis-config-method')?.value || '',
                    note: document.getElementById('note-redis-config-method')?.value || ''
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
            };
        }
        if (moduleType === 'Kafka') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-kafka')?.value || '',
                    note: document.getElementById('note-module-kafka')?.value || ''
                },
                throughputMethodReview: {
                    eval: document.getElementById('eval-kafka-throughput-method')?.value || '',
                    note: document.getElementById('note-kafka-throughput-method')?.value || ''
                },
                linearMethodReview: {
                    eval: document.getElementById('eval-kafka-linear-method')?.value || '',
                    note: document.getElementById('note-kafka-linear-method')?.value || ''
                },
                linearRowReviews: (() => {
                    const reviews = [];
                    getKafkaLinearRows().forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.kafka-linear-eval')?.value || '',
                            note: row.querySelector('.kafka-linear-note')?.value || ''
                        });
                    });
                    return reviews;
                })()
            };
        }
        if (moduleType === 'K8S') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-k8s')?.value || '',
                    note: document.getElementById('note-module-k8s')?.value || ''
                },
                baselineRowReviews: (() => {
                    const reviews = [];
                    getK8SBaselineRows().forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.k8s-baseline-eval')?.value || '',
                            note: row.querySelector('.k8s-baseline-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                inputConfigRowReviews: (() => {
                    const reviews = [];
                    getK8SInputConfigRows().forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.k8s-input-config-eval')?.value || '',
                            note: row.querySelector('.k8s-input-config-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                storageRowReviews: collectK8SStorageAdminReviewData(),
                flavorReview: {
                    eval: document.getElementById('k8s-flavor-eval')?.value || '',
                    note: document.getElementById('k8s-flavor-note')?.value || ''
                }
            };
        }
        if (moduleType === 'LB/FW') {
            return {
                linearMethodReview: {
                    eval: document.getElementById('eval-lbfw-linear-method')?.value || '',
                    note: document.getElementById('note-lbfw-linear-method')?.value || ''
                },
                customMethodReview: {
                    eval: document.getElementById('eval-lbfw-custom-method')?.value || '',
                    note: document.getElementById('note-lbfw-custom-method')?.value || ''
                },
                proposalRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#lbfw-custom-proposal-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.lbfw-custom-proposal-eval')?.value || '',
                            note: row.querySelector('.lbfw-custom-proposal-admin-note')?.value || ''
                        });
                    });
                    return reviews;
                })()
            };
        }
        if (moduleType === 'K8S') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-k8s')?.value || '',
                    note: document.getElementById('note-module-k8s')?.value || ''
                },
                baselineRowReviews: collectK8SBaselineAdminReviewData(),
                inputConfigRowReviews: collectK8SInputConfigAdminReviewData(),
                storageRowReviews: collectK8SStorageAdminReviewData(),
                flavorReview: {
                    eval: document.getElementById('k8s-flavor-eval')?.value || '',
                    note: document.getElementById('k8s-flavor-note')?.value || ''
                }
            };
        }
        if (moduleType === 'Khác') {
            return {
                linearMethodReview: {
                    eval: document.getElementById('eval-custom-linear-method')?.value || '',
                    note: document.getElementById('note-custom-linear-method')?.value || ''
                },
                customMethodReview: {
                    eval: document.getElementById('eval-custom-method')?.value || '',
                    note: document.getElementById('note-custom-method')?.value || ''
                },
                baselineRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#custom-baseline-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.admin-eval-select')?.value || '',
                            note: row.querySelector('.admin-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                inputConfigRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#custom-input-config-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.custom-input-config-eval')?.value || '',
                            note: row.querySelector('.custom-input-config-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                storageRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#custom-storage-input-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.custom-storage-eval')?.value || '',
                            note: row.querySelector('.custom-storage-admin-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                proposalRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#custom-proposal-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.custom-proposal-eval')?.value || '',
                            note: row.querySelector('.custom-proposal-admin-note')?.value || ''
                        });
                    });
                    return reviews;
                })()
            };
        }
        return {};
    };

    instances.forEach(instance => {
        const instanceKey = getModuleInstanceKey(instance);
        const reviewData = runInInstanceContext(instanceKey, () => collectReviewByTypeInContext(instance.moduleType));
        moduleInstanceReviews.push({
            instanceKey,
            moduleType: instance.moduleType,
            moduleName: instance.moduleName || '',
            sequence: instance.sequence,
            reviewData
        });
    });

    const firstByType = {};
    moduleInstanceReviews.forEach(item => {
        if (!firstByType[item.moduleType]) {
            firstByType[item.moduleType] = item.reviewData;
        }
    });

    return {
        moduleApp: firstByType.App || {},
        moduleMariaDB: firstByType.MariaDB || {},
        moduleRedis: firstByType.Redis || {},
        moduleKafka: firstByType.Kafka || {},
        moduleK8S: firstByType.K8S || {},
        moduleLBFW: firstByType['LB/FW'] || {},
        moduleCustom: firstByType['Khác'] || {},
        moduleInstanceReviews
    };
}

const collectSizingAdminReviewDataLegacy = collectSizingAdminReviewData;
collectSizingAdminReviewData = function () {
    const raw = collectSizingAdminReviewDataLegacy();
    if (!raw || !Array.isArray(raw.moduleInstanceReviews)) return raw;

    const pruneReviewData = (moduleType, reviewData = {}) => {
        if (!reviewData || typeof reviewData !== 'object') return {};

        if (moduleType === 'Redis') {
            const selectedMethod = document.getElementById('redis-method-key')?.classList.contains('active') ? 'key' : 'config';
            return selectedMethod === 'key'
                ? {
                    overallReview: reviewData.overallReview || {},
                    keyMethodReview: reviewData.keyMethodReview || {}
                }
                : {
                    overallReview: reviewData.overallReview || {},
                    configMethodReview: reviewData.configMethodReview || {},
                    configRowReviews: reviewData.configRowReviews || []
                };
        }

        if (moduleType === 'Kafka') {
            const selectedMethod = document.getElementById('kafka-method-throughput')?.classList.contains('active') ? 'throughput' : 'linear';
            return selectedMethod === 'throughput'
                ? {
                    overallReview: reviewData.overallReview || {},
                    throughputMethodReview: reviewData.throughputMethodReview || {}
                }
                : {
                    overallReview: reviewData.overallReview || {},
                    linearMethodReview: reviewData.linearMethodReview || {},
                    linearRowReviews: reviewData.linearRowReviews || []
                };
        }

        if (moduleType === 'LB/FW') {
            const selectedMethod = document.getElementById('lbfw-method-select')?.value || 'bandwidthMethod';
            return selectedMethod === 'customMethod'
                ? {
                    customMethodReview: reviewData.customMethodReview || {},
                    proposalRowReviews: reviewData.proposalRowReviews || []
                }
                : {
                    linearMethodReview: reviewData.linearMethodReview || {}
                };
        }

        if (moduleType === 'Khác' || moduleType === 'KhÃ¡c') {
            const selectedMethod = document.getElementById('custom-method-select')?.value || 'linearEquivalentApp';
            return selectedMethod === 'customMethod'
                ? {
                    customMethodReview: reviewData.customMethodReview || {},
                    proposalRowReviews: reviewData.proposalRowReviews || []
                }
                : {
                    linearMethodReview: reviewData.linearMethodReview || {},
                    baselineRowReviews: reviewData.baselineRowReviews || [],
                    inputConfigRowReviews: reviewData.inputConfigRowReviews || [],
                    storageRowReviews: reviewData.storageRowReviews || []
                };
        }

        return reviewData;
    };

    const moduleInstanceReviews = raw.moduleInstanceReviews.map(item => ({
        ...item,
        reviewData: pruneReviewData(item.moduleType, item.reviewData || {})
    }));

    const firstByType = {};
    moduleInstanceReviews.forEach(item => {
        if (!firstByType[item.moduleType]) {
            firstByType[item.moduleType] = item.reviewData;
        }
    });

    return {
        moduleApp: firstByType.App || {},
        moduleMariaDB: firstByType.MariaDB || {},
        moduleRedis: firstByType.Redis || {},
        moduleKafka: firstByType.Kafka || {},
        moduleK8S: firstByType.K8S || {},
        moduleLBFW: firstByType['LB/FW'] || {},
        moduleCustom: firstByType['Khác'] || firstByType['KhÃ¡c'] || {},
        moduleInstanceReviews
    };
};

// Save all sizing data to database
async function saveSizingData() {
    if (!currentProjectId) {
        showToast('Vui lòng tạo hoặc chọn dự án trước!', 'warning');
        return;
    }

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role === 'admin1' || role === 'admin2') {
        showToast('Admin không được phép lưu dữ liệu người dùng. Chỉ được phép đánh giá!', 'warning');
        return;
    }

    try {
        try { aggregateSizingResults({ resetManualDeletes: true }); } catch (e) { }
        const sizingData = collectAllSizingData();
        const summaryData = collectTongHop();

        const response = await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dinhCoHeThongContent: JSON.stringify(sizingData),
                tongHopVaDeXuatContent: JSON.stringify(summaryData)
            })
        });

        if (response.ok) {
            // Cập nhật trạng thái dự án dựa trên role
            if (role === 'user' || !role) {
                await updateProjectStatus('user_edit');
            }

            showToast('✓ Đã lưu dữ liệu Định cỡ hệ thống thành công!', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(errorText || 'Lỗi server');
        }
    } catch (error) {
        Logger.error('Error saving sizing data:', error);
        showToast('Lỗi khi lưu dữ liệu: ' + error.message, 'error');
    }
}

// Evaluate sizing section (Admin only)
async function evaluateSizingSection() {
    if (!currentProjectId) {
        showToast('Vui lòng chọn dự án trước!', 'warning');
        return;
    }

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin1' && role !== 'admin2') {
        showToast('Chỉ Admin mới được phép đánh giá!', 'warning');
        return;
    }

    try {
        // Collect all admin review data using the new function
        const adminData = collectSizingAdminReviewData();

        const hasEvaluationValue = (obj) => {
            if (obj == null) return false;
            if (Array.isArray(obj)) return obj.some(hasEvaluationValue);
            if (typeof obj === 'object') {
                if (typeof obj.eval === 'string' && obj.eval.trim() !== '') return true;
                return Object.values(obj).some(hasEvaluationValue);
            }
            return false;
        };

        if (!hasEvaluationValue(adminData)) {
            showToast('Vui lòng chọn đánh giá (OK/NOK) cho ít nhất một mục!', 'warning');
            return;
        }

        const response = await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                section: 'sizing',
                reviewJson: JSON.stringify(adminData)
            })
        });

        if (response.ok) {
            // Cập nhật trạng thái dự án (admin review)
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
            }

            showToast('✓ Đã lưu đánh giá Định cỡ hệ thống thành công!', 'success');
            // reload data to reflect saved admin review
            await loadAllDataFromDB();
        } else {
            const errorText = await response.text();
            throw new Error(errorText || 'Lỗi server');
        }
    } catch (error) {
        Logger.error('Error evaluating sizing:', error);
        showToast('Lỗi khi lưu đánh giá: ' + error.message, 'error');
    }
}

function loadAppSizingModuleData(moduleApp) {
    if (!moduleApp) return;

    const baselineTbody = document.getElementById('baseline-table-body');
    const inputConfigTbody = document.getElementById('input-config-table-body');
    const storageTbody = document.getElementById('storage-input-table-body');

    if (baselineTbody) baselineTbody.innerHTML = '';
    if (inputConfigTbody) inputConfigTbody.innerHTML = '';
    if (storageTbody) storageTbody.innerHTML = '';

    if (moduleApp.baselineTable && Array.isArray(moduleApp.baselineTable) && moduleApp.baselineTable.length > 0 && baselineTbody) {
        moduleApp.baselineTable.forEach(row => {
            addBaselineRow();
            const lastRow = baselineTbody.lastElementChild;
            if (!lastRow) return;

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

            const baselineEvidenceImages = getEvidenceImagesFromRowData(row);
            if (baselineEvidenceImages.length > 0) {
                const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                if (evidenceCell) loadInlineEvidence(evidenceCell, baselineEvidenceImages);
            }
        });
    }
    ensureDefaultAppSizingRows();
    updateBaselineTotal();
    refreshStorageIpDropdowns('app');

    if (inputConfigTbody) inputConfigTbody.innerHTML = '';
    if (moduleApp.inputConfigTable && Array.isArray(moduleApp.inputConfigTable) && moduleApp.inputConfigTable.length > 0) {
        moduleApp.inputConfigTable.forEach(row => {
            addInputConfigRow();
            const lastRow = inputConfigTbody.lastElementChild;
            if (!lastRow) return;

            const ipInput = lastRow.querySelector('.ip-config-input');
            const cpuLoadInput = lastRow.querySelector('.cpu-load-input');
            const ramLoadInput = lastRow.querySelector('.ram-load-input');
            const cintUsedInput = lastRow.querySelector('.cint-used-input');
            const ramUsedInput = lastRow.querySelector('.ram-used-input');
            if (ipInput) ipInput.value = row.ip || '';
            if (cpuLoadInput) cpuLoadInput.value = row.cpuLoad || '';
            if (ramLoadInput) ramLoadInput.value = row.ramLoad || '';
            if (cintUsedInput) cintUsedInput.value = row.cintUsed || '';
            if (ramUsedInput) ramUsedInput.value = row.ramUsed || '';

            const inputCfgEvidenceImages = getEvidenceImagesFromRowData(row);
            if (inputCfgEvidenceImages.length > 0) {
                const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                if (evidenceCell) loadInlineEvidence(evidenceCell, inputCfgEvidenceImages);
            }

            const evalSelect = lastRow.querySelector('.input-config-eval');
            const noteInput = lastRow.querySelector('.input-config-note');
            if (evalSelect && row.adminEval) {
                evalSelect.value = row.adminEval;
                styleAdminSelect(evalSelect);
            }
            if (noteInput && row.adminNote) noteInput.value = row.adminNote;
        });
    }
    updateInputConfigTotal();

    if (storageTbody) storageTbody.innerHTML = '';
    if (moduleApp.storageInputTable && Array.isArray(moduleApp.storageInputTable) && moduleApp.storageInputTable.length > 0) {
        moduleApp.storageInputTable.forEach(row => {
            addStorageInputRow();
            const lastRow = storageTbody.lastElementChild;
            if (!lastRow) return;

            const ipInput = lastRow.querySelector('.storage-ip-input');
            const partitionInput = lastRow.querySelector('.storage-partition-input');
            const usedInput = lastRow.querySelector('.storage-used-input');
            const noteInput = lastRow.querySelector('.storage-note-input');
            const evalSelect = lastRow.querySelector('.storage-eval');
            const adminNoteInput = lastRow.querySelector('.storage-admin-note');

            setStorageIpSelectValue(ipInput, 'app', row.ip || '');
            if (partitionInput) partitionInput.value = row.partition || '';
            if (usedInput) usedInput.value = row.used || '';
            const storageEvidenceImages = getEvidenceImagesFromRowData(row);
            if (storageEvidenceImages.length > 0) {
                const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                if (evidenceCell) loadInlineEvidence(evidenceCell, storageEvidenceImages);
            }
            if (noteInput) noteInput.value = row.note || '';
            if (evalSelect && row.adminEval) {
                evalSelect.value = row.adminEval;
                styleAdminSelect(evalSelect);
            }
            if (adminNoteInput) adminNoteInput.value = row.adminNote || '';
        });
    }
    ensureDefaultAppSizingRows();
    refreshStorageIpDropdowns('app');

    if (moduleApp.selectedInputRow !== undefined && moduleApp.selectedInputRow !== '' && document.getElementById('app-input-row-select')) {
        document.getElementById('app-input-row-select').value = moduleApp.selectedInputRow;
        onInputRowSelect(document.getElementById('app-input-row-select'), 'poc-value', 'sizing-value');
    }
    if (document.getElementById('poc-value')) {
        safeSetValue(document.getElementById('poc-value'), moduleApp.pocValue || '');
    }
    if (document.getElementById('sizing-value')) {
        safeSetValue(document.getElementById('sizing-value'), moduleApp.sizingValue || '');
    }

    if (document.getElementById('app-virtualization-mode')) {
        document.getElementById('app-virtualization-mode').value = moduleApp.virtualizationMode || 'ram';
        if (document.getElementById('app-vcpu-flavor')) {
            document.getElementById('app-vcpu-flavor').value = moduleApp.vcpuFlavor || '8';
        }
        if (document.getElementById('app-ram-flavor')) {
            document.getElementById('app-ram-flavor').value = moduleApp.ramFlavor || '32';
        }
        onVirtualizationModeChange('app');
    }
    if (document.getElementById('app-flavor-eval')) {
        document.getElementById('app-flavor-eval').value = moduleApp.flavorEval || '';
        styleAdminSelect(document.getElementById('app-flavor-eval'));
    }
    if (document.getElementById('app-flavor-note')) {
        document.getElementById('app-flavor-note').value = moduleApp.flavorNote || '';
    }

    if (document.getElementById('sizing-result-container')) {
        document.getElementById('sizing-result-container').innerHTML = moduleApp.sizingResult || '';
        ensureAppProposalSelectionUI({
            selectedProposalSource: moduleApp.selectedProposalSource || 'auto',
            customProposalTable: moduleApp.customProposalTable || getEmptyAppCustomProposalTable()
        });
    }

    if (moduleApp.pocValue || moduleApp.sizingValue || moduleApp.sizingResult ||
        (moduleApp.baselineTable && moduleApp.baselineTable.length > 0) ||
        (moduleApp.storageInputTable && moduleApp.storageInputTable.length > 0)) {
        const content = document.getElementById('module-app-content');
        const header = content?.previousElementSibling;
        if (content && !content.classList.contains('expanded')) {
            content.classList.add('expanded');
            if (header) header.classList.add('active');
        }
    }
}

// Load sizing data from database
function loadSizingData(data) {
    if (!data) return;

    try {
        const sizingData = typeof data === 'string' ? JSON.parse(data) : data;
        const instancesByType = getModuleInstancesByType();
        const withFirstInstance = (moduleType, callback) => {
            const firstInstance = (instancesByType[moduleType] || [])[0];
            if (!firstInstance) return;
            return runInInstanceContext(getModuleInstanceKey(firstInstance), callback);
        };

        const hasInstanceSnapshots = Array.isArray(sizingData.moduleInstanceSnapshots) && sizingData.moduleInstanceSnapshots.length > 0;

        if (hasInstanceSnapshots) {
            sizingData.moduleInstanceSnapshots.forEach(snapshot => {
                if (!snapshot || !snapshot.instanceKey) return;
                if (snapshot.moduleType === 'App') return;
                const wrapper = document.querySelector(`.module-instance-wrapper[data-instance-key="${snapshot.instanceKey}"]`);
                if (wrapper && typeof snapshot.html === 'string') {
                    wrapper.innerHTML = snapshot.html;
                    rewriteInlineHandlersForInstance(wrapper, snapshot.instanceKey);
                    applyFormControlStates(wrapper, snapshot.controlStates);
                }
            });
            Logger.debug('Loaded sizing data from module instance snapshots successfully');

            // Call onCustomMethodChanged for each Khác instance
            sizingData.moduleInstanceSnapshots.forEach(snapshot => {
                if (!snapshot || !snapshot.instanceKey) return;
                if (snapshot.moduleType !== 'Khác' && snapshot.moduleType !== 'KhÃ¡c') return;

                const wrapper = document.querySelector(`.module-instance-wrapper[data-instance-key="${snapshot.instanceKey}"]`);
                if (!wrapper) return;

                const select = wrapper.querySelector('#custom-method-select, [id^="custom-method-select__inst_"]');
                if (select) {
                    onCustomMethodChanged(select);
                }
            });

            // Call onLBFWMethodChanged for each LB/FW instance
            sizingData.moduleInstanceSnapshots.forEach(snapshot => {
                if (!snapshot || !snapshot.instanceKey) return;
                if (snapshot.moduleType !== 'LB/FW') return;

                const wrapper = document.querySelector(`.module-instance-wrapper[data-instance-key="${snapshot.instanceKey}"]`);
                if (!wrapper) return;

                const select = wrapper.querySelector('#lbfw-method-select, [id^="lbfw-method-select__inst_"]');
                if (select) {
                    onLBFWMethodChanged(select);
                }
            });
        }

        // Load Module App data
        if (sizingData.moduleApp) {
            const appInstanceData = Array.isArray(sizingData.moduleInstances)
                ? sizingData.moduleInstances.filter(item => item?.moduleType === 'App' && item.instanceKey)
                : [];
            if (appInstanceData.length > 0) {
                appInstanceData.forEach(item => {
                    runInInstanceContext(item.instanceKey, () => loadAppSizingModuleData(item.data || {}));
                });
            } else {
                withFirstInstance('App', () => loadAppSizingModuleData(sizingData.moduleApp));
            }
        }

        if (hasInstanceSnapshots) {
        try { populatePocSizingDropdowns(); } catch (e) { }
        try { refreshSizingRequiredMarkers(); } catch (e) { }
        try { applyRolePermissions(); } catch (e) { }
        return;
        }

        // Load Module MariaDB data
        if (sizingData.moduleMariaDB) {
            withFirstInstance('MariaDB', () => loadMariaDBData(sizingData.moduleMariaDB));

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
            withFirstInstance('Redis', () => loadRedisData(sizingData.moduleRedis));

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
            withFirstInstance('Kafka', () => loadKafkaData(sizingData.moduleKafka));

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

        // Load Module K8S data
        if (sizingData.moduleK8S) {
            withFirstInstance('K8S', () => loadK8SData(sizingData.moduleK8S));
        }

        // Load Module LB/FW data
        if (sizingData.moduleLBFW) {
            withFirstInstance('LB/FW', () => loadLBFWData(sizingData.moduleLBFW));
        }

        // Load Module Khác data
        if (sizingData.moduleCustom) {
            withFirstInstance('Khác', () => loadCustomModuleData(sizingData.moduleCustom));
        }

        // Re-apply role permissions after loading data (disable admin fields for user, etc.)
        applyRolePermissions();

        Logger.debug('Loaded sizing data successfully');
    } catch (e) {
        Logger.error('Error loading sizing data:', e);
    }
}

// Load sizing admin review from separate column
function loadSizingAdminReview(adminReview) {
    if (!adminReview) return;

    try {
        if (Array.isArray(adminReview.moduleInstanceReviews) && adminReview.moduleInstanceReviews.length > 0) {
            adminReview.moduleInstanceReviews.forEach(item => {
                if (!item || !item.instanceKey) return;
                const legacyReview = {};
                if (item.moduleType === 'App') legacyReview.moduleApp = item.reviewData || {};
                if (item.moduleType === 'MariaDB') legacyReview.moduleMariaDB = item.reviewData || {};
                if (item.moduleType === 'Redis') legacyReview.moduleRedis = item.reviewData || {};
                if (item.moduleType === 'Kafka') legacyReview.moduleKafka = item.reviewData || {};
                if (item.moduleType === 'K8S') legacyReview.moduleK8S = item.reviewData || {};
                if (item.moduleType === 'LB/FW') legacyReview.moduleLBFW = item.reviewData || {};
                if (item.moduleType === 'Khác') legacyReview.moduleCustom = item.reviewData || {};
                legacyReview.__skipInstanceMapping = true;
                runInInstanceContext(item.instanceKey, () => loadSizingAdminReview(legacyReview));
            });
            applyRolePermissions();
            Logger.debug('Loaded sizing admin review by module instances successfully');
            return;
        }

        const instancesByType = getModuleInstancesByType();
        const firstInstanceKey = (moduleType) => {
            const first = (instancesByType[moduleType] || [])[0];
            return first ? getModuleInstanceKey(first) : '';
        };
        const legacyMappedReviews = [];
        const appKey = firstInstanceKey('App');
        if (adminReview.moduleApp && appKey) legacyMappedReviews.push({ instanceKey: appKey, moduleType: 'App', reviewData: adminReview.moduleApp });
        const mariaKey = firstInstanceKey('MariaDB');
        if (adminReview.moduleMariaDB && mariaKey) legacyMappedReviews.push({ instanceKey: mariaKey, moduleType: 'MariaDB', reviewData: adminReview.moduleMariaDB });
        const redisKey = firstInstanceKey('Redis');
        if (adminReview.moduleRedis && redisKey) legacyMappedReviews.push({ instanceKey: redisKey, moduleType: 'Redis', reviewData: adminReview.moduleRedis });
        const kafkaKey = firstInstanceKey('Kafka');
        if (adminReview.moduleKafka && kafkaKey) legacyMappedReviews.push({ instanceKey: kafkaKey, moduleType: 'Kafka', reviewData: adminReview.moduleKafka });
        const k8sKey = firstInstanceKey('K8S');
        if (adminReview.moduleK8S && k8sKey) legacyMappedReviews.push({ instanceKey: k8sKey, moduleType: 'K8S', reviewData: adminReview.moduleK8S });
        const lbfwKey = firstInstanceKey('LB/FW');
        if (adminReview.moduleLBFW && lbfwKey) legacyMappedReviews.push({ instanceKey: lbfwKey, moduleType: 'LB/FW', reviewData: adminReview.moduleLBFW });

        if (!adminReview.__skipInstanceMapping && legacyMappedReviews.length > 0) {
            loadSizingAdminReview({ moduleInstanceReviews: legacyMappedReviews, __skipInstanceMapping: true });
            return;
        }

        // Load module app admin review
        if (adminReview.moduleApp) {
            if (adminReview.moduleApp.overallReview) {
                const moduleReview = adminReview.moduleApp.overallReview;
                if (document.getElementById('eval-module-app')) {
                    document.getElementById('eval-module-app').value = moduleReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-app'));
                }
                if (document.getElementById('note-module-app')) {
                    document.getElementById('note-module-app').value = moduleReview.note || '';
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

            if (adminReview.moduleApp.storageRowReviews) {
                const rows = document.querySelectorAll('#storage-input-table-body tr');
                adminReview.moduleApp.storageRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.storage-eval');
                        const adminNote = rows[index].querySelector('.storage-admin-note');
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

            if (adminReview.moduleApp.flavorReview) {
                const flavorReview = adminReview.moduleApp.flavorReview;
                const evalEl = document.getElementById('app-flavor-eval');
                const noteEl = document.getElementById('app-flavor-note');
                if (evalEl) {
                    evalEl.value = flavorReview.eval || '';
                    styleAdminSelect(evalEl);
                }
                if (noteEl) noteEl.value = flavorReview.note || '';
            }
        }

        // Load module MariaDB admin review
        if (adminReview.moduleMariaDB) {
            // Load overall module evaluation
            if (adminReview.moduleMariaDB.overallReview) {
                const moduleReview = adminReview.moduleMariaDB.overallReview;
                if (document.getElementById('eval-module-mariadb')) {
                    document.getElementById('eval-module-mariadb').value = moduleReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-mariadb'));
                }
                if (document.getElementById('note-module-mariadb')) {
                    document.getElementById('note-module-mariadb').value = moduleReview.note || '';
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
                const moduleReview = adminReview.moduleRedis.overallReview;
                if (document.getElementById('eval-module-redis')) {
                    document.getElementById('eval-module-redis').value = moduleReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-redis'));
                }
                if (document.getElementById('note-module-redis')) {
                    document.getElementById('note-module-redis').value = moduleReview.note || '';
                }
            }

            // Load key method review
            if (adminReview.moduleRedis.keyMethodReview) {
                const keyReview = adminReview.moduleRedis.keyMethodReview;
                if (document.getElementById('eval-redis-key-method')) {
                    document.getElementById('eval-redis-key-method').value = keyReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-redis-key-method'));
                }
                if (document.getElementById('note-redis-key-method')) {
                    document.getElementById('note-redis-key-method').value = keyReview.note || '';
                }
            }

            // Load config method review
            if (adminReview.moduleRedis.configMethodReview) {
                const configReview = adminReview.moduleRedis.configMethodReview;
                if (document.getElementById('eval-redis-config-method')) {
                    document.getElementById('eval-redis-config-method').value = configReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-redis-config-method'));
                }
                if (document.getElementById('note-redis-config-method')) {
                    document.getElementById('note-redis-config-method').value = configReview.note || '';
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
                const moduleReview = adminReview.moduleKafka.overallReview;
                if (document.getElementById('eval-module-kafka')) {
                    document.getElementById('eval-module-kafka').value = moduleReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-kafka'));
                }
                if (document.getElementById('note-module-kafka')) {
                    document.getElementById('note-module-kafka').value = moduleReview.note || '';
                }
            }

            // Load throughput method review
            if (adminReview.moduleKafka.throughputMethodReview) {
                const throughputReview = adminReview.moduleKafka.throughputMethodReview;
                if (document.getElementById('eval-kafka-throughput-method')) {
                    document.getElementById('eval-kafka-throughput-method').value = throughputReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-kafka-throughput-method'));
                }
                if (document.getElementById('note-kafka-throughput-method')) {
                    document.getElementById('note-kafka-throughput-method').value = throughputReview.note || '';
                }
            }

            // Load linear method review
            if (adminReview.moduleKafka.linearMethodReview) {
                const linearReview = adminReview.moduleKafka.linearMethodReview;
                if (document.getElementById('eval-kafka-linear-method')) {
                    document.getElementById('eval-kafka-linear-method').value = linearReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-kafka-linear-method'));
                }
                if (document.getElementById('note-kafka-linear-method')) {
                    document.getElementById('note-kafka-linear-method').value = linearReview.note || '';
                }
            }

            // Load Kafka linear row reviews
            if (adminReview.moduleKafka.linearRowReviews) {
                const rows = getKafkaLinearRows();
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

        // Load module K8S admin review
        if (adminReview.moduleK8S) {
            // Load overall module evaluation
            if (adminReview.moduleK8S.overallReview) {
                const moduleReview = adminReview.moduleK8S.overallReview;
                if (document.getElementById('eval-module-k8s')) {
                    document.getElementById('eval-module-k8s').value = moduleReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-k8s'));
                }
                if (document.getElementById('note-module-k8s')) {
                    document.getElementById('note-module-k8s').value = moduleReview.note || '';
                }
            }

            if (adminReview.moduleK8S.baselineRowReviews) {
                const rows = getK8SBaselineRows();
                adminReview.moduleK8S.baselineRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.k8s-baseline-eval');
                        const adminNote = rows[index].querySelector('.k8s-baseline-note');
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
            if (adminReview.moduleK8S.inputConfigRowReviews) {
                const rows = getK8SInputConfigRows();
                adminReview.moduleK8S.inputConfigRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.k8s-input-config-eval');
                        const adminNote = rows[index].querySelector('.k8s-input-config-note');
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
            if (adminReview.moduleK8S.storageRowReviews) {
                const rows = document.querySelectorAll('#k8s-storage-input-table-body tr');
                adminReview.moduleK8S.storageRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.k8s-storage-eval');
                        const adminNote = rows[index].querySelector('.k8s-storage-admin-note');
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

            if (adminReview.moduleK8S.flavorReview) {
                const flavorReview = adminReview.moduleK8S.flavorReview;
                const evalEl = document.getElementById('k8s-flavor-eval');
                const noteEl = document.getElementById('k8s-flavor-note');
                if (evalEl) {
                    evalEl.value = flavorReview.eval || '';
                    styleAdminSelect(evalEl);
                }
                if (noteEl) noteEl.value = flavorReview.note || '';
            }
        }

        // Load module LB/FW admin review
        if (adminReview.moduleLBFW) {
            const linearReview = adminReview.moduleLBFW.linearMethodReview || adminReview.moduleLBFW.overallReview;
            if (linearReview) {
                if (document.getElementById('eval-lbfw-linear-method')) {
                    document.getElementById('eval-lbfw-linear-method').value = linearReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-lbfw-linear-method'));
                }
                if (document.getElementById('note-lbfw-linear-method')) {
                    document.getElementById('note-lbfw-linear-method').value = linearReview.note || '';
                }
            }

            if (adminReview.moduleLBFW.customMethodReview) {
                ensureLBFWCustomMethodUI();
                const customMethodReview = adminReview.moduleLBFW.customMethodReview;
                if (document.getElementById('eval-lbfw-custom-method')) {
                    document.getElementById('eval-lbfw-custom-method').value = customMethodReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-lbfw-custom-method'));
                }
                if (document.getElementById('note-lbfw-custom-method')) {
                    document.getElementById('note-lbfw-custom-method').value = customMethodReview.note || '';
                }
            }

            if (adminReview.moduleLBFW.proposalRowReviews) {
                ensureLBFWCustomMethodUI();
                const rows = document.querySelectorAll('#lbfw-custom-proposal-table-body tr');
                adminReview.moduleLBFW.proposalRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.lbfw-custom-proposal-eval');
                        const adminNote = rows[index].querySelector('.lbfw-custom-proposal-admin-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }
        }

        // Load module App admin review
        if (adminReview.moduleApp) {
            // Load overall module evaluation
            if (adminReview.moduleApp.overallReview) {
                const moduleReview = adminReview.moduleApp.overallReview;
                if (document.getElementById('eval-module-app')) {
                    document.getElementById('eval-module-app').value = moduleReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-app'));
                }
                if (document.getElementById('note-module-app')) {
                    document.getElementById('note-module-app').value = moduleReview.note || '';
                }
            }
        }

        // Load module Custom admin review
        if (adminReview.moduleCustom) {
            // Load linear method review
            if (adminReview.moduleCustom.linearMethodReview) {
                const linearReview = adminReview.moduleCustom.linearMethodReview;
                if (document.getElementById('eval-custom-linear-method')) {
                    document.getElementById('eval-custom-linear-method').value = linearReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-custom-linear-method'));
                }
                if (document.getElementById('note-custom-linear-method')) {
                    document.getElementById('note-custom-linear-method').value = linearReview.note || '';
                }
            }
        }

        // Load module Khac admin review
        if (adminReview.moduleCustom) {
            // Load custom method review
            if (adminReview.moduleCustom.customMethodReview) {
                const customMethodReview = adminReview.moduleCustom.customMethodReview;
                if (document.getElementById('eval-custom-method')) {
                    document.getElementById('eval-custom-method').value = customMethodReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-custom-method'));
                }
                if (document.getElementById('note-custom-method')) {
                    document.getElementById('note-custom-method').value = customMethodReview.note || '';
                }
            }

            if (adminReview.moduleCustom.baselineRowReviews) {
                const rows = document.querySelectorAll('#custom-baseline-table-body tr');
                adminReview.moduleCustom.baselineRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.admin-eval-select');
                        const adminNote = rows[index].querySelector('.admin-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }

            if (adminReview.moduleCustom.inputConfigRowReviews) {
                const rows = document.querySelectorAll('#custom-input-config-table-body tr');
                adminReview.moduleCustom.inputConfigRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.custom-input-config-eval');
                        const adminNote = rows[index].querySelector('.custom-input-config-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }

            if (adminReview.moduleCustom.storageRowReviews) {
                const rows = document.querySelectorAll('#custom-storage-input-table-body tr');
                adminReview.moduleCustom.storageRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.custom-storage-eval');
                        const adminNote = rows[index].querySelector('.custom-storage-admin-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }

            if (adminReview.moduleCustom.proposalRowReviews) {
                const rows = document.querySelectorAll('#custom-proposal-table-body tr');
                adminReview.moduleCustom.proposalRowReviews.forEach((review, index) => {
                    if (rows[index]) {
                        const adminEval = rows[index].querySelector('.custom-proposal-eval');
                        const adminNote = rows[index].querySelector('.custom-proposal-admin-note');
                        if (adminEval) {
                            adminEval.value = review.eval || '';
                            styleAdminSelect(adminEval);
                        }
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }
        }

        // Re-apply role permissions after loading admin review
        applyRolePermissions();

        Logger.debug('Loaded sizing admin review successfully');
    } catch (e) {
        Logger.error('Error loading sizing admin review:', e);
    }
}

// Hàm chuyển Tab (Ẩn hiện các mục nội dung)
function showSection(sectionId, linkElement, options = {}) {
    const activeSection = document.querySelector('.page-section.active');
    const activeSectionId = activeSection?.id;
    const currentTabIndex = TAB_FLOW_ORDER.indexOf(activeSectionId);
    const targetTabIndex = TAB_FLOW_ORDER.indexOf(sectionId);
    const isKnownTabFlow = currentTabIndex !== -1 && targetTabIndex !== -1;
    const isForwardNavigation = isKnownTabFlow && targetTabIndex > currentTabIndex;

    if (!options.skipValidation && !options.skipPushState && activeSectionId && activeSectionId !== sectionId && isForwardNavigation && activeSectionId !== 'page-input') {
        const validation = validateTabCompletion(activeSectionId, {
            focusFirstInvalid: true,
            showToastMessage: false
        });
        if (!validation.isValid) {
            showToast('Không thể chuyển tab khi chưa điền xong dữ liệu ở tab hiện tại.', 'warning');
            return;
        }
    }

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
        scheduleAutoResizeTextBoxes(target);
    } else {
        Logger.error('Không tìm thấy ID: ' + sectionId);
    }

    // 3. Cập nhật trạng thái "active" (màu đỏ) cho Menu bên trái
    const menuLinks = document.querySelectorAll('.side-menu a');
    menuLinks.forEach(link => link.classList.remove('active')); // Xóa active cũ

    // Thêm active cho link vừa bấm
    if (linkElement) {
        linkElement.classList.add('active');
    }

    // 4. Khi chuyển sang trang Tổng hợp, tự động aggregate dữ liệu
    if (sectionId === 'page-summary') {
        aggregateSizingResults({ preserveDeletedRows: summaryManualOverrideActive });
    }

    // 5. Cập nhật URL/history khi chuyển tab (chỉ khi đang ở project detail)
    if (!options.skipPushState && currentProjectId) {
        pushAppState('project', currentProjectId, sectionId);
    }
}

// Tự động thêm 1 dòng trắng khi load trang lần đầu
function showSection(sectionId, linkElement, options = {}) {
    const activeSection = document.querySelector('.page-section.active');
    const activeSectionId = activeSection?.id;
    const currentTabIndex = TAB_FLOW_ORDER.indexOf(activeSectionId);
    const targetTabIndex = TAB_FLOW_ORDER.indexOf(sectionId);
    const isKnownTabFlow = currentTabIndex !== -1 && targetTabIndex !== -1;
    const isForwardNavigation = isKnownTabFlow && targetTabIndex > currentTabIndex;

    if (!options.skipValidation && !options.skipPushState && activeSectionId && activeSectionId !== sectionId && isForwardNavigation && activeSectionId !== 'page-input') {
        const validation = validateTabCompletion(activeSectionId, {
            focusFirstInvalid: true,
            showToastMessage: false
        });
        if (!validation.isValid) {
            showToast('Khong the chuyen tab khi chua dien xong du lieu o tab hien tai.', 'warning');
            return;
        }
    }

    const sections = document.querySelectorAll('.page-section');
    sections.forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
        scheduleAutoResizeTextBoxes(target);
    } else {
        Logger.error('Khong tim thay ID: ' + sectionId);
    }

    const menuLinks = document.querySelectorAll('.side-menu a');
    menuLinks.forEach(link => link.classList.remove('active'));

    if (linkElement) {
        linkElement.classList.add('active');
    }

    if (!options.skipPushState && currentProjectId) {
        pushAppState('project', currentProjectId, sectionId);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    applyFixedSizingRule();
    initGlobalAutoResizeTextBoxes();
    initGlobalAutoResizeTextBoxObserver();
    scheduleAutoResizeTextBoxes();
    initVietnameseDateInputs();
    initRequestAutoResizeTextareas();
    ensureDefaultAppSizingRows();
    const connectionBody = document.getElementById('connection-info-table-body');
    if (connectionBody && connectionBody.children.length === 0) {
        connectionBody.appendChild(createConnectionTableRow(1, {}));
    }
    const archBody = document.getElementById('arch-table-body');
    if (archBody && archBody.children.length === 0) {
        const tr = createArchTableRow(1, {});
        tr.dataset.rowId = 'arch-row-' + (++archRowIdCounter);
        archBody.appendChild(tr);
    }
    // Tính tổng khi trang load
    updateBaselineTotal();
    updateInputConfigTotal();
    // Attach listeners to update POC/Sizing dropdowns when input table changes
    attachInputTableChangeListeners();
    initHelpTooltipSmartPositioning();
    initFirstRowGuards();
    ['eval-summary', 'note-summary'].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        const eventName = element.tagName === 'SELECT' ? 'change' : 'input';
        element.addEventListener(eventName, () => markSummaryPendingManualSave());
    });
});
// ==================== HELPER: Safe value assign to prevent [object Object] ====================
function safeSetValue(element, value) {
    if (!element) return;
    if (value && typeof value === 'object') {
        element.value = '';
    } else {
        element.value = String(value || '');
    }
}

// ==================== XỬ LÝ BẢNG TÍNH TOÁN (INPUT CONFIG) ====================

function addInputConfigRow() {
    const tbody = document.getElementById('input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const calcHandler = buildInstanceAwareHandler('calculateInputConfigRow(this)');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler('deleteInputConfigRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>

        <td><input type="text" class="input-full text-center ip-config-input" placeholder="10.x.x.x"></td>

        <td>
            <input type="number" class="input-full text-center cpu-load-input" min="0" step="0.01" oninput="validateLoadInput(this); ${calcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center ram-load-input" min="0" step="0.01" oninput="validateLoadInput(this); ${calcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center cint-used-input field-readonly" min="0" readonly>
        </td>

        <td>
            <input type="number" class="input-full text-center ram-used-input field-readonly" min="0" readonly>
        </td>

        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="input-config-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
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
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="${deleteRowHandler}">
                <i class="fa-solid fa-trash-can"></i>
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

    // Lấy giá trị từ bảng baseline tương ứng
    const baselineRows = document.querySelectorAll('#baseline-table-body tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);

    if (rowIndex < baselineRows.length) {
        const baselineRow = baselineRows[rowIndex];
        const baselineCint = parseFloat(baselineRow.querySelector('.cint-input').value) || 0;
        const baselineRam = parseFloat(baselineRow.querySelector('.ram-input').value) || 0;

        const cpuLoad = parseFloat(cpuLoadInput.value) || 0;
        const ramLoad = parseFloat(ramLoadInput.value) || 0;

        // Công thức:
        // Cint_rate used (Cint) = Cint_rate_2017 (hệ thống tham chiếu) × Tải CPU 95th percentile (%)
        // RAM used (GB) = RAM (hệ thống tham chiếu) × Tải RAM 95th percentile (%)
        const cintUsed = (baselineCint * cpuLoad / 100).toFixed(2);
        const ramUsed = (baselineRam * ramLoad / 100).toFixed(2);

        cintUsedInput.value = cintUsed;
        ramUsedInput.value = ramUsed;
    }

    updateInputConfigTotal();
}

function deleteInputConfigRow(btn) {
    btn.closest('tr').remove();
    updateInputConfigRowNumbers();
    updateInputConfigTotal();
}

function updateInputConfigRowNumbers() {
    const rows = document.querySelectorAll('#input-config-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function updateInputConfigTotal() {
    const totalCintUsedEl = document.getElementById('total-cint-used');
    const totalRamUsedEl = document.getElementById('total-ram-used');

    if (!totalCintUsedEl || !totalRamUsedEl) return;

    let totalCintUsed = 0;
    let totalRamUsed = 0;

    document.querySelectorAll('.cint-used-input').forEach(input => {
        totalCintUsed += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.ram-used-input').forEach(input => {
        totalRamUsed += parseFloat(input.value) || 0;
    });

    totalCintUsedEl.innerText = totalCintUsed.toFixed(2);
    totalRamUsedEl.innerText = totalRamUsed.toFixed(2);
}

// Tính toán đề xuất số server & hiển thị bảng kết quả (lấy POC/Định cỡ từ phần THÔNG TIN ĐẦU VÀO)
function addStorageInputRow() {
    const tbody = document.getElementById('storage-input-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler('deleteStorageInputRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><select class="input-full text-center storage-ip-input">${buildStorageIpOptions('app')}</select></td>
        <td><input type="text" class="input-full text-center storage-partition-input" placeholder="/u01, /u02,..."></td>
        <td><input type="number" class="input-full text-center storage-used-input" min="0" step="0.01"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="storage-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
        </td>
        <td><input type="text" class="input-full storage-note-input" placeholder="Lưu /data, /logs, /backup, NAS, ..."></td>
        <td class="admin-cell">
            <select class="admin-eval-select storage-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note storage-admin-note" placeholder="Nhận xét...">
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="${deleteRowHandler}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    refreshStorageIpDropdowns('app');
    applyRolePermissions();
}

function deleteStorageInputRow(btn) {
    btn.closest('tr').remove();
    updateStorageInputRowNumbers();
}

function updateStorageInputRowNumbers() {
    const rows = document.querySelectorAll('#storage-input-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function getAppStorageTotalsByPartition() {
    const partitionMap = new Map();

    document.querySelectorAll('#storage-input-table-body tr').forEach(row => {
        const partition = (row.querySelector('.storage-partition-input')?.value || '').trim();
        const used = parseFloat(row.querySelector('.storage-used-input')?.value) || 0;
        if (!partition || used <= 0) return;

        const key = partition.toLowerCase();
        const current = partitionMap.get(key) || { name: partition, totalUsed: 0 };
        current.totalUsed += used;
        partitionMap.set(key, current);
    });

    return Array.from(partitionMap.values());
}

function onVirtualizationModeChange(prefix) {
    const modeSelect = document.getElementById(`${prefix}-virtualization-mode`);
    const vcpuSelect = document.getElementById(`${prefix}-vcpu-flavor`);
    const ramSelect = document.getElementById(`${prefix}-ram-flavor`);
    if (!modeSelect || !vcpuSelect || !ramSelect) return;

    const mode = modeSelect.value === 'vcpu' ? 'vcpu' : 'ram';
    vcpuSelect.disabled = mode !== 'vcpu';
    ramSelect.disabled = mode !== 'ram';

    const vcpuContainer = vcpuSelect.closest('div');
    const ramContainer = ramSelect.closest('div');
    if (vcpuContainer && ramContainer) {
        vcpuContainer.style.display = mode === 'vcpu' ? 'block' : 'none';
        ramContainer.style.display = mode === 'ram' ? 'block' : 'none';
    }
}

function getVirtualizationChoice(prefix) {
    const modeSelect = document.getElementById(`${prefix}-virtualization-mode`);
    const vcpuSelect = document.getElementById(`${prefix}-vcpu-flavor`);
    const ramSelect = document.getElementById(`${prefix}-ram-flavor`);

    const mode = modeSelect?.value === 'vcpu' ? 'vcpu' : 'ram';
    const vcpu = parseFloat(vcpuSelect?.value || 0);
    const ram = parseFloat(ramSelect?.value || 0);

    return {
        mode,
        vcpu,
        ram,
        selectedValue: mode === 'vcpu' ? vcpu : ram,
        selectedLabel: mode === 'vcpu' ? `${vcpu} Cint` : `${ram} GB RAM`
    };
}

function syncTextareasInContainer(container) {
    if (!container) return;
    container.querySelectorAll('textarea').forEach(ta => {
        ta.textContent = ta.value;
    });
}

function getEmptyAppCustomProposalTable() {
    return {
        component: '',
        configurationText: '',
        quantity: '',
        note: ''
    };
}

function resolveCurrentModuleInstanceDisplayName(fallbackModuleType = '') {
    const activeInstanceKey = String(window.__activeInstanceKey || '').trim();
    const instances = getModuleInstancesFromArchTable();
    if (activeInstanceKey) {
        const activeInstance = instances.find(instance => getModuleInstanceKey(instance) === activeInstanceKey);
        if (activeInstance) {
            return getModuleInstanceDisplayName(activeInstance);
        }
    }

    if (fallbackModuleType) {
        const fallbackInstance = instances.find(instance => instance.moduleType === fallbackModuleType);
        if (fallbackInstance) {
            return getModuleInstanceDisplayName(fallbackInstance);
        }
    }

    return fallbackModuleType || '';
}

function resolveAppProposalContainer(source = null) {
    const containerSelector = '[id="sizing-result-container"], [id^="sizing-result-container__inst_"]';
    if (source && typeof source === 'object') {
        if (typeof source.matches === 'function' && source.matches(containerSelector)) {
            return source;
        }
        if (typeof source.closest === 'function') {
            const closestContainer = source.closest(containerSelector);
            if (closestContainer) return closestContainer;
        }
        if (typeof source.querySelector === 'function' && source.querySelector('[data-app-proposal-table="1"], [data-app-custom-proposal-table="1"]')) {
            return source;
        }
    }

    return document.getElementById('sizing-result-container');
}

function normalizeAppCustomProposalTable(data) {
    const empty = getEmptyAppCustomProposalTable();
    if (!data || typeof data !== 'object') return empty;
    return {
        component: String(data.component || ''),
        configurationText: String(data.configurationText || ''),
        quantity: String(data.quantity || ''),
        note: String(data.note || '')
    };
}

// Normalize array of rows or single object to always return array
function normalizeAppCustomProposalTableList(data) {
    if (!data) return [];

    // If it's already an array, normalize each item
    if (Array.isArray(data)) {
        return data.map(item => normalizeAppCustomProposalTable(item));
    }

    // If it's a single object, wrap in array
    return [normalizeAppCustomProposalTable(data)];
}

function isAppCustomProposalTableFilled(customProposalTable) {
    const list = normalizeAppCustomProposalTableList(customProposalTable);
    return list.some(row => row.configurationText.trim() !== '');
}

function normalizeAppProposalSource(source, customProposalTable) {
    return source === 'custom' && isAppCustomProposalTableFilled(customProposalTable) ? 'custom' : 'auto';
}

function collectAppCustomProposalTableData(container = null) {
    container = resolveAppProposalContainer(container);
    if (!container) return getEmptyAppCustomProposalTable();

    const tbody = container.querySelector('.app-custom-proposal-tbody');
    if (!tbody) return getEmptyAppCustomProposalTable();

    const rows = [];
    tbody.querySelectorAll('tr').forEach(row => {
        const component = row.querySelector('.app-custom-proposal-component')?.value || '';
        const config = row.querySelector('.app-custom-proposal-config')?.value || '';
        const qty = row.querySelector('.app-custom-proposal-qty')?.value || '';
        const note = row.querySelector('.app-custom-proposal-note')?.value || '';

        // Only include rows that have some content
        if (component.trim() || config.trim() || qty.trim() || note.trim()) {
            rows.push({
                component: component,
                configurationText: config,
                quantity: qty,
                note: note
            });
        }
    });

    // Return first row if only one row, otherwise return array
    if (rows.length === 0) return getEmptyAppCustomProposalTable();
    if (rows.length === 1) return normalizeAppCustomProposalTable(rows[0]);
    return rows;
}

function getAppSelectedProposalSource(container = null) {
    container = resolveAppProposalContainer(container);
    const value = container?.querySelector('.app-proposal-source-select')?.value || 'auto';
    return value === 'custom' ? 'custom' : 'auto';
}

function getCurrentAppProposalState(container = null) {
    container = resolveAppProposalContainer(container);
    return {
        selectedProposalSource: getAppSelectedProposalSource(container),
        customProposalTable: collectAppCustomProposalTableData(container)
    };
}

function updateAppProposalSourceUI(container = null, selectedSource = 'auto') {
    container = resolveAppProposalContainer(container);
    if (!container) return;

    const normalizedSource = selectedSource === 'custom' ? 'custom' : 'auto';
    const effectiveSource = normalizeAppProposalSource(normalizedSource, collectAppCustomProposalTableData(container));
    const select = container.querySelector('.app-proposal-source-select');
    const toolHeading = container.querySelector('.app-tool-proposal-heading');
    const customHeading = container.querySelector('.app-custom-proposal-heading');
    const customSection = container.querySelector('.app-custom-proposal-section');
    const autoTable = container.querySelector('[data-app-proposal-table="1"]');
    const customTable = container.querySelector('[data-app-custom-proposal-table="1"]');

    if (select) select.value = normalizedSource;
    if (toolHeading) toolHeading.textContent = effectiveSource === 'auto'
        ? 'Đề xuất cấu hình do tool tạo (đang dùng)'
        : 'Đề xuất cấu hình do tool tạo';
    if (customHeading) customHeading.textContent = effectiveSource === 'custom'
        ? 'Đề xuất cấu hình tùy chỉnh (đang dùng)'
        : 'Đề xuất cấu hình tùy chỉnh';
    if (customSection) {
        customSection.classList.toggle('is-hidden', normalizedSource !== 'custom');
    }

    if (autoTable) {
        autoTable.style.outline = effectiveSource === 'auto' ? '2px solid #38b2ac' : 'none';
        autoTable.style.outlineOffset = effectiveSource === 'auto' ? '2px' : '0';
    }
    if (customTable) {
        customTable.style.outline = effectiveSource === 'custom' ? '2px solid #38b2ac' : 'none';
        customTable.style.outlineOffset = effectiveSource === 'custom' ? '2px' : '0';
    }
}

function handleAppProposalSourceChange(selectEl) {
    const container = resolveAppProposalContainer(selectEl);
    if (!container) return;

    const select = (selectEl && typeof selectEl === 'object' && typeof selectEl.tagName === 'string')
        ? selectEl
        : container.querySelector('.app-proposal-source-select');
    if (!select) return;

    const selectedSource = select.value === 'custom' ? 'custom' : 'auto';

    updateAppProposalSourceUI(container, selectedSource);
    markSummaryNeedsSizingRefresh();
}

function buildAppCustomProposalSectionHtml(selectedProposalSource, customProposalTable) {
    const rows = normalizeAppCustomProposalTableList(customProposalTable);
    const normalizedSource = selectedProposalSource === 'custom' ? 'custom' : 'auto';
    const effectiveRows = rows.length > 0 ? rows : [getEmptyAppCustomProposalTable()];
    const sourceChangeHandler = buildInstanceAwareHandler('handleAppProposalSourceChange(this)');
    const addRowHandler = buildInstanceAwareHandler('addAppCustomProposalRow(this)');
    const deleteRowHandler = buildInstanceAwareHandler('removeRow(this)');

    const buildRows = () => effectiveRows.map(row => `
        <tr>
            <td>
                <input type="text" class="input-full app-custom-proposal-component sizing-user-input" value="${escapeHtml(row.component)}" placeholder="Tên thành phần">
            </td>
            <td>
                <textarea class="input-full app-custom-proposal-config sizing-user-input u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình, ví dụ:&#10;CPU: = 16 Cint&#10;RAM: = 64 GB">${escapeHtml(row.configurationText)}</textarea>
            </td>
            <td class="text-center">
                <input type="text" class="input-full text-center app-custom-proposal-qty sizing-user-input" value="${escapeHtml(row.quantity)}" placeholder="Số lượng">
            </td>
            <td>
                <textarea class="input-full app-custom-proposal-note sizing-user-input u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(row.note)}</textarea>
            </td>
            <td class="text-center">
                <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                    <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                </button>
            </td>
        </tr>
    `).join('');

    return `
        <div class="app-proposal-source-panel proposal-source-panel">
            <label class="panel-label-compact">Bạn có muốn chỉnh sửa cấu hình không?</label>
            <select class="input-full app-proposal-source-select" onchange="${sourceChangeHandler}">
                <option value="auto" ${normalizedSource === 'auto' ? 'selected' : ''}>Không</option>
                <option value="custom" ${normalizedSource === 'custom' ? 'selected' : ''}>Có</option>
            </select>
        </div>
        <div class="app-custom-proposal-section ${normalizedSource === 'custom' ? '' : 'is-hidden'}">
            <h4 class="app-custom-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình tùy chỉnh</h4>
            <table class="sizing-table app-custom-proposal-table u-mt-8" data-app-custom-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-180">Thành phần</th>
                        <th class="col-w-250">Cấu hình</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                        <th class="col-w-50"><i class="fa-solid fa-trash-can"></i></th>
                    </tr>
                </thead>
                <tbody class="app-custom-proposal-tbody">
                    ${buildRows()}
                </tbody>
            </table>
            <button type="button" class="ui-btn ui-btn-outline btn-add sizing-user-btn u-mt-10" onclick="${addRowHandler}">
                <i class="fa-solid fa-plus"></i> Thêm thành phần
            </button>
        </div>`;
}

function ensureAppProposalSelectionUI(containerOrOptions = {}, optionsArg = {}) {
    const usingExplicitContainer = containerOrOptions
        && typeof containerOrOptions === 'object'
        && (typeof containerOrOptions.matches === 'function'
            || typeof containerOrOptions.closest === 'function'
            || typeof containerOrOptions.querySelector === 'function')
        && !Array.isArray(containerOrOptions);
    const container = usingExplicitContainer
        ? resolveAppProposalContainer(containerOrOptions)
        : resolveAppProposalContainer(containerOrOptions?.container || null);
    const options = usingExplicitContainer ? (optionsArg || {}) : (containerOrOptions || {});
    if (!container) return;

    const autoTable = container.querySelector('[data-app-proposal-table="1"]');
    if (!autoTable) return;

    const toolHeading = autoTable.previousElementSibling;
    if (toolHeading && toolHeading.tagName === 'H4') {
        toolHeading.classList.add('app-tool-proposal-heading');
    }

    if (!container.querySelector('[data-app-custom-proposal-table="1"]')) {
        autoTable.insertAdjacentHTML(
            'afterend',
            buildAppCustomProposalSectionHtml(
                options.selectedProposalSource || 'auto',
                options.customProposalTable || getEmptyAppCustomProposalTable()
            )
        );
    }

    // Ensure at least one row exists
    const tbody = container.querySelector('.app-custom-proposal-tbody');
    if (tbody && tbody.children.length === 0) {
        addAppCustomProposalRow(container);
    }

    // Load data into rows
    const tableData = options.customProposalTable || collectAppCustomProposalTableData(container);
    const dataList = normalizeAppCustomProposalTableList(tableData);

    // Clear existing rows and rebuild
    if (tbody) {
        tbody.innerHTML = '';
        dataList.forEach(rowData => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <input type="text" class="input-full app-custom-proposal-component sizing-user-input" value="${escapeHtml(rowData.component)}" placeholder="Tên thành phần">
                </td>
                <td>
                    <textarea class="input-full app-custom-proposal-config sizing-user-input u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình, ví dụ:&#10;CPU: = 16 Cint&#10;RAM: = 64 GB">${escapeHtml(rowData.configurationText)}</textarea>
                </td>
                <td class="text-center">
                    <input type="text" class="input-full text-center app-custom-proposal-qty sizing-user-input" value="${escapeHtml(rowData.quantity)}" placeholder="Số lượng">
                </td>
                <td>
                    <textarea class="input-full app-custom-proposal-note sizing-user-input u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(rowData.note)}</textarea>
                </td>
                <td class="text-center">
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="removeRow(this)" title="Xóa dòng này" aria-label="Xóa dòng này">
                        <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Apply permissions to new rows
    try { applyRolePermissions(); } catch (e) { }

    // Update source selection UI
    updateAppProposalSourceUI(container, options.selectedProposalSource || 'auto');

    try { autoResizeAllCustomProposalConfig(container); } catch (e) { }
}

function buildAppEffectiveCustomProposalData(customProposalTable) {
    const dataList = normalizeAppCustomProposalTableList(customProposalTable);
    const defaultComponentName = resolveCurrentModuleInstanceDisplayName('App');

    if (dataList.length === 0) return null;

    // Keep per-row components for summary/export views that need one row per component.
    const resultRows = [];
    const cauHinhList = [];
    let soLuong = '';
    let ghiChu = '';

    dataList.forEach(row => {
        const rowComponent = (row.component || '').trim();
        const lines = row.configurationText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        lines.forEach(line => {
            cauHinhList.push(`- ${escapeHtml(line)}`);
        });

        const rowConfig = lines.map(line => `- ${escapeHtml(line)}`).join('<br>');
        const rowQuantity = row.quantity.trim();
        const rowNote = row.note.trim();

        if (rowConfig) {
            resultRows.push({
                component: rowComponent || defaultComponentName,
                cauHinh: rowConfig,
                soLuong: rowQuantity,
                ghiChu: rowNote
            });
        }

        if (rowQuantity) {
            soLuong = rowQuantity;
        }
        if (rowNote) {
            ghiChu = rowNote;
        }
    });

    if (cauHinhList.length === 0) return null;

    return {
        rows: resultRows,
        cauHinh: cauHinhList.join('<br>'),
        soLuong: soLuong,
        ghiChu: ghiChu
    };
}

function resolveEffectiveAppProposalResult(appState = {}) {
    const sizingResult = appState.sizingResult || '';
    const autoParsed = parseAppSizingResult(sizingResult);
    const customProposalTable = normalizeAppCustomProposalTableList(appState.customProposalTable);
    const selectedProposalSource = normalizeAppProposalSource(appState.selectedProposalSource || 'auto', customProposalTable);

    if (selectedProposalSource === 'custom') {
        const customParsed = buildAppEffectiveCustomProposalData(customProposalTable);
        if (customParsed) {
            if (autoParsed?.fwlb) customParsed.fwlb = autoParsed.fwlb;
            return customParsed;
        }
    }

    return autoParsed;
}

function calculateSizingRecommendations() {
    const poc = parseFloat(document.getElementById('poc-value')?.value) || 0;
    const sizing = parseFloat(document.getElementById('sizing-value')?.value) || 0;
    if (!poc || !sizing) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".', 'warning');
        return;
    }

    {
        const totalCintNew = parseFloat(document.getElementById('total-cint-used')?.innerText) || 0;
        const totalRamNew = parseFloat(document.getElementById('total-ram-used')?.innerText) || 0;
        const storageTotalsNew = getAppStorageTotalsByPartition();
        if (storageTotalsNew.length === 0) {
            showToast('Vui lòng nhập ít nhất một phân vùng trong "THÔNG TIN LƯU TRỮ ĐẦU VÀO".', 'warning');
            return;
        }

        const factorNew = sizing / poc;
        const existingProposalState = getCurrentAppProposalState();
        const cintForTPSNew = totalCintNew * factorNew;
        const ramForTPSNew = totalRamNew * factorNew;
        const cintAfterKPINew = cintForTPSNew / 0.75 * 1.1;
        const ramAfterKPINew = ramForTPSNew / 0.9 * 1.1;
        const storageAfterKPINew = storageTotalsNew.map(item => ({
            name: item.name,
            totalUsed: item.totalUsed,
            forTPS: item.totalUsed * factorNew,
            afterKPI: item.totalUsed * factorNew / 0.8 * 1.1
        }));

        const virtualizationNew = getVirtualizationChoice('app');
        if (!virtualizationNew.selectedValue) {
            showToast('Vui lòng chọn cấu hình ảo hóa hợp lệ trước khi tính toán.', 'warning');
            return;
        }

        const ketquaNew = Math.max(1, virtualizationNew.mode === 'vcpu'
            ? Math.ceil(cintAfterKPINew / virtualizationNew.vcpu)
            : Math.ceil(ramAfterKPINew / virtualizationNew.ram));

        const machineRowsNew = [
            {
                label: 'Cintrate cần cho hệ thống',
                value: cintForTPSNew.toFixed(2),
                note: `= ${totalCintNew.toFixed(2)} x (${sizing} / ${poc}) = ${totalCintNew.toFixed(2)} x ${factorNew.toFixed(4)}`
            },
            {
                label: 'RAM (GB) cần cho hệ thống',
                value: ramForTPSNew.toFixed(2),
                note: `= ${totalRamNew.toFixed(2)} x (${sizing} / ${poc}) = ${totalRamNew.toFixed(2)} x ${factorNew.toFixed(4)}`
            }
        ];

        storageAfterKPINew.forEach(item => {
            machineRowsNew.push({
                label: `${item.name} (GB) cần cho hệ thống`,
                value: item.forTPS.toFixed(2),
                note: `= ${item.totalUsed.toFixed(2)} x (${sizing} / ${poc}) = ${item.totalUsed.toFixed(2)} x ${factorNew.toFixed(4)}`
            });
        });

        machineRowsNew.push(
            {
                label: 'Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
                value: cintAfterKPINew.toFixed(2),
                note: `= ${cintForTPSNew.toFixed(2)} / 0.75 x 1.1. KPI 75%, Sai số 1.1`
            },
            {
                label: 'RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
                value: ramAfterKPINew.toFixed(2),
                note: `= ${ramForTPSNew.toFixed(2)} / 0.9 x 1.1. KPI 90%, Sai số 1.1`
            }
        );

        storageAfterKPINew.forEach(item => {
            machineRowsNew.push({
                label: `${item.name} cần sau khi nhân hệ số dự phòng và đảm bảo KPI`,
                value: item.afterKPI.toFixed(2),
                note: `= ${item.forTPS.toFixed(2)} / 0.8 x 1.1. KPI 80%, Sai số 1.1`
            });
        });

        const recommendationFormulaNew = virtualizationNew.mode === 'vcpu'
            ? `N = ${cintAfterKPINew.toFixed(2)} / ${virtualizationNew.vcpu}`
            : `N = ${ramAfterKPINew.toFixed(2)} / ${virtualizationNew.ram}`;
        const recommendationTargetNew = virtualizationNew.mode === 'vcpu'
            ? `theo vCPU <strong>${virtualizationNew.selectedLabel}</strong>`
            : `theo RAM <strong>${virtualizationNew.selectedLabel}</strong>`;
        const cintPerServerNew = Math.ceil(cintAfterKPINew / ketquaNew);
        const ramPerServerNew = Math.ceil(ramAfterKPINew / ketquaNew);
        const storagePerServerNew = storageAfterKPINew.map(item => ({
            name: item.name,
            perServer: Math.ceil(item.afterKPI / ketquaNew)
        }));

        const appComponentNameNew = resolveCurrentModuleInstanceDisplayName('App');
        let htmlNew = '';
        htmlNew += `<h4 class="u-mt-16 u-mb-8 u-text-section">Bảng tính toán Máy chủ Tiến trình</h4>`;
        htmlNew += `<table class="sizing-table app-machine-table u-mt-8" data-app-machine-table="1">
                        <thead>
                            <tr>
                                <th class="col-w-50">STT</th>
                                <th class="col-w-350">Thông số</th>
                                <th class="col-w-150">Máy chủ tiến trình</th>
                                <th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>`;
        machineRowsNew.forEach((row, index) => {
            htmlNew += `<tr>
                            <td class="text-center">${index + 1}</td>
                            <td>${escapeHtml(row.label)}</td>
                            <td class="text-center">${row.value}</td>
                            <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">${row.note}</textarea></td>
                        </tr>`;
        });
        htmlNew += `</tbody></table>`;
        htmlNew += `<div data-app-recommendation="1" class="recommendation-panel">
                        <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa ${recommendationTargetNew}, lựa chọn số N theo mode đã chọn:
                        ${recommendationFormulaNew} = <strong>${ketquaNew}</strong>
                    </div>`;
        htmlNew += `<h4 class="u-mt-20 u-mb-8 u-text-section">Bảng phân bổ theo số lượng N</h4>`;
        htmlNew += `<table class="sizing-table app-n-table u-mt-8" data-app-n-table="1">
                        <thead>
                            <tr>
                                <th class="col-w-120">Giá trị N</th>
                                <th>Cint CPU yêu cầu</th>
                                <th>RAM yêu cầu</th>
                                ${storageAfterKPINew.map(item => `<th>${escapeHtml(item.name)} yêu cầu</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="diff-row-muted">
                                <td class="text-center">1</td>
                                <td class="text-center">${cintAfterKPINew.toFixed(2)}</td>
                                <td class="text-center">${ramAfterKPINew.toFixed(2)}</td>
                                ${storageAfterKPINew.map(item => `<td class="text-center">${item.afterKPI.toFixed(2)}</td>`).join('')}
                            </tr>
                            <tr class="diff-row-success diff-row-strong">
                                <td class="text-center">${ketquaNew}</td>
                                <td class="text-center">${(cintAfterKPINew / ketquaNew).toFixed(2)}</td>
                                <td class="text-center">${(ramAfterKPINew / ketquaNew).toFixed(2)}</td>
                                ${storageAfterKPINew.map(item => `<td class="text-center">${(item.afterKPI / ketquaNew).toFixed(2)}</td>`).join('')}
                            </tr>
                        </tbody>
                    </table>`;
        htmlNew += `<h4 class="app-tool-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình do tool tạo</h4>`;
        htmlNew += `<table class="sizing-table app-proposal-table u-mt-8" data-app-proposal-table="1">
                        <thead>
                            <tr>
                                <th class="col-w-180">Thành phần</th>
                                <th class="col-w-250">Cầu hình</th>
                                <th class="col-w-100">Số lượng</th>
                                <th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="diff-row-success">
                                <td>${escapeHtml(appComponentNameNew)}</td>
                                <td>
                                    <ul data-app-config-list="1" class="list-compact">
                                        <li>CPU: = ${cintPerServerNew} Cint</li>
                                        <li>RAM: = ${ramPerServerNew} GB</li>
                                        ${storagePerServerNew.map(item => `<li>${escapeHtml(item.name)}: = ${item.perServer} GB</li>`).join('')}
                                    </ul>
                                </td>
                                <td class="text-center"><strong>${ketquaNew + 1}</strong></td>
                                <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">Dự phòng N+1</textarea></td>
                            </tr>
                        </tbody>
                    </table>`;
        htmlNew += buildAppCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

        const containerNew = document.getElementById('sizing-result-container');
        if (containerNew) {
            containerNew.innerHTML = htmlNew;
            ensureAppProposalSelectionUI(existingProposalState);
        }
        return;
    }

    const totalCint = parseFloat(document.getElementById('total-cint-used')?.innerText) || 0;
    const totalRam = parseFloat(document.getElementById('total-ram-used')?.innerText) || 0;
    const storageTotals = getAppStorageTotalsByPartition();
    if (storageTotals.length === 0) {
        showToast('Vui lòng nhập ít nhất một phân vùng trong "THÔNG TIN LƯU TRỮ ĐẦU VÀO".', 'warning');
        return;
    }

    // Tính toán các thông số cơ bản
    const factor = sizing / poc;

    // Các giá trị cần cho TPS
    const cintForTPS = totalCint * factor;
    const ramForTPS = totalRam * factor;
    const storageAfterKPI = storageTotals.map(item => ({
        name: item.name,
        totalUsed: item.totalUsed,
        forTPS: item.totalUsed * factor,
        afterKPI: item.totalUsed * factor / 0.8 * 1.1
    }));

    // Các giá trị sau khi nhân hệ số dự phòng và đảm bảo KPI
    const cintAfterKPI = cintForTPS / 0.75 * 1.1;
    const ramAfterKPI = ramForTPS / 0.9 * 1.1;

    const virtualization = getVirtualizationChoice('app');
    if (!virtualization.selectedValue) {
        showToast('Vui lòng chọn cấu hình ảo hóa hợp lệ trước khi tính toán.', 'warning');
        return;
    }

    const ketqua = Math.max(1, virtualization.mode === 'vcpu'
        ? Math.ceil(cintAfterKPI / virtualization.vcpu)
        : Math.ceil(ramAfterKPI / virtualization.ram));

    const machineRows = [
        {
            label: 'Cintrate cần cho hệ thống',
            value: cintForTPS.toFixed(2),
            note: `= ${totalCint.toFixed(2)} x (${sizing} / ${poc}) = ${totalCint.toFixed(2)} x ${factor.toFixed(4)}`
        },
        {
            label: 'RAM (GB) cần cho hệ thống',
            value: ramForTPS.toFixed(2),
            note: `= ${totalRam.toFixed(2)} x (${sizing} / ${poc}) = ${totalRam.toFixed(2)} x ${factor.toFixed(4)}`
        }
    ];
    storageAfterKPI.forEach(item => {
        machineRows.push({
            label: `${item.name} (GB) cần cho hệ thống`,
            value: item.forTPS.toFixed(2),
            note: `= ${item.totalUsed.toFixed(2)} x (${sizing} / ${poc}) = ${item.totalUsed.toFixed(2)} x ${factor.toFixed(4)}`
        });
    });
    machineRows.push(
        {
            label: 'Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
            value: cintAfterKPI.toFixed(2),
            note: `= ${cintForTPS.toFixed(2)} / 0.75 x 1.1. KPI 75%, Sai số 1.1`
        },
        {
            label: 'RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
            value: ramAfterKPI.toFixed(2),
            note: `= ${ramForTPS.toFixed(2)} / 0.9 x 1.1. KPI 90%, Sai số 1.1`
        }
    );
    storageAfterKPI.forEach(item => {
        machineRows.push({
            label: `${item.name} cần sau khi nhân hệ số dự phòng và đảm bảo KPI`,
            value: item.afterKPI.toFixed(2),
            note: `= ${item.forTPS.toFixed(2)} / 0.8 x 1.1. KPI 80%, Sai số 1.1`
        });
    });

    let html = '';

    // ==================== BẢNG 1: Thông số Máy chủ Tiến trình ====================
    html += `<h4 class="u-mt-16 u-mb-8 u-text-section">Bảng tính toán Máy chủ Tiến trình</h4>`;
    html += `<table class="sizing-table u-mt-8">
                <thead>
                    <tr>
                        <th class="col-w-50">STT</th>
                        <th class="col-w-350">Thông số</th>
                        <th class="col-w-150">Máy chủ Tiến trình</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="text-center">1</td>
                        <td>Cintrate cần cho hệ thống</td>
                        <td class="text-center">${cintForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${totalCint.toFixed(2)} × (${sizing} / ${poc}) = ${totalCint.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>RAM (GB) cần cho hệ thống</td>
                        <td class="text-center">${ramForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${totalRam.toFixed(2)} × (${sizing} / ${poc}) = ${totalRam.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">3</td>
                        <td>Disk (GB) cần cho hệ thống</td>
                        <td class="text-center">${diskForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${totalDisk.toFixed(2)} × (${sizing} / ${poc}) = ${totalDisk.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">4</td>
                        <td>Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${cintForTPS.toFixed(2)} / 0.75 × 1.1. KPI 75%, Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">5</td>
                        <td>RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${ramForTPS.toFixed(2)} / 0.9 × 1.1. KPI 90%, Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">6</td>
                        <td>Disk cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${diskAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${diskForTPS.toFixed(2)} / 0.8 × 1.1. KPI 80%, Sai số 1.1</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    // ==================== ĐỀ XUẤT ====================
    const recommendationFormula = virtualization.mode === 'vcpu'
        ? `N = ${cintAfterKPI.toFixed(2)} / ${virtualization.vcpu}`
        : `N = ${ramAfterKPI.toFixed(2)} / ${virtualization.ram}`;
    const recommendationTarget = virtualization.mode === 'vcpu'
        ? `theo vCPU <strong>${virtualization.selectedLabel}</strong>`
        : `theo RAM <strong>${virtualization.selectedLabel}</strong>`;

    html += `<div class="recommendation-panel">
                <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa ${recommendationTarget}, lựa chọn số N theo mode đã chọn:
                ${recommendationFormula} ≈ <strong>${ketqua}</strong>
            </div>`;

    // ==================== BẢNG 2: Giá trị N với Cint/RAM/Disk ====================
    const nValues = [
        { label: 'Ketqua', value: ketqua },
    ];

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Bảng phân bổ theo số lượng N</h4>`;
    html += `<table class="sizing-table u-mt-8">
                <thead>
                    <tr>
                        <th class="col-w-120">Giá trị N</th>
                        <th>Cint CPU yêu cầu</th>
                        <th>RAM yêu cầu</th>
                        <th>Disk yêu cầu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="diff-row-muted">
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

        html += `<tr${isMain ? ' class="diff-row-success diff-row-strong"' : ''}>
                    <td class="text-center">${item.value}</td>
                    <td class="text-center">${cintPerN.toFixed(2)}</td>
                    <td class="text-center">${ramPerN.toFixed(2)}</td>
                    <td class="text-center">${diskPerN.toFixed(2)}</td>
                </tr>`;
    });

    html += `</tbody></table>`;

    // ==================== BẢNG 3: Đề xuất cấu hình ====================
    const cintPerServer = Math.ceil(cintAfterKPI / ketqua);
    const ramPerServer = Math.ceil(ramAfterKPI / ketqua);
    const diskPerServer = Math.ceil(diskAfterKPI / ketqua);

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table u-mt-8" data-lbfw-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-250">Cấu hình</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="diff-row-success">
                        <td>
                            <ul class="list-compact">
                                <li>CPU: = ${cintPerServer} Cint</li>
                                <li>RAM: = ${ramPerServer} GB</li>
                                <li>DISK: = ${diskPerServer} GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>${ketqua + 1}</strong></td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">Dự phòng N+1</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    const container = document.getElementById('sizing-result-container');
    if (container) container.innerHTML = html;
}

// ==================== MODULE K8S FUNCTIONS ====================

function getK8SBaselineRows() {
    const tbody = document.getElementById('k8s-baseline-table-body');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr'));
}

function getK8SInputConfigRows() {
    const tbody = document.getElementById('k8s-input-config-table-body');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr'));
}

function getK8SStorageInputRows() {
    const tbody = document.getElementById('k8s-storage-input-table-body');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr'));
}

function addK8SBaselineRow() {
    const tbody = document.getElementById('k8s-baseline-table-body');
    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const syncIpHandler = buildInstanceAwareHandler('syncK8SIPToInputConfig(this)');
    const baselineRamHandler = buildInstanceAwareHandler('updateK8SBaselineTotal(); recalculateK8SInputConfigForRow(this)');
    const baselineDiskHandler = buildInstanceAwareHandler('updateK8SBaselineTotal()');
    const baselineCintHandler = buildInstanceAwareHandler('updateK8SBaselineTotal(); recalculateK8SInputConfigForRow(this)');
    const baselineUploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const baselineUploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteBaselineHandler = buildInstanceAwareHandler('deleteK8SBaselineRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><input type="text" class="input-full text-center k8s-ip-input" placeholder="10.x.x.x" oninput="${syncIpHandler}"></td>
        <td><input type="text" class="input-full k8s-cpu-input" placeholder="Intel Xeon..."></td>
        <td><input type="number" class="input-full text-center k8s-ram-input" min="0" oninput="${baselineRamHandler}"></td>
        <td><input type="number" class="input-full text-center k8s-disk-input" min="0" oninput="${baselineDiskHandler}"></td>
        <td><input type="number" class="input-full text-center k8s-cint-input" min="0" oninput="${baselineCintHandler}"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="k8s-baseline-evidence-input is-hidden" onchange="${baselineUploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${baselineUploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
        </td>
        <td class="admin-cell">
            <select class="admin-eval-select k8s-baseline-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note k8s-baseline-note" placeholder="Nhận xét...">
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="${deleteBaselineHandler}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    if (inputConfigTbody) {
        addK8SInputConfigRow();
    }
    refreshStorageIpDropdowns('k8s');
    applyRolePermissions();
    return tr;
}

function addK8SInputConfigRow() {
    const tbody = document.getElementById('k8s-input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const calculateRowHandler = buildInstanceAwareHandler('calculateK8SInputConfigRow(this)');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteHandler = buildInstanceAwareHandler('deleteK8SInputConfigRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><input type="text" class="input-full text-center k8s-ip-config-input" placeholder="10.x.x.x"></td>
        <td><input type="number" class="input-full text-center k8s-cpu-load-input" min="0" step="0.01" oninput="validateLoadInput(this); ${calculateRowHandler}"></td>
        <td><input type="number" class="input-full text-center k8s-ram-load-input" min="0" step="0.01" oninput="validateLoadInput(this); ${calculateRowHandler}"></td>
        <td><input type="number" class="input-full text-center k8s-cint-used-input field-readonly" min="0" readonly></td>
        <td><input type="number" class="input-full text-center k8s-ram-used-input field-readonly" min="0" readonly></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="k8s-input-config-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
        </td>
        <td class="admin-cell">
            <select class="admin-eval-select k8s-input-config-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note k8s-input-config-note" placeholder="Nhận xét...">
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="${deleteHandler}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    applyRolePermissions();
}

function calculateK8SInputConfigRow(input) {
    const row = input.closest('tr');
    const cpuLoadInput = row.querySelector('.k8s-cpu-load-input');
    const ramLoadInput = row.querySelector('.k8s-ram-load-input');
    const cintUsedInput = row.querySelector('.k8s-cint-used-input');
    const ramUsedInput = row.querySelector('.k8s-ram-used-input');

    const baselineRows = getK8SBaselineRows();
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);

    if (rowIndex < baselineRows.length) {
        const baselineRow = baselineRows[rowIndex];
        const baselineCint = parseFloat(baselineRow.querySelector('.k8s-cint-input').value) || 0;
        const baselineRam = parseFloat(baselineRow.querySelector('.k8s-ram-input').value) || 0;

        const cpuLoad = parseFloat(cpuLoadInput.value) || 0;
        const ramLoad = parseFloat(ramLoadInput.value) || 0;

        cintUsedInput.value = (baselineCint * cpuLoad / 100).toFixed(2);
        ramUsedInput.value = (baselineRam * ramLoad / 100).toFixed(2);
    }

    updateK8SInputConfigTotal();
}

function deleteK8SBaselineRow(btn) {
    const baselineRow = btn.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    baselineRow.remove();

    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');
    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        inputConfigTbody.rows[baselineRowIndex].remove();
    }
    updateK8SRowNumbers();
    updateK8SInputConfigRowNumbers();
    updateK8SBaselineTotal();
    updateK8SInputConfigTotal();
    refreshStorageIpDropdowns('k8s');
}

function deleteK8SInputConfigRow(btn) {
    btn.closest('tr').remove();
    updateK8SInputConfigRowNumbers();
    updateK8SInputConfigTotal();
}

function updateK8SRowNumbers() {
    const rows = getK8SBaselineRows();
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function updateK8SInputConfigRowNumbers() {
    const rows = getK8SInputConfigRows();
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function updateK8SBaselineTotal() {
    const totalRamEl = document.getElementById('k8s-total-ram');
    const totalCintEl = document.getElementById('k8s-total-cint');
    const totalDiskEl = document.getElementById('k8s-total-disk');
    if (!totalRamEl || !totalCintEl) return;

    let totalRam = 0, totalCint = 0, totalDisk = 0;

    getK8SBaselineRows().forEach(row => {
        const ram = parseFloat(row.querySelector('.k8s-ram-input')?.value) || 0;
        const cint = parseFloat(row.querySelector('.k8s-cint-input')?.value) || 0;
        const disk = parseFloat(row.querySelector('.k8s-disk-input')?.value) || 0;
        totalRam += ram;
        totalCint += cint;
        totalDisk += disk;
    });

    totalRamEl.innerText = totalRam;
    totalCintEl.innerText = totalCint;
    if (totalDiskEl) totalDiskEl.innerText = totalDisk;
}

function updateK8SInputConfigTotal() {
    const totalCintUsedEl = document.getElementById('k8s-total-cint-used');
    const totalRamUsedEl = document.getElementById('k8s-total-ram-used');
    if (!totalCintUsedEl || !totalRamUsedEl) return;

    let totalCintUsed = 0, totalRamUsed = 0;

    getK8SInputConfigRows().forEach(row => {
        totalCintUsed += parseFloat(row.querySelector('.k8s-cint-used-input')?.value) || 0;
        totalRamUsed += parseFloat(row.querySelector('.k8s-ram-used-input')?.value) || 0;
    });

    totalCintUsedEl.innerText = totalCintUsed.toFixed(2);
    totalRamUsedEl.innerText = totalRamUsed.toFixed(2);
}

function addK8SStorageInputRow() {
    const tbody = document.getElementById('k8s-storage-input-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const deleteRowHandler = buildInstanceAwareHandler('deleteK8SStorageInputRow(this)');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><select class="input-full text-center k8s-storage-ip-input">${buildStorageIpOptions('k8s')}</select></td>
        <td><input type="text" class="input-full text-center k8s-storage-partition-input" placeholder="/u01, /u02,..."></td>
        <td><input type="number" class="input-full text-center k8s-storage-used-input" min="0" step="0.01"></td>
        <td><input type="text" class="input-full k8s-storage-note-input" placeholder="Lưu /data, /logs, /backup, NAS, ..."></td>
        <td class="admin-cell">
            <select class="admin-eval-select k8s-storage-eval" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK">OK</option>
                <option value="NOK">NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <input type="text" class="input-full admin-note k8s-storage-admin-note" placeholder="Nhận xét...">
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger ui-icon-btn-table btn-delete-row-item" onclick="${deleteRowHandler}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    refreshStorageIpDropdowns('k8s');
    applyRolePermissions();
}

function deleteK8SStorageInputRow(btn) {
    btn.closest('tr').remove();
    updateK8SStorageInputRowNumbers();
}

function updateK8SStorageInputRowNumbers() {
    getK8SStorageInputRows().forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function getK8SStorageTotalsByPartition() {
    const partitionMap = new Map();

    getK8SStorageInputRows().forEach(row => {
        const partition = (row.querySelector('.k8s-storage-partition-input')?.value || '').trim();
        const used = parseFloat(row.querySelector('.k8s-storage-used-input')?.value) || 0;
        if (!partition || used <= 0) return;

        const key = partition.toLowerCase();
        const current = partitionMap.get(key) || { name: partition, totalUsed: 0 };
        current.totalUsed += used;
        partitionMap.set(key, current);
    });

    return Array.from(partitionMap.values());
}

function syncK8SIPToInputConfig(ipInput) {
    const baselineRow = ipInput.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');

    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        const ipConfigInput = inputConfigTbody.rows[baselineRowIndex].querySelector('.k8s-ip-config-input');
        if (ipConfigInput) ipConfigInput.value = ipInput.value;
    }
    refreshStorageIpDropdowns('k8s');
}

function recalculateK8SInputConfigForRow(baselineInput) {
    const baselineRow = baselineInput.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');

    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        const cpuLoadInput = inputConfigTbody.rows[baselineRowIndex].querySelector('.k8s-cpu-load-input');
        if (cpuLoadInput) calculateK8SInputConfigRow(cpuLoadInput);
    }
}

function calculateK8SSizing() {
    const poc = parseFloat(document.getElementById('k8s-poc-value')?.value) || 0;
    const sizing = parseFloat(document.getElementById('k8s-sizing-value')?.value) || 0;
    if (!poc || !sizing) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".', 'warning');
        return;
    }

    const totalCint = parseFloat(document.getElementById('k8s-total-cint-used')?.innerText) || 0;
    const totalRam = parseFloat(document.getElementById('k8s-total-ram-used')?.innerText) || 0;
    const storageTotals = getK8SStorageTotalsByPartition();
    if (storageTotals.length === 0) {
        showToast('Vui lòng nhập ít nhất một phân vùng trong "THÔNG TIN LƯU TRỮ ĐẦU VÀO".', 'warning');
        return;
    }

    const factor = sizing / poc;
    const container = document.getElementById('k8s-result-container');
    const existingProposalState = getCurrentK8SProposalState(container);

    const cintForTPS = totalCint * factor;
    const ramForTPS = totalRam * factor;
    const storageAfterKPI = storageTotals.map(item => ({
        name: item.name,
        totalUsed: item.totalUsed,
        forTPS: item.totalUsed * factor,
        afterKPI: item.totalUsed * factor / 0.8 * 1.1
    }));

    const cintAfterKPI = cintForTPS / 0.75 * 1.1;
    const ramAfterKPI = ramForTPS / 0.9 * 1.1;

    const virtualization = getVirtualizationChoice('k8s');
    if (!virtualization.selectedValue) {
        showToast('Vui lòng chọn cấu hình ảo hóa hợp lệ trước khi tính toán.', 'warning');
        return;
    }

    const ketqua = virtualization.mode === 'vcpu'
        ? Math.ceil(cintAfterKPI / virtualization.vcpu)
        : Math.ceil(ramAfterKPI / virtualization.ram);

    let html = '';
    const machineRows = [
        {
            label: 'Cintrate cần cho hệ thống',
            value: cintForTPS.toFixed(2),
            note: `= ${totalCint.toFixed(2)} x (${sizing} / ${poc}) = ${totalCint.toFixed(2)} x ${factor.toFixed(4)}`
        },
        {
            label: 'RAM (GB) cần cho hệ thống',
            value: ramForTPS.toFixed(2),
            note: `= ${totalRam.toFixed(2)} x (${sizing} / ${poc}) = ${totalRam.toFixed(2)} x ${factor.toFixed(4)}`
        }
    ];

    storageAfterKPI.forEach(item => {
        machineRows.push({
            label: `${item.name} (GB) cần cho hệ thống`,
            value: item.forTPS.toFixed(2),
            note: `= ${item.totalUsed.toFixed(2)} x (${sizing} / ${poc}) = ${item.totalUsed.toFixed(2)} x ${factor.toFixed(4)}`
        });
    });

    machineRows.push(
        {
            label: 'Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
            value: cintAfterKPI.toFixed(2),
            note: `= ${cintForTPS.toFixed(2)} / 0.75 x 1.1. KPI 75%, Sai số 1.1`
        },
        {
            label: 'RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI',
            value: ramAfterKPI.toFixed(2),
            note: `= ${ramForTPS.toFixed(2)} / 0.9 x 1.1. KPI 90%, Sai số 1.1`
        }
    );

    storageAfterKPI.forEach(item => {
        machineRows.push({
            label: `${item.name} cần sau khi nhân hệ số dự phòng và đảm bảo KPI`,
            value: item.afterKPI.toFixed(2),
            note: `= ${item.forTPS.toFixed(2)} / 0.8 x 1.1. KPI 80%, Sai số 1.1`
        });
    });

    html += `<h4 class="u-mt-16 u-mb-8 u-text-section">Bảng tính toán K8S Worker</h4>`;
    html += `<table class="sizing-table k8s-worker-table u-mt-8" data-k8s-worker-table="1">
                <thead>
                    <tr>
                        <th class="col-w-50">STT</th>
                        <th class="col-w-350">Thông số</th>
                        <th class="col-w-150">K8S Worker</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>`;
    machineRows.forEach((row, index) => {
        html += `<tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${escapeHtml(row.label)}</td>
                    <td class="text-center">${row.value}</td>
                    <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">${row.note}</textarea></td>
                </tr>`;
    });
    html += `</tbody>
            </table>`;

    const recommendationFormula = virtualization.mode === 'vcpu'
        ? `N = ${cintAfterKPI.toFixed(2)} / ${virtualization.vcpu}`
        : `N = ${ramAfterKPI.toFixed(2)} / ${virtualization.ram}`;
    const recommendationTarget = virtualization.mode === 'vcpu'
        ? `theo vCPU <strong>${virtualization.selectedLabel}</strong>`
        : `theo RAM <strong>${virtualization.selectedLabel}</strong>`;

    html += `<div data-k8s-recommendation="1" class="recommendation-panel">
                <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa ${recommendationTarget}, lựa chọn số N theo mode đã chọn:
                ${recommendationFormula} ≈ <strong>${ketqua}</strong>
            </div>`;

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Bảng phân bổ theo số lượng N</h4>`;
    html += `<table class="sizing-table k8s-n-table u-mt-8" data-k8s-n-table="1">
                <thead>
                    <tr>
                        <th class="col-w-120">Giá trị N</th>
                        <th>Cint CPU yêu cầu</th>
                        <th>RAM yêu cầu</th>
                        ${storageAfterKPI.map(item => `<th>${escapeHtml(item.name)} yêu cầu</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr class="diff-row-muted">
                        <td class="text-center">1</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        ${storageAfterKPI.map(item => `<td class="text-center">${item.afterKPI.toFixed(2)}</td>`).join('')}
                    </tr>
                    <tr class="diff-row-success diff-row-strong">
                        <td class="text-center">${ketqua}</td>
                        <td class="text-center">${(cintAfterKPI / ketqua).toFixed(2)}</td>
                        <td class="text-center">${(ramAfterKPI / ketqua).toFixed(2)}</td>
                        ${storageAfterKPI.map(item => `<td class="text-center">${(item.afterKPI / ketqua).toFixed(2)}</td>`).join('')}
                    </tr>
                </tbody></table>`;

    const cintPerServer = Math.ceil(cintAfterKPI / ketqua);
    const ramPerServer = Math.ceil(ramAfterKPI / ketqua);
    const storagePerServer = storageAfterKPI.map(item => ({
        name: item.name,
        perServer: Math.ceil(item.afterKPI / ketqua)
    }));

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table k8s-proposal-table u-mt-8" data-k8s-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-150">Thành phần</th>
                        <th class="col-w-250">Cấu hình</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>K8S Master</strong></td>
                        <td>
                            <ul class="list-compact">
                                <li>CPU: 4 vCPU</li>
                                <li>RAM: 8 GB</li>
                                <li>DISK: 100 GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>3</strong></td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">Storage Master phải nằm ở 3 cụm storage khác nhau</textarea></td>
                    </tr>
                    <tr class="diff-row-success">
                        <td><strong>K8S Worker</strong></td>
                        <td>
                            <ul class="list-compact">
                                <li>CPU: = ${cintPerServer} Cint</li>
                                <li>RAM: = ${ramPerServer} GB</li>
                                ${storagePerServer.map(item => `<li>${escapeHtml(item.name)}: = ${item.perServer} GB</li>`).join('')}
                            </ul>
                        </td>
                        <td class="text-center"><strong>${ketqua + 1}</strong></td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">Dự phòng N+1</textarea></td>
                    </tr>
                    <tr>
                        <td><strong>K8S ETCD</strong></td>
                        <td>
                            <ul class="list-compact">
                                <li>CPU: 4 vCPU</li>
                                <li>RAM: 8 GB</li>
                                <li>DISK: 100 GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>3</strong></td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">Storage ETCD phải nằm ở 3 cụm storage khác nhau</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    html += buildK8SCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        ensureK8SProposalSelectionUI(container, existingProposalState);
    }
}

function collectK8SBaselineTableData() {
    const rows = getK8SBaselineRows();
    const data = [];
    rows.forEach((row, index) => {
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            stt: index + 1,
            ip: row.querySelector('.k8s-ip-input')?.value || '',
            cpu: row.querySelector('.k8s-cpu-input')?.value || '',
            ram: row.querySelector('.k8s-ram-input')?.value || '',
            disk: row.querySelector('.k8s-disk-input')?.value || '',
            cintRate: row.querySelector('.k8s-cint-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages
        });
    });
    return data;
}

function collectK8SInputConfigTableData() {
    const rows = getK8SInputConfigRows();
    const data = [];
    rows.forEach((row, index) => {
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            stt: index + 1,
            ip: row.querySelector('.k8s-ip-config-input')?.value || '',
            cpuLoad: row.querySelector('.k8s-cpu-load-input')?.value || '',
            ramLoad: row.querySelector('.k8s-ram-load-input')?.value || '',
            cintUsed: row.querySelector('.k8s-cint-used-input')?.value || '',
            ramUsed: row.querySelector('.k8s-ram-used-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
            adminEval: row.querySelector('.k8s-input-config-eval')?.value || '',
            adminNote: row.querySelector('.k8s-input-config-note')?.value || ''
        });
    });
    return data;
}

function collectK8SStorageInputTableData() {
    const rows = getK8SStorageInputRows();
    const data = [];
    rows.forEach((row, index) => {
        data.push({
            stt: index + 1,
            ip: row.querySelector('.k8s-storage-ip-input')?.value || '',
            partition: row.querySelector('.k8s-storage-partition-input')?.value || '',
            used: row.querySelector('.k8s-storage-used-input')?.value || '',
            note: row.querySelector('.k8s-storage-note-input')?.value || '',
            adminEval: row.querySelector('.k8s-storage-eval')?.value || '',
            adminNote: row.querySelector('.k8s-storage-admin-note')?.value || ''
        });
    });
    return data;
}

function collectK8SStorageAdminReviewData() {
    const rows = getK8SStorageInputRows();
    const data = [];
    rows.forEach((row, index) => {
        data.push({
            rowIndex: index,
            eval: row.querySelector('.k8s-storage-eval')?.value || '',
            note: row.querySelector('.k8s-storage-admin-note')?.value || ''
        });
    });
    return data;
}

function collectK8SData() {
    const resultContainer = document.getElementById('k8s-result-container');
    syncTextareasInContainer(resultContainer);
    const customProposalTable = collectK8SCustomProposalTableData(resultContainer);
    const selectedProposalSource = normalizeK8SProposalSource(getK8SSelectedProposalSource(resultContainer), customProposalTable);

    return {
        baselineTable: collectK8SBaselineTableData(),
        inputConfigTable: collectK8SInputConfigTableData(),
        storageInputTable: collectK8SStorageInputTableData(),
        selectedInputRow: document.getElementById('k8s-input-row-select')?.value || '',
        selectedInputRowLabel: getSelectedInputRowLabel('k8s-input-row-select'),
        pocValue: document.getElementById('k8s-poc-value')?.value || '',
        sizingValue: document.getElementById('k8s-sizing-value')?.value || '',
        virtualizationMode: document.getElementById('k8s-virtualization-mode')?.value || 'ram',
        vcpuFlavor: document.getElementById('k8s-vcpu-flavor')?.value || '8',
        ramFlavor: document.getElementById('k8s-ram-flavor')?.value || '32',
        flavorEval: document.getElementById('k8s-flavor-eval')?.value || '',
        flavorNote: document.getElementById('k8s-flavor-note')?.value || '',
        selectedProposalSource: selectedProposalSource,
        customProposalTable: customProposalTable,
        sizingResult: (() => {
            if (resultContainer) {
                return resultContainer.innerHTML;
            }
            return '';
        })()
    };
}

function loadK8SData(data) {
    if (!data) return;

    const baselineTbody = document.getElementById('k8s-baseline-table-body');
    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');
    const storageTbody = document.getElementById('k8s-storage-input-table-body');
    if (baselineTbody) baselineTbody.innerHTML = '';
    if (inputConfigTbody) inputConfigTbody.innerHTML = '';
    if (storageTbody) storageTbody.innerHTML = '';

    // Load baseline table
    if (data.baselineTable && Array.isArray(data.baselineTable) && data.baselineTable.length > 0) {
        const tbody = baselineTbody;
        if (tbody) {
            tbody.innerHTML = '';
            if (inputConfigTbody) inputConfigTbody.innerHTML = '';

            data.baselineTable.forEach(row => {
                addK8SBaselineRow();
                const lastRow = tbody.lastElementChild;
                if (lastRow) {
                    const ipInput = lastRow.querySelector('.k8s-ip-input');
                    const cpuInput = lastRow.querySelector('.k8s-cpu-input');
                    const ramInput = lastRow.querySelector('.k8s-ram-input');
                    const diskInput = lastRow.querySelector('.k8s-disk-input');
                    const cintInput = lastRow.querySelector('.k8s-cint-input');

                    if (ipInput) ipInput.value = row.ip || '';
                    if (cpuInput) cpuInput.value = row.cpu || '';
                    if (ramInput) ramInput.value = row.ram || '';
                    if (diskInput) diskInput.value = row.disk || '';
                    if (cintInput) cintInput.value = row.cintRate || '';

                    const k8sBaselineEvidenceImages = getEvidenceImagesFromRowData(row);
                    if (k8sBaselineEvidenceImages.length > 0) {
                        const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                        if (evidenceCell) loadInlineEvidence(evidenceCell, k8sBaselineEvidenceImages);
                    }
                }
            });
            updateK8SBaselineTotal();
            refreshStorageIpDropdowns('k8s');
        }
    }

    // Load input config table
    if (data.inputConfigTable && Array.isArray(data.inputConfigTable) && data.inputConfigTable.length > 0) {
        const tbody = document.getElementById('k8s-input-config-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            data.inputConfigTable.forEach(row => {
                addK8SInputConfigRow();
                const lastRow = tbody.lastElementChild;
                if (lastRow) {
                    const ipInput = lastRow.querySelector('.k8s-ip-config-input');
                    const cpuLoadInput = lastRow.querySelector('.k8s-cpu-load-input');
                    const ramLoadInput = lastRow.querySelector('.k8s-ram-load-input');
                    const cintUsedInput = lastRow.querySelector('.k8s-cint-used-input');
                    const ramUsedInput = lastRow.querySelector('.k8s-ram-used-input');

                    if (ipInput) ipInput.value = row.ip || '';
                    if (cpuLoadInput) cpuLoadInput.value = row.cpuLoad || '';
                    if (ramLoadInput) ramLoadInput.value = row.ramLoad || '';
                    if (cintUsedInput) cintUsedInput.value = row.cintUsed || '';
                    if (ramUsedInput) ramUsedInput.value = row.ramUsed || '';

                    const k8sInputEvidenceImages = getEvidenceImagesFromRowData(row);
                    if (k8sInputEvidenceImages.length > 0) {
                        const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                        if (evidenceCell) loadInlineEvidence(evidenceCell, k8sInputEvidenceImages);
                    }

                    const evalSelect = lastRow.querySelector('.k8s-input-config-eval');
                    const noteInput = lastRow.querySelector('.k8s-input-config-note');
                    if (evalSelect && row.adminEval) { evalSelect.value = row.adminEval; styleAdminSelect(evalSelect); }
                    if (noteInput && row.adminNote) noteInput.value = row.adminNote;
                }
            });
            updateK8SInputConfigTotal();
        }
    }

    if (storageTbody) storageTbody.innerHTML = '';
    if (data.storageInputTable && Array.isArray(data.storageInputTable) && data.storageInputTable.length > 0) {
        data.storageInputTable.forEach(row => {
            addK8SStorageInputRow();
            const lastRow = storageTbody.lastElementChild;
            if (!lastRow) return;

            const ipInput = lastRow.querySelector('.k8s-storage-ip-input');
            const partitionInput = lastRow.querySelector('.k8s-storage-partition-input');
            const usedInput = lastRow.querySelector('.k8s-storage-used-input');
            const noteInput = lastRow.querySelector('.k8s-storage-note-input');
            const evalSelect = lastRow.querySelector('.k8s-storage-eval');
            const adminNoteInput = lastRow.querySelector('.k8s-storage-admin-note');

            setStorageIpSelectValue(ipInput, 'k8s', row.ip || '');
            if (partitionInput) partitionInput.value = row.partition || '';
            if (usedInput) usedInput.value = row.used || '';
            if (noteInput) noteInput.value = row.note || '';
            if (evalSelect && row.adminEval) {
                evalSelect.value = row.adminEval;
                styleAdminSelect(evalSelect);
            }
            if (adminNoteInput) adminNoteInput.value = row.adminNote || '';
        });
    }

    ensureDefaultK8SSizingRows();
    refreshStorageIpDropdowns('k8s');

    // Load POC and Sizing values
    if (data.selectedInputRow !== undefined && data.selectedInputRow !== '' && document.getElementById('k8s-input-row-select')) {
        document.getElementById('k8s-input-row-select').value = data.selectedInputRow;
        onInputRowSelect(document.getElementById('k8s-input-row-select'), 'k8s-poc-value', 'k8s-sizing-value');
    }
    if (data.pocValue && document.getElementById('k8s-poc-value')) {
        safeSetValue(document.getElementById('k8s-poc-value'), data.pocValue);
    }
    if (data.sizingValue && document.getElementById('k8s-sizing-value')) {
        safeSetValue(document.getElementById('k8s-sizing-value'), data.sizingValue);
    }

    if (document.getElementById('k8s-virtualization-mode')) {
        document.getElementById('k8s-virtualization-mode').value = data.virtualizationMode || 'ram';
        if (document.getElementById('k8s-vcpu-flavor')) {
            document.getElementById('k8s-vcpu-flavor').value = data.vcpuFlavor || '8';
        }
        if (document.getElementById('k8s-ram-flavor')) {
            document.getElementById('k8s-ram-flavor').value = data.ramFlavor || '32';
        }
        onVirtualizationModeChange('k8s');
    }
    if (document.getElementById('k8s-flavor-eval')) {
        document.getElementById('k8s-flavor-eval').value = data.flavorEval || '';
        styleAdminSelect(document.getElementById('k8s-flavor-eval'));
    }
    if (document.getElementById('k8s-flavor-note')) {
        document.getElementById('k8s-flavor-note').value = data.flavorNote || '';
    }

    // Load sizing result
    if (data.sizingResult && document.getElementById('k8s-result-container')) {
        const container = document.getElementById('k8s-result-container');
        container.innerHTML = data.sizingResult;
        ensureK8SProposalSelectionUI(container, {
            selectedProposalSource: data.selectedProposalSource || 'auto',
            customProposalTable: data.customProposalTable || getDefaultK8SCustomProposalTable()
        });
    }

    // Auto expand if has data
    if (data.pocValue || data.sizingValue || data.sizingResult ||
        (data.baselineTable && data.baselineTable.length > 0) ||
        (data.inputConfigTable && data.inputConfigTable.length > 0) ||
        (data.storageInputTable && data.storageInputTable.length > 0)) {
        const content = document.getElementById('module-k8s-content');
        const header = content?.previousElementSibling;
        if (content && !content.classList.contains('expanded')) {
            content.classList.add('expanded');
            if (header) header.classList.add('active');
        }
    }
}

// ==================== MODULE LB/FW FUNCTIONS ====================

function addLBFWEvidenceSlot() {
    const grid = document.getElementById('lbfw-evidence-grid');
    if (!grid) return;

    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleLBFWEvidenceUpload(this)" class="is-hidden">
        <div class="preview-area"></div>
        <div class="upload-placeholder" onclick="this.parentElement.querySelector('input[type=file]').click()">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Click để upload</span>
        </div>
    `;
    grid.appendChild(slot);
}

function handleLBFWEvidenceUpload(input) {
    const slot = input.closest('.upload-box');
    const previewArea = slot.querySelector('.preview-area');
    const placeholder = slot.querySelector('.upload-placeholder');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewArea.innerHTML = `
                <div class="u-flex u-align-center u-gap-8 u-p-8">
                    <img src="${e.target.result}" alt="Evidence" class="is-hidden">
                    <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteLBFWEvidenceSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>
            `;
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function deleteLBFWEvidenceSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.upload-box');
        slot.remove();
    }
}

function collectLBFWEvidenceData() {
    const grid = document.getElementById('lbfw-evidence-grid');
    if (!grid) return [];

    const images = [];
    grid.querySelectorAll('.upload-box').forEach((box, index) => {
        const img = box.querySelector('.preview-area img');
        if (img && img.src && !img.src.includes('placeholder') && !img.src.endsWith('#')) {
            images.push({ index: index, dataUrl: img.src });
        }
    });
    return images;
}

function calculateLBFWSizing() {
    // Try to get context from closest wrapper first (for buttons called directly without runInInstanceContext)
    // then fall back to __activeInstanceKey
    const activeInstanceKey = window.__activeInstanceKey || '';
    const activeCleanKey = activeInstanceKey.includes('__inst_') ? activeInstanceKey.split('__inst_')[0] : activeInstanceKey;

    // Find wrapper from button's ancestor chain
    const btn = document.activeElement?.closest?.('button') || document.querySelector('button[onclick*="calculateLBFWSizing"]');
    const wrapper = btn?.closest('.module-instance-wrapper[data-instance-key]');
    const wrapperInstKey = wrapper?.dataset.instanceKey || '';
    const wrapperCleanKey = wrapperInstKey.includes('__inst_') ? wrapperInstKey.split('__inst_')[0] : wrapperInstKey;

    // Prefer wrapper context, fall back to __activeInstanceKey
    const cleanKey = wrapperCleanKey || activeCleanKey;

    // Find elements with instance suffix first, fall back to fixed IDs
    const pocId = cleanKey ? `lbfw-poc-value__inst_${cleanKey}` : 'lbfw-poc-value';
    const sizingId = cleanKey ? `lbfw-sizing-value__inst_${cleanKey}` : 'lbfw-sizing-value';
    const peakUploadId = cleanKey ? `lbfw-peak-upload__inst_${cleanKey}` : 'lbfw-peak-upload';
    const peakDownloadId = cleanKey ? `lbfw-peak-download__inst_${cleanKey}` : 'lbfw-peak-download';
    const containerId = cleanKey ? `lbfw-result-container__inst_${cleanKey}` : 'lbfw-result-container';

    const pocEl = document.getElementById(pocId) || document.getElementById('lbfw-poc-value');
    const sizingEl = document.getElementById(sizingId) || document.getElementById('lbfw-sizing-value');
    const poc = parseFloat(pocEl?.value) || 0;
    const sizing = parseFloat(sizingEl?.value) || 0;
    if (!poc || !sizing) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".', 'warning');
        return;
    }

    const peakUploadEl = document.getElementById(peakUploadId) || document.getElementById('lbfw-peak-upload');
    const peakDownloadEl = document.getElementById(peakDownloadId) || document.getElementById('lbfw-peak-download');
    const peakUpload = parseFloat(peakUploadEl?.value) || 0;
    const peakDownload = parseFloat(peakDownloadEl?.value) || 0;

    if (!peakUpload && !peakDownload) {
        showToast('Vui lòng nhập Peak Upload hoặc Peak Download.', 'warning');
        return;
    }

    const factor = sizing / poc;
    const container = document.getElementById(containerId) || document.getElementById('lbfw-result-container');
    const existingProposalState = getCurrentLBFWProposalState(container);
    const scaledUpload = peakUpload * factor;
    const scaledDownload = peakDownload * factor;
    const totalBandwidth = scaledUpload + scaledDownload;
    const totalBandwidthGbps = (totalBandwidth / 1000).toFixed(4);

    let html = '';

    html += `<h4 class="u-mt-16 u-mb-8 u-text-section">Bảng tính toán băng thông</h4>`;
    html += `<table class="sizing-table u-mt-8" data-lbfw-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-50">STT</th>
                        <th class="col-w-350">Thông số</th>
                        <th class="col-w-150">Giá trị (Mbps)</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="text-center">1</td>
                        <td>Peak Upload sau định cỡ</td>
                        <td class="text-center">${scaledUpload.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${peakUpload} × (${sizing} / ${poc}) = ${peakUpload} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>Peak Download sau định cỡ</td>
                        <td class="text-center">${scaledDownload.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${peakDownload} × (${sizing} / ${poc}) = ${peakDownload} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr class="diff-row-success diff-row-strong">
                        <td class="text-center">3</td>
                        <td>Tổng băng thông (Upload + Download)</td>
                        <td class="text-center">${totalBandwidth.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1">= ${scaledUpload.toFixed(2)} + ${scaledDownload.toFixed(2)} = ${totalBandwidth.toFixed(2)} Mbps ≈ ${totalBandwidthGbps} Gbps</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    html += `<h4 class="u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table u-mt-8">
                <thead>
                    <tr>
                        <th class="col-w-150">Thành phần</th>
                        <th class="col-w-250">Thông lượng</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="diff-row-success">
                        <td><strong>FW/LB</strong></td>
                        <td class="text-center"><strong>Thông lượng < ${totalBandwidthGbps} Gbps</strong></td>
                        <td class="text-center"></td>
                        <td><textarea class="input-full sizing-note u-resize-y textarea-min-xs" rows="1"></textarea></td>
                    </tr>
                </tbody>
            </table>`;

    html += buildLBFWCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        ensureLBFWProposalSelectionUI(container, existingProposalState);
    }
}

function collectLBFWBandwidthMethodData() {
    const resultContainer = document.getElementById('lbfw-result-container');
    syncTextareasInContainer(resultContainer);
    const customProposalTable = collectLBFWCustomProposalTableData(resultContainer);
    const selectedProposalSource = normalizeLBFWProposalSource(getLBFWSelectedProposalSource(resultContainer), customProposalTable);

    return {
        evidenceImages: collectLBFWEvidenceData(),
        peakUpload: document.getElementById('lbfw-peak-upload')?.value || '',
        peakDownload: document.getElementById('lbfw-peak-download')?.value || '',
        selectedInputRow: document.getElementById('lbfw-input-row-select')?.value || '',
        selectedInputRowLabel: getSelectedInputRowLabel('lbfw-input-row-select'),
        pocValue: document.getElementById('lbfw-poc-value')?.value || '',
        sizingValue: document.getElementById('lbfw-sizing-value')?.value || '',
        selectedProposalSource: selectedProposalSource,
        customProposalTable: customProposalTable,
        sizingResult: (() => {
            if (resultContainer) {
                return resultContainer.innerHTML;
            }
            return '';
        })()
    };
}

function loadLBFWBandwidthMethodData(data = {}) {
    // Load evidence images
    if (data.evidenceImages && Array.isArray(data.evidenceImages) && data.evidenceImages.length > 0) {
        const grid = document.getElementById('lbfw-evidence-grid');
        if (grid) {
            grid.innerHTML = '';
            data.evidenceImages.forEach(imgData => {
                addLBFWEvidenceSlot();
                const lastSlot = grid.lastElementChild;
                if (lastSlot && imgData.dataUrl) {
                    const previewArea = lastSlot.querySelector('.preview-area');
                    const placeholder = lastSlot.querySelector('.upload-placeholder');
                    previewArea.innerHTML = `
                        <div class="u-flex u-align-center u-gap-8 u-p-8">
                            <img src="${imgData.dataUrl}" alt="Evidence" class="is-hidden">
                            <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteLBFWEvidenceSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                        </div>
                    `;
                    if (placeholder) placeholder.style.display = 'none';
                }
            });
        }
    }

    // Load peak values
    if (data.peakUpload && document.getElementById('lbfw-peak-upload')) {
        document.getElementById('lbfw-peak-upload').value = data.peakUpload;
    }
    if (data.peakDownload && document.getElementById('lbfw-peak-download')) {
        document.getElementById('lbfw-peak-download').value = data.peakDownload;
    }

    // Load POC and Sizing
    if (data.selectedInputRow !== undefined && data.selectedInputRow !== '' && document.getElementById('lbfw-input-row-select')) {
        document.getElementById('lbfw-input-row-select').value = data.selectedInputRow;
        onInputRowSelect(document.getElementById('lbfw-input-row-select'), 'lbfw-poc-value', 'lbfw-sizing-value');
    }
    if (data.pocValue && document.getElementById('lbfw-poc-value')) {
        safeSetValue(document.getElementById('lbfw-poc-value'), data.pocValue);
    }
    if (data.sizingValue && document.getElementById('lbfw-sizing-value')) {
        safeSetValue(document.getElementById('lbfw-sizing-value'), data.sizingValue);
    }

    // Load sizing result
    if (data.sizingResult && document.getElementById('lbfw-result-container')) {
        const container = document.getElementById('lbfw-result-container');
        container.innerHTML = data.sizingResult;
        ensureLBFWProposalSelectionUI(container, {
            selectedProposalSource: data.selectedProposalSource || 'auto',
            customProposalTable: data.customProposalTable || getDefaultLBFWCustomProposalTable()
        });
    }

    // Auto expand if has data
    if (data.peakUpload || data.peakDownload || data.sizingResult ||
        (data.evidenceImages && data.evidenceImages.length > 0)) {
        const content = document.getElementById('module-lbfw-content');
        const header = content?.previousElementSibling;
        if (content && !content.classList.contains('expanded')) {
            content.classList.add('expanded');
            if (header) header.classList.add('active');
        }
    }
}

function normalizeLBFWLegacyData(data = {}) {
    if (data && data.selectedMethod) {
        return data;
    }
    return {
        selectedMethod: 'bandwidthMethod',
        bandwidthMethod: data || {},
        customMethodDocHtml: '',
        customMethodDocText: '',
        customProposalTable: []
    };
}

function collectLBFWData() {
    const selectedMethod = document.getElementById('lbfw-method-select')?.value || 'bandwidthMethod';
    const bandwidthMethod = collectLBFWBandwidthMethodData();
    const customMethod = collectLBFWCustomMethodData();

    return {
        selectedMethod,
        bandwidthMethod,
        customMethodDocHtml: customMethod.customMethodDocHtml,
        customMethodDocText: customMethod.customMethodDocText,
        customProposalTable: customMethod.customProposalTable
    };
}

function loadLBFWData(data) {
    if (!data) return;

    const normalizedData = normalizeLBFWLegacyData(data);
    const select = document.getElementById('lbfw-method-select');
    if (select) select.value = normalizedData.selectedMethod || 'bandwidthMethod';

    loadLBFWBandwidthMethodData(normalizedData.bandwidthMethod || {});
    loadLBFWCustomMethodData(normalizedData);
    if (select) onLBFWMethodChanged(select);
}

function getDefaultK8SCustomProposalTable() {
    return [
        {
            component: 'K8S Master',
            configurationText: '',
            quantity: '',
            note: ''
        },
        {
            component: 'K8S Worker',
            configurationText: '',
            quantity: '',
            note: ''
        },
        {
            component: 'K8S ETCD',
            configurationText: '',
            quantity: '',
            note: ''
        }
    ];
}

function normalizeK8SCustomProposalTable(rows) {
    const defaults = getDefaultK8SCustomProposalTable();
    if (!Array.isArray(rows)) return defaults;

    const rowMap = new Map();
    rows.forEach(row => {
        const component = String(row?.component || '').trim();
        if (component) {
            rowMap.set(component.toLowerCase(), {
                component,
                configurationText: String(row?.configurationText || ''),
                quantity: String(row?.quantity || ''),
                note: String(row?.note || '')
            });
        }
    });

    return defaults.map(defaultRow => {
        const current = rowMap.get(defaultRow.component.toLowerCase()) || {};
        return {
            component: defaultRow.component,
            configurationText: String(current.configurationText || ''),
            quantity: String(current.quantity || ''),
            note: String(current.note || '')
        };
    });
}

function isK8SCustomProposalTableFilled(customProposalTable) {
    return normalizeK8SCustomProposalTable(customProposalTable)
        .some(row => row.configurationText.trim());
}

function normalizeK8SProposalSource(source, customProposalTable) {
    return source === 'custom' && isK8SCustomProposalTableFilled(customProposalTable) ? 'custom' : 'auto';
}

function collectK8SCustomProposalTableData(container) {
    if (!container) return getDefaultK8SCustomProposalTable();
    const rows = [];
    container.querySelectorAll('.k8s-custom-proposal-row').forEach(row => {
        rows.push({
            component: row.dataset.component || '',
            configurationText: row.querySelector('.k8s-custom-proposal-config')?.value || '',
            quantity: row.querySelector('.k8s-custom-proposal-qty')?.value || '',
            note: row.querySelector('.k8s-custom-proposal-note')?.value || ''
        });
    });
    return normalizeK8SCustomProposalTable(rows);
}

function getK8SSelectedProposalSource(container) {
    const value = container?.querySelector('.k8s-proposal-source-select')?.value || 'auto';
    return value === 'custom' ? 'custom' : 'auto';
}

function getCurrentK8SProposalState(container) {
    return {
        selectedProposalSource: getK8SSelectedProposalSource(container),
        customProposalTable: collectK8SCustomProposalTableData(container)
    };
}

function updateK8SProposalSourceUI(container, selectedSource = 'auto') {
    if (!container) return;

    const normalizedSource = selectedSource === 'custom' ? 'custom' : 'auto';
    const effectiveSource = normalizeK8SProposalSource(normalizedSource, collectK8SCustomProposalTableData(container));
    const select = container.querySelector('.k8s-proposal-source-select');
    const toolHeading = container.querySelector('.k8s-tool-proposal-heading');
    const customHeading = container.querySelector('.k8s-custom-proposal-heading');
    const customSection = container.querySelector('.k8s-custom-proposal-section');
    const autoTable = container.querySelector('[data-k8s-proposal-table="1"]');
    const customTable = container.querySelector('[data-k8s-custom-proposal-table="1"]');

    if (select) select.value = normalizedSource;
    if (toolHeading) toolHeading.textContent = effectiveSource === 'auto'
        ? 'Đề xuất cấu hình do tool tạo (đang dùng)'
        : 'Đề xuất cấu hình do tool tạo';
    if (customHeading) customHeading.textContent = effectiveSource === 'custom'
        ? 'Đề xuất cấu hình tùy chỉnh (đang dùng)'
        : 'Đề xuất cấu hình tùy chỉnh';
    if (customSection) {
        customSection.classList.toggle('is-hidden', normalizedSource !== 'custom');
    }

    if (autoTable) {
        autoTable.style.outline = effectiveSource === 'auto' ? '2px solid #38b2ac' : 'none';
        autoTable.style.outlineOffset = effectiveSource === 'auto' ? '2px' : '0';
    }
    if (customTable) {
        customTable.style.outline = effectiveSource === 'custom' ? '2px solid #38b2ac' : 'none';
        customTable.style.outlineOffset = effectiveSource === 'custom' ? '2px' : '0';
    }
}

function handleK8SProposalSourceChange(selectEl) {
    const container = selectEl?.closest('#k8s-result-container');
    if (!container) return;

    const selectedSource = selectEl.value === 'custom' ? 'custom' : 'auto';

    updateK8SProposalSourceUI(container, selectedSource);
    markSummaryNeedsSizingRefresh();
}

function buildK8SCustomProposalSectionHtml(selectedProposalSource, customProposalTable) {
    const normalizedRows = normalizeK8SCustomProposalTable(customProposalTable);
    const normalizedSource = selectedProposalSource === 'custom' ? 'custom' : 'auto';

    return `
        <div class="k8s-proposal-source-panel proposal-source-panel">
            <label class="panel-label-compact">Bạn có muốn chỉnh sửa cấu hình không?</label>
            <select class="input-full k8s-proposal-source-select" onchange="handleK8SProposalSourceChange(this)">
                <option value="auto" ${normalizedSource === 'auto' ? 'selected' : ''}>Không</option>
                <option value="custom" ${normalizedSource === 'custom' ? 'selected' : ''}>Có</option>
            </select>
        </div>
        <div class="k8s-custom-proposal-section ${normalizedSource === 'custom' ? '' : 'is-hidden'}">
            <h4 class="k8s-custom-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình tùy chỉnh</h4>
            <table class="sizing-table k8s-custom-proposal-table u-mt-8" data-k8s-custom-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-150">Thành phần</th>
                        <th class="col-w-250">Cấu hình</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${normalizedRows.map(row => `
                        <tr class="k8s-custom-proposal-row" data-component="${escapeHtml(row.component)}">
                            <td><strong>${escapeHtml(row.component)}</strong></td>
                            <td><textarea class="input-full k8s-custom-proposal-config u-resize-none u-overflow-hidden" rows="4" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Mỗi dòng là một thông số cấu hình">${escapeHtml(row.configurationText)}</textarea></td>
                            <td class="text-center"><input type="text" class="input-full text-center k8s-custom-proposal-qty" value="${escapeHtml(row.quantity)}" placeholder="Số lượng"></td>
                            <td><textarea class="input-full k8s-custom-proposal-note u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(row.note)}</textarea></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

function ensureK8SProposalSelectionUI(container, options = {}) {
    if (!container) return;

    let autoTable = container.querySelector('[data-k8s-proposal-table="1"]');
    if (!autoTable) {
        const tables = container.querySelectorAll('table.sizing-table');
        autoTable = tables.length ? tables[tables.length - 1] : null;
        if (autoTable) {
            autoTable.setAttribute('data-k8s-proposal-table', '1');
        }
    }
    if (!autoTable) return;

    const toolHeading = autoTable.previousElementSibling;
    if (toolHeading && toolHeading.tagName === 'H4') {
        toolHeading.classList.add('k8s-tool-proposal-heading');
    }

    if (!container.querySelector('[data-k8s-custom-proposal-table="1"]')) {
        autoTable.insertAdjacentHTML(
            'afterend',
            buildK8SCustomProposalSectionHtml(
                options.selectedProposalSource || 'auto',
                options.customProposalTable || getDefaultK8SCustomProposalTable()
            )
        );
    }

    const normalizedRows = normalizeK8SCustomProposalTable(options.customProposalTable || collectK8SCustomProposalTableData(container));
    container.querySelectorAll('.k8s-custom-proposal-row').forEach(row => {
        const component = row.dataset.component || '';
        const rowData = normalizedRows.find(item => item.component === component) || { configurationText: '', quantity: '', note: '' };
        const configInput = row.querySelector('.k8s-custom-proposal-config');
        const qtyInput = row.querySelector('.k8s-custom-proposal-qty');
        const noteInput = row.querySelector('.k8s-custom-proposal-note');
        if (configInput) configInput.value = rowData.configurationText;
        if (qtyInput) qtyInput.value = rowData.quantity;
        if (noteInput) noteInput.value = rowData.note;
    });

    try { autoResizeAllCustomProposalConfig(container); } catch (e) { }

    updateK8SProposalSourceUI(container, options.selectedProposalSource || 'auto');
}

function buildEffectiveK8SCustomProposalData(customProposalTable) {
    const normalizedRows = normalizeK8SCustomProposalTable(customProposalTable);
    const results = [];

    normalizedRows.forEach(row => {
        const lines = row.configurationText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return;

        results.push({
            module: row.component,
            cauHinh: lines.map(line => `- ${escapeHtml(line)}`).join('<br>'),
            soLuong: row.quantity.trim(),
            ghiChu: row.note.trim()
        });
    });

    return results.length > 0 ? results : null;
}

function resolveEffectiveK8SProposalResult(k8sState = {}) {
    const resultHTML = k8sState.resultHTML || '';
    const autoParsed = parseK8SSizingResult(resultHTML);
    const customProposalTable = normalizeK8SCustomProposalTable(k8sState.customProposalTable);
    const selectedProposalSource = normalizeK8SProposalSource(k8sState.selectedProposalSource || 'auto', customProposalTable);

    if (selectedProposalSource === 'custom') {
        const customParsed = buildEffectiveK8SCustomProposalData(customProposalTable);
        if (customParsed) {
            return customParsed;
        }
    }

    return autoParsed;
}

function getDefaultLBFWCustomProposalTable() {
    return {
        component: 'FW/LB',
        configurationText: '',
        quantity: '',
        note: ''
    };
}

function normalizeLBFWCustomProposalTable(data) {
    const defaults = getDefaultLBFWCustomProposalTable();
    if (!data || typeof data !== 'object') return defaults;
    return {
        component: defaults.component,
        configurationText: String(data.configurationText || ''),
        quantity: String(data.quantity || ''),
        note: String(data.note || '')
    };
}

function isLBFWCustomProposalTableFilled(customProposalTable) {
    return !!normalizeLBFWCustomProposalTable(customProposalTable).configurationText.trim();
}

function normalizeLBFWProposalSource(source, customProposalTable) {
    return source === 'custom' && isLBFWCustomProposalTableFilled(customProposalTable) ? 'custom' : 'auto';
}

function collectLBFWCustomProposalTableData(container) {
    if (!container) return getDefaultLBFWCustomProposalTable();
    return normalizeLBFWCustomProposalTable({
        configurationText: container.querySelector('.lbfw-custom-proposal-config')?.value || '',
        quantity: container.querySelector('.lbfw-custom-proposal-qty')?.value || '',
        note: container.querySelector('.lbfw-custom-proposal-note')?.value || ''
    });
}

function getLBFWSelectedProposalSource(container) {
    const value = container?.querySelector('.lbfw-proposal-source-select')?.value || 'auto';
    return value === 'custom' ? 'custom' : 'auto';
}

function getCurrentLBFWProposalState(container) {
    return {
        selectedProposalSource: getLBFWSelectedProposalSource(container),
        customProposalTable: collectLBFWCustomProposalTableData(container)
    };
}

function updateLBFWProposalSourceUI(container, selectedSource = 'auto') {
    if (!container) return;

    const normalizedSource = selectedSource === 'custom' ? 'custom' : 'auto';
    const effectiveSource = normalizeLBFWProposalSource(normalizedSource, collectLBFWCustomProposalTableData(container));
    const select = container.querySelector('.lbfw-proposal-source-select');
    const toolHeading = container.querySelector('.lbfw-tool-proposal-heading');
    const customHeading = container.querySelector('.lbfw-custom-proposal-heading');
    const customSection = container.querySelector('.lbfw-custom-proposal-section');
    const autoTable = container.querySelector('[data-lbfw-proposal-table="1"]');
    const customTable = container.querySelector('[data-lbfw-custom-proposal-table="1"]');

    if (select) select.value = normalizedSource;
    if (toolHeading) toolHeading.textContent = effectiveSource === 'auto'
        ? 'Đề xuất cấu hình do tool tạo (đang dùng)'
        : 'Đề xuất cấu hình do tool tạo';
    if (customHeading) customHeading.textContent = effectiveSource === 'custom'
        ? 'Đề xuất cấu hình tùy chỉnh (đang dùng)'
        : 'Đề xuất cấu hình tùy chỉnh';
    if (customSection) {
        customSection.classList.toggle('is-hidden', normalizedSource !== 'custom');
    }

    if (autoTable) {
        autoTable.style.outline = effectiveSource === 'auto' ? '2px solid #38b2ac' : 'none';
        autoTable.style.outlineOffset = effectiveSource === 'auto' ? '2px' : '0';
    }
    if (customTable) {
        customTable.style.outline = effectiveSource === 'custom' ? '2px solid #38b2ac' : 'none';
        customTable.style.outlineOffset = effectiveSource === 'custom' ? '2px' : '0';
    }
}

function handleLBFWProposalSourceChange(selectEl) {
    const container = selectEl?.closest('#lbfw-result-container');
    if (!container) return;

    const selectedSource = selectEl.value === 'custom' ? 'custom' : 'auto';

    updateLBFWProposalSourceUI(container, selectedSource);
    markSummaryNeedsSizingRefresh();
}

function buildLBFWCustomProposalSectionHtml(selectedProposalSource, customProposalTable) {
    const normalizedTable = normalizeLBFWCustomProposalTable(customProposalTable);
    const normalizedSource = selectedProposalSource === 'custom' ? 'custom' : 'auto';

    return `
        <div class="lbfw-proposal-source-panel proposal-source-panel">
            <label class="panel-label-compact">Bạn có muốn chỉnh sửa cấu hình không?</label>
            <select class="input-full lbfw-proposal-source-select" onchange="handleLBFWProposalSourceChange(this)">
                <option value="auto" ${normalizedSource === 'auto' ? 'selected' : ''}>Không</option>
                <option value="custom" ${normalizedSource === 'custom' ? 'selected' : ''}>Có</option>
            </select>
        </div>
        <div class="lbfw-custom-proposal-section ${normalizedSource === 'custom' ? '' : 'is-hidden'}">
            <h4 class="lbfw-custom-proposal-heading u-mt-20 u-mb-8 u-text-section">Đề xuất cấu hình tùy chỉnh</h4>
            <table class="sizing-table lbfw-custom-proposal-table u-mt-8" data-lbfw-custom-proposal-table="1">
                <thead>
                    <tr>
                        <th class="col-w-150">Thành phần</th>
                        <th class="col-w-250">Thông lượng</th>
                        <th class="col-w-100">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>FW/LB</strong></td>
                        <td><textarea class="input-full lbfw-custom-proposal-config u-resize-none u-overflow-hidden" rows="3" oninput="autoResizeCustomProposalTextarea(this)" placeholder="Ví dụ: Thông lượng < 2.5000 Gbps">${escapeHtml(normalizedTable.configurationText)}</textarea></td>
                        <td class="text-center"><input type="text" class="input-full text-center lbfw-custom-proposal-qty" value="${escapeHtml(normalizedTable.quantity)}" placeholder="Số lượng"></td>
                        <td><textarea class="input-full lbfw-custom-proposal-note u-resize-y textarea-min-lg" rows="2" placeholder="Ghi chú">${escapeHtml(normalizedTable.note)}</textarea></td>
                    </tr>
                </tbody>
            </table>
        </div>`;
}

function ensureLBFWProposalSelectionUI(container, options = {}) {
    if (!container) return;

    let autoTable = container.querySelector('[data-lbfw-proposal-table="1"]');
    if (!autoTable) {
        const tables = container.querySelectorAll('table.sizing-table');
        autoTable = tables.length ? tables[tables.length - 1] : null;
        if (autoTable) {
            autoTable.setAttribute('data-lbfw-proposal-table', '1');
        }
    }
    if (!autoTable) return;

    const toolHeading = autoTable.previousElementSibling;
    if (toolHeading && toolHeading.tagName === 'H4') {
        toolHeading.classList.add('lbfw-tool-proposal-heading');
    }

    if (!container.querySelector('[data-lbfw-custom-proposal-table="1"]')) {
        autoTable.insertAdjacentHTML(
            'afterend',
            buildLBFWCustomProposalSectionHtml(
                options.selectedProposalSource || 'auto',
                options.customProposalTable || getDefaultLBFWCustomProposalTable()
            )
        );
    }

    const normalizedTable = normalizeLBFWCustomProposalTable(options.customProposalTable || collectLBFWCustomProposalTableData(container));
    const configInput = container.querySelector('.lbfw-custom-proposal-config');
    const qtyInput = container.querySelector('.lbfw-custom-proposal-qty');
    const noteInput = container.querySelector('.lbfw-custom-proposal-note');
    if (configInput) configInput.value = normalizedTable.configurationText;
    if (qtyInput) qtyInput.value = normalizedTable.quantity;
    if (noteInput) noteInput.value = normalizedTable.note;

    try { autoResizeAllCustomProposalConfig(container); } catch (e) { }

    updateLBFWProposalSourceUI(container, options.selectedProposalSource || 'auto');
}

function buildEffectiveLBFWCustomProposalData(customProposalTable) {
    const normalizedTable = normalizeLBFWCustomProposalTable(customProposalTable);
    if (!normalizedTable.configurationText.trim()) return null;
    return {
        cauHinh: escapeHtml(normalizedTable.configurationText).replace(/\r?\n/g, '<br>'),
        soLuong: normalizedTable.quantity.trim(),
        ghiChu: normalizedTable.note.trim()
    };
}

function resolveEffectiveLBFWProposalResult(lbfwState = {}) {
    const resultHTML = lbfwState.resultHTML || lbfwState.sizingResult || '';
    const autoParsed = parseLBFWSizingResult(resultHTML);
    const customProposalTable = normalizeLBFWCustomProposalTable(lbfwState.customProposalTable);
    const selectedProposalSource = normalizeLBFWProposalSource(lbfwState.selectedProposalSource || 'auto', customProposalTable);

    if (selectedProposalSource === 'custom') {
        const customParsed = buildEffectiveLBFWCustomProposalData(customProposalTable);
        if (customParsed) {
            return customParsed;
        }
    }

    return autoParsed;
}

function resolveLBFWSummaryRows(lbfwData = {}, instanceName = '') {
    const normalizedData = normalizeLBFWLegacyData(lbfwData || {});
    if ((normalizedData.selectedMethod || 'bandwidthMethod') === 'customMethod') {
        const docText = (normalizedData.customMethodDocText || '').trim();
        const proposalRows = Array.isArray(normalizedData.customProposalTable) ? normalizedData.customProposalTable : [];
        const nonEmptyRows = proposalRows.filter(r =>
            (r.component || '').trim() || (r.configuration || '').trim() || (r.quantity || '').trim() || (r.note || '').trim()
        );

        if (nonEmptyRows.length > 0) {
            return nonEmptyRows.map(row => ({
                moduleType: 'FW/LB',
                moduleName: (row.component || '').trim() || instanceName,
                cauHinh: row.configuration ? row.configuration.replace(/\r?\n/g, '<br>') : 'Theo phương pháp khác (xem chi tiết)',
                soLuong: (row.quantity || '').trim(),
                ghiChu: (row.note || '').trim()
            }));
        }

        return [{
            moduleType: 'FW/LB',
            moduleName: instanceName,
            cauHinh: 'Theo phương pháp khác (xem chi tiết)',
            soLuong: '',
            ghiChu: ''
        }];
    }

    const bandwidthData = resolveEffectiveLBFWProposalResult(normalizedData.bandwidthMethod || normalizedData || {});
    if (!bandwidthData) return [];
    return [{
        moduleType: 'FW/LB',
        moduleName: instanceName,
        cauHinh: bandwidthData.cauHinh,
        soLuong: bandwidthData.soLuong,
        ghiChu: bandwidthData.ghiChu
    }];
}

// Parse kết quả Module K8S
function parseK8SSizingResult(html) {
    if (!html || html.trim() === '') return null;

    const cleanText = (raw) => (raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const toDisplayLines = (raw) => {
        const listItems = Array.from((raw || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => cleanText(m[1])).filter(Boolean);
        if (listItems.length > 0) {
            return listItems.map(item => `- ${item}`).join('<br>');
        }
        return cleanText(raw).replace(/\n/g, '<br>');
    };

    const proposalTableMatch = html.match(/<table[^>]*data-k8s-proposal-table="1"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/i);
    if (proposalTableMatch) {
        const rowMatches = Array.from(proposalTableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
        const results = [];

        rowMatches.forEach(match => {
            const tdMatches = Array.from(match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1]);
            if (tdMatches.length < 4) return;

            const componentName = cleanText(tdMatches[0]);
            if (!componentName) return;

            const quantityText = cleanText(tdMatches[2]);
            results.push({
                module: componentName,
                cauHinh: toDisplayLines(tdMatches[1]),
                soLuong: (quantityText.match(/\d+/) || [quantityText])[0] || '',
                ghiChu: cleanText(tdMatches[3])
            });
        });

        if (results.length > 0) {
            return results;
        }
    }

    const configTableMatch = html.match(/Đề xuất cấu hình[\s\S]*?<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/i);
    if (!configTableMatch) return null;

    const tbodyHtml = configTableMatch[1];
    const rowMatches = Array.from(tbodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    if (rowMatches.length === 0) return null;

    const parsedByName = {};
    rowMatches.forEach(match => {
        const rowHtml = match[1];
        const tdMatches = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1]);
        if (tdMatches.length < 4) return;

        const componentName = cleanText(tdMatches[0]);
        if (!componentName) return;

        const listItems = Array.from(tdMatches[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => cleanText(m[1]));
        const listContent = listItems.join('\n');
        const quantityText = cleanText(tdMatches[2]);
        const noteText = cleanText(tdMatches[3]);

        parsedByName[componentName] = {
            listContent,
            quantity: (quantityText.match(/\d+/) || [quantityText])[0] || '',
            note: noteText
        };
    });

    const orderedComponents = ['K8S Master', 'K8S Worker', 'K8S ETCD'];
    const results = [];
    orderedComponents.forEach(componentName => {
        const item = parsedByName[componentName];
        if (!item) return;

        const vcpu = item.listContent.match(/(\d+)\s*vCPU/i);
        const cpuCint = item.listContent.match(/CPU[:\s]*=?\s*(\d+)\s*Cint/i);
        const ram = item.listContent.match(/RAM[:\s=]*(\d+)\s*GB/i) || item.listContent.match(/(\d+)\s*GB/i);
        const disk = item.listContent.match(/DISK[:\s=]*(\d+)\s*GB/i);

        let cauHinh = '';
        if (componentName === 'K8S Worker' && cpuCint) {
            cauHinh += `- CPU = ${cpuCint[1]} Cint\n`;
        } else if (vcpu) {
            cauHinh += `- vCPU = ${vcpu[1]}\n`;
        }
        if (ram) cauHinh += `- RAM = ${ram[1]}GB\n`;
        if (disk) cauHinh += `- Disk = ${disk[1]}GB`;

        const fallbackNote = componentName === 'K8S Worker'
            ? 'Dự phòng N+1'
            : (componentName === 'K8S Master'
                ? 'Storage Master phải nằm ở 3 cụm storage khác nhau'
                : 'Storage ETCD phải nằm ở 3 cụm storage khác nhau');

        results.push({
            module: componentName,
            cauHinh: cauHinh.replace(/\n/g, '<br>'),
            soLuong: item.quantity,
            ghiChu: item.note || fallbackNote
        });
    });

    return results.length > 0 ? results : null;
}

// Parse kết quả Module LB/FW
function parseLBFWSizingResult(html) {
    if (!html || html.trim() === '') return null;

    const throughputGbpsMatch = html.match(/Thông lượng\s*<\s*([\d.]+)\s*Gbps/i);
    const throughputMbpsMatch = html.match(/Tổng băng thông[\s\S]*?<td[^>]*class="text-center"[^>]*>([\d.]+)<\/td>/i);

    if (!throughputGbpsMatch && !throughputMbpsMatch) return null;

    const throughputDisplay = throughputGbpsMatch
        ? `Thông lượng < ${throughputGbpsMatch[1]} Gbps`
        : `Thông lượng ≈ ${(parseFloat(throughputMbpsMatch[1]) / 1000).toFixed(4)} Gbps`;

    return {
        cauHinh: throughputDisplay,
        soLuong: '',
        ghiChu: ''
    };
}

// ==================== MODULE MARIADB FUNCTIONS ====================

function resolveMariaDBMasterGroupName(tbody) {
    let instanceKey = window.__activeInstanceKey || '';

    if (!instanceKey && tbody && tbody.id) {
        const idMatch = tbody.id.match(/__inst_(.+)$/);
        if (idMatch && idMatch[1]) {
            instanceKey = idMatch[1];
        }
    }

    if (!instanceKey && tbody) {
        instanceKey = tbody.closest('.module-instance-wrapper')?.dataset?.instanceKey || '';
    }

    if (!instanceKey) {
        instanceKey = 'default';
    }

    return `mariadb-master-${String(instanceKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function syncMariaDBMasterRadioNames() {
    const tbodies = document.querySelectorAll('tbody[id^="mariadb-ref-table-body"]');
    tbodies.forEach(tbody => {
        const groupName = resolveMariaDBMasterGroupName(tbody);
        tbody.querySelectorAll('.mariadb-master-radio').forEach(radio => {
            radio.name = groupName;
        });
    });
}

function enforceMariaDBMasterWithinTable(radio) {
    if (!radio) return;
    const tbody = radio.closest('tbody');
    if (!tbody) return;

    const groupName = resolveMariaDBMasterGroupName(tbody);
    tbody.querySelectorAll('.mariadb-master-radio').forEach(item => {
        item.name = groupName;
        if (item !== radio) {
            item.checked = false;
        }
    });

    syncMariaDBMasterRadioNames();
}

// Thêm dòng vào bảng thông tin CPU/RAM MariaDB
function addMariaDBRefRow(data = {}) {
    const tbody = document.getElementById('mariadb-ref-table-body');
    if (!tbody) return;
    const masterGroupName = resolveMariaDBMasterGroupName(tbody);

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input mariadb-ip" value="${data.ip || ''}" placeholder="192.168.x.x"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-cpu" value="${data.cpu || ''}" placeholder="CPU" min="0"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-ram" value="${data.ram || ''}" placeholder="RAM" min="0"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-cpu-load" value="${data.cpuLoad || ''}" placeholder="%" min="0" oninput="validateLoadInput(this)"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" oninput="validateLoadInput(this)"></td>
        <td class="text-center">
            <input type="radio" name="${masterGroupName}" class="mariadb-master-radio" onchange="enforceMariaDBMasterWithinTable(this)" ${data.isMaster ? 'checked' : ''}>
        </td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="mariadb-ref-evidence-input is-hidden" onchange="handleInlineEvidenceUpload(this)">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
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
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="this.closest('tr').remove()">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    // Load inline evidence image(s) if provided
    const mariaRefEvidenceImages = getEvidenceImagesFromRowData(data);
    if (mariaRefEvidenceImages.length > 0) {
        const evidenceCell = tr.querySelector('.inline-evidence-cell');
        if (evidenceCell) loadInlineEvidence(evidenceCell, mariaRefEvidenceImages);
    }

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
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            ip: row.querySelector('.mariadb-ip')?.value || '',
            cpu: row.querySelector('.mariadb-cpu')?.value || '',
            ram: row.querySelector('.mariadb-ram')?.value || '',
            cpuLoad: row.querySelector('.mariadb-cpu-load')?.value || '',
            ramLoad: row.querySelector('.mariadb-ram-load')?.value || '',
            isMaster: row.querySelector('.mariadb-master-radio')?.checked || false,
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages
        });
    });
    return data;
}

// Thu thập dữ liệu storage MariaDB (direct input - dataUsed, logUsed, soBanBackup, tiLeNen)
function collectMariaDBStorageData() {
    const evidenceScope = document.getElementById('mariadb-storage-evidence-cell') || document.getElementById('mariadb-storage-evidence-grid');
    const evidenceImages = collectInlineEvidenceFromScope(evidenceScope);
    return {
        dataUsed: document.getElementById('mariadb-storage-data-used')?.value || '',
        logUsed: document.getElementById('mariadb-storage-log-used')?.value || '',
        soBanBackup: document.getElementById('mariadb-storage-backup-copies')?.value || '1',
        tiLeNen: document.getElementById('mariadb-storage-compress-ratio')?.value || '100',
        evidenceImages: evidenceImages
    };
}

// autoCalcMariaDBStorageUsed is no longer needed since user inputs directly

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

// Lấy storage (direct input values)
function getMariaDBStorage() {
    return {
        dataUsed: parseFloat(document.getElementById('mariadb-storage-data-used')?.value) || 0,
        logUsed: parseFloat(document.getElementById('mariadb-storage-log-used')?.value) || 0,
        soBanBackup: parseFloat(document.getElementById('mariadb-storage-backup-copies')?.value) || 1,
        tiLeNen: parseFloat(document.getElementById('mariadb-storage-compress-ratio')?.value) || 100
    };
}

// Tính toán sizing MariaDB
function calculateMariaDBSizing() {
    const inputCCU = parseFloat(document.getElementById('mariadb-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('mariadb-sizing-ccu')?.value) || 0;

    if (!inputCCU || !sizingCCU) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".', 'warning');
        return;
    }

    const masterData = getMariaDBMasterData();
    if (!masterData) {
        showToast('Vui lòng chọn một IP làm Master trong bảng thông tin hệ thống tham chiếu.', 'warning');
        return;
    }

    const storage = getMariaDBStorage();
    const replicationModelRaw = document.getElementById('mariadb-replication-model')?.value || 'asynchronous';
    const replicationModel = replicationModelRaw === 'active-active' ? 'multi-master' : replicationModelRaw;
    const isActiveActive = replicationModel === 'multi-master';
    const modelLabel = isActiveActive
        ? 'Active-Active (Multi-Master)'
        : 'Master-Slave (Asynchronous)';

    if (!storage.dataUsed && !storage.logUsed) {
        showToast('Vui lòng nhập thông tin /data used, /log used trong bảng Storage.', 'warning');
        return;
    }

    // Hệ số
    const factor = sizingCCU / inputCCU;

    // Công thức tính:
    // CPU cần = CPU * Tải CPU * (Định cỡ / Đầu vào) * 1.1 / 0.75
    // RAM cần = RAM * Tải RAM * (Định cỡ / Đầu vào) * 1.1 / 0.9
    // /data cần = /data used * (Định cỡ / Đầu vào) * 1.1 / 0.8
    // /log cần = /log used * (Định cỡ / Đầu vào) * 1.1 / 0.8
    // /backup cần = /data cần * số bản lưu backup * tỉ lệ nén (%)

    const baseCpuNeeded = masterData.cpu * (masterData.cpuLoad / 100) * factor * 1.1 / 0.75;
    const baseRamNeeded = masterData.ram * (masterData.ramLoad / 100) * factor * 1.1 / 0.9;
    const cpuNeeded = isActiveActive ? (baseCpuNeeded / 3) : baseCpuNeeded;
    const ramNeeded = isActiveActive ? (baseRamNeeded / 3) : baseRamNeeded;
    const dataNeeded = storage.dataUsed * factor * 1.1 / 0.8;
    const logNeeded = storage.logUsed * factor * 1.1 / 0.8;
    const backupNeeded = dataNeeded * storage.soBanBackup * (storage.tiLeNen / 100);

    // NAS = chỉ /backup cần
    const nasTotal = backupNeeded;

    const container = document.getElementById('mariadb-result-container');
    const existingProposalState = getCurrentMariaDBProposalState(container);
    let html = '';

    // ==================== CÔNG THỨC TÍNH ====================
    html += `<div class="calculation-panel">
        <h4 class="u-m-0 u-mb-10 u-text-section">Công thức tính toán (dựa trên IP Master: ${masterData.ip})</h4>
        <p class="model-meta-text"><strong>Mô hình:</strong> ${modelLabel}</p>
        <ul class="list-roomy">
            <li><strong>CPU cần</strong> = CPU × Tải CPU × (Định cỡ / Đầu vào) × 1.1 / 0.75${isActiveActive ? ' / 3 (chia cho 3 master)' : ''} = ${masterData.cpu} × ${(masterData.cpuLoad / 100).toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.75${isActiveActive ? ' / 3' : ''} = <strong>${cpuNeeded.toFixed(2)} vCPU</strong></li>
            <li><strong>RAM cần</strong> = RAM × Tải RAM × (Định cỡ / Đầu vào) × 1.1 / 0.9${isActiveActive ? ' / 3 (chia cho 3 master)' : ''} = ${masterData.ram} × ${(masterData.ramLoad / 100).toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9${isActiveActive ? ' / 3' : ''} = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/data cần</strong> = /data used × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.dataUsed} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${dataNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/log cần</strong> = /log used × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.logUsed} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${logNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/backup cần</strong> = /data cần × Số bản lưu backup × Tỉ lệ nén (%) = ${dataNeeded.toFixed(2)} × ${storage.soBanBackup} × ${storage.tiLeNen}% = <strong>${backupNeeded.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;

    // ==================== BẢNG KẾT QUẢ ====================
    html += `<h4 class="mariadb-tool-proposal-heading u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;

    html += `<table class="sizing-table u-mt-10" data-mariadb-proposal-table="1">
        <thead>
            <tr>
                <th class="col-w-120">Thành phần</th>
                <th class="col-w-250">Cấu hình đề xuất</th>
                <th class="col-w-100">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr class="diff-row-neutral">
                <td><strong>MaxScale</strong></td>
                <td>
                    <ul class="list-readable">
                        <li>4 vCPU</li>
                        <li>8 GB RAM</li>
                        <li>/u01: 100 GB</li>
                    </ul>
                </td>
                <td class="text-center"><strong>2</strong></td>
                <td>Cấu hình tối thiểu<br>+1 VIP</td>
            </tr>
            <tr class="diff-row-success">
                <td><strong>MariaDB</strong></td>
                <td>
                    <ul class="list-readable">
                        <li><strong>${Math.ceil(cpuNeeded)} vCPU</strong></li>
                        <li><strong>${Math.ceil(ramNeeded)} GB RAM</strong></li>
                        <li>/data: ${Math.ceil(dataNeeded)} GB</li>
                        <li>/log: ${Math.ceil(logNeeded)} GB</li>
                    </ul>
                </td>
                <td class="text-center"><strong>3</strong></td>
                <td>${isActiveActive ? 'Multi-Master' : 'Asynchronous'}</td>
            </tr>
            <tr class="diff-row-admin">
                <td><strong>NAS</strong></td>
                <td class="text-center"><strong>${Math.ceil(nasTotal)} GB</strong></td>
                <td class="text-center">-</td>
                <td>Mount chung</td>
            </tr>
        </tbody>
    </table>`;

    html += buildMariaDBCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        ensureMariaDBProposalSelectionUI(container, existingProposalState);
    }
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
    ensureDefaultMariaDBRefRows();
    syncMariaDBMasterRadioNames();

    // Load storage (direct input values)
    if (data.storage) {
        const dataUsedEl = document.getElementById('mariadb-storage-data-used');
        const logUsedEl = document.getElementById('mariadb-storage-log-used');
        const backupCopiesEl = document.getElementById('mariadb-storage-backup-copies');
        const compressRatioEl = document.getElementById('mariadb-storage-compress-ratio');
        if (dataUsedEl) dataUsedEl.value = data.storage.dataUsed || '';
        if (logUsedEl) logUsedEl.value = data.storage.logUsed || '';
        if (backupCopiesEl) backupCopiesEl.value = data.storage.soBanBackup || '1';
        if (compressRatioEl) compressRatioEl.value = data.storage.tiLeNen || '100';
        // Load multiple evidence images for storage
        if (data.storage.evidenceImages && Array.isArray(data.storage.evidenceImages) && data.storage.evidenceImages.length > 0) {
            loadMariaDBStorageEvidence(data.storage.evidenceImages);
        }
        // Backward compatibility: single evidenceImage
        else if (data.storage.evidenceImage) {
            loadMariaDBStorageEvidence([data.storage.evidenceImage]);
        }
    }
    // Backward compatibility for old data format
    else if (data.storageTable && Array.isArray(data.storageTable) && data.storageTable.length > 0) {
        const firstRow = data.storageTable[0];
        const dataUsedEl = document.getElementById('mariadb-storage-data-used');
        const logUsedEl = document.getElementById('mariadb-storage-log-used');
        if (dataUsedEl) dataUsedEl.value = firstRow.dataUsed || firstRow.data || '';
        if (logUsedEl) logUsedEl.value = firstRow.logUsed || firstRow.log || '';
    }

    // Load note
    const noteEl = document.getElementById('mariadb-note');
    if (noteEl && data.note) noteEl.value = data.note;

    // Load input values
    const replicationModel = document.getElementById('mariadb-replication-model');
    if (replicationModel) {
        const modelValue = (data.replicationModel || 'asynchronous').toLowerCase();
        if (modelValue === 'active-active' || modelValue === 'multi-master') {
            replicationModel.value = 'multi-master';
        } else {
            replicationModel.value = 'asynchronous';
        }
    }

    if (data.selectedInputRow !== undefined && data.selectedInputRow !== '') {
        const select = document.getElementById('mariadb-input-row-select');
        if (select) {
            select.value = data.selectedInputRow;
            onInputRowSelect(select, 'mariadb-input-ccu', 'mariadb-sizing-ccu');
        }
    }
    const inputCCU = document.getElementById('mariadb-input-ccu');
    const sizingCCU = document.getElementById('mariadb-sizing-ccu');
    if (inputCCU && data.inputCCU) inputCCU.value = data.inputCCU;
    if (sizingCCU && data.sizingCCU) sizingCCU.value = data.sizingCCU;

    // Load result if exists
    if (data.resultHTML) {
        const container = document.getElementById('mariadb-result-container');
        if (container) {
            container.innerHTML = data.resultHTML;
            ensureMariaDBProposalSelectionUI(container, {
                selectedProposalSource: data.selectedProposalSource || 'auto',
                customProposalTable: data.customProposalTable || getDefaultMariaDBCustomProposalTable()
            });
        }
    }

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
            <input type="file" accept="image/*" onchange="handleMariaDBRefEvidenceUpload(this)" class="is-hidden">
            <div class="preview-area">
                <div class="u-flex u-align-center u-gap-8 u-p-8">
                    <img src="${img.dataUrl}" alt="Evidence" class="is-hidden">
                    <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteMariaDBRefEvidenceSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>
            </div>
            <div class="upload-placeholder is-hidden">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Click để upload</span>
            </div>
        `;
        grid.appendChild(slot);
    });
}

// Thu thập dữ liệu MariaDB để lưu (user data only)
function collectMariaDBData() {
    const resultContainer = document.getElementById('mariadb-result-container');
    syncTextareasInContainer(resultContainer);
    const customProposalTable = collectMariaDBCustomProposalTableData(resultContainer);
    const selectedProposalSource = normalizeMariaDBProposalSource(getMariaDBSelectedProposalSource(resultContainer), customProposalTable);

    return {
        refTable: collectMariaDBRefTableData(),
        storage: collectMariaDBStorageData(),
        note: document.getElementById('mariadb-note')?.value || '',
        replicationModel: document.getElementById('mariadb-replication-model')?.value || 'asynchronous',
        selectedInputRow: document.getElementById('mariadb-input-row-select')?.value || '',
        selectedInputRowLabel: getSelectedInputRowLabel('mariadb-input-row-select'),
        inputCCU: document.getElementById('mariadb-input-ccu')?.value || '',
        sizingCCU: document.getElementById('mariadb-sizing-ccu')?.value || '',
        selectedProposalSource: selectedProposalSource,
        customProposalTable: customProposalTable,
        resultHTML: resultContainer?.innerHTML || ''
    };
}

// Thêm slot ảnh sở cứ cho MariaDB
function addMariaDBEvidenceSlot() {
    const grid = document.getElementById('mariadb-evidence-grid');
    if (!grid) return;

    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleMariaDBEvidenceUpload(this)" class="is-hidden">
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
    reader.onload = function (e) {
        previewArea.innerHTML = `
            <div class="u-flex u-align-center u-gap-8 u-p-8">
                <img src="${e.target.result}" alt="Evidence" class="is-hidden">
                <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteMariaDBEvidenceSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
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

// ========== MariaDB Storage Multi-Image Evidence Functions ==========

// Thêm slot ảnh sở cứ cho bảng Storage MariaDB (hỗ trợ nhiều ảnh)
function addMariaDBStorageEvidenceSlot() {
    const cell = document.getElementById('mariadb-storage-evidence-cell');
    cell?.querySelector('input[type=file]')?.click();
}

// Xử lý upload ảnh cho Storage MariaDB
function handleMariaDBStorageEvidenceUpload(input) {
    handleInlineEvidenceUpload(input);
}

// Xóa slot ảnh sở cứ Storage MariaDB
function removeMariaDBStorageEvidenceSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.mariadb-storage-evidence-slot');
        if (slot) {
            slot.remove();
        } else {
            removeInlineEvidence(btn);
        }
    }
}

// Load ảnh sở cứ Storage MariaDB (nhiều ảnh)
function loadMariaDBStorageEvidence(images) {
    const cell = document.getElementById('mariadb-storage-evidence-cell');
    const previewSpan = document.getElementById('mariadb-storage-evidence-grid');
    if (!cell || !previewSpan || !images || !Array.isArray(images)) return;

    previewSpan.innerHTML = '';
    loadInlineEvidence(cell, images);
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
        <input type="file" accept="image/*" onchange="handleMariaDBRefEvidenceUpload(this)" class="is-hidden">
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
    reader.onload = function (e) {
        previewArea.innerHTML = `
            <div class="u-flex u-align-center u-gap-8 u-p-8">
                <img src="${e.target.result}" alt="Evidence" class="is-hidden">
                <button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" aria-label="Xem ảnh">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-remove-evidence" onclick="deleteMariaDBRefEvidenceSlot(this)" title="Xóa ảnh" aria-label="Xóa ảnh"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
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
        configBtn.classList.remove('active');
        keyContent.style.display = 'block';
        configContent.style.display = 'none';
    } else {
        configBtn.classList.add('active');
        keyBtn.classList.remove('active');
        configContent.style.display = 'block';
        keyContent.style.display = 'none';
    }
}

// Thêm slot ảnh sở cứ cho phương pháp Key
function addRedisKeyEvidenceSlot() {
    const grid = document.getElementById('redis-key-evidence-grid');
    if (!grid) return;

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.multiple = true;
    picker.className = 'is-hidden';
    picker.addEventListener('cancel', () => picker.remove());
    picker.onchange = function () {
        Array.from(picker.files || []).forEach(file => appendEvidenceImageCard(grid, file, 'redis-key-evidence'));
        picker.remove();
        try { applyRolePermissions(); } catch (e) { }
    };
    document.body.appendChild(picker);
    picker.click();
    try { applyRolePermissions(); } catch (e) { }
}

// Xử lý upload ảnh
function handleRedisKeyImageUpload(input) {
    const boxId = input.closest('.upload-box')?.id;
    if (boxId) previewEvidenceCardImage(input, boxId);
}

// Thêm dòng vào bảng cấu hình Redis
function addRedisConfigRow(data = {}) {
    const tbody = document.getElementById('redis-config-table-body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    const updateRamHandler = buildInstanceAwareHandler('updateRedisTotalMasterRAM()');
    const uploadHandler = buildInstanceAwareHandler('handleInlineEvidenceUpload(this)');
    const uploadClickHandler = buildInstanceAwareHandler("this.parentElement.querySelector('input[type=file]').click()");
    const deleteRowHandler = buildInstanceAwareHandler("this.closest('tr').remove(); updateRedisTotalMasterRAM();");
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input redis-config-ip" value="${data.ip || ''}" placeholder="192.168.x.x"></td>
        <td><input type="number" class="input-full sizing-user-input redis-config-ram" value="${data.ram || ''}" placeholder="RAM (GB)" min="0" onchange="${updateRamHandler}"></td>
        <td><input type="number" class="input-full sizing-user-input redis-config-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" oninput="validateLoadInput(this); ${updateRamHandler}"></td>
        <td class="text-center">
            <input type="checkbox" class="redis-master-checkbox" ${data.isMaster ? 'checked' : ''} onchange="${updateRamHandler}">
        </td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="redis-config-evidence-input is-hidden" onchange="${uploadHandler}">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
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
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="this.closest('tr').remove(); updateRedisTotalMasterRAM();">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    // Apply role permissions for new row
    applyRolePermissions();
}

// Cập nhật tổng RAM của các Master
function updateRedisTotalMasterRAM() {
    const tableBody = document.getElementById('redis-config-table-body');
    const fallbackTable = tableBody?.closest('table') || document.querySelector('.redis-config-table') || window.event?.target?.closest('table');
    const rows = tableBody
        ? tableBody.querySelectorAll('tr')
        : (fallbackTable ? fallbackTable.querySelectorAll('tbody tr') : []);
    let totalMasterRAM = 0;
    let masterCount = 0;

    rows.forEach(row => {
        const isMaster = row.querySelector('.redis-master-checkbox')?.checked;
        if (isMaster) {
            masterCount += 1;
            const ram = parseFloat(row.querySelector('.redis-config-ram')?.value) || 0;
            const ramLoadRaw = row.querySelector('.redis-config-ram-load')?.value;
            const ramLoad = ramLoadRaw === '' ? 100 : (parseFloat(ramLoadRaw) || 0);
            totalMasterRAM += ram * (ramLoad / 100);
        }
    });

    const totalEl = document.getElementById('redis-total-master-ram') || fallbackTable?.querySelector('#redis-total-master-ram');
    if (totalEl) totalEl.innerText = totalMasterRAM.toFixed(2);

    return totalMasterRAM;
}

// Thu thập dữ liệu bảng cấu hình Redis
function collectRedisConfigTableData() {
    const rows = document.querySelectorAll('#redis-config-table-body tr');
    const data = [];
    rows.forEach(row => {
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            ip: row.querySelector('.redis-config-ip')?.value || '',
            ram: row.querySelector('.redis-config-ram')?.value || '',
            ramLoad: row.querySelector('.redis-config-ram-load')?.value || '',
            isMaster: row.querySelector('.redis-master-checkbox')?.checked || false,
            evidenceDataUrl: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
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

// Update Redis Key count calculated value based on POC ratio
function updateRedisKeyCalculated() {
    const poc = parseFloat(document.getElementById('redis-key-poc')?.value) || 0;
    const sizing = parseFloat(document.getElementById('redis-key-sizing')?.value) || 0;
    const keyCountPOC = parseFloat(document.getElementById('redis-key-count-poc')?.value) || 0;

    const keyCountEl = document.getElementById('redis-key-count');
    if (keyCountEl) {
        if (poc > 0 && sizing > 0 && keyCountPOC > 0) {
            const calculatedKeyCount = Math.round(keyCountPOC * (sizing / poc));
            keyCountEl.value = calculatedKeyCount;
        } else {
            keyCountEl.value = '';
        }
    }
}

// Tính toán theo phương pháp Key dự kiến
function calculateRedisKeyMethod() {
    const poc = parseFloat(document.getElementById('redis-key-poc')?.value) || 0;
    const sizing = parseFloat(document.getElementById('redis-key-sizing')?.value) || 0;
    const keyCountPOC = parseFloat(document.getElementById('redis-key-count-poc')?.value) || 0;
    const keyCount = parseFloat(document.getElementById('redis-key-count')?.value) || 0;
    const recordSize = parseFloat(document.getElementById('redis-record-size')?.value) || 0;
    const importance = document.getElementById('redis-key-importance')?.value || 'normal';

    if (!poc || !sizing || !keyCountPOC) {
        showToast('Vui lòng nhập đầy đủ thông tin: Tải hệ thống POC, Định cỡ và Tổng lượng Key POC!', 'warning');
        return;
    }

    if (!recordSize) {
        showToast('Vui lòng nhập Kích thước trung bình 1 bản ghi!', 'warning');
        return;
    }

    // Tính C = A * B (bytes -> GB)
    const C = (keyCount * recordSize) / (1024 * 1024 * 1024); // Convert to GB

    // Update display
    const totalCapEl = document.getElementById('redis-total-capacity');
    if (totalCapEl) totalCapEl.innerText = C.toFixed(4);

    const container = document.getElementById('redis-key-result-container');
    const existingProposalState = getCurrentRedisProposalState(container);
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
    html += `<div class="calculation-panel">
        <h4 class="u-m-0 u-mb-10 u-text-section">Thông tin tính toán</h4>
        <ul class="list-roomy">
            <li><strong>Tải hệ thống POC:</strong> ${poc.toLocaleString()}</li>
            <li><strong>Định cỡ:</strong> ${sizing.toLocaleString()}</li>
            <li><strong>Tỷ lệ:</strong> ${sizing} / ${poc} = ${(sizing / poc).toFixed(2)}</li>
            <li><strong>Tổng số Key POC:</strong> ${keyCountPOC.toLocaleString()}</li>
            <li><strong>Tổng số Key sau định cỡ (A):</strong> ${keyCountPOC.toLocaleString()} × ${(sizing / poc).toFixed(2)} = <strong>${keyCount.toLocaleString()}</strong></li>
            <li><strong>Kích thước trung bình 1 bản ghi (B):</strong> ${recordSize} bytes</li>
            <li><strong>Tổng dung lượng Key Redis (C):</strong> ${keyCount.toLocaleString()} × ${recordSize} = <strong>${C.toFixed(4)} GB</strong></li>
            <li><strong>Mức độ quan trọng:</strong> ${importance === 'dbqt' ? 'Đặc biệt quan trọng' : 'Bình thường'}</li>
        </ul>
    </div>`;

    html += `<div class="success-callout">
        <h4 class="u-m-0 u-mb-10 u-text-success"><i class="fa-solid fa-lightbulb"></i> Đề xuất mô hình</h4>
        <p class="inline-summary-text">
            <strong>${model}</strong> - ${masterCount} master ${slavePerMaster} slave
            ${C >= 32 ? `<br><em>(C = ${C.toFixed(2)} GB > 32 GB → Sử dụng Cluster với N = ${masterCount} master)</em>` : `<br><em>(C = ${C.toFixed(2)} GB < 32 GB → Sử dụng Sentinel)</em>`}
        </p>
    </div>`;

    html += `<div class="warning-callout">
        <h4 class="formula-title">Công thức tính toán</h4>
        <ul class="list-roomy">
            <li><strong>RAM mỗi server:</strong> RAM1svr = C × 1.1 / 0.9${masterCount > 1 ? ' / N' : ''} = ${C.toFixed(2)} × 1.1 / 0.9${masterCount > 1 ? ` / ${masterCount}` : ''} = <strong>${ramPerServer.toFixed(2)} GB</strong></li>
            <li><strong>vCPU mỗi server:</strong> ${vcpu} vCPU (mặc định cho ${model})</li>
            <li><strong>DISK mỗi server:</strong> 4 × RAM = 4 × ${ramPerServer.toFixed(2)} = <strong>${diskPerServer.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;

    // Bảng kết quả
    html += `<h4 class="redis-tool-proposal-heading u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;

    html += `<table class="sizing-table u-mt-10" data-redis-proposal-table="1">
        <thead>
            <tr>
                <th class="col-w-150">Thành phần</th>
                <th class="col-w-200">Cấu hình đề xuất</th>
                <th class="col-w-100">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr class="diff-row-success">
                <td><strong>Redis ${model === 'Redis Sentinel' ? 'Sentinel' : 'Cluster'}</strong></td>
                <td>
                    <ul class="list-readable">
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

    html += buildRedisCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        ensureRedisProposalSelectionUI(container, existingProposalState);
    }
}

// Tính toán theo phương pháp cấu hình hiện có
function calculateRedisConfigMethod() {
    const inputCCU = parseFloat(document.getElementById('redis-config-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('redis-config-sizing-ccu')?.value) || 0;
    const importance = document.getElementById('redis-config-importance')?.value || 'normal';
    const currentModel = document.getElementById('redis-current-model')?.value || 'cluster';

    if (!inputCCU || !sizingCCU) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".', 'warning');
        return;
    }

    // Lấy tổng RAM từ các Master
    const totalMasterRAM = updateRedisTotalMasterRAM();

    if (totalMasterRAM <= 0) {
        showToast('Vui lòng nhập thông tin và tick chọn ít nhất một Master trong bảng cấu hình!', 'warning');
        return;
    }

    // Hệ số
    const factor = sizingCCU / inputCCU;

    // RAM nền sau khi quy đổi tải sizing. Hệ số dự phòng/KPI chỉ áp dụng ở phần công thức RAM mỗi server.
    const scaledMasterRAM = totalMasterRAM * factor;
    const ramBeforeSharding = scaledMasterRAM * 1.1 / 0.9;
    const C = scaledMasterRAM;

    const container = document.getElementById('redis-config-result-container');
    const existingProposalState = getCurrentRedisProposalState(container);
    let html = '';
    let model = '';
    let vcpu = 0;
    let ramPerServer = 0;
    let diskPerServer = 0;
    let masterCount = 1;
    let slavePerMaster = importance === 'dbqt' ? 2 : 1;
    let totalServers = 0;

    if (ramBeforeSharding < 32) {
        // Redis Sentinel
        model = 'Redis Sentinel';
        vcpu = 8;
        ramPerServer = ramBeforeSharding;
        diskPerServer = 4 * ramPerServer;
        masterCount = 1;
        slavePerMaster = 2;
        totalServers = 1 + 2;
    } else {
        // Redis Cluster
        model = 'Redis Cluster';
        vcpu = 16;

        let N = 3;
        while (ramBeforeSharding / N >= 64) {
            N += 2;
        }
        masterCount = N;
        ramPerServer = ramBeforeSharding / N;
        diskPerServer = 4 * ramPerServer;
        totalServers = N * (1 + slavePerMaster);
    }

    // ==================== HIỂN THỊ KẾT QUẢ ====================
    html += `<div class="calculation-panel">
        <h4 class="u-m-0 u-mb-10 u-text-section">Thông tin tính toán</h4>
        <ul class="list-roomy">
            <li><strong>Mô hình hiện tại:</strong> ${currentModel === 'cluster' ? 'Redis Cluster' : 'Redis Sentinel'}</li>
            <li><strong>Tổng RAM Master hiện tại (đã nhân tải):</strong> ${totalMasterRAM.toFixed(2)} GB</li>
            <li><strong>Hệ số (Định cỡ/Đầu vào):</strong> ${sizingCCU} / ${inputCCU} = ${factor.toFixed(2)}</li>
            <li><strong>RAM quy đổi theo tải sizing (C):</strong> ${totalMasterRAM.toFixed(2)} × ${factor.toFixed(2)} = <strong>${C.toFixed(2)} GB</strong></li>
            <li><strong>Mức độ quan trọng:</strong> ${importance === 'dbqt' ? 'Đặc biệt quan trọng' : 'Bình thường'}</li>
        </ul>
    </div>`;

    html += `<div class="warning-callout">
        <h4 class="formula-title">Công thức tính toán</h4>
        <ul class="list-roomy">
            <li><strong>RAM mỗi server:</strong> RAM1svr = C × 1.1 / 0.9${masterCount > 1 ? ' / N' : ''} = ${C.toFixed(2)} × 1.1 / 0.9${masterCount > 1 ? ` / ${masterCount}` : ''} = <strong>${ramPerServer.toFixed(2)} GB</strong></li>
            <li><strong>vCPU mỗi server:</strong> ${vcpu} vCPU (mặc định cho ${model})</li>
            <li><strong>DISK mỗi server:</strong> 4 × RAM = 4 × ${ramPerServer.toFixed(2)} = <strong>${diskPerServer.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;

    html += `<div class="success-callout">
        <h4 class="u-m-0 u-mb-10 u-text-success"><i class="fa-solid fa-lightbulb"></i> Đề xuất mô hình</h4>
        <p class="inline-summary-text">
            <strong>${model}</strong> - ${masterCount} master ${slavePerMaster} slave
            ${ramBeforeSharding >= 32 ? `<br><em>(RAM1svr trước chia cụm = ${ramBeforeSharding.toFixed(2)} GB ≥ 32 GB → Sử dụng Cluster với N = ${masterCount} master)</em>` : `<br><em>(RAM1svr = ${ramBeforeSharding.toFixed(2)} GB < 32 GB → Sử dụng Sentinel)</em>`}
        </p>
    </div>`;

    // Bảng kết quả
    html += `<h4 class="redis-tool-proposal-heading u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;

    html += `<table class="sizing-table u-mt-10" data-redis-proposal-table="1">
        <thead>
            <tr>
                <th class="col-w-150">Thành phần</th>
                <th class="col-w-200">Cấu hình đề xuất</th>
                <th class="col-w-100">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr class="diff-row-success">
                <td><strong>Redis ${model === 'Redis Sentinel' ? 'Sentinel' : 'Cluster'}</strong></td>
                <td>
                    <ul class="list-readable">
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

    html += buildRedisCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        ensureRedisProposalSelectionUI(container, existingProposalState);
    }
}

// Thu thập dữ liệu Redis để lưu
function collectRedisData() {
    // Xác định phương pháp đang chọn
    const keyBtn = document.getElementById('redis-method-key');
    const selectedMethod = keyBtn?.classList.contains('active') ? 'key' : 'config';
    const keyResultContainer = document.getElementById('redis-key-result-container');
    const configResultContainer = document.getElementById('redis-config-result-container');
    syncTextareasInContainer(keyResultContainer);
    syncTextareasInContainer(configResultContainer);
    const keyCustomProposalTable = collectRedisCustomProposalTableData(keyResultContainer);
    const keySelectedProposalSource = normalizeRedisProposalSource(getRedisSelectedProposalSource(keyResultContainer), keyCustomProposalTable);
    const configCustomProposalTable = collectRedisCustomProposalTableData(configResultContainer);
    const configSelectedProposalSource = normalizeRedisProposalSource(getRedisSelectedProposalSource(configResultContainer), configCustomProposalTable);

    return {
        selectedMethod: selectedMethod,
        // Phương pháp Key
        keyMethod: {
            selectedInputRow: document.getElementById('redis-key-input-row-select')?.value || '',
            selectedInputRowLabel: getSelectedInputRowLabel('redis-key-input-row-select'),
            pocValue: document.getElementById('redis-key-poc')?.value || '',
            sizingValue: document.getElementById('redis-key-sizing')?.value || '',
            keyCountPoc: document.getElementById('redis-key-count-poc')?.value || '',
            keyCount: document.getElementById('redis-key-count')?.value || '',
            recordSize: document.getElementById('redis-record-size')?.value || '',
            importance: document.getElementById('redis-key-importance')?.value || 'normal',
            selectedProposalSource: keySelectedProposalSource,
            customProposalTable: keyCustomProposalTable,
            evidenceImages: collectRedisKeyEvidenceData(),
            resultHTML: keyResultContainer?.innerHTML || ''
        },
        // Phương pháp Config
        configMethod: {
            currentModel: document.getElementById('redis-current-model')?.value || 'cluster',
            configTable: collectRedisConfigTableData(),
            selectedInputRow: document.getElementById('redis-config-input-row-select')?.value || '',
            selectedInputRowLabel: getSelectedInputRowLabel('redis-config-input-row-select'),
            inputCCU: document.getElementById('redis-config-input-ccu')?.value || '',
            sizingCCU: document.getElementById('redis-config-sizing-ccu')?.value || '',
            importance: document.getElementById('redis-config-importance')?.value || 'normal',
            selectedProposalSource: configSelectedProposalSource,
            customProposalTable: configCustomProposalTable,
            resultHTML: configResultContainer?.innerHTML || ''
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
        if (km.selectedInputRow !== undefined && km.selectedInputRow !== '') {
            const select = document.getElementById('redis-key-input-row-select');
            if (select) {
                select.value = km.selectedInputRow;
                onInputRowSelect(select, 'redis-key-poc', 'redis-key-sizing');
            }
        }
        if (km.pocValue) document.getElementById('redis-key-poc').value = km.pocValue;
        if (km.sizingValue) document.getElementById('redis-key-sizing').value = km.sizingValue;
        if (km.keyCountPoc) document.getElementById('redis-key-count-poc').value = km.keyCountPoc;
        if (km.keyCount) document.getElementById('redis-key-count').value = km.keyCount;
        if (km.recordSize) document.getElementById('redis-record-size').value = km.recordSize;
        if (km.importance) document.getElementById('redis-key-importance').value = km.importance;

        // Load ảnh sở cứ
        if (km.evidenceImages && Array.isArray(km.evidenceImages)) {
            const grid = document.getElementById('redis-key-evidence-grid');
            if (grid) {
                grid.innerHTML = '';
                km.evidenceImages.forEach(img => {
                    const dataUrl = img?.dataUrl || img?.base64 || img;
                    if (dataUrl) {
                        const boxId = 'redis-key-evidence-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
                        grid.appendChild(createEvidenceUploadCard(boxId, dataUrl));
                    }
                });
            }
        }

        // Load kết quả
        if (km.resultHTML) {
            const container = document.getElementById('redis-key-result-container');
            if (container) {
                container.innerHTML = km.resultHTML;
                ensureRedisProposalSelectionUI(container, {
                    selectedProposalSource: km.selectedProposalSource || 'auto',
                    customProposalTable: km.customProposalTable || getEmptyRedisCustomProposalTable()
                });
            }
        }
    }

    // Load phương pháp Config
    if (data.configMethod) {
        const cm = data.configMethod;
        if (cm.currentModel) document.getElementById('redis-current-model').value = cm.currentModel;
        if (cm.selectedInputRow !== undefined && cm.selectedInputRow !== '') {
            const select = document.getElementById('redis-config-input-row-select');
            if (select) {
                select.value = cm.selectedInputRow;
                onInputRowSelect(select, 'redis-config-input-ccu', 'redis-config-sizing-ccu');
            }
        }
        if (cm.inputCCU) document.getElementById('redis-config-input-ccu').value = cm.inputCCU;
        if (cm.sizingCCU) document.getElementById('redis-config-sizing-ccu').value = cm.sizingCCU;
        if (cm.importance) document.getElementById('redis-config-importance').value = cm.importance;

        // Load bảng config
        if (cm.configTable && Array.isArray(cm.configTable)) {
            document.getElementById('redis-config-table-body').innerHTML = '';
            cm.configTable.forEach(row => {
                addRedisConfigRow(row);
                // Restore evidence image(s) if available
                const redisEvidenceImages = getEvidenceImagesFromRowData(row);
                if (redisEvidenceImages.length > 0) {
                    const rows = document.querySelectorAll('#redis-config-table-body tr');
                    const lastRow = rows[rows.length - 1];
                    const evidenceCell = lastRow?.querySelector('.inline-evidence-cell');
                    if (evidenceCell) {
                        loadInlineEvidence(evidenceCell, redisEvidenceImages);
                    }
                }
            });
            updateRedisTotalMasterRAM();
        }
        ensureDefaultRedisConfigRows();

        // Load kết quả
        if (cm.resultHTML) {
            const container = document.getElementById('redis-config-result-container');
            if (container) {
                container.innerHTML = cm.resultHTML;
                ensureRedisProposalSelectionUI(container, {
                    selectedProposalSource: cm.selectedProposalSource || 'auto',
                    customProposalTable: cm.customProposalTable || getEmptyRedisCustomProposalTable()
                });
            }
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
        linearBtn.classList.remove('active');
        throughputContent.style.display = 'block';
        linearContent.style.display = 'none';
    } else {
        linearBtn.classList.add('active');
        throughputBtn.classList.remove('active');
        linearContent.style.display = 'block';
        throughputContent.style.display = 'none';
    }
}

// Thêm ảnh sở cứ cho Throughput
function addKafkaThroughputEvidenceSlot() {
    addKafkaEvidenceCardsFromPicker('kafka-throughput-evidence-grid', 'kafka-throughput-evidence');
}

// Thêm ảnh sở cứ cho Compression
function addKafkaCompressionEvidenceSlot() {
    addKafkaEvidenceCardsFromPicker('kafka-compression-evidence-grid', 'kafka-compression-evidence');
}

function addKafkaEvidenceCardsFromPicker(gridId, prefix) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.multiple = true;
    picker.className = 'is-hidden';
    picker.addEventListener('cancel', () => picker.remove());
    picker.onchange = function () {
        Array.from(picker.files || []).forEach(file => appendEvidenceImageCard(grid, file, prefix));
        picker.remove();
        try { applyRolePermissions(); } catch (e) { }
    };
    document.body.appendChild(picker);
    picker.click();
}

// Helper function để thêm image upload slot
function addImageUploadSlot(grid, handlerName) {
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <div class="preview-area"></div>
        <input type="file" accept="image/*" onchange="${handlerName}(this)" class="is-hidden">
        <button type="button" class="ui-btn ui-btn-outline btn-upload sizing-user-btn" onclick="this.previousElementSibling.click()">
            <i class="fa-solid fa-upload"></i> Chọn ảnh
        </button>
        <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn u-ml-5" onclick="this.closest('.upload-box').remove()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh Kafka
function handleKafkaImageUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const previewArea = input.closest('.upload-box').querySelector('.preview-area');
        previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" class="is-hidden"><button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh" aria-label="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
    };
    reader.readAsDataURL(file);
}

// Mở Helper Tool popup
function openKafkaHelperTool() {
    const modal = document.getElementById('kafka-helper-modal');
    if (modal) {
        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
        // Focus first input for better UX
        setTimeout(() => {
            const input = document.getElementById('kafka-helper-msg-count');
            if (input) input.focus();
        }, 350);
    }
}

// Đóng Helper Tool popup
function closeKafkaHelperTool() {
    const modal = document.getElementById('kafka-helper-modal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
    }
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
        showToast('Vui lòng nhập đầy đủ thông tin!', 'warning');
        return;
    }

    // A = msgCount * msgSize / 1024 (KB -> MB)
    const A = (msgCount * msgSize) / 1024;
    const resultEl = document.getElementById('kafka-helper-result');
    // Animate the result update
    resultEl.style.transform = 'scale(0.8)';
    resultEl.style.opacity = '0.4';
    setTimeout(() => {
        resultEl.innerText = A.toFixed(4);
        resultEl.style.transform = 'scale(1.1)';
        resultEl.style.opacity = '1';
        setTimeout(() => {
            resultEl.style.transform = 'scale(1)';
        }, 150);
    }, 100);
}

// Áp dụng kết quả từ Helper Tool
function applyKafkaHelperResult() {
    const result = parseFloat(document.getElementById('kafka-helper-result')?.innerText) || 0;
    if (result <= 0) {
        showToast('Vui lòng tính toán trước khi áp dụng!', 'warning');
        return;
    }

    // Lưu kết quả vào biến tạm
    const resultValue = result.toFixed(4);

    // Đóng modal trước để DOM có thể access được
    closeKafkaHelperTool();

    // Đợi modal đóng xong rồi mới điền giá trị
    setTimeout(() => {
        console.log('=== DEBUG applyKafkaHelperResult ===');

        // Tìm phần tử throughput field với pattern kafka-throughput-a__inst_Kafka-*
        const throughputField = document.querySelector('input[id^="kafka-throughput-a"]');
        console.log('throughputField:', throughputField);

        if (!throughputField) {
            console.error('Không tìm thấy phần tử kafka-throughput-a');

            // Thử tìm tất cả các input có liên quan
            const allInputs = document.querySelectorAll('input[id*="kafka"][id*="throughput"]');
            console.log('Tất cả input kafka-throughput tìm được:', allInputs);

            showToast('Không tìm thấy trường lưu lượng! Vui lòng refresh trang và thử lại.', 'error');
            return;
        }

        console.log('Tìm thấy throughputField, ID:', throughputField.id);
        console.log('Đang điền giá trị:', resultValue);

        throughputField.value = resultValue;
        throughputField.dispatchEvent(new Event('input', { bubbles: true })); // Trigger change event
        showToast('Đã áp dụng kết quả thành công!', 'success');
    }, 150);
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
        <td><input type="number" class="input-full sizing-user-input kafka-linear-cpu-load" value="${data.cpuLoad || ''}" placeholder="%" min="0" oninput="validateLoadInput(this); updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" oninput="validateLoadInput(this); updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-disk-load" value="${data.diskLoad || ''}" placeholder="%" min="0" oninput="validateLoadInput(this); updateKafkaLinearTotal()"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="kafka-linear-evidence-input is-hidden" onchange="handleInlineEvidenceUpload(this)">
                <button type="button" class="ui-icon-btn ui-icon-btn-success ui-icon-btn-xs btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh" aria-label="Upload ảnh">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
                <span class="inline-evidence-preview"></span>
            </div>
        </td>
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
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete sizing-user-btn" onclick="this.closest('tr').remove(); updateKafkaLinearTotal();">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    // Apply role permissions for new row
    applyRolePermissions();
}

// Cập nhật tổng cho bảng Linear
function getKafkaLinearRows() {
    const tbody = document.getElementById('kafka-linear-table-body');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr'));
}

function updateKafkaLinearTotal() {
    const rows = getKafkaLinearRows();
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

    const totalCpuEl = document.getElementById('kafka-linear-total-cpu');
    const totalRamEl = document.getElementById('kafka-linear-total-ram');
    const totalDiskEl = document.getElementById('kafka-linear-total-disk');
    if (totalCpuEl) totalCpuEl.innerText = totalCPU.toFixed(2);
    if (totalRamEl) totalRamEl.innerText = totalRAM.toFixed(2);
    if (totalDiskEl) totalDiskEl.innerText = totalDisk.toFixed(2);
}

// Thu thập dữ liệu bảng Linear
function collectKafkaLinearTableData() {
    const rows = getKafkaLinearRows();
    const data = [];
    rows.forEach(row => {
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            ip: row.querySelector('.kafka-linear-ip')?.value || '',
            vcpu: row.querySelector('.kafka-linear-vcpu')?.value || '',
            ram: row.querySelector('.kafka-linear-ram')?.value || '',
            disk: row.querySelector('.kafka-linear-disk')?.value || '',
            cpuLoad: row.querySelector('.kafka-linear-cpu-load')?.value || '',
            ramLoad: row.querySelector('.kafka-linear-ram-load')?.value || '',
            diskLoad: row.querySelector('.kafka-linear-disk-load')?.value || '',
            evidenceDataUrl: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
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
    const A_poc = parseFloat(document.getElementById('kafka-throughput-a')?.value) || 0;
    const T = parseFloat(document.getElementById('kafka-retention-time')?.value) || 168;
    const R = parseFloat(document.getElementById('kafka-replication-factor')?.value) || 3;
    const C = parseFloat(document.getElementById('kafka-compression')?.value) || 0.5;
    const pocVal = parseFloat(document.getElementById('kafka-throughput-input-ccu')?.value) || 0;
    const sizingVal = parseFloat(document.getElementById('kafka-throughput-sizing-ccu')?.value) || 0;

    if (!A_poc) {
        showToast('Vui lòng nhập Lưu lượng vào (Write) - A!', 'warning');
        return;
    }
    if (!pocVal || !sizingVal) {
        showToast('Vui lòng chọn dòng đầu vào (POC & Định cỡ)!', 'warning');
        return;
    }

    // Tính A thực tế theo tỉ lệ Định cỡ / POC
    const ratio = sizingVal / pocVal;
    const A = A_poc * ratio;

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
    const container = document.getElementById('kafka-throughput-result-container');
    const existingProposalState = getCurrentKafkaProposalState(container);

    let html = '';

    // ==================== CÔNG THỨC TÍNH ====================
    html += `<div class="calculation-panel">
        <h4 class="u-m-0 u-mb-10 u-text-section">Thông tin đầu vào</h4>
        <ul class="list-roomy">
            <li><strong>Lưu lượng vào POC (A₀):</strong> ${A_poc} MB/s</li>
            <li><strong>POC:</strong> ${pocVal} &nbsp;|&nbsp; <strong>Định cỡ:</strong> ${sizingVal}</li>
            <li><strong>Hệ số (Định cỡ/POC):</strong> ${sizingVal} / ${pocVal} = ${ratio.toFixed(4)}</li>
            <li><strong>Lưu lượng định cỡ (A):</strong> A₀ × (Định cỡ/POC) = ${A_poc} × ${ratio.toFixed(4)} = <strong>${A.toFixed(4)} MB/s</strong></li>
            <li><strong>Thời gian lưu trữ (T):</strong> ${T} giờ (${T / 24} ngày)</li>
            <li><strong>Hệ số nhân bản (R):</strong> ${R}</li>
            <li><strong>Hệ số nén (C):</strong> ${C}</li>
            <li><strong>S (dữ liệu 30 phút):</strong> A × 1800 / 1024 = ${A.toFixed(4)} × 1800 / 1024 = ${S.toFixed(2)} GB</li>
        </ul>
    </div>`;

    html += `<div class="success-callout">
        <h4 class="u-m-0 u-mb-10 u-text-success"><i class="fa-solid fa-hard-drive"></i> Tổng Disk Cluster</h4>
        <p class="inline-summary-text-sm">
            <strong>D = A × 3600 × T × R × C × 1.1 / 0.8</strong><br>
            D = ${A.toFixed(4)} × 3600 × ${T} × ${R} × ${C} × 1.1 / 0.8<br>
            D = <strong>${D_MB.toFixed(2)} MB</strong> = <strong>${D_GB.toFixed(2)} GB</strong> = <strong>${D_TB.toFixed(4)} TB</strong>
        </p>
    </div>`;

    // ==================== BẢNG PHÂN BỔ THEO N ====================
    html += `<h4 class="u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-table"></i> Bảng phân bổ theo số lượng Broker (N)
    </h4>`;

    html += `<table class="sizing-table u-mt-10" data-kafka-proposal-table="1">
        <thead>
            <tr>
                <th class="col-w-80">N (Broker)</th>
                <th>Disk/Server</th>
                <th>RAM/Server</th>
                <th>vCPU/Server</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>`;

    const diskPerServerByOptimal = D_GB / optimalN;
    const ramPerServerByOptimal = (S * R / optimalN) + 8;
    html += `<tr class="diff-row-success diff-row-strong">
        <td class="text-center">${optimalN}</td>
        <td class="text-center">${diskPerServerByOptimal >= 1024 ? (diskPerServerByOptimal / 1024).toFixed(2) + ' TB' : diskPerServerByOptimal.toFixed(2) + ' GB'}</td>
        <td class="text-center">${ramPerServerByOptimal.toFixed(2)} GB</td>
        <td class="text-center">${vCPU}</td>
        <td>Khuyến nghị (16 < RAM < 64)</td>
    </tr>`;

    html += `</tbody></table>`;

    // ==================== KẾT QUẢ ĐỀ XUẤT ====================
    const diskPerServer = D_GB / optimalN;
    const ramPerServer = (S * R / optimalN) + 8;

    html += `<h4 class="u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình (N = ${optimalN})
    </h4>`;

    html += `<table class="sizing-table u-mt-10" data-kafka-proposal-table="1">
        <thead>
            <tr>
                <th class="col-w-150">Thành phần</th>
                <th class="col-w-100">Số lượng Node</th>
                <th class="col-w-100">vCPU/Node</th>
                <th class="col-w-100">RAM/Node</th>
                <th class="col-w-150">Disk/Node (SSD)</th>
            </tr>
        </thead>
        <tbody>
            <tr class="diff-row-success">
                <td><strong>Kafka Broker</strong></td>
                <td class="text-center"><strong>${optimalN}</strong></td>
                <td class="text-center"><strong>${vCPU}</strong></td>
                <td class="text-center"><strong>${Math.ceil(ramPerServer)} GB</strong></td>
                <td class="text-center"><strong>${diskPerServer >= 1024 ? (diskPerServer / 1024).toFixed(2) + ' TB' : Math.ceil(diskPerServer) + ' GB'}</strong></td>
            </tr>
            <tr class="diff-row-warning">
                <td><strong>Zookeeper/KRaft</strong></td>
                <td class="text-center"><strong>3</strong></td>
                <td class="text-center"><strong>4</strong></td>
                <td class="text-center"><strong>8 GB</strong></td>
                <td class="text-center"><strong>100 GB</strong></td>
            </tr>
        </tbody>

    </table>`;

    html += `<div class="success-callout-spaced">
        <h4 class="module-diff-title module-diff-title-kafka"><i class="fa-solid fa-info-circle"></i> Khuyến nghị</h4>
        <p class="inline-success-text">
            Tách rời 3 node Zookeeper/KRaft Controller (2 vCPU / 4GB RAM / 100GB DISK) để đảm bảo độ ổn định cao nhất.
        </p>
    </div>`;

    html += buildKafkaCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        const tables = container.querySelectorAll('table.sizing-table');
        if (tables[0]) tables[0].removeAttribute('data-kafka-proposal-table');
        if (tables[1]) tables[1].setAttribute('data-kafka-proposal-table', '1');
        ensureKafkaProposalSelectionUI(container, existingProposalState);
    }
}

// Tính toán theo phương pháp Linear (Existing System)
function calculateKafkaLinearMethod() {
    const inputCCU = parseFloat(document.getElementById('kafka-linear-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('kafka-linear-sizing-ccu')?.value) || 0;

    if (!inputCCU || !sizingCCU) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".', 'warning');
        return;
    }

    // Tính tổng trực tiếp từ bảng để đảm bảo đúng theo module instance đang active
    const rows = getKafkaLinearRows();
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
    updateKafkaLinearTotal();

    if (totalCPU <= 0 && totalRAM <= 0 && totalDisk <= 0) {
        showToast('Vui lòng nhập thông tin các Broker hiện tại!', 'warning');
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
    const container = document.getElementById('kafka-linear-result-container');
    const existingProposalState = getCurrentKafkaProposalState(container);

    let html = '';

    html += `<div class="calculation-panel">
        <h4 class="u-m-0 u-mb-10 u-text-section">Thông tin tính toán</h4>
        <ul class="list-roomy">
            <li><strong>Tổng CPU sử dụng hiện tại:</strong> ${totalCPU.toFixed(2)} vCPU</li>
            <li><strong>Tổng RAM sử dụng hiện tại:</strong> ${totalRAM.toFixed(2)} GB</li>
            <li><strong>Tổng Disk sử dụng hiện tại:</strong> ${totalDisk.toFixed(2)} GB</li>
            <li><strong>Hệ số (Định cỡ/Đầu vào):</strong> ${sizingCCU} / ${inputCCU} = ${factor.toFixed(2)}</li>
        </ul>
    </div>`;

    html += `<div class="success-callout">
        <h4 class="u-m-0 u-mb-10 u-text-success">Tài nguyên cần cho hệ thống mới</h4>
        <ul class="list-roomy">
            <li><strong>CPU cần:</strong> ${totalCPU.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.75 = <strong>${cpuNeeded.toFixed(2)} vCPU</strong></li>
            <li><strong>RAM cần:</strong> ${totalRAM.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9 = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>Disk cần:</strong> ${totalDisk.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${diskNeeded.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;

    // Bảng phân bổ theo số lượng broker để so sánh các phương án N
    html += `<h4 class="u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-table"></i> Bảng phân bổ theo số lượng Broker (N)
    </h4>`;

    html += `<table class="sizing-table u-mt-10">
        <thead>
            <tr>
                <th class="col-w-80">N (Broker)</th>
                <th>CPU/Node</th>
                <th>RAM/Node</th>
                <th>Disk/Node</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>`;

    const cpuPerNodeOptimal = cpuNeeded / optimalN;
    const ramPerNodeOptimal = ramNeeded / optimalN;
    const diskPerNodeOptimal = diskNeeded / optimalN;
    html += `<tr class="diff-row-success diff-row-strong">
        <td class="text-center">${optimalN}</td>
        <td class="text-center">${Math.ceil(cpuPerNodeOptimal)}</td>
        <td class="text-center">${ramPerNodeOptimal.toFixed(2)} GB</td>
        <td class="text-center">${diskPerNodeOptimal >= 1024 ? (diskPerNodeOptimal / 1024).toFixed(2) + ' TB' : Math.ceil(diskPerNodeOptimal) + ' GB'}</td>
        <td>Khuyến nghị (16 <= RAM <= 64)</td>
    </tr>`;

    html += `</tbody></table>`;

    // Bảng kết quả
    html += `<h4 class="u-mt-20 u-mb-10 u-text-section">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình (N = ${optimalN})
    </h4>`;

    html += `<table class="sizing-table u-mt-10">
        <thead>
            <tr>
                <th class="col-w-150">Thành phần</th>
                <th class="col-w-100">Số lượng Node</th>
                <th class="col-w-100">vCPU/Node</th>
                <th class="col-w-100">RAM/Node</th>
                <th class="col-w-150">Disk/Node (SSD)</th>
            </tr>
        </thead>
        <tbody>
            <tr class="diff-row-success">
                <td><strong>Kafka Broker</strong></td>
                <td class="text-center"><strong>${optimalN}</strong></td>
                <td class="text-center"><strong>${cpuPerNode}</strong></td>
                <td class="text-center"><strong>${ramPerNode} GB</strong></td>
                <td class="text-center"><strong>${diskPerNode >= 1024 ? (diskPerNode / 1024).toFixed(2) + ' TB' : diskPerNode + ' GB'}</strong></td>
            </tr>
            <tr class="diff-row-warning">
                <td><strong>Zookeeper/KRaft</strong></td>
                <td class="text-center"><strong>3</strong></td>
                <td class="text-center"><strong>4</strong></td>
                <td class="text-center"><strong>8 GB</strong></td>
                <td class="text-center"><strong>100 GB</strong></td>
            </tr>
        </tbody>
        <tfoot>
            <tr class="diff-row-neutral diff-row-strong">
                <td>Tổng cộng</td>
                <td class="text-center">${optimalN + 3}</td>
                <td class="text-center">${cpuPerNode * optimalN + 6}</td>
                <td class="text-center">${ramPerNode * optimalN + 12} GB</td>
                <td class="text-center">${(diskPerNode * optimalN + 300) >= 1024 ? ((diskPerNode * optimalN + 300) / 1024).toFixed(2) + ' TB' : (diskPerNode * optimalN + 300) + ' GB'}</td>
            </tr>
        </tfoot>
    </table>`;

    html += buildKafkaCustomProposalSectionHtml(existingProposalState.selectedProposalSource, existingProposalState.customProposalTable);

    if (container) {
        container.innerHTML = html;
        const tables = container.querySelectorAll('table.sizing-table');
        if (tables[0]) tables[0].removeAttribute('data-kafka-proposal-table');
        if (tables[1]) tables[1].setAttribute('data-kafka-proposal-table', '1');
        ensureKafkaProposalSelectionUI(container, existingProposalState);
    }
}

// Thu thập dữ liệu Kafka để lưu
function collectKafkaData() {
    const throughputBtn = document.getElementById('kafka-method-throughput');
    const selectedMethod = throughputBtn?.classList.contains('active') ? 'throughput' : 'linear';
    const throughputResultContainer = document.getElementById('kafka-throughput-result-container');
    const linearResultContainer = document.getElementById('kafka-linear-result-container');
    const throughputCustomProposalTable = collectKafkaCustomProposalTableData(throughputResultContainer);
    const throughputSelectedProposalSource = normalizeKafkaProposalSource(getKafkaSelectedProposalSource(throughputResultContainer), throughputCustomProposalTable);
    const linearCustomProposalTable = collectKafkaCustomProposalTableData(linearResultContainer);
    const linearSelectedProposalSource = normalizeKafkaProposalSource(getKafkaSelectedProposalSource(linearResultContainer), linearCustomProposalTable);

    return {
        selectedMethod: selectedMethod,
        // Phương pháp Throughput
        throughputMethod: {
            selectedInputRow: document.getElementById('kafka-throughput-input-row-select')?.value || '',
            selectedInputRowLabel: getSelectedInputRowLabel('kafka-throughput-input-row-select'),
            inputCCU: document.getElementById('kafka-throughput-input-ccu')?.value || '',
            sizingCCU: document.getElementById('kafka-throughput-sizing-ccu')?.value || '',
            throughputA: document.getElementById('kafka-throughput-a')?.value || '',
            retentionTime: document.getElementById('kafka-retention-time')?.value || '168',
            replicationFactor: document.getElementById('kafka-replication-factor')?.value || '3',
            compression: document.getElementById('kafka-compression')?.value || '0.5',
            throughputEvidence: collectKafkaEvidenceData('kafka-throughput-evidence-grid'),
            compressionEvidence: collectKafkaEvidenceData('kafka-compression-evidence-grid'),
            selectedProposalSource: throughputSelectedProposalSource,
            customProposalTable: throughputCustomProposalTable,
            resultHTML: throughputResultContainer?.innerHTML || '',
            // Helper tool data
            helperMsgCount: document.getElementById('kafka-helper-msg-count')?.value || '',
            helperMsgSize: document.getElementById('kafka-helper-msg-size')?.value || '',
            helperMsgEvidence: collectKafkaEvidenceData('kafka-helper-msg-evidence-grid'),
            helperSizeEvidence: collectKafkaEvidenceData('kafka-helper-size-evidence-grid')
        },
        // Phương pháp Linear
        linearMethod: {
            linearTable: collectKafkaLinearTableData(),
            selectedInputRow: document.getElementById('kafka-linear-input-row-select')?.value || '',
            selectedInputRowLabel: getSelectedInputRowLabel('kafka-linear-input-row-select'),
            inputCCU: document.getElementById('kafka-linear-input-ccu')?.value || '',
            sizingCCU: document.getElementById('kafka-linear-sizing-ccu')?.value || '',
            selectedProposalSource: linearSelectedProposalSource,
            customProposalTable: linearCustomProposalTable,
            resultHTML: linearResultContainer?.innerHTML || ''
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
        if (tm.selectedInputRow !== undefined && tm.selectedInputRow !== '') {
            const select = document.getElementById('kafka-throughput-input-row-select');
            if (select) {
                select.value = tm.selectedInputRow;
                onInputRowSelect(select, 'kafka-throughput-input-ccu', 'kafka-throughput-sizing-ccu');
            }
        }
        if (tm.inputCCU) document.getElementById('kafka-throughput-input-ccu').value = tm.inputCCU;
        if (tm.sizingCCU) document.getElementById('kafka-throughput-sizing-ccu').value = tm.sizingCCU;
        if (tm.throughputA) document.getElementById('kafka-throughput-a').value = tm.throughputA;
        if (tm.retentionTime) { const retEl = document.getElementById('kafka-retention-time'); if (retEl) retEl.value = tm.retentionTime; }
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
            if (container) {
                container.innerHTML = tm.resultHTML;
                ensureKafkaProposalSelectionUI(container, {
                    selectedProposalSource: tm.selectedProposalSource || 'auto',
                    customProposalTable: tm.customProposalTable || getDefaultKafkaCustomProposalTable()
                });
            }
        }
    }

    // Load phương pháp Linear
    if (data.linearMethod) {
        const lm = data.linearMethod;
        if (lm.selectedInputRow !== undefined && lm.selectedInputRow !== '') {
            const select = document.getElementById('kafka-linear-input-row-select');
            if (select) {
                select.value = lm.selectedInputRow;
                onInputRowSelect(select, 'kafka-linear-input-ccu', 'kafka-linear-sizing-ccu');
            }
        }
        if (lm.inputCCU) document.getElementById('kafka-linear-input-ccu').value = lm.inputCCU;
        if (lm.sizingCCU) document.getElementById('kafka-linear-sizing-ccu').value = lm.sizingCCU;

        // Load bảng linear
        if (lm.linearTable && Array.isArray(lm.linearTable)) {
            const linearTbody = document.getElementById('kafka-linear-table-body');
            if (linearTbody) {
                linearTbody.innerHTML = '';
                lm.linearTable.forEach(row => {
                    addKafkaLinearRow(row);
                    // Restore evidence image(s) if available
                    const kafkaLinearEvidenceImages = getEvidenceImagesFromRowData(row);
                    if (kafkaLinearEvidenceImages.length > 0) {
                        const rows = getKafkaLinearRows();
                        const lastRow = rows[rows.length - 1];
                        const evidenceCell = lastRow?.querySelector('.inline-evidence-cell');
                        if (evidenceCell) {
                            loadInlineEvidence(evidenceCell, kafkaLinearEvidenceImages);
                        }
                    }
                });
                updateKafkaLinearTotal();
            }
        }

        // Load kết quả
        ensureDefaultKafkaLinearRows();
        if (lm.resultHTML) {
            const container = document.getElementById('kafka-linear-result-container');
            if (container) {
                container.innerHTML = lm.resultHTML;
                ensureKafkaProposalSelectionUI(container, {
                    selectedProposalSource: lm.selectedProposalSource || 'auto',
                    customProposalTable: lm.customProposalTable || getDefaultKafkaCustomProposalTable()
                });
            }
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
        if (grid.classList.contains('model-upload-grid')) {
            const dataUrl = img?.dataUrl || img?.base64 || img;
            if (dataUrl) {
                const boxId = gridId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
                grid.appendChild(createEvidenceUploadCard(boxId, dataUrl));
            }
            return;
        }

        addSlotFn();
        const lastSlot = grid.lastElementChild;
        if (lastSlot && img.dataUrl) {
            const previewArea = lastSlot.querySelector('.preview-area');
            if (previewArea) {
                previewArea.innerHTML = `<img src="${img.dataUrl}" alt="Evidence" class="is-hidden"><button type="button" class="ui-icon-btn ui-icon-btn-success btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh" aria-label="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
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
 * Tạo một revision (incremental) mới
 * @param {string} changeDescription - Mô tả thay đổi
 * @param {boolean} forceBaseline - true để tạo BASELINE (full snapshot)
 */
async function createRevision(changeDescription = '', forceBaseline = false) {
    if (!currentProjectId) {
        Logger.warn('Không có projectId để tạo revision');
        return null;
    }

    const user = getCurrentUser();
    const changeLog = changeDescription || `Tự động lưu lúc ${new Date().toLocaleString('vi-VN')}`;

    try {
        const response = await fetchAPI(`${API_BASE_URL}/project-revisions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProjectId,
                userId: user.userId || user.username || user.displayName || 'User',
                changeLog: changeLog,
                forceBaseline: forceBaseline
            })
        });

        if (response.ok) {
            const rawText = await response.text();
            if (!rawText || !rawText.trim()) {
                Logger.debug('ℹ️ Tạo revision thành công nhưng response body rỗng');
                return { revisionType: 'UNKNOWN', id: null };
            }

            let revision = null;
            try {
                revision = JSON.parse(rawText);
            } catch (parseError) {
                Logger.warn('Tạo revision thành công nhưng response không phải JSON hợp lệ:', parseError);
                return { revisionType: 'UNKNOWN', id: null };
            }

            Logger.debug(`✅ Đã tạo revision ${revision.revisionType || 'UNKNOWN'}: ${revision.id || 'N/A'}`);
            return revision;
        } else if (response.status === 204) {
            // Không có thay đổi nào
            Logger.debug('ℹ️ Không có thay đổi, bỏ qua tạo revision');
            return null;
        } else {
            Logger.error('Lỗi tạo revision:', await response.text());
            return null;
        }
    } catch (error) {
        Logger.error('Lỗi khi tạo revision:', error);
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
        const response = await fetchAPI(`${API_BASE_URL}/project-revisions/project/${currentProjectId}`);

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
                const isBaseline = rev.revisionType === 'BASELINE' || !rev.revisionType;
                const typeBadge = !rev.revisionType
                    ? '<span class="revision-type-badge baseline" title="Legacy full snapshot"><i class="fa-solid fa-database"></i> Legacy</span>'
                    : isBaseline
                        ? '<span class="revision-type-badge baseline" title="Full snapshot"><i class="fa-solid fa-database"></i> Baseline</span>'
                        : '<span class="revision-type-badge incremental" title="Chỉ lưu phần thay đổi"><i class="fa-solid fa-code-branch"></i> Incremental</span>';

                return `
                    <div class="version-item ${isFirst ? 'current' : ''}" data-revision-id="${rev.id}">
                        <div class="version-header">
                            <div class="version-badge">${versionNumber}</div>
                            <div class="version-info">
                                <div class="version-user">
                                    <i class="fa-solid fa-user"></i> ${rev.userId || 'User'}
                                    ${typeBadge}
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
                            <button class="ui-btn ui-btn-secondary ui-btn-sm btn-preview-version" onclick="event.stopPropagation(); previewVersion('${rev.id}')">
                                <i class="fa-solid fa-eye"></i> Xem trước
                            </button>
                            ${!isFirst ? `
                                <button class="ui-btn ui-btn-primary ui-btn-sm btn-restore-mini" onclick="event.stopPropagation(); restoreVersion('${rev.id}')">
                                    <i class="fa-solid fa-rotate-left"></i> Khôi phục
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

        } else {
            listContainer.innerHTML = '<p class="u-text-danger u-text-center">Lỗi khi tải lịch sử phiên bản</p>';
        }
    } catch (error) {
        Logger.error('Lỗi load version history:', error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        listContainer.innerHTML = '<p class="u-text-danger u-text-center">Lỗi kết nối server</p>';
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
        // Load revision data (reconstructed full snapshot)
        const response = await fetchAPI(`${API_BASE_URL}/project-revisions/${revisionId}/reconstruct`);

        if (!response.ok) {
            throw new Error('Không thể tải phiên bản');
        }

        const revision = await response.json();
        currentPreviewSnapshot = JSON.parse(revision.snapshotContent || '{}');

        // Tìm và load phiên bản trước đó để so sánh (cũng dùng reconstruct)
        const currentIndex = allRevisionsList.findIndex(r => r.id === revisionId);
        if (currentIndex >= 0 && currentIndex < allRevisionsList.length - 1) {
            const prevRevisionId = allRevisionsList[currentIndex + 1].id;
            try {
                const prevResponse = await fetchAPI(`${API_BASE_URL}/project-revisions/${prevRevisionId}/reconstruct`);
                if (prevResponse.ok) {
                    const prevRevision = await prevResponse.json();
                    previousPreviewSnapshot = JSON.parse(prevRevision.snapshotContent || '{}');
                }
            } catch (e) {
                Logger.warn('Không thể load phiên bản trước:', e);
            }
        }

        // Show meta info
        if (metaInfo) {
            const hasPrevious = previousPreviewSnapshot !== null;
            const compareStateClass = hasPrevious ? 'is-enabled' : 'is-empty';
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
                <div class="vp-meta-item vp-meta-compare ${compareStateClass} u-ml-auto">
                    <i class="fa-solid fa-code-compare"></i>
                    <span>
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
        Logger.error('Lỗi xem trước phiên bản:', error);
        showToast('Không thể tải phiên bản: ' + error.message, 'error');
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

    switch (tabName) {
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
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
        return '<p class="u-text-danger">Lỗi parse dữ liệu</p>';
    }

    // Parse previous data
    let prevData = {};
    if (prevSnapshot && prevSnapshot.yeuCauBaiToanContent) {
        try {
            prevData = typeof prevSnapshot.yeuCauBaiToanContent === 'string'
                ? JSON.parse(prevSnapshot.yeuCauBaiToanContent)
                : prevSnapshot.yeuCauBaiToanContent;
        } catch (e) { /* ignore */ }
    }

    // Parse admin review
    let adminReview = {};
    if (snapshot.yeuCauAdminReview) {
        try {
            adminReview = typeof snapshot.yeuCauAdminReview === 'string'
                ? JSON.parse(snapshot.yeuCauAdminReview)
                : snapshot.yeuCauAdminReview;
        } catch (e) { /* ignore */ }
    }

    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.yeuCauAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.yeuCauAdminReview === 'string'
                ? JSON.parse(prevSnapshot.yeuCauAdminReview)
                : prevSnapshot.yeuCauAdminReview;
        } catch (e) { /* ignore */ }
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
                <td class="diff-cell u-font-semibold u-bg-muted col-w-180">${field.label}</td>
                <td class="diff-cell">${valueHtml || '-'}</td>
                <td class="diff-cell diff-cell-center col-w-80">${evalHtml}</td>
                <td class="diff-cell col-w-200 diff-cell-admin-note">${noteHtml}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare u-text-success"></i>
                Thay đổi trong Yêu cầu bài toán
                <span class="diff-count">(${changedFields.length} thay đổi)</span>
            </div>
            <table class="diff-table">
                <thead>
                    <tr class="diff-row-muted">
                        <th class="diff-cell u-text-left">Tiêu chí</th>
                        <th class="diff-cell u-text-left">Nội dung</th>
                        <th class="diff-cell diff-cell-center col-w-80">Đánh giá</th>
                        <th class="diff-cell col-w-200">Ghi chú Admin</th>
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
        if (val === 'OK') return '<span class="status-pill status-pill-ok">OK</span>';
        if (val === 'NOK') return '<span class="status-pill status-pill-nok">NOK</span>';
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
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    let data = { inputRows: [] };
    if (content) {
        try {
            data = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (e) {
            Logger.error('Lỗi parse thongTinDauVaoContent:', e);
        }
    }

    // Parse previous data
    let prevData = { inputRows: [] };
    if (prevSnapshot && prevSnapshot.thongTinDauVaoContent) {
        try {
            prevData = typeof prevSnapshot.thongTinDauVaoContent === 'string'
                ? JSON.parse(prevSnapshot.thongTinDauVaoContent)
                : prevSnapshot.thongTinDauVaoContent;
        } catch (e) { /* ignore */ }
    }

    // Parse admin review - có thể ở format { rows: [...] } hoặc { row0: {...}, row1: {...} }
    let adminReview = {};
    let adminReviewRows = []; // Array format
    Logger.debug('DEBUG renderInputDiff - snapshot.thongTinAdminReview:', snapshot.thongTinAdminReview);
    Logger.debug('DEBUG renderInputDiff - prevSnapshot?.thongTinAdminReview:', prevSnapshot?.thongTinAdminReview);
    if (snapshot.thongTinAdminReview) {
        try {
            const parsed = typeof snapshot.thongTinAdminReview === 'string'
                ? JSON.parse(snapshot.thongTinAdminReview)
                : snapshot.thongTinAdminReview;
            Logger.debug('DEBUG parsed adminReview:', parsed);
            if (parsed.rows && Array.isArray(parsed.rows)) {
                // Format { rows: [{ eval, note }, ...] }
                adminReviewRows = parsed.rows;
            } else {
                // Format { row0: {...}, row1: {...} }
                adminReview = parsed;
            }
        } catch (e) { /* ignore */ }
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
        } catch (e) { /* ignore */ }
    }

    // Nếu không có inputRows nhưng có admin review thay đổi, vẫn hiển thị
    const hasAdminReviewChange = JSON.stringify(adminReviewRows) !== JSON.stringify(prevAdminReviewRows) ||
        JSON.stringify(adminReview) !== JSON.stringify(prevAdminReview);

    Logger.debug('DEBUG hasAdminReviewChange:', hasAdminReviewChange);
    Logger.debug('DEBUG adminReviewRows:', adminReviewRows);
    Logger.debug('DEBUG prevAdminReviewRows:', prevAdminReviewRows);
    Logger.debug('DEBUG data.inputRows length:', data.inputRows?.length);

    if ((!data.inputRows || data.inputRows.length === 0) && !hasAdminReviewChange) {
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu đầu vào</p>';
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

        Logger.debug(`DEBUG row ${index}: adminData=`, adminData, 'prevAdminData=', prevAdminData);

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
                    <td class="diff-cell diff-cell-center">${index + 1}</td>
                    <td class="diff-cell">
                        ${renderTextDiff(row.dauVao, prevRow.dauVao)}
                    </td>
                    <td class="diff-cell">
                        ${renderTextDiff(pocText, prevPocText)}
                    </td>
                    <td class="diff-cell">
                        ${renderTextDiff(sizingText, prevSizingText)}
                    </td>
                    <td class="diff-cell">
                        ${renderTextDiff(row.module, prevRow.module)}
                    </td>
                    <td class="diff-cell">
                        ${renderTextDiff(row.ghiChu, prevRow.ghiChu)}
                    </td>
                    <td class="diff-cell diff-cell-center">
                        ${renderEvalDiff(adminData.eval, prevAdminData.eval)}
                    </td>
                    <td class="diff-cell diff-cell-admin-note">
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
                    <td class="diff-cell diff-cell-center">${i + 1}</td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.dauVao || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevPocText || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevSizingText || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.module || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
                    <td class="diff-cell">-</td>
                    <td class="diff-cell">-</td>
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
                <i class="fa-solid fa-code-compare u-text-success"></i>
                Thay đổi trong Thông tin đầu vào
                <span class="diff-count">(${changeCount} dòng thay đổi)</span>
            </div>
            <table class="diff-table">
                <thead>
                    <tr class="diff-row-muted">
                        <th class="diff-cell col-w-50">STT</th>
                        <th class="diff-cell">Đầu vào</th>
                        <th class="diff-cell">Tải POC</th>
                        <th class="diff-cell">Định cỡ</th>
                        <th class="diff-cell">Module</th>
                        <th class="diff-cell">Ghi chú</th>
                        <th class="diff-cell col-w-80 diff-cell-admin">Đánh giá</th>
                        <th class="diff-cell col-w-150 diff-cell-admin">Ghi chú Admin</th>
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
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
        return '<p class="u-text-danger">Lỗi parse dữ liệu</p>';
    }

    // Parse previous data
    let prevData = {};
    if (prevSnapshot && prevSnapshot.moHinhHeThongContent) {
        try {
            prevData = typeof prevSnapshot.moHinhHeThongContent === 'string'
                ? JSON.parse(prevSnapshot.moHinhHeThongContent)
                : prevSnapshot.moHinhHeThongContent;
        } catch (e) { /* ignore */ }
    }

    // Parse admin review
    let moHinhAdmin = {};
    if (snapshot.moHinhAdminReview) {
        try {
            moHinhAdmin = typeof snapshot.moHinhAdminReview === 'string'
                ? JSON.parse(snapshot.moHinhAdminReview)
                : snapshot.moHinhAdminReview;
        } catch (e) { /* ignore */ }
    }

    let prevMoHinhAdmin = {};
    if (prevSnapshot && prevSnapshot.moHinhAdminReview) {
        try {
            prevMoHinhAdmin = typeof prevSnapshot.moHinhAdminReview === 'string'
                ? JSON.parse(prevSnapshot.moHinhAdminReview)
                : prevSnapshot.moHinhAdminReview;
        } catch (e) { /* ignore */ }
    }

    let html = '';

    // Helper: render image gallery
    const renderImageGallery = (title, images, adminData) => {
        if (!images || images.length === 0) return '';
        const thumbs = images.map((img, i) => {
            const src = img.base64 || img.dataUrl || img;
            return `<img src="${src}" alt="${title}-${i}" onclick="openModal(this.src)" class="evidence-thumb">`;
        }).join('');
        const evalHtml = adminData && adminData.eval ? renderEvalDiff(adminData.eval, null) : '';
        const noteHtml = adminData && adminData.note ? `<span class="u-text-admin u-italic u-ml-8">${adminData.note}</span>` : '';
        return `
            <div class="diff-item u-mb-16">
                <strong>${title}</strong> (${images.length} ảnh) ${evalHtml} ${noteHtml}
                <div class="evidence-thumb-grid">${thumbs}</div>
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
        html += `<div class="diff-item"><strong>Mô tả luồng nghiệp vụ:</strong><br>${flowExpl !== prevFlowExpl && prevSnapshot ? renderTextDiff(flowExpl, prevFlowExpl) : `<div class="u-mt-4 u-pre-wrap">${flowExpl}</div>`}</div>`;
    }

    // Architecture table
    const archRows = data.archRows || [];
    const prevArchRows = prevData.archRows || [];
    const archAdminReviews = moHinhAdmin.archRowReviews || [];
    const prevArchAdminReviews = prevMoHinhAdmin.archRowReviews || [];

    if (archRows.length > 0) {
        const fieldLabels = { moduleName: 'Module', loaiModule: 'Loại module', zoneMang: 'Zone mạng', heDieuHanh: 'Hệ điều hành', soLuongVIP: 'Số lượng/VIP' };
        let archRowsHtml = '';
        archRows.forEach((row, i) => {
            const prevRow = prevArchRows[i] || {};
            const adminRow = archAdminReviews[i] || {};
            const prevAdminRow = prevArchAdminReviews[i] || {};
            const isNew = i >= prevArchRows.length;
            const rowClass = isNew ? 'diff-row-added' : '';

            archRowsHtml += `
                <tr class="${rowClass}">
                    <td class="diff-cell-xs diff-cell-xs-center">${i + 1}</td>
                    <td class="diff-cell-xs">${prevSnapshot && !isNew ? renderTextDiff(row.moduleName, prevRow.moduleName) : (row.moduleName || '-')}</td>
                    <td class="diff-cell-xs">${prevSnapshot && !isNew ? renderTextDiff(row.loaiModule, prevRow.loaiModule) : (row.loaiModule || '-')}</td>
                    <td class="diff-cell-xs">${prevSnapshot && !isNew ? renderTextDiff(row.zoneMang, prevRow.zoneMang) : (row.zoneMang || '-')}</td>
                    <td class="diff-cell-xs">${prevSnapshot && !isNew ? renderTextDiff(row.heDieuHanh, prevRow.heDieuHanh) : (row.heDieuHanh || '-')}</td>
                    <td class="diff-cell-xs">${prevSnapshot && !isNew ? renderTextDiff(row.soLuongVIP, prevRow.soLuongVIP) : (row.soLuongVIP || '-')}</td>
                    <td class="diff-cell-xs diff-cell-xs-center">${renderEvalDiff(adminRow.eval, prevSnapshot ? (prevAdminRow.eval || '') : null)}</td>
                    <td class="diff-cell-xs diff-cell-admin-note">${prevSnapshot ? renderTextDiff(adminRow.note, prevAdminRow.note) : (adminRow.note || '-')}</td>
                </tr>
            `;
        });

        html += `
            <div class="diff-item u-mt-16">
                <strong>Chi tiết thành phần kiến trúc</strong>
                <table class="diff-table u-mt-8">
                    <thead>
                        <tr class="diff-row-muted">
                            <th class="diff-cell-xs col-w-40">STT</th>
                            <th class="diff-cell-xs">Module</th>
                            <th class="diff-cell-xs">Loại module</th>
                            <th class="diff-cell-xs">Zone mạng</th>
                            <th class="diff-cell-xs">Hệ ĐH</th>
                            <th class="diff-cell-xs">SL/VIP</th>
                            <th class="diff-cell-xs col-w-70 diff-cell-admin">Đánh giá</th>
                            <th class="diff-cell-xs col-w-140 diff-cell-admin">Ghi chú Admin</th>
                        </tr>
                    </thead>
                    <tbody>${archRowsHtml}</tbody>
                </table>
            </div>
        `;
    }

    const moduleLBFW = normalizeLBFWLegacyData(data.moduleLBFW || {});
    const prevModuleLBFW = normalizeLBFWLegacyData(prevData.moduleLBFW || {});
    const lbfwAdmin = adminReview.moduleLBFW || {};
    let lbfwHtml = '';
    const currentLBFWMethod = moduleLBFW.selectedMethod || 'bandwidthMethod';
    const prevLBFWMethod = prevModuleLBFW.selectedMethod || 'bandwidthMethod';
    lbfwHtml += `<div class="diff-item"><strong>Phương pháp:</strong> ${renderTextDiff(
        currentLBFWMethod === 'customMethod' ? 'Phương pháp khác' : 'Theo băng thông',
        prevLBFWMethod === 'customMethod' ? 'Phương pháp khác' : 'Theo băng thông'
    )}</div>`;

    if (currentLBFWMethod === 'customMethod') {
        const currentRows = resolveLBFWSummaryRows(moduleLBFW, 'LB/FW');
        const prevRows = resolveLBFWSummaryRows(prevModuleLBFW, 'LB/FW');
        currentRows.forEach((row, index) => {
            const prevRow = prevRows[index] || {};
            lbfwHtml += `<div class="diff-item"><strong>${row.moduleName || 'FW/LB'}:</strong> ${renderTextDiff(row.cauHinh || '', prevRow.cauHinh || '')}</div>`;
        });
        const customReview = lbfwAdmin.customMethodReview || {};
        if (customReview.eval || customReview.note) {
            lbfwHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(customReview.eval, null)} <span class="u-text-admin u-italic">${customReview.note || ''}</span></div>`;
        }
    } else {
        const bandwidth = moduleLBFW.bandwidthMethod || {};
        const prevBandwidth = prevModuleLBFW.bandwidthMethod || {};
        if (bandwidth.peakUpload || bandwidth.peakDownload) {
            lbfwHtml += `<div class="diff-item"><strong>Peak Upload:</strong> ${renderTextDiff(bandwidth.peakUpload || '', prevBandwidth.peakUpload || '')} &nbsp; <strong>Peak Download:</strong> ${renderTextDiff(bandwidth.peakDownload || '', prevBandwidth.peakDownload || '')}</div>`;
        }
        const currentRows = resolveLBFWSummaryRows(moduleLBFW, 'LB/FW');
        const prevRows = resolveLBFWSummaryRows(prevModuleLBFW, 'LB/FW');
        if (currentRows[0]) {
            lbfwHtml += `<div class="diff-item"><strong>Đề xuất:</strong> ${renderTextDiff(currentRows[0].cauHinh || '', prevRows[0]?.cauHinh || '')}</div>`;
        }
        const linearReview = lbfwAdmin.linearMethodReview || lbfwAdmin.overallReview || {};
        if (linearReview.eval || linearReview.note) {
            lbfwHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(linearReview.eval, null)} <span class="u-text-admin u-italic">${linearReview.note || ''}</span></div>`;
        }
    }

    if (lbfwHtml) {
        html += `<div class="module-diff-card module-diff-card-lbfw">
            <h4 class="module-diff-title module-diff-title-lbfw"><i class="fa-solid fa-shield-halved"></i> Module LB/FW</h4>${lbfwHtml}</div>`;
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
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-sitemap u-text-success"></i>
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
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
        return '<p class="u-text-danger">Lỗi parse dữ liệu</p>';
    }

    // Parse previous data
    let prevData = { moduleApp: {} };
    if (prevSnapshot && prevSnapshot.dinhCoHeThongContent) {
        try {
            prevData = typeof prevSnapshot.dinhCoHeThongContent === 'string'
                ? JSON.parse(prevSnapshot.dinhCoHeThongContent)
                : prevSnapshot.dinhCoHeThongContent;
        } catch (e) { /* ignore */ }
    }

    // Parse admin review
    let adminReview = {};
    if (snapshot.dinhCoAdminReview) {
        try {
            adminReview = typeof snapshot.dinhCoAdminReview === 'string'
                ? JSON.parse(snapshot.dinhCoAdminReview)
                : snapshot.dinhCoAdminReview;
        } catch (e) { /* ignore */ }
    }

    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.dinhCoAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.dinhCoAdminReview === 'string'
                ? JSON.parse(prevSnapshot.dinhCoAdminReview)
                : prevSnapshot.dinhCoAdminReview;
        } catch (e) { /* ignore */ }
    }

    let html = '';

    // ===================== MODULE APP =====================
    const moduleApp = data.moduleApp || {};
    const prevModuleApp = prevData.moduleApp || {};

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
                <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.cpu, prev.cpu) : (row.cpu || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.ram, prev.ram) : (row.ram || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.disk, prev.disk) : (row.disk || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.cintRate, prev.cintRate) : (row.cintRate || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(ar.eval, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${ar.note || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Hệ thống tham chiếu</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th>
                    <th class="diff-cell-sm">IP</th>
                    <th class="diff-cell-sm">CPU</th>
                    <th class="diff-cell-sm">RAM</th>
                    <th class="diff-cell-sm">Disk</th>
                    <th class="diff-cell-sm">Cint</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
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
                <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.cpuLoad, prev.cpuLoad) : (row.cpuLoad || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.ramLoad, prev.ramLoad) : (row.ramLoad || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.cintUsed || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.ramUsed || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(evalVal, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${noteVal || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Thông tin tải đầu vào</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th>
                    <th class="diff-cell-sm">IP</th>
                    <th class="diff-cell-sm">CPU Load %</th>
                    <th class="diff-cell-sm">RAM Load %</th>
                    <th class="diff-cell-sm">Cint used</th>
                    <th class="diff-cell-sm">RAM used</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                </tr></thead>
                <tbody>${icRowsHtml}</tbody>
            </table></div>`;
    }

    const storageRows = moduleApp.storageInputTable || [];
    const storageReviews = ((adminReview.moduleApp || {}).storageRowReviews) || [];
    if (storageRows.length > 0) {
        const prevStorageRows = prevModuleApp.storageInputTable || [];
        let storageRowsHtml = storageRows.map((row, i) => {
            const prev = prevStorageRows[i] || {};
            const ar = storageReviews[i] || {};
            const evalVal = ar.eval || row.adminEval || '';
            const noteVal = ar.note || row.adminNote || '';
            const evidenceImgs = getEvidenceImagesFromRowData(row);
            const evidenceHtml = evidenceImgs.length > 0
                ? `<div class="evidence-thumb-grid-centered">${evidenceImgs.map((img, idx) => `<img src="${img}" alt="storage-evidence-${idx}" onclick="openModal(this.src)" class="evidence-thumb-xs">`).join('')}</div>`
                : '-';
            return `<tr>
                <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.partition, prev.partition) : (row.partition || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.used, prev.used) : (row.used || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${evidenceHtml}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.note, prev.note) : (row.note || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(evalVal, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${noteVal || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Thông tin lưu trữ đầu vào</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th>
                    <th class="diff-cell-sm">IP</th>
                    <th class="diff-cell-sm">Phân vùng</th>
                    <th class="diff-cell-sm">Used</th>
                    <th class="diff-cell-sm">Ảnh sở cứ</th>
                    <th class="diff-cell-sm">Ghi chú</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                </tr></thead>
                <tbody>${storageRowsHtml}</tbody>
            </table></div>`;
    }

    // Evidence images
    const evidenceImgs = moduleApp.evidenceImages || [];
    if (evidenceImgs.length > 0) {
        const thumbs = evidenceImgs.map((img, i) => {
            const src = img.dataUrl || img.base64 || img;
            return `<img src="${src}" alt="evidence-${i}" onclick="openModal(this.src)" class="evidence-thumb-sm">`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Ảnh sở cứ Module App</strong> (${evidenceImgs.length} ảnh)<div class="evidence-thumb-grid-compact">${thumbs}</div></div>`;
    }


    if (appHtml) {
        html += `<div class="module-diff-card">
            <h4 class="module-diff-title"><i class="fa-solid fa-server"></i> Module App</h4>${appHtml}</div>`;
    }

    // ===================== MODULE MARIADB =====================
    const moduleMariaDB = data.moduleMariaDB || {};
    const prevModuleMariaDB = prevData.moduleMariaDB || {};
    let mariadbHtml = '';

    // Ref table
    const refRows = moduleMariaDB.refTable || [];
    const mariadbRefReviews = ((adminReview.moduleMariaDB || {}).refRowReviews) || [];
    if (refRows.length > 0) {
        let rRowsHtml = refRows.map((row, i) => {
            const ar = mariadbRefReviews[i] || {};
            return `<tr>
            <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
            <td class="diff-cell-sm">${row.dbName || '-'}</td>
            <td class="diff-cell-sm diff-cell-sm-center">${row.cpuLoad || '-'}</td>
            <td class="diff-cell-sm diff-cell-sm-center">${row.ramLoad || '-'}</td>
            <td class="diff-cell-sm diff-cell-sm-center">${row.storage || '-'}</td>
            <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(ar.eval, null)}</td>
            <td class="diff-cell-sm diff-cell-admin-note">${ar.note || '-'}</td>
        </tr>`;
        }).join('');
        mariadbHtml += `<div class="diff-item"><strong>Bảng tham chiếu</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th><th class="diff-cell-sm">Database</th>
                    <th class="diff-cell-sm">CPU %</th><th class="diff-cell-sm">RAM %</th>
                    <th class="diff-cell-sm">Storage</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                </tr></thead><tbody>${rRowsHtml}</tbody>
            </table></div>`;
    }

    // Storage review
    const mariadbStorageReview = (adminReview.moduleMariaDB || {}).storageReview || {};
    if (mariadbStorageReview.eval || mariadbStorageReview.note) {
        mariadbHtml += `<div class="diff-item"><strong>Đánh giá Storage:</strong> ${renderEvalDiff(mariadbStorageReview.eval, null)} <span class="u-text-admin u-italic">${mariadbStorageReview.note || ''}</span></div>`;
    }


    if (mariadbHtml) {
        html += `<div class="module-diff-card module-diff-card-mariadb">
            <h4 class="module-diff-title module-diff-title-mariadb"><i class="fa-solid fa-database"></i> Module MariaDB</h4>${mariadbHtml}</div>`;
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
                <td class="diff-cell-sm">${row.ip || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.ram || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.ramLoad || '-'}%</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.isMaster ? '✓' : ''}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(evalVal, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${noteVal || '-'}</td>
            </tr>`;
            }).join('');
            redisHtml += `<div class="diff-item"><strong>Bảng cấu hình Redis</strong>
                <table class="diff-table-sm">
                    <thead><tr class="diff-row-muted">
                        <th class="diff-cell-sm">IP</th>
                        <th class="diff-cell-sm">RAM</th>
                        <th class="diff-cell-sm">RAM Load</th>
                        <th class="diff-cell-sm">Master</th>
                        <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                        <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                    </tr></thead><tbody>${cRowsHtml}</tbody>
                </table></div>`;
        }
        if (cm.inputCCU || cm.sizingCCU) {
            redisHtml += `<div class="diff-item"><strong>CCU đầu vào:</strong> ${cm.inputCCU || '-'} &nbsp; <strong>CCU Định cỡ:</strong> ${cm.sizingCCU || '-'}</div>`;
        }
    }

    if (redisAdmin.eval || redisAdmin.note) {
        redisHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(redisAdmin.eval, null)} <span class="u-text-admin u-italic">${redisAdmin.note || ''}</span></div>`;
    }

    if (redisHtml) {
        html += `<div class="module-diff-card module-diff-card-redis">
            <h4 class="module-diff-title module-diff-title-redis"><i class="fa-solid fa-memory"></i> Module Redis</h4>${redisHtml}</div>`;
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
                <td class="diff-cell-sm">${row.ip || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.vcpu || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.ram || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.disk || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.cpuLoad || '-'}%</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.ramLoad || '-'}%</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.diskLoad || '-'}%</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(evalVal, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${noteVal || '-'}</td>
            </tr>`;
            }).join('');
            kafkaHtml += `<div class="diff-item"><strong>Bảng Linear (Existing System)</strong>
                <table class="diff-table-sm">
                    <thead><tr class="diff-row-muted">
                        <th class="diff-cell-sm">IP</th>
                        <th class="diff-cell-sm">vCPU</th>
                        <th class="diff-cell-sm">RAM</th>
                        <th class="diff-cell-sm">Disk</th>
                        <th class="diff-cell-sm">CPU %</th>
                        <th class="diff-cell-sm">RAM %</th>
                        <th class="diff-cell-sm">Disk %</th>
                        <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                        <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                    </tr></thead><tbody>${lRowsHtml}</tbody>
                </table></div>`;
        }
        if (lm.inputCCU || lm.sizingCCU) {
            kafkaHtml += `<div class="diff-item"><strong>CCU đầu vào:</strong> ${lm.inputCCU || '-'} &nbsp; <strong>CCU Định cỡ:</strong> ${lm.sizingCCU || '-'}</div>`;
        }
    }

    if (kafkaAdmin.eval || kafkaAdmin.note) {
        kafkaHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(kafkaAdmin.eval, null)} <span class="u-text-admin u-italic">${kafkaAdmin.note || ''}</span></div>`;
    }

    if (kafkaHtml) {
        html += `<div class="module-diff-card module-diff-card-kafka">
            <h4 class="module-diff-title module-diff-title-kafka"><i class="fa-solid fa-stream"></i> Module Kafka</h4>${kafkaHtml}</div>`;
    }

    // ===================== MODULE K8S =====================
    const moduleK8S = data.moduleK8S || {};
    const prevModuleK8S = prevData.moduleK8S || {};
    let k8sHtml = '';

    const k8sPocVal = moduleK8S.pocValue || '';
    const k8sSizVal = moduleK8S.sizingValue || '';
    if (k8sPocVal || k8sSizVal) {
        k8sHtml += `<div class="diff-item"><strong>Tải hệ thống POC:</strong> ${prevSnapshot ? renderTextDiff(k8sPocVal, prevModuleK8S.pocValue) : (k8sPocVal || '-')} &nbsp; | &nbsp; <strong>Định cỡ:</strong> ${prevSnapshot ? renderTextDiff(k8sSizVal, prevModuleK8S.sizingValue) : (k8sSizVal || '-')}</div>`;
    }

    const k8sBaselineRows = moduleK8S.baselineTable || [];
    const k8sBaselineReviews = ((adminReview.moduleK8S || {}).baselineRowReviews) || [];
    if (k8sBaselineRows.length > 0) {
        const prevK8SBaselineRows = prevModuleK8S.baselineTable || [];
        const baselineRowsHtml = k8sBaselineRows.map((row, i) => {
            const prev = prevK8SBaselineRows[i] || {};
            const ar = k8sBaselineReviews[i] || {};
            return `<tr>
                <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.cpu, prev.cpu) : (row.cpu || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.ram, prev.ram) : (row.ram || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.disk, prev.disk) : (row.disk || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.cintRate, prev.cintRate) : (row.cintRate || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(ar.eval, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${ar.note || '-'}</td>
            </tr>`;
        }).join('');
        k8sHtml += `<div class="diff-item"><strong>Hệ thống tham chiếu</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th>
                    <th class="diff-cell-sm">IP</th>
                    <th class="diff-cell-sm">CPU</th>
                    <th class="diff-cell-sm">RAM</th>
                    <th class="diff-cell-sm">Disk</th>
                    <th class="diff-cell-sm">Cint</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                </tr></thead>
                <tbody>${baselineRowsHtml}</tbody>
            </table></div>`;
    }

    const k8sInputConfigRows = moduleK8S.inputConfigTable || [];
    const k8sInputReviews = ((adminReview.moduleK8S || {}).inputConfigRowReviews) || [];
    if (k8sInputConfigRows.length > 0) {
        const prevK8SInputRows = prevModuleK8S.inputConfigTable || [];
        const inputRowsHtml = k8sInputConfigRows.map((row, i) => {
            const prev = prevK8SInputRows[i] || {};
            const ar = k8sInputReviews[i] || {};
            const evalVal = ar.eval || row.adminEval || '';
            const noteVal = ar.note || row.adminNote || '';
            return `<tr>
                <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.cpuLoad, prev.cpuLoad) : (row.cpuLoad || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.ramLoad, prev.ramLoad) : (row.ramLoad || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.cintUsed || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${row.ramUsed || '-'}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(evalVal, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${noteVal || '-'}</td>
            </tr>`;
        }).join('');
        k8sHtml += `<div class="diff-item"><strong>Thông tin tải đầu vào</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th>
                    <th class="diff-cell-sm">IP</th>
                    <th class="diff-cell-sm">CPU Load %</th>
                    <th class="diff-cell-sm">RAM Load %</th>
                    <th class="diff-cell-sm">Cint used</th>
                    <th class="diff-cell-sm">RAM used</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                </tr></thead>
                <tbody>${inputRowsHtml}</tbody>
            </table></div>`;
    }

    const k8sStorageRows = moduleK8S.storageInputTable || [];
    const k8sStorageReviews = ((adminReview.moduleK8S || {}).storageRowReviews) || [];
    if (k8sStorageRows.length > 0) {
        const prevK8SStorageRows = prevModuleK8S.storageInputTable || [];
        const storageRowsHtml = k8sStorageRows.map((row, i) => {
            const prev = prevK8SStorageRows[i] || {};
            const ar = k8sStorageReviews[i] || {};
            const evalVal = ar.eval || row.adminEval || '';
            const noteVal = ar.note || row.adminNote || '';
            return `<tr>
                <td class="diff-cell-sm diff-cell-sm-center">${i + 1}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.partition, prev.partition) : (row.partition || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${prevSnapshot ? renderTextDiff(row.used, prev.used) : (row.used || '-')}</td>
                <td class="diff-cell-sm">${prevSnapshot ? renderTextDiff(row.note, prev.note) : (row.note || '-')}</td>
                <td class="diff-cell-sm diff-cell-sm-center">${renderEvalDiff(evalVal, null)}</td>
                <td class="diff-cell-sm diff-cell-admin-note">${noteVal || '-'}</td>
            </tr>`;
        }).join('');
        k8sHtml += `<div class="diff-item"><strong>Thông tin lưu trữ đầu vào</strong>
            <table class="diff-table-sm">
                <thead><tr class="diff-row-muted">
                    <th class="diff-cell-sm">STT</th>
                    <th class="diff-cell-sm">IP</th>
                    <th class="diff-cell-sm">Phân vùng</th>
                    <th class="diff-cell-sm">Used</th>
                    <th class="diff-cell-sm">Ghi chú</th>
                    <th class="diff-cell-sm diff-cell-admin">Đánh giá</th>
                    <th class="diff-cell-sm diff-cell-admin">Ghi chú</th>
                </tr></thead>
                <tbody>${storageRowsHtml}</tbody>
            </table></div>`;
    }

    const k8sFlavorReview = (adminReview.moduleK8S || {}).flavorReview || {};
    if (k8sFlavorReview.eval || k8sFlavorReview.note) {
        k8sHtml += `<div class="diff-item"><strong>Đánh giá flavor:</strong> ${renderEvalDiff(k8sFlavorReview.eval, null)} <span class="u-text-admin u-italic">${k8sFlavorReview.note || ''}</span></div>`;
    }

    if (k8sHtml) {
        html += `<div class="module-diff-card">
            <h4 class="module-diff-title"><i class="fa-brands fa-kubernetes"></i> Module K8S</h4>${k8sHtml}</div>`;
    }

    if (!html.trim()) {
        if (prevSnapshot) {
            return `<div class="vp-section"><div class="vp-no-changes"><i class="fa-solid fa-check-circle"></i><span>Không có thay đổi trong phần Định cỡ hệ thống</span></div></div>`;
        }
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-sliders u-text-success"></i>
                Định cỡ hệ thống
            </div>
            ${html}
        </div>
    `;
}

/**
 * Render diff cho Tổng hợp và đề xuất
 */
function renderSummaryDiffBase(snapshot, prevSnapshot) {
    const content = snapshot.tongHopVaDeXuatContent;
    if (!content) {
        return '<p class="u-text-muted u-text-center u-p-40">Không có dữ liệu cho phần này</p>';
    }

    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
        return '<p class="u-text-danger">Lỗi parse dữ liệu</p>';
    }

    // Parse previous data
    let prevData = { summaryRows: [] };
    if (prevSnapshot && prevSnapshot.tongHopVaDeXuatContent) {
        try {
            prevData = typeof prevSnapshot.tongHopVaDeXuatContent === 'string'
                ? JSON.parse(prevSnapshot.tongHopVaDeXuatContent)
                : prevSnapshot.tongHopVaDeXuatContent;
        } catch (e) { /* ignore */ }
    }

    if (!data.summaryRows || data.summaryRows.length === 0) {
        return '<p class="u-text-muted u-text-center u-p-40">Chưa có đề xuất</p>';
    }

    const prevRows = prevData.summaryRows || [];
    let changedRowsHtml = [];
    let changeCount = 0;

    data.summaryRows.forEach((row, index) => {
        const prevRow = prevRows[index] || {};
        const fields = ['moduleType', 'moduleName', 'module', 'cauHinh', 'soLuong', 'ghiChu'];

        let hasChange = false;
        for (const f of fields) {
            if ((row[f] || '').toString().trim() !== (prevRow[f] || '').toString().trim()) hasChange = true;
        }

        const isNewRow = index >= prevRows.length;

        if (hasChange || isNewRow) {
            changeCount++;
            const rowClass = isNewRow ? 'diff-row-added' : '';
            const rowModuleType = row.moduleType || row.module || '';
            const prevModuleType = prevRow.moduleType || prevRow.module || '';
            const rowModuleName = row.moduleName || '';
            const prevModuleName = prevRow.moduleName || '';
            const rowCauHinh = row.cauHinh || row.volume || '';
            const prevCauHinh = prevRow.cauHinh || prevRow.volume || '';

            changedRowsHtml.push(`
                <tr class="${rowClass}">
                    <td class="diff-cell diff-cell-center">${index + 1}</td>
                    <td class="diff-cell">${renderTextDiff(rowModuleType, prevModuleType)}</td>
                    <td class="diff-cell">${renderTextDiff(rowModuleName, prevModuleName)}</td>
                    <td class="diff-cell">${renderTextDiff(rowCauHinh, prevCauHinh)}</td>
                    <td class="diff-cell diff-cell-center">${renderTextDiff(row.soLuong, prevRow.soLuong)}</td>
                    <td class="diff-cell">${renderTextDiff(row.ghiChu, prevRow.ghiChu)}</td>
                </tr>
            `);
        }
    });

    // Kiểm tra các hàng bị xóa
    if (prevRows.length > data.summaryRows.length) {
        for (let i = data.summaryRows.length; i < prevRows.length; i++) {
            const prevRow = prevRows[i];
            const prevModuleType = prevRow.moduleType || prevRow.module || '-';
            const prevModuleName = prevRow.moduleName || '-';
            const prevCauHinh = prevRow.cauHinh || prevRow.volume || '-';
            changeCount++;
            changedRowsHtml.push(`
                <tr class="diff-row-removed">
                    <td class="diff-cell diff-cell-center">${i + 1}</td>
                    <td class="diff-cell"><div class="diff-removed">${prevModuleType}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevModuleName}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevCauHinh}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.soLuong || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
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
                <i class="fa-solid fa-code-compare u-text-success"></i>
                Thay đổi trong Tổng hợp đề xuất
                <span class="diff-count">(${changeCount} dòng thay đổi)</span>
            </div>
            <table class="diff-table">
                <thead>
                    <tr class="diff-row-muted">
                        <th class="diff-cell">STT</th>
                        <th class="diff-cell">Loại module</th>
                        <th class="diff-cell">Tên module</th>
                        <th class="diff-cell">Cấu hình</th>
                        <th class="diff-cell">Số lượng</th>
                        <th class="diff-cell">Ghi chú</th>
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
function renderSummaryDiff(snapshot, prevSnapshot) {
    const content = snapshot.tongHopVaDeXuatContent;
    const hasAdminReview = snapshot.tongHopAdminReview;
    if (!content && !hasAdminReview) {
        return '<p class="u-text-muted u-text-center u-p-40">KhÃ´ng cÃ³ dá»¯ liá»‡u cho pháº§n nÃ y</p>';
    }

    let data = { summaryRows: [] };
    if (content) {
        try {
            data = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (e) {
            return '<p class="u-text-danger">Lá»—i parse dá»¯ liá»‡u</p>';
        }
    }

    let prevData = { summaryRows: [] };
    if (prevSnapshot && prevSnapshot.tongHopVaDeXuatContent) {
        try {
            prevData = typeof prevSnapshot.tongHopVaDeXuatContent === 'string'
                ? JSON.parse(prevSnapshot.tongHopVaDeXuatContent)
                : prevSnapshot.tongHopVaDeXuatContent;
        } catch (e) { /* ignore */ }
    }

    let adminReview = {};
    if (snapshot.tongHopAdminReview) {
        try {
            adminReview = typeof snapshot.tongHopAdminReview === 'string'
                ? JSON.parse(snapshot.tongHopAdminReview)
                : snapshot.tongHopAdminReview;
        } catch (e) { /* ignore */ }
    }

    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.tongHopAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.tongHopAdminReview === 'string'
                ? JSON.parse(prevSnapshot.tongHopAdminReview)
                : prevSnapshot.tongHopAdminReview;
        } catch (e) { /* ignore */ }
    }

    const adminReviewChanged =
        (adminReview.eval || '') !== (prevAdminReview.eval || '') ||
        (adminReview.note || '') !== (prevAdminReview.note || '');

    const rows = Array.isArray(data.summaryRows) ? data.summaryRows : [];
    const prevRows = prevData.summaryRows || [];
    let changedRowsHtml = [];
    let changeCount = 0;

    rows.forEach((row, index) => {
        const prevRow = prevRows[index] || {};
        const fields = ['moduleType', 'moduleName', 'module', 'cauHinh', 'soLuong', 'ghiChu'];

        let hasChange = false;
        for (const f of fields) {
            if ((row[f] || '').toString().trim() !== (prevRow[f] || '').toString().trim()) {
                hasChange = true;
            }
        }

        const isNewRow = index >= prevRows.length;
        if (!hasChange && !isNewRow) return;

        changeCount++;
        const rowClass = isNewRow ? 'diff-row-added' : '';
        const rowModuleType = row.moduleType || row.module || '';
        const prevModuleType = prevRow.moduleType || prevRow.module || '';
        const rowModuleName = row.moduleName || '';
        const prevModuleName = prevRow.moduleName || '';
        const rowCauHinh = row.cauHinh || row.volume || '';
        const prevCauHinh = prevRow.cauHinh || prevRow.volume || '';

        changedRowsHtml.push(`
            <tr class="${rowClass}">
                <td class="diff-cell diff-cell-center">${index + 1}</td>
                <td class="diff-cell">${renderTextDiff(rowModuleType, prevModuleType)}</td>
                <td class="diff-cell">${renderTextDiff(rowModuleName, prevModuleName)}</td>
                <td class="diff-cell">${renderTextDiff(rowCauHinh, prevCauHinh)}</td>
                <td class="diff-cell diff-cell-center">${renderTextDiff(row.soLuong, prevRow.soLuong)}</td>
                <td class="diff-cell">${renderTextDiff(row.ghiChu, prevRow.ghiChu)}</td>
            </tr>
        `);
    });

    if (prevRows.length > rows.length) {
        for (let i = rows.length; i < prevRows.length; i++) {
            const prevRow = prevRows[i];
            const prevModuleType = prevRow.moduleType || prevRow.module || '-';
            const prevModuleName = prevRow.moduleName || '-';
            const prevCauHinh = prevRow.cauHinh || prevRow.volume || '-';
            changeCount++;
            changedRowsHtml.push(`
                <tr class="diff-row-removed">
                    <td class="diff-cell diff-cell-center">${i + 1}</td>
                    <td class="diff-cell"><div class="diff-removed">${prevModuleType}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevModuleName}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevCauHinh}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.soLuong || '-'}</div></td>
                    <td class="diff-cell"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
                </tr>
            `);
        }
    }

    const adminReviewHtml = (adminReviewChanged || adminReview.eval || adminReview.note)
        ? `
            <div class="admin-review-panel">
                <div class="admin-review-title">Admin đánh giá</div>
                <div><strong>Đánh giá:</strong> ${prevSnapshot ? renderEvalDiff(adminReview.eval || '', prevAdminReview.eval || '') : renderEvalDiff(adminReview.eval || '', null)}</div>
                <div class="admin-review-note-row"><strong>Ghi chú:</strong> ${prevSnapshot ? renderTextDiff(adminReview.note || '', prevAdminReview.note || '') : (adminReview.note || '-')}</div>
            </div>
        `
        : '';

    if (changedRowsHtml.length === 0 && !adminReviewHtml && prevSnapshot) {
        return `
            <div class="vp-section">
                <div class="vp-no-changes">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>KhÃ´ng cÃ³ thay Ä‘á»•i trong pháº§n Tá»•ng há»£p</span>
                </div>
            </div>
        `;
    }

    if (changedRowsHtml.length === 0 && adminReviewHtml) {
        return `
            <div class="vp-section">
                <div class="vp-section-title">
                    <i class="fa-solid fa-code-compare u-text-success"></i>
                    Thay Ä‘á»•i trong Tá»•ng há»£p Ä‘á» xuáº¥t
                </div>
                ${adminReviewHtml}
            </div>
        `;
    }

    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare u-text-success"></i>
                Thay Ä‘á»•i trong Tá»•ng há»£p Ä‘á» xuáº¥t
                <span class="diff-count">(${changeCount} dÃ²ng thay Ä‘á»•i)</span>
            </div>
            <table class="diff-table">
                <thead>
                    <tr class="diff-row-muted">
                        <th class="diff-cell">STT</th>
                        <th class="diff-cell">Loáº¡i module</th>
                        <th class="diff-cell">TÃªn module</th>
                        <th class="diff-cell">Cáº¥u hÃ¬nh</th>
                        <th class="diff-cell">Sá»‘ lÆ°á»£ng</th>
                        <th class="diff-cell">Ghi chÃº</th>
                    </tr>
                </thead>
                <tbody>${changedRowsHtml.join('')}</tbody>
            </table>
            ${adminReviewHtml}
        </div>
    `;
}

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
    const confirmed = await showConfirm(
        'Khôi phục phiên bản',
        'Dữ liệu hiện tại sẽ được thay thế bằng nội dung của phiên bản đã chọn.<br><br><em>Một bản snapshot của dữ liệu hiện tại sẽ được tạo trước khi khôi phục.</em>',
        { confirmText: 'Khôi phục', cancelText: 'Hủy', danger: true }
    );
    if (!confirmed) return;

    showLoading(true, 'Đang khôi phục phiên bản...');

    try {
        // 1. Tạo BASELINE snapshot dữ liệu hiện tại trước khi khôi phục
        await createRevision('Backup trước khi khôi phục phiên bản', true);

        // 2. Gọi API restore
        const response = await fetchAPI(`${API_BASE_URL}/project-revisions/${revisionId}/restore`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('✅ Đã khôi phục phiên bản thành công!\n\nTrang sẽ được tải lại để hiển thị dữ liệu.', 'success');
            closeVersionPreview();
            closeVersionHistory();

            // Reload dữ liệu
            await loadAllDataFromDB();

        } else {
            throw new Error(await response.text() || 'Không thể khôi phục phiên bản');
        }
    } catch (error) {
        Logger.error('Lỗi khôi phục phiên bản:', error);
        showToast('Lỗi khi khôi phục phiên bản: ' + error.message, 'error');
    } finally {
        showLoading(false);
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

// ==================== MANUAL SAVE SYSTEM ====================

let isSaving = false;

/**
 * Map section hiện tại sang section review backend tương ứng
 */
function getReviewSectionKeyByPage(sectionId) {
    switch (sectionId) {
        case 'page-request':
            return 'request';
        case 'page-input':
            return 'input';
        case 'page-model':
            return 'model';
        case 'page-sizing':
            return 'sizing';
        case 'page-summary':
            return 'summary';
        default:
            return null;
    }
}

/**
 * Thu thập dữ liệu admin review đúng theo section đang lưu
 */
function buildAdminReviewPayloadForSection(sectionKey, options = {}) {
    if (!sectionKey) {
        return null;
    }

    switch (sectionKey) {
        case 'request': {
            const requestData = options.requestData || collectYeuCauBaiToan();
            return requestData.adminReview || {};
        }
        case 'input': {
            const rows = Array.from(document.querySelectorAll('#input-table-body tr'));
            return {
                rows: rows.map(row => ({
                    eval: row.querySelector('.admin-eval')?.value || '',
                    note: row.querySelector('.admin-note')?.value || ''
                }))
            };
        }
        case 'model':
            return collectMoHinhAdminReview();
        case 'sizing':
            return collectSizingAdminReviewData();
        case 'summary':
            return collectSummaryAdminReview();
        default:
            return null;
    }
}

/**
 * Tạo mới hoặc cập nhật project metadata cho tab Yêu cầu bài toán
 */
async function ensureProjectForRequestSection(requestData, headers, activeSectionId) {
    if (!requestData?.projectName) {
        throw new Error('Vui lòng nhập Tên dự án!');
    }

    if (!currentProjectId) {
        const projectResponse = await fetchAPI(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: requestData.projectName,
                devUnit: requestData.devUnit,
                ownerName: requestData.contactPerson,
                status: 'SIZING',
                statusRound: 1
            })
        });

        if (!projectResponse.ok) {
            throw new Error(await parseApiError(projectResponse.clone()));
        }

        const project = await projectResponse.json();
        saveProjectIdToStorage(project.id);
        resetCurrentProjectContext();
        setCurrentProjectMetaFromProject(project);
        applyProjectRequestDataToContext(requestData);
        currentProjectStatus = project.status || 'SIZING';
        currentProjectStatusRound = project.statusRound || 1;
        updateProjectStatusDisplay();
        replaceAppState('project', project.id, activeSectionId || 'page-request');
        return { created: true, project };
    }

    const updateResponse = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            name: requestData.projectName,
            devUnit: requestData.devUnit,
            ownerName: requestData.contactPerson
        })
    });

    if (!updateResponse.ok) {
        throw new Error(await parseApiError(updateResponse.clone()));
    }

    applyProjectRequestDataToContext(requestData);
    updateProjectContextPanel();
    return { created: false };
}

/**
 * Build payload tối thiểu theo section đang lưu
 */
function buildSectionSavePayload(options = {}) {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    const activeSectionId = options.activeSectionId || document.querySelector('.page-section.active')?.id || null;
    const requestData = options.requestData || null;

    let payload = {};

    try {
        if (!activeSectionId) {
            throw new Error('Không xác định được tab hiện tại để lưu');
        }

        if (activeSectionId === 'page-request') {
            const safeRequestData = requestData || collectYeuCauBaiToan();
            if (role !== 'admin1' && role !== 'admin2') {
                delete safeRequestData.adminReview;
            }
            payload.yeuCauBaiToanContent = JSON.stringify(safeRequestData);
        } else if (activeSectionId === 'page-input') {
            const inputData = collectThongTinDauVao();
            if (role !== 'admin1' && role !== 'admin2') {
                inputData.inputRows = inputData.inputRows.map(r => {
                    const c = Object.assign({}, r);
                    delete c.adminEval;
                    delete c.adminNote;
                    return c;
                });
            }
            payload.thongTinDauVaoContent = JSON.stringify(inputData);
        } else if (activeSectionId === 'page-model') {
            payload.moHinhHeThongContent = JSON.stringify(collectMoHinhHeThong());
        } else if (activeSectionId === 'page-sizing') {
            if (typeof collectAllSizingData === 'function') {
                payload.dinhCoHeThongContent = JSON.stringify(collectAllSizingData());
            }
        } else if (activeSectionId === 'page-summary') {
            cancelSummaryAutosave();
            payload.tongHopVaDeXuatContent = JSON.stringify(collectTongHop());
        }

        const summaryMode = options.summaryMode || (
            activeSectionId === 'page-sizing'
                ? 'regenerate'
                : (activeSectionId === 'page-summary' ? 'snapshot' : 'preserve')
        );

        if (summaryMode === 'regenerate') {
            cancelSummaryAutosave();
            aggregateSizingResults(options.summaryAggregateOptions || {});
            clearSummaryAdminReview();
            setSummarySaveStatusMessage('');
            payload.tongHopAdminReview = '';
            payload.tongHopVaDeXuatContent = JSON.stringify(collectTongHop());
            clearSummaryNeedsSizingRefresh();
        } else if (summaryMode === 'snapshot' && activeSectionId === 'page-summary') {
            cancelSummaryAutosave();
            payload.tongHopVaDeXuatContent = JSON.stringify(collectTongHop());
        }
    } catch (e) {
        Logger.error('Error building save payload:', e);
        return null;
    }

    return payload;
}

async function performManualSave() {
    if (isSaving) return;
    if (currentProjectStatus === 'HOAN_THANH') {
        showToast('Dự án đã hoàn thành, không thể chỉnh sửa.', 'warning');
        return;
    }

    const activeSection = document.querySelector('.page-section.active');
    const activeSectionId = activeSection?.id || null;
    if (activeSectionId && activeSectionId !== 'page-input') {
        const validation = validateTabCompletion(activeSectionId, {
            focusFirstInvalid: true,
            showToastMessage: true
        });
        if (!validation.isValid) {
            showSaveStatus('error');
            return;
        }
    }

    isSaving = true;
    showSaveStatus('saving');
    showLoading(true, 'Đang lưu dữ liệu...');

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin1' || role === 'admin2';

    try {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        let requestData = null;

        if (activeSectionId === 'page-request') {
            requestData = collectYeuCauBaiToan();
            await ensureProjectForRequestSection(requestData, headers, activeSectionId);
            applyProjectRequestDataToContext(requestData);
        } else if (!currentProjectId) {
            showToast('Vui lòng lưu "Yêu cầu bài toán" trước!', 'warning');
            showSaveStatus('error');
            return;
        }

        // ========== BUILD PAYLOAD THEO SECTION ==========
        const payload = buildSectionSavePayload({
            activeSectionId,
            requestData,
            summaryAggregateOptions: activeSectionId === 'page-sizing'
                ? { resetManualDeletes: true }
                : {}
        });
        if (!payload) {
            showSaveStatus('error');
            return;
        }

        // ========== CHẠY CÁC NETWORK REQUEST CẦN THIẾT CHO SECTION HIỆN TẠI ==========
        // LÆ°u content trÆ°á»›c, lÆ°u admin review sau Ä‘á»ƒ trÃ¡nh ghi Ä‘Ã¨ cÃ¹ng 1 project_data row.

        // 1) Lưu dữ liệu chính của section hiện tại
        if (Object.keys(payload).length > 0) {
            if (!currentProjectDataId) {
                payload.projectId = currentProjectId;
                const createResp = await fetch(`${API_BASE_URL}/project-data`, {
                    method: 'POST', headers,
                    body: JSON.stringify(payload)
                });
                if (!createResp.ok) {
                    throw new Error('POST project-data failed: ' + createResp.status);
                }
                const createResult = await createResp.json();
                if (createResult?.id) {
                    saveProjectDataIdToStorage(createResult.id);
                }
            } else {
                const updateResp = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                    method: 'PUT', headers,
                    body: JSON.stringify(payload)
                });
                if (!updateResp.ok) {
                    throw new Error('PUT project-data failed: ' + updateResp.status);
                }
            }
        }

        // 2) Admin review đúng theo section đang active
        if (isAdmin) {
            const reviewSection = getReviewSectionKeyByPage(activeSectionId);
            if (reviewSection) {
                try {
                    const reviewData = buildAdminReviewPayloadForSection(reviewSection, { requestData });
                    const reviewResp = await fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
                        method: 'POST', headers,
                        body: JSON.stringify({ section: reviewSection, reviewJson: JSON.stringify(reviewData || {}) })
                    });
                    if (!reviewResp.ok) {
                        throw new Error(`Admin review save failed [${reviewSection}]: ${reviewResp.status}`);
                    }
                } catch (e) {
                    Logger.warn(`Failed to save admin review for [${reviewSection}]`, e);
                    throw e;
                }
            }
        }

        // ========== CHỜ TẤT CẢ HOÀN TẤT ==========


        // ========== TẠO REVISION SAU KHI LƯU THÀNH CÔNG ==========
        const userName = user.displayName || user.username || 'User';
        await createRevision(`${userName} lưu dữ liệu`);

        showSaveStatus('saved');
        if (isAdmin && activeSectionId) {
            markAdminReviewSectionClean(activeSectionId);
        }
        showToast('Lưu dữ liệu thành công!', 'success');

        // Cập nhật trạng thái dự án dựa trên role
        if (role === 'admin1') {
            // Admin1 đánh giá: SIZING -> THAM_DINH
            await updateProjectStatus('admin1_review');
        } else if (role === 'admin2') {
            // Admin2 đánh giá: THAM_DINH -> PHE_DUYET
            await updateProjectStatus('admin2_review');
        } else {
            // User chỉnh sửa: có thể quay về SIZING nếu đang ở THAM_DINH/PHE_DUYET
            await updateProjectStatus('user_edit');
        }

        if (activeSectionId) {
            const nextSectionId = getNextSectionId(activeSectionId);
            if (nextSectionId) {
                showSection(nextSectionId, getSectionMenuLink(nextSectionId), { skipValidation: true });
            }
        }
        updateProjectContextPanel();
    } catch (error) {
        Logger.error('Save error:', error);
        showSaveStatus('error');
        showToast('Lỗi khi lưu dữ liệu: ' + error.message, 'error');
    } finally {
        isSaving = false;
        showLoading(false);
    }
}

/**
 * Hiển thị trạng thái lưu trên header và section hiện tại
 */
function showSaveStatus(status) {
    // Tìm status div của section đang active
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

    // Cập nhật header save indicator
    const headerIndicator = document.getElementById('header-save-status');
    if (headerIndicator) {
        headerIndicator.classList.remove('saving', 'saved', 'error');
        headerIndicator.classList.add('visible');

        switch (status) {
            case 'saving':
                headerIndicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                headerIndicator.classList.add('saving');
                headerIndicator.title = 'Đang lưu...';
                break;
            case 'saved':
                headerIndicator.innerHTML = '<i class="fa-solid fa-check-circle"></i>';
                headerIndicator.classList.add('saved');
                headerIndicator.title = 'Đã lưu';
                setTimeout(() => {
                    headerIndicator.classList.remove('visible');
                }, 3000);
                break;
            case 'error':
                headerIndicator.innerHTML = '<i class="fa-solid fa-exclamation-circle"></i>';
                headerIndicator.classList.add('error');
                headerIndicator.title = 'Lỗi lưu';
                break;
        }
    }

    if (!statusDiv) return;

    switch (status) {
        case 'saving':
            statusDiv.innerHTML = '<span class="u-text-warning u-text-sm"><i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...</span>';
            break;
        case 'saved':
            statusDiv.innerHTML = '<span class="u-text-success u-text-sm"><i class="fa-solid fa-check"></i> Đã lưu thành công</span>';
            setTimeout(() => {
                if (statusDiv.innerHTML.includes('Đã lưu thành công')) {
                    statusDiv.innerHTML = '';
                }
            }, 5000);
            break;
        case 'error':
            statusDiv.innerHTML = '<span class="u-text-danger u-text-sm"><i class="fa-solid fa-exclamation-triangle"></i> Lỗi khi lưu dữ liệu</span>';
            break;
    }
}

/**
 * Kiểm tra và tạo revision cho editor trước đó khi account mới bắt đầu edit
 */
let revisionCheckedForSession = false;

async function checkAndCreateRevisionForPreviousEditor(currentUsername) {
    const prevEditor = localStorage.getItem('lastEditorUsername');

    if (prevEditor && prevEditor !== currentUsername && currentProjectId) {
        // Account mới bắt đầu edit -> tạo BASELINE revision cho account trước
        try {
            await fetchAPI(`${API_BASE_URL}/project-revisions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProjectId,
                    userId: prevEditor,
                    changeLog: `${prevEditor} - Lưu phiên làm việc`,
                    forceBaseline: true
                })
            });
            Logger.debug(`✅ Đã tạo revision cho editor trước: ${prevEditor}`);
        } catch (e) {
            Logger.error('Lỗi tạo revision cho editor trước:', e);
        }
    }

    // Cập nhật editor hiện tại
    localStorage.setItem('lastEditorUsername', currentUsername);
}

// ==================== CONNECTION INFO TABLE ====================

function createConnectionTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${stt}</td>
        <td><textarea rows="2" class="input-full connection-auto-textarea u-pre-wrap" placeholder="VD: 10.0.0.1&#10;10.0.0.3" oninput="autoResizeConnectionTextarea(this)">${escapeHtml(data.source || '')}</textarea></td>
        <td><textarea rows="2" class="input-full connection-auto-textarea u-pre-wrap" placeholder="VD: 10.0.0.2&#10;10.0.0.4" oninput="autoResizeConnectionTextarea(this)">${escapeHtml(data.destination || '')}</textarea></td>
        <td><textarea rows="2" class="input-full connection-auto-textarea u-pre-wrap" placeholder="VD: 8080&#10;8443" oninput="autoResizeConnectionTextarea(this)">${escapeHtml(data.port || '')}</textarea></td>
        <td>
            <select class="input-full">
                <option value="">-- Chọn --</option>
                <option value="TCP" ${data.protocol === 'TCP' ? 'selected' : ''}>TCP</option>
                <option value="UDP" ${data.protocol === 'UDP' ? 'selected' : ''}>UDP</option>
                <option value="TCP/UDP" ${data.protocol === 'TCP/UDP' ? 'selected' : ''}>TCP/UDP</option>
            </select>
        </td>
        <td><textarea rows="2" class="input-full connection-auto-textarea u-pre-wrap" placeholder="Mô tả kết nối..." oninput="autoResizeConnectionTextarea(this)">${escapeHtml(data.description || '')}</textarea></td>
        <td class="admin-cell">
            <select class="admin-eval admin-eval-select" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <textarea rows="1" class="input-full admin-note connection-auto-textarea textarea-min-sm" placeholder="Nhận xét..." oninput="autoResizeConnectionTextarea(this)">${data.adminNote || ''}</textarea>
        </td>
        <td class="text-center">
            <button type="button" class="ui-icon-btn ui-icon-btn-danger btn-delete" onclick="removeConnectionRow(this)"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </td>
    `;
    return tr;
}

function autoResizeConnectionTextarea(textarea) {
    if (!textarea) return;
    if (!isTextBoxMeasurable(textarea)) {
        textarea.dataset.pendingAutoResize = '1';
        return;
    }
    textarea.style.height = 'auto';
    const minHeight = parseFloat(window.getComputedStyle(textarea).minHeight) || 0;
    textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
    delete textarea.dataset.pendingAutoResize;
}

function autoResizeModuleCell(textarea) {
    if (!textarea) return;
    if (!isTextBoxMeasurable(textarea)) {
        textarea.dataset.pendingAutoResize = '1';
        return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 44)}px`;
    delete textarea.dataset.pendingAutoResize;
}

function resizeConnectionTextareasInRow(row) {
    if (!row) return;
    row.querySelectorAll('.connection-auto-textarea').forEach(autoResizeConnectionTextarea);
}

function addConnectionRow(data = {}) {
    const tbody = document.getElementById('connection-info-table-body');
    if (!tbody) return;
    const stt = tbody.rows.length + 1;
    const tr = createConnectionTableRow(stt, data);
    tbody.appendChild(tr);
    resizeConnectionTextareasInRow(tr);
    try { applyRolePermissions(); } catch (e) { }
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
        // Chỉ thu thập dữ liệu user - KHÔNG thu thập admin fields
        // Admin review được thu thập riêng trong collectMoHinhAdminReview()
        rows.push({
            source: getTextControlValue(cells[1]),
            destination: getTextControlValue(cells[2]),
            port: getTextControlValue(cells[3]),
            protocol: cells[4]?.querySelector('select')?.value || '',
            description: getTextControlValue(cells[5])
            // NOTE: adminEval và adminNote KHÔNG được lưu ở đây
            // Chúng được lưu riêng trong moHinhAdminReview.connectionRowReviews
        });
    });
    return rows;
}

function loadConnectionInfo(data) {
    const tbody = document.getElementById('connection-info-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (Array.isArray(data) && data.length > 0) {
        data.forEach((row, idx) => {
            // Chỉ load dữ liệu user - admin review được load riêng từ moHinhAdminReview
            const tr = createConnectionTableRow(idx + 1, {
                source: row.source || '',
                destination: row.destination || '',
                port: row.port || '',
                protocol: row.protocol || '',
                description: row.description || ''
                // NOTE: adminEval/adminNote sẽ được load riêng từ connectionRowReviews
            });
            tbody.appendChild(tr);
            resizeConnectionTextareasInRow(tr);
        });
    } else {
        const tr = createConnectionTableRow(1, {});
        tbody.appendChild(tr);
        resizeConnectionTextareasInRow(tr);
    }
}

function normalizeConnectionHeader(value) {
    return String(value || '').trim();
}

const CONNECTION_IMPORT_HEADERS = ['IP Nguồn', 'IP Đích', 'Port', 'Giao thức', 'Mô tả'];

function getConnectionCellText(sheet, row, col) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    if (!cell) return '';
    if (cell.w !== undefined) return String(cell.w);
    if (cell.v !== undefined) return String(cell.v);
    return '';
}

function downloadConnectionTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('Thiếu thư viện tạo file Excel. Vui lòng liên hệ admin hệ thống.', 'error');
        return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([CONNECTION_IMPORT_HEADERS]);

    worksheet['!cols'] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 40 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Thong tin ket noi');
    XLSX.writeFile(workbook, 'mau-thong-tin-ket-noi.xlsx');
    showToast('Đã tải file mẫu Thông tin kết nối.', 'success');
}

function parseConnectionImportSheet(sheet) {
    if (!sheet || !sheet['!ref']) return null;

    const requiredHeaders = CONNECTION_IMPORT_HEADERS;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headerRow = range.s.r;
    const headerColumns = {};

    for (let col = range.s.c; col <= range.e.c; col += 1) {
        const headerValue = normalizeConnectionHeader(getConnectionCellText(sheet, headerRow, col));
        if (headerValue && headerColumns[headerValue] === undefined) {
            headerColumns[headerValue] = col;
        }
    }

    const missingHeaders = requiredHeaders.filter(name => headerColumns[name] === undefined);
    if (missingHeaders.length > 0) {
        showToast(`Thiếu cột bắt buộc: ${missingHeaders.join(', ')}`, 'warning');
        return null;
    }

    const rows = [];
    for (let row = headerRow + 1; row <= range.e.r; row += 1) {
        rows.push({
            source: getConnectionCellText(sheet, row, headerColumns['IP Nguồn']),
            destination: getConnectionCellText(sheet, row, headerColumns['IP Đích']),
            port: getConnectionCellText(sheet, row, headerColumns['Port']),
            protocol: getConnectionCellText(sheet, row, headerColumns['Giao thức']),
            description: getConnectionCellText(sheet, row, headerColumns['Mô tả'])
        });
    }

    return rows;
}

function handleConnectionImport(input) {
    const file = input?.files?.[0];
    if (!file) return;

    const role = (getCurrentUser()?.role || '').toLowerCase();
    if (role === 'admin1' || role === 'admin2') {
        showToast('Chỉ user mới có thể import dữ liệu.', 'warning');
        input.value = '';
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Thiếu thư viện đọc Excel. Vui lòng liên hệ admin hệ thống.', 'error');
        input.value = '';
        return;
    }

    const tbody = document.getElementById('connection-info-table-body');
    if (!tbody) {
        showToast('Không tìm thấy bảng Thông tin kết nối.', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames && workbook.SheetNames[0];
            const sheet = sheetName ? workbook.Sheets[sheetName] : null;

            const rows = parseConnectionImportSheet(sheet);
            if (!rows) {
                input.value = '';
                return;
            }

            tbody.innerHTML = '';
            if (rows.length === 0) {
                addConnectionRow({});
                showToast('Không có dòng dữ liệu. Đã tạo 1 dòng trống.', 'info');
                input.value = '';
                return;
            }

            rows.forEach(row => addConnectionRow(row));
            showToast(`Đã import ${rows.length} dòng từ file.`, 'success');
        } catch (error) {
            showToast('Không thể đọc file. Vui lòng kiểm tra định dạng Excel/CSV.', 'error');
        } finally {
            input.value = '';
        }
    };
    reader.onerror = () => {
        showToast('Đọc file thất bại. Vui lòng thử lại.', 'error');
        input.value = '';
    };

    reader.readAsArrayBuffer(file);
}
