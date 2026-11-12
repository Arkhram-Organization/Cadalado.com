// Lobbys compartidas: tu grupo, invitar amigos, unirte a la lobby de un amigo o a una abierta (con la flechita)
// y que el líder arranque el juego para todos. Habla con /api/club/grupo y /api/club/grupos.
import { api, esc, toast } from './comun.js';
import { avatarSvg, lookDeNombre } from '/comun/avatar.js';
import { lookParaDibujo } from '/comun/look.js';
import { JUEGOS } from './datos.js';

const PID_KEY = 'cadalado.pid'; // el mismo que usan los juegos
function pid() {
  try {
    let p = localStorage.getItem(PID_KEY);
    if (!p || !/^[A-Za-z0-9_-]{8,64}$/.test(p)) {
      p = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 56]).join('');
      localStorage.setItem(PID_KEY, p);
    }
    return p;
  } catch { return 'anon' + Math.random().toString(36).slice(2, 12); }
}
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const flecha = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const cara = (m) => `<span class="gr-cara">${avatarSvg(m.look ? lookParaDibujo(m.look) : lookDeNombre(m.nombre))}</span>`;

// Juegos donde el líder puede armar la sala para todos (los demás se suman con el link).
// /royale/sala/ABC → /royale/?sala=ABC: esa dirección siempre la sirve el hosting (el juego acomoda la URL solo)
const aIndice = (url) => String(url).replace(/^\/([a-z]{3,12})\/(sala|mesa)\/([A-Za-z0-9-]{3,24})\/?$/, '/$1/?$2=$3');
const SALAS = {
  truco: () => ({ api: '/api/truco/rooms', url: '/truco/sala/', directo: true, opciones: { mode: '3v3', target: 30, isPublic: false } }),
  ajedrez: () => ({ api: '/ajedrez/api/games', url: '/ajedrez/game/', directo: true, opciones: { tc: '10+0', color: 'w' } }),
  royale: (o) => ({ api: '/api/royale/crear', url: '/royale/sala/', opciones: { bots: 7, publica: false, ...o } }),
  carrera: (o) => ({ api: '/api/carrera/crear', url: '/carrera/sala/', opciones: { bots: 5, publica: false, ...o } }),
  memes: (o) => ({ api: '/api/memes/crear', url: '/memes/sala/', opciones: { bots: 2, publica: false, ...o } }),
  haxball: (o) => ({ api: '/api/haxball/crear', url: '/haxball/sala/', opciones: { bots: 1, publica: false, ...o } }),
  casino: (o) => ({ api: '/api/casino/crear', url: '/casino/mesa/', opciones: { tipo: 'blackjack', publica: false, ...o } }),
};

export function montarGrupo({ usuario, nombre, alCambiar, juegoElegido, irA }) {
  const yo = () => ({ pid: pid(), nombre: usuario?.nombre || nombre(), look: usuario?.look || leer('cadalado.look', null) });
  const q = () => { const y = yo(); return `pid=${encodeURIComponent(y.pid)}&nombre=${encodeURIComponent(y.nombre)}${y.look ? '&look=' + encodeURIComponent(JSON.stringify(y.look)) : ''}`; };
  let grupo = null, listas = { abiertos: [], amigos: [] }, desde = Date.now() - 60_000, irVisto = Number(sessionStorage.getItem('cadalado.grupo.ir')) || 0, abierto = false;
  const vistas = new Set();
  let revision = 0, consultando = false, accionesPendientes = 0;

  window.__grupoLobby = true; // la portada sigue al grupo con su propio panel
  // ---------- panel
  const panel = document.createElement('aside');
  panel.className = 'gr-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Lobbys');
  document.body.append(panel);
  const fondo = document.createElement('div'); fondo.className = 'gr-fondo'; fondo.hidden = true; document.body.append(fondo);
  fondo.onclick = () => mostrar(false);
  function mostrar(v = !abierto) {
    abierto = v; panel.hidden = fondo.hidden = !v;
    if (v) { cargarListas(); pintar(); }
  }

  async function accion(datos) {
    revision++; accionesPendientes++;
    try {
      const r = await api('/api/club/grupo', { ...yo(), ...datos });
      grupo = r.grupo; if (grupo) grupo.relojOffset = (r.now || Date.now()) - Date.now(); pintar(); alCambiar?.(grupo);
      return grupo;
    } catch (e) { toast(e.message, true); return null; } finally { revision++; accionesPendientes--; }
  }
  async function refrescar() {
    if (consultando || accionesPendientes) return;
    consultando = true;
    const rev = revision;
    try {
      const r = await api('/api/club/grupo?' + q() + '&desde=' + desde);
      if (rev !== revision) return;
      const antes = grupo;
      grupo = r.grupo; if (grupo) grupo.relojOffset = (r.now || Date.now()) - Date.now();
      for (const inv of r.invitaciones || []) {
        desde = Math.max(desde, inv.ts);
        if (vistas.has(inv.ts)) continue;
        vistas.add(inv.ts);
        invitacion(inv);
      }
      // el líder arrancó: se van todos
      if (grupo?.ir && grupo.ir.ts > irVisto && (r.now || Date.now()) - grupo.ir.ts < 60000 && !grupo.soyLider && location.pathname !== grupo.ir.url) {
        irVisto = grupo.ir.ts;
        sessionStorage.setItem('cadalado.grupo.ir', String(irVisto));
        toast('¡Arranca el juego! Te llevamos con tu lobby…');
        setTimeout(() => (location.href = aIndice(grupo.ir.url)), 900);
      }
      if (JSON.stringify(antes) !== JSON.stringify(grupo)) { pintar(); alCambiar?.(grupo); }
    } catch {} finally { consultando = false; }
  }
  async function cargarListas() {
    try {
      const [l, sug] = await Promise.all([api('/api/club/grupos?' + q()), usuario ? api('/api/club/sugeridos').catch(() => null) : null]);
      listas = { ...l, sugeridos: sug };
      if (!panel.contains(document.activeElement) || !document.activeElement.matches('input')) pintar();
    } catch {}
  }
  function invitacion(inv) {
    const t = document.createElement('div');
    t.className = 'gr-invitacion';
    t.innerHTML = `<b>${esc(inv.de)}</b> te invitó a su lobby <button class="gr-btn lima" data-si>Unirme ${flecha}</button><button class="gr-btn" data-no>Ahora no</button>`;
    document.body.append(t);
    t.querySelector('[data-si]').onclick = () => { t.remove(); accion({ accion: 'unirse', id: inv.grupo }); };
    t.querySelector('[data-no]').onclick = () => t.remove();
    setTimeout(() => t.remove(), 20_000);
  }

  function filaLobby(g, etiqueta) {
    return `<div class="gr-fila"><div class="gr-caras">${g.miembros.slice(0, 4).map(cara).join('')}</div>
      <div class="gr-txt"><b>${esc(etiqueta || 'Lobby de ' + g.lider)}</b><small>${g.miembros.length} ${g.miembros.length === 1 ? 'persona' : 'personas'} · ${esc(g.juego || '')}${g.lleno ? ' · llena' : ''}</small></div>
      <button class="gr-flecha" data-unirse="${g.id}" ${g.lleno ? 'disabled' : ''} title="Meterme a esta lobby" aria-label="Meterme a la lobby de ${esc(g.lider)}">${flecha}</button></div>`;
  }
  // Agregar amigos: por usuario, o de los sugeridos (con quién jugaste hace poco y amigos de tus amigos)
  const hace = (ts) => { const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? `hace ${Math.max(1, m)} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  const botonAmigo = (p) => p.estado === 'enviada' ? '<button class="gr-btn" disabled>Enviada</button>'
    : p.estado === 'recibida' ? `<button class="gr-btn lima" data-amigo="aceptar" data-u="${esc(p.usuario)}">Aceptar</button>`
    : `<button class="gr-btn" data-amigo="pedir" data-u="${esc(p.usuario)}">Agregar</button>`;
  const filaSugerido = (p, detalle) => `<div class="gr-fila">${cara(p)}<div class="gr-txt"><b>${esc(p.nombre)}</b><small>@${esc(p.usuario)} · ${detalle}${p.enLinea ? ' · en línea' : ''}</small></div>${botonAmigo(p)}</div>`;
  function seccionAgregar() {
    const sug = { recientes: [], conocidos: [], enLinea: [], ...(listas.sugeridos || {}) };
    return `<section><h3>Agregar amigos</h3>
      <form class="gr-agregar" data-agregar><input name="usuario" placeholder="Usuario de tu amigo" autocomplete="off" maxlength="24" spellcheck="false"><button class="gr-btn lima">Agregar</button></form>
      ${sug.recientes.length ? `<h4 class="gr-sub">Jugaste hace poco</h4>${sug.recientes.map((p) => filaSugerido(p, hace(p.cuando))).join('')}` : ''}
      ${sug.conocidos.length ? `<h4 class="gr-sub">Quizás los conozcas</h4>${sug.conocidos.map((p) => filaSugerido(p, `${p.comunes} ${p.comunes === 1 ? 'amigo' : 'amigos'} en común`)).join('')}` : ''}
      ${sug.enLinea.length ? `<h4 class="gr-sub">En línea ahora (${sug.enLinea.length})</h4>${sug.enLinea.map((p) => filaSugerido({ ...p, enLinea: false }, 'en línea')).join('')}` : ''}
      ${!sug.recientes.length && !sug.conocidos.length && !sug.enLinea.length ? '<p class="gr-vacio">Cuando juegues con gente del club, te la vamos a sugerir acá.</p>' : ''}
    </section>`;
  }
  async function pedirAmistad(accionA, usuarioOtro) {
    try {
      const r = await api('/api/club/amigos', { accion: accionA, usuario: usuarioOtro });
      toast(r.estado === 'amigo' ? `¡Ahora son amigos!` : 'Solicitud enviada');
      cargarListas();
      return true;
    } catch (e) { toast(e.message, true); return false; }
  }

  function pintar() {
    if (!abierto || !grupo) return;
    const link = `${location.origin}/?lobby=${grupo.id}`;
    const amigos = listas.amigos || [];
    panel.innerHTML = `
      <header><h2>Lobbys</h2><button class="gr-cerrar" data-cerrar aria-label="Cerrar">×</button></header>
      <section><h3>Tu lobby <span class="mono">${grupo.id}</span></h3>
        <ul class="gr-miembros">${grupo.miembros.map((m) => `<li>${cara(m)}<span>${esc(m.nombre)}${m.yo ? ' <small>vos</small>' : ''}</span>${m.lider ? '<em>líder</em>' : grupo.soyLider ? `<button class="gr-btn" data-echar="${esc(m.nombre)}">Sacar</button>` : ''}</li>`).join('')}</ul>
        <div class="gr-acciones">
          ${grupo.soyLider ? `<label class="gr-switch"><input type="checkbox" data-abierto ${grupo.abierto ? 'checked' : ''}><span></span>Abierta a cualquiera</label>` : ''}
          <button class="gr-btn" data-link>Copiar link de invitación</button>
          ${grupo.miembros.length > 1 ? '<button class="gr-btn" data-salir>Salir de la lobby</button>' : ''}
        </div>
        ${grupo.miembros.length > 1 ? `<div class="gr-config"><h3>Próxima partida</h3><p>${grupo.soyLider ? 'Elegí el juego y prepará la sala para toda tu lobby.' : 'El líder elige el juego y configura la sala. Vas a entrar con el grupo.'}</p>
          <label>Juego<select class="gr-select" data-gr-juego ${grupo.soyLider ? '' : 'disabled'}>${JUEGOS.filter(j=>j.estado==='disponible').map(j=>`<option value="${j.id}" ${grupo.juego===j.id?'selected':''}>${esc(j.nombre)}</option>`).join('')}</select></label>
          ${grupo.juego==='casino'?`<label>Mesa<select class="gr-select" data-gr-config="tipo" ${grupo.soyLider?'':'disabled'}>${[['blackjack','Blackjack'],['ruleta','Ruleta'],['slots','Tragamonedas']].map(([id,n])=>`<option value="${id}" ${grupo.config?.tipo===id?'selected':''}>${n}</option>`).join('')}</select></label>`:''}
          ${['royale','carrera','memes','haxball'].includes(grupo.juego)?`<label>Bots<input class="gr-select" type="number" min="0" max="${grupo.juego==='royale'?15:grupo.juego==='haxball'?8:15}" value="${grupo.config?.bots??0}" data-gr-config="bots" ${grupo.soyLider?'':'disabled'}></label>`:''}
          ${grupo.juego==='haxball'?`<label>Minutos<input class="gr-select" type="number" min="0" max="30" value="${grupo.config?.minutos??3}" data-gr-config="minutos" ${grupo.soyLider?'':'disabled'}></label><label>Goles para ganar<input class="gr-select" type="number" min="0" max="30" value="${grupo.config?.goles??3}" data-gr-config="goles" ${grupo.soyLider?'':'disabled'}></label>`:''}
          ${grupo.soyLider?'<button class="gr-btn lima" data-gr-jugar>Armar sala y entrar todos</button>':'<span class="gr-vacio">Esperando al líder…</span>'}
        </div>`:''}
      </section>
      <section><h3>Amigos</h3>
        ${usuario ? (amigos.length ? amigos.map((a) => `<div class="gr-fila">${cara(a)}<div class="gr-txt"><b>${esc(a.nombre)}</b><small>${a.grupo ? (a.grupo.id === grupo.id ? 'En tu lobby' : `En una lobby de ${a.grupo.miembros.length}`) : a.enLinea ? 'En línea' : 'Desconectado'}</small></div>
          ${a.grupo && a.grupo.id !== grupo.id ? `<button class="gr-flecha" data-unirse="${a.grupo.id}" title="Meterme a su lobby" aria-label="Meterme a la lobby de ${esc(a.nombre)}">${flecha}</button>` : ''}
          ${!a.grupo || a.grupo.id !== grupo.id ? `<button class="gr-btn" data-invitar="${esc(a.usuario)}">Invitar</button>` : ''}</div>`).join('') : '<p class="gr-vacio">Todavía no sumaste amigos. Agregalos acá abajo.</p>')
          : '<p class="gr-vacio"><a href="/entrar">Entrá con tu cuenta</a> para ver a tus amigos e invitarlos. Mientras, mandales el link.</p>'}
      </section>
      ${usuario ? seccionAgregar() : ''}
      <section><h3>Lobbys abiertas</h3>
        ${(listas.abiertos || []).length ? listas.abiertos.map((g) => filaLobby(g)).join('') : '<p class="gr-vacio">No hay lobbys abiertas ahora. Abrí la tuya y que se sume gente.</p>'}
      </section>`;
    panel.querySelector('[data-cerrar]').onclick = () => mostrar(false);
    panel.querySelector('[data-agregar]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = e.currentTarget.usuario.value.trim().replace(/^@/, '');
      if (v && (await pedirAmistad('pedir', v))) e.currentTarget.usuario.value = '';
    });
    panel.querySelectorAll('[data-amigo]').forEach((b) => (b.onclick = async () => { b.disabled = true; if (!(await pedirAmistad(b.dataset.amigo, b.dataset.u))) b.disabled = false; }));
    panel.querySelector('[data-abierto]')?.addEventListener('change', (e) => accion({ accion: 'abierto', valor: e.target.checked }));
    panel.querySelector('[data-gr-juego]')?.addEventListener('change',e=>accion({accion:'juego',juego:e.target.value}));
    panel.querySelectorAll('[data-gr-config]').forEach(el=>el.addEventListener('change',()=>accion({accion:'config',[el.dataset.grConfig]:el.type==='number'?Number(el.value):el.value})));
    panel.querySelector('[data-gr-jugar]')?.addEventListener('click',()=>jugar(grupo.juego,JUEGOS.find(j=>j.id===grupo.juego)?.url||'/'));
    panel.querySelector('[data-link]').onclick = () => { navigator.clipboard?.writeText(link); toast('Link copiado: el que lo abra entra a tu lobby.'); };
    panel.querySelector('[data-salir]')?.addEventListener('click', () => accion({ accion: 'salir' }));
    panel.querySelectorAll('[data-echar]').forEach((b) => (b.onclick = () => accion({ accion: 'echar', nombre: b.dataset.echar })));
    panel.querySelectorAll('[data-unirse]').forEach((b) => (b.onclick = async () => { if (await accion({ accion: 'unirse', id: b.dataset.unirse })) { toast('¡Entraste a la lobby!'); cargarListas(); } }));
    panel.querySelectorAll('[data-invitar]').forEach((b) => (b.onclick = async () => { if (await accion({ accion: 'invitar', usuario: b.dataset.invitar })) { b.textContent = 'Invitado'; b.disabled = true; toast('Invitación enviada'); } }));
  }

  // JUGAR: el líder arma la sala (si el juego lo permite) y se van todos
  async function jugar(juego, urlBase) {
    if (!grupo || grupo.miembros.length < 2) return irA(urlBase);
    if (!grupo.soyLider) return toast('Arranca el líder de la lobby.', true);
    if(grupo.juego!==juego && !await accion({accion:'juego',juego}))return;
    let url = urlBase;
    const s = SALAS[juego]?.(grupo.config||{});
    if (s) {
      try {
        const creada = await api(s.api, { pid: pid(), nombre: yo().nombre, name: yo().nombre, ...(s.directo ? s.opciones : { opciones: s.opciones }) });
        const code = creada.code || creada.id;
        if (!code) throw new Error('No se pudo confirmar la creación de la sala.');
        url = s.url + code;
      } catch (e) { return toast(e.message, true); }
    }
    const listo = await accion({ accion: 'jugar', url });
    if (listo) { sessionStorage.setItem('cadalado.grupo.ir', String(listo.ir.ts)); irA(aIndice(url)); }
  }

  // entrar con un link de invitación (?lobby=CODIGO)
  const porLink = new URLSearchParams(location.search).get('lobby');
  (async () => {
    if (porLink) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (await accion({ accion: 'unirse', id: porLink })) toast('¡Entraste a la lobby!');
    } else await refrescar();
    alCambiar?.(grupo);
  })();
  // Cada consulta cuesta (funciones y base de datos): con amigos en la lobby, casi 1 por segundo; solo, cada 2,5 s.
  // Al tocar algo (gesto, jugar, invitar) se consulta enseguida igual.
  let proxima = 0;
  setInterval(() => {
    if (document.hidden || Date.now() < proxima) return;
    proxima = Date.now() + ((grupo?.miembros?.length || 1) > 1 || abierto ? 900 : 2500);
    refrescar();
  }, 250);
  setInterval(() => { if (!document.hidden && abierto) cargarListas(); }, 8000);

  return {
    mostrar, jugar,
    get grupo() { return grupo; },
    gesto: (id) => grupo?.miembros.length > 1 && accion({ accion: 'gesto', gesto: id }),
    elegirJuego: (id) => grupo?.soyLider && grupo.miembros.length > 1 && accion({ accion: 'juego', juego: id }),
  };
}
