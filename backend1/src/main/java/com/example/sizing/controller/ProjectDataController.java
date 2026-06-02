package com.example.sizing.controller;

import com.example.sizing.dto.CreateProjectDataRequest;
import com.example.sizing.dto.EvaluateProjectDataRequest;
import com.example.sizing.dto.ProjectDataSectionResponse;
import com.example.sizing.dto.UpdateProjectDataRequest;
import com.example.sizing.exception.ForbiddenException;
import com.example.sizing.model.ProjectData;
import com.example.sizing.service.ProjectDataService;
import com.example.sizing.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

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
        if (!projectService.canAccessProject(request.getProjectId())) {
            throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n táº¡o dá»¯ liá»‡u cho dá»± Ã¡n nÃ y");
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
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»¯ liá»‡u dá»± Ã¡n nÃ y");
        }
        return projectDataService.getByProjectId(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectId}/section/{section}")
    public ResponseEntity<ProjectDataSectionResponse> getSectionByProjectId(@PathVariable String projectId,
                                                                            @PathVariable String section) {
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»¯ liá»‡u dá»± Ã¡n nÃ y");
        }
        return projectDataService.getSectionByProjectId(projectId, section)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/project/{projectId}")
    public ResponseEntity<ProjectData> update(@PathVariable String projectId, @RequestBody UpdateProjectDataRequest request) {
        log.info("PUT /api/project-data/project/{} - Updating", projectId);
        int totalSize = 0;
        if (request.getYeuCauBaiToanContent() != null) totalSize += request.getYeuCauBaiToanContent().length();
        if (request.getThongTinDauVaoContent() != null) totalSize += request.getThongTinDauVaoContent().length();
        if (request.getMoHinhHeThongContent() != null) totalSize += request.getMoHinhHeThongContent().length();
        if (request.getDinhCoHeThongContent() != null) {
            int sizingSize = request.getDinhCoHeThongContent().length();
            totalSize += sizingSize;
            log.info("dinhCoHeThongContent size: {} bytes ({} KB)", sizingSize, sizingSize / 1024);
        }
        if (request.getTongHopVaDeXuatContent() != null) totalSize += request.getTongHopVaDeXuatContent().length();
        log.info("Total estimated payload size: {} bytes ({} KB)", totalSize, totalSize / 1024);

        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n cáº­p nháº­t dá»¯ liá»‡u dá»± Ã¡n nÃ y");
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
    public ResponseEntity<ProjectData> evaluateSection(@PathVariable String projectId,
                                                       @RequestBody EvaluateProjectDataRequest request) {
        log.info("POST /api/project-data/project/{}/evaluate - section: {}", projectId, request.getSection());
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN1")
                        || a.getAuthority().equalsIgnoreCase("ROLE_ADMIN2"));
        if (!isAdmin) {
            throw new ForbiddenException("Forbidden: requires admin role");
        }

        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Báº¡n khÃ´ng Ä‘Æ°á»£c chá»‰ Ä‘á»‹nh tháº©m Ä‘á»‹nh dá»± Ã¡n nÃ y");
        }

        ProjectData updated = projectDataService.saveEvaluation(projectId, request.getSection(), request.getReviewJson());
        return ResponseEntity.ok(updated);
    }
}
