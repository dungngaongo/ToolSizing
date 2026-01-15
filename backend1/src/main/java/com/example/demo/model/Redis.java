package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "redis")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Redis {
    @Id
    private String id;

    private String systemInfoId;

    private String moHinhLogic;

    @Column(length = 2000)
    private String moTa;

    @Column(length = 2000)
    private String mucDich;

    private Long keyNumber;
    private String keyImg;

    private Double avgSize;
    private String avgSizeImg;

    private String importance;
    private Integer masterNumber;

    private String sumC;
    private String deXuat;

    private Integer vCpu;
    private Double ram;
    private String disk;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
