package com.example.demo.service;

import com.example.demo.dto.CreateRedisRequest;
import com.example.demo.model.Redis;
import com.example.demo.repository.RedisRepository;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RedisService {
    private final RedisRepository redisRepository;

    private static final String UPLOAD_DIR = "uploads/redis";

    public RedisService(RedisRepository redisRepository) {
        this.redisRepository = redisRepository;
    }

    public Redis create(CreateRedisRequest request) {
        Redis entity = getOrCreate(request.getSystemInfoId());
        entity.setMoTa(request.getMoTa());
        entity.setMucDich(request.getMucDich());
        entity.setKeyNumber(request.getKeyNumber());
        entity.setAvgSize(request.getAvgSize());
        entity.setImportance(request.getImportance());
        entity.setMasterNumber(request.getMasterNumber());
        entity.setSumC(request.getSumC());
        entity.setDeXuat(request.getDeXuat());
        entity.setVCpu(request.getVCpu());
        entity.setRam(request.getRam());
        entity.setDisk(request.getDisk());
        return redisRepository.save(entity);
    }

    public Optional<Redis> getBySystemInfoId(String systemInfoId) {
        return redisRepository.findBySystemInfoId(systemInfoId);
    }

    public List<Redis> getAll() {
        return redisRepository.findAll();
    }

    public Redis uploadMoHinhLogic(String systemInfoId, MultipartFile file) throws Exception {
        Redis entity = getOrCreate(systemInfoId);
        String filePath = saveFile(file, "mo-hinh-logic");
        entity.setMoHinhLogic(filePath);
        return redisRepository.save(entity);
    }

    public Redis uploadKeyImg(String systemInfoId, MultipartFile file) throws Exception {
        Redis entity = getOrCreate(systemInfoId);
        String filePath = saveFile(file, "key-img");
        entity.setKeyImg(filePath);
        return redisRepository.save(entity);
    }

    public Redis uploadAvgSizeImg(String systemInfoId, MultipartFile file) throws Exception {
        Redis entity = getOrCreate(systemInfoId);
        String filePath = saveFile(file, "avg-size-img");
        entity.setAvgSizeImg(filePath);
        return redisRepository.save(entity);
    }

    private Redis getOrCreate(String systemInfoId) {
        return redisRepository.findBySystemInfoId(systemInfoId)
                .orElseGet(() -> {
                    Redis newEntity = new Redis();
                    newEntity.setSystemInfoId(systemInfoId);
                    return newEntity;
                });
    }

    private String saveFile(MultipartFile file, String prefix) throws Exception {
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".png";
        String newFilename = prefix + "-" + UUID.randomUUID().toString() + extension;

        Path filePath = uploadPath.resolve(newFilename);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        return filePath.toString();
    }

    public void addRedisToDocument(XWPFDocument document, String systemInfoId) {
        Optional<Redis> optEntity = redisRepository.findBySystemInfoId(systemInfoId);

        // Main title
        XWPFParagraph mainTitle = document.createParagraph();
        mainTitle.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun mainTitleRun = mainTitle.createRun();
        mainTitleRun.setText("1.\tModule Redis");
        mainTitleRun.setBold(true);
        mainTitleRun.setFontSize(13);
        mainTitleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        if (optEntity.isPresent()) {
            Redis entity = optEntity.get();

            // Mô hình logic
            addLabelWithImage(document, "Mô hình logic:", entity.getMoHinhLogic());

            // Mô tả module Redis
            addLabelWithText(document, "Mô tả module Redis:", entity.getMoTa());

            // Mục đích sử dụng
            addLabelWithText(document, "Mục đích sử dụng:", entity.getMucDich());

            // Tổng lượng Key dự kiến (A)
            addLabelWithValue(document, "Tổng lượng Key dự kiến (A):",
                    entity.getKeyNumber() != null ? String.valueOf(entity.getKeyNumber()) : "");
            if (entity.getKeyImg() != null) {
                addImage(document, entity.getKeyImg());
            }

            // Kích thước trung bình 1 bản ghi (KB) (B)
            addLabelWithValue(document, "Kích thước trung bình 1 bản ghi (KB) (B):",
                    entity.getAvgSize() != null ? String.valueOf(entity.getAvgSize()) : "");
            if (entity.getAvgSizeImg() != null) {
                addImage(document, entity.getAvgSizeImg());
            }

            // Cấu hình Cluster
            addBoldLabel(document, "Cấu hình Cluster:");

            // - Mức độ quan trọng của hệ thống
            addLabelWithValue(document, "- Mức độ quan trọng của hệ thống:",
                    entity.getImportance() != null ? entity.getImportance() : "");

            // - Số lượng Shard/Master dự kiến
            addLabelWithValue(document, "- Số lượng Shard/Master dự kiến:",
                    entity.getMasterNumber() != null ? String.valueOf(entity.getMasterNumber()) : "");

            // Tổng dung lượng Key (C)
            addLabelWithValue(document, "Tổng dung lượng Key (C):",
                    entity.getSumC() != null ? entity.getSumC() : "");

            // Đề xuất mô hình
            addLabelWithText(document, "Đề xuất mô hình:", entity.getDeXuat());

            // Cấu hình Node chi tiết - Table
            addNodeConfigTable(document, entity);
        }

        document.createParagraph();
    }

    private void addLabelWithImage(XWPFDocument document, String label, String imagePath) {
        XWPFParagraph labelPara = document.createParagraph();
        labelPara.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun labelRun = labelPara.createRun();
        labelRun.setText(label);
        labelRun.setBold(true);
        labelRun.setFontSize(13);
        labelRun.setFontFamily("Times New Roman");

        if (imagePath != null && !imagePath.isEmpty()) {
            addImage(document, imagePath);
        }
        document.createParagraph();
    }

    private void addLabelWithText(XWPFDocument document, String label, String text) {
        XWPFParagraph para = document.createParagraph();
        para.setAlignment(ParagraphAlignment.LEFT);

        XWPFRun labelRun = para.createRun();
        labelRun.setText(label + " ");
        labelRun.setBold(true);
        labelRun.setFontSize(13);
        labelRun.setFontFamily("Times New Roman");

        XWPFRun textRun = para.createRun();
        textRun.setText(text != null ? text : "");
        textRun.setFontSize(13);
        textRun.setFontFamily("Times New Roman");

        document.createParagraph();
    }

    private void addLabelWithValue(XWPFDocument document, String label, String value) {
        XWPFParagraph para = document.createParagraph();
        para.setAlignment(ParagraphAlignment.LEFT);

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

    private void addBoldLabel(XWPFDocument document, String label) {
        XWPFParagraph para = document.createParagraph();
        para.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun run = para.createRun();
        run.setText(label);
        run.setBold(true);
        run.setFontSize(13);
        run.setFontFamily("Times New Roman");
    }

    private void addImage(XWPFDocument document, String imagePath) {
        try {
            Path path = Paths.get(imagePath);
            if (Files.exists(path)) {
                XWPFParagraph imageParagraph = document.createParagraph();
                imageParagraph.setAlignment(ParagraphAlignment.CENTER);
                XWPFRun imageRun = imageParagraph.createRun();

                try (InputStream is = new FileInputStream(path.toFile())) {
                    int pictureType = getPictureType(imagePath);
                    imageRun.addPicture(is, pictureType, path.getFileName().toString(),
                            Units.toEMU(450), Units.toEMU(300));
                }
            }
        } catch (Exception e) {
            System.err.println("Error adding image: " + e.getMessage());
        }
    }

    private void addNodeConfigTable(XWPFDocument document, Redis entity) {
        // Title for table
        XWPFParagraph tableTitlePara = document.createParagraph();
        tableTitlePara.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun tableTitleRun = tableTitlePara.createRun();
        tableTitleRun.setText("Cấu hình Node chi tiết:");
        tableTitleRun.setBold(true);
        tableTitleRun.setFontSize(13);
        tableTitleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        // Create table with 2 rows (header + data) and 3 columns
        XWPFTable table = document.createTable(2, 3);
        table.setWidth("100%");

        // Set column widths
        int vCpuWidth = (int) (1.5 * 1440);
        int ramWidth = (int) (1.5 * 1440);
        int diskWidth = (int) (2.0 * 1440);

        for (int rowIdx = 0; rowIdx < 2; rowIdx++) {
            XWPFTableRow tableRow = table.getRow(rowIdx);
            tableRow.getCell(0).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(vCpuWidth));
            tableRow.getCell(1).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(ramWidth));
            tableRow.getCell(2).getCTTc().addNewTcPr().addNewTcW().setW(java.math.BigInteger.valueOf(diskWidth));
        }

        // Header row
        XWPFTableRow headerRow = table.getRow(0);
        setCellText(headerRow.getCell(0), "vCPU", true);
        setCellText(headerRow.getCell(1), "RAM", true);
        setCellText(headerRow.getCell(2), "Disk", true);

        // Data row
        XWPFTableRow dataRow = table.getRow(1);
        setCellText(dataRow.getCell(0), entity.getVCpu() != null ? String.valueOf(entity.getVCpu()) : "", false);
        setCellText(dataRow.getCell(1), entity.getRam() != null ? String.valueOf(entity.getRam()) : "", false);
        setCellText(dataRow.getCell(2), entity.getDisk() != null ? entity.getDisk() : "", false);
    }

    private void setCellText(XWPFTableCell cell, String text, boolean bold) {
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);

        cell.removeParagraph(0);
        XWPFParagraph paragraph = cell.addParagraph();
        paragraph.setAlignment(ParagraphAlignment.CENTER);
        paragraph.setIndentationLeft(100);

        XWPFRun run = paragraph.createRun();
        run.setText(text);
        run.setBold(bold);
        run.setFontSize(13);
        run.setFontFamily("Times New Roman");
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
