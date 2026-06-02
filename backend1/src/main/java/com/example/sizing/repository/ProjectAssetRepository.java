package com.example.sizing.repository;

import com.example.sizing.model.ProjectAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectAssetRepository extends JpaRepository<ProjectAsset, String> {
    List<ProjectAsset> findByProject_IdOrderBySectionAscAssetGroupAscAssetOrderAsc(String projectId);

    List<ProjectAsset> findByProject_IdAndSectionOrderByAssetGroupAscAssetOrderAsc(String projectId, String section);

    List<ProjectAsset> findByProject_IdAndSectionAndAssetGroupOrderByAssetOrderAsc(String projectId, String section, String assetGroup);

    Optional<ProjectAsset> findByProject_IdAndSectionAndAssetGroupAndAssetOrder(String projectId,
                                                                                String section,
                                                                                String assetGroup,
                                                                                Integer assetOrder);

    long countByStoragePath(String storagePath);
}
