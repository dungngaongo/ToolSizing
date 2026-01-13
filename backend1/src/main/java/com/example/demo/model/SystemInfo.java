package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(name = "system_info")
@Data
public class SystemInfo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String devUnit;
    private String projectName;

    @Column(name = "sys_feature", length = 500)
    private String sysFeature;
    private String contactPerson;
    private String sizingPurpose;
    private String sizingBasis;
    private String sizingRule;
    private String importance;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd/MM/yyyy")
    private LocalDate deploymentTime;
}


