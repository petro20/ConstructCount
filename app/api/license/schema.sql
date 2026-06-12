-- =========================================================================
-- ConstructCount — esquema do licenciamento (MySQL / Hostinger)
-- Rode uma vez no phpMyAdmin (hPanel → Bancos de Dados → phpMyAdmin → SQL).
-- =========================================================================

CREATE TABLE IF NOT EXISTS licenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  license_key   VARCHAR(64)  NOT NULL UNIQUE,
  customer_name VARCHAR(120) DEFAULT NULL,
  customer_email VARCHAR(160) DEFAULT NULL,
  plan          VARCHAR(40)  NOT NULL DEFAULT 'mensal',     -- mensal | anual | ...
  status        ENUM('active','suspended','revoked') NOT NULL DEFAULT 'active',
  expires_at    DATETIME     DEFAULT NULL,                  -- fim da assinatura (NULL = sem vencimento)
  max_devices   INT          NOT NULL DEFAULT 1,
  notes         VARCHAR(255) DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS license_devices (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  license_id   INT          NOT NULL,
  device_hash  CHAR(64)     NOT NULL,                       -- sha256 do id do dispositivo
  device_label VARCHAR(120) DEFAULT NULL,                   -- ex.: nome do PC
  first_seen   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lic_dev (license_id, device_hash),
  CONSTRAINT fk_dev_lic FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS license_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  license_id  INT          DEFAULT NULL,
  device_hash CHAR(64)     DEFAULT NULL,
  action      VARCHAR(40)  NOT NULL,                        -- validate_ok | validate_fail | extract | ...
  reason      VARCHAR(120) DEFAULT NULL,
  ip          VARCHAR(45)  DEFAULT NULL,
  at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_log_lic (license_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
