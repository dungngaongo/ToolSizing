package com.example.sizing.service;

import com.example.sizing.dto.ApprovalIssue;
import com.example.sizing.dto.CreateProjectRequest;
import com.example.sizing.exception.ApprovalBlockedException;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectData;
import com.example.sizing.model.User;
import com.example.sizing.repository.ProjectDataRepository;
import com.example.sizing.repository.ProjectRepository;
import com.example.sizing.repository.ProjectRevisionRepository;
import com.example.sizing.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.sizing.exception.BadRequestException;
import com.example.sizing.exception.ForbiddenException;
import com.example.sizing.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ProjectService {
    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

    private final ProjectRepository projectRepository;
    private final ProjectDataRepository projectDataRepository;
    private final ProjectRevisionRepository projectRevisionRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProjectService(ProjectRepository projectRepository,
                          ProjectDataRepository projectDataRepository,
                          ProjectRevisionRepository projectRevisionRepository,
                          UserRepository userRepository,
                          ActivityLogService activityLogService) {
        this.projectRepository = projectRepository;
        this.projectDataRepository = projectDataRepository;
        this.projectRevisionRepository = projectRevisionRepository;
        this.userRepository = userRepository;
        this.activityLogService = activityLogService;
    }

    @Transactional
    public Project create(CreateProjectRequest request) {
        // Tự động gán userId từ user đang đăng nhập nếu chưa có
        String userId = request.getUserId();
        if (userId == null || userId.isBlank()) {
            User currentUser = getCurrentAuthUser();
            if (currentUser != null) {
                userId = currentUser.getId();
            }
        } else {
            ensureUserExists(userId, "project owner");
        }
        log.info("Creating project '{}' for userId: {}", request.getName(), userId);
        Project project = new Project();
        if (userId != null && !userId.isBlank()) {
            project.setOwner(userRepository.getReferenceById(userId));
        }
        project.setName(request.getName());
        project.setDevUnit(request.getDevUnit());
        project.setOwnerName(request.getOwnerName());
        project.setStatus(request.getStatus() != null ? request.getStatus() : "SIZING");
        project.setStatusRound(request.getStatusRound() != null ? request.getStatusRound() : 1);
        Project savedProject = projectRepository.save(project);

        // Tự động tạo ProjectData rỗng cho project mới
        ProjectData projectData = new ProjectData();
        // Link trực tiếp entity Project đã được persist để tránh lỗi transient reference
        projectData.setProject(savedProject);
        projectDataRepository.save(projectData);

        activityLogService.record(
            "CREATE",
            "PROJECT",
            savedProject.getId(),
            savedProject.getName(),
            "Tạo dự án " + savedProject.getName()
        );

        log.info("Project created successfully with id: {}", savedProject.getId());
        return savedProject;
    }

    public List<Project> getAll() {
        return projectRepository.findAll();
    }

    public Optional<Project> getById(String id) {
        // Kiểm tra quyền truy cập
        if (!canAccessProject(id)) {
            throw new ForbiddenException("Bạn không có quyền xem dự án này");
        }
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

    @Transactional
    public Project update(String id, CreateProjectRequest request) {
        log.info("Updating project id: {}", id);
        // Kiểm tra quyền truy cập
        if (!canAccessProject(id)) {
            throw new ForbiddenException("Bạn không có quyền cập nhật dự án này");
        }
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        String currentStatus = project.getStatus();
        int currentRound = project.getStatusRound() != null ? project.getStatusRound() : 1;
        if (request.getName() != null) {
            project.setName(request.getName());
        }
        if (request.getStatus() != null) {
            String newStatus = request.getStatus();
            if ("HOAN_THANH".equalsIgnoreCase(newStatus)) {
                throw new BadRequestException("Không thể chuyển dự án sang HOAN_THANH bằng API cập nhật thường. Vui lòng dùng luồng phê duyệt.");
            }
            project.setStatus(newStatus);
            if ("SIZING".equalsIgnoreCase(newStatus) && isReviewStatus(currentStatus)) {
                project.setStatusRound(currentRound + 1);
            } else if (request.getStatusRound() != null) {
                project.setStatusRound(request.getStatusRound());
            }
        }
        if (request.getStatus() == null && request.getStatusRound() != null) {
            project.setStatusRound(request.getStatusRound());
        }
        if (request.getUserId() != null) {
            ensureUserExists(request.getUserId(), "project owner");
            project.setOwner(userRepository.getReferenceById(request.getUserId()));
        }
        if (request.getDevUnit() != null) {
            project.setDevUnit(request.getDevUnit());
        }
        if (request.getOwnerName() != null) {
            project.setOwnerName(request.getOwnerName());
        }
        Project saved = projectRepository.save(project);
        activityLogService.record(
            "UPDATE",
            "PROJECT",
            saved.getId(),
            saved.getName(),
            "Cập nhật thông tin dự án"
        );
        return saved;
    }

    private boolean isReviewStatus(String status) {
        if (status == null) {
            return false;
        }
        String normalized = status.trim().toUpperCase();
        return "THAM_DINH".equals(normalized) || "PHE_DUYET".equals(normalized);
    }

    @Transactional
    public Project approveProject(String id) {
        if (!canAccessProject(id)) {
            throw new ForbiddenException("Bạn không có quyền phê duyệt dự án này");
        }

        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));

        String currentStatus = project.getStatus() == null ? "" : project.getStatus().trim().toUpperCase();
        if (!"THAM_DINH".equals(currentStatus) && !"PHE_DUYET".equals(currentStatus)) {
            List<ApprovalIssue> issues = List.of(new ApprovalIssue(null, "INVALID_STATUS",
                    "Chỉ có thể phê duyệt dự án khi đang ở trạng thái THAM_DINH hoặc PHE_DUYET"));
            throw new ApprovalBlockedException("Dự án chưa ở trạng thái cho phép phê duyệt.", issues);
        }

        ProjectData projectData = projectDataRepository.findFirstByProjectId(id)
                .orElseThrow(() -> new ApprovalBlockedException(
                        "Dự án chưa có dữ liệu đánh giá để phê duyệt.",
                        List.of(new ApprovalIssue("request", "SECTION_NOT_REVIEWED", "Chưa có dữ liệu đánh giá admin cho dự án này"))
                ));

        List<ApprovalIssue> approvalIssues = new ArrayList<>();
        validateApprovalSection("request", "Yêu cầu bài toán", projectData.getYeuCauAdminReview(), approvalIssues);
        validateApprovalSection("input", "Thông tin đầu vào", projectData.getThongTinAdminReview(), approvalIssues);
        validateApprovalSection("model", "Mô hình hệ thống", projectData.getMoHinhAdminReview(), approvalIssues);
        validateApprovalSection("sizing", "Định cỡ hệ thống", projectData.getDinhCoAdminReview(), approvalIssues);
        validateApprovalSection("summary", "Tổng hợp và đề xuất", projectData.getTongHopAdminReview(), approvalIssues);

        if (!approvalIssues.isEmpty()) {
            throw new ApprovalBlockedException(
                    "Không thể phê duyệt. Vui lòng hoàn tất đánh giá admin và bảo đảm tất cả đều OK.",
                    approvalIssues
            );
        }

        project.setStatus("HOAN_THANH");
        Project saved = projectRepository.save(project);
        activityLogService.record(
                "APPROVE",
                "PROJECT",
                saved.getId(),
                saved.getName(),
                "Phê duyệt dự án"
        );
        return saved;
    }

    @Transactional
    public void delete(String id) {
        log.info("Deleting project id: {}", id);
        Project project = projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        // Backward compatible cleanup for environments where FK cascade is not yet active.
        projectDataRepository.deleteByProjectId(id);
        projectRevisionRepository.deleteByProjectId(id);
        projectRepository.deleteById(id);
        activityLogService.record(
            "DELETE",
            "PROJECT",
            project.getId(),
            project.getName(),
            "Xóa dự án"
        );
        log.info("Project deleted successfully: {}", id);
    }

    /**
     * Lấy danh sách dự án theo quyền của user hiện tại:
     * - admin2: tất cả dự án
     * - admin1: chỉ dự án được chỉ định đánh giá (assignedAdmin1Id)
     * - user: chỉ dự án do user tạo (userId)
     */
    public List<Project> getProjectsForCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return List.of();
        }
        String username = auth.getName();
        User currentUser = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        String role = currentUser.getRole() == null ? "user" : currentUser.getRole().toLowerCase();

        switch (role) {
            case "admin2":
                log.debug("Admin2 '{}' fetching all projects", username);
                return projectRepository.findAll();
            case "admin1":
                log.debug("Admin1 '{}' fetching assigned projects", username);
                return projectRepository.findByAssignedAdmin1Id(currentUser.getId());
            default:
                log.debug("User '{}' fetching own projects", username);
                return projectRepository.findByUserId(currentUser.getId());
        }
    }

    /**
     * Admin2 chỉ định admin1 thẩm định/đánh giá dự án.
     */
    @Transactional
    public Project assignAdmin1ToProject(String projectId, String admin1Id) {
        // Kiểm tra quyền: chỉ admin2
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream()
                .noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN2"))) {
            throw new ForbiddenException("Chỉ admin2 mới có quyền chỉ định người thẩm định");
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        if (admin1Id == null || admin1Id.isBlank()) {
            // Bỏ chỉ định
            log.info("Removing admin1 assignment from project '{}'", project.getName());
            project.setAssignedAdmin1(null);
        } else {
            // Kiểm tra admin1 tồn tại và có role admin1
            User admin1 = userRepository.findById(admin1Id)
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", admin1Id));
            if (!"admin1".equalsIgnoreCase(admin1.getRole())) {
                throw new BadRequestException("User '" + admin1.getUsername() + "' không có role admin1");
            }
            log.info("Assigning admin1 '{}' to project '{}'", admin1.getUsername(), project.getName());
            project.setAssignedAdmin1(admin1);
        }

        Project saved = projectRepository.save(project);
        activityLogService.record(
            "UPDATE",
            "PROJECT",
            saved.getId(),
            saved.getName(),
            admin1Id == null || admin1Id.isBlank()
                ? "Bỏ chỉ định người thẩm định"
                : "Chỉ định người thẩm định"
        );
        return saved;
    }

    /**
     * Lấy danh sách user có role admin1 (để admin2 chọn chỉ định).
     */
    public List<User> getAdmin1Users() {
        return userRepository.findByRole("admin1");
    }

    /**
     * Kiểm tra user hiện tại có quyền xem dự án cụ thể không.
     */
    public boolean canAccessProject(String projectId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        String username = auth.getName();
        User currentUser = userRepository.findByUsername(username).orElse(null);
        if (currentUser == null) return false;

        String role = currentUser.getRole() == null ? "user" : currentUser.getRole().toLowerCase();
        if ("admin2".equals(role)) return true;

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) return false;

        if ("admin1".equals(role)) {
            return currentUser.getId().equals(project.getAssignedAdmin1Id());
        }
        return currentUser.getId().equals(project.getUserId());
    }

    /**
     * Lấy user hiện tại từ SecurityContext.
     */
    private User getCurrentAuthUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        return userRepository.findByUsername(auth.getName()).orElse(null);
    }

    private void ensureUserExists(String userId, String label) {
        if (!userRepository.existsById(userId)) {
            throw new BadRequestException("Invalid " + label + " id: " + userId);
        }
    }

    private void validateApprovalSection(String section, String label, String rawReviewJson, List<ApprovalIssue> issues) {
        if (rawReviewJson == null || rawReviewJson.isBlank()) {
            issues.add(new ApprovalIssue(section, "SECTION_NOT_REVIEWED", "Tab " + label + " chưa được đánh giá."));
            return;
        }

        final JsonNode root;
        try {
            root = objectMapper.readTree(rawReviewJson);
        } catch (Exception ex) {
            throw new ApprovalBlockedException(
                    "Không thể phê duyệt vì dữ liệu đánh giá admin không hợp lệ.",
                    List.of(new ApprovalIssue(section, "SECTION_NOT_REVIEWED", "Dữ liệu đánh giá của tab " + label + " không đọc được."))
            );
        }

        ApprovalScanState state = new ApprovalScanState(section, label);
        traverseApprovalReview(root, state, issues, new ApprovalTraversalContext());

        if (!state.foundReviewNode) {
            issues.add(new ApprovalIssue(section, "SECTION_NOT_REVIEWED", "Tab " + label + " chưa có đánh giá admin."));
        }
    }

    private void traverseApprovalReview(JsonNode node, ApprovalScanState state, List<ApprovalIssue> issues, ApprovalTraversalContext context) {
        if (node == null || node.isNull()) {
            return;
        }

        ApprovalTraversalContext nextContext = context.copy();

        if (node.isObject()) {
            if (node.hasNonNull("instanceKey")) {
                nextContext.instanceKey = node.get("instanceKey").asText(null);
            }
            if (node.hasNonNull("rowIndex") && node.get("rowIndex").canConvertToInt()) {
                nextContext.rowIndex = node.get("rowIndex").asInt();
            }

            if (node.has("eval")) {
                state.foundReviewNode = true;
                String eval = node.path("eval").asText("").trim();
                if (eval.isEmpty()) {
                    issues.add(buildApprovalIssue(state.section, "MISSING_EVAL", state.label, nextContext, "Chưa chọn đánh giá admin."));
                } else if (!"OK".equalsIgnoreCase(eval)) {
                    issues.add(buildApprovalIssue(state.section, "NON_OK_EVAL", state.label, nextContext,
                            "Giá trị đánh giá admin phải là OK để được phê duyệt."));
                }
            }

            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                ApprovalTraversalContext childContext = nextContext.copy();
                if (!"eval".equals(entry.getKey()) && !"note".equals(entry.getKey())) {
                    childContext.fieldKey = normalizeFieldKey(entry.getKey(), childContext.fieldKey);
                }
                traverseApprovalReview(entry.getValue(), state, issues, childContext);
            }
            return;
        }

        if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                ApprovalTraversalContext childContext = nextContext.copy();
                if (childContext.rowIndex == null) {
                    childContext.rowIndex = i;
                }
                traverseApprovalReview(node.get(i), state, issues, childContext);
            }
        }
    }

    private ApprovalIssue buildApprovalIssue(String section, String code, String label, ApprovalTraversalContext context, String detail) {
        StringBuilder message = new StringBuilder("Tab ").append(label);
        if (context.instanceKey != null && !context.instanceKey.isBlank()) {
            message.append(" (").append(context.instanceKey).append(")");
        }
        if (context.fieldKey != null && !context.fieldKey.isBlank()) {
            message.append(" - ").append(context.fieldKey);
        }
        if (context.rowIndex != null) {
            message.append(" - dòng ").append(context.rowIndex + 1);
        }
        message.append(": ").append(detail);

        ApprovalIssue issue = new ApprovalIssue(section, code, message.toString());
        issue.setInstanceKey(context.instanceKey);
        issue.setRowIndex(context.rowIndex);
        issue.setFieldKey(context.fieldKey);
        return issue;
    }

    private String normalizeFieldKey(String candidate, String fallback) {
        if (candidate == null || candidate.isBlank()) {
            return fallback;
        }
        if ("reviewData".equals(candidate) || "rows".equals(candidate)) {
            return fallback;
        }
        return candidate;
    }

    private static class ApprovalScanState {
        private final String section;
        private final String label;
        private boolean foundReviewNode;

        private ApprovalScanState(String section, String label) {
            this.section = section;
            this.label = label;
        }
    }

    private static class ApprovalTraversalContext {
        private String instanceKey;
        private Integer rowIndex;
        private String fieldKey;

        private ApprovalTraversalContext copy() {
            ApprovalTraversalContext copy = new ApprovalTraversalContext();
            copy.instanceKey = instanceKey;
            copy.rowIndex = rowIndex;
            copy.fieldKey = fieldKey;
            return copy;
        }
    }
}

