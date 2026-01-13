package com.example.demo.controller;

import com.example.demo.dto.CreateThongTinDauVaoRequest;
import com.example.demo.model.ThongTinDauVao;
import com.example.demo.service.ThongTinDauVaoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/thong-tin-dau-vao")
public class ThongTinDauVaoController {
    private final ThongTinDauVaoService thongTinDauVaoService;

    public ThongTinDauVaoController(ThongTinDauVaoService thongTinDauVaoService) {
        this.thongTinDauVaoService = thongTinDauVaoService;
    }

    @PostMapping("/system-info/{systemInfoId}")
    public ResponseEntity<ThongTinDauVao> create(
            @PathVariable String systemInfoId,
            @RequestBody CreateThongTinDauVaoRequest request
            ) {
        request.setSystemInfoId(systemInfoId);
        ThongTinDauVao created = thongTinDauVaoService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<ThongTinDauVao>> getAll() {
        return ResponseEntity.ok(thongTinDauVaoService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<List<ThongTinDauVao>> getBySystemInfoId(@PathVariable String systemInfoId) {
        return ResponseEntity.ok(thongTinDauVaoService.getBySystemInfoId(systemInfoId));
    }
}

