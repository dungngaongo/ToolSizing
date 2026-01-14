package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "so_cu_thong_tin_dau_vao")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SoCuThongTinDauVao {
    @Id
    private String id;

    private String systemInfoId;

    private String imagePath;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
