package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;

import java.util.UUID;

@Entity
@Table(name = "project_data")
@Data
public class ProjectData {
    @Id
    private String id;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "yeu_cau_bai_toan_content", columnDefinition = "TEXT")
    @Lob
    private String yeuCauBaiToanContent; // JSON string

    @Column(name = "thong_tin_dau_vao_content", columnDefinition = "TEXT")
    @Lob
    private String thongTinDauVaoContent; // JSON string

    @Column(name = "mo_hinh_he_thong_content", columnDefinition = "TEXT")
    @Lob
    private String moHinhHeThongContent; // JSON string

    @Column(name = "dinh_co_he_thong_content", columnDefinition = "TEXT")
    @Lob
    private String dinhCoHeThongContent; // JSON string

    @Column(name = "tong_hop_va_de_xuat_content", columnDefinition = "TEXT")
    @Lob
    private String tongHopVaDeXuatContent; // JSON string

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}

