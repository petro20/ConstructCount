<?php
/* projetos.php — MURAL público: projetos abertos esperando preço.
   Assinantes com o pacote do ofício veem o selo "combina com seu pacote". */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();
prj_cleanup();   // retenção: solta os PDFs de projetos encerrados há 60+ dias

$trade = (string) ($_GET['trade'] ?? '');
$q = trim((string) ($_GET['q'] ?? ''));
$rows = prj_list($trade, $q);
$u = current_user();
$mods = $u ? prj_user_modules((int) $u['id']) : [];

layout_top(t('prj_board_title'));
?>
<div class="card">
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <h2 style="margin:0"><?= h(t('prj_board_title')) ?></h2>
    <span class="muted"><?= h(t('prj_board_sub')) ?></span>
    <span style="flex:1"></span>
    <a class="btn" href="<?= h(url('publicar.php')) ?>">＋ <?= h(t('prj_post_btn_short')) ?></a>
  </div>
  <form method="get" style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 4px">
    <select name="trade" onchange="this.form.submit()">
      <option value=""><?= h(t('prj_all_trades')) ?></option>
      <?php foreach (PRJ_TRADES as $tr): ?>
        <option value="<?= h($tr) ?>" <?= $trade === $tr ? 'selected' : '' ?>><?= h(prj_trade_label($tr)) ?></option>
      <?php endforeach; ?>
    </select>
    <input name="q" value="<?= h($q) ?>" placeholder="<?= h(t('prj_search_ph')) ?>" style="min-width:220px">
    <button class="btn ghost"><?= h(t('prj_search')) ?></button>
  </form>
</div>

<?php if (!$rows): ?>
  <div class="card"><p class="muted"><?= h(t('prj_empty')) ?></p></div>
<?php else: ?>
  <?php foreach ($rows as $p): $ptr = array_filter(explode(',', (string) $p['trades']));
        $match = $u && array_intersect($ptr, $mods); ?>
    <div class="card" style="margin-top:12px">
      <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">
        <h3 style="margin:0"><a href="<?= h(url('projeto.php?id=' . (int) $p['id'])) ?>"><?= h($p['title']) ?></a></h3>
        <?php if ($match): ?><span class="badge b-ok">✓ <?= h(t('prj_match')) ?></span><?php endif; ?>
        <span style="flex:1"></span>
        <span class="muted"><?= h(t('prj_bids')) ?>: <b><?= (int) $p['n_bids'] ?></b></span>
      </div>
      <p class="muted" style="margin:6px 0 0">
        📍 <?= h($p['region']) ?> · 🏢 <?= h($p['company']) ?>
        <?php if (!empty($p['deadline'])): ?> · ⏳ <?= h(t('prj_deadline')) ?>: <?= h(fmt_date($p['deadline'])) ?><?php endif; ?>
        <?php if (!empty($p['pdf_path'])): ?> · 📄 PDF<?php endif; ?><?php if (!empty($p['pdf_link'])): ?> · 🔗 link<?php endif; ?>
      </p>
      <p style="margin:8px 0 0">
        <?php foreach ($ptr as $tr): ?><span class="badge" style="margin-right:6px"><?= h(prj_trade_label($tr)) ?></span><?php endforeach; ?>
      </p>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
<?php layout_bottom(); ?>
