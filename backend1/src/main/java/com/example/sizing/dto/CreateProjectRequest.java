package com.example.sizing.dto;

import lombok.Data;

@Data
public class CreateProjectRequest {
    private String userId;
    private String name;
    private String devUnit;
    private String ownerName;
    private String status; // SIZING, THAM_DINH, PHE_DUYET, HOAN_THANH
    private Integer statusRound; // Lần thứ mấy (1, 2, 3, ...)
}

