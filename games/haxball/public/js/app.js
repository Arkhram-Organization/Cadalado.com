// Haxball de cadalado. El anfitrión simula la cancha y la manda a los demás; cada uno manda sus teclas.
// Cada jugador es una cabeza: la cara de su personaje sacada del modelo 3D, recortada en círculo.
import { Sala, marco, api, pid, esc, toast, sonar, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { POR_ID } from '/comun/npcs.js';
import { lookDeJugador } from '/comun/avatar.js';
import { caraRedonda } from '/comun/caras3d.js';
import { Red } from '/comun/red.js';
import { CANCHA, R_JUG, R_PEL, POSTES, nuevoMundo, acomodar, paso, pensarBot, codificar, decodificar } from './fisica.js';

const app = document.querySelector('#app');
const COLOR = '#4fd1c5';
const EQ = { rojo: '#e5484d', azul: '#3e7bfa' };
const cuenta = await marco({ juego: 'Haxball', color: COLOR, volver: '/haxball/' });
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
  document.body.classList.remove('en-cancha');
  const m = location.pathname.match(/^\/haxball\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase()); else menu();
}

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Haxball · cadalado';
  app.innerHTML = `
  <div class="menu">
    <div class="menu-hero"><div><span class="etq">Fútbol 2D por equipos · hasta 12</span><h1>Hax<em>ball.</em></h1>
      <p>Cada jugador es una cabeza: la tuya o la de tu personaje del club. Rojo contra azul, pelota al medio, patear con espacio. Gana el que llega primero a los goles o el que va arriba cuando se termina el tiempo.</p></div></div>
    <section class="panel">
      <h2>Armar un partido</h2>
      <form data-crear style="display:grid;gap:12px">
        ${cuenta ? '' : `<label><span class="etq">Tu nombre</span><input class="entrada" name="nombre" maxlength="20" required value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?"></label>`}
        <label><span class="etq">Bots (los personajes de cadalado)</span><select class="entrada" name="bots">${[0, 1, 2, 3, 5, 7].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label><span class="etq">Minutos</span><select class="entrada" name="minutos">${[2, 3, 5].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label><span class="etq">Goles para ganar</span><select class="entrada" name="goles">${[3, 5, 7].map((n) => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="publica" checked style="accent-color:${COLOR};width:18px;height:18px"> Pública (cualquiera puede entrar)</label>
        <button class="btn btn-lima btn-grande">Crear partido</button>
      </form>
    </section>
    <section class="panel">
      <h2>Entrar a un partido</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Entrar</button></form>
      <h2 style="margin-top:22px">Partidos abiertos</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
      <h2 style="margin-top:22px">Cómo se juega</h2>
      <p style="color:var(--blanco-2,#a7ad9e)"><kbd>W A S D</kbd> o flechas para moverte · <kbd>Espacio</kbd> o <kbd>X</kbd> para patear (mientras lo mantenés, corrés más lento) · en el celular, joystick y botón.</p>
    </section>
  </div>`;
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(f.get('nombre'));
    try {
      const { code } = await api('/api/haxball/crear', { pid: pid(), nombre: f.get('nombre'), opciones: { bots: +f.get('bots'), minutos: +f.get('minutos'), goles: +f.get('goles'), publica: f.get('publica') === 'on' } });
      ir(`/haxball/sala/${code}`);
    } catch (err) { toast(err.message, true); }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/haxball/sala/${c}`);
  };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/haxball/lobby');
      const el = app.querySelector('[data-salas]');
      if (!el) return;
      el.innerHTML = salas.length
        ? salas.map((s) => `<a class="sala-fila" href="/haxball/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR}">${s.jugadores}</span>
          <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Armando equipos' : s.fase === 'fin' ? 'Terminando' : 'Jugando ahora'} · ${s.bots} bots</small></span>
          <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay partidos abiertos. ¡Armá uno!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- partido
function abrirSala(code) {
  document.title = `Haxball ${code} · cadalado`;
  document.body.classList.add('en-cancha');
  app.innerHTML = `
  <div class="hx">
    <canvas data-cancha></canvas>
    <div class="capa hx-sala"><div class="chip-hud"><span class="etq">Sala</span><b>${esc(code)}</b><button class="btn btn-chico" data-copiar>Invitar</button></div></div>
    <div class="capa hx-marcador" data-marcador><span class="rojo" data-gr>0</span><span class="reloj" data-reloj>0:00</span><span class="azul" data-ga>0</span></div>
    <div class="capa hx-red chip-hud" data-red>● —</div>
    <div class="capa hx-gol" data-gol></div>
    <div class="capa hx-panel hidden" data-panel></div>
    <div class="capa hx-chat"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat… (Enter)" autocomplete="off"></form></div>
    <div class="capa hx-ayuda"><kbd>WASD</kbd> moverse · <kbd>Espacio</kbd> patear</div>
    <div class="hx-tactil"><div class="hx-joy" data-joy><i></i></div><button class="hx-patear" data-patear>PATEAR</button></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const lienzo = $('[data-cancha]');
  const g = lienzo.getContext('2d');
  $('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado. Mandáselo a tus amigos.'); };

  let est = null, fase = null;
  let mundo = nuevoMundo();
  let vista = null; // lo que se dibuja (en los que no son anfitrión: lo último que llegó)
  let golesLocales = 0; // goles que este anfitrión ya avisó y el servidor todavía no contó
  let golPausa = null;
  const entradas = new Map(); // id → entrada (anfitrión)
  const caras = new Map(); // id → canvas (cuando está lista)
  const yoId = () => est?.yo;
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id);
    return online.includes(est.host) ? est.host : online.sort()[0];
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;
  const nombreDe = (id) => (String(id).startsWith('bot') ? est?.botNombres?.[+String(id).slice(3)] : est?.jugadores.find((j) => j.id === id)?.nombre) || '—';
  const lookDe = (id) => String(id).startsWith('bot') ? { ...POR_ID[est.botNpc[+String(id).slice(3)]]?.look } : lookDeJugador(est.jugadores.find((j) => j.id === id), id, '#7aa2ff');
  function pedirCara(id) {
    if (caras.has(id) || !est) return;
    caras.set(id, null);
    caraRedonda(lookDe(id), 96).then((c) => { caras.set(id, c); pintarPanel(); }).catch(() => {});
  }

  // ---------------- red
  const red = { actual: null };
  function recibir(id, s) {
    if (typeof s !== 'string') return;
    if (s[0] === 'M') {
      if (id !== idAnfitrion() || soyAnfitrion()) return;
      const d = decodificar(s);
      if (d) vista = { ...d, llego: performance.now() };
    } else if (s[0] === 'I' && soyAnfitrion()) {
      const [x, y, k] = s.slice(1).split(',').map(Number);
      entradas.set(id, { x: Math.max(-1, Math.min(1, x || 0)), y: Math.max(-1, Math.min(1, y || 0)), patea: k === 1 });
    }
  }
  const sala = new Sala('/api/haxball', code, {
    intervalo: (e) => (e?.fase === 'partida' ? 1000 : 900),
    onEstado: (e) => {
      const antes = est;
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: () => {}, ruta: '/api/haxball', accionPlanB: 'mensaje' });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      if (antes && e.goles.length > (antes.goles?.length || 0)) golesLocales = Math.max(0, golesLocales - (e.goles.length - antes.goles.length));
      for (const j of e.jugadores) pedirCara(j.id);
      e.botNpc.forEach((_, i) => pedirCara('bot' + i));
      if (e.fase !== fase) cambioDeFase(e.fase);
      pintarPanel();
      marcador();
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k === 'msg') return;
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis'; d.textContent = ev.texto;
        if (/^¡GOL/.test(ev.texto)) cartel('¡GOL!', ev.texto.replace(/^¡GOL /, '').replace(/!.*$/, ''));
      } else { if (ev.bot) d.className = 'bot'; d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`; }
      log.append(d);
      while (log.children.length > 30) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => toast(m, true),
    onNoExiste: () => { toast('Ese partido no existe.', true); ir('/haxball/'); },
  });
  recordar('haxball', `/haxball/sala/${code}`, `Haxball ${code}`);
  $('[data-chat]').onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector('input'); if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value }); i.value = ''; i.blur(); };

  function cartel(t, sub = '') {
    const el = $('[data-gol]');
    el.innerHTML = `${esc(t)}<small>${esc(sub)}</small>`;
    el.classList.add('ver'); sonar('gana');
    clearTimeout(cartel.t); cartel.t = setTimeout(() => el.classList.remove('ver'), 2200);
  }
  function marcador() {
    if (!est) return;
    $('[data-gr]').textContent = est.marcador.rojo;
    $('[data-ga]').textContent = est.marcador.azul;
  }

  // ---------------- fases
  function armarMundo() {
    mundo = nuevoMundo();
    for (const id of est.participantes) mundo.jug.set(id, { x: 0, y: 0, vx: 0, vy: 0, equipo: est.equipos[id] || 'rojo' });
    est.botNpc.forEach((_, i) => mundo.jug.set('bot' + i, { x: 0, y: 0, vx: 0, vy: 0, equipo: est.botEquipo[i] || 'azul' }));
    acomodar(mundo);
    golesLocales = 0; golPausa = null;
  }
  function cambioDeFase(nueva) {
    fase = nueva;
    if (nueva === 'cuenta' || (nueva === 'partida' && !mundo.jug.size)) armarMundo();
    if (nueva === 'fin') cartel(est.ganador === 'empate' ? 'Empate' : `¡Ganó el ${est.ganador}!`, `${est.marcador.rojo} - ${est.marcador.azul}`);
    if (nueva === 'lobby') { mundo = nuevoMundo(); vista = null; }
    $('[data-panel]').classList.toggle('hidden', !(nueva === 'lobby' || nueva === 'fin'));
  }

  function pintarPanel() {
    if (!est || !(fase === 'lobby' || fase === 'fin')) return;
    const host = est.host === est.yo;
    const fila = (id, extra = '') => {
      const c = caras.get(id);
      return `<li>${c ? `<img src="${c.toDataURL()}" alt="">` : `<span class="avatar" style="width:30px;height:30px">·</span>`}${esc(nombreDe(id))}${id === est.yo ? ' <small>vos</small>' : extra}</li>`;
    };
    const de = (e) => est.jugadores.filter((j) => (est.equipos[j.id] || 'afuera') === e && j.online).map((j) => fila(j.id)).join('');
    const bots = est.botNpc.map((_, i) => 'bot' + i);
    const html = `<h2>${fase === 'fin' ? (est.ganador === 'empate' ? '¡Empate!' : `¡Ganó el ${est.ganador}!`) + ` ${est.marcador.rojo} - ${est.marcador.azul}` : 'Armen los equipos'}</h2>
      <p>${host ? 'Elegí equipo, sumá bots y arrancá.' : 'Elegí tu equipo. Arranca quien armó la sala.'} Los bots completan el equipo con menos gente.</p>
      <div class="hx-equipos">
        ${['rojo', 'azul', 'afuera'].map((e) => `<div class="hx-eq ${e}"><h3>${e === 'afuera' ? 'Mirando' : e === 'rojo' ? 'Rojo' : 'Azul'}<button class="btn btn-chico" data-eq="${e}">${est.equipos[est.yo] === e ? 'Acá estás' : 'Ir'}</button></h3><ul>${de(e)}</ul></div>`).join('')}
      </div>
      ${bots.length ? `<p style="margin:12px 0 0">Bots: ${bots.map((b) => esc(nombreDe(b))).join(', ')}</p>` : ''}
      <div class="hx-conf">
        ${host ? `<label>Bots<select class="entrada" data-conf="bots">${[0, 1, 2, 3, 5, 7].map((n) => `<option ${n === est.bots ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Minutos<select class="entrada" data-conf="minutos">${[2, 3, 5].map((n) => `<option ${n === est.minutos ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Goles<select class="entrada" data-conf="goles">${[3, 5, 7].map((n) => `<option ${n === est.golesMax ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <button class="btn btn-lima btn-grande" data-empezar>${fase === 'fin' ? 'Revancha' : '¡A jugar!'}</button>` : `<span style="color:#a7ad9e">${est.minutos} minutos · ${est.golesMax} goles</span>`}
      </div>`;
    const p = $('[data-panel]');
    if (p.dataset.firma === html) return;
    p.dataset.firma = html; p.innerHTML = html;
    p.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'equipo', e: b.dataset.eq })));
    p.querySelectorAll('[data-conf]').forEach((s) => (s.onchange = () => sala.enviar({ t: 'config', [s.dataset.conf]: +s.value })));
    p.querySelector('[data-empezar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
  }

  // ---------------- teclas y táctil
  const teclas = new Set();
  const joy = { x: 0, y: 0 };
  let pateaTactil = false;
  const abajo = (e) => {
    if (e.target.closest('input, select, textarea')) { if (e.code === 'Escape') e.target.blur(); return; }
    if (e.code === 'Enter') { $('[data-chat] input').focus(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    teclas.add(e.code);
  };
  const arriba = (e) => teclas.delete(e.code);
  addEventListener('keydown', abajo); addEventListener('keyup', arriba);
  const joyEl = $('[data-joy]');
  const moverJoy = (e) => {
    const r = joyEl.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    joy.x = x; joy.y = y; joyEl.querySelector('i').style.transform = `translate(${x * 38}px,${y * 38}px)`;
  };
  joyEl.addEventListener('pointerdown', (e) => { joyEl.setPointerCapture(e.pointerId); moverJoy(e); });
  joyEl.addEventListener('pointermove', (e) => e.buttons && moverJoy(e));
  joyEl.addEventListener('pointerup', () => { joy.x = joy.y = 0; joyEl.querySelector('i').style.transform = ''; });
  const pat = $('[data-patear]');
  pat.addEventListener('pointerdown', () => (pateaTactil = true));
  pat.addEventListener('pointerup', () => (pateaTactil = false));
  const miEntrada = () => {
    const x = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) + joy.x;
    const y = (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) - (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) + joy.y;
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), patea: teclas.has('Space') || teclas.has('KeyX') || pateaTactil };
  };

  // ---------------- dibujo
  const TOT_W = CANCHA.ancho + CANCHA.borde * 2, TOT_H = CANCHA.alto + CANCHA.borde * 2;
  let esc2 = 1;
  function medir() {
    const caja = app.querySelector('.hx');
    const k = Math.min(caja.clientWidth / TOT_W, (caja.clientHeight - 20) / TOT_H);
    const dpr = Math.min(devicePixelRatio, 2);
    lienzo.style.width = `${TOT_W * k}px`; lienzo.style.height = `${TOT_H * k}px`;
    lienzo.width = Math.round(TOT_W * k * dpr); lienzo.height = Math.round(TOT_H * k * dpr);
    esc2 = k * dpr;
  }
  medir(); addEventListener('resize', medir);
  function dibujar(m) {
    const W = CANCHA.ancho / 2, H = CANCHA.alto / 2, A = CANCHA.arco / 2;
    g.setTransform(esc2, 0, 0, esc2, esc2 * TOT_W / 2, esc2 * TOT_H / 2);
    // pasto con franjas
    g.fillStyle = '#3f6e2c'; g.fillRect(-TOT_W / 2, -TOT_H / 2, TOT_W, TOT_H);
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#4a7d33' : '#55893a'; g.fillRect(-W + (i * CANCHA.ancho) / 12, -H, CANCHA.ancho / 12, CANCHA.alto); }
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    g.strokeRect(-W, -H, CANCHA.ancho, CANCHA.alto);
    g.beginPath(); g.moveTo(0, -H); g.lineTo(0, H); g.stroke();
    g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) {
      // área y arco con red
      g.strokeRect(s < 0 ? -W : W - 90, -A - 40, 90, CANCHA.arco + 80);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(s < 0 ? -W - CANCHA.fondo : W, -A, CANCHA.fondo, CANCHA.arco);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      for (let y = -A; y <= A; y += 12) { g.beginPath(); g.moveTo(s * W, y); g.lineTo(s * (W + CANCHA.fondo), y); g.stroke(); }
      g.strokeStyle = s < 0 ? EQ.rojo : EQ.azul; g.lineWidth = 4;
      g.beginPath(); g.moveTo(s * W, -A); g.lineTo(s * (W + CANCHA.fondo), -A); g.lineTo(s * (W + CANCHA.fondo), A); g.lineTo(s * W, A); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    }
    for (const [px, py] of POSTES) { g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1.5; g.stroke(); }
    if (!m) return;
    // jugadores: la cabeza recortada con el aro del equipo
    for (const [id, j] of m.jug) {
      const color = EQ[j.equipo];
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(j.x + 3, j.y + 5, R_JUG, R_JUG * .8, 0, 0, Math.PI * 2); g.fill();
      const c = caras.get(id);
      if (c) g.drawImage(c, j.x - R_JUG, j.y - R_JUG, R_JUG * 2, R_JUG * 2);
      else { g.fillStyle = color; g.beginPath(); g.arc(j.x, j.y, R_JUG, 0, Math.PI * 2); g.fill(); }
      g.lineWidth = j.patea ? 4 : 3; g.strokeStyle = j.patea ? '#fff' : color;
      g.beginPath(); g.arc(j.x, j.y, R_JUG + (j.patea ? 1 : 0), 0, Math.PI * 2); g.stroke();
      if (id === yoId()) { g.strokeStyle = '#c5f04a'; g.lineWidth = 2; g.beginPath(); g.arc(j.x, j.y, R_JUG + 6, 0, Math.PI * 2); g.stroke(); }
      g.font = '600 11px Barlow, Arial'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.92)';
      g.fillText(nombreDe(id), j.x, j.y + R_JUG + 14);
    }
    const p = m.pelota;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(p.x + 2, p.y + 4, R_PEL, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, R_PEL, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 2; g.stroke();
  }

  // ---------------- bucle
  let raf, ultimo = performance.now(), envio = 0;
  // simulación del anfitrión: aparte del dibujo, con reloj real (si la pestaña dibuja lento, la cancha no se frena)
  let acum = 0, ultSim = performance.now();
  function simular() {
    const ahoraS = performance.now();
    const dtS = Math.min(.5, (ahoraS - ultSim) / 1000); ultSim = ahoraS;
    if (!est || !soyAnfitrion() || !(fase === 'partida' || fase === 'cuenta')) { acum = 0; return; }
    if (!mundo.jug.size) armarMundo();
    entradas.set(est.yo, miEntrada());
    if (fase !== 'partida') return;
    acum += dtS;
    while (acum >= 1 / 60) {
      acum -= 1 / 60;
      for (const id of mundo.jug.keys()) if (id.startsWith('bot')) entradas.set(id, pensarBot(mundo, id, ahoraS / 1000));
      const gol = paso(mundo, entradas);
      if (gol) {
        sala.enviar({ t: 'gol', e: gol, autor: mundo.ultimoToque || '', n: est.goles.length + golesLocales });
        golesLocales++;
        mundo.pausa = 150; golPausa = gol;
      }
      if (golPausa && mundo.pausa === 1) { acomodar(mundo, golPausa === 'rojo' ? 'azul' : 'rojo'); golPausa = null; }
    }
    if (ahoraS - envio > 45) { envio = ahoraS; red.actual?.enviar(codificar(mundo)); }
  }
  const sim = setInterval(simular, 1000 / 60);
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(.1, (ms - ultimo) / 1000); ultimo = ms;
    if (!est) return;
    const t = (sala.ahora() - est.inicio) / 1000;
    const quedan = Math.max(0, est.minutos * 60 - Math.max(0, t));
    $('[data-reloj]').textContent = fase === 'cuenta' ? `${Math.ceil(-t)}` : `${Math.floor(quedan / 60)}:${String(Math.floor(quedan % 60)).padStart(2, '0')}`;
    const juego = fase === 'partida';
    if (soyAnfitrion() && (juego || fase === 'cuenta')) {
      dibujar(mundo);
    } else {
      // los demás: mandan sus teclas y dibujan lo que llega (avanzado un poquito con la velocidad)
      if (juego && est.participantes.includes(est.yo) && ms - envio > 45) { envio = ms; const e = miEntrada(); red.actual?.enviar(`I${e.x.toFixed(2)},${e.y.toFixed(2)},${e.patea ? 1 : 0}`); }
      if (vista && juego) {
        const k = Math.min(.1, (performance.now() - vista.llego) / 1000) * 60;
        const m = { pelota: { ...vista.pelota, x: vista.pelota.x + vista.pelota.vx * k, y: vista.pelota.y + vista.pelota.vy * k }, jug: new Map() };
        for (const [id, j] of vista.jug) m.jug.set(id, { ...j, x: j.x + j.vx * k, y: j.y + j.vy * k });
        // si el anfitrión se va, el que sigue arranca desde lo último que vio
        mundo = { ...mundo, pelota: { ...vista.pelota }, jug: new Map([...vista.jug].map(([id, j]) => [id, { ...j }])) };
        dibujar(m);
      } else dibujar(fase === 'cuenta' ? mundo : null);
    }
    const c = red.actual?.estadoConexiones?.();
    if (c) $('[data-red]').textContent = c.total ? `● ${c.directas}/${c.total} directas` : '● solo vos';
  }
  raf = requestAnimationFrame(cuadro);
  window.__haxball = { get estado() { return est; }, get mundo() { return mundo; }, get vista() { return vista; }, get caras() { return caras; } };
  limpiar.push(() => {
    sala.cerrar(); red.actual?.cerrar(); cancelAnimationFrame(raf); clearInterval(sim);
    removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); removeEventListener('resize', medir);
  });
}

ruteo();
