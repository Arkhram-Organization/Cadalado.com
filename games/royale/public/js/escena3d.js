// Escena 3D de Battle Shmitz: la isla (agua animada, pasto, calles, edificios con ventanas y techos que se
// abren cuando entrás), los árboles, la decoración de cada lugar, el botín con su brillo de rareza, los cofres,
// la gente, el colectivo volador, la tormenta y los efectos.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { T, TAM, BALDOSA, LADO, ARMAS, CAJAS, MATERIALES, RAREZAS } from './mundo.js';
import { OBJETOS } from './inventario.js';
import { modeloArma, modeloConsumible, modeloMunicion, modeloMaterial, modeloCofre, aura, modeloColectivo, modeloParacaidas, modeloQueque, cartel, material, pieza, franjas, brillo } from './modelos.js';

const PISO_ALTO = 17; // alto de un piso de edificio
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000; };
const COLOR_TIPO = { venda: '#f4ede0', botiquin: '#ff8a7a', mini: '#5fd8f0', escudo: '#5f9bff', granada: '#c9d46b', madera: '#d9a066', piedra: '#cfd4cc', metal: '#a9c6d4' };
const ALTO_HAZ = { comun: 0, poco_comun: 0, rara: 26, epica: 40, legendaria: 58 };

export class Isla3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#2a8fc4');
    this.ortho = new THREE.OrthographicCamera(-200, 200, 112.5, -112.5, 1, 3000);
    this.tercera = new THREE.PerspectiveCamera(60, 1, 1, 3000);
    this.camera = this.ortho;
    this.modoCamara = (() => { try { return localStorage.getItem('cadalado.royale.camara') === 'tercera' ? 'tercera' : 'superior'; } catch { return 'superior'; } })();
    this.zoom = 1;
    this.scene.add(new THREE.HemisphereLight('#f2f7ff', '#5f7a45', 1.75));
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -340, right: 340, top: 340, bottom: -340, near: 1, far: 1400 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    // el mar: un plano grande con olas suaves
    this.agua = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c1: { value: new THREE.Color('#1f7fb8') }, c2: { value: new THREE.Color('#5ed0ee') } },
      vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float t; uniform vec3 c1, c2; varying vec2 vP;
        void main(){
          float a = sin(vP.x*.043 + t*1.2) * sin(vP.y*.051 - t*.9) + sin((vP.x + vP.y)*.021 + t*.6)*.6 + sin(vP.x*.11 - vP.y*.07 + t*2.1)*.18;
          float brillo = smoothstep(.72, 1.05, a);
          vec3 c = mix(c1, c2, .38 + .22*a) + brillo*.22;
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(LADO * 4, LADO * 4), this.agua);
    mar.rotation.x = -Math.PI / 2; mar.position.set(LADO / 2, -1.6, LADO / 2); mar.receiveShadow = false;
    this.scene.add(mar);
    this.people = new Map(); this.loot = new Map(); this.effects = [];
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.edificios = new THREE.Group(); this.scene.add(this.edificios);
    this.botinGrupo = new THREE.Group(); this.scene.add(this.botinGrupo);
    this.bullets = new THREE.Group(); this.scene.add(this.bullets);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // la tormenta: pared violeta que se mueve y un velo afuera del círculo
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(160,90,255,0)'); grad.addColorStop(0.45, 'rgba(170,100,255,.45)'); grad.addColorStop(1, 'rgba(120,40,220,.85)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 3, 30 + Math.random() * 80); }
    this.texTormenta = new THREE.CanvasTexture(c); this.texTormenta.wrapS = THREE.RepeatWrapping; this.texTormenta.repeat.set(40, 1);
    this.zone = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 160, 160, 1, true), new THREE.MeshBasicMaterial({ map: this.texTormenta, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.NormalBlending }));
    this.scene.add(this.zone); this.zone.visible = false; this.zone.renderOrder = 3;
    this.velo = new THREE.Mesh(new THREE.RingGeometry(1, 40, 160, 1), new THREE.MeshBasicMaterial({ color: '#7a2fd0', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    this.velo.rotation.x = -Math.PI / 2; this.scene.add(this.velo); this.velo.visible = false; this.velo.renderOrder = 3;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.995, 1, 160, 1), new THREE.MeshBasicMaterial({ color: '#f1e3ff', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring); this.ring.visible = false;
    // el colectivo volador
    this.colectivo = modeloColectivo(); this.scene.add(this.colectivo); this.colectivo.visible = false;
    // marcador del mapa
    this.marca = new THREE.Group();
    const columna = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 260, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#c5f04a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    columna.position.y = 130; this.marca.add(columna);
    const diamante = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), new THREE.MeshBasicMaterial({ color: '#c5f04a' }));
    diamante.position.y = 30; this.marca.add(diamante); this.marca.userData.diamante = diamante;
    this.scene.add(this.marca); this.marca.visible = false;
    // pozos de efectos (balas, cohetes, granadas, chispas)
    this.trazas = []; this.cohetes = []; this.bombas = []; this.chispas = [];
  }
  mesh(geo, color, x, y, z, parent = this.world) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  clear(group) {
    group.traverse((o) => { if (o.isMesh || o.isPoints || o.isLineSegments) { if (!o.geometry?.userData?.compartida) o.geometry?.dispose(); } });
    group.clear();
  }
  // Una tanda de piezas iguales (InstancedMesh). lista: [{x,y,z,sx,sy,sz,ry,rx,color}]
  instancias(geo, mat, lista, { sombra = true, recibe = true, parent = this.world } = {}) {
    if (!lista.length) return null;
    const inst = new THREE.InstancedMesh(geo, mat, lista.length);
    const d = new THREE.Object3D(), col = new THREE.Color();
    lista.forEach((p, i) => {
      d.position.set(p.x, p.y || 0, p.z);
      d.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      d.scale.set(p.sx ?? p.s ?? 1, p.sy ?? p.s ?? 1, p.sz ?? p.s ?? 1);
      d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      if (p.color) inst.setColorAt(i, col.set(p.color));
    });
    inst.castShadow = sombra; inst.receiveShadow = recibe;
    parent.add(inst);
    return inst;
  }

  // ---------------------------------------------------------------- armar la isla (una vez por mapa)
  preparar(m) {
    this.clear(this.world); this.clear(this.botinGrupo); this.loot.clear();
    for (const p of this.people.values()) { this.scene.remove(p.raiz); p.persona.dispose?.(); }
    this.people.clear();
    this.mundo = m;
    const casaDe = new Int16Array(TAM * TAM).fill(-1);
    m.casas.forEach((c, k) => { for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) if (c.tipo !== 'estadio' || m.t[y * TAM + x] === T.PARED) casaDe[y * TAM + x] = k; });
    this.casaDe = casaDe;
    // piso
    const capas = {
      [T.ARENA]: { h: 1.6, color: (i) => (hash(i) < 0.5 ? '#ead9a4' : '#e3d097') },
      [T.PASTO]: { h: 2, color: (i) => { const x = i % TAM, y = (i / TAM) | 0; const n = Math.sin(x * 0.31) * Math.cos(y * 0.27) + Math.sin((x + y) * 0.13); return n > 0.6 ? '#86bd5d' : n < -0.6 ? '#6fa64e' : hash(i) < 0.5 ? '#7cb456' : '#78b052'; } },
      [T.CAMINO]: { h: 2.05, color: (i) => (hash(i) < 0.5 ? '#4f5359' : '#4a4e54') },
      [T.TIERRA]: { h: 2.02, color: (i) => (hash(i) < 0.5 ? '#ad865a' : '#a57e53') },
      [T.PLAZA]: { h: 2.1, color: (i) => { const x = i % TAM, y = (i / TAM) | 0; return (x + y) % 2 ? '#d2cab8' : '#c8c0ad'; } },
      [T.MADERA]: { h: 2.3, color: (i) => ((i % TAM) % 2 ? '#a0703f' : '#8f6236') },
      [T.PISO]: { h: 2.15, color: (i) => { const c = m.casas[casaDe[i]]; const base = new THREE.Color(c?.piso || '#c9b08a'); return '#' + base.multiplyScalar(0.94 + hash(i) * 0.08).getHexString(); } },
    };
    for (const [tipo, capa] of Object.entries(capas)) {
      const lista = [];
      m.t.forEach((v, i) => { if (v === Number(tipo)) lista.push({ x: (i % TAM + 0.5) * BALDOSA, y: capa.h / 2 - 2, z: ((i / TAM | 0) + 0.5) * BALDOSA, color: capa.color(i) }); });
      const g = new THREE.BoxGeometry(BALDOSA + 0.05, capa.h, BALDOSA + 0.05);
      this.instancias(g, new THREE.MeshStandardMaterial({ roughness: Number(tipo) === T.CAMINO ? 0.75 : 0.95 }), lista, { sombra: false });
    }
    // escombros donde se rompe una pared (se van sumando)
    this.escombros = new THREE.InstancedMesh(new THREE.BoxGeometry(BALDOSA, 2.4, BALDOSA), new THREE.MeshStandardMaterial({ color: '#9a8f80', roughness: 1 }), 800);
    this.escombros.count = 0; this.escombros.receiveShadow = true; this.world.add(this.escombros);
    this.rotas = new Set();
    // paredes de los edificios
    const paredes = [];
    this.indicePared = new Int32Array(TAM * TAM).fill(-1);
    this.paredesDeCasa = m.casas.map(() => []);
    m.t.forEach((v, i) => {
      if (v !== T.PARED) return;
      const k = casaDe[i], c = m.casas[k];
      const altura = m.alturas?.[i] || 1;
      const base = new THREE.Color(c?.color || '#b7a58b').multiplyScalar(0.95 + hash(i) * 0.08);
      this.indicePared[i] = paredes.length;
      if (k >= 0) this.paredesDeCasa[k].push(paredes.length);
      paredes.push({ x: (i % TAM + 0.5) * BALDOSA, y: -2, z: ((i / TAM | 0) + 0.5) * BALDOSA, sy: altura * PISO_ALTO / PISO_ALTO, color: '#' + base.getHexString(), alto: altura * PISO_ALTO + (c?.tipo === 'contenedor' ? -3 : 0) });
    });
    const geoPared = new THREE.BoxGeometry(BALDOSA + 0.1, 1, BALDOSA + 0.1); geoPared.translate(0, 0.5, 0);
    paredes.forEach((p) => { p.sy = p.alto; });
    this.paredes = this.instancias(geoPared, new THREE.MeshStandardMaterial({ roughness: 0.88 }), paredes);
    this.datosParedes = paredes;
    // ventanas en las paredes de afuera
    const ventanas = [];
    this.ventanasDeCasa = m.casas.map(() => []);
    m.casas.forEach((c, k) => {
      if (c.tipo !== 'casa') return;
      const lados = [];
      for (let x = c.x + 1; x < c.x + c.w - 1; x++) lados.push([x, c.y, 0, -1], [x, c.y + c.h - 1, 0, 1]);
      for (let y = c.y + 1; y < c.y + c.h - 1; y++) lados.push([c.x, y, -1, 0], [c.x + c.w - 1, y, 1, 0]);
      lados.forEach(([x, y, nx, nz], n) => {
        const i = y * TAM + x;
        if (m.t[i] !== T.PARED || (x + y) % 3 === 0) return;
        const fuera = m.t[(y + nz) * TAM + x + nx];
        if (fuera === T.PARED || fuera === T.PISO) return;
        for (let piso = 0; piso < c.altura; piso++) {
          this.ventanasDeCasa[k].push(ventanas.length);
          ventanas.push({ x: (x + 0.5) * BALDOSA + nx * 8.2, y: piso * PISO_ALTO + 7.5, z: (y + 0.5) * BALDOSA + nz * 8.2, ry: nx ? Math.PI / 2 : 0 });
        }
      });
    });
    this.ventanas = this.instancias(new THREE.BoxGeometry(9, 6.5, 0.8), new THREE.MeshStandardMaterial({ color: '#2d4f6b', emissive: '#4a86b0', emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.3 }), ventanas, { sombra: false });
    this.datosVentanas = ventanas;
    // techos (se esconden cuando entrás)
    this.techos = [];
    m.casas.forEach((c, k) => {
      if (c.tipo !== 'casa') return;
      const g = new THREE.Group();
      const alto = c.altura * PISO_ALTO - 2;
      const cx = (c.x + c.w / 2) * BALDOSA, cz = (c.y + c.h / 2) * BALDOSA, W = c.w * BALDOSA, D = c.h * BALDOSA;
      const mat = new THREE.MeshStandardMaterial({ color: c.techo, roughness: 0.8, transparent: true, opacity: 1 });
      const mat2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.techo).multiplyScalar(0.75), roughness: 0.8, transparent: true, opacity: 1 });
      const dosAguas = c.altura <= 2 && c.lugar !== 'queque' && c.lugar !== 'asman' && c.lugar !== 'templo';
      if (dosAguas) {
        const forma = new THREE.Shape([new THREE.Vector2(-D / 2 - 2, 0), new THREE.Vector2(D / 2 + 2, 0), new THREE.Vector2(0, Math.min(16, D * 0.35))]);
        const techo = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: W + 3, bevelEnabled: false }), mat);
        techo.rotation.y = Math.PI / 2; techo.position.set(cx - W / 2 - 1.5, alto, cz);
        techo.castShadow = true; g.add(techo);
      } else {
        const losa = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 2.5, D + 1), mat); losa.position.set(cx, alto + 1.25, cz); losa.castShadow = true; g.add(losa);
        for (const [w, d, x, z] of [[W + 1, 1.6, cx, cz - D / 2], [W + 1, 1.6, cx, cz + D / 2], [1.6, D + 1, cx - W / 2, cz], [1.6, D + 1, cx + W / 2, cz]]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), mat2); b.position.set(x, alto + 3, z); b.castShadow = true; g.add(b);
        }
        if (c.altura >= 3) for (let n = 0; n < 2; n++) { const b = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), mat2); b.position.set(cx + (n ? W / 4 : -W / 5), alto + 4.5, cz + (n ? -D / 6 : D / 5)); b.castShadow = true; g.add(b); }
      }
      this.world.add(g);
      this.techos.push({ c, k, g, mats: [mat, mat2], op: 1 });
    });
    // obstáculos
    this.obstaculosInst = [];
    const porTipo = (f) => m.obstaculos.filter((o) => !o.roto && f(o));
    const tronco = new THREE.CylinderGeometry(1.4, 2.4, 1, 7); tronco.translate(0, 0.5, 0);
    const redondos = porTipo((o) => o.tipo === 'arbol' && (!o.forma || o.forma === 'redondo'));
    const pinos = porTipo((o) => o.tipo === 'arbol' && o.forma === 'pino');
    const palmeras = porTipo((o) => o.tipo === 'arbol' && o.forma === 'palmera');
    const muertos = porTipo((o) => o.tipo === 'arbol' && o.forma === 'muerto');
    const verdes = ['#4f8a3e', '#5a9444', '#457d3a', '#63993f'];
    this.registrar(this.instancias(tronco, material('#7a5a3c'), [...redondos, ...pinos].map((o) => ({ x: o.x, z: o.y, sy: o.forma === 'pino' ? 12 : 13, s: 1 }))), [...redondos, ...pinos]);
    this.copas = this.instancias(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), redondos.map((o) => ({ x: o.x, y: 19, z: o.y, s: o.copa || 13, sy: (o.copa || 13) * 0.95, ry: o.tono * 6, color: verdes[Math.floor(o.tono * 4)] })));
    this.copas2 = this.instancias(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), redondos.map((o) => ({ x: o.x + 4, y: 26, z: o.y - 3, s: (o.copa || 13) * 0.62, ry: o.tono * 3, color: verdes[(Math.floor(o.tono * 4) + 1) % 4] })));
    const cono = new THREE.ConeGeometry(1, 1, 7); cono.translate(0, 0.5, 0);
    this.pinos1 = this.instancias(cono, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pinos.map((o) => ({ x: o.x, y: 8, z: o.y, sx: 11, sz: 11, sy: 18, color: o.tono < 0.5 ? '#2f6b45' : '#357a4c' })));
    this.pinos2 = this.instancias(cono, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pinos.map((o) => ({ x: o.x, y: 18, z: o.y, sx: 8, sz: 8, sy: 15, color: o.tono < 0.5 ? '#3a7d50' : '#418a57' })));
    this.registrar(this.instancias(tronco, material('#9b7a54'), palmeras.map((o) => ({ x: o.x, z: o.y, sx: 0.7, sz: 0.7, sy: 22, rz: (o.tono - 0.5) * 0.4 }))), palmeras);
    this.palmas = this.instancias(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), palmeras.map((o) => ({ x: o.x + (o.tono - 0.5) * 8, y: 22, z: o.y, sx: 13, sy: 3.5, sz: 13, ry: o.tono * 5, color: '#5aa047' })));
    this.registrar(this.instancias(tronco, material('#4a3a33'), muertos.map((o) => ({ x: o.x, z: o.y, sx: 0.9, sz: 0.9, sy: 17 }))), muertos);
    this.registrar(this.instancias(new THREE.BoxGeometry(1, 1, 1), material('#4a3a33'), muertos.flatMap((o) => [{ x: o.x + 3, y: 12, z: o.y, sx: 9, sy: 1.2, sz: 1.2, rz: 0.6, ry: o.tono * 4 }, { x: o.x - 2, y: 9, z: o.y + 1, sx: 7, sy: 1, sz: 1, rz: -0.7, ry: o.tono * 2 }])), muertos, 2);
    const rocas = porTipo((o) => o.tipo === 'roca');
    this.registrar(this.instancias(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), rocas.map((o) => ({ x: o.x, y: 1, z: o.y, sx: o.r * 1.15, sy: o.r * 0.8, sz: o.r, ry: o.tono * 6, color: o.tono < 0.33 ? '#9aa09b' : o.tono < 0.66 ? '#8b918d' : '#a7aba4' }))), rocas);
    // autos: carrocería, cabina con vidrios y ruedas
    const autos = porTipo((o) => o.tipo === 'auto');
    const coloresAuto = ['#d9473a', '#f2c94c', '#3f8cff', '#f4f1ea', '#2f3a40', '#7bc96f', '#ff8a5b'];
    const pose = (o, dx, dy, dz, extra = {}) => { const a = o.rot || 0, k = o.grande ? 1.35 : 1; return { x: o.x + (Math.cos(a) * dx - Math.sin(a) * dz) * k, y: dy * k, z: o.y + (Math.sin(a) * dx + Math.cos(a) * dz) * k, ry: -a, ...extra }; };
    this.registrar(this.instancias(new THREE.BoxGeometry(20, 6, 10), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }), autos.map((o) => pose(o, 0, 3.5, 0, { s: o.grande ? 1.35 : 1, color: o.grande ? '#d0d6da' : coloresAuto[Math.floor(o.tono * coloresAuto.length)] }))), autos);
    this.registrar(this.instancias(new THREE.BoxGeometry(11, 4.5, 9), new THREE.MeshStandardMaterial({ color: '#25343f', roughness: 0.15, metalness: 0.4 }), autos.map((o) => pose(o, o.grande ? 5 : -1, 8.5, 0, { s: o.grande ? 1.35 : 1 }))), autos);
    const rueda = new THREE.CylinderGeometry(2.4, 2.4, 1.6, 12); rueda.rotateX(Math.PI / 2);
    this.registrar(this.instancias(rueda, material('#1c1c1c'), autos.flatMap((o) => [[-6, 5], [6, 5], [-6, -5], [6, -5]].map(([dx, dz]) => pose(o, dx, 2.2, dz, { s: o.grande ? 1.35 : 1 })))), autos, 4);
    // columnas, cajas, silo, surtidores, tractor, monumento
    const columnas = porTipo((o) => o.tipo === 'columna' && !o.faro);
    this.registrar(this.instancias(new THREE.CylinderGeometry(3.2, 3.6, 24, 12), material('#e8e0cc'), columnas.map((o) => ({ x: o.x, y: 10, z: o.y }))), columnas);
    this.registrar(this.instancias(new THREE.BoxGeometry(9, 2.4, 9), material('#d6ccb4'), columnas.map((o) => ({ x: o.x, y: 23, z: o.y }))), columnas);
    const cajas = porTipo((o) => o.tipo === 'caja');
    this.registrar(this.instancias(new THREE.BoxGeometry(10, 9, 10), material('#a8763f'), cajas.map((o) => ({ x: o.x, y: 4.5, z: o.y, ry: o.tono * 1.5 }))), cajas);
    this.registrar(this.instancias(new THREE.BoxGeometry(10.4, 1.6, 10.4), material('#6b4421'), cajas.flatMap((o) => [{ x: o.x, y: 1.5, z: o.y, ry: o.tono * 1.5 }, { x: o.x, y: 7.6, z: o.y, ry: o.tono * 1.5 }])), cajas, 2);
    this.unicos = [];
    for (const o of porTipo((o) => ['silo', 'surtidor', 'tractor', 'monumento'].includes(o.tipo))) {
      const g = new THREE.Group(); g.position.set(o.x, 0, o.y);
      if (o.tipo === 'silo') { pieza(g, new THREE.CylinderGeometry(13, 13, 46, 20), '#d8dde0', 0, 21, 0, { metalness: 0.5, roughness: 0.4 }); pieza(g, new THREE.SphereGeometry(13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#b9c2c7', 0, 44, 0, { metalness: 0.5 }); for (let y = 6; y < 44; y += 9) pieza(g, new THREE.TorusGeometry(13.1, 0.5, 4, 24), '#9aa4aa', 0, y, 0).rotation.x = Math.PI / 2; }
      else if (o.tipo === 'surtidor') { pieza(g, new THREE.BoxGeometry(5, 11, 4), '#e2453a', 0, 5.5, 0); pieza(g, new THREE.BoxGeometry(4, 3, 0.4), '#1d2b33', 0, 8, 2.1, { emissive: '#3fae8c', emissiveIntensity: 0.6 }); }
      else if (o.tipo === 'tractor') { pieza(g, new THREE.BoxGeometry(16, 7, 9), '#3a9c3a', 0, 7, 0); pieza(g, new THREE.BoxGeometry(6, 7, 7), '#2c3e2c', -4, 13, 0); for (const [x, r] of [[-5, 5], [6, 3]]) for (const z of [-5.5, 5.5]) pieza(g, new THREE.CylinderGeometry(r, r, 2, 14), '#1c1c1c', x, r, z).rotation.x = Math.PI / 2; g.rotation.y = 0.6; }
      else if (o.tipo === 'monumento') g.add(modeloQueque());
      this.world.add(g); this.unicos.push({ o, g });
    }
    // decoración
    this.decorar(m);
    // botín
    for (const b of m.botin) this.agregarBotin(b);
  }
  // recuerda qué instancias son de cada obstáculo (para esconderlas cuando se rompe)
  registrar(inst, lista, por = 1) {
    if (!inst) return;
    this.obstaculosInst.push({ inst, ids: lista.flatMap((o) => Array(por).fill(o.id)) });
  }
  decorar(m) {
    const d = m.decoraciones || [];
    const de = (tipo) => d.filter((x) => x.tipo === tipo);
    const poste = new THREE.CylinderGeometry(0.6, 0.8, 1, 6); poste.translate(0, 0.5, 0);
    this.instancias(poste, material('#3a3f44'), de('farola').map((p) => ({ x: p.x, z: p.y, sy: 22 })));
    this.instancias(new THREE.BoxGeometry(5, 2.2, 3), material('#fff3c4', { emissive: '#ffd36a', emissiveIntensity: 0.8 }), de('farola').map((p) => ({ x: p.x + 1.5, y: 22, z: p.y })), { sombra: false });
    this.instancias(new THREE.BoxGeometry(12, 1.4, 4), material('#8a5a34'), de('banco').map((p) => ({ x: p.x, y: 3, z: p.y })));
    this.instancias(new THREE.BoxGeometry(12, 4, 1), material('#8a5a34'), de('banco').map((p) => ({ x: p.x, y: 5, z: p.y - 2 })));
    this.instancias(new THREE.BoxGeometry(16, 1.1, 0.8), material('#f2ecdf'), de('cerca').flatMap((p) => [{ x: p.x, y: 3, z: p.y, ry: p.rot || 0 }, { x: p.x, y: 5.6, z: p.y, ry: p.rot || 0 }]));
    this.instancias(new THREE.BoxGeometry(1.4, 7, 1.4), material('#f2ecdf'), de('cerca').map((p) => ({ x: p.x - 7.5, y: 3.5, z: p.y })));
    this.instancias(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), de('cultivo').map((p) => ({ x: p.x, y: 2.5, z: p.y, sx: 4.5, sy: 3.6, sz: 4.5, color: hash(p.x * 7 + p.y) < 0.5 ? '#5c8f3c' : '#4e8035' })));
    this.instancias(new THREE.SphereGeometry(0.9, 6, 4), material('#8a5a2c'), de('cultivo').flatMap((p) => [{ x: p.x + 2, y: 4.5, z: p.y + 2 }, { x: p.x - 2, y: 3.6, z: p.y - 1.5 }]), { sombra: false });
    this.instancias(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), de('arbusto').map((p) => ({ x: p.x, y: 2, z: p.y, s: 5 * (p.tam || 1), sy: 4 * (p.tam || 1), color: hash(p.x + p.y) < 0.5 ? '#4f8d3d' : '#5c9a45' })));
    this.instancias(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ roughness: 0.8 }), de('flores').flatMap((p) => [[0, 0], [2.5, 1.5], [-2, 2], [1, -2.4]].map(([dx, dz]) => ({ x: p.x + dx, y: 1.4, z: p.y + dz, s: 1.1, color: p.color || '#ffd166' }))), { sombra: false });
    this.instancias(new THREE.BoxGeometry(1, 0.3, 1), material('#ffffff', { roughness: 1 }), de('raya').map((p) => ({ x: p.x, y: 0.25, z: p.y, sx: p.w, sz: p.h, ry: p.rot || 0, color: p.color })), { sombra: false });
    for (const p of de('circulo')) { const r = new THREE.Mesh(new THREE.RingGeometry(p.r - 1.5, p.r, 48), material('#f4f1ea')); r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.3, p.y); this.world.add(r); }
    this.instancias(new THREE.BoxGeometry(60, 1, 14), material('#e6dcc6'), de('escalon').map((p, i) => ({ x: p.x, y: -1.4 + (5 - i) * 0.5, z: p.y })), { sombra: false });
    for (const p of de('fuente')) {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.y);
      pieza(g, new THREE.CylinderGeometry(9, 10, 3, 20), '#d8d0bf', 0, 1.5, 0);
      const agua = pieza(g, new THREE.CylinderGeometry(8, 8, 0.6, 20), '#5ec4ea', 0, 3, 0, { emissive: '#2f9fd0', emissiveIntensity: 0.35, roughness: 0.1 }); agua.castShadow = false;
      pieza(g, new THREE.CylinderGeometry(1.2, 1.6, 8, 8), '#d8d0bf', 0, 5, 0); pieza(g, new THREE.SphereGeometry(2.2, 10, 8), '#8fdcf5', 0, 9.5, 0, { emissive: '#5ec4ea', emissiveIntensity: 0.4 });
      this.world.add(g);
    }
    for (const p of de('cartel')) { const g = cartel(p.texto); g.position.set(p.x, 0, p.y); this.world.add(g); }
    for (const p of de('techito')) { const g = new THREE.Group(); g.position.set(p.x, 0, p.y); for (const [x, z] of [[-14, -7], [14, -7], [-14, 7], [14, 7]]) pieza(g, new THREE.CylinderGeometry(0.8, 0.8, 18, 6), '#d9d4c7', x, 9, z); pieza(g, new THREE.BoxGeometry(36, 2.5, 22), '#e2453a', 0, 19, 0); pieza(g, new THREE.BoxGeometry(36.4, 1, 22.4), '#f4f1ea', 0, 17.6, 0); this.world.add(g); }
    for (const p of de('bote')) { const g = new THREE.Group(); g.position.set(p.x, -0.8, p.y); g.rotation.y = p.rot || 0; pieza(g, new THREE.BoxGeometry(26, 4, 10), '#f4f1ea', 0, 1, 0); pieza(g, new THREE.BoxGeometry(26.4, 1.4, 10.4), '#2e86c1', 0, -0.4, 0); pieza(g, new THREE.BoxGeometry(8, 5, 7), '#d9d4c7', -4, 5, 0); pieza(g, new THREE.ConeGeometry(5, 8, 4), '#f4f1ea', 15, 1, 0).rotation.z = -Math.PI / 2; this.world.add(g); this.unicos.push({ g, bote: true, fase: p.x }); }
    for (const p of de('faro')) {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.y);
      const torre = new THREE.Mesh(new THREE.CylinderGeometry(5, 7.5, 54, 16), new THREE.MeshStandardMaterial({ map: franjas(['#e2453a', '#f4f1ea'], false), roughness: 0.6 }));
      torre.position.y = 27; torre.castShadow = true; g.add(torre);
      pieza(g, new THREE.CylinderGeometry(5.5, 5.5, 6, 12), '#fff6c9', 0, 57, 0, { emissive: '#ffd36a', emissiveIntensity: 1 });
      pieza(g, new THREE.ConeGeometry(6.5, 6, 12), '#2c3236', 0, 63, 0);
      const luz = new THREE.Mesh(new THREE.ConeGeometry(14, 120, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      luz.rotation.z = Math.PI / 2; luz.position.set(60, 57, 0);
      const giro = new THREE.Group(); giro.position.y = 0; giro.add(luz); g.add(giro);
      this.world.add(g); this.unicos.push({ g, faro: giro });
    }
  }
  // ---------------------------------------------------------------- botín y cofres
  agregarBotin(b) {
    if (this.loot.has(b.id)) return;
    const g = new THREE.Group(); g.position.set(b.x, 0, b.y);
    const modelo = new THREE.Group(); g.add(modelo);
    let colorAura = '#ffffff', alto = 0;
    if (b.tipo === 'cofre') {
      const { grupo, tapa } = modeloCofre();
      modelo.add(grupo); g.userData.tapa = tapa; colorAura = '#ffc84a'; alto = 46;
      const puntos = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(30), 3)), new THREE.PointsMaterial({ color: '#ffe9a0', size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(puntos); g.userData.chispas = puntos;
    } else if (ARMAS[b.tipo]) {
      const r = RAREZAS[b.rareza] || RAREZAS.comun;
      const arma = modeloArma(b.tipo, r.color); arma.rotation.y = Math.PI / 2; arma.position.y = 4; modelo.add(arma);
      colorAura = r.color; alto = ALTO_HAZ[b.rareza] || 0;
    } else if (OBJETOS[b.tipo]) { const c = modeloConsumible(b.tipo); c.position.y = 1.5; modelo.add(c); colorAura = COLOR_TIPO[b.tipo]; }
    else if (CAJAS[b.tipo]) { modelo.add(modeloMunicion(b.tipo)); colorAura = '#e8e2b0'; }
    else if (MATERIALES[b.tipo]) { modelo.add(modeloMaterial(b.tipo)); colorAura = COLOR_TIPO[b.tipo]; }
    const halo = aura(colorAura, alto); g.add(halo); g.userData.aura = halo;
    if (b.tipo === 'cofre') halo.children[0].scale.setScalar(30);
    g.userData.botin = b; g.userData.modelo = modelo;
    this.botinGrupo.add(g); this.loot.set(b.id, g);
  }
  // agarrar: el objeto vuela hasta la persona, se achica y deja un destello del color de la rareza
  agarrar(id, p) {
    const g = this.loot.get(id); if (!g) return;
    g.userData.agarrado = { t0: performance.now(), p, x: g.position.x, y: g.position.z };
    const b = g.userData.botin;
    const color = ARMAS[b.tipo] ? (RAREZAS[b.rareza] || RAREZAS.comun).color : COLOR_TIPO[b.tipo] || '#f4e6c8';
    setTimeout(() => this.golpe(p.x, p.y, color), 220);
  }
  soltarAgarrado(id) { const g = this.loot.get(id); if (g) delete g.userData.agarrado; }
  quitarBotin(id) { const g = this.loot.get(id); if (g) { this.botinGrupo.remove(g); this.loot.delete(id); } }
  // Lo que se rompió con el pico (árboles, rocas, autos o paredes)
  actualizarFuentes(m) {
    const rotos = new Set(m.obstaculos.filter((o) => o.roto).map((o) => o.id));
    this.yaRotos ??= new Set();
    for (const o of m.obstaculos) if (o.roto && !this.yaRotos.has(o.id)) {
      this.yaRotos.add(o.id);
      const color = o.tipo === 'arbol' ? '#5a9444' : o.material === 'metal' ? '#9fb7c2' : o.material === 'madera' ? '#b98552' : '#a7aba4';
      this.golpe(o.x, o.y, color); this.golpe(o.x, o.y, o.tipo === 'arbol' ? '#7a5a3c' : color); this.explosion(o.x, o.y, false);
    }
    const d = new THREE.Object3D();
    for (const { inst, ids } of this.obstaculosInst) {
      let cambio = false;
      ids.forEach((id, i) => { if (rotos.has(id) && !inst.userData['r' + i]) { inst.userData['r' + i] = 1; inst.getMatrixAt(i, d.matrix); d.matrix.decompose(d.position, d.quaternion, d.scale); d.scale.setScalar(0); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); cambio = true; } });
      if (cambio) inst.instanceMatrix.needsUpdate = true;
    }
    for (const u of this.unicos) if (u.o && rotos.has(u.o.id)) u.g.visible = false;
    if (this.copas) for (const inst of [this.copas, this.copas2, this.pinos1, this.pinos2, this.palmas]) {
      if (!inst) continue;
      const lista = inst === this.pinos1 || inst === this.pinos2 ? m.obstaculos.filter((o) => o.tipo === 'arbol' && o.forma === 'pino') : inst === this.palmas ? m.obstaculos.filter((o) => o.tipo === 'arbol' && o.forma === 'palmera') : m.obstaculos.filter((o) => o.tipo === 'arbol' && (!o.forma || o.forma === 'redondo'));
      let cambio = false;
      lista.forEach((o, i) => { if (o.roto && !inst.userData['r' + i]) { inst.userData['r' + i] = 1; inst.getMatrixAt(i, d.matrix); d.matrix.decompose(d.position, d.quaternion, d.scale); d.scale.setScalar(0); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); cambio = true; } });
      if (cambio) inst.instanceMatrix.needsUpdate = true;
    }
    // paredes rotas: se bajan y queda el escombro
    let cambio = false;
    m.t.forEach((v, i) => {
      if (v === T.PARED || this.indicePared[i] < 0 || this.rotas.has(i)) return;
      this.rotas.add(i); cambio = true;
      const k = this.indicePared[i];
      this.datosParedes[k].alto = 0.01;
      d.position.set((i % TAM + 0.5) * BALDOSA, -0.8, ((i / TAM | 0) + 0.5) * BALDOSA); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix();
      if (this.escombros.count < 800) { this.escombros.setMatrixAt(this.escombros.count, d.matrix); this.escombros.count++; this.escombros.instanceMatrix.needsUpdate = true; }
    });
    if (cambio) this.ajustarParedes(this.cortada ?? -1, true);
  }
  // Baja las paredes del edificio donde estás (para ver adentro) y esconde sus ventanas
  ajustarParedes(k, forzar = false) {
    if (!this.paredes || (k === this.cortada && !forzar)) return;
    const anterior = this.cortada;
    this.cortada = k;
    const d = new THREE.Object3D();
    const poner = (casa, bajas) => {
      for (const i of this.paredesDeCasa[casa] || []) {
        const p = this.datosParedes[i];
        d.position.set(p.x, -2, p.z); d.rotation.set(0, 0, 0); d.scale.set(1, p.alto < 0.1 ? 0.01 : bajas ? Math.min(p.alto, 6) : p.alto, 1); d.updateMatrix();
        this.paredes.setMatrixAt(i, d.matrix);
      }
      for (const i of this.ventanasDeCasa[casa] || []) {
        const v = this.datosVentanas[i];
        d.position.set(v.x, v.y, v.z); d.rotation.set(0, v.ry, 0); d.scale.setScalar(bajas ? 0 : 1); d.updateMatrix();
        this.ventanas.setMatrixAt(i, d.matrix);
      }
    };
    if (forzar) this.mundo.casas.forEach((_, c) => poner(c, c === k));
    else { if (anterior >= 0) poner(anterior, false); if (k >= 0) poner(k, true); }
    this.paredes.instanceMatrix.needsUpdate = true;
    if (this.ventanas) this.ventanas.instanceMatrix.needsUpdate = true;
  }

  apuntar(x, y) { this.ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), this.camera); const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.plane, p)) return { x: this.camera.position.x, y: this.camera.position.z - 100 }; return { x: p.x, y: p.z }; }
  proyectar(x, y, height = 0) { const p = new THREE.Vector3(x, height, y).project(this.camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, detras: p.z > 1 }; }
  explosion(x, y, grande = true) {
    const n = grande ? 26 : 10;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geoChispa ??= new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? '#fff1b0' : i % 3 === 1 ? '#ffb347' : '#ec5f3a', transparent: true }));
      m.position.set(x, 4, y); this.scene.add(m);
      this.effects.push({ m, t: 0.8, total: 0.8, v: new THREE.Vector3((Math.random() - 0.5) * 90, Math.random() * 70 + 10, (Math.random() - 0.5) * 90) });
    }
    if (grande) {
      const humo = new THREE.Mesh(this.geoHumo ??= new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.8, depthWrite: false }));
      humo.position.set(x, 6, y); this.scene.add(humo);
      this.effects.push({ m: humo, t: 0.6, total: 0.6, v: new THREE.Vector3(), crece: 40 });
    }
  }
  // fuegos artificiales (para el que gana)
  fuego(x, y) {
    const colores = ['#ff3b5c', '#ffd23f', '#5ee36a', '#3fb5ff', '#c58aff', '#ffffff'];
    const c1 = colores[Math.floor(Math.random() * colores.length)], c2 = colores[Math.floor(Math.random() * colores.length)];
    const alto = 45 + Math.random() * 30;
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(this.geoChispa ??= new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? c1 : c2, transparent: true }));
      m.position.set(x, alto, y); m.scale.setScalar(0.8); this.scene.add(m);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, v = 45 + Math.random() * 25;
      this.effects.push({ m, t: 1.3, total: 1.3, v: new THREE.Vector3(Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v * 0.6 + 20, Math.sin(a) * Math.cos(b) * v), suave: true });
    }
  }
  golpe(x, y, color = '#f4e6c8') {
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this.geoChispa ??= new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(x, 8, y); m.scale.setScalar(0.6); this.scene.add(m);
      this.effects.push({ m, t: 0.45, total: 0.45, v: new THREE.Vector3((Math.random() - 0.5) * 50, Math.random() * 40, (Math.random() - 0.5) * 50) });
    }
  }
  actualizarConstrucciones(piezas) {
    this.clear(this.edificios);
    this.piezasInst = [];
    const colores = { madera: '#b07a47', piedra: '#a9ada7', metal: '#8fb2c1' };
    const dummy = new THREE.Object3D();
    for (const mat of Object.keys(colores)) for (const tipo of ['pared', 'escalera']) {
      const lista = piezas.filter((p) => p.vida > 0 && p.material === mat && p.tipo === tipo);
      if (!lista.length) continue;
      const geo = new THREE.BoxGeometry(tipo === 'pared' ? 32 : 28, tipo === 'pared' ? 24 : 7, tipo === 'pared' ? 3 : 30);
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: colores[mat], roughness: mat === 'metal' ? 0.4 : 0.85, metalness: mat === 'metal' ? 0.5 : 0, map: tipo === 'pared' ? this.texturaPieza(mat) : null }), lista.length);
      const ahora = Date.now();
      lista.forEach((p, i) => { const altura = tipo === 'pared' ? 24 : 7; const progreso = Math.max(0.05, Math.min(1, (ahora - p.inicio) / 1000)); dummy.position.set(p.x, (altura * progreso) / 2, p.y); dummy.rotation.set(tipo === 'escalera' ? 0.24 : 0, p.rotacion * Math.PI / 2, 0); dummy.scale.set(1, progreso, 1); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); });
      inst.castShadow = true; inst.receiveShadow = true; this.edificios.add(inst);
      this.piezasInst.push({ inst, lista, tipo });
    }
  }
  texturaPieza(mat) {
    this.texPiezas ??= {};
    if (!this.texPiezas[mat]) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3;
      if (mat === 'madera') for (let y = 0; y < 64; y += 16) { g.strokeRect(0, y, 64, 16); }
      else if (mat === 'piedra') for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < 64; x += 32) g.strokeRect(x, y, 32, 16);
      else { g.strokeRect(4, 4, 56, 56); g.beginPath(); g.moveTo(4, 4); g.lineTo(60, 60); g.moveTo(60, 4); g.lineTo(4, 60); g.stroke(); }
      this.texPiezas[mat] = new THREE.CanvasTexture(c); this.texPiezas[mat].colorSpace = THREE.SRGBColorSpace;
    }
    return this.texPiezas[mat];
  }

  // ---------------------------------------------------------------- dibujar un cuadro
  dibujar({ mundo, gente, balas, tomados, abiertos = new Set(), foco, W, H, dt, ms, zona, granadas = [], colectivo = null, marca = null }) {
    const width = this.renderer.domElement.clientWidth, height = this.renderer.domElement.clientHeight;
    if (this.w !== width || this.h !== height) { this.w = width; this.h = height; this.renderer.setSize(width, height, false); }
    this.agua.uniforms.t.value = ms / 1000;
    this.camera = this.modoCamara === 'tercera' ? this.tercera : this.ortho;
    const alzada = foco.enColectivo ? 150 : foco.altura || 0;
    // más alto, más lejos: en el colectivo y en la caída se ve más isla
    const zoomObj = (foco.enColectivo ? 2.7 : 1 + Math.min(1.7, alzada / 70)) * (this.acercar || 1);
    this.zoom += (zoomObj - this.zoom) * Math.min(1, dt * 2.5);
    if (this.modoCamara === 'tercera') {
      this.tercera.aspect = width / Math.max(1, height); this.tercera.updateProjectionMatrix();
      const lejos = this.zoom, yaw = this.yaw || 0, inc = this.inclina ?? 1;
      const atras = 70 * lejos, alto = 62 * lejos * inc;
      this.camera.position.set(foco.x + Math.sin(yaw) * atras, alzada + alto, foco.y + Math.cos(yaw) * atras);
      this.camera.lookAt(foco.x - Math.sin(yaw) * 40, alzada + 6, foco.y - Math.cos(yaw) * 40);
    } else {
      const w = W * this.zoom, h = H * this.zoom;
      Object.assign(this.ortho, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 }); this.ortho.updateProjectionMatrix();
      this.camera.position.set(foco.x, alzada + 340, foco.y + 220); this.camera.lookAt(foco.x, alzada * 0.65, foco.y);
    }
    this.sun.position.set(foco.x - 120, 300, foco.y - 160); this.sun.target.position.set(foco.x, 0, foco.y);
    const sombra = Math.max(340, 260 * this.zoom);
    if (Math.abs(this.sun.shadow.camera.right - sombra) > 30) { Object.assign(this.sun.shadow.camera, { left: -sombra, right: sombra, top: sombra, bottom: -sombra }); this.sun.shadow.camera.updateProjectionMatrix(); }
    // colectivo
    this.colectivo.visible = !!colectivo;
    if (colectivo) { this.colectivo.position.set(colectivo.x, 150 + Math.sin(ms / 700) * 2, colectivo.y); this.colectivo.rotation.y = -colectivo.angulo; this.colectivo.userData.fuego.scale.setScalar(0.8 + Math.sin(ms / 60) * 0.25); }
    // edificio donde estoy: techo afuera y paredes bajas
    const fx = Math.floor(foco.x / BALDOSA), fy = Math.floor(foco.y / BALDOSA);
    let adentro = -1;
    if (alzada < 5 && this.mundo) this.mundo.casas.forEach((c, k) => { if (c.tipo === 'casa' && fx >= c.x && fx < c.x + c.w && fy >= c.y && fy < c.y + c.h) adentro = k; });
    this.ajustarParedes(adentro);
    for (const t of this.techos || []) {
      const obj = t.k === adentro ? 0 : 1;
      if (t.op !== obj) { t.op += Math.sign(obj - t.op) * Math.min(Math.abs(obj - t.op), dt * 5); for (const m of t.mats) { m.opacity = t.op; m.depthWrite = t.op > 0.95; } t.g.visible = t.op > 0.02; }
    }
    // copas de árboles: se achican las que te tapan
    this.ralear(foco, alzada);
    for (const u of this.unicos || []) { if (u.faro) u.faro.rotation.y = ms / 1400; if (u.bote) u.g.position.y = -0.8 + Math.sin(ms / 800 + u.fase) * 0.5; }
    // construcciones que se están armando
    for (const { inst, lista, tipo } of this.piezasInst || []) if (lista.some((p) => Date.now() - p.inicio < 1000)) {
      const dummy = new THREE.Object3D();
      lista.forEach((p, i) => { const altura = tipo === 'pared' ? 24 : 7, progreso = Math.max(0.05, Math.min(1, (Date.now() - p.inicio) / 1000)); dummy.position.set(p.x, (altura * progreso) / 2, p.y); dummy.rotation.set(tipo === 'escalera' ? 0.24 : 0, p.rotacion * Math.PI / 2, 0); dummy.scale.set(1, progreso, 1); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); });
      inst.instanceMatrix.needsUpdate = true;
    }
    this.dibujarGente(gente, balas, mundo, dt, ms);
    this.dibujarBotin(tomados, abiertos, foco, ms, dt);
    this.dibujarBalas(balas, granadas);
    this.effects = this.effects.filter((e) => {
      e.t -= dt; e.m.position.addScaledVector(e.v, dt); e.v.y -= (e.suave ? 25 : 90) * dt; if (e.suave) e.v.multiplyScalar(1 - dt * 1.2);
      const k = Math.max(0, e.t / e.total);
      if (e.crece) { e.m.scale.setScalar(4 + (1 - k) * e.crece); e.m.material.opacity = k * 0.8; } else { e.m.scale.setScalar(Math.max(0.05, k * 1.2)); e.m.material.opacity = k; }
      if (e.t <= 0) { this.scene.remove(e.m); e.m.material.dispose(); return false; }
      return true;
    });
    // tormenta
    this.zone.visible = this.ring.visible = this.velo.visible = !!zona;
    if (zona) {
      this.zone.position.set(zona.x, 70, zona.y); this.zone.scale.set(zona.r, 1, zona.r);
      this.texTormenta.offset.x = (ms / 9000) % 1;
      this.ring.position.set(zona.x, 0.6, zona.y); this.ring.scale.setScalar(zona.r);
      this.velo.position.set(zona.x, 0.8, zona.y); this.velo.scale.setScalar(Math.max(zona.r, 1));
    }
    this.marca.visible = !!marca;
    if (marca) { this.marca.position.set(marca.x, 0, marca.y); this.marca.userData.diamante.rotation.y = ms / 500; this.marca.userData.diamante.position.y = 30 + Math.sin(ms / 300) * 3; }
    this.renderer.render(this.scene, this.camera);
  }
  ralear(foco, alzada) {
    if (!this.mundo || !this.copas) return;
    const cerca = alzada > 5 ? [] : this.mundo.obstaculos.filter((o) => o.tipo === 'arbol' && !o.roto && Math.abs(o.x - foco.x) < 34 && o.y - foco.y < 40 && o.y - foco.y > -22).map((o) => o.id);
    const clave = cerca.join();
    if (clave === this.claveRaleo) return;
    this.claveRaleo = clave;
    const set = new Set(cerca), d = new THREE.Object3D();
    const aplicar = (inst, lista, base) => {
      if (!inst) return;
      lista.forEach((o, i) => {
        if (inst.userData['r' + i]) return;
        const p = base(o); const k = set.has(o.id) ? 0.28 : 1;
        d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.ry || 0, 0); d.scale.set(p.sx * k, p.sy * k, p.sz * k); d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
    };
    const os = this.mundo.obstaculos;
    const redondos = os.filter((o) => o.tipo === 'arbol' && (!o.forma || o.forma === 'redondo')), pinos = os.filter((o) => o.tipo === 'arbol' && o.forma === 'pino');
    aplicar(this.copas, redondos, (o) => ({ x: o.x, y: 19, z: o.y, sx: o.copa || 13, sy: (o.copa || 13) * 0.95, sz: o.copa || 13, ry: o.tono * 6 }));
    aplicar(this.copas2, redondos, (o) => { const s = (o.copa || 13) * 0.62; return { x: o.x + 4, y: 26, z: o.y - 3, sx: s, sy: s, sz: s, ry: o.tono * 3 }; });
    aplicar(this.pinos1, pinos, (o) => ({ x: o.x, y: 8, z: o.y, sx: 11, sy: 18, sz: 11 }));
    aplicar(this.pinos2, pinos, (o) => ({ x: o.x, y: 18, z: o.y, sx: 8, sy: 15, sz: 8 }));
  }
  dibujarGente(gente, balas, mundo, dt, ms) {
    const ids = new Set(gente.map((p) => p.id));
    for (const p of gente) {
      if (p.enColectivo) continue;
      let a = this.people.get(p.id);
      if (!a) {
        const persona = crearPersona(THREE, p.look, { sombras: true });
        persona.grupo.scale.setScalar(10);
        const raiz = new THREE.Group(); raiz.add(persona.grupo); this.scene.add(raiz);
        const mano = new THREE.Group(); mano.position.set(0.27, 1.02, -0.36); persona.grupo.add(mano);
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#ffe5a1' })); flash.visible = false; mano.add(flash);
        const paracaidas = modeloParacaidas(); paracaidas.scale.setScalar(0.01); paracaidas.visible = false; persona.grupo.add(paracaidas);
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#6df090' })); anillo.rotation.x = Math.PI / 2; anillo.position.y = 2.45; anillo.visible = false; persona.grupo.add(anillo);
        const objeto = new THREE.Group(); objeto.position.set(0.32, 1.05, -0.3); objeto.scale.setScalar(0.07); objeto.visible = false; persona.grupo.add(objeto);
        const particulas = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(this.geoPart ??= new THREE.OctahedronGeometry(0.055, 0), new THREE.MeshBasicMaterial({ color: '#6df090' })); m.visible = false; persona.grupo.add(m); return m; });
        const sombraAire = new THREE.Mesh(this.geoSombra ??= new THREE.CircleGeometry(5, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
        sombraAire.rotation.x = -Math.PI / 2; sombraAire.visible = false; this.scene.add(sombraAire);
        a = { persona, raiz, mano, flash, paracaidas, para: 0, anillo, objeto, objetoTipo: null, particulas, sombraAire, armaTipo: null, death: 0, alive: true, health: p.vida };
        this.people.set(p.id, a);
      }
      // arma en la mano: el modelo de la que tiene
      const tipoArma = ARMAS[p.arma] && !p.gesto && !p.usando ? p.arma : null;
      if (a.armaTipo !== tipoArma) {
        for (const h of [...a.mano.children]) if (h !== a.flash) a.mano.remove(h);
        a.armaTipo = tipoArma;
        if (tipoArma) { const m = modeloArma(tipoArma, RAREZAS[p.rareza]?.color || '#b9b9b9'); m.scale.setScalar(0.055); m.position.set(0, 0, -0.05); a.mano.add(m); a.flash.position.z = -0.75; }
      }
      const enEscalera = (mundo.construcciones || []).some((c) => c.vida > 0 && c.tipo === 'escalera' && Math.abs(c.x - p.x) < 16 && Math.abs(c.y - p.y) < 16);
      const alto = p.altura || (p.nivel || enEscalera ? 7 : 0);
      a.raiz.position.set(p.x, alto, p.y);
      a.raiz.rotation.y = -p.ang - Math.PI / 2;
      // caída libre (de panza) y planeador
      const cayendo = p.altura > 0 && !p.paracaidas;
      a.persona.grupo.rotation.x += ((cayendo ? -1.25 : 0) - a.persona.grupo.rotation.x) * Math.min(1, dt * 6);
      const paraObj = p.paracaidas && p.altura > 0 ? 1 : 0;
      a.para += (paraObj - a.para) * Math.min(1, dt * (paraObj ? 5 : 8));
      a.paracaidas.visible = a.para > 0.02;
      a.paracaidas.scale.set(Math.max(0.01, a.para), Math.max(0.01, a.para * a.para), Math.max(0.01, a.para));
      a.paracaidas.rotation.z = p.mueve ? Math.sin(ms / 400) * 0.08 : 0;
      a.sombraAire.visible = p.altura > 2;
      if (a.sombraAire.visible) { a.sombraAire.position.set(p.x, 0.6, p.y); a.sombraAire.scale.setScalar(Math.max(0.3, 1 - p.altura / 140)); }
      // curarse y escudarse: anillo de progreso, objeto en la mano y partículas
      const uso = p.usando, esEscudo = uso && (uso.tipo === 'mini' || uso.tipo === 'escudo');
      a.anillo.visible = !!uso;
      if (a.objetoTipo !== (uso?.tipo || null)) {
        a.objeto.clear(); a.objetoTipo = uso?.tipo || null;
        if (uso) a.objeto.add(modeloConsumible(uso.tipo));
      }
      a.objeto.visible = !!uso;
      if (uso) {
        const progreso = uso.progreso ?? 1 - uso.restante / uso.total;
        a.anillo.scale.setScalar(0.3 + progreso * 0.7); a.anillo.material.color.set(esEscudo ? '#76b5ff' : '#6df090');
        a.objeto.rotation.y = ms / 300; a.objeto.position.y = 1.1 + Math.sin(ms / 150) * 0.05;
      }
      a.particulas.forEach((m, i) => { m.visible = !!uso; if (uso) { const ang = (i * 6.28) / 8 + ms / 700; m.position.set(Math.cos(ang) * 0.55, 0.2 + ((ms / 700 + i * 0.13) % 1.8), Math.sin(ang) * 0.55); m.material.color.set(esEscudo ? (i % 2 ? '#9fd0ff' : '#5aa0ff') : i % 2 ? '#6df090' : '#d6ffe0'); } });
      if (p.vivo) {
        a.death = 0;
        const fire = balas.some((b) => b.de === p.id && Math.hypot(b.x - p.x, b.y - p.y) < 30);
        const conModelo = !!p.look?.modelo;
        const estado = p.gesto ? 'g-' + p.gesto : p.altura > 0 ? 'quieto' : p.agachado && conModelo && !p.usando ? 'agachadoLado' : { mueve: p.mueve, corre: p.mueve && !p.agachado, velocidad: p.mueve ? (p.agachado ? 0.5 : 1) : 0, apunta: !!tipoArma, dispara: fire, recargando: p.recargando > 0, curando: !!p.usando, golpe: p.vida < a.health };
        a.persona.animar(estado, dt);
        // agachado: los muñecos sin animación propia se achican un poco y se inclinan
        const agacha = p.agachado && !conModelo && !(p.altura > 0) ? 1 : 0;
        a.agacha = (a.agacha || 0) + (agacha - (a.agacha || 0)) * Math.min(1, dt * 10);
        a.persona.grupo.scale.set(10, 10 * (1 - a.agacha * 0.26), 10);
        if (!(p.altura > 0)) a.persona.grupo.rotation.x = -a.agacha * 0.22;
        a.health = p.vida; a.flash.visible = fire && Math.random() < 0.6;
        a.mano.visible = !p.gesto;
      }
      a.alive = p.vivo;
    }
    for (const [id, a] of this.people) {
      if (!ids.has(id) || !a.alive) {
        a.death += dt; a.persona.animar({ muerto: true, caido: true }, dt); a.mano.visible = false; a.paracaidas.visible = false; a.sombraAire.visible = false;
        if (a.death > 1.8) a.persona.grupo.scale.setScalar(Math.max(0, 1 - (a.death - 1.8)) * 10);
        if (a.death > 3) { this.scene.remove(a.raiz); this.scene.remove(a.sombraAire); a.persona.dispose?.(); this.people.delete(id); }
      }
    }
  }
  dibujarBotin(tomados, abiertos, foco, ms, dt) {
    const ahora = performance.now();
    for (const [id, g] of this.loot) {
      const b = g.userData.botin;
      const lejos = Math.abs(b.x - foco.x) > 700 || Math.abs(b.y - foco.y) > 520;
      if (b.tipo === 'cofre') {
        g.visible = !lejos;
        if (lejos) continue;
        const abierto = abiertos.has(b.id);
        if (abierto && !g.userData.abrio) { g.userData.abrio = ahora; this.explosion(b.x, b.y, false); }
        const k = abierto ? Math.min(1, (ahora - g.userData.abrio) / 380) : 0;
        g.userData.tapa.rotation.x = -1.9 * (1 - (1 - k) * (1 - k));
        g.userData.aura.visible = !abierto || k < 1;
        g.userData.aura.children.forEach((c) => (c.material.opacity = (abierto ? 1 - k : 1) * (c.geometry.type === 'PlaneGeometry' ? 0.85 + Math.sin(ms / 300) * 0.15 : 0.6)));
        const pts = g.userData.chispas; pts.visible = !abierto;
        if (!abierto) { const pos = pts.geometry.attributes.position; for (let i = 0; i < 10; i++) { const a = ms / 900 + (i * 6.28) / 10, h = ((ms / 1400 + i * 0.37) % 1) * 22; pos.setXYZ(i, Math.cos(a) * 9, 3 + h, Math.sin(a) * 9); } pos.needsUpdate = true; }
        continue;
      }
      const ag = g.userData.agarrado;
      if (ag) {
        const k = (ahora - ag.t0) / 260;
        g.visible = k < 1;
        if (k < 1) {
          const e = k * k;
          g.position.set(ag.x + (ag.p.x - ag.x) * e, Math.sin(k * Math.PI) * 10 + 4 * e, ag.y + (ag.p.y - ag.y) * e);
          g.scale.setScalar(Math.max(0.05, 1 - e * 0.9));
          g.userData.modelo.rotation.y += dt * 20;
          g.userData.aura.visible = false;
        }
        continue;
      }
      g.scale.setScalar(1); g.userData.aura.visible = true;
      const visible = !tomados.has(id) && (b.cofre === undefined || abiertos.has(b.cofre)) && !lejos;
      g.visible = visible;
      if (!visible) continue;
      const fase = typeof id === 'number' ? id : 0;
      // al abrir el cofre, el botín salta afuera
      let sx = 0, sy = 0, sz = 0;
      if (b.cofre !== undefined) {
        const c = this.loot.get(b.cofre)?.userData;
        const t0 = c?.abrio || 0;
        const k = t0 ? Math.min(1, (ahora - t0 - 120) / 480) : 1;
        if (k < 1 && c) { const cb = c.botin; const kk = Math.max(0, k); sx = (cb.x - b.x) * (1 - kk); sz = (cb.y - b.y) * (1 - kk); sy = Math.sin(kk * Math.PI) * 18; }
      }
      g.position.set(b.x + sx, sy, b.y + sz);
      g.userData.modelo.position.y = 2 + Math.sin(ms / 420 + fase) * 1.2;
      g.userData.modelo.rotation.y = ms / 1300 + fase;
      g.userData.aura.children[0].material.opacity = 0.65 + Math.sin(ms / 350 + fase) * 0.2;
    }
  }
  dibujarBalas(balas, granadas) {
    const traza = this.geoTraza ??= new THREE.BoxGeometry(9, 0.7, 0.7);
    let n = 0, c = 0;
    for (const b of balas) {
      if (b.tipo === 'rpg') {
        let m = this.cohetes[c];
        if (!m) { m = new THREE.Group(); pieza(m, new THREE.CylinderGeometry(1, 1, 7, 8), '#5b6b3c', 0, 0, 0).rotation.z = Math.PI / 2; pieza(m, new THREE.ConeGeometry(1.1, 3, 8), '#3d6b2b', 5, 0, 0).rotation.z = -Math.PI / 2; const f = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' })); f.position.x = -5; m.add(f); this.bullets.add(m); this.cohetes[c] = m; }
        m.visible = true; m.position.set(b.x, 8, b.y); m.rotation.y = -Math.atan2(b.vy, b.vx); c++;
        continue;
      }
      let m = this.trazas[n];
      if (!m) { m = new THREE.Mesh(traza, new THREE.MeshBasicMaterial({ color: '#ffe59b' })); this.bullets.add(m); this.trazas[n] = m; }
      m.visible = true; m.position.set(b.x, 8, b.y); m.rotation.y = -Math.atan2(b.vy, b.vx);
      m.material.color.set(b.tipo === 'francotirador' ? '#bfe3ff' : '#ffe59b');
      m.scale.x = b.tipo === 'francotirador' ? 3 : 1;
      n++;
    }
    for (let i = n; i < this.trazas.length; i++) this.trazas[i].visible = false;
    for (let i = c; i < this.cohetes.length; i++) this.cohetes[i].visible = false;
    let k = 0;
    for (const gr of granadas) {
      let m = this.bombas[k];
      if (!m) { m = modeloConsumible('granada'); m.scale.setScalar(0.8); this.bullets.add(m); this.bombas[k] = m; }
      m.visible = true; m.position.set(gr.x, 1 + Math.sin(Math.min(1, gr.t / 0.8) * Math.PI) * 20, gr.y); m.rotation.x = gr.t * 8; k++;
    }
    for (let i = k; i < this.bombas.length; i++) this.bombas[i].visible = false;
  }
  dispose() { this.renderer.dispose(); }
}
