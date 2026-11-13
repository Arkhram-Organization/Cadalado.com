// Dibujo de Piña Final: los personajes 3D del club peleando de costado (2D), con cámara que sigue la pelea,
// armas en la mano, poderes, chispas y los remates. Recibe una "vista" (ver combate.js) en cada cuadro.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { POR_ID, rngNpc } from '/comun/npcs.js';
import { dicho } from '/comun/dichos.js';
import { ELEMENTOS, ATAQUES } from './motor.js';
import { crearArma, crearPoder, crearParticulas, estallido, halo } from './objetos3d.js';
import { construirEscenario } from './escenarios.js';
import { sfx } from './sonido.js';

export const COLOR_EQ = ['#ff5a4a', '#4aa8ff'];

// Animación de cada golpe: lista de clips (el primero que tenga el modelo) y qué parte del clip se usa.
const CLIP_ATK = {
  pina1: { n: ['Left_Hook_from_Guard'], desde: .05, hasta: .62 },
  pina2: { n: ['Punch_Combo', 'Punch_Combo_1'], desde: .06, hasta: .3 },
  pina3: { n: ['Elbow_Strike', 'Jumping_Punch'], desde: .12, hasta: .5 },
  patada: { n: ['Boxing_Guard_Right_Straight_Kick', 'Spartan_Kick', 'Step_in_High_Kick'], desde: .08, hasta: .78 },
  gancho: { n: ['Jumping_Punch', 'Left_Hook_from_Guard'], desde: .2, hasta: .62 },
  barrida: { n: ['Sweeping_Kick', 'Sweep_Kick'], desde: .1, hasta: .7 },
  aerea: { n: ['Rising_Flying_Kick', 'Jumping_Punch'], desde: .25, hasta: .75 },
  poder: { n: ['Shield_Push_Left'], desde: .1, hasta: .55 },
  poderNinja: { n: ['Crouch_Pull_and_Throw', 'Shield_Push_Left'], desde: .32, hasta: .5 },
  super: { n: ['Shield_Push_Left'], desde: 0, hasta: .6 },
  remata: { n: ['Shield_Push_Left'], desde: .05, hasta: .9 },
  arma_katana: { n: ['Right_Hand_Sword_Slash', 'Charged_Upward_Slash'], desde: .08, hasta: .7 },
  arma_hacha: { n: ['Right_Hand_Sword_Slash'], desde: 0, hasta: .72 },
  arma_martillo: { n: ['Right_Hand_Sword_Slash'], desde: 0, hasta: .75 },
  arma_nunchaku: { n: ['Right_Hand_Sword_Slash'], desde: .1, hasta: .7 },
};
const GUARDIA = ['Left_Hook_from_Guard'];
const AGACHA = ['Crouch_Walk_Left_with_Gun_inplace', 'Crouch_Walk_Left_with_Gun'];

export function crearEscena(lienzo, { escenario = 'templo', calidad = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5 * calidad));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(34, 16 / 9, .1, 200);
  camara.position.set(0, 2, 10);
  const part = crearParticulas(escena);
  const esc = construirEscenario(escenario, escena, part);
  const [cAmb, cSuelo, iAmb] = esc.luzAmbiente;
  escena.add(new THREE.HemisphereLight(cAmb, cSuelo, iAmb));
  const clave = new THREE.DirectionalLight(esc.luzClave[0], esc.luzClave[1]);
  clave.position.set(-4, 9, 7); clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 1024);
  Object.assign(clave.shadow.camera, { left: -12, right: 12, top: 6, bottom: -2, near: 1, far: 30 });
  escena.add(clave, clave.target);
  if (esc.exposicion) renderer.toneMappingExposure = esc.exposicion;
  const borde = new THREE.DirectionalLight(esc.luzBorde, 1.6); borde.position.set(3, 4, -6); escena.add(borde);

  const luch = new Map(); // id → datos del dibujo
  const proy = new Map();
  let introT = 0, ultimoEv = 0, reloj = 0, sacudida = 0, destello = 0, camX = 0, camDist = 10, camY = 1.9, remateFx = null;
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  flash.renderOrder = 999; flash.frustumCulled = false;
  camara.add(flash); flash.position.z = -.2; escena.add(camara);

  // ---------------- personajes
  function ponerLuchadores(lista, { carteles = false } = {}) {
    for (const L of luch.values()) { L.p.dispose(); L.extra.removeFromParent(); }
    luch.clear();
    lista.forEach((l, i) => {
      const base = POR_ID[l.npc]?.look || {};
      const look = { ...base, travesuras: {}, alBailar: null, alGesto: null, contagia: false };
      const etiqueta = carteles && l.jugador && l.jugador !== 'bot' ? (l.jugador.length > 10 ? l.jugador.slice(0, 9) + '…' : l.jugador) : '';
      const p = crearPersona(THREE, look, { sombras: true, nombre: etiqueta, colorNombre: COLOR_EQ[l.eq], tamCartel: .34, tamGlobo: .42 });
      p.grupo.position.set(l.eq ? 3 : -3, 0, 0);
      escena.add(p.grupo);
      const extra = new THREE.Group(); escena.add(extra);
      // escudo de guardia (burbuja del color del elemento)
      const escudo = new THREE.Mesh(new THREE.SphereGeometry(.62, 24, 16, 0, Math.PI * 2, 0, Math.PI * .62), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      escudo.rotation.z = Math.PI / 2; extra.add(escudo);
      const hielo = new THREE.Mesh(new THREE.BoxGeometry(1, 2.05, .9), new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: .5, roughness: .05, metalness: .1, emissive: '#2a7fb0', emissiveIntensity: .4 }));
      hielo.visible = false; hielo.position.y = 1.02; extra.add(hielo);
      const aura = halo('#fff', 2.4, 0); aura.position.y = 1; extra.add(aura);
      // aro del color del equipo en el piso (se ve quién es quién en el 2v2)
      const aro = new THREE.Mesh(new THREE.RingGeometry(.42, .52, 32), new THREE.MeshBasicMaterial({ color: COLOR_EQ[l.eq], transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
      aro.rotation.x = -Math.PI / 2; aro.position.y = .02; extra.add(aro);
      const L = { l, p, extra, escudo, hielo, aura, aro, frasesT: 2 + Math.random() * 3, decirT: 0, arma: null, armaTipo: '', armaElem: '', clave: '', atk: null, atkT: 0, t: 0, est: '', rotY: l.eq ? Math.PI / 2 : -Math.PI / 2, materiales: [], golpeFlash: 0, z: 0, listo: false, emitir: 0 };
      L.z = (lista.filter((o, k) => k < i && o.eq === l.eq).length) * -.55;
      p.listo?.then(() => {
        // materiales propios (los del modelo son compartidos): así se pueden teñir al pegarle
        p.grupo.traverse((o) => {
          if (!o.isMesh || o.userData.propio) return;
          o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
          for (const m of [].concat(o.material)) if (m.color) L.materiales.push({ m, color: m.color.clone(), emissive: m.emissive?.clone() });
        });
        L.listo = true;
      });
      luch.set(l.id, L);
    });
    return Promise.all([...luch.values()].map((L) => L.p.listo).filter(Boolean));
  }

  function ponerArma(L, f) {
    if (L.armaTipo === f.arma && L.armaElem === f.elem) return;
    L.arma?.removeFromParent();
    L.arma = crearArma(f.arma, f.elem);
    L.arma.scale.setScalar(0);
    // la mano: -Z sigue los dedos; el mango se cruza en el puño y la hoja sale hacia adelante y arriba
    L.arma.rotation.set(Math.PI / 2, 0, 0);
    L.arma.position.set(0, -.02, -.07);
    L.p.manos.derecha.add(L.arma);
    L.armaTipo = f.arma; L.armaElem = f.elem;
  }

  const clipDe = (L, nombre, op) => L.p.clip?.(nombre, op);
  function animarLuchador(L, f, dt, vista) {
    const p = L.p;
    if (!p.clip) { p.animar(f.atk ? 'pina' : f.est === 'camina' ? 'camina' : f.est === 'muerto' ? 'muerto' : 'quieto', dt); return; }
    if (!L.listo) { p.animar('clip', dt); return; }
    if (f.atk) {
      const reinicio = f.atk !== L.atk || f.atkT < L.atkT - .03;
      L.atk = f.atk; L.atkT = f.atkT;
      if (reinicio) {
        const def = ATAQUES[f.atk];
        const total = def.ini + def.act + def.rec;
        let spec = CLIP_ATK[f.atk] || CLIP_ATK.pina1;
        if (f.atk === 'poder' && f.elem === 'sombra') spec = CLIP_ATK.poderNinja;
        const propio = f.atk === 'patada' ? L.l.look?.clips?.patada : null;
        const nombres = propio ? [propio, ...spec.n] : spec.n;
        const k = Math.min(.9, f.atkT / total);
        const dur = f.atk === 'remata' ? 1.2 : Math.max(.08, total - f.atkT);
        clipDe(L, nombres, { dur, desde: spec.desde + (spec.hasta - spec.desde) * k, hasta: spec.hasta, fundido: .05 });
        L.clave = 'atk';
        if (def.arma) ponerArma(L, f);
      }
    } else {
      L.atk = null;
      const reinicio = f.est !== L.est || f.t < L.t - .05;
      L.est = f.est;
      if (reinicio) {
        const e = f.est;
        if (e === 'quieto') clipDe(L, GUARDIA, { vez: false, ida: true, desde: 0, hasta: .1, dur: .9, fundido: .15 });
        else if (e === 'camina') clipDe(L, ['Walking'], { vez: false, dur: .9, fundido: .12 });
        else if (e === 'atras') clipDe(L, ['Walk_Backward', 'Walk_Backward_inplace'], { vez: false, dur: .95, fundido: .12 });
        else if (e === 'agacha' || e === 'guardia_baja') clipDe(L, AGACHA, { congelar: true, desde: .05, fundido: .08 });
        else if (e === 'guardia') clipDe(L, GUARDIA, { congelar: true, desde: .02, fundido: .06 });
        else if (e === 'salto') clipDe(L, Math.abs(f.vx) > .5 ? ['Wall_Push_Jump_and_Flip', 'Jump_Over_Obstacle'] : ['Jump_Over_Obstacle'], Math.abs(f.vx) > .5 ? { desde: .3, hasta: .75, dur: .72, fundido: .06 } : { desde: .32, hasta: .62, dur: .72, fundido: .06 });
        else if (e === 'golpe') clipDe(L, ['Shot_and_Blown_Back'], { desde: .02, hasta: .2, dur: .38, fundido: .04 });
        else if (e === 'electro' || e === 'congelado') clipDe(L, ['Shot_and_Blown_Back'], { desde: .05, hasta: .12, dur: .3, fundido: .04 });
        else if (e === 'lanzado') clipDe(L, ['Shot_and_Fall_Backward', 'Shot_and_Blown_Back'], { desde: .12, hasta: .55, dur: .9, fundido: .05 });
        else if (e === 'caido') clipDe(L, ['Knock_Down', 'Shot_and_Fall_Backward'], { desde: .42, hasta: .82, dur: .7, fundido: .06 });
        else if (e === 'levanta') clipDe(L, ['Wake_Up_and_Look_Up'], { desde: .42, hasta: .8, dur: .45, fundido: .08 });
        else if (e === 'muerto') clipDe(L, ['dying_backwards', 'Shot_and_Fall_Backward'], L.clave === 'lanzado' || L.clave === 'caido' ? { congelar: true, desde: .99, fundido: .3 } : { desde: .2, hasta: 1, dur: 1.1, fundido: .08 });
        else if (e === 'mareado' || e === 'derrota') clipDe(L, ['Headache_Relief', 'Unsteady_Walk', 'Mummy_Stagger'], { vez: false, dur: 3.2, fundido: .3 });
        else if (e === 'rematado') { /* sigue mareado: el remate lo mueve */ }
        else if (e === 'festeja') clipDe(L, [L.l.look?.clips?.festeja, 'Show_Both_Arm_Muscles', 'Cheer_with_Both_Hands', 'Hop_with_Arms_Raised'].filter(Boolean).flat(), { vez: false, fundido: .3 });
        L.clave = e;
      }
    }
    L.t = f.t;
    // congelado: el cuerpo queda duro
    p.animar('clip', f.est === 'congelado' ? 0 : dt);
  }

  // ---------------- frases de cada personaje (las mismas en todas las pantallas: salen de una semilla)
  let hablaHasta = 0;
  function hablar(id, situacion, semilla, prob = 1, todos = false) {
    const L = luch.get(id);
    if (!L || !L.listo || reloj < L.decirT || (!todos && reloj < hablaHasta)) return;
    const r = rngNpc((semilla * 2654435761 + id.length * 97 + id.charCodeAt(0)) >>> 0);
    if (r() > prob) return;
    const texto = dicho(L.l.npc, situacion, L.l.jugador && L.l.jugador !== 'bot' ? L.l.jugador : 'alguien', r);
    if (!texto) return;
    L.p.decir?.(texto, 3.2);
    L.decirT = reloj + 6; hablaHasta = reloj + 3.4; // de a uno, así los globos no se pisan
  }

  // ---------------- efectos de los avisos del motor
  function alEvento(ev, vista) {
    if (ev.k === 'golpe' && ev.fuerte) { esc.vitorear?.(.6); hablar(ev.a, 'gana', ev.n, .35); hablar(ev.b, 'pierde', ev.n + 1, .2); }
    if (ev.k === 'cae') hablar(ev.a, 'pierde', ev.n, .45);
    if (ev.k === 'ko') { esc.vitorear?.(1.2); }
    if (ev.k === 'remate') esc.vitorear?.(1.5);
    if (ev.k === 'fin' && ev.ganador != null) for (const f of vista.luch) hablar(f.id, f.eq === ev.ganador ? 'gana' : 'pierde', ev.n + f.id.length, f.eq === ev.ganador ? 1 : .6, true);
    if (ev.k === 'poder') hablar(ev.a, 'turno', ev.n, .12);
    const quien = (id) => vista.luch.find((f) => f.id === id);
    if (ev.k === 'golpe' || ev.k === 'bloqueo') {
      const E = ev.elem ? ELEMENTOS[ev.elem] : null;
      if (ev.k === 'bloqueo') {
        estallido(part, ev.x, ev.y, { color: '#bfe6ff', color2: '#ffffff', n: 10, vel: 3, tam: .16, vida: .25 });
        const L = luch.get(ev.b); if (L) L.escudo.material.opacity = .75;
        sfx('bloqueo');
      } else {
        estallido(part, ev.x, ev.y, { color: E ? E.color : '#fff3c4', color2: E ? E.color2 : '#ffffff', n: ev.fuerte ? 22 : 12, vel: ev.fuerte ? 6 : 4, tam: ev.fuerte ? .3 : .2, vida: .3 });
        // sangre (estilo caricatura: gotitas que caen)
        if (localStorage.getItem('pelea.sangre') !== 'no') estallido(part, ev.x, ev.y, { color: '#b3001b', n: ev.fuerte ? 14 : 6, vel: 3.2, tam: .09, vida: .9, g: 12, aditivo: false, roce: .99 });
        const L = luch.get(ev.b); if (L) L.golpeFlash = .14;
        sfx(ev.atk === 'arma' ? 'corte' : ev.fuerte ? 'golpeFuerte' : 'golpe');
        if (ev.fuerte) { sacudida = Math.max(sacudida, .22); }
        if (E && ev.atk === 'poder') sfx('impacto_' + ev.elem);
      }
    } else if (ev.k === 'ataque') {
      sfx(ev.atk.startsWith('arma') ? 'zumbidoArma' : ['patada', 'barrida', 'aerea'].includes(ev.atk) ? 'zumbidoPatada' : ['pina1', 'pina2', 'pina3', 'gancho'].includes(ev.atk) ? 'zumbido' : '');
      if (ev.atk === 'super') { destello = .5; sfx('super'); const f = quien(ev.a); if (f) estallido(part, f.x, 1.2, { color: ELEMENTOS[f.elem].color, color2: '#fff', n: 40, vel: 5, tam: .35, vida: .6 }); }
    } else if (ev.k === 'poder') {
      sfx('poder_' + ev.elem);
    } else if (ev.k === 'choque') {
      estallido(part, ev.x, ev.y, { color: ELEMENTOS[ev.elem]?.color, color2: ELEMENTOS[ev.elem2]?.color, n: 36, vel: 6, tam: .35, vida: .5 });
      sacudida = .3; sfx('choque');
    } else if (ev.k === 'rompe') {
      estallido(part, ev.x, .2, { color: '#8a6a4a', n: 16, vel: 3, tam: .25, vida: .6, g: 6, aditivo: false });
      sfx('cae');
    } else if (ev.k === 'cae') {
      for (let i = 0; i < 14; i++) part.emitir({ x: ev.x + (Math.random() - .5) * .8, y: .1, z: (Math.random() - .5) * .6, vx: (Math.random() - .5) * 2.5, vy: Math.random() * .8, color: '#9a8f80', tam: .5, vida: .8, crece: 1.2, aditivo: false, opacidad: .45 });
      sfx('cae'); sacudida = Math.max(sacudida, .12);
    } else if (ev.k === 'ko') {
      destello = .45; sacudida = .35; sfx('ko');
    } else if (ev.k === 'salto') sfx('salto');
    else if (ev.k === 'remate') { remateFx = { ...ev, t: 0, hecho: {} }; sfx('remate_' + ev.elem); }
  }

  // ---------------- remates: cada elemento termina distinto
  function animarRemate(dt, vista) {
    if (!remateFx || !vista.remate) return;
    const r = remateFx; r.t = vista.remate.t;
    const V = luch.get(r.b), A = luch.get(r.a);
    if (!V) return;
    const vf = vista.luch.find((f) => f.id === r.b);
    const x = vf?.x ?? V.p.grupo.position.x;
    const E = ELEMENTOS[r.elem];
    const una = (k, fn) => { if (!r.hecho[k]) { r.hecho[k] = true; fn(); } };
    const teñir = (color, k) => { for (const { m, color: c0 } of V.materiales) m.color.copy(c0).lerp(new THREE.Color(color), k); };
    if (r.elem === 'fuego') {
      for (let i = 0; i < 6; i++) part.emitir({ x: x + (Math.random() - .5) * .7, y: Math.random() * .4, z: (Math.random() - .5) * .5, vy: 2.5 + Math.random() * 3, vx: (Math.random() - .5) * .6, color: Math.random() < .5 ? '#ff6a1f' : '#ffd23f', tam: .55, vida: .7, crece: -.4 });
      teñir('#120804', Math.min(1, r.t / 1.6));
      if (r.t > 1.8) una('cae', () => { clipDe(V, ['dying_backwards'], { desde: .2, dur: .9 }); sfx('cae'); });
    } else if (r.elem === 'hielo') {
      V.hielo.visible = r.t < 1.6;
      V.hielo.scale.setScalar(Math.min(1, r.t * 2.5));
      if (r.t < 1.6) V.p.animar('clip', 0);
      if (r.t > 1.6) una('rompe', () => {
        V.p.grupo.visible = false;
        estallido(part, x, 1, { color: '#bfefff', color2: '#ffffff', n: 60, vel: 7, tam: .3, vida: 1.2, g: 9, aditivo: false });
        estallido(part, x, 1, { color: '#7fdcff', n: 30, vel: 4, tam: .5, vida: .6 });
        sacudida = .4; sfx('rompeHielo');
      });
    } else if (r.elem === 'rayo') {
      if (Math.floor(r.t * 5) !== r.ultimo && r.t < 2) {
        r.ultimo = Math.floor(r.t * 5);
        const g = new THREE.BufferGeometry(); const pts = [];
        let px = x, py = 9;
        while (py > 1) { pts.push(px, py, 0); px += (Math.random() - .5) * .9; py -= .6 + Math.random() * .6; }
        pts.push(x, 1, 0);
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const linea = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fffbd0', transparent: true, blending: THREE.AdditiveBlending }));
        escena.add(linea); setTimeout(() => { linea.removeFromParent(); g.dispose(); }, 120);
        destello = .25; sfx('impacto_rayo');
        estallido(part, x, 1.1, { color: '#ffe94a', color2: '#fff', n: 14, vel: 5, tam: .25, vida: .3 });
      }
      teñir('#1a1a1a', Math.min(.85, r.t / 2.2));
      V.p.grupo.position.x = x + (r.t < 2 ? (Math.random() - .5) * .08 : 0);
      if (r.t > 2.1) una('cae', () => clipDe(V, ['dying_backwards'], { desde: .2, dur: .9 }));
    } else if (r.elem === 'veneno') {
      for (let i = 0; i < 3; i++) part.emitir({ x: x + (Math.random() - .5) * .8, y: .1 + Math.random() * 1.5 * Math.max(0, 1 - r.t / 2.4), z: (Math.random() - .5) * .4, vy: .6 + Math.random(), color: Math.random() < .5 ? '#5dff4a' : '#b6ff6a', tam: .3, vida: .9, crece: .6 });
      V.p.grupo.scale.y = Math.max(.04, 1 - Math.max(0, r.t - .4) / 2);
      V.p.grupo.scale.x = V.p.grupo.scale.z = 1 + Math.max(0, r.t - .4) * .25;
      teñir('#2a7a10', Math.min(.8, r.t / 1.5));
      una('charco', () => {
        const ch = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: '#3fbf2a', emissive: '#1f6a10', roughness: .1, transparent: true, opacity: .85 }));
        ch.rotation.x = -Math.PI / 2; ch.position.set(x, .02, 0); ch.scale.setScalar(.01); escena.add(ch); r.charco = ch; V.extra.add(ch); ch.position.set(0, .02, 0);
      });
      if (r.charco) r.charco.scale.setScalar(Math.min(1.1, r.t / 2));
    } else if (r.elem === 'sombra') {
      if (r.t < 1.8 && Math.random() < .5) {
        const s = crearPoder('sombra'); const a = Math.random() * Math.PI * 2;
        s.grupo.position.set(x + Math.cos(a) * 6, 1 + Math.sin(a) * 3, 0); escena.add(s.grupo);
        r.estrellas = (r.estrellas || []).concat({ s, a, t: 0 });
      }
      for (const e of r.estrellas || []) {
        e.t += dt; e.s.actualizar(dt);
        const k = Math.min(1, e.t / .3);
        e.s.grupo.position.set(x + Math.cos(e.a) * 6 * (1 - k), 1 + Math.sin(e.a) * 3 * (1 - k) + .1, 0);
        if (k >= 1 && !e.ya) { e.ya = true; estallido(part, x, 1.1, { color: '#b3001b', n: 5, vel: 3, tam: .1, vida: .8, g: 10, aditivo: false }); sfx('corte'); setTimeout(() => e.s.grupo.removeFromParent(), 200); }
      }
      if (r.t > 2) una('cae', () => clipDe(V, ['dying_backwards'], { desde: .2, dur: .9 }));
    } else if (r.elem === 'tierra') {
      una('roca', () => {
        r.roca = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: '#7d5a3a', roughness: 1, flatShading: true }));
        r.roca.castShadow = true; escena.add(r.roca);
      });
      const k = Math.min(1, r.t / 1.1);
      r.roca.position.set(x, 14 - k * k * 12.6, 0); r.roca.rotation.z += dt * 4;
      if (k >= 1) una('pum', () => {
        V.p.grupo.scale.set(1.5, .12, 1.5); sacudida = .7; destello = .3; sfx('aplasta');
        estallido(part, x, .3, { color: '#8a6a4a', n: 40, vel: 6, tam: .5, vida: 1, g: 6, aditivo: false });
        estallido(part, x, .3, { color: '#b3001b', n: 18, vel: 5, tam: .12, vida: 1, g: 12, aditivo: false });
      });
    } else if (r.elem === 'viento') {
      una('tornado', () => { r.tor = crearPoder('viento', true); r.tor.grupo.scale.set(1.6, 2.4, 1.6); escena.add(r.tor.grupo); });
      r.tor.actualizar(dt); r.tor.grupo.position.set(x, 1.4, 0);
      const sube = Math.max(0, r.t - .6);
      V.p.grupo.position.y = sube * sube * 3.5;
      V.p.grupo.rotation.y += dt * (6 + sube * 20);
      if (V.p.grupo.position.y > 14) V.p.grupo.visible = false;
      for (let i = 0; i < 3; i++) part.emitir({ x: x + (Math.random() - .5) * 2, y: Math.random() * 3, z: (Math.random() - .5), vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, color: '#dffcf4', tam: .35, vida: .6, opacidad: .6 });
    }
    // el que remata: brillo del elemento
    if (A) { A.aura.material.color.set(E.color); A.aura.material.opacity = .5 + Math.sin(r.t * 20) * .15; }
  }

  // ---------------- cada cuadro
  function actualizar(vista, dt) {
    reloj += dt;
    for (const fn of esc.anim) fn(dt, reloj);
    part.actualizar(dt);
    if (!vista) return render(dt);
    // avisos nuevos
    for (const ev of vista.ev || []) if (ev.n > ultimoEv) { ultimoEv = ev.n; alEvento(ev, vista); }
    // personajes
    for (const f of vista.luch) {
      const L = luch.get(f.id);
      if (!L) continue;
      const g = L.p.grupo;
      const rematado = vista.remate && vista.remate.a === f.id;
      if (!rematado || !['viento'].includes(vista.remate.elem)) {
        g.position.x += (f.x - g.position.x) * Math.min(1, dt * 25);
        g.position.y += (f.y - g.position.y) * Math.min(1, dt * 25);
      }
      g.position.z = L.z;
      const objetivo = f.mira > 0 ? -(Math.PI / 2 + .32) : Math.PI / 2 + .32; // de costado, un poco hacia la cámara
      if (!rematado || vista.remate.elem !== 'viento') {
        let d = objetivo - L.rotY; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        L.rotY += d * Math.min(1, dt * 14); g.rotation.y = L.rotY;
      }
      animarLuchador(L, f, dt, vista);
      // de vez en cuando, en plena pelea, tiran su frase de siempre
      if (vista.fase === 'intro' && !L.saludo && L.listo && reloj - introT > .4 + L.l.eq * .9) { L.saludo = true; hablar(f.id, 'saludo', vista.ronda * 31 + L.l.eq, L.l.eq === 0 || luch.size <= 2 ? 1 : .5); }
      if (vista.fase === 'pelea' && !f.ko) { L.frasesT -= dt; if (L.frasesT <= 0) { L.frasesT = 7 + ((f.id.charCodeAt(0) * 13 + Math.floor(vista.tiempo)) % 9); hablar(f.id, 'turno', Math.floor(vista.tiempo) * 7 + f.id.length, .45); } }
      // arma: aparece al usarla y se guarda después
      const usaArma = f.atk && f.atk.startsWith('arma_');
      if (L.arma) {
        const s = L.arma.scale.x + ((usaArma || f.est === 'festeja' ? 1 : 0) - L.arma.scale.x) * Math.min(1, dt * (usaArma ? 30 : 6));
        L.arma.scale.setScalar(s);
        if (L.arma.userData.cadena) L.arma.userData.cadena.rotation.z = Math.sin(reloj * 25) * (usaArma ? 1.2 : .2);
        if (usaArma && s > .5 && Math.random() < .8) {
          const pos = L.arma.getWorldPosition(new THREE.Vector3());
          const E = ELEMENTOS[f.elem];
          part.emitir({ x: pos.x + (Math.random() - .5) * .3, y: pos.y + Math.random() * .4, z: pos.z, color: Math.random() < .5 ? E.color : E.color2, tam: .22, vida: .3, vy: .4 });
        }
      } else if (usaArma || f.est === 'festeja') ponerArma(L, f);
      // escudo
      const cubre = f.est === 'guardia' || f.est === 'guardia_baja';
      L.escudo.position.set(g.position.x + f.mira * .32, g.position.y + (f.est === 'guardia_baja' ? .6 : 1.05), L.z);
      L.escudo.rotation.set(0, f.mira > 0 ? 0 : Math.PI, Math.PI / 2);
      L.escudo.material.color.set(ELEMENTOS[f.elem]?.color || '#9fd8ff');
      L.escudo.material.opacity += ((cubre ? .28 : 0) - L.escudo.material.opacity) * Math.min(1, dt * 12);
      // estados: congelado, quemado, envenenado, electrocutado, súper listo
      L.extra.position.set(g.position.x, g.position.y, L.z);
      L.escudo.position.x -= L.extra.position.x; L.escudo.position.y -= L.extra.position.y; L.escudo.position.z = 0;
      if (!rematado || vista.remate.elem !== 'hielo') L.hielo.visible = f.est === 'congelado';
      L.emitir += dt;
      if (L.emitir > .05) {
        L.emitir = 0;
        if (f.quema) part.emitir({ x: g.position.x + (Math.random() - .5) * .5, y: g.position.y + .3 + Math.random() * 1.3, z: L.z + .2, vy: 1.6, color: Math.random() < .5 ? '#ff6a1f' : '#ffd23f', tam: .3, vida: .4, crece: -.5 });
        if (f.veneno) part.emitir({ x: g.position.x + (Math.random() - .5) * .5, y: g.position.y + .3 + Math.random() * 1.3, z: L.z + .2, vy: .5, color: '#5dff4a', tam: .22, vida: .7, crece: .5 });
        if (f.est === 'electro') estallido(part, g.position.x, g.position.y + .5 + Math.random(), { color: '#ffe94a', color2: '#fff', n: 3, vel: 3, tam: .12, vida: .15 });
      }
      if (f.est === 'electro') g.position.x += (Math.random() - .5) * .06;
      if (!(vista.remate && vista.remate.de === f.id)) {
        const listo = f.ene >= 100 && !f.ko;
        L.aura.material.color.set(ELEMENTOS[f.elem]?.color || '#fff');
        L.aura.material.opacity += ((listo ? .22 + Math.sin(reloj * 8) * .08 : 0) - L.aura.material.opacity) * Math.min(1, dt * 6);
      }
      // destello rojo al recibir un golpe
      if (L.golpeFlash > 0 || L.flashPrendido) {
        L.golpeFlash -= dt;
        const on = L.golpeFlash > 0;
        for (const { m, emissive } of L.materiales) if (m.emissive) { on ? m.emissive.set('#ff2a1a').multiplyScalar(.22) : m.emissive.copy(emissive); }
        L.flashPrendido = on;
      }
    }
    // poderes
    const vivos = new Set();
    for (const p of vista.proy || []) {
      vivos.add(p.id);
      let P = proy.get(p.id);
      if (!P) {
        P = crearPoder(p.elem, p.grande);
        escena.add(P.grupo); proy.set(p.id, P);
        P.grupo.position.set(p.x, p.y, 0);
      }
      const dir = (p.vx ?? p.dir ?? 1) >= 0 ? 1 : -1;
      P.grupo.position.x += (p.x - P.grupo.position.x) * Math.min(1, dt * 30);
      P.grupo.position.y += (p.y - P.grupo.position.y) * Math.min(1, dt * 30);
      P.grupo.scale.x = Math.abs(P.grupo.scale.x) * dir;
      P.actualizar(dt, p);
      // estela
      const E = ELEMENTOS[p.elem];
      if (Math.random() < .9) part.emitir({ x: P.grupo.position.x - dir * .1, y: P.grupo.position.y + (Math.random() - .5) * .2, z: (Math.random() - .5) * .2, vx: -dir * .6, vy: E.poder === 'bola' ? .5 : 0, color: Math.random() < .5 ? E.color : E.color2, tam: (p.grande ? .5 : .26) * (E.poder === 'shuriken' ? .5 : 1), vida: .3, crece: -.3 });
    }
    for (const [id, P] of proy) if (!vivos.has(id)) {
      const E = ELEMENTOS[[...Object.keys(ELEMENTOS)].find((k) => P.grupo.userData.elem === k)] || null;
      estallido(part, P.grupo.position.x, P.grupo.position.y, { color: E?.color || '#fff', n: 8, vel: 2.5, tam: .2, vida: .3 });
      P.grupo.removeFromParent(); proy.delete(id);
    }
    animarRemate(dt, vista);
    camaraSigue(vista, dt);
    render(dt);
  }

  function camaraSigue(vista, dt) {
    const fs = vista.luch.filter((f) => !(vista.remate && vista.remate.elem === 'viento' && f.id === vista.remate.a));
    let min = Infinity, max = -Infinity;
    for (const f of fs) { min = Math.min(min, f.x); max = Math.max(max, f.x); }
    if (!fs.length) { min = -2; max = 2; }
    let cx = (min + max) / 2, dist = Math.max(7.2, Math.min(13.5, 5.2 + (max - min) * .85)), cy = 1.75;
    if (vista.fase === 'intro') { const k = Math.min(1, (reloj - introT) / 2.4); const e = 1 - (1 - k) ** 3; dist += (1 - e) * 7; cy += (1 - e) * 2.6; cx += (1 - e) * 4; }
    if (vista.remate) {
      const v = vista.luch.find((f) => f.id === vista.remate.a);
      if (v) { cx = v.x * .7 + cx * .3; dist = vista.remate.elem === 'tierra' ? 9 : vista.remate.elem === 'viento' ? 11 : 5.6; cy = vista.remate.elem === 'viento' ? 3 : 1.5; }
    }
    if (vista.fase === 'fin') dist = Math.max(6.5, dist - 1);
    camX += (cx - camX) * Math.min(1, dt * 4);
    camDist += (dist - camDist) * Math.min(1, dt * 3);
    camY += (cy - camY) * Math.min(1, dt * 3);
  }

  function render(dt) {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (w && h && (lienzo.width !== Math.round(w * renderer.getPixelRatio()) || lienzo.height !== Math.round(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
    }
    // en pantallas angostas (celular parado) la cámara se aleja para que entren los dos
    const angosto = Math.max(1, 1.5 / Math.max(.5, camara.aspect));
    sacudida = Math.max(0, sacudida - dt);
    const s = sacudida * .35;
    camara.position.set(camX + (Math.random() - .5) * s, camY + .35 + (Math.random() - .5) * s, camDist * angosto);
    camara.lookAt(camX, camY - .35 + 1.1 - 1.1, 0);
    camara.lookAt(camX, 1.15, 0);
    clave.position.set(camX - 4, 9, 7); clave.target.position.set(camX, 0, 0);
    destello = Math.max(0, destello - dt * 1.6);
    flash.material.opacity = destello;
    renderer.render(escena, camara);
  }

  return {
    ponerLuchadores, actualizar, escena, camara, renderer,
    reiniciarRonda() {
      ultimoEv = 0; remateFx = null; introT = reloj;
      for (const L of luch.values()) {
        L.saludo = false; L.decirT = 0;
        L.p.grupo.visible = true; L.p.grupo.scale.set(1, 1, 1); L.p.grupo.rotation.set(0, L.rotY, 0); L.hielo.visible = false; L.clave = ''; L.est = ''; L.atk = null;
        for (const { m, color, emissive } of L.materiales) { m.color.copy(color); if (emissive) m.emissive.copy(emissive); }
        L.arma?.scale.setScalar(0);
        for (const c of [...L.extra.children]) if (![L.escudo, L.hielo, L.aura, L.aro].includes(c)) c.removeFromParent();
      }
      for (const P of proy.values()) P.grupo.removeFromParent();
      proy.clear();
      escena.children.filter((o) => o.userData.remate).forEach((o) => o.removeFromParent());
    },
    limpiarRemate() {
      if (remateFx?.roca) remateFx.roca.removeFromParent();
      if (remateFx?.tor) remateFx.tor.grupo.removeFromParent();
      for (const e of remateFx?.estrellas || []) e.s.grupo.removeFromParent();
    },
    destruir() {
      for (const L of luch.values()) L.p.dispose();
      part.destruir();
      renderer.dispose();
    },
  };
}
