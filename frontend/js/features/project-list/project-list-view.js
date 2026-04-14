(function setupSizingProjectListView(global) {
    if (global.SizingProjectListView) {
        return;
    }

    function renderProjectList(projects, options) {
        var opts = options || {};
        var tbody = document.getElementById('project-list-body');
        if (!tbody) return;

        var rows = Array.isArray(projects) ? projects : [];
        tbody.innerHTML = '';

        rows.forEach(function(project, index) {
            var tr = document.createElement('tr');
            var projectId = String(project.id || '');
            var safeProjectId = projectId.replace(/"/g, '&quot;');
            var safeProjectNameAttr = String(project.name || '').replace(/"/g, '&quot;');
            tr.setAttribute('data-project-id', safeProjectId);

            var createdDate = project.createdAt && typeof opts.formatDate === 'function'
                ? opts.formatDate(project.createdAt)
                : 'N/A';
            var modifiedDate = project.updatedAt && typeof opts.formatDate === 'function'
                ? opts.formatDate(project.updatedAt)
                : 'N/A';
            var statusClass = typeof opts.getStatusClass === 'function'
                ? opts.getStatusClass(project.status)
                : 'sizing';
            var statusText = typeof opts.getStatusText === 'function'
                ? opts.getStatusText(project.status, project.statusRound)
                : (project.status || 'N/A');

            var safeName = typeof global.escapeHtml === 'function'
                ? global.escapeHtml(project.name || 'Chua co ten')
                : (project.name || 'Chua co ten');
            var safeDevUnit = typeof global.escapeHtml === 'function'
                ? global.escapeHtml(project.devUnit || 'N/A')
                : (project.devUnit || 'N/A');
            var safeOwner = typeof global.escapeHtml === 'function'
                ? global.escapeHtml(project.ownerName || 'Chua xac dinh')
                : (project.ownerName || 'Chua xac dinh');

            tr.innerHTML = '\n            <td>' + (index + 1) + '</td>\n            <td class="project-name-cell">' + safeName + '</td>\n            <td>' + safeDevUnit + '</td>\n            <td>' + safeOwner + '</td>\n            <td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>\n            <td class="date-cell">' + createdDate + '</td>\n            <td class="date-cell">' + modifiedDate + '</td>\n            <td>\n                <div class="project-actions">\n                    <button class="btn-action view" type="button" title="Xem chi tiet" data-action="open-project" data-project-id="' + safeProjectId + '">\n                        <i class="fa-solid fa-eye"></i>\n                    </button>\n                    <button class="btn-action delete" type="button" title="Xoa du an" data-action="delete-project" data-project-id="' + safeProjectId + '" data-project-name="' + safeProjectNameAttr + '">\n                        <i class="fa-solid fa-trash"></i>\n                    </button>\n                </div>\n            </td>';

            tbody.appendChild(tr);
        });
    }

    global.SizingProjectListView = {
        renderProjectList: renderProjectList
    };
})(window);
