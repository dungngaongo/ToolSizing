package com.example.demo.controller;

import com.example.demo.dto.LoginRequest;
import com.example.demo.dto.LoginResponse;
import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Optional<User> u = userService.authenticate(request.getUsername(), request.getPassword());
        if (u.isEmpty()) {
            return ResponseEntity.status(401).body(java.util.Map.of("message", "Invalid username or password"));
        }
        User user = u.get();
        String role = user.getRole() == null ? "user" : user.getRole();
        String token = com.example.demo.security.JwtUtil.generateToken(user.getUsername(), role);
        return ResponseEntity.ok(new LoginResponse(user.getUsername(), user.getUsername(), role, token));
    }
}
