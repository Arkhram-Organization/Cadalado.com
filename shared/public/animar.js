// Script común de animaciones (clásico, en el <head>, para llegar a tiempo a los eventos de transición).
(() => {
// Si una transición entre páginas se corta (por ejemplo, una página que redirige enseguida),
// el navegador rechaza sus promesas: no es un error, así que no ensucia la consola.
const callar = (e) => { const vt = e.viewTransition; if (!vt) return; for (const k of ['ready', 'finished', 'updateCallbackDone']) vt[k]?.catch?.(() => {}); };
addEventListener('pageswap', callar);
addEventListener('pagereveal', callar);

// Apariciones al hacer scroll para todo el sitio: lo que está más abajo de la pantalla
// entra subiendo cuando llegás. Lo que ya se ve al cargar no se toca (no parpadea).
const SELECTORES = '.section-head, .games > *, .feature, .roster, .sg, .quote, .footer > *, .pie .contenedor > *, .revelar';
function marcar(raiz = document) {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const obs = (marcar.obs ||= new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('cl-visto');
      marcar.obs.unobserve(e.target);
      // al terminar se limpia, así no interfiere con los hover de cada tarjeta
      setTimeout(() => e.target.classList.remove('cl-revela', 'cl-visto'), 1100);
    }
  }, { rootMargin: '0px 0px -8% 0px' }));
  const porPadre = new Map();
  for (const el of raiz.querySelectorAll(SELECTORES)) {
    if (el.dataset.clAnimado || el.getBoundingClientRect().top < innerHeight * 0.92) continue;
    el.dataset.clAnimado = '1';
    const k = porPadre.get(el.parentNode) || 0;
    porPadre.set(el.parentNode, k + 1);
    el.style.setProperty('--cl-d', `${Math.min(k, 5) * 0.07}s`);
    el.classList.add('cl-revela');
    obs.observe(el);
  }
}
const iniciar = () => {
  marcar();
  // las secciones que se arman después (elenco, juegos) también
  setTimeout(marcar, 1200);
  setTimeout(marcar, 3500);
};
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', iniciar);
else iniciar();
})();
