// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu Project ID và ProjectData ID hiện tại
let currentProjectId = localStorage.getItem('currentProjectId') || null;
let currentProjectDataId = localStorage.getItem('currentProjectDataId') || null;

// Biến lưu trạng thái dự án hiện tại
let currentProjectStatus = null;
let currentProjectStatusRound = 1;

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
window.addEventListener('popstate', async function(event) {
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
    debug: function(...args) { if (this.DEBUG_MODE) console.log('[DEBUG]', ...args); },
    info: function(...args) { console.log('[INFO]', ...args); },
    warn: function(...args) { console.warn('[WARN]', ...args); },
    error: function(...args) { console.error('[ERROR]', ...args); }
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
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
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
        requestAnimationFrame(() => overlay.classList.add('active'));
    } else {
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
        const iconColor = danger ? '#dc3545' : '#ee0033';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <h3><i class="fa-solid ${iconClass}" style="color: ${iconColor}"></i> ${title}</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="btn-confirm-cancel">${cancelText}</button>
                    <button class="btn-confirm-ok ${danger ? 'danger' : ''}">${confirmText}</button>
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

function isRequiredControlFilled(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'select') {
        return (element.value || '').trim() !== '';
    }

    if (tag === 'input') {
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
        '#input-config-table-body .disk-load-input'
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
        '#k8s-input-config-table-body .k8s-disk-load-input'
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
    if (invalidControls.length === 0) {
        return { isValid: true, firstInvalidElement: null };
    }

    invalidControls.forEach(el => {
        el.classList.add('field-error');
        el.dataset.strictRequiredError = '1';
    });

    const firstInvalidElement = invalidControls[0];
    if (focusFirstInvalid && firstInvalidElement) {
        firstInvalidElement.focus();
        firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (showToastMessage) {
        showToast('Vui lòng điền đầy đủ dữ liệu bắt buộc trước khi tiếp tục.', 'warning');
    }

    return {
        isValid: false,
        firstInvalidElement,
        invalidCount: invalidControls.length
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

function updateFirstRowDeleteButtons(tbody) {
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach((row, index) => {
        row.querySelectorAll('.btn-delete, .btn-delete-row-item').forEach(btn => {
            btn.style.display = index === 0 ? 'none' : '';
        });
    });
}

function ensureFirstRowExists(tbodyId, addRowFn) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (tbody.querySelectorAll('tr').length === 0 && typeof addRowFn === 'function') {
        addRowFn();
    }

    updateFirstRowDeleteButtons(tbody);
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
        { id: 'mariadb-ref-table-body', add: () => addMariaDBRefRow({}) },
        { id: 'redis-config-table-body', add: () => addRedisConfigRow({}) },
        { id: 'kafka-linear-table-body', add: () => addKafkaLinearRow({}) },
        { id: 'k8s-baseline-table-body', add: () => addK8SBaselineRow() },
        { id: 'k8s-input-config-table-body', add: () => addK8SInputConfigRow() },
        { id: 'summary-table-body', add: () => addSummaryRow() }
    ];

    managedTables.forEach(item => {
        const tbody = document.getElementById(item.id);
        if (!tbody) return;

        ensureFirstRowExists(item.id, item.add);

        const observer = new MutationObserver(() => {
            ensureFirstRowExists(item.id, item.add);
        });
        observer.observe(tbody, { childList: true });
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
        
        // Disable admin evaluate button for users
        document.querySelectorAll('#page-sizing button.sizing-admin-btn, #page-sizing button.btn-evaluate').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Chỉ admin mới có quyền đánh giá';
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
    Logger.debug('Cleared Project IDs');
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
    
    // Hiển thị skeleton rows trong khi chờ load
    if (tbody) {
        tbody.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            tr.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>';
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
            emptyEl.innerHTML = `<i class="fa-solid fa-exclamation-triangle" style="color: #dc3545;"></i><p style="color: #dc3545;">Lỗi tải dữ liệu: ${error.message}</p><button onclick="loadProjectList()" style="margin-top: 12px; padding: 8px 20px; background: #ee0033; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;"><i class="fa-solid fa-rotate"></i> Thử lại</button>`;
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
        const statusText = getStatusText(project.status, project.statusRound);
        
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
    if (!statusBadge) return;
    
    const statusClass = getStatusClass(currentProjectStatus);
    const statusText = getStatusText(currentProjectStatus, currentProjectStatusRound);
    
    statusBadge.className = `project-status-badge ${statusClass}`;
    statusBadge.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${statusText}`;
    statusBadge.style.display = 'inline-flex';
    
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
function updateApproveButtonVisibility() {
    const approveHeaderBtn = document.getElementById('btn-approve-header');
    if (!approveHeaderBtn) return;
    
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    // Nút phê duyệt luôn hiển thị trên header khi đang ở trong project detail
    const inProject = document.getElementById('project-detail-page')?.style.display !== 'none';
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

async function openProject(projectId, options = {}) {
    saveProjectIdToStorage(projectId);
    
    showLoading(true, 'Đang tải dữ liệu dự án...');
    
    document.getElementById('project-list-page').style.display = 'none';
    document.getElementById('project-detail-page').style.display = 'flex';
    document.getElementById('btn-back-to-list').style.display = 'inline-block';

    // Hiển thị tab được chỉ định hoặc page-request mặc định
    const targetTab = options.tab || 'page-request';
    showSection(targetTab, document.querySelector(`.side-menu a[onclick*="${targetTab}"]`), { skipPushState: true });
    
    // Hiện nút Lịch sử phiên bản
    const btnVersionHistory = document.getElementById('btn-version-history');
    if (btnVersionHistory) btnVersionHistory.style.display = 'inline-block';
    
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
    
    // Ẩn nút Lịch sử phiên bản
    const btnVersionHistory = document.getElementById('btn-version-history');
    if (btnVersionHistory) btnVersionHistory.style.display = 'none';
    
    // Ẩn nút Phê duyệt khi không ở trong dự án
    updateApproveButtonVisibility();
    
    // Đóng panel lịch sử nếu đang mở
    closeVersionHistory();
    
    loadProjectList();

    // Cập nhật URL/history
    if (!options.skipPushState) {
        pushAppState('projects', null, null);
    }
}

async function deleteProject(projectId, projectName) {
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
        }, { showError: true });
        
        showLoading(false);
        
        if (response.ok) {
            showToast('Xóa dự án thành công!', 'success');
            loadProjectList();
        } else {
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
            
            // Cập nhật trạng thái dự án
            currentProjectStatus = 'SIZING';
            currentProjectStatusRound = 1;
            updateProjectStatusDisplay();
            
            document.getElementById('project-list-page').style.display = 'none';
            document.getElementById('project-detail-page').style.display = 'flex';
            document.getElementById('btn-back-to-list').style.display = 'inline-block';
            
            // Hiện nút Lịch sử phiên bản
            const btnVersionHistory = document.getElementById('btn-version-history');
            if (btnVersionHistory) btnVersionHistory.style.display = 'inline-block';
            
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
        archBody.appendChild(createArchTableRow(1, {}));
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
        'mariadb-ref-table-body',
        'redis-config-table-body',
        'kafka-linear-table-body',
        'k8s-baseline-table-body',
        'k8s-input-config-table-body'
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
        'total-cint-used', 'total-ram-used', 'total-disk-used',
        'redis-total-master-ram', 'redis-total-capacity',
        'kafka-linear-total-cpu', 'kafka-linear-total-ram', 'kafka-linear-total-disk',
        'k8s-total-ram', 'k8s-total-disk', 'k8s-total-cint',
        'k8s-total-cint-used', 'k8s-total-ram-used', 'k8s-total-disk-used'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '0';
    });

    // Reset summary table
    const summaryBody = document.getElementById('summary-table-body');
    if (summaryBody) {
        summaryBody.innerHTML = `<tr>
            <td colspan="6" class="text-center" style="color: #999; padding: 30px;">
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
    if (document.getElementById('mariadb-replication-model')) {
        document.getElementById('mariadb-replication-model').value = 'asynchronous';
    }
    onVirtualizationModeChange('app');
    onVirtualizationModeChange('k8s');

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

    try { updateModuleVisibility(); } catch (e) {}
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
        // Load project info để lấy trạng thái
        const projectResponse = await fetchAPI(`${API_BASE_URL}/projects/${currentProjectId}`);
        if (projectResponse.ok) {
            const project = await projectResponse.json();
            currentProjectStatus = project.status || 'SIZING';
            currentProjectStatusRound = project.statusRound || 1;
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
        const userTextarea = row.cells[1].querySelector('textarea');
        
        if (userInput) userInput.value = value || '';
        if (userSelect) userSelect.value = value || '';
        if (userTextarea) userTextarea.value = value || '';

        // Cột Admin (Cột 3 & 4)
        if (adminData) {
            const adminEval = row.cells[2].querySelector('select');
            const adminNote = row.cells[3].querySelector('textarea') || row.cells[3].querySelector('input');
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
            const adminNote = contactRow.cells[3].querySelector('textarea') || contactRow.cells[3].querySelector('input');
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
            } else {
                archBody.appendChild(createArchTableRow(1, {}));
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
                        if (adminNote) adminNote.value = review.note || '';
                    }
                });
            }
        }

        // Ensure role permissions applied after building model section
        try { applyRolePermissions(); } catch (e) {}
        
        // Update module visibility in sizing section based on selected modules
        updateModuleVisibility();
    } catch (e) {
        Logger.error('loadMoHinhHeThong error', e);
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
        const textarea = row.cells[1].querySelector('textarea');
        return input ? input.value : (select ? select.value : (textarea ? textarea.value : ''));
    };

    // Helper lấy Admin Data
    const getAdminData = (rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return { eval: '', note: '' };
        return {
            eval: row.cells[2].querySelector('select')?.value || '',
            note: row.cells[3].querySelector('textarea')?.value || row.cells[3].querySelector('input')?.value || ''
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
        showToast("Vui lòng nhập Tên dự án!", 'warning');
        return;
    }
    
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
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
        if(currentProjectDataId) {
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
            if(!currentProjectDataId) saveProjectDataIdToStorage(result.id);
            if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công!</span>`;
            
            // Cập nhật trạng thái dự án dựa trên role
            const role = (user.role || '').toLowerCase();
            if (role === 'admin1') {
                await updateProjectStatus('admin1_review');
            } else if (role === 'admin2') {
                await updateProjectStatus('admin2_review');
            } else if (role === 'user' || !role) {
                await updateProjectStatus('user_edit');
            }
            
            // Tạo revision sau khi lưu thành công
            await createRevision(`${user.displayName || user.username || 'User'} cập nhật Yêu cầu bài toán`);
            
            showToast('Đã lưu thông tin thành công!', 'success');
        } else {
            throw new Error(await response.text());
        }
        
    } catch (error) {
        Logger.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = `<span style="color: red;">✗ Lỗi: ${error.message}</span>`;
        showToast('Có lỗi xảy ra: ' + error.message, 'error');
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
        });
    }
    
    // Note: baselineRows and global evidenceImages have been removed from storage structure
    // Load per-row images (pocEvidenceImages / sizingEvidenceImages) when present
    // (the per-row image loading is handled inside createInputTableRow below)
}
// Ensure role permissions applied after loading input table
try { applyRolePermissions(); } catch (e) {}

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
                    ${pocImages.map(img => `<div class="row-evidence-item"><button type="button" class="btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh">✖</button></div>`).join('')}
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
                    ${sizingImages.map(img => `<div class="row-evidence-item"><button type="button" class="btn-view-evidence" data-base64="${img.base64}" onclick="openModalFromElement(this)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh">✖</button></div>`).join('')}
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
        // Update POC/Sizing dropdowns after row deletion
        populatePocSizingDropdowns();
    }
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
    // Re-apply role permissions so dynamically added row gets correct disabled state
    try { applyRolePermissions(); } catch (e) { /* ignore */ }
    // Update POC/Sizing dropdowns in case new row data matters
    populatePocSizingDropdowns();
}

// 3. Hàm Xóa Dòng Cuối
function removeLastRow(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (tbody && tbody.rows.length > 1) { // Giữ lại ít nhất 1 dòng
        tbody.deleteRow(tbody.rows.length - 1);
    } else {
        showToast("Phải giữ lại ít nhất một dòng!", 'warning');
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

// ========== Populate POC/Sizing dropdowns from input table ==========
// This function reads the input table rows and populates all POC and Sizing <select> dropdowns
// across all modules with the values entered in the "Thông tin đầu vào" table.
function populatePocSizingDropdowns() {
    // Collect rows from input table — each row has POC and Sizing values
    const inputRows = [];
    
    document.querySelectorAll('#input-table-body tr').forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        const dauVao = cells[1]?.querySelector('textarea')?.value?.trim() || '';
        
        // POC: column 2 (cell-wrapper > input)
        const pocInput = cells[2]?.querySelector('input');
        const pocVal = pocInput?.value?.trim() || '';
        
        // Sizing: column 3 (cell-wrapper > input)
        const sizingInput = cells[3]?.querySelector('input');
        const sizingVal = sizingInput?.value?.trim() || '';
        
        if (pocVal || sizingVal) {
            inputRows.push({
                index: index,
                dauVao: dauVao,
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
        { selectId: 'lbfw-input-row-select', pocId: 'lbfw-poc-value', sizingId: 'lbfw-sizing-value' }
    ];

    const repopulateSingleSelector = (select, pocInput, sizingInput) => {
        if (!select) return;
        const currentVal = select.value;

        select.innerHTML = '<option value="">-- Chọn từ bảng đầu vào --</option>';
        inputRows.forEach(row => {
            const option = document.createElement('option');
            option.value = row.index;
            option.dataset.poc = row.poc;
            option.dataset.sizing = row.sizing;
            const label = row.dauVao
                ? `Dòng ${row.index + 1}: POC=${row.poc}, Định cỡ=${row.sizing} (${row.dauVao})`
                : `Dòng ${row.index + 1}: POC=${row.poc}, Định cỡ=${row.sizing}`;
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
            const localReadonlyInputs = Array.from(scope.querySelectorAll('input[readonly]'));
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

    // Fallback: đọc trực tiếp từ bảng Thông tin đầu vào theo chỉ số dòng
    if (!pocValue && !sizingValue) {
        const rowIndex = Number.parseInt(normalizedSelectEl.value, 10);
        if (!Number.isNaN(rowIndex) && rowIndex >= 0) {
            const sourceRows = document.querySelectorAll('#input-table-body tr');
            const sourceRow = sourceRows[rowIndex];
            if (sourceRow) {
                const cells = sourceRow.querySelectorAll('td');
                pocValue = cells[2]?.querySelector('input')?.value?.trim() || '';
                sizingValue = cells[3]?.querySelector('input')?.value?.trim() || '';
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
}

// Callback when input table changes (add/delete row, or value change)
// Attach change listeners to input table to auto-update dropdowns
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
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
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
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        
        // Cập nhật trạng thái dự án dựa trên role
        const role = (user.role || '').toLowerCase();
        if (role === 'admin1') {
            await updateProjectStatus('admin1_review');
        } else if (role === 'admin2') {
            await updateProjectStatus('admin2_review');
        } else if (role === 'user' || !role) {
            await updateProjectStatus('user_edit');
        }
        
        // Tạo revision sau khi lưu thành công
        await createRevision(`${user.displayName || user.username || 'User'} cập nhật Thông tin đầu vào`);
        
        showToast('Đã lưu Thông tin đầu vào thành công!', 'success');
        
    } catch (error) {
        Logger.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi!</span>';
        showToast('Lỗi: ' + error.message, 'error');
    }
}

function addInputRow() {
    const tbody = document.getElementById('input-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createInputTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
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
    try { applyRolePermissions(); } catch (e) {}
}

function autoGrowTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 44)}px`;
}

function createLogicComponentTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${stt}</td>
        <td>
            <textarea class="input-full logic-name-textarea" rows="2" oninput="autoGrowTextarea(this)" placeholder="Ví dụ: MariaDB Cluster">${escapeHtml(data.componentName || '')}</textarea>
        </td>
        <td>
            <textarea class="input-full logic-task-textarea" rows="2" oninput="autoGrowTextarea(this)" placeholder="Mô tả nhiệm vụ chính của thành phần/module...">${escapeHtml(data.mainTask || '')}</textarea>
        </td>
        <td><button type="button" class="btn-delete" onclick="removeLogicComponentRow(this)">✖</button></td>
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
    try { applyRolePermissions(); } catch (e) {}
}

function removeLogicComponentRow(btn) {
    removeRow(btn);
    const tbody = document.getElementById('logic-component-table-body');
    updateSTT(tbody);
}

function createArchTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${stt}</td>
        <td><input type="text" placeholder="Tên module" value="${data.moduleName || ''}" oninput="updateModuleVisibility()"></td>
        <td>
            <select style="width: 100%; padding: 8px; border: 1px solid transparent; background: transparent;" onchange="updateModuleVisibility()">
                <option value="">-- Chọn --</option>
                <option value="App" ${data.loaiModule === 'App' ? 'selected' : ''}>App</option>
                <option value="Redis" ${data.loaiModule === 'Redis' ? 'selected' : ''}>Redis</option>
                <option value="MariaDB" ${data.loaiModule === 'MariaDB' ? 'selected' : ''}>MariaDB</option>
                <option value="Kafka" ${data.loaiModule === 'Kafka' ? 'selected' : ''}>Kafka</option>
                <option value="K8S" ${data.loaiModule === 'K8S' ? 'selected' : ''}>K8S</option>
                <option value="LB/FW" ${data.loaiModule === 'LB/FW' ? 'selected' : ''}>LB/FW</option>
            </select>
        </td>
        <td>
            <select style="width: 100%; padding: 8px; border: 1px solid transparent; background: transparent;">
                <option value="">-- Chọn --</option>
                <option value="Public" ${data.zoneMang === 'Public' ? 'selected' : ''}>Public</option>
                <option value="Private" ${data.zoneMang === 'Private' ? 'selected' : ''}>Private</option>
            </select>
        </td>
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
        <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
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
            moduleName: cells[1]?.querySelector('input')?.value || '',
            loaiModule: cells[2]?.querySelector('select')?.value || '',
            zoneMang: cells[3]?.querySelector('select')?.value || '',
            heDieuHanh: cells[4]?.querySelector('select')?.value || '',
            soLuongVIP: cells[5]?.querySelector('textarea')?.value || ''
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
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectMoHinhHeThong();
        
            await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moHinhHeThongContent: JSON.stringify(data) })
        });
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        
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
        
        // Tạo revision sau khi lưu thành công
        await createRevision(`${user.displayName || user.username || 'User'} cập nhật Mô hình hệ thống`);
        
        showToast('Đã lưu Mô hình hệ thống thành công!', 'success');
        
    } catch (error) {
        Logger.error('Error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

function addArchRow() {
    const tbody = document.getElementById('arch-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createArchTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
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
        const moduleName = cells[1]?.querySelector('input')?.value?.trim() || '';
        const moduleType = cells[2]?.querySelector('select')?.value?.trim() || '';

        if (!moduleType) return;

        moduleCounters[moduleType] = (moduleCounters[moduleType] || 0) + 1;
        instances.push({
            rowIndex,
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
    'LB/FW': 'module-lbfw-content'
};

const MODULE_ICON_MAPPING = {
    'App': 'fa-solid fa-cube',
    'Redis': 'fa-solid fa-database',
    'MariaDB': 'fa-solid fa-database',
    'Kafka': 'fa-solid fa-stream',
    'K8S': 'fa-brands fa-kubernetes',
    'LB/FW': 'fa-solid fa-shield-halved'
};

const moduleTemplateRegistry = {};
let moduleTemplatesInitialized = false;

function getModuleInstanceKey(instance) {
    return `${instance.moduleType}-${instance.rowIndex + 1}`.replace(/[^a-zA-Z0-9_-]/g, '_');
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

    const header = wrapper.querySelector('.module-collapsible-header');
    const titleSpan = header?.querySelector('span');
    if (titleSpan) {
        const iconClass = MODULE_ICON_MAPPING[moduleName] || 'fa-solid fa-cube';
        titleSpan.innerHTML = `<i class="${iconClass}"></i> Module ${moduleName} - ${escapeHtml(getModuleInstanceDisplayName(instance))}`;
    }

    if (header) {
        header.title = getModuleInstanceDisplayName(instance);
    }

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

        cursor.after(clone);
        cursor = clone;
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

    Object.keys(MODULE_TEMPLATE_MAPPING).forEach(moduleName => {
        renderModuleInstances(moduleName, instancesByType[moduleName] || [], preservedSnapshots);
    });

    syncMariaDBMasterRadioNames();

    try { populatePocSizingDropdowns(); } catch (e) {}

    try { refreshSizingRequiredMarkers(); } catch (e) {}

    try { applyRolePermissions(); } catch (e) {}
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
    } else {
        tbody.innerHTML = `<tr>
            <td colspan="6" class="text-center" style="color: #999; padding: 30px;">
                <i class="fa-solid fa-info-circle"></i> Chưa có dữ liệu định cỡ. Vui lòng thực hiện tính toán ở các module trước.
            </td>
        </tr>`;
    }
}

function createSummaryTableRow(stt, data = {}) {
    const tr = document.createElement('tr');
    const moduleType = escapeHtml(data.moduleType || data.module || '');
    const moduleName = escapeHtml(data.moduleName || '');
    const escapedGhiChu = escapeHtml(data.ghiChu || '');

    tr.innerHTML = `
        <td>${stt}</td>
        <td><strong>${moduleType}</strong></td>
        <td>${moduleName}</td>
        <td>${data.cauHinh || ''}</td>
        <td class="text-center">${data.soLuong || ''}</td>
        <td>${escapedGhiChu}</td>
    `;
    return tr;
}

function collectTongHop() {
    // Collect aggregated data from the summary table (read-only)
    const summaryRows = [];
    document.querySelectorAll('#summary-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6 && !cells[0].hasAttribute('colspan')) {
            summaryRows.push({
                moduleType: cells[1]?.textContent?.trim() || '',
                moduleName: cells[2]?.textContent?.trim() || '',
                cauHinh: cells[3]?.innerHTML || '',
                soLuong: cells[4]?.textContent?.trim() || '',
                ghiChu: cells[5]?.textContent?.trim() || ''
            });
        }
    });
    
    return { summaryRows: summaryRows };
}

// Hàm tổng hợp kết quả định cỡ từ tất cả module
function aggregateSizingResults() {
    const tbody = document.getElementById('summary-table-body');
    if (!tbody) return;
    const instancesByType = getModuleInstancesByType();
    const selectedModules = Object.keys(instancesByType);
    
    const results = [];
    let stt = 1;
    
    // 1. Module App - Chỉ khi module App được chọn trong mô hình
    if (selectedModules.includes('App')) {
        (instancesByType.App || []).forEach(instance => {
            const instanceKey = getModuleInstanceKey(instance);
            const appData = runInInstanceContext(instanceKey, () => {
                const appResult = document.getElementById('sizing-result-container')?.innerHTML || '';
                return parseAppSizingResult(appResult);
            });
            if (appData) {
                results.push({
                    stt: stt++,
                    moduleType: 'App',
                    moduleName: getModuleInstanceDisplayName(instance),
                    cauHinh: appData.cauHinh,
                    soLuong: appData.soLuong,
                    ghiChu: appData.ghiChu
                });
            }
        });
    }
    
    // 2. Module MariaDB - Chỉ khi module MariaDB được chọn
    if (selectedModules.includes('MariaDB')) {
        (instancesByType.MariaDB || []).forEach(instance => {
            const instanceKey = getModuleInstanceKey(instance);
            const mariaData = runInInstanceContext(instanceKey, () => {
                const mariaResult = document.getElementById('mariadb-result-container')?.innerHTML || '';
                return parseMariaDBSizingResult(mariaResult);
            });
            if (mariaData) {
                const instanceName = getModuleInstanceDisplayName(instance);
                results.push({
                    stt: stt++,
                    moduleType: 'MariaDB',
                    moduleName: instanceName,
                    cauHinh: mariaData.cauHinh,
                    soLuong: mariaData.soLuong,
                    ghiChu: mariaData.ghiChu
                });
                if (mariaData.maxScale) {
                    results.push({
                        stt: stt++,
                        moduleType: 'MaxScale',
                        moduleName: instanceName,
                        cauHinh: mariaData.maxScale.cauHinh,
                        soLuong: mariaData.maxScale.soLuong,
                        ghiChu: mariaData.maxScale.ghiChu
                    });
                }
                if (mariaData.nas) {
                    results.push({
                        stt: stt++,
                        moduleType: 'NAS',
                        moduleName: instanceName,
                        cauHinh: mariaData.nas.cauHinh,
                        soLuong: mariaData.nas.soLuong,
                        ghiChu: mariaData.nas.ghiChu
                    });
                }
            }
        });
    } else {
        const mariaResult = document.getElementById('mariadb-result-container')?.innerHTML || '';
        const mariaData = parseMariaDBSizingResult(mariaResult);
        if (mariaData) {
            results.push({
                stt: stt++,
                moduleType: 'MariaDB',
                moduleName: 'MariaDB',
                cauHinh: mariaData.cauHinh,
                soLuong: mariaData.soLuong,
                ghiChu: mariaData.ghiChu
            });
            if (mariaData.maxScale) {
                results.push({
                    stt: stt++,
                    moduleType: 'MaxScale',
                    moduleName: 'MariaDB',
                    cauHinh: mariaData.maxScale.cauHinh,
                    soLuong: mariaData.maxScale.soLuong,
                    ghiChu: mariaData.maxScale.ghiChu
                });
            }
            if (mariaData.nas) {
                results.push({
                    stt: stt++,
                    moduleType: 'NAS',
                    moduleName: 'MariaDB',
                    cauHinh: mariaData.nas.cauHinh,
                    soLuong: mariaData.nas.soLuong,
                    ghiChu: mariaData.nas.ghiChu
                });
            }
        }
    }
    
    // 3. Module Redis - Chỉ khi module Redis được chọn
    if (selectedModules.includes('Redis')) {
        (instancesByType.Redis || []).forEach(instance => {
            const instanceKey = getModuleInstanceKey(instance);
            const redisData = runInInstanceContext(instanceKey, () => {
                const redisKeyBtn = document.getElementById('redis-method-key');
                const isKeyMethodSelected = redisKeyBtn?.classList.contains('active') === true;
                const redisResult = isKeyMethodSelected
                    ? (document.getElementById('redis-key-result-container')?.innerHTML || '')
                    : (document.getElementById('redis-config-result-container')?.innerHTML || '');
                return parseRedisSizingResult(redisResult);
            });
            if (redisData) {
                results.push({
                    stt: stt++,
                    moduleType: 'Redis',
                    moduleName: getModuleInstanceDisplayName(instance),
                    cauHinh: redisData.cauHinh,
                    soLuong: redisData.soLuong,
                    ghiChu: redisData.ghiChu
                });
            }
        });
    }
    
    // 4. Module Kafka - Chỉ khi module Kafka được chọn
    if (selectedModules.includes('Kafka')) {
        (instancesByType.Kafka || []).forEach(instance => {
            const instanceKey = getModuleInstanceKey(instance);
            const kafkaData = runInInstanceContext(instanceKey, () => {
                const kafkaMethodThroughputBtn = document.getElementById('kafka-method-throughput');
                const isThroughputMethodSelected = kafkaMethodThroughputBtn?.classList.contains('active') === true;
                const kafkaResult = isThroughputMethodSelected
                    ? (document.getElementById('kafka-throughput-result-container')?.innerHTML || '')
                    : (document.getElementById('kafka-linear-result-container')?.innerHTML || '');
                return parseKafkaSizingResult(kafkaResult);
            });
            if (kafkaData) {
                const instanceName = getModuleInstanceDisplayName(instance);
                results.push({
                    stt: stt++,
                    moduleType: 'Kafka',
                    moduleName: instanceName,
                    cauHinh: kafkaData.cauHinh,
                    soLuong: kafkaData.soLuong,
                    ghiChu: kafkaData.ghiChu
                });
                if (kafkaData.zookeeper) {
                    results.push({
                        stt: stt++,
                        moduleType: 'Zookeeper/KRaft',
                        moduleName: instanceName,
                        cauHinh: kafkaData.zookeeper.cauHinh,
                        soLuong: kafkaData.zookeeper.soLuong,
                        ghiChu: kafkaData.zookeeper.ghiChu
                    });
                }
            }
        });
    }
    
    // 5. Module K8S - Chỉ khi module K8S được chọn
    if (selectedModules.includes('K8S')) {
        (instancesByType.K8S || []).forEach(instance => {
            const instanceKey = getModuleInstanceKey(instance);
            const k8sData = runInInstanceContext(instanceKey, () => {
                const k8sResult = document.getElementById('k8s-result-container')?.innerHTML || '';
                return parseK8SSizingResult(k8sResult);
            });
            if (k8sData && Array.isArray(k8sData)) {
                const instanceName = getModuleInstanceDisplayName(instance);
                k8sData.forEach(item => {
                    results.push({
                        stt: stt++,
                        moduleType: item.module,
                        moduleName: instanceName,
                        cauHinh: item.cauHinh,
                        soLuong: item.soLuong,
                        ghiChu: item.ghiChu
                    });
                });
            }
        });
    }
    
    // 6. Module LB/FW - Chỉ khi module LB/FW được chọn
    if (selectedModules.includes('LB/FW')) {
        (instancesByType['LB/FW'] || []).forEach(instance => {
            const instanceKey = getModuleInstanceKey(instance);
            const lbfwData = runInInstanceContext(instanceKey, () => {
                const lbfwResult = document.getElementById('lbfw-result-container')?.innerHTML || '';
                return parseLBFWSizingResult(lbfwResult);
            });
            if (lbfwData) {
                results.push({
                    stt: stt++,
                    moduleType: 'FW/LB',
                    moduleName: getModuleInstanceDisplayName(instance),
                    cauHinh: lbfwData.cauHinh,
                    soLuong: lbfwData.soLuong,
                    ghiChu: lbfwData.ghiChu
                });
            } else if (selectedModules.includes('App')) {
                // Fallback: FW/LB từ App nếu có (chỉ khi App cũng được chọn)
                const appData = runInInstanceContext(instanceKey, () => {
                    const appResult = document.getElementById('sizing-result-container')?.innerHTML || '';
                    return parseAppSizingResult(appResult);
                });
                if (appData && appData.fwlb) {
                    results.push({
                        stt: stt++,
                        moduleType: 'FW/LB',
                        moduleName: getModuleInstanceDisplayName(instance),
                        cauHinh: appData.fwlb.cauHinh,
                        soLuong: '',
                        ghiChu: ''
                    });
                }
            }
        });
    }
    
    // Render bảng
    if (results.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="6" class="text-center" style="color: #999; padding: 30px;">
                <i class="fa-solid fa-info-circle"></i> Chưa có dữ liệu định cỡ. Vui lòng thực hiện tính toán ở các module trước.
            </td>
        </tr>`;
    } else {
        tbody.innerHTML = results.map(r => `
            <tr>
                <td class="text-center">${r.stt}</td>
                <td><strong>${r.moduleType || ''}</strong></td>
                <td>${r.moduleName || ''}</td>
                <td>${r.cauHinh || ''}</td>
                <td class="text-center">${r.soLuong || ''}</td>
                <td>${r.ghiChu || ''}</td>
            </tr>
        `).join('');
    }
    
    return results;
}

// Parse kết quả Module App
function parseAppSizingResult(html) {
    if (!html || html.trim() === '') return null;
    
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

// Parse kết quả Module Redis
function parseRedisSizingResult(html) {
    if (!html || html.trim() === '') return null;
    
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

async function saveTongHop() {
    const statusDiv = document.getElementById('summary-save-status');
    if (!currentProjectId) { showToast('Vui lòng lưu "Yêu cầu bài toán" trước!', 'warning'); return; }
    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu...</span>';
        
        const data = collectTongHop();
        
        await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tongHopVaDeXuatContent: JSON.stringify(data) })
        });
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thành công!</span>';
        
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
        
        // Tạo revision sau khi lưu thành công
        await createRevision(`${user.displayName || user.username || 'User'} cập nhật Tổng hợp và đề xuất`);
        
        showToast('Đã lưu Tổng hợp và đề xuất thành công!', 'success');
        
    } catch (error) {
        Logger.error('Error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

function addSummaryRow() {
    const tbody = document.getElementById('summary-table-body');
    const nextSTT = tbody.rows.length + 1;
    const tr = createSummaryTableRow(nextSTT);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
}

// ==================== UTILITY FUNCTIONS ====================

function removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

function removeSummaryRow(btn) { removeRow(btn); }
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
                <img src="${imgData.base64}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px; cursor: zoom-in;" onclick="openModal(this.src)">
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
    // enforce role permissions (disable upload box for admin if needed)
    try { applyRolePermissions(); } catch (e) {}
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
            <input type="file" accept="image/*" onchange="previewEvidenceImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
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
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px; cursor: zoom-in;" onclick="openModal(this.src)">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewEvidenceImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
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
        <input type="file" accept="image/*" onchange="previewEvidenceSizingImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
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
        reader.onload = function(e) {
            previewArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${e.target.result}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteEvidenceSizingSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
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
    // Only accept the first file (single image per cell)
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const div = document.createElement('div');
        div.className = 'row-evidence-item';
        const safeBase64 = e.target.result.replace(/"/g, '&quot;');
        div.innerHTML = `<button type="button" class="btn-view-evidence" data-base64="${safeBase64}" onclick="openModalFromElement(this)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button><button type="button" class="btn-remove-evidence" onclick="removeRowEvidence(this)" title="Xóa ảnh">✖</button>`;
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
    if (statusDiv) statusDiv.innerHTML = '<span style="color: #b8860b;">⏳ Đang gửi đánh giá...</span>';

    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin1' && role !== 'admin2') {
        showToast('Chỉ admin mới được gửi đánh giá', 'warning');
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Chỉ admin mới có quyền đánh giá</span>';
        return;
    }

    if (!currentProjectId) {
        showToast('Chưa chọn dự án', 'warning');
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
            // Use the new collectMoHinhAdminReview function
            reviewObj = collectMoHinhAdminReview();
        } else {
            reviewObj = { message: 'unsupported section' };
        }
    } catch (e) {
        Logger.error('Error collecting review data', e);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi thu thập dữ liệu đánh giá</span>';
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
            if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Đã gửi đánh giá</span>';
            
            // Đợi một chút để đảm bảo database đã commit transaction
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Tạo revision khi admin đánh giá thành công
            await createRevision(`${user.displayName || user.username || 'Admin'} đánh giá ${label}`);
            
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
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi gửi đánh giá</span>';
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

// ==================== EXPORT TO WORD ====================

async function exportToWord() {
    const statusDiv = document.getElementById('summary-save-status');
    
    if (!currentProjectId) {
        showToast('Chưa có dữ liệu để xuất! Vui lòng lưu dữ liệu trước.', 'warning');
        return;
    }

    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang tổng hợp và lưu dữ liệu...</span>';
        
        // 1. Aggregate và lưu summary data trước khi export
        aggregateSizingResults();
        const summaryData = collectTongHop();
        
        // Lưu summary data vào database
        await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tongHopVaDeXuatContent: JSON.stringify(summaryData) })
        });
        
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang tạo file DOCX...</span>';
        
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
            
            if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Xuất file DOCX thành công!</span>';
        } else {
            throw new Error('Không thể xuất file');
        }
    } catch (e) {
        Logger.error('Export error:', e);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi xuất file!</span>';
        showToast('Không thể xuất báo cáo: ' + e.message, 'error');
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    Logger.debug('Current Project ID:', currentProjectId);
    
    // Kiểm tra xem người dùng đã đăng nhập chưa
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const authToken = localStorage.getItem('authToken');
    if (!isLoggedIn || !authToken) {
        // Chưa đăng nhập hoặc không có token, chuyển hướng đến trang đăng nhập
        window.location.href = 'login.html';
        return;
    }
    
    checkAuthStatus();
    applyRolePermissions();
    initHelpTooltipSmartPositioning();
    initFirstRowGuards();
    onVirtualizationModeChange('app');
    onVirtualizationModeChange('k8s');

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
    if (exportBtn) exportBtn.onclick = exportToWord;
    const addConnectionBtn = document.getElementById('addConnectionRowBtn');
    if (addConnectionBtn) addConnectionBtn.onclick = addConnectionRow;

    document.addEventListener('pointerdown', (event) => {
        if (event.target && event.target.classList && event.target.classList.contains('mariadb-master-radio')) {
            syncMariaDBMasterRadioNames();
        }
    }, true);
});
// Hàm xóa dòng cuối cùng của bảng
function removeLastRow(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    // Chỉ xóa nếu có nhiều hơn 1 dòng (để lại dòng đầu tiên)
    if (tbody && tbody.rows.length > 1) {
        tbody.deleteRow(tbody.rows.length - 1);
    } else {
        showToast("Không thể xóa dòng duy nhất!", 'warning');
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
        closeVersionHistory();
        closeVersionPreview();
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
            <input type="number" class="input-full text-center ram-input" value="0" min="0" oninput="${recalcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-input" value="0" min="0" oninput="${recalcHandler}">
        </td>
        
        <td>
            <input type="number" class="input-full text-center cint-input" value="0" min="0" oninput="${recalcHandler}">
        </td>

        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="baseline-evidence-input" onchange="${uploadHandler}" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh">
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
            <button class="btn-delete-row-item" onclick="${deleteRowHandler}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    // Tự động thêm dòng tương ứng vào bảng input config
    if (inputConfigTbody) {
        addInputConfigRow();
    }
    
    // Re-apply role permissions for new row (disable admin fields for user, disable user fields for admin)
    applyRolePermissions();
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
        reader.onload = function(e) {
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
            <img src="${dataUrl}" alt="Evidence" style="display:none;" class="inline-evidence-img">
            <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="btn-remove-evidence sizing-user-btn" onclick="removeInlineEvidence(this)" title="Xóa ảnh">
                ✖
            </button>
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
        <input type="file" accept="image/*" onchange="handleBaselineEvidenceUpload(this)" style="display:none">
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
        reader.onload = function(e) {
            previewArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${e.target.result}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteBaselineEvidenceSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
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
    // Check if modal exists, if not create it
    let modal = document.getElementById('image-view-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-view-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;';
        modal.innerHTML = `
            <img id="modal-image" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
            <button onclick="closeImageModal()" style="position: absolute; top: 20px; right: 30px; background: none; border: none; color: white; font-size: 40px; cursor: pointer;">&times;</button>
        `;
        modal.onclick = function(e) {
            if (e.target === modal) closeImageModal();
        };
        document.body.appendChild(modal);
    }
    
    document.getElementById('modal-image').src = src;
    modal.style.display = 'flex';
}

function closeImageModal() {
    const modal = document.getElementById('image-view-modal');
    if (modal) modal.style.display = 'none';
}

// 3. Hàm Xóa dòng & Cập nhật lại STT
function deleteBaselineRow(btn) {
    if(confirm('Bạn có chắc muốn xóa dòng này?')) {
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
    }
}

// 4. Helper: Cập nhật lại số thứ tự (1, 2, 3...) khi xóa dòng giữa
function updateRowNumbers() {
    const rows = document.querySelectorAll('#baseline-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if(sttCell) sttCell.innerText = index + 1;
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

    document.querySelectorAll('.ram-input').forEach(input => {
        totalRam += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.cint-input').forEach(input => {
        totalCint += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.disk-input').forEach(input => {
        totalDisk += parseFloat(input.value) || 0;
    });

    totalRamEl.innerText = totalRam;
    totalCintEl.innerText = totalCint;
    if (totalDiskEl) totalDiskEl.innerText = totalDisk;
}

// 6. Helper: Đổi màu xanh/đỏ cho ô Admin Select
function styleAdminSelect(select) {
    select.classList.remove('ok-status', 'nok-status');
    if(select.value === 'OK') select.classList.add('ok-status');
    if(select.value === 'NOK') select.classList.add('nok-status');
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
    if(rows.length === 0) {
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
        const inputs = row.querySelectorAll('input');

        // Rule 1: User bắt buộc chọn Module
        if(!moduleSel.value) {
            moduleSel.classList.add('input-error');
            isValid = false;
            if(!firstError) firstError = moduleSel;
        }

        // Rule 2: Admin bắt buộc phải đánh giá (OK/NOK)
        if(!adminEval.value) {
            adminEval.classList.add('input-error');
            isValid = false;
            if(!firstError) firstError = adminEval;
        }

        if(isValid) {
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

    if(!isValid) {
        showToast("KHÔNG THỂ LƯU!\nVui lòng điền các ô bị báo đỏ:\n1. Chọn tên Module.\n2. Admin phải Đánh giá từng dòng.", 'warning');
        if(firstError) firstError.focus();
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
            diskLoad: row.querySelector('.disk-load-input')?.value || '',
            cintUsed: row.querySelector('.cint-used-input')?.value || '',
            ramUsed: row.querySelector('.ram-used-input')?.value || '',
            diskUsed: row.querySelector('.disk-used-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
            adminEval: row.querySelector('.input-config-eval')?.value || '',
            adminNote: row.querySelector('.input-config-note')?.value || ''
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
            if (container) {
                container.querySelectorAll('textarea').forEach(ta => {
                    ta.textContent = ta.value;
                });
            }
            return {
                baselineTable: collectBaselineTableData(),
                inputConfigTable: collectInputConfigTableData(),
                selectedInputRow: document.getElementById('app-input-row-select')?.value || '',
                pocValue: document.getElementById('poc-value')?.value || '',
                sizingValue: document.getElementById('sizing-value')?.value || '',
                virtualizationMode: document.getElementById('app-virtualization-mode')?.value || 'ram',
                vcpuFlavor: document.getElementById('app-vcpu-flavor')?.value || '8',
                ramFlavor: document.getElementById('app-ram-flavor')?.value || '32',
                flavorEval: document.getElementById('app-flavor-eval')?.value || '',
                flavorNote: document.getElementById('app-flavor-note')?.value || '',
                sizingResult: container?.innerHTML || ''
            };
        }
        if (moduleType === 'MariaDB') return collectMariaDBData();
        if (moduleType === 'Redis') return collectRedisData();
        if (moduleType === 'Kafka') return collectKafkaData();
        if (moduleType === 'K8S') return collectK8SData();
        if (moduleType === 'LB/FW') return collectLBFWData();
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
                flavorReview: {
                    eval: document.getElementById('app-flavor-eval')?.value || '',
                    note: document.getElementById('app-flavor-note')?.value || ''
                }
            };
        }
        if (moduleType === 'MariaDB') {
            return {
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
                linearRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#kafka-linear-table-body tr').forEach(row => {
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
                baselineRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#k8s-baseline-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.k8s-baseline-eval')?.value || '',
                            note: row.querySelector('.k8s-baseline-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                inputConfigRowReviews: (() => {
                    const reviews = [];
                    document.querySelectorAll('#k8s-input-config-table-body tr').forEach(row => {
                        reviews.push({
                            eval: row.querySelector('.k8s-input-config-eval')?.value || '',
                            note: row.querySelector('.k8s-input-config-note')?.value || ''
                        });
                    });
                    return reviews;
                })(),
                flavorReview: {
                    eval: document.getElementById('k8s-flavor-eval')?.value || '',
                    note: document.getElementById('k8s-flavor-note')?.value || ''
                }
            };
        }
        if (moduleType === 'LB/FW') {
            return {
                overallReview: {
                    eval: document.getElementById('eval-module-lbfw')?.value || '',
                    note: document.getElementById('note-module-lbfw')?.value || ''
                }
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
        moduleInstanceReviews
    };
}

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
        const sizingData = collectAllSizingData();
        
        const response = await fetchAPI(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dinhCoHeThongContent: JSON.stringify(sizingData) })
        });

        if (response.ok) {
            // Cập nhật trạng thái dự án dựa trên role
            if (role === 'user' || !role) {
                await updateProjectStatus('user_edit');
            }
            
            // Tạo revision sau khi lưu thành công
            await createRevision(`${user.displayName || user.username || 'User'} cập nhật Định cỡ hệ thống`);
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
            // Tạo revision khi admin đánh giá thành công
            await createRevision(`${user.displayName || user.username || 'Admin'} đánh giá Định cỡ hệ thống`);
            
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

        if (Array.isArray(sizingData.moduleInstanceSnapshots) && sizingData.moduleInstanceSnapshots.length > 0) {
            sizingData.moduleInstanceSnapshots.forEach(snapshot => {
                if (!snapshot || !snapshot.instanceKey) return;
                const wrapper = document.querySelector(`.module-instance-wrapper[data-instance-key="${snapshot.instanceKey}"]`);
                if (wrapper && typeof snapshot.html === 'string') {
                    wrapper.innerHTML = snapshot.html;
                    rewriteInlineHandlersForInstance(wrapper, snapshot.instanceKey);
                    applyFormControlStates(wrapper, snapshot.controlStates);
                }
            });
            try { populatePocSizingDropdowns(); } catch (e) {}
            try { refreshSizingRequiredMarkers(); } catch (e) {}
            try { applyRolePermissions(); } catch (e) {}
            Logger.debug('Loaded sizing data from module instance snapshots successfully');
            return;
        }
        
        // Load Module App data
        if (sizingData.moduleApp) {
            withFirstInstance('App', () => {
                const moduleApp = sizingData.moduleApp;
                
                // Load baseline table data
                if (moduleApp.baselineTable && Array.isArray(moduleApp.baselineTable) && moduleApp.baselineTable.length > 0) {
                    const tbody = document.getElementById('baseline-table-body');
                    if (tbody) {
                        tbody.innerHTML = ''; // Clear existing rows
                        // Also clear input-config-table-body since addBaselineRow adds rows there
                        const inputConfigTbody = document.getElementById('input-config-table-body');
                        if (inputConfigTbody) inputConfigTbody.innerHTML = '';
                        
                        moduleApp.baselineTable.forEach((row, idx) => {
                            addBaselineRow(); // Add a new row
                            const lastRow = tbody.lastElementChild;
                            if (lastRow) {
                                // Use specific class selectors
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
                                
                                // Load inline evidence image(s)
                                const baselineEvidenceImages = getEvidenceImagesFromRowData(row);
                                if (baselineEvidenceImages.length > 0) {
                                    const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                                    if (evidenceCell) loadInlineEvidence(evidenceCell, baselineEvidenceImages);
                                }
                            }
                        });
                        updateBaselineTotal();
                    }
                }
                
                // Load input config table data
                if (moduleApp.inputConfigTable && Array.isArray(moduleApp.inputConfigTable) && moduleApp.inputConfigTable.length > 0) {
                    const tbody = document.getElementById('input-config-table-body');
                    if (tbody) {
                        tbody.innerHTML = ''; // Clear existing rows
                        moduleApp.inputConfigTable.forEach((row, idx) => {
                            addInputConfigRow(); // Add a new row
                            const lastRow = tbody.lastElementChild;
                            if (lastRow) {
                                const ipInput = lastRow.querySelector('.ip-config-input');
                                const cpuLoadInput = lastRow.querySelector('.cpu-load-input');
                                const ramLoadInput = lastRow.querySelector('.ram-load-input');
                                const diskLoadInput = lastRow.querySelector('.disk-load-input');
                                const cintUsedInput = lastRow.querySelector('.cint-used-input');
                                const ramUsedInput = lastRow.querySelector('.ram-used-input');
                                const diskUsedInput = lastRow.querySelector('.disk-used-input');
                                if (ipInput) ipInput.value = row.ip || '';
                                if (cpuLoadInput) cpuLoadInput.value = row.cpuLoad || '';
                                if (ramLoadInput) ramLoadInput.value = row.ramLoad || '';
                                if (diskLoadInput) diskLoadInput.value = row.diskLoad || '';
                                if (cintUsedInput) cintUsedInput.value = row.cintUsed || '';
                                if (ramUsedInput) ramUsedInput.value = row.ramUsed || '';
                                if (diskUsedInput) diskUsedInput.value = row.diskUsed || '';
                                // Load inline evidence image(s)
                                const inputCfgEvidenceImages = getEvidenceImagesFromRowData(row);
                                if (inputCfgEvidenceImages.length > 0) {
                                    const evidenceCell = lastRow.querySelector('.inline-evidence-cell');
                                    if (evidenceCell) loadInlineEvidence(evidenceCell, inputCfgEvidenceImages);
                                }
                                // Admin eval/note
                                const evalSelect = lastRow.querySelector('.input-config-eval');
                                const noteInput = lastRow.querySelector('.input-config-note');
                                if (evalSelect && row.adminEval) { evalSelect.value = row.adminEval; styleAdminSelect(evalSelect); }
                                if (noteInput && row.adminNote) noteInput.value = row.adminNote;
                            }
                        });
                        updateInputConfigTotal();
                    }
                }
                
                // Load POC and Sizing values
                if (moduleApp.selectedInputRow !== undefined && moduleApp.selectedInputRow !== '' && document.getElementById('app-input-row-select')) {
                    document.getElementById('app-input-row-select').value = moduleApp.selectedInputRow;
                    // Trigger display update
                    onInputRowSelect(document.getElementById('app-input-row-select'), 'poc-value', 'sizing-value');
                }
                if (moduleApp.pocValue && document.getElementById('poc-value')) {
                    document.getElementById('poc-value').value = moduleApp.pocValue;
                }
                if (moduleApp.sizingValue && document.getElementById('sizing-value')) {
                    document.getElementById('sizing-value').value = moduleApp.sizingValue;
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
                
                // Load sizing result
                if (moduleApp.sizingResult && document.getElementById('sizing-result-container')) {
                    document.getElementById('sizing-result-container').innerHTML = moduleApp.sizingResult;
                }
                
                // Auto expand the module if has data
                if (moduleApp.pocValue || moduleApp.sizingValue || moduleApp.sizingResult || 
                    (moduleApp.baselineTable && moduleApp.baselineTable.length > 0)) {
                    const content = document.getElementById('module-app-content');
                    const header = content?.previousElementSibling;
                    if (content && !content.classList.contains('expanded')) {
                        content.classList.add('expanded');
                        if (header) header.classList.add('active');
                    }
                }
            });
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

        if (legacyMappedReviews.length > 0) {
            loadSizingAdminReview({ moduleInstanceReviews: legacyMappedReviews });
            return;
        }

        // Load module app admin review
        if (adminReview.moduleApp) {
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
                const redisReview = adminReview.moduleRedis.overallReview;
                if (document.getElementById('eval-module-redis')) {
                    document.getElementById('eval-module-redis').value = redisReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-redis'));
                }
                if (document.getElementById('note-module-redis')) {
                    document.getElementById('note-module-redis').value = redisReview.note || '';
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
                const kafkaReview = adminReview.moduleKafka.overallReview;
                if (document.getElementById('eval-module-kafka')) {
                    document.getElementById('eval-module-kafka').value = kafkaReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-kafka'));
                }
                if (document.getElementById('note-module-kafka')) {
                    document.getElementById('note-module-kafka').value = kafkaReview.note || '';
                }
            }
            
            // Load Kafka linear row reviews
            if (adminReview.moduleKafka.linearRowReviews) {
                const rows = document.querySelectorAll('#kafka-linear-table-body tr');
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
            if (adminReview.moduleK8S.baselineRowReviews) {
                const rows = document.querySelectorAll('#k8s-baseline-table-body tr');
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
                const rows = document.querySelectorAll('#k8s-input-config-table-body tr');
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
            if (adminReview.moduleLBFW.overallReview) {
                const lbfwReview = adminReview.moduleLBFW.overallReview;
                if (document.getElementById('eval-module-lbfw')) {
                    document.getElementById('eval-module-lbfw').value = lbfwReview.eval || '';
                    styleAdminSelect(document.getElementById('eval-module-lbfw'));
                }
                if (document.getElementById('note-module-lbfw')) {
                    document.getElementById('note-module-lbfw').value = lbfwReview.note || '';
                }
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

    if (!options.skipValidation && !options.skipPushState && activeSectionId && activeSectionId !== sectionId && isForwardNavigation) {
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
        aggregateSizingResults();
    }    

    // 5. Cập nhật URL/history khi chuyển tab (chỉ khi đang ở project detail)
    if (!options.skipPushState && currentProjectId) {
        pushAppState('project', currentProjectId, sectionId);
    }
}

// Tự động thêm 1 dòng trắng khi load trang lần đầu
document.addEventListener("DOMContentLoaded", function() {
    const tbody = document.getElementById('baseline-table-body');
    if(tbody && tbody.children.length === 0) {
        addBaselineRow();
    }
    const connectionBody = document.getElementById('connection-info-table-body');
    if (connectionBody && connectionBody.children.length === 0) {
        connectionBody.appendChild(createConnectionTableRow(1, {}));
    }
    const archBody = document.getElementById('arch-table-body');
    if (archBody && archBody.children.length === 0) {
        archBody.appendChild(createArchTableRow(1, {}));
    }
    // Tính tổng khi trang load
    updateBaselineTotal();
    updateInputConfigTotal();
    // Attach listeners to update POC/Sizing dropdowns when input table changes
    attachInputTableChangeListeners();
    initHelpTooltipSmartPositioning();
    initFirstRowGuards();
});
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
            <input type="number" class="input-full text-center cpu-load-input" value="0" min="0" max="100" step="0.01" oninput="${calcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center ram-load-input" value="0" min="0" max="100" step="0.01" oninput="${calcHandler}">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-load-input" value="0" min="0" max="100" step="0.01" oninput="${calcHandler}">
        </td>
        
        <td>
            <input type="number" class="input-full text-center cint-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;">
        </td>

        <td>
            <input type="number" class="input-full text-center ram-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;">
        </td>

        <td>
            <input type="number" class="input-full text-center disk-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;">
        </td>

        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="input-config-evidence-input" onchange="${uploadHandler}" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="${uploadClickHandler}" title="Upload ảnh">
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
            <button class="btn-delete-row-item" onclick="${deleteRowHandler}">
                <i class="fa-solid fa-trash"></i>
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
    const diskUsedInput = row.querySelector('.disk-used-input');
    
    // Lấy giá trị từ bảng baseline tương ứng
    const baselineRows = document.querySelectorAll('#baseline-table-body tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    
    if (rowIndex < baselineRows.length) {
        const baselineRow = baselineRows[rowIndex];
        const baselineCint = parseFloat(baselineRow.querySelector('.cint-input').value) || 0;
        const baselineRam = parseFloat(baselineRow.querySelector('.ram-input').value) || 0;
        const baselineDisk = parseFloat(baselineRow.querySelector('.disk-input').value) || 0;
        
        const cpuLoad = parseFloat(cpuLoadInput.value) || 0;
        const ramLoad = parseFloat(ramLoadInput.value) || 0;
        const diskLoad = parseFloat(row.querySelector('.disk-load-input')?.value) || 0;
        
        // Công thức:
        // Cint_rate used (Cint) = Cint_rate_2017 (hệ thống tham chiếu) × Tải CPU 95th percentile (%)
        // RAM used (GB) = RAM (hệ thống tham chiếu) × Tải RAM 95th percentile (%)
        const cintUsed = (baselineCint * cpuLoad / 100).toFixed(2);
        const ramUsed = (baselineRam * ramLoad / 100).toFixed(2);
        const diskUsed = (baselineDisk * diskLoad / 100).toFixed(2);
        
        cintUsedInput.value = cintUsed;
        ramUsedInput.value = ramUsed;
        diskUsedInput.value = diskUsed;
    }
    
    updateInputConfigTotal();
}

function deleteInputConfigRow(btn) {
    if(confirm('Bạn có chắc muốn xóa dòng này?')) {
        btn.closest('tr').remove();
        updateInputConfigRowNumbers();
        updateInputConfigTotal();
    }
}

function updateInputConfigRowNumbers() {
    const rows = document.querySelectorAll('#input-config-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if(sttCell) sttCell.innerText = index + 1;
    });
}

function updateInputConfigTotal() {
    const totalCintUsedEl = document.getElementById('total-cint-used');
    const totalRamUsedEl = document.getElementById('total-ram-used');
    const totalDiskUsedEl = document.getElementById('total-disk-used');
    
    if (!totalCintUsedEl || !totalRamUsedEl || !totalDiskUsedEl) return;

    let totalCintUsed = 0;
    let totalRamUsed = 0;
    let totalDiskUsed = 0;

    document.querySelectorAll('.cint-used-input').forEach(input => {
        totalCintUsed += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.ram-used-input').forEach(input => {
        totalRamUsed += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.disk-used-input').forEach(input => {
        totalDiskUsed += parseFloat(input.value) || 0;
    });

    totalCintUsedEl.innerText = totalCintUsed.toFixed(2);
    totalRamUsedEl.innerText = totalRamUsed.toFixed(2);
    totalDiskUsedEl.innerText = totalDiskUsed.toFixed(2);
}

// Tính toán đề xuất số server & hiển thị bảng kết quả (lấy POC/Định cỡ từ phần THÔNG TIN ĐẦU VÀO)
function onVirtualizationModeChange(prefix) {
    const modeSelect = document.getElementById(`${prefix}-virtualization-mode`);
    const vcpuSelect = document.getElementById(`${prefix}-vcpu-flavor`);
    const ramSelect = document.getElementById(`${prefix}-ram-flavor`);
    if (!modeSelect || !vcpuSelect || !ramSelect) return;

    const mode = modeSelect.value === 'vcpu' ? 'vcpu' : 'ram';
    vcpuSelect.disabled = mode !== 'vcpu';
    ramSelect.disabled = mode !== 'ram';
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

function calculateSizingRecommendations() {
    const poc = parseFloat(document.getElementById('poc-value')?.value) || 0;
    const sizing = parseFloat(document.getElementById('sizing-value')?.value) || 0;
    if (!poc || !sizing) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".', 'warning');
        return;
    }

    const totalCint = parseFloat(document.getElementById('total-cint-used')?.innerText) || 0;
    const totalRam = parseFloat(document.getElementById('total-ram-used')?.innerText) || 0;
    const totalDisk = parseFloat(document.getElementById('total-disk-used')?.innerText) || 0;

    // Tính toán các thông số cơ bản
    const factor = sizing / poc;
    
    // Các giá trị cần cho TPS
    const cintForTPS = totalCint * factor;
    const ramForTPS = totalRam * factor;
    const diskForTPS = totalDisk * factor;
    
    // Các giá trị sau khi nhân hệ số dự phòng và đảm bảo KPI
    const cintAfterKPI = cintForTPS / 0.75 * 1.1;
    const ramAfterKPI = ramForTPS / 0.9 * 1.1;
    const diskAfterKPI = diskForTPS / 0.8 * 1.1;

    const virtualization = getVirtualizationChoice('app');
    if (!virtualization.selectedValue) {
        showToast('Vui lòng chọn cấu hình ảo hóa hợp lệ trước khi tính toán.', 'warning');
        return;
    }

    const ketqua = virtualization.mode === 'vcpu'
        ? Math.ceil(cintAfterKPI / virtualization.vcpu)
        : Math.ceil(ramAfterKPI / virtualization.ram);

    let html = '';
    
    // ==================== BẢNG 1: Thông số Máy chủ Tiến trình ====================
    html += `<h4 style="margin-top:16px; margin-bottom:8px; color:#2c5282;">Bảng tính toán Máy chủ Tiến trình</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:50px;">STT</th>
                        <th style="width:350px;">Thông số</th>
                        <th style="width:150px;">Máy chủ Tiến trình</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="text-center">1</td>
                        <td>Cintrate cần cho hệ thống</td>
                        <td class="text-center">${cintForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${totalCint.toFixed(2)} × (${sizing} / ${poc}) = ${totalCint.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>RAM (GB) cần cho hệ thống</td>
                        <td class="text-center">${ramForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${totalRam.toFixed(2)} × (${sizing} / ${poc}) = ${totalRam.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">3</td>
                        <td>Disk (GB) cần cho hệ thống</td>
                        <td class="text-center">${diskForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${totalDisk.toFixed(2)} × (${sizing} / ${poc}) = ${totalDisk.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">4</td>
                        <td>Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${cintForTPS.toFixed(2)} / 0.75 × 1.1. KPI 75%, Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">5</td>
                        <td>RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${ramForTPS.toFixed(2)} / 0.9 × 1.1. KPI 90%, Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">6</td>
                        <td>Disk cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${diskAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${diskForTPS.toFixed(2)} / 0.8 × 1.1. KPI 80%, Sai số 1.1</textarea></td>
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

    html += `<div style="margin-top:16px; padding:12px; background:#e6fffa; border-left:4px solid #38b2ac; border-radius:4px;">
                <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa ${recommendationTarget}, lựa chọn số N theo mode đã chọn: 
                ${recommendationFormula} ≈ <strong>${ketqua}</strong>
            </div>`;

    // ==================== BẢNG 2: Giá trị N với Cint/RAM/Disk ====================
    const nValues = [
        { label: 'Ketqua', value: ketqua },
    ];

    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Bảng phân bổ theo số lượng N</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:120px;">Giá trị N</th>
                        <th>Cint CPU yêu cầu</th>
                        <th>RAM yêu cầu</th>
                        <th>Disk yêu cầu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0f4f8;">
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
        
        html += `<tr${isMain ? ' style="background:#e6ffed; font-weight:600;"' : ''}>
                    <td class="text-center">${item.value}</td>
                    <td class="text-center">${cintPerN.toFixed(2)}</td>
                    <td class="text-center">${ramPerN.toFixed(2)}</td>
                    <td class="text-center">${diskPerN.toFixed(2)}</td>
                </tr>`;
    });

    html += `</tbody></table>`;

    // ==================== BẢNG 3: Đề xuất cấu hình ====================
    const cintPerServer = virtualization.mode === 'vcpu'
        ? virtualization.vcpu
        : Math.ceil(cintAfterKPI / ketqua);
    const ramPerServer = virtualization.mode === 'ram'
        ? virtualization.ram
        : Math.ceil(ramAfterKPI / ketqua);
    const diskPerServer = Math.ceil(diskAfterKPI / ketqua);
    
    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:250px;">Cấu hình</th>
                        <th style="width:100px;">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#e6ffed;">
                        <td>
                            <ul style="margin:0; padding-left:20px;">
                                <li>CPU: = ${cintPerServer} Cint</li>
                                <li>RAM: = ${ramPerServer} GB</li>
                                <li>DISK: = ${diskPerServer} GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>${ketqua + 1}</strong></td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">Dự phòng N+1</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    const container = document.getElementById('sizing-result-container');
    if (container) container.innerHTML = html;
}

// ==================== MODULE K8S FUNCTIONS ====================

function addK8SBaselineRow() {
    const tbody = document.getElementById('k8s-baseline-table-body');
    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><input type="text" class="input-full text-center k8s-ip-input" placeholder="10.x.x.x" oninput="syncK8SIPToInputConfig(this)"></td>
        <td><input type="text" class="input-full k8s-cpu-input" placeholder="Intel Xeon..."></td>
        <td><input type="number" class="input-full text-center k8s-ram-input" value="0" min="0" oninput="updateK8SBaselineTotal(); recalculateK8SInputConfigForRow(this)"></td>
        <td><input type="number" class="input-full text-center k8s-disk-input" value="0" min="0" oninput="updateK8SBaselineTotal(); recalculateK8SInputConfigForRow(this)"></td>
        <td><input type="number" class="input-full text-center k8s-cint-input" value="0" min="0" oninput="updateK8SBaselineTotal(); recalculateK8SInputConfigForRow(this)"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="k8s-baseline-evidence-input" onchange="handleInlineEvidenceUpload(this)" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh">
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
            <button class="btn-delete-row-item" onclick="deleteK8SBaselineRow(this)">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    if (inputConfigTbody) {
        addK8SInputConfigRow();
    }
    applyRolePermissions();
}

function addK8SInputConfigRow() {
    const tbody = document.getElementById('k8s-input-config-table-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td class="text-center stt-cell">${rowCount}</td>
        <td><input type="text" class="input-full text-center k8s-ip-config-input" placeholder="10.x.x.x"></td>
        <td><input type="number" class="input-full text-center k8s-cpu-load-input" value="0" min="0" max="100" step="0.01" oninput="calculateK8SInputConfigRow(this)"></td>
        <td><input type="number" class="input-full text-center k8s-ram-load-input" value="0" min="0" max="100" step="0.01" oninput="calculateK8SInputConfigRow(this)"></td>
        <td><input type="number" class="input-full text-center k8s-disk-load-input" value="0" min="0" max="100" step="0.01" oninput="calculateK8SInputConfigRow(this)"></td>
        <td><input type="number" class="input-full text-center k8s-cint-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;"></td>
        <td><input type="number" class="input-full text-center k8s-ram-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;"></td>
        <td><input type="number" class="input-full text-center k8s-disk-used-input" value="0" min="0" readonly style="background-color: #f0f0f0;"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="k8s-input-config-evidence-input" onchange="handleInlineEvidenceUpload(this)" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh">
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
            <button class="btn-delete-row-item" onclick="deleteK8SInputConfigRow(this)">
                <i class="fa-solid fa-trash"></i>
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
    const diskUsedInput = row.querySelector('.k8s-disk-used-input');

    const baselineRows = document.querySelectorAll('#k8s-baseline-table-body tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);

    if (rowIndex < baselineRows.length) {
        const baselineRow = baselineRows[rowIndex];
        const baselineCint = parseFloat(baselineRow.querySelector('.k8s-cint-input').value) || 0;
        const baselineRam = parseFloat(baselineRow.querySelector('.k8s-ram-input').value) || 0;
        const baselineDisk = parseFloat(baselineRow.querySelector('.k8s-disk-input').value) || 0;

        const cpuLoad = parseFloat(cpuLoadInput.value) || 0;
        const ramLoad = parseFloat(ramLoadInput.value) || 0;
        const diskLoad = parseFloat(row.querySelector('.k8s-disk-load-input')?.value) || 0;

        cintUsedInput.value = (baselineCint * cpuLoad / 100).toFixed(2);
        ramUsedInput.value = (baselineRam * ramLoad / 100).toFixed(2);
        diskUsedInput.value = (baselineDisk * diskLoad / 100).toFixed(2);
    }

    updateK8SInputConfigTotal();
}

function deleteK8SBaselineRow(btn) {
    if (confirm('Bạn có chắc muốn xóa dòng này?')) {
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
    }
}

function deleteK8SInputConfigRow(btn) {
    if (confirm('Bạn có chắc muốn xóa dòng này?')) {
        btn.closest('tr').remove();
        updateK8SInputConfigRowNumbers();
        updateK8SInputConfigTotal();
    }
}

function updateK8SRowNumbers() {
    const rows = document.querySelectorAll('#k8s-baseline-table-body tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.stt-cell');
        if (sttCell) sttCell.innerText = index + 1;
    });
}

function updateK8SInputConfigRowNumbers() {
    const rows = document.querySelectorAll('#k8s-input-config-table-body tr');
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

    document.querySelectorAll('#k8s-baseline-table-body .k8s-ram-input').forEach(input => {
        totalRam += parseFloat(input.value) || 0;
    });
    document.querySelectorAll('#k8s-baseline-table-body .k8s-cint-input').forEach(input => {
        totalCint += parseFloat(input.value) || 0;
    });
    document.querySelectorAll('#k8s-baseline-table-body .k8s-disk-input').forEach(input => {
        totalDisk += parseFloat(input.value) || 0;
    });

    totalRamEl.innerText = totalRam;
    totalCintEl.innerText = totalCint;
    if (totalDiskEl) totalDiskEl.innerText = totalDisk;
}

function updateK8SInputConfigTotal() {
    const totalCintUsedEl = document.getElementById('k8s-total-cint-used');
    const totalRamUsedEl = document.getElementById('k8s-total-ram-used');
    const totalDiskUsedEl = document.getElementById('k8s-total-disk-used');
    if (!totalCintUsedEl || !totalRamUsedEl || !totalDiskUsedEl) return;

    let totalCintUsed = 0, totalRamUsed = 0, totalDiskUsed = 0;

    document.querySelectorAll('#k8s-input-config-table-body .k8s-cint-used-input').forEach(input => {
        totalCintUsed += parseFloat(input.value) || 0;
    });
    document.querySelectorAll('#k8s-input-config-table-body .k8s-ram-used-input').forEach(input => {
        totalRamUsed += parseFloat(input.value) || 0;
    });
    document.querySelectorAll('#k8s-input-config-table-body .k8s-disk-used-input').forEach(input => {
        totalDiskUsed += parseFloat(input.value) || 0;
    });

    totalCintUsedEl.innerText = totalCintUsed.toFixed(2);
    totalRamUsedEl.innerText = totalRamUsed.toFixed(2);
    totalDiskUsedEl.innerText = totalDiskUsed.toFixed(2);
}

function syncK8SIPToInputConfig(ipInput) {
    const baselineRow = ipInput.closest('tr');
    const baselineRowIndex = Array.from(baselineRow.parentNode.children).indexOf(baselineRow);
    const inputConfigTbody = document.getElementById('k8s-input-config-table-body');

    if (inputConfigTbody && inputConfigTbody.rows[baselineRowIndex]) {
        const ipConfigInput = inputConfigTbody.rows[baselineRowIndex].querySelector('.k8s-ip-config-input');
        if (ipConfigInput) ipConfigInput.value = ipInput.value;
    }
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
    const totalDisk = parseFloat(document.getElementById('k8s-total-disk-used')?.innerText) || 0;

    const factor = sizing / poc;

    const cintForTPS = totalCint * factor;
    const ramForTPS = totalRam * factor;
    const diskForTPS = totalDisk * factor;

    const cintAfterKPI = cintForTPS / 0.75 * 1.1;
    const ramAfterKPI = ramForTPS / 0.9 * 1.1;
    const diskAfterKPI = diskForTPS / 0.8 * 1.1;

    const virtualization = getVirtualizationChoice('k8s');
    if (!virtualization.selectedValue) {
        showToast('Vui lòng chọn cấu hình ảo hóa hợp lệ trước khi tính toán.', 'warning');
        return;
    }

    const ketqua = virtualization.mode === 'vcpu'
        ? Math.ceil(cintAfterKPI / virtualization.vcpu)
        : Math.ceil(ramAfterKPI / virtualization.ram);

    let html = '';

    // Bảng 1: Thông số
    html += `<h4 style="margin-top:16px; margin-bottom:8px; color:#2c5282;">Bảng tính toán K8S Worker</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:50px;">STT</th>
                        <th style="width:350px;">Thông số</th>
                        <th style="width:150px;">K8S Worker</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="text-center">1</td>
                        <td>Cintrate cần cho hệ thống</td>
                        <td class="text-center">${cintForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${totalCint.toFixed(2)} × (${sizing} / ${poc}) = ${totalCint.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>RAM (GB) cần cho hệ thống</td>
                        <td class="text-center">${ramForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${totalRam.toFixed(2)} × (${sizing} / ${poc}) = ${totalRam.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">3</td>
                        <td>Disk (GB) cần cho hệ thống</td>
                        <td class="text-center">${diskForTPS.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${totalDisk.toFixed(2)} × (${sizing} / ${poc}) = ${totalDisk.toFixed(2)} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">4</td>
                        <td>Cint cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${cintAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${cintForTPS.toFixed(2)} / 0.75 × 1.1. KPI 75%, Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">5</td>
                        <td>RAM cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${ramAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${ramForTPS.toFixed(2)} / 0.9 × 1.1. KPI 90%, Sai số 1.1</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">6</td>
                        <td>Disk cần sau khi nhân hệ số dự phòng và đảm bảo KPI</td>
                        <td class="text-center">${diskAfterKPI.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${diskForTPS.toFixed(2)} / 0.8 × 1.1. KPI 80%, Sai số 1.1</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    // Đề xuất
    const recommendationFormula = virtualization.mode === 'vcpu'
        ? `N = ${cintAfterKPI.toFixed(2)} / ${virtualization.vcpu}`
        : `N = ${ramAfterKPI.toFixed(2)} / ${virtualization.ram}`;
    const recommendationTarget = virtualization.mode === 'vcpu'
        ? `theo vCPU <strong>${virtualization.selectedLabel}</strong>`
        : `theo RAM <strong>${virtualization.selectedLabel}</strong>`;

    html += `<div style="margin-top:16px; padding:12px; background:#e6fffa; border-left:4px solid #38b2ac; border-radius:4px;">
                <strong>Đề xuất:</strong> Lựa chọn cấu hình ảo hóa ${recommendationTarget}, lựa chọn số N theo mode đã chọn: 
                ${recommendationFormula} ≈ <strong>${ketqua}</strong>
            </div>`;

    // Bảng 2: Phân bổ theo N
    const nValues = [
        { label: 'Ketqua - 1', value: Math.max(1, ketqua - 1) },
        { label: 'Ketqua', value: ketqua },
        { label: 'Ketqua + 1', value: ketqua + 1 }
    ];

    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Bảng phân bổ theo số lượng N</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:120px;">Giá trị N</th>
                        <th>Cint CPU yêu cầu</th>
                        <th>RAM yêu cầu</th>
                        <th>Disk yêu cầu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0f4f8;">
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

        html += `<tr${isMain ? ' style="background:#e6ffed; font-weight:600;"' : ''}>
                    <td class="text-center">${item.value}</td>
                    <td class="text-center">${cintPerN.toFixed(2)}</td>
                    <td class="text-center">${ramPerN.toFixed(2)}</td>
                    <td class="text-center">${diskPerN.toFixed(2)}</td>
                </tr>`;
    });

    html += `</tbody></table>`;

    // Bảng 3: Đề xuất cấu hình K8S (3 dòng: K8S Master, K8S Worker, K8S ETCD)
    const cintPerServer = virtualization.mode === 'vcpu'
        ? virtualization.vcpu
        : Math.ceil(cintAfterKPI / ketqua);
    const ramPerServer = virtualization.mode === 'ram'
        ? virtualization.ram
        : Math.ceil(ramAfterKPI / ketqua);
    const diskPerServer = Math.ceil(diskAfterKPI / ketqua);

    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:150px;">Thành phần</th>
                        <th style="width:250px;">Cấu hình</th>
                        <th style="width:100px;">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>K8S Master</strong></td>
                        <td>
                            <ul style="margin:0; padding-left:20px;">
                                <li>CPU: 4 vCPU</li>
                                <li>RAM: 8 GB</li>
                                <li>DISK: 100 GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>3</strong></td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">Storage Master phải nằm ở 3 cụm storage khác nhau</textarea></td>
                    </tr>
                    <tr style="background:#e6ffed;">
                        <td><strong>K8S Worker</strong></td>
                        <td>
                            <ul style="margin:0; padding-left:20px;">
                                <li>CPU: = ${cintPerServer} Cint</li>
                                <li>RAM: = ${ramPerServer} GB</li>
                                <li>DISK: = ${diskPerServer} GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>${ketqua + 1}</strong></td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">Dự phòng N+1</textarea></td>
                    </tr>
                    <tr>
                        <td><strong>K8S ETCD</strong></td>
                        <td>
                            <ul style="margin:0; padding-left:20px;">
                                <li>CPU: 4 vCPU</li>
                                <li>RAM: 8 GB</li>
                                <li>DISK: 100 GB</li>
                            </ul>
                        </td>
                        <td class="text-center"><strong>3</strong></td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">Storage ETCD phải nằm ở 3 cụm storage khác nhau</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    const container = document.getElementById('k8s-result-container');
    if (container) container.innerHTML = html;
}

function collectK8SBaselineTableData() {
    const rows = document.querySelectorAll('#k8s-baseline-table-body tr');
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
    const rows = document.querySelectorAll('#k8s-input-config-table-body tr');
    const data = [];
    rows.forEach((row, index) => {
        const evidenceImages = collectInlineEvidenceFromScope(row);
        data.push({
            stt: index + 1,
            ip: row.querySelector('.k8s-ip-config-input')?.value || '',
            cpuLoad: row.querySelector('.k8s-cpu-load-input')?.value || '',
            ramLoad: row.querySelector('.k8s-ram-load-input')?.value || '',
            diskLoad: row.querySelector('.k8s-disk-load-input')?.value || '',
            cintUsed: row.querySelector('.k8s-cint-used-input')?.value || '',
            ramUsed: row.querySelector('.k8s-ram-used-input')?.value || '',
            diskUsed: row.querySelector('.k8s-disk-used-input')?.value || '',
            evidenceImage: evidenceImages[0] || '',
            evidenceImages: evidenceImages,
            adminEval: row.querySelector('.k8s-input-config-eval')?.value || '',
            adminNote: row.querySelector('.k8s-input-config-note')?.value || ''
        });
    });
    return data;
}

function collectK8SData() {
    return {
        baselineTable: collectK8SBaselineTableData(),
        inputConfigTable: collectK8SInputConfigTableData(),
        selectedInputRow: document.getElementById('k8s-input-row-select')?.value || '',
        pocValue: document.getElementById('k8s-poc-value')?.value || '',
        sizingValue: document.getElementById('k8s-sizing-value')?.value || '',
        virtualizationMode: document.getElementById('k8s-virtualization-mode')?.value || 'ram',
        vcpuFlavor: document.getElementById('k8s-vcpu-flavor')?.value || '8',
        ramFlavor: document.getElementById('k8s-ram-flavor')?.value || '32',
        flavorEval: document.getElementById('k8s-flavor-eval')?.value || '',
        flavorNote: document.getElementById('k8s-flavor-note')?.value || '',
        sizingResult: (() => {
            const container = document.getElementById('k8s-result-container');
            if (container) {
                container.querySelectorAll('textarea').forEach(ta => { ta.textContent = ta.value; });
                return container.innerHTML;
            }
            return '';
        })()
    };
}

function loadK8SData(data) {
    if (!data) return;

    // Load baseline table
    if (data.baselineTable && Array.isArray(data.baselineTable) && data.baselineTable.length > 0) {
        const tbody = document.getElementById('k8s-baseline-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            const inputConfigTbody = document.getElementById('k8s-input-config-table-body');
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
                    const diskLoadInput = lastRow.querySelector('.k8s-disk-load-input');
                    const cintUsedInput = lastRow.querySelector('.k8s-cint-used-input');
                    const ramUsedInput = lastRow.querySelector('.k8s-ram-used-input');
                    const diskUsedInput = lastRow.querySelector('.k8s-disk-used-input');

                    if (ipInput) ipInput.value = row.ip || '';
                    if (cpuLoadInput) cpuLoadInput.value = row.cpuLoad || '';
                    if (ramLoadInput) ramLoadInput.value = row.ramLoad || '';
                    if (diskLoadInput) diskLoadInput.value = row.diskLoad || '';
                    if (cintUsedInput) cintUsedInput.value = row.cintUsed || '';
                    if (ramUsedInput) ramUsedInput.value = row.ramUsed || '';
                    if (diskUsedInput) diskUsedInput.value = row.diskUsed || '';

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

    // Load POC and Sizing values
    if (data.selectedInputRow !== undefined && data.selectedInputRow !== '' && document.getElementById('k8s-input-row-select')) {
        document.getElementById('k8s-input-row-select').value = data.selectedInputRow;
        onInputRowSelect(document.getElementById('k8s-input-row-select'), 'k8s-poc-value', 'k8s-sizing-value');
    }
    if (data.pocValue && document.getElementById('k8s-poc-value')) {
        document.getElementById('k8s-poc-value').value = data.pocValue;
    }
    if (data.sizingValue && document.getElementById('k8s-sizing-value')) {
        document.getElementById('k8s-sizing-value').value = data.sizingValue;
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
        document.getElementById('k8s-result-container').innerHTML = data.sizingResult;
    }

    // Auto expand if has data
    if (data.pocValue || data.sizingValue || data.sizingResult ||
        (data.baselineTable && data.baselineTable.length > 0)) {
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
        <input type="file" accept="image/*" onchange="handleLBFWEvidenceUpload(this)" style="display:none">
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
        reader.onload = function(e) {
            previewArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${e.target.result}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteLBFWEvidenceSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
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
    const poc = parseFloat(document.getElementById('lbfw-poc-value')?.value) || 0;
    const sizing = parseFloat(document.getElementById('lbfw-sizing-value')?.value) || 0;
    if (!poc || !sizing) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Tải hệ thống POC" và "Định cỡ".', 'warning');
        return;
    }

    const peakUpload = parseFloat(document.getElementById('lbfw-peak-upload')?.value) || 0;
    const peakDownload = parseFloat(document.getElementById('lbfw-peak-download')?.value) || 0;

    if (!peakUpload && !peakDownload) {
        showToast('Vui lòng nhập Peak Upload hoặc Peak Download.', 'warning');
        return;
    }

    const factor = sizing / poc;
    const scaledUpload = peakUpload * factor;
    const scaledDownload = peakDownload * factor;
    const totalBandwidth = scaledUpload + scaledDownload;
    const totalBandwidthGbps = (totalBandwidth / 1000).toFixed(4);

    let html = '';

    html += `<h4 style="margin-top:16px; margin-bottom:8px; color:#2c5282;">Bảng tính toán băng thông</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:50px;">STT</th>
                        <th style="width:350px;">Thông số</th>
                        <th style="width:150px;">Giá trị (Mbps)</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="text-center">1</td>
                        <td>Peak Upload sau định cỡ</td>
                        <td class="text-center">${scaledUpload.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${peakUpload} × (${sizing} / ${poc}) = ${peakUpload} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>Peak Download sau định cỡ</td>
                        <td class="text-center">${scaledDownload.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${peakDownload} × (${sizing} / ${poc}) = ${peakDownload} × ${factor.toFixed(4)}</textarea></td>
                    </tr>
                    <tr style="background:#e6ffed; font-weight:600;">
                        <td class="text-center">3</td>
                        <td>Tổng băng thông (Upload + Download)</td>
                        <td class="text-center">${totalBandwidth.toFixed(2)}</td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;">= ${scaledUpload.toFixed(2)} + ${scaledDownload.toFixed(2)} = ${totalBandwidth.toFixed(2)} Mbps ≈ ${totalBandwidthGbps} Gbps</textarea></td>
                    </tr>
                </tbody>
            </table>`;

    html += `<h4 style="margin-top:20px; margin-bottom:8px; color:#2c5282;">Đề xuất cấu hình</h4>`;
    html += `<table class="sizing-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th style="width:150px;">Thành phần</th>
                        <th style="width:250px;">Thông lượng</th>
                        <th style="width:100px;">Số lượng</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#e6ffed;">
                        <td><strong>FW/LB</strong></td>
                        <td class="text-center"><strong>Thông lượng < ${totalBandwidthGbps} Gbps</strong></td>
                        <td class="text-center"></td>
                        <td><textarea class="input-full sizing-note" rows="1" style="resize:vertical;min-height:30px;"></textarea></td>
                    </tr>
                </tbody>
            </table>`;

    const container = document.getElementById('lbfw-result-container');
    if (container) container.innerHTML = html;
}

function collectLBFWData() {
    return {
        evidenceImages: collectLBFWEvidenceData(),
        peakUpload: document.getElementById('lbfw-peak-upload')?.value || '',
        peakDownload: document.getElementById('lbfw-peak-download')?.value || '',
        selectedInputRow: document.getElementById('lbfw-input-row-select')?.value || '',
        pocValue: document.getElementById('lbfw-poc-value')?.value || '',
        sizingValue: document.getElementById('lbfw-sizing-value')?.value || '',
        sizingResult: (() => {
            const container = document.getElementById('lbfw-result-container');
            if (container) {
                container.querySelectorAll('textarea').forEach(ta => { ta.textContent = ta.value; });
                return container.innerHTML;
            }
            return '';
        })()
    };
}

function loadLBFWData(data) {
    if (!data) return;

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
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                            <img src="${imgData.dataUrl}" alt="Evidence" style="display:none;">
                            <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button type="button" class="btn-remove-evidence" onclick="deleteLBFWEvidenceSlot(this)" title="Xóa ảnh">
                                ✖
                            </button>
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
        document.getElementById('lbfw-poc-value').value = data.pocValue;
    }
    if (data.sizingValue && document.getElementById('lbfw-sizing-value')) {
        document.getElementById('lbfw-sizing-value').value = data.sizingValue;
    }

    // Load sizing result
    if (data.sizingResult && document.getElementById('lbfw-result-container')) {
        document.getElementById('lbfw-result-container').innerHTML = data.sizingResult;
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

// Parse kết quả Module K8S
function parseK8SSizingResult(html) {
    if (!html || html.trim() === '') return null;

    const results = [];

    // K8S Master - fixed config
    const masterMatch = html.match(/K8S Master[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>[\s\S]*?<strong>(\d+)<\/strong>/i);
    if (masterMatch) {
        const listContent = masterMatch[1];
        const vcpu = listContent.match(/(\d+)\s*vCPU/i);
        const ram = listContent.match(/(\d+)\s*GB/i);
        const disk = listContent.match(/DISK[:\s]*(\d+)\s*GB/i);
        let cauHinh = '';
        if (vcpu) cauHinh += `- vCPU = ${vcpu[1]}\n`;
        if (ram) cauHinh += `- RAM = ${ram[1]}GB\n`;
        if (disk) cauHinh += `- Disk = ${disk[1]}GB`;
        results.push({
            module: 'K8S Master',
            cauHinh: cauHinh.replace(/\n/g, '<br>'),
            soLuong: masterMatch[2],
            ghiChu: 'Storage Master phải nằm ở 3 cụm storage khác nhau'
        });
    }

    // K8S Worker - calculated
    const workerMatch = html.match(/K8S Worker[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>[\s\S]*?<strong>(\d+)<\/strong>/i);
    if (workerMatch) {
        const listContent = workerMatch[1];
        const cpuCint = listContent.match(/CPU[:\s]*=?\s*(\d+)\s*Cint/i);
        const ram = listContent.match(/RAM[:\s]*=?\s*(\d+)\s*GB/i);
        const disk = listContent.match(/DISK[:\s]*=?\s*(\d+)\s*GB/i);
        let cauHinh = '';
        if (cpuCint) cauHinh += `- CPU = ${cpuCint[1]} Cint\n`;
        if (ram) cauHinh += `- RAM = ${ram[1]}GB\n`;
        if (disk) cauHinh += `- Disk = ${disk[1]}GB`;
        results.push({
            module: 'K8S Worker',
            cauHinh: cauHinh.replace(/\n/g, '<br>'),
            soLuong: workerMatch[2],
            ghiChu: 'Dự phòng N+1'
        });
    }

    // K8S ETCD - fixed config
    const etcdMatch = html.match(/K8S ETCD[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>[\s\S]*?<strong>(\d+)<\/strong>/i);
    if (etcdMatch) {
        const listContent = etcdMatch[1];
        const vcpu = listContent.match(/(\d+)\s*vCPU/i);
        const ram = listContent.match(/(\d+)\s*GB/i);
        const disk = listContent.match(/DISK[:\s]*(\d+)\s*GB/i);
        let cauHinh = '';
        if (vcpu) cauHinh += `- vCPU = ${vcpu[1]}\n`;
        if (ram) cauHinh += `- RAM = ${ram[1]}GB\n`;
        if (disk) cauHinh += `- Disk = ${disk[1]}GB`;
        results.push({
            module: 'K8S ETCD',
            cauHinh: cauHinh.replace(/\n/g, '<br>'),
            soLuong: etcdMatch[2],
            ghiChu: 'Storage ETCD phải nằm ở 3 cụm storage khác nhau'
        });
    }

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
        <td><input type="number" class="input-full sizing-user-input mariadb-cpu-load" value="${data.cpuLoad || ''}" placeholder="%" min="0" max="100"></td>
        <td><input type="number" class="input-full sizing-user-input mariadb-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" max="100"></td>
        <td class="text-center">
            <input type="radio" name="${masterGroupName}" class="mariadb-master-radio" onchange="enforceMariaDBMasterWithinTable(this)" ${data.isMaster ? 'checked' : ''}>
        </td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="mariadb-ref-evidence-input" onchange="handleInlineEvidenceUpload(this)" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh">
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
            <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('tr').remove()">
                <i class="fa-solid fa-times"></i>
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
    // Collect multiple evidence images
    const evidenceImages = [];
    const grid = document.getElementById('mariadb-storage-evidence-grid');
    if (grid) {
        grid.querySelectorAll('.mariadb-storage-evidence-slot').forEach(slot => {
            const img = slot.querySelector('img');
            if (img && img.src) {
                evidenceImages.push(img.src);
            }
        });
    }
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
    
    let html = '';
    
    // ==================== CÔNG THỨC TÍNH ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Công thức tính toán (dựa trên IP Master: ${masterData.ip})</h4>
        <p style="margin: 0 0 10px; font-size: 13px; color: #333;"><strong>Mô hình:</strong> ${modelLabel}</p>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>CPU cần</strong> = CPU × Tải CPU × (Định cỡ / Đầu vào) × 1.1 / 0.75${isActiveActive ? ' / 3 (chia cho 3 master)' : ''} = ${masterData.cpu} × ${(masterData.cpuLoad/100).toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.75${isActiveActive ? ' / 3' : ''} = <strong>${cpuNeeded.toFixed(2)} vCPU</strong></li>
            <li><strong>RAM cần</strong> = RAM × Tải RAM × (Định cỡ / Đầu vào) × 1.1 / 0.9${isActiveActive ? ' / 3 (chia cho 3 master)' : ''} = ${masterData.ram} × ${(masterData.ramLoad/100).toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9${isActiveActive ? ' / 3' : ''} = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/data cần</strong> = /data used × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.dataUsed} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${dataNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/log cần</strong> = /log used × (Định cỡ / Đầu vào) × 1.1 / 0.8 = ${storage.logUsed} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${logNeeded.toFixed(2)} GB</strong></li>
            <li><strong>/backup cần</strong> = /data cần × Số bản lưu backup × Tỉ lệ nén (%) = ${dataNeeded.toFixed(2)} × ${storage.soBanBackup} × ${storage.tiLeNen}% = <strong>${backupNeeded.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // ==================== BẢNG KẾT QUẢ ====================
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 120px;">Thành phần</th>
                <th style="width: 250px;">Cấu hình đề xuất</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #f0f9ff;">
                <td><strong>MaxScale</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
                        <li>4 vCPU</li>
                        <li>8 GB RAM</li>
                        <li>/u01: 100 GB</li>
                    </ul>
                </td>
                <td class="text-center"><strong>2</strong></td>
                <td>Cấu hình tối thiểu<br>+1 VIP</td>
            </tr>
            <tr style="background: #e6ffed;">
                <td><strong>MariaDB</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
                        <li><strong>${Math.ceil(cpuNeeded)} vCPU</strong></li>
                        <li><strong>${Math.ceil(ramNeeded)} GB RAM</strong></li>
                        <li>/data: ${Math.ceil(dataNeeded)} GB</li>
                        <li>/log: ${Math.ceil(logNeeded)} GB</li>
                    </ul>
                </td>
                <td class="text-center"><strong>3</strong></td>
                <td>${isActiveActive ? 'Multi-Master' : 'Asynchronous'}</td>
            </tr>
            <tr style="background: #fff9e6;">
                <td><strong>NAS</strong></td>
                <td class="text-center"><strong>${Math.ceil(nasTotal)} GB</strong></td>
                <td class="text-center">-</td>
                <td>Mount chung</td>
            </tr>
        </tbody>
    </table>`;
    
    const container = document.getElementById('mariadb-result-container');
    if (container) container.innerHTML = html;
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
        if (container) container.innerHTML = data.resultHTML;
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
            <input type="file" accept="image/*" onchange="handleMariaDBRefEvidenceUpload(this)" style="display:none;">
            <div class="preview-area">
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                    <img src="${img.dataUrl}" alt="Evidence" style="display:none;">
                    <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBRefEvidenceSlot(this)" title="Xóa ảnh">
                        ✖
                    </button>
                </div>
            </div>
            <div class="upload-placeholder" style="display: none;">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Click để upload</span>
            </div>
        `;
        grid.appendChild(slot);
    });
}

// Thu thập dữ liệu MariaDB để lưu (user data only)
function collectMariaDBData() {
    return {
        refTable: collectMariaDBRefTableData(),
        storage: collectMariaDBStorageData(),
        note: document.getElementById('mariadb-note')?.value || '',
        replicationModel: document.getElementById('mariadb-replication-model')?.value || 'asynchronous',
        selectedInputRow: document.getElementById('mariadb-input-row-select')?.value || '',
        inputCCU: document.getElementById('mariadb-input-ccu')?.value || '',
        sizingCCU: document.getElementById('mariadb-sizing-ccu')?.value || '',
        resultHTML: document.getElementById('mariadb-result-container')?.innerHTML || ''
    };
}

// Thêm slot ảnh sở cứ cho MariaDB
function addMariaDBEvidenceSlot() {
    const grid = document.getElementById('mariadb-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleMariaDBEvidenceUpload(this)" style="display:none;">
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
    reader.onload = function(e) {
        previewArea.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                <img src="${e.target.result}" alt="Evidence" style="display:none;">
                <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBEvidenceSlot(this)" title="Xóa ảnh">
                    ✖
                </button>
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
    const grid = document.getElementById('mariadb-storage-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'mariadb-storage-evidence-slot';
    slot.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f0f9ff; border-radius: 4px; border: 1px solid #d0e0f0;';
    slot.innerHTML = `
        <input type="file" accept="image/*" onchange="handleMariaDBStorageEvidenceUpload(this)" style="display:none">
        <span class="storage-evidence-preview" style="font-size: 11px; color: #666;">Chưa có ảnh</span>
        <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh" style="font-size: 10px; padding: 1px 5px;">
            <i class="fa-solid fa-cloud-arrow-up"></i>
        </button>
    `;
    grid.appendChild(slot);
    // Trigger file picker immediately
    slot.querySelector('input[type=file]').click();
}

// Xử lý upload ảnh cho Storage MariaDB
function handleMariaDBStorageEvidenceUpload(input) {
    const slot = input.closest('.mariadb-storage-evidence-slot');
    const previewSpan = slot.querySelector('.storage-evidence-preview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewSpan.innerHTML = `
                <img src="${e.target.result}" alt="Evidence" style="display:none;">
                <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" style="font-size: 10px; padding: 1px 4px;">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="btn-remove-evidence sizing-user-btn" onclick="removeMariaDBStorageEvidenceSlot(this)" title="Xóa ảnh" style="font-size: 10px; padding: 1px 4px;">
                    ✖
                </button>
            `;
            // Hide the upload button
            const uploadBtn = slot.querySelector('.btn-inline-evidence');
            if (uploadBtn) uploadBtn.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Xóa slot ảnh sở cứ Storage MariaDB
function removeMariaDBStorageEvidenceSlot(btn) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        const slot = btn.closest('.mariadb-storage-evidence-slot');
        if (slot) slot.remove();
    }
}

// Load ảnh sở cứ Storage MariaDB (nhiều ảnh)
function loadMariaDBStorageEvidence(images) {
    const grid = document.getElementById('mariadb-storage-evidence-grid');
    if (!grid || !images || !Array.isArray(images)) return;
    
    grid.innerHTML = '';
    images.forEach(imgSrc => {
        const slot = document.createElement('div');
        slot.className = 'mariadb-storage-evidence-slot';
        slot.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f0f9ff; border-radius: 4px; border: 1px solid #d0e0f0;';
        slot.innerHTML = `
            <input type="file" accept="image/*" onchange="handleMariaDBStorageEvidenceUpload(this)" style="display:none">
            <span class="storage-evidence-preview">
                <img src="${imgSrc}" alt="Evidence" style="display:none;">
                <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh" style="font-size: 10px; padding: 1px 4px;">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="btn-remove-evidence sizing-user-btn" onclick="removeMariaDBStorageEvidenceSlot(this)" title="Xóa ảnh" style="font-size: 10px; padding: 1px 4px;">
                    ✖
                </button>
            </span>
        `;
        grid.appendChild(slot);
    });
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
        <input type="file" accept="image/*" onchange="handleMariaDBRefEvidenceUpload(this)" style="display:none;">
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
    reader.onload = function(e) {
        previewArea.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px;">
                <img src="${e.target.result}" alt="Evidence" style="display:none;">
                <button type="button" class="btn-view-evidence" onclick="openModal(this.parentElement.querySelector('img').src)" title="Xem ảnh">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="btn-remove-evidence" onclick="deleteMariaDBRefEvidenceSlot(this)" title="Xóa ảnh">
                    ✖
                </button>
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
        keyBtn.style.border = '2px solid #0066cc';
        keyBtn.style.background = '#e6f3ff';
        configBtn.classList.remove('active');
        configBtn.style.border = '2px solid #ccc';
        configBtn.style.background = '#f8f9fa';
        keyContent.style.display = 'block';
        configContent.style.display = 'none';
    } else {
        configBtn.classList.add('active');
        configBtn.style.border = '2px solid #0066cc';
        configBtn.style.background = '#e6f3ff';
        keyBtn.classList.remove('active');
        keyBtn.style.border = '2px solid #ccc';
        keyBtn.style.background = '#f8f9fa';
        configContent.style.display = 'block';
        keyContent.style.display = 'none';
    }
}

// Thêm slot ảnh sở cứ cho phương pháp Key
function addRedisKeyEvidenceSlot() {
    const grid = document.getElementById('redis-key-evidence-grid');
    if (!grid) return;
    
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <div class="preview-area"></div>
        <input type="file" accept="image/*" onchange="handleRedisKeyImageUpload(this)" style="display:none;">
        <button type="button" class="btn-upload sizing-user-btn" onclick="this.previousElementSibling.click()">
            <i class="fa-solid fa-upload"></i> Chọn ảnh
        </button>
        <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('.upload-box').remove()" style="margin-left: 5px;">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh
function handleRedisKeyImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewArea = input.closest('.upload-box').querySelector('.preview-area');
        previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
    };
    reader.readAsDataURL(file);
}

// Thêm dòng vào bảng cấu hình Redis
function addRedisConfigRow(data = {}) {
    const tbody = document.getElementById('redis-config-table-body');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-full sizing-user-input redis-config-ip" value="${data.ip || ''}" placeholder="192.168.x.x"></td>
        <td><input type="number" class="input-full sizing-user-input redis-config-ram" value="${data.ram || ''}" placeholder="RAM (GB)" min="0" onchange="updateRedisTotalMasterRAM()"></td>
        <td><input type="number" class="input-full sizing-user-input redis-config-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" max="100" onchange="updateRedisTotalMasterRAM()"></td>
        <td class="text-center">
            <input type="checkbox" class="redis-master-checkbox" ${data.isMaster ? 'checked' : ''} onchange="updateRedisTotalMasterRAM()">
        </td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="redis-config-evidence-input" onchange="handleInlineEvidenceUpload(this)" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh">
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
            <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('tr').remove(); updateRedisTotalMasterRAM();">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    
    // Apply role permissions for new row
    applyRolePermissions();
}

// Cập nhật tổng RAM của các Master
function updateRedisTotalMasterRAM() {
    const rows = document.querySelectorAll('#redis-config-table-body tr');
    let totalMasterRAM = 0;
    
    rows.forEach(row => {
        const isMaster = row.querySelector('.redis-master-checkbox')?.checked;
        if (isMaster) {
            const ram = parseFloat(row.querySelector('.redis-config-ram')?.value) || 0;
            const ramLoad = parseFloat(row.querySelector('.redis-config-ram-load')?.value) || 0;
            totalMasterRAM += ram * (ramLoad / 100);
        }
    });
    
    const totalEl = document.getElementById('redis-total-master-ram');
    if (totalEl) totalEl.innerText = totalMasterRAM.toFixed(2);
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
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Tải hệ thống POC:</strong> ${poc.toLocaleString()}</li>
            <li><strong>Định cỡ:</strong> ${sizing.toLocaleString()}</li>
            <li><strong>Tỷ lệ:</strong> ${sizing} / ${poc} = ${(sizing / poc).toFixed(2)}</li>
            <li><strong>Tổng số Key POC:</strong> ${keyCountPOC.toLocaleString()}</li>
            <li><strong>Tổng số Key sau định cỡ (A):</strong> ${keyCountPOC.toLocaleString()} × ${(sizing / poc).toFixed(2)} = <strong>${keyCount.toLocaleString()}</strong></li>
            <li><strong>Kích thước trung bình 1 bản ghi (B):</strong> ${recordSize} bytes</li>
            <li><strong>Tổng dung lượng Key Redis (C):</strong> ${keyCount.toLocaleString()} × ${recordSize} = <strong>${C.toFixed(4)} GB</strong></li>
            <li><strong>Mức độ quan trọng:</strong> ${importance === 'dbqt' ? 'DBQT' : 'Bình thường'}</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;"><i class="fa-solid fa-lightbulb"></i> Đề xuất mô hình</h4>
        <p style="margin: 0; font-size: 15px;">
            <strong>${model}</strong> - ${masterCount} master ${slavePerMaster} slave
            ${C >= 32 ? `<br><em>(C = ${C.toFixed(2)} GB > 32 GB → Sử dụng Cluster với N = ${masterCount} master)</em>` : `<br><em>(C = ${C.toFixed(2)} GB < 32 GB → Sử dụng Sentinel)</em>`}
        </p>
    </div>`;
    
    html += `<div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #856404;">Công thức tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>RAM mỗi server:</strong> RAM1svr = C × 1.1 / 0.8${masterCount > 1 ? ' / N' : ''} = ${C.toFixed(2)} × 1.1 / 0.8${masterCount > 1 ? ` / ${masterCount}` : ''} = <strong>${ramPerServer.toFixed(2)} GB</strong></li>
            <li><strong>vCPU mỗi server:</strong> ${vcpu} vCPU (mặc định cho ${model})</li>
            <li><strong>DISK mỗi server:</strong> 4 × RAM = 4 × ${ramPerServer.toFixed(2)} = <strong>${diskPerServer.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // Bảng kết quả
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 200px;">Cấu hình đề xuất</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Redis ${model === 'Redis Sentinel' ? 'Sentinel' : 'Cluster'}</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
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
    
    // Bảng tổng hợp
    const totalVCPU = vcpu * totalServers;
    const totalRAM = Math.ceil(ramPerServer) * totalServers;
    const totalDisk = Math.ceil(diskPerServer) * totalServers;
    
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-table"></i> Bảng tổng hợp tài nguyên
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th>Module</th>
                <th>Số lượng</th>
                <th>vCPU/server</th>
                <th>RAM/server (GB)</th>
                <th>Disk/server (GB)</th>
                <th>Tổng vCPU</th>
                <th>Tổng RAM (GB)</th>
                <th>Tổng Disk (GB)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #f0f9ff;">
                <td><strong>Redis</strong></td>
                <td class="text-center">${totalServers}</td>
                <td class="text-center">${vcpu}</td>
                <td class="text-center">${Math.ceil(ramPerServer)}</td>
                <td class="text-center">${Math.ceil(diskPerServer)}</td>
                <td class="text-center"><strong>${totalVCPU}</strong></td>
                <td class="text-center"><strong>${totalRAM}</strong></td>
                <td class="text-center"><strong>${totalDisk}</strong></td>
            </tr>
        </tbody>
    </table>`;
    
    const container = document.getElementById('redis-key-result-container');
    if (container) container.innerHTML = html;
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
    const totalMasterRAM = parseFloat(document.getElementById('redis-total-master-ram')?.innerText) || 0;
    
    if (totalMasterRAM <= 0) {
        showToast('Vui lòng nhập thông tin và tick chọn ít nhất một Master trong bảng cấu hình!', 'warning');
        return;
    }
    
    // Hệ số
    const factor = sizingCCU / inputCCU;
    
    // RAM cần = RAM * Tải RAM * (Định cỡ / Đầu vào) * 1.1 / 0.9
    const ramNeeded = totalMasterRAM * factor * 1.1 / 0.9;
    
    // Sau đó áp dụng công thức tương tự phương pháp Key
    const C = ramNeeded;
    
    let html = '';
    let model = '';
    let vcpu = 0;
    let ramPerServer = 0;
    let diskPerServer = 0;
    let masterCount = 1;
    let slavePerMaster = importance === 'dbqt' ? 2 : 1;
    let totalServers = 0;
    
    if (C < 32) {
        // Redis Sentinel
        model = 'Redis Sentinel';
        vcpu = 8;
        ramPerServer = C * 1.1 / 0.8;
        diskPerServer = 4 * ramPerServer;
        masterCount = 1;
        slavePerMaster = 2;
        totalServers = 1 + 2;
    } else {
        // Redis Cluster
        model = 'Redis Cluster';
        vcpu = 16;
        
        const N = findOptimalN(C);
        masterCount = N;
        ramPerServer = (C * 1.1 / 0.8) / N;
        diskPerServer = 4 * ramPerServer;
        totalServers = N * (1 + slavePerMaster);
    }
    
    // ==================== HIỂN THỊ KẾT QUẢ ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Mô hình hiện tại:</strong> ${currentModel === 'cluster' ? 'Redis Cluster' : 'Redis Sentinel'}</li>
            <li><strong>Tổng RAM Master hiện tại (đã nhân tải):</strong> ${totalMasterRAM.toFixed(2)} GB</li>
            <li><strong>Hệ số (Định cỡ/Đầu vào):</strong> ${sizingCCU} / ${inputCCU} = ${factor.toFixed(2)}</li>
            <li><strong>RAM cần cho hệ thống mới:</strong> ${totalMasterRAM.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9 = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>Mức độ quan trọng:</strong> ${importance === 'dbqt' ? 'DBQT' : 'Bình thường'}</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;"><i class="fa-solid fa-lightbulb"></i> Đề xuất mô hình</h4>
        <p style="margin: 0; font-size: 15px;">
            <strong>${model}</strong> - ${masterCount} master ${slavePerMaster} slave
            ${C >= 32 ? `<br><em>(RAM = ${C.toFixed(2)} GB > 32 GB → Sử dụng Cluster với N = ${masterCount} master)</em>` : `<br><em>(RAM = ${C.toFixed(2)} GB < 32 GB → Sử dụng Sentinel)</em>`}
        </p>
    </div>`;
    
    html += `<div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #856404;">Công thức tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>RAM mỗi server:</strong> RAM1svr = C × 1.1 / 0.8${masterCount > 1 ? ' / N' : ''} = ${C.toFixed(2)} × 1.1 / 0.8${masterCount > 1 ? ` / ${masterCount}` : ''} = <strong>${ramPerServer.toFixed(2)} GB</strong></li>
            <li><strong>vCPU mỗi server:</strong> ${vcpu} vCPU (mặc định cho ${model})</li>
            <li><strong>DISK mỗi server:</strong> 4 × RAM = 4 × ${ramPerServer.toFixed(2)} = <strong>${diskPerServer.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // Bảng kết quả
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 200px;">Cấu hình đề xuất</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Redis ${model === 'Redis Sentinel' ? 'Sentinel' : 'Cluster'}</strong></td>
                <td>
                    <ul style="margin: 0; padding-left: 15px; line-height: 1.6;">
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
    
    // Bảng tổng hợp
    const totalVCPU = vcpu * totalServers;
    const totalRAM = Math.ceil(ramPerServer) * totalServers;
    const totalDisk = Math.ceil(diskPerServer) * totalServers;
    
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-table"></i> Bảng tổng hợp tài nguyên
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th>Module</th>
                <th>Số lượng</th>
                <th>vCPU/server</th>
                <th>RAM/server (GB)</th>
                <th>Disk/server (GB)</th>
                <th>Tổng vCPU</th>
                <th>Tổng RAM (GB)</th>
                <th>Tổng Disk (GB)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #f0f9ff;">
                <td><strong>Redis</strong></td>
                <td class="text-center">${totalServers}</td>
                <td class="text-center">${vcpu}</td>
                <td class="text-center">${Math.ceil(ramPerServer)}</td>
                <td class="text-center">${Math.ceil(diskPerServer)}</td>
                <td class="text-center"><strong>${totalVCPU}</strong></td>
                <td class="text-center"><strong>${totalRAM}</strong></td>
                <td class="text-center"><strong>${totalDisk}</strong></td>
            </tr>
        </tbody>
    </table>`;
    
    const container = document.getElementById('redis-config-result-container');
    if (container) container.innerHTML = html;
}

// Thu thập dữ liệu Redis để lưu
function collectRedisData() {
    // Xác định phương pháp đang chọn
    const keyBtn = document.getElementById('redis-method-key');
    const selectedMethod = keyBtn?.classList.contains('active') ? 'key' : 'config';
    
    return {
        selectedMethod: selectedMethod,
        // Phương pháp Key
        keyMethod: {
            selectedInputRow: document.getElementById('redis-key-input-row-select')?.value || '',
            pocValue: document.getElementById('redis-key-poc')?.value || '',
            sizingValue: document.getElementById('redis-key-sizing')?.value || '',
            keyCountPoc: document.getElementById('redis-key-count-poc')?.value || '',
            keyCount: document.getElementById('redis-key-count')?.value || '',
            recordSize: document.getElementById('redis-record-size')?.value || '',
            importance: document.getElementById('redis-key-importance')?.value || 'normal',
            evidenceImages: collectRedisKeyEvidenceData(),
            resultHTML: document.getElementById('redis-key-result-container')?.innerHTML || ''
        },
        // Phương pháp Config
        configMethod: {
            currentModel: document.getElementById('redis-current-model')?.value || 'cluster',
            configTable: collectRedisConfigTableData(),
            selectedInputRow: document.getElementById('redis-config-input-row-select')?.value || '',
            inputCCU: document.getElementById('redis-config-input-ccu')?.value || '',
            sizingCCU: document.getElementById('redis-config-sizing-ccu')?.value || '',
            importance: document.getElementById('redis-config-importance')?.value || 'normal',
            resultHTML: document.getElementById('redis-config-result-container')?.innerHTML || ''
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
                    addRedisKeyEvidenceSlot();
                    const lastSlot = grid.lastElementChild;
                    if (lastSlot && img.dataUrl) {
                        const previewArea = lastSlot.querySelector('.preview-area');
                        if (previewArea) {
                            previewArea.innerHTML = `<img src="${img.dataUrl}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
                        }
                    }
                });
            }
        }
        
        // Load kết quả
        if (km.resultHTML) {
            const container = document.getElementById('redis-key-result-container');
            if (container) container.innerHTML = km.resultHTML;
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
        
        // Load kết quả
        if (cm.resultHTML) {
            const container = document.getElementById('redis-config-result-container');
            if (container) container.innerHTML = cm.resultHTML;
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
        throughputBtn.style.border = '2px solid #0066cc';
        throughputBtn.style.background = '#e6f3ff';
        linearBtn.classList.remove('active');
        linearBtn.style.border = '2px solid #ccc';
        linearBtn.style.background = '#f8f9fa';
        throughputContent.style.display = 'block';
        linearContent.style.display = 'none';
    } else {
        linearBtn.classList.add('active');
        linearBtn.style.border = '2px solid #0066cc';
        linearBtn.style.background = '#e6f3ff';
        throughputBtn.classList.remove('active');
        throughputBtn.style.border = '2px solid #ccc';
        throughputBtn.style.background = '#f8f9fa';
        linearContent.style.display = 'block';
        throughputContent.style.display = 'none';
    }
}

// Thêm ảnh sở cứ cho Throughput
function addKafkaThroughputEvidenceSlot() {
    const grid = document.getElementById('kafka-throughput-evidence-grid');
    if (!grid) return;
    addImageUploadSlot(grid, 'handleKafkaImageUpload');
}

// Thêm ảnh sở cứ cho Compression
function addKafkaCompressionEvidenceSlot() {
    const grid = document.getElementById('kafka-compression-evidence-grid');
    if (!grid) return;
    addImageUploadSlot(grid, 'handleKafkaImageUpload');
}

// Helper function để thêm image upload slot
function addImageUploadSlot(grid, handlerName) {
    const slot = document.createElement('div');
    slot.className = 'upload-box';
    slot.innerHTML = `
        <div class="preview-area"></div>
        <input type="file" accept="image/*" onchange="${handlerName}(this)" style="display:none;">
        <button type="button" class="btn-upload sizing-user-btn" onclick="this.previousElementSibling.click()">
            <i class="fa-solid fa-upload"></i> Chọn ảnh
        </button>
        <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('.upload-box').remove()" style="margin-left: 5px;">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    grid.appendChild(slot);
}

// Xử lý upload ảnh Kafka
function handleKafkaImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewArea = input.closest('.upload-box').querySelector('.preview-area');
        previewArea.innerHTML = `<img src="${e.target.result}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
    };
    reader.readAsDataURL(file);
}

// Mở Helper Tool popup
function openKafkaHelperTool() {
    document.getElementById('kafka-helper-modal').style.display = 'flex';
}

// Đóng Helper Tool popup
function closeKafkaHelperTool() {
    document.getElementById('kafka-helper-modal').style.display = 'none';
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
    document.getElementById('kafka-helper-result').innerText = A.toFixed(4);
}

// Áp dụng kết quả từ Helper Tool
function applyKafkaHelperResult() {
    const result = parseFloat(document.getElementById('kafka-helper-result')?.innerText) || 0;
    if (result <= 0) {
        showToast('Vui lòng tính toán trước khi áp dụng!', 'warning');
        return;
    }
    
    document.getElementById('kafka-throughput-a').value = result.toFixed(4);
    closeKafkaHelperTool();
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
        <td><input type="number" class="input-full sizing-user-input kafka-linear-cpu-load" value="${data.cpuLoad || ''}" placeholder="%" min="0" max="100" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-ram-load" value="${data.ramLoad || ''}" placeholder="%" min="0" max="100" onchange="updateKafkaLinearTotal()"></td>
        <td><input type="number" class="input-full sizing-user-input kafka-linear-disk-load" value="${data.diskLoad || ''}" placeholder="%" min="0" max="100" onchange="updateKafkaLinearTotal()"></td>
        <td>
            <div class="inline-evidence-cell">
                <input type="file" accept="image/*" multiple class="kafka-linear-evidence-input" onchange="handleInlineEvidenceUpload(this)" style="display:none">
                <button type="button" class="btn-inline-evidence sizing-user-btn" onclick="this.parentElement.querySelector('input[type=file]').click()" title="Upload ảnh">
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
            <button type="button" class="btn-delete sizing-user-btn" onclick="this.closest('tr').remove(); updateKafkaLinearTotal();">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    
    // Apply role permissions for new row
    applyRolePermissions();
}

// Cập nhật tổng cho bảng Linear
function updateKafkaLinearTotal() {
    const rows = document.querySelectorAll('#kafka-linear-table-body tr');
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
    
    document.getElementById('kafka-linear-total-cpu').innerText = totalCPU.toFixed(2);
    document.getElementById('kafka-linear-total-ram').innerText = totalRAM.toFixed(2);
    document.getElementById('kafka-linear-total-disk').innerText = totalDisk.toFixed(2);
}

// Thu thập dữ liệu bảng Linear
function collectKafkaLinearTableData() {
    const rows = document.querySelectorAll('#kafka-linear-table-body tr');
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
    
    let html = '';
    
    // ==================== CÔNG THỨC TÍNH ====================
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin đầu vào</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Lưu lượng vào POC (A₀):</strong> ${A_poc} MB/s</li>
            <li><strong>POC:</strong> ${pocVal} &nbsp;|&nbsp; <strong>Định cỡ:</strong> ${sizingVal}</li>
            <li><strong>Hệ số (Định cỡ/POC):</strong> ${sizingVal} / ${pocVal} = ${ratio.toFixed(4)}</li>
            <li><strong>Lưu lượng định cỡ (A):</strong> A₀ × (Định cỡ/POC) = ${A_poc} × ${ratio.toFixed(4)} = <strong>${A.toFixed(4)} MB/s</strong></li>
            <li><strong>Thời gian lưu trữ (T):</strong> ${T} giờ (${T/24} ngày)</li>
            <li><strong>Hệ số nhân bản (R):</strong> ${R}</li>
            <li><strong>Hệ số nén (C):</strong> ${C}</li>
            <li><strong>S (dữ liệu 30 phút):</strong> A × 1800 / 1024 = ${A.toFixed(4)} × 1800 / 1024 = ${S.toFixed(2)} GB</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;"><i class="fa-solid fa-hard-drive"></i> Tổng Disk Cluster</h4>
        <p style="margin: 0; font-size: 14px;">
            <strong>D = A × 3600 × T × R × C × 1.1 / 0.8</strong><br>
            D = ${A.toFixed(4)} × 3600 × ${T} × ${R} × ${C} × 1.1 / 0.8<br>
            D = <strong>${D_MB.toFixed(2)} MB</strong> = <strong>${D_GB.toFixed(2)} GB</strong> = <strong>${D_TB.toFixed(4)} TB</strong>
        </p>
    </div>`;
    
    // ==================== BẢNG PHÂN BỔ THEO N ====================
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-table"></i> Bảng phân bổ theo số lượng Broker (N)
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 80px;">N (Broker)</th>
                <th>Disk/Server</th>
                <th>RAM/Server</th>
                <th>vCPU/Server</th>
                <th>Ghi chú</th>
            </tr>
        </thead>
        <tbody>`;
    
    for (let n = 3; n <= 7; n++) {
        const diskPerServer = D_GB / n;
        const ramPerServer = (S * R / n) + 8;
        const isOptimal = n === optimalN;
        const ramStatus = ramPerServer >= 16 && ramPerServer <= 64 ? '✓' : '✗';
        const rowStyle = isOptimal ? 'background: #e6ffed; font-weight: 600;' : '';
        
        html += `<tr style="${rowStyle}">
            <td class="text-center">${n}${isOptimal ? ' ★' : ''}</td>
            <td class="text-center">${diskPerServer >= 1024 ? (diskPerServer/1024).toFixed(2) + ' TB' : diskPerServer.toFixed(2) + ' GB'}</td>
            <td class="text-center">${ramPerServer.toFixed(2)} GB ${ramStatus}</td>
            <td class="text-center">${vCPU}</td>
            <td>${isOptimal ? 'Khuyến nghị (16 < RAM < 64)' : (ramPerServer > 64 ? 'RAM quá cao' : (ramPerServer < 16 ? 'RAM thấp' : ''))}</td>
        </tr>`;
    }
    
    html += `</tbody></table>`;
    
    // ==================== KẾT QUẢ ĐỀ XUẤT ====================
    const diskPerServer = D_GB / optimalN;
    const ramPerServer = (S * R / optimalN) + 8;
    
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình (N = ${optimalN})
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 100px;">Số lượng Node</th>
                <th style="width: 100px;">vCPU/Node</th>
                <th style="width: 100px;">RAM/Node</th>
                <th style="width: 150px;">Disk/Node (SSD)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Kafka Broker</strong></td>
                <td class="text-center"><strong>${optimalN}</strong></td>
                <td class="text-center"><strong>${vCPU}</strong></td>
                <td class="text-center"><strong>${Math.ceil(ramPerServer)} GB</strong></td>
                <td class="text-center"><strong>${diskPerServer >= 1024 ? (diskPerServer/1024).toFixed(2) + ' TB' : Math.ceil(diskPerServer) + ' GB'}</strong></td>
            </tr>
            <tr style="background: #fff3cd;">
                <td><strong>Zookeeper/KRaft</strong></td>
                <td class="text-center"><strong>3</strong></td>
                <td class="text-center"><strong>4</strong></td>
                <td class="text-center"><strong>8 GB</strong></td>
                <td class="text-center"><strong>100 GB</strong></td>
            </tr>
        </tbody>
        
    </table>`;
    
    html += `<div style="background: #d4edda; padding: 15px; border-radius: 6px; margin-top: 15px; border-left: 4px solid #28a745;">
        <h4 style="margin: 0 0 10px 0; color: #155724;"><i class="fa-solid fa-info-circle"></i> Khuyến nghị</h4>
        <p style="margin: 0; font-size: 13px; color: #155724;">
            Tách rời 3 node Zookeeper/KRaft Controller (2 vCPU / 4GB RAM / 100GB DISK) để đảm bảo độ ổn định cao nhất.
        </p>
    </div>`;
    
    const container = document.getElementById('kafka-throughput-result-container');
    if (container) container.innerHTML = html;
}

// Tính toán theo phương pháp Linear (Existing System)
function calculateKafkaLinearMethod() {
    const inputCCU = parseFloat(document.getElementById('kafka-linear-input-ccu')?.value) || 0;
    const sizingCCU = parseFloat(document.getElementById('kafka-linear-sizing-ccu')?.value) || 0;
    
    if (!inputCCU || !sizingCCU) {
        showToast('Vui lòng nhập giá trị hợp lệ cho "Đầu vào" và "Định cỡ".', 'warning');
        return;
    }
    
    // Lấy tổng từ bảng
    const totalCPU = parseFloat(document.getElementById('kafka-linear-total-cpu')?.innerText) || 0;
    const totalRAM = parseFloat(document.getElementById('kafka-linear-total-ram')?.innerText) || 0;
    const totalDisk = parseFloat(document.getElementById('kafka-linear-total-disk')?.innerText) || 0;
    
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
    
    let html = '';
    
    html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ee0033;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #2c5282;">Thông tin tính toán</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Tổng CPU sử dụng hiện tại:</strong> ${totalCPU.toFixed(2)} vCPU</li>
            <li><strong>Tổng RAM sử dụng hiện tại:</strong> ${totalRAM.toFixed(2)} GB</li>
            <li><strong>Tổng Disk sử dụng hiện tại:</strong> ${totalDisk.toFixed(2)} GB</li>
            <li><strong>Hệ số (Định cỡ/Đầu vào):</strong> ${sizingCCU} / ${inputCCU} = ${factor.toFixed(2)}</li>
        </ul>
    </div>`;
    
    html += `<div style="background: #e6ffed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #155724;">Tài nguyên cần cho hệ thống mới</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>CPU cần:</strong> ${totalCPU.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.75 = <strong>${cpuNeeded.toFixed(2)} vCPU</strong></li>
            <li><strong>RAM cần:</strong> ${totalRAM.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.9 = <strong>${ramNeeded.toFixed(2)} GB</strong></li>
            <li><strong>Disk cần:</strong> ${totalDisk.toFixed(2)} × ${factor.toFixed(2)} × 1.1 / 0.8 = <strong>${diskNeeded.toFixed(2)} GB</strong></li>
        </ul>
    </div>`;
    
    // Bảng kết quả
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c5282;">
        <i class="fa-solid fa-clipboard-check"></i> Kết quả đề xuất cấu hình (N = ${optimalN})
    </h4>`;
    
    html += `<table class="sizing-table" style="margin-top: 10px;">
        <thead>
            <tr>
                <th style="width: 150px;">Thành phần</th>
                <th style="width: 100px;">Số lượng Node</th>
                <th style="width: 100px;">vCPU/Node</th>
                <th style="width: 100px;">RAM/Node</th>
                <th style="width: 150px;">Disk/Node (SSD)</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background: #e6ffed;">
                <td><strong>Kafka Broker</strong></td>
                <td class="text-center"><strong>${optimalN}</strong></td>
                <td class="text-center"><strong>${cpuPerNode}</strong></td>
                <td class="text-center"><strong>${ramPerNode} GB</strong></td>
                <td class="text-center"><strong>${diskPerNode >= 1024 ? (diskPerNode/1024).toFixed(2) + ' TB' : diskPerNode + ' GB'}</strong></td>
            </tr>
            <tr style="background: #fff3cd;">
                <td><strong>Zookeeper/KRaft</strong></td>
                <td class="text-center"><strong>3</strong></td>
                <td class="text-center"><strong>4</strong></td>
                <td class="text-center"><strong>8 GB</strong></td>
                <td class="text-center"><strong>100 GB</strong></td>
            </tr>
        </tbody>
        <tfoot>
            <tr style="background: #f0f9ff; font-weight: bold;">
                <td>Tổng cộng</td>
                <td class="text-center">${optimalN + 3}</td>
                <td class="text-center">${cpuPerNode * optimalN + 6}</td>
                <td class="text-center">${ramPerNode * optimalN + 12} GB</td>
                <td class="text-center">${(diskPerNode * optimalN + 300) >= 1024 ? ((diskPerNode * optimalN + 300)/1024).toFixed(2) + ' TB' : (diskPerNode * optimalN + 300) + ' GB'}</td>
            </tr>
        </tfoot>
    </table>`;
    
    const container = document.getElementById('kafka-linear-result-container');
    if (container) container.innerHTML = html;
}

// Thu thập dữ liệu Kafka để lưu
function collectKafkaData() {
    const throughputBtn = document.getElementById('kafka-method-throughput');
    const selectedMethod = throughputBtn?.classList.contains('active') ? 'throughput' : 'linear';
    
    return {
        selectedMethod: selectedMethod,
        // Phương pháp Throughput
        throughputMethod: {
            selectedInputRow: document.getElementById('kafka-throughput-input-row-select')?.value || '',
            inputCCU: document.getElementById('kafka-throughput-input-ccu')?.value || '',
            sizingCCU: document.getElementById('kafka-throughput-sizing-ccu')?.value || '',
            throughputA: document.getElementById('kafka-throughput-a')?.value || '',
            retentionTime: document.getElementById('kafka-retention-time')?.value || '168',
            replicationFactor: document.getElementById('kafka-replication-factor')?.value || '3',
            compression: document.getElementById('kafka-compression')?.value || '0.5',
            throughputEvidence: collectKafkaEvidenceData('kafka-throughput-evidence-grid'),
            compressionEvidence: collectKafkaEvidenceData('kafka-compression-evidence-grid'),
            resultHTML: document.getElementById('kafka-throughput-result-container')?.innerHTML || '',
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
            inputCCU: document.getElementById('kafka-linear-input-ccu')?.value || '',
            sizingCCU: document.getElementById('kafka-linear-sizing-ccu')?.value || '',
            resultHTML: document.getElementById('kafka-linear-result-container')?.innerHTML || ''
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
            if (container) container.innerHTML = tm.resultHTML;
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
            document.getElementById('kafka-linear-table-body').innerHTML = '';
            lm.linearTable.forEach(row => {
                addKafkaLinearRow(row);
                // Restore evidence image(s) if available
                const kafkaLinearEvidenceImages = getEvidenceImagesFromRowData(row);
                if (kafkaLinearEvidenceImages.length > 0) {
                    const rows = document.querySelectorAll('#kafka-linear-table-body tr');
                    const lastRow = rows[rows.length - 1];
                    const evidenceCell = lastRow?.querySelector('.inline-evidence-cell');
                    if (evidenceCell) {
                        loadInlineEvidence(evidenceCell, kafkaLinearEvidenceImages);
                    }
                }
            });
            updateKafkaLinearTotal();
        }
        
        // Load kết quả
        if (lm.resultHTML) {
            const container = document.getElementById('kafka-linear-result-container');
            if (container) container.innerHTML = lm.resultHTML;
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
        addSlotFn();
        const lastSlot = grid.lastElementChild;
        if (lastSlot && img.dataUrl) {
            const previewArea = lastSlot.querySelector('.preview-area');
            if (previewArea) {
                previewArea.innerHTML = `<img src="${img.dataUrl}" alt="Evidence" style="display:none;"><button type="button" class="btn-view-evidence" onclick="openModal(this.previousElementSibling.src)" title="Xem ảnh"><i class="fa-solid fa-eye"></i></button>`;
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
                            <button class="btn-preview-version" onclick="event.stopPropagation(); previewVersion('${rev.id}')">
                                <i class="fa-solid fa-eye"></i> Xem trước
                            </button>
                            ${!isFirst ? `
                                <button class="btn-restore-mini" onclick="event.stopPropagation(); restoreVersion('${rev.id}')">
                                    <i class="fa-solid fa-rotate-left"></i> Khôi phục
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
        } else {
            listContainer.innerHTML = '<p style="color: red; text-align: center;">Lỗi khi tải lịch sử phiên bản</p>';
        }
    } catch (error) {
        Logger.error('Lỗi load version history:', error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        listContainer.innerHTML = '<p style="color: red; text-align: center;">Lỗi kết nối server</p>';
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
            } catch(e) {
                Logger.warn('Không thể load phiên bản trước:', e);
            }
        }
        
        // Show meta info
        if (metaInfo) {
            const hasPrevious = previousPreviewSnapshot !== null;
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
                <div class="vp-meta-item" style="margin-left: auto;">
                    <i class="fa-solid fa-code-compare" style="color: ${hasPrevious ? '#10b981' : '#999'};"></i>
                    <span style="color: ${hasPrevious ? '#10b981' : '#999'};">
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
    
    switch(tabName) {
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
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = {};
    if (prevSnapshot && prevSnapshot.yeuCauBaiToanContent) {
        try {
            prevData = typeof prevSnapshot.yeuCauBaiToanContent === 'string' 
                ? JSON.parse(prevSnapshot.yeuCauBaiToanContent) 
                : prevSnapshot.yeuCauBaiToanContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review
    let adminReview = {};
    if (snapshot.yeuCauAdminReview) {
        try {
            adminReview = typeof snapshot.yeuCauAdminReview === 'string' 
                ? JSON.parse(snapshot.yeuCauAdminReview) 
                : snapshot.yeuCauAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.yeuCauAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.yeuCauAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.yeuCauAdminReview) 
                : prevSnapshot.yeuCauAdminReview;
        } catch(e) { /* ignore */ }
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
                <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 500; background: #f8fafc; width: 180px;">${field.label}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${valueHtml || '-'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; width: 80px;">${evalHtml}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; width: 200px; color: #6366f1; font-style: italic;">${noteHtml}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Yêu cầu bài toán 
                <span class="diff-count">(${changedFields.length} thay đổi)</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Tiêu chí</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Nội dung</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; width: 80px;">Đánh giá</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; width: 200px;">Ghi chú Admin</th>
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
        if (val === 'OK') return '<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">OK</span>';
        if (val === 'NOK') return '<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">NOK</span>';
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
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data = { inputRows: [] };
    if (content) {
        try {
            data = typeof content === 'string' ? JSON.parse(content) : content;
        } catch(e) {
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
        } catch(e) { /* ignore */ }
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
        } catch(e) { /* ignore */ }
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
        } catch(e) { /* ignore */ }
    }
    
    // Nếu không có inputRows nhưng có admin review thay đổi, vẫn hiển thị
    const hasAdminReviewChange = JSON.stringify(adminReviewRows) !== JSON.stringify(prevAdminReviewRows) ||
                                  JSON.stringify(adminReview) !== JSON.stringify(prevAdminReview);
    
    Logger.debug('DEBUG hasAdminReviewChange:', hasAdminReviewChange);
    Logger.debug('DEBUG adminReviewRows:', adminReviewRows);
    Logger.debug('DEBUG prevAdminReviewRows:', prevAdminReviewRows);
    Logger.debug('DEBUG data.inputRows length:', data.inputRows?.length);
    
    if ((!data.inputRows || data.inputRows.length === 0) && !hasAdminReviewChange) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu đầu vào</p>';
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
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(row.dauVao, prevRow.dauVao)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(pocText, prevPocText)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(sizingText, prevSizingText)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(row.module, prevRow.module)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                        ${renderTextDiff(row.ghiChu, prevRow.ghiChu)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
                        ${renderEvalDiff(adminData.eval, prevAdminData.eval)}
                    </td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; color: #6366f1; font-style: italic;">
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
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${i + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.dauVao || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevPocText || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevSizingText || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.module || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">-</td>
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
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Thông tin đầu vào 
                <span class="diff-count">(${changeCount} dòng thay đổi)</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0; width: 50px;">STT</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Đầu vào</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Tải POC</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Định cỡ</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Module</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Ghi chú</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; width: 80px; background: #fef3c7;">Đánh giá</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; width: 150px; background: #fef3c7;">Ghi chú Admin</th>
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
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = {};
    if (prevSnapshot && prevSnapshot.moHinhHeThongContent) {
        try {
            prevData = typeof prevSnapshot.moHinhHeThongContent === 'string' 
                ? JSON.parse(prevSnapshot.moHinhHeThongContent) 
                : prevSnapshot.moHinhHeThongContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review
    let moHinhAdmin = {};
    if (snapshot.moHinhAdminReview) {
        try {
            moHinhAdmin = typeof snapshot.moHinhAdminReview === 'string' 
                ? JSON.parse(snapshot.moHinhAdminReview) 
                : snapshot.moHinhAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let prevMoHinhAdmin = {};
    if (prevSnapshot && prevSnapshot.moHinhAdminReview) {
        try {
            prevMoHinhAdmin = typeof prevSnapshot.moHinhAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.moHinhAdminReview) 
                : prevSnapshot.moHinhAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let html = '';
    
    // Helper: render image gallery
    const renderImageGallery = (title, images, adminData) => {
        if (!images || images.length === 0) return '';
        const thumbs = images.map((img, i) => {
            const src = img.base64 || img.dataUrl || img;
            return `<img src="${src}" alt="${title}-${i}" onclick="openModal(this.src)" style="cursor:zoom-in; max-width:180px; max-height:120px; border-radius:6px; border:1px solid #e2e8f0; margin:4px;">`;
        }).join('');
        const evalHtml = adminData && adminData.eval ? renderEvalDiff(adminData.eval, null) : '';
        const noteHtml = adminData && adminData.note ? `<span style="color:#6366f1; font-style:italic; margin-left:8px;">${adminData.note}</span>` : '';
        return `
            <div class="diff-item" style="margin-bottom:16px;">
                <strong>${title}</strong> (${images.length} ảnh) ${evalHtml} ${noteHtml}
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${thumbs}</div>
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
        html += `<div class="diff-item"><strong>Mô tả luồng nghiệp vụ:</strong><br>${flowExpl !== prevFlowExpl && prevSnapshot ? renderTextDiff(flowExpl, prevFlowExpl) : `<div style="margin-top:4px; white-space:pre-wrap;">${flowExpl}</div>`}</div>`;
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
                    <td style="padding:8px; border:1px solid #e2e8f0; text-align:center;">${i + 1}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.moduleName, prevRow.moduleName) : (row.moduleName || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.loaiModule, prevRow.loaiModule) : (row.loaiModule || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.zoneMang, prevRow.zoneMang) : (row.zoneMang || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.heDieuHanh, prevRow.heDieuHanh) : (row.heDieuHanh || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0;">${prevSnapshot && !isNew ? renderTextDiff(row.soLuongVIP, prevRow.soLuongVIP) : (row.soLuongVIP || '-')}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(adminRow.eval, prevSnapshot ? (prevAdminRow.eval || '') : null)}</td>
                    <td style="padding:8px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${prevSnapshot ? renderTextDiff(adminRow.note, prevAdminRow.note) : (adminRow.note || '-')}</td>
                </tr>
            `;
        });
        
        html += `
            <div class="diff-item" style="margin-top:16px;">
                <strong>Chi tiết thành phần kiến trúc</strong>
                <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:8px;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:8px; border:1px solid #e2e8f0; width:40px;">STT</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Module</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Loại module</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Zone mạng</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">Hệ ĐH</th>
                            <th style="padding:8px; border:1px solid #e2e8f0;">SL/VIP</th>
                            <th style="padding:8px; border:1px solid #e2e8f0; width:70px; background:#fef3c7;">Đánh giá</th>
                            <th style="padding:8px; border:1px solid #e2e8f0; width:140px; background:#fef3c7;">Ghi chú Admin</th>
                        </tr>
                    </thead>
                    <tbody>${archRowsHtml}</tbody>
                </table>
            </div>
        `;
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
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-sitemap" style="color: #6366f1;"></i> 
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
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = { moduleApp: {} };
    if (prevSnapshot && prevSnapshot.dinhCoHeThongContent) {
        try {
            prevData = typeof prevSnapshot.dinhCoHeThongContent === 'string' 
                ? JSON.parse(prevSnapshot.dinhCoHeThongContent) 
                : prevSnapshot.dinhCoHeThongContent;
        } catch(e) { /* ignore */ }
    }
    
    // Parse admin review
    let adminReview = {};
    if (snapshot.dinhCoAdminReview) {
        try {
            adminReview = typeof snapshot.dinhCoAdminReview === 'string' 
                ? JSON.parse(snapshot.dinhCoAdminReview) 
                : snapshot.dinhCoAdminReview;
        } catch(e) { /* ignore */ }
    }
    
    let prevAdminReview = {};
    if (prevSnapshot && prevSnapshot.dinhCoAdminReview) {
        try {
            prevAdminReview = typeof prevSnapshot.dinhCoAdminReview === 'string' 
                ? JSON.parse(prevSnapshot.dinhCoAdminReview) 
                : prevSnapshot.dinhCoAdminReview;
        } catch(e) { /* ignore */ }
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
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${i+1}</td>
                <td style="padding:6px; border:1px solid #e2e8f0;">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.cpu, prev.cpu) : (row.cpu || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.ram, prev.ram) : (row.ram || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.disk, prev.disk) : (row.disk || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.cintRate, prev.cintRate) : (row.cintRate || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(ar.eval, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${ar.note || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Hệ thống tham chiếu</strong>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:6px; border:1px solid #e2e8f0;">STT</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">CPU</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">RAM</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Disk</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Cint</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
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
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${i+1}</td>
                <td style="padding:6px; border:1px solid #e2e8f0;">${prevSnapshot ? renderTextDiff(row.ip, prev.ip) : (row.ip || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.cpuLoad, prev.cpuLoad) : (row.cpuLoad || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.ramLoad, prev.ramLoad) : (row.ramLoad || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${prevSnapshot ? renderTextDiff(row.diskLoad, prev.diskLoad) : (row.diskLoad || '-')}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.cintUsed || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramUsed || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.diskUsed || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(evalVal, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${noteVal || '-'}</td>
            </tr>`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Thông tin tải đầu vào</strong>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:6px; border:1px solid #e2e8f0;">STT</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">CPU Load %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">RAM Load %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Disk Load %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Cint used</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">RAM used</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Disk used</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                </tr></thead>
                <tbody>${icRowsHtml}</tbody>
            </table></div>`;
    }
    
    // Evidence images
    const evidenceImgs = moduleApp.evidenceImages || [];
    if (evidenceImgs.length > 0) {
        const thumbs = evidenceImgs.map((img, i) => {
            const src = img.dataUrl || img.base64 || img;
            return `<img src="${src}" alt="evidence-${i}" onclick="openModal(this.src)" style="cursor:zoom-in; max-width:150px; max-height:100px; border-radius:4px; border:1px solid #e2e8f0; margin:3px;">`;
        }).join('');
        appHtml += `<div class="diff-item"><strong>Ảnh sở cứ Module App</strong> (${evidenceImgs.length} ảnh)<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">${thumbs}</div></div>`;
    }
    
    
    if (appHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#f8fafc; border-radius:8px; border-left:4px solid #3b82f6;">
            <h4 style="margin:0 0 10px 0; color:#1e40af;"><i class="fa-solid fa-server"></i> Module App</h4>${appHtml}</div>`;
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
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${i+1}</td>
            <td style="padding:6px; border:1px solid #e2e8f0;">${row.dbName || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.cpuLoad || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramLoad || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.storage || '-'}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(ar.eval, null)}</td>
            <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${ar.note || '-'}</td>
        </tr>`;
        }).join('');
        mariadbHtml += `<div class="diff-item"><strong>Bảng tham chiếu</strong>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:6px; border:1px solid #e2e8f0;">STT</th><th style="padding:6px; border:1px solid #e2e8f0;">Database</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">CPU %</th><th style="padding:6px; border:1px solid #e2e8f0;">RAM %</th>
                    <th style="padding:6px; border:1px solid #e2e8f0;">Storage</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                    <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                </tr></thead><tbody>${rRowsHtml}</tbody>
            </table></div>`;
    }
    
    // Storage review
    const mariadbStorageReview = (adminReview.moduleMariaDB || {}).storageReview || {};
    if (mariadbStorageReview.eval || mariadbStorageReview.note) {
        mariadbHtml += `<div class="diff-item"><strong>Đánh giá Storage:</strong> ${renderEvalDiff(mariadbStorageReview.eval, null)} <span style="color:#6366f1; font-style:italic;">${mariadbStorageReview.note || ''}</span></div>`;
    }
    
    
    if (mariadbHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#fefce8; border-radius:8px; border-left:4px solid #eab308;">
            <h4 style="margin:0 0 10px 0; color:#854d0e;"><i class="fa-solid fa-database"></i> Module MariaDB</h4>${mariadbHtml}</div>`;
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
                <td style="padding:6px; border:1px solid #e2e8f0;">${row.ip || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ram || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.isMaster ? '✓' : ''}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(evalVal, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${noteVal || '-'}</td>
            </tr>`;
            }).join('');
            redisHtml += `<div class="diff-item"><strong>Bảng cấu hình Redis</strong>
                <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                    <thead><tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM Load</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">Master</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                    </tr></thead><tbody>${cRowsHtml}</tbody>
                </table></div>`;
        }
        if (cm.inputCCU || cm.sizingCCU) {
            redisHtml += `<div class="diff-item"><strong>CCU đầu vào:</strong> ${cm.inputCCU || '-'} &nbsp; <strong>CCU Định cỡ:</strong> ${cm.sizingCCU || '-'}</div>`;
        }
    }
    
    if (redisAdmin.eval || redisAdmin.note) {
        redisHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(redisAdmin.eval, null)} <span style="color:#6366f1; font-style:italic;">${redisAdmin.note || ''}</span></div>`;
    }
    
    if (redisHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#fef2f2; border-radius:8px; border-left:4px solid #ef4444;">
            <h4 style="margin:0 0 10px 0; color:#991b1b;"><i class="fa-solid fa-memory"></i> Module Redis</h4>${redisHtml}</div>`;
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
                <td style="padding:6px; border:1px solid #e2e8f0;">${row.ip || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.vcpu || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ram || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.disk || '-'}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.cpuLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.ramLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${row.diskLoad || '-'}%</td>
                <td style="padding:6px; border:1px solid #e2e8f0; text-align:center;">${renderEvalDiff(evalVal, null)}</td>
                <td style="padding:6px; border:1px solid #e2e8f0; color:#6366f1; font-style:italic;">${noteVal || '-'}</td>
            </tr>`;
            }).join('');
            kafkaHtml += `<div class="diff-item"><strong>Bảng Linear (Existing System)</strong>
                <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;">
                    <thead><tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #e2e8f0;">IP</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">vCPU</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">Disk</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">CPU %</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">RAM %</th>
                        <th style="padding:6px; border:1px solid #e2e8f0;">Disk %</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Đánh giá</th>
                        <th style="padding:6px; border:1px solid #e2e8f0; background:#fef3c7;">Ghi chú</th>
                    </tr></thead><tbody>${lRowsHtml}</tbody>
                </table></div>`;
        }
        if (lm.inputCCU || lm.sizingCCU) {
            kafkaHtml += `<div class="diff-item"><strong>CCU đầu vào:</strong> ${lm.inputCCU || '-'} &nbsp; <strong>CCU Định cỡ:</strong> ${lm.sizingCCU || '-'}</div>`;
        }
    }
    
    if (kafkaAdmin.eval || kafkaAdmin.note) {
        kafkaHtml += `<div class="diff-item"><strong>Admin đánh giá:</strong> ${renderEvalDiff(kafkaAdmin.eval, null)} <span style="color:#6366f1; font-style:italic;">${kafkaAdmin.note || ''}</span></div>`;
    }
    
    if (kafkaHtml) {
        html += `<div style="margin-bottom:20px; padding:12px; background:#f0fdf4; border-radius:8px; border-left:4px solid #22c55e;">
            <h4 style="margin:0 0 10px 0; color:#166534;"><i class="fa-solid fa-stream"></i> Module Kafka</h4>${kafkaHtml}</div>`;
    }
    
    if (!html.trim()) {
        if (prevSnapshot) {
            return `<div class="vp-section"><div class="vp-no-changes"><i class="fa-solid fa-check-circle"></i><span>Không có thay đổi trong phần Định cỡ hệ thống</span></div></div>`;
        }
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    return `
        <div class="vp-section">
            <div class="vp-section-title">
                <i class="fa-solid fa-sliders" style="color: #6366f1;"></i> 
                Định cỡ hệ thống
            </div>
            ${html}
        </div>
    `;
}

/**
 * Render diff cho Tổng hợp và đề xuất
 */
function renderSummaryDiff(snapshot, prevSnapshot) {
    const content = snapshot.tongHopVaDeXuatContent;
    if (!content) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Không có dữ liệu cho phần này</p>';
    }
    
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch(e) {
        return '<p style="color: red;">Lỗi parse dữ liệu</p>';
    }
    
    // Parse previous data
    let prevData = { summaryRows: [] };
    if (prevSnapshot && prevSnapshot.tongHopVaDeXuatContent) {
        try {
            prevData = typeof prevSnapshot.tongHopVaDeXuatContent === 'string' 
                ? JSON.parse(prevSnapshot.tongHopVaDeXuatContent) 
                : prevSnapshot.tongHopVaDeXuatContent;
        } catch(e) { /* ignore */ }
    }
    
    if (!data.summaryRows || data.summaryRows.length === 0) {
        return '<p style="color: #999; text-align: center; padding: 40px;">Chưa có đề xuất</p>';
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
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(rowModuleType, prevModuleType)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(rowModuleName, prevModuleName)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(rowCauHinh, prevCauHinh)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${renderTextDiff(row.soLuong, prevRow.soLuong)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${renderTextDiff(row.ghiChu, prevRow.ghiChu)}</td>
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
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${i + 1}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevModuleType}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevModuleName}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevCauHinh}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.soLuong || '-'}</div></td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;"><div class="diff-removed">${prevRow.ghiChu || '-'}</div></td>
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
                <i class="fa-solid fa-code-compare" style="color: #10b981;"></i> 
                Thay đổi trong Tổng hợp đề xuất 
                <span class="diff-count">(${changeCount} dòng thay đổi)</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">STT</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Loại module</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Tên module</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Cấu hình</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Số lượng</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Ghi chú</th>
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
 * Build payload chứa toàn bộ dữ liệu từ tất cả sections
 */
function buildSavePayload() {
    const user = getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    let payload = {};
    
    try {
        // === 1. YÊU CẦU BÀI TOÁN ===
        const requestData = collectYeuCauBaiToan();
        if (role !== 'admin1' && role !== 'admin2') {
            delete requestData.adminReview;
        }
        payload.yeuCauBaiToanContent = JSON.stringify(requestData);
        
        // === 2. THÔNG TIN ĐẦU VÀO ===
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
        
        // === 3. MÔ HÌNH HỆ THỐNG ===
        const modelData = collectMoHinhHeThong();
        payload.moHinhHeThongContent = JSON.stringify(modelData);
        
        // === 4. ĐỊNH CỠ HỆ THỐNG ===
        if (typeof collectAllSizingData === 'function') {
            const sizingData = collectAllSizingData();
            payload.dinhCoHeThongContent = JSON.stringify(sizingData);
        }
        
        // === 5. TỔNG HỢP VÀ ĐỀ XUẤT ===
        // Trước khi collect, aggregate lại từ kết quả định cỡ (chỉ module được chọn)
        aggregateSizingResults();
        const summaryData = collectTongHop();
        payload.tongHopVaDeXuatContent = JSON.stringify(summaryData);
    } catch (e) {
        Logger.error('Error building save payload:', e);
        return null;
    }
    
    return payload;
}

/**
 * Thực hiện lưu thủ công: lưu TẤT CẢ dữ liệu + tạo revision
 * Được gọi khi user bấm nút Lưu ở bất kỳ section nào
 */
async function performManualSave() {
    if (isSaving || !currentProjectId) return;
    if (currentProjectStatus === 'HOAN_THANH') {
        showToast('Dự án đã hoàn thành, không thể chỉnh sửa.', 'warning');
        return;
    }

    const activeSection = document.querySelector('.page-section.active');
    const activeSectionId = activeSection?.id || null;
    if (activeSectionId) {
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
    
    try {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders());
        
        // ========== BUILD PAYLOAD ==========
        const payload = buildSavePayload();
        if (!payload) {
            showSaveStatus('error');
            return;
        }
        
        // Lấy requestData cho project name update
        let requestData = {};
        try { requestData = collectYeuCauBaiToan(); } catch(e) {}
        
        // ========== CHẠY SONG SONG TẤT CẢ NETWORK REQUESTS ==========
        const networkPromises = [];
        
        // 1) Cập nhật project name/devUnit
        if (requestData.projectName) {
            networkPromises.push(
                fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
                    method: 'PUT', headers,
                    body: JSON.stringify({ 
                        name: requestData.projectName, 
                        devUnit: requestData.devUnit, 
                        ownerName: requestData.contactPerson 
                    })
                }).catch(() => {})
            );
        }
        
        // 2) Lưu dữ liệu chính
        if (Object.keys(payload).length > 0) {
            if (!currentProjectDataId) {
                payload.projectId = currentProjectId;
                networkPromises.push(
                    fetch(`${API_BASE_URL}/project-data`, {
                        method: 'POST', headers,
                        body: JSON.stringify(payload)
                    }).then(resp => {
                        if (resp.ok) return resp.json().then(result => saveProjectDataIdToStorage(result.id));
                        else throw new Error('POST project-data failed: ' + resp.status);
                    })
                );
            } else {
                networkPromises.push(
                    fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}`, {
                        method: 'PUT', headers,
                        body: JSON.stringify(payload)
                    }).then(resp => {
                        if (!resp.ok) throw new Error('PUT project-data failed: ' + resp.status);
                        return resp;
                    })
                );
            }
        }
        
        // 3) Admin review (nếu là admin)
        if (role === 'admin1' || role === 'admin2') {
            const requestAdminReview = requestData.adminReview || {};
            
            const inputRows = Array.from(document.querySelectorAll('#input-table-body tr'));
            const inputAdminReview = { rows: inputRows.map(row => ({ 
                eval: row.querySelector('.admin-eval')?.value || '', 
                note: row.querySelector('.admin-note')?.value || '' 
            })) };
            
            let modelAdminReview = {};
            try { modelAdminReview = collectMoHinhAdminReview(); } catch(e) {}
            
            let sizingAdminReview = {};
            try { sizingAdminReview = collectSizingAdminReviewData(); } catch(e) {}
            
            const reviewSections = [
                { section: 'request', data: requestAdminReview },
                { section: 'input', data: inputAdminReview },
                { section: 'model', data: modelAdminReview },
                { section: 'sizing', data: sizingAdminReview }
            ];
            
            reviewSections.forEach(({ section, data }) => {
                networkPromises.push(
                    fetch(`${API_BASE_URL}/project-data/project/${currentProjectId}/evaluate`, {
                        method: 'POST', headers,
                        body: JSON.stringify({ section, reviewJson: JSON.stringify(data) })
                    }).catch(e => Logger.warn(`Admin review save failed [${section}]:`, e.message))
                );
            });
        }
        
        // ========== CHỜ TẤT CẢ HOÀN TẤT ==========
        const results = await Promise.allSettled(networkPromises);
        
        const failedResults = results.filter(r => r.status === 'rejected');
        if (failedResults.length > 0) {
            Logger.warn(`Save: ${failedResults.length}/${results.length} requests failed`, failedResults);
        }
        
        // ========== TẠO REVISION SAU KHI LƯU THÀNH CÔNG ==========
        const userName = user.displayName || user.username || 'User';
        await createRevision(`${userName} lưu dữ liệu`);
        
        showSaveStatus('saved');
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
            statusDiv.innerHTML = '<span style="color: #b8860b; font-size: 12px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...</span>';
            break;
        case 'saved':
            statusDiv.innerHTML = '<span style="color: green; font-size: 12px;"><i class="fa-solid fa-check"></i> Đã lưu thành công</span>';
            setTimeout(() => {
                if (statusDiv.innerHTML.includes('Đã lưu thành công')) {
                    statusDiv.innerHTML = '';
                }
            }, 5000);
            break;
        case 'error':
            statusDiv.innerHTML = '<span style="color: red; font-size: 12px;"><i class="fa-solid fa-exclamation-triangle"></i> Lỗi khi lưu dữ liệu</span>';
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
        <td><textarea rows="2" class="input-full" style="resize: vertical; min-height: 44px; white-space: pre-wrap;" placeholder="VD: 10.0.0.1&#10;10.0.0.3">${escapeHtml(data.source || '')}</textarea></td>
        <td><textarea rows="2" class="input-full" style="resize: vertical; min-height: 44px; white-space: pre-wrap;" placeholder="VD: 10.0.0.2&#10;10.0.0.4">${escapeHtml(data.destination || '')}</textarea></td>
        <td><textarea rows="2" class="input-full" style="resize: vertical; min-height: 44px; white-space: pre-wrap;" placeholder="VD: 8080&#10;8443">${escapeHtml(data.port || '')}</textarea></td>
        <td>
            <select class="input-full">
                <option value="">-- Chọn --</option>
                <option value="TCP" ${data.protocol === 'TCP' ? 'selected' : ''}>TCP</option>  
                <option value="UDP" ${data.protocol === 'UDP' ? 'selected' : ''}>UDP</option>
                <option value="TCP/UDP" ${data.protocol === 'TCP/UDP' ? 'selected' : ''}>TCP/UDP</option>
            </select>
        </td>
        <td><textarea rows="2" class="input-full" style="resize: vertical; min-height: 44px; white-space: pre-wrap;" placeholder="Mô tả kết nối...">${escapeHtml(data.description || '')}</textarea></td>
        <td class="admin-cell">
            <select class="admin-eval admin-eval-select" onchange="styleAdminSelect(this)">
                <option value="">--</option>
                <option value="OK" ${data.adminEval === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NOK" ${data.adminEval === 'NOK' ? 'selected' : ''}>NOK</option>
            </select>
        </td>
        <td class="admin-cell">
            <textarea rows="1" class="input-full admin-note" placeholder="Nhận xét..." style="resize: vertical; min-height: 34px;">${data.adminNote || ''}</textarea>
        </td>
        <td class="text-center">
            <button class="btn-delete" onclick="removeConnectionRow(this)">✖</button>
        </td>
    `;
    return tr;
}

function addConnectionRow(data = {}) {
    const tbody = document.getElementById('connection-info-table-body');
    if (!tbody) return;
    const stt = tbody.rows.length + 1;
    const tr = createConnectionTableRow(stt, data);
    tbody.appendChild(tr);
    try { applyRolePermissions(); } catch (e) {}
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
            source: cells[1]?.querySelector('textarea')?.value || cells[1]?.querySelector('input')?.value || '',
            destination: cells[2]?.querySelector('textarea')?.value || cells[2]?.querySelector('input')?.value || '',
            port: cells[3]?.querySelector('textarea')?.value || cells[3]?.querySelector('input')?.value || '',
            protocol: cells[4]?.querySelector('select')?.value || '',
            description: cells[5]?.querySelector('textarea')?.value || cells[5]?.querySelector('input')?.value || ''
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
        });
    } else {
        tbody.appendChild(createConnectionTableRow(1, {}));
    }
}

