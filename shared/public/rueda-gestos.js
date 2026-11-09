// Rueda de gestos como en Fortnite: mantenés la B, movés el mouse hacia un gesto y al soltar la B lo hace.
// También anda con los números (1-6) mientras la rueda está abierta, o con un click en el gesto.
import { GESTOS } from './gestos.js';

let estilos = false;
function ponerEstilos() {
  if (estilos) return;
  estilos = true;
  const st = document.createElement('style');
  st.textContent = `
  .rueda-gestos{position:fixed;inset:0;z-index:60;display:grid;place-items:center;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,.35),rgba(0,0,0,0) 60%)}
  .rueda-gestos[hidden]{display:none}
  .rueda-gestos svg{width:min(78vmin,420px);height:min(78vmin,420px);pointer-events:auto;filter:drop-shadow(0 10px 30px rgba(0,0,0,.5))}
  .rueda-gestos .sector{fill:rgba(20,22,30,.82);stroke:rgba(255,255,255,.18);stroke-width:1.5;cursor:pointer;transition:fill .08s}
  .rueda-gestos .sector.on{fill:rgba(197,240,74,.92)}
  .rueda-gestos text{font:800 15px Barlow,Arial,sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:middle;pointer-events:none;text-transform:uppercase;letter-spacing:.5px}
  .rueda-gestos .on + text, .rueda-gestos text.on{fill:#1b2213}
  .rueda-gestos .tecla{font:700 11px Barlow,Arial,sans-serif;fill:rgba(255,255,255,.6)}
  .rueda-gestos .centro{fill:rgba(12,13,18,.92);stroke:rgba(255,255,255,.25);stroke-width:2}
  .rueda-gestos .nombre{font:800 18px Barlow,Arial,sans-serif;fill:#c5f04a}
  .rueda-gestos .ayuda{font:600 11px Barlow,Arial,sans-serif;fill:rgba(255,255,255,.65)}
  .rueda-gestos .aguja{stroke:#c5f04a;stroke-width:4;stroke-linecap:round}`;
  document.head.append(st);
}

// alElegir(id): hacer el gesto. puede(): si se puede abrir ahora (por ejemplo, no estás muerto).
export function ruedaGestos({ alElegir, puede = () => true } = {}) {
  ponerEstilos();
  const n = GESTOS.length, R = 200, r0 = 62, paso = (Math.PI * 2) / n;
  const p = (rad, a) => `${(R + Math.cos(a) * rad).toFixed(1)},${(R + Math.sin(a) * rad).toFixed(1)}`;
  const el = document.createElement('div');
  el.className = 'rueda-gestos'; el.hidden = true;
  el.innerHTML = `<svg viewBox="0 0 400 400">${GESTOS.map((g, i) => {
    const a0 = -Math.PI / 2 - paso / 2 + i * paso, a1 = a0 + paso, am = (a0 + a1) / 2;
    return `<path class="sector" data-i="${i}" d="M${p(r0, a0)} L${p(R - 4, a0)} A${R - 4},${R - 4} 0 0 1 ${p(R - 4, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)}Z"/>
      <text data-t="${i}" x="${p(130, am).split(',')[0]}" y="${+p(130, am).split(',')[1] - 6}">${g.nombre}</text>
      <text class="tecla" x="${p(130, am).split(',')[0]}" y="${+p(130, am).split(',')[1] + 13}">${g.tecla}</text>`;
  }).join('')}<circle class="centro" cx="200" cy="200" r="${r0 - 6}"/><line class="aguja" x1="200" y1="200" x2="200" y2="200"/>
  <text class="nombre" x="200" y="193">Gestos</text><text class="ayuda" x="200" y="214">Mové y soltá la B</text></svg>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  let abierta = false, sel = -1, dx = 0, dy = 0;
  const marcar = (i) => {
    sel = i;
    el.querySelectorAll('.sector').forEach((s, k) => s.classList.toggle('on', k === i));
    el.querySelectorAll('[data-t]').forEach((t, k) => t.classList.toggle('on', k === i));
    $('.nombre').textContent = i >= 0 ? GESTOS[i].nombre : 'Gestos';
    const a = -Math.PI / 2 + i * paso;
    $('.aguja').setAttribute('x2', i >= 0 ? (200 + Math.cos(a) * (r0 - 14)).toFixed(1) : 200);
    $('.aguja').setAttribute('y2', i >= 0 ? (200 + Math.sin(a) * (r0 - 14)).toFixed(1) : 200);
  };
  const abrir = () => { if (abierta || !puede()) return; abierta = true; dx = dy = 0; marcar(-1); el.hidden = false; };
  const cerrar = (hacer) => {
    if (!abierta) return;
    abierta = false; el.hidden = true;
    if (hacer && sel >= 0) alElegir(GESTOS[sel].id);
  };
  const enInput = (e) => e.target?.closest?.('input, select, textarea');
  const abajo = (e) => {
    if (enInput(e)) return;
    if (e.code === 'KeyB' && !e.repeat) { abrir(); e.preventDefault(); }
    else if (abierta) {
      const i = GESTOS.findIndex((g) => e.code === 'Digit' + g.tecla || e.code === 'Numpad' + g.tecla);
      if (i >= 0) { marcar(i); cerrar(true); e.preventDefault(); }
      if (e.code === 'Escape') cerrar(false);
    }
  };
  const arriba = (e) => { if (e.code === 'KeyB') cerrar(true); };
  // el ángulo del mouse desde donde estaba al apretar la B elige el gesto (anda con el puntero bloqueado también)
  const mover = (e) => {
    if (!abierta) return;
    dx += e.movementX || 0; dy += e.movementY || 0;
    if (Math.hypot(dx, dy) < 18) return marcar(-1);
    const a = Math.atan2(dy, dx) + Math.PI / 2 + paso / 2;
    marcar(((Math.floor(a / paso) % n) + n) % n);
  };
  el.addEventListener('pointerover', (e) => { const s = e.target.closest('.sector'); if (s && abierta) marcar(+s.dataset.i); });
  el.addEventListener('click', (e) => { const s = e.target.closest('.sector'); if (s) { marcar(+s.dataset.i); cerrar(true); } });
  addEventListener('keydown', abajo); addEventListener('keyup', arriba); addEventListener('mousemove', mover);
  addEventListener('blur', () => cerrar(false));
  return {
    get abierta() { return abierta; },
    destruir() { removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); removeEventListener('mousemove', mover); el.remove(); },
  };
}
