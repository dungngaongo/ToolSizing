package com.example.demo.controller;

import com.example.demo.dto.CreateProjectDataRequest;
import com.example.demo.dto.UpdateProjectDataRequest;
import com.example.demo.model.ProjectData;
import com.example.demo.service.ProjectDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-data")
@CrossOrigin(origins = "*")
public class ProjectDataController {
    private final ProjectDataService projectDataService;

    public ProjectDataController(ProjectDataService projectDataService) {
        this.projectDataService = projectDataService;
    }

    @PostMapping
    public ResponseEntity<ProjectData> create(@RequestBody CreateProjectDataRequest request) {
        ProjectData created = projectDataService.create(request);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<ProjectData>> getAll() {
        return ResponseEntity.ok(projectDataService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectData> getById(@PathVariable String id) {
        return projectDataService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<ProjectData> getByProjectId(@PathVariable String projectId) {
        return projectDataService.getByProjectId(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/project/{projectId}")
    public ResponseEntity<ProjectData> update(@PathVariable String projectId, @RequestBody UpdateProjectDataRequest request) {
        ProjectData updated = projectDataService.update(projectId, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        projectDataService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

