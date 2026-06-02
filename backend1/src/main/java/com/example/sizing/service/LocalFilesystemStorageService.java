package com.example.sizing.service;

import com.example.sizing.config.FileStorageProperties;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class LocalFilesystemStorageService implements FileStorageService {
    private final FileStorageProperties properties;

    public LocalFilesystemStorageService(FileStorageProperties properties) {
        this.properties = properties;
    }

    @Override
    public StoredFile store(String projectId,
                            String section,
                            String assetId,
                            String filename,
                            String contentType,
                            byte[] bytes) throws IOException {
        String extension = resolveExtension(filename, contentType);
        Path root = Paths.get(properties.getRoot()).toAbsolutePath().normalize();
        Path projectDir = root.resolve("projects").resolve(projectId).resolve(section).normalize();
        Files.createDirectories(projectDir);
        Path targetFile = projectDir.resolve(assetId + extension).normalize();
        if (!targetFile.startsWith(root)) {
            throw new IOException("Invalid storage path");
        }
        Files.write(targetFile, bytes);
        return new StoredFile(root.relativize(targetFile).toString().replace('\\', '/'), bytes.length);
    }

    @Override
    public byte[] readBytes(String storagePath) throws IOException {
        Path filePath = resolveStoragePath(storagePath);
        return Files.readAllBytes(filePath);
    }

    @Override
    public void delete(String storagePath) throws IOException {
        Path filePath = resolveStoragePath(storagePath);
        Files.deleteIfExists(filePath);
    }

    private Path resolveStoragePath(String storagePath) throws IOException {
        Path root = Paths.get(properties.getRoot()).toAbsolutePath().normalize();
        Path resolved = root.resolve(storagePath).normalize();
        if (!resolved.startsWith(root)) {
            throw new IOException("Invalid storage path");
        }
        return resolved;
    }

    private String resolveExtension(String filename, String contentType) {
        String lowerName = filename == null ? "" : filename.toLowerCase();
        int dotIndex = lowerName.lastIndexOf('.');
        if (dotIndex >= 0) {
            return lowerName.substring(dotIndex);
        }
        if ("image/png".equalsIgnoreCase(contentType)) {
            return ".png";
        }
        if ("image/webp".equalsIgnoreCase(contentType)) {
            return ".webp";
        }
        if ("image/gif".equalsIgnoreCase(contentType)) {
            return ".gif";
        }
        return ".jpg";
    }
}
