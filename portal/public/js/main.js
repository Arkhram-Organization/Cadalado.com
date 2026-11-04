import { JUEGOS, CREADORES } from './datos.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICONOS = {
  peon: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="12" r="6.5"/><path d="M17 21h14l-3 5 4 11H16l4-11z"/><rect x="11" y="37" width="26" height="6" rx="2.5"/></svg>`,
  carta: `<svg viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate(8 24 24)"><rect class="carta-fondo" x="11" y="5" width="26" height="38" rx="4"/><circle class="carta-oro" cx="24" cy="24" r="8"/><circle class="carta-dibujo" cx="24" cy="24" r="4.6"/></g></svg>`,
  mas: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 12v24M12 24h24" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`,
};

const PALETA = ['#ff5a1f', '#3b5bff', '#81b64c', '#f2b630', '#c04fd6', '#19b3a6'];
function colorDe(nombre) {
  let h = 0;
  for (const ch of nombre) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

// ---------- juegos ----------
function tarjetaJuego(j) {
  const disponible = j.estado === 'disponible';
  const tag = disponible ? 'a' : 'div';
  const href = disponible ? ` href="${esc(j.url)}"` : '';
  return `<${tag} class="juego ${disponible ? '' : 'juego-pronto'}"${href} style="--juego:${esc(j.color)}">
    <div class="juego-arte">${ICONOS[j.icono] || ''}</div>
    <div class="juego-cuerpo">
      <div class="juego-top">
        <h3>${esc(j.nombre)}</h3>
        <span class="estado estado-${esc(j.estado)}">${disponible ? 'Disponible' : 'En desarrollo'}</span>
      </div>
      <p>${esc(j.descripcion)}</p>
      <ul class="etiquetas">${j.etiquetas.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      <div class="juego-pie">
        <span class="en-vivo" data-lobby="${j.lobby ? esc(j.url) : ''}"></span>
        <span class="btn ${disponible ? 'btn-primario' : 'btn-apagado'}">${disponible ? 'Jugar' : 'Próximamente'}</span>
      </div>
    </div>
  </${tag}>`;
}

const tarjetaSumate = `<a class="juego juego-sumate" href="/creadores#sumate">
  <div class="juego-arte">${ICONOS.mas}</div>
  <div class="juego-cuerpo">
    <h3>Tu juego acá</h3>
    <p>¿Tenés una idea? Cada juego de cadalado lo arma alguien del grupo. El próximo puede ser el tuyo.</p>
    <div class="juego-pie"><span></span><span class="btn btn-borde">Sumate</span></div>
  </div>
</a>`;

async function cargarLobby(el) {
  const base = el.dataset.lobby;
  if (!base) return;
  try {
    const res = await fetch(base.replace(/\/$/, '') + '/api/lobby', { cache: 'no-store' });
    if (!res.ok) return;
    const { open = [], live = [] } = await res.json();
    if (live.length || open.length) {
      const partes = [];
      if (live.length) partes.push(`${live.length} ${live.length === 1 ? 'partida' : 'partidas'} en vivo`);
      if (open.length) partes.push(`${open.length} ${open.length === 1 ? 'desafío' : 'desafíos'}`);
      el.innerHTML = `<i></i>${partes.join(' · ')}`;
      el.classList.add('activo');
    } else {
      el.textContent = 'Nadie jugando: arrancá vos';
    }
  } catch {
    /* el juego todavía no está en su dominio: no mostramos nada */
  }
}

const grilla = document.querySelector('[data-juegos]');
if (grilla) {
  grilla.innerHTML = JUEGOS.map(tarjetaJuego).join('') + tarjetaSumate;
  const actualizar = () => grilla.querySelectorAll('[data-lobby]').forEach(cargarLobby);
  actualizar();
  setInterval(actualizar, 15000);
  const primero = JUEGOS.find((j) => j.estado === 'disponible');
  document.querySelectorAll('[data-primer-juego]').forEach((a) => {
    if (primero) {
      a.href = primero.url;
      a.textContent = `Jugar ${primero.nombre.toLowerCase()}`;
    }
  });
  const n = document.querySelector('[data-cantidad-juegos]');
  if (n) n.textContent = JUEGOS.length;
}

// ---------- creadores ----------
function tarjetaCreador(c) {
  const juegos = c.juegos
    .map((id) => JUEGOS.find((j) => j.id === id))
    .filter(Boolean)
    .map((j) => `<li style="--juego:${esc(j.color)}">${esc(j.nombre)}</li>`)
    .join('');
  const links = Object.entries(c.links || {})
    .map(([red, v]) => {
      const url = red === 'github' ? `https://github.com/${v}` : red === 'instagram' ? `https://instagram.com/${v}` : v;
      return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(red)}</a>`;
    })
    .join('');
  const color = colorDe(c.nombre);
  return `<article class="creador ${c.pendiente ? 'creador-pendiente' : ''}">
    <div class="creador-avatar" style="--av:${color}"><span>${esc(c.nombre.trim()[0] || '?')}</span></div>
    <div class="creador-rol">${esc(c.rol)}</div>
    <h3>${esc(c.nombre)}</h3>
    <p>${esc(c.bio)}</p>
    <ul class="etiquetas">${juegos}</ul>
    ${links ? `<div class="creador-links">${links}</div>` : ''}
  </article>`;
}

const listaCreadores = document.querySelector('[data-creadores]');
if (listaCreadores) listaCreadores.innerHTML = CREADORES.map(tarjetaCreador).join('');

// ---------- navegación ----------
const ruta = location.pathname.replace(/\/$/, '') || '/';
document.querySelectorAll('.nav a').forEach((a) => {
  const destino = a.getAttribute('href').replace(/#.*/, '');
  if (destino === ruta) a.setAttribute('aria-current', 'page');
});
document.querySelectorAll('[data-anio]').forEach((el) => (el.textContent = new Date().getFullYear()));
