// Tienda estilo item shop: rota todos los días, solo un par en venta. Portadas épicas con la frase de cada uno.
// Al tocar un personaje se abre su ficha: el modelo en 3D para girarlo 360°, sus animaciones, comprar o regalar.
import { POR_ID } from '/comun/npcs.js';
import { limpiarLook, LOOK_BASE } from '/comun/look.js';
import { pid } from '/comun/sala.js';
import { iniciarPagina, api, yo, esc, toast } from './comun.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const u = await yo();
let datos = null;
const CLAVE = 'cadalado.look';
const lookActual = () => { try { return limpiarLook(u?.look || JSON.parse(localStorage.getItem(CLAVE) || 'null') || LOOK_BASE); } catch { return limpiarLook(LOOK_BASE); } };
let usando = lookActual().npc || '';

const skin = (id) => datos.skins.find((s) => s.id === id);
const nombre = (id) => POR_ID[id]?.nombre || id;
const portada = (id) => `/img/tienda/${id}.webp`;
const enVenta = (id) => datos.destacadas.includes(id) || datos.diarias.includes(id);

function carta(id, donde) {
  const s = skin(id); if (!s) return '';
  const r = datos.rarezas[s.rareza];
  const mia = datos.mias.includes(id), uso = usando === id;
  const precio = mia
    ? `<div class="ti-precio tuya"><span>${uso ? 'La estás usando' : 'Es tuya'}</span></div>`
    : `<div class="ti-precio ${datos.saldo >= s.precio ? '' : 'falta'}"><span><i class="moneda"></i>${fmt(s.precio)}</span></div>`;
  return `<button class="ti-carta r-${s.rareza} ${uso ? 'usando' : ''}" style="--r:${r.color}" data-ver="${id}" aria-label="${esc(nombre(id))}">
    <img class="ti-img" src="${portada(id)}" alt="" ${donde === 'dest' ? '' : 'loading="lazy"'}>
    <span class="ti-brillo"></span>
    ${s.nuevo && !mia ? '<span class="ti-nuevo">¡Nuevo!</span>' : ''}
    ${mia ? '<span class="ti-sello">Es tuya</span>' : ''}
    <div class="ti-info">
      <p class="ti-frase">${esc(s.frase)}</p>
      <b class="ti-nombre">${esc(nombre(id))}</b>
      <span class="ti-tipo">Skin · ${esc(r.nombre)}</span>
      ${precio}
    </div>
  </button>`;
}

function pintar() {
  $('[data-saldo]').textContent = fmt(datos.saldo);
  $('[data-destacadas]').innerHTML = datos.destacadas.map((id) => carta(id, 'dest')).join('');
  $('[data-diarias]').innerHTML = datos.diarias.map((id) => carta(id, 'diario')).join('');
  $('[data-nota]').innerHTML = datos.cuenta
    ? 'Ganás fichas jugando cualquier juego. Las skins quedan en tu cuenta.'
    : 'Ganás fichas jugando. Sin cuenta las skins quedan en este dispositivo: <a href="/entrar?volver=/tienda">entrá al club</a>.';
}

// Reloj hasta la próxima rotación (medianoche de Argentina)
function reloj() {
  if (!datos) return;
  const falta = datos.renueva - Date.now();
  if (falta <= 0) { cargar(); return; }
  const h = Math.floor(falta / 3_600_000), m = Math.floor(falta / 60_000) % 60, s = Math.floor(falta / 1000) % 60;
  const dd = (n) => String(n).padStart(2, '0');
  $('[data-reloj]').innerHTML = `Se renueva en <b>${dd(h)}:${dd(m)}:${dd(s)}</b>`;
}
setInterval(reloj, 1000);

async function cargar() {
  try {
    datos = await api('/api/club/tienda?pid=' + encodeURIComponent(pid()));
    pintar(); reloj();
    if (datos.regalos?.length) regaloRecibido(datos.regalos[0]);
  } catch (e) {
    $('[data-destacadas]').innerHTML = `<div class="vacio">${esc(e.message)}</div>`;
    $('[data-diarias]').innerHTML = '';
  }
}

// ---------- visor 3D: el personaje entero, se gira con el mouse/dedo y hace sus animaciones ----------
const ANIMS = [['quieto', 'Quieto'], ['camina', 'Caminar'], ['corre', 'Correr'], ['baila', 'Bailar'], ['saluda', 'Saludar'], ['festeja', 'Festejar'], ['musculos', 'Músculos'], ['salto', 'Saltar'], ['pina', 'Piña'], ['habla', 'Hablar']];
let visor = null;
async function motor3d() {
  if (visor) return visor;
  const THREE = await import('/comun/vendor/three.module.min.js');
  const { crearPersona } = await import('/comun/persona3d.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#fff6e8', '#4a5560', 2));
  const luz = new THREE.DirectionalLight('#fff0d8', 3); luz.position.set(-2, 3, 4); escena.add(luz);
  const borde = new THREE.DirectionalLight('#ffffff', 2.2); borde.position.set(3, 2.5, -3); escena.add(borde);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  visor = { THREE, crearPersona, renderer, escena, camara, persona: null, id: null, anim: 'quieto', yaw: 0, auto: true, dist: 5, centro: new THREE.Vector3(0, 1, 0), raf: 0, ultimo: 0 };
  return visor;
}
function encuadrar() {
  const v = visor, el = v.renderer.domElement.parentElement;
  if (!el) return;
  const w = el.clientWidth, h = el.clientHeight;
  v.renderer.setSize(w, h, false); v.camara.aspect = w / h; v.camara.updateProjectionMatrix();
}
function cuadro(t) {
  const v = visor;
  if (!v.persona || !v.renderer.domElement.isConnected) { v.raf = 0; return; }
  const dt = Math.min(0.05, (t - (v.ultimo || t)) / 1000); v.ultimo = t;
  if (v.auto) v.yaw += dt * 0.5;
  v.persona.grupo.rotation.y = v.yaw;
  v.persona.animar('g-' + v.anim, dt);
  const c = v.centro;
  v.camara.position.set(c.x, c.y + v.dist * 0.08, c.z + v.dist); v.camara.lookAt(c.x, c.y, c.z);
  v.renderer.render(v.escena, v.camara);
  v.raf = requestAnimationFrame(cuadro);
}
async function abrirVisor(cont, id) {
  const v = await motor3d();
  if (!cont.isConnected) return;
  cont.prepend(v.renderer.domElement);
  encuadrar();
  if (v.id !== id) {
    if (v.persona) { v.escena.remove(v.persona.grupo); v.persona.dispose?.(); v.persona = null; }
    v.id = id; v.anim = 'quieto'; v.yaw = 0.35; v.auto = true;
    const p = v.crearPersona(v.THREE, { ...POR_ID[id]?.look, travesuras: {} }, { sombras: false });
    await p.listo;
    if (v.id !== id) { p.dispose?.(); return; }
    p.animar('quieto', 0);
    const caja = new v.THREE.Box3().setFromObject(p.grupo), t = caja.getSize(new v.THREE.Vector3());
    v.centro.set(0, caja.min.y + t.y * 0.5, 0);
    v.dist = (t.y * 1.25) / 2 / Math.tan((15 * Math.PI) / 180);
    v.escena.add(p.grupo); v.persona = p;
  }
  if (!cont.isConnected) return;
  cont.classList.add('en-3d');
  if (!v.raf) { v.ultimo = 0; v.raf = requestAnimationFrame(cuadro); }
}
function cerrarVisor() {
  if (!visor) return;
  cancelAnimationFrame(visor.raf); visor.raf = 0;
  visor.renderer.domElement.remove();
}
// girar arrastrando, acercar con la rueda
let arrastre = null;
document.addEventListener('pointerdown', (e) => {
  const cont = e.target.closest('.ti-visor');
  if (!cont || !visor || e.target.closest('button')) return;
  arrastre = { x: e.clientX, yaw: visor.yaw }; visor.auto = false;
});
document.addEventListener('pointermove', (e) => { if (arrastre && visor) visor.yaw = arrastre.yaw + (e.clientX - arrastre.x) * 0.012; });
document.addEventListener('pointerup', () => { arrastre = null; });
document.addEventListener('wheel', (e) => {
  if (!visor || !e.target.closest('.ti-visor')) return;
  e.preventDefault();
  visor.dist = Math.max(2.2, Math.min(9, visor.dist * (e.deltaY > 0 ? 1.08 : 0.93)));
}, { passive: false });
addEventListener('resize', () => visor?.renderer.domElement.isConnected && encuadrar());

// ---------- ficha de cada personaje ----------
let vista = { id: null, regalando: false, amigos: null };
function acciones(id) {
  const s = skin(id), mia = datos.mias.includes(id), uso = usando === id;
  const alcanza = datos.saldo >= s.precio, venta = enVenta(id);
  let h = '';
  if (mia) h += uso ? `<button class="ti-boton quitar" data-usar="">Dejar de usar</button>` : `<button class="ti-boton usar" data-usar="${id}">Usar</button>`;
  else if (venta) h += `<button class="ti-boton" data-comprar="${id}" ${alcanza ? '' : 'disabled'}><i class="moneda"></i>Comprar · ${fmt(s.precio)}</button>`;
  if (venta) h += `<button class="ti-boton regalo chico" data-regalar="${id}" ${alcanza ? '' : 'disabled'}>Regalar</button>`;
  if (!venta && !mia) h += `<span class="ti-falta">Hoy no está en la tienda. Volvé mañana.</span>`;
  else if (venta && !alcanza) h += `<span class="ti-falta">Te faltan ${fmt(s.precio - datos.saldo)} fichas. Ganalas jugando o en el <a href="/casino/">casino</a>.</span>`;
  return h;
}
function listaAmigos(id) {
  if (!u) return `<p class="ti-falta" style="margin-top:16px">Para regalar tenés que <a href="/entrar?volver=/tienda">entrar con tu cuenta</a>.</p><p style="margin-top:10px"><button class="ti-boton quitar chico" data-no-regalar>Volver</button></p>`;
  if (!vista.amigos) return `<p class="ti-sub">Cargando amigos…</p>`;
  if (!vista.amigos.length) return `<p class="ti-falta" style="margin-top:16px">Todavía no tenés amigos en el club. <a href="/club#amigos">Sumalos acá</a>.</p><p style="margin-top:10px"><button class="ti-boton quitar chico" data-no-regalar>Volver</button></p>`;
  return `<p class="ti-sub">¿A quién se la regalás? (${fmt(skin(id).precio)} fichas)</p>
    <div class="ti-amigos">${vista.amigos.map((a) => `<button data-regalar-a="${esc(a.usuario)}" data-nombre="${esc(a.nombre)}"><span>${esc(a.nombre)}</span><small>@${esc(a.usuario)}</small></button>`).join('')}</div>
    <p style="margin-top:10px"><button class="ti-boton quitar chico" data-no-regalar>Volver</button></p>`;
}
function infoHtml(id) {
  const s = skin(id), r = datos.rarezas[s.rareza], mia = datos.mias.includes(id);
  const actual = visor?.id === id ? visor.anim : 'quieto';
  return `<span><span class="ti-chip">${esc(r.nombre)}</span>${s.nuevo && !mia ? ' <span class="ti-chip" style="background:#ffe03a">¡Nuevo!</span>' : ''}</span>
    <h3>${esc(nombre(id))}</h3>
    <span class="ti-tipo">Skin con modelo 3D</span>
    <blockquote>“${esc(s.frase)}”</blockquote>
    <p class="ti-sub">Animaciones</p>
    <div class="ti-anims">${ANIMS.map(([k, t]) => `<button data-anim="${k}" class="${actual === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${vista.regalando ? listaAmigos(id) : `<div class="ti-acciones">${acciones(id)}</div>`}`;
}
function detalle(id, recien = false) {
  const r = datos.rarezas[skin(id).rareza];
  const m = $('[data-modal]');
  const mismo = vista.id === id && !m.hidden && $('.ti-det-info');
  if (vista.id !== id) vista = { id, regalando: false, amigos: vista.amigos };
  if (mismo && !recien) { $('.ti-det-info').innerHTML = infoHtml(id); return; }
  m.innerHTML = `<div class="ti-det ${recien ? 'recien' : ''}" style="--r:${r.color}" role="dialog" aria-modal="true" aria-label="${esc(nombre(id))}">
    <button class="ti-cerrar" data-cerrar aria-label="Cerrar">×</button>
    <div class="ti-visor"><img class="ti-portada" src="${portada(id)}" alt="${esc(nombre(id))}"><button class="ti-vista" data-vista>Portada</button><span class="ti-girar">Arrastrá para girarlo · rueda para acercar</span></div>
    <div class="ti-det-info">${infoHtml(id)}</div>
  </div>`;
  m.hidden = false;
  abrirVisor($('.ti-visor'), id).catch(() => {});
}
const cerrar = () => { $('[data-modal]').hidden = true; cerrarVisor(); vista.id = null; vista.regalando = false; };

function regaloRecibido(g) {
  const s = skin(g.skin); if (!s) return;
  const m = $('[data-modal]');
  m.innerHTML = `<div class="ti-det ti-regalo-llego" style="--r:${datos.rarezas[s.rareza].color}" role="dialog" aria-modal="true">
    <button class="ti-cerrar" data-cerrar aria-label="Cerrar">×</button>
    <div><p class="ti-sub">Te llegó un regalo</p><h3>¡${esc(g.de)} te regaló a ${esc(nombre(g.skin))}!</h3>
    <img src="${portada(g.skin)}" alt="">
    <blockquote>“${esc(s.frase)}”</blockquote>
    <div class="ti-acciones" style="justify-content:center"><button class="ti-boton usar" data-usar="${g.skin}">Usarla ya</button></div></div>
  </div>`;
  m.hidden = false;
}

async function usar(id) {
  const look = limpiarLook({ ...lookActual(), npc: id });
  try { localStorage.setItem(CLAVE, JSON.stringify(look)); } catch {}
  if (u) await api('/api/club/look', { look }).catch(() => {});
  usando = id;
  toast(id ? `Ahora jugás como ${nombre(id)}` : 'Volviste a tu personaje');
  pintar();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
// códigos de creador (cada uno se canjea una vez por cuenta)
$('[data-codigo]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, input = f.codigo, b = f.querySelector('button');
  const codigo = input.value.trim();
  if (!codigo) return input.focus();
  b.disabled = true;
  try {
    const r = await api('/api/club/tienda/codigo', { pid: pid(), codigo });
    datos.saldo = r.saldo; pintar();
    input.value = ''; f.classList.remove('ok'); void f.offsetWidth; f.classList.add('ok');
    toast(`¡Código canjeado! +${fmt(r.monto)} fichas`);
  } catch (err) { toast(err.message, true); }
  b.disabled = false;
});
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-cerrar]') || e.target.matches('[data-modal]')) return cerrar();
  const v = e.target.closest('[data-ver]');
  if (v) return detalle(v.dataset.ver);
  const an = e.target.closest('[data-anim]');
  if (an) {
    if (visor) visor.anim = an.dataset.anim;
    document.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('on', b === an));
    $('.ti-visor')?.classList.add('en-3d');
    const b = $('[data-vista]'); if (b) b.textContent = 'Portada';
    return;
  }
  const vb = e.target.closest('[data-vista]');
  if (vb) { const en3d = $('.ti-visor').classList.toggle('en-3d'); vb.textContent = en3d ? 'Portada' : 'Ver en 3D'; return; }
  const c = e.target.closest('[data-comprar]');
  if (c) {
    const id = c.dataset.comprar;
    c.disabled = true;
    try {
      const r = await api('/api/club/tienda/comprar', { pid: pid(), skin: id });
      datos.saldo = r.saldo; datos.mias = r.mias;
      toast(`¡${nombre(id)} es tuya!`);
      await usar(id);
      detalle(id, true);
    } catch (err) { toast(err.message, true); c.disabled = false; }
    return;
  }
  if (e.target.closest('[data-regalar]')) {
    vista.regalando = true; detalle(vista.id);
    if (u && !vista.amigos) {
      try { vista.amigos = (await api('/api/club/amigos')).amigos || []; } catch { vista.amigos = []; }
      if (vista.regalando && vista.id) detalle(vista.id);
    }
    return;
  }
  if (e.target.closest('[data-no-regalar]')) { vista.regalando = false; return detalle(vista.id); }
  const ra = e.target.closest('[data-regalar-a]');
  if (ra) {
    const id = vista.id, s = skin(id);
    if (!confirm(`¿Regalarle ${nombre(id)} a ${ra.dataset.nombre} por ${fmt(s.precio)} fichas?`)) return;
    ra.disabled = true;
    try {
      const r = await api('/api/club/tienda/regalar', { pid: pid(), skin: id, para: ra.dataset.regalarA });
      datos.saldo = r.saldo; pintar();
      toast(`¡Le regalaste ${nombre(id)} a ${r.para}!`);
      vista.regalando = false; detalle(id);
    } catch (err) { toast(err.message, true); ra.disabled = false; }
    return;
  }
  const us = e.target.closest('[data-usar]');
  if (us) { await usar(us.dataset.usar); cerrar(); }
});

cargar();
