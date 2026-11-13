// La Canchita: fútbol 5 a fútbol 8 en 3D con los personajes del club.
// Modos: contra bots, 2 jugadores en la misma compu y salas online (rojo contra azul, los bots completan).
// Online: el anfitrión simula el partido y lo manda por WebRTC; cada uno manda sus teclas (como el haxball).
import { Sala, marco, api, pid, esc, toast, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { NPCS, POR_ID } from '/comun/npcs.js';
import { Red } from '/comun/red.js';
import { crearEscena, CANCHAS, COLOR_EQ } from './escena.js';
import { nuevoPartido, paso, PASO, codificar, decodificar, codificarEntrada, decodificarEntrada } from './motor.js';
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
  solo: { izq: ['KeyA', 'ArrowLeft'], der: ['KeyD', 'ArrowRight'], arriba: ['KeyW', 'ArrowUp'], abajo: ['KeyS', 'ArrowDown'], pase: ['KeyJ', 'KeyZ'], tiro: ['KeyK', 'KeyX'], barrida: ['KeyL', 'KeyC'], cambiar: ['Space', 'KeyQ'], sprint: ['ShiftLeft', 'ShiftRight'] },
  j1: { izq: ['KeyA'], der: ['KeyD'], arriba: ['KeyW'], abajo: ['KeyS'], pase: ['KeyF'], tiro: ['KeyG'], barrida: ['KeyH'], cambiar: ['KeyR'], sprint: ['ShiftLeft'] },
  j2: { izq: ['ArrowLeft'], der: ['ArrowRight'], arriba: ['ArrowUp'], abajo: ['ArrowDown'], pase: ['KeyJ', 'Numpad1'], tiro: ['KeyK', 'Numpad2'], barrida: ['KeyL', 'Numpad3'], cambiar: ['KeyU', 'Numpad0'], sprint: ['ShiftRight', 'NumpadEnter'] },
};
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
      const g = mando !== null ? navigator.getGamepads?.()[mando] : null;
      if (g) {
        const b = (n) => !!g.buttons[n]?.pressed;
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
    <button data-b="pase">Pase</button><button data-b="tiro">Tiro</button></div></div>`);
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
  raiz.querySelectorAll('[data-b]').forEach((b) => {
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); e[b.dataset.b] = true; b.classList.add('on'); });
    for (const n of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(n, () => { e[b.dataset.b] = false; b.classList.remove('on'); });
  });
  return e;
}
const sumar = (a, b) => { const s = { x: Math.max(-1, Math.min(1, a.x + b.x)), y: Math.max(-1, Math.min(1, a.y + b.y)) }; for (const k of ACCIONES) s[k] = !!(a[k] || b[k]); s.camara = a.camara; return s; };
// las teclas son de la pantalla: se pasan a la cancha según la cámara
function aCancha(inp, escena, eq) {
  let x = inp.x, z = inp.y;
  if (escena.modo === 'tercera') { const s = eq ? -1 : 1; x = -inp.y * s; z = inp.x * s; }
  const out = { x, z };
  for (const k of ACCIONES) if (inp[k]) out[k] = true;
  return out;
}
const AYUDA = '<kbd>WASD</kbd> moverse · <kbd>Shift</kbd> correr · <kbd>J</kbd> pase (sin pelota: quitar) · <kbd>K</kbd> tiro (mantené para cargar) · <kbd>L</kbd> barrida / pase largo · <kbd>Espacio</kbd> cambiar · <kbd>C</kbd> cámara · <kbd>Esc</kbd> pausa';

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
      </div>
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
  const conf = { formato: Number(leer('futbol.formato', 5)), minutos: Number(leer('futbol.minutos', 4)), dif: Number(leer('futbol.dif', 1)), cancha: leer('futbol.cancha', 'barrio') };
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
          ${dos ? '' : seg('Rivales', 'dif', conf.dif, [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']])}
          ${seg('Cancha', 'cancha', conf.cancha, CANCHAS.map((c) => [c.id, c.nombre]))}
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
      const op = s.dataset.op; conf[op] = op === 'cancha' ? b.dataset.v : Number(b.dataset.v);
      guardar('futbol.' + op, b.dataset.v); sfx('cursor'); pintar();
    })));
    app.querySelector('[data-jugar]')?.addEventListener('click', () => {
      const usados = new Set([p1, p2].filter(Boolean));
      const otro = () => { const libres = ROSTER.filter((x) => !usados.has(x)); const id = azarDe(libres.length ? libres : ROSTER); usados.add(id); return id; };
      const jugadores = [];
      for (const eq of [0, 1]) {
        jugadores.push({ id: `${eq}-0`, eq, npc: otro(), arquero: true });
        for (let k = 1; k < conf.formato; k++) {
          const humano = k === 1 && (eq === 0 || dos);
          jugadores.push({ id: `${eq}-${k}`, eq, npc: humano ? (eq === 0 ? p1 : p2) : otro() });
        }
      }
      const humanos = [{ hid: 'p1', eq: 0, pid: '0-1', cambia: true, perfil: dos ? 'j1' : 'solo', mando: 0 }];
      if (dos) humanos.push({ hid: 'p2', eq: 1, pid: '1-1', cambia: true, perfil: 'j2', mando: 1 });
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
    // tu jugador: nombre, aire y carga del remate
    const miId = Object.entries(v.mando || {}).find(([h]) => mios.includes(h))?.[1];
    const yo = v.jug.find((j) => j.id === miId);
    $('[data-yo]').classList.toggle('hidden', !yo);
    if (yo) {
      $('[data-yo-nombre]').textContent = nombre(yo.id);
      $('[data-yo-nombre]').style.color = COLOR_EQ[yo.eq];
      $('[data-aire]').style.width = Math.round((yo.energia ?? 1) * 100) + '%';
      $('[data-carga]').style.width = Math.round((yo.carga || 0) * 100) + '%';
    }
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
      } else if (['palo', 'atajada', 'cabezazo', 'volea'].includes(e.k)) {
        const txt = { palo: '¡PALO!', atajada: e.rebote ? '¡DA REBOTE!' : '¡QUÉ ATAJADA!', cabezazo: '¡CABEZAZO!', volea: '¡DE VOLEA!' }[e.k];
        $('[data-aviso]').textContent = txt; $('[data-aviso]').classList.remove('on'); void $('[data-aviso]').offsetWidth; $('[data-aviso]').classList.add('on'); avisoT = performance.now();
      } else if (e.k === 'final') {
        relator(v.ganador === null ? '¡Terminó! Empate.' : `¡Terminó! Ganó el ${NOMBRE_EQ[v.ganador]}.`);
      }
    }
    if (performance.now() - golT > 3000) $('[data-gol]').classList.remove('on');
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
  $('[data-pie]').innerHTML = dos ? 'J1 (Rojo): <kbd>WASD</kbd> <kbd>F</kbd> pase <kbd>G</kbd> tiro <kbd>H</kbd> barrida <kbd>R</kbd> cambio <kbd>Shift izq</kbd> correr &nbsp;|&nbsp; J2 (Azul): flechas <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>U</kbd> <kbd>Shift der</kbd>' : AYUDA;
  let m = null, pausa = false, raf = 0, viva = true, finMostrado = false;
  const nuevo = () => { m = nuevoPartido({ formato: conf.formato, jugadores, humanos, minutos: conf.minutos, dificultad: conf.dif ?? 1 }); finMostrado = false; };
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
  };
  addEventListener('keydown', tecla, true);
  limpiar.push(() => removeEventListener('keydown', tecla, true));
  $('[data-menu]').onclick = menuPausa;
  const finPanel = () => {
    capa.classList.remove('hidden');
    const g = m.ganador, gan = !dos && g === 0;
    const goleadores = m.jug.filter((j) => j.goles).sort((a, b) => b.goles - a.goles).map((j) => `${esc(nombreNpc(jugadores.find((x) => x.id === j.id).npc))} (${j.goles})`).join(', ');
    capa.innerHTML = `<div class="pf-caja"><div class="pf-festejo"><b>${g === null ? '¡Empate!' : dos ? `¡Ganó el ${NOMBRE_EQ[g]}!` : gan ? '¡Ganaste!' : 'Perdiste…'}</b><span>${m.marcador[0]} a ${m.marcador[1]}${goleadores ? ` · Goles: ${goleadores}` : ''}</span></div>
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
      if (m.fase === 'fin' && m.faseT > 4 && !finMostrado) { finMostrado = true; finPanel(); }
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
    for (const [eq, nom] of [[0, 'rojo'], [1, 'azul']]) {
      const personas = est.participantes.filter((p) => est.equipos[p] === nom);
      const bots = est.bots[nom] || [];
      lista.push({ id: `${eq}-arq`, eq, npc: bots[0] || ROSTER[0], arquero: true });
      for (const p of personas) { lista.push({ id: p, eq, npc: est.personaje[p] || ROSTER[0], jugador: nombreDe(p) }); humanos.push({ hid: p, eq, pid: p, cambia: personas.length === 1 }); }
      bots.slice(1).forEach((npc, k) => lista.push({ id: `${eq}-b${k}`, eq, npc }));
    }
    return { lista, humanos };
  }
  async function empezar() {
    partidoN = est.partidoN; avisado = false; vista = null;
    const { lista, humanos } = armarJugadores();
    jugadores = lista;
    m = nuevoPartido({ formato: est.formato, jugadores: lista, humanos, minutos: est.minutos, golesMax: est.golesMax, dificultad: est.dificultad });
    base = m;
    escena?.destruir();
    const lienzo = $('.pf-lienzo'); const nuevo = lienzo.cloneNode(); lienzo.replaceWith(nuevo);
    escena = crearEscena(nuevo, { cancha: est.cancha });
    escena.ponerCamara(leer('futbol.camara', 'tv'));
    $('[data-cargando]').classList.remove('hidden'); $('[data-cargando]').textContent = 'Marcando la cancha…';
    await escena.armar(m, lista).catch(() => {});
    $('[data-cargando]').classList.add('hidden');
    hud = crearHud(app, lista);
    tribuna(true);
  }

  function pintarPanel() {
    if (!est) return;
    const capa = $('[data-capa]'); capa.classList.remove('hidden');
    const host = est.host === est.yo, n = est.formato, cupo = n - 1;
    const de = (eq) => est.jugadores.filter((j) => j.online && est.equipos[j.id] === eq);
    const fila = (j) => `<li><img src="${foto(est.personaje[j.id] || ROSTER[0])}" data-npc="${est.personaje[j.id] || ROSTER[0]}" alt="">${esc(j.nombre)}${j.id === est.yo ? ' (vos)' : ''}${j.id === est.host ? ' ★' : ''}<em>${esc(nombreNpc(est.personaje[j.id]))}</em></li>`;
    const mio = est.personaje[est.yo], fin = est.fase === 'fin';
    const html = `<div class="pf-caja">
      ${fin ? `<div class="pf-festejo"><b>${est.ganador === null ? '¡Empate!' : `¡Ganó el ${NOMBRE_EQ[est.ganador]}!`}</b><span>${est.marcador[0]} a ${est.marcador[1]}</span></div>` : ''}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h2 style="margin-right:auto">Canchita ${code}</h2><button class="btn btn-chico" data-copiar>Copiar link</button><a class="btn btn-chico btn-borde" href="/futbol/" data-ir>Salir</a></div>
      <div class="pf-equipos">${['rojo', 'azul'].map((eq, k) => `<div class="pf-eq" style="--c:${COLOR_EQ[k]}"><h3>Equipo ${NOMBRE_EQ[k]} <small>${de(eq).length}/${cupo} + arquero</small></h3><ul>${de(eq).map(fila).join('')}${de(eq).length < cupo ? `<li><span style="color:#8d9483">+ ${cupo - de(eq).length} bots del club y el arquero</span></li>` : '<li><span style="color:#8d9483">+ arquero bot</span></li>'}</ul>${est.equipos[est.yo] === eq ? '<small style="color:#c5f04a;font-weight:700">Estás acá</small>' : `<button class="btn btn-chico" data-eq="${eq}">Pasarme acá</button>`}</div>`).join('')}</div>
      <p style="margin:0">Mirando: ${est.jugadores.filter((j) => j.online && est.equipos[j.id] === 'afuera').map((j) => esc(j.nombre)).join(', ') || 'nadie'} ${est.equipos[est.yo] !== 'afuera' ? '<button class="btn btn-chico btn-borde" data-eq="afuera">Solo mirar</button>' : ''}</p>
      <h3 style="margin:14px 0 0;font:900 18px 'Barlow Condensed',sans-serif;text-transform:uppercase">Tu jugador: <span style="color:${COLOR_JUEGO}">${esc(nombreNpc(mio))}</span></h3>
      <div class="pf-mini">${ROSTER.map((id) => `<button class="pf-cara ${mio === id ? 'p1' : ''}" data-pj="${id}"><img src="${foto(id)}" data-npc="${id}" alt="" loading="lazy"><span>${esc(nombreNpc(id))}</span></button>`).join('')}</div>
      <div class="pf-opciones">
        ${seg('Formato', 'formato', est.formato, [[5, 'F5'], [6, 'F6'], [7, 'F7'], [8, 'F8']], !host)}
        ${seg('Minutos', 'minutos', est.minutos, [[2, '2'], [4, '4'], [6, '6'], [8, '8']], !host)}
        ${seg('Bots', 'dificultad', est.dificultad, [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], !host)}
        ${seg('Cancha', 'cancha', est.cancha, CANCHAS.map((c) => [c.id, c.nombre]), !host)}
      </div>
      ${host ? `<div class="pf-listo"><button class="btn btn-lima btn-grande" data-empezar>${fin ? 'Revancha' : '¡A la cancha!'}</button></div>` : '<p class="pf-ayuda">Esperando que el anfitrión (★) arranque el partido…</p>'}
    </div>`;
    if (capa.dataset.firma === html) return;
    if (capa.contains(document.activeElement) && document.activeElement.matches('input')) return;
    capa.dataset.firma = html; capa.innerHTML = html;
    capa.querySelector('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado'); };
    capa.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'equipo', e: b.dataset.eq })));
    capa.querySelectorAll('[data-pj]').forEach((b) => (b.onclick = () => { guardar('futbol.personaje', b.dataset.pj); sfx('elegir'); sala.enviar({ t: 'personaje', id: b.dataset.pj }); }));
    capa.querySelectorAll('[data-op]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => sala.enviar({ t: 'config', [s.dataset.op]: s.dataset.op === 'cancha' ? b.dataset.v : Number(b.dataset.v) }))));
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
    if (m.fase === 'fin' && m.faseT > 4 && !avisado) { avisado = true; sala.enviar({ t: 'resultado', n: est.partidoN, marcador: m.marcador, goles: m.goles.map((g) => ({ eq: g.eq, autor: g.autor, contra: g.contra })) }); }
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
