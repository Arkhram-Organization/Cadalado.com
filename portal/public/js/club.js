import { JUEGOS } from './datos.js';
import { iniciarPagina, api, yo, esc, avatar, avatarDe, toast, hace, pidDe } from './comun.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const juego = (id) => JUEGOS.find((j) => j.id === id);
const MOTIVOS = {
  checkmate: 'jaque mate', resign: 'abandono', timeout: 'tiempo', 'timeout-insufficient': 'tiempo', stalemate: 'ahogado',
  agreement: 'acuerdo', repetition: 'repetición', insufficient: 'material insuficiente', fifty: '50 jugadas', aborted: 'abortada',
};
const RESULTADO = { victoria: 'Victoria', derrota: 'Derrota', tablas: 'Tablas', abortada: 'Abortada' };

let yoMismo = null;
let amigosData = { amigos: [], recibidas: [], enviadas: [] };
let conversacion = 'general';
let chatTimer = null;
let ultimoChat = '';

const u = await yo();
if (!u) {
  $('[data-sin-cuenta]').classList.remove('hidden');
} else {
  yoMismo = u;
  $('[data-con-cuenta]').classList.remove('hidden');
  pintarPerfil();
  cargarHistorial();
  cargarAmigos();
  elegirTab((location.hash.slice(1).split(':')[0]) || 'historial');
  const con = location.hash.split(':')[1];
  if (con) conversacion = con;
}

// ---------------------------------------------------------------- perfil
function pintarPerfil() {
  $('[data-avatar]').innerHTML = avatarDe(yoMismo);
  $('[data-nombre]').textContent = yoMismo.nombre;
  $('[data-usuario]').textContent = '@' + yoMismo.usuario + ' · en cadalado desde ' + new Date(yoMismo.creado).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

// mail: para entrar y recuperar la cuenta (no lo ve nadie más)
$('[data-mail]')?.addEventListener('click', async () => {
  const actual = (await api('/api/club/yo').catch(() => ({})))?.usuario?.email || '';
  const nuevo = prompt('Tu mail (para entrar y para recuperar la contraseña; no lo ve nadie). Dejalo vacío para sacarlo.', actual);
  if (nuevo === null) return;
  try {
    const r = await api('/api/club/yo', { email: nuevo.trim() });
    toast(r.usuario.email ? `Listo: ${r.usuario.email}` : 'Sacamos el mail de tu cuenta');
  } catch (e) { toast(e.message, true); }
});
// código para recuperar la contraseña (se muestra solo cuando lo pedís)
$('[data-recup-ver]')?.addEventListener('click', async () => {
  const caja = $('[data-recup]');
  caja.classList.toggle('hidden');
  if (caja.classList.contains('hidden')) return;
  try { $('[data-recup-codigo]').textContent = (await api('/api/club/recuperacion')).codigo; } catch (e) { toast(e.message, true); }
});
$('[data-recup-nuevo]')?.addEventListener('click', async () => {
  if (!confirm('¿Cambiar el código? El anterior deja de servir.')) return;
  try { $('[data-recup-codigo]').textContent = (await api('/api/club/recuperacion', { nuevo: true })).codigo; } catch (e) { toast(e.message, true); }
});
$('[data-salir]')?.addEventListener('click', async () => {
  await api('/api/club/salir', {}).catch(() => {});
  location.href = '/';
});
$('[data-editar]')?.addEventListener('click', async () => {
  const nuevo = prompt('¿Cómo querés que te vean en la mesa?', yoMismo.nombre);
  if (!nuevo?.trim()) return;
  try {
    yoMismo = (await api('/api/club/yo', { nombre: nuevo })).usuario;
    try {
      localStorage.setItem('chessort.name', yoMismo.nombre);
      localStorage.setItem('truco-name', yoMismo.nombre);
    } catch {}
    pintarPerfil();
    toast('Listo, ahora sos ' + yoMismo.nombre);
  } catch (e) {
    toast(e.message, true);
  }
});

// ---------------------------------------------------------------- pestañas
function elegirTab(tab) {
  if (!['historial', 'amigos', 'chats'].includes(tab)) tab = 'historial';
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  clearInterval(chatTimer);
  if (tab === 'chats') {
    pintarConversaciones();
    abrirChat(conversacion);
    chatTimer = setInterval(() => !document.hidden && cargarChat(), 3000);
  }
  history.replaceState(null, '', '#' + tab);
}
document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => elegirTab(b.dataset.tab)));

// ---------------------------------------------------------------- historial
async function cargarHistorial() {
  const el = $('[data-historial]');
  el.innerHTML = '<div class="cargando"></div><div class="cargando"></div>';
  try {
    const { historial, resumen } = await api('/api/club/historial');
    const pct = resumen.jugadas ? Math.round((resumen.victorias / resumen.jugadas) * 100) : 0;
    $('[data-stats]').innerHTML = `
      <div class="stat"><b>${resumen.jugadas}</b><span>Partidas</span></div>
      <div class="stat lima"><b>${resumen.victorias}</b><span>Victorias</span></div>
      <div class="stat"><b>${resumen.derrotas}</b><span>Derrotas</span></div>
      <div class="stat"><b>${pct}%</b><span>Efectividad</span></div>`;
    el.innerHTML = historial.length
      ? historial.map((h) => {
          const j = juego(h.juego) || { nombre: h.juego, color: '#888' };
          const rivales = h.rivales?.length ? 'vs ' + h.rivales.join(', ') : '';
          const con = h.companeros?.length ? ' · con ' + h.companeros.join(', ') : '';
          const detalle = [j.nombre, MOTIVOS[h.detalle] || h.detalle, h.marcador, hace(h.fecha)].filter(Boolean).join(' · ');
          return `<a class="fila" href="${esc(h.url || j.url)}" style="--color:${j.color}"><span class="tag"></span>
            <span class="quien"><b>${esc(rivales || j.nombre)}${esc(con)}</b><small>${esc(detalle)}</small></span>
            <span class="resultado ${esc(h.resultado)}">${RESULTADO[h.resultado] || esc(h.resultado)}</span></a>`;
        }).join('')
      : `<div class="vacio"><b>Todavía no hay partidas</b>Las partidas que juegues con tu cuenta aparecen acá.
          <div class="btns">${JUEGOS.map((j) => `<a class="btn btn-lima btn-chico" href="${j.url}">${esc(j.nombre)}</a>`).join('')}</div></div>`;
  } catch (e) {
    el.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`;
  }
}

// ---------------------------------------------------------------- amigos
async function cargarAmigos() {
  try {
    amigosData = await api('/api/club/amigos');
  } catch (e) {
    $('[data-amigos]').innerHTML = `<div class="vacio">${esc(e.message)}</div>`;
    return;
  }
  const { amigos, recibidas, enviadas } = amigosData;
  const badge = $('[data-badge-amigos]');
  badge.textContent = recibidas.length;
  badge.classList.toggle('hidden', !recibidas.length);
  const sinLeer = amigos.filter((a) => a.sinLeer).length;
  $('[data-badge-chats]').textContent = sinLeer;
  $('[data-badge-chats]').classList.toggle('hidden', !sinLeer);
  $('[data-n-amigos]').textContent = amigos.length ? `(${amigos.length})` : '';

  $('[data-solicitudes]').innerHTML =
    (recibidas.length ? `<h3 style="font-size:22px">Te quieren sumar</h3><div class="filas">${recibidas.map((a) => `
      <div class="fila amigo">${avatar(a.nombre)}<span class="quien"><b>${esc(a.nombre)}</b><small>@${esc(a.usuario)}</small></span>
      <span class="acciones"><button class="btn btn-lima btn-chico" data-amistad="aceptar" data-u="${esc(a.usuario)}">Aceptar</button>
      <button class="btn btn-chico" data-amistad="rechazar" data-u="${esc(a.usuario)}">No</button></span></div>`).join('')}</div>` : '') +
    (enviadas.length ? `<h3 style="font-size:22px;margin-top:16px">Esperando respuesta</h3><div class="filas">${enviadas.map((a) => `
      <div class="fila amigo">${avatar(a.nombre)}<span class="quien"><b>${esc(a.nombre)}</b><small>@${esc(a.usuario)}</small></span>
      <span class="acciones"><button class="btn btn-chico" data-amistad="eliminar" data-u="${esc(a.usuario)}">Cancelar</button></span></div>`).join('')}</div>` : '');

  $('[data-amigos]').innerHTML = amigos.length
    ? amigos.map((a) => `
      <div class="fila amigo">${avatarDe(a)}
        <span class="quien"><b><span class="online ${a.enLinea ? 'si' : ''}"></span> <a href="/perfil?u=${encodeURIComponent(a.usuario)}">${esc(a.nombre)}</a></b>
          <small>@${esc(a.usuario)} · ${a.enLinea ? 'en línea' : a.visto ? 'visto ' + hace(a.visto) : 'sin conexión'}</small></span>
        <span class="acciones">
          <button class="btn btn-lima btn-chico" data-desafiar="ajedrez" data-u="${esc(a.usuario)}">Ajedrez</button>
          <button class="btn btn-lima btn-chico" data-desafiar="truco" data-u="${esc(a.usuario)}">Truco</button>
          <button class="btn btn-chico" data-chat="${esc(a.usuario)}">Chat${a.sinLeer ? ' ●' : ''}</button>
          <button class="btn btn-chico" data-amistad="eliminar" data-u="${esc(a.usuario)}" title="Quitar">✕</button>
        </span></div>`).join('')
    : `<div class="vacio"><b>Sumá a tu primer amigo</b>Pedile su usuario y agregalo acá al lado.</div>`;
  if (!$('[data-panel="chats"]').classList.contains('hidden')) pintarConversaciones();
}

$('[data-agregar]')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  try {
    const r = await api('/api/club/amigos', { accion: 'pedir', usuario: input.value.trim() });
    toast(r.estado === 'amigo' ? '¡Ya son amigos!' : 'Solicitud enviada');
    input.value = '';
    cargarAmigos();
  } catch (err) {
    toast(err.message, true);
  }
});

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-amistad], [data-desafiar], [data-chat]');
  if (!b) return;
  if (b.dataset.chat) {
    conversacion = b.dataset.chat;
    return elegirTab('chats');
  }
  b.disabled = true;
  try {
    if (b.dataset.amistad) {
      if (b.dataset.amistad === 'eliminar' && !confirm(`¿Quitar a @${b.dataset.u}?`)) return;
      await api('/api/club/amigos', { accion: b.dataset.amistad, usuario: b.dataset.u });
      await cargarAmigos();
    } else if (b.dataset.desafiar) {
      await desafiar(b.dataset.desafiar, b.dataset.u);
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    b.disabled = false;
  }
});

// Crea la mesa, le manda el link por chat al amigo y te lleva a jugar.
async function desafiar(id, usuario) {
  let url;
  if (id === 'ajedrez') {
    const r = await api('/ajedrez/api/games', { tc: localStorage.getItem('chessort.tc') || '10+0', color: 'random', pid: pidDe('chessort.pid'), name: yoMismo.nombre });
    url = `/ajedrez/game/${r.id}`;
  } else {
    const r = await api('/api/truco/rooms', { mode: '1v1', target: 30, pid: pidDe('truco-pid'), name: yoMismo.nombre });
    url = `/truco/sala/${r.code}`;
  }
  const texto = id === 'ajedrez' ? `¿Sale una de ajedrez? Te espero: ${url}` : `¿Un truquito? Sentate acá: ${url}`;
  await api('/api/club/chat', { con: usuario, texto });
  location.href = url;
}

// ---------------------------------------------------------------- chats
function pintarConversaciones() {
  const lista = [{ usuario: 'general', nombre: 'La mesa grande', sub: 'Chat de todo el club' }].concat(
    amigosData.amigos.map((a) => ({ usuario: a.usuario, nombre: a.nombre, sub: a.ultimo ? (a.ultimo.mio ? 'Vos: ' : '') + a.ultimo.texto : '@' + a.usuario, sinLeer: a.sinLeer, enLinea: a.enLinea }))
  );
  $('[data-conversaciones]').innerHTML = lista
    .map((c) => `<div class="fila" role="button" tabindex="0" data-con="${esc(c.usuario)}" aria-current="${c.usuario === conversacion}">
      ${c.usuario === 'general' ? '<span class="avatar" style="--av:var(--lima)">#</span>' : avatar(c.nombre)}
      <span class="quien"><b>${c.enLinea ? '<span class="online si"></span> ' : ''}${esc(c.nombre)}${c.sinLeer ? ' <span class="badge">•</span>' : ''}</b><small>${esc(c.sub)}</small></span></div>`)
    .join('') + (amigosData.amigos.length ? '' : '<p style="color:var(--gris);font-size:14px;margin-top:8px">Sumá amigos para chatear en privado.</p>');
}

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-con]');
  if (c) abrirChat(c.dataset.con);
});
document.addEventListener('keydown', (e) => {
  const c = e.target.closest?.('[data-con]');
  if (c && (e.key === 'Enter' || e.key === ' ')) abrirChat(c.dataset.con);
});

function abrirChat(con) {
  conversacion = con;
  ultimoChat = '';
  const amigo = amigosData.amigos.find((a) => a.usuario === con);
  $('[data-chat-cabeza]').innerHTML = con === 'general'
    ? '<span class="avatar" style="--av:var(--lima)">#</span><b>La mesa grande</b>'
    : `${avatar(amigo?.nombre || con)}<b>${esc(amigo?.nombre || con)}</b>${amigo ? `<button class="btn btn-lima btn-chico" style="margin-left:auto" data-desafiar="ajedrez" data-u="${esc(con)}">Ajedrez</button><button class="btn btn-lima btn-chico" data-desafiar="truco" data-u="${esc(con)}">Truco</button>` : ''}`;
  $('[data-chat-log]').innerHTML = '<div class="cargando"></div>';
  document.querySelectorAll('[data-con]').forEach((f) => f.setAttribute('aria-current', String(f.dataset.con === con)));
  history.replaceState(null, '', '#chats' + (con === 'general' ? '' : ':' + con));
  cargarChat();
}

// Los links a partidas se vuelven clickeables.
const enlazar = (t) => esc(t).replace(/(\/(?:ajedrez\/game\/[a-z0-9]{4,16}|truco\/sala\/[A-Z0-9]{5}))/g, '<a href="$1">$1</a>');

async function cargarChat() {
  const con = conversacion;
  try {
    const { mensajes } = await api('/api/club/chat?con=' + encodeURIComponent(con));
    if (con !== conversacion) return;
    const firma = mensajes.map((m) => m.id).join();
    if (firma === ultimoChat) return;
    ultimoChat = firma;
    const log = $('[data-chat-log]');
    const abajo = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    log.innerHTML = mensajes.length
      ? mensajes.map((m) => `<div class="msg ${m.mio ? 'mio' : ''}">${m.mio || con !== 'general' ? '' : `<small>${esc(m.nombre)}</small>`}${enlazar(m.texto)}<small>${hace(m.ts)}</small></div>`).join('')
      : `<div class="vacio" style="margin:auto"><b>Arrancá la charla</b>${con === 'general' ? 'Todo el club lee este chat.' : 'Solo ustedes dos ven esta conversación.'}</div>`;
    if (abajo || mensajes.at(-1)?.mio) log.scrollTop = log.scrollHeight;
    if (con !== 'general') {
      const a = amigosData.amigos.find((x) => x.usuario === con);
      if (a?.sinLeer) cargarAmigos();
    }
  } catch (e) {
    $('[data-chat-log]').innerHTML = `<div class="vacio" style="margin:auto">${esc(e.message)}</div>`;
  }
}

$('[data-chat-form]')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';
  try {
    await api('/api/club/chat', { con: conversacion, texto });
    ultimoChat = '';
    await cargarChat();
    $('[data-chat-log]').scrollTop = 1e9;
  } catch (err) {
    input.value = texto;
    toast(err.message, true);
  }
});

setInterval(() => yoMismo && !document.hidden && cargarAmigos(), 20000);
