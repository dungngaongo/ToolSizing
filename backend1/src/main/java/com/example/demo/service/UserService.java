package com.example.demo.service;

import com.example.demo.dto.CreateUserRequest;
import com.example.demo.exception.DuplicateResourceException;
import com.example.demo.exception.ResourceNotFoundException;
import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        // In real application, you should hash the password
        user.setPasswordHash(hashPassword(request.getPassword()));
        user.setRole(request.getRole() == null ? "user" : request.getRole());
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
        if (request.getRole() != null) user.setRole(request.getRole());
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            user.setPasswordHash(hashPassword(request.getPassword()));
        }
        return userRepository.save(user);
    }

    public void delete(String id) {
        log.info("Deleting user id: {}", id);
        userRepository.deleteById(id);
    }

    // Simple password hash (in production, use BCrypt or similar)
    private String hashPassword(String password) {
        // Use BCrypt for hashing
        return passwordEncoder.encode(password == null ? "" : password);
    }
}

