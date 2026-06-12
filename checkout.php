<?php
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/dite.php';
require_once __DIR__ . '/lib/i18n.php';
$u = require_login();
$plan = (string) ($_GET['plan'] ?? 'mensal');
// MURAL é vendido POR REGIÃO (US$/mês por região): board exige escolher a região
$region = strtoupper(trim((string) ($_GET['region'] ?? '')));
if (!preg_match('/^[A-Z]{2}$/', $region)) $region = '';
if ($plan === 'board' && $region === '') { redirect(url('board-regioes.php')); }
$r = dite_create_subscription($u, $plan, $plan === 'board' ? $region : null);
if ($r && !empty($r['checkout_url'])) {
  redirect($r['checkout_url']);            // o cliente paga no Dite; o webhook libera a licença
}
flash('Não foi possível iniciar o checkout. Verifique a configuração do gateway (Dite).');
redirect(url('dashboard.php'));
