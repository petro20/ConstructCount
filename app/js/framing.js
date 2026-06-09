/* =========================================================================
   framing.js — Pacote FRAMING (Metal & Wood) — takeoff estrutural.
   Específico deste pacote (ver memória arquitetura-pacotes):
     • tipos de parede (material metal/wood, bitola, espaçamento, altura, plates)
     • trechos de parede (comprimento × qtd × tipo)  → entrada MANUAL na Fase 1
     • aberturas (largura × qtd) → vergas (headers) + king/jack studs
     • materiais calculados: montantes, guias/plates (LF), chapas (sheets) + preço USD
   Núcleo comum (canvas, medir, export) será plugado na Fase 2.
   Tudo isolado em F.framing — não mexe no fluxo de esquadrias.
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s) { return (F.tr ? F.tr(s) : s); };

  // ---- estado do pacote ----
  var FR = F.framing = {
    built: false,
    wallTypes: [
      // wood: plates=3 (1 soleira + 2 topo), blocking 1 linha;  metal: track=2 (sup+inf), bridging 1 linha
      { id: 'wt1', name: 'Ext. 2x6 Wood',      material: 'wood',  studSize: '2x6',         spacing: 16, height: 9, plates: 3, bracingRows: 1, sheathSides: 1 },
      { id: 'wt2', name: 'Int. 3-5/8" Metal',  material: 'metal', studSize: '3-5/8" 20ga', spacing: 16, height: 9, plates: 2, bracingRows: 1, sheathSides: 2 },
    ],
    segments: [],   // { id, wtId, len(ft), qty }
    openings: [],   // { id, wtId, width(ft), qty }
    prices: { stud: 0, plateLF: 0, sheet: 0, headerLF: 0 },
  };

  var uid = (function () { var n = 0; return function (p) { n++; return (p || 'id') + n; }; })();
  function wtById(id) { for (var i = 0; i < FR.wallTypes.length; i++) if (FR.wallTypes[i].id === id) return FR.wallTypes[i]; return null; }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : (d || 0); }

  // ---- MOTOR: cálculo de materiais ------------------------------------------
  /* Regras padrão de framing:
     studs por trecho = ceil(comprimento_in / espaçamento) + 1   (fence-post)
     plates/track (LF) = comprimento × nº de plates (wood=3: 1 base+2 topo; metal=2: base+topo)
     chapas (sf)      = comprimento × altura × nº de lados
     abertura → verga (LF) = (largura + 0,5 ft de apoio) × qtd
                + king/jack studs = 4 por abertura (2 king + 2 jack)
  */
  F.framingCompute = function () {
    var studs = {};    // por bitola → qtd
    var track = {};    // METAL: guias (sup+inf) por bitola → LF
    var plates = {};   // WOOD: plates (soleira+topo) por bitola → LF
    var bridgingLF = 0;   // METAL: travamento horizontal (LF)
    var blockingLF = 0;   // WOOD: blocking horizontal (LF)
    var sheath = {};   // por material → sf
    var headersLF = 0, openExtraStuds = {};
    var totalLF = 0;

    FR.segments.forEach(function (s) {
      var wt = wtById(s.wtId); if (!wt) return;
      var qty = num(s.qty, 1), L = num(s.len);
      if (L <= 0 || qty <= 0) return;
      totalLF += L * qty;
      var nStuds = (Math.ceil((L * 12) / (wt.spacing || 16)) + 1) * qty;
      studs[wt.studSize] = (studs[wt.studSize] || 0) + nStuds;
      var horizLF = L * (wt.plates || 2) * qty;          // linhas horizontais (track/plates)
      var brLF = L * (wt.bracingRows || 0) * qty;        // travamento (bridging/blocking)
      if (wt.material === 'metal') { track[wt.studSize] = (track[wt.studSize] || 0) + horizLF; bridgingLF += brLF; }
      else { plates[wt.studSize] = (plates[wt.studSize] || 0) + horizLF; blockingLF += brLF; }
      sheath[wt.material] = (sheath[wt.material] || 0) + L * (wt.height || 9) * (wt.sheathSides || 0) * qty;
    });

    FR.openings.forEach(function (o) {
      var wt = wtById(o.wtId); var qty = num(o.qty, 1), W = num(o.width);
      if (W <= 0 || qty <= 0) return;
      headersLF += (W + 0.5) * qty;
      var size = wt ? wt.studSize : (tr('(geral)'));
      openExtraStuds[size] = (openExtraStuds[size] || 0) + 4 * qty;  // 2 king + 2 jack
    });
    Object.keys(openExtraStuds).forEach(function (k) { studs[k] = (studs[k] || 0) + openExtraStuds[k]; });

    var sheathSf = 0; Object.keys(sheath).forEach(function (m) { sheathSf += sheath[m]; });
    var sheets = Math.ceil(sheathSf / 32);   // chapa 4x8 = 32 sf

    var totalStuds = 0; Object.keys(studs).forEach(function (k) { totalStuds += studs[k]; });
    var totalTrackLF = 0; Object.keys(track).forEach(function (k) { totalTrackLF += track[k]; });
    var totalPlateLF = 0; Object.keys(plates).forEach(function (k) { totalPlateLF += plates[k]; });

    return {
      studs: studs, track: track, plates: plates, sheath: sheath,
      bridgingLF: bridgingLF, blockingLF: blockingLF,
      totalStuds: totalStuds, totalTrackLF: totalTrackLF, totalPlateLF: totalPlateLF,
      totalHorizLF: totalTrackLF + totalPlateLF,
      headersLF: headersLF, sheathSf: sheathSf, sheets: sheets, totalLF: totalLF
    };
  };

  // ---- preço (USD) ----------------------------------------------------------
  function money(n) { try { return (F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2))); } catch (e) { return '$ ' + (Number(n) || 0).toFixed(2); } }
  function priceTotal(m) {
    var p = FR.prices;
    return (m.totalStuds * num(p.stud)) + (m.totalHorizLF * num(p.plateLF)) + (m.sheets * num(p.sheet)) + (m.headersLF * num(p.headerLF));
  }

  // ---- UI --------------------------------------------------------------------
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  F.openFraming = function () {
    build();
    var sc = document.getElementById('framingScreen');
    if (sc) { sc.classList.remove('hidden'); renderAll(); }
  };
  function closeFraming() { var sc = document.getElementById('framingScreen'); if (sc) sc.classList.add('hidden'); }

  function build() {
    if (FR.built) return;
    var sc = document.getElementById('framingScreen'); if (!sc) return;
    sc.innerHTML =
      '<header class="flex items-center gap-3 px-4 py-2.5 bg-steel-800 text-white shrink-0">'
      + '  <button id="frBack" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-white/10 transition"><span class="text-lg leading-none">←</span><span>' + tr('Voltar') + '</span></button>'
      + '  <div class="font-bold">🏗️ ' + tr('Takeoff de Framing') + ' <span class="text-steel-300 font-normal text-sm">(Metal &amp; Wood)</span></div>'
      + '  <span class="ml-auto text-xs text-steel-300">' + tr('Fase 1 · entrada manual por trecho') + '</span>'
      + '</header>'
      + '<div class="flex-1 min-h-0 grid" style="grid-template-columns: 280px 1fr 320px">'
      // ----- col 1: tipos de parede -----
      + '  <aside class="min-h-0 overflow-y-auto border-r border-steel-200 bg-white p-3">'
      + '    <div class="flex items-center justify-between mb-2"><h3 class="font-bold text-steel-800">' + tr('Tipos de parede') + '</h3>'
      + '      <button id="frAddWT" class="text-xs font-semibold px-2 py-1 rounded bg-steel-100 hover:bg-steel-200">+ ' + tr('Novo') + '</button></div>'
      + '    <div id="frWTList" class="space-y-2"></div>'
      + '  </aside>'
      // ----- col 2: trechos + aberturas -----
      + '  <main class="min-h-0 overflow-y-auto p-4 bg-steel-50">'
      + '    <div class="flex items-center justify-between mb-2"><h3 class="font-bold text-steel-800">' + tr('Trechos de parede') + '</h3>'
      + '      <button id="frAddSeg" class="text-sm font-semibold px-3 py-1.5 rounded-lg bg-steel-700 text-white hover:bg-steel-600">+ ' + tr('Trecho') + '</button></div>'
      + '    <div class="bg-white rounded-xl border border-steel-200 overflow-hidden mb-6"><table class="w-full text-sm"><thead class="bg-steel-100 text-steel-500 text-xs"><tr>'
      + '      <th class="text-left px-3 py-2">' + tr('Tipo de parede') + '</th><th class="px-3 py-2 w-28">' + tr('Compr. (ft)') + '</th><th class="px-3 py-2 w-16">' + tr('Qtd') + '</th><th class="w-10"></th></tr></thead><tbody id="frSegBody"></tbody></table></div>'
      + '    <div class="flex items-center justify-between mb-2"><h3 class="font-bold text-steel-800">' + tr('Aberturas (vergas)') + '</h3>'
      + '      <button id="frAddOpen" class="text-sm font-semibold px-3 py-1.5 rounded-lg bg-steel-700 text-white hover:bg-steel-600">+ ' + tr('Abertura') + '</button></div>'
      + '    <div class="bg-white rounded-xl border border-steel-200 overflow-hidden"><table class="w-full text-sm"><thead class="bg-steel-100 text-steel-500 text-xs"><tr>'
      + '      <th class="text-left px-3 py-2">' + tr('Tipo de parede') + '</th><th class="px-3 py-2 w-28">' + tr('Largura (ft)') + '</th><th class="px-3 py-2 w-16">' + tr('Qtd') + '</th><th class="w-10"></th></tr></thead><tbody id="frOpenBody"></tbody></table></div>'
      + '    <p class="text-xs text-steel-400 mt-3">💡 ' + tr('Na Fase 2 você vai medir os trechos direto na planta — o comprimento entra sozinho.') + '</p>'
      + '  </main>'
      // ----- col 3: materiais + preço -----
      + '  <aside class="min-h-0 overflow-y-auto border-l border-steel-200 bg-white p-4">'
      + '    <h3 class="font-bold text-steel-800 mb-3">' + tr('Materiais') + '</h3>'
      + '    <div id="frMaterials" class="space-y-3 text-sm"></div>'
      + '    <h3 class="font-bold text-steel-800 mt-6 mb-2">' + tr('Preço (USD)') + '</h3>'
      + '    <div class="grid grid-cols-2 gap-2 text-xs">'
      + '      <label>' + tr('Montante (un)') + '<input id="frPrStud" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded border border-steel-200 px-2 py-1"></label>'
      + '      <label>' + tr('Guia/plate (LF)') + '<input id="frPrPlate" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded border border-steel-200 px-2 py-1"></label>'
      + '      <label>' + tr('Chapa (un)') + '<input id="frPrSheet" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded border border-steel-200 px-2 py-1"></label>'
      + '      <label>' + tr('Verga (LF)') + '<input id="frPrHeader" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded border border-steel-200 px-2 py-1"></label>'
      + '    </div>'
      + '    <div class="mt-4 rounded-xl bg-steel-800 text-white p-4 text-center"><div class="text-xs text-steel-300">' + tr('Total estimado') + '</div><div id="frTotal" class="text-2xl font-bold">$ 0</div></div>'
      + '  </aside>'
      + '</div>';

    // listeners base
    sc.querySelector('#frBack').addEventListener('click', closeFraming);
    sc.querySelector('#frAddWT').addEventListener('click', function () {
      FR.wallTypes.push({ id: uid('wt'), name: tr('Nova parede'), material: 'metal', studSize: '3-5/8" 20ga', spacing: 16, height: 9, plates: 2, bracingRows: 1, sheathSides: 1 });
      renderWTs();
    });
    sc.querySelector('#frAddSeg').addEventListener('click', function () {
      FR.segments.push({ id: uid('sg'), wtId: (FR.wallTypes[0] || {}).id, len: '', qty: 1 }); renderSegs();
    });
    sc.querySelector('#frAddOpen').addEventListener('click', function () {
      FR.openings.push({ id: uid('op'), wtId: (FR.wallTypes[0] || {}).id, width: '', qty: 1 }); renderOpens();
    });
    ['frPrStud:stud', 'frPrPlate:plateLF', 'frPrSheet:sheet', 'frPrHeader:headerLF'].forEach(function (pair) {
      var p = pair.split(':'), inp = sc.querySelector('#' + p[0]);
      if (inp) { inp.value = FR.prices[p[1]] || ''; inp.addEventListener('input', function () { FR.prices[p[1]] = num(inp.value); renderMaterials(); }); }
    });
    FR.built = true;
  }

  function matLabel(m) { return m === 'wood' ? tr('Madeira') : tr('Metal'); }
  var wtOptions = function (sel) {
    return FR.wallTypes.map(function (wt) {
      return '<option value="' + wt.id + '"' + (wt.id === sel ? ' selected' : '') + '>' + esc(wt.name) + '</option>';
    }).join('');
  };

  // ---- render: tipos de parede (cards editáveis) ----
  function renderWTs() {
    var box = document.getElementById('frWTList'); if (!box) return;
    box.innerHTML = FR.wallTypes.map(function (wt) {
      return '<div class="rounded-lg border border-steel-200 p-2.5" data-wt="' + wt.id + '">'
        + '<div class="flex items-center gap-1 mb-1.5"><input class="frWTName flex-1 font-semibold text-steel-800 text-sm px-1 py-0.5 rounded border border-transparent hover:border-steel-200 focus:border-steel-300 outline-none" value="' + esc(wt.name) + '">'
        + '<button class="frWTDel text-steel-400 hover:text-rose-500 px-1" title="' + tr('Remover') + '">✕</button></div>'
        + '<div class="grid grid-cols-2 gap-1.5 text-xs">'
        + '  <label class="text-steel-500">' + tr('Material') + '<select class="frWTMat mt-0.5 w-full rounded border border-steel-200 px-1 py-1"><option value="metal"' + (wt.material === 'metal' ? ' selected' : '') + '>' + tr('Metal') + '</option><option value="wood"' + (wt.material === 'wood' ? ' selected' : '') + '>' + tr('Madeira') + '</option></select></label>'
        + '  <label class="text-steel-500">' + tr('Bitola') + '<input class="frWTSize mt-0.5 w-full rounded border border-steel-200 px-1 py-1" value="' + esc(wt.studSize) + '"></label>'
        + '  <label class="text-steel-500">' + tr('Espaç. (in)') + '<select class="frWTSpace mt-0.5 w-full rounded border border-steel-200 px-1 py-1"><option' + (wt.spacing === 12 ? ' selected' : '') + '>12</option><option' + (wt.spacing === 16 ? ' selected' : '') + '>16</option><option' + (wt.spacing === 19.2 ? ' selected' : '') + '>19.2</option><option' + (wt.spacing === 24 ? ' selected' : '') + '>24</option></select></label>'
        + '  <label class="text-steel-500">' + tr('Altura (ft)') + '<input class="frWTH mt-0.5 w-full rounded border border-steel-200 px-1 py-1" type="number" min="1" step="0.5" value="' + wt.height + '"></label>'
        + '  <label class="text-steel-500">' + (wt.material === 'wood' ? tr('Plates (nº)') : tr('Track (nº)')) + '<input class="frWTPlates mt-0.5 w-full rounded border border-steel-200 px-1 py-1" type="number" min="1" max="4" step="1" value="' + wt.plates + '"></label>'
        + '  <label class="text-steel-500">' + (wt.material === 'wood' ? tr('Blocking (linhas)') : tr('Bridging (linhas)')) + '<input class="frWTBrace mt-0.5 w-full rounded border border-steel-200 px-1 py-1" type="number" min="0" max="6" step="1" value="' + (wt.bracingRows || 0) + '"></label>'
        + '  <label class="text-steel-500">' + tr('Lados chapa') + '<select class="frWTSheath mt-0.5 w-full rounded border border-steel-200 px-1 py-1"><option value="0"' + (wt.sheathSides === 0 ? ' selected' : '') + '>0</option><option value="1"' + (wt.sheathSides === 1 ? ' selected' : '') + '>1</option><option value="2"' + (wt.sheathSides === 2 ? ' selected' : '') + '>2</option></select></label>'
        + '</div></div>';
    }).join('') || ('<div class="text-steel-400 text-sm">' + tr('Nenhum tipo. Clique em + Novo.') + '</div>');

    box.querySelectorAll('[data-wt]').forEach(function (row) {
      var id = row.getAttribute('data-wt'), wt = wtById(id); if (!wt) return;
      var on = function (cls, ev, fn) { var el = row.querySelector(cls); if (el) el.addEventListener(ev, fn); };
      on('.frWTName', 'input', function (e) { wt.name = e.target.value; refreshSelects(); });
      on('.frWTMat', 'change', function (e) { wt.material = e.target.value; wt.plates = (wt.material === 'wood' ? 3 : 2); renderWTs(); renderMaterials(); });
      on('.frWTSize', 'input', function (e) { wt.studSize = e.target.value; renderMaterials(); });
      on('.frWTSpace', 'change', function (e) { wt.spacing = num(e.target.value, 16); renderMaterials(); });
      on('.frWTH', 'input', function (e) { wt.height = num(e.target.value, 9); renderMaterials(); });
      on('.frWTPlates', 'input', function (e) { wt.plates = num(e.target.value, 2); renderMaterials(); });
      on('.frWTBrace', 'input', function (e) { wt.bracingRows = num(e.target.value, 0); renderMaterials(); });
      on('.frWTSheath', 'change', function (e) { wt.sheathSides = num(e.target.value, 0); renderMaterials(); });
      on('.frWTDel', 'click', function () { FR.wallTypes = FR.wallTypes.filter(function (w) { return w.id !== id; }); renderWTs(); refreshSelects(); renderMaterials(); });
    });
  }
  function refreshSelects() {
    document.querySelectorAll('#frSegBody .frSegWT, #frOpenBody .frOpenWT').forEach(function (sel) {
      var cur = sel.value; sel.innerHTML = wtOptions(cur);
    });
  }

  // ---- render: trechos ----
  function renderSegs() {
    var body = document.getElementById('frSegBody'); if (!body) return;
    body.innerHTML = FR.segments.map(function (s) {
      return '<tr class="border-t border-steel-100" data-sg="' + s.id + '">'
        + '<td class="px-3 py-1.5"><select class="frSegWT w-full rounded border border-steel-200 px-2 py-1">' + wtOptions(s.wtId) + '</select></td>'
        + '<td class="px-3 py-1.5"><input class="frSegLen w-full rounded border border-steel-200 px-2 py-1 text-right" type="number" min="0" step="0.1" value="' + (s.len === '' ? '' : s.len) + '"></td>'
        + '<td class="px-3 py-1.5"><input class="frSegQty w-full rounded border border-steel-200 px-2 py-1 text-right" type="number" min="1" step="1" value="' + s.qty + '"></td>'
        + '<td class="px-1 text-center"><button class="frSegDel text-steel-400 hover:text-rose-500">✕</button></td></tr>';
    }).join('') || ('<tr><td colspan="4" class="px-3 py-4 text-steel-400 text-center">' + tr('Adicione um trecho de parede.') + '</td></tr>');
    body.querySelectorAll('[data-sg]').forEach(function (row) {
      var id = row.getAttribute('data-sg'), s = FR.segments.filter(function (x) { return x.id === id; })[0]; if (!s) return;
      row.querySelector('.frSegWT').addEventListener('change', function (e) { s.wtId = e.target.value; renderMaterials(); });
      row.querySelector('.frSegLen').addEventListener('input', function (e) { s.len = num(e.target.value); renderMaterials(); });
      row.querySelector('.frSegQty').addEventListener('input', function (e) { s.qty = num(e.target.value, 1); renderMaterials(); });
      row.querySelector('.frSegDel').addEventListener('click', function () { FR.segments = FR.segments.filter(function (x) { return x.id !== id; }); renderSegs(); renderMaterials(); });
    });
  }

  // ---- render: aberturas ----
  function renderOpens() {
    var body = document.getElementById('frOpenBody'); if (!body) return;
    body.innerHTML = FR.openings.map(function (o) {
      return '<tr class="border-t border-steel-100" data-op="' + o.id + '">'
        + '<td class="px-3 py-1.5"><select class="frOpenWT w-full rounded border border-steel-200 px-2 py-1">' + wtOptions(o.wtId) + '</select></td>'
        + '<td class="px-3 py-1.5"><input class="frOpenW w-full rounded border border-steel-200 px-2 py-1 text-right" type="number" min="0" step="0.1" value="' + (o.width === '' ? '' : o.width) + '"></td>'
        + '<td class="px-3 py-1.5"><input class="frOpenQty w-full rounded border border-steel-200 px-2 py-1 text-right" type="number" min="1" step="1" value="' + o.qty + '"></td>'
        + '<td class="px-1 text-center"><button class="frOpenDel text-steel-400 hover:text-rose-500">✕</button></td></tr>';
    }).join('') || ('<tr><td colspan="4" class="px-3 py-4 text-steel-400 text-center">' + tr('Sem aberturas (opcional).') + '</td></tr>');
    body.querySelectorAll('[data-op]').forEach(function (row) {
      var id = row.getAttribute('data-op'), o = FR.openings.filter(function (x) { return x.id === id; })[0]; if (!o) return;
      row.querySelector('.frOpenWT').addEventListener('change', function (e) { o.wtId = e.target.value; renderMaterials(); });
      row.querySelector('.frOpenW').addEventListener('input', function (e) { o.width = num(e.target.value); renderMaterials(); });
      row.querySelector('.frOpenQty').addEventListener('input', function (e) { o.qty = num(e.target.value, 1); renderMaterials(); });
      row.querySelector('.frOpenDel').addEventListener('click', function () { FR.openings = FR.openings.filter(function (x) { return x.id !== id; }); renderOpens(); renderMaterials(); });
    });
  }

  // ---- render: materiais + total ----
  function renderMaterials() {
    var box = document.getElementById('frMaterials'); if (!box) return;
    var m = F.framingCompute();
    function rows(obj, fmt) {
      var ks = Object.keys(obj); if (!ks.length) return '<div class="text-steel-400">—</div>';
      return ks.map(function (k) { return '<div class="flex justify-between"><span class="text-steel-600">' + esc(k) + '</span><span class="font-semibold text-steel-800">' + fmt(obj[k]) + '</span></div>'; }).join('');
    }
    function card(title, inner) { return '<div class="rounded-lg bg-steel-50 p-3"><div class="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-1.5">' + title + '</div>' + inner + '</div>'; }
    function lineLF(label, v) { return '<div class="flex justify-between"><span class="text-steel-600">' + label + '</span><span class="font-semibold text-steel-800">' + v.toFixed(1) + ' LF</span></div>'; }
    var html = card(tr('Montantes') + ' (' + m.totalStuds + ')', rows(m.studs, function (v) { return v + ' un'; }));
    if (Object.keys(m.track).length) html += card(tr('Track / Guias (metal)') + ' (' + m.totalTrackLF.toFixed(1) + ' LF)', rows(m.track, function (v) { return v.toFixed(1) + ' LF'; }));
    if (Object.keys(m.plates).length) html += card(tr('Plates (madeira)') + ' (' + m.totalPlateLF.toFixed(1) + ' LF)', rows(m.plates, function (v) { return v.toFixed(1) + ' LF'; }));
    if (m.bridgingLF > 0 || m.blockingLF > 0) {
      var br = '';
      if (m.bridgingLF > 0) br += lineLF(tr('Bridging (metal)'), m.bridgingLF);
      if (m.blockingLF > 0) br += lineLF(tr('Blocking (madeira)'), m.blockingLF);
      html += card(tr('Travamento'), br);
    }
    html += card(tr('Chapas'), '<div class="flex justify-between"><span class="text-steel-600">' + tr('Área') + '</span><span class="font-semibold text-steel-800">' + m.sheathSf.toFixed(0) + ' sf</span></div><div class="flex justify-between"><span class="text-steel-600">' + tr('Folhas 4x8') + '</span><span class="font-semibold text-steel-800">' + m.sheets + '</span></div>');
    html += card(tr('Vergas (headers)'), lineLF(tr('Comprimento'), m.headersLF));
    html += '<div class="text-xs text-steel-400">' + tr('Paredes: total') + ' ' + m.totalLF.toFixed(1) + ' LF</div>';
    box.innerHTML = html;
    var tot = document.getElementById('frTotal'); if (tot) tot.textContent = money(priceTotal(m));
  }

  function renderAll() { renderWTs(); renderSegs(); renderOpens(); renderMaterials(); }
})();
