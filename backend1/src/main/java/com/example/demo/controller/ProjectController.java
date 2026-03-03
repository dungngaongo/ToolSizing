package com.example.demo.controller;

import com.example.demo.dto.CreateProjectRequest;
import com.example.demo.model.Project;
import com.example.demo.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
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
        log.debug("GET /api/projects - Fetching all projects");
        return ResponseEntity.ok(projectService.getAll());
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

    @PutMapping("/{id}")
    public ResponseEntity<Project> update(@PathVariable String id, @RequestBody CreateProjectRequest request) {
        log.info("PUT /api/projects/{} - Updating project", id);
        Project updated = projectService.update(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        log.info("DELETE /api/projects/{} - Deleting project", id);
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

