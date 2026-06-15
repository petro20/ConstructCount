/* =========================================================================
   floor-takeoff.js — TAKEOFF UNIFICADO (abas por DISCIPLINA).
   Abas exibidas conforme o PACOTE do usuário: Parede · Piso · Forro · Janelas.
   Cada aba = lista de materiais (item, qtd, unidade, preço, custo, venda).
   • Parede: dados do takeoff de Framing (F.framingReportData) — editar preços/tipos
     continua no painel dedicado (botão ✏️).
   • Piso/Forro: áreas medidas por tag (acabamento + rodapé), preços por projeto.
   • Janelas e Portas: aponta p/ Reconhecer / Relatórios (consolidado próprio).
   Abre por: F.openTakeoff()  (alias F.openFloorTakeoff)
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var num = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var money = function (n) { return '$ ' + (Number(n) || 0).toFixed(2); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var RKEY = 'cc_floor_rates';
  var TAB = null;

  function rates() { try { return JSON.parse(localStorage.getItem(RKEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveRates(r) { try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) {} }
  function rate(k, d) { var r = rates(); return r[k] != null ? r[k] : (d || 0); }
  function setRate(k, v) { var r = rates(); r[k] = num(v); saveRates(r); }
  function owns(id) { return !F.hasPackage || F.hasPackage(id); }

  // abas disponíveis = disciplinas que o usuário TEM
  function tabs() {
    var t = [];
    if (owns('wall')) t.push({ id: 'wall', label: '🧱 ' + tr('Parede') });
    if (owns('floor')) t.push({ id: 'floor', label: '🟩 ' + tr('Piso') });
    if (owns('ceiling')) t.push({ id: 'ceiling', label: '🟦 ' + tr('Forro') });
    if (owns('windows_doors')) t.push({ id: 'windows', label: '🪟 ' + tr('Janelas e Portas') });
    return t;
  }

  // ---- PISO/FORRO: agrega as áreas da folha por (kind, tag) ----
  function areaGroups(kind) {
    var areas = (F._wsAreas ? F._wsAreas() : []);
    var page = F._wsPage ? F._wsPage() : null;
    var by = {};
    areas.forEach(function (a) {
      var k = a.kind || 'floor';
      if (k !== kind || (page != null && a.page !== page)) return;
      var tag = a.tag || '—';
      var g = by[tag] = by[tag] || { tag: tag, material: (F._wsFinishDesc ? F._wsFinishDesc(k, a.tag || '') : ''), sf: 0, baseLf: 0 };
      g.sf += (a.sf || 0) * (a.neg ? -1 : 1);
      if (!a.neg && k !== 'ceiling') g.baseLf += (F._wsAreaBaseLf ? F._wsAreaBaseLf(a) : 0);
    });
    return Object.keys(by).map(function (t) { return by[t]; }).filter(function (g) { return Math.abs(g.sf) > 0.01; });
  }
  function lineCost(mat, lab) { return mat * (1 + rate('tax', 0) / 100) + lab; }
  function lineSale(cost) { return cost * (1 + rate('markup', 0) / 100); }

  function tableHTML(head, rows, foot) {
    return '<table class="fkt-tbl"><thead><tr>'
      + head.map(function (h, i) { return '<th' + (i >= 2 ? ' class="ftt-r"' : '') + '>' + h + '</th>'; }).join('')
      + '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" style="text-align:center;color:#9aa3b2;padding:18px">' + tr('Sem dados ainda.') + '</td></tr>')
      + '</tbody>' + (foot || '') + '</table>';
  }
  function row(cells) { return '<tr>' + cells.map(function (c, i) { return '<td' + (i >= 2 ? ' class="ftt-r"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }

  function renderArea(ov, kind) {
    var floor = kind === 'floor';
    var gs = areaGroups(kind);
    var baseH = F._wsAreaBaseH ? F._wsAreaBaseH() : 0;
    var rows = [], tot = { mat: 0, lab: 0, cost: 0, sale: 0 };
    gs.forEach(function (g) {
      var mr = floor ? rate('floorMat', 0) : rate('ceilMat', 0), lr = floor ? rate('floorLab', 0) : rate('ceilLab', 0);
      var mat = g.sf * mr, lab = g.sf * lr, cost = lineCost(mat, lab), sale = lineSale(cost);
      tot.mat += mat; tot.lab += lab; tot.cost += cost; tot.sale += sale;
      rows.push(row(['<b>' + (floor ? tr('Piso') : tr('Forro')) + '</b> ' + esc(g.tag), esc(g.material || '—'), g.sf.toFixed(1), 'SF', money(mr), money(mat), money(lab), money(cost), money(sale)]));
      if (floor && g.baseLf > 0.01) {
        var br = rate('baseMat', 0), bl = rate('baseLab', 0), bmat = g.baseLf * br, blab = g.baseLf * bl, bc = lineCost(bmat, blab), bs = lineSale(bc), bsf = g.baseLf * (baseH / 12);
        tot.mat += bmat; tot.lab += blab; tot.cost += bc; tot.sale += bs;
        rows.push(row([tr('Rodapé (base)') + (bsf > 0 ? (' · ' + bsf.toFixed(1) + ' SF') : ''), baseH > 0 ? (baseH + '" alt.') : '—', g.baseLf.toFixed(1), 'LF', money(br), money(bmat), money(blab), money(bc), money(bs)]));
      }
    });
    var ri = function (k, ph) { return '<input data-rate="' + k + '" value="' + esc(String(rate(k, ''))) + '" placeholder="' + ph + '" inputmode="decimal" style="width:60px">'; };
    var rbar = (floor
      ? (tr('Piso') + ' $/SF: ' + ri('floorMat', 'mat') + ' ' + ri('floorLab', 'M.O.') + ' &nbsp; ' + tr('Rodapé') + ' $/LF: ' + ri('baseMat', 'mat') + ' ' + ri('baseLab', 'M.O.'))
      : (tr('Forro') + ' $/SF: ' + ri('ceilMat', 'mat') + ' ' + ri('ceilLab', 'M.O.')))
      + ' &nbsp; ' + tr('Imposto') + ' %: ' + ri('tax', '%') + ' &nbsp; ' + tr('Ganho') + ' %: ' + ri('markup', '%');
    var foot = '<tfoot><tr><td colspan="5"><b>' + tr('Total') + '</b></td><td class="ftt-r">' + money(tot.mat) + '</td><td class="ftt-r">' + money(tot.lab) + '</td><td class="ftt-r"><b>' + money(tot.cost) + '</b></td><td class="ftt-r"><b style="color:#16a34a">' + money(tot.sale) + '</b></td></tr></tfoot>';
    ov.querySelector('.fkt-body').innerHTML = '<div class="fkt-rates">' + rbar + '</div>'
      + tableHTML(['ITEM', tr('Material'), tr('Qtd'), tr('Un'), tr('Preço un.'), 'MATERIAL $', 'M.O. $', tr('Custo') + ' $', tr('Venda') + ' $'], rows, foot);
    ov.querySelectorAll('[data-rate]').forEach(function (inp) { inp.addEventListener('change', function () { setRate(inp.getAttribute('data-rate'), inp.value); renderArea(ov, kind); }); });
  }

  function renderWall(ov) {
    var d = F.framingReportData ? F.framingReportData() : null;
    var body;
    if (!d || !(d.types || []).length) {
      body = '<div style="padding:18px;text-align:center;color:#9aa3b2">' + tr('Trace paredes (📐 Linear) e atribua um tipo para o takeoff aparecer aqui.') + '</div>';
    } else {
      var vals = F._framingValsFromT ? F._framingValsFromT(d.totals) : null;
      var mat = (F._framingMatRows && vals) ? F._framingMatRows(vals, d.studsBySize, d) : [];
      var rows = mat.map(function (r) { return row([esc(String(r[0])), esc(String(r[1] || '—')), Number(r[3]).toFixed(r[2] === 'EA' ? 0 : 1), esc(String(r[2])), '', '', '', '', '']); });
      var T = d.totals || {};
      var foot = '<tfoot><tr><td colspan="5"><b>' + tr('Total') + '</b></td><td class="ftt-r">' + money(T.mat) + '</td><td class="ftt-r">' + money(T.lab) + '</td><td class="ftt-r"><b>' + money(T.cost) + '</b></td><td class="ftt-r"><b style="color:#16a34a">' + money(T.sale) + '</b></td></tr></tfoot>';
      body = '<div class="fkt-rates">' + tr('Preços, tipos e mão de obra da Parede ficam no painel detalhado.') + ' <button id="fktEditWall" class="fkt-tab" style="border-color:#2c6df5;color:#7fb0ff">✏️ ' + tr('Editar parede') + '</button></div>'
        + tableHTML(['ITEM', tr('Material'), tr('Qtd'), tr('Un'), tr('Preço un.'), 'MATERIAL $', 'M.O. $', tr('Custo') + ' $', tr('Venda') + ' $'], rows, foot);
    }
    ov.querySelector('.fkt-body').innerHTML = body;
    var eb = ov.querySelector('#fktEditWall'); if (eb) eb.addEventListener('click', function () { ov.remove(); if (F.openWallEditor) F.openWallEditor(); });
  }

  function renderWindows(ov) {
    ov.querySelector('.fkt-body').innerHTML = '<div style="padding:20px;text-align:center;color:#c2c8d2;line-height:1.7">'
      + '🪟 ' + tr('Esquadrias (Janelas e Portas) são contadas com a ferramenta 🔢 Contar / Auto Count.') + '<br>'
      + tr('O consolidado e os documentos saem na Central de Relatórios.') + '<br><br>'
      + '<button id="fktOpenReports" class="fkt-tab" style="border-color:#2c6df5;color:#7fb0ff">📄 ' + tr('Abrir Relatórios') + '</button></div>';
    var rb = ov.querySelector('#fktOpenReports'); if (rb) rb.addEventListener('click', function () { ov.remove(); if (F.openReportsHub) F.openReportsHub(); });
  }

  function render(ov) {
    ov.querySelectorAll('.fkt-tab[data-tab]').forEach(function (b) { b.classList.toggle('fkt-tab-on', b.getAttribute('data-tab') === TAB); });
    if (TAB === 'wall') renderWall(ov);
    else if (TAB === 'windows') renderWindows(ov);
    else renderArea(ov, TAB);
  }

  function ensureCss() {
    if (document.getElementById('fktCss')) return;
    var st = document.createElement('style'); st.id = 'fktCss';
    st.textContent = [
      '.fkt-modal{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}',
      '.fkt-shell{width:min(1080px,96vw);max-height:90vh;display:flex;flex-direction:column;background:#13151a;color:#e6e8ec;border:1px solid #2a2f3a;border-radius:12px;overflow:hidden;font:13px/1.5 Inter,system-ui}',
      '.fkt-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1b1f27;border-bottom:1px solid #2a2f3a}',
      '.fkt-tabs{display:flex;gap:6px;flex-wrap:wrap}',
      '.fkt-tab{padding:5px 12px;border-radius:999px;border:1px solid #2a2f3a;background:#222732;color:#aeb6c2;cursor:pointer;font-weight:600;font-size:12.5px}',
      '.fkt-tab-on{background:#2c6df5;border-color:#2c6df5;color:#fff}',
      '.fkt-x{margin-left:auto;background:none;border:0;color:#aeb6c2;font-size:18px;cursor:pointer}',
      '.fkt-body{overflow:auto;padding:12px 14px}',
      '.fkt-rates{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#1b1f27;border:1px solid #2a2f3a;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px;color:#aeb6c2}',
      '.fkt-rates input{background:#0f1115;border:1px solid #2a2f3a;border-radius:6px;color:#e6e8ec;padding:3px 6px;font-size:12px}',
      '.fkt-tbl{width:100%;border-collapse:collapse;font-size:12.5px}',
      '.fkt-tbl th,.fkt-tbl td{padding:6px 8px;border-bottom:1px solid #232833;text-align:left}',
      '.fkt-tbl th{color:#9aa3b2;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.03em}',
      '.fkt-tbl .ftt-r{text-align:right;font-variant-numeric:tabular-nums}',
      '.fkt-tbl tfoot td{border-top:2px solid #2a2f3a;background:#1b1f27}'
    ].join('\n');
    document.head.appendChild(st);
  }

  F.openTakeoff = function (startTab) {
    ensureCss();
    var av = tabs();
    if (!av.length) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Nenhuma disciplina no seu plano.')); return; }
    TAB = (startTab && av.some(function (t) { return t.id === startTab; })) ? startTab : av[0].id;
    var old = document.getElementById('fktModal'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'fktModal'; ov.className = 'fkt-modal';
    ov.innerHTML = '<div class="fkt-shell"><div class="fkt-bar"><b>📊 ' + tr('Takeoff') + '</b><span class="fkt-tabs">'
      + av.map(function (t) { return '<button class="fkt-tab" data-tab="' + t.id + '">' + t.label + '</button>'; }).join('')
      + '</span><span style="flex:1"></span><button id="fktClose" class="fkt-x">✕</button></div><div class="fkt-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#fktClose').addEventListener('click', function () { ov.remove(); });
    ov.querySelectorAll('.fkt-tab[data-tab]').forEach(function (b) { b.addEventListener('click', function () { TAB = b.getAttribute('data-tab'); render(ov); }); });
    render(ov);
  };
  F.openFloorTakeoff = function () { F.openTakeoff('floor'); };   // compat
})();
