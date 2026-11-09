// Partes comunes de todas las páginas del portal: cabecera, pie, cuenta, avisos y animaciones.
import { JUEGOS } from './datos.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const COLORES = ['#c5f04a', '#7aa2ff', '#ff7a45', '#f2c94c', '#c084fc', '#4fd1c5', '#ff8fab'];
export function colorDe(texto) {
  let h = 0;
  for (const ch of String(texto)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}
export function iniciales(nombre) {
  const partes = String(nombre || '?').trim().split(/\s+/);
  return esc(((partes[0]?.[0] || '?') + (partes[1]?.[0] || '')).toUpperCase());
}
export const avatar = (nombre, clase = '') => `<span class="avatar ${clase}" style="--av:${colorDe(nombre)}" aria-hidden="true">${iniciales(nombre)}</span>`;

export async function api(ruta, body) {
  const res = await fetch(ruta, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
  return data;
}

let toastTimer;
export function toast(texto, mal = false) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = texto;
  el.classList.toggle('mal', mal);
  el.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('ver'), mal ? 6000 : 2800);
}

export const hace = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
};

// Tarjetas del equipo (inicio y /equipo).
export function personas(lista) {
  const juego = (id) => JUEGOS.find((j) => j.id === id);
  // sin nombres: cada tarjeta muestra qué armó esa persona del grupo
  return lista
    .map((p, i) => `<article class="persona revela" style="transition-delay:${i * 0.08}s">
      <span class="avatar" style="--av:${juego(p.juegos[0])?.color || 'var(--lima)'}" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="rol">Del grupo</span>
      <h3>${esc(p.rol)}</h3>
      <div class="juegos-de">${p.juegos.map((id) => `<span class="chip" style="box-shadow:inset 0 0 0 1px ${juego(id).color}">${esc(juego(id).nombre)}</span>`).join('')}</div>
    </article>`)
    .join('');
}

// ---------- cuenta ----------
let yoPromesa = null;
export function yo() {
  yoPromesa ??= api('/api/club/yo').then((d) => d.usuario).catch(() => null);
  return yoPromesa;
}

// Identificador anónimo de cada juego (el mismo que usan sus páginas: mismo dominio).
export function pidDe(clave) {
  try {
    let p = localStorage.getItem(clave);
    if (!p || !/^[A-Za-z0-9_-]{8,64}$/.test(p)) {
      p = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 56]).join('');
      localStorage.setItem(clave, p);
    }
    return p;
  } catch {
    return 'anon' + Math.random().toString(36).slice(2, 12);
  }
}

// ---------- cabecera y pie ----------
function cabecera() {
  const ruta = location.pathname.replace(/\/$/, '') || '/';
  const link = (href, txt) => `<a href="${href}"${href === ruta ? ' aria-current="page"' : ''}>${txt}</a>`;
  return `
  <header class="cabecera">
    <div class="contenedor">
      <a class="logo" href="/" data-logo aria-label="cadalado, inicio"><img src="/marca.svg" alt=""><span>cadalado</span></a>
      <nav class="nav" id="nav" aria-label="Principal">
        ${link('/#muro', 'Muro')}${link('/#juegos', 'Juegos')}${link('/personaje', 'Tu personaje')}${link('/equipo', 'Equipo')}${link('/club', 'Club')}
      </nav>
      <div class="cabecera-der">
        <span data-cuenta></span>
        <a class="btn btn-lima btn-chico" href="/#juegos">Jugar</a>
        <button class="menu-btn" aria-label="Menú" aria-expanded="false" aria-controls="nav">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
    </div>
  </header>`;
}

function pie() {
  return `
  <footer class="pie">
    <div class="contenedor">
      <div>
        <a class="logo" href="/"><img src="/marca.svg" alt=""><span>cadalado</span></a>
        <p class="lema">Cada uno de su lado. Todos en la misma partida.</p>
      </div>
      <div>
        <h4>Juegos</h4>
        <ul>${JUEGOS.map((j) => `<li><a href="${j.url}">${esc(j.nombre)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>Club</h4>
        <ul><li><a href="/club">Tu cuenta</a></li><li><a href="/personaje">Tu personaje</a></li><li><a href="/club#amigos">Amigos</a></li><li><a href="/club#chats">Chats</a></li><li><a href="/equipo">Equipo</a></li><li><a href="/#sugerencias">Sugerencias</a></li></ul>
      </div>
      <div>
        <h4>Créditos</h4>
        <small>Piezas de ajedrez: “Cburnett”, Wikimedia Commons, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
        Naipes: “Naipes Libres” de Basquetteur, CC BY-SA 3.0. Plantillas de memes: imgflip.com. 3D: three.js (MIT).</small>
        <small style="margin-top:10px">Hecho entre amigos · © <span data-anio>2026</span> cadalado.com</small>
      </div>
    </div>
  </footer>`;
}

async function pintarCuenta() {
  const el = document.querySelector('[data-cuenta]');
  if (!el) return;
  const u = await yo();
  el.innerHTML = u
    ? `<a class="cuenta-link" href="/club" title="Tu cuenta">${avatar(u.nombre)}<span>${esc(u.nombre)}</span></a>`
    : `<a class="cuenta-link" href="/entrar?volver=${encodeURIComponent(location.pathname)}" style="padding:7px 14px"><span style="display:inline">Entrar</span></a>`;
}

// Easter egg: tocá el logo cinco veces seguidas.
const FRASES = ['¿Sale una?', 'La revancha está pendiente.', 'Mandá el link. Se juega.', '¡Quiero retruco!', 'Envido… y el que pierde ceba.'];
function easterEgg() {
  const logo = document.querySelector('[data-logo]');
  let toques = [];
  logo?.addEventListener('click', (e) => {
    const ahora = Date.now();
    toques = toques.filter((t) => ahora - t < 2500).concat(ahora);
    if (toques.length >= 5) {
      e.preventDefault();
      toques = [];
      logo.classList.remove('giro');
      void logo.offsetWidth;
      logo.classList.add('giro');
      toast(FRASES[Math.floor(Math.random() * FRASES.length)]);
    } else if (location.pathname === '/' && toques.length > 1) e.preventDefault();
  });
}

// Aparición suave de las secciones al bajar.
export function revelar(raiz = document) {
  const els = raiz.querySelectorAll('.revela:not(.visto)');
  if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('visto'));
  const io = new IntersectionObserver(
    (entradas) => entradas.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('visto');
        io.unobserve(en.target);
      }
    }),
    { rootMargin: '0px 0px -8% 0px' }
  );
  els.forEach((e) => io.observe(e));
}

export function iniciarPagina() {
  import('/comun/seguir-grupo.js').then((m) => m.seguirGrupo()).catch(() => {});
  document.querySelector('#cabecera')?.insertAdjacentHTML('afterend', cabecera());
  document.querySelector('#cabecera')?.remove();
  document.querySelector('#pie')?.insertAdjacentHTML('afterend', pie());
  document.querySelector('#pie')?.remove();
  document.querySelectorAll('[data-anio]').forEach((e) => (e.textContent = new Date().getFullYear()));
  const cab = document.querySelector('.cabecera');
  const borde = () => cab?.classList.toggle('con-borde', scrollY > 8);
  addEventListener('scroll', borde, { passive: true });
  borde();
  const menu = document.querySelector('.menu-btn');
  menu?.addEventListener('click', () => {
    const abierta = document.querySelector('#nav').classList.toggle('abierta');
    menu.setAttribute('aria-expanded', abierta);
  });
  document.querySelectorAll('#nav a').forEach((a) => a.addEventListener('click', () => document.querySelector('#nav').classList.remove('abierta')));
  pintarCuenta();
  easterEgg();
  revelar();
}
