<?php
/* =========================================================================
   admin/dite-check.php — DIAGNÓSTICO do Dite Gateway (só ADMIN_EMAILS).
   Mostra a config carregada (chave MASCARADA), os planos reais do gateway e
   um teste de criação de assinatura — pra descobrir por que o checkout falha.
   APAGAR depois de configurar (é ferramenta de debug).
   ========================================================================= */
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/dite.php';
$u = require_login();
if (!is_admin($u)) { http_response_code(403); exit('Acesso restrito.'); }

header('Content-Type: text/html; charset=utf-8');
function mask(string $s): string {
  $n = strlen($s);
  if ($n === 0) return '(vazio)';
  if ($n <= 10) return substr($s, 0, 2) . str_repeat('*', max(0, $n - 2));
  return substr($s, 0, 6) . str_repeat('*', $n - 10) . substr($s, -4) . "  (len=$n)";
}
function dump($x): string { return htmlspecialchars(json_encode($x, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8'); }

$plans = defined('DITE_PLANS') ? DITE_PLANS : [];
?><!doctype html><html lang="pt"><head><meta charset="utf-8">
<title>Dite — diagnóstico</title>
<style>body{font:14px/1.5 monospace;background:#100d08;color:#f1ece0;max-width:1000px;margin:24px auto;padding:0 16px}
h2{color:#d9a02a;border-bottom:1px solid #352c1d;padding-bottom:6px;margin-top:28px}
pre{background:#1c1810;border:1px solid #352c1d;border-radius:8px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.ok{color:#7dd39b}.bad{color:#ff8a8a}.k{color:#d9a02a}</style></head><body>
<h1 class="k">🔌 Dite Gateway — diagnóstico</h1>

<h2>1) Configuração carregada (config.php)</h2>
<pre>DITE_BASE_URL        = <?= htmlspecialchars(defined('DITE_BASE_URL') ? DITE_BASE_URL : '(não definido)') ?>

DITE_API_KEY         = <?= htmlspecialchars(mask(defined('DITE_API_KEY') ? (string) DITE_API_KEY : '')) ?>

DITE_WEBHOOK_SECRET  = <?= htmlspecialchars(mask(defined('DITE_WEBHOOK_SECRET') ? (string) DITE_WEBHOOK_SECRET : '')) ?>

DITE_PLANS           = <?= dump($plans) ?></pre>

<h2>0) Schema da API (openapi) — endpoints de PLANOS</h2>
<p>Pra eu programar o envio automático dos pacotes. Mostra os paths com "plan" e os schemas de criação.</p>
<pre><?php
  $oa = dite_api('GET', '/api/v1/openapi.json');
  echo '_status = ' . ($oa['_status'] ?? '?') . "\n\n";
  $paths = $oa['paths'] ?? [];
  echo "== PATHS com 'plan' ==\n";
  foreach ($paths as $p => $methods) {
    if (stripos($p, 'plan') !== false) {
      echo "  $p  ->  " . strtoupper(implode(', ', array_keys((array) $methods))) . "\n";
    }
  }
  echo "\n== nó completo de /api/v1/plans ==\n";
  foreach ($paths as $p => $node) {
    if (preg_match('#/plans/?$#', $p)) { echo dump([$p => $node]) . "\n"; }
  }
  echo "\n== schemas (components) com 'plan' no nome ==\n";
  $schemas = $oa['components']['schemas'] ?? ($oa['definitions'] ?? []);
  foreach ($schemas as $name => $def) {
    if (stripos($name, 'plan') !== false) { echo "--- $name ---\n" . dump($def) . "\n\n"; }
  }
?></pre>

<h2>2) GET /api/v1/plans — planos REAIS no gateway</h2>
<p>Compare os <span class="k">id</span> daqui com o DITE_PLANS acima. Se forem diferentes, é por isso que o checkout falha.</p>
<pre><?php
  $rp = dite_api('GET', '/api/v1/plans');
  echo '_status = ' . ($rp['_status'] ?? '?') . "\n\n" . dump($rp);
?></pre>

<h2>3) GET /api/v1/subscriptions — chave válida?</h2>
<pre><?php
  $rs = dite_api('GET', '/api/v1/subscriptions');
  echo '_status = ' . ($rs['_status'] ?? '?') . "\n\n" . dump($rs);
?></pre>

<h2>4) Teste real: criar assinatura (plano "mensal")</h2>
<p>Mesma chamada que o botão "Assinar" faz. A resposta crua mostra o erro exato.</p>
<pre><?php
  $planId = $plans['mensal'] ?? null;
  if (!$planId) { echo "<span class='bad'>DITE_PLANS['mensal'] não definido</span>"; }
  else {
    $rc = dite_api('POST', '/api/v1/subscriptions', [
      'plan_id'            => (int) $planId,
      'customer'           => ['name' => $u['name'] ?: $u['email'], 'email' => $u['email']],
      'external_reference' => 'user_' . (int) $u['id'],
      'success_url'        => url('success.php'),
      'cancel_url'         => url('cancel.php'),
    ]);
    echo '_status = ' . ($rc['_status'] ?? '?') . "\n\n" . dump($rc);
    $d = _dite_data($rc);
    $co = $d['checkout_url'] ?? null;
    echo "\n\ncheckout_url => " . ($co ? "<span class='ok'>" . htmlspecialchars($co) . "</span>" : "<span class='bad'>AUSENTE (é por isso que o checkout falha)</span>");
  }
?></pre>

<p style="color:#8a8472;margin-top:30px">⚠️ Apague este arquivo (admin/dite-check.php) depois de configurar.</p>
</body></html>
