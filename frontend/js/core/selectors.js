(function setupSizingSelectors(global) {
    if (global.SizingSelectors) {
        return;
    }

    global.SizingSelectors = {
        pages: {
            list: 'project-list-page',
            detail: 'project-detail-page',
            request: 'page-request',
            input: 'page-input',
            model: 'page-model',
            sizing: 'page-sizing',
            summary: 'page-summary'
        },
        buttons: {
            backToList: 'btn-back-to-list',
            versionHistory: 'btn-version-history'
        },
        tables: {
            baselineBody: 'baseline-table-body',
            connectionBody: 'connection-info-table-body',
            archBody: 'arch-table-body',
            inputConfigBody: 'input-config-table-body'
        }
    };
})(window);
