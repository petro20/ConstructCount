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

  function rates() { try { return JSON.parse(localStorage.getItem(RKEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveRates(r) { try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) {} }
  function rate(k, d) { var r = rates(); return r[k] != null ? r[k] : (d || 0); }
  function setRate(k, v) { var r = rates(); r[k] = num(v); saveRates(r); }

  // agrega as áreas da folha atual por (kind, tag)
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

  function tdNum(v) { return '<td class="num">' + v + '</td>'; }

  // renderiza Piso/Forro DENTRO do host (dock), tema claro (.ftt-table)
  F.renderAreaTakeoff = function (host, kind, rerender) {
    var floor = kind === 'floor';
    var gs = areaGroups(kind);
    var baseH = F._wsAreaBaseH ? F._wsAreaBaseH() : 0;
    var rows = [], tot = { mat: 0, lab: 0, cost: 0, sale: 0 };
    gs.forEach(function (g) {
      var mr = floor ? rate('floorMat', 0) : rate('ceilMat', 0), lr = floor ? rate('floorLab', 0) : rate('ceilLab', 0);
      var mat = g.sf * mr, lab = g.sf * lr, cost = lineCost(mat, lab), sale = lineSale(cost);
      tot.mat += mat; tot.lab += lab; tot.cost += cost; tot.sale += sale;
      rows.push('<tr><td class="ftt-name"><b>' + (floor ? tr('Piso') : tr('Forro')) + '</b> ' + esc(g.tag) + '</td><td>' + esc(g.material || '—') + '</td>'
        + tdNum(fmtN(g.sf, 1)) + tdNum('SF') + tdNum(money(mr))
        + '<td class="num ftt-mat">' + money(mat) + '</td><td class="num ftt-lab">' + money(lab) + '</td><td class="num ftt-tot">' + money(cost) + '</td><td class="num ftt-sale">' + money(sale) + '</td></tr>');
      if (floor && g.baseLf > 0.01) {
        var br = rate('baseMat', 0), bl = rate('baseLab', 0), bmat = g.baseLf * br, blab = g.baseLf * bl, bc = lineCost(bmat, blab), bs = lineSale(bc), bsf = g.baseLf * (baseH / 12);
        tot.mat += bmat; tot.lab += blab; tot.cost += bc; tot.sale += bs;
        rows.push('<tr><td class="ftt-name">' + tr('Rodapé (base)') + (bsf > 0 ? (' · ' + fmtN(bsf, 1) + ' SF') : '') + '</td><td>' + (baseH > 0 ? (baseH + '" ' + tr('alt.')) : '—') + '</td>'
          + tdNum(fmtN(g.baseLf, 1)) + tdNum('LF') + tdNum(money(br))
          + '<td class="num ftt-mat">' + money(bmat) + '</td><td class="num ftt-lab">' + money(blab) + '</td><td class="num ftt-tot">' + money(bc) + '</td><td class="num ftt-sale">' + money(bs) + '</td></tr>');
      }
    });
    var ri = function (k, ph) { return '<input class="ftt-arate" data-rate="' + k + '" value="' + esc(String(rate(k, ''))) + '" placeholder="' + ph + '" inputmode="decimal">'; };
    var rbar = (floor
      ? ('<b>' + tr('Piso') + '</b> $/SF: ' + ri('floorMat', 'mat') + ri('floorLab', 'M.O.') + ' &nbsp; <b>' + tr('Rodapé') + '</b> $/LF: ' + ri('baseMat', 'mat') + ri('baseLab', 'M.O.'))
      : ('<b>' + tr('Forro') + '</b> $/SF: ' + ri('ceilMat', 'mat') + ri('ceilLab', 'M.O.')))
      + ' &nbsp; ' + tr('Imposto') + ' %: ' + ri('tax', '%') + ' &nbsp; ' + tr('Ganho') + ' %: ' + ri('markup', '%');
    var headers = ['ITEM', tr('Material'), tr('Qtd'), tr('Un'), tr('Preço un.'), 'MATERIAL $', 'M.O. $', tr('Custo') + ' $', tr('Venda') + ' $'];
    var body = rows.length ? rows.join('') : '<tr><td colspan="9" style="text-align:center;color:#8b887f;padding:18px">' + tr('Meça áreas de {k} (ferramenta ▱ Área) para aparecer aqui.', { k: floor ? tr('Piso') : tr('Forro') }) + '</td></tr>';
    var foot = '<tr><td colspan="5"><b>' + tr('Total') + '</b></td><td class="num ftt-mat"><b>' + money(tot.mat) + '</b></td><td class="num ftt-lab"><b>' + money(tot.lab) + '</b></td><td class="num ftt-tot"><b>' + money(tot.cost) + '</b></td><td class="num ftt-sale"><b>' + money(tot.sale) + '</b></td></tr>';
    host.innerHTML = '<div class="ftt-region ftt-arates">' + rbar + '</div>'
      + '<div class="ftt-tablewrap"><table class="ftt-table"><thead><tr>' + headers.map(function (h, i) { return '<th' + (i >= 2 ? ' class="num"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead>'
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
      var mat = g.sf * mr, lab = g.sf * lr, cost = lineCost(mat, lab);
      t.sf += g.sf; t.cost += cost; t.sale += lineSale(cost);
      if (floor && g.baseLf > 0.01) { var bc = lineCost(g.baseLf * rate('baseMat', 0), g.baseLf * rate('baseLab', 0)); t.baseLf += g.baseLf; t.cost += bc; t.sale += lineSale(bc); }
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

  F.openFloorTakeoff = function () { if (F.openTakeoff) F.openTakeoff('floor'); };   // compat
})();
