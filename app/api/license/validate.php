<?php
/* =========================================================================
   validate.php — valida uma licença (chave + dispositivo) e devolve um token
   de carência. Chamado pelo app (desktop e web) ao ativar e ao revalidar.
   POST JSON: { "key": "...", "device": "...", "device_label": "PC do João" }
   ========================================================================= */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['valid' => false, 'reason' => 'use POST']); exit;
}

$in = json_decode(file_get_contents('php://input') ?: '', true);
$key   = is_array($in) ? (string) ($in['key'] ?? '') : '';
$dev   = is_array($in) ? (string) ($in['device'] ?? '') : '';
$label = is_array($in) ? (string) ($in['device_label'] ?? '') : '';

try {
  $r = lic_validate($key, $dev, $label !== '' ? $label : null);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['valid' => false, 'reason' => 'erro no servidor de licença']); exit;
}

if (!$r['valid']) http_response_code(403);
echo json_encode([
  'valid'      => $r['valid'],
  'reason'     => $r['reason'],
  'plan'       => $r['plan'],
  'expires_at' => $r['expires_at'],
  'grace_days' => $r['grace_days'],
  'token'      => $r['token'],
], JSON_UNESCAPED_UNICODE);
