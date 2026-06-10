<?php
/* =========================================================================
   region_prices.php — IA busca na WEB os TAMANHOS padrão e os PREÇOS dos
   materiais para a REGIÃO do trabalho (cidade/estado/ZIP, EUA). Devolve uma
   faixa de preço por unidade + fonte + data. TUDO marcado como ESTIMATIVA —
   o usuário confirma. Usado pelo pacote Framing (takeoff).
   Mesma base do read_assembly.php: chave no config.php, gate de licença.
   ========================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
@set_time_limit(180);

function fail(int $code, string $msg): void {
  http_response_code($code);
  echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'Use POST.');

/* ---------- chave + modelo (config.php server-side) ---------- */
$cfg = __DIR__ . '/config.php';
if (is_file($cfg)) require $cfg;
$apiKey = getenv('ANTHROPIC_API_KEY') ?: (defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '');
$model  = defined('CONSTRUCTCOUNT_MODEL') ? CONSTRUCTCOUNT_MODEL : (defined('FENESTRA_MODEL') ? FENESTRA_MODEL : 'claude-opus-4-8');
if ($apiKey === '') fail(500, 'API key não configurada (api/config.php).');

/* ---------- entrada ---------- */
$raw = file_get_contents('php://input');
$in  = json_decode($raw ?: '', true);
if (!is_array($in)) fail(400, 'JSON inválido.');
$region = trim((string) ($in['region'] ?? ''));
if ($region === '') fail(400, 'Informe a região (cidade/estado ou ZIP) em "region".');
$materials = is_array($in['materials'] ?? null) ? $in['materials'] : [];
if (!$materials) fail(400, 'Envie a lista de materiais em "materials".');

/* ---------- gate de licença (IA só roda com licença válida) ---------- */
$licUrl = defined('CONSTRUCTCOUNT_LICENSE_VALIDATE_URL') ? CONSTRUCTCOUNT_LICENSE_VALIDATE_URL
        : (defined('FENESTRA_LICENSE_VALIDATE_URL') ? FENESTRA_LICENSE_VALIDATE_URL : '');
if ($licUrl) {
  $ch = curl_init($licUrl);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 12,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['key' => (string) ($in['license_key'] ?? ''), 'device' => (string) ($in['device'] ?? ''), 'device_label' => (string) ($in['device_label'] ?? '')]),
  ]);
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($resp === false || $code === 0) fail(503, 'Servidor de licença indisponível.');
  $lic = json_decode($resp, true);
  if (!is_array($lic) || empty($lic['valid'])) fail(402, 'Licença inválida: ' . (is_array($lic) ? ($lic['reason'] ?? 'não autorizada') : 'não autorizada'));
}

/* ---------- lista de materiais para o prompt ---------- */
$lines = [];
foreach ($materials as $m) {
  if (!is_array($m)) continue;
  $k = (string) ($m['key'] ?? '');
  $lb = (string) ($m['label'] ?? $k);
  $un = (string) ($m['unit'] ?? '');
  if ($k === '') continue;
  $lines[] = "- key=\"{$k}\" | {$lb} | unidade: {$un}";
}
if (!$lines) fail(400, 'Materiais inválidos.');
$matList = implode("\n", $lines);

$system = "Você é um ESTIMADOR de custos de construção nos EUA. Usando BUSCA NA WEB, "
        . "levante para a REGIÃO informada (cidade/estado/ZIP) o TAMANHO padrão e uma FAIXA "
        . "de PREÇO atual por UNIDADE (em USD) de cada material da lista.\n\n"
        . "Regras:\n"
        . "  • Procure preços de fornecedores reais que atendem a região (Home Depot, Lowe's, "
        . "supply houses locais). Prefira preços recentes.\n"
        . "  • Dê uma FAIXA (price_low, price_high) e um valor central (price) na UNIDADE pedida.\n"
        . "  • size: tamanho/medida padrão do item (ex.: stud precut 92-5/8\\\", chapa 4x8, etc.).\n"
        . "  • source: domínio/fonte principal usada; date: data da consulta (AAAA-MM-DD).\n"
        . "  • Se não tiver certeza de um item, diga no note e ainda assim dê a melhor faixa.\n"
        . "  • TUDO é ESTIMATIVA — o usuário vai confirmar.\n\n"
        . "Responda SOMENTE com um objeto JSON válido (sem markdown), no formato:\n"
        . "{\"region\":\"...\",\"currency\":\"USD\",\"date\":\"AAAA-MM-DD\",\"items\":[{"
        . "\"key\":\"...\",\"size\":\"...\",\"unit\":\"...\",\"price\":0,\"price_low\":0,"
        . "\"price_high\":0,\"source\":\"...\",\"note\":\"...\"}]}";

$user = "Região do trabalho: {$region}\n\nMateriais (devolva um item por key):\n{$matList}\n\n"
      . "Busque os preços atuais para essa região e devolva o JSON.";

$body = [
  'model'      => $model,
  'max_tokens' => 4000,
  'system'     => $system,
  'tools'      => [['type' => 'web_search_20250305', 'name' => 'web_search', 'max_uses' => 6]],
  'messages'   => [['role' => 'user', 'content' => $user]],
];

/* ---------- chamada à API ---------- */
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => ['content-type: application/json', 'x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'],
  CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
  CURLOPT_TIMEOUT        => 175,
]);
$resp = curl_exec($ch);
if ($resp === false) fail(502, 'Falha ao contatar a API: ' . curl_error($ch));
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($resp, true);
if ($status !== 200) fail(502, 'Erro da API Claude: ' . ($data['error']['message'] ?? ('HTTP ' . $status)));

/* junta os blocos de texto da resposta e extrai o JSON */
$text = '';
foreach (($data['content'] ?? []) as $block) {
  if (($block['type'] ?? '') === 'text') $text .= (string) $block['text'];
}
$text = trim($text);
// tira cercas de markdown se houver
if (preg_match('/\{.*\}/s', $text, $mm)) $text = $mm[0];
$parsed = json_decode($text, true);
if (!is_array($parsed)) fail(502, 'Resposta da IA não pôde ser interpretada como JSON.');

echo json_encode($parsed, JSON_UNESCAPED_UNICODE);
