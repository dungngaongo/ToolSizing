package com.example.demo.service;

import com.example.demo.dto.CreateProjectRevisionRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.model.ProjectRevision;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRevisionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectRevisionService {
    private final ProjectRevisionRepository projectRevisionRepository;
    private final ProjectDataRepository projectDataRepository;
    private final ObjectMapper objectMapper;

    public ProjectRevisionService(ProjectRevisionRepository projectRevisionRepository,
                                   ProjectDataRepository projectDataRepository,
                                   ObjectMapper objectMapper) {
        this.projectRevisionRepository = projectRevisionRepository;
        this.projectDataRepository = projectDataRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Tạo một revision mới - lưu snapshot của ProjectData hiện tại
     */
    public ProjectRevision createRevision(CreateProjectRevisionRequest request) {
        // Lấy ProjectData hiện tại
        ProjectData projectData = projectDataRepository.findFirstByProjectId(request.getProjectId())
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + request.getProjectId()));

        // Tạo snapshot JSON từ ProjectData
        String snapshotContent;
        try {
            snapshotContent = objectMapper.writeValueAsString(projectData);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to create snapshot", e);
        }

        ProjectRevision revision = new ProjectRevision();
        revision.setProjectId(request.getProjectId());
        revision.setUserId(request.getUserId());
        revision.setSnapshotContent(snapshotContent);
        revision.setChangeLog(request.getChangeLog());

        return projectRevisionRepository.save(revision);
    }

    public List<ProjectRevision> getAll() {
        return projectRevisionRepository.findAll();
    }

    public Optional<ProjectRevision> getById(String id) {
        return projectRevisionRepository.findById(id);
    }

    public List<ProjectRevision> getByProjectId(String projectId) {
        return projectRevisionRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    public List<ProjectRevision> getByUserId(String userId) {
        return projectRevisionRepository.findByUserId(userId);
    }

    /**
     * Khôi phục ProjectData từ một revision cụ thể
     */
    public ProjectData restoreFromRevision(String revisionId) {
        ProjectRevision revision = projectRevisionRepository.findById(revisionId)
                .orElseThrow(() -> new RuntimeException("Revision not found: " + revisionId));

        ProjectData projectData = projectDataRepository.findFirstByProjectId(revision.getProjectId())
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + revision.getProjectId()));

        // Parse snapshot và cập nhật ProjectData
        try {
            ProjectData snapshot = objectMapper.readValue(revision.getSnapshotContent(), ProjectData.class);
            projectData.setYeuCauBaiToanContent(snapshot.getYeuCauBaiToanContent());
            projectData.setThongTinDauVaoContent(snapshot.getThongTinDauVaoContent());
            projectData.setMoHinhHeThongContent(snapshot.getMoHinhHeThongContent());
            projectData.setDinhCoHeThongContent(snapshot.getDinhCoHeThongContent());
            projectData.setTongHopVaDeXuatContent(snapshot.getTongHopVaDeXuatContent());
            return projectDataRepository.save(projectData);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to restore from snapshot", e);
        }
    }

    public void delete(String id) {
        projectRevisionRepository.deleteById(id);
    }
}

