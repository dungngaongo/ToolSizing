(function setupAdminSelectors(global) {
    if (global.AdminSelectors) {
        return;
    }

    global.AdminSelectors = {
        layout: {
            sidebar: 'sidebar',
            mainContent: 'main-content',
            pageTitle: 'page-title',
            headerTime: 'header-time'
        },
        pages: {
            dashboard: 'page-dashboard',
            users: 'page-users',
            projects: 'page-projects',
            auditLog: 'page-audit-log',
            reports: 'page-reports'
        },
        containers: {
            toast: 'toast-container',
            loadingOverlay: 'loading-overlay',
            loadingText: 'loading-text'
        }
    };
})(window);
