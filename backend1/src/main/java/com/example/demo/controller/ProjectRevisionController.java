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
        if (created == null) {
            // Không có thay đổi nào -> trả về 204 No Content
            return ResponseEntity.noContent().build();
        }
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

    /**
     * Lấy full reconstructed snapshot tại một revision cụ thể
     * Dùng cho preview phiên bản - trả về dữ liệu đầy đủ dù là INCREMENTAL
     */
    @GetMapping("/{id}/reconstruct")
    public ResponseEntity<java.util.Map<String, Object>> getReconstructedSnapshot(@PathVariable String id) {
        try {
            ProjectRevision revision = projectRevisionService.getById(id)
                    .orElseThrow(() -> new RuntimeException("Revision not found: " + id));
            String fullSnapshot = projectRevisionService.reconstructAtRevision(id);
            
            java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("id", revision.getId());
            result.put("projectId", revision.getProjectId());
            result.put("userId", revision.getUserId());
            result.put("revisionType", revision.getRevisionType());
            result.put("changeLog", revision.getChangeLog());
            result.put("createdAt", revision.getCreatedAt());
            result.put("snapshotContent", fullSnapshot);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", e.getMessage()));
        }
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

