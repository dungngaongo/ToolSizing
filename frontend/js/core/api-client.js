(function setupSizingCoreApi(global) {
    if (global.SizingCoreApi) {
        return;
    }

    async function parseApiError(response) {
        try {
            var contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                var body = await response.json();
                if (body.validationErrors && Object.keys(body.validationErrors).length > 0) {
                    var validationMsgs = Object.entries(body.validationErrors)
                        .map(function(entry) {
                            return entry[0] + ': ' + entry[1];
                        })
                        .join(', ');
                    return (body.message || 'Loi validation') + ': ' + validationMsgs;
                }
                return body.message || body.error || ('Loi ' + response.status);
            }

            var text = await response.text();
            return text || ('Loi ' + response.status);
        } catch (error) {
            return 'Loi ' + response.status + ': ' + response.statusText;
        }
    }

    async function fetchAPI(url, options, config) {
        var opts = options || {};
        var cfg = config || {};
        var showError = !!cfg.showError;
        var showLoadingOverlay = !!cfg.showLoadingOverlay;
        var loadingMessage = cfg.loadingMessage || 'Dang xu ly...';

        if (showLoadingOverlay && typeof global.showLoading === 'function') {
            global.showLoading(true, loadingMessage);
        }

        var authHeaders = global.SizingCoreAuth && typeof global.SizingCoreAuth.getAuthHeaders === 'function'
            ? global.SizingCoreAuth.getAuthHeaders()
            : {};

        opts.headers = Object.assign({}, authHeaders, opts.headers || {});

        try {
            var response = await fetch(url, opts);

            if (showLoadingOverlay && typeof global.showLoading === 'function') {
                global.showLoading(false);
            }

            var unauthorized = global.SizingCoreAuth && typeof global.SizingCoreAuth.handleUnauthorized === 'function'
                ? global.SizingCoreAuth.handleUnauthorized(response)
                : false;

            if (unauthorized) {
                throw new Error('Unauthorized');
            }

            if (!response.ok && showError && typeof global.showToast === 'function') {
                var errorMsg = await parseApiError(response.clone());
                global.showToast(errorMsg, 'error', 5000);
            }

            return response;
        } catch (error) {
            if (showLoadingOverlay && typeof global.showLoading === 'function') {
                global.showLoading(false);
            }

            if (error.message !== 'Unauthorized' && showError && typeof global.showToast === 'function') {
                global.showToast('Loi ket noi: Khong the lien lac voi may chu. Vui long kiem tra ket noi mang.', 'error', 5000);
            }

            throw error;
        }
    }

    global.SizingCoreApi = {
        parseApiError: parseApiError,
        fetchAPI: fetchAPI
    };
})(window);
