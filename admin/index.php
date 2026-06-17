<?php
/* admin do portal — só para e-mails em ADMIN_EMAILS. Emitir/revogar manual. */
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/license.php';
$u = require_login();
if (!is_admin($u)) { http_response_code(403); exit('Acesso restrito.'); }
try { db()->exec("ALTER TABLE licenses ADD COLUMN courtesy TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) {}   // garante a coluna de CORTESIA (1x)

$msg = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_check()) {
  $act = (string) ($_POST['act'] ?? '');
  try {
    if ($act === 'create') {
      $uid = (int) ($_POST['user_id'] ?? 0) ?: null;
      $exp = trim((string) ($_POST['expires_at'] ?? '')) ?: null;
      $key = lic_create($uid, (string) ($_POST['plan'] ?? 'mensal'), $exp, (int) ($_POST['max_devices'] ?? 1));
      $msg = 'Licença criada: ' . $key;
    } elseif ($act === 'status') {
      db()->prepare('UPDATE licenses SET status=? WHERE id=?')->execute([(string) $_POST['status'], (int) $_POST['id']]);
      $msg = 'Status atualizado.';
    } elseif ($act === 'devices') {
      db()->prepare('DELETE FROM license_devices WHERE license_id=?')->execute([(int) $_POST['id']]);
      $msg = 'Dispositivos liberados.';
    } elseif ($act === 'courtesy') {
      db()->prepare('UPDATE licenses SET courtesy = 1 - COALESCE(courtesy,0) WHERE id=?')->execute([(int) $_POST['id']]);
      $msg = 'Cortesia alternada (sem vencimento on/off).';
    }
  } catch (Throwable $e) { $msg = 'Erro: ' . $e->getMessage(); }
}
function eh($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
$rows = db()->query('SELECT l.*, u.email, (SELECT COUNT(*) FROM license_devices d WHERE d.license_id=l.id) dev
                     FROM licenses l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 500')->fetchAll();
$cf = csrf_field();
?><!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin · Licenças</title><link rel="stylesheet" href="../assets/style.css?v=3"></head><body><main>
<p style="margin:0 0 10px"><a class="btn ghost" href="<?= eh(url('dashboard.php')) ?>">← Voltar ao dashboard</a></p>
<h1>🔑 Admin — Licenças</h1>
<?php if ($msg): ?><div class="flash"><?= eh($msg) ?></div><?php endif; ?>
<div class="card">
  <h3>Nova licença (manual)</h3>
  <form method="post" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
    <?= $cf ?><input type="hidden" name="act" value="create">
    <div><label>user_id</label><input name="user_id" style="width:90px"></div>
    <div><label>plano</label><input name="plan" value="mensal" style="width:100px"></div>
    <div><label>vence</label><input name="expires_at" placeholder="AAAA-MM-DD HH:MM:SS" style="width:200px"></div>
    <div><label>disp.</label><input name="max_devices" type="number" value="1" style="width:70px"></div>
    <button class="btn">Criar</button>
  </form>
</div>
<div class="card" style="overflow:auto">
<table><tr><th>Chave</th><th>Cliente</th><th>Plano</th><th>Status</th><th>Vence</th><th>Cortesia</th><th>Disp.</th><th>Stripe</th><th>Ações</th></tr>
<?php foreach ($rows as $r): ?>
<tr>
  <td class="key"><?= eh($r['license_key']) ?></td>
  <td><?= eh($r['email']) ?></td>
  <td><?= eh($r['plan']) ?></td>
  <td><b><?= eh($r['status']) ?></b></td>
  <td><?= !empty($r['courtesy']) ? '<span style="color:#157347">🎁 sem venc.</span>' : eh($r['expires_at']) ?></td>
  <td><?= !empty($r['courtesy']) ? '🎁 sim' : '—' ?></td>
  <td><?= (int) $r['dev'] ?>/<?= (int) $r['max_devices'] ?></td>
  <td style="font-size:11px"><?= eh($r['stripe_subscription_id']) ?></td>
  <td style="white-space:nowrap">
    <form method="post" style="display:inline"><?= $cf ?><input type="hidden" name="act" value="status"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
      <select name="status"><?php foreach (['active','past_due','suspended','revoked'] as $s): ?><option <?= $s === $r['status'] ? 'selected' : '' ?>><?= $s ?></option><?php endforeach; ?></select>
      <button class="btn ghost">ok</button></form>
    <form method="post" style="display:inline" onsubmit="return confirm('Liberar dispositivos?')"><?= $cf ?><input type="hidden" name="act" value="devices"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><button class="btn ghost">liberar disp.</button></form>
    <form method="post" style="display:inline"><?= $cf ?><input type="hidden" name="act" value="courtesy"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><button class="btn ghost"><?= !empty($r['courtesy']) ? 'tirar cortesia' : '🎁 cortesia' ?></button></form>
  </td>
</tr>
<?php endforeach; ?>
</table></div>
</main></body></html>
