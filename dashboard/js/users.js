/**
 * users.js - Quản lý User CRUD
 */

let allUsers = [];

async function loadUsers() {
    try {
        allUsers = await fetchAPI('/users');
        renderUsersTable(allUsers);
    } catch (error) {
        showToast('Lỗi tải danh sách user: ' + error.message, 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('tbody-users');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row"><i class="fas fa-inbox"></i> Không có user nào</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${u.username.charAt(0).toUpperCase()}</div>
                    <span>${escapeHtml(u.username)}</span>
                </div>
            </td>
            <td>${escapeHtml(u.email || '')}</td>
            <td><span class="role-badge role-${(u.role||'user').toLowerCase()}">${escapeHtml(u.role || 'user')}</span></td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-edit" title="Sửa" onclick="editUser('${u.id}')">
                    <i class="fas fa-pen-to-square"></i>
                </button>
                <button class="btn-icon btn-icon-delete" title="Xóa" onclick="deleteUser('${u.id}', '${escapeHtml(u.username)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const search = (document.getElementById('search-users').value || '').toLowerCase();
    const roleFilter = document.getElementById('filter-user-role').value;

    let filtered = allUsers;
    if (search) {
        filtered = filtered.filter(u =>
            (u.username || '').toLowerCase().includes(search) ||
            (u.email || '').toLowerCase().includes(search)
        );
    }
    if (roleFilter) {
        filtered = filtered.filter(u => (u.role || 'user').toLowerCase() === roleFilter);
    }
    renderUsersTable(filtered);
}

// ==================== Modal User ====================
function openUserModal(userId) {
    const modal = document.getElementById('modal-user');
    const title = document.getElementById('modal-user-title');
    const form = document.getElementById('form-user');
    const passwordGroup = document.getElementById('group-user-password');

    form.reset();
    clearUserErrors();
    document.getElementById('form-user-id').value = '';

    if (userId) {
        // Edit mode
        const user = allUsers.find(u => u.id === userId);
        if (!user) return;
        title.textContent = 'Chỉnh sửa User';
        document.getElementById('form-user-id').value = user.id;
        document.getElementById('form-user-username').value = user.username;
        document.getElementById('form-user-email').value = user.email || '';
        document.getElementById('form-user-role').value = user.role || 'user';
        document.getElementById('form-user-password').removeAttribute('required');
        passwordGroup.querySelector('label .required').style.display = 'none';
        document.getElementById('form-user-password').placeholder = 'Để trống nếu không đổi mật khẩu';
    } else {
        // Create mode
        title.textContent = 'Tạo User mới';
        document.getElementById('form-user-password').setAttribute('required', 'required');
        passwordGroup.querySelector('label .required').style.display = 'inline';
        document.getElementById('form-user-password').placeholder = 'Nhập mật khẩu';
    }

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('form-user-username').focus(), 100);
}

function closeUserModal() {
    document.getElementById('modal-user').style.display = 'none';
}

function editUser(id) {
    openUserModal(id);
}

function clearUserErrors() {
    document.getElementById('err-user-username').textContent = '';
    document.getElementById('err-user-email').textContent = '';
    document.getElementById('err-user-password').textContent = '';
}

async function saveUser() {
    clearUserErrors();

    const id = document.getElementById('form-user-id').value;
    const username = document.getElementById('form-user-username').value.trim();
    const email = document.getElementById('form-user-email').value.trim();
    const password = document.getElementById('form-user-password').value;
    const role = document.getElementById('form-user-role').value;

    // Validate
    let valid = true;
    if (!username) {
        document.getElementById('err-user-username').textContent = 'Username không được để trống';
        valid = false;
    }
    if (!email) {
        document.getElementById('err-user-email').textContent = 'Email không được để trống';
        valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('err-user-email').textContent = 'Email không hợp lệ';
        valid = false;
    }
    if (!id && !password) {
        document.getElementById('err-user-password').textContent = 'Mật khẩu không được để trống';
        valid = false;
    }
    if (!valid) return;

    const btnSave = document.getElementById('btn-save-user');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    try {
        const body = { username, email, role };
        if (password) body.password = password;

        if (id) {
            await fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Cập nhật user thành công!', 'success');
        } else {
            await fetchAPI('/users', { method: 'POST', body: JSON.stringify(body) });
            showToast('Tạo user mới thành công!', 'success');
        }

        closeUserModal();
        await loadUsers();
        // Update dashboard stats
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Lưu';
    }
}

async function deleteUser(id, username) {
    const confirmed = await showConfirm(
        'Xóa User',
        `Bạn có chắc muốn xóa user <strong>${escapeHtml(username)}</strong>?<br>Thao tác này không thể hoàn tác.`
    );
    if (!confirmed) return;

    try {
        await fetchAPI(`/users/${id}`, { method: 'DELETE' });
        showToast(`Đã xóa user "${username}"`, 'success');
        await loadUsers();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Lỗi xóa user: ' + error.message, 'error');
    }
}
