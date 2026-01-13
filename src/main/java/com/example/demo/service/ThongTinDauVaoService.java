package com.example.demo.service;

import com.example.demo.dto.CreateThongTinDauVaoRequest;
import com.example.demo.model.ThongTinDauVao;
import com.example.demo.repository.ThongTinDauVaoRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ThongTinDauVaoService {
    private final ThongTinDauVaoRepository thongTinDauVaoRepository;

    public ThongTinDauVaoService(ThongTinDauVaoRepository thongTinDauVaoRepository) {
        this.thongTinDauVaoRepository = thongTinDauVaoRepository;
    }

    public ThongTinDauVao create(CreateThongTinDauVaoRequest request) {
        ThongTinDauVao entity = new ThongTinDauVao();
        entity.setDauVao(request.getDauVao());
        entity.setTaiHeThongPOC(request.getTaiHeThongPOC());
        entity.setDinhCo(request.getDinhCo());
        entity.setModule(request.getModule());
        entity.setGhiChu(request.getGhiChu());
        return thongTinDauVaoRepository.save(entity);
    }

    public List<ThongTinDauVao> getAll() {
        return thongTinDauVaoRepository.findAll();
    }

    /**
     * Thêm bảng Thông tin đầu vào vào document
     */
    public void addThongTinDauVaoTableToDocument(XWPFDocument document) {
        List<ThongTinDauVao> list = thongTinDauVaoRepository.findAll();

        // Title
        XWPFParagraph title = document.createParagraph();
        title.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun titleRun = title.createRun();
        titleRun.setText("2.\tThông tin đầu vào");
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Create table:
        XWPFTable table = document.createTable(list.size() + 1, 6);
        table.setWidth("100%");

        int sttWidth = (int) (0.5 * 1440);       // 0.5 inches
        int dauVaoWidth = (int) (2.0 * 1440);    // 2.0 inches
        int taiHeThongPOCWidth = (int) (1.2 * 1440);   // 1.2 inches
        int dinhCoWidth = (int) (1.0 * 1440);    // 1.0 inches
        int moduleWidth = (int) (0.5 * 1440);    // 0.5 inches
        int ghiChuWidth = (int) (1.3 * 1440);    // 1.3 inches

        for (int rowIdx = 0; rowIdx <= list.size(); rowIdx++) {
            XWPFTableRow tableRow = table.getRow(rowIdx);
            tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(sttWidth));
            tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(dauVaoWidth));
            tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(taiHeThongPOCWidth));
            tableRow.getCell(3).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(dinhCoWidth));
            tableRow.getCell(4).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(moduleWidth));
            tableRow.getCell(5).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(ghiChuWidth));
        }

        // Header row
        XWPFTableRow headerRow = table.getRow(0);
        setCellText(headerRow.getCell(0), "STT", true);
        setCellText(headerRow.getCell(1), "Đầu vào", true);
        setCellText(headerRow.getCell(2), "Tải Hệ thống POC", true);
        setCellText(headerRow.getCell(3), "Định cỡ", true);
        setCellText(headerRow.getCell(4), "Module", true);
        setCellText(headerRow.getCell(5), "Ghi chú", true);

        // Data rows
        for (int i = 0; i < list.size(); i++) {
            ThongTinDauVao item = list.get(i);
            XWPFTableRow row = table.getRow(i + 1);
            setCellText(row.getCell(0), String.valueOf(i + 1), false);
            setCellText(row.getCell(1), item.getDauVao() != null ? item.getDauVao() : "", false);
            setCellText(row.getCell(2), item.getTaiHeThongPOC() != null ? item.getTaiHeThongPOC() : "", false);
            setCellText(row.getCell(3), item.getDinhCo() != null ? item.getDinhCo() : "", false);
            setCellText(row.getCell(3), item.getModule() != null ? item.getModule() : "", false);
            setCellText(row.getCell(4), item.getGhiChu() != null ? item.getGhiChu() : "", false);
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
