package com.example.demo.service;

import com.example.demo.dto.CreateMoHinhHeThongRequest;
import com.example.demo.model.MoHinhHeThong;
import com.example.demo.repository.MoHinhHeThongRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MoHinhHeThongService {
    private final MoHinhHeThongRepository moHinhHeThongRepository;

    public MoHinhHeThongService(MoHinhHeThongRepository moHinhHeThongRepository) {
        this.moHinhHeThongRepository = moHinhHeThongRepository;
    }

    public MoHinhHeThong create(CreateMoHinhHeThongRequest request) {
        MoHinhHeThong entity = new MoHinhHeThong();
        entity.setSystemInfoId(request.getSystemInfoId());
        entity.setModule(request.getModule());
        entity.setZoneMang(request.getZoneMang());
        entity.setHeDieuHanh(request.getHeDieuHanh());
        entity.setSoLuongVIP(request.getSoLuongVIP());
        return moHinhHeThongRepository.save(entity);
    }

    public List<MoHinhHeThong> getAll() {
        return moHinhHeThongRepository.findAll();
    }

    public List<MoHinhHeThong> getBySystemInfoId(String systemInfoId) {
        return moHinhHeThongRepository.findBySystemInfoId(systemInfoId);
    }

    /**
     * Thêm bảng Chi tiết các zone mạng vào document
     * 5. Chi tiết các zone mạng, hệ điều hành, số lượng VIP
     */
    public void addMoHinhHeThongTableToDocument(XWPFDocument document, String systemInfoId) {
        List<MoHinhHeThong> list = moHinhHeThongRepository.findBySystemInfoId(systemInfoId);

        // Title
        XWPFParagraph title = document.createParagraph();
        title.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun titleRun = title.createRun();
        titleRun.setText("5.\tChi tiết các zone mạng, hệ điều hành, số lượng VIP");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Create table
        XWPFTable table = document.createTable(list.size() + 1, 5);
        table.setWidth("100%");

        int sttWidth = (int) (0.5 * 1440);
        int moduleWidth = (int) (2.0 * 1440);
        int zoneMangWidth = (int) (1.5 * 1440);
        int heDieuHanhWidth = (int) (1.5 * 1440);
        int soLuongVIPWidth = (int) (1.0 * 1440);

        for (int rowIdx = 0; rowIdx <= list.size(); rowIdx++) {
            XWPFTableRow tableRow = table.getRow(rowIdx);
            tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(sttWidth));
            tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(moduleWidth));
            tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(zoneMangWidth));
            tableRow.getCell(3).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(heDieuHanhWidth));
            tableRow.getCell(4).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(soLuongVIPWidth));
        }

        // Header row
        XWPFTableRow headerRow = table.getRow(0);
        setCellText(headerRow.getCell(0), "STT", true);
        setCellText(headerRow.getCell(1), "Module", true);
        setCellText(headerRow.getCell(2), "Zone mạng", true);
        setCellText(headerRow.getCell(3), "Hệ điều hành", true);
        setCellText(headerRow.getCell(4), "Số lượng VIP", true);

        // Data rows
        for (int i = 0; i < list.size(); i++) {
            MoHinhHeThong item = list.get(i);
            XWPFTableRow row = table.getRow(i + 1);
            setCellText(row.getCell(0), String.valueOf(i + 1), false);
            setCellText(row.getCell(1), item.getModule() != null ? item.getModule() : "", false);
            setCellText(row.getCell(2), item.getZoneMang() != null ? item.getZoneMang() : "", false);
            setCellText(row.getCell(3), item.getHeDieuHanh() != null ? item.getHeDieuHanh() : "", false);
            setCellText(row.getCell(4), item.getSoLuongVIP() != null ? String.valueOf(item.getSoLuongVIP()) : "", false);
        }

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

