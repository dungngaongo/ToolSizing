package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "project_revisions")
@Data
public class ProjectRevision {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_project_revisions_project"))
    @JsonIgnore
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_project_revisions_user"))
    @JsonIgnore
    private User user; // Người thực hiện chỉnh sửa

    @Column(name = "revision_type", length = 20)
    private String revisionType; // BASELINE hoặc INCREMENTAL

    @Column(name = "snapshot_content", columnDefinition = "LONGTEXT")
    @Lob
    private String snapshotContent; // JSON - BASELINE: full snapshot, INCREMENTAL: chỉ phần thay đổi

    @Column(name = "change_log", length = 500)
    private String changeLog; // Mô tả ngắn gọn (ví dụ: "Cập nhật ngân sách")

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "baseline_id", foreignKey = @ForeignKey(name = "fk_project_revisions_baseline"))
    @JsonIgnore
    private ProjectRevision baseline; // ID của revision BASELINE gần nhất (cho INCREMENTAL)

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt; // Thời gian lưu phiên

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

    @JsonProperty("userId")
    public String getUserId() {
        return user != null ? user.getId() : null;
    }

    @JsonProperty("userId")
    public void setUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            this.user = null;
            return;
        }
        if (this.user == null) {
            this.user = new User();
        }
        this.user.setId(userId);
    }

    @JsonProperty("baselineId")
    public String getBaselineId() {
        return baseline != null ? baseline.getId() : null;
    }

    @JsonProperty("baselineId")
    public void setBaselineId(String baselineId) {
        if (baselineId == null || baselineId.isBlank()) {
            this.baseline = null;
            return;
        }
        if (this.baseline == null) {
            this.baseline = new ProjectRevision();
        }
        this.baseline.setId(baselineId);
    }
}

