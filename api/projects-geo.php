<?php
/* api/projects-geo.php — pins do MAPA da landing (público): projetos abertos/em
   andamento com coordenadas, + estatísticas e contagem por disciplina. */
declare(strict_types=1);
require __DIR__ . '/../lib/db.php';
require __DIR__ . '/../lib/projects.php';
require_once __DIR__ . '/../lib/i18n.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=120');

$pins = [];
foreach (prj_geo_list() as $p) {
  $pins[] = [
    'id' => (int) $p['id'], 'title' => (string) $p['title'], 'region' => (string) $p['region'],
    'trades' => array_values(array_filter(explode(',', (string) $p['trades']))),
    'status' => (string) $p['status'], 'bids' => (int) $p['n_bids'],
    'lat' => (float) $p['lat'], 'lng' => (float) $p['lng'],
  ];
}
echo json_encode(['pins' => $pins, 'stats' => prj_stats(), 'trades' => prj_trade_counts()],
                 JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
