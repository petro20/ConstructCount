/* =========================================================================
   license.js — BLOQUEIO TOTAL por licença (M2PB), com carência offline.
   Desktop: usa a ponte pywebview (window.pywebview.api.license_*).
   Web: valida via /api/license/validate.php (device = UUID no navegador).

   >>> INTERRUPTOR <<<  LICENSING = false  → não exige licença (estado atual,
   p/ não travar dev/usuários antes do servidor existir). Quando a M2PB subir
   o banco + license-config.php na Hostinger e emitir as chaves, troque para
   true e suba o ?v dos assets.
   ========================================================================= */
(function () {
  'use strict';
  var LICENSING = true;                        // LIGADO — portal no ar (constructcount.com)

  var F = window.ConstructCount = window.ConstructCount || {};
  // Domínio do PORTAL de licenças (M2PB). Deixe '' se o site estiver no MESMO
  // domínio do portal; senão a URL completa (ex.: 'https://constructcount.com').
  var PORTAL = 'https://constructcount.com';
  var VURL = PORTAL + '/api/validate.php';
  var started = false;

  var isDesktop = function () { return !!(window.pywebview && window.pywebview.api && window.pywebview.api.license_status); };
  var tr = function (s, v) { return (F.tr ? F.tr(s, v) : s); };

  /* ---- WEB: device + chave + token no navegador ---- */
  function webDevice() {
    var d = localStorage.getItem('fenestra_device');
    if (!d) { d = 'web-' + ((crypto && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now())); localStorage.setItem('fenestra_device', d); }
    return d;
  }
  function webKey() { return localStorage.getItem('fenestra_license_key') || ''; }
  function payload(tok) {
    try { var p = tok.split('.')[0]; p += '='.repeat((4 - p.length % 4) % 4); return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; }
  }
  async function validateWeb(key) {
    try {
      var r = await fetch(VURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key, device: webDevice(), device_label: 'web' }) });
      return await r.json();
    } catch (e) { return null; }
  }
  async function statusWeb() {
    var key = webKey(); if (!key) return { state: 'none' };
    var r = await validateWeb(key);
    if (r === null) {                          // offline → carência pelo token
      var pay = payload(localStorage.getItem('fenestra_license_token') || ''); var now = Date.now() / 1000;
      if (pay && pay.grace_exp > now && pay.sub_exp > now) return { state: 'grace', grace_days_left: Math.max(0, Math.floor((pay.grace_exp - now) / 86400)) };
      return { state: 'invalid', reason: tr('sem conexão e carência expirada') };
    }
    if (r.valid) { localStorage.setItem('fenestra_license_token', r.token || ''); if (Array.isArray(r.modules)) F.entitlements = r.modules; return { state: 'valid', plan: r.plan, expires_at: r.expires_at }; }
    return { state: 'invalid', reason: r.reason };
  }
  async function activateWeb(key) {
    var r = await validateWeb(key);
    if (r === null) return { state: 'invalid', reason: tr('sem conexão com o servidor de licença') };
    if (!r.valid) return { state: 'invalid', reason: r.reason };
    localStorage.setItem('fenestra_license_key', key); localStorage.setItem('fenestra_license_token', r.token || ''); if (Array.isArray(r.modules)) F.entitlements = r.modules;
    return { state: 'valid', plan: r.plan, expires_at: r.expires_at };
  }

  /* ---- API unificada ---- */
  async function getStatus() { return isDesktop() ? await window.pywebview.api.license_status() : await statusWeb(); }
  async function doActivate(key) { return isDesktop() ? await window.pywebview.api.license_activate(key) : await activateWeb(key); }

  /** chave+device p/ anexar nas chamadas de IA (extract.php). */
  F.licenseInfo = function () {
    if (!LICENSING) return { key: '', device: '' };
    return isDesktop() ? (F._licInfo || { key: '', device: '' }) : { key: webKey(), device: webDevice() };
  };

  /* ---- PACOTES (entitlements) — cada ofício é vendido SEPARADO ----
     F.entitlements = array de ids comprados (ex.: ['framing'] ou ['all']).
     null/[] = ainda sem info → LIBERA tudo (não trava dev nem usuários antes
     do servidor M2PB emitir a lista de pacotes no token). */
  F.entitlements = null;
  function setEntFromToken() {
    var pay = payload(localStorage.getItem('fenestra_license_token') || '');
    if (pay && Array.isArray(pay.modules)) F.entitlements = pay.modules;        // portal assina 'modules'
    else if (pay && Array.isArray(pay.pkgs)) F.entitlements = pay.pkgs;
  }
  var WALL_TRADES = ['framing', 'drywall', 'insulation', 'paint'];   // ofícios da parede (combo = wall_combo)
  F.hasPackage = function (id) {
    if (!LICENSING) return true;
    var e = F.entitlements;
    if (e == null) return true;                       // AINDA não carregou (dev/loading) → libera; lista conhecida (mesmo vazia) → trava: NADA grátis
    if (e.indexOf('all') >= 0) return true;
    if (id === 'wall') return e.indexOf('wall_combo') >= 0 || WALL_TRADES.some(function (t) { return e.indexOf(t) >= 0; });   // qualquer ofício de parede
    if (WALL_TRADES.indexOf(id) >= 0 && e.indexOf('wall_combo') >= 0) return true;   // combo libera os 4 ofícios
    if (id === 'board') return e.some(function (m) { return m === 'board' || String(m).indexOf('board:') === 0; });   // mural por REGIÃO (board:UF; 'board' legado = todas)
    return e.indexOf(id) >= 0;
  };
  // Regiões (UFs) do Mural na licença: ['*'] = todas (board legado/all); [] = nenhuma
  F.boardRegions = function () {
    var e = F.entitlements;
    if (e == null || e.indexOf('all') >= 0 || e.indexOf('board') >= 0) return ['*'];
    var out = [];
    e.forEach(function (m) { if (String(m).indexOf('board:') === 0) out.push(String(m).slice(6).toUpperCase()); });
    return out;
  };
  function ownsAny(csv) { return String(csv || '').split(',').some(function (p) { p = p.trim(); return p && F.hasPackage(p); }); }
  function applyPackageGates() {
    // data-pkg  → ESCONDE quando sem direito (vitrines/landing, itens que somem)
    var nodes = document.querySelectorAll('[data-pkg]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('pkg-locked', !F.hasPackage(nodes[i].getAttribute('data-pkg')));
    }
    // data-lock → MOSTRA porém INERTE (sem ação) quando sem ativação (ferramenta de disciplina = vitrine)
    var lk = document.querySelectorAll('[data-lock]');
    for (var j = 0; j < lk.length; j++) {
      var on = ownsAny(lk[j].getAttribute('data-lock'));
      lk[j].classList.toggle('pkg-inert', !on);
      lk[j].setAttribute('aria-disabled', on ? 'false' : 'true');
    }
    if (F._renderFramingCard) { try { F._renderFramingCard(); } catch (e) {} }
  }
  F.applyPackageGates = applyPackageGates;
  F.setPackages = function (arr) { F.entitlements = Array.isArray(arr) ? arr : null; applyPackageGates(); };

  /* ---- UPGRADE: clicar numa ferramenta travada leva à compra do pacote pertinente ---- */
  var PLAN_MAP = { wall: 'parede', windows_doors: 'mensal' };   // id do pacote -> plano do checkout (combo=parede, janelas=mensal)
  function checkoutUrl(plan) { return PORTAL + '/checkout.php?plan=' + encodeURIComponent(PLAN_MAP[plan] || plan); }
  F.upgradePackage = function (lockCsv) {
    F._pendingUpgrade = true;   // ao voltar o foco, re-checa a licença → destrava se comprou
    var ids = String(lockCsv || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (ids.length === 1) { try { window.open(checkoutUrl(ids[0]), '_blank'); } catch (e) {} return; }   // pacote único → checkout direto
    if (F.openPackageTab) return F.openPackageTab();                                                       // ambíguo (ex.: Piso/Forro) → aba Pacote p/ escolher
    if (ids[0]) { try { window.open(checkoutUrl(ids[0]), '_blank'); } catch (e) {} }
  };
  // re-valida no servidor e re-aplica os gates SEM popar overlay (usado ao voltar da compra)
  F.refreshEntitlements = async function () {
    try { await getStatus(); } catch (e) {}     // força revalidação online (web atualiza token; desktop revalida o cache)
    try { await refreshInfo(); } catch (e) {}   // lê os modules atualizados (desktop: license_info; web: token)
    applyPackageGates();
  };
  // ao voltar o foco pro app (ex.: terminou a compra no navegador) → atualiza os pacotes
  var lastChk = 0;
  function onReturn() {
    var pend = F._pendingUpgrade;
    var now = Date.now();
    if (!pend && now - lastChk < 20000) return;   // throttle p/ retornos comuns; compra força a checagem
    lastChk = now; F._pendingUpgrade = false;
    Promise.resolve(F.refreshEntitlements()).then(function () {
      if (pend && F.flashExport) F.flashExport('✓ ' + tr('Pacotes atualizados'));
    });
  }
  window.addEventListener('focus', onReturn);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) onReturn(); });
  // intercepta o clique no item INERTE (captura) ANTES do handler da ferramenta → abre upgrade, ferramenta não age
  document.addEventListener('click', function (e) {
    var t = e.target, el2 = (t && t.closest) ? t.closest('.pkg-inert') : null;
    if (!el2) return;
    e.preventDefault(); e.stopImmediatePropagation();
    F.upgradePackage(el2.getAttribute('data-lock'));
  }, true);

  /* ---- Overlay de bloqueio / ativação ---- */
  function el() {
    var o = document.getElementById('licGate');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'licGate';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.96);color:#e5edf6;font:14px Inter,system-ui,Arial;backdrop-filter:blur(2px)';
    o.innerHTML =
      '<div style="max-width:440px;width:90%;background:#0b1220;border:1px solid #1e293b;border-radius:16px;padding:26px 24px;box-shadow:0 18px 60px rgba(0,0,0,.5);text-align:center">'
      + '<img src="assets/logo.png?v=4" alt="ConstructCount" style="height:64px;margin:0 auto 12px;display:block">'
      + '<div id="licTitle" style="font-size:17px;font-weight:700;margin-bottom:4px"></div>'
      + '<div id="licMsg" style="color:#94a3b8;margin-bottom:16px;font-size:13px;line-height:1.5"></div>'
      + '<input id="licKey" placeholder="CC-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" '
      + 'style="width:100%;padding:11px 12px;border-radius:9px;border:1px solid #334155;background:#0f172a;color:#e5edf6;text-align:center;letter-spacing:1px;font-family:monospace">'
      + '<button id="licBtn" style="width:100%;margin-top:12px;padding:11px;border:0;border-radius:9px;background:#10b981;color:#fff;font-weight:700;cursor:pointer"></button>'
      + '<div id="licErr" style="color:#f87171;margin-top:10px;min-height:16px;font-size:12px"></div>'
      + '<a href="https://constructcount.com" target="_blank" style="display:inline-block;margin-top:8px;color:#38bdf8;font-size:12px;text-decoration:none">constructcount.com</a>'
      + '</div>';
    document.body.appendChild(o);
    o.querySelector('#licBtn').addEventListener('click', onActivate);
    o.querySelector('#licKey').addEventListener('keydown', function (e) { if (e.key === 'Enter') onActivate(); });
    return o;
  }
  function show(title, msg, allowClose) {
    var o = el();
    o.querySelector('#licTitle').textContent = title;
    o.querySelector('#licMsg').textContent = msg || '';
    o.querySelector('#licBtn').textContent = tr('Ativar licença');
    o.style.display = 'flex';
  }
  function hide() { var o = document.getElementById('licGate'); if (o) o.style.display = 'none'; }

  async function onActivate() {
    var o = el(); var key = o.querySelector('#licKey').value.trim();
    var err = o.querySelector('#licErr'), btn = o.querySelector('#licBtn');
    if (!key) { err.textContent = tr('Digite a chave de licença.'); return; }
    btn.disabled = true; btn.textContent = tr('Validando…'); err.textContent = '';
    var st = await doActivate(key);
    btn.disabled = false; btn.textContent = tr('Ativar licença');
    if (st.state === 'valid' || st.state === 'grace') { await refreshInfo(); hide(); banner(st); }
    else { err.textContent = tr('Licença inválida: {r}', { r: st.reason || '—' }); }
  }

  async function refreshInfo() {
    if (isDesktop()) {
      try { F._licInfo = await window.pywebview.api.license_info(); } catch (e) {}
      if (F._licInfo && Array.isArray(F._licInfo.modules)) F.entitlements = F._licInfo.modules;
      else if (F._licInfo && Array.isArray(F._licInfo.packages)) F.entitlements = F._licInfo.packages;
    } else { setEntFromToken(); }
  }

  // CORTESIA: licença sem vencimento (expires_at vazio) ou plano marcado como cortesia/vitalícia
  // → não vence e não mostra o aviso de expiração.
  F.isCourtesy = function (st) {
    if (!st || st.state !== 'valid') return false;
    if (/cortes|courtesy|vital/i.test(String(st.plan || ''))) return true;
    if (!st.expires_at && st.days_left == null) return true;
    return false;
  };

  function banner(st) {
    // aviso leve quando em carência ou perto de vencer (cortesia nunca avisa)
    var b = document.getElementById('licBanner');
    var warn = (st.state === 'grace') ? tr('Modo offline — {d} dia(s) de carência. Reconecte para revalidar.', { d: st.grace_days_left != null ? st.grace_days_left : '?' })
      : (!F.isCourtesy(st) && st.days_left != null && st.days_left <= 7) ? tr('Sua assinatura vence em {d} dia(s).', { d: st.days_left }) : '';
    if (!warn) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div'); b.id = 'licBanner';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#f59e0b;color:#1f2937;text-align:center;padding:6px 10px;font:600 12px Inter,system-ui;cursor:pointer';
      b.title = 'constructcount.com'; b.addEventListener('click', function () { window.open('https://constructcount.com', '_blank'); });
      document.body.appendChild(b);
    }
    b.textContent = '⚠ ' + warn;
  }

  async function gate() {
    if (!LICENSING) return;                    // licenciamento desligado → app livre
    await refreshInfo();
    var st = await getStatus();
    setEntFromToken(); applyPackageGates();      // aplica gating de pacotes (Framing etc.)
    if (st.state === 'valid' || st.state === 'grace') { hide(); banner(st); return; }
    if (st.state === 'none') show(tr('Ative o ConstructCount'), tr('Insira a chave de licença fornecida pela M2PB para usar o aplicativo.'));
    else show(tr('Licença não autorizada'), tr('Motivo: {r}. Insira uma chave válida ou renove sua assinatura.', { r: st.reason || '—' }));
  }

  async function start() {
    if (started) return; started = true;
    // no DESKTOP o interruptor mestre é o license_client.REQUIRED (Python) — RESPEITA o on/off (env CONSTRUCTCOUNT_LICENSE_REQUIRED=0 desliga p/ dev)
    if (isDesktop()) { try { var rq = await window.pywebview.api.license_required(); LICENSING = !!(rq && rq.required); } catch (e) {} }
    gate();
  }
  F.licenseStatus = getStatus;                 // p/ a aba Pacote ler o estado atual
  F.openLicenseGate = function () {            // abre o overlay de ativação/troca de chave
    var o = el();
    o.querySelector('#licTitle').textContent = tr('Ativar / trocar licença');
    o.querySelector('#licMsg').textContent = tr('Insira a chave de licença fornecida pela M2PB.');
    o.querySelector('#licBtn').textContent = tr('Ativar licença');
    o.querySelector('#licErr').textContent = '';
    o.style.display = 'flex';
    var k = o.querySelector('#licKey'); if (k) { k.value = ''; k.focus(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick);
  else kick();
  function kick() {
    setEntFromToken(); applyPackageGates();      // estado inicial dos gates (default libera tudo)
    if (isDesktop()) start();
    else { window.addEventListener('pywebviewready', start); setTimeout(start, 1500); }   // web cai no timeout
    setInterval(function () { if (LICENSING) gate(); }, 6 * 60 * 60 * 1000);                // revalida a cada 6h
  }
})();
