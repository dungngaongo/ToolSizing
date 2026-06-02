package com.example.sizing.service;

import com.example.sizing.model.ActivityLog;
import com.example.sizing.repository.ActivityLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ActivityLogService {
    private static final Logger log = LoggerFactory.getLogger(ActivityLogService.class);

    private final ActivityLogRepository activityLogRepository;
    private final ObjectMapper objectMapper;

    public ActivityLogService(ActivityLogRepository activityLogRepository,
                              ObjectMapper objectMapper) {
        this.activityLogRepository = activityLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ActivityLog record(String action, String target, String targetId, String targetName, String detail) {
        return record(action, target, targetId, targetName, detail, null);
    }

    @Transactional
    public ActivityLog record(String action, String target, String targetId, String targetName, String detail, Object metadata) {
        ActivityLog entry = new ActivityLog();
        CurrentActor actor = resolveCurrentActor();
        entry.setUser(actor.username);
        entry.setActorRole(actor.role);
        entry.setAction(action);
        entry.setTarget(target);
        entry.setTargetId(targetId);
        entry.setTargetName(targetName);
        entry.setDetail(limit(detail, 1000));
        entry.setMetadata(serializeMetadata(metadata));

        ActivityLog saved = activityLogRepository.save(entry);
        log.debug("Recorded activity log {} {} -> {}", action, target, targetName);
        return saved;
    }

    public List<ActivityLog> getAll() {
        return activityLogRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public void clearAll() {
        activityLogRepository.deleteAllInBatch();
    }

    private String serializeMetadata(Object metadata) {
        if (metadata == null) return null;
        try {
            if (metadata instanceof String s) {
                return s;
            }
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            return String.valueOf(metadata);
        }
    }

    private String limit(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.length() <= maxLength) {
            return trimmed;
        }
        return trimmed.substring(0, maxLength - 3) + "...";
    }

    private CurrentActor resolveCurrentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return new CurrentActor("system", "SYSTEM");
        }

        String username = auth.getName();
        String role = auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .filter(a -> a != null && a.startsWith("ROLE_"))
                .findFirst()
                .map(a -> a.substring("ROLE_".length()))
                .orElse(null);
        return new CurrentActor(username, role);
    }

    private record CurrentActor(String username, String role) {}
}
