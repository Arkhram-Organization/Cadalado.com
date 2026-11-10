// Editor de personaje: vista 3D en vivo, vestimentas de base y todas las opciones editables.
// Se guarda en la cuenta (si entraste) y en este navegador; los juegos lo mandan al entrar a una sala.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { avatarSvg, lookDeNombre } from '/comun/avatar.js';
import { NPCS } from '/comun/npcs.js';
import { GESTOS } from '/comun/gestos.js';
import { LOOK_BASE, VESTIMENTAS, ESTILOS_PELO, CUERPOS, PRENDAS, BARBAS, LENTES, PALETAS, limpiarLook, lookParaDibujo, aplicarVestimenta, lookAlAzar } from '/comun/look.js';
import { iniciarPagina, api, yo, esc, toast } from './comun.js';
import { pid } from '/comun/sala.js';

// las skins del elenco se compran en la tienda (con las fichas del casino)
let tienda = { mias: [], skins: [], rarezas: {} };
api('/api/club/tienda?pid=' + encodeURIComponent(pid())).then((d) => { tienda = d; pintar(); }).catch(() => {});

iniciarPagina();
const $ = (s) => document.querySelector(s);
const CLAVE = 'cadalado.look';
const u = await yo();
const leerLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || 'null');
  } catch {
    return null;
  }
};
let guardado = limpiarLook(u?.look || leerLocal() || LOOK_BASE);
let look = structuredClone(guardado);
let animacion = 'quieto';
$('[data-nota]').textContent = u ? `Se guarda en tu cuenta (${u.nombre}).` : 'Sin cuenta se guarda en este navegador. Entrá al club para tenerlo en todos lados.';

// ---------------------------------------------------------------- vista 3D
const caja = $('[data-lienzo]');
const canvas = caja.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const escena = new THREE.Scene();
escena.add(new THREE.HemisphereLight(0xfff4e0, 0x5a6b55, 1.5));
const sol = new THREE.DirectionalLight(0xffffff, 2.2);
sol.position.set(2, 5, -4);
sol.castShadow = true;
escena.add(sol);
const piso = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshStandardMaterial({ color: 0x5f7a4a, roughness: 0.9 }));
piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
escena.add(piso);
const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camara.position.set(0, 1.25, -4.6);
camara.lookAt(0, 0.95, 0);
let persona = null;
let giro = 0;
let giroObj = 0;
function armar() {
  if (persona) {
    escena.remove(persona.grupo);
    persona.dispose?.();
  }
  persona = crearPersona(THREE, lookParaDibujo(look), { sombras: true });
  persona.grupo.rotation.y = giro;
  escena.add(persona.grupo);
}
function medir() {
  const w = caja.clientWidth;
  const h = caja.clientHeight;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
}
addEventListener('resize', medir);
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => {
  arrastre = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (arrastre == null) return;
  giroObj += (e.clientX - arrastre) * 0.012;
  arrastre = e.clientX;
});
canvas.addEventListener('pointerup', () => (arrastre = null));
let ultimo = performance.now();
function cuadro(ms) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ms - ultimo) / 1000);
  ultimo = ms;
  if (arrastre == null && animacion === 'quieto') giroObj += dt * 0.25;
  giro += (giroObj - giro) * Math.min(1, dt * 8);
  if (persona) {
    persona.grupo.rotation.y = giro;
    persona.animar(animacion, dt);
  }
  renderer.render(escena, camara);
}
medir();
armar();
requestAnimationFrame(cuadro);

$('[data-anims]').innerHTML = [['quieto', 'Quieto'], ['camina', 'Caminar'], ['corre', 'Correr'], ['salto', 'Saltar']].map(([k, t]) => `<button class="chip-op ${k === animacion ? 'on' : ''}" data-anim="${k}">${t}</button>`).join('')
  + `<span class="pj-gestos-t">Gestos (B en la carrera)</span>` + GESTOS.map((g) => `<button class="chip-op" data-gesto="${g.id}">${g.nombre}</button>`).join('');
$('[data-anims]').addEventListener('click', (e) => {
  const g = e.target.closest('[data-gesto]');
  if (g) { animacion = 'quieto'; $('[data-anims]').querySelectorAll('[data-anim]').forEach((x) => x.classList.toggle('on', x.dataset.anim === 'quieto')); return persona?.gesto?.(g.dataset.gesto); }
  const b = e.target.closest('[data-anim]');
  if (!b) return;
  animacion = b.dataset.anim;
  $('[data-anims]').querySelectorAll('.chip-op').forEach((x) => x.classList.toggle('on', x === b));
});

// ---------------------------------------------------------------- editor
const leer = (ruta) => ruta.split('.').reduce((o, k) => o?.[k], look);
function poner(ruta, valor) {
  const partes = ruta.split('.');
  let o = look;
  for (const k of partes.slice(0, -1)) o = o[k] ??= {};
  o[partes.at(-1)] = valor;
  look.npc = ''; // al editar, volvés a tu personaje
  look = limpiarLook(look);
  armar();
  pintar();
}

// Controles reutilizables
const opciones = (ruta, lista) => `<div class="ops">${lista.map(([k, t]) => `<button class="chip-op ${leer(ruta) === k ? 'on' : ''}" data-ruta="${ruta}" data-valor="${k}">${t}</button>`).join('')}</div>`;
const colores = (ruta, paleta) => {
  const v = leer(ruta) || '';
  return `<div class="colores">${paleta.map((c) => `<button class="color ${v === c ? 'on' : ''}" style="--c:${c}" data-ruta="${ruta}" data-valor="${c}" aria-label="${c}"></button>`).join('')}
    <label class="color-libre" title="Otro color"><input type="color" value="${v || '#888888'}" data-ruta="${ruta}"><span>+</span></label></div>`;
};
// Accesorio opcional: interruptor + color
const opcional = (ruta, titulo, paleta = PALETAS.ropa, porDefecto = '#141416') => {
  const v = leer(ruta);
  return `<div class="fila-op"><label class="interruptor"><input type="checkbox" ${v ? 'checked' : ''} data-toggle="${ruta}" data-defecto="${porDefecto}"><span></span>${titulo}</label>${v ? colores(ruta, paleta) : ''}</div>`;
};
const bloque = (titulo, cuerpo, abierto = false) => `<details class="bloque" ${abierto ? 'open' : ''}><summary>${titulo}</summary><div class="bloque-c">${cuerpo}</div></details>`;

function pintar() {
  const abiertos = [...document.querySelectorAll('.bloque')].map((d) => d.open);
  const casillero = bloque('Casillero: jugá con alguien del elenco', `<p class="ayuda">Elegí un personaje y entrás a los juegos con él (con su modelo, sus gestos y sus travesuras).</p>
    <div class="vestimentas casillero">${NPCS.map((n) => {
      const s = tienda.skins.find((x) => x.id === n.id), r = tienda.rarezas[s?.rareza];
      const mia = !s || tienda.mias.includes(n.id);
      return mia ? `<button class="vest ${look.npc === n.id ? 'on' : ''}" data-npc="${n.id}" style="--r:${r?.color || 'transparent'}"><span class="av">${avatarSvg(lookDeNombre(n.nombre))}</span><b>${esc(n.nombre)}</b></button>`
        : `<a class="vest bloqueada" href="/tienda" style="--r:${r?.color || '#888'}" title="Comprala en la tienda"><span class="av">${avatarSvg(lookDeNombre(n.nombre))}</span><b>${esc(n.nombre)}</b><small>${esc(r?.nombre || '')} · ${Number(s.precio).toLocaleString('es-AR')} fichas</small></a>`;
    }).join('')}</div>
    <p class="ayuda">Las que tienen candado se compran en la <a href="/tienda">tienda</a> con las fichas del casino.</p>
    ${look.npc ? `<p class="ayuda">Estás jugando como <b>${esc(NPCS.find((n) => n.id === look.npc)?.nombre || '')}</b>. <button class="btn btn-chico" data-npc="">Volver a mi personaje</button></p>` : ''}`, true);
  const html = [
    casillero,
    bloque('Vestimentas de base', `<p class="ayuda">Cambian la ropa y los accesorios; después podés editar todo.</p><div class="vestimentas">${VESTIMENTAS.map((v) => `<button class="vest" data-vest="${v.id}"><span class="av">${avatarSvg(lookParaDibujo(aplicarVestimenta(look, v.id)))}</span><b>${esc(v.nombre)}</b></button>`).join('')}</div>`, true),
    bloque('Cuerpo', `<span class="et">Piel</span>${colores('piel', PALETAS.piel)}<span class="et">Ojos</span>${colores('ojos', PALETAS.ojos)}<span class="et">Contextura</span>${opciones('cuerpo', CUERPOS)}`),
    bloque('Pelo', `<span class="et">Peinado</span>${opciones('pelo.estilo', ESTILOS_PELO)}<span class="et">Color</span>${colores('pelo.color', PALETAS.pelo)}`),
    bloque('Cara', `<span class="et">Barba</span>${opciones('barbaTipo', BARBAS)}${look.barbaTipo ? colores('barba', PALETAS.pelo) : ''}
      <span class="et">Lentes</span>${opciones('lentesForma', LENTES)}${look.lentesForma ? `${colores('lentes', ['#141416', '#3a2a1c', '#7a1f2b', '#d9cfc2', '#d4af37', '#2f6fd6', '#ff4fa3'])}<label class="interruptor"><input type="checkbox" ${look.lentesClaros ? 'checked' : ''} data-bool="lentesClaros"><span></span>Vidrio a la vista</label>` : ''}`),
    bloque('Ropa', `<span class="et">Arriba</span>${opciones('prenda', PRENDAS)}
      ${look.prenda !== 'smoking' ? `<span class="et">Color de arriba</span>${colores('ropa.remera', PALETAS.ropa)}<span class="et">Estampado</span>${opciones('ropa.estampado', [['', 'Liso'], ['cuadros', 'A cuadros']])}${opcional('ropa.franja', 'Franja', PALETAS.ropa, '#f4f1ea')}${opcional('campera', 'Campera abierta', PALETAS.ropa, '#8a9488')}` : ''}
      <span class="et">Pantalón</span>${colores('ropa.pantalon', PALETAS.ropa)}<span class="et">Zapatillas</span>${colores('ropa.zapatillas', ['#e9e1d1', '#f4f1ea', '#141416', '#2a2a2e', '#5b3a26', '#3a2f28', '#d63a3a', '#c5f04a', '#7aa2ff'])}${opcional('ropa.bolso', 'Bolso cruzado', PALETAS.ropa, '#b8783f')}`),
    bloque('Accesorios', [
      opcional('gorra', 'Gorra'), opcional('sombrero', 'Sombrero', PALETAS.ropa, '#2b2018'), opcional('kipa', 'Kipá', PALETAS.ropa, '#1d2c5e'),
      opcional('capucha', 'Capucha puesta', PALETAS.ropa, '#1f2a4d'), opcional('auriculares', 'Auriculares'), opcional('antifaz', 'Antifaz', PALETAS.ropa, '#123d22'),
      opcional('capa', 'Capa', PALETAS.ropa, '#2f8f4e'), opcional('mochila', 'Mochila', PALETAS.ropa, '#6b6658'), opcional('guantes', 'Guantes', PALETAS.ropa, '#141416'),
      `<div class="fila-op"><label class="interruptor"><input type="checkbox" ${look.camara ? 'checked' : ''} data-bool="camara"><span></span>Cámara de fotos</label></div>`,
    ].join('')),
  ].join('');
  const ed = $('[data-editor]');
  ed.innerHTML = html;
  ed.querySelectorAll('.bloque').forEach((d, i) => abiertos.length && (d.open = abiertos[i]));
  const cambiado = JSON.stringify(look) !== JSON.stringify(guardado);
  $('[data-guardar]').textContent = cambiado ? 'Guardar personaje' : 'Guardado';
  $('[data-guardar]').classList.toggle('btn-lima', cambiado);
}

$('[data-editor]').addEventListener('click', (e) => {
  const npc = e.target.closest('[data-npc]');
  if (npc) {
    look = limpiarLook({ ...look, npc: npc.dataset.npc });
    armar();
    return pintar();
  }
  const v = e.target.closest('[data-vest]');
  if (v) {
    look = { ...aplicarVestimenta(look, v.dataset.vest), npc: '' };
    armar();
    return pintar();
  }
  const b = e.target.closest('button[data-ruta]');
  if (b) poner(b.dataset.ruta, b.dataset.valor);
});
$('[data-editor]').addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('input[type=color][data-ruta]')) poner(t.dataset.ruta, t.value);
  else if (t.matches('[data-toggle]')) poner(t.dataset.toggle, t.checked ? t.dataset.defecto : '');
  else if (t.matches('[data-bool]')) poner(t.dataset.bool, t.checked);
});
$('[data-azar]').onclick = () => {
  look = limpiarLook(lookAlAzar());
  armar();
  pintar();
};
$('[data-deshacer]').onclick = () => {
  look = structuredClone(guardado);
  armar();
  pintar();
};
$('[data-guardar]').onclick = async () => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(look));
  } catch {}
  if (u) {
    try {
      await api('/api/club/look', { look });
    } catch (e) {
      return toast(e.message, true);
    }
  }
  guardado = structuredClone(look);
  pintar();
  toast('¡Listo! Así te van a ver en los juegos.');
};
pintar();
