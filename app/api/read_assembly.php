<?php
/* =========================================================================
   read_assembly.php — IA lê o DETALHE DE TIPO DE PAREDE (wall type detail /
   partition schedule) de uma folha e devolve as ASSEMBLIES estruturadas
   (framing, plates, sheathing, insulation). Usado pelo pacote Framing.
   Mesma base do extract.php: chave no config.php, gate de licença, Claude.
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
if (!is_array($in) || empty($in['image_base64'])) fail(400, 'Envie image_base64 (PNG da folha) no corpo JSON.');
$img = (string) $in['image_base64'];
if (strlen($img) > 28 * 1024 * 1024) fail(413, 'Imagem muito grande.');
// detecta o tipo real pelo cabeçalho do base64 (front pode enviar PNG ou JPEG)
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

/* ---------- schema da assembly de parede ---------- */
$schema = [
  'type' => 'object', 'additionalProperties' => false,
  'required' => ['found', 'walls'],
  'properties' => [
    'found' => ['type' => 'boolean'],
    'walls' => [
      'type' => 'array',
      'items' => [
        'type' => 'object', 'additionalProperties' => false,
        'required' => ['type_id', 'name', 'material', 'stud_size', 'spacing_in', 'bottom_plates', 'top_plates', 'sheathing', 'sheathing_sides', 'insulation', 'components', 'notes'],
        'properties' => [
          'type_id'         => ['type' => 'string'],   // id do tipo no desenho: "1", "2A", "A", "B1" ("" se não houver)
          'components'      => ['type' => 'array', 'items' => ['type' => 'string']],   // TODAS as camadas/itens lidos (1 string por item)
          'name'            => ['type' => 'string'],   // ex.: "Interior Partition (Type 1)"
          'material'        => ['type' => 'string', 'enum' => ['wood', 'metal', 'both']],
          'stud_size'       => ['type' => 'string'],   // "2x4", "2x6", "3-5/8\" 20ga"
          'spacing_in'      => ['type' => 'number'],   // 16, 24
          'bottom_plates'   => ['type' => 'integer'],  // 1
          'top_plates'      => ['type' => 'integer'],  // 2 (double top plate)
          'sheathing'       => ['type' => 'string'],   // "5/8\" Type-X gypsum"
          'sheathing_sides' => ['type' => 'integer'],  // 0,1,2
          'insulation'      => ['type' => 'string'],   // "R-15 batts" ou ""
          'notes'           => ['type' => 'string'],
        ],
      ],
    ],
  ],
];

$system = "Você lê DETALHES DE TIPO DE PAREDE e notas de partição (wall type details, "
        . "partition schedules, framing notes) de plantas de construção (EUA). Extraia CADA tipo "
        . "de parede/assembly com sua composição.\n\n"
        . "ATENÇÃO: cada projeto desenha os tipos de um jeito — notas numeradas, detalhes de seção com "
        . "callouts e título embaixo ('A - WALL TYPE'), tabelas… Leia o formato que estiver na folha.\n\n"
        . "Para cada tipo retorne:\n"
        . "  • type_id: o id do tipo COMO ESTÁ NO DESENHO ('1', '2A', 'A', 'B1'); '' se não houver.\n"
        . "  • components: TODAS as camadas/itens da parede, 1 string por item, na ordem (ex.: '2x6 wood studs @ 16\\\" O.C.', '5/8\\\" Type-X gypsum ea. side', 'R-21 batt insulation', '3/4\\\" plywood sheathing', 'Tyvek wrap', 'vinyl siding'). NÃO invente: só o que estiver escrito.\n"
        . "  • name: identificação do tipo (ex.: 'Interior Partition', 'Type 1', 'Exterior Wall').\n"
        . "  • material: 'wood', 'metal' ou 'both' (se a nota disser 'wood or metal framing').\n"
        . "  • stud_size: bitola do montante como no desenho ('2x4', '2x6', '3-5/8\\\" 20ga').\n"
        . "  • spacing_in: espaçamento O.C. em POLEGADAS (ex.: 16, 24).\n"
        . "  • bottom_plates: nº de soleiras inferiores (normalmente 1).\n"
        . "  • top_plates: nº de plates superiores ('double top plate' = 2; 'single' = 1).\n"
        . "  • sheathing: fechamento/chapa como descrito ('5/8\\\" Type-X gypsum', 'OSB', '' se nenhum).\n"
        . "  • sheathing_sides: em quantos LADOS vai a chapa (0, 1 ou 2). 'both sides' = 2.\n"
        . "  • insulation: isolamento se houver ('R-15 batts'), senão ''.\n"
        . "  • notes: detalhes úteis (tape/spackle/paint, base, etc.).\n\n"
        . "Leia tanto o DESENHO do detalhe quanto a NOTA de texto associada (a nota costuma trazer "
        . "'single bottom plate, double top plate', '@ 16\\\" O.C.', 'both sides of 2x4', etc.). "
        . "Se a mesma parede admite wood OU metal, use material='both'. "
        . "found=false e walls=[] só se não houver nenhum tipo de parede legível.";

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
      ['type' => 'text', 'text' => 'Leia os tipos de parede (wall type details / partition schedule) desta folha.'],
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
