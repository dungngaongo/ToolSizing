package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateThongTinDauVaoRequest {
    private String systemInfoId;
    private String dauVao;
    private String taiHeThongPOC;
    private String dinhCo;
    private String module;
    private String ghiChu;
}

