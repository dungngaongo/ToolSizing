package com.example.demo.model;

/**
 * Enum định nghĩa các role trong hệ thống.
 * - user: Người dùng thường, chỉ có quyền xem và chỉnh sửa dữ liệu của mình
 * - admin1: Quản trị viên cấp 1, có quyền thẩm định dự án
 * - admin2: Quản trị viên cấp 2, có toàn quyền (quản lý user, phê duyệt dự án)
 */
public enum Role {
    user,
    admin1,
    admin2;

    /**
     * Kiểm tra một chuỗi có phải là role hợp lệ không.
     */
    public static boolean isValid(String role) {
        if (role == null) return false;
        try {
            Role.valueOf(role.toLowerCase());
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Parse chuỗi thành Role, trả về defaultRole nếu không hợp lệ.
     */
    public static Role fromString(String role, Role defaultRole) {
        if (role == null) return defaultRole;
        try {
            return Role.valueOf(role.toLowerCase());
        } catch (IllegalArgumentException e) {
            return defaultRole;
        }
    }
}
