/* =========================================================================
   main.js — orquestração da UI (upload, projeto, tabela, editor, eventos)
   Depende de: calculator.js, svg-engine.js, export.js
   ========================================================================= */

'use strict';

(function (F) {

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* =======================================================================
     1. UPLOAD + SIMULAÇÃO DE IA
     ===================================================================== */
  const pdfInput = $('#pdfInput');
  const dropzone = $('#dropzone');
  const loader   = $('#loader');
  const dropText = $('#dropText');

  pdfInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleUpload(file);
  });

  // Importar takeoff já pronto (Excel/JSON do agente)
  $('#takeoffInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadMsg(F.tr('Importando takeoff…'), false);
    try {
      F.applyTakeoff(await F.parseTakeoffFile(file));
    } catch (err) {
      uploadMsg(F.tr('Não consegui importar ({err}).', { err: err.message }), true);
    } finally {
      e.target.value = '';
    }
  });

  /** Aplica um takeoff já parseado ({items, projectName}) à UI — usado pelo import e pelo app desktop. */
  F.applyTakeoff = function (res) {
    if (!res || !Array.isArray(res.items) || !res.items.length) {
      uploadMsg(F.tr('Takeoff vazio ou inválido.'), true);
      return;
    }
    if (res.projectName) F.state.project.name = res.projectName;
    F.state.pdfBytes = null;
    loadItems(res.items);
    const totalQty = res.items.reduce((s, it) => s + it.qty, 0);
    uploadMsg(F.tr('✓ Takeoff: {n} tipos, {q} unidades.', { n: res.items.length, q: totalQty }));
  };
  F.uploadMsg = uploadMsg;   // exposto p/ o app desktop

  ['dragover', 'dragenter'].forEach(ev =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('border-steel-500', 'bg-steel-50'); }));
  ['dragleave', 'drop'].forEach(ev =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('border-steel-500', 'bg-steel-50'); }));
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') handleUpload(file);
  });

  function handleUpload(file) {
    dropText.textContent = file.name;
    loader.classList.remove('hidden');
    uploadMsg('', false, true);              // limpa mensagem anterior

    let n = 0;
    const dotsEl = $('#dots');
    const dotsTimer = setInterval(() => { n = (n + 1) % 4; dotsEl.textContent = '.'.repeat(n); }, 350);
    const finish = () => { clearInterval(dotsTimer); loader.classList.add('hidden'); };

    const reader = new FileReader();
    reader.onerror = () => { finish(); uploadMsg(F.tr('Não foi possível ler o arquivo.'), true); };
    reader.onload = async () => {
      const b64 = String(reader.result).split(',')[1] || '';
      F.state.pdfBytes = b64;            // guarda o PDF original p/ gerar a planta marcada
      try {
        const lic = F.licenseInfo ? F.licenseInfo() : { key: '', device: '' };
        const resp = await fetch('api/extract.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_base64: b64, filename: file.name, license_key: lic.key, device: lic.device })
        });
        const data = await resp.json().catch(() => ({ error: F.tr('resposta inválida do servidor') }));
        if (!resp.ok || data.error) throw new Error(data.error || ('HTTP ' + resp.status));
        finish();

        if (Array.isArray(data.items) && data.items.length) {
          if (data.project_name) F.state.project.name = data.project_name;
          loadItems(data.items);
          const extra = data.excluded_interior ? F.tr(' ({n} porta(s) interna(s) ignorada(s))', { n: data.excluded_interior }) : '';
          uploadMsg(F.tr('✓ {n} esquadrias da fachada extraídas pela IA{extra}.', { n: data.items.length, extra: extra }));
        } else {
          loadItems(F.SAMPLE_ITEMS.map(i => ({ ...i })));
          uploadMsg(F.tr('A IA não encontrou um quadro de esquadrias neste PDF; carreguei um exemplo para editar.'), true);
        }
      } catch (err) {
        // Sem backend configurado (ex.: aberto via file:// ou sem PHP) → cai no exemplo
        finish();
        loadItems(F.SAMPLE_ITEMS.map(i => ({ ...i })));
        uploadMsg(F.tr('Extração por IA indisponível ({err}). Usando dados de exemplo — veja o README para configurar a API.', { err: err.message }), true);
      }
    };
    reader.readAsDataURL(file);
  }

  /** Normaliza um item vindo da IA (ou do exemplo) para o formato interno */
  function normalizeItem(it, idx) {
    return {
      id:         String(it.id || it.mark || it.code || ('W' + String(idx + 1).padStart(2, '0'))),
      type:       it.type || 'Casement Window',
      widthOrig:  it.width_orig  ?? it.widthOrig  ?? '',   // medida original (imperial/como no projeto)
      heightOrig: it.height_orig ?? it.heightOrig ?? '',
      // vão + adicional do projeto (p/ desenhar a quebra com cotas)
      wBaseOrig: it.w_base_raw || '', wAddOrig: it.w_add_raw || '', wBaseMm: +it.w_base_mm || 0, wAddMm: +it.w_add_mm || 0,
      hBaseOrig: it.h_base_raw || '', hAddOrig: it.h_add_raw || '', hBaseMm: +it.h_base_mm || 0, hAddMm: +it.h_add_mm || 0,
      width:      Math.max(1, parseInt(it.width, 10)  || 1000),  // mm (já convertido pelo backend)
      height:     Math.max(1, parseInt(it.height, 10) || 1000),
      qty:        Math.max(1, parseInt(it.qty, 10)    || 1),
      glass:      it.glass || '',
      color:      it.color || '',
      side:       it.side || '',        // mão: 'L'/'R' (vazio = a definir, sem chute)
      swing:      it.swing || '',       // abre: 'in'/'out'
      addLabel:   it.add_label || it.addLabel || '',   // rótulo do adicional (por janela; vazio = padrão)
      // especificação lida do projeto (door schedule) — preservada p/ proposta/pedido
      material:   it.material || '', hinges: it.hinges || '', lockset: it.lockset || '',
      saddle:     it.saddle || '', glazing: it.glazing || '', fire: it.fire || '',
      panels:     it.panels || '', louvered: it.louvered || '', spec: it.spec || '',
      section:    it.section || '',
      facade:     it.facade || '',        // 'Fachada' | 'Interior' (classificação por tipo)
      notes:      it.notes || '',
      seenIn:     Array.isArray(it.seen_in) ? it.seen_in : (Array.isArray(it.seenIn) ? it.seenIn : []),
      discrepancy: it.discrepancy || '',
      missingMark: !!it.missing_mark,    // marca sem hexágono no projeto (reconstruída do texto)
      placements: Array.isArray(it.placements) ? it.placements : []
    };
  }

  function loadItems(items) {
    F.state.items = items.map(normalizeItem);
    F.state.previewIdx = 0;

    $('#emptyState').classList.add('hidden');
    ['#projectCard', '#tableCard', '#costCard', '#previewCard', '#summaryCard', '#checkCard', '#exportCard']
      .forEach(s => $(s).classList.remove('hidden'));

    hydrateProjectForm();
    renderTable();
    recalcCosts();
    renderPreview();
    renderChecks();
    F.persist();
  }

  /** Painel de conferência: divergências entre planta e fachada */
  function renderChecks() {
    const list = $('#checkList');
    if (!list) return;
    const issues = [];
    F.state.items.forEach(it => {
      const has = v => Array.isArray(it.seenIn) && it.seenIn.includes(v);
      const msgs = [];
      // divergência explícita reportada pela IA
      if (it.discrepancy && it.discrepancy.trim()) msgs.push(it.discrepancy.trim());
      // divergências derivadas das vistas onde a marca aparece
      if (Array.isArray(it.seenIn) && it.seenIn.length) {
        if (has('plan') && !has('schedule')) msgs.push(F.tr('Marca na planta sem dimensão no quadro de tipos.'));
        if (has('schedule') && !has('plan')) msgs.push(F.tr('Tipo definido no quadro mas sem marca na planta.'));
        if (has('plan') && !has('elevation')) msgs.push(F.tr('Aparece na planta mas não na fachada.'));
        if (has('elevation') && !has('plan')) msgs.push(F.tr('Aparece na fachada mas não na planta.'));
      }
      msgs.forEach(m => issues.push({ id: it.id, msg: m }));
    });

    if (!issues.length) {
      list.innerHTML = '<li class="text-emerald-600 list-none -ml-5">' + F.tr('✓ Nenhuma divergência entre planta e fachada.') + '</li>';
    } else {
      list.innerHTML = issues.map(i =>
        `<li class="text-amber-700"><span class="font-semibold">${i.id}:</span> ${i.msg}</li>`).join('');
    }
  }

  function uploadMsg(msg, warn, hideOnly) {
    const el = $('#uploadMsg');
    if (!el) return;
    if (hideOnly || !msg) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = msg;
    el.className = 'text-xs mt-3 ' + (warn ? 'text-amber-600' : 'text-emerald-600');
  }

  /* =======================================================================
     2. DADOS DO PROJETO
     ===================================================================== */
  const projFields = { name: '#projName', client: '#projClient', email: '#projEmail', phone: '#projPhone' };

  function hydrateProjectForm() {
    Object.entries(projFields).forEach(([key, sel]) => { $(sel).value = F.state.project[key] || ''; });
  }

  Object.entries(projFields).forEach(([key, sel]) => {
    document.addEventListener('input', (e) => {
      if (e.target.matches(sel)) { F.state.project[key] = e.target.value; F.persist(); }
    });
  });

  /* =======================================================================
     3. TABELA EDITÁVEL (ID, tipo, medidas, qtd) + add/remove
     ===================================================================== */
  const itemsBody = $('#itemsBody');

  function typeOptions(selected) {
    // agrupa por categoria (Janela / Porta / Fachada)
    const cats = {};
    F.WINDOW_TYPES.forEach(t => { const c = t.cat || 'Outros'; (cats[c] = cats[c] || []).push(t); });
    return Object.entries(cats).map(([cat, list]) =>
      `<optgroup label="${cat}">` +
      list.map(t => `<option value="${t.name}" ${t.name === selected ? 'selected' : ''}>${t.name}</option>`).join('') +
      `</optgroup>`).join('');
  }

  function renderTable() {
    itemsBody.innerHTML = '';
    F.state.items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-steel-100 hover:bg-steel-50';
      tr.innerHTML = `
        <td class="py-2 pr-2">
          <div class="flex items-center gap-1.5">
            ${F.markBadgeSVG(F.markShape(idx), F.markColor(idx), 16)}
            <input data-idx="${idx}" data-field="id" type="text" value="${item.id}"
              class="w-14 rounded border border-steel-200 px-2 py-1 font-semibold text-steel-700 focus:ring-1 focus:ring-steel-400 outline-none"/>
          </div>
        </td>
        <td class="py-2 pr-2">
          <select data-idx="${idx}" data-field="type"
            class="w-36 rounded border border-steel-200 px-1 py-1 text-steel-600 focus:ring-1 focus:ring-steel-400 outline-none">
            ${typeOptions(item.type)}
          </select>
        </td>
        <td class="py-2 pr-2">
          <input data-idx="${idx}" data-field="width" type="number" min="1" value="${item.width}"
            class="w-20 rounded border border-steel-200 px-2 py-1 text-right focus:ring-1 focus:ring-steel-400 outline-none"/>
        </td>
        <td class="py-2 pr-2">
          <input data-idx="${idx}" data-field="height" type="number" min="1" value="${item.height}"
            class="w-20 rounded border border-steel-200 px-2 py-1 text-right focus:ring-1 focus:ring-steel-400 outline-none"/>
        </td>
        <td class="py-2 pr-2 text-xs text-steel-400 whitespace-nowrap" title="${F.tr('Medida original como no projeto')}">
          ${(item.widthOrig || item.heightOrig) ? ((item.widthOrig || '?') + ' × ' + (item.heightOrig || '?')) : '—'}
        </td>
        <td class="py-2 pr-2">
          <input data-idx="${idx}" data-field="qty" type="number" min="1" value="${item.qty}"
            class="w-16 rounded border border-steel-200 px-2 py-1 text-right focus:ring-1 focus:ring-steel-400 outline-none"/>
        </td>
        <td class="py-2 pr-2 tabular-nums text-steel-600 area-unit">${F.fmtArea(F.areaM2(item))}</td>
        <td class="py-2 pr-2 tabular-nums font-medium text-steel-800 area-total">${F.fmtArea(F.areaM2(item) * item.qty)}</td>
        <td class="py-2 text-center">
          <button data-del="${idx}" title="${F.tr('Excluir item')}"
            class="text-steel-400 hover:text-rose-500 transition">
            <svg viewBox="0 0 24 24" class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            </svg>
          </button>
        </td>
      `;
      itemsBody.appendChild(tr);
    });

    $$('#itemsBody input, #itemsBody select').forEach(el => el.addEventListener('input', onEditItem));
    $$('#itemsBody button[data-del]').forEach(b => b.addEventListener('click', onDeleteItem));

    updateGrandTotal();
    renderPreviewSelect();
    renderSummary();
  }

  /** Quadro Resumo: marca colorida única por tipo + quantidade por projeto */
  /** medida imperial p/ o quadro: usa a original do projeto; se faltar, converte de mm (1/16") */
  function ftIn(mm) {
    if (!mm || mm <= 0) return '';
    let s = Math.round(mm / 25.4 * 16), ft = Math.floor(s / 192), rem = s - ft * 192;
    let inch = Math.floor(rem / 16), fr = rem % 16, out = ft + "'-" + inch;
    if (fr) { let n = fr, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } out += ' ' + n + '/' + d; }
    return out + '"';
  }
  function ftLabel(it) {
    const w = it.widthOrig || ftIn(it.width), h = it.heightOrig || ftIn(it.height);
    return (w || h) ? ((w || '?') + ' × ' + (h || '?')) : '';
  }

  function renderSummary() {
    const body = $('#summaryBody');
    if (!body) return;
    body.innerHTML = F.state.items.map((it, idx) => {
      const ft = ftLabel(it);
      return `
      <tr class="border-b border-steel-100">
        <td class="py-2 pr-2">${F.markBadgeSVG(F.markShape(idx), F.markColor(idx), 18)}</td>
        <td class="py-2 pr-2 font-semibold text-steel-700">${it.id}</td>
        <td class="py-2 pr-2 text-steel-600">${it.type}</td>
        <td class="py-2 pr-2 tabular-nums text-steel-600">${it.width}×${it.height} mm${ft ? `<span class="block text-xs text-steel-400">${ft}</span>` : ''}</td>
        <td class="py-2 pr-2 text-right tabular-nums font-medium align-top">${it.qty}</td>
      </tr>`;
    }).join('');
    const total = F.state.items.reduce((s, it) => s + it.qty, 0);
    $('#summaryTotal').textContent = total;
  }

  function onEditItem(e) {
    const idx = +e.target.dataset.idx;
    const field = e.target.dataset.field;
    const item = F.state.items[idx];

    if (field === 'id' || field === 'type') {
      item[field] = e.target.value;
    } else {
      item[field] = Math.max(1, +e.target.value || 0);
      const row = e.target.closest('tr');
      row.querySelector('.area-unit').textContent  = F.fmtArea(F.areaM2(item));
      row.querySelector('.area-total').textContent = F.fmtArea(F.areaM2(item) * item.qty);
      updateGrandTotal();
      recalcCosts();
    }

    // se o item editado é o que está em pré-visualização, redesenha
    if (idx === F.state.previewIdx) renderPreview();
    if (field === 'id') renderPreviewSelect();   // atualiza rótulo no seletor
    renderSummary();                              // reflete id/tipo/medida/qtd no quadro resumo
    F.persist();
  }

  function onDeleteItem(e) {
    const idx = +e.target.dataset.del;
    F.state.items.splice(idx, 1);
    if (F.state.previewIdx >= F.state.items.length) F.state.previewIdx = Math.max(0, F.state.items.length - 1);
    renderTable();
    recalcCosts();
    renderPreview();
    F.persist();
  }

  $('#btnAddItem').addEventListener('click', () => {
    F.state.items.push(F.newItem());
    renderTable();
    recalcCosts();
    F.persist();
  });

  function updateGrandTotal() {
    $('#grandTotal').textContent = F.fmtArea(F.totalAreaM2());
    $$('.unit-suffix').forEach(el => el.textContent = F.unitSuffix());
    $('#unitLabel').textContent = F.unitSuffix();
  }

  /* =======================================================================
     4. MOTOR DE CONVERSÃO m² <-> ft²
     ===================================================================== */
  $('#unitToggle').addEventListener('click', () => {
    F.state.unit = F.state.unit === 'm2' ? 'ft2' : 'm2';
    $('#unitToggle').textContent = F.state.unit === 'm2' ? F.tr('Converter para ft²') : F.tr('Converter para m²');
    renderTable();
  });

  /* =======================================================================
     5. PRÉ-VISUALIZAÇÃO (com seletor de item)
     ===================================================================== */
  function renderPreviewSelect() {
    const sel = $('#previewSelect');
    if (!sel) return;
    sel.innerHTML = F.state.items.map((it, i) =>
      `<option value="${i}" ${i === F.state.previewIdx ? 'selected' : ''}>${it.id} — ${F.typeLabel ? F.typeLabel(it.type) : it.type}</option>`).join('');
  }

  function renderPreview() {
    const item = F.state.items[F.state.previewIdx];
    if (item) F.renderSVG(item);
    const ps = $('#prevSide'), pw = $('#prevSwing');
    if (ps) ps.value = (item && item.side) || '';
    if (pw) pw.value = (item && item.swing) || '';
  }

  $('#previewSelect').addEventListener('change', (e) => {
    F.state.previewIdx = +e.target.value;
    renderPreview();
  });
  // mão da esquadria (definida pelo usuário conforme o projeto — sem chute)
  const _side = $('#prevSide'); if (_side) _side.addEventListener('change', (e) => {
    const it = F.state.items[F.state.previewIdx]; if (!it) return;
    it.side = e.target.value; F.persist && F.persist(); F.renderSVG(it);
  });
  const _swing = $('#prevSwing'); if (_swing) _swing.addEventListener('change', (e) => {
    const it = F.state.items[F.state.previewIdx]; if (!it) return;
    it.swing = e.target.value; F.persist && F.persist(); F.renderSVG(it);
  });
  // troca de idioma: re-renderiza o seletor (rótulo do tipo) e o desenho (texto da mão) no novo idioma
  document.addEventListener('fenestra:lang', () => { if (F.state && F.state.items && F.state.items.length) { renderPreviewSelect(); renderPreview(); } });

  /* =======================================================================
     6. MÓDULO DE CUSTOS
     ===================================================================== */
  ['#costPerM2', '#costFreight', '#costMargin'].forEach(sel =>
    $(sel).addEventListener('input', recalcCosts));

  // seletor de moeda
  const currencySel = $('#currencySelect');
  // restaura moeda salva (se houver)
  const savedState = F.loadSaved();
  if (savedState && savedState.currency && F.CURRENCIES[savedState.currency]) {
    F.state.currency = savedState.currency;
  }
  currencySel.value = F.state.currency;
  updateCurrencyLabel();

  currencySel.addEventListener('change', (e) => {
    F.state.currency = e.target.value;
    updateCurrencyLabel();
    recalcCosts();
    F.persist();
  });

  function updateCurrencyLabel() {
    const lbl = $('#costPerM2Label');
    if (lbl) lbl.textContent = F.currencySymbol();
  }

  function recalcCosts() {
    const costs = F.computeCosts({
      costPerM2:  +$('#costPerM2').value || 0,
      freightPct: +$('#costFreight').value || 0,
      marginPct:  +$('#costMargin').value || 0
    });
    F.state.costs = costs;

    $('#costArea').value        = costs.totalArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('#outCost').textContent   = F.money(costs.totalCost);
    $('#outPrice').textContent  = F.money(costs.price);
    $('#outProfit').textContent = F.money(costs.profit);
  }

  /* =======================================================================
     7. EXPORTAÇÃO
     ===================================================================== */
  // documentos saíram daqui → Central de relatórios (aba Relatórios)
  { const b = $('#btnReportsHub'); if (b) b.addEventListener('click', () => { if (F.openReportsHub) F.openReportsHub(); }); }

})(window.ConstructCount);
