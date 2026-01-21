package com.example.demo.service;

import com.example.demo.dto.CreateProjectDataRequest;
import com.example.demo.dto.UpdateProjectDataRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectDataService {
    private final ProjectDataRepository projectDataRepository;

    public ProjectDataService(ProjectDataRepository projectDataRepository) {
        this.projectDataRepository = projectDataRepository;
    }

    public ProjectData create(CreateProjectDataRequest request) {
        ProjectData projectData = new ProjectData();
        projectData.setProjectId(request.getProjectId());
        projectData.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
        projectData.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
        projectData.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
        projectData.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
        projectData.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
        return projectDataRepository.save(projectData);
    }

    public List<ProjectData> getAll() {
        return projectDataRepository.findAll();
    }

    public Optional<ProjectData> getById(String id) {
        return projectDataRepository.findById(id);
    }

    public Optional<ProjectData> getByProjectId(String projectId) {
        return projectDataRepository.findByProjectId(projectId);
    }

    public ProjectData update(String projectId, UpdateProjectDataRequest request) {
        ProjectData projectData = projectDataRepository.findByProjectId(projectId)
                .orElseThrow(() -> new RuntimeException("ProjectData not found for projectId: " + projectId));

        if (request.getYeuCauBaiToanContent() != null) {
            projectData.setYeuCauBaiToanContent(request.getYeuCauBaiToanContent());
        }
        if (request.getThongTinDauVaoContent() != null) {
            projectData.setThongTinDauVaoContent(request.getThongTinDauVaoContent());
        }
        if (request.getMoHinhHeThongContent() != null) {
            projectData.setMoHinhHeThongContent(request.getMoHinhHeThongContent());
        }
        if (request.getDinhCoHeThongContent() != null) {
            projectData.setDinhCoHeThongContent(request.getDinhCoHeThongContent());
        }
        if (request.getTongHopVaDeXuatContent() != null) {
            projectData.setTongHopVaDeXuatContent(request.getTongHopVaDeXuatContent());
        }

        return projectDataRepository.save(projectData);
    }

    public void delete(String id) {
        projectDataRepository.deleteById(id);
    }
}
