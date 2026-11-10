import { Sala, marco, api, pid, esc, toast, sonar, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { POR_ID, charlas, rngNpc } from '/comun/npcs.js';
import { dicho } from '/comun/dichos.js';
import { lookParaDibujo } from '/comun/look.js';
import { avatarSvg } from '/comun/avatar.js';
import { GESTOS } from '/comun/gestos.js';
import { ruedaGestos } from '/comun/rueda-gestos.js';
import { Escena } from './escena.js';
import { Jugador, ENFRIAR_GOLPE } from './fisica.js';
import { Red } from './red.js';
import { rutaBot, posBot, ordenLargada, posLargada, COLORES, MAPAS, LIMITE_S } from './pista.js';

const app = document.querySelector('#app');
const COLOR = '#c5f04a';
const cuenta = await marco({ juego: 'Ángeles Peña', color: COLOR, volver: '/carrera/' });
let limpiar = [];

function ir(ruta) {
  history.pushState(null, '', ruta);
  ruteo();
}
window.addEventListener('popstate', ruteo);
app.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ir]');
  if (!a) return;
  e.preventDefault();
  ir(a.getAttribute('href'));
});
function ruteo() {
  limpiar.forEach((f) => f());
  limpiar = [];
  document.body.classList.remove('en-carrera');
  const m = location.pathname.match(/^\/carrera\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else menu();
}

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Ángeles Peña · cadalado';
  app.innerHTML = `
  <div class="menu">
    <div class="menu-hero"><div><span class="etq">Carrera de obstáculos 3D · rondas con eliminación · hasta 16</span><h1>Ángeles <em>Peña.</em></h1>
      <p>Cinco mapas con barras, martillos, molinos, pistones, cintas, baldosas y huecos de doble salto. El recorrido cambia en cada partida. En cada ronda clasifican los primeros; con <b>E</b> le pegás una piña al de al lado.</p></div></div>
    <section class="panel">
      <h2>Armar una partida</h2>
      <form data-crear style="display:grid;gap:12px">
        ${cuenta ? '' : `<label><span class="etq">Tu nombre</span><input class="entrada" name="nombre" maxlength="20" required value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?"></label>`}
        <label><span class="etq">Bots para completar (son los personajes de cadalado)</span><select class="entrada" name="bots">${[0, 3, 5, 7, 9, 11].map((n) => `<option ${n === 7 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="publica" checked style="accent-color:${COLOR};width:18px;height:18px"> Pública (cualquiera puede entrar)</label>
        <button class="btn btn-lima btn-grande">Crear partida</button>
      </form>
    </section>
    <section class="panel">
      <h2>Entrar a una partida</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Entrar</button></form>
      <h2 style="margin-top:22px">Partidas abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
    </section>
  </div>`;
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(f.get('nombre'));
    try {
      const { code } = await api('/api/carrera/crear', { pid: pid(), nombre: f.get('nombre'), opciones: { bots: Number(f.get('bots')), publica: f.get('publica') === 'on' } });
      ir(`/carrera/sala/${code}`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/carrera/sala/${c}`);
  };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/carrera/lobby');
      const el = app.querySelector('[data-salas]');
      if (!el) return;
      el.innerHTML = salas.length
        ? salas.map((s) => `<a class="sala-fila" href="/carrera/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR}">${s.jugadores}</span>
          <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'En la largada, esperando' : s.fase === 'podio' ? 'En el podio' : 'Jugando ahora'} · ${s.bots} bots</small></span>
          <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay partidas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// Cómo se ve cada persona: el color que eligió y un peinado que sale de su id.
function lookJugador(id, color) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rngNpc(h);
  const estilos = ['corto', 'corto', 'rulos', 'largo', 'poco'];
  const pelos = ['#1e1610', '#3b2a1e', '#6b4226', '#c49a5a', '#141414'];
  const pieles = ['#f0cfb4', '#e8c4a8', '#d9a982', '#b98463', '#8d5b3e'];
  return {
    piel: pieles[Math.floor(r() * pieles.length)],
    pelo: { estilo: estilos[Math.floor(r() * estilos.length)], color: pelos[Math.floor(r() * pelos.length)] },
    ojos: '#3a2a1c',
    cuerpo: ['flaco', 'normal', 'normal', 'gordito'][Math.floor(r() * 4)],
    ropa: { remera: color, pantalon: '#2b2b33' },
  };
}
const lookBot = (npc) => ({ ...POR_ID[npc]?.look });

// ---------------------------------------------------------------- sala y partida
function abrirSala(code) {
  document.title = `Ángeles Peña ${code} · cadalado`;
  document.body.classList.add('en-carrera');
  app.innerHTML = `
  <div class="juego">
    <canvas data-lienzo></canvas>
    <div class="capa hud-arriba">
      <div class="hud-chip"><span class="etq" style="color:#fff">Sala</span><b>${esc(code)}</b><button class="btn btn-chico" data-copiar>Invitar</button></div>
      <div class="hud-centro hidden" data-hud><div class="ronda-etq" data-ronda></div><div class="puesto" data-puesto>—</div><div class="cronometro" data-crono>0.00</div><div class="cupo" data-cupo></div></div>
      <div class="hud-chip" data-red title="Conexión con los demás">● <span>—</span></div>
    </div>
    <div class="capa panel-flota hidden" data-lobby></div>
    <div class="capa cuenta" data-cuenta></div>
    <div class="capa aviso" data-aviso></div>
    <div class="capa eliminacion hidden" data-eliminacion></div>
    <div class="capa espectar hidden" data-espectar><button class="btn btn-chico" data-esp="-1" aria-label="Anterior">&lsaquo;</button><span>Mirando a <b data-esp-nombre></b></span><button class="btn btn-chico" data-esp="1" aria-label="Siguiente">&rsaquo;</button></div>
    <div class="capa gestos-tip" style="position:absolute;right:16px;bottom:70px;color:#fff;font-size:12px;opacity:.75;z-index:5">Mantené <kbd>B</kbd> para los gestos</div>
    <div class="capa pina-hud" data-pina><kbd>E</kbd><span>Piña</span><i><b></b></i></div>
    <div class="capa panel-flota podio-flota hidden" data-podio></div>
    <div class="capa chat-mini"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat…" autocomplete="off"></form></div>
    <div class="capa tactil" data-tactil><div class="joy" data-joy><i></i></div><div class="botones-t"><button class="chico" data-boton="golpe">PIÑA</button><button class="chico" data-boton="buceo">TIRARSE</button><button data-boton="salto">SALTAR</button></div></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const escena = new Escena($('[data-lienzo]'));
  escena.construirMapa(1, 1);

  let est = null;
  let fase = null;
  let clave = 'lobby'; // qué mapa está armado: "lobby" o "partida-ronda"
  let mapa = 1;
  let semilla = 1;
  let jugador = new Jugador(1, 1);
  jugador.ubicar((Math.random() - 0.5) * 8, 0, -3 - Math.random() * 4);
  let camYaw = 0;
  let camYawObj = 0;
  let enviadoMeta = false;
  let botsRonda = []; // [{ i, npc, ruta, charlas, prox }]
  let charlasLobby = [];
  let espectando = 0;
  const golpeados = new Map(); // bot id -> hasta (ms), solo visual
  const vistos = new Set(); // mensajes de piña ya aplicados
  const remotos = new Map(); // id -> { obj (suavizado), meta (último recibido), t }
  const entrada = { x: 0, z: 0, salto: false, buceo: false, golpe: false };
  const yo = () => est?.yo;
  const nombreDe = (id) => est?.jugadores.find((j) => j.id === id)?.nombre || '';
  const colorDe = (id) => COLORES[est?.skins?.[id] ?? 0];
  // el personaje que cada uno armó en /personaje (si no, uno con su color de la sala)
  const lookDe = (id) => {
    const l = est?.jugadores.find((j) => j.id === id)?.look;
    return l ? lookParaDibujo(l) : lookJugador(id, colorDe(id));
  };
  const nombreBot = (i) => {
    const id = est.botNpc[i];
    const rep = est.botNpc.slice(0, i).filter((x) => x === id).length;
    return (POR_ID[id]?.nombre || 'Bot') + (rep ? ` ${rep + 1}` : '');
  };
  const algunJugador = () => {
    const js = est?.jugadores.filter((j) => j.online) || [];
    return js.length ? js[Math.floor(Math.random() * js.length)].nombre : 'alguien';
  };

  const red = { actual: null };
  const sala = new Sala('/api/carrera', code, {
    intervalo: (e) => (e?.fase === 'carrera' ? 1200 : e?.fase === 'cuenta' ? 500 : 900),
    onEstado: (e) => {
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: mensaje });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      if (e.fase !== fase) cambioDeFase(e.fase);
      pintarPaneles();
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k === 'golpe') return mensaje(ev.de, { k: 'golpe', dx: ev.dx, dz: ev.dz, n: 'srv' + ev.id });
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis';
        d.textContent = ev.texto;
      } else {
        d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`;
        escena.decir(ev.de, ev.texto, 5); // también aparece arriba del personaje
      }
      log.append(d);
      while (log.children.length > 30) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => toast(m, true),
    onNoExiste: () => {
      toast('Esa partida no existe.', true);
      ir('/carrera/');
    },
  });
  recordar('carrera', `/carrera/sala/${code}`, `Ángeles Peña ${code}`);
  limpiar.push(() => {
    sala.cerrar();
    red.actual?.cerrar();
    cancelAnimationFrame(raf);
    escena.destruir();
  });

  function recibir(id, e) {
    let r = remotos.get(id);
    if (!r) remotos.set(id, (r = { obj: { ...e }, meta: e, t: e.t }));
    if (e.t < r.t - 0.05 && Math.abs(e.t - r.t) < 30) return; // llegó desordenado
    r.meta = e;
    r.t = e.t;
    r.visto = performance.now();
  }
  // mensajes sueltos de otro jugador (por ahora, piñas)
  function mensaje(id, m) {
    if (m?.k !== 'golpe') return;
    const clave = `${id}:${m.n}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    if (jugador.espectador || jugador.llego || !(fase === 'carrera' || fase === 'lobby' || fase === 'podio')) return;
    const dx = Number(m.dx) || 0;
    const dz = Number(m.dz) || 0;
    jugador.recibirGolpe(dx, dz);
    sonar('pina');
    aviso(`¡${nombreDe(id) || 'Alguien'} te pegó!`, true);
  }

  // ---------------------------------------------------------------- fases
  function armarRonda() {
    const nueva = `${est.carreras}-${est.ronda}`;
    if (nueva === clave) return;
    clave = nueva;
    mapa = est.mapa;
    semilla = est.semilla;
    escena.construirMapa(mapa, semilla);
    escena.quitarSi((id) => id !== yo());
    remotos.clear();
    const orden = ordenLargada(est.participantes, est.botsVivos);
    botsRonda = est.botsVivos.map((i) => ({ i, npc: est.botNpc[i], ruta: rutaBot(mapa, semilla, i, orden.indexOf('bot' + i), orden.length), charlas: charlas(est.botNpc[i], semilla, i, LIMITE_S), prox: 0 }));
    jugador = new Jugador(mapa, semilla);
    const salida = posLargada(Math.max(0, orden.indexOf(yo())), orden.length);
    jugador.ubicar(salida.x, salida.y, salida.z);
    for (const id of est.participantes) if (id !== yo()) {
      const p = posLargada(orden.indexOf(id), orden.length);
      const e = { ...p, ry: 0, a: 'quieto', t: -5 };
      remotos.set(id, { obj: { ...e }, meta: e, t: -5, visto: performance.now() });
    }
    jugador.espectador = !est.vivos.includes(yo());
    enviadoMeta = false;
    camYaw = camYawObj = 0;
    if (botsRonda.some((b) => b.npc === 'mati')) setTimeout(() => aviso('¡Apareció Mati Nadeo!', false, 'dorado'), 600);
  }
  function armarLobby() {
    if (clave === 'lobby') return;
    clave = 'lobby';
    mapa = 1;
    semilla = 1;
    escena.construirMapa(1, 1);
    escena.quitarSi((id) => id !== yo());
    remotos.clear();
    botsRonda = [];
    jugador = new Jugador(1, 1);
    jugador.ubicar((Math.random() - 0.5) * 8, 0, -3 - Math.random() * 4);
  }
  function cambioDeFase(nueva) {
    fase = nueva;
    if (nueva === 'cuenta' || nueva === 'carrera' || ((nueva === 'ronda' || nueva === 'podio') && clave === 'lobby' && est.ronda)) armarRonda();
    if (nueva === 'lobby') armarLobby();
    if (nueva === 'ronda') {
      const mio = est.clasificacion.find((x) => x.id === yo());
      if (mio) {
        sonar(mio.paso ? 'gana' : 'pierde');
        aviso(mio.paso ? '¡CLASIFICASTE!' : 'Quedaste afuera', !mio.paso);
        if (!mio.paso) mostrarEliminacion(est.clasificacion.filter(x => !x.paso));
      }
    }
    if (nueva === 'podio') { sonar('gana'); const mio = est.resultados.find(x => x.id === yo()); if (mio && est.resultados[0]?.id !== yo()) mostrarEliminacion(est.clasificacion.filter(x => !x.paso)); }
    if (nueva === 'cuenta' || nueva === 'lobby') $('[data-eliminacion]').classList.add('hidden');
    $('[data-hud]').classList.toggle('hidden', !(nueva === 'carrera' || nueva === 'cuenta'));
  }

  function mostrarEliminacion(lista) {
    const el = $('[data-eliminacion]');
    el.innerHTML = `<div class="elim-cinta"><small>Ángeles Peña · ronda ${est.ronda}</small><strong>¡ELIMINADO!</strong><span>La pista sigue sin vos</span></div>
      <div class="elim-lista"><b>Quedaron afuera</b>${lista.slice(0, 6).map(x => `<span>${esc(x.nombre)}</span>`).join('')}</div>`;
    el.classList.remove('hidden');
    clearTimeout(mostrarEliminacion.t);
    mostrarEliminacion.t = setTimeout(() => el.classList.add('hidden'), 5200);
  }

  function pintarPaneles() {
    const e = est;
    const esHost = e.host === e.yo;
    // lobby
    const lob = $('[data-lobby]');
    lob.classList.toggle('hidden', e.fase !== 'lobby' && e.fase !== 'ronda');
    if (e.fase === 'lobby') {
      const online = e.jugadores.filter((j) => j.online);
      const mio = e.skins[e.yo] ?? 0;
      const firma = JSON.stringify([online, e.skins, e.bots, e.botNpc, e.host]);
      if (lob.dataset.firma === firma) return;
      lob.dataset.firma = firma;
      lob.innerHTML = `<span class="etq">Sala de espera · ${online.length + e.botNpc.length} participantes</span><h2>En la largada</h2>
        <p>Practicá mientras se reúne el grupo. ${esHost ? 'Cuando estén todos, largá la carrera.' : `Larga ${esc(nombreDe(e.host))}.`}</p>
        <div class="lista-j">${online.map((j) => `<div><i style="background:${colorDe(j.id)}"></i>${esc(j.nombre)}${j.id === e.yo ? ' (vos)' : ''}<small>${j.id === e.host ? 'arma' : ''}</small></div>`).join('')}
          ${e.botNpc.map((n, i) => `<div class="${n === 'mati' ? 'dorado' : ''}"><i style="background:${POR_ID[n]?.look.ropa.remera || '#888'}"></i>${esc(nombreBot(i))}<small>${n === 'mati' ? '¡raro!' : 'bot'}</small></div>`).join('')}</div>
        <span class="etq">Tu personaje · elegí un color</span>
        <div class="colores">${COLORES.map((c, i) => `<button style="background:${c}" class="${i === mio ? 'on' : ''}" data-color="${i}" aria-label="Color ${i + 1}"></button>`).join('')}</div>
        ${esHost ? `<div style="display:flex;gap:8px;align-items:center"><select class="entrada" data-bots style="width:auto">${[0, 3, 5, 7, 9, 11].map((n) => `<option ${n === e.bots ? 'selected' : ''} value="${n}">${n} bots</option>`).join('')}</select>
          <button class="btn btn-lima btn-grande" data-largar style="flex:1">¡Largar!</button></div>` : ''}
        <div class="teclas"><span><kbd>WASD</kbd> mover</span><span><kbd>Espacio</kbd> saltar x2</span><span><kbd>Shift</kbd> tirarse</span><span><kbd>E</kbd> golpear</span></div>`;
      lob.querySelectorAll('[data-color]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'skin', color: Number(b.dataset.color) })));
      lob.querySelector('[data-bots]')?.addEventListener('change', (ev) => sala.enviar({ t: 'bots', n: Number(ev.target.value) }));
      lob.querySelector('[data-largar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
    } else if (e.fase === 'ronda') {
      // entre rondas: quiénes clasificaron
      const firma = `ronda-${e.carreras}-${e.ronda}`;
      if (lob.dataset.firma === firma) return;
      lob.dataset.firma = firma;
      const mio = e.clasificacion.find((x) => x.id === e.yo);
      const sig = MAPAS[e.rondas[e.ronda]];
      const t = (ms) => (ms == null ? 'no llegó' : `${(ms / 1000).toFixed(2)} s`);
      lob.innerHTML = `<h2>${mio ? (mio.paso ? '¡Clasificaste!' : 'Quedaste afuera') : `Terminó la ronda ${e.ronda}`}</h2>
        <p>${mio && !mio.paso ? 'Podés quedarte mirando cómo sigue. ' : ''}Próxima: <b>${esc(sig?.nombre || '')}</b>${e.ronda + 1 === e.rondas.length ? ' (la final)' : ''}.</p>
        <div class="tabla-res">${e.clasificacion.map((x, i) => `<div class="${x.id === e.yo ? 'yo' : ''} ${x.paso ? '' : 'afuera'}"><b>${i + 1}º</b><span>${esc(x.nombre)}${x.bot ? ' <small style="color:var(--gris)">bot</small>' : ''}</span><span class="mono">${x.paso ? 'pasa' : 'afuera'} · ${t(x.tiempo)}</span></div>`).join('')}</div>`;
    }
    // podio
    const pod = $('[data-podio]');
    pod.classList.toggle('hidden', e.fase !== 'podio');
    if (e.fase === 'podio' && pod.dataset.carrera !== String(e.carreras)) {
      pod.dataset.carrera = e.carreras;
      const r = e.resultados;
      const top = [r[1], r[0], r[2]];
      const det = (x) => (x.paso ? (x.tiempo != null ? `${(x.tiempo / 1000).toFixed(2)} s` : 'final') : `afuera en ronda ${x.ronda}`);
      const miPuesto = r.findIndex((x) => x.id === e.yo) + 1;
      const gane = miPuesto === 1 && r[0]?.paso;
      pod.innerHTML = `<span class="etq">Ángeles Peña · final</span><h2>${gane ? '¡Ganaste Ángeles Peña!' : miPuesto ? `Terminaste ${miPuesto}º` : 'Resultados'}</h2>
        <div class="podio-top">${top.map((x, i) => (x ? `<div class="p${[2, 1, 3][i]}"><span class="podio-avatar">${avatarSvg(x.bot ? lookBot(x.npc) : lookDe(x.id))}</span><span class="mono" style="font-size:24px">${['2º', '1º', '3º'][i]}</span><b>${esc(x.nombre)}</b><span class="mono">${det(x)}</span></div>` : '<div style="visibility:hidden"></div>')).join('')}</div>
        <div class="tabla-res">${r.map((x, i) => `<div class="${x.id === e.yo ? 'yo' : ''}"><b>${i + 1}º</b><span>${esc(x.nombre)}${x.bot ? ' <small style="color:var(--gris)">bot</small>' : ''}</span><span class="mono">${det(x)}</span></div>`).join('')}</div>
        ${esHost ? '<button class="btn btn-lima btn-grande" data-otra style="width:100%;margin-top:14px">Otra partida</button>' : '<p style="margin-top:12px">En unos segundos vuelven a la largada.</p>'}`;
      pod.querySelector('[data-otra]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
    }
  }

  // ---------------------------------------------------------------- controles
  const teclas = new Set();
  // gestos tipo Fortnite: mantenés la B, apuntás con el mouse y soltás; viaja a los demás como animación
  const rueda = ruedaGestos({
    puede: () => jugador && !jugador.espectador,
    alElegir: (id) => { const g = GESTOS.find((x) => x.id === id); if (g) jugador.pedirGesto(g.id, g.dur); },
  });
  limpiar.push(() => rueda.destruir());
  const abajo = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (!teclas.has(k)) {
      if (k === 'Space') entrada.salto = true;
      if (k === 'ShiftLeft' || k === 'ShiftRight') entrada.buceo = true;
      if (k === 'KeyE') entrada.golpe = true;
      if (mirando() && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD')) espectando += k === 'ArrowLeft' || k === 'KeyA' ? -1 : 1;
    }
    teclas.add(k);
  };
  const arriba = (e) => teclas.delete(e.code);
  addEventListener('keydown', abajo);
  addEventListener('keyup', arriba);
  limpiar.push(() => {
    removeEventListener('keydown', abajo);
    removeEventListener('keyup', arriba);
  });
  app.querySelectorAll('[data-esp]').forEach((b) => (b.onclick = () => (espectando += Number(b.dataset.esp))));
  // girar cámara arrastrando el mouse (suave: la cámara va llegando de a poco)
  let arrastre = null;
  const lienzo = $('[data-lienzo]');
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') arrastre = e.clientX;
  });
  const soltarMouse = () => (arrastre = null);
  const moverMouse = (e) => {
    if (arrastre == null) return;
    camYawObj -= (e.clientX - arrastre) * 0.0032;
    arrastre = e.clientX;
  };
  addEventListener('pointerup', soltarMouse);
  addEventListener('pointermove', moverMouse);
  limpiar.push(() => {
    removeEventListener('pointerup', soltarMouse);
    removeEventListener('pointermove', moverMouse);
  });
  // táctil: joystick + botones
  const tactil = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  $('[data-tactil]').classList.toggle('ver', tactil);
  const joy = { id: null, x: 0, z: 0 };
  const joyEl = $('[data-joy]');
  joyEl.addEventListener('pointerdown', (e) => {
    joy.id = e.pointerId;
    joyEl.setPointerCapture(e.pointerId);
    moverJoy(e);
  });
  joyEl.addEventListener('pointermove', (e) => e.pointerId === joy.id && moverJoy(e));
  const soltar = () => {
    joy.id = null;
    joy.x = joy.z = 0;
    joyEl.querySelector('i').style.transform = '';
  };
  joyEl.addEventListener('pointerup', soltar);
  joyEl.addEventListener('pointercancel', soltar);
  function moverJoy(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const n = Math.hypot(dx, dy);
    if (n > 1) {
      dx /= n;
      dy /= n;
    }
    joy.x = dx;
    joy.z = -dy;
    joyEl.querySelector('i').style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  }
  app.querySelectorAll('[data-boton]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    entrada[b.dataset.boton] = true;
  }));

  $('[data-copiar]').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); } catch {}
    toast('Link de la partida copiado');
  };
  $('[data-chat]').onsubmit = (e) => {
    e.preventDefault();
    const i = e.target.querySelector('input');
    if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value });
    i.value = '';
    i.blur();
  };

  // un bot habla: globito arriba de su muñeco y también en el chat
  function botDice(id, nombre, texto) {
    escena.decir(id, texto);
    const log = $('[data-log]');
    const d = document.createElement('div');
    d.className = 'bot';
    d.innerHTML = `<b>${esc(nombre)}:</b> ${esc(texto)}`;
    log.append(d);
    while (log.children.length > 30) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  function aviso(texto, malo = false, clase = '') {
    $('[data-aviso]').innerHTML = `<span class="${malo ? 'malo' : ''} ${clase}">${esc(texto)}</span>`;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => ($('[data-aviso]').innerHTML = ''), 1800);
  }

  // ¿estoy mirando a otros? (eliminado, sin lugar en la ronda o ya llegué)
  const mirando = () => (fase === 'carrera' || fase === 'cuenta' || fase === 'ronda') && (jugador.espectador || jugador.llego);

  // Piña o patada: le pega al que tengo enfrente (personas: por la red; bots: solo se tambalean).
  function pegar(t) {
    if (!jugador.golpear()) return;
    sonar('pina');
    const fx = -Math.sin(jugador.ry);
    const fz = -Math.cos(jugador.ry);
    const alcance = (o) => {
      const dx = o.x - jugador.x;
      const dz = o.z - jugador.z;
      const d = Math.hypot(dx, dz);
      return d < 1.8 && Math.abs(o.y - jugador.y) < 1.3 && (d < 0.5 || (dx * fx + dz * fz) / d > 0.2) ? { dx: dx / (d || 1), dz: dz / (d || 1) } : null;
    };
    for (const [id, r] of remotos) {
      if (!enJuego(id)) continue;
      const a = alcance(r.obj);
      if (a) red.actual?.golpe(id, a.dx, a.dz);
    }
    for (const b of botsRonda) if (alcance(posBot(mapa, b.ruta, t, semilla))) golpeados.set('bot' + b.i, performance.now() + 1500);
    if (fase === 'lobby') charlasLobby.forEach((_, i) => alcance(posLobby(i)) && golpeados.set('bot' + i, performance.now() + 1500));
  }
  // Los bots pelean con quien tengan cerca, incluso entre ellos.
  function botPega(b, e, ahora) {
    if (b.pegaHasta > ahora) {
      e.a = b.pegaTipo;
      e.ry = b.pegaRy;
      return;
    }
    if (ahora < (b.proxPega || 0) || (golpeados.get('bot' + b.i) || 0) > ahora) return;
    const objetivos = [];
    if (!jugador.espectador && !jugador.llego && jugador.aturdido <= 0) objetivos.push({ id: yo(), p: jugador, humano: true });
    for (const otro of botsRonda) if (otro.i !== b.i && (golpeados.get('bot' + otro.i) || 0) <= ahora) objetivos.push({ id: 'bot' + otro.i, p: posBot(mapa, otro.ruta, Math.max(0, (sala.ahora() - est.inicio) / 1000), semilla), humano: false });
    const cerca = objetivos.map(o => ({ ...o, d: Math.hypot(o.p.x - e.x, o.p.z - e.z) })).filter(o => o.d < 1.7 && Math.abs(o.p.y - e.y) < 1.2).sort((a, b) => a.d - b.d);
    if (!cerca.length) return;
    // Si hay NPCs cerca, se enfrentan a ellos con frecuencia; no concentran todas las piñas en la persona.
    const objetivo = cerca.find(o => !o.humano && o.d < 1.45) || cerca[0];
    const dx = objetivo.p.x - e.x, dz = objetivo.p.z - e.z;
    b.proxPega = ahora + 5000 + Math.random() * 4500;
    if (Math.random() > 0.58) return;
    b.pegaTipo = Math.random() < 0.5 ? 'pina' : 'patada';
    b.pegaRy = Math.atan2(-dx, -dz);
    b.pegaHasta = ahora + 750;
    e.a = b.pegaTipo; e.ry = b.pegaRy;
    if (!objetivo.humano) {
      setTimeout(() => { golpeados.set(objetivo.id, performance.now() + 1400); sonar('pina'); }, 280);
      return;
    }
    setTimeout(() => {
      const ahoraD = Math.hypot(jugador.x - e.x, jugador.z - e.z);
      if (ahoraD < 2 && !jugador.llego && !jugador.espectador) {
        jugador.recibirGolpe(dx, dz);
        sonar('pina');
        if (Math.random() < 0.5) botDice('bot' + b.i, nombreBot(b.i), ['¡Tomá!', '¡Fuera de mi camino!', '¡Paso!', 'Perdón, fue sin querer. Mentira.'][Math.floor(Math.random() * 4)]);
      }
    }, 280);
  }
  const posLobby = (i) => ({ x: ((i % 6) - 2.5) * 2.2, y: 0, z: -10 - Math.floor(i / 6) * 2.2, ry: Math.PI });
  const enJuego = (id) => (fase === 'lobby' || fase === 'podio' ? true : est.vivos.includes(id));

  // ---------------------------------------------------------------- bucle
  // para pruebas automáticas (no cambia nada del juego)
  window.__carrera = { get jugador() { return jugador; }, get remotos() { return remotos; }, get estado() { return est; }, get bots() { return botsRonda; }, get mirando() { return mirando(); }, posBot: (k) => { const b = botsRonda[k]; return b && posBot(mapa, b.ruta, Math.max(0, (sala.ahora() - est.inicio) / 1000), semilla); } };
  let raf;
  let ultimo = performance.now();
  let acumulado = 0;
  let envio = 0;
  let ultimaCuenta = null;
  const reloj0 = performance.now();
  function cuadro(ahoraMs) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.1, (ahoraMs - ultimo) / 1000);
    ultimo = ahoraMs;
    if (!est) return escena.render(dt);
    const enRonda = fase === 'carrera' || fase === 'cuenta' || fase === 'ronda';
    // tiempo de la pista: el de la ronda (igual para todos) o uno local para practicar
    const t = clave !== 'lobby' ? (sala.ahora() - est.inicio) / 1000 : (ahoraMs - reloj0) / 1000;
    const tp = Math.max(0, t);
    escena.actualizarMoviles(tp);

    // cuenta regresiva
    if (fase === 'cuenta' || (fase === 'carrera' && t < 1)) {
      const n = Math.ceil(-t);
      const txt = n > 0 ? String(n) : t >= 0 && t < 1 ? '¡YA!' : '';
      if (txt !== ultimaCuenta) {
        ultimaCuenta = txt;
        $('[data-cuenta]').innerHTML = txt ? `<span>${txt}</span>` : '';
        if (txt) sonar(txt === '¡YA!' ? 'aviso' : 'tick');
      }
    } else if (ultimaCuenta) {
      ultimaCuenta = null;
      $('[data-cuenta]').innerHTML = '';
    }

    // cámara: arrastrar o Q la giran; llega suave al ángulo pedido
    if (teclas.has('KeyQ')) camYawObj += dt * 1.6;
    if (fase === 'podio') camYawObj += dt * 0.2;
    camYaw += (camYawObj - camYaw) * (1 - Math.exp(-dt * 7));

    // mi personaje
    const puedeMover = !jugador.espectador && (fase === 'lobby' || fase === 'podio' || (fase === 'carrera' && t >= 0));
    entrada.x = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) + joy.x;
    entrada.z = (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) - (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) + joy.z;
    if (!jugador.espectador) {
      if (entrada.golpe && puedeMover) pegar(tp);
      entrada.golpe = false;
      const otros = [...remotos.entries()].filter(([id]) => enJuego(id)).map(([, r]) => r.obj);
      if (enRonda) for (const b of botsRonda) otros.push(posBot(mapa, b.ruta, tp, semilla));
      if (fase === 'lobby') charlasLobby.forEach((_, i) => otros.push(posLobby(i)));
      acumulado += dt;
      while (acumulado >= 1 / 60) {
        acumulado -= 1 / 60;
        const ent = puedeMover ? entrada : { x: 0, z: 0 };
        const ev = jugador.paso(1 / 60, tp, ent, camYaw, otros);
        entrada.salto = entrada.buceo = false;
        for (const e of ev) {
          if (e === 'salto' || e === 'buceo') sonar('salto');
          if (e === 'doble') sonar('aviso');
          if (e === 'golpe') sonar('pina');
          if (e === 'caida') aviso('¡Al agua! Volvés al último punto', true);
          if (e === 'checkpoint' && fase === 'carrera') aviso(`Punto de control: ${MAPAS[mapa].CHECKPOINTS[jugador.cp].nombre}`);
          if (e === 'meta' && fase === 'carrera' && !enviadoMeta) {
            enviadoMeta = true;
            sonar('gana');
            escena.confeti(jugador.x, jugador.y, jugador.z);
            aviso('¡LLEGASTE!');
            sala.enviar({ t: 'meta' });
          }
        }
      }
      // fuera de la ronda la "meta" no cuenta: si llegás practicando, volvés a la largada
      if (fase !== 'carrera' && fase !== 'cuenta' && fase !== 'ronda' && jugador.llego) {
        jugador.llego = false;
        jugador.ubicar(0, 0, -4);
      }
      escena.personaje(yo(), lookDe(yo()), nombreDe(yo()) + ' (vos)', true);
      escena.mover(yo(), jugador.estado(), dt);
      envio += dt;
      if (envio > 1 / 15) {
        envio = 0;
        red.actual?.enviar(jugador.estado(), t);
      }
    } else escena.quitar(yo());

    // los demás jugadores (suavizado hacia la última posición recibida)
    for (const [id, r] of remotos) {
      const j = est.jugadores.find((x) => x.id === id);
      if (!j || !j.online || !enJuego(id) || performance.now() - (r.visto || 0) > 6000) {
        escena.quitar(id);
        if (!j || !j.online) remotos.delete(id);
        continue;
      }
      escena.personaje(id, lookDe(id), j.nombre);
      const k = Math.min(1, dt * 12);
      const salto = Math.hypot(r.meta.x - r.obj.x, r.meta.z - r.obj.z) > 6;
      for (const c of ['x', 'y', 'z']) r.obj[c] = salto ? r.meta[c] : r.obj[c] + (r.meta[c] - r.obj[c]) * k;
      let d = r.meta.ry - r.obj.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      r.obj.ry += d * k;
      r.obj.a = r.meta.a;
      escena.mover(id, r.obj, dt);
    }

    // bots: en la ronda siguen su ruta (igual en todos los navegadores); en la largada esperan charlando
    const ahora = performance.now();
    if (enRonda || (fase === 'podio' && botsRonda.length)) {
      for (const b of botsRonda) {
        const id = 'bot' + b.i;
        escena.personaje(id, lookBot(b.npc), nombreBot(b.i));
        const e = posBot(mapa, b.ruta, tp, semilla);
        if ((golpeados.get(id) || 0) > ahora) e.a = (golpeados.get(id) - ahora > 1250 ? 'golpe' : 'tirado');
        else if (fase === 'carrera') botPega(b, e, ahora);
        escena.mover(id, e, dt);
        // cuando llega a la meta, festeja (o se queja si no clasificó)
        if (!b.llego && tp >= b.ruta.fin) {
          b.llego = true;
          if (tp - b.ruta.fin < 2 && (b.i * 7 + est.ronda) % 3 === 0) botDice(id, nombreBot(b.i), dicho(b.npc, 'gana', algunJugador(), rngNpc(semilla + b.i)));
        }
        // charlas: de vez en cuando, en un globito
        while (b.prox < b.charlas.length && b.charlas[b.prox].t <= t) {
          if (b.charlas[b.prox].t > t - 2) botDice(id, nombreBot(b.i), b.charlas[b.prox].texto.replace('{jugador}', algunJugador()));
          b.prox++;
        }
      }
    } else if (fase === 'lobby') {
      const n = est.botNpc.length;
      if (charlasLobby.length !== n || charlasLobby.firma !== est.botNpc.join()) {
        escena.quitarSi((id) => id.startsWith('bot'));
        charlasLobby = est.botNpc.map((npc, i) => ({ npc, lista: charlas(npc, est.semillaSala + i, i, 3600), prox: 0 }));
        charlasLobby.firma = est.botNpc.join();
      }
      const tl = (ahora - reloj0) / 1000;
      charlasLobby.forEach((c, i) => {
        const id = 'bot' + i;
        escena.personaje(id, lookBot(c.npc), nombreBot(i));
        escena.mover(id, { ...posLobby(i), a: (golpeados.get(id) || 0) > ahora ? 'tirado' : 'quieto' }, dt);
        while (c.prox < c.lista.length && c.lista[c.prox].t <= tl) {
          if (c.lista[c.prox].t > tl - 2) botDice(id, nombreBot(i), c.lista[c.prox].texto.replace('{jugador}', algunJugador()));
          c.prox++;
        }
      });
    }

    // puesto, cronómetro y cupo
    if (fase === 'carrera' || fase === 'cuenta') {
      const llegadaBot = (b) => (tp >= b.ruta.fin ? -1000 - (1e6 - b.ruta.fin * 1000) / 1e6 : posBot(mapa, b.ruta, tp, semilla).z);
      const avance = [];
      if (!jugador.espectador) avance.push({ id: yo(), z: est.llegadas[yo()] != null ? -1000 - (1e6 - est.llegadas[yo()]) / 1e6 : jugador.z });
      for (const [id, r] of remotos) if (est.vivos.includes(id)) avance.push({ id, z: est.llegadas[id] != null ? -1000 - (1e6 - est.llegadas[id]) / 1e6 : r.obj.z });
      botsRonda.forEach((b) => avance.push({ id: 'bot' + b.i, z: llegadaBot(b) }));
      avance.sort((a, b) => a.z - b.z);
      const p = avance.findIndex((a) => a.id === yo()) + 1;
      const final = est.ronda === est.rondas.length;
      $('[data-ronda]').textContent = `Ronda ${est.ronda}/${est.rondas.length}${final ? ' · final' : ''} · ${MAPAS[mapa].nombre}`;
      $('[data-puesto]').innerHTML = p ? `${p}º<small>/${avance.length}</small>` : '';
      const tt = est.llegadas[yo()] != null ? est.llegadas[yo()] / 1000 : tp;
      $('[data-crono]').textContent = `${tt.toFixed(2)} s`;
      const llegaron = Object.keys(est.llegadas).length + botsRonda.filter((b) => tp >= b.ruta.fin).length;
      $('[data-cupo]').textContent = final ? 'Gana el primero' : `Clasificados ${Math.min(llegaron, est.cupo)}/${est.cupo}`;
    }

    // estado de la red
    const c = red.actual?.estadoConexiones();
    if (c) $('[data-red]').innerHTML = c.total ? `<span style="color:${c.directas === c.total ? 'var(--lima)' : '#ffd166'}">●</span> ${c.directas}/${c.total} directas` : '<span style="color:var(--gris)">●</span> solo vos';

    // piña: cuánto falta
    const pinaEl = $('[data-pina]');
    pinaEl.classList.toggle('hidden', jugador.espectador || mirando() || fase === 'ronda');
    pinaEl.classList.toggle('lista', jugador.enfriar <= 0);
    pinaEl.querySelector('b').style.width = `${(1 - jugador.enfriar / ENFRIAR_GOLPE) * 100}%`;

    // cámara: sigue a mi personaje; si estoy afuera o ya llegué, miro a los demás (con ‹ ›)
    let foco = jugador.estado();
    const esp = $('[data-espectar]');
    if (mirando()) {
      const lista = [];
      for (const [id, r] of remotos) if (est.vivos.includes(id) && est.llegadas[id] == null) lista.push({ nombre: nombreDe(id), e: r.obj });
      for (const b of botsRonda) if (tp < b.ruta.fin) lista.push({ nombre: nombreBot(b.i), e: posBot(mapa, b.ruta, tp, semilla) });
      if (!lista.length) for (const b of botsRonda) lista.push({ nombre: nombreBot(b.i), e: posBot(mapa, b.ruta, tp, semilla) });
      if (lista.length) {
        const sel = lista[((espectando % lista.length) + lista.length) % lista.length];
        foco = sel.e;
        esp.querySelector('[data-esp-nombre]').textContent = sel.nombre;
      }
      esp.classList.toggle('hidden', !lista.length);
    } else esp.classList.add('hidden');
    escena.seguir(foco, camYaw, dt);
    escena.render(dt);
  }
  raf = requestAnimationFrame(cuadro);
}

ruteo();
