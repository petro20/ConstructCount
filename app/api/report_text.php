<?php
/* =========================================================================
   report_text.php — IA escreve SOMENTE o TEXTO da proposta (apresentação,
   escopo, condições, encerramento) do pacote Framing. Usa DeepSeek (API
   compatível com OpenAI). Os NÚMEROS (quantidades/preços) vêm do takeoff —
   a IA NÃO calcula nem inventa nada. Único uso de IA nos relatórios.
   Chave: DEEPSEEK_API_KEY no config.php (servidor). Gate de licença.
   ========================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
@set_time_limit(120);

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'Use POST.');

/* ---------- chave + modelo (config.php server-side) ---------- */
$cfg = __DIR__ . '/config.php';
if (is_file($cfg)) require $cfg;
$apiKey = getenv('DEEPSEEK_API_KEY') ?: (defined('DEEPSEEK_API_KEY') ? DEEPSEEK_API_KEY : '');
$base   = defined('DEEPSEEK_BASE_URL') ? DEEPSEEK_BASE_URL : 'https://api.deepseek.com';
$model  = defined('DEEPSEEK_MODEL') ? DEEPSEEK_MODEL : 'deepseek-chat';
if ($apiKey === '') fail(500, 'DEEPSEEK_API_KEY não configurada (api/config.php).');

/* ---------- entrada ---------- */
$raw = file_get_contents('php://input');
$in  = json_decode($raw ?: '', true);
if (!is_array($in)) fail(400, 'JSON inválido.');
$lang    = (string) ($in['lang'] ?? 'pt');
$company = trim((string) ($in['company'] ?? ''));
$client  = trim((string) ($in['client'] ?? ''));
$project = trim((string) ($in['project'] ?? ''));
$region  = trim((string) ($in['region'] ?? ''));
$scopes  = is_array($in['scopes'] ?? null) ? $in['scopes'] : [];
$types   = is_array($in['types'] ?? null) ? array_slice($in['types'], 0, 40) : [];
$totals  = is_array($in['totals'] ?? null) ? $in['totals'] : [];

/* ---------- gate de licença ---------- */
$licUrl = defined('CONSTRUCTCOUNT_LICENSE_VALIDATE_URL') ? CONSTRUCTCOUNT_LICENSE_VALIDATE_URL
        : (defined('FENESTRA_LICENSE_VALIDATE_URL') ? FENESTRA_LICENSE_VALIDATE_URL : '');
if ($licUrl) {
  $ch = curl_init($licUrl);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 12, CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['key' => (string) ($in['license_key'] ?? ''), 'device' => (string) ($in['device'] ?? ''), 'device_label' => (string) ($in['device_label'] ?? '')])]);
  $resp = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  if ($resp === false || $code === 0) fail(503, 'Servidor de licença indisponível.');
  $lic = json_decode($resp, true);
  if (!is_array($lic) || empty($lic['valid'])) fail(402, 'Licença inválida.');
}

/* ---------- contexto (números são SÓ contexto; a IA não recalcula) ---------- */
$ctx = "Idioma de saída: {$lang}\n";
if ($company) $ctx .= "Empresa: {$company}\n";
if ($client)  $ctx .= "Cliente: {$client}\n";
if ($project) $ctx .= "Obra: {$project}\n";
if ($region)  $ctx .= "Região: {$region}\n";
if ($scopes)  $ctx .= 'Ofícios no escopo: ' . implode(', ', array_map('strval', $scopes)) . "\n";
$ctx .= 'Resumo: ' . (isset($totals['lf']) ? (round((float) $totals['lf']) . ' LF de parede') : '') . (isset($totals['sf']) ? (', ' . round((float) $totals['sf']) . ' SF') : '') . ".\n";
if ($types) { $ctx .= "Tipos de parede:\n"; foreach ($types as $t) { if (!is_array($t)) continue; $ctx .= '- ' . (string) ($t['name'] ?? '') . "\n"; } }

$system = "Você é redator técnico-comercial de uma empresa de construção (light-gauge/wood framing, drywall, insulation e pintura) nos EUA. "
        . "Escreva APENAS o TEXTO de uma proposta profissional, no idioma pedido, com tom claro e confiável. "
        . "REGRAS CRÍTICAS: NÃO invente nem calcule quantidades, medidas ou preços — esses valores já estão na TABELA do orçamento e NÃO devem aparecer no seu texto (a não ser, se útil, o resumo geral fornecido). "
        . "Descreva o escopo de trabalho com base nos ofícios e tipos de parede informados. "
        . "Responda SOMENTE com um JSON válido (sem markdown): {\"apresentacao\":\"...\",\"escopo\":\"...\",\"condicoes\":\"...\",\"encerramento\":\"...\"}. "
        . "apresentacao = abertura/carta curta; escopo = o que será executado (parágrafo ou bullets em texto); condicoes = condições comerciais sugeridas (pagamento, prazo, validade, garantia) em tom de sugestão; encerramento = fechamento cordial.";

$body = ['model' => $model, 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $ctx]],
  'response_format' => ['type' => 'json_object'], 'temperature' => 0.5, 'max_tokens' => 1400];

$ch = curl_init(rtrim($base, '/') . '/chat/completions');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['content-type: application/json', 'authorization: Bearer ' . $apiKey],
  CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT => 110]);
$resp = curl_exec($ch);
if ($resp === false) fail(502, 'Falha ao contatar o DeepSeek: ' . curl_error($ch));
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$data = json_decode($resp, true);
if ($status !== 200) fail(502, 'Erro do DeepSeek: ' . ($data['error']['message'] ?? ('HTTP ' . $status)));
$text = (string) ($data['choices'][0]['message']['content'] ?? '');
if (preg_match('/\{.*\}/s', $text, $mm)) $text = $mm[0];
$parsed = json_decode($text, true);
if (!is_array($parsed)) fail(502, 'Resposta da IA não pôde ser interpretada.');
echo json_encode($parsed, JSON_UNESCAPED_UNICODE);
