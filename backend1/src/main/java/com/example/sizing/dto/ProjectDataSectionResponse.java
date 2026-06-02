package com.example.sizing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDataSectionResponse {
    private String id;
    private String projectId;
    private String section;
    private String content;
    private String reviewJson;
    private List<ProjectAssetGroupResponse> assetGroups;
}
