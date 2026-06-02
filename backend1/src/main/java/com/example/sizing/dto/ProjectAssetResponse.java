package com.example.sizing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectAssetResponse {
    private String id;
    private String projectId;
    private String section;
    private String assetGroup;
    private Integer assetOrder;
    private String kind;
    private String filename;
    private String contentType;
    private Long sizeBytes;
    private String url;
    private String sha256;
    private Integer width;
    private Integer height;

    @JsonProperty("assetId")
    public String getAssetId() {
        return id;
    }

    @JsonProperty("dataUrl")
    public String getDataUrl() {
        return url;
    }
}
