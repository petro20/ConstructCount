/* =========================================================================
   floor-report-grapes.js — EDITOR VISUAL COMPLETO (GrapesJS) p/ Piso & Forro.
   Espelha o editor visual da Parede: arrasta/solta, colunas, estilos, retrato/
   paisagem, exporta em PDF (imprimir). Carrega os BLOCOS do relatório de
   Piso/Forro (via F._floorBlockHTML) + os blocos nativos do preset-webpage.
   Abre por: F.openFloorReportGrapes()   (lazy-load via CDN)
   ========================================================================= */
(function () {
  'use strict';
  var F = window.ConstructCount = window.ConstructCount || {};
  var tr = function (s, v) { return F.tr ? F.tr(s, v) : s; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var GJS = 'https://unpkg.com/grapesjs', GCSS = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css', PRE = 'https://unpkg.com/grapesjs-preset-webpage';

  function lazyLoad(cb) {
    if (F._gjsReady && window.grapesjs) return cb();
    if (!document.getElementById('gjsCss')) { var l = document.createElement('link'); l.id = 'gjsCss'; l.rel = 'stylesheet'; l.href = GCSS; document.head.appendChild(l); }
    var s1 = document.createElement('script'); s1.src = GJS;
    s1.onload = function () { var s2 = document.createElement('script'); s2.src = PRE; s2.onload = function () { F._gjsReady = true; cb(); }; s2.onerror = function () { F._gjsReady = true; cb(); }; document.head.appendChild(s2); };
    s1.onerror = function () { if (F.flashExport) F.flashExport('⚠️ ' + tr('Falha ao carregar o editor visual (precisa de internet).')); };
    document.head.appendChild(s1);
  }

  function rep(type, d) { return F._floorBlockHTML ? F._floorBlockHTML({ type: type }, d) : ''; }
  function logoHTML() {
    var br = F.reportBrand ? F.reportBrand() : { company: 'ConstructCount', accent: '#2c476a', line2: '' };
    return '<div class="fre-logo" style="border-left:6px solid ' + esc(br.accent) + '">' + (br.logo ? '<img src="' + br.logo + '" style="height:40px">' : '') + '<div><div class="fre-co">' + esc(br.company) + '</div>' + (br.line2 ? '<div class="fre-co2">' + esc(br.line2) + '</div>' : '') + '</div></div>';
  }
  function defaultDoc(d) {
    return '<div style="max-width:760px;margin:0 auto;font:13px/1.5 Inter,system-ui;color:#1f2430">'
      + logoHTML() + rep('title', d) + rep('client', d) + rep('region', d) + rep('quoteTable', d) + rep('totals', d) + rep('terms', d) + rep('signature', d) + '</div>';
  }

  function printHTML(html) {
    var c = document.getElementById('ccPrintDoc'); if (c) c.remove();
    c = document.createElement('div'); c.id = 'ccPrintDoc'; c.innerHTML = html; document.body.appendChild(c);
    document.body.classList.add('cc-print-only'); window.print();
    setTimeout(function () { document.body.classList.remove('cc-print-only'); var x = document.getElementById('ccPrintDoc'); if (x) x.remove(); }, 800);
  }

  F.openFloorReportGrapes = function () {
    if (!F.floorReportDataAll) return;
    var d = F.floorReportDataAll();
    if (!d.sheets.length) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Meça áreas de Piso/Forro para gerar o relatório.')); return; }
    if (F.flashExport) F.flashExport(tr('Abrindo editor visual…'));
    lazyLoad(function () { init(d); });
  };

  function init(d) {
    if (!window.grapesjs) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Editor visual indisponível.')); return; }
    var old = document.getElementById('floorGjsModal'); if (old) old.remove();
    var modal = document.createElement('div'); modal.id = 'floorGjsModal'; modal.className = 'fre-gjs';
    modal.innerHTML = '<div class="fre-gjs-bar no-print"><b>🎨 ' + tr('Editor visual de relatório') + ' — ' + tr('Piso & Forro') + '</b><span class="fre-gjs-spacer"></span>'
      + '<button id="floorGjsReset" class="fre-btn">↺ ' + tr('Modelo padrão') + '</button>'
      + '<button id="floorGjsPrint" class="fre-btn fre-btn-primary">🖨️ ' + tr('Imprimir / PDF') + '</button>'
      + '<button id="floorGjsClose" class="fre-btn">✕</button></div>'
      + '<div id="floorGjsCanvas" class="fre-gjs-canvas"></div>';
    document.body.appendChild(modal);

    var stylesHref = (document.querySelector('link[href*="styles.css"]') || {}).href || 'css/styles.css';
    var opts = { container: '#floorGjsCanvas', height: '100%', fromElement: false, storageManager: { type: 'local', autosave: true, stepsBeforeSave: 3, id: 'ccFloorGjs-' }, canvas: { styles: [stylesHref] } };
    var editor;
    try { editor = window.grapesjs.init(Object.assign({ plugins: ['grapesjs-preset-webpage'], pluginsOpts: { 'grapesjs-preset-webpage': { modalImportTitle: tr('Importar') } } }, opts)); }
    catch (e) { try { editor = window.grapesjs.init(opts); } catch (e2) { if (F.flashExport) F.flashExport('⚠️ ' + tr('Falha ao iniciar o editor visual.')); modal.remove(); return; } }

    var bm = editor.BlockManager, cat = tr('Relatório');
    var add = function (id, label, content) { bm.add('ccf-' + id, { label: label, category: cat, content: content, attributes: { class: 'gjs-block' } }); };
    add('logo', '🏷️ ' + tr('Cabeçalho / logo'), logoHTML());
    add('title', '🔠 ' + tr('Título'), rep('title', d));
    add('client', '👤 ' + tr('Dados do cliente'), rep('client', d));
    add('region', '📍 ' + tr('Resumo'), rep('region', d));
    add('quote', '📄 ' + tr('Tabela do orçamento'), rep('quoteTable', d));
    add('materials', '📦 ' + tr('Tabela de materiais'), rep('materialsTable', d));
    add('summary', '📊 ' + tr('Resumo técnico'), rep('summaryTable', d));
    add('totals', '💲 ' + tr('Totais'), rep('totals', d));
    add('terms', '📝 ' + tr('Condições'), rep('terms', d));
    add('sign', '✍️ ' + tr('Assinatura'), rep('signature', d));

    try { if (!editor.getHtml() || editor.getComponents().length === 0) editor.setComponents(defaultDoc(d)); } catch (e) {}

    modal.querySelector('#floorGjsClose').addEventListener('click', function () { try { editor.destroy(); } catch (e) {} modal.remove(); });
    modal.querySelector('#floorGjsReset').addEventListener('click', function () { editor.setComponents(defaultDoc(d)); });
    modal.querySelector('#floorGjsPrint').addEventListener('click', function () {
      var css = ''; try { css = editor.getCss(); } catch (e) {}
      var html = ''; try { html = editor.getHtml(); } catch (e) {}
      printHTML('<link rel="stylesheet" href="' + stylesHref + '"><style>' + css + '</style>' + html);
    });
  }
})();
