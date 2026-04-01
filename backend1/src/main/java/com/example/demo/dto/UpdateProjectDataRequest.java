package com.example.demo.dto;

import lombok.Data;

@Data
public class UpdateProjectDataRequest {
    private String yeuCauBaiToanContent; // JSON string
    private String thongTinDauVaoContent; // JSON string
    private String moHinhHeThongContent; // JSON string
    private String dinhCoHeThongContent; // JSON string
    private String tongHopVaDeXuatContent; // JSON string
}

