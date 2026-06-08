<?php
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/license.php';
$u = require_login();
$lics = lic_for_user((int) $u['id']);
$badge = function ($l) {
  $exp = !empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time();
  if ($l['status'] === 'active' && !$exp) return ['b-ok', '✓ ' . t('approved')];
  if ($l['status'] === 'past_due') return ['b-warn', 'past_due'];
  return ['b-bad', $exp ? t('not_approved') : $l['status']];
};
layout_top(t('dashboard'));
?>
<div class="card">
  <h2><?= h(t('my_licenses')) ?></h2>
  <?php if (!$lics): ?>
    <p class="muted"><?= h(t('no_licenses')) ?></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
      <a class="btn" href="<?= h(url('checkout.php?plan=mensal')) ?>"><?= h(t('monthly')) ?> — <?= h(t('subscribe')) ?></a>
      <a class="btn ghost" href="<?= h(url('checkout.php?plan=anual')) ?>"><?= h(t('annual')) ?> — <?= h(t('subscribe')) ?></a>
    </div>
  <?php else: ?>
    <table>
      <tr><th><?= h(t('key')) ?></th><th><?= h(t('plan')) ?></th><th><?= h(t('status')) ?></th><th><?= h(t('expires')) ?></th><th><?= h(t('devices')) ?></th><th></th></tr>
      <?php foreach ($lics as $l): [$cls, $txt] = $badge($l); ?>
        <tr>
          <td class="key"><?= h($l['license_key']) ?></td>
          <td><?= h($l['plan']) ?></td>
          <td><span class="badge <?= $cls ?>"><?= h($txt) ?></span></td>
          <td><?= h(fmt_date($l['expires_at'])) ?></td>
          <td><?= (int) $l['dev'] ?>/<?= (int) $l['max_devices'] ?></td>
          <td><button class="btn ghost" onclick="navigator.clipboard.writeText('<?= h($l['license_key']) ?>');this.textContent='<?= h(t('copied')) ?>'"><?= h(t('copy')) ?></button></td>
        </tr>
      <?php endforeach; ?>
    </table>
    <p class="muted" style="margin-top:10px"><?= h(t('use_in_app')) ?></p>
    <div style="margin-top:12px"><a class="btn ghost" href="<?= h(url('billing.php')) ?>" onclick="return confirm('<?= h(t('confirm_cancel')) ?>')"><?= h(t('cancel_sub')) ?></a></div>
  <?php endif; ?>
</div>
<?php layout_bottom(); ?>
