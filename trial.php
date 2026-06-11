<?php
/* =========================================================================
   trial.php — TESTE GRÁTIS de 7 dias do combo Parede completa, SEM cartão.
   Logado, emite uma licença 'parede_trial' (módulos do combo) válida por
   7 dias — direto no banco, sem passar pelo gateway. 1 trial por conta.
   Para continuar depois, o cliente assina normal (checkout.php?plan=parede).
   ========================================================================= */
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/license.php';
require_once __DIR__ . '/lib/i18n.php';

$u = require_login();

// 1 trial por conta (qualquer estado: ativo, expirado…)
$st = db()->prepare("SELECT id FROM licenses WHERE user_id = ? AND plan = 'parede_trial' LIMIT 1");
$st->execute([(int) $u['id']]);
if ($st->fetch()) {
  flash(t('trial_used'));
  redirect(url('dashboard.php'));
}

// quem já tem o combo pago não precisa de trial
$has = false;
foreach (lic_for_user((int) $u['id']) as $l) {
  if (in_array('wall_combo', lic_packages($l), true) && $l['status'] === 'active') { $has = true; break; }
}
if ($has) {
  flash(t('trial_has_combo'));
  redirect(url('dashboard.php'));
}

lic_create((int) $u['id'], 'parede_trial', date('Y-m-d H:i:s', time() + 7 * 86400), 1, null);
flash(t('trial_started'));
redirect(url('dashboard.php'));
