<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function lic_secret(): string { cfg_loaded(); return defined('LIC_SECRET') ? (string) LIC_SECRET : ''; }
function lic_grace_days(): int { cfg_loaded(); return defined('LIC_GRACE_DAYS') ? (int) LIC_GRACE_DAYS : 7; }

function lic_b64url(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function lic_b64url_dec(string $s): string { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

function lic_sign(array $p): string {
  $b = lic_b64url(json_encode($p, JSON_UNESCAPED_UNICODE));
  return $b . '.' . lic_b64url(hash_hmac('sha256', $b, lic_secret(), true));
}
function lic_device_hash(string $raw): string { $raw = trim($raw); return $raw === '' ? '' : hash('sha256', 'fenestra:' . $raw); }

function lic_gen_key(): string {
  $x = strtoupper(bin2hex(random_bytes(10)));
  return 'CC-' . substr($x, 0, 4) . '-' . substr($x, 4, 4) . '-' . substr($x, 8, 4) . '-' . substr($x, 12, 4);
}

function lic_log(?int $id, string $dev, string $action, ?string $reason = null): void {
  try {
    db()->prepare('INSERT INTO license_log (license_id,device_hash,action,reason,ip) VALUES (?,?,?,?,?)')
        ->execute([$id, $dev ?: null, $action, $reason, $_SERVER['REMOTE_ADDR'] ?? null]);
  } catch (Throwable $e) {}
}

/** Cria uma licença para um usuário (usado pelo Stripe e pelo admin). */
function lic_create(?int $userId, string $plan, ?string $expiresAt, int $maxDevices = 1, ?string $subId = null): string {
  $key = lic_gen_key();
  db()->prepare('INSERT INTO licenses (user_id,license_key,plan,status,expires_at,max_devices,stripe_subscription_id) VALUES (?,?,?,?,?,?,?)')
      ->execute([$userId, $key, $plan, 'active', $expiresAt, $maxDevices, $subId]);
  return $key;
}

/** Renova/atualiza a licença de uma assinatura Stripe (cria se não existir). */
function lic_upsert_by_subscription(?int $userId, string $subId, string $plan, ?string $expiresAt, string $status, int $maxDevices = 1): void {
  $st = db()->prepare('SELECT id FROM licenses WHERE stripe_subscription_id = ? LIMIT 1');
  $st->execute([$subId]);
  $row = $st->fetch();
  if ($row) {
    db()->prepare('UPDATE licenses SET status=?, expires_at=?, plan=? WHERE id=?')
        ->execute([$status, $expiresAt, $plan, (int) $row['id']]);
    lic_log((int) $row['id'], '', 'sub_update', $status);
  } else {
    $key = lic_create($userId, $plan, $expiresAt, $maxDevices, $subId);
    db()->prepare('UPDATE licenses SET status=? WHERE license_key=?')->execute([$status, $key]);
  }
}

/** Status (sem registrar dispositivo) — portal/dashboard. */
function lic_status_only(string $key): array {
  $key = trim($key);
  $out = ['found' => false, 'approved' => false, 'reason' => '', 'plan' => null, 'status' => null, 'expires_at' => null, 'devices' => 0, 'max_devices' => 0];
  if ($key === '') { $out['reason'] = 'no_key'; return $out; }
  $st = db()->prepare('SELECT l.*, (SELECT COUNT(*) FROM license_devices d WHERE d.license_id=l.id) dev FROM licenses l WHERE license_key=? LIMIT 1');
  $st->execute([$key]);
  $l = $st->fetch();
  if (!$l) { $out['reason'] = 'not_found'; return $out; }
  $out['found'] = true; $out['plan'] = $l['plan']; $out['status'] = $l['status'];
  $out['expires_at'] = $l['expires_at']; $out['devices'] = (int) $l['dev']; $out['max_devices'] = (int) $l['max_devices'];
  if ($l['status'] !== 'active') { $out['reason'] = $l['status']; return $out; }
  if (!empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time()) { $out['reason'] = 'expired'; return $out; }
  $out['approved'] = true; $out['reason'] = 'ok';
  return $out;
}

/** Validação AO VIVO (chave + dispositivo) — chamada pelo app (api/validate.php). */
function lic_validate(string $key, string $deviceRaw, ?string $label = null): array {
  $key = trim($key); $dev = lic_device_hash($deviceRaw);
  $out = ['valid' => false, 'reason' => '', 'plan' => null, 'expires_at' => null, 'modules' => [], 'token' => null, 'grace_days' => lic_grace_days()];
  if ($key === '') { $out['reason'] = 'chave ausente'; return $out; }
  if ($dev === '') { $out['reason'] = 'dispositivo ausente'; return $out; }
  $st = db()->prepare('SELECT * FROM licenses WHERE license_key=? LIMIT 1');
  $st->execute([$key]);
  $l = $st->fetch();
  if (!$l) { lic_log(null, $dev, 'validate_fail', 'chave inválida'); $out['reason'] = 'chave inválida'; return $out; }
  $id = (int) $l['id'];
  if ($l['status'] !== 'active') { lic_log($id, $dev, 'validate_fail', $l['status']); $out['reason'] = 'licença ' . $l['status']; return $out; }
  if (!empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time()) { lic_log($id, $dev, 'validate_fail', 'expirada'); $out['reason'] = 'assinatura expirada'; $out['expires_at'] = $l['expires_at']; return $out; }
  $sd = db()->prepare('SELECT id FROM license_devices WHERE license_id=? AND device_hash=? LIMIT 1');
  $sd->execute([$id, $dev]);
  $d = $sd->fetch();
  if ($d) {
    db()->prepare('UPDATE license_devices SET last_seen=NOW(), device_label=COALESCE(?,device_label) WHERE id=?')->execute([$label, (int) $d['id']]);
  } else {
    $cnt = (int) db()->query('SELECT COUNT(*) c FROM license_devices WHERE license_id=' . $id)->fetch()['c'];
    if ($cnt >= (int) $l['max_devices']) { lic_log($id, $dev, 'validate_fail', 'limite de dispositivos'); $out['reason'] = 'limite de dispositivos atingido (' . (int) $l['max_devices'] . ')'; return $out; }
    db()->prepare('INSERT INTO license_devices (license_id,device_hash,device_label) VALUES (?,?,?)')->execute([$id, $dev, $label]);
  }
  $subExp = !empty($l['expires_at']) ? strtotime((string) $l['expires_at']) : (time() + 3650 * 86400);
  $mods = lic_packages($l);
  $out['valid'] = true; $out['reason'] = 'ok'; $out['plan'] = $l['plan']; $out['expires_at'] = $l['expires_at']; $out['modules'] = $mods;
  $out['token'] = lic_sign(['k' => $key, 'd' => $dev, 'plan' => $l['plan'], 'modules' => $mods, 'sub_exp' => $subExp, 'grace_exp' => time() + lic_grace_days() * 86400, 'iat' => time()]);
  lic_log($id, $dev, 'validate_ok', null);
  return $out;
}

function lic_for_user(int $userId): array {
  $st = db()->prepare('SELECT l.*, (SELECT COUNT(*) FROM license_devices d WHERE d.license_id=l.id) dev FROM licenses l WHERE user_id=? ORDER BY created_at DESC');
  $st->execute([$userId]);
  return $st->fetchAll();
}

/* ===================== PACOTES (módulos/trades da licença) =================
   Qual pacote a licença libera. Ordem: (1) coluna `modules` da licença, se
   existir/estiver setada; (2) o pacote do PLANO via DITE_PLAN_CATALOG; (3)
   default 'windows_doors' (o produto atual = Janelas e Portas). */
function _pkg_defaults(): array {
  return [
    'windows_doors' => ['pt' => 'Janelas e Portas', 'en' => 'Windows & Doors', 'es' => 'Ventanas y Puertas'],
    'framing'       => ['pt' => 'Framing (madeira+metal)', 'en' => 'Framing (wood+metal)', 'es' => 'Estructura (madera+metal)'],
    'drywall_paint' => ['pt' => 'Drywall e Pintura', 'en' => 'Drywall & Paint', 'es' => 'Drywall y Pintura'],
    'plumbing'      => ['pt' => 'Hidráulica', 'en' => 'Plumbing', 'es' => 'Plomería'],
    'electrical'    => ['pt' => 'Elétrica', 'en' => 'Electrical', 'es' => 'Eléctrica'],
    'concrete'      => ['pt' => 'Concreto', 'en' => 'Concrete', 'es' => 'Hormigón'],
    'roof'          => ['pt' => 'Telhado', 'en' => 'Roof', 'es' => 'Techo'],
    'ai'            => ['pt' => 'IA (add-on)', 'en' => 'AI (add-on)', 'es' => 'IA (add-on)'],
  ];
}

function pkg_name(string $key, ?string $lang = null): string {
  $lang = $lang ?: (function_exists('lang') ? lang() : 'en');
  $map = (defined('PACKAGES') ? PACKAGES : []) + _pkg_defaults();   // config sobrepõe defaults
  $pk = $map[$key] ?? null;
  if (!$pk) return $key;
  return $pk[$lang] ?? $pk['en'] ?? reset($pk);
}

/** Lista de chaves de pacote que a licença libera. */
function lic_packages(array $l): array {
  $m = trim((string) ($l['modules'] ?? ''));
  if ($m !== '') return array_values(array_filter(array_map('trim', explode(',', $m))));
  cfg_loaded();
  $cat = defined('DITE_PLAN_CATALOG') ? DITE_PLAN_CATALOG : [];
  $def = $cat[$l['plan'] ?? ''] ?? null;
  if ($def && !empty($def['modules'])) return array_values((array) $def['modules']);
  return ['windows_doors'];
}

/** Nome(s) de exibição dos pacotes da licença, no idioma. */
function lic_packages_label(array $l, ?string $lang = null): string {
  $names = array_map(fn($k) => pkg_name($k, $lang), lic_packages($l));
  return implode(' + ', $names) ?: pkg_name('windows_doors', $lang);
}
