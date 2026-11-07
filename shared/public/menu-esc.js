// Menú de pausa de todos los juegos de cadalado: se abre con Esc (o con el botón de la barra).
// Uso: <script type="module" src="/comun/menu-esc.js" data-juego="Truco" data-volver="/truco/"></script>
// o desde JS: import { menuEsc } from '/comun/menu-esc.js'; menuEsc({ juego, volver }).
const yo = document.querySelector('script[src$="/comun/menu-esc.js"][data-juego]');

function estilos() {
  if (document.querySelector('#cl-esc-css')) return;
  const s = document.createElement('style');
  s.id = 'cl-esc-css';
  s.textContent = `
  .cl-esc { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: rgba(10,10,9,.72); backdrop-filter: blur(6px); animation: cl-esc-in .15s; font-family: "Barlow", system-ui, sans-serif; }
  @keyframes cl-esc-in { from { opacity: 0; } }
  .cl-esc-caja { width: min(360px, calc(100% - 32px)); padding: 22px; border-radius: 20px; background: #1b1a18; box-shadow: inset 0 0 0 1px #383531, 0 30px 80px rgba(0,0,0,.6); color: #f4f1ea; display: flex; flex-direction: column; gap: 10px; }
  .cl-esc-caja h2 { margin: 0 0 6px; font: 800 30px/1 "Barlow Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: .01em; }
  .cl-esc-caja small { color: #9a948a; margin-bottom: 6px; }
  .cl-esc-caja a, .cl-esc-caja button { display: block; width: 100%; padding: 13px 16px; border: 0; border-radius: 12px; text-align: center; text-decoration: none; cursor: pointer;
    font: 700 18px "Barlow Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: .03em; background: #2e2c29; color: #f4f1ea; box-shadow: 0 4px 0 #1f1d1b; }
  .cl-esc-caja .lima { background: #c5f04a; color: #16200a; box-shadow: 0 4px 0 #8fb52a; }
  .cl-esc-caja a:active, .cl-esc-caja button:active { transform: translateY(3px); box-shadow: none; }
  .cl-esc-btn { position: fixed; z-index: 999; right: 10px; bottom: 10px; width: 44px; height: 44px; border-radius: 12px; border: 0; background: rgba(20,20,19,.75); color: #fff; font: 800 18px system-ui; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  `;
  document.head.append(s);
}

let abierto = null;
export function menuEsc({ juego = 'Juego', volver = '/', boton = true } = {}) {
  estilos();
  const abrir = () => {
    if (abierto) return cerrar();
    abierto = document.createElement('div');
    abierto.className = 'cl-esc';
    abierto.innerHTML = `<div class="cl-esc-caja" role="dialog" aria-label="Pausa">
      <h2>Pausa</h2><small>${juego} · tocá Esc para seguir</small>
      <button class="lima" data-seguir>Seguir jugando</button>
      <a href="${volver}">Salir al menú de ${juego}</a>
      <a href="/">Volver a cadalado</a></div>`;
    abierto.addEventListener('click', (e) => {
      if (e.target === abierto || e.target.closest('[data-seguir]')) cerrar();
    });
    document.body.append(abierto);
    abierto.querySelector('[data-seguir]').focus();
  };
  const cerrar = () => {
    abierto?.remove();
    abierto = null;
  };
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // si Esc estaba cerrando otra cosa (un chat, un campo de texto) no abrimos el menú
    if (e.target.closest?.('input, textarea, select') && !abierto) return e.target.blur();
    e.preventDefault();
    abierto ? cerrar() : abrir();
  });
  if (boton) {
    const b = document.createElement('button');
    b.className = 'cl-esc-btn';
    b.title = 'Pausa (Esc)';
    b.setAttribute('aria-label', 'Pausa');
    b.textContent = '❚❚';
    b.onclick = abrir;
    document.body.append(b);
  }
  return { abrir, cerrar };
}

if (yo?.dataset?.juego) menuEsc({ juego: yo.dataset.juego, volver: yo.dataset.volver || '/', boton: yo.dataset.boton !== 'no' });
