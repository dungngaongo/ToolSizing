package com.example.demo.service;

import com.example.demo.dto.CreateTongHopRequest;
import com.example.demo.model.TongHop;
import com.example.demo.repository.TongHopRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TongHopService {
    private final TongHopRepository tongHopRepository;

    public TongHopService(TongHopRepository tongHopRepository) {
        this.tongHopRepository = tongHopRepository;
    }

    public TongHop create(CreateTongHopRequest request) {
        TongHop entity = new TongHop();
        entity.setSystemInfoId(request.getSystemInfoId());
        entity.setModule(request.getModule());
        entity.setSoLuong(request.getSoLuong());
        entity.setVCPU(request.getVCPU());
        entity.setRam(request.getRam());
        entity.setVolume(request.getVolume());
        entity.setGhiChu(request.getGhiChu());
        return tongHopRepository.save(entity);
    }

    public List<TongHop> getAll() {
        return tongHopRepository.findAll();
    }

    public List<TongHop> getBySystemInfoId(String systemInfoId) {
        return tongHopRepository.findBySystemInfoId(systemInfoId);
    }

    /**
     * Thêm bảng Tổng hợp và đề xuất vào document theo systemInfoId
     */
    public void addTongHopTableToDocument(XWPFDocument document, String systemInfoId) {
        List<TongHop> list = tongHopRepository.findBySystemInfoId(systemInfoId);

        // Title
        XWPFParagraph title = document.createParagraph();
        title.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun titleRun = title.createRun();
        titleRun.setText("5.\tTổng hợp và đề xuất");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Create table: data rows + 1 header + 1 total row
        XWPFTable table = document.createTable(list.size() + 2, 7);
        table.setWidth("100%");

        int sttWidth = (int) (0.5 * 1440);       // 0.5 inches
        int moduleWidth = (int) (1.5 * 1440);    // 1.5 inches
        int soLuongWidth = (int) (0.8 * 1440);   // 0.8 inches
        int vCPUWidth = (int) (0.8 * 1440);      // 0.8 inches
        int ramWidth = (int) (0.8 * 1440);       // 0.8 inches
        int volumeWidth = (int) (1.0 * 1440);    // 1.0 inches
        int ghiChuWidth = (int) (1.1 * 1440);    // 1.1 inches

        for (int rowIdx = 0; rowIdx <= list.size() + 1; rowIdx++) {
            XWPFTableRow tableRow = table.getRow(rowIdx);
            tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(sttWidth));
            tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(moduleWidth));
            tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(soLuongWidth));
            tableRow.getCell(3).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(vCPUWidth));
            tableRow.getCell(4).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(ramWidth));
            tableRow.getCell(5).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(volumeWidth));
            tableRow.getCell(6).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(ghiChuWidth));
        }

        // Header row
        XWPFTableRow headerRow = table.getRow(0);
        setCellText(headerRow.getCell(0), "STT", true);
        setCellText(headerRow.getCell(1), "Module", true);
        setCellText(headerRow.getCell(2), "Số lượng", true);
        setCellText(headerRow.getCell(3), "vCPU", true);
        setCellText(headerRow.getCell(4), "RAM", true);
        setCellText(headerRow.getCell(5), "Volume", true);
        setCellText(headerRow.getCell(6), "Ghi chú", true);

        // Data rows
        int totalSoLuong = 0;
        int totalVCPU = 0;
        double totalRam = 0;

        for (int i = 0; i < list.size(); i++) {
            TongHop item = list.get(i);
            XWPFTableRow row = table.getRow(i + 1);
            setCellText(row.getCell(0), String.valueOf(i + 1), false);
            setCellText(row.getCell(1), item.getModule() != null ? item.getModule() : "", false);
            setCellText(row.getCell(2), item.getSoLuong() != null ? String.valueOf(item.getSoLuong()) : "", false);
            setCellText(row.getCell(3), item.getVCPU() != null ? String.valueOf(item.getVCPU()) : "", false);
            setCellText(row.getCell(4), item.getRam() != null ? String.valueOf(item.getRam()) : "", false);
            setCellText(row.getCell(5), item.getVolume() != null ? item.getVolume() : "", false);
            setCellText(row.getCell(6), item.getGhiChu() != null ? item.getGhiChu() : "", false);

            // Tính tổng
            if (item.getSoLuong() != null) {
                totalSoLuong += item.getSoLuong();
            }
            if (item.getVCPU() != null) {
                totalVCPU += item.getVCPU();
            }
            if (item.getRam() != null) {
                totalRam += item.getRam();
            }
        }

        // Total row
        XWPFTableRow totalRow = table.getRow(list.size() + 1);
        setCellText(totalRow.getCell(0), "", true);
        setCellText(totalRow.getCell(1), "Tổng", true);
        setCellText(totalRow.getCell(2), String.valueOf(totalSoLuong), true);
        setCellText(totalRow.getCell(3), String.valueOf(totalVCPU), true);
        setCellText(totalRow.getCell(4), String.valueOf(totalRam), true);
        setCellText(totalRow.getCell(5), "", true);
        setCellText(totalRow.getCell(6), "", true);

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

