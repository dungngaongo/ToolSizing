/**
 * users.js - Enhanced Quản lý User CRUD
 * Features: Pagination, event delegation, password strength, better validation
 */

let allUsers = [];
let filteredUsers = [];

// Paginator instance
const usersPaginator = new Paginator({
    containerId: 'pagination-users',
    pageSize: 10,
    onPageChange: () => renderUsersTable(filteredUsers)
});

async function loadUsers() {
    try {
        allUsers = await fetchAPI('/users');
        filteredUsers = [...allUsers];
        usersPaginator.reset();
        renderUsersTable(filteredUsers);
    } catch (error) {
        showToast('Lỗi tải danh sách user: ' + error.message, 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('tbody-users');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row"><div class="empty-state"><span class="empty-icon">👤</span><span>Không có user nào</span></div></td></tr>';
        const pgContainer = document.getElementById('pagination-users');
        if (pgContainer) pgContainer.innerHTML = '';
        return;
    }

    // Phân trang
    const pageItems = usersPaginator.paginate(users);

    tbody.innerHTML = pageItems.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${(u.username || '?').charAt(0).toUpperCase()}</div>
                    <span>${escapeHtml(u.username)}</span>
                </div>
            </td>
            <td>${escapeHtml(u.email || '')}</td>
            <td><span class="role-badge role-${(u.role || 'user').toLowerCase()}">${escapeHtml(u.role || 'user')}</span></td>
            <td class="actions-cell">
                <button class="btn-icon btn-icon-edit" title="Sửa"
                    data-action="edit-user" data-id="${u.id}">S</button>
                <button class="btn-icon btn-icon-delete" title="Xóa"
                    data-action="delete-user" data-id="${u.id}" data-name="${escapeHtml(u.username)}">X</button>
            </td>
        </tr>
    `).join('');
}

// ==================== EVENT DELEGATION cho user actions ====================
document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('table-users');
    if (table) {
        table.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const name = btn.dataset.name;

            if (action === 'edit-user') {
                editUser(id);
            } else if (action === 'delete-user') {
                deleteUser(id, name);
            }
        });
    }
});

function filterUsers() {
    const search = (document.getElementById('search-users').value || '').toLowerCase();
    const roleFilter = document.getElementById('filter-user-role').value;

    filteredUsers = allUsers;
    if (search) {
        filteredUsers = filteredUsers.filter(u =>
            (u.username || '').toLowerCase().includes(search) ||
            (u.email || '').toLowerCase().includes(search)
        );
    }
    if (roleFilter) {
        filteredUsers = filteredUsers.filter(u => (u.role || 'user').toLowerCase() === roleFilter);
    }

    usersPaginator.reset();
    renderUsersTable(filteredUsers);
}

// ==================== Modal User ====================
function openUserModal(userId) {
    const modal = document.getElementById('modal-user');
    const title = document.getElementById('modal-user-title');
    const form = document.getElementById('form-user');
    const passwordGroup = document.getElementById('group-user-password');

    form.reset();
    clearUserErrors();
    clearPasswordStrength();
    document.getElementById('form-user-id').value = '';

    if (userId) {
        // Edit mode
        const user = allUsers.find(u => u.id === userId || String(u.id) === String(userId));
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

// ==================== PASSWORD STRENGTH ====================
function onPasswordInput() {
    const password = document.getElementById('form-user-password').value;
    const strengthEl = document.getElementById('password-strength');
    if (!strengthEl) return;

    if (!password) {
        strengthEl.innerHTML = '';
        return;
    }

    const strength = getPasswordStrength(password);
    strengthEl.innerHTML = `
        <div class="strength-bar">
            <div class="strength-fill ${strength.cls}" style="width:${(strength.score / 5) * 100}%"></div>
        </div>
        <span class="strength-label ${strength.cls}">${strength.label}</span>
    `;
}

function clearPasswordStrength() {
    const el = document.getElementById('password-strength');
    if (el) el.innerHTML = '';
}

// Setup password input listener
document.addEventListener('DOMContentLoaded', () => {
    const pwInput = document.getElementById('form-user-password');
    if (pwInput) {
        pwInput.addEventListener('input', onPasswordInput);
    }
});

async function saveUser() {
    clearUserErrors();

    const id = document.getElementById('form-user-id').value;
    const username = document.getElementById('form-user-username').value.trim();
    const email = document.getElementById('form-user-email').value.trim();
    const password = document.getElementById('form-user-password').value;
    const role = document.getElementById('form-user-role').value;

    // --- Enhanced Validation ---
    let valid = true;

    // Username validation
    if (!username) {
        document.getElementById('err-user-username').textContent = 'Username không được để trống';
        valid = false;
    } else if (username.length < 3) {
        document.getElementById('err-user-username').textContent = 'Username phải ít nhất 3 ký tự';
        valid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        document.getElementById('err-user-username').textContent = 'Username chỉ chứa chữ cái, số và dấu gạch dưới';
        valid = false;
    }

    // Email validation
    if (!email) {
        document.getElementById('err-user-email').textContent = 'Email không được để trống';
        valid = false;
    } else if (!isValidEmail(email)) {
        document.getElementById('err-user-email').textContent = 'Email không hợp lệ';
        valid = false;
    }

    // Password validation
    if (!id && !password) {
        document.getElementById('err-user-password').textContent = 'Mật khẩu không được để trống';
        valid = false;
    } else if (password && password.length < 6) {
        document.getElementById('err-user-password').textContent = 'Mật khẩu phải ít nhất 6 ký tự';
        valid = false;
    }

    if (!valid) return;

    const btnSave = document.getElementById('btn-save-user');
    btnSave.disabled = true;
    btnSave.textContent = 'Đang lưu...';

    try {
        const body = { username, email, role };
        if (password) body.password = password;

        if (id) {
            await fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Cập nhật user thành công!', 'success');
            if (typeof logAudit === 'function') logAudit('UPDATE', 'USER', username, `Cập nhật user: role=${role}, email=${email}`);
        } else {
            await fetchAPI('/users', { method: 'POST', body: JSON.stringify(body) });
            showToast('Tạo user mới thành công!', 'success');
            if (typeof logAudit === 'function') logAudit('CREATE', 'USER', username, `Tạo user mới: role=${role}, email=${email}`);
        }

        closeUserModal();
        await loadUsers();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        // Hiển thị lỗi specific nếu có (ví dụ: duplicate username)
        if (error.status === 409 || (error.message && error.message.toLowerCase().includes('duplicate'))) {
            showToast('Username hoặc email đã tồn tại', 'error');
        } else {
            showToast('Lỗi: ' + error.message, 'error');
        }
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Lưu';
    }
}

async function deleteUser(id, username) {
    // Không cho phép xóa chính mình
    const currentUser = getCurrentUser();
    if (currentUser.username === username) {
        showToast('Không thể xóa tài khoản đang đăng nhập', 'warning');
        return;
    }

    const confirmed = await showConfirm(
        'Xóa User',
        `Bạn có chắc muốn xóa user <strong>${escapeHtml(username)}</strong>?<br>Thao tác này không thể hoàn tác.`
    );
    if (!confirmed) return;

    try {
        await fetchAPI(`/users/${id}`, { method: 'DELETE' });
        showToast(`Đã xóa user "${username}"`, 'success');
        if (typeof logAudit === 'function') logAudit('DELETE', 'USER', username, `Xóa user ID=${id}`);
        await loadUsers();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        showToast('Lỗi xóa user: ' + error.message, 'error');
    }
}
