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

// ---- Stripe (https://dashboard.stripe.com/apikeys) ----
define('STRIPE_SECRET_KEY',   'sk_live_xxx');     // chave secreta
define('STRIPE_WEBHOOK_SECRET','whsec_xxx');      // segredo do endpoint de webhook
// Preços (Products → Prices) por plano. Crie no Stripe e cole os price_id:
define('STRIPE_PRICES', [
  'mensal' => 'price_xxx_mensal',
  'anual'  => 'price_xxx_anual',
]);
define('STRIPE_DEFAULT_DEVICES', 1);              // dispositivos por licença emitida pelo Stripe

// Preços de EXIBIÇÃO na landing, em DÓLAR (apenas visual — a cobrança real é o
// price do Stripe, que você cria em USD). Ajuste os valores.
define('PLAN_DISPLAY', [
  'mensal' => ['price' => '$19',  'period_pt' => '/mês', 'period_en' => '/mo', 'period_es' => '/mes'],
  'anual'  => ['price' => '$190', 'period_pt' => '/ano', 'period_en' => '/yr', 'period_es' => '/año'],
]);

// ---- Admin (M2PB) ----
define('ADMIN_EMAILS', ['voce@m2pb.com']);        // e-mails com acesso ao /admin
