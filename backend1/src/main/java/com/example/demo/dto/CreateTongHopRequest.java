package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateTongHopRequest {
    private String systemInfoId;
    private String module;
    private Integer soLuong;
    private Integer vCPU;
    private Double ram;
    private String volume;
    private String ghiChu;
}

