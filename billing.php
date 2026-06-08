<?php
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/dite.php';
require __DIR__ . '/lib/license.php';
require_once __DIR__ . '/lib/i18n.php';
$u = require_login();

// acha a assinatura ativa do usuário (subscription_id guardado na coluna stripe_subscription_id)
$active = null;
foreach (lic_for_user((int) $u['id']) as $l) {
  if (in_array($l['status'], ['active', 'past_due'], true) && !empty($l['stripe_subscription_id'])) { $active = $l; break; }
}
if (!$active) { flash('Nenhuma assinatura ativa para gerenciar.'); redirect(url('dashboard.php')); }

$r = dite_cancel_subscription((string) $active['stripe_subscription_id']);
if (($r['_status'] ?? 0) >= 200 && ($r['_status'] ?? 0) < 300) {
  flash('Cancelamento solicitado. Seu acesso continua até o fim do período vigente.');
} else {
  flash('Não foi possível cancelar agora. Tente novamente ou fale com o suporte.');
}
redirect(url('dashboard.php'));
