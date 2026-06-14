/* =========================================================================
   floor-takeoff.js — TAKEOFF de PISO e FORRO (disciplinas por ÁREA).
   Abas Piso | Forro com LISTA DE MATERIAIS (item, qtd, unidade, preço, custo,
   venda) — estilo PlanSwift. Piso inclui o RODAPÉ (base = perímetro × altura).
   Dados das áreas medidas (F._wsAreas da folha atual); preços salvos por projeto.
   Abre por: F.openFloorTakeoff()
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var num = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var money = function (n) { return '$ ' + (Number(n) || 0).toFixed(2); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var RKEY = 'cc_floor_rates';
  var TAB = 'floor';   // aba ativa

  function rates() { try { return JSON.parse(localStorage.getItem(RKEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveRates(r) { try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) {} }
  function rate(k, d) { var r = rates(); return r[k] != null ? r[k] : (d || 0); }
  function setRate(k, v) { var r = rates(); r[k] = num(v); saveRates(r); }

  // agrega as áreas da folha por (kind, tag) → {kind, tag, material, sf, baseLf}
  function groups(kind) {
    var areas = (F._wsAreas ? F._wsAreas() : []);
    var page = F._wsPage ? F._wsPage() : null;
    var by = {};
    areas.forEach(function (a) {
      var k = a.kind || 'floor';
      if (k !== kind) return;
      if (page != null && a.page !== page) return;
      var tag = a.tag || '—';
      var g = by[tag] = by[tag] || { kind: k, tag: tag, material: (F._wsFinishDesc ? F._wsFinishDesc(k, a.tag || '') : ''), sf: 0, baseLf: 0 };
      g.sf += (a.sf || 0) * (a.neg ? -1 : 1);
      if (!a.neg && k !== 'ceiling') g.baseLf += (F._wsAreaBaseLf ? F._wsAreaBaseLf(a) : 0);
    });
    return Object.keys(by).map(function (t) { return by[t]; }).filter(function (g) { return Math.abs(g.sf) > 0.01; });
  }

  function lineCost(mat, lab) { var tax = rate('tax', 0); return mat * (1 + tax / 100) + lab; }
  function lineSale(cost) { return cost * (1 + rate('markup', 0) / 100); }

  function render(ov) {
    var floor = TAB === 'floor';
    var gs = groups(TAB);
    var baseH = F._wsAreaBaseH ? F._wsAreaBaseH() : 0;
    var rows = [];
    var tot = { mat: 0, lab: 0, cost: 0, sale: 0 };
    gs.forEach(function (g) {
      // linha do acabamento (piso ou forro) por SF
      var mr = floor ? rate('floorMat', 0) : rate('ceilMat', 0);
      var lr = floor ? rate('floorLab', 0) : rate('ceilLab', 0);
      var mat = g.sf * mr, lab = g.sf * lr, cost = lineCost(mat, lab), sale = lineSale(cost);
      tot.mat += mat; tot.lab += lab; tot.cost += cost; tot.sale += sale;
      rows.push(['<b>' + (floor ? tr('Piso') : tr('Forro')) + '</b> ' + esc(g.tag), esc(g.material || '—'), g.sf.toFixed(1), 'SF', money(mr), money(mat), money(lab), money(cost), money(sale)]);
      // linha do RODAPÉ (só piso) — material por LF e/ou área por SF (perímetro × altura)
      if (floor && g.baseLf > 0.01) {
        var br = rate('baseMat', 0), bl = rate('baseLab', 0);
        var bmat = g.baseLf * br, blab = g.baseLf * bl, bcost = lineCost(bmat, blab), bsale = lineSale(bcost);
        tot.mat += bmat; tot.lab += blab; tot.cost += bcost; tot.sale += bsale;
        var bsf = g.baseLf * (baseH / 12);
        rows.push([tr('Rodapé (base)') + (bsf > 0 ? (' · ' + bsf.toFixed(1) + ' SF') : ''), baseH > 0 ? (baseH + '" alt.') : '—', g.baseLf.toFixed(1), 'LF', money(br), money(bmat), money(blab), money(bcost), money(bsale)]);
      }
    });
    var body = rows.length
      ? rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i >= 2 ? ' class="ftt-r"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('')
      : '<tr><td colspan="9" style="text-align:center;color:#9aa3b2;padding:18px">' + tr('Meça áreas de {k} (ferramenta ▱ Área) para aparecer aqui.', { k: floor ? tr('Piso') : tr('Forro') }) + '</td></tr>';

    var ri = function (k, ph) { return '<input data-rate="' + k + '" value="' + esc(String(rate(k, ''))) + '" placeholder="' + ph + '" inputmode="decimal" style="width:62px">'; };
    var ratesBar = floor
      ? (tr('Piso') + ' $/SF: ' + ri('floorMat', 'mat') + ' ' + ri('floorLab', 'M.O.') + ' &nbsp; ' + tr('Rodapé') + ' $/LF: ' + ri('baseMat', 'mat') + ' ' + ri('baseLab', 'M.O.'))
      : (tr('Forro') + ' $/SF: ' + ri('ceilMat', 'mat') + ' ' + ri('ceilLab', 'M.O.'));
    ratesBar += ' &nbsp; ' + tr('Imposto') + ' %: ' + ri('tax', '%') + ' &nbsp; ' + tr('Ganho') + ' %: ' + ri('markup', '%');

    ov.querySelector('.fkt-body').innerHTML =
      '<div class="fkt-rates">' + ratesBar + '</div>'
      + '<table class="fkt-tbl"><thead><tr>'
      + ['ITEM', tr('Material'), tr('Qtd'), tr('Un'), tr('Preço un.'), 'MATERIAL $', 'M.O. $', tr('Custo') + ' $', tr('Venda') + ' $']
        .map(function (h, i) { return '<th' + (i >= 2 ? ' class="ftt-r"' : '') + '>' + h + '</th>'; }).join('')
      + '</tr></thead><tbody>' + body + '</tbody>'
      + '<tfoot><tr><td colspan="5"><b>' + tr('Total') + '</b></td>'
      + '<td class="ftt-r">' + money(tot.mat) + '</td><td class="ftt-r">' + money(tot.lab) + '</td>'
      + '<td class="ftt-r"><b>' + money(tot.cost) + '</b></td><td class="ftt-r"><b style="color:#16a34a">' + money(tot.sale) + '</b></td></tr></tfoot></table>';

    ov.querySelectorAll('[data-rate]').forEach(function (inp) {
      inp.addEventListener('change', function () { setRate(inp.getAttribute('data-rate'), inp.value); render(ov); });
    });
    ov.querySelectorAll('.fkt-tab').forEach(function (b) {
      b.classList.toggle('fkt-tab-on', b.getAttribute('data-tab') === TAB);
    });
  }

  function ensureCss() {
    if (document.getElementById('fktCss')) return;
    var st = document.createElement('style'); st.id = 'fktCss';
    st.textContent = [
      '.fkt-modal{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}',
      '.fkt-shell{width:min(1040px,96vw);max-height:90vh;display:flex;flex-direction:column;background:#13151a;color:#e6e8ec;border:1px solid #2a2f3a;border-radius:12px;overflow:hidden;font:13px/1.5 Inter,system-ui}',
      '.fkt-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1b1f27;border-bottom:1px solid #2a2f3a}',
      '.fkt-tabs{display:flex;gap:6px}',
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

  F.openFloorTakeoff = function () {
    ensureCss();
    var old = document.getElementById('fktModal'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'fktModal'; ov.className = 'fkt-modal';
    ov.innerHTML =
      '<div class="fkt-shell">'
      + '<div class="fkt-bar"><b>📊 ' + tr('Takeoff') + ' — ' + tr('Piso / Forro') + '</b>'
      + '<span class="fkt-tabs">'
      + '<button class="fkt-tab" data-tab="floor">🟩 ' + tr('Piso') + '</button>'
      + '<button class="fkt-tab" data-tab="ceiling">🟦 ' + tr('Forro') + '</button>'
      + '</span><span style="flex:1"></span>'
      + '<button id="fktClose" class="fkt-x">✕</button></div>'
      + '<div class="fkt-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#fktClose').addEventListener('click', function () { ov.remove(); });
    ov.querySelectorAll('.fkt-tab').forEach(function (b) {
      b.addEventListener('click', function () { TAB = b.getAttribute('data-tab'); render(ov); });
    });
    render(ov);
  };
})();
