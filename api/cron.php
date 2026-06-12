<?php
/* api/cron.php — pulso do SISTEMA VIVO. Roda as tarefas de manutenção do mural
   sem depender de visitas: fiscal de prazos (multas), purga de inadimplentes
   (30 dias → dados apagados + ban definitivo) e retenção de PDFs (60 dias).
   Chamado diariamente pelo guardião (rotina agendada) — e é seguro chamar
   quantas vezes for: tudo é idempotente. */
declare(strict_types=1);
require __DIR__ . '/../lib/db.php';
require __DIR__ . '/../lib/projects.php';
require_once __DIR__ . '/../lib/i18n.php';

header('Content-Type: application/json; charset=utf-8');
prj_ensure_schema();
prj_check_deadlines();   // multas + purga + ban (inclui prj_purge_overdue)
prj_cleanup();           // retenção dos PDFs de projetos encerrados

$c = function (string $sql): int { try { return (int) (db()->query($sql)->fetch()['c'] ?? 0); } catch (Throwable $e) { return -1; } };
echo json_encode([
  'ok' => true,
  'ts' => date('c'),
  'pending_fees' => $c("SELECT COUNT(*) c FROM violations WHERE status='pending'"),
  'purged' => $c("SELECT COUNT(*) c FROM violations WHERE purged_at IS NOT NULL"),
  'bans' => $c('SELECT COUNT(*) c FROM bans'),
  'open_projects' => $c("SELECT COUNT(*) c FROM projects WHERE status='open'"),
], JSON_UNESCAPED_UNICODE);
