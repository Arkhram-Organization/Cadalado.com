// Battle Shmitz: menú, sala y partida. El menú y la sala se ven arriba de la isla (el juego queda de fondo).
import { Isla3D } from './escena3d.js';
import { abrirElegirNpcs, textoNpcs } from '/comun/elegir-npcs.js';
import { OBJETOS, recoger } from './inventario.js';
import { Sala, marco, api, pid, esc, toast, sonar, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { POR_ID } from '/comun/npcs.js';
import { avatarSvg, lookDeJugador } from '/comun/avatar.js';
import { Red } from '/comun/red.js';
import { GESTOS } from '/comun/gestos.js';
import { ruedaGestos } from '/comun/rueda-gestos.js';
import { generarMapa, zona, ARMAS, RAREZAS, CAJAS, MATERIALES, danoArea, VIDA, ESCUDO_MAX, LADO, TAM, LUGARES, lugarEn, rng } from './mundo.js';
import { Peleador, CerebroBot, avanzarBala, nuevaBala, danoZona, CODIGO_ARMA, ARMA_DE_CODIGO, ALTURA_SALTO } from './juego.js';
import { DURACION_COLECTIVO, posicionColectivo, saltoAutomatico, tiempoParaLugar, recorridoColectivo, puntosAterrizaje } from './colectivo.js';
import { alinearPieza, validarPieza, COSTO_PIEZA } from './construccion.js';
import { ICONOS } from './iconos.js';
import { imagenMapa, dibujarIsla, MapaGrande, cuadricula } from './mapa2d.js';

const app = document.querySelector('#app');
const COLOR = '#ff6b5b';
const AV = ['#ff4fa3', '#7aa2ff', '#ffd166', '#9be15d', '#c084fc', '#4fd1c5', '#ff7a45', '#f4f1ea'];
const colorDe = (id) => AV[parseInt(String(id).slice(0, 6), 36) % AV.length];
const RAREZA_N = ['comun', 'poco_comun', 'rara', 'epica', 'legendaria'];
const nombreItem = (tipo) => OBJETOS[tipo]?.nombre || ARMAS[tipo]?.nombre || CAJAS[tipo]?.nombre || MATERIALES[tipo]?.nombre || (tipo === 'cofre' ? 'Cofre' : '');
const iconoItem = (tipo) => ICONOS[tipo] || (CAJAS[tipo] ? ICONOS.balas : ICONOS[MATERIALES[tipo] ? tipo : 'balas']);
const imagenItem = (tipo) => ARMAS[tipo] ? `<img src="/royale/img/armas/${tipo}.webp" alt="${esc(ARMAS[tipo].nombre)}" draggable="false">` : OBJETOS[tipo] ? `<img src="/royale/img/objetos/${tipo}.webp" alt="${esc(OBJETOS[tipo].nombre)}" draggable="false">` : ICONOS[tipo] || '';
const BOTS = [0, 3, 5, 7, 9, 11, 15];
const cuenta = await marco({ juego: 'Battle Shmitz', color: COLOR, volver: '/royale/' });
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
  document.body.classList.add('en-isla');
  const m = location.pathname.match(/^\/royale\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else menu();
}

// La isla de fondo, en pausa: la cámara pasea despacio por los lugares.
function fondoIsla(canvas, { colectivo = false } = {}) {
  const vista = new Isla3D(canvas);
  const mundo = structuredClone(generarMapa(7));
  vista.preparar(mundo);
  let raf, ultimo = performance.now();
  const paseo = (ms) => {
    raf = requestAnimationFrame(paseo);
    const dt = Math.min(0.05, (ms - ultimo) / 1000); ultimo = ms;
    const t = ms / 1000;
    let foco;
    if (colectivo) {
      const k = (t % 30) / 30, r = recorridoColectivo(3 + Math.floor(t / 30));
      const c = { x: r.inicio.x + (r.fin.x - r.inicio.x) * k, y: r.inicio.y + (r.fin.y - r.inicio.y) * k, angulo: r.angulo };
      foco = { x: c.x, y: c.y, enColectivo: true };
      vista.dibujar({ mundo, gente: [], balas: [], tomados: new Set(), foco, W: 520, H: 293, dt, ms, zona: null, colectivo: c });
    } else {
      // cada lugar se recorre 11 s con una vuelta lenta, de cerca y a media altura (como un tráiler)
      const n = Math.floor(t / 11), l = LUGARES[n % LUGARES.length], k = (t % 11) / 11;
      const ancho = Math.max(l.w, l.h) * 16;
      foco = { x: (l.x + l.w / 2) * 16, y: (l.y + l.h / 2) * 16, orbita: { angulo: n * 1.9 + k * 1.1, radio: ancho * 0.55 + 150 - k * 30, alto: 95 + ancho * 0.12 - k * 22, mira: 16 } };
      vista.dibujar({ mundo, gente: [], balas: [], tomados: new Set(), foco, W: 520, H: 293, dt, ms, zona: null });
    }
  };
  raf = requestAnimationFrame(paseo);
  return () => { cancelAnimationFrame(raf); vista.dispose(); };
}

// ---------------------------------------------------------------- menú (arriba de la isla)
function menu() {
  document.title = 'Battle Shmitz · cadalado';
  app.innerHTML = `
  <div class="bs-menu">
    <canvas class="bs-fondo" data-fondo></canvas>
    <div class="bs-velo"></div>
    <div class="bs-menu-caja">
      <div class="bs-logo"><span>Temporada 1 · La isla del Queque</span><h1>Battle <em>Shmitz</em></h1></div>
      <nav class="bs-tabs" role="tablist"><button data-tab="jugar" class="on">Jugar</button><button data-tab="unirse">Partidas</button><button data-tab="como">Cómo se juega</button></nav>
      <section class="bs-panel" data-panel="jugar">
        <form data-crear class="bs-form">
          ${cuenta ? `<div class="bs-quien">Jugás como <b>${esc(cuenta.nombre)}</b></div>` : `<label class="bs-campo"><span>Tu nombre</span><input class="bs-entrada" name="nombre" maxlength="20" required value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?"></label>`}
          <div class="bs-campo"><span>Bots en la isla</span><div class="bs-chips" data-bots>${BOTS.map((n) => `<button type="button" data-n="${n}" class="${n === 9 ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          <label class="bs-switch"><input type="checkbox" name="publica" checked><i></i><span>Partida pública <small>cualquiera puede entrar</small></span></label>
          <button class="bs-jugar"><b>Jugar</b><small>Armá la partida y subí al colectivo</small></button>
        </form>
      </section>
      <section class="bs-panel" data-panel="unirse" hidden>
        <form class="bs-codigo" data-unirse><input class="bs-entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="bs-boton">Entrar</button></form>
        <h3 class="bs-sub">Partidas abiertas</h3>
        <div class="bs-salas" data-salas><div class="bs-vacio">Buscando…</div></div>
      </section>
      <section class="bs-panel" data-panel="como" hidden>
        <div class="bs-teclas">
          ${[['Espacio', 'Saltá del colectivo · abrí el planeador'], ['W A S D', 'Movete y dirigí la caída'], ['Mouse', 'Clic: capturar el mouse y disparar · clic derecho: mira · Esc lo libera'], ['E', 'Agarrá (si estás lleno, cambia) · abrí cofres con un toque'], ['1 – 5', 'Elegí casillero · rueda para pasar'], ['C', 'Sacá el pico y juntá materiales'], ['Q', 'Modo construcción · F pieza · R rotar'], ['F', 'Usá vendas, botiquín o escudos'], ['M', 'Mapa: marcá a dónde ir'], ['Tab', 'Inventario completo'], ['B', 'Gestos'], ['T', 'Chat'], ['Esc', 'Pausa']].map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('')}
        </div>
      </section>
    </div>
    <aside class="bs-lugares"><h3>La isla</h3>${LUGARES.map((l) => `<div><b>${esc(l.nombre)}</b><small>${{ ciudad: 'La ciudad grande · el mejor botín', templo: 'Columnas y escondites', oficinas: 'Torres de oficinas y estacionamiento', barrio: 'Casitas con pileta', ruta: 'Bar y almacén de ruta', granja: 'Granero, silo y huerta', estadio: 'El estadio abandonado', puerto: 'Galpones, contenedores y muelles' }[l.estilo]}</small></div>`).join('')}</aside>
  </div>`;
  limpiar.push(fondoIsla(app.querySelector('[data-fondo]')));
  let bots = 9;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    app.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }));
  app.querySelector('[data-bots]').onclick = (e) => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    bots = Number(b.dataset.n);
    app.querySelectorAll('[data-bots] button').forEach((x) => x.classList.toggle('on', x === b));
  };
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(f.get('nombre'));
    try {
      const { code } = await api('/api/royale/crear', { pid: pid(), nombre: f.get('nombre'), opciones: { bots, publica: f.get('publica') === 'on' } });
      ir(`/royale/sala/${code}`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/royale/sala/${c}`);
  };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/royale/lobby');
      const el = app.querySelector('[data-salas]');
      if (!el) return;
      el.innerHTML = salas.length
        ? salas.map((s) => `<a class="bs-sala" href="/royale/sala/${s.code}" data-ir><span class="bs-sala-n">${s.jugadores}</span>
          <span><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Esperando en el colectivo' : s.fase === 'fin' ? 'Terminando' : 'Jugando ahora'} · ${s.bots} bots</small></span><span class="bs-boton">Entrar</span></a>`).join('')
        : '<div class="bs-vacio">No hay partidas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- partida
function abrirSala(code) {
  document.title = `Battle Shmitz ${code} · cadalado`;
  const pila = (lado) => `<div class="hud-mat" data-mat="${lado}"><i>${ICONOS[lado]}</i><b data-mat-n="${lado}">0</b></div>`;
  app.innerHTML = `
  <div class="isla" data-isla>
    <canvas data-lienzo></canvas><canvas data-overlay class="capa-overlay"></canvas>
    <div class="vineta" data-vineta></div><div class="vineta tormenta" data-vineta-t></div>
    <div class="capa hud-mapa hidden" data-hud-mapa>
      <div class="mini-marco"><canvas data-mini width="360" height="360"></canvas><span class="mini-n">N</span></div>
      <div class="mini-lugar"><b data-lugar-n>—</b><small data-cuadro>—</small></div>
      <div class="hud-info">
        <span title="Tiempo de la tormenta"><i>${ICONOS.tormenta}</i><b data-zona-t>—</b></span>
        <span title="Quedan"><i>${ICONOS.gente}</i><b data-vivos-n>0</b></span>
        <span title="Eliminaciones"><i>${ICONOS.calavera}</i><b data-kills-n>0</b></span>
      </div>
      <div class="hud-mats" data-mats>${pila('madera')}${pila('piedra')}${pila('metal')}</div>
      <div class="hud-municion" data-municion></div>
    </div>
    <div class="capa hud-feed" data-feed></div>
    <div class="capa hud-tormenta" data-tormenta></div>
    <div class="capa hud-lugar" data-lugar></div>
    <div class="capa hud-salud hidden" data-salud>
      <div class="hud-barra escudo"><i class="ico">${ICONOS.escudo}</i><div class="hud-tubo"><i data-escudo></i></div><b data-escudo-n>0</b></div>
      <div class="hud-barra vida"><i class="ico">+</i><div class="hud-tubo"><i data-vida></i><s data-vida-dano></s></div><b data-vida-n>100</b></div>
    </div>
    <div class="capa hud-inv hidden" data-inv>
      <div class="hud-arma" data-arma><b data-arma-n></b><span data-arma-balas></span></div>
      <div class="hud-ranuras" data-slots></div>
      <div class="hud-teclas" data-teclas></div>
    </div>
    <div class="capa bs-inventario-panel hidden" data-inventario-panel></div>
    <div class="capa hud-accion hidden" data-pista></div>
    <div class="capa hud-uso hidden" data-uso><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="fondo"/><circle cx="22" cy="22" r="19" class="progreso" data-uso-arco/></svg><b data-uso-t></b><small data-uso-n></small></div>
    <div class="capa hud-construir hidden" data-construir></div>
    <div class="capa hud-colectivo hidden" data-hud-colectivo><small>El colectivo de Battle Shmitz está cruzando la isla</small><b>Saltá con <kbd>Espacio</kbd></b><div class="hud-recorrido"><i data-recorrido></i></div></div>
    <div class="capa hud-altura hidden" data-hud-altura><div class="altimetro"><i data-altura-i></i></div><b data-altura-n>100</b><small data-altura-txt>Caída libre</small></div>
    <div class="capa aviso-centro" data-aviso></div>
    <div class="capa bs-baja hidden" data-baja></div>
    <div class="capa cuenta" data-cuenta></div>
    <div class="capa bs-lobby hidden" data-lobby></div>
    <div class="capa bs-fin hidden" data-fin></div>
    <div class="capa espectar hidden" data-espectar><button data-esp="-1" aria-label="Anterior">‹</button><span>Mirando a <b data-esp-n></b></span><button data-esp="1" aria-label="Siguiente">›</button></div>
    <div class="capa chat-mini"><div class="log" data-log aria-live="polite"></div><form data-chat><input class="bs-entrada" maxlength="200" placeholder="Escribí y pulsá Enter · Esc cierra" autocomplete="off"></form><button type="button" class="chat-ayuda" data-chat-abrir>T para hablar</button></div>
    <div class="capa mapa-grande hidden" data-mapa-grande>
      <div class="mapa-cabeza"><div><small>Battle Shmitz</small><b>Mapa de la isla</b></div><div class="mapa-info" data-mapa-info></div><button class="mapa-x" data-cerrar-mapa aria-label="Cerrar mapa">×</button></div>
      <canvas></canvas>
      <div class="mapa-pie"><span><kbd>Clic</kbd> marcá a dónde ir</span><span><kbd>Clic der.</kbd> borrá la marca</span><span><kbd>Rueda</kbd> zoom</span><span><kbd>Arrastrá</kbd> mover</span><button data-zoom="-">−</button><button data-zoom="+">+</button><button data-centrar>Centrar en mí</button><span><kbd>M</kbd> cerrar</span></div>
    </div>
    <div class="capa tactil" data-tactil><div class="joy izq" data-joy="mov"><i></i></div><div class="joy der" data-joy="tiro"><i></i></div>
      <button class="btn-t" data-btn="E">Agarrar</button><button class="btn-t b2" data-btn="Q">Construir</button><button class="btn-t b3" data-btn="Space">Saltar</button><button class="btn-t b4" data-btn="Pico">Pico</button><button class="btn-t b5" data-btn="M">Mapa</button><button class="btn-t b6" data-btn="Agachar">Agachar</button></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const lienzo = $('[data-lienzo]');
  const vista = new Isla3D(lienzo);
  const cambiarCamara = (e) => { vista.modoCamara = e.detail === 'tercera' ? 'tercera' : 'superior'; };
  addEventListener('cadalado:camara', cambiarCamara);
  limpiar.push(() => removeEventListener('cadalado:camara', cambiarCamara));
  limpiar.push(() => vista.dispose());
  // gestos tipo Fortnite: mantenés la B, movés el mouse y soltás
  const rueda = ruedaGestos({ puede: () => !!yo?.vivo, alElegir: (id) => { const g = GESTOS.find((x) => x.id === id); if (g && yo?.vivo && !yo.mueve) { yo.gesto = g.id; yo.gestoT = g.dur; } } });
  limpiar.push(() => rueda.destruir());
  const overlay = $('[data-overlay]');
  const ctx = overlay.getContext('2d');
  let W = 400;
  const H = 225;
  function redimensionar() {
    const w = lienzo.clientWidth || innerWidth;
    const h = lienzo.clientHeight || innerHeight;
    overlay.width = Math.round(w * Math.min(devicePixelRatio, 2));
    overlay.height = Math.round(h * Math.min(devicePixelRatio, 2));
    W = Math.max(300, Math.min(600, Math.round((H * w) / h)));
  }
  redimensionar();
  addEventListener('resize', redimensionar);
  limpiar.push(() => removeEventListener('resize', redimensionar));

  let est = null;
  let fase = null;
  let claveMundo = null;
  let mundo = null;
  let imagen = null;
  let abiertos = new Set();
  let firmaConstrucciones = '';
  let firmaFuentes = '';
  let ultimoLugar = null;
  let yo = null;
  let balas = [];
  let granadas = [];
  let tomados = new Set();
  let marca = null;
  const remotos = new Map(); // id → { obj, meta, visto }
  const botsSim = new Map(); // (anfitrión) 'botN' → { p: Peleador, cerebro }
  const botsVistos = new Map(); // (los demás) 'botN' → { obj, meta }
  const globos = new Map(); // id → { texto, hasta }
  const numeros = []; // números de daño que flotan
  let golpeT = 0;
  let slotNuevo = { i: -1, hasta: 0 };
  let ultimoAgarre = 0;
  let fuegoT = 0;
  let bajasPartida = null;
  const bajasVistas = new Set();
  const bajasAnunciadas = new Set();
  const tiroFuente = new Map();
  let espectando = 0;
  let muertePor = null;
  let lentoHasta = 0, finDesde = 0; // cámara lenta y reloj de la victoria
  const reenvio = {}; // último reenvío de una muerte que el servidor no registró
  let reportado = false;
  const guardadoClave = 'cadalado-royale-' + code;
  const yoId = () => est?.yo;
  const nombreDe = (id) => (String(id).startsWith('bot') ? est?.botNombres?.[Number(String(id).slice(3))] : est?.jugadores.find((j) => j.id === id)?.nombre) || '—';
  const lookDe = (id) => (String(id).startsWith('bot') ? { ...POR_ID[est.botNpc[Number(String(id).slice(3))]]?.look } : lookDeJugador(est.jugadores.find((j) => j.id === id), id, colorDe(id)));
  // quién simula los bots: el que armó la sala si está; si no, el primero conectado
  // Si el que simula deja de mandar los bots (pestaña en segundo plano, se le cortó), toma la posta el siguiente.
  let ultimosBots = performance.now();
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id).sort();
    const host = online.includes(est.host) ? est.host : online[0];
    const hayBots = (est.vivos || []).some((x) => String(x).startsWith('bot'));
    const trabado = est.fase === 'partida' && hayBots && host !== est.yo && performance.now() - ultimosBots > 6000;
    if (!trabado) return host;
    return online.filter((x) => x !== host)[0] || host;
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;
  const mapa = new MapaGrande($('[data-mapa-grande]'), { alMarcar: (p) => { marca = p; if (p) aviso('Marcaste ' + (lugarEn(p.x, p.y)?.nombre || cuadricula(p.x, p.y))); } });
  $('[data-cerrar-mapa]').onclick = () => mapa.cerrar();

  // ---------------------------------------------------------------- red
  const red = { actual: null };
  // Esc: el que armó la sala puede reiniciar la partida (vuelve a la configuración, no larga directo)
  window.__reiniciar = { puede: () => !!est && est.host === est.yo && est.fase !== 'lobby', hacer: () => sala.enviar({ t: 'reiniciar' }) };
  limpiar.push(() => { delete window.__reiniciar; });
  const sala = new Sala('/api/royale', code, {
    intervalo: (e) => (e?.fase === 'partida' ? 1000 : 900),
    onEstado: (e) => {
      est = e;
      if (bajasPartida !== e.partidas) { bajasPartida = e.partidas; bajasVistas.clear(); bajasAnunciadas.clear(); for (const b of e.bajas || []) bajasVistas.add(`${b.id}:${b.t}`); }
      else for (const b of e.bajas || []) {
        const clave = `${b.id}:${b.t}`;
        if (bajasVistas.has(clave)) continue;
        bajasVistas.add(clave);
        if (b.por === e.yo && b.id !== e.yo) mostrarBaja(b, e.kills?.[e.yo] || 0);
      }
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: mensaje, ruta: '/api/royale', accionPlanB: 'mensaje' });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      for (const id of e.tomados) tomados.add(id);
      if (mundo) for (const b of e.sueltos || []) if (!mundo.botin.some((x) => x.id === b.id)) { mundo.botin.push(b); vista.agregarBotin(b); }
      if (e.fase !== fase) cambioDeFase(e.fase);
      // Una respuesta reciente de apertura no debe desaparecer por un poll anterior.
      abiertos = new Set([...abiertos, ...(e.abiertos || [])]);
      if (mundo) {
        const firma = JSON.stringify(e.construcciones || []);
        if (firma !== firmaConstrucciones) { firmaConstrucciones = firma; mundo.construcciones = e.construcciones || []; vista.actualizarConstrucciones(mundo.construcciones); }
        const fuentes = JSON.stringify(e.fuentes || {});
        if (fuentes !== firmaFuentes) {
          firmaFuentes = fuentes;
          for (const [id, estado] of Object.entries(e.fuentes || {})) {
            if (id.startsWith('o')) { const o = mundo.obstaculos.find((o) => o.id === id); if (o) o.roto = estado.vida <= 0; }
            else if (id.startsWith('m') && estado.vida <= 0) mundo.t[Number(id.slice(1))] = 3;
          }
          vista.actualizarFuentes(mundo);
        }
      }
      if (yo) { yo.materiales = { ...e.materiales?.[yoId()] }; }
      for (const [id, b] of botsSim) b.p.materiales = { ...e.materiales?.[id] };
      pintarPaneles();
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k === 'msg') return mensaje(ev.de, ev.datos);
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis';
        d.textContent = ev.texto;
        if (/eliminó|zona|desconectó/.test(ev.texto)) agregarFeed(ev.texto.replace(/ · quedan.*/, ''));
      } else {
        if (ev.bot) d.className = 'bot';
        d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`;
        globos.set(ev.de, { texto: ev.texto, hasta: performance.now() + 4500 });
      }
      log.append(d);
      while (log.children.length > 30) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
      log.classList.add('activo'); clearTimeout(log._t); log._t = setTimeout(() => log.classList.remove('activo'), 6000);
    },
    // los pedidos automáticos (botín al pasar, bots, pico) fallan seguido sin que importe: esos no se avisan
    onError: (m) => { if (!/disponible|Mantené E|picar|ya se rompió|ya no está|construir ahí|no es tuyo|soltar eso/.test(m)) toast(m, true); },
    onNoExiste: () => {
      toast('Esa partida no existe.', true);
      ir('/royale/');
    },
  });
  recordar('royale', `/royale/sala/${code}`, `Battle Shmitz ${code}`);
  limpiar.push(() => {
    sala.cerrar();
    red.actual?.cerrar();
    cancelAnimationFrame(raf);
  });

  // Estado compacto: yo (y, si soy anfitrión, los bots después de '#')
  const codificarP = (p) => `${p.x | 0},${p.y | 0},${p.ang.toFixed(2)},${p.vida | 0},${p.escudo | 0},${CODIGO_ARMA[p.arma.tipo] || 'x'},${p.mueve ? 1 : 0},${p.vivo ? 1 : 0},${p.gesto ? GESTOS.findIndex((g) => g.id === p.gesto) + 1 : 0},${p.altura | 0},${p.enColectivo ? 1 : 0},${p.paracaidas ? 1 : 0},${p.usando?.tipo || ''},${p.usando ? (1 - p.usando.restante / p.usando.total).toFixed(2) : 0},${Math.max(0, RAREZA_N.indexOf(p.arma.rareza))},${p.agachado ? 1 : 0},${Math.round(p.brinco || 0)}`;
  const decodificarP = (s) => {
    const [x, y, ang, vida, escudo, arma, mueve, vivo, gesto, altura, enColectivo, paracaidas, uso, progreso, rareza, agachado, brinco] = s.split(',');
    return { x: +x, y: +y, ang: +ang, vida: +vida, escudo: +escudo, arma: ARMA_DE_CODIGO[arma] || 'vacio', rareza: RAREZA_N[+rareza || 0], mueve: mueve === '1', vivo: vivo === '1', gesto: GESTOS[(+gesto || 0) - 1]?.id || null, altura: +altura || 0, enColectivo: enColectivo === '1', paracaidas: paracaidas === '1', usando: OBJETOS[uso] ? { tipo: uso, progreso: +progreso || 0 } : null, agachado: agachado === '1', brinco: +brinco || 0 };
  };
  function recibir(id, s) {
    const [mio, botsTxt] = String(s).split('#');
    if (mio) {
      const m = decodificarP(mio);
      let r = remotos.get(id);
      if (!r) remotos.set(id, (r = { obj: { ...m, id }, meta: m }));
      r.meta = m;
      r.visto = performance.now();
    }
    if (botsTxt) ultimosBots = performance.now();
    if (botsTxt && !soyAnfitrion()) for (const b of botsTxt.split(';')) {
      const i = b.indexOf(':');
      const bid = b.slice(0, i);
      const m = decodificarP(b.slice(i + 1));
      let r = botsVistos.get(bid);
      if (!r) botsVistos.set(bid, (r = { obj: { ...m, id: bid }, meta: m }));
      r.meta = m;
    }
  }
  const vistos = new Set();
  function mensaje(de, m) {
    if (!m || typeof m !== 'object') return;
    const clave = `${de}:${m.n}`;
    if (m.n !== undefined && vistos.has(clave)) return;
    vistos.add(clave);
    if (m.k === 'bajaConfirmada' && m.por === yoId() && (de === m.id || (String(m.id).startsWith('bot') && de === est.host))) { mostrarBaja({ id: m.id, nombre: nombreDe(m.id) }, (est.kills?.[yoId()] || 0) + 1); }
    else if (m.k === 'tiro') {
      // disparo de otro: solo se ve (el daño lo calcula quien dispara)
      const d = ARMAS[m.arma] || ARMAS.pistola;
      const r = rng(Math.floor(m.s * 1e6));
      for (let k = 0; k < d.perdigones; k++) {
        const b = nuevaBala(m.de || de, m.x, m.y, m.a + (r() - 0.5) * d.dispersion * 2, m.arma, m.rareza);
        b.visual = true;
        balas.push(b);
      }
    } else if (m.k === 'salto') {
      const remoto = remotos.get(m.de || de);
      if (remoto) { remoto.obj.enColectivo = false; remoto.obj.altura = ALTURA_SALTO; remoto.obj.x = m.x; remoto.obj.y = m.y; }
    } else if (m.k === 'dano' && yo?.vivo && fase === 'partida') {
      recibirDano(m.d, m.por);
    } else if (m.k === 'danoBot' && soyAnfitrion()) {
      const b = botsSim.get(m.bot);
      if (b) danarBot(b, m.d, m.por);
    } else if (m.k === 'agarre') tomados.add(m.id);
    else if (m.k === 'granada') granadas.push({ ...m.g, visual: true });
    else if (m.k === 'pico') { const o = mundo?.obstaculos.find((x) => x.id === m.id); if (o) vista.golpe(o.x, o.y); }
    else if (m.k === 'drop' && m.b && mundo && !mundo.botin.some((b) => b.id === m.b.id)) { mundo.botin.push(m.b); vista.agregarBotin(m.b); }
  }

  // ---------------------------------------------------------------- fases
  function prepararMundo(semilla) {
    if (claveMundo === semilla) return;
    claveMundo = semilla;
    mundo = structuredClone(generarMapa(semilla));
    firmaConstrucciones = ''; firmaFuentes = '';
    vista.preparar(mundo);
    imagen = imagenMapa(mundo);
  }
  function cambioDeFase(nueva) {
    if (nueva === 'fin' && fase === 'partida') { lentoHasta = performance.now() + 1700; finDesde = performance.now(); if (vista) vista.campeonT = 0; } // la última baja, en cámara lenta
    fase = nueva;
    if (nueva !== 'partida' && nueva !== 'cuenta' && document.pointerLockElement) document.exitPointerLock?.();
    if (nueva === 'cuenta' || (nueva === 'partida' && !yo)) empezarPartida();
    if (nueva === 'lobby') {
      prepararMundo(est.semillaSala || 1);
      yo = null;
      marca = null;
      botsSim.clear();
      botsVistos.clear();
      remotos.clear();
      balas = [];
    }
    if (nueva !== 'partida') mapa.cerrar();
  }
  function empezarPartida() {
    prepararMundo(est.semilla);
    tomados = new Set(est.tomados);
    abiertos = new Set(est.abiertos || []);
    balas = [];
    remotos.clear();
    botsSim.clear();
    botsVistos.clear();
    reportado = false;
    muertePor = null;
    marca = null;
    const todos = [...est.participantes, ...est.botNpc.map((_, i) => 'bot' + i)];
    const lugar = (id) => mundo.salidas[todos.indexOf(id) % mundo.salidas.length];
    if (est.participantes.includes(yoId())) {
      const s = lugar(yoId());
      yo = new Peleador(yoId(), s.x, s.y);
      yo.subirColectivo();
    } else yo = null; // entró mirando
    // los bots: cada uno elige un lugar con nombre y salta cuando el colectivo pasa cerca (los simula el anfitrión)
    const aterrizajes = puntosAterrizaje(mundo, est.semilla, est.botNpc.length);
    est.botNpc.forEach((_, i) => {
      const id = 'bot' + i;
      const s = lugar(id);
      const p = new Peleador(id, s.x, s.y);
      p.subirColectivo();
      const destino = aterrizajes[i];
      botsSim.set(id, { p, destino, salto: tiempoParaLugar(est.semilla, destino.lugar) + (i % 3) * 0.45, cerebro: new CerebroBot(p, rng((est.semilla + i * 7919) >>> 0)) });
    });
    try { const save = JSON.parse(sessionStorage.getItem(guardadoClave) || 'null'); if (save?.semilla === est.semilla && save.id === yoId()) { if (yo && save.yo) Object.assign(yo, save.yo, { vivo: est.vivos.includes(yoId()) }); for (const [id, data] of save.bots || []) if (botsSim.has(id)) Object.assign(botsSim.get(id).p, data, { vivo: est.vivos.includes(id) }); } } catch {}
    if (soyAnfitrion()) est.botNpc.slice(0, 2).forEach((_, i) => setTimeout(() => sala.enviar({ t: 'botdice', bot: 'bot' + i, situacion: 'saludo' }), 1500 + i * 2500));
  }

  // la sala (antes de largar) y el final: menús arriba del juego
  function pintarPaneles() {
    const e = est;
    const esHost = e.host === e.yo;
    const lob = $('[data-lobby]');
    lob.classList.toggle('hidden', e.fase !== 'lobby');
    if (e.fase === 'lobby') {
      const online = e.jugadores.filter((j) => j.online);
      const firma = JSON.stringify([online.map((j) => j.id), e.bots, e.botNpc, e.host, e.npcElegidos]);
      if (lob.dataset.firma !== firma) {
        lob.dataset.firma = firma;
        const anfitrion = e.jugadores.find((j) => j.id === e.host)?.nombre || '';
        lob.innerHTML = `<div class="bs-lobby-caja">
          <div class="bs-logo chico"><span>Sala ${esc(code)} · ${online.length + e.botNpc.length} en el colectivo</span><h1>Battle <em>Shmitz</em></h1></div>
          <div class="bs-invitar"><code>${esc(location.host + location.pathname)}</code><button class="bs-boton" data-copiar>Copiar link</button></div>
          <div class="bs-gente">${online.map((j) => `<div class="${j.id === e.yo ? 'yo' : ''}"><span class="av">${avatarSvg(lookDeJugador(j, j.id, colorDe(j.id)))}</span><b>${esc(j.nombre)}</b><small>${j.id === e.host ? 'Arma la partida' : j.id === e.yo ? 'Vos' : 'Listo'}</small></div>`).join('')}
            ${e.botNpc.map((n, i) => `<div class="bot ${n === 'mati' ? 'dorado' : ''}"><span class="av">${avatarSvg({ ...POR_ID[n]?.look })}</span><b>${esc(e.botNombres[i])}</b><small>Bot</small></div>`).join('')}</div>
          ${esHost ? `<div class="bs-campo"><span>Bots</span><div class="bs-chips" data-bots>${BOTS.map((n) => `<button type="button" data-n="${n}" class="${n === e.bots ? 'on' : ''}">${n}</button>`).join('')}</div></div>
            <button type="button" class="bs-npcs" data-npcs>${textoNpcs(e.npcElegidos)}</button>
            <button class="bs-jugar" data-largar><b>¡A la isla!</b><small>Arranca la cuenta regresiva</small></button>` : `<div class="bs-espera">Esperando que ${esc(anfitrion)} largue la partida…</div>`}
          <p class="bs-nota">Caés con una pistola y 48 balas. Buscá cofres dorados y armas de mayor rareza.</p>
        </div>`;
        lob.querySelector('[data-bots]')?.addEventListener('click', (ev) => { const b = ev.target.closest('[data-n]'); if (b) sala.enviar({ t: 'bots', n: Number(b.dataset.n) }); });
        lob.querySelector('[data-largar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
        lob.querySelector('[data-npcs]')?.addEventListener('click', () => abrirElegirNpcs({ elegidos: est.npcElegidos || [], max: 15, color: '#ffb347', alGuardar: (ids) => sala.enviar({ t: 'npcs', ids }) }));
        lob.querySelector('[data-copiar]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); } catch {} toast('Link de la partida copiado'); });
      }
    }
    const fin = $('[data-fin]');
    fin.classList.toggle('hidden', e.fase !== 'fin');
    if (e.fase === 'fin' && fin.dataset.partida !== String(e.partidas)) {
      fin.dataset.partida = e.partidas;
      const orden = [...(e.ganador ? [{ id: e.ganador, nombre: e.ganadorNombre, puesto: 1 }] : []), ...[...e.bajas].reverse()];
      const gane = e.ganador === e.yo;
      const mio = orden.findIndex((x) => x.id === e.yo);
      const total = orden.length;
      fin.classList.toggle('gano', gane);
      fin.classList.toggle('con-campeon', !!e.ganador);
      const confeti = Array.from({ length: 80 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 3).toFixed(2)}s;--t:${(2.6 + Math.random() * 2.4).toFixed(2)}s;--c:${['#ffd23f', '#ff5fa8', '#4fd1ff', '#c5f04a', '#ffffff', '#ff9a3b'][i % 6]};--g:${Math.round(Math.random() * 900 - 450)}deg"></i>`).join('');
      fin.innerHTML = `${e.ganador ? `<div class="bs-flash"></div><div class="bs-confeti">${confeti}</div>
        <div class="bs-victoria ${gane ? 'mia' : ''}"><i class="rayos"></i><i class="onda"></i><i class="onda dos"></i>
          <div class="bs-v-num">#1</div>
          <div class="bs-v-cinta"><span>Victoria magistral</span></div>
          <strong>${esc(e.ganadorNombre || 'Ganador')}</strong>
          <small>${e.kills?.[e.ganador] || 0} eliminaciones · Battle Shmitz</small>
        </div>` : ''}<div class="bs-fin-caja ${gane ? 'gano' : ''}">
        ${gane ? `<div class="bs-corona">${ICONOS.corona}</div><small>#1 de ${total}</small><h2>¡Último en pie!</h2><p>Ganaste Battle Shmitz con ${e.kills[e.yo] || 0} eliminaciones.</p>`
          : mio >= 0 ? `<small>Quedaste</small><h2>#${mio + 1} <span>de ${total}</span></h2><p>${e.ganadorNombre ? `Ganó ${esc(e.ganadorNombre)}.` : 'Terminó la partida.'} Hiciste ${e.kills[e.yo] || 0} eliminaciones.</p>`
          : `<small>Terminó</small><h2>${e.ganadorNombre ? `Ganó ${esc(e.ganadorNombre)}` : 'Fin de la partida'}</h2>`}
        <div class="bs-tabla">${orden.slice(0, 12).map((x, i) => `<div class="${x.id === e.yo ? 'yo' : ''}"><b>#${i + 1}</b><span>${esc(x.nombre)}</span><span class="mono">${e.kills[x.id] || 0} elim.</span></div>`).join('')}</div>
        <div class="bs-fin-botones">${esHost ? '<button class="bs-jugar" data-otra><b>Otra partida</b><small>Todos al colectivo</small></button>' : '<div class="bs-espera">En unos segundos vuelven al colectivo.</div>'}<a class="bs-boton" href="/royale/" data-ir>Salir</a></div>
      </div>`;
      fin.querySelector('[data-otra]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
    }
  }

  function agregarFeed(texto) {
    const f = $('[data-feed]');
    const d = document.createElement('div');
    d.innerHTML = texto.replace(/^(.+?) eliminó a (.+)$/, `<b>$1</b><i>${ICONOS.calavera}</i><span>$2</span>`).replace(/^(.+?) se quedó en la zona$/, `<span>$1</span><i>${ICONOS.tormenta}</i><small>tormenta</small>`);
    f.prepend(d);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.classList.add('sale'), 6500);
    setTimeout(() => d.remove(), 7000);
  }
  function aviso(texto, malo = false) {
    $('[data-aviso]').innerHTML = `<span class="${malo ? 'malo' : ''}">${esc(texto)}</span>`;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => ($('[data-aviso]').innerHTML = ''), 1900);
  }
  function mostrarBaja(b, total) {
    if (bajasAnunciadas.has(b.id)) return;
    bajasAnunciadas.add(b.id);
    const el = $('[data-baja]');
    el.innerHTML = `<div class="bs-baja-cinta"><small>Battle Shmitz · baja confirmada</small><strong>¡ELIMINASTE A ${esc(b.nombre).toUpperCase()}!</strong><span>${total} ${total === 1 ? 'eliminación' : 'eliminaciones'} en esta partida</span></div>`;
    el.classList.remove('hidden');
    el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 3200);
    sonar('gana');
  }
  function anunciarLugar(l) {
    const el = $('[data-lugar]');
    el.innerHTML = `<small>Llegaste a</small><b>${esc(l.nombre)}</b>`;
    el.classList.remove('ver'); void el.offsetWidth; el.classList.add('ver');
  }

  // ---------------------------------------------------------------- daño
  function recibirDano(d, por) {
    if (!yo?.vivo) return;
    numeros.push({ x: yo.x, y: yo.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 800, malo: true, escudo: yo.escudo > 0 });
    $('[data-vineta]').classList.remove('golpe'); void $('[data-vineta]').offsetWidth; $('[data-vineta]').classList.add('golpe');
    if (yo.dano(d, por === 'zona')) morir(por);
  }
  function morir(por) {
    if (reportado) return;
    reportado = true;
    muertePor = por;
    red.actual?.todos({ k: 'bajaConfirmada', id: yoId(), por });
    sala.enviar({ t: 'muerte', victima: yoId(), por });
    aviso(por === 'zona' ? 'Te agarró la tormenta' : `Te eliminó ${nombreDe(por)}`, true);
    if (document.pointerLockElement) document.exitPointerLock?.(); // para poder elegir a quién mirar
  }
  function danarBot(b, d, por) {
    if (!b.p.vivo) return;
    numeros.push({ x: b.p.x, y: b.p.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 800, escudo: b.p.escudo > 0 });
    const murio = b.p.dano(d, por === 'zona');
    if (!murio && (b.p.materiales?.madera || 0) >= 10 && Math.random() < 0.27) {
      const atacante = por === yoId() ? yo : remotos.get(por)?.obj;
      const ang = atacante ? Math.atan2(atacante.y - b.p.y, atacante.x - b.p.x) : b.p.ang;
      const punto = alinearPieza(b.p.x + Math.cos(ang) * 27, b.p.y + Math.sin(ang) * 27);
      const pieza = { id: 'pieza-' + b.p.id + '-' + Date.now(), ...punto, tipo: 'pared', material: 'madera', rotacion: Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang)) ? 1 : 0 };
      if (validarPieza(mundo, mundo.construcciones || [], pieza, b.p.materiales)) sala.enviar({ t: 'construir', bot: b.p.id, pieza });
    }
    if (murio) {
      b.muertoPor = por;
      if (por === yoId()) mostrarBaja({ id: b.p.id, nombre: nombreDe(b.p.id) }, (est.kills?.[yoId()] || 0) + 1);
      red.actual?.todos({ k: 'bajaConfirmada', id: b.p.id, por });
      sala.enviar({ t: 'muerte', victima: b.p.id, por });
      if (Math.random() < 0.35) sala.enviar({ t: 'botdice', bot: b.p.id, situacion: 'pierde' });
      if (String(por).startsWith('bot') && Math.random() < 0.45) setTimeout(() => sala.enviar({ t: 'botdice', bot: por, situacion: 'gana' }), 700);
    } else if (b.p.vida < 35 && Math.random() < 0.08) sala.enviar({ t: 'botdice', bot: b.p.id, situacion: 'pierde' });
  }
  // Una bala tocó a alguien: el que disparó avisa (o lo aplica si es suyo).
  function impacto(bala, blanco) {
    const d = bala.dano * (String(bala.de).startsWith('bot') ? 0.65 : 1); // los bots pegan un poco menos
    if (bala.de === yoId()) golpeT = performance.now();
    if (blanco.id === yoId()) return recibirDano(d, bala.de);
    if (String(blanco.id).startsWith('bot')) {
      if (soyAnfitrion()) {
        const b = botsSim.get(blanco.id);
        if (b) danarBot(b, d, bala.de);
      } else {
        red.actual?.a(idAnfitrion(), { k: 'danoBot', bot: blanco.id, d, por: bala.de });
        numeros.push({ x: blanco.x, y: blanco.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 800, escudo: blanco.escudo > 0 });
      }
      return;
    }
    numeros.push({ x: blanco.x, y: blanco.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 800, escudo: blanco.escudo > 0 });
    red.actual?.a(blanco.id, { k: 'dano', d, por: bala.de });
  }

  // ---------------------------------------------------------------- controles
  const teclas = new Set();
  const mouse = { x: 0.5, y: 0.5, abajo: false };
  let pedirAgarrar = false;
  let pedirSalto = false;
  let modoConstruccion = false;
  let picoActivo = false;
  let tipoPieza = 'pared';
  let materialPieza = 'madera';
  let rotacionPieza = 0;
  let pedirColocar = false;
  let ultimoGolpe = 0;
  let cofreActual = null;
  const ABRIR_COFRE_MS = 1500;
  // Al completarse la barra el cofre se abre en el acto (en tu pantalla); el aviso al servidor se reintenta
  // solo hasta que lo confirma (antes, si la respuesta tardaba, quedaba "Abriendo el cofre…" para siempre).
  const cofresPorConfirmar = new Map(); // id → último envío
  function abrirCofreYa(a) {
    a.enviado = true;
    if (!abiertos.has(a.id)) { abiertos.add(a.id); aviso('¡Abriste un cofre!'); }
    if (cofreActual === a) cofreActual = null;
    cofresPorConfirmar.set(a.id, 0);
  }
  function confirmarCofres(ms) {
    for (const [id, ultimo] of cofresPorConfirmar) {
      if (est?.abiertos?.includes(id) || fase !== 'partida') { cofresPorConfirmar.delete(id); continue; }
      if (ms - ultimo < 1500) continue;
      cofresPorConfirmar.set(id, ms);
      sala.enviar({ t: 'abrirCofre', id }).then((r) => {
        if (!r) return; // sin respuesta: se reintenta en el próximo turno
        if (!r.error || /no está disponible/.test(r.error)) cofresPorConfirmar.delete(id);
      });
    }
  }

  let tactilE = false;
  let mira = false;
  let recogiendo = false;
  let inventarioAbierto = false;
  let invElegido = -1; // casillero elegido en la mochila para cambiarlo de lugar
  const abajo = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.code === 'KeyT' || e.code === 'Enter') {
      liberar(); teclas.clear(); mouse.abajo = false; $('[data-chat]').classList.add('escribiendo'); $('[data-chat] input').focus();
      return e.preventDefault();
    }
    if (e.code === 'Tab') { inventarioAbierto = !inventarioAbierto; invElegido = -1; teclas.clear(); if (inventarioAbierto) liberar(); else capturar(); return e.preventDefault(); }
    if (e.code === 'Escape' && mapa.abierto) { mapa.cerrar(); e.stopImmediatePropagation(); return; }
    if (!teclas.has(e.code)) {
      if (e.code === 'KeyR') { if (modoConstruccion) rotacionPieza = (rotacionPieza + 1) % 4; else yo?.recargar(); }
      if (e.code === 'KeyM' && (fase === 'partida' || fase === 'cuenta')) { mapa.alternar(yo); if (mapa.abierto) liberar(); else capturar(); }
      if (e.code === 'Space') pedirSalto = true;
      if (e.code === 'KeyE' && !e.repeat) pedirAgarrar = true; // la autorepetición del teclado no cuenta como otro toque
      if (e.code === 'KeyQ') { modoConstruccion = !modoConstruccion; picoActivo = false; }
      if (e.code === 'KeyC') { picoActivo = !picoActivo; modoConstruccion = false; }
      if ((e.code === 'ControlLeft' || e.code === 'KeyZ') && yo?.vivo && !yo.enColectivo && !(yo.altura > 0)) { yo.agachado = !yo.agachado; aviso(yo.agachado ? 'Agachado: más lento y más preciso' : 'De pie'); }
      if (e.code === 'KeyV') cambiarVista();
      if (/^Digit[1-5]$/.test(e.code)) {
        const n = Number(e.code.slice(-1));
        if (modoConstruccion && n <= 3) materialPieza = ['madera', 'piedra', 'metal'][n - 1];
        else { yo?.cambiar(n - 1); picoActivo = false; }
      }
      if (e.code === 'KeyF') { if (modoConstruccion) tipoPieza = tipoPieza === 'pared' ? 'escalera' : 'pared'; else usarObjeto(); }
      if (e.code === 'KeyX' && yo?.slots[yo.actual]) soltarActual();
      if (mirando() && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) espectando += e.code === 'ArrowLeft' ? -1 : 1;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    teclas.add(e.code);
  };
  function soltarActual() {
    const it = yo.slots[yo.actual]; const id = 'drop-' + yoId() + '-' + Date.now();
    const b = { id, tipo: it.tipo, rareza: it.rareza || 'comun', item: { ...it }, x: Math.max(0, Math.min(LADO, yo.x + Math.cos(yo.ang) * 16)), y: Math.max(0, Math.min(LADO, yo.y + Math.sin(yo.ang) * 16)) };
    sala.enviar({ t: 'soltar', b }).then((r) => { if (r && !r.error) { mundo.botin.push(b); vista.agregarBotin(b); yo.slots[yo.actual] = null; yo.usando = null; red.actual?.todos({ k: 'drop', b, n: Math.random() }); } });
  }
  const arriba = (e) => teclas.delete(e.code);
  const perderFoco = () => { teclas.clear(); mouse.abajo = false; };
  addEventListener('blur', perderFoco); limpiar.push(() => removeEventListener('blur', perderFoco));
  addEventListener('keydown', abajo, true);
  addEventListener('keyup', arriba);
  $('[data-mini]').addEventListener('click', () => mapa.alternar(yo));
  // ---- Mouse capturado (pointer lock): al hacer clic en el juego el cursor se esconde y queda adentro.
  // No se escapa a otro monitor ni toca el minimapa; solo mueve la cámara (tercera persona) o la mira (desde arriba).
  // Se libera solo al abrir el mapa (M), la mochila (Tab) o el chat (T), y con Esc.
  const SENS = 0.0032;
  const esTactil = () => !matchMedia('(any-pointer: fine)').matches; // solo pantalla táctil, sin mouse
  const capturado = () => document.pointerLockElement === lienzo;
  const puedeCapturar = () => !esTactil() && (fase === 'partida' || fase === 'cuenta') && !!yo?.vivo && !mapa.abierto && !inventarioAbierto && !document.querySelector('.cl-esc') && !$('[data-chat]').classList.contains('escribiendo');
  const capturar = () => { if (!capturado() && puedeCapturar()) { try { const p = lienzo.requestPointerLock?.(); p?.catch?.(() => {}); } catch {} } };
  const liberar = () => { if (capturado()) document.exitPointerLock?.(); };
  const alMoverCapturado = (e) => {
    if (!capturado()) return;
    if (vista.modoCamara === 'tercera') {
      vista.yaw = (vista.yaw || 0) - e.movementX * SENS;
      vista.inclina = Math.max(0.35, Math.min(1.6, (vista.inclina ?? 1) + e.movementY * SENS * 0.6));
      mouse.x = 0.5; mouse.y = 0.47;
    } else {
      const r = lienzo.getBoundingClientRect();
      mouse.x = Math.max(0.02, Math.min(0.98, mouse.x + e.movementX / r.width));
      mouse.y = Math.max(0.03, Math.min(0.97, mouse.y + e.movementY / r.height));
    }
  };
  const alCambiarCaptura = () => {
    $('[data-isla]').classList.toggle('mouse-capturado', capturado());
    if (!capturado()) { mouse.abajo = false; mira = false; if (puedeCapturar()) aviso('Mouse liberado · hacé clic para seguir jugando'); }
    else if (vista.modoCamara === 'tercera') { mouse.x = 0.5; mouse.y = 0.47; }
  };
  document.addEventListener('mousemove', alMoverCapturado);
  document.addEventListener('pointerlockchange', alCambiarCaptura);
  limpiar.push(() => { document.removeEventListener('mousemove', alMoverCapturado); document.removeEventListener('pointerlockchange', alCambiarCaptura); liberar(); });
  lienzo.addEventListener('pointermove', (e) => {
    if (capturado()) return;
    const r = lienzo.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = (e.clientY - r.top) / r.height;
  });
  // clic derecho: en tercera persona mueve la cámara; desde arriba, apunta con la mira
  let giro = null;
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') capturar();
    if (e.pointerType === 'mouse' && e.button === 0) { mouse.abajo = true; mouse.clic = performance.now(); }
    if (e.button === 0 && modoConstruccion) pedirColocar = true;
    if (e.button === 2) { e.preventDefault(); if (capturado() || vista.modoCamara !== 'tercera') mira = true; else { try { lienzo.setPointerCapture(e.pointerId); } catch {} giro = { x: e.clientX, y: e.clientY }; } }
  });
  const moverGiro = (e) => { if (!giro) return; vista.yaw = (vista.yaw || 0) - (e.clientX - giro.x) * 0.008; vista.inclina = Math.max(0.35, Math.min(1.6, (vista.inclina ?? 1) + (e.clientY - giro.y) * 0.004)); giro = { x: e.clientX, y: e.clientY }; };
  addEventListener('pointermove', moverGiro);
  limpiar.push(() => removeEventListener('pointermove', moverGiro));
  function cambiarVista() {
    const modo = vista.modoCamara === 'tercera' ? 'superior' : 'tercera';
    vista.modoCamara = modo;
    try { localStorage.setItem('cadalado.royale.camara', modo); } catch {}
    aviso(modo === 'tercera' ? 'Tercera persona · clic derecho y arrastrá para girar' : 'Vista desde arriba');
  }
  const sinMenuContextual = (e) => { if (e.target.closest('[data-isla]')) { e.preventDefault(); e.stopPropagation(); } };
  document.addEventListener('contextmenu', sinMenuContextual, true);
  limpiar.push(() => document.removeEventListener('contextmenu', sinMenuContextual, true));
  const soltar = () => { mouse.abajo = false; mira = false; giro = null; };
  addEventListener('pointerup', soltar);
  lienzo.addEventListener('wheel', (e) => { if (modoConstruccion) materialPieza = ['madera', 'piedra', 'metal'][(['madera', 'piedra', 'metal'].indexOf(materialPieza) + (e.deltaY > 0 ? 1 : 2)) % 3]; else { yo?.cambiar(); picoActivo = false; } }, { passive: true });
  limpiar.push(() => {
    removeEventListener('keydown', abajo, true);
    removeEventListener('keyup', arriba);
    removeEventListener('pointerup', soltar);
  });
  app.querySelectorAll('[data-esp]').forEach((b) => (b.onclick = () => (espectando += Number(b.dataset.esp))));
  $('[data-chat]').onsubmit = (e) => {
    e.preventDefault();
    const i = e.target.querySelector('input');
    if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value });
    i.value = '';
    i.blur();
    $('[data-chat]').classList.remove('escribiendo');
  };
  $('[data-chat] input').addEventListener('keydown', (e) => { if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); e.currentTarget.blur(); $('[data-chat]').classList.remove('escribiendo'); } });
  $('[data-chat-abrir]').onclick = () => { teclas.clear(); mouse.abajo = false; $('[data-chat]').classList.add('escribiendo'); $('[data-chat] input').focus(); };
  // táctil: un joystick para moverse y otro para apuntar y disparar
  const tactil = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // los controles táctiles solo durante la partida
  $('[data-isla]').classList.toggle('es-tactil', tactil);
  const joys = { mov: { x: 0, y: 0 }, tiro: { x: 0, y: 0 } };
  app.querySelectorAll('[data-joy]').forEach((el) => {
    const j = joys[el.dataset.joy];
    const mover = (e) => {
      const r = el.getBoundingClientRect();
      let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      let dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      const n = Math.hypot(dx, dy);
      if (n > 1) { dx /= n; dy /= n; }
      j.x = dx; j.y = dy;
      el.querySelector('i').style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
    };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); mover(e); });
    el.addEventListener('pointermove', (e) => el.hasPointerCapture(e.pointerId) && mover(e));
    const fin = () => { j.x = j.y = 0; el.querySelector('i').style.transform = ''; };
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', fin);
  });
  app.querySelectorAll('[data-btn]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (b.dataset.btn === 'E') { pedirAgarrar = true; tactilE = true; }
    else if (b.dataset.btn === 'Space') pedirSalto = true;
    else if (b.dataset.btn === 'Q') { modoConstruccion = !modoConstruccion; picoActivo = false; }
    else if (b.dataset.btn === 'Pico') { picoActivo = !picoActivo; modoConstruccion = false; }
    else if (b.dataset.btn === 'M') mapa.alternar(yo);
    else if (b.dataset.btn === 'Agachar' && yo?.vivo) yo.agachado = !yo.agachado;
  }));
  app.querySelector('[data-btn="E"]').addEventListener('pointerup', () => (tactilE = false));

  function usarObjeto() {
    if (fase !== 'partida' || !yo?.vivo) return;
    const resultado = yo.usar();
    if (resultado === 'granada') { const g = { de: yoId(), x: yo.x, y: yo.y, vx: Math.cos(yo.ang) * 110, vy: Math.sin(yo.ang) * 110, t: 0 }; granadas.push(g); red.actual?.todos({ k: 'granada', g, n: Math.random() }); }
    else if (!resultado && OBJETOS[yo.arma.tipo] && !yo.usando) aviso(OBJETOS[yo.arma.tipo].vida ? 'Ya tenés la vida al máximo para esto' : 'Tu escudo ya está al máximo para esto');
  }
  function colocarPieza() {
    if (!yo?.vivo || fase !== 'partida' || yo.altura > 0 || yo.enColectivo) return;
    const punto = vista.apuntar(mouse.x, mouse.y);
    const pieza = { id: 'pieza-' + yoId() + '-' + Date.now(), ...alinearPieza(punto.x, punto.y), tipo: tipoPieza, material: materialPieza, rotacion: rotacionPieza };
    if ((yo.materiales?.[materialPieza] || 0) < COSTO_PIEZA) { aviso(`Te falta ${materialPieza}: juntá con el pico (C)`, true); return; }
    if (!validarPieza(mundo, mundo.construcciones || [], pieza, yo.materiales || {})) { aviso('No podés construir ahí', true); return; }
    sala.enviar({ t: 'construir', pieza }).then((r) => { if (r?.error) aviso(r.error, true); else red.actual?.todos({ k: 'pieza', pieza, n: Math.random() }); });
  }
  function golpearFuente(ahora) {
    if (!yo?.vivo || yo.altura > 0 || ahora - ultimoGolpe < 550) return;
    const dx = Math.cos(yo.ang), dy = Math.sin(yo.ang);
    const pieza = (mundo.construcciones || []).find((p) => p.vida > 0 && Math.hypot(p.x - yo.x, p.y - yo.y) < 42 && (p.x - yo.x) * dx + (p.y - yo.y) * dy > 0);
    if (pieza) { ultimoGolpe = ahora; vista.golpe(pieza.x, pieza.y); sala.enviar({ t: 'danarPieza', id: pieza.id, dano: 50 }); return; }
    const o = mundo.obstaculos.find((o) => !o.roto && Math.hypot(o.x - yo.x, o.y - yo.y) < o.r + 27 && (o.x - yo.x) * dx + (o.y - yo.y) * dy > 0);
    let id = o?.id, x = o?.x, y = o?.y;
    if (!id) {
      const tx = Math.floor((yo.x + dx * 23) / 16), ty = Math.floor((yo.y + dy * 23) / 16);
      if (tx >= 0 && tx < TAM && ty >= 0 && ty < TAM && mundo.t[ty * TAM + tx] === 4) { id = 'm' + (ty * TAM + tx); x = (tx + 0.5) * 16; y = (ty + 0.5) * 16; }
    }
    if (!id) return;
    ultimoGolpe = ahora;
    vista.golpe(x, y, o?.material === 'madera' ? '#e0b47a' : '#d6dbd8');
    sala.enviar({ t: 'picar', id }).then((r) => { if (!r?.error) red.actual?.todos({ k: 'pico', id, n: Math.random() }); });
  }
  $('[data-slots]').addEventListener('click', (e) => { const pz = e.target.closest('[data-pieza]'); if (pz) { tipoPieza = pz.dataset.pieza; return; } const mt = e.target.closest('[data-material]'); if (mt) { materialPieza = mt.dataset.material; return; } if (e.target.closest('[data-pico]')) { picoActivo = !picoActivo; modoConstruccion = false; return; } const b = e.target.closest('[data-slot]'); if (b) { yo?.cambiar(+b.dataset.slot); picoActivo = false; if (OBJETOS[yo?.arma.tipo]) usarObjeto(); } });
  // Mochila (Tab): tocás un casillero y después otro (o lo arrastrás) y cambian de lugar; dos toques en el mismo lo equipa.
  let invArrastre = -1;
  const moverCasillero = (a, b) => {
    if (!yo || a === b || a < 0 || b < 0) return;
    [yo.slots[a], yo.slots[b]] = [yo.slots[b], yo.slots[a]];
    if (yo.actual === a) yo.actual = b; else if (yo.actual === b) yo.actual = a; // lo que tenías en la mano sigue en la mano
    if (yo.usando) yo.usando = null;
    slotNuevo = { i: b, hasta: performance.now() + 500 };
  };
  const panelInv = $('[data-inventario-panel]');
  panelInv.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar-inv]')) { inventarioAbierto = false; invElegido = -1; capturar(); } });
  panelInv.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-inv-slot]'); invArrastre = b ? Number(b.dataset.invSlot) : -1; });
  panelInv.addEventListener('pointerup', (e) => {
    const b = e.target.closest('[data-inv-slot]'), i = b ? Number(b.dataset.invSlot) : -1, desde = invArrastre;
    invArrastre = -1;
    if (i < 0 || !yo) return;
    if (desde >= 0 && desde !== i) { moverCasillero(desde, i); invElegido = -1; return; } // arrastrado
    if (invElegido < 0) { invElegido = i; return; }
    if (invElegido === i) { yo.cambiar(i); picoActivo = false; invElegido = -1; return; } // dos toques: equipar
    moverCasillero(invElegido, i); invElegido = -1;
  });
  const mirando = () => (fase === 'partida' || fase === 'fin') && (!yo || !yo.vivo);

  // ---------------------------------------------------------------- HUD
  const cache = {};
  const poner = (sel, valor, prop = 'innerHTML') => { if (cache[sel + prop] === valor) return; cache[sel + prop] = valor; const el = $(sel); if (el) el[prop] = valor; };
  const ver = (sel, si) => { const k = sel + '?'; if (cache[k] === si) return; cache[k] = si; $(sel)?.classList.toggle('hidden', !si); };
  const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  function pintarHud(t, z, ms, colectivo) {
    const enPartida = fase === 'partida' || fase === 'cuenta';
    const vivo = !!yo?.vivo && enPartida;
    ver('[data-hud-mapa]', enPartida);
    ver('[data-salud]', vivo);
    ver('[data-inv]', vivo && !yo.enColectivo);
    ver('[data-inventario-panel]', !!yo && enPartida && inventarioAbierto);
    // tormenta e info
    if (z) poner('[data-zona-t]', z.falta > 0 ? mmss(z.falta) : '—');
    poner('[data-vivos-n]', String(est.vivos?.length || 0));
    poner('[data-kills-n]', String(est.kills?.[yoId()] || 0));
    const foco = yo?.vivo ? yo : null;
    if (foco) { const l = lugarEn(foco.x, foco.y); poner('[data-lugar-n]', l ? esc(l.corto) : 'Afuera'); poner('[data-cuadro]', cuadricula(foco.x, foco.y)); }
    const tormenta = fase === 'partida' && z && t > 3 ? (z.cerrando ? 'La tormenta se está cerrando' : z.falta < 20 && z.etapa < 5 ? `La tormenta se cierra en ${Math.ceil(z.falta)} s` : '') : '';
    const afuera = vivo && z && Math.hypot(yo.x - z.x, yo.y - z.y) > z.r;
    poner('[data-tormenta]', tormenta || afuera ? `<span class="${afuera ? 'malo' : ''}">${afuera ? '¡Estás en la tormenta! Volvé a la zona' : tormenta}</span>` : '');
    $('[data-vineta-t]').classList.toggle('ver', !!afuera);
    if (!vivo) { ver('[data-hud-colectivo]', false); ver('[data-hud-altura]', false); ver('[data-pista]', false); ver('[data-uso]', false); ver('[data-construir]', false); return; }
    // colectivo y caída
    ver('[data-hud-colectivo]', yo.enColectivo && fase === 'partida');
    if (yo.enColectivo) $('[data-recorrido]').style.width = `${Math.min(100, (t / DURACION_COLECTIVO) * 100)}%`;
    ver('[data-hud-altura]', !yo.enColectivo && yo.altura > 0);
    if (yo.altura > 0) { poner('[data-altura-n]', String(Math.round(yo.altura * 4)) + ' m'); $('[data-altura-i]').style.height = `${(yo.altura / ALTURA_SALTO) * 100}%`; poner('[data-altura-txt]', yo.paracaidas ? 'Planeador abierto' : 'Caída libre · <kbd>Espacio</kbd> abrir'); }
    // salud
    $('[data-vida]').style.width = `${(yo.vida / VIDA) * 100}%`;
    $('[data-escudo]').style.width = `${(yo.escudo / ESCUDO_MAX) * 100}%`;
    poner('[data-vida-n]', String(Math.ceil(yo.vida)));
    poner('[data-escudo-n]', String(Math.ceil(yo.escudo)));
    $('[data-vineta]').classList.toggle('baja', yo.vida < 30);
    // inventario: el pico aparte y los cinco casilleros con el color de la rareza
    const d = ARMAS[yo.arma.tipo];
    const slots = `<button data-pico class="ranura pico ${picoActivo ? 'on' : ''}"><i>${ICONOS.pico}</i><small>C</small></button>` + yo.slots.map((s, i) => {
      const r = s ? RAREZAS[s.rareza || OBJETOS[s.tipo]?.rareza || 'comun'] : null;
      const datos = s && (OBJETOS[s.tipo] || ARMAS[s.tipo]);
      const pie = !s ? '' : OBJETOS[s.tipo] ? `×${s.cantidad}` : `${s.bala}`;
      return `<button data-slot="${i}" class="ranura ${s ? 'r-' + (s.rareza || OBJETOS[s.tipo]?.rareza || 'comun') : 'vacia'} ${i === yo.actual && !picoActivo && !modoConstruccion ? 'on' : ''} ${i === slotNuevo.i && performance.now() < slotNuevo.hasta ? 'nuevo' : ''}" style="--r:${r?.color || '#55605a'}" title="${esc(datos?.nombre || 'Libre')}"><small>${i + 1}</small>${s ? `<i>${imagenItem(s.tipo)}</i><span>${pie}</span>` : ''}</button>`;
    }).join('');
    // en modo construcción, el inventario se cambia por las piezas y los materiales (con cuánto tenés de cada uno)
    const mats = yo.materiales || {};
    const obra = `<button class="ranura obra ${tipoPieza === 'pared' ? 'on' : ''}" data-pieza="pared"><i>${ICONOS.pared}</i><small>F</small><span>Pared</span></button><button class="ranura obra ${tipoPieza === 'escalera' ? 'on' : ''}" data-pieza="escalera"><i>${ICONOS.escalera}</i><small>F</small><span>Escalera</span></button><span class="ranura-sep"></span>` +
      ['madera', 'piedra', 'metal'].map((k, i) => `<button class="ranura mat m-${k} ${materialPieza === k ? 'on' : ''} ${(mats[k] || 0) < COSTO_PIEZA ? 'falta' : ''}" data-material="${k}"><i>${ICONOS[k]}</i><small>${i + 1}</small><span>${mats[k] || 0}</span></button>`).join('');
    poner('[data-slots]', modoConstruccion ? obra : slots);
    if (inventarioAbierto) poner('[data-inventario-panel]', `<div class="bs-inv-caja"><header><div><small>Battle Shmitz · mochila</small><h2>Tu inventario</h2></div><button data-cerrar-inv aria-label="Cerrar inventario">×</button></header><div class="bs-inv-grid">${yo.slots.map((s, i) => `<button data-inv-slot="${i}" class="bs-inv-item ${i === yo.actual ? 'activo' : ''} ${i === invElegido ? 'mover' : ''}" style="--r:${RAREZAS[s?.rareza || OBJETOS[s?.tipo]?.rareza || 'comun'].color}"><small>CASILLERO ${i + 1}</small><i>${s ? imagenItem(s.tipo) : ''}</i><b>${esc(s ? nombreItem(s.tipo) : 'Libre')}</b><span>${s ? OBJETOS[s.tipo] ? `×${s.cantidad}` : `${s.bala} balas · ${RAREZAS[s.rareza || 'comun'].nombre}` : '—'}</span></button>`).join('')}</div><footer><div><b>Materiales</b>${['madera','piedra','metal'].map(k => `<span>${ICONOS[k]} ${yo.materiales?.[k] || 0}</span>`).join('')}</div><div><b>Munición</b>${Object.entries(yo.municion).map(([k,n]) => `<span>${esc(k)} ${n}</span>`).join('')}</div></footer><p>${invElegido >= 0 ? '<b>Ahora tocá el casillero donde lo querés poner</b> (o el mismo para equiparlo)' : 'Tocá un casillero y después otro para cambiarlos de lugar, o arrastralo'} · <kbd>1–5</kbd> equipar · <kbd>F</kbd> usar · <kbd>Tab</kbd> cerrar</p></div>`);
    const nombreArma = picoActivo ? 'Pico' : modoConstruccion ? `Construir ${tipoPieza}` : d ? `${d.nombre}` : OBJETOS[yo.arma.tipo]?.nombre || 'Mano vacía';
    poner('[data-arma-n]', `${esc(nombreArma)}${d && !picoActivo && !modoConstruccion ? ` <em style="color:${RAREZAS[yo.arma.rareza || 'comun'].color}">${RAREZAS[yo.arma.rareza || 'comun'].nombre}</em>` : ''}`);
    poner('[data-arma-balas]', d && !picoActivo && !modoConstruccion ? (yo.recargando > 0 ? '<b class="recarga">Recargando…</b>' : `<b>${yo.arma.bala}</b><small>${yo.municion[d.municion] || 0}</small>`) : OBJETOS[yo.arma.tipo] ? `<b>×${yo.arma.cantidad}</b><small>F usar</small>` : '');
    const m = yo.materiales || {};
    for (const k of ['madera', 'piedra', 'metal']) { poner(`[data-mat-n="${k}"]`, String(m[k] || 0)); $(`[data-mat="${k}"]`).classList.toggle('on', modoConstruccion && materialPieza === k); }
    poner('[data-municion]', Object.entries(yo.municion).filter(([, n]) => n > 0).map(([k, n]) => `<span><i class="m-${k}"></i>${n}</span>`).join(''));
    // curar o escudarse
    const u = yo.usando;
    ver('[data-uso]', !!u);
    if (u) { const k = 1 - u.restante / u.total; $('[data-uso-arco]').style.strokeDashoffset = String(119.4 * (1 - k)); poner('[data-uso-t]', Math.max(0, u.restante).toFixed(1)); poner('[data-uso-n]', OBJETOS[u.tipo].nombre); $('[data-uso]').classList.toggle('escudo', !!OBJETOS[u.tipo].escudo); }
    // construcción
    ver('[data-construir]', modoConstruccion);
    if (modoConstruccion) poner('[data-construir]', `<p><b>Modo construcción</b> · cada pieza cuesta ${COSTO_PIEZA} de ${materialPieza} (tenés ${mats[materialPieza] || 0})</p><p><kbd>F</kbd> pieza <kbd>R</kbd> rotar <kbd>1-3</kbd> material <kbd>Clic</kbd> poner <kbd>Q</kbd> salir</p>`);
    poner('[data-teclas]', modoConstruccion ? '' : picoActivo ? '<kbd>Clic</kbd> picar árboles, rocas, autos y paredes' : '<kbd>Q</kbd> construir <kbd>C</kbd> pico <kbd>R</kbd> recargar <kbd>X</kbd> soltar');
  }

  // Tarjeta del objeto (como en el piso de Fortnite): nombre, rareza y la tecla
  function tarjeta(b, x, y, dpr, cerca) {
    const r = RAREZAS[b.rareza || 'comun'] || RAREZAS.comun;
    const color = ARMAS[b.tipo] ? r.color : b.tipo === 'cofre' ? '#ffc84a' : '#e9ecef';
    const nombre = nombreItem(b.tipo);
    const sub = ARMAS[b.tipo] ? r.nombre : OBJETOS[b.tipo] ? `×${b.item?.cantidad || OBJETOS[b.tipo].cantidad}` : CAJAS[b.tipo] ? `+${CAJAS[b.tipo].cantidad}` : MATERIALES[b.tipo] ? '+30' : '';
    ctx.font = `700 ${10 * dpr}px Barlow, sans-serif`;
    const anchoSub = sub ? ctx.measureText(sub).width + 12 * dpr : 0;
    ctx.font = `800 ${14 * dpr}px "Barlow Condensed", sans-serif`;
    const w = Math.max(ctx.measureText(nombre.toUpperCase()).width + anchoSub + 26 * dpr, (cerca ? 150 : 100) * dpr), h = (cerca ? 46 : 26) * dpr;
    const x0 = x - w / 2;
    let y0 = y - h;
    // que no se pisen las tarjetas
    for (let k = 0; k < 6 && tarjeta.puestas.some((r) => x0 < r[0] + r[2] && x0 + w > r[0] && y0 < r[1] + r[3] && y0 + h > r[1]); k++) y0 -= h + 4 * dpr;
    tarjeta.puestas.push([x0, y0, w, h]);
    ctx.fillStyle = 'rgba(16,18,20,.86)';
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 6 * dpr); ctx.fill();
    const grad = ctx.createLinearGradient(x0, y0, x0 + w, y0);
    grad.addColorStop(0, color); grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad; ctx.globalAlpha = 0.35; ctx.fillRect(x0, y0, w, 3 * dpr); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.fillRect(x0, y0 + 3 * dpr, 3 * dpr, h - 6 * dpr);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(nombre.toUpperCase(), x0 + 10 * dpr, y0 + 13 * dpr);
    ctx.font = `700 ${10 * dpr}px Barlow, sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'right';
    ctx.fillText(sub, x0 + w - 8 * dpr, y0 + 13 * dpr);
    if (cerca) {
      const auto = CAJAS[b.tipo] || MATERIALES[b.tipo];
      ctx.textAlign = 'left'; ctx.font = `800 ${11 * dpr}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#c5f04a'; ctx.beginPath(); ctx.roundRect(x0 + 10 * dpr, y0 + 26 * dpr, 16 * dpr, 15 * dpr, 3 * dpr); ctx.fill();
      ctx.fillStyle = '#141413'; ctx.fillText('E', x0 + 14 * dpr, y0 + 34 * dpr);
      ctx.fillStyle = '#e8ece4'; ctx.font = `700 ${11 * dpr}px Barlow, sans-serif`;
      const lleno = ARMAS[b.tipo] || OBJETOS[b.tipo] ? yo?.slots.every(Boolean) : false;
      ctx.fillText(b.tipo === 'cofre' ? 'Tocá E para abrir' : auto ? 'Pasá por encima' : lleno ? `Cambiar por ${nombreItem(yo.arma.tipo) || 'lo que tenés'}` : 'Agarrar', x0 + 32 * dpr, y0 + 34 * dpr);
    }
  }

  // Agarrar con E: entra al inventario al toque (con animación); el servidor confirma atrás y si otro lo agarró antes, se devuelve.
  // Agarrar al instante (optimista). Si el servidor dice que no, se deshace SOLO este objeto:
  // antes se restauraba una foto vieja de todo el inventario y se perdía lo que hubieras agarrado en el medio.
  function agarrarYa(b, intento = 0) {
    const item = { ...b.item, id: b.id, rareza: b.rareza };
    const copia = { slots: yo.slots.map((s) => (s ? { ...s } : null)), actual: yo.actual };
    const plan = recoger({ slots: copia.slots.map((s) => (s ? { ...s } : null)), actual: yo.actual }, b.tipo, ARMAS, item);
    if (!plan) { aviso('Elegí un casillero con algo para cambiarlo', true); return; }
    const cambio = plan.soltado ? { id: 'drop-' + yoId() + '-' + Date.now(), tipo: plan.soltado.tipo, rareza: plan.soltado.rareza || 'comun', item: plan.soltado, x: b.x, y: b.y } : null;
    yo.recoger(b.tipo, item);
    // qué casilleros cambiaron (para poder deshacer solo eso)
    const tocados = yo.slots.map((s, i) => ({ i, antes: copia.slots[i], despues: s ? { ...s } : null })).filter((x) => JSON.stringify(x.antes) !== JSON.stringify(x.despues));
    tomados.add(b.id);
    vista.agarrar(b.id, yo);
    const i = yo.slots.findIndex((s) => s?.id === b.id || (s?.tipo === b.tipo && OBJETOS[b.tipo]));
    if (ARMAS[b.tipo] && i >= 0) yo.cambiar(i);
    slotNuevo = { i, hasta: performance.now() + 700 };
    if (cambio) { mundo.botin.push(cambio); vista.agregarBotin(cambio); red.actual?.todos({ k: 'drop', b: cambio, n: Math.random() }); }
    red.actual?.todos({ k: 'agarre', id: b.id, n: Math.random() });
    const mandar = (n) => sala.enviar({ t: 'agarrar', id: b.id, cambio }).then((r) => {
      if (r && !r.error) return; // listo
      if (!r && n < 3) return setTimeout(() => mandar(n + 1), 500); // no llegó la respuesta: se reintenta
      if (r?.error && est?.propietarios?.[b.id] === yoId()) return; // un reintento que ya había entrado
      // no se pudo: se deshace solo lo de este objeto
      for (const t of tocados) {
        const s = yo.slots[t.i];
        if (OBJETOS[b.tipo] && s?.tipo === b.tipo && t.antes?.tipo === b.tipo) { s.cantidad -= t.despues.cantidad - t.antes.cantidad; if (s.cantidad <= 0) yo.slots[t.i] = null; } // se había apilado
        else if (s && (s.id === b.id || JSON.stringify(s) === JSON.stringify(t.despues))) yo.slots[t.i] = t.antes ? { ...t.antes } : null;
      }
      tomados.delete(b.id); vista.soltarAgarrado(b.id);
      if (cambio) { mundo.botin = mundo.botin.filter((x) => x.id !== cambio.id); vista.quitarBotin(cambio.id); }
      aviso('Alguien lo agarró antes', true);
    });
    mandar(0);
  }


  // ---------------------------------------------------------------- bucle
  window.__royale = { get yo() { return yo; }, get estado() { return est; }, get remotos() { return remotos; }, get bots() { return botsSim; }, get balas() { return balas; }, get mundo() { return mundo; }, get vista() { return vista; } };
  let raf;
  let ultimo = performance.now();
  let envio = 0;
  let zonaAcum = 0;
  let zonaBots = 0;
  let ultimaCuenta = null;
  let miniT = 0;
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dtReal = Math.min(1, (ms - ultimo) / 1000);
    const dt = Math.min(0.05, dtReal) * (performance.now() < lentoHasta ? 0.28 : 1);
    ultimo = ms;
    if (!est || !mundo) return;
    const enJuego = fase === 'partida' || fase === 'cuenta' || fase === 'fin';
    const t = enJuego ? (sala.ahora() - est.inicio) / 1000 : ms / 1000;
    const colectivo = fase === 'partida' && t < DURACION_COLECTIVO + 1 ? posicionColectivo(est.semilla, t) : fase === 'cuenta' ? posicionColectivo(est.semilla, 0) : null;
    const vivosIds = new Set(est.vivos || []);

    // cuenta regresiva
    const txt = fase === 'cuenta' ? String(Math.max(1, Math.ceil(-t))) : fase === 'partida' && t < 1 ? '¡Al colectivo!' : '';
    if (txt !== ultimaCuenta) { ultimaCuenta = txt; $('[data-cuenta]').innerHTML = txt ? `<span>${txt}</span>` : ''; }

    // en la cuenta regresiva ya estamos todos arriba del colectivo
    if (fase === 'cuenta') { const pos = posicionColectivo(est.semilla, 0); if (yo) { yo.x = pos.x; yo.y = pos.y; yo.enColectivo = true; } for (const b of botsSim.values()) { b.p.x = pos.x; b.p.y = pos.y; } }
    // yo
    const puedoJugar = yo?.vivo && fase === 'partida' && t >= 0 && !document.querySelector('.cl-esc') && !document.activeElement?.matches('input,textarea') && !rueda.abierta && !mapa.abierto;
    if (yo) {
      yo.tiempo(dt);
      if (!puedoJugar && fase === 'partida' && t >= 0) {
        if (yo.enColectivo) { const pos = posicionColectivo(est.semilla, t); yo.x = pos.x; yo.y = pos.y; if (saltoAutomatico(t) && yo.saltar(pos.x, pos.y)) red.actual?.todos({ k: 'salto', de: yoId(), x: yo.x, y: yo.y, n: Math.random() }); }
        else if (yo.altura > 0) yo.caer(dtReal);
      }
      if (puedoJugar) {
        const ix = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) + joys.mov.x;
        const iy = (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) - (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) + joys.mov.y;
        if (yo.enColectivo) {
          const pos = posicionColectivo(est.semilla, t);
          yo.x = pos.x; yo.y = pos.y;
          if (pedirSalto || saltoAutomatico(t)) {
            yo.saltar(pos.x, pos.y);
            red.actual?.todos({ k: 'salto', de: yoId(), x: yo.x, y: yo.y, n: Math.random() });
          }
        } else if (yo.altura > 0) {
          if (yo.caer(dtReal, ix, iy, pedirSalto)) { const l = lugarEn(yo.x, yo.y); if (l) anunciarLugar(l); ultimoLugar = l?.id || null; }
        } else if (pedirSalto && yo.brincar()) {
          // saltito en el lugar (el movimiento de este cuadro se retoma en el próximo)
        } else if (vista.modoCamara === 'tercera') {
          // en tercera persona, adelante es para donde mira la cámara
          const yaw = vista.yaw || 0;
          yo.mover(mundo, ix * Math.cos(yaw) + iy * Math.sin(yaw), -ix * Math.sin(yaw) + iy * Math.cos(yaw), dt);
        } else yo.mover(mundo, ix, iy, dt);
        // apuntar: con el mouse (o el joystick derecho)
        if (yo.altura <= 0 && !yo.enColectivo) {
          if (Math.hypot(joys.tiro.x, joys.tiro.y) > 0.2) yo.ang = Math.atan2(joys.tiro.y, joys.tiro.x);
          else { const a = vista.apuntar(mouse.x, mouse.y); yo.ang = Math.atan2(a.y - yo.y, a.x - yo.x); }
        }
        // un clic rápido (apretar y soltar entre dos cuadros, o mientras el arma se enfría) igual dispara
        const clicPendiente = mouse.clic && performance.now() - mouse.clic < 450;
        const disparo = mouse.abajo || clicPendiente || Math.hypot(joys.tiro.x, joys.tiro.y) > 0.65;
        if (pedirColocar && modoConstruccion) colocarPieza();
        pedirColocar = false;
        if (disparo && picoActivo) golpearFuente(ms);
        // un gesto dura lo suyo; moverse o tirar lo corta
        if (yo.gesto) { yo.gestoT -= dt; if (yo.gestoT <= 0 || yo.mueve || disparo) yo.gesto = null; }
        if (disparo && OBJETOS[yo.arma.tipo] && !modoConstruccion && !picoActivo) { if (!mouse.usado) usarObjeto(); mouse.usado = true; } else if (!disparo) mouse.usado = false;
        if (disparo && !modoConstruccion && !picoActivo) {
          const nuevas = yo.disparar();
          if (nuevas.length) {
            mouse.clic = 0; // ese clic ya disparó
            balas.push(...nuevas);
            red.actual?.todos({ k: 'tiro', de: yoId(), x: Math.round(nuevas[0].x), y: Math.round(nuevas[0].y), a: +yo.ang.toFixed(3), arma: yo.arma.tipo, rareza: yo.arma.rareza, s: Math.random() });
          }
        }
        // Balas y materiales no ocupan casilleros: se juntan al pasar (al instante; si el servidor dice que no, se devuelve).
        if (yo.altura <= 0) for (const b of mundo.botin) {
          if (tomados.has(b.id) || (b.cofre !== undefined && (!abiertos.has(b.cofre) || cofresPorConfirmar.has(b.cofre))) || (!CAJAS[b.tipo] && !MATERIALES[b.tipo]) || Math.hypot(b.x - yo.x, b.y - yo.y) > 15) continue;
          tomados.add(b.id); vista.agarrar(b.id, yo);
          const c = CAJAS[b.tipo];
          if (c) yo.municion[c.municion] = Math.min(999, (yo.municion[c.municion] || 0) + c.cantidad);
          else { yo.materiales ??= {}; yo.materiales[b.tipo] = Math.min(500, (yo.materiales[b.tipo] || 0) + 30); }
          aviso('+ ' + (c ? `${c.cantidad} ${c.nombre.toLowerCase()}` : `30 de ${MATERIALES[b.tipo].nombre.toLowerCase()}`));
          red.actual?.todos({ k: 'agarre', id: b.id, n: Math.random() });
          sala.enviar({ t: 'agarrar', id: b.id }).then((r) => { if (r?.error) { tomados.delete(b.id); if (c) yo.municion[c.municion] = Math.max(0, yo.municion[c.municion] - c.cantidad); } });
        }
        const cercaCofre = mundo.botin.find((b) => b.tipo === 'cofre' && !abiertos.has(b.id) && Math.hypot(b.x - yo.x, b.y - yo.y) < 22);
        // Cofres: tocás E una vez y arranca la barra; al llenarse se abre solo (mantengas E o no).
        // Si te alejás, se corta. Si el servidor no contesta bien, reintenta un par de veces y no se queda trabado.
        if (cercaCofre && !cofreActual && (pedirAgarrar || teclas.has('KeyE') || tactilE)) {
          cofreActual = { id: cercaCofre.id, desde: ms, enviado: false, intentos: 0 };
          sala.enviar({ t: 'iniciarCofre', id: cercaCofre.id });
        }
        if (cofreActual) {
          const c = mundo.botin.find((b) => b.id === cofreActual.id);
          if (!c || abiertos.has(c.id) || Math.hypot(c.x - yo.x, c.y - yo.y) > 45) cofreActual = null;
          else if (ms - cofreActual.desde >= ABRIR_COFRE_MS && !cofreActual.enviado) abrirCofreYa(cofreActual);
        }
        confirmarCofres(ms);
        // Los objetos de inventario se agarran con E (el más cercano). Si estás lleno, cambia el de la mano.
        // Mantener E junta solo lo que entra sin cambiar nada; cambiar el arma de la mano pide apretar E de nuevo.
        // Lo que acabás de soltar no se vuelve a agarrar enseguida (antes iba y venía y te cambiaba el arma).
        const mantiene = (teclas.has('KeyE') || tactilE) && ms - ultimoAgarre > 200;
        if ((pedirAgarrar || mantiene) && !cercaCofre) {
          const recien = (x) => String(x.id).startsWith('drop-' + yoId() + '-') && Date.now() - Number(String(x.id).split('-').pop()) < 2500;
          const b = mundo.botin.filter((b) => !tomados.has(b.id) && b.tipo !== 'cofre' && !CAJAS[b.tipo] && !MATERIALES[b.tipo] && !recien(b) && (b.cofre === undefined || (abiertos.has(b.cofre) && !cofresPorConfirmar.has(b.cofre))) && Math.hypot(b.x - yo.x, b.y - yo.y) < 30).sort((a, c) => Math.hypot(a.x - yo.x, a.y - yo.y) - Math.hypot(c.x - yo.x, c.y - yo.y))[0];
          let vale = !!b;
          if (b && !pedirAgarrar) {
            const prueba = { slots: yo.slots.map((x) => (x ? { ...x } : null)), actual: yo.actual };
            const plan = recoger(prueba, b.tipo, ARMAS, { ...b.item, id: b.id, rareza: b.rareza });
            vale = !!plan && !plan.soltado; // manteniendo, nunca suelta lo que tenés
          }
          if (vale) { agarrarYa(b); ultimoAgarre = ms; }
        }
      }
      if (yo.vivo && fase === 'partida' && t >= 0) {
        // La zona sigue activa aunque el menú esté abierto.
        zonaAcum += dt;
        if (zonaAcum >= 1) { zonaAcum = 0; const d = danoZona(est.semilla, t, yo.x, yo.y); if (d) recibirDano(d, 'zona'); }
      }
      pedirAgarrar = false;
      pedirSalto = false;
      if (yo.vivo === false && !reportado && fase === 'partida') morir(muertePor || 'zona');
      // si el aviso de mi muerte se perdió, se manda de nuevo (si no, la partida no termina nunca)
      if (yo.vivo === false && reportado && fase === 'partida' && vivosIds.has(yoId()) && ms - (reenvio.yo || 0) > 2500) { reenvio.yo = ms; sala.enviar({ t: 'muerte', victima: yoId(), por: muertePor || 'zona' }); }
    }

    // bots: el anfitrión los mueve; el resto los ve por la red
    const anfitrion = soyAnfitrion() && (fase === 'partida' || fase === 'cuenta');
    const listaBots = [];
    for (const [id, b] of botsSim) {
      if (!vivosIds.has(id) && fase !== 'cuenta') b.p.vivo = false;
      if (anfitrion) {
        const v = botsVistos.get(id);
        if (v && !b.tomado) { Object.assign(b.p, { x: v.meta.x, y: v.meta.y, vida: v.meta.vida, escudo: v.meta.escudo }); b.tomado = true; }
      }
    }
    const blancos = [];
    if (yo?.vivo) blancos.push(yo);
    for (const [id, r] of remotos) {
      if (!vivosIds.has(id)) continue;
      const k = Math.min(1, dt * 12);
      for (const c of ['x', 'y']) r.obj[c] += (r.meta[c] - r.obj[c]) * (Math.abs(r.meta[c] - r.obj[c]) > 80 ? 1 : k);
      Object.assign(r.obj, { ang: r.meta.ang, vida: r.meta.vida, escudo: r.meta.escudo, arma: r.meta.arma, rareza: r.meta.rareza, mueve: r.meta.mueve, gesto: r.meta.gesto, usando: r.meta.usando, altura: r.meta.altura, enColectivo: r.meta.enColectivo, paracaidas: r.meta.paracaidas, agachado: r.meta.agachado, brinco: r.meta.brinco || 0, vivo: r.meta.vivo && vivosIds.has(id), id });
      if (r.obj.vivo) blancos.push(r.obj);
    }
    if (anfitrion) {
      for (const b of botsSim.values()) if (b.p.vivo) blancos.push(b.p);
      const libres = mundo.botin.filter((x) => !tomados.has(x.id) && x.tipo !== 'cofre' && (x.cofre === undefined || abiertos.has(x.cofre)));
      for (const b of botsSim.values()) {
        if (!b.p.vivo || t < 0) continue;
        if (b.p.enColectivo) {
          const pos = posicionColectivo(est.semilla, t);
          b.p.x = pos.x; b.p.y = pos.y;
          if (t >= b.salto || saltoAutomatico(t)) { b.p.saltar(pos.x, pos.y); red.actual?.todos({ k: 'salto', de: b.p.id, x: pos.x, y: pos.y, n: Math.random() }); }
          continue;
        }
        if (b.p.altura > 0) {
          const { x, y } = b.destino;
          b.p.caer(dtReal, x - b.p.x, y - b.p.y, Math.hypot(x - b.p.x, y - b.p.y) < 120);
          continue;
        }
        const sal = b.cerebro.paso(dt, mundo, est.semilla, t, blancos, libres);
        for (const bala of sal.balas) {
          balas.push(bala);
          red.actual?.todos({ k: 'tiro', de: b.p.id, x: Math.round(bala.x), y: Math.round(bala.y), a: +b.p.ang.toFixed(3), arma: b.p.arma.tipo, rareza: b.p.arma.rareza, s: Math.random() });
        }
        if (!b.p.usando && (b.p.materiales?.madera || 0) < 40 && (!b.ultimoPico || ms - b.ultimoPico > 1100)) {
          const fuente = mundo.obstaculos.find((o) => !o.roto && o.material === 'madera' && Math.hypot(o.x - b.p.x, o.y - b.p.y) < 27);
          if (fuente) { b.ultimoPico = ms; sala.enviar({ t: 'picar', bot: b.p.id, id: fuente.id }); }
        }
        if (sal.agarra && !tomados.has(sal.agarra.id)) {
          const it = sal.agarra;
          if (CAJAS[it.tipo] || MATERIALES[it.tipo]) {
            tomados.add(it.id);
            sala.enviar({ t: 'agarrar', id: it.id, bot: b.p.id }).then((r) => { if (r?.error) tomados.delete(it.id); else if (CAJAS[it.tipo]) { const c = CAJAS[it.tipo]; b.p.municion[c.municion] = (b.p.municion[c.municion] || 0) + c.cantidad; } });
            continue;
          }
          const item = { ...it.item, id: it.id, rareza: it.rareza };
          const prueba = { slots: b.p.slots.map((s) => (s ? { ...s } : null)), actual: b.p.actual };
          const plan = recoger(prueba, it.tipo, ARMAS, item);
          if (!plan) continue;
          const cambio = plan.soltado ? { id: 'drop-' + b.p.id + '-' + Date.now(), tipo: plan.soltado.tipo, rareza: plan.soltado.rareza || 'comun', item: plan.soltado, x: it.x, y: it.y } : null;
          tomados.add(it.id);
          sala.enviar({ t: 'agarrar', id: it.id, bot: b.p.id, cambio }).then((r) => { if (r?.error) { tomados.delete(it.id); return; } b.p.recoger(it.tipo, item); if (ARMAS[it.tipo]) { const i = b.p.slots.findIndex((s) => s?.id === it.id); if (i >= 0) b.p.cambiar(i); } if (cambio) { mundo.botin.push(cambio); vista.agregarBotin(cambio); } });
          red.actual?.todos({ k: 'agarre', id: it.id, n: Math.random() });
        }
      }
      // la zona también lastima a los bots
      zonaBots += dt;
      if (zonaBots >= 1) for (const b of botsSim.values()) { if (!b.p.vivo) continue; const d = danoZona(est.semilla, t, b.p.x, b.p.y); if (d) danarBot(b, d, 'zona'); }
      if (zonaBots >= 1) zonaBots = 0;
      // bots que murieron acá pero el servidor los sigue contando vivos (se perdió el aviso): se avisa de nuevo
      for (const [id, b] of botsSim) {
        if (b.p.vivo || !vivosIds.has(id) || ms - (reenvio[id] || 0) < 2500) continue;
        reenvio[id] = ms; sala.enviar({ t: 'muerte', victima: id, por: b.muertoPor || 'zona' });
      }
      for (const b of botsSim.values()) if (b.p.vivo) listaBots.push(b.p);
    } else {
      for (const [id, r] of botsVistos) {
        const k = Math.min(1, dt * 12);
        for (const c of ['x', 'y']) r.obj[c] += (r.meta[c] - r.obj[c]) * (Math.abs(r.meta[c] - r.obj[c]) > 80 ? 1 : k);
        Object.assign(r.obj, { ang: r.meta.ang, vida: r.meta.vida, escudo: r.meta.escudo, arma: r.meta.arma, rareza: r.meta.rareza, mueve: r.meta.mueve, gesto: r.meta.gesto, usando: r.meta.usando, altura: r.meta.altura, enColectivo: r.meta.enColectivo, paracaidas: r.meta.paracaidas, agachado: r.meta.agachado, brinco: r.meta.brinco || 0, vivo: r.meta.vivo && vivosIds.has(id), id });
        if (r.obj.vivo) { listaBots.push(r.obj); blancos.push(r.obj); }
      }
      if (!botsVistos.size) for (const b of botsSim.values()) if (vivosIds.has(b.p.id)) listaBots.push(b.p);
    }

    // balas: las mías (y las de mis bots si soy anfitrión) lastiman; las de los demás solo se ven
    for (const b of balas) {
      const propia = !b.visual && (b.de === yoId() || (anfitrion && String(b.de).startsWith('bot')));
      const tocado = avanzarBala(mundo, b, dt, propia ? blancos.filter((x) => !(x.altura > 0) && !x.enColectivo) : []);
      if (tocado && propia) impacto(b, tocado);
      if (!b.viva && b.tipo === 'rpg' && !b.exploto) {
        b.exploto = true; vista.explosion(b.x, b.y);
        if (propia) {
          for (const p of blancos) { const d = danoArea(b.dano, 40, Math.hypot(p.x - b.x, p.y - b.y)); if (d > 0) impacto({ ...b, dano: d }, p); }
          for (const p of mundo.construcciones || []) if (p.vida > 0 && Math.hypot(p.x - b.x, p.y - b.y) < 55) sala.enviar({ t: 'danarPieza', id: p.id, dano: 200 });
        }
      } else if (!b.viva && !tocado && propia) {
        const pieza = (mundo.construcciones || []).find((p) => p.vida > 0 && p.tipo === 'pared' && Math.abs(p.x - b.x) < 20 && Math.abs(p.y - b.y) < 20);
        if (pieza) sala.enviar({ t: 'danarPieza', id: pieza.id, dano: b.dano });
        else {
          // le pegó a un árbol, una roca, un auto o una caja: se va rompiendo
          const o = mundo.obstaculos.find((o) => !o.roto && o.vida < 5000 && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 4);
          if (o && performance.now() - (tiroFuente.get(o.id) || 0) > 90) { tiroFuente.set(o.id, performance.now()); vista.golpe(o.x, o.y, o.tipo === 'arbol' ? '#6aa84f' : '#d6dbd8'); sala.enviar({ t: 'dispararFuente', id: o.id, dano: b.dano }); }
        }
      }
    }
    balas = balas.filter((b) => b.viva);
    for (const gr of granadas) {
      gr.t += dt;
      if (gr.t < 0.8) { const nx = gr.x + gr.vx * dt, ny = gr.y + gr.vy * dt; const tapado = mundo.t[Math.floor(ny / 16) * TAM + Math.floor(nx / 16)] === 4; if (tapado) { gr.vx *= -0.5; gr.vy *= -0.5; } else { gr.x = nx; gr.y = ny; } }
      if (gr.t >= 1.65 && !gr.exploto) { gr.exploto = true; vista.explosion(gr.x, gr.y); if (!gr.visual) for (const p of blancos) { const d = Math.hypot(p.x - gr.x, p.y - gr.y); if (d < 58) impacto({ de: gr.de, dano: Math.round(85 * (1 - d / 70)) }, p); } }
    }
    granadas = granadas.filter((gr) => gr.t < 1.7);

    // mandar mi estado (y los bots) ~12 veces por segundo
    envio += dt;
    if (envio > 1 / 12 && enJuego && yo) {
      envio = 0;
      try { const resumir = (p) => ({ x: p.x, y: p.y, vida: p.vida, escudo: p.escudo, slots: p.slots, actual: p.actual, vivo: p.vivo, altura: p.altura, enColectivo: p.enColectivo, paracaidas: p.paracaidas, municion: p.municion, usando: p.usando }); sessionStorage.setItem(guardadoClave, JSON.stringify({ semilla: est.semilla, id: yoId(), yo: resumir(yo), bots: [...botsSim].map(([id, b]) => [id, resumir(b.p)]) })); } catch {}
      let s = codificarP(yo);
      if (anfitrion) s += '#' + [...botsSim.values()].map((b) => `${b.p.id}:${codificarP(b.p)}`).join(';');
      red.actual?.enviar(s);
    } else if (envio > 1 / 12 && enJuego && anfitrion) {
      envio = 0;
      red.actual?.enviar('#' + [...botsSim.values()].map((b) => `${b.p.id}:${codificarP(b.p)}`).join(';'));
    }

    // el que ganó: baila, la cámara se acerca y hay fuegos artificiales
    let campeon = null;
    if (fase === 'fin' && est.ganador) {
      const g = est.ganador === yoId() ? yo : [...blancos, ...listaBots].find((x) => x.id === est.ganador);
      if (g) {
        campeon = g;
        const tFin = (performance.now() - finDesde) / 1000;
        g.gesto = tFin % 9 < 3.6 ? 'festeja' : 'baila'; g.gestoT = 99;
        g.ang = Math.PI / 2;
        fuegoT -= dtReal;
        if (fuegoT <= 0 && tFin > 1.2) { // un anillo de fuegos que gira alrededor del campeón; al principio, una ráfaga
          fuegoT = tFin < 5 ? 0.14 : 0.3 + Math.random() * 0.3;
          const a = tFin * 2.1 + Math.random(), rad = 55 + Math.random() * 70;
          vista.fuego(g.x + Math.cos(a) * rad, g.y + Math.sin(a) * rad * 0.7);
        }
      }
      vista.acercar = 0.65;
      vista.campeon = !!campeon;
    } else { vista.acercar = 1; vista.campeon = false; }
    // ---------------------------------------------------------------- dibujo
    let foco = yo && (yo.vivo || fase !== 'partida') ? yo : null;
    const esp = $('[data-espectar]');
    if (mirando()) {
      const candidatos = [...blancos.filter((x) => x.id !== yoId()), ...listaBots.filter((x) => !blancos.includes(x))];
      const killer = candidatos.find((c) => c.id === muertePor);
      const lista = killer ? [killer, ...candidatos.filter((c) => c !== killer)] : candidatos;
      if (lista.length) { foco = lista[((espectando % lista.length) + lista.length) % lista.length]; esp.querySelector('[data-esp-n]').textContent = nombreDe(foco.id); }
      esp.classList.toggle('hidden', !lista.length || fase === 'fin');
    } else esp.classList.add('hidden');
    if (fase === 'fin' && campeon) foco = { ...campeon, enColectivo: false, altura: 0 };
    if (fase === 'lobby' || !foco) {
      // en la sala: el colectivo pasea sobre la isla
      const k = ((ms / 1000) % 30) / 30, r = recorridoColectivo(est.semillaSala || 5);
      const c = { x: r.inicio.x + (r.fin.x - r.inicio.x) * k, y: r.inicio.y + (r.fin.y - r.inicio.y) * k, angulo: r.angulo };
      foco = { x: c.x, y: c.y, enColectivo: true };
      if (fase === 'lobby') vista.dibujar({ mundo, gente: [], balas: [], tomados, abiertos, foco, W, H, dt, ms, zona: null, colectivo: c });
    }
    const gente = [];
    if (yo?.vivo) gente.push({ ...yo, id: yoId(), look: lookDe(yoId()), yo: true, arma: yo.arma.tipo, rareza: yo.arma.rareza });
    for (const [id, r] of remotos) if (r.obj.vivo) gente.push({ ...r.obj, look: lookDe(id) });
    for (const p of listaBots) gente.push({ ...p, look: lookDe(p.id), arma: typeof p.arma === 'string' ? p.arma : p.arma?.tipo, rareza: typeof p.arma === 'string' ? p.rareza : p.arma?.rareza });
    if (fase === 'fin' && est.ganador) {
      const ganador = gente.find((p) => p.id === est.ganador);
      if (ganador) Object.assign(ganador, { enColectivo: false, altura: 0, paracaidas: false, gesto: 'festeja', ang: Math.PI / 2 });
    }
    const z = fase === 'partida' || fase === 'fin' ? zona(est.semilla, Math.max(0, t)) : null;
    const apuntando = mira && yo?.arma.tipo === 'francotirador' && !modoConstruccion && !picoActivo;
    if (fase !== 'lobby') vista.dibujar({ mundo, gente, balas, tomados, abiertos, foco, W: apuntando ? W * 1.45 : W, H: apuntando ? H * 1.45 : H, dt, ms, zona: z, granadas, colectivo, marca });
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const ahora = performance.now(), dpr = Math.min(2, devicePixelRatio);
    if (fase !== 'lobby') {
      // Sin nametags ni barras de vida ajenas: como en un battle royale de verdad, al otro hay que verlo.
      // Solo queda el globo de lo que dice alguien que tenés cerca.
      ctx.textAlign = 'center';
      for (const p of gente) {
        if (!p.vivo || p.enColectivo) continue;
        if (foco && Math.hypot(p.x - foco.x, p.y - foco.y) > 230) continue;
        const pos = vista.proyectar(p.x, p.y, (p.altura || 0) + (p.brinco || 0) + 27), sx = pos.x * overlay.width, sy = pos.y * overlay.height;
        const gl = globos.get(p.id);
        if (gl && gl.hasta > ahora) {
          ctx.font = '600 ' + 12 * dpr + 'px Barlow, sans-serif';
          const tw = Math.min(240 * dpr, ctx.measureText(gl.texto).width + 16 * dpr);
          ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(sx - tw / 2, sy - 34 * dpr, tw, 22 * dpr, 8 * dpr); ctx.fill();
          ctx.fillStyle = '#141413'; ctx.fillText(gl.texto, sx, sy - 19 * dpr, 230 * dpr);
        }
      }
      // botín cercano: tarjetas (la más cercana con la tecla)
      if (foco && !yo?.enColectivo && !(yo?.altura > 0)) {
        let elegido = null, dMin = 22;
        const cerca = [];
        for (const b of mundo.botin) {
          if (b.tipo === 'cofre' ? abiertos.has(b.id) : tomados.has(b.id) || (b.cofre !== undefined && !abiertos.has(b.cofre))) continue;
          const d = Math.hypot(b.x - foco.x, b.y - foco.y);
          if (d > 70) continue;
          cerca.push([b, d]);
          if (yo?.vivo && d < dMin && (b.tipo === 'cofre' || !CAJAS[b.tipo] && !MATERIALES[b.tipo] || d < 30)) { dMin = d; elegido = b; }
        }
        // lo que está adentro de otro edificio (con techo) no se ve
        const adentro = (b) => { const k = vista.casaDe?.[Math.floor(b.y / 16) * TAM + Math.floor(b.x / 16)] ?? -1; return k >= 0 && mundo.casas[k].tipo === 'casa' && k !== vista.cortada; };
        tarjeta.puestas = [];
        cerca.sort((a, c) => (a[0] === elegido ? -1 : c[0] === elegido ? 1 : a[1] - c[1]));
        for (const [b] of cerca.slice(0, 6)) { if (adentro(b)) continue; const p = vista.proyectar(b.x, b.y, 15); tarjeta(b, p.x * overlay.width, p.y * overlay.height, dpr, b === elegido); }
        if (elegido?.tipo === 'cofre' && cofreActual?.id === elegido.id) {
          const p = vista.proyectar(elegido.x, elegido.y, 15), k = Math.min(1, (ms - cofreActual.desde) / ABRIR_COFRE_MS);
          ctx.strokeStyle = '#ffc84a'; ctx.lineWidth = 4 * dpr; ctx.beginPath(); ctx.arc(p.x * overlay.width, p.y * overlay.height - 70 * dpr, 13 * dpr, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
        }
      }
      // números de daño (azules si pegaron en el escudo)
      for (let i = numeros.length - 1; i >= 0; i--) {
        const n = numeros[i];
        if (n.hasta < ahora) { numeros.splice(i, 1); continue; }
        const k = 1 - (n.hasta - ahora) / 800;
        const p = vista.proyectar(n.x, n.y, 30 + k * 16);
        ctx.font = `900 ${(20 - k * 4) * dpr}px "Barlow Condensed", sans-serif`; ctx.lineWidth = 4 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.7)';
        ctx.fillStyle = n.malo ? '#ff7b6e' : n.escudo ? '#7ec8ff' : '#ffffff';
        ctx.globalAlpha = Math.min(1, 2.2 - k * 2); ctx.strokeText(n.texto, p.x * overlay.width, p.y * overlay.height); ctx.fillText(n.texto, p.x * overlay.width, p.y * overlay.height); ctx.globalAlpha = 1;
      }
      // mira donde está el mouse (y el marcador de golpe)
      if (yo?.vivo && fase === 'partida' && !yo.enColectivo && !(yo.altura > 0)) {
        const mx = mouse.x * overlay.width, my = mouse.y * overlay.height;
        const abierta = 6 * dpr + (ARMAS[yo.arma.tipo]?.dispersion || 0) * 70 * dpr * (yo.mueve ? 1.6 : 1);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.shadowColor = '#000'; ctx.shadowBlur = 3 * dpr;
        ctx.beginPath();
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(mx + ax * abierta, my + ay * abierta); ctx.lineTo(mx + ax * (abierta + 7 * dpr), my + ay * (abierta + 7 * dpr)); }
        ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(mx - dpr, my - dpr, 2 * dpr, 2 * dpr);
        if (ahora - golpeT < 160) { ctx.strokeStyle = '#ff5b4a'; ctx.lineWidth = 2.5 * dpr; ctx.beginPath(); for (const [ax, ay] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.moveTo(mx + ax * 5 * dpr, my + ay * 5 * dpr); ctx.lineTo(mx + ax * 11 * dpr, my + ay * 11 * dpr); } ctx.stroke(); }
        ctx.shadowBlur = 0;
        if (apuntando) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(mx, my, 60 * dpr, 0, Math.PI * 2); ctx.moveTo(mx - 80 * dpr, my); ctx.lineTo(mx + 80 * dpr, my); ctx.moveTo(mx, my - 80 * dpr); ctx.lineTo(mx, my + 80 * dpr); ctx.stroke(); }
        if (modoConstruccion) {
          const punto = vista.apuntar(mouse.x, mouse.y), p = alinearPieza(punto.x, punto.y);
          const ok = validarPieza(mundo, mundo.construcciones || [], { ...p, tipo: tipoPieza, material: materialPieza, rotacion: rotacionPieza }, yo.materiales || {});
          const esquinas = tipoPieza === 'pared' ? (rotacionPieza % 2 ? [[-2, -16], [2, -16], [2, 16], [-2, 16]] : [[-16, -2], [16, -2], [16, 2], [-16, 2]]) : [[-15, -15], [15, -15], [15, 15], [-15, 15]];
          ctx.fillStyle = ok ? 'rgba(110,190,255,.35)' : 'rgba(255,90,80,.35)'; ctx.strokeStyle = ok ? '#8fd0ff' : '#ff6b5b'; ctx.lineWidth = 2 * dpr;
          ctx.beginPath(); esquinas.forEach(([ex, ey], i) => { const s = vista.proyectar(p.x + ex, p.y + ey, tipoPieza === 'pared' ? 10 : 2); i ? ctx.lineTo(s.x * overlay.width, s.y * overlay.height) : ctx.moveTo(s.x * overlay.width, s.y * overlay.height); }); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
    }
    $('[data-isla]').classList.toggle('apuntando', !!(yo?.vivo && fase === 'partida'));
    $('[data-tactil]').classList.toggle('ver', tactil && !!yo?.vivo && fase === 'partida');
    // anuncio al entrar a un lugar caminando
    if (yo?.vivo && !yo.enColectivo && yo.altura === 0 && fase === 'partida') {
      const lugar = lugarEn(yo.x, yo.y);
      if ((lugar?.id || null) !== ultimoLugar) { ultimoLugar = lugar?.id || null; if (lugar) anunciarLugar(lugar); }
    }
    // pista de la acción (abajo, al centro)
    const cercaCofre = yo?.vivo && mundo.botin.find((b) => b.tipo === 'cofre' && !abiertos.has(b.id) && Math.hypot(b.x - yo.x, b.y - yo.y) < 22);
    const pista = !yo?.vivo || fase !== 'partida' ? '' : yo.enColectivo ? '' : yo.altura > 0 ? (yo.paracaidas ? 'Dirigí el planeador con <kbd>W A S D</kbd>' : '<kbd>Espacio</kbd> abrí el planeador') : cercaCofre ? (cofreActual ? 'Abriendo el cofre…' : `<kbd>E</kbd> Pulsá para abrir el cofre`) : '';
    poner('[data-pista]', pista); ver('[data-pista]', !!pista);
    pintarHud(t, z, ms, colectivo);
    // minimapa y mapa grande
    miniT -= dt;
    if (miniT <= 0 && imagen && (fase === 'partida' || fase === 'cuenta' || fase === 'fin')) {
      miniT = 0.1;
      const recorrido = colectivo && (yo?.enColectivo || !yo || fase === 'cuenta') ? { ...recorridoColectivo(est.semilla), ahora: colectivo } : null;
      const centro = foco || { x: LADO / 2, y: LADO / 2 };
      const g = $('[data-mini]').getContext('2d');
      dibujarIsla(g, imagen, { w: 360, h: 360, cx: centro.x, cy: centro.y, escala: yo?.enColectivo || yo?.altura > 0 ? 0.32 : 0.62, zona: z, recorrido, marca, yo: yo?.vivo ? yo : foco, nombres: true, tamTexto: 1.5 });
      mapa.dibujar(imagen, { zona: z, recorrido: recorrido || (yo?.enColectivo ? { ...recorridoColectivo(est.semilla), ahora: colectivo } : null), marca, yo: yo?.vivo ? yo : null });
      poner('[data-mapa-info]', z ? `<span><i>${ICONOS.tormenta}</i>${z.falta > 0 ? mmss(z.falta) : '—'}</span><span><i>${ICONOS.gente}</i>${est.vivos?.length || 0}</span>${marca ? `<span><i>${ICONOS.marca}</i>${Math.round(Math.hypot(marca.x - centro.x, marca.y - centro.y) / 4)} m</span>` : ''}` : '');
    }
  }
  raf = requestAnimationFrame(cuadro);
}

ruteo();
