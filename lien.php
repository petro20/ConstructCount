<?php
/* lien.php — PROTEÇÃO DE PAGAMENTO: documentos de aviso (mechanic's lien).
   kind=prelim  → Preliminary Notice (informativo, enviado no fechamento do contrato)
   kind=intent  → Notice of Intent to Lien (cobrança formal antes de registrar o lien)
   Documento em INGLÊS (padrão legal dos EUA), pré-preenchido com os dados do mural.
   Acesso: o CONTRATADO vencedor (conta) ou o DONO do projeto (conta/token).
   NÃO é consultoria jurídica — requisitos e prazos variam por estado. */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

$id = (int) ($_GET['id'] ?? 0);
$kind = ($_GET['kind'] ?? 'prelim') === 'intent' ? 'intent' : 'prelim';
$p = prj_get($id);
if (!$p) { flash(t('prj_not_found')); redirect(url('projetos.php')); }
$tok = (string) ($_GET['t'] ?? '');
$u = current_user();
$isOwner = ($tok !== '' && hash_equals((string) $p['manage_token'], $tok))
        || ($u && !empty($p['owner_user_id']) && (int) $p['owner_user_id'] === (int) $u['id']);
$b = prj_lien_winner($p);
$isWinner = $u && $b && (int) $b['user_id'] === (int) $u['id'];
if (!$b || (!$isOwner && !$isWinner)) { flash(t('prj_not_found')); redirect(url('projeto.php?id=' . $id)); }

$today = date('F j, Y');
$amount = number_format((float) $b['amount'], 2);
$ownerName = trim((string) (($p['contact_name'] ?? '') ?: $p['company']));
$dates = [];
if (!empty($p['awarded_at'])) $dates[] = 'Contract awarded: ' . date('F j, Y', strtotime((string) $p['awarded_at']));
if (!empty($p['contract_deadline'])) $dates[] = 'Contract signing deadline: ' . date('F j, Y', strtotime((string) $p['contract_deadline']));
$trades = implode(', ', array_map(function ($t) { return prj_trade_label($t, 'en'); }, array_filter(explode(',', (string) $p['trades']))));
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= $kind === 'intent' ? 'Notice of Intent to Lien' : 'Preliminary Notice' ?> — ConstructCount</title>
<style>
  body{font:14px/1.6 Georgia,'Times New Roman',serif;color:#1a1a1a;background:#f2f0ea;margin:0}
  .sheet{max-width:760px;margin:24px auto;background:#fff;padding:48px 56px;box-shadow:0 2px 14px rgba(0,0,0,.12)}
  h1{font-size:20px;text-align:center;letter-spacing:.06em;margin:0 0 2px;text-transform:uppercase}
  .sub{text-align:center;font-size:12px;color:#555;margin-bottom:26px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #999;padding-bottom:3px;margin:22px 0 8px}
  table{width:100%;border-collapse:collapse}
  td{padding:3px 0;vertical-align:top}
  td.k{width:200px;color:#444;font-size:12.5px;text-transform:uppercase;letter-spacing:.03em}
  .big{font-size:17px;font-weight:bold}
  .law{margin:18px 0;padding:12px 16px;background:#f7f5ef;border-left:4px solid #8a7340;font-size:13px}
  .sig{margin-top:44px;display:flex;gap:40px}
  .sig div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:12px;color:#444}
  .disc{margin-top:30px;font-size:10.5px;color:#777;border-top:1px dashed #bbb;padding-top:10px}
  .bar{max-width:760px;margin:14px auto 0;display:flex;gap:10px;justify-content:flex-end}
  .bar button,.bar a{font:600 14px system-ui;padding:9px 18px;border-radius:8px;border:1px solid #999;background:#fff;cursor:pointer;text-decoration:none;color:#1a1a1a}
  .bar .pri{background:#1f2937;color:#fff;border-color:#1f2937}
  @media print{.bar{display:none}.sheet{box-shadow:none;margin:0;max-width:none}body{background:#fff}}
</style>
</head>
<body>
<div class="bar no-print">
  <a href="<?= h(url('projeto.php?id=' . $id . ($isOwner && $tok !== '' ? '&t=' . $tok : ''))) ?>">« <?= h(t('prj_board_title')) ?></a>
  <button class="pri" onclick="window.print()">🖨️ Print / PDF</button>
</div>
<div class="sheet">
<?php if ($kind === 'prelim'): ?>
  <h1>Preliminary Notice</h1>
  <p class="sub">(Notice to Property Owner — THIS IS NOT A LIEN)</p>
  <p><b>Date:</b> <?= h($today) ?></p>
  <h2>To (Property Owner / Contracting Party)</h2>
  <table>
    <tr><td class="k">Name</td><td><?= h($ownerName) ?><?= $p['company'] && $ownerName !== $p['company'] ? ' — ' . h($p['company']) : '' ?></td></tr>
    <tr><td class="k">E-mail</td><td><?= h((string) $p['contact_email']) ?></td></tr>
  </table>
  <h2>From (Claimant)</h2>
  <table>
    <tr><td class="k">Company</td><td><?= h((string) $b['company']) ?></td></tr>
    <tr><td class="k">E-mail</td><td><?= h((string) $b['email']) ?></td></tr>
  </table>
  <h2>Project / Property</h2>
  <table>
    <tr><td class="k">Project</td><td><?= h((string) $p['title']) ?></td></tr>
    <tr><td class="k">Location</td><td><?= h((string) $p['region']) ?></td></tr>
    <tr><td class="k">Labor / services / materials</td><td><?= h($trades ?: 'Construction services') ?></td></tr>
    <tr><td class="k">Estimated contract value</td><td class="big">US$ <?= h($amount) ?></td></tr>
    <?php foreach ($dates as $dl): ?><tr><td class="k"></td><td style="font-size:12.5px;color:#555"><?= h($dl) ?></td></tr><?php endforeach; ?>
  </table>
  <div class="law">
    <b>NOTICE:</b> This is to inform you that the claimant identified above has been engaged to furnish
    labor, services, equipment, or materials for the improvement of the property described above.
    Under the laws of most states, contractors, subcontractors, and material suppliers who furnish
    labor or materials to improve real property and who are <b>not paid</b> may have the right to record a
    <b>mechanic's lien</b> against the property. <u>This notice is NOT a lien</u> and is not a reflection on the
    integrity of any party. It is a routine, and in many states legally required, step to preserve the
    claimant's rights in the event of non-payment.
  </div>
  <div class="sig"><div>Claimant — <?= h((string) $b['company']) ?></div><div>Date</div></div>
<?php else: ?>
  <h1>Notice of Intent to File a Mechanic's Lien</h1>
  <p class="sub">(Formal demand for payment — final notice before recording a lien)</p>
  <p><b>Date:</b> <?= h($today) ?></p>
  <h2>To (Property Owner / Contracting Party)</h2>
  <table>
    <tr><td class="k">Name</td><td><?= h($ownerName) ?><?= $p['company'] && $ownerName !== $p['company'] ? ' — ' . h($p['company']) : '' ?></td></tr>
    <tr><td class="k">E-mail</td><td><?= h((string) $p['contact_email']) ?></td></tr>
  </table>
  <h2>From (Claimant)</h2>
  <table>
    <tr><td class="k">Company</td><td><?= h((string) $b['company']) ?></td></tr>
    <tr><td class="k">E-mail</td><td><?= h((string) $b['email']) ?></td></tr>
  </table>
  <h2>Project / Property</h2>
  <table>
    <tr><td class="k">Project</td><td><?= h((string) $p['title']) ?></td></tr>
    <tr><td class="k">Location</td><td><?= h((string) $p['region']) ?></td></tr>
    <tr><td class="k">Labor / services / materials</td><td><?= h($trades ?: 'Construction services') ?></td></tr>
    <tr><td class="k">Amount unpaid</td><td class="big">US$ <?= h($amount) ?></td></tr>
    <?php foreach ($dates as $dl): ?><tr><td class="k"></td><td style="font-size:12.5px;color:#555"><?= h($dl) ?></td></tr><?php endforeach; ?>
  </table>
  <div class="law">
    <b>PLEASE TAKE NOTICE</b> that the claimant identified above has furnished labor, services,
    equipment, or materials for the improvement of the property described above and remains
    <b>unpaid in the amount of US$ <?= h($amount) ?></b>. <b>Demand is hereby made for payment in full
    within ten (10) days</b> of the date of this notice. If payment is not received, the claimant intends
    to exercise its legal remedies, including <b>recording a mechanic's lien against the property</b> with
    the county recorder and pursuing all amounts owed, plus any costs and interest allowed by law.
    Payment of the amount due will render this notice void.
  </div>
  <div class="sig"><div>Claimant — <?= h((string) $b['company']) ?></div><div>Date</div></div>
<?php endif; ?>
  <p class="disc">Generated by ConstructCount from project data as a courtesy to the parties. This document is a
  general-purpose notice and does <b>not</b> constitute legal advice. Mechanic's lien requirements — including who may
  claim, notice wording, recipients, delivery method (e.g., certified mail), property legal description, notarization,
  and strict deadlines — <b>vary by state</b>. Before relying on lien rights, verify the statutes of the state where the
  property is located or consult a construction attorney.</p>
</div>
</body>
</html>
