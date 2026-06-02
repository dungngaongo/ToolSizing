package com.example.sizing.service;

import com.example.sizing.dto.CreateProjectDataRequest;
import com.example.sizing.dto.ProjectDataSectionResponse;
import com.example.sizing.dto.UpdateProjectDataRequest;
import com.example.sizing.exception.BadRequestException;
import com.example.sizing.exception.ResourceNotFoundException;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectData;
import com.example.sizing.repository.ProjectDataIdentityView;
import com.example.sizing.repository.ProjectDataRepository;
import com.example.sizing.repository.ProjectDataSectionView;
import com.example.sizing.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectDataService {
    private static final Logger log = LoggerFactory.getLogger(ProjectDataService.class);

    private final ProjectDataRepository projectDataRepository;
    private final ProjectRepository projectRepository;
    private final ActivityLogService activityLogService;
    private final ProjectDataAssetMigrationService projectDataAssetMigrationService;

    public ProjectDataService(ProjectDataRepository projectDataRepository,
                              ProjectRepository projectRepository,
                              ActivityLogService activityLogService,
                              ProjectDataAssetMigrationService projectDataAssetMigrationService) {
        this.projectDataRepository = projectDataRepository;
        this.projectRepository = projectRepository;
        this.activityLogService = activityLogService;
        this.projectDataAssetMigrationService = projectDataAssetMigrationService;
    }

    @Transactional
    public ProjectData create(CreateProjectDataRequest request) {
        log.info("Creating/updating ProjectData for projectId: {}", request.getProjectId());
        ensureProjectExists(request.getProjectId());
        request.setYeuCauBaiToanContent(sanitizeSectionContent(request.getProjectId(), "request", request.getYeuCauBaiToanContent()));
        request.setThongTinDauVaoContent(sanitizeSectionContent(request.getProjectId(), "input", request.getThongTinDauVaoContent()));
        request.setMoHinhHeThongContent(sanitizeSectionContent(request.getProjectId(), "model", request.getMoHinhHeThongContent()));
        request.setDinhCoHeThongContent(sanitizeSectionContent(request.getProjectId(), "sizing", request.getDinhCoHeThongContent()));
        request.setTongHopVaDeXuatContent(sanitizeSectionContent(request.getProjectId(), "summary", request.getTongHopVaDeXuatContent()));
        Optional<ProjectDataIdentityView> existing = projectDataRepository.findIdentityByProjectId(request.getProjectId());

        if (existing.isPresent()) {
            applyContentUpdates(request.getProjectId(), request);
            activityLogService.record(
                    "SAVE",
                    "PROJECT",
                    request.getProjectId(),
                    getProjectName(request.getProjectId()),
                    buildProjectDataSummary(request, false)
            );
            return buildPartialResponse(existing.get().getId(), request.getProjectId(), request);
        }

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
        return buildPartialResponse(saved.getId(), request.getProjectId(), request);
    }

    public List<ProjectData> getAll() {
        return projectDataRepository.findAll();
    }

    public Optional<ProjectData> getById(String id) {
        return projectDataRepository.findById(id);
    }

    public Optional<ProjectData> getByProjectId(String projectId) {
        return projectDataRepository.findFirstByProjectId(projectId)
                .map(this::sanitizeProjectDataIfNeeded);
    }

    @Transactional
    public Optional<ProjectDataSectionResponse> getSectionByProjectId(String projectId, String section) {
        ensureProjectExists(projectId);
        String normalizedSection = normalizeSection(section);
        return findSectionByProjectId(projectId, normalizedSection)
                .map(view -> {
                    ProjectDataAssetMigrationService.SectionMigrationResult migrationResult =
                            projectDataAssetMigrationService.sanitizeSection(projectId, normalizedSection, view.getContent());
                    if (migrationResult.changed()) {
                        updateSectionContent(projectId, normalizedSection, migrationResult.content());
                    }
                    return new ProjectDataSectionResponse(
                            view.getId(),
                            view.getProjectId(),
                            normalizedSection,
                            migrationResult.content(),
                            view.getReview(),
                            migrationResult.assetGroups()
                    );
                });
    }

    @Transactional
    public ProjectData update(String projectId, UpdateProjectDataRequest request) {
        log.info("Updating ProjectData for projectId: {}", projectId);
        ensureProjectExists(projectId);
        request.setYeuCauBaiToanContent(sanitizeSectionContent(projectId, "request", request.getYeuCauBaiToanContent()));
        request.setThongTinDauVaoContent(sanitizeSectionContent(projectId, "input", request.getThongTinDauVaoContent()));
        request.setMoHinhHeThongContent(sanitizeSectionContent(projectId, "model", request.getMoHinhHeThongContent()));
        request.setDinhCoHeThongContent(sanitizeSectionContent(projectId, "sizing", request.getDinhCoHeThongContent()));
        request.setTongHopVaDeXuatContent(sanitizeSectionContent(projectId, "summary", request.getTongHopVaDeXuatContent()));
        ProjectDataIdentityView projectData = projectDataRepository.findIdentityByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", projectId));

        applyContentUpdates(projectId, request);
        activityLogService.record(
                "SAVE",
                "PROJECT",
                projectId,
                getProjectName(projectId),
                buildProjectDataSummary(request, false)
        );
        return buildPartialResponse(projectData.getId(), projectId, request);
    }

    @Transactional
    public ProjectData saveEvaluation(String projectId, String section, String reviewJson) {
        String normalizedSection = normalizeSection(section);
        log.info("Saving evaluation for projectId: {}, section: {}", projectId, normalizedSection);
        ProjectDataIdentityView projectData = projectDataRepository.findIdentityByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", projectId));

        int updatedRows = switch (normalizedSection) {
            case "request" -> projectDataRepository.updateYeuCauAdminReview(projectId, reviewJson);
            case "input" -> projectDataRepository.updateThongTinAdminReview(projectId, reviewJson);
            case "model" -> projectDataRepository.updateMoHinhAdminReview(projectId, reviewJson);
            case "sizing" -> projectDataRepository.updateDinhCoAdminReview(projectId, reviewJson);
            default -> throw new BadRequestException("Unknown section: " + section);
        };

        if (updatedRows == 0) {
            throw new ResourceNotFoundException("ProjectData", "projectId", projectId);
        }

        activityLogService.record(
                "EVALUATE",
                "PROJECT",
                projectId,
                getProjectName(projectId),
                "ÄÃ¡nh giÃ¡ " + describeSection(normalizedSection)
        );
        return buildPartialEvaluationResponse(projectData.getId(), projectId, normalizedSection, reviewJson);
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
        return projectRepository.findNameById(projectId).orElse(projectId);
    }

    private String buildProjectDataSummary(CreateProjectDataRequest request, boolean isCreate) {
        String sections = joinSections(
                request.getYeuCauBaiToanContent(), "YÃªu cáº§u bÃ i toÃ¡n",
                request.getThongTinDauVaoContent(), "ThÃ´ng tin Ä‘áº§u vÃ o",
                request.getMoHinhHeThongContent(), "MÃ´ hÃ¬nh há»‡ thá»‘ng",
                request.getDinhCoHeThongContent(), "Äá»‹nh cá»¡ há»‡ thá»‘ng",
                request.getTongHopVaDeXuatContent(), "Tá»•ng há»£p vÃ  Ä‘á» xuáº¥t"
        );
        return (isCreate ? "Khá»Ÿi táº¡o" : "Cáº­p nháº­t") + (sections.isEmpty() ? " dá»¯ liá»‡u dá»± Ã¡n" : " " + sections);
    }

    private String buildProjectDataSummary(UpdateProjectDataRequest request, boolean isCreate) {
        String sections = joinSections(
                request.getYeuCauBaiToanContent(), "YÃªu cáº§u bÃ i toÃ¡n",
                request.getThongTinDauVaoContent(), "ThÃ´ng tin Ä‘áº§u vÃ o",
                request.getMoHinhHeThongContent(), "MÃ´ hÃ¬nh há»‡ thá»‘ng",
                request.getDinhCoHeThongContent(), "Äá»‹nh cá»¡ há»‡ thá»‘ng",
                request.getTongHopVaDeXuatContent(), "Tá»•ng há»£p vÃ  Ä‘á» xuáº¥t"
        );
        return (isCreate ? "Khá»Ÿi táº¡o" : "Cáº­p nháº­t") + (sections.isEmpty() ? " dá»¯ liá»‡u dá»± Ã¡n" : " " + sections);
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
        return switch (normalizeSection(section)) {
            case "request" -> "YÃªu cáº§u bÃ i toÃ¡n";
            case "input" -> "ThÃ´ng tin Ä‘áº§u vÃ o";
            case "model" -> "MÃ´ hÃ¬nh há»‡ thá»‘ng";
            case "sizing" -> "Äá»‹nh cá»¡ há»‡ thá»‘ng";
            default -> section;
        };
    }

    private Optional<ProjectDataSectionView> findSectionByProjectId(String projectId, String section) {
        return switch (normalizeSection(section)) {
            case "request" -> projectDataRepository.findRequestSectionByProjectId(projectId);
            case "input" -> projectDataRepository.findInputSectionByProjectId(projectId);
            case "model" -> projectDataRepository.findModelSectionByProjectId(projectId);
            case "sizing" -> projectDataRepository.findSizingSectionByProjectId(projectId);
            case "summary" -> projectDataRepository.findSummarySectionByProjectId(projectId);
            default -> throw new BadRequestException("Unknown section: " + section);
        };
    }

    private void applyContentUpdates(String projectId, CreateProjectDataRequest request) {
        if (request.getYeuCauBaiToanContent() != null) {
            projectDataRepository.updateYeuCauBaiToanContent(projectId, request.getYeuCauBaiToanContent());
        }
        if (request.getThongTinDauVaoContent() != null) {
            projectDataRepository.updateThongTinDauVaoContent(projectId, request.getThongTinDauVaoContent());
        }
        if (request.getMoHinhHeThongContent() != null) {
            projectDataRepository.updateMoHinhHeThongContent(projectId, request.getMoHinhHeThongContent());
        }
        if (request.getDinhCoHeThongContent() != null) {
            projectDataRepository.updateDinhCoHeThongContent(projectId, request.getDinhCoHeThongContent());
        }
        if (request.getTongHopVaDeXuatContent() != null) {
            projectDataRepository.updateTongHopVaDeXuatContent(projectId, request.getTongHopVaDeXuatContent());
        }
    }

    private void applyContentUpdates(String projectId, UpdateProjectDataRequest request) {
        if (request.getYeuCauBaiToanContent() != null) {
            projectDataRepository.updateYeuCauBaiToanContent(projectId, request.getYeuCauBaiToanContent());
        }
        if (request.getThongTinDauVaoContent() != null) {
            projectDataRepository.updateThongTinDauVaoContent(projectId, request.getThongTinDauVaoContent());
        }
        if (request.getMoHinhHeThongContent() != null) {
            projectDataRepository.updateMoHinhHeThongContent(projectId, request.getMoHinhHeThongContent());
        }
        if (request.getDinhCoHeThongContent() != null) {
            projectDataRepository.updateDinhCoHeThongContent(projectId, request.getDinhCoHeThongContent());
        }
        if (request.getTongHopVaDeXuatContent() != null) {
            projectDataRepository.updateTongHopVaDeXuatContent(projectId, request.getTongHopVaDeXuatContent());
        }
    }

    private ProjectData buildPartialResponse(String id, String projectId, CreateProjectDataRequest request) {
        ProjectData response = basePartialProjectData(id, projectId);
        response.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
        response.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
        response.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
        response.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
        response.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
        return response;
    }

    private ProjectData buildPartialResponse(String id, String projectId, UpdateProjectDataRequest request) {
        ProjectData response = basePartialProjectData(id, projectId);
        response.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
        response.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
        response.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
        response.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
        response.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
        return response;
    }

    private ProjectData buildPartialEvaluationResponse(String id, String projectId, String section, String reviewJson) {
        ProjectData response = basePartialProjectData(id, projectId);
        switch (section) {
            case "request" -> response.setYeuCauAdminReview(reviewJson);
            case "input" -> response.setThongTinAdminReview(reviewJson);
            case "model" -> response.setMoHinhAdminReview(reviewJson);
            case "sizing" -> response.setDinhCoAdminReview(reviewJson);
            default -> throw new BadRequestException("Unknown section: " + section);
        }
        return response;
    }

    private ProjectData basePartialProjectData(String id, String projectId) {
        ProjectData response = new ProjectData();
        response.setId(id);
        Project project = new Project();
        project.setId(projectId);
        response.setProject(project);
        return response;
    }

    private String normalizeSection(String section) {
        if (section == null || section.isBlank()) {
            throw new BadRequestException("section is required");
        }
        return section.trim().toLowerCase();
    }

    private String sanitizeSectionContent(String projectId, String section, String content) {
        if (content == null) {
            return null;
        }
        return projectDataAssetMigrationService.sanitizeSection(projectId, section, content).content();
    }

    private ProjectData sanitizeProjectDataIfNeeded(ProjectData projectData) {
        ProjectDataAssetMigrationService.SanitizedProjectData sanitized = projectDataAssetMigrationService.sanitizeProjectData(projectData);
        if (sanitized.changed()) {
            return projectDataRepository.save(sanitized.projectData());
        }
        return sanitized.projectData();
    }

    private void updateSectionContent(String projectId, String section, String content) {
        switch (normalizeSection(section)) {
            case "request" -> projectDataRepository.updateYeuCauBaiToanContent(projectId, content);
            case "input" -> projectDataRepository.updateThongTinDauVaoContent(projectId, content);
            case "model" -> projectDataRepository.updateMoHinhHeThongContent(projectId, content);
            case "sizing" -> projectDataRepository.updateDinhCoHeThongContent(projectId, content);
            case "summary" -> projectDataRepository.updateTongHopVaDeXuatContent(projectId, content);
            default -> throw new BadRequestException("Unknown section: " + section);
        }
    }
}
