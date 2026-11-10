import { Sala, marco, api, pid, esc, toast, sonar, recordar } from '/comun/sala.js';
import { fondoMenu } from '/comun/fondo-menu.js';
import { fondoCasino } from './salon3d.js';
import { lookDeJugador } from '/comun/avatar.js';
import { fmt, ficha, carta, SIMBOLO } from './piezas.js';
import { montarRuleta } from './ruleta.js';
import { montarBlackjack } from './blackjack.js';
import { montarSlots } from './slots.js';

const app = document.querySelector('#app');
const ORO = '#f2c94c';
const AV = ['#f2c94c', '#c5f04a', '#7aa2ff', '#ff7a45', '#ff4fa3', '#4fd1c5', '#c084fc'];
const colorDe = (id) => AV[parseInt(String(id).slice(0, 6), 36) % AV.length];
const PUBLICAS = [
  { code: 'RULETA', tipo: 'ruleta' },
  { code: 'RULETA-2', tipo: 'ruleta' },
  { code: 'RULETA-3', tipo: 'ruleta' },
  { code: 'BLACKJACK-1', tipo: 'blackjack' },
  { code: 'BLACKJACK-2', tipo: 'blackjack' },
  { code: 'BLACKJACK-3', tipo: 'blackjack' },
  { code: 'BLACKJACK-4', tipo: 'blackjack' },
  { code: 'SLOTS', tipo: 'slots' },
  { code: 'SLOTS-2', tipo: 'slots' },
];
const TIPO = {
  ruleta: { nombre: 'Ruleta', clase: '', texto: 'Europea, un solo cero. Todos apuestan en el mismo paño y la bola decide.', montar: montarRuleta },
  blackjack: { nombre: 'Blackjack', clase: 'bj', texto: 'Siete lugares contra la banca. Pedí, plantate o doblá. Blackjack paga 3 a 2.', montar: montarBlackjack },
  slots: { nombre: 'Tragamonedas', clase: 'slots', texto: 'Tres rodillos, cinco líneas y un pozo que crece con cada tirada de todo el salón.', montar: montarSlots },
};

await marco({ juego: 'El casino de Dobro', color: ORO, volver: '/casino/' });
let sala = null;
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
  sala?.cerrar();
  sala = null;
  const m = location.pathname.match(/^\/casino\/mesa\/([A-Za-z0-9-]{3,16})/);
  if (m) mesa(m[1].toUpperCase());
  else salon();
}

// ---------------------------------------------------------------- salón
const arte = {
  ruleta: `<svg viewBox="0 0 120 120" width="150"><circle cx="60" cy="60" r="56" fill="#3b2414" stroke="#d4af37" stroke-width="3"/>${Array.from({ length: 18 }, (_, i) => `<path d="M60 60L${60 + 52 * Math.sin((i * 20 * Math.PI) / 180)} ${60 - 52 * Math.cos((i * 20 * Math.PI) / 180)}A52 52 0 0 1 ${60 + 52 * Math.sin(((i + 1) * 20 * Math.PI) / 180)} ${60 - 52 * Math.cos(((i + 1) * 20 * Math.PI) / 180)}Z" fill="${i === 0 ? '#0a8f3c' : i % 2 ? '#c8102e' : '#161616'}"/>`).join('')}<circle cx="60" cy="60" r="30" fill="#5a3820" stroke="#d4af37" stroke-width="2"/><circle cx="60" cy="60" r="7" fill="#d4af37"/><circle cx="60" cy="14" r="5" fill="#fff"/></svg>`,
  blackjack: `<div style="display:flex">${carta('AP', { rot: -10 })}<div style="margin-left:-26px">${carta('KC', { rot: 8 })}</div></div>`,
  slots: `<div style="display:flex;gap:6px;background:#fff;border-radius:12px;padding:8px 10px;box-shadow:0 0 0 4px #e9b949">${['siete', 'siete', 'siete'].map((s) => `<span style="width:50px;height:50px;display:block">${SIMBOLO[s]}</span>`).join('')}</div>`,
};

async function salon() {
  document.title = 'El casino de Dobro · cadalado';
  app.innerHTML = `
  <div class="salon">
    <div class="salon-hero">
      <div><span class="etq">Fichas de mentira · emoción de verdad</span><h1>El casino <em>de Dobro.</em></h1>
      <p>Ruleta, blackjack y tragamonedas en mesas compartidas: todos apuestan al mismo tiempo, en la misma partida.</p></div>
      <div class="saldo-grande"><span class="etq">Tus fichas</span><b data-saldo>—</b><button class="btn btn-chico hidden" data-ayuda style="margin-top:8px">Pedirle a la casa</button><a class="btn btn-chico" href="/tienda" style="margin-top:8px;background:#ffd36a;color:#2a1a04">Gastalas en la tienda</a></div>
    </div>
    <div class="mesas-grid">
      ${Object.entries(TIPO).map(([tipo, t]) => {
        const mesas = PUBLICAS.filter((m) => m.tipo === tipo);
        return `<a class="mesa-card ${t.clase}" href="/casino/mesa/${mesas[0].code}" data-ir data-card="${tipo}">
          <div class="arte">${arte[tipo]}</div>
          <h2>${t.nombre}</h2><p>${t.texto}</p>
          <div class="pie"><span class="chip" data-gente="${tipo}">Mesa abierta</span><span class="btn btn-lima">Jugar</span></div>
        </a>`;
      }).join('')}
    </div>
    <h2 class="etq" style="margin:26px 0 10px;color:#fff">Todas las mesas · elegí la que tenga lugar</h2>
    <div class="mesas-chicas">${PUBLICAS.map((m) => `<a class="chip" href="/casino/mesa/${m.code}" data-ir data-mesa="${m.code}">${esc(m.code.replace('-', ' ').toLowerCase())} <b data-mesa-n="${m.code}"></b></a>`).join('')}</div>
    <div class="privada">
      <section class="panel">
        <h2 style="font-size:22px;margin-bottom:12px">Mesa privada con amigos</h2>
        <form data-crear style="display:flex;gap:8px;flex-wrap:wrap">
          <select class="entrada" name="tipo" style="flex:1;min-width:160px"><option value="ruleta">Ruleta</option><option value="blackjack">Blackjack</option><option value="slots">Tragamonedas</option></select>
          <button class="btn btn-lima">Crear mesa</button>
        </form>
        <p class="etq" style="margin-top:10px">Te damos un código para pasarle a quien quieras.</p>
      </section>
      <section class="panel">
        <h2 style="font-size:22px;margin-bottom:12px">Entrar con código</h2>
        <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Ej: K7QX2" autocapitalize="characters" required><button class="btn">Entrar</button></form>
        <p class="etq" style="margin-top:10px">Arrancás con 8.000 fichas y ganás más en cada partida de cualquier juego. Si te quedás sin nada, la casa te presta.</p>
      </section>
    </div>
  </div>`;
  limpiar.push(fondoMenu(app.querySelector('.salon'), { dibujar: fondoCasino }));
  const $ = (s) => app.querySelector(s);
  const cargarSaldo = async () => {
    try {
      const { saldo } = await api(`/api/casino/saldo?pid=${pid()}`);
      $('[data-saldo]').textContent = fmt(saldo);
      $('[data-ayuda]').classList.toggle('hidden', saldo >= 500);
    } catch {}
  };
  cargarSaldo();
  $('[data-ayuda]').onclick = async () => {
    try {
      const { saldo } = await api('/api/casino/ayuda', { pid: pid() });
      $('[data-saldo]').textContent = fmt(saldo);
      toast('La casa te prestó fichas. ¡Suerte!');
    } catch (e) {
      toast(e.message, true);
    }
  };
  $('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const tipo = new FormData(e.target).get('tipo');
    try {
      const { code } = await api('/api/casino/crear', { pid: pid(), opciones: { tipo } });
      ir(`/casino/mesa/${code}`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  $('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/casino/mesa/${c}`);
  };
  const gente = async () => {
    try {
      const { salas } = await api('/api/casino/lobby');
      const enMesa = (code) => salas.find((s) => s.code === code)?.online || 0;
      const LUGARES = { blackjack: 7 };
      for (const m of PUBLICAS) {
        const el = app.querySelector(`[data-mesa-n="${m.code}"]`);
        const n = enMesa(m.code), lleno = LUGARES[m.tipo] && n >= LUGARES[m.tipo];
        if (el) el.textContent = lleno ? '· llena' : n ? `· ${n}` : '';
      }
      for (const tipo of Object.keys(TIPO)) {
        const mesas = PUBLICAS.filter((m) => m.tipo === tipo);
        const n = mesas.reduce((a, m) => a + enMesa(m.code), 0);
        const el = app.querySelector(`[data-gente="${tipo}"]`);
        if (el) el.textContent = n ? `${n} ${n === 1 ? 'persona jugando' : 'personas jugando'}` : `${mesas.length} mesas abiertas`;
        // la tarjeta te lleva a la mesa con gente pero con lugar (o a la más vacía)
        const cap = LUGARES[tipo] || 99;
        const mejor = [...mesas].sort((a, b) => { const na = enMesa(a.code), nb = enMesa(b.code); return (na >= cap) - (nb >= cap) || nb - na; })[0];
        const card = app.querySelector(`[data-card="${tipo}"]`);
        if (card && mejor) card.href = `/casino/mesa/${mejor.code}`;
      }
    } catch {}
  };
  gente();
  const t = setInterval(gente, 6000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- mesa
function mesa(code) {
  app.innerHTML = `
  <div class="mesa">
    <div class="mesa-top">
      <a class="btn btn-chico btn-borde" href="/casino/" data-ir>← Salón</a>
      <h1 data-nombre>Mesa</h1>
      <span class="gente" data-gente></span>
      <span class="estado-mesa" data-estado>—</span>
      <span class="espacio"></span>
      <button class="btn btn-chico" data-copiar>Invitar</button>
      <span class="saldo" data-saldo>—</span>
    </div>
    <div class="mesa-cuerpo">
      <section data-zona><div class="casino-cargando" role="status"><span class="casino-cargando-ficha">D</span><b>Entrando al casino</b><small>Preparando tu lugar en la mesa…</small></div></section>
      <aside class="panel chat"><h3>Charla de la mesa</h3><div class="chat-log" data-log></div>
        <form data-chat><input class="entrada" maxlength="280" placeholder="Escribí algo…" autocomplete="off"><button class="btn btn-chico btn-lima">Enviar</button></form></aside>
    </div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  let est = null;
  let modulo = null;
  let inicializado = false;
  let saldo = null;
  let saldoMostrado = null;

  const mostrarSaldo = () => {
    if (saldo == null || saldo === saldoMostrado) return;
    const el = $('[data-saldo]');
    el.classList.remove('sube', 'baja');
    void el.offsetWidth;
    if (saldoMostrado != null) el.classList.add(saldo > saldoMostrado ? 'sube' : 'baja');
    saldoMostrado = saldo;
    el.innerHTML = `<span class="ficha ficha-mini" data-v="1000"></span> ${fmt(saldo)}`;
  };
  const helpers = {
    esc,
    sonar,
    colorDe,
    // el personaje de cada persona (el que armó en /personaje)
    lookDe: (id) => lookDeJugador(est?.jugadores.find((j) => j.id === id), id, colorDe(id)),
    mostrarSaldo,
    ahora: () => sala.ahora(),
    enviar: (msg) => sala.enviar(msg),
    nombreDe: (id) => est?.jugadores.find((j) => j.id === id)?.nombre || est?.bots?.find((b) => b.id === id)?.nombre || est?.asientos?.find((a) => a?.id === id)?.nombre || '—',
    estadoMesa: (texto, clase) => {
      const el = $('[data-estado]');
      el.textContent = texto;
      el.className = `estado-mesa ${clase || ''}`;
    },
  };

  const montarTipo = (tipo) => {
    $('[data-zona]').innerHTML = '';
    if (tipo === 'blackjack') {
      app.querySelector('.mesa').classList.add('mesa-bj');
      document.body.classList.add('casino-full');
      limpiar.push(() => document.body.classList.remove('casino-full'));
    } else limpiar.push(fondoMenu(app.querySelector('.mesa'), { dibujar: fondoCasino, etiqueta: 'Casino de Dobro' }));
    modulo = TIPO[tipo].montar($('[data-zona]'), helpers);
  };
  // Las mesas públicas tienen tipo conocido: la escena se dibuja desde el primer instante.
  if (PUBLICAS.some((m) => m.code === code && m.tipo === 'blackjack')) montarTipo('blackjack');

  $('[data-copiar]').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); } catch {}
    toast('Link de la mesa copiado');
  };
  $('[data-chat]').onsubmit = (e) => {
    e.preventDefault();
    const i = e.target.querySelector('input');
    if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value });
    i.value = '';
  };

  sala = new Sala('/api/casino', code, {
    intervalo: (e) => (e?.tipo === 'slots' ? 2500 : 900),
    onEstado: (e) => {
      est = e;
      if (!modulo) montarTipo(e.tipo);
      if (!inicializado) {
        inicializado = true;
        document.title = `${e.nombre} · El casino de Dobro`;
        recordar('casino', `/casino/mesa/${code}`, e.nombre);
      }
      $('[data-nombre]').textContent = e.nombre;
      const online = e.jugadores.filter((j) => j.online);
      $('[data-gente]').innerHTML = online.slice(0, 8).map((j) => `<span class="avatar" title="${esc(j.nombre)}" style="--av:${colorDe(j.id)}">${esc(j.nombre[0]?.toUpperCase() || '?')}</span>`).join('') + (online.length > 8 ? `<span class="chip">+${online.length - 8}</span>` : '');
      modulo.estado(e);
    },
    onExtra: (data) => {
      if (data.saldo == null) return;
      saldo = data.saldo;
      if (!modulo?.retenerSaldo?.()) mostrarSaldo();
    },
    onEvento: (ev) => {
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis';
        d.textContent = ev.texto;
      } else {
        if (ev.bot) d.className = 'bot';
        d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`;
        modulo?.dice?.(ev); // y en el globito arriba de quien habló
      }
      log.append(d);
      while (log.children.length > 80) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => {
      toast(m, true);
      if (/alcanzan/.test(m)) sonar('pierde');
    },
    onNoExiste: () => {
      toast('Esa mesa no existe.', true);
      ir('/casino/');
    },
    onConexion: (ok) => !ok && toast('Se cortó la conexión. Reintentando…', true),
  });
  const t = setInterval(() => modulo?.reloj(), 200);
  limpiar.push(() => clearInterval(t));
  limpiar.push(() => modulo?.destruir?.());
}

ruteo();
