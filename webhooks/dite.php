<?php
/* =========================================================================
   webhooks/dite.php — recebe os eventos do Dite Gateway e cria/renova/cancela
   a licença. Valida a assinatura HMAC (X-Dite-Signature) sobre o corpo BRUTO.
   Configure no painel Apps do Dite: webhook_url = https://constructcount.com/webhooks/dite
   ========================================================================= */
declare(strict_types=1);
require __DIR__ . '/../lib/dite.php';
require __DIR__ . '/../lib/license.php';

$raw = file_get_contents('php://input') ?: '';
$sig = $_SERVER['HTTP_X_DITE_SIGNATURE'] ?? '';
if (!dite_verify_webhook($raw, $sig)) {
  http_response_code(401);
  echo 'invalid signature';
  exit;
}

// log p/ depuração inicial (gitignored + bloqueado pelo .htaccess). Remova depois.
@file_put_contents(__DIR__ . '/dite-events.log', date('c') . ' ' . $raw . "\n", FILE_APPEND);

$e = json_decode($raw, true) ?: [];
$type = (string) ($e['event'] ?? $e['type'] ?? '');
$obj  = (is_array($e['data'] ?? null) ? $e['data'] : (is_array($e['subscription'] ?? null) ? $e['subscription'] : (is_array($e['object'] ?? null) ? $e['object'] : $e)));

function _dg($a, array $keys) {
  foreach ($keys as $k) { if (isset($a[$k]) && $a[$k] !== '') return $a[$k]; }
  return null;
}

$extRef  = _dg($e, ['external_reference']) ?? _dg($obj, ['external_reference']);
$subId   = _dg($obj, ['subscription_id', 'id']) ?? _dg($e, ['subscription_id']);
$planId  = _dg($obj, ['plan_id']) ?? _dg($e, ['plan_id']);
$status  = (string) (_dg($obj, ['status']) ?? '');

$userId = null;
if ($extRef && preg_match('/user_(\d+)/', (string) $extRef, $m)) $userId = (int) $m[1];

// plano pelo plan_id (reverso de DITE_PLANS); senão 'mensal'
$plan = 'mensal';
if (defined('DITE_PLANS') && $planId !== null) {
  $rev = array_flip(DITE_PLANS);
  if (isset($rev[(int) $planId])) $plan = (string) $rev[(int) $planId];
}

// vencimento: tenta vários campos; senão calcula pelo plano
$expRaw = _dg($obj, ['current_period_end', 'next_billing_date', 'paid_until', 'expires_at', 'renews_at', 'period_end', 'ends_at']);
$expires = null;
if ($expRaw !== null) {
  $t = is_numeric($expRaw) ? (int) $expRaw : strtotime((string) $expRaw);
  if ($t) $expires = date('Y-m-d H:i:s', $t);
}
if (!$expires) {
  $expires = date('Y-m-d H:i:s', strtotime($plan === 'anual' ? '+1 year +1 day' : '+1 month +1 day'));
}

try {
  if (in_array($type, ['subscription.activated', 'subscription.renewed'], true)) {
    if ($subId) lic_upsert_by_subscription($userId, (string) $subId, $plan, $expires, 'active', 1);
  } elseif ($type === 'subscription.past_due') {
    if ($subId) db()->prepare('UPDATE licenses SET status="past_due" WHERE stripe_subscription_id=?')->execute([(string) $subId]);
  } elseif ($type === 'subscription.canceled') {
    if ($subId) db()->prepare('UPDATE licenses SET status="revoked" WHERE stripe_subscription_id=?')->execute([(string) $subId]);
  }
  // pagamento avulso (payment.paid/refunded/...) — não usado por enquanto
} catch (Throwable $ex) {
  http_response_code(500);
  echo 'error';
  exit;
}

http_response_code(200);
echo 'ok';
