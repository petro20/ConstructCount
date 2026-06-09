/* =========================================================================
   annotator.js — tela de revisão CV-assistida (híbrido)
   Mostra a planta rasterizada + marcadores candidatos (do CV). O usuário
   confirma/rejeita, adiciona os que faltaram e ajusta o rótulo. Conclui →
   conta por rótulo → vira itens na Fenestra.
   F.openAnnotator(imageUrl, candidates, { page, onDone })
     candidates: [{x,y,w,h,label}]  (coords na imagem)
   ========================================================================= */

'use strict';

(function (F) {

  const S = {                       // estado da sessão de anotação
    img: null, marks: [], scale: 1, ox: 0, oy: 0,
    addMode: false, dragging: false, lastX: 0, lastY: 0, moved: false, onDone: null,
  };
  let cv, ctx;

  const $ = (s) => document.querySelector(s);

  F.openAnnotator = function (imageUrl, candidates, opts = {}) {
    cv = $('#annCanvas'); ctx = cv.getContext('2d');
    S.marks = (candidates || []).map(c => ({
      x: c.x, y: c.y, w: c.w || 24, h: c.h || 24,
      label: (c.label || '').toString().trim(), confirmed: true, cv: true,
    }));
    S.onDone = opts.onDone || null;
    if ($('#annMult')) $('#annMult').value = 1;       // reseta multiplicador a cada planta
    $('#annPage').textContent = opts.page ? F.tr('Folha: {page}', { page: opts.page }) : '';
    $('#annotator').classList.remove('hidden');

    S.img = new Image();
    S.img.onload = () => { resize(); fit(); draw(); };
    S.img.src = imageUrl;
  };

  function close() { $('#annotator').classList.add('hidden'); S.img = null; S.marks = []; }

  function resize() { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
  function fit() {
    const s = Math.min(cv.width / S.img.width, cv.height / S.img.height);
    S.scale = s; S.ox = (cv.width - S.img.width * s) / 2; S.oy = (cv.height - S.img.height * s) / 2;
  }
  const toImg = (sx, sy) => [(sx - S.ox) / S.scale, (sy - S.oy) / S.scale];

  function draw() {
    if (!S.img) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(S.img, S.ox, S.oy, S.img.width * S.scale, S.img.height * S.scale);
    S.marks.forEach(m => {
      const x = m.x * S.scale + S.ox, y = m.y * S.scale + S.oy, w = m.w * S.scale, h = m.h * S.scale;
      ctx.lineWidth = 2;
      ctx.strokeStyle = m.confirmed ? (m.cv ? '#e11d48' : '#2563eb') : 'rgba(120,120,120,.5)';
      ctx.strokeRect(x, y, w, h);
      if (m.confirmed && m.label) {
        ctx.fillStyle = '#111'; ctx.font = '600 12px Inter, sans-serif';
        ctx.fillText(m.label, x, y - 3);
      }
    });
    updateCounts();
  }

  function mult() { return Math.max(1, parseInt($('#annMult') && $('#annMult').value, 10) || 1); }

  function updateCounts() {
    const c = {};
    S.marks.filter(m => m.confirmed).forEach(m => { const k = m.label || F.tr('(sem rótulo)'); c[k] = (c[k] || 0) + 1; });
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const mx = mult();
    const breakdown = Object.entries(c).sort().map(([k, v]) => k + ':' + v).join('  ') || '—';
    $('#annCounts').textContent = (mx > 1
      ? F.tr('{total} marcas ×{mx} = {grand} · {breakdown}', { total: total, mx: mx, grand: total * mx, breakdown: breakdown })
      : F.tr('{total} marcas · {breakdown}', { total: total, breakdown: breakdown }));
  }

  function hit(sx, sy) {
    const [ix, iy] = toImg(sx, sy);
    return S.marks.find(m => ix >= m.x && ix <= m.x + m.w && iy >= m.y && iy <= m.y + m.h);
  }

  function bind() {
    cv = $('#annCanvas'); ctx = cv.getContext('2d');   // garante refs no load (antes de qualquer openAnnotator)
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const [ix, iy] = toImg(e.offsetX, e.offsetY);
      S.scale *= f;
      S.ox = e.offsetX - ix * S.scale; S.oy = e.offsetY - iy * S.scale;
      draw();
    }, { passive: false });

    cv.addEventListener('mousedown', (e) => { S.dragging = true; S.moved = false; S.lastX = e.offsetX; S.lastY = e.offsetY; });
    cv.addEventListener('mousemove', (e) => {
      if (!S.dragging) return;
      const dx = e.offsetX - S.lastX, dy = e.offsetY - S.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) S.moved = true;
      if (!S.addMode) { S.ox += dx; S.oy += dy; S.lastX = e.offsetX; S.lastY = e.offsetY; draw(); }
    });
    cv.addEventListener('mouseup', (e) => {
      S.dragging = false;
      if (S.moved) return;                        // foi arraste, não clique
      const m = hit(e.offsetX, e.offsetY);
      if (S.addMode) {
        if (m) { m.confirmed = !m.confirmed; }     // no modo add, clicar numa marca alterna
        else {
          const [ix, iy] = toImg(e.offsetX, e.offsetY);
          const sz = 24;
          S.marks.push({ x: ix - sz / 2, y: iy - sz / 2, w: sz, h: sz, label: $('#annLabel').value.trim(), confirmed: true, cv: false });
        }
      } else if (m) {
        m.confirmed = !m.confirmed;                // confirmar/rejeitar
      }
      draw();
    });
    cv.addEventListener('dblclick', (e) => {
      const m = hit(e.offsetX, e.offsetY);
      if (m) { const v = prompt(F.tr('Rótulo da marca:'), m.label); if (v !== null) { m.label = v.trim(); m.confirmed = true; } draw(); }
    });

    $('#annAdd').addEventListener('click', () => {
      S.addMode = !S.addMode;
      $('#annAdd').classList.toggle('bg-emerald-500', S.addMode);
      cv.style.cursor = S.addMode ? 'crosshair' : 'grab';
    });
    if ($('#annMult')) $('#annMult').addEventListener('input', updateCounts);
    $('#annZoomIn').addEventListener('click', () => { S.scale *= 1.2; draw(); });
    $('#annZoomOut').addEventListener('click', () => { S.scale /= 1.2; draw(); });
    $('#annCancel').addEventListener('click', close);
    $('#annDone').addEventListener('click', () => {
      const counts = {};
      S.marks.filter(m => m.confirmed).forEach(m => { const k = m.label || F.tr('S/ROTULO'); counts[k] = (counts[k] || 0) + 1; });
      const mx = mult();
      const note = (mx > 1 ? F.tr('CV-assistido · {mx} pavimentos', { mx: mx }) : F.tr('CV-assistido'));
      const items = Object.entries(counts).map(([mark, qty]) => ({
        mark, qty: qty * mx, type: 'Casement Window', width: '', height: '',
        glass: '', operation: '', notes: note,
      }));
      close();
      if (S.onDone) S.onDone(items);
    });
    window.addEventListener('resize', () => { if (!$('#annotator').classList.contains('hidden')) { resize(); draw(); } });
  }

  document.addEventListener('DOMContentLoaded', () => { if ($('#annCanvas')) bind(); });
  if (document.readyState !== 'loading' && $('#annCanvas')) bind();

})(window.ConstructCount);
