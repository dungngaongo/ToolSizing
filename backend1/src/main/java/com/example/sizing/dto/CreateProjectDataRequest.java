package com.example.sizing.dto;

import lombok.Data;

@Data
public class CreateProjectDataRequest {
    private String projectId;
    private String yeuCauBaiToanContent; // JSON string
    private String thongTinDauVaoContent; // JSON string
    private String moHinhHeThongContent; // JSON string
    private String dinhCoHeThongContent; // JSON string
    private String tongHopVaDeXuatContent; // JSON string
    private String tongHopAdminReview; // JSON string
}

