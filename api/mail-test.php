<?php
/* api/mail-test.php — DIAGNÓSTICO temporário de e-mail (remover após o teste).
   Envia só para o e-mail do dono do sistema (hardcoded — não é relay aberto)
   e reporta o retorno do mail() com variações de cabeçalho, p/ descobrir por
   que os e-mails do mural não chegam. Protegido por chave simples. */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
if (($_GET['k'] ?? '') !== 'ccdiag2026') { http_response_code(403); echo '{"err":"forbidden"}'; exit; }

$to = 'pbastosus@gmail.com';
$ts = date('H:i:s');
$out = ['ok' => true, 'ts' => $ts, 'tests' => []];

// 1) igual ao mural hoje: From no-reply@constructcount.com
$r1 = @mail($to, "CC mail-test 1/3 ($ts) — From no-reply", "Teste 1: cabecalho atual do mural (From: no-reply@constructcount.com).",
            "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
$out['tests'][] = ['test' => 'from_noreply', 'mail_returned' => $r1];

// 2) com envelope sender (-f) — exigido por alguns servidores da Hostinger
$r2 = @mail($to, "CC mail-test 2/3 ($ts) — envelope -f", "Teste 2: com envelope sender -f.",
            "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8",
            '-fno-reply@constructcount.com');
$out['tests'][] = ['test' => 'envelope_f', 'mail_returned' => $r2];

// 3) sem From customizado (usa o padrão do servidor)
$r3 = @mail($to, "CC mail-test 3/3 ($ts) — From padrao do servidor", "Teste 3: sem header From (default do host).",
            "Content-Type: text/plain; charset=utf-8");
$out['tests'][] = ['test' => 'default_from', 'mail_returned' => $r3];

$out['php_sendmail_path'] = ini_get('sendmail_path');
$out['php_smtp'] = ini_get('SMTP');
$out['sendmail_from'] = ini_get('sendmail_from');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
