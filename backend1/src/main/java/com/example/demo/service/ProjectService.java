package com.example.demo.service;

import com.example.demo.dto.CreateProjectRequest;
import com.example.demo.model.Project;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final ProjectDataRepository projectDataRepository;

    public ProjectService(ProjectRepository projectRepository, ProjectDataRepository projectDataRepository) {
        this.projectRepository = projectRepository;
        this.projectDataRepository = projectDataRepository;
    }

    @Transactional
    public Project create(CreateProjectRequest request) {
        Project project = new Project();
        project.setUserId(request.getUserId());
        project.setName(request.getName());
        project.setStatus(request.getStatus() != null ? request.getStatus() : "Draft");
        Project savedProject = projectRepository.save(project);

        // Tự động tạo ProjectData rỗng cho project mới
        ProjectData projectData = new ProjectData();
        projectData.setProjectId(savedProject.getId());
        projectDataRepository.save(projectData);

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
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        if (request.getName() != null) {
            project.setName(request.getName());
        }
        if (request.getStatus() != null) {
            project.setStatus(request.getStatus());
        }
        if (request.getUserId() != null) {
            project.setUserId(request.getUserId());
        }
        return projectRepository.save(project);
    }

    @Transactional
    public void delete(String id) {
        // Xóa ProjectData liên quan
        projectDataRepository.findFirstByProjectId(id).ifPresent(projectDataRepository::delete);
        projectRepository.deleteById(id);
    }
}

