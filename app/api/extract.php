<?php
/* =========================================================================
   extract.php — extração real de esquadrias do PDF via Claude API (visão)
   Sem dependências: usa cURL nativo do PHP (ideal p/ Hostinger / shared host).
   A chave da API fica no servidor (config.php), nunca no frontend.

   Existe um SDK PHP oficial (anthropic-ai/sdk via Composer); evitamos o
   Composer aqui para manter o deploy trivial em hospedagem compartilhada.
   ========================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
@set_time_limit(300);

function fail(int $code, string $msg): void {
  http_response_code($code);
  echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Converte uma medida (texto, como no projeto) para milímetros (float).
 * Suporta: pés/polegadas com fração (3'-6 1/2", 3' 6", 4'-0", 3.5'),
 * polegadas (42", 42 1/2"), e métrico (1200 mm, 120 cm, 1.2 m).
 * Retorna null se não conseguir interpretar.
 */
function parseToMm(string $s): ?float {
  $s = trim($s);
  if ($s === '') return null;
  // normaliza aspas “inteligentes” para ' e "
  $s = str_replace(['″', '“', '”'], '"', $s);
  $s = str_replace(['′', '’', '‘'], "'", $s);
  $low = strtolower($s);

  // ----- métrico explícito -----
  if (preg_match('/([\d.]+)\s*mm\b/', $low, $m)) return (float) $m[1];
  if (preg_match('/([\d.]+)\s*cm\b/', $low, $m)) return (float) $m[1] * 10;
  if (preg_match('/([\d.]+)\s*m\b/',  $low, $m)) return (float) $m[1] * 1000;

  // ----- imperial: pés (com polegadas/fração opcionais) -----
  if (strpos($s, "'") !== false && preg_match('/(\d+(?:\.\d+)?)\s*\'/', $s, $f)) {
    $feet = (float) $f[1];
    $inch = 0.0;
    $after = substr($s, strpos($s, "'") + 1);          // o que vem após os pés
    if (preg_match('/(\d+)\s+(\d+)\/(\d+)/', $after, $fr)) {
      $inch = (float) $fr[1] + (float) $fr[2] / (float) $fr[3];   // 6 1/2
    } elseif (preg_match('/(\d+)\/(\d+)/', $after, $fr)) {
      $inch = (float) $fr[1] / (float) $fr[2];                    // 1/2
    } elseif (preg_match('/(\d+(?:\.\d+)?)/', $after, $fr)) {
      $inch = (float) $fr[1];                                     // 6
    }
    return $feet * 304.8 + $inch * 25.4;
  }

  // ----- imperial: só polegadas -----
  if (preg_match('/(\d+)\s+(\d+)\/(\d+)\s*"/', $s, $fr)) {
    return ((float) $fr[1] + (float) $fr[2] / (float) $fr[3]) * 25.4;   // 42 1/2"
  }
  if (preg_match('/(\d+(?:\.\d+)?)\s*"/', $s, $fr))   return (float) $fr[1] * 25.4;
  if (preg_match('/(\d+(?:\.\d+)?)\s*in\b/', $low, $fr)) return (float) $fr[1] * 25.4;

  return null;
}

/** Arredonda para o múltiplo de fabricação (mm). */
function roundMfg(float $mm, int $multiple): int {
  $multiple = max(1, $multiple);
  return (int) (round($mm / $multiple) * $multiple);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'Use POST.');

/* ---------- chave da API + modelo ---------- */
$cfg = __DIR__ . '/config.php';
if (is_file($cfg)) require $cfg;
$apiKey = getenv('ANTHROPIC_API_KEY') ?: (defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '');
$model  = defined('CONSTRUCTCOUNT_MODEL') ? CONSTRUCTCOUNT_MODEL : (defined('FENESTRA_MODEL') ? FENESTRA_MODEL : 'claude-opus-4-8');
if ($apiKey === '') fail(500, 'API key não configurada. Crie api/config.php (veja config.example.php).');

/* ---------- entrada ---------- */
$raw = file_get_contents('php://input');
$in  = json_decode($raw ?: '', true);
if (!is_array($in) || empty($in['pdf_base64'])) fail(400, 'Envie pdf_base64 no corpo JSON.');

/* ---------- GATE de licença (a IA só roda com licença válida) ----------
   Valida no PORTAL (M2PB) por HTTP. Só exige se FENESTRA_LICENSE_VALIDATE_URL
   estiver definido no config.php (ex.: https://constructcount.com/api/validate.php). */
$licUrl = defined('CONSTRUCTCOUNT_LICENSE_VALIDATE_URL') ? CONSTRUCTCOUNT_LICENSE_VALIDATE_URL
        : (defined('FENESTRA_LICENSE_VALIDATE_URL') ? FENESTRA_LICENSE_VALIDATE_URL : '');
if ($licUrl) {
  $lk  = (string) ($in['license_key'] ?? '');
  $dev = (string) ($in['device'] ?? '');
  $ch = curl_init($licUrl);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 12,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['key' => $lk, 'device' => $dev, 'device_label' => (string) ($in['device_label'] ?? '')]),
  ]);
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($resp === false || $code === 0) fail(503, 'Servidor de licença indisponível.');
  $lic = json_decode($resp, true);
  if (!is_array($lic) || empty($lic['valid'])) fail(402, 'Licença inválida: ' . (is_array($lic) ? ($lic['reason'] ?? 'não autorizada') : 'não autorizada'));
}
$pdf = (string) $in['pdf_base64'];
if (strlen($pdf) > 32 * 1024 * 1024) fail(413, 'PDF muito grande (limite ~24MB / ~100 páginas).');

/* ---------- schema da saída estruturada ----------
   type é restrito aos 7 tipos que o app sabe desenhar (svg-engine.js). */
$schema = [
  'type' => 'object',
  'additionalProperties' => false,
  'required' => ['found', 'project_name', 'items'],
  'properties' => [
    'found'        => ['type' => 'boolean'],
    'project_name' => ['type' => 'string'],
    'items' => [
      'type' => 'array',
      'items' => [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['id', 'type', 'location', 'seen_in', 'discrepancy', 'placements', 'width_orig', 'height_orig', 'width_mm', 'height_mm', 'qty', 'glass', 'color', 'notes'],
        'properties' => [
          'id'     => ['type' => 'string'],
          'type'   => ['type' => 'string', 'enum' => [
            'Casement Window', 'Double Casement', 'Sliding Window', 'Awning Window',
            'Fixed Window', 'Single Door', 'Sliding Door', 'Storefront',
          ]],
          'location' => ['type' => 'string', 'enum' => ['facade', 'interior']],
          'seen_in'  => [
            'type' => 'array',
            'items' => ['type' => 'string', 'enum' => ['plan', 'elevation', 'schedule']],
          ],
          'discrepancy' => ['type' => 'string'],   // divergência planta×fachada ('' se consistente)
          'placements' => [                          // posição de cada marca na planta (p/ sobrepor no PDF)
            'type' => 'array',
            'items' => [
              'type' => 'object',
              'additionalProperties' => false,
              'required' => ['page', 'x', 'y'],
              'properties' => [
                'page' => ['type' => 'integer'],     // página do PDF (base 1)
                'x'    => ['type' => 'number'],       // 0..1 da largura (0=esq, 1=dir)
                'y'    => ['type' => 'number'],       // 0..1 da altura (0=topo, 1=base)
              ],
            ],
          ],
          'width_orig'  => ['type' => 'string'],   // medida como no projeto (c/ unidade)
          'height_orig' => ['type' => 'string'],
          'width_mm'    => ['type' => 'integer'],   // conversão da IA (fallback)
          'height_mm'   => ['type' => 'integer'],
          'qty'    => ['type' => 'integer'],
          'glass'  => ['type' => 'string'],
          'color'  => ['type' => 'string'],
          'notes'  => ['type' => 'string'],
        ],
      ],
    ],
  ],
];

$system = "Você é um especialista em ler plantas arquitetônicas e quadros de esquadrias "
        . "(window/door/storefront schedules). Extraia as esquadrias da FACHADA (envelope externo "
        . "do edifício). Para cada item: id (ex.: W01, D01, SF01), type (mapeie para o tipo mais "
        . "próximo da lista permitida), quantidade, tipo de vidro, cor do perfil e observações.\n\n"
        . "ESCOPO — FACHADA APENAS (CRÍTICO):\n"
        . "  • INCLUA: janelas externas; portas DA FACHADA (entrada principal, portas de "
        . "varanda/balcão/pátio, portas externas); STORE FRONTS / fachadas envidraçadas "
        . "(sinônimos: storefront, store front, shopfront, curtain wall, vitrine, fachada de vidro) "
        . "→ use type=\"Storefront\".\n"
        . "  • NÃO INCLUA portas INTERNAS (entre cômodos, divisórias, closets, banheiros internos).\n"
        . "  • Classifique cada item no campo location: \"facade\" (no envelope externo) ou "
        . "\"interior\" (interna). Na dúvida sobre uma porta, marque \"interior\". "
        . "Janelas e storefronts são sempre \"facade\".\n\n"
        . "MEDIDAS — MUITO IMPORTANTE. Para largura e altura, retorne DOIS campos cada:\n"
        . "  • width_orig / height_orig: a medida EXATAMENTE como aparece no projeto, INCLUINDO a "
        . "unidade. Ex.: \"3'-6\\\"\", \"4'-0\\\"\", \"2'-8 1/2\\\"\", \"42\\\"\", \"1200 mm\". "
        . "Preserve o formato pés-polegadas (feet-inches), comum em projetos dos EUA.\n"
        . "  • width_mm / height_mm: a sua melhor conversão dessa medida para MILÍMETROS inteiros "
        . "(1 pé = 304,8 mm; 1 pol = 25,4 mm; 1 m = 1000 mm; 1 cm = 10 mm). "
        . "O sistema reconverte a partir de *_orig, então capriche no width_orig/height_orig.\n\n"
        . "MÉTODO DE LEVANTAMENTO (siga exatamente):\n"
        . "  1) QUANTIDADE: conte as MARCAS de esquadria na PLANTA BAIXA. Cada marca posicionada na "
        . "planta (ex.: W01, D02) é uma unidade; some as repetições da MESMA marca → esse total é o qty.\n"
        . "  2) DIMENSÕES e TIPO: extraia da prancha/QUADRO DE TIPOS de esquadrias (a que mostra cada "
        . "tipo com suas dimensões). É dali que saem width_orig/height_orig e o type de cada marca.\n"
        . "  3) Vincule cada marca da planta à sua definição no quadro de tipos pelo MESMO id.\n"
        . "  4) COORDENADAS: em placements, liste CADA ocorrência da marca na PLANTA com: page "
        . "(página do PDF, base 1), x e y como FRAÇÕES de 0 a 1 (x=0 borda esquerda, 1 direita; "
        . "y=0 topo, 1 base) na posição do CENTRO da janela. O número de placements deve ser igual ao qty.\n\n"
        . "CONFERÊNCIA (preencha seen_in e discrepancy):\n"
        . "  • seen_in: liste onde a marca aparece — \"plan\" (marca na planta baixa), \"schedule\" "
        . "(definida no quadro de tipos), \"elevation\" (desenhada na fachada/elevação).\n"
        . "  • discrepancy: descreva qualquer divergência, p.ex.: \"Marca na planta sem definição no "
        . "quadro de tipos\"; \"Tipo no quadro sem marca na planta\"; \"Largura diverge: tipo 3'-0\\\" x "
        . "fachada 2'-10\\\"\"; \"Quantidade diverge: 3 marcas na planta x quadro indica 2\". "
        . "Se tudo consistente, discrepancy = \"\" (string vazia). Cheque medida, tipo e quantidade.\n\n"
        . "Se vidro/cor não constarem, use um padrão razoável. Defina found=false e items=[] "
        . "apenas se não houver nenhuma esquadria identificável.";

$body = [
  'model'      => $model,
  'max_tokens' => 16000,
  'thinking'   => ['type' => 'adaptive'],
  'system'     => [[
    'type' => 'text',
    'text' => $system,
    'cache_control' => ['type' => 'ephemeral'],
  ]],
  'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
  'messages' => [[
    'role' => 'user',
    'content' => [
      ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $pdf]],
      ['type' => 'text', 'text' => 'Extraia o quadro de esquadrias deste projeto.'],
    ],
  ]],
];

/* ---------- chamada à API ---------- */
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => [
    'content-type: application/json',
    'x-api-key: ' . $apiKey,
    'anthropic-version: 2023-06-01',
  ],
  CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
  CURLOPT_TIMEOUT    => 280,
]);
$resp = curl_exec($ch);
if ($resp === false) fail(502, 'Falha ao contatar a API: ' . curl_error($ch));
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($resp, true);
if ($status !== 200) {
  $m = $data['error']['message'] ?? ('HTTP ' . $status);
  fail(502, 'Erro da API Claude: ' . $m);
}

/* primeiro bloco de texto (vem depois dos blocos de thinking) */
$text = '';
foreach (($data['content'] ?? []) as $block) {
  if (($block['type'] ?? '') === 'text') { $text = (string) $block['text']; break; }
}
$parsed = json_decode($text, true);
if (!is_array($parsed)) fail(502, 'Resposta da IA não pôde ser interpretada como JSON.');

/* ---------- fachada-only + conversão GARANTIDA no código ---------- */
$roundMm = defined('CONSTRUCTCOUNT_ROUND_MM') ? (int) CONSTRUCTCOUNT_ROUND_MM : (defined('FENESTRA_ROUND_MM') ? (int) FENESTRA_ROUND_MM : 1);   // múltiplo de fabricação
$kept = [];
$excludedInterior = 0;
foreach (($parsed['items'] ?? []) as $it) {
  $type = (string) ($it['type'] ?? '');
  $loc  = (string) ($it['location'] ?? 'facade');
  $isDoor = (bool) preg_match('/door|porta/i', $type);

  // descarta APENAS portas internas; janelas/storefronts/portas de fachada ficam
  if ($isDoor && $loc === 'interior') { $excludedInterior++; continue; }

  $wMm = parseToMm((string) ($it['width_orig']  ?? '')) ?? (float) ($it['width_mm']  ?? 0);
  $hMm = parseToMm((string) ($it['height_orig'] ?? '')) ?? (float) ($it['height_mm'] ?? 0);
  $it['width']  = roundMfg($wMm, $roundMm);
  $it['height'] = roundMfg($hMm, $roundMm);
  unset($it['width_mm'], $it['height_mm'], $it['location']);   // limpa campos internos
  $kept[] = $it;
}
$parsed['items'] = array_values($kept);
$parsed['excluded_interior'] = $excludedInterior;   // informativo (portas internas descartadas)

echo json_encode($parsed, JSON_UNESCAPED_UNICODE);
