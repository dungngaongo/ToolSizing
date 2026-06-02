package com.example.sizing.service;

import com.example.sizing.config.FileStorageProperties;
import com.example.sizing.dto.ProjectAssetGroupResponse;
import com.example.sizing.dto.ProjectAssetReorderItem;
import com.example.sizing.dto.ProjectAssetResponse;
import com.example.sizing.exception.BadRequestException;
import com.example.sizing.exception.ResourceNotFoundException;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectAsset;
import com.example.sizing.repository.ProjectAssetRepository;
import com.example.sizing.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ProjectAssetService {
    private final ProjectAssetRepository projectAssetRepository;
    private final ProjectRepository projectRepository;
    private final FileStorageService fileStorageService;
    private final FileStorageProperties fileStorageProperties;

    public ProjectAssetService(ProjectAssetRepository projectAssetRepository,
                               ProjectRepository projectRepository,
                               FileStorageService fileStorageService,
                               FileStorageProperties fileStorageProperties) {
        this.projectAssetRepository = projectAssetRepository;
        this.projectRepository = projectRepository;
        this.fileStorageService = fileStorageService;
        this.fileStorageProperties = fileStorageProperties;
    }

    @Transactional
    public ProjectAssetResponse uploadAsset(String projectId,
                                            String section,
                                            String assetGroup,
                                            Integer assetOrder,
                                            MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        try {
            return storeAsset(projectId,
                    section,
                    assetGroup,
                    assetOrder,
                    file.getOriginalFilename(),
                    file.getContentType(),
                    file.getBytes());
        } catch (IOException e) {
            throw new BadRequestException("Failed to store file: " + e.getMessage());
        }
    }

    @Transactional
    public ProjectAssetResponse storeAsset(String projectId,
                                           String section,
                                           String assetGroup,
                                           Integer assetOrder,
                                           String filename,
                                           String contentType,
                                           byte[] bytes) {
        validateProjectAndSlot(projectId, section, assetGroup, assetOrder);
        if (bytes == null || bytes.length == 0) {
            throw new BadRequestException("Asset content is empty");
        }
        if (bytes.length > fileStorageProperties.getMaxUploadSize()) {
            throw new BadRequestException("Asset exceeds max upload size");
        }

        ProjectAsset asset = projectAssetRepository
                .findByProject_IdAndSectionAndAssetGroupAndAssetOrder(projectId, section, assetGroup, assetOrder)
                .orElseGet(ProjectAsset::new);

        asset.setProject(projectRepository.getReferenceById(projectId));
        asset.setSection(section);
        asset.setAssetGroup(assetGroup);
        asset.setAssetOrder(assetOrder);
        asset.setKind("image");
        asset.setFilename(filename);
        asset.setContentType(normalizeContentType(contentType));
        asset.setSha256(sha256(bytes));

        if (asset.getId() == null) {
            asset.generateId();
        }

        try {
            FileStorageService.StoredFile storedFile = fileStorageService.store(
                    projectId,
                    section,
                    asset.getId(),
                    filename,
                    asset.getContentType(),
                    bytes
            );
            asset.setStoragePath(storedFile.storagePath());
            asset.setSizeBytes(storedFile.sizeBytes());
        } catch (IOException e) {
            throw new BadRequestException("Failed to write asset: " + e.getMessage());
        }

        asset.setPublicUrl(buildAssetContentUrl(asset.getId()));
        populateDimensions(asset, bytes);

        ProjectAsset saved = projectAssetRepository.save(asset);
        return toResponse(saved);
    }

    public List<ProjectAssetResponse> listAssets(String projectId, String section, String assetGroup) {
        validateProjectId(projectId);
        List<ProjectAsset> assets;
        if (section != null && !section.isBlank() && assetGroup != null && !assetGroup.isBlank()) {
            assets = projectAssetRepository.findByProject_IdAndSectionAndAssetGroupOrderByAssetOrderAsc(projectId, normalizeSection(section), assetGroup);
        } else if (section != null && !section.isBlank()) {
            assets = projectAssetRepository.findByProject_IdAndSectionOrderByAssetGroupAscAssetOrderAsc(projectId, normalizeSection(section));
        } else {
            assets = projectAssetRepository.findByProject_IdOrderBySectionAscAssetGroupAscAssetOrderAsc(projectId);
        }
        return assets.stream().map(this::toResponse).toList();
    }

    public List<ProjectAssetGroupResponse> listAssetGroups(String projectId, String section) {
        Map<String, List<ProjectAssetResponse>> grouped = new LinkedHashMap<>();
        for (ProjectAssetResponse asset : listAssets(projectId, section, null)) {
            grouped.computeIfAbsent(asset.getAssetGroup(), ignored -> new ArrayList<>()).add(asset);
        }
        List<ProjectAssetGroupResponse> groups = new ArrayList<>();
        grouped.forEach((assetGroup, assets) -> groups.add(new ProjectAssetGroupResponse(assetGroup, assets.size(), assets)));
        return groups;
    }

    public ProjectAssetResponse getAsset(String assetId) {
        return toResponse(findAsset(assetId));
    }

    public byte[] readAssetBytes(String assetId) throws IOException {
        ProjectAsset asset = findAsset(assetId);
        return fileStorageService.readBytes(asset.getStoragePath());
    }

    @Transactional
    public void deleteAsset(String projectId, String assetId) {
        ProjectAsset asset = findAsset(assetId);
        if (!Objects.equals(asset.getProjectId(), projectId)) {
            throw new ResourceNotFoundException("ProjectAsset", "id", assetId);
        }
        projectAssetRepository.delete(asset);
        try {
            if (projectAssetRepository.countByStoragePath(asset.getStoragePath()) == 0) {
                fileStorageService.delete(asset.getStoragePath());
            }
        } catch (IOException ignored) {
        }
    }

    @Transactional
    public void reorderAssets(String projectId, List<ProjectAssetReorderItem> reorderItems) {
        if (reorderItems == null || reorderItems.isEmpty()) {
            return;
        }
        for (ProjectAssetReorderItem item : reorderItems) {
            if (item == null || item.getAssetId() == null || item.getAssetOrder() == null) {
                continue;
            }
            ProjectAsset asset = findAsset(item.getAssetId());
            if (!Objects.equals(asset.getProjectId(), projectId)) {
                throw new ResourceNotFoundException("ProjectAsset", "id", item.getAssetId());
            }
            asset.setAssetOrder(item.getAssetOrder());
            projectAssetRepository.save(asset);
        }
    }

    @Transactional
    public void deleteProjectAssets(String projectId) {
        List<ProjectAsset> assets = projectAssetRepository.findByProject_IdOrderBySectionAscAssetGroupAscAssetOrderAsc(projectId);
        for (ProjectAsset asset : assets) {
            projectAssetRepository.delete(asset);
            try {
                if (projectAssetRepository.countByStoragePath(asset.getStoragePath()) == 0) {
                    fileStorageService.delete(asset.getStoragePath());
                }
            } catch (IOException ignored) {
            }
        }
    }

    public String buildAssetContentUrl(String assetId) {
        String baseUrl = fileStorageProperties.getPublicBaseUrl();
        String normalized = (baseUrl == null || baseUrl.isBlank()) ? "/api/assets" : baseUrl.trim();
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized + "/" + assetId + "/content";
    }

    private ProjectAsset findAsset(String assetId) {
        return projectAssetRepository.findById(assetId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectAsset", "id", assetId));
    }

    private void validateProjectAndSlot(String projectId, String section, String assetGroup, Integer assetOrder) {
        validateProjectId(projectId);
        normalizeSection(section);
        if (assetGroup == null || assetGroup.isBlank()) {
            throw new BadRequestException("assetGroup is required");
        }
        if (assetOrder == null || assetOrder < 0) {
            throw new BadRequestException("assetOrder must be >= 0");
        }
    }

    private void validateProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            throw new BadRequestException("projectId is required");
        }
        if (!projectRepository.existsById(projectId)) {
            throw new BadRequestException("Invalid projectId: " + projectId);
        }
    }

    private String normalizeSection(String section) {
        if (section == null || section.isBlank()) {
            throw new BadRequestException("section is required");
        }
        return section.trim().toLowerCase();
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "image/jpeg";
        }
        return contentType;
    }

    private void populateDimensions(ProjectAsset asset, byte[] bytes) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image != null) {
                asset.setWidthPx(image.getWidth());
                asset.setHeightPx(image.getHeight());
            }
        } catch (IOException ignored) {
        }
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public ProjectAssetResponse toResponse(ProjectAsset asset) {
        return new ProjectAssetResponse(
                asset.getId(),
                asset.getProjectId(),
                asset.getSection(),
                asset.getAssetGroup(),
                asset.getAssetOrder(),
                asset.getKind(),
                asset.getFilename(),
                asset.getContentType(),
                asset.getSizeBytes(),
                asset.getPublicUrl(),
                asset.getSha256(),
                asset.getWidthPx(),
                asset.getHeightPx()
        );
    }
}
