package com.example.sizing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectAssetGroupResponse {
    private String assetGroup;
    private int assetCount;
    private List<ProjectAssetResponse> assets;
}
