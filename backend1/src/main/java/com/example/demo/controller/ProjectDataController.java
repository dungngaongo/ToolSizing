package com.example.demo.controller;

import com.example.demo.dto.CreateProjectDataRequest;
import com.example.demo.dto.UpdateProjectDataRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.service.ProjectDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.example.demo.dto.EvaluateProjectDataRequest;

import java.util.List;

@RestController
@RequestMapping("/api/project-data")
@CrossOrigin(origins = "*")
public class ProjectDataController {
    private final ProjectDataService projectDataService;

    public ProjectDataController(ProjectDataService projectDataService) {
        this.projectDataService = projectDataService;
    }

    @PostMapping
    public ResponseEntity<ProjectData> create(@RequestBody CreateProjectDataRequest request) {
        ProjectData created = projectDataService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<ProjectData>> getAll() {
        return ResponseEntity.ok(projectDataService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectData> getById(@PathVariable String id) {
        return projectDataService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<ProjectData> getByProjectId(@PathVariable String projectId) {
        return projectDataService.getByProjectId(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/project/{projectId}")
    public ResponseEntity<ProjectData> update(@PathVariable String projectId, @RequestBody UpdateProjectDataRequest request) {
        ProjectData updated = projectDataService.update(projectId, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        projectDataService.delete(id);
        return ResponseEntity.noContent().build();
    }
    
    @PostMapping("/project/{projectId}/cleanup")
    public ResponseEntity<String> cleanupDuplicates(@PathVariable String projectId) {
        projectDataService.cleanupDuplicates(projectId);
        return ResponseEntity.ok("Cleanup completed for projectId: " + projectId);
    }

    @PostMapping("/project/{projectId}/evaluate")
    public ResponseEntity<?> evaluateSection(@PathVariable String projectId, @RequestBody EvaluateProjectDataRequest request) {
        // Verify authenticated user has admin role (ROLE_ADMIN1 or ROLE_ADMIN2)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth != null && auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN1") || a.getAuthority().equalsIgnoreCase("ROLE_ADMIN2"));
        if (!isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Forbidden: requires admin role");
        }

        try {
            ProjectData updated = projectDataService.saveEvaluation(projectId, request.getSection(), request.getReviewJson());
            return ResponseEntity.ok(updated);
        } catch (RuntimeException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }
    }
}

