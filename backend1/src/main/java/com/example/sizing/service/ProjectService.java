package com.example.sizing.service;

import com.example.sizing.dto.CreateProjectRequest;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectData;
import com.example.sizing.model.User;
import com.example.sizing.repository.ProjectDataRepository;
import com.example.sizing.repository.ProjectRepository;
import com.example.sizing.repository.ProjectRevisionRepository;
import com.example.sizing.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.sizing.exception.BadRequestException;
import com.example.sizing.exception.ForbiddenException;
import com.example.sizing.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectService {
    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

    private final ProjectRepository projectRepository;
    private final ProjectDataRepository projectDataRepository;
    private final ProjectRevisionRepository projectRevisionRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;
    private final ProjectAssetService projectAssetService;

    public ProjectService(ProjectRepository projectRepository,
                          ProjectDataRepository projectDataRepository,
                          ProjectRevisionRepository projectRevisionRepository,
                          UserRepository userRepository,
                          ActivityLogService activityLogService,
                          ProjectAssetService projectAssetService) {
        this.projectRepository = projectRepository;
        this.projectDataRepository = projectDataRepository;
        this.projectRevisionRepository = projectRevisionRepository;
        this.userRepository = userRepository;
        this.activityLogService = activityLogService;
        this.projectAssetService = projectAssetService;
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
    public void delete(String id) {
        log.info("Deleting project id: {}", id);
        Project project = projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        // Backward compatible cleanup for environments where FK cascade is not yet active.
        projectAssetService.deleteProjectAssets(id);
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

        boolean isAdmin2 = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN2".equalsIgnoreCase(a.getAuthority()));
        if (isAdmin2) {
            return true;
        }

        boolean isAdmin1 = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN1".equalsIgnoreCase(a.getAuthority()));
        if (isAdmin1) {
            return projectRepository.existsByIdAndAssignedAdmin1_Id(projectId, currentUser.getId());
        }

        return projectRepository.existsByIdAndOwner_Id(projectId, currentUser.getId());
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
}

