package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "mo_hinh_he_thong_image")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MoHinhHeThongImage {
    @Id
    private String id;

    private String systemInfoId;

    private String moHinhVatLy;
    private String moHinhLogic;
    private String luongNghiepVu;

    @Column(length = 2000)
    private String luongNghiepVuDescription;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
