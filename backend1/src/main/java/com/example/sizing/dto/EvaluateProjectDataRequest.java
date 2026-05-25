package com.example.sizing.dto;

import lombok.Data;

@Data
public class EvaluateProjectDataRequest {
    private String section; // request | input | model
    private String reviewJson; // JSON string containing admin evaluations/notes for the section
}
