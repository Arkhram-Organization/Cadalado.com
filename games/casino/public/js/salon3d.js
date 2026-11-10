// El salón del casino de Dobro como un casino de verdad: alfombra con arabescos, filas de tragamonedas
// con pantallas encendidas y banquetas rojas, techo oscuro con luces y neones rojos, el cartel de RULETA
// en neón y pantallas grandes. Se usa detrás de la mesa de blackjack y de fondo en el salón.
import * as THREE from '/comun/vendor/three.module.min.js';

const azar = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

function texAlfombra() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), r = azar(11);
  g.fillStyle = '#3a0c0e'; g.fillRect(0, 0, 512, 512);
  // arabescos: curvas doradas y naranjas que se enroscan
  for (let i = 0; i < 70; i++) {
    const x = r() * 512, y = r() * 512, rad = 18 + r() * 46;
    g.strokeStyle = ['#c9822b', '#e0a13a', '#8a3a12', '#b4561c', '#f0c060'][Math.floor(r() * 5)];
    g.lineWidth = 3 + r() * 6; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, rad, r() * 6, r() * 6 + 2 + r() * 3); g.stroke();
    g.beginPath(); g.moveTo(x + rad, y); g.bezierCurveTo(x + rad * 2, y - rad, x + rad * 2.5, y + rad * 1.2, x + rad * 3, y + rad * 0.3); g.stroke();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,190,90,.12)' : 'rgba(0,0,0,.18)'; g.fillRect(r() * 512, r() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texPantalla(semilla) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const g = c.getContext('2d'), r = azar(semilla);
  const fondos = [['#2a0a5a', '#7a1fd0'], ['#0a2a5a', '#1f7ad0'], ['#5a0a1a', '#d01f4a'], ['#0a4a2a', '#1fd07a'], ['#5a3a0a', '#d0901f']];
  const [a, b] = fondos[semilla % fondos.length];
  const d = g.createLinearGradient(0, 0, 0, 160); d.addColorStop(0, a); d.addColorStop(1, b); g.fillStyle = d; g.fillRect(0, 0, 128, 160);
  g.fillStyle = '#ffd23f'; g.font = '900 18px Impact, sans-serif'; g.textAlign = 'center'; g.fillText(['JACKPOT', 'MEGA', 'DOBRO', 'LUCKY 7', 'FORTUNA'][semilla % 5], 64, 24);
  g.fillStyle = '#fff'; g.font = '700 13px monospace'; g.fillText((Math.floor(r() * 9e6) + 1e6).toLocaleString('es-AR'), 64, 42);
  for (let k = 0; k < 3; k++) { g.fillStyle = '#f4f1ea'; g.fillRect(10 + k * 38, 56, 32, 70); g.font = '900 26px Impact'; g.fillStyle = ['#e0263a', '#2a7ad0', '#1fa34a', '#d09a1f'][Math.floor(r() * 4)]; g.fillText(['7', '$', '★', 'BAR', '♦'][Math.floor(r() * 5)], 26 + k * 38, 100); }
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 136, 128, 24);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texNeon(texto, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = '700 86px "Brush Script MT", "Segoe Script", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 28; g.fillStyle = color; g.fillText(texto, 256, 66);
  g.shadowBlur = 8; g.fillStyle = '#fff3d6'; g.fillText(texto, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texRuleta() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0612'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 37; i++) { g.fillStyle = i === 0 ? '#1a8a3a' : i % 2 ? '#c8102e' : '#141414'; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 110, (i / 37) * Math.PI * 2, ((i + 1) / 37) * Math.PI * 2); g.fill(); }
  g.strokeStyle = '#ff3b5c'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(128, 128, 56, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 56, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Arma el salón alrededor de (0, 0, centroZ). Devuelve { animar(t) } para las luces que titilan.
export function armarSalon(scene, { centroZ = 0, radio = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color(0x07040a);
  scene.fog = new THREE.Fog(0x07040a, 14 * radio, 36 * radio);
  scene.add(new THREE.HemisphereLight(0xff9a7a, 0x1a0608, 0.55));
  // alfombra
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: texAlfombra(), roughness: 0.95 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; g.add(piso);
  // techo oscuro con luces empotradas y neones rojos
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 1 }));
  techo.rotation.x = Math.PI / 2; techo.position.y = 5.6; g.add(techo);
  const foquito = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  const disco = new THREE.CircleGeometry(0.09, 10);
  for (let x = -16; x <= 16; x += 2.4) for (let z = -16; z <= 12; z += 2.4) { const f = new THREE.Mesh(disco, foquito); f.rotation.x = Math.PI / 2; f.position.set(x + ((z / 2.4) % 2) * 1.2, 5.58, z + centroZ); g.add(f); }
  const neonRojo = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
  for (const [x1, z1, x2, z2] of [[-14, -4, 14, -4], [-14, -9, 14, -9], [-14, 4, 14, 4], [-9, -14, -9, 10], [9, -14, 9, 10], [-12, -12, 12, -12]]) {
    const largo = Math.hypot(x2 - x1, z2 - z1);
    const n = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.05, 0.08), neonRojo);
    n.position.set((x1 + x2) / 2, 5.5, (z1 + z2) / 2 + centroZ); n.rotation.y = -Math.atan2(z2 - z1, x2 - x1); g.add(n);
  }
  // tragamonedas en filas, con banquetas rojas
  const gabinete = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.5, roughness: 0.35 });
  const cromo = new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.9, roughness: 0.2 });
  const cuero = new THREE.MeshStandardMaterial({ color: 0x9a0f18, roughness: 0.45 });
  const coloresNeon = [0xff2a3a, 0x2a8aff, 0xb02aff, 0x2affa0, 0xffb02a];
  const pantallas = [];
  let k = 0;
  const maquina = (x, z, ry) => {
    const m = new THREE.Group(); m.position.set(x, 0, z + centroZ); m.rotation.y = ry; g.add(m);
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.3, 0.75), gabinete); cuerpo.position.y = 1.15; cuerpo.castShadow = true; m.add(cuerpo);
    const color = coloresNeon[k % coloresNeon.length];
    const marco = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.36, 0.05), new THREE.MeshBasicMaterial({ color })); marco.position.set(0, 1.18, 0.37); m.add(marco);
    const pant = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.98), new THREE.MeshBasicMaterial({ map: texPantalla(k + 3) })); pant.position.set(0, 1.45, 0.4); m.add(pant);
    const arriba = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.2), new THREE.MeshBasicMaterial({ color })); arriba.position.set(0, 2.62, 0.18); m.add(arriba);
    const tablero = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x222228, emissive: color, emissiveIntensity: 0.25 })); tablero.position.set(0, 0.86, 0.5); tablero.rotation.x = -0.35; m.add(tablero);
    // banqueta
    const caño = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), cromo); caño.position.set(0, 0.35, 1.05); m.add(caño);
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 16), cromo); pie.position.set(0, 0.02, 1.05); m.add(pie);
    const asiento = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.16, 18), cuero); asiento.position.set(0, 0.76, 1.05); asiento.castShadow = true; m.add(asiento);
    const respaldo = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 8, 16, Math.PI), cuero); respaldo.position.set(0, 0.95, 1.27); respaldo.rotation.x = -0.25; m.add(respaldo);
    pantallas.push({ marco, arriba, color, fase: k * 0.7 });
    k++;
  };
  const filas = [
    { x0: -10, x1: 10, z: -10.5, ry: 0 }, // atrás
    { x0: -11, x1: -5, z: -2, ry: Math.PI / 2, lado: true }, { x0: 5, x1: 11, z: -2, ry: -Math.PI / 2, lado: true },
  ];
  for (let x = -10; x <= 10; x += 1.05) if (Math.abs(x) > 2.4) maquina(x, -10.5, 0);
  for (let z = -8; z <= 6; z += 1.05) { maquina(-9.5, z, Math.PI / 2); maquina(9.5, z, -Math.PI / 2); }
  for (let x = -6; x <= -2.5; x += 1.05) { maquina(x, 9, Math.PI); maquina(-x, 9, Math.PI); }
  void filas;
  // el cartel de RULETA en neón, con una pantalla grande de ruleta
  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: texNeon('Ruleta', '#ff9a3a'), transparent: true }));
  cartel.position.set(0, 4.3, -10.2 + centroZ); g.add(cartel);
  const columna = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x1a0c10, roughness: 0.6 }));
  columna.position.set(0, 2.8, -11.3 + centroZ); g.add(columna);
  const rul = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: texRuleta() }));
  rul.position.set(0, 2.2, -10.55 + centroZ); g.add(rul);
  for (const x of [-6.5, 6.5]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.9), new THREE.MeshBasicMaterial({ map: texRuleta() }));
    p.position.set(x, 4.3, -11.9 + centroZ); g.add(p);
    const marco = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2a3a })); marco.position.set(x, 4.3, -11.95 + centroZ); g.add(marco);
  }
  // baldosas con números en el piso (como en las salas de ruleta)
  const nums = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13];
  nums.forEach((n, i) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = i % 2 ? '#141414' : '#c8102e'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#fff'; x.font = '900 40px Impact'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 64, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    b.rotation.x = -Math.PI / 2; b.position.set(-7.6 + (i % 6) * 1.25, 0.01, 7.2 + Math.floor(i / 6) * 0.65 + centroZ); g.add(b);
  });
  // luces de color que tiñen el salón (pocas: el resto es emisivo)
  const luces = [[0xff2a3a, -8, 2, -9], [0x2a8aff, 8, 2, -9], [0xb02aff, -9, 2, 4], [0xff8a2a, 9, 2, 4], [0xff2a3a, 0, 3.5, -9.5]].map(([c, x, y, z]) => { const l = new THREE.PointLight(c, 14, 11, 1.6); l.position.set(x, y, z + centroZ); g.add(l); return l; });
  return {
    grupo: g,
    animar(t) {
      for (const p of pantallas) { const k2 = 0.75 + 0.25 * Math.sin(t * 3 + p.fase); p.arriba.material.color.setHex(p.color).multiplyScalar(k2); }
      luces.forEach((l, i) => (l.intensity = 12 + Math.sin(t * 1.5 + i) * 3));
    },
  };
}

// Fondo del salón (la página del casino): el salón con la cámara paseando despacio
export function fondoCasino(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const salon = armarSalon(scene);
  const camara = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  let raf, t0 = performance.now();
  const cuadro = (ms) => {
    raf = requestAnimationFrame(cuadro);
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); }
    const t = (ms - t0) / 1000;
    camara.position.set(Math.sin(t * 0.05) * 3, 2.3, 3 + Math.cos(t * 0.04) * 1.5);
    camara.lookAt(Math.sin(t * 0.07) * 7, 1.7, -10);
    salon.animar(t);
    renderer.render(scene, camara);
  };
  raf = requestAnimationFrame(cuadro);
  return () => { cancelAnimationFrame(raf); renderer.dispose(); };
}
