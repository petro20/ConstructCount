/* =========================================================================
   desktop.js — integração com o app de desktop (pywebview)
   Quando rodando dentro do app, usa a ponte window.pywebview.api (motor Python
   local) em vez do backend web. Sem servidor.
   ========================================================================= */

'use strict';

(function (F) {

  function init() {
    F._desktop = true;
    // no desktop, o fluxo é pelo MENU (barra do topo) — esconde upload web e o botão antigo
    const dz = document.querySelector('#dropzone'); if (dz) dz.classList.add('hidden');
    const btn = document.querySelector('#btnDesktopPick'); if (btn) btn.classList.add('hidden');
    const mb = document.querySelector('#menubar'); if (mb) mb.classList.remove('hidden');
    const lbl = document.querySelector('#loader .font-medium');
    if (lbl && lbl.firstChild) lbl.firstChild.textContent = F.tr('Lendo a planta — motor local (PDF grande pode levar ~1 min)');
    if (btn) btn.addEventListener('click', runLocalEngine);
    // atalhos na tela inicial
    const hs = document.querySelector('#homeShortcuts'); if (hs) hs.classList.remove('hidden');
    const hp = document.querySelector('#homeOpenPdf'); if (hp) hp.addEventListener('click', newProject);
    const hj = document.querySelector('#homeOpenJobs'); if (hj) hj.addEventListener('click', () => { if (F._openJobs) F._openJobs(); });
    // proteção do cliente: abrir a pasta dos projetos + backup .zip de tudo
    F.openJobsFolder = () => window.pywebview.api.open_jobs_folder();
    F.backupJobs = () => window.pywebview.api.backup_jobs();
    (async () => { try { const r = await window.pywebview.api.jobs_root(); if (r && r.path) F._jobsRootPath = r.path; } catch (e) {} })();
    // no desktop, a Planta Marcada é gerada pelo backend (tem o PDF + marcas do job)
    if (F.exportMarkedPlan) {
      const _web = F.exportMarkedPlan;
      F.exportMarkedPlan = async function () {
        if (F._currentJobSlug && window.pywebview && window.pywebview.api.export_marked_plan) {
          const lang = F.pickDocLang ? await F.pickDocLang() : (F.getLang ? F.getLang() : 'pt');
          if (!lang) return;                              // cancelado no seletor
          if (F.flashExport) F.flashExport(F.tr('Gerando planta marcada…'));
          let r; try { r = await window.pywebview.api.export_marked_plan(F._currentJobSlug, lang); } catch (e) { if (F.flashExport) F.flashExport(F.tr('Falha: {e}', { e })); return; }
          if (r && r.error) { if (F.flashExport) F.flashExport(F.tr('Planta marcada: {e}', { e: r.error })); }
          else if (F.flashExport) F.flashExport(F.tr('✓ Planta marcada gerada ({n} folhas) e aberta.', { n: (r && r.pages) || 0 }));
          return;
        }
        return _web.apply(this, arguments);
      };
    }
    // abre o explorador automaticamente se já houver projetos salvos
    (async () => {
      try {
        const jobs = await window.pywebview.api.list_jobs();
        if (Array.isArray(jobs) && jobs.length && F._openJobs) F._openJobs(jobs);
      } catch (e) {}
    })();
  }

  /** Ação do motor local: escolhe PDF, roda o motor e decide texto×vetorizado. */
  async function runLocalEngine() {
    const loader = document.querySelector('#loader');
    const dots = document.querySelector('#dots');
    if (F.uploadMsg) F.uploadMsg('', false, true);
    if (loader) loader.classList.remove('hidden');
    let n = 0;
    const t = setInterval(() => { if (dots) dots.textContent = '.'.repeat((n = (n + 1) % 4)); }, 350);
    const stop = () => { clearInterval(t); if (loader) loader.classList.add('hidden'); };
    try {
      const res = await window.pywebview.api.run_takeoff();
      stop();
      if (!res) return;                              // diálogo cancelado
      if (res.error) { if (F.uploadMsg) F.uploadMsg(F.tr('Erro no motor: {e}', { e: res.error }), true); return; }
      if (res.mode === 'needs_cv') {                 // PDF vetorizado → workspace (pasta do projeto)
        await openTakeoffWorkspace();
        return;
      }
      F.applyTakeoff(F.parseEngineObject(res));
    } catch (e) {
      stop();
      if (F.uploadMsg) F.uploadMsg(F.tr('Falha ao chamar o motor ({e}).', { e }), true);
    }
  }
  F._runLocalEngine = runLocalEngine;

  /** "Novo projeto": escolhe o PDF (sem reconhecer) e segue p/ converter + selecionar folhas. */
  async function newProject() {
    const api = window.pywebview.api;
    if (F.uploadMsg) F.uploadMsg('', false, true);
    let picked;
    try { picked = await api.open_project(); } catch (e) { if (F.uploadMsg) F.uploadMsg(F.tr('Falha ao chamar o motor ({e}).', { e }), true); return; }
    if (!picked) return;                                  // diálogo cancelado
    if (picked.error) { if (F.uploadMsg) F.uploadMsg(F.tr('Erro ao preparar projeto: {e}', { e: picked.error }), true); return; }
    // nome do projeto (como está no projeto) — pré-preenchido com o do arquivo, editável
    const def = picked.name || '';
    let name = prompt(F.tr('Nome do projeto (como está no projeto):'), def);
    if (name === null) return;                            // cancelou
    name = (name || '').trim() || def;
    await openTakeoffWorkspace(name);                     // usa o PDF escolhido (_last_pdf)
  }
  F._newProject = newProject;

  /** Modal de SELEÇÃO de folhas (grade de miniaturas). Resolve {pages:[], sched:[]} ou null. */
  F.pickSheets = function (pages) {
    return new Promise((resolve) => {
      const sel = new Set(), sched = new Set();
      const mkbtn = (txt, extra) => { const b = document.createElement('button'); b.textContent = txt; b.className = 'px-3 py-1.5 rounded text-white text-sm ' + (extra || 'bg-steel-600 hover:bg-steel-500'); return b; };
      const ov = document.createElement('div');
      ov.className = 'fixed inset-0 z-[70] bg-steel-900/95 flex flex-col';
      const head = document.createElement('div');
      head.className = 'flex items-center gap-3 px-5 py-3 bg-steel-800 text-white flex-wrap shrink-0';
      const ttl = document.createElement('div');
      ttl.innerHTML = '<div class="font-semibold text-base">' + F.tr('Selecionar folhas para pesquisar') + '</div>' +
        '<div class="text-steel-300 text-xs">' + F.tr('Marque as folhas (plantas) que o motor vai processar. Use 📐 para a folha de medidas (schedule).') + '</div>';
      head.appendChild(ttl);
      const btnAll = mkbtn(F.tr('Selecionar todas'));
      const btnNone = mkbtn(F.tr('Limpar'));
      const count = document.createElement('span'); count.className = 'text-steel-200 text-xs px-1';
      const btnOk = mkbtn('', 'bg-emerald-600 hover:bg-emerald-500 font-semibold');
      const btnCancel = mkbtn(F.tr('Cancelar'), 'bg-rose-600 hover:bg-rose-500');
      const sp = document.createElement('span'); sp.className = 'ml-auto';
      head.append(sp, btnAll, btnNone, count, btnOk, btnCancel);
      ov.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'flex-1 overflow-y-auto p-4 grid gap-3';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
      ov.appendChild(grid);
      const updaters = [];
      const bars = () => { count.textContent = F.tr('{n} selecionada(s)', { n: sel.size }); btnOk.textContent = F.tr('Processar selecionadas ({n})', { n: sel.size }); };
      (pages || []).forEach(pg => {
        const t = document.createElement('div');
        t.className = 'rounded-lg overflow-hidden border-2 border-steel-700 bg-steel-800 cursor-pointer select-none transition';
        t.innerHTML = '<img src="' + pg.thumb + '" class="w-full h-36 object-contain bg-white"/>' +
          '<div class="flex items-center justify-between px-2 py-1 text-xs text-steel-100">' +
          '<span>' + F.tr('Folha {p}', { p: pg.page }) + '</span>' +
          '<button class="schedBtn px-1.5 rounded hover:bg-steel-600" title="' + F.tr('Folha de medidas (schedule)') + '">📐</button></div>';
        const setUI = () => {
          t.classList.toggle('border-emerald-500', sel.has(pg.page));
          t.classList.toggle('border-steel-700', !sel.has(pg.page));
          t.querySelector('.schedBtn').classList.toggle('bg-amber-500', sched.has(pg.page));
        };
        t.addEventListener('click', () => { if (sel.has(pg.page)) { sel.delete(pg.page); sched.delete(pg.page); } else sel.add(pg.page); setUI(); bars(); });
        t.querySelector('.schedBtn').addEventListener('click', (e) => { e.stopPropagation(); if (sched.has(pg.page)) sched.delete(pg.page); else { sched.add(pg.page); sel.add(pg.page); } setUI(); bars(); });
        updaters.push(setUI); grid.appendChild(t); setUI();
      });
      bars();
      btnAll.addEventListener('click', () => { (pages || []).forEach(p => sel.add(p.page)); updaters.forEach(f => f()); bars(); });
      btnNone.addEventListener('click', () => { sel.clear(); sched.clear(); updaters.forEach(f => f()); bars(); });
      const cleanup = () => ov.remove();
      btnCancel.addEventListener('click', () => { cleanup(); resolve(null); });
      btnOk.addEventListener('click', () => { if (!sel.size) { alert(F.tr('Selecione ao menos uma folha.')); return; } cleanup(); resolve({ pages: [...sel], sched: [...sched] }); });
      document.body.appendChild(ov);
    });
  };

  /** Fluxo PlanSwift: prepara a pasta do projeto (rasteriza+detecta), mostra progresso,
   *  e abre o workspace de takeoff (páginas + marcas editáveis + consolidar). */
  async function openTakeoffWorkspace(projName) {
    const api = window.pywebview.api;
    const ws = document.querySelector('#workspace');
    const prep = document.querySelector('#wsPrep');
    const bar = document.querySelector('#wsPrepBar');
    const msg = document.querySelector('#wsPrepMsg');
    const sub = document.querySelector('#wsPrepSub');
    try {
      // CONVERTE todas as folhas em imagens (sem detecção). O reconhecimento é
      // feito depois, no workspace (após apagar as folhas que não interessam).
      if (ws) ws.classList.remove('hidden');
      if (prep) prep.classList.remove('hidden');
      if (msg) msg.textContent = F.tr('Convertendo o PDF em imagens…');
      if (sub) sub.textContent = '';
      if (bar) bar.style.width = '0%';
      const info = await api.prepare_job(false, null, null, null, false, projName || null);   // detect=false → só converte
      if (!info) { if (ws) ws.classList.add('hidden'); return; }
      if (info.error) { if (ws) ws.classList.add('hidden'); if (F.uploadMsg) F.uploadMsg(F.tr('Erro ao preparar projeto: {e}', { e: info.error }), true); return; }
      const slug = info.slug;
      if (projName) { try { await api.set_job_name(slug, projName); } catch (e) {} }   // garante o nome (inclusive se reaproveitado)
      if (msg) msg.textContent = info.reused ? F.tr('Reabrindo projeto…') : F.tr('Convertendo o PDF em imagens…');
      // faz polling do status até concluir
      for (;;) {
        const st = await api.job_status(slug);
        if (st && st.total) {
          const pct = Math.round((st.done || 0) / st.total * 100);
          if (bar) bar.style.width = pct + '%';
          if (sub) sub.textContent = (st.step || '') + ' · ' + F.tr('{done}/{total} folhas', { done: (st.done || 0), total: st.total });
        }
        if (!st || st.state === 'done') break;
        if (st.state === 'error') { if (F.uploadMsg) F.uploadMsg(F.tr('Falha no preparo: {e}', { e: (st.error || '') }), true); if (prep) prep.classList.add('hidden'); return; }
        await new Promise(r => setTimeout(r, 1200));
      }
      await openWorkspaceFromSlug(slug);
    } catch (e) {
      if (prep) prep.classList.add('hidden');
      if (F.uploadMsg) F.uploadMsg(F.tr('Falha no workspace ({e}).', { e }), true);
    }
  }

  /** Abre o workspace a partir de um job já preparado (sem reprocessar). */
  async function openWorkspaceFromSlug(slug) {
    const api = window.pywebview.api;
    F._currentJobSlug = slug;                    // p/ exports do backend (planta marcada etc.)
    const job = await api.load_job(slug);
    if (!job) { if (F.uploadMsg) F.uploadMsg(F.tr('Não consegui carregar o projeto.'), true); return; }
    const prov = {
      getPage: (page) => api.get_page(slug, page),
      saveMarks: (page, marks, mult) => api.save_marks(slug, page, marks, mult),
      consolidate: (scope) => api.consolidate(slug, scope || null),
      setScope: (scope) => api.set_scope(slug, scope),
      recognize: (pages) => api.recognize_job(slug, pages || null),
      readSheets: () => api.read_sheets(slug),
      hasMarksBackup: (page) => api.has_marks_backup(slug, page),
      restoreMarks: (page) => api.restore_marks(slug, page),
      status: () => api.job_status(slug),
      reload: () => api.load_job(slug),
      autoCount: (page, x, y, w, h, thresh) => api.auto_count(slug, page, x, y, w, h, thresh),
      autoCountFind: (page, x, y, w, h, thresh, region) => api.auto_count_find(slug, page, x, y, w, h, thresh, region || null),
      detectWalls: (page) => api.detect_walls(slug, page),
      readWallTypes: (page) => api.read_wall_types(slug, page),
      readWallTypesAll: () => api.read_wall_types_all(slug),
      readHeights: () => api.read_ceiling_heights(slug),
      readRegion: () => api.read_project_region(slug),
      readCodes: (page, boxes) => api.read_marks_codes(slug, page, boxes),
      prewarmAutoCount: (page) => api.prewarm_autocount(slug, page),
      setSchedulePage: (page, on) => api.set_schedule_page(slug, page, on),
      rereadSchedule: () => api.reread_schedule(slug),
      deletePages: (pages) => api.delete_pages(slug, pages),
      setPageScale: (page, mmPerPx) => api.set_page_scale(slug, page, mmPerPx),
      upscalePage: (page, dispMax) => api.upscale_page(slug, page, dispMax),
      openFolder: () => api.open_folder(slug),
      saveMeasures: (page, measures) => api.save_measures(slug, page, measures),
      saveLines: (page, lines) => api.save_lines(slug, page, lines),
      saveAreas: (page, areas) => api.save_areas(slug, page, areas),
      detectRoom: (page, x, y) => api.detect_room(slug, page, x, y),
      detectRooms: (page, points) => api.detect_rooms(slug, page, points),
      readFinishSchedule: () => api.read_finish_schedule(slug),
      saveFraming: (data) => api.save_framing(slug, data),
      getFraming: () => api.get_framing(slug),
      setWindowDim: (code, w, h, t, m) => api.set_window_dim(slug, code, w, h, t, m),
      addSection: (name) => api.add_section(slug, name),
      setActiveSection: (name) => api.set_active_section(slug, name),
      renameSection: (o, n) => api.rename_section(slug, o, n),
      deleteSection: (name) => api.delete_section(slug, name),
      addLayer: (name, color) => api.add_layer(slug, name, color || null),
      setActiveLayer: (lid) => api.set_active_layer(slug, lid),
      updateLayer: (lid, patch) => api.update_layer(slug, lid, (patch && patch.name) ?? null, (patch && patch.color) ?? null, (patch && patch.visible) ?? null, (patch && patch.locked) ?? null),
      deleteLayer: (lid) => api.delete_layer(slug, lid),
    };
    F.openWorkspace({
      slug, name: job.name, pages: job.pages, schedule: job.schedule, prov,
      schedulePages: job.schedule_pages || [],
      sections: job.sections, activeSection: job.active_section,
      layers: job.layers, activeLayer: job.active_layer,
      scope: job.scope || 'all',
      onConsolidate: (res) => {
        if (res && res.items && res.items.length) {
          F.applyTakeoff({ items: res.items });
          let msg = F.tr('Takeoff consolidado: {types} tipos, {marks} unidades.', { types: res.n_types, marks: res.n_marks });
          const rc = (res.reconstructed || []);
          if (rc.length) {
            msg += '  ' + F.tr('⚠ {n} marca(s) SEM hexágono no projeto (spec reconstruída do texto): {marks}. Confirme/ajuste a marcação na tabela e na Conferência.', { n: rc.length, marks: rc.join(', ') });
          }
          if (F.uploadMsg) F.uploadMsg(msg, rc.length > 0);
          if (rc.length) alert(F.tr('Atenção: o projeto não tem hexágono para a(s) marca(s): {marks}.\nA especificação foi reconstruída do texto do schedule.\nConfirme/ajuste a marcação correta na tabela (campo ID) e veja a Conferência.', { marks: rc.join(', ') }));
        } else if (F.uploadMsg) F.uploadMsg(F.tr('Nenhuma marca confirmada no projeto.'), true);
      },
    });
  }
  F._openTakeoffWorkspace = openTakeoffWorkspace;
  F._openSavedJob = openWorkspaceFromSlug;

  /** (Legado) Detecção CV de folha única + anotador. Mantido como alternativa. */
  async function runCvAnnotate(page) {
    const loader = document.querySelector('#loader');
    if (loader) loader.classList.remove('hidden');
    try {
      const cv = await window.pywebview.api.run_cv_detect(page || null, 220);
      if (loader) loader.classList.add('hidden');
      if (!cv) return;
      if (cv.error) { if (F.uploadMsg) F.uploadMsg(F.tr('Erro no CV: {e}', { e: cv.error }), true); return; }
      if (F.uploadMsg) {
        const others = (cv.pages || []).filter(p => p.page !== cv.page && p.n_hex > 0)
          .map(p => F.tr('folha {page} ({n})', { page: p.page, n: p.n_hex })).join(', ');
        F.uploadMsg(F.tr('Folha {page}: {n} marcas candidatas.', { page: cv.page, n: cv.n_hex }) +
          (others ? ' ' + F.tr('Outras com marcas: {list}.', { list: others }) : ''), false);
      }
      // busca o schedule EM PARALELO enquanto o usuário anota (~80s) — não trava a tela
      const schedP = window.pywebview.api.run_get_schedule()
        .then(s => (s && !s.error) ? s : {})
        .catch(() => ({}));
      F.openAnnotator(cv.image_b64, cv.candidates, {
        page: cv.page,
        onDone: async (items) => {
          if (!items || !items.length) { if (F.uploadMsg) F.uploadMsg(F.tr('Nenhuma marca confirmada.'), true); return; }
          if (F.uploadMsg) F.uploadMsg(F.tr('Buscando dimensões do schedule…'), false);
          const sched = await schedP;             // garante o schedule pronto antes de fundir
          // funde dimensões do window schedule (A700) por marca
          let hit = 0;
          items.forEach(it => {
            const r = sched[(it.mark || '').toUpperCase()];
            if (r) {
              if (r.w_mm) it.width = r.w_mm;
              if (r.h_mm) it.height = r.h_mm;
              if (r.w_raw) it.width_orig = r.w_raw;
              if (r.h_raw) it.height_orig = r.h_raw;
              if (r.type) it.notes = (it.notes ? it.notes + ' · ' : '') + r.type;
              hit++;
            }
          });
          if (F.uploadMsg) F.uploadMsg(F.tr('Contagem aplicada: {n} marcas, {hit} com dimensão do schedule.', { n: items.length, hit }), false);
          F.applyTakeoff({ items });
        },
      });
    } catch (e) {
      if (loader) loader.classList.add('hidden');
      if (F.uploadMsg) F.uploadMsg(F.tr('Falha no CV ({e}).', { e }), true);
    }
  }
  F._runCvAnnotate = runCvAnnotate;

  // aviso de ATUALIZAÇÃO: compara a versão do motor local com a publicada no servidor
  async function checkEngineUpdate() {
    try {
      const local = await window.pywebview.api.engine_version();
      const r = await fetch('api/engine-version.json?cb=' + Date.now());
      const remote = await r.json();
      if (local && remote && remote.engine && local.engine && remote.engine > local.engine) {
        setTimeout(() => { if (F.flashExport) F.flashExport(F.tr('🔄 Atualização do app disponível — baixe a nova versão no portal (constructcount.com).')); }, 4000);
      }
    } catch (e) {}
  }

  if (window.pywebview && window.pywebview.api) { init(); checkEngineUpdate(); }
  else window.addEventListener('pywebviewready', () => { init(); checkEngineUpdate(); });

})(window.ConstructCount);
