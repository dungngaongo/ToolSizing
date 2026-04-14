(function setupSizingFacade(global) {
    const app = global.SizingApp || (global.SizingApp = {});

    app.version = 'phase-1-facade';

    app.actions = {
        showProjectList: (...args) => global.showProjectList?.(...args),
        openProject: (...args) => global.openProject?.(...args),
        startNewProject: (...args) => global.startNewProject?.(...args),
        deleteProject: (...args) => global.deleteProject?.(...args),
        performManualSave: (...args) => global.performManualSave?.(...args),
        exportToWord: (...args) => global.exportToWord?.(...args)
    };

    app.ui = {
        showToast: (...args) => global.showToast?.(...args),
        showLoading: (...args) => global.showLoading?.(...args),
        showConfirm: (...args) => global.showConfirm?.(...args)
    };

    app.auth = {
        logout: (...args) => global.logout?.(...args),
        getCurrentUser: (...args) => global.getCurrentUser?.(...args)
    };
})(window);
