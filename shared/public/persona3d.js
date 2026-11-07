// Personajes 3D de cadalado (carrera, blackjack…), estilo personaje de película animada:
// proporciones de persona (cabeza un poco grande), ojos expresivos, pelo con volumen y ropa con detalle.
// Recibe THREE para no duplicar la librería.
// crearPersona(THREE, look) → { grupo, cabeza, altura, decir(texto, seg), animar(estado, dt) }
// look: ver shared/public/npcs.js (piel, pelo, ojos, cuerpo, ropa, barba, lentes, kipa, sombrero, capa, robot, dorado, smoking, auriculares)

const ANCHO = { flaco: 0.15, normal: 0.17, gordito: 0.21 };
const CADERA = 0.78; // altura de la cadera parado
const CABEZA_Y = 0.78; // centro de la cabeza respecto de la cadera (queda a ~1.56 del piso)

export function crearPersona(THREE, look = {}, { nombre = '', colorNombre = '#ffffff', sombras = true, tamCartel = 0.65, tamGlobo = 0.5 } = {}) {
  const L = {
    piel: '#e8c4a8',
    ojos: '#5a3a22',
    cuerpo: 'normal',
    pelo: { estilo: 'corto', color: '#2b1d14' },
    ...look,
    ropa: { remera: '#7aa2ff', pantalon: '#3a4256', ...(look.ropa || {}) },
  };
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, ...extra });
  const piel = L.robot ? mat(L.piel, { metalness: 0.65, roughness: 0.3 }) : mat(L.piel, { roughness: 0.48 });
  const camisa = mat(L.smoking ? '#f6f4ee' : L.ropa.remera);
  const saco = mat('#121216', { roughness: 0.5 });
  const pantalon = mat(L.smoking ? '#121216' : L.ropa.pantalon, { roughness: 0.75 });
  const bota = mat(L.smoking ? '#0b0b0b' : '#5b3a26', { roughness: 0.45 });
  const suela = mat('#2a1a10', { roughness: 0.8 });
  const cuero = mat('#4a2c1a', { roughness: 0.5 });
  const metal = mat('#d4af37', { metalness: 0.7, roughness: 0.3 });
  const pelo = mat(L.pelo.color, { roughness: 0.75 });
  const ancho = ANCHO[L.cuerpo] || ANCHO.normal;
  const gordo = L.cuerpo === 'gordito';
  const g = new THREE.Group();
  const cuerpo = new THREE.Group(); // todo lo que se anima
  g.add(cuerpo);
  const malla = (geo, m, x = 0, y = 0, z = 0, padre = cuerpo) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = sombras;
    padre.add(o);
    return o;
  };
  const capsula = (r, largo, m, x, y, z, padre) => malla(new THREE.CapsuleGeometry(r, largo, 6, 14), m, x, y, z, padre);
  const esfera = (r, m, x, y, z, padre, seg = 16) => malla(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)), m, x, y, z, padre);

  // ---------------------------------------------------------------- piernas (cadera → rodilla → bota)
  const pierna = (lado) => {
    const p = new THREE.Group();
    p.position.set(lado * ancho * 0.5, CADERA, 0);
    capsula(gordo ? 0.1 : 0.088, 0.22, pantalon, 0, -0.18, 0, p);
    const rodilla = new THREE.Group();
    rodilla.position.y = -0.36;
    p.add(rodilla);
    capsula(0.074, 0.17, pantalon, 0, -0.13, 0, rodilla);
    if (!L.smoking && !L.robot) malla(new THREE.TorusGeometry(0.078, 0.02, 8, 18), L.ropa.botamanga ? mat(L.ropa.botamanga) : pantalon, 0, -0.27, 0, rodilla).rotation.x = Math.PI / 2;
    // bota: caña, pie y suela
    malla(new THREE.CylinderGeometry(0.075, 0.08, 0.1, 16), bota, 0, -0.34, 0, rodilla);
    const pie = esfera(0.08, bota, 0, -0.385, -0.05, rodilla);
    pie.scale.set(1.05, 0.62, 1.6);
    malla(new THREE.BoxGeometry(0.16, 0.025, 0.27), suela, 0, -0.41, -0.045, rodilla);
    cuerpo.add(p);
    return { cadera: p, rodilla };
  };
  const pI = pierna(-1);
  const pD = pierna(1);

  // ---------------------------------------------------------------- torso
  const torso = new THREE.Group();
  torso.position.y = CADERA;
  cuerpo.add(torso);
  const pelvis = esfera(ancho * 1.02, pantalon, 0, 0.05, 0, torso);
  pelvis.scale.set(1, 0.7, gordo ? 0.95 : 0.78);
  // camisa (más ancha en los hombros) metida en el pantalón
  const pecho = malla(new THREE.CylinderGeometry(ancho * 1.08, ancho * 0.95, 0.34, 22), L.smoking ? saco : camisa, 0, 0.31, 0, torso);
  pecho.scale.z = gordo ? 0.95 : 0.74;
  const hombros = esfera(ancho * 1.08, L.smoking ? saco : camisa, 0, 0.48, 0, torso, 22);
  hombros.scale.set(1, 0.42, gordo ? 0.95 : 0.74);
  if (gordo) esfera(ancho * 0.92, L.smoking ? saco : camisa, 0, 0.24, -0.05, torso, 20).scale.set(1, 0.95, 1.05);
  const frente = -(ancho * (gordo ? 0.95 : 0.74)); // z del frente del pecho
  // cinturón con hebilla
  if (!L.robot) {
    const cint = malla(new THREE.CylinderGeometry(ancho * 0.97, ancho * 0.97, 0.05, 22, 1, true), cuero, 0, 0.14, 0, torso);
    cint.scale.z = gordo ? 0.97 : 0.8;
    malla(new THREE.BoxGeometry(0.06, 0.045, 0.015), metal, 0, 0.14, frente * (gordo ? 1.02 : 1.08) - 0.005, torso);
  }
  if (L.smoking) {
    // camisa blanca en V, moño, solapas y botones
    const v = malla(new THREE.CylinderGeometry(0.001, ancho * 0.55, 0.3, 3), camisa, 0, 0.36, frente - 0.002, torso);
    v.rotation.x = Math.PI;
    v.scale.z = 0.18;
    malla(new THREE.BoxGeometry(0.11, 0.04, 0.03), mat('#0b0b0b'), 0, 0.5, frente - 0.01, torso);
    for (const x of [-1, 1]) {
      const sol = malla(new THREE.BoxGeometry(0.035, 0.2, 0.015), mat('#1d1d22', { roughness: 0.3 }), x * ancho * 0.32, 0.38, frente - 0.008, torso);
      sol.rotation.z = x * 0.3;
    }
    for (const y of [0.26, 0.19]) esfera(0.011, metal, 0, y, frente - 0.006, torso, 8);
  } else if (!L.robot) {
    // cuello de la camisa, botones y bolsillo
    for (const x of [-1, 1]) {
      const c = malla(new THREE.BoxGeometry(0.07, 0.012, 0.06), camisa, x * 0.04, 0.53, -0.07, torso);
      c.rotation.set(0.5, x * 0.5, x * 0.35);
    }
    for (const y of [0.42, 0.34, 0.26]) esfera(0.009, mat('#f4f1ea', { roughness: 0.3 }), 0, y, frente - 0.004, torso, 8);
    malla(new THREE.BoxGeometry(0.07, 0.06, 0.008), mat(L.ropa.franja || L.ropa.remera, { roughness: 0.7 }), -ancho * 0.45, 0.4, frente + 0.002, torso);
    if (L.ropa.franja) malla(new THREE.CylinderGeometry(ancho * 1.06, ancho * 1.01, 0.035, 22, 1, true), mat(L.ropa.franja), 0, 0.31, 0, torso).scale.z = gordo ? 0.96 : 0.75;
  }
  if (L.capa) {
    const capa = malla(new THREE.PlaneGeometry(ancho * 2.6, 0.95), mat(L.capa, { side: THREE.DoubleSide }), 0, 0.05, -frente + 0.03, torso);
    capa.rotation.x = 0.12;
  }
  if (L.robot) malla(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), mat('#38d9e6', { emissive: '#38d9e6', emissiveIntensity: 0.8 }), 0, 0.36, frente, torso).rotation.x = Math.PI / 2;
  // cuello
  capsula(0.055, 0.06, piel, 0, 0.58, 0, torso);

  // ---------------------------------------------------------------- brazos (hombro → codo → mano)
  const brazo = (lado) => {
    const b = new THREE.Group();
    b.position.set(lado * (ancho * 1.08 + 0.02), 0.47, 0);
    capsula(0.062, 0.16, L.smoking ? saco : camisa, 0, -0.12, 0, b);
    const codo = new THREE.Group();
    codo.position.y = -0.26;
    b.add(codo);
    if (L.smoking) {
      capsula(0.054, 0.15, saco, 0, -0.1, 0, codo);
      malla(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 12), camisa, 0, -0.2, 0, codo);
    } else {
      // manga arremangada y antebrazo
      malla(new THREE.TorusGeometry(0.058, 0.022, 8, 16), camisa, 0, 0.0, 0, codo).rotation.x = Math.PI / 2;
      capsula(0.05, 0.15, piel, 0, -0.1, 0, codo);
    }
    // mano con pulgar
    const mano = new THREE.Group();
    mano.position.y = -0.25;
    codo.add(mano);
    const m = L.guantes ? mat(L.guantes) : piel;
    esfera(0.052, m, 0, -0.02, 0, mano).scale.set(0.8, 1.15, 0.6);
    const pulgar = capsula(0.016, 0.03, m, -lado * 0.035, 0, -0.02, mano);
    pulgar.rotation.z = lado * 0.6;
    b.userData = { codo };
    torso.add(b);
    return b;
  };
  const bI = brazo(-1);
  const bD = brazo(1);
  const codoI = bI.userData.codo;
  const codoD = bD.userData.codo;

  // ---------------------------------------------------------------- cabeza
  const cabeza = new THREE.Group();
  cabeza.position.y = CABEZA_Y;
  torso.add(cabeza);
  const craneo = esfera(0.2, piel, 0, 0, 0, cabeza, 32);
  craneo.scale.set(gordo ? 1.02 : 0.95, 1.08, 0.97);
  // orejas
  if (!L.robot) for (const x of [-0.19, 0.19]) {
    const o = esfera(0.04, piel, x, -0.01, 0.01, cabeza, 12);
    o.scale.set(0.45, 1.05, 0.75);
  }
  // ojos grandes y expresivos
  const esclera = mat('#fbf8f3', { roughness: 0.2 });
  const iris = mat(L.robot ? '#38d9e6' : L.ojos, { roughness: 0.15, emissive: L.robot ? '#38d9e6' : '#000000', emissiveIntensity: L.robot ? 0.8 : 0 });
  const negro = mat('#0b0b0b', { roughness: 0.1 });
  const brillo = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const parpadoM = mat(L.piel, { roughness: 0.55 });
  const pestanaM = mat('#1e140f');
  const parpados = [];
  for (const x of [-0.075, 0.075]) {
    esfera(0.045, esclera, x, 0.005, -0.15, cabeza, 18).scale.set(1.05, 1.05, 0.55);
    esfera(0.03, iris, x * 0.97, 0.002, -0.168, cabeza, 16).scale.set(1, 1.05, 0.42);
    esfera(0.015, negro, x * 0.97, 0.002, -0.176, cabeza, 12).scale.set(1, 1, 0.35);
    esfera(0.008, brillo, x * 0.97 + 0.012, 0.016, -0.181, cabeza, 8);
    esfera(0.004, brillo, x * 0.97 - 0.01, -0.012, -0.18, cabeza, 6);
    // párpado (para parpadear) y pestañas
    const p = esfera(0.047, parpadoM, x, 0.008, -0.149, cabeza, 16);
    p.scale.set(1.08, 0.12, 0.58);
    p.position.y = 0.05;
    parpados.push(p);
    const pest = malla(new THREE.TorusGeometry(0.046, 0.005, 6, 16, Math.PI * 0.8), pestanaM, x, 0.008, -0.16, cabeza);
    pest.rotation.z = Math.PI * 0.1;
    // ceja arqueada
    const cejaColor = L.barba || (L.pelo.estilo === 'calvo' ? '#7a6656' : L.pelo.color);
    const ceja = malla(new THREE.TorusGeometry(0.05, 0.009, 6, 14, Math.PI * 0.6), mat(cejaColor, { roughness: 0.9 }), x * 1.04, 0.035, -0.16, cabeza);
    ceja.rotation.z = Math.PI * 0.2;
  }
  // nariz chica
  esfera(0.026, piel, 0, -0.045, -0.188, cabeza, 14).scale.set(0.9, 1.05, 1.1);
  // boca: sonrisa y labio de abajo
  const boca = new THREE.Group();
  boca.position.set(0, -0.1, -0.175);
  cabeza.add(boca);
  const sonrisa = malla(new THREE.TorusGeometry(0.032, 0.007, 6, 14, Math.PI * 0.75), mat(L.robot ? '#5d6773' : '#8a3b35'), 0, 0.012, 0, boca);
  sonrisa.rotation.z = Math.PI * 1.125;
  capsula(0.009, 0.028, mat(L.robot ? '#5d6773' : '#c46e66', { roughness: 0.4 }), 0, -0.016, 0.004, boca).rotation.z = Math.PI / 2;
  // mejillas
  const mejilla = new THREE.MeshBasicMaterial({ color: 0xff8a7a, transparent: true, opacity: 0.22 });
  if (!L.robot) for (const x of [-0.115, 0.115]) malla(new THREE.CircleGeometry(0.032, 14), mejilla, x, -0.055, -0.158, cabeza).rotation.y = Math.PI + (x > 0 ? 0.65 : -0.65);

  // ---------------------------------------------------------------- pelo con volumen
  const est = L.pelo.estilo;
  const flequillo = (n, ancho, y, largo) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const m = esfera(0.05, pelo, t * ancho, y, -0.165 + Math.abs(t) * 0.05, cabeza, 12);
      m.scale.set(0.9, largo, 0.6);
      m.rotation.z = -t * 0.9;
    }
  };
  if (est === 'corto') {
    const c = esfera(0.212, pelo, 0, 0.035, 0.012, cabeza, 26);
    c.geometry = new THREE.SphereGeometry(0.212, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    c.scale.set(0.97, 1.02, 1.02);
    flequillo(5, 0.2, 0.135, 0.9);
    for (const x of [-0.19, 0.19]) esfera(0.04, pelo, x, 0.05, 0.03, cabeza, 10).scale.set(0.5, 1.2, 1.2);
  } else if (est === 'largo') {
    const c = esfera(0.214, pelo, 0, 0.035, 0.012, cabeza, 26);
    c.geometry = new THREE.SphereGeometry(0.214, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    c.scale.set(0.99, 1.04, 1.03);
    flequillo(5, 0.22, 0.13, 1.0);
    // mechones a los costados y volumen atrás
    for (const x of [-1, 1]) {
      const m = capsula(0.055, 0.3, pelo, x * 0.17, -0.16, 0.0, cabeza);
      m.rotation.z = x * 0.1;
      m.scale.z = 0.8;
    }
    esfera(0.2, pelo, 0, -0.12, 0.09, cabeza, 20).scale.set(1.05, 1.45, 0.62);
  } else if (est === 'rulos' || est === 'rulosPoco') {
    const n = est === 'rulos' ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 * (est === 'rulos' ? 2.3 : 1.6);
      const elev = est === 'rulos' ? 0.25 + (i / n) * 1.0 : 0.15 + (i % 3) * 0.12;
      const r = 0.2;
      const x = Math.cos(a) * Math.cos(elev) * r;
      const y = Math.sin(elev) * r + 0.03;
      const z = Math.sin(a) * Math.cos(elev) * r + 0.025;
      if (z < -0.12 && y < 0.12) continue; // no tapar la cara
      esfera(est === 'rulos' ? 0.062 : 0.05, pelo, x, y, z, cabeza, 10);
    }
  } else if (est === 'poco') {
    // solo a los costados y atrás (pelado arriba)
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.05 + (i / 8) * 0.9);
      esfera(0.048, pelo, Math.cos(a) * 0.19, -0.02 + Math.sin(i) * 0.008, Math.sin(a) * 0.17 + 0.01, cabeza, 10).scale.set(1, 1.15, 0.8);
    }
  }
  if (L.barba) {
    const mb = mat(L.barba, { roughness: 0.95 });
    const b = esfera(0.205, mb, 0, 0.0, -0.01, cabeza, 26);
    b.geometry = new THREE.SphereGeometry(0.205, 26, 14, 0, Math.PI * 2, Math.PI * 0.64, Math.PI * 0.36);
    b.scale.set(0.98, 1.15, 1.03);
    const bigote = capsula(0.013, 0.06, mb, 0, -0.077, -0.183, cabeza);
    bigote.rotation.z = Math.PI / 2;
  }
  if (L.kipa) {
    const k = esfera(0.11, mat(L.kipa), 0, 0.15, 0.07, cabeza, 16);
    k.geometry = new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.3);
    k.rotation.x = 0.4;
  }
  if (L.lentes) {
    const m = mat(L.lentes, { metalness: 0.3, roughness: 0.3 });
    for (const x of [-0.075, 0.075]) malla(new THREE.TorusGeometry(0.055, 0.008, 8, 20), m, x, 0.004, -0.19, cabeza);
    malla(new THREE.BoxGeometry(0.04, 0.008, 0.008), m, 0, 0.012, -0.192, cabeza);
    for (const x of [-1, 1]) malla(new THREE.BoxGeometry(0.008, 0.008, 0.17), m, x * 0.13, 0.008, -0.11, cabeza);
  }
  if (L.antifaz) malla(new THREE.BoxGeometry(0.3, 0.08, 0.03), mat(L.antifaz), 0, 0.01, -0.175, cabeza).renderOrder = 1;
  if (L.sombrero) {
    malla(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 24), mat(L.sombrero), 0, 0.19, 0, cabeza);
    malla(new THREE.CylinderGeometry(0.17, 0.2, 0.17, 20), mat(L.sombrero), 0, 0.28, 0, cabeza);
  }
  if (L.auriculares) {
    const m = mat(L.auriculares, { roughness: 0.35 });
    const arco = malla(new THREE.TorusGeometry(0.22, 0.015, 8, 28, Math.PI), m, 0, 0.03, 0, cabeza);
    arco.rotation.y = Math.PI / 2;
    for (const x of [-0.205, 0.205]) malla(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 18), m, x, -0.01, 0, cabeza).rotation.z = Math.PI / 2;
  }
  if (L.robot) {
    malla(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), mat('#8a96a3'), 0, 0.28, 0, cabeza);
    esfera(0.03, mat('#ff6b5b', { emissive: '#ff6b5b', emissiveIntensity: 0.9 }), 0, 0.37, 0, cabeza, 10);
  }

  // brillo dorado (easter egg)
  let aura = null;
  if (L.dorado) {
    aura = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), m);
      s.userData.a = (i / 18) * Math.PI * 2;
      s.userData.h = 0.2 + (i % 6) * 0.3;
      aura.add(s);
    }
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.6 }));
    anillo.rotation.x = Math.PI / 2;
    anillo.position.y = 0.05;
    aura.add(anillo);
    g.add(aura);
    const luz = new THREE.PointLight(0xffd34d, 1.6, 4);
    luz.position.y = 1.4;
    g.add(luz);
  }

  // sombra en el piso
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  g.add(sombra);

  // cartel con el nombre y globito de diálogo
  const cartel = nombre ? sprite(THREE, nombre, colorNombre, 'rgba(20,20,19,.72)', tamCartel) : null;
  if (cartel) {
    cartel.position.y = 2.2;
    g.add(cartel);
  }
  let globo = null;
  let globoHasta = 0;
  let fase = Math.random() * 6;
  let reloj = 0;
  let parpadeo = 2 + Math.random() * 3;

  const piezas = [pI.cadera, pI.rodilla, pD.cadera, pD.rodilla, bI, bD, codoI, codoD];
  return {
    grupo: g,
    cabeza,
    altura: 2,
    decir(texto, seg = 4.5) {
      if (globo) g.remove(globo);
      globo = sprite(THREE, texto, '#141413', '#ffffff', tamGlobo, true);
      globo.position.y = 2.2 + tamCartel + 0.05 + globo.scale.y / 2;
      g.add(globo);
      globoHasta = reloj + seg;
    },
    // estado: 'quieto' | 'corre' | 'salto' | 'buceo' | 'golpe' | 'tirado' | 'pina' | 'patada' | 'festeja' | 'sentado' | 'cae'
    animar(estado, dt) {
      reloj += dt;
      fase += dt * (estado === 'corre' ? 10 : 3);
      const s = Math.sin(fase);
      cuerpo.rotation.set(0, 0, 0);
      cuerpo.position.set(0, 0, 0);
      torso.rotation.set(0, 0, 0);
      torso.scale.setScalar(1);
      cabeza.rotation.set(0, 0, 0);
      for (const p of piezas) p.rotation.set(0, 0, 0);
      boca.scale.set(1, 1, 1);
      if (estado === 'corre') {
        pI.cadera.rotation.x = s * 0.75;
        pD.cadera.rotation.x = -s * 0.75;
        pI.rodilla.rotation.x = Math.max(0, -s) * 1.1 + 0.15;
        pD.rodilla.rotation.x = Math.max(0, s) * 1.1 + 0.15;
        bI.rotation.x = -s * 0.65;
        bD.rotation.x = s * 0.65;
        codoI.rotation.x = codoD.rotation.x = -0.7;
        cuerpo.position.y = Math.abs(Math.cos(fase)) * 0.05;
        torso.rotation.x = -0.1;
      } else if (estado === 'salto') {
        pI.cadera.rotation.x = -0.7;
        pI.rodilla.rotation.x = 1.0;
        pD.cadera.rotation.x = 0.2;
        pD.rodilla.rotation.x = 0.4;
        bI.rotation.z = -2.3;
        bD.rotation.z = 2.3;
      } else if (estado === 'buceo') {
        cuerpo.rotation.x = -1.35;
        cuerpo.position.y = 0.4;
        bI.rotation.x = bD.rotation.x = -2.9;
      } else if (estado === 'golpe' || estado === 'cae') {
        cuerpo.rotation.z = Math.sin(fase * 3) * 0.45;
        cuerpo.rotation.x = 0.3;
        bI.rotation.z = -1.9;
        bD.rotation.z = 1.9;
        pI.rodilla.rotation.x = pD.rodilla.rotation.x = 0.5;
        boca.scale.set(0.8, 2.2, 1);
      } else if (estado === 'tirado') {
        // en el piso panza arriba
        cuerpo.rotation.x = 1.5;
        cuerpo.position.set(0, 0.2, 0.4);
        bI.rotation.z = -1.2 + Math.sin(fase * 2) * 0.15;
        bD.rotation.z = 1.2 - Math.sin(fase * 2) * 0.15;
        pI.rodilla.rotation.x = 0.4;
        boca.scale.set(0.8, 2.2, 1);
      } else if (estado === 'pina') {
        bD.rotation.x = -1.6;
        codoI.rotation.x = -1.6;
        bI.rotation.x = -0.4;
        torso.rotation.y = 0.5;
      } else if (estado === 'patada') {
        pD.cadera.rotation.x = -1.4;
        torso.rotation.x = 0.25;
        pI.rodilla.rotation.x = 0.3;
        bI.rotation.z = -0.9;
        bD.rotation.z = 0.9;
      } else if (estado === 'festeja') {
        cuerpo.position.y = Math.abs(Math.sin(fase * 1.4)) * 0.4;
        pI.rodilla.rotation.x = pD.rodilla.rotation.x = Math.abs(Math.sin(fase * 1.4)) * 0.6;
        bI.rotation.z = -2.6 + s * 0.2;
        bD.rotation.z = 2.6 - s * 0.2;
        boca.scale.set(1.15, 1.6, 1);
      } else if (estado === 'sentado') {
        // muslos para adelante, piernas colgando desde la rodilla, manos sobre la mesa
        cuerpo.position.y = -0.26;
        pI.cadera.rotation.x = pD.cadera.rotation.x = -1.5;
        pI.rodilla.rotation.x = pD.rodilla.rotation.x = 1.45;
        bI.rotation.x = bD.rotation.x = -0.75;
        codoI.rotation.x = codoD.rotation.x = -0.75;
        bI.rotation.z = 0.12;
        bD.rotation.z = -0.12;
        cabeza.rotation.y = Math.sin(fase * 0.3) * 0.25;
      } else {
        // quieto: respira y mira un poco a los costados
        torso.scale.set(1, 1 + Math.sin(fase) * 0.008, 1);
        cabeza.rotation.y = Math.sin(fase * 0.4) * 0.2;
        bI.rotation.z = -0.1;
        bD.rotation.z = 0.1;
        codoI.rotation.x = codoD.rotation.x = -0.15;
      }
      // parpadea cada tanto
      parpadeo -= dt;
      const cerrado = parpadeo < 0.12;
      for (const p of parpados) {
        p.scale.y = cerrado ? 1.05 : 0.12;
        p.position.y = cerrado ? 0.005 : 0.05;
      }
      if (parpadeo < 0) parpadeo = 2.5 + Math.random() * 3.5;
      if (aura) {
        aura.rotation.y += dt * 1.8;
        aura.children.forEach((c, i) => {
          if (c.userData.a === undefined) return;
          c.position.set(Math.cos(c.userData.a) * 0.55, c.userData.h + Math.sin(reloj * 3 + i) * 0.08, Math.sin(c.userData.a) * 0.55);
          c.rotation.y += dt * 4;
        });
      }
      if (globo && reloj > globoHasta) {
        g.remove(globo);
        globo = null;
      }
    },
  };
}

function sprite(THREE, texto, color, fondo, alto, conPico = false) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const fuente = '700 30px Barlow, Arial, sans-serif';
  g.font = fuente;
  // corta en líneas de hasta ~26 caracteres
  const palabras = String(texto).split(' ');
  const lineas = [];
  let l = '';
  for (const p of palabras) {
    if ((l + ' ' + p).trim().length > 26 && l) {
      lineas.push(l);
      l = p;
    } else l = (l + ' ' + p).trim();
  }
  if (l) lineas.push(l);
  const w = Math.min(560, Math.max(...lineas.map((x) => g.measureText(x).width)) + 40);
  const h = lineas.length * 36 + 24 + (conPico ? 16 : 0);
  cv.width = 600;
  cv.height = h;
  g.font = fuente;
  g.fillStyle = fondo;
  g.beginPath();
  g.roundRect((600 - w) / 2, 4, w, h - 8 - (conPico ? 16 : 0), 22);
  g.fill();
  if (conPico) {
    g.beginPath();
    g.moveTo(290, h - 24);
    g.lineTo(300, h - 4);
    g.lineTo(312, h - 24);
    g.fill();
  }
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lineas.forEach((x, i) => g.fillText(x, 300, 22 + 18 + i * 36 - 4, 540));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  // alto = metros por línea de texto
  const altoMundo = (alto * h) / 60;
  s.scale.set((altoMundo * 600) / h, altoMundo, 1);
  s.renderOrder = 10;
  return s;
}
