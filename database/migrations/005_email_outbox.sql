CREATE TABLE IF NOT EXISTS nw_email_outbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key CHAR(64) NOT NULL UNIQUE,
  kind ENUM('contact','enquiry','test_drive','seller_submission') NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  recipient VARCHAR(254) NOT NULL,
  data JSON NOT NULL,
  status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  lock_token CHAR(36) NULL,
  last_error VARCHAR(64) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_pending (status, available_at, id),
  INDEX idx_email_sent (sent_at)
) ENGINE=InnoDB;
