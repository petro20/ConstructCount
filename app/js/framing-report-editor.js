/* =========================================================================
   framing-report-editor.js — EDITOR DE RELATÓRIO por BLOCOS (Framing).
   Monte o documento com blocos (logo, título, cliente, tabelas, totais,
   termos, notas, assinatura), ARRASTE para reordenar, edite qualquer texto,
   salve como MODELO e exporte em PDF (imprimir). Dados via framingReportData.
   Abre por: F.openFramingReportEditor()
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var money = function (n) { return F.money ? F.money(n) : ('$ ' + (Number(n) || 0).toFixed(2)); };
  var num = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var TPL_KEY = 'cc_framing_report_tpl';

  var CATALOG = [
    { type: 'logo', label: tr('Logo / marca') },
    { type: 'title', label: tr('Título') },
    { type: 'client', label: tr('Dados do cliente / obra') },
    { type: 'region', label: tr('Resumo (região + totais)') },
    { type: 'quoteTable', label: tr('Tabela do orçamento (por tipo)') },
    { type: 'materialsTable', label: tr('Tabela de materiais') },
    { type: 'summaryTable', label: tr('Resumo técnico (LF/SF)') },
    { type: 'totals', label: tr('Totais (custo → venda)') },
    { type: 'terms', label: tr('Condições de pagamento') },
    { type: 'image', label: tr('Imagem / Foto / logo') },
    { type: 'notes', label: tr('Observações') },
    { type: 'signature', label: tr('Assinatura') }
  ];
  // redimensiona a imagem escolhida (mantém leve p/ salvar/imprimir)
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
    return { blocks: [{ type: 'logo' }, { type: 'title', text: tr('Proposta — Framing') }, { type: 'client' }, { type: 'region' }, { type: 'quoteTable' }, { type: 'totals' }, { type: 'terms' }, { type: 'signature' }] };
  }
  function loadTpl() { try { var t = JSON.parse(localStorage.getItem(TPL_KEY) || 'null'); if (t && Array.isArray(t.blocks)) return t; } catch (e) {} return defaultTpl(); }
  function saveTpl(t) { try { localStorage.setItem(TPL_KEY, JSON.stringify(t)); return true; } catch (e) { return false; } }

  // ---- renderização de cada bloco (conteúdo HTML; o doc inteiro é contenteditable) ----
  function blockBody(b, d) {
    var T = d.totals;
    switch (b.type) {
      case 'logo': {
        var br = F.reportBrand ? F.reportBrand() : { company: 'ConstructCount', accent: '#2c476a', line2: '' };
        return '<div class="fre-logo" style="border-left:6px solid ' + esc(br.accent) + '">'
          + (br.logo ? '<img src="' + br.logo + '" alt="">' : '')
          + '<div><div class="fre-co">' + esc(br.company) + '</div>' + (br.line2 ? '<div class="fre-co2">' + esc(br.line2) + '</div>' : '') + '</div></div>';
      }
      case 'title': return '<h1 class="fre-h1">' + esc(b.text || tr('Proposta')) + '</h1>';
      case 'client': return '<table class="fre-client"><tr><td>' + tr('Cliente') + ':</td><td>&nbsp;</td><td>' + tr('Data') + ':</td><td>&nbsp;</td></tr>'
        + '<tr><td>' + tr('Obra / endereço') + ':</td><td>&nbsp;</td><td>' + tr('Nº proposta') + ':</td><td>&nbsp;</td></tr></table>';
      case 'region': return '<p class="fre-region">' + (d.region ? (tr('Região') + ': <b>' + esc(d.region) + '</b> · ') : '') + d.types.length + ' ' + tr('tipos') + ' · ' + T.lf.toFixed(0) + ' LF · ' + T.sf.toFixed(0) + ' SF</p>';
      case 'quoteTable': {
        var rows = d.types.map(function (x) {
          return '<tr><td><span class="fre-sw" style="background:' + esc(x.color) + '"></span>' + esc((x.typeId ? '(' + x.typeId + ') ' : '') + x.name) + '</td>'
            + '<td class="r">' + x.m.totalLF.toFixed(0) + '</td><td class="r">' + x.m.wallSf.toFixed(0) + '</td><td class="r">' + money(x.mat) + '</td><td class="r">' + money(x.lab) + '</td><td class="r">' + money(x.tax) + '</td><td class="r">' + money(x.cost) + '</td><td class="r b">' + money(x.sale) + '</td></tr>';
        }).join('');
        return '<table class="fre-tbl"><thead><tr><th>' + tr('Tipo') + '</th><th class="r">LF</th><th class="r">SF</th><th class="r">' + tr('Material') + '</th><th class="r">' + tr('M.O.') + '</th><th class="r">' + tr('Imposto') + '</th><th class="r">' + tr('Custo') + '</th><th class="r">' + tr('Venda') + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }
      case 'materialsTable': {
        var mr = (F._framingMatRows && F._framingValsFromT) ? F._framingMatRows(F._framingValsFromT(T), d.studsBySize, d) : [];
        var body = mr.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td class="r">' + r[3] + '</td></tr>'; }).join('');
        return '<table class="fre-tbl"><thead><tr><th>' + tr('Material') + '</th><th>' + tr('Tamanho') + '</th><th>' + tr('Unid.') + '</th><th class="r">' + tr('Qtd') + '</th></tr></thead><tbody>' + body + '</tbody></table>';
      }
      case 'summaryTable': {
        var sr = d.types.map(function (x) { return '<tr><td>' + esc((x.typeId ? '(' + x.typeId + ') ' : '') + x.name) + '</td><td class="r">' + x.m.totalLF.toFixed(0) + '</td><td class="r">' + x.m.wallSf.toFixed(0) + '</td><td class="r">' + x.m.totalStuds + '</td><td class="r">' + x.m.totalHorizLF.toFixed(0) + '</td><td class="r">' + x.m.drywallSf.toFixed(0) + '</td><td class="r">' + x.m.insulationSf.toFixed(0) + '</td><td class="r">' + x.m.paintSf.toFixed(0) + '</td></tr>'; }).join('');
        return '<table class="fre-tbl"><thead><tr><th>' + tr('Tipo') + '</th><th class="r">LF</th><th class="r">SF</th><th class="r">' + tr('Studs') + '</th><th class="r">Plate/Track</th><th class="r">Drywall</th><th class="r">Insul</th><th class="r">Paint</th></tr></thead><tbody>' + sr + '</tbody></table>';
      }
      case 'totals': return '<div class="fre-totals"><div><span>' + tr('Custo') + '</span><b>' + money(T.cost) + '</b></div><div class="fre-sale"><span>' + tr('VENDA') + '</span><b>' + money(T.sale) + '</b></div></div>';
      case 'terms': return '<div class="fre-terms"><h3>' + tr('Condições de pagamento') + '</h3>' + (b.text || tr('• 50% na aprovação · 50% na entrega.<br>• Validade da proposta: 15 dias.<br>• Valores em USD.')) + '</div>';
      case 'notes': return '<div class="fre-notes"><h3>' + tr('Observações') + '</h3><div>' + (b.text || '&nbsp;') + '</div></div>';
      case 'signature': return '<div class="fre-sign"><div>______________________________<br>' + tr('Empresa') + '</div><div>______________________________<br>' + tr('Cliente') + '</div></div>';
      case 'image':
        if (b.src) return '<div class="fre-imgwrap" style="text-align:' + (b.align || 'center') + '"><img class="fre-img" src="' + b.src + '" style="width:' + (b.w || 60) + '%">'
          + '<div class="fre-imgctl no-print" contenteditable="false"><button data-act="rep">' + tr('Trocar') + '</button><button data-act="sm">– ' + tr('menor') + '</button><button data-act="lg">+ ' + tr('maior') + '</button><button data-act="al">⇄ ' + tr('alinhar') + '</button></div></div>';
        return '<div class="fre-imgph no-print" contenteditable="false"><button data-act="add">📷 ' + tr('Adicionar imagem / logo') + '</button></div>';
      default: return '';
    }
  }

  var st = { tpl: null, dragIx: -1 };

  function renderDoc(doc, d) {
    doc.innerHTML = '';
    st.tpl.blocks.forEach(function (b, ix) {
      var wrap = document.createElement('div'); wrap.className = 'fre-block'; wrap.setAttribute('data-ix', ix);
      var chrome = document.createElement('div'); chrome.className = 'fre-chrome no-print'; chrome.setAttribute('contenteditable', 'false'); chrome.setAttribute('draggable', 'true');
      chrome.innerHTML = '<span class="fre-grip" title="' + tr('Arraste para reordenar') + '">⠿ ' + esc(blockLabel(b.type)) + '</span><button class="fre-del" title="' + tr('Remover bloco') + '">✕</button>';
      var content = document.createElement('div'); content.className = 'fre-content'; content.innerHTML = blockBody(b, d);
      wrap.appendChild(chrome); wrap.appendChild(content);
      // remover
      chrome.querySelector('.fre-del').addEventListener('click', function () { st.tpl.blocks.splice(ix, 1); renderDoc(doc, d); });
      // drag reordenar
      chrome.addEventListener('dragstart', function (e) { st.dragIx = ix; e.dataTransfer.effectAllowed = 'move'; wrap.classList.add('fre-dragging'); });
      chrome.addEventListener('dragend', function () { st.dragIx = -1; wrap.classList.remove('fre-dragging'); });
      wrap.addEventListener('dragover', function (e) { e.preventDefault(); wrap.classList.add('fre-over'); });
      wrap.addEventListener('dragleave', function () { wrap.classList.remove('fre-over'); });
      wrap.addEventListener('drop', function (e) { e.preventDefault(); wrap.classList.remove('fre-over'); var from = st.dragIx, to = ix; if (from < 0 || from === to) return; var mv = st.tpl.blocks.splice(from, 1)[0]; st.tpl.blocks.splice(to, 0, mv); renderDoc(doc, d); });
      // texto editável → guarda de volta no bloco (título/termos/notas)
      if (b.type === 'title' || b.type === 'terms' || b.type === 'notes') {
        content.addEventListener('input', function () { if (b.type === 'title') b.text = content.textContent; else b.text = content.querySelector('div') ? content.querySelector('div').innerHTML : content.innerHTML; });
      }
      // bloco de IMAGEM: upload, trocar, tamanho, alinhar
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
  function blockLabel(type) { var f = CATALOG.filter(function (c) { return c.type === type; })[0]; return f ? f.label : type; }

  F.openFramingReportEditor = function () {
    if (!F.framingReportData) return;
    var d = F.framingReportData();
    if (!d.types.length) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Trace paredes e atribua tipos antes de montar o relatório.')); return; }
    st.tpl = loadTpl();
    var old = document.getElementById('freModal'); if (old) old.remove();
    var modal = document.createElement('div'); modal.id = 'freModal'; modal.className = 'fre-modal';
    modal.innerHTML =
      '<div class="fre-shell">'
      + '<div class="fre-bar no-print"><b>✏️ ' + tr('Editor de relatório') + '</b>'
      + '<span class="fre-spacer"></span>'
      + '<button id="freSave" class="fre-btn">💾 ' + tr('Salvar modelo') + '</button>'
      + '<button id="freReset" class="fre-btn">↺ ' + tr('Padrão') + '</button>'
      + '<button id="frePrint" class="fre-btn fre-btn-primary">🖨️ ' + tr('Imprimir / PDF') + '</button>'
      + '<button id="freClose" class="fre-btn">✕</button></div>'
      + '<div class="fre-body">'
      + '<div class="fre-palette no-print"><div class="fre-pal-h">' + tr('Blocos') + '</div><div id="frePalList"></div></div>'
      + '<div class="fre-page"><div id="freDoc" class="fre-doc" contenteditable="true"></div></div>'
      + '</div></div>';
    document.body.appendChild(modal);
    var doc = modal.querySelector('#freDoc');
    var pal = modal.querySelector('#frePalList');
    CATALOG.forEach(function (c) { var b = document.createElement('button'); b.className = 'fre-pal-item'; b.textContent = '+ ' + c.label; b.addEventListener('click', function () { st.tpl.blocks.push({ type: c.type }); renderDoc(doc, d); doc.scrollTop = doc.scrollHeight; }); pal.appendChild(b); });
    renderDoc(doc, d);
    modal.querySelector('#freClose').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('#freSave').addEventListener('click', function () { var ok = saveTpl(st.tpl); if (F.flashExport) F.flashExport(ok ? ('✓ ' + tr('Modelo salvo')) : ('⚠️ ' + tr('Modelo grande demais p/ salvar — reduza/retire fotos (o documento atual segue ok p/ imprimir).'))); });
    modal.querySelector('#freReset').addEventListener('click', function () { st.tpl = defaultTpl(); renderDoc(doc, d); });
    modal.querySelector('#frePrint').addEventListener('click', function () { document.body.classList.add('fre-printing'); window.print(); setTimeout(function () { document.body.classList.remove('fre-printing'); }, 500); });
  };
})();
