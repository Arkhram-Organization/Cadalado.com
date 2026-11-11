// Dibujo 3D de Full Gays con three.js: mapas, obstáculos, personitas y cámara.
import * as THREE from '../vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { MAPAS, estaticos, moviles, rng } from './pista.js';
import { Y_AGUA } from './fisica.js';

const PALETAS = {
  1: [0xff6b84,0x61c8d0,0xffcd65,0x9be15d,0xf4f1ea,0x9a79df],
  2: [0xf2a34c,0x4a718b,0x69c4c7,0xd3e17d,0xd5e4e8,0xc5739a],
  3: [0xcb6ee5,0x657cda,0xc5f04a,0x7acbb8,0xf4f1ea,0xe99a58],
  4: [0xff7166,0x388dd9,0xffd34e,0x4ed4c8,0xfff2dd,0xb776e8],
  5: [0x5ce4d4,0x556b9c,0xf0a14c,0xa4b4c4,0xe5edf2,0xd56ebf],
};
// Cada mapa tiene su cielo, su agua y su decorado alrededor de la pista.
const TEMAS = {
  1: { cielo: ['#2f7fe0', '#8fd3ff', '#e9f8ff'], agua: 0x2f9bea, sol: 0xffffff, nube: 0xffffff, decor: 'playa' },
  2: { cielo: ['#27688d', '#9cc5d2', '#f1f3dc'], agua: 0x2a8fa6, sol: 0xfff0cf, nube: 0xf6f3e6, decor: 'taller' },
  3: { cielo: ['#22165c', '#8a5fd6', '#ffb3d9'], agua: 0x5b45c4, sol: 0xffd2ec, nube: 0xf3d9ff, decor: 'final' },
  4: { cielo: ['#ff5fa2', '#ffb56b', '#fff2c2'], agua: 0xffc7dc, sol: 0xfff0d0, nube: 0xfff4f8, decor: 'carnaval', mar: 'nubes' },
  5: { cielo: ['#30426a', '#839bbd', '#e3ebf5'], agua: 0x3d6187, sol: 0xe6efff, nube: 0xe9eef5, decor: 'fabrica' },
};
const _dirSol = new THREE.Vector3(0.34, 0.42, -0.84).normalize().multiplyScalar(330);
const ARCO = [0xff4d5e, 0xff9f43, 0xffe066, 0x51cf66, 0x4dabf7, 0xb197fc];

function lienzo(w, h = w) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')];
}
function aTextura(cv, repetir = false) {
  const t = new THREE.CanvasTexture(cv);
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaCielo([arriba, medio, horizonte]) {
  const [cv, g] = lienzo(8, 256);
  const d = g.createLinearGradient(0, 0, 0, 256);
  d.addColorStop(0, arriba);
  d.addColorStop(0.36, medio);
  d.addColorStop(0.5, horizonte);
  d.addColorStop(0.6, horizonte);
  d.addColorStop(1, medio);
  g.fillStyle = d;
  g.fillRect(0, 0, 8, 256);
  return aTextura(cv);
}
function texturaSol() {
  const [cv, g] = lienzo(256);
  const d = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.12, 'rgba(255,255,255,.95)');
  d.addColorStop(0.3, 'rgba(255,255,255,.28)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 256, 256);
  return aTextura(cv);
}
// Olas claras sobre gris: el color lo pone el material (cambia con cada mapa).
function texturaAgua() {
  const [cv, g] = lienzo(256);
  g.fillStyle = '#c3ced8';
  g.fillRect(0, 0, 256, 256);
  g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const y0 = 18 + k * 36.5;
    g.strokeStyle = `rgba(255,255,255,${k % 2 ? 0.75 : 0.4})`;
    g.lineWidth = k % 2 ? 5 : 3;
    for (const dx of [-256, 0, 256]) {
      g.beginPath();
      for (let x = 0; x <= 150; x += 6) {
        const px = dx + ((k * 97) % 256) + x;
        const py = y0 + Math.sin((x / 150) * Math.PI * 2) * 6;
        if (x) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.stroke();
    }
  }
  return aTextura(cv, true);
}
// Piso a cuadros en dos tonos (el color lo pone el material).
function texturaPiso() {
  const [cv, g] = lienzo(128);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#dcdcdc';
  g.fillRect(0, 0, 64, 64);
  g.fillRect(64, 64, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 64, 64);
  g.strokeRect(64, 64, 64, 64);
  return aTextura(cv, true);
}
function texturaTurbo() {
  const [cv, g] = lienzo(128);
  g.fillStyle = '#ff4fa3';
  g.fillRect(0, 0, 128, 128);
  for (const [y, c] of [[4, '#ffffff'], [68, '#c5f04a']]) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(14, y + 46);
    g.lineTo(64, y);
    g.lineTo(114, y + 46);
    g.lineTo(90, y + 46);
    g.lineTo(64, y + 22);
    g.lineTo(38, y + 46);
    g.fill();
  }
  return aTextura(cv, true);
}
function texturaDiana(c1 = '#ff4fa3', c2 = '#ffffff') {
  const [cv, g] = lienzo(128);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i % 2 ? c2 : c1;
    g.beginPath();
    g.arc(64, 64, 64 - i * 13, 0, 7);
    g.fill();
  }
  return aTextura(cv);
}
function texturaPunto() {
  const [cv, g] = lienzo(64);
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.55, 'rgba(255,255,255,.85)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  return aTextura(cv);
}

function texturaRayas(c1, c2, n = 8, vertical = false) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? c1 : c2;
    if (vertical) g.fillRect(0, (i * 128) / n, 128, 128 / n + 1);
    else g.fillRect((i * 128) / n, 0, 128 / n + 1, 128);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaCuadros(n = 8) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
    g.fillRect((i * 128) / n, (j * 128) / n, 128 / n, 128 / n);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Cinta transportadora: flechas que se mueven
function texturaCinta() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#2b2b33';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffd166';
  for (const y of [8, 72]) {
    g.beginPath();
    g.moveTo(24, y + 40);
    g.lineTo(64, y);
    g.lineTo(104, y + 40);
    g.lineTo(84, y + 40);
    g.lineTo(64, y + 20);
    g.lineTo(44, y + 40);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function cartel(texto, color = '#fff', fondo = 'rgba(20,20,19,.78)') {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.font = '800 64px Barlow Condensed, Barlow, sans-serif';
  const w = Math.min(500, g.measureText(texto).width + 56);
  g.fillStyle = fondo;
  g.beginPath();
  g.roundRect((512 - w) / 2, 16, w, 96, 44);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, 256, 66, 470);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(4, 1, 1);
  return s;
}

// ---------------------------------------------------------------- decorado
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
let matsArco = null;
function arcoIris(radio = 12.7, tubo = 0.27) {
  matsArco ||= ARCO.map((c) => std(c, { emissive: c, emissiveIntensity: 0.28 }));
  const g = new THREE.Group();
  ARCO.forEach((_, i) => g.add(new THREE.Mesh(new THREE.TorusGeometry(radio - i * tubo * 1.85, tubo, 8, 44, Math.PI), matsArco[i])));
  // nubecitas en los pies
  const nube = std(0xffffff, { roughness: 1 });
  for (const lado of [-1, 1]) {
    for (const [dx, dy, dz, r] of [[0, 0.2, 0, 1.5], [1.2, 0, 0.5, 1.1], [-1.3, 0.1, -0.4, 1.2], [0.2, 0.9, -0.2, 1.0]]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), nube);
      s.position.set(lado * (radio - tubo * 4.5) + dx, dy, dz);
      g.add(s);
    }
  }
  return g;
}
function nubeSuelta(r, color, n = 4) {
  const mat = std(color, { roughness: 1 });
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(2 + r() * 2.5, 10, 8), mat);
    s.position.set(k * 2.4 - (n - 1) * 1.2, r() * 1.2, r() * 1.5);
    g.add(s);
  }
  return g;
}
function isla(radio, colorTapa, colorRoca = 0x8a6f5a) {
  const g = new THREE.Group();
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 0.92, 0.9, 18), std(colorTapa));
  const roca = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.9, radio * 1.5, 9), std(colorRoca, { roughness: 0.9, flatShading: true }));
  roca.rotation.x = Math.PI;
  roca.position.y = -0.45 - radio * 0.75;
  g.add(tapa, roca);
  return g;
}
function palmera() {
  const g = new THREE.Group();
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 4.4, 8), std(0xb07b4f));
  tronco.position.y = 2.2;
  tronco.rotation.z = 0.12;
  g.add(tronco);
  const hoja = std(0x3fbf6b, { side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const piv = new THREE.Group();
    piv.position.set(-0.26, 4.4, 0);
    piv.rotation.y = (i / 7) * Math.PI * 2;
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.8, 4), hoja);
    h.scale.z = 0.22;
    h.rotation.z = -1.15;
    h.position.set(1.2, -0.25, 0);
    piv.add(h);
    g.add(piv);
  }
  for (const [x, z] of [[-0.1, 0.25], [-0.45, -0.1]]) {
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), std(0x6b4a2f));
    coco.position.set(x, 4.15, z);
    g.add(coco);
  }
  return g;
}
function globo(color) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), std(color, { roughness: 0.25 }));
  b.scale.y = 1.2;
  const nudo = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 8), std(color));
  nudo.position.y = -1.2;
  const hilo = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), std(0xffffff));
  hilo.position.y = -2.8;
  g.add(b, nudo, hilo);
  return g;
}
function engranaje(radio, color) {
  const g = new THREE.Group();
  const mat = std(color, { roughness: 0.4, metalness: 0.25 });
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 0.7, 28), mat);
  disco.rotation.x = Math.PI / 2;
  g.add(disco);
  const dientes = Math.round(radio * 3.2);
  for (let i = 0; i < dientes; i++) {
    const a = (i / dientes) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.7), mat);
    d.position.set(Math.cos(a) * (radio + 0.25), Math.sin(a) * (radio + 0.25), 0);
    d.rotation.z = a;
    g.add(d);
  }
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.32, radio * 0.32, 0.9, 16), std(0xf4f1ea));
  eje.rotation.x = Math.PI / 2;
  g.add(eje);
  return g;
}
function aerostatico(c1, c2) {
  const g = new THREE.Group();
  const tex = texturaRayas(c1, c2, 10);
  const b = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  b.scale.y = 1.18;
  const boca = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 1.2, 12, 1, true), std(0x8a6f5a, { side: THREE.DoubleSide }));
  boca.position.y = -3.9;
  const canasta = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 1.3), std(0xb07b4f));
  canasta.position.y = -6;
  g.add(b, boca, canasta);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const soga = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), std(0xffffff));
    soga.position.set(x, -4.9, z);
    g.add(soga);
  }
  return g;
}
function noria(radio = 7) {
  const g = new THREE.Group();
  const rueda = new THREE.Group();
  const aro = std(0xffffff, { emissive: 0xff4fa3, emissiveIntensity: 0.25 });
  rueda.add(new THREE.Mesh(new THREE.TorusGeometry(radio, 0.22, 8, 40), aro));
  rueda.add(new THREE.Mesh(new THREE.TorusGeometry(radio * 0.55, 0.14, 8, 32), aro));
  const cabinas = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rayo = new THREE.Mesh(new THREE.BoxGeometry(radio * 2, 0.14, 0.14), aro);
    if (i < 4) {
      rayo.rotation.z = a;
      rueda.add(rayo);
    }
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.2), std(ARCO[i % ARCO.length]));
    c.position.set(Math.cos(a) * radio, Math.sin(a) * radio - 0.9, 0);
    c.userData.a = a;
    rueda.add(c);
    cabinas.push(c);
  }
  rueda.position.y = radio + 2;
  g.add(rueda);
  for (const lado of [-1, 1]) {
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, radio + 3.2, 8), std(0x657cda));
    pata.position.set(lado * 2.2, (radio + 2) / 2, 0);
    pata.rotation.z = lado * 0.24;
    g.add(pata);
  }
  g.userData = { rueda, cabinas, radio };
  return g;
}
function banderines(ancho, alto, r) {
  const n = 16;
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const u1 = (i + 0.82) / n;
    const y = (u) => alto - Math.sin(u * Math.PI) * 1.6;
    const x0 = (u0 - 0.5) * ancho;
    const x1 = (u1 - 0.5) * ancho;
    pos.push(x0, y(u0), 0, x1, y(u1), 0, (x0 + x1) / 2, (y(u0) + y(u1)) / 2 - 1.15, 0);
    c.setHex(ARCO[(i + Math.floor(r() * 6)) % ARCO.length]);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, alto + 1.5, 8), std(0xffffff));
    poste.position.set((lado * ancho) / 2, (alto - 1.5) / 2, 0);
    g.add(poste);
  }
  return g;
}
function chimenea(escena, r) {
  const g = new THREE.Group();
  const tex = texturaRayas('#f4f1ea', '#e0556a', 6, true);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 6, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  tubo.position.y = 3;
  g.add(tubo);
  const geo = new THREE.SphereGeometry(1, 10, 8);
  const fase = r() * 5;
  for (let i = 0; i < 4; i++) {
    const humo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true }));
    g.add(humo);
    escena.animados.push((t) => {
      const k = ((t * 0.22 + fase + i / 4) % 1 + 1) % 1;
      humo.position.set(Math.sin(k * 5 + i) * 0.8, 6.3 + k * 9, k * 2.5);
      humo.scale.setScalar(0.7 + k * 2.2);
      humo.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.95;
    });
  }
  return g;
}
function corona() {
  const g = new THREE.Group();
  const oro = std(0xffd34e, { emissive: 0xffa800, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.3 });
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.1, 1.2, 24, 1, true), oro);
  oro.side = THREE.DoubleSide;
  g.add(aro);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pico = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.7, 4), oro);
    pico.position.set(Math.cos(a) * 2.2, 1.35, Math.sin(a) * 2.2);
    const joya = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), std(ARCO[i], { emissive: ARCO[i], emissiveIntensity: 0.6 }));
    joya.position.set(Math.cos(a) * 2.2, 2.35, Math.sin(a) * 2.2);
    g.add(pico, joya);
  }
  return g;
}

// Todo lo que rodea a la pista: depende del tema del mapa y siempre queda igual para el mismo mapa.
function decorar(escena, mapaId, mapa, tema, g) {
  const r = rng(mapaId * 9973 + 5);
  const anim = escena.animados;
  const fin = mapa.META_Z;
  // nubes sueltas a los costados (se mueven despacito)
  for (let i = 0; i < 26; i++) {
    const n = nubeSuelta(r, tema.nube);
    const lado = r() < 0.5 ? -1 : 1;
    const x0 = lado * (32 + r() * 70);
    const bajo = tema.mar === 'nubes' && i % 2 === 0;
    n.position.set(x0, bajo ? Y_AGUA + 1 + r() * 2 : -3 + r() * 28, 25 + (fin - 60) * r());
    if (bajo) n.scale.setScalar(1.8);
    const vel = 0.25 + r() * 0.5;
    const f = r() * 40;
    anim.push((t) => (n.position.x = x0 + Math.sin(t * 0.05 * vel + f) * 9));
    g.add(n);
  }
  if (tema.mar === 'nubes') {
    // el "mar" es un colchón de nubes pegado a la pista también
    for (let i = 0; i < 34; i++) {
      const n = nubeSuelta(r, 0xffffff, 3);
      n.position.set((r() - 0.5) * 70, Y_AGUA + 0.4 + r() * 1.5, 12 + (fin - 30) * r());
      n.scale.setScalar(1.3 + r());
      g.add(n);
    }
  }
  // globos que flotan al borde de la pista
  for (let z = -10; z > fin; z -= 17) {
    for (const lado of [-1, 1]) {
      if (r() < 0.25) continue;
      const racimo = new THREE.Group();
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const b = globo(ARCO[Math.floor(r() * ARCO.length)]);
        b.position.set((k - (n - 1) / 2) * 1.5, r() * 1.2, r() - 0.5);
        b.rotation.z = (k - (n - 1) / 2) * -0.18;
        racimo.add(b);
      }
      const y0 = 7 + r() * 5;
      racimo.position.set(lado * (13.5 + r() * 4), y0, z + r() * 8);
      const f = r() * 6;
      anim.push((t) => {
        racimo.position.y = y0 + Math.sin(t * 0.9 + f) * 0.45;
        racimo.rotation.z = Math.sin(t * 0.6 + f) * 0.07;
      });
      g.add(racimo);
    }
  }
  // islas flotantes con lo propio de cada mapa
  const tapas = { playa: 0xffe2a6, taller: 0xc9d2d6, final: 0xb48cf2, carnaval: 0xff9ec4, fabrica: 0xa9b8cc };
  const rocas = { playa: 0x9c7a5c, taller: 0x4a5f6e, final: 0x4b3a8f, carnaval: 0xd0668f, fabrica: 0x55657f };
  let cuenta = 0;
  for (let z = 4; z > fin - 14; z -= 21) {
    for (const lado of [-1, 1]) {
      cuenta++;
      const radio = 3.6 + r() * 2.4;
      const base = isla(radio, tapas[tema.decor], rocas[tema.decor]);
      const y0 = -4 + r() * 7;
      base.position.set(lado * (21 + r() * 15), y0, z - r() * 12);
      const f = r() * 6;
      anim.push((t) => (base.position.y = y0 + Math.sin(t * 0.5 + f) * 0.5));
      g.add(base);
      const tipo = cuenta % 3;
      if (tema.decor === 'playa') {
        const p = palmera();
        p.position.y = 0.4;
        p.rotation.y = r() * 6;
        base.add(p);
        if (tipo === 0) {
          const pelota = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ map: texturaRayas('#ff4d5e', '#ffffff', 8), roughness: 0.4 }));
          pelota.position.set(radio * 0.45, 1.4, radio * 0.3);
          base.add(pelota);
        } else if (tipo === 1) {
          const flot = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.6, 12, 28), new THREE.MeshStandardMaterial({ map: texturaRayas('#ff4fa3', '#ffffff', 12), roughness: 0.35 }));
          flot.position.set(-radio * 0.2, 5 + r() * 3, 0);
          anim.push((t) => { flot.rotation.y = t * 0.6 + f; flot.rotation.x = Math.sin(t * 0.7 + f) * 0.4; });
          base.add(flot);
        }
      } else if (tema.decor === 'taller' || tema.decor === 'fabrica') {
        if (tema.decor === 'fabrica' && tipo !== 1) {
          const ch = chimenea(escena, r);
          ch.position.y = 0.4;
          base.add(ch);
        } else {
          const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 5, 10), std(0xf4f1ea));
          poste.position.y = 2.9;
          base.add(poste);
          const e1 = engranaje(2.4 + r(), [0xf2a34c, 0x69c4c7, 0xc5739a, 0xd3e17d][cuenta % 4]);
          e1.position.set(0, 5.6, 0.5);
          e1.rotation.y = lado * -0.5;
          const e2 = engranaje(1.5, 0xd5e4e8);
          e2.position.set(3.4, 7.6, 0.5);
          e2.rotation.y = e1.rotation.y;
          const vel = 0.5 + r() * 0.5;
          anim.push((t) => { e1.rotation.z = t * vel; e2.rotation.z = -t * vel * 1.7; });
          base.add(e1, e2);
        }
      } else if (tema.decor === 'carnaval') {
        if (cuenta === 3 || cuenta === 8) {
          const n = noria(6.5);
          n.position.y = 0.4;
          n.rotation.y = lado * -0.9;
          const { rueda, cabinas, radio: rr } = n.userData;
          anim.push((t) => {
            rueda.rotation.z = t * 0.25;
            for (const c of cabinas) {
              const a = c.userData.a;
              c.rotation.z = -rueda.rotation.z;
              c.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
            }
          });
          base.add(n);
        } else {
          // carpa de circo
          const carpa = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.7, 3.2, 12), new THREE.MeshStandardMaterial({ map: texturaRayas('#ff4d5e', '#ffffff', 12), roughness: 0.6 }));
          carpa.position.y = 4.2;
          const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.62, radio * 0.62, 2.4, 12), new THREE.MeshStandardMaterial({ map: texturaRayas('#ffe066', '#ffffff', 12), roughness: 0.6 }));
          cuerpo.position.y = 1.6;
          const banderita = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 3), std(0x4dabf7));
          banderita.position.y = 6.2;
          base.add(carpa, cuerpo, banderita);
        }
      } else if (tema.decor === 'final') {
        // columnas de luz y estrellas
        const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.6, 34, 16, 1, true), new THREE.MeshBasicMaterial({ color: ARCO[cuenta % 6], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        const piv = new THREE.Group();
        haz.position.y = 17;
        piv.add(haz);
        piv.position.y = 0.5;
        anim.push((t) => { piv.rotation.z = Math.sin(t * 0.7 + f) * 0.35; piv.rotation.x = Math.cos(t * 0.5 + f) * 0.25; });
        const foco = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.2, 12), std(0x2a1f4f));
        foco.position.y = 0.9;
        base.add(piv, foco);
      }
    }
  }
  if (tema.decor === 'final') {
    const estrella = new THREE.OctahedronGeometry(0.7);
    for (let i = 0; i < 46; i++) {
      const c = ARCO[i % 6];
      const e = new THREE.Mesh(estrella, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xfff3b0 : c, fog: false }));
      const lado = i % 2 ? -1 : 1;
      e.position.set(lado * (12 + r() * 50), 6 + r() * 34, 10 + (fin - 50) * r());
      const f = r() * 6;
      const s0 = 0.5 + r() * 0.9;
      anim.push((t) => { e.rotation.y = t + f; e.scale.setScalar(s0 * (0.75 + 0.35 * Math.sin(t * 2.4 + f))); });
      g.add(e);
    }
    const c = corona();
    c.position.set(0, mapa.metaY + 12.5, fin - 2);
    anim.push((t) => { c.rotation.y = t * 0.7; c.position.y = mapa.metaY + 12.5 + Math.sin(t * 1.3) * 0.5; });
    g.add(c);
  }
  if (tema.decor === 'carnaval') {
    // banderines cruzando la pista y globos aerostáticos de fondo
    for (let z = -12; z > fin + 6; z -= 19) {
      const b = banderines(24, 9.5, r);
      b.position.set(0, 0, z - r() * 4);
      g.add(b);
    }
    for (let i = 0; i < 5; i++) {
      const a = aerostatico(['#ff4d5e', '#4dabf7', '#51cf66', '#b197fc', '#ff9f43'][i], i % 2 ? '#ffffff' : '#ffe066');
      const lado = i % 2 ? -1 : 1;
      const x0 = lado * (30 + r() * 30);
      const y0 = 12 + r() * 16;
      a.position.set(x0, y0, -10 + (fin - 10) * (i / 4));
      const f = r() * 6;
      anim.push((t) => { a.position.y = y0 + Math.sin(t * 0.35 + f) * 1.6; a.position.x = x0 + Math.sin(t * 0.12 + f) * 5; a.rotation.y = t * 0.1 + f; });
      g.add(a);
    }
  }
  if (tema.decor === 'playa') {
    // patitos de goma... no: boyas a rayas flotando en el agua
    for (let i = 0; i < 16; i++) {
      const boya = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.5, 10, 22), new THREE.MeshStandardMaterial({ map: texturaRayas(i % 2 ? '#ff4d5e' : '#ffe066', '#ffffff', 10), roughness: 0.4 }));
      boya.rotation.x = Math.PI / 2;
      const lado = i % 2 ? -1 : 1;
      boya.position.set(lado * (11 + r() * 16), Y_AGUA + 0.25, -4 + (fin - 4) * r());
      const f = r() * 6;
      anim.push((t) => { boya.position.y = Y_AGUA + 0.25 + Math.sin(t * 1.4 + f) * 0.18; boya.rotation.z = Math.sin(t * 0.8 + f) * 0.12; });
      g.add(boya);
    }
  }
  // un arco iris gigante de fondo, detrás de la meta
  const fondo = arcoIris(26, 0.7);
  fondo.position.set(0, Y_AGUA + 1, fin - 26);
  g.add(fondo);
}

export class Escena {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd3ff);
    this.scene.fog = new THREE.Fog(0x8fd3ff, 70, 210);
    this.camara = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.camara.position.set(0, 6, 8);
    this.personajes = new Map();
    this.camPos = new THREE.Vector3(0, 6, 8);
    this.mirar = new THREE.Vector3(0, 1, -3);

    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6a7a90, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(20, 40, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
    this.sol = sol;
    this.scene.add(sol, sol.target);

    this.hemi = this.scene.children.find((o) => o.isHemisphereLight);
    // cielo en degradé (una esfera que acompaña a la cámara) y el sol
    this.cielo = new THREE.Mesh(new THREE.SphereGeometry(370, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
    this.cielo.renderOrder = -2;
    this.astro = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaSol(), fog: false, depthWrite: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.astro.scale.set(170, 170, 1);
    this.astro.renderOrder = -1;
    this.scene.add(this.cielo, this.astro);
    // el agua de abajo, con olas que se mueven
    this.texAgua = texturaAgua();
    this.texAgua.repeat.set(46, 46);
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x2f9bea, map: this.texAgua, roughness: 0.22, metalness: 0.12 }));
    agua.rotation.x = -Math.PI / 2;
    agua.position.set(0, Y_AGUA, -80);
    agua.receiveShadow = false;
    this.scene.add(agua); this.agua = agua;
    this.texPiso = texturaPiso();
    this.texPunto = texturaPunto();
    this.reloj = 0;
    this.animados = [];
    this.fov = 60;
    this.sacudon = 0;
    this.mov = new THREE.Group();
    this.scene.add(this.mov);
    this.redimensionar();
    this._resize = () => this.redimensionar();
    addEventListener('resize', this._resize);
  }

  redimensionar() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- mapa
  construirMapa(mapaId, semilla) {
    if (this.pista) this.scene.remove(this.pista);
    this.mapaId = mapaId;
    this.semilla = semilla;
    const mapa = MAPAS[mapaId];
    const tema = TEMAS[mapaId] || TEMAS[1];
    this.tema = tema;
    const horizonte = new THREE.Color(tema.cielo[2]);
    this.scene.background = horizonte;
    this.scene.fog.color.copy(horizonte);
    this.cielo.material.map?.dispose();
    this.cielo.material.map = texturaCielo(tema.cielo);
    this.cielo.material.needsUpdate = true;
    this.astro.material.color.setHex(tema.sol);
    this.sol.color.setHex(tema.sol);
    this.agua.material.color.setHex(tema.agua);
    this.agua.material.roughness = tema.mar === 'nubes' ? 1 : 0.22;
    const est = estaticos(mapaId);
    const g = new THREE.Group();
    const mats = PALETAS[mapaId].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    // Los pisos grandes van a cuadros en dos tonos (se nota la velocidad al correr).
    const tapas = new Map();
    const tapa = (c) => {
      const k = `${c.c}:${c.w}:${c.d}`;
      if (!tapas.has(k)) {
        const tex = this.texPiso.clone();
        tex.needsUpdate = true;
        tex.repeat.set(c.w / 4, c.d / 4);
        tapas.set(k, new THREE.MeshStandardMaterial({ color: PALETAS[mapaId][c.c], map: tex, roughness: 0.5 }));
      }
      return tapas.get(k);
    };
    for (const c of est.cajas) {
      const lado = mats[c.c];
      const grande = c.w >= 2.5 && c.d >= 2.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), grande ? [lado, lado, tapa(c), lado, lado, lado] : lado);
      m.position.set(c.x, c.y, c.z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    this.cintas = [];
    for (const c of est.cintas) {
      const tex = texturaCinta();
      tex.repeat.set(c.w / 4, c.d / 4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, 1, c.d), [mats[4], mats[4], new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), mats[4], mats[4], mats[4]]);
      m.position.set(c.x, c.y - 0.5, c.z);
      m.receiveShadow = true;
      g.add(m);
      this.cintas.push({ tex, vz: c.vz, d: c.d });
    }
    for (const r of est.rampas) {
      const largo = Math.hypot(r.z0 - r.z1, r.y1 - r.y0);
      const tex = texturaRayas('#ffd166', '#ffb703', 10);
      tex.repeat.set(1, 3);
      const rampa = new THREE.Mesh(new THREE.BoxGeometry(r.ancho, 0.6, largo), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      rampa.position.set(r.x, (r.y0 + r.y1) / 2 - 0.3, (r.z0 + r.z1) / 2);
      rampa.rotation.x = Math.atan2(r.y1 - r.y0, r.z0 - r.z1);
      rampa.receiveShadow = true;
      g.add(rampa);
      for (const x of [-r.ancho / 2 - 0.3, r.ancho / 2 + 0.3]) {
        const baranda = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, largo), mats[4]);
        baranda.position.set(x, (r.y0 + r.y1) / 2 + 0.3, (r.z0 + r.z1) / 2);
        baranda.rotation.x = rampa.rotation.x;
        g.add(baranda);
      }
    }
    for (const c of est.carteles) {
      const s = cartel(c.texto, '#c5f04a');
      s.position.set(c.x, c.y + 1.4, c.z);
      g.add(s);
      // flechas en el piso antes del hueco
      const f = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: texturaRayas('#c5f04a', '#141413', 6), transparent: true, opacity: 0.85 }));
      f.rotation.x = -Math.PI / 2;
      f.position.set(c.x, 0.02 + (c.y - 2.2), c.z + 1);
      g.add(f);
    }
    // Un arco iris marca cada punto de control.
    this.animados = [];
    for (const cp of mapa.CHECKPOINTS.slice(1)) {
      const arco = arcoIris(12.7);
      arco.position.set(0, cp.y - 0.8, cp.z);
      g.add(arco);
      const rotulo = cartel(cp.nombre.toUpperCase(), '#fff');
      rotulo.position.set(0, cp.y + 5.5, cp.z);
      g.add(rotulo);
    }
    this.ponerPlacas(est, g);
    decorar(this, mapaId, mapa, tema, g);
    const titulo = cartel(mapa.nombre.toUpperCase(), '#c5f04a');
    titulo.scale.set(7, 1.8, 1); titulo.position.set(0, 6.4, -4); g.add(titulo);
    // largada a rayas
    const largada = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshStandardMaterial({ map: texturaRayas('#ffffff', '#ff4fa3', 16) }));
    largada.rotation.x = -Math.PI / 2;
    largada.position.set(0, 0.01, -5);
    g.add(largada);
    // meta a cuadros con arco
    const cuadros = texturaCuadros();
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.5), new THREE.MeshStandardMaterial({ map: cuadros }));
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(0, mapa.metaY + 0.01, mapa.META_Z);
    g.add(piso);
    for (const x of [-7, 7]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7, 16), mats[0]);
      col.position.set(x, mapa.metaY + 3.5, mapa.META_Z);
      col.castShadow = true;
      g.add(col);
    }
    const banda = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, 0.5), new THREE.MeshStandardMaterial({ map: cuadros }));
    banda.position.set(0, mapa.metaY + 7, mapa.META_Z);
    g.add(banda);
    const meta = cartel('META', '#c5f04a');
    meta.scale.set(6, 1.5, 1);
    meta.position.set(0, mapa.metaY + 8.6, mapa.META_Z);
    g.add(meta);
    this.pista = g;
    this.scene.add(g);
    this.crearMoviles();
  }

  crearMoviles() {
    this.mov.clear();
    const m = moviles(this.mapaId, 0, this.semilla);
    const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, ...extra });
    const blanco = mat(0xf4f1ea);
    this.obj = {};
    this.obj.plataformas = m.plataformas.map((p, i) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat([0x4fd1c5, 0xff7a45, 0xc084fc][i % 3]));
      o.castShadow = o.receiveShadow = true;
      this.mov.add(o);
      return o;
    });
    this.obj.barras = m.barras.map((b) => {
      const o = new THREE.Group();
      const barra = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, b.largo * 2, 16), mat(0xff4fa3));
      barra.rotation.z = Math.PI / 2;
      barra.castShadow = true;
      const rayas = new THREE.Mesh(new THREE.CylinderGeometry(b.r + 0.01, b.r + 0.01, b.largo * 2, 16, 1, true), new THREE.MeshStandardMaterial({ map: texturaRayas('#ffffff', '#ff4fa3', 12, true), transparent: true, opacity: 0.9 }));
      rayas.rotation.z = Math.PI / 2;
      o.add(barra, rayas);
      const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.1, 20), blanco);
      o.add(centro);
      this.mov.add(o);
      return o;
    });
    this.obj.martillos = m.martillos.map((h) => {
      const o = new THREE.Group();
      const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, h.brazo, 10), mat(0x8a857c));
      brazo.position.y = -h.brazo / 2;
      const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(h.r, h.r, 2.4, 24), mat(0xff6b5b));
      cabeza.rotation.x = Math.PI / 2;
      cabeza.position.y = -h.brazo;
      cabeza.castShadow = true;
      for (const z of [-1.1, 1.1]) {
        const aro = new THREE.Mesh(new THREE.TorusGeometry(h.r + 0.02, 0.14, 8, 24), blanco);
        aro.position.set(0, -h.brazo, z);
        o.add(aro);
      }
      o.add(brazo, cabeza);
      this.mov.add(o);
      // soporte arriba con dos postes
      const soporte = new THREE.Mesh(new THREE.BoxGeometry(h.ancho + 3, 0.6, 0.6), blanco);
      soporte.position.set(0, h.pivote.y + 0.3, h.pivote.z);
      this.mov.add(soporte);
      for (const x of [-(h.ancho / 2 + 1.2), h.ancho / 2 + 1.2]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, h.pivote.y + 1, 10), blanco);
        p.position.set(x, (h.pivote.y + 1) / 2 - 0.5, h.pivote.z);
        this.mov.add(p);
      }
      return o;
    });
    this.obj.molinos = m.molinos.map((w) => {
      const o = new THREE.Group();
      for (let i = 0; i < w.brazos; i++) {
        const piv = new THREE.Group();
        piv.rotation.z = (i * Math.PI * 2) / w.brazos;
        const aspa = new THREE.Mesh(new THREE.BoxGeometry(w.largo, 0.7, w.grosor), mat(i % 2 ? 0xffd166 : 0xff7a45));
        aspa.position.x = w.largo / 2;
        aspa.castShadow = true;
        piv.add(aspa);
        o.add(piv);
      }
      const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 20), blanco);
      eje.rotation.x = Math.PI / 2;
      o.add(eje);
      this.mov.add(o);
      // viga desde el costado (por arriba de las cabezas) y un poste afuera de la pista
      const lado = w.x >= 0 ? 1 : -1;
      const afuera = lado * 8.6;
      const viga = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(afuera - w.x), 0.45, 0.45), blanco);
      viga.position.set((afuera + w.x) / 2, w.y, w.z - lado * 0.6);
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, w.y + 8, 10), blanco);
      poste.position.set(afuera, w.y / 2 - 4, w.z - lado * 0.6);
      this.mov.add(viga, poste);
      return o;
    });
    this.obj.pistones = m.pistones.map((p) => {
      const o = new THREE.Group();
      const cara = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat(0x7aa2ff));
      cara.castShadow = true;
      const frente = new THREE.Mesh(new THREE.BoxGeometry(0.2, p.h * 0.9, p.d * 0.9), mat(0xff4fa3));
      frente.position.x = (p.x > 0 ? -1 : 1) * (p.w / 2 + 0.05);
      o.add(cara, frente);
      this.mov.add(o);
      // caja en la pared de donde sale
      const lado = p.x > 0 ? 1 : -1;
      const caja = new THREE.Mesh(new THREE.BoxGeometry(6.2, p.h + 1, p.d + 0.6), blanco);
      caja.position.set(lado * 10.4, p.y + 0.5, p.z);
      caja.castShadow = true;
      this.mov.add(caja);
      return o;
    });
    const geoB = new THREE.BoxGeometry(1, 1, 1);
    this.obj.baldosas = m.baldosas.map((b) => {
      const o = new THREE.Mesh(geoB, mat(0x4fd1c5));
      o.scale.set(b.w, b.h, b.d);
      o.receiveShadow = true;
      this.mov.add(o);
      return o;
    });
    this.colorBaldosa = new THREE.Color(0x4fd1c5);
    this.colorAviso = new THREE.Color(0xff4f4f);
    this.geoBola = new THREE.SphereGeometry(1.1, 20, 16);
    this.matBola = mat(0x7aa2ff);
    this.obj.bolas = [];
  }

  actualizarMoviles(t) {
    if (!this.mapaId) return;
    const m = moviles(this.mapaId, t, this.semilla);
    const o = this.obj;
    m.plataformas.forEach((p, i) => o.plataformas[i].position.set(p.x, p.y, p.z));
    m.barras.forEach((b, i) => {
      o.barras[i].position.set(b.x, b.y, b.z);
      o.barras[i].rotation.y = -b.ang;
    });
    m.martillos.forEach((h, i) => {
      o.martillos[i].position.set(h.pivote.x, h.pivote.y, h.pivote.z);
      o.martillos[i].rotation.z = h.ang;
    });
    m.molinos.forEach((w, i) => {
      o.molinos[i].position.set(w.x, w.y, w.z);
      o.molinos[i].rotation.z = w.ang;
    });
    m.pistones.forEach((p, i) => o.pistones[i].position.set(p.x, p.y, p.z));
    m.baldosas.forEach((b, i) => {
      const ob = o.baldosas[i];
      ob.position.set(b.x, b.y, b.z);
      ob.visible = b.y > -5;
      // titila en rojo antes de caerse
      const titila = b.aviso && Math.sin(t * 22) > 0;
      ob.material.color.copy(titila ? this.colorAviso : this.colorBaldosa);
    });
    for (const c of this.cintas || []) c.tex.offset.y = ((t * c.vz) / 4) % 1;
    while (o.bolas.length < m.bolas.length) {
      const b = new THREE.Mesh(this.geoBola, this.matBola);
      b.castShadow = true;
      this.mov.add(b);
      o.bolas.push(b);
    }
    o.bolas.forEach((ob, i) => {
      const b = m.bolas[i];
      ob.visible = !!b;
      if (b) {
        ob.position.set(b.x, b.y, b.z);
        ob.rotation.x = b.giro;
      }
    });
  }

  // ---------------------------------------------------------------- personajes
  // look: el de npcs.js; para personas, se arma con el color elegido.
  personaje(id, look, nombre, esYo = false) {
    const firma = JSON.stringify(look) + nombre;
    let p = this.personajes.get(id);
    if (p && p.firma === firma) return p;
    if (p) this.scene.remove(p.grupo);
    p = crearPersona(THREE, look, { nombre, colorNombre: esYo ? '#c5f04a' : '#ffffff' });
    p.firma = firma;
    this.scene.add(p.grupo);
    this.personajes.set(id, p);
    return p;
  }

  hay(id) {
    return this.personajes.has(id);
  }

  quitar(id) {
    const p = this.personajes.get(id);
    if (p) this.scene.remove(p.grupo);
    this.personajes.delete(id);
  }

  quitarSi(filtro) {
    for (const id of [...this.personajes.keys()]) if (filtro(id)) this.quitar(id);
  }

  mover(id, e, dt) {
    const p = this.personajes.get(id);
    if (!p) return;
    p.grupo.position.set(e.x, e.y, e.z);
    p.grupo.rotation.y = e.ry;
    p.grupo.visible = e.y > Y_AGUA - 0.4;
    p.animar(e.a, dt);
  }

  decir(id, texto, seg) {
    this.personajes.get(id)?.decir(texto, seg);
  }

  // Placas turbo (flechas que corren) y trampolines.
  ponerPlacas(est, g) {
    this.placas = [];
    const blanco = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 });
    for (const p of est.impulsos || []) {
      if (p.tipo === 'turbo') {
        const tex = texturaTurbo();
        tex.repeat.set(Math.max(1, Math.round(p.w / 2.5)), Math.max(1, Math.round(p.d / 2)));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), new THREE.MeshBasicMaterial({ map: tex }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x, p.y + 0.035, p.z);
        const marco = new THREE.Mesh(new THREE.PlaneGeometry(p.w + 0.5, p.d + 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        marco.rotation.x = -Math.PI / 2;
        marco.position.set(p.x, p.y + 0.02, p.z);
        g.add(marco, m);
        this.placas.push({ p, tex });
      } else {
        const o = new THREE.Group();
        o.position.set(p.x, p.y, p.z);
        const aro = new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2, p.w / 2 + 0.14, 0.34, 28), blanco);
        aro.position.y = 0.17;
        const lona = new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2 - 0.2, p.w / 2 - 0.2, 0.1, 28), new THREE.MeshStandardMaterial({ map: texturaDiana('#38d9e6', '#ffffff'), emissive: 0x38d9e6, emissiveIntensity: 0.25, roughness: 0.4 }));
        lona.position.y = 0.36;
        o.add(aro, lona);
        g.add(o);
        this.placas.push({ p, lona, golpe: 0 });
      }
    }
  }

  // El trampolín se hunde y vuelve cuando alguien rebota.
  rebote(p) {
    const pl = (this.placas || []).find((q) => q.p === p);
    if (pl) pl.golpe = 1;
    this.polvo(p.x, p.y + 0.5, p.z, { n: 14, color: 0x38d9e6, fuerza: 4, sube: 5, vida: 0.55 });
  }

  // Nubecita de partículas: polvo al saltar o caer, chispas, salpicones.
  polvo(x, y, z, { n = 9, color = 0xffffff, fuerza = 2.4, sube = 1.6, vida = 0.45, tam = 0.42, g = 4, anillo = false } = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      const a = anillo ? (i / n) * Math.PI * 2 : Math.random() * Math.PI * 2;
      const f = fuerza * (anillo ? 1 : 0.4 + Math.random() * 0.6);
      pos.set([x + Math.cos(a) * 0.2, y + 0.1, z + Math.sin(a) * 0.2], i * 3);
      vel.push([Math.cos(a) * f, sube * (anillo ? 0.3 : Math.random()), Math.sin(a) * f]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: tam, color, map: this.texPunto, transparent: true, depthWrite: false, alphaTest: 0.02 }));
    pts.userData = { vel, vida, vida0: vida, g };
    this.scene.add(pts);
    (this.confetis ||= []).push(pts);
  }

  // Cayó al agua: salpicón.
  salpicar(x, z) {
    const nubes = this.tema?.mar === 'nubes';
    this.polvo(x, Y_AGUA + 0.2, z, { n: 26, color: nubes ? 0xffffff : 0xd9f3ff, fuerza: 3.4, sube: nubes ? 4 : 9, vida: 0.9, tam: 0.6, g: nubes ? 5 : 16 });
    this.polvo(x, Y_AGUA + 0.2, z, { n: 20, color: 0xffffff, fuerza: 4.5, sube: 0.4, vida: 0.7, tam: 0.5, g: 0, anillo: true });
  }

  sacudir(fuerza = 0.3) {
    this.sacudon = Math.max(this.sacudon, fuerza);
  }

  confeti(x, y, z, n = 140, fuerza = 1) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const cols = [0xc5f04a, 0xff4fa3, 0x7aa2ff, 0xffd166, 0xffffff, ...ARCO].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos.set([x, y + 1, z], i * 3);
      const c = cols[i % cols.length];
      col.set([c.r, c.g, c.b], i * 3);
      vel.push([(Math.random() - 0.5) * 10 * fuerza, (6 + Math.random() * 9) * fuerza, (Math.random() - 0.5) * 10 * fuerza]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true }));
    pts.userData = { vel, vida: 3 };
    this.scene.add(pts);
    (this.confetis ||= []).push(pts);
  }

  // Cámara de tercera persona: se acomoda suave (sin sacudones) detrás del personaje.
  // yMin: la cámara no baja de ahí (si te caés, te ve caer desde arriba en vez de meterse abajo de la pista).
  seguir(obj, camYaw, dt, { distancia = 9, yMin = -2.5, turbo = false } = {}) {
    const k = 1 - Math.exp(-dt * 5);
    const yRef = Math.max(obj.y, yMin);
    const destino = new THREE.Vector3(obj.x + Math.sin(camYaw) * distancia, yRef + 4.2, obj.z + Math.cos(camYaw) * distancia);
    if (this.camPos.distanceTo(destino) > 30) this.camPos.copy(destino);
    else this.camPos.lerp(destino, k);
    const mira = new THREE.Vector3(obj.x - Math.sin(camYaw) * 3, Math.max(obj.y, yMin - 6) + 1.3, obj.z - Math.cos(camYaw) * 3);
    if (this.mirar.distanceTo(mira) > 30) this.mirar.copy(mira);
    else this.mirar.lerp(mira, 1 - Math.exp(-dt * 8));
    this.camara.position.copy(this.camPos);
    if (this.sacudon > 0.002) {
      this.camara.position.x += (Math.random() - 0.5) * this.sacudon;
      this.camara.position.y += (Math.random() - 0.5) * this.sacudon;
      this.sacudon *= Math.exp(-dt * 9);
    }
    this.camara.lookAt(this.mirar);
    // con turbo la cámara "abre" (sensación de velocidad)
    const fov = this.fov + ((turbo ? 74 : 60) - this.fov) * (1 - Math.exp(-dt * 6));
    if (Math.abs(fov - this.fov) > 0.01) {
      this.fov = fov;
      this.camara.fov = fov;
      this.camara.updateProjectionMatrix();
    }
    this.sol.position.set(obj.x + 20, 40, obj.z + 10);
    this.sol.target.position.set(obj.x, 0, obj.z);
  }

  render(dt) {
    this.reloj += dt;
    const t = this.reloj;
    for (const f of this.animados) f(t, dt);
    for (const pl of this.placas || []) {
      if (pl.tex) pl.tex.offset.y = -((t * 1.6) % 1);
      else {
        pl.golpe = Math.max(0, pl.golpe - dt * 3);
        pl.lona.position.y = 0.36 - Math.sin(pl.golpe * Math.PI) * 0.3;
        const s = 1 + Math.sin(t * 3 + pl.p.x) * 0.03;
        pl.lona.scale.set(s, 1, s);
      }
    }
    this.texAgua.offset.set((t * 0.012) % 1, (t * 0.02) % 1);
    this.cielo.position.copy(this.camara.position);
    this.astro.position.copy(this.camara.position).add(_dirSol);
    for (const c of this.confetis || []) {
      const p = c.geometry.attributes.position;
      const u = c.userData;
      u.vida -= dt;
      const g = u.g ?? 18;
      u.vel.forEach((v, i) => {
        v[1] -= g * dt;
        p.setXYZ(i, p.getX(i) + v[0] * dt, p.getY(i) + v[1] * dt, p.getZ(i) + v[2] * dt);
      });
      p.needsUpdate = true;
      if (u.vida0) c.material.opacity = Math.max(0, u.vida / u.vida0);
      if (u.vida <= 0) {
        this.scene.remove(c);
        c.geometry.dispose();
        c.material.dispose();
      }
    }
    this.confetis = (this.confetis || []).filter((c) => c.userData.vida > 0);
    this.renderer.render(this.scene, this.camara);
  }

  destruir() {
    removeEventListener('resize', this._resize);
    this.renderer.dispose();
  }
}
