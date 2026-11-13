// Escenarios callejeros de Piña Final: el Barrio Chino (sakura y faroles), el Callejón (lluvia y grafitis)
// y la Avenida (pantallas gigantes, autos y una ronda de gente). Todo con geometría y texturas dibujadas acá.
// Cada uno devuelve { anim: [fn(dt, t)], vitorear(fuerza), ...luces } para la escena.
import * as THREE from '/comun/vendor/three.module.min.js';
import { halo } from './objetos3d.js';

// ---------------------------------------------------------------- utilidades
export function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.canvas = c;
  return t;
}
export function rng(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
const emis = (color, k = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: .5 });
const FUENTE = '"Barlow Condensed", "Arial Black", sans-serif';
const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export function cieloCiudad(arriba, medio, abajo, estrellas = 80) {
  return lienzo(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, arriba); gr.addColorStop(.55, medio); gr.addColorStop(1, abajo);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(17);
    for (let i = 0; i < estrellas; i++) { g.fillStyle = `rgba(255,255,255,${.2 + r() * .6})`; g.fillRect(r() * w, r() * h * .45, 1.2, 1.2); }
  });
}

// Piso de calle: adoquines o asfalto, mojado (brillos y charcos que reflejan colores)
function calle({ tipo = 'asfalto', ancho = 46, fondo = 18, reflejos = ['#ff3b5c', '#ffb02a'], marcas = true, seed = 3 }) {
  const r = rng(seed);
  const tex = lienzo(1024, 512, (g, w, h) => {
    if (tipo === 'adoquin') {
      g.fillStyle = '#3a3438'; g.fillRect(0, 0, w, h);
      const ta = 32;
      for (let y = 0; y < h; y += ta / 2) for (let x = (y / (ta / 2)) % 2 ? -ta / 2 : 0; x < w; x += ta) {
        const k = 40 + r() * 30;
        g.fillStyle = `rgb(${k + 8},${k},${k + 6})`;
        g.fillRect(x + 1.5, y + 1.5, ta - 3, ta / 2 - 3);
      }
    } else {
      g.fillStyle = '#26262c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const k = r(); g.fillStyle = k < .5 ? `rgba(0,0,0,${r() * .25})` : `rgba(255,255,255,${r() * .06})`; g.fillRect(r() * w, r() * h, 2, 2); }
      // grietas y parches
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
      for (let i = 0; i < 14; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - .5) * 60; y += (r() - .5) * 30; g.lineTo(x, y); } g.stroke(); }
      if (marcas) {
        g.fillStyle = 'rgba(235,230,210,.55)';
        for (let x = 0; x < w; x += 110) g.fillRect(x, h * .5 - 5, 60, 10);
      }
    }
    // charcos que reflejan los neones
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = r() * h, rx = 40 + r() * 90, ry = 14 + r() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rx);
      const c = reflejos[i % reflejos.length];
      gr.addColorStop(0, c + '66'); gr.addColorStop(.5, c + '22'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = 'rgba(10,10,16,.5)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ancho / 16, fondo / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), new THREE.MeshStandardMaterial({ map: tex, roughness: .32, metalness: .35 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -fondo / 2 + 5); m.receiveShadow = true;
  return m;
}

// reflejo de una luz en el piso mojado: una mancha estirada que brilla
export function reflejo(color, x, z, ancho = 1, largo = 3, op = .35) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(ancho, largo), new THREE.MeshBasicMaterial({ map: texturaMancha(), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; s.position.set(x, .012, z);
  return s;
}
let _mancha = null;
function texturaMancha() {
  _mancha ??= lienzo(64, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return _mancha;
}

// Fachada de un edificio: local abajo (vidriera prendida, persiana, toldo) y ventanas arriba
export function fachada({ w, h, color, r, local = true, toldo = null, letrero = null, letreroColor = '#ffd27a', cjk = false }) {
  const px = 64;
  return lienzo(Math.round(w * px), Math.round(h * px), (g, W, H) => {
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    // textura de revoque
    for (let i = 0; i < W * H / 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * .08})`; g.fillRect(r() * W, r() * H, 3, 3); }
    // líneas de piso
    const pisoH = 2.6 * px, base = local ? 3.2 * px : 0;
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = H - base - pisoH; y > 0; y -= pisoH) g.fillRect(0, y, W, 6);
    // ventanas
    const vw = .9 * px, vh = 1.3 * px;
    for (let y = H - base - pisoH + .6 * px; y > .3 * px; y -= pisoH) {
      for (let x = .5 * px; x + vw < W - .3 * px; x += 1.6 * px) {
        const prendida = r() < .45;
        g.fillStyle = '#121018'; g.fillRect(x - 4, y - 4, vw + 8, vh + 8);
        if (prendida) {
          const gr = g.createLinearGradient(0, y, 0, y + vh);
          const c = r() < .25 ? ['#ff9a6a', '#c23a4a'] : r() < .5 ? ['#9fe8ff', '#3a6ab8'] : ['#ffe2a0', '#c98a3a'];
          gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
          g.fillStyle = gr;
        } else g.fillStyle = '#23202c';
        g.fillRect(x, y, vw, vh);
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + vw / 2 - 2, y, 4, vh); g.fillRect(x, y + vh * .45, vw, 4);
        if (prendida && r() < .4) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + r() * vw * .5, y + vh * .3, vw * .3, vh * .7); } // alguien mirando
        // balcón con baranda
        if (r() < .35) { g.fillStyle = '#1a1820'; g.fillRect(x - 10, y + vh + 6, vw + 20, 6); for (let k = 0; k < 6; k++) g.fillRect(x - 8 + k * (vw + 16) / 5, y + vh - 14, 3, 22); }
        // aire acondicionado
        if (r() < .2) { g.fillStyle = '#b8b4ac'; g.fillRect(x + vw + 6, y + vh * .5, .5 * px, .35 * px); g.fillStyle = '#6a665e'; for (let k = 0; k < 4; k++) g.fillRect(x + vw + 10, y + vh * .5 + 6 + k * 5, .4 * px, 2); }
      }
    }
    if (!local) return;
    // local de abajo
    const y0 = H - base;
    g.fillStyle = '#16141c'; g.fillRect(0, y0, W, base);
    const vid = g.createLinearGradient(0, y0 + base * .35, 0, H);
    vid.addColorStop(0, '#ffe7b0'); vid.addColorStop(1, '#d9823a');
    g.fillStyle = vid; g.fillRect(.4 * px, y0 + base * .38, W * .55, base * .55);
    // cosas en la vidriera
    for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(${80 + r() * 100},${30 + r() * 60},${20 + r() * 40},.9)`; g.fillRect(.6 * px + k * W * .07, y0 + base * .62 + r() * 20, W * .045, base * .3); }
    // persiana a medio bajar en el resto
    g.fillStyle = '#5a5c62'; g.fillRect(W * .62, y0 + base * .3, W * .34, base * .7);
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = y0 + base * .3; y < H; y += 9) g.fillRect(W * .62, y, W * .34, 3);
    // grafiti en la persiana
    g.save(); g.translate(W * .79, y0 + base * .72); g.rotate(-.12);
    g.font = `900 ${base * .2}px ${FUENTE}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#111'; g.fillStyle = r() < .5 ? '#ff4fa3' : '#c5f04a';
    const tag = ['PIÑA', 'MXD', 'QUEQUE', 'J.L.', 'CDL'][Math.floor(r() * 5)];
    g.strokeText(tag, 0, 0); g.fillText(tag, 0, 0); g.restore();
    // toldo a rayas
    if (toldo) {
      for (let k = 0; k < W; k += 28) { g.fillStyle = (k / 28) % 2 ? toldo : '#f4efe4'; g.fillRect(k, y0, 28, base * .22); }
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y0 + base * .22, W, 6);
    }
    // letrero del local
    if (letrero) {
      g.fillStyle = '#1b0f0f'; g.fillRect(.3 * px, y0 - .75 * px, W - .6 * px, .7 * px);
      g.strokeStyle = letreroColor; g.lineWidth = 3; g.strokeRect(.3 * px + 4, y0 - .75 * px + 4, W - .6 * px - 8, .7 * px - 8);
      g.font = `900 ${.48 * px}px ${cjk ? CJK : FUENTE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = letreroColor; g.shadowBlur = 14; g.fillStyle = letreroColor;
      g.fillText(letrero, W / 2, y0 - .4 * px); g.shadowBlur = 0;
    }
  });
}

export function edificio(raiz, { x, z, w, h, d = 3, color, r, ...op }) {
  const tex = fachada({ w, h, color, r, ...op });
  const lado = mat('#1c1a22');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [lado, lado, mat('#141218'), lado, new THREE.MeshStandardMaterial({ map: tex, roughness: .9, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .32 }), lado]);
  m.position.set(x, h / 2, z - d / 2); m.receiveShadow = true;
  raiz.add(m);
  // cornisa
  const c = new THREE.Mesh(new THREE.BoxGeometry(w + .2, .25, d + .3), mat('#2a2630'));
  c.position.set(x, h + .1, z - d / 2); raiz.add(c);
  return m;
}

// Cartel vertical de neón (como los de los barrios chinos): letras de arriba a abajo
function neonVertical(raiz, anim, { x, y, z, texto, color = '#ff3b5c', cjk = true, alto = 2.6, parpadea = false }) {
  const tex = lienzo(96, 384, (g, w, h) => {
    g.fillStyle = '#120a0e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 5; g.shadowColor = color; g.shadowBlur = 14; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#fff6f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const letras = [...texto];
    const t = Math.min(72, (h - 40) / letras.length);
    g.font = `900 ${t}px ${cjk ? CJK : FUENTE}`;
    g.shadowBlur = 18;
    letras.forEach((l, i) => g.fillText(l, w / 2, 24 + t / 2 + i * t + ((h - 48) - letras.length * t) / 2));
  });
  const caja = new THREE.Mesh(new THREE.BoxGeometry(.62, alto, .14), [mat('#1a1418'), mat('#1a1418'), mat('#1a1418'), mat('#1a1418'), new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
  caja.position.set(x, y, z); raiz.add(caja);
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .5), mat('#2a2a30', { metalness: .7 })); brazo.position.set(x, y + alto / 2 - .2, z - .3); raiz.add(brazo);
  const h = halo(color, 2.8, .32); h.position.set(x, y, z + .1); raiz.add(h);
  const ref = reflejo(color, x, z + 2.2, .9, 3.2, .3); raiz.add(ref);
  if (parpadea) {
    let prox = 2 + Math.random() * 6, apag = 0;
    anim.push((dt) => {
      prox -= dt;
      if (prox < 0) { apag = .08 + Math.random() * .25; prox = 2 + Math.random() * 7; }
      apag -= dt;
      const on = apag > 0 ? (Math.random() < .5 ? .25 : 1) : 1;
      caja.material[4].color.setScalar(on); h.material.opacity = .32 * on; ref.material.opacity = .3 * on;
    });
  }
  return caja;
}

// Cartel horizontal de neón con contorno
export function neonTexto(raiz, anim, { x, y, z, texto, color, ancho = 4, alto = 1, fuente = FUENTE, rotY = 0, parpadea = true }) {
  const tex = lienzo(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = `900 ${h * .62}px ${fuente}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26; g.lineWidth = 6; g.strokeStyle = color; g.strokeText(texto, w / 2, h / 2 + 4);
    g.shadowBlur = 10; g.fillStyle = '#ffffff'; g.fillText(texto, w / 2, h / 2 + 4);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; raiz.add(m);
  const h = halo(color, ancho * 1.1, .2); h.position.set(x, y, z - .05); h.scale.y = alto * 2.4; raiz.add(h);
  if (parpadea) {
    let prox = 3 + Math.random() * 8, apag = 0;
    anim.push((dt) => {
      prox -= dt;
      if (prox < 0) { apag = .5 + Math.random() * .6; prox = 4 + Math.random() * 8; }
      apag -= dt;
      const on = apag > 0 ? (Math.sin(apag * 60) > 0 ? .15 : 1) : 1;
      m.material.opacity = on; h.material.opacity = .2 * on;
    });
  }
  return m;
}

// Faroles chinos colgando de un cable (curva de catenaria) que se mecen con el viento
export function hileraFaroles(raiz, anim, { x0, x1, y, z, comba = .8, cada = 1.15, color = '#ff2a2a', fase = 0 }) {
  const n = Math.floor((x1 - x0) / cada);
  const pts = [];
  for (let i = 0; i <= 40; i++) { const k = i / 40; pts.push(new THREE.Vector3(x0 + (x1 - x0) * k, y - Math.sin(k * Math.PI) * comba, z)); }
  raiz.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#0d0b0e' })));
  const cuerpoGeo = new THREE.SphereGeometry(.24, 16, 12), tapaGeo = new THREE.CylinderGeometry(.13, .15, .07, 12), borlaGeo = new THREE.CylinderGeometry(.015, .04, .22, 6);
  const cuerpoMat = emis(color, 1.5), tapaMat = mat('#d6a447', { metalness: .7, roughness: .35 }), borlaMat = mat('#ffcf4a');
  const faroles = [];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const g = new THREE.Group();
    g.position.set(x0 + (x1 - x0) * k, y - Math.sin(k * Math.PI) * comba, z);
    const c = new THREE.Mesh(cuerpoGeo, cuerpoMat); c.scale.y = 1.15; c.position.y = -.32;
    const t1 = new THREE.Mesh(tapaGeo, tapaMat); t1.position.y = -.05;
    const t2 = new THREE.Mesh(tapaGeo, tapaMat); t2.position.y = -.6;
    const b = new THREE.Mesh(borlaGeo, borlaMat); b.position.y = -.76;
    const h = halo(color, 1.1, .45); h.position.y = -.32;
    g.add(c, t1, t2, b, h);
    raiz.add(g); faroles.push(g);
  }
  anim.push((dt, t) => faroles.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.3 + i * .7 + fase) * .09; f.rotation.x = Math.sin(t * .9 + i) * .05; }));
  return faroles;
}

// Pétalos de sakura cayendo: muchas instancias que flotan con el viento y se dan vuelta
export function petalos(raiz, anim, { n = 520, area = [-16, 16, -9, 4], alto = 10, color = '#ffb7d0' } = {}) {
  const forma = new THREE.Shape();
  forma.moveTo(0, -.045); forma.bezierCurveTo(.05, -.02, .045, .04, 0, .045); forma.bezierCurveTo(-.045, .04, -.05, -.02, 0, -.045);
  const geo = new THREE.ShapeGeometry(forma, 4);
  const m = new THREE.MeshStandardMaterial({ color, emissive: '#ff6fa0', emissiveIntensity: .35, side: THREE.DoubleSide, roughness: .6 });
  const inst = new THREE.InstancedMesh(geo, m, n);
  inst.frustumCulled = false;
  const datos = [];
  const [xa, xb, za, zb] = area;
  for (let i = 0; i < n; i++) datos.push({ x: xa + Math.random() * (xb - xa), y: Math.random() * alto, z: za + Math.random() * (zb - za), vy: .35 + Math.random() * .45, fase: Math.random() * 6, giro: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), ang: Math.random() * 6, vg: 1.5 + Math.random() * 3, s: .7 + Math.random() * .7, suelo: 0 });
  const o = new THREE.Object3D();
  raiz.add(inst);
  let viento = 0;
  anim.push((dt, t) => {
    viento = .55 + Math.sin(t * .23) * .4 + Math.sin(t * 1.7) * .15;
    for (let i = 0; i < n; i++) {
      const p = datos[i];
      if (p.suelo > 0) {
        p.suelo -= dt;
        if (p.suelo <= 0) { p.y = alto + Math.random() * 2; p.x = xa + Math.random() * (xb - xa); }
      } else {
        p.y -= p.vy * dt;
        p.x += (viento + Math.sin(t * 1.3 + p.fase) * .35) * dt;
        p.z += Math.cos(t * .9 + p.fase) * .12 * dt;
        p.ang += p.vg * dt;
        if (p.x > xb) p.x = xa;
        if (p.y <= .015) { p.y = .015; p.suelo = 3 + Math.random() * 6; }
      }
      o.position.set(p.x, p.y, p.z);
      if (p.suelo > 0) o.rotation.set(-Math.PI / 2, 0, p.fase); else o.quaternion.setFromAxisAngle(p.giro, p.ang);
      o.scale.setScalar(p.s);
      o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
  return inst;
}

// Cerezo en flor: tronco con ramas y copa de nubes rosas
export function cerezo(raiz, { x, z, alto = 4.2, r }) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const madera = mat('#3b2620', { roughness: 1 });
  const flores = [new THREE.MeshStandardMaterial({ color: '#ffb7d0', emissive: '#ff6fa0', emissiveIntensity: .28, roughness: .9, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#ffd3e2', emissive: '#ff8ab4', emissiveIntensity: .25, roughness: .9, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#f792b5', emissive: '#d84a80', emissiveIntensity: .3, roughness: .9, flatShading: true })];
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(.13, .24, alto * .55, 8), madera);
  tronco.position.y = alto * .27; tronco.rotation.z = (r() - .5) * .15; tronco.castShadow = true; g.add(tronco);
  const copa = [];
  for (let i = 0; i < 5; i++) {
    const rama = new THREE.Mesh(new THREE.CylinderGeometry(.04, .09, alto * .45, 6), madera);
    const a = (i / 5) * Math.PI * 2 + r();
    rama.position.set(Math.cos(a) * .35, alto * .62, Math.sin(a) * .2);
    rama.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .8);
    g.add(rama);
    copa.push(new THREE.Vector3(Math.cos(a) * 1.05, alto * .8 + r() * .4, Math.sin(a) * .5));
  }
  copa.push(new THREE.Vector3(0, alto * .95, 0));
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (const c of copa) for (let k = 0; k < 5; k++) {
    const s = .45 + r() * .5;
    const b = new THREE.Mesh(geo, flores[Math.floor(r() * 3)]);
    b.scale.set(s * 1.2, s * .8, s);
    b.position.set(c.x + (r() - .5) * .9, c.y + (r() - .5) * .5, c.z + (r() - .5) * .6);
    b.castShadow = true; g.add(b);
  }
  // pétalos caídos alrededor (alfombra rosa)
  const alfombra = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), new THREE.MeshBasicMaterial({ map: texturaMancha(), color: '#ff9cc0', transparent: true, opacity: .45, depthWrite: false }));
  alfombra.rotation.x = -Math.PI / 2; alfombra.position.y = .015; alfombra.scale.y = 1.6; g.add(alfombra);
  raiz.add(g);
  return g;
}

// Gente mirando la pelea: siluetas con ropa de colores que saltan y levantan los brazos con los golpes fuertes
export function publico(raiz, anim, { lugares, r, celulares = false }) {
  const gente = [];
  const piel = ['#e8c4a8', '#c99a7a', '#8d5a3c', '#f0d2b8', '#b47a55'];
  const ropa = ['#2a3a6a', '#7a2a3a', '#2a5a3a', '#3a2a5a', '#5a4a2a', '#1a1a22', '#6a6a72', '#a83a2a', '#d8a838', '#2a7a8a'];
  const cuerpoGeo = new THREE.CapsuleGeometry(.2, .55, 4, 10), cabezaGeo = new THREE.SphereGeometry(.15, 12, 10), brazoGeo = new THREE.CapsuleGeometry(.055, .42, 3, 6), piernaGeo = new THREE.CapsuleGeometry(.07, .5, 3, 6);
  for (const [x, z] of lugares) {
    const g = new THREE.Group();
    const s = .88 + r() * .2;
    g.scale.setScalar(s);
    const cm = mat(ropa[Math.floor(r() * ropa.length)]), pm = mat(piel[Math.floor(r() * piel.length)]), jm = mat(['#1d2230', '#2a2a2a', '#3a4a6a'][Math.floor(r() * 3)]);
    const cuerpo = new THREE.Mesh(cuerpoGeo, cm); cuerpo.position.y = 1.08;
    const cabeza = new THREE.Mesh(cabezaGeo, pm); cabeza.position.y = 1.62;
    const pelo = new THREE.Mesh(new THREE.SphereGeometry(.155, 10, 6, 0, Math.PI * 2, 0, Math.PI * .55), mat(['#1a120c', '#3b2a1e', '#c89a5a', '#0a0a0a'][Math.floor(r() * 4)])); pelo.position.y = 1.64;
    const pi = new THREE.Mesh(piernaGeo, jm); pi.position.set(-.09, .4, 0);
    const pd = new THREE.Mesh(piernaGeo, jm); pd.position.set(.09, .4, 0);
    const bi = new THREE.Group(), bd = new THREE.Group();
    bi.position.set(-.26, 1.32, 0); bd.position.set(.26, 1.32, 0);
    const bim = new THREE.Mesh(brazoGeo, cm); bim.position.y = -.24; bi.add(bim);
    const bdm = new THREE.Mesh(brazoGeo, cm); bdm.position.y = -.24; bd.add(bdm);
    g.add(cuerpo, cabeza, pelo, pi, pd, bi, bd);
    let cel = null;
    if (celulares && r() < .45) {
      cel = new THREE.Mesh(new THREE.BoxGeometry(.07, .13, .015), new THREE.MeshBasicMaterial({ color: '#cfe8ff' }));
      cel.position.set(0, -.5, .06); bd.add(cel);
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-x * .25, 6 - z) * .8;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    raiz.add(g);
    gente.push({ g, bi, bd, fase: r() * 6, salto: 0, vel: .8 + r() * 1.2, cel, ganas: 0 });
  }
  let entusiasmo = 0;
  anim.push((dt, t) => {
    entusiasmo = Math.max(0, entusiasmo - dt * .5);
    for (const p of gente) {
      const e = Math.min(1, entusiasmo + p.ganas);
      p.ganas = Math.max(0, p.ganas - dt);
      const bote = Math.abs(Math.sin(t * (3 + e * 6) * p.vel + p.fase)) * (.03 + e * .22);
      p.g.position.y = bote;
      const arriba = e > .3 ? -2.6 - Math.sin(t * 9 + p.fase) * .4 : -.15 - Math.sin(t * 2 + p.fase) * .1;
      p.bd.rotation.z = arriba * (p.cel ? 1 : .9) * -1 * (p.cel ? .55 : 1);
      p.bi.rotation.z = -arriba * (e > .5 ? 1 : .2);
      if (p.cel) { p.bd.rotation.z = 2.4; p.bd.rotation.x = -.3; p.cel.material.color.setHSL(.58, .6, .75 + Math.sin(t * 7 + p.fase) * .1); }
    }
  });
  return {
    vitorear(fuerza = 1) {
      entusiasmo = Math.min(1, entusiasmo + fuerza * .45);
      for (const p of gente) if (Math.random() < .5 * fuerza) p.ganas = 1;
    },
    gente,
  };
}

// Vapor que sale de una alcantarilla
export function vapor(raiz, part, anim, x, z) {
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .03, 24), mat('#2a2a2e', { metalness: .8, roughness: .5 }));
  tapa.position.set(x, .015, z); raiz.add(tapa);
  let acum = 0;
  anim.push((dt) => {
    acum += dt;
    while (acum > .07) { acum -= .07; part.emitir({ x: x + (Math.random() - .5) * .5, y: .1, z: z + (Math.random() - .5) * .3, vx: .15 + Math.random() * .2, vy: .6 + Math.random() * .5, color: '#c8c4d8', tam: .7, vida: 2.6, crece: 1.8, aditivo: false, opacidad: .16 }); }
  });
}

// Lluvia: gotas estiradas que caen en diagonal y salpican en el piso
export function lluvia(raiz, part, anim, { n = 1400, area = [-16, 16, -9, 5], alto = 11 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 6);
  const datos = [];
  const [xa, xb, za, zb] = area;
  for (let i = 0; i < n; i++) datos.push({ x: xa + Math.random() * (xb - xa), y: Math.random() * alto, z: za + Math.random() * (zb - za), v: 14 + Math.random() * 6 });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lineas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#a8c4ff', transparent: true, opacity: .35, depthWrite: false }));
  lineas.frustumCulled = false; raiz.add(lineas);
  anim.push((dt) => {
    for (let i = 0; i < n; i++) {
      const d = datos[i];
      d.y -= d.v * dt; d.x -= d.v * dt * .12;
      if (d.y < 0) {
        if (Math.random() < .08 && d.z > -5) part.emitir({ x: d.x, y: .03, z: d.z, vx: (Math.random() - .5), vy: 1.2, color: '#cfe0ff', tam: .06, vida: .2, g: 9, aditivo: true, opacidad: .7 });
        d.y = alto; d.x = xa + Math.random() * (xb - xa);
      }
      if (d.x < xa) d.x = xb;
      pos.set([d.x, d.y, d.z, d.x + .05, d.y + .38, d.z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  });
}

// Tacho de basura con fuego adentro (luz naranja que titila)
function tachoFuego(raiz, part, anim, x, z) {
  const tacho = new THREE.Mesh(new THREE.CylinderGeometry(.34, .3, .95, 14, 1, true), mat('#4a3a2c', { metalness: .6, roughness: .6, side: THREE.DoubleSide }));
  tacho.position.set(x, .48, z); tacho.castShadow = true; raiz.add(tacho);
  for (const y of [.2, .75]) { const a = new THREE.Mesh(new THREE.TorusGeometry(.33, .02, 6, 20), mat('#2a2018', { metalness: .7 })); a.rotation.x = Math.PI / 2; a.position.set(x, y, z); raiz.add(a); }
  const luz = new THREE.PointLight('#ff7a2a', 9, 9, 1.6); luz.position.set(x, 1.4, z + .3); raiz.add(luz);
  const h = halo('#ff8a3a', 2.2, .55); h.position.set(x, 1.2, z); raiz.add(h);
  raiz.add(reflejo('#ff7a2a', x, z + 1.8, 1.4, 3.4, .4));
  let acum = 0;
  anim.push((dt, t) => {
    luz.intensity = 8 + Math.sin(t * 19) * 1.2 + Math.sin(t * 7.1) * 1.4;
    acum += dt;
    while (acum > .025) {
      acum -= .025;
      part.emitir({ x: x + (Math.random() - .5) * .4, y: .95, z, vx: (Math.random() - .5) * .3, vy: 1.4 + Math.random(), color: Math.random() < .5 ? '#ffcf4a' : '#ff5a1a', tam: .38, vida: .5, crece: -.5 });
      if (Math.random() < .08) part.emitir({ x, y: 1.4, z, vx: (Math.random() - .5) * .8, vy: 2.5, color: '#ffd27a', tam: .05, vida: 1.4, g: -.3 });
    }
  });
}

// Pantalla gigante con texto que pasa (como las de las avenidas)
function pantalla(raiz, anim, { x, y, z, w, h, textos, colores }) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z); raiz.add(m);
  const marco = new THREE.Mesh(new THREE.BoxGeometry(w + .2, h + .2, .15), mat('#101014', { metalness: .6 })); marco.position.set(x, y, z - .09); raiz.add(marco);
  const hl = halo(colores[0], Math.max(w, h) * 1.3, .2); hl.position.set(x, y, z + .1); raiz.add(hl);
  let t0 = 0, i = 0, acum = 0;
  anim.push((dt, t) => {
    acum += dt; if (acum < 1 / 20) return; acum = 0;
    t0 += 1 / 20;
    if (t0 > 4) { t0 = 0; i = (i + 1) % textos.length; }
    const W = c.width, H = c.height, col = colores[i % colores.length];
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#08060c'); gr.addColorStop(1, col + '55');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // rayas que pasan
    g.fillStyle = col + '33';
    for (let k = 0; k < 6; k++) g.fillRect(((t * 140 + k * 120) % (W + 200)) - 100, 0, 30, H);
    g.font = `900 italic ${H * .42}px ${FUENTE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const entra = Math.min(1, t0 * 3);
    g.save(); g.translate(W / 2 + (1 - entra) * W, H / 2); g.scale(1 + Math.sin(t * 6) * .02, 1);
    g.shadowColor = col; g.shadowBlur = 20; g.fillStyle = '#ffffff'; g.fillText(textos[i], 0, 0); g.restore();
    // puntitos de pantalla LED
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let yy = 0; yy < H; yy += 4) g.fillRect(0, yy, W, 1);
    tex.needsUpdate = true;
    hl.material.color.set(col);
  });
}

// Autos que pasan por la calle de atrás (luces delanteras y traseras)
function transito(raiz, anim, { z, y = 0 }) {
  const autos = [];
  const colores = ['#c23a3a', '#2a4a8a', '#e8e4dc', '#2a2a30', '#d8a838', '#3a7a5a'];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const c = mat(colores[i % colores.length], { metalness: .6, roughness: .35 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, .5, 1.1), c); base.position.y = .45;
    const techo = new THREE.Mesh(new THREE.BoxGeometry(1.3, .42, 1), mat('#121620', { metalness: .9, roughness: .1 })); techo.position.set(-.1, .9, 0);
    g.add(base, techo);
    for (const [px, pz] of [[-.8, .5], [.8, .5], [-.8, -.5], [.8, -.5]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .16, 12), mat('#0a0a0a')); r.rotation.x = Math.PI / 2; r.position.set(px, .22, pz); g.add(r); }
    const dir = i % 2 ? 1 : -1;
    const frente = halo('#fff4d8', 1.4, .9), atras = halo('#ff2a2a', .7, .8);
    frente.position.set(1.25 * dir, .5, 0); atras.position.set(-1.25 * dir, .5, 0);
    g.add(frente, atras);
    const zz = z - (dir > 0 ? 0 : 1.8);
    g.position.set((Math.random() - .5) * 40, y, zz);
    raiz.add(g);
    autos.push({ g, dir, v: 6 + Math.random() * 5, espera: Math.random() * 6 });
  }
  anim.push((dt) => {
    for (const a of autos) {
      if (a.espera > 0) { a.espera -= dt; continue; }
      a.g.position.x += a.dir * a.v * dt;
      if (Math.abs(a.g.position.x) > 26) { a.g.position.x = -a.dir * 26; a.espera = 1 + Math.random() * 5; a.v = 6 + Math.random() * 5; }
    }
  });
}

// ---------------------------------------------------------------- los escenarios
export function barrioChino(escena, part) {
  const raiz = new THREE.Group(); escena.add(raiz);
  const anim = [];
  const r = rng(21);
  escena.background = cieloCiudad('#090614', '#2a0f2e', '#6a1f3a', 120);
  escena.fog = new THREE.Fog('#3a1230', 16, 46);
  raiz.add(calle({ tipo: 'adoquin', reflejos: ['#ff2a3a', '#ffb02a', '#ff6fa0'], seed: 8 }));
  // vereda y cordón
  const vereda = new THREE.Mesh(new THREE.BoxGeometry(60, .18, 3.4), mat('#5a525a', { roughness: .7 })); vereda.position.set(0, .09, -6.6); vereda.receiveShadow = true; raiz.add(vereda);
  const cordon = new THREE.Mesh(new THREE.BoxGeometry(60, .2, .18), mat('#8a8288')); cordon.position.set(0, .1, -4.9); raiz.add(cordon);
  // edificios del barrio, de los dos lados del arco
  const letreros = ['麵館', '茶', '福來', '龍', '餃子', '中華', '飯店', '書'];
  const colores = ['#6a2a2a', '#3a2a3a', '#5a3a2a', '#2a3a3a', '#6a4a2a', '#4a2a3a'];
  let x = -28;
  let k = 0;
  while (x < 28) {
    const w = 3.6 + r() * 2.4;
    if (Math.abs(x + w / 2) < 3.4) { x += 7; continue; } // hueco para el arco del medio
    edificio(raiz, { x: x + w / 2, z: -8.3, w, h: 6 + r() * 7, color: colores[k % colores.length], r, toldo: ['#c22a2a', '#2a8a4a', '#d8a838'][k % 3], letrero: letreros[k % letreros.length], letreroColor: ['#ffd27a', '#ff6a6a', '#7affc8'][k % 3], cjk: true });
    if (r() < .75) neonVertical(raiz, anim, { x: x + w * (r() < .5 ? .15 : .85), y: 4.6 + r() * 1.5, z: -7.9, texto: ['大吉', '拉麵', '茶館', '按摩', '酒', '福'][k % 6], color: ['#ff3b5c', '#ffcf4a', '#3ae0ff', '#c084fc', '#7affc8'][k % 5], parpadea: r() < .35 });
    x += w + .05; k++;
  }
  // el arco (paifang) en el fondo, sobre la calle que cruza
  const rojo = new THREE.MeshStandardMaterial({ color: '#b01e1e', roughness: .55, emissive: '#3a0505', emissiveIntensity: .5 });
  const verde = new THREE.MeshStandardMaterial({ color: '#1f6a4a', roughness: .5 });
  const oro = new THREE.MeshStandardMaterial({ color: '#d8a838', metalness: .8, roughness: .3 });
  const arco = new THREE.Group(); arco.position.set(0, 0, -11.5); raiz.add(arco);
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, 7.2, 14), rojo); col.position.set(s * 2.8, 3.6, 0); col.castShadow = true; arco.add(col);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.9, .6, .9), mat('#6a6268')); base.position.set(s * 2.8, .3, 0); arco.add(base);
    const chica = new THREE.Mesh(new THREE.CylinderGeometry(.2, .24, 5, 12), rojo); chica.position.set(s * 4.6, 2.5, 0); arco.add(chica);
  }
  for (const [y, w2] of [[5.6, 6.4], [6.6, 6.2]]) { const v = new THREE.Mesh(new THREE.BoxGeometry(w2, .35, .45), rojo); v.position.y = y; arco.add(v); }
  // techo con aleros curvados
  const techo = new THREE.Mesh(new THREE.BoxGeometry(7.8, .3, 1.5), verde); techo.position.y = 7.45; arco.add(techo);
  const techo2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, .5, 1.2), verde); techo2.position.y = 7.8; arco.add(techo2);
  for (const s of [-1, 1]) {
    const punta = new THREE.Mesh(new THREE.ConeGeometry(.16, .9, 6), verde); punta.position.set(s * 3.95, 7.75, 0); punta.rotation.z = -s * .9; arco.add(punta);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, .22, 1.1), verde); t2.position.set(s * 4.6, 5.15, 0); arco.add(t2);
    const p2 = new THREE.Mesh(new THREE.ConeGeometry(.12, .7, 6), verde); p2.position.set(s * 5.85, 5.4, 0); p2.rotation.z = -s * .9; arco.add(p2);
  }
  const placa = lienzo(256, 96, (g, w, h) => {
    g.fillStyle = '#1a1208'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8a838'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffd27a'; g.font = `900 46px ${CJK}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ffb02a'; g.shadowBlur = 12;
    g.fillText('中華街', w / 2, h / 2);
  });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .82), new THREE.MeshBasicMaterial({ map: placa })); pl.position.set(0, 6.1, .24); arco.add(pl);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), oro); b.position.set(s * 2.8, 7.25, .3); arco.add(b); }
  // la calle del otro lado del arco, iluminada
  const fondoCalle = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 7), new THREE.MeshBasicMaterial({ map: lienzo(128, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a0f2e'); gr.addColorStop(.6, '#ff6a4a'); gr.addColorStop(1, '#ffcf8a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { g.fillStyle = ['#ff2a3a', '#ffcf4a'][i % 2]; g.beginPath(); g.arc(r() * w, 20 + r() * 50, 3, 0, 7); g.fill(); } }), fog: true }));
  fondoCalle.position.set(0, 3.5, -16); raiz.add(fondoCalle);
  // faroles cruzando la calle
  hileraFaroles(raiz, anim, { x0: -16, x1: 16, y: 6.4, z: -2.4, comba: 1.1, cada: 1.25 });
  hileraFaroles(raiz, anim, { x0: -16, x1: 16, y: 6.9, z: -5.2, comba: .8, cada: 1.1, fase: 2 });
  hileraFaroles(raiz, anim, { x0: -3, x1: 3, y: 5.2, z: -11.3, comba: .3, cada: .75, color: '#ffcf4a', fase: 4 });
  // luces cálidas de los faroles sobre la pelea
  for (const [lx, c] of [[-5, '#ff3a2a'], [0, '#ff6a3a'], [5, '#ff3a2a']]) { const l = new THREE.PointLight(c, 7, 12, 1.4); l.position.set(lx, 5, -2); raiz.add(l); }
  for (let i = -3; i <= 3; i++) raiz.add(reflejo('#ff3a2a', i * 4.2, -1.2, 1.2, 4.5, .22));
  // cerezos en la vereda
  for (const [cx, cz] of [[-9.5, -6.6], [8.8, -6.8], [-17, -6.4], [16.5, -6.5]]) cerezo(raiz, { x: cx, z: cz, r });
  petalos(raiz, anim, { n: 600 });
  // puesto de comida con sombrilla
  const puesto = new THREE.Group(); puesto.position.set(-5.6, 0, -6.4); raiz.add(puesto);
  const mostrador = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, .8), mat('#7a3a1a')); mostrador.position.y = .5; mostrador.castShadow = true; puesto.add(mostrador);
  const olla = new THREE.Mesh(new THREE.CylinderGeometry(.24, .2, .3, 14), mat('#9a9aa2', { metalness: .9, roughness: .3 })); olla.position.set(-.4, 1.15, 0); puesto.add(olla);
  const somb = new THREE.Mesh(new THREE.ConeGeometry(1.4, .5, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#d8302a', side: THREE.DoubleSide, roughness: .7 })); somb.position.y = 2.3; puesto.add(somb);
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.4, 6), mat('#2a2a2a')); palo.position.y = 1.65; puesto.add(palo);
  const fp = new THREE.PointLight('#ffb36a', 3, 4, 1.6); fp.position.set(-5.6, 1.9, -6); raiz.add(fp);
  let acumP = 0;
  anim.push((dt) => { acumP += dt; while (acumP > .1) { acumP -= .1; part.emitir({ x: -6, y: 1.35, z: -6.4, vx: .2, vy: .5, color: '#ddd', tam: .3, vida: 1.6, crece: 1.5, aditivo: false, opacidad: .18 }); } });
  // cajones apilados y una máquina expendedora prendida
  const cajon = mat('#6a4a2a');
  for (const [cx, cy, cz] of [[6.4, .3, -6.2], [7, .3, -6.3], [6.7, .9, -6.25], [-12, .3, -6.1]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .6), cajon); c.position.set(cx, cy, cz); c.rotation.y = r() * .4; c.castShadow = true; raiz.add(c); }
  const exp = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.8, .7), [mat('#c22a2a'), mat('#c22a2a'), mat('#c22a2a'), mat('#c22a2a'), new THREE.MeshBasicMaterial({ map: lienzo(64, 128, (g, w, h) => { g.fillStyle = '#c22a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8f6ff'; g.fillRect(6, 8, w - 12, h * .55); for (let i = 0; i < 12; i++) { g.fillStyle = ['#ff4a4a', '#4ab8ff', '#ffd24a', '#5ae07a'][i % 4]; g.fillRect(10 + (i % 4) * 12, 14 + Math.floor(i / 4) * 22, 8, 16); } }) }), mat('#c22a2a')]);
  exp.position.set(11.6, .9, -6.2); raiz.add(exp);
  raiz.add(reflejo('#cfeaff', 11.6, -4.6, .9, 2.4, .3));
  vapor(raiz, part, anim, 3.4, -3.2);
  vapor(raiz, part, anim, -10.5, -1.6);
  // público en la vereda
  const lugares = [];
  for (let i = 0; i < 16; i++) { const px = -14 + i * 1.8 + (r() - .5) * .6; if (Math.abs(px + 5.6) < 1.2 || Math.abs(px - 11.6) < .8) continue; lugares.push([px, -5.6 - r() * 1.2]); }
  const p = publico(raiz, anim, { lugares, r });
  return { raiz, anim, vitorear: p.vitorear, luzAmbiente: ['#c8a8ff', '#2a0f1e', 1.25], luzClave: ['#ffd8e8', 1.4], luzBorde: '#ff4a8a', exposicion: 1.1 };
}

export function callejon(escena, part) {
  const raiz = new THREE.Group(); escena.add(raiz);
  const anim = [];
  const r = rng(33);
  escena.background = cieloCiudad('#05060c', '#141a2a', '#2a2a3a', 0);
  escena.fog = new THREE.Fog('#141824', 10, 34);
  raiz.add(calle({ tipo: 'asfalto', marcas: false, reflejos: ['#ff3b8b', '#3ae0ff', '#ff7a2a'], seed: 12 }));
  // pared de ladrillos con grafitis del club
  const ladrillos = lienzo(2048, 512, (g, w, h) => {
    g.fillStyle = '#4a2a24'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -18 : 0; x < w; x += 36) {
      const k = r();
      g.fillStyle = `rgb(${100 + k * 50},${45 + k * 25},${38 + k * 20})`;
      g.fillRect(x + 1, y + 1, 34, 14);
    }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * .2})`; g.fillRect(r() * w, r() * h, 3, 3); }
    // manchas de humedad
    for (let i = 0; i < 10; i++) { const x = r() * w; const gr = g.createLinearGradient(0, h * .4, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(x, h * .3, 40 + r() * 80, h); }
    // grafitis
    const grafiti = (texto, x, y, tam, c1, c2, rot = 0) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.font = `900 italic ${tam}px ${FUENTE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = tam * .2; g.strokeStyle = '#0a0a0a'; g.strokeText(texto, 0, 0);
      g.lineWidth = tam * .1; g.strokeStyle = '#ffffff'; g.strokeText(texto, 0, 0);
      const gr = g.createLinearGradient(0, -tam / 2, 0, tam / 2); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.fillText(texto, 0, 0);
      // chorreado
      g.fillStyle = c2;
      for (let i = 0; i < 6; i++) { const dx = (r() - .5) * tam * texto.length * .45; g.fillRect(dx, tam * .3, 3, 10 + r() * tam * .5); }
      g.restore();
    };
    grafiti('PIÑA FINAL', 420, 260, 150, '#ffe14a', '#ff4a1a', -.06);
    grafiti('cadalado', 1180, 200, 120, '#c5f04a', '#2ab86a', .05);
    grafiti('QUEQUE', 1680, 300, 110, '#ff8ad8', '#a83af0', -.08);
    grafiti('MXD', 900, 400, 80, '#6ad8ff', '#2a5af0', .1);
    for (let i = 0; i < 14; i++) { g.strokeStyle = ['#fff', '#ff4fa3', '#c5f04a', '#6ad8ff'][i % 4]; g.lineWidth = 4; g.beginPath(); let x = r() * w, y = 330 + r() * 150; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += 10 + r() * 20; y += (r() - .5) * 30; g.lineTo(x, y); } g.stroke(); }
  });
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(44, 11), new THREE.MeshStandardMaterial({ map: ladrillos, roughness: .95 }));
  pared.position.set(0, 5.5, -7.5); pared.receiveShadow = true; raiz.add(pared);
  // escalera de incendio
  const fierro = mat('#1c1c22', { metalness: .8, roughness: .5 });
  for (const y of [3.6, 6.4]) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(4, .08, 1.1), fierro); plat.position.set(-7, y, -6.9); plat.castShadow = true; raiz.add(plat);
    for (let i = 0; i <= 16; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.03, .9, .03), fierro); b.position.set(-9 + i * .25, y + .45, -6.35); raiz.add(b); }
    const pasa = new THREE.Mesh(new THREE.BoxGeometry(4, .04, .04), fierro); pasa.position.set(-7, y + .9, -6.35); raiz.add(pasa);
  }
  const esc = new THREE.Mesh(new THREE.BoxGeometry(.5, 3.2, .05), fierro); esc.position.set(-5.2, 4.95, -6.5); esc.rotation.z = .65; raiz.add(esc);
  // ventana con luz y una persona mirando
  const vent = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshBasicMaterial({ map: lienzo(64, 80, (g, w, h) => { g.fillStyle = '#ffcf8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(w * .6, h * .5, 10, 12, 0, 0, 7); g.fill(); g.fillRect(w * .45, h * .62, 20, 40); g.fillStyle = '#2a1a14'; g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h / 2 - 2, w, 4); }) }));
  vent.position.set(4.5, 5.4, -7.45); raiz.add(vent);
  raiz.add(reflejo('#ffcf8a', 4.5, -5, 1.2, 3, .25));
  // contenedor de basura
  const cont = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), mat('#2a5a3a', { metalness: .4, roughness: .6 })); cont.position.set(7.5, .65, -6.6); cont.castShadow = true; raiz.add(cont);
  const tapa = new THREE.Mesh(new THREE.BoxGeometry(2.3, .1, 1.2), mat('#1e4a2e')); tapa.position.set(7.5, 1.4, -6.8); tapa.rotation.x = -.5; raiz.add(tapa);
  for (const [bx, bz] of [[9.2, -6.4], [9.7, -6], [5.8, -6.2]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.35, 10, 8), mat('#0e0e12', { roughness: .3 })); b.scale.y = .8; b.position.set(bx, .28, bz); raiz.add(b); }
  tachoFuego(raiz, part, anim, -3.2, -6.3);
  tachoFuego(raiz, part, anim, 13, -6);
  // cartel de neón "BAR" con flecha
  neonTexto(raiz, anim, { x: 1, y: 4.2, z: -7.4, texto: 'BAR EL OLCHO', color: '#ff3b8b', ancho: 4.6, alto: 1.1 });
  neonTexto(raiz, anim, { x: 1, y: 3.2, z: -7.4, texto: '→ abierto', color: '#3ae0ff', ancho: 2.4, alto: .7 });
  raiz.add(reflejo('#ff3b8b', 1, -4.4, 3, 4, .35));
  raiz.add(reflejo('#3ae0ff', 1, -3.8, 1.6, 3, .25));
  // lamparita colgando que se balancea (luz principal del callejón)
  const lamp = new THREE.Group(); lamp.position.set(-.5, 7, -3); raiz.add(lamp);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 1.6, 4), mat('#111')); cable.position.y = -.8; lamp.add(cable);
  const pantallaL = new THREE.Mesh(new THREE.ConeGeometry(.35, .3, 16, 1, true), mat('#3a4a3a', { side: THREE.DoubleSide, metalness: .6 })); pantallaL.position.y = -1.65; lamp.add(pantallaL);
  const foco = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff3c8' })); foco.position.y = -1.78; lamp.add(foco);
  const hfoco = halo('#ffe8a8', 1.3, .6); hfoco.position.y = -1.78; lamp.add(hfoco);
  const spot = new THREE.SpotLight('#ffe8b8', 60, 14, .75, .5, 1.3); spot.position.y = -1.7; spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); lamp.add(spot);
  const objetivo = new THREE.Object3D(); objetivo.position.set(-.5, 0, -1.5); raiz.add(objetivo); spot.target = objetivo;
  let rayo = 0, prox = 6 + Math.random() * 8;
  const cielo = new THREE.HemisphereLight('#c8d8ff', '#000000', 0); raiz.add(cielo);
  anim.push((dt, t) => {
    lamp.rotation.z = Math.sin(t * 1.4) * .08; lamp.rotation.x = Math.sin(t * 1.1) * .05;
    const titila = Math.random() < .015 ? .2 : 1;
    spot.intensity = 60 * titila; foco.material.color.setScalar(titila); hfoco.material.opacity = .6 * titila;
    // relámpagos
    prox -= dt;
    if (prox < 0) { rayo = .35; prox = 8 + Math.random() * 12; trueno(); }
    rayo = Math.max(0, rayo - dt);
    cielo.intensity = rayo > 0 ? (Math.sin(rayo * 60) > 0 ? 3.2 : .6) : 0;
  });
  lluvia(raiz, part, anim);
  vapor(raiz, part, anim, 10.5, -3);
  // reja con gente mirando del otro lado
  const reja = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshStandardMaterial({ map: lienzo(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#9aa2aa'; g.lineWidth = 1.5; for (let i = -h; i < w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }), transparent: true, alphaTest: .3, side: THREE.DoubleSide, metalness: .7 }));
  reja.position.set(-13.5, 1.3, -5.2); raiz.add(reja);
  const p = publico(raiz, anim, { lugares: [[-17, -6.4], [-15.6, -6.2], [-14.2, -6.6], [-12.6, -6.3], [-11, -6.5], [-9.8, -6.1], [2.8, -6.6], [4.6, -6.4], [11.5, -6.6]], r, celulares: true });
  return { raiz, anim, vitorear: p.vitorear, luzAmbiente: ['#6a7aa8', '#120c10', .9], luzClave: ['#a8b8ff', .55], luzBorde: '#ff3b8b', exposicion: 1.15 };
}

export function avenida(escena, part) {
  const raiz = new THREE.Group(); escena.add(raiz);
  const anim = [];
  const r = rng(47);
  escena.background = cieloCiudad('#04030a', '#1a0f3a', '#5a1a6a', 40);
  escena.fog = new THREE.Fog('#1a1238', 18, 56);
  const piso = calle({ tipo: 'asfalto', reflejos: ['#3ae0ff', '#ff3b8b', '#c5f04a', '#ffb02a'], seed: 5 });
  raiz.add(piso);
  // senda peatonal (rayas blancas) donde se pelea
  const cebra = new THREE.Group(); raiz.add(cebra);
  for (let i = -9; i <= 9; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(.55, 3.6), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .4 })); s.rotation.x = -Math.PI / 2; s.position.set(i * 1.05, .013, -.6); s.receiveShadow = true; cebra.add(s); }
  // edificios altos con pantallas gigantes
  const colores = ['#1a1a2a', '#22202e', '#1a2230', '#2a1a2a'];
  let x = -34, k = 0;
  while (x < 34) {
    const w = 5 + r() * 4, h = 12 + r() * 16;
    edificio(raiz, { x: x + w / 2, z: -14, w, h, d: 5, color: colores[k % 4], r, local: true, toldo: null, letrero: ['KIOSCO', 'PIZZA', 'FARMACIA', 'BAR', 'ROTISERÍA', 'CAFÉ'][k % 6], letreroColor: ['#3ae0ff', '#ffcf4a', '#7affc8', '#ff3b8b'][k % 4] });
    x += w + .3; k++;
  }
  pantalla(raiz, anim, { x: -7, y: 9, z: -13.8, w: 7, h: 3.6, textos: ['PIÑA FINAL', '¡HOY PELEA!', 'cadalado.com', '¡DALE MXD!'], colores: ['#ff3b5c', '#3ae0ff', '#c5f04a', '#ff8ad8'] });
  pantalla(raiz, anim, { x: 8, y: 11, z: -13.8, w: 5, h: 6, textos: ['QUEQUE', 'K.O.', 'VOLCHO\nY OLCHO', 'COMBOS'], colores: ['#ffcf4a', '#ff3b5c', '#7affc8', '#c084fc'] });
  neonTexto(raiz, anim, { x: 0, y: 6.4, z: -13.7, texto: 'cadalado', color: '#c5f04a', ancho: 5, alto: 1.3 });
  // semáforos
  for (const sx of [-9.5, 9.5]) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 4.2, 8), mat('#2a2a30', { metalness: .7 })); poste.position.set(sx, 2.1, -5.4); raiz.add(poste);
    const caja = new THREE.Mesh(new THREE.BoxGeometry(.35, .95, .3), mat('#141418')); caja.position.set(sx, 4, -5.3); raiz.add(caja);
    const luces = ['#ff2a2a', '#ffcf2a', '#2aff6a'].map((c, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: c })); l.position.set(sx, 4.3 - i * .3, -5.14); raiz.add(l); const h = halo(c, .7, .7); h.position.copy(l.position); raiz.add(h); return { l, h, c }; });
    anim.push((dt, t) => { const fase = Math.floor((t / 3) % 3); luces.forEach((o, i) => { const on = (2 - fase) === i; o.l.material.color.set(on ? o.c : '#1a1a1a'); o.h.material.opacity = on ? .7 : 0; }); });
  }
  // farolas de la calle
  for (const fx of [-15, -5, 5, 15]) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 6, 8), mat('#2a2a30', { metalness: .7 })); poste.position.set(fx, 3, -6.6); raiz.add(poste);
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, 1.4), mat('#2a2a30')); brazo.position.set(fx, 5.95, -5.95); raiz.add(brazo);
    const h = halo('#ffd8a8', 2, .55); h.position.set(fx, 5.85, -5.3); raiz.add(h);
    raiz.add(reflejo('#ffd8a8', fx, -3, 1.6, 5, .28));
  }
  const l1 = new THREE.PointLight('#3ae0ff', 8, 16, 1.4); l1.position.set(-7, 6, -9); raiz.add(l1);
  const l2 = new THREE.PointLight('#ff3b8b', 8, 16, 1.4); l2.position.set(8, 7, -9); raiz.add(l2);
  anim.push((dt, t) => { l1.intensity = 7 + Math.sin(t * 2) * 2; l2.intensity = 7 + Math.cos(t * 1.7) * 2; });
  transito(raiz, anim, { z: -10.5 });
  // la ronda de gente alrededor (con celulares filmando y flashes)
  const lugares = [];
  for (let i = 0; i < 22; i++) { const a = Math.PI * (.05 + .9 * i / 21); lugares.push([Math.cos(a) * -11, -3.2 - Math.sin(a) * 3.6 - r() * .6]); }
  const p = publico(raiz, anim, { lugares, r, celulares: true });
  let acum = 0;
  anim.push((dt) => {
    acum += dt;
    if (acum > .35) {
      acum = 0;
      const q = p.gente[Math.floor(Math.random() * p.gente.length)];
      if (q.cel) { const pos = q.cel.getWorldPosition(new THREE.Vector3()); part.emitir({ x: pos.x, y: pos.y, z: pos.z + .05, color: '#ffffff', tam: .6, vida: .12 }); }
    }
  });
  // papelitos volando
  let acumP = 0;
  anim.push((dt) => { acumP += dt; while (acumP > .25) { acumP -= .25; part.emitir({ x: -14 + Math.random() * 28, y: 6 + Math.random() * 2, z: -4 + Math.random() * 4, vx: .4, vy: -.5, color: ['#ff3b8b', '#3ae0ff', '#c5f04a', '#ffcf4a'][Math.floor(Math.random() * 4)], tam: .07, vida: 6, aditivo: false, opacidad: .9 }); } });
  return { raiz, anim, vitorear: p.vitorear, luzAmbiente: ['#9a8aff', '#1a0f20', 1.2], luzClave: ['#e8e0ff', 1.2], luzBorde: '#3ae0ff', exposicion: 1.05 };
}

// trueno sintetizado (para los relámpagos del callejón)
let ctxTrueno = null;
function trueno() {
  try {
    if (localStorage.getItem('cadalado.audio') === 'silencio') return;
    ctxTrueno ??= new (window.AudioContext || window.webkitAudioContext)();
    const a = ctxTrueno; if (a.state !== 'running') return;
    const len = a.sampleRate * 2.5, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) { v = v * .985 + (Math.random() * 2 - 1) * .015; d[i] = v * 6 * Math.pow(1 - i / len, 2); }
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = a.createGain(); g.gain.value = .5;
    s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + .3);
  } catch {}
}
