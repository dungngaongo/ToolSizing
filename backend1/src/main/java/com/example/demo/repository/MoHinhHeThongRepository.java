package com.example.demo.repository;

import com.example.demo.model.MoHinhHeThong;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MoHinhHeThongRepository extends JpaRepository<MoHinhHeThong, String> {
    List<MoHinhHeThong> findBySystemInfoId(String systemInfoId);
}

