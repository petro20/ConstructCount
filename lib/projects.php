<?php
/* =========================================================================
   projects.php — MURAL DE PROJETOS (captação): quem tem obra publica o
   projeto (PDF + ofícios + região + prazo); os ASSINANTES dão preço enviando
   proposta (valor + relatório) pelo site. GC gerencia por link com token
   (sem precisar de conta). Propor exige assinatura ATIVA (qualquer pacote).
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
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (status), INDEX (created_at)
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

/** Assinatura ATIVA (qualquer pacote) — exigida para dar preço. */
function prj_can_bid(int $userId): bool {
  foreach (lic_for_user($userId) as $l) {
    $exp = !empty($l['expires_at']) && strtotime((string) $l['expires_at']) < time();
    if ($l['status'] === 'active' && !$exp) return true;
  }
  return false;
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
