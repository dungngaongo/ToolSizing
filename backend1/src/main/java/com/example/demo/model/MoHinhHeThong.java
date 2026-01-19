package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "mo_hinh_he_thong")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MoHinhHeThong {
    @Id
    private String id;

    private String systemInfoId;

    private String module;
    private String zoneMang;
    private String heDieuHanh;
    private Integer soLuongVIP;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}

