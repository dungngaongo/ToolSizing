package com.example.sizing.service;

import com.example.sizing.dto.CreateUserRequest;
import com.example.sizing.exception.BadRequestException;
import com.example.sizing.exception.DuplicateResourceException;
import com.example.sizing.exception.ForbiddenException;
import com.example.sizing.exception.ResourceNotFoundException;
import com.example.sizing.model.Role;
import com.example.sizing.model.User;
import com.example.sizing.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Service
public class UserService {
    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User create(CreateUserRequest request) {
        log.info("Creating user with username: {}", request.getUsername());
        if (userRepository.existsByUsername(request.getUsername())) {
            log.warn("Duplicate username attempt: {}", request.getUsername());
            throw new DuplicateResourceException("User", "username", request.getUsername());
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            log.warn("Duplicate email attempt: {}", request.getEmail());
            throw new DuplicateResourceException("User", "email", request.getEmail());
        }

        // Validate role
        String requestedRole = request.getRole() == null ? "user" : request.getRole().toLowerCase();
        if (!Role.isValid(requestedRole)) {
            throw new BadRequestException("Role không hợp lệ: " + request.getRole() + ". Chỉ chấp nhận: user, admin1, admin2");
        }

        // Chỉ admin2 mới được gán role khác 'user'
        if (!"user".equals(requestedRole)) {
            validateCallerIsAdmin2("gán role '" + requestedRole + "'");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(hashPassword(request.getPassword()));
        user.setRole(requestedRole);
        return userRepository.save(user);
    }

    public List<User> getAll() {
        return userRepository.findAll();
    }

    public Optional<User> getById(String id) {
        return userRepository.findById(id);
    }

    public Optional<User> getByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> getByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> authenticate(String username, String rawPassword) {
        log.info("Authentication attempt for username: {}", username);
        Optional<User> u = userRepository.findByUsername(username);
        if (u.isEmpty()) {
            log.warn("Authentication failed - user not found: {}", username);
            return Optional.empty();
        }
        User user = u.get();
        if (passwordEncoder.matches(rawPassword == null ? "" : rawPassword, user.getPasswordHash())) {
            log.info("Authentication successful for username: {}", username);
            return Optional.of(user);
        }
        log.warn("Authentication failed - invalid password for username: {}", username);
        return Optional.empty();
    }

    public User update(String id, CreateUserRequest request) {
        log.info("Updating user id: {}", id);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());

        // Validate & authorize role change
        if (request.getRole() != null) {
            String newRole = request.getRole().toLowerCase();
            if (!Role.isValid(newRole)) {
                throw new BadRequestException("Role không hợp lệ: " + request.getRole());
            }
            if (!newRole.equals(user.getRole())) {
                validateCallerIsAdmin2("thay đổi role thành '" + newRole + "'");
            }
            user.setRole(newRole);
        }

        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            user.setPasswordHash(hashPassword(request.getPassword()));
        }
        return userRepository.save(user);
    }

    public void delete(String id) {
        log.info("Deleting user id: {}", id);
        userRepository.deleteById(id);
    }

    /**
     * Kiểm tra người gọi hiện tại có phải admin2 hay không.
     * Ném ForbiddenException nếu không phải.
     */
    private void validateCallerIsAdmin2(String action) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream()
                .noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN2"))) {
            log.warn("Non-admin2 user attempted to {}", action);
            throw new ForbiddenException("Chỉ admin2 mới có quyền " + action);
        }
    }

    private String hashPassword(String password) {
        return passwordEncoder.encode(password == null ? "" : password);
    }
}

