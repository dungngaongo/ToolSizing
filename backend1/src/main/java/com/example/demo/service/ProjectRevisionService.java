package com.example.demo.service;

import com.example.demo.exception.BadRequestException;
import com.example.demo.exception.ResourceNotFoundException;
import com.example.demo.dto.CreateProjectRevisionRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.model.ProjectRevision;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRevisionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ProjectRevisionService {
    private static final Logger log = LoggerFactory.getLogger(ProjectRevisionService.class);

    private final ProjectRevisionRepository projectRevisionRepository;
    private final ProjectDataRepository projectDataRepository;
    private final ObjectMapper objectMapper;

    // Sau mỗi MAX_INCREMENTALS incremental revisions, tự động tạo baseline mới
    private static final int MAX_INCREMENTALS_BEFORE_BASELINE = 10;

    // Danh sách các trường nội dung cần so sánh diff
    private static final String[] CONTENT_FIELDS = {
        "yeuCauBaiToanContent", "thongTinDauVaoContent", "moHinhHeThongContent",
        "dinhCoHeThongContent", "tongHopVaDeXuatContent",
        "yeuCauAdminReview", "thongTinAdminReview", "moHinhAdminReview", "dinhCoAdminReview"
    };

    public ProjectRevisionService(ProjectRevisionRepository projectRevisionRepository,
                                   ProjectDataRepository projectDataRepository,
                                   ObjectMapper objectMapper) {
        this.projectRevisionRepository = projectRevisionRepository;
        this.projectDataRepository = projectDataRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Tạo revision mới - tự động chọn BASELINE hoặc INCREMENTAL
     * - Nếu chưa có baseline nào, hoặc forceBaseline=true, hoặc đã quá MAX_INCREMENTALS -> tạo BASELINE
     * - Ngược lại -> tạo INCREMENTAL (chỉ lưu phần thay đổi)
     */
    public ProjectRevision createRevision(CreateProjectRevisionRequest request) {
        log.info("Creating revision for projectId: {}, userId: {}, forceBaseline: {}",
                request.getProjectId(), request.getUserId(), request.isForceBaseline());
        // Lấy ProjectData hiện tại
        ProjectData projectData = projectDataRepository.findFirstByProjectId(request.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", request.getProjectId()));

        // Tạo JSON snapshot đầy đủ từ ProjectData hiện tại
        String currentFullSnapshot;
        try {
            currentFullSnapshot = objectMapper.writeValueAsString(projectData);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Failed to create snapshot: " + e.getMessage());
        }

        // Tìm baseline gần nhất
        Optional<ProjectRevision> latestBaselineOpt = projectRevisionRepository
                .findFirstByProjectIdAndRevisionTypeOrderByCreatedAtDesc(request.getProjectId(), "BASELINE");

        boolean shouldCreateBaseline = request.isForceBaseline() || latestBaselineOpt.isEmpty();

        // Nếu đã có baseline, kiểm tra số lượng incremental
        if (!shouldCreateBaseline && latestBaselineOpt.isPresent()) {
            String baselineId = latestBaselineOpt.get().getId();
            long incrementalCount = projectRevisionRepository
                    .countByProjectIdAndRevisionTypeAndBaselineId(request.getProjectId(), "INCREMENTAL", baselineId);
            if (incrementalCount >= MAX_INCREMENTALS_BEFORE_BASELINE) {
                shouldCreateBaseline = true;
            }
        }

        ProjectRevision revision = new ProjectRevision();
        revision.setProjectId(request.getProjectId());
        revision.setUserId(request.getUserId());
        revision.setChangeLog(request.getChangeLog());

        if (shouldCreateBaseline) {
            // === TẠO BASELINE: lưu full snapshot ===
            log.info("Creating BASELINE revision for projectId: {}", request.getProjectId());
            revision.setRevisionType("BASELINE");
            revision.setSnapshotContent(currentFullSnapshot);
            revision.setBaselineId(null);
        } else {
            // === TẠO INCREMENTAL: chỉ lưu phần thay đổi ===
            log.info("Creating INCREMENTAL revision for projectId: {}", request.getProjectId());
            String baselineId = latestBaselineOpt.get().getId();
            revision.setRevisionType("INCREMENTAL");
            revision.setBaselineId(baselineId);

            // Reconstruct trạng thái tại revision trước đó
            String previousFullSnapshot = reconstructFullSnapshotJson(request.getProjectId(), baselineId);

            // Tính diff giữa trạng thái trước và hiện tại
            String diffContent = computeDiff(previousFullSnapshot, currentFullSnapshot);

            if (diffContent == null || diffContent.equals("{}")) {
                // Không có thay đổi, không tạo revision
                log.info("No changes detected for projectId: {}, skipping revision creation", request.getProjectId());
                return null;
            }

            revision.setSnapshotContent(diffContent);
        }

        return projectRevisionRepository.save(revision);
    }

    /**
     * Tính toán diff giữa 2 snapshot - chỉ giữ lại các trường content thay đổi
     */
    private String computeDiff(String previousSnapshot, String currentSnapshot) {
        try {
            JsonNode prevNode = objectMapper.readTree(previousSnapshot);
            JsonNode currNode = objectMapper.readTree(currentSnapshot);

            ObjectNode diffNode = objectMapper.createObjectNode();
            boolean hasChanges = false;

            for (String field : CONTENT_FIELDS) {
                JsonNode prevField = prevNode.get(field);
                JsonNode currField = currNode.get(field);

                String prevVal = prevField != null && !prevField.isNull() ? prevField.asText() : "";
                String currVal = currField != null && !currField.isNull() ? currField.asText() : "";

                if (!prevVal.equals(currVal)) {
                    diffNode.put(field, currVal);
                    hasChanges = true;
                }
            }

            if (!hasChanges) return null;
            return objectMapper.writeValueAsString(diffNode);
        } catch (Exception e) {
            throw new BadRequestException("Failed to compute diff: " + e.getMessage());
        }
    }

    /**
     * Reconstruct full snapshot tại thời điểm cuối cùng từ baseline + tất cả incrementals
     */
    private String reconstructFullSnapshotJson(String projectId, String baselineId) {
        List<ProjectRevision> allRevisions = projectRevisionRepository
                .findAllFromBaseline(projectId, baselineId);

        if (allRevisions.isEmpty()) {
            throw new ResourceNotFoundException("Revision baseline", "baselineId", baselineId);
        }

        try {
            // Bắt đầu với baseline snapshot
            ProjectRevision baseline = allRevisions.get(0);
            ObjectNode fullSnapshot = (ObjectNode) objectMapper.readTree(baseline.getSnapshotContent());

            // Áp dụng lần lượt các incremental lên baseline
            for (int i = 1; i < allRevisions.size(); i++) {
                ProjectRevision inc = allRevisions.get(i);
                if ("INCREMENTAL".equals(inc.getRevisionType()) && inc.getSnapshotContent() != null) {
                    JsonNode diffNode = objectMapper.readTree(inc.getSnapshotContent());
                    Iterator<Map.Entry<String, JsonNode>> fields = diffNode.fields();
                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        fullSnapshot.set(entry.getKey(), entry.getValue());
                    }
                }
            }

            return objectMapper.writeValueAsString(fullSnapshot);
        } catch (Exception e) {
            throw new BadRequestException("Failed to reconstruct snapshot: " + e.getMessage());
        }
    }

    /**
     * Reconstruct full snapshot tại một revision cụ thể
     * - Nếu là BASELINE: trả về trực tiếp snapshotContent
     * - Nếu là INCREMENTAL: tìm baseline rồi áp dụng các incrementals đến revision đó
     */
    public String reconstructAtRevision(String revisionId) {
        log.debug("Reconstructing snapshot at revisionId: {}", revisionId);
        ProjectRevision revision = projectRevisionRepository.findById(revisionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectRevision", "id", revisionId));

        // BASELINE hoặc legacy revision (revisionType = null) -> trả về trực tiếp snapshotContent
        if ("BASELINE".equals(revision.getRevisionType()) || revision.getRevisionType() == null) {
            return revision.getSnapshotContent();
        }

        // Là INCREMENTAL -> cần reconstruct
        String baselineId = revision.getBaselineId();
        if (baselineId == null) {
            throw new BadRequestException("Incremental revision without baselineId: " + revisionId);
        }

        List<ProjectRevision> allRevisions = projectRevisionRepository
                .findAllFromBaseline(revision.getProjectId(), baselineId);

        try {
            // Bắt đầu với baseline
            ProjectRevision baseline = allRevisions.get(0);
            ObjectNode fullSnapshot = (ObjectNode) objectMapper.readTree(baseline.getSnapshotContent());

            // Áp dụng incrementals cho đến revision target
            for (int i = 1; i < allRevisions.size(); i++) {
                ProjectRevision inc = allRevisions.get(i);
                if ("INCREMENTAL".equals(inc.getRevisionType()) && inc.getSnapshotContent() != null) {
                    JsonNode diffNode = objectMapper.readTree(inc.getSnapshotContent());
                    Iterator<Map.Entry<String, JsonNode>> fields = diffNode.fields();
                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        fullSnapshot.set(entry.getKey(), entry.getValue());
                    }
                }
                // Dừng khi đã đến revision target
                if (inc.getId().equals(revisionId)) break;
            }

            return objectMapper.writeValueAsString(fullSnapshot);
        } catch (Exception e) {
            throw new BadRequestException("Failed to reconstruct at revision: " + e.getMessage());
        }
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
     * Reconstruct full state từ baseline + incrementals, rồi áp dụng lên ProjectData
     */
    public ProjectData restoreFromRevision(String revisionId) {
        log.info("Restoring ProjectData from revisionId: {}", revisionId);
        ProjectRevision revision = projectRevisionRepository.findById(revisionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectRevision", "id", revisionId));

        ProjectData projectData = projectDataRepository.findFirstByProjectId(revision.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", revision.getProjectId()));

        try {
            // Reconstruct full snapshot tại revision đó
            String fullSnapshotJson = reconstructAtRevision(revisionId);
            ProjectData snapshot = objectMapper.readValue(fullSnapshotJson, ProjectData.class);

            projectData.setYeuCauBaiToanContent(snapshot.getYeuCauBaiToanContent());
            projectData.setThongTinDauVaoContent(snapshot.getThongTinDauVaoContent());
            projectData.setMoHinhHeThongContent(snapshot.getMoHinhHeThongContent());
            projectData.setDinhCoHeThongContent(snapshot.getDinhCoHeThongContent());
            projectData.setTongHopVaDeXuatContent(snapshot.getTongHopVaDeXuatContent());
            return projectDataRepository.save(projectData);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Failed to restore from snapshot: " + e.getMessage());
        }
    }

    public void delete(String id) {
        log.info("Deleting revision id: {}", id);
        projectRevisionRepository.deleteById(id);
    }
}

