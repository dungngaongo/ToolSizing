(function setupAdminUiFeedback(global) {
    if (global.AdminUiFeedback) {
        return;
    }

    function getAdminSelectorId(group, key, fallbackId) {
        return global.AdminSelectors && global.AdminSelectors[group] && global.AdminSelectors[group][key]
            ? global.AdminSelectors[group][key]
            : fallbackId;
    }

    function removeToast(toast) {
        if (!toast) return;
        toast.classList.remove('show');
        setTimeout(function() {
            toast.remove();
        }, 300);
    }

    function showToast(message, type, duration) {
        var toastType = type || 'info';
        var toastDuration = duration || 4000;
        var container = document.getElementById(getAdminSelectorId('containers', 'toast', 'toast-container'));
        if (!container) return;

        var icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        while (container.children.length >= 5) {
            container.firstChild.remove();
        }

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + toastType;
        toast.setAttribute('role', 'alert');
        var safeMessage = typeof global.escapeHtml === 'function' ? global.escapeHtml(message) : String(message || '');
        toast.innerHTML =
            '<span class="toast-icon">' + (icons[toastType] || icons.info) + '</span>' +
            '<span class="toast-message">' + safeMessage + '</span>' +
            '<button class="toast-close" data-action="close-toast" aria-label="Dong">&times;</button>';

        container.appendChild(toast);
        requestAnimationFrame(function() {
            toast.classList.add('show');
        });

        var autoTimer = setTimeout(function() {
            removeToast(toast);
        }, toastDuration);

        toast.addEventListener('mouseenter', function() {
            clearTimeout(autoTimer);
        });
        toast.addEventListener('mouseleave', function() {
            autoTimer = setTimeout(function() {
                removeToast(toast);
            }, 1500);
        });
    }

    var confirmResolve = null;

    function showConfirm(title, message) {
        return new Promise(function(resolve) {
            confirmResolve = resolve;
            var titleEl = document.getElementById('confirm-title');
            var messageEl = document.getElementById('confirm-message');
            var modal = document.getElementById('modal-confirm');
            if (!modal || !titleEl || !messageEl) {
                resolve(global.confirm(message || title || 'Xac nhan'));
                return;
            }

            titleEl.textContent = title;
            messageEl.innerHTML = message;
            modal.style.display = 'flex';
            setTimeout(function() {
                var okBtn = document.getElementById('btn-confirm-ok');
                if (okBtn) okBtn.focus();
            }, 100);
        });
    }

    function closeConfirm(result) {
        var modal = document.getElementById('modal-confirm');
        if (modal) {
            modal.style.display = 'none';
        }
        if (confirmResolve) {
            confirmResolve(result);
            confirmResolve = null;
        }
    }

    function showLoading(show, text) {
        var overlay = document.getElementById(getAdminSelectorId('containers', 'loadingOverlay', 'loading-overlay'));
        if (!overlay) return;

        if (show) {
            if (text) {
                var loadingText = document.getElementById(getAdminSelectorId('containers', 'loadingText', 'loading-text'));
                if (loadingText) loadingText.textContent = text;
            }
            overlay.style.display = 'flex';
            return;
        }

        overlay.style.display = 'none';
    }

    function showInlineLoading(containerId, show) {
        var shouldShow = show !== false;
        var container = document.getElementById(containerId);
        if (!container) return;

        var existing = container.querySelector('.inline-loader');
        if (shouldShow && !existing) {
            var loader = document.createElement('div');
            loader.className = 'inline-loader';
            loader.innerHTML = '<div class="spinner"></div>';
            container.appendChild(loader);
            return;
        }

        if (!shouldShow && existing) {
            existing.remove();
        }
    }

    global.AdminUiFeedback = {
        showToast: showToast,
        removeToast: removeToast,
        showConfirm: showConfirm,
        closeConfirm: closeConfirm,
        showLoading: showLoading,
        showInlineLoading: showInlineLoading
    };
})(window);
