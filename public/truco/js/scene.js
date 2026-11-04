// Escena 3D del truco: salón, mesa con paño, personajes 2D (recortes), cartas y cámara en primera persona.
import * as THREE from 'three';
import { drawCharacter, lookFor, SENAS, W as CW, H as CH } from './characters.js';

const CARD_W = 0.1;
const CARD_H = CARD_W * (788 / 512);
const TABLE_Y = 0.74;
const EYE_Y = 1.24;
const CHAR_H = 1.15;
const CHAR_W = CHAR_H * (CW / CH);

const texLoader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 4;

function cardTex(id) {
  const key = id || 'back';
  if (!texCache.has(key)) {
    const t = texLoader.load(`/truco/cards/${key}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

export function preloadCards() {
  const ids = ['back'];
  for (const s of 'EBOC') for (const n of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]) ids.push(n + s);
  ids.forEach(cardTex);
}

const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);

// Carta con frente y dorso. El frente mira hacia +Z local.
function makeCard(id, lit = true) {
  const g = new THREE.Group();
  const Mat = lit ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial;
  const front = new THREE.Mesh(cardGeo, new Mat({ map: cardTex(id), alphaTest: 0.4 }));
  const back = new THREE.Mesh(cardGeo, new Mat({ map: cardTex('back'), alphaTest: 0.4 }));
  back.rotation.y = Math.PI;
  front.position.z = 0.0003;
  back.position.z = -0.0003;
  back.castShadow = lit; // solo una cara proyecta sombra (si no, la carta se sombrea a sí misma)
  g.add(front, back);
  g.userData = { id, front, back };
  return g;
}

function setCardFace(card, id) {
  if (card.userData.id === id) return;
  card.userData.id = id;
  card.userData.front.material.map = cardTex(id);
  card.userData.front.material.needsUpdate = true;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function noise(ctx, w, h, amount, alpha) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    img.data[i + 3] = alpha ?? img.data[i + 3];
  }
  ctx.putImageData(img, 0, 0);
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class TableScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a120c');
    this.scene.fog = new THREE.Fog('#1a120c', 7, 16);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.02, 40);
    this.scene.add(this.camera);

    this.yaw = 0;
    this.pitch = -0.32;
    this.n = 2;
    this.me = 0;
    this.spectator = false;
    this.R = 0.9;
    this.chars = new Map(); // seat -> { mesh, canvas, ctx, tex, look, state }
    this.tableCards = new Map(); // "seat:idx" -> card
    this.handCards = [];
    this.selected = null;
    this.hover = null;
    this.tweens = [];
    this.lookTarget = undefined;
    this.onLook = null;
    this.onCardClick = null;
    this.onCardDouble = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);

    this.buildRoom();
    this.tableGroup = new THREE.Group();
    this.scene.add(this.tableGroup);
    this.bindControls();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ salón
  buildRoom() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#ffe2b8', '#3a2a1c', 0.55));
    const lamp = new THREE.SpotLight('#ffd9a0', 38, 7, Math.PI / 3.2, 0.55, 1.6);
    lamp.position.set(0, 2.55, 0);
    lamp.target.position.set(0, 0, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0004;
    s.add(lamp, lamp.target);
    const fill = new THREE.PointLight('#ffb070', 6, 9, 1.4);
    fill.position.set(-2.5, 2.2, -2);
    s.add(fill);

    // lámpara colgante
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.26, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#2f4f3a', side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 })
    );
    shade.position.set(0, 2.62, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3d0' }));
    bulb.position.set(0, 2.55, 0);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2), new THREE.MeshBasicMaterial({ color: '#111' }));
    cord.position.set(0, 3.3, 0);
    s.add(shade, bulb, cord);

    // piso de madera
    const floorTex = canvasTex(512, 512, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        const tone = 70 + Math.random() * 30;
        ctx.fillStyle = `rgb(${tone + 40},${tone + 10},${tone - 20})`;
        ctx.fillRect(0, (i * h) / 8, w, h / 8);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, (i * h) / 8, w, 2);
        const off = Math.random() * w;
        ctx.fillRect(off, (i * h) / 8, 2, h / 8);
      }
      noise(ctx, w, h, 22);
    }, [6, 6]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // paredes con zócalo
    const wallTex = canvasTex(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#6b3b2a';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = x % 64 ? 'rgba(255,220,180,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(x, 0, 32, h * 0.7);
      }
      ctx.fillStyle = '#3b2416';
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.fillStyle = '#c9a36b';
      ctx.fillRect(0, h * 0.7, w, 6);
      noise(ctx, w, h, 14);
    }, [10, 1]);
    const walls = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 4.2, 48, 1, true),
      new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide })
    );
    walls.position.y = 2.1;
    s.add(walls);

    // cuadros en la pared
    const frames = [
      ['Boca vs. River', '#1d3b6e', '#f2c230'],
      ['Gardel', '#2a2a2a', '#e8e0cf'],
      ['Mate & Truco', '#2f5d3a', '#e8d29b'],
      ['Mar del Plata', '#3e7fae', '#f4e6c4'],
    ];
    frames.forEach(([text, bg, fg], i) => {
      const t = canvasTex(256, 192, (ctx, w, h) => {
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = bg;
        ctx.fillRect(14, 14, w - 28, h - 28);
        ctx.fillStyle = fg;
        ctx.font = 'bold 28px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, h / 2 + 10);
      });
      const a = Math.PI * 0.25 + i * (Math.PI / 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshLambertMaterial({ map: t }));
      m.position.set(Math.sin(a) * 5.9, 2.0, Math.cos(a) * 5.9);
      m.lookAt(0, 2.0, 0);
      s.add(m);
    });
  }

  // ------------------------------------------------------------ mesa según cantidad de jugadores
  setLayout({ n, me, spectator }) {
    if (this.n === n && this.me === me && this.spectator === spectator && this.tableBuilt) return;
    this.n = n;
    this.me = me ?? 0;
    this.spectator = !!spectator;
    this.R = n === 2 ? 0.78 : n === 4 ? 0.95 : 1.18;
    this.tableBuilt = true;
    const g = this.tableGroup;
    while (g.children.length) g.remove(g.children[0]);
    for (const c of this.chars.values()) this.scene.remove(c.mesh, c.chair);
    this.chars.clear();
    for (const c of this.tableCards.values()) this.scene.remove(c);
    this.tableCards.clear();

    const R = this.R;
    const felt = canvasTex(1024, 1024, (ctx, w, h) => {
      const grd = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 2);
      grd.addColorStop(0, '#2f7a46');
      grd.addColorStop(1, '#1d5230');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 18);
      ctx.strokeStyle = 'rgba(240,220,150,0.18)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,220,150,0.16)';
      ctx.font = 'bold 72px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('TRUCO', w / 2, h / 2 + 24);
      ctx.font = 'italic 30px Georgia';
      ctx.fillText('Cada Lado', w / 2, h / 2 + 70);
    });
    const top = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshLambertMaterial({ map: felt }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = TABLE_Y;
    top.receiveShadow = true;
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3216', roughness: 0.45, metalness: 0.05 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.045, 16, 96), wood);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TABLE_Y + 0.005;
    rim.castShadow = true;
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.1, 72, 1, true), wood);
    apron.position.y = TABLE_Y - 0.05;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, TABLE_Y - 0.05, 24), wood);
    leg.position.y = (TABLE_Y - 0.05) / 2;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.05, 32), wood);
    foot.position.y = 0.025;
    for (const m of [leg, foot, apron]) m.castShadow = m.receiveShadow = true;
    g.add(top, rim, apron, leg, foot);

    // mazo
    this.deck = new THREE.Group();
    const deckBox = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, 0.02, CARD_H),
      [
        new THREE.MeshLambertMaterial({ color: '#eee' }),
        new THREE.MeshLambertMaterial({ color: '#eee' }),
        new THREE.MeshLambertMaterial({ map: cardTex('back') }),
        new THREE.MeshLambertMaterial({ color: '#eee' }),
        new THREE.MeshLambertMaterial({ color: '#eee' }),
        new THREE.MeshLambertMaterial({ color: '#eee' }),
      ]
    );
    deckBox.castShadow = true;
    deckBox.position.y = 0.01;
    this.deck.add(deckBox);
    g.add(this.deck);

    // mate de decoración
    const mate = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16, 0, Math.PI * 2, 0.35, Math.PI * 0.7), new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.7 }));
    cup.position.y = 0.04;
    const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), new THREE.MeshLambertMaterial({ color: '#6f8f3a' }));
    yerba.rotation.x = -Math.PI / 2;
    yerba.position.y = 0.083;
    const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16), new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.9, roughness: 0.2 }));
    bomb.position.set(0.012, 0.11, 0);
    bomb.rotation.z = -0.25;
    mate.add(cup, yerba, bomb);
    mate.position.set(R * 0.62, TABLE_Y, -R * 0.42);
    mate.traverse((o) => (o.castShadow = true));
    g.add(mate);

    // personajes (todos menos yo, salvo que sea espectador)
    for (let s = 0; s < n; s++) {
      if (!this.spectator && s === this.me) continue;
      this.addCharacter(s);
    }
    this.placeCamera();
  }

  seatAngle(seat) {
    const k = (seat - this.me + this.n) % this.n;
    return (k * Math.PI * 2) / this.n + (this.spectator ? Math.PI / this.n : 0);
  }

  seatDir(seat) {
    const a = this.seatAngle(seat);
    return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  }

  addCharacter(seat) {
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CHAR_W, CHAR_H),
      new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
    );
    const d = this.seatDir(seat);
    const r = this.R + 0.3;
    mesh.position.set(d.x * r, 0.84 + 0.333 * CHAR_H, d.z * r);
    this.scene.add(mesh);
    // silla
    const wood = new THREE.MeshStandardMaterial({ color: '#4a2a14', roughness: 0.6 });
    const chair = new THREE.Group();
    const seatM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), wood);
    seatM.position.y = 0.46;
    const backM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.04), wood);
    backM.position.set(0, 0.8, 0.22);
    chair.add(seatM, backM);
    for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.04), wood);
      l.position.set(x, 0.23, z);
      chair.add(l);
    }
    chair.traverse((o) => (o.castShadow = true));
    const cr = this.R + 0.5;
    chair.position.set(d.x * cr, 0, d.z * cr);
    chair.rotation.y = this.seatAngle(seat);
    this.scene.add(chair);
    const c = { seat, mesh, chair, canvas, ctx, tex, look: lookFor('?', seat), name: '?', state: { expr: 'neutral', talking: false, gx: 0, gy: 0, cards: 0 }, gaze: null, exprUntil: 0, talkUntil: 0, dirty: true };
    this.chars.set(seat, c);
  }

  setPlayers(seats, handCounts) {
    for (const [seat, c] of this.chars) {
      const p = seats[seat];
      const name = p?.name || '';
      if (name !== c.name) {
        c.name = name;
        c.look = lookFor(name, seat);
        c.dirty = true;
      }
      c.mesh.visible = !!p;
      const cards = handCounts ? handCounts[seat] ?? 0 : 0;
      if (cards !== c.state.cards) {
        c.state.cards = cards;
        c.dirty = true;
      }
    }
  }

  setGaze(seat, target) {
    const c = this.chars.get(seat);
    if (!c) return;
    c.gaze = target;
    c.dirty = true;
  }

  showSena(seat, sena, ms = 1700) {
    const c = this.chars.get(seat);
    const s = SENAS[sena];
    if (!c || !s) return;
    c.state.expr = s.expr;
    c.exprUntil = performance.now() + ms;
    c.dirty = true;
  }

  speak(seat, ms = 1400) {
    const c = this.chars.get(seat);
    if (!c) return;
    c.talkUntil = performance.now() + ms;
  }

  // Dirección de la mirada de un personaje en coordenadas de su imagen, vista desde la cámara.
  gazeVector(c) {
    const t = c.gaze;
    if (t === null || t === undefined) return [0, 0.1];
    if (t === 'table') {
      const toCenter = new THREE.Vector3().sub(c.mesh.position).normalize();
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      return [THREE.MathUtils.clamp(toCenter.dot(right) * 0.6, -0.6, 0.6), 0.85];
    }
    if (!this.spectator && t === this.me) return [0, 0]; // te está mirando a vos
    const other = this.chars.get(t);
    if (!other) return [0, 0];
    const dir = other.mesh.position.clone().sub(c.mesh.position).normalize();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const x = dir.dot(right);
    return [THREE.MathUtils.clamp(x * 1.4, -1, 1), 0.05];
  }

  updateCharacter(c, now) {
    const expr = now < c.exprUntil ? c.state.expr : 'neutral';
    const talking = now < c.talkUntil && Math.floor(now / 130) % 2 === 0;
    const [gx, gy] = this.gazeVector(c);
    const st = c.state;
    if (!c.dirty && expr === c.drawnExpr && talking === c.drawnTalk && Math.abs(gx - st.gx) < 0.02 && Math.abs(gy - st.gy) < 0.02) return;
    st.gx += (gx - st.gx) * 0.5;
    st.gy += (gy - st.gy) * 0.5;
    if (Math.abs(gx - st.gx) < 0.02) st.gx = gx;
    if (Math.abs(gy - st.gy) < 0.02) st.gy = gy;
    drawCharacter(c.ctx, c.look, { ...st, expr, talking });
    c.tex.needsUpdate = true;
    c.drawnExpr = expr;
    c.drawnTalk = talking;
    c.dirty = false;
  }

  // ------------------------------------------------------------ cámara
  placeCamera() {
    if (this.spectator) {
      this.camera.position.set(0, 2.3, this.R + 1.6);
      this.yaw = 0;
      this.pitch = -0.55;
    } else {
      this.camera.position.set(0, EYE_Y, this.R + 0.24);
      this.yaw = 0;
      this.pitch = -0.2;
    }
    this.applyCamera();
  }

  applyCamera() {
    if (this.spectator) {
      // el espectador gira alrededor de la mesa
      const r = this.R + 1.7;
      this.camera.position.set(Math.sin(this.yaw) * r, 2.2, Math.cos(this.yaw) * r);
      this.camera.lookAt(0, TABLE_Y + this.pitch * 0.6 + 0.3, 0);
      return;
    }
    this.yaw = THREE.MathUtils.clamp(this.yaw, -2.0, 2.0);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.25, 0.35);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    // al mirar para abajo te inclinás sobre la mesa, como en la vida real
    const lean = THREE.MathUtils.smoothstep(-this.pitch, 0.3, 1.0);
    this.camera.position.set(-Math.sin(this.yaw) * 0.12 * lean, EYE_Y + 0.2 * lean, this.R + 0.24 - 0.42 * lean);
  }

  lookAtSeat(seat) {
    if (this.spectator) return;
    if (seat === 'table') {
      this.animateView(this.yaw * 0.3, -0.78);
      return;
    }
    const c = this.chars.get(seat);
    if (!c) return;
    const p = c.mesh.position.clone().sub(this.camera.position);
    const yaw = Math.atan2(-p.x, -p.z);
    this.animateView(yaw, -0.12);
  }

  animateView(yaw, pitch) {
    const y0 = this.yaw;
    const p0 = this.pitch;
    this.tween(320, (t) => {
      this.yaw = y0 + (yaw - y0) * ease(t);
      this.pitch = p0 + (pitch - p0) * ease(t);
      this.applyCamera();
    });
  }

  computeLookTarget() {
    if (this.spectator) return null;
    if (this.pitch < -0.55) return 'table';
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    fwd.y = 0;
    fwd.normalize();
    let best = null;
    let bestA = 0.34;
    for (const [seat, c] of this.chars) {
      if (!c.mesh.visible) continue;
      const d = c.mesh.position.clone().sub(this.camera.position);
      d.y = 0;
      d.normalize();
      const a = Math.acos(THREE.MathUtils.clamp(fwd.dot(d), -1, 1));
      if (a < bestA) {
        bestA = a;
        best = seat;
      }
    }
    return best;
  }

  bindControls() {
    const el = this.renderer.domElement;
    let down = null;
    let moved = 0;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
      moved = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      this.setPointer(e);
      if (!down) return this.updateHover();
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved > 6) {
        const k = 2.6 / el.clientWidth;
        this.yaw = down.yaw - dx * k * (this.spectator ? 1.4 : 1);
        this.pitch = down.pitch - dy * k;
        this.applyCamera();
      }
    });
    const up = (e) => {
      if (down && moved <= 6) this.click(e);
      down = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => (down = null));
    el.addEventListener('dblclick', (e) => {
      this.setPointer(e);
      const card = this.pickHand();
      if (card && this.onCardDouble) this.onCardDouble(card.userData.id);
    });
    el.addEventListener('wheel', (e) => {
      this.pitch -= e.deltaY * 0.0015;
      this.applyCamera();
    }, { passive: true });
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setPointer(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  pickHand() {
    if (!this.handCards.length) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.handCards, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !this.handCards.includes(o)) o = o.parent;
    return o;
  }

  updateHover() {
    const card = this.pickHand();
    this.hover = card;
    this.renderer.domElement.style.cursor = card ? 'pointer' : 'grab';
  }

  click(e) {
    this.setPointer(e);
    const card = this.pickHand();
    if (card && this.onCardClick) this.onCardClick(card.userData.id);
  }

  // ------------------------------------------------------------ mis cartas (en la mano, pegadas a la cámara)
  setMyCards(cards, selected) {
    const ids = cards.join(',');
    if (ids !== this.handIds) {
      this.handIds = ids;
      for (const c of this.handCards) this.handGroup.remove(c);
      this.handCards = cards.map((id) => {
        const c = makeCard(id, false);
        c.scale.setScalar(1.1);
        c.renderOrder = 10;
        c.traverse((o) => {
          if (o.material) {
            o.material.depthTest = false;
            o.material.transparent = true;
          }
          o.renderOrder = 10;
        });
        this.handGroup.add(c);
        return c;
      });
    }
    this.selected = selected;
  }

  layoutHand(dt) {
    const n = this.handCards.length;
    // cuanto más mirás para abajo, más se bajan las cartas (para ver la mesa)
    const lowered = THREE.MathUtils.clamp((-this.pitch - 0.35) / 0.45, 0, 1);
    this.handCards.forEach((c, i) => {
      const mid = (n - 1) / 2;
      const isSel = this.selected === c.userData.id;
      const isHover = this.hover === c;
      const x = (i - mid) * 0.1;
      const y = -0.27 - Math.abs(i - mid) * 0.012 + (isSel ? 0.06 : isHover ? 0.025 : 0) - lowered * 0.12;
      const target = new THREE.Vector3(x, y, -0.62);
      c.position.lerp(target, Math.min(1, dt * 14));
      c.rotation.set(-0.18, 0, -(i - mid) * 0.09);
    });
  }

  // ------------------------------------------------------------ cartas en la mesa
  // table: por asiento, lista de {c, faceDown, stacked}. reveal: mostrar las tapadas (fin de mano).
  syncTable(table, { animate = true } = {}) {
    const seen = new Set();
    table.forEach((list, seat) => {
      let slot = -1;
      list.forEach((p, idx) => {
        if (!p.stacked) slot++;
        const key = `${seat}:${idx}`;
        seen.add(key);
        let card = this.tableCards.get(key);
        const face = p.c || 'back';
        const pose = this.tablePose(seat, Math.max(0, slot), p.stacked, idx);
        if (!card) {
          card = makeCard(face, true);
          card.userData.faceDown = p.faceDown;
          this.scene.add(card);
          this.tableCards.set(key, card);
          const flip = p.faceDown ? Math.PI : 0;
          const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.rot));
          if (flip) endQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
          if (animate) {
            const start = this.handOrigin(seat);
            const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, this.seatAngle(seat), 0));
            card.position.copy(start);
            card.quaternion.copy(q0);
            this.tween(420, (t) => {
              const e = ease(t);
              card.position.lerpVectors(start, pose.pos, e);
              card.position.y += Math.sin(Math.PI * t) * 0.12;
              card.quaternion.slerpQuaternions(q0, endQ, e);
            });
          } else {
            card.position.copy(pose.pos);
            card.quaternion.copy(endQ);
          }
        } else {
          setCardFace(card, face);
        }
      });
    });
    for (const [key, card] of this.tableCards) {
      if (!seen.has(key)) {
        this.scene.remove(card);
        this.tableCards.delete(key);
      }
    }
  }

  tablePose(seat, slot, stacked, idx) {
    const d = this.seatDir(seat);
    const a = this.seatAngle(seat);
    const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const radial = this.R * (this.n === 2 ? 0.42 : 0.5);
    const pos = d.clone().multiplyScalar(radial).addScaledVector(tangent, (slot - 1) * (CARD_W + 0.018));
    let rot = a;
    pos.y = TABLE_Y + 0.003 + idx * 0.0016;
    if (stacked) {
      // encimada: casi tapa la anterior, pero se nota un poquito
      pos.addScaledVector(tangent, 0.012).addScaledVector(d, -0.016);
      rot += 0.13;
    }
    return { pos, rot };
  }

  handOrigin(seat) {
    if (!this.spectator && seat === this.me) {
      return new THREE.Vector3(0, 1.0, this.R + 0.25);
    }
    const d = this.seatDir(seat);
    return d.multiplyScalar(this.R + 0.15).setY(0.95);
  }

  setDealer(seat) {
    if (!this.deck || seat == null) return;
    const d = this.seatDir(seat);
    const a = this.seatAngle(seat);
    const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const p = d.multiplyScalar(this.R * 0.72).addScaledVector(tangent, 0.26);
    this.deck.position.set(p.x, TABLE_Y, p.z);
    this.deck.rotation.y = a + 0.3;
  }

  // ------------------------------------------------------------ utilidades
  tween(ms, fn, done) {
    this.tweens.push({ t0: performance.now(), ms, fn, done });
  }

  // Posición en pantalla de la cabeza de un asiento (para nombres y globos de diálogo).
  screenPos(seat, yOffset = 0.62) {
    let p;
    if (!this.spectator && seat === this.me) return null;
    const c = this.chars.get(seat);
    if (!c) return null;
    p = c.mesh.position.clone();
    p.y += yOffset * CHAR_H * 0.5 + 0.08;
    p.project(this.camera);
    const behind = p.z > 1;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, behind, visible: !behind && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.2 };
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 78 : 62;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    // teclado: A/D o flechas para girar, W/S para mirar arriba/abajo
    const k = this.keys;
    if (k && k.size) {
      const sp = 1.8 * dt;
      if (k.has('a') || k.has('arrowleft')) this.yaw += sp;
      if (k.has('d') || k.has('arrowright')) this.yaw -= sp;
      if (k.has('w') || k.has('arrowup')) this.pitch += sp * 0.8;
      if (k.has('s') || k.has('arrowdown')) this.pitch -= sp * 0.8;
      this.applyCamera();
    }
    this.tweens = this.tweens.filter((tw) => {
      const t = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(t);
      if (t >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });
    this.layoutHand(dt);
    for (const c of this.chars.values()) {
      // billboard: el recorte siempre mira a la cámara (solo gira en Y)
      c.mesh.rotation.y = Math.atan2(this.camera.position.x - c.mesh.position.x, this.camera.position.z - c.mesh.position.z);
      // respira un poquito
      c.mesh.position.y = 0.84 + 0.333 * CHAR_H + Math.sin(now / 900 + c.seat) * 0.004;
      this.updateCharacter(c, now);
    }
    const target = this.computeLookTarget();
    if (target !== this.lookTarget) {
      this.lookTarget = target;
      this.onLook?.(target);
    }
    this.onFrame?.();
    this.renderer.render(this.scene, this.camera);
  }
}
