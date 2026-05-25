CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(255) NOT NULL,
    actor_username VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(50) NOT NULL,
    target_id VARCHAR(255) NULL,
    target_name VARCHAR(255) NULL,
    detail LONGTEXT NULL,
    metadata LONGTEXT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_activity_logs_created_at (created_at),
    KEY idx_activity_logs_action (action),
    KEY idx_activity_logs_target (target),
    KEY idx_activity_logs_actor_username (actor_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
