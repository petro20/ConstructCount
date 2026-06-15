/* =========================================================================
   help-anim.js — revelação ao rolar (cascata) da página de AJUDA (#rbHelp).
   Marca os blocos como .help-anim (escondidos via CSS), e quando entram na
   viewport adiciona .in (dispara a animação helpUp). Ao terminar, REMOVE as
   classes para liberar os efeitos de :hover (evita conflito animação×hover).
   Respeita prefers-reduced-motion via CSS. Sem IntersectionObserver, não
   esconde nada (tudo visível).
   ========================================================================= */
(function () {
  'use strict';
  var help = document.getElementById('rbHelp');
  if (!help) return;

  function setup() {
    if (!('IntersectionObserver' in window)) return;          // fallback: tudo visível, sem animar
    var nodes = help.querySelectorAll('h1, h2, .rounded-xl, ol > li');
    if (!nodes.length) return;
    Array.prototype.forEach.call(nodes, function (el) { el.classList.add('help-anim'); });

    var io = new IntersectionObserver(function (entries) {
      var step = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var delay = (step++ % 6) * 80;                        // cascata curta entre os que entram juntos
        setTimeout(function () {
          el.classList.add('in');
          el.addEventListener('animationend', function handler(ev) {
            if (ev.animationName !== 'helpUp') return;
            el.classList.remove('help-anim', 'in');           // libera :hover/transform
            el.removeEventListener('animationend', handler);
          });
        }, delay);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(nodes, function (n) { io.observe(n); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
