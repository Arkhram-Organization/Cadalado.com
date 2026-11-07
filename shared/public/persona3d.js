// Personitas 3D para los juegos de cadalado (carrera, blackjack…). Recibe THREE para no duplicar la librería.
// crearPersona(THREE, look) → { grupo, animar(estado, dt), decir(texto, seg), ... }
// look: ver shared/public/npcs.js (piel, pelo, ojos, cuerpo, ropa, barba, lentes, kipa, sombrero, capa, robot, dorado, smoking)

const ANCHO = { flaco: 0.27, normal: 0.31, gordito: 0.38 };

// Estilo "muñequito de juguete": cabeza grande, cuerpo redondeado, brazos largos con manos y piernas cortas.
// Mide ~1.85 de alto. La cara mira hacia -Z.
export function crearPersona(THREE, look = {}, { nombre = '', colorNombre = '#ffffff', sombras = true, tamCartel = 0.65, tamGlobo = 0.5 } = {}) {
  const L = {
    piel: '#e8c4a8',
    ojos: '#1b1410',
    cuerpo: 'normal',
    pelo: { estilo: 'corto', color: '#2b1d14' },
    ropa: { remera: '#7aa2ff', pantalon: '#2b2b33' },
    ...look,
  };
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...extra });
  const piel = L.robot ? mat(L.piel, { metalness: 0.6, roughness: 0.35 }) : mat(L.piel, { roughness: 0.5 });
  const remera = mat(L.smoking ? '#111114' : L.ropa.remera);
  const pantalon = mat(L.smoking ? '#111114' : L.ropa.pantalon);
  const zapato = mat(L.smoking ? '#0b0b0b' : '#3a2a20', { roughness: 0.4 });
  const pelo = mat(L.pelo.color, { roughness: 0.8 });
  const ancho = ANCHO[L.cuerpo] || ANCHO.normal;
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
  const CADERA = 0.5;

  // piernas cortas y gorditas (pivote en la cadera)
  const pierna = (lado) => {
    const p = new THREE.Group();
    p.position.set(lado * ancho * 0.45, CADERA, 0);
    malla(new THREE.CapsuleGeometry(0.12, 0.2, 4, 12), pantalon, 0, -0.2, 0, p);
    const z = malla(new THREE.SphereGeometry(0.13, 14, 10), zapato, 0, -0.42, -0.05, p);
    z.scale.set(0.95, 0.6, 1.35);
    cuerpo.add(p);
    return p;
  };
  const piernaI = pierna(-1);
  const piernaD = pierna(1);

  // torso redondeado: remera arriba, pantalón abajo
  const torso = new THREE.Group();
  torso.position.y = CADERA;
  cuerpo.add(torso);
  const cadera = malla(new THREE.SphereGeometry(ancho, 18, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), pantalon, 0, 0.12, 0, torso);
  cadera.scale.set(1, 0.6, L.cuerpo === 'gordito' ? 0.95 : 0.82);
  const panza = malla(new THREE.CapsuleGeometry(ancho, 0.24, 8, 18), remera, 0, 0.32, 0, torso);
  panza.scale.set(1, 1, L.cuerpo === 'gordito' ? 0.95 : 0.8);
  const prof = ancho * (L.cuerpo === 'gordito' ? 0.95 : 0.8); // hasta dónde llega el pecho hacia adelante
  if (L.smoking) {
    // camisa blanca en V, moño y botones
    const camisa = malla(new THREE.CylinderGeometry(0.0, ancho * 0.42, 0.34, 3, 1), mat('#f7f7f2'), 0, 0.5, -prof + 0.04, torso);
    camisa.rotation.set(Math.PI, 0, 0);
    camisa.scale.z = 0.25;
    malla(new THREE.BoxGeometry(0.15, 0.06, 0.04), mat('#0d0d0d'), 0, 0.64, -prof - 0.02, torso);
    for (const y of [0.42, 0.33]) malla(new THREE.SphereGeometry(0.018, 8, 6), mat('#d4af37', { metalness: 0.6 }), 0, y, -prof - 0.01, torso);
  }
  if (L.capa) {
    const capa = malla(new THREE.PlaneGeometry(ancho * 1.9, 0.8), mat(L.capa, { side: THREE.DoubleSide }), 0, 0.2, prof + 0.03, torso);
    capa.rotation.x = 0.15;
  }
  if (L.robot) {
    malla(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), mat('#38d9e6', { emissive: '#38d9e6', emissiveIntensity: 0.8 }), 0, 0.38, -prof, torso).rotation.x = Math.PI / 2;
  }
  // un detalle en la remera para distinguir (franja o número)
  if (!L.smoking && !L.robot && L.ropa.franja) malla(new THREE.CapsuleGeometry(ancho * 1.005, 0.02, 6, 18), mat(L.ropa.franja), 0, 0.38, 0, torso).scale.set(1, 0.35, L.cuerpo === 'gordito' ? 0.96 : 0.81);

  // brazos largos (pivote en el hombro) con manga y mano
  const brazo = (lado) => {
    const b = new THREE.Group();
    b.position.set(lado * (ancho + 0.07), 0.56, 0);
    malla(new THREE.CapsuleGeometry(0.085, 0.16, 4, 10), remera, 0, -0.1, 0, b);
    malla(new THREE.CapsuleGeometry(0.07, 0.18, 4, 10), L.smoking ? remera : piel, 0, -0.3, 0, b);
    malla(new THREE.SphereGeometry(0.085, 12, 10), L.guantes ? mat(L.guantes) : piel, 0, -0.47, 0, b);
    torso.add(b);
    return b;
  };
  const brazoI = brazo(-1);
  const brazoD = brazo(1);

  // cabeza
  // la cabeza se arma chica y se agranda entera (así pelo, lentes y gorros quedan en su lugar)
  const cabeza = new THREE.Group();
  cabeza.position.y = CADERA + 0.88;
  cabeza.scale.setScalar(1.75);
  torso.parent.add(cabeza);
  const craneo = malla(new THREE.SphereGeometry(0.19, 24, 18), piel, 0, 0, 0, cabeza);
  craneo.scale.set(L.cuerpo === 'gordito' ? 1.06 : 1, 1, 0.98);
  // ojos ovalados oscuros con brillo, cejas y boca simple
  const ojo = mat(L.ojos, { roughness: 0.2 });
  const brillo = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-0.06, 0.06]) {
    const o = malla(new THREE.SphereGeometry(0.026, 12, 10), ojo, x, 0.03, -0.172, cabeza);
    o.scale.set(0.8, 1.35, 0.6);
    malla(new THREE.SphereGeometry(0.008, 6, 4), brillo, x + 0.008, 0.048, -0.186, cabeza);
    if (L.pelo.estilo !== 'calvo' || L.barba) {
      const c = malla(new THREE.BoxGeometry(0.05, 0.01, 0.015), pelo, x, 0.085, -0.172, cabeza);
      c.rotation.z = x > 0 ? -0.15 : 0.15;
    }
  }
  const mejilla = new THREE.MeshBasicMaterial({ color: 0xff8a7a, transparent: true, opacity: 0.35 });
  if (!L.robot) for (const x of [-0.11, 0.11]) malla(new THREE.CircleGeometry(0.028, 12), mejilla, x, -0.03, -0.17, cabeza).rotation.y = Math.PI + (x > 0 ? 0.55 : -0.55);
  const boca = malla(new THREE.BoxGeometry(0.06, 0.012, 0.01), mat('#5a2b25'), 0, -0.07, -0.182, cabeza);
  // pelo
  const est = L.pelo.estilo;
  if (est === 'corto') {
    const c = malla(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), pelo, 0, 0.02, 0.012, cabeza);
    c.scale.set(1, 0.9, 1.02);
  } else if (est === 'poco') {
    // solo a los costados y atrás (pelado arriba)
    const c = malla(new THREE.TorusGeometry(0.175, 0.04, 8, 24, Math.PI), pelo, 0, -0.02, 0.0, cabeza);
    c.rotation.set(Math.PI / 2, 0, 0);
  } else if (est === 'rulos' || est === 'rulosPoco') {
    const n = est === 'rulos' ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = est === 'rulos' ? 0.13 : 0.16;
      malla(new THREE.SphereGeometry(0.055, 8, 6), pelo, Math.cos(a) * r, est === 'rulos' ? 0.12 : 0.06 + (i % 2) * 0.03, Math.sin(a) * r + 0.03, cabeza);
    }
  } else if (est === 'largo') {
    const c = malla(new THREE.SphereGeometry(0.205, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), pelo, 0, 0.03, 0.015, cabeza);
    c.scale.set(1.02, 0.95, 1.04);
    malla(new THREE.BoxGeometry(0.36, 0.34, 0.09), pelo, 0, -0.1, 0.13, cabeza);
  }
  if (L.barba) {
    const b = malla(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mat(L.barba, { roughness: 0.95 }), 0, 0.01, -0.03, cabeza);
    b.scale.set(1.04, 1, 1.05);
  }
  if (L.kipa) {
    const k = malla(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), mat(L.kipa), 0, 0.105, 0.06, cabeza);
    k.rotation.x = 0.35;
  }
  if (L.lentes) {
    const m = mat(L.lentes, { metalness: 0.3, roughness: 0.3 });
    for (const x of [-0.065, 0.065]) malla(new THREE.TorusGeometry(0.042, 0.009, 6, 16), m, x, 0.03, -0.2, cabeza);
    malla(new THREE.BoxGeometry(0.05, 0.008, 0.008), m, 0, 0.035, -0.2, cabeza);
  }
  if (L.antifaz) {
    const a = malla(new THREE.BoxGeometry(0.26, 0.07, 0.02), mat(L.antifaz), 0, 0.035, -0.19, cabeza);
    a.renderOrder = 1;
  }
  if (L.sombrero) {
    malla(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), mat(L.sombrero), 0, 0.15, 0, cabeza);
    malla(new THREE.CylinderGeometry(0.16, 0.19, 0.16, 18), mat(L.sombrero), 0, 0.24, 0, cabeza);
  }
  if (L.auriculares) {
    const m = mat(L.auriculares, { roughness: 0.35 });
    const arco = malla(new THREE.TorusGeometry(0.2, 0.014, 6, 24, Math.PI), m, 0, 0.02, 0, cabeza);
    arco.rotation.y = Math.PI / 2;
    for (const x of [-0.195, 0.195]) malla(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16), m, x, -0.01, 0, cabeza).rotation.z = Math.PI / 2;
  }
  if (L.robot) {
    malla(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), mat('#8a96a3'), 0, 0.26, 0, cabeza);
    malla(new THREE.SphereGeometry(0.03, 8, 6), mat('#ff6b5b', { emissive: '#ff6b5b', emissiveIntensity: 0.9 }), 0, 0.35, 0, cabeza);
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
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  g.add(sombra);

  // cartel con el nombre y globito de diálogo (sprites con canvas)
  const cartel = nombre ? sprite(THREE, nombre, colorNombre, 'rgba(20,20,19,.72)', tamCartel) : null;
  if (cartel) {
    cartel.position.y = 2.2;
    g.add(cartel);
  }
  let globo = null;
  let globoHasta = 0;

  let fase = Math.random() * 6;
  let reloj = 0;
  const persona = {
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
      fase += dt * (estado === 'corre' ? 11 : 3);
      const s = Math.sin(fase);
      cuerpo.rotation.set(0, 0, 0);
      cuerpo.position.set(0, 0, 0);
      torso.rotation.set(0, 0, 0);
      cabeza.rotation.set(0, 0, 0);
      for (const p of [piernaI, piernaD, brazoI, brazoD]) p.rotation.set(0, 0, 0);
      boca.scale.set(1, 1, 1);
      if (estado === 'corre') {
        piernaI.rotation.x = s * 0.75;
        piernaD.rotation.x = -s * 0.75;
        brazoI.rotation.x = -s * 0.7;
        brazoD.rotation.x = s * 0.7;
        cuerpo.position.y = Math.abs(Math.cos(fase)) * 0.06;
        torso.rotation.x = -0.12;
      } else if (estado === 'salto') {
        piernaI.rotation.x = -0.6;
        piernaD.rotation.x = 0.3;
        brazoI.rotation.z = -2.4;
        brazoD.rotation.z = 2.4;
      } else if (estado === 'buceo') {
        cuerpo.rotation.x = -1.35;
        cuerpo.position.y = 0.45;
        brazoI.rotation.x = brazoD.rotation.x = -2.9;
      } else if (estado === 'golpe' || estado === 'cae') {
        cuerpo.rotation.z = Math.sin(fase * 3) * 0.45;
        cuerpo.rotation.x = 0.3;
        brazoI.rotation.z = -1.9;
        brazoD.rotation.z = 1.9;
        boca.scale.set(0.6, 4, 1);
      } else if (estado === 'tirado') {
        // en el piso panza arriba, como un muñeco tirado
        cuerpo.rotation.x = 1.5;
        cuerpo.position.set(0, 0.32, 0.55);
        brazoI.rotation.z = -1.2 + Math.sin(fase * 2) * 0.15;
        brazoD.rotation.z = 1.2 - Math.sin(fase * 2) * 0.15;
        piernaI.rotation.x = -0.3;
        piernaD.rotation.x = 0.2;
        boca.scale.set(0.6, 4, 1);
      } else if (estado === 'pina') {
        brazoD.rotation.x = -1.6;
        torso.rotation.y = 0.5;
        brazoI.rotation.x = 0.4;
      } else if (estado === 'patada') {
        piernaD.rotation.x = -1.5;
        torso.rotation.x = 0.25;
        brazoI.rotation.z = -0.9;
        brazoD.rotation.z = 0.9;
      } else if (estado === 'festeja') {
        cuerpo.position.y = Math.abs(Math.sin(fase * 1.4)) * 0.45;
        brazoI.rotation.z = -2.6 + s * 0.2;
        brazoD.rotation.z = 2.6 - s * 0.2;
        boca.scale.set(1.2, 3, 1);
      } else if (estado === 'sentado') {
        // sentado: muslos para adelante, manos sobre la mesa
        piernaI.rotation.x = piernaD.rotation.x = -1.5;
        cuerpo.position.y = 0.04;
        brazoI.rotation.x = brazoD.rotation.x = -1.15;
        brazoI.rotation.z = 0.15;
        brazoD.rotation.z = -0.15;
        cabeza.rotation.y = Math.sin(fase * 0.3) * 0.25;
      } else {
        // quieto: respira y mira un poco a los costados
        torso.scale.setScalar(1 + Math.sin(fase) * 0.012);
        cabeza.rotation.y = Math.sin(fase * 0.4) * 0.2;
        brazoI.rotation.z = -0.08;
        brazoD.rotation.z = 0.08;
      }
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
  return persona;
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
