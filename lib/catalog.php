<?php
/* =========================================================================
   catalog.php — CATÁLOGO DE PACOTES (não-secreto) no CÓDIGO.
   Preços/nomes/módulos dos pacotes vivem aqui, no repositório, pra o site
   mostrar e vender os pacotes SEM depender de editar o config.php.
   O config.php pode SOBRESCREVER (define DITE_PLAN_CATALOG / PORTAL_PACKAGES)
   — útil pra ajustar preço sem mexer no código. A chave do Dite (segredo)
   continua só no config.php.
   ========================================================================= */

/** Catálogo de planos (chave => name/amount/currency/interval/modules).
 *  'modules' = entitlements que a licença libera no app. */
function cc_plan_catalog(): array {
  $defaults = [
    // Janelas & Portas (compat: mensal/anual)
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
    // Add-on Relatórios (sempre à parte)
    'reports'    => ['name' => 'Relatórios — mensal', 'amount' => 15.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['reports']],
  ];
  $cfg = defined('DITE_PLAN_CATALOG') ? DITE_PLAN_CATALOG : [];
  return array_merge($defaults, $cfg);   // config sobrescreve chaves iguais; novas vêm do default
}

/** Pacotes exibidos na landing (cards de preço). */
function cc_portal_packages(): array {
  if (defined('PORTAL_PACKAGES')) return PORTAL_PACKAGES;
  return [
    ['plan' => 'parede',     'name' => 'Parede completa',  'price' => '$45', 'per' => '/mês', 'desc' => 'Framing + Drywall + Insulation + Paint — a parede inteira, com IA.', 'featured' => true],
    ['plan' => 'framing',    'name' => 'Framing',          'price' => '$15', 'per' => '/mês', 'desc' => 'Montantes, plates, track, vergas e sheathing.'],
    ['plan' => 'drywall',    'name' => 'Drywall',          'price' => '$15', 'per' => '/mês', 'desc' => 'Board comum e resistente à água, chapas 4x8.'],
    ['plan' => 'insulation', 'name' => 'Insulation',       'price' => '$12', 'per' => '/mês', 'desc' => 'Área de cavidade isolada por SF.'],
    ['plan' => 'paint',      'name' => 'Paint',            'price' => '$12', 'per' => '/mês', 'desc' => 'Pintura de parede por SF.'],
    ['plan' => 'mensal',     'name' => 'Janelas & Portas', 'price' => '$19', 'per' => '/mês', 'desc' => 'Esquadrias: leitura por IA, takeoff e documentos.'],
    ['plan' => 'reports',    'name' => 'Relatórios (add-on)', 'price' => '$15', 'per' => '/mês', 'desc' => 'Orçamento, materiais, planta marcada + editores + texto por IA. Liga em qualquer pacote.'],
  ];
}
