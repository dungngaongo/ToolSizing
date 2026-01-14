package com.example.demo.controller;

import com.example.demo.dto.CreateHeThongThamChieuRequest;
import com.example.demo.model.HeThongThamChieu;
import com.example.demo.service.HeThongThamChieuService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/he-thong-tham-chieu")
public class HeThongThamChieuController {
    private final HeThongThamChieuService heThongThamChieuService;

    public HeThongThamChieuController(HeThongThamChieuService heThongThamChieuService) {
        this.heThongThamChieuService = heThongThamChieuService;
    }

    @PostMapping("/system-info/{systemInfoId}")
    public ResponseEntity<HeThongThamChieu> create(
            @PathVariable String systemInfoId,
            @RequestBody CreateHeThongThamChieuRequest request) {
        request.setSystemInfoId(systemInfoId);
        HeThongThamChieu created = heThongThamChieuService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<HeThongThamChieu>> getAll() {
        return ResponseEntity.ok(heThongThamChieuService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<List<HeThongThamChieu>> getBySystemInfoId(@PathVariable String systemInfoId) {
        return ResponseEntity.ok(heThongThamChieuService.getBySystemInfoId(systemInfoId));
    }
}

