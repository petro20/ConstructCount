/* =========================================================================
   framing.js — Pacote FRAMING (Metal & Wood) — takeoff estrutural.
   Fase 1: motor de cálculo (tipos de parede → trechos/aberturas → materiais).
   Fase 2: MARCAÇÃO na planta — abre PDF (pdf.js), calibra escala, traça parede
           por tipo (LF entra sozinho como trecho), cor + legenda por tipo.
   Específico deste pacote (ver memória escopo-framing). Núcleo isolado: NÃO
   mexe no workspace de esquadrias.
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s) { return (F.tr ? F.tr(s) : s); };

  var COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#a3e635'];

  var FR = F.framing = {
    built: false,
    wallTypes: [],   // vazio: só os tipos LIDOS pela IA (ou criados) — sem padrões poluindo
    segments: [],   // { id, wtId, len(ft), qty, path?:[{x,y}img], source:'draw'|'manual' }
    openings: [],   // { id, wtId, width(ft), qty }
    prices: { stud: 0, plateLF: 0, sheet: 0, headerLF: 0, drywallSf: 0, insulSf: 0 },   // MATERIAL (por unidade do item)
    labor: { framing: 0, drywall: 0, insulation: 0 },                                    // MÃO DE OBRA — taxa por OFÍCIO, por SF
    pxPerFt: null,  // escala calibrada (px da imagem por pé)
    floors: [], activeFloor: null,   // PISOS (cada um com altura) — o traço herda a altura do piso ativo
    scope: { framing: true, drywall: true, insulation: true },   // ESCOPO da obra — definido ANTES do levantamento
  };
  // escopo: a mesma parede gera quantidades p/ cada ofício LIGADO
  F.framingScope = function () { return FR.scope; };
  F.framingToggleScope = function (key) { if (FR.scope[key] == null) return; FR.scope[key] = !FR.scope[key]; persistFraming(); };
  F.framingSetScope = function (key, on) { if (FR.scope[key] == null) return; FR.scope[key] = !!on; persistFraming(); };

  var uid = (function () { var n = 0; return function (p) { n++; return (p || 'id') + n; }; })();
  function wtById(id) { for (var i = 0; i < FR.wallTypes.length; i++) if (FR.wallTypes[i].id === id) return FR.wallTypes[i]; return null; }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : (d || 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* =======================================================================
     MOTOR DE CÁLCULO
     ===================================================================== */
  F.framingCompute = function () {
    var studs = {}, track = {}, plates = {}, sheath = {};
    var bridgingLF = 0, blockingLF = 0, headersLF = 0, totalLF = 0, openExtraStuds = {};

    var wallSf = 0, insulationSf = 0;
    FR.segments.forEach(function (s) {
      var wt = wtById(s.wtId); if (!wt) return;
      var qty = num(s.qty, 1), L = num(s.len);
      if (L <= 0 || qty <= 0) return;
      var H = num(s.height) || (wt.height || 9);   // altura: do PISO (traço) → senão do tipo
      totalLF += L * qty;
      wallSf += L * H * qty;                         // área de parede = LF × altura do piso
      studs[wt.studSize] = (studs[wt.studSize] || 0) + (Math.ceil((L * 12) / (wt.spacing || 16)) + 1) * qty;
      var horizLF = L * (wt.plates || 2) * qty, brLF = L * (wt.bracingRows || 0) * qty;
      if (wt.material === 'metal') { track[wt.studSize] = (track[wt.studSize] || 0) + horizLF; bridgingLF += brLF; }
      else { plates[wt.studSize] = (plates[wt.studSize] || 0) + horizLF; blockingLF += brLF; }
      sheath[wt.material] = (sheath[wt.material] || 0) + L * H * (wt.sheathSides || 0) * qty;   // drywall/board (por lados)
      if (wtHasInsulation(wt)) insulationSf += L * H * qty;                                     // cavidade isolada (1 camada)
    });
    FR.openings.forEach(function (o) {
      var wt = wtById(o.wtId), qty = num(o.qty, 1), W = num(o.width);
      if (W <= 0 || qty <= 0) return;
      headersLF += (W + 0.5) * qty;
      var size = wt ? wt.studSize : tr('(geral)');
      openExtraStuds[size] = (openExtraStuds[size] || 0) + 4 * qty;
    });
    Object.keys(openExtraStuds).forEach(function (k) { studs[k] = (studs[k] || 0) + openExtraStuds[k]; });

    var sheathSf = 0; Object.keys(sheath).forEach(function (m) { sheathSf += sheath[m]; });
    var totalStuds = 0; Object.keys(studs).forEach(function (k) { totalStuds += studs[k]; });
    var totalTrackLF = 0; Object.keys(track).forEach(function (k) { totalTrackLF += track[k]; });
    var totalPlateLF = 0; Object.keys(plates).forEach(function (k) { totalPlateLF += plates[k]; });
    return {
      studs: studs, track: track, plates: plates, sheath: sheath,
      bridgingLF: bridgingLF, blockingLF: blockingLF,
      totalStuds: totalStuds, totalTrackLF: totalTrackLF, totalPlateLF: totalPlateLF,
      totalHorizLF: totalTrackLF + totalPlateLF, wallSf: wallSf,
      headersLF: headersLF, sheathSf: sheathSf, sheets: Math.ceil(sheathSf / 32), totalLF: totalLF,
      drywallSf: sheathSf, drywallSheets: Math.ceil(sheathSf / 32), insulationSf: insulationSf
    };
  };
  // a parede tem isolamento? (lido da planta: campo insulation ou componente "isol")
  function wtHasInsulation(wt) {
    if (wt && wt.insulation && String(wt.insulation).trim()) return true;
    return !!(wt && Array.isArray(wt.components) && wt.components.some(function (c) { return /isol|insul/i.test(c); }));
  }
  F.framingWtHasInsulation = wtHasInsulation;
  function money(n) { try { return (F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2))); } catch (e) { return '$ ' + (Number(n) || 0).toFixed(2); } }
  function priceTotal(m) {
    var p = FR.prices;
    return (m.totalStuds * num(p.stud)) + (m.totalHorizLF * num(p.plateLF)) + (m.sheets * num(p.sheet)) + (m.headersLF * num(p.headerLF));
  }

  /* =======================================================================
     TAKEOFF NO WORKSPACE — Assembly ligada aos traços do Linear (por camada/trade)
     Painel lateral dentro do workspace. NÃO usa tela separada.
     ===================================================================== */
  FR.layerAssembly = FR.layerAssembly || {};   // { layerId: wtId } — qual assembly aplica em cada camada
  function ftFromMm(mm) { return num(mm) / 304.8; }
  function autoAssembly(name) {
    var n = (name || '').toLowerCase(), wt;
    for (var i = 0; i < FR.wallTypes.length; i++) {
      wt = FR.wallTypes[i];
      if (/metal/.test(n) && wt.material === 'metal') return wt.id;
      if (/(wood|madeira|carpentry)/.test(n) && wt.material === 'wood') return wt.id;
    }
    return (FR.wallTypes[0] || {}).id;
  }

  // IA leu o detalhe de tipo de parede → cria as assemblies (wall types)
  F.framingAddWallTypes = function (walls) {
    var added = 0;
    (walls || []).forEach(function (w) {
      var mat = (w.material === 'wood') ? 'wood' : 'metal';   // 'both' → metal (nota no nome)
      var plates = (parseInt(w.bottom_plates, 10) || 1) + (parseInt(w.top_plates, 10) || 2);
      // id ESTÁVEL pelo nº do tipo (Tipo 2A → wt_2A): reler não perde a associação dos traços
      var tid = (w.type_id || '').toString().replace(/[^A-Za-z0-9]/g, '');
      var id = tid ? ('wt_' + tid) : uid('wt');
      var obj = {
        id: id,
        name: (w.name || 'Tipo IA') + (w.material === 'both' ? ' (wood/metal)' : ''),
        material: mat,
        studSize: w.stud_size || (mat === 'wood' ? '2x4' : '3-5/8" 20ga'),
        spacing: parseFloat(w.spacing_in) || 16,
        height: 9,
        plates: plates,
        bracingRows: 1,
        sheathSides: (w.sheathing_sides != null ? parseInt(w.sheathing_sides, 10) : 2),
        color: COLORS[FR.wallTypes.length % COLORS.length],
        ai: true, typeId: w.type_id || '', sheathing: w.sheathing || '', insulation: w.insulation || '',
        components: Array.isArray(w.components) ? w.components : [],
        srcMaterial: w.material,                            // 'wood' | 'metal' | 'both' (original lido)
        materialConfirmed: (w.material !== 'both'),         // 'both' → precisa você definir
        heightSet: false                                    // altura ainda não confirmada (da elevação)
      };
      var ix = -1;
      for (var i = 0; i < FR.wallTypes.length; i++) if (FR.wallTypes[i].id === id) { ix = i; break; }
      if (ix >= 0) { obj.color = FR.wallTypes[ix].color; FR.wallTypes[ix] = obj; }   // upsert: mantém a cor já ajustada
      else { FR.wallTypes.push(obj); added++; }
    });
    persistFraming();
    return added;
  };

  // ---- persistência das assemblies (nível de projeto) ----
  function persistFraming() { if (F._saveFraming) { try { F._saveFraming(); } catch (e) {} } }
  F._framingLoad = function (d) {
    if (!d) return;
    if (Array.isArray(d.wallTypes) && d.wallTypes.length) FR.wallTypes = d.wallTypes;
    if (d.prices) FR.prices = Object.assign({ stud: 0, plateLF: 0, sheet: 0, headerLF: 0, drywallSf: 0, insulSf: 0 }, d.prices);
    if (d.labor) FR.labor = Object.assign({ framing: 0, drywall: 0, insulation: 0 }, d.labor);
    if (d.scope) FR.scope = Object.assign({ framing: true, drywall: true, insulation: true }, d.scope);
    if (d.layerAssembly) FR.layerAssembly = d.layerAssembly;
    if (Array.isArray(d.floors)) FR.floors = d.floors;
    FR.activeFloor = d.activeFloor || (FR.floors[0] && FR.floors[0].id) || null;
    FR.activeWT = d.activeWT || (FR.wallTypes[0] && FR.wallTypes[0].id) || null;
  };
  F._framingSnapshot = function () { return { wallTypes: FR.wallTypes, prices: FR.prices, labor: FR.labor, scope: FR.scope, activeWT: FR.activeWT, layerAssembly: FR.layerAssembly, floors: FR.floors, activeFloor: FR.activeFloor }; };

  // ---- PISOS (cada um com altura) ----
  function floorById(id) { for (var i = 0; i < FR.floors.length; i++) if (FR.floors[i].id === id) return FR.floors[i]; return null; }
  F.framingActiveFloorHeight = function () { var f = floorById(FR.activeFloor); return f ? num(f.height) : 0; };
  F.framingActiveFloorName = function () { var f = floorById(FR.activeFloor); return f ? f.name : ''; };
  F.framingAddFloor = function (name, height) {
    var f = { id: uid('fl'), name: name || ('Piso ' + (FR.floors.length + 1)), height: num(height) || 9 };
    FR.floors.push(f); FR.activeFloor = f.id; persistFraming(); return f;
  };
  F.framingSetFloor = function (id) { FR.activeFloor = id; persistFraming(); };
  F.framingUpdateFloor = function (id, patch) { var f = floorById(id); if (f) { if (patch.name != null) f.name = patch.name; if (patch.height != null) f.height = num(patch.height) || f.height; persistFraming(); } };

  // CONFERÊNCIA: a IA pergunta quando tem dúvida (projetos diferem). Retorna os motivos.
  function wallTypeReview(wt) {
    var r = [];
    if (!wt) return r;
    if (wt.materialConfirmed === false) r.push(tr('Material: madeira ou metal?'));
    if ((!wt.components || wt.components.length < 3) && !wt.specConfirmed) r.push(tr('Especificação incompleta'));
    return r;
  }
  F.framingWallTypeReview = wallTypeReview;

  // duplicar um tipo (ex.: mesmo tipo em outro PAVIMENTO, com altura diferente)
  function cloneWallType(id) {
    var src = wtById(id); if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('wt');
    copy.name = (src.name || 'Tipo') + ' (2)';
    copy.color = COLORS[FR.wallTypes.length % COLORS.length];
    copy.heightSet = false;        // nova altura precisa ser definida (conferência ⚠️)
    copy.typeId = '';              // não é o id estável do original → reler IA não o sobrescreve
    copy.ai = false;
    var ix = FR.wallTypes.indexOf(src);
    FR.wallTypes.splice(ix + 1, 0, copy);
    FR.activeWT = copy.id;
    persistFraming();
    return copy.id;
  }

  FR.activeWT = FR.activeWT || null;   // tipo de parede ATIVO (o que você traça)

  F.toggleFramingTakeoff = function (lines, layers) {
    FR._layers = layers || [];
    var ws = document.getElementById('workspace') || document.body;
    var ov = document.getElementById('frTakeoff');
    if (ov && ov.style.display !== 'none') { ov.style.display = 'none'; return; }
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'frTakeoff';
      ov.style.cssText = 'position:absolute;left:0;right:0;bottom:24px;height:272px;z-index:44;background:#fff;border-top:2px solid #c4881a;box-shadow:0 -8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;color:#262420';
      ws.appendChild(ov);
    }
    ov.style.display = 'flex';
    ov.style.height = (FR._takeoffH || 272) + 'px';   // altura redimensionável (arrastar a alça do topo)
    if (F._positionFraming) F._positionFraming();
    renderFramingTakeoff(ov);
  };
  F._renderFramingPanel = function () { var ov = document.getElementById('frTakeoff'); if (ov && ov.style.display !== 'none') renderFramingTakeoff(ov); };

  // compute por TIPO (lines daquele tipo, com a altura do piso de cada traço)
  function computeType(wtId) {
    var lines = (F._framingLines ? F._framingLines() : []) || [];
    var saved = FR.segments;
    FR.segments = lines.filter(function (l) { return l.wt === wtId; }).map(function (l) { return { id: uid('s'), wtId: wtId, len: ftFromMm(l.mm), qty: 1, height: l.height || 0 }; });
    var m = F.framingCompute();
    FR.segments = saved;
    m.floors = {}; lines.forEach(function (l) { if (l.wt === wtId && l.floor) m.floors[l.floor] = true; });
    return m;
  }
  // MATERIAL = por item; MÃO DE OBRA = taxa por OFÍCIO × SF (Framing=SF parede, Drywall=SF chapa, Insulation=SF)
  function priceParts(m) {
    var p = FR.prices, l = FR.labor, s = FR.scope, mat = 0, lab = 0;
    if (s.framing) { mat += m.totalStuds * num(p.stud) + m.totalHorizLF * num(p.plateLF) + m.headersLF * num(p.headerLF); lab += m.wallSf * num(l.framing); }
    if (s.drywall) { mat += (num(p.drywallSf) > 0 ? m.drywallSf * num(p.drywallSf) : m.drywallSheets * num(p.sheet)); lab += m.drywallSf * num(l.drywall); }
    if (s.insulation) { mat += m.insulationSf * num(p.insulSf); lab += m.insulationSf * num(l.insulation); }
    return { mat: mat, lab: lab, total: mat + lab };
  }
  function typePrice(m) { return priceParts(m).total; }
  F.framingPriceParts = priceParts;

  // editor inline do TIPO — completa a spec e resolve a dúvida (⚠️)
  function editorHTML(wt) {
    var comps = (wt.components || []).join('\n');
    var matSel = function (v) { return '<select class="fe-mat">'
      + '<option value="wood"' + (wt.material === 'wood' ? ' selected' : '') + '>🪵 Wood</option>'
      + '<option value="metal"' + (wt.material === 'metal' ? ' selected' : '') + '>🔩 Metal</option></select>'; };
    var rev = wallTypeReview(wt);
    return '<div class="ftt-edit">'
      + '<div class="ftt-edhead">✎ ' + tr('Editar') + ' · ' + esc(wt.name) + (rev.length ? ' <span class="ftt-edwarn">⚠️ ' + rev.map(esc).join(' · ') + '</span>' : ' <span class="ftt-edok">✓ ' + tr('sem pendências') + '</span>') + '</div>'
      + '<div class="ftt-edgrid">'
      + '<label>' + tr('Nome') + '<input class="fe-name" value="' + esc(wt.name) + '"></label>'
      + '<label>' + tr('Material') + matSel() + '</label>'
      + '<label>' + tr('Bitola (stud)') + '<input class="fe-size" value="' + esc(wt.studSize || '') + '"></label>'
      + '<label>' + tr('Espaç. (in)') + '<input class="fe-sp" type="number" min="1" step="1" value="' + (wt.spacing || '') + '"></label>'
      + '<label>' + tr('Plates/Track') + '<input class="fe-pl" type="number" min="0" step="1" value="' + (wt.plates || '') + '"></label>'
      + '<label>' + tr('Lados de chapa') + '<input class="fe-sh" type="number" min="0" max="2" step="1" value="' + (wt.sheathSides != null ? wt.sheathSides : '') + '"></label>'
      + '<label>' + tr('Isolamento') + '<input class="fe-ins" value="' + esc(wt.insulation || '') + '" placeholder="' + tr('ex.: R-13 / 3½\" fiberglass') + '"></label>'
      + '</div>'
      + '<label class="ftt-edcomp">' + tr('Componentes (1 por linha — o que está no desenho/nota)') + '<textarea class="fe-comp" rows="4">' + esc(comps) + '</textarea></label>'
      + '<div class="ftt-edactions"><button class="fe-ok">✓ ' + tr('Marcar spec como conferida') + '</button><button class="fe-close">' + tr('Fechar editor') + '</button></div>'
      + '</div>';
  }

  // Takeoff de Framing como TABELA editável no painel INFERIOR (igual ao Resumo) — colunas seguem o ESCOPO
  function renderFramingTakeoff(ov) {
    if ((!FR.activeWT || !wtById(FR.activeWT)) && FR.wallTypes[0]) FR.activeWT = FR.wallTypes[0].id;
    var sc = FR.scope;
    var rows = FR.wallTypes.map(function (wt) { return { wt: wt, m: computeType(wt.id) }; })
      .filter(function (x) { return x.m.totalLF > 0 || x.wt.id === FR.activeWT; });
    var T = { lf: 0, sf: 0, studs: 0, horiz: 0, sheets: 0, dwsf: 0, header: 0, insul: 0, mat: 0, lab: 0, price: 0 };
    rows.forEach(function (x) { var m = x.m, pp = priceParts(m); T.lf += m.totalLF; T.sf += m.wallSf; T.studs += m.totalStuds; T.horiz += m.totalHorizLF; T.sheets += m.drywallSheets; T.dwsf += m.drywallSf; T.header += m.headersLF; T.insul += m.insulationSf; T.mat += pp.mat; T.lab += pp.lab; T.price += pp.total; });

    // colunas dinâmicas: fixas + grupos por escopo ligado
    var cols = [];
    cols.push({ h: '', body: function (wt, m) { return '<td><input class="ft-color" type="color" value="' + (wt.color || '#3b82f6') + '"></td>'; }, foot: '<td></td>' });
    cols.push({ h: tr('Tipo'), body: function (wt, m, warn) { return '<td class="ftt-name">' + esc(wt.name) + warn + '</td>'; }, foot: '<td><b>' + tr('Total') + '</b></td>' });
    cols.push({ h: tr('Pisos'), body: function (wt, m) { return '<td class="ftt-fl">' + esc(Object.keys(m.floors).join(', ')) + '</td>'; }, foot: '<td></td>' });
    cols.push({ h: 'LF', n: 1, body: function (wt, m) { return '<td class="num">' + m.totalLF.toFixed(1) + '</td>'; }, foot: '<td class="num"><b>' + T.lf.toFixed(1) + '</b></td>' });
    cols.push({ h: 'SF', n: 1, body: function (wt, m) { return '<td class="num">' + m.wallSf.toFixed(0) + '</td>'; }, foot: '<td class="num"><b>' + T.sf.toFixed(0) + '</b></td>' });
    if (sc.framing) {
      cols.push({ h: tr('Studs'), n: 1, sc: 'framing', body: function (wt, m) { return '<td class="num">' + m.totalStuds + '</td>'; }, foot: '<td class="num"><b>' + T.studs + '</b></td>' });
      cols.push({ h: 'Plate/Track LF', n: 1, sc: 'framing', body: function (wt, m) { return '<td class="num">' + m.totalHorizLF.toFixed(0) + '</td>'; }, foot: '<td class="num"><b>' + T.horiz.toFixed(0) + '</b></td>' });
      cols.push({ h: tr('Vergas') + ' LF', n: 1, sc: 'framing', body: function (wt, m) { return '<td class="num">' + m.headersLF.toFixed(0) + '</td>'; }, foot: '<td class="num"><b>' + T.header.toFixed(0) + '</b></td>' });
    }
    if (sc.drywall) {
      cols.push({ h: 'Drywall SF', n: 1, sc: 'drywall', body: function (wt, m) { return '<td class="num">' + m.drywallSf.toFixed(0) + '</td>'; }, foot: '<td class="num"><b>' + T.dwsf.toFixed(0) + '</b></td>' });
      cols.push({ h: tr('Chapas'), n: 1, sc: 'drywall', body: function (wt, m) { return '<td class="num">' + m.drywallSheets + '</td>'; }, foot: '<td class="num"><b>' + T.sheets + '</b></td>' });
    }
    if (sc.insulation) {
      cols.push({ h: 'Insul SF', n: 1, sc: 'insulation', body: function (wt, m) { return '<td class="num">' + m.insulationSf.toFixed(0) + '</td>'; }, foot: '<td class="num"><b>' + T.insul.toFixed(0) + '</b></td>' });
    }
    cols.push({ h: tr('Material') + ' $', n: 1, body: function (wt, m) { return '<td class="num ftt-mat">' + money(priceParts(m).mat) + '</td>'; }, foot: '<td class="num ftt-mat"><b>' + money(T.mat) + '</b></td>' });
    cols.push({ h: tr('M.O.') + ' $', n: 1, body: function (wt, m) { return '<td class="num ftt-lab">' + money(priceParts(m).lab) + '</td>'; }, foot: '<td class="num ftt-lab"><b>' + money(T.lab) + '</b></td>' });
    cols.push({ h: tr('Total') + ' $', n: 1, body: function (wt, m) { return '<td class="num ftt-tot">' + money(priceParts(m).total) + '</td>'; }, foot: '<td class="num ftt-tot"><b>' + money(T.price) + '</b></td>' });
    cols.push({ h: '', body: function (wt, m) { return '<td class="ftt-acts"><button class="ftt-editbtn" data-wt="' + wt.id + '" title="' + tr('Editar tipo / completar especificação') + '">✎</button><button class="ftt-dup" data-wt="' + wt.id + '" title="' + tr('Duplicar (outro piso)') + '">⧉</button></td>'; }, foot: '<td></td>' });

    var flagged = FR.wallTypes.map(function (wt) { return { wt: wt, reasons: wallTypeReview(wt) }; }).filter(function (x) { return x.reasons.length; });
    var confHTML = '';
    if (flagged.length) {
      confHTML = '<div class="ftt-conf"><b>⚠️ ' + tr('Conferência') + ' (' + flagged.length + '):</b> '
        + flagged.map(function (x) {
          var mat = (x.wt.materialConfirmed === false) ? ' <button class="ft-mat" data-wt="' + x.wt.id + '" data-mat="wood">Wood</button><button class="ft-mat" data-wt="' + x.wt.id + '" data-mat="metal">Metal</button>' : '';
          return '<span class="ftt-cflag"><button class="ftt-warn ftt-cedit" data-wt="' + x.wt.id + '" title="' + tr('Editar p/ resolver') + '">✎ ' + esc('Tipo ' + (x.wt.typeId || '')) + '</button>: ' + x.reasons.map(esc).join(', ') + mat + ' <button class="ft-conf" data-wt="' + x.wt.id + '" title="OK">✓</button></span>';
        }).join('') + ' <button id="ftConfAll" class="ft-confall">✓ ' + tr('todos') + '</button></div>';
    }

    var body = rows.length ? rows.map(function (x) {
      var wt = x.wt, m = x.m, act = (wt.id === FR.activeWT);
      var warn = wallTypeReview(wt).length ? ' <span class="ftt-warn" data-wt="' + wt.id + '" title="' + tr('Editar p/ resolver') + '">⚠️</span>' : '';
      var tr1 = '<tr class="ftt-row' + (act ? ' is-active' : '') + '" data-wt="' + wt.id + '" title="' + esc((wt.components || []).join(' · ')) + '">'
        + cols.map(function (c) { return c.body(wt, m, warn); }).join('') + '</tr>';
      if (FR._editWT === wt.id) tr1 += '<tr class="ftt-editrow"><td colspan="' + cols.length + '">' + editorHTML(wt) + '</td></tr>';
      return tr1;
    }).join('') : ('<tr><td colspan="' + cols.length + '" style="text-align:center;color:#8b887f;padding:18px">' + tr('Trace paredes (📐 Linear) e atribua um tipo para o takeoff aparecer aqui.') + '</td></tr>');

    // MATERIAL por item
    var pinM = function (id, k, lb) { return '<span class="ftt-pritem"><span class="ftt-prlb">' + lb + '</span><input id="' + id + '" class="ftt-prmat" type="number" min="0" step="0.01" value="' + (FR.prices[k] || '') + '"></span>'; };
    // MÃO DE OBRA por ofício (por SF)
    var pinL = function (id, k, lb) { return '<span class="ftt-pritem"><span class="ftt-prlb">' + lb + '</span><input id="' + id + '" class="ftt-prlab" type="number" min="0" step="0.01" value="' + (FR.labor[k] || '') + '"></span>'; };
    var matHTML = '<span class="ftt-prhint">' + tr('Material $:') + '</span>';
    if (sc.framing) matHTML += pinM('ftPrStud', 'stud', tr('Stud')) + pinM('ftPrPlate', 'plateLF', 'Plate/LF') + pinM('ftPrHeader', 'headerLF', tr('Verga/LF'));
    if (sc.drywall) matHTML += pinM('ftPrSheet', 'sheet', tr('Chapa'));
    if (sc.insulation) matHTML += pinM('ftPrInsul', 'insulSf', 'Insul/SF');
    var labHTML = '<span class="ftt-prhint ftt-prhint-lab">' + tr('M.O. $/SF:') + '</span>';
    if (sc.framing) labHTML += pinL('ftLbFraming', 'framing', '🏗️ Framing');
    if (sc.drywall) labHTML += pinL('ftLbDrywall', 'drywall', '🧱 Drywall');
    if (sc.insulation) labHTML += pinL('ftLbInsul', 'insulation', '🧊 Insulation');
    var prHTML = '<span class="ftt-prgrp">' + matHTML + '</span><span class="ftt-prgrp ftt-prgrp-lab">' + labHTML + '</span>';
    var scopeChips = [['framing', '🏗️ Framing'], ['drywall', '🧱 Drywall'], ['insulation', '🧊 Insulation']]
      .map(function (s) { return '<button class="ftt-scope' + (sc[s[0]] ? ' on' : '') + '" data-scope="' + s[0] + '">' + s[1] + '</button>'; }).join('');

    ov.innerHTML =
      '<div class="ftt-grip" title="' + tr('Arraste para aumentar/diminuir a tabela') + '"></div>'
      + '<div class="ftt-top"><span>🏗️ ' + tr('Takeoff de Framing') + '</span>'
      + '<span class="ftt-scopes" title="' + tr('Escopo da obra — quais ofícios o takeoff cobre') + '">' + scopeChips + '</span>'
      + '<span class="ftt-pr">' + prHTML + '</span>'
      + '<button id="ftClose" class="ft-x">✕</button></div>'
      + confHTML
      + '<div class="ftt-tablewrap"><table class="ftt-table"><thead><tr>'
      + cols.map(function (c) { return '<th' + (c.n ? ' class="num"' : '') + '>' + c.h + '</th>'; }).join('') + '</tr></thead>'
      + '<tbody>' + body + '</tbody>'
      + '<tfoot><tr>' + cols.map(function (c) { return c.foot; }).join('') + '</tr></tfoot>'
      + '</table></div>';

    ov.querySelectorAll('.ftt-scope').forEach(function (b) { b.addEventListener('click', function () { F.framingToggleScope(b.getAttribute('data-scope')); if (F._syncScope) F._syncScope(); renderFramingTakeoff(ov); }); });
    ov.querySelector('#ftClose').addEventListener('click', function () { ov.style.display = 'none'; });

    // ALÇA: arrastar p/ aumentar/diminuir a tabela
    var grip = ov.querySelector('.ftt-grip');
    if (grip) grip.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var startY = e.clientY, startH = ov.offsetHeight;
      document.body.style.userSelect = 'none';
      function mv(ev) { var h = startH + (startY - ev.clientY); h = Math.max(140, Math.min((window.innerHeight || 800) - 90, h)); ov.style.height = h + 'px'; FR._takeoffH = h; }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect = ''; }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });

    // EDITAR tipo (✎ ou ⚠️) — abre/fecha a linha-editor
    function openEdit(id) { FR._editWT = (FR._editWT === id) ? null : id; if (FR._editWT) FR.activeWT = id; renderFramingTakeoff(ov); }
    ov.querySelectorAll('.ftt-editbtn').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); openEdit(b.getAttribute('data-wt')); }); });
    ov.querySelectorAll('.ftt-warn').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); openEdit(b.getAttribute('data-wt')); }); });

    // campos do editor inline
    var ew = wtById(FR._editWT);
    if (ew) {
      var save = function () { if (F._wsRedraw) F._wsRedraw(); if (F._syncWallTypeSelect) F._syncWallTypeSelect(); persistFraming(); renderFramingTakeoff(ov); };
      var bind = function (selr, fn) { var el = ov.querySelector(selr); if (el) el.addEventListener('change', function () { fn(el.value); save(); }); };
      bind('.fe-name', function (v) { ew.name = v || ew.name; });
      bind('.fe-mat', function (v) { ew.material = v; ew.materialConfirmed = true; });
      bind('.fe-size', function (v) { ew.studSize = v; });
      bind('.fe-sp', function (v) { ew.spacing = num(v) || ew.spacing; });
      bind('.fe-pl', function (v) { ew.plates = num(v); });
      bind('.fe-sh', function (v) { ew.sheathSides = Math.max(0, Math.min(2, parseInt(v, 10) || 0)); });
      bind('.fe-ins', function (v) { ew.insulation = v; });
      bind('.fe-comp', function (v) { ew.components = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); });
      var ok = ov.querySelector('.fe-ok'); if (ok) ok.addEventListener('click', function () { ew.specConfirmed = true; save(); });
      var cl = ov.querySelector('.fe-close'); if (cl) cl.addEventListener('click', function () { FR._editWT = null; renderFramingTakeoff(ov); });
    }
    ov.querySelectorAll('.ftt-row').forEach(function (row) {
      var wid = row.getAttribute('data-wt');
      row.addEventListener('click', function (e) { if (e.target && (e.target.tagName === 'INPUT' || e.target.classList.contains('ftt-dup'))) return; FR.activeWT = wid; if (F._syncWallTypeSelect) F._syncWallTypeSelect(); if (F._wsRedraw) F._wsRedraw(); renderFramingTakeoff(ov); persistFraming(); });
      var ci = row.querySelector('input.ft-color'); if (ci) ci.addEventListener('input', function (e) { var wt = wtById(wid); if (wt) { wt.color = e.target.value; if (F._wsRedraw) F._wsRedraw(); renderFramingTakeoff(ov); persistFraming(); } });
    });
    ov.querySelectorAll('.ftt-dup').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); cloneWallType(b.getAttribute('data-wt')); if (F._syncWallTypeSelect) F._syncWallTypeSelect(); renderFramingTakeoff(ov); }); });
    [['ftPrStud', 'stud'], ['ftPrPlate', 'plateLF'], ['ftPrSheet', 'sheet'], ['ftPrHeader', 'headerLF'], ['ftPrInsul', 'insulSf']].forEach(function (pr) {
      var inp = ov.querySelector('#' + pr[0]); if (inp) inp.addEventListener('change', function () { FR.prices[pr[1]] = num(inp.value); renderFramingTakeoff(ov); persistFraming(); });
    });
    [['ftLbFraming', 'framing'], ['ftLbDrywall', 'drywall'], ['ftLbInsul', 'insulation']].forEach(function (pr) {
      var inp = ov.querySelector('#' + pr[0]); if (inp) inp.addEventListener('change', function () { FR.labor[pr[1]] = num(inp.value); renderFramingTakeoff(ov); persistFraming(); });
    });
    ov.querySelectorAll('.ft-mat').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); var w = wtById(b.getAttribute('data-wt')); if (w) { w.material = b.getAttribute('data-mat'); w.materialConfirmed = true; if (F._wsRedraw) F._wsRedraw(); if (F._syncWallTypeSelect) F._syncWallTypeSelect(); renderFramingTakeoff(ov); persistFraming(); } }); });
    ov.querySelectorAll('.ft-conf').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); var w = wtById(b.getAttribute('data-wt')); if (w) { w.specConfirmed = true; if (F._syncWallTypeSelect) F._syncWallTypeSelect(); renderFramingTakeoff(ov); persistFraming(); } }); });
    { var ca = ov.querySelector('#ftConfAll'); if (ca) ca.addEventListener('click', function () { FR.wallTypes.forEach(function (w) { w.specConfirmed = true; }); if (F._syncWallTypeSelect) F._syncWallTypeSelect(); renderFramingTakeoff(ov); persistFraming(); }); }
  }

  /* =======================================================================
     CANVAS (Fase 2) — abre PDF/imagem, pan/zoom, calibra, traça parede
     ===================================================================== */
  var CV = {
    cv: null, ctx: null, img: null,            // img = canvas offscreen com a página
    pdf: null, page: 1, pages: 1,
    scale: 1, ox: 0, oy: 0,                     // view (tela = img*scale + o)
    tool: 'pan',                                // 'pan' | 'cal' | 'wall'
    drawWT: null,                               // tipo atual p/ traçar
    pts: [],                                    // polilinha em construção (img coords)
    calA: null,                                 // 1º ponto da calibração
    panning: false, panSX: 0, panSY: 0, panOX: 0, panOY: 0,
    mouse: null
  };

  function resizeCanvas() {
    var cv = CV.cv; if (!cv) return;
    var wrap = cv.parentElement; if (!wrap) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    CV.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function fit() {
    var cv = CV.cv, im = CV.img; if (!cv || !im) return;
    var dpr = window.devicePixelRatio || 1, w = cv.width / dpr, h = cv.height / dpr;
    CV.scale = Math.min(w / im.width, h / im.height) * 0.96;
    CV.ox = (w - im.width * CV.scale) / 2;
    CV.oy = (h - im.height * CV.scale) / 2;
  }
  function S2I(sx, sy) { return { x: (sx - CV.ox) / CV.scale, y: (sy - CV.oy) / CV.scale }; }
  function I2S(p) { return { x: p.x * CV.scale + CV.ox, y: p.y * CV.scale + CV.oy }; }
  function pathLenPx(path) { var d = 0; for (var i = 1; i < path.length; i++) { var dx = path[i].x - path[i - 1].x, dy = path[i].y - path[i - 1].y; d += Math.sqrt(dx * dx + dy * dy); } return d; }

  function draw() {
    var ctx = CV.ctx, cv = CV.cv; if (!ctx) return;
    var dpr = window.devicePixelRatio || 1, w = cv.width / dpr, h = cv.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f0e0b'; ctx.fillRect(0, 0, w, h);
    if (CV.img) ctx.drawImage(CV.img, CV.ox, CV.oy, CV.img.width * CV.scale, CV.img.height * CV.scale);
    else {
      ctx.fillStyle = '#6b675d'; ctx.font = '14px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(tr('Abra a planta (PDF ou imagem) para começar a marcar.'), w / 2, h / 2);
      return;
    }
    // segmentos traçados
    FR.segments.forEach(function (s) {
      if (!s.path || s.path.length < 2) return;
      var wt = wtById(s.wtId), col = (wt && wt.color) || '#22d3ee';
      ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      s.path.forEach(function (p, i) { var q = I2S(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      ctx.stroke();
      // rótulo de LF no meio
      var mid = I2S(s.path[Math.floor(s.path.length / 2)]);
      var lab = num(s.len).toFixed(1) + ' LF';
      ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'left';
      var tw = ctx.measureText(lab).width;
      ctx.fillStyle = 'rgba(15,14,11,.85)'; ctx.fillRect(mid.x + 6, mid.y - 16, tw + 8, 15);
      ctx.fillStyle = col; ctx.fillText(lab, mid.x + 10, mid.y - 4);
    });
    // polilinha em construção
    if (CV.tool === 'wall' && CV.pts.length) {
      var wt2 = CV.drawWT && wtById(CV.drawWT), col2 = (wt2 && wt2.color) || '#fde047';
      ctx.lineWidth = 3; ctx.strokeStyle = col2; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      CV.pts.forEach(function (p, i) { var q = I2S(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      if (CV.mouse) ctx.lineTo(CV.mouse.x, CV.mouse.y);
      ctx.stroke(); ctx.setLineDash([]);
      CV.pts.forEach(function (p) { var q = I2S(p); ctx.fillStyle = col2; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 7); ctx.fill(); });
      if (FR.pxPerFt && CV.mouse) {
        var prev = I2S(CV.pts[CV.pts.length - 1]);
        var dpx = Math.sqrt(Math.pow(CV.mouse.x - prev.x, 2) + Math.pow(CV.mouse.y - prev.y, 2)) / CV.scale;
        var ft = (pathLenPx(CV.pts) + dpx) / FR.pxPerFt;
        ctx.fillStyle = '#fde047'; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(ft.toFixed(1) + ' LF', CV.mouse.x + 10, CV.mouse.y - 8);
      }
    }
    // calibração em construção
    if (CV.tool === 'cal' && CV.calA && CV.mouse) {
      ctx.lineWidth = 2; ctx.strokeStyle = '#fbbf24'; ctx.setLineDash([5, 3]);
      var a = I2S(CV.calA);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(CV.mouse.x, CV.mouse.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ---- carregar planta ----
  function setImageFromCanvas(c) { CV.img = c; fit(); draw(); }
  async function loadPDF(arrbuf) {
    if (!window.pdfjsLib) { alert(tr('Visualizador de PDF não carregou. Tente novamente.')); return; }
    try {
      CV.pdf = await pdfjsLib.getDocument({ data: arrbuf }).promise;
      CV.pages = CV.pdf.numPages; CV.page = 1;
      await renderPdfPage();
    } catch (e) { alert(tr('Não foi possível abrir o PDF.')); }
  }
  async function renderPdfPage() {
    if (!CV.pdf) return;
    var page = await CV.pdf.getPage(CV.page);
    var vp = page.getViewport({ scale: 2 });
    var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    setImageFromCanvas(c);
    var pg = document.getElementById('frPageInfo'); if (pg) pg.textContent = CV.page + '/' + CV.pages;
  }
  function loadImageFile(file) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0); URL.revokeObjectURL(url);
      CV.pdf = null; CV.pages = 1; CV.page = 1; setImageFromCanvas(c);
      var pg = document.getElementById('frPageInfo'); if (pg) pg.textContent = '1/1';
    };
    im.src = url;
  }
  function openPlan() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,image/*';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (/pdf$/i.test(f.name) || f.type === 'application/pdf') { f.arrayBuffer().then(loadPDF); }
      else { loadImageFile(f); }
    });
    inp.click();
  }

  // ---- interação ----
  function setTool(t) {
    CV.tool = t; CV.pts = []; CV.calA = null;
    ['frToolPan', 'frToolCal', 'frToolWall'].forEach(function (id) {
      var b = document.getElementById(id); if (b) b.classList.remove('ws-tool-active');
    });
    var map = { pan: 'frToolPan', cal: 'frToolCal', wall: 'frToolWall' };
    var act = document.getElementById(map[t]); if (act) act.classList.add('ws-tool-active');
    var cv = CV.cv; if (cv) cv.style.cursor = (t === 'pan') ? 'grab' : 'crosshair';
    draw();
  }
  function finishWall() {
    // remove ponto(s) duplicado(s) no fim (ex.: 2º clique de um duplo-clique)
    while (CV.pts.length >= 2) {
      var a = CV.pts[CV.pts.length - 1], b = CV.pts[CV.pts.length - 2];
      if (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) CV.pts.pop(); else break;
    }
    if (CV.pts.length >= 2) {
      if (!FR.pxPerFt) { alert(tr('Calibre a escala primeiro (📏).')); CV.pts = []; draw(); return; }
      var lenFt = pathLenPx(CV.pts) / FR.pxPerFt;
      FR.segments.push({ id: uid('sg'), wtId: CV.drawWT || (FR.wallTypes[0] || {}).id, len: Math.round(lenFt * 10) / 10, qty: 1, path: CV.pts.slice(), source: 'draw' });
      renderSegs(); renderMaterials(); renderLegend();
    }
    CV.pts = []; draw();
  }
  function bindCanvas() {
    var cv = CV.cv;
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      var before = S2I(sx, sy), f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      CV.scale *= f;
      CV.ox = sx - before.x * CV.scale; CV.oy = sy - before.y * CV.scale;
      draw();
    }, { passive: false });
    cv.addEventListener('mousedown', function (e) {
      var r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (CV.tool === 'pan' || e.button === 1 || e.button === 2) {
        CV.panning = true; CV.panSX = sx; CV.panSY = sy; CV.panOX = CV.ox; CV.panOY = CV.oy; cv.style.cursor = 'grabbing'; return;
      }
      if (!CV.img) return;
      var ip = S2I(sx, sy);
      if (CV.tool === 'cal') {
        if (!CV.calA) { CV.calA = ip; }
        else {
          var dpx = Math.sqrt(Math.pow(ip.x - CV.calA.x, 2) + Math.pow(ip.y - CV.calA.y, 2));
          var v = prompt(tr('Comprimento real desta linha, em pés (ex.: 10):'), '10');
          var ft = num(v); if (ft > 0 && dpx > 2) { FR.pxPerFt = dpx / ft; updateScaleBadge(); }
          CV.calA = null; setTool('wall');
        }
      } else if (CV.tool === 'wall') {
        CV.pts.push(ip);
      }
      draw();
    });
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      CV.mouse = { x: sx, y: sy };
      if (CV.panning) { CV.ox = CV.panOX + (sx - CV.panSX); CV.oy = CV.panOY + (sy - CV.panSY); }
      if (CV.panning || CV.tool === 'wall' || CV.tool === 'cal') draw();
    });
    window.addEventListener('mouseup', function () { if (CV.panning) { CV.panning = false; if (CV.cv) CV.cv.style.cursor = (CV.tool === 'pan' ? 'grab' : 'crosshair'); } });
    cv.addEventListener('dblclick', function (e) { e.preventDefault(); if (CV.tool === 'wall') finishWall(); });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', function (e) {
      if (document.getElementById('framingScreen').classList.contains('hidden')) return;
      if (CV.tool === 'wall' && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); finishWall(); }   // Esc/Enter = finaliza a parede
      else if (CV.tool === 'wall' && e.key === 'Backspace' && CV.pts.length) { e.preventDefault(); CV.pts.pop(); draw(); }  // desfaz último ponto
      else if (e.key === 'Escape') { CV.calA = null; draw(); }
    });
  }
  function updateScaleBadge() {
    var b = document.getElementById('frScale'); if (!b) return;
    b.textContent = FR.pxPerFt ? ('✓ ' + tr('escala calibrada')) : tr('escala não calibrada');
    b.className = 'text-xs px-2 py-0.5 rounded ' + (FR.pxPerFt ? 'bg-emerald-600 text-white' : 'bg-steel-600 text-steel-200');
  }

  /* =======================================================================
     UI / TELA
     ===================================================================== */
  F.openFraming = function () { build(); var sc = document.getElementById('framingScreen'); if (sc) { sc.classList.remove('hidden'); requestAnimationFrame(function () { resizeCanvas(); renderAll(); }); } };
  function closeFraming() { var sc = document.getElementById('framingScreen'); if (sc) sc.classList.add('hidden'); }

  function build() {
    if (FR.built) return;
    var sc = document.getElementById('framingScreen'); if (!sc) return;
    sc.innerHTML =
      '<header class="flex items-center gap-3 px-4 py-2.5 bg-steel-800 text-white shrink-0">'
      + '  <button id="frBack" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-white/10"><span class="text-lg">←</span><span>' + tr('Voltar') + '</span></button>'
      + '  <div class="font-bold">🏗️ ' + tr('Takeoff de Framing') + ' <span class="text-steel-300 font-normal text-sm">(Metal &amp; Wood)</span></div>'
      // toolbar
      + '  <div class="ml-4 flex items-center gap-1">'
      + '    <button id="frOpenPlan" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-steel-600 hover:bg-steel-500">📄 ' + tr('Abrir planta') + '</button>'
      + '    <div class="flex items-center gap-1 ml-1"><button id="frPrev" class="px-2 py-1.5 rounded hover:bg-white/10">◀</button><span id="frPageInfo" class="text-xs text-steel-300 w-10 text-center">—</span><button id="frNext" class="px-2 py-1.5 rounded hover:bg-white/10">▶</button></div>'
      + '    <span class="w-px h-5 bg-white/15 mx-1"></span>'
      + '    <button id="frToolPan"  class="wsBarTool px-2.5 py-1.5 rounded hover:bg-white/10" title="' + tr('Mover') + '">✋</button>'
      + '    <button id="frToolCal"  class="wsBarTool px-2.5 py-1.5 rounded hover:bg-white/10" title="' + tr('Calibrar escala') + '">📏</button>'
      + '    <button id="frToolWall" class="wsBarTool px-2.5 py-1.5 rounded hover:bg-white/10 inline-flex items-center gap-1" title="' + tr('Linear — traçar parede (clique p/ mudar de direção, Esc finaliza)') + '">📐<span class="text-xs font-semibold">' + tr('Linear') + '</span></button>'
      + '    <select id="frToolWT" class="text-steel-900 text-sm rounded px-2 py-1"></select>'
      + '  </div>'
      + '  <span id="frScale" class="ml-auto text-xs px-2 py-0.5 rounded bg-steel-600 text-steel-200">' + tr('escala não calibrada') + '</span>'
      + '</header>'
      + '<div class="flex-1 min-h-0 grid" style="grid-template-columns: 280px 1fr 300px">'
      // ----- col 1: tipos + trechos -----
      + '  <aside class="min-h-0 overflow-y-auto border-r border-steel-200 bg-white p-3">'
      + '    <div class="flex items-center justify-between mb-2"><h3 class="font-bold text-steel-800">' + tr('Tipos de parede') + '</h3><button id="frAddWT" class="text-xs font-semibold px-2 py-1 rounded bg-steel-100 hover:bg-steel-200">+ ' + tr('Novo') + '</button></div>'
      + '    <div id="frWTList" class="space-y-2 mb-5"></div>'
      + '    <div class="flex items-center justify-between mb-2"><h3 class="font-bold text-steel-800">' + tr('Trechos') + '</h3><button id="frAddSeg" class="text-xs font-semibold px-2 py-1 rounded bg-steel-100 hover:bg-steel-200">+ ' + tr('Manual') + '</button></div>'
      + '    <div class="bg-white rounded-lg border border-steel-200 overflow-hidden mb-5"><table class="w-full text-xs"><thead class="bg-steel-100 text-steel-500"><tr><th class="text-left px-2 py-1.5">' + tr('Tipo') + '</th><th class="px-2 py-1.5 w-20">' + tr('LF') + '</th><th class="px-1 py-1.5 w-12">' + tr('Qtd') + '</th><th class="w-7"></th></tr></thead><tbody id="frSegBody"></tbody></table></div>'
      + '    <div class="flex items-center justify-between mb-2"><h3 class="font-bold text-steel-800">' + tr('Aberturas') + '</h3><button id="frAddOpen" class="text-xs font-semibold px-2 py-1 rounded bg-steel-100 hover:bg-steel-200">+</button></div>'
      + '    <div class="bg-white rounded-lg border border-steel-200 overflow-hidden"><table class="w-full text-xs"><thead class="bg-steel-100 text-steel-500"><tr><th class="text-left px-2 py-1.5">' + tr('Tipo') + '</th><th class="px-2 py-1.5 w-20">' + tr('Larg.(ft)') + '</th><th class="px-1 py-1.5 w-12">' + tr('Qtd') + '</th><th class="w-7"></th></tr></thead><tbody id="frOpenBody"></tbody></table></div>'
      + '  </aside>'
      // ----- col 2: canvas -----
      + '  <main class="min-h-0 relative bg-steel-900">'
      + '    <canvas id="frCanvas" class="block w-full h-full" style="cursor:grab"></canvas>'
      + '    <div id="frLegend" class="absolute top-3 left-3 bg-black/65 text-white rounded-lg px-3 py-2 text-xs space-y-1 pointer-events-none"></div>'
      + '    <div class="absolute bottom-3 left-3 bg-black/55 text-steel-200 rounded px-2 py-1 text-[11px] pointer-events-none">' + tr('Calibre (📏) → Traçe a parede (🧱): clique pra mudar de direção · Esc/Enter finaliza · Backspace desfaz ponto · roda = zoom.') + '</div>'
      + '  </main>'
      // ----- col 3: materiais -----
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

    CV.cv = sc.querySelector('#frCanvas'); CV.ctx = CV.cv.getContext('2d');
    CV.drawWT = (FR.wallTypes[0] || {}).id;
    bindCanvas();
    if (window.ResizeObserver) { new ResizeObserver(resizeCanvas).observe(CV.cv.parentElement); }
    window.addEventListener('resize', resizeCanvas);

    sc.querySelector('#frBack').addEventListener('click', closeFraming);
    sc.querySelector('#frOpenPlan').addEventListener('click', openPlan);
    sc.querySelector('#frPrev').addEventListener('click', function () { if (CV.pdf && CV.page > 1) { CV.page--; renderPdfPage(); } });
    sc.querySelector('#frNext').addEventListener('click', function () { if (CV.pdf && CV.page < CV.pages) { CV.page++; renderPdfPage(); } });
    sc.querySelector('#frToolPan').addEventListener('click', function () { setTool('pan'); });
    sc.querySelector('#frToolCal').addEventListener('click', function () { setTool('cal'); });
    sc.querySelector('#frToolWall').addEventListener('click', function () { setTool('wall'); });
    sc.querySelector('#frToolWT').addEventListener('change', function (e) { CV.drawWT = e.target.value; });
    sc.querySelector('#frAddWT').addEventListener('click', function () {
      FR.wallTypes.push({ id: uid('wt'), name: tr('Nova parede'), material: 'metal', studSize: '3-5/8" 20ga', spacing: 16, height: 9, plates: 2, bracingRows: 1, sheathSides: 1, color: COLORS[FR.wallTypes.length % COLORS.length] });
      renderWTs(); refreshToolWT();
    });
    sc.querySelector('#frAddSeg').addEventListener('click', function () { FR.segments.push({ id: uid('sg'), wtId: (FR.wallTypes[0] || {}).id, len: '', qty: 1, source: 'manual' }); renderSegs(); });
    sc.querySelector('#frAddOpen').addEventListener('click', function () { FR.openings.push({ id: uid('op'), wtId: (FR.wallTypes[0] || {}).id, width: '', qty: 1 }); renderOpens(); });
    ['frPrStud:stud', 'frPrPlate:plateLF', 'frPrSheet:sheet', 'frPrHeader:headerLF'].forEach(function (pair) {
      var p = pair.split(':'), inp = sc.querySelector('#' + p[0]);
      if (inp) { inp.value = FR.prices[p[1]] || ''; inp.addEventListener('input', function () { FR.prices[p[1]] = num(inp.value); renderMaterials(); }); }
    });
    FR.built = true;
    setTool('pan'); updateScaleBadge();
  }

  var wtOptions = function (sel) { return FR.wallTypes.map(function (wt) { return '<option value="' + wt.id + '"' + (wt.id === sel ? ' selected' : '') + '>' + esc(wt.name) + '</option>'; }).join(''); };
  function refreshToolWT() { var s = document.getElementById('frToolWT'); if (s) { var cur = CV.drawWT; s.innerHTML = wtOptions(cur); if (!wtById(cur) && FR.wallTypes[0]) CV.drawWT = FR.wallTypes[0].id; } }
  function refreshSelects() { document.querySelectorAll('#frSegBody .frSegWT, #frOpenBody .frOpenWT').forEach(function (sel) { sel.innerHTML = wtOptions(sel.value); }); refreshToolWT(); }

  function renderWTs() {
    var box = document.getElementById('frWTList'); if (!box) return;
    box.innerHTML = FR.wallTypes.map(function (wt) {
      return '<div class="rounded-lg border border-steel-200 p-2.5" data-wt="' + wt.id + '">'
        + '<div class="flex items-center gap-1.5 mb-1.5"><input class="frWTColor" type="color" value="' + (wt.color || '#3b82f6') + '" style="width:22px;height:22px;border:0;background:none;padding:0;cursor:pointer">'
        + '<input class="frWTName flex-1 font-semibold text-steel-800 text-sm px-1 py-0.5 rounded border border-transparent hover:border-steel-200 focus:border-steel-300 outline-none" value="' + esc(wt.name) + '">'
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
      on('.frWTColor', 'input', function (e) { wt.color = e.target.value; draw(); renderLegend(); });
      on('.frWTName', 'input', function (e) { wt.name = e.target.value; refreshSelects(); renderLegend(); });
      on('.frWTMat', 'change', function (e) { wt.material = e.target.value; wt.plates = (wt.material === 'wood' ? 3 : 2); renderWTs(); renderMaterials(); });
      on('.frWTSize', 'input', function (e) { wt.studSize = e.target.value; renderMaterials(); });
      on('.frWTSpace', 'change', function (e) { wt.spacing = num(e.target.value, 16); renderMaterials(); });
      on('.frWTH', 'input', function (e) { wt.height = num(e.target.value, 9); renderMaterials(); });
      on('.frWTPlates', 'input', function (e) { wt.plates = num(e.target.value, 2); renderMaterials(); });
      on('.frWTBrace', 'input', function (e) { wt.bracingRows = num(e.target.value, 0); renderMaterials(); });
      on('.frWTSheath', 'change', function (e) { wt.sheathSides = num(e.target.value, 0); renderMaterials(); });
      on('.frWTDel', 'click', function () { FR.wallTypes = FR.wallTypes.filter(function (w) { return w.id !== id; }); renderWTs(); refreshSelects(); renderMaterials(); draw(); renderLegend(); });
    });
    renderLegend();
  }

  function renderLegend() {
    var box = document.getElementById('frLegend'); if (!box) return;
    var used = {}; FR.segments.forEach(function (s) { if (s.path) used[s.wtId] = true; });
    var list = FR.wallTypes.filter(function (wt) { return used[wt.id]; });
    if (!list.length) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = '<div class="font-semibold mb-1">' + tr('Legenda') + '</div>' + list.map(function (wt) {
      return '<div class="flex items-center gap-2"><span style="width:12px;height:12px;border-radius:3px;background:' + wt.color + ';display:inline-block"></span>' + esc(wt.name) + '</div>';
    }).join('');
  }

  function renderSegs() {
    var body = document.getElementById('frSegBody'); if (!body) return;
    body.innerHTML = FR.segments.map(function (s) {
      var dot = s.source === 'draw' ? '<span style="width:8px;height:8px;border-radius:50%;background:' + ((wtById(s.wtId) || {}).color || '#999') + ';display:inline-block;margin-right:4px"></span>' : '';
      return '<tr class="border-t border-steel-100" data-sg="' + s.id + '">'
        + '<td class="px-2 py-1">' + dot + '<select class="frSegWT rounded border border-steel-200 px-1 py-0.5 text-xs" style="max-width:120px">' + wtOptions(s.wtId) + '</select></td>'
        + '<td class="px-2 py-1"><input class="frSegLen w-full rounded border border-steel-200 px-1 py-0.5 text-right" type="number" min="0" step="0.1" value="' + (s.len === '' ? '' : s.len) + '"></td>'
        + '<td class="px-1 py-1"><input class="frSegQty w-full rounded border border-steel-200 px-1 py-0.5 text-right" type="number" min="1" step="1" value="' + s.qty + '"></td>'
        + '<td class="px-1 text-center"><button class="frSegDel text-steel-400 hover:text-rose-500">✕</button></td></tr>';
    }).join('') || ('<tr><td colspan="4" class="px-2 py-3 text-steel-400 text-center">' + tr('Traçe paredes na planta ou adicione manual.') + '</td></tr>');
    body.querySelectorAll('[data-sg]').forEach(function (row) {
      var id = row.getAttribute('data-sg'), s = FR.segments.filter(function (x) { return x.id === id; })[0]; if (!s) return;
      row.querySelector('.frSegWT').addEventListener('change', function (e) { s.wtId = e.target.value; renderMaterials(); draw(); renderLegend(); });
      row.querySelector('.frSegLen').addEventListener('input', function (e) { s.len = num(e.target.value); renderMaterials(); draw(); });
      row.querySelector('.frSegQty').addEventListener('input', function (e) { s.qty = num(e.target.value, 1); renderMaterials(); });
      row.querySelector('.frSegDel').addEventListener('click', function () { FR.segments = FR.segments.filter(function (x) { return x.id !== id; }); renderSegs(); renderMaterials(); draw(); renderLegend(); });
    });
  }

  function renderOpens() {
    var body = document.getElementById('frOpenBody'); if (!body) return;
    body.innerHTML = FR.openings.map(function (o) {
      return '<tr class="border-t border-steel-100" data-op="' + o.id + '">'
        + '<td class="px-2 py-1"><select class="frOpenWT rounded border border-steel-200 px-1 py-0.5 text-xs" style="max-width:120px">' + wtOptions(o.wtId) + '</select></td>'
        + '<td class="px-2 py-1"><input class="frOpenW w-full rounded border border-steel-200 px-1 py-0.5 text-right" type="number" min="0" step="0.1" value="' + (o.width === '' ? '' : o.width) + '"></td>'
        + '<td class="px-1 py-1"><input class="frOpenQty w-full rounded border border-steel-200 px-1 py-0.5 text-right" type="number" min="1" step="1" value="' + o.qty + '"></td>'
        + '<td class="px-1 text-center"><button class="frOpenDel text-steel-400 hover:text-rose-500">✕</button></td></tr>';
    }).join('') || ('<tr><td colspan="4" class="px-2 py-3 text-steel-400 text-center">' + tr('Opcional.') + '</td></tr>');
    body.querySelectorAll('[data-op]').forEach(function (row) {
      var id = row.getAttribute('data-op'), o = FR.openings.filter(function (x) { return x.id === id; })[0]; if (!o) return;
      row.querySelector('.frOpenWT').addEventListener('change', function (e) { o.wtId = e.target.value; renderMaterials(); });
      row.querySelector('.frOpenW').addEventListener('input', function (e) { o.width = num(e.target.value); renderMaterials(); });
      row.querySelector('.frOpenQty').addEventListener('input', function (e) { o.qty = num(e.target.value, 1); renderMaterials(); });
      row.querySelector('.frOpenDel').addEventListener('click', function () { FR.openings = FR.openings.filter(function (x) { return x.id !== id; }); renderOpens(); renderMaterials(); });
    });
  }

  function renderMaterials() {
    var box = document.getElementById('frMaterials'); if (!box) return;
    var m = F.framingCompute();
    function rows(obj, fmt) { var ks = Object.keys(obj); if (!ks.length) return '<div class="text-steel-400">—</div>'; return ks.map(function (k) { return '<div class="flex justify-between"><span class="text-steel-600">' + esc(k) + '</span><span class="font-semibold text-steel-800">' + fmt(obj[k]) + '</span></div>'; }).join(''); }
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

  function renderAll() { renderWTs(); refreshToolWT(); renderSegs(); renderOpens(); renderMaterials(); }
})();
