/* =========================================================================
   proposal.js — Proposta ao Cliente (PDF) no estilo EVOLUTZIA
   Capa · Dados · Posições (desenho + specs, SEM marca do fornecedor) · Pricing · Contato
   Depende de: jsPDF, calculator.js, svg-engine.js (svgMarkup), export.js
   ========================================================================= */

'use strict';

window.ConstructCount = window.ConstructCount || {};

(function (F) {

  // Marca/empresa da PROPOSTA — edite aqui
  F.PROPOSAL = {
    company: 'ConstructCount',
    address: '',                 // endereço da empresa (preencher com o da M2PB)
    contact: 'm2pb.com',
    productLine: 'WINDOW 80',
    systemName: 'IMPACT 80 Windows',
    color: 'BLACK MATT — outside / white inside',
  };

  function svgToImg(svg) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
  }
  async function svgPng(svg, scale = 2) {
    const img = await svgToImg(svg);
    const w = img.naturalWidth || 320, h = img.naturalHeight || 320;
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { url: c.toDataURL('image/png'), w, h };
  }

  /** mm → 7'-0 1/2" (fração 1/16") — p/ medida imperial quando não há original do projeto */
  function ftIn(mm) {
    if (!mm || mm <= 0) return '';
    let s = Math.round(mm / 25.4 * 16), ft = Math.floor(s / 192), rem = s - ft * 192;
    let inch = Math.floor(rem / 16), fr = rem % 16, out = ft + "'-" + inch;
    if (fr) { let n = fr, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } out += ' ' + n + '/' + d; }
    return out + '"';
  }
  /** medida em pés do item: usa a original do projeto; se faltar, converte de mm (sem chutar) */
  function ftLabel(it) {
    const w = it.widthOrig || ftIn(it.width);
    const h = it.heightOrig || ftIn(it.height);
    return (w || h) ? ((w || '?') + ' × ' + (h || '?')) : '';
  }

  const T = (s, v, L) => (F.tr ? F.tr(s, v, L) : s);
  const NUM_LOC = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
  const DATE_LOC = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

  /** área em m² + ft² (sempre as duas), número no locale do idioma do documento */
  const _fmtN = (v, L) => v.toLocaleString(NUM_LOC[L] || 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const areaTwo = (m2, L) => _fmtN(m2, L) + ' m²\n' + _fmtN(m2 * F.M2_TO_FT2, L) + ' ft²';       // duas linhas (célula)
  const areaInline = (m2, L) => _fmtN(m2, L) + ' m² (' + _fmtN(m2 * F.M2_TO_FT2, L) + ' ft²)';    // uma linha (resumo)

  // rótulos canônicos PT (mesmos do dicionário i18n) → traduzidos p/ o idioma do documento
  const TYPE_PT = {
    'Casement Window': 'Janela Casement (abrir)', 'Double Casement': 'Janela Casement 2 folhas',
    'Sliding Window': 'Janela de correr', 'Awning Window': 'Janela basculante / maxim-ar',
    'Tilt & Turn (open in)': 'Oscilo-batente (abre p/ dentro)', 'Double Hung': 'Janela guilhotina', 'Picture / Fixed': 'Janela fixa', 'Fixed Window': 'Janela fixa',
    'Single Door': 'Porta de abrir', 'Single Swing Door': 'Porta de abrir', 'Double Swing Door': 'Porta 2 folhas',
    'Pre-Hung Door': 'Porta pré-montada', 'Pocket Door': 'Porta embutida', 'Bifold Door': 'Porta sanfonada',
    'Bypass / Sliding Closet': 'Porta de correr (armário)', 'Barn Door': 'Porta celeiro', 'French Door': 'Porta francesa',
    'Dutch Door': 'Porta holandesa', 'Sliding Door': 'Porta de correr', 'Sliding Glass / Patio': 'Porta de correr de vidro',
    'Entry Door': 'Porta de entrada', 'Fire-Rated Door': 'Porta corta-fogo', 'Flush Door': 'Porta lisa',
    'Panel Door': 'Porta almofadada', 'Garage Door': 'Portão de garagem', 'Storefront Door': 'Porta de fachada',
    'Storefront': 'Fachada envidraçada (storefront)',
  };
  const opLabel = (type, L) => T(TYPE_PT[type] || type || '—', null, L);

  const STEEL = [44, 71, 106];

  F.exportClientProposal = async function () {
    const L = F.pickDocLang ? await F.pickDocLang() : (F.getLang ? F.getLang() : 'pt');
    if (!L) return;                                   // cancelado
    const t = (s, v) => T(s, v, L);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const P = F.PROPOSAL, prj = F.state.project, c = F.state.costs || {};
    const W = 210, H = 297;
    // detecta a natureza dos itens (porta / janela / misto) — sem assumir janela
    const isDoorItem = (it) => /Door/i.test(it.type || '') || !!it.material || !!it.spec;
    const nDoor = F.state.items.filter(isDoorItem).length;
    const nWin = F.state.items.length - nDoor;
    const kindPt = (nDoor && nWin) ? 'ESQUADRIAS' : nDoor ? 'PORTAS' : 'JANELAS';
    let pageNo = 0;
    const foot = () => {
      pageNo++;
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(P.contact, 14, H - 8);
      doc.text(t('Página') + ' ' + String(pageNo).padStart(3, '0'), W - 14, H - 8, { align: 'right' });
    };

    /* ---- Capa PREMIUM ---- */
    const brand = F.reportBrand ? F.reportBrand() : { company: P.company, accent: '#2c476a', logo: '', logoAR: 1 };
    const GOLD = [198, 162, 74], DARK = [22, 38, 60], FAINT = [62, 86, 116];
    // centraliza CONTANDO o charSpace (jsPDF não conta no align:center → cortava/deslocava);
    // com maxW, ENCOLHE a fonte até caber na largura útil (idiomas com texto mais longo)
    const cText = (text, y, size, cs, color, style, maxW) => {
      doc.setFont(undefined, style || 'normal'); cs = cs || 0;
      const wOf = () => doc.getTextWidth(text) + Math.max(0, text.length - 1) * cs;
      doc.setFontSize(size);
      if (maxW) { while (size > 8 && wOf() > maxW) { size -= 1; doc.setFontSize(size); } }
      doc.setTextColor(...color);
      doc.text(text, (W - wOf()) / 2, y, cs ? { charSpace: cs } : undefined);
    };
    // fundo em degradê vertical (navy → mais escuro embaixo)
    for (let i = 0, steps = 64; i < steps; i++) {
      const k = i / (steps - 1);
      doc.setFillColor(Math.round(STEEL[0] + (DARK[0] - STEEL[0]) * k), Math.round(STEEL[1] + (DARK[1] - STEEL[1]) * k), Math.round(STEEL[2] + (DARK[2] - STEEL[2]) * k));
      doc.rect(0, H * i / steps, W, H / steps + 0.7, 'F');
    }
    // moldura dourada (linha dupla)
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.7); doc.rect(10, 10, W - 20, H - 20);
    doc.setLineWidth(0.25); doc.rect(12.5, 12.5, W - 25, H - 25);
    // emblema arquitetônico sutil ao centro (janela com montantes)
    (function () {
      const ew = 46, eh = 56, ex = (W - ew) / 2, ey = 150;
      doc.setDrawColor(...FAINT); doc.setLineWidth(0.5);
      doc.roundedRect(ex, ey, ew, eh, 3, 3); doc.roundedRect(ex + 4.5, ey + 4.5, ew - 9, eh - 9, 2, 2);
      doc.line(ex + ew / 2, ey + 4.5, ex + ew / 2, ey + eh - 4.5); doc.line(ex + 4.5, ey + eh / 2, ex + ew - 4.5, ey + eh / 2);
    })();
    // logo da marca (ou nome) no topo
    let topY = 50;
    if (brand.logo) {
      try {
        const ar = brand.logoAR || 1, lh = 24, lw = Math.min(70, lh * ar);
        doc.addImage(brand.logo, /jpe?g/i.test(brand.logo) ? 'JPEG' : 'PNG', (W - lw) / 2, 30, lw, lh); topY = 30 + lh + 9;
      } catch (e) { topY = 50; }
    } else {
      cText((brand.company || P.company).toUpperCase(), 48, 18, 1.4, [255, 255, 255], 'bold', W - 50); topY = 58;
    }
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.9); doc.line(W / 2 - 16, topY, W / 2 + 16, topY);
    // título grande + subtítulo (auto-fit p/ caber em qualquer idioma)
    cText(t(kindPt), 120, 48, 1.8, [255, 255, 255], 'bold', W - 50);
    cText(t('Proposta técnica de esquadrias').toUpperCase(), 132, 9.5, 2, GOLD, 'normal', W - 44);
    // bloco Projeto / Cliente / Data (acima do rodapé)
    let by = 224;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.line(W / 2 - 32, by - 9, W / 2 + 32, by - 9);
    const lbl = (label, val) => {
      if (!val) return;
      cText(t(label).toUpperCase(), by, 7.5, 1.4, [150, 170, 196], 'normal');
      cText(String(val), by + 6, 12, 0, [255, 255, 255], 'bold', W - 50); by += 15.5;
    };
    lbl('Projeto', prj.name); lbl('Cliente', prj.client);
    lbl('Data', new Date().toLocaleDateString(DATE_LOC[L] || 'pt-BR'));
    // rodapé da capa
    cText('PROJECT PROPOSAL', H - 21, 10.5, 2, GOLD, 'bold', W - 50);
    cText(brand.company || P.company, H - 15, 9.5, 0, [208, 220, 236], 'normal', W - 50);

    /* ---- Dados ---- */
    doc.addPage();
    doc.setTextColor(...STEEL); doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text(t('Proposal Details by'), W / 2, 30, { align: 'center' });
    doc.text(P.company, W / 2, 38, { align: 'center' });
    doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(P.address, W / 2, 45, { align: 'center' });
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...STEEL);
    doc.text(t('Project address:'), W / 2, 60, { align: 'center' });
    doc.setFont(undefined, 'normal'); doc.setTextColor(60);
    doc.text(prj.name || '-', W / 2, 67, { align: 'center' });
    if (prj.client) doc.text(t('Cliente: {c}', { c: prj.client }), W / 2, 74, { align: 'center' });
    // sumário
    const totalQty = F.state.items.reduce((s, it) => s + it.qty, 0);
    doc.setFontSize(10); doc.setTextColor(90);
    const brk = (nDoor && nWin) ? t(' ({d} portas · {w} janelas)', { d: nDoor, w: nWin }) : '';
    doc.text(t('{n} tipos · {q} unidades{brk}', { n: F.state.items.length, q: totalQty, brk }), W / 2, 88, { align: 'center' });
    foot();

    /* ---- Posições (desenho + specs) ---- */
    let y = 0, perPage = 0;
    for (let i = 0; i < F.state.items.length; i++) {
      const it = F.state.items[i];
      if (perPage === 0) {
        doc.addPage();
        doc.setTextColor(...STEEL); doc.setFontSize(22); doc.setFont(undefined, 'bold');
        doc.text(t('Positions'), 14, 22);
        y = 32;
      }
      // desenho
      try {
        const png = await svgPng(F.svgMarkup(it), 2);
        const dw = 55, dh = dw * png.h / png.w;
        doc.addImage(png.url, 'PNG', 14, y, dw, Math.min(dh, 95));
      } catch (e) { /* segue sem desenho */ }

      // specs (sem marca do fornecedor)
      const sx = 82;
      doc.setTextColor(...STEEL); doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text('Pos. ' + it.id, sx, y + 6);
      doc.setTextColor(40); doc.setFontSize(10);
      doc.text(t('Size: {w} × {h}  ({wm}×{hm} mm)', {
        w: it.widthOrig || (it.width + 'mm'), h: it.heightOrig || (it.height + 'mm'), wm: it.width, hm: it.height
      }), sx, y + 13);
      doc.setFont(undefined, 'normal'); doc.setFontSize(9.5); doc.setTextColor(60);
      // specs SOMENTE com o que vem do projeto (sem chutar Sistema/Vidro/Cor)
      const isDoor = !!(it.material || it.spec || /Door/i.test(it.type || ''));
      const mao = (it.side || it.swing)
        ? ((it.side === 'R' ? t('Direita') : it.side === 'L' ? t('Esquerda') : '—') + ' · ' + (it.swing === 'out' ? t('abre p/ fora') : it.swing === 'in' ? t('abre p/ dentro') : '—'))
        : t('a definir (conforme projeto)');
      const specs = [[t('Quantidade'), String(it.qty)], [t('Operação'), opLabel(it.type, L)]];
      if (it.material) specs.push([t('Material'), it.material]);
      if (it.glass || it.glazing) specs.push([t('Vidro'), it.glass || it.glazing]);
      else if (isDoor) specs.push([t('Vidro'), t('— (porta sólida)')]);
      if (it.hinges) specs.push([t('Dobradiças'), it.hinges]);
      if (it.lockset) specs.push([t('Fechadura'), it.lockset]);
      if (it.saddle) specs.push([t('Soleira'), it.saddle]);
      if (it.fire) specs.push([t('Corta-fogo'), it.fire]);
      specs.push([t('Cor'), it.color || t('a definir')]);
      specs.push([t('Mão'), mao]);
      const dy = specs.length > 8 ? 5 : 6;
      specs.forEach((s, k) => {
        doc.setFont(undefined, 'bold'); doc.text(s[0] + ':', sx, y + 20 + k * dy);
        doc.setFont(undefined, 'normal'); doc.text(String(s[1]).slice(0, 60), sx + 28, y + 20 + k * dy);
      });

      y += 100; perPage++;
      if (perPage >= 2) { foot(); perPage = 0; }
    }
    if (perPage > 0) foot();

    /* ---- Pricing ---- */
    doc.addPage();
    doc.setTextColor(...STEEL); doc.setFontSize(22); doc.setFont(undefined, 'bold');
    doc.text(t('Pricing'), 14, 24);
    const totalArea = F.totalAreaM2() || 1;
    const rows = F.state.items.map(it => {
      const a = F.areaM2(it) * it.qty;
      const price = (c.price || 0) * (a / totalArea);
      return [it.id, opLabel(it.type, L), String(it.qty), `${it.width}×${it.height}`, ftLabel(it) || '—', areaTwo(a, L), F.money(price)];
    });
    const totQty = F.state.items.reduce((s, it) => s + it.qty, 0);
    const totAreaAll = F.state.items.reduce((s, it) => s + F.areaM2(it) * it.qty, 0);
    doc.autoTable({
      startY: 32,
      head: [[t('Pos.'), t('Tipo'), t('Qtd'), t('Medida (mm)'), t('Medida (ft)'), t('Área (m²/ft²)'), t('Preço')]],
      body: rows,
      foot: [['', t('Total'), String(totQty), '', '', areaTwo(totAreaAll, L), F.money(c.price || 0)]],
      theme: 'striped', headStyles: { fillColor: STEEL, textColor: 255 }, styles: { fontSize: 9 },
      footStyles: { fillColor: [232, 237, 244], textColor: STEEL, fontStyle: 'bold' },
      columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
    });
    let py = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(...STEEL);
    doc.text(t('VALOR TOTAL: {v}', { v: F.money(c.price || 0) }), 14, py);
    py += 8;
    doc.setFontSize(11); doc.setFont(undefined, 'normal'); doc.setTextColor(60);
    doc.text(t('Quantidade total: {q} un.   ·   Área total: {a}', { q: totQty, a: areaInline(totAreaAll, L) }), 14, py);
    py += 12;
    doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(60);
    doc.text(t('Condições'), 14, py);
    doc.setFont(undefined, 'normal'); doc.setFontSize(9);
    ['• 50% na aprovação, 50% na entrega/instalação;',
     '• Prazo de produção: a confirmar;',
     '• Validade da proposta: 15 dias;',
     '• Tempered glass conforme IBC/IRC ch.24 (a confirmar em revisão de código).'
    ].forEach((s, k) => doc.text(t(s), 14, py + 7 + k * 6));
    foot();

    /* ---- Encerramento / Contato (premium) ---- */
    doc.addPage();
    doc.setFillColor(...STEEL); doc.rect(0, 0, W, 58, 'F');
    doc.setFillColor(...GOLD); doc.rect(0, 58, W, 1.5, 'F');
    if (brand.logo) { try { const ar = brand.logoAR || 1, lh = 20, lw = Math.min(56, lh * ar); doc.addImage(brand.logo, /jpe?g/i.test(brand.logo) ? 'JPEG' : 'PNG', 14, 18, lw, lh); } catch (e) {} }
    else { doc.setTextColor(255); doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text(brand.company || P.company, 14, 32); }
    doc.setTextColor(208, 220, 236); doc.setFontSize(10.5); doc.setFont(undefined, 'normal');
    doc.text(t('Proposta técnica de esquadrias'), 14, 47);

    const sec = (title, y) => {
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(14, y - 5.5, 46, y - 5.5);
      doc.setTextColor(...STEEL); doc.setFont(undefined, 'bold'); doc.setFontSize(11);
      doc.text(t(title).toUpperCase(), 14, y);
    };
    let cy = 82;
    // agradecimento
    doc.setTextColor(...STEEL); doc.setFont(undefined, 'bold'); doc.setFontSize(15);
    doc.text(t('Obrigado pela oportunidade'), 14, cy); cy += 8;
    doc.setFont(undefined, 'normal'); doc.setFontSize(10.5); doc.setTextColor(70);
    const msg = doc.splitTextToSize(t('Agradecemos a confiança em nos receber. Esta proposta foi preparada com atenção a cada detalhe do seu projeto. Ficamos à disposição para esclarecer dúvidas e seguir para a próxima etapa.'), W - 28);
    doc.text(msg, 14, cy); cy += msg.length * 5.4 + 14;

    // fale conosco
    sec('Fale conosco', cy); cy += 8;
    const cinfo = [['Site', P.contact], ['E-mail', prj.email || ''], ['Telefone', prj.phone || ''], ['Endereço', P.address || '']].filter(r => r[1]);
    cinfo.forEach((r, k) => {
      const yy = cy + k * 8;
      doc.setFont(undefined, 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GOLD); doc.text(t(r[0]).toUpperCase(), 14, yy);
      doc.setFont(undefined, 'normal'); doc.setFontSize(10.5); doc.setTextColor(50); doc.text(String(r[1]), 42, yy);
    });
    cy += cinfo.length * 8 + 14;

    // condições comerciais
    sec('Condições comerciais', cy); cy += 8;
    doc.setFont(undefined, 'normal'); doc.setFontSize(9.5); doc.setTextColor(70);
    ['• 50% na aprovação, 50% na entrega/instalação;', '• Validade da proposta: 15 dias;', '• Prazo de produção: a confirmar;', '• Valores em USD.']
      .forEach((s, k) => doc.text(t(s), 14, cy + k * 6));
    cy += 4 * 6 + 16;

    // aceite (assinaturas)
    sec('Aceite da proposta', cy); cy += 24;
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.line(16, cy, 96, cy); doc.line(114, cy, 196, cy);
    doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(t('Empresa'), 16, cy + 5); doc.text(t('Cliente'), 114, cy + 5);
    doc.text(t('Data') + ': ____ / ____ / ______', 114, cy + 13);
    foot();

    F._lastProposalPages = doc.internal.getNumberOfPages();   // diagnóstico
    const PFN = { pt: 'proposta-cliente', en: 'client-proposal', es: 'propuesta-cliente' };
    F.saveBytes((PFN[L] || PFN.pt) + '.pdf', doc.output('arraybuffer'));
    F.flashExport('✓ ' + t('Proposta Cliente') + ' (PDF) ✓');
  };

})(window.ConstructCount);
