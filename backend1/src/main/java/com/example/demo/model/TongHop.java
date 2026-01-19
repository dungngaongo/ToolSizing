package com.example.demo.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name = "tong_hop")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TongHop {
    @Id
    private String id;

    private String systemInfoId;
    private String module;
    private Integer soLuong;
    private Integer vCPU;
    private Double ram;
    private String volume;
    private String ghiChu;

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}
