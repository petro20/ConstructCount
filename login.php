<?php
require __DIR__ . '/lib/layout.php';
$err = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!csrf_check()) $err = 'csrf';
  else {
    $r = auth_login((string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''));
    if ($r['ok']) redirect(url('dashboard.php'));
    $err = $r['err'];
  }
}
layout_top(t('login'));
?>
<div class="card form">
  <h2><?= h(t('login')) ?></h2>
  <?php if ($err): ?><p class="err"><?= h(t('err_login')) ?></p><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label><?= h(t('email')) ?></label><input name="email" type="email" required autofocus>
    <label><?= h(t('password')) ?></label><input name="password" type="password" required>
    <button class="btn block" style="margin-top:16px"><?= h(t('login')) ?></button>
  </form>
  <p class="muted center" style="margin-top:14px"><?= h(t('no_account')) ?> <a href="<?= h(url('register.php')) ?>"><?= h(t('register')) ?></a></p>
</div>
<?php layout_bottom(); ?>
