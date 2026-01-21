package com.example.demo.controller;

import com.example.demo.dto.CreateProjectRevisionRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.model.ProjectRevision;
import com.example.demo.service.ProjectRevisionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-revisions")
@CrossOrigin(origins = "*")
public class ProjectRevisionController {
    private final ProjectRevisionService projectRevisionService;

    public ProjectRevisionController(ProjectRevisionService projectRevisionService) {
        this.projectRevisionService = projectRevisionService;
    }

    @PostMapping
    public ResponseEntity<ProjectRevision> createRevision(@RequestBody CreateProjectRevisionRequest request) {
        ProjectRevision created = projectRevisionService.createRevision(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<ProjectRevision>> getAll() {
        return ResponseEntity.ok(projectRevisionService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectRevision> getById(@PathVariable String id) {
        return projectRevisionService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<ProjectRevision>> getByProjectId(@PathVariable String projectId) {
        return ResponseEntity.ok(projectRevisionService.getByProjectId(projectId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ProjectRevision>> getByUserId(@PathVariable String userId) {
        return ResponseEntity.ok(projectRevisionService.getByUserId(userId));
    }

    @PostMapping("/{revisionId}/restore")
    public ResponseEntity<ProjectData> restoreFromRevision(@PathVariable String revisionId) {
        ProjectData restored = projectRevisionService.restoreFromRevision(revisionId);
        return ResponseEntity.ok(restored);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        projectRevisionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

