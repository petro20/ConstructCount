<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

/** Chamada REST ao Stripe (sem SDK/Composer). */
function stripe_api(string $method, string $path, array $params = []): array {
  cfg_loaded();
  $ch = curl_init('https://api.stripe.com/v1/' . ltrim($path, '/'));
  $headers = ['Authorization: Bearer ' . STRIPE_SECRET_KEY, 'Content-Type: application/x-www-form-urlencoded'];
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 30,
  ]);
  if ($params) curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($resp === false) return ['_error' => $err ?: 'curl falhou', '_status' => 0];
  $j = json_decode($resp, true);
  if (!is_array($j)) $j = [];
  $j['_status'] = $code;
  return $j;
}

/** Garante um customer do Stripe p/ o usuário (cria e grava o id). */
function stripe_customer_for(array $user): ?string {
  if (!empty($user['stripe_customer_id'])) return $user['stripe_customer_id'];
  $c = stripe_api('POST', 'customers', ['email' => $user['email'], 'name' => $user['name'] ?: $user['email'], 'metadata[user_id]' => $user['id']]);
  if (empty($c['id'])) return null;
  db()->prepare('UPDATE users SET stripe_customer_id=? WHERE id=?')->execute([$c['id'], (int) $user['id']]);
  return $c['id'];
}

/** Cria a sessão de Checkout (assinatura) e devolve a URL p/ redirecionar. */
function stripe_checkout_url(array $user, string $plan): ?string {
  cfg_loaded();
  $prices = defined('STRIPE_PRICES') ? STRIPE_PRICES : [];
  $price = $prices[$plan] ?? null;
  if (!$price) return null;
  $cust = stripe_customer_for($user);
  if (!$cust) return null;
  $s = stripe_api('POST', 'checkout/sessions', [
    'mode' => 'subscription',
    'customer' => $cust,
    'line_items[0][price]' => $price,
    'line_items[0][quantity]' => 1,
    'allow_promotion_codes' => 'true',
    'metadata[user_id]' => $user['id'],
    'metadata[plan]' => $plan,
    'subscription_data[metadata][user_id]' => $user['id'],
    'subscription_data[metadata][plan]' => $plan,
    'success_url' => url('success.php?session_id={CHECKOUT_SESSION_ID}'),
    'cancel_url'  => url('cancel.php'),
  ]);
  return $s['url'] ?? null;
}

/** Sessão do portal de cobrança do Stripe (cliente gerencia/cancela). */
function stripe_billing_portal_url(array $user): ?string {
  $cust = stripe_customer_for($user);
  if (!$cust) return null;
  $s = stripe_api('POST', 'billing_portal/sessions', ['customer' => $cust, 'return_url' => url('dashboard.php')]);
  return $s['url'] ?? null;
}

/** Verifica a assinatura do webhook do Stripe (Stripe-Signature). */
function stripe_verify_webhook(string $payload, string $sigHeader): bool {
  cfg_loaded();
  $secret = defined('STRIPE_WEBHOOK_SECRET') ? STRIPE_WEBHOOK_SECRET : '';
  if ($secret === '' || $sigHeader === '') return false;
  $t = null; $v1 = null;
  foreach (explode(',', $sigHeader) as $part) {
    $kv = explode('=', trim($part), 2);
    if (count($kv) !== 2) continue;
    if ($kv[0] === 't') $t = $kv[1];
    if ($kv[0] === 'v1') $v1 = $kv[1];
  }
  if ($t === null || $v1 === null) return false;
  if (abs(time() - (int) $t) > 300) return false;                 // proteção contra replay (5 min)
  $expected = hash_hmac('sha256', $t . '.' . $payload, $secret);
  return hash_equals($expected, $v1);
}
