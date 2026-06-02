package com.example.sizing.controller;

import com.example.sizing.dto.ProjectAssetGroupResponse;
import com.example.sizing.dto.ProjectAssetReorderRequest;
import com.example.sizing.dto.ProjectAssetResponse;
import com.example.sizing.exception.ForbiddenException;
import com.example.sizing.service.ProjectAssetService;
import com.example.sizing.service.ProjectService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

@RestController
@CrossOrigin(origins = "*")
public class ProjectAssetController {
    private final ProjectAssetService projectAssetService;
    private final ProjectService projectService;

    public ProjectAssetController(ProjectAssetService projectAssetService,
                                  ProjectService projectService) {
        this.projectAssetService = projectAssetService;
        this.projectService = projectService;
    }

    @PostMapping("/api/projects/{projectId}/assets")
    public ResponseEntity<ProjectAssetResponse> uploadAsset(@PathVariable String projectId,
                                                            @RequestParam String section,
                                                            @RequestParam String assetGroup,
                                                            @RequestParam(defaultValue = "0") Integer assetOrder,
                                                            @RequestParam("file") MultipartFile file) {
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Ban khong co quyen cap nhat du an nay");
        }
        return ResponseEntity.ok(projectAssetService.uploadAsset(projectId, section, assetGroup, assetOrder, file));
    }

    @GetMapping("/api/projects/{projectId}/assets")
    public ResponseEntity<List<ProjectAssetResponse>> listAssets(@PathVariable String projectId,
                                                                 @RequestParam(required = false) String section,
                                                                 @RequestParam(required = false) String assetGroup) {
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Ban khong co quyen truy cap du an nay");
        }
        return ResponseEntity.ok(projectAssetService.listAssets(projectId, section, assetGroup));
    }

    @GetMapping("/api/projects/{projectId}/asset-groups")
    public ResponseEntity<List<ProjectAssetGroupResponse>> listAssetGroups(@PathVariable String projectId,
                                                                           @RequestParam String section) {
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Ban khong co quyen truy cap du an nay");
        }
        return ResponseEntity.ok(projectAssetService.listAssetGroups(projectId, section));
    }

    @DeleteMapping("/api/projects/{projectId}/assets/{assetId}")
    public ResponseEntity<Void> deleteAsset(@PathVariable String projectId, @PathVariable String assetId) {
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Ban khong co quyen cap nhat du an nay");
        }
        projectAssetService.deleteAsset(projectId, assetId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/api/projects/{projectId}/assets/reorder")
    public ResponseEntity<Void> reorderAssets(@PathVariable String projectId,
                                              @RequestBody ProjectAssetReorderRequest request) {
        if (!projectService.canAccessProject(projectId)) {
            throw new ForbiddenException("Ban khong co quyen cap nhat du an nay");
        }
        projectAssetService.reorderAssets(projectId, request == null ? List.of() : request.getAssets());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/assets/{assetId}/content")
    public ResponseEntity<byte[]> getAssetContent(@PathVariable String assetId) throws IOException {
        ProjectAssetResponse asset = projectAssetService.getAsset(assetId);
        byte[] bytes = projectAssetService.readAssetBytes(assetId);
        MediaType mediaType = asset.getContentType() == null
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(asset.getContentType());
        return ResponseEntity.ok()
                .contentType(mediaType)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + (asset.getFilename() == null ? assetId : asset.getFilename()) + "\"")
                .body(bytes);
    }
}
