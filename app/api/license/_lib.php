<?php
/* =========================================================================
   _lib.php — núcleo do licenciamento (M2PB): conexão, validação, token HMAC.
   Sem dependências (PDO nativo). Usado por validate.php, admin.php e o gate
   do extract.php. A config (banco + segredo) fica em api/license-config.php.
   ========================================================================= */
declare(strict_types=1);

function lic_cfg(): void {
  static $loaded = false;
  if ($loaded) return;
  $cfg = __DIR__ . '/../license-config.php';
  if (is_file($cfg)) require $cfg;
  $loaded = true;
}

function lic_db(): PDO {
  lic_cfg();
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  if (!defined('LIC_DB_NAME')) throw new RuntimeException('licenciamento não configurado (license-config.php)');
  $dsn = 'mysql:host=' . LIC_DB_HOST . ';dbname=' . LIC_DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, LIC_DB_USER, LIC_DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}

function lic_secret(): string { lic_cfg(); return defined('LIC_SECRET') ? (string) LIC_SECRET : ''; }
function lic_grace_days(): int { lic_cfg(); return defined('LIC_GRACE_DAYS') ? (int) LIC_GRACE_DAYS : 7; }

function lic_b64url(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function lic_b64url_dec(string $s): string {
  return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}

/** Token assinado (payload.assinatura) — o cliente confia no que recebeu;
 *  o servidor re-valida ao vivo a cada chamada da IA (extract.php). */
function lic_sign(array $payload): string {
  $p = lic_b64url(json_encode($payload, JSON_UNESCAPED_UNICODE));
  $sig = lic_b64url(hash_hmac('sha256', $p, lic_secret(), true));
  return $p . '.' . $sig;
}
function lic_verify(string $token): ?array {
  $parts = explode('.', $token);
  if (count($parts) !== 2) return null;
  [$p, $sig] = $parts;
  $exp = lic_b64url(hash_hmac('sha256', $p, lic_secret(), true));
  if (!hash_equals($exp, $sig)) return null;
  $payload = json_decode(lic_b64url_dec($p), true);
  return is_array($payload) ? $payload : null;
}

function lic_device_hash(string $raw): string {
  $raw = trim($raw);
  return $raw === '' ? '' : hash('sha256', 'fenestra:' . $raw);
}

function lic_log(?int $licId, string $devHash, string $action, ?string $reason = null): void {
  try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    lic_db()->prepare('INSERT INTO license_log (license_id, device_hash, action, reason, ip) VALUES (?,?,?,?,?)')
            ->execute([$licId, $devHash ?: null, $action, $reason, $ip]);
  } catch (Throwable $e) { /* log é best-effort */ }
}

/**
 * Consulta SOMENTE o status de uma licença (sem registrar dispositivo) — p/ o
 * portal público "minha licença". Devolve dados de exibição + se está aprovada.
 */
function lic_status_only(string $key): array {
  $key = trim($key);
  $out = ['found' => false, 'approved' => false, 'reason' => '', 'plan' => null,
          'status' => null, 'expires_at' => null, 'devices' => 0, 'max_devices' => 0];
  if ($key === '') { $out['reason'] = 'chave ausente'; return $out; }
  $st = lic_db()->prepare('SELECT l.*, (SELECT COUNT(*) FROM license_devices d WHERE d.license_id=l.id) dev
                           FROM licenses l WHERE l.license_key = ? LIMIT 1');
  $st->execute([$key]);
  $lic = $st->fetch();
  if (!$lic) { $out['reason'] = 'chave não encontrada'; return $out; }
  $out['found'] = true;
  $out['plan'] = $lic['plan']; $out['status'] = $lic['status'];
  $out['expires_at'] = $lic['expires_at'];
  $out['devices'] = (int) $lic['dev']; $out['max_devices'] = (int) $lic['max_devices'];
  if ($lic['status'] !== 'active') { $out['reason'] = $lic['status'] === 'suspended' ? 'suspensa' : 'cancelada'; return $out; }
  if (!empty($lic['expires_at']) && strtotime((string) $lic['expires_at']) < time()) { $out['reason'] = 'expirada'; return $out; }
  $out['approved'] = true; $out['reason'] = 'ok';
  return $out;
}

/**
 * Valida uma licença (chave + dispositivo) AO VIVO contra o banco.
 * Registra/limita dispositivos. Devolve:
 *   ['valid'=>bool, 'reason'=>str, 'plan'=>?, 'expires_at'=>?, 'token'=>?, 'grace_days'=>int]
 */
function lic_validate(string $key, string $deviceRaw, ?string $deviceLabel = null): array {
  $key = trim($key);
  $devHash = lic_device_hash($deviceRaw);
  $out = ['valid' => false, 'reason' => '', 'plan' => null, 'expires_at' => null, 'token' => null, 'grace_days' => lic_grace_days()];
  if ($key === '') { $out['reason'] = 'chave ausente'; return $out; }
  if ($devHash === '') { $out['reason'] = 'dispositivo ausente'; return $out; }

  $db = lic_db();
  $st = $db->prepare('SELECT * FROM licenses WHERE license_key = ? LIMIT 1');
  $st->execute([$key]);
  $lic = $st->fetch();
  if (!$lic) { lic_log(null, $devHash, 'validate_fail', 'chave inválida'); $out['reason'] = 'chave inválida'; return $out; }

  $licId = (int) $lic['id'];
  if ($lic['status'] !== 'active') {
    lic_log($licId, $devHash, 'validate_fail', 'status:' . $lic['status']);
    $out['reason'] = $lic['status'] === 'suspended' ? 'licença suspensa' : 'licença cancelada';
    return $out;
  }
  if (!empty($lic['expires_at']) && strtotime((string) $lic['expires_at']) < time()) {
    lic_log($licId, $devHash, 'validate_fail', 'expirada');
    $out['reason'] = 'assinatura expirada';
    $out['expires_at'] = $lic['expires_at'];
    return $out;
  }

  // dispositivo já registrado?
  $sd = $db->prepare('SELECT id FROM license_devices WHERE license_id = ? AND device_hash = ? LIMIT 1');
  $sd->execute([$licId, $devHash]);
  $dev = $sd->fetch();
  if ($dev) {
    $db->prepare('UPDATE license_devices SET last_seen = NOW(), device_label = COALESCE(?, device_label) WHERE id = ?')
       ->execute([$deviceLabel, (int) $dev['id']]);
  } else {
    $cnt = (int) $db->query('SELECT COUNT(*) c FROM license_devices WHERE license_id = ' . $licId)->fetch()['c'];
    if ($cnt >= (int) $lic['max_devices']) {
      lic_log($licId, $devHash, 'validate_fail', 'limite de dispositivos');
      $out['reason'] = 'limite de dispositivos atingido (' . (int) $lic['max_devices'] . ')';
      return $out;
    }
    $db->prepare('INSERT INTO license_devices (license_id, device_hash, device_label) VALUES (?,?,?)')
       ->execute([$licId, $devHash, $deviceLabel]);
  }

  // OK → token p/ carência offline
  $subExp = !empty($lic['expires_at']) ? strtotime((string) $lic['expires_at']) : (time() + 3650 * 86400);
  $token = lic_sign([
    'k'         => $key,
    'd'         => $devHash,
    'plan'      => $lic['plan'],
    'sub_exp'   => $subExp,                                   // fim da assinatura
    'grace_exp' => time() + lic_grace_days() * 86400,         // até quando abre offline
    'iat'       => time(),
  ]);
  lic_log($licId, $devHash, 'validate_ok', null);
  return [
    'valid' => true, 'reason' => 'ok', 'plan' => $lic['plan'],
    'expires_at' => $lic['expires_at'], 'token' => $token, 'grace_days' => lic_grace_days(),
  ];
}
