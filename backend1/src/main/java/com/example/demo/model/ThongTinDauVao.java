package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "thong_tin_dau_vao")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ThongTinDauVao {
    @Id
    private String id;

    private String systemInfoId;

    private String dauVao;
    private String taiHeThongPOC;
    private String dinhCo;
    private String module;
    private String ghiChu;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
