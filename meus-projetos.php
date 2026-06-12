<?php
/* meus-projetos.php — quem OFERECE perdeu o link de gestão? Digita o e-mail e
   recebe por e-mail os links de TODOS os projetos publicados com ele.
   (Nada aparece na tela — só vai pro e-mail do dono, pra não vazar os tokens.) */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_check()) {
  $email = trim((string) ($_POST['email'] ?? ''));
  if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $st = db()->prepare("SELECT id, title, status, manage_token FROM projects WHERE contact_email = ? ORDER BY created_at DESC LIMIT 50");
    $st->execute([$email]);
    $rows = $st->fetchAll();
    if ($rows) {
      $body = t('prj_recover_mail') . "\n\n";
      foreach ($rows as $r) {
        $body .= '• ' . $r['title'] . ' (' . $r['status'] . ")\n  " . url('projeto.php?id=' . (int) $r['id'] . '&t=' . $r['manage_token']) . "\n\n";
      }
      @mail($email, 'ConstructCount — ' . t('prj_recover_subject'), $body,
            "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
    }
  }
  // resposta idêntica com ou sem projetos (não revela se o e-mail existe)
  flash(t('prj_recover_sent'));
  redirect(url('meus-projetos.php'));
}
layout_top(t('prj_recover_title'));
?>
<div class="card" style="max-width:560px;margin:0 auto">
  <h2><?= h(t('prj_recover_title')) ?></h2>
  <p class="muted"><?= h(t('prj_recover_sub')) ?></p>
  <form method="post" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
    <?= csrf_field() ?>
    <input type="email" name="email" required placeholder="voce@empresa.com" style="flex:1;min-width:220px">
    <button class="btn"><?= h(t('prj_recover_btn')) ?></button>
  </form>
</div>
<?php layout_bottom(); ?>
