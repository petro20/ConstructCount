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
<section class="vhero">
  <video class="vhero-vid" autoplay muted loop playsinline preload="auto" poster="assets/hero.png">
    <source src="assets/video/hero-construction.mp4" type="video/mp4">
  </video>
  <div class="vhero-grid" aria-hidden="true"></div>
  <div class="vhero-overlay" aria-hidden="true"></div>
  <div class="vhero-inner">
    <span class="vhero-badge"><?= h(t('hero_badge')) ?></span>
    <h1 class="vhero-h1"><?= h(t('hero_h1')) ?></h1>
    <p class="vhero-sub"><?= h(t('hero_sub')) ?></p>
    <div class="hero-cta">
      <a class="btn lg glow" href="<?= h(url('register.php')) ?>"><?= h(t('cta_start')) ?></a>
      <a class="btn ghost lg" href="#planos"><?= h(t('cta_plans')) ?></a>
    </div>
    <div class="vhero-stats">
      <div class="vstat"><b><span class="vnum" data-to="10">0</span><span class="vsuf">×</span></b><span><?= h(t('stat_fast')) ?></span></div>
      <div class="vstat"><b><span class="vnum" data-to="3">0</span></b><span><?= h(t('stat_min')) ?></span></div>
      <div class="vstat"><b><span class="vsuf">＋</span></b><span><?= h(t('stat_rep')) ?></span></div>
    </div>
  </div>
  <a href="#features" class="vhero-scroll" aria-hidden="true">▾</a>
</section>
<audio id="bgm" loop preload="auto"><source src="assets/audio/hero-music.mp3" type="audio/mpeg"></audio>
<button id="musicBtn" class="music-btn" type="button" title="Música ligada/desligada" aria-label="Música">🎵</button>

<section class="sec reveal" id="features">
  <h2 class="sec-title"><?= h(t('feat_title')) ?></h2>
  <div class="features">
    <?php foreach (['f1','f2','f3','f4','f5','f6'] as $i => $f): $ic = ['🤖','📐','📄','🗺️','🌐','💻'][$i]; ?>
      <div class="feat"><div class="feat-ic"><?= $ic ?></div><h3><?= h(t($f.'_t')) ?></h3><p><?= h(t($f.'_d')) ?></p></div>
    <?php endforeach; ?>
  </div>
</section>

<section class="sec reveal">
  <h2 class="sec-title"><?= h(t('how_title')) ?></h2>
  <div class="steps">
    <?php foreach (['how1','how2','how3'] as $n => $s): ?>
      <div class="step"><div class="step-n"><?= $n + 1 ?></div><h3><?= h(t($s)) ?></h3><p><?= h(t($s.'d')) ?></p></div>
    <?php endforeach; ?>
  </div>
</section>

<section class="sec reveal" id="planos">
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

<section class="sec center cta-final reveal">
  <h2><?= h(t('final_cta')) ?></h2>
  <a class="btn lg" href="<?= h(url('register.php')) ?>"><?= h(t('cta_start')) ?></a>
</section>
<script>
(function () {
  // contadores animados (ease-out)
  document.querySelectorAll('.vnum').forEach(function (el) {
    var to = parseFloat(el.dataset.to || '0'), dur = 1400, t0 = null;
    function step(ts) { if (!t0) t0 = ts; var p = Math.min((ts - t0) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
  // revelar seções ao rolar
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // ---- música ambiente: liga por padrão; navegador exige 1º gesto p/ tocar com som ----
  var bgm = document.getElementById('bgm'), mbtn = document.getElementById('musicBtn');
  if (bgm && mbtn) {
    bgm.volume = 0.35;
    var want = localStorage.getItem('cc_music') !== 'off';   // padrão: ligada
    function icon() {
      var playing = want && !bgm.paused;
      mbtn.textContent = playing ? '🔊' : (want ? '🎵' : '🔇');
      mbtn.classList.toggle('playing', playing);
    }
    function tryPlay() { if (want) bgm.play().then(icon).catch(function () {}); }
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, function once() { tryPlay(); window.removeEventListener(ev, once); }, { passive: true });
    });
    mbtn.addEventListener('click', function (e) {
      e.stopPropagation();
      want = !want; localStorage.setItem('cc_music', want ? 'on' : 'off');
      if (want) bgm.play().catch(function () {}); else bgm.pause();
      icon();
    });
    bgm.addEventListener('play', icon); bgm.addEventListener('pause', icon);
    icon();
  }
})();
</script>
<?php layout_bottom(); ?>
