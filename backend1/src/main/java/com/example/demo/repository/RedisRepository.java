package com.example.demo.repository;

import com.example.demo.model.Redis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RedisRepository extends JpaRepository<Redis, String> {
    Optional<Redis> findBySystemInfoId(String systemInfoId);
}
