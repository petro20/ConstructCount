<?php
/* =========================================================================
   projects.php — MURAL DE PROJETOS (captação): quem tem obra publica o
   projeto (PDF + ofícios + região + prazo); os ASSINANTES dão preço enviando
   proposta (valor + relatório) pelo site. LOGIN OBRIGATÓRIO P/ AMBOS os lados
   (multas e ban exigem identidade): publicar liga o projeto à conta
   (owner_user_id) + link de gestão com token (acesso secundário/e-mail).
   Propor exige assinatura ATIVA com o pacote board.
   Tabelas criadas automaticamente (CREATE IF NOT EXISTS) — zero migração.
   ========================================================================= */
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/license.php';

const PRJ_TRADES = ['framing', 'drywall', 'insulation', 'paint', 'windows_doors'];
const PRJ_MAX_PDF = 31457280;   // 30 MB

function prj_trade_label(string $k, ?string $lang = null): string {
  $L = $lang ?: lang();
  $map = [
    'framing'      => ['Framing', 'Framing', 'Framing'],
    'drywall'      => ['Drywall', 'Drywall', 'Drywall'],
    'insulation'   => ['Insulation', 'Insulation', 'Insulation'],
    'paint'        => ['Pintura', 'Paint', 'Pintura'],
    'windows_doors'=> ['Janelas e Portas', 'Windows & Doors', 'Ventanas y Puertas'],
  ];
  $i = $L === 'en' ? 1 : ($L === 'es' ? 2 : 0);
  return $map[$k][$i] ?? $k;
}

function prj_ensure_schema(): void {
  static $done = false;
  if ($done) return;
  $done = true;
  db()->exec("CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    company VARCHAR(120) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    contact_email VARCHAR(190) NOT NULL,
    region VARCHAR(120) NOT NULL,
    trades VARCHAR(190) NOT NULL,
    deadline DATE NULL,
    descr TEXT NULL,
    pdf_path VARCHAR(255) NULL,
    manage_token CHAR(32) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'open',
    lat DECIMAL(9,6) NULL,
    lng DECIMAL(9,6) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (status), INDEX (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  try { db()->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6) NULL, ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6) NULL, ADD COLUMN IF NOT EXISTS pdf_link VARCHAR(500) NULL, ADD COLUMN IF NOT EXISTS closed_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS negotiation_deadline DATE NULL, ADD COLUMN IF NOT EXISTS contract_deadline DATE NULL,
    ADD COLUMN IF NOT EXISTS awarded_at DATETIME NULL, ADD COLUMN IF NOT EXISTS awarded_proposal_id INT NULL, ADD COLUMN IF NOT EXISTS contract_gc_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS pdf_size BIGINT NULL, ADD COLUMN IF NOT EXISTS contract_deadline_orig DATE NULL,
    ADD COLUMN IF NOT EXISTS owner_user_id INT NULL"); } catch (Throwable $e) {}
  try { db()->exec("ALTER TABLE proposals ADD COLUMN IF NOT EXISTS contract_bidder_at DATETIME NULL"); } catch (Throwable $e) {}
  db()->exec("CREATE TABLE IF NOT EXISTS violations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    party VARCHAR(10) NOT NULL,            -- 'owner' (quem oferece) | 'bidder' (quem deu preço)
    user_id INT NULL,
    email VARCHAR(190) NOT NULL,
    kind VARCHAR(24) NOT NULL,             -- no_award | no_contract_owner | no_contract_bidder
    fee DECIMAL(10,2) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',   -- pending | paid | waived
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_v (project_id, kind),
    INDEX (email), INDEX (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  try { db()->exec("ALTER TABLE violations ADD COLUMN IF NOT EXISTS purged_at DATETIME NULL"); } catch (Throwable $e) {}
  db()->exec("CREATE TABLE IF NOT EXISTS bans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    user_id INT NULL,
    reason VARCHAR(60) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ban (email),
    INDEX (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  db()->exec("CREATE TABLE IF NOT EXISTS prj_chat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,                  -- conta de quem dá preço (a outra ponta é o dono do projeto)
    sender VARCHAR(6) NOT NULL,            -- 'owner' | 'bidder'
    body VARCHAR(2000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (project_id, user_id), INDEX (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  db()->exec("CREATE TABLE IF NOT EXISTS proposals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    company VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    message TEXT NULL,
    report_path VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_bid (project_id, user_id),
    INDEX (project_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function prj_upload_dir(string $kind): string {
  $d = __DIR__ . '/../uploads/' . ($kind === 'proposal' ? 'proposals' : 'projects');
  if (!is_dir($d)) @mkdir($d, 0775, true);
  $ht = dirname($d) . '/.htaccess';
  if (!is_file($ht)) @file_put_contents($ht, "Require all denied\nDeny from all\n");   // PDFs só via baixar.php
  return $d;
}

/** Valida e salva um PDF enviado. Retorna o caminho relativo ou null (com $err). */
function prj_save_pdf(array $file, string $kind, ?string &$err = null): ?string {
  $err = null;
  if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) { $err = 'upload'; return null; }
  if (($file['size'] ?? 0) > PRJ_MAX_PDF) { $err = 'size'; return null; }
  if (!preg_match('/\.pdf$/i', (string) ($file['name'] ?? ''))) { $err = 'type'; return null; }
  $fi = new finfo(FILEINFO_MIME_TYPE);
  if ($fi->file($file['tmp_name']) !== 'application/pdf') { $err = 'type'; return null; }
  $name = bin2hex(random_bytes(16)) . '.pdf';
  $dest = prj_upload_dir($kind) . '/' . $name;
  if (!move_uploaded_file($file['tmp_name'], $dest)) { $err = 'upload'; return null; }
  return ($kind === 'proposal' ? 'uploads/proposals/' : 'uploads/projects/') . $name;
}

/** Dar preço exige o PACOTE "Mural de projetos" (módulo 'board') ativo. */
function prj_can_bid(int $userId): bool {
  foreach (lic_for_user($userId) as $l) {
    $exp = !empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time();
    if ($l['status'] !== 'active' || $exp) continue;
    $mods = lic_packages($l);
    if (in_array('board', $mods, true) || in_array('all', $mods, true)) return true;
  }
  return false;
}

/** Geocodifica a região (Nominatim/OSM, gratuito) — lat/lng pro mapa da landing. */
function prj_geocode(string $region): ?array {
  $region = trim($region);
  if ($region === '') return null;
  $url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' . urlencode($region);
  $ctx = stream_context_create(['http' => ['timeout' => 6, 'header' => "User-Agent: ConstructCount/1.0 (constructcount.com)\r\n"]]);
  $raw = @file_get_contents($url, false, $ctx);
  $j = $raw ? json_decode($raw, true) : null;
  if (is_array($j) && !empty($j[0]['lat'])) return ['lat' => (float) $j[0]['lat'], 'lng' => (float) $j[0]['lon']];
  return null;
}

/** Números do quadro da landing: esperando · em negociação · em andamento · concluída. */
function prj_stats(): array {
  prj_ensure_schema();
  $q = function (string $sql): int { return (int) (db()->query($sql)->fetch()['c'] ?? 0); };
  return [
    'waiting'     => $q("SELECT COUNT(*) c FROM projects p WHERE p.status='open' AND 0 = (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id)"),
    'negotiating' => $q("SELECT COUNT(*) c FROM projects p WHERE p.status='open' AND 0 < (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id)"),
    'working'     => $q("SELECT COUNT(*) c FROM projects WHERE status='working'"),
    'done'        => $q("SELECT COUNT(*) c FROM projects WHERE status='closed'"),
  ];
}

/** Contagem de projetos ABERTOS por disciplina (chips da landing). */
function prj_trade_counts(): array {
  prj_ensure_schema();
  $out = [];
  foreach (PRJ_TRADES as $tr) {
    $st = db()->prepare("SELECT COUNT(*) c FROM projects WHERE status='open' AND trades LIKE ?");
    $st->execute(['%' . $tr . '%']);
    $out[$tr] = (int) ($st->fetch()['c'] ?? 0);
  }
  return $out;
}

/** RETENÇÃO: apaga o PDF hospedado de projetos ENCERRADOS há 60+ dias (o registro
    do projeto fica). Mantém o disco do hosting sob controle. Barato — roda no mural. */
function prj_cleanup(): void {
  prj_ensure_schema();
  try {
    $st = db()->query("SELECT id, pdf_path FROM projects WHERE status='closed' AND pdf_path IS NOT NULL AND closed_at IS NOT NULL AND closed_at < (NOW() - INTERVAL 60 DAY) LIMIT 20");
    foreach ($st->fetchAll() as $r) {
      $f = __DIR__ . '/../' . $r['pdf_path'];
      if (is_file($f)) @unlink($f);
      db()->prepare('UPDATE projects SET pdf_path = NULL WHERE id = ?')->execute([(int) $r['id']]);
    }
  } catch (Throwable $e) {}
}

/** BROADCAST: avisa por e-mail os assinantes do pacote Mural (board) sobre um
    projeto novo — é assim que o link é OFERTADO a todos. BCC em lotes, best-effort. */
function prj_notify_subscribers(array $p): void {
  try {
    $rows = db()->query("SELECT u.email, l.plan, l.modules FROM users u JOIN licenses l ON l.user_id = u.id
                         WHERE l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > NOW())")->fetchAll();
  } catch (Throwable $e) { return; }
  $emails = [];
  foreach ($rows as $l) {
    $mods = lic_packages($l);
    if (in_array('board', $mods, true) || in_array('all', $mods, true)) $emails[strtolower((string) $l['email'])] = true;
  }
  $emails = array_keys($emails);
  if (!$emails) return;
  $trades = implode(' · ', array_map('prj_trade_label', array_filter(explode(',', (string) $p['trades']))));
  $subject = 'ConstructCount — ' . t('prj_notify_subject');
  $body = t('prj_notify_body') . "\n\n" . $p['title'] . "\n📍 " . $p['region'] . "\n" . $trades .
          (!empty($p['deadline']) ? ("\n⏳ " . $p['deadline']) : '') .
          "\n\n" . url('projeto.php?id=' . (int) $p['id']);
  foreach (array_chunk($emails, 50) as $chunk) {
    @mail('no-reply@constructcount.com', $subject, $body,
          "From: no-reply@constructcount.com\r\nBcc: " . implode(', ', $chunk) . "\r\nContent-Type: text/plain; charset=utf-8");
  }
}

/** Taxa por prazo descumprido (US$ 5). Sobrescreve no config.php: define('PRJ_PENALTY_FEE', 5.00). */
function prj_fee(): float { cfg_loaded(); return defined('PRJ_PENALTY_FEE') ? (float) PRJ_PENALTY_FEE : 5.00; }

/** Armazenamento: PDF acima de 25 MB paga US$ 5/mês, da publicação até a data final. */
const PRJ_STORAGE_FREE = 26214400;   // 25 MB
function prj_storage_fee(): float { cfg_loaded(); return defined('PRJ_STORAGE_FEE') ? (float) PRJ_STORAGE_FEE : 5.00; }
function prj_storage_months(array $p): int {
  if (empty($p['contract_deadline'])) return 1;
  $days = (strtotime((string) $p['contract_deadline']) - strtotime((string) $p['created_at'])) / 86400;
  return max(1, (int) ceil($days / 30));
}
function prj_storage_due(array $p): float {
  if (empty($p['pdf_path']) || (int) ($p['pdf_size'] ?? 0) <= PRJ_STORAGE_FREE) return 0.0;
  return prj_storage_months($p) * prj_storage_fee();
}

/** Multa de PRORROGAÇÃO: até 1 mês além da data ORIGINAL do contrato é grátis;
    passou de 1 mês → US$ 5 por CADA mês de prorrogação (contado da data original). */
function prj_extension_fee(string $origContract, string $newContract): float {
  $days = (strtotime($newContract) - strtotime($origContract)) / 86400;
  if ($days <= 0) return 0.0;
  $months = (int) ceil($days / 30);
  return $months > 1 ? $months * prj_fee() : 0.0;
}

/** Registra uma violação de prazo (1x por tipo/projeto) e avisa a parte por e-mail. */
function prj_violation(array $p, string $party, string $kind, ?int $userId, string $email): void {
  try {
    $st = db()->prepare('INSERT IGNORE INTO violations (project_id, party, user_id, email, kind, fee) VALUES (?,?,?,?,?,?)');
    $st->execute([(int) $p['id'], $party, $userId, $email, $kind, prj_fee()]);
    if ($st->rowCount() > 0 && $email !== '') {
      $due = date('Y-m-d', time() + 30 * 86400);   // prazo p/ quitar = 30 dias
      @mail($email, 'ConstructCount — ' . t('prj_v_subject'),
            t('prj_v_mail') . ' "' . $p['title'] . "\" — US$ " . number_format(prj_fee(), 2) .
            "\n\n" . str_replace('{due}', $due, t('prj_v_mail2')) . "\n\n" . url('projeto.php?id=' . (int) $p['id']),
            "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
    }
  } catch (Throwable $e) {}
}

/** A parte tem multa pendente? (bloqueia publicar / dar preço até regularizar) */
function prj_pending_fees(string $party, ?int $userId, string $email = ''): array {
  prj_ensure_schema();
  try {
    if ($party === 'bidder' && $userId) {
      $st = db()->prepare("SELECT * FROM violations WHERE party='bidder' AND user_id=? AND status='pending'");
      $st->execute([$userId]);
    } elseif ($userId) {
      // owner com conta: pega pela conta OU pelo e-mail (cobre projetos antigos sem conta)
      $st = db()->prepare("SELECT * FROM violations WHERE party='owner' AND status='pending' AND (user_id=? OR email=?)");
      $st->execute([$userId, $email]);
    } else {
      $st = db()->prepare("SELECT * FROM violations WHERE party='owner' AND email=? AND status='pending'");
      $st->execute([$email]);
    }
    return $st->fetchAll();
  } catch (Throwable $e) { return []; }
}

/** FISCAL DOS PRAZOS (roda no mural/projeto — lazy cron):
    • passou o prazo de NEGOCIAÇÃO sem proposta aceita (havendo propostas) → multa do OFERTANTE;
    • passou o prazo de CONTRATO sem a confirmação de um lado → multa desse lado. */
function prj_check_deadlines(): void {
  prj_ensure_schema();
  try {
    $today = date('Y-m-d');
    // negociação vencida sem award (só se houve ao menos 1 proposta)
    $st = db()->prepare("SELECT p.* FROM projects p WHERE p.status='open' AND p.negotiation_deadline IS NOT NULL AND p.negotiation_deadline < ?
                         AND p.awarded_proposal_id IS NULL AND 0 < (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) LIMIT 25");
    $st->execute([$today]);
    foreach ($st->fetchAll() as $p) prj_violation($p, 'owner', 'no_award', !empty($p['owner_user_id']) ? (int) $p['owner_user_id'] : null, (string) $p['contact_email']);
    // contrato vencido sem confirmação
    $st = db()->prepare("SELECT p.*, pr.user_id bidder_id, pr.email bidder_email, pr.contract_bidder_at
                         FROM projects p JOIN proposals pr ON pr.id = p.awarded_proposal_id
                         WHERE p.status='awarded' AND p.contract_deadline IS NOT NULL AND p.contract_deadline < ? LIMIT 25");
    $st->execute([$today]);
    foreach ($st->fetchAll() as $p) {
      if (empty($p['contract_gc_at'])) prj_violation($p, 'owner', 'no_contract_owner', !empty($p['owner_user_id']) ? (int) $p['owner_user_id'] : null, (string) $p['contact_email']);
      if (empty($p['contract_bidder_at'])) prj_violation($p, 'bidder', 'no_contract_bidder', (int) $p['bidder_id'], (string) $p['bidder_email']);
    }
  } catch (Throwable $e) {}
  prj_chat_autoclose();  // chats parados 7+ dias → transcrição por e-mail + limpeza
  prj_purge_overdue();   // 30 dias sem quitar → dados apagados (bloqueio permanece)
}

/* ---------- CHAT TEMPORÁRIO (dúvidas entre ofertante e quem dá preço) ----------
   NADA fica guardado no site: ao encerrar (botão de qualquer lado, encerramento
   do projeto ou 7 dias sem mensagem) a conversa COMPLETA é enviada por e-mail
   para os DOIS envolvidos e as mensagens são APAGADAS do banco. */
function prj_chat_msgs(int $projectId, int $bidderId, int $afterId = 0): array {
  try {
    $st = db()->prepare('SELECT id, sender, body, created_at FROM prj_chat WHERE project_id=? AND user_id=? AND id>? ORDER BY id LIMIT 200');
    $st->execute([$projectId, $bidderId, $afterId]);
    return $st->fetchAll();
  } catch (Throwable $e) { return []; }
}

/** Encerra a conversa: transcrição por e-mail p/ os dois + apaga as mensagens. */
function prj_chat_end(array $p, int $bidderId): void {
  $msgs = prj_chat_msgs((int) $p['id'], $bidderId);
  if (!$msgs) return;
  try {
    $st = db()->prepare('SELECT name, email FROM users WHERE id=? LIMIT 1');
    $st->execute([$bidderId]);
    $b = $st->fetch() ?: ['name' => '—', 'email' => ''];
    $ownerName = (string) (($p['contact_name'] ?? '') ?: $p['company']);
    $lines = [];
    foreach ($msgs as $m) {
      $who = $m['sender'] === 'owner' ? $ownerName : (string) $b['name'];
      $lines[] = '[' . date('d/m H:i', strtotime((string) $m['created_at'])) . '] ' . $who . ': ' . $m['body'];
    }
    $body = t('chat_mail_body') . ' "' . $p['title'] . "\"\n\n" . implode("\n", $lines)
          . "\n\n" . url('projeto.php?id=' . (int) $p['id']);
    $hdr = "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8";
    if (!empty($p['contact_email'])) @mail((string) $p['contact_email'], 'ConstructCount — ' . t('chat_mail_subject'), $body, $hdr);
    if (!empty($b['email'])) @mail((string) $b['email'], 'ConstructCount — ' . t('chat_mail_subject'), $body, $hdr);
    db()->prepare('DELETE FROM prj_chat WHERE project_id=? AND user_id=?')->execute([(int) $p['id'], $bidderId]);
  } catch (Throwable $e) {}
}

/** Conversa parada há 7+ dias encerra sozinha (sistema vivo — roda no cron/fiscal). */
function prj_chat_autoclose(): void {
  try {
    $st = db()->query("SELECT project_id, user_id, MAX(created_at) last FROM prj_chat
                       GROUP BY project_id, user_id HAVING last < (NOW() - INTERVAL 7 DAY) LIMIT 20");
    foreach ($st->fetchAll() as $r) {
      $p = prj_get((int) $r['project_id']);
      if ($p) prj_chat_end($p, (int) $r['user_id']);
      else db()->prepare('DELETE FROM prj_chat WHERE project_id=?')->execute([(int) $r['project_id']]);
    }
  } catch (Throwable $e) {}
}

/** BANIMENTO DEFINITIVO: empresa que deixou a multa vencer (purga) não publica nem
    dá preço NUNCA MAIS neste sistema (por e-mail e, se houver, por conta). */
function prj_ban(string $email, ?int $userId, string $reason): void {
  try {
    db()->prepare('INSERT IGNORE INTO bans (email, user_id, reason) VALUES (?,?,?)')
        ->execute([strtolower(trim($email)), $userId, $reason]);
  } catch (Throwable $e) {}
}
function prj_is_banned(?int $userId, string $email = ''): bool {
  prj_ensure_schema();
  try {
    if ($userId) {
      $st = db()->prepare('SELECT 1 FROM bans WHERE user_id = ? LIMIT 1');
      $st->execute([$userId]);
      if ($st->fetch()) return true;
    }
    if ($email !== '') {
      $st = db()->prepare('SELECT 1 FROM bans WHERE email = ? LIMIT 1');
      $st->execute([strtolower(trim($email))]);
      if ($st->fetch()) return true;
    }
  } catch (Throwable $e) {}
  return false;
}

/** PURGA por inadimplência: multa pendente há 30+ dias sem quitar → os dados são
    APAGADOS definitivamente (avisado no e-mail da multa). Owner: projeto inteiro
    (PDFs + propostas + registro). Bidder: as propostas dele naquele projeto.
    A multa CONTINUA pendente (o bloqueio não cai com a purga). */
function prj_purge_overdue(): void {
  try {
    $st = db()->query("SELECT * FROM violations WHERE status='pending' AND purged_at IS NULL AND created_at < (NOW() - INTERVAL 30 DAY) LIMIT 10");
    foreach ($st->fetchAll() as $v) {
      $pid = (int) $v['project_id'];
      if ($v['party'] === 'owner') {
        $p = prj_get($pid);
        if ($p) {
          if (!empty($p['pdf_path'])) { $f = __DIR__ . '/../' . $p['pdf_path']; if (is_file($f)) @unlink($f); }
          $q = db()->prepare('SELECT report_path FROM proposals WHERE project_id=? AND report_path IS NOT NULL');
          $q->execute([$pid]);
          foreach ($q->fetchAll() as $r) { $f = __DIR__ . '/../' . $r['report_path']; if (is_file($f)) @unlink($f); }
          db()->prepare('DELETE FROM proposals WHERE project_id=?')->execute([$pid]);
          db()->prepare('DELETE FROM prj_chat WHERE project_id=?')->execute([$pid]);
          db()->prepare('DELETE FROM projects WHERE id=?')->execute([$pid]);
        }
      } else {
        $q = db()->prepare('SELECT id, report_path FROM proposals WHERE project_id=? AND user_id=?');
        $q->execute([$pid, (int) $v['user_id']]);
        foreach ($q->fetchAll() as $r) {
          if (!empty($r['report_path'])) { $f = __DIR__ . '/../' . $r['report_path']; if (is_file($f)) @unlink($f); }
          db()->prepare('DELETE FROM proposals WHERE id=?')->execute([(int) $r['id']]);
        }
        db()->prepare('DELETE FROM prj_chat WHERE project_id=? AND user_id=?')->execute([$pid, (int) $v['user_id']]);
      }
      db()->prepare('UPDATE violations SET purged_at = NOW() WHERE id=?')->execute([(int) $v['id']]);
      prj_ban((string) $v['email'], $v['user_id'] ? (int) $v['user_id'] : null, 'fee_unpaid_30d');   // bloqueio DEFINITIVO
      if (!empty($v['email'])) {
        @mail((string) $v['email'], 'ConstructCount — ' . t('prj_purged_subject'),
              t('prj_purged_mail'),
              "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
      }
    }
  } catch (Throwable $e) {}
}

/** ACEITAR uma proposta (award): projeto vira 'awarded' e o vencedor é avisado. */
function prj_award(array $p, int $proposalId): bool {
  $st = db()->prepare('SELECT * FROM proposals WHERE id=? AND project_id=? LIMIT 1');
  $st->execute([$proposalId, (int) $p['id']]);
  $b = $st->fetch();
  if (!$b) return false;
  db()->prepare("UPDATE projects SET status='awarded', awarded_at=NOW(), awarded_proposal_id=? WHERE id=?")
      ->execute([$proposalId, (int) $p['id']]);
  @mail((string) $b['email'], 'ConstructCount — 🎉 ' . t('prj_won_subject'),
        t('prj_won_mail') . ' "' . $p['title'] . "\"\n" . t('prj_won_mail2') .
        (!empty($p['contract_deadline']) ? (' ' . t('prj_until') . ' ' . $p['contract_deadline']) : '') .
        "\n\n" . url('projeto.php?id=' . (int) $p['id']),
        "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
  return true;
}

/** Contagem de projetos por REGIÃO (quadro da landing): abertos, em obra e total. */
function prj_region_counts(int $limit = 12): array {
  prj_ensure_schema();
  try {
    return db()->query("SELECT region,
        SUM(status='open') open_n,
        SUM(status='awarded') awarded_n,
        SUM(status='working') working_n,
        COUNT(*) total_n
      FROM projects WHERE status IN ('open','awarded','working')
      GROUP BY region ORDER BY total_n DESC, region ASC LIMIT " . (int) $limit)->fetchAll();
  } catch (Throwable $e) { return []; }
}

/** Quadro do MURAL: regiões com projetos ABERTOS + demanda por ofício —
    ajuda o assinante a decidir ONDE e QUAL pacote vale assinar pra dar preço. */
function prj_region_board(int $limit = 15): array {
  prj_ensure_schema();
  try { $rows = db()->query("SELECT region, trades FROM projects WHERE status='open'")->fetchAll(); }
  catch (Throwable $e) { return []; }
  $agg = [];
  foreach ($rows as $r) {
    $rg = (string) $r['region'];
    if (!isset($agg[$rg])) $agg[$rg] = ['region' => $rg, 'open_n' => 0, 'trades' => []];
    $agg[$rg]['open_n']++;
    foreach (array_filter(explode(',', (string) $r['trades'])) as $t) {
      $agg[$rg]['trades'][$t] = ($agg[$rg]['trades'][$t] ?? 0) + 1;
    }
  }
  usort($agg, function ($a, $b) { return $b['open_n'] <=> $a['open_n']; });
  return array_slice(array_values($agg), 0, $limit);
}

/** Projetos com coordenadas (pins do mapa). */
function prj_geo_list(): array {
  prj_ensure_schema();
  return db()->query("SELECT p.id, p.title, p.region, p.trades, p.status, p.lat, p.lng,
      (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) AS n_bids
      FROM projects p WHERE p.lat IS NOT NULL AND p.status IN ('open','working')
      ORDER BY p.created_at DESC LIMIT 300")->fetchAll();
}

/** Módulos (pacotes) das licenças ativas do usuário — p/ destacar projetos que combinam. */
function prj_user_modules(int $userId): array {
  $out = [];
  foreach (lic_for_user($userId) as $l) {
    $exp = !empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time();
    if ($l['status'] !== 'active' || $exp) continue;
    foreach (lic_packages($l) as $m) $out[$m] = true;
  }
  return array_keys($out);
}

function prj_get(int $id): ?array {
  prj_ensure_schema();
  $st = db()->prepare('SELECT * FROM projects WHERE id = ? LIMIT 1');
  $st->execute([$id]);
  return $st->fetch() ?: null;
}

function prj_list(string $trade = '', string $q = ''): array {
  prj_ensure_schema();
  $sql = "SELECT p.*, (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) AS n_bids
          FROM projects p WHERE p.status = 'open'";
  $args = [];
  if ($trade !== '' && in_array($trade, PRJ_TRADES, true)) { $sql .= ' AND p.trades LIKE ?'; $args[] = '%' . $trade . '%'; }
  if ($q !== '') { $sql .= ' AND (p.title LIKE ? OR p.region LIKE ? OR p.company LIKE ?)'; $w = '%' . $q . '%'; array_push($args, $w, $w, $w); }
  $sql .= ' ORDER BY p.created_at DESC LIMIT 200';
  $st = db()->prepare($sql);
  $st->execute($args);
  return $st->fetchAll();
}
