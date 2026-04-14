(function setupDashboardUserStore(global) {
    if (global.DashboardUserStore) {
        return;
    }

    var state = {
        allUsers: [],
        filteredUsers: []
    };

    function setAll(users) {
        state.allUsers = Array.isArray(users) ? users : [];
        state.filteredUsers = state.allUsers.slice();
        return state.filteredUsers;
    }

    function setFiltered(users) {
        state.filteredUsers = Array.isArray(users) ? users : [];
        return state.filteredUsers;
    }

    function getAll() {
        return state.allUsers;
    }

    function getFiltered() {
        return state.filteredUsers;
    }

    function findById(userId) {
        return state.allUsers.find(function(user) {
            return user.id === userId || String(user.id) === String(userId);
        });
    }

    global.DashboardUserStore = {
        setAll: setAll,
        setFiltered: setFiltered,
        getAll: getAll,
        getFiltered: getFiltered,
        findById: findById
    };
})(window);
