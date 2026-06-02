package com.example.sizing.repository;

import com.example.sizing.model.ProjectData;
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

    @Query("""
            SELECT pd.id AS id, pd.project.id AS projectId
            FROM ProjectData pd
            WHERE pd.project.id = :projectId
            """)
    Optional<ProjectDataIdentityView> findIdentityByProjectId(@Param("projectId") String projectId);

    @Query("""
            SELECT pd.id AS id, pd.project.id AS projectId,
                   pd.yeuCauBaiToanContent AS content,
                   pd.yeuCauAdminReview AS review
            FROM ProjectData pd
            WHERE pd.project.id = :projectId
            """)
    Optional<ProjectDataSectionView> findRequestSectionByProjectId(@Param("projectId") String projectId);

    @Query("""
            SELECT pd.id AS id, pd.project.id AS projectId,
                   pd.thongTinDauVaoContent AS content,
                   pd.thongTinAdminReview AS review
            FROM ProjectData pd
            WHERE pd.project.id = :projectId
            """)
    Optional<ProjectDataSectionView> findInputSectionByProjectId(@Param("projectId") String projectId);

    @Query("""
            SELECT pd.id AS id, pd.project.id AS projectId,
                   pd.moHinhHeThongContent AS content,
                   pd.moHinhAdminReview AS review
            FROM ProjectData pd
            WHERE pd.project.id = :projectId
            """)
    Optional<ProjectDataSectionView> findModelSectionByProjectId(@Param("projectId") String projectId);

    @Query("""
            SELECT pd.id AS id, pd.project.id AS projectId,
                   pd.dinhCoHeThongContent AS content,
                   pd.dinhCoAdminReview AS review
            FROM ProjectData pd
            WHERE pd.project.id = :projectId
            """)
    Optional<ProjectDataSectionView> findSizingSectionByProjectId(@Param("projectId") String projectId);

    @Query(value = """
            SELECT id AS id,
                   project_id AS projectId,
                   tong_hop_va_de_xuat_content AS content,
                   NULL AS review
            FROM project_data
            WHERE project_id = :projectId
            LIMIT 1
            """, nativeQuery = true)
    Optional<ProjectDataSectionView> findSummarySectionByProjectId(@Param("projectId") String projectId);

    @Query("SELECT CASE WHEN COUNT(pd) > 0 THEN true ELSE false END FROM ProjectData pd WHERE pd.project.id = :projectId")
    boolean existsByProjectId(@Param("projectId") String projectId);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.yeuCauBaiToanContent = :content WHERE pd.project.id = :projectId")
    int updateYeuCauBaiToanContent(@Param("projectId") String projectId, @Param("content") String content);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.thongTinDauVaoContent = :content WHERE pd.project.id = :projectId")
    int updateThongTinDauVaoContent(@Param("projectId") String projectId, @Param("content") String content);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.moHinhHeThongContent = :content WHERE pd.project.id = :projectId")
    int updateMoHinhHeThongContent(@Param("projectId") String projectId, @Param("content") String content);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.dinhCoHeThongContent = :content WHERE pd.project.id = :projectId")
    int updateDinhCoHeThongContent(@Param("projectId") String projectId, @Param("content") String content);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.tongHopVaDeXuatContent = :content WHERE pd.project.id = :projectId")
    int updateTongHopVaDeXuatContent(@Param("projectId") String projectId, @Param("content") String content);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.yeuCauAdminReview = :review WHERE pd.project.id = :projectId")
    int updateYeuCauAdminReview(@Param("projectId") String projectId, @Param("review") String review);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.thongTinAdminReview = :review WHERE pd.project.id = :projectId")
    int updateThongTinAdminReview(@Param("projectId") String projectId, @Param("review") String review);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.moHinhAdminReview = :review WHERE pd.project.id = :projectId")
    int updateMoHinhAdminReview(@Param("projectId") String projectId, @Param("review") String review);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ProjectData pd SET pd.dinhCoAdminReview = :review WHERE pd.project.id = :projectId")
    int updateDinhCoAdminReview(@Param("projectId") String projectId, @Param("review") String review);

    @Query(value = "DELETE FROM project_data WHERE project_id = :projectId", nativeQuery = true)
    @org.springframework.data.jpa.repository.Modifying
    void deleteByProjectId(@Param("projectId") String projectId);
}
