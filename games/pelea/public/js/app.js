// Piña Final: juego de pelea 2D con los personajes 3D del club.
// Modos: contra bots (1v1 o 2v2 con un bot de compañero), 2 jugadores en la misma compu y salas online
// (1v1 o 2v2; los bots completan los lugares vacíos). En cada ronda a cada luchador le toca un elemento
// y un arma al azar. Online: el anfitrión simula la pelea y la manda por WebRTC; cada uno manda sus teclas.
import { Sala, marco, api, pid, esc, toast, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { NPCS, POR_ID } from '/comun/npcs.js';
import { Red } from '/comun/red.js';
import { crearEscena, COLOR_EQ } from './escena.js';
import { crearCombate, pasoCombate, vistaDe, codificar, decodificar, codificarEntrada, decodificarEntrada } from './combate.js';
import { ELEMENTOS, ARMAS, PASO, pensarBot } from './motor.js';
import { ESCENARIOS } from './escenarios.js';
import { sfx, locutor } from './sonido.js';

const app = document.querySelector('#app');
const COLOR_JUEGO = '#ff4a3a';
const cuenta = await marco({ juego: 'Piña Final', color: COLOR_JUEGO, volver: '/pelea/' });
const ROSTER = NPCS.filter((n) => n.look?.modelo).map((n) => n.id);
const foto = (id) => `/img/tienda/${id}.webp`;
const nombreNpc = (id) => POR_ID[id]?.nombre || id;
const azarDe = (a) => a[Math.floor(Math.random() * a.length)];
const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let limpiar = [];

function ir(ruta) { history.pushState(null, '', ruta); ruteo(); }
addEventListener('popstate', ruteo);
app.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ir]');
  if (!a) return;
  e.preventDefault(); ir(a.getAttribute('href'));
});
function ruteo() {
  limpiar.forEach((f) => f()); limpiar = [];
  document.body.classList.remove('en-pelea');
  const m = location.pathname.match(/^\/pelea\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else if (/^\/pelea\/bots/.test(location.pathname)) seleccion({ dos: false });
  else if (/^\/pelea\/local/.test(location.pathname)) seleccion({ dos: true });
  else menu();
}

// ---------------------------------------------------------------- controles
const TECLAS = {
  solo: { izq: ['KeyA', 'ArrowLeft'], der: ['KeyD', 'ArrowRight'], arriba: ['KeyW', 'ArrowUp', 'Space'], abajo: ['KeyS', 'ArrowDown'], pina: ['KeyJ', 'KeyZ'], patada: ['KeyK', 'KeyX'], guardia: ['KeyL', 'KeyC', 'ShiftLeft'], poder: ['KeyU', 'KeyV'], arma: ['KeyI', 'KeyB'], super: ['KeyO', 'KeyN'] },
  j1: { izq: ['KeyA'], der: ['KeyD'], arriba: ['KeyW'], abajo: ['KeyS'], pina: ['KeyF'], patada: ['KeyG'], guardia: ['KeyH'], poder: ['KeyR'], arma: ['KeyT'], super: ['KeyY'] },
  j2: { izq: ['ArrowLeft'], der: ['ArrowRight'], arriba: ['ArrowUp'], abajo: ['ArrowDown'], pina: ['KeyJ', 'Numpad1'], patada: ['KeyK', 'Numpad2'], guardia: ['KeyL', 'Numpad3'], poder: ['KeyU', 'Numpad4'], arma: ['KeyI', 'Numpad5'], super: ['KeyO', 'Numpad6'] },
};
function teclado() {
  const t = new Set();
  const abajo = (e) => {
    if (e.target.closest?.('input, select, textarea')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    t.add(e.code);
  };
  const arriba = (e) => t.delete(e.code);
  const blur = () => t.clear();
  addEventListener('keydown', abajo); addEventListener('keyup', arriba); addEventListener('blur', blur);
  const algun = (lista) => lista.some((k) => t.has(k));
  const leerMando = (i) => {
    const g = navigator.getGamepads?.()[i];
    if (!g) return null;
    const b = (n) => !!g.buttons[n]?.pressed;
    const ax = Math.abs(g.axes[0]) > .4 ? g.axes[0] : 0, ay = Math.abs(g.axes[1]) > .5 ? g.axes[1] : 0;
    return { x: Math.max(-1, Math.min(1, ax + (b(15) ? 1 : 0) - (b(14) ? 1 : 0))), y: Math.max(-1, Math.min(1, ay + (b(13) ? 1 : 0) - (b(12) ? 1 : 0))), pina: b(2), patada: b(0), poder: b(1), arma: b(3), guardia: b(4) || b(5), super: b(7) || b(6) };
  };
  return {
    leer(perfil, mando = null) {
      const k = TECLAS[perfil];
      const e = { x: (algun(k.der) ? 1 : 0) - (algun(k.izq) ? 1 : 0), y: (algun(k.abajo) ? 1 : 0) - (algun(k.arriba) ? 1 : 0) };
      for (const b of ['pina', 'patada', 'guardia', 'poder', 'arma', 'super']) e[b] = algun(k[b]);
      const g = mando !== null ? leerMando(mando) : null;
      if (g) { e.x = Math.max(-1, Math.min(1, e.x + g.x)); e.y = Math.max(-1, Math.min(1, e.y + g.y)); for (const b of ['pina', 'patada', 'guardia', 'poder', 'arma', 'super']) e[b] = e[b] || g[b]; }
      return e;
    },
    destruir() { removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); removeEventListener('blur', blur); },
  };
}
function tactil(raiz) {
  const e = { x: 0, y: 0 };
  raiz.insertAdjacentHTML('beforeend', `<div class="pf-tactil"><div class="pf-joy"><i></i></div><div class="pf-btns">
    <button data-b="poder">Poder</button><button data-b="arma">Arma</button><button data-b="super">Súper</button>
    <button data-b="pina">Piña</button><button data-b="patada">Patada</button><button data-b="guardia">Cubre</button></div></div>`);
  const joy = raiz.querySelector('.pf-joy');
  const mover = (ev) => {
    const r = joy.getBoundingClientRect();
    let x = (ev.clientX - r.left - r.width / 2) / (r.width / 2), y = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    e.x = Math.abs(x) > .3 ? Math.sign(x) : 0; e.y = Math.abs(y) > .55 ? Math.sign(y) : 0;
    joy.querySelector('i').style.transform = `translate(${x * 34}px,${y * 34}px)`;
  };
  joy.addEventListener('pointerdown', (ev) => { joy.setPointerCapture(ev.pointerId); mover(ev); });
  joy.addEventListener('pointermove', (ev) => ev.buttons && mover(ev));
  joy.addEventListener('pointerup', () => { e.x = e.y = 0; joy.querySelector('i').style.transform = ''; });
  raiz.querySelectorAll('[data-b]').forEach((b) => {
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); e[b.dataset.b] = true; b.classList.add('on'); });
    for (const n of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(n, () => { e[b.dataset.b] = false; b.classList.remove('on'); });
  });
  return e;
}
const sumar = (a, b) => {
  const s = { x: Math.max(-1, Math.min(1, a.x + b.x)), y: Math.max(-1, Math.min(1, a.y + b.y)) };
  for (const k of ['pina', 'patada', 'guardia', 'poder', 'arma', 'super']) s[k] = !!(a[k] || b[k]);
  return s;
};

const AYUDA_SOLO = '<kbd>A</kbd><kbd>D</kbd> moverse · <kbd>W</kbd> saltar · <kbd>S</kbd> agacharse · <kbd>J</kbd> piña · <kbd>K</kbd> patada · <kbd>L</kbd> cubrirse · <kbd>U</kbd> poder · <kbd>I</kbd> arma · <kbd>O</kbd> súper · <kbd>Esc</kbd> pausa';

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Piña Final · cadalado';
  app.innerHTML = `
  <div class="menu pf-menu">
    <div class="menu-hero"><div><span class="etq">Pelea 2D con los personajes del club</span><h1>Piña <em>Final.</em></h1>
      <p>Piñas, patadas, combos, katanas, shurikens y bolas de fuego. En cada ronda te toca un elemento y un arma al azar. Al final, rematalo.</p>
      <div class="pf-chips"><span>1 contra 1</span><span>2 contra 2</span><span>Bots del club</span><span>Online con amigos</span></div></div></div>
    <section class="panel">
      ${cuenta ? '' : `<h2>Tu nombre</h2><input class="entrada" data-nombre maxlength="20" value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?" style="margin-bottom:18px">`}
      <h2>Elegí cómo pelear</h2>
      <div class="pf-modos">
        <a class="pf-modo" href="/pelea/bots" data-ir><b>Contra bots</b><span>Vos contra el club. 1v1, o 2v2 con un bot de compañero.</span><small>Fácil, normal o difícil</small></a>
        <a class="pf-modo" href="/pelea/local" data-ir><b>2 jugadores (misma compu)</b><span>Uno contra otro en el mismo teclado, o con joysticks.</span><small>J1: WASD + F G H / R T Y · J2: flechas + J K L / U I O</small></a>
        <form class="pf-modo" data-crear><b>Sala online</b><span>Armá una sala, mandá el link y peleen 1v1 o 2v2. Los bots completan los lugares.</span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
          <label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="publica" checked style="accent-color:${COLOR_JUEGO}"> Pública</label>
          <button class="btn btn-lima">Crear sala</button></span></form>
      </div>
    </section>
    <section class="panel">
      <h2>Unirse a una sala</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Unirme</button></form>
      <h2 style="margin-top:22px">Salas abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
      <h2 style="margin-top:22px">Cómo se juega</h2>
      <div class="pf-teclas">
        <span><kbd>A</kbd> <kbd>D</kbd></span><span>Moverse (para atrás, sin cubrirse)</span>
        <span><kbd>W</kbd> <kbd>S</kbd></span><span>Saltar · agacharse</span>
        <span><kbd>J</kbd> <kbd>J</kbd> <kbd>J</kbd></span><span>Combo de piñas · <kbd>S</kbd>+<kbd>J</kbd> gancho que levanta</span>
        <span><kbd>K</kbd></span><span>Patada · <kbd>S</kbd>+<kbd>K</kbd> barrida que tira al piso</span>
        <span><kbd>L</kbd></span><span>Cubrirse (agachado para las barridas)</span>
        <span><kbd>U</kbd></span><span>Poder del elemento (se puede cortar un combo con él)</span>
        <span><kbd>I</kbd></span><span>Golpe con el arma</span>
        <span><kbd>O</kbd></span><span>Súper (con la barra llena) y el remate final</span>
      </div>
      <div class="pf-elementos">${Object.values(ELEMENTOS).map((e) => `<span style="--c:${e.color}">${e.emoji} ${e.nombre}</span>`).join('')}</div>
      <div class="pf-elementos">${Object.values(ARMAS).map((a) => `<span style="--c:#c9c2b4">${a.nombre}</span>`).join('')}</div>
    </section>
  </div>`;
  const nombre = () => app.querySelector('[data-nombre]')?.value.trim();
  app.querySelector('[data-nombre]')?.addEventListener('change', () => guardarNombre(nombre()));
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(nombre());
    try {
      const { code } = await api('/api/pelea/crear', { pid: pid(), nombre: nombre(), opciones: { publica: f.get('publica') === 'on', luchador: leer('pelea.luchador', azarDe(ROSTER)) } });
      ir(`/pelea/sala/${code}`);
    } catch (err) { toast(err.message, true); }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/pelea/sala/${c}`);
  };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/pelea/lobby');
      const el = app.querySelector('[data-salas]');
      if (!el) return;
      el.innerHTML = salas.length
        ? salas.map((s) => `<a class="sala-fila" href="/pelea/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR_JUEGO}">${s.jugadores}</span>
          <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Armando equipos' : s.fase === 'fin' ? 'Terminando' : 'Peleando ahora'} · ${s.modo}</small></span>
          <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay salas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- selección de luchador (local)
const seg = (nombre, op, valor, opciones) => `<div class="pf-grupo"><span>${nombre}</span><div class="pf-seg" data-op="${op}">${opciones.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(valor) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
function seleccion({ dos }) {
  document.title = (dos ? '2 jugadores' : 'Contra bots') + ' · Piña Final';
  const conf = {
    modo: leer('pelea.modo', '1v1'), dif: Number(leer('pelea.dif', 1)), rondas: Number(leer('pelea.rondas', 3)), escenario: leer('pelea.escenario', 'azar'), tiempo: Number(leer('pelea.tiempo', 90)),
  };
  let p1 = leer('pelea.luchador', null), p2 = null, turno = 1;
  if (!ROSTER.includes(p1)) p1 = null;
  let hover1 = p1 || ROSTER[0], hover2 = ROSTER[1];
  const pintar = () => {
    const lado = (n, id, etiqueta) => `<div class="pf-lado p${n}"><img src="${foto(id)}" alt=""><b>${esc(nombreNpc(id))}</b><small>${etiqueta}</small></div>`;
    app.innerHTML = `<div class="pf-sel">
      <h2>Elegí tu luchador</h2>
      ${lado(1, p1 || hover1, dos ? 'Jugador 1' : 'Vos')}
      <div class="pf-medio">
        <div class="pf-grilla">${ROSTER.map((id) => `<button class="pf-cara ${(p1 || hover1) === id ? 'p1' : ''} ${dos && (p2 || (turno === 2 ? hover2 : null)) === id ? 'p2' : ''}" data-id="${id}"><img src="${foto(id)}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}
          <button class="pf-cara azar" data-id="azar" title="Al azar">?</button></div>
        <div class="pf-opciones">
          ${seg('Modo', 'modo', conf.modo, [['1v1', '1 vs 1'], ['2v2', '2 vs 2']])}
          ${dos ? '' : seg('Bots', 'dif', conf.dif, [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']])}
          ${seg('Rondas', 'rondas', conf.rondas, [[1, '1'], [3, '3'], [5, '5']])}
          ${seg('Tiempo', 'tiempo', conf.tiempo, [[60, '60'], [90, '90'], [0, '∞']])}
          ${seg('Escenario', 'escenario', conf.escenario, [['azar', 'Al azar'], ...ESCENARIOS.map((e) => [e.id, e.nombre.replace('El ', '').replace('La ', '')])])}
        </div>
        <p class="pf-ayuda">${dos ? (turno === 1 && !p1 ? 'Elige el <b style="color:var(--rojo-eq)">Jugador 1</b>' : 'Elige el <b style="color:var(--azul-eq)">Jugador 2</b>') : 'Clic o Enter para elegir. Tu rival y los demás salen al azar.'}${conf.modo === '2v2' ? ' En 2v2, cada uno tiene un bot de compañero.' : ''}</p>
        <div class="pf-listo"><a class="btn btn-borde" href="/pelea/" data-ir>Volver</a>${p1 && (!dos || p2) ? '<button class="btn btn-lima btn-grande" data-pelear>¡A pelear!</button>' : ''}</div>
      </div>
      ${dos ? lado(2, p2 || hover2, 'Jugador 2') : `<div class="pf-lado p2"><img src="${foto(hover2)}" alt="" style="filter:brightness(.25)"><b>???</b><small>Tu rival sale al azar</small></div>`}
    </div>`;
    app.querySelectorAll('.pf-cara').forEach((b) => {
      b.onmouseenter = () => { if (b.dataset.id === 'azar') return; if (turno === 1 && !p1) hover1 = b.dataset.id; else if (dos) hover2 = b.dataset.id; actualizarLados(); };
      b.onclick = () => elegir(b.dataset.id === 'azar' ? azarDe(ROSTER) : b.dataset.id);
    });
    app.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      const op = s.dataset.op, v = b.dataset.v;
      conf[op] = ['dif', 'rondas', 'tiempo'].includes(op) ? Number(v) : v;
      guardar('pelea.' + op, v); sfx('cursor'); pintar();
    })));
    app.querySelector('[data-pelear]')?.addEventListener('click', arrancar);
  };
  const actualizarLados = () => {
    const l1 = app.querySelector('.pf-lado.p1'), l2 = app.querySelector('.pf-lado.p2');
    const id1 = p1 || hover1;
    l1.querySelector('img').src = foto(id1); l1.querySelector('b').textContent = nombreNpc(id1);
    if (dos) { const id2 = p2 || hover2; l2.querySelector('img').src = foto(id2); l2.querySelector('b').textContent = nombreNpc(id2); }
    app.querySelectorAll('.pf-cara').forEach((b) => { b.classList.toggle('p1', b.dataset.id === id1); b.classList.toggle('p2', dos && b.dataset.id === (p2 || (turno === 2 ? hover2 : null))); });
    sfx('cursor');
  };
  const elegir = (id) => {
    sfx('elegir');
    if (!p1) { p1 = id; guardar('pelea.luchador', id); locutor(nombreNpc(id)); if (dos) turno = 2; }
    else if (dos && !p2) { p2 = id; locutor(nombreNpc(id)); }
    else if (!dos) { p1 = id; guardar('pelea.luchador', id); locutor(nombreNpc(id)); }
    pintar();
  };
  const arrancar = () => {
    const usados = new Set([p1, p2]);
    const otro = () => { const libres = ROSTER.filter((x) => !usados.has(x)); const id = azarDe(libres.length ? libres : ROSTER); usados.add(id); return id; };
    const yo = nombreGuardado() || cuenta?.nombre || 'Vos';
    const luch = [{ id: 'p1', eq: 0, npc: p1, nombre: dos ? nombreNpc(p1) : nombreNpc(p1), humano: 'p1' }];
    if (conf.modo === '2v2') luch.push({ id: 'b0', eq: 0, npc: otro(), bot: true });
    luch.push(dos ? { id: 'p2', eq: 1, npc: p2, nombre: nombreNpc(p2), humano: 'p2' } : { id: 'b1', eq: 1, npc: otro(), bot: true });
    if (conf.modo === '2v2') luch.push({ id: 'b2', eq: 1, npc: otro(), bot: true });
    for (const l of luch) l.nombre ??= nombreNpc(l.npc);
    luch[0].jugador = dos ? 'J1' : yo;
    if (dos) luch.find((l) => l.id === 'p2').jugador = 'J2';
    const escenario = conf.escenario === 'azar' ? azarDe(ESCENARIOS).id : conf.escenario;
    limpiar.forEach((f) => f()); limpiar = []; // suelta el teclado de la grilla
    pelearLocal({ luch, conf: { ...conf, escenario }, dos, alVolver: () => { limpiar.forEach((f) => f()); limpiar = []; document.body.classList.remove('en-pelea'); seleccion({ dos }); } });
  };
  const tecla = (e) => {
    if (e.target.closest?.('input')) return;
    const i = ROSTER.indexOf(turno === 2 && dos ? hover2 : hover1);
    const grilla = app.querySelector('.pf-grilla');
    if (!grilla) return;
    const cols = Math.max(1, Math.round(grilla.clientWidth / 84));
    const mover = { ArrowRight: 1, KeyD: 1, ArrowLeft: -1, KeyA: -1, ArrowDown: cols, KeyS: cols, ArrowUp: -cols, KeyW: -cols }[e.code];
    if (mover) { e.preventDefault(); const n = ROSTER[(i + mover + ROSTER.length) % ROSTER.length]; if (turno === 2 && dos) hover2 = n; else hover1 = n; actualizarLados(); }
    if (e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'Space') { e.preventDefault(); if (p1 && (!dos || p2)) arrancar(); else elegir(turno === 2 && dos ? hover2 : hover1); }
  };
  addEventListener('keydown', tecla);
  limpiar.push(() => removeEventListener('keydown', tecla));
  pintar();
}

// ---------------------------------------------------------------- pantalla de pelea (común)
function htmlPelea() {
  return `<div class="pf">
    <canvas class="pf-lienzo"></canvas>
    <div class="pf-hud"><div class="pf-equipo izq" data-eq="0"></div><div class="pf-centro"><div class="pf-reloj" data-reloj>90</div><div class="pf-rondas" data-rondas></div></div><div class="pf-equipo der" data-eq="1"></div></div>
    <button class="pf-boton-menu" data-menu>Pausa · Esc</button>
    <div class="pf-poderes" data-poderes></div>
    <div class="pf-anuncio" data-anuncio></div>
    <div class="pf-pie" data-pie></div>
    <div class="pf-cargando" data-cargando>Preparando el ring…</div>
    <div class="pf-capa hidden" data-capa></div>
  </div>`;
}

function crearHud(raiz, luch) {
  for (const eq of [0, 1]) {
    raiz.querySelector(`[data-eq="${eq}"]`).innerHTML = luch.filter((l) => l.eq === eq).map((l) => `
      <div class="pf-barra" data-l="${esc(l.id)}" style="--c:${COLOR_EQ[eq]}">
        <div class="pf-foto"><img src="${foto(l.npc)}" alt=""></div>
        <div class="pf-info"><div class="pf-nombre">${esc(l.nombre)}${l.jugador ? ` <small style="color:${COLOR_EQ[eq]}">${esc(l.jugador)}</small>` : ''}<small data-elem></small></div>
          <div class="pf-vida"><i class="rastro" style="width:100%"></i><i class="resto" style="width:100%"></i></div>
          <div class="pf-ene"><i></i></div></div>
      </div>`).join('');
  }
  let anuncioN = 0, rondaPintada = -1, anuncioT = 0;
  const barras = new Map(luch.map((l) => [l.id, raiz.querySelector(`[data-l="${CSS.escape(l.id)}"]`)]));
  return (v) => {
    for (const f of v.luch) {
      const b = barras.get(f.id);
      if (!b) continue;
      const pc = Math.max(0, f.vida) + '%';
      const resto = b.querySelector('.resto'), rastro = b.querySelector('.rastro');
      if (resto.style.width !== pc) { resto.style.width = pc; rastro.style.width = pc; }
      b.querySelector('.pf-vida').classList.toggle('baja', f.vida < 30);
      const E = ELEMENTOS[f.elem];
      b.style.setProperty('--e', E?.color);
      const el = b.querySelector('[data-elem]');
      const txt = `${E?.emoji || ''} ${E?.nombre || ''} · ${ARMAS[f.arma]?.nombre || ''}`;
      if (el.textContent !== txt) el.textContent = txt;
      const ene = b.querySelector('.pf-ene');
      ene.querySelector('i').style.width = Math.min(100, f.ene) + '%';
      ene.classList.toggle('lleno', f.ene >= 100);
      b.classList.toggle('ko', !!f.ko);
    }
    const reloj = raiz.querySelector('[data-reloj]');
    const s = v.tiempo > 5000 ? '∞' : String(Math.ceil(v.tiempo));
    if (reloj.textContent !== s) reloj.textContent = s;
    const nec = Math.ceil((v.mejorDe || 3) / 2);
    const rk = `${v.victorias}|${nec}`;
    if (rk !== rondaPintada) {
      rondaPintada = rk;
      raiz.querySelector('[data-rondas]').innerHTML = [0, 1].map((eq) => `<div>${Array.from({ length: nec }, (_, i) => `<i class="${v.victorias[eq] > i ? 'si' : ''}"></i>`).join('')}</div>`).join('');
    }
    // anuncio grande
    const a = v.anuncio;
    const caja = raiz.querySelector('[data-anuncio]');
    if (a && a.n !== anuncioN) {
      anuncioN = a.n; anuncioT = performance.now();
      caja.className = 'pf-anuncio ' + (a.tipo || '');
      const E = a.tipo === 'remate' && v.remate ? ELEMENTOS[v.remate.elem] : null;
      if (E) caja.style.setProperty('--e', E.color);
      caja.innerHTML = `<b>${esc(a.texto)}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ''}`;
      if (a.tipo === 'ronda') sfx('gong');
      locutor(a.texto);
    }
    const dura = { ronda: 1700, peleen: 1000, ko: 1500, rematalo: 2800, remate: 3500, gana: 2200, campeon: 999999 }[a?.tipo] ?? 2000;
    caja.classList.toggle('sale', !a || performance.now() - anuncioT > dura);
    // poderes de cada lado (abajo)
    const pod = raiz.querySelector('[data-poderes]');
    const html = [0, 1].map((eq) => `<div>${v.luch.filter((f) => f.eq === eq).map((f) => { const E = ELEMENTOS[f.elem]; return `<span style="--e:${E.color}"><em>${E.emoji} ${E.nombre}</em> · ${ARMAS[f.arma].nombre}</span>`; }).join('')}</div>`).join('');
    if (pod.dataset.h !== html) { pod.dataset.h = html; pod.innerHTML = html; }
  };
}

// ---------------------------------------------------------------- pelea local (bots o 2 jugadores)
async function pelearLocal({ luch, conf, dos, alVolver }) {
  document.body.classList.add('en-pelea');
  app.innerHTML = htmlPelea();
  const $ = (s) => app.querySelector(s);
  const lienzo = $('.pf-lienzo');
  const escena = crearEscena(lienzo, { escenario: conf.escenario });
  const tec = teclado(), toque = tactil($('.pf'));
  $('[data-pie]').innerHTML = dos
    ? 'J1: <kbd>WASD</kbd> <kbd>F</kbd><kbd>G</kbd><kbd>H</kbd> piña patada cubre · <kbd>R</kbd><kbd>T</kbd><kbd>Y</kbd> poder arma súper &nbsp;|&nbsp; J2: flechas <kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> · <kbd>U</kbd><kbd>I</kbd><kbd>O</kbd> (o el numpad 1-6)'
    : AYUDA_SOLO;
  let pausa = false, c = null, raf = 0, viva = true;
  limpiar.push(() => { viva = false; cancelAnimationFrame(raf); tec.destruir(); escena.destruir(); speechSynthesis?.cancel?.(); });
  await escena.ponerLuchadores(luch, { carteles: luch.length > 2 }).catch(() => {});
  if (!viva) return;
  $('[data-cargando]').classList.add('hidden');
  const hud = crearHud(app, luch);
  const nueva = () => { c = crearCombate({ luchadores: luch, mejorDe: conf.rondas, tiempo: conf.tiempo }); escena.reiniciarRonda(); rondaVista = c.ronda; finMostrado = false; };
  let rondaVista = 0, finMostrado = false;
  nueva();
  const capa = $('[data-capa]');
  const menuPausa = () => {
    pausa = true;
    capa.classList.remove('hidden');
    capa.innerHTML = `<div class="pf-caja"><h2>Pausa</h2><p>${AYUDA_SOLO}</p><div class="pf-opc">
      <button data-a="seguir"><b>▶ Seguir</b><small>Volver a la pelea.</small></button>
      <button data-a="otra"><b>↻ Empezar de nuevo</b><small>Misma pelea desde la ronda 1.</small></button>
      <button data-a="elegir"><b>☰ Elegir otros luchadores</b><small>Volver a la grilla.</small></button>
      <button data-a="sonido"><b>♪ Sonido</b><small>${leer('cadalado.audio', '') === 'silencio' ? 'Apagado' : 'Prendido'}</small></button>
      <button data-a="locutor"><b>🎙 Locutor</b><small>${leer('pelea.locutor', 'si') === 'no' ? 'Callado' : 'Habla'}</small></button>
      <button data-a="sangre"><b>🩸 Sangre</b><small>${leer('pelea.sangre', 'si') === 'no' ? 'Sin sangre' : 'Con sangre'}</small></button>
      <a href="/pelea/" data-ir><b>↩ Salir</b><small>Volver al menú de Piña Final.</small></a></div></div>`;
    capa.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'seguir') { capa.classList.add('hidden'); pausa = false; }
      if (a === 'otra') { capa.classList.add('hidden'); pausa = false; nueva(); }
      if (a === 'elegir') alVolver();
      if (a === 'sonido') { guardar('cadalado.audio', leer('cadalado.audio', '') === 'silencio' ? 'activo' : 'silencio'); menuPausa(); }
      if (a === 'locutor') { guardar('pelea.locutor', leer('pelea.locutor', 'si') === 'no' ? 'si' : 'no'); menuPausa(); }
      if (a === 'sangre') { guardar('pelea.sangre', leer('pelea.sangre', 'si') === 'no' ? 'si' : 'no'); menuPausa(); }
    }));
  };
  const tecla = (e) => { if (e.code === 'Escape' && !document.querySelector('.cj-capa, .en-capa')) { e.preventDefault(); e.stopPropagation(); pausa ? (capa.classList.add('hidden'), (pausa = false)) : menuPausa(); } };
  addEventListener('keydown', tecla, true);
  limpiar.push(() => removeEventListener('keydown', tecla, true));
  $('[data-menu]').onclick = menuPausa;
  const finPanel = () => {
    const gana = c.ganador;
    const yoGane = !dos && gana === 0;
    capa.classList.remove('hidden');
    capa.innerHTML = `<div class="pf-caja"><div class="pf-festejo"><b>${gana === null ? '¡Empate!' : dos ? `¡Ganó ${gana === 0 ? 'el Jugador 1' : 'el Jugador 2'}!` : yoGane ? '¡Ganaste!' : 'Perdiste…'}</b><span>${c.victorias[0]} a ${c.victorias[1]} en rondas</span></div>
      <div class="pf-opc"><button data-a="otra"><b>↻ Revancha</b><small>Los mismos luchadores, elementos nuevos.</small></button>
      <button data-a="elegir"><b>☰ Elegir otros</b><small>Volver a la grilla de luchadores.</small></button>
      <a href="/pelea/" data-ir><b>↩ Menú</b><small>Volver al menú de Piña Final.</small></a></div></div>`;
    capa.querySelector('[data-a="otra"]').onclick = () => { capa.classList.add('hidden'); nueva(); };
    capa.querySelector('[data-a="elegir"]').onclick = alVolver;
  };
  let acum = 0, antes = performance.now();
  const entradas = new Map();
  const cuadro = (ms) => {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - antes) / 1000); antes = ms;
    if (!pausa) {
      acum += dt;
      while (acum >= PASO) {
        acum -= PASO;
        for (const l of luch) {
          const f = c.m.luch.find((x) => x.id === l.id);
          if (l.humano === 'p1') entradas.set(l.id, sumar(tec.leer(dos ? 'j1' : 'solo', 0), toque));
          else if (l.humano === 'p2') entradas.set(l.id, tec.leer('j2', 1));
          else entradas.set(l.id, pensarBot(c.m, f, conf.dif ?? 1));
        }
        pasoCombate(c, entradas);
        if (c.ronda !== rondaVista) { rondaVista = c.ronda; escena.limpiarRemate(); escena.reiniciarRonda(); }
      }
      if (c.fase === 'fin' && c.t > 4.5 && !finMostrado) { finMostrado = true; finPanel(); }
    }
    const v = vistaDe(c);
    escena.actualizar(v, pausa ? 0 : dt);
    hud(v);
  };
  raf = requestAnimationFrame(cuadro);
  window.__pelea = { get combate() { return c; }, escena };
}

// ---------------------------------------------------------------- online
function abrirSala(code) {
  document.title = `Piña Final ${code} · cadalado`;
  document.body.classList.add('en-pelea');
  app.innerHTML = htmlPelea();
  const $ = (s) => app.querySelector(s);
  $('.pf').insertAdjacentHTML('beforeend', '<div class="pf-chat"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat… (Enter)" autocomplete="off"></form></div>');
  $('[data-cargando]').textContent = 'Entrando a la sala…';
  const lienzo = $('.pf-lienzo');
  const tec = teclado(), toque = tactil($('.pf'));
  $('[data-pie]').innerHTML = AYUDA_SOLO;
  let est = null, escena = null, escenaDe = '', luch = [], hud = null, c = null, vista = null, peleaN = -1, rondaVista = 0, avisado = false;
  const entradas = new Map();
  const yoId = () => est?.yo;
  const participa = () => est?.participantes?.includes(est.yo);
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id);
    return online.includes(est.host) ? est.host : online.sort()[0];
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;
  const nombreDe = (id) => est?.jugadores.find((j) => j.id === id)?.nombre || '—';

  function recibir(id, s) {
    if (typeof s !== 'string') return;
    if (s[0] === 'M') {
      if (soyAnfitrion() || id !== idAnfitrion()) return;
      const d = decodificar(s);
      if (d) vista = d;
    } else if (s[0] === 'I' && soyAnfitrion()) entradas.set(id, decodificarEntrada(s));
  }
  const red = { actual: null };
  window.__reiniciar = { puede: () => !!est && est.host === est.yo && est.fase !== 'lobby', hacer: () => sala.enviar({ t: 'reiniciar' }) };
  const sala = new Sala('/api/pelea', code, {
    intervalo: (e) => (e?.fase === 'pelea' ? 1000 : 900),
    onEstado: (e) => {
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: () => {}, ruta: '/api/pelea', accionPlanB: 'mensaje' });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      if (e.fase === 'pelea' && e.peleaN !== peleaN) empezarPelea();
      if (e.fase !== 'pelea') pintarPanel();
      else $('[data-capa]').classList.add('hidden');
      $('[data-cargando]').classList.add('hidden');
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) { d.className = 'sis'; d.textContent = ev.texto; } else { if (ev.bot) d.className = 'bot'; d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`; }
      log.append(d);
      while (log.children.length > 30) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => toast(m, true),
    onNoExiste: () => { toast('Esa sala no existe.', true); ir('/pelea/'); },
  });
  recordar('pelea', `/pelea/sala/${code}`, `Piña Final ${code}`);
  $('[data-chat]').onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector('input'); if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value }); i.value = ''; i.blur(); };
  const abrirChat = (e) => { if (e.code === 'Enter' && !e.target.closest?.('input, select, textarea') && est?.fase !== 'pelea') { e.preventDefault(); $('[data-chat] input').focus(); } };
  addEventListener('keydown', abrirChat);

  // los luchadores de esta pelea: personas (en su equipo, con el personaje que eligieron) y bots
  function armarLuchadores() {
    return [
      ...est.participantes.map((id) => ({ id, eq: est.equipos[id] === 'b' ? 1 : 0, npc: est.luchador[id] || ROSTER[0], nombre: nombreNpc(est.luchador[id]), jugador: nombreDe(id) })),
      ...est.botNpc.map((npc, i) => ({ id: 'bot' + i, eq: est.botEq[i], npc, nombre: nombreNpc(npc), bot: true, jugador: 'bot' })),
    ];
  }
  async function empezarPelea() {
    peleaN = est.peleaN; avisado = false; vista = null; c = null; rondaVista = 0;
    luch = armarLuchadores();
    if (!escena || escenaDe !== est.escenario) { escena?.destruir(); escena = crearEscena(lienzo, { escenario: est.escenario }); escenaDe = est.escenario; }
    $('[data-cargando]').classList.remove('hidden'); $('[data-cargando]').textContent = 'Preparando el ring…';
    await escena.ponerLuchadores(luch, { carteles: true }).catch(() => {});
    escena.reiniciarRonda();
    $('[data-cargando]').classList.add('hidden');
    hud = crearHud(app, luch);
    if (soyAnfitrion()) c = crearCombate({ luchadores: luch, mejorDe: est.mejorDe, tiempo: est.tiempo });
  }

  function pintarPanel() {
    if (!est) return;
    const capa = $('[data-capa]');
    capa.classList.remove('hidden');
    const host = est.host === est.yo;
    const tam = est.modo === '2v2' ? 2 : 1;
    const de = (eq) => est.jugadores.filter((j) => j.online && est.equipos[j.id] === eq);
    const fila = (j) => `<li><img src="${foto(est.luchador[j.id] || ROSTER[0])}" alt="">${esc(j.nombre)}${j.id === est.yo ? ' (vos)' : ''}${j.id === est.host ? ' ★' : ''}<em>${esc(nombreNpc(est.luchador[j.id]))}</em></li>`;
    const bots = (eq) => Math.max(0, tam - de(eq).length);
    const mio = est.luchador[est.yo];
    const fin = est.fase === 'fin';
    const html = `<div class="pf-caja">
      ${fin ? `<div class="pf-festejo"><b>${est.ganador === null ? '¡Empate!' : `¡Ganó el equipo ${est.ganador === 0 ? 'Rojo' : 'Azul'}!`}</b><span>${esc(est.resumen || '')}</span></div>` : ''}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h2 style="margin-right:auto">Sala ${code}</h2>
        <button class="btn btn-chico" data-copiar>Copiar link</button><a class="btn btn-chico btn-borde" href="/pelea/" data-ir>Salir</a></div>
      <div class="pf-equipos">
        ${['a', 'b'].map((eq, k) => `<div class="pf-eq" style="--c:${COLOR_EQ[k]}"><h3>Equipo ${k ? 'Azul' : 'Rojo'} <small>${de(eq).length}/${tam}</small></h3>
          <ul>${de(eq).map(fila).join('')}${Array.from({ length: bots(eq) }, () => '<li><img src="" alt="" style="opacity:.3"><span style="color:#8d9483">Bot del club (al azar)</span></li>').join('')}</ul>
          ${est.equipos[est.yo] === eq ? '<small style="color:#c5f04a;font-weight:700">Estás acá</small>' : `<button class="btn btn-chico" data-eq="${eq}">Pasarme acá</button>`}</div>`).join('')}
      </div>
      <p style="margin:0">Mirando: ${est.jugadores.filter((j) => j.online && est.equipos[j.id] === 'afuera').map((j) => esc(j.nombre)).join(', ') || 'nadie'} ${est.equipos[est.yo] !== 'afuera' ? '<button class="btn btn-chico btn-borde" data-eq="afuera">Solo mirar</button>' : ''}</p>
      <h3 style="margin:14px 0 0;font:900 18px 'Barlow Condensed',sans-serif;text-transform:uppercase">Tu luchador: <span style="color:var(--pf)">${esc(nombreNpc(mio))}</span></h3>
      <div class="pf-mini">${ROSTER.map((id) => `<button class="pf-cara ${mio === id ? 'p1' : ''}" data-luch="${id}"><img src="${foto(id)}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}</div>
      <div class="pf-opciones">
        ${seg('Modo', 'modo', est.modo, [['1v1', '1 vs 1'], ['2v2', '2 vs 2']])}
        ${seg('Rondas', 'mejorDe', est.mejorDe, [[1, '1'], [3, '3'], [5, '5']])}
        ${seg('Tiempo', 'tiempo', est.tiempo, [[60, '60'], [90, '90'], [0, '∞']])}
        ${seg('Bots', 'dificultad', est.dificultad, [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']])}
        ${seg('Escenario', 'escenario', est.escenario, ESCENARIOS.map((e) => [e.id, e.nombre.replace('El ', '').replace('La ', '')]))}
      </div>
      ${host ? `<div class="pf-listo"><button class="btn btn-lima btn-grande" data-empezar>${fin ? 'Revancha' : '¡A pelear!'}</button></div>` : '<p class="pf-ayuda">Esperando que el anfitrión (★) arranque la pelea…</p>'}
      <p class="pf-ayuda">Los elementos y las armas se sortean en cada ronda.</p>
    </div>`;
    if (capa.dataset.firma === html) return;
    if (capa.contains(document.activeElement) && document.activeElement.matches('input')) return;
    capa.dataset.firma = html; capa.innerHTML = html;
    capa.querySelector('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado'); };
    capa.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'equipo', e: b.dataset.eq })));
    capa.querySelectorAll('[data-luch]').forEach((b) => (b.onclick = () => { guardar('pelea.luchador', b.dataset.luch); sfx('elegir'); sala.enviar({ t: 'luchador', id: b.dataset.luch }); }));
    capa.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => {
      b.disabled = !host;
      b.onclick = () => sala.enviar({ t: 'config', [s.dataset.op]: ['mejorDe', 'tiempo', 'dificultad'].includes(s.dataset.op) ? Number(b.dataset.v) : b.dataset.v });
    }));
    capa.querySelector('[data-empezar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
  }

  // simulación del anfitrión (aparte del dibujo, con reloj real)
  let acum = 0, ultSim = performance.now(), envio = 0, enviado = 0;
  const miEntrada = () => sumar(tec.leer('solo', 0), toque);
  function simular() {
    const ahora = performance.now();
    const dt = Math.min(.5, (ahora - ultSim) / 1000); ultSim = ahora;
    if (!est || est.fase !== 'pelea' || !soyAnfitrion() || !luch.length) { acum = 0; return; }
    if (!c) {
      // el anfitrión anterior se fue: sigo desde lo último que vi
      c = crearCombate({ luchadores: luch, mejorDe: est.mejorDe, tiempo: est.tiempo });
      if (vista) { c.victorias = [...vista.victorias]; c.ronda = vista.ronda; }
    }
    if (participa()) entradas.set(est.yo, miEntrada());
    acum += dt;
    while (acum >= PASO) {
      acum -= PASO;
      const e = new Map();
      for (const l of luch) {
        const f = c.m.luch.find((x) => x.id === l.id);
        e.set(l.id, l.bot ? pensarBot(c.m, f, est.dificultad) : entradas.get(l.id) || { x: 0, y: 0 });
      }
      pasoCombate(c, e);
    }
    if (ahora - envio > 50) { envio = ahora; red.actual?.enviar(codificar(c)); }
    if (c.fase === 'fin' && c.t > 4.5 && !avisado) {
      avisado = true;
      sala.enviar({ t: 'resultado', n: est.peleaN, ganador: c.ganador, victorias: c.victorias });
    }
  }
  const sim = setInterval(simular, 1000 / 60);

  let raf, antes = performance.now();
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - antes) / 1000); antes = ms;
    if (!escena) return;
    let v = null;
    if (est?.fase === 'pelea') {
      if (soyAnfitrion() && c) v = vistaDe(c);
      else {
        v = vista;
        if (participa() && ms - enviado > 33) { enviado = ms; red.actual?.enviar(codificarEntrada(miEntrada())); }
      }
    }
    if (v) {
      if (v.ronda !== rondaVista) { rondaVista = v.ronda; escena.limpiarRemate(); escena.reiniciarRonda(); }
      escena.actualizar(v, dt); hud?.(v);
    } else escena.actualizar(null, dt);
  }
  raf = requestAnimationFrame(cuadro);
  // el dibujo arranca con el escenario de la sala aunque todavía no haya pelea
  const esperarEscena = setInterval(() => { if (est && !escena) { escena = crearEscena(lienzo, { escenario: est.escenario }); escenaDe = est.escenario; } }, 300);
  const tecla = (e) => { if (e.code === 'Escape' && est?.fase === 'pelea' && !document.querySelector('.cj-capa, .en-capa')) { e.preventDefault(); e.stopPropagation(); const cp = $('[data-capa]'); if (!cp.classList.contains('hidden')) { cp.classList.add('hidden'); return; } cp.classList.remove('hidden'); cp.innerHTML = `<div class="pf-caja"><h2>Menú</h2><p>La pelea sigue mientras mirás esto.</p><div class="pf-opc"><button data-x><b>▶ Volver</b></button>${est.host === est.yo ? '<button data-terminar><b>■ Terminar la pelea</b><small>Vuelven todos a la sala.</small></button>' : ''}<a href="/pelea/" data-ir><b>↩ Salir de la sala</b></a></div></div>`; cp.querySelector('[data-x]').onclick = () => cp.classList.add('hidden'); cp.querySelector('[data-terminar]')?.addEventListener('click', () => { sala.enviar({ t: 'reiniciar' }); cp.classList.add('hidden'); }); } };
  addEventListener('keydown', tecla, true);
  $('[data-menu]').onclick = () => tecla({ code: 'Escape', preventDefault() {}, stopPropagation() {}, target: document.body });
  window.__pelea = { get estado() { return est; }, get combate() { return c; }, get vista() { return vista; } };
  limpiar.push(() => { sala.cerrar(); red.actual?.cerrar(); cancelAnimationFrame(raf); clearInterval(sim); clearInterval(esperarEscena); tec.destruir(); escena?.destruir(); removeEventListener('keydown', tecla, true); removeEventListener('keydown', abrirChat); delete window.__reiniciar; });
}

ruteo();
