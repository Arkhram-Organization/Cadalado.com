// "Agregar bots": se elige cuántos bots y cuáles. Cada personaje del club se puede sumar las veces que
// quieras (se pueden repetir) y también hay bots "al azar". Cada juego tiene su tope.
// Lo usan todos los juegos con bots, al crear la partida y adentro de la sala.
import { NPCS } from './npcs.js';
import { avatarSvg } from './avatar.js';

const CSS = `
.en-capa{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:16px;background:rgba(8,10,8,.72);backdrop-filter:blur(6px);animation:en-aparece .2s}
.en-caja{width:min(780px,100%);max-height:min(90vh,780px);display:flex;flex-direction:column;background:#191c17;color:#f4f1ea;border:1px solid #3a4234;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.6);animation:en-sube .32s cubic-bezier(.2,1.2,.35,1);font-family:Barlow,system-ui,sans-serif}
.en-caja header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 20px 0}
.en-etq{font:700 11px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--en)}
.en-caja h2{margin:6px 0 0;font:800 34px/1 'Barlow Condensed',sans-serif;text-transform:uppercase}
.en-x{width:36px;height:36px;border-radius:10px;border:1px solid #3a4234;background:#22261f;color:#f4f1ea;font-size:22px;line-height:1;cursor:pointer}
.en-x:hover{border-color:var(--en)}
.en-ayuda{margin:8px 20px 12px;color:#b9bfae;font-size:14px}
.en-azar{display:flex;align-items:center;gap:12px;margin:0 20px 12px;padding:10px 12px;border-radius:14px;border:2px dashed #4a5143;background:#20241d}
.en-azar .en-dado{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:#2b3126;font:900 22px 'Barlow Condensed',sans-serif;color:var(--en)}
.en-azar b{flex:1;font:800 18px 'Barlow Condensed',sans-serif;text-transform:uppercase}
.en-azar small{display:block;font:500 12px Barlow,sans-serif;text-transform:none;color:#b9bfae}
.en-paso{display:inline-flex;align-items:center;border-radius:11px;border:1px solid #4a5143;overflow:hidden}
.en-paso button{width:38px;height:38px;border:0;background:none;color:#f4f1ea;font:800 20px/1 'Barlow Condensed',sans-serif;cursor:pointer}
.en-paso button:hover:not(:disabled){background:#ffffff14}
.en-paso button:disabled{opacity:.35;cursor:default}
.en-paso output{min-width:34px;text-align:center;font:800 18px 'JetBrains Mono',monospace}
.en-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;padding:4px 20px 16px;overflow:auto;scrollbar-width:thin;scrollbar-color:#3a4034 transparent}
.en-npc{position:relative;display:grid;justify-items:center;gap:6px;padding:10px 6px 9px;border-radius:14px;border:2px solid #2f352b;background:#20241d;color:#f4f1ea;cursor:pointer;transition:transform .14s,border-color .14s,background .14s;animation:en-pop .35s cubic-bezier(.2,1.2,.35,1) backwards;animation-delay:calc(var(--i)*18ms);font:inherit}
.en-npc:hover{transform:translateY(-3px);border-color:#55604a}
.en-npc .en-av{width:64px;height:64px;border-radius:50%;overflow:hidden;background:#2b3126;display:block;transition:transform .2s}
.en-npc .en-av svg{width:100%;height:100%;display:block}
.en-npc b{font:800 15px/1.05 'Barlow Condensed',sans-serif;text-transform:uppercase;text-align:center}
.en-npc i{position:absolute;top:6px;right:6px;min-width:26px;height:26px;padding:0 6px;border-radius:13px;display:none;place-items:center;background:var(--en);color:#141413;font:800 13px/1 'JetBrains Mono',monospace;font-style:normal}
.en-npc .en-menos{position:absolute;top:6px;left:6px;width:26px;height:26px;border-radius:50%;border:1px solid #4a5143;background:#141713;color:#f4f1ea;font:800 16px/1 sans-serif;display:none;place-items:center;cursor:pointer}
.en-npc.on{border-color:var(--en);background:color-mix(in srgb,var(--en) 14%,#20241d)}
.en-npc.on i,.en-npc.on .en-menos{display:grid}
.en-npc.on .en-av{transform:scale(1.06)}
.en-npc.lleno:not(.on){opacity:.4;cursor:not-allowed}
.en-caja footer{display:flex;align-items:center;gap:10px;padding:14px 20px;border-top:1px solid #2f352b}
.en-caja footer span{flex:1;font:700 13px 'JetBrains Mono',monospace;color:#b9bfae}
.en-caja footer span b{color:var(--en);font-size:16px}
.en-bt{padding:11px 18px;border-radius:11px;border:1px solid #4a5143;background:none;color:#f4f1ea;font:800 16px 'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
.en-bt:hover{border-color:var(--en)}
.en-bt.si{background:var(--en);border-color:var(--en);color:#141413}
.en-bt.si:hover{filter:brightness(1.08)}
@keyframes en-aparece{from{opacity:0}}
@keyframes en-sube{from{opacity:0;transform:translateY(26px) scale(.97)}}
@keyframes en-pop{from{opacity:0;transform:scale(.8)}}
@media (max-width:520px){.en-caja h2{font-size:27px}.en-grilla{grid-template-columns:repeat(3,1fr);gap:8px;padding:4px 14px 14px}.en-npc .en-av{width:54px;height:54px}.en-azar{margin:0 14px 10px}.en-caja footer{flex-wrap:wrap}.en-caja footer span{flex-basis:100%}}
@media (prefers-reduced-motion:reduce){.en-capa,.en-caja,.en-npc{animation:none}}
`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Texto del botón que abre el selector (igual en todos los juegos).
export const textoBots = (n = 0) => (n ? `Agregar bots (${n})` : 'Agregar bots');

// Abre el selector. ids: los personajes ya elegidos (con repetidos); azar: cuántos al azar; max: tope del juego.
// alGuardar({ ids, azar }) recibe lo elegido (ids en el orden en que se sumaron).
export function abrirAgregarBots({ ids = [], azar = 0, max = 8, color = '#c5f04a', alGuardar = () => {} } = {}) {
  if (document.querySelector('.en-capa')) return;
  if (!document.getElementById('en-estilos')) {
    const st = document.createElement('style');
    st.id = 'en-estilos';
    st.textContent = CSS;
    document.head.append(st);
  }
  let lista = ids.filter((id) => NPCS.some((n) => n.id === id)).slice(0, max);
  let alAzar = Math.max(0, Math.min(Number(azar) || 0, max - lista.length));
  const total = () => lista.length + alAzar;
  const capa = document.createElement('div');
  capa.className = 'en-capa';
  capa.style.setProperty('--en', color);
  capa.innerHTML = `<div class="en-caja" role="dialog" aria-modal="true" aria-label="Agregar bots">
    <header><div><span class="en-etq">Personajes del club · hasta ${max}</span><h2>Agregar bots</h2></div><button type="button" class="en-x" data-cerrar aria-label="Cerrar">&times;</button></header>
    <p class="en-ayuda">Tocá un personaje para sumarlo (podés repetir) o sumá bots al azar.</p>
    <div class="en-azar"><span class="en-dado">?</span><b>Al azar<small>Personajes sorteados entre todos</small></b><span class="en-paso"><button type="button" data-azar="-1" aria-label="Uno al azar menos">&minus;</button><output data-azar-n></output><button type="button" data-azar="1" aria-label="Uno al azar más">+</button></span></div>
    <div class="en-grilla">${NPCS.map((n, i) => `<button type="button" class="en-npc" style="--i:${i}" data-id="${esc(n.id)}"><span class="en-menos" data-menos title="Sacar uno">&minus;</span><span class="en-av">${avatarSvg({ ...n.look })}</span><b>${esc(n.nombre)}</b><i></i></button>`).join('')}</div>
    <footer><span data-cuenta></span><button type="button" class="en-bt" data-vaciar>Sin bots</button><button type="button" class="en-bt si" data-listo>Listo</button></footer>
  </div>`;
  const pintar = () => {
    const lleno = total() >= max;
    capa.querySelectorAll('.en-npc').forEach((b) => {
      const n = lista.filter((x) => x === b.dataset.id).length;
      b.classList.toggle('on', n > 0);
      b.classList.toggle('lleno', lleno);
      b.querySelector('i').textContent = n > 1 ? '×' + n : n ? '1' : '';
      b.setAttribute('aria-label', `${b.querySelector('b').textContent}${n ? `: ${n}` : ''}`);
    });
    capa.querySelector('[data-azar-n]').textContent = alAzar;
    capa.querySelector('[data-azar="-1"]').disabled = alAzar <= 0;
    capa.querySelector('[data-azar="1"]').disabled = lleno;
    capa.querySelector('[data-cuenta]').innerHTML = total() ? `<b>${total()}</b> de ${max} bots` : `Sin bots · hasta ${max}`;
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
      if (e.target.closest('[data-menos]')) {
        const i = lista.lastIndexOf(id);
        if (i >= 0) lista.splice(i, 1);
      } else if (total() < max) lista.push(id);
      pintar();
    } else if (e.target.closest('[data-azar]')) {
      alAzar = Math.max(0, Math.min(max - lista.length, alAzar + Number(e.target.closest('[data-azar]').dataset.azar)));
      pintar();
    } else if (e.target.closest('[data-vaciar]')) {
      lista = [];
      alAzar = 0;
      pintar();
    } else if (e.target.closest('[data-listo]')) {
      cerrar();
      alGuardar({ ids: [...lista], azar: alAzar });
    } else if (e.target === capa || e.target.closest('[data-cerrar]')) cerrar();
  });
  document.addEventListener('keydown', tecla, true);
  document.body.append(capa);
  pintar();
  capa.querySelector('[data-listo]').focus();
}

// Botón "Agregar bots" para las pantallas de crear partida: guarda lo elegido hasta que se crea la sala.
export function botonAgregarBots(boton, { max = 8, azar = 0, ids = [], color } = {}) {
  const estado = { ids: [...ids], azar };
  const pintar = () => (boton.textContent = textoBots(estado.ids.length + estado.azar));
  boton.type = 'button';
  boton.onclick = () => abrirAgregarBots({ ...estado, max, color, alGuardar: (r) => { Object.assign(estado, r); pintar(); } });
  pintar();
  return { get bots() { return estado.ids.length + estado.azar; }, get npcs() { return [...estado.ids]; } };
}
// Lo que hace falta para abrir el selector desde una sala (con lo que ya tiene la sala).
export const botsDeSala = (e, maxPorDefecto) => ({ ids: e?.npcElegidos || [], azar: Math.max(0, (e?.bots || 0) - (e?.npcElegidos || []).length), max: e?.maxBots || maxPorDefecto });
