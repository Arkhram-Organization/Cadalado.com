// Dibujo 3D de la carrera con three.js: pista, obstáculos, personajes "porotito" y cámara.
import * as THREE from '../vendor/three.module.min.js';
import { estaticos, moviles, puertas, RAMPA, META_Z, rng } from './pista.js';

const PALETA = [0xff7eb6, 0x7aa2ff, 0xffd166, 0x9be15d, 0xf4f1ea, 0xc084fc];

function texturaRayas(c1, c2, n = 8) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? c1 : c2;
    g.fillRect((i * 128) / n, 0, 128 / n + 1, 128);
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
function cartel(texto, color = '#fff') {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 30px Barlow Condensed, Barlow, sans-serif';
  const w = Math.min(250, g.measureText(texto).width + 28);
  g.fillStyle = 'rgba(20,20,19,.72)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 10, w, 44, 22);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, 128, 33, 230);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.65, 1);
  s.renderOrder = 10;
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
    this.scene.fog = new THREE.Fog(0x8fd3ff, 60, 190);
    this.camara = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.camara.position.set(0, 6, 8);
    this.personajes = new Map();
    this.camPos = new THREE.Vector3(0, 6, 8);
    this.reloj = 0;

    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6a7a90, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(20, 40, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
    this.sol = sol;
    this.scene.add(sol, sol.target);

    // agua abajo y nubes alrededor
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x2f9bea, roughness: 0.25, metalness: 0.1 }));
    agua.rotation.x = -Math.PI / 2;
    agua.position.y = -14;
    this.scene.add(agua);
    const r = rng(7);
    const nube = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    for (let i = 0; i < 26; i++) {
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
    addEventListener('resize', () => this.redimensionar());
  }

  redimensionar() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  construirPista(semilla) {
    if (this.pista) this.scene.remove(this.pista);
    this.semilla = semilla;
    const g = new THREE.Group();
    const mats = PALETA.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    for (const c of estaticos(semilla)) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), mats[c.c]);
      m.position.set(c.x, c.y, c.z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      if (c.puerta) {
        // puerta maciza: con un "?" para que no se note cuál es
        const s = cartel('?', '#fff');
        s.scale.set(2, 0.5, 1);
        s.position.set(c.x, 2.2, c.z + 0.4);
        g.add(s);
      }
    }
    // las puertas abiertas se ven igual de lejos: un panel fino que se atraviesa
    for (const p of puertas(semilla)) if (p.abierta) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4, 0.08), new THREE.MeshStandardMaterial({ color: PALETA[5], transparent: true, opacity: 0.55 }));
      m.position.set(p.x, 2, -104);
      g.add(m);
      const s = cartel('?', '#fff');
      s.scale.set(2, 0.5, 1);
      s.position.set(p.x, 2.2, -103.6);
      g.add(s);
    }
    // largada a rayas y meta a cuadros
    const largada = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshStandardMaterial({ map: texturaRayas('#ffffff', '#ff4fa3', 16) }));
    largada.rotation.x = -Math.PI / 2;
    largada.position.set(0, 0.01, -5);
    g.add(largada);
    const cuadros = texturaCuadros();
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.5), new THREE.MeshStandardMaterial({ map: cuadros }));
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(0, 6.01, META_Z);
    g.add(piso);
    for (const x of [-7, 7]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7, 16), mats[0]);
      col.position.set(x, 9.5, META_Z);
      col.castShadow = true;
      g.add(col);
    }
    const banda = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, 0.5), new THREE.MeshStandardMaterial({ map: cuadros }));
    banda.position.set(0, 13, META_Z);
    g.add(banda);
    const meta = cartel('META', '#c5f04a');
    meta.scale.set(6, 1.5, 1);
    meta.position.set(0, 14.6, META_Z);
    g.add(meta);
    // rampa
    const largo = Math.hypot(RAMPA.z0 - RAMPA.z1, RAMPA.y1 - RAMPA.y0);
    const rampa = new THREE.Mesh(new THREE.BoxGeometry(RAMPA.ancho, 0.6, largo), new THREE.MeshStandardMaterial({ map: texturaRayas('#ffd166', '#ffb703', 10), roughness: 0.6 }));
    rampa.material.map.repeat.set(1, 3);
    rampa.position.set(0, (RAMPA.y0 + RAMPA.y1) / 2 - 0.3, (RAMPA.z0 + RAMPA.z1) / 2);
    rampa.rotation.x = Math.atan2(RAMPA.y1 - RAMPA.y0, RAMPA.z0 - RAMPA.z1);
    rampa.receiveShadow = true;
    g.add(rampa);
    for (const x of [-RAMPA.ancho / 2 - 0.3, RAMPA.ancho / 2 + 0.3]) {
      const baranda = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, largo), mats[4]);
      baranda.position.set(x, (RAMPA.y0 + RAMPA.y1) / 2 + 0.3, (RAMPA.z0 + RAMPA.z1) / 2);
      baranda.rotation.x = rampa.rotation.x;
      g.add(baranda);
    }
    this.pista = g;
    this.scene.add(g);
    this.crearMoviles();
  }

  crearMoviles() {
    this.mov.clear();
    const m = moviles(0, this.semilla);
    const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, ...extra });
    this.objPlataformas = m.plataformas.map((p, i) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat([0x4fd1c5, 0xff7a45, 0xc084fc][i]));
      o.castShadow = o.receiveShadow = true;
      this.mov.add(o);
      return o;
    });
    this.objBarras = m.barras.map((b) => {
      const o = new THREE.Group();
      const barra = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, b.largo * 2, 16), mat(0xff4fa3));
      barra.rotation.z = Math.PI / 2;
      barra.castShadow = true;
      o.add(barra);
      const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 20), mat(0xf4f1ea));
      o.add(centro);
      this.mov.add(o);
      return o;
    });
    this.objMartillos = m.martillos.map(() => {
      const o = new THREE.Group();
      const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 10), mat(0x8a857c));
      brazo.position.y = -4;
      const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 24), mat(0xff6b5b));
      cabeza.rotation.z = Math.PI / 2;
      cabeza.position.y = -8;
      cabeza.castShadow = true;
      const aro = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.18, 8, 24), mat(0xf4f1ea));
      aro.position.y = -8;
      aro.rotation.y = Math.PI / 2;
      o.add(brazo, cabeza, aro);
      const soporte = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 0.6), mat(0xf4f1ea));
      soporte.position.y = 0.3;
      this.mov.add(soporte);
      o.userData.soporte = soporte;
      this.mov.add(o);
      return o;
    });
    for (const z of [-74, -83, -92]) for (const x of [-7, 7]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10, 10), mat(0xf4f1ea));
      p.position.set(x, 4.8, z);
      this.mov.add(p);
    }
    this.geoBola = new THREE.SphereGeometry(1.1, 20, 16);
    this.matBola = mat(0x7aa2ff);
    this.objBolas = [];
  }

  actualizarMoviles(t) {
    if (!this.semilla) return;
    const m = moviles(t, this.semilla);
    m.plataformas.forEach((p, i) => this.objPlataformas[i].position.set(p.x, p.y, p.z));
    m.barras.forEach((b, i) => {
      this.objBarras[i].position.set(b.x, b.y, b.z);
      this.objBarras[i].rotation.y = -b.ang;
    });
    m.martillos.forEach((h, i) => {
      const o = this.objMartillos[i];
      o.position.set(h.pivote.x, h.pivote.y, h.pivote.z);
      o.rotation.z = h.ang;
      o.userData.soporte.position.set(0, h.pivote.y, h.pivote.z);
    });
    while (this.objBolas.length < m.bolas.length) {
      const b = new THREE.Mesh(this.geoBola, this.matBola);
      b.castShadow = true;
      this.mov.add(b);
      this.objBolas.push(b);
    }
    this.objBolas.forEach((o, i) => {
      const b = m.bolas[i];
      o.visible = !!b;
      if (b) {
        o.position.set(b.x, b.y, b.z);
        o.rotation.x = b.giro;
      }
    });
  }

  // ---------------------------------------------------------------- personajes
  personaje(id, color, nombre, esYo = false) {
    let p = this.personajes.get(id);
    if (p) {
      if (p.userData.color !== color) {
        p.userData.cuerpo.material.color.set(color);
        p.userData.color = color;
      }
      return p;
    }
    p = new THREE.Group();
    const piel = new THREE.MeshStandardMaterial({ color, roughness: 0.35 });
    const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.7, 6, 16), piel);
    cuerpo.position.y = 0.85;
    cuerpo.castShadow = true;
    const ojo = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupila = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const cara = new THREE.Group();
    for (const x of [-0.17, 0.17]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), ojo);
      o.position.set(x, 1.25, -0.42);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), pupila);
      pu.position.set(x, 1.25, -0.55);
      cara.add(o, pu);
    }
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x141413 }));
    visor.position.set(0, 1.55, 0);
    visor.rotation.set(0, 0, 0);
    const cuerpoG = new THREE.Group();
    cuerpoG.add(cuerpo, cara, visor);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.02;
    p.add(cuerpoG, sombra);
    if (nombre) {
      const s = cartel(nombre, esYo ? '#c5f04a' : '#fff');
      s.position.y = 2.35;
      p.add(s);
    }
    p.userData = { cuerpo, cuerpoG, color, fase: Math.random() * 6 };
    this.scene.add(p);
    this.personajes.set(id, p);
    return p;
  }

  quitar(id) {
    const p = this.personajes.get(id);
    if (p) this.scene.remove(p);
    this.personajes.delete(id);
  }

  mover(id, e, dt) {
    const p = this.personajes.get(id);
    if (!p) return;
    p.position.set(e.x, e.y, e.z);
    p.rotation.y = e.ry;
    const u = p.userData;
    u.fase += dt * (e.a === 'corre' ? 16 : 4);
    const c = u.cuerpoG;
    c.rotation.set(0, 0, 0);
    c.position.set(0, 0, 0);
    c.scale.set(1, 1, 1);
    if (e.a === 'corre') {
      c.position.y = Math.abs(Math.sin(u.fase)) * 0.14;
      c.rotation.x = -0.18;
      c.rotation.z = Math.sin(u.fase) * 0.08;
    } else if (e.a === 'salto') c.scale.set(0.92, 1.12, 0.92);
    else if (e.a === 'buceo') {
      c.rotation.x = -1.35;
      c.position.y = 0.35;
    } else if (e.a === 'golpe') {
      c.rotation.z = Math.sin(u.fase * 3) * 0.6;
      c.rotation.x = 0.3;
    } else if (e.a === 'festeja') {
      c.position.y = Math.abs(Math.sin(u.fase * 1.6)) * 0.7;
      c.rotation.y = u.fase * 1.5;
    } else {
      const r = 1 + Math.sin(u.fase) * 0.025;
      c.scale.set(1 / r, r, 1 / r);
    }
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

  // cámara de tercera persona detrás del personaje
  seguir(obj, camYaw, dt, distancia = 8.5) {
    const destino = new THREE.Vector3(obj.x + Math.sin(camYaw) * distancia, obj.y + 4.3, obj.z + Math.cos(camYaw) * distancia);
    this.camPos.lerp(destino, Math.min(1, dt * 6));
    this.camara.position.copy(this.camPos);
    this.camara.lookAt(obj.x - Math.sin(camYaw) * 3, obj.y + 1.3, obj.z - Math.cos(camYaw) * 3);
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
}
