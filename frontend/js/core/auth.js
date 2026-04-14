(function setupSizingCoreAuth(global) {
    if (global.SizingCoreAuth) {
        return;
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
        var token = localStorage.getItem('authToken');
        var headers = {};
        if (token) {
            headers.Authorization = 'Bearer ' + token;
        }
        return headers;
    }

    function checkAuthStatus() {
        var isLoggedIn = localStorage.getItem('isLoggedIn');
        var displayName = localStorage.getItem('displayName');

        var userInfo = document.getElementById('user-info');
        var loginLink = document.getElementById('login-link');
        var userDisplayName = document.getElementById('user-display-name');

        if (isLoggedIn === 'true' && displayName) {
            if (userInfo) userInfo.style.display = 'flex';
            if (loginLink) loginLink.style.display = 'none';
            if (userDisplayName) userDisplayName.textContent = displayName;
        } else {
            if (userInfo) userInfo.style.display = 'none';
            if (loginLink) loginLink.style.display = 'inline';
        }
    }

    function clearAuthState() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('userId');
    }

    async function logout() {
        var confirmed;
        if (typeof global.showConfirm === 'function') {
            confirmed = await global.showConfirm(
                'Dang xuat',
                'Ban co chac muon dang xuat khoi he thong?',
                { confirmText: 'Dang xuat', cancelText: 'Huy' }
            );
        } else {
            confirmed = global.confirm('Ban co chac muon dang xuat khoi he thong?');
        }

        if (!confirmed) {
            return;
        }

        clearAuthState();
        if (typeof global.clearProjectIds === 'function') {
            global.clearProjectIds();
        }
        global.location.href = 'login.html';
    }

    function handleUnauthorized(response) {
        if (response.status === 401) {
            if (typeof global.showToast === 'function') {
                global.showToast('Phien dang nhap da het han. Vui long dang nhap lai.', 'warning', 4000);
            }
            clearAuthState();
            setTimeout(function() {
                global.location.href = 'login.html';
            }, 1500);
            return true;
        }

        if (response.status === 403) {
            if (typeof global.showToast === 'function') {
                global.showToast('Ban khong co quyen thuc hien thao tac nay.', 'error', 4000);
            }
            return false;
        }

        return false;
    }

    global.SizingCoreAuth = {
        getCurrentUser: getCurrentUser,
        getAuthHeaders: getAuthHeaders,
        checkAuthStatus: checkAuthStatus,
        logout: logout,
        handleUnauthorized: handleUnauthorized,
        clearAuthState: clearAuthState
    };
})(window);
