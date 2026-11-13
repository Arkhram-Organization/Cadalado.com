// Haxball de cadalado, igual al HaxBall original: mismos estadios, física y saques; las fichas son la cabeza
// de cada personaje (sacada de su modelo 3D). Modos: entrenamiento, local 1v1 en la misma pantalla y online.
// Online: el anfitrión simula y manda la cancha por WebRTC; cada uno manda sus teclas; los goles los cuenta el servidor.
import { Sala, marco, api, pid, esc, toast, sonar, recordar, nombreGuardado, guardarNombre, lookGuardado } from '/comun/sala.js';
import { abrirAgregarBots, textoBots, botonAgregarBots, botsDeSala } from '/comun/elegir-npcs.js';
import { POR_ID } from '/comun/npcs.js';
import { lookDeJugador } from '/comun/avatar.js';
import { lookParaDibujo } from '/comun/look.js';
import { caraRedonda } from '/comun/caras3d.js';
import { Red } from '/comun/red.js';
import { ESTADIOS, COLOR, R_JUG, R_PEL, estadio, nuevoMundo, acomodar, paso, pensarBot, codificar, decodificar } from './fisica.js';
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { fondoMenu } from '/comun/fondo-menu.js';

const app = document.querySelector('#app');
const COLOR_JUEGO = '#4fd1c5';
const NOMBRE_EQ = { rojo: 'Rojo', azul: 'Azul' };
const cuenta = await marco({ juego: 'Haxball', color: COLOR_JUEGO, volver: '/haxball/' });
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
  if (m) abrirSala(m[1].toUpperCase());
  else if (/^\/haxball\/local/.test(location.pathname)) abrirLocal(false);
  else if (/^\/haxball\/entrenar/.test(location.pathname)) abrirLocal(true);
  else menu();
}

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Haxball · cadalado';
  app.innerHTML = `
  <div class="menu hx-menu">
    <div class="menu-hero"><div><span class="etq">HaxBall, con la física del original</span><h1>Hax<em>ball.</em></h1>
      <p>Dos equipos, una pelota y mucho caos. Mismos estadios, mismos saques y la misma física que el HaxBall de siempre, pero cada ficha es la cabeza de tu personaje.</p>
      <div class="hx-chips"><span>1 a 20 jugadores</span><span>3 a 10 minutos</span><span>Teclado</span></div></div></div>
    <section class="panel">
      ${cuenta ? '' : `<h2>1. Tu nombre</h2><input class="entrada" data-nombre maxlength="20" value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?" style="margin-bottom:18px">`}
      <h2>${cuenta ? '' : '2. '}Elegí cómo jugar</h2>
      <div class="hx-modos">
        <a class="hx-modo" href="/haxball/entrenar" data-ir><b>Entrenamiento</b><span>Practicá solo en la cancha, con todos los estadios.</span><small>WASD y patada con Espacio, Shift izq o Ctrl izq</small></a>
        <a class="hx-modo" href="/haxball/local" data-ir><b>Local 1 contra 1</b><span>Enfrentate 1v1 contra un amigo en la misma compu, sin internet.</span><small>Rojo: WASD + Espacio · Azul: flechitas + Enter, Shift der o Ctrl der</small></a>
        <form class="hx-modo" data-crear><b>Sala online</b><span>Creá una sala y compartí el link. Los bots del club completan los equipos.</span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn btn-chico btn-borde" data-agregar-bots></button>
          <label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="publica" checked style="accent-color:${COLOR_JUEGO}"> Pública</label>
          <button class="btn btn-lima">Crear sala de Haxball</button></span></form>
      </div>
    </section>
    <section class="panel">
      <h2>Unirse a una sala</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Unirme</button></form>
      <h2 style="margin-top:22px">Salas abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
    </section>
  </div>`;
  limpiar.push(fondoMenu(app.querySelector('.menu'), { dibujar: partidoDeFondo }));
  const nombre = () => app.querySelector('[data-nombre]')?.value.trim();
  app.querySelector('[data-nombre]')?.addEventListener('change', () => guardarNombre(nombre()));
  const botsMenu = botonAgregarBots(app.querySelector('[data-agregar-bots]'), { max: 19, azar: 1, color: COLOR_JUEGO });
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(nombre());
    try {
      const { code } = await api('/api/haxball/crear', { pid: pid(), nombre: nombre(), opciones: { bots: botsMenu.bots, npcs: botsMenu.npcs, publica: f.get('publica') === 'on' } });
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
        ? salas.map((s) => `<a class="sala-fila" href="/haxball/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR_JUEGO}">${s.jugadores}</span>
          <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Armando equipos' : s.fase === 'fin' ? 'Terminando' : 'Jugando ahora'} · ${s.bots} bots</small></span>
          <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay salas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// Fondo del menú: un partido de bots del club, frenado en una jugada (como en pausa)
function partidoDeFondo(canvas) {
  const m = nuevoMundo('big');
  const npcs = ['glinsky', 'julo', 'faur', 'volcho', 'angeles', 'olcho', 'mati', 'dobro'];
  npcs.forEach((n, i) => m.jug.set('bot' + n, { x: 0, y: 0, vx: 0, vy: 0, equipo: i % 2 ? 'azul' : 'rojo' }));
  acomodar(m, 'rojo');
  for (let k = 0; k < 520; k++) { const e = new Map(); for (const id of m.jug.keys()) e.set(id, pensarBot(m, id, k / 60)); paso(m, e); if (m.gol) { m.gol = null; acomodar(m, 'azul'); } }
  const caras = new Map();
  const g = canvas.getContext('2d');
  const pintar = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, r.width * Math.min(2, devicePixelRatio)); canvas.height = Math.max(200, r.height * Math.min(2, devicePixelRatio));
    // la cancha corrida a la derecha, para que el menú quede a la izquierda
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#718C5A'; g.fillRect(0, 0, canvas.width, canvas.height);
    const ancho = canvas.width;
    canvas.width = ancho;
    const c2 = document.createElement('canvas'); c2.width = Math.round(ancho * 0.72); c2.height = canvas.height;
    dibujarCancha(c2.getContext('2d'), c2, m, { yo: null, nombre: (id) => POR_ID[id.slice(3)]?.nombre || '', cara: (id) => caras.get(id) });
    g.fillStyle = '#718C5A'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(c2, ancho - c2.width, 0);
  };
  pintar();
  for (const n of npcs) caraRedonda({ ...POR_ID[n]?.look }, 96).then((c) => { caras.set('bot' + n, c); pintar(); }).catch(() => {});
  addEventListener('resize', pintar);
  return () => removeEventListener('resize', pintar);
}

// ---------------------------------------------------------------- cancha (común a todos los modos)
// Dibujo como HaxBall: fondo verde, pasto a franjas, líneas claras, redes negras, postes de color,
// discos con borde negro (blanco al patear), nombre abajo y un aro tenue alrededor del tuyo.
const LINEA = '#C7E6BD';
let patron = null;
function pasto(g) {
  if (!patron) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#718C5A'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#6E8958'; x.fillRect(0, 0, 64, 128);
    let t = 7;
    for (let n = 0; n < 420; n++) { t = (t * 16807) % 2147483647; const r = t % 128; t = (t * 16807) % 2147483647; x.fillStyle = n % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'; x.fillRect(r, t % 128, 2, 2); }
    patron = c;
  }
  return g.createPattern(patron, 'repeat');
}
function rectRedondo(g, x, y, w, h, r) {
  const X = x + w, Y = y + h;
  g.beginPath(); g.moveTo(X - r, y); g.arcTo(X, y, X, y + r, r); g.lineTo(X, Y - r); g.arcTo(X, Y, X - r, Y, r);
  g.lineTo(x + r, Y); g.arcTo(x, Y, x, Y - r, r); g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
}
function dibujarCancha(g, lienzo, m, { yo, nombre, cara, cartel }) {
  const est = m.est, w = lienzo.width, h = lienzo.height;
  const zoom = Math.min(w / (est.ancho * 2 + 30), h / (est.alto * 2 + 30));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#718C5A'; g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2); g.scale(zoom, zoom);
  g.lineWidth = 3; g.strokeStyle = LINEA;
  g.fillStyle = pasto(g);
  rectRedondo(g, -est.campoW, -est.campoH, est.campoW * 2, est.campoH * 2, est.esquina || 0.01);
  g.save(); g.scale(2, 2); g.fill(); g.restore(); g.stroke();
  g.beginPath(); g.moveTo(0, -est.campoH); g.lineTo(0, est.campoH); g.stroke();
  g.beginPath(); g.arc(0, 0, est.saque, 0, Math.PI * 2); g.stroke();
  // redes
  g.strokeStyle = '#000';
  for (const pts of est.dibujo) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); }
  if (!m) return;
  g.lineWidth = 2;
  // nombres de los demás y aro tenue del tuyo
  for (const [id, j] of m.jug) {
    if (id === yo) { g.beginPath(); g.strokeStyle = 'white'; g.globalAlpha = 0.3; g.arc(j.x, j.y, 25, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; continue; }
    g.font = '13px sans-serif'; g.fillStyle = 'white'; g.textAlign = 'center'; g.fillText(nombre(id), j.x, j.y + 30.5, 80);
  }
  // jugadores: la cabeza adentro del disco del color del equipo
  for (const [id, j] of m.jug) {
    g.beginPath(); g.arc(j.x, j.y, R_JUG, 0, Math.PI * 2); g.fillStyle = COLOR[j.equipo] || '#ddd'; g.fill();
    const c = cara(id);
    // la cara adentro, dejando un aro grueso del color del equipo
    if (c) { const rc = R_JUG - 4; g.save(); g.beginPath(); g.arc(j.x, j.y, rc, 0, Math.PI * 2); g.clip(); g.drawImage(c, j.x - rc, j.y - rc, rc * 2, rc * 2); g.restore(); }
    g.beginPath(); g.arc(j.x, j.y, R_JUG, 0, Math.PI * 2); g.strokeStyle = j.patea ? 'white' : 'black'; g.stroke();
  }
  const p = m.pelota;
  g.beginPath(); g.arc(p.x, p.y, R_PEL, 0, Math.PI * 2); g.fillStyle = '#FFFFFF'; g.fill(); g.strokeStyle = 'black'; g.stroke();
  for (const q of est.postes) { g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fillStyle = q.color; g.fill(); g.strokeStyle = 'black'; g.stroke(); }
  // cartel de gol animado
  if (cartel) {
    const t = (performance.now() - cartel.desde) / 1000;
    if (t < 2.4) {
      g.setTransform(1, 0, 0, 1, w / 2, h / 2);
      const k = Math.min(1, t * 4), sale = t > 1.9 ? (t - 1.9) * 2 : 0;
      g.globalAlpha = 1 - sale;
      g.font = `900 ${Math.round(70 * Math.min(w / 900, 1.3))}px 'Arial Black','Arial Bold',Gadget,sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const x = (1 - k) * -w * 0.6 + sale * w * 0.6;
      g.fillStyle = 'black'; g.fillText(cartel.texto, x + 7, 7);
      g.fillStyle = cartel.color; g.fillText(cartel.texto, x, 0);
      g.globalAlpha = 1;
    }
  }
}
// teclado: J1 (WASD + Espacio/ShiftIzq/CtrlIzq) y J2 (flechas + Enter/ShiftDer/CtrlDer)
function teclado() {
  const t = new Set();
  const abajo = (e) => {
    if (e.target.closest?.('input, select, textarea')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    t.add(e.code);
  };
  const arriba = (e) => t.delete(e.code);
  addEventListener('keydown', abajo); addEventListener('keyup', arriba);
  addEventListener('blur', () => t.clear());
  return {
    j1: () => ({ x: (t.has('KeyD') ? 1 : 0) - (t.has('KeyA') ? 1 : 0), y: (t.has('KeyS') ? 1 : 0) - (t.has('KeyW') ? 1 : 0), patea: t.has('Space') || t.has('ShiftLeft') || t.has('ControlLeft') || t.has('KeyX') }),
    j2: () => ({ x: (t.has('ArrowRight') ? 1 : 0) - (t.has('ArrowLeft') ? 1 : 0), y: (t.has('ArrowDown') ? 1 : 0) - (t.has('ArrowUp') ? 1 : 0), patea: t.has('Enter') || t.has('ShiftRight') || t.has('ControlRight') || t.has('NumpadEnter') }),
    solo: () => ({ x: (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0), y: (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0) - (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0), patea: t.has('Space') || t.has('ShiftLeft') || t.has('ControlLeft') || t.has('KeyX') }),
    destruir: () => { removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); },
  };
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function htmlCancha() {
  return `
  <div class="hx">
    <div class="hx-barra"><span class="hx-cuad rojo"></span><b data-marca>0 - 0</b><span class="hx-cuad azul"></span><span class="hx-tiempo" data-tiempo>00:00</span>
      <span class="hx-info" data-info></span><button class="hx-menu-btn" data-menu>Menú (ESC)</button></div>
    <div class="hx-lienzo"><canvas data-cancha></canvas><div class="hx-cuenta hidden" data-cuenta-inicio></div></div>
    <div class="hx-panel hidden" data-panel></div>
    <div class="hx-esc hidden" data-esc></div>
    <div class="hx-pie" data-pie></div>
    <div class="hx-chat hidden" data-chatbox><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat… (Enter)" autocomplete="off"></form></div>
    <div class="hx-tactil"><div class="hx-joy" data-joy><i></i></div><button class="hx-patear" data-patear>PATEAR</button></div>
  </div>`;
}
function festejo(raiz, miembros) {
  if (!miembros.length) return () => {};
  const lienzo = raiz.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({canvas:lienzo,alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff7df','#4b6555',2));
  const luz = new THREE.DirectionalLight('#fff1cc',2);luz.position.set(-3,6,5);scene.add(luz);
  const camera = new THREE.PerspectiveCamera(35,1,.1,60);
  const escala=Math.min(1,7/miembros.length);
  const personajes=miembros.map((m,i)=>{
    const p=crearPersona(THREE,m.look,{sombras:false});
    p.grupo.scale.setScalar(escala);
    p.grupo.position.x=(i-(miembros.length-1)/2)*1.2*escala;
    scene.add(p.grupo);
    return p;
  });
  let raf,antes=performance.now();
  const cuadro=(ms)=>{
    raf=requestAnimationFrame(cuadro);
    const dt=Math.min(.05,(ms-antes)/1000);antes=ms;
    const w=lienzo.clientWidth,h=lienzo.clientHeight;
    if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(0,1.7,Math.max(5,miembros.length*0.75));camera.lookAt(0,.9,0);camera.updateProjectionMatrix();}
    personajes.forEach((p,i)=>{p.animar({festeja:true},dt);p.grupo.rotation.y=Math.PI+Math.sin(ms/900+i)*.22;});
    renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(cuadro);
  return ()=>{cancelAnimationFrame(raf);personajes.forEach(p=>p.dispose?.());renderer.dispose();};
}
function medidor(lienzo) {
  const medir = () => {
    const caja = lienzo.parentElement;
    const dpr = Math.min(devicePixelRatio, 2);
    lienzo.width = Math.round(caja.clientWidth * dpr); lienzo.height = Math.round(caja.clientHeight * dpr);
    lienzo.style.width = caja.clientWidth + 'px'; lienzo.style.height = caja.clientHeight + 'px';
  };
  medir(); addEventListener('resize', medir);
  return () => removeEventListener('resize', medir);
}
function tactil(raiz) {
  const joy = { x: 0, y: 0, patea: false };
  const el = raiz.querySelector('[data-joy]');
  const mover = (e) => {
    const r = el.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    joy.x = x; joy.y = y; el.querySelector('i').style.transform = `translate(${x * 38}px,${y * 38}px)`;
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); mover(e); });
  el.addEventListener('pointermove', (e) => e.buttons && mover(e));
  el.addEventListener('pointerup', () => { joy.x = joy.y = 0; el.querySelector('i').style.transform = ''; });
  const p = raiz.querySelector('[data-patear]');
  p.addEventListener('pointerdown', () => (joy.patea = true)); p.addEventListener('pointerup', () => (joy.patea = false));
  return joy;
}
const sumar = (a, b) => ({ x: Math.max(-1, Math.min(1, a.x + b.x)), y: Math.max(-1, Math.min(1, a.y + b.y)), patea: a.patea || b.patea });

// ---------------------------------------------------------------- local: entrenamiento o 1v1 en la misma compu
function abrirLocal(entrenar) {
  document.title = (entrenar ? 'Entrenamiento' : 'Partida local') + ' · Haxball · cadalado';
  document.body.classList.add('en-cancha');
  app.innerHTML = htmlCancha();
  const $ = (s) => app.querySelector(s);
  const lienzo = $('[data-cancha]'), g = lienzo.getContext('2d');
  const soltar = medidor(lienzo);
  const tec = teclado(), joy = tactil(app);
  const yo = nombreGuardado() || 'Vos';
  const looks = { j1: lookParaDibujo(lookGuardado() || {}), j2: { ...POR_ID.julo.look } };
  try { looks.j1 = lookParaDibujo(JSON.parse(localStorage.getItem('cadalado.look'))) ; } catch {}
  const caras = new Map();
  for (const [id, l] of Object.entries(looks)) caraRedonda(l, 96).then((c) => caras.set(id, c)).catch(() => {});
  let conf = { estadio: 'classic', minutos: 0, goles: 0 };
  let mundo = null, marcador = { rojo: 0, azul: 0 }, cartel = null, inicio = 0, finGol = 0, jugando = false, ganadorLocal = null;
  let limpiarFestejo = () => {};
  const nombre = (id) => (id === 'j1' ? yo : 'Jugador 2');
  function panel() {
    limpiarFestejo(); limpiarFestejo = () => {};
    $('[data-panel]').classList.remove('hidden');
    $('[data-panel]').innerHTML = `${ganadorLocal ? `<div class="hx-festejo"><b>¡Ganó el equipo ${NOMBRE_EQ[ganadorLocal]}!</b><canvas></canvas><span>${ganadorLocal === 'rojo' ? esc(yo) : 'Jugador 2'} festeja la victoria</span></div>` : ''}<h2>${entrenar ? 'Entrenamiento' : 'Partida local'}</h2>
      <p>${entrenar ? 'Practicá solo: WASD y patada con Espacio, Shift o Ctrl izquierdos.' : 'Partida 1v1 en la misma pantalla. J1: WASD + Espacio, Shift o Ctrl izquierdos · J2: flechitas + Enter, Shift o Ctrl derechos.'}</p>
      ${modificadores(conf, true)}
      <button class="btn btn-lima btn-grande hx-iniciar" data-iniciar>¡Iniciar partido!</button>`;
    engancharModificadores($('[data-panel]'), (c) => (conf = { ...conf, ...c }));
    $('[data-iniciar]').onclick = empezar;
    if(ganadorLocal)limpiarFestejo=festejo($('[data-panel] .hx-festejo'),[{look:looks[ganadorLocal==='rojo'?'j1':'j2']}]);
  }
  function empezar() {
    limpiarFestejo();ganadorLocal=null;
    mundo = nuevoMundo(conf.estadio);
    mundo.jug.set('j1', { x: 0, y: 0, vx: 0, vy: 0, equipo: 'rojo' });
    if (!entrenar) mundo.jug.set('j2', { x: 0, y: 0, vx: 0, vy: 0, equipo: 'azul' });
    acomodar(mundo, 'rojo');
    if (entrenar) mundo.saque = null;
    marcador = { rojo: 0, azul: 0 }; inicio = performance.now()+3500; jugando = true;
    $('[data-panel]').classList.add('hidden');
    $('[data-pie]').innerHTML = entrenar ? 'WASD (mover) · ESPACIO / SHIFT Izq / CTRL Izq (patada) | ESC menú' : '<i class="hx-pt rojo"></i> J1 (Rojo): WASD · ESPACIO / SHIFT Izq / CTRL Izq  |  <i class="hx-pt azul"></i> J2 (Azul): Flechas · ENTER / SHIFT Der / CTRL Der  |  ESC menú';
  }
  function terminar() {
    jugando = false;
    const gana = marcador.rojo === marcador.azul ? null : marcador.rojo > marcador.azul ? 'rojo' : 'azul';
    ganadorLocal = gana;
    if (!entrenar) cartel = { texto: gana ? `¡Ganó el ${NOMBRE_EQ[gana]}!` : '¡Empate!', color: gana ? COLOR[gana] : '#fff', desde: performance.now() };
    setTimeout(panel, 2400);
  }
  menuEsc($, { terminar: () => jugando && terminar() });
  panel();
  let acum = 0, ultimo = performance.now(), raf;
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.25, (ms - ultimo) / 1000); ultimo = ms;
    const restante=Math.max(0,Math.ceil((inicio-ms)/1000));
    $('[data-cuenta-inicio]').classList.toggle('hidden',!jugando||restante===0);
    if(jugando&&restante)$('[data-cuenta-inicio]').textContent=`El partido empieza en ${restante}`;
    if (mundo && jugando && ms >= inicio) {
      acum += dt;
      while (acum >= 1 / 60) {
        acum -= 1 / 60;
        const e = new Map([['j1', sumar(entrenar ? tec.solo() : tec.j1(), joy)]]);
        if (!entrenar) e.set('j2', tec.j2());
        const gol = paso(mundo, e);
        if (gol) {
          marcador[gol]++; sonar('gana');
          cartel = { texto: `¡Gol del ${NOMBRE_EQ[gol]}!`, color: COLOR[gol], desde: performance.now() };
          finGol = performance.now() + 2500;
          if (conf.goles && marcador[gol] >= conf.goles) { terminar(); break; }
        }
        if (finGol && performance.now() > finGol) { finGol = 0; mundo.gol = null; acomodar(mundo, mundo.pelota.x < 0 ? 'rojo' : 'azul'); if (entrenar) mundo.saque = null; }
      }
      const seg = (ms - inicio) / 1000;
      if (conf.minutos && seg >= conf.minutos * 60 && jugando) terminar();
      $('[data-tiempo]').textContent = mmss(seg);
    }
    $('[data-marca]').textContent = `${marcador.rojo} - ${marcador.azul}`;
    dibujarCancha(g, lienzo, mundo || { est: estadio(conf.estadio), jug: new Map(), pelota: { x: 0, y: 0 } }, { yo: 'j1', nombre, cara: (id) => caras.get(id), cartel });
  }
  raf = requestAnimationFrame(cuadro);
  limpiar.push(() => { cancelAnimationFrame(raf); limpiarFestejo(); tec.destruir(); soltar(); });
}

// panel de modificadores (minutos, goles y estadio), igual para local y online
function modificadores(c, puede) {
  return `<div class="hx-mods"><h3>Modificadores de la partida <small>${puede ? 'Solo vos, como anfitrión, podés cambiarlos.' : 'Los cambia el anfitrión.'}</small></h3>
    <div class="hx-cond"><label>⏱️ Minutos de partido (0 = ilimitado)<input class="entrada" type="number" min="0" max="30" value="${c.minutos}" data-mod="minutos" ${puede ? '' : 'disabled'}><small>${c.minutos ? `${c.minutos} minutos` : 'Tiempo ilimitado'}</small></label>
    <label>🎯 Goles para ganar (0 = ilimitado)<input class="entrada" type="number" min="0" max="30" value="${c.goles}" data-mod="goles" ${puede ? '' : 'disabled'}><small>${c.goles ? `A ${c.goles} goles` : 'Goles ilimitados'}</small></label></div>
    <span class="hx-sub">Estadio</span>
    <div class="hx-estadios">${ESTADIOS.map((e) => `<button type="button" class="${c.estadio === e.id ? 'on' : ''}" data-estadio="${e.id}" ${puede ? '' : 'disabled'}>${e.nombre}</button>`).join('')}</div>
    <small class="hx-nota">Los estadios que trae HaxBall: Classic para 1v1 a 3v3, Big y Huge para equipos más grandes.</small></div>`;
}
function engancharModificadores(raiz, cambio) {
  raiz.querySelectorAll('[data-mod]').forEach((i) => (i.onchange = () => { const v = Math.max(0, Math.min(30, Math.round(+i.value || 0))); cambio({ [i.dataset.mod]: v }); i.nextElementSibling.textContent = i.dataset.mod === 'minutos' ? (v ? `${v} minutos` : 'Tiempo ilimitado') : v ? `A ${v} goles` : 'Goles ilimitados'; }));
  raiz.querySelectorAll('[data-estadio]').forEach((b) => (b.onclick = () => { raiz.querySelectorAll('[data-estadio]').forEach((x) => x.classList.toggle('on', x === b)); cambio({ estadio: b.dataset.estadio }); }));
}
function menuEsc($, { terminar, puedeTerminar = () => true, salir = '/haxball/' }) {
  const el = $('[data-esc]');
  const mostrar = (v) => {
    el.querySelector('[data-terminar]')?.classList.toggle('hidden', !puedeTerminar());
    // reiniciar (vuelve a la configuración) y cambiar de juego con la lobby, como en el menú de los demás juegos
    el.querySelector('[data-reiniciar]')?.classList.toggle('hidden', !window.__reiniciar?.puede?.());
    const lobby = window.__lobby;
    const cj = el.querySelector('[data-cambiar-juego]');
    if (cj) {
      cj.classList.toggle('hidden', !((lobby?.miembros || 0) >= 2));
      cj.disabled = !lobby?.soyLider;
      cj.querySelector('small').textContent = lobby?.soyLider ? 'Elegí otro juego y entran todos los de tu lobby juntos.' : `Lo elige ${lobby?.lider || 'el líder'}, el líder de tu lobby.`;
    }
    el.classList.toggle('hidden', !v);
  };
  el.innerHTML = `<div><header><span>Haxball · pausa</span><button data-volver aria-label="Cerrar">×</button></header><h3>¿Qué querés hacer?</h3><p>El partido sigue para los demás mientras tenés abierto este menú.</p>
    <div class="hx-esc-opciones"><button data-volver><b>▶ Seguir jugando</b><small>Volvé a la cancha.</small></button><button data-copiar><b>↗ Invitar a alguien</b><small>Copiá el enlace de la sala.</small></button><button data-audio><b>♪ Sonido</b><small>${localStorage.getItem('cadalado.audio')==='silencio'?'Apagado':'Activado'}</small></button><button data-full><b>⛶ Pantalla completa</b><small>Ampliá la cancha.</small></button>${terminar ? '<button data-terminar><b>■ Terminar partido</b><small>Solo el anfitrión puede cerrar esta partida.</small></button>' : ''}<a href="${salir}" data-ir><b>↩ Salir de Haxball</b><small>Volvé al menú del juego.</small></a></div>
    <div class="hx-esc-ayuda"><b>Controles</b> · WASD o flechas para moverte · Espacio, Shift, Ctrl o X para patear · Enter para chatear.</div></div>`;
  el.querySelectorAll('[data-volver]').forEach(b=>b.onclick = () => mostrar(false));
  el.querySelector('[data-copiar]').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);el.querySelector('[data-copiar] small').textContent='¡Enlace copiado!';}catch{el.querySelector('[data-copiar] small').textContent='Copiá la URL del navegador';}};
  el.querySelector('[data-audio]').onclick=()=>{const silencio=localStorage.getItem('cadalado.audio')==='silencio';localStorage.setItem('cadalado.audio',silencio?'activo':'silencio');el.querySelector('[data-audio] small').textContent=silencio?'Activado':'Apagado';};
  el.querySelector('[data-full]').onclick=()=>document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.().catch(()=>{});
  el.querySelector('[data-terminar]')?.addEventListener('click', () => { mostrar(false); terminar(); });
  const opciones = el.querySelector('.hx-esc-opciones');
  opciones.insertAdjacentHTML('beforeend', '<button data-reiniciar class="hidden"><b>↻ Reiniciar partida</b><small>Todos vuelven a la configuración de la partida.</small></button><button data-cambiar-juego class="hidden"><b>⇄ Cambiar de juego</b><small></small></button>');
  el.querySelector('[data-reiniciar]').onclick = () => { if (confirm('¿Reiniciar la partida? Todos vuelven a la configuración.')) { mostrar(false); window.__reiniciar?.hacer?.(); } };
  el.querySelector('[data-cambiar-juego]').onclick = () => { mostrar(false); import('/comun/cambiar-juego.js').then((m) => m.abrirCambiarJuego()); };
  $('[data-menu]').onclick = () => mostrar(el.classList.contains('hidden'));
  // Haxball tiene su propio menú de pausa: el Esc lo atiende acá y el menú común no se abre encima
  const tecla = (e) => { if (e.code === 'Escape' && !e.target.closest?.('input') && !document.querySelector('.cj-capa, .en-capa')) { e.preventDefault(); mostrar(el.classList.contains('hidden')); } };
  addEventListener('keydown', tecla, true);
  limpiar.push(() => removeEventListener('keydown', tecla, true));
}

// ---------------------------------------------------------------- online
function abrirSala(code) {
  document.title = `Haxball ${code} · cadalado`;
  document.body.classList.add('en-cancha');
  app.innerHTML = htmlCancha();
  const $ = (s) => app.querySelector(s);
  $('[data-chatbox]').classList.remove('hidden');
  const lienzo = $('[data-cancha]'), g = lienzo.getContext('2d');
  const soltar = medidor(lienzo);
  const tec = teclado(), joy = tactil(app);

  let est = null, fase = null, mundo = nuevoMundo('classic'), vista = null, golesLocales = 0, finGol = 0, cartel = null;
  let limpiarFestejo = () => {};
  const entradas = new Map(), caras = new Map();
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id);
    return online.includes(est.host) ? est.host : online.sort()[0];
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;
  const nombreDe = (id) => (String(id).startsWith('bot') ? est?.botNombres?.[+String(id).slice(3)] : est?.jugadores.find((j) => j.id === id)?.nombre) || '—';
  const lookDe = (id) => (String(id).startsWith('bot') ? { ...POR_ID[est.botNpc[+String(id).slice(3)]]?.look } : lookDeJugador(est.jugadores.find((j) => j.id === id), id, '#7aa2ff'));
  function pedirCara(id) {
    if (caras.has(id) || !est) return;
    caras.set(id, null);
    caraRedonda(lookDe(id), 96).then((c) => { caras.set(id, c); pintarPanel(true); }).catch(() => {});
  }
  const miEntrada = () => sumar(tec.solo(), joy);

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
  // Esc: el que armó la sala puede reiniciar la partida (vuelve a la configuración, no larga directo)
  window.__reiniciar = { puede: () => !!est && est.host === est.yo && est.fase !== 'lobby', hacer: () => sala.enviar({ t: 'reiniciar' }) };
  limpiar.push(() => { delete window.__reiniciar; });
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
      $('[data-marca]').textContent = `${e.marcador.rojo} - ${e.marcador.azul}`;
      $('[data-info]').textContent = `Sala ${code}${e.golesMax ? ` · a ${e.golesMax} goles` : ''}`;
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis'; d.textContent = ev.texto;
        const m = /^¡GOL del (rojo|azul)/.exec(ev.texto);
        if (m) { cartel = { texto: `¡Gol del ${NOMBRE_EQ[m[1]]}!`, color: COLOR[m[1]], desde: performance.now() }; sonar('gana'); }
      } else { if (ev.bot) d.className = 'bot'; d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`; }
      log.append(d);
      while (log.children.length > 30) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => toast(m, true),
    onNoExiste: () => { toast('Esa sala no existe.', true); ir('/haxball/'); },
  });
  recordar('haxball', `/haxball/sala/${code}`, `Haxball ${code}`);
  $('[data-chat]').onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector('input'); if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value }); i.value = ''; i.blur(); };
  const abrirChat = (e) => { if (e.code === 'Enter' && !e.target.closest?.('input, select, textarea')) { e.preventDefault(); $('[data-chat] input').focus(); } };
  addEventListener('keydown', abrirChat);
  limpiar.push(() => removeEventListener('keydown', abrirChat));
  menuEsc($, { terminar: () => est?.host === est?.yo && sala.enviar({ t: 'terminar' }), puedeTerminar: () => est?.host === est?.yo });

  function armarMundo() {
    mundo = nuevoMundo(est.estadio);
    for (const id of est.participantes) mundo.jug.set(id, { x: 0, y: 0, vx: 0, vy: 0, equipo: est.equipos[id] || 'rojo' });
    est.botNpc.forEach((_, i) => mundo.jug.set('bot' + i, { x: 0, y: 0, vx: 0, vy: 0, equipo: est.botEquipo[i] || 'azul' }));
    acomodar(mundo, 'rojo');
    golesLocales = 0; finGol = 0;
  }
  function cambioDeFase(nueva) {
    fase = nueva;
    if (nueva === 'cuenta' || (nueva === 'partida' && !mundo.jug.size)) armarMundo();
    if (nueva === 'fin') cartel = { texto: est.ganador === 'empate' ? '¡Empate!' : `¡Ganó el ${NOMBRE_EQ[est.ganador]}!`, color: est.ganador === 'empate' ? '#fff' : COLOR[est.ganador], desde: performance.now() };
    if (nueva === 'lobby') { mundo = nuevoMundo(est.estadio); vista = null; }
    if (nueva !== 'fin') { limpiarFestejo(); limpiarFestejo = () => {}; }
    $('[data-panel]').classList.toggle('hidden', !(nueva === 'lobby' || nueva === 'fin'));
    $('[data-pie]').textContent = nueva === 'partida' || nueva === 'cuenta' ? 'WASD o flechas (mover) · ESPACIO / SHIFT / CTRL / X (patada) · Enter: chat · ESC menú' : '';
  }

  function pintarPanel(forzar = false) {
    if (!est || !(fase === 'lobby' || fase === 'fin')) return;
    const host = est.host === est.yo;
    const fila = (id) => { const c = caras.get(id); return `<li>${c ? `<img src="${c.toDataURL()}" alt="">` : '<span class="hx-sin"></span>'}<span>${esc(nombreDe(id))}${id === est.yo ? ' (vos)' : ''}${id === est.host ? ' ★' : ''}</span></li>`; };
    const de = (e) => est.jugadores.filter((j) => (est.equipos[j.id] || 'afuera') === e && j.online).map((j) => j.id);
    const bots = est.botNpc.map((_, i) => 'bot' + i);
    const n = { rojo: de('rojo').length, azul: de('azul').length };
    const ganadores=est.ganador==='empate'?[]:[...est.participantes.filter(id=>est.equipos[id]===est.ganador),...bots.filter((id,i)=>est.botEquipo[i]===est.ganador)];
    const html = `${fase==='fin'&&ganadores.length?`<div class="hx-festejo"><b>¡Festeja el equipo ${NOMBRE_EQ[est.ganador]}!</b><canvas></canvas><span>${ganadores.map(id=>esc(nombreDe(id))).join(' · ')}</span></div>`:''}<div class="hx-cabeza"><h2>${fase === 'fin' ? (est.ganador === 'empate' ? '¡Empate!' : `¡Ganó el ${NOMBRE_EQ[est.ganador]}!`) + ` ${est.marcador.rojo} - ${est.marcador.azul}` : `Sala ${code}`}</h2>
        <button class="btn btn-chico" data-copiar>Copiar link de invitación</button><a class="btn btn-chico btn-borde" href="/haxball/" data-ir>Salir</a></div>
      <div class="hx-equipos">
        ${['rojo', 'azul'].map((e) => `<div class="hx-eq ${e}"><h3><i class="hx-pt ${e}"></i> Equipo ${NOMBRE_EQ[e]} <small>(${n[e]}/10)</small></h3><ul>${de(e).map(fila).join('')}</ul>
          ${est.equipos[est.yo] === e ? `<span class="hx-aca">En este equipo</span>` : `<button class="btn" data-eq="${e}">Unirme al Equipo ${NOMBRE_EQ[e]}</button>`}</div>`).join('')}
      </div>
      <div class="hx-afuera">Mirando: ${de('afuera').map((id) => esc(nombreDe(id))).join(', ') || 'nadie'} ${est.equipos[est.yo] !== 'afuera' ? '<button class="btn btn-chico btn-borde" data-eq="afuera">Mirar</button>' : ''}</div>
      ${bots.length ? `<p class="hx-bots">Bots del club: ${bots.map((b) => esc(nombreDe(b))).join(', ')} (completan el equipo con menos gente)</p>` : ''}
      ${modificadores({ minutos: est.minutos, goles: est.golesMax, estadio: est.estadio }, host)}
      ${host ? `<div class="hx-botsel"><button type="button" class="btn btn-chico btn-borde" data-npcs>${textoBots(est.bots)}</button></div>` : ''}
      ${host ? `<button class="btn btn-lima btn-grande hx-iniciar" data-empezar>${fase === 'fin' ? 'Revancha' : '¡Iniciar partido!'}</button>` : '<p class="hx-espera">Esperando que el anfitrión dé el pitazo inicial…</p>'}
      <p class="hx-vs"><i class="hx-pt rojo"></i> ${n.rojo} vs <i class="hx-pt azul"></i> ${n.azul}</p>`;
    const p = $('[data-panel]');
    if (!forzar && p.dataset.firma === html) return;
    if (p.contains(document.activeElement) && document.activeElement.matches('input')) return; // no pisar lo que estás escribiendo
    limpiarFestejo(); limpiarFestejo=()=>{};
    p.dataset.firma = html; p.innerHTML = html;
    if(fase==='fin'&&ganadores.length)limpiarFestejo=festejo(p.querySelector('.hx-festejo'),ganadores.map(id=>({look:lookDe(id)})));
    p.querySelector('[data-copiar]').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Link copiado'); };
    p.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'equipo', e: b.dataset.eq })));
    p.querySelector('[data-npcs]')?.addEventListener('click', () => abrirAgregarBots({ ...botsDeSala(est, 19), color: COLOR_JUEGO, alGuardar: ({ ids, azar }) => sala.enviar({ t: 'npcs', ids, azar }) }));
    if (host) engancharModificadores(p, (c) => sala.enviar({ t: 'config', ...c }));
    p.querySelector('[data-empezar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
  }

  // simulación del anfitrión: aparte del dibujo, con reloj real
  let acum = 0, ultSim = performance.now(), envio = 0;
  function simular() {
    const ahora = performance.now();
    const dtS = Math.min(0.5, (ahora - ultSim) / 1000); ultSim = ahora;
    if (!est || !soyAnfitrion() || !(fase === 'partida' || fase === 'cuenta')) { acum = 0; return; }
    if (!mundo.jug.size) armarMundo();
    entradas.set(est.yo, miEntrada());
    if (fase !== 'partida') return;
    acum += dtS;
    while (acum >= 1 / 60) {
      acum -= 1 / 60;
      for (const id of mundo.jug.keys()) if (id.startsWith('bot')) entradas.set(id, pensarBot(mundo, id, ahora / 1000));
      const gol = paso(mundo, entradas);
      if (gol) {
        sala.enviar({ t: 'gol', e: gol, autor: mundo.ultimoToque || '', n: est.goles.length + golesLocales });
        golesLocales++;
        finGol = ahora + 2500; // como HaxBall: se sigue jugando 2,5 s con el cartel y después el saque
      }
      if (finGol && ahora > finGol) { finGol = 0; mundo.gol = null; acomodar(mundo, mundo.pelota.x < 0 ? 'rojo' : 'azul'); }
    }
    if (ahora - envio > 45) { envio = ahora; red.actual?.enviar(codificar(mundo)); }
  }
  const sim = setInterval(simular, 1000 / 60);

  let raf, enviado = 0;
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    if (!est) return;
    const t = (sala.ahora() - est.inicio) / 1000;
    const restante=Math.max(0,Math.ceil(-t));
    $('[data-cuenta-inicio]').classList.toggle('hidden',fase!=='cuenta');
    if(fase==='cuenta')$('[data-cuenta-inicio]').textContent=`El partido empieza en ${restante}`;
    $('[data-tiempo]').textContent = fase === 'cuenta' ? `00:00` : fase === 'partida' ? mmss(Math.max(0, t)) : '00:00';
    let m = mundo;
    if (!soyAnfitrion()) {
      if (fase === 'partida' && est.participantes.includes(est.yo) && ms - enviado > 45) { enviado = ms; const e = miEntrada(); red.actual?.enviar(`I${e.x.toFixed(2)},${e.y.toFixed(2)},${e.patea ? 1 : 0}`); }
      if (vista && fase === 'partida') {
        const k = Math.min(0.1, (performance.now() - vista.llego) / 1000) * 60;
        m = { est: estadio(est.estadio), pelota: { ...vista.pelota, x: vista.pelota.x + vista.pelota.vx * k, y: vista.pelota.y + vista.pelota.vy * k }, jug: new Map() };
        for (const [id, j] of vista.jug) m.jug.set(id, { ...j, x: j.x + j.vx * k, y: j.y + j.vy * k });
        // si el anfitrión se va, el que sigue arranca desde lo último que vio
        mundo = { ...nuevoMundo(est.estadio), pelota: { ...vista.pelota }, jug: new Map([...vista.jug].map(([id, j]) => [id, { ...j }])), saque: null };
      } else if (fase !== 'partida' && fase !== 'cuenta') m = { est: estadio(est.estadio), pelota: { x: 0, y: 0 }, jug: new Map() };
    } else if (fase !== 'partida' && fase !== 'cuenta') m = { est: estadio(est.estadio), pelota: { x: 0, y: 0 }, jug: new Map() };
    dibujarCancha(g, lienzo, m, { yo: est.yo, nombre: nombreDe, cara: (id) => caras.get(id), cartel });
    const c = red.actual?.estadoConexiones?.();
    if (c) $('[data-info]').dataset.red = c.total ? `${c.directas}/${c.total} directas` : 'solo vos';
  }
  raf = requestAnimationFrame(cuadro);
  window.__haxball = { get estado() { return est; }, get mundo() { return mundo; }, get vista() { return vista; }, get caras() { return caras; } };
  limpiar.push(() => { sala.cerrar(); red.actual?.cerrar(); cancelAnimationFrame(raf); clearInterval(sim); limpiarFestejo(); tec.destruir(); soltar(); });
}

ruteo();
