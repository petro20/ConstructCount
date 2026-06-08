<?php
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/stripe.php';
$u = require_login();
$plan = (string) ($_GET['plan'] ?? 'mensal');
$urlc = stripe_checkout_url($u, $plan);
if ($urlc) { redirect($urlc); }
require_once __DIR__ . '/lib/i18n.php';
flash('Stripe não configurado ou plano inválido.');
redirect(url('dashboard.php'));
