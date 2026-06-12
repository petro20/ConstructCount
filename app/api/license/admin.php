<?php
/* =========================================================================
   admin.php — painel mínimo da M2PB p/ emitir/renovar/revogar licenças.
   Protegido por LIC_ADMIN_PASS (license-config.php). Use por HTTPS.
   ========================================================================= */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
lic_cfg();
$ADMIN = defined('LIC_ADMIN_PASS') ? (string) LIC_ADMIN_PASS : '';

$pass = (string) ($_POST['pass'] ?? $_GET['pass'] ?? '');
$authed = $ADMIN !== '' && hash_equals($ADMIN, $pass);

function h($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function gen_key(): string {
  $b = strtoupper(bin2hex(random_bytes(10)));            // 20 hex
  return 'CC-' . substr($b, 0, 4) . '-' . substr($b, 4, 4) . '-' . substr($b, 8, 4) . '-' . substr($b, 12, 4);
}

$msg = '';
if ($authed && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $act = (string) ($_POST['act'] ?? '');
  try {
    $db = lic_db();
    if ($act === 'create') {
      $key = gen_key();
      $exp = trim((string) ($_POST['expires_at'] ?? '')) ?: null;        // 'YYYY-MM-DD HH:MM:SS' ou vazio
      $db->prepare('INSERT INTO licenses (license_key, customer_name, customer_email, plan, status, expires_at, max_devices, notes) VALUES (?,?,?,?,?,?,?,?)')
         ->execute([$key, $_POST['customer_name'] ?? null, $_POST['customer_email'] ?? null,
                    $_POST['plan'] ?? 'mensal', 'active', $exp, (int) ($_POST['max_devices'] ?? 1), $_POST['notes'] ?? null]);
      $msg = 'Licença criada: ' . $key;
    } elseif ($act === 'status') {
      $db->prepare('UPDATE licenses SET status = ? WHERE id = ?')->execute([$_POST['status'], (int) $_POST['id']]);
      $msg = 'Status atualizado.';
    } elseif ($act === 'renew') {
      $db->prepare('UPDATE licenses SET expires_at = ?, status = "active" WHERE id = ?')
         ->execute([trim((string) $_POST['expires_at']) ?: null, (int) $_POST['id']]);
      $msg = 'Vencimento atualizado.';
    } elseif ($act === 'devices') {
      $db->prepare('DELETE FROM license_devices WHERE license_id = ?')->execute([(int) $_POST['id']]);
      $msg = 'Dispositivos liberados (o cliente pode reativar).';
    }
  } catch (Throwable $e) { $msg = 'Erro: ' . $e->getMessage(); }
}
?><!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Licenças · ConstructCount (M2PB)</title>
<style>body{font:14px system-ui,Arial;margin:24px;color:#0f172a}h1{font-size:18px}
input,select{padding:6px;margin:2px;border:1px solid #cbd5e1;border-radius:6px}
table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #e2e8f0;padding:6px;text-align:left;font-size:13px}
.b{background:#10b981;color:#fff;border:0;padding:7px 12px;border-radius:6px;cursor:pointer}.b.r{background:#ef4444}.b.s{background:#f59e0b}
.msg{background:#ecfeff;border:1px solid #06b6d4;padding:8px;border-radius:6px}.k{font-family:monospace}</style></head><body>
<h1>🔑 Licenças — ConstructCount (M2PB)</h1>
<?php if (!$authed): ?>
  <form method="post"><p>Senha do admin: <input type="password" name="pass" autofocus> <button class="b">Entrar</button></p></form>
<?php else: ?>
  <?php if ($msg): ?><p class="msg"><?= h($msg) ?></p><?php endif; ?>
  <h2 style="font-size:15px">Nova licença</h2>
  <form method="post">
    <input type="hidden" name="pass" value="<?= h($pass) ?>"><input type="hidden" name="act" value="create">
    <input name="customer_name" placeholder="Cliente">
    <input name="customer_email" placeholder="E-mail">
    <select name="plan"><option value="mensal">mensal</option><option value="anual">anual</option></select>
    <input name="expires_at" placeholder="Vence (YYYY-MM-DD HH:MM:SS)" size="22">
    <input name="max_devices" type="number" value="1" min="1" style="width:60px" title="dispositivos">
    <input name="notes" placeholder="obs">
    <button class="b">Criar chave</button>
  </form>
  <?php
  $rows = lic_db()->query('SELECT l.*, (SELECT COUNT(*) FROM license_devices d WHERE d.license_id=l.id) dev
                           FROM licenses l ORDER BY l.created_at DESC')->fetchAll();
  ?>
  <table><tr><th>Chave</th><th>Cliente</th><th>Plano</th><th>Status</th><th>Vence</th><th>Disp.</th><th>Ações</th></tr>
  <?php foreach ($rows as $r): ?>
    <tr>
      <td class="k"><?= h($r['license_key']) ?></td>
      <td><?= h($r['customer_name']) ?><br><small><?= h($r['customer_email']) ?></small></td>
      <td><?= h($r['plan']) ?></td>
      <td><b><?= h($r['status']) ?></b></td>
      <td><?= h($r['expires_at']) ?></td>
      <td><?= (int) $r['dev'] ?>/<?= (int) $r['max_devices'] ?></td>
      <td>
        <form method="post" style="display:inline">
          <input type="hidden" name="pass" value="<?= h($pass) ?>"><input type="hidden" name="act" value="status"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
          <select name="status"><?php foreach (['active','suspended','revoked'] as $s): ?><option <?= $s === $r['status'] ? 'selected' : '' ?>><?= $s ?></option><?php endforeach; ?></select>
          <button class="b s">Salvar</button>
        </form>
        <form method="post" style="display:inline">
          <input type="hidden" name="pass" value="<?= h($pass) ?>"><input type="hidden" name="act" value="renew"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
          <input name="expires_at" placeholder="novo vencimento" size="18" value="<?= h($r['expires_at']) ?>">
          <button class="b">Renovar</button>
        </form>
        <form method="post" style="display:inline" onsubmit="return confirm('Liberar todos os dispositivos desta licença?')">
          <input type="hidden" name="pass" value="<?= h($pass) ?>"><input type="hidden" name="act" value="devices"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
          <button class="b r">Liberar disp.</button>
        </form>
      </td>
    </tr>
  <?php endforeach; ?>
  </table>
<?php endif; ?>
</body></html>
