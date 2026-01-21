package com.example.demo.controller;

import com.example.demo.dto.CreateProjectRequest;
import com.example.demo.model.Project;
import com.example.demo.service.ProjectService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "*")
public class ProjectController {
    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    public ResponseEntity<Project> create(@RequestBody CreateProjectRequest request) {
        Project created = projectService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<Project>> getAll() {
        return ResponseEntity.ok(projectService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Project> getById(@PathVariable String id) {
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
        Project updated = projectService.update(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

