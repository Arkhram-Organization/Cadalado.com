import { JUEGOS, EQUIPO, NOVEDADES, IDEAS } from './datos.js';
import { iniciarPagina, esc, revelar, hace, personas } from './comun.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const juego = (id) => JUEGOS.find((j) => j.id === id);
const disponibles = JUEGOS.filter((j) => j.estado === 'disponible');

// ---------------------------------------------------------------- el dado: cada lado, un juego
// Orientación del cubo para dejar cada cara mirando al frente.
const CARAS = [
  [0, 0], // frente
  [0, -90], // derecha
  [0, 180], // atrás
  [0, 90], // izquierda
  [-90, 0], // arriba
  [90, 0], // abajo
];
const lados = [...disponibles.slice(0, 5), { id: 'todos', nombre: 'Elegí vos', color: '#c5f04a', cara: '?', url: '#juegos' }];
function pintarDado() {
  const d = $('[data-dado]');
  d.innerHTML = lados
    .map((j, i) => `<div class="cara c${i}" style="--c:${j.color}"><span class="ico">${j.cara}</span><b>${esc(j.nombre)}</b><i class="pips">${'<s></s>'.repeat(i + 1)}</i></div>`)
    .join('');
}
pintarDado();
let rot = { x: -22, y: 32 };
let tirando = false;
const dado = $('[data-dado]');
const aplicar = (anim) => {
  dado.style.transition = anim ? 'transform 1.6s cubic-bezier(.15,.9,.2,1.04)' : 'none';
  dado.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
};
aplicar(false);
function tirar() {
  if (tirando) return;
  tirando = true;
  const i = Math.floor(Math.random() * lados.length);
  const [cx, cy] = CARAS[i];
  // varias vueltas y frena mostrando la cara elegida (con un toque de inclinación)
  const vueltas = (n) => Math.ceil(n / 360) * 360;
  rot = { x: vueltas(rot.x) + 720 + cx - 12, y: vueltas(rot.y) + 1080 + cy + 14 };
  aplicar(true);
  const res = $('[data-dado-res]');
  res.classList.remove('ver');
  setTimeout(() => {
    const j = lados[i];
    res.innerHTML = j.id === 'todos'
      ? `<span class="etq">Salió el ?</span><b>Elegí vos</b><a class="btn btn-lima" href="#juegos">Ver los juegos</a>`
      : `<span class="etq">Te tocó</span><b style="color:${j.color}">${esc(j.nombre)}</b><a class="btn btn-lima" href="${j.url}">Jugar ${esc(j.nombre.toLowerCase())}</a>`;
    res.classList.add('ver');
    tirando = false;
  }, 1500);
}
$('[data-tirar]').addEventListener('click', tirar);
$('[data-dado-escena]').addEventListener('click', tirar);

// ---------------------------------------------------------------- tarjetas de juegos
function tarjeta(j, i) {
  const disponible = j.estado === 'disponible';
  return `
  <article class="juego revela ${i < 2 ? 'juego-grande' : 'juego-chico'}" style="--color:${j.color};transition-delay:${(i % 3) * 0.08}s">
    <a class="juego-captura" href="${disponible ? j.url : '#ideas'}" aria-label="${esc(j.nombre)}: ${disponible ? 'jugar' : 'ver más'}">
      <img src="${j.captura}" alt="Captura de ${esc(j.nombre)}" loading="lazy">
      <span class="juego-estados">
        ${disponible ? '<span class="chip chip-lima">Disponible</span>' : '<span class="chip chip-dev">En desarrollo</span>'}
        ${j.nuevo ? '<span class="chip chip-nuevo">Nuevo</span>' : ''}
        <span class="chip chip-vivo hidden" data-vivo-chip="${j.id}"></span>
      </span>
      ${disponible ? '<span class="btn btn-lima juego-jugar">Jugar</span>' : ''}
    </a>
    <div class="juego-cuerpo">
      <h3><i>${j.cara}</i>${esc(j.nombre)}</h3>
      <p class="juego-linea">${esc(j.linea)}</p>
      <dl class="juego-datos">${j.datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="juego-pie">
        <span class="actividad" data-actividad="${j.id}"></span>
        ${disponible ? `<a class="btn btn-lima" href="${j.url}">Jugar</a>` : '<span class="btn btn-borde" aria-disabled="true">Próximamente</span>'}
      </div>
    </div>
  </article>`;
}
$('[data-juegos]').innerHTML = JUEGOS.map(tarjeta).join('');

// ---------------------------------------------------------------- la mesa está abierta (salas reales de todos los juegos)
const ritmo = (tc) => (tc?.initial ? `${tc.initial / 60}+${tc.increment}` : 'sin reloj');
const LECTORES = {
  ajedrez: ({ open = [], live = [] }, j) => ({
    abiertas: open.map((g) => ({ titulo: g.white || g.black, detalle: `${j.nombre} · ${ritmo(g.tc)}`, url: `/ajedrez/game/${g.id}`, accion: 'Unirse' })),
    vivo: live.map((g) => ({ titulo: `${g.white} vs ${g.black}`, detalle: `${j.nombre} · jugada ${Math.ceil((g.moves || 1) / 2)}`, url: `/ajedrez/game/${g.id}`, accion: 'Mirar' })),
  }),
  truco: ({ open = [], live = [] }, j) => ({
    abiertas: open.map((r) => ({ titulo: r.players.filter(Boolean).join(', ') || 'Mesa nueva', detalle: `${j.nombre} ${r.mode} · ${r.free === 1 ? 'falta 1' : `faltan ${r.free}`}`, url: `/truco/sala/${r.code}`, accion: 'Sentarse' })),
    vivo: live.map((r) => ({ titulo: r.players.filter(Boolean).join(', '), detalle: `${j.nombre} ${r.mode} · ${r.score ? `${r.score[0]} a ${r.score[1]}` : 'arrancando'}`, url: `/truco/sala/${r.code}`, accion: 'Mirar' })),
  }),
  // memes, casino y carrera usan el motor de salas común
  salas: ({ salas = [] }, j) => {
    const url = (s) => (j.id === 'casino' ? `/casino/mesa/${s.code}` : `/${j.id}/sala/${s.code}`);
    const item = (s) => ({
      titulo: s.titulo || s.nombre || `Sala ${s.code}`,
      detalle: `${j.nombre} · ${s.online} ${s.online === 1 ? 'conectado' : 'conectados'}${s.bots ? ` · ${s.bots} bots` : ''}`,
      url: url(s),
      accion: j.id === 'casino' ? 'Sentarse' : s.fase === 'lobby' ? 'Entrar' : 'Mirar',
    });
    const enEspera = (s) => j.id === 'casino' || s.fase === 'lobby' || s.fase === 'final';
    return { abiertas: salas.filter(enEspera).map(item), vivo: salas.filter((s) => !enEspera(s)).map(item) };
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
    disponibles.filter((j) => j.lobby).map(async (j) => {
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
      `<div class="vacio"><b>Abrí la primera mesa</b>No hay nadie esperando. Armá una sala y mandá el link.
        <div class="btns">${disponibles.slice(0, 4).map((j) => `<a class="btn btn-lima btn-chico" href="${j.url}">${esc(j.nombre)}</a>`).join('')}</div></div>`;
  $('[data-vivo]').innerHTML = fallo ? `<div class="vacio">—</div>` : vivo.slice(0, 8).join('') || `<div class="vacio"><b>Nadie jugando ahora</b>Cuando haya partidas, las vas a poder mirar desde acá.</div>`;
  $('[data-n-abiertas]').textContent = abiertas.length ? `(${abiertas.length})` : '';
  $('[data-n-vivo]').textContent = vivo.length ? `(${vivo.length})` : '';

  const pulso = [];
  for (const { j, abiertas: a, vivo: v } of ok) {
    const n = a.length + v.length;
    const chip = document.querySelector(`[data-vivo-chip="${j.id}"]`);
    chip?.classList.toggle('hidden', !v.length);
    if (chip) chip.textContent = `${v.length} en vivo`;
    const act = document.querySelector(`[data-actividad="${j.id}"]`);
    if (act) act.textContent = n ? `${n} ${n === 1 ? 'sala activa' : 'salas activas'}` : 'Salas libres: abrí una';
    if (n) pulso.push(`<a class="chip chip-vivo" href="#mesas">${esc(j.nombre)}: ${n} ${n === 1 ? 'sala' : 'salas'}</a>`);
  }
  $('[data-pulso]').innerHTML = pulso.join('') || (primeraVez ? '' : '<span class="chip">Las mesas están libres. Abrí la primera.</span>');
  primeraVez = false;
}
cargarMesas();
setInterval(() => !document.hidden && cargarMesas(), 10000);

// ---------------------------------------------------------------- volvé a jugar (guardado en este dispositivo)
try {
  const recientes = JSON.parse(localStorage.getItem('cadalado.recientes') || '[]').filter((r) => juego(r.juego));
  if (recientes.length) {
    $('#recientes').classList.remove('hidden');
    $('[data-recientes]').innerHTML = recientes
      .map((r) => {
        const j = juego(r.juego);
        return `<a class="reciente" href="${esc(r.url)}" style="--color:${j.color}"><small>${j.cara} ${esc(j.nombre)}</small><b>${esc(r.titulo || j.nombre)}</b><small>${hace(r.fecha)}</small></a>`;
      })
      .join('');
  }
} catch {}

// ---------------------------------------------------------------- novedades, ideas y equipo
$('[data-novedades]').innerHTML = NOVEDADES.map((n, i) => {
  const j = n.juego && juego(n.juego);
  const href = n.enlace || j?.url;
  return `<a class="novedad revela" href="${href}" style="transition-delay:${i * 0.06}s;--color:${j?.color || '#c5f04a'}">
    <span class="chip ${n.etiqueta === 'Nuevo' ? 'chip-lima' : ''}" style="align-self:flex-start">${esc(n.etiqueta)}</span>
    <h3>${j ? `<span>${j.cara}</span> ` : ''}${esc(n.titulo)}</h3><p>${esc(n.texto)}</p></a>`;
}).join('');
$('[data-ideas]').innerHTML = IDEAS.map((idea, i) => `<div class="idea revela" style="transition-delay:${i * 0.06}s">
  <span class="chip chip-dev" style="align-self:flex-start">${esc(idea.etiqueta)}</span><h3>${esc(idea.titulo)}</h3><p>${esc(idea.texto)}</p></div>`).join('');
$('[data-equipo]').innerHTML = personas(EQUIPO);
revelar();
