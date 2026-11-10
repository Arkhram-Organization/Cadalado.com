// Dibujo 3D de Full Gays con three.js: mapas, obstáculos, personitas y cámara.
import * as THREE from '../vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { MAPAS, estaticos, moviles, rng } from './pista.js';

const PALETAS = {
  1: [0xff6b84,0x61c8d0,0xffcd65,0x9be15d,0xf4f1ea,0x9a79df],
  2: [0xf2a34c,0x4a718b,0x69c4c7,0xd3e17d,0xd5e4e8,0xc5739a],
  3: [0xcb6ee5,0x657cda,0xc5f04a,0x7acbb8,0xf4f1ea,0xe99a58],
  4: [0xff7166,0x388dd9,0xffd34e,0x4ed4c8,0xfff2dd,0xb776e8],
  5: [0x5ce4d4,0x556b9c,0xf0a14c,0xa4b4c4,0xe5edf2,0xd56ebf],
};
const CIELOS = {1:0x8fd3ff,2:0x9cc5d2,3:0xb8a3e8,4:0x7cc9fa,5:0x839bbd};

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

    // agua abajo y nubes alrededor
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0x2f9bea, roughness: 0.25, metalness: 0.1 }));
    agua.rotation.x = -Math.PI / 2;
    agua.position.y = -14;
    this.scene.add(agua); this.agua = agua;
    const r = rng(7);
    const nube = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    for (let i = 0; i < 30; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2 + r() * 2.5, 12, 10), nube);
        s.position.set(k * 2.4 - 3.6, r() * 1.2, r() * 1.5);
        g.add(s);
      }
      const lado = r() < 0.5 ? -1 : 1;
      g.position.set(lado * (30 + r() * 60), -6 + r() * 26, 20 - r() * 220);
      this.scene.add(g);
    }
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
    const cielo = CIELOS[mapaId] || CIELOS[1];
    this.scene.background = new THREE.Color(cielo);
    this.scene.fog.color.setHex(cielo);
    this.agua.material.color.setHex(mapaId === 5 ? 0x355679 : mapaId === 3 ? 0x605eb3 : 0x2f9bea);
    const est = estaticos(mapaId);
    const g = new THREE.Group();
    const mats = PALETAS[mapaId].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    for (const c of est.cajas) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), mats[c.c]);
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
    // Pórticos y banderines al costado de la pista marcan cada sector y le dan identidad al mapa.
    const acento = new THREE.MeshStandardMaterial({ color: PALETAS[mapaId][0], emissive: PALETAS[mapaId][0], emissiveIntensity: 0.23, roughness: 0.5 });
    for (const cp of mapa.CHECKPOINTS.slice(1)) {
      for (const lado of [-1, 1]) {
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 4, 10), acento);
        poste.position.set(lado * 9.5, cp.y + 2, cp.z);
        g.add(poste);
        const bandera = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.07), mats[(mapaId + (lado + 1)) % mats.length]);
        bandera.position.set(lado * 8.7, cp.y + 3.25, cp.z);
        g.add(bandera);
      }
      const rotulo = cartel(cp.nombre.toUpperCase(), '#fff');
      rotulo.position.set(0, cp.y + 5.5, cp.z);
      g.add(rotulo);
    }
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
    p.grupo.visible = e.y > -13;
    p.animar(e.a, dt);
  }

  decir(id, texto, seg) {
    this.personajes.get(id)?.decir(texto, seg);
  }

  confeti(x, y, z) {
    const n = 140;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const cols = [0xc5f04a, 0xff4fa3, 0x7aa2ff, 0xffd166, 0xffffff].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos.set([x, y + 1, z], i * 3);
      const c = cols[i % cols.length];
      col.set([c.r, c.g, c.b], i * 3);
      vel.push([(Math.random() - 0.5) * 10, 6 + Math.random() * 9, (Math.random() - 0.5) * 10]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true }));
    pts.userData = { vel, vida: 3 };
    this.scene.add(pts);
    (this.confetis ||= []).push(pts);
  }

  // Cámara de tercera persona: se acomoda suave (sin sacudones) detrás del personaje.
  seguir(obj, camYaw, dt, distancia = 9) {
    const k = 1 - Math.exp(-dt * 5);
    const destino = new THREE.Vector3(obj.x + Math.sin(camYaw) * distancia, Math.max(obj.y, -8) + 4.2, obj.z + Math.cos(camYaw) * distancia);
    if (this.camPos.distanceTo(destino) > 30) this.camPos.copy(destino);
    else this.camPos.lerp(destino, k);
    const mira = new THREE.Vector3(obj.x - Math.sin(camYaw) * 3, Math.max(obj.y, -8) + 1.3, obj.z - Math.cos(camYaw) * 3);
    if (this.mirar.distanceTo(mira) > 30) this.mirar.copy(mira);
    else this.mirar.lerp(mira, 1 - Math.exp(-dt * 8));
    this.camara.position.copy(this.camPos);
    this.camara.lookAt(this.mirar);
    this.sol.position.set(obj.x + 20, 40, obj.z + 10);
    this.sol.target.position.set(obj.x, 0, obj.z);
  }

  render(dt) {
    for (const c of this.confetis || []) {
      const p = c.geometry.attributes.position;
      c.userData.vida -= dt;
      c.userData.vel.forEach((v, i) => {
        v[1] -= 18 * dt;
        p.setXYZ(i, p.getX(i) + v[0] * dt, p.getY(i) + v[1] * dt, p.getZ(i) + v[2] * dt);
      });
      p.needsUpdate = true;
      if (c.userData.vida <= 0) this.scene.remove(c);
    }
    this.confetis = (this.confetis || []).filter((c) => c.userData.vida > 0);
    this.renderer.render(this.scene, this.camara);
  }

  destruir() {
    removeEventListener('resize', this._resize);
    this.renderer.dispose();
  }
}
