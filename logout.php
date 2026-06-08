<?php
require __DIR__ . '/lib/auth.php';
auth_logout();
redirect(url('index.php'));
