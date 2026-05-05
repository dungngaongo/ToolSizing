package com.example.sizing.service;

import com.example.demo.dto.CreateProjectDataRequest;
import com.example.demo.dto.UpdateProjectDataRequest;
import com.example.demo.exception.BadRequestException;
import com.example.demo.exception.ResourceNotFoundException;
import com.example.demo.model.Project;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectRepository;
import com.example.demo.repository.ProjectDataRepository;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
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
    private final ActivityLogService activityLogService;

    public ProjectDataService(ProjectDataRepository projectDataRepository,
                              ProjectRepository projectRepository,
                              ActivityLogService activityLogService) {
        this.projectDataRepository = projectDataRepository;
        this.projectRepository = projectRepository;
        this.activityLogService = activityLogService;
    }

    private final ObjectMapper mapper = new ObjectMapper();

    @Transactional
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
                ProjectData saved = projectDataRepository.save(projectData);
                    activityLogService.record(
                        "SAVE",
                        "PROJECT",
                        request.getProjectId(),
                        getProjectName(request.getProjectId()),
                        buildProjectDataSummary(request, false)
                    );
                return saved;
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
        ProjectData saved = projectDataRepository.save(projectData);
        activityLogService.record(
            "SAVE",
            "PROJECT",
            request.getProjectId(),
            getProjectName(request.getProjectId()),
            buildProjectDataSummary(request, true)
        );
        return saved;
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

    @Transactional
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

        ProjectData saved = projectDataRepository.save(projectData);
        activityLogService.record(
            "SAVE",
            "PROJECT",
            projectId,
            getProjectName(projectId),
            buildProjectDataSummary(request, false)
        );
        return saved;
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

        ProjectData saved = projectDataRepository.save(projectData);
        activityLogService.record(
            "EVALUATE",
            "PROJECT",
            projectId,
            getProjectName(projectId),
            "Đánh giá " + describeSection(section) + ""
        );
        return saved;
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

    private String getProjectName(String projectId) {
        return projectRepository.findById(projectId).map(Project::getName).orElse(projectId);
    }

    private String buildProjectDataSummary(CreateProjectDataRequest request, boolean isCreate) {
        String sections = joinSections(
                request.getYeuCauBaiToanContent(), "Yêu cầu bài toán",
                request.getThongTinDauVaoContent(), "Thông tin đầu vào",
                request.getMoHinhHeThongContent(), "Mô hình hệ thống",
                request.getDinhCoHeThongContent(), "Định cỡ hệ thống",
                request.getTongHopVaDeXuatContent(), "Tổng hợp và đề xuất"
        );
        return (isCreate ? "Khởi tạo" : "Cập nhật") + (sections.isEmpty() ? " dữ liệu dự án" : " " + sections);
    }

    private String buildProjectDataSummary(UpdateProjectDataRequest request, boolean isCreate) {
        String sections = joinSections(
                request.getYeuCauBaiToanContent(), "Yêu cầu bài toán",
                request.getThongTinDauVaoContent(), "Thông tin đầu vào",
                request.getMoHinhHeThongContent(), "Mô hình hệ thống",
                request.getDinhCoHeThongContent(), "Định cỡ hệ thống",
                request.getTongHopVaDeXuatContent(), "Tổng hợp và đề xuất"
        );
        return (isCreate ? "Khởi tạo" : "Cập nhật") + (sections.isEmpty() ? " dữ liệu dự án" : " " + sections);
    }

    private String joinSections(String... pairs) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < pairs.length; i += 2) {
            String value = pairs[i];
            String label = pairs[i + 1];
            if (value != null) {
                if (sb.length() > 0) sb.append(", ");
                sb.append(label);
            }
        }
        return sb.toString();
    }

    private String describeSection(String section) {
        return switch (section) {
            case "request" -> "Yêu cầu bài toán";
            case "input" -> "Thông tin đầu vào";
            case "model" -> "Mô hình hệ thống";
            case "sizing" -> "Định cỡ hệ thống";
            default -> section;
        };
    }
}
