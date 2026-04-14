/**
 * dashboard.js - Enhanced Dashboard Core
 * Features: Improved toast, loading, navigation with hash routing,
 *           sidebar outside-click, keyboard shortcuts, event delegation
 */

function getAdminSelectorId(group, key, fallbackId) {
    return window.AdminSelectors?.[group]?.[key] || fallbackId;
}

function initDashboardActionDelegation() {
    if (window.__dashboardActionDelegationInited) return;
    window.__dashboardActionDelegationInited = true;

    document.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;

        if (action === 'toggle-sidebar') {
            event.preventDefault();
            toggleSidebar();
            return;
        }

        if (action === 'navigate-page') {
            event.preventDefault();
            const pageId = actionEl.dataset.page;
            if (!pageId) return;
            navigateTo(pageId, actionEl.closest('.nav-item') || actionEl);
            return;
        }

        if (action === 'logout') {
            event.preventDefault();
            logout();
            return;
        }

        if (action === 'dismiss-session-warning') {
            event.preventDefault();
            if (typeof dismissSessionWarning === 'function') dismissSessionWarning();
            return;
        }

        if (action === 'open-user-modal') {
            event.preventDefault();
            if (typeof openUserModal === 'function') openUserModal();
            return;
        }

        if (action === 'close-user-modal') {
            event.preventDefault();
            if (typeof closeUserModal === 'function') closeUserModal();
            return;
        }

        if (action === 'save-user') {
            event.preventDefault();
            if (typeof saveUser === 'function') saveUser();
            return;
        }

        if (action === 'close-confirm') {
            event.preventDefault();
            const confirmResult = actionEl.dataset.confirmResult === 'true';
            if (typeof closeConfirm === 'function') closeConfirm(confirmResult);
            return;
        }

        if (action === 'close-assign-modal') {
            event.preventDefault();
            if (typeof closeAssignModal === 'function') closeAssignModal();
            return;
        }

        if (action === 'save-assign-admin1') {
            event.preventDefault();
            if (typeof saveAssignAdmin1 === 'function') saveAssignAdmin1();
            return;
        }

        if (action === 'refresh-projects') {
            event.preventDefault();
            if (typeof refreshProjects === 'function') refreshProjects();
            return;
        }

        if (action === 'export-audit-log') {
            event.preventDefault();
            if (typeof exportAuditLog === 'function') exportAuditLog();
            return;
        }

        if (action === 'clear-audit-log') {
            event.preventDefault();
            if (typeof clearAuditLog === 'function') clearAuditLog();
            return;
        }

        if (action === 'export-report') {
            event.preventDefault();
            if (typeof exportReport === 'function') exportReport();
            return;
        }

        if (action === 'load-report-data') {
            event.preventDefault();
            if (typeof loadReportData === 'function') loadReportData();
            return;
        }

        if (action === 'close-toast') {
            event.preventDefault();
            const toast = actionEl.closest('.toast');
            if (toast) {
                toast.remove();
            }
            return;
        }
    });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById(getAdminSelectorId('layout', 'sidebar', 'sidebar'))) return; // login page
    initDashboard();
});

async function initDashboard() {
    initDashboardActionDelegation();

    updateClock();
    setInterval(updateClock, 60000);

    // Setup debounced search (thay thế inline oninput)
    const searchUsers = document.getElementById('search-users');
    const searchProjects = document.getElementById('search-projects');
    if (searchUsers) searchUsers.addEventListener('input', debounce(filterUsers, 300));
    if (searchProjects) searchProjects.addEventListener('input', debounce(filterProjects, 300));

    // Setup filter dropdowns
    const filterRole = document.getElementById('filter-user-role');
    const filterStatus = document.getElementById('filter-project-status');
    if (filterRole) filterRole.addEventListener('change', filterUsers);
    if (filterStatus) filterStatus.addEventListener('change', filterProjects);

    // Restore page from URL hash
    restorePageFromHash();

    showLoading(true, 'Đang tải dữ liệu...');

    // Ghi nhận sự kiện mở dashboard
    if (typeof logAudit === 'function') logAudit('VIEW', 'SYSTEM', 'Dashboard', 'Truy cập trang quản trị');

    try {
        const currentUser = getCurrentUser();
        if (currentUser.role === 'admin2') {
            await Promise.all([loadDashboardStats(), loadUsers(), loadProjects()]);
        } else {
            await Promise.all([loadDashboardStats(), loadProjects()]);
        }
    } catch (error) {
        console.error('Init error:', error);
        showToast('Lỗi khởi tạo dashboard', 'error');
    }
    showLoading(false);
}

// ==================== DASHBOARD STATS ====================
async function loadDashboardStats() {
    try {
        const currentUser = getCurrentUser();
        const isAdmin2 = currentUser.role === 'admin2';

        // Admin2: hiện đầy đủ stats, role khác: chỉ hiện stats dự án của mình
        let users = [];
        let projects = [];

        if (isAdmin2) {
            [users, projects] = await Promise.all([
                fetchAPI('/users', { useCache: true, cacheTTL: 60000 }),
                fetchAPI('/projects/my-projects', { useCache: true, cacheTTL: 60000 })
            ]);
        } else {
            projects = await fetchAPI('/projects/my-projects', { useCache: true, cacheTTL: 60000 });
        }

        // Animate stat numbers
        if (isAdmin2) {
            animateValue('stat-total-users', users.length);
        } else {
            // Ẩn stat users cho non-admin2
            const statUsersCard = document.querySelector('.stat-users');
            if (statUsersCard) statUsersCard.style.display = 'none';
        }
        
        animateValue('stat-total-projects', projects.length);

        const pending = projects.filter(p => p.status === 'THAM_DINH' || p.status === 'PHE_DUYET');
        const completed = projects.filter(p => p.status === 'HOAN_THANH');
        animateValue('stat-pending-projects', pending.length);
        animateValue('stat-completed-projects', completed.length);

        renderPendingTable(pending);
        renderStatusChart(projects);

    } catch (error) {
        console.error('Dashboard stats error:', error);
    }
}

/**
 * Animate number counting effect cho stat cards
 */
function animateValue(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const duration = 500;
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target; return; }
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutQuart
        const eased = 1 - Math.pow(1 - progress, 4);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function renderPendingTable(pending) {
    const tbody = document.getElementById('tbody-pending-projects');
    if (!pending || pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row"><div class="empty-state"><span class="empty-icon">📋</span><span>Không có dự án chờ phê duyệt</span></div></td></tr>';
        return;
    }
    tbody.innerHTML = pending.slice(0, 10).map(p => `
        <tr>
            <td><strong>${escapeHtml(p.name || '')}</strong></td>
            <td>${escapeHtml(p.devUnit || '-')}</td>
            <td>${escapeHtml(p.ownerName || '-')}</td>
            <td>${getStatusBadge(p.status)}</td>
            <td class="text-center">${p.statusRound || 1}</td>
            <td>${formatDate(p.createdAt)}</td>
        </tr>
    `).join('');

    // Show count if more than 10
    if (pending.length > 10) {
        tbody.innerHTML += `<tr><td colspan="6" class="empty-row">... và ${pending.length - 10} dự án khác</td></tr>`;
    }
}

function renderStatusChart(projects) {
    const chart = document.getElementById('status-chart');
    const statuses = [
        { key: 'SIZING', label: 'Sizing', color: '#3b82f6' },
        { key: 'THAM_DINH', label: 'Thẩm định', color: '#f59e0b' },
        { key: 'PHE_DUYET', label: 'Phê duyệt', color: '#8b5cf6' },
        { key: 'HOAN_THANH', label: 'Hoàn thành', color: '#22c55e' }
    ];
    const total = projects.length || 1;

    chart.innerHTML = `
        <div class="chart-bars">
            ${statuses.map(s => {
                const count = projects.filter(p => p.status === s.key).length;
                const pct = Math.round((count / total) * 100);
                return `
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">
                            <span class="chart-dot" style="background:${s.color}"></span>
                            ${s.label}
                        </div>
                        <div class="chart-bar-track">
                            <div class="chart-bar-fill" style="width:${pct}%;background:${s.color}"></div>
                        </div>
                        <div class="chart-bar-value">${count} (${pct}%)</div>
                    </div>`;
            }).join('')}
        </div>
    `;
}

// ==================== NAVIGATION ====================
function navigateTo(pageId, el) {
    if (event) event.preventDefault();

    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    // Show target
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'block';

    // Active nav item
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');

    // Update title
    const titles = {
        'page-dashboard': 'Tổng quan',
        'page-users': 'Quản lý User',
        'page-projects': 'Quản lý Dự án',
        'page-audit-log': 'Lịch sử hoạt động',
        'page-reports': 'Báo cáo & Thống kê'
    };
    const titleEl = document.getElementById(getAdminSelectorId('layout', 'pageTitle', 'page-title'));
    if (titleEl) titleEl.textContent = titles[pageId] || '';

    // Load data for lazy-loaded pages
    if (pageId === 'page-audit-log' && typeof loadAuditLog === 'function') loadAuditLog();
    if (pageId === 'page-reports' && typeof loadReportData === 'function') loadReportData();

    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
    }

    // Update URL hash (hỗ trợ bookmark / browser back-forward)
    history.replaceState(null, '', '#' + pageId.replace('page-', ''));
}

function restorePageFromHash() {
    const hash = location.hash.replace('#', '');
    if (hash && hash !== 'dashboard') {
        const pageId = 'page-' + hash;
        const navItem = document.querySelector(`[data-page="${pageId}"]`);
        if (navItem) setTimeout(() => navigateTo(pageId, navItem), 50);
    }
}

// Handle browser back/forward
window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (hash) {
        const pageId = 'page-' + hash;
        const navItem = document.querySelector(`[data-page="${pageId}"]`);
        if (navItem) navigateTo(pageId, navItem);
    }
});

// ==================== SIDEBAR ====================
function toggleSidebar() {
    const sidebar = document.getElementById(getAdminSelectorId('layout', 'sidebar', 'sidebar'));
    const main = document.getElementById(getAdminSelectorId('layout', 'mainContent', 'main-content'));
    if (!sidebar || !main) return;

    if (window.innerWidth < 768) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('expanded');
    }
}

// Close sidebar khi click bên ngoài (mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById(getAdminSelectorId('layout', 'sidebar', 'sidebar'));
        if (sidebar && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !e.target.classList.contains('btn-menu-mobile')) {
            sidebar.classList.remove('open');
        }
    }
});

// ==================== CLOCK ====================
function updateClock() {
    const now = new Date();
    const el = document.getElementById(getAdminSelectorId('layout', 'headerTime', 'header-time'));
    if (el) {
        el.textContent = now.toLocaleDateString('vi-VN', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
        }) + ' - ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
}

// ==================== TOAST (Enhanced) ====================
function showToast(message, type = 'info', duration = 4000) {
    if (window.AdminUiFeedback && typeof window.AdminUiFeedback.showToast === 'function') {
        return window.AdminUiFeedback.showToast(message, type, duration);
    }
}

function removeToast(toast) {
    if (window.AdminUiFeedback && typeof window.AdminUiFeedback.removeToast === 'function') {
        return window.AdminUiFeedback.removeToast(toast);
    }
}

// ==================== CONFIRM DIALOG ====================
function showConfirm(title, message) {
    if (window.AdminUiFeedback && typeof window.AdminUiFeedback.showConfirm === 'function') {
        return window.AdminUiFeedback.showConfirm(title, message);
    }
    return Promise.resolve(confirm(message));
}

function closeConfirm(result) {
    if (window.AdminUiFeedback && typeof window.AdminUiFeedback.closeConfirm === 'function') {
        return window.AdminUiFeedback.closeConfirm(result);
    }
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
    // Escape -> close any open modal
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if (m.style.display !== 'none' && m.style.display !== '') {
                if (m.id === 'modal-confirm') closeConfirm(false);
                else if (m.id === 'modal-user') closeUserModal();
            }
        });
    }
});

// ==================== LOADING ====================
function showLoading(show, text) {
    if (window.AdminUiFeedback && typeof window.AdminUiFeedback.showLoading === 'function') {
        return window.AdminUiFeedback.showLoading(show, text);
    }
}

/**
 * Inline loading cho từng section cụ thể
 */
function showInlineLoading(containerId, show = true) {
    if (window.AdminUiFeedback && typeof window.AdminUiFeedback.showInlineLoading === 'function') {
        return window.AdminUiFeedback.showInlineLoading(containerId, show);
    }
}
