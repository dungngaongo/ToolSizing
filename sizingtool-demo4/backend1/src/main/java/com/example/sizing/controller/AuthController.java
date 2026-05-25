package com.example.sizing.controller;

import com.example.sizing.dto.LoginRequest;
import com.example.sizing.dto.LoginResponse;
import com.example.sizing.exception.UnauthorizedException;
import com.example.sizing.model.User;
import com.example.sizing.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        log.info("Login attempt for username: {}", request.getUsername());
        Optional<User> u = userService.authenticate(request.getUsername(), request.getPassword());
        if (u.isEmpty()) {
            log.warn("Login failed for username: {}", request.getUsername());
            throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
        }
        User user = u.get();
        String role = user.getRole() == null ? "user" : user.getRole();
        String token = com.example.sizing.security.JwtUtil.generateToken(user.getUsername(), role);
        log.info("Login successful for username: {}, role: {}", user.getUsername(), role);
        return ResponseEntity.ok(new LoginResponse(user.getId(), user.getUsername(), user.getUsername(), role, token));
    }
}
