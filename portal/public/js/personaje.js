// Casillero (como el locker de Fortnite): a la izquierda tu skin y los 8 gestos de la rueda de la B;
// tocás una casilla y elegís de la lista. A la derecha se ve el personaje elegido de cuerpo entero.
// Se guarda solo, en la cuenta (si entraste) y en este navegador; los juegos lo leen al entrar.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { avatarSvg } from '/comun/avatar.js';
import { NPCS, POR_ID } from '/comun/npcs.js';
import { GESTOS, POR_GESTO } from '/comun/gestos.js';
import { LOOK_BASE, limpiarLook, lookParaDibujo } from '/comun/look.js';
import { iniciarPagina, api, yo, esc, toast } from './comun.js';
import { pid } from '/comun/sala.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const CLAVE = 'cadalado.look';
const u = await yo();
const leerLocal = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; } };
let look = limpiarLook(u?.look || leerLocal() || LOOK_BASE);
let tienda = { mias: [], skins: [], rarezas: {} };
let vista = { panel: 'casillas', lugar: 0 }; // 'casillas' | 'skins' | 'gestos'
const COMUN = '#9aa4ad';

// ---------------------------------------------------------------- escena 3D (cuerpo entero)
const caja = $('[data-lienzo]');
const canvas = caja.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const escena = new THREE.Scene();
escena.add(new THREE.HemisphereLight('#f4f8ff', '#3a5aa8', 2.1));
const luz = new THREE.DirectionalLight('#fff6ea', 2.6); luz.position.set(-2, 4, 4); escena.add(luz);
const borde = new THREE.DirectionalLight('#9cc8ff', 2.2); borde.position.set(3, 2.5, -3); escena.add(borde);
const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
let persona = null, cargando = 0;
let giro = 0.35, giroObj = 0.35, anim = 'quieto', prueba = null; // prueba: gesto que se muestra un rato
let centro = new THREE.Vector3(0, 1, 0), dist = 6;
async function armar() {
  const n = ++cargando;
  const p = crearPersona(THREE, { ...lookParaDibujo(look), travesuras: {} }, { sombras: false });
  await p.listo;
  if (n !== cargando) { p.dispose?.(); return; }
  if (persona) { escena.remove(persona.grupo); persona.dispose?.(); }
  persona = p; escena.add(p.grupo);
  p.animar('quieto', 0);
  // todos del mismo tamaño en pantalla (los modelos miden ~2 de alto)
  centro.set(0, 1.0, 0);
  dist = (2.0 * 1.22) / 2 / Math.tan((14 * Math.PI) / 180);
  medir();
}
function medir() {
  const w = caja.clientWidth, h = caja.clientHeight;
  renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
  // en compu el personaje va un poco a la derecha (a la izquierda está el cartel con el nombre)
  const corrido = w > 700 ? 0.12 * dist * camara.aspect * Math.tan((14 * Math.PI) / 180) : 0;
  // los personajes miran a -Z: la cámara va de ese lado
  camara.position.set(centro.x + corrido, centro.y + dist * 0.05, centro.z - dist);
  camara.lookAt(centro.x + corrido, centro.y, centro.z);
}
addEventListener('resize', medir);
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => { arrastre = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (arrastre == null) return; giroObj += (e.clientX - arrastre) * 0.012; arrastre = e.clientX; });
canvas.addEventListener('pointerup', () => (arrastre = null));
let ultimo = performance.now();
function cuadro(ms) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ms - ultimo) / 1000); ultimo = ms;
  giro += (giroObj - giro) * Math.min(1, dt * 8);
  if (persona) {
    persona.grupo.rotation.y = giro;
    if (prueba && performance.now() > prueba.hasta) prueba = null;
    persona.animar('g-' + (prueba ? prueba.id : anim), dt);
  }
  renderer.render(escena, camara);
}
requestAnimationFrame(cuadro);
const ANIMS = [['quieto', 'Quieto'], ['camina', 'Caminar'], ['corre', 'Correr']];
function pintarAnims() {
  $('[data-anims]').innerHTML = ANIMS.map(([k, t]) => `<button class="${k === anim && !prueba ? 'on' : ''}" data-anim="${k}">${t}</button>`).join('');
}
function probar(id) { prueba = { id, hasta: performance.now() + Math.max(2.5, (POR_GESTO[id]?.dur || 3)) * 1000 }; pintarAnims(); }

// ---------------------------------------------------------------- miniaturas de los gestos (con tu skin)
const minis = new Map(); // `${skin}|${gesto}` -> dataURL
let motorMini = null, colaMini = Promise.resolve();
const claveSkin = () => look.npc || 'yo:' + JSON.stringify(lookParaDibujo(look)).length;
function miniatura(id) {
  const k = claveSkin() + '|' + id;
  if (!minis.has(k)) minis.set(k, (colaMini = colaMini.then(async () => {
    if (!motorMini) {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setClearColor(0, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
      const e = new THREE.Scene(); e.add(new THREE.HemisphereLight('#ffffff', '#5a7ac8', 2.4));
      const l = new THREE.DirectionalLight('#fff', 2); l.position.set(-1, 3, 4); e.add(l);
      motorMini = { r, e, c, cam: new THREE.PerspectiveCamera(32, 1, 0.1, 40), p: null, skin: null };
    }
    const m = motorMini;
    if (m.skin !== claveSkin()) {
      if (m.p) { m.e.remove(m.p.grupo); m.p.dispose?.(); }
      m.p = crearPersona(THREE, { ...lookParaDibujo(look), travesuras: {} }, { sombras: false }); await m.p.listo;
      m.e.add(m.p.grupo); m.skin = claveSkin(); m.p.grupo.rotation.y = -0.4;
    }
    m.p.grupo.traverse((o) => { if (o.isSprite) o.visible = false; });
    for (let i = 0; i < 20; i++) m.p.animar('g-quieto', 1 / 30);
    const g = POR_GESTO[id], t = Math.min(1.4, (g?.dur || 2) * 0.45);
    for (let s = 0; s < t; s += 1 / 30) m.p.animar('g-' + id, 1 / 30);
    m.p.grupo.traverse((o) => { if (o.isSprite) o.visible = false; });
    m.cam.position.set(0, 1.05, -3.7); m.cam.lookAt(0, 0.9, 0);
    m.r.render(m.e, m.cam);
    return m.c.toDataURL('image/png');
  })));
  return minis.get(k);
}
function llenarMinis() {
  for (const img of document.querySelectorAll('img[data-mini]')) miniatura(img.dataset.mini).then((url) => { if (img.isConnected) img.src = url; }).catch(() => {});
}

// ---------------------------------------------------------------- datos de cada skin
const tuya = (id) => !id || !tienda.skins.find((s) => s.id === id) || tienda.mias.includes(id);
function infoSkin(id) {
  if (!id) return { nombre: u?.nombre || 'Tu personaje', rareza: 'Tu personaje', color: '#c5f04a', frase: 'El que armaste vos.' };
  const s = tienda.skins.find((x) => x.id === id), r = tienda.rarezas[s?.rareza];
  return { nombre: POR_ID[id]?.nombre || id, rareza: r?.nombre || 'Del elenco', color: r?.color || COMUN, frase: s?.frase || '', precio: s?.precio };
}
const fotoSkin = (id) => (id ? `<img src="/img/tienda/${id}.webp" alt="" loading="lazy">` : `<span class="av">${avatarSvg(lookParaDibujo({ ...look, npc: '' }))}</span>`);

function pintarCartel() {
  const i = infoSkin(look.npc);
  $('[data-cartel]').style.setProperty('--r', i.color);
  $('[data-cartel]').innerHTML = `<span>${esc(i.rareza)}</span><h3>${esc(i.nombre)}</h3>${i.frase ? `<p>“${esc(i.frase)}”</p>` : ''}`;
}

// ---------------------------------------------------------------- panel de la izquierda
function pintar() {
  const p = $('[data-panel]');
  if (vista.panel === 'skins') {
    const orden = ['mitica', 'legendaria', 'epica', 'rara', 'comun'];
    const delElenco = NPCS.map((n) => n.id).sort((a, b) => {
      const sa = tienda.skins.find((s) => s.id === a), sb = tienda.skins.find((s) => s.id === b);
      return (tuya(b) - tuya(a)) || orden.indexOf(sa?.rareza) - orden.indexOf(sb?.rareza);
    });
    p.innerHTML = `<div class="cs-lista-cab"><button class="cs-volver" data-volver>‹ Volver</button><h2>Personaje</h2></div>
      <div class="cs-lista">
        <button class="cs-slot ${!look.npc ? 'on' : ''}" style="--r:#c5f04a" data-skin="">${fotoSkin('')}<b>${esc(u?.nombre || 'Tu personaje')}</b></button>
        ${delElenco.map((id) => { const i = infoSkin(id), mia = tuya(id);
          return mia ? `<button class="cs-slot ${look.npc === id ? 'on' : ''}" style="--r:${i.color}" data-skin="${id}" title="${esc(i.rareza)}">${fotoSkin(id)}<b>${esc(i.nombre)}</b></button>`
            : `<a class="cs-slot bloqueada" style="--r:${i.color}" href="/tienda" title="Comprala en la tienda">${fotoSkin(id)}<span class="cs-candado">Tienda</span><b>${esc(i.nombre)}</b></a>`; }).join('')}
      </div>
      <p class="cs-nota">Las grises se consiguen en la <a href="/tienda">tienda</a> con las fichas que ganás jugando.</p>`;
  } else if (vista.panel === 'gestos') {
    const lugar = vista.lugar, actual = look.gestos[lugar];
    p.innerHTML = `<div class="cs-lista-cab"><button class="cs-volver" data-volver>‹ Volver</button><h2>Gesto ${lugar + 1} <small>tecla ${lugar + 1} en la rueda</small></h2></div>
      <div class="cs-lista de-gestos">
        ${GESTOS.map((g) => { const en = look.gestos.indexOf(g.id);
          return `<button class="cs-slot cs-gesto-img ${g.id === actual ? 'on' : ''}" data-elegir-gesto="${g.id}"><img data-mini="${g.id}" alt="">${en >= 0 ? `<i>${en + 1}</i>` : ''}<b>${esc(g.nombre)}</b></button>`; }).join('')}
      </div>
      <div class="cs-info"><b>${esc(POR_GESTO[actual]?.nombre || '')}</b> está en el lugar ${lugar + 1}. Tocá otro para cambiarlo; si ya estaba en otro lugar, se intercambian.</div>`;
  } else {
    const i = infoSkin(look.npc);
    p.innerHTML = `<h1 class="cs-titulo">Casillero</h1>
      <h2>Personaje</h2>
      <button class="cs-slot cs-skin" style="--r:${i.color}" data-abrir="skins">${fotoSkin(look.npc)}<span class="cs-mas">+</span><b>${esc(i.nombre)}</b></button>
      <h2>Gestos <small>la rueda de la B · 1 a 8</small></h2>
      <div class="cs-gestos">${look.gestos.map((id, k) => `<button class="cs-slot cs-gesto-img" data-lugar="${k}" title="${esc(POR_GESTO[id]?.nombre || '')}"><img data-mini="${id}" alt=""><i>${k + 1}</i><b>${esc(POR_GESTO[id]?.nombre || '')}</b></button>`).join('')}</div>
      <p class="cs-nota">${u ? `Se guarda solo en tu cuenta (${esc(u.nombre)}).` : 'Se guarda solo en este navegador. <a href="/entrar?volver=/personaje">Entrá al club</a> para tenerlo en todos lados.'}</p>`;
  }
  llenarMinis();
  pintarCartel();
}

// ---------------------------------------------------------------- guardar (solo, al cambiar algo)
let tGuardar = 0;
function guardar() {
  look = limpiarLook(look);
  try { localStorage.setItem(CLAVE, JSON.stringify(look)); } catch {}
  clearTimeout(tGuardar);
  if (u) tGuardar = setTimeout(() => api('/api/club/look', { look }).catch((e) => toast(e.message, true)), 400);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-anim]');
  if (a) { anim = a.dataset.anim; prueba = null; return pintarAnims(); }
  if (e.target.closest('[data-abrir="skins"]')) { vista = { panel: 'skins' }; return pintar(); }
  const l = e.target.closest('[data-lugar]');
  if (l) { vista = { panel: 'gestos', lugar: +l.dataset.lugar }; probar(look.gestos[vista.lugar]); return pintar(); }
  if (e.target.closest('[data-volver]')) { vista = { panel: 'casillas' }; return pintar(); }
  const s = e.target.closest('[data-skin]');
  if (s) {
    if (look.npc === s.dataset.skin) return;
    look = { ...look, npc: s.dataset.skin }; guardar(); armar(); pintar();
    toast(`Ahora jugás como ${infoSkin(look.npc).nombre}`);
    return;
  }
  const g = e.target.closest('[data-elegir-gesto]');
  if (g) {
    const id = g.dataset.elegirGesto, lugar = vista.lugar, otro = look.gestos.indexOf(id);
    const gestos = [...look.gestos];
    if (otro >= 0 && otro !== lugar) gestos[otro] = gestos[lugar]; // se intercambian
    gestos[lugar] = id;
    look = { ...look, gestos }; guardar(); probar(id); pintar();
  }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && vista.panel !== 'casillas') { vista = { panel: 'casillas' }; pintar(); } });

pintarAnims();
pintar();
armar();
api('/api/club/tienda?pid=' + encodeURIComponent(pid())).then((d) => { tienda = d; pintar(); }).catch(() => {});
