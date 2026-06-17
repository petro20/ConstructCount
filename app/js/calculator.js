/* =========================================================================
   calculator.js — estado global, constantes e motor de cálculo
   (carregado primeiro; expõe tudo em window.ConstructCount)
   ========================================================================= */

'use strict';

window.ConstructCount = window.ConstructCount || {};

(function (F) {

  /* ---------- Salvar arquivo (desktop usa ponte Python; web baixa) ---------- */
  F.saveBytes = async function (name, data) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (F._desktop && window.pywebview && window.pywebview.api && window.pywebview.api.save_file) {
      try {
        let bin = '';
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        const r = await window.pywebview.api.save_file(name, btoa(bin));
        return r;
      } catch (e) { /* cai pro download abaixo */ }
    }
    const blob = new Blob([u8]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, web: true };
  };

  /* ---------- Constantes ---------- */
  F.MM2_TO_M2 = 1e-6;          // 1 mm² = 0.000001 m²
  F.M2_TO_FT2 = 10.7639;       // 1 m² = 10.7639 ft²
  F.STORAGE_KEY = 'fenestra.project.v1';

  /* ---------- Catálogo de tipos de esquadria ----------
     'open' define o símbolo de abertura desenhado pelo svg-engine. */
  F.WINDOW_TYPES = [
    // ---- Janelas ----
    { name: 'Casement Window',  open: 'casement',        cat: 'Janela' },   // de abrir (1 folha)
    { name: 'Double Casement',  open: 'double-casement', cat: 'Janela' },   // de abrir (2 folhas)
    { name: 'Sliding Window',   open: 'sliding',         cat: 'Janela' },   // de correr
    { name: 'Awning Window',    open: 'awning',          cat: 'Janela' },   // basculante / maxim-ar
    { name: 'Tilt & Turn',      open: 'tilt-turn',       cat: 'Janela' },   // oscilo-batente (abre p/ dentro ou fora — ver seletor)
    { name: 'Double Hung',      open: 'hung',            cat: 'Janela' },   // guilhotina
    { name: 'Picture / Fixed',  open: 'fixed',           cat: 'Janela' },   // vidro fixo
    { name: 'Twin Window',      open: 'twin',            cat: 'Janela' },   // geminada (2 unidades mulled lado a lado)
    // ---- Portas ----
    { name: 'Single Swing Door',  open: 'door',            cat: 'Porta' },   // abrir 1 folha
    { name: 'Double Swing Door',  open: 'double-door',     cat: 'Porta' },   // abrir 2 folhas
    { name: 'Pre-Hung Door',      open: 'door',            cat: 'Porta' },   // pré-montada com batente
    { name: 'Pocket Door',        open: 'pocket-door',     cat: 'Porta' },   // embutida na parede
    { name: 'Bifold Door',        open: 'bifold-door',     cat: 'Porta' },   // sanfonada/dobrável
    { name: 'Bypass / Sliding Closet', open: 'sliding-door', cat: 'Porta' }, // correr (armário)
    { name: 'Barn Door',          open: 'barn-door',       cat: 'Porta' },   // celeiro (trilho aparente)
    { name: 'French Door',        open: 'french-door',     cat: 'Porta' },   // francesa
    { name: 'Dutch Door',         open: 'dutch-door',      cat: 'Porta' },   // holandesa (2 partes)
    { name: 'Sliding Glass / Patio', open: 'sliding-door', cat: 'Porta' },   // de correr de vidro
    { name: 'Entry Door',         open: 'entry-door',      cat: 'Porta' },   // entrada principal
    { name: 'Fire-Rated Door',    open: 'door',            cat: 'Porta' },   // corta-fogo
    { name: 'Flush Door',         open: 'door',            cat: 'Porta' },   // lisa
    { name: 'Panel Door',         open: 'door',            cat: 'Porta' },   // almofadada
    { name: 'Garage Door',        open: 'garage-door',     cat: 'Porta' },   // portão de garagem
    { name: 'Storefront Door',    open: 'storefront-door', cat: 'Porta' },   // porta de fachada
    // ---- Fachada ----
    { name: 'Storefront',       open: 'storefront',      cat: 'Fachada' }   // fachada envidraçada / vitrine
  ];

  /** Categoria de abertura de um item (lookup por nome; fallback heurístico) */
  F.openingOf = (item) => {
    const t = F.WINDOW_TYPES.find(w => w.name === item.type);
    if (t) return t.open;
    if (/tilt.?(and|&).?turn|tilt.?turn|oscilo|\bt&t\b/i.test(item.type)) return 'tilt-turn';
    if (/hung|guilhotina/i.test(item.type)) return 'hung';
    if (/storefront|store front|curtain|vitrine|fachada/i.test(item.type)) return 'storefront';
    if (/double/i.test(item.type)) return 'double-casement';
    if (/sliding.*door/i.test(item.type)) return 'sliding-door';
    if (/door/i.test(item.type)) return 'door';
    if (/sliding|correr/i.test(item.type)) return 'sliding';
    if (/awning|bascul/i.test(item.type)) return 'awning';
    if (/fixed|fixa/i.test(item.type)) return 'fixed';
    return 'casement';
  };

  /* ---------- Marcas visuais (cor + forma únicas por item) ---------- */
  F.MARK_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star', 'pentagon', 'cross'];

  function hslToRgb(h, s, l) {
    h /= 360;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  }

  /** Hue distribuído por ângulo áureo → cores bem separadas, sem repetição prática */
  F.markRGB = (i) => hslToRgb((i * 137.508) % 360, 0.68, 0.45);
  F.markColor = (i) => { const [r, g, b] = F.markRGB(i); return `rgb(${r},${g},${b})`; };
  F.markHex = (i) => {
    const [r, g, b] = F.markRGB(i);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  };
  F.markShape = (i) => F.MARK_SHAPES[i % F.MARK_SHAPES.length];

  /* ---------- Dados simulados de extração por IA ---------- */
  F.SAMPLE_ITEMS = [
    { id: 'W01', type: 'Casement Window', widthOrig: "4'-0\"", heightOrig: "5'-0\"", width: 1219, height: 1524, qty: 4, glass: 'Temperado 8mm',  color: 'Branco', notes: 'Abertura à direita', seenIn: ['plan', 'schedule', 'elevation'], discrepancy: '' },
    { id: 'W02', type: 'Fixed Window',    widthOrig: "2'-8\"", heightOrig: "4'-0\"", width: 813,  height: 1219, qty: 2, glass: 'Laminado 6mm',   color: 'Branco', notes: 'Vidro fixo', seenIn: ['plan', 'elevation'], discrepancy: '' },
    { id: 'D01', type: 'Single Door',     widthOrig: "3'-0\"", heightOrig: "7'-0\"", width: 914,  height: 2134, qty: 1, glass: 'Temperado 10mm', color: 'Preto',  notes: 'Porta de entrada (fachada)', seenIn: ['plan', 'schedule', 'elevation'], discrepancy: 'Altura diverge: tipo 7\'-0" × fachada 6\'-10".' },
    { id: 'SF01', type: 'Storefront',     widthOrig: "12'-0\"", heightOrig: "9'-0\"", width: 3658, height: 2743, qty: 1, glass: 'Temperado 10mm', color: 'Preto',  notes: 'Fachada envidraçada — 3 módulos + porta', seenIn: ['schedule'], discrepancy: '' }
  ];

  /** Gera o próximo ID livre (W01, W02, ... ou D01 p/ portas) */
  F.nextId = (isDoor = false) => {
    const prefix = isDoor ? 'D' : 'W';
    let n = 1;
    const taken = new Set(F.state.items.map(i => i.id));
    while (taken.has(prefix + String(n).padStart(2, '0'))) n++;
    return prefix + String(n).padStart(2, '0');
  };

  /** Cria um item novo em branco */
  F.newItem = () => ({
    id: F.nextId(false), type: 'Casement Window',
    widthOrig: '', heightOrig: '',
    width: 1000, height: 1200, qty: 1,
    glass: 'Temperado 8mm', color: 'Branco', notes: '',
    seenIn: [], discrepancy: ''
  });

  /* ---------- Estado da aplicação ---------- */
  F.state = {
    items: [],
    unit: 'm2',              // 'm2' | 'ft2'
    currency: 'USD',         // padrão DÓLAR ('USD' | 'BRL' | 'EUR' | 'GBP')
    project: { name: 'Projeto Residencial', client: 'Cliente Exemplo', email: '', phone: '' },
    costs: {},
    previewIdx: 0            // qual item está na pré-visualização
  };

  /* ---------- Moedas / Formatação ---------- */
  F.CURRENCIES = {
    BRL: { symbol: 'R$', locale: 'pt-BR' },
    USD: { symbol: '$',  locale: 'en-US' },
    EUR: { symbol: '€',  locale: 'de-DE' },
    GBP: { symbol: '£',  locale: 'en-GB' },
  };

  /** Símbolo da moeda atual (ex.: 'R$', '$') */
  F.currencySymbol = () => (F.CURRENCIES[F.state.currency] || F.CURRENCIES.USD).symbol;

  /** Formata um número como moeda na moeda escolhida */
  F.money = (n) => {
    const c = F.CURRENCIES[F.state.currency] || F.CURRENCIES.USD;
    try {
      return new Intl.NumberFormat(c.locale, { style: 'currency', currency: F.state.currency })
        .format(Number(n) || 0);
    } catch (e) {
      return c.symbol + ' ' + (Number(n) || 0).toLocaleString(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  /** Alias retrocompatível */
  F.brl = (n) => F.money(n);

  /* ---------- Conversões / áreas ---------- */

  /** Área unitária em m² a partir de mm */
  F.areaM2 = (item) => item.width * item.height * F.MM2_TO_M2;

  /** Converte um valor em m² para a unidade atual */
  F.toUnit = (valueM2) => F.state.unit === 'm2' ? valueM2 : valueM2 * F.M2_TO_FT2;

  /** Sufixo textual da unidade atual */
  F.unitSuffix = () => F.state.unit === 'm2' ? 'm²' : 'ft²';

  /** Área formatada (pt-BR) já na unidade atual */
  F.fmtArea = (valueM2) =>
    F.toUnit(valueM2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Área total do projeto em m² (somando quantidades) */
  F.totalAreaM2 = () => F.state.items.reduce((s, it) => s + F.areaM2(it) * it.qty, 0);

  /**
   * Converte uma medida (texto, como no projeto) para milímetros.
   * Suporta pés/polegadas c/ fração (8'-7 3/8", 3'-6", 4'-0", 3.5'),
   * polegadas (42", 42 1/2") e métrico (1200 mm, 120 cm, 1.2 m). null se não entender.
   */
  F.parseToMm = (s) => {
    s = String(s == null ? '' : s).trim();
    if (!s) return null;
    s = s.replace(/[″“”]/g, '"').replace(/[′’‘]/g, "'");
    const low = s.toLowerCase();
    let m;
    if ((m = low.match(/([\d.]+)\s*mm\b/))) return parseFloat(m[1]);
    if ((m = low.match(/([\d.]+)\s*cm\b/))) return parseFloat(m[1]) * 10;
    if ((m = low.match(/([\d.]+)\s*m\b/)))  return parseFloat(m[1]) * 1000;
    if (s.indexOf("'") !== -1 && (m = s.match(/(\d+(?:\.\d+)?)\s*'/))) {
      const feet = parseFloat(m[1]);
      let inch = 0;
      const after = s.slice(s.indexOf("'") + 1);
      let f;
      if ((f = after.match(/(\d+)\s+(\d+)\/(\d+)/))) inch = +f[1] + (+f[2] / +f[3]);
      else if ((f = after.match(/(\d+)\/(\d+)/))) inch = +f[1] / +f[2];
      else if ((f = after.match(/(\d+(?:\.\d+)?)/))) inch = parseFloat(f[1]);
      return feet * 304.8 + inch * 25.4;
    }
    if ((m = s.match(/(\d+)\s+(\d+)\/(\d+)\s*"/))) return (+m[1] + (+m[2] / +m[3])) * 25.4;
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*"/))) return parseFloat(m[1]) * 25.4;
    if ((m = low.match(/(\d+(?:\.\d+)?)\s*in\b/))) return parseFloat(m[1]) * 25.4;
    return null;
  };

  /**
   * Motor de custos — baseado na ÁREA (R$/m²).
   * custo_base  = custo_m2 × área_total(m²)
   * custo_total = custo_base × (1 + frete%)
   * preço       = custo_total × (1 + margem%)
   * lucro       = preço − custo_total
   */
  F.computeCosts = ({ costPerM2, freightPct, marginPct }) => {
    const totalUnits = F.state.items.reduce((s, it) => s + it.qty, 0);
    const totalArea  = F.totalAreaM2();              // sempre em m²
    const baseCost   = costPerM2 * totalArea;
    const freight    = baseCost * (freightPct / 100);
    const totalCost  = baseCost + freight;
    const price      = totalCost * (1 + marginPct / 100);
    const profit     = price - totalCost;
    return { costPerM2, freightPct, marginPct, totalUnits, totalArea, baseCost, freight, totalCost, price, profit };
  };

  /* ---------- Persistência ---------- */
  F.persist = () => localStorage.setItem(F.STORAGE_KEY, JSON.stringify({
    items: F.state.items,
    project: F.state.project,
    currency: F.state.currency
  }));
  F.loadSaved = () => {
    const raw = localStorage.getItem(F.STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // compat. com versão antiga (array puro de itens)
    return Array.isArray(data) ? { items: data, project: null } : data;
  };

})(window.ConstructCount);
