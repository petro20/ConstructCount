<?php
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/license.php';
require __DIR__ . '/lib/projects.php';
$u = require_login();
$lics = lic_for_user((int) $u['id']);
prj_ensure_schema();
$myBids = [];
try {
  $st = db()->prepare('SELECT pr.amount, pr.created_at, p.id pid, p.title, p.region, p.status FROM proposals pr JOIN projects p ON p.id = pr.project_id WHERE pr.user_id = ? ORDER BY pr.created_at DESC LIMIT 20');
  $st->execute([(int) $u['id']]);
  $myBids = $st->fetchAll();
} catch (Throwable $e) {}
$badge = function ($l) {
  $exp = !empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time();
  if ($l['status'] === 'active' && !$exp) return ['b-ok', '✓ ' . t('approved')];
  if ($l['status'] === 'past_due') return ['b-warn', 'past_due'];
  return ['b-bad', $exp ? t('not_approved') : $l['status']];
};
layout_top(t('dashboard'));
$L = lang();
// botões de TODOS os pacotes (à la carte, combo, Janelas, add-on) — do catálogo no código
$pkgBtns = function () use ($L) {
  if (!function_exists('cc_portal_packages')) {
    echo '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">'
      . '<a class="btn" href="' . h(url('checkout.php?plan=mensal')) . '">' . h(t('monthly')) . ' — ' . h(t('subscribe')) . '</a>'
      . '<a class="btn ghost" href="' . h(url('checkout.php?plan=anual')) . '">' . h(t('annual')) . ' — ' . h(t('subscribe')) . '</a></div>';
    return;
  }
  echo '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">';
  foreach (cc_portal_packages() as $p) {
    $name  = $p['name_' . $L] ?? ($p['name'] ?? $p['plan']);
    $per   = $p['per_' . $L] ?? ($p['per'] ?? '');
    $badge = $p['badge_' . $L] ?? ($p['badge'] ?? '');
    $cls   = !empty($p['featured']) ? 'btn' : 'btn ghost';
    echo '<a class="' . $cls . '" href="' . h(url('checkout.php?plan=' . urlencode((string) $p['plan']))) . '">'
      . h($name . ' — ' . ($p['price'] ?? '') . $per . ($badge !== '' ? ' · ' . $badge : '')) . '</a>';
    if (!empty($p['trial'])) echo '<a class="btn ghost" href="' . h(url('trial.php')) . '">' . h(t('start_trial')) . '</a>';
  }
  echo '</div>';
};
?>
<div class="card">
  <h2><?= h(t('my_licenses')) ?></h2>
  <?php if (!$lics): ?>
    <p class="muted"><?= h(t('no_licenses')) ?></p>
    <?php $pkgBtns(); ?>
  <?php else: ?>
    <table>
      <tr><th><?= h(t('key')) ?></th><th><?= h(t('package')) ?></th><th><?= h(t('plan')) ?></th><th><?= h(t('status')) ?></th><th><?= h(t('expires')) ?></th><th><?= h(t('devices')) ?></th><th></th></tr>
      <?php foreach ($lics as $l): [$cls, $txt] = $badge($l); ?>
        <tr>
          <td class="key"><?= h($l['license_key']) ?></td>
          <td><strong><?= h(lic_packages_label($l)) ?></strong></td>
          <td><?= h($l['plan']) ?></td>
          <td><span class="badge <?= $cls ?>"><?= h($txt) ?></span></td>
          <td><?= h(fmt_date($l['expires_at'])) ?></td>
          <td><?= (int) $l['dev'] ?>/<?= (int) $l['max_devices'] ?></td>
          <td><button class="btn ghost" onclick="navigator.clipboard.writeText('<?= h($l['license_key']) ?>');this.textContent='<?= h(t('copied')) ?>'"><?= h(t('copy')) ?></button></td>
        </tr>
      <?php endforeach; ?>
    </table>
    <p class="muted" style="margin-top:10px"><?= h(t('use_in_app')) ?></p>
    <?php if (defined('APP_DOWNLOAD_URL') && APP_DOWNLOAD_URL): ?>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--bd);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <a class="btn" href="<?= h(APP_DOWNLOAD_URL) ?>"><?= h(t('download_app')) ?></a>
        <span class="muted" style="font-size:13px"><?= h(t('download_hint')) ?></span>
      </div>
      <p class="muted" style="margin-top:8px;font-size:12.5px;line-height:1.5"><?= h(t('download_warn')) ?></p>
      <p style="margin-top:8px;font-size:12.5px;line-height:1.5;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px"><?= h(t('data_safe')) ?></p>
    <?php endif; ?>
    <div style="margin-top:12px"><a class="btn ghost" href="<?= h(url('billing.php')) ?>" onclick="return confirm('<?= h(t('confirm_cancel')) ?>')"><?= h(t('cancel_sub')) ?></a></div>
    <?php if ($myBids): ?>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--bd)">
        <h3 style="margin:0 0 6px">💲 <?= h(t('dash_my_bids')) ?></h3>
        <table>
          <tr><th><?= h(t('prj_f_title')) ?></th><th><?= h(t('prj_t_amount')) ?></th><th><?= h(t('status')) ?></th><th></th></tr>
          <?php foreach ($myBids as $b): $stMap = ['open' => ['b-ok', t('prj_open')], 'working' => ['b-warn', t('prj_working')], 'closed' => ['b-bad', t('prj_closed')]];
                [$c2, $t2] = $stMap[$b['status']] ?? ['b-bad', $b['status']]; ?>
            <tr>
              <td><a href="<?= h(url('projeto.php?id=' . (int) $b['pid'])) ?>"><?= h($b['title']) ?></a> <span class="muted">· <?= h($b['region']) ?></span></td>
              <td>US$ <?= number_format((float) $b['amount'], 2) ?></td>
              <td><span class="badge <?= $c2 ?>"><?= h($t2) ?></span></td>
              <td><span class="muted"><?= h(fmt_date($b['created_at'])) ?></span></td>
            </tr>
          <?php endforeach; ?>
        </table>
      </div>
    <?php endif; ?>
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--bd)">
      <h3 style="margin:0 0 2px"><?= h(t('add_packages')) ?></h3>
      <p class="muted" style="margin:0"><?= h(t('add_packages_hint')) ?></p>
      <?php $pkgBtns(); ?>
    </div>
  <?php endif; ?>
</div>
<?php layout_bottom(); ?>
