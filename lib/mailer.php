<?php
/* =========================================================================
   mailer.php — envio CENTRAL de e-mail do portal (cc_mail).
   Preferência: SMTP AUTENTICADO (confiável, não cai em spam). Configure no
   config.php do servidor (a caixa precisa existir no hPanel da Hostinger):
     define('SMTP_HOST', 'smtp.hostinger.com');
     define('SMTP_PORT', 465);                         // 465 = SSL direto
     define('SMTP_USER', 'no-reply@constructcount.com');
     define('SMTP_PASS', 'senha-da-caixa');
     define('SMTP_FROM', 'no-reply@constructcount.com');  // opcional (= USER)
   Sem SMTP no config, cai no mail() do PHP com envelope -f (a Hostinger só
   aceita com a caixa do remetente criada). Suporta Bcc (lotes do mural).
   ========================================================================= */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function cc_mail(string $to, string $subject, string $body, array $bcc = []): bool {
  cfg_loaded();
  // remetente padrão = caixa REAL existente no hPanel (support@) — a Hostinger
  // recusa envio de caixas inexistentes (era o no-reply@, que não existia)
  $from = defined('SMTP_FROM') ? (string) SMTP_FROM : (defined('SMTP_USER') ? (string) SMTP_USER : 'support@constructcount.com');
  if (defined('SMTP_HOST') && defined('SMTP_USER') && defined('SMTP_PASS')) {
    $r = _cc_smtp($from, $to, $subject, $body, $bcc);
    if ($r) return true;                       // SMTP falhou? tenta o mail() abaixo
  }
  $hdr = 'From: ConstructCount <' . $from . ">\r\nContent-Type: text/plain; charset=utf-8";
  if ($bcc) $hdr .= "\r\nBcc: " . implode(', ', $bcc);
  return @mail($to, $subject, $body, $hdr, '-f' . $from);
}

/** Cliente SMTP mínimo (SSL 465 ou STARTTLS 587) — sem dependências. */
function _cc_smtp(string $from, string $to, string $subject, string $body, array $bcc): bool {
  try {
    $host = (string) SMTP_HOST;
    $port = (int) (defined('SMTP_PORT') ? SMTP_PORT : 465);
    $ssl = ($port === 465);
    $fp = @stream_socket_client(($ssl ? 'ssl://' : 'tcp://') . $host . ':' . $port, $en, $es, 12);
    if (!$fp) return false;
    stream_set_timeout($fp, 12);
    $read = function () use ($fp) { $s = ''; while ($l = fgets($fp, 515)) { $s .= $l; if (strlen($l) < 4 || $l[3] !== '-') break; } return $s; };
    $cmd = function (string $c) use ($fp, $read) { fwrite($fp, $c . "\r\n"); return $read(); };
    $ok = function (string $r) { return $r !== '' && ($r[0] === '2' || $r[0] === '3'); };
    if (!$ok($read())) { fclose($fp); return false; }
    if (!$ok($cmd('EHLO constructcount.com'))) { fclose($fp); return false; }
    if (!$ssl) {
      if (!$ok($cmd('STARTTLS'))) { fclose($fp); return false; }
      if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return false; }
      if (!$ok($cmd('EHLO constructcount.com'))) { fclose($fp); return false; }
    }
    if (!$ok($cmd('AUTH LOGIN'))) { fclose($fp); return false; }
    if (!$ok($cmd(base64_encode((string) SMTP_USER)))) { fclose($fp); return false; }
    if (!$ok($cmd(base64_encode((string) SMTP_PASS)))) { fclose($fp); return false; }
    if (!$ok($cmd('MAIL FROM:<' . $from . '>'))) { fclose($fp); return false; }
    $any = false;
    foreach (array_merge([$to], $bcc) as $rc) {
      $rc = trim($rc);
      if ($rc !== '' && $ok($cmd('RCPT TO:<' . $rc . '>'))) $any = true;
    }
    if (!$any || !$ok($cmd('DATA'))) { fclose($fp); return false; }
    $msg = 'From: ConstructCount <' . $from . '>'
         . "\r\nTo: <" . $to . '>'
         . "\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . '?='
         . "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit"
         . "\r\nDate: " . date('r')
         . "\r\nMessage-ID: <" . bin2hex(random_bytes(10)) . '@constructcount.com>'
         . "\r\n\r\n" . preg_replace('/^\./m', '..', $body) . "\r\n.";
    $r = $cmd($msg);
    $cmd('QUIT');
    fclose($fp);
    return $ok($r);
  } catch (Throwable $e) { return false; }
}
