package com.example.demo.controller;

import com.example.demo.dto.CreateSystemInfoRequest;
import com.example.demo.model.SystemInfo;
import com.example.demo.service.SystemInfoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
}

