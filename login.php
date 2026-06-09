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
<div class="auth">
  <div class="card form">
  <img class="auth-logo" src="assets/hero.png" alt="ConstructCount">
  <h2><?= h(t('login')) ?></h2>
  <p class="auth-sub"><?= h(t('login_sub')) ?></p>
  <?php if ($err): ?><p class="err"><?= h(t('err_login')) ?></p><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label><?= h(t('email')) ?></label><input name="email" type="email" required autofocus>
    <label><?= h(t('password')) ?></label><input name="password" type="password" required>
    <button class="btn block"><?= h(t('login')) ?></button>
  </form>
  <p class="muted center"><?= h(t('no_account')) ?> <a href="<?= h(url('register.php')) ?>"><?= h(t('register')) ?></a></p>
  </div>
</div>
<?php layout_bottom(); ?>
