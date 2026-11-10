// Tienda estilo item shop: rota todos los días, solo un par en venta. Portadas épicas con la frase de cada uno.
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

function carta(id, donde) {
  const s = skin(id); if (!s) return '';
  const r = datos.rarezas[s.rareza];
  const mia = datos.mias.includes(id), uso = usando === id;
  const precio = mia
    ? `<div class="ti-precio tuya"><span>${uso ? 'La estás usando' : 'Es tuya'}</span></div>`
    : `<div class="ti-precio ${datos.saldo >= s.precio ? '' : 'falta'}"><span><i class="moneda"></i>${fmt(s.precio)}</span></div>`;
  return `<button class="ti-carta r-${s.rareza} ${uso ? 'usando' : ''}" style="--r:${r.color}" data-ver="${id}" aria-label="${esc(nombre(id))}">
    <img class="ti-img" src="${portada(id)}" alt="" loading="${donde === 'mias' ? 'lazy' : 'eager'}">
    <span class="ti-brillo"></span>
    ${s.nuevo && !mia && donde !== 'mias' ? '<span class="ti-nuevo">¡Nuevo!</span>' : ''}
    ${mia && donde !== 'mias' ? '<span class="ti-sello">Es tuya</span>' : ''}
    <div class="ti-info">
      ${donde === 'mias' ? '' : `<p class="ti-frase">${esc(s.frase)}</p>`}
      <b class="ti-nombre">${esc(nombre(id))}</b>
      <span class="ti-tipo">Skin · ${esc(r.nombre)}</span>
      ${donde === 'mias' ? '' : precio}
    </div>
  </button>`;
}

function pintar() {
  $('[data-saldo]').textContent = fmt(datos.saldo);
  $('[data-destacadas]').innerHTML = datos.destacadas.map((id) => carta(id, 'dest')).join('');
  $('[data-diarias]').innerHTML = datos.diarias.map((id) => carta(id, 'diario')).join('');
  const mias = $('[data-mias]');
  mias.hidden = !datos.mias.length;
  mias.innerHTML = `<h2>Tus skins</h2><div class="ti-mias-fila">${datos.mias.map((id) => carta(id, 'mias')).join('')}</div>`;
  $('[data-nota]').innerHTML = datos.cuenta ? 'Las skins quedan en tu cuenta. Las usás en todos los juegos y en el casillero.' : 'Sin cuenta, las skins quedan en este dispositivo. <a href="/entrar?volver=/tienda">Entrá al club</a> para tenerlas en todos lados.';
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
  } catch (e) {
    $('[data-destacadas]').innerHTML = `<div class="vacio">${esc(e.message)}</div>`;
    $('[data-diarias]').innerHTML = '';
  }
}

// Detalle de una skin (reemplaza al confirm): portada grande, frase, precio y comprar/usar
function detalle(id, recien = false) {
  const s = skin(id), r = datos.rarezas[s.rareza];
  const mia = datos.mias.includes(id), uso = usando === id;
  const enVenta = datos.destacadas.includes(id) || datos.diarias.includes(id);
  const alcanza = datos.saldo >= s.precio;
  let acciones;
  if (mia) acciones = uso ? `<button class="ti-boton quitar" data-usar="">Dejar de usar</button>` : `<button class="ti-boton usar" data-usar="${id}">Usar</button>`;
  else if (!enVenta) acciones = `<span class="ti-falta">Hoy no está en la tienda. Volvé mañana.</span>`;
  else acciones = `<button class="ti-boton" data-comprar="${id}" ${alcanza ? '' : 'disabled'}><i class="moneda"></i>Comprar · ${fmt(s.precio)}</button>
    ${alcanza ? '' : `<span class="ti-falta">Te faltan ${fmt(s.precio - datos.saldo)} fichas. <a href="/casino/">Ganalas en el casino</a>.</span>`}`;
  const m = $('[data-modal]');
  m.innerHTML = `<div class="ti-det ${recien ? 'recien' : ''}" style="--r:${r.color}" role="dialog" aria-modal="true" aria-label="${esc(nombre(id))}">
    <button class="ti-cerrar" data-cerrar aria-label="Cerrar">×</button>
    <img src="${portada(id)}" alt="${esc(nombre(id))}">
    <div>
      <span class="ti-chip">${esc(r.nombre)}</span>${s.nuevo && !mia ? ' <span class="ti-chip" style="background:#ffe03a">¡Nuevo!</span>' : ''}
      <h3>${esc(nombre(id))}</h3>
      <span class="ti-tipo">Skin con modelo 3D</span>
      <blockquote>“${esc(s.frase)}”</blockquote>
      <div class="ti-acciones">${acciones}</div>
    </div>
  </div>`;
  m.hidden = false;
}
const cerrar = () => { $('[data-modal]').hidden = true; };

async function usar(id) {
  const look = limpiarLook({ ...lookActual(), npc: id });
  try { localStorage.setItem(CLAVE, JSON.stringify(look)); } catch {}
  if (u) await api('/api/club/look', { look }).catch(() => {});
  usando = id;
  toast(id ? `Ahora jugás como ${nombre(id)}` : 'Volviste a tu personaje');
  pintar();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-cerrar]') || e.target.matches('[data-modal]')) return cerrar();
  const v = e.target.closest('[data-ver]');
  if (v) return detalle(v.dataset.ver);
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
  const us = e.target.closest('[data-usar]');
  if (us) { await usar(us.dataset.usar); cerrar(); }
});

cargar();
