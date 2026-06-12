/* =========================================================================
   menu.js — barra de menu (estilo PlanSwift): motor local, configurações,
   projetos salvos. As ações do motor usam a ponte pywebview (modo desktop).
   ========================================================================= */

'use strict';

(function (F) {

  const $ = (s) => document.querySelector(s);
  const api = () => (window.pywebview && window.pywebview.api) || null;

  // ----------------------------------------------------------------- ribbon (abas)
  function closeMenus() { /* ribbon não tem dropdowns; mantido p/ compat. */ }
  function bindRibbon() {
    const tabs = [...document.querySelectorAll('.rb-tab')];
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      const target = tab.dataset.tab;
      const isPage = (target === 'rbAbout' || target === 'rbHelp' || target === 'rbPkg'); // páginas cheias
      if (target === 'rbPkg' && F._renderPackage) F._renderPackage();
      const panels = [...document.querySelectorAll('.rb-panel')];
      panels.forEach(p => { p.classList.toggle('hidden', p.id !== target); p.classList.remove('rb-page'); });
      const main = document.querySelector('main');
      const panel = document.getElementById(target);
      if (isPage && panel) {                         // ConstructCount = página cheia
        panel.classList.add('rb-page');
        const mb = document.getElementById('menubar');
        panel.style.top = (mb ? Math.round(mb.getBoundingClientRect().bottom) : 120) + 'px';
        if (main) main.style.display = 'none';
      } else if (main) {                             // Início e as demais = faixa (padrão) + conteúdo
        main.style.display = '';
      }
    }));
    buildLangRow();
  }
  /** Botões de idioma PT/EN/ES na aba Exibir (refletem e trocam o idioma). */
  function buildLangRow() {
    const row = $('#rbLangRow'); if (!row || !window.ConstructCount.setLang) return;
    row.innerHTML = '';
    ['pt', 'en', 'es'].forEach(l => {
      const b = document.createElement('button');
      b.className = 'rb-lang'; b.dataset.lang = l; b.textContent = l.toUpperCase();
      b.addEventListener('click', () => { window.ConstructCount.setLang(l); refreshLangRow(); });
      row.appendChild(b);
    });
    refreshLangRow();
  }
  function refreshLangRow() {
    const cur = window.ConstructCount.getLang ? window.ConstructCount.getLang() : 'pt';
    document.querySelectorAll('#rbLangRow .rb-lang').forEach(b => b.classList.toggle('active', b.dataset.lang === cur));
  }

  function needDesktop() {
    if (!api()) { alert(F.tr('Disponível apenas no app de desktop (motor local).')); return false; }
    return true;
  }

  // ----------------------------------------------------------------- itens do menu
  function bindItems() {
    const open = $('#miOpen'); if (open) open.addEventListener('click', () => { closeMenus(); if (needDesktop() && (F._newProject || F._runLocalEngine)) (F._newProject || F._runLocalEngine)(); });
    const jobs = $('#miJobs'); if (jobs) jobs.addEventListener('click', () => { closeMenus(); if (needDesktop()) openJobs(); });
    const sett = $('#miSettings'); if (sett) sett.addEventListener('click', () => { closeMenus(); if (needDesktop()) openSettings(); });
    // ----- Documentos (exportações) -----
    const hasItems = () => (F.state && Array.isArray(F.state.items) && F.state.items.length);
    const needItems = () => { if (!hasItems()) { alert(F.tr('Abra um projeto e consolide o levantamento antes de gerar este documento.')); return false; } return true; };
    // documentos saíram daqui → tudo na Central de relatórios (aba Relatórios)
    const mrh = $('#miReportsHub'); if (mrh) mrh.addEventListener('click', () => { closeMenus(); if (F.openReportsHub) F.openReportsHub(); });
    // mural de projetos (captação) — obras esperando preço no site
    const mbd = $('#miBoard'); if (mbd) mbd.addEventListener('click', () => { closeMenus(); window.open('https://constructcount.com/projetos.php', '_blank'); });

    // ----- Central de relatórios (aba Relatórios) -----
    const rw = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', fn); };
    rw('#repWinQuote',    () => { if (needItems() && F.exportClientPDF) F.exportClientPDF(); });
    rw('#repWinProposal', () => { if (needItems() && F.exportClientProposal) F.exportClientProposal(); });
    rw('#repWinSupplier', () => { if (needItems() && F.exportSupplierXLSX) F.exportSupplierXLSX(); });
    rw('#repWinSummary',  () => { if (needItems() && F.exportSummaryPDF) F.exportSummaryPDF(); });
    rw('#repWinMarked',   () => { if (F.exportMarkedPlan) F.exportMarkedPlan(); });
    function renderReportsHub() {
      const list = $('#repWallList'); if (!list) return;
      list.innerHTML = '';
      const owned = !F.hasPackage || F.hasPackage('reports');
      if (!owned) {                                   // add-on não assinado → upsell (nada grátis)
        const d = document.createElement('div');
        d.className = 'rep-lock';
        d.innerHTML = '🔒 ' + F.tr('Relatórios é um add-on (US$ 15/mês)') + '<button class="cc-btn cc-btn-primary"><span>💳</span><span>' + F.tr('Assinar Relatórios') + '</span></button>';
        d.querySelector('button').addEventListener('click', () => window.open('https://constructcount.com/checkout.php?plan=reports', '_blank'));
        list.appendChild(d);
        return;
      }
      (F.framingReports || []).forEach(r => {
        const card = document.createElement('button');
        card.className = 'rep-card';
        card.innerHTML = '<span class="rep-t">' + F.tr(r.label) + '</span>';
        card.addEventListener('click', () => { try { r.fn(); } catch (e) { if (F.flashExport) F.flashExport('⚠️ ' + ((e && e.message) || 'erro')); } });
        list.appendChild(card);
      });
    }
    F._renderReportsHub = renderReportsHub;
    F.openReportsHub = () => { const ws = $('#workspace'); if (ws && !ws.classList.contains('hidden')) ws.classList.add('hidden'); const t = document.querySelector('.rb-tab[data-tab="rbReports"]'); if (t) t.click(); };
    { const t = document.querySelector('.rb-tab[data-tab="rbReports"]'); if (t) t.addEventListener('click', renderReportsHub); }
    // ----- Início: importar takeoff -----
    const imp = $('#miImport'); if (imp) imp.addEventListener('click', () => { const el = $('#takeoffInput'); if (el) el.click(); });
    // ----- Exibir: alternar unidade (reusa o botão da tabela) -----
    const uni = $('#miUnit'); if (uni) uni.addEventListener('click', () => { const el = $('#unitToggle'); if (el) el.click(); });
    // ----- Licença (aviso proprietário M2PB) -----
    const openLic = () => { closeMenus(); const m = $('#licenseModal'); if (m) m.classList.remove('hidden'); };
    const lic = $('#miLicense'); if (lic) lic.addEventListener('click', openLic);
    const flic = $('#footLicense'); if (flic) flic.addEventListener('click', openLic);
    const lc = $('#licClose'); if (lc) lc.addEventListener('click', () => $('#licenseModal').classList.add('hidden'));
    const lm = $('#licenseModal'); if (lm) lm.addEventListener('click', (e) => { if (e.target === lm) lm.classList.add('hidden'); });
    // CTAs "Novo projeto" (página Ajuda + vitrine ConstructCount) → abrem o seletor de PDF
    ['#howStart', '#ccStart', '#ccStart2'].forEach(sel => {
      const b = $(sel); if (b) b.addEventListener('click', () => { const mo = $('#miOpen'); if (mo) mo.click(); });
    });
    // "Como funciona" na vitrine → navega para a aba Ajuda
    const ch = $('#ccHelp'); if (ch) ch.addEventListener('click', () => {
      const t = document.querySelector('.rb-tab[data-tab="rbHelp"]'); if (t) t.click();
    });
    // ----- Pacote (plano / assinatura) -----
    const psub = $('#pkgSubscribe'); if (psub) psub.addEventListener('click', () => { window.open('https://constructcount.com/checkout.php?plan=mensal', '_blank'); });
    const pact = $('#pkgActivate'); if (pact) pact.addEventListener('click', () => { if (F.openLicenseGate) F.openLicenseGate(); else openLic(); });
    const pfr = $('#pkgOpenFraming'); if (pfr) pfr.addEventListener('click', () => { const mo = $('#miOpen'); if (mo) mo.click(); });  // Framing vive no workspace: abre projeto → camada + Linear + 🏗️ Framing
    const pfs = $('#pkgFrSubscribe'); if (pfs) pfs.addEventListener('click', () => { window.open('https://constructcount.com/checkout.php?plan=parede', '_blank'); });
    const pfa = $('#pkgFrActivate'); if (pfa) pfa.addEventListener('click', () => { if (F.openLicenseGate) F.openLicenseGate(); else openLic(); });
    const pft = $('#pkgFrTrial'); if (pft) pft.addEventListener('click', () => { window.open('https://constructcount.com/trial.php', '_blank'); });
    document.querySelectorAll('.pkg-trade-sub').forEach(b => b.addEventListener('click', () => { const t = b.getAttribute('data-trade'); window.open('https://constructcount.com/checkout.php?plan=' + t, '_blank'); }));
  }

  // ----------------------------------------------------------------- aba Pacote: status da assinatura
  async function renderPackage() {
    const box = $('#pkgStatus'), txt = $('#pkgStatusText'); if (!box || !txt) return;
    box.classList.remove('is-ok', 'is-warn', 'is-off');
    txt.textContent = F.tr('Verificando assinatura…');
    let st = null;
    try { if (F.licenseStatus) st = await F.licenseStatus(); } catch (e) {}
    if (!st) { txt.textContent = F.tr('Não foi possível verificar a assinatura agora.'); return; }
    const fmt = (d) => { if (!d) return ''; try { const t = (typeof d === 'number') ? new Date(d * 1000) : new Date(d); return t.toLocaleDateString(); } catch (e) { return ''; } };
    if (st.state === 'valid') {
      box.classList.add('is-ok');
      const exp = fmt(st.expires_at); const plan = st.plan ? (' · ' + st.plan) : '';
      txt.textContent = F.tr('Assinatura ativa') + plan + (exp ? (' · ' + F.tr('válida até {d}', { d: exp })) : '');
    } else if (st.state === 'grace') {
      box.classList.add('is-warn');
      txt.textContent = F.tr('Modo offline — {d} dia(s) de carência', { d: st.grace_days_left != null ? st.grace_days_left : '?' });
    } else if (st.state === 'none') {
      box.classList.add('is-off');
      txt.textContent = F.tr('Sem assinatura ativa — assine ou ative sua chave');
    } else {
      box.classList.add('is-off');
      txt.textContent = F.tr('Assinatura não autorizada') + (st.reason ? (' · ' + st.reason) : '');
    }
    renderFramingCard();
  }
  // card do pacote Framing reflete a POSSE (entitlement) — vendido separado
  function renderFramingCard() {
    const owned = !F.hasPackage || F.hasPackage('framing');   // sem servidor de pacotes → libera (dev)
    const tag = $('#pkgFrTag'), sub = $('#pkgFrSubscribe'), open = $('#pkgOpenFraming');
    if (tag) { tag.textContent = owned ? F.tr('🟢 Ativo no seu plano') : F.tr('🏗️ Parede completa'); tag.classList.toggle('pkg-tag--live', owned); tag.classList.toggle('pkg-tag--beta', !owned); }
    if (sub) sub.classList.toggle('hidden', owned);
    if (open) open.classList.toggle('hidden', !owned);
    const trial = $('#pkgFrTrial'); if (trial) trial.classList.toggle('hidden', owned);
    // cards à la carte: reflete posse por ofício
    document.querySelectorAll('.pkg-trade').forEach(card => {
      const t = card.getAttribute('data-trade');
      const own = !F.hasPackage || F.hasPackage(t);
      card.classList.toggle('is-owned', own);
      const lbl = card.querySelector('.pkg-trade-sub span:last-child');
      if (lbl) lbl.textContent = own ? F.tr('Ativo') : F.tr('Assinar');
    });
  }
  F._renderPackage = renderPackage;
  F._renderFramingCard = renderFramingCard;

  // ----------------------------------------------------------------- configurações
  async function openSettings() {
    let cfg = {};
    try { cfg = (await api().get_config()) || {}; } catch (e) {}
    $('#cfgRoot').value = cfg.jobs_root || '';
    $('#cfgDpi').value = cfg.dpi || 220;
    $('#cfgDispMax').value = cfg.disp_max || 2400;
    $('#cfgScope').value = cfg.scope || 'all';
    $('#cfgSchedWin').value = cfg.schedule_window != null ? cfg.schedule_window : 'auto';
    $('#cfgSchedStore').value = cfg.schedule_storefront != null ? cfg.schedule_storefront : 'auto';
    $('#settingsModal').classList.remove('hidden');
  }
  function bindSettings() {
    const c = $('#cfgCancel'); if (c) c.addEventListener('click', () => $('#settingsModal').classList.add('hidden'));
    const s = $('#cfgSave'); if (s) s.addEventListener('click', async () => {
      const cfg = {
        jobs_root: $('#cfgRoot').value.trim(),
        dpi: parseInt($('#cfgDpi').value, 10) || 220,
        disp_max: parseInt($('#cfgDispMax').value, 10) || 2400,
        scope: $('#cfgScope').value,
        schedule_window: normNum($('#cfgSchedWin').value),
        schedule_storefront: normNum($('#cfgSchedStore').value),
      };
      try { await api().save_config(cfg); } catch (e) {}
      $('#settingsModal').classList.add('hidden');
      if (F.uploadMsg) F.uploadMsg(F.tr('Configurações salvas.'), false);
    });
  }
  function normNum(v) { v = (v || '').trim(); if (/^\d+$/.test(v)) return parseInt(v, 10); return 'auto'; }

  // ----------------------------------------------------------------- projetos salvos (explorador)
  let JOBS = [], JOBS_VIEW = 'grid';
  F._openJobs = function (preloaded) { openJobs(preloaded); };
  async function openJobs(preloaded) {
    $('#jobsModal').classList.remove('hidden');
    if (Array.isArray(preloaded)) { JOBS = preloaded; renderJobs(); return; }
    const body = $('#jobsBody'); body.innerHTML = '<div class="p-6 text-steel-500">' + F.tr('Carregando projetos…') + '</div>';
    try { JOBS = (await api().list_jobs()) || []; } catch (e) { JOBS = []; }
    renderJobs();
  }
  function filteredJobs() {
    const q = (($('#jobsSearch') && $('#jobsSearch').value) || '').toLowerCase().trim();
    return q ? JOBS.filter(j => ((j.name || j.slug) + ' ' + (j.pdf_path || '')).toLowerCase().includes(q)) : JOBS;
  }
  function renderJobs() {
    const body = $('#jobsBody'); if (!body) return;
    const jobs = filteredJobs();
    const st = $('#jobsStatus'); if (st) st.textContent = F.tr('{n} projeto(s)', { n: JOBS.length }) + (jobs.length !== JOBS.length ? F.tr(' · {n} filtrado(s)', { n: jobs.length }) : '');
    if (!JOBS.length) { body.innerHTML = '<div class="p-6 text-steel-500">' + F.tr('Nenhum projeto preparado ainda. Use <b>Projeto ▸ Abrir projeto (PDF)</b>.') + '</div>'; return; }
    if (!jobs.length) { body.innerHTML = '<div class="p-6 text-steel-500">' + F.tr('Nenhum projeto encontrado para a busca.') + '</div>'; return; }
    body.innerHTML = '';
    if (JOBS_VIEW === 'grid') {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3';
      jobs.forEach(j => grid.appendChild(jobTile(j)));
      body.appendChild(grid);
    } else {
      const list = document.createElement('div'); list.className = 'divide-y divide-steel-100 bg-white rounded-lg';
      jobs.forEach(j => list.appendChild(jobRow(j)));
      body.appendChild(list);
    }
  }
  function jobMeta(j) { return F.tr('{p} folhas · {u} unid.', { p: (j.pages || 0), u: (j.units || 0) }) + (j.n_schedule ? F.tr(' · {n} medidas', { n: j.n_schedule }) : ''); }
  function jobTile(j) {
    const t = document.createElement('div');
    t.className = 'bg-white border border-steel-200 rounded-lg overflow-hidden hover:shadow-md hover:border-steel-400 transition flex flex-col';
    const thumb = j.thumb
      ? '<img src="' + j.thumb + '" class="w-full h-32 object-contain bg-steel-50" />'
      : '<div class="w-full h-32 flex items-center justify-center bg-steel-50 text-3xl text-steel-300">📄</div>';
    t.innerHTML = thumb +
      '<div class="p-2.5 flex-1 flex flex-col">' +
        '<div class="font-medium text-sm truncate" title="' + (j.name || j.slug) + '">' + (j.name || j.slug) + '</div>' +
        '<div class="text-xs text-steel-500 mt-0.5">' + jobMeta(j) + '</div>' +
        '<div class="flex gap-1 mt-2">' +
          '<button data-act="open" class="flex-1 px-2 py-1 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white">' + F.tr('Abrir') + '</button>' +
          '<button data-act="reproc" class="px-2 py-1 rounded text-xs border border-steel-300 hover:bg-steel-50" title="' + F.tr('Reprocessar') + '">↻</button>' +
          '<button data-act="del" class="px-2 py-1 rounded text-xs text-rose-600 hover:bg-rose-50" title="' + F.tr('Excluir') + '">🗑</button>' +
        '</div>' +
      '</div>';
    wireJobActions(t, j);
    return t;
  }
  function jobRow(j) {
    const r = document.createElement('div');
    r.className = 'flex items-center gap-3 px-3 py-2';
    r.innerHTML =
      (j.thumb ? '<img src="' + j.thumb + '" class="w-12 h-12 object-contain bg-steel-50 rounded shrink-0" />' : '<div class="w-12 h-12 flex items-center justify-center bg-steel-50 rounded text-xl text-steel-300 shrink-0">📄</div>') +
      '<div class="flex-1 min-w-0"><div class="font-medium text-sm truncate">' + (j.name || j.slug) + '</div>' +
      '<div class="text-xs text-steel-500">' + jobMeta(j) + '</div>' +
      '<div class="text-xs text-steel-400 truncate">' + (j.pdf_path || '') + '</div></div>' +
      '<button data-act="open" class="px-3 py-1.5 rounded text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white">' + F.tr('Abrir') + '</button>' +
      '<button data-act="reproc" class="px-3 py-1.5 rounded text-sm border border-steel-300 hover:bg-steel-50">' + F.tr('Reprocessar') + '</button>' +
      '<button data-act="del" class="px-3 py-1.5 rounded text-sm text-rose-600 hover:bg-rose-50">' + F.tr('Excluir') + '</button>';
    wireJobActions(r, j);
    return r;
  }
  function wireJobActions(el, j) {
    el.querySelector('[data-act="open"]').addEventListener('click', async () => { $('#jobsModal').classList.add('hidden'); if (F._openSavedJob) await F._openSavedJob(j.slug); });
    el.querySelector('[data-act="reproc"]').addEventListener('click', async () => {
      if (!confirm(F.tr('Reprocessar "{name}"? As marcas serão redetectadas (edições da pasta serão perdidas).', { name: (j.name || j.slug) }))) return;
      $('#jobsModal').classList.add('hidden');
      try { await api().delete_job(j.slug); if (F._runLocalEngine) F._runLocalEngine(); } catch (e) {}
    });
    el.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm(F.tr('Excluir a pasta do projeto "{name}"? Não dá pra desfazer.', { name: (j.name || j.slug) }))) return;
      try { await api().delete_job(j.slug); } catch (e) {}
      openJobs();
    });
  }

  /** Reprocessa: o PDF do job precisa ser reescolhido (a pasta foi limpa) — usa o motor. */
  async function reprocess() {
    if (F._runLocalEngine) F._runLocalEngine();   // pede o PDF de novo e reprocessa c/ as configs atuais
  }

  // ----------------------------------------------------------------- init
  function init() {
    bindRibbon(); bindItems(); bindSettings();
    document.addEventListener('fenestra:lang', refreshLangRow);   // mantém PT/EN/ES em sincronia
    const jc = $('#jobsClose'); if (jc) jc.addEventListener('click', () => $('#jobsModal').classList.add('hidden'));
    const js = $('#jobsSearch'); if (js) js.addEventListener('input', renderJobs);
    const jr = $('#jobsRefresh'); if (jr) jr.addEventListener('click', openJobs);
    const jvg = $('#jobsViewGrid'); const jvl = $('#jobsViewList');
    if (jvg) jvg.addEventListener('click', () => { JOBS_VIEW = 'grid'; jvg.classList.add('bg-steel-100'); if (jvl) jvl.classList.remove('bg-steel-100'); renderJobs(); });
    if (jvl) jvl.addEventListener('click', () => { JOBS_VIEW = 'list'; jvl.classList.add('bg-steel-100'); if (jvg) jvg.classList.remove('bg-steel-100'); renderJobs(); });
    // proteção do cliente: abrir a pasta dos projetos + backup .zip
    const jof = $('#jobsOpenFolder');
    if (jof) jof.addEventListener('click', async () => {
      if (!F.openJobsFolder) { alert(F.tr('Disponível no app de desktop.')); return; }
      try { await F.openJobsFolder(); } catch (e) {}
    });
    const jbk = $('#jobsBackup');
    if (jbk) jbk.addEventListener('click', async () => {
      if (!F.backupJobs) { alert(F.tr('Disponível no app de desktop.')); return; }
      const st = $('#jobsStatus'); const old = st ? st.textContent : '';
      if (st) st.textContent = F.tr('Fazendo backup… (pode levar um momento em projetos grandes)');
      jbk.disabled = true;
      try {
        const r = await F.backupJobs();
        if (r && r.ok) { if (st) st.textContent = F.tr('✓ Backup salvo: {n} projeto(s) · {mb} MB', { n: r.n, mb: r.mb }); }
        else if (r && r.cancelled) { if (st) st.textContent = old; }
        else { if (st) st.textContent = F.tr('Backup: {e}', { e: (r && r.error) || 'falhou' }); }
      } catch (e) { if (st) st.textContent = F.tr('Backup: {e}', { e: String(e) }); }
      jbk.disabled = false;
    });
    // clicar no fundo escuro fecha os modais
    ['#jobsModal', '#settingsModal'].forEach(sel => {
      const el = $(sel); if (el) el.addEventListener('click', (e) => { if (e.target === el) el.classList.add('hidden'); });
    });
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

})(window.ConstructCount);
