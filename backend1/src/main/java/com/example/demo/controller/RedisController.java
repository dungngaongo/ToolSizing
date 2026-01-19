package com.example.demo.controller;

import com.example.demo.dto.CreateRedisRequest;
import com.example.demo.model.Redis;
import com.example.demo.service.RedisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/redis")
public class RedisController {
    private final RedisService redisService;

    public RedisController(RedisService redisService) {
        this.redisService = redisService;
    }

    @PostMapping("/system-info/{systemInfoId}")
    public ResponseEntity<Redis> create(
            @PathVariable String systemInfoId,
            @RequestBody CreateRedisRequest request) {
        request.setSystemInfoId(systemInfoId);
        Redis created = redisService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<Redis>> getAll() {
        return ResponseEntity.ok(redisService.getAll());
    }

    @GetMapping("/system-info/{systemInfoId}")
    public ResponseEntity<Redis> getBySystemInfoId(@PathVariable String systemInfoId) {
        Optional<Redis> entity = redisService.getBySystemInfoId(systemInfoId);
        return entity.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/system-info/{systemInfoId}/upload-mo-hinh-logic")
    public ResponseEntity<Redis> uploadMoHinhLogic(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) {
        try {
            Redis updated = redisService.uploadMoHinhLogic(systemInfoId, file);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/system-info/{systemInfoId}/upload-key-img")
    public ResponseEntity<Redis> uploadKeyImg(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) {
        try {
            Redis updated = redisService.uploadKeyImg(systemInfoId, file);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/system-info/{systemInfoId}/upload-avg-size-img")
    public ResponseEntity<Redis> uploadAvgSizeImg(
            @PathVariable String systemInfoId,
            @RequestParam("file") MultipartFile file) {
        try {
            Redis updated = redisService.uploadAvgSizeImg(systemInfoId, file);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
