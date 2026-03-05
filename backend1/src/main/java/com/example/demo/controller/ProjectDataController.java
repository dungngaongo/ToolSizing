package com.example.demo.controller;

import com.example.demo.exception.ForbiddenException;
import com.example.demo.dto.CreateProjectDataRequest;
import com.example.demo.dto.UpdateProjectDataRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.service.ProjectDataService;
import com.example.demo.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private static final Logger log = LoggerFactory.getLogger(ProjectDataController.class);

    private final ProjectDataService projectDataService;
    private final ProjectService projectService;

    public ProjectDataController(ProjectDataService projectDataService, ProjectService projectService) {
        this.projectDataService = projectDataService;
        this.projectService = projectService;
    }

    @PostMapping
    public ResponseEntity<ProjectData> create(@RequestBody CreateProjectDataRequest request) {
        log.info("POST /api/project-data - Creating for projectId: {}", request.getProjectId());
        // Kiểm tra quyền truy cập dự án
        if (!projectService.canAccessProject(request.getProjectId())) {
            throw new ForbiddenException("Bạn không có quyền tạo dữ liệu cho dự án này");
        }
        ProjectData created = projectDataService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<ProjectData>> getAll() {
        log.debug("GET /api/project-data - Fetching all");
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
        // Kiểm tra quyền truy cập dự án
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Bạn không có quyền truy cập dữ liệu dự án này");
        }
        return projectDataService.getByProjectId(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/project/{projectId}")
    public ResponseEntity<ProjectData> update(@PathVariable String projectId, @RequestBody UpdateProjectDataRequest request) {
        log.info("PUT /api/project-data/project/{} - Updating", projectId);
        // Kiểm tra quyền truy cập dự án
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Bạn không có quyền cập nhật dữ liệu dự án này");
        }
        ProjectData updated = projectDataService.update(projectId, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        log.info("DELETE /api/project-data/{} - Deleting", id);
        projectDataService.delete(id);
        return ResponseEntity.noContent().build();
    }
    
    @PostMapping("/project/{projectId}/cleanup")
    public ResponseEntity<String> cleanupDuplicates(@PathVariable String projectId) {
        log.info("POST /api/project-data/project/{}/cleanup - Cleaning up duplicates", projectId);
        projectDataService.cleanupDuplicates(projectId);
        return ResponseEntity.ok("Cleanup completed for projectId: " + projectId);
    }

    @PostMapping("/project/{projectId}/evaluate")
    public ResponseEntity<?> evaluateSection(@PathVariable String projectId, @RequestBody EvaluateProjectDataRequest request) {
        log.info("POST /api/project-data/project/{}/evaluate - section: {}", projectId, request.getSection());
        // Verify authenticated user has admin role AND has access to this project
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth != null && auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN1") || a.getAuthority().equalsIgnoreCase("ROLE_ADMIN2"));
        if (!isAdmin) {
            throw new ForbiddenException("Forbidden: requires admin role");
        }
        
        // Kiểm tra admin1 chỉ được đánh giá dự án được chỉ định
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Bạn không được chỉ định thẩm định dự án này");
        }

        ProjectData updated = projectDataService.saveEvaluation(projectId, request.getSection(), request.getReviewJson());
        return ResponseEntity.ok(updated);
    }
}

