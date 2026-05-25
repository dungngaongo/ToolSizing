-- Fix foreign key constraint to allow project deletion when baseline revisions are referenced
-- Issue: fk_project_revisions_baseline with ON DELETE RESTRICT prevents deletion of projects
-- Solution: Change to ON DELETE SET NULL to allow deletion and set baseline_id to NULL

-- Check if the constraint exists and drop it
SET @fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'project_revisions'
      AND CONSTRAINT_NAME = 'fk_project_revisions_baseline'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @drop_fk_sql := IF(
    @fk_exists > 0,
    'ALTER TABLE project_revisions DROP FOREIGN KEY fk_project_revisions_baseline',
    'SELECT 1'
);

PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Re-create the constraint with ON DELETE SET NULL
ALTER TABLE project_revisions
ADD CONSTRAINT fk_project_revisions_baseline
FOREIGN KEY (baseline_id) REFERENCES project_revisions(id)
ON DELETE SET NULL
ON UPDATE RESTRICT;