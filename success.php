<?php
require __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/i18n.php';
require_login();
flash(t('pay_ok'));                         // a licença é criada/renovada pelo webhook do Stripe
redirect(url('dashboard.php'));
