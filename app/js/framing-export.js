/* =========================================================================
   framing-export.js — RELATÓRIOS do pacote Framing (Metal & Wood).
   Reaproveita a base de relatórios (jsPDF + autotable + XLSX + marca da
   empresa do export.js). 4 documentos:
     • Orçamento ao cliente (PDF, com preços)   → F.framingExportQuotePDF()
     • Lista de materiais / Pedido (Excel .xlsx) → F.framingExportMaterialsXLSX()
     • Resumo do takeoff (PDF, técnico)          → F.framingExportSummaryPDF()
     • Planta marcada (PDF, folhas + paredes)    → F.framingExportMarkedPlanPDF()
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var money = function (n) { return F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2)); };
  var num = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var fname = function (base, ext) { return 'framing-' + base + '.' + ext; };
  function hexRGB(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h || '888888', 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function noData() { if (F.flashExport) F.flashExport('⚠️ ' + tr('Sem paredes traçadas para o relatório.')); }
  function needLib(ok) { if (!ok && F.flashExport) F.flashExport('⚠️ ' + tr('Biblioteca de relatório indisponível.')); return ok; }

  /* ---------- Orçamento ao cliente (PDF) ---------- */
  F.framingExportQuotePDF = async function () {
    if (!needLib(window.jspdf)) return;
    var d = F.framingReportData(); if (!d.types.length) return noData();
    var L = F.pickDocLang ? await F.pickDocLang() : 'pt';
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF();
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Orçamento — Framing · Drywall · Insulation · Paint'));
    var py = 36;
    doc.setTextColor(60); doc.setFontSize(9);
    if (d.region) { doc.text(tr('Região: {r}', { r: d.region }), 14, py); py += 5; }
    doc.text(tr('{n} tipo(s) de parede · {lf} LF · {sf} SF de parede', { n: d.types.length, lf: d.totals.lf.toFixed(0), sf: d.totals.sf.toFixed(0) }), 14, py); py += 4;

    var body = d.types.map(function (x) {
      return ['', (x.typeId ? '(' + x.typeId + ') ' : '') + x.name, x.m.totalLF.toFixed(0), x.m.wallSf.toFixed(0), money(x.mat), money(x.lab), money(x.tax), money(x.cost), money(x.sale)];
    });
    doc.autoTable({
      startY: py + 3,
      head: [['', tr('Tipo de parede'), 'LF', 'SF', tr('Material'), tr('M.O.'), tr('Imposto'), tr('Custo'), tr('Venda')]],
      body: body, theme: 'striped',
      headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.8, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 6 }, 1: { cellWidth: 50 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: function (data) { if (data.section === 'body' && data.column.index === 0) data.cell.styles.fillColor = hexRGB(d.types[data.row.index].color); }
    });
    var y = doc.lastAutoTable.finalY + 8; if (y > 250) { doc.addPage(); y = 24; }
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(tr('Custo: {c}   ·   Imposto material: {t}   ·   Ganho: {g}%', { c: money(d.totals.cost), t: money(d.totals.tax), g: num(d.markup) }), 14, y); y += 9;
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(36, 52, 75);
    doc.text(tr('VALOR DE VENDA: {v}', { v: money(d.totals.sale) }), 14, y);
    doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(tr('Valores estimados em USD. Quantidades levantadas da planta; preços conforme a região.'), 14, 286);
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('orcamento', 'pdf'), doc.output('arraybuffer'));
    if (F.flashExport) F.flashExport('✓ ' + tr('Orçamento') + ' (PDF) ✓');
  };

  /* ---------- Lista de materiais / Pedido (Excel) ---------- */
  F.framingExportMaterialsXLSX = async function () {
    if (!needLib(window.XLSX)) return;
    var d = F.framingReportData(); if (!d.types.length) return noData();
    var sz = d.sizes || {}, w = d.waste || {}, T = d.totals;
    var withWaste = function (q, k) { return q * (1 + num(w[k]) / 100); };
    var aoa = [[tr('LISTA DE MATERIAIS / PEDIDO') + (d.region ? (' — ' + d.region) : '')], [], [tr('Material'), tr('Tamanho'), tr('Unidade'), tr('Quantidade'), tr('Qtd c/ sobra')]];
    // studs por bitola
    Object.keys(d.studsBySize).forEach(function (size) { var q = d.studsBySize[size]; aoa.push([tr('Montante (stud)'), sz.stud || size, 'EA', Math.ceil(q), Math.ceil(withWaste(q, 'stud'))]); });
    var row = function (lb, k, size, unit, q) { if (q > 0) aoa.push([lb, sz[size] || '', unit, Math.ceil(q * 10) / 10, Math.ceil(withWaste(q, size))]); };
    if (d.scope.framing) {
      row(tr('Plate / Track'), 'plateLF', 'plateLF', 'LF', T.horiz);
      row(tr('Verga (header)'), 'headerLF', 'headerLF', 'LF', T.header);
      row(tr('Sheathing (DensGlass/plywood)'), 'sheathSf', 'sheathSf', 'SF', T.shsf);
      if (T.shsf > 0) aoa.push([tr('Sheathing — folhas 4x8'), sz.sheathSf || '4x8', 'EA', Math.ceil(T.shsf / 32), Math.ceil(withWaste(T.shsf, 'sheathSf') / 32)]);
    }
    if (d.scope.drywall) {
      row(tr('Drywall comum'), 'drywallSf', 'drywallSf', 'SF', T.dwsf);
      row(tr('Drywall resist. água (WR)'), 'drywallWrSf', 'drywallWrSf', 'SF', T.wrsf);
      if (T.dwsf + T.wrsf > 0) aoa.push([tr('Drywall — folhas 4x8'), '4x8', 'EA', Math.ceil((T.dwsf + T.wrsf) / 32), Math.ceil(withWaste(T.dwsf + T.wrsf, 'drywallSf') / 32)]);
    }
    if (d.scope.insulation) row(tr('Isolamento (batt)'), 'insulSf', 'insulSf', 'SF', T.insul);
    if (d.scope.paint) row(tr('Tinta + primer'), 'paintSf', 'paintSf', 'SF', T.paint);
    var ws = window.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 13 }];
    var wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, tr('Materiais').slice(0, 31));
    var u8 = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await F.saveBytes(fname('materiais', 'xlsx'), u8);
    if (F.flashExport) F.flashExport('✓ ' + tr('Lista de materiais') + ' (Excel) ✓');
  };

  /* ---------- Resumo do takeoff (PDF técnico) ---------- */
  F.framingExportSummaryPDF = async function () {
    if (!needLib(window.jspdf)) return;
    var d = F.framingReportData(); if (!d.types.length) return noData();
    var L = F.pickDocLang ? await F.pickDocLang() : 'pt';
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape' });
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Resumo do takeoff — Framing'));
    var body = d.types.map(function (x) {
      return [(x.typeId ? '(' + x.typeId + ') ' : '') + x.name, x.material || '', x.sides, x.m.totalLF.toFixed(0), x.m.wallSf.toFixed(0), x.m.totalStuds, x.m.totalHorizLF.toFixed(0), x.m.sheathingSf.toFixed(0), x.m.drywallSf.toFixed(0), x.m.drywallWrSf.toFixed(0), x.m.insulationSf.toFixed(0), x.m.paintSf.toFixed(0)];
    });
    var T = d.totals;
    body.push([tr('TOTAL'), '', '', T.lf.toFixed(0), T.sf.toFixed(0), T.studs, T.horiz.toFixed(0), T.shsf.toFixed(0), T.dwsf.toFixed(0), T.wrsf.toFixed(0), T.insul.toFixed(0), T.paint.toFixed(0)]);
    doc.autoTable({
      startY: 34,
      head: [[tr('Tipo'), tr('Mat.'), tr('Faces (ext/int)'), 'LF', 'SF', tr('Studs'), 'Plate/Track LF', 'Sheathing SF', 'Drywall SF', 'WR SF', 'Insul SF', 'Paint SF']],
      body: body, theme: 'grid',
      headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255, fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 34 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' } },
      didParseCell: function (data) { if (data.section === 'body' && data.row.index === body.length - 1) data.cell.styles.fontStyle = 'bold'; }
    });
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('resumo', 'pdf'), doc.output('arraybuffer'));
    if (F.flashExport) F.flashExport('✓ ' + tr('Resumo do takeoff') + ' (PDF) ✓');
  };

  /* ---------- Planta marcada (PDF) ---------- */
  F.framingExportMarkedPlanPDF = async function () {
    if (!needLib(window.jspdf)) return;
    if (!F._framingPagesWithLines || !F._framingPageRender) { if (F.flashExport) F.flashExport(tr('Disponível no app de desktop.')); return; }
    var pages = F._framingPagesWithLines(); if (!pages.length) return noData();
    var d = F.framingReportData();
    var L = F.pickDocLang ? await F.pickDocLang() : 'pt';
    if (F.flashExport) F.flashExport(tr('Gerando planta marcada…'));
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape' }), first = true;
    var PW = 297, PH = 210;
    for (var i = 0; i < pages.length; i++) {
      var pg = pages[i], r = null;
      try { r = await F._framingPageRender(pg.page); } catch (e) { r = null; }
      if (!r) continue;
      if (!first) doc.addPage(); first = false;
      if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Planta marcada — {s}', { s: pg.sheet }));
      var availW = PW - 20, availH = PH - 38, s = Math.min(availW / r.w, availH / r.h);
      var iw = r.w * s, ih = r.h * s, ix = (PW - iw) / 2, iy = 32;
      try { doc.addImage(r.dataUrl, 'JPEG', ix, iy, iw, ih); } catch (e) {}
    }
    // legenda dos tipos (última página)
    doc.addPage();
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Legenda dos tipos de parede'));
    var ly = 40;
    d.types.forEach(function (x) {
      var rgb = hexRGB(x.color); doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(16, ly - 4, 6, 6, 'F');
      doc.setTextColor(40); doc.setFontSize(10);
      doc.text((x.typeId ? '(' + x.typeId + ') ' : '') + x.name + '  —  ' + x.m.totalLF.toFixed(0) + ' LF', 26, ly + 1);
      ly += 8; if (ly > 195) { doc.addPage(); ly = 40; }
    });
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('planta-marcada', 'pdf'), doc.output('arraybuffer'));
    if (F.flashExport) F.flashExport('✓ ' + tr('Planta marcada') + ' (PDF) ✓');
  };

  // linhas de material (genéricas) a partir de valores agregados — reusadas em vários relatórios
  function buildMatRows(vals, studsBySize, d) {
    var sz = d.sizes || {}, sc = d.scope, out = [];
    Object.keys(studsBySize || {}).forEach(function (size) { out.push([tr('Montante (stud)'), sz.stud || size, 'EA', Math.ceil(studsBySize[size])]); });
    var add = function (lb, k, unit, q) { if (q > 0) out.push([lb, sz[k] || '', unit, Math.ceil(q * 10) / 10]); };
    if (sc.framing) { add(tr('Plate / Track'), 'plateLF', 'LF', vals.horiz); add(tr('Verga (header)'), 'headerLF', 'LF', vals.header); add(tr('Sheathing (DensGlass/plywood)'), 'sheathSf', 'SF', vals.shsf); if (vals.shsf > 0) out.push([tr('Sheathing — folhas 4x8'), sz.sheathSf || '4x8', 'EA', Math.ceil(vals.shsf / 32)]); }
    if (sc.drywall) { add(tr('Drywall comum'), 'drywallSf', 'SF', vals.dwsf); add(tr('Drywall resist. água (WR)'), 'drywallWrSf', 'SF', vals.wrsf); if (vals.dwsf + vals.wrsf > 0) out.push([tr('Drywall — folhas 4x8'), '4x8', 'EA', Math.ceil((vals.dwsf + vals.wrsf) / 32)]); }
    if (sc.insulation) add(tr('Isolamento (batt)'), 'insulSf', 'SF', vals.insul);
    if (sc.paint) add(tr('Tinta + primer'), 'paintSf', 'SF', vals.paint);
    return out;
  }
  function valsFromM(m) { return { horiz: m.totalHorizLF, header: m.headersLF, shsf: m.sheathingSf, dwsf: m.drywallSf, wrsf: m.drywallWrSf, insul: m.insulationSf, paint: m.paintSf }; }
  function valsFromT(T) { return { horiz: T.horiz, header: T.header, shsf: T.shsf, dwsf: T.dwsf, wrsf: T.wrsf, insul: T.insul, paint: T.paint }; }

  /* ---------- Material POR PISO (Excel) ---------- */
  F.framingExportByFloorXLSX = async function () {
    if (!needLib(window.XLSX)) return;
    if (!F.framingReportByFloor) return noData();
    var floors = F.framingReportByFloor(); if (!floors.length) return noData();
    var d = F.framingReportData();
    var aoa = [[tr('MATERIAL POR PISO') + (d.region ? (' — ' + d.region) : '')], []];
    floors.forEach(function (fl) {
      aoa.push([tr('Piso') + ': ' + fl.floor + '   (' + fl.m.totalLF.toFixed(0) + ' LF · ' + fl.m.wallSf.toFixed(0) + ' SF)']);
      aoa.push([tr('Material'), tr('Tamanho'), tr('Unidade'), tr('Quantidade')]);
      buildMatRows(valsFromM(fl.m), fl.studsBySize, d).forEach(function (r) { aoa.push(r); });
      aoa.push([]);
    });
    var ws = window.XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 9 }, { wch: 12 }];
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, tr('Por piso').slice(0, 31));
    await F.saveBytes(fname('material-por-piso', 'xlsx'), window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    if (F.flashExport) F.flashExport('✓ ' + tr('Material por piso') + ' (Excel) ✓');
  };

  /* ---------- Cotação ao FORNECEDOR (Excel — fornecedor preenche o preço) ---------- */
  F.framingExportSupplierRFQXLSX = async function () {
    if (!needLib(window.XLSX)) return;
    var d = F.framingReportData(); if (!d.types.length) return noData();
    var rows = buildMatRows(valsFromT(d.totals), d.studsBySize, d);
    var aoa = [[tr('PEDIDO DE COTAÇÃO — FORNECEDOR') + (d.region ? (' — ' + d.region) : '')], [tr('Preencha o "Preço unit." — o Total calcula sozinho.')], [],
      [tr('Material'), tr('Tamanho'), tr('Unidade'), tr('Quantidade'), tr('Preço unit.'), tr('Total')]];
    var first = aoa.length;   // 0-based índice da 1ª linha de material
    rows.forEach(function (r) { aoa.push([r[0], r[1], r[2], r[3], '', '']); });
    var ws = window.XLSX.utils.aoa_to_sheet(aoa);
    for (var i = 0; i < rows.length; i++) { var rn = first + i + 1; ws['F' + rn] = { t: 'n', f: 'D' + rn + '*E' + rn }; }   // Total = Qtd × Preço
    var totRow = first + rows.length + 1;
    ws['E' + totRow] = { t: 's', v: tr('TOTAL') }; ws['F' + totRow] = { t: 'n', f: 'SUM(F' + (first + 1) + ':F' + (first + rows.length) + ')' };
    ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, tr('Cotação').slice(0, 31));
    await F.saveBytes(fname('cotacao-fornecedor', 'xlsx'), window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    if (F.flashExport) F.flashExport('✓ ' + tr('Cotação ao fornecedor') + ' (Excel) ✓');
  };

  /* ---------- Análise do PROPRIETÁRIO (PDF — custo × venda, CONFIDENCIAL) ---------- */
  F.framingExportOwnerPDF = async function () {
    if (!needLib(window.jspdf)) return;
    var d = F.framingReportData(); if (!d.types.length) return noData();
    var L = F.pickDocLang ? await F.pickDocLang() : 'pt';
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF();
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Análise do proprietário — Custo × Venda · CONFIDENCIAL'));
    var T = d.totals, lucro = T.sale - T.cost, margem = T.sale ? (lucro / T.sale * 100) : 0;
    doc.autoTable({
      startY: 36,
      head: [[tr('Composição'), tr('Valor')]],
      body: [
        [tr('Material (com sobra)'), money(T.mat)],
        [tr('Imposto sobre material'), money(T.tax)],
        [tr('Mão de obra'), money(T.lab)],
        [tr('CUSTO TOTAL'), money(T.cost)],
        [tr('Ganho aplicado'), num(d.markup) + '%'],
        [tr('VENDA FINAL'), money(T.sale)],
        [tr('Lucro (Venda − Custo)'), money(lucro)],
        [tr('Margem sobre a venda'), margem.toFixed(1) + '%']
      ],
      theme: 'plain', styles: { fontSize: 10, cellPadding: 2.4 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: function (data) { if (data.section === 'body' && (data.row.index === 3 || data.row.index === 5)) { data.cell.styles.fillColor = [241, 237, 227]; data.cell.styles.fontStyle = 'bold'; } }
    });
    var y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(40); doc.text(tr('Por tipo de parede'), 14, y); y += 2;
    doc.autoTable({
      startY: y + 2,
      head: [[tr('Tipo'), tr('Custo'), tr('Venda'), tr('Lucro')]],
      body: d.types.map(function (x) { return [(x.typeId ? '(' + x.typeId + ') ' : '') + x.name, money(x.cost), money(x.sale), money(x.sale - x.cost)]; }),
      theme: 'striped', headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255, fontSize: 8 },
      styles: { fontSize: 8.5, cellPadding: 1.8 }, columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });
    doc.setFontSize(8); doc.setTextColor(150); doc.text(tr('Documento interno — não enviar ao cliente.'), 14, 286);
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('proprietario-custo-venda', 'pdf'), doc.output('arraybuffer'));
    if (F.flashExport) F.flashExport('✓ ' + tr('Análise do proprietário') + ' (PDF) ✓');
  };

  // lista dos relatórios (p/ o menu/dropdown no takeoff)
  F.framingReports = [
    { id: 'quote', label: '📄 ' + 'Orçamento ao cliente (PDF)', fn: function () { return F.framingExportQuotePDF(); } },
    { id: 'owner', label: '🔒 ' + 'Análise do proprietário — custo × venda (PDF)', fn: function () { return F.framingExportOwnerPDF(); } },
    { id: 'materials', label: '📦 ' + 'Lista de materiais / Pedido (Excel)', fn: function () { return F.framingExportMaterialsXLSX(); } },
    { id: 'byfloor', label: '🏢 ' + 'Material por piso (Excel)', fn: function () { return F.framingExportByFloorXLSX(); } },
    { id: 'rfq', label: '🧾 ' + 'Cotação ao fornecedor (Excel)', fn: function () { return F.framingExportSupplierRFQXLSX(); } },
    { id: 'summary', label: '📊 ' + 'Resumo do takeoff (PDF)', fn: function () { return F.framingExportSummaryPDF(); } },
    { id: 'plan', label: '🗺️ ' + 'Planta marcada (PDF)', fn: function () { return F.framingExportMarkedPlanPDF(); } }
  ];
})();
