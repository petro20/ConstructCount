/* =========================================================================
   export.js — geração dos documentos finais
   - Orçamento Cliente (PDF, COM preços)       → Fenestra.exportClientPDF()
   - Pedido Fornecedor (Excel .xlsx, SEM preços) → Fenestra.exportSupplierXLSX()
   ========================================================================= */

'use strict';

window.ConstructCount = window.ConstructCount || {};

(function (F) {

  /* ----- rótulos PT por tipo (porta + janela), sem chutar nada ----- */
  const OP_PT = {
    'Casement Window': 'Janela Casement (abrir)', 'Double Casement': 'Janela Casement 2 folhas',
    'Sliding Window': 'Janela de correr', 'Awning Window': 'Janela basculante / maxim-ar',
    'Double Hung': 'Janela guilhotina', 'Picture / Fixed': 'Janela fixa', 'Fixed Window': 'Janela fixa',
    'Twin Window': 'Janela geminada (Twin)',
    'Single Door': 'Porta de abrir', 'Single Swing Door': 'Porta de abrir', 'Double Swing Door': 'Porta 2 folhas',
    'Pre-Hung Door': 'Porta pré-montada', 'Pocket Door': 'Porta embutida', 'Bifold Door': 'Porta sanfonada',
    'Bypass / Sliding Closet': 'Porta de correr (armário)', 'Barn Door': 'Porta celeiro', 'French Door': 'Porta francesa',
    'Dutch Door': 'Porta holandesa', 'Sliding Door': 'Porta de correr', 'Sliding Glass / Patio': 'Porta de correr de vidro',
    'Entry Door': 'Porta de entrada', 'Fire-Rated Door': 'Porta corta-fogo', 'Flush Door': 'Porta lisa',
    'Panel Door': 'Porta almofadada', 'Garage Door': 'Portão de garagem', 'Storefront Door': 'Porta de fachada',
    'Storefront': 'Fachada envidraçada (storefront)',
  };
  const T = (s, v, L) => (F.tr ? F.tr(s, v, L) : s);   // tradução p/ o idioma do documento
  const opPt = (t, L) => T(OP_PT[t] || t || '—', null, L);
  const isDoorItem = (it) => /Door|Porta|Portão/i.test(it.type || '') || !!it.material || !!it.spec;

  /** Mão da folha (lado + sentido), só se definido no projeto — nunca chuta */
  function maoText(it, L) {
    const lado = it.side === 'R' ? T('Direita', null, L) : it.side === 'L' ? T('Esquerda', null, L) : '';
    const sent = it.swing === 'out' ? T('abre p/ fora', null, L) : it.swing === 'in' ? T('abre p/ dentro', null, L) : '';
    const v = [lado, sent].filter(Boolean).join(' · ');
    return v || (isDoorItem(it) ? T('a definir (conforme projeto)', null, L) : '');
  }

  /** Pares Label→valor lidos do projeto p/ a coluna de especificação (só campos preenchidos) */
  function specPairs(it, L) {
    const out = [];
    if (it.material) out.push([T('Material', null, L), it.material]);
    const vidro = it.glass || it.glazing;
    if (vidro) out.push([T('Vidro', null, L), vidro]);
    else if (isDoorItem(it)) out.push([T('Vidro', null, L), T('— (folha sólida)', null, L)]);
    if (it.hinges) out.push([T('Dobradiças', null, L), it.hinges]);
    if (it.lockset) out.push([T('Fechadura', null, L), it.lockset]);
    if (it.saddle) out.push([T('Soleira', null, L), it.saddle]);
    if (it.fire) out.push([T('Corta-fogo', null, L), it.fire]);
    if (it.panels) out.push([T('Almofadas', null, L), it.panels]);
    if (it.louvered) out.push([T('Veneziana', null, L), it.louvered]);
    if (it.color) out.push([T('Cor', null, L), it.color]);
    const mao = maoText(it, L);
    if (mao) out.push([T('Mão', null, L), mao]);
    if (it.notes) out.push([T('Obs', null, L), it.notes]);
    return out;
  }

  /* locale de data por idioma do documento */
  const DATE_LOC = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

  /* nomes de arquivo localizados (sem espaço/acentos) */
  const FILE = {
    quote:    { pt: 'orcamento-cliente', en: 'client-quote',    es: 'presupuesto-cliente' },
    supplier: { pt: 'pedido-fornecedor', en: 'supplier-order',  es: 'pedido-proveedor' },
    summary:  { pt: 'quadro-resumo',     en: 'summary-table',   es: 'cuadro-resumen' },
  };
  const fileName = (kind, L, ext) => (FILE[kind][L] || FILE[kind].pt) + '.' + ext;

  /* medida imperial (usa a original do projeto; se faltar, converte de mm — sem chutar) */
  function ftInE(mm) {
    if (!mm || mm <= 0) return '';
    let s = Math.round(mm / 25.4 * 16), ft = Math.floor(s / 192), rem = s - ft * 192;
    let inch = Math.floor(rem / 16), fr = rem % 16, out = ft + "'-" + inch;
    if (fr) { let n = fr, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } out += ' ' + n + '/' + d; }
    return out + '"';
  }
  const ftLabelE = (it) => {
    const w = it.widthOrig || ftInE(it.width), h = it.heightOrig || ftInE(it.height);
    return (w || h) ? ((w || '?') + ' × ' + (h || '?')) : '';
  };

  /* ============ Marca dos relatórios (logo · empresa · cor) — salvo por máquina ============ */
  const BRAND_KEY = 'cc_report_brand';
  F.reportBrand = function () {
    let b = {};
    try { b = JSON.parse(localStorage.getItem(BRAND_KEY) || '{}') || {}; } catch (e) {}
    return {
      company: (b.company || '').trim() || 'ConstructCount',
      line2: (b.line2 || '').trim(),
      logo: b.logo || '', logoAR: b.logoAR || 1,
      accent: b.accent || '#2c476a',
      footer: (b.footer || '').trim(),
    };
  };
  F.saveReportBrand = function (b) { try { localStorage.setItem(BRAND_KEY, JSON.stringify(b || {})); } catch (e) {} };
  function brAccentRGB() {
    let h = (F.reportBrand().accent || '#2c476a').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h || '2c476a', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** cabeçalho de marca num PDF jsPDF (faixa colorida + logo + empresa + subtítulo) */
  function pdfBrandHeader(doc, subtitle) {
    const W = 210, H = 28, b = F.reportBrand();
    const [r, g, bl] = brAccentRGB();
    doc.setFillColor(r, g, bl); doc.rect(0, 0, W, H, 'F');
    let tx = 14;
    if (b.logo) {
      try {
        const hh = 18, ww = Math.max(6, Math.min(46, hh * (b.logoAR || 1)));
        const fmt = /image\/jpe?g/i.test(b.logo) ? 'JPEG' : 'PNG';
        doc.addImage(b.logo, fmt, 14, 5, ww, hh); tx = 14 + ww + 5;
      } catch (e) {}
    }
    doc.setTextColor(255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text(b.company, tx, 13);
    if (subtitle) { doc.setFontSize(9.5); doc.setFont(undefined, 'normal'); doc.text(String(subtitle), tx, 20); }
    if (b.line2) { doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.text(b.line2, W - 14, 12, { align: 'right' }); }
    doc.setFont(undefined, 'normal');
  }
  /** rodapé opcional (texto centralizado no rodapé de cada página) */
  function pdfBrandFooterAll(doc) {
    const b = F.reportBrand();
    if (!b.footer) return;
    const W = 210, np = doc.getNumberOfPages(), Hh = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= np; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(120, 130, 145); doc.setFont(undefined, 'normal');
      doc.text(b.footer, W / 2, Hh - 6, { align: 'center' });
    }
  }

  /* ----- Orçamento Cliente (PDF) — detalhado, conforme o projeto ----- */
  F.exportClientPDF = async function () {
    const L = F.pickDocLang ? await F.pickDocLang() : (F.getLang ? F.getLang() : 'pt');
    if (!L) return;                                  // cancelado
    const t = (s, v) => T(s, v, L);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const c = F.state.costs || {};
    const p = F.state.project;
    const items = F.state.items || [];
    const W = 210;

    // cabeçalho de marca (empresa · logo · cor) — configurável em "Marca / Relatórios"
    pdfBrandHeader(doc, t('Orçamento ao Cliente — Esquadrias (portas & janelas)'));

    // dados do projeto
    doc.setTextColor(36, 52, 75);
    doc.setFontSize(11);
    let py = 38;
    doc.text(`${t('Projeto')}: ${p.name || '-'}`, 14, py); py += 6;
    doc.text(`${t('Cliente')}: ${p.client || '-'}`, 14, py); py += 6;
    if (p.email) { doc.text(`${t('E-mail')}: ${p.email}`, 14, py); py += 6; }
    if (p.phone) { doc.text(`${t('Telefone')}: ${p.phone}`, 14, py); py += 6; }
    doc.text(`${t('Data')}: ${new Date().toLocaleDateString(DATE_LOC[L] || 'pt-BR')}`, 14, py); py += 4;

    // faixa de resumo (tipos · unidades · portas/janelas · área)
    const nDoor = items.filter(isDoorItem).length;
    const nWin = items.length - nDoor;
    const totalQty = items.reduce((s, it) => s + it.qty, 0);
    const totalArea = F.totalAreaM2() || 1;
    py += 4;
    doc.setFillColor(238, 242, 248); doc.rect(14, py, W - 28, 9, 'F');
    doc.setFontSize(9); doc.setTextColor(60, 80, 110); doc.setFont(undefined, 'bold');
    const tipos = t('tipos'), unid = t('unidades');
    const brk = (nDoor && nWin) ? `${nDoor} ${t('portas')} · ${nWin} ${t('janelas')}`
      : nDoor ? `${nDoor} ${t('tipos de porta')}` : `${nWin} ${t('tipos de janela')}`;
    doc.text(`${items.length} ${tipos}  ·  ${totalQty} ${unid}  ·  ${brk}  ·  ${F.fmtArea(totalArea)} ${F.unitSuffix()}`, 16, py + 6);
    py += 13;

    // monta linhas (com cabeçalho de seção quando houver mais de uma)
    const sections = [...new Set(items.map(it => it.section || 'Esquadrias'))];
    const multiSec = sections.length > 1;
    const body = [];
    const rowMeta = [];   // paralelo ao body: {idx, isHeader, missing}
    sections.forEach(sec => {
      if (multiSec) {
        body.push([{ content: '▸ ' + t(sec), colSpan: 8, styles: { fillColor: [224, 230, 240], textColor: [36, 52, 75], fontStyle: 'bold', halign: 'left' } }]);
        rowMeta.push({ isHeader: true });
      }
      items.forEach((it, idx) => {
        if ((it.section || 'Esquadrias') !== sec) return;
        const itemArea = F.areaM2(it) * it.qty;
        const itemPrice = (c.price || 0) * (itemArea / totalArea);
        const orig = (it.widthOrig || it.heightOrig) ? `${it.widthOrig || '?'} × ${it.heightOrig || '?'}` : '';
        const medida = `${it.width}×${it.height} mm` + (orig ? '\n' + orig : '');
        let spec = specPairs(it, L).map(pr => `${pr[0]}: ${pr[1]}`).join('\n');
        if (it.missingMark) spec += (spec ? '\n' : '') + t('⚠ marca reconstruída do texto (sem hexágono no projeto) — confirmar marcação');
        else if (it.discrepancy) spec += (spec ? '\n' : '') + '⚠ ' + it.discrepancy;
        body.push(['', it.id, opPt(it.type, L), medida, it.qty, F.fmtArea(itemArea) + ' ' + F.unitSuffix(), spec || '—', F.money(itemPrice)]);
        rowMeta.push({ idx, missing: !!it.missingMark || !!it.discrepancy });
      });
    });

    doc.autoTable({
      startY: py,
      head: [['', t('Marca'), t('Tipo'), t('Medida'), t('Qtd'), t('Área'), t('Especificações (conforme o projeto)'), t('Preço')]],
      body,
      theme: 'striped',
      headStyles: { fillColor: [54, 88, 131], textColor: 255, fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.6, valign: 'top', overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 7 }, 1: { cellWidth: 13, fontStyle: 'bold' }, 2: { cellWidth: 28 },
        3: { cellWidth: 24 }, 4: { cellWidth: 10, halign: 'center' }, 5: { cellWidth: 18 },
        6: { cellWidth: 50 }, 7: { cellWidth: 22, halign: 'right' }
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const m = rowMeta[data.row.index];
        if (!m || m.isHeader) return;
        if (data.column.index === 0) data.cell.styles.fillColor = F.markRGB(m.idx);
        if (m.missing && data.column.index === 6) data.cell.styles.textColor = [180, 83, 9];
      }
    });

    let y = doc.lastAutoTable.finalY + 8;
    if (y > 250) { doc.addPage(); y = 24; }
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.setTextColor(36, 52, 75);
    doc.text(t('VALOR FINAL: {v}', { v: F.money(c.price || 0) }), 14, y);

    y += 12;
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(t('Condições de pagamento'), 14, y);
    doc.setFont(undefined, 'normal'); doc.setFontSize(9);
    const terms = [
      '• 50% de entrada na aprovação do orçamento;',
      '• 50% na entrega/instalação;',
      '• Prazo de produção: 25 dias úteis;',
      '• Validade da proposta: 15 dias;',
      '• Pix, transferência ou cartão (até 12x).'
    ];
    terms.forEach((s, i) => doc.text(t(s), 14, y + 7 + i * 6));

    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(t('Especificações lidas do projeto (door/window schedule). Itens sem dado: "a definir" — nada foi assumido.'), 14, 286);

    pdfBrandFooterAll(doc);                           // rodapé da empresa (se definido)
    F.saveBytes(fileName('quote', L, 'pdf'), doc.output('arraybuffer'));
    F.flashExport('✓ ' + t('Orçamento Cliente') + ' (PDF) ✓');
  };

  /* ----- Pedido Fornecedor (Excel .xlsx) — SEM preços ----- */
  F.exportSupplierXLSX = async function () {
    const L = F.pickDocLang ? await F.pickDocLang() : (F.getLang ? F.getLang() : 'pt');
    if (!L) return;
    const t = (s, v) => T(s, v, L);
    const p = F.state.project;
    const brand = F.reportBrand();
    const aoa = [[brand.company]];
    if (brand.line2) aoa.push([brand.line2]);
    const titleRow = aoa.length;                      // linha do título (após empresa/contato)
    aoa.push([t('PEDIDO AO FORNECEDOR')]);
    aoa.push([t('Projeto'), p.name || '-', '', t('Cliente'), p.client || '-']);
    aoa.push([t('Data'), new Date().toLocaleDateString(DATE_LOC[L] || 'pt-BR')]);
    aoa.push([]);
    aoa.push(['Item', t('Marca (cor)'), t('Forma'), t('Medida (mm)'), t('Medida original'), t('Qtd'), t('Tipo'),
        t('Material'), t('Vidro'), t('Cor'), t('Dobradiças'), t('Fechadura'), t('Soleira'), t('Corta-fogo'), t('Mão'), t('Observacoes')]);
    F.state.items.forEach((it, idx) => {
      const orig = (it.widthOrig || it.heightOrig) ? `${it.widthOrig || '?'} x ${it.heightOrig || '?'}` : '';
      const obs = [it.notes, it.missingMark ? t('⚠ marca reconstruída do texto — confirmar marcação') : '', !it.missingMark && it.discrepancy ? '⚠ ' + it.discrepancy : '']
        .filter(Boolean).join(' | ');
      aoa.push([it.id, F.markHex(idx), F.markShape(idx), `${it.width}x${it.height}mm`, orig, it.qty, opPt(it.type, L),
        it.material || '', it.glass || it.glazing || (isDoorItem(it) ? t('— (folha sólida)') : ''), it.color || '',
        it.hinges || '', it.lockset || '', it.saddle || '', it.fire || '', maoText(it, L), obs]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 8 }, { wch: 11 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 30 }
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },                  // nome da empresa
      { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 15 } },    // título PEDIDO AO FORNECEDOR
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('Pedido Fornecedor').slice(0, 31));
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    F.saveBytes(fileName('supplier', L, 'xlsx'), u8);
    F.flashExport('✓ ' + t('Pedido Fornecedor') + ' (Excel .xlsx) ✓');
  };

  /* ----- Quadro Resumo (PDF) — legenda colorida + quantidades p/ anexar a cada planta ----- */
  function svgToPng(svg, px) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = px; c.height = px;
        c.getContext('2d').drawImage(img, 0, 0, px, px);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
  }

  F.exportSummaryPDF = async function () {
    const L = F.pickDocLang ? await F.pickDocLang() : (F.getLang ? F.getLang() : 'pt');
    if (!L) return;
    const t = (s, v) => T(s, v, L);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const p = F.state.project;

    // cabeçalho de marca + linha de projeto/cliente
    pdfBrandHeader(doc, t('Quadro Resumo de Esquadrias'));
    doc.setTextColor(90, 100, 115); doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text((p.name || '') + (p.client ? ' — ' + p.client : ''), 14, 34);

    // colunas
    doc.setTextColor(36, 52, 75);
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    let y = 38;
    doc.text(t('Marca'), 14, y);
    doc.text('ID', 34, y);
    doc.text(t('Tipo'), 52, y);
    doc.text(t('Medida (mm / ft)'), 110, y);
    doc.text(t('Qtd'), 175, y);
    doc.setDrawColor(200); doc.line(14, y + 2, 196, y + 2);
    doc.setFont(undefined, 'normal');
    y += 9;

    for (let i = 0; i < F.state.items.length; i++) {
      const it = F.state.items[i];
      const png = await svgToPng(F.markBadgeSVG(F.markShape(i), F.markColor(i), 48), 48);
      doc.addImage(png, 'PNG', 14, y - 5, 7, 7);
      doc.text(String(it.id), 34, y);
      doc.text(opPt(it.type, L), 52, y);
      doc.text(`${it.width} × ${it.height} mm`, 110, y);
      const ft = ftLabelE(it);
      if (ft) { doc.setFontSize(7.5); doc.setTextColor(110); doc.text(ft, 110, y + 4); doc.setFontSize(9); doc.setTextColor(36, 52, 75); }
      doc.text(String(it.qty), 177, y);
      y += 11;
      if (y > 278) { doc.addPage(); y = 20; }
    }

    const total = F.state.items.reduce((s, it) => s + it.qty, 0);
    doc.setDrawColor(200); doc.line(14, y - 4, 196, y - 4);
    doc.setFont(undefined, 'bold');
    doc.text(t('Total de unidades'), 52, y + 2);
    doc.text(String(total), 177, y + 2);

    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(t('Cada tipo possui cor e forma únicas. Anexe este quadro a cada planta.'), 14, 290);

    F.saveBytes(fileName('summary', L, 'pdf'), doc.output('arraybuffer'));
    F.flashExport('✓ ' + t('Quadro Resumo') + ' (PDF) ✓');
  };

  /** Mensagem temporária de feedback de exportação */
  F.flashExport = function (msg) {
    const el = document.querySelector('#exportMsg');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  };

  /* ---- painel "Marca / Relatórios" (logo/empresa/cor/rodapé) ---- */
  function downscaleLogo(file, cb) {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxH = 120, ar = (img.width / img.height) || 1;
        const h = Math.min(maxH, img.height), w = Math.round(h * ar);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const isJpg = /jpe?g/i.test(file.type);
        cb(c.toDataURL(isJpg ? 'image/jpeg' : 'image/png', 0.9), ar);
      };
      img.onerror = () => cb('', 1);
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  F.openReportBrand = function () {
    const m = document.querySelector('#brandModal'); if (!m) return;
    const b = F.reportBrand();
    const set = (id, v) => { const e = document.querySelector(id); if (e) e.value = v; };
    set('#brName', b.company === 'ConstructCount' ? '' : b.company);
    set('#brLine2', b.line2); set('#brAccent', b.accent || '#2c476a'); set('#brFooter', b.footer);
    const prev = document.querySelector('#brLogoPrev'), clr = document.querySelector('#brLogoClear');
    m._logo = b.logo; m._logoAR = b.logoAR;
    if (b.logo && prev) { prev.src = b.logo; prev.classList.remove('hidden'); if (clr) clr.classList.remove('hidden'); }
    else { if (prev) prev.classList.add('hidden'); if (clr) clr.classList.add('hidden'); }
    m.classList.remove('hidden');
  };
  (function wireBrand() {
    const onReady = () => {
      const m = document.querySelector('#brandModal'); if (!m) return;
      const $ = (id) => document.querySelector(id);
      const open = $('#miReportBrand'); if (open) open.addEventListener('click', F.openReportBrand);
      const cancel = $('#brCancel'); if (cancel) cancel.addEventListener('click', () => m.classList.add('hidden'));
      const logoIn = $('#brLogo');
      if (logoIn) logoIn.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        downscaleLogo(f, (data, ar) => {
          m._logo = data; m._logoAR = ar;
          const prev = $('#brLogoPrev'), clr = $('#brLogoClear');
          if (prev && data) { prev.src = data; prev.classList.remove('hidden'); if (clr) clr.classList.remove('hidden'); }
        });
      });
      const clr = $('#brLogoClear');
      if (clr) clr.addEventListener('click', () => {
        m._logo = ''; m._logoAR = 1;
        const prev = $('#brLogoPrev'); if (prev) prev.classList.add('hidden'); clr.classList.add('hidden');
        const inp = $('#brLogo'); if (inp) inp.value = '';
      });
      const save = $('#brSave');
      if (save) save.addEventListener('click', () => {
        const val = (id) => { const e = $(id); return e ? (e.value || '').trim() : ''; };
        F.saveReportBrand({
          company: val('#brName'), line2: val('#brLine2'),
          accent: val('#brAccent') || '#2c476a',
          logo: m._logo || '', logoAR: m._logoAR || 1,
          footer: val('#brFooter'),
        });
        m.classList.add('hidden');
        if (F.flashExport) F.flashExport('✓ Marca dos relatórios salva ✓');
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
  })();

})(window.ConstructCount);
