<?php
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/stripe.php';
$u = require_login();
$urlb = stripe_billing_portal_url($u);
if ($urlb) redirect($urlb);
require_once __DIR__ . '/lib/i18n.php';
flash('Stripe não configurado.');
redirect(url('dashboard.php'));
