package com.example.demo.controller;

import com.example.demo.exception.ResourceNotFoundException;
import com.example.demo.dto.CreateProjectRevisionRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.model.ProjectRevision;
import com.example.demo.service.ProjectRevisionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-revisions")
@CrossOrigin(origins = "*")
public class ProjectRevisionController {
    private static final Logger log = LoggerFactory.getLogger(ProjectRevisionController.class);

    private final ProjectRevisionService projectRevisionService;

    public ProjectRevisionController(ProjectRevisionService projectRevisionService) {
        this.projectRevisionService = projectRevisionService;
    }

    @PostMapping
    public ResponseEntity<ProjectRevision> createRevision(@RequestBody CreateProjectRevisionRequest request) {
        log.info("POST /api/project-revisions - Creating revision for projectId: {}", request.getProjectId());
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
        log.info("GET /api/project-revisions/{}/reconstruct - Reconstructing snapshot", id);
        ProjectRevision revision = projectRevisionService.getById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectRevision", "id", id));
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
        log.info("POST /api/project-revisions/{}/restore - Restoring from revision", revisionId);
        ProjectData restored = projectRevisionService.restoreFromRevision(revisionId);
        return ResponseEntity.ok(restored);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        log.info("DELETE /api/project-revisions/{} - Deleting revision", id);
        projectRevisionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

