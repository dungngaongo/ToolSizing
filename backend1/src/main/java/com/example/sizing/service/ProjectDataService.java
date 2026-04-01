package com.example.sizing.service;

import com.example.sizing.dto.CreateProjectDataRequest;
import com.example.sizing.dto.UpdateProjectDataRequest;
import com.example.sizing.exception.BadRequestException;
import com.example.sizing.exception.ResourceNotFoundException;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectData;
import com.example.sizing.repository.ProjectRepository;
import com.example.sizing.repository.ProjectDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectDataService {
    private static final Logger log = LoggerFactory.getLogger(ProjectDataService.class);

    private final ProjectDataRepository projectDataRepository;
    private final ProjectRepository projectRepository;

    public ProjectDataService(ProjectDataRepository projectDataRepository, ProjectRepository projectRepository) {
        this.projectDataRepository = projectDataRepository;
        this.projectRepository = projectRepository;
    }

    private final ObjectMapper mapper = new ObjectMapper();

    public ProjectData create(CreateProjectDataRequest request) {
        log.info("Creating/updating ProjectData for projectId: {}", request.getProjectId());
        ensureProjectExists(request.getProjectId());
        // Kiểm tra xem đã có ProjectData cho project này chưa
        Optional<ProjectData> existing = projectDataRepository.findFirstByProjectId(request.getProjectId());
        
        if (existing.isPresent()) {
            // Nếu đã tồn tại, cập nhật thay vì tạo mới
            ProjectData projectData = existing.get();
            if (request.getYeuCauBaiToanContent() != null) {
                projectData.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
            }
            if (request.getThongTinDauVaoContent() != null) {
                projectData.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
            }
            if (request.getMoHinhHeThongContent() != null) {
                projectData.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
            }
            if (request.getDinhCoHeThongContent() != null) {
                projectData.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
            }
            if (request.getTongHopVaDeXuatContent() != null) {
                projectData.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
            }
            return projectDataRepository.save(projectData);
        }
        
        // Tạo mới nếu chưa tồn tại
        ProjectData projectData = new ProjectData();
        Project project = projectRepository.getReferenceById(request.getProjectId());
        projectData.setProject(project);
        projectData.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
        projectData.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
        projectData.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
        projectData.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
        projectData.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
        return projectDataRepository.save(projectData);
    }

    public List<ProjectData> getAll() {
        return projectDataRepository.findAll();
    }

    public Optional<ProjectData> getById(String id) {
        return projectDataRepository.findById(id);
    }

    public Optional<ProjectData> getByProjectId(String projectId) {
        // Sử dụng findFirstByProjectId để tránh lỗi khi có nhiều bản ghi
        return projectDataRepository.findFirstByProjectId(projectId);
    }

    public ProjectData update(String projectId, UpdateProjectDataRequest request) {
        log.info("Updating ProjectData for projectId: {}", projectId);
        ensureProjectExists(projectId);
        // Sử dụng findFirstByProjectId để tránh lỗi khi có nhiều bản ghi
        ProjectData projectData = projectDataRepository.findFirstByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", projectId));

        if (request.getYeuCauBaiToanContent() != null) {
            projectData.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
        }
        if (request.getThongTinDauVaoContent() != null) {
            projectData.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
        }
        if (request.getMoHinhHeThongContent() != null) {
            projectData.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
        }
        if (request.getDinhCoHeThongContent() != null) {
            projectData.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
        }
        if (request.getTongHopVaDeXuatContent() != null) {
            projectData.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
        }

        return projectDataRepository.save(projectData);
    }

    @Transactional
    public ProjectData saveEvaluation(String projectId, String section, String reviewJson) {
        log.info("Saving evaluation for projectId: {}, section: {}", projectId, section);
        ProjectData projectData = projectDataRepository.findFirstByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", projectId));

        switch (section) {
            case "request":
                // store admin review separately; do NOT merge into content
                projectData.setYeuCauAdminReview(reviewJson);
                break;
            case "input":
                projectData.setThongTinAdminReview(reviewJson);
                break;
            case "model":
                projectData.setMoHinhAdminReview(reviewJson);
                break;
            case "sizing":
                projectData.setDinhCoAdminReview(reviewJson);
                break;
            default:
                throw new BadRequestException("Unknown section: " + section);
        }

        return projectDataRepository.save(projectData);
    }

    public void delete(String id) {
        log.info("Deleting ProjectData id: {}", id);
        projectDataRepository.deleteById(id);
    }
    
    @Transactional
    public void cleanupDuplicates(String projectId) {
        log.info("Cleaning up duplicate ProjectData for projectId: {}", projectId);
        List<ProjectData> allData = projectDataRepository.findByProjectId(projectId);
        if (allData.size() > 1) {
            log.warn("Found {} duplicate ProjectData records for projectId: {}, removing extras", allData.size(), projectId);
            // Giữ lại bản ghi đầu tiên, xóa các bản ghi còn lại
            for (int i = 1; i < allData.size(); i++) {
                projectDataRepository.deleteById(allData.get(i).getId());
            }
        }
    }

    private void ensureProjectExists(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            throw new BadRequestException("projectId is required");
        }
        if (!projectRepository.existsById(projectId)) {
            throw new BadRequestException("Invalid projectId: " + projectId);
        }
    }
}
