package com.example.demo.controller;

import com.example.demo.model.SoCuThongTinDauVao;
import com.example.demo.service.SoCuThongTinDauVaoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/so-cu-thong-tin-dau-vao")
public class SoCuThongTinDauVaoController {
    private final SoCuThongTinDauVaoService soCuThongTinDauVaoService;

    public SoCuThongTinDauVaoController(SoCuThongTinDauVaoService soCuThongTinDauVaoService) {
        this.soCuThongTinDauVaoService = soCuThongTinDauVaoService;
    }

    /**
     * Upload ảnh sở cứ
     */
    @PostMapping("/system-info/{systemInfoId}/upload")
    public ResponseEntity<SoCuThongTinDauVao> uploadImage(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) throws IOException {
        SoCuThongTinDauVao created = soCuThongTinDauVaoService.uploadImage(systemInfoId, file);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<SoCuThongTinDauVao>> getAll() {
        return ResponseEntity.ok(soCuThongTinDauVaoService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<List<SoCuThongTinDauVao>> getBySystemInfoId(@PathVariable String systemInfoId) {
        return ResponseEntity.ok(soCuThongTinDauVaoService.getBySystemInfoId(systemInfoId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        soCuThongTinDauVaoService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}

