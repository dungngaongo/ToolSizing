package com.example.sizing.service;

import java.io.IOException;

public interface FileStorageService {
    StoredFile store(String projectId,
                     String section,
                     String assetId,
                     String filename,
                     String contentType,
                     byte[] bytes) throws IOException;

    byte[] readBytes(String storagePath) throws IOException;

    void delete(String storagePath) throws IOException;

    record StoredFile(String storagePath, long sizeBytes) {
    }
}
