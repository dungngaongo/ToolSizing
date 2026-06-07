package com.example.sizing.service;

import com.example.sizing.exception.ResourceNotFoundException;
import com.example.sizing.model.Project;
import com.example.sizing.model.ProjectData;
import com.example.sizing.repository.ProjectDataRepository;
import com.example.sizing.repository.ProjectRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ExportService {
    private static final Logger log = LoggerFactory.getLogger(ExportService.class);
    private static final String FONT = "Times New Roman";
    private static final int FONT_SIZE = 12;
    private static final int HEADING_SIZE = 13;
    private static final int TITLE_SIZE = 16;

    private final ProjectRepository projectRepository;
    private final ProjectDataRepository projectDataRepository;
    private final ObjectMapper objectMapper;

    private static class ModuleInstanceData {
        private final String moduleName;
        private final String instanceKey;
        private final JsonNode data;

        private ModuleInstanceData(String moduleName, String instanceKey, JsonNode data) {
            this.moduleName = moduleName;
            this.instanceKey = instanceKey;
            this.data = data;
        }
    }

    private static class OrderedModuleEntry {
        private final String moduleType;
        private final ModuleInstanceData instance;

        private OrderedModuleEntry(String moduleType, ModuleInstanceData instance) {
            this.moduleType = moduleType;
            this.instance = instance;
        }
    }

    private static class AppendixImage {
        private final String ref;
        private final String title;
        private final String base64;

        private AppendixImage(String ref, String title, String base64) {
            this.ref = ref;
            this.title = title;
            this.base64 = base64;
        }
    }

    private static class ExportContext {
        private final List<AppendixImage> appendixImages = new ArrayList<>();
        private int nextImageIndex = 1;
        private JsonNode sizingRoot;
    }

    public ExportService(ProjectRepository projectRepository,
                         ProjectDataRepository projectDataRepository,
                         ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.projectDataRepository = projectDataRepository;
        this.objectMapper = objectMapper;
    }

    public byte[] exportToDocx(String projectId) throws IOException {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        ProjectData pd = projectDataRepository.findFirstByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectData", "projectId", projectId));

        log.info("=== Export for projectId: {} ===", projectId);

        XWPFDocument doc = new XWPFDocument();
        ExportContext context = new ExportContext();

        // ===== TITLE =====
        addTitle(doc, project.getName());

        // ===== I. YEU CAU BAI TOAN =====
        if (pd.getYeuCauBaiToanContent() != null) {
            writeYeuCauBaiToan(doc, objectMapper.readTree(pd.getYeuCauBaiToanContent()));
        }

        // ===== II. THONG TIN DAU VAO =====
        if (pd.getThongTinDauVaoContent() != null) {
            writeThongTinDauVao(doc, objectMapper.readTree(pd.getThongTinDauVaoContent()), context);
        }

        // ===== III. MO HINH HE THONG =====
        JsonNode moHinhNode = null;
        if (pd.getMoHinhHeThongContent() != null) {
            moHinhNode = objectMapper.readTree(pd.getMoHinhHeThongContent());
            writeMoHinhHeThong(doc, moHinhNode, context);
        }

        // ===== IV. DINH CO HE THONG =====
        if (pd.getDinhCoHeThongContent() != null) {
            writeDinhCoHeThong(doc, objectMapper.readTree(pd.getDinhCoHeThongContent()), moHinhNode, context);
        }

        // ===== V. TONG HOP VA DE XUAT =====
        if (pd.getTongHopVaDeXuatContent() != null) {
            writeTongHop(doc, objectMapper.readTree(pd.getTongHopVaDeXuatContent()), moHinhNode);
        }

        // Images are now embedded inline - no appendix needed

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.write(out);
        doc.close();
        return out.toByteArray();
    }

    // ======================== TITLE ========================
    private void addTitle(XWPFDocument doc, String projectName) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun r = p.createRun();
        r.setText("SIZING D\u1ef0 \u00c1N " + (projectName != null ? projectName : ""));
        r.setBold(true);
        r.setFontSize(TITLE_SIZE);
        r.setFontFamily(FONT);
        doc.createParagraph();
    }

    // ======================== I. YEU CAU BAI TOAN ========================
    private void writeYeuCauBaiToan(XWPFDocument doc, JsonNode node) {
        addSectionHeading(doc, "I. Y\u00caU C\u1ea6U B\u00c0I TO\u00c1N");

        String[][] fields = {
                {"1", "\u0110\u01a1n v\u1ecb ph\u00e1t tri\u1ec3n", "devUnit"},
                {"2", "T\u00ean d\u1ef1 \u00e1n", "projectName"},
                {"3", "Ch\u1ee9c n\u0103ng h\u1ec7 th\u1ed1ng", "sysFeature"},
                {"4", "\u0110\u1ea7u m\u1ed1i \u0111\u1ecbnh c\u1ee1", "contactPerson"},
                {"5", "M\u1ee5c \u0111\u00edch \u0111\u1ecbnh c\u1ee1", "sizingPurpose"},
                {"6", "C\u01a1 s\u1edf \u0111\u1ecbnh c\u1ee1", "sizingBasis"},
                {"7", "Nguy\u00ean t\u1eafc \u0111\u1ecbnh c\u1ee1", "sizingRule"},
                {"8", "M\u1ee9c \u0111\u1ed9 quan tr\u1ecdng c\u1ee7a h\u1ec7 th\u1ed1ng", "importance"},
                {"9", "Th\u1eddi gian tri\u1ec3n khai", "deploymentTime"}
        };

        XWPFTable table = doc.createTable(fields.length + 1, 3);
        styleTable(table);

        setCell(table, 0, 0, "STT", true, "D9E2F3");
        setCell(table, 0, 1, "Th\u00f4ng tin", true, "D9E2F3");
        setCell(table, 0, 2, "Chi ti\u1ebft", true, "D9E2F3");

        for (int i = 0; i < fields.length; i++) {
            setCell(table, i + 1, 0, fields[i][0], false, null, ParagraphAlignment.CENTER);
            setCell(table, i + 1, 1, fields[i][1], false, null, ParagraphAlignment.LEFT, 240);
            setCell(table, i + 1, 2, txt(node, fields[i][2]), false, null, ParagraphAlignment.LEFT, 240);
        }
        doc.createParagraph();
    }

    // ======================== II. THONG TIN DAU VAO ========================
    private void writeThongTinDauVao(XWPFDocument doc, JsonNode root, ExportContext context) {
        addSectionHeading(doc, "II. TH\u00d4NG TIN \u0110\u1ea6U V\u00c0O");

        JsonNode inputRows = root.path("inputRows");
        if (inputRows.isArray() && inputRows.size() > 0) {
            int cols = 6;
            XWPFTable table = doc.createTable(inputRows.size() + 1, cols);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "\u0110\u1ea7u v\u00e0o", true, "D9E2F3");
            setCell(table, 0, 2, "Giá trị hiện tại", true, "D9E2F3");
            setCell(table, 0, 3, "\u0110\u1ecbnh c\u1ee1", true, "D9E2F3");
            setCell(table, 0, 4, "Module", true, "D9E2F3");
            setCell(table, 0, 5, "Ghi ch\u00fa", true, "D9E2F3");

            for (int i = 0; i < inputRows.size(); i++) {
                JsonNode row = inputRows.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(row, "dauVao"), false, null);

                String pocText = "";
                JsonNode pocNode = row.path("taiHeThongPOC");
                if (pocNode.isObject()) pocText = txt(pocNode, "text");
                else pocText = pocNode.asText("");
                setCell(table, i + 1, 2, pocText, false, null);

                String dinhCoText = "";
                JsonNode dinhCoNode = row.path("dinhCo");
                if (dinhCoNode.isObject()) dinhCoText = txt(dinhCoNode, "text");
                else dinhCoText = dinhCoNode.asText("");
                setCell(table, i + 1, 3, dinhCoText, false, null);

                setCell(table, i + 1, 4, txt(row, "module"), false, null);
                setCell(table, i + 1, 5, txt(row, "ghiChu"), false, null);
            }
            doc.createParagraph();

            // POC evidence images - embedded inline
            boolean hasPocEvidence = false;
            for (int i = 0; i < inputRows.size(); i++) {
                JsonNode pocNode = inputRows.get(i).path("taiHeThongPOC");
                if (pocNode.isObject()) {
                    JsonNode imgs = pocNode.path("pocEvidenceImages");
                    if (imgs.isArray() && imgs.size() > 0) {
                        if (!hasPocEvidence) {
                            addSubHeading(doc, "S\u1edf c\u1ee9 t\u1ea3i h\u1ec7 th\u1ed1ng POC:");
                            hasPocEvidence = true;
                        }
                        String rowName = txt(inputRows.get(i), "dauVao").trim();
                        String detail = "D\u00f2ng " + (i + 1) + (rowName.isEmpty() ? "" : (" - " + rowName));
                        addInlineImages(doc, imgs, buildCaption("S\u1edf c\u1ee9 t\u1ea3i h\u1ec7 th\u1ed1ng POC", detail));
                    }
                }
            }

            // Sizing evidence images - embedded inline
            boolean hasSizingEvidence = false;
            for (int i = 0; i < inputRows.size(); i++) {
                JsonNode dinhCoNode = inputRows.get(i).path("dinhCo");
                if (dinhCoNode.isObject()) {
                    JsonNode imgs = dinhCoNode.path("sizingEvidenceImages");
                    if (imgs.isArray() && imgs.size() > 0) {
                        if (!hasSizingEvidence) {
                            addSubHeading(doc, "S\u1edf c\u1ee9 \u0111\u1ecbnh c\u1ee1:");
                            hasSizingEvidence = true;
                        }
                        String rowName = txt(inputRows.get(i), "dauVao").trim();
                        String detail = "D\u00f2ng " + (i + 1) + (rowName.isEmpty() ? "" : (" - " + rowName));
                        addInlineImages(doc, imgs, buildCaption("S\u1edf c\u1ee9 \u0111\u1ecbnh c\u1ee1", detail));
                    }
                }
            }
        }
    }

    // ======================== III. MO HINH HE THONG ========================
    private void writeMoHinhHeThong(XWPFDocument doc, JsonNode root, ExportContext context) {
        addSectionHeading(doc, "III. M\u00d4 H\u00ccNH H\u1ec6 TH\u1ed0NG");

        addSubHeading(doc, "1. M\u00f4 h\u00ecnh v\u1eadt l\u00fd");
        addInlineImages(doc, root.path("physicalImages"), buildCaption("M\u00f4 h\u00ecnh v\u1eadt l\u00fd", null));

        addSubHeading(doc, "2. M\u00f4 h\u00ecnh logic");
        addInlineImages(doc, root.path("logicalImages"), buildCaption("M\u00f4 h\u00ecnh logic", null));

        JsonNode logicComponentRows = root.path("logicComponentRows");
        List<JsonNode> nonEmptyLogicRows = new ArrayList<>();
        if (logicComponentRows.isArray()) {
            for (JsonNode row : logicComponentRows) {
                String componentName = txt(row, "componentName").trim();
                String mainTask = txt(row, "mainTask").trim();
                if (!componentName.isEmpty() || !mainTask.isEmpty()) {
                    nonEmptyLogicRows.add(row);
                }
            }
        }
        if (!nonEmptyLogicRows.isEmpty()) {
            addSubHeading2(doc, "Th\u00e0nh ph\u1ea7n m\u00f4 h\u00ecnh Logic");
            XWPFTable logicTable = doc.createTable(nonEmptyLogicRows.size() + 1, 3);
            styleTable(logicTable);

            setCell(logicTable, 0, 0, "STT", true, "D9E2F3");
            setCell(logicTable, 0, 1, "T\u00ean th\u00e0nh ph\u1ea7n/Module", true, "D9E2F3");
            setCell(logicTable, 0, 2, "Nhi\u1ec7m v\u1ee5 ch\u00ednh", true, "D9E2F3");

            for (int i = 0; i < nonEmptyLogicRows.size(); i++) {
                JsonNode row = nonEmptyLogicRows.get(i);
                setCell(logicTable, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(logicTable, i + 1, 1, txt(row, "componentName"), false, null);
                setCell(logicTable, i + 1, 2, txt(row, "mainTask"), false, null);
            }
            doc.createParagraph();
        }

        // B2. Thông tin kết nối (đặt sau mô hình logic)
        JsonNode connectionRows = root.path("connectionRows");
        if (connectionRows.isArray() && connectionRows.size() > 0) {
            addSubHeading(doc, "3. Th\u00f4ng tin k\u1ebft n\u1ed1i");
            XWPFTable connTable = doc.createTable(connectionRows.size() + 1, 6);
            styleTable(connTable);

            setCell(connTable, 0, 0, "STT", true, "D9E2F3");
            setCell(connTable, 0, 1, "IP Ngu\u1ed3n", true, "D9E2F3");
            setCell(connTable, 0, 2, "IP \u0110\u00edch", true, "D9E2F3");
            setCell(connTable, 0, 3, "Port", true, "D9E2F3");
            setCell(connTable, 0, 4, "Giao th\u1ee9c", true, "D9E2F3");
            setCell(connTable, 0, 5, "M\u00f4 t\u1ea3", true, "D9E2F3");

            for (int i = 0; i < connectionRows.size(); i++) {
                JsonNode r = connectionRows.get(i);
                setCell(connTable, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(connTable, i + 1, 1, txt(r, "source"), false, null);
                setCell(connTable, i + 1, 2, txt(r, "destination"), false, null);
                setCell(connTable, i + 1, 3, txt(r, "port"), false, null);
                setCell(connTable, i + 1, 4, txt(r, "protocol"), false, null);
                setCell(connTable, i + 1, 5, txt(r, "description"), false, null);
            }
            doc.createParagraph();

            // Connection evidence images
            addInlineImages(doc, root.path("connectionImages"), buildCaption("S\u01a1 \u0111\u1ed3 k\u1ebft n\u1ed1i", null));
        }

        addSubHeading(doc, "4. Lu\u1ed3ng nghi\u1ec7p v\u1ee5");
        addInlineImages(doc, root.path("flowImages"), buildCaption("S\u01a1 \u0111\u1ed3 lu\u1ed3ng nghi\u1ec7p v\u1ee5", null));

        String flowExplanation = txt(root, "flowExplanation");
        if (!flowExplanation.isEmpty()) {
            addSubHeading2(doc, "M\u00f4 t\u1ea3/Gi\u1ea3i th\u00edch chi ti\u1ebft lu\u1ed3ng nghi\u1ec7p v\u1ee5:");
            addNormalText(doc, flowExplanation);
        }

        JsonNode archRows = root.path("archRows");
        if (archRows.isArray() && archRows.size() > 0) {
            addSubHeading(doc, "5. Chi ti\u1ebft th\u00e0nh ph\u1ea7n");
            XWPFTable table = doc.createTable(archRows.size() + 1, 6);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "Module", true, "D9E2F3");
            setCell(table, 0, 2, "Lo\u1ea1i module", true, "D9E2F3");
            setCell(table, 0, 3, "Zone m\u1ea1ng", true, "D9E2F3");
            setCell(table, 0, 4, "H\u1ec7 \u0111i\u1ec1u h\u00e0nh", true, "D9E2F3");
            setCell(table, 0, 5, "S\u1ed1 l\u01b0\u1ee3ng VIP", true, "D9E2F3");

            for (int i = 0; i < archRows.size(); i++) {
                JsonNode r = archRows.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "moduleName"), false, null);
                setCell(table, i + 1, 2, txt(r, "loaiModule"), false, null);
                setCell(table, i + 1, 3, txt(r, "zoneMang"), false, null);
                setCell(table, i + 1, 4, txt(r, "heDieuHanh"), false, null);
                setCell(table, i + 1, 5, txt(r, "soLuongVIP"), false, null);
            }
            doc.createParagraph();
        }
    }

    // ======================== IV. DINH CO HE THONG ========================
    private void writeDinhCoHeThong(XWPFDocument doc, JsonNode root, JsonNode moHinhNode, ExportContext context) {
        addSectionHeading(doc, "IV. ĐỊNH C\u1ee0 H\u1ec6 TH\u1ed0NG");
        
        context.sizingRoot = root;
        // Get selected modules from moHinhHeThong archRows
        java.util.Set<String> selectedModules = new java.util.HashSet<>();
        if (moHinhNode != null) {
            JsonNode archRows = moHinhNode.path("archRows");
            if (archRows.isArray()) {
                for (JsonNode row : archRows) {
                    String loaiModule = txt(row, "loaiModule").trim();
                    if (!loaiModule.isEmpty()) {
                        selectedModules.add(loaiModule);
                    }
                }
            }
        }
        
        // If no modules found in moHinhHeThong, export all (backward compatibility)
        boolean exportAll = selectedModules.isEmpty();

        List<OrderedModuleEntry> orderedEntries = buildOrderedSizingEntries(root, moHinhNode);
        if (!orderedEntries.isEmpty()) {
            java.util.Map<String, Integer> totalByType = new java.util.HashMap<>();
            for (OrderedModuleEntry entry : orderedEntries) {
                totalByType.put(entry.moduleType, totalByType.getOrDefault(entry.moduleType, 0) + 1);
            }

            java.util.Map<String, Integer> seqByType = new java.util.HashMap<>();
            int sectionIndex = 1;
            for (OrderedModuleEntry entry : orderedEntries) {
                String moduleType = entry.moduleType;
                String moduleName = entry.instance.moduleName;
                String heading = sectionIndex + ". Module " + (moduleName != null && !moduleName.isBlank() ? moduleName : moduleType);
                int seq = seqByType.getOrDefault(moduleType, 0) + 1;
                seqByType.put(moduleType, seq);

                if ("App".equals(moduleType)) {
                    writeModuleApp(doc, entry.instance.data, heading, context);
                } else if ("MariaDB".equals(moduleType)) {
                    writeModuleMariaDB(doc, entry.instance.data, heading, context);
                } else if ("Redis".equals(moduleType)) {
                    writeModuleRedis(doc, entry.instance.data, heading, context);
                } else if ("Kafka".equals(moduleType)) {
                    writeModuleKafka(doc, entry.instance.data, heading, context);
                } else if ("K8S".equals(moduleType)) {
                    writeModuleK8S(doc, entry.instance.data, heading, context);
                } else if ("LB/FW".equals(moduleType)) {
                    writeModuleLBFW(doc, entry.instance.data, heading, context);
                } else if ("Khác".equals(moduleType)) {
                    writeModuleCustom(doc, entry.instance.data, heading, context);
                }

                sectionIndex++;
            }
            return;
        }
        
        if (exportAll || selectedModules.contains("App")) {
            List<ModuleInstanceData> appInstances = extractModuleInstances(root, "App", "moduleApp");
            if (appInstances.isEmpty()) {
                writeModuleApp(doc, root.path("moduleApp"), "1. Module App", context);
            } else {
                for (int i = 0; i < appInstances.size(); i++) {
                    String moduleName = appInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "App";
                    String heading = "1. Module " + displayName;
                    if (appInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(appInstances.get(i), i + 1, "App");
                    }
                    writeModuleApp(doc, appInstances.get(i).data, heading, context);
                }
            }
        }
        if (exportAll || selectedModules.contains("MariaDB")) {
            List<ModuleInstanceData> mariaInstances = extractModuleInstances(root, "MariaDB", "moduleMariaDB");
            if (mariaInstances.isEmpty()) {
                writeModuleMariaDB(doc, root.path("moduleMariaDB"), "2. Module MariaDB", context);
            } else {
                for (int i = 0; i < mariaInstances.size(); i++) {
                    String moduleName = mariaInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "MariaDB";
                    String heading = "2. Module " + displayName;
                    if (mariaInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(mariaInstances.get(i), i + 1, "MariaDB");
                    }
                    writeModuleMariaDB(doc, mariaInstances.get(i).data, heading, context);
                }
            }
        }
        if (exportAll || selectedModules.contains("Redis")) {
            List<ModuleInstanceData> redisInstances = extractModuleInstances(root, "Redis", "moduleRedis");
            if (redisInstances.isEmpty()) {
                writeModuleRedis(doc, root.path("moduleRedis"), "3. Module Redis", context);
            } else {
                for (int i = 0; i < redisInstances.size(); i++) {
                    String moduleName = redisInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "Redis";
                    String heading = "3. Module " + displayName;
                    if (redisInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(redisInstances.get(i), i + 1, "Redis");
                    }
                    writeModuleRedis(doc, redisInstances.get(i).data, heading, context);
                }
            }
        }
        if (exportAll || selectedModules.contains("Kafka")) {
            List<ModuleInstanceData> kafkaInstances = extractModuleInstances(root, "Kafka", "moduleKafka");
            if (kafkaInstances.isEmpty()) {
                writeModuleKafka(doc, root.path("moduleKafka"), "4. Module Kafka", context);
            } else {
                for (int i = 0; i < kafkaInstances.size(); i++) {
                    String moduleName = kafkaInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "Kafka";
                    String heading = "4. Module " + displayName;
                    if (kafkaInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(kafkaInstances.get(i), i + 1, "Kafka");
                    }
                    writeModuleKafka(doc, kafkaInstances.get(i).data, heading, context);
                }
            }
        }
        if (exportAll || selectedModules.contains("K8S")) {
            List<ModuleInstanceData> k8sInstances = extractModuleInstances(root, "K8S", "moduleK8S");
            if (k8sInstances.isEmpty()) {
                writeModuleK8S(doc, root.path("moduleK8S"), "5. Module K8S", context);
            } else {
                for (int i = 0; i < k8sInstances.size(); i++) {
                    String moduleName = k8sInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "K8S";
                    String heading = "5. Module " + displayName;
                    if (k8sInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(k8sInstances.get(i), i + 1, "K8S");
                    }
                    writeModuleK8S(doc, k8sInstances.get(i).data, heading, context);
                }
            }
        }
        if (exportAll || selectedModules.contains("LB/FW")) {
            List<ModuleInstanceData> lbfwInstances = extractModuleInstances(root, "LB/FW", "moduleLBFW");
            if (lbfwInstances.isEmpty()) {
                writeModuleLBFW(doc, root.path("moduleLBFW"), "6. Module LB/FW", context);
            } else {
                for (int i = 0; i < lbfwInstances.size(); i++) {
                    String moduleName = lbfwInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "LB/FW";
                    String heading = "6. Module " + displayName;
                    if (lbfwInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(lbfwInstances.get(i), i + 1, "LB/FW");
                    }
                    writeModuleLBFW(doc, lbfwInstances.get(i).data, heading, context);
                }
            }
        }
        if (exportAll || selectedModules.contains("Khác")) {
            List<ModuleInstanceData> customInstances = extractModuleInstances(root, "Khác", "moduleCustom");
            if (customInstances.isEmpty()) {
                writeModuleCustom(doc, root.path("moduleCustom"), "7. Module Khác", context);
            } else {
                for (int i = 0; i < customInstances.size(); i++) {
                    String moduleName = customInstances.get(i).moduleName;
                    String displayName = (moduleName != null && !moduleName.isBlank()) ? moduleName : "Khác";
                    String heading = "7. Module " + displayName;
                    if (customInstances.size() > 1) {
                        heading = heading + " - " + resolveInstanceLabel(customInstances.get(i), i + 1, "Khác");
                    }
                    writeModuleCustom(doc, customInstances.get(i).data, heading, context);
                }
            }
        }
    }

    private List<ModuleInstanceData> extractModuleInstances(JsonNode root, String moduleType, String legacyField) {
        List<ModuleInstanceData> instances = new ArrayList<>();

        JsonNode moduleInstances = root.path("moduleInstances");
        if (moduleInstances.isArray()) {
            for (JsonNode item : moduleInstances) {
                if (!moduleType.equalsIgnoreCase(txt(item, "moduleType").trim())) {
                    continue;
                }
                JsonNode data = item.path("data");
                if (!data.isMissingNode() && !data.isNull()) {
                    instances.add(new ModuleInstanceData(txt(item, "moduleName"), txt(item, "instanceKey"), data));
                }
            }
        }

        if (instances.isEmpty()) {
            JsonNode legacyNode = root.path(legacyField);
            if (!legacyNode.isMissingNode() && !legacyNode.isNull()) {
                instances.add(new ModuleInstanceData("", "", legacyNode));
            }
        }

        return instances;
    }

    private String resolveInstanceLabel(ModuleInstanceData instance, int index, String defaultPrefix) {
        if (!instance.moduleName.isBlank()) return instance.moduleName;
        if (!instance.instanceKey.isBlank()) return instance.instanceKey;
        return defaultPrefix + " #" + index;
    }

    private List<OrderedModuleEntry> buildOrderedSizingEntries(JsonNode root, JsonNode moHinhNode) {
        List<OrderedModuleEntry> ordered = new ArrayList<>();
        if (moHinhNode == null) return ordered;

        JsonNode archRows = moHinhNode.path("archRows");
        if (!archRows.isArray() || archRows.size() == 0) return ordered;

        JsonNode moduleInstances = root.path("moduleInstances");
        if (!moduleInstances.isArray() || moduleInstances.size() == 0) return ordered;

        java.util.Map<String, ModuleInstanceData> instanceByKey = new java.util.HashMap<>();
        java.util.Map<String, java.util.List<ModuleInstanceData>> instancesByType = new java.util.HashMap<>();

        for (JsonNode item : moduleInstances) {
            String moduleType = txt(item, "moduleType").trim();
            if (moduleType.isEmpty()) continue;
            JsonNode data = item.path("data");
            if (data.isMissingNode() || data.isNull()) continue;

            ModuleInstanceData instance = new ModuleInstanceData(
                    txt(item, "moduleName"),
                    txt(item, "instanceKey"),
                    data
            );
            String instanceKey = instance.instanceKey;
            if (!instanceKey.isBlank()) {
                instanceByKey.put(instanceKey, instance);
            }
            instancesByType.computeIfAbsent(moduleType, k -> new ArrayList<>()).add(instance);
        }

        java.util.Set<String> usedKeys = new java.util.HashSet<>();

        for (int i = 0; i < archRows.size(); i++) {
            JsonNode row = archRows.get(i);
            String moduleType = txt(row, "loaiModule").trim();
            if (moduleType.isEmpty()) continue;

            String moduleName = txt(row, "moduleName").trim();
            String instanceKey = buildInstanceKey(moduleType, i + 1);
            ModuleInstanceData instance = instanceByKey.get(instanceKey);
            if (instance != null && !instance.instanceKey.isBlank()) {
                usedKeys.add(instance.instanceKey);
                ordered.add(new OrderedModuleEntry(moduleType, instance));
                continue;
            }

            List<ModuleInstanceData> candidates = instancesByType.getOrDefault(moduleType, new ArrayList<>());
            ModuleInstanceData matched = null;
            if (!moduleName.isBlank()) {
                for (ModuleInstanceData candidate : candidates) {
                    if (!candidate.instanceKey.isBlank() && usedKeys.contains(candidate.instanceKey)) continue;
                    if (moduleName.equalsIgnoreCase(candidate.moduleName)) {
                        matched = candidate;
                        break;
                    }
                }
            }

            if (matched == null) {
                for (ModuleInstanceData candidate : candidates) {
                    if (!candidate.instanceKey.isBlank() && usedKeys.contains(candidate.instanceKey)) continue;
                    matched = candidate;
                    break;
                }
            }

            if (matched != null) {
                if (!matched.instanceKey.isBlank()) usedKeys.add(matched.instanceKey);
                ordered.add(new OrderedModuleEntry(moduleType, matched));
            }
        }

        return ordered;
    }

    private String buildInstanceKey(String moduleType, int rowIndex) {
        String raw = moduleType + "-" + rowIndex;
        return raw.replaceAll("[^a-zA-Z0-9_-]", "_");
    }

    // ---------- Module App ----------
    private void writeModuleApp(XWPFDocument doc, JsonNode moduleApp, String heading, ExportContext context) {
        if (moduleApp.isMissingNode()) return;
        addSubHeading(doc, heading);

        // Baseline table
        JsonNode baselineTable = moduleApp.path("baselineTable");
        if (baselineTable.isArray() && baselineTable.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin h\u1ec7 th\u1ed1ng tham chi\u1ebfu");

            int rows = baselineTable.size();
            XWPFTable table = doc.createTable(rows + 2, 7);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "Số lượng", true, "D9E2F3");
            setCell(table, 0, 3, "CPU", true, "D9E2F3");
            setCell(table, 0, 4, "RAM\n(GB)", true, "D9E2F3");
            setCell(table, 0, 5, "DISK\n(GB)", true, "D9E2F3");
            setCell(table, 0, 6, "Cint_rate_2017", true, "D9E2F3");

            double totalCpu = 0, totalRam = 0, totalDisk = 0, totalCint = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = baselineTable.get(i);
                double qty = toDouble(r, "quantity");
                String qtyText = txt(r, "quantity");
                if (qty <= 0) {
                    qty = 1;
                    if (qtyText.isBlank()) qtyText = "1";
                }
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, qtyText, false, null);
                setCell(table, i + 1, 3, txt(r, "cpu"), false, null);
                setCell(table, i + 1, 4, txt(r, "ram"), false, null);
                setCell(table, i + 1, 5, txt(r, "disk"), false, null);
                setCell(table, i + 1, 6, txt(r, "cintRate"), false, null);
                totalCpu += toDouble(r, "cpu");
                totalRam += toDouble(r, "ram") * qty;
                totalDisk += toDouble(r, "disk") * qty;
                totalCint += toDouble(r, "cintRate") * qty;
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, formatNum(totalCpu), true, "E2EFDA");
            setCell(table, rows + 1, 4, formatNum(totalRam), true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalDisk), true, "E2EFDA");
            setCell(table, rows + 1, 6, formatNum(totalCint), true, "E2EFDA");
            doc.createParagraph();

            boolean hasBaselineEvidence = false;
            for (int i = 0; i < rows; i++) {
                JsonNode row = baselineTable.get(i);
                JsonNode evidenceImages = row.path("evidenceImages");
                String evidenceImage = txt(row, "evidenceImage");
                boolean hasCurrentEvidence = evidenceImages.isArray() && evidenceImages.size() > 0;
                if (!hasCurrentEvidence && evidenceImage.isBlank()) {
                    continue;
                }

                if (!hasBaselineEvidence) {
                    addSubHeading2(doc, "S\u1edf c\u1ee9 h\u1ec7 th\u1ed1ng tham chi\u1ebfu:");
                    hasBaselineEvidence = true;
                }

                String ip = txt(row, "ip").trim();
                addSubHeading2(doc, ip.isEmpty() ? ("D\u00f2ng " + (i + 1)) : ("D\u00f2ng " + (i + 1) + " - " + ip));
                String detail = "D\u00f2ng " + (i + 1) + (ip.isEmpty() ? "" : (" - " + ip));
                if (hasCurrentEvidence) {
                    addInlineImages(doc, evidenceImages, buildCaption(heading + " - S\u1edf c\u1ee9 h\u1ec7 th\u1ed1ng tham chi\u1ebfu", detail));
                } else {
                    addInlineSingleImage(doc, evidenceImage, buildCaption(heading + " - S\u1edf c\u1ee9 h\u1ec7 th\u1ed1ng tham chi\u1ebfu", detail));
                }
            }
        }

        addInlineImages(doc, moduleApp.path("baselineEvidence"), buildCaption(heading + " - S\u1edf c\u1ee9 h\u1ec7 th\u1ed1ng tham chi\u1ebfu", null));

        // Input config table
        JsonNode inputConfig = moduleApp.path("inputConfigTable");
        if (inputConfig.isArray() && inputConfig.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o");

            int rows = inputConfig.size();
            XWPFTable table = doc.createTable(rows + 2, 6);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "T\u1ea3i CPU 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 3, "T\u1ea3i RAM 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 4, "Cint_rate used\n(Cint)", true, "D9E2F3");
            setCell(table, 0, 5, "RAM used\n(GB)", true, "D9E2F3");

            double totalCintUsed = 0, totalRamUsed = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = inputConfig.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpuLoad"), false, null);
                setCell(table, i + 1, 3, txt(r, "ramLoad"), false, null);
                setCell(table, i + 1, 4, txt(r, "cintUsed"), false, null);
                setCell(table, i + 1, 5, txt(r, "ramUsed"), false, null);
                totalCintUsed += toDouble(r, "cintUsed");
                totalRamUsed += toDouble(r, "ramUsed");
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, "", true, "E2EFDA");
            setCell(table, rows + 1, 4, formatNum(totalCintUsed), true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalRamUsed), true, "E2EFDA");
            doc.createParagraph();

            boolean hasInputEvidence = false;
            for (int i = 0; i < rows; i++) {
                JsonNode row = inputConfig.get(i);
                JsonNode evidenceImages = row.path("evidenceImages");
                String evidenceImage = txt(row, "evidenceImage");
                boolean hasCurrentEvidence = evidenceImages.isArray() && evidenceImages.size() > 0;
                if (!hasCurrentEvidence && evidenceImage.isBlank()) {
                    continue;
                }

                if (!hasInputEvidence) {
                    addSubHeading2(doc, "S\u1edf c\u1ee9 th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o:");
                    hasInputEvidence = true;
                }

                String ip = txt(row, "ip").trim();
                addSubHeading2(doc, ip.isEmpty() ? ("D\u00f2ng " + (i + 1)) : ("D\u00f2ng " + (i + 1) + " - " + ip));
                String detail = "D\u00f2ng " + (i + 1) + (ip.isEmpty() ? "" : (" - " + ip));
                if (hasCurrentEvidence) {
                    addInlineImages(doc, evidenceImages, buildCaption(heading + " - S\u1edf c\u1ee9 th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o", detail));
                } else {
                    addInlineSingleImage(doc, evidenceImage, buildCaption(heading + " - S\u1edf c\u1ee9 th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o", detail));
                }
            }
        }

        JsonNode storageInput = moduleApp.path("storageInputTable");
        if (storageInput.isArray() && storageInput.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin l\u01b0u tr\u1eef \u0111\u1ea7u v\u00e0o");

            int rows = storageInput.size();
            XWPFTable table = doc.createTable(rows + 1, 5);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "Ph\u00e2n v\u00f9ng", true, "D9E2F3");
            setCell(table, 0, 3, "Used (GB)", true, "D9E2F3");
            setCell(table, 0, 4, "Ghi ch\u00fa", true, "D9E2F3");

            for (int i = 0; i < rows; i++) {
                JsonNode r = storageInput.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "partition"), false, null);
                setCell(table, i + 1, 3, txt(r, "used"), false, null);
                setCell(table, i + 1, 4, txt(r, "note"), false, null);
            }
            doc.createParagraph();

            boolean hasStorageEvidence = false;
            for (int i = 0; i < rows; i++) {
                JsonNode row = storageInput.get(i);
                JsonNode rowEvidenceImages = row.path("evidenceImages");
                String rowEvidenceImage = txt(row, "evidenceImage");
                boolean hasCurrentEvidence = rowEvidenceImages.isArray() && rowEvidenceImages.size() > 0;
                if (!hasCurrentEvidence && rowEvidenceImage.isBlank()) {
                    continue;
                }

                if (!hasStorageEvidence) {
                    addSubHeading2(doc, "S\u1edf c\u1ee9 th\u00f4ng tin l\u01b0u tr\u1eef \u0111\u1ea7u v\u00e0o:");
                    hasStorageEvidence = true;
                }

                String ip = txt(row, "ip").trim();
                String partition = txt(row, "partition").trim();
                String detail = "D\u00f2ng " + (i + 1);
                if (!ip.isEmpty()) {
                    detail += " - " + ip;
                }
                if (!partition.isEmpty()) {
                    detail += " - " + partition;
                }

                addSubHeading2(doc, detail);
                if (hasCurrentEvidence) {
                    addInlineImages(doc, rowEvidenceImages, buildCaption(heading + " - S\u1edf c\u1ee9 th\u00f4ng tin l\u01b0u tr\u1eef \u0111\u1ea7u v\u00e0o", detail));
                } else {
                    addInlineSingleImage(doc, rowEvidenceImage, buildCaption(heading + " - S\u1edf c\u1ee9 th\u00f4ng tin l\u01b0u tr\u1eef \u0111\u1ea7u v\u00e0o", detail));
                }
            }
        }

        // Evidence images
        JsonNode evidenceImages = moduleApp.path("evidenceImages");
        if (evidenceImages.isArray() && evidenceImages.size() > 0) {
            addSubHeading2(doc, "S\u1edf c\u1ee9 th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o:");
            addInlineImages(doc, evidenceImages, buildCaption(heading + " - S\u1edf c\u1ee9 th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o", null));
        }

        String selectedInputRow = txt(moduleApp, "selectedInputRow");
        if (!selectedInputRow.isEmpty()) {
            addLabelValue(doc, "Lấy thông số đầu vào theo ", selectedInputRow);
        }

        String pocValue = txt(moduleApp, "pocValue");
        String sizingValue = txt(moduleApp, "sizingValue");
        if (!pocValue.isEmpty() || !sizingValue.isEmpty()) {
            addLabelValue(doc, "Giá trị \u0111\u1ea7u v\u00e0o:", pocValue);
            addLabelValue(doc, "Giá trị \u0111\u1ecbnh c\u1ee1:", sizingValue);
        }

        String flavorEval = txt(moduleApp, "flavorEval");
        String flavorNote = txt(moduleApp, "flavorNote");
        if (!flavorEval.isEmpty() || !flavorNote.isEmpty()) {
            addLabelValue(doc, "\u0110\u00e1nh gi\u00e1 flavor:", flavorEval);
            addLabelValue(doc, "Ghi ch\u00fa flavor:", flavorNote);
        }

        String sizingResult = txt(moduleApp, "sizingResult");
        if (!sizingResult.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteAppSizingResult(doc, sizingResult, moduleApp);
        }

        doc.createParagraph();
    }

    // Parse Module App sizing result HTML and write to DOC with proper formatting
    private void parseAndWriteAppSizingResult(XWPFDocument doc, String html, JsonNode moduleApp) {
        try {
            String machineTableHtml = extractTableHtmlByMarker(html, "data-app-machine-table=\"1\"");
            String nTableHtml = extractTableHtmlByMarker(html, "data-app-n-table=\"1\"");
            String proposalTableHtml = extractTableHtmlByMarker(html, "data-app-proposal-table=\"1\"");
            String recommendationHtml = extractDivHtmlByMarker(html, "data-app-recommendation=\"1\"");

            if (!machineTableHtml.isEmpty() || !nTableHtml.isEmpty() || !proposalTableHtml.isEmpty()) {
                List<List<String>> machineRows = extractTableRows(machineTableHtml);
                if (!machineRows.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh");
                    XWPFTable table = doc.createTable(machineRows.size() + 1, 4);
                    styleTable(table);

                    setCell(table, 0, 0, "STT", true, "D9E2F3");
                    setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                    setCell(table, 0, 2, "M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh", true, "D9E2F3");
                    setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < machineRows.size(); i++) {
                        List<String> row = machineRows.get(i);
                        if (row.size() < 4) continue;
                        setCell(table, i + 1, 0, row.get(0), false, null);
                        setCell(table, i + 1, 1, row.get(1), false, null);
                        setCell(table, i + 1, 2, row.get(2), false, null);
                        setCell(table, i + 1, 3, row.get(3), false, null);
                    }
                    doc.createParagraph();
                }

                if (!recommendationHtml.isEmpty()) {
                    String recommendationText = stripHtmlKeepLineBreaks(recommendationHtml);
                    if (!recommendationText.isEmpty()) {
                        recommendationText = recommendationText.replaceFirst("(?i)^\\s*\\u0111\\u1ec1 xu\\u1ea5t\\s*:\\s*", "");
                        addNormalText(doc, recommendationText);
                        doc.createParagraph();
                    }
                }

                List<String> nHeaders = extractTableHeaders(nTableHtml);
                List<List<String>> nRows = extractTableRows(nTableHtml);
                if (!nHeaders.isEmpty() && !nRows.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng N");
                    XWPFTable table = doc.createTable(nRows.size() + 1, nHeaders.size());
                    styleTable(table);

                    for (int col = 0; col < nHeaders.size(); col++) {
                        setCell(table, 0, col, nHeaders.get(col), true, "D9E2F3");
                    }

                    for (int rowIndex = 0; rowIndex < nRows.size(); rowIndex++) {
                        List<String> row = nRows.get(rowIndex);
                        for (int col = 0; col < nHeaders.size(); col++) {
                            String value = col < row.size() ? row.get(col) : "";
                            setCell(table, rowIndex + 1, col, value, false, null);
                        }
                    }
                    doc.createParagraph();
                }

                List<List<String>> proposalRows = extractTableRows(proposalTableHtml);
                String selectedProposalSource = txt(moduleApp, "selectedProposalSource").trim();
                JsonNode customProposalTable = moduleApp.path("customProposalTable");

                // Support both single object format and array format
                List<Map<String, String>> customProposalData = new ArrayList<>();
                if (customProposalTable.isArray() && customProposalTable.size() > 0) {
                    // Array format (new multi-row support)
                    for (JsonNode row : customProposalTable) {
                        Map<String, String> rowData = new HashMap<>();
                        rowData.put("config", txt(row, "configurationText").trim());
                        rowData.put("qty", txt(row, "quantity").trim());
                        rowData.put("note", txt(row, "note").trim());
                        customProposalData.add(rowData);
                    }
                } else {
                    // Single object format (legacy support)
                    String config = txt(customProposalTable, "configurationText").trim();
                    if (!config.isEmpty()) {
                        Map<String, String> rowData = new HashMap<>();
                        rowData.put("config", config);
                        rowData.put("qty", txt(customProposalTable, "quantity").trim());
                        rowData.put("note", txt(customProposalTable, "note").trim());
                        customProposalData.add(rowData);
                    }
                }

                List<String[]> finalProposalRows = new ArrayList<>();

                if ("custom".equalsIgnoreCase(selectedProposalSource) && !customProposalData.isEmpty()) {
                    for (Map<String, String> customRow : customProposalData) {
                        String configurationText = customRow.getOrDefault("config", "");
                        List<String> normalizedLines = new ArrayList<>();
                        String[] lines = configurationText.split("\\r?\\n");
                        for (String line : lines) {
                            String trimmed = line == null ? "" : line.trim();
                            if (!trimmed.isEmpty()) {
                                normalizedLines.add("- " + trimmed);
                            }
                        }
                        if (!normalizedLines.isEmpty()) {
                            finalProposalRows.add(new String[]{
                                    String.join("\n", normalizedLines),
                                    customRow.getOrDefault("qty", "").trim(),
                                    customRow.getOrDefault("note", "").trim()
                            });
                        }
                    }
                } else if (!proposalRows.isEmpty()) {
                    for (List<String> proposalRow : proposalRows) {
                        if (proposalRow.size() >= 3) {
                            finalProposalRows.add(new String[]{
                                    proposalRow.get(0),
                                    proposalRow.get(1),
                                    proposalRow.get(2)
                            });
                        }
                    }
                }

                if (!finalProposalRows.isEmpty()) {
                    addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t thi\u1ebft b\u1ecb");
                    XWPFTable deviceTable = doc.createTable(finalProposalRows.size() + 1, 3);
                    styleTable(deviceTable);

                    setCell(deviceTable, 0, 0, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                    setCell(deviceTable, 0, 1, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                    setCell(deviceTable, 0, 2, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < finalProposalRows.size(); i++) {
                        String[] proposalRow = finalProposalRows.get(i);
                        setCell(deviceTable, i + 1, 0, proposalRow[0], false, "E6FFED");
                        setCell(deviceTable, i + 1, 1, proposalRow[1], true, "E6FFED");
                        setCell(deviceTable, i + 1, 2, proposalRow[2], false, "E6FFED");
                    }
                    doc.createParagraph();
                }
                return;
            }
            
            Pattern machineTablePattern = Pattern.compile(
                    "B\u1ea3ng t\u00ednh to\u00e1n M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh.*?<tbody>(.*?)</tbody>",
                    Pattern.DOTALL | Pattern.CASE_INSENSITIVE
            );
            Matcher machineTableMatcher = machineTablePattern.matcher(html);

            List<String[]> tableData = new ArrayList<>();
            if (machineTableMatcher.find()) {
                String machineBody = machineTableMatcher.group(1);
                Pattern trPattern = Pattern.compile("<tr[^>]*>(.*?)</tr>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
                Pattern tdPattern = Pattern.compile("<td[^>]*>(.*?)</td>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

                Matcher trMatcher = trPattern.matcher(machineBody);
                while (trMatcher.find()) {
                    String tr = trMatcher.group(1);
                    Matcher tdMatcher = tdPattern.matcher(tr);
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(stripHtml(tdMatcher.group(1)));
                    }

                    if (cols.size() >= 4) {
                        String stt = cols.get(0);
                        if (stt.matches("\\d+")) {
                            tableData.add(new String[]{
                                    stt,
                                    cols.get(1),
                                    cols.get(2),
                                    cols.get(3)
                            });
                        }
                    }
                }
            }

            if (!tableData.isEmpty()) {
                addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh");
                XWPFTable table = doc.createTable(tableData.size() + 1, 4);
                styleTable(table);

                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                setCell(table, 0, 2, "M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < tableData.size(); i++) {
                    String[] row = tableData.get(i);
                    setCell(table, i + 1, 0, row[0], false, null);
                    setCell(table, i + 1, 1, row[1], false, null);
                    setCell(table, i + 1, 2, row[2], false, null);
                    setCell(table, i + 1, 3, row[3], false, null);
                }
                doc.createParagraph();
            }

            Pattern recommendationPattern = Pattern.compile(
                    "<strong>\\s*\u0110\u1ec1 xu\u1ea5t:\\s*</strong>(.*?)</div>",
                    Pattern.DOTALL | Pattern.CASE_INSENSITIVE
            );
            Matcher recommendationMatcher = recommendationPattern.matcher(html);
            if (recommendationMatcher.find()) {
                String recommendationText = stripHtml(recommendationMatcher.group(1));
                if (!recommendationText.isEmpty()) {
                    addNormalText(doc, "\u0110\u1ec1 xu\u1ea5t: " + recommendationText);
                    doc.createParagraph();
                }
            }
            
            // Extract Bảng phân bổ theo số lượng N
            java.util.regex.Pattern nTablePattern = java.util.regex.Pattern.compile(
                "Gi\u00e1 tr\u1ecb N.*?</thead>\\s*<tbody>(.*?)</tbody>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher nTableMatcher = nTablePattern.matcher(html);
            if (nTableMatcher.find()) {
                String tableContent = nTableMatcher.group(1);
                java.util.regex.Pattern nRowPattern = java.util.regex.Pattern.compile(
                    "<tr[^>]*>\\s*<td[^>]*>([^<]+)</td>\\s*<td[^>]*>([\\d.]+)</td>\\s*<td[^>]*>([\\d.]+)</td>\\s*<td[^>]*>([\\d.]+)</td>\\s*</tr>",
                    java.util.regex.Pattern.DOTALL
                );
                java.util.regex.Matcher nRowMatcher = nRowPattern.matcher(tableContent);
                
                java.util.List<String[]> nTableData = new java.util.ArrayList<>();
                while (nRowMatcher.find()) {
                    nTableData.add(new String[]{
                        nRowMatcher.group(1).trim(),
                        nRowMatcher.group(2).trim(),
                        nRowMatcher.group(3).trim(),
                        nRowMatcher.group(4).trim()
                    });
                }
                
                if (!nTableData.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng N");
                    XWPFTable nTable = doc.createTable(nTableData.size() + 1, 4);
                    styleTable(nTable);
                    
                    setCell(nTable, 0, 0, "Gi\u00e1 tr\u1ecb N", true, "D9E2F3");
                    setCell(nTable, 0, 1, "Cint CPU y\u00eau c\u1ea7u", true, "D9E2F3");
                    setCell(nTable, 0, 2, "RAM y\u00eau c\u1ea7u", true, "D9E2F3");
                    setCell(nTable, 0, 3, "Disk y\u00eau c\u1ea7u", true, "D9E2F3");
                    
                    for (int i = 0; i < nTableData.size(); i++) {
                        String[] row = nTableData.get(i);
                        setCell(nTable, i + 1, 0, row[0], false, null);
                        setCell(nTable, i + 1, 1, row[1], false, null);
                        setCell(nTable, i + 1, 2, row[2], false, null);
                        setCell(nTable, i + 1, 3, row[3], false, null);
                    }
                    doc.createParagraph();
                }
            }
            
            // Extract Đề xuất thiết bị
            java.util.regex.Pattern devicePattern = java.util.regex.Pattern.compile(
                "CPU:\\s*=?\\s*(\\d+)\\s*Cint.*?RAM:\\s*=?\\s*(\\d+)\\s*GB.*?DISK:\\s*=?\\s*(\\d+)\\s*GB.*?<strong>(\\d+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher deviceMatcher = devicePattern.matcher(html);
            if (deviceMatcher.find()) {
                addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t thi\u1ebft b\u1ecb");
                XWPFTable deviceTable = doc.createTable(2, 3);
                styleTable(deviceTable);
                
                setCell(deviceTable, 0, 0, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                setCell(deviceTable, 0, 1, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(deviceTable, 0, 2, "Ghi ch\u00fa", true, "D9E2F3");
                
                String config = "CPU: " + deviceMatcher.group(1) + " Cint\nRAM: " + deviceMatcher.group(2) + " GB\nDISK: " + deviceMatcher.group(3) + " GB";
                setCell(deviceTable, 1, 0, config, false, "E6FFED");
                setCell(deviceTable, 1, 1, deviceMatcher.group(4), true, "E6FFED");
                setCell(deviceTable, 1, 2, "D\u1ef1 ph\u00f2ng N+1", false, "E6FFED");
                doc.createParagraph();
            }
        } catch (Exception e) {
            // Fallback to plain text if parsing fails
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module MariaDB ----------
    private void writeModuleMariaDB(XWPFDocument doc, JsonNode moduleMariaDB, String heading, ExportContext context) {
        if (moduleMariaDB.isMissingNode()) return;
        addSubHeading(doc, heading);

        // Ref table
        JsonNode refTable = moduleMariaDB.path("refTable");
        if (refTable.isArray() && refTable.size() > 0) {
            addSubHeading2(doc, "B\u1ea3ng tham chi\u1ebfu MariaDB");

            int rows = refTable.size();
            XWPFTable table = doc.createTable(rows + 1, 7);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "CPU", true, "D9E2F3");
            setCell(table, 0, 3, "RAM (GB)", true, "D9E2F3");
            setCell(table, 0, 4, "CPU Load (%)", true, "D9E2F3");
            setCell(table, 0, 5, "RAM Load (%)", true, "D9E2F3");
            setCell(table, 0, 6, "Master", true, "D9E2F3");

            for (int i = 0; i < rows; i++) {
                JsonNode r = refTable.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpu"), false, null);
                setCell(table, i + 1, 3, txt(r, "ram"), false, null);
                setCell(table, i + 1, 4, txt(r, "cpuLoad"), false, null);
                setCell(table, i + 1, 5, txt(r, "ramLoad"), false, null);
                boolean isMaster = r.path("isMaster").asBoolean(false);
                setCell(table, i + 1, 6, isMaster ? "\u2713" : "", false, null);
            }
            doc.createParagraph();

            boolean hasRefEvidence = false;
            for (int i = 0; i < rows; i++) {
                JsonNode r = refTable.get(i);
                JsonNode evidenceImages = r.path("evidenceImages");
                String legacyEvidence = txt(r, "evidenceImage");
                boolean hasCurrentEvidence = evidenceImages.isArray() && evidenceImages.size() > 0;
                if (!hasCurrentEvidence && legacyEvidence.isBlank()) {
                    continue;
                }

                if (!hasRefEvidence) {
                    addSubHeading2(doc, "S\u1edf c\u1ee9 b\u1ea3ng tham chi\u1ebfu MariaDB:");
                    hasRefEvidence = true;
                }

                String ip = txt(r, "ip").trim();
                addSubHeading2(doc, ip.isEmpty() ? ("D\u00f2ng " + (i + 1)) : ("D\u00f2ng " + (i + 1) + " - " + ip));
                String detail = "D\u00f2ng " + (i + 1) + (ip.isEmpty() ? "" : (" - " + ip));
                if (hasCurrentEvidence) {
                    addInlineImages(doc, evidenceImages, buildCaption(heading + " - S\u1edf c\u1ee9 b\u1ea3ng tham chi\u1ebfu MariaDB", detail));
                } else {
                    addInlineSingleImage(doc, legacyEvidence, buildCaption(heading + " - S\u1edf c\u1ee9 b\u1ea3ng tham chi\u1ebfu MariaDB", detail));
                }
            }
        }

        // Storage
        JsonNode storage = moduleMariaDB.path("storage");
        if (!storage.isMissingNode()) {
            addSubHeading2(doc, "Storage MariaDB");
            
            // Create 4-column table for storage: /data used, /log used, Số bản lưu backup, Tỉ lệ nén (%)
            XWPFTable storageTable = doc.createTable(2, 4);
            storageTable.setWidth("100%");
            
            // Header row
            setCell(storageTable, 0, 0, "/data used (GB)", true, null);
            setCell(storageTable, 0, 1, "/log used (GB)", true, null);
            setCell(storageTable, 0, 2, "S\u1ed1 b\u1ea3n l\u01b0u backup", true, null);
            setCell(storageTable, 0, 3, "T\u1ec9 l\u1ec7 n\u00e9n (%)", true, null);
            
            // Data row
            setCell(storageTable, 1, 0, txt(storage, "dataUsed"), false, null);
            setCell(storageTable, 1, 1, txt(storage, "logUsed"), false, null);
            setCell(storageTable, 1, 2, txt(storage, "soBanBackup"), false, null);
            setCell(storageTable, 1, 3, txt(storage, "tiLeNen"), false, null);
            
            doc.createParagraph();
            
            // Evidence images for storage (multiple images)
            JsonNode storageEvidenceImages = storage.path("evidenceImages");
            if (storageEvidenceImages.isArray() && storageEvidenceImages.size() > 0) {
                addSubHeading2(doc, "S\u1edf c\u1ee9 Storage:");
                int storageImageIndex = 1;
                for (JsonNode imgNode : storageEvidenceImages) {
                    String imgData = imgNode.asText("");
                    if (!imgData.isEmpty()) {
                        addInlineSingleImage(doc, imgData, buildCaption(heading + " - S\u1edf c\u1ee9 storage MariaDB", "\u1ea2nh " + storageImageIndex));
                        storageImageIndex++;
                    }
                }
            } else {
                String storageLegacyEvidence = txt(storage, "evidenceImage");
                if (!storageLegacyEvidence.isEmpty()) {
                    addSubHeading2(doc, "S\u1edf c\u1ee9 Storage:");
                    addInlineSingleImage(doc, storageLegacyEvidence, buildCaption(heading + " - S\u1edf c\u1ee9 storage MariaDB", null));
                }
            }
        }

        // Evidence
        addInlineImages(doc, moduleMariaDB.path("evidence"), buildCaption(heading + " - S\u1edf c\u1ee9 MariaDB", null));
        addInlineImages(doc, moduleMariaDB.path("refEvidence"), buildCaption(heading + " - S\u1edf c\u1ee9 tham chi\u1ebfu MariaDB", null));

        // Note
        String note = txt(moduleMariaDB, "note");
        if (!note.isEmpty()) {
            addLabelValue(doc, "Ghi ch\u00fa:", note);
        }

        String replicationModel = txt(moduleMariaDB, "replicationModel");
        if (!replicationModel.isEmpty()) {
            String normalized = replicationModel.trim().toLowerCase();
            String displayModel;
            if ("multi-master".equals(normalized) || "active-active".equals(normalized)) {
                displayModel = "Active-Active (Multi-Master)";
            } else if ("asynchronous".equals(normalized)) {
                displayModel = "Master-Slave (Asynchronous)";
            } else {
                displayModel = replicationModel;
            }
            addLabelValue(doc, "M\u00f4 h\u00ecnh replication:", displayModel);
        }

        // CCU
        String selectedInputRow = txt(moduleMariaDB, "selectedInputRow");
        String inputCCU = txt(moduleMariaDB, "inputCCU");
        String sizingCCU = txt(moduleMariaDB, "sizingCCU");

        if (!inputCCU.isEmpty() || !sizingCCU.isEmpty()) {
            addLabelValue(doc, "CCU \u0111\u1ea7u v\u00e0o:", inputCCU);
            addLabelValue(doc, "CCU \u0111\u1ecbnh c\u1ee1:", sizingCCU);
        }

        // Result
        String resultHTML = txt(moduleMariaDB, "resultHTML");
        if (!resultHTML.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteMariaDBResult(doc, resultHTML, moduleMariaDB);
        }

        doc.createParagraph();
    }

    // Parse Module MariaDB result HTML and write to DOC with proper formatting
    private void parseAndWriteMariaDBResult(XWPFDocument doc, String html, JsonNode moduleMariaDB) {
        try {
            Pattern infoPattern = Pattern.compile("(Th\\u00f4ng tin t\\u00ednh to\\u00e1n|C\\u00f4ng th\\u1ee9c t\\u00ednh to\\u00e1n).*?</ul>", Pattern.DOTALL);
            Matcher infoMatcher = infoPattern.matcher(html);
            if (infoMatcher.find()) {
                String infoContent = infoMatcher.group(0);
                Pattern liPattern = Pattern.compile("<li>([\\s\\S]*?)</li>", Pattern.CASE_INSENSITIVE);
                Matcher liMatcher = liPattern.matcher(infoContent);
                while (liMatcher.find()) {
                    String text = stripHtml(liMatcher.group(1));
                    if (!text.isEmpty()) {
                        addNormalText(doc, "\u2022 " + text);
                    }
                }
            }

            List<String[]> resultRows = new ArrayList<>();

            String selectedProposalSource = txt(moduleMariaDB, "selectedProposalSource").trim();
            JsonNode customProposalTable = moduleMariaDB.path("customProposalTable");
            boolean useCustomProposal = "custom".equalsIgnoreCase(selectedProposalSource)
                    && customProposalTable.isArray()
                    && customProposalTable.size() > 0;

            if (useCustomProposal) {
                for (JsonNode row : customProposalTable) {
                    String component = txt(row, "component").trim();
                    String config = txt(row, "configurationText").trim();
                    String quantity = txt(row, "quantity").trim();
                    String note = txt(row, "note").trim();
                    if (component.isEmpty() || config.isEmpty()) {
                        continue;
                    }

                    String[] lines = config.split("\\r?\\n");
                    List<String> normalizedLines = new ArrayList<>();
                    for (String line : lines) {
                        String trimmed = line == null ? "" : line.trim();
                        if (!trimmed.isEmpty()) {
                            normalizedLines.add("- " + trimmed);
                        }
                    }
                    if (!normalizedLines.isEmpty()) {
                        resultRows.add(new String[]{
                                component,
                                String.join("\n", normalizedLines),
                                quantity,
                                note
                        });
                    }
                }
            }

            if (resultRows.isEmpty()) {
                String proposalTableHtml = extractTableHtmlByMarker(html, "data-mariadb-proposal-table=\"1\"");
                List<List<String>> proposalRows = extractTableRows(proposalTableHtml);
                if (!proposalRows.isEmpty()) {
                    for (List<String> row : proposalRows) {
                        if (row.size() < 4) continue;
                        resultRows.add(new String[]{
                                row.get(0),
                                row.get(1),
                                row.get(2),
                                row.get(3)
                        });
                    }
                }
            }

            if (resultRows.isEmpty()) {
                String mariaRow = extractRowByLabel(html, "MariaDB");
                String maxScaleRow = extractRowByLabel(html, "MaxScale");
                String nasRow = extractRowByLabel(html, "NAS");

                if (!mariaRow.isEmpty()) {
                    String mariaList = extractListContent(mariaRow);
                    String vcpu = firstGroup(mariaList, "(\\d+)\\s*vCPU");
                    String ram = firstGroup(mariaList, "(\\d+)\\s*GB\\s*RAM");
                    String data = firstGroup(mariaList, "/data[:\\s]*(\\d+)\\s*GB");
                    String logDisk = firstGroup(mariaList, "/log[:\\s]*(\\d+)\\s*GB");

                    StringBuilder configBuilder = new StringBuilder();
                    if (!vcpu.isEmpty()) configBuilder.append(vcpu).append(" vCPU\n");
                    if (!ram.isEmpty()) configBuilder.append(ram).append(" GB RAM\n");
                    if (!data.isEmpty()) configBuilder.append("/data: ").append(data).append(" GB\n");
                    if (!logDisk.isEmpty()) configBuilder.append("/log: ").append(logDisk).append(" GB");

                    String config = configBuilder.toString().trim();
                    if (config.isEmpty()) {
                        config = stripHtml(extractListContent(mariaRow));
                    }
                    if (!config.isEmpty()) {
                        resultRows.add(new String[]{
                                "MariaDB",
                                config,
                                extractQuantity(mariaRow, "3"),
                                extractNoteCell(mariaRow)
                        });
                    }
                }

                if (!maxScaleRow.isEmpty()) {
                    String maxScaleList = extractListContent(maxScaleRow);
                    String msVcpu = firstGroup(maxScaleList, "(\\d+)\\s*vCPU");
                    String msRam = firstGroup(maxScaleList, "(\\d+)\\s*GB\\s*RAM");
                    String msDisk = firstGroup(maxScaleList, "/u01[:\\s]*(\\d+)\\s*GB");

                    StringBuilder configBuilder = new StringBuilder();
                    if (!msVcpu.isEmpty()) configBuilder.append(msVcpu).append(" vCPU\n");
                    if (!msRam.isEmpty()) configBuilder.append(msRam).append(" GB RAM\n");
                    if (!msDisk.isEmpty()) configBuilder.append("/u01: ").append(msDisk).append(" GB");

                    String config = configBuilder.toString().trim();
                    if (config.isEmpty()) {
                        config = stripHtml(maxScaleList);
                    }
                    if (!config.isEmpty()) {
                        String note = extractNoteCell(maxScaleRow);
                        if (note.isEmpty()) note = "C\u1ea5u h\u00ecnh t\u1ed1i thi\u1ec3u + 1 VIP";
                        resultRows.add(new String[]{
                                "MaxScale",
                                config,
                                extractQuantity(maxScaleRow, "2"),
                                note
                        });
                    }
                }

                if (!nasRow.isEmpty()) {
                    String nasSize = firstGroup(nasRow, "<strong>(\\d+)\\s*GB</strong>");
                    String nasConfig = !nasSize.isEmpty() ? nasSize + " GB" : stripHtml(extractListContent(nasRow));
                    if (!nasConfig.isEmpty()) {
                        String note = extractNoteCell(nasRow);
                        if (note.isEmpty()) note = "Mount chung (/backup c\u1ea7n)";
                        resultRows.add(new String[]{
                                "NAS",
                                nasConfig,
                                extractQuantity(nasRow, "-"),
                                note
                        });
                    }
                }
            }

            if (!resultRows.isEmpty()) {
                doc.createParagraph();
                addSubHeading2(doc, "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable table = doc.createTable(resultRows.size() + 1, 4);
                styleTable(table);

                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                setCell(table, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < resultRows.size(); i++) {
                    String[] row = resultRows.get(i);
                    String bgColor = "E6FFED";
                    if ("NAS".equalsIgnoreCase(row[0])) {
                        bgColor = "FFF9E6";
                    } else if ("MaxScale".equalsIgnoreCase(row[0])) {
                        bgColor = "F0F9FF";
                    }

                    setCell(table, i + 1, 0, row[0], true, bgColor);
                    setCell(table, i + 1, 1, row[1], false, bgColor);
                    setCell(table, i + 1, 2, row[2], true, bgColor);
                    setCell(table, i + 1, 3, row[3], false, bgColor);
                }
                doc.createParagraph();
            } else {
                String plainText = stripHtml(html);
                if (!plainText.isEmpty()) {
                    addNormalText(doc, plainText);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse MariaDB result HTML: {}", e.getMessage());
            // Fallback to plain text if parsing fails
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    private String extractTableHtmlByMarker(String html, String marker) {
        if (html == null || html.isBlank()) return "";
        Pattern pattern = Pattern.compile("<table[^>]*" + Pattern.quote(marker) + "[^>]*>[\\s\\S]*?</table>", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group() : "";
    }

    private String extractDivHtmlByMarker(String html, String marker) {
        if (html == null || html.isBlank()) return "";
        Pattern pattern = Pattern.compile("<div[^>]*" + Pattern.quote(marker) + "[^>]*>([\\s\\S]*?)</div>", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group(1) : "";
    }

    private List<String> extractTableHeaders(String tableHtml) {
        List<String> headers = new ArrayList<>();
        if (tableHtml == null || tableHtml.isBlank()) return headers;

        Pattern headerPattern = Pattern.compile("<thead>[\\s\\S]*?<tr[^>]*>([\\s\\S]*?)</tr>[\\s\\S]*?</thead>", Pattern.CASE_INSENSITIVE);
        Matcher headerMatcher = headerPattern.matcher(tableHtml);
        if (!headerMatcher.find()) return headers;

        Matcher thMatcher = Pattern.compile("<th[^>]*>([\\s\\S]*?)</th>", Pattern.CASE_INSENSITIVE).matcher(headerMatcher.group(1));
        while (thMatcher.find()) {
            headers.add(stripHtmlKeepLineBreaks(thMatcher.group(1)));
        }
        return headers;
    }

    private List<List<String>> extractTableRows(String tableHtml) {
        List<List<String>> rows = new ArrayList<>();
        if (tableHtml == null || tableHtml.isBlank()) return rows;

        Pattern bodyPattern = Pattern.compile("<tbody>([\\s\\S]*?)</tbody>", Pattern.CASE_INSENSITIVE);
        Matcher bodyMatcher = bodyPattern.matcher(tableHtml);
        if (!bodyMatcher.find()) return rows;

        Matcher rowMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(bodyMatcher.group(1));
        while (rowMatcher.find()) {
            Matcher cellMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(rowMatcher.group(1));
            List<String> row = new ArrayList<>();
            while (cellMatcher.find()) {
                row.add(stripHtmlKeepLineBreaks(cellMatcher.group(1)));
            }
            if (!row.isEmpty()) {
                rows.add(row);
            }
        }
        return rows;
    }

    private String extractRowByLabel(String html, String label) {
        Pattern rowPattern = Pattern.compile("<tr[^>]*>[\\s\\S]*?</tr>", Pattern.CASE_INSENSITIVE);
        Matcher rowMatcher = rowPattern.matcher(html);
        String escapedLabel = Pattern.quote(label);
        Pattern labelPattern = Pattern.compile("<td[^>]*>\\s*<strong>\\s*" + escapedLabel + "\\s*</strong>\\s*</td>", Pattern.CASE_INSENSITIVE);
        while (rowMatcher.find()) {
            String row = rowMatcher.group();
            if (labelPattern.matcher(row).find()) {
                return row;
            }
        }
        return "";
    }

    private String extractListContent(String html) {
        Matcher listMatcher = Pattern.compile("<ul[^>]*>([\\s\\S]*?)</ul>", Pattern.CASE_INSENSITIVE).matcher(html);
        if (listMatcher.find()) {
            return listMatcher.group(1);
        }
        return "";
    }

    private String extractQuantity(String rowHtml, String defaultValue) {
        Matcher quantityMatcher = Pattern.compile("<td[^>]*class=\"text-center\"[^>]*>\\s*<strong>([^<]+)</strong>\\s*</td>", Pattern.CASE_INSENSITIVE).matcher(rowHtml);
        if (quantityMatcher.find()) {
            return stripHtml(quantityMatcher.group(1));
        }

        Matcher fallbackStrongMatcher = Pattern.compile("<td[^>]*>\\s*<strong>([^<]+)</strong>\\s*</td>", Pattern.CASE_INSENSITIVE).matcher(rowHtml);
        int strongIndex = 0;
        while (fallbackStrongMatcher.find()) {
            strongIndex++;
            if (strongIndex >= 2) {
                String value = stripHtml(fallbackStrongMatcher.group(1));
                if (!value.isEmpty()) return value;
            }
        }
        return defaultValue;
    }

    private String extractNoteCell(String rowHtml) {
        Matcher cellMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(rowHtml);
        List<String> cells = new ArrayList<>();
        while (cellMatcher.find()) {
            cells.add(cellMatcher.group(1));
        }
        if (cells.size() >= 4) {
            return stripHtml(cells.get(3));
        }
        return "";
    }

    private String firstGroup(String input, String regex) {
        if (input == null || input.isBlank()) return "";
        Matcher matcher = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(input);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return "";
    }

    private String stripHtml(String html) {
        if (html == null || html.isBlank()) return "";
        String plain = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return decodeHtmlEntities(plain);
    }

    private String stripHtmlKeepLineBreaks(String html) {
        if (html == null || html.isBlank()) return "";
        String withBreaks = html
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</li>", "\n")
                .replaceAll("(?i)</p>", "\n");

        String noTags = withBreaks.replaceAll("<[^>]+>", " ");
        noTags = decodeHtmlEntities(noTags);

        String[] rawLines = noTags.split("\\R+");
        List<String> lines = new ArrayList<>();
        for (String raw : rawLines) {
            String cleaned = raw.replaceAll("\\s+", " ").trim();
            if (!cleaned.isEmpty()) {
                lines.add(cleaned);
            }
        }
        return String.join("\n", lines);
    }

    private String decodeHtmlEntities(String text) {
        if (text == null || text.isBlank()) return "";
        return text
                .replace("&nbsp;", " ")
                .replace("&gt;", ">")
                .replace("&lt;", "<")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&times;", "×")
                .replace("&approx;", "≈");
    }

    // ---------- Module Redis ----------
    private void writeModuleRedis(XWPFDocument doc, JsonNode moduleRedis, String heading, ExportContext context) {
        if (moduleRedis.isMissingNode()) return;
        addSubHeading(doc, heading);

        String selectedMethod = txt(moduleRedis, "selectedMethod");
        if (!selectedMethod.isEmpty()) {
            addLabelValue(doc, "Ph\u01b0\u01a1ng ph\u00e1p t\u00ednh:",
                    selectedMethod.equals("key") ? "T\u00ednh theo Key" : "T\u00ednh theo c\u1ea5u h\u00ecnh hi\u1ec7n c\u00f3");
        }

        // Only export the selected method
        if ("key".equals(selectedMethod)) {
            // Key method
            JsonNode keyMethod = moduleRedis.path("keyMethod");
            if (!keyMethod.isMissingNode()) {
                String keyCount = txt(keyMethod, "keyCount");
                String recordSize = txt(keyMethod, "recordSize");
                String importance = txt(keyMethod, "importance");
                if (!keyCount.isEmpty() || !recordSize.isEmpty()) {
                    addSubHeading2(doc, "Ph\u01b0\u01a1ng ph\u00e1p t\u00ednh theo Key");
                    addLabelValue(doc, "T\u1ed5ng l\u01b0\u1ee3ng Key d\u1ef1 ki\u1ebfn:", keyCount);
                    addLabelValue(doc, "K\u00edch th\u01b0\u1edbc trung b\u00ecnh 1 b\u1ea3n ghi (KB):", recordSize);
                    if (!importance.isEmpty()) addLabelValue(doc, "M\u1ee9c \u0111\u1ed9 quan tr\u1ecdng:", importance);
                    addInlineImages(doc, keyMethod.path("evidenceImages"), buildCaption(heading + " - S\u1edf c\u1ee9 ph\u01b0\u01a1ng ph\u00e1p Key", null));

                    String resultHTML = txt(keyMethod, "resultHTML");
                    if (!resultHTML.isEmpty()) {
                        addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
                        parseAndWriteRedisResult(doc, resultHTML, keyMethod);
                    }
                }
            }
        } else if ("config".equals(selectedMethod)) {
            // Config method
            JsonNode configMethod = moduleRedis.path("configMethod");
            if (!configMethod.isMissingNode()) {
                JsonNode configTable = configMethod.path("configTable");
                if (configTable.isArray() && configTable.size() > 0) {
                    addSubHeading2(doc, "Ph\u01b0\u01a1ng ph\u00e1p t\u00ednh theo c\u1ea5u h\u00ecnh hi\u1ec7n c\u00f3");

                    String currentModel = txt(configMethod, "currentModel");
                    if (!currentModel.isEmpty()) addLabelValue(doc, "Model hi\u1ec7n t\u1ea1i:", currentModel);

                    int rows = configTable.size();
                    XWPFTable table = doc.createTable(rows + 1, 5);
                    styleTable(table);

                    setCell(table, 0, 0, "STT", true, "D9E2F3");
                    setCell(table, 0, 1, "IP", true, "D9E2F3");
                    setCell(table, 0, 2, "RAM (GB)", true, "D9E2F3");
                    setCell(table, 0, 3, "RAM Load (%)", true, "D9E2F3");
                    setCell(table, 0, 4, "Master", true, "D9E2F3");

                    for (int i = 0; i < rows; i++) {
                        JsonNode r = configTable.get(i);
                        setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                        setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                        setCell(table, i + 1, 2, txt(r, "ram"), false, null);
                        setCell(table, i + 1, 3, txt(r, "ramLoad"), false, null);
                        boolean isMaster = r.path("isMaster").asBoolean(false);
                        setCell(table, i + 1, 4, isMaster ? "\u2713" : "", false, null);
                    }
                    doc.createParagraph();
                }

                String configImportance = txt(configMethod, "importance");
                if (!configImportance.isEmpty()) addLabelValue(doc, "M\u1ee9c \u0111\u1ed9 quan tr\u1ecdng:", configImportance);

                String inputCCU = txt(configMethod, "inputCCU");
                String sizingCCU = txt(configMethod, "sizingCCU");
                if (!inputCCU.isEmpty() || !sizingCCU.isEmpty()) {
                    addLabelValue(doc, "CCU \u0111\u1ea7u v\u00e0o:", inputCCU);
                    addLabelValue(doc, "CCU \u0111\u1ecbnh c\u1ee1:", sizingCCU);
                }

                String resultHTML = txt(configMethod, "resultHTML");
                if (!resultHTML.isEmpty()) {
                    addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
                    parseAndWriteRedisResult(doc, resultHTML, configMethod);
                }
            }
        }

        doc.createParagraph();
    }

    // Parse Redis result HTML and write to DOC with proper formatting
    private void parseAndWriteRedisResult(XWPFDocument doc, String html, JsonNode methodNode) {
        try {
            Pattern infoPattern = Pattern.compile("Th\u00f4ng tin t\u00ednh to\u00e1n[\\s\\S]*?<ul[^>]*>([\\s\\S]*?)</ul>", Pattern.CASE_INSENSITIVE);
            Matcher infoMatcher = infoPattern.matcher(html);
            if (infoMatcher.find()) {
                addSubHeading2(doc, "Th\u00f4ng tin t\u00ednh to\u00e1n");
                Matcher liMatcher = Pattern.compile("<li[^>]*>([\\s\\S]*?)</li>", Pattern.CASE_INSENSITIVE).matcher(infoMatcher.group(1));
                while (liMatcher.find()) {
                    String text = stripHtml(liMatcher.group(1));
                    if (!text.isEmpty()) {
                        addNormalText(doc, "\u2022 " + text);
                    }
                }
            }

            Pattern modelPattern = Pattern.compile("\u0110\u1ec1 xu\u1ea5t m\u00f4 h\u00ecnh[\\s\\S]*?<p[^>]*>([\\s\\S]*?)</p>", Pattern.CASE_INSENSITIVE);
            Matcher modelMatcher = modelPattern.matcher(html);
            if (modelMatcher.find()) {
                String modelText = stripHtml(modelMatcher.group(1));
                if (!modelText.isEmpty()) {
                    doc.createParagraph();
                    addNormalText(doc, "\u0110\u1ec1 xu\u1ea5t m\u00f4 h\u00ecnh: " + modelText);
                }
            }

            Pattern formulaPattern = Pattern.compile("C\u00f4ng th\u1ee9c t\u00ednh to\u00e1n[\\s\\S]*?<ul[^>]*>([\\s\\S]*?)</ul>", Pattern.CASE_INSENSITIVE);
            Matcher formulaMatcher = formulaPattern.matcher(html);
            if (formulaMatcher.find()) {
                addSubHeading2(doc, "C\u00f4ng th\u1ee9c t\u00ednh to\u00e1n");
                Matcher liMatcher = Pattern.compile("<li[^>]*>([\\s\\S]*?)</li>", Pattern.CASE_INSENSITIVE).matcher(formulaMatcher.group(1));
                while (liMatcher.find()) {
                    String text = stripHtml(liMatcher.group(1));
                    if (!text.isEmpty()) {
                        addNormalText(doc, "\u2022 " + text);
                    }
                }
                doc.createParagraph();
            }

            List<String[]> proposalResultRows = new ArrayList<>();

            if (methodNode != null && !methodNode.isMissingNode()) {
                String selectedProposalSource = txt(methodNode, "selectedProposalSource").trim();
                JsonNode customProposalTable = methodNode.path("customProposalTable");
                if ("custom".equalsIgnoreCase(selectedProposalSource)) {
                    if (customProposalTable.isArray() && customProposalTable.size() > 0) {
                        for (JsonNode row : customProposalTable) {
                            String customConfigurationText = txt(row, "configurationText").trim();
                            if (customConfigurationText.isEmpty()) {
                                continue;
                            }
                            String[] lines = customConfigurationText.split("\\r?\\n");
                            List<String> normalizedLines = new ArrayList<>();
                            for (String line : lines) {
                                String trimmed = line == null ? "" : line.trim();
                                if (!trimmed.isEmpty()) {
                                    normalizedLines.add("- " + trimmed);
                                }
                            }
                            if (!normalizedLines.isEmpty()) {
                                proposalResultRows.add(new String[]{
                                        txt(row, "component").trim().isEmpty() ? "Redis" : txt(row, "component").trim(),
                                        String.join("\n", normalizedLines),
                                        txt(row, "quantity").trim(),
                                        txt(row, "note").trim()
                                });
                            }
                        }
                    } else {
                        String customConfigurationText = txt(customProposalTable, "configurationText").trim();
                        if (!customConfigurationText.isEmpty()) {
                            String[] lines = customConfigurationText.split("\\r?\\n");
                            List<String> normalizedLines = new ArrayList<>();
                            for (String line : lines) {
                                String trimmed = line == null ? "" : line.trim();
                                if (!trimmed.isEmpty()) {
                                    normalizedLines.add("- " + trimmed);
                                }
                            }
                            if (!normalizedLines.isEmpty()) {
                                proposalResultRows.add(new String[]{
                                        txt(customProposalTable, "component").trim().isEmpty() ? "Redis" : txt(customProposalTable, "component").trim(),
                                        String.join("\n", normalizedLines),
                                        txt(customProposalTable, "quantity").trim(),
                                        txt(customProposalTable, "note").trim()
                                });
                            }
                        }
                    }
                }
            }

            if (proposalResultRows.isEmpty()) {
                String proposalTableHtml = extractTableHtmlByMarker(html, "data-redis-proposal-table=\"1\"");
                List<List<String>> proposalRows = extractTableRows(proposalTableHtml);

                if (proposalRows.isEmpty()) {
                    Pattern resultTablePattern = Pattern.compile(
                            "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                            Pattern.CASE_INSENSITIVE
                    );
                    Matcher resultTableMatcher = resultTablePattern.matcher(html);
                    if (resultTableMatcher.find()) {
                        String tbody = resultTableMatcher.group(1);
                        Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                        if (trMatcher.find()) {
                            String rowHtml = trMatcher.group(1);
                            Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(rowHtml);
                            List<String> cols = new ArrayList<>();
                            while (tdMatcher.find()) {
                                cols.add(tdMatcher.group(1));
                            }
                            if (cols.size() >= 4) {
                                proposalRows.add(Arrays.asList(
                                        stripHtml(cols.get(0)),
                                        stripHtmlKeepLineBreaks(cols.get(1)),
                                        stripHtml(cols.get(2)),
                                        stripHtml(cols.get(3))
                                ));
                            }
                        }
                    }
                }

                if (!proposalRows.isEmpty()) {
                    for (List<String> proposalRow : proposalRows) {
                        if (proposalRow.size() >= 4) {
                            proposalResultRows.add(new String[]{
                                    proposalRow.get(0),
                                    proposalRow.get(1),
                                    proposalRow.get(2),
                                    proposalRow.get(3)
                            });
                        }
                    }
                }
            }

            if (!proposalResultRows.isEmpty()) {
                addSubHeading2(doc, "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable table = doc.createTable(proposalResultRows.size() + 1, 4);
                styleTable(table);

                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "C\u1ea5u h\u00ecnh \u0111\u1ec1 xu\u1ea5t", true, "D9E2F3");
                setCell(table, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < proposalResultRows.size(); i++) {
                    String[] proposalRow = proposalResultRows.get(i);
                    setCell(table, i + 1, 0, proposalRow[0].isEmpty() ? "Redis" : proposalRow[0], true, "E6FFED");
                    setCell(table, i + 1, 1, proposalRow[1], false, "E6FFED");
                    setCell(table, i + 1, 2, proposalRow[2], true, "E6FFED");
                    setCell(table, i + 1, 3, proposalRow[3], false, "E6FFED");
                }
                doc.createParagraph();
            }
        } catch (Exception e) {
            // Fallback to plain text if parsing fails
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module Kafka ----------
    private void writeModuleKafka(XWPFDocument doc, JsonNode moduleKafka, String heading, ExportContext context) {
        if (moduleKafka.isMissingNode()) return;
        addSubHeading(doc, heading);

        String selectedMethod = txt(moduleKafka, "selectedMethod");
        if (!selectedMethod.isEmpty()) {
            addLabelValue(doc, "Ph\u01b0\u01a1ng ph\u00e1p t\u00ednh:",
                    selectedMethod.equals("throughput") ? "Throughput" : "Linear (Ph\u01b0\u01a1ng \u00e1n B)");
        }

        // Only export the selected method
        if ("throughput".equals(selectedMethod)) {
            // Throughput method
            JsonNode throughputMethod = moduleKafka.path("throughputMethod");
            if (!throughputMethod.isMissingNode()) {
                String throughputA = txt(throughputMethod, "throughputA");
                if (!throughputA.isEmpty()) {
                    addSubHeading2(doc, "Ph\u01b0\u01a1ng ph\u00e1p Throughput");
                    addLabelValue(doc, "Throughput A:", throughputA);
                    addLabelValue(doc, "Retention Time (h):", txt(throughputMethod, "retentionTime"));
                    addLabelValue(doc, "Replication Factor:", txt(throughputMethod, "replicationFactor"));
                    addLabelValue(doc, "Compression:", txt(throughputMethod, "compression"));
                    addInlineImages(doc, throughputMethod.path("throughputEvidence"), buildCaption(heading + " - S\u1edf c\u1ee9 throughput Kafka", null));
                    addInlineImages(doc, throughputMethod.path("compressionEvidence"), buildCaption(heading + " - S\u1edf c\u1ee9 compression Kafka", null));

                    String resultHTML = txt(throughputMethod, "resultHTML");
                    if (!resultHTML.isEmpty()) {
                        addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
                        parseAndWriteKafkaResult(doc, resultHTML, throughputMethod);
                    }
                }
            }
        } else if ("linear".equals(selectedMethod)) {
            // Linear method
            JsonNode linearMethod = moduleKafka.path("linearMethod");
            if (!linearMethod.isMissingNode()) {
                JsonNode linearTable = linearMethod.path("linearTable");
                if (linearTable.isArray() && linearTable.size() > 0) {
                    addSubHeading2(doc, "Ph\u01b0\u01a1ng ph\u00e1p Linear (Ph\u01b0\u01a1ng \u00e1n B)");

                    int rows = linearTable.size();
                    XWPFTable table = doc.createTable(rows + 1, 8);
                    styleTable(table);

                    setCell(table, 0, 0, "STT", true, "D9E2F3");
                    setCell(table, 0, 1, "IP", true, "D9E2F3");
                    setCell(table, 0, 2, "vCPU", true, "D9E2F3");
                    setCell(table, 0, 3, "RAM (GB)", true, "D9E2F3");
                    setCell(table, 0, 4, "Disk (GB)", true, "D9E2F3");
                    setCell(table, 0, 5, "CPU Load (%)", true, "D9E2F3");
                    setCell(table, 0, 6, "RAM Load (%)", true, "D9E2F3");
                    setCell(table, 0, 7, "Disk Load (%)", true, "D9E2F3");

                    for (int i = 0; i < rows; i++) {
                        JsonNode r = linearTable.get(i);
                        setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                        setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                        setCell(table, i + 1, 2, txt(r, "vcpu"), false, null);
                        setCell(table, i + 1, 3, txt(r, "ram"), false, null);
                        setCell(table, i + 1, 4, txt(r, "disk"), false, null);
                        setCell(table, i + 1, 5, txt(r, "cpuLoad"), false, null);
                        setCell(table, i + 1, 6, txt(r, "ramLoad"), false, null);
                        setCell(table, i + 1, 7, txt(r, "diskLoad"), false, null);
                    }
                    doc.createParagraph();
                }

                String inputCCU = txt(linearMethod, "inputCCU");
                String sizingCCU = txt(linearMethod, "sizingCCU");
                if (!inputCCU.isEmpty() || !sizingCCU.isEmpty()) {
                    addLabelValue(doc, "CCU \u0111\u1ea7u v\u00e0o:", inputCCU);
                    addLabelValue(doc, "CCU \u0111\u1ecbnh c\u1ee1:", sizingCCU);
                }

                String resultHTML = txt(linearMethod, "resultHTML");
                if (!resultHTML.isEmpty()) {
                    addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
                    parseAndWriteKafkaResult(doc, resultHTML, linearMethod);
                }
            }
        }

        doc.createParagraph();
    }

    // Parse Kafka result HTML and write to DOC with proper formatting
    private void parseAndWriteKafkaResult(XWPFDocument doc, String html, JsonNode methodNode) {
        try {
            Pattern infoPattern = Pattern.compile("(Th\u00f4ng tin \u0111\u1ea7u v\u00e0o|Th\u00f4ng tin t\u00ednh to\u00e1n)[\\s\\S]*?<ul[^>]*>([\\s\\S]*?)</ul>", Pattern.CASE_INSENSITIVE);
            Matcher infoMatcher = infoPattern.matcher(html);
            if (infoMatcher.find()) {
                addSubHeading2(doc, stripHtml(infoMatcher.group(1)));
                Matcher liMatcher = Pattern.compile("<li[^>]*>([\\s\\S]*?)</li>", Pattern.CASE_INSENSITIVE).matcher(infoMatcher.group(2));
                while (liMatcher.find()) {
                    String text = stripHtml(liMatcher.group(1));
                    if (!text.isEmpty()) {
                        addNormalText(doc, "\u2022 " + text);
                    }
                }
                doc.createParagraph();
            }

            Pattern resourceNeedPattern = Pattern.compile("T\u00e0i nguy\u00ean c\u1ea7n cho h\u1ec7 th\u1ed1ng m\u1edbi[\\s\\S]*?<ul[^>]*>([\\s\\S]*?)</ul>", Pattern.CASE_INSENSITIVE);
            Matcher resourceNeedMatcher = resourceNeedPattern.matcher(html);
            if (resourceNeedMatcher.find()) {
                addSubHeading2(doc, "T\u00e0i nguy\u00ean c\u1ea7n cho h\u1ec7 th\u1ed1ng m\u1edbi");
                Matcher liMatcher = Pattern.compile("<li[^>]*>([\\s\\S]*?)</li>", Pattern.CASE_INSENSITIVE).matcher(resourceNeedMatcher.group(1));
                while (liMatcher.find()) {
                    String text = stripHtml(liMatcher.group(1));
                    if (!text.isEmpty()) {
                        addNormalText(doc, "\u2022 " + text);
                    }
                }
                doc.createParagraph();
            }

            Pattern diskPattern = Pattern.compile("T\u1ed5ng\\s*Disk\\s*Cluster[\\s\\S]*?<p[^>]*>([\\s\\S]*?)</p>", Pattern.CASE_INSENSITIVE);
            Matcher diskMatcher = diskPattern.matcher(html);
            if (diskMatcher.find()) {
                addSubHeading2(doc, "T\u1ed5ng Disk Cluster");
                String diskText = stripHtmlKeepLineBreaks(diskMatcher.group(1));
                if (!diskText.isEmpty()) {
                    for (String line : diskText.split("\\n")) {
                        if (!line.isBlank()) addNormalText(doc, line.trim());
                    }
                }
                doc.createParagraph();
            }

            Pattern distributionPattern = Pattern.compile(
                    "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng Broker \\(N\\)[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher distributionMatcher = distributionPattern.matcher(html);
            if (distributionMatcher.find()) {
                String tbody = distributionMatcher.group(1);
                Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                List<List<String>> rows = new ArrayList<>();
                while (trMatcher.find()) {
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(trMatcher.group(1));
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(stripHtml(tdMatcher.group(1)));
                    }
                    if (cols.size() >= 5) {
                        rows.add(cols);
                    }
                }

                if (!rows.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng Broker (N)");
                    XWPFTable table = doc.createTable(rows.size() + 1, 5);
                    styleTable(table);

                    String col2Header = "CPU/Node";
                    String col3Header = "Disk/Node";
                    if (!rows.get(0).isEmpty() && rows.get(0).size() >= 4) {
                        String sampleValue = rows.get(0).get(1).toUpperCase();
                        if (sampleValue.contains("GB") || sampleValue.contains("TB")) {
                            col2Header = "Disk/Server";
                            col3Header = "vCPU/Server";
                        }
                    }

                    setCell(table, 0, 0, "N (Broker)", true, "D9E2F3");
                    setCell(table, 0, 1, col2Header, true, "D9E2F3");
                    setCell(table, 0, 2, "RAM/Node", true, "D9E2F3");
                    setCell(table, 0, 3, col3Header, true, "D9E2F3");
                    setCell(table, 0, 4, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < rows.size(); i++) {
                        List<String> row = rows.get(i);
                        for (int c = 0; c < 5; c++) {
                            setCell(table, i + 1, c, row.get(c), false, "E6FFED");
                        }
                    }
                    doc.createParagraph();
                }
            }

            List<List<String>> proposalRows = new ArrayList<>();
            String selectedProposalSource = txt(methodNode, "selectedProposalSource").trim();
            JsonNode customProposalTable = methodNode.path("customProposalTable");
            if ("custom".equalsIgnoreCase(selectedProposalSource) && customProposalTable.isArray() && customProposalTable.size() > 0) {
                for (JsonNode row : customProposalTable) {
                    String component = txt(row, "component").trim();
                    String quantity = txt(row, "quantity").trim();
                    String vcpu = txt(row, "vcpu").trim();
                    String ram = txt(row, "ram").trim();
                    String disk = txt(row, "disk").trim();
                    if (component.isEmpty() || quantity.isEmpty() || vcpu.isEmpty() || ram.isEmpty() || disk.isEmpty()) {
                        continue;
                    }
                    proposalRows.add(Arrays.asList(component, quantity, vcpu, ram, disk));
                }
            }

            if (proposalRows.isEmpty()) {
                String proposalTableHtml = extractTableHtmlByMarker(html, "data-kafka-proposal-table=\"1\"");
                proposalRows = extractTableRows(proposalTableHtml);
            }

            if (proposalRows.isEmpty()) {
                Pattern resultTablePattern = Pattern.compile(
                        "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                        Pattern.CASE_INSENSITIVE
                );
                Matcher resultTableMatcher = resultTablePattern.matcher(html);
                if (resultTableMatcher.find()) {
                    String tbody = resultTableMatcher.group(1);
                    Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                    while (trMatcher.find()) {
                        Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(trMatcher.group(1));
                        List<String> cols = new ArrayList<>();
                        while (tdMatcher.find()) {
                            cols.add(stripHtml(tdMatcher.group(1)));
                        }
                        if (cols.size() >= 5) {
                            proposalRows.add(cols);
                        }
                    }
                }
            }

            if (!proposalRows.isEmpty()) {
                addSubHeading2(doc, "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable table = doc.createTable(proposalRows.size() + 1, 5);
                styleTable(table);

                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "S\u1ed1 l\u01b0\u1ee3ng Node", true, "D9E2F3");
                setCell(table, 0, 2, "vCPU/Node", true, "D9E2F3");
                setCell(table, 0, 3, "RAM/Node", true, "D9E2F3");
                setCell(table, 0, 4, "Disk/Node", true, "D9E2F3");

                for (int i = 0; i < proposalRows.size(); i++) {
                    List<String> row = proposalRows.get(i);
                    if (row.size() < 5) continue;
                    String rowColor = row.get(0).toLowerCase().contains("zookeeper") ? "FFF9E6" : "E6FFED";
                    for (int c = 0; c < 5; c++) {
                        setCell(table, i + 1, c, row.get(c), false, rowColor);
                    }
                }
                doc.createParagraph();
            }

            Pattern recPattern = Pattern.compile("Khuy\u1ebfn ngh\u1ecb[\\s\\S]*?<p[^>]*>([\\s\\S]*?)</p>", Pattern.CASE_INSENSITIVE);
            Matcher recMatcher = recPattern.matcher(html);
            if (recMatcher.find()) {
                String recommendation = stripHtml(recMatcher.group(1));
                if (!recommendation.isEmpty()) {
                    addNormalText(doc, "Khuy\u1ebfn ngh\u1ecb: " + recommendation);
                }
            }
        } catch (Exception e) {
            // Fallback to plain text if parsing fails
            String plainText = stripHtml(html);
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module K8S ----------
    private void writeModuleK8S(XWPFDocument doc, JsonNode moduleK8S, String heading, ExportContext context) {
        if (moduleK8S.isMissingNode()) return;
        addSubHeading(doc, heading);

        // Baseline table
        JsonNode baselineTable = moduleK8S.path("baselineTable");
        if (baselineTable.isArray() && baselineTable.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin h\u1ec7 th\u1ed1ng tham chi\u1ebfu");

            int rows = baselineTable.size();
            XWPFTable table = doc.createTable(rows + 2, 7);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "Số lượng", true, "D9E2F3");
            setCell(table, 0, 3, "CPU", true, "D9E2F3");
            setCell(table, 0, 4, "RAM\n(GB)", true, "D9E2F3");
            setCell(table, 0, 5, "DISK\n(GB)", true, "D9E2F3");
            setCell(table, 0, 6, "Cint_rate_2017", true, "D9E2F3");

            double totalRam = 0, totalDisk = 0, totalCint = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = baselineTable.get(i);
                double qty = toDouble(r, "quantity");
                String qtyText = txt(r, "quantity");
                if (qty <= 0) {
                    qty = 1;
                    if (qtyText.isBlank()) qtyText = "1";
                }
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, qtyText, false, null);
                setCell(table, i + 1, 3, txt(r, "cpu"), false, null);
                setCell(table, i + 1, 4, txt(r, "ram"), false, null);
                setCell(table, i + 1, 5, txt(r, "disk"), false, null);
                setCell(table, i + 1, 6, txt(r, "cintRate"), false, null);
                totalRam += toDouble(r, "ram") * qty;
                totalDisk += toDouble(r, "disk") * qty;
                totalCint += toDouble(r, "cintRate") * qty;
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, "", true, "E2EFDA");
            setCell(table, rows + 1, 4, formatNum(totalRam), true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalDisk), true, "E2EFDA");
            setCell(table, rows + 1, 6, formatNum(totalCint), true, "E2EFDA");
            doc.createParagraph();

            boolean hasBaselineEvidence = false;
            for (int i = 0; i < rows; i++) {
                JsonNode row = baselineTable.get(i);
                JsonNode evidenceImages = row.path("evidenceImages");
                String evidenceImage = txt(row, "evidenceImage");
                boolean hasCurrentEvidence = evidenceImages.isArray() && evidenceImages.size() > 0;
                if (!hasCurrentEvidence && evidenceImage.isBlank()) {
                    continue;
                }

                if (!hasBaselineEvidence) {
                    addSubHeading2(doc, "Sở cứ hệ thống tham chiếu:");
                    hasBaselineEvidence = true;
                }

                String ip = txt(row, "ip").trim();
                addSubHeading2(doc, ip.isEmpty() ? ("Dòng " + (i + 1)) : ("Dòng " + (i + 1) + " - " + ip));
                String detail = "Dòng " + (i + 1) + (ip.isEmpty() ? "" : (" - " + ip));
                if (hasCurrentEvidence) {
                    addInlineImages(doc, evidenceImages, buildCaption(heading + " - Sở cứ hệ thống tham chiếu", detail));
                } else {
                    addInlineSingleImage(doc, evidenceImage, buildCaption(heading + " - Sở cứ hệ thống tham chiếu", detail));
                }
            }
        }

        // Input config table
        JsonNode inputConfig = moduleK8S.path("inputConfigTable");
        if (inputConfig.isArray() && inputConfig.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o");

            int rows = inputConfig.size();
            XWPFTable table = doc.createTable(rows + 2, 6);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "T\u1ea3i CPU 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 3, "T\u1ea3i RAM 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 4, "Cint_rate used\n(Cint)", true, "D9E2F3");
            setCell(table, 0, 5, "RAM used\n(GB)", true, "D9E2F3");

            double totalCintUsed = 0, totalRamUsed = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = inputConfig.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpuLoad"), false, null);
                setCell(table, i + 1, 3, txt(r, "ramLoad"), false, null);
                setCell(table, i + 1, 4, txt(r, "cintUsed"), false, null);
                setCell(table, i + 1, 5, txt(r, "ramUsed"), false, null);
                totalCintUsed += toDouble(r, "cintUsed");
                totalRamUsed += toDouble(r, "ramUsed");
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, "", true, "E2EFDA");
            setCell(table, rows + 1, 4, formatNum(totalCintUsed), true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalRamUsed), true, "E2EFDA");
            doc.createParagraph();

            boolean hasInputEvidence = false;
            for (int i = 0; i < rows; i++) {
                JsonNode row = inputConfig.get(i);
                JsonNode evidenceImages = row.path("evidenceImages");
                String evidenceImage = txt(row, "evidenceImage");
                boolean hasCurrentEvidence = evidenceImages.isArray() && evidenceImages.size() > 0;
                if (!hasCurrentEvidence && evidenceImage.isBlank()) {
                    continue;
                }

                if (!hasInputEvidence) {
                    addSubHeading2(doc, "Sở cứ thông tin tải đầu vào:");
                    hasInputEvidence = true;
                }

                String ip = txt(row, "ip").trim();
                addSubHeading2(doc, ip.isEmpty() ? ("Dòng " + (i + 1)) : ("Dòng " + (i + 1) + " - " + ip));
                String detail = "Dòng " + (i + 1) + (ip.isEmpty() ? "" : (" - " + ip));
                if (hasCurrentEvidence) {
                    addInlineImages(doc, evidenceImages, buildCaption(heading + " - Sở cứ thông tin tải đầu vào", detail));
                } else {
                    addInlineSingleImage(doc, evidenceImage, buildCaption(heading + " - Sở cứ thông tin tải đầu vào", detail));
                }
            }
        }

        JsonNode storageInput = moduleK8S.path("storageInputTable");
        if (storageInput.isArray() && storageInput.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin l\u01b0u tr\u1eef \u0111\u1ea7u v\u00e0o");

            int rows = storageInput.size();
            XWPFTable table = doc.createTable(rows + 1, 5);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "Ph\u00e2n v\u00f9ng", true, "D9E2F3");
            setCell(table, 0, 3, "Used (GB)", true, "D9E2F3");
            setCell(table, 0, 4, "Ghi ch\u00fa", true, "D9E2F3");

            for (int i = 0; i < rows; i++) {
                JsonNode r = storageInput.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "partition"), false, null);
                setCell(table, i + 1, 3, txt(r, "used"), false, null);
                setCell(table, i + 1, 4, txt(r, "note"), false, null);
            }
            doc.createParagraph();
        }

        // POC / Sizing
        String pocValue = txt(moduleK8S, "pocValue");
        String sizingValue = txt(moduleK8S, "sizingValue");
        if (!pocValue.isEmpty() || !sizingValue.isEmpty()) {
            addLabelValue(doc, "T\u1ea3i h\u1ec7 th\u1ed1ng POC:", pocValue);
            addLabelValue(doc, "\u0110\u1ecbnh c\u1ee1:", sizingValue);
        }

        String flavorEval = txt(moduleK8S, "flavorEval");
        String flavorNote = txt(moduleK8S, "flavorNote");
        if (!flavorEval.isEmpty() || !flavorNote.isEmpty()) {
            addLabelValue(doc, "\u0110\u00e1nh gi\u00e1 flavor:", flavorEval);
            addLabelValue(doc, "Ghi ch\u00fa flavor:", flavorNote);
        }

        // Sizing result
        String sizingResult = txt(moduleK8S, "sizingResult");
        if (!sizingResult.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteK8SResult(doc, sizingResult, moduleK8S);
        }

        doc.createParagraph();
    }

    // Parse K8S result HTML and write to DOC
    private void parseAndWriteK8SResult(XWPFDocument doc, String html, JsonNode moduleK8S) {
        try {
            String workerTableHtml = extractTableHtmlByMarker(html, "data-k8s-worker-table=\"1\"");
            String distributionTableHtml = extractTableHtmlByMarker(html, "data-k8s-n-table=\"1\"");
            String proposalTableHtml = extractTableHtmlByMarker(html, "data-k8s-proposal-table=\"1\"");
            String recommendationHtml = extractDivHtmlByMarker(html, "data-k8s-recommendation=\"1\"");

            if (!workerTableHtml.isEmpty() || !distributionTableHtml.isEmpty() || !proposalTableHtml.isEmpty()) {
                List<List<String>> workerRows = extractTableRows(workerTableHtml);
                if (!workerRows.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n K8S Worker");
                    XWPFTable table = doc.createTable(workerRows.size() + 1, 4);
                    styleTable(table);

                    setCell(table, 0, 0, "STT", true, "D9E2F3");
                    setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                    setCell(table, 0, 2, "K8S Worker", true, "D9E2F3");
                    setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < workerRows.size(); i++) {
                        List<String> row = workerRows.get(i);
                        if (row.size() < 4) continue;
                        setCell(table, i + 1, 0, row.get(0), false, null);
                        setCell(table, i + 1, 1, row.get(1), false, null);
                        setCell(table, i + 1, 2, row.get(2), false, null);
                        setCell(table, i + 1, 3, row.get(3), false, null);
                    }
                    doc.createParagraph();
                }

                if (!recommendationHtml.isEmpty()) {
                    String recommendationText = stripHtmlKeepLineBreaks(recommendationHtml);
                    recommendationText = recommendationText.replaceFirst("(?i)^\\s*\\u0111\\u1ec1 xu\\u1ea5t\\s*:\\s*", "");
                    if (!recommendationText.isEmpty()) {
                        addNormalText(doc, recommendationText);
                        doc.createParagraph();
                    }
                }

                List<String> distributionHeaders = extractTableHeaders(distributionTableHtml);
                List<List<String>> distributionRows = extractTableRows(distributionTableHtml);
                if (!distributionHeaders.isEmpty() && !distributionRows.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng N");
                    XWPFTable table = doc.createTable(distributionRows.size() + 1, distributionHeaders.size());
                    styleTable(table);

                    for (int col = 0; col < distributionHeaders.size(); col++) {
                        setCell(table, 0, col, distributionHeaders.get(col), true, "D9E2F3");
                    }

                    for (int rowIndex = 0; rowIndex < distributionRows.size(); rowIndex++) {
                        List<String> row = distributionRows.get(rowIndex);
                        String bgColor = rowIndex == distributionRows.size() - 1 ? "E6FFED" : null;
                        for (int col = 0; col < distributionHeaders.size(); col++) {
                            String value = col < row.size() ? row.get(col) : "";
                            setCell(table, rowIndex + 1, col, value, false, bgColor);
                        }
                    }
                    doc.createParagraph();
                }

                List<List<String>> proposalRows = extractTableRows(proposalTableHtml);
                String selectedProposalSource = txt(moduleK8S, "selectedProposalSource").trim();
                JsonNode customProposalTable = moduleK8S.path("customProposalTable");
                if ("custom".equalsIgnoreCase(selectedProposalSource) && customProposalTable.isArray() && customProposalTable.size() > 0) {
                    List<List<String>> customRows = new ArrayList<>();
                    for (JsonNode row : customProposalTable) {
                        String component = txt(row, "component").trim();
                        String config = txt(row, "configurationText").trim();
                        if (component.isEmpty() || config.isEmpty()) continue;
                        String quantity = txt(row, "quantity").trim();
                        String note = txt(row, "note").trim();
                        List<String> normalizedLines = new ArrayList<>();
                        for (String line : config.split("\\r?\\n")) {
                            String trimmed = line == null ? "" : line.trim();
                            if (!trimmed.isEmpty()) normalizedLines.add("- " + trimmed);
                        }
                        if (!normalizedLines.isEmpty()) {
                            customRows.add(Arrays.asList(component, String.join("\n", normalizedLines), quantity, note));
                        }
                    }
                    if (!customRows.isEmpty()) {
                        proposalRows = customRows;
                    }
                }
                if (!proposalRows.isEmpty()) {
                    addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                    XWPFTable configTable = doc.createTable(proposalRows.size() + 1, 4);
                    styleTable(configTable);

                    setCell(configTable, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                    setCell(configTable, 0, 1, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                    setCell(configTable, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                    setCell(configTable, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < proposalRows.size(); i++) {
                        List<String> row = proposalRows.get(i);
                        if (row.size() < 4) continue;
                        String bgColor = "K8S Worker".equals(row.get(0)) ? "E6FFED" : null;
                        setCell(configTable, i + 1, 0, row.get(0), true, bgColor);
                        setCell(configTable, i + 1, 1, row.get(1), false, bgColor);
                        setCell(configTable, i + 1, 2, row.get(2), true, bgColor);
                        setCell(configTable, i + 1, 3, row.get(3), false, bgColor);
                    }
                    doc.createParagraph();
                }
                return;
            }

            Pattern workerTablePattern = Pattern.compile(
                    "B\u1ea3ng t\u00ednh to\u00e1n K8S Worker[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher workerTableMatcher = workerTablePattern.matcher(html);
            if (workerTableMatcher.find()) {
                String tbody = workerTableMatcher.group(1);
                Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                List<String[]> tableData = new ArrayList<>();

                while (trMatcher.find()) {
                    String tr = trMatcher.group(1);
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(tr);
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(tdMatcher.group(1));
                    }
                    if (cols.size() >= 4) {
                        String stt = stripHtml(cols.get(0));
                        if (stt.matches("\\d+")) {
                            tableData.add(new String[]{
                                    stt,
                                    stripHtml(cols.get(1)),
                                    stripHtml(cols.get(2)),
                                    stripHtmlKeepLineBreaks(cols.get(3))
                            });
                        }
                    }
                }

                if (!tableData.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n K8S Worker");
                    XWPFTable table = doc.createTable(tableData.size() + 1, 4);
                    styleTable(table);

                    setCell(table, 0, 0, "STT", true, "D9E2F3");
                    setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                    setCell(table, 0, 2, "K8S Worker", true, "D9E2F3");
                    setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < tableData.size(); i++) {
                        String[] row = tableData.get(i);
                        setCell(table, i + 1, 0, row[0], false, null);
                        setCell(table, i + 1, 1, row[1], false, null);
                        setCell(table, i + 1, 2, row[2], false, null);
                        setCell(table, i + 1, 3, row[3], false, null);
                    }
                    doc.createParagraph();
                }
            }

            Pattern recommendationPattern = Pattern.compile("<strong>\\s*\u0110\u1ec1 xu\u1ea5t:\\s*</strong>(.*?)</div>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
            Matcher recommendationMatcher = recommendationPattern.matcher(html);
            if (recommendationMatcher.find()) {
                String recommendation = stripHtml(recommendationMatcher.group(1));
                if (!recommendation.isEmpty()) {
                    addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t");
                    addNormalText(doc, recommendation);
                    doc.createParagraph();
                }
            }

            Pattern distributionPattern = Pattern.compile(
                    "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng N[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher distributionMatcher = distributionPattern.matcher(html);
            if (distributionMatcher.find()) {
                String tbody = distributionMatcher.group(1);
                Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                List<List<String>> rows = new ArrayList<>();
                while (trMatcher.find()) {
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(trMatcher.group(1));
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(stripHtml(tdMatcher.group(1)));
                    }
                    if (cols.size() >= 4) {
                        rows.add(cols);
                    }
                }

                if (!rows.isEmpty()) {
                    addSubHeading2(doc, "B\u1ea3ng ph\u00e2n b\u1ed5 theo s\u1ed1 l\u01b0\u1ee3ng N");
                    XWPFTable table = doc.createTable(rows.size() + 1, 4);
                    styleTable(table);

                    setCell(table, 0, 0, "Gi\u00e1 tr\u1ecb N", true, "D9E2F3");
                    setCell(table, 0, 1, "Cint CPU y\u00eau c\u1ea7u", true, "D9E2F3");
                    setCell(table, 0, 2, "RAM y\u00eau c\u1ea7u", true, "D9E2F3");
                    setCell(table, 0, 3, "Disk y\u00eau c\u1ea7u", true, "D9E2F3");

                    for (int i = 0; i < rows.size(); i++) {
                        List<String> row = rows.get(i);
                        String bg = i == rows.size() - 1 ? "E6FFED" : null;
                        for (int c = 0; c < 4; c++) {
                            setCell(table, i + 1, c, row.get(c), false, bg);
                        }
                    }
                    doc.createParagraph();
                }
            }

            Pattern configPattern = Pattern.compile(
                    "\u0110\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher configMatcher = configPattern.matcher(html);
            if (configMatcher.find()) {
                String tbody = configMatcher.group(1);
                Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                List<String[]> components = new ArrayList<>();

                while (trMatcher.find()) {
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(trMatcher.group(1));
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(tdMatcher.group(1));
                    }
                    if (cols.size() >= 4) {
                        String name = stripHtml(cols.get(0));
                        String config = stripHtmlKeepLineBreaks(cols.get(1));
                        String qty = stripHtml(cols.get(2));
                        String note = stripHtmlKeepLineBreaks(cols.get(3));
                        components.add(new String[]{name, config, qty, note});
                    }
                }

                String selectedProposalSource = txt(moduleK8S, "selectedProposalSource").trim();
                JsonNode customProposalTable = moduleK8S.path("customProposalTable");
                if ("custom".equalsIgnoreCase(selectedProposalSource) && customProposalTable.isArray() && customProposalTable.size() > 0) {
                    components.clear();
                    for (JsonNode row : customProposalTable) {
                        String component = txt(row, "component").trim();
                        String config = txt(row, "configurationText").trim();
                        if (component.isEmpty() || config.isEmpty()) continue;
                        String quantity = txt(row, "quantity").trim();
                        String note = txt(row, "note").trim();
                        List<String> normalizedLines = new ArrayList<>();
                        for (String line : config.split("\\r?\\n")) {
                            String trimmed = line == null ? "" : line.trim();
                            if (!trimmed.isEmpty()) normalizedLines.add("- " + trimmed);
                        }
                        if (!normalizedLines.isEmpty()) {
                            components.add(new String[]{component, String.join("\n", normalizedLines), quantity, note});
                        }
                    }
                }

                if (!components.isEmpty()) {
                    addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                    XWPFTable configTable = doc.createTable(components.size() + 1, 4);
                    styleTable(configTable);

                    setCell(configTable, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                    setCell(configTable, 0, 1, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                    setCell(configTable, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                    setCell(configTable, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                    for (int i = 0; i < components.size(); i++) {
                        String[] comp = components.get(i);
                        String bgColor = comp[0].equals("K8S Worker") ? "E6FFED" : null;
                        setCell(configTable, i + 1, 0, comp[0], true, bgColor);
                        setCell(configTable, i + 1, 1, comp[1], false, bgColor);
                        setCell(configTable, i + 1, 2, comp[2], true, bgColor);
                        setCell(configTable, i + 1, 3, comp[3], false, bgColor);
                    }
                    doc.createParagraph();
                }
            }
        } catch (Exception e) {
            String plainText = stripHtml(html);
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module LB/FW ----------
    private void writeModuleLBFW(XWPFDocument doc, JsonNode moduleLBFW, String heading, ExportContext context) {
        if (moduleLBFW.isMissingNode()) return;
        String selectedMethod = txt(moduleLBFW, "selectedMethod");
        if ("customMethod".equals(selectedMethod)) {
            writeModuleLBFWCustomMethod(doc, moduleLBFW, heading);
            return;
        }

        JsonNode bandwidthMethod = moduleLBFW.path("bandwidthMethod");
        JsonNode exportNode = (bandwidthMethod != null && !bandwidthMethod.isMissingNode() && bandwidthMethod.size() > 0)
                ? bandwidthMethod
                : moduleLBFW;

        addSubHeading(doc, heading);

        // Evidence images
        addInlineImages(doc, exportNode.path("evidenceImages"), buildCaption(heading + " - S\u1edf c\u1ee9 LB/FW", null));

        // Peak values
        String peakUpload = txt(exportNode, "peakUpload");
        String peakDownload = txt(exportNode, "peakDownload");
        if (!peakUpload.isEmpty() || !peakDownload.isEmpty()) {
            addSubHeading2(doc, "Th\u00f4ng tin b\u0103ng th\u00f4ng");
            addLabelValue(doc, "Peak Upload (Mbps):", peakUpload);
            addLabelValue(doc, "Peak Download (Mbps):", peakDownload);
        }

        // POC / Sizing
        String pocValue = txt(exportNode, "pocValue");
        String sizingValue = txt(exportNode, "sizingValue");
        if (!pocValue.isEmpty() || !sizingValue.isEmpty()) {
            addLabelValue(doc, "T\u1ea3i h\u1ec7 th\u1ed1ng POC:", pocValue);
            addLabelValue(doc, "\u0110\u1ecbnh c\u1ee1:", sizingValue);
        }

        // Sizing result
        String sizingResult = txt(exportNode, "sizingResult");
        if (!sizingResult.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteLBFWResult(doc, sizingResult, exportNode);
        }

        doc.createParagraph();
    }

    // Parse LB/FW result HTML and write to DOC
    private void parseAndWriteLBFWResult(XWPFDocument doc, String html, JsonNode moduleLBFW) {
        try {
            // Extract bandwidth calculation table under heading "Bảng tính toán băng thông"
            Pattern bandwidthTablePattern = Pattern.compile(
                    "B\u1ea3ng t\u00ednh to\u00e1n b\u0103ng th\u00f4ng[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher bandwidthTableMatcher = bandwidthTablePattern.matcher(html);
            List<String[]> bandwidthRows = new ArrayList<>();

            if (bandwidthTableMatcher.find()) {
                String tbody = bandwidthTableMatcher.group(1);
                Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                while (trMatcher.find()) {
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(trMatcher.group(1));
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(stripHtmlKeepLineBreaks(tdMatcher.group(1)));
                    }

                    if (cols.size() >= 4) {
                        String stt = cols.get(0).trim();
                        if (stt.matches("\\d+")) {
                            bandwidthRows.add(new String[]{
                                    stt,
                                    cols.get(1),
                                    cols.get(2),
                                    cols.get(3)
                            });
                        }
                    }
                }
            }

            if (!bandwidthRows.isEmpty()) {
                addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n b\u0103ng th\u00f4ng");
                XWPFTable table = doc.createTable(bandwidthRows.size() + 1, 4);
                styleTable(table);

                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                setCell(table, 0, 2, "Gi\u00e1 tr\u1ecb (Mbps)", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < bandwidthRows.size(); i++) {
                    String[] row = bandwidthRows.get(i);
                    String bgColor = (i == bandwidthRows.size() - 1) ? "E6FFED" : null;
                    setCell(table, i + 1, 0, row[0], false, bgColor);
                    setCell(table, i + 1, 1, row[1], false, bgColor);
                    setCell(table, i + 1, 2, row[2], false, bgColor);
                    setCell(table, i + 1, 3, row[3], false, bgColor);
                }
                doc.createParagraph();
            }

            // Extract config proposal table under heading "Đề xuất cấu hình"
            String selectedProposalSource = txt(moduleLBFW, "selectedProposalSource").trim();
            JsonNode customProposalTable = moduleLBFW.path("customProposalTable");
            Pattern configTablePattern = Pattern.compile(
                    "\u0110\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh[\\s\\S]*?<table[^>]*>[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>[\\s\\S]*?</table>",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher configTableMatcher = configTablePattern.matcher(html);
            List<String[]> configRows = new ArrayList<>();
            if ("custom".equalsIgnoreCase(selectedProposalSource) && !txt(customProposalTable, "configurationText").trim().isEmpty()) {
                configRows.add(new String[]{
                        txt(customProposalTable, "component").trim().isEmpty() ? "FW/LB" : txt(customProposalTable, "component").trim(),
                        txt(customProposalTable, "configurationText").trim(),
                        txt(customProposalTable, "quantity").trim(),
                        txt(customProposalTable, "note").trim()
                });
            } else if (configTableMatcher.find()) {
                String tbody = configTableMatcher.group(1);
                Matcher trMatcher = Pattern.compile("<tr[^>]*>([\\s\\S]*?)</tr>", Pattern.CASE_INSENSITIVE).matcher(tbody);
                while (trMatcher.find()) {
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>([\\s\\S]*?)</td>", Pattern.CASE_INSENSITIVE).matcher(trMatcher.group(1));
                    List<String> cols = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cols.add(stripHtmlKeepLineBreaks(tdMatcher.group(1)));
                    }

                    if (cols.size() >= 4) {
                        configRows.add(new String[]{
                                cols.get(0),
                                cols.get(1),
                                cols.get(2),
                                cols.get(3)
                        });
                    }
                }
            }

            if (!configRows.isEmpty()) {
                addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable configTable = doc.createTable(configRows.size() + 1, 4);
                styleTable(configTable);

                setCell(configTable, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(configTable, 0, 1, "Th\u00f4ng l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(configTable, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(configTable, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < configRows.size(); i++) {
                    String[] row = configRows.get(i);
                    setCell(configTable, i + 1, 0, row[0], true, "E6FFED");
                    setCell(configTable, i + 1, 1, row[1], false, "E6FFED");
                    setCell(configTable, i + 1, 2, row[2], false, "E6FFED");
                    setCell(configTable, i + 1, 3, row[3], false, "E6FFED");
                }
                doc.createParagraph();
            }
        } catch (Exception e) {
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    private void writeModuleLBFWCustomMethod(XWPFDocument doc, JsonNode moduleLBFW, String heading) {
        addSubHeading(doc, heading);
        addLabelValue(doc, "Ph\u01b0\u01a1ng ph\u00e1p:", "\u0110\u1ecbnh c\u1ee1 theo ph\u01b0\u01a1ng ph\u00e1p kh\u00e1c");

        String html = txt(moduleLBFW, "customMethodDocHtml");
        if (html.isEmpty()) {
            html = txt(moduleLBFW, "customMethodDocText");
        }
        List<HtmlFragment> fragments = parseHtmlWithImages(html);
        if (!fragments.isEmpty()) {
            addHtmlFragments(doc, fragments);
        }

        JsonNode proposalRows = moduleLBFW.path("customProposalTable");
        if (proposalRows.isArray() && proposalRows.size() > 0) {
            java.util.List<JsonNode> rows = new java.util.ArrayList<>();
            for (int i = 0; i < proposalRows.size(); i++) {
                JsonNode row = proposalRows.get(i);
                if (!txt(row, "component").isBlank()
                        || !txt(row, "configuration").isBlank()
                        || !txt(row, "quantity").isBlank()
                        || !txt(row, "note").isBlank()) {
                    rows.add(row);
                }
            }
            if (!rows.isEmpty()) {
                addSubHeading(doc, "C\u1ea5u h\u00ecnh \u0111\u1ec1 xu\u1ea5t");
                XWPFTable table = doc.createTable(rows.size() + 1, 4);
                styleTable(table);
                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "C\u1ea5u h\u00ecnh \u0111\u1ec1 xu\u1ea5t", true, "D9E2F3");
                setCell(table, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");
                for (int i = 0; i < rows.size(); i++) {
                    JsonNode row = rows.get(i);
                    setCell(table, i + 1, 0, txt(row, "component"), false, null);
                    setCell(table, i + 1, 1, txt(row, "configuration"), false, null);
                    setCell(table, i + 1, 2, txt(row, "quantity"), false, null);
                    setCell(table, i + 1, 3, txt(row, "note"), false, null);
                }
            }
        }
        doc.createParagraph();
    }

    // ---------- Module Custom ----------
    private void writeModuleCustom(XWPFDocument doc, JsonNode moduleCustom, String heading, ExportContext context) {
        if (moduleCustom.isMissingNode()) return;
        String selectedMethod = txt(moduleCustom, "selectedMethod");
        if ("linearEquivalentApp".equals(selectedMethod)) {
            JsonNode linearData = moduleCustom.path("linearEquivalentApp");
            writeModuleApp(doc, linearData, heading + " (tuyến tính theo App)", context);
            return;
        }

        addSubHeading(doc, heading);
        addLabelValue(doc, "Phương pháp:", "Định cỡ theo phương pháp khác");
        String html = txt(moduleCustom, "customMethodDocHtml");
        if (html.isEmpty()) {
            html = txt(moduleCustom, "customMethodDocText");
        }
        List<HtmlFragment> fragments = parseHtmlWithImages(html);
        if (!fragments.isEmpty()) {
            addHtmlFragments(doc, fragments);
        }

        JsonNode proposalRows = moduleCustom.path("customProposalTable");
        if (proposalRows.isArray() && proposalRows.size() > 0) {
            java.util.List<JsonNode> rows = new java.util.ArrayList<>();
            for (int i = 0; i < proposalRows.size(); i++) {
                JsonNode row = proposalRows.get(i);
                if (!txt(row, "component").isBlank()
                        || !txt(row, "configuration").isBlank()
                        || !txt(row, "quantity").isBlank()
                        || !txt(row, "note").isBlank()) {
                    rows.add(row);
                }
            }
            if (!rows.isEmpty()) {
                addSubHeading(doc, "Cấu hình đề xuất");
                XWPFTable table = doc.createTable(rows.size() + 1, 4);
                styleTable(table);
                setCell(table, 0, 0, "Thành phần", true, "D9E2F3");
                setCell(table, 0, 1, "Cấu hình đề xuất", true, "D9E2F3");
                setCell(table, 0, 2, "Số lượng", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi chú", true, "D9E2F3");
                for (int i = 0; i < rows.size(); i++) {
                    JsonNode row = rows.get(i);
                    setCell(table, i + 1, 0, txt(row, "component"), false, null);
                    setCell(table, i + 1, 1, txt(row, "configuration"), false, null);
                    setCell(table, i + 1, 2, txt(row, "quantity"), false, null);
                    setCell(table, i + 1, 3, txt(row, "note"), false, null);
                }
            }
        }
        doc.createParagraph();
    }

    // ======================== V. TONG HOP VA DE XUAT ========================
    private void writeTongHop(XWPFDocument doc, JsonNode root, JsonNode moHinhNode) {
        addSectionHeading(doc, "V. T\u1ed4NG H\u1ee2P V\u00c0 \u0110\u1ec0 XU\u1ea4T");

        // Get selected modules from moHinhHeThong to filter summary rows
        java.util.Set<String> selectedModules = new java.util.HashSet<>();
        if (moHinhNode != null) {
            JsonNode archRows = moHinhNode.path("archRows");
            if (archRows.isArray()) {
                for (JsonNode row : archRows) {
                    String loaiModule = txt(row, "loaiModule").trim();
                    if (!loaiModule.isEmpty()) {
                        selectedModules.add(loaiModule);
                    }
                }
            }
        }
        boolean filterByModules = !selectedModules.isEmpty();

        // Map module names from summary to architecture module types
        // Summary uses: App, MariaDB, MaxScale, NAS, Redis, Kafka, Zookeeper/KRaft, K8S, FW/LB
        // Architecture uses: App, MariaDB, Redis, Kafka, K8S, LB/FW
        java.util.Map<String, String> moduleToArch = new java.util.HashMap<>();
        moduleToArch.put("App", "App");
        moduleToArch.put("MariaDB", "MariaDB");
        moduleToArch.put("MaxScale", "MariaDB");
        moduleToArch.put("NAS", "MariaDB");
        moduleToArch.put("Redis", "Redis");
        moduleToArch.put("Kafka", "Kafka");
        moduleToArch.put("Zookeeper/KRaft", "Kafka");
        moduleToArch.put("FW/LB", "LB/FW");
        moduleToArch.put("Khác", "Khác");

        JsonNode summaryRows = root.path("summaryRows");
        if (summaryRows.isArray() && summaryRows.size() > 0) {
            // Filter rows based on selected modules
            java.util.List<JsonNode> filteredRows = new java.util.ArrayList<>();
            for (int i = 0; i < summaryRows.size(); i++) {
                JsonNode r = summaryRows.get(i);
                String moduleType = txt(r, "moduleType").trim();
                String moduleNameLegacy = txt(r, "module").trim();
                String moduleName = !moduleType.isEmpty() ? moduleType : moduleNameLegacy;
                if (!filterByModules) {
                    filteredRows.add(r);
                } else {
                    String archModule = moduleToArch.getOrDefault(moduleName, moduleName);
                    if (selectedModules.contains(archModule) || selectedModules.contains(moduleName)) {
                        filteredRows.add(r);
                    }
                    // Also check for K8S sub-modules (Master, Worker, etc.)
                    if (moduleName.startsWith("K8S") || moduleName.contains("Master") || moduleName.contains("Worker") || moduleName.contains("etcd")) {
                        if (selectedModules.contains("K8S")) {
                            if (!filteredRows.contains(r)) filteredRows.add(r);
                        }
                    }
                }
            }

            java.util.List<JsonNode> orderedRows = new java.util.ArrayList<>(filteredRows);
            if (moHinhNode != null) {
                JsonNode archRows = moHinhNode.path("archRows");
                if (archRows.isArray() && archRows.size() > 0) {
                    orderedRows = new java.util.ArrayList<>();
                    java.util.List<JsonNode> remaining = new java.util.ArrayList<>(filteredRows);
                    java.util.Map<String, Integer> counters = new java.util.HashMap<>();

                    for (JsonNode row : archRows) {
                        String archType = txt(row, "loaiModule").trim();
                        if (archType.isEmpty()) continue;

                        int seq = counters.getOrDefault(archType, 0) + 1;
                        counters.put(archType, seq);

                        String archName = txt(row, "moduleName").trim();
                        if (archName.isEmpty()) {
                            archName = archType + " #" + seq;
                        }

                        java.util.List<JsonNode> matches = new java.util.ArrayList<>();
                        for (JsonNode r : remaining) {
                            String rowType = txt(r, "moduleType").trim();
                            String rowLegacy = txt(r, "module").trim();
                            String rowResolvedType = !rowType.isEmpty() ? rowType : rowLegacy;
                            String rowMappedType = moduleToArch.getOrDefault(rowResolvedType, rowResolvedType);
                            if (!archType.equals(rowMappedType)) {
                                if (archType.equals("K8S") && (rowResolvedType.startsWith("K8S") || rowResolvedType.contains("Master") || rowResolvedType.contains("Worker") || rowResolvedType.contains("etcd"))) {
                                    // ok
                                } else {
                                    continue;
                                }
                            }

                            String rowModuleName = txt(r, "moduleName").trim();
                            if (rowModuleName.equalsIgnoreCase(archName) || rowModuleName.isEmpty() || archName.isEmpty()) {
                                matches.add(r);
                            }
                        }

                        if (matches.isEmpty()) {
                            for (JsonNode r : remaining) {
                                String rowType = txt(r, "moduleType").trim();
                                String rowLegacy = txt(r, "module").trim();
                                String rowResolvedType = !rowType.isEmpty() ? rowType : rowLegacy;
                                String rowMappedType = moduleToArch.getOrDefault(rowResolvedType, rowResolvedType);
                                if (archType.equals(rowMappedType)
                                        || (archType.equals("K8S") && (rowResolvedType.startsWith("K8S") || rowResolvedType.contains("Master") || rowResolvedType.contains("Worker") || rowResolvedType.contains("etcd")))) {
                                    matches.add(r);
                                }
                            }
                        }

                        if (!matches.isEmpty()) {
                            orderedRows.addAll(matches);
                            remaining.removeAll(matches);
                        }
                    }

                    if (!remaining.isEmpty()) {
                        orderedRows.addAll(remaining);
                    }
                }
            }

            if (!orderedRows.isEmpty()) {
                XWPFTable table = doc.createTable(orderedRows.size() + 1, 6);
                styleTable(table);

                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Lo\u1ea1i module", true, "D9E2F3");
                setCell(table, 0, 2, "T\u00ean module", true, "D9E2F3");
                setCell(table, 0, 3, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                setCell(table, 0, 4, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 5, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < orderedRows.size(); i++) {
                    JsonNode r = orderedRows.get(i);
                    String moduleType = txt(r, "moduleType");
                    String moduleLegacy = txt(r, "module");
                    String moduleName = txt(r, "moduleName");
                    String resolvedModuleType = !moduleType.isEmpty() ? moduleType : moduleLegacy;
                    setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                    setCell(table, i + 1, 1, resolvedModuleType, false, null);
                    setCell(table, i + 1, 2, moduleName, false, null);
                    String cauHinh = txt(r, "cauHinh").replaceAll("<br>", "\n").replaceAll("<[^>]+>", "");
                    setCellWithLineBreaks(table, i + 1, 3, cauHinh);
                    setCell(table, i + 1, 4, txt(r, "soLuong"), false, null);
                    setCell(table, i + 1, 5, txt(r, "ghiChu"), false, null);
                }
            }
        }
        doc.createParagraph();
    }

    // Helper để set cell với line breaks
    private void setCellWithLineBreaks(XWPFTable table, int row, int col, String text) {
        XWPFTableCell cell = table.getRow(row).getCell(col);
        cell.removeParagraph(0);
        XWPFParagraph p = cell.addParagraph();
        p.setSpacingAfter(0);
        p.setSpacingBefore(0);
        
        String[] lines = text.split("\n");
        for (int i = 0; i < lines.length; i++) {
            XWPFRun r = p.createRun();
            r.setText(lines[i].trim());
            r.setFontSize(FONT_SIZE);
            r.setFontFamily(FONT);
            if (i < lines.length - 1) {
                r.addBreak();
            }
        }
    }

    // ======================== HELPER METHODS ========================

    private String resolveSelectedInputRowLabel(JsonNode moduleNode, ExportContext context) {
        String label = txt(moduleNode, "selectedInputRowLabel").trim();
        if (!label.isEmpty()) {
            return label;
        }

        String selectedInputRow = txt(moduleNode, "selectedInputRow").trim();
        if (selectedInputRow.isEmpty()) {
            return "";
        }

        if (context != null && context.sizingRoot != null && selectedInputRow.matches("\\d+")) {
            int rowIndex = Integer.parseInt(selectedInputRow);
            JsonNode inputRows = context.sizingRoot.path("inputRows");
            if (inputRows.isArray() && rowIndex >= 0 && rowIndex < inputRows.size()) {
                String inputName = txt(inputRows.get(rowIndex), "dauVao").trim();
                if (!inputName.isEmpty()) {
                    return inputName;
                }
            }
        }

        return selectedInputRow;
    }

    private String txt(JsonNode node, String field) {
        if (node == null || node.isMissingNode()) return "";
        JsonNode child = node.path(field);
        if (child.isMissingNode() || child.isNull()) return "";
        return child.asText("");
    }

    private double toDouble(JsonNode node, String field) {
        try {
            return Double.parseDouble(txt(node, field));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String formatNum(double val) {
        if (val == (long) val) return String.valueOf((long) val);
        return String.format("%.2f", val);
    }

    private String buildCaption(String baseTitle, String detail) {
        String base = baseTitle == null ? "" : baseTitle.trim();
        String extra = detail == null ? "" : detail.trim();

        String caption = extra.isEmpty() ? base : (base + " (" + extra + ")");
        if (caption.isEmpty()) {
            return "H\u00ecnh \u1ea3nh s\u1edf c\u1ee9.";
        }

        if (!caption.endsWith(".") && !caption.endsWith("!") && !caption.endsWith("?")) {
            caption = caption + ".";
        }
        return caption;
    }

    private void addSectionHeading(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(200);
        XWPFRun r = p.createRun();
        r.setText(text);
        r.setBold(true);
        r.setFontSize(HEADING_SIZE);
        r.setFontFamily(FONT);
        r.setColor("1F4E79");
    }

    private void addSubHeading(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(100);
        XWPFRun r = p.createRun();
        r.setText(text);
        r.setBold(true);
        r.setFontSize(FONT_SIZE);
        r.setFontFamily(FONT);
    }

    private void addSubHeading2(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setText(text);
        r.setBold(true);
        r.setItalic(true);
        r.setFontSize(FONT_SIZE);
        r.setFontFamily(FONT);
    }

    private void addNormalText(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        // Xử lý line breaks: tách theo \n và thêm break
        String[] lines = text.split("\n");
        for (int i = 0; i < lines.length; i++) {
            XWPFRun r = p.createRun();
            r.setText(lines[i]);
            r.setFontSize(FONT_SIZE);
            r.setFontFamily(FONT);
            if (i < lines.length - 1) {
                r.addBreak();
            }
        }
    }

    private void addLabelValue(XWPFDocument doc, String label, String value) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun lr = p.createRun();
        lr.setText(label + " ");
        lr.setBold(true);
        lr.setFontSize(FONT_SIZE);
        lr.setFontFamily(FONT);
        XWPFRun vr = p.createRun();
        vr.setText(value != null ? value : "");
        vr.setFontSize(FONT_SIZE);
        vr.setFontFamily(FONT);
    }

    private void styleTable(XWPFTable table) {
        table.setWidth("100%");
        CTTblPr tblPr = table.getCTTbl().getTblPr();
        if (tblPr == null) tblPr = table.getCTTbl().addNewTblPr();
        CTTblBorders borders = tblPr.addNewTblBorders();
        setBorder(borders.addNewTop());
        setBorder(borders.addNewBottom());
        setBorder(borders.addNewLeft());
        setBorder(borders.addNewRight());
        setBorder(borders.addNewInsideH());
        setBorder(borders.addNewInsideV());
    }

    private void setBorder(CTBorder border) {
        border.setVal(STBorder.SINGLE);
        border.setSz(BigInteger.valueOf(4));
        border.setColor("000000");
        border.setSpace(BigInteger.ZERO);
    }

    private void setCell(XWPFTable table, int row, int col, String text, boolean bold, String bgColor) {
        setCell(table, row, col, text, bold, bgColor, ParagraphAlignment.CENTER, null);
    }

    private void setCell(XWPFTable table, int row, int col, String text, boolean bold, String bgColor, ParagraphAlignment alignment) {
        setCell(table, row, col, text, bold, bgColor, alignment, null);
    }

    private void setCell(XWPFTable table, int row, int col, String text, boolean bold, String bgColor, ParagraphAlignment alignment, Integer indentLeft) {
        XWPFTableCell cell = table.getRow(row).getCell(col);
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);

        if (bgColor != null) {
            CTTcPr tcPr = cell.getCTTc().addNewTcPr();
            CTShd shd = tcPr.addNewShd();
            shd.setVal(STShd.CLEAR);
            shd.setColor("auto");
            shd.setFill(bgColor);
        }

        cell.removeParagraph(0);
        XWPFParagraph p = cell.addParagraph();
        p.setAlignment(alignment != null ? alignment : ParagraphAlignment.CENTER);
        p.setSpacingBefore(40);
        p.setSpacingAfter(40);
        if (indentLeft != null) {
            p.setIndentationLeft(indentLeft);
        }

        if (text != null && text.contains("\n")) {
            String[] lines = text.split("\n");
            for (int i = 0; i < lines.length; i++) {
                XWPFRun r = p.createRun();
                r.setText(lines[i]);
                r.setBold(bold);
                r.setFontSize(FONT_SIZE);
                r.setFontFamily(FONT);
                if (i < lines.length - 1) r.addBreak();
            }
        } else {
            XWPFRun r = p.createRun();
            r.setText(text != null ? text : "");
            r.setBold(bold);
            r.setFontSize(FONT_SIZE);
            r.setFontFamily(FONT);
        }
    }

    private List<String> collectImageRefs(JsonNode imagesNode, String title, ExportContext context) {
        // Kept for signature compatibility - returns empty list, images are embedded inline
        return new ArrayList<>();
    }

    private List<String> collectSingleImageRef(String base64, String title, ExportContext context) {
        // Kept for signature compatibility - returns empty list, images are embedded inline
        return new ArrayList<>();
    }

    private void addAppendixNote(XWPFDocument doc, List<String> refs) {
        // No longer used - images are embedded inline instead of in appendix
    }

    /**
     * Embed images from a JSON array inline in the document at their original position.
     */
    private void addInlineImages(XWPFDocument doc, JsonNode imagesNode, String caption) {
        if (imagesNode == null || !imagesNode.isArray()) return;

        for (JsonNode img : imagesNode) {
            String base64 = "";
            if (img.isObject()) {
                if (img.has("base64")) base64 = img.get("base64").asText("");
                else if (img.has("dataUrl")) base64 = img.get("dataUrl").asText("");
            } else if (img.isTextual()) {
                base64 = img.asText("");
            }

            if (base64 != null && !base64.isBlank()) {
                addInlineSingleImage(doc, base64, caption);
            }
        }
    }

    /**
     * Embed a single base64 image inline in the document with a caption below.
     */
    private void addInlineSingleImage(XWPFDocument doc, String base64String, String caption) {
        if (base64String == null || base64String.isBlank()) return;
        addBase64Image(doc, base64String);
        if (caption != null && !caption.isBlank()) {
            XWPFParagraph capP = doc.createParagraph();
            capP.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun capR = capP.createRun();
            capR.setText(caption);
            capR.setItalic(true);
            capR.setFontSize(FONT_SIZE - 1);
            capR.setFontFamily(FONT);
            capR.setColor("666666");
        }
    }

    private void addBase64Image(XWPFDocument doc, String base64String) {
        try {
            String base64Data = base64String;
            int pictureType = XWPFDocument.PICTURE_TYPE_PNG;

            if (base64String.contains(",")) {
                String[] parts = base64String.split(",", 2);
                String header = parts[0].toLowerCase();
                base64Data = parts[1];
                if (header.contains("jpeg") || header.contains("jpg")) {
                    pictureType = XWPFDocument.PICTURE_TYPE_JPEG;
                } else if (header.contains("gif")) {
                    pictureType = XWPFDocument.PICTURE_TYPE_GIF;
                } else if (header.contains("bmp")) {
                    pictureType = XWPFDocument.PICTURE_TYPE_BMP;
                }
            }

            byte[] imageBytes = Base64.getDecoder().decode(base64Data);

            XWPFParagraph p = doc.createParagraph();
            p.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun r = p.createRun();

            try (ByteArrayInputStream bis = new ByteArrayInputStream(imageBytes)) {
                r.addPicture(bis, pictureType, "image", Units.toEMU(450), Units.toEMU(280));
            }
        } catch (Exception e) {
            log.warn("Failed to add base64 image: {}", e.getMessage());
        }
    }

    // ========== HTML Fragment with Inline Images ==========

    private static class HtmlFragment {
        enum Type { TEXT, IMAGE }
        Type type;
        String content;
        Integer widthPx;
        Integer heightPx;

        static HtmlFragment text(String content) {
            HtmlFragment f = new HtmlFragment();
            f.type = Type.TEXT;
            f.content = content;
            return f;
        }

        static HtmlFragment image(String base64Uri, Integer widthPx, Integer heightPx) {
            HtmlFragment f = new HtmlFragment();
            f.type = Type.IMAGE;
            f.content = base64Uri;
            f.widthPx = widthPx;
            f.heightPx = heightPx;
            return f;
        }
    }

    private String stripOtherTags(String html) {
        String result = html;
        // Preserve line breaks from HTML tags
        result = result.replaceAll("(?i)<br\\s*/?>", "\n");
        result = result.replaceAll("(?i)<div\\b[^>]*>", "\n");
        result = result.replaceAll("(?i)</p>", "\n");
        result = result.replaceAll("(?i)<p\\b[^>]*>", "\n");
        result = result.replaceAll("(?i)</div>", "\n");
        result = result.replaceAll("(?i)<li\\b[^>]*>", "\n");
        result = result.replaceAll("(?i)</li>", "\n");
        // Remove all HTML tags EXCEPT <img>
        result = result.replaceAll("<(?!img\\b)[^>]+>", " ");
        // Clean up whitespace
        result = result.replace("&nbsp;", " ")
                .replaceAll("\\n\\s*\\n+", "\n")
                .replaceAll("[ \\t]+", " ")
                .trim();
        return result;
    }

    private Integer extractImageDimension(String tag, String attributeName, String styleName) {
        if (tag == null || tag.isEmpty()) {
            return null;
        }

        Matcher attrMatcher = Pattern.compile(attributeName + "\\s*=\\s*[\"']?(\\d+)(?:px)?[\"']?", Pattern.CASE_INSENSITIVE).matcher(tag);
        if (attrMatcher.find()) {
            try {
                return Integer.parseInt(attrMatcher.group(1));
            } catch (NumberFormatException ignored) {
            }
        }

        Matcher styleMatcher = Pattern.compile("(^|[;\\s])" + styleName + "\\s*:\\s*(\\d+)(?:px)?", Pattern.CASE_INSENSITIVE).matcher(tag);
        if (styleMatcher.find()) {
            try {
                return Integer.parseInt(styleMatcher.group(2));
            } catch (NumberFormatException ignored) {
            }
        }

        return null;
    }

    private List<HtmlFragment> parseHtmlWithImages(String html) {
        List<HtmlFragment> fragments = new ArrayList<>();
        if (html == null || html.isEmpty()) {
            return fragments;
        }

        String imgPattern = "<img\\b([^>]*?)src=[\"']data:image/([^;]+);base64,([^\"']+)[\"']([^>]*)>";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(imgPattern, java.util.regex.Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher m = p.matcher(html);

        int lastEnd = 0;
        while (m.find()) {
            String beforeText = html.substring(lastEnd, m.start());
            String imgTag = m.group(0);
            String imgType = m.group(2);
            String base64 = m.group(3);
            String fullUri = "data:image/" + imgType + ";base64," + base64;
            Integer widthPx = extractImageDimension(imgTag, "data-origin-width", "width");
            Integer heightPx = extractImageDimension(imgTag, "data-origin-height", "height");

            // Process text before image
            String textContent = stripOtherTags(beforeText);
            if (!textContent.isEmpty()) {
                fragments.add(HtmlFragment.text(textContent));
            }

            // Add image
            fragments.add(HtmlFragment.image(fullUri, widthPx, heightPx));

            lastEnd = m.end();
        }

        // Process text after last image
        String afterText = html.substring(lastEnd);
        String textContent = stripOtherTags(afterText);
        if (!textContent.isEmpty()) {
            fragments.add(HtmlFragment.text(textContent));
        }

        return fragments;
    }

    private void addInlineImage(XWPFParagraph paragraph, String base64Uri, Integer preferredWidthPx, Integer preferredHeightPx) {
        try {
            String base64Data = base64Uri;
            int pictureType = XWPFDocument.PICTURE_TYPE_PNG;

            if (base64Uri.contains(",")) {
                String[] parts = base64Uri.split(",", 2);
                String header = parts[0].toLowerCase();
                base64Data = parts[1];
                if (header.contains("jpeg") || header.contains("jpg")) {
                    pictureType = XWPFDocument.PICTURE_TYPE_JPEG;
                } else if (header.contains("gif")) {
                    pictureType = XWPFDocument.PICTURE_TYPE_GIF;
                } else if (header.contains("bmp")) {
                    pictureType = XWPFDocument.PICTURE_TYPE_BMP;
                }
            }

            byte[] imageBytes = Base64.getDecoder().decode(base64Data);
            int displayWidthPx = preferredWidthPx != null ? preferredWidthPx : 0;
            int displayHeightPx = preferredHeightPx != null ? preferredHeightPx : 0;

            BufferedImage bufferedImage = null;
            try (ByteArrayInputStream imageInput = new ByteArrayInputStream(imageBytes)) {
                bufferedImage = ImageIO.read(imageInput);
            } catch (Exception ignored) {
            }

            int actualWidthPx = bufferedImage != null ? bufferedImage.getWidth() : 0;
            int actualHeightPx = bufferedImage != null ? bufferedImage.getHeight() : 0;

            if (displayWidthPx <= 0 && actualWidthPx > 0) {
                displayWidthPx = actualWidthPx;
            }
            if (displayHeightPx <= 0 && actualHeightPx > 0) {
                displayHeightPx = actualHeightPx;
            }

            if (displayWidthPx > 0 && displayHeightPx <= 0 && actualWidthPx > 0 && actualHeightPx > 0) {
                displayHeightPx = (int) Math.round((double) displayWidthPx * actualHeightPx / actualWidthPx);
            } else if (displayHeightPx > 0 && displayWidthPx <= 0 && actualWidthPx > 0 && actualHeightPx > 0) {
                displayWidthPx = (int) Math.round((double) displayHeightPx * actualWidthPx / actualHeightPx);
            }

            if (displayWidthPx <= 0 || displayHeightPx <= 0) {
                displayWidthPx = 420;
                displayHeightPx = 280;
            }

            final int maxWidthPx = 520;
            final int maxHeightPx = 720;
            double scale = Math.min(1.0, Math.min((double) maxWidthPx / displayWidthPx, (double) maxHeightPx / displayHeightPx));
            int finalWidthPx = Math.max(1, (int) Math.round(displayWidthPx * scale));
            int finalHeightPx = Math.max(1, (int) Math.round(displayHeightPx * scale));

            XWPFRun imgRun = paragraph.createRun();
            try (ByteArrayInputStream bis = new ByteArrayInputStream(imageBytes)) {
                imgRun.addPicture(bis, pictureType, "image", Units.toEMU(finalWidthPx), Units.toEMU(finalHeightPx));
            }
        } catch (Exception e) {
            log.warn("Failed to add inline image: {}", e.getMessage());
            XWPFRun placeholderRun = paragraph.createRun();
            placeholderRun.setText("[Ảnh: base64 invalid]");
            placeholderRun.setColor("999999");
        }
    }

    private void addHtmlFragments(XWPFDocument doc, List<HtmlFragment> fragments) {
        if (fragments == null || fragments.isEmpty()) {
            return;
        }

        XWPFParagraph paragraph = doc.createParagraph();
        boolean firstInParagraph = true;

        for (int index = 0; index < fragments.size(); index++) {
            HtmlFragment fragment = fragments.get(index);
            if (fragment.type == HtmlFragment.Type.TEXT) {
                String text = fragment.content;
                if (text.isEmpty()) {
                    continue;
                }

                // For text starting with newline, create new paragraph
                if (!firstInParagraph && text.startsWith("\n")) {
                    paragraph = doc.createParagraph();
                    text = text.substring(1);
                    if (text.isEmpty()) {
                        continue;
                    }
                }

                // Split by newlines and add breaks
                String[] lines = text.split("\\n", -1);
                for (int i = 0; i < lines.length; i++) {
                    if (i > 0) {
                        paragraph.createRun().addBreak();
                    }
                    if (!lines[i].isEmpty()) {
                        paragraph.createRun().setText(lines[i]);
                    }
                }
                firstInParagraph = false;
            } else if (fragment.type == HtmlFragment.Type.IMAGE) {
                if (!firstInParagraph) {
                    paragraph = doc.createParagraph();
                }
                addInlineImage(paragraph, fragment.content, fragment.widthPx, fragment.heightPx);
                firstInParagraph = true;
                if (index < fragments.size() - 1) {
                    paragraph = doc.createParagraph();
                }
            }
        }
    }
}
