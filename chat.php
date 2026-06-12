<?php
/* chat.php — CHAT TEMPORÁRIO entre os envolvidos no projeto (dono ↔ quem dá preço).
   NADA fica guardado: ao encerrar (qualquer lado, fechamento do projeto ou
   7 dias parado), a conversa COMPLETA vai por e-mail pros DOIS e o chat é limpo.
   Acesso: dono (conta ou link-token) e assinante do pacote board (ou quem já propôs). */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

$id = (int) ($_GET['id'] ?? 0);
$p = prj_get($id);
if (!$p) { flash(t('prj_not_found')); redirect(url('projetos.php')); }
$tok = (string) ($_GET['t'] ?? ($_POST['t'] ?? ''));
$u = current_user();
$isOwner = ($tok !== '' && hash_equals((string) $p['manage_token'], $tok))
        || ($u && !empty($p['owner_user_id']) && (int) $p['owner_user_id'] === (int) $u['id']);

if ($isOwner) {
  // o dono escolhe COM QUEM falar (u = conta de quem deu/quer dar preço)
  $bidderId = (int) ($_GET['u'] ?? ($_POST['u'] ?? 0));
  if ($bidderId <= 0) { flash(t('prj_not_found')); redirect(url('projeto.php?id=' . $id . ($tok !== '' ? '&t=' . $tok : ''))); }
} else {
  if (!$u) { require_login(); exit; }
  $hasBid = false;
  try {
    $st = db()->prepare('SELECT 1 FROM proposals WHERE project_id=? AND user_id=? LIMIT 1');
    $st->execute([$id, (int) $u['id']]);
    $hasBid = (bool) $st->fetch();
  } catch (Throwable $e) {}
  if ((!prj_can_bid((int) $u['id']) && !$hasBid) || prj_is_banned((int) $u['id'], (string) $u['email'])) {
    flash(t('chat_need_board'));
    redirect(url('projeto.php?id=' . $id));
  }
  $bidderId = (int) $u['id'];
}
if ($p['status'] === 'closed') { flash(t('prj_bids_closed')); redirect(url('projeto.php?id=' . $id)); }
$sender = $isOwner ? 'owner' : 'bidder';
$qs = 'id=' . $id . '&u=' . $bidderId . ($isOwner && $tok !== '' ? '&t=' . urlencode($tok) : '');

// ---- API: poll das mensagens (JSON) ----
if (isset($_GET['fetch'])) {
  header('Content-Type: application/json; charset=utf-8');
  $after = (int) ($_GET['after'] ?? 0);
  $out = [];
  foreach (prj_chat_msgs($id, $bidderId, $after) as $m) {
    $out[] = ['id' => (int) $m['id'], 's' => $m['sender'], 'b' => $m['body'],
              'at' => date('H:i', strtotime((string) $m['created_at']))];
  }
  echo json_encode(['ok' => true, 'msgs' => $out], JSON_UNESCAPED_UNICODE);
  exit;
}

// ---- POSTs: enviar mensagem / encerrar conversa ----
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_check()) {
  if (($_POST['act'] ?? '') === 'send') {
    $body = trim((string) ($_POST['body'] ?? ''));
    if ($body !== '' && mb_strlen($body) <= 2000) {
      try {
        $st = db()->prepare('SELECT COUNT(*) c FROM prj_chat WHERE project_id=? AND user_id=?');
        $st->execute([$id, $bidderId]);
        $first = ((int) ($st->fetch()['c'] ?? 0)) === 0;
        db()->prepare('INSERT INTO prj_chat (project_id, user_id, sender, body) VALUES (?,?,?,?)')
            ->execute([$id, $bidderId, $sender, $body]);
        if ($first) {   // 1ª mensagem → avisa a outra ponta por e-mail (com o link do chat)
          $to = '';
          if ($sender === 'bidder') $to = (string) $p['contact_email'];
          else {
            $q = db()->prepare('SELECT email FROM users WHERE id=? LIMIT 1');
            $q->execute([$bidderId]);
            $to = (string) (($q->fetch()['email'] ?? ''));
          }
          if ($to !== '') @mail($to, 'ConstructCount — ' . t('chat_new_subject'),
                t('chat_new_mail') . ' "' . $p['title'] . "\"\n\n" . url('chat.php?id=' . $id . ($sender === 'bidder' ? '&u=' . $bidderId . '&t=' . $p['manage_token'] : '')),
                "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
        }
      } catch (Throwable $e) {}
    }
    if (isset($_POST['ajax'])) { header('Content-Type: application/json'); echo '{"ok":true}'; exit; }
    redirect(url('chat.php?' . $qs));
  }
  if (($_POST['act'] ?? '') === 'end') {
    prj_chat_end($p, $bidderId);   // transcrição por e-mail p/ os dois + limpeza
    flash(t('chat_ended'));
    redirect(url('projeto.php?id=' . $id . ($isOwner && $tok !== '' ? '&t=' . $tok : '')));
  }
}

$other = '';
if ($isOwner) {
  try {
    $st = db()->prepare('SELECT name FROM users WHERE id=? LIMIT 1');
    $st->execute([$bidderId]);
    $other = (string) ($st->fetch()['name'] ?? '');
  } catch (Throwable $e) {}
} else $other = (string) (($p['contact_name'] ?: $p['company']));

layout_top(t('chat_title'));
?>
<div class="card" style="max-width:680px;margin:0 auto">
  <h2 style="margin-bottom:2px">💬 <?= h(t('chat_title')) ?></h2>
  <p class="muted" style="margin:0"><a href="<?= h(url('projeto.php?id=' . $id . ($isOwner && $tok !== '' ? '&t=' . $tok : ''))) ?>">« <?= h($p['title']) ?></a> · <?= h(t('chat_with')) ?> <b><?= h($other ?: '—') ?></b></p>
  <p style="margin-top:10px;padding:10px 12px;border:1px solid #b58a2a;border-radius:10px;background:rgba(217,160,42,.08);font-size:12.5px;line-height:1.55">⚠️ <?= h(t('chat_hint')) ?></p>
  <div id="chatBox" style="height:340px;overflow-y:auto;border:1px solid var(--bd);border-radius:10px;padding:12px;margin-top:8px;display:flex;flex-direction:column;gap:8px">
    <p class="muted" id="chatEmpty" style="margin:auto;text-align:center"><?= h(t('chat_empty')) ?></p>
  </div>
  <form id="chatForm" style="display:flex;gap:8px;margin-top:10px">
    <?= csrf_field() ?>
    <input type="hidden" name="u" value="<?= $bidderId ?>"><input type="hidden" name="t" value="<?= h($tok) ?>">
    <input name="body" maxlength="2000" autocomplete="off" placeholder="<?= h(t('chat_placeholder')) ?>" style="flex:1">
    <button class="btn"><?= h(t('chat_send')) ?></button>
  </form>
  <form method="post" style="margin-top:10px;text-align:right" onsubmit="return confirm('<?= h(t('chat_end_confirm')) ?>')">
    <?= csrf_field() ?>
    <input type="hidden" name="u" value="<?= $bidderId ?>"><input type="hidden" name="t" value="<?= h($tok) ?>"><input type="hidden" name="act" value="end">
    <button class="btn ghost">📨 <?= h(t('chat_end')) ?></button>
  </form>
</div>
<script>
(function () {
  var ME = <?= json_encode($sender) ?>, QS = <?= json_encode($qs, JSON_UNESCAPED_UNICODE) ?>;
  var last = 0, box = document.getElementById('chatBox'), empty = document.getElementById('chatEmpty');
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function add(m) {
    if (empty) { empty.remove(); empty = null; }
    var mine = m.s === ME;
    var el = document.createElement('div');
    el.style.cssText = 'max-width:78%;padding:8px 11px;border-radius:12px;font-size:13.5px;line-height:1.45;' +
      (mine ? 'align-self:flex-end;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.35)'
            : 'align-self:flex-start;background:rgba(148,163,184,.12);border:1px solid var(--bd)');
    el.innerHTML = esc(m.b) + ' <span style="font-size:10.5px;opacity:.55">' + m.at + '</span>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    last = Math.max(last, m.id);
  }
  function poll() {
    fetch('chat.php?' + QS + '&fetch=1&after=' + last)
      .then(function (r) { return r.json(); })
      .then(function (j) { (j.msgs || []).forEach(add); })
      .catch(function () {});
  }
  poll();
  setInterval(poll, 5000);
  document.getElementById('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = this.querySelector('input[name="body"]');
    var v = inp.value.trim();
    if (!v) return;
    var fd = new FormData(this);
    fd.append('act', 'send'); fd.append('ajax', '1');
    inp.value = '';
    fetch('chat.php?' + QS, { method: 'POST', body: fd }).then(poll);
  });
})();
</script>
<?php layout_bottom(); ?>
