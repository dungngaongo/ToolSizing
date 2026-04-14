(function setupSizingState(global) {
    if (global.SizingState) {
        return;
    }

    var state = {
        currentProjectId: localStorage.getItem('currentProjectId') || null,
        currentProjectDataId: localStorage.getItem('currentProjectDataId') || null,
        currentProjectStatus: null,
        currentProjectStatusRound: 1,
        allProjects: []
    };

    function get(key) {
        return state[key];
    }

    function set(key, value) {
        state[key] = value;
        return value;
    }

    function setProjectId(id) {
        state.currentProjectId = id || null;
        if (id) {
            localStorage.setItem('currentProjectId', id);
        } else {
            localStorage.removeItem('currentProjectId');
        }
        return state.currentProjectId;
    }

    function setProjectDataId(id) {
        state.currentProjectDataId = id || null;
        if (id) {
            localStorage.setItem('currentProjectDataId', id);
        } else {
            localStorage.removeItem('currentProjectDataId');
        }
        return state.currentProjectDataId;
    }

    function clearProjectSelection() {
        setProjectId(null);
        setProjectDataId(null);
    }

    function setStatus(status, round) {
        state.currentProjectStatus = status || null;
        state.currentProjectStatusRound = Number.isFinite(round) && round > 0 ? round : 1;
    }

    function setProjects(projects) {
        state.allProjects = Array.isArray(projects) ? projects : [];
        return state.allProjects;
    }

    global.SizingState = {
        get: get,
        set: set,
        setProjectId: setProjectId,
        setProjectDataId: setProjectDataId,
        clearProjectSelection: clearProjectSelection,
        setStatus: setStatus,
        setProjects: setProjects
    };
})(window);
