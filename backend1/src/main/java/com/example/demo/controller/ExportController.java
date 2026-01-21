package com.example.demo.controller;

import com.example.demo.service.ExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api/export")
@CrossOrigin(origins = "*")
public class ExportController {
    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<byte[]> exportProject(@PathVariable String projectId) {
        try {
            byte[] docxBytes = exportService.exportToDocx(projectId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "project-report-" + projectId + ".docx");

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(docxBytes);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}

