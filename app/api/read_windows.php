<?php
/* =========================================================================
   read_windows.php — IA (visão) lê o WINDOW/DOOR SCHEDULE ou as ELEVAÇÕES de
   esquadrias de uma ÁREA da folha e devolve {code, width, height, category}.
   Usado pelo "Reler medidas" quando os códigos/cotas são vetor (sem texto).
   Mesma base do read_assembly.php: chave no config.php, gate de licença, Claude.
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
if (!is_array($in) || empty($in['image_base64'])) fail(400, 'Envie image_base64 (recorte da área) no corpo JSON.');
$img = (string) $in['image_base64'];
if (strlen($img) > 28 * 1024 * 1024) fail(413, 'Imagem muito grande.');
$imgMime = (substr($img, 0, 4) === '/9j/') ? 'image/jpeg'
         : ((substr($img, 0, 4) === 'iVBO') ? 'image/png'
         : ((substr($img, 0, 5) === 'UklGR') ? 'image/webp' : 'image/png'));

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

/* ---------- schema da leitura de esquadrias ---------- */
$schema = [
  'type' => 'object', 'additionalProperties' => false,
  'required' => ['found', 'items'],
  'properties' => [
    'found' => ['type' => 'boolean'],
    'items' => [
      'type' => 'array',
      'items' => [
        'type' => 'object', 'additionalProperties' => false,
        'required' => ['code', 'width', 'height', 'category', 'notes'],
        'properties' => [
          'code'     => ['type' => 'string'],   // MARCA como no desenho: W5, W6R, SF12, D1, 101A
          'width'    => ['type' => 'string'],    // LARGURA como cotada: 3'-6" (vazio se ilegível)
          'height'   => ['type' => 'string'],    // ALTURA como cotada: 5'-0"
          'category' => ['type' => 'string', 'enum' => ['window', 'door', 'storefront', 'other']],
          'notes'    => ['type' => 'string'],
        ],
      ],
    ],
  ],
];

$system = "Você lê WINDOW/DOOR SCHEDULES e ELEVAÇÕES de esquadrias de plantas de construção (EUA). "
        . "Para CADA janela/porta visível na imagem, extraia:\n"
        . "  • code: a MARCA exatamente como no desenho (ex.: 'W5', 'W6R', 'SF12', 'D1', '101A'). Mantenha letras/sufixos.\n"
        . "  • width: a LARGURA cotada, como aparece (ex.: \"3'-6\\\"\"). '' se não houver/ilegível.\n"
        . "  • height: a ALTURA cotada, como aparece (ex.: \"5'-0\\\"\"). '' se não houver/ilegível.\n"
        . "  • category: 'window' (janela), 'door' (porta), 'storefront' (fachada envidraçada) ou 'other'.\n"
        . "  • notes: detalhe útil (TEMP, combo, qtd) se houver.\n\n"
        . "Em ELEVAÇÕES: a largura costuma estar EM CIMA do desenho, a altura NO LADO e o código EMBAIXO. "
        . "Em TABELA (schedule): cada linha tem MARK | WIDTH | HEIGHT. Leia do jeito que estiver.\n\n"
        . "NÃO invente medidas nem códigos — só o que estiver LEGÍVEL na imagem. Se a cota estiver ilegível, "
        . "devolva o code com width/height ''. found=false e items=[] só se não houver nenhuma esquadria legível.";

$body = [
  'model'      => $model,
  'max_tokens' => 4000,
  'thinking'   => ['type' => 'adaptive'],
  'system'     => [['type' => 'text', 'text' => $system, 'cache_control' => ['type' => 'ephemeral']]],
  'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
  'messages' => [[
    'role' => 'user',
    'content' => [
      ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $imgMime, 'data' => $img]],
      ['type' => 'text', 'text' => 'Leia as esquadrias (janelas/portas) desta área: código, largura e altura.'],
    ],
  ]],
];

/* ---------- chamada à API ---------- */
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => ['content-type: application/json', 'x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'],
  CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
  CURLOPT_TIMEOUT        => 170,
]);
$resp = curl_exec($ch);
if ($resp === false) fail(502, 'Falha ao contatar a API: ' . curl_error($ch));
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($resp, true);
if ($status !== 200) fail(502, 'Erro da API Claude: ' . ($data['error']['message'] ?? ('HTTP ' . $status)));

$text = '';
foreach (($data['content'] ?? []) as $block) {
  if (($block['type'] ?? '') === 'text') { $text = (string) $block['text']; break; }
}
$parsed = json_decode($text, true);
if (!is_array($parsed)) fail(502, 'Resposta da IA não pôde ser interpretada como JSON.');

echo json_encode($parsed, JSON_UNESCAPED_UNICODE);
