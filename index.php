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
<style>
  /* landing: vídeo FIXO no fundo + menu transparente por cima (conteúdo rola sobre o vídeo) */
  html,body{overflow-x:hidden;max-width:100%;scrollbar-width:none;-ms-overflow-style:none}  /* sem barra horizontal + tela "infinita" (esconde scrollbar, rolagem segue) */
  html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;display:none}
  .vhero-by{margin-top:24px;color:#cabfa4;font-size:13px;text-shadow:0 1px 10px rgba(0,0,0,.6)}
  .vhero-by a{color:#e3b653;font-weight:700;text-decoration:none}
  .vhero-by a:hover{text-decoration:underline}
  .nav{position:absolute;top:0;left:0;right:0;max-width:1160px;margin:0 auto;z-index:30;background:transparent;border-bottom:0;padding-left:28px;padding-right:28px}
  main{position:relative;max-width:1100px}         /* área de conteúdo mais larga (Dite) → cards maiores. Sem z-index: vídeo fixo vai pro fundo */
  .vhero{min-height:0;padding-top:108px;padding-bottom:56px}   /* altura guiada pelo conteúdo (sem vão de 100vh) → cards sobem, hero cheio estilo Dite */
  .vhero-grid,.vhero-overlay{display:none}                     /* remove a "máscara" (grade/vinheta presa na caixa do hero); o fundo é o vídeo escurecido global */
  .sec{margin:48px 0}                                          /* mais respiro entre seções (Dite) */
  .vhero-inner{max-width:1040px}                               /* container mais largo (Dite) → título respira */
  .vhero-h1{font-size:clamp(40px,7.8vw,90px);line-height:1.0;letter-spacing:-.03em;background:none;-webkit-background-clip:border-box;background-clip:border-box;-webkit-text-fill-color:#f1d488;color:#f1d488;animation:none;text-shadow:0 3px 22px rgba(0,0,0,.6)}   /* título BEM maior + SEM máscara/shine: cor sólida e limpa */
  .vhero-sub{font-size:clamp(18px,2.4vw,24px);max-width:720px;text-shadow:0 2px 14px rgba(0,0,0,.7)} /* subtítulo maior + sombra p/ legibilidade */
  .vhero-stats{gap:48px;margin-top:46px}
  .vstat b{font-size:clamp(56px,7.4vw,96px);text-shadow:0 3px 20px rgba(0,0,0,.8)}     /* numeros (10x/3/+) DOBRADOS */
  .vstat span{font-size:clamp(18px,2.2vw,26px);color:#f0e7d1;text-shadow:0 2px 14px rgba(0,0,0,.8)} /* rotulos dobrados */
  .vhero-inner .hero-logo{display:block;height:auto;width:min(200px,52%);margin:0 auto 16px}
  .feat,.card,.plan{background:rgba(24,20,12,.72);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
  /* TEXTO DOS CARDS maior (estava pequeno) */
  .feat{padding:30px 26px}                                     /* CARDS maiores (mais presença) */
  .feat-ic{font-size:36px;margin-bottom:14px}                  /* ícone maior */
  .feat h3{font-size:24px;margin:.3em 0 .2em}                  /* título do card maior */
  .feat p{font-size:18.5px;line-height:1.6}                    /* descrição do card BEM maior/legível */
  .features{gap:22px}                                          /* mais espaço entre os cards */
  .step h3{font-size:21px}
  .step p{font-size:17px;line-height:1.55}
  .plist{font-size:17px}
  .sec-title{text-shadow:0 2px 16px rgba(0,0,0,.6);font-size:28px}   /* títulos de seção maiores */
  /* rodapé destacado sobre o vídeo (crédito do desenvolvedor bem visível) */
  footer{position:relative;z-index:2;text-align:center;background:rgba(12,10,6,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(53,44,29,.7);border-radius:12px;color:#dccfb2;margin-top:30px;font-size:13.5px}
  footer a{color:#e3b653;font-weight:700}
  /* ===== ESCALA EXATA DO DITE (medida no site dele) ===== */
  body{font-size:16px}                                              /* text-base */
  .vhero-h1{font-size:clamp(36px,5vw,48px);line-height:1.12;letter-spacing:-.02em}  /* text-4xl -> 5xl (48px) */
  .vhero-sub{font-size:clamp(16px,1.8vw,18px);max-width:600px}      /* text-base -> text-lg (18px) */
  .sec-title{font-size:24px}                                        /* text-2xl */
  .price{font-size:30px}                                            /* text-3xl */
  .feat h3,.step h3,.plan h3{font-size:18px}                        /* título do card (~text-lg) */
  .feat p,.step p,.plist,.plist li,main p,main li,main label,main td,main th{font-size:14px;line-height:1.6}  /* text-sm (14px) */
  .vhero-badge,.vhero-by,footer{font-size:12px}                     /* text-xs */
  .vstat b{font-size:clamp(28px,3.6vw,36px)}                        /* stats proeminentes, no tom (text-3xl/4xl) */
  .vstat span{font-size:13px}
  .feat-ic{font-size:22px;margin-bottom:12px}
  .feat{padding:22px}.features{gap:18px}
  .btn{font-size:14px}.btn.lg{font-size:16px}
  .bgfix-overlay{background:linear-gradient(180deg,rgba(8,7,4,.74) 0%,rgba(8,7,4,.85) 100%)}  /* fundo escuro/limpo (Dite) — texto pequeno fica legível */
  /* MENU (topo) — tamanho estilo Dite (moderado) */
  .nav .brand-name{font-size:20px}
  .nav .brand-logo{height:38px}
  .nav .lg{font-size:15px;padding:5px 9px}
  .nav .btn{font-size:15px;padding:10px 18px}
  .nav{padding-top:16px;padding-bottom:16px}
</style>
<video class="bgfix-vid" autoplay muted loop playsinline preload="auto" poster="assets/hero.png">
  <source src="assets/video/hero-office-ny.mp4" type="video/mp4">
</video>
<div class="bgfix-overlay" aria-hidden="true"></div>

<section class="vhero">
  <div class="vhero-grid" aria-hidden="true"></div>
  <div class="vhero-overlay" aria-hidden="true"></div>
  <div class="vhero-inner">
    <img src="assets/hero.png" alt="ConstructCount" class="hero-logo">
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
    <p class="vhero-by"><?= h(t('dev_by')) ?> <a href="https://m2pb.com" target="_blank" rel="noopener">M2PB</a></p>
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
  <?php $pkgs = function_exists('cc_portal_packages') ? cc_portal_packages() : null; if ($pkgs): ?>
    <div class="grid">
      <?php foreach ($pkgs as $p):
        $per = $p['per_' . $L] ?? ($p['per'] ?? '');
        $name = $p['name_' . $L] ?? ($p['name'] ?? '');
        $desc = $p['desc_' . $L] ?? ($p['desc'] ?? ''); ?>
        <div class="card plan center<?= !empty($p['featured']) ? ' hot' : '' ?>">
          <?php if (!empty($p['featured'])): ?><span class="ribbon"><?= h(t('best')) ?></span><?php endif; ?>
          <h3><?= h($name) ?></h3>
          <div class="price"><?= h($p['price']) ?><small><?= h($per) ?></small></div>
          <?php if ($desc !== ''): ?><ul class="plist"><li><?= h($desc) ?></li></ul><?php endif; ?>
          <a class="btn block" href="<?= h(url('checkout.php?plan=' . urlencode($p['plan']))) ?>"><?= h(t('subscribe')) ?></a>
        </div>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
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
  <?php endif; ?>
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

  // ---- música ambiente: INICIA NO PRIMEIRO CLIQUE (navegador exige gesto p/ tocar com som) ----
  var bgm = document.getElementById('bgm'), mbtn = document.getElementById('musicBtn');
  if (bgm && mbtn) {
    bgm.volume = 0.28;
    var MKEY = 'cc_music2';                                 // chave nova: zera qualquer "desligado" de teste
    var want = localStorage.getItem(MKEY) !== 'off';        // padrão: ligada
    function micon() {
      var playing = want && !bgm.paused;
      mbtn.textContent = playing ? '🔊' : (want ? '🎵' : '🔇');
      mbtn.classList.toggle('playing', playing);
    }
    function onFirst() {
      document.removeEventListener('click', onFirst, true);
      document.removeEventListener('touchstart', onFirst, true);
      document.removeEventListener('keydown', onFirst, true);
      if (want) bgm.play().then(micon).catch(micon);
    }
    document.addEventListener('click', onFirst, true);      // 1º clique em qualquer lugar (fase de captura)
    document.addEventListener('touchstart', onFirst, true);
    document.addEventListener('keydown', onFirst, true);
    mbtn.addEventListener('click', function (e) {
      e.stopPropagation();
      want = !want; localStorage.setItem(MKEY, want ? 'on' : 'off');
      if (want) bgm.play().catch(function () {}); else bgm.pause();
      micon();
    });
    bgm.addEventListener('play', micon); bgm.addEventListener('pause', micon);
    micon();
  }
})();
</script>
<?php layout_bottom(); ?>
