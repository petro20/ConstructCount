<?php
/* projeto.php — detalhe do projeto.
   • Assinante (login + licença ATIVA): baixa o PDF e DÁ PREÇO (valor + relatório).
   • Quem publicou (link com ?t=token): vê as propostas, baixa relatórios, fecha.   */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

prj_check_deadlines();   // fiscal dos prazos (multas por descumprimento)

$id = (int) ($_GET['id'] ?? 0);
$p = prj_get($id);
if (!$p) { flash(t('prj_not_found')); redirect(url('projetos.php')); }
$tok = (string) ($_GET['t'] ?? ($_POST['t'] ?? ''));
$u = current_user();
// dono = link com token OU a CONTA que publicou (login p/ ambos os lados)
$isOwner = ($tok !== '' && hash_equals((string) $p['manage_token'], $tok))
        || ($u && !empty($p['owner_user_id']) && (int) $p['owner_user_id'] === (int) $u['id']);
$canBid = $u ? prj_can_bid((int) $u['id'], (string) $p['region']) : false;   // mural é POR REGIÃO
$trades = array_filter(explode(',', (string) $p['trades']));

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_check()) {
  // GC muda o status (negociação concluída → obra em andamento → encerrado)
  if ($isOwner && ($_POST['act'] ?? '') === 'close') {
    // encerrar o projeto também ENCERRA os chats: transcrição por e-mail + limpeza
    try {
      $st = db()->prepare('SELECT DISTINCT user_id FROM prj_chat WHERE project_id=?');
      $st->execute([$id]);
      foreach ($st->fetchAll() as $r) prj_chat_end($p, (int) $r['user_id']);
    } catch (Throwable $e) {}
    db()->prepare("UPDATE projects SET status='closed', closed_at=NOW() WHERE id=?")->execute([$id]);
    flash(t('prj_closed_flash'));
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  if ($isOwner && ($_POST['act'] ?? '') === 'working') {
    db()->prepare("UPDATE projects SET status='working' WHERE id=?")->execute([$id]);
    flash(t('prj_working_flash'));
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  // GC PRORROGA as datas (até 1 mês além da original = grátis; depois US$5/mês, recalculado do total)
  if ($isOwner && ($_POST['act'] ?? '') === 'extend' && in_array($p['status'], ['open', 'awarded'], true)) {
    $nd = trim((string) ($_POST['deadline'] ?? ''));
    $nn = trim((string) ($_POST['negotiation_deadline'] ?? ''));
    $nc = trim((string) ($_POST['contract_deadline'] ?? ''));
    if ($nd && $nn && $nc && $nn >= $nd && $nc >= $nn) {
      $orig = (string) ($p['contract_deadline_orig'] ?: $p['contract_deadline']);
      $fee = prj_extension_fee($orig, $nc);
      db()->prepare('UPDATE projects SET deadline=?, negotiation_deadline=?, contract_deadline=?, contract_deadline_orig=COALESCE(contract_deadline_orig, ?) WHERE id=?')
          ->execute([$nd, $nn, $nc, $p['contract_deadline'], $id]);
      if ($fee > 0) {
        $st = db()->prepare("SELECT id FROM violations WHERE project_id=? AND kind='extension' LIMIT 1");
        $st->execute([$id]);
        if ($row = $st->fetch()) db()->prepare("UPDATE violations SET fee=?, status='pending' WHERE id=?")->execute([$fee, (int) $row['id']]);
        else db()->prepare("INSERT INTO violations (project_id,party,user_id,email,kind,fee) VALUES (?,'owner',NULL,?,'extension',?)")->execute([$id, (string) $p['contact_email'], $fee]);
        flash(str_replace('{fee}', number_format($fee, 2), t('prj_extend_fee_flash')));
      } else {
        flash(t('prj_extend_flash'));
      }
    } else {
      flash(t('prj_dates_err'));
    }
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  // GC ACEITA uma proposta (award) — começa o prazo de contrato
  if ($isOwner && ($_POST['act'] ?? '') === 'award' && in_array($p['status'], ['open'], true)) {
    if (prj_award($p, (int) ($_POST['proposal_id'] ?? 0))) flash(t('prj_award_flash'));
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  // confirmações de ASSINATURA DE CONTRATO (cada lado confirma o seu)
  if ($isOwner && ($_POST['act'] ?? '') === 'sign_gc' && $p['status'] === 'awarded') {
    db()->prepare('UPDATE projects SET contract_gc_at = NOW() WHERE id=?')->execute([$id]);
    $st = db()->prepare('SELECT contract_bidder_at FROM proposals WHERE id=?'); $st->execute([(int) $p['awarded_proposal_id']]);
    if (!empty(($st->fetch() ?: [])['contract_bidder_at'])) {
      db()->prepare("UPDATE projects SET status='working' WHERE id=?")->execute([$id]);
      prj_lien_prelim_notify($p);   // contrato fechado → Preliminary Notice de cortesia
    }
    flash(t('prj_sign_flash'));
    redirect(url('projeto.php?id=' . $id . '&t=' . $tok));
  }
  if ($u && ($_POST['act'] ?? '') === 'sign_bidder' && $p['status'] === 'awarded') {
    $st = db()->prepare('SELECT id FROM proposals WHERE id=? AND user_id=?'); $st->execute([(int) $p['awarded_proposal_id'], (int) $u['id']]);
    if ($st->fetch()) {
      db()->prepare('UPDATE proposals SET contract_bidder_at = NOW() WHERE id=?')->execute([(int) $p['awarded_proposal_id']]);
      if (!empty($p['contract_gc_at'])) {
        db()->prepare("UPDATE projects SET status='working' WHERE id=?")->execute([$id]);
        prj_lien_prelim_notify($p);   // contrato fechado → Preliminary Notice de cortesia
      }
      flash(t('prj_sign_flash'));
    }
    redirect(url('projeto.php?id=' . $id));
  }
  // VENCEDOR sem receber → envia o NOTICE OF INTENT TO LIEN ao dono (sob demanda)
  if ($u && ($_POST['act'] ?? '') === 'send_intent' && !empty($p['awarded_proposal_id']) && in_array($p['status'], ['awarded', 'working'], true)) {
    $st = db()->prepare('SELECT * FROM proposals WHERE id=? AND user_id=? LIMIT 1');
    $st->execute([(int) $p['awarded_proposal_id'], (int) $u['id']]);
    if ($b = $st->fetch()) {
      $link = url('lien.php?id=' . $id . '&kind=intent');
      @mail((string) $p['contact_email'], 'ConstructCount — ' . t('lien_intent_subject'),
            t('lien_intent_mail') . "\n\n" . $p['title'] . ' — ' . $p['region'] .
            "\nUS$ " . number_format((float) $b['amount'], 2) . ' — ' . $b['company'] . ' (' . $b['email'] . ')' .
            "\n\n" . $link . "\n\n" . t('lien_disclaimer'),
            "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
      flash(t('lien_intent_sent'));
    }
    redirect(url('projeto.php?id=' . $id));
  }
  // assinante envia/atualiza a PROPOSTA (respeitando prazo e multas pendentes)
  if ($u && $canBid && ($_POST['act'] ?? '') === 'bid' && $p['status'] === 'open'
      && (empty($p['deadline']) || $p['deadline'] >= date('Y-m-d'))
      && !prj_is_banned((int) $u['id'], (string) $u['email'])
      && !prj_pending_fees('bidder', (int) $u['id'])) {
    if (empty($_POST['accept_terms'])) { flash(t('terms_required_bid')); redirect(url('projeto.php?id=' . $id)); }
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
      db()->prepare('UPDATE proposals SET company=?, email=?, amount=?, message=?, report_path=COALESCE(?, report_path), created_at=NOW(), terms_accepted_at=NOW(), terms_version=? WHERE id=?')
          ->execute([$company, (string) $u['email'], $amount, $msg, $report, '2026-06-12', (int) $old['id']]);
    } else {
      db()->prepare('INSERT INTO proposals (project_id,user_id,company,email,amount,message,report_path,terms_accepted_at,terms_version) VALUES (?,?,?,?,?,?,?,NOW(),?)')
          ->execute([$id, (int) $u['id'], $company, (string) $u['email'], $amount, $msg, $report, '2026-06-12']);
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
$chatThreads = [];
if ($isOwner) {
  $st = db()->prepare('SELECT * FROM proposals WHERE project_id=? ORDER BY amount ASC, created_at ASC');
  $st->execute([$id]);
  $bids = $st->fetchAll();
  try {   // conversas abertas (inclui quem perguntou ANTES de propor)
    $st = db()->prepare('SELECT c.user_id, COALESCE(us.name, "—") name, COUNT(*) n, MAX(c.created_at) last
                         FROM prj_chat c LEFT JOIN users us ON us.id = c.user_id
                         WHERE c.project_id=? GROUP BY c.user_id ORDER BY last DESC');
    $st->execute([$id]);
    $chatThreads = $st->fetchAll();
  } catch (Throwable $e) {}
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
    <?php $stMap = ['open' => ['b-ok', t('prj_open')], 'awarded' => ['b-warn', t('prj_awarded')], 'working' => ['b-warn', t('prj_working')], 'closed' => ['b-bad', t('prj_closed')]];
          [$stCls, $stTxt] = $stMap[$p['status']] ?? ['b-bad', $p['status']]; ?>
    <span class="badge <?= $stCls ?>"><?= h($stTxt) ?></span>
    <span style="flex:1"></span>
    <span class="muted"><?= h(t('prj_bids')) ?>: <b><?= $nBids ?></b></span>
  </div>
  <p class="muted" style="margin:8px 0 0">📍 <?= h(($isOwner || $canBid) && !empty($p['address']) ? $p['address'] : $p['region']) ?> · 🏢 <?= h($p['company']) ?>
    <?php if (!empty($p['deadline'])): ?> · ⏳ <?= h(t('prj_deadline')) ?>: <?= h(fmt_date($p['deadline'])) ?><?php endif; ?></p>
  <p style="margin:8px 0 0"><?php foreach ($trades as $tr): ?><span class="badge" style="margin-right:6px"><?= h(prj_trade_label($tr)) ?></span><?php endforeach; ?></p>
  <?php if (!empty($p['descr'])): ?><p style="margin-top:10px;white-space:pre-wrap"><?= h($p['descr']) ?></p><?php endif; ?>
  <?php // 📅 calendário de compromissos (com responsabilidade dos dois lados)
    $today = date('Y-m-d');
    $cal = [
      [t('prj_f_deadline'), $p['deadline'] ?? null, ($p['status'] !== 'open')],
      [t('prj_f_neg_deadline'), $p['negotiation_deadline'] ?? null, !empty($p['awarded_at'])],
      [t('prj_f_con_deadline'), $p['contract_deadline'] ?? null, $p['status'] === 'working' || $p['status'] === 'closed'],
    ]; ?>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border:1px solid var(--bd);border-radius:10px">
    <b>📅 <?= h(t('prj_calendar')) ?>:</b>
    <?php foreach ($cal as [$lbl, $dt, $done]): if (!$dt) continue;
      $late = !$done && $dt < $today;
      $ico = $done ? '✅' : ($late ? '⚠️' : '⏳'); ?>
      <span <?= $late ? 'style="color:#f87171;font-weight:700"' : '' ?>><?= $ico ?> <?= h($lbl) ?>: <?= h(fmt_date($dt)) ?></span>
    <?php endforeach; ?>
    <span class="muted" style="font-size:12px">· <?= h(str_replace('{fee}', number_format(prj_fee(), 2), t('prj_fee_note'))) ?></span>
  </div>
  <?php // 🎉 vencedor logado: banner + confirmação de contrato + proteção de pagamento
    if ($u && !empty($p['awarded_proposal_id']) && in_array($p['status'], ['awarded', 'working'], true)) {
      $stW = db()->prepare('SELECT * FROM proposals WHERE id=? AND user_id=?');
      $stW->execute([(int) $p['awarded_proposal_id'], (int) $u['id']]);
      if ($win = $stW->fetch()) { ?>
        <div style="margin-top:12px;padding:12px;border:1px solid #3a5; border-radius:10px">
          <b>🎉 <?= h(t('prj_you_won')) ?></b>
          <?php if ($p['status'] === 'awarded' && empty($win['contract_bidder_at'])): ?>
            <form method="post" style="display:inline-block;margin-left:10px"><?= csrf_field() ?><input type="hidden" name="act" value="sign_bidder"><button class="btn"><?= h(t('prj_sign_btn')) ?></button></form>
          <?php else: ?>
            <span class="badge b-ok" style="margin-left:8px">✓ <?= h(t('prj_signed')) ?></span>
          <?php endif; ?>
          <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--bd)">
            <b>⚖️ <?= h(t('lien_box_title')) ?></b>
            <p class="muted" style="margin:4px 0 8px;font-size:12.5px"><?= h(t('lien_box_hint')) ?></p>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <a class="btn ghost" target="_blank" href="<?= h(url('lien.php?id=' . $id . '&kind=prelim')) ?>">📄 Preliminary Notice</a>
              <a class="btn ghost" target="_blank" href="<?= h(url('lien.php?id=' . $id . '&kind=intent')) ?>">⚠️ Notice of Intent to Lien</a>
              <form method="post" onsubmit="return confirm('<?= h(t('lien_intent_confirm')) ?>')">
                <?= csrf_field() ?><input type="hidden" name="act" value="send_intent">
                <button class="btn"><?= h(t('lien_send_intent')) ?></button>
              </form>
            </div>
            <p class="muted" style="margin:8px 0 0;font-size:11.5px"><?= h(t('lien_disclaimer')) ?></p>
          </div>
        </div>
      <?php } } ?>
  <?php if (!empty($p['pdf_path']) || !empty($p['pdf_link'])): ?>
    <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <?php if (($u && $canBid) || $isOwner): ?>
        <?php if (!empty($p['pdf_path'])): ?>
          <a class="btn" href="<?= h(url('baixar.php?k=project&id=' . $id . ($isOwner ? '&t=' . $tok : ''))) ?>">📄 <?= h(t('prj_download_pdf')) ?></a>
        <?php endif; ?>
        <?php if (!empty($p['pdf_link'])): ?>
          <a class="btn ghost" href="<?= h($p['pdf_link']) ?>" target="_blank" rel="noopener nofollow">🔗 <?= h(t('prj_link_open')) ?></a>
        <?php endif; ?>
        <span class="muted" style="font-size:12.5px"><?= h(t('prj_open_in_app')) ?></span>
      <?php else: ?>
        <span class="muted">📄 <?= h(t('prj_pdf_locked')) ?></span>
      <?php endif; ?>
    </div>
  <?php endif; ?>
  <?php if (!$isOwner && $u && ($canBid || $myBid) && $p['status'] !== 'closed' && !prj_is_banned((int) $u['id'], (string) $u['email'])): ?>
    <div style="margin-top:10px">
      <a class="btn ghost" href="<?= h(url('chat.php?id=' . $id)) ?>">💬 <?= h(t('chat_btn_ask')) ?></a>
      <span class="muted" style="font-size:12px;margin-left:6px"><?= h(t('chat_hint')) ?></span>
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
        <tr><th><?= h(t('prj_t_company')) ?></th><th><?= h(t('prj_t_amount')) ?></th><th><?= h(t('prj_t_msg')) ?></th><th><?= h(t('prj_t_report')) ?></th><th><?= h(t('prj_t_contact')) ?></th><th></th></tr>
        <?php foreach ($bids as $b): $isWinner = ((int) ($p['awarded_proposal_id'] ?? 0)) === (int) $b['id']; ?>
          <tr>
            <td><b><?= h($b['company']) ?></b><?php if ($isWinner): ?> <span class="badge b-ok">🏆</span><?php endif; ?></td>
            <td>US$ <?= number_format((float) $b['amount'], 2) ?></td>
            <td style="max-width:280px"><?= h((string) $b['message']) ?></td>
            <td><?php if (!empty($b['report_path'])): ?><a href="<?= h(url('baixar.php?k=proposal&id=' . (int) $b['id'] . '&t=' . $tok)) ?>">📄 PDF</a><?php else: ?>—<?php endif; ?></td>
            <td><a href="mailto:<?= h($b['email']) ?>"><?= h($b['email']) ?></a></td>
            <td style="white-space:nowrap"><?php if ($p['status'] === 'open'): ?>
              <form method="post" style="display:inline-block" onsubmit="return confirm('<?= h(t('prj_award_confirm')) ?>')"><?= csrf_field() ?><input type="hidden" name="t" value="<?= h($tok) ?>"><input type="hidden" name="act" value="award"><input type="hidden" name="proposal_id" value="<?= (int) $b['id'] ?>"><button class="btn"><?= h(t('prj_award_btn')) ?></button></form>
            <?php endif; ?>
            <?php if ($p['status'] !== 'closed'): ?>
              <a class="btn ghost" style="display:inline-block" href="<?= h(url('chat.php?id=' . $id . '&u=' . (int) $b['user_id'] . ($tok !== '' ? '&t=' . $tok : ''))) ?>">💬 <?= h(t('chat_btn_owner')) ?></a>
            <?php endif; ?></td>
          </tr>
        <?php endforeach; ?>
      </table>
      <?php if ($p['status'] === 'awarded'): ?>
        <div style="margin-top:12px;padding:12px;border:1px solid var(--bd);border-radius:10px">
          <b>✍️ <?= h(t('prj_contract_title')) ?></b>
          <span class="muted" style="margin-left:6px"><?= h(t('prj_until')) ?> <?= h(fmt_date($p['contract_deadline'])) ?></span><br>
          <?php if (empty($p['contract_gc_at'])): ?>
            <form method="post" style="display:inline-block;margin-top:8px"><?= csrf_field() ?><input type="hidden" name="t" value="<?= h($tok) ?>"><input type="hidden" name="act" value="sign_gc"><button class="btn"><?= h(t('prj_sign_btn')) ?></button></form>
          <?php else: ?><span class="badge b-ok">✓ <?= h(t('prj_signed')) ?> (<?= h(t('prj_f_company')) ?>)</span><?php endif; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
    <?php if ($chatThreads): ?>
      <div style="margin-top:12px;padding:12px;border:1px solid var(--bd);border-radius:10px">
        <b>💬 <?= h(t('chat_threads')) ?></b>
        <p class="muted" style="margin:4px 0 8px;font-size:12.5px"><?= h(t('chat_hint')) ?></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <?php foreach ($chatThreads as $ct): ?>
            <a class="btn ghost" href="<?= h(url('chat.php?id=' . $id . '&u=' . (int) $ct['user_id'] . ($tok !== '' ? '&t=' . $tok : ''))) ?>">💬 <?= h((string) $ct['name']) ?> <span class="muted">(<?= (int) $ct['n'] ?>)</span></a>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>
    <?php $due = prj_storage_due($p); if ($due > 0): ?>
      <p style="margin-top:10px" class="muted">💾 <?= h(str_replace(['{due}', '{months}', '{mb}'], [number_format($due, 2), (string) prj_storage_months($p), (string) round(((int) $p['pdf_size']) / 1048576)], t('prj_storage_due'))) ?></p>
    <?php endif; ?>
    <?php if (in_array($p['status'], ['open', 'awarded'], true)): ?>
      <details style="margin-top:12px">
        <summary style="cursor:pointer;font-weight:700">📅 <?= h(t('prj_extend_title')) ?></summary>
        <p class="muted" style="font-size:12.5px;margin:6px 0"><?= h(str_replace('{fee}', number_format(prj_fee(), 2), t('prj_rule_extension'))) ?></p>
        <form method="post" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end">
          <?= csrf_field() ?><input type="hidden" name="t" value="<?= h($tok) ?>"><input type="hidden" name="act" value="extend">
          <label><?= h(t('prj_f_deadline')) ?><br><input type="date" name="deadline" required value="<?= h((string) $p['deadline']) ?>" style="width:100%"></label>
          <label><?= h(t('prj_f_neg_deadline')) ?><br><input type="date" name="negotiation_deadline" required value="<?= h((string) $p['negotiation_deadline']) ?>" style="width:100%"></label>
          <label><?= h(t('prj_f_con_deadline')) ?><br><input type="date" name="contract_deadline" required value="<?= h((string) $p['contract_deadline']) ?>" style="width:100%"></label>
          <button class="btn ghost"><?= h(t('prj_extend_btn')) ?></button>
        </form>
      </details>
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
    <?php elseif (!$canBid): $rk = prj_region_key((string) $p['region']); ?>
      <p class="muted"><?= h(str_replace('{region}', $rk, t('prj_bid_needs_region'))) ?></p>
      <a class="btn" href="<?= h(url('checkout.php?plan=board&region=' . urlencode($rk))) ?>">💳 <?= h(str_replace('{region}', $rk, t('prj_bid_sub_region'))) ?></a>
      <a class="btn ghost" href="<?= h(url('board-regioes.php')) ?>"><?= h(t('prj_region_pick_title')) ?></a>
    <?php elseif (prj_is_banned((int) $u['id'], (string) $u['email'])): ?>
      <p class="err">🚫 <?= h(t('prj_banned')) ?></p>
    <?php elseif (!empty($p['deadline']) && $p['deadline'] < date('Y-m-d')): ?>
      <p class="muted">⏳ <?= h(t('prj_bids_closed')) ?></p>
    <?php elseif ($fees = prj_pending_fees('bidder', (int) $u['id'])): ?>
      <p class="err">⚠️ <?= h(str_replace('{fee}', number_format(array_sum(array_column($fees, 'fee')), 2), t('prj_blocked_bidder'))) ?></p>
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
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;padding:10px 12px;border:1px solid var(--bd);border-radius:10px">
          <input type="checkbox" name="accept_terms" value="1" required style="margin-top:3px">
          <span><?= h(t('terms_accept')) ?> <a href="<?= h(url('termos-mural.php')) ?>" target="_blank"><b><?= h(t('terms_title')) ?></b></a> — <?= h(t('terms_accept2')) ?></span>
        </label>
        <button class="btn"><?= h(t('prj_bid_btn')) ?></button>
        <p class="muted" style="font-size:12.5px"><?= h(t('prj_bid_note')) ?></p>
        <p class="muted" style="font-size:12px">⚖️ <?= h(str_replace('{fee}', number_format(prj_fee(), 2), t('prj_bid_terms'))) ?></p>
      </form>
    <?php endif; ?>
  </div>
<?php endif; ?>
<?php layout_bottom(); ?>
