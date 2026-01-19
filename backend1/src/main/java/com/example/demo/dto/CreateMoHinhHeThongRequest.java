package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateMoHinhHeThongRequest {
    private String systemInfoId;
    private String module;
    private String zoneMang;
    private String heDieuHanh;
    private Integer soLuongVIP;
}

