package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "he_thong_tham_chieu")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeThongThamChieu {
    @Id
    private String id;

    private String systemInfoId;

    private String module;
    private String ip;
    private String cpu;
    private Double ram;
    private Double cintRate2017;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
