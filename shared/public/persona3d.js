// Elenco compartido: muñequitos de proporciones de animación, ropa construida por capas
// y una cara esculpida. El frente del personaje es -Z (contrato de todos los juegos).
// Las fotografías futuras sólo necesitan ajustar `look`; el rig y las animaciones se comparten.
import { PERFILES } from './caras/perfiles.js';
import { pintarCara, siluetaCabeza } from './caras/pintar.js';
import { crearPersonaModelo } from './modelo3d.js';
import { travieso, voltereta } from './gestos.js';
import { enganchar } from './wooop.js';

export function crearPersona(THREE, look = {}, opciones = {}) {
  return enganchar(crearPersonaBase(THREE, look, opciones), !!look.contagia);
}
function crearPersonaBase(THREE, look = {}, opciones = {}) {
  // Personajes del elenco con modelo propio (hechos en Meshy): cara y torso de sus capturas.
  // Personajes con su modelo de Meshy (GLB con esqueleto y animaciones).
  if (look.modelo) return crearPersonaModelo(THREE, look, opciones, { sprite, liberarSprite });
  if (look.foto && PERFILES[look.foto]) return crearPersonaFoto(THREE, look, PERFILES[look.foto], opciones);
  // El resto del elenco: mismo cuerpo low-poly, con la cara pintada.
  if (look.estilo === 'meshy') return crearPersonaFoto(THREE, look, perfilPintado(THREE, look), opciones);
  const { nombre = '', colorNombre = '#ffffff', sombras = true, tamCartel = 0.65, tamGlobo = 0.5, detalle = 1 } = opciones;
  // detalle > 1: más segmentos en las curvas (para fichas e imágenes grandes; en los juegos queda en 1)
  const seg = (n) => Math.max(3, Math.round(n * detalle));
  const L = { piel: '#e8c4a8', ojos: '#5a3a22', cuerpo: 'normal', ...look,
    pelo: { estilo: 'corto', color: '#2b1d14', ...look.pelo },
    ropa: { remera: '#7aa2ff', pantalon: '#3a4256', ...look.ropa } };
  const materiales = new Map();
  const mat = (color, extra = {}) => {
    const clave = JSON.stringify([color, extra]);
    if (!materiales.has(clave)) materiales.set(clave, new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extra }));
    return materiales.get(clave);
  };
  const grupo = new THREE.Group(), cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  const pieza = (geo, m, x, y, z, parent = cuerpo) => {
    const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.castShadow = sombras; p.receiveShadow = false; parent.add(p); return p;
  };
  const bola = (r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) => {
    const p = pieza(new THREE.SphereGeometry(r, seg(24), seg(16)), m, x, y, z, parent); p.scale.set(sx, sy, sz); return p;
  };
  const tubo = (r, largo, m, x, y, z, parent) => pieza(new THREE.CapsuleGeometry(r, largo, seg(5), seg(12)), m, x, y, z, parent);
  const cubo = (w, h, d, m, x, y, z, parent) => pieza(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const aro = (r, grosor, m, x, y, z, parent, arco = Math.PI * 2) => pieza(new THREE.TorusGeometry(r, grosor, seg(6), seg(24), arco), m, x, y, z, parent);
  const piel = mat(L.piel, L.robot ? { metalness: .65, roughness: .34 } : { roughness: .57 });
  const rosado = mat(new THREE.Color(L.piel).lerp(new THREE.Color('#d17c66'), .25));
  // Tela de la remera: lisa, o a cuadros (camisa tipo vichy) si el look lo pide.
  let tela;
  if (!L.smoking && L.ropa.estampado === 'cuadros') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const gc = cv.getContext('2d');
    gc.fillStyle = '#f3f1ec'; gc.fillRect(0, 0, 64, 64);
    gc.fillStyle = L.ropa.remera; gc.globalAlpha = .55;
    for (let i = 0; i < 64; i += 16) { gc.fillRect(i, 0, 8, 64); gc.fillRect(0, i, 64, 8); }
    gc.globalAlpha = 1;
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3); tx.colorSpace = THREE.SRGBColorSpace;
    tela = new THREE.MeshStandardMaterial({ map: tx, roughness: .82 });
  } else tela = mat(L.smoking ? '#20232c' : L.ropa.remera);
  const capucha = !L.smoking && L.capucha;
  const campera = !L.smoking && L.campera ? mat(L.campera) : null;
  const mangaLarga = L.smoking || capucha || L.mangasLargas || campera;
  const pantalon = mat(L.smoking ? '#20232c' : L.ropa.pantalon);
  const blanco = mat('#eee9de'), negro = mat('#17191e'), pelo = mat(L.pelo.color);
  const cuero = mat(L.ropa.bolso || '#b8783f'), metal = mat('#a8a9a4', { metalness: .65, roughness: .35 });
  const ancho = { flaco: .215, normal: .245, gordito: .305 }[L.cuerpo] || .245;
  const gordo = L.cuerpo === 'gordito';
  const torso = new THREE.Group(); torso.position.y = .69; cuerpo.add(torso);
  bola(ancho, pantalon, 0, .02, 0, torso, 1, .55, .78);
  bola(ancho, tela, 0, .235, 0, torso, 1.02, 1.28, gordo ? .96 : .79);
  // Hombros y cuello suaves, dobladillo, pespuntes y bolsillos de verdad.
  bola(ancho * .95, tela, 0, .405, 0, torso, 1, .36, .76);
  const frente = -ancho * (gordo ? .94 : .78);
  aro(ancho * .96, .015, pantalon, 0, .06, 0, torso).rotation.x = Math.PI / 2;
  tubo(.073, .10, piel, 0, .52, 0, torso);
  const cuello = aro(.094, .021, L.smoking ? blanco : tela, 0, .46, -.015, torso); cuello.rotation.x = Math.PI / 2;
  if (L.smoking) {
    bola(.12, blanco, 0, .34, frente + .025, torso, .77, 1.15, .2);
    for (const s of [-1, 1]) {
      const lap = cubo(.055, .25, .025, mat('#343845'), s * .08, .34, frente - .012, torso); lap.rotation.z = s * -.34;
      bola(.037, negro, s * .032, .46, frente - .04, torso, 1.25, .7, .4);
    }
    bola(.022, negro, 0, .46, frente - .045, torso);
    for (const y of [.35, .28, .20]) bola(.008, negro, 0, y, frente - .021, torso);
    cubo(.065, .035, .014, blanco, -.14, .35, frente + .02, torso).rotation.z = -.15;
  } else if (L.robot) {
    cubo(.26, .24, .045, mat('#526675', { metalness: .7 }), 0, .26, frente, torso);
    bola(.06, mat('#67f6df', { emissive: '#38d9e6', emissiveIntensity: 1.5 }), 0, .27, frente - .034, torso, 1, 1, .4);
    for (const x of [-.1, .1]) for (const y of [.18, .35]) bola(.012, metal, x, y, frente - .026, torso);
  } else {
    if (L.ropa.franja) {
      const franja = pieza(new THREE.CylinderGeometry(ancho * 1.01, ancho * 1.03, .055, 24, 1, true), mat(L.ropa.franja), 0, .30, 0, torso);
      franja.scale.z = gordo ? .93 : .78;
    }
    // Bolsillo con costura y pequeño parche: la vestimenta se lee desde lejos.
    const bolsillo = cubo(.09, .09, .018, tela, -.10, .34, frente - .006, torso); bolsillo.rotation.z = -.03;
    cubo(.083, .009, .02, mat(new THREE.Color(L.ropa.remera).multiplyScalar(.72)), -.10, .38, frente - .02, torso);
    cubo(.018, .025, .022, blanco, -.073, .35, frente - .02, torso);
    // Chomba: cuello con solapas y tres botones. Camisa: cuello y botonera hasta abajo.
    if (L.polo || L.camisa) {
      for (const sd of [-1, 1]) {
        const sol = cubo(.10, .016, .085, tela, sd * .055, .47, -.075, torso); sol.rotation.set(.55, sd * .45, sd * .42);
      }
      const n = L.camisa ? 5 : 3;
      for (let i = 0; i < n; i++) bola(.009, L.camisa ? blanco : negro, 0, .43 - i * .065, frente - .012, torso);
      if (L.camisa) cubo(.022, .34, .012, tela, 0, .28, frente - .008, torso);
    }
    // Delantal de cocina: peto, falda que cae sobre el pantalón y tiras al cuello y a la cintura.
    if (L.delantal) {
      const d = mat(L.delantal), d2 = mat(new THREE.Color(L.delantal).multiplyScalar(.85));
      cubo(.24, .22, .014, d, 0, .29, frente - .024, torso);
      cubo(ancho * 1.5, .32, .016, d, 0, -.03, frente - .03, torso);
      cubo(.12, .05, .018, d2, 0, .06, frente - .042, torso); // bolsillo
      const cinta = aro(ancho * (gordo ? .98 : .95), .012, d2, 0, .14, 0, torso); cinta.rotation.x = Math.PI / 2; cinta.scale.y = gordo ? .96 : .82;
      for (const sd of [-1, 1]) { const t = cubo(.02, .16, .012, d2, sd * .085, .44, frente * .7, torso); t.rotation.set(-.5, 0, sd * -.25); }
    }
    // Buzo con capucha: bolsillo canguro, cordones y la capucha caída atrás del cuello (si no está puesta).
    if (capucha) {
      cubo(.22, .1, .02, tela, 0, .14, frente - .012, torso);
      for (const sd of [-1, 1]) tubo(.006, .1, blanco, sd * .035, .38, frente - .02, torso);
    }
    // Campera abierta arriba de la camisa
    if (campera) {
      for (const sd of [-1, 1]) {
        const panel = bola(ancho * .62, campera, sd * ancho * .62, .24, -ancho * .12, torso, .62, 1.32, gordo ? .98 : .86);
        panel.rotation.z = sd * .05;
      }
      bola(ancho, campera, 0, .24, ancho * .25, torso, 1.04, 1.3, .62);
      for (const sd of [-1, 1]) { const c = cubo(.05, .2, .02, campera, sd * .1, .4, frente - .006, torso); c.rotation.z = sd * -.4; }
    }
    // Cámara de fotos colgada y tiradores de mochila
    if (L.mochila) for (const sd of [-1, 1]) {
      const t = cubo(.05, .44, .03, mat(L.mochila), sd * ancho * .55, .24, frente - .01, torso); t.rotation.z = sd * .05;
      cubo(.06, .03, .035, metal, sd * ancho * .55, .1, frente - .02, torso);
    }
    if (L.camara) {
      const correa = cubo(.022, .5, .02, negro, -.06, .3, frente - .03, torso); correa.rotation.z = .55;
      cubo(.13, .085, .06, negro, .02, .1, frente - .055, torso);
      const lente = pieza(new THREE.CylinderGeometry(.034, .038, .055, 18), mat('#2b2d33', { metalness: .4, roughness: .3 }), .02, .1, frente - .1, torso); lente.rotation.x = Math.PI / 2;
      bola(.022, mat('#7aa0c8', { metalness: .5, roughness: .1 }), .02, .1, frente - .128, torso, 1, 1, .3);
      cubo(.03, .018, .012, mat('#f2c94c'), -.03, .135, frente - .087, torso);
    }
    // Correa y bolso diferenciados. El look permite desactivarlos y ajustar el color.
    if (!L.capa && !L.liso && !L.barba && L.ropa.bolso !== false) {
      const correa = cubo(.04, .51, .026, cuero, .015, .27, frente - .035, torso); correa.rotation.z = -.65;
      bola(.095, cuero, .19, .03, frente - .05, torso, 1.1, 1.15, .4);
      bola(.09, mat(new THREE.Color(L.ropa.bolso || '#b8783f').multiplyScalar(.82)), .19, .067, frente - .074, torso, 1.12, .5, .25);
      cubo(.023, .026, .014, metal, .19, .037, frente - .103, torso);
    }
  }

  const piernas = [-1, 1].map(s => {
    const cadera = new THREE.Group(); cadera.position.set(s * ancho * .53, .69, 0); cuerpo.add(cadera);
    tubo(gordo ? .105 : .09, .17, pantalon, 0, -.16, 0, cadera);
    const rodilla = new THREE.Group(); rodilla.position.y = -.32; cadera.add(rodilla);
    tubo(.075, .15, pantalon, 0, -.10, 0, rodilla);
    const botamanga = aro(.077, .012, pantalon, 0, -.20, 0, rodilla); botamanga.rotation.x = Math.PI / 2;
    // Zapatillas con puntera, suela clara y cordones; Dobro lleva zapatos.
    const calzado = L.smoking ? negro : mat(L.ropa.zapatillas || '#e9e1d1');
    bola(.11, calzado, 0, -.285, -.053, rodilla, 1, .70, 1.54);
    bola(.112, L.smoking ? negro : blanco, 0, -.325, -.053, rodilla, 1.04, .22, 1.57);
    if (!L.smoking) {
      bola(.08, blanco, 0, -.285, -.142, rodilla, 1.12, .55, .65);
      for (const z of [-.065, -.09, -.115]) cubo(.085, .009, .012, blanco, 0, -.219, z, rodilla);
    }
    return { cadera, rodilla };
  });
  const brazos = [-1, 1].map(s => {
    const hombro = new THREE.Group(); hombro.position.set(s * (ancho * .91 + .035), .40, 0); torso.add(hombro);
    tubo(.08, .13, campera || tela, 0, -.11, 0, hombro);
    const codo = new THREE.Group(); codo.position.y = -.23; hombro.add(codo);
    tubo(.061, .13, mangaLarga ? (campera || tela) : piel, 0, -.095, 0, codo);
    aro(.067, .012, L.smoking ? blanco : campera || tela, 0, mangaLarga ? -.19 : -.003, 0, codo).rotation.x = Math.PI / 2;
    const mano = new THREE.Group(); mano.position.y = -.23; codo.add(mano);
    bola(.063, L.guantes ? mat(L.guantes) : piel, 0, -.008, 0, mano, .9, 1.13, .62);
    tubo(.023, .035, piel, -s * .043, .002, -.025, mano).rotation.z = s * .35;
    // Reloj: detalle recurrente que hace que la ropa se sienta real.
    if (s === 1 && !L.robot) {
      aro(.062, .014, negro, 0, -.18, 0, codo).rotation.x = Math.PI / 2;
      cubo(.067, .05, .018, metal, 0, -.18, -.058, codo);
      cubo(.052, .037, .021, negro, 0, -.18, -.062, codo);
    }
    return { hombro, codo, mano };
  });
  // Celular para el gesto TikTok: en la mano derecha, de canto al brazo y con la pantalla mirando a la cara.
  const celular = new THREE.Group(); celular.visible = false; brazos[1].mano.add(celular);
  cubo(.075, .016, .14, mat('#16161a', { metalness: .4, roughness: .35 }), 0, -.07, -.02, celular);
  cubo(.064, .006, .122, mat('#ff3b8b', { emissive: '#ff3b8b', emissiveIntensity: .7 }), 0, -.06, -.02, celular);

  const cabeza = new THREE.Group(); cabeza.position.y = .82; torso.add(cabeza);
  // Cráneo y mandíbula separados: mejillas anchas y mentón blando, sin forma de bola lisa.
  bola(.305, piel, 0, .015, 0, cabeza, gordo ? 1.09 : 1, 1.06, .90);
  bola(.25, piel, 0, -.12, -.035, cabeza, gordo ? 1.18 : 1.04, .72, .96);
  const orejas = [-1, 1].map(s => {
    bola(.075, piel, s * (gordo ? .326 : .30), -.055, .008, cabeza, .65, 1, .65);
    bola(.041, rosado, s * (gordo ? .345 : .32), -.055, -.023, cabeza, .45, .85, .50);
  });
  const ojos = [], cejas = [];
  const pupila = mat('#17120f', { roughness: .18 });
  const iris = mat(L.robot ? '#38d9e6' : L.ojos, { roughness: .24, ...(L.robot ? { emissive: '#38d9e6', emissiveIntensity: .7 } : {}) });
  const resplandor = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const s of [-1, 1]) {
    const ojo = new THREE.Group(); ojo.position.set(s * .115, -.015, -.253); cabeza.add(ojo);
    bola(.061, mat('#fffaf0', { roughness: .25 }), 0, 0, 0, ojo, .88, 1.12, .45);
    bola(.042, iris, 0, -.001, -.023, ojo, .88, 1.07, .42);
    bola(.026, pupila, 0, -.001, -.036, ojo, .85, 1.10, .40);
    bola(.012, resplandor, -.011, .017, -.045, ojo, .8, 1, .4);
    bola(.005, resplandor, .012, -.018, -.047, ojo);
    ojos.push(ojo);
    const ceja = tubo(.015, .064, mat(L.barba || (L.pelo.estilo === 'calvo' ? '#755341' : L.pelo.color)), s * .113, .095, -.255, cabeza);
    ceja.rotation.z = Math.PI / 2 + s * .12; cejas.push(ceja);
  }
  bola(.053, rosado, 0, -.073, -.286, cabeza, .89, 1, .91);
  bola(.029, piel, 0, -.027, -.261, cabeza, .70, 1.4, .65);
  const boca = new THREE.Group(); boca.position.set(0, -.173, -.245); cabeza.add(boca);
  const sonrisa = aro(.043, .008, mat('#865044'), 0, .017, 0, boca, Math.PI * .76); sonrisa.rotation.z = Math.PI * 1.12;
  bola(.029, rosado, 0, -.016, -.001, boca, 1.1, .19, .25);

  // Pelo esculpido en mechones con siluetas diferentes, conservando el peinado del elenco.
  const estilo = L.pelo.estilo;
  if (['corto', 'largo', 'rulos'].includes(estilo)) {
    const casco = pieza(new THREE.SphereGeometry(.318, seg(28), seg(16), 0, Math.PI * 2, 0, Math.PI * .54), pelo, 0, .045, .012, cabeza);
    casco.scale.set(gordo ? 1.08 : 1, 1.04, .92);
    if (estilo !== 'rulos') for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * .074;
      const m = bola(.077, pelo, x, .235 + Math.sin(i * .7) * .025, -.207 + Math.abs(x) * .2, cabeza, 1, 1.1 + i * .04, .60);
      m.rotation.z = -.3 + i * .06;
    }
  }
  if (estilo === 'largo') {
    bola(.28, pelo, 0, -.10, .16, cabeza, 1.16, 1.36, .65);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const m = tubo(.055, .33 + i * .02, pelo, s * (.265 + i * .012), -.135, .02 + i * .08, cabeza);
      m.rotation.z = s * (.08 + i * .08);
    }
  }
  if (estilo === 'rulos' || estilo === 'rulosPoco') {
    const n = estilo === 'rulos' ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, elev = estilo === 'rulos' ? .45 + (i % 5) * .22 : .22 + (i % 2) * .15;
      const x = Math.cos(a) * Math.cos(elev) * .30, y = Math.sin(elev) * .30 + .05, z = Math.sin(a) * Math.cos(elev) * .27;
      if (z < -.13 && y < .15) continue;
      bola(.078, pelo, x, y, z, cabeza, 1, 1.12, .95);
    }
  }
  // Rapado: una capa finita del color del pelo pegada al cráneo.
  if (estilo === 'rapado' || estilo === 'rulosCorto') {
    const r = pieza(new THREE.SphereGeometry(.309, seg(28), seg(16), 0, Math.PI * 2, 0, Math.PI * (estilo === 'rapado' ? .5 : .47)), mat(L.pelo.color, { transparent: true, opacity: estilo === 'rapado' ? .55 : .92, roughness: 1 }), 0, .04, .006, cabeza);
    r.scale.set(gordo ? 1.09 : 1.005, 1.065, .905);
    r.rotation.x = estilo === 'rulosCorto' ? .3 : .3; // la línea del pelo más arriba en la frente
  }
  // Rulos cortos arriba, costados rebajados
  if (estilo === 'rulosCorto') for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, rr = .06 + (i % 4) * .045;
    bola(.062, pelo, Math.cos(a) * rr * 1.5, .27 + (i % 3) * .025 - rr * .25, Math.sin(a) * rr - .03, cabeza, 1, .9, 1);
  }
  // Pelo corto con entradas (canoso de Glinsky): sin flequillo y la frente despejada
  if (estilo === 'entradas') {
    const c = pieza(new THREE.SphereGeometry(.316, seg(28), seg(16), 0, Math.PI * 2, 0, Math.PI * .5), pelo, 0, .05, .03, cabeza);
    c.scale.set(gordo ? 1.08 : 1, 1.04, .93); c.rotation.x = .38;
    for (const sd of [-1, 1]) bola(.07, pelo, sd * .275, .02, .07, cabeza, .5, 1.2, 1.3);
  }
  if (estilo === 'poco') for (let i = 0; i < 10; i++) {
    const a = Math.PI * i / 9;
    bola(.052, pelo, Math.cos(a) * .295, .00, Math.sin(a) * .25, cabeza, .7, 1.3, 1);
  }
  if (L.barba) {
    const barba = mat(L.barba);
    const b = pieza(new THREE.SphereGeometry(.282, seg(24), seg(12), 0, Math.PI * 2, Math.PI * .62, Math.PI * .38), barba, 0, -.025, -.035, cabeza);
    b.scale.set(gordo ? 1.08 : 1, 1.2, .91);
    if (L.barbaCorta) {
      // barba corta: empieza más abajo (no tapa los cachetes) y deja ver un poco la piel
      b.geometry.dispose();
      b.geometry = new THREE.SphereGeometry(.282, seg(24), seg(12), 0, Math.PI * 2, Math.PI * .7, Math.PI * .3);
      b.scale.set(gordo ? 1.06 : .99, 1.17, .9); b.material = mat(L.barba, { transparent: true, opacity: .82, roughness: 1 });
    }
    if (!L.barbaCorta) for (const s of [-1, 1]) {
      const bigote = tubo(.020, .055, barba, s * .037, -.135, -.262, cabeza); bigote.rotation.z = Math.PI / 2 + s * -.2;
    }
  }
  if (L.lentes) {
    const marco = mat(L.lentes, { metalness: .2, roughness: .35 });
    for (const s of [-1, 1]) {
      const a = aro(.084, L.lentesForma === 'cuadrada' ? .012 : .009, marco, s * .115, -.015, -.301, cabeza);
      if (L.lentesForma === 'cuadrada') a.scale.set(1.12, .82, 1);
      cubo(.012, .012, .23, marco, s * .197, -.010, -.18, cabeza);
      if (L.lentesClaros) {
        const v = pieza(new THREE.CircleGeometry(.08, 20), new THREE.MeshStandardMaterial({ color: '#d8ecf2', transparent: true, opacity: .22, roughness: .05, metalness: .1 }), s * .115, -.015, -.303, cabeza);
        v.rotation.y = Math.PI;
      }
    }
    const puente = aro(.034, .008, marco, 0, -.025, -.304, cabeza, Math.PI); puente.rotation.z = 0;
  }
  if (L.auriculares) {
    const m = mat(L.auriculares);
    const arco = aro(.337, .026, m, 0, .00, .014, cabeza, Math.PI);
    arco.rotation.z = 0;
    for (const s of [-1, 1]) {
      bola(.098, negro, s * .326, -.045, .013, cabeza, .43, 1.05, .8);
      bola(.082, m, s * .357, -.045, .013, cabeza, .36, 1, .83);
      bola(.045, metal, s * .38, -.045, .013, cabeza, .18, 1, .83);
    }
  }
  if (L.kipa) {
    // kipá grande: cubre buena parte de la coronilla, con un borde finito
    const k = pieza(new THREE.SphereGeometry(.235, seg(26), seg(12), 0, Math.PI * 2, 0, Math.PI * .4), mat(L.kipa), 0, .2, .07, cabeza);
    k.rotation.x = .28; k.scale.set(1, .95, 1);
    // borde pegado a la base de la kipá (va dentro de la kipá, así gira con ella)
    const borde = aro(.235 * Math.sin(Math.PI * .4), .008, mat(new THREE.Color(L.kipa).multiplyScalar(.7)), 0, .235 * Math.cos(Math.PI * .4), 0, k); borde.rotation.x = Math.PI / 2;
  }
  if (L.gorra) {
    // gorra con visera
    const g = mat(L.gorra);
    const copa = pieza(new THREE.SphereGeometry(.325, seg(28), seg(14), 0, Math.PI * 2, 0, Math.PI * .5), g, 0, .075, .01, cabeza);
    copa.scale.set(gordo ? 1.08 : 1.01, .95, .94);
    const visera = bola(.2, g, 0, .1, -.3, cabeza, 1.05, .07, 1);
    visera.rotation.x = -.12;
    bola(.022, g, 0, .385, .0, cabeza);
  }
  // Gorro de cocina (toca): banda y copa inflada
  if (L.toca) {
    const t = mat(L.toca);
    pieza(new THREE.CylinderGeometry(.325, .33, .2, 24), t, 0, .28, .01, cabeza);
    bola(.34, t, 0, .45, .01, cabeza, 1, .62, .95);
    for (const k of [-1, 0, 1]) bola(.13, t, k * .15, .52, .01, cabeza, 1, 1, 1);
  }
  if (L.sombrero) {
    bola(.38, mat(L.sombrero), 0, .29, 0, cabeza, 1, .08, .87);
    pieza(new THREE.CylinderGeometry(.20, .24, .21, 24), mat(L.sombrero), 0, .40, 0, cabeza);
    pieza(new THREE.CylinderGeometry(.235, .24, .045, 24), cuero, 0, .32, 0, cabeza);
  }
  if (L.antifaz) {
    const m = mat(L.antifaz);
    for (const s of [-1, 1]) aro(.077, .019, m, s * .115, -.015, -.290, cabeza);
    cubo(.07, .035, .02, m, 0, -.015, -.290, cabeza);
  }
  // Capucha puesta: cubre arriba, los costados y atrás de la cabeza; deja la cara libre.
  if (capucha) {
    const m = mat(L.capucha, { roughness: .9 });
    const hueco = .82;
    // arriba cerrada (tapa la frente) y a los costados/atrás con el hueco de la cara
    const arriba = pieza(new THREE.SphereGeometry(.36, seg(30), seg(10), 0, Math.PI * 2, 0, Math.PI * .3), m, 0, .02, .02, cabeza);
    arriba.scale.set(gordo ? 1.1 : 1.02, 1.12, 1);
    const h = pieza(new THREE.SphereGeometry(.36, seg(30), seg(16), Math.PI * 1.5 + hueco, Math.PI * 2 - hueco * 2, Math.PI * .29, Math.PI * .39), m, 0, .02, .02, cabeza);
    h.scale.set(gordo ? 1.1 : 1.02, 1.12, 1);
    const borde = aro(.255, .045, m, 0, -.02, -.22, cabeza, Math.PI * 1.25);
    borde.rotation.set(0, 0, -Math.PI * .125); borde.scale.set(1.05, 1.3, 1);
    bola(.24, m, 0, -.22, .17, cabeza, 1.2, .75, .7);
  }
  let capa = null;
  if (L.capa) {
    capa = new THREE.Group(); capa.position.set(0, .44, .12); torso.add(capa);
    const geo = new THREE.PlaneGeometry(ancho * 2.8, .91, 10, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, .04 * Math.cos(x * 28) + (.46 - y) * .17);
      pos.setX(i, x * (1 - y * .35));
    }
    geo.computeVertexNormals(); pieza(geo, mat(L.capa, { side: THREE.DoubleSide }), 0, -.43, 0, capa);
  }
  if (L.robot) {
    tubo(.017, .14, metal, 0, .40, .015, cabeza);
    bola(.040, mat('#ff9b73', { emissive: '#ff704e', emissiveIntensity: .8 }), 0, .49, .015, cabeza);
    for (const s of [-1, 1]) bola(.022, metal, s * .215, .09, -.205, cabeza);
  }
  const sombra = pieza(new THREE.CircleGeometry(.40, 24), new THREE.MeshBasicMaterial({ color: '#17191e', transparent: true, opacity: .17, depthWrite: false }), 0, .008, 0, grupo);
  sombra.rotation.x = -Math.PI / 2; sombra.castShadow = false; sombra.receiveShadow = false;
  let aura = null;
  if (L.dorado) {
    aura = new THREE.Group(); grupo.add(aura);
    for (let i = 0; i < 12; i++) {
      const o = pieza(new THREE.OctahedronGeometry(.035), mat('#ffda5b', { emissive: '#c38b20', emissiveIntensity: .7 }), 0, 0, 0, aura);
      o.userData.a = i * Math.PI / 6;
    }
  }

  // Compactar las piezas inmóviles de cada articulación en una malla por material.
  // La cara sigue teniendo volumen real, pero 24 bots no multiplican cientos de draw calls.
  compactar(THREE, cuerpo);
  // Piezas faciales móviles para las señas del truco. Se agregan después del batching.
  const lengua = bola(.024, mat('#d67d83'), 0, -.199, -.270, cabeza, .74, .85, .35);
  const dientes = bola(.030, blanco, 0, -.164, -.263, cabeza, 1, .26, .20);
  const cachetes = [-1, 1].map(s => bola(.073, piel, s * .183, -.100, -.224, cabeza, 1, .95, .70));
  const arruga = aro(.033, .004, mat('#aa7860'), 0, -.047, -.309, cabeza, Math.PI);
  lengua.visible = dientes.visible = arruga.visible = false; cachetes.forEach(c => c.visible = false);
  return armarApi(THREE, { grupo, cuerpo, torso, cabeza, brazos, piernas, boca, sonrisa, lengua, dientes, arruga, cachetes, cejas, ojos, capa, aura, seg, celular, alturaCadera: .69, trav: travieso(L) }, { nombre, colorNombre, tamCartel, tamGlobo });
}

// Rig compartido: animaciones, globos de diálogo, cartel con el nombre y polvo al correr.
// Sirve para cualquier cuerpo que tenga estas articulaciones (cuerpo, torso, cabeza, brazos y piernas).
function armarApi(THREE, P, { nombre = '', colorNombre = '#ffffff', tamCartel = 0.65, tamGlobo = 0.5 } = {}) {
  const { grupo, cuerpo, torso, cabeza, brazos, piernas, boca, sonrisa, lengua, dientes, arruga, cachetes, cejas, ojos, capa, aura, seg, celular = null, alturaCadera = .69, poseQuieto = null, alListo = null, abrirBrazos = .08, trav = null } = P;
  const cartel = nombre ? sprite(THREE, nombre, colorNombre, 'rgba(20,20,19,.76)', tamCartel) : null;
  if (cartel) { cartel.position.y = 2.13; grupo.add(cartel); }
  let globo = null, globoHasta = 0, reloj = 0, fase = 0, transcurrido = 0, anterior = '', parpadeo = 3;
  // Polvito al correr: se suelta en la escena (no en el personaje) para que quede atrás.
  const polvo = [];
  let ultimoPaso = 0;
  const geoPolvo = new THREE.SphereGeometry(.07, seg(8), seg(6));
  const soltarPolvo = (lado) => {
    const escena = grupo.parent;
    if (!escena || polvo.length > 10) return;
    const m = new THREE.MeshBasicMaterial({ color: '#d9cbb0', transparent: true, opacity: .45, depthWrite: false });
    const p = new THREE.Mesh(geoPolvo, m);
    const v = new THREE.Vector3(lado * .1, .04, .12);
    grupo.localToWorld(v);
    escena.worldToLocal(v);
    p.position.copy(v); p.userData.vida = .55; p.userData.base = grupo.scale.x; // en el royale los personajes están agrandados
    escena.add(p); polvo.push(p);
  };
  const alias = { idle: 'quieto', caminar: 'camina', correr: 'corre', morir: 'muerto', muerte: 'muerto', celebrar: 'festeja', disparar: 'dispara', recargar: 'recarga', curar: 'cura' };
  const api = {
    grupo, cabeza, altura: 2,
    // gesto pedido (B en la carrera): baila, festeja, saluda, voltereta, habla
    gesto(id) { trav?.pedir(id); },
    // se resuelve cuando el personaje terminó de cargar sus texturas (para sacarle una foto)
    listo: alListo || Promise.resolve(),
    manos: { izquierda: brazos[0].mano, derecha: brazos[1].mano },
    // Se llama después de animar: modifica sólo la cara, sin interferir con mirada/postura.
    expresar(expr = 'neutral', hablando = false) {
      if (hablando && expr === 'neutral') boca.scale.set(.9, 1.4 + Math.sin(reloj * 24) * .5, 1);
      if (expr === 'brows') cejas.forEach(c => c.position.y = .145);
      else if (expr === 'wink') ojos[0].scale.y = .055;
      else if (expr === 'eyesClosed') ojos.forEach(o => o.scale.y = .055);
      else if (expr === 'mouthRight' || expr === 'mouthLeft') {
        const s = expr === 'mouthRight' ? 1 : -1;
        boca.position.x = s * .035; boca.rotation.z = s * .22;
      } else if (expr === 'bite') { boca.scale.set(.85, .6, 1); dientes.visible = true; }
      else if (expr === 'kiss') { boca.scale.set(.55, 1.5, 1); boca.position.z = -.273; }
      else if (expr === 'tongue') { lengua.visible = true; boca.scale.y = 1.3; }
      else if (expr === 'puff') { cachetes.forEach(c => c.visible = true); boca.scale.x = .7; }
      else if (expr === 'nose') { arruga.visible = true; cabeza.rotation.x -= .025; cejas.forEach((c, i) => c.rotation.z += i ? .22 : -.22); }
      else if (expr === 'frown') { sonrisa.rotation.z += Math.PI; boca.position.y -= .022; }
    },
    decir(texto, seg = 4.5) {
      if (globo) { grupo.remove(globo); liberarSprite(globo); }
      globo = sprite(THREE, texto, '#141413', '#ffffff', tamGlobo, true);
      globo.position.y = 2.2 + tamCartel + globo.scale.y / 2; grupo.add(globo); globoHasta = reloj + seg;
    },
    animar(estado = 'quieto', dt = 0) {
      // Los juegos originales envían strings; el royale también puede enviar banderas.
      if (estado && typeof estado === 'object') {
        const e = estado;
        estado = e.muerto || e.vivo === false ? 'muerto' : e.caido ? 'tirado' : e.golpe ? 'golpe'
          : e.festeja ? 'festeja' : e.recargando ? 'recarga' : e.curando ? 'cura' : e.dispara ? 'dispara'
          : e.corre ? 'corre' : e.mueve || e.velocidad > .05 ? 'camina' : e.apunta ? 'apunta' : 'quieto';
      }
      estado = alias[estado] || estado; dt = Math.max(0, Math.min(dt, .1));
      reloj += dt;
      if (trav) estado = trav.filtrar(estado, dt, reloj); // gestos pedidos y travesuras
      transcurrido = estado === anterior ? transcurrido + dt : 0; anterior = estado;
      fase += dt * (estado === 'corre' ? 12 : estado === 'camina' ? 7 : 3);
      const s = Math.sin(fase), paso = estado === 'corre' ? .72 : .42;
      cuerpo.position.set(0, 0, 0); cuerpo.rotation.set(0, 0, 0);
      torso.rotation.set(0, 0, 0); torso.scale.set(1, 1, 1); cabeza.rotation.set(0, 0, 0);
      boca.scale.set(1, 1, 1);
      boca.position.set(0, -.173, -.245); boca.rotation.set(0, 0, 0); sonrisa.rotation.z = Math.PI * 1.12;
      lengua.visible = dientes.visible = arruga.visible = false; cachetes.forEach(c => c.visible = false);
      cejas.forEach(c => c.position.y = .095);
      for (const p of piernas) { p.cadera.rotation.set(0, 0, 0); p.rodilla.rotation.set(0, 0, 0); }
      for (let i = 0; i < 2; i++) { brazos[i].hombro.rotation.set(0, 0, i ? abrirBrazos : -abrirBrazos); brazos[i].codo.rotation.set(.12, 0, 0); }
      if (celular) celular.visible = estado === 'tiktok';
      if (estado === 'corre') {
        // Carrera: rodilla bien arriba adelante, talón al glúteo atrás, brazos que bombean,
        // cuerpo inclinado que rebota y gira un poco contra los brazos.
        piernas.forEach((p, i) => {
          const t = i ? -s : s;
          p.cadera.rotation.x = t * .95 + .12;
          p.rodilla.rotation.x = -(t < 0 ? -t * 1.55 : .25 + t * .35);
        });
        brazos.forEach((b, i) => { const t = i ? s : -s; b.hombro.rotation.x = t * .9 + .1; b.codo.rotation.x = 1.35 + t * .2; b.hombro.rotation.z = (i ? 1 : -1) * .12; });
        cuerpo.position.y = Math.abs(Math.sin(fase)) * .075;
        torso.rotation.x = -.2; torso.rotation.y = -s * .14; torso.rotation.z = s * .03;
        cabeza.rotation.x = .12 - Math.abs(Math.sin(fase)) * .05; cabeza.rotation.y = s * .08;
        // polvito en los pies cada vez que apoya
        const pasoN = Math.floor(fase / Math.PI);
        if (pasoN !== ultimoPaso) { ultimoPaso = pasoN; soltarPolvo(pasoN % 2 ? 1 : -1); }
      } else if (estado === 'camina') {
        piernas.forEach((p, i) => { const t = i ? -s : s; p.cadera.rotation.x = t * paso; p.rodilla.rotation.x = -Math.max(0, -t) * .9; });
        brazos.forEach((b, i) => { b.hombro.rotation.x = (i ? s : -s) * paso * .8; b.codo.rotation.x = .25; });
        cuerpo.position.y = Math.abs(Math.cos(fase)) * .018;
        torso.rotation.z = s * .035; torso.rotation.x = -.025;
        cabeza.rotation.z = -s * .025;
      } else if (estado === 'baila') {
        const b = Math.sin(reloj * 7);
        cuerpo.position.set(b * .06, Math.abs(Math.sin(reloj * 7)) * .07, 0);
        torso.rotation.y = Math.sin(reloj * 3.5) * .35; torso.rotation.z = b * .08;
        brazos[0].hombro.rotation.set(Math.sin(reloj * 3.5) * .6, 0, -1.3 - b * .5); brazos[0].codo.rotation.x = 1.1;
        brazos[1].hombro.rotation.set(-Math.sin(reloj * 3.5) * .6, 0, 1.3 - b * .5); brazos[1].codo.rotation.x = 1.1;
        piernas[0].rodilla.rotation.x = -Math.max(0, b) * .5; piernas[1].rodilla.rotation.x = -Math.max(0, -b) * .5;
        cabeza.rotation.z = b * .15; boca.scale.y = 1.4;
      } else if (estado === 'tiktok') {
        // se graba: brazo derecho estirado adelante y arriba (selfie) con el celular, y un bailecito
        const b = Math.sin(reloj * 6);
        cuerpo.position.set(b * .04, Math.abs(b) * .04, 0); torso.rotation.y = Math.sin(reloj * 3) * .2;
        brazos[1].hombro.rotation.set(1.85 + Math.sin(reloj * 2) * .08, 0, -.25); brazos[1].codo.rotation.x = .35;
        cabeza.rotation.x = -.12;
        brazos[0].hombro.rotation.set(Math.sin(reloj * 3) * .5, 0, -1.1 - b * .4); brazos[0].codo.rotation.x = 1;
        cabeza.rotation.z = b * .12; boca.scale.y = 1.4;
      } else if (estado === 'saluda') {
        brazos[1].hombro.rotation.set(0, 0, 2.55); brazos[1].codo.rotation.set(0, 0, Math.sin(reloj * 11) * .45);
        cabeza.rotation.z = -.1; boca.scale.y = 1.3;
      } else if (estado === 'habla') {
        brazos.forEach((b, i) => { b.hombro.rotation.x = .45 + Math.sin(reloj * 4 + i * 2) * .25; b.codo.rotation.x = 1 + Math.sin(reloj * 5 + i) * .3; b.hombro.rotation.z = (i ? 1 : -1) * .25; });
        cabeza.rotation.y = Math.sin(reloj * 2) * .2; boca.scale.y = 1 + Math.abs(Math.sin(reloj * 14)) * .8;
      } else if (estado === 'duerme') {
        cuerpo.rotation.x = 1.5; cuerpo.position.set(0, .17, .35);
        brazos[0].hombro.rotation.z = -.4; brazos[1].hombro.rotation.z = .4;
        if (transcurrido < dt * 1.5) api.decir('Zzz… zzz…', 6.5);
      } else if (estado === 'flexiones') {
        const b = Math.abs(Math.sin(reloj * 3.2));
        cuerpo.rotation.x = -1.32; cuerpo.position.set(0, .26 + b * .14, .35);
        brazos.forEach((x) => { x.hombro.rotation.set(1.45 - b * .2, 0, 0); x.codo.rotation.x = -(1 - b) * 1.1; });
      } else if (estado === 'voltereta') {
        const k = transcurrido / 1.05;
        voltereta(cuerpo, k, .85, .7);
        const t = Math.sin(Math.min(1, k) * Math.PI);
        piernas.forEach((p) => { p.cadera.rotation.x = 1.5 * t; p.rodilla.rotation.x = -2 * t; });
        brazos.forEach((b) => { b.hombro.rotation.x = 1.4 * t; b.codo.rotation.x = 1.2 * t; });
      } else if (estado === 'apose') {
        // Pose A quieta (brazos separados, piernas un poco abiertas): para fichas de personaje y pasar a 3D.
        brazos[0].hombro.rotation.z = -.62; brazos[1].hombro.rotation.z = .62;
        brazos.forEach(b => b.codo.rotation.x = 0);
        piernas[0].cadera.rotation.z = -.07; piernas[1].cadera.rotation.z = .07;
      } else if (estado === 'muerto') {
        const t = Math.min(1, transcurrido / .85), curva = 1 - Math.pow(1 - t, 3);
        cuerpo.rotation.x = curva * 1.49; cuerpo.rotation.z = Math.sin(t * Math.PI) * .24;
        cuerpo.position.y = Math.sin(t * Math.PI) * .14 + curva * .14;
        cuerpo.position.z = curva * .32;
        brazos[0].hombro.rotation.z = -curva * 1.1; brazos[1].hombro.rotation.z = curva * .75;
        piernas[0].rodilla.rotation.x = curva * .5; piernas[1].cadera.rotation.z = curva * .18;
        cabeza.rotation.y = curva * -.28;
      } else if (estado === 'salto') {
        piernas[0].cadera.rotation.x = .65; piernas[0].rodilla.rotation.x = -.9;
        piernas[1].cadera.rotation.x = -.25; piernas[1].rodilla.rotation.x = -.4;
        brazos[0].hombro.rotation.z = -2.3; brazos[1].hombro.rotation.z = 2.3;
      } else if (estado === 'buceo') {
        cuerpo.rotation.x = -1.35; cuerpo.position.y = .4;
        brazos.forEach(b => b.hombro.rotation.x = 2.9);
      } else if (estado === 'golpe' || estado === 'cae') {
        cuerpo.rotation.z = Math.sin(transcurrido * 24) * .35; cuerpo.rotation.x = .25;
        brazos[0].hombro.rotation.z = -1.8; brazos[1].hombro.rotation.z = 1.8;
        boca.scale.y = 2;
      } else if (estado === 'tirado') {
        cuerpo.rotation.x = 1.5; cuerpo.position.set(0, .17, .35);
        brazos[0].hombro.rotation.z = -1.1; brazos[1].hombro.rotation.z = 1.1;
        piernas[0].rodilla.rotation.x = .5;
      } else if (estado === 'pina') {
        brazos[1].hombro.rotation.x = 1.6; brazos[0].codo.rotation.x = 1.5; torso.rotation.y = .4;
      } else if (estado === 'patada') {
        piernas[1].cadera.rotation.x = 1.5; torso.rotation.x = .22;
        brazos[0].hombro.rotation.z = -.8; brazos[1].hombro.rotation.z = .8;
      } else if (estado === 'festeja') {
        cuerpo.position.y = Math.abs(Math.sin(fase * 1.4)) * .24;
        brazos[0].hombro.rotation.z = -2.6 + s * .18; brazos[1].hombro.rotation.z = 2.6 - s * .18;
        cabeza.rotation.z = s * .12; boca.scale.y = 1.5;
      } else if (estado === 'sentado') {
        cuerpo.position.y = .43 - alturaCadera; // la cadera queda a la altura del asiento
        piernas.forEach(p => { p.cadera.rotation.x = 1.5; p.rodilla.rotation.x = -1.45; });
        brazos.forEach(b => { b.hombro.rotation.x = .95; b.codo.rotation.x = .70; });
        cabeza.rotation.y = Math.sin(fase * .3) * .16;
      } else if (estado === 'dispara' || estado === 'apunta') {
        brazos[1].hombro.rotation.x = 1.45; brazos[1].codo.rotation.x = .3;
        brazos[0].hombro.rotation.x = .95; brazos[0].codo.rotation.x = .8;
        torso.rotation.x = estado === 'dispara' ? Math.exp(-transcurrido * 15) * .12 : -.02;
      } else if (estado === 'recarga' || estado === 'cura') {
        brazos[0].hombro.rotation.x = .6; brazos[0].codo.rotation.x = 1.4;
        brazos[1].hombro.rotation.x = .5; brazos[1].codo.rotation.x = 1.2 + Math.sin(fase * 3) * .18;
        cabeza.rotation.x = -.16;
      } else {
        torso.scale.y = 1 + Math.sin(fase) * .007;
        if (poseQuieto === 'celular') {
          // Mati: mirando el celular con una mano y la otra en la cintura
          brazos[0].hombro.rotation.set(.25, 0, -.1); brazos[0].codo.rotation.set(1.55, .5, .45);
          brazos[1].hombro.rotation.set(.05, 0, .55); brazos[1].codo.rotation.set(.3, 0, -1.25);
        }
        cabeza.rotation.y = Math.sin(fase * .38) * .11; cabeza.rotation.z = Math.sin(fase * .25) * .025;
      }
      parpadeo -= dt;
      const cerrado = estado === 'muerto' ? Math.min(1, transcurrido * 3) : parpadeo < .12 ? Math.sin(Math.max(0, parpadeo) / .12 * Math.PI) : 0;
      ojos.forEach(o => { o.scale.y = Math.max(.07, 1 - cerrado); });
      if (parpadeo <= 0) parpadeo = 3.2 + Math.sin(reloj * 1.7) * 1.2;
      cejas.forEach((c, i) => c.rotation.z = Math.PI / 2 + (i ? 1 : -1) * (estado === 'golpe' ? -.18 : .12));
      if (capa) capa.rotation.x = .1 + Math.sin(fase) * (estado === 'corre' ? .18 : .045);
      if (aura) aura.children.forEach((c, i) => { const a = c.userData.a + reloj; c.position.set(Math.cos(a) * .48, .3 + (i % 4) * .4 + Math.sin(reloj * 2 + i) * .09, Math.sin(a) * .48); c.rotation.y += dt; });
      if (globo && reloj > globoHasta) { grupo.remove(globo); liberarSprite(globo); globo = null; }
      // el polvo queda en el mundo, crece y se desvanece
      for (let i = polvo.length - 1; i >= 0; i--) {
        const p = polvo[i]; p.userData.vida -= dt;
        const k = 1 - p.userData.vida / .55;
        p.scale.setScalar((.6 + k * 1.4) * (p.userData.base || 1)); p.position.y += dt * .25 * (p.userData.base || 1); p.material.opacity = .45 * (1 - k);
        if (p.userData.vida <= 0) { p.removeFromParent(); p.material.dispose(); polvo.splice(i, 1); }
      }
    },
    dispose() {
      const geometries = new Set(), mats = new Set();
      grupo.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); });
      geometries.forEach(g => g.dispose()); mats.forEach(m => { if (!m.map?.userData?.compartida) m.map?.dispose(); m.dispose(); }); grupo.removeFromParent();
    },
  };
  api.animar('quieto', 0);
  return api;
}

// ---------------------------------------------------------------- elenco con modelo propio
// Estilo low-poly facetado como los modelos de Meshy. La cabeza y el torso son "siluetas": anillos que
// copian el contorno de frente de la captura, con la captura proyectada adelante y un color liso atrás.
const texturas = new Map();
function texturaCompartida(THREE, url) {
  if (!texturas.has(url)) {
    let ok;
    const listo = new Promise((r) => (ok = r));
    const t = new THREE.TextureLoader().load(url, () => ok(), undefined, () => ok());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.userData.compartida = true;
    texturas.set(url, { t, listo });
  }
  return texturas.get(url);
}

// perfil: filas [y hacia abajo, x izquierda, x derecha] (m). Devuelve una malla con el tope en y=0.
function silueta(THREE, perfil, { x0, x1, alto, lados = null }, { prof = () => 1, p = .85, segs = 12, nariz = 0 } = {}) {
  const pos = [], uv = [];
  // Con perfiles de costado (filas [y, xl, xr, zf, zb]) la profundidad sale de las capturas de perfil, y la
  // textura tiene cuatro paneles: frente | espalda | costado izquierdo | costado derecho.
  const conProf = perfil[0].length >= 5;
  const paneles = lados ? 4 : 2, ancho = 1 / paneles;
  if (lados) segs = 16;
  const region = (t) => { const c = Math.cos(t); if (!lados) return c > 0 ? 'frente' : 'espalda'; if (c > .7071) return 'frente'; if (c < -.7071) return 'espalda'; return Math.sin(t) < 0 ? 'izq' : 'der'; };
  const U = (v, reg) => {
    const x = v[0], z = v[2];
    if (reg === 'frente' || reg === 'espalda') {
      const k = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
      return reg === 'frente' ? k * ancho : ancho + (1 - k) * ancho;
    }
    const [zmin, zmax] = lados[reg];
    const k = Math.min(1, Math.max(0, (z - zmin) / (zmax - zmin)));
    return (reg === 'izq' ? 2 : 3) * ancho + k * ancho;
  };
  const V = (y) => 1 - Math.min(1, Math.max(0, y / alto));
  const anillos = perfil.map(([y, xl, xr, zf, zb]) => {
    const xm = (xl + xr) / 2, hw = Math.max(.006, (xr - xl) / 2), hd = hw * prof(y / alto);
    const pts = [];
    for (let j = 0; j <= segs; j++) {
      const t = (j / segs) * Math.PI * 2, sn = Math.sin(t), cs = Math.cos(t);
      let z = conProf ? (cs > 0 ? zf : zb) * Math.abs(cs) ** p : -hd * Math.sign(cs) * Math.abs(cs) ** p;
      // nariz: la columna del medio se adelanta a la altura de la nariz
      if (nariz && !conProf && cs > .8) z -= nariz * hw * Math.exp(-((((y / alto) - .62) / .1) ** 2)) * (cs - .8) * 5;
      pts.push([xm + hw * Math.sign(sn) * Math.abs(sn) ** p, -y, z]);
    }
    return pts;
  });
  // normal suave de cada punto (producto entre la dirección alrededor y la dirección hacia abajo)
  const N = anillos.map((r, i) => r.map((_, j) => {
    const jj = j % segs, sig = anillos[i][(jj + 1) % segs], ant = anillos[i][(jj - 1 + segs) % segs];
    const arr = anillos[Math.max(0, i - 1)][jj], abj = anillos[Math.min(anillos.length - 1, i + 1)][jj];
    const t = [sig[0] - ant[0], sig[1] - ant[1], sig[2] - ant[2]], d = [abj[0] - arr[0], abj[1] - arr[1], abj[2] - arr[2]];
    const n = [t[1] * d[2] - t[2] * d[1], t[2] * d[0] - t[0] * d[2], t[0] * d[1] - t[1] * d[0]];
    const l = Math.hypot(...n) || 1; return n.map((x) => x / l);
  }));
  const nor = [];
  const tri = (a, b, c, reg) => {
    for (const [v, n] of [a, b, c]) { pos.push(v[0], v[1], v[2]); uv.push(U(v, reg), V(-v[1])); nor.push(...n); }
  };
  for (let i = 0; i < anillos.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const reg = region(((j + .5) / segs) * Math.PI * 2);
      const P = (ii, jj) => [anillos[ii][jj], N[ii][jj]];
      const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j);
      tri(a, b, d, reg); tri(b, c, d, reg);
    }
  }
  // tapas arriba y abajo
  for (const [fila, abajo] of [[0, false], [anillos.length - 1, true]]) {
    const r = anillos[fila], cx = r.reduce((s, v) => s + v[0], 0) / r.length, cz = r.reduce((s, v) => s + v[2], 0) / r.length;
    const centro = [cx, r[0][1], cz];
    const n = [0, abajo ? -1 : 1, 0];
    for (let j = 0; j < segs; j++) {
      const reg = region(((j + .5) / segs) * Math.PI * 2);
      const c0 = [centro, n], c1 = [r[j], n], c2 = [r[j + 1], n];
      if (abajo) tri(c0, c2, c1, reg); else tri(c0, c1, c2, reg);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// Medidas y textura de cara para un personaje sin captura (se arman desde su look).
const pintados = new Map();
function perfilPintado(THREE, L) {
  const clave = JSON.stringify(L);
  if (!pintados.has(clave)) {
    const t = new THREE.CanvasTexture(pintarCara(L));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.compartida = true;
    const flaco = L.cuerpo === 'flaco', gordo = L.cuerpo === 'gordito';
    pintados.set(clave, {
      cabeza: siluetaCabeza({ ancho: gordo ? .54 : .5, alto: .6, pelo: L.pelo?.estilo }), cabezaTex: t,
      piel: L.piel || '#e8c4a8', cinto: .68, hombros: flaco ? .2 : gordo ? .26 : .23, cintura: flaco ? .17 : gordo ? .235 : .195,
      prenda: L.ropa?.remera || '#7aa2ff', mangas: L.mangasLargas || L.capucha || L.robot ? 'larga' : 'corta', puno: L.ropa?.remera,
      cuello: L.polo ? 'chomba' : 'v', pantalon: L.ropa?.pantalon || '#3a4256', zapatos: L.robot ? '#5d6773' : L.ropa?.zapatillas || '#e9e1d1',
      cinturon: L.robot || L.liso ? null : '#5a3a26', kipa: L.kipa || null,
    });
  }
  return pintados.get(clave);
}

function crearPersonaFoto(THREE, L, F, opciones = {}) {
  const { sombras = true } = opciones;
  const ALTO = 1.85;
  const materiales = new Map();
  const mat = (color, extra = {}) => {
    const k = JSON.stringify([color, extra]);
    if (!materiales.has(k)) materiales.set(k, new THREE.MeshStandardMaterial({ color, roughness: .82, flatShading: true, ...extra }));
    return materiales.get(k);
  };
  const grupo = new THREE.Group(), cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  const pieza = (geo, m, x, y, z, parent) => {
    const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.castShadow = sombras; parent.add(p); return p;
  };
  // tubo facetado de r1 (arriba) a r2 (abajo), colgando desde y=0 hacia abajo
  const tubo = (r1, r2, largo, m, parent, x = 0, y = 0, z = 0, lados = 7) => pieza(new THREE.CylinderGeometry(r1, r2, largo, lados, 1), m, x, y - largo / 2, z, parent);
  const bola = (r, m, parent, x, y, z, sx = 1, sy = 1, sz = 1, a = 7, b = 5) => { const p = pieza(new THREE.SphereGeometry(r, a, b), m, x, y, z, parent); p.scale.set(sx, sy, sz); return p; };
  const caja = (w, h, d, m, parent, x, y, z) => pieza(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);

  const metal = L.robot ? { metalness: .6, roughness: .35 } : {};
  const piel = mat(F.piel, metal);
  const prenda = mat(F.prenda, metal), pantalon = mat(F.pantalon, metal), zapato = mat(F.zapatos);
  const cargas = [];

  // --- alturas (desde las capturas)
  const kc = F.escalaCabeza || 1; // algunas capturas tienen la cabeza en escorzo
  const altoCabeza = F.cabeza.alto * kc;
  const menton = ALTO - altoCabeza;
  const altoTorso = F.torso ? F.torso.alto : menton - F.cinto;
  const cinto = menton - altoTorso;
  const alturaCadera = cinto - .07;

  // --- torso (pivote en la cadera, como el resto de los personajes)
  const torso = new THREE.Group(); torso.position.y = alturaCadera; cuerpo.add(torso);
  let perfilTorso, dimTorso, matTorso;
  if (F.torso) {
    perfilTorso = F.torso.perfil; dimTorso = F.torso;
    const tx = texturaCompartida(THREE, F.torsoUrl); cargas.push(tx.listo);
    matTorso = new THREE.MeshStandardMaterial({ map: tx.t, emissiveMap: tx.t, emissive: '#ffffff', emissiveIntensity: .58, color: '#9c9c9c', roughness: .9 });
  } else {
    // torso armado: cuello angosto, hombros, pecho y cintura
    const h = altoTorso, hs = F.hombros, hc = F.cintura;
    const filas = [[0, .075], [.03, .085], [.06, hs * .8], [.1, hs], [.25, hs * .98], [.5, hs * .9], [.75, hc * 1.04], [1, hc]];
    perfilTorso = filas.map(([t, w]) => [t * h, -w, w]); dimTorso = { x0: -hs, x1: hs, alto: h };
    matTorso = prenda;
  }
  const geoT = silueta(THREE, perfilTorso, dimTorso, { prof: (v) => (v < .1 ? .5 + v * 1.2 : .62), p: .72, segs: 12 });
  pieza(geoT, matTorso, 0, menton - alturaCadera + .012, .0, torso);
  // anchos útiles del torso
  const ancho = (v) => { const f = perfilTorso[Math.min(perfilTorso.length - 1, Math.round(v * (perfilTorso.length - 1)))]; return (f[2] - f[1]) / 2; };
  const anchoHombro = Math.max(ancho(.18), ancho(.25));
  const anchoCintura = Math.max(ancho(1), ancho(.92), ancho(.85) * .97);
  // cadera / pantalón arriba y cinturón
  tubo(anchoCintura * .98, anchoCintura * .96, .17, pantalon, torso, 0, cinto - alturaCadera + .01, 0, 9).scale.z = .7;
  if (F.cinturon && !F.torso) {
    tubo(anchoCintura * 1.05, anchoCintura * 1.05, .035, mat(F.cinturon), torso, 0, cinto - alturaCadera + .02, 0, 9).scale.z = .7;
    caja(.05, .032, .015, mat('#b9a27a', { metalness: .5, roughness: .4 }), torso, 0, cinto - alturaCadera + .003, -anchoCintura * .7);
  }
  // cuellos y detalles de las prendas armadas
  if (!F.torso && F.cuello === 'chomba') {
    for (const sd of [-1, 1]) {
      const c = caja(.07, .015, .06, prenda, torso, sd * .045, menton - alturaCadera - .03, -.05);
      c.rotation.set(.5, sd * .5, sd * .35);
    }
    for (let i = 0; i < 2; i++) bola(.007, mat('#2a2a2e'), torso, 0, menton - alturaCadera - .07 - i * .04, -F.hombros * .62, 1, 1, 1, 5, 4);
  }
  if (!F.torso && F.cuello === 'v') {
    const v = pieza(new THREE.ConeGeometry(.045, .09, 3), piel, 0, menton - alturaCadera - .04, -F.hombros * .55, torso);
    v.rotation.set(Math.PI, 0, 0); v.scale.z = .25;
  }
  // cuello (piel) por debajo de la cabeza
  tubo(.062, .07, .09, piel, torso, 0, menton - alturaCadera + .055, .012, 7);

  // --- cabeza (pivote en el mentón)
  const cabeza = new THREE.Group(); cabeza.position.set(0, menton - alturaCadera + .012, .01); torso.add(cabeza);
  const txC = F.cabezaTex ? { t: F.cabezaTex } : texturaCompartida(THREE, F.cabezaUrl); if (txC.listo) cargas.push(txC.listo);
  const geoC = silueta(THREE, F.cabeza.perfil, F.cabeza, { prof: (v) => (v > .82 ? .8 : v < .12 ? .85 : .95), p: .8, segs: 12, nariz: .05 });
  pieza(geoC, new THREE.MeshStandardMaterial({ map: txC.t, emissiveMap: txC.t, emissive: '#ffffff', emissiveIntensity: .6, color: '#9c9c9c', roughness: .85 }), 0, altoCabeza, 0, cabeza).scale.setScalar(kc);
  const colorPelo = mat(L.pelo?.color || '#2b1d14');
  if (!L.foto && L.pelo?.estilo === 'largo') {
    // pelo largo cayendo atrás hasta los hombros
    bola(.25, colorPelo, cabeza, 0, altoCabeza * .42, .1, 1.02, 1.3, .62, 8, 6);
    for (const sd of [-1, 1]) bola(.09, colorPelo, cabeza, sd * .2, altoCabeza * .3, .02, .7, 1.7, .9, 6, 5);
  }
  if (L.sombrero) {
    const ala = pieza(new THREE.CylinderGeometry(.36, .37, .03, 10), mat(L.sombrero), 0, altoCabeza * .86, .02, cabeza); ala.scale.z = .9;
    pieza(new THREE.CylinderGeometry(.19, .23, .2, 8), mat(L.sombrero), 0, altoCabeza * .97, .02, cabeza);
    pieza(new THREE.CylinderGeometry(.235, .235, .045, 8), mat('#b8783f'), 0, altoCabeza * .9, .02, cabeza);
  }
  if (L.robot) {
    tubo(.014, .014, .14, mat('#a8a9a4', { metalness: .7, roughness: .3 }), cabeza, 0, altoCabeza + .13, .02, 5);
    bola(.035, mat('#ff9b73', { emissive: '#ff704e', emissiveIntensity: .8 }), cabeza, 0, altoCabeza + .14, .02);
  }
  if (F.kipa) {
    const r = F.kipaGrande ? .23 : .16; // kipá grande: tapa buena parte de la coronilla
    const k = pieza(new THREE.SphereGeometry(r, 14, 4, 0, Math.PI * 2, 0, Math.PI * .3), mat(F.kipa, { roughness: .6 }), 0, altoCabeza - r * .93, .035, cabeza);
    k.rotation.x = .3; k.scale.set(1.04, 1, 1.12);
  }

  // --- brazos (hombro, codo y mano)
  const hombroY = menton - alturaCadera - (F.torso ? .13 : .085);
  const largoBrazo = (menton - (F.torso ? .13 : .085)) - ALTO * .235;
  const brazo = largoBrazo * .43, antebrazo = largoBrazo * .37;
  const rBrazo = F.brazo || Math.max(.06, Math.min(.075, anchoHombro * .24));
  const manga = F.mangas === 'larga';
  const brazos = [-1, 1].map((s) => {
    const hombro = new THREE.Group(); hombro.position.set(s * (anchoHombro - rBrazo * (F.torso ? 1.25 : .25)), hombroY, .01); torso.add(hombro);
    bola(rBrazo * (F.torso ? 1.05 : 1.3), prenda, hombro, 0, -.01, 0, 1, 1, .9);
    if (manga) tubo(rBrazo, rBrazo * .92, brazo, prenda, hombro);
    else {
      tubo(rBrazo * (F.torso ? 1.08 : 1.3), rBrazo * (F.torso ? 1.1 : 1.25), brazo * .55, prenda, hombro);
      tubo(rBrazo * 1.14, rBrazo * 1.14, .03, mat(F.puno || F.prenda), hombro, 0, -brazo * .55 + .012);
      tubo(rBrazo * .88, rBrazo * .85, brazo * .5, piel, hombro, 0, -brazo * .5);
    }
    const codo = new THREE.Group(); codo.position.y = -brazo; hombro.add(codo);
    bola(rBrazo * .8, manga ? prenda : piel, codo, 0, 0, 0);
    tubo(rBrazo * .9, rBrazo * .78, antebrazo, manga ? prenda : piel, codo);
    if (manga) tubo(rBrazo * .76, rBrazo * .76, .035, mat(F.puno), codo, 0, -antebrazo + .02);
    const mano = new THREE.Group(); mano.position.y = -antebrazo; codo.add(mano);
    // mano facetada con pulgar
    const palma = bola(.065, piel, mano, 0, -.06, 0, .8, 1.3, .52, 6, 4);
    palma.rotation.y = s * .3;
    const pulgar = tubo(.02, .017, .065, piel, mano, -s * .045, -.025, -.028, 5); pulgar.rotation.z = s * .5;
    if (F.reloj && s === -1) {
      tubo(rBrazo * .78, rBrazo * .78, .03, mat(F.reloj), codo, 0, -antebrazo + .05);
      caja(.032, .04, .012, mat('#1d2228', { metalness: .3, roughness: .3 }), codo, 0, -antebrazo + .035, -rBrazo * .75);
    }
    if (F.celular && s === -1) {
      const c = caja(.06, .12, .01, mat('#0d0d0f', { metalness: .3, roughness: .25 }), mano, 0, -.07, -.035);
      c.rotation.x = -.15;
    }
    return { hombro, codo, mano };
  });

  // --- piernas (cadera, rodilla y zapato)
  const altoZapato = F.botas ? .11 : .085;
  const muslo = (alturaCadera - altoZapato) * .52, pierna = (alturaCadera - altoZapato) * .48;
  const rPierna = Math.min(.125, Math.max(.088, anchoCintura * .53));
  const piernas = [-1, 1].map((s) => {
    const cadera = new THREE.Group(); cadera.position.set(s * Math.max(rPierna * 1.02, anchoCintura - rPierna * 1.05), alturaCadera, 0); cuerpo.add(cadera);
    tubo(rPierna, rPierna * .88, muslo, pantalon, cadera);
    const rodilla = new THREE.Group(); rodilla.position.y = -muslo; cadera.add(rodilla);
    bola(rPierna * .86, pantalon, rodilla, 0, 0, 0);
    tubo(rPierna * .86, rPierna * .8, pierna, pantalon, rodilla);
    // zapato: punta adelante (-z), suela plana
    const z = new THREE.Group(); z.position.y = -pierna; rodilla.add(z);
    if (F.botas) tubo(rPierna * .9, rPierna * .95, .09, zapato, z, 0, .03);
    caja(rPierna * 2.05, altoZapato * .85, .25, zapato, z, 0, -altoZapato * .52, -.05);
    bola(rPierna * 1.05, zapato, z, 0, -altoZapato * .45, -.155, 1, .62, .85, 6, 4);
    caja(rPierna * 2.1, .018, .27, mat(new THREE.Color(F.zapatos).multiplyScalar(.55)), z, 0, -altoZapato + .006, -.055);
    return { cadera, rodilla };
  });

  let capa = null;
  if (L.capa) {
    capa = new THREE.Group(); capa.position.set(0, menton - alturaCadera - .03, anchoHombro * .55); torso.add(capa);
    const geo = new THREE.PlaneGeometry(anchoHombro * 2.4, .95, 6, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, .03 * Math.cos(x * 24) + (.47 - y) * .12); pos.setX(i, x * (1 - y * .3)); }
    geo.computeVertexNormals(); pieza(geo, mat(L.capa, { side: THREE.DoubleSide }), 0, -.47, 0, capa);
  }
  let aura = null;
  if (L.dorado) {
    aura = new THREE.Group(); grupo.add(aura);
    for (let i = 0; i < 12; i++) {
      const o = pieza(new THREE.OctahedronGeometry(.035), mat('#ffda5b', { emissive: '#c38b20', emissiveIntensity: .7 }), 0, 0, 0, aura);
      o.userData.a = (i * Math.PI) / 6;
    }
  }
  // sombra
  const sombra = pieza(new THREE.CircleGeometry(.4, 24), new THREE.MeshBasicMaterial({ color: '#17191e', transparent: true, opacity: .17, depthWrite: false }), 0, .008, 0, grupo);
  sombra.rotation.x = -Math.PI / 2; sombra.castShadow = false;

  // piezas de la cara que el rig espera (en estos personajes la cara es la textura)
  const nada = () => { const o = new THREE.Group(); o.visible = false; cabeza.add(o); return o; };
  const boca = nada(), sonrisa = nada(), lengua = nada(), dientes = nada(), arruga = nada();
  const cachetes = [nada(), nada()], cejas = [nada(), nada()], ojos = [nada(), nada()];
  const seg = (n) => n;
  return armarApi(THREE, { grupo, cuerpo, torso, cabeza, brazos, piernas, boca, sonrisa, lengua, dientes, arruga, cachetes, cejas, ojos, capa, aura, seg, alturaCadera, abrirBrazos: .17, trav: travieso(L), poseQuieto: F.pose || null, alListo: Promise.all(cargas) }, opciones);
}

function compactar(THREE, raiz) {
  // Sólo se fusionan hijos directos. Las articulaciones, ojos, cejas y labios siguen animables.
  const grupos = []; raiz.traverse(o => { if (o.isGroup) grupos.push(o); });
  for (const grupo of grupos) {
    const porMaterial = new Map();
    for (const m of grupo.children) {
      if (!m.isMesh || m.geometry.type === 'CapsuleGeometry' && grupo === raiz) continue;
      // Las cejas se animan individualmente.
      if (m.geometry.type === 'CapsuleGeometry' && m.position.y > .08 && m.position.z < -.24) continue;
      if (!porMaterial.has(m.material)) porMaterial.set(m.material, []);
      porMaterial.get(m.material).push(m);
    }
    for (const [material, partes] of porMaterial) {
      if (partes.length < 2) continue;
      const posiciones = [], normales = [], uvs = [];
      for (const p of partes) {
        p.updateMatrix(); const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone(); g.applyMatrix4(p.matrix);
        posiciones.push(...g.attributes.position.array); normales.push(...g.attributes.normal.array);
        if (g.attributes.uv) uvs.push(...g.attributes.uv.array); else uvs.push(...Array(g.attributes.position.count * 2).fill(0));
        g.dispose(); p.geometry.dispose(); grupo.remove(p);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      const m = new THREE.Mesh(g, material); m.castShadow = partes[0].castShadow; m.receiveShadow = partes[0].receiveShadow; grupo.add(m);
    }
  }
}

function liberarSprite(s) { s.material.map?.dispose(); s.material.dispose(); }
function sprite(THREE, texto, color, fondo, alto, conPico = false) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = '700 30px Barlow, Arial, sans-serif';
  const lineas = []; let l = '';
  for (const p of String(texto).split(' ')) { if ((l + ' ' + p).trim().length > 26 && l) { lineas.push(l); l = p; } else l = (l + ' ' + p).trim(); }
  if (l) lineas.push(l);
  const w = Math.min(560, Math.max(0, ...lineas.map(x => g.measureText(x).width)) + 40), h = lineas.length * 36 + 24 + (conPico ? 16 : 0);
  cv.width = 600; cv.height = h; g.font = '700 30px Barlow, Arial, sans-serif';
  g.fillStyle = fondo; g.beginPath(); g.roundRect((600 - w) / 2, 4, w, h - 8 - (conPico ? 16 : 0), 18); g.fill();
  if (conPico) { g.beginPath(); g.moveTo(290, h - 24); g.lineTo(300, h - 4); g.lineTo(312, h - 24); g.fill(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  lineas.forEach((x, i) => g.fillText(x, 300, 36 + i * 36, 540));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  const altoMundo = alto * h / 60; s.scale.set(altoMundo * 600 / h, altoMundo, 1); s.renderOrder = 10; return s;
}
