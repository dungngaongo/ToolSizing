package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "thong_tin_dau_vao")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ThongTinDauVao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String dauVao;
    private String taiHeThongPOC;
    private String dinhCo;
    private String module;
    private String ghiChu;
}
