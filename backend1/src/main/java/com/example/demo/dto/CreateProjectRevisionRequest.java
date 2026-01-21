package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateProjectRevisionRequest {
    private String projectId;
    private String userId;
    private String changeLog; // Mô tả ngắn gọn
}

