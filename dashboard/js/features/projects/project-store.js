(function setupDashboardProjectStore(global) {
    if (global.DashboardProjectStore) {
        return;
    }

    var state = {
        allProjects: [],
        filteredProjects: [],
        admin1UsersList: []
    };

    function setAllProjects(projects) {
        state.allProjects = Array.isArray(projects) ? projects : [];
        state.filteredProjects = state.allProjects.slice();
        return state.filteredProjects;
    }

    function setFilteredProjects(projects) {
        state.filteredProjects = Array.isArray(projects) ? projects : [];
        return state.filteredProjects;
    }

    function getAllProjects() {
        return state.allProjects;
    }

    function getFilteredProjects() {
        return state.filteredProjects;
    }

    function setAdmin1Users(users) {
        state.admin1UsersList = Array.isArray(users) ? users : [];
        return state.admin1UsersList;
    }

    function getAdmin1Users() {
        return state.admin1UsersList;
    }

    function findProjectById(projectId) {
        return state.allProjects.find(function(project) {
            return project.id === projectId || String(project.id) === String(projectId);
        });
    }

    function findAdmin1ById(admin1Id) {
        return state.admin1UsersList.find(function(user) {
            return user.id === admin1Id;
        });
    }

    global.DashboardProjectStore = {
        setAllProjects: setAllProjects,
        setFilteredProjects: setFilteredProjects,
        getAllProjects: getAllProjects,
        getFilteredProjects: getFilteredProjects,
        setAdmin1Users: setAdmin1Users,
        getAdmin1Users: getAdmin1Users,
        findProjectById: findProjectById,
        findAdmin1ById: findAdmin1ById
    };
})(window);
