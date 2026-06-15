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
