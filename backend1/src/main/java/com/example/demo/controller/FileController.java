package com.example.demo.controller;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @GetMapping("/{folder}/{subfolder}/{filename}")
    public ResponseEntity<Resource> serveFile(
            @PathVariable String folder,
            @PathVariable String subfolder,
            @PathVariable String filename) {
        try {
            Path filePath = Paths.get(folder, subfolder, filename).toAbsolutePath();
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                String contentType = determineContentType(filename);
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/uploads/**")
    public ResponseEntity<Resource> serveUploadedFile(@RequestParam String path) {
        try {
            Path filePath = Paths.get(path).toAbsolutePath();
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                String contentType = determineContentType(path);
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filePath.getFileName() + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private String determineContentType(String filename) {
        String lowerCase = filename.toLowerCase();
        if (lowerCase.endsWith(".png")) {
            return "image/png";
        } else if (lowerCase.endsWith(".jpg") || lowerCase.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (lowerCase.endsWith(".gif")) {
            return "image/gif";
        } else if (lowerCase.endsWith(".bmp")) {
            return "image/bmp";
        } else if (lowerCase.endsWith(".webp")) {
            return "image/webp";
        }
        return "application/octet-stream";
    }
}
