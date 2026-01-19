package com.example.demo.controller;

import com.example.demo.dto.CreateTongHopRequest;
import com.example.demo.model.TongHop;
import com.example.demo.service.TongHopService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tong-hop")
public class TongHopController {
    private final TongHopService tongHopService;

    public TongHopController(TongHopService tongHopService) {
        this.tongHopService = tongHopService;
    }

    @PostMapping("/system-info/{systemInfoId}")
    public ResponseEntity<TongHop> create(
            @PathVariable String systemInfoId,
            @RequestBody CreateTongHopRequest request) {
        request.setSystemInfoId(systemInfoId);
        TongHop created = tongHopService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<TongHop>> getAll() {
        return ResponseEntity.ok(tongHopService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<List<TongHop>> getBySystemInfoId(@PathVariable String systemInfoId) {
        return ResponseEntity.ok(tongHopService.getBySystemInfoId(systemInfoId));
    }
}

