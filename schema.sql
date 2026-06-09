-- =========================================================================
-- Portal ConstructCount (M2PB) — esquema MySQL.
-- Rode uma vez no phpMyAdmin (SQL) do banco do portal.
-- =========================================================================

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) DEFAULT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  pass_hash     VARCHAR(255) NOT NULL,
  lang          VARCHAR(5)   NOT NULL DEFAULT 'pt',
  stripe_customer_id VARCHAR(64) DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS licenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          DEFAULT NULL,
  license_key   VARCHAR(64)  NOT NULL UNIQUE,
  plan          VARCHAR(40)  NOT NULL DEFAULT 'mensal',
  modules       VARCHAR(255) DEFAULT NULL,   -- pacotes/trades (CSV: windows_doors,drywall_paint). NULL = deriva do plano
  status        ENUM('active','past_due','suspended','revoked') NOT NULL DEFAULT 'active',
  expires_at    DATETIME     DEFAULT NULL,
  max_devices   INT          NOT NULL DEFAULT 1,
  stripe_subscription_id VARCHAR(64) DEFAULT NULL,
  notes         VARCHAR(255) DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_sub  (stripe_subscription_id),
  CONSTRAINT fk_lic_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS license_devices (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  license_id   INT          NOT NULL,
  device_hash  CHAR(64)     NOT NULL,
  device_label VARCHAR(120) DEFAULT NULL,
  first_seen   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lic_dev (license_id, device_hash),
  CONSTRAINT fk_dev_lic FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS license_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  license_id  INT          DEFAULT NULL,
  device_hash CHAR(64)     DEFAULT NULL,
  action      VARCHAR(40)  NOT NULL,
  reason      VARCHAR(160) DEFAULT NULL,
  ip          VARCHAR(45)  DEFAULT NULL,
  at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_log_lic (license_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
