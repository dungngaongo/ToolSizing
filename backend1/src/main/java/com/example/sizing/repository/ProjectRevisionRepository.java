package com.example.sizing.repository;

import com.example.sizing.model.ProjectRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRevisionRepository extends JpaRepository<ProjectRevision, String> {
    @Query("SELECT r FROM ProjectRevision r WHERE r.project.id = :projectId")
    List<ProjectRevision> findByProjectId(@Param("projectId") String projectId);

    @Query("SELECT r FROM ProjectRevision r WHERE r.project.id = :projectId ORDER BY r.createdAt DESC")
    List<ProjectRevision> findByProjectIdOrderByCreatedAtDesc(@Param("projectId") String projectId);

    @Query("SELECT r FROM ProjectRevision r WHERE r.user.id = :userId")
    List<ProjectRevision> findByUserId(@Param("userId") String userId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM ProjectRevision r WHERE r.project.id = :projectId")
    void deleteByProjectId(@Param("projectId") String projectId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE ProjectRevision r SET r.baseline = NULL WHERE r.project.id = :projectId AND r.baseline IS NOT NULL")
    void clearBaselineByProjectId(@Param("projectId") String projectId);

    // Tìm revision BASELINE mới nhất của project
    @Query(value = "SELECT * FROM project_revisions WHERE project_id = :projectId AND revision_type = :revisionType ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
    Optional<ProjectRevision> findFirstByProjectIdAndRevisionTypeOrderByCreatedAtDesc(@Param("projectId") String projectId,
                                                                                       @Param("revisionType") String revisionType);

    // Đếm số incremental revisions kể từ baseline gần nhất
    @Query("SELECT COUNT(r) FROM ProjectRevision r WHERE r.project.id = :projectId AND r.revisionType = :revisionType AND r.baseline.id = :baselineId")
    long countByProjectIdAndRevisionTypeAndBaselineId(@Param("projectId") String projectId,
                                                      @Param("revisionType") String revisionType,
                                                      @Param("baselineId") String baselineId);

    // Lấy tất cả incremental revisions từ một baseline, sắp xếp theo thời gian tăng dần
    @Query("SELECT r FROM ProjectRevision r WHERE r.project.id = :projectId AND r.baseline.id = :baselineId ORDER BY r.createdAt ASC")
    List<ProjectRevision> findByProjectIdAndBaselineIdOrderByCreatedAtAsc(@Param("projectId") String projectId,
                                                                           @Param("baselineId") String baselineId);

    // Lấy tất cả revisions từ một baseline (bao gồm cả baseline), sắp xếp theo thời gian tăng dần
    @Query("SELECT r FROM ProjectRevision r WHERE r.project.id = :projectId AND " +
           "(r.id = :baselineId OR r.baseline.id = :baselineId) ORDER BY r.createdAt ASC")
    List<ProjectRevision> findAllFromBaseline(@Param("projectId") String projectId, @Param("baselineId") String baselineId);
}

