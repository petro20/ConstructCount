<?php
require __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/i18n.php';
require_login();
flash(t('pay_cancel'));
redirect(url('dashboard.php'));
