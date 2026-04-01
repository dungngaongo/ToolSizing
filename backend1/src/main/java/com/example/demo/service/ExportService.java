package com.example.demo.service;

import com.example.demo.exception.ResourceNotFoundException;
import com.example.demo.model.Project;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.util.Base64;

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

        // ===== TITLE =====
        addTitle(doc, project.getName());

        // ===== I. YEU CAU BAI TOAN =====
        if (pd.getYeuCauBaiToanContent() != null) {
            writeYeuCauBaiToan(doc, objectMapper.readTree(pd.getYeuCauBaiToanContent()));
        }

        // ===== II. THONG TIN DAU VAO =====
        if (pd.getThongTinDauVaoContent() != null) {
            writeThongTinDauVao(doc, objectMapper.readTree(pd.getThongTinDauVaoContent()));
        }

        // ===== III. MO HINH HE THONG =====
        JsonNode moHinhNode = null;
        if (pd.getMoHinhHeThongContent() != null) {
            moHinhNode = objectMapper.readTree(pd.getMoHinhHeThongContent());
            writeMoHinhHeThong(doc, moHinhNode);
        }

        // ===== IV. DINH CO HE THONG =====
        if (pd.getDinhCoHeThongContent() != null) {
            writeDinhCoHeThong(doc, objectMapper.readTree(pd.getDinhCoHeThongContent()), moHinhNode);
        }

        // ===== V. TONG HOP VA DE XUAT =====
        if (pd.getTongHopVaDeXuatContent() != null) {
            writeTongHop(doc, objectMapper.readTree(pd.getTongHopVaDeXuatContent()), moHinhNode);
        }

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
            setCell(table, i + 1, 0, fields[i][0], false, null);
            setCell(table, i + 1, 1, fields[i][1], false, null);
            setCell(table, i + 1, 2, txt(node, fields[i][2]), false, null);
        }
        doc.createParagraph();
    }

    // ======================== II. THONG TIN DAU VAO ========================
    private void writeThongTinDauVao(XWPFDocument doc, JsonNode root) {
        addSectionHeading(doc, "II. TH\u00d4NG TIN \u0110\u1ea6U V\u00c0O");

        JsonNode inputRows = root.path("inputRows");
        if (inputRows.isArray() && inputRows.size() > 0) {
            int cols = 6;
            XWPFTable table = doc.createTable(inputRows.size() + 1, cols);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "\u0110\u1ea7u v\u00e0o", true, "D9E2F3");
            setCell(table, 0, 2, "T\u1ea3i h\u1ec7 th\u1ed1ng POC", true, "D9E2F3");
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

            // POC evidence images
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
                        addImagesFromArray(doc, imgs);
                    }
                }
            }

            // Sizing evidence images
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
                        addImagesFromArray(doc, imgs);
                    }
                }
            }
        }
    }

    // ======================== III. MO HINH HE THONG ========================
    private void writeMoHinhHeThong(XWPFDocument doc, JsonNode root) {
        addSectionHeading(doc, "III. M\u00d4 H\u00ccNH H\u1ec6 TH\u1ed0NG");

        addSubHeading(doc, "1. M\u00f4 h\u00ecnh v\u1eadt l\u00fd");
        addImagesFromArray(doc, root.path("physicalImages"));

        addSubHeading(doc, "2. M\u00f4 h\u00ecnh logic");
        addImagesFromArray(doc, root.path("logicalImages"));

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
            addImagesFromArray(doc, root.path("connectionImages"));
        }

        addSubHeading(doc, "4. Lu\u1ed3ng nghi\u1ec7p v\u1ee5");
        addImagesFromArray(doc, root.path("flowImages"));

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
    private void writeDinhCoHeThong(XWPFDocument doc, JsonNode root, JsonNode moHinhNode) {
        addSectionHeading(doc, "IV. ĐỊNH C\u1ee0 H\u1ec6 TH\u1ed0NG");
        
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
        
        if (exportAll || selectedModules.contains("App")) {
            writeModuleApp(doc, root.path("moduleApp"));
        }
        if (exportAll || selectedModules.contains("MariaDB")) {
            writeModuleMariaDB(doc, root.path("moduleMariaDB"));
        }
        if (exportAll || selectedModules.contains("Redis")) {
            writeModuleRedis(doc, root.path("moduleRedis"));
        }
        if (exportAll || selectedModules.contains("Kafka")) {
            writeModuleKafka(doc, root.path("moduleKafka"));
        }
        if (exportAll || selectedModules.contains("K8S")) {
            writeModuleK8S(doc, root.path("moduleK8S"));
        }
        if (exportAll || selectedModules.contains("LB/FW")) {
            writeModuleLBFW(doc, root.path("moduleLBFW"));
        }
    }

    // ---------- Module App ----------
    private void writeModuleApp(XWPFDocument doc, JsonNode moduleApp) {
        if (moduleApp.isMissingNode()) return;
        addSubHeading(doc, "1. Module App");

        // Baseline table
        JsonNode baselineTable = moduleApp.path("baselineTable");
        if (baselineTable.isArray() && baselineTable.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin h\u1ec7 th\u1ed1ng tham chi\u1ebfu");

            int rows = baselineTable.size();
            XWPFTable table = doc.createTable(rows + 2, 6);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "CPU", true, "D9E2F3");
            setCell(table, 0, 3, "RAM\n(GB)", true, "D9E2F3");
            setCell(table, 0, 4, "DISK\n(GB)", true, "D9E2F3");
            setCell(table, 0, 5, "Cint_rate_2017", true, "D9E2F3");

            double totalCpu = 0, totalRam = 0, totalDisk = 0, totalCint = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = baselineTable.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpu"), false, null);
                setCell(table, i + 1, 3, txt(r, "ram"), false, null);
                setCell(table, i + 1, 4, txt(r, "disk"), false, null);
                setCell(table, i + 1, 5, txt(r, "cintRate"), false, null);
                totalCpu += toDouble(r, "cpu");
                totalRam += toDouble(r, "ram");
                totalDisk += toDouble(r, "disk");
                totalCint += toDouble(r, "cintRate");
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, formatNum(totalCpu), true, "E2EFDA");
            setCell(table, rows + 1, 3, formatNum(totalRam), true, "E2EFDA");
            setCell(table, rows + 1, 4, formatNum(totalDisk), true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalCint), true, "E2EFDA");
            doc.createParagraph();
        }

        addImagesFromArray(doc, moduleApp.path("baselineEvidence"));

        // Input config table
        JsonNode inputConfig = moduleApp.path("inputConfigTable");
        if (inputConfig.isArray() && inputConfig.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o");

            int rows = inputConfig.size();
            XWPFTable table = doc.createTable(rows + 2, 8);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "T\u1ea3i CPU 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 3, "T\u1ea3i RAM 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 4, "T\u1ea3i DISK 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 5, "Cint_rate used\n(Cint)", true, "D9E2F3");
            setCell(table, 0, 6, "RAM used\n(GB)", true, "D9E2F3");
            setCell(table, 0, 7, "DISK used\n(GB)", true, "D9E2F3");

            double totalCintUsed = 0, totalRamUsed = 0, totalDiskUsed = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = inputConfig.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpuLoad"), false, null);
                setCell(table, i + 1, 3, txt(r, "ramLoad"), false, null);
                setCell(table, i + 1, 4, txt(r, "diskLoad"), false, null);
                setCell(table, i + 1, 5, txt(r, "cintUsed"), false, null);
                setCell(table, i + 1, 6, txt(r, "ramUsed"), false, null);
                setCell(table, i + 1, 7, txt(r, "diskUsed"), false, null);
                totalCintUsed += toDouble(r, "cintUsed");
                totalRamUsed += toDouble(r, "ramUsed");
                totalDiskUsed += toDouble(r, "diskUsed");
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, "", true, "E2EFDA");
            setCell(table, rows + 1, 4, "", true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalCintUsed), true, "E2EFDA");
            setCell(table, rows + 1, 6, formatNum(totalRamUsed), true, "E2EFDA");
            setCell(table, rows + 1, 7, formatNum(totalDiskUsed), true, "E2EFDA");
            doc.createParagraph();
        }

        // Evidence images
        JsonNode evidenceImages = moduleApp.path("evidenceImages");
        if (evidenceImages.isArray() && evidenceImages.size() > 0) {
            addSubHeading2(doc, "S\u1edf c\u1ee9 th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o:");
            addImagesFromArray(doc, evidenceImages);
        }

        // Sizing result
        String pocValue = txt(moduleApp, "pocValue");
        String sizingValue = txt(moduleApp, "sizingValue");
        if (!pocValue.isEmpty() || !sizingValue.isEmpty()) {
            addLabelValue(doc, "CCU \u0111\u1ea7u v\u00e0o (POC):", pocValue);
            addLabelValue(doc, "CCU \u0111\u1ecbnh c\u1ee1:", sizingValue);
        }

        String sizingResult = txt(moduleApp, "sizingResult");
        if (!sizingResult.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteAppSizingResult(doc, sizingResult);
        }
    }

    // Parse Module App sizing result HTML and write to DOC with proper formatting
    private void parseAndWriteAppSizingResult(XWPFDocument doc, String html) {
        try {
            // Extract data from HTML using regex patterns
            // Bảng 1: Thông số Máy chủ Tiến trình
            java.util.regex.Pattern rowPattern = java.util.regex.Pattern.compile(
                "<tr>\\s*<td[^>]*>\\s*(\\d+)\\s*</td>\\s*<td>([^<]+)</td>\\s*<td[^>]*>([\\d.]+)</td>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher rowMatcher = rowPattern.matcher(html);
            
            java.util.List<String[]> tableData = new java.util.ArrayList<>();
            while (rowMatcher.find()) {
                tableData.add(new String[]{
                    rowMatcher.group(1).trim(),
                    rowMatcher.group(2).trim(),
                    rowMatcher.group(3).trim()
                });
            }
            
            if (!tableData.isEmpty()) {
                addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh");
                XWPFTable table = doc.createTable(tableData.size() + 1, 4);
                styleTable(table);
                
                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                setCell(table, 0, 2, "M\u00e1y ch\u1ee7 Ti\u1ebfn tr\u00ecnh", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");
                
                String[] notes = {
                    "", "", "",
                    "KPI 75%. Sai s\u1ed1 1.1",
                    "KPI 90%. Sai s\u1ed1 1.1",
                    "KPI 80%. Sai s\u1ed1 1.1"
                };
                
                for (int i = 0; i < tableData.size(); i++) {
                    String[] row = tableData.get(i);
                    setCell(table, i + 1, 0, row[0], false, null);
                    setCell(table, i + 1, 1, row[1], false, null);
                    setCell(table, i + 1, 2, row[2], false, null);
                    setCell(table, i + 1, 3, i < notes.length ? notes[i] : "", false, null);
                }
                doc.createParagraph();
            }
            
            // Extract Đề xuất section
            java.util.regex.Pattern deXuatPattern = java.util.regex.Pattern.compile(
                "N\\s*=\\s*([\\d.]+)\\s*/\\s*32\\s*[≈~=]\\s*<strong>([\\d]+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher deXuatMatcher = deXuatPattern.matcher(html);
            if (deXuatMatcher.find()) {
                String ramValue = deXuatMatcher.group(1);
                String nValue = deXuatMatcher.group(2);
                addNormalText(doc, "\u0110\u1ec1 xu\u1ea5t: L\u1ef1a ch\u1ecdn c\u1ea5u h\u00ecnh \u1ea3o h\u00f3a \u2248 32 GB RAM, l\u1ef1a ch\u1ecdn s\u1ed1 N theo RAM: N = " + ramValue + " / 32 \u2248 " + nValue);
                doc.createParagraph();
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
    private void writeModuleMariaDB(XWPFDocument doc, JsonNode moduleMariaDB) {
        if (moduleMariaDB.isMissingNode()) return;
        addSubHeading(doc, "2. Module MariaDB");

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
                for (JsonNode imgNode : storageEvidenceImages) {
                    String imgData = imgNode.asText("");
                    if (!imgData.isEmpty()) {
                        addBase64Image(doc, imgData);
                    }
                }
            }
        }

        // Evidence
        addImagesFromArray(doc, moduleMariaDB.path("evidence"));
        addImagesFromArray(doc, moduleMariaDB.path("refEvidence"));

        // Note
        String note = txt(moduleMariaDB, "note");
        if (!note.isEmpty()) {
            addLabelValue(doc, "Ghi ch\u00fa:", note);
        }

        // CCU
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
            parseAndWriteMariaDBResult(doc, resultHTML);
        }

        doc.createParagraph();
    }

    // Parse Module MariaDB result HTML and write to DOC with proper formatting
    private void parseAndWriteMariaDBResult(XWPFDocument doc, String html) {
        try {
            // Extract thông tin tính toán
            java.util.regex.Pattern infoPattern = java.util.regex.Pattern.compile(
                "Th\u00f4ng tin t\u00ednh to\u00e1n.*?</ul>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher infoMatcher = infoPattern.matcher(html);
            if (infoMatcher.find()) {
                String infoContent = infoMatcher.group(0);
                java.util.regex.Pattern liPattern = java.util.regex.Pattern.compile("<li>([^<]+)</li>");
                java.util.regex.Matcher liMatcher = liPattern.matcher(infoContent);
                while (liMatcher.find()) {
                    String text = liMatcher.group(1).replaceAll("<[^>]*>", "").trim();
                    addNormalText(doc, "\u2022 " + text);
                }
            }
            
            // Extract bảng kết quả đề xuất
            java.util.regex.Pattern configPattern = java.util.regex.Pattern.compile(
                "(\\d+)\\s*vCPU.*?(\\d+)\\s*GB\\s*RAM.*?/data:\\s*(\\d+)\\s*GB.*?/log:\\s*(\\d+)\\s*GB",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher configMatcher = configPattern.matcher(html);
            if (configMatcher.find()) {
                doc.createParagraph();
                addSubHeading2(doc, "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable table = doc.createTable(3, 4);
                styleTable(table);
                
                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                setCell(table, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");
                
                String config = configMatcher.group(1) + " vCPU\n" + configMatcher.group(2) + " GB RAM\n/data: " + configMatcher.group(3) + " GB\n/log: " + configMatcher.group(4) + " GB";
                setCell(table, 1, 0, "MariaDB", true, "E6FFED");
                setCell(table, 1, 1, config, false, "E6FFED");
                setCell(table, 1, 2, "3", true, "E6FFED");
                setCell(table, 1, 3, "Gi\u00e1 tr\u1ecb MariaDB l\u1ea5y gi\u00e1 tr\u1ecb t\u00ednh \u0111\u01b0\u1ee3c \u1edf tr\u00ean", false, "E6FFED");
                
                // Extract NAS
                java.util.regex.Pattern nasPattern = java.util.regex.Pattern.compile(
                    "NAS.*?<strong>(\\d+)\\s*GB</strong>",
                    java.util.regex.Pattern.DOTALL
                );
                java.util.regex.Matcher nasMatcher = nasPattern.matcher(html);
                if (nasMatcher.find()) {
                    setCell(table, 2, 0, "NAS", true, "FFF9E6");
                    setCell(table, 2, 1, nasMatcher.group(1) + " GB", false, "FFF9E6");
                    setCell(table, 2, 2, "-", true, "FFF9E6");
                    setCell(table, 2, 3, "Mount chung (/data + /log + /backup)", false, "FFF9E6");
                }
                doc.createParagraph();
            }
        } catch (Exception e) {
            // Fallback to plain text if parsing fails
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module Redis ----------
    private void writeModuleRedis(XWPFDocument doc, JsonNode moduleRedis) {
        if (moduleRedis.isMissingNode()) return;
        addSubHeading(doc, "3. Module Redis");

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
                    addImagesFromArray(doc, keyMethod.path("evidenceImages"));

                    String resultHTML = txt(keyMethod, "resultHTML");
                    if (!resultHTML.isEmpty()) {
                        addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
                        parseAndWriteRedisResult(doc, resultHTML);
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
                    parseAndWriteRedisResult(doc, resultHTML);
                }
            }
        }

        doc.createParagraph();
    }

    // Parse Redis result HTML and write to DOC with proper formatting
    private void parseAndWriteRedisResult(XWPFDocument doc, String html) {
        try {
            // Extract thông tin tính toán
            java.util.regex.Pattern infoPattern = java.util.regex.Pattern.compile(
                "Th\u00f4ng tin t\u00ednh to\u00e1n.*?</ul>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher infoMatcher = infoPattern.matcher(html);
            if (infoMatcher.find()) {
                String infoContent = infoMatcher.group(0);
                java.util.regex.Pattern liPattern = java.util.regex.Pattern.compile("<li>([^<]*(?:<[^>]*>[^<]*)*)</li>");
                java.util.regex.Matcher liMatcher = liPattern.matcher(infoContent);
                while (liMatcher.find()) {
                    String text = liMatcher.group(1).replaceAll("<[^>]*>", "").trim();
                    addNormalText(doc, "\u2022 " + text);
                }
            }
            
            // Extract đề xuất mô hình
            java.util.regex.Pattern modelPattern = java.util.regex.Pattern.compile(
                "\u0110\u1ec1 xu\u1ea5t m\u00f4 h\u00ecnh.*?<strong>([^<]+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher modelMatcher = modelPattern.matcher(html);
            if (modelMatcher.find()) {
                doc.createParagraph();
                addNormalText(doc, "\u0110\u1ec1 xu\u1ea5t m\u00f4 h\u00ecnh: " + modelMatcher.group(1));
            }
            
            // Extract bảng kết quả đề xuất cấu hình
            java.util.regex.Pattern configPattern = java.util.regex.Pattern.compile(
                "(\\d+)\\s*vCPU.*?(\\d+)\\s*GB\\s*RAM.*?(\\d+)\\s*GB\\s*DISK.*?<strong>(\\d+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher configMatcher = configPattern.matcher(html);
            if (configMatcher.find()) {
                doc.createParagraph();
                addSubHeading2(doc, "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable table = doc.createTable(2, 4);
                styleTable(table);
                
                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "C\u1ea5u h\u00ecnh \u0111\u1ec1 xu\u1ea5t", true, "D9E2F3");
                setCell(table, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");
                
                String config = configMatcher.group(1) + " vCPU\n" + configMatcher.group(2) + " GB RAM\n" + configMatcher.group(3) + " GB DISK";
                setCell(table, 1, 0, "Redis", true, "E6FFED");
                setCell(table, 1, 1, config, false, "E6FFED");
                setCell(table, 1, 2, configMatcher.group(4), true, "E6FFED");
                setCell(table, 1, 3, "", false, "E6FFED");
                doc.createParagraph();
            }
            
            // Extract bảng tổng hợp tài nguyên
            java.util.regex.Pattern summaryPattern = java.util.regex.Pattern.compile(
                "T\u1ed5ng vCPU.*?<strong>(\\d+)</strong>.*?T\u1ed5ng RAM.*?<strong>(\\d+)</strong>.*?T\u1ed5ng Disk.*?<strong>(\\d+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher summaryMatcher = summaryPattern.matcher(html);
            if (summaryMatcher.find()) {
                addSubHeading2(doc, "B\u1ea3ng t\u1ed5ng h\u1ee3p t\u00e0i nguy\u00ean");
                addNormalText(doc, "T\u1ed5ng vCPU: " + summaryMatcher.group(1) + ", T\u1ed5ng RAM: " + summaryMatcher.group(2) + " GB, T\u1ed5ng Disk: " + summaryMatcher.group(3) + " GB");
            }
        } catch (Exception e) {
            // Fallback to plain text if parsing fails
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module Kafka ----------
    private void writeModuleKafka(XWPFDocument doc, JsonNode moduleKafka) {
        if (moduleKafka.isMissingNode()) return;
        addSubHeading(doc, "4. Module Kafka");

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
                    addImagesFromArray(doc, throughputMethod.path("throughputEvidence"));
                    addImagesFromArray(doc, throughputMethod.path("compressionEvidence"));

                    String resultHTML = txt(throughputMethod, "resultHTML");
                    if (!resultHTML.isEmpty()) {
                        addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
                        parseAndWriteKafkaResult(doc, resultHTML);
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
                    parseAndWriteKafkaResult(doc, resultHTML);
                }
            }
        }

        doc.createParagraph();
    }

    // Parse Kafka result HTML and write to DOC with proper formatting
    private void parseAndWriteKafkaResult(XWPFDocument doc, String html) {
        try {
            // Extract thông tin tính toán
            java.util.regex.Pattern infoPattern = java.util.regex.Pattern.compile(
                "Th\u00f4ng tin t\u00ednh to\u00e1n.*?</ul>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher infoMatcher = infoPattern.matcher(html);
            if (infoMatcher.find()) {
                String infoContent = infoMatcher.group(0);
                java.util.regex.Pattern liPattern = java.util.regex.Pattern.compile("<li>([^<]*(?:<[^>]*>[^<]*)*)</li>");
                java.util.regex.Matcher liMatcher = liPattern.matcher(infoContent);
                while (liMatcher.find()) {
                    String text = liMatcher.group(1).replaceAll("<[^>]*>", "").trim();
                    addNormalText(doc, "\u2022 " + text);
                }
            }
            
            // Extract bảng kết quả đề xuất cấu hình
            java.util.regex.Pattern brokerPattern = java.util.regex.Pattern.compile(
                "Kafka Broker.*?<strong>(\\d+)</strong>.*?<strong>(\\d+)</strong>.*?<strong>(\\d+)\\s*GB</strong>.*?<strong>([^<]+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher brokerMatcher = brokerPattern.matcher(html);
            if (brokerMatcher.find()) {
                doc.createParagraph();
                addSubHeading2(doc, "K\u1ebft qu\u1ea3 \u0111\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable table = doc.createTable(3, 5);
                styleTable(table);
                
                setCell(table, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(table, 0, 1, "S\u1ed1 l\u01b0\u1ee3ng Node", true, "D9E2F3");
                setCell(table, 0, 2, "vCPU/Node", true, "D9E2F3");
                setCell(table, 0, 3, "RAM/Node", true, "D9E2F3");
                setCell(table, 0, 4, "Disk/Node", true, "D9E2F3");
                
                setCell(table, 1, 0, "Kafka Broker", true, "E6FFED");
                setCell(table, 1, 1, brokerMatcher.group(1), false, "E6FFED");
                setCell(table, 1, 2, brokerMatcher.group(2), false, "E6FFED");
                setCell(table, 1, 3, brokerMatcher.group(3) + " GB", false, "E6FFED");
                setCell(table, 1, 4, brokerMatcher.group(4), false, "E6FFED");
                
                setCell(table, 2, 0, "Zookeeper/KRaft", true, "FFF9E6");
                setCell(table, 2, 1, "3", false, "FFF9E6");
                setCell(table, 2, 2, "2", false, "FFF9E6");
                setCell(table, 2, 3, "4 GB", false, "FFF9E6");
                setCell(table, 2, 4, "100 GB", false, "FFF9E6");
                doc.createParagraph();
            }
            
            // Extract khuyến nghị
            java.util.regex.Pattern recPattern = java.util.regex.Pattern.compile(
                "Khuy\u1ebfn ngh\u1ecb.*?<p[^>]*>([^<]+)</p>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher recMatcher = recPattern.matcher(html);
            if (recMatcher.find()) {
                addNormalText(doc, "Khuy\u1ebfn ngh\u1ecb: " + recMatcher.group(1).trim());
            }
        } catch (Exception e) {
            // Fallback to plain text if parsing fails
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module K8S ----------
    private void writeModuleK8S(XWPFDocument doc, JsonNode moduleK8S) {
        if (moduleK8S.isMissingNode()) return;
        addSubHeading(doc, "5. Module K8S");

        // Baseline table
        JsonNode baselineTable = moduleK8S.path("baselineTable");
        if (baselineTable.isArray() && baselineTable.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin h\u1ec7 th\u1ed1ng tham chi\u1ebfu");

            int rows = baselineTable.size();
            XWPFTable table = doc.createTable(rows + 2, 6);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "CPU", true, "D9E2F3");
            setCell(table, 0, 3, "RAM\n(GB)", true, "D9E2F3");
            setCell(table, 0, 4, "DISK\n(GB)", true, "D9E2F3");
            setCell(table, 0, 5, "Cint_rate_2017", true, "D9E2F3");

            double totalRam = 0, totalDisk = 0, totalCint = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = baselineTable.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpu"), false, null);
                setCell(table, i + 1, 3, txt(r, "ram"), false, null);
                setCell(table, i + 1, 4, txt(r, "disk"), false, null);
                setCell(table, i + 1, 5, txt(r, "cintRate"), false, null);
                totalRam += toDouble(r, "ram");
                totalDisk += toDouble(r, "disk");
                totalCint += toDouble(r, "cintRate");
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, formatNum(totalRam), true, "E2EFDA");
            setCell(table, rows + 1, 4, formatNum(totalDisk), true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalCint), true, "E2EFDA");
            doc.createParagraph();
        }

        // Input config table
        JsonNode inputConfig = moduleK8S.path("inputConfigTable");
        if (inputConfig.isArray() && inputConfig.size() > 0) {
            addSubHeading2(doc, "Th\u00f4ng tin t\u1ea3i \u0111\u1ea7u v\u00e0o");

            int rows = inputConfig.size();
            XWPFTable table = doc.createTable(rows + 2, 8);
            styleTable(table);

            setCell(table, 0, 0, "STT", true, "D9E2F3");
            setCell(table, 0, 1, "IP", true, "D9E2F3");
            setCell(table, 0, 2, "T\u1ea3i CPU 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 3, "T\u1ea3i RAM 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 4, "T\u1ea3i DISK 95th\npercentile (%)", true, "D9E2F3");
            setCell(table, 0, 5, "Cint_rate used\n(Cint)", true, "D9E2F3");
            setCell(table, 0, 6, "RAM used\n(GB)", true, "D9E2F3");
            setCell(table, 0, 7, "DISK used\n(GB)", true, "D9E2F3");

            double totalCintUsed = 0, totalRamUsed = 0, totalDiskUsed = 0;
            for (int i = 0; i < rows; i++) {
                JsonNode r = inputConfig.get(i);
                setCell(table, i + 1, 0, String.valueOf(i + 1), false, null);
                setCell(table, i + 1, 1, txt(r, "ip"), false, null);
                setCell(table, i + 1, 2, txt(r, "cpuLoad"), false, null);
                setCell(table, i + 1, 3, txt(r, "ramLoad"), false, null);
                setCell(table, i + 1, 4, txt(r, "diskLoad"), false, null);
                setCell(table, i + 1, 5, txt(r, "cintUsed"), false, null);
                setCell(table, i + 1, 6, txt(r, "ramUsed"), false, null);
                setCell(table, i + 1, 7, txt(r, "diskUsed"), false, null);
                totalCintUsed += toDouble(r, "cintUsed");
                totalRamUsed += toDouble(r, "ramUsed");
                totalDiskUsed += toDouble(r, "diskUsed");
            }
            setCell(table, rows + 1, 0, "", true, "E2EFDA");
            setCell(table, rows + 1, 1, "T\u1ed5ng", true, "E2EFDA");
            setCell(table, rows + 1, 2, "", true, "E2EFDA");
            setCell(table, rows + 1, 3, "", true, "E2EFDA");
            setCell(table, rows + 1, 4, "", true, "E2EFDA");
            setCell(table, rows + 1, 5, formatNum(totalCintUsed), true, "E2EFDA");
            setCell(table, rows + 1, 6, formatNum(totalRamUsed), true, "E2EFDA");
            setCell(table, rows + 1, 7, formatNum(totalDiskUsed), true, "E2EFDA");
            doc.createParagraph();
        }

        // POC / Sizing
        String pocValue = txt(moduleK8S, "pocValue");
        String sizingValue = txt(moduleK8S, "sizingValue");
        if (!pocValue.isEmpty() || !sizingValue.isEmpty()) {
            addLabelValue(doc, "T\u1ea3i h\u1ec7 th\u1ed1ng POC:", pocValue);
            addLabelValue(doc, "\u0110\u1ecbnh c\u1ee1:", sizingValue);
        }

        // Sizing result
        String sizingResult = txt(moduleK8S, "sizingResult");
        if (!sizingResult.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteK8SResult(doc, sizingResult);
        }

        doc.createParagraph();
    }

    // Parse K8S result HTML and write to DOC
    private void parseAndWriteK8SResult(XWPFDocument doc, String html) {
        try {
            // Extract computation table rows
            java.util.regex.Pattern rowPattern = java.util.regex.Pattern.compile(
                "<tr>\\s*<td[^>]*>\\s*(\\d+)\\s*</td>\\s*<td>([^<]+)</td>\\s*<td[^>]*>([\\d.]+)</td>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher rowMatcher = rowPattern.matcher(html);

            java.util.List<String[]> tableData = new java.util.ArrayList<>();
            while (rowMatcher.find()) {
                tableData.add(new String[]{
                    rowMatcher.group(1).trim(),
                    rowMatcher.group(2).trim(),
                    rowMatcher.group(3).trim()
                });
            }

            if (!tableData.isEmpty()) {
                addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n K8S Worker");
                XWPFTable table = doc.createTable(tableData.size() + 1, 4);
                styleTable(table);

                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                setCell(table, 0, 2, "K8S Worker", true, "D9E2F3");
                setCell(table, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                String[] notes = {
                    "", "", "",
                    "KPI 75%. Sai s\u1ed1 1.1",
                    "KPI 90%. Sai s\u1ed1 1.1",
                    "KPI 80%. Sai s\u1ed1 1.1"
                };

                for (int i = 0; i < tableData.size(); i++) {
                    String[] row = tableData.get(i);
                    setCell(table, i + 1, 0, row[0], false, null);
                    setCell(table, i + 1, 1, row[1], false, null);
                    setCell(table, i + 1, 2, row[2], false, null);
                    setCell(table, i + 1, 3, i < notes.length ? notes[i] : "", false, null);
                }
                doc.createParagraph();
            }

            // Extract K8S config table (K8S Master, K8S Worker, K8S ETCD)
            java.util.regex.Pattern componentPattern = java.util.regex.Pattern.compile(
                "<strong>(K8S (?:Master|Worker|ETCD))</strong>.*?<ul[^>]*>(.*?)</ul>.*?<strong>(\\d+)</strong>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher componentMatcher = componentPattern.matcher(html);

            java.util.List<String[]> components = new java.util.ArrayList<>();
            while (componentMatcher.find()) {
                String name = componentMatcher.group(1);
                String listContent = componentMatcher.group(2);
                String qty = componentMatcher.group(3);

                // Extract config from <li> elements
                StringBuilder config = new StringBuilder();
                java.util.regex.Pattern liPattern = java.util.regex.Pattern.compile("<li>([^<]+)</li>");
                java.util.regex.Matcher liMatcher = liPattern.matcher(listContent);
                while (liMatcher.find()) {
                    if (config.length() > 0) config.append("\n");
                    config.append(liMatcher.group(1).trim());
                }

                String note = name.equals("K8S Worker") ? "D\u1ef1 ph\u00f2ng N+1" : "Storage ph\u1ea3i n\u1eb1m \u1edf 3 c\u1ee5m storage kh\u00e1c nhau";
                components.add(new String[]{name, config.toString(), qty, note});
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
                    String bgColor = comp[0].equals("K8S Worker") ? "E6FFED" : "FFF9E6";
                    setCell(configTable, i + 1, 0, comp[0], true, bgColor);
                    setCell(configTable, i + 1, 1, comp[1], false, bgColor);
                    setCell(configTable, i + 1, 2, comp[2], true, bgColor);
                    setCell(configTable, i + 1, 3, comp[3], false, bgColor);
                }
                doc.createParagraph();
            }
        } catch (Exception e) {
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
    }

    // ---------- Module LB/FW ----------
    private void writeModuleLBFW(XWPFDocument doc, JsonNode moduleLBFW) {
        if (moduleLBFW.isMissingNode()) return;
        addSubHeading(doc, "6. Module LB/FW");

        // Evidence images
        addImagesFromArray(doc, moduleLBFW.path("evidenceImages"));

        // Peak values
        String peakUpload = txt(moduleLBFW, "peakUpload");
        String peakDownload = txt(moduleLBFW, "peakDownload");
        if (!peakUpload.isEmpty() || !peakDownload.isEmpty()) {
            addSubHeading2(doc, "Th\u00f4ng tin b\u0103ng th\u00f4ng");
            addLabelValue(doc, "Peak Upload (Mbps):", peakUpload);
            addLabelValue(doc, "Peak Download (Mbps):", peakDownload);
        }

        // POC / Sizing
        String pocValue = txt(moduleLBFW, "pocValue");
        String sizingValue = txt(moduleLBFW, "sizingValue");
        if (!pocValue.isEmpty() || !sizingValue.isEmpty()) {
            addLabelValue(doc, "T\u1ea3i h\u1ec7 th\u1ed1ng POC:", pocValue);
            addLabelValue(doc, "\u0110\u1ecbnh c\u1ee1:", sizingValue);
        }

        // Sizing result
        String sizingResult = txt(moduleLBFW, "sizingResult");
        if (!sizingResult.isEmpty()) {
            addSubHeading2(doc, "K\u1ebft qu\u1ea3 t\u00ednh to\u00e1n:");
            parseAndWriteLBFWResult(doc, sizingResult);
        }

        doc.createParagraph();
    }

    // Parse LB/FW result HTML and write to DOC
    private void parseAndWriteLBFWResult(XWPFDocument doc, String html) {
        try {
            // Extract bandwidth table
            java.util.regex.Pattern rowPattern = java.util.regex.Pattern.compile(
                "<tr[^>]*>\\s*<td[^>]*>\\s*(\\d+)\\s*</td>\\s*<td>([^<]+)</td>\\s*<td[^>]*>([\\d.]+)</td>",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher rowMatcher = rowPattern.matcher(html);

            java.util.List<String[]> tableData = new java.util.ArrayList<>();
            while (rowMatcher.find()) {
                tableData.add(new String[]{
                    rowMatcher.group(1).trim(),
                    rowMatcher.group(2).trim(),
                    rowMatcher.group(3).trim()
                });
            }

            if (!tableData.isEmpty()) {
                addSubHeading2(doc, "B\u1ea3ng t\u00ednh to\u00e1n b\u0103ng th\u00f4ng");
                XWPFTable table = doc.createTable(tableData.size() + 1, 3);
                styleTable(table);

                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Th\u00f4ng s\u1ed1", true, "D9E2F3");
                setCell(table, 0, 2, "Gi\u00e1 tr\u1ecb (Mbps)", true, "D9E2F3");

                for (int i = 0; i < tableData.size(); i++) {
                    String[] row = tableData.get(i);
                    String bgColor = (i == tableData.size() - 1) ? "E6FFED" : null;
                    setCell(table, i + 1, 0, row[0], false, bgColor);
                    setCell(table, i + 1, 1, row[1], false, bgColor);
                    setCell(table, i + 1, 2, row[2], false, bgColor);
                }
                doc.createParagraph();
            }

            // Extract FW/LB config
            java.util.regex.Pattern fwlbPattern = java.util.regex.Pattern.compile(
                "FW/LB.*?Th\u00f4ng l\u01b0\u1ee3ng\\s*<\\s*([\\d.]+)\\s*Gbps",
                java.util.regex.Pattern.DOTALL
            );
            java.util.regex.Matcher fwlbMatcher = fwlbPattern.matcher(html);
            if (fwlbMatcher.find()) {
                addSubHeading2(doc, "\u0110\u1ec1 xu\u1ea5t c\u1ea5u h\u00ecnh");
                XWPFTable configTable = doc.createTable(2, 4);
                styleTable(configTable);

                setCell(configTable, 0, 0, "Th\u00e0nh ph\u1ea7n", true, "D9E2F3");
                setCell(configTable, 0, 1, "Th\u00f4ng l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(configTable, 0, 2, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(configTable, 0, 3, "Ghi ch\u00fa", true, "D9E2F3");

                setCell(configTable, 1, 0, "FW/LB", true, "E6FFED");
                setCell(configTable, 1, 1, "Th\u00f4ng l\u01b0\u1ee3ng < " + fwlbMatcher.group(1) + " Gbps", false, "E6FFED");
                setCell(configTable, 1, 2, "", false, "E6FFED");
                setCell(configTable, 1, 3, "", false, "E6FFED");
                doc.createParagraph();
            }
        } catch (Exception e) {
            String plainText = html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            if (!plainText.isEmpty()) addNormalText(doc, plainText);
        }
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

            if (!filteredRows.isEmpty()) {
                XWPFTable table = doc.createTable(filteredRows.size() + 1, 6);
                styleTable(table);

                setCell(table, 0, 0, "STT", true, "D9E2F3");
                setCell(table, 0, 1, "Lo\u1ea1i module", true, "D9E2F3");
                setCell(table, 0, 2, "T\u00ean module", true, "D9E2F3");
                setCell(table, 0, 3, "C\u1ea5u h\u00ecnh", true, "D9E2F3");
                setCell(table, 0, 4, "S\u1ed1 l\u01b0\u1ee3ng", true, "D9E2F3");
                setCell(table, 0, 5, "Ghi ch\u00fa", true, "D9E2F3");

                for (int i = 0; i < filteredRows.size(); i++) {
                    JsonNode r = filteredRows.get(i);
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
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingBefore(40);
        p.setSpacingAfter(40);

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

    private void addImagesFromArray(XWPFDocument doc, JsonNode imagesNode) {
        if (imagesNode == null || !imagesNode.isArray()) return;
        for (JsonNode img : imagesNode) {
            String base64 = "";
            if (img.has("base64")) base64 = img.get("base64").asText("");
            else if (img.has("dataUrl")) base64 = img.get("dataUrl").asText("");
            if (!base64.isEmpty()) addBase64Image(doc, base64);
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
}
