<?php
declare(strict_types=1);
require_once __DIR__ . '/util.php';

function auth_register(string $name, string $email, string $pass): array {
  $email = strtolower(trim($email));
  if ($name === '' || $email === '' || strlen($pass) < 6) return ['ok' => false, 'err' => 'fields'];
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'err' => 'fields'];
  $st = db()->prepare('SELECT id FROM users WHERE email=? LIMIT 1');
  $st->execute([$email]);
  if ($st->fetch()) return ['ok' => false, 'err' => 'exists'];
  require_once __DIR__ . '/i18n.php';
  db()->prepare('INSERT INTO users (name,email,pass_hash,lang) VALUES (?,?,?,?)')
      ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), lang()]);
  $id = (int) db()->lastInsertId();
  auth_login_session($id);
  return ['ok' => true, 'id' => $id];
}

function auth_login(string $email, string $pass): array {
  $email = strtolower(trim($email));
  $st = db()->prepare('SELECT * FROM users WHERE email=? LIMIT 1');
  $st->execute([$email]);
  $u = $st->fetch();
  if (!$u || !password_verify($pass, $u['pass_hash'])) return ['ok' => false, 'err' => 'login'];
  auth_login_session((int) $u['id']);
  return ['ok' => true, 'id' => (int) $u['id']];
}

function auth_login_session(int $userId): void {
  start_session();
  session_regenerate_id(true);
  $_SESSION['uid'] = $userId;
}

function auth_logout(): void { start_session(); $_SESSION = []; session_destroy(); }

function current_user(): ?array {
  start_session();
  if (empty($_SESSION['uid'])) return null;
  static $u = null;
  if ($u !== null) return $u;
  $st = db()->prepare('SELECT * FROM users WHERE id=? LIMIT 1');
  $st->execute([(int) $_SESSION['uid']]);
  $u = $st->fetch() ?: null;
  return $u;
}

function require_login(): array {
  $u = current_user();
  if (!$u) {
    // guarda o destino (ex.: trial.php, checkout.php?plan=parede) p/ voltar após o login
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    if ($uri !== '' && $uri[0] === '/' && strpos($uri, '//') !== 0) $_SESSION['after_login'] = $uri;
    redirect(url('login.php'));
  }
  return $u;
}

/** Destino pós-login: volta pra página que exigiu login (trial/checkout), senão dashboard. */
function after_login_url(): string {
  $next = (string) ($_SESSION['after_login'] ?? '');
  unset($_SESSION['after_login']);
  if ($next !== '' && $next[0] === '/' && strpos($next, '//') !== 0 && !preg_match('/[\r\n]/', $next)) {
    cfg_loaded();
    return rtrim(PORTAL_URL, '/') . $next;
  }
  return url('dashboard.php');
}

function is_admin(?array $u = null): bool {
  cfg_loaded();
  $u = $u ?: current_user();
  return $u && defined('ADMIN_EMAILS') && in_array(strtolower($u['email']), array_map('strtolower', ADMIN_EMAILS), true);
}
