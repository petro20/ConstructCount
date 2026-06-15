/* =========================================================================
   floor-takeoff.js — conteúdo das abas PISO / FORRO / JANELAS do Takeoff
   unificado (dock inferior #frTakeoff). As abas (disciplinas) e o shell ficam
   em framing.js; aqui só renderizamos a tabela de cada disciplina DENTRO de um
   elemento host, no MESMO tema claro do dock (classes .ftt-*).
   • F.renderAreaTakeoff(host, kind, rerender) — Piso/Forro (áreas por tag).
   • F.renderWindowsTakeoff(host) — aponta p/ Contar + Relatórios.
   • F.openFloorTakeoff() — compat: abre o dock na aba Piso.
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var num = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var money = function (n) { return F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2)); };
  var fmtN = function (n, d) { var loc = ((F.CURRENCIES && F.state && F.CURRENCIES[F.state.currency]) || { locale: 'en-US' }).locale || 'en-US'; return (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var RKEY = 'cc_floor_rates';

  // store dos preços: PRIMÁRIO = estado do framing (FR.floorRates, persiste por projeto via Python);
  // espelho em localStorage p/ o navegador (portal) onde não há provider Python.
  function lsRates() { try { return JSON.parse(localStorage.getItem(RKEY) || '{}') || {}; } catch (e) { return {}; } }
  function rates() { return (F._floorRates ? F._floorRates() : null) || lsRates(); }
  function rate(k, d) { var r = rates(), v = r ? r[k] : null; return (v != null && v !== '' && Number(v) !== 0) ? v : (d != null ? d : 0); }
  function setRate(k, v) {
    if (F._floorRateSet) F._floorRateSet(k, v);   // persiste por projeto (framing.json)
    try { var r = lsRates(); r[k] = num(v); localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) {}   // espelho navegador
  }

  // agrega as áreas da folha atual por (kind, tag)
  function areaGroups(kind) {
    var areas = (F._wsAreas ? F._wsAreas() : []);
    var page = F._wsPage ? F._wsPage() : null;
    var by = {};
    areas.forEach(function (a) {
      var k = a.kind || 'floor';
      if (k !== kind || (page != null && a.page !== page)) return;
      var tag = a.tag || '—';
      var g = by[tag] = by[tag] || { tag: tag, material: (F._wsFinishDesc ? F._wsFinishDesc(k, a.tag || '') : ''), manufacturer: (F._wsFinishManu ? F._wsFinishManu(k, a.tag || '') : ''), sf: 0, baseLf: 0, _areas: [] };
      g._areas.push(a);
      if (!a.neg && k !== 'ceiling') g.baseLf += (F._wsAreaBaseLf ? F._wsAreaBaseLf(a) : 0);
    });
    return Object.keys(by).map(function (t) {
      var g = by[t];
      g.sf = F._wsAreasNetSf ? F._wsAreasNetSf(g._areas) : g._areas.reduce(function (s, a) { return s + (a.sf || 0) * (a.neg ? -1 : 1); }, 0);   // UNIÃO: sobreposição conta 1×
      return g;
    }).filter(function (g) { return Math.abs(g.sf) > 0.01; });
  }
  function lineCost(mat, lab) { return mat * (1 + rate('tax', 0) / 100) + lab; }
  function lineSale(cost) { return cost * (1 + rate('markup', 0) / 100); }
  function wasteMult() { return 1 + rate('waste', 0) / 100; }   // % de sobra/perda aplicado ao MATERIAL

  function tdNum(v) { return '<td class="num">' + v + '</td>'; }

  function titleCase(s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  // renderiza Piso/Forro DENTRO do host (dock) — TODAS as folhas, agrupadas por folha (tema claro)
  F.renderAreaTakeoff = function (host, kind, rerender) {
    var floor = kind === 'floor';
    var d = F.floorReportDataAll ? F.floorReportDataAll() : { sheets: [] };
    var withRows = (d.sheets || []).filter(function (s) { return (floor ? s.floor : s.ceiling).length; });
    var rowsHtml = '', tot = { mat: 0, lab: 0, cost: 0, sale: 0 };
    withRows.forEach(function (s) {
      var rows = floor ? s.floor : s.ceiling;
      var st = { mat: 0, lab: 0, cost: 0, sale: 0 };
      rowsHtml += '<tr class="ftt-sheethdr"><td colspan="10">🗂 ' + tr('Folha') + ' ' + esc(s.sheet) + (s.level ? (' · ' + esc(titleCase(s.level))) : '') + '</td></tr>';
      rows.forEach(function (r) {
        tot.mat += r.mat; tot.lab += r.lab; tot.cost += r.cost; tot.sale += r.sale;
        st.mat += r.mat; st.lab += r.lab; st.cost += r.cost; st.sale += r.sale;
        rowsHtml += '<tr><td class="ftt-name">' + esc(r.item) + '</td><td>' + esc(r.material || '—') + '</td><td>' + esc(r.manufacturer || '—') + '</td>'
          + tdNum(fmtN(r.qty, 1)) + tdNum(r.unit) + tdNum(money(r.price))
          + '<td class="num ftt-mat">' + money(r.mat) + '</td><td class="num ftt-lab">' + money(r.lab) + '</td><td class="num ftt-tot">' + money(r.cost) + '</td><td class="num ftt-sale">' + money(r.sale) + '</td></tr>';
      });
      rowsHtml += '<tr class="ftt-sheetsub"><td colspan="6">' + tr('Subtotal') + ' ' + esc(s.sheet) + '</td><td class="num ftt-mat">' + money(st.mat) + '</td><td class="num ftt-lab">' + money(st.lab) + '</td><td class="num ftt-tot">' + money(st.cost) + '</td><td class="num ftt-sale">' + money(st.sale) + '</td></tr>';
    });
    var ri = function (k, ph) { return '<input class="ftt-arate" data-rate="' + k + '" value="' + esc(String(rate(k, ''))) + '" placeholder="' + ph + '" inputmode="decimal">'; };
    var rbar = (floor
      ? ('<b>' + tr('Piso') + '</b> $/SF: ' + ri('floorMat', 'mat') + ri('floorLab', 'M.O.') + ' &nbsp; <b>' + tr('Rodapé') + '</b> $/LF: ' + ri('baseMat', 'mat') + ri('baseLab', 'M.O.'))
      : ('<b>' + tr('Forro') + '</b> $/SF: ' + ri('ceilMat', 'mat') + ri('ceilLab', 'M.O.')))
      + ' &nbsp; ' + tr('Sobra') + ' %: ' + ri('waste', '%') + ' &nbsp; ' + tr('Imposto') + ' %: ' + ri('tax', '%') + ' &nbsp; ' + tr('Ganho') + ' %: ' + ri('markup', '%');
    var headers = ['ITEM', tr('Material'), tr('Fabricante'), tr('Qtd'), tr('Un'), tr('Preço un.'), 'MATERIAL $', 'M.O. $', tr('Custo') + ' $', tr('Venda') + ' $'];
    var body = withRows.length ? rowsHtml : '<tr><td colspan="10" style="text-align:center;color:#8b887f;padding:18px">' + tr('Meça áreas de {k} (ferramenta ▱ Área) para aparecer aqui.', { k: floor ? tr('Piso') : tr('Forro') }) + '</td></tr>';
    var foot = '<tr><td colspan="6"><b>' + tr('Total geral') + '</b></td><td class="num ftt-mat"><b>' + money(tot.mat) + '</b></td><td class="num ftt-lab"><b>' + money(tot.lab) + '</b></td><td class="num ftt-tot"><b>' + money(tot.cost) + '</b></td><td class="num ftt-sale"><b>' + money(tot.sale) + '</b></td></tr>';
    host.innerHTML = '<div class="ftt-region ftt-arates">' + rbar + '</div>'
      + '<div class="ftt-tablewrap"><table class="ftt-table"><thead><tr>' + headers.map(function (h, i) { return '<th' + (i >= 3 ? ' class="num"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead>'
      + '<tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>';
    host.querySelectorAll('[data-rate]').forEach(function (inp) { inp.addEventListener('change', function () { setRate(inp.getAttribute('data-rate'), inp.value); if (rerender) rerender(); }); });
  };

  // totais da disciplina (folha atual) p/ o Resumo por pacote
  F.areaTakeoffTotals = function (kind) {
    var floor = kind === 'floor';
    var gs = areaGroups(kind);
    var t = { sf: 0, baseLf: 0, cost: 0, sale: 0, n: gs.length };
    gs.forEach(function (g) {
      var mr = floor ? rate('floorMat', 0) : rate('ceilMat', 0), lr = floor ? rate('floorLab', 0) : rate('ceilLab', 0);
      var mat = g.sf * mr * wasteMult(), lab = g.sf * lr, cost = lineCost(mat, lab);
      t.sf += g.sf; t.cost += cost; t.sale += lineSale(cost);
      if (floor && g.baseLf > 0.01) { var bc = lineCost(g.baseLf * rate('baseMat', 0) * wasteMult(), g.baseLf * rate('baseLab', 0)); t.baseLf += g.baseLf; t.cost += bc; t.sale += lineSale(bc); }
    });
    return t;
  };

  F.renderWindowsTakeoff = function (host) {
    host.innerHTML = '<div class="ftt-tablewrap" style="display:flex;align-items:center;justify-content:center;padding:24px">'
      + '<div style="text-align:center;color:#6c6960;line-height:1.8;max-width:520px">'
      + '🪟 ' + tr('Esquadrias (Janelas e Portas) são contadas com a ferramenta 🔢 Contar / Auto Count.') + '<br>'
      + tr('O consolidado e os documentos saem na Central de Relatórios.') + '<br><br>'
      + '<button id="fktOpenReports" class="ftt-regbtn ftt-regbtn-ai">📄 ' + tr('Abrir Relatórios') + '</button></div></div>';
    var rb = host.querySelector('#fktOpenReports'); if (rb) rb.addEventListener('click', function () { if (F.openReportsHub) F.openReportsHub(); });
  };

  // agrupa por tag p/ uma LISTA de áreas + escala (qualquer folha); SF = união (escala da folha)
  function groupsForAreas(areas, kind, mm) {
    var MM = mm || (F._wsMm ? F._wsMm() : null), by = {};
    (areas || []).forEach(function (a) {
      var k = a.kind || 'floor'; if (k !== kind) return;
      var tag = a.tag || '—';
      var g = by[tag] = by[tag] || { tag: tag, material: (F._wsFinishDesc ? F._wsFinishDesc(k, a.tag || '') : ''), manufacturer: (F._wsFinishManu ? F._wsFinishManu(k, a.tag || '') : ''), sf: 0, baseLf: 0, _a: [] };
      g._a.push(a);
      if (!a.neg && k !== 'ceiling') g.baseLf += (F._wsAreaBaseLfAt ? F._wsAreaBaseLfAt(a, MM) : 0);
    });
    return Object.keys(by).map(function (t) { var g = by[t]; g.sf = F._wsAreasNetSf ? F._wsAreasNetSf(g._a, MM) : g._a.reduce(function (s, a) { return s + (a.sf || 0) * (a.neg ? -1 : 1); }, 0); return g; }).filter(function (g) { return Math.abs(g.sf) > 0.01; });
  }
  function priceRows(gs, kind, baseH) {
    var floor = kind === 'floor', out = [];
    gs.forEach(function (g) {
      var mr = floor ? rate('floorMat', 0) : rate('ceilMat', 0), lr = floor ? rate('floorLab', 0) : rate('ceilLab', 0);
      var mat = g.sf * mr * wasteMult(), lab = g.sf * lr, cost = lineCost(mat, lab);
      out.push({ item: (floor ? tr('Piso') : tr('Forro')) + ' ' + g.tag, tag: g.tag, material: g.material || '', manufacturer: g.manufacturer || '', qty: g.sf, unit: 'SF', price: mr, mat: mat, lab: lab, cost: cost, sale: lineSale(cost), base: false });
      if (floor && g.baseLf > 0.01) {
        var br = rate('baseMat', 0), bmat = g.baseLf * br * wasteMult(), blab = g.baseLf * rate('baseLab', 0), bc = lineCost(bmat, blab);
        out.push({ item: tr('Rodapé (base)'), tag: g.tag, material: (baseH > 0 ? (baseH + '"') : ''), manufacturer: '', qty: g.baseLf, unit: 'LF', price: br, mat: bmat, lab: blab, cost: bc, sale: lineSale(bc), base: true });
      }
    });
    return out;
  }
  function sumRows(rows) { var t = { mat: 0, lab: 0, cost: 0, sale: 0, sf: 0, baseLf: 0 }; rows.forEach(function (r) { t.mat += r.mat; t.lab += r.lab; t.cost += r.cost; t.sale += r.sale; if (r.unit === 'SF') t.sf += r.qty; else t.baseLf += r.qty; }); return t; }

  // dados de UMA folha (lista de áreas) p/ relatório
  function sheetData(areas, mm) {
    var baseH = F._wsAreaBaseH ? F._wsAreaBaseH() : 0;
    var f = priceRows(groupsForAreas(areas, 'floor', mm), 'floor', baseH), c = priceRows(groupsForAreas(areas, 'ceiling', mm), 'ceiling', baseH);
    return { floor: f, ceiling: c, totFloor: sumRows(f), totCeiling: sumRows(c), grand: { cost: sumRows(f).cost + sumRows(c).cost, sale: sumRows(f).sale + sumRows(c).sale } };
  }

  // dados p/ os RELATÓRIOS de Piso/Forro — FOLHA ATUAL
  F.floorReportData = function () {
    var d = sheetData(F._wsAreas ? F._wsAreas() : [], null);
    d.rates = F._floorRates ? F._floorRates() : {}; d.waste = rate('waste', 0); d.tax = rate('tax', 0); d.markup = rate('markup', 0);
    d.region = (F.framing && F.framing.region) || '';
    return d;
  };

  // dados p/ o relatório do PROJETO INTEIRO — 1 bloco por folha que tem takeoff (com a escala de cada folha)
  F.floorReportDataAll = function () {
    var pages = F._wsPagesAreas ? F._wsPagesAreas() : [];
    var sheets = pages.map(function (pg) {
      var sd = sheetData(pg.areas, pg.mmPerPx);
      sd.page = pg.page; sd.sheet = pg.sheet; sd.level = pg.level || '';
      return sd;
    }).filter(function (sd) { return sd.floor.length || sd.ceiling.length; });
    var grand = { cost: 0, sale: 0 }; sheets.forEach(function (s) { grand.cost += s.grand.cost; grand.sale += s.grand.sale; });
    return { sheets: sheets, grand: grand, region: (F.framing && F.framing.region) || '', waste: rate('waste', 0), tax: rate('tax', 0), markup: rate('markup', 0) };
  };

  F.openFloorTakeoff = function () { if (F.openTakeoff) F.openTakeoff('floor'); };   // compat

  // ---- CONFERÊNCIA dos acabamentos (editar/confirmar tipo de material + fabricante lidos pela IA) ----
  F.openFinishConferencia = function () {
    var src = (F._scopeFinishes && F._scopeFinishes.length) ? F._scopeFinishes : (F._floorFinishes ? F._floorFinishes() : []);
    var rows = (src || []).map(function (x) { return { code: x.code || '', kind: x.kind || 'floor', material: x.material || x.desc || '', manufacturer: x.manufacturer || '' }; });
    var old = document.getElementById('fcfModal'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'fcfModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:13px Inter,system-ui';
    var kindOpts = function (k) { return [['floor', '🟩 ' + tr('Piso')], ['base', '📏 ' + tr('Base')], ['ceiling', '🟦 ' + tr('Forro')]].map(function (o) { return '<option value="' + o[0] + '"' + (k === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
    function render() {
      var body = rows.map(function (r, i) {
        return '<tr data-i="' + i + '">'
          + '<td><input class="fcf-code" value="' + esc(r.code) + '" placeholder="FF-01" style="width:78px"></td>'
          + '<td><select class="fcf-kind">' + kindOpts(r.kind) + '</select></td>'
          + '<td><input class="fcf-mat" value="' + esc(r.material) + '" placeholder="' + tr('ex.: Porcelanato 12x24') + '" style="width:100%"></td>'
          + '<td><input class="fcf-manu" value="' + esc(r.manufacturer) + '" placeholder="' + tr('ex.: Daltile') + '" style="width:100%"></td>'
          + '<td style="text-align:center"><button class="fcf-del" title="' + tr('Remover') + '">✕</button></td></tr>';
      }).join('');
      ov.querySelector('#fcfBody').innerHTML = body || '<tr><td colspan="5" style="text-align:center;color:#9aa3b2;padding:16px">' + tr('Nenhum acabamento. Leia o escopo ou adicione manualmente.') + '</td></tr>';
      ov.querySelectorAll('.fcf-del').forEach(function (b) { b.addEventListener('click', function () { collect(); rows.splice(+b.closest('tr').getAttribute('data-i'), 1); render(); }); });
    }
    function collect() {
      ov.querySelectorAll('#fcfBody tr[data-i]').forEach(function (trEl) {
        var i = +trEl.getAttribute('data-i'); if (!rows[i]) return;
        rows[i].code = (trEl.querySelector('.fcf-code').value || '').trim().toUpperCase();
        rows[i].kind = trEl.querySelector('.fcf-kind').value;
        rows[i].material = (trEl.querySelector('.fcf-mat').value || '').trim();
        rows[i].manufacturer = (trEl.querySelector('.fcf-manu').value || '').trim();
      });
    }
    ov.innerHTML = '<div style="width:min(820px,96vw);max-height:88vh;display:flex;flex-direction:column;background:#13151a;color:#e6e8ec;border:1px solid #2a2f3a;border-radius:12px;overflow:hidden">'
      + '<div style="display:flex;align-items:center;gap:10px;padding:11px 15px;background:#1b1f27;border-bottom:1px solid #2a2f3a"><b>✅ ' + tr('Conferir acabamentos (tipo / fabricante)') + '</b><span style="flex:1"></span><button id="fcfClose" style="background:none;border:0;color:#aeb6c2;font-size:18px;cursor:pointer">✕</button></div>'
      + '<div style="padding:6px 15px;color:#9aa3b2;font-size:12px">' + tr('A IA lê da folha de medidas; confira e corrija o que precisar. Salvo no projeto e usado nos relatórios.') + '</div>'
      + '<div style="overflow:auto;padding:6px 15px"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#9aa3b2;text-align:left"><th style="padding:6px">' + tr('Código') + '</th><th>' + tr('Tipo') + '</th><th>' + tr('Tipo de material') + '</th><th>' + tr('Fabricante') + '</th><th></th></tr></thead><tbody id="fcfBody"></tbody></table></div>'
      + '<div style="display:flex;gap:8px;align-items:center;padding:11px 15px;border-top:1px solid #2a2f3a"><button id="fcfAdd" style="background:#222732;border:1px solid #2a2f3a;color:#ccd;border-radius:7px;padding:6px 12px;cursor:pointer">＋ ' + tr('Adicionar') + '</button><span style="flex:1"></span><button id="fcfSave" style="background:#16a34a;border:0;color:#fff;border-radius:7px;padding:7px 16px;font-weight:700;cursor:pointer">💾 ' + tr('Salvar') + '</button></div>'
      + '</div>';
    document.body.appendChild(ov); render();
    ov.querySelector('#fcfClose').addEventListener('click', function () { ov.remove(); });
    ov.querySelector('#fcfAdd').addEventListener('click', function () { collect(); rows.push({ code: '', kind: 'floor', material: '', manufacturer: '' }); render(); });
    ov.querySelector('#fcfSave').addEventListener('click', function () {
      collect();
      var clean = rows.filter(function (r) { return r.code; }).map(function (r) { return { code: r.code, kind: r.kind, desc: r.material, material: r.material, manufacturer: r.manufacturer }; });
      F._scopeFinishes = clean; if (F._setFloorFinishes) F._setFloorFinishes(clean);
      if (F._refreshAreaTagList) F._refreshAreaTagList();
      if (F.flashExport) F.flashExport('✓ ' + tr('Acabamentos salvos') + ' (' + clean.length + ')');
      ov.remove();
    });
  };
})();
