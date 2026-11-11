// Cofre diario de la tienda: se abre una vez por día y sale una skin sorpresa (estilo cajas de CS:GO).
// Lo de adentro cambia cada día y no se ve hasta abrirlo. El servidor sortea; acá va el show:
// el cofre 3D gira, acelera, salta y se abre con un haz de luz; pasa la ruleta de cartas y se revela la skin.
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const ORDEN = ['mitica', 'legendaria', 'epica', 'rara', 'comun'];
const pct = (p) => (p * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%';
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Ícono chico del cofre (botón de la cabecera, y de respaldo si no hay WebGL).
export function cofreSvg(clase = '') {
  return `<svg class="cd-cofre ${clase}" viewBox="0 0 220 170" aria-hidden="true">
    <defs>
      <linearGradient id="cdOro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset=".45" stop-color="#f2b52c"/><stop offset="1" stop-color="#a8660f"/></linearGradient>
      <linearGradient id="cdOroT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="1" stop-color="#e09a1e"/></linearGradient>
    </defs>
    <rect x="18" y="72" width="184" height="88" rx="10" fill="url(#cdOro)" stroke="#6b3f08" stroke-width="4"/>
    <rect x="30" y="72" width="12" height="88" fill="#2b2b30" opacity=".85"/><rect x="178" y="72" width="12" height="88" fill="#2b2b30" opacity=".85"/>
    <circle cx="110" cy="118" r="22" fill="#2b2b30" stroke="#ffe58a" stroke-width="3"/>
    <text x="110" y="127" text-anchor="middle" font-family="Barlow Condensed, Impact, sans-serif" font-weight="900" font-size="26" fill="#ffe58a">?</text>
    <path d="M14 74 Q14 34 54 30 L166 30 Q206 34 206 74 Z" fill="url(#cdOroT)" stroke="#6b3f08" stroke-width="4"/>
    <rect x="30" y="31" width="12" height="43" fill="#2b2b30" opacity=".85"/><rect x="178" y="31" width="12" height="43" fill="#2b2b30" opacity=".85"/>
    <rect x="98" y="58" width="24" height="26" rx="4" fill="#2b2b30" stroke="#ffe58a" stroke-width="2.5"/>
  </svg>`;
}

// ---------------------------------------------------------------- el cofre en 3D
async function cofre3d(canvas) {
  const THREE = await import('/comun/vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#fff3d6', '#3a2a10', 1.6));
  const sol = new THREE.DirectionalLight('#ffffff', 2.6); sol.position.set(3, 5, 4); escena.add(sol);
  const contra = new THREE.DirectionalLight('#ffd36a', 1.6); contra.position.set(-4, 2, -3); escena.add(contra);
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camara.position.set(0, 2.5, 7.4); camara.lookAt(0, 0.55, 0);

  const oro = new THREE.MeshStandardMaterial({ color: '#f2b52c', metalness: 0.75, roughness: 0.28 });
  const oroClaro = new THREE.MeshStandardMaterial({ color: '#ffe58a', metalness: 0.8, roughness: 0.2 });
  const negro = new THREE.MeshStandardMaterial({ color: '#26262c', metalness: 0.5, roughness: 0.45 });
  const caja = (w, h, d, mat, x, y, z, padre) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); padre.add(m); return m; };
  const cofre = new THREE.Group(); escena.add(cofre);
  // cuerpo con flejes negros, esquineros y remaches
  caja(2.4, 1.15, 1.6, oro, 0, 0.575, 0, cofre);
  for (const x of [-0.78, 0.78]) caja(0.2, 1.19, 1.66, negro, x, 0.575, 0, cofre);
  for (const x of [-1.2, 1.2]) for (const z of [-0.8, 0.8]) caja(0.16, 1.22, 0.16, oroClaro, x, 0.575, z, cofre);
  caja(2.46, 0.1, 1.66, oroClaro, 0, 0.05, 0, cofre); caja(2.46, 0.08, 1.66, oroClaro, 0, 1.12, 0, cofre);
  // el "?" brillante del frente
  const lienzo = document.createElement('canvas'); lienzo.width = lienzo.height = 128;
  const g = lienzo.getContext('2d'); g.fillStyle = '#26262c'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#ffe58a'; g.lineWidth = 7; g.stroke();
  g.fillStyle = '#ffe58a'; g.font = '900 86px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70);
  const tex = new THREE.CanvasTexture(lienzo); tex.colorSpace = THREE.SRGBColorSpace;
  const emblema = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffd36a', emissiveMap: tex, emissiveIntensity: 0.5 }));
  emblema.position.set(0, 0.56, 0.811); cofre.add(emblema);
  // tapa abovedada con bisagra atrás
  const bisagra = new THREE.Group(); bisagra.position.set(0, 1.15, -0.8); cofre.add(bisagra);
  const tapa = new THREE.Group(); tapa.position.set(0, 0, 0.8); bisagra.add(tapa);
  const boveda = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 28, 1, false, 0, Math.PI), oro); boveda.rotation.set(0, 0, Math.PI / 2); tapa.add(boveda); // media caña con el eje a lo ancho
  for (const x of [-0.78, 0.78]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 0.2, 28, 1, false, 0, Math.PI), negro); f.rotation.copy(boveda.rotation); f.position.x = x; tapa.add(f); }
  for (const x of [-1.2, 1.2]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.02, 28, 1, false, 0, Math.PI), oroClaro); t.rotation.copy(boveda.rotation); t.position.x = x; tapa.add(t); }
  caja(0.34, 0.4, 0.12, negro, 0, -0.02, 0.84, tapa); // candado
  // luz y haz de adentro
  const brillo = new THREE.PointLight('#fff2b0', 0, 12); brillo.position.set(0, 1.1, 0); cofre.add(brillo);
  const fondoLuz = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0 })); fondoLuz.rotation.x = -Math.PI / 2; fondoLuz.position.y = 1.1; cofre.add(fondoLuz);
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.75, 6, 28, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe58a', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  haz.position.y = 4.1; cofre.add(haz);
  // chispas
  const N = 140, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) vel.push({ x: 0, y: 0, z: 0, vida: 0 });
  const chispasGeo = new THREE.BufferGeometry(); chispasGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const chispasMat = new THREE.PointsMaterial({ color: '#ffe58a', size: 0.13, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const chispas = new THREE.Points(chispasGeo, chispasMat); escena.add(chispas);
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35 })); sombra.rotation.x = -Math.PI / 2; sombra.position.y = -0.02; escena.add(sombra);

  let estado = 'quieto', t = 0, tEstado = 0, giro = 0.5, velGiro = 0.7, vivo = true, ultimo = performance.now();
  function medir() { const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); }
  function estallar(color) {
    chispasMat.color.set(color); chispasMat.opacity = 1;
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, f = 1.5 + Math.random() * 3.5; vel[i] = { x: Math.cos(a) * f * 0.6, y: 3 + Math.random() * 5, z: Math.sin(a) * f * 0.6, vida: 0.9 + Math.random() * 0.8 }; pos[i * 3] = (Math.random() - 0.5) * 1.6; pos[i * 3 + 1] = 1.1; pos[i * 3 + 2] = (Math.random() - 0.5); }
  }
  function cuadro(ms) {
    if (!vivo || !canvas.isConnected) { vivo = false; renderer.dispose(); return; }
    requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ms - ultimo) / 1000); ultimo = ms; t += dt; tEstado += dt;
    let y = Math.sin(t * 2) * 0.08, inclina = 0, abre = 0;
    if (estado === 'quieto') velGiro += (0.7 - velGiro) * dt * 3;
    else if (estado === 'cargando') { // acelera, tiembla y pega saltitos
      velGiro += (16 - velGiro) * dt * 2.6;
      inclina = Math.sin(t * 38) * 0.07; y = Math.abs(Math.sin(tEstado * 9)) * 0.28;
      brillo.intensity = 4 + Math.sin(t * 30) * 2;
    } else if (estado === 'abre') { // frena de frente, salta y se abre
      velGiro *= Math.pow(0.0006, dt);
      const frente = Math.round(giro / (Math.PI * 2)) * Math.PI * 2 + 0.35;
      giro += (frente - giro) * Math.min(1, dt * 9);
      const k = Math.min(1, tEstado / 0.45);
      abre = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.12;
      y = Math.sin(Math.min(1, tEstado / 0.4) * Math.PI) * 0.5;
      brillo.intensity = 30 * k; fondoLuz.material.opacity = k; haz.material.opacity = 0.55 * k * (0.85 + Math.sin(t * 22) * 0.15);
      haz.scale.set(1 + Math.sin(t * 9) * 0.05, 0.2 + k * 0.8, 1 + Math.sin(t * 9) * 0.05);
    }
    giro += velGiro * dt;
    cofre.rotation.set(inclina * 0.5, giro, inclina); cofre.position.y = y;
    bisagra.rotation.x = -abre * 1.95;
    sombra.scale.setScalar(1 - y * 0.35);
    if (chispasMat.opacity > 0) {
      for (let i = 0; i < N; i++) { const v = vel[i]; if (v.vida <= 0) continue; v.vida -= dt; v.y -= 7 * dt; pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt; }
      chispasGeo.attributes.position.needsUpdate = true; chispasMat.opacity = Math.max(0, chispasMat.opacity - dt * 0.6);
    }
    renderer.render(escena, camara);
  }
  medir(); addEventListener('resize', medir);
  requestAnimationFrame(cuadro);
  return {
    cargar() { estado = 'cargando'; tEstado = 0; },
    abrir(color = '#ffe58a') { estado = 'abre'; tEstado = 0; haz.material.color.set(color); brillo.color.set(color); fondoLuz.material.color.set(color); estallar(color); },
    cerrar() { vivo = false; removeEventListener('resize', medir); },
  };
}

export function montarCofre({ datos, rarezas, api, pid, portada, nombre, frase, usar, toast, alActualizar }) {
  const capa = document.createElement('div');
  capa.className = 'cd-capa'; capa.hidden = true;
  document.body.append(capa);
  let girando = false, reloj = 0, tres = null, saltear = null;

  const skins = () => datos().skins;
  const rz = (id) => skins().find((s) => s.id === id)?.rareza || 'comun';
  const color = (r) => rarezas()[r]?.color || '#9aa4ad';
  const carta = (id, extra = '') => `<div class="cd-carta r-${rz(id)} ${extra}" style="--r:${color(rz(id))}"><img src="${portada(id)}" alt="" draggable="false"><b>${nombre(id)}</b></div>`;
  const falta = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  function pintarBoton() {
    const c = datos()?.cofre, b = $('[data-cofre-estado]');
    if (!c || !b) return;
    b.textContent = c.disponible ? '¡Abrilo!' : 'En ' + falta(c.proximo - Date.now());
    $('[data-cofre-abrir]')?.classList.toggle('listo', c.disponible);
  }
  setInterval(pintarBoton, 1000);

  // 1) el cofre girando (sin mostrar qué hay adentro)
  async function vista() {
    const c = datos().cofre;
    capa.innerHTML = `<div class="cd-escena">
      <button class="cd-cerrar" data-cd-cerrar aria-label="Cerrar">×</button>
      <small class="cd-etq">Una vez por día · gratis</small>
      <h2>Cofre diario</h2>
      <div class="cd-tres"><div class="cd-aura"></div><canvas></canvas></div>
      <p class="cd-sub">Adentro hay una skin sorpresa. Lo que guarda cambia todos los días.</p>
      <div class="cd-prob">${ORDEN.map((r) => `<span style="--r:${color(r)}"><i></i>${rarezas()[r]?.nombre || r} <b>${pct(c.probabilidades[r])}</b></span>`).join('')}</div>
      <p class="cd-garantia">${c.garantiaEn <= 1 ? '<b>¡La próxima es legendaria o mejor!</b>' : `Legendaria o mejor garantizada en <b>${c.garantiaEn}</b> aperturas como mucho.`} Repetida: <b>+${fmt(c.repetida)} fichas</b>.</p>
      <div class="cd-pie">${c.disponible ? '<button class="cd-boton" data-cd-abrir>Abrir</button>'
        : `<span class="cd-espera">Ya lo abriste hoy${c.ultimo?.skin ? `: te salió <b style="color:${color(rz(c.ultimo.skin))}">${nombre(c.ultimo.skin)}</b>` : ''}. Volvé en <b data-cd-falta>${falta(c.proximo - Date.now())}</b></span>`}</div>
    </div>`;
    clearInterval(reloj);
    reloj = setInterval(() => { const el = $('[data-cd-falta]', capa); if (el) el.textContent = falta(datos().cofre.proximo - Date.now()); }, 1000);
    tres?.cerrar(); tres = null;
    const canvas = $('.cd-tres canvas', capa);
    try { tres = await cofre3d(canvas); } catch { canvas.replaceWith(Object.assign(document.createElement('div'), { innerHTML: cofreSvg('grande') })); }
  }

  // la tira de la ruleta: con lo que había adentro, el premio en su lugar y a veces una buena al lado
  function armarTira(r) {
    const c = datos().cofre, N = 40, W = 33;
    const por = {}; for (const id of r.pool) (por[rz(id)] ??= []).push(id);
    const hay = ORDEN.filter((k) => por[k]);
    const total = hay.reduce((n, k) => n + c.probabilidades[k], 0);
    const tirar = () => { let x = Math.random() * total; for (const k of hay) { x -= c.probabilidades[k]; if (x < 0) return por[k][Math.floor(Math.random() * por[k].length)]; } return r.pool[0]; };
    const tira = Array.from({ length: N }, tirar);
    tira[W] = r.skin;
    const buenas = [...(por.mitica || []), ...(por.legendaria || [])].filter((id) => id !== r.skin);
    if (Math.random() < 0.55 && buenas.length) tira[W + (Math.random() < 0.5 ? 1 : -1)] = buenas[Math.floor(Math.random() * buenas.length)]; // ¡casi!
    return { tira, W };
  }

  // 2) abrir: acelera y salta mientras el servidor sortea, se abre con el color de lo que tocó, y pasa la ruleta
  async function abrir() {
    if (girando) return;
    girando = true;
    const escena = $('.cd-escena', capa);
    escena.classList.add('abriendo');
    tres?.cargar();
    let r;
    try { [r] = await Promise.all([api('/api/club/tienda/cofre', { pid: pid() }), espera(750)]); }
    catch (e) { girando = false; toast(e.message, true); vista(); return; }
    alActualizar(r);
    const col = color(r.rareza);
    tres?.abrir(col);
    escena.style.setProperty('--r', col); escena.classList.add('abierto');
    await espera(850);
    tres?.cerrar(); tres = null;
    const { tira, W } = armarTira(r);
    capa.innerHTML = `<div class="cd-ruleta" style="--r:${col}">
      <div class="cd-ventana"><div class="cd-tira">${tira.map((id) => carta(id)).join('')}</div><i class="cd-linea"></i></div>
      <p class="cd-girando">Tocá para saltear</p></div>`;
    const tiraEl = $('.cd-tira', capa), ventana = $('.cd-ventana', capa);
    const ancho = tiraEl.children[0].getBoundingClientRect().width + 10;
    const destino = W * ancho + ancho / 2 + 10 - ventana.clientWidth / 2 + (Math.random() - 0.5) * (ancho * 0.7);
    requestAnimationFrame(() => requestAnimationFrame(() => { tiraEl.style.transform = `translateX(${-destino}px)`; }));
    let ultimo = -1;
    const tic = () => { // la línea late cada vez que pasa una carta
      if (!tiraEl.isConnected || !girando) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(tiraEl).transform);
      const i = Math.floor((-m.m41 + ventana.clientWidth / 2) / ancho);
      if (i !== ultimo) { ultimo = i; const l = $('.cd-linea', capa); l?.classList.remove('tic'); void l?.offsetWidth; l?.classList.add('tic'); }
      requestAnimationFrame(tic);
    };
    requestAnimationFrame(tic);
    await Promise.race([espera(3400), new Promise((ok) => (saltear = ok))]);
    saltear = null;
    if (tiraEl.isConnected) { tiraEl.style.transition = 'transform .2s ease-out'; tiraEl.style.transform = `translateX(${-destino}px)`; tiraEl.children[W]?.classList.add('gano'); }
    await espera(450);
    girando = false;
    revelar(r);
  }

  // 3) la revelación
  function revelar(r) {
    const col = color(r.rareza), top = r.rareza === 'mitica' || r.rareza === 'legendaria';
    capa.innerHTML = `<div class="cd-revela r-${r.rareza}" style="--r:${col}">
      <div class="cd-destello"></div><div class="cd-rayos"></div><div class="cd-onda"></div>
      <div class="cd-confeti">${Array.from({ length: top ? 90 : 26 }, (_, i) => `<i style="--x:${Math.random() * 100}%;--d:${(Math.random() * 1.4).toFixed(2)}s;--c:${top ? ['#ffd23f', '#ff5fa8', '#4fd1ff', '#c5f04a', '#ffffff', col][i % 6] : col};--g:${Math.round(Math.random() * 720 - 360)}deg"></i>`).join('')}</div>
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

  function mostrar() { if (!datos()?.cofre) return; capa.hidden = false; vista(); }
  function cerrar() { if (girando) return; capa.hidden = true; clearInterval(reloj); tres?.cerrar(); tres = null; capa.innerHTML = ''; }
  capa.addEventListener('click', async (e) => {
    if (saltear) return saltear();
    if (e.target.closest('[data-cd-cerrar]') || e.target === capa) return cerrar();
    if (e.target.closest('[data-cd-abrir]')) return abrir();
    const u = e.target.closest('[data-cd-usar]');
    if (u) { await usar(u.dataset.cdUsar); cerrar(); }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !capa.hidden) cerrar(); });
  return { mostrar, pintarBoton };
}
