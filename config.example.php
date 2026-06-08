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
// plan_id de cada plano (criados no painel do Dite):
define('DITE_PLANS', [
  'mensal' => 1,
  'anual'  => 2,
]);

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

// ---- Admin (M2PB) ----
define('ADMIN_EMAILS', ['voce@m2pb.com']);        // e-mails com acesso ao /admin
