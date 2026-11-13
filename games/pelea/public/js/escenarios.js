// Escenarios de Piña Final, armados con geometría y texturas dibujadas en el momento.
// Cada uno devuelve una función que se llama en cada cuadro (antorchas, neones, niebla).
import * as THREE from '/comun/vendor/three.module.min.js';
import { halo } from './objetos3d.js';

export const ESCENARIOS = [
  { id: 'templo', nombre: 'El Templo', desc: 'De noche, entre antorchas y un gong gigante.' },
  { id: 'azotea', nombre: 'La Azotea', desc: 'Arriba de un edificio, con la ciudad prendida.' },
  { id: 'volcan', nombre: 'El Volcán', desc: 'Sobre piedra caliente y ríos de lava.' },
];

function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// generador fijo, así cada escenario sale igual siempre
function rng(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function cielo(arriba, abajo, estrellas = 0, luna = null) {
  return lienzo(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, arriba); gr.addColorStop(1, abajo);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < estrellas; i++) { g.fillStyle = `rgba(255,255,255,${.3 + r() * .7})`; g.fillRect(r() * w, r() * h * .6, 1 + r(), 1 + r()); }
    if (luna) {
      const lg = g.createRadialGradient(luna.x, luna.y, 0, luna.x, luna.y, luna.r * 3);
      lg.addColorStop(0, luna.color); lg.addColorStop(.33, luna.color); lg.addColorStop(.36, luna.halo); lg.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
    }
  });
}

function piso(colorA, colorB, juntas, tam = 2, extra = null) {
  const t = lienzo(512, 512, (g, w, h) => {
    const r = rng(3);
    const n = 4;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = r();
      g.fillStyle = k > .5 ? colorA : colorB;
      g.fillRect(x * w / n, y * h / n, w / n, h / n);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${r() * .12})`; g.fillRect(x * w / n + r() * w / n, y * h / n + r() * h / n, 2 + r() * 6, 2 + r() * 6); }
    }
    g.strokeStyle = juntas; g.lineWidth = 5;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / n); g.lineTo(w, i * h / n); g.stroke(); }
    extra?.(g, w, h, r);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40 / (tam * 4), 16 / (tam * 4));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ map: t, roughness: .85 }));
  m.rotation.x = -Math.PI / 2; m.position.z = -3; m.receiveShadow = true;
  return m;
}

// fuego de antorcha (partículas) + luz que titila
function antorcha(escena, part, x, y, z, color = '#ff8a2a') {
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.4, 8), new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 1 }));
  palo.position.set(x, y - .75, z); escena.add(palo);
  const copa = new THREE.Mesh(new THREE.CylinderGeometry(.2, .1, .22, 10), new THREE.MeshStandardMaterial({ color: '#4a3a2a', metalness: .6, roughness: .4 }));
  copa.position.set(x, y, z); escena.add(copa);
  const luz = new THREE.PointLight(color, 6, 7, 1.6); luz.position.set(x, y + .4, z + .3); escena.add(luz);
  const h = halo(color, 1.6, .5); h.position.set(x, y + .3, z); escena.add(h);
  let acum = 0;
  return (dt, t) => {
    luz.intensity = 5 + Math.sin(t * 17 + x) * .8 + Math.sin(t * 7.3 + z) * .7;
    h.material.opacity = .4 + Math.sin(t * 13 + x) * .08;
    acum += dt;
    while (acum > .03) {
      acum -= .03;
      part.emitir({ x: x + (Math.random() - .5) * .15, y: y + .12, z, vx: (Math.random() - .5) * .3, vy: 1.2 + Math.random() * .8, color: Math.random() < .5 ? '#ffcf4a' : color, tam: .28, vida: .45, crece: -.6 });
    }
  };
}

export function construirEscenario(id, escena, part) {
  const raiz = new THREE.Group(); escena.add(raiz);
  const anim = [];
  const add = (o) => { raiz.add(o); return o; };
  if (id === 'azotea') {
    escena.background = cielo('#0a0c26', '#3b1d4a', 160);
    escena.fog = new THREE.Fog('#2a1838', 14, 42);
    add(piso('#5d5e66', '#53545b', '#3b3c42', 2.2, (g, w, h, r) => { for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,220,0,.55)'; g.fillRect(r() * w, r() * h, 60, 8); } }));
    // ciudad: edificios con ventanas prendidas
    const r = rng(11);
    for (let i = 0; i < 26; i++) {
      const w = 1.5 + r() * 2.6, h = 4 + r() * 13, d = 1.5 + r() * 2;
      const tex = lienzo(64, 128, (g, W, H) => {
        g.fillStyle = '#12142a'; g.fillRect(0, 0, W, H);
        for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) if (r() < .45) { g.fillStyle = r() < .2 ? '#7fe8ff' : r() < .5 ? '#ffd27a' : '#ffefc0'; g.fillRect(x, y, 4, 5); }
      });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.round(w / 1.5), Math.round(h / 3));
      const e = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ map: tex, color: '#b9b9d8' })));
      e.position.set(-30 + i * 2.4 + r() * 1.5, h / 2 - 6, -18 - r() * 12);
    }
    // baranda y tanque de agua
    const baranda = new THREE.MeshStandardMaterial({ color: '#2a2b33', metalness: .7, roughness: .4 });
    const barra = add(new THREE.Mesh(new THREE.BoxGeometry(40, .07, .07), baranda)); barra.position.set(0, 1.05, -7.2);
    for (let x = -20; x <= 20; x += 1.4) { const p = add(new THREE.Mesh(new THREE.BoxGeometry(.06, 1.05, .06), baranda)); p.position.set(x, .52, -7.2); }
    const tanque = add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 20), new THREE.MeshStandardMaterial({ color: '#6b4b34', roughness: .9 })));
    tanque.position.set(-9.5, 3.6, -8.5);
    for (const [x, z] of [[-10.4, -9.2], [-8.6, -9.2], [-10.4, -7.8], [-8.6, -7.8]]) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.4, 6), baranda)); p.position.set(x, 1.2, z); }
    // cartel de neón de cadalado
    const neon = lienzo(512, 128, (g, w, h) => {
      g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
      g.font = '900 96px "Barlow Condensed", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff3b8b'; g.shadowBlur = 24; g.fillStyle = '#ffd1e6'; g.fillText('cadalado', w / 2, h / 2 + 4);
    });
    const cartel = add(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: neon, transparent: true, depthWrite: false })));
    cartel.position.set(4, 5.2, -9);
    const luzNeon = add(new THREE.PointLight('#ff3b8b', 10, 12, 1.5)); luzNeon.position.set(4, 4.6, -7.5);
    const marco = add(new THREE.Mesh(new THREE.BoxGeometry(6.6, .08, .08), baranda)); marco.position.set(4, 4.3, -9.05);
    anim.push((dt, t) => { const titila = Math.sin(t * 40) > .97 ? .3 : 1; cartel.material.opacity = titila; luzNeon.intensity = 10 * titila; });
    // luces de la ciudad
    escena.add(raiz);
    return { raiz, anim, luzAmbiente: ['#8fa8ff', '#2a1838', 1.5], luzClave: ['#cfd8ff', 1.6], luzBorde: '#ff3b8b' };
  }
  if (id === 'volcan') {
    escena.background = cielo('#1a0605', '#702010', 60);
    escena.fog = new THREE.Fog('#4a1208', 12, 38);
    add(piso('#2b2321', '#231c1a', '#ff5a1a', 1.8, (g, w, h, r) => {
      g.strokeStyle = 'rgba(255,110,30,.8)'; g.lineWidth = 3;
      for (let i = 0; i < 9; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - .5) * 70; y += (r() - .5) * 70; g.lineTo(x, y); } g.stroke(); }
    }));
    // lava atrás
    const lava = lienzo(256, 256, (g, w, h) => {
      const r = rng(5);
      g.fillStyle = '#ff4d0a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = r() < .5 ? '#ffb42a' : '#b81d04'; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 22, 0, Math.PI * 2); g.fill(); }
    });
    lava.wrapS = lava.wrapT = THREE.RepeatWrapping; lava.repeat.set(6, 2);
    const rio = add(new THREE.Mesh(new THREE.PlaneGeometry(60, 10), new THREE.MeshBasicMaterial({ map: lava })));
    rio.rotation.x = -Math.PI / 2; rio.position.set(0, -.6, -16);
    anim.push((dt) => { lava.offset.x += dt * .03; lava.offset.y += dt * .01; });
    // montañas y volcán
    const roca = new THREE.MeshStandardMaterial({ color: '#2a1714', roughness: 1, flatShading: true });
    const r = rng(9);
    for (let i = 0; i < 9; i++) { const c = add(new THREE.Mesh(new THREE.ConeGeometry(3 + r() * 4, 6 + r() * 8, 7), roca)); c.position.set(-30 + i * 7.5, 2, -24 - r() * 6); }
    const volcan = add(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 11, 16, 9, 1, true), roca)); volcan.position.set(6, 6, -34);
    const boca = add(halo('#ff6a1a', 9, .8)); boca.position.set(6, 14.5, -33);
    const luzLava = add(new THREE.PointLight('#ff5a1a', 30, 30, 1.4)); luzLava.position.set(0, 1.5, -10);
    // rocas con fuego a los costados
    for (const x of [-9, 9]) anim.push(antorcha(raiz, part, x, 1.6, -5.5, '#ff5a1a'));
    let acum = 0;
    anim.push((dt, t) => {
      luzLava.intensity = 26 + Math.sin(t * 2.3) * 5;
      acum += dt;
      while (acum > .05) { acum -= .05; part.emitir({ x: (Math.random() - .5) * 30, y: .1, z: -8 - Math.random() * 6, vy: 1 + Math.random() * 2, vx: (Math.random() - .5) * .5, color: Math.random() < .6 ? '#ff7a1a' : '#ffd14a', tam: .12, vida: 2.2, crece: -.5 }); }
    });
    return { raiz, anim, luzAmbiente: ['#ffb38a', '#3a0d06', 1.3], luzClave: ['#ffd2b0', 1.4], luzBorde: '#ff5a1a' };
  }
  // ---------------- templo (por defecto)
  escena.background = cielo('#070818', '#2a2342', 220, { x: 360, y: 110, r: 34, color: '#fff5dc', halo: 'rgba(255,240,210,.18)' });
  escena.fog = new THREE.Fog('#1b1730', 15, 44);
  add(piso('#6b6258', '#5e564d', '#3d3731', 2, (g, w, h, r) => {
    g.strokeStyle = 'rgba(160,30,30,.55)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w * .32, 0, Math.PI * 2); g.stroke();
  }));
  const piedra = new THREE.MeshStandardMaterial({ color: '#8a7e70', roughness: .95 });
  const rojo = new THREE.MeshStandardMaterial({ color: '#8f1d1d', roughness: .7 });
  // escalones y plataforma del fondo
  for (let i = 0; i < 4; i++) { const e = add(new THREE.Mesh(new THREE.BoxGeometry(40, .25, 1), piedra)); e.position.set(0, .125 + i * .25, -6.2 - i * .9); e.receiveShadow = true; }
  // columnas
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const x = i * 3.6;
    const col = add(new THREE.Mesh(new THREE.CylinderGeometry(.45, .52, 7, 12), rojo)); col.position.set(x, 4.5, -9.6); col.castShadow = true;
    const base = add(new THREE.Mesh(new THREE.BoxGeometry(1.3, .5, 1.3), piedra)); base.position.set(x, 1.15, -9.6);
  }
  // techo: dos vigas y el alero
  const viga = add(new THREE.Mesh(new THREE.BoxGeometry(28, .6, 1.4), rojo)); viga.position.set(0, 8.1, -9.6);
  const alero = add(new THREE.Mesh(new THREE.BoxGeometry(31, .35, 3.2), new THREE.MeshStandardMaterial({ color: '#2c2522', roughness: .9 }))); alero.position.set(0, 8.6, -9.4);
  // gong en el medio
  const gong = add(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, .12, 40), new THREE.MeshStandardMaterial({ color: '#c99a3b', metalness: .9, roughness: .3 })));
  gong.rotation.x = Math.PI / 2; gong.position.set(0, 4.2, -10.3);
  const marcoGong = new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: .9 });
  for (const s of [-1, 1]) { const p = add(new THREE.Mesh(new THREE.BoxGeometry(.22, 5.8, .22), marcoGong)); p.position.set(s * 1.7, 3.3, -10.4); }
  const travesano = add(new THREE.Mesh(new THREE.BoxGeometry(3.9, .25, .25), marcoGong)); travesano.position.set(0, 6.1, -10.4);
  // estandartes
  const tela = lienzo(128, 384, (g, w, h) => {
    g.fillStyle = '#7c1414'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d6a447'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#d6a447'; g.beginPath(); g.arc(w / 2, h * .32, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7c1414'; g.beginPath(); g.moveTo(w / 2 - 16, h * .32 - 18); g.lineTo(w / 2 + 18, h * .32); g.lineTo(w / 2 - 16, h * .32 + 18); g.closePath(); g.fill();
  });
  for (const x of [-5.4, 5.4]) { const b = add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.6), new THREE.MeshStandardMaterial({ map: tela, side: THREE.DoubleSide, roughness: .9 }))); b.position.set(x, 5.4, -9); }
  // montañas a lo lejos
  const sil = new THREE.MeshBasicMaterial({ color: '#141228' });
  const r = rng(4);
  for (let i = 0; i < 10; i++) { const c = add(new THREE.Mesh(new THREE.ConeGeometry(4 + r() * 5, 7 + r() * 9, 5), sil)); c.position.set(-34 + i * 7.5, 1, -30 - r() * 8); }
  // faroles rojos colgando
  for (const x of [-9, -3.5, 3.5, 9]) {
    const f = add(new THREE.Mesh(new THREE.SphereGeometry(.32, 14, 10), new THREE.MeshStandardMaterial({ color: '#ff3b2a', emissive: '#c4200f', emissiveIntensity: 1.4 })));
    f.scale.y = 1.25; f.position.set(x, 7.2, -8.3);
    const h = add(halo('#ff4a2a', 1.6, .35)); h.position.copy(f.position);
    anim.push((dt, t) => { f.position.x = x + Math.sin(t * 1.1 + x) * .04; h.position.x = f.position.x; });
  }
  for (const x of [-7.2, 7.2]) anim.push(antorcha(raiz, part, x, 1.75, -5.4));
  // bruma que pasa por el piso
  let acum = 0;
  anim.push((dt) => {
    acum += dt;
    while (acum > .12) { acum -= .12; part.emitir({ x: -14 + Math.random() * 28, y: .15, z: -4 + Math.random() * 6, vx: .3 + Math.random() * .3, color: '#4a4466', tam: 2.2, vida: 3.5, aditivo: true, opacidad: .12, crece: .5 }); }
  });
  return { raiz, anim, luzAmbiente: ['#b7b0ff', '#2a1e1a', 1.4], luzClave: ['#ffe6c8', 1.7], luzBorde: '#7c6cff' };
}
