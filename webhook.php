<?php
/* =========================================================================
   webhook.php — recebe eventos do Stripe e cria/renova/cancela a licença.
   Configure no Stripe (Developers → Webhooks) apontando p/ esta URL e cole o
   "Signing secret" em STRIPE_WEBHOOK_SECRET.
   ========================================================================= */
declare(strict_types=1);
require __DIR__ . '/lib/stripe.php';
require __DIR__ . '/lib/license.php';

$payload = file_get_contents('php://input') ?: '';
$sig = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
if (!stripe_verify_webhook($payload, $sig)) { http_response_code(400); echo 'bad signature'; exit; }

$event = json_decode($payload, true);
$type = $event['type'] ?? '';
$obj  = $event['data']['object'] ?? [];

function _user_for($obj): ?int {
  $uid = $obj['metadata']['user_id'] ?? null;
  if ($uid) return (int) $uid;
  $cust = $obj['customer'] ?? null;
  if ($cust) {
    $st = db()->prepare('SELECT id FROM users WHERE stripe_customer_id=? LIMIT 1');
    $st->execute([$cust]);
    $r = $st->fetch();
    if ($r) return (int) $r['id'];
  }
  return null;
}
function _map_status(string $s): string {
  if ($s === 'active' || $s === 'trialing') return 'active';
  if ($s === 'past_due' || $s === 'unpaid') return 'past_due';
  return 'revoked';                                  // canceled, incomplete_expired...
}
function _exp_from_sub(array $sub): ?string {
  $end = $sub['current_period_end'] ?? null;
  return $end ? date('Y-m-d H:i:s', (int) $end) : null;
}
function _plan_from(array $o, array $sub): string {
  return $o['metadata']['plan'] ?? ($sub['metadata']['plan'] ?? 'mensal');
}

cfg_loaded();
$devices = defined('STRIPE_DEFAULT_DEVICES') ? (int) STRIPE_DEFAULT_DEVICES : 1;

try {
  if ($type === 'checkout.session.completed' || $type === 'invoice.paid' || $type === 'invoice.payment_succeeded') {
    $subId = $obj['subscription'] ?? null;
    if ($subId) {
      $sub = stripe_api('GET', 'subscriptions/' . $subId);
      $uid = _user_for($obj) ?: _user_for($sub);
      lic_upsert_by_subscription($uid, $subId, _plan_from($obj, $sub), _exp_from_sub($sub), _map_status((string) ($sub['status'] ?? 'active')), $devices);
    }
  } elseif ($type === 'customer.subscription.updated' || $type === 'customer.subscription.created') {
    $subId = $obj['id'] ?? null;
    if ($subId) {
      $uid = _user_for($obj);
      lic_upsert_by_subscription($uid, $subId, _plan_from($obj, $obj), _exp_from_sub($obj), _map_status((string) ($obj['status'] ?? 'active')), $devices);
    }
  } elseif ($type === 'customer.subscription.deleted') {
    $subId = $obj['id'] ?? null;
    if ($subId) db()->prepare('UPDATE licenses SET status="revoked" WHERE stripe_subscription_id=?')->execute([$subId]);
  } elseif ($type === 'invoice.payment_failed') {
    $subId = $obj['subscription'] ?? null;
    if ($subId) db()->prepare('UPDATE licenses SET status="past_due" WHERE stripe_subscription_id=?')->execute([$subId]);
  }
} catch (Throwable $e) {
  http_response_code(500); echo 'err'; exit;
}
http_response_code(200);
echo 'ok';
