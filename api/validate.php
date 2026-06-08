<?php
/* =========================================================================
   api/validate.php — endpoint chamado pelo APP (desktop/web) p/ validar a
   licença. POST JSON: { key, device, device_label }.
   O app deve apontar FENESTRA_LICENSE_URL para ESTE domínio (sem /api...),
   pois ele chama <base>/api/license/validate.php — então mantenha a estrutura
   /api/license/validate.php OU ajuste o cliente. (ver README)
   ========================================================================= */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
require __DIR__ . '/../lib/license.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); echo json_encode(['valid' => false, 'reason' => 'use POST']); exit; }
$in = json_decode(file_get_contents('php://input') ?: '', true);
$key = is_array($in) ? (string) ($in['key'] ?? '') : '';
$dev = is_array($in) ? (string) ($in['device'] ?? '') : '';
$lbl = is_array($in) ? (string) ($in['device_label'] ?? '') : '';

try { $r = lic_validate($key, $dev, $lbl !== '' ? $lbl : null); }
catch (Throwable $e) { http_response_code(500); echo json_encode(['valid' => false, 'reason' => 'erro no servidor']); exit; }

if (!$r['valid']) http_response_code(403);
echo json_encode(['valid' => $r['valid'], 'reason' => $r['reason'], 'plan' => $r['plan'],
                  'expires_at' => $r['expires_at'], 'grace_days' => $r['grace_days'], 'token' => $r['token']], JSON_UNESCAPED_UNICODE);
