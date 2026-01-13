package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateSystemInfoRequest {
    private String devUnit;
    private String projectName;
    private String sysFeature;
    private String contactPerson;
    private String sizingPurpose;
    private String sizingBasis;
    private String sizingRule;
    private String importance;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd/MM/yyyy")
    private LocalDate deploymentTime;
}

