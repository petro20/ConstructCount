<?php
/* board-regioes.php — escolha da REGIÃO do Mural de projetos.
   O Mural é vendido POR REGIÃO (US$ 10/mês cada): o assinante escolhe os
   ESTADOS onde quer dar preço; só projetos dessas regiões liberam proposta.
   Mostra a demanda (projetos abertos por UF) pra ajudar a escolher. */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();
$u = require_login();

$STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

// demanda: projetos ABERTOS por UF
$demand = [];
try {
  foreach (db()->query("SELECT region FROM projects WHERE status='open'")->fetchAll() as $r) {
    $k = prj_region_key((string) $r['region']);
    $demand[$k] = ($demand[$k] ?? 0) + 1;
  }
} catch (Throwable $e) {}
arsort($demand);

$mine = prj_user_board_regions((int) $u['id']);   // regiões já assinadas ('*' = todas)
$all = in_array('*', $mine, true);

$fee = '10';
$def = function_exists('cc_plan_catalog') ? (cc_plan_catalog()['board'] ?? null) : null;
if ($def) $fee = rtrim(rtrim(number_format((float) $def['amount'], 2), '0'), '.');

layout_top(t('prj_region_pick_title'));
?>
<div class="card" style="max-width:760px;margin:0 auto">
  <h2>📋 <?= h(t('prj_region_pick_title')) ?></h2>
  <p class="muted"><?= h(str_replace('{fee}', $fee, t('prj_region_pick_sub'))) ?></p>
  <?php if ($all): ?>
    <p class="badge b-ok" style="margin-top:10px">✓ <?= h(t('prj_region_all')) ?></p>
  <?php elseif ($mine): ?>
    <p style="margin-top:10px"><b><?= h(t('prj_region_mine')) ?>:</b>
      <?php foreach ($mine as $rg): ?><span class="badge b-ok" style="margin-left:6px">✓ <?= h($rg) ?></span><?php endforeach; ?>
    </p>
  <?php endif; ?>

  <?php if ($demand): ?>
    <h3 style="margin:16px 0 6px">🔥 <?= h(t('prj_region_demand')) ?></h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <?php foreach ($demand as $uf => $n): $owned = $all || in_array($uf, $mine, true); ?>
        <?php if ($owned): ?>
          <span class="badge b-ok">✓ <?= h($uf) ?> · <?= (int) $n ?> <?= h(t('prj_region_n_open')) ?></span>
        <?php else: ?>
          <a class="btn ghost" href="<?= h(url('checkout.php?plan=board&region=' . urlencode($uf))) ?>">🛒 <?= h($uf) ?> · <?= (int) $n ?> <?= h(t('prj_region_n_open')) ?> — US$ <?= h($fee) ?><?= h(t('per_month_short')) ?></a>
        <?php endif; ?>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <h3 style="margin:18px 0 6px"><?= h(t('prj_region_pick_other')) ?></h3>
  <form method="get" action="<?= h(url('checkout.php')) ?>" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
    <input type="hidden" name="plan" value="board">
    <label><?= h(t('prj_t_region')) ?> (UF)<br>
      <select name="region" style="min-width:140px">
        <?php foreach ($STATES as $uf): ?>
          <option value="<?= h($uf) ?>" <?= ($all || in_array($uf, $mine, true)) ? 'disabled' : '' ?>><?= h($uf) ?><?= isset($demand[$uf]) ? ' · ' . (int) $demand[$uf] : '' ?><?= ($all || in_array($uf, $mine, true)) ? ' ✓' : '' ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <button class="btn">💳 <?= h(t('prj_region_pick_btn')) ?> — US$ <?= h($fee) ?><?= h(t('per_month_short')) ?></button>
  </form>
  <p class="muted" style="margin-top:12px;font-size:12.5px"><?= h(t('prj_region_pick_note')) ?></p>
  <p style="margin-top:8px"><a href="<?= h(url('projetos.php')) ?>">« <?= h(t('prj_board_title')) ?></a></p>
</div>
<?php layout_bottom(); ?>
