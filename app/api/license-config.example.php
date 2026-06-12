<?php
/* =========================================================================
   Modelo de configuração do LICENCIAMENTO (M2PB).
   1) Copie para  license-config.php  (mesma pasta, api/)
   2) Preencha os dados do banco MySQL da Hostinger + um SEGREDO forte.
   license-config.php é ignorado pelo Git (.gitignore).
   ========================================================================= */

// ---- Banco MySQL (hPanel → Bancos de Dados MySQL) ----
define('LIC_DB_HOST', 'localhost');
define('LIC_DB_NAME', 'uXXXXXX_fenestra');
define('LIC_DB_USER', 'uXXXXXX_fenestra');
define('LIC_DB_PASS', 'senha-do-banco');

// ---- Segredo p/ assinar os tokens (HMAC). Gere algo longo e aleatório
//      (ex.: `php -r "echo bin2hex(random_bytes(32));"`). NUNCA exponha. ----
define('LIC_SECRET', 'troque-por-uma-string-longa-e-aleatoria-aqui');

// ---- Carência offline: dias que o app abre sem revalidar online ----
define('LIC_GRACE_DAYS', 7);

// ---- Senha do painel admin (api/license/admin.php) p/ emitir/revogar chaves ----
define('LIC_ADMIN_PASS', 'troque-esta-senha-admin');
