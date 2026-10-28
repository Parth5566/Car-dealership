ALTER TABLE nw_leads ADD COLUMN consent_at DATETIME NULL, ADD COLUMN consent_version VARCHAR(80) NULL;
ALTER TABLE nw_test_drives ADD COLUMN consent_at DATETIME NULL, ADD COLUMN consent_version VARCHAR(80) NULL;
