/* =========================================================================
   floor-report.js — RELATÓRIOS dos pacotes PISO e FORRO.
   Usa a mesma base dos relatórios (jsPDF + autotable + XLSX + marca da
   empresa do export.js). Dados: F.floorReportData() (floor-takeoff.js).
     • Orçamento ao cliente (PDF, com preços)  → F.floorExportQuotePDF()
     • Resumo do takeoff (PDF, técnico)         → F.floorExportSummaryPDF()
     • Lista de materiais / Pedido (Excel)      → F.floorExportMaterialsXLSX()
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
  var fname = function (base, ext) { return 'piso-forro-' + base + '.' + ext; };
  function need(ok) { if (!ok && F.flashExport) F.flashExport('⚠️ ' + tr('Biblioteca de relatório indisponível.')); return ok; }
  function data() { return F.floorReportData ? F.floorReportData() : null; }
  function noData() { if (F.flashExport) F.flashExport('⚠️ ' + tr('Meça áreas de Piso/Forro para gerar o relatório.')); }
  function hasAny(d) { return d && ((d.floor && d.floor.length) || (d.ceiling && d.ceiling.length)); }

  function sectionRows(rows, withPrice) {
    return rows.map(function (r) {
      var base = [r.item, r.material || '—', r.manufacturer || '—', n1(r.qty), r.unit];
      return withPrice ? base.concat([money(r.price), money(r.mat), money(r.lab), money(r.cost), money(r.sale)]) : base;
    });
  }

  /* ---------- Orçamento ao cliente (PDF, com preços) ---------- */
  F.floorExportQuotePDF = async function () {
    if (!need(window.jspdf)) return;
    var d = data(); if (!hasAny(d)) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF();
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Orçamento — Piso & Forro'));
    var py = 36; doc.setTextColor(60); doc.setFontSize(9);
    if (d.region) { doc.text(tr('Região: {r}', { r: d.region }), 14, py); py += 5; }
    doc.text(tr('Piso: {f} SF · Forro: {c} SF · sobra {w}% · imposto {t}% · ganho {g}%', { f: d.totFloor.sf.toFixed(0), c: d.totCeiling.sf.toFixed(0), w: num(d.waste), t: num(d.tax), g: num(d.markup) }), 14, py); py += 4;

    var head = [['ITEM', tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un'), tr('Preço un.'), tr('Material'), tr('M.O.'), tr('Custo'), tr('Venda')]];
    var body = [];
    if (d.floor.length) { body.push([{ content: '🟩 ' + tr('Piso'), colSpan: 10, styles: { fontStyle: 'bold', fillColor: [222, 247, 236], textColor: 20 } }]); body = body.concat(sectionRows(d.floor, true)); }
    if (d.ceiling.length) { body.push([{ content: '🟦 ' + tr('Forro'), colSpan: 10, styles: { fontStyle: 'bold', fillColor: [219, 234, 254], textColor: 20 } }]); body = body.concat(sectionRows(d.ceiling, true)); }
    doc.autoTable({
      startY: py + 3, head: head, body: body, theme: 'striped',
      headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255, fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.4, valign: 'middle' },
      columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right', fontStyle: 'bold' } }
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

  /* ---------- Resumo do takeoff (PDF, técnico, sem preços) ---------- */
  F.floorExportSummaryPDF = async function () {
    if (!need(window.jspdf)) return;
    var d = data(); if (!hasAny(d)) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF();
    if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Resumo do takeoff — Piso & Forro'));
    var head = [['ITEM', tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un')]];
    var body = [];
    if (d.floor.length) { body.push([{ content: '🟩 ' + tr('Piso'), colSpan: 5, styles: { fontStyle: 'bold', fillColor: [222, 247, 236] } }]); body = body.concat(sectionRows(d.floor, false)); }
    if (d.ceiling.length) { body.push([{ content: '🟦 ' + tr('Forro'), colSpan: 5, styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }]); body = body.concat(sectionRows(d.ceiling, false)); }
    doc.autoTable({
      startY: 38, head: head, body: body, theme: 'grid',
      headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255, fontSize: 8 },
      styles: { fontSize: 8.5, cellPadding: 2 }, columnStyles: { 3: { halign: 'right' } }
    });
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('resumo', 'pdf'), doc.output('arraybuffer'));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Resumo do takeoff') + ' (PDF) ✓');
  };

  /* ---------- Lista de materiais / Pedido (Excel) ---------- */
  F.floorExportMaterialsXLSX = async function () {
    if (!need(window.XLSX)) return;
    var d = data(); if (!hasAny(d)) return noData();
    var L = await pickL(); if (!L) return;
    var aoa = [[tr('ITEM'), tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un')]];
    var add = function (title, rows) { if (!rows.length) return; aoa.push([title]); rows.forEach(function (r) { aoa.push([r.item, r.material || '', r.manufacturer || '', Math.round(r.qty * 10) / 10, r.unit]); }); };
    add('🟩 ' + tr('Piso'), d.floor); add('🟦 ' + tr('Forro'), d.ceiling);
    var ws = window.XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 26 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 6 }];
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Piso-Forro');
    await F.saveBytes(fname('materiais', 'xlsx'), window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Lista de materiais') + ' (Excel) ✓');
  };

  /* ---------- Projeto inteiro (PDF) — 1 página por FOLHA com takeoff ---------- */
  F.floorExportProjectPDF = async function () {
    if (!need(window.jspdf)) return;
    var d = F.floorReportDataAll ? F.floorReportDataAll() : null;
    if (!d || !d.sheets.length) return noData();
    var L = await pickL(); if (!L) return;
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF(), first = true;
    d.sheets.forEach(function (s) {
      if (!first) doc.addPage(); first = false;
      if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Piso & Forro — Folha {s}', { s: s.sheet }));
      doc.setTextColor(60); doc.setFontSize(9);
      doc.text(tr('Folha {s} · Piso: {f} SF · Forro: {c} SF', { s: s.sheet, f: s.totFloor.sf.toFixed(0), c: s.totCeiling.sf.toFixed(0) }), 14, 36);
      var head = [['ITEM', tr('Tipo de material'), tr('Fabricante'), tr('Qtd'), tr('Un'), tr('Custo'), tr('Venda')]];
      var body = [];
      var rowsP = function (rows) { return rows.map(function (r) { return [r.item, r.material || '—', r.manufacturer || '—', n1(r.qty), r.unit, money(r.cost), money(r.sale)]; }); };
      if (s.floor.length) { body.push([{ content: '🟩 ' + tr('Piso'), colSpan: 7, styles: { fontStyle: 'bold', fillColor: [222, 247, 236] } }]); body = body.concat(rowsP(s.floor)); }
      if (s.ceiling.length) { body.push([{ content: '🟦 ' + tr('Forro'), colSpan: 7, styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }]); body = body.concat(rowsP(s.ceiling)); }
      doc.autoTable({
        startY: 40, head: head, body: body, theme: 'striped',
        headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 1.6 }, columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } }
      });
      var y = doc.lastAutoTable.finalY + 6; if (y > 270) { doc.addPage(); y = 24; }
      doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(36, 52, 75);
      doc.text(tr('Folha {s} — Venda: {v}', { s: s.sheet, v: money(s.grand.sale) }), 14, y);
      doc.setFont(undefined, 'normal');
    });
    // página final: resumo por folha + total do projeto
    doc.addPage(); if (F._pdfBrandHeader) F._pdfBrandHeader(doc, tr('Resumo do projeto — Piso & Forro'));
    doc.autoTable({
      startY: 38,
      head: [[tr('Folha'), tr('Piso') + ' SF', tr('Forro') + ' SF', tr('Custo'), tr('Venda')]],
      body: d.sheets.map(function (s) { return [s.sheet, s.totFloor.sf.toFixed(0), s.totCeiling.sf.toFixed(0), money(s.grand.cost), money(s.grand.sale)]; }),
      foot: [[tr('TOTAL'), '', '', money(d.grand.cost), money(d.grand.sale)]],
      headStyles: { fillColor: (F._brAccentRGB ? F._brAccentRGB() : [44, 71, 106]), textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2.5 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });
    if (F._pdfBrandFooterAll) F._pdfBrandFooterAll(doc);
    await F.saveBytes(fname('projeto', 'pdf'), doc.output('arraybuffer'));
    DOCL = null; if (F.flashExport) F.flashExport('✓ ' + tr('Projeto (Piso & Forro)') + ' (PDF) ✓');
  };

  // lista dos relatórios de Piso/Forro (Central de relatórios)
  F.floorReports = [
    { id: 'confer', label: '✅ ' + 'Conferir acabamentos (tipo / fabricante)', fn: function () { if (F.openFinishConferencia) F.openFinishConferencia(); } },
    { id: 'project', label: '🏢 ' + 'Projeto inteiro — por folha (PDF)', fn: function () { return F.floorExportProjectPDF(); } },
    { id: 'quote', label: '📄 ' + 'Orçamento ao cliente (PDF)', fn: function () { return F.floorExportQuotePDF(); } },
    { id: 'summary', label: '📊 ' + 'Resumo do takeoff (PDF)', fn: function () { return F.floorExportSummaryPDF(); } },
    { id: 'materials', label: '📦 ' + 'Lista de materiais / Pedido (Excel)', fn: function () { return F.floorExportMaterialsXLSX(); } }
  ];
})();
