// Menú de pausa compartido: acciones claras para volver, ajustar la pantalla y salir.
const script = document.querySelector('script[src$="/comun/menu-esc.js"][data-juego]');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function estilos() {
  if (document.querySelector('#cl-esc-css')) return;
  const s = document.createElement('style');
  s.id = 'cl-esc-css';
  s.textContent = `
  .cl-esc{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:#0a0d0ac9;backdrop-filter:blur(10px);font-family:Barlow,Arial,sans-serif;color:#efede4}
  .cl-esc-caja{width:min(690px,100%);max-height:min(90vh,760px);overflow:auto;border:1px solid #c5f04a66;border-radius:24px;background:linear-gradient(140deg,#242b20,#141713 68%);box-shadow:0 30px 100px #000b;padding:26px;display:grid;gap:20px}
  .cl-esc-cabeza{display:flex;justify-content:space-between;align-items:start;gap:16px;border-bottom:1px solid #ffffff23;padding-bottom:17px}
  .cl-esc-cabeza small{display:block;color:#c5f04a;font:700 11px 'JetBrains Mono',monospace;letter-spacing:2px;text-transform:uppercase;margin-bottom:7px}
  .cl-esc-cabeza h2{font:900 clamp(32px,6vw,49px)/.9 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase;margin:0}
  .cl-esc-cerrar{width:40px;height:40px;flex:none;border:1px solid #ffffff37;background:#ffffff13;color:#fff;border-radius:10px;font-size:26px;cursor:pointer}
  .cl-esc-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .cl-esc-seccion{display:grid;align-content:start;gap:9px}.cl-esc-seccion h3{color:#aeb9a7;font:800 11px 'JetBrains Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 3px}
  .cl-esc-opcion{display:flex;align-items:center;gap:12px;width:100%;text-decoration:none;text-align:left;border:1px solid #ffffff20;background:#ffffff09;color:#f4f1ea;border-radius:12px;padding:12px;cursor:pointer;min-height:64px;font:inherit}
  .cl-esc-opcion:hover,.cl-esc-opcion:focus-visible{border-color:#c5f04a;background:#c5f04a13;outline:none}
  .cl-esc-opcion .icono{display:grid;place-items:center;width:39px;height:39px;flex:none;border-radius:9px;background:#ffffff14;font-size:19px}
  .cl-esc-opcion span:last-child{display:grid;gap:3px}.cl-esc-opcion b{font:800 17px 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase}.cl-esc-opcion small{color:#aeb9a7;font:500 12px Barlow,Arial,sans-serif;line-height:1.25}
  .cl-esc-opcion.principal{background:#c5f04a;color:#17210d;border-color:#c5f04a}.cl-esc-opcion.principal small{color:#385523}.cl-esc-opcion.principal .icono{background:#17210d1c}
  .cl-esc-opcion.salir{border-color:#ff6b5b66}.cl-esc-opcion.salir .icono{background:#ff6b5b24}
  .cl-esc-ayuda{border-radius:12px;background:#10160f;border:1px solid #ffffff21;padding:12px;color:#c9d3bf;font-size:13px;line-height:1.5}
  .cl-esc-pie{text-align:center;color:#8f9b89;font:600 11px 'JetBrains Mono',monospace}
  .cl-esc-btn{position:fixed;z-index:999;right:10px;bottom:10px;width:44px;height:44px;border-radius:12px;border:1px solid #ffffff33;background:#141413cf;color:#fff;font:800 18px system-ui;cursor:pointer}
  @media(max-width:600px){.cl-esc-caja{padding:18px}.cl-esc-grid{grid-template-columns:1fr}.cl-esc-opcion{min-height:56px}.cl-esc-seccion{gap:6px}}
  `;
  document.head.append(s);
}

let abierto = null;
export function menuEsc({ juego = 'Juego', volver = '/', boton = true } = {}) {
  estilos();
  const cerrar = () => { abierto?.remove(); abierto = null; };
  const abrir = () => {
    if (abierto) return cerrar();
    abierto = document.createElement('div');
    abierto.className = 'cl-esc';
    abierto.innerHTML = `<div class="cl-esc-caja" role="dialog" aria-modal="true" aria-label="Menú de pausa de ${esc(juego)}">
      <header class="cl-esc-cabeza"><div><small>${esc(juego)} · en pausa</small><h2>¿Qué querés hacer?</h2></div><button class="cl-esc-cerrar" data-cerrar aria-label="Cerrar menú">×</button></header>
      <div class="cl-esc-grid"><section class="cl-esc-seccion"><h3>Partida</h3>
        <button class="cl-esc-opcion principal" data-seguir><span class="icono">▶</span><span><b>Seguir jugando</b><small>Volvé a la partida donde la dejaste.</small></span></button>
        <button class="cl-esc-opcion" data-copiar><span class="icono">↗</span><span><b>Invitar a alguien</b><small>Copiá el enlace de esta partida.</small></span></button>
        ${window.__reiniciar?.puede?.() ? '<button class="cl-esc-opcion" data-reiniciar><span class="icono">↻</span><span><b>Reiniciar partida</b><small>Todos vuelven a la configuración de la partida para armarla de nuevo.</small></span></button>' : ''}
        ${(window.__lobby?.miembros || 0) >= 2 ? (window.__lobby.soyLider ? '<button class="cl-esc-opcion" data-cambiar-juego><span class="icono">⇄</span><span><b>Cambiar de juego</b><small>Elegí otro juego y entran todos los de tu lobby juntos.</small></span></button>' : `<div class="cl-esc-opcion" aria-disabled="true" style="opacity:.6;cursor:default"><span class="icono">⇄</span><span><b>Cambiar de juego</b><small>Lo elige ${esc(window.__lobby.lider || 'el líder')}, el líder de tu lobby.</small></span></div>`) : ''}
        <a class="cl-esc-opcion salir" href="${esc(volver)}"><span class="icono">↩</span><span><b>Salir de la partida</b><small>Volvé al menú de ${esc(juego)}.</small></span></a>
      </section><section class="cl-esc-seccion"><h3>Pantalla y sonido</h3>
        <button class="cl-esc-opcion" data-audio><span class="icono">♪</span><span><b>Sonido</b><small data-audio-estado></small></span></button>
        <button class="cl-esc-opcion" data-pantalla><span class="icono">⛶</span><span><b>Pantalla completa</b><small>Ampliá el juego para verlo mejor.</small></span></button>
        ${juego === 'Battle Shmitz' ? '<button class="cl-esc-opcion" data-camara><span class="icono">◉</span><span><b>Vista de cámara</b><small data-camara-estado></small></span></button>' : ''}
        <div class="cl-esc-ayuda"><b>Atajos</b><br>Esc: abrí o cerrá este menú. Enter: chat, si el juego tiene uno. Los controles de cada juego aparecen en su pantalla de inicio.</div>
        <a class="cl-esc-opcion" href="/"><span class="icono">⌂</span><span><b>Ir a cadalado</b><small>Explorá todos los juegos del club.</small></span></a>
      </section></div><div class="cl-esc-pie">También podés tocar fuera del panel para seguir.</div></div>`;
    abierto.querySelector('[data-cambiar-juego]')?.addEventListener('click', () => { cerrar(); import('./cambiar-juego.js').then((m) => m.abrirCambiarJuego()); });
    abierto.querySelector('[data-reiniciar]')?.addEventListener('click', () => { if (confirm('¿Reiniciar la partida? Todos vuelven a la configuración.')) { window.__reiniciar?.hacer?.(); cerrar(); } });
    abierto.addEventListener('click', e => { if (e.target === abierto || e.target.closest('[data-seguir],[data-cerrar]')) cerrar(); });
    abierto.querySelector('[data-audio-estado]').textContent = localStorage.getItem('cadalado.audio') === 'silencio' ? 'Apagado · tocá para activarlo' : 'Activado · tocá para silenciarlo';
    abierto.querySelector('[data-audio]').onclick = () => {
      const silencio = localStorage.getItem('cadalado.audio') === 'silencio';
      localStorage.setItem('cadalado.audio', silencio ? 'activo' : 'silencio');
      abierto.querySelector('[data-audio-estado]').textContent = silencio ? 'Activado · tocá para silenciarlo' : 'Apagado · tocá para activarlo';
    };
    abierto.querySelector('[data-pantalla]').onclick = () => document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {});
    if (juego === 'Battle Shmitz') {
      const estado = abierto.querySelector('[data-camara-estado]');
      const actualizar = () => { estado.textContent = localStorage.getItem('cadalado.royale.camara') === 'tercera' ? 'Tercera persona · tocá para vista superior' : 'Vista superior · tocá para tercera persona'; };
      actualizar();
      abierto.querySelector('[data-camara]').onclick = () => { const modo = localStorage.getItem('cadalado.royale.camara') === 'tercera' ? 'superior' : 'tercera'; localStorage.setItem('cadalado.royale.camara', modo); dispatchEvent(new CustomEvent('cadalado:camara', { detail: modo })); actualizar(); };
    }
    abierto.querySelector('[data-copiar]').onclick = async () => { try { await navigator.clipboard.writeText(location.href); abierto.querySelector('[data-copiar] small').textContent='Enlace copiado · mandáselo a tus amigos'; } catch { abierto.querySelector('[data-copiar] small').textContent='Copiá la URL de la barra del navegador'; } };
    document.body.append(abierto);
    abierto.querySelector('[data-seguir]').focus();
  };
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select') && !abierto) return e.target.blur();
    e.preventDefault(); abierto ? cerrar() : abrir();
  });
  if (boton) {
    const b = document.createElement('button');
    b.className = 'cl-esc-btn'; b.title = 'Pausa (Esc)'; b.setAttribute('aria-label', 'Pausa'); b.textContent = '❚❚';
    b.onclick = abrir; document.body.append(b);
  }
  return { abrir, cerrar };
}

if (script?.dataset?.juego) menuEsc({ juego: script.dataset.juego, volver: script.dataset.volver || '/', boton: script.dataset.boton !== 'no' });
