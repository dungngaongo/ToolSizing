package com.example.demo.service;

import com.example.demo.dto.CreateProjectDataRequest;
import com.example.demo.dto.UpdateProjectDataRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectDataService {
    private final ProjectDataRepository projectDataRepository;

    public ProjectDataService(ProjectDataRepository projectDataRepository) {
        this.projectDataRepository = projectDataRepository;
    }

    private final ObjectMapper mapper = new ObjectMapper();

    public ProjectData create(CreateProjectDataRequest request) {
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
        projectData.setProjectId(request.getProjectId());
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
        // Sử dụng findFirstByProjectId để tránh lỗi khi có nhiều bản ghi
        ProjectData projectData = projectDataRepository.findFirstByProjectId(projectId)
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + projectId));

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
        ProjectData projectData = projectDataRepository.findFirstByProjectId(projectId)
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + projectId));

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
            default:
                throw new RuntimeException("Unknown section: " + section);
        }

        return projectDataRepository.save(projectData);
    }

    public void delete(String id) {
        projectDataRepository.deleteById(id);
    }
    
    @Transactional
    public void cleanupDuplicates(String projectId) {
        List<ProjectData> allData = projectDataRepository.findByProjectId(projectId);
        if (allData.size() > 1) {
            // Giữ lại bản ghi đầu tiên, xóa các bản ghi còn lại
            for (int i = 1; i < allData.size(); i++) {
                projectDataRepository.deleteById(allData.get(i).getId());
            }
        }
    }
}
