<?php
/* =========================================================================
   Modelo de configuração do backend.
   1) Copie este arquivo para  config.php  (mesma pasta)
   2) Cole sua chave da Anthropic
   config.php é ignorado pelo Git (.gitignore) para sua chave não vazar.
   ========================================================================= */

// Sua chave da API Anthropic (https://console.anthropic.com/ → API Keys)
define('ANTHROPIC_API_KEY', 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

// Modelo. Padrão: Opus 4.8 (mais preciso para ler plantas).
// Alternativa mais barata/rápida: 'claude-sonnet-4-6'
define('CONSTRUCTCOUNT_MODEL', 'claude-opus-4-8');

// Arredondamento das medidas de fabricação (mm). 1 = mm exato (sem arredondar).
// Ex.: 5 arredonda para o múltiplo de 5mm mais próximo conforme a tolerância da fábrica.
define('CONSTRUCTCOUNT_ROUND_MM', 1);

// (Opcional) Licenciamento: se definido, a IA só roda com licença válida —
// valida no PORTAL da M2PB. Deixe comentado p/ não exigir licença na IA.
// define('CONSTRUCTCOUNT_LICENSE_VALIDATE_URL', 'https://constructcount.com/api/validate.php');
