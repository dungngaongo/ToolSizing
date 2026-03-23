/**
 * reports.js - Báo cáo & Thống kê
 * Hiển thị biểu đồ, bảng thống kê dự án/user theo thời gian, trạng thái,
 * đơn vị phát triển, chủ đầu tư.
 */

// ==================== STATE ====================
let reportProjects = [];
let reportUsers = [];
let reportRevisions = [];
let reportDateRange = 'all'; // all | week | month | quarter | year

// ==================== DATA LOADING ====================
async function loadReportData() {
    showInlineLoading('report-content', true);
    try {
        const [projects, users] = await Promise.all([
            API.get('/projects').catch(() => []),
            API.get('/users').catch(() => [])
        ]);

        reportProjects = Array.isArray(projects) ? projects : [];
        reportUsers = Array.isArray(users) ? users : [];

        // Try loading revisions (may not exist)
        try {
            const revisions = await API.get('/project-revisions');
            reportRevisions = Array.isArray(revisions) ? revisions : [];
        } catch { reportRevisions = []; }

        renderAllReports();
    } catch (err) {
        showToast('Không thể tải dữ liệu báo cáo', 'error');
    } finally {
        showInlineLoading('report-content', false);
    }
}

// ==================== DATE FILTERING ====================
function getFilteredProjectsByDate() {
    if (reportDateRange === 'all') return reportProjects;
    const now = new Date();
    let threshold = new Date();

    switch (reportDateRange) {
        case 'week': threshold.setDate(now.getDate() - 7); break;
        case 'month': threshold.setMonth(now.getMonth() - 1); break;
        case 'quarter': threshold.setMonth(now.getMonth() - 3); break;
        case 'year': threshold.setFullYear(now.getFullYear() - 1); break;
        default: return reportProjects;
    }

    return reportProjects.filter(p => {
        const created = new Date(p.createdAt || p.startDate || 0);
        return created >= threshold;
    });
}

// ==================== CHART RENDERING ====================

/**
 * Vẽ donut chart bằng SVG thuần
 */
function renderDonutChart(containerId, data, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
        container.innerHTML = `<div class="chart-empty">Không có dữ liệu</div>`;
        return;
    }

    const size = 180;
    const cx = size / 2, cy = size / 2, r = 65;
    const strokeWidth = 28;
    const circumference = 2 * Math.PI * r;

    let offset = 0;
    const segments = data.filter(d => d.value > 0).map(d => {
        const pct = d.value / total;
        const dash = circumference * pct;
        const seg = {
            ...d,
            pct,
            dashArray: `${dash} ${circumference - dash}`,
            dashOffset: -offset
        };
        offset += dash;
        return seg;
    });

    const svg = `
        <div class="chart-wrapper">
            ${title ? `<h4 class="chart-title">${title}</h4>` : ''}
            <div class="chart-body">
                <svg viewBox="0 0 ${size} ${size}" class="donut-chart" role="img" aria-label="${title || 'Chart'}">
                    ${segments.map(s => `
                        <circle cx="${cx}" cy="${cy}" r="${r}"
                            fill="none" stroke="${s.color}" stroke-width="${strokeWidth}"
                            stroke-dasharray="${s.dashArray}" stroke-dashoffset="${s.dashOffset}"
                            transform="rotate(-90 ${cx} ${cy})" class="donut-segment">
                            <title>${s.label}: ${s.value} (${(s.pct * 100).toFixed(1)}%)</title>
                        </circle>
                    `).join('')}
                    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="donut-total">${total}</text>
                    <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="donut-label-center">Tổng</text>
                </svg>
                <div class="chart-legend">
                    ${segments.map(s => `
                        <div class="legend-item">
                            <span class="legend-color" style="background:${s.color}"></span>
                            <span class="legend-label">${s.label}</span>
                            <span class="legend-value">${s.value}</span>
                            <span class="legend-pct">(${(s.pct * 100).toFixed(1)}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = svg;
}

/**
 * Vẽ bar chart ngang bằng CSS
 */
function renderBarChart(containerId, data, title, maxItems = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
    const maxVal = sorted.length ? Math.max(...sorted.map(d => d.value)) : 0;

    if (sorted.length === 0 || maxVal === 0) {
        container.innerHTML = `<div class="chart-empty">Không có dữ liệu</div>`;
        return;
    }

    const html = `
        <div class="chart-wrapper">
            ${title ? `<h4 class="chart-title">${title}</h4>` : ''}
            <div class="bar-chart">
                ${sorted.map(d => `
                    <div class="bar-row">
                        <div class="bar-label" title="${escapeHtml(d.label)}">${escapeHtml(d.label)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width:${(d.value / maxVal * 100).toFixed(1)}%;background:${d.color || 'var(--primary)'}"
                                 title="${d.value}">
                            </div>
                        </div>
                        <div class="bar-value">${d.value}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Vẽ trend chart (line chart đơn giản) bằng SVG
 */
function renderTrendChart(containerId, data, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `<div class="chart-empty">Không có dữ liệu</div>`;
        return;
    }

    const width = 500, height = 200;
    const padL = 40, padR = 20, padT = 20, padB = 40;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const step = chartW / Math.max(data.length - 1, 1);

    const points = data.map((d, i) => ({
        x: padL + i * step,
        y: padT + chartH - (d.value / maxVal) * chartH,
        ...d
    }));

    const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

    // Fill area
    const areaPath = `M${points[0].x},${padT + chartH} ` +
        points.map(p => `L${p.x},${p.y}`).join(' ') +
        ` L${points[points.length - 1].x},${padT + chartH} Z`;

    const html = `
        <div class="chart-wrapper">
            ${title ? `<h4 class="chart-title">${title}</h4>` : ''}
            <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="${title || 'Trend'}">
                <!-- Grid lines -->
                ${[0, 0.25, 0.5, 0.75, 1].map(pct => {
                    const y = padT + chartH - pct * chartH;
                    return `
                        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" class="grid-line"/>
                        <text x="${padL - 5}" y="${y + 4}" text-anchor="end" class="axis-label">${Math.round(maxVal * pct)}</text>
                    `;
                }).join('')}
                <!-- Area -->
                <path d="${areaPath}" class="trend-area" />
                <!-- Line -->
                <polyline points="${polyline}" class="trend-line" />
                <!-- Dots & labels -->
                ${points.map(p => `
                    <circle cx="${p.x}" cy="${p.y}" r="4" class="trend-dot">
                        <title>${p.label}: ${p.value}</title>
                    </circle>
                `).join('')}
                <!-- X axis labels -->
                ${points.filter((_, i) => data.length <= 12 || i % Math.ceil(data.length / 12) === 0).map(p => `
                    <text x="${p.x}" y="${height - 5}" text-anchor="middle" class="axis-label">${p.label}</text>
                `).join('')}
            </svg>
        </div>
    `;

    container.innerHTML = html;
}

// ==================== REPORT SECTIONS ====================

function renderAllReports() {
    const projects = getFilteredProjectsByDate();

    renderStatusReport(projects);
    renderDevUnitReport(projects);
    renderOwnerReport(projects);
    renderTrendReport(projects);
    renderSummaryTable(projects);
    renderUserStats();
}

function renderStatusReport(projects) {
    const statusColors = {
        'DRAFT': '#94a3b8',
        'IN_REVIEW': '#f59e0b',
        'APPROVED': '#10b981',
        'REJECTED': '#ef4444',
        'PENDING': '#f59e0b',
        'ACTIVE': '#3b82f6',
        'COMPLETED': '#10b981'
    };

    const counts = {};
    projects.forEach(p => {
        const status = p.status || 'UNKNOWN';
        counts[status] = (counts[status] || 0) + 1;
    });

    const data = Object.entries(counts).map(([label, value]) => ({
        label: label.replace(/_/g, ' '),
        value,
        color: statusColors[label] || '#6b7280'
    }));

    renderDonutChart('chart-status', data, 'Phân bổ theo trạng thái');
}

function renderDevUnitReport(projects) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const counts = {};
    projects.forEach(p => {
        const unit = p.developmentUnit || p.devUnit || 'Không xác định';
        counts[unit] = (counts[unit] || 0) + 1;
    });

    const data = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));

    renderBarChart('chart-dev-unit', data, 'Dự án theo đơn vị phát triển');
}

function renderOwnerReport(projects) {
    const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#e11d48'];
    const counts = {};
    projects.forEach(p => {
        const owner = p.projectOwner || p.owner || p.createdBy || 'Không xác định';
        counts[owner] = (counts[owner] || 0) + 1;
    });

    const data = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));

    renderBarChart('chart-owner', data, 'Dự án theo chủ đầu tư / người tạo');
}

function renderTrendReport(projects) {
    // Group by month
    const months = {};
    projects.forEach(p => {
        const d = new Date(p.createdAt || p.startDate || Date.now());
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + 1;
    });

    const sortedKeys = Object.keys(months).sort();
    const data = sortedKeys.map(key => {
        const [y, m] = key.split('-');
        return {
            label: `T${parseInt(m)}/${y.slice(2)}`,
            value: months[key]
        };
    });

    renderTrendChart('chart-trend', data, 'Xu hướng tạo dự án theo tháng');
}

function renderSummaryTable(projects) {
    const tbody = document.getElementById('tbody-report-summary');
    if (!tbody) return;

    // Group by status with aggregation
    const groups = {};
    projects.forEach(p => {
        const status = p.status || 'UNKNOWN';
        if (!groups[status]) {
            groups[status] = { count: 0, projects: [] };
        }
        groups[status].count++;
        groups[status].projects.push(p.name || p.projectName || 'N/A');
    });

    if (Object.keys(groups).length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-row">
            <div class="empty-state"><span class="empty-icon">📊</span><span>Không có dữ liệu dự án</span></div>
        </td></tr>`;
        return;
    }

    const total = projects.length;
    tbody.innerHTML = Object.entries(groups)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([status, data]) => `
            <tr>
                <td>${getStatusBadge(status)}</td>
                <td><strong>${data.count}</strong></td>
                <td>${(data.count / total * 100).toFixed(1)}%</td>
                <td>
                    <div class="report-progress-bar">
                        <div class="report-progress-fill" style="width:${(data.count / total * 100)}%"></div>
                    </div>
                </td>
            </tr>
        `).join('');

    // Total row
    tbody.innerHTML += `
        <tr class="report-total-row">
            <td><strong>Tổng cộng</strong></td>
            <td><strong>${total}</strong></td>
            <td>100%</td>
            <td></td>
        </tr>
    `;
}

function renderUserStats() {
    const statsEl = document.getElementById('report-user-stats');
    if (!statsEl) return;

    const totalUsers = reportUsers.length;
    const admins = reportUsers.filter(u => u.role === 'admin' || u.role === 'admin2' || u.role === 'ADMIN').length;
    const regular = totalUsers - admins;

    statsEl.innerHTML = `
        <div class="report-user-card">
            <div class="report-user-icon">👥</div>
            <div class="report-user-info">
                <span class="report-user-number">${totalUsers}</span>
                <span class="report-user-label">Tổng Users</span>
            </div>
        </div>
        <div class="report-user-card">
            <div class="report-user-icon">🛡️</div>
            <div class="report-user-info">
                <span class="report-user-number">${admins}</span>
                <span class="report-user-label">Administrators</span>
            </div>
        </div>
        <div class="report-user-card">
            <div class="report-user-icon">👤</div>
            <div class="report-user-info">
                <span class="report-user-number">${regular}</span>
                <span class="report-user-label">Regular Users</span>
            </div>
        </div>
        <div class="report-user-card">
            <div class="report-user-icon">📁</div>
            <div class="report-user-info">
                <span class="report-user-number">${reportProjects.length}</span>
                <span class="report-user-label">Tổng Dự án</span>
            </div>
        </div>
    `;
}

// ==================== DATE RANGE ====================
function changeReportDateRange(range) {
    reportDateRange = range;

    // Update active state
    document.querySelectorAll('.report-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });

    renderAllReports();
}

// ==================== EXPORT REPORT ====================
function exportReport() {
    const projects = getFilteredProjectsByDate();
    if (projects.length === 0) {
        showToast('Không có dữ liệu để xuất', 'warning');
        return;
    }

    const headers = ['STT', 'Tên dự án', 'Trạng thái', 'Đơn vị phát triển', 'Chủ đầu tư', 'Ngày tạo'];
    const rows = projects.map((p, i) => [
        i + 1,
        p.name || p.projectName || '',
        p.status || '',
        p.developmentUnit || p.devUnit || '',
        p.projectOwner || p.owner || p.createdBy || '',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : ''
    ]);

    let csv = '\uFEFF';
    csv += headers.join(',') + '\n';
    rows.forEach(r => {
        csv += r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportDateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Đã xuất báo cáo ${projects.length} dự án`, 'success');
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.report-range-btn').forEach(btn => {
        btn.addEventListener('click', () => changeReportDateRange(btn.dataset.range));
    });
});
