<?php
require __DIR__ . '/lib/layout.php';
$err = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!csrf_check()) $err = 'csrf';
  elseif (empty($_POST['accept_terms'])) $err = 'terms';   // contrato de uso é obrigatório
  else {
    $r = auth_register((string) ($_POST['name'] ?? ''), (string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''));
    if ($r['ok']) {
      // registra o ACEITE dos termos na conta (data + versão)
      try {
        db()->exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at DATETIME NULL, ADD COLUMN IF NOT EXISTS terms_version VARCHAR(16) NULL');
        db()->prepare('UPDATE users SET terms_accepted_at=NOW(), terms_version=? WHERE email=?')
            ->execute(['2026-06-12', trim(strtolower((string) ($_POST['email'] ?? '')))]);
      } catch (Throwable $e) {}
      redirect(after_login_url());   // volta pro destino (trial/checkout) ou dashboard
    }
    $err = $r['err'];
  }
}
$msg = $err === 'exists' ? t('err_exists') : ($err === 'terms' ? t('terms_required_app') : ($err ? t('err_fields') : ''));
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
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;margin:10px 0;font-weight:400">
      <input type="checkbox" name="accept_terms" value="1" required style="margin-top:3px;width:auto">
      <span><?= h(t('terms_accept')) ?> <a href="<?= h(url('termos.php')) ?>" target="_blank"><b><?= h(t('terms_app_title')) ?></b></a> — <?= h(t('terms_accept_app2')) ?></span>
    </label>
    <button class="btn block"><?= h(t('register')) ?></button>
  </form>
  <p class="muted center"><?= h(t('have_account')) ?> <a href="<?= h(url('login.php')) ?>"><?= h(t('login')) ?></a></p>
  </div>
</div>
<?php layout_bottom(); ?>
