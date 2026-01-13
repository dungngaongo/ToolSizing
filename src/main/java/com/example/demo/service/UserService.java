package com.example.demo.service;

import com.example.demo.dto.CreateUserRequest;
import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final SystemInfoService systemInfoService;

    public UserService(UserRepository userRepository, SystemInfoService systemInfoService) {
        this.userRepository = userRepository;
        this.systemInfoService = systemInfoService;
    }

    public User createUser(CreateUserRequest request) {
        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        return userRepository.save(user);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public byte[] exportUsersToDocx() throws IOException {
        List<User> users = getAllUsers();

        try (XWPFDocument document = new XWPFDocument()) {
            // ========== SYSTEM INFO TABLE ==========
            systemInfoService.addSystemInfoTableToDocument(document);

            // ========== USER TABLE ==========
            // Title for Users
            XWPFParagraph title = document.createParagraph();
            title.setAlignment(ParagraphAlignment.LEFT);
            XWPFRun titleRun = title.createRun();
            titleRun.setText("Danh sách người dùng");
            titleRun.setBold(true);
            titleRun.setFontSize(13);
            titleRun.setFontFamily("Times New Roman");

            document.createParagraph();

            // Create table with 3 columns: STT, Tên, Email
            XWPFTable table = document.createTable(users.size() + 1, 3);
            table.setWidth("100%");

            // Set column widths: STT 0.5 inches, Tên 1.8 inches, Email còn lại
            int sttWidthUser = (int) (0.5 * 1440);
            int tenWidth = (int) (1.8 * 1440);
            int emailWidth = (int) (4.2 * 1440);

            for (int rowIdx = 0; rowIdx <= users.size(); rowIdx++) {
                XWPFTableRow tableRow = table.getRow(rowIdx);
                tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(sttWidthUser));
                tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(tenWidth));
                tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(emailWidth));
            }

            // Style header row
            XWPFTableRow headerRow = table.getRow(0);
            setCellText(headerRow.getCell(0), "STT", true);
            setCellText(headerRow.getCell(1), "Tên", true);
            setCellText(headerRow.getCell(2), "Email", true);

            // Add data rows
            for (int i = 0; i < users.size(); i++) {
                User user = users.get(i);
                XWPFTableRow row = table.getRow(i + 1);
                setCellText(row.getCell(0), String.valueOf(i + 1), false);
                setCellText(row.getCell(1), user.getName(), false);
                setCellText(row.getCell(2), user.getEmail(), false);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            document.write(outputStream);
            return outputStream.toByteArray();
        }
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

