import { JUEGOS, NOVEDADES, IDEAS } from './datos.js';
import { iniciarPagina, esc, revelar, hace } from './comun.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const juego = (id) => JUEGOS.find((j) => j.id === id);

// ---------------------------------------------------------------- tarjetas de juegos
function tarjeta(j, i) {
  const disponible = j.estado === 'disponible';
  return `
  <article class="juego revela ${i < 2 ? 'juego-grande' : 'juego-chico'}" style="--color:${j.color};transition-delay:${(i % 3) * 0.08}s">
    <a class="juego-captura" href="${disponible ? j.url : '#novedades'}" aria-label="${esc(j.nombre)}: ${disponible ? 'jugar' : 'ver novedades'}">
      <img src="${j.captura}" alt="Captura de ${esc(j.nombre)}" loading="lazy">
      <span class="juego-estados">
        ${disponible ? '<span class="chip chip-lima">Disponible</span>' : '<span class="chip chip-dev">En desarrollo</span>'}
        ${j.nuevo ? '<span class="chip">Nuevo</span>' : ''}
        <span class="chip chip-vivo hidden" data-vivo-chip="${j.id}"></span>
      </span>
      ${disponible ? '<span class="btn btn-lima juego-jugar">Jugar</span>' : ''}
    </a>
    <div class="juego-cuerpo">
      <h3><i></i>${esc(j.nombre)}</h3>
      <p class="juego-linea">${esc(j.linea)}</p>
      <dl class="juego-datos">${j.datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="juego-pie">
        <span class="actividad" data-actividad="${j.id}"></span>
        ${disponible ? `<a class="btn btn-lima" href="${j.url}">Jugar ${esc(j.nombre.toLowerCase())}</a>` : '<span class="btn btn-borde" aria-disabled="true">Próximamente</span>'}
      </div>
    </div>
  </article>`;
}
$('[data-juegos]').innerHTML = JUEGOS.map(tarjeta).join('');

// ---------------------------------------------------------------- la mesa está abierta (lobby real)
const ritmo = (tc) => (tc?.initial ? `${tc.initial / 60}+${tc.increment}` : 'sin reloj');
const LECTORES = {
  ajedrez: ({ open = [], live = [] }) => ({
    abiertas: open.map((g) => ({
      titulo: g.white || g.black,
      detalle: `Ajedrez · ${ritmo(g.tc)} · juega con ${g.white ? 'blancas' : 'negras'}`,
      url: `/ajedrez/game/${g.id}`,
      accion: 'Unirse',
    })),
    vivo: live.map((g) => ({
      titulo: `${g.white} vs ${g.black}`,
      detalle: `Ajedrez · ${ritmo(g.tc)} · jugada ${Math.ceil((g.moves || 1) / 2)}`,
      url: `/ajedrez/game/${g.id}`,
      accion: 'Mirar',
    })),
  }),
  truco: ({ open = [], live = [] }) => ({
    abiertas: open.map((r) => ({
      titulo: r.players.filter(Boolean).join(', ') || 'Mesa nueva',
      detalle: `Truco ${r.mode} a ${r.target} · ${r.free === 1 ? 'falta 1' : `faltan ${r.free}`}`,
      url: `/truco/sala/${r.code}`,
      accion: 'Sentarse',
    })),
    vivo: live.map((r) => ({
      titulo: r.players.filter(Boolean).join(', '),
      detalle: `Truco ${r.mode} · ${r.score ? `${r.score[0]} a ${r.score[1]}` : 'arrancando'}`,
      url: `/truco/sala/${r.code}`,
      accion: 'Mirar',
    })),
  }),
  // los juegos con el motor de salas común (memes, casino, carrera)
  salas: ({ salas = [] }, j) => {
    const url = (s) => (j.id === 'casino' ? `/casino/mesa/${s.code}` : `/${j.id}/sala/${s.code}`);
    const item = (s) => ({
      titulo: s.titulo || s.nombre || `Sala ${s.code}`,
      detalle: `${j.nombre} · ${s.online} ${s.online === 1 ? 'conectado' : 'conectados'}`,
      url: url(s),
      accion: j.id === 'casino' ? 'Sentarse' : s.fase === 'lobby' ? 'Entrar' : 'Mirar',
    });
    const espera = (s) => j.id === 'casino' || s.fase === 'lobby' || s.fase === 'final';
    return { abiertas: salas.filter(espera).map(item), vivo: salas.filter((s) => !espera(s)).map(item) };
  },
};

function fila(item, j) {
  return `<a class="fila" href="${item.url}" style="--color:${j.color}">
    <span class="tag"></span>
    <span class="quien"><b>${esc(item.titulo)}</b><small>${esc(item.detalle)}</small></span>
    <span class="btn btn-chico ${item.accion === 'Mirar' ? '' : 'btn-lima'}">${item.accion}</span>
  </a>`;
}

let primeraVez = true;
async function cargarMesas() {
  const res = await Promise.allSettled(
    JUEGOS.filter((j) => j.lobby && j.estado === 'disponible').map(async (j) => {
      const r = await fetch(j.lobby, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      return { j, ...LECTORES[j.formato](await r.json(), j) };
    })
  );
  const ok = res.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const abiertas = ok.flatMap(({ j, abiertas }) => abiertas.map((x) => fila(x, j)));
  const vivo = ok.flatMap(({ j, vivo }) => vivo.map((x) => fila(x, j)));
  const fallo = !ok.length && res.length;

  $('[data-abiertas]').innerHTML = fallo
    ? `<div class="vacio"><b>Sin conexión con las mesas</b>Reintentamos en unos segundos.</div>`
    : abiertas.slice(0, 8).join('') ||
      `<div class="vacio"><b>Abrí la primera mesa</b>No hay nadie esperando. Creá una partida y mandá el link.
        <div class="btns">${JUEGOS.filter((j) => j.estado === 'disponible').map((j) => `<a class="btn btn-lima btn-chico" href="${j.url}">${esc(j.nombre)}</a>`).join('')}</div></div>`;
  $('[data-vivo]').innerHTML = fallo
    ? `<div class="vacio">—</div>`
    : vivo.slice(0, 8).join('') || `<div class="vacio"><b>Nadie jugando ahora</b>Cuando haya partidas, las vas a poder mirar desde acá.</div>`;
  $('[data-n-abiertas]').textContent = abiertas.length ? `(${abiertas.length})` : '';
  $('[data-n-vivo]').textContent = vivo.length ? `(${vivo.length})` : '';

  // estados en las tarjetas y en la primera pantalla
  const pulso = [];
  for (const { j, abiertas: a, vivo: v } of ok) {
    const chip = document.querySelector(`[data-vivo-chip="${j.id}"]`);
    chip?.classList.toggle('hidden', !v.length);
    if (chip) chip.textContent = `${v.length} en vivo`;
    const act = document.querySelector(`[data-actividad="${j.id}"]`);
    if (act) act.textContent = a.length ? `${a.length} ${a.length === 1 ? 'mesa espera' : 'mesas esperan'} rival` : v.length ? `${v.length} jugando ahora` : 'Mesas libres: abrí una';
    if (v.length) pulso.push(`<span class="chip chip-vivo">${v.length} de ${esc(j.nombre.toLowerCase())} en vivo</span>`);
    if (a.length) pulso.push(`<a class="chip chip-lima" href="#mesas">${a.length} ${a.length === 1 ? 'mesa' : 'mesas'} de ${esc(j.nombre.toLowerCase())} esperando</a>`);
  }
  $('[data-pulso]').innerHTML = pulso.join('') || (primeraVez ? '' : '<span class="chip">Las mesas están libres. Abrí la primera.</span>');
  primeraVez = false;
}
cargarMesas().finally(() => cargarMesas.listo = true);
setInterval(() => !document.hidden && cargarMesas(), 10000);

// ---------------------------------------------------------------- volvé a jugar (guardado en este dispositivo)
try {
  const recientes = JSON.parse(localStorage.getItem('cadalado.recientes') || '[]').filter((r) => juego(r.juego));
  if (recientes.length) {
    $('#recientes').classList.remove('hidden');
    $('[data-recientes]').innerHTML = recientes
      .map((r) => {
        const j = juego(r.juego);
        return `<a class="reciente" href="${esc(r.url)}" style="--color:${j.color}"><small>${esc(j.nombre)}</small><b>${esc(r.titulo || j.nombre)}</b><small>${hace(r.fecha)}</small></a>`;
      })
      .join('');
  }
} catch {}

// ---------------------------------------------------------------- novedades e ideas
$('[data-novedades]').innerHTML = NOVEDADES.map((n, i) => {
  const j = n.juego && juego(n.juego);
  const href = n.enlace || j?.url;
  const tag = href ? 'a' : 'div';
  return `<${tag} class="novedad revela" ${href ? `href="${href}"` : ''} style="transition-delay:${i * 0.06}s">
    <span class="chip ${n.etiqueta === 'Nuevo' ? 'chip-lima' : ''}" style="align-self:flex-start">${esc(n.etiqueta)}</span>
    <h3>${esc(n.titulo)}</h3><p>${esc(n.texto)}</p></${tag}>`;
}).join('');

$('[data-ideas]').innerHTML = IDEAS.map((idea, i) => `<div class="idea revela" style="transition-delay:${i * 0.06}s">
  <span class="chip" style="align-self:flex-start">${esc(idea.etiqueta)}</span><h3>${esc(idea.titulo)}</h3><p>${esc(idea.texto)}</p></div>`).join('');
revelar();

// ---------------------------------------------------------------- mini tablero de la primera pantalla
const INICIO = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const JUGADAS = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4', 'c3d4', 'c5b4', 'b1c3', 'f6e4', 'e1g1', 'e4c3'];
function miniTablero() {
  const el = $('[data-mini]');
  if (!el) return;
  const casillas = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const c = document.createElement('div');
    c.className = 'c' + ((x + y) % 2 ? ' o' : '');
    el.append(c);
    casillas.push(c);
  }
  let piezas = new Map();
  const pos = (sq) => ['abcdefgh'.indexOf(sq[0]), 8 - Number(sq[1])];
  const ubicar = (p, sq) => {
    const [x, y] = pos(sq);
    p.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
  };
  function armar() {
    el.querySelectorAll('.pz').forEach((p) => p.remove());
    piezas = new Map();
    INICIO.split('/').forEach((fila, i) => {
      let x = 0;
      for (const ch of fila) {
        if (/\d/.test(ch)) { x += Number(ch); continue; }
        const p = document.createElement('div');
        p.className = 'pz';
        p.style.backgroundImage = `url(/ajedrez/pieces/${ch === ch.toUpperCase() ? 'w' : 'b'}${ch.toLowerCase()}.svg)`;
        const sq = 'abcdefgh'[x] + (8 - i);
        ubicar(p, sq);
        el.append(p);
        piezas.set(sq, p);
        x++;
      }
    });
    casillas.forEach((c) => c.classList.remove('u'));
  }
  armar();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let n = 0;
  let seg = 299;
  const reloj = $('[data-mini-reloj]');
  setInterval(() => {
    seg = seg > 0 ? seg - 1 : 299;
    if (reloj) reloj.textContent = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  }, 1000);
  setInterval(() => {
    if (document.hidden) return;
    if (n >= JUGADAS.length) { n = 0; return armar(); }
    const m = JUGADAS[n++];
    const desde = m.slice(0, 2);
    const hasta = m.slice(2, 4);
    const p = piezas.get(desde);
    if (!p) return;
    piezas.get(hasta)?.classList.add('fuera');
    const capturada = piezas.get(hasta);
    if (capturada) setTimeout(() => capturada.remove(), 300);
    piezas.delete(desde);
    piezas.set(hasta, p);
    ubicar(p, hasta);
    if (m === 'e1g1') { const t = piezas.get('h1'); piezas.delete('h1'); piezas.set('f1', t); ubicar(t, 'f1'); }
    casillas.forEach((c) => c.classList.remove('u'));
    for (const sq of [desde, hasta]) { const [x, y] = pos(sq); casillas[y * 8 + x].classList.add('u'); }
  }, 1400);
}
miniTablero();
