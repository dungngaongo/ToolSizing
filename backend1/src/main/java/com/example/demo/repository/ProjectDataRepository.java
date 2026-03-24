package com.example.demo.repository;

import com.example.demo.model.ProjectData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectDataRepository extends JpaRepository<ProjectData, String> {
    @Query("SELECT pd FROM ProjectData pd WHERE pd.project.id = :projectId")
    List<ProjectData> findByProjectId(@Param("projectId") String projectId);

    @Query(value = "SELECT * FROM project_data WHERE project_id = :projectId ORDER BY id LIMIT 1", nativeQuery = true)
    Optional<ProjectData> findFirstByProjectId(@Param("projectId") String projectId);

    @Query("SELECT CASE WHEN COUNT(pd) > 0 THEN true ELSE false END FROM ProjectData pd WHERE pd.project.id = :projectId")
    boolean existsByProjectId(@Param("projectId") String projectId);

    @Query(value = "DELETE FROM project_data WHERE project_id = :projectId", nativeQuery = true)
    @org.springframework.data.jpa.repository.Modifying
    void deleteByProjectId(@Param("projectId") String projectId);
}
