package com.example.demo.model;

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

    @Column(name = "user_id")
    private String userId;

    @Column(nullable = false)
    private String name;
    
    @Column(name = "dev_unit")
    private String devUnit;
    
    @Column(name = "owner_name")
    private String ownerName;

    @Column(length = 50)
    private String status; // Draft, Completed, etc.

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
}

