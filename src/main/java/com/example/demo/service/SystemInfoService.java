package com.example.demo.service;

import com.example.demo.dto.CreateSystemInfoRequest;
import com.example.demo.model.SystemInfo;
import com.example.demo.repository.SystemInfoRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SystemInfoService {
    private final SystemInfoRepository systemInfoRepository;
    private final ThongTinDauVaoService thongTinDauVaoService;

    public SystemInfoService(SystemInfoRepository systemInfoRepository, ThongTinDauVaoService thongTinDauVaoService) {
        this.systemInfoRepository = systemInfoRepository;
        this.thongTinDauVaoService = thongTinDauVaoService;
    }

    public SystemInfo createSystemInfo(CreateSystemInfoRequest request) {
        SystemInfo systemInfo = new SystemInfo();
        systemInfo.setDevUnit(request.getDevUnit());
        systemInfo.setProjectName(request.getProjectName());
        systemInfo.setSysFeature(request.getSysFeature());
        systemInfo.setContactPerson(request.getContactPerson());
        systemInfo.setSizingPurpose(request.getSizingPurpose());
        systemInfo.setSizingBasis(request.getSizingBasis());
        systemInfo.setSizingRule(request.getSizingRule());
        systemInfo.setImportance(request.getImportance());
        systemInfo.setDeploymentTime(request.getDeploymentTime());
        return systemInfoRepository.save(systemInfo);
    }

    public List<SystemInfo> getAllSystemInfo() {
        return systemInfoRepository.findAll();
    }

    /**
     * Export System Info to DOCX file
     */
    public byte[] exportToDocx() throws IOException {
        try (XWPFDocument document = new XWPFDocument()) {
            addSystemInfoTableToDocument(document);
            thongTinDauVaoService.addThongTinDauVaoTableToDocument(document);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            document.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    /**
     * Thêm bảng System Info vào document
     */
    public void addSystemInfoTableToDocument(XWPFDocument document) {
        List<SystemInfo> systemInfoList = systemInfoRepository.findAll();

        if (!systemInfoList.isEmpty()) {
            // Title for System Info
            XWPFParagraph sysInfoTitle = document.createParagraph();
            sysInfoTitle.setAlignment(ParagraphAlignment.LEFT);
            XWPFRun sysInfoTitleRun = sysInfoTitle.createRun();
            sysInfoTitleRun.setText("I.\tYÊU CẦU BÀI TOÁN");
            sysInfoTitleRun.addBreak();
            sysInfoTitleRun.setText("1.\tThông tin hệ thống");
            sysInfoTitleRun.setBold(true);
            sysInfoTitleRun.setFontSize(13);
            sysInfoTitleRun.setFontFamily("Times New Roman");

            document.createParagraph();

            // Create System Info table for each record
            for (SystemInfo sysInfo : systemInfoList) {
                Map<String, String> fields = getSystemInfoFields(sysInfo);

                XWPFTable sysTable = document.createTable(fields.size() + 1, 3);
                sysTable.setWidth("100%");

                // Set column widths: STT 0.5 inches, Thông tin 1.8 inches, Chi tiết còn lại
                // 1 inch = 1440 twips
                int sttWidth = (int) (0.5 * 1440);      // 720 twips
                int thongTinWidth = (int) (1.8 * 1440); // 2592 twips
                int chiTietWidth = (int) (4.2 * 1440);  // Còn lại khoảng 4.2 inches

                for (int rowIdx = 0; rowIdx <= fields.size(); rowIdx++) {
                    XWPFTableRow tableRow = sysTable.getRow(rowIdx);
                    tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(sttWidth));
                    tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(thongTinWidth));
                    tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(chiTietWidth));
                }

                // Header row
                XWPFTableRow sysHeaderRow = sysTable.getRow(0);
                setCellText(sysHeaderRow.getCell(0), "STT", true);
                setCellText(sysHeaderRow.getCell(1), "Thông tin", true);
                setCellText(sysHeaderRow.getCell(2), "Chi tiết", true);

                // Data rows
                int stt = 1;
                for (Map.Entry<String, String> entry : fields.entrySet()) {
                    XWPFTableRow row = sysTable.getRow(stt);
                    setCellText(row.getCell(0), String.valueOf(stt), false);
                    setCellText(row.getCell(1), entry.getKey(), false);
                    setCellText(row.getCell(2), entry.getValue(), false);
                    stt++;
                }

                document.createParagraph();
            }
        }
    }

    private Map<String, String> getSystemInfoFields(SystemInfo sysInfo) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Đơn vị phát triển", sysInfo.getDevUnit() != null ? sysInfo.getDevUnit() : "");
        fields.put("Tên dự án", sysInfo.getProjectName() != null ? sysInfo.getProjectName() : "");
        fields.put("Chức năng hệ thống", sysInfo.getSysFeature() != null ? sysInfo.getSysFeature() : "");
        fields.put("Đầu mối định cỡ", sysInfo.getContactPerson() != null ? sysInfo.getContactPerson() : "");
        fields.put("Mục đích định cỡ", sysInfo.getSizingPurpose() != null ? sysInfo.getSizingPurpose() : "");
        fields.put("Cơ sở định cỡ", sysInfo.getSizingBasis() != null ? sysInfo.getSizingBasis() : "");
        fields.put("Nguyên tắc định cỡ", sysInfo.getSizingRule() != null ? sysInfo.getSizingRule() : "");
        fields.put("Mức độ quan trọng của hệ thống", sysInfo.getImportance() != null ? sysInfo.getImportance() : "");
        fields.put("Thời gian triển khai", sysInfo.getDeploymentTime() != null ?
                sysInfo.getDeploymentTime().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "");
        return fields;
    }

    private void setCellText(XWPFTableCell cell, String text, boolean bold) {
        // Căn giữa theo chiều dọc
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);

        cell.removeParagraph(0);
        XWPFParagraph paragraph = cell.addParagraph();
        paragraph.setAlignment(ParagraphAlignment.LEFT);

        // Thêm margin trái 100 twips (khoảng 0.18cm)
        paragraph.setIndentationLeft(100);

        XWPFRun run = paragraph.createRun();
        run.setText(text);
        run.setBold(bold);
        run.setFontSize(13);
        run.setFontFamily("Times New Roman");
    }
}

