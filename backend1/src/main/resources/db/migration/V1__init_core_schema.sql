CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NULL,
    name VARCHAR(255) NOT NULL,
    dev_unit VARCHAR(255) NULL,
    owner_name VARCHAR(255) NULL,
    status VARCHAR(50) NULL,
    status_round INT NULL,
    assigned_admin1_id VARCHAR(255) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_projects_user_id (user_id),
    KEY idx_projects_assigned_admin1_id (assigned_admin1_id),
    KEY idx_projects_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_data (
    id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    yeu_cau_bai_toan_content LONGTEXT NULL,
    thong_tin_dau_vao_content LONGTEXT NULL,
    mo_hinh_he_thong_content LONGTEXT NULL,
    dinh_co_he_thong_content LONGTEXT NULL,
    tong_hop_va_de_xuat_content LONGTEXT NULL,
    yeu_cau_admin_review LONGTEXT NULL,
    thong_tin_admin_review LONGTEXT NULL,
    mohinh_admin_review LONGTEXT NULL,
    dinhco_admin_review LONGTEXT NULL,
    PRIMARY KEY (id),
    KEY idx_project_data_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_revisions (
    id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NULL,
    revision_type VARCHAR(20) NULL,
    snapshot_content LONGTEXT NULL,
    change_log VARCHAR(500) NULL,
    baseline_id VARCHAR(255) NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_project_revisions_project_id (project_id),
    KEY idx_project_revisions_user_id (user_id),
    KEY idx_project_revisions_baseline_id (baseline_id),
    KEY idx_project_revisions_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
