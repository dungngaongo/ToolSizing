package com.example.demo.repository;

import com.example.demo.model.MoHinhHeThongImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MoHinhHeThongImageRepository extends JpaRepository<MoHinhHeThongImage, String> {
    Optional<MoHinhHeThongImage> findBySystemInfoId(String systemInfoId);
}

