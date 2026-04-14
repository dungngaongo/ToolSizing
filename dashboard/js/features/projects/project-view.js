(function setupDashboardProjectView(global) {
    if (global.DashboardProjectView) {
        return;
    }

    function renderProjectsTable(projects, paginator, options) {
        var opts = options || {};
        var tbody = document.getElementById('tbody-projects');
        if (!tbody) return;

        var isAdmin2 = !!opts.isAdmin2;

        if (!projects || projects.length === 0) {
            var colspan = isAdmin2 ? 8 : 7;
            tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="empty-row"><div class="empty-state"><span class="empty-icon">📁</span><span>Khong co du an nao</span></div></td></tr>';
            var pgContainer = document.getElementById('pagination-projects');
            if (pgContainer) pgContainer.innerHTML = '';
            return;
        }

        var pageItems = paginator ? paginator.paginate(projects) : projects;

        tbody.innerHTML = pageItems.map(function(project) {
            var assignedName = typeof opts.getAssignedAdmin1Name === 'function'
                ? opts.getAssignedAdmin1Name(project.assignedAdmin1Id)
                : null;

            var assignBadge = assignedName
                ? '<span class="badge badge-info" title="Nguoi tham dinh">' + (typeof global.escapeHtml === 'function' ? global.escapeHtml(assignedName) : assignedName) + '</span>'
                : '<span class="badge badge-secondary">Chua chi dinh</span>';

            var safeName = typeof global.escapeHtml === 'function' ? global.escapeHtml(project.name || '') : (project.name || '');
            var safeDevUnit = typeof global.escapeHtml === 'function' ? global.escapeHtml(project.devUnit || '-') : (project.devUnit || '-');
            var safeOwner = typeof global.escapeHtml === 'function' ? global.escapeHtml(project.ownerName || '-') : (project.ownerName || '-');

            var actionButtons = '';
            if (isAdmin2) {
                actionButtons += '\n                    <button class="btn-icon btn-icon-assign" title="Chi dinh tham dinh"\n                        data-action="assign-project" data-id="' + project.id + '" data-name="' + safeName + '"\n                        data-assigned="' + (project.assignedAdmin1Id || '') + '">⇄</button>';
            }

            if (project.status === 'THAM_DINH' || project.status === 'PHE_DUYET') {
                actionButtons += '\n                    <button class="btn-icon btn-icon-approve" title="Phe duyet nhanh"\n                        data-action="approve-project" data-id="' + project.id + '" data-name="' + safeName + '">D</button>';
            }

            if (isAdmin2) {
                actionButtons += '\n                    <button class="btn-icon btn-icon-delete" title="Xoa"\n                        data-action="delete-project" data-id="' + project.id + '" data-name="' + safeName + '">X</button>';
            }

            var statusHtml = typeof global.getStatusBadge === 'function' ? global.getStatusBadge(project.status) : (project.status || '-');
            var createdAt = typeof global.formatDate === 'function' ? global.formatDate(project.createdAt) : (project.createdAt || '-');

            return '\n            <tr>\n                <td>' + safeName + '</td>\n                <td>' + safeDevUnit + '</td>\n                <td>' + safeOwner + '</td>\n                <td>' + statusHtml + '</td>\n                <td class="text-center">' + (project.statusRound || 1) + '</td>\n                <td>' + createdAt + '</td>\n                ' + (isAdmin2 ? ('<td>' + assignBadge + '</td>') : '') + '\n                <td class="actions-cell">' + actionButtons + '\n                </td>\n            </tr>';
        }).join('');

        if (typeof opts.updateProjectTableHeader === 'function') {
            opts.updateProjectTableHeader(isAdmin2);
        }
    }

    global.DashboardProjectView = {
        renderProjectsTable: renderProjectsTable
    };
})(window);
