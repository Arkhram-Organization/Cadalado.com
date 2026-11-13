// Dibujo de La Canchita: cancha de fútbol 5 a 8 cerrada, con los personajes 3D del club, la pelota y dos cámaras
// (transmisión de costado y tercera persona detrás de tu jugador). Recibe una "vista" del partido en cada cuadro.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { POR_ID, rngNpc } from '/comun/npcs.js';
import { dicho } from '/comun/dichos.js';
import { crearParticulas, estallido, halo } from '/pelea/js/objetos3d.js';
import { lienzo, rng, edificio, neonTexto, publico, reflejo, cieloCiudad, hileraFaroles, petalos, lluvia, vapor, cerezo } from '/pelea/js/calles.js';
import { R_PEL } from './motor.js';
import { sfx } from './sonido.js';

export const COLOR_EQ = ['#ff4a3a', '#3a8aff'];
export const CANCHAS = [
  { id: 'barrio', nombre: 'Barrio Chino', desc: 'Faroles, neones y sakura.' },
  { id: 'terraza', nombre: 'La Terraza', desc: 'Arriba de un edificio, con la ciudad prendida.' },
  { id: 'lluvia', nombre: 'Noche de lluvia', desc: 'Pasto mojado y relámpagos.' },
  { id: 'estadio', nombre: 'El Estadio', desc: 'Tribunas llenas y luces de noche.' },
  { id: 'playa', nombre: 'La Playa', desc: 'Arena, mar y atardecer.' },
  { id: 'potrero', nombre: 'El Potrero', desc: 'Tierra, ladrillos y lamparitas.' },
];
const PUBLICIDAD = ['cadalado', 'KIOSCO QUEQUE', 'BAR EL OLCHO', 'PIÑA FINAL', 'ROTISERÍA BATATA', '¡DALE MXD!', 'CASINO DE DOBRO', 'TESINA EXPONENCIAL', 'LA CANCHITA'];

// ---------------------------------------------------------------- la cancha
function cesped(L, A, oscuro = false, sup = 'pasto') {
  const px = 28, W = Math.round((L + 6) * px), H = Math.round((A + 6) * px);
  const t = lienzo(Math.min(W, 2048), Math.min(H, 2048 * H / W), (g, w, h) => {
    const k = w / (L + 6);
    const franjas = 12;
    const colores = sup === 'arena' ? ['#dcc38e', '#d6bc86'] : sup === 'tierra' ? ['#8c6a46', '#86643f'] : oscuro ? ['#1f6a2c', '#1a5e26'] : ['#2f8a3a', '#287c33'];
    for (let i = 0; i < franjas; i++) { g.fillStyle = colores[i % 2]; g.fillRect(i * w / franjas, 0, w / franjas + 1, h); }
    const r = rng(9);
    for (let i = 0; i < 20000; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    // potrero: manchones de pasto; playa: huellas en la arena
    if (sup === 'tierra') for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(70,120,50,${.3 + r() * .4})`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 50, 6 + r() * 25, r() * 3, 0, 7); g.fill(); }
    if (sup === 'arena') for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,90,50,.18)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3, 5, r() * 3, 0, 7); g.fill(); }
    // líneas
    const X = (x) => (x + L / 2 + 3) * k, Z = (z) => (z + A / 2 + 3) * k;
    g.strokeStyle = sup === 'arena' ? 'rgba(30,90,200,.9)' : sup === 'tierra' ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.88)'; g.lineWidth = .1 * k;
    g.strokeRect(X(-L / 2), Z(-A / 2), L * k, A * k);
    g.beginPath(); g.moveTo(X(0), Z(-A / 2)); g.lineTo(X(0), Z(A / 2)); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), 3 * k, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(0), Z(0), .15 * k, 0, 7); g.fill();
    // áreas (en D, como el futsal) y punto penal
    const ra = Math.min(6, A * .28);
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(X(s * L / 2), Z(0), ra * k, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2); g.stroke();
      g.beginPath(); g.arc(X(s * (L / 2 - ra * .75)), Z(0), .13 * k, 0, 7); g.fill();
    }
    // esquinas
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(X(sx * L / 2), Z(sz * A / 2), .6 * k, 0, Math.PI * 2); g.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L + 6, A + 6), new THREE.MeshStandardMaterial({ map: t, roughness: oscuro ? .35 : sup === 'pasto' ? .9 : 1, metalness: oscuro ? .15 : 0 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

function tableros(raiz, L, A, arco) {
  const tex = PUBLICIDAD.map((texto, i) => lienzo(512, 64, (g, w, h) => {
    const c = ['#c5f04a', '#ff4a3a', '#3a8aff', '#ffcf4a', '#ff4fa3', '#7affc8'][i % 6];
    g.fillStyle = '#101014'; g.fillRect(0, 0, w, h);
    g.fillStyle = c; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
    g.font = `900 italic 44px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = c; g.shadowBlur = 10; g.fillStyle = c; g.fillText(texto, w / 2, h / 2 + 2);
  }));
  const borde = new THREE.MeshStandardMaterial({ color: '#1a1a20', roughness: .5 });
  let k = 0;
  const panel = (x, z, largo, rotY) => {
    const mats = tex.map((t) => new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .55, roughness: .4 }));
    const n = Math.max(1, Math.round(largo / 6));
    for (let i = 0; i < n; i++) {
      const l = largo / n;
      const b = new THREE.Mesh(new THREE.BoxGeometry(l - .05, 1, .12), [borde, borde, borde, borde, mats[k++ % mats.length], borde]);
      const off = -largo / 2 + l * (i + .5);
      b.position.set(x + Math.cos(rotY) * off, .5, z - Math.sin(rotY) * off);
      b.rotation.y = rotY; b.castShadow = true; raiz.add(b);
    }
  };
  panel(0, -A / 2 - .08, L, 0); // fondo (mirando a la cámara)
  panel(0, A / 2 + .08, L, Math.PI);
  for (const s of [-1, 1]) {
    const lado = (A - arco) / 2;
    panel(s * (L / 2 + .08), -(arco / 2 + lado / 2), lado, -s * Math.PI / 2);
    panel(s * (L / 2 + .08), arco / 2 + lado / 2, lado, -s * Math.PI / 2);
  }
}

function texturaRed(rep = 8) {
  const t = lienzo(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  return t;
}

function arcos(raiz, L, arco, alto) {
  const palo = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: .3, metalness: .2 });
  const fondo = 1.1;
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.x = s * L / 2; raiz.add(g);
    for (const z of [-arco / 2, arco / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, alto, 12), palo); p.position.set(0, alto / 2, z); p.castShadow = true; g.add(p); }
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, arco + .12, 12), palo); tr.rotation.x = Math.PI / 2; tr.position.y = alto; tr.castShadow = true; g.add(tr);
    const fierro = new THREE.MeshStandardMaterial({ color: '#9aa', metalness: .6 });
    for (const z of [-arco / 2, arco / 2]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, fondo, 6), fierro); b.rotation.z = Math.PI / 2; b.position.set(s * fondo / 2, alto, z); g.add(b); const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, alto, 6), fierro); b2.position.set(s * fondo, alto / 2, z); g.add(b2); }
    const red = new THREE.MeshStandardMaterial({ map: texturaRed(10), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: .5, roughness: 1 });
    const atras = new THREE.Mesh(new THREE.PlaneGeometry(arco, alto), red); atras.rotation.y = Math.PI / 2; atras.position.set(s * fondo, alto / 2, 0); g.add(atras);
    const techo = new THREE.Mesh(new THREE.PlaneGeometry(fondo, arco), red); techo.rotation.x = Math.PI / 2; techo.position.set(s * fondo / 2, alto, 0); g.add(techo);
    for (const z of [-arco / 2, arco / 2]) { const lado = new THREE.Mesh(new THREE.PlaneGeometry(fondo, alto), red); lado.position.set(s * fondo / 2, alto / 2, z); g.add(lado); }
    g.userData.red = atras;
  }
}

function alambrado(raiz, L, A) {
  const red = new THREE.MeshStandardMaterial({ map: texturaRed(1), transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false });
  const alto = 6.5;
  const poste = new THREE.MeshStandardMaterial({ color: '#2a2c34', metalness: .7, roughness: .4 });
  const pared = (w, x, z, rotY) => {
    const t = red.clone(); t.map = texturaRed(1).clone(); t.map.repeat.set(w / .6, alto / .6); t.map.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, alto), t); m.position.set(x, 1 + alto / 2, z); m.rotation.y = rotY; raiz.add(m);
  };
  pared(L + 1, 0, -A / 2 - .3, 0);
  // detrás de los arcos no va nada (tapaba la vista de los arcos)
  for (let x = -L / 2; x <= L / 2 + .1; x += 4) for (const z of [-A / 2 - .3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, alto + 1, 6), poste); p.position.set(x, (alto + 1) / 2, z); raiz.add(p); }
}

function torresDeLuz(raiz, anim, L, A, color = '#f4f8ff') {
  const fierro = new THREE.MeshStandardMaterial({ color: '#2a2c34', metalness: .7, roughness: .4 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * (L / 2 + 2.2), z = sz * (A / 2 + 2.2);
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 11, 8), fierro); torre.position.set(x, 5.5, z); raiz.add(torre);
    const panel = new THREE.Group(); panel.position.set(x, 11, z); panel.lookAt(0, 0, 0); raiz.add(panel);
    const marco = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, .2), fierro); panel.add(marco);
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(.24, 14), new THREE.MeshBasicMaterial({ color })); l.position.set(-.8 + (i % 3) * .8, i < 3 ? .3 : -.3, .11); panel.add(l); }
    const h = halo(color, 6, .45); h.position.set(0, 0, .5); panel.add(h);
  }
}

export function construirCancha(id, escena, part, m) {
  const raiz = new THREE.Group(); escena.add(raiz);
  const anim = [];
  const { L, A, arco, altoArco } = m;
  const r = rng(77);
  const lluvioso = id === 'lluvia';
  // piso de afuera (cemento) y el césped
  const afuera = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), new THREE.MeshStandardMaterial({ color: lluvioso ? '#1c1c22' : '#2a2a30', roughness: lluvioso ? .3 : .9, metalness: lluvioso ? .3 : 0 }));
  afuera.rotation.x = -Math.PI / 2; afuera.position.y = -.01; afuera.receiveShadow = true; raiz.add(afuera);
  raiz.add(cesped(L, A, lluvioso, id === 'playa' ? 'arena' : id === 'potrero' ? 'tierra' : 'pasto'));
  tableros(raiz, L, A, arco);
  arcos(raiz, L, arco, altoArco);
  alambrado(raiz, L, A);
  torresDeLuz(raiz, anim, L, A, lluvioso ? '#dfe8ff' : '#fff6e0');
  // gente mirando del otro lado del alambrado
  const lugares = [];
  for (let x = -L / 2 + 1; x < L / 2; x += 1.5 + r() * .8) lugares.push([x, -A / 2 - 1.6 - r() * 1.6]);
  const pub = publico(raiz, anim, { lugares, r, celulares: true });
  // bancos de suplentes (al fondo, al lado de los arcos: del lado de la cámara taparían la cancha)
  for (const s of []) {
    const banco = new THREE.Mesh(new THREE.BoxGeometry(4, .5, .8), new THREE.MeshStandardMaterial({ color: COLOR_EQ[s > 0 ? 1 : 0], roughness: .6 }));
    banco.position.set(s * 8, .25, A / 2 + 2.4); raiz.add(banco);
    const techo = new THREE.Mesh(new THREE.BoxGeometry(4.4, .08, 1.4), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: .35 }));
    techo.position.set(s * 8, 2.1, A / 2 + 2.3); raiz.add(techo);
  }
  let ambiente;
  if (id === 'estadio') {
    escena.background = cieloCiudad('#03040a', '#0a1430', '#1a2a50', 90);
    escena.fog = new THREE.Fog('#0a1430', 60, 160);
    // tribunas con gente (instancias: cientos de hinchas que saltan con los goles)
    const hinchas = tribunas(raiz, anim, L, A, r);
    neonTexto(raiz, anim, { x: 0, y: 15, z: -A / 2 - 22, texto: 'LA CANCHITA', color: '#c5f04a', ancho: 14, alto: 3, parpadea: false });
    ambiente = { luz: ['#b8c8ff', '#10141e', 1.3], clave: ['#ffffff', 2.6], borde: '#7aa2ff', exposicion: 1.08, extra: hinchas };
  } else if (id === 'playa') {
    escena.background = cieloCiudad('#2a1a5a', '#ff7a5a', '#ffd38a', 10);
    escena.fog = new THREE.Fog('#ffb38a', 60, 150);
    playa(raiz, anim, L, A, r);
    ambiente = { luz: ['#ffd8b8', '#4a3a6a', 1.5], clave: ['#ffcfa0', 2.3], borde: '#ff8a5a', exposicion: 1.05 };
  } else if (id === 'potrero') {
    escena.background = cieloCiudad('#120a1a', '#4a2a3a', '#b0603a', 30);
    escena.fog = new THREE.Fog('#4a2a3a', 40, 110);
    potrero(raiz, anim, L, A, r);
    ambiente = { luz: ['#ffd8a8', '#2a1a14', 1.3], clave: ['#ffe0b0', 1.9], borde: '#ffb36a', exposicion: 1.1 };
  } else if (id === 'terraza') {
    escena.background = cieloCiudad('#04030a', '#1a1238', '#4a1a5a', 150);
    escena.fog = new THREE.Fog('#1a1238', 40, 120);
    for (let i = 0; i < 34; i++) {
      const w = 4 + r() * 6, h = 18 + r() * 40, a = (i / 34) * Math.PI * 2;
      edificio(raiz, { x: Math.cos(a) * (60 + r() * 20), z: Math.sin(a) * (50 + r() * 15) - 10, w, h, d: 6, color: ['#1a1a2a', '#22202e', '#1a2230'][i % 3], r, local: false }).position.y -= 20;
    }
    neonTexto(raiz, anim, { x: 0, y: 9.5, z: -A / 2 - 6, texto: 'LA CANCHITA', color: '#c5f04a', ancho: 9, alto: 2 });
    ambiente = { luz: ['#a8a0ff', '#1a1020', 1.2], clave: ['#ffffff', 2.2], borde: '#ff3b8b', exposicion: 1.05 };
  } else if (lluvioso) {
    escena.background = cieloCiudad('#04050a', '#10141e', '#1e222e', 0);
    escena.fog = new THREE.Fog('#10141e', 28, 80);
    for (let i = 0; i < 10; i++) edificio(raiz, { x: -L / 2 - 6 + i * (L + 12) / 9, z: -A / 2 - 9, w: 5 + r() * 2, h: 9 + r() * 10, color: ['#3a2a2a', '#2a2a3a'][i % 2], r, local: true, letrero: ['BAR', 'KIOSCO', 'PIZZA', 'FARMACIA'][i % 4], letreroColor: ['#ff3b8b', '#3ae0ff', '#ffcf4a', '#7affc8'][i % 4] });
    lluvia(raiz, part, anim, { n: 2200, area: [-L / 2 - 6, L / 2 + 6, -A / 2 - 6, A / 2 + 6], alto: 14 });
    vapor(raiz, part, anim, -L / 2 - 3, A / 2 + 3);
    for (let i = -2; i <= 2; i++) raiz.add(reflejo('#dfe8ff', i * L / 5, 0, 2.5, A * .8, .1));
    const cielo = new THREE.HemisphereLight('#c8d8ff', '#000', 0); raiz.add(cielo);
    let rayo = 0, prox = 8;
    anim.push((dt) => { prox -= dt; if (prox < 0) { rayo = .35; prox = 10 + Math.random() * 14; sfx('trueno'); } rayo = Math.max(0, rayo - dt); cielo.intensity = rayo > 0 ? (Math.sin(rayo * 60) > 0 ? 3 : .5) : 0; });
    ambiente = { luz: ['#8a9ac8', '#0a0c10', .9], clave: ['#dfe8ff', 2.4], borde: '#3ae0ff', exposicion: 1.1 };
  } else {
    escena.background = cieloCiudad('#090614', '#2a0f2e', '#6a1f3a', 120);
    escena.fog = new THREE.Fog('#3a1230', 40, 110);
    const letreros = ['麵館', '茶', '福來', '龍', '餃子', '中華', '飯店'];
    let x = -L / 2 - 10, k = 0;
    while (x < L / 2 + 10) { const w = 4 + r() * 3; edificio(raiz, { x: x + w / 2, z: -A / 2 - 8, w, h: 8 + r() * 9, color: ['#6a2a2a', '#3a2a3a', '#5a3a2a', '#2a3a3a'][k % 4], r, toldo: ['#c22a2a', '#2a8a4a', '#d8a838'][k % 3], letrero: letreros[k % letreros.length], letreroColor: ['#ffd27a', '#ff6a6a', '#7affc8'][k % 3], cjk: true }); x += w + .1; k++; }
    hileraFaroles(raiz, anim, { x0: -L / 2 - 4, x1: L / 2 + 4, y: 8.5, z: -A / 2 - 3, comba: 1.4, cada: 1.4 });
    for (const [cx, cz] of [[-L / 2 - 4, -A / 2 - 4], [L / 2 + 4, -A / 2 - 4], [-L / 2 - 9, -A / 2 - 9], [L / 2 + 9, -A / 2 - 9]]) cerezo(raiz, { x: cx, z: cz, r, alto: 5 });
    petalos(raiz, anim, { n: 450, area: [-L / 2 - 6, L / 2 + 6, -A / 2 - 6, A / 2 + 4], alto: 12 });
    ambiente = { luz: ['#c8a8ff', '#2a0f1e', 1.15], clave: ['#fff0f4', 2.2], borde: '#ff4a8a', exposicion: 1.08 };
  }
  const vitorear = (k) => { pub.vitorear(k); ambiente.extra?.vitorear(k); };
  return { raiz, anim, vitorear, ...ambiente };
}

// Tribunas de estadio llenas: escalones de cemento y cientos de hinchas (instancias) que saltan
function tribunas(raiz, anim, L, A, r) {
  const cemento = new THREE.MeshStandardMaterial({ color: '#4a4e58', roughness: .9 });
  const filas = 9, fondo = -A / 2 - 4;
  for (let i = 0; i < filas; i++) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(L + 30, .6, 1.3), cemento);
    e.position.set(0, .3 + i * .6, fondo - i * 1.3); e.receiveShadow = true; raiz.add(e);
  }
  const techo = new THREE.Mesh(new THREE.BoxGeometry(L + 34, .3, filas * 1.3 + 3), new THREE.MeshStandardMaterial({ color: '#20242c', metalness: .5 }));
  techo.position.set(0, filas * .6 + 5, fondo - filas * .65); raiz.add(techo);
  for (let x = -L / 2 - 14; x <= L / 2 + 14; x += 8) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, filas * .6 + 5, 8), cemento); c.position.set(x, (filas * .6 + 5) / 2, fondo - filas * 1.3 - 1); raiz.add(c); }
  // hinchas: cuerpos y cabezas en instancias, de los colores de los dos equipos
  const n = Math.round((L + 26) / .7) * filas;
  const cuerpo = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.2, .45, 3, 8), new THREE.MeshStandardMaterial({ roughness: .8 }), n);
  const cabeza = new THREE.InstancedMesh(new THREE.SphereGeometry(.15, 8, 6), new THREE.MeshStandardMaterial({ roughness: .8 }), n);
  const pal = ['#ff4a3a', '#ff4a3a', '#3a8aff', '#3a8aff', '#f4f1ea', '#1a1a22', '#ffcf4a'], piel = ['#e8c4a8', '#c99a7a', '#8d5a3c', '#f0d2b8'];
  const datos = [], o = new THREE.Object3D(), c = new THREE.Color();
  let k = 0;
  for (let i = 0; i < filas; i++) for (let x = -L / 2 - 13; x < L / 2 + 13 && k < n; x += .7) {
    if (r() < .12) continue;
    const d = { x: x + (r() - .5) * .3, y: .6 + i * .6 + .55, z: fondo - i * 1.3, f: r() * 6, v: .8 + r() * .8 };
    datos.push(d);
    cuerpo.setColorAt(k, c.set(pal[Math.floor(r() * pal.length)])); cabeza.setColorAt(k, c.set(piel[Math.floor(r() * piel.length)]));
    k++;
  }
  cuerpo.count = cabeza.count = k;
  raiz.add(cuerpo, cabeza);
  let ganas = 0;
  anim.push((dt, t) => {
    ganas = Math.max(0, ganas - dt * .4);
    for (let i = 0; i < k; i++) {
      const d = datos[i];
      const b = Math.abs(Math.sin(t * (2.5 + ganas * 7) * d.v + d.f)) * (.04 + ganas * .35);
      o.position.set(d.x, d.y + b, d.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); cuerpo.setMatrixAt(i, o.matrix);
      o.position.y += .45; o.updateMatrix(); cabeza.setMatrixAt(i, o.matrix);
    }
    cuerpo.instanceMatrix.needsUpdate = true; cabeza.instanceMatrix.needsUpdate = true;
  });
  return { vitorear(f = 1) { ganas = Math.min(1, ganas + f * .5); } };
}

// La playa: mar con olas, sol del atardecer, palmeras y sombrillas
function playa(raiz, anim, L, A, r) {
  const arena = new THREE.Mesh(new THREE.PlaneGeometry(220, 120), new THREE.MeshStandardMaterial({ color: '#d8bf8a', roughness: 1 }));
  arena.rotation.x = -Math.PI / 2; arena.position.y = -.005; raiz.add(arena);
  const ola = lienzo(256, 256, (g, w, h) => { g.fillStyle = '#1a6aa8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${.15 + r() * .25})`; g.lineWidth = 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * .1) * 4); g.stroke(); } });
  ola.wrapS = ola.wrapT = THREE.RepeatWrapping; ola.repeat.set(8, 3);
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshStandardMaterial({ map: ola, color: '#7ab8e8', roughness: .2, metalness: .3, emissive: '#ff8a5a', emissiveIntensity: .15 }));
  mar.rotation.x = -Math.PI / 2; mar.position.set(0, .02, -A / 2 - 75); raiz.add(mar);
  anim.push((dt) => { ola.offset.x += dt * .02; ola.offset.y += dt * .05; });
  const sol = halo('#ffd27a', 40, .9); sol.position.set(20, 8, -140); raiz.add(sol);
  const sol2 = halo('#ff7a3a', 80, .35); sol2.position.set(20, 8, -141); raiz.add(sol2);
  const tronco = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }), hoja = new THREE.MeshStandardMaterial({ color: '#2f8a3a', side: THREE.DoubleSide, roughness: .8 });
  for (const [x, z] of [[-L / 2 - 6, -A / 2 - 8], [-L / 4, -A / 2 - 11], [L / 4 + 3, -A / 2 - 9], [L / 2 + 7, -A / 2 - 7], [0, -A / 2 - 14]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); raiz.add(g);
    let px = 0, py = 0;
    for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.18 - i * .012, .22 - i * .012, 1.1, 8), tronco); px += .12; py += 1.05; t.position.set(px, py - .5, 0); t.rotation.z = -.12; g.add(t); }
    for (let i = 0; i < 7; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(.5, 3.2, 4, 1, true), hoja); h.scale.z = .15; const a = i / 7 * Math.PI * 2; h.position.set(px + Math.cos(a) * 1.3, py - .3, Math.sin(a) * 1.3); h.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); g.add(h); }
  }
  for (const [x, z, col] of [[-L / 2 + 4, -A / 2 - 4, '#ff4a6a'], [-8, -A / 2 - 5, '#ffcf4a'], [9, -A / 2 - 4.5, '#3ae0ff'], [L / 2 - 5, -A / 2 - 5, '#7affc8']]) {
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#eee' })); palo.position.set(x, 1.2, z); raiz.add(palo);
    const tela = new THREE.Mesh(new THREE.ConeGeometry(1.4, .5, 10, 1, true), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide })); tela.position.set(x, 2.4, z); raiz.add(tela);
  }
}

// El potrero: paredes de ladrillo con grafitis, cuerda con ropa colgada, lamparitas y cubiertas
function potrero(raiz, anim, L, A, r) {
  const ladrillo = lienzo(1024, 256, (g, w, h) => {
    g.fillStyle = '#5a3a2c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 14) for (let x = (y / 14) % 2 ? -16 : 0; x < w; x += 32) { const k = r(); g.fillStyle = `rgb(${110 + k * 50},${55 + k * 25},${42 + k * 20})`; g.fillRect(x + 1, y + 1, 30, 12); }
    const tag = (t, x, y, c1, c2, tam) => { g.save(); g.translate(x, y); g.rotate((r() - .5) * .2); g.font = `900 italic ${tam}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.lineWidth = tam * .18; g.strokeStyle = '#111'; g.strokeText(t, 0, 0); const gr = g.createLinearGradient(0, -tam / 2, 0, tam / 2); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(t, 0, 0); g.restore(); };
    tag('LA CANCHITA', 260, 150, '#c5f04a', '#2ab86a', 90); tag('QUEQUE', 720, 160, '#ff8ad8', '#a83af0', 80); tag('MXD', 930, 120, '#6ad8ff', '#2a5af0', 60);
  });
  ladrillo.wrapS = THREE.RepeatWrapping; ladrillo.repeat.set(2, 1);
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(L + 30, 5), new THREE.MeshStandardMaterial({ map: ladrillo, roughness: 1 }));
  pared.position.set(0, 2.5, -A / 2 - 6); raiz.add(pared);
  for (let i = 0; i < 6; i++) { const casa = new THREE.Mesh(new THREE.BoxGeometry(7 + r() * 4, 6 + r() * 5, 5), new THREE.MeshStandardMaterial({ color: ['#b8a888', '#c8987a', '#8aa8b8', '#d8c8a8'][i % 4], roughness: 1 })); casa.position.set(-L / 2 - 6 + i * (L + 12) / 5, 3.5, -A / 2 - 12); raiz.add(casa); }
  // ropa colgada
  const pts = []; for (let i = 0; i <= 30; i++) { const k = i / 30; pts.push(new THREE.Vector3(-L / 2 + k * L, 6.2 - Math.sin(k * Math.PI) * .6, -A / 2 - 5.5)); }
  raiz.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#222' })));
  const ropa = [];
  for (let i = 1; i < 14; i++) { const k = i / 14; const pr = new THREE.Mesh(new THREE.PlaneGeometry(.7 + r() * .4, .8 + r() * .5), new THREE.MeshStandardMaterial({ color: ['#ff4a3a', '#3a8aff', '#ffcf4a', '#f4f1ea', '#5ae07a', '#ff8ad8'][i % 6], side: THREE.DoubleSide })); pr.position.set(-L / 2 + k * L, 6.2 - Math.sin(k * Math.PI) * .6 - .45, -A / 2 - 5.5); raiz.add(pr); ropa.push(pr); }
  anim.push((dt, t) => ropa.forEach((pr, i) => { pr.rotation.x = Math.sin(t * 1.6 + i) * .25; }));
  hileraFaroles(raiz, anim, { x0: -L / 2 - 2, x1: L / 2 + 2, y: 7.5, z: -A / 2 - 3, comba: 1, cada: 1.6, color: '#ffd27a' });
  // cubiertas apiladas en las esquinas
  const goma = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .9 });
  for (const [x, z] of [[-L / 2 - 2.5, -A / 2 - 2.5], [L / 2 + 2.5, -A / 2 - 2.5]]) for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.TorusGeometry(.45, .2, 8, 18), goma); c.rotation.x = Math.PI / 2; c.position.set(x, .2 + i * .38, z); raiz.add(c); }
}

// ---------------------------------------------------------------- pelota
function crearPelota() {
  const tex = lienzo(256, 128, (g, w, h) => {
    g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 14; i++) {
      const x = (i % 7) * w / 7 + (Math.floor(i / 7) ? w / 14 : 0), y = Math.floor(i / 7) ? h * .7 : h * .3;
      g.fillStyle = i % 3 ? '#16161a' : '#c5f04a';
      g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r(); g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 11); } g.closePath(); g.fill();
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(R_PEL, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: .45 }));
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- escena
export function crearEscena(lienzoCanvas, { cancha = 'barrio' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzoCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(36, 16 / 9, .1, 400);
  const part = crearParticulas(escena, 700);
  let amb = null, clave = null, jug = new Map(), pelota = null, sombraPel = null, marca = null, ultimoEv = 0, reloj = 0, sacudida = 0;
  let charlaT = 4, camPos = new THREE.Vector3(0, 14, 30), camMira = new THREE.Vector3(), modo = 'tv', partido = null, hablaHasta = 0;

  function armar(m, jugadores, { mios = [] } = {}) {
    partido = m;
    amb = construirCancha(cancha, escena, part, m);
    renderer.toneMappingExposure = amb.exposicion || 1;
    escena.add(new THREE.HemisphereLight(amb.luz[0], amb.luz[1], amb.luz[2]));
    clave = new THREE.DirectionalLight(amb.clave[0], amb.clave[1]);
    clave.position.set(-m.L * .3, 26, m.A * .6); clave.castShadow = true;
    clave.shadow.mapSize.set(2048, 2048);
    Object.assign(clave.shadow.camera, { left: -m.L / 2 - 3, right: m.L / 2 + 3, top: m.A / 2 + 3, bottom: -m.A / 2 - 3, near: 1, far: 80 });
    escena.add(clave, clave.target);
    const borde = new THREE.DirectionalLight(amb.borde, .9); borde.position.set(m.L * .4, 10, -m.A); escena.add(borde);
    pelota = crearPelota(); escena.add(pelota);
    sombraPel = new THREE.Mesh(new THREE.CircleGeometry(.16, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .35, depthWrite: false }));
    sombraPel.rotation.x = -Math.PI / 2; escena.add(sombraPel);
    // marca del jugador que manejás: flecha arriba de la cabeza
    marca = new Map();
    const promesas = [];
    for (const j of jugadores) {
      const base = POR_ID[j.npc]?.look || {};
      const look = { ...base, travesuras: {}, alBailar: null, alGesto: null, contagia: false };
      const p = crearPersona(THREE, look, { sombras: true, tamGlobo: .5 });
      const pivote = new THREE.Group(); pivote.add(p.grupo); escena.add(pivote);
      // camiseta: un aro del color del equipo en el piso y el número
      const aro = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 28), new THREE.MeshBasicMaterial({ color: COLOR_EQ[j.eq], transparent: true, opacity: .7, depthWrite: false }));
      aro.rotation.x = -Math.PI / 2; aro.position.y = .03; pivote.add(aro);
      if (j.arquero) { const g = new THREE.Mesh(new THREE.RingGeometry(.52, .58, 28), new THREE.MeshBasicMaterial({ color: '#ffcf4a', transparent: true, opacity: .8, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.position.y = .03; pivote.add(g); }
      const flecha = new THREE.Mesh(new THREE.ConeGeometry(.18, .32, 4), new THREE.MeshBasicMaterial({ color: COLOR_EQ[j.eq] }));
      flecha.rotation.x = Math.PI; flecha.position.y = 2.55; flecha.visible = false; pivote.add(flecha);
      const L = { j, look: base, p, pivote, aro, flecha, clave: '', t: 0, listo: false, decirT: 0 };
      promesas.push(p.listo?.then(() => { L.listo = true; }));
      jug.set(j.id, L);
    }
    return Promise.all(promesas.filter(Boolean));
  }

  const clip = (L, n, op) => L.p.clip?.(n, op);
  function animar(L, j, dt) {
    if (!L.listo || !L.p.clip) { L.p.animar?.(j.est === 'corre' ? 'corre' : 'quieto', dt); return; }
    const v = j.velocidad ?? Math.hypot(j.vx || 0, j.vz || 0);
    let clave = j.est;
    if (j.est === 'corre') clave = v > 6.5 ? 'pique' : v > 2.2 ? 'corre' : 'camina';
    const reinicio = clave !== L.clave || (['patea', 'pase', 'cabezazo', 'vuela', 'caido'].includes(j.est) && j.t < L.t - .05);
    if (reinicio) {
      if (clave === 'quieto') clip(L, ['Short_Breathe_and_Look_Around', 'Idle_03', 'Idle'], { vez: false, fundido: .25 });
      else if (clave === 'camina') clip(L, ['Walking'], { vez: false, fundido: .2 });
      else if (clave === 'corre') clip(L, ['Running'], { vez: false, dur: .72, fundido: .18 });
      else if (clave === 'pique') clip(L, ['RunFast', 'run_fast_2', 'Running'], { vez: false, dur: .55, fundido: .15 });
      else if (clave === 'patea') clip(L, ['Boxing_Guard_Right_Straight_Kick', 'Spartan_Kick'], { desde: .3, hasta: .78, dur: .42, fundido: .05 });
      else if (clave === 'pase') clip(L, ['Step_in_High_Kick', 'Boxing_Guard_Right_Straight_Kick'], { desde: .35, hasta: .7, dur: .34, fundido: .05 });
      else if (clave === 'cabezazo') clip(L, ['Female_Head_Down_Charge'], { dur: .4, fundido: .05 });
      else if (clave === 'barrida') clip(L, ['Running'], { congelar: true, desde: .25, fundido: .06 });
      else if (clave === 'caido') clip(L, ['Knock_Down', 'Shot_and_Fall_Backward'], { desde: .42, hasta: .82, dur: .7, fundido: .05 });
      else if (clave === 'levanta') clip(L, ['Wake_Up_and_Look_Up'], { desde: .42, hasta: .8, dur: .45, fundido: .08 });
      else if (clave === 'vuela') clip(L, ['Jump_Over_Obstacle'], { congelar: true, desde: .45, fundido: .05 });
      else if (clave === 'ataja') clip(L, ['Hop_with_Arms_Raised', 'Cheer_with_Both_Hands'], { congelar: true, desde: .35, fundido: .08 });
      else if (clave === 'bicicleta' || clave === 'cano' || clave === 'ruleta' || clave === 'elastica') clip(L, ['Running'], { vez: false, dur: clave === 'bicicleta' ? .45 : .6, fundido: .06 });
      else if (clave === 'amague') clip(L, ['Boxing_Guard_Right_Straight_Kick', 'Spartan_Kick'], { desde: .25, hasta: .42, dur: .32, fundido: .05 });
      else if (clave === 'taco' || clave === 'sombrero') clip(L, ['Step_in_High_Kick', 'Boxing_Guard_Right_Straight_Kick'], { desde: .35, hasta: .7, dur: .3, fundido: .05 });
      else if (clave === 'festeja') clip(L, [L.look?.clips?.festeja, L.look?.clips?.baila, 'Hip_Hop_Dance_4', 'Hop_with_Arms_Raised', 'Show_Both_Arm_Muscles'].flat().filter(Boolean), { vez: false, fundido: .3 });
      else if (clave === 'triste') clip(L, ['Headache_Relief', 'Unsteady_Walk'], { vez: false, fundido: .3 });
      L.clave = clave;
    }
    L.t = j.t;
    L.p.animar('clip', dt);
    // poses hechas a mano encima: barrida (acostado hacia atrás) y estirada del arquero (de costado)
    const g = L.p.grupo;
    const objX = j.est === 'barrida' ? 1.15 : 0;
    const objZ = j.est === 'vuela' ? (j.lado || 1) * 1.35 : j.est === 'elastica' ? -(j.lado || 1) * .45 : 0;
    // la ruleta es una vuelta entera; la bicicleta, las piernas pasando por arriba de la pelota (el cuerpo se mece)
    g.rotation.y = j.est === 'ruleta' ? Math.min(1, j.t / .5) * Math.PI * 2 * (j.lado || 1) : j.est === 'bicicleta' ? Math.sin(j.t * 26) * .55 : g.rotation.y * Math.max(0, 1 - dt * 20);
    g.rotation.x += (objX - g.rotation.x) * Math.min(1, dt * 18);
    g.rotation.z += (objZ - g.rotation.z) * Math.min(1, dt * 14);
    g.position.y = j.est === 'barrida' ? -.35 : j.est === 'vuela' ? .45 + Math.sin(Math.min(1, j.t / .6) * Math.PI) * .5 : 0;
  }

  function hablar(id, situacion, semilla, prob = 1) {
    const L = jug.get(id);
    if (!L || !L.listo || reloj < hablaHasta || reloj < L.decirT) return;
    const r = rngNpc((semilla * 2654435761 + id.length * 31) >>> 0);
    if (r() > prob) return;
    const t = dicho(L.j.npc, situacion, 'alguien', r);
    if (t) { L.p.decir?.(t, 3); L.decirT = reloj + 8; hablaHasta = reloj + 3.2; }
  }

  function alEvento(ev, v) {
    const p = v.pel;
    if (ev.k === 'remate') { sfx('remate', ev.fuerza); if (ev.fuerza > .75) sacudida = .12; }
    else if (ev.k === 'pase') sfx(ev.alto ? 'globo' : 'pase');
    else if (ev.k === 'pique') sfx('pique', ev.fuerza);
    else if (ev.k === 'pared') { sfx('pared', ev.fuerza); }
    else if (ev.k === 'palo') { sfx('palo'); amb.vitorear?.(.8); sacudida = .15; }
    else if (ev.k === 'atajada') { sfx('atajada'); amb.vitorear?.(.7); hablar(ev.a, 'gana', ev.n, .4); }
    else if (ev.k === 'barre' || ev.k === 'quite') sfx('quite');
    else if (ev.k === 'cae') { sfx('cae'); hablar(ev.a, 'pierde', ev.n, .5); for (let i = 0; i < 8; i++) part.emitir({ x: p.x, y: .1, z: p.z, vx: (Math.random() - .5) * 2, vy: Math.random(), color: '#7aa860', tam: .3, vida: .6, crece: 1, aditivo: false, opacidad: .6 }); }
    else if (ev.k === 'pitazo') sfx('silbato');
    else if (ev.k === 'cabezazo' || ev.k === 'volea') sfx('remate', .8);
    else if (ev.k === 'gol') {
      sfx('gol'); amb.vitorear?.(2); sacudida = .35;
      estallido(part, p.x, 1, { color: COLOR_EQ[ev.eq], color2: '#ffffff', n: 60, vel: 7, tam: .35, vida: 1.2, g: 4 });
      if (ev.autor && !ev.contra) hablar(ev.autor, 'gana', ev.n, 1);
    } else if (ev.k === 'final') { sfx('final'); amb.vitorear?.(1.5); }
    else if (ev.k === 'truco') { sfx(ev.exito ? 'ole' : 'truco'); if (ev.exito) { amb.vitorear?.(.9); hablar(ev.a, 'gana', ev.n, .45); } }
    else if (ev.k === 'esquiva') { sfx('ole'); amb.vitorear?.(.6); }
    else if (ev.k === 'lectura') { const bot = v.jug.find((j) => !j.humano && j.eq !== v.jug.find((x) => x.id === v.mando?.[ev.hid])?.eq); if (bot) hablar(bot.id, 'gana', ev.n, 1); }
  }

  function actualizar(v, dt, { mios = [] } = {}) {
    reloj += dt;
    for (const fn of amb?.anim || []) fn(dt, reloj);
    part.actualizar(dt);
    if (!v || !pelota) return render(dt);
    for (const ev of v.ev || []) if (ev.n > ultimoEv) { ultimoEv = ev.n; alEvento(ev, v); }
    const manejados = new Set(Object.entries(v.mando || {}).filter(([hid]) => mios.includes(hid)).map(([, pid]) => pid));
    // charla: cada tanto alguien cerca de la pelota tira su frase
    if (v.fase === 'juego') {
      charlaT -= dt;
      if (charlaT <= 0) {
        charlaT = 6 + ((Math.floor(v.tiempo) * 7) % 5);
        const cerca = [...v.jug].sort((a, b) => Math.hypot(a.x - v.pel.x, a.z - v.pel.z) - Math.hypot(b.x - v.pel.x, b.z - v.pel.z)).slice(0, 4);
        const quien = cerca[Math.floor(v.tiempo) % cerca.length];
        if (quien) hablar(quien.id, 'turno', Math.floor(v.tiempo) * 13, .7);
      }
    }
    for (const j of v.jug) {
      const L = jug.get(j.id); if (!L) continue;
      L.pivote.position.x += (j.x - L.pivote.position.x) * Math.min(1, dt * 20);
      L.pivote.position.z += (j.z - L.pivote.position.z) * Math.min(1, dt * 20);
      const obj = Math.atan2(-Math.cos(j.ang), -Math.sin(j.ang));
      let d = obj - L.pivote.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      L.pivote.rotation.y += d * Math.min(1, dt * 16);
      if (j.est === 'vuela' && L.clave !== 'vuela') j.lado = Math.sign(j.vz || 1) * (j.eq ? -1 : 1);
      animar(L, j, dt);
      const mio = manejados.has(j.id);
      L.flecha.visible = mio; L.flecha.position.y = 2.55 + Math.sin(reloj * 6) * .08;
      L.aro.material.opacity = mio ? 1 : .55;
      L.aro.scale.setScalar(mio ? 1.15 + Math.sin(reloj * 8) * .05 : 1);
    }
    // pelota (gira según cuánto anda)
    const p = v.pel;
    const vel = Math.hypot(p.vx, p.vz);
    const prev = pelota.position.clone();
    pelota.position.x += (p.x - pelota.position.x) * Math.min(1, dt * 30);
    pelota.position.y += (p.y - pelota.position.y) * Math.min(1, dt * 30);
    pelota.position.z += (p.z - pelota.position.z) * Math.min(1, dt * 30);
    const mov = pelota.position.clone().sub(prev);
    if (mov.lengthSq() > 1e-6) { const eje = new THREE.Vector3(mov.z, 0, -mov.x).normalize(); pelota.rotateOnWorldAxis(eje, mov.length() / R_PEL); }
    sombraPel.position.set(pelota.position.x, .02, pelota.position.z);
    sombraPel.scale.setScalar(Math.max(.4, 1 - p.y * .15)); sombraPel.material.opacity = Math.max(.08, .35 - p.y * .05);
    if (vel > 16 && !p.duenio) part.emitir({ x: pelota.position.x, y: pelota.position.y, z: pelota.position.z, color: '#ffffff', tam: .25, vida: .25, crece: -.5, opacidad: .5 });
    camaraSigue(v, dt, manejados);
    render(dt);
  }

  function camaraSigue(v, dt, manejados) {
    const p = v.pel, m = v;
    let pos, mira;
    const mio = [...manejados].map((id) => v.jug.find((j) => j.id === id)).find(Boolean);
    if (modo === 'tercera' && mio) {
      const s = mio.eq ? -1 : 1;
      const tx = mio.x * .8 + p.x * .2, tz = mio.z * .8 + p.z * .2;
      pos = new THREE.Vector3(tx - s * 9.5, 5.2, tz * .9);
      mira = new THREE.Vector3(tx + s * 7, .6, tz * .6 + p.z * .2);
    } else {
      const lim = m.L / 2 - 8;
      const cx = Math.max(-lim, Math.min(lim, p.x));
      const lejos = 15 + (m.formato - 5) * 3;
      pos = new THREE.Vector3(cx, 11 + (m.formato - 5) * 1.6, m.A / 2 + lejos);
      mira = new THREE.Vector3(cx, 0, p.z * .25);
      if (v.fase === 'gol') { pos.lerp(new THREE.Vector3(p.x * .9, 4, p.z + 8), .6); mira.set(p.x * .9, 1, p.z); }
    }
    const k = Math.min(1, dt * (modo === 'tercera' ? 5 : 3));
    camPos.lerp(pos, k); camMira.lerp(mira, k);
  }

  function render(dt) {
    const w = lienzoCanvas.clientWidth, h = lienzoCanvas.clientHeight;
    if (w && h && (lienzoCanvas.width !== Math.round(w * renderer.getPixelRatio()) || lienzoCanvas.height !== Math.round(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
    }
    sacudida = Math.max(0, sacudida - dt);
    const angosto = Math.max(1, 1.45 / Math.max(.5, camara.aspect));
    const dir = camPos.clone().sub(camMira).multiplyScalar(angosto - 1);
    camara.position.copy(camPos).add(dir).add(new THREE.Vector3((Math.random() - .5) * sacudida, (Math.random() - .5) * sacudida, 0));
    camara.lookAt(camMira);
    renderer.render(escena, camara);
  }

  return {
    armar, actualizar, renderer, escena, camara,
    get modo() { return modo; },
    cambiarCamara() { modo = modo === 'tv' ? 'tercera' : 'tv'; return modo; },
    ponerCamara(m) { modo = m; },
    destruir() { for (const L of jug.values()) L.p.dispose?.(); part.destruir(); renderer.dispose(); },
  };
}
