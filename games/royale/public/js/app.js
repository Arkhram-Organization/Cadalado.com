import { Isla3D } from './escena3d.js';
import { OBJETOS, recoger } from './inventario.js';
import { Sala, marco, api, pid, esc, toast, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { POR_ID } from '/comun/npcs.js';
import { avatarSvg, lookDeId, lookDeJugador } from '/comun/avatar.js';
import { Red } from '/comun/red.js';
import { GESTOS } from '/comun/gestos.js';
import { ruedaGestos } from '/comun/rueda-gestos.js';
import { generarMapa, zona, ARMAS, RAREZAS, CAJAS, MATERIALES, danoArea, VIDA, ESCUDO_MAX, LADO, TAM, LUGARES, lugarEn, rng } from './mundo.js';
import { spritesPersona, spritesBotin, pintarMapa, copa, miniMapa, SP_W, SP_H } from './sprites.js';
import { Peleador, CerebroBot, avanzarBala, nuevaBala, danoZona, CODIGO_ARMA, ARMA_DE_CODIGO } from './juego.js';
import { DURACION_COLECTIVO, posicionColectivo, saltoAutomatico, tiempoParaLugar } from './colectivo.js';
import { alinearPieza, validarPieza } from './construccion.js';

const app = document.querySelector('#app');
const COLOR = '#ff6b5b';
const AV = ['#ff4fa3', '#7aa2ff', '#ffd166', '#9be15d', '#c084fc', '#4fd1c5', '#ff7a45', '#f4f1ea'];
const colorDe = (id) => AV[parseInt(String(id).slice(0, 6), 36) % AV.length];
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
  document.body.classList.remove('en-isla');
  const m = location.pathname.match(/^\/royale\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else menu();
}

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Battle Shmitz · cadalado';
  app.innerHTML = `
  <div class="menu">
    <div class="menu-hero"><div><span class="etq">Battle royale 3D · vista desde arriba · hasta 24</span><h1>Battle <em>Shmitz.</em></h1>
      <p>Saltá del colectivo, elegí dónde caer y explorá ocho lugares. Juntá armas, materiales y botín, construí refugios y quedate dentro de la zona. Tenés cinco casilleros y un pico aparte.</p></div></div>
    <section class="panel">
      <h2>Armar una partida</h2>
      <form data-crear style="display:grid;gap:12px">
        ${cuenta ? '' : `<label><span class="etq">Tu nombre</span><input class="entrada" name="nombre" maxlength="20" required value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?"></label>`}
        <label><span class="etq">Bots (los personajes de cadalado)</span><select class="entrada" name="bots">${[0, 3, 5, 7, 9, 11, 15].map((n) => `<option ${n === 9 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="publica" checked style="accent-color:${COLOR};width:18px;height:18px"> Pública (cualquiera puede entrar)</label>
        <button class="btn btn-lima btn-grande">Crear partida</button>
      </form>
    </section>
    <section class="panel">
      <h2>Entrar a una partida</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Entrar</button></form>
      <h2 style="margin-top:22px">Partidas abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
      <h2 style="margin-top:22px">Cómo se juega</h2>
      <div class="teclas-menu"><span><kbd>W A S D</kbd></span><span>movete</span><span><kbd>Mouse</kbd></span><span>apuntá y dispará</span><span><kbd>Espacio</kbd></span><span>saltá del colectivo</span><span><kbd>M</kbd></span><span>abrí el mapa</span><span><kbd>E</kbd></span><span>agarrá objetos o abrí cofres</span><span><kbd>1–5</kbd></span><span>elegí casillero</span><span><kbd>C</kbd></span><span>sacá el pico</span><span><kbd>Q</kbd></span><span>construí</span><span><kbd>F</kbd> / <kbd>R</kbd></span><span>elegí pieza / rotala</span></div>
    </section>
  </div>`;
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(f.get('nombre'));
    try {
      const { code } = await api('/api/royale/crear', { pid: pid(), nombre: f.get('nombre'), opciones: { bots: Number(f.get('bots')), publica: f.get('publica') === 'on' } });
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
        ? salas.map((s) => `<a class="sala-fila" href="/royale/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR}">${s.jugadores}</span>
          <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Esperando gente' : s.fase === 'fin' ? 'Terminando' : 'Jugando ahora'} · ${s.bots} bots</small></span>
          <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay partidas abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- partida
function abrirSala(code) {
  document.title = `Battle Shmitz ${code} · cadalado`;
  document.body.classList.add('en-isla');
  app.innerHTML = `
  <div class="isla">
    <canvas data-lienzo></canvas><canvas data-overlay style="position:absolute;inset:0;pointer-events:none;width:100%;height:100%"></canvas>
    <div class="capa hud-izq"><div class="chip-hud"><span class="etq">Sala</span><b>${esc(code)}</b><button class="btn btn-chico" data-copiar>Invitar</button></div>
      <div class="chip-hud hidden" data-vivos></div></div>
    <div class="capa hud-zona hidden" data-zona></div>
    <div class="capa hud-der"><canvas class="mini" data-mini width="132" height="132" title="Tocá para abrir el mapa"></canvas><div class="chip-hud" data-materiales></div><div class="feed" data-feed></div><div class="chip-hud red-hud" data-red>● —</div></div>
    <div class="capa mapa-grande hidden" data-mapa-grande><div><b>Mapa de Battle Shmitz</b><span>Tocá M para cerrar</span></div><canvas width="600" height="600"></canvas></div>
    <div class="capa hud-abajo hidden" data-abajo>
      <div class="barras"><div class="barra escudo"><i data-escudo></i></div><div class="barra vida"><i data-vida></i><span data-vida-n></span></div></div>
      <div class="slots" data-slots></div>
    </div>
    <div class="capa aviso-centro" data-aviso></div>
    <div class="capa pista hidden" data-pista></div>
    <div class="capa cuenta" data-cuenta></div>
    <div class="capa panel-isla hidden" data-lobby></div>
    <div class="capa panel-isla fin hidden" data-fin></div>
    <div class="capa espectar hidden" data-espectar><button class="btn btn-chico" data-esp="-1">&lsaquo;</button><span>Mirando a <b data-esp-n></b></span><button class="btn btn-chico" data-esp="1">&rsaquo;</button></div>
    <div class="capa chat-mini"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat… (Enter)" autocomplete="off"></form></div>
    <div class="capa tactil" data-tactil><div class="joy izq" data-joy="mov"><i></i></div><div class="joy der" data-joy="tiro"><i></i></div><button class="btn-t" data-btn="E">AGARRAR</button><button class="btn-t b2" data-btn="Q">CONSTRUIR</button><button class="btn-t b3" data-btn="Space">SALTAR</button><button class="btn-t b4" data-btn="Pico">PICO</button></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const lienzo = $('[data-lienzo]');
  const vista = new Isla3D(lienzo);
  const cambiarCamara = (e) => { vista.modoCamara = e.detail === 'tercera' ? 'tercera' : 'superior'; };
  addEventListener('cadalado:camara', cambiarCamara);
  limpiar.push(() => removeEventListener('cadalado:camara', cambiarCamara));
  limpiar.push(()=>vista.dispose());
  // gestos tipo Fortnite: mantenés la B, movés el mouse y soltás
  const rueda = ruedaGestos({ puede: () => !!yo?.vivo, alElegir: (id) => { const g = GESTOS.find((x) => x.id === id); if (g && yo?.vivo && !yo.mueve) { yo.gesto = g.id; yo.gestoT = g.dur; } } });
  limpiar.push(() => rueda.destruir());
  const overlay = $('[data-overlay]');
  const ctx = overlay.getContext('2d');
  const bajo = document.createElement('canvas'); // el mundo se dibuja chico y se agranda (pixel art)
  const g = bajo.getContext('2d');
  let W = 400;
  const H = 225;
  let escala = 3;
  function redimensionar() {
    const w = lienzo.clientWidth || innerWidth;
    const h = lienzo.clientHeight || innerHeight;
    overlay.width = Math.round(w * Math.min(devicePixelRatio, 2));
    overlay.height = Math.round(h * Math.min(devicePixelRatio, 2));
    W = Math.max(300, Math.min(560, Math.round((H * w) / h)));
    bajo.width = W;
    bajo.height = H;
    escala = lienzo.height / H;
  }
  redimensionar();
  addEventListener('resize', redimensionar);
  limpiar.push(() => removeEventListener('resize', redimensionar));

  const ICONOS = spritesBotin();
  const sprites = new Map(); // clave look → sprites
  const spritesDe = (look) => {
    const k = JSON.stringify(look);
    if (!sprites.has(k)) sprites.set(k, spritesPersona(look));
    return sprites.get(k);
  };

  let est = null;
  let fase = null;
  let claveMundo = null;
  let mundo = null;
  let mapaPintado = null;
  let mini = null;
  let abiertos = new Set();
  let firmaConstrucciones = '';
  let firmaFuentes = '';
  let ultimoLugar = null;
  let yo = null;
  let balas = [];
  let granadas = [];
  let tomados = new Set();
  const remotos = new Map(); // id → { obj, meta, visto }
  const botsSim = new Map(); // (anfitrión) 'botN' → { p: Peleador, cerebro }
  const botsVistos = new Map(); // (los demás) 'botN' → { obj, meta }
  const globos = new Map(); // id → { texto, hasta }
  const numeros = []; // números de daño que flotan
  let espectando = 0;
  let muertePor = null;
  let reportado = false;
  const guardadoClave='cadalado-royale-'+code;
  const yoId = () => est?.yo;
  const nombreDe = (id) => (String(id).startsWith('bot') ? est?.botNombres?.[Number(String(id).slice(3))] : est?.jugadores.find((j) => j.id === id)?.nombre) || '—';
  const lookDe = (id) => (String(id).startsWith('bot') ? { ...POR_ID[est.botNpc[Number(String(id).slice(3))]]?.look } : lookDeJugador(est.jugadores.find((j) => j.id === id), id, colorDe(id)));
  // quién simula los bots: el que armó la sala si está; si no, el primero conectado
  const idAnfitrion = () => {
    if (!est) return null;
    const online = est.jugadores.filter((j) => j.online && est.participantes.includes(j.id)).map((j) => j.id);
    return online.includes(est.host) ? est.host : online.sort()[0];
  };
  const soyAnfitrion = () => !!est && idAnfitrion() === est.yo;

  // ---------------------------------------------------------------- red
  const red = { actual: null };
  const sala = new Sala('/api/royale', code, {
    intervalo: (e) => (e?.fase === 'partida' ? 1000 : 900),
    onEstado: (e) => {
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir, alMensaje: mensaje, ruta: '/api/royale', accionPlanB: 'mensaje' });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      for (const id of e.tomados) tomados.add(id);
      if(mundo) {let nuevo=false;for(const b of e.sueltos||[])if(!mundo.botin.some(x=>x.id===b.id)){mundo.botin.push(b);nuevo=true;}if(nuevo)vista.preparar(mundo);}
      if (e.fase !== fase) cambioDeFase(e.fase);
      abiertos = new Set(e.abiertos || []);
      if (mundo) {
        const firma = JSON.stringify(e.construcciones || []);
        if (firma !== firmaConstrucciones) { firmaConstrucciones = firma; mundo.construcciones = e.construcciones || []; vista.actualizarConstrucciones(mundo.construcciones); }
        const fuentes = JSON.stringify(e.fuentes || {});
        if (fuentes !== firmaFuentes) {
          firmaFuentes = fuentes;
          for (const [id, estado] of Object.entries(e.fuentes || {})) {
            if (id.startsWith('o')) { const o = mundo.obstaculos.find(o => o.id === id); if (o) o.roto = estado.vida <= 0; }
            else if (id.startsWith('m') && estado.vida <= 0) mundo.t[Number(id.slice(1))] = 3;
          }
          vista.preparar(mundo); vista.actualizarConstrucciones(mundo.construcciones || []);
        }
      }
      if (yo) yo.materiales = {...e.materiales?.[yoId()]};
      for (const [id,b] of botsSim) b.p.materiales = {...e.materiales?.[id]};
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
    },
    onError: (m) => toast(m, true),
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
  const codificarP = (p) => `${p.x | 0},${p.y | 0},${p.ang.toFixed(2)},${p.vida | 0},${p.escudo | 0},${CODIGO_ARMA[p.arma.tipo]},${p.mueve ? 1 : 0},${p.vivo ? 1 : 0},${p.gesto ? GESTOS.findIndex((g) => g.id === p.gesto) + 1 : 0},${p.altura | 0},${p.enColectivo ? 1 : 0},${p.paracaidas ? 1 : 0},${p.usando?.tipo || ''},${p.usando ? (1-p.usando.restante/p.usando.total).toFixed(2) : 0}`;
  const decodificarP = (s) => {
    const [x, y, ang, vida, escudo, arma, mueve, vivo, gesto, altura, enColectivo, paracaidas, uso, progreso] = s.split(',');
    return { x: +x, y: +y, ang: +ang, vida: +vida, escudo: +escudo, arma: ARMA_DE_CODIGO[arma] || 'pistola', mueve: mueve === '1', vivo: vivo === '1', gesto: GESTOS[(+gesto || 0) - 1]?.id || null, altura: +altura || 0, enColectivo: enColectivo === '1', paracaidas: paracaidas === '1', usando: OBJETOS[uso] ? {tipo:uso,progreso:+progreso||0} : null };
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
    if (m.k === 'tiro') {
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
      if (remoto) { remoto.obj.enColectivo = false; remoto.obj.altura = 85; remoto.obj.x = m.x; remoto.obj.y = m.y; }
    } else if (m.k === 'dano' && yo?.vivo && fase === 'partida') {
      recibirDano(m.d, m.por);
    } else if (m.k === 'danoBot' && soyAnfitrion()) {
      const b = botsSim.get(m.bot);
      if (b) danarBot(b, m.d, m.por);
    } else if (m.k === 'agarre') tomados.add(m.id);
    else if (m.k === 'granada') granadas.push({...m.g,visual:true});
    else if (m.k === 'drop' && m.b && !mundo.botin.some(b=>b.id===m.b.id)) { mundo.botin.push(m.b);vista.preparar(mundo); }
  }

  // ---------------------------------------------------------------- fases
  function prepararMundo(semilla) {
    if (claveMundo === semilla) return;
    claveMundo = semilla;
    mundo = structuredClone(generarMapa(semilla));
    firmaConstrucciones = ''; firmaFuentes = '';
    vista.preparar(mundo);
    mini = miniMapa(mundo);
  }
  function cambioDeFase(nueva) {
    fase = nueva;
    if (nueva === 'cuenta' || (nueva === 'partida' && !yo)) empezarPartida();
    if (nueva === 'lobby') {
      prepararMundo(est.semillaSala || 1);
      yo = null;
      botsSim.clear();
      botsVistos.clear();
      remotos.clear();
      balas = [];
    }
    $('[data-abajo]').classList.toggle('hidden', !(nueva === 'partida' || nueva === 'cuenta'));
    $('[data-vivos]').classList.toggle('hidden', !(nueva === 'partida' || nueva === 'cuenta' || nueva === 'fin'));
    $('[data-zona]').classList.toggle('hidden', nueva !== 'partida');
  }
  function empezarPartida() {
    prepararMundo(est.semilla);
    tomados = new Set(est.tomados);
    balas = [];
    remotos.clear();
    botsSim.clear();
    botsVistos.clear();
    reportado = false;
    muertePor = null;
    const todos = [...est.participantes, ...est.botNpc.map((_, i) => 'bot' + i)];
    const lugar = (id) => mundo.salidas[todos.indexOf(id) % mundo.salidas.length];
    if (est.participantes.includes(yoId())) {
      const s = lugar(yoId());
      yo = new Peleador(yoId(), s.x, s.y);
      yo.subirColectivo();
    } else yo = null; // entró mirando
    // los bots: cada uno con su lugar (los simula el anfitrión)
    est.botNpc.forEach((_, i) => {
      const id = 'bot' + i;
      const s = lugar(id);
      const p = new Peleador(id, s.x, s.y);
      p.subirColectivo();
      const destino = LUGARES[i % LUGARES.length];
      botsSim.set(id, { p, destino, salto: tiempoParaLugar(est.semilla, destino), cerebro: new CerebroBot(p, rng((est.semilla + i * 7919) >>> 0)) });
    });
    try {const save=JSON.parse(sessionStorage.getItem(guardadoClave)||'null');if(save?.semilla===est.semilla&&save.id===yoId()){if(yo&&save.yo)Object.assign(yo,save.yo,{vivo:est.vivos.includes(yoId())});for(const [id,data] of save.bots||[])if(botsSim.has(id))Object.assign(botsSim.get(id).p,data,{vivo:est.vivos.includes(id)});}}catch{}
    if (soyAnfitrion()) {
      // un par saluda
      est.botNpc.slice(0, 2).forEach((_, i) => setTimeout(() => sala.enviar({ t: 'botdice', bot: 'bot' + i, situacion: 'saludo' }), 1500 + i * 2500));
    }
  }

  function pintarPaneles() {
    const e = est;
    const esHost = e.host === e.yo;
    const lob = $('[data-lobby]');
    lob.classList.toggle('hidden', e.fase !== 'lobby');
    if (e.fase === 'lobby') {
      const online = e.jugadores.filter((j) => j.online);
      const firma = JSON.stringify([online.map((j) => j.id), e.bots, e.botNpc, e.host]);
      if (lob.dataset.firma !== firma) {
        lob.dataset.firma = firma;
        lob.innerHTML = `<h2>Subí al colectivo de Battle Shmitz</h2>
          <p>${esHost ? 'Cuando estén todos, ¡largá!' : `Larga ${esc(e.jugadores.find((j) => j.id === e.host)?.nombre || '')}.`} Caés con una pistola: buscá algo mejor en las casas.</p>
          <div class="gente">${online.map((j) => `<div><span class="av">${avatarSvg(lookDeJugador(j, j.id, colorDe(j.id)))}</span>${esc(j.nombre)}${j.id === e.yo ? ' (vos)' : ''}</div>`).join('')}
            ${e.botNpc.map((n, i) => `<div class="${n === 'mati' ? 'dorado' : ''}"><span class="av">${avatarSvg({ ...POR_ID[n]?.look })}</span>${esc(e.botNombres[i])}<small>bot</small></div>`).join('')}</div>
          ${esHost ? `<div class="fila-lob"><select class="entrada" data-bots>${[0, 3, 5, 7, 9, 11, 15].map((n) => `<option ${n === e.bots ? 'selected' : ''} value="${n}">${n} bots</option>`).join('')}</select><button class="btn btn-lima btn-grande" data-largar>¡A la isla!</button></div>` : ''}
          <div class="teclas-menu"><span><kbd>Espacio</kbd></span><span>saltá del colectivo</span><span><kbd>W A S D</kbd></span><span>movete y dirigí la caída</span><span><kbd>M</kbd></span><span>abrí el mapa</span><span><kbd>E</kbd></span><span>agarrá o abrí cofres</span><span><kbd>C</kbd></span><span>usá el pico</span><span><kbd>Q</kbd></span><span>construí paredes o escaleras</span></div>`;
        lob.querySelector('[data-bots]')?.addEventListener('change', (ev) => sala.enviar({ t: 'bots', n: Number(ev.target.value) }));
        lob.querySelector('[data-largar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
      }
    }
    const fin = $('[data-fin]');
    fin.classList.toggle('hidden', e.fase !== 'fin');
    if (e.fase === 'fin' && fin.dataset.partida !== String(e.partidas)) {
      fin.dataset.partida = e.partidas;
      const orden = [...(e.ganador ? [{ id: e.ganador, nombre: e.ganadorNombre, puesto: 1 }] : []), ...[...e.bajas].reverse()];
      const gane = e.ganador === e.yo;
      fin.innerHTML = `<h2>${gane ? '¡Sos el ganador de Battle Shmitz!' : e.ganadorNombre ? `Ganó ${esc(e.ganadorNombre)}` : 'Terminó'}</h2>
        <div class="tabla">${orden.map((x, i) => `<div class="${x.id === e.yo ? 'yo' : ''}"><b>${i + 1}º</b><span>${esc(x.nombre)}</span><span class="mono">${e.kills[x.id] || 0} elim.</span></div>`).join('')}</div>
        ${esHost ? '<button class="btn btn-lima btn-grande" data-otra style="width:100%;margin-top:12px">Otra partida</button>' : '<p>En unos segundos vuelven al colectivo.</p>'}`;
      fin.querySelector('[data-otra]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
    }
  }

  function agregarFeed(texto) {
    const f = $('[data-feed]');
    const d = document.createElement('div');
    d.textContent = texto;
    f.prepend(d);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 7000);
  }
  function aviso(texto, malo = false) {
    $('[data-aviso]').innerHTML = `<span class="${malo ? 'malo' : ''}">${esc(texto)}</span>`;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => ($('[data-aviso]').innerHTML = ''), 1800);
  }
  function dibujarMapa(canvas, foco, z, grande = false) {
    if (!mini) return;
    const g = canvas.getContext('2d');
    const lado = canvas.width, escalaMapa = lado / LADO;
    g.clearRect(0, 0, lado, lado);
    g.imageSmoothingEnabled = false;
    g.drawImage(mini, 0, 0, lado, lado);
    if (z) {
      g.strokeStyle = '#fff'; g.lineWidth = grande ? 3 : 1;
      g.beginPath(); g.arc(z.x * escalaMapa, z.y * escalaMapa, z.r * escalaMapa, 0, Math.PI * 2); g.stroke();
      g.setLineDash(grande ? [8, 6] : [2, 2]);
      g.beginPath(); g.arc(z.siguiente.x * escalaMapa, z.siguiente.y * escalaMapa, z.siguiente.r * escalaMapa, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${grande ? 15 : 7}px Barlow, sans-serif`;
    g.lineWidth = grande ? 4 : 2;
    g.strokeStyle = '#141413'; g.fillStyle = '#fff';
    for (const l of LUGARES) {
      const x = (l.x + l.w / 2) * 16 * escalaMapa, y = (l.y + l.h / 2) * 16 * escalaMapa;
      const texto = grande ? l.nombre : l.corto;
      g.strokeText(texto, x, y); g.fillText(texto, x, y);
    }
    if (foco) {
      g.fillStyle = '#c5f04a';
      g.beginPath(); g.arc(foco.x * escalaMapa, foco.y * escalaMapa, grande ? 6 : 2.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#141413'; g.lineWidth = grande ? 2 : 1; g.stroke();
    }
  }

  // ---------------------------------------------------------------- daño
  function recibirDano(d, por) {
    if (!yo?.vivo) return;
    numeros.push({ x: yo.x, y: yo.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 700, malo: true });
    if (yo.dano(d)) morir(por);
  }
  function morir(por) {
    if (reportado) return;
    reportado = true;
    muertePor = por;
    sala.enviar({ t: 'muerte', victima: yoId(), por });
    aviso(por === 'zona' ? 'Te agarró la zona' : `Te eliminó ${nombreDe(por)}`, true);
  }
  function danarBot(b, d, por) {
    if (!b.p.vivo) return;
    numeros.push({ x: b.p.x, y: b.p.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 700 });
    const murio = b.p.dano(d);
    if(!murio && (b.p.materiales?.madera||0)>=10 && Math.random()<.27){
      const atacante=por===yoId()?yo:remotos.get(por)?.obj;
      const ang=atacante?Math.atan2(atacante.y-b.p.y,atacante.x-b.p.x):b.p.ang;
      const punto=alinearPieza(b.p.x+Math.cos(ang)*27,b.p.y+Math.sin(ang)*27);
      const pieza={id:'pieza-'+b.p.id+'-'+Date.now(),...punto,tipo:'pared',material:'madera',rotacion:Math.abs(Math.cos(ang))>Math.abs(Math.sin(ang))?1:0};
      if(validarPieza(mundo,mundo.construcciones||[],pieza,b.p.materiales))sala.enviar({t:'construir',bot:b.p.id,pieza});
    }
    if (murio) {
      sala.enviar({ t: 'muerte', victima: b.p.id, por });
      if (Math.random() < 0.35) sala.enviar({ t: 'botdice', bot: b.p.id, situacion: 'pierde' });
      if (String(por).startsWith('bot') && Math.random() < 0.45) setTimeout(() => sala.enviar({ t: 'botdice', bot: por, situacion: 'gana' }), 700);
    } else if (b.p.vida < 35 && Math.random() < 0.08) sala.enviar({ t: 'botdice', bot: b.p.id, situacion: 'pierde' });
  }
  // Una bala tocó a alguien: el que disparó avisa (o lo aplica si es suyo).
  function impacto(bala, blanco) {
    const d = bala.dano * (String(bala.de).startsWith('bot') ? 0.65 : 1); // los bots pegan un poco menos
    if (blanco.id === yoId()) return recibirDano(d, bala.de);
    if (String(blanco.id).startsWith('bot')) {
      if (soyAnfitrion()) {
        const b = botsSim.get(blanco.id);
        if (b) danarBot(b, d, bala.de);
      } else {
        red.actual?.a(idAnfitrion(), { k: 'danoBot', bot: blanco.id, d, por: bala.de });
        numeros.push({ x: blanco.x, y: blanco.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 700 });
      }
      return;
    }
    numeros.push({ x: blanco.x, y: blanco.y - 16, texto: String(Math.round(d)), hasta: performance.now() + 700 });
    red.actual?.a(blanco.id, { k: 'dano', d, por: bala.de });
  }

  // ---------------------------------------------------------------- controles
  const teclas = new Set();
  const mouse = { x: 0, y: 0, abajo: false };
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
  let tactilE = false;
  let mira = false;
  let recogiendo = false;
  const abajo = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.code === 'Enter') {
      $('[data-chat] input').focus();
      return e.preventDefault();
    }
    if (!teclas.has(e.code)) {
      if (e.code === 'KeyR') { if (modoConstruccion) rotacionPieza = (rotacionPieza + 1) % 4; else yo?.recargar(); }
      if (e.code === 'KeyM') { const panel=$('[data-mapa-grande]');panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))dibujarMapa(panel.querySelector('canvas'),yo,est?.fase==='partida'?zona(est.semilla,Math.max(0,(sala.ahora()-est.inicio)/1000)):null,true); }
      if (e.code === 'Space') pedirSalto = true;
      if (e.code === 'KeyE') pedirAgarrar = true;
      if (e.code === 'KeyQ') { modoConstruccion = !modoConstruccion; picoActivo = false; }
      if (e.code === 'KeyC') { picoActivo = !picoActivo; modoConstruccion = false; }
      if (/^Digit[1-5]$/.test(e.code)) {
        const n = Number(e.code.slice(-1));
        if (modoConstruccion && n <= 3) materialPieza = ['madera','piedra','metal'][n - 1];
        else { yo?.cambiar(n - 1); picoActivo = false; }
      }
      if (e.code === 'KeyF') { if (modoConstruccion) tipoPieza = tipoPieza === 'pared' ? 'escalera' : 'pared'; else usarObjeto(); }
      if (e.code === 'KeyX' && yo?.slots[yo.actual]) { const it=yo.slots[yo.actual]; const id='drop-'+yoId()+'-'+Date.now(); const b={id,tipo:it.tipo,item:{...it},x:Math.max(0,Math.min(LADO,yo.x+Math.cos(yo.ang)*16)),y:Math.max(0,Math.min(LADO,yo.y+Math.sin(yo.ang)*16))};sala.enviar({t:'soltar',b}).then(r=>{if(r&&!r.error){mundo.botin.push(b);yo.slots[yo.actual]=null;yo.usando=null;red.actual?.todos({k:'drop',b,n:Math.random()});vista.preparar(mundo);}}); }
      if (mirando() && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) espectando += e.code === 'ArrowLeft' ? -1 : 1;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    teclas.add(e.code);
  };
  const arriba = (e) => teclas.delete(e.code);
  const perderFoco=()=>{teclas.clear();mouse.abajo=false;};addEventListener('blur',perderFoco);limpiar.push(()=>removeEventListener('blur',perderFoco));
  addEventListener('keydown', abajo);
  $('[data-mini]').addEventListener('click', () => {const panel=$('[data-mapa-grande]');panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))dibujarMapa(panel.querySelector('canvas'),yo,est?.fase==='partida'?zona(est.semilla,Math.max(0,(sala.ahora()-est.inicio)/1000)):null,true);});
  $('[data-mapa-grande]').addEventListener('click', () => $('[data-mapa-grande]').classList.add('hidden'));
  addEventListener('keyup', arriba);
  lienzo.addEventListener('pointermove', (e) => {
    const r = lienzo.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = (e.clientY - r.top) / r.height;
  });
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) mouse.abajo = true;
    if (e.button === 0 && modoConstruccion) pedirColocar = true;
    if (e.button === 2) mira = true;
  });
  lienzo.addEventListener('contextmenu', e => e.preventDefault());
  const soltar = () => { mouse.abajo = false; mira = false; };
  addEventListener('pointerup', soltar);
  lienzo.addEventListener('wheel', (e) => { if(modoConstruccion) materialPieza = ['madera','piedra','metal'][(['madera','piedra','metal'].indexOf(materialPieza) + (e.deltaY > 0 ? 1 : 2)) % 3]; else yo?.cambiar(); }, { passive: true });
  limpiar.push(() => {
    removeEventListener('keydown', abajo);
    removeEventListener('keyup', arriba);
    removeEventListener('pointerup', soltar);
  });
  app.querySelectorAll('[data-esp]').forEach((b) => (b.onclick = () => (espectando += Number(b.dataset.esp))));
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
  // táctil: un joystick para moverse y otro para apuntar y disparar
  const tactil = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  $('[data-tactil]').classList.toggle('ver', tactil);
  const joys = { mov: { x: 0, y: 0 }, tiro: { x: 0, y: 0 } };
  app.querySelectorAll('[data-joy]').forEach((el) => {
    const j = joys[el.dataset.joy];
    const mover = (e) => {
      const r = el.getBoundingClientRect();
      let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      let dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      const n = Math.hypot(dx, dy);
      if (n > 1) {
        dx /= n;
        dy /= n;
      }
      j.x = dx;
      j.y = dy;
      el.querySelector('i').style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      mover(e);
    });
    el.addEventListener('pointermove', (e) => el.hasPointerCapture(e.pointerId) && mover(e));
    const fin = () => {
      j.x = j.y = 0;
      el.querySelector('i').style.transform = '';
    };
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', fin);
  });
  app.querySelectorAll('[data-btn]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (b.dataset.btn === 'E') { pedirAgarrar = true; tactilE = true; }
    else if (b.dataset.btn === 'Space') pedirSalto = true;
    else if (b.dataset.btn === 'Q') { modoConstruccion = !modoConstruccion; picoActivo = false; }
    else if (b.dataset.btn === 'Pico') { picoActivo = !picoActivo; modoConstruccion = false; }
  }));
  app.querySelector('[data-btn="E"]').addEventListener('pointerup', () => tactilE = false);

  function usarObjeto() {
    if(fase!=='partida'||!yo?.vivo) return;
    const resultado=yo.usar();
    if(resultado==='granada') { const g={de:yoId(),x:yo.x,y:yo.y,vx:Math.cos(yo.ang)*110,vy:Math.sin(yo.ang)*110,t:0};granadas.push(g);red.actual?.todos({k:'granada',g,n:Math.random()}); }
    else if(!resultado && OBJETOS[yo.arma.tipo] && !yo.usando) aviso('No necesitás usar este objeto ahora');
  }
  function colocarPieza() {
    if (!yo?.vivo || fase !== 'partida' || yo.altura > 0 || yo.enColectivo) return;
    const punto = vista.apuntar(mouse.x, mouse.y);
    const pieza = { id: 'pieza-' + yoId() + '-' + Date.now(), ...alinearPieza(punto.x, punto.y), tipo: tipoPieza, material: materialPieza, rotacion: rotacionPieza };
    if (!validarPieza(mundo, mundo.construcciones || [], pieza, yo.materiales || {})) { aviso('No podés construir ahí', true); return; }
    sala.enviar({ t: 'construir', pieza }).then(r => { if (r?.error) aviso(r.error, true); else red.actual?.todos({k:'pieza',pieza,n:Math.random()}); });
  }
  function golpearFuente(ahora) {
    if (!yo?.vivo || yo.altura > 0 || ahora - ultimoGolpe < 550) return;
    const dx = Math.cos(yo.ang), dy = Math.sin(yo.ang);
    const pieza = (mundo.construcciones || []).find(p=>p.vida>0&&Math.hypot(p.x-yo.x,p.y-yo.y)<42&&(p.x-yo.x)*dx+(p.y-yo.y)*dy>0);
    if (pieza) { ultimoGolpe=ahora; sala.enviar({t:'danarPieza',id:pieza.id,dano:50}); return; }
    const o = mundo.obstaculos.find(o => !o.roto && Math.hypot(o.x - yo.x, o.y - yo.y) < o.r + 27 && (o.x - yo.x) * dx + (o.y - yo.y) * dy > 0);
    let id = o?.id;
    if (!id) {
      const x = Math.floor((yo.x + dx * 23) / 16), y = Math.floor((yo.y + dy * 23) / 16);
      if (x >= 0 && x < TAM && y >= 0 && y < TAM && mundo.t[y * TAM + x] === 4) id = 'm' + (y * TAM + x);
    }
    if (!id) return;
    ultimoGolpe = ahora;
    sala.enviar({t:'picar',id}).then(r=>{if(!r?.error) {red.actual?.todos({k:'pico',id,n:Math.random()});aviso('¡Materiales juntados!');}});
  }
  $('[data-slots]').addEventListener('click',e=>{if(e.target.closest('[data-pico]')){picoActivo=!picoActivo;modoConstruccion=false;return;}const b=e.target.closest('[data-slot]');if(b) {yo?.cambiar(+b.dataset.slot);picoActivo=false;if(OBJETOS[yo?.arma.tipo]) usarObjeto();}});
  const mirando = () => (fase === 'partida' || fase === 'fin') && (!yo || !yo.vivo);

  // ---------------------------------------------------------------- bucle
  window.__royale = { get yo() { return yo; }, get estado() { return est; }, get remotos() { return remotos; }, get bots() { return botsSim; }, get balas() { return balas; } };
  let raf;
  let ultimo = performance.now();
  let envio = 0;
  let zonaAcum = 0;
  let zonaBots = 0;
  let ultimaCuenta = null;
  let miniT = 0;
  let camX = 0;
  let camY = 0;
  function cuadro(ms) {
    raf = requestAnimationFrame(cuadro);
    const dtReal = Math.min(1, (ms - ultimo) / 1000);
    const dt = Math.min(0.05, dtReal);
    ultimo = ms;
    if (!est || !mundo) return;
    const enJuego = fase === 'partida' || fase === 'cuenta' || fase === 'fin';
    const t = enJuego ? (sala.ahora() - est.inicio) / 1000 : ms / 1000;
    const colectivo = fase === 'partida' && t < DURACION_COLECTIVO ? posicionColectivo(est.semilla, t) : null;
    const vivosIds = new Set(est.vivos || []);

    // cuenta regresiva
    const txt = fase === 'cuenta' ? String(Math.max(1, Math.ceil(-t))) : fase === 'partida' && t < 1 ? '¡YA!' : '';
    if (txt !== ultimaCuenta) {
      ultimaCuenta = txt;
      $('[data-cuenta]').innerHTML = txt ? `<span>${txt}</span>` : '';
    }

    // yo
    const puedoJugar = yo?.vivo && fase === 'partida' && t >= 0 && !document.querySelector('.cl-esc') && !document.activeElement?.matches('input,textarea') && !rueda.abierta;
    if (yo) {
      yo.tiempo(dt);
      if (!puedoJugar && fase === 'partida' && t >= 0) {
        if (yo.enColectivo) { const pos=posicionColectivo(est.semilla,t);yo.x=pos.x;yo.y=pos.y;if(saltoAutomatico(t)&&yo.saltar(pos.x,pos.y))red.actual?.todos({k:'salto',de:yoId(),x:yo.x,y:yo.y,n:Math.random()}); }
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
        } else if (yo.altura > 0) yo.caer(dtReal, ix, iy);
        else yo.mover(mundo, ix, iy, dt);
        // apuntar: con el mouse (o el joystick derecho)
        if (Math.hypot(joys.tiro.x, joys.tiro.y) > 0.2) yo.ang = Math.atan2(joys.tiro.y, joys.tiro.x);
        else {const a=vista.apuntar(mouse.x,mouse.y);yo.ang=Math.atan2(a.y-yo.y,a.x-yo.x);}
        const disparo = mouse.abajo || Math.hypot(joys.tiro.x, joys.tiro.y) > 0.65;
        if (pedirColocar && modoConstruccion) colocarPieza();
        pedirColocar = false;
        if (disparo && picoActivo) golpearFuente(ms);
        // un gesto dura lo suyo; moverse o tirar lo corta
        if (yo.gesto) { yo.gestoT -= dt; if (yo.gestoT <= 0 || yo.mueve || disparo) yo.gesto = null; }
        if (disparo && OBJETOS[yo.arma.tipo] && !modoConstruccion && !picoActivo) { if(!mouse.usado) usarObjeto();mouse.usado=true; } else if(!disparo) mouse.usado=false;
        if (disparo && !modoConstruccion && !picoActivo) {
          const nuevas = yo.disparar();
          if (nuevas.length) {
            balas.push(...nuevas);
            red.actual?.todos({ k: 'tiro', de: yoId(), x: Math.round(nuevas[0].x), y: Math.round(nuevas[0].y), a: +yo.ang.toFixed(3), arma: yo.arma.tipo, rareza: yo.arma.rareza, s: Math.random() });
          }
        }
        // Balas y materiales no ocupan casilleros: se juntan al pasar.
        if (!recogiendo) for (const b of mundo.botin) {
          if (tomados.has(b.id) || (b.cofre !== undefined && !abiertos.has(b.cofre)) || (!CAJAS[b.tipo] && !MATERIALES[b.tipo]) || Math.hypot(b.x - yo.x, b.y - yo.y) > 13) continue;
          recogiendo = true;
          sala.enviar({t:'agarrar',id:b.id}).then(r=>{if(!r?.error){tomados.add(b.id);red.actual?.todos({k:'agarre',id:b.id,n:Math.random()});if(CAJAS[b.tipo]){const c=CAJAS[b.tipo];yo.municion[c.municion]=Math.min(999,(yo.municion[c.municion]||0)+c.cantidad);}aviso((CAJAS[b.tipo]||MATERIALES[b.tipo]).nombre+' juntado');}}).finally(()=>recogiendo=false);
          break;
        }
        const cercaCofre = mundo.botin.find(b=>b.tipo==='cofre'&&!abiertos.has(b.id)&&Math.hypot(b.x-yo.x,b.y-yo.y)<20);
        if (cercaCofre && (teclas.has('KeyE') || tactilE)) {
          if (cofreActual?.id !== cercaCofre.id) { cofreActual={id:cercaCofre.id,desde:ms,abriendo:false};sala.enviar({t:'iniciarCofre',id:cercaCofre.id}); }
          if (ms-cofreActual.desde>=1000&&!cofreActual.abriendo) {cofreActual.abriendo=true;sala.enviar({t:'abrirCofre',id:cercaCofre.id}).then(r=>{if(!r?.error){abiertos.add(cercaCofre.id);aviso('¡Abriste un cofre!');}});}
        } else cofreActual = null;
        // Los objetos de inventario se agarran con E.
        if(pedirAgarrar&&!recogiendo) for (const b of mundo.botin) {
          if (tomados.has(b.id) || b.tipo==='cofre' || CAJAS[b.tipo] || MATERIALES[b.tipo] || (b.cofre !== undefined && !abiertos.has(b.cofre)) || Math.hypot(b.x-yo.x,b.y-yo.y)>18) continue;
          const item = {...b.item,id:b.id,rareza:b.rareza};
          const prueba={slots:yo.slots.map(s=>s?{...s}:null),actual:yo.actual};
          const plan=recoger(prueba,b.tipo,ARMAS,item);
          if(!plan) {aviso('No podés agarrar ese objeto');break;}
          recogiendo=true;
          const cambio=plan.soltado?{id:'drop-'+yoId()+'-'+Date.now(),tipo:plan.soltado.tipo,item:plan.soltado,x:b.x,y:b.y}:null;
          sala.enviar({t:'agarrar',id:b.id,cambio}).then(r=>{if(r&&!r.error&&r.estado?.propietarios?.[b.id]===yoId()&&yo?.vivo){yo.recoger(b.tipo,item);tomados.add(b.id);red.actual?.todos({k:'agarre',id:b.id,n:Math.random()});if(cambio){mundo.botin.push(cambio);red.actual?.todos({k:'drop',b:cambio,n:Math.random()});vista.preparar(mundo);}aviso((OBJETOS[b.tipo]||ARMAS[b.tipo]).nombre+' en tu inventario');}}).finally(()=>recogiendo=false);break;
        }
      }
      if(yo.vivo&&fase==='partida'&&t>=0) {
      // La zona sigue activa aunque el menú esté abierto.
        zonaAcum += dt;
        if (zonaAcum >= 1) {
          zonaAcum = 0;
          const d = danoZona(est.semilla, t, yo.x, yo.y);
          if (d) recibirDano(d, 'zona');
        }

      }
      pedirAgarrar = false;
      pedirSalto = false;
      if (yo.vivo === false && !reportado && fase === 'partida') morir(muertePor || 'zona');
    }

    // bots: el anfitrión los mueve; el resto los ve por la red
    const anfitrion = soyAnfitrion() && (fase === 'partida' || fase === 'cuenta');
    const listaBots = [];
    for (const [id, b] of botsSim) {
      if (!vivosIds.has(id) && fase !== 'cuenta') b.p.vivo = false;
      if (anfitrion) {
        // si antes los veía por la red, arrancan desde ahí
        const v = botsVistos.get(id);
        if (v && !b.tomado) {
          Object.assign(b.p, { x: v.meta.x, y: v.meta.y, vida: v.meta.vida, escudo: v.meta.escudo });
          b.tomado = true;
        }
      }
    }
    const blancos = [];
    if (yo?.vivo) blancos.push(yo);
    for (const [id, r] of remotos) {
      if (!vivosIds.has(id)) continue;
      const k = Math.min(1, dt * 12);
      for (const c of ['x', 'y']) r.obj[c] += (r.meta[c] - r.obj[c]) * (Math.abs(r.meta[c] - r.obj[c]) > 80 ? 1 : k);
      Object.assign(r.obj, { ang: r.meta.ang, vida: r.meta.vida, escudo: r.meta.escudo, arma: r.meta.arma, mueve: r.meta.mueve, gesto: r.meta.gesto, usando: r.meta.usando, altura:r.meta.altura, enColectivo:r.meta.enColectivo, paracaidas:r.meta.paracaidas, vivo: r.meta.vivo && vivosIds.has(id), id });
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
          if (t >= b.salto || saltoAutomatico(t)) {b.p.saltar(pos.x, pos.y);red.actual?.todos({k:'salto',de:b.p.id,x:pos.x,y:pos.y,n:Math.random()});}
          continue;
        }
        if (b.p.altura > 0) {
          const x = (b.destino.x + 1) * 16, y = (b.destino.y + 1) * 16;
          b.p.caer(dtReal, x - b.p.x, y - b.p.y);
          continue;
        }
        const sal = b.cerebro.paso(dt, mundo, est.semilla, t, blancos, libres);
        for (const bala of sal.balas) {
          balas.push(bala);
          red.actual?.todos({ k: 'tiro', de: b.p.id, x: Math.round(bala.x), y: Math.round(bala.y), a: +b.p.ang.toFixed(3), arma: b.p.arma.tipo, rareza: b.p.arma.rareza, s: Math.random() });
        }
        if (!b.p.usando && (b.p.materiales?.madera||0)<40 && (!b.ultimoPico || ms-b.ultimoPico>1100)) {
          const fuente=mundo.obstaculos.find(o=>!o.roto&&o.material==='madera'&&Math.hypot(o.x-b.p.x,o.y-b.p.y)<27);
          if(fuente){b.ultimoPico=ms;sala.enviar({t:'picar',bot:b.p.id,id:fuente.id});}
        }
        if (sal.agarra && !tomados.has(sal.agarra.id)) {
          const it = sal.agarra;
          if(CAJAS[it.tipo]||MATERIALES[it.tipo]){
            tomados.add(it.id);
            sala.enviar({t:'agarrar',id:it.id,bot:b.p.id}).then(r=>{if(r?.error)tomados.delete(it.id);else if(CAJAS[it.tipo]){const c=CAJAS[it.tipo];b.p.municion[c.municion]=(b.p.municion[c.municion]||0)+c.cantidad;}});
            continue;
          }
          const item={...it.item,id:it.id,rareza:it.rareza};
          const prueba={slots:b.p.slots.map(s=>s?{...s}:null),actual:b.p.actual};
          const plan=recoger(prueba,it.tipo,ARMAS,item);
          if(!plan)continue;
          const cambio=plan.soltado?{id:'drop-'+b.p.id+'-'+Date.now(),tipo:plan.soltado.tipo,item:plan.soltado,x:it.x,y:it.y}:null;
          tomados.add(it.id);
          sala.enviar({t:'agarrar',id:it.id,bot:b.p.id,cambio}).then(r=>{if(r?.error){tomados.delete(it.id);return;}b.p.recoger(it.tipo,item);if(ARMAS[it.tipo]){const i=b.p.slots.findIndex(s=>s?.id===it.id);if(i>=0)b.p.cambiar(i);}if(cambio){mundo.botin.push(cambio);vista.preparar(mundo);}});
          red.actual?.todos({ k: 'agarre', id: it.id, n: Math.random() });
        }
      }
      // la zona también lastima a los bots
      zonaBots += dt;
      if (zonaBots >= 1) for (const b of botsSim.values()) {
        if (!b.p.vivo) continue;
        const d = danoZona(est.semilla, t, b.p.x, b.p.y);
        if (d) danarBot(b, d, 'zona');
      }
      if (zonaBots >= 1) zonaBots = 0;
      for (const b of botsSim.values()) if (b.p.vivo) listaBots.push(b.p);
    } else {
      for (const [id, r] of botsVistos) {
        const k = Math.min(1, dt * 12);
        for (const c of ['x', 'y']) r.obj[c] += (r.meta[c] - r.obj[c]) * (Math.abs(r.meta[c] - r.obj[c]) > 80 ? 1 : k);
        Object.assign(r.obj, { ang: r.meta.ang, vida: r.meta.vida, escudo: r.meta.escudo, arma: r.meta.arma, mueve: r.meta.mueve, gesto: r.meta.gesto, usando:r.meta.usando, altura:r.meta.altura, enColectivo:r.meta.enColectivo, paracaidas:r.meta.paracaidas, vivo: r.meta.vivo && vivosIds.has(id), id });
        if (r.obj.vivo) {
          listaBots.push(r.obj);
          blancos.push(r.obj);
        }
      }
      // mientras no llega nada de la red, se ven en su lugar de salida
      if (!botsVistos.size) for (const b of botsSim.values()) if (vivosIds.has(b.p.id)) listaBots.push(b.p);
    }

    // balas: las mías (y las de mis bots si soy anfitrión) lastiman; las de los demás solo se ven
    for (const b of balas) {
      const propia = !b.visual && (b.de === yoId() || (anfitrion && String(b.de).startsWith('bot')));
      const tocado = avanzarBala(mundo, b, dt, propia ? blancos : []);
      if (tocado && propia) impacto(b, tocado);
      if (!b.viva && b.tipo === 'rpg' && !b.exploto) {
        b.exploto = true; vista.explosion(b.x,b.y);
        if (propia) {
          for (const p of blancos) { const d=danoArea(b.dano,40,Math.hypot(p.x-b.x,p.y-b.y)); if(d>0) impacto({...b,dano:d},p); }
          for (const p of mundo.construcciones || []) if(p.vida>0&&Math.hypot(p.x-b.x,p.y-b.y)<55) sala.enviar({t:'danarPieza',id:p.id,dano:200});
        }
      } else if (!b.viva && !tocado && propia) {
        const pieza = (mundo.construcciones || []).find(p=>p.vida>0&&p.tipo==='pared'&&Math.abs(p.x-b.x)<20&&Math.abs(p.y-b.y)<20);
        if(pieza) sala.enviar({t:'danarPieza',id:pieza.id,dano:b.dano});
      }
    }
    balas = balas.filter((b) => b.viva);

    for(const gr of granadas) {
      gr.t+=dt;
      if(gr.t<.8) {const nx=gr.x+gr.vx*dt,ny=gr.y+gr.vy*dt;const blocked=mundo.t[Math.floor(ny/16)*TAM+Math.floor(nx/16)]===4;if(blocked){gr.vx*=-.5;gr.vy*=-.5;}else{gr.x=nx;gr.y=ny;}}
      if(gr.t>=1.65&&!gr.exploto){gr.exploto=true;vista.explosion(gr.x,gr.y);if(!gr.visual) for(const p of blancos){const d=Math.hypot(p.x-gr.x,p.y-gr.y);if(d<58) impacto({de:gr.de,dano:Math.round(85*(1-d/70))},p);}}
    }
    granadas=granadas.filter(gr=>gr.t<1.7);

    // mandar mi estado (y los bots) ~12 veces por segundo
    envio += dt;
    if (envio > 1 / 12 && enJuego && yo) {
      envio = 0;
      try{const resumir=p=>({x:p.x,y:p.y,vida:p.vida,escudo:p.escudo,slots:p.slots,actual:p.actual,vivo:p.vivo,altura:p.altura,enColectivo:p.enColectivo,paracaidas:p.paracaidas,municion:p.municion,usando:p.usando});sessionStorage.setItem(guardadoClave,JSON.stringify({semilla:est.semilla,id:yoId(),yo:resumir(yo),bots:[...botsSim].map(([id,b])=>[id,resumir(b.p)])}));}catch{}
      let s = codificarP(yo);
      if (anfitrion) s += '#' + [...botsSim.values()].map((b) => `${b.p.id}:${codificarP(b.p)}`).join(';');
      red.actual?.enviar(s);
    } else if (envio > 1 / 12 && enJuego && anfitrion) {
      envio = 0;
      red.actual?.enviar('#' + [...botsSim.values()].map((b) => `${b.p.id}:${codificarP(b.p)}`).join(';'));
    }

    // ---------------------------------------------------------------- dibujo
    // cámara: sigo a mi personaje, o a quien esté mirando
    let foco = yo && (yo.vivo || fase !== 'partida') ? yo : null;
    const esp = $('[data-espectar]');
    if (mirando()) {
      const candidatos = [...blancos.filter((x) => x.id !== yoId()), ...listaBots.filter((x) => !blancos.includes(x))];
      const killer = candidatos.find((c) => c.id === muertePor);
      const lista = killer ? [killer, ...candidatos.filter((c) => c !== killer)] : candidatos;
      if (lista.length) {
        foco = lista[((espectando % lista.length) + lista.length) % lista.length];
        esp.querySelector('[data-esp-n]').textContent = nombreDe(foco.id);
      }
      esp.classList.toggle('hidden', !lista.length);
    } else esp.classList.add('hidden');
    if (!foco) foco = { x: LADO / 2 + Math.cos(ms / 9000) * 300, y: LADO / 2 + Math.sin(ms / 11000) * 300 };
    camX = Math.round(Math.max(0, Math.min(LADO - W, foco.x - W / 2)));
    camY = Math.round(Math.max(0, Math.min(LADO - H, foco.y - H / 2)));
    const gente = [];
    if(yo?.vivo) gente.push({...yo,id:yoId(),look:lookDe(yoId()),yo:true,arma:yo.arma.tipo});
    for(const [id,r] of remotos) if(r.obj.vivo) gente.push({...r.obj,look:lookDe(id)});
    for(const p of listaBots) gente.push({...p,look:lookDe(p.id),arma:typeof p.arma==='string'?p.arma:p.arma?.tipo});
    const z=(fase==='partida'||fase==='fin')?zona(est.semilla,Math.max(0,t)):null;
    const apuntando = mira && yo?.arma.tipo === 'francotirador' && !modoConstruccion;
    vista.dibujar({mundo,gente,balas,tomados,abiertos,foco,W:apuntando?W*1.35:W,H:apuntando?H*1.35:H,dt,ms,zona:z,granadas,colectivo});
    ctx.clearRect(0,0,overlay.width,overlay.height);
    const ahora=performance.now(),dpr=Math.min(2,devicePixelRatio);
    ctx.textAlign='center';
    for(const p of gente) {
      if(!p.vivo) continue;
      const pos=vista.proyectar(p.x,p.y,25),sx=pos.x*overlay.width,sy=pos.y*overlay.height;
      ctx.font='700 '+(12*dpr)+'px Barlow, sans-serif';ctx.lineWidth=3*dpr;ctx.strokeStyle='#24342ae0';ctx.fillStyle=p.yo?'#d7ff70':'#fff';
      ctx.strokeText(p.yo?'VOS':nombreDe(p.id),sx,sy);ctx.fillText(p.yo?'VOS':nombreDe(p.id),sx,sy);
      const gl=globos.get(p.id);if(gl&&gl.hasta>ahora){ctx.fillStyle='#fff';ctx.strokeText(gl.texto,sx,sy-20*dpr,250*dpr);ctx.fillText(gl.texto,sx,sy-20*dpr,250*dpr);}
    }
    for(let i=numeros.length-1;i>=0;i--){const n=numeros[i];if(n.hasta<ahora){numeros.splice(i,1);continue;}const p=vista.proyectar(n.x,n.y,28+(1-(n.hasta-ahora)/700)*12);ctx.font='900 '+18*dpr+'px Barlow';ctx.fillStyle=n.malo?'#ff9389':'#fff299';ctx.fillText(n.texto,p.x*overlay.width,p.y*overlay.height);}
    ctx.font=`700 ${10*dpr}px Barlow, sans-serif`;
    for(const b of mundo.botin) {
      if(tomados.has(b.id)||(b.cofre!==undefined&&!abiertos.has(b.cofre)))continue;
      if(yo?.enColectivo||Math.hypot(b.x-foco.x,b.y-foco.y)>110)continue;
      const punto=vista.proyectar(b.x,b.y,13),x=punto.x*overlay.width,y=punto.y*overlay.height;
      const nombre=OBJETOS[b.tipo]?.nombre||ARMAS[b.tipo]?.nombre||CAJAS[b.tipo]?.nombre||MATERIALES[b.tipo]?.nombre||(b.tipo==='cofre'?'Cofre':b.tipo);
      ctx.lineWidth=3*dpr;ctx.strokeStyle='#141413';ctx.fillStyle=RAREZAS[b.rareza]?.color||'#fff';
      const etiqueta=nombre+(ARMAS[b.tipo]?' · '+RAREZAS[b.rareza]?.nombre:'');
      ctx.strokeText(etiqueta,x,y);ctx.fillText(etiqueta,x,y);
      if(yo?.vivo&&Math.hypot(b.x-yo.x,b.y-yo.y)<22&&!CAJAS[b.tipo]&&!MATERIALES[b.tipo]){ctx.fillStyle='#fff';ctx.strokeText('E para agarrar',x,y+11*dpr);ctx.fillText('E para agarrar',x,y+11*dpr);}
    }
    if(yo?.vivo&&fase==='partida'){
      const ancho=overlay.width,alto=overlay.height,radio=7*dpr+(ARMAS[yo.arma.tipo]?.dispersion||0)*65*dpr;
      ctx.strokeStyle='#fff';ctx.lineWidth=2*dpr;ctx.beginPath();ctx.moveTo(ancho/2-radio-7*dpr,alto/2);ctx.lineTo(ancho/2-radio,alto/2);ctx.moveTo(ancho/2+radio,alto/2);ctx.lineTo(ancho/2+radio+7*dpr,alto/2);ctx.moveTo(ancho/2,alto/2-radio-7*dpr);ctx.lineTo(ancho/2,alto/2-radio);ctx.moveTo(ancho/2,alto/2+radio);ctx.lineTo(ancho/2,alto/2+radio+7*dpr);ctx.stroke();
      if(apuntando){ctx.beginPath();ctx.arc(ancho/2,alto/2,Math.min(ancho,alto)*.25,0,Math.PI*2);ctx.stroke();}
      if(modoConstruccion){const punto=vista.apuntar(mouse.x,mouse.y),p=alinearPieza(punto.x,punto.y),s=vista.proyectar(p.x,p.y,3);ctx.strokeStyle=validarPieza(mundo,mundo.construcciones||[],{...p,tipo:tipoPieza,material:materialPieza,rotacion:rotacionPieza},yo.materiales||{})?'#c5f04a':'#ff6b5b';ctx.strokeRect(s.x*ancho-16*dpr,s.y*alto-16*dpr,32*dpr,32*dpr);}
    }
    if(z){const afuera=yo?.vivo&&Math.hypot(yo.x-z.x,yo.y-z.y)>z.r;$('[data-zona]').textContent=(afuera?'¡Volvé a la zona! · ':'')+(z.cerrando?'La zona se está cerrando':z.falta>0?'La zona se cierra en '+Math.ceil(z.falta)+' s':'Zona final');}
    if (yo?.vivo && !yo.enColectivo && yo.altura === 0 && fase === 'partida') {
      const lugar = lugarEn(yo.x, yo.y);
      if (lugar?.id !== ultimoLugar) {
        ultimoLugar = lugar?.id || null;
        if (lugar) aviso(`Entraste a: ${lugar.nombre}`);
      }
    }
    // HUD (si morí, solo se ve lo de mirar)
    $('[data-abajo]').classList.toggle('hidden', !(yo?.vivo && (fase === 'partida' || fase === 'cuenta')));
    let cercaArma = null;
    if (yo?.vivo && fase === 'partida') for (const b of mundo.botin) if (!tomados.has(b.id) && Math.hypot(b.x - yo.x, b.y - yo.y) < 18) cercaArma = b;
    const cercaCofre=mundo.botin.find(b=>b.tipo==='cofre'&&!abiertos.has(b.id)&&yo?.vivo&&Math.hypot(b.x-yo.x,b.y-yo.y)<20);
    const pista = yo?.enColectivo ? 'Espacio · saltá del colectivo' : modoConstruccion ? `Construí ${tipoPieza} de ${materialPieza} · F pieza · R rotar · 1–3 material` : picoActivo ? 'Pico · hacé clic para juntar materiales' : cercaCofre ? `Mantené E para abrir el cofre${cofreActual?.id===cercaCofre.id?' · '+Math.min(100,Math.round((ms-cofreActual.desde)/10))+'%':''}` : cercaArma ? `E · agarrá ${(OBJETOS[cercaArma.tipo]||ARMAS[cercaArma.tipo]||CAJAS[cercaArma.tipo]||MATERIALES[cercaArma.tipo]||{nombre:'objeto'}).nombre}` : '';
    const pEl = $('[data-pista]');
    if (pEl.textContent !== pista) {
      pEl.textContent = pista;
      pEl.classList.toggle('hidden', !pista);
    }
    if (yo && (fase === 'partida' || fase === 'cuenta')) {
      $('[data-vida]').style.width = `${(yo.vida / VIDA) * 100}%`;
      $('[data-vida-n]').textContent = Math.ceil(yo.vida);
      $('[data-escudo]').style.width = `${(yo.escudo / ESCUDO_MAX) * 100}%`;
      const slots = yo.slots.map((s,i)=>{
        const d=s&&(OBJETOS[s.tipo]||ARMAS[s.tipo]);
        return '<button data-slot="'+i+'" class="slot '+(i===yo.actual?'on ':'')+(!s?'vacio':'')+'" style="--item:'+(RAREZAS[s?.rareza]?.color||d?.color||'#59605b')+'"><small>'+(i+1)+'</small><b>'+(d?.nombre||'Libre')+'</b><span>'+(s?(OBJETOS[s.tipo]?'×'+s.cantidad:(yo.recargando>0&&i===yo.actual?'Recargando':s.bala+'/'+d.cargador+' · '+(yo.municion[d.municion]||0))):'—')+'</span></button>';
      }).join('')+'<button data-pico class="slot pico-slot '+(picoActivo?'on':'')+'"><small>C</small><b>Pico</b><span>⛏</span></button><div class="uso-item">'+(yo.usando?'Usando '+OBJETOS[yo.usando.tipo].nombre+' · '+Math.max(0,yo.usando.restante).toFixed(1)+' s':'1–5 seleccionar · C pico · F usar')+'</div>';
      const sl = $('[data-slots]');
      if (sl.dataset.f !== slots) {
        sl.dataset.f = slots;
        sl.innerHTML = slots;
      }
    }
    if(yo){const m=yo.materiales||{};$('[data-materiales]').textContent=`🪵 ${m.madera||0}  🪨 ${m.piedra||0}  ⚙ ${m.metal||0}  ${picoActivo?'⛏ Pico':''}`;}
    if (enJuego) {
      const vivos = `<span class="etq">Quedan</span><b>${est.vivos.length}</b><span class="etq">Elim.</span><b>${est.kills?.[yoId()] || 0}</b>`;
      const v = $('[data-vivos]');
      if (v.dataset.f !== vivos) {
        v.dataset.f = vivos;
        v.innerHTML = vivos;
      }
    }
    miniT -= dt;
    if (miniT <= 0 && mini) {
      miniT = 0.2;
      dibujarMapa($('[data-mini]'), yo?.vivo ? yo : foco, fase === 'partida' ? z : null);
      if (!$('[data-mapa-grande]').classList.contains('hidden')) dibujarMapa($('[data-mapa-grande] canvas'), yo?.vivo ? yo : foco, z, true);
      const c = red.actual?.estadoConexiones();
      if (c) $('[data-red]').innerHTML = c.total ? `<span style="color:${c.directas === c.total ? 'var(--lima)' : '#ffd166'}">●</span> ${c.directas}/${c.total} directas` : '<span style="color:var(--gris)">●</span> solo vos';
    }
  }
  raf = requestAnimationFrame(cuadro);
}

ruteo();
