package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateHeThongThamChieuRequest {
    private String systemInfoId;
    private String module;
    private String ip;
    private String cpu;
    private Double ram;
    private Double cintRate2017;
}

