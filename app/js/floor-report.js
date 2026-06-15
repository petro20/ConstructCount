/* =========================================================================
   floor-report.js — RELATÓRIOS dos pacotes PISO e FORRO.
   PROJETO INTEIRO, agrupado por FOLHA + NÍVEL, com Tag, tipo de material,
   fabricante e a BASE (rodapé, com seu próprio código/material). Dados:
   F.floorReportDataAll() (floor-takeoff.js).
     • Orçamento ao cliente (PDF, com preços) → F.floorExportProjectPDF()
     • Resumo técnico (PDF, sem preços)        → F.floorExportSummaryPDF()
     • Lista de materiais / Pedido (Excel)     → F.floorExportMaterialsXLSX()
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var DOCL = null;
  var tr = function (s, v) { return F.tr ? F.tr(s, v, DOCL || undefined) : s; };
  var pickL = async function () { DOCL = null; var L = F.pickDocLang ? await F.pickDocLang() : (F.getLang ? F.getLang() : 'pt'); if (!L) return null; DOCL = L; return L; };
  var money = function (n) { return F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2)); };
  var num = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var n1 = function (v) { return (Number(v) || 0).toLocaleString((F.CURRENCIES && F.state && F.CURRENCIES[F.state.currency] || { locale: 'en-US' }).locale || 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  var titleCase = function (s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
  var fname = function (base, ext) { return 'piso-forro-' + base + '.' + ext; };
  function need(ok) { if (!ok && F.flashExport) F.flashExport('⚠️ ' + tr('Biblioteca de relatório indisponível.')); return ok; }
  function noData() { if (F.flashExport) F.flashExport('⚠️ ' + tr('Meça áreas de Piso/Forro para gerar o relatório.')); }
  function allSheets() {
    var d = F.floorReportDataAll ? F.floorReportDataAll() : { sheets: [], grand: { cost: 0, sale: 0 } };
    d.sheets = (d.sheets || []).filter(function (s) { return s.floor.length || s.ceiling.length; });
    return d;
  }
  // rótulo do item sem o sufixo de nível (o nível já vai no cabeçalho da folha)
  function itemLabel(r, level) { var it = r.item || ''; if (level) it = it.replace(' - ' + titleCase(level), ''); return it; }

  /* ---------- Orçamento ao cliente (PDF) — projeto inteiro, por folha + nível ---------- */
  F.floorExportProjectPDF = async function () {
    if (!need(window.jspdf)) return;
    var d = allSheets(); if (!d.sheets.length) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF(), AC = (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]);
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Orçamento — Piso & Forro'));
    var head = [['ITEM', tr('Tag'), tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un'), tr('Custo'), tr('Venda')]];
    var body = [];
    var rowsOf = function (rows, level) {
      return rows.map(function (r) { return [itemLabel(r, level), r.tag || '—', r.material || '—', r.manufacturer || '—', n1(r.qty), r.unit, money(r.cost), money(r.sale)]; });
    };
    var sub = function (lbl, t) { return [{ content: lbl, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [247, 243, 234] } }, { content: money(t.cost), styles: { halign: 'right', fillColor: [247, 243, 234] } }, { content: money(t.sale), styles: { halign: 'right', fontStyle: 'bold', fillColor: [247, 243, 234] } }]; };
    d.sheets.forEach(function (s) {
      body.push([{ content: '' + tr('Folha') + ' ' + s.sheet + (s.level ? (' · ' + titleCase(s.level)) : ''), colSpan: 8, styles: { fontStyle: 'bold', fillColor: AC, textColor: 255 } }]);
      if (s.floor.length) { body.push([{ content: '' + tr('Piso'), colSpan: 8, styles: { fontStyle: 'bold', fillColor: [222, 247, 236] } }]); body = body.concat(rowsOf(s.floor, s.level)); }
      if (s.ceiling.length) { body.push([{ content: '' + tr('Forro'), colSpan: 8, styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }]); body = body.concat(rowsOf(s.ceiling, s.level)); }
      body.push(sub(tr('Subtotal') + ' ' + s.sheet, s.grand));
    });
    doc.autoTable({
      startY: 36, head: head, body: body, theme: 'striped',
      headStyles: { fillColor: AC, textColor: 255, fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'middle' },
      columnStyles: { 4: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } }
    });
    var y = doc.lastAutoTable.finalY + 8; if (y > 250) { doc.addPage(); y = 24; }
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(tr('Custo total: {c}', { c: money(d.grand.cost) }), 14, y); y += 9;
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(36, 52, 75);
    doc.text(tr('VALOR DE VENDA: {v}', { v: money(d.grand.sale) }), 14, y);
    doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(tr('Valores em USD. Quantidades levantadas da planta; sobra de material aplicada.'), 14, 286);
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('orcamento', 'pdf'), doc.output('arraybuffer'));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Orçamento') + ' (PDF) ✓');
  };

  /* ---------- Resumo técnico (PDF, sem preços) — projeto inteiro ---------- */
  F.floorExportSummaryPDF = async function () {
    if (!need(window.jspdf)) return;
    var d = allSheets(); if (!d.sheets.length) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF(), AC = (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]);
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Resumo do takeoff — Piso & Forro'));
    var head = [['ITEM', tr('Tag'), tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un')]];
    var body = [];
    var rowsOf = function (rows, level) { return rows.map(function (r) { return [itemLabel(r, level), r.tag || '—', r.material || '—', r.manufacturer || '—', n1(r.qty), r.unit]; }); };
    d.sheets.forEach(function (s) {
      body.push([{ content: '' + tr('Folha') + ' ' + s.sheet + (s.level ? (' · ' + titleCase(s.level)) : ''), colSpan: 6, styles: { fontStyle: 'bold', fillColor: AC, textColor: 255 } }]);
      if (s.floor.length) body = body.concat(rowsOf(s.floor, s.level));
      if (s.ceiling.length) body = body.concat(rowsOf(s.ceiling, s.level));
    });
    doc.autoTable({
      startY: 38, head: head, body: body, theme: 'grid',
      headStyles: { fillColor: AC, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.8 }, columnStyles: { 4: { halign: 'right' } }
    });
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('resumo', 'pdf'), doc.output('arraybuffer'));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Resumo do takeoff') + ' (PDF) ✓');
  };

  /* ---------- Lista de materiais / Pedido (Excel) — projeto inteiro ---------- */
  F.floorExportMaterialsXLSX = async function () {
    if (!need(window.XLSX)) return;
    var d = allSheets(); if (!d.sheets.length) return noData();
    var L = await pickL(); if (!L) return;
    var aoa = [[tr('Folha'), tr('Nível'), tr('Disciplina'), tr('ITEM'), tr('Tag'), tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un')]];
    d.sheets.forEach(function (s) {
      var lvl = s.level ? titleCase(s.level) : '';
      s.floor.forEach(function (r) { aoa.push([s.sheet, lvl, tr('Piso'), itemLabel(r, s.level), r.tag || '', r.material || '', r.manufacturer || '', Math.round(r.qty * 10) / 10, r.unit]); });
      s.ceiling.forEach(function (r) { aoa.push([s.sheet, lvl, tr('Forro'), itemLabel(r, s.level), r.tag || '', r.material || '', r.manufacturer || '', Math.round(r.qty * 10) / 10, r.unit]); });
    });
    var ws = window.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 8 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 5 }];
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Piso-Forro');
    await F.saveBytes(fname('materiais', 'xlsx'), window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Lista de materiais') + ' (Excel) ✓');
  };

  /* ---------- Planta marcada (PDF) — folhas com as áreas de Piso/Forro desenhadas ---------- */
  F.floorExportMarkedPlanPDF = async function () {
    if (!need(window.jspdf)) return;
    if (!F._areaPageRender || !F._wsPagesAreas) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Disponível no app de desktop.')); return; }
    var pages = F._wsPagesAreas(); if (!pages.length) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape' }), PW = 297, PH = 210, first = true;
    for (var i = 0; i < pages.length; i++) {
      var pg = pages[i], r = null;
      try { r = await F._areaPageRender(pg.page); } catch (e) { r = null; }
      if (!r) continue;
      if (!first) doc.addPage(); first = false;
      if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Planta marcada — Piso & Forro · {s}', { s: pg.sheet + (pg.level ? (' · ' + titleCase(pg.level)) : '') }));
      var sc = Math.min((PW - 20) / r.w, (PH - 38) / r.h), iw = r.w * sc, ih = r.h * sc;
      try { doc.addImage(r.dataUrl, 'JPEG', (PW - iw) / 2, 32, iw, ih); } catch (e) {}
    }
    if (first) return noData();
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('planta-marcada', 'pdf'), doc.output('arraybuffer'));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Planta marcada') + ' (PDF) ✓');
  };

  // todas as linhas (piso+forro) achatadas, com disciplina/nível — base p/ Excel agregado
  function allRowsFlat() {
    var d = allSheets(), out = [];
    d.sheets.forEach(function (s) {
      var lvl = s.level ? titleCase(s.level) : '';
      s.floor.forEach(function (r) { out.push({ disc: tr('Piso'), sheet: s.sheet, level: lvl, code: r.tag || '', material: r.material || '', manufacturer: r.manufacturer || '', qty: r.qty, unit: r.unit }); });
      s.ceiling.forEach(function (r) { out.push({ disc: tr('Forro'), sheet: s.sheet, level: lvl, code: r.tag || '', material: r.material || '', manufacturer: r.manufacturer || '', qty: r.qty, unit: r.unit }); });
    });
    return out;
  }

  /* ---------- Material POR PISO/NÍVEL (Excel) ---------- */
  F.floorExportByLevelXLSX = async function () {
    if (!need(window.XLSX)) return;
    var rows = allRowsFlat(); if (!rows.length) return noData();
    var L = await pickL(); if (!L) return;
    var byLevel = {}, order = [];
    rows.forEach(function (r) {
      var lv = r.level || tr('(sem nível)');
      if (!byLevel[lv]) { byLevel[lv] = {}; order.push(lv); }
      var k = r.disc + '|' + r.code + '|' + r.material + '|' + r.unit;
      var a = byLevel[lv][k] = byLevel[lv][k] || { disc: r.disc, code: r.code, material: r.material, manufacturer: r.manufacturer, unit: r.unit, qty: 0 };
      a.qty += r.qty;
    });
    var aoa = [[tr('MATERIAL POR NÍVEL')], []];
    order.forEach(function (lv) {
      aoa.push([tr('Nível') + ': ' + lv]);
      aoa.push([tr('Disciplina'), tr('Tag'), tr('Tipo de material'), tr('Fabricante'), tr('Un'), tr('Qtd')]);
      Object.keys(byLevel[lv]).forEach(function (k) { var a = byLevel[lv][k]; aoa.push([a.disc, a.code, a.material, a.manufacturer, a.unit, Math.round(a.qty * 10) / 10]); });
      aoa.push([]);
    });
    var ws = window.XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 9 }, { wch: 8 }, { wch: 26 }, { wch: 18 }, { wch: 5 }, { wch: 11 }];
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Por piso');
    await F.saveBytes(fname('material-por-nivel', 'xlsx'), window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Material por nível') + ' (Excel) ✓');
  };

  /* ---------- Cotação ao FORNECEDOR (Excel — fornecedor preenche o preço) ---------- */
  F.floorExportSupplierRFQXLSX = async function () {
    if (!need(window.XLSX)) return;
    var rows = allRowsFlat(); if (!rows.length) return noData();
    var L = await pickL(); if (!L) return;
    var agg = {}, order = [];
    rows.forEach(function (r) {
      var k = r.disc + '|' + r.code + '|' + r.material + '|' + r.manufacturer + '|' + r.unit;
      if (!agg[k]) { agg[k] = { disc: r.disc, code: r.code, material: r.material, manufacturer: r.manufacturer, unit: r.unit, qty: 0 }; order.push(k); }
      agg[k].qty += r.qty;
    });
    var aoa = [[tr('PEDIDO DE COTAÇÃO — FORNECEDOR')], [tr('Preencha o "Preço unit." — o Total calcula sozinho.')], [],
      [tr('Disciplina'), tr('Tag'), tr('Tipo de material'), tr('Fabricante'), tr('Un'), tr('Qtd'), tr('Preço unit.'), tr('Total')]];
    var first = aoa.length;   // 0-based índice da 1ª linha de material
    order.forEach(function (k) { var a = agg[k]; aoa.push([a.disc, a.code, a.material, a.manufacturer, a.unit, Math.round(a.qty * 10) / 10, '', '']); });
    var ws = window.XLSX.utils.aoa_to_sheet(aoa);
    for (var i = 0; i < order.length; i++) { var rn = first + i + 1; ws['H' + rn] = { t: 'n', f: 'F' + rn + '*G' + rn }; }   // Total = Qtd × Preço
    var totRow = first + order.length + 1;
    ws['G' + totRow] = { t: 's', v: tr('TOTAL') }; ws['H' + totRow] = { t: 'n', f: 'SUM(H' + (first + 1) + ':H' + (first + order.length) + ')' };
    ws['!cols'] = [{ wch: 9 }, { wch: 8 }, { wch: 26 }, { wch: 18 }, { wch: 5 }, { wch: 11 }, { wch: 12 }, { wch: 14 }];
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Cotação');
    await F.saveBytes(fname('cotacao-fornecedor', 'xlsx'), window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Cotação ao fornecedor') + ' (Excel) ✓');
  };

  /* ---------- Análise do PROPRIETÁRIO (PDF — custo × venda, CONFIDENCIAL) ---------- */
  F.floorExportOwnerPDF = async function () {
    if (!need(window.jspdf)) return;
    var d = allSheets(); if (!d.sheets.length) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF(), AC = (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]);
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Análise do proprietário — Custo × Venda · CONFIDENCIAL'));
    var T = { mat: 0, lab: 0, cost: 0, sale: 0 };
    d.sheets.forEach(function (s) { s.floor.concat(s.ceiling).forEach(function (r) { T.mat += r.mat; T.lab += r.lab; T.cost += r.cost; T.sale += r.sale; }); });
    var tax = T.cost - T.mat - T.lab, lucro = T.sale - T.cost, margem = T.sale ? (lucro / T.sale * 100) : 0;
    doc.autoTable({
      startY: 36, head: [[tr('Composição'), tr('Valor')]],
      body: [
        [tr('Material (com sobra)'), money(T.mat)],
        [tr('Imposto sobre material'), money(tax)],
        [tr('Mão de obra'), money(T.lab)],
        [tr('CUSTO TOTAL'), money(T.cost)],
        [tr('Ganho aplicado'), num(d.markup) + '%'],
        [tr('VENDA FINAL'), money(T.sale)],
        [tr('Lucro (Venda − Custo)'), money(lucro)],
        [tr('Margem sobre a venda'), margem.toFixed(1) + '%']
      ],
      theme: 'plain', styles: { fontSize: 10, cellPadding: 2.4 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: function (dt) { if (dt.section === 'body' && (dt.row.index === 3 || dt.row.index === 5)) { dt.cell.styles.fillColor = [241, 237, 227]; dt.cell.styles.fontStyle = 'bold'; } }
    });
    var y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(40); doc.text(tr('Por folha'), 14, y);
    doc.autoTable({
      startY: y + 4,
      head: [[tr('Folha'), tr('Custo'), tr('Venda'), tr('Lucro')]],
      body: d.sheets.map(function (s) { return [s.sheet + (s.level ? (' · ' + titleCase(s.level)) : ''), money(s.grand.cost), money(s.grand.sale), money(s.grand.sale - s.grand.cost)]; }),
      theme: 'striped', headStyles: { fillColor: AC, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8.5, cellPadding: 1.8 }, columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });
    doc.setFontSize(8); doc.setTextColor(150); doc.text(tr('Documento interno — não enviar ao cliente.'), 14, 286);
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('proprietario-custo-venda', 'pdf'), doc.output('arraybuffer'));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Análise do proprietário') + ' (PDF) ✓');
  };

  // lista dos relatórios de Piso/Forro (Central de relatórios) — mesma estrutura da Parede completa
  F.floorReports = [
    { id: 'editor', label: '✏️ ' + 'Editor de relatório (blocos)', fn: function () { if (F.openFloorReportEditor) F.openFloorReportEditor(); } },
    { id: 'visual', label: '🎨 ' + 'Editor visual completo (arrastar/soltar)', fn: function () { if (F.openFloorReportGrapes) F.openFloorReportGrapes(); } },
    { id: 'confer', label: '✅ ' + 'Conferir acabamentos (tipo / fabricante)', fn: function () { if (F.openFinishConferencia) F.openFinishConferencia(); } },
    { id: 'quote', label: '📄 ' + 'Orçamento ao cliente (PDF)', fn: function () { return F.floorExportProjectPDF(); } },
    { id: 'owner', label: '🔒 ' + 'Análise do proprietário — custo × venda (PDF)', fn: function () { return F.floorExportOwnerPDF(); } },
    { id: 'materials', label: '📦 ' + 'Lista de materiais / Pedido (Excel)', fn: function () { return F.floorExportMaterialsXLSX(); } },
    { id: 'bylevel', label: '🏢 ' + 'Material por nível (Excel)', fn: function () { return F.floorExportByLevelXLSX(); } },
    { id: 'rfq', label: '🧾 ' + 'Cotação ao fornecedor (Excel)', fn: function () { return F.floorExportSupplierRFQXLSX(); } },
    { id: 'summary', label: '📊 ' + 'Resumo do takeoff (PDF)', fn: function () { return F.floorExportSummaryPDF(); } },
    { id: 'plan', label: '🗺️ ' + 'Planta marcada (PDF)', fn: function () { return F.floorExportMarkedPlanPDF(); } }
  ];
})();
