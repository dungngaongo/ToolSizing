package com.example.demo.model;

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

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "user_id")
    private String userId; // Người thực hiện chỉnh sửa

    @Column(name = "snapshot_content", columnDefinition = "TEXT")
    @Lob
    private String snapshotContent; // JSON (Lưu lại toàn bộ nội dung của project_data tại thời điểm đó)

    @Column(name = "change_log", length = 500)
    private String changeLog; // Mô tả ngắn gọn (ví dụ: "Cập nhật ngân sách")

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt; // Thời gian lưu phiên

    @PrePersist
    public void generateId() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}

