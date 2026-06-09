/* =========================================================================
   cards.js — torna cada card (seções 1..8) RECOLHÍVEL + visual renovado.
   Não reescreve o HTML: percorre os cards, embrulha o corpo num .card-body,
   adiciona um chevron de recolher no cabeçalho e estiliza o numerador.
   Estado de recolhido persiste em localStorage por título do card.
   ========================================================================= */
'use strict';
window.ConstructCount = window.ConstructCount || {};

(function (F) {
  const tr = (s) => (F.tr ? F.tr(s) : s);
  const KEY = 'fenestra_cards_collapsed';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };

  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function cardId(card, h2) {
    const t = (h2.textContent || '').replace(/\s+/g, ' ').trim();
    return card.id || t.slice(0, 40);
  }

  function enhance() {
    const state = load();
    document.querySelectorAll('main .bg-white.rounded-xl').forEach(card => {
      if (card.dataset.enh) return;
      const h2 = card.querySelector('h2');
      if (!h2) return;                                  // pula placeholders (#emptyState)
      card.dataset.enh = '1';
      card.classList.add('app-card');

      // separa cabeçalho (filho que contém o h2) do corpo (filhos seguintes)
      const kids = [...card.children];
      const hi = kids.findIndex(k => k === h2 || k.contains(h2));
      const header = kids[hi];
      const body = document.createElement('div');
      body.className = 'card-body';
      kids.slice(hi + 1).forEach(el => body.appendChild(el));
      if (body.childNodes.length) card.appendChild(body);

      // numerador em gradiente
      const badge = h2.querySelector('span');
      if (badge && /^\d+$/.test((badge.textContent || '').trim())) badge.classList.add('card-num');

      // chevron de recolher
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-toggle';
      btn.title = tr('Recolher/expandir');
      btn.innerHTML = CHEV;
      header.classList.add('card-head');
      header.insertBefore(btn, header.firstChild);
      // cabeçalho em linha (h2 + controle à direita): empurra o controle p/ a direita
      if (header !== h2 && header.classList.contains('justify-between')) {
        header.classList.remove('justify-between');
        const ctrl = header.children[2];               // [chevron, h2, controle]
        if (ctrl) ctrl.classList.add('ml-auto');
      }

      const id = cardId(card, h2);
      // recolhimento dirigido por estilo inline (robusto em qualquer engine)
      const setState = (collapsed, animate) => {
        card.classList.toggle('collapsed', collapsed);   // chevron + acessibilidade
        if (!animate) {
          body.style.transition = 'none';
          body.style.maxHeight = collapsed ? '0px' : '';
          body.style.opacity = collapsed ? '0' : '';
          void body.offsetHeight;                        // força reflow
          body.style.transition = '';
          return;
        }
        if (collapsed) {
          body.style.maxHeight = body.scrollHeight + 'px';
          body.style.opacity = '1';
          void body.offsetHeight;                        // trava a altura inicial (sem rAF)
          body.style.maxHeight = '0px';
          body.style.opacity = '0';
        } else {
          body.style.opacity = '1';
          body.style.maxHeight = body.scrollHeight + 'px';
          let cleared = false;
          const clear = () => { if (cleared) return; cleared = true; body.style.maxHeight = ''; body.removeEventListener('transitionend', done); };
          const done = (e) => { if (e.propertyName === 'max-height') clear(); };
          body.addEventListener('transitionend', done);
          setTimeout(clear, 400);                          // fallback se transitionend não disparar
        }
      };
      setState(!!state[id], false);                       // estado inicial (sem animação)

      const toggle = () => {
        const now = !card.classList.contains('collapsed');
        setState(now, true);
        const s = load(); s[id] = now; save(s);
      };
      btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      h2.style.cursor = 'pointer';
      h2.addEventListener('click', toggle);
    });
  }

  // mantém o tooltip do chevron no idioma atual
  function retitle() {
    document.querySelectorAll('.card-toggle').forEach(b => { b.title = tr('Recolher/expandir'); });
  }

  function init() {
    enhance();                                          // cards já existem no HTML (só ficam hidden)
    document.addEventListener('fenestra:lang', retitle);
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

})(window.ConstructCount);
