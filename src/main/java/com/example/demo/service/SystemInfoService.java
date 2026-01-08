package com.example.demo.service;

import com.example.demo.dto.CreateSystemInfoRequest;
import com.example.demo.model.SystemInfo;
import com.example.demo.repository.SystemInfoRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SystemInfoService {
    private final SystemInfoRepository systemInfoRepository;

    public SystemInfoService(SystemInfoRepository systemInfoRepository) {
        this.systemInfoRepository = systemInfoRepository;
    }

    public SystemInfo createSystemInfo(CreateSystemInfoRequest request) {
        SystemInfo systemInfo = new SystemInfo();
        systemInfo.setDevUnit(request.getDevUnit());
        systemInfo.setProjectName(request.getProjectName());
        systemInfo.setSysFeature(request.getSysFeature());
        systemInfo.setContactPerson(request.getContactPerson());
        systemInfo.setSizingPurpose(request.getSizingPurpose());
        systemInfo.setSizingBasis(request.getSizingBasis());
        systemInfo.setSizingRule(request.getSizingRule());
        systemInfo.setImportance(request.getImportance());
        systemInfo.setDeploymentTime(request.getDeploymentTime());
        return systemInfoRepository.save(systemInfo);
    }

    public List<SystemInfo> getAllSystemInfo() {
        return systemInfoRepository.findAll();
    }
}

