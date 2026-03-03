/**
 * auth.js - Xác thực & guard cho Admin Dashboard
 * Chỉ cho phép role admin2 truy cập
 */

// ==================== LOGIN PAGE LOGIC ====================
if (document.getElementById('login-form')) {
    initLoginPage();
}

function initLoginPage() {
    // Nếu đã login và là admin2 → redirect dashboard
    const token = localStorage.getItem('dashboard_token');
    const user = JSON.parse(localStorage.getItem('dashboard_user') || 'null');
    if (token && user && user.role === 'admin2') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

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

    // Validate
    let valid = true;
    if (!username) {
        document.getElementById('error-username').textContent = 'Vui lòng nhập tên đăng nhập';
        valid = false;
    }
    if (!password) {
        document.getElementById('error-password').textContent = 'Vui lòng nhập mật khẩu';
        valid = false;
    }
    if (!valid) return;

    // Loading state
    btnLogin.disabled = true;
    btnLogin.querySelector('.btn-text').style.display = 'none';
    btnLogin.querySelector('.btn-loading').style.display = 'inline';

    try {
        const API_BASE = 'http://localhost:8081/api';
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Đăng nhập thất bại');
        }

        // Check role
        if (data.role !== 'admin2') {
            throw new Error('Chỉ tài khoản admin2 mới được phép truy cập Dashboard');
        }

        // Save token & user info
        localStorage.setItem('dashboard_token', data.token);
        localStorage.setItem('dashboard_user', JSON.stringify({
            username: data.username,
            displayName: data.displayName,
            role: data.role
        }));

        window.location.href = 'index.html';

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
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ==================== DASHBOARD AUTH GUARD ====================
if (document.getElementById('sidebar')) {
    checkAuth();
}

/**
 * Decode JWT payload (không cần thư viện bên ngoài)
 */
function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
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
    // exp là Unix timestamp (seconds), so sánh với thời gian hiện tại
    return (payload.exp * 1000) < Date.now();
}

function checkAuth() {
    const token = localStorage.getItem('dashboard_token');
    const user = JSON.parse(localStorage.getItem('dashboard_user') || 'null');

    // Kiểm tra: có token, có user, role đúng, và token chưa hết hạn
    if (!token || !user || user.role !== 'admin2' || isTokenExpired(token)) {
        localStorage.removeItem('dashboard_token');
        localStorage.removeItem('dashboard_user');
        window.location.href = 'login.html';
        return;
    }

    // Kiểm tra role từ JWT claims (double-check)
    const payload = decodeJwtPayload(token);
    if (!payload || payload.role !== 'admin2') {
        localStorage.removeItem('dashboard_token');
        localStorage.removeItem('dashboard_user');
        window.location.href = 'login.html';
        return;
    }

    // Display username
    const nameEl = document.getElementById('current-user-name');
    if (nameEl) nameEl.textContent = user.displayName || user.username;

    // Auto-check token expiry mỗi phút
    setInterval(() => {
        const t = localStorage.getItem('dashboard_token');
        if (!t || isTokenExpired(t)) {
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            logout();
        }
    }, 60000);
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('dashboard_user') || '{}');
}

function logout() {
    localStorage.removeItem('dashboard_token');
    localStorage.removeItem('dashboard_user');
    window.location.href = 'login.html';
}
