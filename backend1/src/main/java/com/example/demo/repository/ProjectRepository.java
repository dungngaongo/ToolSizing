package com.example.demo.repository;

import com.example.demo.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, String> {
    List<Project> findByUserId(String userId);
    List<Project> findByStatus(String status);
    List<Project> findByUserIdAndStatus(String userId, String status);
}

