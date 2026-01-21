package com.example.demo.repository;

import com.example.demo.model.ProjectRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRevisionRepository extends JpaRepository<ProjectRevision, String> {
    List<ProjectRevision> findByProjectId(String projectId);
    List<ProjectRevision> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<ProjectRevision> findByUserId(String userId);
}

