package com.example.demo.repository;

import com.example.demo.model.ProjectData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectDataRepository extends JpaRepository<ProjectData, String> {
    Optional<ProjectData> findByProjectId(String projectId);
}
