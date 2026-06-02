CREATE TABLE project_assets (
    id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    section VARCHAR(32) NOT NULL,
    asset_group VARCHAR(255) NOT NULL,
    asset_order INT NOT NULL DEFAULT 0,
    kind VARCHAR(32) NOT NULL,
    filename VARCHAR(255) NULL,
    content_type VARCHAR(128) NULL,
    size_bytes BIGINT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    public_url VARCHAR(512) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    width_px INT NULL,
    height_px INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_assets PRIMARY KEY (id),
    CONSTRAINT fk_project_assets_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uk_project_assets_slot UNIQUE (project_id, section, asset_group, asset_order),
    CONSTRAINT uk_project_assets_public_url UNIQUE (public_url)
);

CREATE INDEX idx_project_assets_project_section ON project_assets(project_id, section);
CREATE INDEX idx_project_assets_group ON project_assets(project_id, section, asset_group, asset_order);
CREATE INDEX idx_project_assets_sha256 ON project_assets(project_id, section, sha256);
