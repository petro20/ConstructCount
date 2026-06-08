<?php
/* =========================================================================
   api/dite-plans.php — CATÁLOGO DE PLANOS público (JSON) para o Dite importar.
   O gateway faz GET nesta URL e lê { plans: [{ name, amount, currency, interval }] }.
   Fonte: DITE_PLAN_CATALOG no config.php (nossa fonte da verdade).
   Configure no painel Apps do Dite o campo "URL do catálogo de planos":
     https://constructcount.com/api/dite-plans.php
   ========================================================================= */
declare(strict_types=1);
require __DIR__ . '/../lib/db.php';
cfg_loaded();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$cat = defined('DITE_PLAN_CATALOG') ? DITE_PLAN_CATALOG : [];
$plans = [];
foreach ($cat as $key => $d) {
  if (!is_array($d)) continue;
  $plans[] = [
    'name'     => (string) ($d['name'] ?? $key),
    'amount'   => (float) ($d['amount'] ?? 0),
    'currency' => (string) ($d['currency'] ?? 'USD'),
    'interval' => (string) ($d['interval'] ?? 'month'),
  ];
}
echo json_encode(['plans' => $plans], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
