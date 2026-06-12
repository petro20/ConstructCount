<?php
/* =========================================================================
   portal.php — página PÚBLICA "Minha licença" (M2PB). O cliente cola a chave
   e vê a APROVAÇÃO (status / plano / vencimento / dispositivos). Só consulta,
   não consome dispositivo. Use por HTTPS.
   ========================================================================= */
declare(strict_types=1);

$key = trim((string) ($_POST['key'] ?? $_GET['key'] ?? ''));
$res = null; $err = '';
if ($key !== '') {
  try {
    require __DIR__ . '/_lib.php';
    if (!is_file(__DIR__ . '/../license-config.php')) {
      $err = 'Licenciamento ainda não configurado no servidor.';
    } else {
      $res = lic_status_only($key);
    }
  } catch (Throwable $e) {
    $err = 'Servidor de licença indisponível.';
  }
}
function h($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function fmt_date($s) { return $s ? date('d/m/Y', strtotime((string) $s)) : '—'; }
?><!doctype html>
<html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Minha Licença · ConstructCount</title>
<link rel="icon" href="../../assets/favicon.ico">
<style>
  :root{--bg:#0b1220;--card:#0f172a;--bd:#1e293b;--mut:#94a3b8;--ok:#10b981;--bad:#ef4444;--warn:#f59e0b}
  *{box-sizing:border-box} body{margin:0;font:15px/1.5 Inter,system-ui,Arial;background:radial-gradient(1200px 600px at 50% -10%,#10243b,#070c16);color:#e5edf6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:460px;background:var(--card);border:1px solid var(--bd);border-radius:18px;padding:30px 28px;box-shadow:0 24px 70px rgba(0,0,0,.5)}
  .logo{height:58px;display:block;margin:0 auto 14px}
  h1{font-size:19px;margin:0 0 4px;text-align:center}
  p.sub{color:var(--mut);text-align:center;margin:0 0 18px;font-size:13px}
  input{width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#e5edf6;text-align:center;font-family:monospace;letter-spacing:1px}
  button{width:100%;margin-top:12px;padding:12px;border:0;border-radius:10px;background:var(--ok);color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  button:hover{background:#0ea371}
  .res{margin-top:18px;border-radius:12px;padding:16px;border:1px solid var(--bd);background:#0b1220}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700;font-size:13px}
  .b-ok{background:rgba(16,185,129,.18);color:#34d399;border:1px solid #10b981}
  .b-bad{background:rgba(239,68,68,.16);color:#f87171;border:1px solid #ef4444}
  .row{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid #16223a;font-size:14px}
  .row:first-of-type{border-top:0} .row .k{color:var(--mut)}
  .err{color:#f87171;text-align:center;margin-top:12px;font-size:13px}
  .foot{color:var(--mut);text-align:center;margin-top:18px;font-size:12px}
  a{color:#38bdf8;text-decoration:none}
</style></head>
<body>
  <form class="card" method="post">
    <img class="logo" src="../../assets/logo.png" alt="ConstructCount" onerror="this.style.display='none'">
    <h1>Minha Licença</h1>
    <p class="sub">Consulte a aprovação da sua licença do <b>ConstructCount</b>.</p>
    <input name="key" value="<?= h($key) ?>" placeholder="CC-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" autofocus>
    <button>Verificar aprovação</button>

    <?php if ($err): ?>
      <div class="err">⚠ <?= h($err) ?></div>
    <?php elseif ($res !== null): ?>
      <?php $ok = !empty($res['approved']); ?>
      <div class="res">
        <div style="text-align:center;margin-bottom:10px">
          <span class="badge <?= $ok ? 'b-ok' : 'b-bad' ?>"><?= $ok ? '✓ Licença aprovada' : '✗ Não aprovada' ?></span>
        </div>
        <?php if ($res['found']): ?>
          <div class="row"><span class="k">Status</span><span><?= h($res['status']) ?></span></div>
          <div class="row"><span class="k">Plano</span><span><?= h($res['plan']) ?></span></div>
          <div class="row"><span class="k">Vencimento</span><span><?= fmt_date($res['expires_at']) ?></span></div>
          <div class="row"><span class="k">Dispositivos</span><span><?= (int) $res['devices'] ?> / <?= (int) $res['max_devices'] ?></span></div>
          <?php if (!$ok): ?><div class="err" style="margin-top:8px">Motivo: <?= h($res['reason']) ?></div><?php endif; ?>
        <?php else: ?>
          <div class="err"><?= h($res['reason'] ?: 'chave não encontrada') ?></div>
        <?php endif; ?>
      </div>
      <?php if ($ok): ?>
        <p class="foot">Abra o app ConstructCount e cole esta chave na tela de ativação.</p>
      <?php endif; ?>
    <?php endif; ?>

    <p class="foot">Precisa de uma licença ou renovar? <a href="https://m2pb.com" target="_blank">m2pb.com</a></p>
  </form>
</body></html>
