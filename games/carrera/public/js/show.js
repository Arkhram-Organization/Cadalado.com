// La sala del show de Full Gays: entre rondas (los eliminados se caen al vacío de a uno y los
// clasificados festejan) y el podio final (los tres mejores arriba, fuegos artificiales y luces).
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';

const ARCOIRIS = ['#ff3b5c', '#ff8a3d', '#ffd23f', '#5ee36a', '#3fb5ff', '#9b5cff'];

function cieloTextura() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const d = g.createLinearGradient(0, 0, 0, 256);
  d.addColorStop(0, '#120a2e'); d.addColorStop(0.45, '#3b1a6b'); d.addColorStop(0.75, '#b0388f'); d.addColorStop(1, '#ff7aa8');
  g.fillStyle = d; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Show {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: cieloTextura(), side: THREE.BackSide, fog: false }));
    this.scene.add(cielo);
    this.scene.fog = new THREE.Fog('#3b1a6b', 40, 160);
    // estrellas
    const pos = [];
    for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 180; pos.push(Math.cos(a) * r, -80 + Math.random() * 190, Math.sin(a) * r - 40); }
    this.scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 0.6, fog: false })));
    this.scene.add(new THREE.HemisphereLight('#ffe9ff', '#3a1a5a', 1.4));
    const sol = new THREE.DirectionalLight('#ffffff', 2); sol.position.set(6, 18, 12); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
    this.scene.add(sol);
    // reflectores de colores que barren
    this.focos = ARCOIRIS.slice(0, 4).map((c, i) => {
      const f = new THREE.SpotLight(c, 60, 60, 0.35, 0.6, 1.2); f.position.set(-12 + i * 8, 16, 6);
      f.target.position.set(0, 0, 0); this.scene.add(f, f.target); return f;
    });
    // escenario flotante con un aro de arcoíris
    const escenario = new THREE.Group(); this.scene.add(escenario);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 9, 3, 48), new THREE.MeshStandardMaterial({ color: '#2a1b40', roughness: 0.6 }));
    base.position.y = -1.6; base.receiveShadow = true; escenario.add(base);
    ARCOIRIS.forEach((c, i) => { const aro = new THREE.Mesh(new THREE.TorusGeometry(13 - i * 0.12, 0.12, 6, 64), new THREE.MeshBasicMaterial({ color: c })); aro.rotation.x = Math.PI / 2; aro.position.y = -0.12 - i * 0.18; escenario.add(aro); });
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(12.6, 12.6, 0.2, 48), new THREE.MeshStandardMaterial({ color: '#f4eefc', roughness: 0.4 }));
    piso.position.y = -0.1; piso.receiveShadow = true; escenario.add(piso);
    // el arcoíris de fondo
    ARCOIRIS.forEach((c, i) => { const arco = new THREE.Mesh(new THREE.TorusGeometry(20 - i * 1.1, 0.55, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, fog: false })); arco.position.set(0, -2, -18); this.scene.add(arco); });
    this.cartel = this.texto('');
    this.cartel.position.set(0, 5.5, -11); this.scene.add(this.cartel);
    this.gente = []; this.particulas = []; this.extra = new THREE.Group(); this.scene.add(this.extra);
    this.t = 0;
  }
  texto(txt) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, fog: false }));
    m.userData.c = c;
    m.userData.poner = (t, color = '#ffffff') => {
      const g = c.getContext('2d'); g.clearRect(0, 0, 1024, 192);
      g.font = '900 120px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#1b0b33'; g.strokeText(t, 512, 100); g.fillStyle = color; g.fillText(t, 512, 100);
      m.material.map.colorSpace = THREE.SRGBColorSpace; m.material.map.needsUpdate = true;
    };
    m.userData.poner(txt);
    return m;
  }
  limpiar() {
    for (const p of this.gente) { this.scene.remove(p.raiz); p.persona.dispose?.(); }
    this.gente = [];
    this.extra.clear();
    for (const p of this.particulas) this.scene.remove(p.obj);
    this.particulas = [];
  }
  // lista: [{ id, nombre, look, paso }] — modo 'ronda' o 'podio' (lista ordenada por puesto)
  armar(modo, lista, { titulo = '' } = {}) {
    this.limpiar();
    this.modo = modo; this.t = 0;
    this.cartel.userData.poner(titulo, modo === 'podio' ? '#ffd23f' : '#ffffff');
    this.cartel.visible = modo !== 'podio'; // el título del podio vive en el HUD, sin tapar las caras
    const n = lista.length;
    if (modo === 'ronda') {
      // en arco: los que pasan y los que no, mezclados como llegaron
      lista.forEach((x, i) => {
        const a = n === 1 ? 0 : (-0.5 + i / (n - 1)) * Math.min(1.8, 0.25 * n);
        const r = n > 10 ? 7 : 5.3;
        this.sumar(x, Math.sin(a) * r, 0, -Math.cos(a) * r + 5.5, Math.PI - a * 0.5, i);
      });
      // los eliminados se caen de a uno
      let k = 0;
      for (const p of this.gente) if (!p.x.paso) p.cae = 1.6 + 0.85 * k++;
      this.finCaidas = 1.6 + 0.85 * k + 0.6;
    } else {
      // podio: 2º, 1º y 3º arriba; el resto alrededor
      const alturas = [3, 2, 1.3], xs = [0, -3.4, 3.4], colores = ['#ffd23f', '#d9dde3', '#d08a4a'];
      for (let i = 0; i < 3; i++) {
        const bloque = new THREE.Mesh(new THREE.BoxGeometry(3.2, alturas[i], 3), new THREE.MeshStandardMaterial({ color: colores[i], roughness: 0.3, metalness: 0.5, emissive: colores[i], emissiveIntensity: 0.15 }));
        bloque.position.set(xs[i], alturas[i] / 2, 1); bloque.castShadow = true; bloque.receiveShadow = true; this.extra.add(bloque);
        const num = this.texto(String(i + 1)); num.scale.setScalar(0.25); num.position.set(xs[i], alturas[i] / 2, 2.52); this.extra.add(num);
        if (lista[i]) this.sumar(lista[i], xs[i], alturas[i], 1, Math.PI, i, i + 1);
      }
      lista.slice(3).forEach((x, j) => {
        const a = (j / Math.max(1, n - 3)) * Math.PI - Math.PI / 2, r = 7.5;
        this.sumar(x, Math.sin(a) * r * 1.2, 0, 5.5 - Math.cos(a) * 1.5 + 2, Math.PI - a * 0.35, j + 3);
      });
    }
  }
  sumar(x, px, py, pz, ry, i, puesto = 0) {
    const persona = crearPersona(THREE, x.look, { nombre: x.nombre, tamCartel: this.modo === 'podio' ? 0.65 : 0.42, colorNombre: puesto === 1 ? '#ffd23f' : x.paso === false ? '#ff9a9a' : '#ffffff', sombras: true });
    if (this.modo === 'podio') persona.grupo.scale.setScalar(puesto === 1 ? 1.3 : 1.15);
    const raiz = new THREE.Group(); raiz.add(persona.grupo); raiz.position.set(px, py + 9, pz); raiz.rotation.y = ry;
    this.scene.add(raiz);
    let losa = null;
    if (this.modo === 'ronda') {
      losa = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.9), new THREE.MeshStandardMaterial({ color: ARCOIRIS[i % ARCOIRIS.length], roughness: 0.4, emissive: ARCOIRIS[i % ARCOIRIS.length], emissiveIntensity: 0.25 }));
      losa.position.set(px, -0.05, pz); losa.receiveShadow = true; this.scene.add(losa); this.extra.attach?.(losa);
    }
    this.gente.push({ x, persona, raiz, losa, base: { x: px, y: py, z: pz }, demora: 0.12 * i, puesto, vy: 0 });
  }
  chispazo(x, y, z, colores, n = 40, fuerza = 9) {
    const pos = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos.set([x, y, z], i * 3);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, v = fuerza * (0.4 + Math.random() * 0.6);
      vel.push([Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v + fuerza * 0.4, Math.sin(a) * Math.cos(b) * v]);
      c.set(colores[i % colores.length]); col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const obj = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.scene.add(obj);
    this.particulas.push({ obj, vel, vida: 1.8, total: 1.8 });
  }
  render(dt) {
    this.t += dt;
    const t = this.t;
    const c = this.renderer.domElement;
    const w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.camara.aspect = w / h; this.camara.updateProjectionMatrix();
    // La cámara queda enfrente de los personajes y suficientemente cerca para reconocerlos.
    const estrecho = Math.max(0, 1.4 - this.camara.aspect) * 7;
    const lejos = (this.modo === 'podio' ? 9.5 : 11.5 + Math.max(0, this.gente.length - 10) * 0.55) + estrecho;
    const giro = Math.sin(t * 0.28) * 0.06;
    this.camara.position.set(Math.sin(giro) * lejos, this.modo === 'podio' ? 4.3 : 3.4, Math.cos(giro) * lejos + 2);
    this.camara.lookAt(0, this.modo === 'podio' ? 2.3 : 1.2, 0);
    this.focos.forEach((f, i) => f.target.position.set(Math.sin(t * (0.7 + i * 0.23) + i) * 7, 0, Math.cos(t * 0.5 + i) * 4 + 1));
    this.cartel.position.y = 5.5 + Math.sin(t * 1.4) * 0.15;
    for (const p of this.gente) {
      const k = Math.max(0, t - p.demora);
      // entrada: caen del cielo y rebotan
      let y = p.base.y + Math.max(0, 9 - k * k * 14);
      if (k > 0.8 && k < 1.2) y += Math.sin(((k - 0.8) / 0.4) * Math.PI) * 0.4;
      let anim = 'quieto';
      if (p.cae !== undefined && t > p.cae) {
        // la losa tiembla en rojo y se cae con la persona al vacío, dando vueltas
        const kc = t - p.cae;
        if (p.losa) p.losa.material.color.set(kc < 0.45 && Math.floor(kc * 14) % 2 ? '#ff2b2b' : '#7a1020');
        if (kc < 0.45) { p.raiz.position.x = p.base.x + Math.sin(kc * 70) * 0.08; anim = 'golpe'; }
        else {
          if (!p.cayo) { p.cayo = true; this.chispazo(p.base.x, 0.5, p.base.z, ['#ff3b5c', '#ffb3b3', '#ffffff'], 30, 6); }
          const kk = kc - 0.45;
          y = p.base.y - kk * kk * 9;
          p.raiz.rotation.x = kk * 3; p.raiz.rotation.z = kk * 2;
          if (p.losa) { p.losa.position.y = -0.05 - kk * kk * 9; p.losa.rotation.x = kk * 2; }
          anim = 'muerto';
        }
      } else if (this.modo === 'ronda' && t > (this.finCaidas || 0) && p.x.paso) anim = Math.floor(t + p.demora * 10) % 2 ? 'baila' : 'festeja';
      else if (this.modo === 'podio' && t > 1.5) anim = p.puesto === 1 ? 'baila' : p.puesto <= 3 ? 'festeja' : Math.floor(t * 0.5 + p.demora * 4) % 3 === 0 ? 'festeja' : 'saluda';
      p.raiz.position.y = y;
      p.raiz.visible = y > -40;
      p.persona.animar(anim.startsWith('g-') ? anim : anim, dt);
    }
    // fuegos artificiales y papelitos
    if (this.modo === 'podio' ? t > 1.2 : t > (this.finCaidas || 99)) {
      this.proximo = (this.proximo ?? 0) - dt;
      if (this.proximo <= 0) {
        this.proximo = this.modo === 'podio' ? 0.45 : 0.8;
        const x = (Math.random() - 0.5) * 22, y = 7 + Math.random() * 7, z = -6 - Math.random() * 6;
        this.chispazo(x, y, z, [ARCOIRIS[Math.floor(Math.random() * 6)], '#ffffff', ARCOIRIS[Math.floor(Math.random() * 6)]], 70, 7);
      }
    }
    this.particulas = this.particulas.filter((p) => {
      p.vida -= dt;
      const a = p.obj.geometry.attributes.position;
      p.vel.forEach((v, i) => { v[1] -= 9 * dt; a.setXYZ(i, a.getX(i) + v[0] * dt, a.getY(i) + v[1] * dt, a.getZ(i) + v[2] * dt); });
      a.needsUpdate = true;
      p.obj.material.opacity = Math.max(0, p.vida / p.total);
      if (p.vida <= 0) { this.scene.remove(p.obj); p.obj.geometry.dispose(); p.obj.material.dispose(); return false; }
      return true;
    });
    this.renderer.render(this.scene, this.camara);
  }
}
