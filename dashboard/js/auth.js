/**
 * auth.js - Enhanced Authentication & Authorization
 * Features: JWT validation, role-based access, session timeout warning,
 *           rate limiting on login, secure storage
 */

// ==================== CONSTANTS ====================
const AUTH_CONFIG = {
    allowedRoles: ['admin2', 'admin1', 'user'],
    sessionWarningMs: 5 * 60 * 1000,   // Cảnh báo 5 phút trước khi hết hạn
    checkIntervalMs: 30 * 1000,         // Kiểm tra mỗi 30 giây
    maxLoginAttempts: 5,                 // Tối đa 5 lần thử sai
    lockoutMs: 5 * 60 * 1000,           // Khóa 5 phút
    loginPage: 'login.html',
    dashboardPage: 'index.html'
};

// ==================== LOGIN PAGE LOGIC ====================
if (document.getElementById('login-form')) {
    initLoginPage();
}

function initLoginPage() {
    // Đã đăng nhập hợp lệ -> redirect dashboard
    if (isAuthenticated()) {
        window.location.href = AUTH_CONFIG.dashboardPage;
        return;
    }

    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// Rate limiting state
let loginAttempts = 0;
let lockoutUntil = 0;

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    // Reset errors
    errorDiv.style.display = 'none';
    document.getElementById('error-username').textContent = '';
    document.getElementById('error-password').textContent = '';

    // --- Rate limit check ---
    if (Date.now() < lockoutUntil) {
        const remainSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
        errorDiv.textContent = `Quá nhiều lần thử. Vui lòng đợi ${remainSec} giây`;
        errorDiv.style.display = 'block';
        return;
    }

    // --- Validate inputs ---
    let valid = true;
    if (!username) {
        document.getElementById('error-username').textContent = 'Vui lòng nhập tên đăng nhập';
        valid = false;
    } else if (username.length < 3) {
        document.getElementById('error-username').textContent = 'Tên đăng nhập phải ít nhất 3 ký tự';
        valid = false;
    }
    if (!password) {
        document.getElementById('error-password').textContent = 'Vui lòng nhập mật khẩu';
        valid = false;
    } else if (password.length < 4) {
        document.getElementById('error-password').textContent = 'Mật khẩu phải ít nhất 4 ký tự';
        valid = false;
    }
    if (!valid) return;

    // Loading state
    btnLogin.disabled = true;
    btnLogin.querySelector('.btn-text').style.display = 'none';
    btnLogin.querySelector('.btn-loading').style.display = 'inline';

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            loginAttempts++;
            if (loginAttempts >= AUTH_CONFIG.maxLoginAttempts) {
                lockoutUntil = Date.now() + AUTH_CONFIG.lockoutMs;
                loginAttempts = 0;
                throw new Error(`Quá nhiều lần thử sai. Tài khoản bị khóa ${AUTH_CONFIG.lockoutMs / 60000} phút`);
            }
            throw new Error(data.message || 'Đăng nhập thất bại');
        }

        // Check role
        if (!AUTH_CONFIG.allowedRoles.includes(data.role)) {
            throw new Error('Tài khoản của bạn không được phép truy cập Dashboard');
        }

        // Lưu vào SecureStorage (sessionStorage) - KHÔNG lưu password
        SecureStorage.set('token', data.token);
        SecureStorage.set('user', JSON.stringify({
            userId: data.userId,
            username: data.username,
            displayName: data.displayName,
            role: data.role
        }));

        loginAttempts = 0;

        // Log login action (audit-log.js được load trước auth.js)
        if (typeof logAudit === 'function') {
            logAudit('LOGIN', 'SYSTEM', data.username, 'Đăng nhập thành công');
        } else if (typeof AuditLog !== 'undefined') {
            AuditLog.add({ action: 'LOGIN', target: 'SYSTEM', targetName: data.username, detail: 'Đăng nhập thành công' });
        }

        window.location.href = AUTH_CONFIG.dashboardPage;

    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        btnLogin.disabled = false;
        btnLogin.querySelector('.btn-text').style.display = 'inline';
        btnLogin.querySelector('.btn-loading').style.display = 'none';
    }
}

function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        if (icon) icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ==================== JWT UTILITIES ====================

/**
 * Decode JWT payload (không cần thư viện bên ngoài)
 */
function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

/**
 * Kiểm tra JWT đã hết hạn chưa
 */
function isTokenExpired(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return true;
    return (payload.exp * 1000) < Date.now();
}

/**
 * Lấy thời gian còn lại (ms) trước khi token hết hạn
 */
function getTokenExpiryMs(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return 0;
    return (payload.exp * 1000) - Date.now();
}

// ==================== AUTH GUARD (Dashboard Pages) ====================
if (document.getElementById('sidebar')) {
    checkAuth();
}

/**
 * Kiểm tra toàn diện: có token, token chưa hết hạn, role đúng
 */
function isAuthenticated() {
    const token = SecureStorage.get('token');
    const user = SecureStorage.getJSON('user');
    if (!token || !user) return false;
    if (!AUTH_CONFIG.allowedRoles.includes(user.role)) return false;
    if (isTokenExpired(token)) return false;

    // Double-check role từ JWT claims
    const payload = decodeJwtPayload(token);
    if (!payload || !AUTH_CONFIG.allowedRoles.includes(payload.role)) return false;

    return true;
}

function checkAuth() {
    if (!isAuthenticated()) {
        SecureStorage.clear();
        window.location.href = AUTH_CONFIG.loginPage;
        return;
    }

    const user = SecureStorage.getJSON('user');

    // Display username and role
    const nameEl = document.getElementById('current-user-name');
    if (nameEl) nameEl.textContent = user.displayName || user.username;

    const roleEl = document.querySelector('.user-role');
    if (roleEl) {
        const roleLabels = { admin2: 'Quản trị viên cấp 2', admin1: 'Quản trị viên cấp 1', user: 'Người dùng' };
        roleEl.textContent = roleLabels[user.role] || 'Người dùng';
    }

    // Ẩn/hiện các menu theo role
    applyRoleBasedUI(user.role);

    // Start session monitor
    startSessionMonitor();
}

/**
 * Ẩn/hiện UI elements theo role:
 * - admin2: thấy tất cả
 * - admin1: thấy Tổng quan + Quản lý Dự án
 * - user: thấy Tổng quan + Quản lý Dự án (chỉ dự án của mình)
 */
function applyRoleBasedUI(role) {
    // Sidebar nav items cần ẩn cho non-admin2
    const adminOnlyPages = ['page-users', 'page-audit-log', 'page-reports'];
    
    if (role !== 'admin2') {
        adminOnlyPages.forEach(pageId => {
            const navItem = document.querySelector(`[data-page="${pageId}"]`);
            if (navItem) navItem.style.display = 'none';
            const page = document.getElementById(pageId);
            if (page) page.style.display = 'none';
        });
    }

    // Đặt data attribute cho role để CSS/JS khác có thể sử dụng
    document.body.setAttribute('data-user-role', role);
}

/**
 * Monitor session: kiểm tra token hết hạn và cảnh báo trước khi hết
 */
function startSessionMonitor() {
    setInterval(() => {
        const token = SecureStorage.get('token');
        if (!token || isTokenExpired(token)) {
            showSessionExpiredAlert();
            return;
        }

        // Cảnh báo trước khi hết hạn
        const remainMs = getTokenExpiryMs(token);
        if (remainMs > 0 && remainMs <= AUTH_CONFIG.sessionWarningMs) {
            showSessionWarning(Math.ceil(remainMs / 60000));
        }
    }, AUTH_CONFIG.checkIntervalMs);
}

function showSessionWarning(minutes) {
    const warningEl = document.getElementById('session-warning');
    if (warningEl && warningEl.style.display !== 'flex') {
        const timeEl = document.getElementById('session-warning-time');
        if (timeEl) timeEl.textContent = minutes;
        warningEl.style.display = 'flex';
    }
}

function dismissSessionWarning() {
    const warningEl = document.getElementById('session-warning');
    if (warningEl) warningEl.style.display = 'none';
}

function showSessionExpiredAlert() {
    SecureStorage.clear();
    RequestCache.clear();
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        document.getElementById('loading-text').textContent = 'Phiên đăng nhập đã hết hạn. Đang chuyển hướng...';
        overlay.style.display = 'flex';
    }
    setTimeout(() => {
        window.location.href = AUTH_CONFIG.loginPage;
    }, 1500);
}

function getCurrentUser() {
    return SecureStorage.getJSON('user') || {};
}

/**
 * Kiểm tra user hiện tại có role cụ thể không
 */
function hasRole(role) {
    const user = getCurrentUser();
    return user.role === role;
}

function logout() {
    if (typeof logAudit === 'function') logAudit('LOGOUT', 'SYSTEM', getCurrentUser().username || 'admin', 'Đăng xuất');
    SecureStorage.clear();
    RequestCache.clear();
    window.location.href = AUTH_CONFIG.loginPage;
}
