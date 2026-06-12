<?php
/* =========================================================================
   dite.php — integração com o Dite Gateway (pay.diteads.com).
   O site NÃO processa cartão: cria a assinatura no gateway, redireciona pro
   checkout_url e recebe a confirmação por webhook (assinado por HMAC).
   Config (config.php): DITE_BASE_URL, DITE_API_KEY, DITE_WEBHOOK_SECRET, DITE_PLANS.
   ========================================================================= */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function dite_base(): string { cfg_loaded(); return rtrim(defined('DITE_BASE_URL') ? DITE_BASE_URL : 'https://pay.diteads.com', '/'); }
function dite_key(): string { cfg_loaded(); return defined('DITE_API_KEY') ? (string) DITE_API_KEY : ''; }

/** Chamada REST ao Dite (header X-Api-Key). */
function dite_api(string $method, string $path, ?array $body = null, array $extraHeaders = []): array {
  $ch = curl_init(dite_base() . $path);
  $headers = array_merge([
    'X-Api-Key: ' . dite_key(),
    'Content-Type: application/json',
    'Accept: application/json',
  ], $extraHeaders);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 30,
  ]);
  if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  if ($resp === false) return ['_status' => 0, '_error' => $err ?: 'curl falhou'];
  $j = json_decode($resp, true);
  if (!is_array($j)) $j = ['_raw' => $resp];
  $j['_status'] = $code;
  return $j;
}

/** desembrulha {success,data:{...}} ou retorna o próprio array. */
function _dite_data(array $r): array { return isset($r['data']) && is_array($r['data']) ? $r['data'] : $r; }

/**
 * Definição de um pacote do NOSSO catálogo (config: DITE_PLAN_CATALOG).
 * Fonte da verdade fica do nosso lado — enviamos o plano "inline" a cada
 * checkout (forma recomendada na doc do Dite). Mudou preço/pacote no config,
 * vale no próximo checkout — sem criar plano no painel nem usar plan_id.
 */
function dite_plan_def(string $plan): ?array {
  cfg_loaded();
  $cat = function_exists('cc_plan_catalog') ? cc_plan_catalog() : (defined('DITE_PLAN_CATALOG') ? DITE_PLAN_CATALOG : []);
  return $cat[$plan] ?? null;
}

/**
 * Cria uma ASSINATURA recorrente no Dite e devolve o checkout_url p/ redirecionar.
 * Envia o plano INLINE (name/amount/currency/interval) a partir do catálogo.
 * Fallback: se o pacote não tiver definição mas houver DITE_PLANS[$plan] (id),
 * usa plan_id (plano cadastrado no painel).
 * external_reference = "user_<id>" (o webhook usa isso p/ achar o usuário).
 */
function dite_create_subscription(array $user, string $plan, ?string $region = null): ?array {
  cfg_loaded();
  // external_reference carrega usuário + plano (+ região do mural) — o webhook
  // parseia isso pra emitir a licença certa mesmo com plano enviado inline.
  $extRef = 'user_' . (int) $user['id'] . '|plan_' . $plan . ($region !== null && $region !== '' ? '|region_' . $region : '');
  $payload = [
    'customer'           => ['name' => $user['name'] ?: $user['email'], 'email' => $user['email']],
    'external_reference' => $extRef,
    'success_url'        => url('success.php'),
    'cancel_url'         => url('cancel.php'),
  ];
  $def = dite_plan_def($plan);
  if ($def) {
    $payload['plan'] = [
      'name'     => (string) $def['name'] . ($region ? ' — ' . $region : ''),
      'amount'   => (float) $def['amount'],
      'currency' => (string) $def['currency'],
      'interval' => (string) $def['interval'],   // "month" | "year"
    ];
  } else {
    $plans  = defined('DITE_PLANS') ? DITE_PLANS : [];
    $planId = $plans[$plan] ?? null;
    if (!$planId) return null;
    $payload['plan_id'] = (int) $planId;
  }
  $r = dite_api('POST', '/api/v1/subscriptions', $payload);
  $d = _dite_data($r);
  $checkout = $d['checkout_url'] ?? null;
  $subId    = $d['subscription_id'] ?? ($d['id'] ?? null);
  if (!$checkout) return null;
  return ['checkout_url' => $checkout, 'subscription_id' => $subId, 'plan' => $plan];
}

/** Pagamento ÚNICO no Dite (pré-pago de N meses do Mural por região).
    external_reference leva user/plan/region/months — o webhook emite a licença
    com vencimento = N meses, sem recorrência. */
function dite_create_payment(array $user, string $plan, string $region, int $months, float $amount, string $name): ?array {
  cfg_loaded();
  $payload = [
    'customer'           => ['name' => $user['name'] ?: $user['email'], 'email' => $user['email']],
    'external_reference' => 'user_' . (int) $user['id'] . '|plan_' . $plan . '|region_' . $region . '|months_' . $months,
    'success_url'        => url('success.php'),
    'cancel_url'         => url('cancel.php'),
    'amount'             => $amount,
    'currency'           => 'USD',
    'description'        => $name,
    'name'               => $name,
  ];
  $r = dite_api('POST', '/api/v1/payments', $payload);
  $d = _dite_data($r);
  $checkout = $d['checkout_url'] ?? ($d['payment_url'] ?? null);
  if (!$checkout) return null;
  return ['checkout_url' => $checkout, 'payment_id' => $d['payment_id'] ?? ($d['id'] ?? null)];
}

/** Cancela uma assinatura no Dite. */
function dite_cancel_subscription(string $subId): array {
  return dite_api('POST', '/api/v1/subscriptions/' . rawurlencode($subId) . '/cancel');
}

/** Verifica a assinatura HMAC do webhook (header X-Dite-Signature) sobre o corpo BRUTO. */
function dite_verify_webhook(string $rawBody, string $sig): bool {
  cfg_loaded();
  $secret = defined('DITE_WEBHOOK_SECRET') ? (string) DITE_WEBHOOK_SECRET : '';
  if ($secret === '' || $sig === '') return false;
  $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
  return hash_equals($expected, $sig);
}
