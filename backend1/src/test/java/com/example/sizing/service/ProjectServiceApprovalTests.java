package com.example.sizing.service;

import com.example.sizing.dto.CreateProjectRequest;
import com.example.sizing.exception.ApprovalBlockedException;
import com.example.sizing.exception.BadRequestException;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectData;
import com.example.sizing.model.User;
import com.example.sizing.repository.ProjectDataRepository;
import com.example.sizing.repository.ProjectRepository;
import com.example.sizing.repository.ProjectRevisionRepository;
import com.example.sizing.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectServiceApprovalTests {
    private ProjectRepository projectRepository;
    private ProjectDataRepository projectDataRepository;
    private ProjectRevisionRepository projectRevisionRepository;
    private UserRepository userRepository;
    private ActivityLogService activityLogService;
    private ProjectService projectService;

    @BeforeEach
    void setUp() {
        projectRepository = Mockito.mock(ProjectRepository.class);
        projectDataRepository = Mockito.mock(ProjectDataRepository.class);
        projectRevisionRepository = Mockito.mock(ProjectRevisionRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        activityLogService = Mockito.mock(ActivityLogService.class);
        projectService = new ProjectService(
                projectRepository,
                projectDataRepository,
                projectRevisionRepository,
                userRepository,
                activityLogService
        );

        User admin2 = new User();
        admin2.setId("u-admin2");
        admin2.setUsername("admin2");
        admin2.setRole("admin2");
        when(userRepository.findByUsername("admin2")).thenReturn(Optional.of(admin2));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin2",
                        "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN2"))
                )
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void approveProjectSucceedsWhenAllReviewsAreOk() {
        Project project = projectWithStatus("THAM_DINH");
        ProjectData projectData = projectDataWithReviews(
                "{\"row0\":{\"eval\":\"OK\"}}",
                "{\"rows\":[{\"eval\":\"OK\"}]}",
                "{\"physical\":{\"eval\":\"OK\"}}",
                "{\"moduleInstanceReviews\":[{\"instanceKey\":\"App-1\",\"reviewData\":{\"baselineRowReviews\":[{\"eval\":\"OK\"}]}}]}",
                "{\"eval\":\"OK\"}"
        );

        when(projectRepository.findById("p1")).thenReturn(Optional.of(project));
        when(projectDataRepository.findFirstByProjectId("p1")).thenReturn(Optional.of(projectData));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project approved = projectService.approveProject("p1");

        assertEquals("HOAN_THANH", approved.getStatus());
        verify(projectRepository).save(project);
    }

    @Test
    void approveProjectRejectsWhenAnyReviewIsNok() {
        Project project = projectWithStatus("PHE_DUYET");
        ProjectData projectData = projectDataWithReviews(
                "{\"row0\":{\"eval\":\"OK\"}}",
                "{\"rows\":[{\"eval\":\"OK\"}]}",
                "{\"physical\":{\"eval\":\"OK\"}}",
                "{\"moduleInstanceReviews\":[{\"instanceKey\":\"App-1\",\"reviewData\":{\"baselineRowReviews\":[{\"eval\":\"NOK\"}]}}]}",
                "{\"eval\":\"OK\"}"
        );

        when(projectRepository.findById("p1")).thenReturn(Optional.of(project));
        when(projectDataRepository.findFirstByProjectId("p1")).thenReturn(Optional.of(projectData));

        ApprovalBlockedException ex = assertThrows(ApprovalBlockedException.class, () -> projectService.approveProject("p1"));

        assertEquals("NON_OK_EVAL", ex.getApprovalIssues().getFirst().getCode());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void approveProjectRejectsWhenReviewEvalMissing() {
        Project project = projectWithStatus("THAM_DINH");
        ProjectData projectData = projectDataWithReviews(
                "{\"row0\":{\"eval\":\"OK\"}}",
                "{\"rows\":[{\"eval\":\"\"}]}",
                "{\"physical\":{\"eval\":\"OK\"}}",
                "{\"moduleInstanceReviews\":[{\"instanceKey\":\"App-1\",\"reviewData\":{\"baselineRowReviews\":[{\"eval\":\"OK\"}]}}]}",
                "{\"eval\":\"OK\"}"
        );

        when(projectRepository.findById("p1")).thenReturn(Optional.of(project));
        when(projectDataRepository.findFirstByProjectId("p1")).thenReturn(Optional.of(projectData));

        ApprovalBlockedException ex = assertThrows(ApprovalBlockedException.class, () -> projectService.approveProject("p1"));

        assertEquals("MISSING_EVAL", ex.getApprovalIssues().getFirst().getCode());
    }

    @Test
    void approveProjectRejectsWhenSectionHasNoReviewNodes() {
        Project project = projectWithStatus("THAM_DINH");
        ProjectData projectData = projectDataWithReviews(
                "{\"row0\":{\"eval\":\"OK\"}}",
                "{\"rows\":[{\"eval\":\"OK\"}]}",
                "{\"note\":\"missing eval nodes\"}",
                "{\"moduleInstanceReviews\":[{\"instanceKey\":\"App-1\",\"reviewData\":{\"baselineRowReviews\":[{\"eval\":\"OK\"}]}}]}",
                "{\"eval\":\"OK\"}"
        );

        when(projectRepository.findById("p1")).thenReturn(Optional.of(project));
        when(projectDataRepository.findFirstByProjectId("p1")).thenReturn(Optional.of(projectData));

        ApprovalBlockedException ex = assertThrows(ApprovalBlockedException.class, () -> projectService.approveProject("p1"));

        assertEquals("SECTION_NOT_REVIEWED", ex.getApprovalIssues().getFirst().getCode());
        assertEquals("model", ex.getApprovalIssues().getFirst().getSection());
    }

    @Test
    void approveProjectRejectsWhenStatusIsInvalid() {
        Project project = projectWithStatus("SIZING");
        when(projectRepository.findById("p1")).thenReturn(Optional.of(project));

        ApprovalBlockedException ex = assertThrows(ApprovalBlockedException.class, () -> projectService.approveProject("p1"));

        assertEquals("INVALID_STATUS", ex.getApprovalIssues().getFirst().getCode());
        verify(projectDataRepository, never()).findFirstByProjectId(any(String.class));
    }

    @Test
    void updateRejectsDirectHoanThanhStatus() {
        Project project = projectWithStatus("PHE_DUYET");
        when(projectRepository.findById("p1")).thenReturn(Optional.of(project));

        CreateProjectRequest request = new CreateProjectRequest();
        request.setStatus("HOAN_THANH");

        assertThrows(BadRequestException.class, () -> projectService.update("p1", request));
    }

    private Project projectWithStatus(String status) {
        Project project = new Project();
        project.setId("p1");
        project.setName("Demo");
        project.setStatus(status);
        project.setStatusRound(1);
        return project;
    }

    private ProjectData projectDataWithReviews(String request, String input, String model, String sizing, String summary) {
        ProjectData projectData = new ProjectData();
        projectData.setYeuCauAdminReview(request);
        projectData.setThongTinAdminReview(input);
        projectData.setMoHinhAdminReview(model);
        projectData.setDinhCoAdminReview(sizing);
        projectData.setTongHopAdminReview(summary);
        return projectData;
    }
}
