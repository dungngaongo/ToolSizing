package com.example.demo.controller;

import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.service.ExportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/export")
@CrossOrigin(origins = "*")
public class ExportController {
    private static final Logger log = LoggerFactory.getLogger(ExportController.class);

    private final ExportService exportService;
    private final ProjectDataRepository projectDataRepository;

    public ExportController(ExportService exportService, ProjectDataRepository projectDataRepository) {
        this.exportService = exportService;
        this.projectDataRepository = projectDataRepository;
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<byte[]> exportProject(@PathVariable String projectId) {
        log.info("GET /api/export/project/{} - Exporting project to DOCX", projectId);
        try {
            byte[] docxBytes = exportService.exportToDocx(projectId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "project-report-" + projectId + ".docx");

            log.info("Export completed for projectId: {}, size: {} bytes", projectId, docxBytes.length);
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(docxBytes);
        } catch (IOException e) {
            log.error("Export failed for projectId: {} - IO error: {}", projectId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        } catch (RuntimeException e) {
            log.error("Export failed for projectId: {} - {}", projectId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/debug/{projectId}")
    public ResponseEntity<Map<String, Object>> debugProjectData(@PathVariable String projectId) {
        ProjectData projectData = projectDataRepository.findFirstByProjectId(projectId)
                .orElse(null);

        if (projectData == null) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "ProjectData not found for projectId: " + projectId);
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> debug = new HashMap<>();
        debug.put("id", projectData.getId());
        debug.put("projectId", projectData.getProjectId());
        debug.put("yeuCauBaiToanContent", projectData.getYeuCauBaiToanContent());
        debug.put("thongTinDauVaoContent", projectData.getThongTinDauVaoContent());
        debug.put("moHinhHeThongContent", projectData.getMoHinhHeThongContent());
        debug.put("dinhCoHeThongContent", projectData.getDinhCoHeThongContent());
        debug.put("tongHopVaDeXuatContent", projectData.getTongHopVaDeXuatContent());

        return ResponseEntity.ok(debug);
    }
}

