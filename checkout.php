<?php
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/dite.php';
require_once __DIR__ . '/lib/i18n.php';
$u = require_login();
$plan = (string) ($_GET['plan'] ?? 'mensal');
$r = dite_create_subscription($u, $plan);
if ($r && !empty($r['checkout_url'])) {
  redirect($r['checkout_url']);            // o cliente paga no Dite; o webhook libera a licença
}
flash('Não foi possível iniciar o checkout. Verifique a configuração do gateway (Dite).');
redirect(url('dashboard.php'));
