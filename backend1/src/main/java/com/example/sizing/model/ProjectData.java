package com.example.sizing.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;

import java.util.UUID;

@Entity
@Table(name = "project_data", uniqueConstraints = {
        @UniqueConstraint(name = "uk_project_data_project_id", columnNames = "project_id")
})
@Data
public class ProjectData {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_project_data_project"))
    @JsonIgnore
    private Project project;

    @Column(name = "yeu_cau_bai_toan_content", columnDefinition = "LONGTEXT")
    @Lob
    private String yeuCauBaiToanContent; // JSON string

    @Column(name = "thong_tin_dau_vao_content", columnDefinition = "LONGTEXT")
    @Lob
    private String thongTinDauVaoContent; // JSON string

    @Column(name = "mo_hinh_he_thong_content", columnDefinition = "LONGTEXT")
    @Lob
    private String moHinhHeThongContent; // JSON string

    @Column(name = "dinh_co_he_thong_content", columnDefinition = "LONGTEXT")
    @Lob
    private String dinhCoHeThongContent; // JSON string

    @Column(name = "tong_hop_va_de_xuat_content", columnDefinition = "LONGTEXT")
    @Lob
    private String tongHopVaDeXuatContent; // JSON string

    @Column(name = "yeu_cau_admin_review", columnDefinition = "LONGTEXT")
    @Lob
    private String yeuCauAdminReview; // JSON string containing admin evaluations/notes for Yêu cầu bài toán

    @Column(name = "thong_tin_admin_review", columnDefinition = "LONGTEXT")
    @Lob
    private String thongTinAdminReview; // JSON string containing admin evaluations/notes for Thông tin đầu vào

    @Column(name = "mohinh_admin_review", columnDefinition = "LONGTEXT")
    @Lob
    private String moHinhAdminReview; // JSON string containing admin evaluations/notes for Mô hình hệ thống

    @Column(name = "dinhco_admin_review", columnDefinition = "LONGTEXT")
    @Lob
    private String dinhCoAdminReview; // JSON string containing admin evaluations/notes for Định cỡ hệ thống

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }

    @JsonProperty("projectId")
    public String getProjectId() {
        return project != null ? project.getId() : null;
    }

    @JsonProperty("projectId")
    public void setProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            this.project = null;
            return;
        }
        if (this.project == null) {
            this.project = new Project();
        }
        this.project.setId(projectId);
    }
}

