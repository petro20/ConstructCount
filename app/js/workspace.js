/* =========================================================================
   workspace.js — tela de takeoff estilo PlanSwift
   Árvore de páginas + canvas editável + painel de itens (marca cor+forma+contagem),
   com auto-save por folha e "Consolidar" → tabela da Fenestra.
   Acesso a dados via "provider" (prov): getPage(page) / saveMarks(page,marks,mult) /
   consolidate(). No desktop o prov chama a ponte pywebview; em teste, um mock.
     F.openWorkspace({ slug, name, pages:[{page,n_hex,mult}], schedule, prov, onConsolidate })
   ========================================================================= */

'use strict';

(function (F) {

  const S = {
    slug: null, prov: null, pages: [], page: null, marks: [], img: null,
    scale: 1, ox: 0, oy: 0, dragging: false, moved: false, lastX: 0, lastY: 0,
    countMode: false, autoMode: false, delMode: false, busy: false, highlight: null,
    calibMode: false, measMode: false, mmPerPx: null, clickA: null, measures: [],
    lineMode: false, linePts: [], lines: [], lineSel: new Set(), hiddenTypes: new Set(),   // LINEAR + seleção + tipos ocultos
    snap: false, ortho: false, hover: null, snapData: null, lastMeas: null, dragMeas: null, selSet: null, curX: null, curY: null,
    marquee: null, maybeMarquee: false, marqStart: null, marqMods: null, marqCrossing: false, selMarks: null,
    autoDragStart: null, autoSample: null, autoRegion: null,   // área de busca do Auto Count (arraste)
    dirty: false, saveTimer: null, onConsolidate: null, labelIdx: {}, schedulePages: [], toDelete: null,
    sections: ['Geral'], activeSection: 'Geral', legend: true, legendRect: null, draggingLegend: null,
    legendHandle: null, resizingLegend: null, legendByPage: {},   // posição/escala da legenda POR FOLHA
    layers: [], activeLayer: null,   // CAMADAS (trades) — cada objeto {id,name,color,visible,locked}
  };
  let cv, ctx, bound = false;
  const $ = (s) => document.querySelector(s);

  F.openWorkspace = function (opts) {
    cv = $('#wsCanvas'); ctx = cv.getContext('2d');
    S.slug = opts.slug; S.prov = opts.prov;
    S.pages = (opts.pages || []).map(p => ({ ...p }));
    S.onConsolidate = opts.onConsolidate || null;
    S.labelIdx = {}; S.countMode = false; S.autoMode = false; S.delMode = false;
    S.calibMode = false; S.measMode = false; S.clickA = null; S.measures = [];
    S.lineMode = false; S.linePts = []; S.lines = []; S.lineSel = new Set(); S.hiddenTypes = new Set();
    S.areas = []; S.areaSel = new Set();   // áreas (Piso/Forro) + seleção
    S.schedulePages = (opts.schedulePages || []).slice();
    S.sections = (opts.sections && opts.sections.length) ? opts.sections.slice() : ['Geral'];
    S.activeSection = opts.activeSection || S.sections[0];
    S.layers = (opts.layers && opts.layers.length) ? opts.layers.map(l => ({ ...l }))
      : [{ id: 'default', name: 'Janelas e Portas', color: '#d9a02a', visible: true, locked: false }];
    S.activeLayer = opts.activeLayer || S.layers[0].id;
    S.sched = opts.schedule || {};        // {CÓDIGO: {w_mm,h_mm,w_raw,h_raw,type,model}}
    S.scope = opts.scope || 'all';        // modo de reconhecimento do projeto
    S.toDelete = new Set();
    try { const lm = JSON.parse(localStorage.getItem('fenestra_legend2_' + S.slug) || '{}'); S.legendByPage = (lm && typeof lm === 'object') ? lm : {}; } catch (e) { S.legendByPage = {}; }
    renderScope();
    $('#wsTitle').textContent = opts.name || 'Takeoff';
    $('#wsPrep').classList.add('hidden');
    $('#workspace').classList.remove('hidden');
    bindOnce();
    applyCursor();
    renderSections();
    renderLayers();
    renderPagesList();
    // carrega as ASSEMBLIES de framing salvas do projeto (não reler toda vez)
    (async () => {
      try { if (S.prov && S.prov.getFraming) { const d = await S.prov.getFraming(); if (d && (d.wallTypes || d.floors) && F._framingLoad) F._framingLoad(d); } } catch (e) {}
      populateWallTypeSelect(); populateFloorSelect(); populateScope(); renderPagesList();
    })();
    const first = S.pages.find(p => p.n_hex > 0) || S.pages[0];
    if (first) loadPage(first.page);
    maybeReadSheets();                          // lê os códigos das folhas (T-100…) em 2º plano
  };
  F._saveFraming = () => { if (S.prov && S.prov.saveFraming && F._framingSnapshot) { try { S.prov.saveFraming(F._framingSnapshot()); } catch (e) {} } };

  /** Lê os códigos das folhas (carimbo) em 2º plano e atualiza a lista ao vivo. */
  async function maybeReadSheets() {
    if (!S.prov || !S.prov.readSheets) return;
    if (!S.pages.length || S.pages.every(p => p.sheet)) return;
    try { await S.prov.readSheets(); } catch (e) { return; }
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1500));
      if (S.recognizing) break;                 // não conflita com o Reconhecer
      let done = false;
      try { const st = S.prov.status ? await S.prov.status() : null; done = !st || st.state === 'done' || st.state === 'error'; } catch (e) { done = true; }
      try {
        const j = S.prov.reload ? await S.prov.reload() : null;
        if (j && j.pages) {
          const by = {}; j.pages.forEach(p => { if (p.sheet) by[p.page] = p.sheet; });
          let changed = false;
          S.pages.forEach(p => { if (by[p.page] && p.sheet !== by[p.page]) { p.sheet = by[p.page]; changed = true; } });
          if (changed) renderPagesList();
        }
      } catch (e) {}
      if (done) break;
    }
  }

  /** Reconhecimento: roda a detecção de marcas nas folhas atuais (após apagar as indesejadas). */
  async function runRecognition() {
    if (!S.prov || !S.prov.recognize) { alert(F.tr('Disponível no app de desktop.')); return; }
    if (!S.pages.length) { markSaved(F.tr('Nenhuma folha para reconhecer')); return; }
    // se há folhas SELECIONADAS, reconhece só elas; senão, todas
    const selPages = [...(S.toDelete || [])];
    const onlySel = selPages.length > 0;
    // ANTES de reconhecer: definir o ESCOPO (o que vai ser reconhecido)
    if (F.pickScope) {
      const sc = await F.pickScope(S.scope || 'all');
      if (sc === null) return;                 // cancelou
      S.scope = sc; renderScope();
      if (S.prov.setScope) { try { await S.prov.setScope(sc); } catch (e) {} }
    }
    S.recognizing = true;
    const prep = $('#wsPrep'), bar = $('#wsPrepBar'), msg = $('#wsPrepMsg'), sub = $('#wsPrepSub');
    if (prep) prep.classList.remove('hidden');
    if (msg) msg.textContent = onlySel ? F.tr('Reconhecendo {n} selecionadas…', { n: selPages.length }) : F.tr('Reconhecendo…');
    if (bar) bar.style.width = '0%';
    if (sub) sub.textContent = '';
    try { await S.prov.recognize(onlySel ? selPages : null); } catch (e) { S.recognizing = false; if (prep) prep.classList.add('hidden'); markSaved(F.tr('Falha no reconhecimento')); return; }
    for (;;) {
      let st; try { st = S.prov.status ? await S.prov.status() : null; } catch (e) { break; }
      if (st && st.total) {
        const pct = Math.round((st.done || 0) / st.total * 100);
        if (bar) bar.style.width = pct + '%';
        if (sub) sub.textContent = (st.step || '') + ' · ' + F.tr('{done}/{total} folhas', { done: (st.done || 0), total: st.total });
      }
      if (!st || st.state === 'done') break;
      if (st.state === 'error') { markSaved(F.tr('Falha no reconhecimento')); break; }
      await new Promise(r => setTimeout(r, 1000));
    }
    S.toDelete = new Set(); S.selAnchor = null;   // seleção consumida pelo reconhecimento
    // recarrega contagens/folhas
    try {
      if (S.prov.reload) {
        const j = await S.prov.reload();
        if (j) { S.pages = (j.pages || []).map(p => ({ ...p })); if (j.schedule) S.sched = j.schedule; renderPagesList(); const cur = S.pages.find(p => p.page === S.page) || S.pages[0]; if (cur) await loadPage(cur.page); }
      }
    } catch (e) {}
    if (prep) prep.classList.add('hidden');
    S.recognizing = false;
    markSaved(F.tr('Reconhecimento concluído'));
  }

  const SCOPE_LBL = { all: 'Tudo', facade: 'Fachada (parede externa)', interior: 'Portas interiores' };
  function renderScope() {
    const lbl = $('#wsScopeLbl'); if (!lbl) return;
    lbl.textContent = F.tr(SCOPE_LBL[S.scope] || 'Tudo');
  }

  /** índice estável por rótulo → cor/forma consistentes (como o PlanSwift) */
  function idxOf(label) {
    const k = label || '(sem)';
    if (!(k in S.labelIdx)) S.labelIdx[k] = Object.keys(S.labelIdx).length;
    return S.labelIdx[k];
  }
  const colorOf = (label) => F.markColor(idxOf(label));

  // ----------------------------------------------------------------- camadas (trades)
  function layerById(id) { return S.layers.find(l => l.id === (id || 'default')) || null; }
  function layerVisible(id) { const l = layerById(id); return l ? l.visible !== false : true; }
  function activeLayerObj() { return layerById(S.activeLayer) || S.layers[0] || null; }

  // ----------------------------------------------------------------- seções (grupos)
  function renderSections() {
    const sel = $('#wsSection'); if (!sel) return;
    sel.innerHTML = '';
    S.sections.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s;
      if (s === S.activeSection) o.selected = true;
      sel.appendChild(o);
    });
  }

  // --- painel de CAMADAS (cada trade = uma camada sobre a planta) ---
  const _LAYER_PAL = ['#d9a02a', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#f59e0b', '#ec4899', '#84cc16', '#14b8a6'];
  function layerCount(lid) {
    const n = S.marks.filter(m => m.confirmed && (m.layer || 'default') === lid).length;
    return n ? String(n) : '';
  }
  function renderLayers() {
    const box = $('#wsLayersList'); if (!box) return;
    box.innerHTML = '';
    S.layers.forEach(l => {
      const active = (l.id === S.activeLayer);
      const row = document.createElement('div');
      row.className = 'flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer ' + (active ? 'bg-steel-700 ring-1 ring-amber-400' : 'hover:bg-steel-700/50');
      const dot = document.createElement('span');
      dot.className = 'inline-block w-3 h-3 rounded-full flex-shrink-0';
      dot.style.background = l.color || '#888'; dot.title = F.tr('Mudar cor');
      dot.addEventListener('click', (e) => { e.stopPropagation(); cycleLayerColor(l); });
      const nm = document.createElement('span');
      nm.className = 'flex-1 text-sm truncate ' + (active ? 'font-semibold text-white' : 'text-steel-100');
      nm.textContent = (l.locked ? '🔒 ' : '') + (l.name || 'Camada');
      const cnt = document.createElement('span');
      cnt.className = 'text-[11px] text-steel-400 tabular-nums'; cnt.textContent = layerCount(l.id);
      const eye = document.createElement('button');
      eye.className = 'text-sm leading-none px-0.5' + (l.visible !== false ? '' : ' opacity-40');
      eye.textContent = l.visible !== false ? '👁️' : '🚫'; eye.title = F.tr('Mostrar/ocultar');
      eye.addEventListener('click', (e) => { e.stopPropagation(); toggleLayerVisible(l); });
      const ren = document.createElement('button');
      ren.className = 'text-xs px-0.5 text-steel-400 hover:text-white'; ren.textContent = '✎'; ren.title = F.tr('Renomear');
      ren.addEventListener('click', (e) => { e.stopPropagation(); renameLayer(l); });
      const del = document.createElement('button');
      del.className = 'text-xs px-0.5 text-steel-400 hover:text-rose-400'; del.textContent = '🗑️'; del.title = F.tr('Excluir');
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteLayerUI(l); });
      row.addEventListener('click', () => setActiveLayerUI(l));
      row.append(dot, nm, cnt, eye, ren, del);
      box.appendChild(row);
    });
    if (typeof updateSmartPanel === 'function') updateSmartPanel();
  }
  async function setActiveLayerUI(l) {
    S.activeLayer = l.id; renderLayers();
    if (S.prov.setActiveLayer) { try { await S.prov.setActiveLayer(l.id); } catch (e) {} }
    markSaved(F.tr('Camada ativa: {s}', { s: l.name }));
  }
  async function toggleLayerVisible(l) {
    l.visible = !(l.visible !== false); renderLayers(); draw();
    if (S.prov.updateLayer) { try { await S.prov.updateLayer(l.id, { visible: l.visible }); } catch (e) {} }
  }
  function cycleLayerColor(l) {
    l.color = _LAYER_PAL[(_LAYER_PAL.indexOf(l.color) + 1) % _LAYER_PAL.length];
    renderLayers(); draw();
    if (S.prov.updateLayer) { try { S.prov.updateLayer(l.id, { color: l.color }); } catch (e) {} }
  }
  async function addLayerUI() {
    const name = prompt(F.tr('Nome da nova camada (ex.: Drywall, Framing…):'), '');
    if (!name || !name.trim() || !S.prov.addLayer) return;
    try { const r = await S.prov.addLayer(name.trim()); if (r && r.layers) { S.layers = r.layers; S.activeLayer = r.active; renderLayers(); markSaved(F.tr('Camada criada: {s}', { s: name.trim() })); } } catch (e) {}
  }
  async function renameLayer(l) {
    const nn = prompt(F.tr('Novo nome da camada "{s}":', { s: l.name }), l.name);
    if (!nn || !nn.trim()) return;
    l.name = nn.trim(); renderLayers();
    if (S.prov.updateLayer) { try { await S.prov.updateLayer(l.id, { name: l.name }); } catch (e) {} }
  }
  async function deleteLayerUI(l) {
    if (S.layers.length <= 1) { alert(F.tr('Não dá para apagar a última camada.')); return; }
    if (!confirm(F.tr('Excluir a camada "{s}"? As marcas dela vão para a primeira camada.', { s: l.name }))) return;
    if (!S.prov.deleteLayer) return;
    try { const r = await S.prov.deleteLayer(l.id); if (r && r.layers) { S.layers = r.layers; S.activeLayer = r.active; renderLayers(); await loadPage(S.page); markSaved(F.tr('Camada excluída')); } } catch (e) {}
  }

  // ----------------------------------------------------------------- páginas
  /** ordem das folhas como exibidas (respeita o sort) — base p/ seleção por intervalo */
  function pageLF(pageNo) { let lf = 0; (S.lines || []).forEach(l => { if (l.page === pageNo) lf += (l.mm || 0) / 304.8; }); return lf; }
  function displayedPages() {
    const s = S.pageSort, pages = S.pages.slice();
    if (s === 'marks') pages.sort((a, b) => (b.n_hex || 0) - (a.n_hex || 0) || a.page - b.page);
    else if (s === 'sheet') pages.sort((a, b) => String(a.sheet || '').localeCompare(String(b.sheet || ''), undefined, { numeric: true }) || a.page - b.page);
    else if (s === 'lf') pages.sort((a, b) => pageLF(b.page) - pageLF(a.page) || a.page - b.page);
    else pages.sort((a, b) => a.page - b.page);   // 'page' (padrão)
    return pages;
  }
  /** seleção estilo Excel: clique = só esta (e abre); Ctrl = alterna; Shift = intervalo */
  function selectPage(page, ev) {
    if (!S.toDelete) S.toDelete = new Set();
    if (ev && ev.shiftKey && S.selAnchor != null) {
      const order = displayedPages().map(p => p.page);
      const i = order.indexOf(S.selAnchor), j = order.indexOf(page);
      if (i >= 0 && j >= 0) {
        const [a, b] = i < j ? [i, j] : [j, i];
        S.toDelete = new Set(order.slice(a, b + 1));
      }
      renderPagesList();
    } else if (ev && (ev.ctrlKey || ev.metaKey)) {
      S.toDelete.has(page) ? S.toDelete.delete(page) : S.toDelete.add(page);
      S.selAnchor = page; renderPagesList();
    } else {
      S.toDelete = new Set(); S.selAnchor = page;  // clique simples: SÓ abre (não marca)
      loadPage(page);                              // (limpa qualquer seleção anterior)
    }
  }

  async function restoreCurrentMarks() {
    if (S.page == null) { markSaved(F.tr('Abra uma folha primeiro')); return; }
    if (!S.prov || !S.prov.restoreMarks) { alert(F.tr('Disponível no app de desktop.')); return; }
    if (!confirm(F.tr('Restaurar as marcas desta folha do backup? Isso desfaz o último Reconhecer nesta folha.'))) return;
    let r; try { r = await S.prov.restoreMarks(S.page); } catch (e) { markSaved(F.tr('Falha ao restaurar')); return; }
    if (!r || r.error) { markSaved(F.tr('Sem backup para esta folha')); return; }
    if (S.prov.reload) { try { const j = await S.prov.reload(); if (j) { S.pages = (j.pages || []).map(p => ({ ...p })); } } catch (e) {} }
    await loadPage(S.page);
    markSaved(F.tr('Marcas restauradas: {n}', { n: (r && r.n) || 0 }));
  }

  // resumo dos TIPOS de parede levantados numa folha (cor + LF + qtd) — p/ árvore PlanSwift
  function pageTypeSummary(pageNo) {
    const fr = F.framing, by = {};
    (S.lines || []).forEach(l => { if (l.page !== pageNo || !l.wt) return; const g = by[l.wt] = by[l.wt] || { lf: 0, qty: 0 }; g.lf += (l.mm || 0) / 304.8; g.qty++; });
    const arr = Object.keys(by).map(wid => {
      const wt = (fr && fr.wallTypes || []).filter(w => w.id === wid)[0];
      return { id: wid, typeId: (wt && wt.typeId) || '', name: wt ? wt.name : F.tr('(tipo)'), color: wt ? wt.color : '#999', lf: by[wid].lf, qty: by[wid].qty };
    });
    const ts = S.typeSort || 'lf', nat = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
    if (ts === 'type') arr.sort((a, b) => nat(a.typeId || a.name, b.typeId || b.name));
    else if (ts === 'name') arr.sort((a, b) => nat(a.name, b.name));
    else if (ts === 'qty') arr.sort((a, b) => b.qty - a.qty || b.lf - a.lf);
    else arr.sort((a, b) => b.lf - a.lf);   // 'lf' (padrão)
    return arr;
  }

  // resumo de ÁREA por folha (Piso/Teto em SF) — p/ a árvore PÁGINAS. Lê a folha
  // atual da memória e as demais do localStorage (áreas persistem por folha).
  function pageAreaSummary(pageNo) {
    const list = (pageNo === S.page) ? (S.areas || []) : loadAreas(pageNo);
    let f = 0, c = 0;
    (list || []).forEach(a => { if (a.kind === 'ceiling') c += (a.sf || 0); else f += (a.sf || 0); });
    return { floor: f, ceiling: c, any: f > 0 || c > 0 };
  }

  // ----- menu de contexto (botão direito) das PÁGINAS -----
  function closePagesMenu() { const m = document.getElementById('wsPagesMenu'); if (m) m.remove(); document.removeEventListener('click', closePagesMenu); document.removeEventListener('keydown', onMenuKey); }
  function onMenuKey(e) { if (e.key === 'Escape') closePagesMenu(); }
  // grupo "Ordenar TIPOS por" (dentro da árvore) — usado nos dois menus
  function typeSortItems(items) {
    const tLb = { type: F.tr('nº do tipo (1, 2, 2A…)'), name: F.tr('nome (A→Z)'), lf: F.tr('LF total'), qty: F.tr('quantidade') };
    items.push({ hdr: F.tr('Ordenar TIPOS por') });
    ['type', 'name', 'lf', 'qty'].forEach(k => items.push({ label: tLb[k], on: (S.typeSort || 'lf') === k, act: () => { S.typeSort = k; renderPagesList(); if (F._renderFramingPanel) F._renderFramingPanel(); markSaved(F.tr('Tipos ordenados por {by}', { by: tLb[k] })); } }));
  }
  function pagesMenu(x, y, page) {
    closePagesMenu();
    const sortLb = { page: F.tr('nº da folha'), sheet: F.tr('código (A→Z)'), marks: F.tr('nº de marcas'), lf: F.tr('LF total') };
    const items = [];
    items.push({ hdr: F.tr('Ordenar FOLHAS por') });
    ['page', 'sheet', 'marks', 'lf'].forEach(k => items.push({ label: sortLb[k], on: S.pageSort === k, act: () => { S.pageSort = k; renderPagesList(); markSaved(F.tr('Ordenado por {by}', { by: sortLb[k] })); } }));
    items.push({ sep: true });
    typeSortItems(items);
    items.push({ sep: true });
    items.push({ label: F.tr('Expandir todas'), act: () => { displayedPages().forEach(p => { if (pageTypeSummary(p.page).length) S.pageExp.add(p.page); }); renderPagesList(); } });
    items.push({ label: F.tr('Recolher todas'), act: () => { S.pageExp.clear(); renderPagesList(); } });
    items.push({ sep: true });
    items.push({ label: F.tr('Mostrar todas as cores'), act: () => { S.hiddenTypes.clear(); draw(); renderPagesList(); } });
    if (page != null) {
      items.push({ sep: true });
      items.push({ label: F.tr('Ir para esta folha'), act: () => { selectPage(page, {}); } });
      items.push({ label: F.tr('Atualizar folha'), act: () => { loadPage(page); } });
      items.push({ sep: true });
      const pageLines = (S.lines || []).filter(l => l.page === page);
      items.push({ label: F.tr('Copiar paredes') + (pageLines.length ? ' (' + pageLines.length + ')' : ''), dis: !pageLines.length, act: () => { S.lineClip = pageLines.map(l => JSON.parse(JSON.stringify(l))); markSaved(F.tr('{n} parede(s) copiada(s)', { n: S.lineClip.length })); } });
      items.push({ label: F.tr('Colar paredes') + (S.lineClip && S.lineClip.length ? ' (' + S.lineClip.length + ')' : ''), dis: !(S.lineClip && S.lineClip.length), act: () => { pasteLinesToPage(page); } });
      items.push({ label: F.tr('Duplicar paredes'), dis: !pageLines.length, act: () => { S.lineClip = pageLines.map(l => JSON.parse(JSON.stringify(l))); pasteLinesToPage(page); } });
      items.push({ sep: true });
      const sel = S.toDelete || (S.toDelete = new Set()), picked = sel.has(page);
      items.push({ label: picked ? F.tr('Desmarcar p/ apagar') : F.tr('Marcar p/ apagar'), act: () => { picked ? sel.delete(page) : sel.add(page); S.selAnchor = page; renderPagesList(); } });
      items.push({ label: F.tr('Deletar folha'), danger: true, act: () => { if (confirm(F.tr('Apagar esta folha e tudo nela?'))) doDeletePages([page]); } });
    }
    showCtxMenu(x, y, items);
  }
  // menu de contexto de um TIPO de parede (filho da folha)
  function typesMenu(x, y, wtId, page) {
    const wt = (F.framing && F.framing.wallTypes || []).filter(w => w.id === wtId)[0];
    const tname = wt ? wt.name : F.tr('(tipo)');
    const typeLines = (S.lines || []).filter(l => l.page === page && l.wt === wtId);
    const hidden = S.hiddenTypes && S.hiddenTypes.has(wtId);
    const items = [];
    items.push({ hdr: tname });
    items.push({ label: F.tr('Ativar este tipo'), on: F.framing && F.framing.activeWT === wtId, act: () => { if (F.framing) F.framing.activeWT = wtId; if (F._syncWallTypeSelect) F._syncWallTypeSelect(); if (page !== S.page) selectPage(page, {}); else draw(); renderPagesList(); } });
    items.push({ label: hidden ? F.tr('Mostrar (cor)') : F.tr('Ocultar (cor)'), act: () => { hidden ? S.hiddenTypes.delete(wtId) : S.hiddenTypes.add(wtId); draw(); renderPagesList(); if (F._renderFramingPanel) F._renderFramingPanel(); } });
    items.push({ sep: true });
    items.push({ label: F.tr('Copiar paredes') + (typeLines.length ? ' (' + typeLines.length + ')' : ''), dis: !typeLines.length, act: () => { S.lineClip = typeLines.map(l => JSON.parse(JSON.stringify(l))); markSaved(F.tr('{n} parede(s) copiada(s)', { n: S.lineClip.length })); } });
    items.push({ label: F.tr('Colar como este tipo') + (S.lineClip && S.lineClip.length ? ' (' + S.lineClip.length + ')' : ''), dis: !(S.lineClip && S.lineClip.length), act: () => { pasteLinesToPage(page, wtId); } });
    items.push({ label: F.tr('Duplicar paredes'), dis: !typeLines.length, act: () => { S.lineClip = typeLines.map(l => JSON.parse(JSON.stringify(l))); pasteLinesToPage(page, wtId); } });
    items.push({ label: F.tr('Deletar paredes deste tipo'), danger: true, dis: !typeLines.length, act: () => { if (!confirm(F.tr('Apagar as {n} parede(s) deste tipo nesta folha?', { n: typeLines.length }))) return; pushUndo(); const del = new Set(typeLines); S.lines = S.lines.filter(l => !del.has(l)); if (S.prov && S.prov.saveLines) { try { S.prov.saveLines(page, S.lines.filter(l => l.page === page)); } catch (e) {} } draw(); renderPagesList(); if (F._renderFramingPanel) F._renderFramingPanel(); markSaved(F.tr('Paredes apagadas')); } });
    items.push({ sep: true });
    items.push({ label: F.tr('Editar tipo…'), act: () => { if (F.framing) { F.framing.activeWT = wtId; F.framing._editWT = wtId; } const ov = document.getElementById('frTakeoff'); if (!ov || ov.style.display === 'none') { const b = $('#stFraming'); if (b) b.click(); } else if (F._renderFramingPanel) F._renderFramingPanel(); } });
    items.push({ label: F.tr('Renomear tipo'), dis: !wt, act: () => { const nm = prompt(F.tr('Novo nome do tipo:'), tname); if (nm == null) return; wt.name = nm.trim() || wt.name; if (F._saveFraming) F._saveFraming(); if (F._syncWallTypeSelect) F._syncWallTypeSelect(); renderPagesList(); if (F._renderFramingPanel) F._renderFramingPanel(); } });
    items.push({ sep: true });
    typeSortItems(items);
    showCtxMenu(x, y, items);
  }
  // renderiza um menu de contexto (lista de itens) na posição do cursor
  function showCtxMenu(x, y, items) {
    closePagesMenu();
    const m = document.createElement('div'); m.id = 'wsPagesMenu'; m.className = 'ws-ctxmenu';
    items.forEach(it => {
      if (it.sep) { const d = document.createElement('div'); d.className = 'ws-ctxsep'; m.appendChild(d); return; }
      if (it.hdr) { const h = document.createElement('div'); h.className = 'ws-ctxhdr'; h.textContent = it.hdr; m.appendChild(h); return; }
      const b = document.createElement('div'); b.className = 'ws-ctxitem' + (it.dis ? ' is-dis' : '') + (it.danger ? ' is-danger' : ''); b.textContent = (it.on ? '✓ ' : '') + it.label;
      if (!it.dis) b.addEventListener('click', (e) => { e.stopPropagation(); it.act(); closePagesMenu(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 6) + 'px';
    m.style.top = Math.min(y, window.innerHeight - m.offsetHeight - 6) + 'px';
    setTimeout(() => { document.addEventListener('click', closePagesMenu); document.addEventListener('keydown', onMenuKey); }, 0);
  }

  function renderPagesList() {
    const el = $('#wsPages'); if (!el) return;
    el.innerHTML = '';
    const sel = S.toDelete || (S.toDelete = new Set());
    if (!S.pageExp) S.pageExp = new Set();
    displayedPages().forEach(p => {
      const picked = sel.has(p.page);
      const types = pageTypeSummary(p.page);
      const ar = pageAreaSummary(p.page);
      const hasChildren = types.length || ar.any;
      const row = document.createElement('div');
      row.setAttribute('data-pageno', p.page);
      row.className = 'px-2 py-1.5 cursor-pointer flex items-center gap-1.5 select-none ' +
        (picked ? 'bg-amber-700/60 text-white ring-1 ring-inset ring-amber-400' : (p.page === S.page ? 'bg-steel-700 font-semibold' : 'hover:bg-steel-700'));
      // triângulo de expandir (só quando há tipos levantados)
      const tri = document.createElement('span');
      tri.className = 'w-3 text-xs text-steel-400 shrink-0 text-center';
      tri.textContent = hasChildren ? (S.pageExp.has(p.page) ? '▾' : '▸') : '';
      if (hasChildren) tri.addEventListener('click', (ev) => { ev.stopPropagation(); S.pageExp.has(p.page) ? S.pageExp.delete(p.page) : S.pageExp.add(p.page); renderPagesList(); });
      row.appendChild(tri);
      const badge = p.n_hex
        ? '<span class="text-xs bg-emerald-600 text-white rounded px-1.5">' + p.n_hex + '</span>'
        : '<span class="text-xs text-steel-500">—</span>';
      const sched = S.schedulePages.indexOf(p.page) >= 0 ? '<span title="' + F.tr('folha de medidas') + '" class="text-xs">📐</span>' : '';
      const name = p.sheet ? (p.sheet + ' <span class="text-steel-400 text-xs">(' + p.page + ')</span>') : F.tr('Folha {p}', { p: p.page });
      const nameEl = document.createElement('span');
      nameEl.className = 'flex-1 truncate'; nameEl.innerHTML = name;
      row.appendChild(nameEl);
      row.insertAdjacentHTML('beforeend', sched + badge);
      // bolinha por FOLHA: oculta/mostra TODAS as cores abaixo (verde=ativo, vermelho=desativado) — duplo-clique alterna
      if (types.length) {
        const ids = types.map(t => t.id).filter(Boolean);
        const allHidden = ids.length > 0 && ids.every(id => S.hiddenTypes.has(id));
        const dot = document.createElement('span');
        dot.title = F.tr('Duplo-clique: ocultar/mostrar todas as cores desta folha');
        dot.style.cssText = 'width:11px;height:11px;border-radius:50%;flex:0 0 auto;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.25) inset;background:' + (allHidden ? '#ef4444' : '#10b981');
        dot.addEventListener('click', (ev) => ev.stopPropagation());
        dot.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          if (allHidden) ids.forEach(id => S.hiddenTypes.delete(id)); else ids.forEach(id => S.hiddenTypes.add(id));
          draw(); renderPagesList(); if (F._renderFramingPanel) F._renderFramingPanel();
        });
        row.appendChild(dot);
      }
      const trash = document.createElement('button');
      trash.className = 'text-xs px-1 rounded hover:bg-steel-600 ' + (picked ? 'opacity-100 text-amber-300' : 'opacity-60');
      trash.textContent = picked ? '☑' : '☐'; trash.title = picked ? F.tr('desmarcar') : F.tr('selecionar');
      trash.addEventListener('click', (ev) => { ev.stopPropagation(); picked ? sel.delete(p.page) : sel.add(p.page); S.selAnchor = p.page; renderPagesList(); });
      row.appendChild(trash);
      row.addEventListener('click', (ev) => selectPage(p.page, ev));   // Ctrl/Shift/clique = Excel
      el.appendChild(row);
      // FILHOS: tipos de parede levantados nesta folha (cor + LF) — clique ativa o tipo
      if (hasChildren && S.pageExp.has(p.page)) {
        types.forEach(t => {
          const hidden = t.id && S.hiddenTypes && S.hiddenTypes.has(t.id);
          const c = document.createElement('div');
          if (t.id) { c.setAttribute('data-wt', t.id); c.setAttribute('data-pageno', p.page); }
          c.className = 'pl-8 pr-2 py-1 flex items-center gap-2 text-sm cursor-pointer hover:bg-steel-700/60' + (hidden ? ' opacity-40' : '');
          const sw = document.createElement('span');
          sw.title = F.tr('Duplo-clique p/ ocultar/mostrar este tipo');
          sw.style.cssText = 'width:12px;height:12px;border-radius:3px;flex:0 0 auto;cursor:pointer;' + (hidden ? ('background:transparent;border:2px solid ' + t.color) : ('background:' + t.color));
          sw.addEventListener('click', (ev) => ev.stopPropagation());                      // 1 clique na cor não ativa
          sw.addEventListener('dblclick', (ev) => { ev.stopPropagation(); if (!t.id) return; S.hiddenTypes.has(t.id) ? S.hiddenTypes.delete(t.id) : S.hiddenTypes.add(t.id); draw(); renderPagesList(); });
          const nm = document.createElement('span'); nm.className = 'flex-1 truncate text-steel-200' + (hidden ? ' line-through' : ''); nm.textContent = t.name;
          const q = document.createElement('span'); q.className = 'text-steel-300 tabular-nums text-xs'; q.textContent = t.lf.toFixed(1) + ' LF';
          c.appendChild(sw); c.appendChild(nm); c.appendChild(q);
          c.addEventListener('click', () => { if (F.framing) F.framing.activeWT = t.id; if (F._syncWallTypeSelect) F._syncWallTypeSelect(); if (p.page !== S.page) selectPage(p.page, {}); else if (F._wsRedraw) F._wsRedraw(); });
          el.appendChild(c);
        });
        // ÁREA levantada nesta folha (Piso verde / Teto azul, em SF) — clique abre a folha
        [['floor', ar.floor, '#22c55e', F.tr('Piso')], ['ceiling', ar.ceiling, '#38bdf8', F.tr('Teto')]].forEach(arr => {
          if (!arr[1]) return;
          const c = document.createElement('div');
          c.setAttribute('data-pageno', p.page);
          c.className = 'pl-8 pr-2 py-1 flex items-center gap-2 text-sm cursor-pointer hover:bg-steel-700/60';
          const sw = document.createElement('span'); sw.style.cssText = 'width:12px;height:12px;border-radius:3px;flex:0 0 auto;background:' + arr[2];
          const nm = document.createElement('span'); nm.className = 'flex-1 truncate text-steel-200'; nm.textContent = arr[3];
          const q = document.createElement('span'); q.className = 'text-steel-300 tabular-nums text-xs'; q.textContent = arr[1].toFixed(1) + ' SF';
          c.appendChild(sw); c.appendChild(nm); c.appendChild(q);
          c.addEventListener('click', () => { if (p.page !== S.page) selectPage(p.page, {}); });
          el.appendChild(c);
        });
      }
    });
    const btn = $('#wsDelPages');
    if (btn) { btn.textContent = F.tr('🗑 Apagar ({n})', { n: sel.size }); btn.classList.toggle('hidden', sel.size === 0); }
  }

  async function loadPage(page) {
    await flushSave();
    S.page = page; S.highlight = null;
    const meta = S.pages.find(p => p.page === page) || {};
    $('#wsMult').value = meta.mult || 1;
    S.mmPerPx = meta.mm_per_px || null; S.clickA = null;   // escala por folha
    $('#wsPageTitle').textContent = meta.sheet ? F.tr('{s} (folha {p})', { s: meta.sheet, p: page }) : F.tr('Folha {p}', { p: page });
    renderPagesList();
    let data;
    try { data = await S.prov.getPage(page); } catch (e) { data = { marks: [], image_b64: '' }; }
    S.marks = (data.marks || []).map(m => ({
      x: m.x, y: m.y, w: m.w || 24, h: m.h || 24,
      label: (m.label || '').toString().trim().toUpperCase(),
      confirmed: m.confirmed !== false, cv: !!m.cv, section: m.section || 'Geral',
      layer: m.layer || 'default',
    }));
    S.measures = Array.isArray(data.measures) ? data.measures : [];   // medidas salvas
    // áreas desta folha: PREFERE o que o motor (Python) salvou no projeto; senão localStorage (fallback web/cliente antigo)
    S.areas = Array.isArray(data.areas) ? data.areas : loadAreas(S.page);
    S.areaPts = []; if (S.areaSel) S.areaSel.clear(); updateAreaTot();
    // traços do Linear salvos desta folha → substituem os desta página em memória
    S.lines = (S.lines || []).filter(l => l.page !== S.page);
    (Array.isArray(data.lines) ? data.lines : []).forEach(l => { l.page = S.page; S.lines.push(l); });
    if (S.lineSel) S.lineSel.clear();
    clearSel(); updateMeasSel();
    S.snapData = null; S.hover = null;
    S.img = new Image();
    S.img.onload = () => { buildSnapData(); resize(); fit(); draw(); };
    S.img.src = data.image_b64 || '';
    renderItems();
    renderLayers();           // contagem por camada da folha
    syncPageBadge();          // badge reflete as marcas salvas desta folha
    updateSchedUI();          // estado do botão "folha de medidas"
    updateScaleInfo();
    updateFooter();
    updateSelWindow();
    syncPaneAPicker();        // header de folha do painel A (seletor + nº de marcas)
    if (S.prov && S.prov.prewarmAutoCount) { try { S.prov.prewarmAutoCount(page); } catch (e) {} }   // aquece o Auto Count em 2º plano
  }
  /** header do painel A: popula o seletor de folha, liga o change e mostra nº de marcas */
  function syncPaneAPicker() {
    const sel = document.querySelector('#wsPaneASheet'); if (!sel) return;
    if (!sel._filled) { sel.innerHTML = (S.pages || []).map(p => '<option value="' + p.page + '">' + (p.sheet || ('Folha ' + p.page)) + '</option>').join(''); sel._filled = true; }
    if (!sel._wired) { sel._wired = true; sel.addEventListener('change', () => loadPage(+sel.value)); }
    sel.value = S.page;
    const inf = document.querySelector('#wsPaneAInfo');
    if (inf) inf.textContent = '· ' + (S.marks || []).filter(m => m.confirmed !== false).length + ' marcas';
  }

  // ----------------------------------------------------------------- itens (painel esquerdo)
  function counts() {
    const c = {};
    S.marks.filter(m => m.confirmed).forEach(m => { const k = m.label || '(sem rótulo)'; c[k] = (c[k] || 0) + 1; });
    return c;
  }

  function renderItems() {
    const el = $('#wsItems'); if (!el) return;
    const c = counts();
    const mult = curMult();
    el.innerHTML = '';
    const sched = S.sched || {};
    Object.entries(c).sort().forEach(([label, n]) => {
      const row = document.createElement('div');
      const active = label === S.highlight;
      row.className = 'px-3 py-1.5 cursor-pointer ' + (active ? 'bg-amber-500/30 ring-1 ring-amber-400' : 'hover:bg-steel-700');
      const r = sched[label] || sched[(label || '').toUpperCase()];
      // 2ª linha com a informação da janela (medidas + tipo + modelo) do schedule
      let info = '';
      if (r) {
        const dim = (r.w_raw && r.h_raw) ? (r.w_raw + ' × ' + r.h_raw) : ((r.w_mm && r.h_mm) ? (r.w_mm + '×' + r.h_mm + 'mm') : '');
        const extra = [r.type, r.model].filter(Boolean).join(' · ');
        info = '<div class="text-xs text-steel-400 truncate">' + [dim, extra].filter(Boolean).join(' · ') + '</div>';
      } else {
        info = '<div class="text-xs text-rose-400/70 truncate">' + F.tr('sem medida no schedule') + '</div>';
      }
      row.innerHTML =
        '<div class="flex items-center gap-2">' +
          '<span class="flex-1 truncate font-medium">' + label + '</span>' +
          '<span class="text-xs text-steel-300">' + n + (mult > 1 ? '×' + mult : '') + '</span>' +
        '</div>' + info;
      row.addEventListener('click', () => selectItem(label));
      el.appendChild(row);
    });
    if (!Object.keys(c).length) el.innerHTML = '<div class="px-3 py-2 text-xs text-steel-500">' + F.tr('Nenhuma marca confirmada nesta folha.') + '</div>';
    updateSmartPanel();
    renderSummary();
  }
  /** tabela de resumo da marcação (rodapé): Marca · Tipo · Medida · Qtd (com pavimentos e Twin) */
  function sumEsc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function sumTypeOptions(sel) {
    let h = '<option value="">—</option>';
    [...new Set((F.WINDOW_TYPES || []).map(t => t.cat))].forEach(cat => {
      h += '<optgroup label="' + cat + '">';
      (F.WINDOW_TYPES || []).filter(t => t.cat === cat).forEach(t => {
        const lbl = F.typeLabel ? F.typeLabel(t.name) : t.name;
        h += '<option value="' + t.name + '"' + (t.name === sel ? ' selected' : '') + '>' + lbl + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  }
  async function saveSummary(code, patch) {
    if (!S.prov || !S.prov.setWindowDim) { markSaved(F.tr('Disponível no app de desktop.')); return; }
    const wmm = patch.w != null ? F.parseToMm(patch.w) : null;
    const hmm = patch.h != null ? F.parseToMm(patch.h) : null;
    const ty = patch.type != null ? (patch.type || null) : null;
    let r; try { r = await S.prov.setWindowDim(code, wmm || null, hmm || null, ty, null); } catch (e) { markSaved(F.tr('Falha ao salvar')); return; }
    if (r && r.rec) { S.sched = S.sched || {}; S.sched[code] = Object.assign({}, S.sched[code], r.rec); }
    renderItems();
    markSaved(F.tr('Resumo: {c} atualizado', { c: code }));
  }
  function renderSummary() {
    const panel = document.querySelector('#wsSummary');
    if (!panel || panel.classList.contains('hidden')) return;
    const body = document.querySelector('#wsSummaryBody'); if (!body) return;
    if (!body._wired) {
      body._wired = true;
      body.addEventListener('change', (e) => {
        const el = e.target, code = el.getAttribute && el.getAttribute('data-code'); if (!code) return;
        if (el.classList.contains('sumType')) saveSummary(code, { type: el.value });
        else if (el.classList.contains('sumW') || el.classList.contains('sumH')) {
          const w = body.querySelector('.sumW[data-code="' + code + '"]'), h = body.querySelector('.sumH[data-code="' + code + '"]');
          saveSummary(code, { w: w ? w.value : '', h: h ? h.value : '' });
        }
      });
    }
    const counts = {};
    (S.marks || []).forEach(m => { if (m.confirmed) { const k = m.label || ''; counts[k] = (counts[k] || 0) + 1; } });
    const codes = Object.keys(counts).sort((a, b) => (a || '~').localeCompare(b || '~', undefined, { numeric: true }));
    const meta = (S.pages || []).find(p => p.page === S.page) || {};
    const pmult = +meta.mult || 1;
    const fol = document.querySelector('#wsSummaryFolha');
    if (fol) fol.textContent = (meta.sheet || ('folha ' + S.page)) + (pmult > 1 ? ' · pavimentos×' + pmult : '') + ' · ✏️ editável';
    const inCls = 'bg-steel-900 text-steel-100 rounded px-1 py-0.5 text-xs border border-steel-600';
    let rows = '', tot = 0;
    codes.forEach(k => {
      const r = (S.sched || {})[k] || {};
      const tw = r.type === 'Twin Window' ? 2 : 1;
      const q = counts[k] * pmult * tw; tot += q;
      const calc = '' + counts[k] + (pmult > 1 ? '×' + pmult + 'pav' : '') + (tw > 1 ? '×2tw' : '');
      const qtd = (calc !== '' + counts[k]) ? (calc + ' = <b>' + q + '</b>') : ('<b>' + q + '</b>');
      rows += '<tr class="border-t border-steel-700/60">'
        + '<td class="px-3 py-1 font-semibold">' + (k || '—') + '</td>'
        + '<td class="px-3 py-1"><select class="sumType ' + inCls + '" data-code="' + sumEsc(k) + '">' + sumTypeOptions(r.type || '') + '</select></td>'
        + '<td class="px-3 py-1 whitespace-nowrap"><input class="sumW w-20 ' + inCls + '" data-code="' + sumEsc(k) + '" value="' + sumEsc(r.w_raw || '') + '" placeholder="larg"> × <input class="sumH w-20 ' + inCls + '" data-code="' + sumEsc(k) + '" value="' + sumEsc(r.h_raw || '') + '" placeholder="alt"></td>'
        + '<td class="px-3 py-1 text-right">' + qtd + '</td></tr>';
    });
    if (!codes.length) rows = '<tr><td colspan="4" class="px-3 py-3 text-steel-500">Nenhuma marca confirmada nesta folha.</td></tr>';
    else rows += '<tr class="border-t-2 border-amber-600/60"><td colspan="3" class="px-3 py-1.5 font-semibold text-right">Total desta folha</td><td class="px-3 py-1.5 text-right font-bold text-amber-300">' + tot + '</td></tr>';
    body.innerHTML = rows;
  }
  function positionSummary() {
    const p = document.querySelector('#wsSummary'); if (!p) return;
    const vis = (el) => el && !el.classList.contains('hidden') && el.offsetWidth > 0;
    const lw = vis(document.querySelector('#wsLeft')) ? document.querySelector('#wsLeft').offsetWidth
      : (vis(document.querySelector('#wsLeftBar')) ? document.querySelector('#wsLeftBar').offsetWidth : 0);
    const rw = vis(document.querySelector('#wsRight')) ? document.querySelector('#wsRight').offsetWidth
      : (vis(document.querySelector('#wsRightBar')) ? document.querySelector('#wsRightBar').offsetWidth : 0);
    p.style.left = lw + 'px'; p.style.right = rw + 'px';   // fica ENTRE as barras laterais
    const sb = document.querySelector('#wsStatusBar');
    p.style.bottom = (sb ? sb.offsetHeight : 24) + 'px';   // ACIMA da barra de status (não cobre)
  }
  F._toggleSummary = function () { const p = document.querySelector('#wsSummary'); if (p) { positionSummary(); p.classList.toggle('hidden'); renderSummary(); } };
  window.addEventListener('resize', () => { const p = document.querySelector('#wsSummary'); if (p && !p.classList.contains('hidden')) positionSummary(); });
  // recolher/expandir as barras laterais muda o tamanho do canvas → reposiciona o resumo
  (function () {
    if (!window.ResizeObserver) return;
    const reposition = () => { const p = document.querySelector('#wsSummary'); if (p && !p.classList.contains('hidden')) positionSummary(); };
    const ro = new ResizeObserver(reposition);
    const arm = () => { const c = document.querySelector('#wsCanvas'); if (c) ro.observe(c); };
    if (document.readyState !== 'loading') arm(); else document.addEventListener('DOMContentLoaded', arm);
  })();
  // Takeoff de Framing (#frTakeoff) — mesmo posicionamento do Resumo: ENTRE as barras, ACIMA do status
  F._positionFraming = function () {
    const p = document.querySelector('#frTakeoff'); if (!p) return;
    const vis = (el) => el && !el.classList.contains('hidden') && el.offsetWidth > 0;
    const lw = vis(document.querySelector('#wsLeft')) ? document.querySelector('#wsLeft').offsetWidth
      : (vis(document.querySelector('#wsLeftBar')) ? document.querySelector('#wsLeftBar').offsetWidth : 0);
    const rw = vis(document.querySelector('#wsRight')) ? document.querySelector('#wsRight').offsetWidth
      : (vis(document.querySelector('#wsRightBar')) ? document.querySelector('#wsRightBar').offsetWidth : 0);
    p.style.left = lw + 'px'; p.style.right = rw + 'px';
    const sb = document.querySelector('#wsStatusBar');
    p.style.bottom = (sb ? sb.offsetHeight : 24) + 'px';
  };
  window.addEventListener('resize', () => { const p = document.querySelector('#frTakeoff'); if (p && p.style.display !== 'none' && F._positionFraming) F._positionFraming(); });
  (function () {
    if (!window.ResizeObserver) return;
    const reposition = () => { const p = document.querySelector('#frTakeoff'); if (p && p.style.display !== 'none' && F._positionFraming) F._positionFraming(); };
    const ro = new ResizeObserver(reposition);
    const arm = () => { const c = document.querySelector('#wsCanvas'); if (c) ro.observe(c); };
    if (document.readyState !== 'loading') arm(); else document.addEventListener('DOMContentLoaded', arm);
  })();

  /** Clicar num item da lista → realça TODAS as marcas iguais e enquadra todas juntas. */
  function selectItem(label) {
    S.highlight = (S.highlight === label) ? null : label;
    if (S.highlight) {
      const ms = S.marks.filter(m => m.confirmed && (m.label || '(sem rótulo)') === label);
      if (ms.length) frameMarks(ms);
      smartFocus('janela');                       // painel inteligente: abre "Janela selecionada"
    }
    renderItems(); draw(); updateSelWindow();
  }

  /** Painel "Janela selecionada": habilita/preenche os campos do código selecionado. */
  function updateSelWindow() {
    const code = S.highlight;
    const on = !!code;
    ['#wsDimW', '#wsDimH', '#wsDimType', '#wsDimWmeas', '#wsDimHmeas', '#wsDimSave'].forEach(s => { const el = $(s); if (el) el.disabled = !on; });
    populateTypeSelect();
    const cap = $('#wsSelCode');
    if (!on) { if (cap) cap.textContent = F.tr('Clique num código na lista à esquerda.'); return; }
    const r = (S.sched || {})[code] || {};
    if (cap) cap.innerHTML = F.tr('Código <b>{c}</b>', { c: code }) + (r.manual ? ' <span class="text-emerald-400">' + F.tr('(medida manual)') + '</span>' : (r.w_mm ? ' ' + F.tr('(do schedule)') : ''));
    const w = $('#wsDimW'), h = $('#wsDimH');
    if (w) w.value = r.w_raw || (r.w_mm ? r.w_mm + 'mm' : '');
    if (h) h.value = r.h_raw || (r.h_mm ? r.h_mm + 'mm' : '');
    const ty = $('#wsDimType'); if (ty) ty.value = r.type || '';
  }
  /** popula o seletor de Tipo (janela/porta) a partir de F.WINDOW_TYPES (uma vez) */
  function populateTypeSelect() {
    const sel = $('#wsDimType'); if (!sel || sel._filled) return;
    const types = F.WINDOW_TYPES || [];
    if (!types.length) return;
    sel._filled = true;
    let html = '<option value="">' + F.tr('(automático)') + '</option>';
    [...new Set(types.map(t => t.cat))].forEach(cat => {
      html += '<optgroup label="' + cat + '">';
      types.filter(t => t.cat === cat).forEach(t => {
        const lbl = F.typeLabel ? F.typeLabel(t.name) : t.name;
        html += '<option value="' + t.name + '">' + lbl + '</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
  }

  /** Ajusta zoom/posição p/ caber TODAS as marcas passadas (com folga). */
  function frameMarks(ms) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    ms.forEach(m => {
      minx = Math.min(minx, m.x); miny = Math.min(miny, m.y);
      maxx = Math.max(maxx, m.x + m.w); maxy = Math.max(maxy, m.y + m.h);
    });
    const pad = Math.max(60, (maxx - minx) * 0.2, (maxy - miny) * 0.2);
    const bw = (maxx - minx) + pad * 2, bh = (maxy - miny) + pad * 2;
    let sc = Math.min(cv.width / bw, cv.height / bh);
    sc = Math.max(0.05, Math.min(sc, 6));     // não exagera o zoom p/ 1 marca só
    S.scale = sc;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    S.ox = cv.width / 2 - cx * sc;
    S.oy = cv.height / 2 - cy * sc;
  }

  const curMult = () => Math.max(1, parseInt($('#wsMult') && $('#wsMult').value, 10) || 1);

  // ----------------------------------------------------------------- canvas
  function resize() { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
  function fit() {
    if (!S.img || !S.img.width) { S.scale = 1; S.ox = 0; S.oy = 0; return; }
    const s = Math.min(cv.width / S.img.width, cv.height / S.img.height);
    S.scale = s; S.ox = (cv.width - S.img.width * s) / 2; S.oy = (cv.height - S.img.height * s) / 2;
  }
  const toImg = (sx, sy) => [(sx - S.ox) / S.scale, (sy - S.oy) / S.scale];

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (S.img && S.img.width) ctx.drawImage(S.img, S.ox, S.oy, S.img.width * S.scale, S.img.height * S.scale);
    const ksel = S.selMarks;
    S.marks.forEach(m => {
      if (!layerVisible(m.layer)) return;     // camada oculta → não desenha
      const x = m.x * S.scale + S.ox, y = m.y * S.scale + S.oy, w = m.w * S.scale, h = m.h * S.scale;
      ctx.lineWidth = 2;
      ctx.strokeStyle = m.confirmed ? colorOf(m.label) : 'rgba(150,150,150,.5)';
      ctx.strokeRect(x, y, w, h);
      if (ksel && ksel.has(m)) {              // marca selecionada (laço) → realce vermelho
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
      }
      if (m.confirmed && m.label) {
        ctx.fillStyle = '#111'; ctx.font = '600 12px Inter, sans-serif';
        ctx.fillText(m.label, x, y - 3);
      }
    });
    // linhas de medida (régua) — todas as medidas da folha
    (S.measures || []).forEach(ml => {
      const ax = ml.a[0] * S.scale + S.ox, ay = ml.a[1] * S.scale + S.oy;
      const bx = ml.b[0] * S.scale + S.ox, by = ml.b[1] * S.scale + S.oy;
      const sel = selSet().has(ml);
      ctx.strokeStyle = sel ? '#ef4444' : '#d9a02a'; ctx.lineWidth = sel ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const col = sel ? '#ef4444' : '#d9a02a';
      [[ax, ay], [bx, by]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, sel ? 6 : 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
      const txt = mmToFtIn(ml.mm);
      ctx.font = '700 13px Inter, sans-serif';
      const tw = ctx.measureText(txt).width;
      // total da linha: no meio normalmente; junto da PONTA que está sendo arrastada (visível no zoom)
      let lx = (ax + bx) / 2, ly = (ay + by) / 2;
      if (S.dragMeas && S.dragMeas.m === ml) {
        const e = S.dragMeas.end === 'a' ? [ax, ay] : [bx, by];
        lx = e[0]; ly = e[1] - 16;
      }
      const bg = (S.dragMeas && S.dragMeas.m === ml) ? 'rgba(239,68,68,.97)' : (sel ? 'rgba(239,68,68,.95)' : 'rgba(217,160,42,.95)');
      ctx.fillStyle = bg; ctx.fillRect(lx - tw / 2 - 4, ly - 18, tw + 8, 18);
      ctx.fillStyle = '#fff'; ctx.fillText(txt, lx - tw / 2, ly - 5);
    });
    // LINEAR — traços contínuos da folha atual (cor = camada/trade)
    (S.lines || []).forEach(ln => {
      if (ln.page !== S.page || !layerVisible(ln.layer)) return;
      if (ln.wt && S.hiddenTypes && S.hiddenTypes.has(ln.wt)) return;   // tipo oculto (duplo-clique na cor)
      const fr = F.framing, wt = (ln.wt && fr && fr.wallTypes) ? fr.wallTypes.filter(w => w.id === ln.wt)[0] : null;
      const lay = layerById(ln.layer), col = (wt && wt.color) || (lay && lay.color) || '#e3b653';   // cor do TIPO; senão da camada
      const seld = S.lineSel && S.lineSel.has(ln);
      const isActive = wt && fr && ln.wt === fr.activeWT;   // tipo ATIVO → evidencia
      ctx.lineWidth = seld ? 5 : (isActive ? 4.5 : 3); ctx.strokeStyle = seld ? '#ef4444' : col; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (isActive && !seld) { ctx.shadowColor = col; ctx.shadowBlur = 12; } else { ctx.shadowBlur = 0; }
      ctx.beginPath();
      ln.path.forEach((p, i) => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      ctx.shadowBlur = 0;
      const mid = ln.path[Math.floor(ln.path.length / 2)], mx = mid[0] * S.scale + S.ox, my = mid[1] * S.scale + S.oy;
      const tag = (wt && wt.typeId) ? '(' + wt.typeId + ') ' : '';   // tipo da parede antes da medida: (2) 36'-2 3/16"
      const txt = tag + mmToFtIn(ln.mm); ctx.font = '700 12px Inter, sans-serif'; const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(15,14,11,.85)'; ctx.fillRect(mx + 6, my - 16, tw + 8, 15);
      ctx.fillStyle = col; ctx.fillText(txt, mx + 10, my - 4);
    });
    // ÁREA — polígonos finalizados desta folha (verde translúcido + SF no centro)
    (S.areas || []).forEach(ar => {
      if (ar.page !== S.page || !ar.path || ar.path.length < 3) return;
      const k = ar.kind || 'floor', seld = S.areaSel && S.areaSel.has(ar);
      ctx.beginPath();
      ar.path.forEach((p, i) => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath();
      ctx.fillStyle = seld ? 'rgba(245,158,11,.22)' : kindFill(k, '.18'); ctx.fill();
      ctx.lineWidth = seld ? 4 : 2; ctx.strokeStyle = seld ? '#f59e0b' : kindFill(k, '.9'); ctx.lineJoin = 'round'; ctx.stroke();
      const c = polyCentroid(ar.path), cx = c[0] * S.scale + S.ox, cy = c[1] * S.scale + S.oy;
      const txt = kindName(k) + '  ' + ar.sf.toFixed(1) + ' SF'; ctx.font = '700 13px Inter, sans-serif'; const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(15,14,11,.85)'; ctx.fillRect(cx - tw / 2 - 5, cy - 9, tw + 10, 18);
      ctx.fillStyle = kindText(k); ctx.fillText(txt, cx - tw / 2, cy + 4);
      if (S.areaMode) ar.path.forEach(p => {        // vértices visíveis p/ apagar com botão direito
        const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = kindFill(k, '.95'); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      });
    });
    if (S.areaMode && S.areaPts && S.areaPts.length) {     // polígono em construção + área ao vivo
      const k = S.areaKind || 'floor', col = kindColor(k);
      const aeff = (S.curX != null) ? areaEffective(S.curX, S.curY) : { pt: S.hover, snapped: false };
      let eff = aeff.pt;
      const prev = (eff && S.areaPts.length >= 2) ? S.areaPts.concat([eff]) : S.areaPts;
      if (prev.length >= 3) {                               // preenchimento prévio
        ctx.beginPath(); prev.forEach((p, i) => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath();
        ctx.fillStyle = kindFill(k, '.12'); ctx.fill();
      }
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.setLineDash([6, 4]); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      S.areaPts.forEach((p, i) => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      if (eff) { const hx = eff[0] * S.scale + S.ox, hy = eff[1] * S.scale + S.oy; ctx.lineTo(hx, hy); }
      ctx.stroke(); ctx.setLineDash([]);
      S.areaPts.forEach(p => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
      if (S.mmPerPx && prev.length >= 3) {                  // SF ao vivo no centro
        const sf = polySf(prev), c = polyCentroid(prev), cx = c[0] * S.scale + S.ox, cy = c[1] * S.scale + S.oy;
        const txt = kindName(k) + '  ' + sf.toFixed(1) + ' SF'; ctx.font = '700 13px Inter, sans-serif'; const tw = ctx.measureText(txt).width;
        ctx.fillStyle = kindFill(k, '.95'); ctx.fillRect(cx - tw / 2 - 5, cy - 9, tw + 10, 18);
        ctx.fillStyle = '#fff'; ctx.fillText(txt, cx - tw / 2, cy + 4);
      }
    }
    // ÍMÃ (Snap ligado): anel laranja no vértice que o cursor vai grudar — vale ATÉ antes do 1º ponto
    if (S.areaMode && S.snap && S.curX != null) {
      const v = nearestAreaVertex(S.curX, S.curY);
      if (v) {
        const hx = v[0] * S.scale + S.ox, hy = v[1] * S.scale + S.oy;
        ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fillStyle = '#f59e0b'; ctx.fill();
      }
    }
    if (S.lineMode && S.linePts.length) {                 // traço em construção
      const lay = activeLayerObj(), col = (lay && lay.color) || '#fde047';
      ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.setLineDash([6, 4]); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      S.linePts.forEach((p, i) => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      if (S.hover) { const hx = S.hover[0] * S.scale + S.ox, hy = S.hover[1] * S.scale + S.oy; ctx.lineTo(hx, hy); }
      ctx.stroke(); ctx.setLineDash([]);
      S.linePts.forEach(p => { const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
    }
    if (S.clickA) {
      const px = S.clickA[0] * S.scale + S.ox, py = S.clickA[1] * S.scale + S.oy;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.strokeStyle = '#d9a02a'; ctx.lineWidth = 2; ctx.stroke();
    }
    // prévia ao vivo enquanto mede/calibra — a mira fica no PONTO FINAL (já com snap+ortho)
    if ((S.calibMode || S.measMode) && S.hover) {
      const eff = S.clickA ? applyOrtho(S.clickA, S.hover) : S.hover;   // onde o ponto VAI cair
      const ex = eff[0] * S.scale + S.ox, ey = eff[1] * S.scale + S.oy;
      if (S.clickA) {                            // linha tracejada A→ponto-final + medida
        const ax = S.clickA[0] * S.scale + S.ox, ay = S.clickA[1] * S.scale + S.oy;
        ctx.setLineDash([6, 4]); ctx.strokeStyle = '#d9a02a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        if (S.mmPerPx) {
          const mm = Math.hypot(eff[0] - S.clickA[0], eff[1] - S.clickA[1]) * S.mmPerPx, txt = mmToFtIn(mm);
          ctx.font = '700 13px Inter, sans-serif'; const tw = ctx.measureText(txt).width;
          ctx.fillStyle = 'rgba(217,160,42,.95)'; ctx.fillRect((ax + ex) / 2 - tw / 2 - 4, (ay + ey) / 2 - 18, tw + 8, 18);
          ctx.fillStyle = '#fff'; ctx.fillText(txt, (ax + ex) / 2 - tw / 2, (ay + ey) / 2 - 5);
        }
      }
      // mira no ponto final (sempre): laranja se Snap grudou, ciano se livre
      ctx.strokeStyle = S.snap ? '#f59e0b' : '#d9a02a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ex - 9, ey); ctx.lineTo(ex + 9, ey); ctx.moveTo(ex, ey - 9); ctx.lineTo(ex, ey + 9); ctx.stroke();
      if (S.snap) ctx.strokeRect(ex - 5, ey - 5, 10, 10);
    }
    // realce: marcas do código selecionado na lista (anel + contorno âmbar por cima)
    if (S.highlight) {
      S.marks.forEach(m => {
        if (!m.confirmed || (m.label || '(sem rótulo)') !== S.highlight) return;
        const x = m.x * S.scale + S.ox, y = m.y * S.scale + S.oy, w = m.w * S.scale, h = m.h * S.scale;
        ctx.lineWidth = 4; ctx.strokeStyle = '#f59e0b';
        ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.max(w, h) * 1.1 + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245,158,11,.95)'; ctx.lineWidth = 3; ctx.stroke();
      });
    }
    // laço: VERMELHO tracejado p/ ESQUERDA (apagar) · azul p/ direita (selecionar)
    if (S.marquee) {
      const r = S.marquee, del = S.marqCrossing;
      ctx.fillStyle = del ? 'rgba(239,68,68,.15)' : 'rgba(217,160,42,.12)';
      ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      ctx.strokeStyle = del ? '#ef4444' : '#d9a02a'; ctx.lineWidth = 1.5;
      ctx.setLineDash(del ? [6, 3] : []);
      ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.setLineDash([]);
    }
    if (S.autoRegion) {                        // ÁREA de busca do Auto Count (arraste)
      const a = S.autoRegion;
      ctx.fillStyle = 'rgba(59,130,246,.12)';
      ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.strokeRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0); ctx.setLineDash([]);
    }
    drawLegend();                              // quadro de legenda das marcas (canto livre)
    // CRUZ DE TELA CHEIA (estilo CAD/PlanSwift) — cursor padrão sempre
    if (S.curX != null) {
      const x = Math.round(S.curX) + 0.5, y = Math.round(S.curY) + 0.5, g = 7;
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(17,24,39,.55)';
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(x - g, y); ctx.moveTo(x + g, y); ctx.lineTo(cv.width, y);   // horizontal (folga no centro)
      ctx.moveTo(x, 0); ctx.lineTo(x, y - g); ctx.moveTo(x, y + g); ctx.lineTo(x, cv.height);   // vertical
      ctx.stroke();
      ctx.strokeStyle = '#d9a02a'; ctx.lineWidth = 1.5;                                          // mira central
      ctx.strokeRect(x - 5, y - 5, 10, 10);
    }
  }

  // --- legenda POR FOLHA (posição/escala independentes em cada página) ---
  function legState() { return S.legendByPage[S.page] || null; }
  function legSet(patch) {
    const cur = S.legendByPage[S.page] || { pos: null, scale: 1 };
    S.legendByPage[S.page] = Object.assign(cur, patch);
  }
  function legSave() { try { localStorage.setItem('fenestra_legend2_' + S.slug, JSON.stringify(S.legendByPage)); } catch (e) {} }

  /** TABELA de LEGENDA (Marca · Tipo · Qtd) das marcas confirmadas desta folha,
   *  ordenada por código. Posição/escala são POR FOLHA (arraste/alça). Coords de TELA. */
  function drawLegend() {
    if (!S.legend) return;                     // pode ser desligado
    const counts = {};
    S.marks.forEach(m => { if (m.confirmed) { const k = m.label || ''; counts[k] = (counts[k] || 0) + 1; } });
    const labels = Object.keys(counts).sort((a, b) => (a || '~').localeCompare(b || '~', undefined, { numeric: true }));
    if (!labels.length) return;
    const typeOf = k => { const r = S.sched && S.sched[k]; return (r && r.type) ? (F.typeLabel ? F.typeLabel(r.type) : r.type) : ''; };
    ctx.save();
    const st = legState() || {};
    const z = (S.scale || 1) * (st.scale || 1);   // escala = ZOOM da view × ajuste do usuário (a legenda acompanha o desenho)
    const px = (n) => Math.round(n);
    const fTitle = '700 ' + px(13 * z) + 'px Inter, sans-serif';
    const fHead = '700 ' + px(11 * z) + 'px Inter, sans-serif';
    const fBody = '600 ' + px(12 * z) + 'px Inter, sans-serif';
    const pad = 9 * z, rowH = 19 * z, sw = 13 * z, gap = 7 * z, cgap = 14 * z, titleH = 20 * z, headH = 18 * z;
    const codeTxt = k => (k || F.tr('(sem rótulo)'));
    const qtyTxt = k => '' + counts[k];        // só o número (sem ×)
    // larguras das colunas (cabeçalho + conteúdo)
    ctx.font = fBody;
    let codeW = ctx.measureText(F.tr('Marca')).width;
    let typeW = ctx.measureText(F.tr('Tipo')).width;
    let qtyW = ctx.measureText(F.tr('Qtd')).width;
    labels.forEach(k => {
      codeW = Math.max(codeW, ctx.measureText(codeTxt(k)).width);
      typeW = Math.max(typeW, ctx.measureText(typeOf(k)).width);
      qtyW = Math.max(qtyW, ctx.measureText(qtyTxt(k)).width);
    });
    typeW = Math.min(typeW, 220 * z);          // limita tipos muito longos
    const xSw = pad, xCode = xSw + sw + gap, xType = xCode + codeW + cgap, xQty = xType + typeW + cgap;
    ctx.font = fTitle;
    const titleW = ctx.measureText(F.tr('Legenda')).width;
    const boxW = Math.ceil(Math.max(xQty + qtyW + pad, pad + titleW + pad));
    const boxH = Math.ceil(titleH + headH + labels.length * rowH + pad);
    const sc = S.scale || 1;
    const Mi = 10;                              // margem em px de IMAGEM
    const iw = (S.img && S.img.width) || 0, ih = (S.img && S.img.height) || 0;
    const boxWi = boxW / sc, boxHi = boxH / sc;   // tamanho da caixa em coords de IMAGEM
    // posição ANCORADA ao desenho (coords de IMAGEM). Padrão = canto sup. dir. da folha.
    // POR FOLHA (cada página pode ter a legenda num lugar/tamanho diferente).
    let ip = st.pos ? { x: st.pos.x, y: st.pos.y } : { x: Math.max(0, iw - boxWi - Mi), y: Mi };
    ip.x = Math.max(0, Math.min(Math.max(0, iw - boxWi), ip.x));   // mantém dentro da folha
    ip.y = Math.max(0, Math.min(Math.max(0, ih - boxHi), ip.y));
    const pos = { x: ip.x * sc + S.ox, y: ip.y * sc + S.oy };      // IMAGEM → TELA
    S.legendRect = { x: pos.x, y: pos.y, w: boxW, h: boxH };   // coords de TELA (p/ arrastar/hit)
    // fundo + borda
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(pos.x, pos.y, boxW, boxH);
    ctx.strokeStyle = 'rgba(17,24,39,.5)'; ctx.lineWidth = 1; ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, boxW, boxH);
    // título
    ctx.fillStyle = '#0f172a'; ctx.font = fTitle;
    ctx.fillText(F.tr('Legenda'), pos.x + pad, pos.y + pad + 9 * z);
    // cabeçalho das colunas + linha separadora
    const hy = pos.y + titleH + 11 * z;
    const cCode = pos.x + xCode + codeW / 2;        // centro da coluna Marca
    const rQty = pos.x + xQty + qtyW;               // direita da coluna Qtd
    ctx.font = fHead; ctx.fillStyle = '#475569';
    ctx.textAlign = 'center'; ctx.fillText(F.tr('Marca'), cCode, hy);
    ctx.textAlign = 'left'; ctx.fillText(F.tr('Tipo'), pos.x + xType, hy);
    ctx.textAlign = 'right'; ctx.fillText(F.tr('Qtd'), rQty, hy);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(17,24,39,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pos.x + pad, pos.y + titleH + headH - 1.5); ctx.lineTo(pos.x + boxW - pad, pos.y + titleH + headH - 1.5); ctx.stroke();
    // linhas
    ctx.font = fBody;
    labels.forEach((k, i) => {
      const ry = pos.y + titleH + headH + i * rowH;
      ctx.fillStyle = colorOf(k); ctx.fillRect(pos.x + xSw, ry + 3 * z, sw, sw);
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.strokeRect(pos.x + xSw + 0.5, ry + 3 * z + 0.5, sw, sw);
      ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.fillText(codeTxt(k), cCode, ry + 13 * z);   // Marca centralizada
      ctx.textAlign = 'left'; ctx.fillStyle = '#334155';
      let tt = typeOf(k); while (tt && ctx.measureText(tt).width > typeW) tt = tt.slice(0, -2);   // corta se passar
      ctx.fillText(tt || '—', pos.x + xType, ry + 13 * z);
      ctx.fillStyle = '#0f172a'; ctx.textAlign = 'right'; ctx.fillText(qtyTxt(k), rQty, ry + 13 * z);       // Qtd à direita
      ctx.textAlign = 'left';
    });
    // ALÇA de redimensionar (canto inferior direito)
    const hs = Math.max(10, 13 * z);
    S.legendHandle = { x: pos.x + boxW - hs, y: pos.y + boxH - hs, w: hs, h: hs };
    ctx.strokeStyle = 'rgba(17,24,39,.55)'; ctx.lineWidth = Math.max(1, z);
    for (let d = 3; d <= hs - 2; d += 4) {
      ctx.beginPath();
      ctx.moveTo(pos.x + boxW - 2, pos.y + boxH - 2 - d);
      ctx.lineTo(pos.x + boxW - 2 - d, pos.y + boxH - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function hit(sx, sy) {
    const [ix, iy] = toImg(sx, sy);
    return S.marks.find(m => ix >= m.x && ix <= m.x + m.w && iy >= m.y && iy <= m.y + m.h);
  }

  function curPageCount() { return S.marks.filter(m => m.confirmed).length; }
  function syncPageBadge() {
    const meta = S.pages.find(p => p.page === S.page);
    if (meta) { meta.n_hex = curPageCount(); renderPagesList(); }
  }

  function changed() { S.dirty = true; markSaved(F.tr('Editando…')); syncPageBadge(); renderItems(); renderLayers(); draw(); scheduleSave(); }

  // -------- escala / régua --------
  function mmToFtIn(mm) {
    // pés-polegadas com fração de 1/16" (padrão arquitetônico)
    let sixteenths = Math.round(mm / 25.4 * 16);
    let ft = Math.floor(sixteenths / 192);            // 192 = 12in × 16
    let rem = sixteenths - ft * 192;
    let inch = Math.floor(rem / 16);
    let frac = rem % 16;
    let s = ft + "'-" + inch;
    if (frac > 0) {                                   // reduz a fração (8/16→1/2)
      let num = frac, den = 16;
      while (num % 2 === 0) { num /= 2; den /= 2; }
      s += ' ' + num + '/' + den;
    }
    return s + '"';
  }
  function updateScaleInfo() {
    const txt = S.mmPerPx ? F.tr('1px = {v} mm', { v: S.mmPerPx.toFixed(2) }) : F.tr('não calibrada');
    const el = $('#wsScaleInfo'); if (el) el.textContent = F.tr('Escala: {t}', { t: txt }) + (S.measures.length ? F.tr(' · {n} medida(s)', { n: S.measures.length }) : '');
    if (typeof updateSmartPanel === 'function') updateSmartPanel();
    const st = $('#stScale'); if (st) st.textContent = F.tr('Escala: {t}', { t: txt });
  }
  function updateFooter() {
    const meta = S.pages.find(p => p.page === S.page) || {};
    const sp = $('#stPath'); if (sp) sp.textContent = (meta.sheet ? meta.sheet + ' · ' : '') + (S.slug || '');
  }
  /** snap: gruda no ponto notável mais próximo — centros de marcas, pontos de medida
   *  e, principalmente, a LINHA do desenho (pixel escuro) mais próxima. */
  function snapPt(ix, iy) {
    if (!S.snap) return [ix, iy];
    const tol = 22 / (S.scale || 1);
    // 1) pontos notáveis (marcas + pontas de medida + VÉRTICES de paredes e áreas
    //    desta folha + pontos da área em construção → gruda no ponto já marcado p/ reusar/fechar)
    let best = null, bd = 1e9;
    const cands = [];
    S.marks.forEach(m => cands.push([m.x + m.w / 2, m.y + m.h / 2]));
    S.measures.forEach(ml => { cands.push(ml.a); cands.push(ml.b); });
    (S.lines || []).forEach(l => { if (l.page === S.page && l.path) l.path.forEach(p => cands.push(p)); });
    (S.areas || []).forEach(a => { if (a.page === S.page && a.path) a.path.forEach(p => cands.push(p)); });
    (S.areaPts || []).forEach(p => cands.push(p));
    cands.forEach(c => { const d = Math.hypot(c[0] - ix, c[1] - iy); if (d < bd) { bd = d; best = c; } });
    if (best && bd <= tol) return [best[0], best[1]];
    // 2) linha do desenho: pixel escuro mais próximo dentro de um raio FIXO NA TELA
    //    (≈10px de tela → em coords de imagem some o "pulo" quando há muito zoom)
    if (S.snapData) {
      const r = Math.max(1, Math.round(10 / (S.scale || 1)));
      const px = snapToDark(Math.round(ix), Math.round(iy), r);
      if (px) return px;
    }
    return [ix, iy];
  }
  function snapToDark(cx, cy, r) {
    const d = S.snapData; if (!d) return null;
    const W = d.width, H = d.height, data = d.data;
    let best = null, bd = 1e9;
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
        const i = (y * W + x) * 4;
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 110) {     // pixel escuro = linha
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < bd) { bd = dist; best = [x, y]; }
        }
      }
    }
    return best;
  }
  /** Acha a PONTA de medida (a/b) sob o cursor, p/ arrastar. tol em px de tela. */
  function hitMeasEnd(sx, sy, tol) {
    tol = tol || 12;
    for (const m of S.measures) {
      for (const end of ['a', 'b']) {
        const px = m[end][0] * S.scale + S.ox, py = m[end][1] * S.scale + S.oy;
        if (Math.hypot(px - sx, py - sy) <= tol) return { m: m, end: end };
      }
    }
    return null;
  }
  /** Acha a medida cuja LINHA (ou ponta) está sob o cursor (coords de tela). */
  function hitMeasLine(sx, sy, tol) {
    tol = tol || 8;
    for (const m of S.measures) {
      const ax = m.a[0] * S.scale + S.ox, ay = m.a[1] * S.scale + S.oy;
      const bx = m.b[0] * S.scale + S.ox, by = m.b[1] * S.scale + S.oy;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      let t = ((sx - ax) * dx + (sy - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx, py = ay + t * dy;
      if (Math.hypot(px - sx, py - sy) <= tol) return m;
    }
    return null;
  }
  const _inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  function _segSeg(a, b, c, d, p, q) {        // (a,b)-(c,d) cruza (p[0],p[1])-(q[0],q[1])?
    const o = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    const o1 = o(a, b, c, d, p[0], p[1]), o2 = o(a, b, c, d, q[0], q[1]);
    const o3 = o(p[0], p[1], q[0], q[1], a, b), o4 = o(p[0], p[1], q[0], q[1], c, d);
    return o1 !== o2 && o3 !== o4;
  }
  /** medida dentro do retângulo. crossing=true (laço p/ esquerda) → pega se a linha
   *  TOCA a caixa; crossing=false (p/ direita) → só se TODA a linha está dentro. */
  function measInRect(m, r, crossing) {
    const ax = m.a[0] * S.scale + S.ox, ay = m.a[1] * S.scale + S.oy;
    const bx = m.b[0] * S.scale + S.ox, by = m.b[1] * S.scale + S.oy;
    const inA = _inRect(ax, ay, r), inB = _inRect(bx, by, r);
    if (!crossing) return inA && inB;                       // janela: totalmente dentro
    if (inA || inB) return true;                            // crossing: qualquer ponta dentro
    const c = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];   // ou cruza uma borda
    return _segSeg(ax, ay, bx, by, c[0], c[1]) || _segSeg(ax, ay, bx, by, c[1], c[2]) ||
           _segSeg(ax, ay, bx, by, c[2], c[3]) || _segSeg(ax, ay, bx, by, c[3], c[0]);
  }
  /** marca (caixa) dentro do retângulo. crossing → sobreposição; senão → toda dentro. */
  function markInRect(m, r, crossing) {
    const x0 = m.x * S.scale + S.ox, y0 = m.y * S.scale + S.oy;
    const x1 = (m.x + m.w) * S.scale + S.ox, y1 = (m.y + m.h) * S.scale + S.oy;
    if (!crossing) return x0 >= r.x0 && x1 <= r.x1 && y0 >= r.y0 && y1 <= r.y1;
    return !(x1 < r.x0 || x0 > r.x1 || y1 < r.y0 || y0 > r.y1);   // sobreposição
  }
  function applyOrtho(a, b) {
    if (!S.ortho) return b;
    return (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) ? [b[0], a[1]] : [a[0], b[1]];
  }
  function buildSnapData() {
    try {
      const oc = document.createElement('canvas'); oc.width = S.img.width; oc.height = S.img.height;
      const octx = oc.getContext('2d'); octx.drawImage(S.img, 0, 0);
      S.snapData = octx.getImageData(0, 0, S.img.width, S.img.height);
    } catch (e) { S.snapData = null; }
  }
  // ---- Snap / Ortho (botão E tecla) ----
  function toggleSnap() { S.snap = !S.snap; const b = $('#stSnap'); if (b) { b.classList.toggle('bg-cyan-600', S.snap); b.classList.toggle('text-white', S.snap); } markSaved(S.snap ? F.tr('Snap: ligado') : F.tr('Snap: desligado')); draw(); }
  function toggleOrtho() { S.ortho = !S.ortho; const b = $('#stOrtho'); if (b) { b.classList.toggle('bg-cyan-600', S.ortho); b.classList.toggle('text-white', S.ortho); } markSaved(S.ortho ? F.tr('Ortho: ligado') : F.tr('Ortho: desligado')); draw(); }
  // persiste os traços do Linear DESTA folha (lines-NNN.json no projeto)
  function saveLines() {
    if (S.prov && S.prov.saveLines) { try { S.prov.saveLines(S.page, (S.lines || []).filter(l => l.page === S.page)); } catch (e) {} }
    if (S.pageExp) S.pageExp.add(S.page);    // abre a folha atual na árvore
    renderPagesList();                        // atualiza o resumo por tipo na PÁGINAS (ao vivo)
  }
  // ---- Desfazer (Ctrl+Z) / Copiar (Ctrl+C) / Colar (Ctrl+V) / Salvar (Ctrl+S) ----
  // snapshot UNIFICADO: traços Linear + marcas + medidas
  function pushUndo() {
    if (!S.undoStack) S.undoStack = [];
    S.undoStack.push(JSON.stringify({ lines: S.lines || [], marks: S.marks || [], measures: S.measures || [], areas: S.areas || [] }));
    if (S.undoStack.length > 50) S.undoStack.shift();
  }
  function undo() {
    if (!S.undoStack || !S.undoStack.length) { markSaved(F.tr('Nada para desfazer')); return; }
    let snap; try { snap = JSON.parse(S.undoStack.pop()); } catch (e) { return; }
    S.lines = snap.lines || []; S.marks = snap.marks || []; S.measures = snap.measures || []; S.areas = snap.areas || [];
    if (S.lineSel) S.lineSel.clear(); if (S.areaSel) S.areaSel.clear(); clearSel();
    saveLines(); saveMeasures(); saveAreas(); S.dirty = true; scheduleSave();
    renderItems(); renderPagesList(); updateMeasSel(); updateAreaTot(); draw();
    if (F._renderFramingPanel) F._renderFramingPanel();
    markSaved(F.tr('Desfeito ↶'));
  }
  function copyLines() {
    if (!S.lineSel || !S.lineSel.size) return;
    S.lineClip = [...S.lineSel].map(l => JSON.parse(JSON.stringify(l)));
    markSaved(F.tr('{n} item(ns) copiado(s)', { n: S.lineClip.length }));
  }
  function pasteLines() {
    if (!S.lineClip || !S.lineClip.length) return;
    pushUndo();
    if (S.lineSel) S.lineSel.clear();
    const off = 18;
    S.lineClip.forEach(src => {
      const nl = JSON.parse(JSON.stringify(src));
      nl.path = (nl.path || []).map(pt => [pt[0] + off, pt[1] + off]);
      nl.page = S.page;
      S.lines.push(nl); if (S.lineSel) S.lineSel.add(nl);
    });
    saveLines(); draw(); if (F._renderFramingPanel) F._renderFramingPanel();
    markSaved(F.tr('{n} item(ns) colado(s)', { n: S.lineClip.length }));
  }
  // cola as paredes do clipboard numa FOLHA específica (mesma ou outra) — usado no menu de contexto.
  // retagWt: se informado, as paredes coladas viram esse TIPO.
  function pasteLinesToPage(page, retagWt) {
    if (!S.lineClip || !S.lineClip.length) return;
    pushUndo();
    const off = 18, added = [];
    S.lineClip.forEach(src => { const nl = JSON.parse(JSON.stringify(src)); nl.path = (nl.path || []).map(pt => [pt[0] + off, pt[1] + off]); nl.page = page; if (retagWt) nl.wt = retagWt; S.lines.push(nl); added.push(nl); });
    if (page === S.page) { if (S.lineSel) { S.lineSel.clear(); added.forEach(l => S.lineSel.add(l)); } draw(); }
    if (S.prov && S.prov.saveLines) { try { S.prov.saveLines(page, S.lines.filter(l => l.page === page)); } catch (e) {} }   // salva a folha-alvo
    renderPagesList(); if (F._renderFramingPanel) F._renderFramingPanel();
    markSaved(F.tr('{n} parede(s) coladas na folha {p}', { n: added.length, p: page }));
  }
  // apaga folhas (reusado pelo botão 🗑 e pelo menu de contexto)
  async function doDeletePages(pages) {
    if (!pages || !pages.length) return;
    if (!(S.prov && S.prov.deletePages)) { alert(F.tr('Disponível no app de desktop.')); return; }
    let r; try { r = await S.prov.deletePages(pages); } catch (e) { markSaved(F.tr('Falha ao apagar folhas')); return; }
    if (r && r.error) { markSaved(F.tr('Erro: {e}', { e: r.error })); return; }
    const del = new Set(pages);
    S.pages = (r && r.pages) || S.pages.filter(p => !del.has(p.page));
    S.schedulePages = (r && r.schedule_pages) || S.schedulePages;
    if (S.toDelete) pages.forEach(p => S.toDelete.delete(p));
    if (!S.pages.find(p => p.page === S.page)) { const next = S.pages.find(p => p.n_hex > 0) || S.pages[0]; if (next) loadPage(next.page); else renderPagesList(); }
    else renderPagesList();
    markSaved(F.tr('Folhas apagadas: {n}', { n: pages.length }));
  }
  async function saveAll() {
    try { await flushSave(); } catch (e) {}
    saveLines(); saveMeasures(); saveAreas();
    if (F._saveFraming) F._saveFraming();
    markSaved(F.tr('Salvo ✓'));
  }
  function saveMeasures() {
    if (S.prov.saveMeasures) { try { S.prov.saveMeasures(S.page, S.measures); } catch (e) {} }
  }
  // ----- ÁREA (medição rápida): polígono → SF. Persiste em localStorage (sem backend). -----
  function areaKey(page) { return 'cc_areas_' + (S.slug || 'proj') + '_' + page; }
  function loadAreas(page) { try { return JSON.parse(localStorage.getItem(areaKey(page)) || '[]') || []; } catch (e) { return []; } }
  function saveAreas() {
    // persiste no PROJETO (Python → areas-NNN.json) pra sobreviver ao fechar o app;
    // sempre grava também no localStorage como espelho/fallback (web e clientes antigos)
    if (S.prov && S.prov.saveAreas) { try { S.prov.saveAreas(S.page, (S.areas || []).filter(a => a.page === S.page)); } catch (e) {} }
    try { localStorage.setItem(areaKey(S.page), JSON.stringify(S.areas || [])); } catch (e) {}
  }
  function polyCentroid(path) { let x = 0, y = 0; path.forEach(p => { x += p[0]; y += p[1]; }); return [x / path.length, y / path.length]; }
  // tipo de área: 'floor' (Piso, verde) | 'ceiling' (Teto/Forro, azul)
  function kindColor(k) { return k === 'ceiling' ? '#38bdf8' : '#22c55e'; }
  function kindFill(k, a) { return (k === 'ceiling' ? 'rgba(56,189,248,' : 'rgba(34,197,94,') + a + ')'; }
  function kindText(k) { return k === 'ceiling' ? '#7dd3fc' : '#86efac'; }
  function kindName(k) { return F.tr(k === 'ceiling' ? 'Teto' : 'Piso'); }
  function updateAreaTot() {
    const el = document.getElementById('wsAreaTot'); if (!el) return;
    let f = 0, c = 0;
    (S.areas || []).forEach(a => { if (a.page !== S.page) return; if (a.kind === 'ceiling') c += (a.sf || 0); else f += (a.sf || 0); });
    const parts = [];
    if (f) parts.push('🟩 ' + F.tr('Piso') + ': ' + f.toFixed(1) + ' SF');
    if (c) parts.push('🟦 ' + F.tr('Teto') + ': ' + c.toFixed(1) + ' SF');
    el.textContent = parts.join('   ·   ');
  }
  F._wsUpdateAreaTot = updateAreaTot;
  function polySf(path) {                                  // área do polígono (shoelace) px² → ft²
    if (!S.mmPerPx || !path || path.length < 3) return 0;
    let a2 = 0;
    for (let i = 0; i < path.length; i++) { const p = path[i], q = path[(i + 1) % path.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    return (Math.abs(a2) / 2) * S.mmPerPx * S.mmPerPx / 92903.04;   // 1 ft² = 304.8² mm²
  }
  function areaPkgFor(k) { return k === 'ceiling' ? 'ceiling' : 'floor'; }   // Piso/Teto = pacotes próprios
  function areaScopeOwned(k) { return !F.hasPackage || F.hasPackage(areaPkgFor(k)); }
  // ÍMÃ de ponto: vértice JÁ MARCADO mais próximo do cursor (em px de TELA → atração
  // constante em qualquer zoom). Atrai SEMPRE (não depende do botão Snap).
  function nearestAreaVertex(sx, sy, tolScreen) {
    let best = null, bd = (tolScreen || 14);
    const consider = (p) => { if (!p) return; const x = p[0] * S.scale + S.ox, y = p[1] * S.scale + S.oy; const d = Math.hypot(sx - x, sy - y); if (d <= bd) { bd = d; best = [p[0], p[1]]; } };
    (S.areaPts || []).forEach(consider);
    (S.areas || []).forEach(a => { if (a.page === S.page && a.path) a.path.forEach(consider); });
    (S.lines || []).forEach(l => { if (l.page === S.page && l.path) l.path.forEach(consider); });
    (S.marks || []).forEach(m => consider([m.x + m.w / 2, m.y + m.h / 2]));
    (S.measures || []).forEach(m => { consider(m.a); consider(m.b); });
    return best;
  }
  // ponto efetivo da área: com SNAP ligado, o ímã do vértice vence (ignora ortho);
  // senão snap de imagem + ortho. {pt, snapped}
  function areaEffective(sx, sy) {
    if (S.snap) { const v = nearestAreaVertex(sx, sy); if (v) return { pt: v, snapped: true }; }
    let p = snapPt(...toImg(sx, sy));
    if (S.areaPts && S.areaPts.length) p = applyOrtho(S.areaPts[S.areaPts.length - 1], p);
    return { pt: p, snapped: false };
  }
  function handleArea(sx, sy) {
    if (!S.mmPerPx) { alert(F.tr('Calibre a escala primeiro (📏 Calibrar escala).')); return; }
    const kind = S.areaKind || 'floor';
    if (!areaScopeOwned(kind)) {   // NADA grátis: medir/orçar este ofício exige o pacote
      markSaved('🔒 ' + F.tr('{pkg} é um pacote à parte (US$ 12/mês) — assine na aba Pacote para liberar.', { pkg: kindName(kind) }));
      return;
    }
    if (!S.areaPts) S.areaPts = [];
    S.areaPts.push(areaEffective(sx, sy).pt); draw();
  }
  // ✨ VARINHA DE CÔMODO: 1 clique → a IA/CV preenche até as paredes e cria a área
  async function detectRoomAt(sx, sy) {
    if (!S.mmPerPx) { alert(F.tr('Calibre a escala primeiro (📏 Calibrar escala).')); return; }
    const kind = S.areaKind || 'floor';
    if (!areaScopeOwned(kind)) { markSaved('🔒 ' + F.tr('{pkg} é um pacote à parte (US$ 12/mês) — assine na aba Pacote para liberar.', { pkg: kindName(kind) })); return; }
    if (!(S.prov && S.prov.detectRoom)) { markSaved(F.tr('Detectar cômodo: disponível no app desktop.')); return; }
    const [ix, iy] = toImg(sx, sy);
    markSaved(F.tr('✨ IA detectando o cômodo…'));
    let r; try { r = await S.prov.detectRoom(S.page, Math.round(ix), Math.round(iy)); } catch (e) { markSaved(F.tr('Falha ao detectar o cômodo.')); return; }
    if (!r || r.error || !r.poly || r.poly.length < 3) { markSaved('⚠️ ' + ((r && r.error) || F.tr('Não consegui delimitar o cômodo — desenhe manual.'))); return; }
    pushUndo();
    const path = r.poly.map(p => [p[0], p[1]]);
    const sf = polySf(path);
    if (!S.areas) S.areas = [];
    S.areas.push({ path: path, sf: sf, page: S.page, kind: kind });
    saveAreas(); updateAreaTot();
    if (S.pageExp) S.pageExp.add(S.page); renderPagesList();
    markSaved('✨ ' + kindName(kind) + ' — ' + sf.toFixed(1) + ' SF');
    draw();
  }
  function finishArea() {
    if (!S.areaPts) S.areaPts = [];
    while (S.areaPts.length >= 2) {                       // tira ponto duplicado do duplo-clique
      const a = S.areaPts[S.areaPts.length - 1], b = S.areaPts[S.areaPts.length - 2];
      if (Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1) S.areaPts.pop(); else break;
    }
    if (S.areaPts.length >= 3 && S.mmPerPx) {
      pushUndo();
      const sf = polySf(S.areaPts);
      const kind = S.areaKind || 'floor';
      if (!S.areas) S.areas = [];
      S.areas.push({ path: S.areaPts.slice(), sf: sf, page: S.page, kind: kind });
      saveAreas(); updateAreaTot();
      if (S.pageExp) S.pageExp.add(S.page); renderPagesList();   // levantamento aparece na folha (árvore)
      markSaved(kindName(kind) + ' — ' + sf.toFixed(1) + ' SF');
    }
    S.areaPts = []; draw();
  }
  F._wsAreas = () => (S.areas || []);   // outros pacotes podem ler as áreas medidas
  // acha um VÉRTICE de área sob o cursor (em construção ou já fechada) — p/ apagar ponto errado
  function hitAreaPoint(sx, sy) {
    const tol = 11;
    if (S.areaPts) for (let i = 0; i < S.areaPts.length; i++) {
      const px = S.areaPts[i][0] * S.scale + S.ox, py = S.areaPts[i][1] * S.scale + S.oy;
      if (Math.hypot(sx - px, sy - py) <= tol) return { kind: 'draft', i: i };
    }
    for (const ar of (S.areas || [])) {
      if (ar.page !== S.page || !ar.path) continue;
      for (let i = 0; i < ar.path.length; i++) {
        const px = ar.path[i][0] * S.scale + S.ox, py = ar.path[i][1] * S.scale + S.oy;
        if (Math.hypot(sx - px, sy - py) <= tol) return { kind: 'area', ar: ar, i: i };
      }
    }
    return null;
  }
  // remove o vértice retornado por hitAreaPoint (área fechada recalcula o SF; <3 pontos = apaga a área)
  function removeAreaPoint(hp) {
    if (hp.kind === 'draft') { S.areaPts.splice(hp.i, 1); draw(); markSaved(F.tr('Ponto removido')); return; }
    pushUndo();
    hp.ar.path.splice(hp.i, 1);
    if (hp.ar.path.length < 3) { S.areas = S.areas.filter(a => a !== hp.ar); markSaved(F.tr('Área apagada')); }
    else { hp.ar.sf = polySf(hp.ar.path); markSaved(F.tr('Ponto removido')); }
    saveAreas(); updateAreaTot(); renderPagesList(); draw();
  }
  function selSet() { if (!S.selSet) S.selSet = new Set(); return S.selSet; }
  function selMarks() { if (!S.selMarks) S.selMarks = new Set(); return S.selMarks; }
  function clearSel() { selSet().clear(); selMarks().clear(); }
  function selCount() { return selSet().size + selMarks().size; }
  /** Seleciona uma medida respeitando Ctrl (alterna) / Shift (adiciona) / clique (só ela). */
  function pickMeasure(m, e) {
    const set = selSet();
    if (e && (e.ctrlKey || e.metaKey)) { set.has(m) ? set.delete(m) : set.add(m); }
    else if (e && e.shiftKey) { set.add(m); }
    else { set.clear(); set.add(m); }
    updateMeasSel();
  }
  function updateMeasSel() {
    const n = selCount();
    const b = $('#wsDelMeas'); if (b) { b.disabled = !n; b.textContent = n > 1 ? F.tr('🗑 Apagar {n} selecionadas', { n: n }) : F.tr('🗑 Apagar selecionada'); }
  }
  function deleteSelMeas() {
    const mset = selSet(), kset = selMarks();
    const n = mset.size + kset.size; if (!n) return;
    const hadMarks = kset.size > 0;
    if (mset.size) { S.measures = S.measures.filter(m => !mset.has(m)); saveMeasures(); }
    if (hadMarks) { S.marks = S.marks.filter(m => !kset.has(m)); }
    clearSel();
    if (hadMarks) changed();                 // salva marcas + badge + redraw
    updateScaleInfo(); updateMeasSel(); draw();
    markSaved(n > 1 ? F.tr('{n} apagadas', { n: n }) : F.tr('Apagada'));
  }
  function handleRuler(sx, sy) {
    const [ix, iy] = snapPt(...toImg(sx, sy));
    if (!S.clickA) { S.clickA = [ix, iy]; clearSel(); updateMeasSel(); markSaved(F.tr('Clique no 2º ponto…')); draw(); return; }
    const a = S.clickA;
    const b = applyOrtho(a, [ix, iy]);          // trava horizontal/vertical se Ortho
    S.clickA = null;
    const px = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (px < 2) { draw(); return; }
    if (S.calibMode) {
      const inp = prompt(F.tr('Comprimento REAL desta linha (ex.: 7\'-0", 2336mm, 2.5m):'));
      const mm = inp ? F.parseToMm(inp) : null;
      if (mm && mm > 0) {
        S.mmPerPx = mm / px;
        if (S.prov.setPageScale) { try { S.prov.setPageScale(S.page, S.mmPerPx); } catch (e) {} }
        const meta = S.pages.find(p => p.page === S.page); if (meta) meta.mm_per_px = S.mmPerPx;
        markSaved(F.tr('Escala calibrada: 1px = {v}mm', { v: S.mmPerPx.toFixed(2) }));
      }
    } else {
      if (!S.mmPerPx) { alert(F.tr('Calibre a escala primeiro (📏 Calibrar escala).')); return; }
      const mm = px * S.mmPerPx;
      pushUndo();
      S.measures.push({ a, b, mm });           // ADICIONA mais uma medida
      S.lastMeas = mm;                         // guarda p/ atribuir a uma janela
      updateSelWindow();
      saveMeasures();
      markSaved(F.tr('Medida {n}: {ft} ({mm}mm)', { n: S.measures.length, ft: mmToFtIn(mm), mm: Math.round(mm) }));
    }
    updateScaleInfo(); draw();
  }

  // LINEAR — traço contínuo (núcleo): cada clique = ponto de mudança de direção; Esc/Enter finaliza.
  function handleLine(sx, sy) {
    if (!S.mmPerPx) { alert(F.tr('Calibre a escala primeiro (📏 Calibrar escala).')); return; }
    let p = snapPt(...toImg(sx, sy));
    if (S.linePts.length) p = applyOrtho(S.linePts[S.linePts.length - 1], p);   // trava H/V se Ortho
    S.linePts.push(p); draw();
  }
  function finishLine() {
    while (S.linePts.length >= 2) {                       // remove ponto duplicado no fim (duplo-clique)
      const a = S.linePts[S.linePts.length - 1], b = S.linePts[S.linePts.length - 2];
      if (Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1) S.linePts.pop(); else break;
    }
    if (S.linePts.length >= 2 && S.mmPerPx) {
      pushUndo();
      let px = 0; for (let i = 1; i < S.linePts.length; i++) px += Math.hypot(S.linePts[i][0] - S.linePts[i - 1][0], S.linePts[i][1] - S.linePts[i - 1][1]);
      S.lines.push({ path: S.linePts.slice(), mm: px * S.mmPerPx, layer: S.activeLayer, page: S.page, wt: (F.framing && F.framing.activeWT) || null, height: (F.framingActiveFloorHeight ? F.framingActiveFloorHeight() : 0) || 0, floor: (F.framingActiveFloorName ? F.framingActiveFloorName() : '') });
      markSaved(F.tr('Linear: {ft}', { ft: mmToFtIn(px * S.mmPerPx) }));
      saveLines();
      if (F._renderFramingPanel) F._renderFramingPanel();
    }
    S.linePts = []; draw();
  }
  F._framingLines = () => S.lines;   // o pacote Framing lê os traços daqui
  // folhas que têm paredes traçadas (p/ a planta marcada)
  F._framingPagesWithLines = () => {
    const set = new Set((S.lines || []).filter(l => l.wt).map(l => l.page));
    return [...set].sort((a, b) => a - b).map(pn => { const p = S.pages.find(pp => pp.page === pn) || {}; return { page: pn, sheet: p.sheet || ('Folha ' + pn) }; });
  };
  // renderiza a folha (imagem + paredes coloridas por tipo) num dataURL — p/ embutir no PDF
  F._framingPageRender = async (page) => {
    let data; try { data = await S.prov.getPage(page); } catch (e) { return null; }
    if (!data || !data.image_b64) return null;
    const src = data.image_b64.startsWith('data:') ? data.image_b64 : ('data:image/png;base64,' + data.image_b64);
    const img = new Image();
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = src; });
    if (!img.width) return null;
    const oc = document.createElement('canvas'); oc.width = img.width; oc.height = img.height;
    const c = oc.getContext('2d'); c.drawImage(img, 0, 0);
    const fr = F.framing, lw = Math.max(3, img.width / 700);
    (S.lines || []).forEach(ln => {
      if (ln.page !== page || !ln.wt) return;
      const wt = (fr && fr.wallTypes || []).filter(w => w.id === ln.wt)[0];
      c.strokeStyle = (wt && wt.color) || '#e3b653'; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); (ln.path || []).forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    });
    return { dataUrl: oc.toDataURL('image/jpeg', 0.82), w: img.width, h: img.height };
  };
  F._wsRedraw = () => { try { draw(); } catch (e) {} };   // o painel de Framing pede redraw (cor por tipo)

  // seleção de traços Linear (igual às marcas do Contar): clicar seleciona, Del apaga
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function hitLine(sx, sy) {
    for (const ln of (S.lines || [])) {
      if (ln.page !== S.page || !layerVisible(ln.layer) || !ln.path) continue;
      for (let i = 1; i < ln.path.length; i++) {
        const ax = ln.path[i - 1][0] * S.scale + S.ox, ay = ln.path[i - 1][1] * S.scale + S.oy;
        const bx = ln.path[i][0] * S.scale + S.ox, by = ln.path[i][1] * S.scale + S.oy;
        if (distToSeg(sx, sy, ax, ay, bx, by) <= 6) return ln;
      }
    }
    return null;
  }
  function pickLine(ln, e) {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) S.lineSel.clear();
    if (S.lineSel.has(ln)) S.lineSel.delete(ln); else S.lineSel.add(ln);
    markSaved(F.tr('{n} linha(s) selecionada(s) · Del p/ apagar', { n: S.lineSel.size }));
  }
  // laço de seleção também pega os traços Linear (igual marcas/medidas)
  function ptInRect(x, y, r) { return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; }
  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function segHitsRect(ax, ay, bx, by, r) {
    if (ptInRect(ax, ay, r) || ptInRect(bx, by, r)) return true;
    return segSeg(ax, ay, bx, by, r.x0, r.y0, r.x1, r.y0) || segSeg(ax, ay, bx, by, r.x1, r.y0, r.x1, r.y1)
      || segSeg(ax, ay, bx, by, r.x1, r.y1, r.x0, r.y1) || segSeg(ax, ay, bx, by, r.x0, r.y1, r.x0, r.y0);
  }
  function lineInRect(ln, r, crossing) {
    if (ln.page !== S.page || !layerVisible(ln.layer) || !ln.path) return false;
    const pts = ln.path.map(p => [p[0] * S.scale + S.ox, p[1] * S.scale + S.oy]);
    if (crossing) {                                   // toca o retângulo (arrasto p/ esquerda)
      for (let i = 1; i < pts.length; i++) if (segHitsRect(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r)) return true;
      return false;
    }
    return pts.every(p => ptInRect(p[0], p[1], r));    // totalmente dentro (arrasto p/ direita)
  }
  // ----- seleção/apagar de ÁREAS (igual paredes): clique dentro seleciona, Del apaga -----
  function pointInPoly(px, py, path) {                 // (coords de TELA)
    let inside = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const xi = path[i][0] * S.scale + S.ox, yi = path[i][1] * S.scale + S.oy;
      const xj = path[j][0] * S.scale + S.ox, yj = path[j][1] * S.scale + S.oy;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }
  function hitArea(sx, sy) {
    for (let i = (S.areas || []).length - 1; i >= 0; i--) {   // último desenhado primeiro
      const a = S.areas[i];
      if (a.page !== S.page || !a.path || a.path.length < 3) continue;
      if (pointInPoly(sx, sy, a.path)) return a;
    }
    return null;
  }
  function pickArea(ar, e) {
    if (!S.areaSel) S.areaSel = new Set();
    if (!(e && (e.ctrlKey || e.metaKey || e.shiftKey))) S.areaSel.clear();
    if (S.areaSel.has(ar)) S.areaSel.delete(ar); else S.areaSel.add(ar);
    markSaved(F.tr('{n} área(s) selecionada(s) · Del p/ apagar', { n: S.areaSel.size }));
  }
  function areaInRect(ar, r, crossing) {
    if (ar.page !== S.page || !ar.path) return false;
    const pts = ar.path.map(p => [p[0] * S.scale + S.ox, p[1] * S.scale + S.oy]);
    if (crossing) {                                   // toca o retângulo (arrasto p/ esquerda)
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (segHitsRect(a[0], a[1], b[0], b[1], r)) return true; }
      return false;
    }
    return pts.every(p => ptInRect(p[0], p[1], r));    // totalmente dentro (arrasto p/ direita)
  }
  function deleteSelAreas() {
    if (!S.areaSel || !S.areaSel.size) return 0;
    const n = S.areaSel.size;
    pushUndo();
    S.areas = (S.areas || []).filter(a => !S.areaSel.has(a));
    S.areaSel.clear();
    saveAreas(); updateAreaTot(); renderPagesList(); draw();
    return n;
  }

  // ✨ IA (CV local): detecta as paredes da folha e cria os traços Linear na camada ativa
  async function detectWallsAI() {
    if (!S.prov || !S.prov.detectWalls) { alert(F.tr('Detecção de paredes disponível no app de desktop.')); return; }
    if (S.busy) return;
    if (!S.mmPerPx && !confirm(F.tr('Escala não calibrada — os comprimentos sairão zerados. Detectar mesmo assim?'))) return;
    S.busy = true; markSaved(F.tr('✨ IA: detectando paredes…'));
    let r;
    try { r = await S.prov.detectWalls(S.page); } catch (e) { S.busy = false; markSaved(F.tr('Falha na detecção de paredes')); return; }
    S.busy = false;
    const walls = (r && r.walls) || [];
    if (!walls.length) { markSaved(F.tr('IA: nenhuma parede detectada nesta folha')); return; }
    pushUndo();
    let added = 0;
    walls.forEach(w => {
      const px = Math.hypot(w[2] - w[0], w[3] - w[1]);
      S.lines.push({ path: [[w[0], w[1]], [w[2], w[3]]], mm: S.mmPerPx ? px * S.mmPerPx : 0, layer: S.activeLayer, page: S.page, ai: true, wt: (F.framing && F.framing.activeWT) || null, height: (F.framingActiveFloorHeight ? F.framingActiveFloorHeight() : 0) || 0, floor: (F.framingActiveFloorName ? F.framingActiveFloorName() : '') });
      added++;
    });
    saveLines(); draw(); if (F._renderFramingPanel) F._renderFramingPanel();
    markSaved(F.tr('✨ IA: +{n} paredes na camada ativa — revise: desligue o Linear, clique na linha e Del p/ apagar as erradas', { n: added }));
  }

  // 🧠 IA: lê os TIPOS DE PAREDE desta folha → cria as assemblies.
  // DESKTOP: leitura LOCAL do texto do PDF (sem chave). WEB: Claude na nuvem (read_assembly.php).
  // IA de VISÃO na nuvem lê a folha ATUAL (qualquer formato de wall type detail)
  async function cloudReadWalls() {
    if (!S.img || !(S.img.naturalWidth || S.img.width)) return null;
    const c = document.createElement('canvas');
    c.width = S.img.naturalWidth || S.img.width; c.height = S.img.naturalHeight || S.img.height;
    c.getContext('2d').drawImage(S.img, 0, 0);
    const b64 = c.toDataURL('image/png').split(',')[1];
    const lic = F.licenseInfo ? F.licenseInfo() : { key: '', device: '' };
    const resp = await fetch('api/read_assembly.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: b64, license_key: lic.key, device: lic.device }) });
    return await resp.json();
  }
  async function readWallTypesAI() {
    if (S.busy) return;
    S.busy = true; markSaved(F.tr('🧠 IA: lendo os tipos de parede desta folha…'));
    let r = null;
    try {
      if (S.prov && S.prov.readWallTypesAll) {              // DESKTOP — varre TODAS as folhas (acha a prancha de partições)
        r = await S.prov.readWallTypesAll();
      } else if (S.prov && S.prov.readWallTypes) {
        r = await S.prov.readWallTypes(S.page);
      }
      // cada projeto desenha os tipos de um jeito — parser local não reconheceu →
      // FALLBACK: IA de visão na nuvem lê a folha ABERTA (abra a folha dos wall types)
      if (!r || !(r.walls || []).length) {
        markSaved(F.tr('Formato não reconhecido — lendo com IA de visão (nuvem)…'));
        const r2 = await cloudReadWalls();
        if (r2 && (r2.walls || []).length) {
          r = r2;
          // caso de APRENDIZADO: a visão leu o que o parser local não reconheceu —
          // o resultado vira material p/ novos padrões (learn/ no servidor)
          try {
            fetch('api/learn_walls.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'vision_success', page: S.page, walls: r2.walls.map(w => ({ type_id: w.type_id || '', name: w.name, material: w.material, stud_size: w.stud_size, components: w.components || [] })) }) });
          } catch (e) {}
        }
        else if (r2 && r2.error && !(r && r.walls && r.walls.length)) r = r2;
      }
    } catch (e) { S.busy = false; markSaved(F.tr('Falha na leitura dos tipos de parede')); return; }
    S.busy = false;
    if (r && r.error) { alert(F.tr('IA: ') + r.error); return; }
    const walls = (r && r.walls) || [];
    if (!walls.length) { markSaved(F.tr('IA: nenhum tipo de parede encontrado no projeto')); alert(F.tr('A IA não encontrou nenhuma prancha de tipos de parede (wall type details) neste projeto.')); return; }
    if (F.framingAddWallTypes) F.framingAddWallTypes(walls);
    const n = walls.length;
    populateWallTypeSelect();
    const onSheet = (r && r.sheet) ? (' (' + r.sheet + ')') : '';
    markSaved(F.tr('🧠 IA: {n} tipos lidos' + onSheet + ' — escolha o tipo em FERRAMENTAS e traçe', { n: n }));
    alert(F.tr('A IA leu {n} tipo(s) de parede' + onSheet + '. Escolha o TIPO na caixa de seleção (FERRAMENTAS) e trace — a parede entra nesse tipo, com a cor dele.', { n: n }));
  }

  // ---- caixa de seleção do TIPO de framing ativo (FERRAMENTAS) ----
  function updateWallTypeSwatch() {
    const fr = F.framing, sw = $('#wsWallTypeSwatch'); if (!sw || !fr) return;
    const t = (fr.wallTypes || []).filter(x => x.id === fr.activeWT)[0];
    sw.style.background = (t && t.color) || '#999';
  }
  function populateWallTypeSelect() {
    const sel = $('#wsWallType'); if (!sel) return;
    const fr = F.framing; const types = (fr && fr.wallTypes) || [];
    if (fr && !fr.activeWT && types[0]) fr.activeWT = types[0].id;
    sel.innerHTML = types.map(t => { const warn = (F.framingWallTypeReview && F.framingWallTypeReview(t).length) ? '⚠️ ' : ''; return '<option value="' + t.id + '"' + (fr && t.id === fr.activeWT ? ' selected' : '') + '>' + warn + (t.name || '').replace(/</g, '&lt;') + '</option>'; }).join('');
    updateWallTypeSwatch();
  }
  F._syncWallTypeSelect = populateWallTypeSelect;

  // ---- PISO ativo (define a ALTURA dos traços) ----
  function populateFloorSelect() {
    const sel = $('#wsFloor'); if (!sel) return;
    const fr = F.framing; let floors = (fr && fr.floors) || [];
    if (fr && !floors.length) { fr.floors.push({ id: 'fl1', name: F.tr('Piso 1'), height: 9 }); floors = fr.floors; }   // semente
    if (fr && !fr.activeFloor && floors[0]) fr.activeFloor = floors[0].id;
    sel.innerHTML = floors.map(f => '<option value="' + f.id + '"' + (fr && f.id === fr.activeFloor ? ' selected' : '') + '>' + (f.name || '').replace(/</g, '&lt;') + '</option>').join('');
    populateFloorHeight();
  }
  // altura do piso = SELETOR com as medidas lidas pela IA (A302). Ao trocar o piso, a altura vem automática.
  function populateFloorHeight() {
    const hin = $('#wsFloorH'); if (!hin) return;
    const fr = F.framing; const floors = (fr && fr.floors) || [];
    const af = floors.filter(f => f.id === (fr && fr.activeFloor))[0];
    const cur = af ? Number(af.height) : NaN;
    const ai = (fr && fr._heights) || [];                 // [{raw:"9'-0\"", ft:9.0}, ...]
    const opts = []; const seen = new Set();
    const add = (ft, raw) => { const v = Math.round(Number(ft) * 100) / 100; if (!(v > 0) || seen.has(v)) return; seen.add(v); opts.push({ ft: v, raw: raw || (v + " ft") }); };
    ai.forEach(h => add(h.ft, h.raw));                    // medidas da IA primeiro
    if (cur > 0) add(cur, cur + " ft");                   // garante a altura atual do piso
    if (!opts.length) [8, 9, 10].forEach(v => add(v));    // fallback se a IA ainda não leu
    opts.sort((a, b) => a.ft - b.ft);
    hin.innerHTML = opts.map(o => '<option value="' + o.ft + '"' + (o.ft === cur ? ' selected' : '') + '>' + String(o.raw).replace(/</g, '&lt;') + '</option>').join('')
      + '<option value="__custom">✎ ' + F.tr('outra…') + '</option>';
  }
  F._syncFloorHeight = populateFloorHeight;
  // região do trabalho (lida do carimbo da planta) — usada pela busca de preços da IA
  F._readRegion = function () { return (S.prov && S.prov.readRegion) ? S.prov.readRegion() : Promise.resolve(null); };

  // ESCOPO da obra (Framing / Drywall / Insulation) — definido ANTES do levantamento
  function populateScope() {
    const sc = (F.framing && F.framing.scope) || {};
    [['#wsScopeFraming', 'framing'], ['#wsScopeDrywall', 'drywall'], ['#wsScopeInsul', 'insulation'], ['#wsScopePaint', 'paint'], ['#wsScopeFloor', 'floor'], ['#wsScopeCeiling', 'ceiling']].forEach(([sel, k]) => {
      const b = $(sel); if (!b) return;
      const owned = !F.framingHasScope || F.framingHasScope(k);   // nada grátis: ofício não comprado fica travado
      const on = !!sc[k] && owned;
      b.classList.toggle('bg-amber-600', on); b.classList.toggle('text-white', on); b.classList.toggle('border-amber-500', on);
      b.classList.toggle('bg-steel-700/50', !on); b.classList.toggle('text-steel-400', !on); b.classList.toggle('border-steel-600', !on);
      b.classList.toggle('opacity-50', !owned); b.style.cursor = owned ? '' : 'not-allowed';
      b.title = owned ? '' : F.tr('Ofício não incluído no seu plano — compre para liberar');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  F._syncScope = populateScope;
  F._syncFloorSelect = populateFloorSelect;

  function updateSchedUI() {
    const on = S.schedulePages.indexOf(S.page) >= 0;
    const btn = $('#wsSchedPage');
    if (btn) { btn.classList.toggle('bg-amber-600', on); btn.textContent = on ? F.tr('📐 ✓ Folha de medidas') : F.tr('📐 Usar esta folha p/ medidas'); }
    const info = $('#wsSchedInfo');
    if (info) info.textContent = S.schedulePages.length ? F.tr('Folhas de medidas: {list}', { list: S.schedulePages.join(', ') }) : F.tr('Nenhuma folha de medidas marcada.');
  }

  const autoThresh = () => (parseInt($('#wsThresh') && $('#wsThresh').value, 10) || 80) / 100;

  /** Auto Count: usa a marca/ponto clicado como amostra e acha todas as iguais na folha. */
  async function doAutoCount(sx, sy, sample, region) {
    if (S.busy || !S.prov || !S.prov.autoCount) { if (!S.prov || !S.prov.autoCount) alert(F.tr('Auto Count disponível no app de desktop.')); return; }
    let box, label;
    if (sample) {
      box = { x: sample.x, y: sample.y, w: sample.w, h: sample.h };
      label = sample.label || ($('#wsLabel').value || '').trim().toUpperCase();
    } else {
      const [ix, iy] = toImg(sx, sy); const sz = 26;
      box = { x: Math.round(ix - sz / 2), y: Math.round(iy - sz / 2), w: sz, h: sz };
      label = ($('#wsLabel').value || '').trim().toUpperCase();
    }
    const target = label;            // SÓ conta o código que você clicou
    S.busy = true; markSaved(F.tr('Auto Count…'));
    const fast = !!S.prov.autoCountFind;
    let res;
    try {
      res = fast
        ? await S.prov.autoCountFind(S.page, box.x, box.y, box.w, box.h, autoThresh(), region || null)
        : await S.prov.autoCount(S.page, box.x, box.y, box.w, box.h, autoThresh());
    } catch (e) { S.busy = false; markSaved(F.tr('Falha no Auto Count')); return; }
    const matches = (res && res.matches) || [];
    if (!matches.length) { S.busy = false; markSaved(F.tr('Auto Count: nada encontrado')); return; }

    // Tags de NÚMERO em círculo (①②③) são quase idênticas → o template casa TODAS.
    // Lê o código de cada candidato (OCR) e mantém só os iguais ao que você clicou.
    let labels = matches.map(mt => (mt.label || '').trim().toUpperCase());
    const needRead = S.prov.readCodes && (fast || labels.some(l => !l));
    if (needRead) {
      markSaved(F.tr('Auto Count: lendo {m} possíveis…', { m: matches.length }));
      try {
        const r = await S.prov.readCodes(S.page, matches.map(mt => ({ x: mt.x, y: mt.y, w: mt.w, h: mt.h })));
        if (r && r.labels) labels = r.labels.map(l => (l || '').trim().toUpperCase());
      } catch (e) {}
    }
    S.busy = false;

    let added = 0, skipped = 0;
    const undoLen = (S.undoStack || []).length; pushUndo();   // snapshot ANTES (Auto Count é desfazível)
    matches.forEach((mt, i) => {
      const code = labels[i] || '';
      if (target && code && code !== target) { skipped++; return; }   // não é o que você clicou → ignora
      const lab = target || code || label;
      const cx = mt.x + mt.w / 2, cy = mt.y + mt.h / 2;
      const dup = S.marks.some(m => Math.abs((m.x + m.w / 2) - cx) < mt.w * 0.6 && Math.abs((m.y + m.h / 2) - cy) < mt.h * 0.6);
      if (!dup) { S.marks.push({ x: mt.x, y: mt.y, w: mt.w, h: mt.h, label: lab, confirmed: true, cv: false, auto: true, section: S.activeSection, layer: S.activeLayer }); added++; }
    });
    if (added) { S.dirty = true; scheduleSave(); } else if ((S.undoStack || []).length > undoLen) S.undoStack.pop();   // nada mudou → descarta snapshot
    renderItems(); draw();
    if (target) markSaved(F.tr('Auto Count: +{a} "{t}" · ignoradas {s} de outro código', { a: added, t: target, s: skipped }));
    else markSaved(F.tr('Auto Count: +{a} de {m}', { a: added, m: matches.length }));
  }

  // ----------------------------------------------------------------- persistência
  function markSaved(txt) { const el = $('#wsSaved'); if (el) el.textContent = txt || ''; }
  function scheduleSave() {
    if (S.saveTimer) clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(flushSave, 700);
  }
  async function flushSave() {
    if (S.saveTimer) { clearTimeout(S.saveTimer); S.saveTimer = null; }
    if (!S.dirty || S.page == null) return;
    const payload = S.marks.map(m => ({ x: m.x, y: m.y, w: m.w, h: m.h, label: m.label, confirmed: m.confirmed, cv: m.cv, section: m.section || S.activeSection, layer: m.layer || S.activeLayer }));
    const mult = curMult();
    const meta = S.pages.find(p => p.page === S.page); if (meta) meta.mult = mult;
    S.dirty = false;
    try { await S.prov.saveMarks(S.page, payload, mult); markSaved(F.tr('Salvo ✓')); }
    catch (e) { markSaved(F.tr('Falha ao salvar')); }
  }

  // ----------------------------------------------------------------- ligações (uma vez)
  function setupCollapsibles() {
    document.querySelectorAll('#workspace [data-collapse]').forEach(hdr => {
      if (hdr._wired) return; hdr._wired = true;
      hdr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;     // clicar num botão do cabeçalho não recolhe
        const content = hdr.nextElementSibling;
        if (!content) return;
        const hidden = content.classList.toggle('hidden');
        const chev = hdr.querySelector('.ws-chev'); if (chev) chev.textContent = hidden ? '▶' : '▼';
      });
    });
  }

  // ---------- PAINEL INTELIGENTE (sequência lógica de uso + adaptativo) ----------
  const ACC_ORDER = ['folha', 'escala', 'camadas', 'ferramentas', 'autocount', 'janela', 'medidas'];
  const ACC_STEP = { folha: 1, escala: 2, camadas: 3, ferramentas: 4, autocount: 5, janela: 6, medidas: 7 };
  function accHdr(name) { return document.querySelector('#wsRight [data-acc="' + name + '"]'); }
  function accSet(name, open) {
    const hdr = accHdr(name); if (!hdr) return;
    const body = hdr.nextElementSibling; if (!body) return;
    body.classList.toggle('hidden', !open);
    const chev = hdr.querySelector('.ws-chev'); if (chev) chev.textContent = open ? '▼' : '▶';
  }
  /** abre o painel certo p/ o contexto e recolhe os concorrentes de "trabalho" */
  function smartFocus(name) {
    if (S.smart === false) return;
    accSet(name, true);
    ['janela', 'autocount', 'escala', 'ferramentas'].forEach(n => { if (n !== name) accSet(n, false); });
  }
  /** monta a ordem lógica + nº do passo + badge em cada título (uma vez) */
  function buildSmartPanel() {
    const aside = document.querySelector('#wsRight'); if (!aside || aside._smartBuilt) return;
    aside._smartBuilt = true; if (S.smart === undefined) S.smart = true;
    const ns = document.createElement('div');                  // linha de "próximo passo"
    ns.id = 'wsNextStep';
    ns.className = 'px-3 py-1.5 text-[11px] text-steel-300 bg-steel-900/50 border-b border-steel-700';
    aside.insertBefore(ns, aside.children[1] || null);
    ACC_ORDER.forEach(name => {
      const hdr = accHdr(name); if (!hdr) return;
      const body = hdr.nextElementSibling;
      if (!hdr._smart) {
        hdr._smart = true;
        const titleSpan = hdr.querySelector(':scope > span');
        const chev = hdr.querySelector('.ws-chev');
        const step = document.createElement('span');
        step.className = 'inline-flex items-center justify-center w-4 h-4 rounded-full bg-steel-600 text-steel-200 text-[9px] font-bold mr-1.5 normal-case';
        step.textContent = ACC_STEP[name];
        if (titleSpan) titleSpan.insertBefore(step, titleSpan.firstChild);
        const right = document.createElement('span');
        right.className = 'flex items-center gap-2';
        const bdg = document.createElement('span'); bdg.id = 'wsBadge-' + name; bdg.className = 'text-[10px] normal-case font-normal';
        right.appendChild(bdg); if (chev) right.appendChild(chev);
        hdr.appendChild(right);
      }
      aside.appendChild(hdr); if (body) aside.appendChild(body);
    });
    updateSmartPanel();
  }
  function setBadge(name, text, cls) {
    const el = document.getElementById('wsBadge-' + name); if (!el) return;
    el.textContent = text || '';
    el.className = 'text-[10px] normal-case font-normal ' + (cls || 'text-steel-400');
  }
  function updateSmartPanel() {
    if (!document.getElementById('wsBadge-folha')) return;
    const marks = (S.marks || []).filter(m => m.confirmed);
    const meta = (S.pages || []).find(p => p.page === S.page);
    const sheet = meta && meta.sheet ? meta.sheet : '';
    const pmult = (meta && +meta.mult) || 1;       // pavimentos× desta folha
    const cntTxt = pmult > 1
      ? (marks.length + '×' + pmult + ' pav = ' + (marks.length * pmult))
      : (marks.length + ' marcas');
    setBadge('folha', (sheet ? sheet + ' · ' : '') + cntTxt, 'text-steel-300');
    setBadge('escala', S.mmPerPx ? 'calibrada' : 'não calibrada', S.mmPerPx ? 'text-emerald-400' : 'text-amber-400');
    const lay = (S.layers || []).find(l => l.id === S.activeLayer);
    setBadge('camadas', lay ? lay.name : '', 'text-steel-300');
    setBadge('janela', S.highlight || '—', S.highlight ? 'text-cyan-300' : 'text-steel-500');
    const codes = {}; marks.forEach(m => { if (m.label) codes[m.label] = true; });
    let sem = 0; Object.keys(codes).forEach(c => { const r = S.sched && S.sched[c]; if (!r || (!r.w_mm && !r.h_mm)) sem++; });
    setBadge('medidas', sem ? (sem + ' sem medida') : (Object.keys(codes).length ? 'ok' : ''), sem ? 'text-rose-400' : 'text-emerald-400');
    const ns = document.getElementById('wsNextStep'); if (!ns) return;
    let msg = '';
    if (!marks.length) msg = '👉 Conte ou reconheça as marcas desta folha.';
    else if (sem) msg = '⚠ ' + sem + ' código(s) sem medida — abra 7 · Medidas.';
    else if (!S.mmPerPx) msg = '📐 Dica: calibre a escala p/ áreas corretas.';
    else msg = '✓ Folha completa.';
    ns.textContent = msg;
  }
  F._updateSmartPanel = updateSmartPanel;

  function toolActive() { return S.countMode || S.autoMode || S.delMode || S.calibMode || S.measMode || S.lineMode || S.areaMode; }
  function applyCursor() { if (cv) cv.style.cursor = 'none'; }   // cruz de tela cheia é sempre o cursor
  function syncBarActive() {
    const on = { wsCount: S.countMode, wsAuto: S.autoMode, wsDelete: S.delMode, wsCalib: S.calibMode, wsMeasure: S.measMode, wsLinear: S.lineMode, wsArea: S.areaMode };
    document.querySelectorAll('.wsBarTool').forEach(b => {
      const active = !!on[b.dataset.proxy];
      const del = b.dataset.proxy === 'wsDelete';
      b.classList.toggle('ws-tool-active', active && !del);
      b.classList.toggle('ws-tool-active-del', active && del);
    });
  }

  function panelToggle(side, collapse) {
    const panel = $(side === 'left' ? '#wsLeft' : '#wsRight');
    const bar = $(side === 'left' ? '#wsLeftBar' : '#wsRightBar');
    if (panel) panel.style.display = collapse ? 'none' : '';
    if (bar) bar.style.display = collapse ? 'flex' : 'none';
    setTimeout(() => { resize(); draw(); }, 0);     // canvas ganhou/perdeu espaço
  }

  function bindOnce() {
    if (bound) return; bound = true;
    setupCollapsibles();
    buildSmartPanel();
    const lc = $('#wsLeftCollapse'); if (lc) lc.addEventListener('click', () => panelToggle('left', true));
    const le = $('#wsLeftExpand'); if (le) le.addEventListener('click', () => panelToggle('left', false));
    document.querySelectorAll('.wsLeftIco').forEach(b => b.addEventListener('click', () => panelToggle('left', false)));
    // toolbar de ações do painel Páginas
    const pg = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', fn); };
    pg('#pgRecognize', runRecognition);
    pg('#pgOpenJobs', () => { if (F._openJobs) F._openJobs(); });
    pg('#pgNew', () => { const f = F._newProject || F._runLocalEngine; if (f) f(); });
    pg('#pgRefresh', () => { if (S.page != null) loadPage(S.page); });
    pg('#pgSort', () => { S.pageSort = S.pageSort === 'marks' ? 'page' : 'marks'; renderPagesList(); markSaved(F.tr('Ordenado por {by}', { by: S.pageSort === 'marks' ? F.tr('nº de marcas') : F.tr('nº da folha') })); });
    { const wp = $('#wsPages'); if (wp) wp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const tEl = e.target.closest('[data-wt]');
      if (tEl) { typesMenu(e.clientX, e.clientY, tEl.getAttribute('data-wt'), Number(tEl.getAttribute('data-pageno'))); return; }   // botão direito num TIPO
      const row = e.target.closest('[data-pageno]');
      pagesMenu(e.clientX, e.clientY, row ? Number(row.getAttribute('data-pageno')) : null);   // botão direito numa FOLHA / área
    }); }
    pg('#pgHires', () => { const b = $('#wsHires'); if (b) b.click(); });
    pg('#pgAuto', () => { const b = $('#wsAuto'); if (b) b.click(); });
    pg('#pgDel', () => { const b = $('#wsDelPages'); if (b && !b.classList.contains('hidden')) b.click(); else markSaved(F.tr('Marque folhas com 🗑 na lista primeiro')); });
    pg('#pgFolder', async () => { if (S.prov.openFolder) { try { await S.prov.openFolder(); } catch (e) {} } else alert(F.tr('Disponível no app de desktop.')); });
    pg('#pgRestore', restoreCurrentMarks);
    pg('#pgLegend', () => { S.legend = !S.legend; draw(); markSaved(S.legend ? F.tr('Legenda: ligada') : F.tr('Legenda: oculta')); });
    { const stl = $('#stLegend'); if (stl) stl.addEventListener('click', () => { S.legend = !S.legend; draw(); markSaved(S.legend ? F.tr('Legenda: ligada') : F.tr('Legenda: oculta')); }); }
    { const sf = $('#stFraming'); if (sf) sf.addEventListener('click', async () => {
      if (!F.toggleFramingTakeoff) { alert(F.tr('Takeoff de Framing indisponível.')); return; }
      if (F.framing && !F.framing._heights && S.prov && S.prov.readHeights) {   // lê as alturas (CLG HT) 1x
        try { const r = await S.prov.readHeights(); F.framing._heights = (r && r.heights) || []; } catch (e) { F.framing._heights = []; }
        populateFloorHeight();   // alturas da IA entram no seletor de altura do piso
      }
      F.toggleFramingTakeoff(S.lines, S.layers);
    }); }

    // seções (grupos de takeoff)
    const sec = $('#wsSection'); if (sec) sec.addEventListener('change', async () => {
      S.activeSection = sec.value;
      if (S.prov.setActiveSection) { try { await S.prov.setActiveSection(S.activeSection); } catch (e) {} }
      markSaved(F.tr('Seção ativa: {s}', { s: S.activeSection }));
    });
    pg('#wsSecNew', async () => {
      const name = prompt(F.tr('Nome da nova seção (ex.: Janelas, Portas, Storefront, Pav 3):'));
      if (!name || !name.trim() || !S.prov.addSection) return;
      try { const r = await S.prov.addSection(name.trim()); if (r && r.sections) { S.sections = r.sections; S.activeSection = r.active; renderSections(); markSaved(F.tr('Seção criada: {s}', { s: r.active })); } } catch (e) {}
    });
    pg('#wsSecRename', async () => {
      const cur = S.activeSection; const nn = prompt(F.tr('Novo nome para a seção "{s}":', { s: cur }), cur);
      if (!nn || !nn.trim() || nn.trim() === cur || !S.prov.renameSection) return;
      try { const r = await S.prov.renameSection(cur, nn.trim()); if (r && r.sections) { S.sections = r.sections; S.activeSection = r.active; renderSections(); await loadPage(S.page); markSaved(F.tr('Seção renomeada')); } } catch (e) {}
    });
    pg('#wsSecDel', async () => {
      const cur = S.activeSection;
      if (!confirm(F.tr('Excluir a seção "{s}"? As marcas dela vão para a primeira seção.', { s: cur }))) return;
      if (!S.prov.deleteSection) return;
      try { const r = await S.prov.deleteSection(cur); if (r && r.sections) { S.sections = r.sections; S.activeSection = r.active; renderSections(); await loadPage(S.page); markSaved(F.tr('Seção excluída')); } } catch (e) {}
    });
    // camadas (trades)
    pg('#wsLayerAdd', addLayerUI);

    const rc = $('#wsRightCollapse'); if (rc) rc.addEventListener('click', () => panelToggle('right', true));
    const re = $('#wsRightExpand'); if (re) re.addEventListener('click', () => panelToggle('right', false));
    // ícones de FERRAMENTA na barra recolhida → acionam o botão real (sem expandir)
    document.querySelectorAll('.wsBarTool').forEach(b => b.addEventListener('click', () => {
      const t = document.getElementById(b.dataset.proxy); if (t) t.click();
    }));

    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const [ix, iy] = toImg(e.offsetX, e.offsetY);
      S.scale *= f; S.ox = e.offsetX - ix * S.scale; S.oy = e.offsetY - iy * S.scale; draw();
    }, { passive: false });

    // MOVER (pan) = botão DIREITO do mouse (esquerdo fica p/ marcar/selecionar, estilo PlanSwift)
    cv.addEventListener('contextmenu', (e) => e.preventDefault());   // não abre menu do navegador
    cv.addEventListener('mousedown', (e) => {
      S.lastX = e.offsetX; S.lastY = e.offsetY; S.moved = false;
      // pegar a LEGENDA: alça (canto) = redimensionar; corpo = arrastar (qualquer botão)
      if (S.legend && S.legendRect) {
        const h = S.legendHandle;
        if (h && e.offsetX >= h.x && e.offsetX <= h.x + h.w && e.offsetY >= h.y && e.offsetY <= h.y + h.h) {
          legSet({ pos: { x: (S.legendRect.x - S.ox) / (S.scale || 1), y: (S.legendRect.y - S.oy) / (S.scale || 1) } });   // fixa o canto (coords de IMAGEM)
          S.resizingLegend = { w0: S.legendRect.w, h0: S.legendRect.h, s0: (legState() && legState().scale) || 1 };
          S.lpress = true; e.preventDefault(); return;
        }
        const r = S.legendRect;
        if (e.offsetX >= r.x && e.offsetX <= r.x + r.w && e.offsetY >= r.y && e.offsetY <= r.y + r.h) {
          S.draggingLegend = { dx: e.offsetX - r.x, dy: e.offsetY - r.y }; S.lpress = true; e.preventDefault(); return;
        }
      }
      if (e.button === 2) { S.panning = true; }                                  // direito = mover (cursor segue cruz)
      else if (e.button === 0) {
        S.lpress = true;
        if (S.autoMode) {                              // arraste = ÁREA de busca do Auto Count
          S.autoDragStart = [e.offsetX, e.offsetY];
          S.autoSample = hit(e.offsetX, e.offsetY);    // marca-amostra sob o início do arraste
          S.autoRegion = null;
        }
        // pode selecionar/arrastar/laço fora dos modos de clique (Medir ou neutro)
        const canSelect = !S.countMode && !S.autoMode && !S.delMode && !S.calibMode && !S.lineMode && !S.areaMode && !S.clickA;
        if (canSelect) {
          S.dragMeas = hitMeasEnd(e.offsetX, e.offsetY);   // pegar ponta de medida p/ arrastar
          if (S.dragMeas) cv.style.cursor = 'move';
          else {                                            // senão, laço de seleção
            S.maybeMarquee = true; S.marqStart = [e.offsetX, e.offsetY]; S.marquee = null;
            S.marqMods = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
          }
        }
      }
    });
    cv.addEventListener('mousemove', (e) => {
      const [mix, miy] = toImg(e.offsetX, e.offsetY);
      S.curX = e.offsetX; S.curY = e.offsetY;        // p/ a cruz de tela cheia
      const stc = $('#stCoord'); if (stc) stc.textContent = 'x: ' + Math.round(mix) + '  y: ' + Math.round(miy);
      if (S.resizingLegend) {                        // redimensionando a legenda (alça) — desta folha
        const r = S.resizingLegend;
        const ratio = Math.max((e.offsetX - (S.legendRect.x)) / Math.max(20, r.w0), (e.offsetY - (S.legendRect.y)) / Math.max(20, r.h0));
        legSet({ scale: Math.max(0.6, Math.min(3, r.s0 * (ratio > 0 ? ratio : 1))) });
        S.moved = true; draw(); return;
      }
      if (S.draggingLegend) {                        // arrastando a legenda — desta folha (coords de IMAGEM)
        const sx = e.offsetX - S.draggingLegend.dx, sy = e.offsetY - S.draggingLegend.dy;
        legSet({ pos: { x: (sx - S.ox) / (S.scale || 1), y: (sy - S.oy) / (S.scale || 1) } });
        S.moved = true; draw(); return;
      }
      const toolMode = S.countMode || S.autoMode || S.delMode || S.calibMode || S.measMode;
      if (S.dragMeas) {                       // arrastando uma ponta de medida
        const [ix, iy] = snapPt(mix, miy);
        S.dragMeas.m[S.dragMeas.end] = [ix, iy];
        const mm = Math.hypot(S.dragMeas.m.b[0] - S.dragMeas.m.a[0], S.dragMeas.m.b[1] - S.dragMeas.m.a[1]) * (S.mmPerPx || 0);
        if (S.mmPerPx) S.dragMeas.m.mm = mm;
        S.moved = true; draw(); return;
      }
      if (S.autoDragStart) {                   // desenhando a ÁREA de busca do Auto Count
        const adx = e.offsetX - S.autoDragStart[0], ady = e.offsetY - S.autoDragStart[1];
        if (Math.abs(adx) + Math.abs(ady) > 3) {
          S.moved = true;
          S.autoRegion = { x0: Math.min(S.autoDragStart[0], e.offsetX), y0: Math.min(S.autoDragStart[1], e.offsetY), x1: Math.max(S.autoDragStart[0], e.offsetX), y1: Math.max(S.autoDragStart[1], e.offsetY) };
          draw();
        }
        return;
      }
      if (S.maybeMarquee) {                    // laço de seleção (arraste esquerdo no modo Medir)
        const dx0 = e.offsetX - S.marqStart[0], dy0 = e.offsetY - S.marqStart[1];
        if (Math.abs(dx0) + Math.abs(dy0) > 3) {
          S.moved = true;
          S.marqCrossing = e.offsetX < S.marqStart[0];      // arrasto p/ ESQUERDA = seleção por toque
          S.marquee = { x0: Math.min(S.marqStart[0], e.offsetX), y0: Math.min(S.marqStart[1], e.offsetY), x1: Math.max(S.marqStart[0], e.offsetX), y1: Math.max(S.marqStart[1], e.offsetY) };
          draw();
        }
        return;
      }
      if (S.panning) {                        // PAN só com o botão DIREITO
        const dx = e.offsetX - S.lastX, dy = e.offsetY - S.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) S.moved = true;
        S.ox += dx; S.oy += dy; S.lastX = e.offsetX; S.lastY = e.offsetY;
      }
      if (S.calibMode || S.measMode || S.lineMode || S.areaMode) S.hover = snapPt(mix, miy);   // prévia da régua/linear/área
      draw();                                 // SEMPRE redesenha → cruz acompanha o cursor
    });
    const endPan = () => { S.panning = false; applyCursor(); };
    cv.addEventListener('mouseleave', () => { endPan(); S.curX = null; S.curY = null; S.maybeMarquee = false; S.marquee = null; draw(); });
    cv.addEventListener('mouseup', (e) => {
      if (S.resizingLegend) {                         // soltou a alça → salva (por folha)
        S.resizingLegend = null; legSave();
        markSaved(F.tr('Legenda redimensionada')); draw(); return;
      }
      if (S.draggingLegend) {                         // soltou a legenda → salva a posição (por folha)
        S.draggingLegend = null; legSave();
        markSaved(F.tr('Legenda movida')); draw(); return;
      }
      if (e.button === 2) {                          // soltou o direito
        if (S.areaMode && !S.moved) {                // botão direito SEM arrastar em cima de um ponto = apaga o ponto
          const hp = hitAreaPoint(e.offsetX, e.offsetY);
          if (hp) { removeAreaPoint(hp); endPan(); return; }
        }
        endPan(); return;                            // senão → fim do pan
      }
      if (e.button !== 0) return;
      S.lpress = false;
      if (S.dragMeas) {
        if (S.moved) { saveMeasures(); updateScaleInfo(); markSaved(F.tr('Medida movida')); }
        else { pickMeasure(S.dragMeas.m, e); markSaved(F.tr('{n} selecionada(s) · Del p/ apagar', { n: selSet().size })); }   // clique = selecionar
        S.dragMeas = null; applyCursor(); draw(); return;
      }
      if (S.maybeMarquee && S.marquee) {              // soltou o laço
        const crossing = S.marqCrossing;             // p/ esquerda = APAGAR; p/ direita = selecionar
        const set = selSet(), mset = selMarks();
        if (crossing || !(S.marqMods && (S.marqMods.ctrl || S.marqMods.shift))) { set.clear(); mset.clear(); S.lineSel.clear(); if (S.areaSel) S.areaSel.clear(); }
        S.measures.forEach(m => { if (measInRect(m, S.marquee, crossing)) set.add(m); });
        S.marks.forEach(m => { if (markInRect(m, S.marquee, crossing)) mset.add(m); });
        (S.lines || []).forEach(ln => { if (lineInRect(ln, S.marquee, crossing)) S.lineSel.add(ln); });   // traços Linear
        (S.areas || []).forEach(ar => { if (areaInRect(ar, S.marquee, crossing)) { if (!S.areaSel) S.areaSel = new Set(); S.areaSel.add(ar); } });   // áreas
        S.maybeMarquee = false; S.marquee = null;
        if (crossing) {                              // ARRASTE P/ ESQUERDA = apagar tudo que tocou
          pushUndo();
          const nL = S.lineSel.size;
          if (nL) { S.lines = S.lines.filter(l => !S.lineSel.has(l)); S.lineSel.clear(); saveLines(); }
          const nA = (S.areaSel && S.areaSel.size) || 0;
          if (nA) { S.areas = S.areas.filter(a => !S.areaSel.has(a)); S.areaSel.clear(); saveAreas(); updateAreaTot(); renderPagesList(); }
          const n = selCount();
          if (n) { deleteSelMeas(); }
          const tot = n + nL + nA;
          if (tot) markSaved(F.tr('🗑 Apagadas {n} (laço ←)', { n: tot })); else draw();
        } else {                                     // p/ direita = apenas selecionar
          updateMeasSel(); draw(); markSaved(F.tr('{n} selecionada(s) · Del p/ apagar', { n: selCount() + S.lineSel.size + ((S.areaSel && S.areaSel.size) || 0) }));
        }
        return;
      }
      S.maybeMarquee = false; S.marquee = null;
      if (S.autoDragStart) {                          // soltou o arraste do Auto Count
        const start = S.autoDragStart, reg = S.autoRegion, sample = S.autoSample;
        S.autoDragStart = null; S.autoRegion = null; S.autoSample = null;
        if (reg) {                                    // arrastou uma CAIXA → conta só dentro dela
          const [ix0, iy0] = toImg(reg.x0, reg.y0), [ix1, iy1] = toImg(reg.x1, reg.y1);
          const region = { x: Math.round(Math.min(ix0, ix1)), y: Math.round(Math.min(iy0, iy1)), w: Math.round(Math.abs(ix1 - ix0)), h: Math.round(Math.abs(iy1 - iy0)) };
          doAutoCount(start[0], start[1], sample, region);
          draw(); return;
        }
        // sem arraste (só clique) → segue o fluxo normal (folha toda) abaixo
      }
      if (S.moved) return;                            // foi arraste, não clique
      if (!S.countMode && !S.autoMode && !S.delMode && !S.calibMode && !S.lineMode && !S.areaMode && !S.clickA) {  // clicar numa medida/linha = selecionar (Ctrl/Shift = múltiplas)
        const hm = hitMeasLine(e.offsetX, e.offsetY);
        if (hm) { pickMeasure(hm, e); markSaved(F.tr('{n} medida(s) selecionada(s) · Del p/ apagar', { n: selSet().size })); draw(); return; }
        const hl = hitLine(e.offsetX, e.offsetY);
        if (hl) { pickLine(hl, e); draw(); return; }
        const ha = hitArea(e.offsetX, e.offsetY);
        if (ha) { pickArea(ha, e); draw(); return; }
      }
      if (S.areaMode) { if (S.areaAI) detectRoomAt(e.offsetX, e.offsetY); else handleArea(e.offsetX, e.offsetY); return; }
      if (S.lineMode) { handleLine(e.offsetX, e.offsetY); return; }
      if (S.calibMode || S.measMode) { handleRuler(e.offsetX, e.offsetY); return; }
      const m = hit(e.offsetX, e.offsetY);
      if (S.delMode) { if (m) { pushUndo(); S.marks.splice(S.marks.indexOf(m), 1); changed(); } return; }
      if (S.autoMode) { doAutoCount(e.offsetX, e.offsetY, m); return; }
      if (S.countMode) {
        pushUndo();
        if (m) { m.confirmed = !m.confirmed; }
        else {
          const [ix, iy] = toImg(e.offsetX, e.offsetY); const sz = 24;
          S.marks.push({ x: ix - sz / 2, y: iy - sz / 2, w: sz, h: sz, label: ($('#wsLabel').value || '').trim().toUpperCase(), confirmed: true, cv: false, section: S.activeSection, layer: S.activeLayer });
        }
        changed();
      } else if (m) { m.confirmed = !m.confirmed; changed(); }
    });
    cv.addEventListener('dblclick', (e) => {
      if (S.areaMode) { e.preventDefault(); finishArea(); return; }   // duplo-clique fecha a Área
      if (S.lineMode) { e.preventDefault(); finishLine(); return; }   // duplo-clique finaliza o Linear
      if (S.legend && S.legendRect) {                 // duplo-clique na legenda = volta ao canto automático
        const r = S.legendRect;
        if (e.offsetX >= r.x && e.offsetX <= r.x + r.w && e.offsetY >= r.y && e.offsetY <= r.y + r.h) {
          delete S.legendByPage[S.page]; legSave();   // reseta SÓ esta folha
          markSaved(F.tr('Legenda: posição automática')); draw(); return;
        }
      }
      const m = hit(e.offsetX, e.offsetY);
      if (m) { const v = prompt(F.tr('Rótulo da marca:'), m.label); if (v !== null) { m.label = v.trim().toUpperCase(); m.confirmed = true; changed(); } }
    });

    function setMode(which) {
      S.countMode = which === 'count' && !S.countMode;
      S.autoMode = which === 'auto' && !S.autoMode;
      S.delMode = which === 'del' && !S.delMode;
      S.calibMode = which === 'calib' && !S.calibMode;
      S.measMode = which === 'measure' && !S.measMode;
      S.lineMode = which === 'linear' && !S.lineMode;
      S.areaMode = which === 'area' && !S.areaMode;
      if (which !== 'linear') S.linePts = [];
      if (which !== 'area') { S.areaPts = []; S.areaAI = false; const wai = $('#wsAreaAI'); if (wai) { wai.classList.remove('ring-2', 'ring-emerald-300'); } }
      if (S.lineSel) S.lineSel.clear();
      if (S.areaSel) S.areaSel.clear();
      S.clickA = null; S.hover = null; S.maybeMarquee = false; S.marquee = null;
      S.autoDragStart = null; S.autoRegion = null; S.autoSample = null;
      const act = (id, on) => { const b = $(id); if (b) b.classList.toggle('ws-tool-active', on); };
      act('#wsCount', S.countMode);
      act('#wsAuto', S.autoMode);
      act('#wsCalib', S.calibMode);
      act('#wsMeasure', S.measMode);
      act('#wsLinear', S.lineMode);
      act('#wsArea', S.areaMode);
      const wd = $('#wsDelete'); if (wd) wd.classList.toggle('ws-tool-active-del', S.delMode);
      applyCursor(); syncBarActive();
      if (ruler && S.measMode && !S.mmPerPx) markSaved(F.tr('Calibre a escala primeiro (📏).'));
      // painel inteligente: abre o painel do modo ativo
      if (S.autoMode) smartFocus('autocount');
      else if (S.calibMode || S.measMode) smartFocus('escala');
      else if (S.countMode || S.delMode) smartFocus('ferramentas');
      if (typeof updateSmartPanel === 'function') updateSmartPanel();
      draw();
    }
    $('#wsCount').addEventListener('click', () => setMode('count'));
    { const wl = $('#wsLinear'); if (wl) wl.addEventListener('click', () => setMode('linear')); }
    { const dwb = $('#wsDetectWalls'); if (dwb) dwb.addEventListener('click', detectWallsAI); }
    { const rwb = $('#wsReadWalls'); if (rwb) rwb.addEventListener('click', readWallTypesAI); }
    { const wts = $('#wsWallType'); if (wts) wts.addEventListener('change', () => {
      if (F.framing) F.framing.activeWT = wts.value; updateWallTypeSwatch();
      if (S.lineSel && S.lineSel.size) {                 // há traços selecionados → ATRIBUI o tipo a eles
        pushUndo();
        S.lineSel.forEach(l => { l.wt = wts.value; });
        saveLines(); markSaved(F.tr('{n} linha(s) → tipo aplicado', { n: S.lineSel.size }));
      }
      if (F._renderFramingPanel) F._renderFramingPanel(); draw(); if (F._saveFraming) F._saveFraming();
    }); populateWallTypeSelect(); }
    [['#wsScopeFraming', 'framing'], ['#wsScopeDrywall', 'drywall'], ['#wsScopeInsul', 'insulation'], ['#wsScopePaint', 'paint'], ['#wsScopeFloor', 'floor'], ['#wsScopeCeiling', 'ceiling']].forEach(([sel, k]) => { const b = $(sel); if (b) b.addEventListener('click', () => { if (F.framingToggleScope) F.framingToggleScope(k); populateScope(); if (F._renderFramingPanel) F._renderFramingPanel(); }); }); populateScope();
    { const fsel = $('#wsFloor'); if (fsel) fsel.addEventListener('change', () => { if (F.framingSetFloor) F.framingSetFloor(fsel.value); populateFloorSelect(); }); populateFloorSelect(); }
    { const fh = $('#wsFloorH'); if (fh) fh.addEventListener('change', () => {
      let v = fh.value;
      if (v === '__custom') { const r = prompt(F.tr('Altura do piso em pés (ex.: 9.1, 10):'), ''); if (r === null) { populateFloorHeight(); return; } v = parseFloat(r); if (!(v > 0)) { populateFloorHeight(); return; } }
      if (F.framing && F.framingUpdateFloor) F.framingUpdateFloor(F.framing.activeFloor, { height: parseFloat(v) });
      populateFloorHeight();
      if (F._renderFramingPanel) F._renderFramingPanel();
    }); }
    { const fa = $('#wsFloorAdd'); if (fa) fa.addEventListener('click', () => { const nm = prompt(F.tr('Nome do piso (ex.: 2nd Floor):'), ''); if (nm === null) return; const h = prompt(F.tr('Altura do piso em pés (ex.: 9.1, 10):'), '9'); if (h === null) return; if (F.framingAddFloor) F.framingAddFloor((nm || '').trim(), parseFloat(h)); populateFloorSelect(); }); }
    { const af2 = $('#wsApplyFloor'); if (af2) af2.addEventListener('click', () => {
      if (!S.lineSel || !S.lineSel.size) { markSaved(F.tr('Selecione paredes na planta primeiro')); return; }
      const h = F.framingActiveFloorHeight ? F.framingActiveFloorHeight() : 0;
      const fn = F.framingActiveFloorName ? F.framingActiveFloorName() : '';
      pushUndo(); S.lineSel.forEach(l => { l.height = h; l.floor = fn; });
      saveLines(); draw(); if (F._renderFramingPanel) F._renderFramingPanel();
      markSaved(F.tr('{n} linha(s) → piso/altura aplicado', { n: S.lineSel.size }));
    }); }
    { const apt = $('#wsApplyType'); if (apt) apt.addEventListener('click', () => {
      if (!S.lineSel || !S.lineSel.size) { markSaved(F.tr('Selecione uma ou mais paredes na planta primeiro')); return; }
      const wid = (F.framing && F.framing.activeWT) || null;
      if (!wid) { markSaved(F.tr('Escolha um tipo na caixa Tipo: primeiro')); return; }
      pushUndo();
      S.lineSel.forEach(l => { l.wt = wid; });
      saveLines(); draw(); if (F._renderFramingPanel) F._renderFramingPanel();
      markSaved(F.tr('{n} linha(s) → tipo aplicado', { n: S.lineSel.size }));
    }); }
    $('#wsAuto').addEventListener('click', () => setMode('auto'));
    $('#wsDelete').addEventListener('click', () => setMode('del'));
    const wcal = $('#wsCalib'); if (wcal) wcal.addEventListener('click', () => setMode('calib'));
    const wmea = $('#wsMeasure'); if (wmea) wmea.addEventListener('click', () => setMode('measure'));
    const ware = $('#wsArea'); if (ware) ware.addEventListener('click', () => { if (!S.mmPerPx) markSaved(F.tr('Calibre a escala primeiro (📏).')); setMode('area'); });
    { const wak = $('#wsAreaKind'); if (wak) { S.areaKind = wak.value || 'floor'; wak.addEventListener('change', () => { S.areaKind = wak.value || 'floor'; if (!areaScopeOwned(S.areaKind)) markSaved('🔒 ' + F.tr('{pkg} é um pacote à parte (US$ 12/mês) — assine na aba Pacote para liberar.', { pkg: kindName(S.areaKind) })); draw(); }); } }
    { const wai = $('#wsAreaAI'); if (wai) wai.addEventListener('click', () => {
      S.areaAI = !S.areaAI; S.areaPts = [];                    // alterna a varinha; limpa polígono manual em andamento
      if (S.areaAI && !S.areaMode) setMode('area');            // liga o modo Área junto
      wai.classList.toggle('ring-2', S.areaAI); wai.classList.toggle('ring-emerald-300', S.areaAI);
      markSaved(S.areaAI ? F.tr('✨ Varinha de cômodo: clique dentro do quarto') : F.tr('Varinha de cômodo: desligada'));
      draw();
    }); }
    const wdm = $('#wsDelMeas'); if (wdm) wdm.addEventListener('click', deleteSelMeas);
    const wcm = $('#wsClearMeas'); if (wcm) wcm.addEventListener('click', () => {
      if (!S.measures.length) { markSaved(F.tr('Sem medidas')); return; }
      S.measures = []; clearSel(); saveMeasures(); updateScaleInfo(); updateMeasSel(); draw(); markSaved(F.tr('Medidas limpas'));
    });
    const dwm = $('#wsDimWmeas'); if (dwm) dwm.addEventListener('click', () => { if (S.lastMeas) $('#wsDimW').value = mmToFtIn(S.lastMeas); else markSaved(F.tr('Meça algo no desenho primeiro')); });
    const dhm = $('#wsDimHmeas'); if (dhm) dhm.addEventListener('click', () => { if (S.lastMeas) $('#wsDimH').value = mmToFtIn(S.lastMeas); else markSaved(F.tr('Meça algo no desenho primeiro')); });
    const dsv = $('#wsDimSave'); if (dsv) dsv.addEventListener('click', async () => {
      if (!S.highlight) return;
      const wmm = F.parseToMm($('#wsDimW').value), hmm = F.parseToMm($('#wsDimH').value);
      const wtype = ($('#wsDimType') && $('#wsDimType').value) || null;
      if (!wmm && !hmm && !wtype) { markSaved(F.tr('Informe medida ou tipo')); return; }
      if (!S.prov.setWindowDim) { alert(F.tr('Disponível no app de desktop.')); return; }
      let r; try { r = await S.prov.setWindowDim(S.highlight, wmm || null, hmm || null, wtype, null); } catch (e) { markSaved(F.tr('Falha ao salvar')); return; }
      if (r && r.rec) { S.sched = S.sched || {}; S.sched[S.highlight] = Object.assign({}, S.sched[S.highlight], r.rec); }
      renderItems(); updateSelWindow();
      markSaved(F.tr('Medida salva para {c}', { c: S.highlight }));
    });
    const stsn = $('#stSnap'); if (stsn) stsn.addEventListener('click', toggleSnap);
    const stor = $('#stOrtho'); if (stor) stor.addEventListener('click', toggleOrtho);
    const wds = $('#wsDelSel'); if (wds) wds.addEventListener('click', () => {
      if (!S.highlight) { alert(F.tr('Primeiro clique num código na lista "Marcas desta folha" para selecioná-lo.')); return; }
      const lab = S.highlight;
      const before = S.marks.length;
      S.marks = S.marks.filter(m => (m.label || '(sem rótulo)') !== lab);
      const removed = before - S.marks.length;
      S.highlight = null;
      if (removed) { changed(); markSaved(F.tr('Apagadas {n} marcas "{lab}"', { n: removed, lab: lab })); }
      else markSaved(F.tr('Nada para apagar'));
    });
    const wdp = $('#wsDelPages'); if (wdp) wdp.addEventListener('click', async () => {
      const pages = [...(S.toDelete || [])];
      if (!pages.length) return;
      if (!S.prov.deletePages) { alert(F.tr('Disponível no app de desktop.')); return; }
      if (!confirm(F.tr('Apagar {n} folha(s) marcada(s)? Isso remove as imagens e marcas dessas folhas (libera espaço).', { n: pages.length }))) return;
      await doDeletePages(pages);
    });
    const wsp = $('#wsSchedPage'); if (wsp) wsp.addEventListener('click', async () => {
      if (S.page == null || !S.prov.setSchedulePage) { alert(F.tr('Disponível no app de desktop.')); return; }
      const on = S.schedulePages.indexOf(S.page) < 0;     // alterna
      try { const r = await S.prov.setSchedulePage(S.page, on); if (r && r.schedule_pages) S.schedulePages = r.schedule_pages; } catch (e) {}
      renderPagesList(); updateSchedUI();
      markSaved(on ? F.tr('Folha {p} marcada p/ medidas', { p: S.page }) : F.tr('Folha {p} desmarcada', { p: S.page }));
    });
    const wrs = $('#wsReadSched'); if (wrs) wrs.addEventListener('click', async () => {
      if (!S.schedulePages.length) { alert(F.tr('Marque ao menos uma folha como medidas (botão 📐) antes de reler.')); return; }
      if (!S.prov.rereadSchedule) { alert(F.tr('Disponível no app de desktop.')); return; }
      markSaved(F.tr('Relendo medidas das folhas {list}…', { list: S.schedulePages.join(', ') }));
      let r; try { r = await S.prov.rereadSchedule(); } catch (e) { markSaved(F.tr('Falha ao reler medidas')); return; }
      if (r && r.error) { markSaved(F.tr('Erro: {e}', { e: r.error })); return; }
      if (r && r.schedule) { S.sched = r.schedule; renderItems(); }   // atualiza a info por janela
      markSaved(F.tr('Medidas atualizadas: {n} códigos lidos', { n: (r && r.n) || 0 }));
    });
    const wcr = $('#wsClearRej'); if (wcr) wcr.addEventListener('click', () => {
      const before = S.marks.length;
      S.marks = S.marks.filter(m => m.confirmed);
      const removed = before - S.marks.length;
      if (removed) { changed(); markSaved(F.tr('Removidas {n} rejeitadas', { n: removed })); }
      else markSaved(F.tr('Nenhuma rejeitada'));
    });
    const wt = $('#wsThresh'); if (wt) wt.addEventListener('input', () => {
      const el = $('#wsThreshVal'); if (el) el.textContent = (parseInt(wt.value, 10) / 100).toFixed(2);
    });
    const wh = $('#wsHires'); if (wh) wh.addEventListener('click', async () => {
      if (!S.prov.upscalePage) { alert(F.tr('Disponível no app de desktop.')); return; }
      const pg = S.page; markSaved(F.tr('Gerando alta resolução…'));
      let r; try { r = await S.prov.upscalePage(pg, 4500); } catch (e) { markSaved(F.tr('Falha na alta resolução')); return; }
      if (r && r.error) { markSaved(F.tr('Erro: {e}', { e: r.error })); return; }
      const meta = S.pages.find(p => p.page === pg);          // atualiza meta (tamanho/escala reescalados)
      if (meta && r) { meta.w = r.w; meta.h = r.h; meta.mm_per_px = r.mm_per_px; }
      await loadPage(pg);                                       // recarrega imagem nítida + marcas reescaladas
      markSaved(F.tr('Folha em alta resolução ✓'));
    });
    $('#wsMult').addEventListener('input', () => { S.dirty = true; renderItems(); scheduleSave(); });
    $('#wsZoomIn').addEventListener('click', () => { S.scale *= 1.2; draw(); });
    $('#wsZoomOut').addEventListener('click', () => { S.scale /= 1.2; draw(); });
    $('#wsFit').addEventListener('click', () => { fit(); draw(); });
    $('#wsClose').addEventListener('click', async () => { await flushSave(); $('#workspace').classList.add('hidden'); });
    { const sb = $('#wsSummaryBtn'); if (sb) sb.addEventListener('click', F._toggleSummary); const sc = $('#wsSummaryClose'); if (sc) sc.addEventListener('click', () => { const p = $('#wsSummary'); if (p) p.classList.add('hidden'); }); }
    const scopeBtn = $('#wsScopeBtn');
    if (scopeBtn) scopeBtn.addEventListener('click', async () => {
      if (!F.pickScope) return;
      const v = await F.pickScope(S.scope);
      if (!v || v === S.scope) return;
      S.scope = v; renderScope();
      if (S.prov.setScope) { try { await S.prov.setScope(v); } catch (e) {} }
      markSaved(F.tr('Escopo') + ': ' + ($('#wsScopeLbl').textContent || ''));
    });
    $('#wsConsolidate').addEventListener('click', async () => {
      await flushSave();
      markSaved(F.tr('Consolidando…'));
      let res;
      try { res = await S.prov.consolidate(S.scope); } catch (e) { markSaved(F.tr('Falha ao consolidar')); return; }
      $('#workspace').classList.add('hidden');
      if (S.onConsolidate) S.onConsolidate(res);
    });
    window.addEventListener('resize', () => { if (!$('#workspace').classList.contains('hidden')) { resize(); draw(); } });
    window.addEventListener('fenestra:lang', () => { if (!$('#workspace').classList.contains('hidden')) { renderItems(); renderPagesList(); draw(); } });   // legenda/itens no novo idioma
    window.addEventListener('keydown', (e) => {
      if ($('#workspace').classList.contains('hidden')) return;
      const tag = (e.target && e.target.tagName) || '';
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
      const textEditing = tag === 'TEXTAREA' || (tag === 'INPUT' && /^(|text|search|email|url|tel|password)$/.test(((e.target && e.target.type) || '').toLowerCase()));
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = (e.key || '').toLowerCase();
        if (k === 'z' && !textEditing) { e.preventDefault(); undo(); return; }   // DESFAZER em qualquer momento (só não rouba o undo de texto)
        if (k === 's') { e.preventDefault(); saveAll(); return; }
        if (!typing && k === 'c' && S.lineSel && S.lineSel.size) { e.preventDefault(); copyLines(); return; }
        if (!typing && k === 'v' && S.lineClip && S.lineClip.length) { e.preventDefault(); pasteLines(); return; }
      }
      if (e.key === 'Escape') {                        // Linear/Área: finaliza; senão cancela ponto/arraste/seleção
        if (S.areaMode && S.areaPts && S.areaPts.length) { finishArea(); return; }
        if (S.lineMode && S.linePts.length) { finishLine(); return; }
        if (S.lineSel && S.lineSel.size) { S.lineSel.clear(); draw(); }
        if (S.areaSel && S.areaSel.size) { S.areaSel.clear(); draw(); }
        if (S.clickA || S.dragMeas || selCount()) { S.clickA = null; S.dragMeas = null; clearSel(); updateMeasSel(); markSaved(F.tr('Cancelado')); draw(); }
      } else if ((e.key === 'Enter' || e.key === 'n' || e.key === 'N') && !typing && S.areaMode && S.areaPts && S.areaPts.length) {
        e.preventDefault(); finishArea();              // Enter fecha a Área
      } else if ((e.key === 'Enter' || e.key === 'n' || e.key === 'N') && !typing && S.lineMode && S.linePts.length) {
        e.preventDefault(); finishLine();              // Enter/N finaliza a linha e libera p/ começar OUTRA
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && S.areaMode) {
        e.preventDefault();
        if (S.areaPts && S.areaPts.length) { S.areaPts.pop(); draw(); }           // desfaz último ponto
        else if (S.areas && S.areas.some(a => a.page === S.page)) {               // idle → apaga a última área da folha
          pushUndo();
          for (let i = S.areas.length - 1; i >= 0; i--) { if (S.areas[i].page === S.page) { S.areas.splice(i, 1); break; } }
          saveAreas(); updateAreaTot(); renderPagesList(); draw(); markSaved(F.tr('Área apagada'));
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && S.lineMode && S.linePts.length) {
        e.preventDefault(); S.linePts.pop(); draw();    // desfaz último ponto do Linear
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && S.lineSel && S.lineSel.size) {
        e.preventDefault(); pushUndo(); S.lines = S.lines.filter(l => !S.lineSel.has(l)); S.lineSel.clear(); saveLines(); draw(); markSaved(F.tr('Linha(s) apagada(s)'));   // apaga traço(s) Linear selecionado(s)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && S.areaSel && S.areaSel.size) {
        e.preventDefault(); const n = deleteSelAreas(); markSaved(n > 1 ? F.tr('{n} áreas apagadas', { n: n }) : F.tr('Área apagada'));   // apaga área(s) selecionada(s)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && selCount()) {
        e.preventDefault(); pushUndo(); deleteSelMeas();   // apaga a medida selecionada
      } else if (!typing && !mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); toggleSnap();                  // tecla S → Snap
      } else if (!typing && !mod && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault(); toggleOrtho();                 // tecla O → Ortho
      }
    });
  }

  // ============ 2º PAINEL (split): folha de referência lado a lado — navegável + marcas ============
  (function paneB() {
    const B = { cv: null, ctx: null, img: null, page: null, marks: [], scale: 1, ox: 0, oy: 0, pan: null };
    const ready = () => B.cv && B.ctx;
    function resizeB() { if (ready()) { B.cv.width = B.cv.clientWidth; B.cv.height = B.cv.clientHeight; } }
    function fitB() {
      if (!ready() || !B.img || !B.img.width) { B.scale = 1; B.ox = 0; B.oy = 0; return; }
      const s = Math.min(B.cv.width / B.img.width, B.cv.height / B.img.height);
      B.scale = s; B.ox = (B.cv.width - B.img.width * s) / 2; B.oy = (B.cv.height - B.img.height * s) / 2;
    }
    function drawB() {
      if (!ready()) return;
      B.ctx.clearRect(0, 0, B.cv.width, B.cv.height);
      if (B.img && B.img.width) B.ctx.drawImage(B.img, B.ox, B.oy, B.img.width * B.scale, B.img.height * B.scale);
      B.ctx.font = '11px Inter, sans-serif';
      (B.marks || []).forEach(m => {
        if (m.confirmed === false) return;
        const x = m.x * B.scale + B.ox, y = m.y * B.scale + B.oy, w = (m.w || 24) * B.scale, h = (m.h || 24) * B.scale;
        B.ctx.strokeStyle = '#e3b653'; B.ctx.lineWidth = 1.5; B.ctx.strokeRect(x, y, w, h);
        const lab = (m.label || '');
        if (B.scale > 0.25 && lab) {
          const tw = B.ctx.measureText(lab).width + 8;
          B.ctx.fillStyle = 'rgba(0,0,0,.6)'; B.ctx.fillRect(x, y - 14, tw, 14);
          B.ctx.fillStyle = '#ffe7ad'; B.ctx.fillText(lab, x + 4, y - 3);
        }
      });
    }
    async function loadB(page) {
      B.page = page;
      let data; try { data = await S.prov.getPage(page); } catch (e) { data = { marks: [], image_b64: '' }; }
      B.marks = data.marks || [];
      const inf = document.querySelector('#wsPaneBInfo');
      if (inf) inf.textContent = '· ' + (B.marks.filter(m => m.confirmed !== false).length) + ' marcas';
      B.img = new Image();
      B.img.onload = () => { resizeB(); fitB(); drawB(); };
      B.img.src = data.image_b64 || '';
    }
    function fillPicker() {
      const sel = document.querySelector('#wsPaneBSheet'); if (!sel) return;
      sel.innerHTML = (S.pages || []).map(p => '<option value="' + p.page + '">' + (p.sheet || ('Folha ' + p.page)) + '</option>').join('');
    }
    F.toggleSplit = function () {
      const pane = document.querySelector('#wsPaneB'); if (!pane) return;
      const showing = !pane.classList.toggle('hidden');
      if (showing) {
        B.cv = document.querySelector('#wsCanvasB'); B.ctx = B.cv.getContext('2d');
        fillPicker();
        const other = (S.pages || []).find(p => p.page !== S.page) || (S.pages || [])[0];
        if (other) { const sel = document.querySelector('#wsPaneBSheet'); if (sel) sel.value = other.page; loadB(other.page); }
      }
      try { resize(); draw(); } catch (e) {}     // canvas A mudou de largura → re-renderiza (canvas A intacto)
    };
    (function wire() {
      const go = () => {
        const cvB = document.querySelector('#wsCanvasB'); if (!cvB || cvB._wired) return; cvB._wired = true;
        const sb = document.querySelector('#pgSplit'); if (sb) sb.addEventListener('click', F.toggleSplit);
        const cl = document.querySelector('#wsPaneBClose'); if (cl) cl.addEventListener('click', F.toggleSplit);
        const sel = document.querySelector('#wsPaneBSheet'); if (sel) sel.addEventListener('change', () => loadB(+sel.value));
        cvB.addEventListener('wheel', (e) => {
          e.preventDefault(); if (!B.img) return;
          const ix = (e.offsetX - B.ox) / B.scale, iy = (e.offsetY - B.oy) / B.scale;
          B.scale *= (e.deltaY < 0 ? 1.15 : 1 / 1.15);
          B.ox = e.offsetX - ix * B.scale; B.oy = e.offsetY - iy * B.scale; drawB();
        }, { passive: false });
        cvB.addEventListener('mousedown', (e) => { B.pan = { x: e.offsetX, y: e.offsetY, ox: B.ox, oy: B.oy }; cvB.style.cursor = 'grabbing'; });
        cvB.addEventListener('mousemove', (e) => { if (!B.pan) return; B.ox = B.pan.ox + (e.offsetX - B.pan.x); B.oy = B.pan.oy + (e.offsetY - B.pan.y); drawB(); });
        window.addEventListener('mouseup', () => { if (B.pan) { B.pan = null; if (B.cv) B.cv.style.cursor = 'grab'; } });
        window.addEventListener('resize', () => { const pane = document.querySelector('#wsPaneB'); if (B.cv && pane && !pane.classList.contains('hidden')) { resizeB(); fitB(); drawB(); } });
      };
      if (document.readyState !== 'loading') go(); else document.addEventListener('DOMContentLoaded', go);
    })();
  })();

})(window.ConstructCount);
