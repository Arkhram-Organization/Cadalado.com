// Empujón: todos contra todos (o por equipos, de 1v1 a 4v4) arriba de una plataforma que flota sobre la ciudad.
// Con los personajes 3D del club. Contra bots o en salas online donde se entra en cualquier momento.
// Online: el anfitrión simula la ronda y la manda por WebRTC; cada uno manda sus teclas (como los otros juegos).
import { Sala, marco, api, pid, esc, toast, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { NPCS, POR_ID } from '/comun/npcs.js';
import { Red } from '/comun/red.js';
import { crearEscena, COLOR_EQ, colorDe, MAPAS_LISTA } from './escena.js';
import { nuevaPartida, paso, PASO, agregarJugador, quitarJugador, buscar, codificar, decodificar, codificarEntrada, decodificarEntrada, NIVELES } from './motor.js';
import { sfx } from './sonido.js';

const app = document.querySelector('#app');
const COLOR_JUEGO = '#ff8a3a';
const cuenta = await marco({ juego: 'Empujón', color: COLOR_JUEGO, volver: '/empujon/' });
// los personajes salen solos del club (los que tienen modelo 3D): si se suma uno, aparece acá
const ROSTER = NPCS.filter((n) => n.look?.modelo).map((n) => n.id);
const foto = (id) => `/img/tienda/${id}.webp`;
const nombreNpc = (id) => POR_ID[id]?.nombre || id;
const azarDe = (a) => a[Math.floor(Math.random() * a.length)];
const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const NOMBRE_EQ = ['Rojo', 'Azul'];
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let limpiar = [];
addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.npc || img.dataset.cara) return;
  img.dataset.cara = '1';
  import('/comun/caras3d.js').then(({ caraRedonda }) => caraRedonda({ ...POR_ID[img.dataset.npc]?.look }, 256)).then((c) => { img.src = c.toDataURL(); img.style.objectFit = 'contain'; }).catch(() => {});
}, true);

function ir(ruta) { history.pushState(null, '', ruta); ruteo(); }
addEventListener('popstate', ruteo);
app.addEventListener('click', (e) => { const a = e.target.closest('a[data-ir]'); if (!a) return; e.preventDefault(); ir(a.getAttribute('href')); });
function ruteo() {
  limpiar.forEach((f) => f()); limpiar = [];
  document.body.classList.remove('en-cancha');
  const m = location.pathname.match(/^\/empujon\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else if (/^\/empujon\/bots/.test(location.pathname)) armado();
  else menu();
}

// ---------------------------------------------------------------- controles (teclado, mouse, joystick, táctil)
function controles(raiz) {
  const t = new Set(); let mouse = { izq: false, der: false };
  const abajo = (e) => { if (e.target.closest?.('input, select, textarea')) return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); t.add(e.code); };
  const arriba = (e) => t.delete(e.code);
  const blur = () => { t.clear(); mouse = { izq: false, der: false }; };
  const md = (e) => { if (!e.target.closest?.('canvas')) return; if (e.button === 0) mouse.izq = true; if (e.button === 2) mouse.der = true; };
  const mu = (e) => { if (e.button === 0) mouse.izq = false; if (e.button === 2) mouse.der = false; };
  const menuCtx = (e) => { if (e.target.closest?.('canvas')) e.preventDefault(); };
  addEventListener('keydown', abajo); addEventListener('keyup', arriba); addEventListener('blur', blur);
  addEventListener('mousedown', md); addEventListener('mouseup', mu); addEventListener('contextmenu', menuCtx);
  // táctil
  const tc = { x: 0, y: 0 };
  raiz.insertAdjacentHTML('beforeend', `<div class="fu-tactil"><div class="fu-joy"><i></i></div><div class="fu-btns em-btns"><button data-b="salto">Saltar</button><button data-b="agarrar">Agarrar</button><button data-b="empujar">Empujar</button></div></div>`);
  const joy = raiz.querySelector('.fu-joy');
  const mover = (ev) => { const r = joy.getBoundingClientRect(); let x = (ev.clientX - r.left - r.width / 2) / (r.width / 2), y = (ev.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } tc.x = x; tc.y = y; joy.querySelector('i').style.transform = `translate(${x * 34}px,${y * 34}px)`; };
  joy.addEventListener('pointerdown', (ev) => { joy.setPointerCapture(ev.pointerId); mover(ev); });
  joy.addEventListener('pointermove', (ev) => ev.buttons && mover(ev));
  joy.addEventListener('pointerup', () => { tc.x = tc.y = 0; joy.querySelector('i').style.transform = ''; });
  raiz.querySelectorAll('[data-b]').forEach((b) => {
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); tc[b.dataset.b] = true; b.classList.add('on'); });
    for (const n of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(n, () => { tc[b.dataset.b] = false; b.classList.remove('on'); });
  });
  const algun = (l) => l.some((k) => t.has(k));
  return {
    leer() {
      let x = (algun(['KeyD', 'ArrowRight']) ? 1 : 0) - (algun(['KeyA', 'ArrowLeft']) ? 1 : 0) + tc.x;
      let z = (algun(['KeyS', 'ArrowDown']) ? 1 : 0) - (algun(['KeyW', 'ArrowUp']) ? 1 : 0) + tc.y;
      const e = { empujar: algun(['KeyJ', 'KeyZ']) || mouse.izq || !!tc.empujar, agarrar: algun(['KeyK', 'KeyX']) || mouse.der || !!tc.agarrar, salto: algun(['Space', 'KeyL']) || !!tc.salto };
      const g = navigator.getGamepads?.()[0];
      if (g) { const b = (n) => !!g.buttons[n]?.pressed; if (Math.abs(g.axes[0]) > .25) x += g.axes[0]; if (Math.abs(g.axes[1]) > .25) z += g.axes[1]; e.empujar ||= b(2) || b(7); e.agarrar ||= b(1) || b(6); e.salto ||= b(0); }
      e.x = Math.max(-1, Math.min(1, x)); e.z = Math.max(-1, Math.min(1, z));
      return e;
    },
    destruir() { removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); removeEventListener('blur', blur); removeEventListener('mousedown', md); removeEventListener('mouseup', mu); removeEventListener('contextmenu', menuCtx); },
  };
}
const AYUDA = '<kbd>WASD</kbd> moverse · <kbd>J</kbd> o <b>clic</b> empujar (mantené = más fuerte) · <kbd>K</kbd> o <b>clic der.</b> agarrar (soltá para revolear) · <kbd>Espacio</kbd> saltar · <kbd>Esc</kbd> menú';

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Empujón · cadalado';
  app.innerHTML = `
  <div class="menu em-menu">
    <div class="menu-hero"><div><span class="etq">Todos contra todos, arriba de la ciudad</span><h1><em>Empujón.</em></h1>
      <p>Empujá, agarrá y revoleá a los demás afuera de la plataforma. Cada uno que tirás te hace más grande. El que va primero lleva la corona: tirarlo vale doble. Al final, el piso se achica.</p>
      <div class="pf-chips"><span>Hasta 20 por sala</span><span>Equipos de 1v1 a 4v4</span><span>Rondas de 3 minutos</span><span>Entrás cuando quieras</span></div></div></div>
    <section class="panel">
      ${cuenta ? '' : `<h2>Tu nombre</h2><input class="entrada" data-nombre maxlength="20" value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?" style="margin-bottom:18px">`}
      <h2>Jugar</h2>
      <div class="pf-modos">
        <form class="pf-modo" data-crear><b>Sala online</b><span>Armá la sala y pasale el link a todos: entran cuando quieran, hasta 20. Los bots completan.</span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
          <label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="publica" checked style="accent-color:${COLOR_JUEGO}"> Pública</label>
          <button class="btn btn-lima">Crear sala</button></span></form>
        <a class="pf-modo" href="/empujon/bots" data-ir><b>Contra bots</b><span>Para practicar: vos contra los personajes del club.</span><small>Todos contra todos o por equipos</small></a>
      </div>
    </section>
    <section class="panel">
      <h2>Unirse a una sala</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Unirme</button></form>
      <h2 style="margin-top:22px">Salas abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
      <h2 style="margin-top:22px">Cómo se juega</h2>
      <div class="pf-teclas">
        <span><kbd>WASD</kbd></span><span>Moverse</span>
        <span><kbd>J</kbd> / clic</span><span>Empujar. Mantené para cargarlo y soltá: sale mucho más fuerte</span>
        <span><kbd>K</kbd> / clic der.</span><span>Agarrar al de enfrente: mientras lo tenés, llevalo al borde y soltá para revolearlo</span>
        <span><kbd>Espacio</kbd></span><span>Saltar (para esquivar)</span>
        <span>Agarrado</span><span>Apretá cualquier botón varias veces para zafarte</span>
        <span>🥊 🍌 💣</span><span>Guante gigante, cáscara de banana y bomba: agarralos del piso</span>
      </div>
    </section>
  </div>`;
  const nombre = () => app.querySelector('[data-nombre]')?.value.trim();
  app.querySelector('[data-nombre]')?.addEventListener('change', () => guardarNombre(nombre()));
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    if (!cuenta) guardarNombre(nombre());
    try { const { code } = await api('/api/empujon/crear', { pid: pid(), nombre: nombre(), opciones: { publica: new FormData(e.target).get('publica') === 'on', personaje: leer('empujon.personaje', azarDe(ROSTER)) } }); ir(`/empujon/sala/${code}`); } catch (err) { toast(err.message, true); }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => { e.preventDefault(); const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, ''); if (c) ir(`/empujon/sala/${c}`); };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/empujon/lobby');
      const el = app.querySelector('[data-salas]'); if (!el) return;
      el.innerHTML = salas.length ? salas.map((s) => `<a class="sala-fila" href="/empujon/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR_JUEGO}">${s.jugadores}</span><span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'juego' ? 'Jugando ahora (podés entrar)' : 'Esperando'} · ${s.modo === 'equipos' ? `${s.tamEq}v${s.tamEq}` : 'todos contra todos'}</small></span><span class="btn btn-chico btn-lima">Entrar</span></a>`).join('') : '<div class="vacio">No hay salas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar(); const t = setInterval(cargar, 5000); limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- armar la partida contra bots
const seg = (nombre, op, valor, opciones, deshab = false) => `<div class="pf-grupo"><span>${nombre}</span><div class="pf-seg" data-op="${op}">${opciones.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(valor) ? 'on' : ''}" ${deshab ? 'disabled' : ''}>${t}</button>`).join('')}</div></div>`;
function armado() {
  document.title = 'Contra bots · Empujón';
  const conf = { modo: leer('empujon.modo', 'todos'), bots: Number(leer('empujon.bots', 7)), tamEq: Number(leer('empujon.tamEq', 2)), mapa: leer('empujon.mapa', 'terraza'), minutos: Number(leer('empujon.minutos', 3)), dif: Number(leer('empujon.dif', 1)) };
  let yo = ROSTER.includes(leer('empujon.personaje', '')) ? leer('empujon.personaje', '') : null;
  const pintar = () => {
    app.innerHTML = `<div class="pf-sel em-sel"><h2>Elegí tu personaje</h2>
      <div class="pf-lado p1"><img src="${foto(yo || ROSTER[0])}" data-npc="${yo || ROSTER[0]}" alt=""><b>${esc(nombreNpc(yo || ROSTER[0]))}</b><small>Vos</small></div>
      <div class="pf-medio">
        <div class="pf-grilla">${ROSTER.map((id) => `<button class="pf-cara ${yo === id ? 'p1' : ''}" data-id="${id}"><img src="${foto(id)}" data-npc="${id}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}<button class="pf-cara azar" data-id="azar">?</button></div>
        <div class="pf-opciones">
          ${seg('Modo', 'modo', conf.modo, [['todos', 'Todos contra todos'], ['equipos', 'Por equipos']])}
          ${conf.modo === 'equipos' ? seg('Equipos', 'tamEq', conf.tamEq, [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4']]) : seg('Bots', 'bots', conf.bots, [[3, '3'], [7, '7'], [11, '11'], [19, '19']])}
          ${seg('Mapa', 'mapa', conf.mapa, MAPAS_LISTA.map((m) => [m.id, m.nombre]))}
          ${seg('Minutos', 'minutos', conf.minutos, [[2, '2'], [3, '3'], [5, '5']])}
          ${seg('Nivel de los bots', 'dif', conf.dif, NIVELES.map((n, i) => [i, n.nombre]))}
        </div>
        <div class="pf-listo"><a class="btn btn-borde" href="/empujon/" data-ir>Volver</a>${yo ? '<button class="btn btn-lima btn-grande" data-jugar>¡A empujar!</button>' : ''}</div>
      </div>
      <div class="pf-lado p2"><img src="${foto(ROSTER[1])}" alt="" style="filter:brightness(.25)"><b>???</b><small>Los rivales salen al azar</small></div></div>`;
    app.querySelectorAll('.pf-cara').forEach((b) => (b.onclick = () => { yo = b.dataset.id === 'azar' ? azarDe(ROSTER) : b.dataset.id; guardar('empujon.personaje', yo); sfx('elegir'); pintar(); }));
    app.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => { const op = s.dataset.op; conf[op] = ['modo', 'mapa'].includes(op) ? b.dataset.v : Number(b.dataset.v); guardar('empujon.' + op, b.dataset.v); sfx('cursor'); pintar(); })));
    app.querySelector('[data-jugar]')?.addEventListener('click', () => {
      const usados = new Set([yo]);
      const otro = () => { const l = ROSTER.filter((x) => !usados.has(x)); const id = azarDe(l.length ? l : ROSTER); usados.add(id); return id; };
      const lista = [{ id: 'yo', npc: yo, nombre: nombreGuardado() || cuenta?.nombre || 'Vos', humano: true, eq: 0 }];
      if (conf.modo === 'equipos') { for (let i = 1; i < conf.tamEq; i++) lista.push({ id: 'b' + lista.length, npc: otro(), bot: true, eq: 0 }); for (let i = 0; i < conf.tamEq; i++) lista.push({ id: 'b' + lista.length, npc: otro(), bot: true, eq: 1 }); }
      else for (let i = 0; i < conf.bots; i++) lista.push({ id: 'b' + i, npc: otro(), bot: true });
      limpiar.forEach((f) => f()); limpiar = [];
      jugarLocal({ conf, lista, alVolver: () => { limpiar.forEach((f) => f()); limpiar = []; document.body.classList.remove('en-cancha'); armado(); } });
    });
  };
  pintar();
}

// ---------------------------------------------------------------- pantalla de juego (común)
function htmlJuego() {
  return `<div class="pf fu em">
    <canvas class="pf-lienzo"></canvas>
    <div class="em-arriba"><time data-reloj>3:00</time><div class="em-marcador hidden" data-marcador></div></div>
    <ol class="em-ranking" data-ranking></ol>
    <div class="em-feed" data-feed></div>
    <div class="em-centro" data-centro></div>
    <div class="em-yo" data-yo></div>
    <button class="pf-boton-menu fu-boton" data-menu>Menú · Esc</button>
    <div class="pf-pie" data-pie>${AYUDA}</div>
    <div class="pf-cargando" data-cargando>Subiendo a la terraza…</div>
    <div class="pf-capa hidden" data-capa></div>
  </div>`;
}
function crearHud(raiz, info) {
  const $ = (s) => raiz.querySelector(s);
  let visto = 0, centroT = 0, cuentaVista = -1;
  const nombre = (id) => { const i = info.get(id); return i ? (i.humano ? i.nombre : nombreNpc(i.npc)) : '?'; };
  const centro = (html, clase = '') => { const el = $('[data-centro]'); el.className = 'em-centro on ' + clase; el.innerHTML = html; centroT = performance.now(); };
  return (v, yoId) => {
    $('[data-reloj]').textContent = v.fase === 'cuenta' ? mmss(v.tiempo) : mmss(Math.max(0, v.tiempo));
    $('[data-reloj]').classList.toggle('apurado', v.fase === 'juego' && v.area < .999);
    // marcador de equipos
    const mk = $('[data-marcador]');
    mk.classList.toggle('hidden', v.modo !== 'equipos');
    if (v.modo === 'equipos') mk.innerHTML = `<b style="color:${COLOR_EQ[0]}">${v.marcador[0]}</b><i>-</i><b style="color:${COLOR_EQ[1]}">${v.marcador[1]}</b>`;
    // ranking en vivo (top 5 y vos)
    const orden = [...v.jug].sort((a, b) => b.puntos - a.puntos || a.caidas - b.caidas);
    const top = orden.slice(0, 5); const mio = orden.findIndex((j) => j.id === yoId);
    const fila = (j, i) => `<li class="${j.id === yoId ? 'yo' : ''}"><span>${i + 1}</span><i style="background:${colorDe(j)}"></i><b>${esc(nombre(j.id))}${j.corona ? ' 👑' : ''}</b><em>${j.puntos}</em></li>`;
    const html = top.map(fila).join('') + (mio >= 5 ? `<li class="sep">…</li>${fila(orden[mio], mio)}` : '');
    const rk = $('[data-ranking]'); if (rk.dataset.h !== html) { rk.dataset.h = html; rk.innerHTML = html; }
    // tu jugador
    const yo = v.jug.find((j) => j.id === yoId);
    $('[data-yo]').innerHTML = yo ? `<b>${esc(nombre(yo.id))}</b><span>${yo.puntos} tiradas · tamaño ${Math.round((yo.escala || 1) * 100)}%</span>${yo.est === 'carga' ? `<div class="em-carga"><i style="width:${Math.round(yo.carga * 100)}%"></i></div>` : ''}${yo.est === 'agarrado' ? '<span class="zafa">¡Apretá botones para zafarte!</span>' : ''}` : '';
    // cuenta regresiva
    if (v.fase === 'cuenta') { const n = Math.ceil(3 - v.faseT); if (n !== cuentaVista && n > 0) { cuentaVista = n; centro(`<b>${n}</b>`, 'grande'); sfx('cursor'); } }
    // avisos
    for (const e of v.ev || []) {
      if (e.n <= visto) continue;
      visto = e.n;
      if (e.k === 'arranca') centro('<b>¡A EMPUJAR!</b>', 'grande');
      else if (e.k === 'achica') centro('<b>¡SE ACHICA!</b><small>La plataforma se hace más chica</small>', 'rojo');
      else if (e.k === 'tirada') {
        const feed = $('[data-feed]');
        const d = document.createElement('div'); d.innerHTML = `<b>${esc(nombre(e.a))}</b> tiró a <b>${esc(nombre(e.b))}</b>${e.corona ? ' 👑 +2' : ''}`; feed.prepend(d);
        while (feed.children.length > 4) feed.lastChild.remove();
        setTimeout(() => d.classList.add('sale'), 3500);
        if (e.a === yoId) centro(`<b>¡TIRASTE A ${esc(nombre(e.b).toUpperCase())}!</b><small>${e.corona ? '¡Le sacaste la corona! +2' : '+1'}${e.racha >= 3 ? ` · ¡${e.racha} seguidos!` : ''}</small>`, 'verde');
        else if (e.b === yoId) centro(`<b>¡TE TIRÓ ${esc(nombre(e.a).toUpperCase())}!</b>`, 'rojo');
      } else if (e.k === 'cayo' && e.b === yoId) centro('<b>¡TE CAÍSTE SOLO!</b>', 'rojo');
      else if (e.k === 'objeto' && e.a === yoId) centro(`<b>${{ guante: '🥊 ¡GUANTE GIGANTE!', banana: '🍌 ¡CÁSCARA!', bomba: '💣 ¡BOMBA!' }[e.tipo]}</b>`, 'chico');
    }
    if (performance.now() - centroT > 1600) $('[data-centro]').classList.remove('on');
  };
}
function panelFin(capa, v, info, yoId, { botones }) {
  const nombre = (id) => { const i = info.get(id); return i ? (i.humano ? i.nombre : nombreNpc(i.npc)) : '?'; };
  const ranking = v.ranking?.length ? v.ranking : [...v.jug].sort((a, b) => b.puntos - a.puntos).map((j) => ({ id: j.id, puntos: j.puntos, caidas: j.caidas }));
  const podio = ranking.slice(0, 3);
  const titulo = v.modo === 'equipos' ? (v.ganadorEq === null ? '¡Empate!' : `¡Ganó el equipo ${NOMBRE_EQ[v.ganadorEq]}!`) : `¡Ganó ${esc(nombre(podio[0]?.id))}!`;
  capa.classList.remove('hidden');
  capa.innerHTML = `<div class="pf-caja em-fin"><div class="pf-festejo"><b>${titulo}</b>${v.modo === 'equipos' ? `<span>${v.marcador[0]} a ${v.marcador[1]}</span>` : ''}</div>
    <div class="em-podio">${podio.map((r, i) => { const inf = info.get(r.id); return `<div class="p${i + 1}"><img src="${foto(inf?.npc || ROSTER[0])}" data-npc="${inf?.npc || ROSTER[0]}" alt=""><b>${['🥇', '🥈', '🥉'][i]} ${esc(nombre(r.id))}</b><span>${r.puntos} tiradas</span></div>`; }).join('')}</div>
    <ol class="em-tabla">${ranking.slice(0, 20).map((r, i) => `<li class="${r.id === yoId ? 'yo' : ''}"><span>${i + 1}</span><b>${esc(nombre(r.id))}</b><em>${r.puntos} tiradas · ${r.caidas} caídas</em></li>`).join('')}</ol>
    <div class="pf-opc">${botones}</div></div>`;
}

// ---------------------------------------------------------------- partida local contra bots
async function jugarLocal({ conf, lista, alVolver }) {
  document.body.classList.add('en-cancha');
  app.innerHTML = htmlJuego();
  const $ = (s) => app.querySelector(s);
  const escena = crearEscena($('.pf-lienzo'), { mapa: conf.mapa });
  const ctl = controles($('.pf'));
  const info = new Map(lista.map((l) => [l.id, l]));
  let m = null, pausa = false, raf = 0, viva = true, finMostrado = false;
  const nueva = () => { m = nuevaPartida({ mapa: conf.mapa, jugadores: lista, minutos: conf.minutos, dificultad: conf.dif, modo: conf.modo }); finMostrado = false; $('[data-capa]').classList.add('hidden'); };
  nueva();
  limpiar.push(() => { viva = false; cancelAnimationFrame(raf); ctl.destruir(); escena.destruir(); });
  await escena.armar(lista).catch(() => {});
  if (!viva) return;
  $('[data-cargando]').classList.add('hidden');
  const hud = crearHud(app, info);
  const capa = $('[data-capa]');
  const menuPausa = () => {
    pausa = true; capa.classList.remove('hidden');
    capa.innerHTML = `<div class="pf-caja"><h2>Pausa</h2><p>${AYUDA}</p><div class="pf-opc"><button data-a="seguir"><b>▶ Seguir</b></button><button data-a="otra"><b>↻ Empezar de nuevo</b></button><button data-a="elegir"><b>☰ Cambiar personaje y modo</b></button><a href="/empujon/" data-ir><b>↩ Salir</b></a></div></div>`;
    capa.querySelector('[data-a="seguir"]').onclick = () => { capa.classList.add('hidden'); pausa = false; };
    capa.querySelector('[data-a="otra"]').onclick = () => { pausa = false; nueva(); };
    capa.querySelector('[data-a="elegir"]').onclick = alVolver;
  };
  const tecla = (e) => { if (e.code === 'Escape' && !document.querySelector('.cj-capa, .en-capa')) { e.preventDefault(); e.stopPropagation(); pausa ? (capa.classList.add('hidden'), (pausa = false)) : menuPausa(); } };
  addEventListener('keydown', tecla, true); limpiar.push(() => removeEventListener('keydown', tecla, true));
  $('[data-menu]').onclick = menuPausa;
  let acum = 0, antes = performance.now();
  const cuadro = (ms) => {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - antes) / 1000); antes = ms;
    if (!pausa) {
      acum += dt;
      while (acum >= PASO) { acum -= PASO; paso(m, new Map([['yo', ctl.leer()]])); }
      if (m.fase === 'fin' && m.faseT > 4 && !finMostrado) {
        finMostrado = true;
        panelFin(capa, m, info, 'yo', { botones: '<button data-a="otra"><b>↻ Revancha</b></button><button data-a="elegir"><b>☰ Cambiar personaje y modo</b></button><a href="/empujon/" data-ir><b>↩ Menú</b></a>' });
        capa.querySelector('[data-a="otra"]').onclick = nueva; capa.querySelector('[data-a="elegir"]').onclick = alVolver;
      }
    }
    escena.actualizar(m, pausa ? 0 : dt, { mios: ['yo'] });
    hud(m, 'yo');
  };
  raf = requestAnimationFrame(cuadro);
  window.__empujon = { get partida() { return m; }, escena };
}

// ---------------------------------------------------------------- sala online (se entra en cualquier momento)
function abrirSala(code) {
  document.title = `Empujón ${code} · cadalado`;
  document.body.classList.add('en-cancha');
  app.innerHTML = htmlJuego();
  const $ = (s) => app.querySelector(s);
  $('.pf').insertAdjacentHTML('beforeend', '<div class="pf-chat fu-chat"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat… (Enter)" autocomplete="off"></form></div>');
  $('[data-cargando]').textContent = 'Entrando a la sala…';
  const ctl = controles($('.pf'));
  let est = null, escena = null, escenaMapa = '', m = null, vista = null, base = null, partidaN = -1, hud = null, avisado = false;
  const info = new Map();
  const entradas = new Map();
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id);
    return online.includes(est.host) ? est.host : online.sort()[0];
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;
  const nombreDe = (id) => est?.jugadores.find((j) => j.id === id)?.nombre || '—';
  function recibir(id, s) {
    if (typeof s !== 'string') return;
    if (s[0] === 'M') { if (soyAnfitrion() || id !== idAnfitrion() || !base) return; const d = decodificar(s, base); if (d) vista = d; }
    else if (s[0] === 'I' && soyAnfitrion()) entradas.set(id, decodificarEntrada(s));
  }
  const red = { actual: null };
  window.__reiniciar = { puede: () => !!est && est.host === est.yo && est.fase !== 'lobby', hacer: () => sala.enviar({ t: 'reiniciar' }) };
  // quiénes juegan ahora (personas y bots) con su personaje y equipo
  function actualizarInfo() {
    for (const p of est.participantes) info.set(p, { id: p, npc: est.personaje[p] || ROSTER[0], nombre: nombreDe(p), humano: true, eq: est.equipos[p] === 'azul' ? 1 : 0 });
    for (const b of est.botList || []) info.set(b.id, { id: b.id, npc: b.npc, bot: true, eq: b.eq });
  }
  const sala = new Sala('/api/empujon', code, {
    intervalo: (e) => (e?.fase === 'juego' ? 1000 : 900),
    onEstado: async (e) => {
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: () => {}, ruta: '/api/empujon', accionPlanB: 'mensaje' });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      actualizarInfo();
      if (e.fase === 'juego') {
        $('[data-capa]').classList.add('hidden');
        if (e.partidaN !== partidaN) await empezar();
        else sincronizar();
      } else pintarPanel();
      $('[data-cargando]').classList.add('hidden');
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k !== 'chat') return;
      const log = $('[data-log]'); const d = document.createElement('div');
      if (ev.sistema) { d.className = 'sis'; d.textContent = ev.texto; } else { if (ev.bot) d.className = 'bot'; d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`; }
      log.append(d); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
    },
    onError: (msg) => toast(msg, true),
    onNoExiste: () => { toast('Esa sala no existe.', true); ir('/empujon/'); },
  });
  recordar('empujon', `/empujon/sala/${code}`, `Empujón ${code}`);
  $('[data-chat]').onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector('input'); if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value }); i.value = ''; i.blur(); };
  const abrirChat = (e) => { if (e.code === 'Enter' && !e.target.closest?.('input, select, textarea') && est?.fase !== 'juego') { e.preventDefault(); $('[data-chat] input').focus(); } };
  addEventListener('keydown', abrirChat);

  const enJuego = () => [...est.participantes, ...(est.botList || []).map((b) => b.id)];
  async function empezar() {
    partidaN = est.partidaN; avisado = false; vista = null;
    if (!escena || escenaMapa !== est.mapa) { escena?.destruir(); const lz = $('.pf-lienzo'), nuevo = lz.cloneNode(); lz.replaceWith(nuevo); escena = crearEscena(nuevo, { mapa: est.mapa }); escenaMapa = est.mapa; }
    m = nuevaPartida({ mapa: est.mapa, jugadores: enJuego().map((id) => ({ id, bot: !!info.get(id)?.bot, eq: info.get(id)?.eq })), minutos: est.minutos, dificultad: est.dificultad, modo: est.modo });
    base = m;
    await escena.armar(enJuego().map((id) => info.get(id))).catch(() => {});
    hud = crearHud(app, info);
  }
  // alguien entró o se fue a mitad de la ronda: el anfitrión lo suma o lo saca
  function sincronizar() {
    if (!m) return;
    const ids = enJuego();
    escena?.armar(ids.map((id) => info.get(id)).filter(Boolean));
    if (!soyAnfitrion()) return;
    const offline = new Set(est.jugadores.filter((j) => !j.online).map((j) => j.id));
    for (const id of ids) if (!buscar(m, id) && !offline.has(id)) agregarJugador(m, { id, bot: !!info.get(id)?.bot, eq: info.get(id)?.eq });
    for (const j of [...m.jug]) if (!ids.includes(j.id) || offline.has(j.id)) quitarJugador(m, j.id);
  }

  function pintarPanel() {
    if (!est) return;
    const capa = $('[data-capa]'); capa.classList.remove('hidden');
    const host = est.host === est.yo, eqs = est.modo === 'equipos';
    const fin = est.fase === 'fin';
    const gente = (eq) => est.jugadores.filter((j) => j.online && est.equipos[j.id] === eq);
    const fila = (j) => `<li><img src="${foto(est.personaje[j.id] || ROSTER[0])}" data-npc="${est.personaje[j.id] || ROSTER[0]}" alt="">${esc(j.nombre)}${j.id === est.yo ? ' (vos)' : ''}${j.id === est.host ? ' ★' : ''}<em>${esc(nombreNpc(est.personaje[j.id]))}</em></li>`;
    const mio = est.personaje[est.yo];
    const res = fin && est.resultado ? `<div class="pf-festejo"><b>${est.resultado.titulo ? esc(est.resultado.titulo) : '¡Terminó!'}</b><span>${(est.resultado.top || []).map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(r.nombre)} (${r.puntos})`).join(' · ')}</span></div>` : '';
    const html = `<div class="pf-caja">${res}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h2 style="margin-right:auto">Sala ${code}</h2><button class="btn btn-chico" data-copiar>Copiar link</button><a class="btn btn-chico btn-borde" href="/empujon/" data-ir>Salir</a></div>
      ${eqs ? `<div class="pf-equipos">${['rojo', 'azul'].map((eq, k) => `<div class="pf-eq" style="--c:${COLOR_EQ[k]}"><h3>Equipo ${NOMBRE_EQ[k]} <small>${gente(eq).length}/${est.tamEq}</small></h3><ul>${gente(eq).map(fila).join('')}${gente(eq).length < est.tamEq ? `<li><span style="color:#8d9483">+ ${est.tamEq - gente(eq).length} bots</span></li>` : ''}</ul>${est.equipos[est.yo] === eq ? '<small style="color:#c5f04a;font-weight:700">Estás acá</small>' : `<button class="btn btn-chico" data-eq="${eq}">Pasarme acá</button>`}</div>`).join('')}</div>`
        : `<div class="pf-eq" style="--c:${COLOR_JUEGO};margin:12px 0"><h3>Jugadores <small>${gente('juega').length}/20 · + ${est.bots} bots</small></h3><ul class="em-lista">${gente('juega').map(fila).join('')}</ul></div>`}
      <h3 style="margin:10px 0 0;font:900 18px 'Barlow Condensed',sans-serif;text-transform:uppercase">Tu personaje: <span style="color:${COLOR_JUEGO}">${esc(nombreNpc(mio))}</span></h3>
      <div class="pf-mini">${ROSTER.map((id) => `<button class="pf-cara ${mio === id ? 'p1' : ''}" data-pj="${id}"><img src="${foto(id)}" data-npc="${id}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}</div>
      <div class="pf-opciones">
        ${seg('Modo', 'modo', est.modo, [['todos', 'Todos contra todos'], ['equipos', 'Por equipos']], !host)}
        ${eqs ? seg('Equipos', 'tamEq', est.tamEq, [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4']], !host) : seg('Bots', 'bots', est.bots, [[0, '0'], [3, '3'], [7, '7'], [11, '11'], [19, '19']], !host)}
        ${seg('Mapa', 'mapa', est.mapa, MAPAS_LISTA.map((x) => [x.id, x.nombre]), !host)}
        ${seg('Minutos', 'minutos', est.minutos, [[2, '2'], [3, '3'], [5, '5']], !host)}
        ${seg('Nivel de los bots', 'dificultad', est.dificultad, NIVELES.map((n, i) => [i, n.nombre]), !host)}
      </div>
      ${host ? `<div class="pf-listo"><button class="btn btn-lima btn-grande" data-empezar>${fin ? 'Otra ronda' : '¡A empujar!'}</button></div>` : '<p class="pf-ayuda">Esperando que el anfitrión (★) arranque. Si ya está jugando, entrás directo.</p>'}
    </div>`;
    if (capa.dataset.firma === html) return;
    if (capa.contains(document.activeElement) && document.activeElement.matches('input')) return;
    capa.dataset.firma = html; capa.innerHTML = html;
    capa.querySelector('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado'); };
    capa.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'equipo', e: b.dataset.eq })));
    capa.querySelectorAll('[data-pj]').forEach((b) => (b.onclick = () => { guardar('empujon.personaje', b.dataset.pj); sfx('elegir'); sala.enviar({ t: 'personaje', id: b.dataset.pj }); }));
    capa.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => { const op = s.dataset.op; sala.enviar({ t: 'config', [op]: ['modo', 'mapa'].includes(op) ? b.dataset.v : Number(b.dataset.v) }); })));
    capa.querySelector('[data-empezar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
  }

  let acum = 0, ultSim = performance.now(), envio = 0, enviado = 0;
  function simular() {
    const ahora = performance.now(), dt = Math.min(.5, (ahora - ultSim) / 1000); ultSim = ahora;
    if (!est || est.fase !== 'juego' || !soyAnfitrion() || !m) { acum = 0; return; }
    if (vista && !m.tomado) { m.tomado = true; m.tiempo = vista.tiempo; m.fase = vista.fase; for (const j of vista.jug) { const x = buscar(m, j.id); if (x) Object.assign(x, { x: j.x, z: j.z, puntos: j.puntos, caidas: j.caidas, escala: j.escala }); } }
    if (est.participantes.includes(est.yo)) entradas.set(est.yo, ctl.leer());
    acum += dt;
    while (acum >= PASO) { acum -= PASO; paso(m, entradas); }
    if (ahora - envio > 50) { envio = ahora; red.actual?.enviar(codificar(m)); }
    if (m.fase === 'fin' && m.faseT > 6 && !avisado) {
      avisado = true;
      const nombre = (id) => { const i = info.get(id); return i?.humano ? i.nombre : nombreNpc(i?.npc); };
      const top = m.ranking.slice(0, 3).map((r) => ({ nombre: nombre(r.id), puntos: r.puntos }));
      const titulo = m.modo === 'equipos' ? (m.ganadorEq === null ? '¡Empate!' : `¡Ganó el equipo ${NOMBRE_EQ[m.ganadorEq]}!`) : `¡Ganó ${top[0]?.nombre || ''}!`;
      sala.enviar({ t: 'resultado', n: est.partidaN, ranking: m.ranking.filter((r) => est.participantes.includes(r.id)).map((r, i) => ({ id: r.id, puntos: r.puntos, puesto: m.ranking.findIndex((x) => x.id === r.id) + 1 })), marcador: m.marcador, ganadorEq: m.ganadorEq, titulo, top });
    }
  }
  const sim = setInterval(simular, 1000 / 60);
  let raf, antes = performance.now(), finVisto = false;
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - antes) / 1000); antes = ms;
    if (!escena) return;
    let v = null;
    if (est?.fase === 'juego') {
      v = soyAnfitrion() ? m : vista;
      if (!soyAnfitrion() && est.participantes.includes(est.yo) && ms - enviado > 33) { enviado = ms; red.actual?.enviar(codificarEntrada(ctl.leer())); }
    }
    if (v) {
      const desconocidos = v.jug.filter((j) => !info.has(j.id));
      if (desconocidos.length) actualizarInfo();
      escena.actualizar(v, dt, { mios: [est.yo] }); hud?.(v, est.yo);
      if (v.fase === 'fin' && v.faseT > 4 && !finVisto) { finVisto = true; panelFin($('[data-capa]'), v, info, est.yo, { botones: '<p class="pf-ayuda">En un ratito arranca otra ronda (la arranca el anfitrión).</p>' }); }
      if (v.fase !== 'fin') finVisto = false;
    } else escena.actualizar(null, dt);
  }
  raf = requestAnimationFrame(cuadro);
  const esperarEscena = setInterval(() => { if (est && !escena) { escena = crearEscena($('.pf-lienzo'), { mapa: est.mapa }); escenaMapa = est.mapa; } }, 300);
  const tecla = (e) => {
    if (e.code === 'Escape' && est?.fase === 'juego' && !document.querySelector('.cj-capa, .en-capa')) {
      e.preventDefault(); e.stopPropagation();
      const cp = $('[data-capa]'); if (!cp.classList.contains('hidden')) { cp.classList.add('hidden'); return; }
      cp.classList.remove('hidden');
      cp.innerHTML = `<div class="pf-caja"><h2>Menú</h2><p>La ronda sigue mientras mirás esto.</p><div class="pf-opc"><button data-x><b>▶ Volver</b></button><button data-copiar><b>↗ Copiar link para invitar</b></button>${est.host === est.yo ? '<button data-terminar><b>■ Cortar la ronda</b><small>Vuelven todos a la sala.</small></button>' : ''}<a href="/empujon/" data-ir><b>↩ Salir de la sala</b></a></div></div>`;
      cp.querySelector('[data-x]').onclick = () => cp.classList.add('hidden');
      cp.querySelector('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado'); };
      cp.querySelector('[data-terminar]')?.addEventListener('click', () => { sala.enviar({ t: 'reiniciar' }); cp.classList.add('hidden'); });
    }
  };
  addEventListener('keydown', tecla, true);
  $('[data-menu]').onclick = () => tecla({ code: 'Escape', preventDefault() {}, stopPropagation() {}, target: document.body });
  window.__empujon = { get estado() { return est; }, get partida() { return m; }, get vista() { return vista; } };
  limpiar.push(() => { sala.cerrar(); red.actual?.cerrar(); cancelAnimationFrame(raf); clearInterval(sim); clearInterval(esperarEscena); ctl.destruir(); escena?.destruir(); removeEventListener('keydown', tecla, true); removeEventListener('keydown', abrirChat); delete window.__reiniciar; });
}

ruteo();
