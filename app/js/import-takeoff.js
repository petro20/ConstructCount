/* =========================================================================
   import-takeoff.js — importa o takeoff já produzido pelo agente
   Aceita: .xlsx (aba "WINDOW TAKEOFF" / "SUMMARY") ou schedule_data.json
   Converte para itens da Fenestra (mark, dims->mm, qty, tipo, vidro, notas).
   Depende de: SheetJS (XLSX), calculator.js (parseToMm)
   ========================================================================= */

'use strict';

window.ConstructCount = window.ConstructCount || {};

(function (F) {

  /** Operação/categoria → tipo de esquadria que o app sabe desenhar */
  function mapType(op) {
    const s = String(op || '').toLowerCase();
    if (/storefront|curtain|vitrine/.test(s)) return 'Storefront';
    if (/swing door|patio|terrace|balcony|entry|porta/.test(s)) return 'Single Door';
    if (/sliding/.test(s)) return 'Sliding Door';
    if (/twin|gemin/.test(s)) return 'Twin Window';
    if (/casement/.test(s)) return 'Casement Window';
    if (/awning|hopper|bascul/.test(s)) return 'Awning Window';
    if (/fixed|fixa/.test(s)) return 'Fixed Window';
    return 'Casement Window';
  }

  function idx(header, ...names) {
    const low = header.map(h => String(h || '').trim().toLowerCase());
    for (const n of names) {
      const i = low.indexOf(n.toLowerCase());
      if (i !== -1) return i;
    }
    // match parcial
    for (let i = 0; i < low.length; i++)
      if (names.some(n => low[i].includes(n.toLowerCase()))) return i;
    return -1;
  }

  /** Lê a aba "WINDOW TAKEOFF" (ou "SUMMARY") de um workbook SheetJS → itens */
  function parseWorkbook(wb) {
    const name = wb.SheetNames.find(n => /window takeoff/i.test(n))
              || wb.SheetNames.find(n => /takeoff/i.test(n))
              || wb.SheetNames.find(n => /summary/i.test(n))
              || wb.SheetNames[0];
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

    // acha a linha de cabeçalho (contém "Type Mark")
    let h = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some(c => /type\s*mark/i.test(String(c || '')))) { h = i; break; }
    }
    if (h === -1) throw new Error('Aba de takeoff sem cabeçalho "Type Mark".');

    const head = rows[h];
    const cMark = idx(head, 'Type Mark', 'mark', 'code', 'tipo');
    const cW    = idx(head, 'Width');
    const cH    = idx(head, 'Height');
    const cQty  = idx(head, 'Qty', 'Quantidade', 'quantity');
    const cOp   = idx(head, 'Operation', 'opera');
    const cGl   = idx(head, 'Glazing Type', 'Glazing', 'Vidro');
    const cNo   = idx(head, 'Notes', 'Observ');

    const items = [];
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i];
      const markRaw = r[cMark];
      if (markRaw == null || markRaw === '') continue;
      if (/^total/i.test(String(markRaw).trim())) break;       // chegou no TOTAL

      const wOrig = cW >= 0 ? String(r[cW] ?? '').trim() : '';
      const hOrig = cH >= 0 ? String(r[cH] ?? '').trim() : '';
      const qty = Math.max(1, parseInt(r[cQty], 10) || 1);
      const op  = cOp >= 0 ? String(r[cOp] ?? '') : '';

      items.push({
        id: String(markRaw).trim(),
        type: mapType(op),
        width_orig: wOrig,
        height_orig: hOrig,
        width: Math.round(F.parseToMm(wOrig) || 0) || 1000,
        height: Math.round(F.parseToMm(hOrig) || 0) || 1000,
        qty,
        glass: cGl >= 0 ? String(r[cGl] ?? '').trim() : '',
        color: '',
        notes: [op, cNo >= 0 ? String(r[cNo] ?? '').trim() : ''].filter(Boolean).join(' — ')
      });
    }
    if (!items.length) throw new Error('Nenhum item encontrado na aba de takeoff.');

    // nome do projeto: 1ª célula não vazia da aba SUMMARY
    let projectName = '';
    const sName = wb.SheetNames.find(n => /summary/i.test(n));
    if (sName) {
      const sr = XLSX.utils.sheet_to_json(wb.Sheets[sName], { header: 1, blankrows: false });
      for (const row of sr) { const c = (row || []).find(Boolean); if (c) { projectName = String(c).trim(); break; } }
    }
    return { items, projectName };
  }

  /** JSON do motor de levantamento (build.py): { items:[{mark,qty,width,height,...}], total_units } */
  function parseEngineJson(obj) {
    const items = (obj.items || []).map(it => {
      const wOrig = String(it.width || '').trim();
      const hOrig = String(it.height || '').trim();
      const finish = [it.ext_finish, it.int_finish].filter(Boolean);
      const noteParts = [
        it.operation,
        finish.length ? 'Acab.: ' + (finish[0] === finish[1] ? finish[0] : finish.join('/')) : '',
        it.oitc ? 'OITC ' + it.oitc : '',
        it.comments,
        [it.manufacturer, it.model].filter(Boolean).join(' '),
        it.qty_source && it.qty_source !== 'plan' ? 'fonte: ' + it.qty_source : ''
      ].filter(Boolean);
      return {
        id: String(it.mark != null ? it.mark : ''),
        type: mapType(it.operation || it.type || it.category),
        width_orig: wOrig, height_orig: hOrig,
        width: Math.round(F.parseToMm(wOrig) || 0) || 1000,
        height: Math.round(F.parseToMm(hOrig) || 0) || 1000,
        qty: Math.max(1, parseInt(it.qty, 10) || 1),
        glass: it.glass || '', color: it.color || '',
        notes: noteParts.join(' — '),
        discrepancy: it.discrepancy || '',
        seenIn: []   // motor não analisa elevação → evita falso "não na fachada"; usa só discrepancy explícita
      };
    });
    if (!items.length) {
      const d = obj.diagnostic || {};
      let why;
      if (d.text_pages === 0 && d.vectorized_pages > 0) why = 'o PDF parece VETORIZADO (texto vira curva) → precisa de visão/IA.';
      else if (!d.schedule_found) why = 'não achei a Window Schedule como tabela legível.';
      else if (d.plan_sheets_a1xx && d.plan_sheets_a1xx.length === 0) why = 'não achei plantas com numeração A-1xx (este escritório numera diferente).';
      else why = 'pode precisar de calibração para o padrão deste projeto.';
      const info = ` [${d.pages || '?'} pág · ${d.text_pages || 0} c/ texto · schedule: ${d.schedule_found ? 'sim (p.' + d.schedule_page + ', ' + d.schedule_marks + ' marcas)' : 'não'} · plantas A-1xx: ${(d.plan_sheets_a1xx || []).join(', ') || 'nenhuma'}]`;
      throw new Error('motor não achou esquadrias — ' + why + info);
    }
    return { items, projectName: (obj._source || '').toString().replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '').trim() };
  }

  /** schedule_data.json canônico → itens (qty=1 se não houver contagem) */
  function parseScheduleJson(obj) {
    const marks = obj.marks || {};
    const items = Object.keys(marks).map(k => {
      const m = marks[k];
      const wOrig = `${m.w_ft || 0}'-${m.w_in || 0}"`;
      const hOrig = `${m.h_ft || 0}'-${m.h_in || 0}"`;
      return {
        id: k,
        type: mapType(m.category || m.type),
        width_orig: wOrig, height_orig: hOrig,
        width: Math.round((m.w_ft || 0) * 304.8 + (m.w_in || 0) * 25.4) || 1000,
        height: Math.round((m.h_ft || 0) * 304.8 + (m.h_in || 0) * 25.4) || 1000,
        qty: Math.max(1, parseInt(m.qty, 10) || 1),
        glass: '', color: '',
        notes: [m.category, m.type ? 'Type ' + m.type : ''].filter(Boolean).join(' — ')
      };
    });
    (obj.supplements || []).forEach(s => {
      items.push({
        id: s.mark || ('supp-' + items.length), type: mapType(s.category || s.type),
        width_orig: `${s.w_ft || 0}'-${s.w_in || 0}"`, height_orig: `${s.h_ft || 0}'-${s.h_in || 0}"`,
        width: Math.round((s.w_ft || 0) * 304.8 + (s.w_in || 0) * 25.4) || 1000,
        height: Math.round((s.h_ft || 0) * 304.8 + (s.h_in || 0) * 25.4) || 1000,
        qty: Math.max(1, parseInt(s.qty, 10) || 1),
        glass: '', color: '', notes: ['SUPPLEMENT', s.source, s.note].filter(Boolean).join(' — ')
      });
    });
    if (!items.length) throw new Error('schedule_data.json sem marks.');
    return { items, projectName: (obj._source || '').toString().trim() };
  }

  /** Converte o objeto JSON do motor (já parseado) → {items, projectName} (uso no app desktop) */
  F.parseEngineObject = parseEngineJson;

  /** Ponto de entrada: recebe um File (.xlsx ou .json) → Promise<{items, projectName}> */
  F.parseTakeoffFile = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
      const isJson = /\.json$/i.test(file.name) || file.type === 'application/json';
      reader.onload = () => {
        try {
          if (isJson) {
            const obj = JSON.parse(reader.result);
            resolve(Array.isArray(obj.items) ? parseEngineJson(obj) : parseScheduleJson(obj));
          } else {
            const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
            resolve(parseWorkbook(wb));
          }
        } catch (e) { reject(e); }
      };
      if (isJson) reader.readAsText(file);
      else reader.readAsArrayBuffer(file);
    });
  };

})(window.ConstructCount);
