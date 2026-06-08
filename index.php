<?php
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/license.php';
cfg_loaded();                                  // garante PLAN_DISPLAY etc. carregados

$checkKey = trim((string) ($_POST['key'] ?? ''));
$res = $checkKey !== '' ? lic_status_only($checkKey) : null;

$L = lang();
$plan_disp = function (string $plan) use ($L) {
  $d = (defined('PLAN_DISPLAY') ? PLAN_DISPLAY : [])[$plan] ?? null;
  $price = $d['price'] ?? '—';
  $per = $d['period_' . $L] ?? ($d['period_pt'] ?? '');
  return [$price, $per];
};
[$mPrice, $mPer] = $plan_disp('mensal');
[$aPrice, $aPer] = $plan_disp('anual');

layout_top(t('app_name'));
?>
<section class="hero">
  <img src="assets/hero.png" alt="ConstructCount" class="hero-logo">
  <h1><?= h(t('hero_h1')) ?></h1>
  <p><?= h(t('hero_sub')) ?></p>
  <div class="hero-cta">
    <a class="btn lg" href="<?= h(url('register.php')) ?>"><?= h(t('cta_start')) ?></a>
    <a class="btn ghost lg" href="#planos"><?= h(t('cta_plans')) ?></a>
  </div>
</section>

<section class="sec">
  <h2 class="sec-title"><?= h(t('feat_title')) ?></h2>
  <div class="features">
    <?php foreach (['f1','f2','f3','f4','f5','f6'] as $i => $f): $ic = ['🤖','📐','📄','🗺️','🌐','💻'][$i]; ?>
      <div class="feat"><div class="feat-ic"><?= $ic ?></div><h3><?= h(t($f.'_t')) ?></h3><p><?= h(t($f.'_d')) ?></p></div>
    <?php endforeach; ?>
  </div>
</section>

<section class="sec">
  <h2 class="sec-title"><?= h(t('how_title')) ?></h2>
  <div class="steps">
    <?php foreach (['how1','how2','how3'] as $n => $s): ?>
      <div class="step"><div class="step-n"><?= $n + 1 ?></div><h3><?= h(t($s)) ?></h3><p><?= h(t($s.'d')) ?></p></div>
    <?php endforeach; ?>
  </div>
</section>

<section class="sec" id="planos">
  <h2 class="sec-title"><?= h(t('pricing_title')) ?></h2>
  <div class="grid">
    <div class="card plan center">
      <h3><?= h(t('monthly')) ?></h3>
      <div class="price"><?= h($mPrice) ?><small><?= h($mPer) ?></small></div>
      <ul class="plist"><li><?= h(t('feat_inc')) ?></li><li>1 <?= h(t('per_dev')) ?></li></ul>
      <a class="btn block" href="<?= h(url('checkout.php?plan=mensal')) ?>"><?= h(t('subscribe')) ?></a>
    </div>
    <div class="card plan center hot">
      <span class="ribbon"><?= h(t('best')) ?></span>
      <h3><?= h(t('annual')) ?></h3>
      <div class="price"><?= h($aPrice) ?><small><?= h($aPer) ?></small></div>
      <ul class="plist"><li><?= h(t('feat_inc')) ?></li><li>1 <?= h(t('per_dev')) ?></li></ul>
      <a class="btn block" href="<?= h(url('checkout.php?plan=anual')) ?>"><?= h(t('subscribe')) ?></a>
    </div>
  </div>
</section>

<section class="sec">
  <div class="card">
    <h2><?= h(t('check_license')) ?></h2>
    <form method="post" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <input class="key" name="key" value="<?= h($checkKey) ?>" placeholder="CC-XXXX-XXXX-XXXX-XXXX" style="flex:1;min-width:240px">
      <button class="btn"><?= h(t('check_license')) ?></button>
    </form>
    <?php if ($res !== null): $ok = !empty($res['approved']); ?>
      <p style="margin-top:14px"><span class="badge <?= $ok ? 'b-ok' : 'b-bad' ?>"><?= $ok ? '✓ ' . h(t('approved')) : '✗ ' . h(t('not_approved')) ?></span></p>
      <?php if ($res['found']): ?>
        <table>
          <tr><th><?= h(t('status')) ?></th><td><?= h($res['status']) ?></td></tr>
          <tr><th><?= h(t('plan')) ?></th><td><?= h($res['plan']) ?></td></tr>
          <tr><th><?= h(t('expires')) ?></th><td><?= h(fmt_date($res['expires_at'])) ?></td></tr>
          <tr><th><?= h(t('devices')) ?></th><td><?= (int) $res['devices'] ?> / <?= (int) $res['max_devices'] ?></td></tr>
        </table>
      <?php else: ?><p class="err"><?= h($res['reason']) ?></p><?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<section class="sec center cta-final">
  <h2><?= h(t('final_cta')) ?></h2>
  <a class="btn lg" href="<?= h(url('register.php')) ?>"><?= h(t('cta_start')) ?></a>
</section>
<?php layout_bottom(); ?>
