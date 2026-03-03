/**
 * dashboard.js - Tổng quan & điều khiển chung
 */

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('sidebar')) return; // login page
    initDashboard();
});

async function initDashboard() {
    updateClock();
    setInterval(updateClock, 60000);
    
    showLoading(true, 'Đang tải dữ liệu...');
    await Promise.all([loadDashboardStats(), loadUsers(), loadProjects()]);
    showLoading(false);
}

// ==================== DASHBOARD STATS ====================
async function loadDashboardStats() {
    try {
        const [users, projects] = await Promise.all([
            fetchAPI('/users'),
            fetchAPI('/projects')
        ]);

        // Total stats
        document.getElementById('stat-total-users').textContent = users.length;
        document.getElementById('stat-total-projects').textContent = projects.length;

        const pending = projects.filter(p => p.status === 'THAM_DINH' || p.status === 'PHE_DUYET');
        const completed = projects.filter(p => p.status === 'HOAN_THANH');
        document.getElementById('stat-pending-projects').textContent = pending.length;
        document.getElementById('stat-completed-projects').textContent = completed.length;

        // Pending projects table
        renderPendingTable(pending);

        // Status chart
        renderStatusChart(projects);

    } catch (error) {
        console.error('Lỗi load dashboard stats:', error);
    }
}

function renderPendingTable(pending) {
    const tbody = document.getElementById('tbody-pending-projects');
    if (!pending || pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row"><i class="fas fa-check-circle" style="color:#22c55e"></i> Không có dự án chờ phê duyệt</td></tr>';
        return;
    }
    tbody.innerHTML = pending.map(p => `
        <tr>
            <td><strong>${escapeHtml(p.name || '')}</strong></td>
            <td>${escapeHtml(p.devUnit || '-')}</td>
            <td>${escapeHtml(p.ownerName || '-')}</td>
            <td>${getStatusBadge(p.status)}</td>
            <td class="text-center">${p.statusRound || 1}</td>
            <td>${formatDate(p.createdAt)}</td>
        </tr>
    `).join('');
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
    event.preventDefault();
    
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
        'page-projects': 'Quản lý Dự án'
    };
    document.getElementById('page-title').textContent = titles[pageId] || '';

    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

// ==================== SIDEBAR ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
}

// ==================== CLOCK ====================
function updateClock() {
    const now = new Date();
    const el = document.getElementById('header-time');
    if (el) {
        el.textContent = now.toLocaleDateString('vi-VN', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
        }) + ' - ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { 
        success: 'fa-check-circle', 
        error: 'fa-times-circle', 
        warning: 'fa-exclamation-triangle', 
        info: 'fa-info-circle' 
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== CONFIRM DIALOG ====================
let confirmResolve = null;

function showConfirm(title, message) {
    return new Promise(resolve => {
        confirmResolve = resolve;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').innerHTML = message;
        document.getElementById('modal-confirm').style.display = 'flex';
    });
}

function closeConfirm(result) {
    document.getElementById('modal-confirm').style.display = 'none';
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

// ==================== LOADING ====================
function showLoading(show, text) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        if (text) document.getElementById('loading-text').textContent = text;
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
    }
}

// ==================== UTILITIES ====================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
