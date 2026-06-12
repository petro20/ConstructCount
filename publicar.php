<?php
/* publicar.php — quem TEM OBRA publica o projeto no mural (sem precisar de conta).
   Gera um link de gestão com token (vê propostas / fecha) + e-mail de confirmação. */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

$err = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!csrf_check()) $err = t('err_fields');
  else {
    $title = trim((string) ($_POST['title'] ?? ''));
    $company = trim((string) ($_POST['company'] ?? ''));
    $cname = trim((string) ($_POST['contact_name'] ?? ''));
    $cemail = trim((string) ($_POST['contact_email'] ?? ''));
    $region = trim((string) ($_POST['region'] ?? ''));
    $deadline = trim((string) ($_POST['deadline'] ?? ''));
    $descr = trim((string) ($_POST['descr'] ?? ''));
    $trades = array_values(array_intersect((array) ($_POST['trades'] ?? []), PRJ_TRADES));
    if ($title === '' || $company === '' || $cemail === '' || $region === '' || !$trades || !filter_var($cemail, FILTER_VALIDATE_EMAIL)) {
      $err = t('err_fields');
    } else {
      $pdf = null;
      if (!empty($_FILES['pdf']['name'])) {
        $pdf = prj_save_pdf($_FILES['pdf'], 'project', $perr);
        if ($pdf === null) $err = t('prj_pdf_err');
      }
      if ($err === '') {
        $tok = bin2hex(random_bytes(16));
        db()->prepare('INSERT INTO projects (title,company,contact_name,contact_email,region,trades,deadline,descr,pdf_path,manage_token) VALUES (?,?,?,?,?,?,?,?,?,?)')
            ->execute([$title, $company, $cname, $cemail, $region, implode(',', $trades), ($deadline ?: null), $descr, $pdf, $tok]);
        $id = (int) db()->lastInsertId();
        $link = url('projeto.php?id=' . $id . '&t=' . $tok);
        @mail($cemail, 'ConstructCount — ' . t('prj_published_subject'),
              t('prj_published_mail') . "\n\n" . $link,
              "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
        flash(t('prj_published_flash'));
        redirect($link);
      }
    }
  }
}
layout_top(t('prj_post_title'));
?>
<div class="card" style="max-width:760px;margin:0 auto">
  <h2><?= h(t('prj_post_title')) ?></h2>
  <p class="muted"><?= h(t('prj_post_sub')) ?></p>
  <?php if ($err): ?><p class="err"><?= h($err) ?></p><?php endif; ?>
  <form method="post" enctype="multipart/form-data" style="display:grid;gap:12px;margin-top:10px">
    <?= csrf_field() ?>
    <label><?= h(t('prj_f_title')) ?><br><input name="title" required maxlength="160" style="width:100%"></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label><?= h(t('prj_f_company')) ?><br><input name="company" required maxlength="120" style="width:100%"></label>
      <label><?= h(t('prj_f_contact')) ?><br><input name="contact_name" maxlength="120" style="width:100%"></label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label><?= h(t('prj_f_email')) ?><br><input type="email" name="contact_email" required maxlength="190" style="width:100%"></label>
      <label><?= h(t('prj_f_region')) ?><br><input name="region" required maxlength="120" placeholder="Paterson, NJ" style="width:100%"></label>
    </div>
    <div>
      <?= h(t('prj_f_trades')) ?><br>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px">
        <?php foreach (PRJ_TRADES as $tr): ?>
          <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="trades[]" value="<?= h($tr) ?>"> <?= h(prj_trade_label($tr)) ?></label>
        <?php endforeach; ?>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label><?= h(t('prj_f_deadline')) ?><br><input type="date" name="deadline" style="width:100%"></label>
      <label><?= h(t('prj_f_pdf')) ?><br><input type="file" name="pdf" accept="application/pdf" style="width:100%"></label>
    </div>
    <label><?= h(t('prj_f_descr')) ?><br><textarea name="descr" rows="4" style="width:100%"></textarea></label>
    <button class="btn"><?= h(t('prj_post_btn')) ?></button>
    <p class="muted" style="font-size:12.5px"><?= h(t('prj_post_note')) ?></p>
  </form>
</div>
<?php layout_bottom(); ?>
