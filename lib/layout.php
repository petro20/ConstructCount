<?php
declare(strict_types=1);
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/auth.php';

function layout_top(string $title): void {
  $u = current_user();
  $L = lang();
  echo '<!doctype html><html lang="' . h($L) . '"><head><meta charset="utf-8">';
  echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
  echo '<title>' . h($title) . ' · ConstructCount</title>';
  echo '<link rel="icon" href="assets/favicon.ico"><link rel="stylesheet" href="assets/style.css?v=3"></head><body>';
  echo '<header class="nav"><a class="brand" href="' . h(url('')) . '"><img class="brand-logo" src="assets/logo.png" alt="ConstructCount"><span class="brand-name">ConstructCount</span></a>';
  echo '<nav>';
  $here = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
  $sep = (strpos($here, '?') !== false) ? '&' : '?';
  foreach (['en' => 'EN', 'es' => 'ES', 'pt' => 'PT'] as $code => $lbl) {
    $cls = $code === $L ? 'lg on' : 'lg';
    echo '<a class="' . $cls . '" href="' . h($here . $sep . 'lang=' . $code) . '">' . $lbl . '</a>';
  }
  if ($u) {
    echo '<a class="btn ghost" href="' . h(url('dashboard.php')) . '">' . h(t('dashboard')) . '</a>';
    echo '<a class="btn ghost" href="' . h(url('logout.php')) . '">' . h(t('logout')) . '</a>';
  } else {
    echo '<a class="btn ghost" href="' . h(url('login.php')) . '">' . h(t('login')) . '</a>';
    echo '<a class="btn" href="' . h(url('register.php')) . '">' . h(t('register')) . '</a>';
  }
  echo '</nav></header><main>';
  if ($f = flash()) echo '<div class="flash">' . h($f) . '</div>';
}

function layout_bottom(): void {
  echo '</main><footer>© 2026 ConstructCount · <a href="https://m2pb.com" target="_blank">M2PB</a></footer></body></html>';
}
