package com.example.demo.controller;

import com.example.demo.dto.CreateSystemInfoRequest;
import com.example.demo.model.SystemInfo;
import com.example.demo.service.SystemInfoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/system-info")
public class SystemInfoController {
    private final SystemInfoService systemInfoService;

    public SystemInfoController(SystemInfoService systemInfoService) {
        this.systemInfoService = systemInfoService;
    }

    @PostMapping
    public ResponseEntity<SystemInfo> createSystemInfo(@RequestBody CreateSystemInfoRequest request) {
        SystemInfo created = systemInfoService.createSystemInfo(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<SystemInfo>> getAllSystemInfo() {
        return ResponseEntity.ok(systemInfoService.getAllSystemInfo());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SystemInfo> getById(@PathVariable String id) {
        Optional<SystemInfo> systemInfo = systemInfoService.getById(id);
        return systemInfo.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> exportToDocx(@PathVariable String id) throws IOException {
        byte[] docxContent = systemInfoService.exportToDocx(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", "system-info.docx");

        return ResponseEntity.ok()
                .headers(headers)
                .body(docxContent);
    }
}

