package com.example.demo.dto;

import lombok.Data;

@Data
public class CreateProjectRequest {
    private String userId;
    private String name;
    private String devUnit;
    private String ownerName;
    private String status; // Draft, Completed, etc.
}

