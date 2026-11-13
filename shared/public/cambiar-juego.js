// "Cambiar de juego con tu lobby": desde adentro de un juego, el líder elige otro y se van todos juntos
// a una partida nueva de ese juego (la lobby sigue siendo la misma).
import { pedirClub } from './club-vivo.js';
import { crearSalaDeLobby } from './juegos-lobby.js';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const aIndice = (url) => String(url).replace(/^\/([a-z]{3,12})\/(sala|mesa)\/([A-Za-z0-9-]{3,24})\/?$/, '/$1/?$2=$3');

const CSS = `
.cj-capa{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:16px;background:#0a0d0ad9;backdrop-filter:blur(8px);font-family:Barlow,Arial,sans-serif;color:#efede4;animation:cj-a .2s}
.cj-caja{width:min(760px,100%);max-height:90vh;overflow:auto;border:1px solid #c5f04a66;border-radius:22px;background:linear-gradient(140deg,#242b20,#141713 68%);padding:22px;display:grid;gap:14px;animation:cj-s .3s cubic-bezier(.2,1.2,.35,1)}
.cj-caja header{display:flex;justify-content:space-between;gap:12px;align-items:start}
.cj-caja small{color:#c5f04a;font:700 11px 'JetBrains Mono',monospace;letter-spacing:2px;text-transform:uppercase}
.cj-caja h2{margin:6px 0 0;font:900 clamp(28px,5vw,42px)/.95 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase}
.cj-caja p{margin:0;color:#c9d3bf;font-size:14px}
.cj-x{width:38px;height:38px;flex:none;border:1px solid #ffffff37;background:#ffffff13;color:#fff;border-radius:10px;font-size:24px;cursor:pointer}
.cj-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.cj-j{position:relative;display:grid;align-content:end;min-height:110px;padding:12px;border-radius:14px;border:2px solid #ffffff22;background:#111 center/cover;color:#fff;text-align:left;cursor:pointer;overflow:hidden;font:inherit;transition:transform .15s,border-color .15s}
.cj-j::before{content:'';position:absolute;inset:0;background:linear-gradient(0deg,#000d 10%,#0000 70%)}
.cj-j b,.cj-j span{position:relative}
.cj-j b{font:900 22px 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase}
.cj-j span{font-size:12px;color:#dfe5d8}
.cj-j:hover,.cj-j:focus-visible{transform:translateY(-3px);border-color:#c5f04a;outline:none}
.cj-j.actual{border-color:#c5f04a99}
.cj-j[disabled]{opacity:.5;cursor:wait}
.cj-error{color:#ff8b7d;font-weight:700}
@keyframes cj-a{from{opacity:0}}@keyframes cj-s{from{opacity:0;transform:translateY(20px) scale(.97)}}
@media (prefers-reduced-motion:reduce){.cj-capa,.cj-caja{animation:none}}
`;

export async function abrirCambiarJuego() {
  if (document.querySelector('.cj-capa')) return;
  if (!document.getElementById('cj-css')) { const st = document.createElement('style'); st.id = 'cj-css'; st.textContent = CSS; document.head.append(st); }
  const { JUEGOS } = await import('/js/datos.js');
  const lobby = window.__lobby || {};
  const actual = location.pathname.split('/')[1];
  const capa = document.createElement('div');
  capa.className = 'cj-capa';
  capa.innerHTML = `<div class="cj-caja" role="dialog" aria-modal="true" aria-label="Cambiar de juego con tu lobby">
    <header><div><small>Tu lobby · ${lobby.miembros || 1} ${lobby.miembros === 1 ? 'persona' : 'personas'}</small><h2>¿A qué jugamos ahora?</h2></div><button class="cj-x" data-cerrar aria-label="Cerrar">&times;</button></header>
    <p>Elegí el juego y se arma una partida nueva: todos los de tu lobby entran juntos.</p>
    <div class="cj-lista">${JUEGOS.filter((j) => j.estado === 'disponible').map((j) => `<button class="cj-j ${j.id === actual ? 'actual' : ''}" data-juego="${esc(j.id)}" style="background-image:url('${esc(j.captura || j.poster || '')}')"><b>${esc(j.nombre)}</b><span>${j.id === actual ? 'Otra partida de este juego' : esc((j.linea || '').slice(0, 60) + ((j.linea || '').length > 60 ? '…' : ''))}</span></button>`).join('')}</div>
    <p class="cj-error" data-error></p>
  </div>`;
  const cerrar = () => { capa.remove(); removeEventListener('keydown', tecla, true); };
  const tecla = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); cerrar(); } };
  addEventListener('keydown', tecla, true);
  capa.addEventListener('click', async (e) => {
    if (e.target === capa || e.target.closest('[data-cerrar]')) return cerrar();
    const b = e.target.closest('[data-juego]');
    if (!b) return;
    const juego = b.dataset.juego;
    capa.querySelectorAll('[data-juego]').forEach((x) => (x.disabled = true));
    b.querySelector('span').textContent = 'Armando la partida…';
    const pid = leer('cadalado.pid') || '';
    const nombre = leer('cadalado.nombre') || 'Invitado';
    try {
      // 1) la lobby cambia de juego, 2) se arma la sala, 3) se avisa a todos y vamos
      const r = await pedirClub('/api/club/grupo', { b: { pid, nombre, accion: 'juego', juego } });
      const url = await crearSalaDeLobby(juego, r?.grupo?.config || {}, { pid, nombre });
      const listo = await pedirClub('/api/club/grupo', { b: { pid, nombre, accion: 'jugar', url } });
      try { sessionStorage.setItem('cadalado.grupo.ir', String(listo?.grupo?.ir?.ts || Date.now())); } catch {}
      location.href = aIndice(url);
    } catch (err) {
      capa.querySelector('[data-error]').textContent = err.message || 'No se pudo cambiar de juego.';
      capa.querySelectorAll('[data-juego]').forEach((x) => (x.disabled = false));
      b.querySelector('span').textContent = 'Probá de nuevo';
    }
  });
  document.body.append(capa);
  capa.querySelector('[data-juego]')?.focus();
}
