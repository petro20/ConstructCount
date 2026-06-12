<?php
/* projetos.php — MURAL público: projetos abertos esperando preço.
   Assinantes com o pacote do ofício veem o selo "combina com seu pacote". */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();
prj_cleanup();           // retenção: solta os PDFs de projetos encerrados há 60+ dias
prj_check_deadlines();   // fiscal dos prazos (multas por descumprimento)

$trade = (string) ($_GET['trade'] ?? '');
$q = trim((string) ($_GET['q'] ?? ''));
$rows = prj_list($trade, $q);
$u = current_user();
$mods = $u ? prj_user_modules((int) $u['id']) : [];
$regionBoard = ($q === '' && $trade === '') ? prj_region_board() : [];   // quadro só na visão geral
$tradePlan = ['framing' => 'framing', 'drywall' => 'drywall', 'insulation' => 'insulation', 'paint' => 'paint', 'windows_doors' => 'mensal'];

layout_top(t('prj_board_title'));
?>
<div class="card">
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <h2 style="margin:0"><?= h(t('prj_board_title')) ?></h2>
    <span class="muted"><?= h(t('prj_board_sub')) ?></span>
    <span style="flex:1"></span>
    <a class="btn ghost" href="<?= h(url('meus-projetos.php')) ?>"><?= h(t('prj_recover_link')) ?></a>
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

<?php if ($regionBoard): ?>
  <div class="card" style="margin-top:12px">
    <h3 style="margin:0 0 4px">📍 <?= h(t('prj_region_tbl')) ?></h3>
    <p class="muted" style="margin:0 0 10px;font-size:12.5px"><?= h(t('prj_region_board_hint')) ?></p>
    <table style="width:100%">
      <tr><th><?= h(t('prj_t_region')) ?></th><th style="text-align:center">⏳ <?= h(t('prj_s_waiting')) ?></th><th><?= h(t('prj_f_trades')) ?></th><th></th></tr>
      <?php foreach ($regionBoard as $rg): ?>
        <tr>
          <td><b><?= h((string) $rg['region']) ?></b></td>
          <td style="text-align:center"><b><?= (int) $rg['open_n'] ?></b></td>
          <td>
            <?php foreach ($rg['trades'] as $tr => $n): $owned = $u && in_array($tr, $mods, true); ?>
              <span style="display:inline-flex;align-items:center;gap:4px;margin:2px 6px 2px 0">
                <a class="badge<?= $owned ? ' b-ok' : '' ?>" href="<?= h(url('projetos.php?trade=' . $tr . '&q=' . urlencode((string) $rg['region']))) ?>"><?= h(prj_trade_label($tr)) ?> · <?= (int) $n ?></a>
                <?php if ($u && !$owned && isset($tradePlan[$tr])): ?>
                  <a href="<?= h(url('checkout.php?plan=' . $tradePlan[$tr])) ?>" title="<?= h(t('prj_buy_pkg')) ?>">🛒</a>
                <?php endif; ?>
              </span>
            <?php endforeach; ?>
          </td>
          <td style="text-align:right;white-space:nowrap"><a href="<?= h(url('projetos.php?q=' . urlencode((string) $rg['region']))) ?>"><?= h(t('prj_see')) ?> →</a></td>
        </tr>
      <?php endforeach; ?>
    </table>
  </div>
<?php endif; ?>

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
