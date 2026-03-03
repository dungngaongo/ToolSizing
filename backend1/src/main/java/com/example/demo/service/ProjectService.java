package com.example.demo.service;

import com.example.demo.dto.CreateProjectRequest;
import com.example.demo.model.Project;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectService {
    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

    private final ProjectRepository projectRepository;
    private final ProjectDataRepository projectDataRepository;

    public ProjectService(ProjectRepository projectRepository, ProjectDataRepository projectDataRepository) {
        this.projectRepository = projectRepository;
        this.projectDataRepository = projectDataRepository;
    }

    @Transactional
    public Project create(CreateProjectRequest request) {
        log.info("Creating project '{}' for userId: {}", request.getName(), request.getUserId());
        Project project = new Project();
        project.setUserId(request.getUserId());
        project.setName(request.getName());
        project.setDevUnit(request.getDevUnit());
        project.setOwnerName(request.getOwnerName());
        project.setStatus(request.getStatus() != null ? request.getStatus() : "SIZING");
        project.setStatusRound(request.getStatusRound() != null ? request.getStatusRound() : 1);
        Project savedProject = projectRepository.save(project);

        // Tự động tạo ProjectData rỗng cho project mới
        ProjectData projectData = new ProjectData();
        projectData.setProjectId(savedProject.getId());
        projectDataRepository.save(projectData);

        log.info("Project created successfully with id: {}", savedProject.getId());
        return savedProject;
    }

    public List<Project> getAll() {
        return projectRepository.findAll();
    }

    public Optional<Project> getById(String id) {
        return projectRepository.findById(id);
    }

    public List<Project> getByUserId(String userId) {
        return projectRepository.findByUserId(userId);
    }

    public List<Project> getByStatus(String status) {
        return projectRepository.findByStatus(status);
    }

    public List<Project> getByUserIdAndStatus(String userId, String status) {
        return projectRepository.findByUserIdAndStatus(userId, status);
    }

    public Project update(String id, CreateProjectRequest request) {
        log.info("Updating project id: {}", id);
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        if (request.getName() != null) {
            project.setName(request.getName());
        }
        if (request.getStatus() != null) {
            project.setStatus(request.getStatus());
        }
        if (request.getStatusRound() != null) {
            project.setStatusRound(request.getStatusRound());
        }
        if (request.getUserId() != null) {
            project.setUserId(request.getUserId());
        }
        if (request.getDevUnit() != null) {
            project.setDevUnit(request.getDevUnit());
        }
        if (request.getOwnerName() != null) {
            project.setOwnerName(request.getOwnerName());
        }
        return projectRepository.save(project);
    }

    @Transactional
    public void delete(String id) {
        log.info("Deleting project id: {}", id);
        // Xóa ProjectData liên quan
        projectDataRepository.findFirstByProjectId(id).ifPresent(projectDataRepository::delete);
        projectRepository.deleteById(id);
        log.info("Project deleted successfully: {}", id);
    }
}

