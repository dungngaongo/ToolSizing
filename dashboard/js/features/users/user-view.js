(function setupDashboardUserView(global) {
    if (global.DashboardUserView) {
        return;
    }

    function renderUsersTable(users, paginator) {
        var tbody = document.getElementById('tbody-users');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row"><div class="empty-state"><span class="empty-icon">👤</span><span>Khong co user nao</span></div></td></tr>';
            var pgContainer = document.getElementById('pagination-users');
            if (pgContainer) pgContainer.innerHTML = '';
            return;
        }

        var pageItems = paginator ? paginator.paginate(users) : users;

        tbody.innerHTML = pageItems.map(function(user) {
            var username = user.username || '?';
            var role = (user.role || 'user').toLowerCase();
            var safeUsername = typeof global.escapeHtml === 'function' ? global.escapeHtml(user.username) : (user.username || '');
            var safeEmail = typeof global.escapeHtml === 'function' ? global.escapeHtml(user.email || '') : (user.email || '');
            var safeRole = typeof global.escapeHtml === 'function' ? global.escapeHtml(user.role || 'user') : (user.role || 'user');

            return '\n        <tr>\n            <td>\n                <div class="user-cell">\n                    <div class="user-cell-avatar">' + username.charAt(0).toUpperCase() + '</div>\n                    <span>' + safeUsername + '</span>\n                </div>\n            </td>\n            <td>' + safeEmail + '</td>\n            <td><span class="role-badge role-' + role + '">' + safeRole + '</span></td>\n            <td class="actions-cell">\n                <button class="btn-icon btn-icon-edit" title="Sua"\n                    data-action="edit-user" data-id="' + user.id + '">S</button>\n                <button class="btn-icon btn-icon-delete" title="Xoa"\n                    data-action="delete-user" data-id="' + user.id + '" data-name="' + safeUsername + '">X</button>\n            </td>\n        </tr>';
        }).join('');
    }

    global.DashboardUserView = {
        renderUsersTable: renderUsersTable
    };
})(window);
