<?php
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/dite.php';
require_once __DIR__ . '/lib/i18n.php';
$u = require_login();
$plan = (string) ($_GET['plan'] ?? 'mensal');
// MURAL é vendido POR REGIÃO (US$/mês por região): board exige escolher a região.
// O cliente também escolhe QUANTOS MESES pagar: 1 = assinatura recorrente;
// 3/6/12 = pagamento único pré-pago (licença com vencimento certo, sem renovação).
$region = strtoupper(trim((string) ($_GET['region'] ?? '')));
if (!preg_match('/^[A-Z]{2}$/', $region)) $region = '';
if ($plan === 'board' && $region === '') { redirect(url('board-regioes.php')); }
$months = (int) ($_GET['months'] ?? 1);
if (!in_array($months, [1, 3, 6, 12], true)) $months = 1;
if ($plan === 'board' && $months > 1) {
  $def = dite_plan_def('board');
  $unit = $def ? (float) $def['amount'] : 10.0;
  $name = 'Mural de projetos — ' . $region . ' — ' . $months . ' meses';
  $r = dite_create_payment($u, 'board', $region, $months, $unit * $months, $name);
} else {
  $r = dite_create_subscription($u, $plan, $plan === 'board' ? $region : null);
}
if ($r && !empty($r['checkout_url'])) {
  redirect($r['checkout_url']);            // o cliente paga no Dite; o webhook libera a licença
}
flash('Não foi possível iniciar o checkout. Verifique a configuração do gateway (Dite).');
redirect(url('dashboard.php'));
