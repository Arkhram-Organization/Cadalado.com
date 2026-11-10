// Modelos 3D de Battle Shmitz hechos con piezas simples: armas, curas, munición, materiales, cofre,
// el colectivo volador, el monumento al Queque y la decoración. Medidas en píxeles del juego (1 baldosa = 16).
import * as THREE from '/comun/vendor/three.module.min.js';

const mats = new Map();
export function material(color, extra = {}) {
  const clave = color + JSON.stringify(extra);
  if (!mats.has(clave)) mats.set(clave, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra }));
  return mats.get(clave);
}
const geos = new Map();
const geo = (clave, crear) => { if (!geos.has(clave)) geos.set(clave, crear()); return geos.get(clave); };
const caja = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cil = (r1, r2, h, n = 12) => geo(`c${r1},${r2},${h},${n}`, () => new THREE.CylinderGeometry(r1, r2, h, n));
const esfera = (r, n = 12) => geo(`s${r},${n}`, () => new THREE.SphereGeometry(r, n, Math.max(6, n - 4)));

export function pieza(g, geometria, color, x = 0, y = 0, z = 0, extra = {}) {
  const m = new THREE.Mesh(geometria, typeof color === 'string' ? material(color, extra) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
const B = (g, w, h, d, color, x, y, z, extra) => pieza(g, caja(w, h, d), color, x, y, z, extra);
const C = (g, r1, r2, h, color, x, y, z, extra, n) => pieza(g, cil(r1, r2, h, n), color, x, y, z, extra);

// Texturas de franjas (globo, paracaídas, faro)
const texturas = new Map();
export function franjas(colores, vertical = true) {
  const clave = colores.join() + vertical;
  if (!texturas.has(clave)) {
    const c = document.createElement('canvas');
    c.width = vertical ? 256 : 4; c.height = vertical ? 4 : 256;
    const g = c.getContext('2d');
    const n = colores.length * 2;
    for (let i = 0; i < n; i++) { g.fillStyle = colores[i % colores.length]; if (vertical) g.fillRect((i * 256) / n, 0, 256 / n + 1, 4); else g.fillRect(0, (i * 256) / n, 4, 256 / n + 1); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texturas.set(clave, t);
  }
  return texturas.get(clave);
}
// Brillo redondo (para el piso debajo del botín y los cofres)
let texBrillo = null;
export function brillo() {
  if (!texBrillo) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    texBrillo = new THREE.CanvasTexture(c);
  }
  return texBrillo;
}
let texHaz = null;
function haz() {
  if (!texHaz) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d');
    const r = g.createLinearGradient(0, 0, 0, 128);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,.9)');
    g.fillStyle = r; g.fillRect(0, 0, 4, 128);
    texHaz = new THREE.CanvasTexture(c);
  }
  return texHaz;
}

const METAL = '#2c3236', METAL2 = '#454d52', MADERA = '#8a5a34', MADERA2 = '#6d4426';
// Armas: el caño apunta hacia -z. Una franja del color de la rareza en el cuerpo.
export function modeloArma(tipo, colorRareza = '#b9b9b9') {
  const g = new THREE.Group();
  const acento = (w, h, d, x, y, z) => B(g, w, h, d, colorRareza, x, y, z, { emissive: colorRareza, emissiveIntensity: 0.35 });
  switch (tipo) {
    case 'pistola':
      B(g, 1.6, 2, 6, METAL, 0, 1, -1); B(g, 1.4, 3.2, 1.6, METAL2, 0, -0.9, 1.1).rotation.x = -0.25;
      C(g, 0.45, 0.45, 2, METAL, 0, 1.3, -4.6).rotation.x = Math.PI / 2; acento(1.7, 0.5, 3, 0, 2.1, -1.5);
      break;
    case 'subfusil':
      B(g, 1.8, 2.4, 8, METAL, 0, 1, -1); B(g, 1.2, 3.6, 1.6, METAL2, 0, -1.4, -1.6); B(g, 1.3, 2.6, 1.4, METAL2, 0, -0.6, 1.6).rotation.x = -0.3;
      B(g, 1, 1.2, 3, METAL2, 0, 1.1, 4.2); C(g, 0.5, 0.5, 3, METAL, 0, 1.3, -6.2).rotation.x = Math.PI / 2; acento(1.9, 0.5, 4, 0, 2.4, -1);
      break;
    case 'escopeta':
      C(g, 0.6, 0.6, 12, METAL, 0, 1.6, -4).rotation.x = Math.PI / 2; C(g, 0.7, 0.7, 4, MADERA, 0, 0.6, -5.5).rotation.x = Math.PI / 2;
      B(g, 1.8, 2.2, 4, METAL2, 0, 1, 1.5); B(g, 1.6, 2.6, 5, MADERA, 0, 0.2, 5).rotation.x = 0.18; acento(1.9, 0.5, 2.5, 0, 2.2, 1.2);
      break;
    case 'rifle':
      B(g, 2, 2.6, 10, METAL, 0, 1, -1); B(g, 1.3, 4, 2, METAL2, 0, -1.5, -2).rotation.x = 0.25; B(g, 1.4, 2.8, 1.5, METAL2, 0, -0.9, 1.8).rotation.x = -0.3;
      B(g, 1.6, 2.4, 4, METAL2, 0, 0.8, 5.5); C(g, 0.55, 0.55, 4, METAL, 0, 1.4, -7.5).rotation.x = Math.PI / 2;
      C(g, 0.7, 0.7, 3, '#1b1f22', 0, 3, -1).rotation.x = Math.PI / 2; acento(2.1, 0.6, 5, 0, 2.3, -1.5);
      break;
    case 'francotirador':
      B(g, 1.8, 2.4, 10, METAL, 0, 1, 0); C(g, 0.5, 0.5, 9, METAL, 0, 1.4, -9.5).rotation.x = Math.PI / 2;
      C(g, 1.1, 1.1, 6, '#15191c', 0, 3.4, -0.5).rotation.x = Math.PI / 2; C(g, 1.3, 1.3, 0.6, colorRareza, 0, 3.4, -3.6, { emissive: colorRareza, emissiveIntensity: 0.6 }).rotation.x = Math.PI / 2;
      B(g, 1.6, 3, 5, MADERA2, 0, 0.2, 6.5).rotation.x = 0.12; B(g, 1.3, 2.6, 1.4, METAL2, 0, -0.8, 1.8).rotation.x = -0.3; acento(1.9, 0.5, 4, 0, 2.3, 1.5);
      break;
    case 'rpg':
      C(g, 1.6, 1.6, 13, '#4d5b3a', 0, 1.6, 0).rotation.x = Math.PI / 2; C(g, 1.9, 1.9, 1.4, METAL, 0, 1.6, 6.2).rotation.x = Math.PI / 2;
      C(g, 0.1, 1.5, 4, '#3d6b2b', 0, 1.6, -8.3).rotation.x = -Math.PI / 2; B(g, 1, 3, 1.4, METAL2, 0, -1, 1.5); B(g, 1, 2.6, 1.2, METAL2, 0, -0.8, -2.5);
      B(g, 0.6, 1.6, 2, METAL, 0, 3.6, -1); acento(3.3, 0.7, 1.2, 0, 1.6, 3.5);
      break;
    default:
      B(g, 2, 2, 6, METAL, 0, 1, 0);
  }
  return g;
}
export function modeloConsumible(tipo) {
  const g = new THREE.Group();
  switch (tipo) {
    case 'venda':
      C(g, 2.2, 2.2, 3.2, '#f4ede0', 0, 1.6, 0, {}, 16).rotation.z = Math.PI / 2; C(g, 0.9, 0.9, 3.3, '#d9cdb7', 0, 1.6, 0, {}, 12).rotation.z = Math.PI / 2;
      B(g, 3, 0.3, 4, '#f4ede0', 1.4, 0.15, 2.4);
      break;
    case 'botiquin':
      B(g, 6, 4.4, 4, '#f4f1ea', 0, 2.2, 0); B(g, 6.1, 1, 4.1, '#d9473a', 0, 3.6, 0); B(g, 1.2, 2.6, 0.3, '#d9473a', 0, 2, 2.1); B(g, 2.6, 1.2, 0.3, '#d9473a', 0, 2, 2.1);
      B(g, 2.4, 0.8, 0.8, '#3b3b3b', 0, 4.9, 0);
      break;
    case 'mini':
      pieza(g, esfera(2.2, 14), '#4fd6e8', 0, 2.2, 0, { emissive: '#2ab3d6', emissiveIntensity: 0.55, roughness: 0.2 }); C(g, 0.8, 0.8, 1.6, '#cfe9ef', 0, 4.6, 0); C(g, 1, 1, 0.6, '#3a6fb5', 0, 5.6, 0);
      break;
    case 'escudo':
      C(g, 2.8, 2.8, 5.2, '#3f8cff', 0, 2.6, 0, { emissive: '#2d6bff', emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.92 }, 18); C(g, 1.2, 2.6, 1.4, '#cfe0ff', 0, 5.9, 0); C(g, 1.3, 1.3, 1, '#20314f', 0, 7.1, 0);
      B(g, 1.2, 2.4, 0.4, '#ffffff', 0, 2.8, 2.8, { emissive: '#ffffff', emissiveIntensity: 0.4 });
      break;
    case 'granada':
      pieza(g, esfera(2.4, 12), '#5f6b3c', 0, 2.4, 0); C(g, 0.8, 0.8, 1.4, '#9aa08c', 0, 4.8, 0); pieza(g, geo('anillo', () => new THREE.TorusGeometry(0.9, 0.22, 6, 14)), '#d9d4c0', 1, 5.4, 0);
      break;
    default:
      B(g, 4, 4, 4, '#ccc', 0, 2, 0);
  }
  return g;
}
const COLOR_MUNICION = { livianas: '#e6d26b', medianas: '#7fd47a', pesadas: '#6aa7ff', cartuchos: '#ff7a5b', cohetes: '#c58aff' };
export function modeloMunicion(tipo) {
  const g = new THREE.Group();
  const color = COLOR_MUNICION[tipo.replace('balas-', '')] || '#ddd';
  B(g, 6, 3.6, 4.2, '#4a5534', 0, 1.8, 0); B(g, 6.1, 1, 4.3, color, 0, 2.6, 0, { emissive: color, emissiveIntensity: 0.3 }); B(g, 1.6, 0.6, 1, '#2b2f22', 0, 3.8, 0);
  return g;
}
export function modeloMaterial(tipo) {
  const g = new THREE.Group();
  if (tipo === 'madera') for (let i = 0; i < 4; i++) B(g, 7, 1.2, 1.8, i % 2 ? '#b98552' : '#a06d3f', 0, 0.7 + Math.floor(i / 2) * 1.3, (i % 2) * 2 - 1).rotation.y = (i % 3) * 0.12;
  else if (tipo === 'piedra') { B(g, 3.4, 2.6, 3, '#a7aaa5', -1.4, 1.3, 0); B(g, 3, 2.4, 3, '#8f9490', 1.6, 1.2, 0.4); B(g, 3, 2.2, 2.6, '#b6b9b2', 0, 3.4, 0.1); }
  else for (let i = 0; i < 3; i++) B(g, 6, 0.6, 4.4, i % 2 ? '#a9bfc8' : '#8aa4b0', 0, 0.4 + i * 0.7, 0, { metalness: 0.6, roughness: 0.35 }).rotation.y = i * 0.25;
  return g;
}
// Cofre: madera con bordes dorados; la tapa gira sobre la bisagra de atrás.
export function modeloCofre() {
  const g = new THREE.Group();
  const oro = { emissive: '#ffb020', emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.3 };
  B(g, 12, 6.5, 8, '#7a4a26', 0, 3.25, 0); B(g, 12.4, 1, 8.4, '#e8b33b', 0, 0.5, 0, oro); B(g, 12.4, 0.9, 8.4, '#e8b33b', 0, 6.2, 0, oro);
  for (const x of [-5.6, 5.6]) B(g, 1, 6.6, 8.5, '#e8b33b', x, 3.3, 0, oro);
  const tapa = new THREE.Group(); tapa.position.set(0, 6.5, 4); g.add(tapa);
  B(tapa, 12, 3, 8, '#8a5530', 0, 1.5, -4); B(tapa, 12.4, 0.8, 8.4, '#e8b33b', 0, 3.1, -4, oro);
  for (const x of [-5.6, 5.6]) B(tapa, 1, 3.2, 8.5, '#e8b33b', x, 1.6, -4, oro);
  B(g, 2.2, 2.6, 0.8, '#ffd76a', 0, 5.8, -4.4, { ...oro, emissiveIntensity: 0.9 });
  return { grupo: g, tapa };
}
// Brillo en el piso y haz de luz del color de la rareza
export function aura(color, alto = 0) {
  const g = new THREE.Group();
  const disco = new THREE.Mesh(geo('disco', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: brillo(), color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  disco.rotation.x = -Math.PI / 2; disco.position.y = 0.3; disco.scale.setScalar(16); disco.renderOrder = 2;
  g.add(disco);
  if (alto) {
    const columna = new THREE.Mesh(geo('haz', () => new THREE.CylinderGeometry(2.2, 3.4, 1, 16, 1, true)), new THREE.MeshBasicMaterial({ map: haz(), color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    columna.scale.y = alto; columna.position.y = alto / 2; columna.renderOrder = 2;
    g.add(columna);
  }
  return g;
}

// El colectivo volador: un colectivo colgado de un globo
export function modeloColectivo() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  B(cuerpo, 36, 11, 13, '#c5f04a', 0, 0, 0); B(cuerpo, 36.2, 3, 13.2, '#ff6b5b', 0, -3.5, 0); B(cuerpo, 36.3, 3.6, 13.3, '#20313d', 0, 2.6, 0, { emissive: '#3a6a8a', emissiveIntensity: 0.3, roughness: 0.15 });
  B(cuerpo, 34, 1.4, 12, '#f4f1ea', 0, 6, 0);
  for (const [x, z] of [[-11, 6.6], [11, 6.6], [-11, -6.6], [11, -6.6]]) C(cuerpo, 2.6, 2.6, 1.6, '#1b1b1b', x, -5.6, z, {}, 14).rotation.x = Math.PI / 2;
  B(cuerpo, 1, 6, 10, '#ffe08a', 18.2, -0.5, 0, { emissive: '#ffd166', emissiveIntensity: 0.6 });
  const globo = new THREE.Mesh(esfera(19, 24), new THREE.MeshStandardMaterial({ map: franjas(['#ff6b5b', '#f4f1ea', '#c5f04a', '#f4f1ea']), roughness: 0.6 }));
  globo.position.y = 38; globo.scale.y = 1.15; globo.castShadow = true; g.add(globo);
  C(g, 6, 4, 4, '#7a4a26', 0, 17, 0);
  const lineas = new THREE.BufferGeometry().setFromPoints([[-14, 7, -5], [-5, 23, -4], [14, 7, -5], [5, 23, -4], [-14, 7, 5], [-5, 23, 4], [14, 7, 5], [5, 23, 4]].map((p) => new THREE.Vector3(...p)));
  g.add(new THREE.LineSegments(lineas, new THREE.LineBasicMaterial({ color: '#3b2a1c' })));
  const fuego = new THREE.Mesh(esfera(2.4, 10), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  fuego.position.y = 21; g.add(fuego);
  g.userData.fuego = fuego;
  return g;
}
// Paracaídas: tela con franjas y cuerdas; la persona cuelga abajo (escala de la persona: 1 = 10 px)
export function modeloParacaidas() {
  const g = new THREE.Group();
  const tela = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ map: franjas(['#ff6b5b', '#ffd166', '#c5f04a', '#7aa2ff']), side: THREE.DoubleSide, roughness: 0.8 }));
  tela.scale.set(1.25, 0.55, 0.9); tela.position.y = 2.25; tela.castShadow = true; g.add(tela);
  const puntos = [];
  for (const [x, z] of [[-1.55, -0.6], [1.55, -0.6], [-1.55, 0.6], [1.55, 0.6], [0, -1.1], [0, 1.1]]) puntos.push(new THREE.Vector3(x * 0.95, 2.25, z * 0.8), new THREE.Vector3(x * 0.12, 1.25, z * 0.1));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineBasicMaterial({ color: '#2b2b2b' })));
  return g;
}

// El monumento al Queque, en el centro de la ciudad
export function modeloQueque() {
  const g = new THREE.Group();
  C(g, 22, 23, 4, '#cfc6b3', 0, 2, 0, {}, 32);
  C(g, 18, 18, 9, '#b9773f', 0, 8.5, 0, {}, 32);
  C(g, 18.4, 18.4, 2.2, '#fff4e8', 0, 13.5, 0, {}, 32);
  C(g, 13, 13, 8, '#c98a4f', 0, 18.6, 0, {}, 32);
  C(g, 13.4, 13.4, 2, '#ff9ec4', 0, 23.5, 0, {}, 32);
  C(g, 8, 8, 7, '#b9773f', 0, 27.5, 0, {}, 24);
  C(g, 8.4, 8.4, 2, '#fff4e8', 0, 31.6, 0, {}, 24);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pieza(g, esfera(1.4, 8), '#e0263a', Math.cos(a) * 16.2, 14.8, Math.sin(a) * 16.2); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pieza(g, esfera(1.2, 8), '#e0263a', Math.cos(a) * 11.5, 24.8, Math.sin(a) * 11.5); }
  pieza(g, esfera(3, 12), '#e0263a', 0, 34.5, 0, { emissive: '#7a0010', emissiveIntensity: 0.3 });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; C(g, 0.6, 0.6, 5, '#f4f1ea', Math.cos(a) * 5, 35, Math.sin(a) * 5); const llama = pieza(g, esfera(0.9, 6), '#ffcf5a', Math.cos(a) * 5, 38, Math.sin(a) * 5, { emissive: '#ffb020', emissiveIntensity: 1.2 }); llama.castShadow = false; }
  return g;
}

// Cartel con el nombre del lugar
export function cartel(texto) {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1d2a22'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#c5f04a'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 118);
  x.fillStyle = '#f4f1ea'; x.font = '900 64px "Barlow Condensed", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(texto, 256, 68, 470);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  for (const dx of [-11, 11]) C(g, 0.7, 0.7, 12, '#4a3a2c', dx, 6, 0);
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 1), [material('#1d2a22'), material('#1d2a22'), material('#1d2a22'), material('#1d2a22'), new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex })]);
  tabla.position.y = 11; tabla.castShadow = true; g.add(tabla);
  return g;
}
