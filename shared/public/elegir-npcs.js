// Selector de personajes del club para una partida: el anfitrión marca quiénes quiere sí o sí
// y los lugares de bot que sobren se sortean. Lo usan todos los juegos con bots.
import { NPCS } from './npcs.js';
import { avatarSvg } from './avatar.js';

const CSS = `
.en-capa{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:16px;background:rgba(8,10,8,.72);backdrop-filter:blur(6px);animation:en-aparece .2s}
.en-caja{width:min(760px,100%);max-height:min(88vh,760px);display:flex;flex-direction:column;background:#191c17;color:#f4f1ea;border:1px solid #3a4234;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.6);animation:en-sube .32s cubic-bezier(.2,1.2,.35,1);font-family:Barlow,system-ui,sans-serif}
.en-caja header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 20px 0}
.en-etq{font:700 11px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--en)}
.en-caja h2{margin:6px 0 0;font:800 34px/1 'Barlow Condensed',sans-serif;text-transform:uppercase}
.en-x{width:36px;height:36px;border-radius:10px;border:1px solid #3a4234;background:#22261f;color:#f4f1ea;font-size:22px;line-height:1;cursor:pointer}
.en-x:hover{border-color:var(--en)}
.en-ayuda{margin:8px 20px 12px;color:#b9bfae;font-size:14px}
.en-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;padding:4px 20px 16px;overflow:auto;scrollbar-width:thin;scrollbar-color:#3a4034 transparent}
.en-npc{position:relative;display:grid;justify-items:center;gap:6px;padding:10px 6px 9px;border-radius:14px;border:2px solid #2f352b;background:#20241d;color:#f4f1ea;cursor:pointer;transition:transform .14s,border-color .14s,background .14s;animation:en-pop .35s cubic-bezier(.2,1.2,.35,1) backwards;animation-delay:calc(var(--i)*18ms)}
.en-npc:hover{transform:translateY(-3px);border-color:#55604a}
.en-npc .en-av{width:64px;height:64px;border-radius:50%;overflow:hidden;background:#2b3126;display:block;transition:transform .2s}
.en-npc .en-av svg{width:100%;height:100%;display:block}
.en-npc b{font:800 15px/1.05 'Barlow Condensed',sans-serif;text-transform:uppercase;text-align:center}
.en-npc i{position:absolute;top:7px;right:7px;width:22px;height:22px;border-radius:50%;border:2px solid #4a5143;display:grid;place-items:center;font:800 12px/1 'JetBrains Mono',monospace;font-style:normal;color:#141413}
.en-npc.on{border-color:var(--en);background:color-mix(in srgb,var(--en) 14%,#20241d)}
.en-npc.on .en-av{transform:scale(1.08)}
.en-npc.on i{background:var(--en);border-color:var(--en)}
.en-npc.lleno:not(.on){opacity:.4;cursor:not-allowed}
.en-caja footer{display:flex;align-items:center;gap:10px;padding:14px 20px;border-top:1px solid #2f352b}
.en-caja footer span{flex:1;font:700 13px 'JetBrains Mono',monospace;color:#b9bfae}
.en-caja footer span b{color:var(--en)}
.en-bt{padding:11px 18px;border-radius:11px;border:1px solid #4a5143;background:none;color:#f4f1ea;font:800 16px 'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
.en-bt:hover{border-color:var(--en)}
.en-bt.si{background:var(--en);border-color:var(--en);color:#141413}
.en-bt.si:hover{filter:brightness(1.08)}
@keyframes en-aparece{from{opacity:0}}
@keyframes en-sube{from{opacity:0;transform:translateY(26px) scale(.97)}}
@keyframes en-pop{from{opacity:0;transform:scale(.8)}}
@media (max-width:520px){.en-caja h2{font-size:27px}.en-grilla{grid-template-columns:repeat(3,1fr);gap:8px;padding:4px 14px 14px}.en-npc .en-av{width:54px;height:54px}.en-caja footer{flex-wrap:wrap}.en-caja footer span{flex-basis:100%}}
@media (prefers-reduced-motion:reduce){.en-capa,.en-caja,.en-npc{animation:none}}
`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Texto del botón que abre el selector (para que en todos los juegos diga lo mismo).
export const textoNpcs = (elegidos = []) => (elegidos.length ? `Personajes (${elegidos.length} elegidos)` : 'Elegir personajes');

// Abre el selector. alGuardar recibe la lista de ids elegidos (en el orden en que se tocaron).
export function abrirElegirNpcs({ elegidos = [], max = 8, color = '#c5f04a', alGuardar = () => {} } = {}) {
  if (document.querySelector('.en-capa')) return;
  if (!document.getElementById('en-estilos')) {
    const st = document.createElement('style');
    st.id = 'en-estilos';
    st.textContent = CSS;
    document.head.append(st);
  }
  let lista = elegidos.filter((id) => NPCS.some((n) => n.id === id)).slice(0, max);
  const capa = document.createElement('div');
  capa.className = 'en-capa';
  capa.style.setProperty('--en', color);
  capa.innerHTML = `<div class="en-caja" role="dialog" aria-modal="true" aria-label="Elegir personajes">
    <header><div><span class="en-etq">Personajes del club</span><h2>¿Quiénes juegan?</h2></div><button type="button" class="en-x" data-cerrar aria-label="Cerrar">&times;</button></header>
    <p class="en-ayuda">Tocá a los que querés en la partida (hasta ${max}). Los lugares de bot que sobren se sortean.</p>
    <div class="en-grilla">${NPCS.map((n, i) => `<button type="button" class="en-npc" style="--i:${i}" data-id="${esc(n.id)}"><span class="en-av">${avatarSvg({ ...n.look })}</span><b>${esc(n.nombre)}</b><i></i></button>`).join('')}</div>
    <footer><span data-cuenta></span><button type="button" class="en-bt" data-azar>Todos al azar</button><button type="button" class="en-bt si" data-listo>Listo</button></footer>
  </div>`;
  const pintar = () => {
    capa.querySelectorAll('.en-npc').forEach((b) => {
      const k = lista.indexOf(b.dataset.id);
      b.classList.toggle('on', k >= 0);
      b.classList.toggle('lleno', lista.length >= max);
      b.setAttribute('aria-pressed', k >= 0);
      b.querySelector('i').textContent = k >= 0 ? k + 1 : '';
    });
    capa.querySelector('[data-cuenta]').innerHTML = lista.length ? `<b>${lista.length}</b> de ${max} elegidos` : 'Todos al azar';
  };
  const cerrar = () => {
    document.removeEventListener('keydown', tecla, true);
    capa.remove();
  };
  // Esc cierra el selector (y no abre el menú de pausa del juego que está atrás)
  const tecla = (e) => {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation();
    e.preventDefault();
    cerrar();
  };
  capa.addEventListener('click', (e) => {
    const npc = e.target.closest('.en-npc');
    if (npc) {
      const id = npc.dataset.id;
      if (lista.includes(id)) lista = lista.filter((x) => x !== id);
      else if (lista.length < max) lista.push(id);
      pintar();
    } else if (e.target.closest('[data-azar]')) {
      lista = [];
      pintar();
    } else if (e.target.closest('[data-listo]')) {
      cerrar();
      alGuardar([...lista]);
    } else if (e.target === capa || e.target.closest('[data-cerrar]')) cerrar();
  });
  document.addEventListener('keydown', tecla, true);
  document.body.append(capa);
  pintar();
  capa.querySelector('[data-listo]').focus();
}
