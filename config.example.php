<?php
/* =========================================================================
   Portal ConstructCount (M2PB) — configuração.
   Copie para config.php (mesma pasta) e preencha. config.php é gitignored.
   ========================================================================= */

// ---- URL pública do portal (domínio novo, COM https, SEM barra final) ----
define('PORTAL_URL', 'https://constructcount.com');

// ---- Banco MySQL (Hostinger) ----
define('DB_HOST', 'localhost');
define('DB_NAME', 'uXXXXXX_portal');
define('DB_USER', 'uXXXXXX_portal');
define('DB_PASS', 'senha-do-banco');

// ---- Segredos ----
define('APP_SECRET', 'troque-string-longa-aleatoria-para-sessao-e-csrf');   // sessão/CSRF
define('LIC_SECRET', 'troque-string-longa-aleatoria-para-tokens-de-licenca'); // HMAC dos tokens do app
define('LIC_GRACE_DAYS', 7);                                                  // carência offline do app

// ---- Dite Gateway (pay.diteads.com) — pagamento/assinatura ----
// Gere a API key e o webhook secret no painel "Apps" do Dite e configure lá o
// webhook_url = https://constructcount.com/webhooks/dite
define('DITE_BASE_URL', 'https://pay.diteads.com');
define('DITE_API_KEY', 'dg_live_xxx');            // X-Api-Key
define('DITE_WEBHOOK_SECRET', 'whsec_xxx');       // assina o webhook (HMAC sha256)

// CATÁLOGO DE PACOTES — fonte da verdade do NOSSO lado.
// O portal envia o plano INLINE pro Dite a cada checkout (forma recomendada na
// doc). Mudou preço/pacote aqui → vale no próximo checkout, sem criar plano no
// painel do Dite nem usar plan_id. interval = "month" | "year".
// 'modules' = quais PACOTES (trades) o plano libera. Hoje só Janelas e Portas.
define('DITE_PLAN_CATALOG', [
  // Janelas & Portas (compat: mensal/anual continuam apontando p/ este pacote)
  'mensal'     => ['name' => 'Janelas & Portas — mensal', 'amount' => 19.00,  'currency' => 'USD', 'interval' => 'month', 'modules' => ['windows_doors']],
  'anual'      => ['name' => 'Janelas & Portas — anual',  'amount' => 190.00, 'currency' => 'USD', 'interval' => 'year',  'modules' => ['windows_doors']],
  // Parede — ofícios à la carte
  'framing'    => ['name' => 'Framing — mensal',    'amount' => 15.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['framing']],
  'drywall'    => ['name' => 'Drywall — mensal',    'amount' => 15.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['drywall']],
  'insulation' => ['name' => 'Insulation — mensal', 'amount' => 12.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['insulation']],
  'paint'      => ['name' => 'Paint — mensal',      'amount' => 12.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['paint']],
  // Combo Parede completa (libera os 4 ofícios)
  'parede'     => ['name' => 'Parede completa — mensal', 'amount' => 45.00,  'currency' => 'USD', 'interval' => 'month', 'modules' => ['wall_combo', 'framing', 'drywall', 'insulation', 'paint']],
  'parede_ano' => ['name' => 'Parede completa — anual',  'amount' => 450.00, 'currency' => 'USD', 'interval' => 'year',  'modules' => ['wall_combo', 'framing', 'drywall', 'insulation', 'paint']],
  // Add-on: Relatórios (sempre à parte — libera os documentos + editores)
  'reports'    => ['name' => 'Relatórios — mensal', 'amount' => 15.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['reports']],
]);

// PACOTES exibidos na landing do portal (cards de preço). 'plan' aponta p/ uma
// chave do DITE_PLAN_CATALOG acima. 'featured' destaca o combo.
define('PORTAL_PACKAGES', [
  ['plan' => 'parede',     'name' => 'Parede completa',  'price' => '$45', 'per' => '/mês', 'desc' => 'Framing + Drywall + Insulation + Paint — a parede inteira, com IA.', 'featured' => true],
  ['plan' => 'framing',    'name' => 'Framing',          'price' => '$15', 'per' => '/mês', 'desc' => 'Montantes, plates, track, vergas e sheathing.'],
  ['plan' => 'drywall',    'name' => 'Drywall',          'price' => '$15', 'per' => '/mês', 'desc' => 'Board comum e resistente à água, chapas 4x8.'],
  ['plan' => 'insulation', 'name' => 'Insulation',       'price' => '$12', 'per' => '/mês', 'desc' => 'Área de cavidade isolada por SF.'],
  ['plan' => 'paint',      'name' => 'Paint',            'price' => '$12', 'per' => '/mês', 'desc' => 'Pintura de parede por SF.'],
  ['plan' => 'mensal',     'name' => 'Janelas & Portas', 'price' => '$19', 'per' => '/mês', 'desc' => 'Esquadrias: leitura por IA, takeoff e documentos.'],
  ['plan' => 'reports',    'name' => 'Relatórios (add-on)', 'price' => '$15', 'per' => '/mês', 'desc' => 'Orçamento, materiais, planta marcada + editores + texto por IA. Liga em qualquer pacote.'],
]);

// Catálogo de PACOTES (trades) p/ exibição. Nomes embutidos no license.php; este
// override é opcional. Chaves: windows_doors, framing, drywall_paint, plumbing,
// electrical, concrete, roof, ai. (Os módulos da licença podem virar coluna no
// banco depois — ver schema.sql; por ora são derivados do plano.)
// define('PACKAGES', [ 'windows_doors' => ['pt'=>'Janelas e Portas','en'=>'Windows & Doors','es'=>'Ventanas y Puertas'], ]);
// (alternativa/legado: referenciar planos cadastrados no painel por id)
// define('DITE_PLANS', ['mensal' => 1, 'anual' => 2]);

// (LEGADO/opcional — Stripe; não usado quando o Dite está configurado)
// define('STRIPE_SECRET_KEY', 'sk_live_xxx');
// define('STRIPE_WEBHOOK_SECRET', 'whsec_xxx');
// define('STRIPE_PRICES', ['mensal' => 'price_x', 'anual' => 'price_y']);
// define('STRIPE_DEFAULT_DEVICES', 1);

// Preços de EXIBIÇÃO na landing, em DÓLAR (apenas visual — a cobrança real é o
// price do Stripe, que você cria em USD). Ajuste os valores.
define('PLAN_DISPLAY', [
  'mensal' => ['price' => '$19',  'period_pt' => '/mês', 'period_en' => '/mo', 'period_es' => '/mes'],
  'anual'  => ['price' => '$190', 'period_pt' => '/ano', 'period_en' => '/yr', 'period_es' => '/año'],
]);

// ---- Download do app (instalador Windows) ----
// Recomendado: repo PÚBLICO só de releases no GitHub (código-fonte fica privado).
// Use /releases/latest/download/<asset> p/ apontar sempre pra última versão.
// Deixe '' para ocultar o botão de download no dashboard.
define('APP_DOWNLOAD_URL', 'https://github.com/petro20/constructcount-releases/releases/latest/download/ConstructCount-Setup.exe');

// ---- Admin (M2PB) ----
define('ADMIN_EMAILS', ['voce@m2pb.com']);        // e-mails com acesso ao /admin
