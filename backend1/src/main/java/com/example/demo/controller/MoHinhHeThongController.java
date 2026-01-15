package com.example.demo.controller;

import com.example.demo.dto.CreateMoHinhHeThongRequest;
import com.example.demo.model.MoHinhHeThong;
import com.example.demo.service.MoHinhHeThongService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mo-hinh-he-thong")
public class MoHinhHeThongController {
    private final MoHinhHeThongService moHinhHeThongService;

    public MoHinhHeThongController(MoHinhHeThongService moHinhHeThongService) {
        this.moHinhHeThongService = moHinhHeThongService;
    }

    @PostMapping("/system-info/{systemInfoId}")
    public ResponseEntity<MoHinhHeThong> create(
            @PathVariable String systemInfoId,
            @RequestBody CreateMoHinhHeThongRequest request) {
        request.setSystemInfoId(systemInfoId);
        MoHinhHeThong created = moHinhHeThongService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<MoHinhHeThong>> getAll() {
        return ResponseEntity.ok(moHinhHeThongService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<List<MoHinhHeThong>> getBySystemInfoId(@PathVariable String systemInfoId) {
        return ResponseEntity.ok(moHinhHeThongService.getBySystemInfoId(systemInfoId));
    }
}

