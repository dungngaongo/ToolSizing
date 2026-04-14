(function setupAdminFacade(global) {
    const app = global.AdminApp || (global.AdminApp = {});

    app.version = 'phase-1-facade';

    app.navigation = {
        navigateTo: (...args) => global.navigateTo?.(...args),
        toggleSidebar: (...args) => global.toggleSidebar?.(...args)
    };

    app.users = {
        openUserModal: (...args) => global.openUserModal?.(...args),
        saveUser: (...args) => global.saveUser?.(...args),
        deleteUser: (...args) => global.deleteUser?.(...args)
    };

    app.projects = {
        refreshProjects: (...args) => global.refreshProjects?.(...args),
        saveAssignAdmin1: (...args) => global.saveAssignAdmin1?.(...args)
    };

    app.ui = {
        showToast: (...args) => global.showToast?.(...args),
        showConfirm: (...args) => global.showConfirm?.(...args),
        showLoading: (...args) => global.showLoading?.(...args)
    };

    app.auth = {
        logout: (...args) => global.logout?.(...args),
        getCurrentUser: (...args) => global.getCurrentUser?.(...args)
    };
})(window);
