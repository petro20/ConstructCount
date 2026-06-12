<?php
/* baixar.php — entrega os PDFs do mural com controle de acesso.
   k=project&id=N           → PDF do projeto: assinante ATIVO logado, ou dono (t=token)
   k=proposal&id=N&t=token  → relatório da proposta: só o dono do projeto         */
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();

$k = (string) ($_GET['k'] ?? '');
$id = (int) ($_GET['id'] ?? 0);
$tok = (string) ($_GET['t'] ?? '');
$path = null; $fname = 'arquivo.pdf';

if ($k === 'project') {
  $p = prj_get($id);
  if (!$p || empty($p['pdf_path'])) { http_response_code(404); exit('not found'); }
  $isOwner = $tok !== '' && hash_equals((string) $p['manage_token'], $tok);
  $u = current_user();
  if (!$isOwner && !($u && prj_can_bid((int) $u['id']))) { http_response_code(403); exit('assinatura necessária'); }
  $path = $p['pdf_path']; $fname = 'projeto-' . $id . '.pdf';
} elseif ($k === 'proposal') {
  $st = db()->prepare('SELECT pr.report_path, p.manage_token FROM proposals pr JOIN projects p ON p.id = pr.project_id WHERE pr.id = ? LIMIT 1');
  $st->execute([$id]);
  $row = $st->fetch();
  if (!$row || empty($row['report_path'])) { http_response_code(404); exit('not found'); }
  if ($tok === '' || !hash_equals((string) $row['manage_token'], $tok)) { http_response_code(403); exit('sem acesso'); }
  $path = $row['report_path']; $fname = 'proposta-' . $id . '.pdf';
} else { http_response_code(400); exit('k?'); }

$full = __DIR__ . '/' . $path;
if (!is_file($full)) { http_response_code(404); exit('not found'); }
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $fname . '"');
header('Content-Length: ' . filesize($full));
readfile($full);
