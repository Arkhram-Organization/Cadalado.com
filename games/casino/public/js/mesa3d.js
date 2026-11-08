// Mesa de blackjack en 3D: paño, cartas que salen del zapato, fichas apiladas, las personas sentadas
// y Dobro repartiendo (de smoking y con lentes). La cámara se mueve arrastrando, como en el truco.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { POR_ID, rngNpc } from '/comun/npcs.js';
import { enFichas } from './piezas.js';

const ASIENTOS = 5;
const CENTRO_Z = -1.0; // borde recto de la mesa (lado de la banca)
const MESA_Y = 0.93;
const COLOR_FICHA = { 10: '#2f6fd6', 50: '#d63a3a', 100: '#1b1b1b', 500: '#7b3fd6', 1000: '#e0a91a', 5000: '#ff7a1a' };
const PALO = { P: '♠', C: '♥', D: '♦', T: '♣' };

// ángulo de cada lugar alrededor de la mesa (de izquierda a derecha visto desde la banca)
const anguloAsiento = (i) => ((i - (ASIENTOS - 1) / 2) * 30 * Math.PI) / 180;
const puntoArco = (i, r) => {
  const a = anguloAsiento(i);
  return new THREE.Vector3(-Math.sin(a) * r, MESA_Y, CENTRO_Z + Math.cos(a) * r);
};

export function lookDeId(id, color) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rngNpc(h);
  const de = (l) => l[Math.floor(r() * l.length)];
  return {
    piel: de(['#f0cfb4', '#e8c4a8', '#d9a982', '#b98463', '#8d5b3e']),
    pelo: { estilo: de(['corto', 'corto', 'rulos', 'largo', 'poco']), color: de(['#1e1610', '#3b2a1e', '#6b4226', '#c49a5a', '#141414']) },
    ojos: '#3a2a1c',
    cuerpo: de(['flaco', 'normal', 'normal', 'gordito']),
    ropa: { remera: color, pantalon: '#2b2b33' },
  };
}

// ---------------------------------------------------------------- texturas
const cacheTex = new Map();
function texCarta(c) {
  if (cacheTex.has(c)) return cacheTex.get(c);
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 358;
  const g = cv.getContext('2d');
  g.fillStyle = '#fbfaf5';
  g.beginPath();
  g.roundRect(0, 0, 256, 358, 22);
  g.fill();
  if (c === 'X') {
    g.fillStyle = '#9b1c2c';
    g.beginPath();
    g.roundRect(14, 14, 228, 330, 14);
    g.fill();
    g.strokeStyle = 'rgba(242,201,76,.75)';
    g.lineWidth = 3;
    for (let k = -360; k < 360; k += 22) {
      g.beginPath();
      g.moveTo(14 + k, 14);
      g.lineTo(14 + k + 330, 344);
      g.stroke();
      g.beginPath();
      g.moveTo(242 - k, 14);
      g.lineTo(242 - k - 330, 344);
      g.stroke();
    }
    g.strokeStyle = '#f2c94c';
    g.lineWidth = 8;
    g.strokeRect(24, 24, 208, 310);
    g.fillStyle = '#f2c94c';
    g.font = '900 64px Barlow Condensed, Arial Narrow, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('D', 128, 179);
  } else {
    const v = c.slice(0, -1);
    const p = c.slice(-1);
    g.fillStyle = p === 'C' || p === 'D' ? '#c8102e' : '#141414';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 58px Barlow Condensed, Arial Narrow, sans-serif';
    g.fillText(v, 40, 48);
    g.font = '44px serif';
    g.fillText(PALO[p], 40, 100);
    g.save();
    g.translate(216, 310);
    g.rotate(Math.PI);
    g.font = '800 58px Barlow Condensed, Arial Narrow, sans-serif';
    g.fillText(v, 0, -262 + 262);
    g.font = '44px serif';
    g.fillText(PALO[p], 0, 52);
    g.restore();
    g.font = ['J', 'Q', 'K'].includes(v) ? '800 120px Barlow Condensed, serif' : '150px serif';
    g.fillText(['J', 'Q', 'K'].includes(v) ? v : PALO[p], 128, 190);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cacheTex.set(c, t);
  return t;
}
function texFicha(v) {
  const k = 'f' + v;
  if (cacheTex.has(k)) return cacheTex.get(k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = COLOR_FICHA[v];
  g.beginPath();
  g.arc(64, 64, 64, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    g.save();
    g.translate(64, 64);
    g.rotate((i * Math.PI) / 4);
    g.fillRect(-7, -64, 14, 18);
    g.restore();
  }
  g.beginPath();
  g.arc(64, 64, 38, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.fill();
  g.fillStyle = COLOR_FICHA[v];
  g.font = '900 34px Barlow Condensed, Arial Narrow, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(v >= 1000 ? v / 1000 + 'K' : v, 64, 66);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheTex.set(k, t);
  return t;
}
// Paño: la textura se mapea al medio círculo (centro del borde recto = (512, 512); 1 m ≈ 190 px).
function texPano() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1024;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(512, 560, 60, 512, 560, 560);
  grad.addColorStop(0, '#1d8a55');
  grad.addColorStop(1, '#0b4a2e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(242,201,76,.75)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(512, 512, 225, 0.3, Math.PI - 0.3);
  g.stroke();
  g.beginPath();
  g.arc(512, 512, 245, 0.3, Math.PI - 0.3);
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = 'rgba(242,201,76,.95)';
  g.font = '800 30px Barlow Condensed, Arial Narrow, sans-serif';
  g.fillText('BLACKJACK PAGA 3 A 2', 512, 690);
  g.font = '600 19px Barlow, Arial, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillText('La banca pide con 16 y se planta con 17', 512, 718);
  g.font = '800 22px Barlow Condensed, Arial Narrow, sans-serif';
  g.fillStyle = 'rgba(242,201,76,.55)';
  g.fillText('EL CASINO DE DOBRO', 512, 580);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function cartel(texto, color = '#fff', fondo = 'rgba(15,15,15,.82)', escala = 0.32) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 80;
  const g = cv.getContext('2d');
  g.font = '800 44px Barlow Condensed, Arial Narrow, sans-serif';
  const w = Math.min(250, g.measureText(texto).width + 36);
  g.fillStyle = fondo;
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 64, 32);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, 128, 42);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(escala * 3.2, escala, 1);
  s.renderOrder = 20;
  return s;
}

export class MesaBJ {
  constructor(contenedor) {
    this.cont = contenedor;
    this.canvas = document.createElement('canvas');
    contenedor.prepend(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120d0a);
    this.scene.fog = new THREE.Fog(0x120d0a, 9, 22);
    this.camara = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
    this.cartas = new Map(); // clave → { grupo, codigo, anim }
    this.fichas = []; // por asiento: { grupo, monto }
    this.personas = []; // por asiento: { persona, id }
    this.carteles = [];
    this.primera = -1;
    this.vista = { yaw: 0, pitch: 0.88, dist: 6.8, yawObj: 0, pitchObj: 0.88, distObj: 6.8 };
    this.reloj = 0;

    // luces: lámpara colgante sobre la mesa y ambiente cálido
    this.scene.add(new THREE.HemisphereLight(0xffe2b8, 0x20140c, 0.9));
    const lampara = new THREE.SpotLight(0xfff1d6, 60, 14, 0.75, 0.5, 1.6);
    lampara.position.set(0, 5.2, 0.2);
    lampara.target.position.set(0, 0.9, 0.1);
    lampara.castShadow = true;
    lampara.shadow.mapSize.set(1024, 1024);
    this.scene.add(lampara, lampara.target);
    const pantalla = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.45, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x0f3b26, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x05140c }));
    pantalla.position.set(0, 3.6, 0.1);
    this.scene.add(pantalla);
    this.pantalla = pantalla;

    // piso y paredes del salón
    const piso = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: 0x3a1418, roughness: 0.95 }));
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    this.scene.add(piso);
    for (let i = 0; i < 6; i++) {
      // columnas con luz cálida a lo lejos
      const a = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 16), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.6 }));
      col.position.set(Math.sin(a) * 8, 2, Math.cos(a) * 8);
      this.scene.add(col);
      const l = new THREE.PointLight(0xffb060, 3, 6);
      l.position.set(Math.sin(a) * 7.4, 2.6, Math.cos(a) * 7.4);
      this.scene.add(l);
    }

    // la mesa: media luna de madera con paño verde
    const madera = new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.45, metalness: 0.1 });
    const borde = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 0.14, 64, 1, false, -Math.PI / 2, Math.PI), madera);
    borde.position.set(0, MESA_Y - 0.07, CENTRO_Z); // la parte de arriba queda justo en MESA_Y
    borde.castShadow = borde.receiveShadow = true;
    this.scene.add(borde);
    const acolchado = new THREE.Mesh(new THREE.TorusGeometry(2.78, 0.08, 10, 64, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.4 }));
    acolchado.rotation.set(-Math.PI / 2, 0, Math.PI);
    acolchado.position.set(0, MESA_Y + 0.03, CENTRO_Z);
    this.scene.add(acolchado);
    const pano = new THREE.Mesh(new THREE.CircleGeometry(2.7, 64, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ map: texPano(), roughness: 0.95 }));
    pano.rotation.x = -Math.PI / 2;
    pano.position.set(0, MESA_Y + 0.002, CENTRO_Z);
    pano.receiveShadow = true;
    this.scene.add(pano);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.85, 1.6), new THREE.MeshStandardMaterial({ color: 0x24150a }));
    base.position.set(0, 0.43, CENTRO_Z + 0.9);
    this.scene.add(base);
    const fondoBanca = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.14, 0.4), madera);
    fondoBanca.position.set(0, MESA_Y - 0.07, CENTRO_Z - 0.2);
    this.scene.add(fondoBanca);
    // zapato y bandeja de fichas de la banca
    const zapato = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4 }));
    zapato.position.set(1.35, MESA_Y + 0.09, CENTRO_Z + 0.35);
    zapato.rotation.y = -0.3;
    zapato.castShadow = true;
    this.scene.add(zapato);
    this.zapato = new THREE.Vector3(1.3, MESA_Y + 0.2, CENTRO_Z + 0.45);
    const bandeja = new THREE.Group();
    [10, 50, 100, 500, 1000, 5000].forEach((v, i) => {
      for (let k = 0; k < 6; k++) {
        const f = this.ficha(v);
        f.position.set(-0.6 + i * 0.24, MESA_Y + 0.012 + k * 0.022, CENTRO_Z + 0.18);
        bandeja.add(f);
      }
    });
    this.scene.add(bandeja);
    // lugares: círculo para la apuesta y silla
    for (let i = 0; i < ASIENTOS; i++) {
      const p = puntoArco(i, 2.05);
      const aro = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.17, 40), new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.8 }));
      aro.rotation.x = -Math.PI / 2;
      aro.position.set(p.x, MESA_Y + 0.003, p.z);
      this.scene.add(aro);
      const s = puntoArco(i, 3.15);
      const silla = new THREE.Group();
      const asiento = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0x7a1f2b, roughness: 0.6 }));
      asiento.position.y = 0.52;
      const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xb8902c, metalness: 0.7, roughness: 0.3 }));
      pata.position.y = 0.25;
      const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), asiento.material);
      respaldo.position.set(0, 0.8, 0.27);
      silla.add(asiento, pata, respaldo);
      silla.position.set(s.x, 0, s.z);
      silla.rotation.y = -anguloAsiento(i);
      silla.traverse((o) => (o.castShadow = true));
      this.scene.add(silla);
      this.personas.push(null);
      this.fichas.push(null);
      this.carteles.push(null);
    }

    this.marca = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 40), new THREE.MeshBasicMaterial({ color: 0xc5f04a, transparent: true, opacity: 0.9 }));
    this.marca.rotation.x = -Math.PI / 2;
    this.scene.add(this.marca);

    // Dobro, el crupier
    const dobro = POR_ID.dobro;
    this.dobro = crearPersona(THREE, { ...dobro.look, smoking: true }, { nombre: 'Dobro', colorNombre: '#f2c94c', tamCartel: 0.3, tamGlobo: 0.26 });
    this.dobro.grupo.position.set(0, 0, CENTRO_Z - 0.6);
    this.dobro.grupo.rotation.y = Math.PI;
    this.scene.add(this.dobro.grupo);
    this.ultimaFraseDobro = 0;
    this.fraseAnt = null;

    this.totalBanca = null;
    this.redimensionar();
    this._resize = () => this.redimensionar();
    addEventListener('resize', this._resize);
    this.controlesCamara();
    this.ultimo = performance.now();
    const loop = (ms) => {
      this.raf = requestAnimationFrame(loop);
      this.cuadro(Math.min(0.1, (ms - this.ultimo) / 1000));
      this.ultimo = ms;
    };
    this.raf = requestAnimationFrame(loop);
  }

  redimensionar() {
    const w = this.cont.clientWidth || 800;
    const h = this.cont.clientHeight || 480;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  // arrastrar para girar la cámara alrededor de la mesa, rueda para acercar
  controlesCamara() {
    let arr = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      arr = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!arr) return;
      if (this.primera >= 0) {
        // mover la cabeza: girar y mirar arriba/abajo
        this.vista.yawObj = Math.max(-1.5, Math.min(1.5, this.vista.yawObj - (e.clientX - arr.x) * 0.003));
        this.vista.pitchObj = Math.max(-1.0, Math.min(0.35, this.vista.pitchObj - (e.clientY - arr.y) * 0.003));
      } else {
        this.vista.yawObj -= (e.clientX - arr.x) * 0.005;
        this.vista.pitchObj = Math.max(0.25, Math.min(1.25, this.vista.pitchObj + (e.clientY - arr.y) * 0.004));
      }
      arr = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', () => (arr = null));
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.primera >= 0) {
        this.camara.fov = Math.max(38, Math.min(75, this.camara.fov + e.deltaY * 0.02));
        return this.camara.updateProjectionMatrix();
      }
      this.vista.distObj = Math.max(3.5, Math.min(10, this.vista.distObj + e.deltaY * 0.004));
    }, { passive: false });
  }

  // Sentado: la cámara va a tus ojos y mirás la mesa (como en el truco); sin lugar: vista desde arriba.
  mirarDesde(asiento) {
    this.primera = asiento;
    if (asiento >= 0) {
      this.vista.yaw = this.vista.yawObj = 0;
      this.vista.pitch = this.vista.pitchObj = -0.32;
      this.camara.fov = 62;
    } else {
      this.vista.yawObj = 0;
      this.vista.pitchObj = 0.88;
      this.vista.distObj = 6.8;
      this.camara.fov = 42;
    }
    this.camara.updateProjectionMatrix();
    this.personas.forEach((p, i) => p && (p.persona.grupo.visible = i !== this.primera));
  }

  ficha(v) {
    const lado = new THREE.MeshStandardMaterial({ color: COLOR_FICHA[v], roughness: 0.4 });
    const cara = new THREE.MeshStandardMaterial({ map: texFicha(v), roughness: 0.4 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), [lado, cara, cara]);
    m.castShadow = true;
    return m;
  }

  nuevaCarta(codigo) {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.34, 0.48);
    const frente = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texCarta(codigo === 'X' ? 'AP' : codigo), roughness: 0.5 }));
    frente.rotation.x = -Math.PI / 2;
    const dorso = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texCarta('X'), roughness: 0.5 }));
    dorso.rotation.x = Math.PI / 2;
    frente.castShadow = dorso.castShadow = true;
    g.add(frente, dorso);
    g.userData = { frente };
    this.scene.add(g);
    return g;
  }

  // ---------------------------------------------------------------- estado del servidor → escena
  actualizar(e, nombres = {}) {
    // personas sentadas
    e.asientos.forEach((a, i) => {
      const actual = this.personas[i];
      if (!a) {
        if (actual) this.scene.remove(actual.persona.grupo);
        this.personas[i] = null;
        return;
      }
      if (actual?.id === a.id) return;
      if (actual) this.scene.remove(actual.persona.grupo);
      const look = a.bot ? { ...POR_ID[a.bot]?.look } : nombres.look?.(a.id) || lookDeId(a.id, nombres.color?.(a.id) || '#7aa2ff');
      const p = crearPersona(THREE, look, { nombre: a.nombre + (a.soyYo ? ' (vos)' : ''), colorNombre: a.soyYo ? '#c5f04a' : '#fff', tamCartel: 0.26, tamGlobo: 0.24 });
      const s = puntoArco(i, 3.12);
      p.grupo.position.set(s.x, 0.06, s.z); // la cadera queda apoyada en el asiento
      const dx = 0 - s.x;
      const dz = CENTRO_Z - s.z;
      p.grupo.rotation.y = Math.atan2(-dx, -dz);
      p.grupo.visible = i !== this.primera; // a mí no me veo (estoy mirando desde mis ojos)
      this.scene.add(p.grupo);
      this.personas[i] = { persona: p, id: a.id };
    });

    // fichas de cada apuesta
    e.asientos.forEach((a, i) => {
      const monto = a?.apuesta || 0;
      const f = this.fichas[i];
      if (f?.monto === monto) return;
      if (f) this.scene.remove(f.grupo);
      this.fichas[i] = null;
      if (!monto) return;
      const g = new THREE.Group();
      const p = puntoArco(i, 2.05);
      const lista = enFichas(monto, 12);
      lista.forEach((v, k) => {
        const m = this.ficha(v);
        m.position.set(p.x + (k % 2 ? 0.006 : -0.004), MESA_Y + 0.011 + k * 0.021, p.z);
        g.add(m);
      });
      g.userData.y0 = 0.35;
      g.position.y = 0.35; // caen sobre el paño
      this.scene.add(g);
      this.fichas[i] = { grupo: g, monto };
    });

    // cartas: banca y cada lugar
    const vistas = new Set();
    const ahora = performance.now();
    let orden = 0;
    const ubicar = (clave, codigo, destino, ry) => {
      vistas.add(clave);
      let c = this.cartas.get(clave);
      if (!c) {
        const grupo = this.nuevaCarta(codigo);
        grupo.position.copy(this.zapato);
        grupo.rotation.set(0, ry, Math.PI);
        c = { grupo, codigo: null, desde: this.zapato.clone(), hasta: destino, t0: ahora + orden++ * 260, dur: 0.42, ry, volteo: codigo === 'X' ? Math.PI : 0, volteoDesde: Math.PI };
        this.cartas.set(clave, c);
      }
      if (c.codigo !== codigo) {
        if (codigo !== 'X') c.grupo.userData.frente.material.map = texCarta(codigo);
        c.grupo.userData.frente.material.needsUpdate = true;
        if (c.codigo === 'X' && codigo !== 'X') {
          // se da vuelta la carta tapada de la banca
          c.volteoDesde = Math.PI;
          c.volteo = 0;
          c.tv = ahora;
        }
        c.codigo = codigo;
      }
    };
    e.banca.forEach((cod, k) => {
      const x = (k - (e.banca.length - 1) / 2) * 0.26;
      ubicar(`b${k}`, cod, new THREE.Vector3(x, MESA_Y + 0.004 + k * 0.001, CENTRO_Z + 0.62), 0);
    });
    e.asientos.forEach((a, i) => {
      if (!a?.cartas?.length) return;
      const centro = puntoArco(i, 1.62);
      const ang = anguloAsiento(i);
      a.cartas.forEach((cod, k) => {
        const t = (k - (a.cartas.length - 1) / 2) * 0.13;
        const d = new THREE.Vector3(centro.x + Math.cos(ang) * t, MESA_Y + 0.004 + k * 0.001, centro.z + Math.sin(ang) * t - k * 0.04);
        ubicar(`a${i}-${k}`, cod, d, -ang);
      });
    });
    // las que ya no están se van al descarte
    for (const [clave, c] of this.cartas) if (!vistas.has(clave) && !c.saliendo) {
      c.saliendo = true;
      c.desde = c.grupo.position.clone();
      c.hasta = new THREE.Vector3(-1.4, MESA_Y + 0.2, CENTRO_Z + 0.4);
      c.t0 = ahora + Math.random() * 200;
      c.dur = 0.5;
    }

    // totales arriba de cada mano
    const total = (clave, texto, pos, color) => {
      const firma = texto + color;
      let s = this.carteles[clave];
      if (s?.firma === firma) return;
      if (s) this.scene.remove(s);
      if (!texto) {
        this.carteles[clave] = null;
        return;
      }
      s = cartel(texto, color, 'rgba(15,15,15,.82)', 0.17);
      s.position.copy(pos);
      s.firma = firma;
      this.scene.add(s);
      this.carteles[clave] = s;
    };
    e.asientos.forEach((a, i) => {
      const p = puntoArco(i, 1.45).add(new THREE.Vector3(0, 0.16, 0));
      if (!a?.cartas?.length) return total(i, '', p);
      const txt = a.res ? { gana: 'GANA', pierde: 'PIERDE', empate: 'EMPATE', blackjack: 'BLACKJACK' }[a.res] + (a.res === 'pierde' ? '' : ` ${a.total}`) : a.total > 21 ? `${a.total} SE PASÓ` : a.cartas.length === 2 && a.total === 21 ? 'BLACKJACK' : String(a.total);
      const col = a.res === 'gana' || a.res === 'blackjack' ? '#c5f04a' : a.res === 'pierde' || a.total > 21 ? '#ff8a7a' : '#fff';
      total(i, txt, p, col);
    });
    total('banca', e.banca.length ? `BANCA ${e.bancaTotal}${e.banca.includes('X') ? '' : e.bancaTotal > 21 ? ' SE PASÓ' : ''}` : '', new THREE.Vector3(0, MESA_Y + 0.2, CENTRO_Z + 0.32), e.bancaTotal > 21 ? '#ff8a7a' : '#f2c94c');

    // turno: la persona que juega se marca
    this.turno = e.fase === 'jugando' ? e.turno : -1;
    this.fase = e.fase;
  }

  // Dobro habla (en un globito) cuando pasa algo o cada tanto.
  hablar(texto) {
    this.dobro.decir(texto, 4.5);
    this.ultimaFraseDobro = this.reloj;
  }
  decirAsiento(i, texto) {
    this.personas[i]?.persona.decir(texto, 4.5);
  }

  cuadro(dt) {
    this.reloj += dt;
    const ahora = performance.now();
    // cámara suave
    const v = this.vista;
    const k = 1 - Math.exp(-dt * 6);
    v.yaw += (v.yawObj - v.yaw) * k;
    v.pitch += (v.pitchObj - v.pitch) * k;
    v.dist += (v.distObj - v.dist) * k;
    if (this.primera >= 0) {
      // ojos de mi personaje sentado, mirando hacia Dobro (más lo que gire la cabeza)
      const ojo = puntoArco(this.primera, 3.05);
      ojo.y = 1.4;
      const base = Math.atan2(0 - ojo.x, CENTRO_Z - 0.3 - ojo.z);
      const yaw = base + v.yaw;
      this.camara.position.copy(ojo);
      this.camara.lookAt(ojo.x + Math.sin(yaw) * Math.cos(v.pitch), ojo.y + Math.sin(v.pitch), ojo.z + Math.cos(yaw) * Math.cos(v.pitch));
    } else {
      const objetivo = new THREE.Vector3(0, MESA_Y + 0.25, CENTRO_Z + 0.7);
      this.camara.position.set(objetivo.x + Math.sin(v.yaw) * Math.cos(v.pitch) * v.dist, objetivo.y + Math.sin(v.pitch) * v.dist, objetivo.z + Math.cos(v.yaw) * Math.cos(v.pitch) * v.dist);
      this.camara.lookAt(objetivo);
    }
    this.pantalla.visible = this.camara.position.y < 3.3; // desde muy arriba taparía la mesa

    // cartas volando
    for (const [clave, c] of this.cartas) {
      const p = Math.max(0, Math.min(1, (ahora - c.t0) / 1000 / c.dur));
      const q = 1 - (1 - p) ** 3;
      c.grupo.position.lerpVectors(c.desde, c.hasta, q);
      c.grupo.position.y += Math.sin(p * Math.PI) * 0.18;
      c.grupo.visible = ahora >= c.t0 || c.saliendo;
      let rz = c.volteo;
      if (!c.saliendo && p < 1) rz = Math.PI + (c.volteo - Math.PI) * q; // sale tapada del zapato y se da vuelta al caer
      if (c.tv) {
        const pv = Math.min(1, (ahora - c.tv) / 450);
        rz = c.volteoDesde + (c.volteo - c.volteoDesde) * pv;
        c.grupo.position.y += Math.sin(pv * Math.PI) * 0.12;
        if (pv >= 1) c.tv = null;
      }
      c.grupo.rotation.set(0, c.ry, rz);
      if (c.saliendo && p >= 1) {
        this.scene.remove(c.grupo);
        this.cartas.delete(clave);
      }
    }
    // fichas que caen
    for (const f of this.fichas) if (f && f.grupo.position.y > 0) f.grupo.position.y = Math.max(0, f.grupo.position.y - dt * 2.2);
    // personas
    this.personas.forEach((p) => p?.persona.animar('sentado', dt));
    this.dobro.animar('quieto', dt);
    // marca de turno: aro que late en el lugar del que juega
    this.marca.visible = this.turno >= 0;
    if (this.turno >= 0) {
      const p = puntoArco(this.turno, 2.05);
      this.marca.position.set(p.x, MESA_Y + 0.004, p.z);
      this.marca.scale.setScalar(1 + Math.sin(this.reloj * 6) * 0.08);
    }
    this.renderer.render(this.scene, this.camara);
  }

  destruir() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this._resize);
    this.renderer.dispose();
  }
}
