/**
 * api.js - Fetch wrapper cho Admin Dashboard
 * Base URL trỏ đến backend Spring Boot (port 8081)
 */

const API_BASE = 'http://localhost:8081/api';

/**
 * Gọi API với JWT tự động
 */
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('dashboard_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // 401 - Unauthorized
        if (response.status === 401) {
            localStorage.removeItem('dashboard_token');
            localStorage.removeItem('dashboard_user');
            window.location.href = 'login.html';
            throw new Error('Phiên đăng nhập hết hạn');
        }

        // 403 - Forbidden
        if (response.status === 403) {
            throw new Error('Bạn không có quyền thực hiện thao tác này');
        }

        // Parse response
        if (response.status === 204) return null; // No Content

        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            const errMsg = (data && (data.message || data.error)) || `Lỗi ${response.status}`;
            throw new Error(errMsg);
        }

        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.');
        }
        throw error;
    }
}
