<?php
require __DIR__ . '/lib/layout.php';
$err = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!csrf_check()) $err = 'csrf';
  else {
    $r = auth_register((string) ($_POST['name'] ?? ''), (string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''));
    if ($r['ok']) redirect(url('dashboard.php'));
    $err = $r['err'];
  }
}
$msg = $err === 'exists' ? t('err_exists') : ($err ? t('err_fields') : '');
layout_top(t('register'));
?>
<div class="auth">
  <div class="card form">
  <img class="auth-logo" src="assets/hero.png" alt="ConstructCount">
  <h2><?= h(t('register')) ?></h2>
  <p class="auth-sub"><?= h(t('register_sub')) ?></p>
  <?php if ($msg): ?><p class="err"><?= h($msg) ?></p><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label><?= h(t('name')) ?></label><input name="name" required>
    <label><?= h(t('email')) ?></label><input name="email" type="email" required>
    <label><?= h(t('password')) ?></label><input name="password" type="password" minlength="6" required>
    <button class="btn block"><?= h(t('register')) ?></button>
  </form>
  <p class="muted center"><?= h(t('have_account')) ?> <a href="<?= h(url('login.php')) ?>"><?= h(t('login')) ?></a></p>
  </div>
</div>
<?php layout_bottom(); ?>
