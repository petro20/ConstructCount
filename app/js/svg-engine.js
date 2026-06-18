/* =========================================================================
   svg-engine.js — geração do desenho técnico (SVG) das esquadrias
   Expõe: Fenestra.renderSVG(item, mountSelector)
   Suporta vários tipos de abertura (ver Fenestra.WINDOW_TYPES).
   ========================================================================= */

'use strict';

window.ConstructCount = window.ConstructCount || {};

(function (F) {

  const DASH = 'stroke="#6a8fb8" stroke-width="1.2" stroke-dasharray="6 4" fill="none"';

  /** mm → 7'-0 1/2" (fração 1/16") p/ cota imperial; usa a original se houver */
  function _ftIn(mm) {
    if (!mm || mm <= 0) return '';
    let s = Math.round(mm / 25.4 * 16), ft = Math.floor(s / 192), rem = s - ft * 192;
    let inch = Math.floor(rem / 16), fr = rem % 16, out = ft + "'-" + inch;
    if (fr) { let n = fr, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } out += ' ' + n + '/' + d; }
    return out + '"';
  }

  /** Badge SVG (forma colorida) usado como marca do tipo na tabela/quadro resumo */
  F.markBadgeSVG = function (shape, color, size = 16) {
    const shapes = {
      circle:   '<circle cx="10" cy="10" r="8"/>',
      square:   '<rect x="3" y="3" width="14" height="14" rx="2"/>',
      triangle: '<polygon points="10,2 18,18 2,18"/>',
      diamond:  '<polygon points="10,1 19,10 10,19 1,10"/>',
      hexagon:  '<polygon points="5,3 15,3 19,10 15,17 5,17 1,10"/>',
      star:     '<polygon points="10,1 12.5,7.5 19,7.5 13.5,12 15.5,19 10,15 4.5,19 6.5,12 1,7.5 7.5,7.5"/>',
      pentagon: '<polygon points="10,2 18,8 15,18 5,18 2,8"/>',
      cross:    '<polygon points="7,2 13,2 13,7 18,7 18,13 13,13 13,18 7,18 7,13 2,13 2,7 7,7"/>'
    };
    const inner = shapes[shape] || shapes.circle;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" `
         + `fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="0.8" style="vertical-align:middle">${inner}</svg>`;
  };

  // ---- Ferragens (dobradiça, maçaneta, trinca/fechadura) ----
  const HW = '#24344b';
  function hingesV(x, y0, y1) {   // 3 dobradiças numa borda vertical
    return [y0 + (y1 - y0) * 0.16, (y0 + y1) / 2, y1 - (y1 - y0) * 0.16]
      .map(yy => `<rect x="${x - 2}" y="${yy - 4}" width="4" height="8" rx="1" fill="${HW}"/>`).join('');
  }
  function hingesH(x0, x1, y) {   // 3 dobradiças numa borda horizontal (topo)
    return [x0 + (x1 - x0) * 0.2, (x0 + x1) / 2, x1 - (x1 - x0) * 0.2]
      .map(xx => `<rect x="${xx - 4}" y="${y - 2}" width="8" height="4" rx="1" fill="${HW}"/>`).join('');
  }
  function knob(x, y, dir = 'l') { // maçaneta tipo ALAVANCA (de pegar); dir 'l'=alavanca p/ esquerda, 'r'=p/ direita
    const bx = dir === 'r' ? x + 2 : x - 13;   // início da barra da alavanca
    return `<g fill="${HW}">`
      + `<rect x="${x - 3.2}" y="${y - 4.2}" width="6.4" height="8.4" rx="2" stroke="#fff" stroke-width="0.8"/>` // roseta (base)
      + `<rect x="${bx}" y="${y - 1.7}" width="11" height="3.4" rx="1.7"/>`                                       // alavanca
      + `</g>`;
  }
  function latch(x, y) {          // trinca / fechadura (placa)
    return `<rect x="${x - 2}" y="${y - 7}" width="4" height="14" rx="1.5" fill="${HW}"/>`;
  }

  /** Ferragens por tipo de abertura. */
  function hardware(open, g) {
    const { x0, y0, x1, y1, cx, cy } = g;
    switch (open) {
      case 'casement':        return hingesV(x0, y0, y1) + knob(x1 - 7, cy);
      case 'double-casement': return hingesV(x0, y0, y1) + hingesV(x1, y0, y1) + knob(cx - 7, cy, 'l') + knob(cx + 7, cy, 'r');
      case 'awning':          return hingesH(x0, x1, y0) + knob(cx, y1 - 7);
      case 'tilt-turn':       return hingesV(x0, y0, y1) + knob(x1 - 7, cy); // oscilo-batente: dobradiças laterais + alavanca
      case 'hung':            return latch(cx, cy);                         // guilhotina: trava no trilho central
      case 'sliding':
      case 'sliding-door':    return knob(cx - 8, cy);                      // puxador no painel
      case 'pocket-door':     return knob(cx - 8, cy);
      case 'bifold-door':     return knob(x1 - 7, cy);
      case 'barn-door':       return knob(x0 + (x1 - x0) * 0.12 + 12, cy);
      case 'door':
      case 'entry-door':
      case 'storefront-door': return hingesV(x0, y0, y1) + latch(x1 - 6, cy) + knob(x1 - 13, cy);
      case 'double-door':
      case 'french-door':     return hingesV(x0, y0, y1) + hingesV(x1, y0, y1) + knob(cx - 8, cy, 'l') + knob(cx + 8, cy, 'r');
      case 'dutch-door':      return hingesV(x0, y0, y1) + knob(x1 - 8, (y0 + cy) / 2) + knob(x1 - 8, (cy + y1) / 2);
      default:                return '';                                    // garagem/fixa: sem ferragem
    }
  }

  /** Símbolo completo = abertura + ferragens. */
  function openingSymbol(open, g) {
    return openingBase(open, g) + hardware(open, g);
  }

  /** Desenho da abertura (sem ferragens). */
  function openingBase(open, g) {
    const { x0, y0, x1, y1, cx, cy } = g;
    switch (open) {

      case 'casement': // 1 folha, dobradiça à esquerda → "V" apontando p/ direita
        return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${cy}" ${DASH}/>
                <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${cy}" ${DASH}/>`;

      case 'double-casement': { // 2 folhas, dobradiças nas laterais + montante central
        const mx = cx;
        return `<line x1="${mx}" y1="${y0}" x2="${mx}" y2="${y1}" stroke="#47709e" stroke-width="1.5"/>
                <line x1="${x0}" y1="${y0}" x2="${mx}" y2="${cy}" ${DASH}/>
                <line x1="${x0}" y1="${y1}" x2="${mx}" y2="${cy}" ${DASH}/>
                <line x1="${x1}" y1="${y0}" x2="${mx}" y2="${cy}" ${DASH}/>
                <line x1="${x1}" y1="${y1}" x2="${mx}" y2="${cy}" ${DASH}/>`;
      }

      case 'awning': // basculante, dobradiça no topo → "V" apontando p/ baixo
        return `<line x1="${x0}" y1="${y0}" x2="${cx}" y2="${y1}" ${DASH}/>
                <line x1="${x1}" y1="${y0}" x2="${cx}" y2="${y1}" ${DASH}/>`;

      case 'sliding': { // correr: montante central + seta de deslize
        const mx = cx, ay = cy;
        return `<line x1="${mx}" y1="${y0}" x2="${mx}" y2="${y1}" stroke="#47709e" stroke-width="1.5"/>
                <line x1="${x0 + 14}" y1="${ay}" x2="${mx - 10}" y2="${ay}" ${DASH}/>
                <path d="M ${mx - 18} ${ay - 5} L ${mx - 10} ${ay} L ${mx - 18} ${ay + 5}" ${DASH}/>`;
      }

      case 'sliding-door': { // porta de correr: 2 painéis sobrepostos + seta
        const mx = cx, ay = cy;
        return `<line x1="${mx}" y1="${y0}" x2="${mx}" y2="${y1}" stroke="#47709e" stroke-width="1.5"/>
                <rect x="${x0}" y="${y0}" width="${(mx - x0)}" height="${y1 - y0}" fill="#cfe3f2" fill-opacity="0.35"/>
                <line x1="${mx - 24}" y1="${ay}" x2="${mx + 24}" y2="${ay}" ${DASH}/>
                <path d="M ${mx + 16} ${ay - 5} L ${mx + 24} ${ay} L ${mx + 16} ${ay + 5}" ${DASH}/>`;
      }

      case 'door':         // porta de abrir: arco de varredura
      case 'entry-door': { // entrada: arco + painel (almofada)
        const r = (x1 - x0);
        let s = `<path d="M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x0} ${Math.max(y0, y1 - r)}" ${DASH}/>
                 <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#6a8fb8" stroke-width="1.5"/>`;
        if (open === 'entry-door')
          s += `<rect x="${x0 + 6}" y="${y0 + 6}" width="${(x1 - x0) - 12}" height="${(y1 - y0) - 12}" fill="none" stroke="#6a8fb8" stroke-width="1"/>`;
        return s;
      }

      case 'tilt-turn': { // oscilo-batente (abre p/ DENTRO): triângulo do GIRO (dobradiça lateral, ápice à direita) + triângulo do BASCULANTE (dobradiça embaixo, ápice no topo). Linhas SÓLIDAS = abertura para dentro.
        const SOL = 'stroke="#47709e" stroke-width="1.3" fill="none"';
        return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${cy}" ${SOL}/>
                <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${cy}" ${SOL}/>
                <line x1="${x0}" y1="${y1}" x2="${cx}" y2="${y0}" ${SOL}/>
                <line x1="${x1}" y1="${y1}" x2="${cx}" y2="${y0}" ${SOL}/>`;
      }

      case 'hung': { // guilhotina: trilho horizontal no meio + setas ↑↓
        const my = cy;
        return `<line x1="${x0}" y1="${my}" x2="${x1}" y2="${my}" stroke="#47709e" stroke-width="1.5"/>
                <path d="M ${cx - 5} ${my - 13} L ${cx} ${my - 21} L ${cx + 5} ${my - 13}" ${DASH}/>
                <path d="M ${cx - 5} ${my + 13} L ${cx} ${my + 21} L ${cx + 5} ${my + 13}" ${DASH}/>`;
      }

      case 'double-door':
      case 'french-door': { // 2 folhas de abrir: montante central + 2 arcos
        const mx = cx, half = (mx - x0);
        let s = `<line x1="${mx}" y1="${y0}" x2="${mx}" y2="${y1}" stroke="#47709e" stroke-width="1.5"/>
                 <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#6a8fb8" stroke-width="1.5"/>
                 <path d="M ${mx} ${y1} A ${half} ${half} 0 0 1 ${x0} ${Math.max(y0, y1 - half)}" ${DASH}/>
                 <path d="M ${mx} ${y1} A ${half} ${half} 0 0 0 ${x1} ${Math.max(y0, y1 - half)}" ${DASH}/>`;
        return s;
      }

      case 'dutch-door': { // holandesa: divisão horizontal + arco
        const r = (x1 - x0);
        return `<line x1="${x0}" y1="${cy}" x2="${x1}" y2="${cy}" stroke="#47709e" stroke-width="1.5"/>
                <path d="M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x0} ${Math.max(y0, y1 - r)}" ${DASH}/>
                <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#6a8fb8" stroke-width="1.5"/>`;
      }

      case 'pocket-door': { // embutida: painel + seta entrando na parede
        const ay = cy;
        return `<rect x="${x0}" y="${y0}" width="${(x1 - x0) / 2}" height="${y1 - y0}" fill="#cfe3f2" fill-opacity="0.35"/>
                <line x1="${cx}" y1="${ay}" x2="${x1}" y2="${ay}" ${DASH}/>
                <path d="M ${x1 - 8} ${ay - 5} L ${x1} ${ay} L ${x1 - 8} ${ay + 5}" ${DASH}/>
                <line x1="${x1}" y1="${y0 - 4}" x2="${x1}" y2="${y1 + 4}" stroke="#6a8fb8" stroke-width="1" stroke-dasharray="3 3"/>`;
      }

      case 'bifold-door': { // sanfonada: zigue-zague
        const n = 4; let pts = '';
        for (let i = 0; i <= n; i++) { const xx = x0 + (x1 - x0) * i / n, yy = (i % 2 === 0) ? y0 + 6 : y1 - 6; pts += (i ? 'L' : 'M') + ` ${xx} ${yy} `; }
        return `<path d="${pts}" ${DASH}/>`;
      }

      case 'barn-door': { // celeiro: trilho no topo + painel deslocado + roldanas
        const off = (x1 - x0) * 0.12;
        return `<line x1="${x0 - 6}" y1="${y0 - 6}" x2="${x1 + 6}" y2="${y0 - 6}" stroke="#47709e" stroke-width="2"/>
                <rect x="${x0 + off}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#cfe3f2" fill-opacity="0.3" stroke="#6a8fb8"/>
                <circle cx="${x0 + off + 10}" cy="${y0 - 6}" r="2.5" fill="#47709e"/>
                <circle cx="${x1 + off - 10}" cy="${y0 - 6}" r="2.5" fill="#47709e"/>`;
      }

      case 'garage-door': { // seccionado: painéis horizontais
        let s = ''; const n = 4;
        for (let i = 1; i < n; i++) { const yy = y0 + (y1 - y0) * i / n; s += `<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" stroke="#47709e" stroke-width="1.2"/>`; }
        return s;
      }

      case 'storefront-door': { // porta de fachada envidraçada: arco + GLASS
        const r = (x1 - x0);
        return `<path d="M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x0} ${Math.max(y0, y1 - r)}" ${DASH}/>
                <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#6a8fb8" stroke-width="1.5"/>`;
      }

      case 'storefront': { // fachada envidraçada: montantes verticais + porta num módulo
        const bays = 3;
        let lines = '';
        for (let i = 1; i < bays; i++) {
          const mx = x0 + (x1 - x0) * i / bays;
          lines += `<line x1="${mx}" y1="${y0}" x2="${mx}" y2="${y1}" stroke="#47709e" stroke-width="1.5"/>`;
        }
        // porta no primeiro módulo (base + arco de varredura)
        const dx = x0 + (x1 - x0) / bays;
        lines += `<line x1="${x0}" y1="${y1}" x2="${dx}" y2="${y1}" stroke="#6a8fb8" stroke-width="1.5"/>`;
        lines += `<path d="M ${dx} ${y1} A ${(dx - x0)} ${(dx - x0)} 0 0 0 ${x0} ${Math.max(y0, y1 - (dx - x0))}" ${DASH}/>`;
        return lines;
      }

      case 'fixed':
      default:
        return `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12"
                      fill="#6a8fb8" letter-spacing="1">FIXA</text>`;
    }
  }

  /**
   * Retorna a STRING do SVG técnico de um item (moldura, vidro, abertura, cotas, título).
   * Usada na pré-visualização e no PDF de proposta (convertida em imagem).
   */
  F.svgMarkup = function (item) {
    // escala para caber no viewport (lado maior ~320px)
    const W = item.width, H = item.height;
    // ADICIONAL do projeto (vão + adicional): quebra a altura/largura no desenho
    const hAddMm = +item.hAddMm || 0, hBaseMm = +item.hBaseMm || 0;
    const wAddMm = +item.wAddMm || 0, wBaseMm = +item.wBaseMm || 0;
    const hasHadd = hAddMm > 0 && hBaseMm > 0 && (hBaseMm + hAddMm) <= H + 3;
    const hasWadd = wAddMm > 0 && wBaseMm > 0 && (wBaseMm + wAddMm) <= W + 3;
    // RÓTULO do adicional (por janela) — aparece ao lado da cota laranja do adicional
    const addLbl = String((F.addTermLabel ? F.addTermLabel(item.addLabel) : (item.addLabel || '')) || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const maxPx = 320;
    const scale = maxPx / Math.max(W, H);
    const fw = W * scale, fh = H * scale;

    // margens para cotas/textos (mais à direita/abaixo quando há cota de adicional)
    const padL = 84, padT = 40, padR = hasHadd ? 108 : 44, padB = hasWadd ? 126 : 100;
    const vbW = fw + padL + padR;
    const vbH = fh + padT + padB;

    const fx0 = padL, fy0 = padT;          // moldura externa
    const fx1 = fx0 + fw, fy1 = fy0 + fh;
    const inset = 14;                        // espessura da moldura

    // limites do VÃO (a porta/janela ocupa só o vão; o adicional é VIDRO fixo ao lado/abaixo)
    const splitX = fx0 + fw * (hasWadd ? (wBaseMm / W) : 1);   // largura: vão | adicional
    const splitY = fy0 + fh * (hasHadd ? (hBaseMm / H) : 1);   // altura: vão | adicional
    const ix1 = fx1 - inset, iy1 = fy1 - inset;                // canto interno (o VIDRO cobre tudo)
    const gx1 = hasWadd ? (splitX - 2) : ix1;
    const gy1 = hasHadd ? (splitY - 2) : iy1;
    // geometria do VÃO — passada ao símbolo (folha/arco/sash vai SÓ até a medida da porta/janela)
    const g = {
      x0: fx0 + inset, y0: fy0 + inset,
      x1: gx1, y1: gy1,
      cx: (fx0 + inset + gx1) / 2, cy: (fy0 + inset + gy1) / 2
    };

    // mão da esquadria (definida pelo usuário conforme o projeto)
    let sym = openingSymbol(F.openingOf(item), g);
    let tf = '';
    if (item.side === 'R') tf += `translate(${2 * g.cx} 0) scale(-1 1) `;     // espelha lado
    if (item.swing === 'out') tf += `translate(0 ${2 * g.cy}) scale(1 -1) `;  // espelha abertura
    const symbol = tf ? `<g transform="${tf}">${sym}</g>` : sym;
    const tr = F.tr || ((s) => s);
    const handTxt = (item.side || item.swing)
      ? (tr('Dobradiça:') + ' ' + (item.side === 'R' ? tr('Direita') : item.side === 'L' ? tr('Esquerda') : '—') +
         '  ·  ' + tr('Abre:') + ' ' + (item.swing === 'out' ? tr('Fora') : item.swing === 'in' ? tr('Dentro') : '—'))
      : tr('Mão: a definir (conforme o projeto)');

    const wImp = item.widthOrig || _ftIn(W);
    const hImp = item.heightOrig || _ftIn(H);
    const cyM = (fy0 + fy1) / 2;

    // --- montante/travessa: barra de FRAMING (mesmo perfil da moldura lateral) separando vão | adicional ---
    const mw = Math.min(7, Math.max(5, Math.round((inset - 2) / 2))); // espessura do montante/travessa ≈ metade da moldura
    const frameBar = (x, y, bw, bh) =>
      `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="2" fill="url(#fgGrad)" stroke="#46638a" stroke-width="2"/>`
      + `<rect x="${x + 1.5}" y="${y + 1.5}" width="${Math.max(0, bw - 3)}" height="${Math.max(0, bh - 3)}" rx="1.5" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-opacity="0.5"/>`;
    const mullions =
      (hasHadd ? frameBar(fx0 + inset, splitY - mw / 2, fw - inset * 2, mw) : '')           // travessa (altura)
      + (hasWadd ? frameBar(splitX - mw / 2, fy0 + inset, mw, fh - inset * 2) : '');         // montante lateral (largura)
    // REPRESENTAÇÃO do adicional no lugar do vidro (por janela): grade / painel / veneziana
    const addReprSVG = (kind, x0, y0, x1, y1) => {
      const rw = x1 - x0, rh = y1 - y0;
      if (rw <= 1 || rh <= 1) return '';
      if (kind === 'panel') {
        return `<rect x="${x0}" y="${y0}" width="${rw}" height="${rh}" fill="#c7d0db" stroke="#8a99ad" stroke-width="1"/>`
          + `<rect x="${x0 + 3}" y="${y0 + 3}" width="${Math.max(0, rw - 6)}" height="${Math.max(0, rh - 6)}" rx="2" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.5"/>`;
      }
      if (kind === 'louver') {
        const n = Math.max(3, Math.round(rh / 9)); let s = '';
        for (let i = 1; i < n; i++) { const yy = y0 + rh * i / n; s += `<line x1="${x0 + 2}" y1="${yy}" x2="${x1 - 2}" y2="${yy}" stroke="#7c8ca3" stroke-width="2"/><line x1="${x0 + 2}" y1="${yy + 1.5}" x2="${x1 - 2}" y2="${yy + 1.5}" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.5"/>`; }
        return s;
      }
      if (kind === 'grill') {
        const cols = Math.max(2, Math.round(rw / 15)), rows = Math.max(2, Math.round(rh / 15)); let s = '';
        for (let i = 1; i < cols; i++) { const xx = x0 + rw * i / cols; s += `<line x1="${xx}" y1="${y0 + 2}" x2="${xx}" y2="${y1 - 2}" stroke="#52617a" stroke-width="1.3"/>`; }
        for (let j = 1; j < rows; j++) { const yy = y0 + rh * j / rows; s += `<line x1="${x0 + 2}" y1="${yy}" x2="${x1 - 2}" y2="${yy}" stroke="#52617a" stroke-width="1.3"/>`; }
        return s;
      }
      return '';   // glass (padrão): o vidro já está desenhado
    };
    const addKind = item.addKind || 'glass';
    const addRepr = (addKind && addKind !== 'glass')
      ? ((hasHadd ? addReprSVG(addKind, g.x0, splitY, ix1, iy1) : '') + (hasWadd ? addReprSVG(addKind, splitX, g.y0, ix1, iy1) : ''))
      : '';
    const dRX = fx1 + 34;                                              // cota de altura do lado DIREITO (vão + adicional)
    const heightBreak = hasHadd ? `
  <line x1="${dRX}" y1="${fy0}" x2="${dRX}" y2="${splitY}" stroke="#157347" stroke-width="1"/>
  <line x1="${dRX - 5}" y1="${fy0}" x2="${dRX + 5}" y2="${fy0}" stroke="#157347" stroke-width="1"/>
  <line x1="${dRX - 5}" y1="${splitY}" x2="${dRX + 5}" y2="${splitY}" stroke="#157347" stroke-width="1"/>
  <text x="${dRX + 13}" y="${(fy0 + splitY) / 2}" text-anchor="middle" font-size="10.5" fill="#157347" transform="rotate(-90 ${dRX + 13} ${(fy0 + splitY) / 2})">${item.hBaseOrig || _ftIn(hBaseMm)} · ${Math.round(hBaseMm)} mm</text>
  <line x1="${dRX}" y1="${splitY}" x2="${dRX}" y2="${fy1}" stroke="#b5651d" stroke-width="1"/>
  <line x1="${dRX - 5}" y1="${fy1}" x2="${dRX + 5}" y2="${fy1}" stroke="#b5651d" stroke-width="1"/>
  <text x="${dRX + 13}" y="${(splitY + fy1) / 2}" text-anchor="middle" font-size="10.5" fill="#b5651d" transform="rotate(-90 ${dRX + 13} ${(splitY + fy1) / 2})">+ ${item.hAddOrig || _ftIn(hAddMm)} · ${Math.round(hAddMm)} mm</text>
  <text x="${dRX + 30}" y="${(splitY + fy1) / 2}" text-anchor="middle" font-size="9" fill="#b5651d" transform="rotate(-90 ${dRX + 30} ${(splitY + fy1) / 2})">${addLbl}</text>` : '';
    const widthCota = hasWadd ? `
  <line x1="${fx0}" y1="${fy1 + 26}" x2="${splitX}" y2="${fy1 + 26}" stroke="#157347" stroke-width="1"/>
  <line x1="${fx0}" y1="${fy1 + 20}" x2="${fx0}" y2="${fy1 + 32}" stroke="#157347" stroke-width="1"/>
  <line x1="${splitX}" y1="${fy1 + 20}" x2="${splitX}" y2="${fy1 + 32}" stroke="#157347" stroke-width="1"/>
  <text x="${(fx0 + splitX) / 2}" y="${fy1 + 44}" text-anchor="middle" font-size="10.5" fill="#157347">${item.wBaseOrig || _ftIn(wBaseMm)} · ${Math.round(wBaseMm)}mm</text>
  <line x1="${splitX}" y1="${fy1 + 26}" x2="${fx1}" y2="${fy1 + 26}" stroke="#b5651d" stroke-width="1"/>
  <line x1="${fx1}" y1="${fy1 + 20}" x2="${fx1}" y2="${fy1 + 32}" stroke="#b5651d" stroke-width="1"/>
  <text x="${(splitX + fx1) / 2}" y="${fy1 + 44}" text-anchor="middle" font-size="10.5" fill="#b5651d">+ ${item.wAddOrig || _ftIn(wAddMm)} · ${Math.round(wAddMm)}mm</text>
  <text x="${(fx0 + fx1) / 2}" y="${fy1 + 58}" text-anchor="middle" font-size="10.5" fill="#6a8fb8">${W} mm (${wImp})</text>` : `
  <line x1="${fx0}" y1="${fy1 + 26}" x2="${fx1}" y2="${fy1 + 26}" stroke="#24344b" stroke-width="1"/>
  <line x1="${fx0}" y1="${fy1 + 20}" x2="${fx0}" y2="${fy1 + 32}" stroke="#24344b" stroke-width="1"/>
  <line x1="${fx1}" y1="${fy1 + 20}" x2="${fx1}" y2="${fy1 + 32}" stroke="#24344b" stroke-width="1"/>
  <text x="${(fx0 + fx1) / 2}" y="${fy1 + 44}" text-anchor="middle" font-size="13" fill="#24344b">${W} mm</text>
  ${wImp ? `<text x="${(fx0 + fx1) / 2}" y="${fy1 + 56}" text-anchor="middle" font-size="10.5" fill="#6a8fb8">${wImp}</text>` : ''}`;

    return `
<svg viewBox="0 0 ${vbW} ${vbH}" width="${Math.round(vbW)}" height="${Math.round(vbH)}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto" font-family="Inter, sans-serif">
  <defs>
    <linearGradient id="fgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f8fc"/><stop offset="0.45" stop-color="#cfdae8"/>
      <stop offset="0.55" stop-color="#c2cfe0"/><stop offset="1" stop-color="#9aafc9"/>
    </linearGradient>
    <linearGradient id="glGrad" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#e3effa"/><stop offset="0.5" stop-color="#c2dcf1"/>
      <stop offset="1" stop-color="#a7c8e8"/>
    </linearGradient>
    <linearGradient id="sheenGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.0"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.0"/>
    </linearGradient>
    <filter id="softShadow" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#24344b" flood-opacity="0.20"/>
    </filter>
  </defs>

  <!-- moldura externa (metálica, com sombra) -->
  <g filter="url(#softShadow)">
    <rect x="${fx0}" y="${fy0}" width="${fw}" height="${fh}" rx="6" fill="url(#fgGrad)" stroke="#46638a" stroke-width="2.5"/>
  </g>
  <!-- realce/bisel interno da moldura -->
  <rect x="${fx0 + 3}" y="${fy0 + 3}" width="${fw - 6}" height="${fh - 6}" rx="4" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.5"/>

  <!-- vidro (com gradiente) -->
  <rect x="${g.x0}" y="${g.y0}" width="${fw - inset * 2}" height="${fh - inset * 2}" rx="2"
        fill="url(#glGrad)" stroke="#6f93b8" stroke-width="1.5"/>
  <!-- brilho diagonal do vidro (cobre TODO o vidro: vão + adicional) -->
  <polygon points="${g.x0},${iy1} ${g.x0 + (fw - inset * 2) * 0.42},${iy1} ${g.x0 + (fw - inset * 2) * 0.78},${g.y0} ${g.x0 + (fw - inset * 2) * 0.36},${g.y0}"
           fill="url(#sheenGrad)" opacity="0.7"/>
  <line x1="${g.x0 + 8}" y1="${iy1 - 8}" x2="${ix1 - 8}" y2="${g.y0 + 8}" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.6"/>

  <!-- representação do ADICIONAL no lugar do vidro (grade/painel/veneziana) -->
  ${addRepr}

  <!-- símbolo de abertura (folha/arco/ferragens) — confinado ao VÃO -->
  ${symbol}

  <!-- montantes/travessas do adicional (vidro) -->
  ${mullions}

  <!-- COTA HORIZONTAL (largura): vão + adicional quando houver -->
  ${widthCota}

  <!-- COTA VERTICAL (altura TOTAL = vão + adicional): mm + imperial -->
  <line x1="${fx0 - 34}" y1="${fy0}" x2="${fx0 - 34}" y2="${fy1}" stroke="#24344b" stroke-width="1"/>
  <line x1="${fx0 - 40}" y1="${fy0}" x2="${fx0 - 28}" y2="${fy0}" stroke="#24344b" stroke-width="1"/>
  <line x1="${fx0 - 40}" y1="${fy1}" x2="${fx0 - 28}" y2="${fy1}" stroke="#24344b" stroke-width="1"/>
  <text x="${fx0 - 44}" y="${cyM}" text-anchor="middle" font-size="13" fill="#24344b"
        transform="rotate(-90 ${fx0 - 44} ${cyM})">${H} mm</text>
  ${hImp ? `<text x="${fx0 - 58}" y="${cyM}" text-anchor="middle" font-size="10.5" fill="#6a8fb8"
        transform="rotate(-90 ${fx0 - 58} ${cyM})">${hImp}</text>` : ''}

  <!-- COTA da altura à direita: vão (verde) + adicional (laranja) -->
  ${heightBreak}

  <!-- mão da esquadria -->
  <text x="${vbW / 2}" y="${fy0 - 18}" text-anchor="middle" font-size="11" fill="#6a8fb8">${handTxt}</text>

  <!-- título -->
  <text x="${vbW / 2}" y="${vbH - 12}" text-anchor="middle" font-size="14" font-weight="600" fill="#2c476a">
    ${item.id} - ${F.typeLabel ? F.typeLabel(item.type) : item.type}
  </text>
</svg>`;
  };

  /** Injeta o SVG no holder (pré-visualização). */
  F.renderSVG = function (item, mountSelector = '#svgHolder') {
    if (!item) return;
    const idLabel = document.querySelector('#previewId');
    if (idLabel) idLabel.textContent = item.id;
    const holder = document.querySelector(mountSelector);
    if (holder) holder.innerHTML = F.svgMarkup(item);
  };

})(window.ConstructCount);
