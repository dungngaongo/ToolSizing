package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateRedisRequest {
    private String systemInfoId;
    private String moTa;
    private String mucDich;
    private Long keyNumber;
    private Double avgSize;
    private String importance;
    private Integer masterNumber;
    private String sumC;
    private String deXuat;
    private Integer vCpu;
    private Double ram;
    private String disk;
}
