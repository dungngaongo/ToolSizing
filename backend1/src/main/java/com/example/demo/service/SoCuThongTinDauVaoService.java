package com.example.demo.service;

import com.example.demo.dto.CreateSoCuThongTinDauVaoRequest;
import com.example.demo.model.SoCuThongTinDauVao;
import com.example.demo.repository.SoCuThongTinDauVaoRepository;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
public class SoCuThongTinDauVaoService {
    private final SoCuThongTinDauVaoRepository soCuThongTinDauVaoRepository;

    // Thư mục lưu ảnh
    private static final String UPLOAD_DIR = "uploads/so-cu-thong-tin-dau-vao";

    public SoCuThongTinDauVaoService(SoCuThongTinDauVaoRepository soCuThongTinDauVaoRepository) {
        this.soCuThongTinDauVaoRepository = soCuThongTinDauVaoRepository;
    }

    public SoCuThongTinDauVao create(CreateSoCuThongTinDauVaoRequest request) {
        SoCuThongTinDauVao entity = new SoCuThongTinDauVao();
        entity.setSystemInfoId(request.getSystemInfoId());
        entity.setImagePath(request.getImagePath());
        return soCuThongTinDauVaoRepository.save(entity);
    }

    /**
     * Upload ảnh và lưu vào database
     */
    public SoCuThongTinDauVao uploadImage(String systemInfoId, MultipartFile file) throws IOException {
        // Tạo thư mục nếu chưa tồn tại
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // Tạo tên file unique
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".png";
        String newFilename = UUID.randomUUID().toString() + extension;

        // Lưu file
        Path filePath = uploadPath.resolve(newFilename);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        // Lưu vào database
        SoCuThongTinDauVao entity = new SoCuThongTinDauVao();
        entity.setSystemInfoId(systemInfoId);
        entity.setImagePath(filePath.toString());
        return soCuThongTinDauVaoRepository.save(entity);
    }

    public List<SoCuThongTinDauVao> getAll() {
        return soCuThongTinDauVaoRepository.findAll();
    }

    public List<SoCuThongTinDauVao> getBySystemInfoId(String systemInfoId) {
        return soCuThongTinDauVaoRepository.findBySystemInfoId(systemInfoId);
    }

    public void deleteById(String id) {
        soCuThongTinDauVaoRepository.deleteById(id);
    }

    /**
     * Thêm ảnh sở cứ vào document
     */
    public void addSoCuImagesToDocument(XWPFDocument document, String systemInfoId) {
        List<SoCuThongTinDauVao> list = soCuThongTinDauVaoRepository.findBySystemInfoId(systemInfoId);

        if (!list.isEmpty()) {
            // Title
            XWPFParagraph title = document.createParagraph();
            title.setAlignment(ParagraphAlignment.LEFT);
            XWPFRun titleRun = title.createRun();
            titleRun.setText("Sở cứ thông tin đầu vào:");
            titleRun.setBold(true);
            titleRun.setFontSize(13);
            titleRun.setFontFamily("Times New Roman");

            document.createParagraph();

            // Add each image
            for (SoCuThongTinDauVao soCu : list) {
                try {
                    Path imagePath = Paths.get(soCu.getImagePath());
                    if (Files.exists(imagePath)) {
                        XWPFParagraph imageParagraph = document.createParagraph();
                        imageParagraph.setAlignment(ParagraphAlignment.CENTER);
                        XWPFRun imageRun = imageParagraph.createRun();

                        try (InputStream is = new FileInputStream(imagePath.toFile())) {
                            int pictureType = getPictureType(soCu.getImagePath());
                            // Kích thước ảnh: width 500px, height tự động theo tỷ lệ
                            imageRun.addPicture(is, pictureType, imagePath.getFileName().toString(),
                                    Units.toEMU(400), Units.toEMU(300));
                        }

                        document.createParagraph();
                    }
                } catch (Exception e) {
                    // Log error and continue
                    System.err.println("Error adding image: " + e.getMessage());
                }
            }
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
        return XWPFDocument.PICTURE_TYPE_PNG; // Default
    }
}

