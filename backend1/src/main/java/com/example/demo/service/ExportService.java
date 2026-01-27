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

        ProjectData projectData = projectDataRepository.findByProjectId(projectId)
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + projectId));

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

        // Thông tin đầu vào table
        if (rootNode.has("thongTinDauVao") && rootNode.get("thongTinDauVao").isArray()) {
            List<Map<String, String>> items = objectMapper.readValue(
                    rootNode.get("thongTinDauVao").toString(),
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

        // Hệ thống tham chiếu
        if (rootNode.has("heThongThamChieu") && rootNode.get("heThongThamChieu").isArray()) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Thông tin Hệ thống tham chiếu");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            List<Map<String, Object>> items = objectMapper.readValue(
                    rootNode.get("heThongThamChieu").toString(),
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

        // Sở cứ thông tin đầu vào (images)
        if (rootNode.has("soCuThongTinDauVao") && rootNode.get("soCuThongTinDauVao").isArray()) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("Sở cứ giá trị định cỡ");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            List<Map<String, String>> images = objectMapper.readValue(
                    rootNode.get("soCuThongTinDauVao").toString(),
                    new TypeReference<List<Map<String, String>>>() {}
            );

            for (Map<String, String> img : images) {
                String imagePath = img.get("imagePath");
                if (imagePath != null && !imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
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

        // A. Mô hình Vật lý
        if (rootNode.has("moHinhVatLy")) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("A.\tMô hình Vật lý (Physical Architecture)");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            String imagePath = rootNode.get("moHinhVatLy").asText("");
            if (!imagePath.isEmpty()) {
                addImageToDocument(document, imagePath);
            }
            document.createParagraph();
        }

        // B. Mô hình Logic
        if (rootNode.has("moHinhLogic")) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("B.\tMô hình Logic (Logical Architecture)");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            String imagePath = rootNode.get("moHinhLogic").asText("");
            if (!imagePath.isEmpty()) {
                addImageToDocument(document, imagePath);
            }
            document.createParagraph();
        }

        // C. Luồng nghiệp vụ
        if (rootNode.has("luongNghiepVu") || rootNode.has("luongNghiepVuDescription")) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("C.\tLuồng nghiệp vụ (Business Flow)");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            if (rootNode.has("luongNghiepVu")) {
                String imagePath = rootNode.get("luongNghiepVu").asText("");
                if (!imagePath.isEmpty()) {
                    addImageToDocument(document, imagePath);
                }
            }

            if (rootNode.has("luongNghiepVuDescription")) {
                XWPFParagraph descPara = document.createParagraph();
                XWPFRun descRun = descPara.createRun();
                descRun.setText(rootNode.get("luongNghiepVuDescription").asText(""));
                descRun.setFontSize(13);
                descRun.setFontFamily("Times New Roman");
            }
            document.createParagraph();
        }

        // Chi tiết các zone mạng
        if (rootNode.has("chiTietZoneMang") && rootNode.get("chiTietZoneMang").isArray()) {
            XWPFParagraph subTitle = document.createParagraph();
            XWPFRun subRun = subTitle.createRun();
            subRun.setText("5.\tChi tiết các zone mạng, hệ điều hành, số lượng VIP");
            subRun.setBold(true);
            subRun.setFontSize(13);
            subRun.setFontFamily("Times New Roman");

            List<Map<String, Object>> items = objectMapper.readValue(
                    rootNode.get("chiTietZoneMang").toString(),
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

