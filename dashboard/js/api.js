/**
 * api.js - Enhanced API Service cho Admin Dashboard
 * Features: SecureStorage, RequestCache, ApiError, interceptors, retry, timeout
 */

const API_BASE = 'http://localhost:8085/api';


// ==================== API ERROR CLASS ====================
class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// ==================== SECURE STORAGE ====================
/**
 * Sử dụng sessionStorage thay vì localStorage để tăng bảo mật.
 * Dữ liệu tự động xóa khi đóng tab/trình duyệt.
 * Có prefix để tránh xung đột key.
 */
const SecureStorage = {
    _prefix: 'dash_',

    set(key, value) {
        try {
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            sessionStorage.setItem(this._prefix + key, data);
        } catch (e) {
            console.warn('SecureStorage set error:', e);
        }
    },

    get(key) {
        try {
            return sessionStorage.getItem(this._prefix + key);
        } catch (e) {
            return null;
        }
    },

    getJSON(key) {
        try {
            const raw = this.get(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    remove(key) {
        try {
            sessionStorage.removeItem(this._prefix + key);
        } catch (e) { /* ignore */ }
    },

    clear() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(this._prefix)) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => sessionStorage.removeItem(k));
        } catch (e) { /* ignore */ }
    }
};

// ==================== MIGRATE OLD STORAGE ====================
/**
 * One-time migration từ localStorage sang sessionStorage
 * Đảm bảo backward compatibility
 */
(function migrateFromLocalStorage() {
    try {
        const oldToken = localStorage.getItem('dashboard_token');
        const oldUser = localStorage.getItem('dashboard_user');
        if (oldToken) {
            SecureStorage.set('token', oldToken);
            localStorage.removeItem('dashboard_token');
        }
        if (oldUser) {
            SecureStorage.set('user', oldUser);
            localStorage.removeItem('dashboard_user');
        }
    } catch (e) { /* ignore */ }
})();

// ==================== REQUEST CACHE ====================
/**
 * Cache response cho GET requests để giảm tải server.
 * Có TTL (time-to-live) tự động.
 * Tự invalidate khi có mutation (POST/PUT/DELETE).
 */
const RequestCache = {
    _store: new Map(),
    _defaultTTL: 3 * 60 * 1000, // 3 phút

    set(key, data, ttl) {
        const cloned = JSON.parse(JSON.stringify(data)); // Deep clone
        this._store.set(key, {
            data: cloned,
            expiry: Date.now() + (ttl || this._defaultTTL)
        });
    },

    get(key) {
        const entry = this._store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiry) {
            this._store.delete(key);
            return undefined;
        }
        return JSON.parse(JSON.stringify(entry.data)); // Return deep clone
    },

    /**
     * Xóa cache entries có key chứa pattern
     */
    invalidate(pattern) {
        if (!pattern) { this._store.clear(); return; }
        for (const key of this._store.keys()) {
            if (key.includes(pattern)) this._store.delete(key);
        }
    },

    clear() {
        this._store.clear();
    }
};

// ==================== CORE FETCH FUNCTION ====================
/**
 * Enhanced fetch wrapper với:
 * - Tự động gắn JWT token
 * - Error handling tập trung (401, 403, network errors)
 * - Request caching (GET only)
 * - Auto-invalidate cache trên mutation
 * - Timeout & retry (GET only)
 * 
 * @param {string} endpoint - API endpoint (vd: '/users')
 * @param {Object} options - Fetch options + { useCache, cacheTTL, timeout, retries }
 */
async function fetchAPI(endpoint, options = {}) {
    const {
        useCache = false,
        cacheTTL,
        timeout = 15000,
        retries = 1,
        retryDelay = 1000,
        ...fetchOpts
    } = options;

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const method = (fetchOpts.method || 'GET').toUpperCase();

    // --- Cache check (chỉ GET) ---
    const cacheKey = method === 'GET' ? url : null;
    if (useCache && cacheKey) {
        const cached = RequestCache.get(cacheKey);
        if (cached !== undefined) return cached;
    }

    // --- Build headers với token ---
    const headers = {
        'Content-Type': 'application/json',
        ...(fetchOpts.headers || {})
    };
    const token = SecureStorage.get('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // --- Retry loop (chỉ retry GET requests) ---
    let lastError;
    const maxAttempts = method === 'GET' ? retries + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

        try {
            const response = await fetch(url, {
                ...fetchOpts,
                headers,
                signal: controller.signal
            });

            // --- Handle auth errors ---
            if (response.status === 401) {
                SecureStorage.clear();
                RequestCache.clear();
                window.location.href = 'login.html';
                throw new ApiError('Phiên đăng nhập hết hạn', 401);
            }

            if (response.status === 403) {
                throw new ApiError('Bạn không có quyền thực hiện thao tác này', 403);
            }

            // --- Parse response ---
            if (response.status === 204) return null;

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const errMsg = (data && (data.message || data.error)) || `Lỗi ${response.status}`;
                throw new ApiError(errMsg, response.status, data);
            }

            // --- Cache successful GET ---
            if (useCache && cacheKey) {
                RequestCache.set(cacheKey, data, cacheTTL);
            }

            // --- Invalidate related cache khi mutation ---
            if (method !== 'GET') {
                const resource = endpoint.split('/').filter(Boolean)[0];
                if (resource) RequestCache.invalidate(resource);
            }

            return data;

        } catch (error) {
            lastError = error;

            if (error.name === 'AbortError') {
                throw new ApiError('Yêu cầu đã hết thời gian chờ (timeout)', 408);
            }

            if (error instanceof ApiError) throw error;

            // Retry on network errors cho GET
            if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, retryDelay * attempt));
                continue;
            }

            if (error.name === 'TypeError') {
                throw new ApiError('Không thể kết nối đến server. Vui lòng kiểm tra backend.', 0);
            }
            throw error;

        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    throw lastError;
}

// ==================== CONVENIENCE API OBJECT ====================
const API = {
    get: (endpoint, opts) => fetchAPI(endpoint, { method: 'GET', ...opts }),
    post: (endpoint, body, opts) => fetchAPI(endpoint, { method: 'POST', body: JSON.stringify(body), ...opts }),
    put: (endpoint, body, opts) => fetchAPI(endpoint, { method: 'PUT', body: JSON.stringify(body), ...opts }),
    delete: (endpoint, opts) => fetchAPI(endpoint, { method: 'DELETE', ...opts }),
    cache: RequestCache,
    storage: SecureStorage
};
