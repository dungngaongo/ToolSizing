package com.example.sizing.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "project_assets")
@Data
public class ProjectAsset {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_project_assets_project"))
    @JsonIgnore
    private Project project;

    @Column(nullable = false, length = 32)
    private String section;

    @Column(name = "asset_group", nullable = false, length = 255)
    private String assetGroup;

    @Column(name = "asset_order", nullable = false)
    private Integer assetOrder = 0;

    @Column(nullable = false, length = 32)
    private String kind = "image";

    @Column(length = 255)
    private String filename;

    @Column(name = "content_type", length = 128)
    private String contentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "storage_path", nullable = false, length = 1024)
    private String storagePath;

    @Column(name = "public_url", nullable = false, length = 512)
    private String publicUrl;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Column(name = "width_px")
    private Integer widthPx;

    @Column(name = "height_px")
    private Integer heightPx;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

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
}
