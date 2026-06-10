<?php
declare(strict_types=1);

function cfg_loaded(): void {
  static $l = false;
  if ($l) return;
  $c = __DIR__ . '/../config.php';
  if (!is_file($c)) { http_response_code(500); exit('Portal não configurado (config.php).'); }
  require $c;
  require_once __DIR__ . '/catalog.php';   // catálogo de pacotes no código (config pode sobrescrever)
  $l = true;
}

function db(): PDO {
  cfg_loaded();
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}
