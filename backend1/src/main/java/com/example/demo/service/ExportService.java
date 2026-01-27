package com.example.demo.service;

import com.example.demo.model.Project;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@Service
public class ExportService {
    private static final Logger log = LoggerFactory.getLogger(ExportService.class);

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
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));

        ProjectData projectData = projectDataRepository.findFirstByProjectId(projectId)
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + projectId));

        // Debug logging
        log.info("=== Export Debug for projectId: {} ===", projectId);
        log.info("yeuCauBaiToanContent: {}", projectData.getYeuCauBaiToanContent() != null ? "HAS DATA" : "NULL");
        log.info("thongTinDauVaoContent: {}", projectData.getThongTinDauVaoContent() != null ? "HAS DATA" : "NULL");
        log.info("moHinhHeThongContent: {}", projectData.getMoHinhHeThongContent() != null ? "HAS DATA" : "NULL");
        log.info("dinhCoHeThongContent: {}", projectData.getDinhCoHeThongContent() != null ? "HAS DATA" : "NULL");
        log.info("tongHopVaDeXuatContent: {}", projectData.getTongHopVaDeXuatContent() != null ? "HAS DATA" : "NULL");

        if (projectData.getThongTinDauVaoContent() != null) {
            log.info("thongTinDauVaoContent value: {}", projectData.getThongTinDauVaoContent());
        }

        XWPFDocument document = new XWPFDocument();

        // Add project title
        addProjectTitle(document, project.getName());

        // 1. Yêu cầu bài toán
        if (projectData.getYeuCauBaiToanContent() != null) {
            addYeuCauBaiToanSection(document, projectData.getYeuCauBaiToanContent());
        }

        // 2. Thông tin đầu vào
        if (projectData.getThongTinDauVaoContent() != null) {
            addThongTinDauVaoSection(document, projectData.getThongTinDauVaoContent());
        }

        // 3. Mô hình hệ thống
        if (projectData.getMoHinhHeThongContent() != null) {
            addMoHinhHeThongSection(document, projectData.getMoHinhHeThongContent());
        }

        // 4. Định cỡ hệ thống
        if (projectData.getDinhCoHeThongContent() != null) {
            addDinhCoHeThongSection(document, projectData.getDinhCoHeThongContent());
        }

        // 5. Tổng hợp và đề xuất
        if (projectData.getTongHopVaDeXuatContent() != null) {
            addTongHopVaDeXuatSection(document, projectData.getTongHopVaDeXuatContent());
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        document.write(out);
        document.close();

        return out.toByteArray();
    }

    private void addProjectTitle(XWPFDocument document, String projectName) {
        XWPFParagraph title = document.createParagraph();
        title.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun run = title.createRun();
        run.setText("BÁO CÁO ĐỊNH CỠ HỆ THỐNG");
        run.setBold(true);
        run.setFontSize(16);
        run.setFontFamily("Times New Roman");
        run.addBreak();

        XWPFRun projectRun = title.createRun();
        projectRun.setText("Dự án: " + projectName);
        projectRun.setFontSize(14);
        projectRun.setFontFamily("Times New Roman");

        document.createParagraph();
    }

    // 1. Yêu cầu bài toán (System Info)
    private void addYeuCauBaiToanSection(XWPFDocument document, String jsonContent) throws IOException {
        JsonNode node = objectMapper.readTree(jsonContent);

        // Section title
        XWPFParagraph sectionTitle = document.createParagraph();
        sectionTitle.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun titleRun = sectionTitle.createRun();
        titleRun.setText("I.\tYÊU CẦU BÀI TOÁN");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        // Sub title
        XWPFParagraph subTitle = document.createParagraph();
        XWPFRun subTitleRun = subTitle.createRun();
        subTitleRun.setText("1.\tThông tin hệ thống");
        subTitleRun.setBold(true);
        subTitleRun.setFontSize(13);
        subTitleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Create table
        String[][] fields = {
                {"devUnit", "Đơn vị phát triển"},
                {"projectName", "Tên dự án"},
                {"sysFeature", "Chức năng hệ thống"},
                {"contactPerson", "Người liên hệ"},
                {"sizingPurpose", "Mục đích định cỡ"},
                {"sizingBasis", "Căn cứ định cỡ"},
                {"sizingRule", "Quy tắc định cỡ"},
                {"importance", "Mức độ quan trọng"},
                {"deploymentTime", "Thời gian triển khai"}
        };

        XWPFTable table = document.createTable(fields.length + 1, 3);
        setTableWidths(table, new int[]{720, 2592, 0}); // 0.5, 1.8, remaining

        // Header
        XWPFTableRow headerRow = table.getRow(0);
        setCellText(headerRow.getCell(0), "STT", true);
        setCellText(headerRow.getCell(1), "Thông tin", true);
        setCellText(headerRow.getCell(2), "Chi tiết", true);

        // Data rows
        for (int i = 0; i < fields.length; i++) {
            XWPFTableRow row = table.getRow(i + 1);
            setCellText(row.getCell(0), String.valueOf(i + 1), false);
            setCellText(row.getCell(1), fields[i][1], false);
            String value = node.has(fields[i][0]) ? node.get(fields[i][0]).asText("") : "";
            setCellText(row.getCell(2), value, false);
        }

        document.createParagraph();
    }

    // 2. Thông tin đầu vào
    private void addThongTinDauVaoSection(XWPFDocument document, String jsonContent) throws IOException {
        JsonNode rootNode = objectMapper.readTree(jsonContent);

        // Section title
        XWPFParagraph sectionTitle = document.createParagraph();
        XWPFRun titleRun = sectionTitle.createRun();
        titleRun.setText("2.\tThông tin đầu vào");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Thông tin đầu vào table (support both "thongTinDauVao" and "inputRows")
        JsonNode inputNode = rootNode.has("inputRows") ? rootNode.get("inputRows") : rootNode.get("thongTinDauVao");
        if (inputNode != null && inputNode.isArray()) {
            List<Map<String, String>> items = objectMapper.readValue(
                    inputNode.toString(),
                    new TypeReference<List<Map<String, String>>>() {}
            );

            if (!items.isEmpty()) {
                XWPFTable table = document.createTable(items.size() + 1, 6);
                setTableWidths(table, new int[]{720, 2880, 1728, 1440, 720, 1872});

                XWPFTableRow headerRow = table.getRow(0);
                setCellText(headerRow.getCell(0), "STT", true);
                setCellText(headerRow.getCell(1), "Đầu vào", true);
                setCellText(headerRow.getCell(2), "Tải Hệ thống POC", true);
                setCellText(headerRow.getCell(3), "Định cỡ", true);
                setCellText(headerRow.getCell(4), "Module", true);
                setCellText(headerRow.getCell(5), "Ghi chú", true);

                for (int i = 0; i < items.size(); i++) {
                    Map<String, String> item = items.get(i);
                    XWPFTableRow row = table.getRow(i + 1);
                    setCellText(row.getCell(0), String.valueOf(i + 1), false);
                    setCellText(row.getCell(1), item.getOrDefault("dauVao", ""), false);
                    setCellText(row.getCell(2), item.getOrDefault("taiHeThongPOC", ""), false);
                    setCellText(row.getCell(3), item.getOrDefault("dinhCo", ""), false);
                    setCellText(row.getCell(4), item.getOrDefault("module", ""), false);
                    setCellText(row.getCell(5), item.getOrDefault("ghiChu", ""), false);
                }
                document.createParagraph();
            }
        }

        // Sở cứ đầu vào
        if (rootNode.has("soCuDauVao")) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ đầu vào:");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            String imagePath = rootNode.get("soCuDauVao").asText("");
            if (!imagePath.isEmpty()) {
                addImageToDocument(document, imagePath);
            }
            document.createParagraph();
        }

        // Sở cứ tải POC
        if (rootNode.has("soCuTaiPOC")) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ tải POC:");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            String imagePath = rootNode.get("soCuTaiPOC").asText("");
            if (!imagePath.isEmpty()) {
                addImageToDocument(document, imagePath);
            }
            document.createParagraph();
        }

        // Sở cứ định cỡ
        if (rootNode.has("soCuDinhCo")) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ định cỡ:");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            String imagePath = rootNode.get("soCuDinhCo").asText("");
            if (!imagePath.isEmpty()) {
                addImageToDocument(document, imagePath);
            }
            document.createParagraph();
        }

        // Input Evidence Images (support both "inputEvidenceImages" and "soCuThongTinDauVao")
        JsonNode inputEvidenceNode = rootNode.has("inputEvidenceImages") ? rootNode.get("inputEvidenceImages") : rootNode.get("soCuThongTinDauVao");
        if (inputEvidenceNode != null && inputEvidenceNode.isArray() && inputEvidenceNode.size() > 0) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ giá trị thông tin đầu vào");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            for (JsonNode imgNode : inputEvidenceNode) {
                // Support base64 images
                if (imgNode.has("base64")) {
                    String base64 = imgNode.get("base64").asText("");
                    if (!base64.isEmpty()) {
                        addBase64ImageToDocument(document, base64);
                    }
                }
                // Support file path images
                else if (imgNode.has("imagePath")) {
                    String imagePath = imgNode.get("imagePath").asText("");
                    if (!imagePath.isEmpty()) {
                        addImageToDocument(document, imagePath);
                    }
                }
            }
            document.createParagraph();
        }

        JsonNode pocEvidenceNode = rootNode.has("pocEvidenceImages") ? rootNode.get("pocEvidenceImages") : rootNode.get("soCuThongTinDauVao");
        if (pocEvidenceNode != null && pocEvidenceNode.isArray() && pocEvidenceNode.size() > 0) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ giá trị tải POC");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            for (JsonNode imgNode : pocEvidenceNode) {
                // Support base64 images
                if (imgNode.has("base64")) {
                    String base64 = imgNode.get("base64").asText("");
                    if (!base64.isEmpty()) {
                        addBase64ImageToDocument(document, base64);
                    }
                }
                // Support file path images
                else if (imgNode.has("imagePath")) {
                    String imagePath = imgNode.get("imagePath").asText("");
                    if (!imagePath.isEmpty()) {
                        addImageToDocument(document, imagePath);
                    }
                }
            }
            document.createParagraph();
        }

        JsonNode sizingEvidenceNode = rootNode.has("sizingEvidenceImages") ? rootNode.get("sizingEvidenceImages") : rootNode.get("soCuThongTinDauVao");
        if (sizingEvidenceNode != null && sizingEvidenceNode.isArray() && sizingEvidenceNode.size() > 0) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ giá trị định cỡ");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            for (JsonNode imgNode : sizingEvidenceNode) {
                // Support base64 images
                if (imgNode.has("base64")) {
                    String base64 = imgNode.get("base64").asText("");
                    if (!base64.isEmpty()) {
                        addBase64ImageToDocument(document, base64);
                    }
                }
                // Support file path images
                else if (imgNode.has("imagePath")) {
                    String imagePath = imgNode.get("imagePath").asText("");
                    if (!imagePath.isEmpty()) {
                        addImageToDocument(document, imagePath);
                    }
                }
            }
            document.createParagraph();
        }

        // Hệ thống tham chiếu (support both "baselineRows" and "heThongThamChieu")
        JsonNode baselineNode = rootNode.has("baselineRows") ? rootNode.get("baselineRows") : rootNode.get("heThongThamChieu");
        if (baselineNode != null && baselineNode.isArray()) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Thông tin Hệ thống tham chiếu");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            List<Map<String, Object>> items = objectMapper.readValue(
                    baselineNode.toString(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            if (!items.isEmpty()) {
                XWPFTable table = document.createTable(items.size() + 2, 5);

                XWPFTableRow headerRow = table.getRow(0);
                setCellText(headerRow.getCell(0), "STT", true);
                setCellText(headerRow.getCell(1), "Module", true);
                setCellText(headerRow.getCell(2), "IP", true);
                setCellText(headerRow.getCell(3), "CPU/RAM", true);
                setCellText(headerRow.getCell(4), "CINT Rate 2017", true);

                double totalRam = 0;
                double totalCintRate = 0;

                for (int i = 0; i < items.size(); i++) {
                    Map<String, Object> item = items.get(i);
                    XWPFTableRow row = table.getRow(i + 1);
                    setCellText(row.getCell(0), String.valueOf(i + 1), false);
                    setCellText(row.getCell(1), String.valueOf(item.getOrDefault("module", "")), false);
                    setCellText(row.getCell(2), String.valueOf(item.getOrDefault("ip", "")), false);

                    Object ramObj = item.getOrDefault("ram", 0);
                    double ram = ramObj instanceof Number ? ((Number) ramObj).doubleValue() : 0;
                    totalRam += ram;

                    String cpuRam = item.getOrDefault("cpu", "") + "/" + ram;
                    setCellText(row.getCell(3), cpuRam, false);

                    Object cintObj = item.getOrDefault("cintRate2017", 0);
                    double cintRate = cintObj instanceof Number ? ((Number) cintObj).doubleValue() : 0;
                    totalCintRate += cintRate;
                    setCellText(row.getCell(4), String.valueOf(cintRate), false);
                }

                // Total row
                XWPFTableRow totalRow = table.getRow(items.size() + 1);
                setCellText(totalRow.getCell(0), "", true);
                setCellText(totalRow.getCell(1), "Tổng", true);
                setCellText(totalRow.getCell(2), "", true);
                setCellText(totalRow.getCell(3), String.valueOf(totalRam), true);
                setCellText(totalRow.getCell(4), String.valueOf(totalCintRate), true);

                document.createParagraph();
            }
        }

        JsonNode evidenceNode = rootNode.has("evidenceImages") ? rootNode.get("evidenceImages") : rootNode.get("soCuThongTinDauVao");
        if (evidenceNode != null && evidenceNode.isArray() && evidenceNode.size() > 0) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ thông tin hệ thống tham chiếu");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            for (JsonNode imgNode : evidenceNode) {
                // Support base64 images
                if (imgNode.has("base64")) {
                    String base64 = imgNode.get("base64").asText("");
                    if (!base64.isEmpty()) {
                        addBase64ImageToDocument(document, base64);
                    }
                }
                // Support file path images
                else if (imgNode.has("imagePath")) {
                    String imagePath = imgNode.get("imagePath").asText("");
                    if (!imagePath.isEmpty()) {
                        addImageToDocument(document, imagePath);
                    }
                }
            }
            document.createParagraph();
        }
    }

    // 3. Mô hình hệ thống
    private void addMoHinhHeThongSection(XWPFDocument document, String jsonContent) throws IOException {
        JsonNode rootNode = objectMapper.readTree(jsonContent);

        // Section title
        XWPFParagraph sectionTitle = document.createParagraph();
        XWPFRun titleRun = sectionTitle.createRun();
        titleRun.setText("II.\tMÔ HÌNH HỆ THỐNG");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // A. Mô hình Vật lý (support both "physicalImages" and "moHinhVatLy")
        JsonNode physicalNode = rootNode.has("physicalImages") ? rootNode.get("physicalImages") : rootNode.get("moHinhVatLy");
        if (physicalNode != null) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("A.\tMô hình Vật lý (Physical Architecture)");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            // If it's an array of images
            if (physicalNode.isArray()) {
                for (JsonNode imgNode : physicalNode) {
                    if (imgNode.has("base64")) {
                        String base64 = imgNode.get("base64").asText("");
                        if (!base64.isEmpty()) {
                            addBase64ImageToDocument(document, base64);
                        }
                    } else if (imgNode.has("imagePath")) {
                        String imagePath = imgNode.get("imagePath").asText("");
                        if (!imagePath.isEmpty()) {
                            addImageToDocument(document, imagePath);
                        }
                    }
                }
            }
            // If it's a single image path string
            else if (physicalNode.isTextual()) {
                String imagePath = physicalNode.asText("");
                if (!imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
                }
            }
            document.createParagraph();
        }

        // B. Mô hình Logic (support both "logicalImages" and "moHinhLogic")
        JsonNode logicalNode = rootNode.has("logicalImages") ? rootNode.get("logicalImages") : rootNode.get("moHinhLogic");
        if (logicalNode != null) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("B.\tMô hình Logic (Logical Architecture)");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            // If it's an array of images
            if (logicalNode.isArray()) {
                for (JsonNode imgNode : logicalNode) {
                    if (imgNode.has("base64")) {
                        String base64 = imgNode.get("base64").asText("");
                        if (!base64.isEmpty()) {
                            addBase64ImageToDocument(document, base64);
                        }
                    } else if (imgNode.has("imagePath")) {
                        String imagePath = imgNode.get("imagePath").asText("");
                        if (!imagePath.isEmpty()) {
                            addImageToDocument(document, imagePath);
                        }
                    }
                }
            }
            // If it's a single image path string
            else if (logicalNode.isTextual()) {
                String imagePath = logicalNode.asText("");
                if (!imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
                }
            }
            document.createParagraph();
        }

        // C. Luồng nghiệp vụ (support both "flowImages"/"flowExplanation" and "luongNghiepVu"/"luongNghiepVuDescription")
        JsonNode flowImagesNode = rootNode.has("flowImages") ? rootNode.get("flowImages") : rootNode.get("luongNghiepVu");
        String flowExplanation = rootNode.has("flowExplanation") ? rootNode.get("flowExplanation").asText("") :
                                 (rootNode.has("luongNghiepVuDescription") ? rootNode.get("luongNghiepVuDescription").asText("") : "");

        if (flowImagesNode != null || !flowExplanation.isEmpty()) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("C.\tLuồng nghiệp vụ (Business Flow)");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            // Add flow images
            if (flowImagesNode != null) {
                if (flowImagesNode.isArray()) {
                    for (JsonNode imgNode : flowImagesNode) {
                        if (imgNode.has("base64")) {
                            String base64 = imgNode.get("base64").asText("");
                            if (!base64.isEmpty()) {
                                addBase64ImageToDocument(document, base64);
                            }
                        } else if (imgNode.has("imagePath")) {
                            String imagePath = imgNode.get("imagePath").asText("");
                            if (!imagePath.isEmpty()) {
                                addImageToDocument(document, imagePath);
                            }
                        }
                    }
                } else if (flowImagesNode.isTextual()) {
                    String imagePath = flowImagesNode.asText("");
                    if (!imagePath.isEmpty()) {
                        addImageToDocument(document, imagePath);
                    }
                }
            }

            // Add flow explanation/description
            if (!flowExplanation.isEmpty()) {
                XWPFParagraph descPara = document.createParagraph();
                XWPFRun descRun = descPara.createRun();
                descRun.setText(flowExplanation);
                descRun.setFontSize(13);
                descRun.setFontFamily("Times New Roman");
            }
            document.createParagraph();
        }

        // Chi tiết các zone mạng (support both "archRows" and "chiTietZoneMang")
        JsonNode archNode = rootNode.has("archRows") ? rootNode.get("archRows") : rootNode.get("chiTietZoneMang");
        if (archNode != null && archNode.isArray()) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("5.\tChi tiết các zone mạng, hệ điều hành, số lượng VIP");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            List<Map<String, Object>> items = objectMapper.readValue(
                    archNode.toString(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            if (!items.isEmpty()) {
                XWPFTable table = document.createTable(items.size() + 1, 5);

                XWPFTableRow headerRow = table.getRow(0);
                setCellText(headerRow.getCell(0), "STT", true);
                setCellText(headerRow.getCell(1), "Module", true);
                setCellText(headerRow.getCell(2), "Zone mạng", true);
                setCellText(headerRow.getCell(3), "Hệ điều hành", true);
                setCellText(headerRow.getCell(4), "Số lượng VIP", true);

                for (int i = 0; i < items.size(); i++) {
                    Map<String, Object> item = items.get(i);
                    XWPFTableRow row = table.getRow(i + 1);
                    setCellText(row.getCell(0), String.valueOf(i + 1), false);
                    setCellText(row.getCell(1), String.valueOf(item.getOrDefault("module", "")), false);
                    setCellText(row.getCell(2), String.valueOf(item.getOrDefault("zoneMang", "")), false);
                    setCellText(row.getCell(3), String.valueOf(item.getOrDefault("heDieuHanh", "")), false);
                    setCellText(row.getCell(4), String.valueOf(item.getOrDefault("soLuongVIP", "")), false);
                }
            }
            document.createParagraph();
        }
    }

    // 4. Định cỡ hệ thống
    private void addDinhCoHeThongSection(XWPFDocument document, String jsonContent) throws IOException {
        JsonNode rootNode = objectMapper.readTree(jsonContent);

        // Section title
        XWPFParagraph sectionTitle = document.createParagraph();
        XWPFRun titleRun = sectionTitle.createRun();
        titleRun.setText("III.\tĐỊNH CỠ HỆ THỐNG");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Module Redis
        if (rootNode.has("redis")) {
            JsonNode redisNode = rootNode.get("redis");

            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("1.\tModule Redis");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            // Mô hình logic
            if (redisNode.has("moHinhLogic")) {
                addLabelAndValue(document, "Mô hình logic:", "");
                String imagePath = redisNode.get("moHinhLogic").asText("");
                if (!imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
                }
            }

            // Mô tả module Redis
            if (redisNode.has("moTa")) {
                addLabelAndValue(document, "Mô tả module Redis:", redisNode.get("moTa").asText(""));
            }

            // Mục đích sử dụng
            if (redisNode.has("mucDich")) {
                addLabelAndValue(document, "Mục đích sử dụng:", redisNode.get("mucDich").asText(""));
            }

            // Tổng lượng Key dự kiến (A)
            if (redisNode.has("key")) {
                addLabelAndValue(document, "Tổng lượng Key dự kiến (A):", String.valueOf(redisNode.get("key").asLong(0)));
            }
            if (redisNode.has("keyImg")) {
                String imagePath = redisNode.get("keyImg").asText("");
                if (!imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
                }
            }

            // Kích thước trung bình 1 bản ghi (KB) (B)
            if (redisNode.has("avgSize")) {
                addLabelAndValue(document, "Kích thước trung bình 1 bản ghi (KB) (B):", String.valueOf(redisNode.get("avgSize").asDouble(0)));
            }
            if (redisNode.has("avgSizeImg")) {
                String imagePath = redisNode.get("avgSizeImg").asText("");
                if (!imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
                }
            }

            // Cấu hình Cluster
            XWPFParagraph clusterTitle = document.createParagraph();
            XWPFRun clusterRun = clusterTitle.createRun();
            clusterRun.setText("Cấu hình Cluster:");
            clusterRun.setBold(true);
            clusterRun.setFontSize(13);
            clusterRun.setFontFamily("Times New Roman");

            if (redisNode.has("importance")) {
                addLabelAndValue(document, "- Mức độ quan trọng của hệ thống:", redisNode.get("importance").asText(""));
            }
            if (redisNode.has("masterNumber")) {
                addLabelAndValue(document, "- Số lượng Shard/Master dự kiến:", String.valueOf(redisNode.get("masterNumber").asInt(0)));
            }

            // Tổng dung lượng Key (C)
            if (redisNode.has("sumC")) {
                addLabelAndValue(document, "Tổng dung lượng Key (C):", redisNode.get("sumC").asText(""));
            }

            // Đề xuất mô hình
            if (redisNode.has("deXuat")) {
                addLabelAndValue(document, "Đề xuất mô hình:", redisNode.get("deXuat").asText(""));
            }

            // Cấu hình Node chi tiết (table)
            XWPFParagraph nodeTitle = document.createParagraph();
            XWPFRun nodeRun = nodeTitle.createRun();
            nodeRun.setText("Cấu hình Node chi tiết:");
            nodeRun.setBold(true);
            nodeRun.setFontSize(13);
            nodeRun.setFontFamily("Times New Roman");

            XWPFTable table = document.createTable(2, 3);
            XWPFTableRow headerRow = table.getRow(0);
            setCellText(headerRow.getCell(0), "vCPU", true);
            setCellText(headerRow.getCell(1), "RAM", true);
            setCellText(headerRow.getCell(2), "Disk", true);

            XWPFTableRow dataRow = table.getRow(1);
            setCellText(dataRow.getCell(0), String.valueOf(redisNode.has("vCpu") ? redisNode.get("vCpu").asInt(0) : ""), false);
            setCellText(dataRow.getCell(1), String.valueOf(redisNode.has("ram") ? redisNode.get("ram").asInt(0) : ""), false);
            setCellText(dataRow.getCell(2), redisNode.has("disk") ? redisNode.get("disk").asText("") : "", false);

            document.createParagraph();
        }
    }

    // 5. Tổng hợp và đề xuất
    private void addTongHopVaDeXuatSection(XWPFDocument document, String jsonContent) throws IOException {
        JsonNode rootNode = objectMapper.readTree(jsonContent);

        // Section title
        XWPFParagraph sectionTitle = document.createParagraph();
        XWPFRun titleRun = sectionTitle.createRun();
        titleRun.setText("IV.\tTỔNG HỢP VÀ ĐỀ XUẤT");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        if (rootNode.has("tongHop") && rootNode.get("tongHop").isArray()) {
            List<Map<String, Object>> items = objectMapper.readValue(
                    rootNode.get("tongHop").toString(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            if (!items.isEmpty()) {
                XWPFTable table = document.createTable(items.size() + 1, 6);

                XWPFTableRow headerRow = table.getRow(0);
                setCellText(headerRow.getCell(0), "STT", true);
                setCellText(headerRow.getCell(1), "Module", true);
                setCellText(headerRow.getCell(2), "Số lượng", true);
                setCellText(headerRow.getCell(3), "vCPU", true);
                setCellText(headerRow.getCell(4), "RAM", true);
                setCellText(headerRow.getCell(5), "Volume", true);

                for (int i = 0; i < items.size(); i++) {
                    Map<String, Object> item = items.get(i);
                    XWPFTableRow row = table.getRow(i + 1);
                    setCellText(row.getCell(0), String.valueOf(i + 1), false);
                    setCellText(row.getCell(1), String.valueOf(item.getOrDefault("module", "")), false);
                    setCellText(row.getCell(2), String.valueOf(item.getOrDefault("soLuong", "")), false);
                    setCellText(row.getCell(3), String.valueOf(item.getOrDefault("vCPU", "")), false);
                    setCellText(row.getCell(4), String.valueOf(item.getOrDefault("ram", "")), false);
                    setCellText(row.getCell(5), String.valueOf(item.getOrDefault("volume", "")), false);
                }
            }
        }

        document.createParagraph();
    }

    // Helper methods
    private void setCellText(XWPFTableCell cell, String text, boolean bold) {
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
        cell.removeParagraph(0);
        XWPFParagraph paragraph = cell.addParagraph();
        paragraph.setAlignment(ParagraphAlignment.LEFT);
        paragraph.setIndentationLeft(100);

        XWPFRun run = paragraph.createRun();
        run.setText(text);
        run.setBold(bold);
        run.setFontSize(13);
        run.setFontFamily("Times New Roman");
    }

    private void setTableWidths(XWPFTable table, int[] widths) {
        for (int rowIdx = 0; rowIdx < table.getNumberOfRows(); rowIdx++) {
            XWPFTableRow row = table.getRow(rowIdx);
            for (int colIdx = 0; colIdx < widths.length && colIdx < row.getTableCells().size(); colIdx++) {
                if (widths[colIdx] > 0) {
                    row.getCell(colIdx).getCTTc().addNewTcPr().addNewTcW()
                            .setW(java.math.BigInteger.valueOf(widths[colIdx]));
                }
            }
        }
    }

    private void addLabelAndValue(XWPFDocument document, String label, String value) {
        XWPFParagraph para = document.createParagraph();
        XWPFRun labelRun = para.createRun();
        labelRun.setText(label + " ");
        labelRun.setBold(true);
        labelRun.setFontSize(13);
        labelRun.setFontFamily("Times New Roman");

        XWPFRun valueRun = para.createRun();
        valueRun.setText(value);
        valueRun.setFontSize(13);
        valueRun.setFontFamily("Times New Roman");
    }

    private void addImageToDocument(XWPFDocument document, String imagePath) {
        try {
            Path path = Paths.get(imagePath);
            if (!Files.exists(path)) {
                return;
            }

            XWPFParagraph imagePara = document.createParagraph();
            imagePara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun imageRun = imagePara.createRun();

            try (FileInputStream fis = new FileInputStream(path.toFile())) {
                int pictureType = getPictureType(imagePath);
                imageRun.addPicture(fis, pictureType, path.getFileName().toString(),
                        Units.toEMU(400), Units.toEMU(300));
            }
        } catch (Exception e) {
            // Log error but continue processing
            System.err.println("Failed to add image: " + imagePath + " - " + e.getMessage());
        }
    }

    private void addBase64ImageToDocument(XWPFDocument document, String base64String) {
        try {
            // Remove data URL prefix if present (e.g., "data:image/png;base64,")
            String base64Data = base64String;
            int pictureType = XWPFDocument.PICTURE_TYPE_PNG; // default

            if (base64String.contains(",")) {
                String[] parts = base64String.split(",");
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

            byte[] imageBytes = java.util.Base64.getDecoder().decode(base64Data);

            XWPFParagraph imagePara = document.createParagraph();
            imagePara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun imageRun = imagePara.createRun();

            try (java.io.ByteArrayInputStream bis = new java.io.ByteArrayInputStream(imageBytes)) {
                imageRun.addPicture(bis, pictureType, "image",
                        Units.toEMU(400), Units.toEMU(300));
            }
        } catch (Exception e) {
            // Log error but continue processing
            System.err.println("Failed to add base64 image: " + e.getMessage());
        }
    }

    private int getPictureType(String imagePath) {
        String lowerPath = imagePath.toLowerCase();
        if (lowerPath.endsWith(".png")) {
            return XWPFDocument.PICTURE_TYPE_PNG;
        } else if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
            return XWPFDocument.PICTURE_TYPE_JPEG;
        } else if (lowerPath.endsWith(".gif")) {
            return XWPFDocument.PICTURE_TYPE_GIF;
        } else if (lowerPath.endsWith(".bmp")) {
            return XWPFDocument.PICTURE_TYPE_BMP;
        }
        return XWPFDocument.PICTURE_TYPE_PNG;
    }
}

