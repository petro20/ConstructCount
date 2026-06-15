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

  // lista dos relatórios de Piso/Forro (Central de relatórios)
  F.floorReports = [
    { id: 'confer', label: '✅ ' + 'Conferir acabamentos (tipo / fabricante)', fn: function () { if (F.openFinishConferencia) F.openFinishConferencia(); } },
    { id: 'quote', label: '📄 ' + 'Orçamento ao cliente — projeto (PDF)', fn: function () { return F.floorExportProjectPDF(); } },
    { id: 'summary', label: '📊 ' + 'Resumo técnico — projeto (PDF)', fn: function () { return F.floorExportSummaryPDF(); } },
    { id: 'materials', label: '📦 ' + 'Lista de materiais / Pedido (Excel)', fn: function () { return F.floorExportMaterialsXLSX(); } },
    { id: 'plan', label: '🗺️ ' + 'Planta marcada (PDF)', fn: function () { return F.floorExportMarkedPlanPDF(); } }
  ];
})();
