package com.example.demo.service;

import com.example.demo.dto.CreateHeThongThamChieuRequest;
import com.example.demo.model.HeThongThamChieu;
import com.example.demo.repository.HeThongThamChieuRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HeThongThamChieuService {
    private final HeThongThamChieuRepository heThongThamChieuRepository;

    public HeThongThamChieuService(HeThongThamChieuRepository heThongThamChieuRepository) {
        this.heThongThamChieuRepository = heThongThamChieuRepository;
    }

    public HeThongThamChieu create(CreateHeThongThamChieuRequest request) {
        HeThongThamChieu entity = new HeThongThamChieu();
        entity.setSystemInfoId(request.getSystemInfoId());
        entity.setModule(request.getModule());
        entity.setIp(request.getIp());
        entity.setCpu(request.getCpu());
        entity.setRam(request.getRam());
        entity.setCintRate2017(request.getCintRate2017());
        return heThongThamChieuRepository.save(entity);
    }

    public List<HeThongThamChieu> getAll() {
        return heThongThamChieuRepository.findAll();
    }

    public List<HeThongThamChieu> getBySystemInfoId(String systemInfoId) {
        return heThongThamChieuRepository.findBySystemInfoId(systemInfoId);
    }

    /**
     * Thêm bảng Hệ thống tham chiếu vào document theo systemInfoId
     */
    public void addHeThongThamChieuTableToDocument(XWPFDocument document, String systemInfoId) {
        List<HeThongThamChieu> list = heThongThamChieuRepository.findBySystemInfoId(systemInfoId);

        // Title
        XWPFParagraph title = document.createParagraph();
        title.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun titleRun = title.createRun();
        titleRun.setText("3.\tHệ thống tham chiếu");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Create table: data rows + 1 header + 1 total row
        XWPFTable table = document.createTable(list.size() + 2, 6);
        table.setWidth("100%");

        int sttWidth = (int) (0.5 * 1440);       // 0.5 inches
        int moduleWidth = (int) (1.5 * 1440);    // 1.5 inches
        int ipWidth = (int) (1.5 * 1440);        // 1.5 inches
        int cpuWidth = (int) (1.0 * 1440);       // 1.0 inches
        int ramWidth = (int) (1.0 * 1440);       // 1.0 inches
        int cintWidth = (int) (1.0 * 1440);      // 1.0 inches

        for (int rowIdx = 0; rowIdx <= list.size() + 1; rowIdx++) {
            XWPFTableRow tableRow = table.getRow(rowIdx);
            tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(sttWidth));
            tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(moduleWidth));
            tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(ipWidth));
            tableRow.getCell(3).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(cpuWidth));
            tableRow.getCell(4).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(ramWidth));
            tableRow.getCell(5).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(cintWidth));
        }

        // Header row
        XWPFTableRow headerRow = table.getRow(0);
        setCellText(headerRow.getCell(0), "STT", true);
        setCellText(headerRow.getCell(1), "Module", true);
        setCellText(headerRow.getCell(2), "IP", true);
        setCellText(headerRow.getCell(3), "CPU", true);
        setCellText(headerRow.getCell(4), "RAM", true);
        setCellText(headerRow.getCell(5), "CintRate2017", true);

        // Data rows
        double totalRam = 0;
        double totalCintRate2017 = 0;

        for (int i = 0; i < list.size(); i++) {
            HeThongThamChieu item = list.get(i);
            XWPFTableRow row = table.getRow(i + 1);
            setCellText(row.getCell(0), String.valueOf(i + 1), false);
            setCellText(row.getCell(1), item.getModule() != null ? item.getModule() : "", false);
            setCellText(row.getCell(2), item.getIp() != null ? item.getIp() : "", false);
            setCellText(row.getCell(3), item.getCpu() != null ? item.getCpu() : "", false);
            setCellText(row.getCell(4), item.getRam() != null ? String.valueOf(item.getRam()) : "", false);
            setCellText(row.getCell(5), item.getCintRate2017() != null ? String.valueOf(item.getCintRate2017()) : "", false);

            // Tính tổng
            if (item.getRam() != null) {
                totalRam += item.getRam();
            }
            if (item.getCintRate2017() != null) {
                totalCintRate2017 += item.getCintRate2017();
            }
        }

        // Total row
        XWPFTableRow totalRow = table.getRow(list.size() + 1);
        setCellText(totalRow.getCell(0), "", true);
        setCellText(totalRow.getCell(1), "Tổng", true);
        setCellText(totalRow.getCell(2), "", true);
        setCellText(totalRow.getCell(3), "", true);
        setCellText(totalRow.getCell(4), String.valueOf(totalRam), true);
        setCellText(totalRow.getCell(5), String.valueOf(totalCintRate2017), true);

        document.createParagraph();
    }

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
}

