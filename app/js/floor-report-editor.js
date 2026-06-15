/* =========================================================================
   floor-report-editor.js — EDITOR DE RELATÓRIO por BLOCOS (Piso & Forro).
   Espelha o editor da Parede (mesmo CSS .fre-*, mesma mecânica de arrastar/
   reordenar, barra rich-text, salvar modelo, imprimir/PDF), trocando os
   blocos e a fonte de dados para F.floorReportDataAll() (projeto inteiro,
   por folha + nível, com Tag/material/fabricante e a base).
   Abre por: F.openFloorReportEditor()
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var money = function (n) { return F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2)); };
  var n1 = function (v) { return (Number(v) || 0).toLocaleString((F.CURRENCIES && F.state && F.CURRENCIES[F.state.currency] || { locale: 'en-US' }).locale || 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  var titleCase = function (s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var TPL_KEY = 'cc_floor_report_tpl';

  // tamanhos de papel (css = nome aceito em @page size; w/h em mm p/ o preview)
  var PAPERS = [
    { id: 'a4', label: 'A4', css: 'A4', w: 210, h: 297 },
    { id: 'letter', label: 'Carta (Letter)', css: 'letter', w: 216, h: 279 },
    { id: 'legal', label: 'Ofício (Legal)', css: 'legal', w: 216, h: 356 },
    { id: 'a3', label: 'A3', css: 'A3', w: 297, h: 420 }
  ];
  function paperOf(id) { return PAPERS.filter(function (p) { return p.id === id; })[0] || PAPERS[0]; }
  var MM2PX = 96 / 25.4;

  // labels em pt — traduzidos NA RENDERIZAÇÃO
  var CATALOG = [
    { type: 'logo', label: 'Logo / marca' },
    { type: 'title', label: 'Título' },
    { type: 'client', label: 'Dados do cliente / obra' },
    { type: 'region', label: 'Resumo (região + totais)' },
    { type: 'quoteTable', label: 'Tabela do orçamento (por folha)' },
    { type: 'materialsTable', label: 'Tabela de materiais' },
    { type: 'summaryTable', label: 'Resumo técnico (sem preços)' },
    { type: 'totals', label: 'Totais (custo → venda)' },
    { type: 'terms', label: 'Condições de pagamento' },
    { type: 'image', label: 'Imagem / Foto / logo' },
    { type: 'notes', label: 'Observações' },
    { type: 'signature', label: 'Assinatura' }
  ];

  function itemLabel(r, level) { var it = r.item || ''; if (level) it = it.replace(' - ' + titleCase(level), ''); return it; }
  function totalSf(d) { var t = 0; d.sheets.forEach(function (s) { t += (s.totFloor ? s.totFloor.sf : 0) + (s.totCeiling ? s.totCeiling.sf : 0); }); return t; }
  function flatRows(d) {
    var out = [];
    d.sheets.forEach(function (s) {
      var lvl = s.level ? titleCase(s.level) : '';
      s.floor.forEach(function (r) { out.push({ disc: tr('Piso'), sheet: s.sheet, level: lvl, item: itemLabel(r, s.level), tag: r.tag || '', material: r.material || '', manufacturer: r.manufacturer || '', qty: r.qty, unit: r.unit }); });
      s.ceiling.forEach(function (r) { out.push({ disc: tr('Forro'), sheet: s.sheet, level: lvl, item: itemLabel(r, s.level), tag: r.tag || '', material: r.material || '', manufacturer: r.manufacturer || '', qty: r.qty, unit: r.unit }); });
    });
    return out;
  }

  // imagens (igual ao editor da Parede)
  function downscaleImg(file, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var maxW = 1280, sc = Math.min(1, maxW / (img.width || 1));
        var w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        var fmt = /png/i.test(file.type) ? 'image/png' : 'image/jpeg';
        try { cb(c.toDataURL(fmt, 0.78)); } catch (e) { cb(rd.result); }
      };
      img.onerror = function () { cb(rd.result); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function pickImage(cb) { var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.addEventListener('change', function () { var f = inp.files && inp.files[0]; if (f) downscaleImg(f, cb); }); inp.click(); }

  function defaultTpl() {
    return { blocks: [{ type: 'logo' }, { type: 'title', text: tr('Proposta — Piso & Forro') }, { type: 'client' }, { type: 'region' }, { type: 'quoteTable' }, { type: 'totals' }, { type: 'terms' }, { type: 'signature' }] };
  }
  function loadTpl() { try { var t = JSON.parse(localStorage.getItem(TPL_KEY) || 'null'); if (t && Array.isArray(t.blocks)) return t; } catch (e) {} return defaultTpl(); }
  function saveTpl(t) { try { localStorage.setItem(TPL_KEY, JSON.stringify(t)); return true; } catch (e) { return false; } }

  // tabela por folha+nível (orçamento com preços OU resumo sem preços)
  function sheetTable(d, withPrices) {
    var nc = withPrices ? 8 : 6;
    var head = '<thead><tr><th>ITEM</th><th>' + tr('Tag') + '</th><th>' + tr('Tipo de material') + '</th><th>' + tr('Fabricante') + '</th><th class="r">' + tr('Qtd') + '</th><th>' + tr('Un') + '</th>'
      + (withPrices ? ('<th class="r">' + tr('Custo') + '</th><th class="r">' + tr('Venda') + '</th>') : '') + '</tr></thead>';
    var rowsOf = function (rows, level) {
      return rows.map(function (r) {
        return '<tr><td>' + esc(itemLabel(r, level)) + '</td><td>' + esc(r.tag || '—') + '</td><td>' + esc(r.material || '—') + '</td><td>' + esc(r.manufacturer || '—') + '</td><td class="r">' + n1(r.qty) + '</td><td>' + esc(r.unit) + '</td>'
          + (withPrices ? ('<td class="r">' + money(r.cost) + '</td><td class="r b">' + money(r.sale) + '</td>') : '') + '</tr>';
      }).join('');
    };
    var body = '';
    d.sheets.forEach(function (s) {
      body += '<tr><td colspan="' + nc + '" style="background:#eef2f7;font-weight:700">' + tr('Folha') + ' ' + esc(s.sheet) + (s.level ? (' · ' + esc(titleCase(s.level))) : '') + '</td></tr>';
      if (s.floor.length) { body += '<tr><td colspan="' + nc + '" style="background:#def7ec;font-weight:600">' + tr('Piso') + '</td></tr>' + rowsOf(s.floor, s.level); }
      if (s.ceiling.length) { body += '<tr><td colspan="' + nc + '" style="background:#dbeafe;font-weight:600">' + tr('Forro') + '</td></tr>' + rowsOf(s.ceiling, s.level); }
      if (withPrices) body += '<tr><td colspan="6" class="r b" style="background:#f7f3ea">' + tr('Subtotal') + ' ' + esc(s.sheet) + '</td><td class="r" style="background:#f7f3ea">' + money(s.grand.cost) + '</td><td class="r b" style="background:#f7f3ea">' + money(s.grand.sale) + '</td></tr>';
    });
    return '<table class="fre-tbl">' + head + '<tbody>' + body + '</tbody></table>';
  }

  // ---- conteúdo de cada bloco ----
  function blockBody(b, d) {
    switch (b.type) {
      case 'logo': {
        var br = F.reportBrand ? F.reportBrand() : { company: 'ConstructCount', accent: '#2c476a', line2: '' };
        var logo = b.logo || br.logo;
        return '<div class="fre-logo" style="border-left:6px solid ' + esc(br.accent) + '">'
          + (logo ? '<img src="' + logo + '" alt="">' : '')
          + '<div><div class="fre-co">' + esc(br.company) + '</div>' + (br.line2 ? '<div class="fre-co2">' + esc(br.line2) + '</div>' : '') + '</div>'
          + '<button class="fre-logobtn no-print" data-act="logo" contenteditable="false">📷 ' + (logo ? tr('Trocar logo') : tr('Adicionar logo')) + '</button></div>';
      }
      case 'title': return '<h1 class="fre-h1">' + esc(b.text || tr('Proposta')) + '</h1>';
      case 'client': return '<table class="fre-client"><tr><td>' + tr('Cliente') + ':</td><td>&nbsp;</td><td>' + tr('Data') + ':</td><td>&nbsp;</td></tr>'
        + '<tr><td>' + tr('Obra / endereço') + ':</td><td>&nbsp;</td><td>' + tr('Nº proposta') + ':</td><td>&nbsp;</td></tr></table>';
      case 'region': return '<p class="fre-region">' + (d.region ? (tr('Região') + ': <b>' + esc(d.region) + '</b> · ') : '') + d.sheets.length + ' ' + tr('folhas') + ' · ' + totalSf(d).toFixed(0) + ' SF</p>';
      case 'quoteTable': return sheetTable(d, true);
      case 'summaryTable': return sheetTable(d, false);
      case 'materialsTable': {
        var fr = flatRows(d);
        var body = fr.map(function (r) { return '<tr><td>' + esc(r.disc) + '</td><td>' + esc(r.item) + '</td><td>' + esc(r.tag || '—') + '</td><td>' + esc(r.material || '—') + '</td><td>' + esc(r.manufacturer || '—') + '</td><td class="r">' + n1(r.qty) + '</td><td>' + esc(r.unit) + '</td></tr>'; }).join('');
        return '<table class="fre-tbl"><thead><tr><th>' + tr('Disciplina') + '</th><th>ITEM</th><th>' + tr('Tag') + '</th><th>' + tr('Tipo de material') + '</th><th>' + tr('Fabricante') + '</th><th class="r">' + tr('Qtd') + '</th><th>' + tr('Un') + '</th></tr></thead><tbody>' + body + '</tbody></table>';
      }
      case 'totals': return '<div class="fre-totals"><div><span>' + tr('Custo') + '</span><b>' + money(d.grand.cost) + '</b></div><div class="fre-sale"><span>' + tr('VENDA') + '</span><b>' + money(d.grand.sale) + '</b></div></div>';
      case 'terms': return '<div class="fre-terms"><h3>' + tr('Condições de pagamento') + '</h3>' + (b.text || tr('• 50% na aprovação · 50% na entrega.<br>• Validade da proposta: 15 dias.<br>• Valores em USD.')) + '</div>';
      case 'notes': return '<div class="fre-notes"><h3>' + tr('Observações') + '</h3><div>' + (b.text || '&nbsp;') + '</div></div>';
      case 'textsec': return '<div class="fre-notes"><h3>' + esc(b.title || tr('Texto')) + '</h3><div>' + (b.text || '&nbsp;') + '</div></div>';
      case 'signature': return '<div class="fre-sign"><div>______________________________<br>' + tr('Empresa') + '</div><div>______________________________<br>' + tr('Cliente') + '</div></div>';
      case 'image':
        if (b.src) return '<div class="fre-imgwrap" style="text-align:' + (b.align || 'center') + '"><img class="fre-img" src="' + b.src + '" style="width:' + (b.w || 60) + '%">'
          + '<div class="fre-imgctl no-print" contenteditable="false"><button data-act="rep">' + tr('Trocar') + '</button><button data-act="sm">– ' + tr('menor') + '</button><button data-act="lg">+ ' + tr('maior') + '</button><button data-act="al">⇄ ' + tr('alinhar') + '</button></div></div>';
        return '<div class="fre-imgph no-print" contenteditable="false"><button data-act="add">📷 ' + tr('Adicionar imagem / logo') + '</button></div>';
      default: return '';
    }
  }

  F._floorBlockHTML = blockBody;   // reuso pelo editor visual (GrapesJS)
  var st = { tpl: null, dragIx: -1 };

  function blockLabel(type) { var f = CATALOG.filter(function (c) { return c.type === type; })[0]; return f ? tr(f.label) : type; }

  function renderDoc(doc, d) {
    doc.innerHTML = '';
    st.tpl.blocks.forEach(function (b, ix) {
      var wrap = document.createElement('div'); wrap.className = 'fre-block'; wrap.setAttribute('data-ix', ix);
      var chrome = document.createElement('div'); chrome.className = 'fre-chrome no-print'; chrome.setAttribute('contenteditable', 'false'); chrome.setAttribute('draggable', 'true');
      chrome.innerHTML = '<span class="fre-grip" title="' + tr('Arraste para reordenar') + '">⠿ ' + esc(blockLabel(b.type)) + '</span><button class="fre-del" title="' + tr('Remover bloco') + '">✕</button>';
      var content = document.createElement('div'); content.className = 'fre-content'; content.innerHTML = blockBody(b, d);
      wrap.appendChild(chrome); wrap.appendChild(content);
      chrome.querySelector('.fre-del').addEventListener('click', function () { st.tpl.blocks.splice(ix, 1); renderDoc(doc, d); });
      chrome.addEventListener('dragstart', function (e) { st.dragIx = ix; e.dataTransfer.effectAllowed = 'move'; wrap.classList.add('fre-dragging'); });
      chrome.addEventListener('dragend', function () { st.dragIx = -1; wrap.classList.remove('fre-dragging'); });
      wrap.addEventListener('dragover', function (e) { e.preventDefault(); wrap.classList.add('fre-over'); });
      wrap.addEventListener('dragleave', function () { wrap.classList.remove('fre-over'); });
      wrap.addEventListener('drop', function (e) { e.preventDefault(); wrap.classList.remove('fre-over'); var from = st.dragIx, to = ix; if (from < 0 || from === to) return; var mv = st.tpl.blocks.splice(from, 1)[0]; st.tpl.blocks.splice(to, 0, mv); renderDoc(doc, d); });
      if (b.type === 'title' || b.type === 'terms' || b.type === 'notes' || b.type === 'textsec') {
        content.addEventListener('input', function () { if (b.type === 'title') b.text = content.textContent; else b.text = content.querySelector('div') ? content.querySelector('div').innerHTML : content.innerHTML; });
      }
      if (b.type === 'logo') {
        var lb = content.querySelector('button[data-act="logo"]');
        if (lb) lb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pickImage(function (url) { b.logo = url; renderDoc(doc, d); }); });
      }
      if (b.type === 'image') {
        content.querySelectorAll('button[data-act]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            var a = btn.getAttribute('data-act');
            if (a === 'add' || a === 'rep') { pickImage(function (url) { b.src = url; if (!b.w) b.w = 60; renderDoc(doc, d); }); }
            else if (a === 'sm') { b.w = Math.max(15, (b.w || 60) - 10); renderDoc(doc, d); }
            else if (a === 'lg') { b.w = Math.min(100, (b.w || 60) + 10); renderDoc(doc, d); }
            else if (a === 'al') { b.align = b.align === 'left' ? 'center' : (b.align === 'center' ? 'right' : 'left'); renderDoc(doc, d); }
          });
        });
      }
      doc.appendChild(wrap);
    });
  }

  function buildToolbar(modal) {
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    var br = F.reportBrand ? F.reportBrand() : { accent: '#2c476a' };
    var bar = document.createElement('div'); bar.className = 'fre-toolbar no-print';
    var exec = function (cmd, val) { try { document.execCommand(cmd, false, val); } catch (e) {} };
    var btn = function (html, fn, title) { var b = document.createElement('button'); b.className = 'fre-tb'; b.innerHTML = html; if (title) b.title = title; b.addEventListener('mousedown', function (e) { e.preventDefault(); fn(); }); return b; };
    var sep = function () { var s = document.createElement('span'); s.className = 'fre-tbsep'; return s; };
    bar.appendChild(btn('<b>B</b>', function () { exec('bold'); }, tr('Negrito')));
    bar.appendChild(btn('<i>I</i>', function () { exec('italic'); }, tr('Itálico')));
    bar.appendChild(btn('<u>U</u>', function () { exec('underline'); }, tr('Sublinhado')));
    bar.appendChild(sep());
    bar.appendChild(btn('T', function () { exec('formatBlock', 'H2'); }, tr('Título')));
    bar.appendChild(btn('A+', function () { exec('fontSize', '5'); }, tr('Maior')));
    bar.appendChild(btn('A', function () { exec('fontSize', '3'); }, tr('Normal')));
    bar.appendChild(btn('a', function () { exec('fontSize', '2'); }, tr('Menor')));
    bar.appendChild(sep());
    bar.appendChild(btn('⬅', function () { exec('justifyLeft'); }, tr('Esquerda')));
    bar.appendChild(btn('⬌', function () { exec('justifyCenter'); }, tr('Centro')));
    bar.appendChild(btn('➡', function () { exec('justifyRight'); }, tr('Direita')));
    bar.appendChild(sep());
    bar.appendChild(btn('•', function () { exec('insertUnorderedList'); }, tr('Lista')));
    bar.appendChild(btn('1.', function () { exec('insertOrderedList'); }, tr('Lista numerada')));
    bar.appendChild(sep());
    ['#1f2430', '#6b7280', '#b91c1c', '#157347', br.accent || '#2c476a'].forEach(function (c) {
      var s = document.createElement('button'); s.className = 'fre-tb fre-sw2'; s.style.background = c; s.title = tr('Cor do texto');
      s.addEventListener('mousedown', function (e) { e.preventDefault(); exec('foreColor', c); }); bar.appendChild(s);
    });
    bar.appendChild(sep());
    bar.appendChild(btn('⌫', function () { exec('removeFormat'); }, tr('Limpar formatação')));
    var shell = modal.querySelector('.fre-shell'), body = modal.querySelector('.fre-body');
    if (shell && body) shell.insertBefore(bar, body);
  }

  function applyPage(doc, modal) {
    var land = st.tpl.orient === 'landscape', pp = paperOf(st.tpl.paper);
    var wmm = land ? pp.h : pp.w;                       // largura útil do papel (descontando 12mm de margem nas 2 bordas)
    doc.style.width = Math.round((wmm - 24) * MM2PX) + 'px';
    var btn = modal.querySelector('#floorFreOrient'); if (btn) btn.innerHTML = '🔄 ' + (land ? tr('Retrato') : tr('Paisagem'));
    var sty = document.getElementById('floorFrePageStyle') || (function () { var s = document.createElement('style'); s.id = 'floorFrePageStyle'; document.head.appendChild(s); return s; })();
    sty.textContent = '@media print{ @page { size: ' + pp.css + ' ' + (land ? 'landscape' : 'portrait') + '; margin: 12mm; } }';
  }

  // IA (DeepSeek) escreve SÓ o texto da proposta — números vêm do takeoff
  F.floorGenerateReportText = function (extra) {
    var d = F.floorReportDataAll();
    var br = F.reportBrand ? F.reportBrand() : {};
    var li = F.licenseInfo ? F.licenseInfo() : { key: '', device: '' };
    var L = F.getLang ? F.getLang() : 'pt';
    var hasFloor = d.sheets.some(function (s) { return s.floor.length; }), hasCeil = d.sheets.some(function (s) { return s.ceiling.length; });
    var mats = {}; flatRows(d).forEach(function (r) { if (r.material) mats[r.material] = 1; });
    var body = { lang: L, company: br.company || '', client: (extra && extra.client) || '', project: (extra && extra.project) || '', region: d.region || '',
      scopes: [hasFloor ? 'floor' : null, hasCeil ? 'ceiling' : null].filter(Boolean), types: Object.keys(mats).map(function (m) { return { name: m }; }),
      totals: { sf: totalSf(d) }, license_key: li.key || '', device: li.device || '', device_label: 'app' };
    return fetch('https://constructcount.com/app/api/report_text.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j && j.error ? j.error : ('HTTP ' + r.status)); return j; }); });
  };
  function insertAITexts(ai) {
    var nl = function (s) { return String(s || '').replace(/\n/g, '<br>'); };
    var mk = function (title, key) { return { type: 'textsec', title: title, text: nl(ai[key]) }; };
    var blocks = st.tpl.blocks;
    var ti = -1; for (var i = 0; i < blocks.length; i++) { if (/quoteTable|materialsTable|summaryTable/.test(blocks[i].type)) { ti = i; break; } }
    if (ti < 0) ti = blocks.length;
    if (ai.escopo) blocks.splice(ti, 0, mk(tr('Escopo do serviço'), 'escopo'));
    if (ai.apresentacao) blocks.splice(ti, 0, mk(tr('Apresentação'), 'apresentacao'));
    if (ai.condicoes) blocks.push(mk(tr('Condições comerciais'), 'condicoes'));
    if (ai.encerramento) blocks.push(mk(tr('Encerramento'), 'encerramento'));
  }

  F.openFloorReportEditor = function () {
    if (!F.floorReportDataAll) return;
    var d = F.floorReportDataAll();
    if (!d.sheets.length) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Meça áreas de Piso/Forro para gerar o relatório.')); return; }
    st.tpl = loadTpl();
    var old = document.getElementById('floorFreModal'); if (old) old.remove();
    var modal = document.createElement('div'); modal.id = 'floorFreModal'; modal.className = 'fre-modal';
    modal.innerHTML =
      '<div class="fre-shell">'
      + '<div class="fre-bar no-print"><b>✏️ ' + tr('Editor de relatório') + ' — ' + tr('Piso & Forro') + '</b>'
      + '<span class="fre-spacer"></span>'
      + '<button id="floorFreAI" class="fre-btn fre-btn-primary">✨ ' + tr('Texto com IA') + '</button>'
      + '<select id="floorFrePaper" class="fre-btn" title="' + tr('Tamanho do papel') + '">' + PAPERS.map(function (p) { return '<option value="' + p.id + '">📄 ' + tr(p.label) + '</option>'; }).join('') + '</select>'
      + '<button id="floorFreOrient" class="fre-btn">🔄 ' + tr('Paisagem') + '</button>'
      + '<button id="floorFreSave" class="fre-btn">💾 ' + tr('Salvar modelo') + '</button>'
      + '<button id="floorFreReset" class="fre-btn">↺ ' + tr('Padrão') + '</button>'
      + '<button id="floorFrePrint" class="fre-btn fre-btn-primary">🖨️ ' + tr('Imprimir / PDF') + '</button>'
      + '<button id="floorFreClose" class="fre-btn">✕</button></div>'
      + '<div class="fre-body">'
      + '<div class="fre-palette no-print"><div class="fre-pal-h">' + tr('Blocos') + '</div><div id="floorFrePalList"></div></div>'
      + '<div class="fre-page"><div id="floorFreDoc" class="fre-doc" contenteditable="true"></div></div>'
      + '</div></div>';
    document.body.appendChild(modal);
    var doc = modal.querySelector('#floorFreDoc');
    var pal = modal.querySelector('#floorFrePalList');
    CATALOG.forEach(function (c) { var b = document.createElement('button'); b.className = 'fre-pal-item'; b.textContent = '+ ' + tr(c.label); b.addEventListener('click', function () { st.tpl.blocks.push({ type: c.type }); renderDoc(doc, d); doc.scrollTop = doc.scrollHeight; }); pal.appendChild(b); });
    renderDoc(doc, d);
    buildToolbar(modal);
    var paperSel = modal.querySelector('#floorFrePaper'); if (paperSel) { paperSel.value = paperOf(st.tpl.paper).id; paperSel.addEventListener('change', function () { st.tpl.paper = paperSel.value; applyPage(doc, modal); }); }
    applyPage(doc, modal);
    modal.querySelector('#floorFreOrient').addEventListener('click', function () { st.tpl.orient = (st.tpl.orient === 'landscape') ? 'portrait' : 'landscape'; applyPage(doc, modal); });
    { var ai = modal.querySelector('#floorFreAI'); if (ai) ai.addEventListener('click', function () {
      ai.disabled = true; if (F.flashExport) F.flashExport('✨ ' + tr('IA escrevendo o texto da proposta…'));
      F.floorGenerateReportText().then(function (t) {
        insertAITexts(t); renderDoc(doc, d); ai.disabled = false;
        if (F.flashExport) F.flashExport('✓ ' + tr('Texto gerado — revise e edite à vontade.'));
      }).catch(function (e) { ai.disabled = false; if (F.flashExport) F.flashExport('⚠️ ' + tr('IA: ') + (e && e.message ? e.message : '')); });
    }); }
    modal.querySelector('#floorFreClose').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('#floorFreSave').addEventListener('click', function () { var ok = saveTpl(st.tpl); if (F.flashExport) F.flashExport(ok ? ('✓ ' + tr('Modelo salvo')) : ('⚠️ ' + tr('Modelo grande demais p/ salvar — reduza/retire fotos (o documento atual segue ok p/ imprimir).'))); });
    modal.querySelector('#floorFreReset').addEventListener('click', function () { st.tpl = defaultTpl(); renderDoc(doc, d); });
    modal.querySelector('#floorFrePrint').addEventListener('click', function () { document.body.classList.add('fre-printing'); window.print(); setTimeout(function () { document.body.classList.remove('fre-printing'); }, 500); });
  };
})();
