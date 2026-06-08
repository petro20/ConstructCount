<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function h($s): string { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }

function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  cfg_loaded();
  session_name('fqa_portal');
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
  session_start();
}

function csrf_token(): string {
  start_session();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
  return $_SESSION['csrf'];
}
function csrf_check(): bool {
  start_session();
  return isset($_POST['csrf'], $_SESSION['csrf']) && hash_equals($_SESSION['csrf'], (string) $_POST['csrf']);
}
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">'; }

function redirect(string $to): void { header('Location: ' . $to); exit; }
function url(string $path = ''): string { cfg_loaded(); return rtrim(PORTAL_URL, '/') . '/' . ltrim($path, '/'); }

function flash(?string $msg = null): ?string {
  start_session();
  if ($msg !== null) { $_SESSION['flash'] = $msg; return null; }
  $m = $_SESSION['flash'] ?? null; unset($_SESSION['flash']); return $m;
}

function fmt_date($s): string {
  if (!$s) return '—';
  $t = strtotime((string) $s);
  // EUA → "Dec 31, 2026"; PT/ES → 31/12/2026
  return (function_exists('lang') && lang() === 'en') ? date('M j, Y', $t) : date('d/m/Y', $t);
}
function client_ip(): ?string { return $_SERVER['REMOTE_ADDR'] ?? null; }
