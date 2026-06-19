/* =========================================================================
   desktop.js — integração com o app de desktop (pywebview)
   Quando rodando dentro do app, usa a ponte window.pywebview.api (motor Python
   local) em vez do backend web. Sem servidor.
   ========================================================================= */

'use strict';

(function (F) {

  // Blindagem do fluxo de abrir: nenhuma chamada à ponte pode travar a tela
  // pra sempre. Se passar do tempo, rejeita com rótulo → cai no catch e mostra
  // ONDE travou (em vez de ficar no "Reabrindo projeto…" eterno).
  function withTimeout(promise, ms, label) {
    let t;
    const guard = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('tempo esgotado em ' + label)), ms); });
    return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(t)), guard]);
  }

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
      const info = await withTimeout(api.prepare_job(false, null, null, null, false, projName || null), 90000, 'prepare_job');   // detect=false → só converte
      if (!info) { if (ws) ws.classList.add('hidden'); return; }
      if (info.error) { if (ws) ws.classList.add('hidden'); if (F.uploadMsg) F.uploadMsg(F.tr('Erro ao preparar projeto: {e}', { e: info.error }), true); return; }
      const slug = info.slug;
      if (projName) { try { await api.set_job_name(slug, projName); } catch (e) {} }   // garante o nome (inclusive se reaproveitado)
      if (msg) msg.textContent = info.reused ? F.tr('Reabrindo projeto…') : F.tr('Convertendo o PDF em imagens…');
      // faz polling do status até concluir
      for (;;) {
        const st = await withTimeout(api.job_status(slug), 20000, 'job_status');
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
    let job;
    try { job = await withTimeout(api.load_job(slug), 45000, 'load_job'); }
    catch (e) { const p = document.querySelector('#wsPrep'); if (p) p.classList.add('hidden'); if (F.uploadMsg) F.uploadMsg(F.tr('Falha ao carregar o projeto ({e}).', { e }), true); return; }
    if (!job) { const p = document.querySelector('#wsPrep'); if (p) p.classList.add('hidden'); if (F.uploadMsg) F.uploadMsg(F.tr('Não consegui carregar o projeto.'), true); return; }
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
      autoCountFind: (page, x, y, w, h, thresh, region, fit) => api.auto_count_find(slug, page, x, y, w, h, thresh, region || null, fit !== false),
      detectWalls: (page) => api.detect_walls(slug, page),
      readWallTypes: (page, region) => api.read_wall_types(slug, page, region || null),
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
      readLevels: () => api.read_levels(slug),
      getTakeoffIndex: () => api.get_takeoff_index(slug),
      saveFraming: (data) => api.save_framing(slug, data),
      getFraming: () => api.get_framing(slug),
      setWindowDim: (code, w, h, t, m, wadd, hadd, side, swing, addLabel, addKind) => api.set_window_dim(slug, code, w, h, t, m, wadd != null ? wadd : null, hadd != null ? hadd : null, side != null ? side : null, swing != null ? swing : null, addLabel != null ? addLabel : null, addKind != null ? addKind : null),
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
