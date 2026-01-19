package com.example.demo.repository;

import com.example.demo.model.TongHop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TongHopRepository extends JpaRepository<TongHop, String> {
    List<TongHop> findBySystemInfoId(String systemInfoId);
}

