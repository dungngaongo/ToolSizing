package com.example.sizing.dto;

import lombok.Data;

import java.util.List;

@Data
public class ProjectAssetReorderRequest {
    private List<ProjectAssetReorderItem> assets;
}
