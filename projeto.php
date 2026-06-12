<?php
/* projeto.php — detalhe do projeto.
   • Assinante (login + licença ATIVA): baixa o PDF e DÁ PREÇO (valor + relatório).
   • Quem publicou (link com ?t=token): vê as propostas, baixa relatórios, fecha.   */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

$id = (int) ($_GET['id'] ?? 0);
$p = prj_get($id);
if (!$p) { flash(t('prj_not_found')); redirect(url('projetos.php')); }
$tok = (string) ($_GET['t'] ?? ($_POST['t'] ?? ''));
$isOwner = $tok !== '' && hash_equals((string) $p['manage_token'], $tok);
$u = current_user();
$canBid = $u ? prj_can_bid((int) $u['id']) : false;
$trades = array_filter(explode(',', (string) $p['trades']));

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_check()) {
  // GC muda o status (negociação concluída → obra em andamento → encerrado)
  if ($isOwner && ($_POST['act'] ?? '') === 'close') {
    db()->prepare("UPDATE projects SET status='closed' WHERE id=?")->execute([$id]);
    flash(t('prj_closed_flash'));
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  if ($isOwner && ($_POST['act'] ?? '') === 'working') {
    db()->prepare("UPDATE projects SET status='working' WHERE id=?")->execute([$id]);
    flash(t('prj_working_flash'));
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  // assinante envia/atualiza a PROPOSTA
  if ($u && $canBid && ($_POST['act'] ?? '') === 'bid' && $p['status'] === 'open') {
    $amount = (float) str_replace(',', '.', (string) ($_POST['amount'] ?? '0'));
    $msg = trim((string) ($_POST['message'] ?? ''));
    $report = null;
    if (!empty($_FILES['report']['name'])) {
      $report = prj_save_pdf($_FILES['report'], 'proposal', $rerr);
      if ($report === null) { flash(t('prj_pdf_err')); redirect(url('projeto.php?id=' . $id)); }
    }
    $company = trim((string) ($_POST['company'] ?? '')) ?: (string) ($u['name'] ?: $u['email']);
    $st = db()->prepare('SELECT id, report_path FROM proposals WHERE project_id=? AND user_id=? LIMIT 1');
    $st->execute([$id, (int) $u['id']]);
    if ($old = $st->fetch()) {
      db()->prepare('UPDATE proposals SET company=?, email=?, amount=?, message=?, report_path=COALESCE(?, report_path), created_at=NOW() WHERE id=?')
          ->execute([$company, (string) $u['email'], $amount, $msg, $report, (int) $old['id']]);
    } else {
      db()->prepare('INSERT INTO proposals (project_id,user_id,company,email,amount,message,report_path) VALUES (?,?,?,?,?,?,?)')
          ->execute([$id, (int) $u['id'], $company, (string) $u['email'], $amount, $msg, $report]);
    }
    @mail((string) $p['contact_email'], 'ConstructCount — ' . t('prj_newbid_subject'),
          t('prj_newbid_mail') . ' "' . $p['title'] . '"' . "\nUS$ " . number_format($amount, 2) . ' — ' . $company .
          "\n\n" . url('projeto.php?id=' . $id . '&t=' . $p['manage_token']),
          "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
    flash(t('prj_bid_flash'));
    redirect(url('projeto.php?id=' . $id));
  }
}

$bids = [];
if ($isOwner) {
  $st = db()->prepare('SELECT * FROM proposals WHERE project_id=? ORDER BY amount ASC, created_at ASC');
  $st->execute([$id]);
  $bids = $st->fetchAll();
}
$myBid = null;
if ($u) {
  $st = db()->prepare('SELECT * FROM proposals WHERE project_id=? AND user_id=? LIMIT 1');
  $st->execute([$id, (int) $u['id']]);
  $myBid = $st->fetch() ?: null;
}
$nb = db()->prepare('SELECT COUNT(*) c FROM proposals WHERE project_id=?'); $nb->execute([$id]);
$nBids = (int) ($nb->fetch()['c'] ?? 0);

layout_top($p['title']);
?>
<div class="card">
  <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">
    <h2 style="margin:0"><?= h($p['title']) ?></h2>
    <?php $stMap = ['open' => ['b-ok', t('prj_open')], 'working' => ['b-warn', t('prj_working')], 'closed' => ['b-bad', t('prj_closed')]];
          [$stCls, $stTxt] = $stMap[$p['status']] ?? ['b-bad', $p['status']]; ?>
    <span class="badge <?= $stCls ?>"><?= h($stTxt) ?></span>
    <span style="flex:1"></span>
    <span class="muted"><?= h(t('prj_bids')) ?>: <b><?= $nBids ?></b></span>
  </div>
  <p class="muted" style="margin:8px 0 0">📍 <?= h($p['region']) ?> · 🏢 <?= h($p['company']) ?>
    <?php if (!empty($p['deadline'])): ?> · ⏳ <?= h(t('prj_deadline')) ?>: <?= h(fmt_date($p['deadline'])) ?><?php endif; ?></p>
  <p style="margin:8px 0 0"><?php foreach ($trades as $tr): ?><span class="badge" style="margin-right:6px"><?= h(prj_trade_label($tr)) ?></span><?php endforeach; ?></p>
  <?php if (!empty($p['descr'])): ?><p style="margin-top:10px;white-space:pre-wrap"><?= h($p['descr']) ?></p><?php endif; ?>
  <?php if (!empty($p['pdf_path'])): ?>
    <div style="margin-top:12px">
      <?php if ($u && $canBid || $isOwner): ?>
        <a class="btn" href="<?= h(url('baixar.php?k=project&id=' . $id . ($isOwner ? '&t=' . $tok : ''))) ?>">📄 <?= h(t('prj_download_pdf')) ?></a>
        <span class="muted" style="margin-left:8px;font-size:12.5px"><?= h(t('prj_open_in_app')) ?></span>
      <?php else: ?>
        <span class="muted">📄 <?= h(t('prj_pdf_locked')) ?></span>
      <?php endif; ?>
    </div>
  <?php endif; ?>
</div>

<?php if ($isOwner): ?>
  <div class="card" style="margin-top:12px">
    <h3 style="margin:0 0 6px"><?= h(t('prj_owner_area')) ?></h3>
    <p class="muted" style="margin:0 0 10px"><?= h(t('prj_owner_hint')) ?></p>
    <?php if (!$bids): ?><p class="muted"><?= h(t('prj_no_bids')) ?></p>
    <?php else: ?>
      <table>
        <tr><th><?= h(t('prj_t_company')) ?></th><th><?= h(t('prj_t_amount')) ?></th><th><?= h(t('prj_t_msg')) ?></th><th><?= h(t('prj_t_report')) ?></th><th><?= h(t('prj_t_contact')) ?></th></tr>
        <?php foreach ($bids as $b): ?>
          <tr>
            <td><b><?= h($b['company']) ?></b></td>
            <td>US$ <?= number_format((float) $b['amount'], 2) ?></td>
            <td style="max-width:280px"><?= h((string) $b['message']) ?></td>
            <td><?php if (!empty($b['report_path'])): ?><a href="<?= h(url('baixar.php?k=proposal&id=' . (int) $b['id'] . '&t=' . $tok)) ?>">📄 PDF</a><?php else: ?>—<?php endif; ?></td>
            <td><a href="mailto:<?= h($b['email']) ?>"><?= h($b['email']) ?></a></td>
          </tr>
        <?php endforeach; ?>
      </table>
    <?php endif; ?>
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <?php if ($p['status'] === 'open'): ?>
        <form method="post">
          <?= csrf_field() ?><input type="hidden" name="t" value="<?= h($tok) ?>"><input type="hidden" name="act" value="working">
          <button class="btn"><?= h(t('prj_working_btn')) ?></button>
        </form>
      <?php endif; ?>
      <?php if ($p['status'] !== 'closed'): ?>
        <form method="post" onsubmit="return confirm('<?= h(t('prj_close_confirm')) ?>')">
          <?= csrf_field() ?><input type="hidden" name="t" value="<?= h($tok) ?>"><input type="hidden" name="act" value="close">
          <button class="btn ghost"><?= h(t('prj_close_btn')) ?></button>
        </form>
      <?php endif; ?>
    </div>
  </div>
<?php endif; ?>

<?php if (!$isOwner && $p['status'] === 'open'): ?>
  <div class="card" style="margin-top:12px">
    <h3 style="margin:0 0 6px">💲 <?= h(t('prj_bid_title')) ?></h3>
    <?php if (!$u): ?>
      <p class="muted"><?= h(t('prj_bid_login')) ?></p>
      <a class="btn" href="<?= h(url('login.php')) ?>"><?= h(t('login')) ?></a>
      <a class="btn ghost" href="<?= h(url('register.php')) ?>"><?= h(t('register')) ?></a>
    <?php elseif (!$canBid): ?>
      <p class="muted"><?= h(t('prj_bid_needs_sub')) ?></p>
      <a class="btn" href="<?= h(url('checkout.php?plan=board')) ?>"><?= h(t('prj_bid_subscribe')) ?></a>
      <a class="btn ghost" href="<?= h(url('dashboard.php')) ?>"><?= h(t('prj_see_plans')) ?></a>
    <?php else: ?>
      <?php if ($myBid): ?><p class="badge b-ok">✓ <?= h(t('prj_bid_sent')) ?> — US$ <?= number_format((float) $myBid['amount'], 2) ?> (<?= h(t('prj_bid_update_hint')) ?>)</p><?php endif; ?>
      <form method="post" enctype="multipart/form-data" style="display:grid;gap:12px;margin-top:8px">
        <?= csrf_field() ?><input type="hidden" name="act" value="bid">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label><?= h(t('prj_f_yourcompany')) ?><br><input name="company" maxlength="120" value="<?= h($myBid['company'] ?? ($u['name'] ?? '')) ?>" style="width:100%"></label>
          <label><?= h(t('prj_f_amount')) ?><br><input name="amount" required inputmode="decimal" placeholder="45000.00" value="<?= h($myBid ? (string) $myBid['amount'] : '') ?>" style="width:100%"></label>
        </div>
        <label><?= h(t('prj_f_message')) ?><br><textarea name="message" rows="3" style="width:100%"><?= h((string) ($myBid['message'] ?? '')) ?></textarea></label>
        <label><?= h(t('prj_f_report')) ?><br><input type="file" name="report" accept="application/pdf" style="width:100%"></label>
        <button class="btn"><?= h(t('prj_bid_btn')) ?></button>
        <p class="muted" style="font-size:12.5px"><?= h(t('prj_bid_note')) ?></p>
      </form>
    <?php endif; ?>
  </div>
<?php endif; ?>
<?php layout_bottom(); ?>
