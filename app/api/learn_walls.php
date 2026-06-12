<?php
/* =========================================================================
   learn_walls.php — coleta CASOS DE APRENDIZADO do parser de tipos de parede.
   O app envia (best-effort) os TEXTOS da folha quando o formato não foi
   reconhecido — e o resultado quando a IA de visão resolveu. Esses casos
   alimentam o wall-patterns.json e as melhorias do parser nas atualizações.
   Privacidade: só textos de callouts/títulos da folha de tipos — sem imagens,
   sem a planta. Log mensal em learn/ (fora do Git).
   ========================================================================= */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); echo '{"error":"POST"}'; exit; }
$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 262144) { http_response_code(413); echo '{"error":"payload"}'; exit; }
$j = json_decode($raw, true);
if (!is_array($j)) { http_response_code(400); echo '{"error":"json"}'; exit; }

$dir = __DIR__ . '/learn';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$rec = ['rx' => date('c'), 'iph' => hash('crc32b', (string) ($_SERVER['REMOTE_ADDR'] ?? ''))] + $j;
@file_put_contents($dir . '/wall-cases-' . date('Y-m') . '.jsonl',
                   json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n",
                   FILE_APPEND | LOCK_EX);
echo '{"ok":true}';
