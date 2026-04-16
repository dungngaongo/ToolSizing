package com.example.sizing.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

@RestController
public class VulnerableController {

    // Sonar sẽ bắt lỗi: Hardcoded password
    private static final String DB_USER = "admin";
    private static final String DB_PASS = "P@ssw0rd123!";

    @GetMapping("/search-user")
    public List<String> searchUser(@RequestParam String userId) {
        List<String> users = new ArrayList<>();

        try {
            // Sonar sẽ bắt lỗi: Kết nối DB không an toàn hoặc lộ thông tin cấu hình
            Connection conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/mydb", DB_USER, DB_PASS);
            Statement statement = conn.createStatement();

            // LỖI TRỌNG TÂM: SQL Injection qua cộng chuỗi trực tiếp từ RequestParam
            String sql = "SELECT username FROM users WHERE id = '" + userId + "'";

            ResultSet rs = statement.executeQuery(sql);
            while (rs.next()) {
                users.add(rs.getString("username"));
            }
        } catch (Exception e) {
            // Sonar sẽ bắt lỗi: Information Exposure qua printStackTrace
            e.printStackTrace();
        }
        return users;
    }
}