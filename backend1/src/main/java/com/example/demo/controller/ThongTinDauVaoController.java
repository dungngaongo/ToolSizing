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

    @PostMapping
    public ResponseEntity<ThongTinDauVao> create(@RequestBody CreateThongTinDauVaoRequest request) {
        ThongTinDauVao created = thongTinDauVaoService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<ThongTinDauVao>> getAll() {
        return ResponseEntity.ok(thongTinDauVaoService.getAll());
    }
}

