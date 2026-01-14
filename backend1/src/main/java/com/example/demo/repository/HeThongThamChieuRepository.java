package com.example.demo.repository;

import com.example.demo.model.HeThongThamChieu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HeThongThamChieuRepository extends JpaRepository<HeThongThamChieu, String> {
    List<HeThongThamChieu> findBySystemInfoId(String systemInfoId);
}

