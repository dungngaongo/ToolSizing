package com.example.demo.repository;

import com.example.demo.model.ThongTinDauVao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ThongTinDauVaoRepository extends JpaRepository<ThongTinDauVao, String> {
    List<ThongTinDauVao> findBySystemInfoId(String systemInfoId);
}

