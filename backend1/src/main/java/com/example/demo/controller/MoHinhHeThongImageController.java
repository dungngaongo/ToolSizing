package com.example.demo.controller;

import com.example.demo.model.MoHinhHeThongImage;
import com.example.demo.service.MoHinhHeThongImageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/mo-hinh-he-thong-image")
public class MoHinhHeThongImageController {
    private final MoHinhHeThongImageService moHinhHeThongImageService;

    public MoHinhHeThongImageController(MoHinhHeThongImageService moHinhHeThongImageService) {
        this.moHinhHeThongImageService = moHinhHeThongImageService;
    }

    @GetMapping
    public ResponseEntity<List<MoHinhHeThongImage>> getAll() {
        return ResponseEntity.ok(moHinhHeThongImageService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<MoHinhHeThongImage> getBySystemInfoId(@PathVariable String systemInfoId) {
        Optional<MoHinhHeThongImage> entity = moHinhHeThongImageService.getBySystemInfoId(systemInfoId);
        return entity.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/system-info/{systemInfoId}/mo-hinh-vat-ly")
    public ResponseEntity<MoHinhHeThongImage> uploadMoHinhVatLy(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) throws IOException {
        MoHinhHeThongImage result = moHinhHeThongImageService.uploadMoHinhVatLy(systemInfoId, file);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/system-info/{systemInfoId}/mo-hinh-logic")
    public ResponseEntity<MoHinhHeThongImage> uploadMoHinhLogic(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) throws IOException {
        MoHinhHeThongImage result = moHinhHeThongImageService.uploadMoHinhLogic(systemInfoId, file);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/system-info/{systemInfoId}/luong-nghiep-vu")
    public ResponseEntity<MoHinhHeThongImage> uploadLuongNghiepVu(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) throws IOException {
        MoHinhHeThongImage result = moHinhHeThongImageService.uploadLuongNghiepVu(systemInfoId, file);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/system-info/{systemInfoId}/luong-nghiep-vu-description")
    public ResponseEntity<MoHinhHeThongImage> updateLuongNghiepVuDescription(
            @PathVariable String systemInfoId,
            @RequestBody String description) {
        MoHinhHeThongImage result = moHinhHeThongImageService.updateLuongNghiepVuDescription(systemInfoId, description);
        return ResponseEntity.ok(result);
    }
}
