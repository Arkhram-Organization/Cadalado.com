// Tienda de skins: los personajes del elenco (con su modelo 3D) se compran con las fichas del casino.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { POR_ID } from '/comun/npcs.js';
import { limpiarLook, LOOK_BASE } from '/comun/look.js';
import { pid } from '/comun/sala.js';
import { iniciarPagina, api, yo, esc, toast } from './comun.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const u = await yo();
let datos = null;
let filtro = 'todas';
const CLAVE = 'cadalado.look';
const lookActual = () => { try { return limpiarLook(u?.look || JSON.parse(localStorage.getItem(CLAVE) || 'null') || LOOK_BASE); } catch { return limpiarLook(LOOK_BASE); } };
let usando = lookActual().npc || '';

// Retratos: un renderizador para todas las tarjetas (cuerpo entero, de frente, con luz de estudio)
const retratos = new Map();
let motor = null;
function prepararMotor() {
  if (motor) return motor;
  const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 480;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#fff6e8', '#4a5560', 2));
  const luz = new THREE.DirectionalLight('#fff0d8', 3); luz.position.set(-2, 3, -4); escena.add(luz);
  const borde = new THREE.DirectionalLight('#ffffff', 2.5); borde.position.set(3, 2.5, 3); escena.add(borde);
  const camara = new THREE.PerspectiveCamera(26, 360 / 480, 0.1, 50);
  motor = { renderer, escena, camara, canvas };
  return motor;
}
let cola = Promise.resolve();
function retrato(id) {
  if (!retratos.has(id)) retratos.set(id, (cola = cola.then(async () => {
    const { renderer, escena, camara, canvas } = prepararMotor();
    const p = crearPersona(THREE, { ...POR_ID[id]?.look }, { sombras: false });
    await p.listo;
    escena.add(p.grupo);
    p.grupo.rotation.y = 0.35;
    for (let i = 0; i < 40; i++) p.animar('quieto', 1 / 30);
    p.grupo.traverse((o) => { if (o.isMesh && o.geometry?.type === 'CircleGeometry') o.visible = false; });
    const caja = new THREE.Box3().setFromObject(p.grupo), c = caja.getCenter(new THREE.Vector3()), t = caja.getSize(new THREE.Vector3());
    const d = (t.y * 1.12) / 2 / Math.tan((13 * Math.PI) / 180);
    camara.position.set(c.x, c.y + 0.05, c.z - d); camara.lookAt(c.x, c.y, c.z);
    renderer.render(escena, camara);
    const url = canvas.toDataURL('image/png');
    escena.remove(p.grupo); p.dispose?.();
    return url;
  })));
  return retratos.get(id);
}

function tarjeta(s, grande = false) {
  const n = POR_ID[s.id], r = datos.rarezas[s.rareza];
  const mia = datos.mias.includes(s.id), uso = usando === s.id;
  const alcanza = datos.saldo >= s.precio;
  return `<article class="ti-carta r-${s.rareza} ${grande ? 'grande' : ''} ${mia ? 'mia' : ''}" style="--r:${r.color}" data-skin="${s.id}">
    <div class="ti-foto"><img data-retrato="${s.id}" alt="${esc(n?.nombre || s.id)}"><span class="ti-brillo"></span></div>
    ${mia ? `<span class="ti-sello">${uso ? 'La estás usando' : 'Es tuya'}</span>` : ''}
    <div class="ti-pie">
      <small>${esc(r.nombre)}${n?.look?.modelo ? ' · modelo 3D' : ''}</small>
      <b>${esc(n?.nombre || s.id)}</b>
      ${mia ? `<button class="ti-btn ${uso ? 'usando' : ''}" data-usar="${s.id}">${uso ? 'Usando' : 'Usar'}</button>`
        : `<button class="ti-btn comprar ${alcanza ? '' : 'no'}" data-comprar="${s.id}"><i class="moneda"></i>${fmt(s.precio)}</button>`}
    </div>
  </article>`;
}

function pintar() {
  $('[data-saldo]').textContent = fmt(datos.saldo);
  const orden = ['mitica', 'legendaria', 'epica', 'rara', 'comun'];
  const lista = [...datos.skins].sort((a, b) => orden.indexOf(a.rareza) - orden.indexOf(b.rareza) || b.precio - a.precio);
  const destacadas = lista.filter((s) => s.rareza === 'mitica' || s.rareza === 'legendaria');
  $('[data-destacada]').innerHTML = `<h2>Destacadas</h2><div class="ti-dest-grilla">${destacadas.map((s) => tarjeta(s, true)).join('')}</div>`;
  $('[data-filtros]').innerHTML = [['todas', 'Todas'], ...orden.map((k) => [k, datos.rarezas[k].nombre])].map(([k, t]) => `<button class="${filtro === k ? 'on' : ''}" data-filtro="${k}" style="--r:${datos.rarezas[k]?.color || '#c5f04a'}">${t}</button>`).join('');
  $('[data-grilla]').innerHTML = lista.filter((s) => filtro === 'todas' || s.rareza === filtro).map((s) => tarjeta(s)).join('');
  $('[data-nota]').innerHTML = datos.cuenta ? 'Las skins quedan en tu cuenta. Las usás en todos los juegos y en el casillero.' : 'Sin cuenta, las skins quedan en este dispositivo. <a href="/entrar?volver=/tienda">Entrá al club</a> para tenerlas en todos lados.';
  for (const img of document.querySelectorAll('[data-retrato]')) retrato(img.dataset.retrato).then((url) => (img.src = url)).catch(() => {});
}

async function cargar() {
  try {
    datos = await api('/api/club/tienda?pid=' + encodeURIComponent(pid()));
    pintar();
  } catch (e) {
    $('[data-grilla]').innerHTML = `<div class="vacio">${esc(e.message)}</div>`;
  }
}

async function usar(id) {
  const look = limpiarLook({ ...lookActual(), npc: id });
  try { localStorage.setItem(CLAVE, JSON.stringify(look)); } catch {}
  if (u) await api('/api/club/look', { look }).catch(() => {});
  usando = id;
  toast(`Ahora jugás como ${POR_ID[id]?.nombre || id}`);
  pintar();
}

document.addEventListener('click', async (e) => {
  const f = e.target.closest('[data-filtro]');
  if (f) { filtro = f.dataset.filtro; return pintar(); }
  const c = e.target.closest('[data-comprar]');
  if (c) {
    const s = datos.skins.find((x) => x.id === c.dataset.comprar);
    if (datos.saldo < s.precio) return toast(`Te faltan ${fmt(s.precio - datos.saldo)} fichas. Ganalas en el casino.`, true);
    if (!confirm(`¿Comprar a ${POR_ID[s.id]?.nombre} por ${fmt(s.precio)} fichas?`)) return;
    c.disabled = true;
    try {
      const r = await api('/api/club/tienda/comprar', { pid: pid(), skin: s.id });
      datos.saldo = r.saldo; datos.mias = r.mias;
      const carta = c.closest('.ti-carta');
      carta?.classList.add('recien');
      setTimeout(() => usar(s.id), 900);
      toast(`¡${POR_ID[s.id]?.nombre} es tuya!`);
    } catch (err) { toast(err.message, true); c.disabled = false; }
    return;
  }
  const us = e.target.closest('[data-usar]');
  if (us) usar(us.dataset.usar === usando ? '' : us.dataset.usar);
});

cargar();
