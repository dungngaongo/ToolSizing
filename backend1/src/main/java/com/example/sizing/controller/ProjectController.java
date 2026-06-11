package com.example.sizing.controller;

import com.example.sizing.dto.AssignAdmin1Request;
import com.example.sizing.dto.CreateProjectRequest;
import com.example.sizing.model.Project;
import com.example.sizing.model.User;
import com.example.sizing.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "*")
public class ProjectController {
    private static final Logger log = LoggerFactory.getLogger(ProjectController.class);

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    public ResponseEntity<Project> create(@RequestBody CreateProjectRequest request) {
        log.info("POST /api/projects - Creating project: {}", request.getName());
        Project created = projectService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<Project>> getAll() {
        log.debug("GET /api/projects - Fetching projects for current user (role-based)");
        return ResponseEntity.ok(projectService.getProjectsForCurrentUser());
    }

    /**
     * Lấy danh sách dự án theo quyền của user hiện tại:
     * - admin2: tất cả
     * - admin1: chỉ dự án được chỉ định
     * - user: chỉ dự án do mình tạo
     */
    @GetMapping("/my-projects")
    public ResponseEntity<List<Project>> getMyProjects() {
        log.debug("GET /api/projects/my-projects - Fetching projects for current user");
        return ResponseEntity.ok(projectService.getProjectsForCurrentUser());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Project> getById(@PathVariable String id) {
        log.debug("GET /api/projects/{} - Fetching project", id);
        return projectService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Project>> getByUserId(@PathVariable String userId) {
        return ResponseEntity.ok(projectService.getByUserId(userId));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<Project>> getByStatus(@PathVariable String status) {
        return ResponseEntity.ok(projectService.getByStatus(status));
    }

    @GetMapping("/user/{userId}/status/{status}")
    public ResponseEntity<List<Project>> getByUserIdAndStatus(@PathVariable String userId, @PathVariable String status) {
        return ResponseEntity.ok(projectService.getByUserIdAndStatus(userId, status));
    }

    /**
     * Admin2 chỉ định admin1 thẩm định dự án.
     */
    @PutMapping("/{id}/assign-reviewer")
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<Project> assignReviewer(@PathVariable String id, @RequestBody AssignAdmin1Request request) {
        log.info("PUT /api/projects/{}/assign-reviewer - Assigning admin1: {}", id, request.getAdmin1Id());
        Project updated = projectService.assignAdmin1ToProject(id, request.getAdmin1Id());
        return ResponseEntity.ok(updated);
    }

    /**
     * Lấy danh sách user admin1 (để admin2 chọn chỉ định).
     */
    @GetMapping("/admin1-users")
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<List<User>> getAdmin1Users() {
        log.debug("GET /api/projects/admin1-users - Fetching admin1 users");
        return ResponseEntity.ok(projectService.getAdmin1Users());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Project> update(@PathVariable String id, @RequestBody CreateProjectRequest request) {
        log.info("PUT /api/projects/{} - Updating project", id);
        Project updated = projectService.update(id, request);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<Project> approve(@PathVariable String id) {
        log.info("POST /api/projects/{}/approve - Approving project", id);
        Project approved = projectService.approveProject(id);
        return ResponseEntity.ok(approved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN2')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        log.info("DELETE /api/projects/{} - Deleting project", id);
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

