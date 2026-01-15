package com.example.demo.service;

import com.example.demo.dto.CreateMoHinhHeThongImageRequest;
import com.example.demo.model.MoHinhHeThongImage;
import com.example.demo.repository.MoHinhHeThongImageRepository;
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
import java.util.Optional;
import java.util.UUID;

@Service
public class MoHinhHeThongImageService {
    private final MoHinhHeThongImageRepository moHinhHeThongImageRepository;

    private static final String UPLOAD_DIR = "uploads/mo-hinh-he-thong";

    public MoHinhHeThongImageService(MoHinhHeThongImageRepository moHinhHeThongImageRepository) {
        this.moHinhHeThongImageRepository = moHinhHeThongImageRepository;
    }

    public MoHinhHeThongImage create(CreateMoHinhHeThongImageRequest request) {
        MoHinhHeThongImage entity = new MoHinhHeThongImage();
        entity.setSystemInfoId(request.getSystemInfoId());
        entity.setLuongNghiepVuDescription(request.getLuongNghiepVuDescription());
        return moHinhHeThongImageRepository.save(entity);
    }

    public Optional<MoHinhHeThongImage> getBySystemInfoId(String systemInfoId) {
        return moHinhHeThongImageRepository.findBySystemInfoId(systemInfoId);
    }

    public List<MoHinhHeThongImage> getAll() {
        return moHinhHeThongImageRepository.findAll();
    }

    public MoHinhHeThongImage uploadMoHinhVatLy(String systemInfoId, MultipartFile file) throws IOException {
        MoHinhHeThongImage entity = getOrCreate(systemInfoId);
        String filePath = saveFile(file, "vat-ly");
        entity.setMoHinhVatLy(filePath);
        return moHinhHeThongImageRepository.save(entity);
    }

    public MoHinhHeThongImage uploadMoHinhLogic(String systemInfoId, MultipartFile file) throws IOException {
        MoHinhHeThongImage entity = getOrCreate(systemInfoId);
        String filePath = saveFile(file, "logic");
        entity.setMoHinhLogic(filePath);
        return moHinhHeThongImageRepository.save(entity);
    }

    public MoHinhHeThongImage uploadLuongNghiepVu(String systemInfoId, MultipartFile file) throws IOException {
        MoHinhHeThongImage entity = getOrCreate(systemInfoId);
        String filePath = saveFile(file, "luong-nghiep-vu");
        entity.setLuongNghiepVu(filePath);
        return moHinhHeThongImageRepository.save(entity);
    }

    public MoHinhHeThongImage updateLuongNghiepVuDescription(String systemInfoId, String description) {
        MoHinhHeThongImage entity = getOrCreate(systemInfoId);
        entity.setLuongNghiepVuDescription(description);
        return moHinhHeThongImageRepository.save(entity);
    }

    private MoHinhHeThongImage getOrCreate(String systemInfoId) {
        return moHinhHeThongImageRepository.findBySystemInfoId(systemInfoId)
                .orElseGet(() -> {
                    MoHinhHeThongImage newEntity = new MoHinhHeThongImage();
                    newEntity.setSystemInfoId(systemInfoId);
                    return newEntity;
                });
    }

    private String saveFile(MultipartFile file, String prefix) throws IOException {
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

    public void addMoHinhHeThongImageToDocument(XWPFDocument document, String systemInfoId) {
        Optional<MoHinhHeThongImage> optEntity = moHinhHeThongImageRepository.findBySystemInfoId(systemInfoId);

        XWPFParagraph mainTitle = document.createParagraph();
        mainTitle.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun mainTitleRun = mainTitle.createRun();
        mainTitleRun.setText("4.\tMo hinh he thong");
        mainTitleRun.setBold(true);
        mainTitleRun.setFontSize(13);
        mainTitleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        if (optEntity.isPresent()) {
            MoHinhHeThongImage entity = optEntity.get();

            addImageSection(document, "A. Mo hinh Vat ly (Physical Architecture)", entity.getMoHinhVatLy(), null);
            addImageSection(document, "B. Mo hinh Logic (Logical Architecture)", entity.getMoHinhLogic(), null);
            addImageSection(document, "C. Luong nghiep vu (Business Flow)", entity.getLuongNghiepVu(), entity.getLuongNghiepVuDescription());
        }
    }

    private void addImageSection(XWPFDocument document, String title, String imagePath, String description) {
        XWPFParagraph titlePara = document.createParagraph();
        titlePara.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun titleRun = titlePara.createRun();
        titleRun.setText(title);
        titleRun.setBold(true);
        titleRun.setFontSize(13);
        titleRun.setFontFamily("Times New Roman");

        document.createParagraph();

        if (imagePath != null && !imagePath.isEmpty()) {
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

        if (description != null && !description.isEmpty()) {
            document.createParagraph();
            XWPFParagraph descPara = document.createParagraph();
            descPara.setAlignment(ParagraphAlignment.LEFT);
            XWPFRun descRun = descPara.createRun();
            descRun.setText(description);
            descRun.setFontSize(13);
            descRun.setFontFamily("Times New Roman");
        }

        document.createParagraph();
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
