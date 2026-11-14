// La Canchita: fútbol 5 a fútbol 8 en 3D con los personajes del club.
// Modos: contra bots, 2 jugadores en la misma compu y salas online (rojo contra azul, los bots completan).
// Online: el anfitrión simula el partido y lo manda por WebRTC; cada uno manda sus teclas (como el haxball).
import { Sala, marco, api, pid, esc, toast, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { NPCS, POR_ID, rngNpc } from '/comun/npcs.js';
import { Red } from '/comun/red.js';
import { crearEscena, CANCHAS, COLOR_EQ } from './escena.js';
import { nuevoPartido, paso, PASO, codificar, decodificar, codificarEntrada, decodificarEntrada, armarEquipo, TRUCOS, ROLES } from './motor.js';
import { sfx, tribuna, relator } from './sonido.js';

const app = document.querySelector('#app');
const COLOR_JUEGO = '#5ae07a';
const cuenta = await marco({ juego: 'La Canchita', color: COLOR_JUEGO, volver: '/futbol/' });
// los jugadores salen solos de los personajes del club con modelo 3D (si suman uno, aparece acá)
const ROSTER = NPCS.filter((n) => n.look?.modelo).map((n) => n.id);
const foto = (id) => `/img/tienda/${id}.webp`;
const nombreNpc = (id) => POR_ID[id]?.nombre || id;
const azarDe = (a) => a[Math.floor(Math.random() * a.length)];
const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const NOMBRE_EQ = ['Rojo', 'Azul'];
const mmss = (s) => (Number.isFinite(s) ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '∞');
let limpiar = [];
// si un personaje nuevo todavía no tiene foto, se dibuja su cara con el modelo
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
  tribuna(false);
  const m = location.pathname.match(/^\/futbol\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else if (/^\/futbol\/bots/.test(location.pathname)) armado({ dos: false });
  else if (/^\/futbol\/local/.test(location.pathname)) armado({ dos: true });
  else menu();
}

// ---------------------------------------------------------------- controles
const TECLAS = {
  solo: { izq: ['KeyA', 'ArrowLeft'], der: ['KeyD', 'ArrowRight'], arriba: ['KeyW', 'ArrowUp'], abajo: ['KeyS', 'ArrowDown'], pase: ['KeyJ', 'KeyZ'], tiro: ['KeyK', 'KeyX'], barrida: ['KeyL', 'KeyC'], cambiar: ['Space', 'KeyQ'], sprint: ['ShiftLeft', 'ShiftRight'], trucos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`Digit${n}`, `Numpad${n}`]) },
  j1: { izq: ['KeyA'], der: ['KeyD'], arriba: ['KeyW'], abajo: ['KeyS'], pase: ['KeyF'], tiro: ['KeyG'], barrida: ['KeyH'], cambiar: ['KeyR'], sprint: ['ShiftLeft'], trucos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`Digit${n}`]) },
  j2: { izq: ['ArrowLeft'], der: ['ArrowRight'], arriba: ['ArrowUp'], abajo: ['ArrowDown'], pase: ['KeyJ', 'Numpad1'], tiro: ['KeyK', 'Numpad2'], barrida: ['KeyL', 'Numpad3'], cambiar: ['KeyU', 'Numpad0'], sprint: ['ShiftRight', 'NumpadEnter'], trucos: ['Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadDivide', 'NumpadMultiply'].map((k) => [k]) },
};
// en la ayuda: qué tecla es cada truco según el perfil
const teclaTruco = (perfil, i) => ({ solo: String(i + 1), j1: String(i + 1), j2: ['Num4', 'Num5', 'Num6', 'Num7', 'Num8', 'Num9', 'Num/', 'Num*'][i] })[perfil];
const ACCIONES = ['pase', 'tiro', 'barrida', 'cambiar', 'sprint'];
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
  const algun = (l) => l.some((k) => t.has(k));
  return {
    leer(perfil, mando = null) {
      const k = TECLAS[perfil];
      const e = { x: (algun(k.der) ? 1 : 0) - (algun(k.izq) ? 1 : 0), y: (algun(k.abajo) ? 1 : 0) - (algun(k.arriba) ? 1 : 0) };
      for (const b of ACCIONES) e[b] = algun(k[b]);
      const nt = k.trucos.findIndex((teclas) => algun(teclas));
      if (nt >= 0) e.truco = nt + 1;
      const g = mando !== null ? navigator.getGamepads?.()[mando] : null;
      if (g) {
        const b = (n) => !!g.buttons[n]?.pressed;
        // joystick: con LT apretado, los botones y la cruz hacen los trucos
        if (b(6)) {
          const t = [0, 1, 2, 3].findIndex(b) >= 0 ? [0, 1, 2, 3].findIndex(b) + 1 : [12, 15, 13, 14].findIndex(b) >= 0 ? [12, 15, 13, 14].findIndex(b) + 5 : 0;
          if (t) e.truco = t;
          if (Math.abs(g.axes[0]) > .25) e.x = g.axes[0]; if (Math.abs(g.axes[1]) > .25) e.y = g.axes[1];
          return e;
        }
        if (Math.abs(g.axes[0]) > .25) e.x = g.axes[0]; if (Math.abs(g.axes[1]) > .25) e.y = g.axes[1];
        e.x += (b(15) ? 1 : 0) - (b(14) ? 1 : 0); e.y += (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
        e.pase ||= b(0); e.tiro ||= b(2); e.barrida ||= b(1); e.cambiar ||= b(4); e.sprint ||= b(7) || b(5); e.camara = b(3);
      }
      return e;
    },
    destruir() { removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); removeEventListener('blur', blur); },
  };
}
function tactil(raiz) {
  const e = { x: 0, y: 0 };
  raiz.insertAdjacentHTML('beforeend', `<div class="fu-tactil"><div class="fu-joy"><i></i></div><div class="fu-btns">
    <button data-b="cambiar">Cambio</button><button data-b="barrida">Barrida</button><button data-b="sprint">Correr</button>
    <button data-b="pase">Pase</button><button data-b="tiro">Tiro</button><button data-truco>Truco</button></div></div>`);
  const joy = raiz.querySelector('.fu-joy');
  const mover = (ev) => {
    const r = joy.getBoundingClientRect();
    let x = (ev.clientX - r.left - r.width / 2) / (r.width / 2), y = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    e.x = x; e.y = y; joy.querySelector('i').style.transform = `translate(${x * 34}px,${y * 34}px)`;
  };
  joy.addEventListener('pointerdown', (ev) => { joy.setPointerCapture(ev.pointerId); mover(ev); });
  joy.addEventListener('pointermove', (ev) => ev.buttons && mover(ev));
  joy.addEventListener('pointerup', () => { e.x = e.y = 0; joy.querySelector('i').style.transform = ''; });
  let cual = 0;
  const bt = raiz.querySelector('[data-truco]');
  bt.addEventListener('pointerdown', (ev) => { ev.preventDefault(); e.truco = [1, 3, 5, 7][cual++ % 4]; bt.classList.add('on'); });
  for (const n of ['pointerup', 'pointerleave', 'pointercancel']) bt.addEventListener(n, () => { e.truco = 0; bt.classList.remove('on'); });
  raiz.querySelectorAll('[data-b]').forEach((b) => {
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); e[b.dataset.b] = true; b.classList.add('on'); });
    for (const n of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(n, () => { e[b.dataset.b] = false; b.classList.remove('on'); });
  });
  return e;
}
const sumar = (a, b) => { const s = { x: Math.max(-1, Math.min(1, a.x + b.x)), y: Math.max(-1, Math.min(1, a.y + b.y)) }; for (const k of ACCIONES) s[k] = !!(a[k] || b[k]); s.camara = a.camara; s.truco = a.truco || b.truco; return s; };
// las teclas son de la pantalla: se pasan a la cancha según la cámara
function aCancha(inp, escena, eq) {
  let x = inp.x, z = inp.y;
  if (escena.modo === 'tercera') { const s = eq ? -1 : 1; x = -inp.y * s; z = inp.x * s; }
  const out = { x, z };
  for (const k of ACCIONES) if (inp[k]) out[k] = true;
  if (inp.truco) out.truco = inp.truco;
  return out;
}
const AYUDA = '<kbd>WASD</kbd> moverse · <kbd>Shift</kbd> correr · <kbd>J</kbd> pase (sin pelota: quitar) · <kbd>K</kbd> tiro (mantené para cargar) · <kbd>L</kbd> barrida / pase largo · <kbd>Espacio</kbd> cambiar · <kbd>1</kbd>-<kbd>8</kbd> trucos · <kbd>H</kbd> lista de trucos · <kbd>C</kbd> cámara · <kbd>Esc</kbd> pausa';
const listaTrucos = (perfil = 'solo') => TRUCOS.map((t, i) => `<span><kbd>${teclaTruco(perfil, i)}</kbd> <b>${t.nombre}</b><small>${t.desc}</small></span>`).join('');
// tira chiquita abajo: aparece solo cuando tenés la pelota
const CORTO = ['Bici', 'Amague', 'Caño', 'Sombrero', 'Ruleta', 'Taco', 'Elástica', 'Pared'];
const tiraTrucos = (perfil = 'solo') => CORTO.map((n, i) => `<span><kbd>${teclaTruco(perfil, i)}</kbd>${n}</span>`).join('');

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'La Canchita · cadalado';
  app.innerHTML = `
  <div class="menu fu-menu">
    <div class="menu-hero"><div><span class="etq">Fútbol 5 a fútbol 8, en 3D</span><h1>La <em>Canchita.</em></h1>
      <p>Picado en la canchita del barrio con los personajes del club. Gambetas, paredes, caños, voleas y arqueros que vuelan. De fútbol 5 a fútbol 8.</p>
      <div class="pf-chips"><span>F5 · F6 · F7 · F8</span><span>Contra bots</span><span>2 jugadores</span><span>Online por equipos</span></div></div></div>
    <section class="panel">
      ${cuenta ? '' : `<h2>Tu nombre</h2><input class="entrada" data-nombre maxlength="20" value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?" style="margin-bottom:18px">`}
      <h2>Elegí cómo jugar</h2>
      <div class="pf-modos">
        <a class="pf-modo" href="/futbol/bots" data-ir><b>Contra bots</b><span>Vos y tu equipo de bots contra otro equipo del club.</span><small>Cambiás de jugador cuando quieras, o solo</small></a>
        <a class="pf-modo" href="/futbol/local" data-ir><b>2 jugadores (misma compu)</b><span>Cada uno maneja su equipo. Teclado o joysticks.</span><small>J1: WASD + F G H R · J2: flechas + J K L U</small></a>
        <form class="pf-modo" data-crear><b>Sala online</b><span>Armá la canchita, pasá el link y jueguen rojo contra azul. Los bots completan.</span>
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
        <span><kbd>WASD</kbd></span><span>Moverse (con <kbd>Shift</kbd> corrés, gasta aire)</span>
        <span><kbd>J</kbd></span><span>Pase al compañero que tengas para ese lado · sin la pelota, quitarla</span>
        <span><kbd>K</kbd></span><span>Tiro: mantené para cargar y soltá. Apretá para un costado y va a ese palo · sin pelota: volea o cabezazo</span>
        <span><kbd>L</kbd></span><span>Barrida · con la pelota, pase largo por arriba</span>
        <span><kbd>Espacio</kbd></span><span>Cambiar al compañero más cerca de la pelota</span>
        <span><kbd>C</kbd></span><span>Cámara: transmisión o tercera persona</span>
        <span><kbd>1</kbd>-<kbd>8</kbd></span><span>Trucos con la pelota (abajo la lista). Con joystick: LT + botones</span>
      </div>
      <h2 style="margin-top:22px">Trucos</h2>
      <div class="fu-lista">${listaTrucos()}</div>
      <p class="pf-ayuda" style="text-align:left">Los rivales aprenden cómo jugás en el partido: si siempre pateás al mismo palo o repetís el mismo truco, se lo terminan comiendo menos.</p>
    </section>
  </div>`;
  const nombre = () => app.querySelector('[data-nombre]')?.value.trim();
  app.querySelector('[data-nombre]')?.addEventListener('change', () => guardarNombre(nombre()));
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(nombre());
    try {
      const { code } = await api('/api/futbol/crear', { pid: pid(), nombre: nombre(), opciones: { publica: f.get('publica') === 'on', personaje: leer('futbol.personaje', azarDe(ROSTER)), formato: Number(leer('futbol.formato', 5)) } });
      ir(`/futbol/sala/${code}`);
    } catch (err) { toast(err.message, true); }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => { e.preventDefault(); const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, ''); if (c) ir(`/futbol/sala/${c}`); };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/futbol/lobby');
      const el = app.querySelector('[data-salas]'); if (!el) return;
      el.innerHTML = salas.length ? salas.map((s) => `<a class="sala-fila" href="/futbol/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR_JUEGO}">${s.jugadores}</span><span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Armando equipos' : s.fase === 'fin' ? 'Terminando' : 'Jugando ahora'} · F${s.formato}</small></span><span class="btn btn-chico btn-lima">Entrar</span></a>`).join('') : '<div class="vacio">No hay salas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- armar el partido (local)
const seg = (nombre, op, valor, opciones, deshab = false) => `<div class="pf-grupo"><span>${nombre}</span><div class="pf-seg" data-op="${op}">${opciones.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(valor) ? 'on' : ''}" ${deshab ? 'disabled' : ''}>${t}</button>`).join('')}</div></div>`;
function armado({ dos }) {
  document.title = (dos ? '2 jugadores' : 'Contra bots') + ' · La Canchita';
  const conf = { formato: Number(leer('futbol.formato', 5)), minutos: Number(leer('futbol.minutos', 4)), dif: Number(leer('futbol.dif', 1)), cancha: leer('futbol.cancha', 'barrio'), rol: leer('futbol.rol', 'aleatorio'), rol2: leer('futbol.rol2', 'aleatorio'), penales: leer('futbol.penales', 'si') };
  let p1 = ROSTER.includes(leer('futbol.personaje', '')) ? leer('futbol.personaje', '') : null, p2 = null;
  const pintar = () => {
    const turno = dos && p1 && !p2 ? 2 : 1;
    app.innerHTML = `<div class="pf-sel fu-sel">
      <h2>${dos ? (turno === 1 ? 'Jugador 1: elegí tu crack' : 'Jugador 2: elegí tu crack') : 'Elegí tu crack'}</h2>
      <div class="pf-lado p1"><img src="${foto(p1 || ROSTER[0])}" data-npc="${p1 || ROSTER[0]}" alt=""><b>${esc(nombreNpc(p1 || ROSTER[0]))}</b><small>${dos ? 'Jugador 1 · Rojo' : 'Vos · Rojo'}</small></div>
      <div class="pf-medio">
        <div class="pf-grilla">${ROSTER.map((id) => `<button class="pf-cara ${p1 === id ? 'p1' : ''} ${p2 === id ? 'p2' : ''}" data-id="${id}"><img src="${foto(id)}" data-npc="${id}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}<button class="pf-cara azar" data-id="azar">?</button></div>
        <div class="pf-opciones">
          ${seg('Formato', 'formato', conf.formato, [[5, 'Fútbol 5'], [6, 'F6'], [7, 'F7'], [8, 'Fútbol 8']])}
          ${seg('Minutos', 'minutos', conf.minutos, [[2, '2'], [4, '4'], [6, '6'], [8, '8']])}
          ${seg('Nivel de los bots', 'dif', conf.dif, [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil'], [3, 'Leyenda']])}
          ${seg('Cancha', 'cancha', conf.cancha, CANCHAS.map((c) => [c.id, c.nombre]))}
          ${seg('Si empatan', 'penales', conf.penales, [['si', 'Penales'], ['no', 'Queda empate']])}
          ${seg(dos ? 'Puesto J1' : 'Tu puesto', 'rol', conf.rol, ROLES)}
          ${dos ? seg('Puesto J2', 'rol2', conf.rol2, ROLES) : ''}
        </div>
        <p class="pf-ayuda">${dos ? 'Cada uno maneja su equipo y cambia de jugador con R (J1) o U (J2).' : 'Tu equipo y el rival se completan con personajes del club al azar.'}</p>
        <div class="pf-listo"><a class="btn btn-borde" href="/futbol/" data-ir>Volver</a>${p1 && (!dos || p2) ? '<button class="btn btn-lima btn-grande" data-jugar>¡A la cancha!</button>' : ''}</div>
      </div>
      <div class="pf-lado p2"><img src="${foto(p2 || ROSTER[1])}" data-npc="${p2 || ROSTER[1]}" alt="" style="${dos ? '' : 'filter:brightness(.25)'}"><b>${dos ? esc(nombreNpc(p2 || ROSTER[1])) : '???'}</b><small>${dos ? 'Jugador 2 · Azul' : 'El rival sale al azar'}</small></div>
    </div>`;
    app.querySelectorAll('.pf-cara').forEach((b) => (b.onclick = () => {
      const id = b.dataset.id === 'azar' ? azarDe(ROSTER) : b.dataset.id;
      sfx('elegir');
      if (dos && p1 && !p2) p2 = id; else { p1 = id; guardar('futbol.personaje', id); if (dos) p2 = null; }
      pintar();
    }));
    app.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      const op = s.dataset.op; conf[op] = ['cancha', 'rol', 'rol2', 'penales'].includes(op) ? b.dataset.v : Number(b.dataset.v);
      guardar('futbol.' + op, b.dataset.v); sfx('cursor'); pintar();
    })));
    app.querySelector('[data-jugar]')?.addEventListener('click', () => {
      const usados = new Set([p1, p2].filter(Boolean));
      const otro = () => { const libres = ROSTER.filter((x) => !usados.has(x)); const id = azarDe(libres.length ? libres : ROSTER); usados.add(id); return id; };
      // cada equipo se arma con el puesto que eligió cada uno; el resto, al azar
      const personas = [[{ id: 'yo1', npc: p1, rol: conf.rol }], dos ? [{ id: 'yo2', npc: p2, rol: conf.rol2 }] : []];
      const jugadores = [0, 1].flatMap((eq) => armarEquipo(conf.formato, eq, personas[eq], Array.from({ length: conf.formato - personas[eq].length }, otro)));
      const humanos = [{ hid: 'p1', eq: 0, pid: 'yo1', cambia: true, perfil: dos ? 'j1' : 'solo', mando: 0 }];
      if (dos) humanos.push({ hid: 'p2', eq: 1, pid: 'yo2', cambia: true, perfil: 'j2', mando: 1 });
      limpiar.forEach((f) => f()); limpiar = [];
      jugar({ conf, jugadores, humanos, dos, alVolver: () => { limpiar.forEach((f) => f()); limpiar = []; document.body.classList.remove('en-cancha'); armado({ dos }); } });
    });
  };
  pintar();
}

// ---------------------------------------------------------------- pantalla del partido (común)
function htmlCancha() {
  return `<div class="pf fu">
    <canvas class="pf-lienzo"></canvas>
    <div class="fu-marcador"><span class="eq" style="--c:${COLOR_EQ[0]}">ROJO</span><b data-g0>0</b><i>-</i><b data-g1>0</b><span class="eq" style="--c:${COLOR_EQ[1]}">AZUL</span><time data-reloj>04:00</time></div>
    <div class="fu-gol" data-gol></div>
    <div class="fu-aviso" data-aviso></div>
    <div class="fu-pen hidden" data-pen></div>
    <div class="fu-campeon" data-campeon></div>
    <div class="fu-trucos" data-trucos></div>
    <div class="fu-yo" data-yo><b data-yo-nombre></b><div class="fu-barra aire"><i data-aire></i></div><div class="fu-barra carga"><i data-carga></i></div></div>
    <canvas class="fu-radar" data-radar width="200" height="112"></canvas>
    <button class="pf-boton-menu fu-boton" data-menu>Pausa · Esc</button>
    <div class="pf-pie" data-pie></div>
    <div class="pf-cargando" data-cargando>Marcando la cancha…</div>
    <div class="pf-capa hidden" data-capa></div>
  </div>`;
}

function crearHud(raiz, jugadores) {
  const $ = (s) => raiz.querySelector(s);
  const radar = $('[data-radar]').getContext('2d');
  let golVisto = 0, avisoT = 0, golT = 0;
  const nombre = (id) => nombreNpc(jugadores.find((j) => j.id === id)?.npc);
  return (v, mios) => {
    $('[data-g0]').textContent = v.marcador[0]; $('[data-g1]').textContent = v.marcador[1];
    $('[data-reloj]').textContent = mmss(v.tiempo);
    // tu jugador: nombre (y puesto), aire y carga del remate
    const miId = Object.entries(v.mando || {}).find(([h]) => mios.includes(h))?.[1];
    const yo = v.jug.find((j) => j.id === miId);
    $('[data-yo]').classList.toggle('hidden', !yo);
    if (yo) {
      $('[data-yo-nombre]').textContent = `${nombre(yo.id)} · ${(ROLES.find(([r]) => r === yo.rol) || ['', ''])[1] || (yo.arquero ? 'Arquero' : '')}`;
      $('[data-yo-nombre]').style.color = COLOR_EQ[yo.eq];
      $('[data-aire]').style.width = Math.round((yo.energia ?? 1) * 100) + '%';
      $('[data-carga]').style.width = Math.round((yo.carga || 0) * 100) + '%';
    }
    $('[data-trucos]')?.classList.toggle('on', !!yo && v.pel.duenio === yo.id);
    // radar
    const W = 200, H = 112, sx = W / (v.L + 2), sz = H / (v.A + 2);
    radar.clearRect(0, 0, W, H);
    radar.fillStyle = 'rgba(20,60,30,.75)'; radar.fillRect(0, 0, W, H);
    radar.strokeStyle = 'rgba(255,255,255,.5)'; radar.lineWidth = 1;
    radar.strokeRect(sx, sz, v.L * sx, v.A * sz); radar.beginPath(); radar.moveTo(W / 2, sz); radar.lineTo(W / 2, H - sz); radar.stroke();
    for (const j of v.jug) {
      radar.fillStyle = j.id === miId ? '#ffffff' : COLOR_EQ[j.eq];
      radar.beginPath(); radar.arc((j.x + v.L / 2 + 1) * sx, (j.z + v.A / 2 + 1) * sz, j.id === miId ? 4 : 3, 0, 7); radar.fill();
    }
    radar.fillStyle = '#ffe14a'; radar.beginPath(); radar.arc((v.pel.x + v.L / 2 + 1) * sx, (v.pel.z + v.A / 2 + 1) * sz, 2.5, 0, 7); radar.fill();
    // gol y avisos
    for (const e of v.ev || []) {
      if (e.n <= golVisto) continue;
      golVisto = e.n;
      if (e.k === 'gol') {
        const quien = e.autor ? nombre(e.autor) : '';
        $('[data-gol]').innerHTML = `<b style="--c:${COLOR_EQ[e.eq]}">¡GOOOL!</b><small>${e.contra ? `En contra de ${esc(quien)}` : quien ? `de ${esc(quien)}` : ''}${e.asistencia ? ` · asistencia de ${esc(nombre(e.asistencia))}` : ''}</small><span>${e.marcador[0]} - ${e.marcador[1]}</span>`;
        $('[data-gol]').classList.add('on'); golT = performance.now();
        relator(e.contra ? `¡Gol en contra de ${quien}!` : `¡Gooool de ${quien}!`);
      } else if (['palo', 'atajada', 'cabezazo', 'volea', 'esquiva'].includes(e.k) || (e.k === 'truco' && e.exito)) {
        const txt = e.k === 'truco' ? `¡${e.nombre.toUpperCase()}!` : { palo: '¡PALO!', atajada: e.rebote ? '¡DA REBOTE!' : '¡QUÉ ATAJADA!', cabezazo: '¡CABEZAZO!', volea: '¡DE VOLEA!', esquiva: '¡QUÉ RULETA!' }[e.k];
        $('[data-aviso]').textContent = txt; $('[data-aviso]').classList.remove('on'); void $('[data-aviso]').offsetWidth; $('[data-aviso]').classList.add('on'); avisoT = performance.now();
      } else if (e.k === 'penales') {
        relator('¡Vamos a los penales!');
      } else if (e.k === 'penal') {
        const el = $('[data-aviso]'); el.textContent = e.gol ? '¡GOOOL!' : e.ataja ? '¡LO ATAJÓ!' : '¡AFUERA!'; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); avisoT = performance.now();
      } else if (e.k === 'final') {
        relator(v.ganador === null ? '¡Terminó! Empate.' : `¡Terminó! Ganó el ${NOMBRE_EQ[v.ganador]}.`);
      }
    }
    if (performance.now() - golT > 3000) $('[data-gol]').classList.remove('on');
    // tanda de penales: bolitas por equipo, quién patea y quién ataja
    const pen = $('[data-pen]');
    pen.classList.toggle('hidden', v.fase !== 'penales' || !v.pen);
    if (v.fase === 'penales' && v.pen) {
      const n = Math.max(5, v.pen.tiros[0].length, v.pen.tiros[1].length);
      const fila = (eq) => `<div><b style="color:${COLOR_EQ[eq]}">${NOMBRE_EQ[eq]}</b>${Array.from({ length: n }, (_, i) => { const t = v.pen.tiros[eq][i]; return `<i class="${t === true ? 'si' : t === false ? 'no' : ''}"></i>`; }).join('')}<span>${v.pen.goles[eq]}</span></div>`;
      const pat = v.jug.find((j) => j.id === v.pen.pateador), arq = v.jug.find((j) => j.id === v.pen.arquero);
      const yoPateo = Object.entries(v.mando || {}).some(([h, id]) => mios.includes(h) && id === v.pen.pateador);
      const yoAtajo = Object.entries(v.mando || {}).some(([h, id]) => mios.includes(h) && id === v.pen.arquero);
      const html = `<h4>Tanda de penales</h4>${fila(0)}${fila(1)}<p>Patea <b>${esc(nombre(pat?.id))}</b> · ataja <b>${esc(nombre(arq?.id))}</b></p>${yoPateo ? '<small>Apretá para un costado para elegir el palo y mantené <kbd>K</kbd> para patear</small>' : yoAtajo ? '<small>Apretá <kbd>L</kbd> y un costado para tirarte</small>' : ''}`;
      if (pen.dataset.h !== html) { pen.dataset.h = html; pen.innerHTML = html; }
    }
    // la vuelta olímpica: cartel de campeones cuando el capitán levanta la copa
    const camp = $('[data-campeon]');
    if (v.fase === 'fin' && v.copa && v.faseT > 4.6) {
      if (!camp.classList.contains('on')) {
        const pens = v.pen ? ` · ${v.pen.goles[0]} a ${v.pen.goles[1]} en penales` : '';
        camp.innerHTML = `<b style="--c:${COLOR_EQ[v.copa.eq]}">¡CAMPEONES!</b><small>Equipo ${NOMBRE_EQ[v.copa.eq]} · ${v.marcador[0]} a ${v.marcador[1]}${pens}</small>`;
        camp.classList.add('on');
        relator(`¡Campeones! ¡Campeón el equipo ${NOMBRE_EQ[v.copa.eq]}!`);
      }
    } else camp.classList.remove('on');
    if (performance.now() - avisoT > 1400) $('[data-aviso]').classList.remove('on');
  };
}

// ---------------------------------------------------------------- partido local
async function jugar({ conf, jugadores, humanos, dos, alVolver }) {
  document.body.classList.add('en-cancha');
  app.innerHTML = htmlCancha();
  const $ = (s) => app.querySelector(s);
  const escena = crearEscena($('.pf-lienzo'), { cancha: conf.cancha });
  if (dos) escena.ponerCamara('tv'); else escena.ponerCamara(leer('futbol.camara', 'tv'));
  const tec = teclado(), toque = tactil($('.pf'));
  const trucos = $('[data-trucos]');
  trucos.innerHTML = tiraTrucos(dos ? 'j1' : 'solo');
  trucos.classList.toggle('hidden', leer('futbol.verTrucos', 'si') === 'no');
  $('[data-pie]').innerHTML = dos ? 'J1 (Rojo): <kbd>WASD</kbd> <kbd>F</kbd> pase <kbd>G</kbd> tiro <kbd>H</kbd> barrida <kbd>R</kbd> cambio <kbd>Shift izq</kbd> correr &nbsp;|&nbsp; J2 (Azul): flechas <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>U</kbd> <kbd>Shift der</kbd>' : AYUDA;
  let m = null, pausa = false, raf = 0, viva = true, finMostrado = false;
  const nuevo = () => { m = nuevoPartido({ formato: conf.formato, jugadores, humanos, minutos: conf.minutos, dificultad: conf.dif ?? 1, penales: conf.penales !== 'no' }); finMostrado = false; };
  nuevo();
  limpiar.push(() => { viva = false; cancelAnimationFrame(raf); tec.destruir(); escena.destruir(); tribuna(false); speechSynthesis?.cancel?.(); });
  await escena.armar(m, jugadores).catch(() => {});
  if (!viva) return;
  $('[data-cargando]').classList.add('hidden');
  tribuna(true);
  const hud = crearHud(app, jugadores);
  const capa = $('[data-capa]');
  const menuPausa = () => {
    pausa = true; capa.classList.remove('hidden');
    capa.innerHTML = `<div class="pf-caja"><h2>Pausa</h2><p>${AYUDA}</p><div class="pf-opc">
      <button data-a="seguir"><b>▶ Seguir</b><small>Volver a la cancha.</small></button>
      <button data-a="camara"><b>🎥 Cámara: ${escena.modo === 'tv' ? 'transmisión' : 'tercera persona'}</b><small>Cambiá entre la de la tele y la de atrás de tu jugador (C).</small></button>
      <button data-a="otra"><b>↻ Empezar de nuevo</b><small>Mismos equipos, 0 a 0.</small></button>
      <button data-a="elegir"><b>☰ Cambiar equipo y formato</b><small>Volver a la pantalla anterior.</small></button>
      <button data-a="relator"><b>🎙 Relator</b><small>${leer('futbol.relator', 'si') === 'no' ? 'Callado' : 'Relata los goles'}</small></button>
      <a href="/futbol/" data-ir><b>↩ Salir</b><small>Volver al menú de La Canchita.</small></a></div></div>`;
    capa.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'seguir') { capa.classList.add('hidden'); pausa = false; }
      if (a === 'camara') { if (!dos) guardar('futbol.camara', escena.cambiarCamara()); menuPausa(); }
      if (a === 'otra') { capa.classList.add('hidden'); pausa = false; nuevo(); }
      if (a === 'elegir') alVolver();
      if (a === 'relator') { guardar('futbol.relator', leer('futbol.relator', 'si') === 'no' ? 'si' : 'no'); menuPausa(); }
    }));
  };
  const tecla = (e) => {
    if (e.code === 'Escape' && !document.querySelector('.cj-capa, .en-capa')) { e.preventDefault(); e.stopPropagation(); pausa ? (capa.classList.add('hidden'), (pausa = false)) : menuPausa(); }
    if (e.code === 'KeyC' && !dos && !pausa) guardar('futbol.camara', escena.cambiarCamara());
    if (e.code === 'KeyH' && !dos) { const v = trucos.classList.toggle('hidden'); guardar('futbol.verTrucos', v ? 'no' : 'si'); }
  };
  addEventListener('keydown', tecla, true);
  limpiar.push(() => removeEventListener('keydown', tecla, true));
  $('[data-menu]').onclick = menuPausa;
  const finPanel = () => {
    capa.classList.remove('hidden');
    const g = m.ganador, gan = !dos && g === 0;
    const goleadores = m.jug.filter((j) => j.goles).sort((a, b) => b.goles - a.goles).map((j) => `${esc(nombreNpc(jugadores.find((x) => x.id === j.id).npc))} (${j.goles})`).join(', ');
    capa.innerHTML = `<div class="pf-caja"><div class="pf-festejo"><b>${g === null ? '¡Empate!' : dos ? `¡Ganó el ${NOMBRE_EQ[g]}!` : gan ? '¡Campeones!' : 'Perdiste…'}</b><span>${m.marcador[0]} a ${m.marcador[1]}${m.pen ? ` (${m.pen.goles[0]} a ${m.pen.goles[1]} en penales)` : ''}${goleadores ? ` · Goles: ${goleadores}` : ''}</span></div>
      <div class="pf-opc"><button data-a="otra"><b>↻ Revancha</b><small>Mismos equipos, 0 a 0.</small></button><button data-a="elegir"><b>☰ Cambiar equipo y formato</b></button><a href="/futbol/" data-ir><b>↩ Menú</b></a></div></div>`;
    capa.querySelector('[data-a="otra"]').onclick = () => { capa.classList.add('hidden'); nuevo(); };
    capa.querySelector('[data-a="elegir"]').onclick = alVolver;
  };
  let acum = 0, antes = performance.now(), camAntes = false;
  const mios = humanos.map((h) => h.hid);
  const cuadro = (ms) => {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - antes) / 1000); antes = ms;
    if (!pausa) {
      acum += dt;
      while (acum >= PASO) {
        acum -= PASO;
        const ent = new Map();
        for (const h of humanos) {
          let inp = tec.leer(h.perfil, h.mando);
          if (h.hid === 'p1') inp = sumar(inp, toque);
          if (h.hid === 'p1' && inp.camara && !camAntes && !dos) guardar('futbol.camara', escena.cambiarCamara());
          if (h.hid === 'p1') camAntes = !!inp.camara;
          ent.set(h.hid, aCancha(inp, escena, h.eq));
        }
        paso(m, ent);
      }
      if (m.fase === 'fin' && m.faseT > (m.copa ? 12 : 4) && !finMostrado) { finMostrado = true; finPanel(); }
    }
    escena.actualizar(m, pausa ? 0 : dt, { mios });
    hud(m, mios);
  };
  raf = requestAnimationFrame(cuadro);
  window.__futbol = { get partido() { return m; }, escena };
}

// ---------------------------------------------------------------- online
function abrirSala(code) {
  document.title = `La Canchita ${code} · cadalado`;
  document.body.classList.add('en-cancha');
  app.innerHTML = htmlCancha();
  const $ = (s) => app.querySelector(s);
  $('.pf').insertAdjacentHTML('beforeend', '<div class="pf-chat fu-chat"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat… (Enter)" autocomplete="off"></form></div>');
  $('[data-cargando]').textContent = 'Entrando a la canchita…';
  $('[data-pie]').innerHTML = AYUDA;
  const tec = teclado(), toque = tactil($('.pf'));
  let est = null, escena = null, jugadores = [], m = null, vista = null, base = null, partidoN = -1, hud = null, avisado = false;
  const entradas = new Map();
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id);
    return online.includes(est.host) ? est.host : online.sort()[0];
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;
  const participa = () => est?.participantes?.includes(est.yo);
  const nombreDe = (id) => est?.jugadores.find((j) => j.id === id)?.nombre || '—';
  function recibir(id, s) {
    if (typeof s !== 'string') return;
    if (s[0] === 'M') { if (soyAnfitrion() || id !== idAnfitrion() || !base) return; const d = decodificar(s, base); if (d) vista = d; }
    else if (s[0] === 'I' && soyAnfitrion()) entradas.set(id, decodificarEntrada(s));
  }
  const red = { actual: null };
  window.__reiniciar = { puede: () => !!est && est.host === est.yo && est.fase !== 'lobby', hacer: () => sala.enviar({ t: 'reiniciar' }) };
  const sala = new Sala('/api/futbol', code, {
    intervalo: (e) => (e?.fase === 'partido' ? 1000 : 900),
    onEstado: (e) => {
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: () => {}, ruta: '/api/futbol', accionPlanB: 'mensaje' });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      if (e.fase === 'partido' && e.partidoN !== partidoN) empezar();
      if (e.fase !== 'partido') pintarPanel(); else $('[data-capa]').classList.add('hidden');
      if (e.fase !== 'partido' || escena) $('[data-cargando]').classList.add('hidden');
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k !== 'chat') return;
      const log = $('[data-log]'); const d = document.createElement('div');
      if (ev.sistema) { d.className = 'sis'; d.textContent = ev.texto; } else { if (ev.bot) d.className = 'bot'; d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`; }
      log.append(d); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
    },
    onError: (msg) => toast(msg, true),
    onNoExiste: () => { toast('Esa sala no existe.', true); ir('/futbol/'); },
  });
  recordar('futbol', `/futbol/sala/${code}`, `La Canchita ${code}`);
  $('[data-chat]').onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector('input'); if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value }); i.value = ''; i.blur(); };
  const abrirChat = (e) => { if (e.code === 'Enter' && !e.target.closest?.('input, select, textarea') && est?.fase !== 'partido') { e.preventDefault(); $('[data-chat] input').focus(); } };
  addEventListener('keydown', abrirChat);

  // los jugadores del partido: igual en todas las compus (arquero bot, personas y bots que completan)
  function armarJugadores() {
    const lista = [], humanos = [];
    // misma semilla en todas las compus: los puestos al azar salen iguales para todos
    const semilla = (est.partidoN * 7919 + [...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) >>> 0;
    const r = rngNpc(semilla);
    for (const [eq, nom] of [[0, 'rojo'], [1, 'azul']]) {
      const personas = est.participantes.filter((p) => est.equipos[p] === nom).map((p) => ({ id: p, npc: est.personaje[p] || ROSTER[0], rol: est.rol?.[p] || 'aleatorio', jugador: nombreDe(p) }));
      lista.push(...armarEquipo(est.formato, eq, personas, est.bots[nom] || [], r));
      for (const p of personas) humanos.push({ hid: p.id, eq, pid: p.id, cambia: personas.length === 1 });
    }
    return { lista, humanos };
  }
  async function empezar() {
    partidoN = est.partidoN; avisado = false; vista = null;
    const { lista, humanos } = armarJugadores();
    jugadores = lista;
    m = nuevoPartido({ formato: est.formato, jugadores: lista, humanos, minutos: est.minutos, golesMax: est.golesMax, dificultad: est.dificultad, penales: est.penales !== false });
    base = m;
    escena?.destruir();
    const lienzo = $('.pf-lienzo'); const nuevo = lienzo.cloneNode(); lienzo.replaceWith(nuevo);
    escena = crearEscena(nuevo, { cancha: est.cancha });
    escena.ponerCamara(leer('futbol.camara', 'tv'));
    $('[data-cargando]').classList.remove('hidden'); $('[data-cargando]').textContent = 'Marcando la cancha…';
    await escena.armar(m, lista).catch(() => {});
    $('[data-cargando]').classList.add('hidden');
    hud = crearHud(app, lista);
    $('[data-trucos]').innerHTML = tiraTrucos('solo');
    $('[data-trucos]').classList.toggle('hidden', leer('futbol.verTrucos', 'si') === 'no');
    tribuna(true);
  }

  function pintarPanel() {
    if (!est) return;
    const capa = $('[data-capa]'); capa.classList.remove('hidden');
    const host = est.host === est.yo, n = est.formato, cupo = n;
    const rolDe = (id) => (ROLES.find(([r]) => r === (est.rol?.[id] || 'aleatorio')) || ROLES[0])[1];
    const de = (eq) => est.jugadores.filter((j) => j.online && est.equipos[j.id] === eq);
    const fila = (j) => `<li><img src="${foto(est.personaje[j.id] || ROSTER[0])}" data-npc="${est.personaje[j.id] || ROSTER[0]}" alt="">${esc(j.nombre)}${j.id === est.yo ? ' (vos)' : ''}${j.id === est.host ? ' ★' : ''}<em>${esc(rolDe(j.id))} · ${esc(nombreNpc(est.personaje[j.id]))}</em></li>`;
    const mio = est.personaje[est.yo], fin = est.fase === 'fin';
    const html = `<div class="pf-caja">
      ${fin ? `<div class="pf-festejo"><b>${est.ganador === null ? '¡Empate!' : `¡Campeón el ${NOMBRE_EQ[est.ganador]}!`}</b><span>${est.marcador[0]} a ${est.marcador[1]}${est.penalesRes ? ` (${est.penalesRes[0]} a ${est.penalesRes[1]} en penales)` : ''}</span></div>` : ''}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h2 style="margin-right:auto">Canchita ${code}</h2><button class="btn btn-chico" data-copiar>Copiar link</button><a class="btn btn-chico btn-borde" href="/futbol/" data-ir>Salir</a></div>
      <div class="pf-equipos">${['rojo', 'azul'].map((eq, k) => `<div class="pf-eq" style="--c:${COLOR_EQ[k]}"><h3>Equipo ${NOMBRE_EQ[k]} <small>${de(eq).length}/${cupo}</small></h3><ul>${de(eq).map(fila).join('')}${de(eq).length < cupo ? `<li><span style="color:#8d9483">+ ${cupo - de(eq).length} bots del club${de(eq).some((j) => est.rol?.[j.id] === 'arquero') ? '' : ' (uno al arco)'}</span></li>` : ''}</ul>${est.equipos[est.yo] === eq ? '<small style="color:#c5f04a;font-weight:700">Estás acá</small>' : `<button class="btn btn-chico" data-eq="${eq}">Pasarme acá</button>`}</div>`).join('')}</div>
      <p style="margin:0">Mirando: ${est.jugadores.filter((j) => j.online && est.equipos[j.id] === 'afuera').map((j) => esc(j.nombre)).join(', ') || 'nadie'} ${est.equipos[est.yo] !== 'afuera' ? '<button class="btn btn-chico btn-borde" data-eq="afuera">Solo mirar</button>' : ''}</p>
      <h3 style="margin:14px 0 0;font:900 18px 'Barlow Condensed',sans-serif;text-transform:uppercase">Tu jugador: <span style="color:${COLOR_JUEGO}">${esc(nombreNpc(mio))}</span></h3>
      <div class="pf-mini">${ROSTER.map((id) => `<button class="pf-cara ${mio === id ? 'p1' : ''}" data-pj="${id}"><img src="${foto(id)}" data-npc="${id}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}</div>
      <div class="pf-opciones">${seg('Tu puesto', 'rol', est.rol?.[est.yo] || 'aleatorio', ROLES)}</div>
      <p class="pf-ayuda">Elegí tu puesto: si nadie va al arco, ataja un bot. Los lugares que quedan se completan al azar.</p>
      <div class="pf-opciones">
        ${seg('Formato', 'formato', est.formato, [[5, 'F5'], [6, 'F6'], [7, 'F7'], [8, 'F8']], !host)}
        ${seg('Minutos', 'minutos', est.minutos, [[2, '2'], [4, '4'], [6, '6'], [8, '8']], !host)}
        ${seg('Nivel de los bots', 'dificultad', est.dificultad, [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil'], [3, 'Leyenda']], !host)}
        ${seg('Cancha', 'cancha', est.cancha, CANCHAS.map((c) => [c.id, c.nombre]), !host)}
        ${seg('Si empatan', 'penales', est.penales === false ? 'no' : 'si', [['si', 'Penales'], ['no', 'Queda empate']], !host)}
      </div>
      ${host ? `<div class="pf-listo"><button class="btn btn-lima btn-grande" data-empezar>${fin ? 'Revancha' : '¡A la cancha!'}</button></div>` : '<p class="pf-ayuda">Esperando que el anfitrión (★) arranque el partido…</p>'}
    </div>`;
    if (capa.dataset.firma === html) return;
    if (capa.contains(document.activeElement) && document.activeElement.matches('input')) return;
    capa.dataset.firma = html; capa.innerHTML = html;
    capa.querySelector('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado'); };
    capa.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'equipo', e: b.dataset.eq })));
    capa.querySelectorAll('[data-pj]').forEach((b) => (b.onclick = () => { guardar('futbol.personaje', b.dataset.pj); sfx('elegir'); sala.enviar({ t: 'personaje', id: b.dataset.pj }); }));
    capa.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      if (s.dataset.op === 'rol') { guardar('futbol.rol', b.dataset.v); return sala.enviar({ t: 'rol', rol: b.dataset.v }); }
      const op = s.dataset.op;
      sala.enviar({ t: 'config', [op]: op === 'cancha' ? b.dataset.v : op === 'penales' ? b.dataset.v === 'si' : Number(b.dataset.v) });
    })));
    capa.querySelector('[data-empezar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
  }

  let acum = 0, ultSim = performance.now(), envio = 0, enviado = 0;
  const miEntrada = () => { const eq = est.equipos[est.yo] === 'azul' ? 1 : 0; return aCancha(sumar(tec.leer('solo', 0), toque), escena || { modo: 'tv' }, eq); };
  function simular() {
    const ahora = performance.now();
    const dt = Math.min(.5, (ahora - ultSim) / 1000); ultSim = ahora;
    if (!est || est.fase !== 'partido' || !soyAnfitrion() || !m) { acum = 0; return; }
    // si el anfitrión anterior se fue, sigo desde lo último que vi
    if (vista && m !== base) {}
    if (participa()) entradas.set(est.yo, miEntrada());
    acum += dt;
    while (acum >= PASO) { acum -= PASO; paso(m, entradas); }
    if (ahora - envio > 50) { envio = ahora; red.actual?.enviar(codificar(m)); }
    if (m.fase === 'fin' && m.faseT > (m.copa ? 12 : 4) && !avisado) { avisado = true; sala.enviar({ t: 'resultado', n: est.partidoN, marcador: m.marcador, penales: m.pen ? m.pen.goles : null, goles: m.goles.map((g) => ({ eq: g.eq, autor: g.autor, contra: g.contra })) }); }
  }
  const sim = setInterval(simular, 1000 / 60);
  let raf, antes = performance.now();
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - antes) / 1000); antes = ms;
    if (!escena) return;
    let v = null;
    if (est?.fase === 'partido') {
      if (soyAnfitrion()) {
        if (vista && m && !m.tomado) { m.tomado = true; m.marcador = [...vista.marcador]; m.tiempo = vista.tiempo; }
        v = m;
      } else {
        v = vista;
        if (participa() && ms - enviado > 33) { enviado = ms; red.actual?.enviar(codificarEntrada(miEntrada())); }
      }
    }
    if (v) { escena.actualizar(v, dt, { mios: [est.yo] }); hud?.(v, [est.yo]); } else escena.actualizar(null, dt);
  }
  raf = requestAnimationFrame(cuadro);
  const tecla = (e) => {
    if (e.code === 'KeyC' && est?.fase === 'partido' && escena && !e.target.closest?.('input')) guardar('futbol.camara', escena.cambiarCamara());
    if (e.code === 'KeyH' && est?.fase === 'partido' && !e.target.closest?.('input')) { const v = $('[data-trucos]').classList.toggle('hidden'); guardar('futbol.verTrucos', v ? 'no' : 'si'); }
    if (e.code === 'Escape' && est?.fase === 'partido' && !document.querySelector('.cj-capa, .en-capa')) {
      e.preventDefault(); e.stopPropagation();
      const cp = $('[data-capa]');
      if (!cp.classList.contains('hidden')) { cp.classList.add('hidden'); return; }
      cp.classList.remove('hidden');
      cp.innerHTML = `<div class="pf-caja"><h2>Menú</h2><p>El partido sigue mientras mirás esto.</p><div class="pf-opc"><button data-x><b>▶ Volver</b></button><button data-cam><b>🎥 Cámara: ${escena?.modo === 'tercera' ? 'tercera persona' : 'transmisión'}</b></button>${est.host === est.yo ? '<button data-terminar><b>■ Terminar el partido</b><small>Vuelven todos a la sala.</small></button>' : ''}<a href="/futbol/" data-ir><b>↩ Salir de la sala</b></a></div></div>`;
      cp.querySelector('[data-x]').onclick = () => cp.classList.add('hidden');
      cp.querySelector('[data-cam]').onclick = () => { guardar('futbol.camara', escena.cambiarCamara()); cp.classList.add('hidden'); };
      cp.querySelector('[data-terminar]')?.addEventListener('click', () => { sala.enviar({ t: 'reiniciar' }); cp.classList.add('hidden'); });
    }
  };
  addEventListener('keydown', tecla, true);
  $('[data-menu]').onclick = () => tecla({ code: 'Escape', preventDefault() {}, stopPropagation() {}, target: document.body });
  window.__futbol = { get estado() { return est; }, get partido() { return m; }, get vista() { return vista; } };
  limpiar.push(() => { sala.cerrar(); red.actual?.cerrar(); cancelAnimationFrame(raf); clearInterval(sim); tec.destruir(); escena?.destruir(); removeEventListener('keydown', tecla, true); removeEventListener('keydown', abrirChat); delete window.__reiniciar; tribuna(false); });
}

ruteo();
