-- 1) Cleanup orphan data before enforcing foreign keys
UPDATE projects p
LEFT JOIN users u ON u.id = p.user_id
SET p.user_id = NULL
WHERE p.user_id IS NOT NULL AND u.id IS NULL;

UPDATE projects p
LEFT JOIN users u ON u.id = p.assigned_admin1_id
SET p.assigned_admin1_id = NULL
WHERE p.assigned_admin1_id IS NOT NULL AND u.id IS NULL;

DELETE pd
FROM project_data pd
LEFT JOIN projects p ON p.id = pd.project_id
WHERE p.id IS NULL;

DELETE pr
FROM project_revisions pr
LEFT JOIN projects p ON p.id = pr.project_id
WHERE p.id IS NULL;

UPDATE project_revisions pr
LEFT JOIN users u ON u.id = pr.user_id
SET pr.user_id = NULL
WHERE pr.user_id IS NOT NULL AND u.id IS NULL;

UPDATE project_revisions pr
LEFT JOIN project_revisions base ON base.id = pr.baseline_id
SET pr.baseline_id = NULL
WHERE pr.baseline_id IS NOT NULL AND base.id IS NULL;

UPDATE project_revisions pr
JOIN project_revisions base ON base.id = pr.baseline_id
SET pr.baseline_id = NULL
WHERE pr.baseline_id IS NOT NULL AND pr.project_id <> base.project_id;

-- Keep exactly one ProjectData row per project_id (legacy duplicates cleanup)
DELETE pd1
FROM project_data pd1
JOIN project_data pd2
  ON pd1.project_id = pd2.project_id
 AND pd1.id > pd2.id;

-- 2) Add unique constraint for 1-1 Project -> ProjectData if absent
SET @uk_project_data_project_id_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'project_data'
      AND CONSTRAINT_NAME = 'uk_project_data_project_id'
      AND CONSTRAINT_TYPE = 'UNIQUE'
);
SET @uk_project_data_project_id_sql := IF(
    @uk_project_data_project_id_exists = 0,
    'ALTER TABLE project_data ADD CONSTRAINT uk_project_data_project_id UNIQUE (project_id)',
    'SELECT 1'
);
PREPARE stmt FROM @uk_project_data_project_id_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Add foreign keys if absent
SET @fk_projects_user_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects'
      AND CONSTRAINT_NAME = 'fk_projects_user'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_projects_user_sql := IF(
    @fk_projects_user_exists = 0,
    'ALTER TABLE projects ADD CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @fk_projects_user_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_projects_admin1_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects'
      AND CONSTRAINT_NAME = 'fk_projects_assigned_admin1'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_projects_admin1_sql := IF(
    @fk_projects_admin1_exists = 0,
    'ALTER TABLE projects ADD CONSTRAINT fk_projects_assigned_admin1 FOREIGN KEY (assigned_admin1_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @fk_projects_admin1_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_project_data_project_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'project_data'
      AND CONSTRAINT_NAME = 'fk_project_data_project'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_project_data_project_sql := IF(
    @fk_project_data_project_exists = 0,
    'ALTER TABLE project_data ADD CONSTRAINT fk_project_data_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @fk_project_data_project_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_project_revisions_project_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'project_revisions'
      AND CONSTRAINT_NAME = 'fk_project_revisions_project'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_project_revisions_project_sql := IF(
    @fk_project_revisions_project_exists = 0,
    'ALTER TABLE project_revisions ADD CONSTRAINT fk_project_revisions_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @fk_project_revisions_project_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_project_revisions_user_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'project_revisions'
      AND CONSTRAINT_NAME = 'fk_project_revisions_user'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_project_revisions_user_sql := IF(
    @fk_project_revisions_user_exists = 0,
    'ALTER TABLE project_revisions ADD CONSTRAINT fk_project_revisions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @fk_project_revisions_user_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_project_revisions_baseline_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'project_revisions'
      AND CONSTRAINT_NAME = 'fk_project_revisions_baseline'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_project_revisions_baseline_sql := IF(
    @fk_project_revisions_baseline_exists = 0,
    'ALTER TABLE project_revisions ADD CONSTRAINT fk_project_revisions_baseline FOREIGN KEY (baseline_id) REFERENCES project_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @fk_project_revisions_baseline_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
