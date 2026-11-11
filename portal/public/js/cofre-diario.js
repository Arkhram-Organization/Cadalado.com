// Cofre diario de la tienda: se abre una vez por día y sale una skin de un pool de 12 (estilo cajas de CS:GO).
// El servidor sortea; acá va el show: el cofre tiembla y se abre, gira la ruleta de cartas y se revela la skin.
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const ORDEN = ['mitica', 'legendaria', 'epica', 'rara', 'comun'];
const pct = (p) => (p * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%';

// El cofre dorado (SVG): cuerpo, tapa y candado; la tapa se anima aparte.
export function cofreSvg(clase = '') {
  return `<svg class="cd-cofre ${clase}" viewBox="0 0 220 170" aria-hidden="true">
    <defs>
      <linearGradient id="cdOro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset=".45" stop-color="#f2b52c"/><stop offset="1" stop-color="#a8660f"/></linearGradient>
      <linearGradient id="cdOroT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="1" stop-color="#e09a1e"/></linearGradient>
      <radialGradient id="cdLuz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff8d0"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="cd-luz" cx="110" cy="70" rx="100" ry="70" fill="url(#cdLuz)"/>
    <g class="cd-cuerpo">
      <rect x="18" y="72" width="184" height="88" rx="10" fill="url(#cdOro)" stroke="#6b3f08" stroke-width="4"/>
      <rect x="18" y="96" width="184" height="10" fill="#c27c14" opacity=".6"/>
      <rect x="18" y="132" width="184" height="10" fill="#c27c14" opacity=".6"/>
      <rect x="30" y="72" width="12" height="88" fill="#2b2b30" opacity=".85"/><rect x="178" y="72" width="12" height="88" fill="#2b2b30" opacity=".85"/>
      <circle cx="110" cy="118" r="22" fill="#2b2b30" stroke="#ffe58a" stroke-width="3"/>
      <text x="110" y="127" text-anchor="middle" font-family="Barlow Condensed, Impact, sans-serif" font-weight="900" font-size="26" fill="#ffe58a">?</text>
    </g>
    <g class="cd-tapa">
      <path d="M14 74 Q14 34 54 30 L166 30 Q206 34 206 74 Z" fill="url(#cdOroT)" stroke="#6b3f08" stroke-width="4"/>
      <path d="M30 44 L190 44" stroke="#c27c14" stroke-width="5" opacity=".55"/>
      <rect x="30" y="31" width="12" height="43" fill="#2b2b30" opacity=".85"/><rect x="178" y="31" width="12" height="43" fill="#2b2b30" opacity=".85"/>
      <rect x="98" y="58" width="24" height="26" rx="4" fill="#2b2b30" stroke="#ffe58a" stroke-width="2.5"/>
      <path d="M103 60 v-8 a7 7 0 0 1 14 0 v8" fill="none" stroke="#ffe58a" stroke-width="3"/>
    </g>
  </svg>`;
}

export function montarCofre({ datos, rarezas, api, pid, portada, nombre, frase, usar, toast, alActualizar }) {
  const capa = document.createElement('div');
  capa.className = 'cd-capa'; capa.hidden = true;
  document.body.append(capa);
  let girando = false, reloj = 0;

  const rz = (id) => datos().skins.find((s) => s.id === id)?.rareza || 'comun';
  const color = (r) => rarezas()[r]?.color || '#9aa4ad';
  const carta = (id, extra = '') => `<div class="cd-carta r-${rz(id)} ${extra}" style="--r:${color(rz(id))}"><img src="${portada(id)}" alt="" draggable="false"><b>${nombre(id)}</b></div>`;

  function falta(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  // el botón de la cabecera
  function pintarBoton() {
    const c = datos()?.cofre, b = $('[data-cofre-estado]');
    if (!c || !b) return;
    b.textContent = c.disponible ? '¡Abrilo!' : 'En ' + falta(c.proximo - Date.now());
    $('[data-cofre-abrir]')?.classList.toggle('listo', c.disponible);
  }
  setInterval(pintarBoton, 1000);

  // 1) el cofre y lo que puede salir
  function vistaPrevia() {
    const c = datos().cofre;
    const grupos = ORDEN.map((r) => ({ r, ids: c.pool.filter((id) => rz(id) === r) })).filter((g) => g.ids.length);
    capa.innerHTML = `<div class="cd-caja">
      <button class="cd-cerrar" data-cd-cerrar aria-label="Cerrar">×</button>
      <div class="cd-cabeza">
        <div class="cd-cofre-wrap">${cofreSvg()}</div>
        <div><small class="cd-etq">Una vez por día · gratis</small><h2>Cofre diario</h2>
          <p class="cd-sub">Te toca una de estas 12 skins. Cuanto más exclusiva, más difícil.</p>
          <p class="cd-garantia">${c.garantiaEn <= 1 ? '<b>¡La próxima es legendaria o mejor!</b>' : `Legendaria o mejor garantizada en <b>${c.garantiaEn}</b> aperturas como mucho.`} Si te sale una que ya tenés, son <b>${fmt(c.repetida)} fichas</b>.</p>
        </div>
      </div>
      <div class="cd-pool">${grupos.map((g) => `<div class="cd-grupo" style="--r:${color(g.r)}"><span>${rarezas()[g.r]?.nombre || g.r} · ${pct(c.probabilidades[g.r])}</span><div>${g.ids.map((id) => carta(id, datos().mias.includes(id) ? 'tenida' : '')).join('')}</div></div>`).join('')}</div>
      <div class="cd-pie">${c.disponible ? '<button class="cd-boton" data-cd-abrir>Abrir cofre</button>'
        : `<span class="cd-espera">Ya lo abriste hoy${c.ultimo?.skin ? `: te salió <b style="color:${color(rz(c.ultimo.skin))}">${nombre(c.ultimo.skin)}</b>` : ''}. Volvé en <b data-cd-falta>${falta(c.proximo - Date.now())}</b></span>`}</div>
    </div>`;
    clearInterval(reloj);
    reloj = setInterval(() => { const el = $('[data-cd-falta]', capa); if (el) el.textContent = falta(datos().cofre.proximo - Date.now()); }, 1000);
  }

  // la tira de la ruleta: al azar con las mismas probabilidades, el premio en su lugar y a veces una buena al lado
  function armarTira(ganador) {
    const c = datos().cofre, N = 64, W = 56;
    const por = {}; for (const id of c.pool) (por[rz(id)] ??= []).push(id);
    const hay = ORDEN.filter((r) => por[r]);
    const tirar = () => { let x = Math.random() * hay.reduce((n, r) => n + c.probabilidades[r], 0); for (const r of hay) { x -= c.probabilidades[r]; if (x < 0) return por[r][Math.floor(Math.random() * por[r].length)]; } return por.comun?.[0] || c.pool[0]; };
    const tira = Array.from({ length: N }, tirar);
    tira[W] = ganador;
    const buenas = [...(por.mitica || []), ...(por.legendaria || [])];
    if (Math.random() < 0.55 && buenas.length) tira[W + (Math.random() < 0.5 ? 1 : -1)] = buenas[Math.floor(Math.random() * buenas.length)]; // ¡casi!
    return { tira, W };
  }

  // 2) abrir: tiembla, se abre, gira
  async function abrir() {
    if (girando) return;
    girando = true;
    const caja = $('.cd-caja', capa);
    caja.scrollTop = 0; caja.classList.add('abriendo');
    let r;
    try { r = await api('/api/club/tienda/cofre', { pid: pid() }); }
    catch (e) { girando = false; caja.classList.remove('abriendo'); toast(e.message, true); return; }
    await new Promise((ok) => setTimeout(ok, 1400)); // el cofre termina de abrirse
    const { tira, W } = armarTira(r.skin);
    capa.innerHTML = `<div class="cd-ruleta">
      <div class="cd-ventana"><div class="cd-tira">${tira.map((id) => carta(id)).join('')}</div><i class="cd-linea"></i></div>
      <p class="cd-girando">Girando…</p></div>`;
    const tiraEl = $('.cd-tira', capa), ventana = $('.cd-ventana', capa);
    const ancho = tiraEl.children[0].getBoundingClientRect().width + 10;
    const destino = W * ancho + ancho / 2 - ventana.clientWidth / 2 + (Math.random() - 0.5) * (ancho * 0.7);
    requestAnimationFrame(() => requestAnimationFrame(() => { tiraEl.style.transform = `translateX(${-destino}px)`; }));
    // tic-tic: la línea se ilumina cada vez que pasa una carta
    let ultimo = -1;
    const tic = () => {
      if (!tiraEl.isConnected) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(tiraEl).transform);
      const i = Math.floor((-m.m41 + ventana.clientWidth / 2) / ancho);
      if (i !== ultimo) { ultimo = i; const l = $('.cd-linea', capa); l?.classList.remove('tic'); void l?.offsetWidth; l?.classList.add('tic'); }
      if (girando) requestAnimationFrame(tic);
    };
    requestAnimationFrame(tic);
    await new Promise((ok) => setTimeout(ok, 7200));
    tiraEl.children[W]?.classList.add('gano');
    await new Promise((ok) => setTimeout(ok, 700));
    girando = false;
    revelar(r);
    alActualizar(r);
  }

  // 3) la revelación
  function revelar(r) {
    const col = color(r.rareza), top = r.rareza === 'mitica' || r.rareza === 'legendaria';
    capa.innerHTML = `<div class="cd-revela r-${r.rareza}" style="--r:${col}">
      <div class="cd-destello"></div><div class="cd-rayos"></div>
      ${top ? `<div class="cd-confeti">${Array.from({ length: 70 }, (_, i) => `<i style="--x:${Math.random() * 100}%;--d:${(Math.random() * 1.6).toFixed(2)}s;--c:${['#ffd23f', '#ff5fa8', '#4fd1ff', '#c5f04a', '#ffffff', col][i % 6]};--g:${Math.round(Math.random() * 720 - 360)}deg"></i>`).join('')}</div>` : ''}
      <div class="cd-premio">
        <small class="cd-etq">${r.garantizada ? '¡Garantía cumplida!' : r.rareza === 'mitica' ? '¡¡MÍTICA!!' : r.rareza === 'legendaria' ? '¡Legendaria!' : 'Te tocó'}</small>
        <div class="cd-carta-grande">${carta(r.skin)}</div>
        <h2>${nombre(r.skin)}</h2>
        <span class="cd-chip">${rarezas()[r.rareza]?.nombre || r.rareza}</span>
        ${frase(r.skin) ? `<p class="cd-frase">“${frase(r.skin)}”</p>` : ''}
        ${r.repetida ? `<p class="cd-repetida">Ya la tenías: te llevás <b>+${fmt(r.fichas)} fichas</b>.</p>` : ''}
        <div class="cd-acciones">${r.repetida ? '' : `<button class="cd-boton" data-cd-usar="${r.skin}">Usarla ya</button>`}<button class="cd-boton gris" data-cd-cerrar>Listo</button></div>
      </div></div>`;
  }

  function mostrar() { if (!datos()?.cofre) return; capa.hidden = false; vistaPrevia(); }
  function cerrar() { if (girando) return; capa.hidden = true; clearInterval(reloj); }
  capa.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cd-cerrar]') || e.target === capa) return cerrar();
    if (e.target.closest('[data-cd-abrir]')) return abrir();
    const u = e.target.closest('[data-cd-usar]');
    if (u) { await usar(u.dataset.cdUsar); cerrar(); }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !capa.hidden) cerrar(); });
  return { mostrar, pintarBoton };
}
