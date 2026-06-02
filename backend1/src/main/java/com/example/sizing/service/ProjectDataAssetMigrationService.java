package com.example.sizing.service;

import com.example.sizing.dto.ProjectAssetGroupResponse;
import com.example.sizing.dto.ProjectAssetResponse;
import com.example.sizing.model.ProjectData;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ProjectDataAssetMigrationService {
    private static final Logger log = LoggerFactory.getLogger(ProjectDataAssetMigrationService.class);
    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:(image/[^;]+);base64,(.+)$", Pattern.DOTALL);
    private static final Pattern INLINE_IMAGE_PATTERN = Pattern.compile("src\\s*=\\s*\"(data:image/[^\"]+|/api/assets/[^\"?]+/content(?:\\?[^\"\\s]*)?)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern ASSET_URL_PATTERN = Pattern.compile("/api/assets/([a-f0-9\\-]{36})/content", Pattern.CASE_INSENSITIVE);
    private static final Set<String> SINGLE_IMAGE_FIELDS = Set.of(
            "base64", "dataurl", "pocimage", "sizingimage", "evidenceimage", "evidencedataurl"
    );
    private static final Set<String> HTML_FIELDS = Set.of(
            "resulthtml", "sizingresult", "flowexplanation", "customdochtml", "notehtml", "contenthtml"
    );

    private final ObjectMapper objectMapper;
    private final ProjectAssetService projectAssetService;

    public ProjectDataAssetMigrationService(ObjectMapper objectMapper,
                                            ProjectAssetService projectAssetService) {
        this.objectMapper = objectMapper;
        this.projectAssetService = projectAssetService;
    }

    public SectionMigrationResult sanitizeSection(String projectId, String section, String rawContent) {
        String normalizedSection = normalizeSection(section);
        if (rawContent == null || rawContent.isBlank()) {
            return new SectionMigrationResult(rawContent, false, projectAssetService.listAssetGroups(projectId, normalizedSection));
        }
        try {
            JsonNode root = objectMapper.readTree(rawContent);
            MutationState state = new MutationState();
            sanitizeNode(projectId, normalizedSection, normalizedSection, root, state);
            String sanitizedContent = state.changed ? objectMapper.writeValueAsString(root) : rawContent;
            return new SectionMigrationResult(
                    sanitizedContent,
                    state.changed,
                    projectAssetService.listAssetGroups(projectId, normalizedSection)
            );
        } catch (Exception ex) {
            log.warn("Skipping asset migration for projectId={}, section={} due to parse/migration error: {}",
                    projectId, normalizedSection, ex.getMessage());
            return new SectionMigrationResult(rawContent, false, projectAssetService.listAssetGroups(projectId, normalizedSection));
        }
    }

    public SanitizedProjectData sanitizeProjectData(ProjectData projectData) {
        if (projectData == null || projectData.getProjectId() == null) {
            return new SanitizedProjectData(projectData, false);
        }
        boolean changed = false;
        SectionMigrationResult request = sanitizeSection(projectData.getProjectId(), "request", projectData.getYeuCauBaiToanContent());
        SectionMigrationResult input = sanitizeSection(projectData.getProjectId(), "input", projectData.getThongTinDauVaoContent());
        SectionMigrationResult model = sanitizeSection(projectData.getProjectId(), "model", projectData.getMoHinhHeThongContent());
        SectionMigrationResult sizing = sanitizeSection(projectData.getProjectId(), "sizing", projectData.getDinhCoHeThongContent());
        SectionMigrationResult summary = sanitizeSection(projectData.getProjectId(), "summary", projectData.getTongHopVaDeXuatContent());

        if (request.changed()) {
            projectData.setYeuCauBaiToanContent(request.content());
            changed = true;
        }
        if (input.changed()) {
            projectData.setThongTinDauVaoContent(input.content());
            changed = true;
        }
        if (model.changed()) {
            projectData.setMoHinhHeThongContent(model.content());
            changed = true;
        }
        if (sizing.changed()) {
            projectData.setDinhCoHeThongContent(sizing.content());
            changed = true;
        }
        if (summary.changed()) {
            projectData.setTongHopVaDeXuatContent(summary.content());
            changed = true;
        }
        return new SanitizedProjectData(projectData, changed);
    }

    private void sanitizeNode(String projectId,
                              String section,
                              String path,
                              JsonNode node,
                              MutationState state) {
        if (node == null) {
            return;
        }
        if (node.isObject()) {
            ObjectNode objectNode = (ObjectNode) node;
            List<String> fieldNames = objectNode.properties().stream().map(java.util.Map.Entry::getKey).toList();
            for (String fieldName : fieldNames) {
                JsonNode child = objectNode.get(fieldName);
                String childPath = path + "." + fieldName;
                if (child == null || child.isNull()) {
                    continue;
                }
                if (child.isTextual() && shouldSanitizeHtml(fieldName, child.asText())) {
                    String sanitizedHtml = sanitizeInlineHtml(projectId, section, childPath, child.asText(), state);
                    if (!sanitizedHtml.equals(child.asText())) {
                        objectNode.put(fieldName, sanitizedHtml);
                        state.changed = true;
                    }
                    continue;
                }
                if (child.isArray() && isImageArrayField(fieldName)) {
                    ArrayNode sanitizedArray = sanitizeImageArray(projectId, section, childPath, (ArrayNode) child, state);
                    if (sanitizedArray != child) {
                        objectNode.set(fieldName, sanitizedArray);
                        state.changed = true;
                    }
                    continue;
                }
                if (isSingleImageField(fieldName)) {
                    JsonNode sanitizedValue = sanitizeSingleImageField(projectId, section, childPath, child, state);
                    if (sanitizedValue != null && sanitizedValue != child) {
                        objectNode.set(fieldName, sanitizedValue);
                        state.changed = true;
                        continue;
                    }
                }
                sanitizeNode(projectId, section, childPath, child, state);
            }
            return;
        }
        if (node.isArray()) {
            ArrayNode arrayNode = (ArrayNode) node;
            for (int i = 0; i < arrayNode.size(); i++) {
                sanitizeNode(projectId, section, path + "[" + i + "]", arrayNode.get(i), state);
            }
        }
    }

    private ArrayNode sanitizeImageArray(String projectId,
                                         String section,
                                         String assetGroup,
                                         ArrayNode imageArray,
                                         MutationState state) {
        ArrayNode sanitized = objectMapper.createArrayNode();
        boolean changed = false;
        for (int i = 0; i < imageArray.size(); i++) {
            JsonNode item = imageArray.get(i);
            ObjectNode assetNode = normalizeImageReference(projectId, section, assetGroup, i, item, state);
            if (assetNode != null) {
                sanitized.add(assetNode);
                if (!item.equals(assetNode)) {
                    changed = true;
                }
            }
        }
        return changed ? sanitized : imageArray;
    }

    private JsonNode sanitizeSingleImageField(String projectId,
                                              String section,
                                              String assetGroup,
                                              JsonNode child,
                                              MutationState state) {
        if (child.isTextual()) {
            String text = child.asText();
            if (isDataUrl(text)) {
                ProjectAssetResponse asset = storeInlineAsset(projectId, section, assetGroup, 0, text);
                state.changed = true;
                return objectMapper.getNodeFactory().textNode(asset.getUrl());
            }
            return child;
        }
        if (child.isObject()) {
            ObjectNode assetNode = normalizeImageReference(projectId, section, assetGroup, 0, child, state);
            if (assetNode != null) {
                state.changed = true;
                return objectMapper.getNodeFactory().textNode(assetNode.path("url").asText(""));
            }
        }
        return child;
    }

    private ObjectNode normalizeImageReference(String projectId,
                                               String section,
                                               String assetGroup,
                                               int assetOrder,
                                               JsonNode item,
                                               MutationState state) {
        if (item == null || item.isNull()) {
            return null;
        }
        if (item.isObject()) {
            ObjectNode objectNode = (ObjectNode) item;
            String base64 = firstNonBlank(
                    textValue(objectNode.get("base64")),
                    textValue(objectNode.get("dataUrl")),
                    textValue(objectNode.get("url"))
            );
            if (isDataUrl(base64)) {
                ProjectAssetResponse asset = storeInlineAsset(projectId, section, assetGroup, assetOrder, base64);
                state.changed = true;
                return toAssetNode(asset, textValue(objectNode.get("filename")), textValue(objectNode.get("id")));
            }
            String existingAssetId = firstNonBlank(textValue(objectNode.get("assetId")), textValue(objectNode.get("id")));
            if (existingAssetId != null && textValue(objectNode.get("url")) != null) {
                return toAssetNode(existingAssetId,
                        textValue(objectNode.get("url")),
                        textValue(objectNode.get("filename")),
                        textValue(objectNode.get("contentType")),
                        longValue(objectNode.get("sizeBytes")),
                        intValue(objectNode.get("width")),
                        intValue(objectNode.get("height")));
            }
            if (existingAssetId != null) {
                ProjectAssetResponse asset = projectAssetService.getAsset(existingAssetId);
                state.changed = true;
                return toAssetNode(asset, textValue(objectNode.get("filename")), existingAssetId);
            }
            String existingUrl = textValue(objectNode.get("url"));
            if (existingUrl != null) {
                String assetId = extractAssetId(existingUrl);
                if (assetId != null) {
                    ProjectAssetResponse asset = projectAssetService.getAsset(assetId);
                    state.changed = true;
                    return toAssetNode(asset, textValue(objectNode.get("filename")), textValue(objectNode.get("id")));
                }
            }
            return toAssetNode(
                    textValue(objectNode.get("id")),
                    existingUrl,
                    textValue(objectNode.get("filename")),
                    textValue(objectNode.get("contentType")),
                    longValue(objectNode.get("sizeBytes")),
                    intValue(objectNode.get("width")),
                    intValue(objectNode.get("height"))
            );
        }
        if (item.isTextual()) {
            String text = item.asText();
            if (isDataUrl(text)) {
                ProjectAssetResponse asset = storeInlineAsset(projectId, section, assetGroup, assetOrder, text);
                state.changed = true;
                return toAssetNode(asset, null, asset.getId());
            }
            String assetId = extractAssetId(text);
            if (assetId != null) {
                ProjectAssetResponse asset = projectAssetService.getAsset(assetId);
                state.changed = true;
                return toAssetNode(asset, null, asset.getId());
            }
        }
        return null;
    }

    private String sanitizeInlineHtml(String projectId,
                                      String section,
                                      String assetGroup,
                                      String html,
                                      MutationState state) {
        Matcher matcher = INLINE_IMAGE_PATTERN.matcher(html);
        StringBuffer buffer = new StringBuffer();
        int order = 0;
        boolean changed = false;
        while (matcher.find()) {
            String src = matcher.group(1);
            ProjectAssetResponse asset = null;
            if (isDataUrl(src)) {
                asset = storeInlineAsset(projectId, section, assetGroup + ".inlineImages", order++, src);
                changed = true;
            } else {
                String assetId = extractAssetId(src);
                if (assetId != null) {
                    asset = projectAssetService.getAsset(assetId);
                }
            }
            if (asset != null) {
                String replacement = "src=\"" + asset.getUrl() + "\" data-asset-id=\"" + asset.getId() + "\"";
                matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
            }
        }
        matcher.appendTail(buffer);
        if (changed) {
            state.changed = true;
        }
        return changed ? buffer.toString() : html;
    }

    private ProjectAssetResponse storeInlineAsset(String projectId,
                                                  String section,
                                                  String assetGroup,
                                                  int assetOrder,
                                                  String dataUrl) {
        Matcher matcher = DATA_URL_PATTERN.matcher(dataUrl);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("Invalid data URL");
        }
        String contentType = matcher.group(1);
        byte[] bytes = Base64.getDecoder().decode(matcher.group(2));
        String extension = switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
        String filename = assetGroup.replaceAll("[^a-zA-Z0-9._-]", "_") + "-" + assetOrder + extension;
        return projectAssetService.storeAsset(projectId, section, assetGroup, assetOrder, filename, contentType, bytes);
    }

    private ObjectNode toAssetNode(ProjectAssetResponse asset, String preferredFilename, String preferredId) {
        return toAssetNode(
                preferredId != null && !preferredId.isBlank() ? preferredId : asset.getId(),
                asset.getUrl(),
                preferredFilename != null && !preferredFilename.isBlank() ? preferredFilename : asset.getFilename(),
                asset.getContentType(),
                asset.getSizeBytes(),
                asset.getWidth(),
                asset.getHeight()
        );
    }

    private ObjectNode toAssetNode(String id,
                                   String url,
                                   String filename,
                                   String contentType,
                                   Long sizeBytes,
                                   Integer width,
                                   Integer height) {
        ObjectNode assetNode = objectMapper.createObjectNode();
        if (id != null && !id.isBlank()) {
            assetNode.put("id", id);
            assetNode.put("assetId", id);
        }
        if (url != null && !url.isBlank()) {
            assetNode.put("url", url);
            assetNode.put("dataUrl", url);
        }
        if (filename != null && !filename.isBlank()) {
            assetNode.put("filename", filename);
        }
        if (contentType != null && !contentType.isBlank()) {
            assetNode.put("contentType", contentType);
        }
        if (sizeBytes != null) {
            assetNode.put("sizeBytes", sizeBytes);
        }
        if (width != null) {
            assetNode.put("width", width);
        }
        if (height != null) {
            assetNode.put("height", height);
        }
        return assetNode;
    }

    private boolean shouldSanitizeHtml(String fieldName, String value) {
        return value != null
                && value.contains("<img")
                && value.contains("data:image")
                && (HTML_FIELDS.contains(fieldName.toLowerCase(Locale.ROOT)) || value.contains("base64"));
    }

    private boolean isImageArrayField(String fieldName) {
        String normalized = fieldName.toLowerCase(Locale.ROOT);
        return normalized.endsWith("images");
    }

    private boolean isSingleImageField(String fieldName) {
        return SINGLE_IMAGE_FIELDS.contains(fieldName.toLowerCase(Locale.ROOT));
    }

    private boolean isDataUrl(String value) {
        return value != null && value.startsWith("data:image/");
    }

    private String extractAssetId(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        Matcher matcher = ASSET_URL_PATTERN.matcher(url);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String normalizeSection(String section) {
        return section == null ? "" : section.trim().toLowerCase(Locale.ROOT);
    }

    private String textValue(JsonNode node) {
        if (node == null || node.isNull() || !node.isTextual()) {
            return null;
        }
        String value = node.asText();
        return value == null || value.isBlank() ? null : value;
    }

    private Long longValue(JsonNode node) {
        return node != null && node.isNumber() ? node.longValue() : null;
    }

    private Integer intValue(JsonNode node) {
        return node != null && node.isNumber() ? node.intValue() : null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    public record SectionMigrationResult(String content, boolean changed, List<ProjectAssetGroupResponse> assetGroups) {
    }

    public record SanitizedProjectData(ProjectData projectData, boolean changed) {
    }

    private static class MutationState {
        private boolean changed;
    }
}
