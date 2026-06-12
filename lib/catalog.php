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
    // Trial SEM cartão (licença de 7 dias emitida pelo portal em trial.php — amount 0 = não vai pro gateway)
    'parede_trial' => ['name' => 'Parede completa — teste 7 dias', 'amount' => 0, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['wall_combo', 'framing', 'drywall', 'insulation', 'paint']],
    // Add-on Relatórios (sempre à parte)
    'reports'    => ['name' => 'Relatórios — mensal', 'amount' => 15.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['reports']],
    // Pacote: Mural de projetos (dar preço nas obras publicadas no mural)
    'board'      => ['name' => 'Mural de projetos — mensal', 'amount' => 10.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['board']],
    // Add-on: Preços por região (IA busca tamanhos/preços de material na web p/ a região da obra)
    'region'     => ['name' => 'Preços por região — mensal', 'amount' => 10.00, 'currency' => 'USD', 'interval' => 'month', 'modules' => ['region']],
  ];
  $cfg = defined('DITE_PLAN_CATALOG') ? DITE_PLAN_CATALOG : [];
  return array_merge($defaults, $cfg);   // config sobrescreve chaves iguais; novas vêm do default
}

/** Pacotes exibidos na landing (cards de preço). Multilíngue: name/desc/per
 *  têm versões _en e _es; o index.php escolhe por idioma (fallback = pt). */
function cc_portal_packages(): array {
  if (defined('PORTAL_PACKAGES')) return PORTAL_PACKAGES;
  $pm = ['per' => '/mês', 'per_en' => '/mo', 'per_es' => '/mes'];
  return [
    ['plan' => 'parede', 'price' => '$45', 'featured' => true, 'trial' => true,
      'badge' => '🎁 7 dias grátis — sem cartão', 'badge_en' => '🎁 7 days free — no card', 'badge_es' => '🎁 7 días gratis — sin tarjeta',
      'name' => 'Parede completa', 'name_en' => 'Complete wall', 'name_es' => 'Pared completa',
      'desc' => 'Framing + Drywall + Insulation + Paint — a parede inteira, com IA.', 'desc_en' => 'Framing + Drywall + Insulation + Paint — the whole wall, with AI.', 'desc_es' => 'Framing + Drywall + Insulation + Paint — la pared entera, con IA.'] + $pm,
    ['plan' => 'framing', 'price' => '$15', 'name' => 'Framing',
      'desc' => 'Montantes, plates, track, vergas e sheathing.', 'desc_en' => 'Studs, plates, track, headers and sheathing.', 'desc_es' => 'Montantes, placas, riel, dinteles y sheathing.'] + $pm,
    ['plan' => 'drywall', 'price' => '$15', 'name' => 'Drywall',
      'desc' => 'Board comum e resistente à água, chapas 4x8.', 'desc_en' => 'Regular and water-resistant board, 4x8 sheets.', 'desc_es' => 'Placa común y resistente al agua, hojas 4x8.'] + $pm,
    ['plan' => 'insulation', 'price' => '$12', 'name' => 'Insulation',
      'desc' => 'Área de cavidade isolada por SF.', 'desc_en' => 'Insulated cavity area by SF.', 'desc_es' => 'Área de cavidad aislada por SF.'] + $pm,
    ['plan' => 'paint', 'price' => '$12', 'name' => 'Paint',
      'desc' => 'Pintura de parede por SF.', 'desc_en' => 'Wall paint by SF.', 'desc_es' => 'Pintura de pared por SF.'] + $pm,
    ['plan' => 'mensal', 'price' => '$19',
      'name' => 'Janelas & Portas', 'name_en' => 'Windows & Doors', 'name_es' => 'Ventanas y Puertas',
      'desc' => 'Esquadrias: leitura por IA, takeoff e documentos.', 'desc_en' => 'Windows & doors: AI reading, takeoff and documents.', 'desc_es' => 'Carpinterías: lectura por IA, cómputo y documentos.'] + $pm,
    ['plan' => 'reports', 'price' => '$15',
      'name' => 'Relatórios (add-on)', 'name_en' => 'Reports (add-on)', 'name_es' => 'Informes (add-on)',
      'desc' => 'Orçamento, materiais, planta marcada + editores + texto por IA. Liga em qualquer pacote.', 'desc_en' => 'Quote, materials, marked plan + editors + AI text. Add to any package.', 'desc_es' => 'Cotización, materiales, plano marcado + editores + texto por IA. En cualquier paquete.'] + $pm,
    ['plan' => 'board', 'price' => '$10',
      'name' => 'Mural de projetos', 'name_en' => 'Project board', 'name_es' => 'Mural de proyectos',
      'desc' => 'Dê preço nas obras publicadas: baixe a planta, levante no app e envie sua proposta.', 'desc_en' => 'Bid on posted jobs: download the plans, take off in the app and send your proposal.', 'desc_es' => 'Da precio a las obras publicadas: descarga el plano, computa en la app y envía tu propuesta.'] + $pm,
    ['plan' => 'region', 'price' => '$10',
      'name' => 'Preços por região (add-on)', 'name_en' => 'Regional pricing (add-on)', 'name_es' => 'Precios por región (add-on)',
      'desc' => 'A IA busca na web tamanhos e preços de material da região da obra — você confirma tudo. Liga em qualquer pacote.', 'desc_en' => 'AI fetches material sizes and prices online for the job\'s region — you confirm everything. Add to any package.', 'desc_es' => 'La IA busca en la web tamaños y precios de material de la región de la obra — tú confirmas todo. En cualquier paquete.'] + $pm,
  ];
}
