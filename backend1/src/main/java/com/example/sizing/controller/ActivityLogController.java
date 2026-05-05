package com.example.sizing.controller;

import com.example.sizing.model.ActivityLog;
import com.example.sizing.service.ActivityLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/activity-logs")
@CrossOrigin(origins = "*")
@PreAuthorize("hasRole('ADMIN2')")
public class ActivityLogController {
    private static final Logger log = LoggerFactory.getLogger(ActivityLogController.class);

    private final ActivityLogService activityLogService;

    public ActivityLogController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @GetMapping
    public ResponseEntity<List<ActivityLog>> getAll() {
        log.debug("GET /api/activity-logs - Fetching activity logs");
        return ResponseEntity.ok(activityLogService.getAll());
    }

    @DeleteMapping
    public ResponseEntity<Void> clearAll() {
        log.warn("DELETE /api/activity-logs - Clearing all activity logs");
        activityLogService.clearAll();
        return ResponseEntity.noContent().build();
    }
}
