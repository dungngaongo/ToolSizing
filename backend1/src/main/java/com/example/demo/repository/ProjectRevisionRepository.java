package com.example.demo.repository;

import com.example.demo.model.ProjectRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRevisionRepository extends JpaRepository<ProjectRevision, String> {
    List<ProjectRevision> findByProjectId(String projectId);
    List<ProjectRevision> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<ProjectRevision> findByUserId(String userId);

    // Tìm revision BASELINE mới nhất của project
    Optional<ProjectRevision> findFirstByProjectIdAndRevisionTypeOrderByCreatedAtDesc(String projectId, String revisionType);

    // Đếm số incremental revisions kể từ baseline gần nhất
    long countByProjectIdAndRevisionTypeAndBaselineId(String projectId, String revisionType, String baselineId);

    // Lấy tất cả incremental revisions từ một baseline, sắp xếp theo thời gian tăng dần
    List<ProjectRevision> findByProjectIdAndBaselineIdOrderByCreatedAtAsc(String projectId, String baselineId);

    // Lấy tất cả revisions từ một baseline (bao gồm cả baseline), sắp xếp theo thời gian tăng dần
    @Query("SELECT r FROM ProjectRevision r WHERE r.projectId = :projectId AND " +
           "(r.id = :baselineId OR r.baselineId = :baselineId) ORDER BY r.createdAt ASC")
    List<ProjectRevision> findAllFromBaseline(@Param("projectId") String projectId, @Param("baselineId") String baselineId);
}

