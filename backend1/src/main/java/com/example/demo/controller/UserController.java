package com.example.demo.controller;

import com.example.demo.dto.CreateUserRequest;
import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {
    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<User> create(@RequestBody CreateUserRequest request) {
        log.info("POST /api/users - Creating user: {}", request.getUsername());
        User created = userService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<User>> getAll() {
        log.debug("GET /api/users - Fetching all users");
        return ResponseEntity.ok(userService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getById(@PathVariable String id) {
        log.debug("GET /api/users/{} - Fetching user", id);
        return userService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/username/{username}")
    public ResponseEntity<User> getByUsername(@PathVariable String username) {
        return userService.getByUsername(username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<User> update(@PathVariable String id, @RequestBody CreateUserRequest request) {
        log.info("PUT /api/users/{} - Updating user", id);
        User updated = userService.update(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        log.info("DELETE /api/users/{} - Deleting user", id);
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

