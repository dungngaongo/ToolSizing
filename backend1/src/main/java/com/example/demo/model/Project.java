package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "projects")
@Data
public class Project {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_projects_user"))
    @JsonIgnore
    private User owner;

    @Column(name = "user_id", insertable = false, updatable = false)
    @JsonIgnore
    private String userIdRef;

    @Column(nullable = false)
    private String name;
    
    @Column(name = "dev_unit")
    private String devUnit;
    
    @Column(name = "owner_name")
    private String ownerName;

    @Column(length = 50)
    private String status; // SIZING, THAM_DINH, PHE_DUYET, HOAN_THANH
    
    @Column(name = "status_round")
    private Integer statusRound = 1; // Lần thứ mấy (1, 2, 3, ...)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_admin1_id", foreignKey = @ForeignKey(name = "fk_projects_assigned_admin1"))
    @JsonIgnore
    private User assignedAdmin1; // Admin1 được chỉ định thẩm định/đánh giá dự án này

    @Column(name = "assigned_admin1_id", insertable = false, updatable = false)
    @JsonIgnore
    private String assignedAdmin1IdRef;

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

    @JsonProperty("userId")
    public String getUserId() {
        if (userIdRef != null && !userIdRef.isBlank()) {
            return userIdRef;
        }
        return owner != null ? owner.getId() : null;
    }

    @JsonProperty("userId")
    public void setUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            this.owner = null;
            return;
        }
        if (this.owner == null) {
            this.owner = new User();
        }
        this.owner.setId(userId);
    }

    @JsonProperty("assignedAdmin1Id")
    public String getAssignedAdmin1Id() {
        if (assignedAdmin1IdRef != null && !assignedAdmin1IdRef.isBlank()) {
            return assignedAdmin1IdRef;
        }
        return assignedAdmin1 != null ? assignedAdmin1.getId() : null;
    }

    @JsonProperty("assignedAdmin1Id")
    public void setAssignedAdmin1Id(String assignedAdmin1Id) {
        if (assignedAdmin1Id == null || assignedAdmin1Id.isBlank()) {
            this.assignedAdmin1 = null;
            return;
        }
        if (this.assignedAdmin1 == null) {
            this.assignedAdmin1 = new User();
        }
        this.assignedAdmin1.setId(assignedAdmin1Id);
    }
}

