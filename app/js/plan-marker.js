/* =========================================================================
   plan-marker.js — sobrepõe marcas (cor + forma) e o quadro resumo sobre o
   PDF original da planta, usando pdf-lib. Saída: planta-marcada.pdf
   Depende de: calculator.js (markRGB/markShape), export.js (flashExport)
   ========================================================================= */

'use strict';

window.ConstructCount = window.ConstructCount || {};

(function (F) {

  function rgbOf(idx) {
    const [r, g, b] = F.markRGB(idx);
    return PDFLib.rgb(r / 255, g / 255, b / 255);
  }

  function starPoints(r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = (i % 2 === 0) ? r : r * 0.4;
      pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
    }
    return pts;
  }

  function shapePath(shape, r) {
    const sets = {
      triangle: [[0, -r], [r, r], [-r, r]],
      diamond:  [[0, -r], [r, 0], [0, r], [-r, 0]],
      hexagon:  [[-r * 0.5, -r * 0.87], [r * 0.5, -r * 0.87], [r, 0], [r * 0.5, r * 0.87], [-r * 0.5, r * 0.87], [-r, 0]],
      pentagon: [[0, -r], [r * 0.95, -r * 0.31], [r * 0.59, r * 0.81], [-r * 0.59, r * 0.81], [-r * 0.95, -r * 0.31]],
      star:     starPoints(r),
      cross:    [[-r / 3, -r], [r / 3, -r], [r / 3, -r / 3], [r, -r / 3], [r, r / 3], [r / 3, r / 3], [r / 3, r], [-r / 3, r], [-r / 3, r / 3], [-r, r / 3], [-r, -r / 3], [-r / 3, -r / 3]]
    };
    const pts = sets[shape];
    if (!pts) return null;
    return 'M ' + pts.map(p => p.join(' ')).join(' L ') + ' Z';
  }

  /** Desenha a marca (forma colorida) centrada em (x,y) numa página pdf-lib. */
  function drawMark(page, shape, x, y, r, color) {
    if (shape === 'circle') { page.drawCircle({ x, y, size: r, color, borderColor: PDFLib.rgb(0, 0, 0), borderWidth: 0.3 }); return; }
    if (shape === 'square') { page.drawRectangle({ x: x - r, y: y - r, width: 2 * r, height: 2 * r, color, borderColor: PDFLib.rgb(0, 0, 0), borderWidth: 0.3 }); return; }
    const d = shapePath(shape, r);
    if (d) page.drawSvgPath(d, { x, y, color, borderColor: PDFLib.rgb(0, 0, 0), borderWidth: 0.3 });
    else page.drawCircle({ x, y, size: r, color });
  }

  /** Caixa "Quadro Resumo" num canto da página (topo-direita). */
  function drawLegend(page, items, font) {
    const { width, height } = page.getSize();
    const pad = 8, lh = 13, boxW = 200;
    const boxH = lh * (items.length + 1) + pad * 2;
    const x0 = Math.max(8, width - boxW - 12);
    const y0 = Math.max(8, height - boxH - 12);

    page.drawRectangle({ x: x0, y: y0, width: boxW, height: boxH, color: PDFLib.rgb(1, 1, 1), opacity: 0.9, borderColor: PDFLib.rgb(0.2, 0.2, 0.2), borderWidth: 1 });
    let y = y0 + boxH - pad - 6;
    page.drawText(F.tr('QUADRO RESUMO'), { x: x0 + pad, y, size: 8, font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    y -= lh;
    items.forEach((it, idx) => {
      drawMark(page, F.markShape(idx), x0 + pad + 5, y + 3, 5, rgbOf(idx));
      const label = F.tr('{id}  {type}  {width}x{height}  Qtd {qty}', { id: it.id, type: it.type, width: it.width, height: it.height, qty: it.qty });
      page.drawText(label, { x: x0 + pad + 16, y, size: 7, font, color: PDFLib.rgb(0.15, 0.15, 0.15) });
      y -= lh;
    });
  }

  /** Núcleo testável: recebe bytes do PDF + itens, devolve Uint8Array marcado. */
  F.buildMarkedPlan = async function (pdfBytes, items) {
    const pdf = await PDFLib.PDFDocument.load(pdfBytes);
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdf.getPages();

    // marca cada ocorrência sobre a janela
    items.forEach((it, idx) => {
      const color = rgbOf(idx);
      (it.placements || []).forEach(pl => {
        const page = pages[(pl.page || 1) - 1];
        if (!page) return;
        const { width, height } = page.getSize();
        const x = Math.max(0, Math.min(1, pl.x)) * width;
        const y = height - Math.max(0, Math.min(1, pl.y)) * height;   // PDF: y de baixo p/ cima
        drawMark(page, F.markShape(idx), x, y, 7, color);
        page.drawText(String(it.id), { x: x + 8, y: y - 3, size: 7, font, color });
      });
    });

    // legenda em cada folha
    pages.forEach(pg => drawLegend(pg, items, font));
    return await pdf.save();
  };

  /** Baixa a planta marcada usando o PDF original enviado. */
  F.exportMarkedPlan = async function () {
    if (!F.state.pdfBytes) {
      F.flashExport(F.tr('Envie um PDF real da planta para gerar a versão marcada.'));
      return;
    }
    const bytes = base64ToUint8(F.state.pdfBytes);
    let out;
    try {
      out = await F.buildMarkedPlan(bytes, F.state.items);
    } catch (e) {
      F.flashExport(F.tr('Não foi possível abrir/marcar o PDF ({e}).', { e: e.message }));
      return;
    }
    const blob = new Blob([out], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'planta-marcada.pdf'; a.click();
    URL.revokeObjectURL(url);

    const temMarcas = F.state.items.some(it => Array.isArray(it.placements) && it.placements.length);
    F.flashExport(temMarcas
      ? F.tr('✓ Planta marcada (PDF) gerada — marcas nas janelas + quadro resumo.')
      : F.tr('✓ PDF gerado com o quadro resumo em cada folha (a IA não retornou coordenadas das marcas).'));
  };

  function base64ToUint8(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

})(window.ConstructCount);
