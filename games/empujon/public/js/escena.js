// Dibujo de Empujón: la plataforma flotando sobre la ciudad, los personajes 3D del club (crecen al tirar a otros),
// la corona del que va ganando, los objetos (guante, cáscara, bomba), efectos y cámara. Recibe una "vista" por cuadro.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { POR_ID, rngNpc } from '/comun/npcs.js';
import { dicho } from '/comun/dichos.js';
import { crearParticulas, estallido, halo } from '/pelea/js/objetos3d.js';
import { lienzo, rng, edificio, neonTexto, cieloCiudad, hileraFaroles, petalos } from '/pelea/js/calles.js';
import { MAPAS } from './motor.js';
import { sfx } from './sonido.js';

export const COLOR_EQ = ['#ff4a3a', '#3a8aff'];
// color de cada uno en todos contra todos (sale del id, igual en todas las compus)
const PALETA = ['#ff4a3a', '#3a8aff', '#5ae07a', '#ffcf4a', '#ff8ad8', '#7affc8', '#c084fc', '#ff9a3a', '#3ae0ff', '#e8e4dc'];
export const colorDe = (j) => (j.eq === 0 || j.eq === 1 ? COLOR_EQ[j.eq] : PALETA[[...String(j.id)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % PALETA.length]);
export const MAPAS_LISTA = Object.entries(MAPAS).map(([id, M]) => ({ id, nombre: M.nombre }));

// ---------------------------------------------------------------- la plataforma y lo que hay alrededor
function plataforma(id, M) {
  const g = new THREE.Group();
  const r = rng(13);
  if (M.forma === 'circulo') {
    const tex = lienzo(1024, 1024, (c, w, h) => {
      c.fillStyle = '#9a1c1c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e0b24a'; c.lineWidth = 14;
      for (const rr of [.47, .36, .2]) { c.beginPath(); c.arc(w / 2, h / 2, w * rr, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = 'rgba(224,178,74,.85)';
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; c.beginPath(); c.arc(w / 2 + Math.cos(a) * w * .415, h / 2 + Math.sin(a) * h * .415, 14, 0, 7); c.fill(); }
      c.font = '900 italic 120px "Barlow Condensed", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(224,178,74,.9)'; c.fillText('EMPUJÓN', w / 2, h / 2 + 6);
      for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(0,0,0,${r() * .1})`; c.fillRect(r() * w, r() * h, 2, 2); }
    });
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(M.radio, M.radio, .9, 72), [new THREE.MeshStandardMaterial({ color: '#5a1010', roughness: .6 }), new THREE.MeshStandardMaterial({ map: tex, roughness: .55 }), new THREE.MeshStandardMaterial({ color: '#3a0a0a' })]);
    tapa.position.y = -.45; tapa.receiveShadow = true; g.add(tapa);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(M.radio, .12, 10, 96), new THREE.MeshStandardMaterial({ color: '#e0b24a', metalness: .8, roughness: .3 }));
    borde.rotation.x = Math.PI / 2; g.add(borde);
    g.userData.borde = borde;
  } else {
    const puente = id === 'puente';
    const tex = lienzo(1024, 512, (c, w, h) => {
      if (puente) {
        for (let x = 0; x < w; x += 42) { const k = r(); c.fillStyle = `rgb(${110 + k * 40},${72 + k * 25},${42 + k * 15})`; c.fillRect(x, 0, 40, h); c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 6; i++) c.fillRect(x + 4 + r() * 30, r() * h, 2, 30 + r() * 60); c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(x + 8, 20, 3, 0, 7); c.arc(x + 8, h - 20, 3, 0, 7); c.fill(); }
      } else {
        c.fillStyle = '#5c5e66'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${r() * .05})`; c.fillRect(r() * w, r() * h, 3, 3); }
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3;
        for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
        for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        // el borde pintado de amarillo y negro (peligro)
        c.lineWidth = 26;
        for (let i = 0; i < 2 * (w + h); i += 52) { c.strokeStyle = (i / 52) % 2 ? '#1a1a1a' : '#f2c94c'; }
        const franja = (x, y, ww, hh) => { for (let k = 0; k < Math.max(ww, hh); k += 40) { c.fillStyle = (k / 40) % 2 ? '#1a1a1a' : '#f2c94c'; ww > hh ? c.fillRect(x + k, y, 40, hh) : c.fillRect(x, y + k, ww, 40); } };
        franja(0, 0, w, 22); franja(0, h - 22, w, 22); franja(0, 0, 22, h); franja(w - 22, 0, 22, h);
        c.font = '900 italic 120px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.08)'; c.fillText('EMPUJÓN', w / 2, h / 2);
      }
    });
    const losa = new THREE.Mesh(new THREE.BoxGeometry(M.ancho, puente ? .45 : 1.2, M.largo), [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }) : new THREE.MeshStandardMaterial({ color: puente ? '#4a2f1c' : '#3a3c44', roughness: .9 }))));
    losa.position.y = puente ? -.225 : -.6; losa.receiveShadow = true; losa.castShadow = true; g.add(losa);
    if (puente) {
      // vigas y sogas colgando debajo
      for (const z of [-M.largo / 2 + .3, M.largo / 2 - .3]) { const v = new THREE.Mesh(new THREE.BoxGeometry(M.ancho + 1, .35, .35), new THREE.MeshStandardMaterial({ color: '#3a2414' })); v.position.set(0, -.6, z); g.add(v); }
    }
  }
  return g;
}

function alrededor(id, escena, raiz, anim, part) {
  const r = rng(29);
  if (id === 'plato') {
    escena.background = cieloCiudad('#090614', '#2a0f2e', '#6a1f3a', 120);
    escena.fog = new THREE.Fog('#2a0f2e', 30, 110);
    // el Barrio Chino, abajo
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, d = 26 + r() * 14, w = 4 + r() * 4; edificio(raiz, { x: Math.cos(a) * d, z: Math.sin(a) * d - 4, w, h: 10 + r() * 14, color: ['#6a2a2a', '#3a2a3a', '#5a3a2a', '#2a3a3a'][i % 4], r, local: true, toldo: ['#c22a2a', '#2a8a4a'][i % 2], letrero: ['麵', '茶', '福', '龍'][i % 4], letreroColor: '#ffd27a', cjk: true }).position.y -= 26; }
    // faroles colgando al fondo, altos (no tapan la cámara)
    for (const [z, y] of [[-11, 9.5], [-6, 10.5]]) hileraFaroles(raiz, anim, { x0: -15, x1: 15, y, z, comba: 2, cada: 1.4, fase: z });
    petalos(raiz, anim, { n: 380, area: [-16, 16, -14, 12], alto: 12 });
    return { luz: ['#c8a8ff', '#2a0f1e', 1.25], clave: ['#ffe8f0', 2.1], borde: '#ff4a8a' };
  }
  if (id === 'puente') {
    escena.background = cieloCiudad('#1a0605', '#702010', '#ff6a2a', 40);
    escena.fog = new THREE.Fog('#4a1208', 30, 100);
    const lavaTex = lienzo(256, 256, (c, w, h) => { c.fillStyle = '#ff4d0a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { c.fillStyle = r() < .5 ? '#ffb42a' : '#a81904'; c.beginPath(); c.arc(r() * w, r() * h, 6 + r() * 24, 0, 7); c.fill(); } });
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping; lavaTex.repeat.set(10, 10);
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: lavaTex }));
    lava.rotation.x = -Math.PI / 2; lava.position.y = -22; raiz.add(lava);
    anim.push((dt) => { lavaTex.offset.x += dt * .02; lavaTex.offset.y += dt * .012; });
    const roca = new THREE.MeshStandardMaterial({ color: '#2a1714', roughness: 1, flatShading: true });
    for (const s of [-1, 1]) { const acant = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 26), roca); acant.position.set(s * (MAPAS.puente.ancho / 2 + 7), -15.2, 0); raiz.add(acant); }
    for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(5 + r() * 6, 14 + r() * 16, 7), roca); c.position.set(-50 + i * 11, -14, -40 - r() * 20); raiz.add(c); }
    const luz = new THREE.PointLight('#ff5a1a', 60, 60, 1.4); luz.position.set(0, -8, 0); raiz.add(luz);
    let acum = 0;
    anim.push((dt, t) => { luz.intensity = 55 + Math.sin(t * 2.2) * 10; acum += dt; while (acum > .04) { acum -= .04; part.emitir({ x: (Math.random() - .5) * 40, y: -18, z: (Math.random() - .5) * 30, vy: 4 + Math.random() * 4, color: Math.random() < .6 ? '#ff7a1a' : '#ffd14a', tam: .18, vida: 4, crece: -.5 }); } });
    return { luz: ['#ffb38a', '#3a0d06', 1.3], clave: ['#ffd8b8', 1.9], borde: '#ff5a1a' };
  }
  // terraza: arriba de un rascacielos, con la ciudad abajo
  escena.background = cieloCiudad('#04030a', '#1a0f3a', '#5a1a6a', 160);
  escena.fog = new THREE.Fog('#1a0f3a', 40, 140);
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = 22 + r() * 40, w = 5 + r() * 6, h = 20 + r() * 40;
    edificio(raiz, { x: Math.cos(a) * d, z: Math.sin(a) * d, w, h, d: 6, color: ['#1a1a2a', '#22202e', '#1a2230'][i % 3], r, local: false }).position.y -= 30 + r() * 20;
  }
  // el edificio de abajo de la plataforma
  const torre = new THREE.Mesh(new THREE.BoxGeometry(MAPAS.terraza.ancho * .8, 60, MAPAS.terraza.largo * .8), new THREE.MeshStandardMaterial({ color: '#16161e', roughness: .8 }));
  torre.position.y = -31.2; raiz.add(torre);
  neonTexto(raiz, anim, { x: 0, y: 6, z: -16, texto: 'EMPUJÓN', color: '#ff3b8b', ancho: 12, alto: 3 });
  neonTexto(raiz, anim, { x: -16, y: 3, z: -12, texto: 'cadalado', color: '#c5f04a', ancho: 7, alto: 1.6, rotY: .5 });
  return { luz: ['#9a8aff', '#1a0f20', 1.25], clave: ['#ffffff', 2.1], borde: '#3ae0ff' };
}

// ---------------------------------------------------------------- objetos 3D
function corona() {
  const g = new THREE.Group();
  const oro = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: .9, roughness: .25, emissive: '#7a5a08', emissiveIntensity: .5 });
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .09, 20, 1, true), oro); aro.material.side = THREE.DoubleSide; g.add(aro);
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 4), oro); const a = i / 5 * Math.PI * 2; p.position.set(Math.cos(a) * .16, .1, Math.sin(a) * .16); g.add(p); const gema = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), new THREE.MeshStandardMaterial({ color: ['#ff3b5c', '#3ae0ff', '#5ae07a'][i % 3], emissive: '#ffffff', emissiveIntensity: .3 })); gema.position.set(Math.cos(a) * .172, 0, Math.sin(a) * .172); g.add(gema); }
  g.add(halo('#ffd27a', .9, .45));
  return g;
}
function crearObjeto(tipo) {
  const g = new THREE.Group();
  if (tipo === 'guante') {
    const rojo = new THREE.MeshStandardMaterial({ color: '#e0201a', roughness: .35 });
    const puno = new THREE.Mesh(new THREE.SphereGeometry(.32, 18, 14), rojo); puno.scale.set(1, .85, 1.15); g.add(puno);
    const pulgar = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), rojo); pulgar.position.set(.22, -.05, .12); g.add(pulgar);
    const puno2 = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .3, 14), new THREE.MeshStandardMaterial({ color: '#f4f1ea' })); puno2.rotation.z = Math.PI / 2; puno2.position.x = -.36; g.add(puno2);
    g.add(halo('#ff4a3a', 1.4, .45));
  } else if (tipo === 'banana') {
    const am = new THREE.MeshStandardMaterial({ color: '#ffd84a', roughness: .5 });
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(.09, .5, 6), am); p.rotation.z = Math.PI / 2 + .6; p.rotation.y = i / 4 * Math.PI * 2; p.position.y = .05; g.add(p); }
    g.add(halo('#ffd84a', 1.1, .4));
  } else {
    const negro = new THREE.MeshStandardMaterial({ color: '#141418', roughness: .3, metalness: .4 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 18, 14), negro));
    const mecha = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .2, 6), new THREE.MeshStandardMaterial({ color: '#c8a070' })); mecha.position.y = .36; g.add(mecha);
    const chispa = halo('#ffcf4a', .4, 1); chispa.position.y = .48; g.add(chispa); g.userData.chispa = chispa;
    g.add(halo('#ff5a1a', 1.2, .35));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- escena
export function crearEscena(lienzoCanvas, { mapa = 'terraza' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzoCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(38, 16 / 9, .1, 400);
  const part = crearParticulas(escena, 800);
  const M = MAPAS[mapa] || MAPAS.terraza;
  const raiz = new THREE.Group(); escena.add(raiz);
  const anim = [];
  const amb = alrededor(mapa, escena, raiz, anim, part);
  escena.add(new THREE.HemisphereLight(amb.luz[0], amb.luz[1], amb.luz[2]));
  const clave = new THREE.DirectionalLight(amb.clave[0], amb.clave[1]);
  clave.position.set(-8, 24, 12); clave.castShadow = true; clave.shadow.mapSize.set(2048, 2048);
  Object.assign(clave.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 70 });
  escena.add(clave, clave.target);
  const borde = new THREE.DirectionalLight(amb.borde, 1); borde.position.set(10, 8, -14); escena.add(borde);
  const pista = plataforma(mapa, M); escena.add(pista);
  // aviso de borde cuando se achica: un anillo rojo que titila
  const aviso = new THREE.Mesh(M.forma === 'circulo' ? new THREE.RingGeometry(M.radio - .25, M.radio, 96) : new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  if (M.forma === 'circulo') { aviso.rotation.x = -Math.PI / 2; aviso.position.y = .02; escena.add(aviso); }

  const jug = new Map(), objs = new Map(), trampas = [], bombas = [];
  let ultimoEv = 0, reloj = 0, sacudida = 0, camPos = new THREE.Vector3(0, 18, 20), camMira = new THREE.Vector3(), hablaHasta = 0;
  const coronaMesh = corona(); coronaMesh.visible = false; escena.add(coronaMesh);
  const npcDe = new Map();

  function armar(jugadores) {
    // jugadores: [{ id, npc, nombre, humano }]
    for (const j of jugadores) npcDe.set(j.id, j);
    return sumar(jugadores.map((j) => j.id));
  }
  async function sumar(ids) {
    const prom = [];
    for (const id of ids) {
      if (jug.has(id)) continue;
      const info = npcDe.get(id) || { npc: 'julo' };
      const base = POR_ID[info.npc]?.look || {};
      const look = { ...base, travesuras: {}, alBailar: null, alGesto: null };
      const p = crearPersona(THREE, look, { sombras: true, nombre: info.humano ? info.nombre : '', colorNombre: '#ffffff', tamCartel: .38, tamGlobo: .45 });
      const pivote = new THREE.Group(); pivote.add(p.grupo); escena.add(pivote);
      const aro = new THREE.Mesh(new THREE.RingGeometry(.38, .5, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75, depthWrite: false }));
      aro.rotation.x = -Math.PI / 2; aro.position.y = .03; pivote.add(aro);
      const flecha = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); flecha.rotation.x = Math.PI; flecha.position.y = 2.6; flecha.visible = false; pivote.add(flecha);
      const L = { id, info, look: base, p, pivote, aro, flecha, clave: '', t: 0, listo: false, decirT: 0, estrellas: 0 };
      prom.push(p.listo?.then(() => { L.listo = true; }));
      jug.set(id, L);
    }
    return Promise.all(prom.filter(Boolean));
  }
  function sacar(id) { const L = jug.get(id); if (!L) return; L.p.dispose?.(); L.pivote.removeFromParent(); jug.delete(id); }

  function hablar(id, situacion, semilla, prob = 1) {
    const L = jug.get(id);
    if (!L || !L.listo || reloj < hablaHasta || reloj < L.decirT) return;
    const r = rngNpc((semilla * 2654435761 + id.length * 31) >>> 0);
    if (r() > prob) return;
    const t = dicho(L.info.npc, situacion, 'alguien', r);
    if (t) { L.p.decir?.(t, 2.8); L.decirT = reloj + 7; hablaHasta = reloj + 2.2; }
  }

  const clip = (L, n, op) => L.p.clip?.(n, op);
  function animar(L, j, dt) {
    if (!L.listo || !L.p.clip) { L.p.animar?.(j.est === 'corre' ? 'corre' : 'quieto', dt); return; }
    const clave = j.est;
    const reinicio = clave !== L.clave || (['empuja', 'aturdido'].includes(clave) && j.t < L.t - .05);
    if (reinicio) {
      if (clave === 'quieto') clip(L, ['Short_Breathe_and_Look_Around', 'Idle_03'], { vez: false, fundido: .2 });
      else if (clave === 'corre') clip(L, ['Running'], { vez: false, dur: .62, fundido: .15 });
      else if (clave === 'carga') clip(L, ['Left_Hook_from_Guard'], { congelar: true, desde: .03, fundido: .1 });
      else if (clave === 'empuja') clip(L, ['Shield_Push_Left', 'Left_Hook_from_Guard'], { desde: .25, hasta: .55, dur: .3, fundido: .05 });
      else if (clave === 'agarra') clip(L, ['Shield_Push_Left'], { congelar: true, desde: .45, fundido: .1 });
      else if (clave === 'agarrado') clip(L, ['Unsteady_Walk', 'Shot_and_Blown_Back'], { vez: false, dur: .8, fundido: .1 });
      else if (clave === 'aturdido') clip(L, ['Shot_and_Blown_Back'], { desde: .02, hasta: .22, dur: .35, fundido: .05 });
      else if (clave === 'resbala') clip(L, ['Shot_and_Fall_Backward', 'Shot_and_Blown_Back'], { desde: .1, hasta: .45, dur: .7, fundido: .05 });
      else if (clave === 'salta') clip(L, ['Jump_Over_Obstacle', 'Run_and_Leap'], { desde: .3, hasta: .7, dur: .6, fundido: .06 });
      else if (clave === 'cae') clip(L, ['Shot_and_Fall_Backward', 'Shot_and_Blown_Back'], { desde: .1, hasta: .5, dur: 1.1, fundido: .05 });
      else if (clave === 'festeja') clip(L, [L.look?.clips?.festeja, L.look?.clips?.baila, 'Hip_Hop_Dance_4', 'Hop_with_Arms_Raised'].flat().filter(Boolean), { vez: false, fundido: .3 });
      else if (clave === 'triste') clip(L, ['Headache_Relief', 'Unsteady_Walk'], { vez: false, fundido: .3 });
      L.clave = clave;
    }
    L.t = j.t;
    L.p.animar('clip', dt);
    // cargando: tiembla un poco; cayendo: da vueltas
    const g = L.p.grupo;
    g.position.x = j.est === 'carga' ? (Math.random() - .5) * .04 * (1 + j.carga * 2) : 0;
    g.rotation.x = j.est === 'cae' ? Math.min(1.4, j.t * 2) : j.est === 'agarrado' ? .5 : 0;
  }

  function alEvento(ev, v) {
    const pos = (id) => { const L = jug.get(id); return L ? L.pivote.position : null; };
    if (ev.k === 'empujon') {
      const p = pos(ev.b); if (p) estallido(part, p.x, 1.1, { color: ev.guante ? '#ff4a3a' : '#fff3c4', color2: '#ffffff', n: ev.fuerte ? 26 : 12, vel: ev.fuerte ? 6 : 3.5, tam: ev.fuerte ? .32 : .2, vida: .35, z: p.z });
      sfx(ev.fuerte ? 'fuerte' : 'empujon'); if (ev.fuerte) sacudida = Math.max(sacudida, .18);
      const L = jug.get(ev.b); if (L) L.estrellas = .9;
    } else if (ev.k === 'aire') sfx('aire');
    else if (ev.k === 'agarra') sfx('agarra');
    else if (ev.k === 'revolea') { sfx('revolea'); hablar(ev.a, 'gana', ev.n, .35); }
    else if (ev.k === 'zafa') sfx('aire');
    else if (ev.k === 'salto') sfx('salto');
    else if (ev.k === 'borde') { sfx('cae'); hablar(ev.a, 'pierde', ev.n, .45); }
    else if (ev.k === 'tirada') { sfx('tirada'); hablar(ev.a, 'gana', ev.n, .5); }
    else if (ev.k === 'vuelve') { const p = pos(ev.a); if (p) estallido(part, p.x, 1, { color: '#ffffff', color2: '#c5f04a', n: 20, vel: 2, tam: .25, vida: .6, z: p.z }); }
    else if (ev.k === 'objeto') sfx('objeto');
    else if (ev.k === 'resbala') { sfx('resbala'); hablar(ev.a, 'pierde', ev.n, .6); }
    else if (ev.k === 'boom') { sfx('boom'); sacudida = .45; estallido(part, ev.x, .8, { color: '#ff7a1a', color2: '#ffd14a', n: 60, vel: 8, tam: .5, vida: .7, z: ev.z }); estallido(part, ev.x, .5, { color: '#3a3a3a', n: 30, vel: 3, tam: .9, vida: 1.4, aditivo: false, crece: 1.5, z: ev.z }); }
    else if (ev.k === 'arranca') sfx('arranca');
    else if (ev.k === 'achica') sfx('achica');
    else if (ev.k === 'fin') sfx('fin');
  }

  function actualizar(v, dt, { mios = [] } = {}) {
    reloj += dt;
    for (const fn of anim) fn(dt, reloj);
    part.actualizar(dt);
    if (!v) return render(dt);
    for (const ev of v.ev || []) if (ev.n > ultimoEv) { ultimoEv = ev.n; alEvento(ev, v); }
    // la plataforma se achica
    pista.scale.set(v.area, 1, v.area);
    if (pista.userData.borde) pista.userData.borde.scale.setScalar(1);
    const achicando = v.area < .999 && v.fase === 'juego';
    aviso.material.opacity = achicando ? .35 + Math.sin(reloj * 8) * .25 : 0;
    if (M.forma === 'circulo') aviso.scale.setScalar(v.area);
    // personajes
    const lid = v.jug.find((j) => j.corona);
    const vivos = new Set(v.jug.map((j) => j.id));
    for (const id of [...jug.keys()]) if (!vivos.has(id)) sacar(id);
    for (const j of v.jug) {
      const L = jug.get(j.id); if (!L) continue;
      const fuera = j.est === 'fuera';
      L.pivote.visible = !fuera;
      if (fuera) continue;
      const k = Math.min(1, dt * 22);
      L.pivote.position.x += (j.x - L.pivote.position.x) * k;
      L.pivote.position.z += (j.z - L.pivote.position.z) * k;
      L.pivote.position.y += (j.y - L.pivote.position.y) * k;
      const obj = Math.atan2(-Math.cos(j.ang), -Math.sin(j.ang));
      let d = obj - L.pivote.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      L.pivote.rotation.y += d * Math.min(1, dt * 16);
      const esc = L.p.grupo.scale.x + ((j.escala || 1) - L.p.grupo.scale.x) * Math.min(1, dt * 6);
      L.p.grupo.scale.setScalar(esc);
      L.aro.material.color.set(colorDe(j));
      L.aro.scale.setScalar(esc * (mios.includes(j.id) ? 1.2 + Math.sin(reloj * 8) * .06 : 1));
      L.aro.visible = j.y < .6;
      L.flecha.visible = mios.includes(j.id); L.flecha.position.y = 2.4 * esc + .2 + Math.sin(reloj * 6) * .08; L.flecha.material.color.set(colorDe(j));
      // invulnerable al volver: titila
      L.p.grupo.visible = !(j.invul && Math.sin(reloj * 30) > .3);
      animar(L, j, dt);
      // estrellitas de aturdido
      if (L.estrellas > 0 || j.est === 'aturdido' || j.est === 'resbala') {
        L.estrellas -= dt;
        if (Math.random() < .5) { const a = reloj * 8 + Math.random(); part.emitir({ x: L.pivote.position.x + Math.cos(a) * .35, y: L.pivote.position.y + 2 * esc, z: L.pivote.position.z + Math.sin(a) * .35, color: '#ffe14a', tam: .14, vida: .3 }); }
      }
      // guante: brilla rojo; cargando: brillo que crece
      if (j.guante && Math.random() < .4) part.emitir({ x: L.pivote.position.x, y: L.pivote.position.y + 1.2 * esc, z: L.pivote.position.z, vy: .5, color: '#ff4a3a', tam: .2, vida: .4 });
      if (j.est === 'carga' && Math.random() < .6) part.emitir({ x: L.pivote.position.x + (Math.random() - .5) * .6, y: L.pivote.position.y + .3 + Math.random() * 1.2 * esc, z: L.pivote.position.z, vy: 1.5, color: j.carga > .7 ? '#ff5a1a' : '#ffd27a', tam: .14 + j.carga * .12, vida: .35 });
      if (j.est === 'cae' && Math.random() < .5) part.emitir({ x: L.pivote.position.x, y: L.pivote.position.y + 1, z: L.pivote.position.z, vy: 3, color: '#ffffff', tam: .2, vida: .4, opacidad: .5 });
    }
    // corona sobre la cabeza del líder
    const LL = lid && jug.get(lid.id);
    coronaMesh.visible = !!LL && LL.pivote.visible && lid.est !== 'cae';
    if (LL) {
      const cab = LL.p.cabeza.getWorldPosition(new THREE.Vector3());
      coronaMesh.position.set(cab.x, cab.y + .28 * (lid.escala || 1), cab.z); coronaMesh.rotation.y += dt * 1.5; coronaMesh.scale.setScalar(lid.escala || 1);
    }
    // objetos
    const hay = new Set();
    for (const o of v.objetos || []) {
      hay.add(o.id);
      let g = objs.get(o.id);
      if (!g) { g = crearObjeto(o.tipo); escena.add(g); objs.set(o.id, g); estallido(part, o.x, .6, { color: '#ffffff', n: 14, vel: 2, tam: .2, vida: .4, z: o.z }); }
      g.position.set(o.x, .55 + Math.sin(reloj * 3 + o.id) * .12, o.z); g.rotation.y += dt * 2;
    }
    for (const [id, g] of objs) if (!hay.has(id)) { g.removeFromParent(); objs.delete(id); }
    // cáscaras y bombas (se rearman cada cuadro: son pocas)
    while (trampas.length < (v.trampas || []).length) { const g = crearObjeto('banana'); g.scale.setScalar(.8); escena.add(g); trampas.push(g); }
    trampas.forEach((g, i) => { const t = v.trampas?.[i]; g.visible = !!t; if (t) g.position.set(t.x, .08, t.z); });
    while (bombas.length < (v.bombas || []).length) { const g = crearObjeto('bomba'); escena.add(g); bombas.push(g); }
    bombas.forEach((g, i) => { const b = v.bombas?.[i]; g.visible = !!b; if (b) { g.position.set(b.x, .3, b.z); const s = 1 + (1.5 - b.t) * .25 + Math.sin(reloj * 30) * .05; g.scale.setScalar(s); if (Math.random() < .7) part.emitir({ x: b.x, y: .8, z: b.z, vy: 1.5, color: '#ffcf4a', tam: .1, vida: .2 }); } });
    camaraSigue(v, dt, mios);
    render(dt);
  }

  function camaraSigue(v, dt, mios) {
    // vista de arriba en diagonal; se acerca un poco a tu jugador
    const tam = M.forma === 'circulo' ? M.radio * 2 : Math.max(M.ancho, M.largo * 1.6);
    const yo = v.jug.find((j) => mios.includes(j.id) && j.est !== 'fuera');
    // un poco hacia donde está la acción (el promedio de todos) y un poco hacia vos
    const en = v.jug.filter((j) => j.est !== 'fuera' && j.est !== 'cae');
    const mx = en.length ? en.reduce((a, j) => a + j.x, 0) / en.length : 0, mz = en.length ? en.reduce((a, j) => a + j.z, 0) / en.length : 0;
    const cx = (yo ? yo.x * .35 : 0) + mx * .25, cz = (yo ? yo.z * .3 : 0) + mz * .2;
    const d = tam * .6 * (.75 + v.area * .25);
    const pos = new THREE.Vector3(cx, d * .78, cz + d * .82);
    const mira = new THREE.Vector3(cx, 0, cz + .5);
    const k = Math.min(1, dt * 2.5);
    camPos.lerp(pos, k); camMira.lerp(mira, k);
  }
  function render(dt) {
    const w = lienzoCanvas.clientWidth, h = lienzoCanvas.clientHeight;
    if (w && h && (lienzoCanvas.width !== Math.round(w * renderer.getPixelRatio()) || lienzoCanvas.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); }
    sacudida = Math.max(0, sacudida - dt);
    const angosto = Math.max(1, 1.45 / Math.max(.5, camara.aspect));
    const dir = camPos.clone().sub(camMira).multiplyScalar(angosto - 1);
    camara.position.copy(camPos).add(dir).add(new THREE.Vector3((Math.random() - .5) * sacudida, (Math.random() - .5) * sacudida, 0));
    camara.lookAt(camMira);
    renderer.render(escena, camara);
  }

  return { armar, sumar, sacar, actualizar, renderer, escena, camara, destruir() { for (const L of jug.values()) L.p.dispose?.(); part.destruir(); renderer.dispose(); } };
}
