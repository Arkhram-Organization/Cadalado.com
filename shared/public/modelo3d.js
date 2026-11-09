// Personajes con modelo propio hecho en Meshy: GLB con esqueleto Mixamo y sus animaciones.
// Devuelve la misma interfaz que crearPersona (grupo, cabeza, manos, animar, decir, dispose, listo),
// así los juegos no notan la diferencia. Las animaciones usan nombres de huesos de Mixamo, así que
// las de un personaje sirven para cualquier otro modelo con el mismo esqueleto.
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as clonarEsqueleto } from './vendor/SkeletonUtils.js';
import { travieso, voltereta } from './gestos.js';

const ALTO = 1.85; // misma altura que el resto del elenco
const cache = new Map();
let qMuslo = null, qRodilla = null; // giros para sentarse (sobre la pose de los huesos)

// Qué animación usa cada estado de los juegos (con alternativas por si un modelo no la tiene).
const CLIPS = {
  quieto: ['Short_Breathe_and_Look_Around', 'Idle'],
  habla: ['Talk_with_Hands_Open'],
  saluda: ['Waving', 'Wave', 'Talk_with_Hands_Open'],
  voltereta: ['Run_and_Jump', 'Hop_with_Arms_Raised'],
  camina: ['Walking'],
  corre: ['Running'],
  atras: ['Walk_Backward'],
  salto: ['Run_and_Jump', 'Hop_with_Arms_Raised'],
  festeja: ['Hop_with_Arms_Raised', 'All_Night_Dance'],
  baila: ['All_Night_Dance', 'Hop_with_Arms_Raised'],
  muerto: ['Shot_and_Blown_Back'],
  golpe: ['Shot_and_Blown_Back'],
  pina: ['Right_Hand_Sword_Slash'],
  dispara: ['Run_and_Shoot', 'Rifle_Charge_inplace'],
  apunta: ['Run_and_Shoot', 'Rifle_Charge_inplace'],
  recarga: ['Standing_Reload', 'Kneeling_Reload'],
  granada: ['Crouch_Pull_and_Throw'],
  armaCamina: ['Rifle_Charge_inplace', 'Walking'],
  armaAtras: ['Walk_Backward_with_Gun_inplace', 'Walk_Backward'],
  armaLado: ['Walk_Left_with_Gun_inplace'],
  agachadoLado: ['Crouch_Walk_Left_with_Gun_inplace'],
};
export const SENTADO = { muslo: -Math.PI / 2, rodilla: Math.PI / 2 };
const UNA_VEZ = new Set(['muerto', 'golpe', 'pina', 'granada', 'recarga', 'salto', 'voltereta']);
const QUEDA = new Set(['muerto']); // se queda en el último cuadro
const alias = { idle: 'quieto', caminar: 'camina', correr: 'corre', morir: 'muerto', muerte: 'muerto', celebrar: 'festeja', disparar: 'dispara', recargar: 'recarga', curar: 'recarga', cura: 'recarga', cae: 'golpe', patada: 'pina', buceo: 'salto' };

function cargar(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((ok, mal) => new GLTFLoader().load(url, (g) => {
      // Animaciones "en el lugar": la cadera no se desplaza (el juego mueve al personaje).
      for (const clip of g.animations) for (const t of clip.tracks) {
        if (!/Hips\.position$/.test(t.name)) continue;
        const v = t.values, x0 = v[0], z0 = v[2];
        for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
      }
      ok(g);
    }, undefined, mal)));
  }
  return cache.get(url);
}

export function crearPersonaModelo(THREE, look, opciones = {}, { sprite, liberarSprite }) {
  const { nombre = '', colorNombre = '#ffffff', sombras = true, tamCartel = 0.65, tamGlobo = 0.5 } = opciones;
  qMuslo ??= new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SENTADO.muslo);
  qRodilla ??= new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SENTADO.rodilla);
  const url = new URL(`./modelos/${look.modelo}.glb`, import.meta.url).href;
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group(); cuerpo.rotation.y = Math.PI; // los modelos miran a +Z; el contrato es -Z
  grupo.add(cuerpo);
  // puntos de enganche que los juegos usan desde el principio (se pegan a los huesos al cargar)
  const cabeza = new THREE.Group(), manoI = new THREE.Group(), manoD = new THREE.Group();
  cabeza.position.y = 1.55; manoI.position.set(-.3, .9, 0); manoD.position.set(.3, .9, 0);
  grupo.add(cabeza, manoI, manoD);
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(.4, 24), new THREE.MeshBasicMaterial({ color: '#17191e', transparent: true, opacity: .17, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = .008; grupo.add(sombra);
  const cartel = nombre ? sprite(THREE, nombre, colorNombre, 'rgba(20,20,19,.76)', tamCartel) : null;
  if (cartel) { cartel.position.y = 2.13; grupo.add(cartel); }

  let mixer = null, acciones = {}, actual = null, estadoActual = '', huesos = {}, alturaCadera = .95;
  let globo = null, globoHasta = 0, hablaHasta = 0, reloj = 0, transcurrido = 0;
  const trav = travieso(look);
  const listo = cargar(url).then((g) => {
    const m = clonarEsqueleto(g.scene);
    const caja = new THREE.Box3().setFromObject(m);
    const k = ALTO / Math.max(.5, caja.max.y - caja.min.y);
    m.scale.setScalar(k);
    m.traverse((o) => {
      if (o.isMesh) { o.castShadow = sombras; o.frustumCulled = false; }
      if (o.isBone) huesos[o.name.replace(/^mixamorig:?/, '')] = o; // el cargador le saca los ':' al nombre
    });
    cuerpo.add(m);
    mixer = new THREE.AnimationMixer(m);
    for (const [estado, nombres] of Object.entries(CLIPS)) {
      const clip = nombres.map((n) => g.animations.find((a) => a.name === n)).find(Boolean);
      if (!clip) continue;
      const a = mixer.clipAction(clip);
      if (UNA_VEZ.has(estado)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      acciones[estado] = a;
    }
    // enganches pegados a los huesos reales
    m.updateMatrixWorld(true);
    if (huesos.Head) { cabeza.position.set(0, 0, 0); huesos.Head.add(cabeza); cabeza.scale.setScalar(1 / k); }
    // en los huesos de Mixamo la mano apunta hacia los dedos (+Y): el enganche se gira para que -Z siga los dedos
    if (huesos.LeftHand) { manoI.position.set(0, 0, 0); manoI.rotation.set(Math.PI / 2, 0, 0); huesos.LeftHand.add(manoI); manoI.scale.setScalar(1 / k); }
    if (huesos.RightHand) { manoD.position.set(0, 0, 0); manoD.rotation.set(Math.PI / 2, 0, 0); huesos.RightHand.add(manoD); manoD.scale.setScalar(1 / k); }
    if (huesos.Hips) alturaCadera = huesos.Hips.getWorldPosition(new THREE.Vector3()).y - grupo.position.y;
    poner(estadoActual || 'quieto', 0);
    mixer.update(0);
  });

  function poner(estado, fundido = .22) {
    const a = acciones[estado] || acciones.quieto;
    if (!a || a === actual) return;
    a.reset().play();
    if (actual) actual.crossFadeTo(a, fundido, false);
    actual = a;
  }

  const api = {
    grupo, cabeza, altura: 2, listo,
    manos: { izquierda: manoI, derecha: manoD },
    expresar() {},
    gesto(id) { trav.pedir(id); },
    decir(texto, seg = 4.5) {
      if (globo) { grupo.remove(globo); liberarSprite(globo); }
      globo = sprite(THREE, texto, '#141413', '#ffffff', tamGlobo, true);
      globo.position.y = 2.2 + tamCartel + globo.scale.y / 2; grupo.add(globo); globoHasta = reloj + seg;
      hablaHasta = reloj + Math.min(seg, 3.5);
    },
    animar(estado = 'quieto', dt = 0) {
      if (estado && typeof estado === 'object') {
        const e = estado;
        estado = e.muerto || e.vivo === false ? 'muerto' : e.caido ? 'tirado' : e.golpe ? 'golpe'
          : e.festeja ? 'festeja' : e.recargando ? 'recarga' : e.curando ? 'cura' : e.dispara ? 'dispara'
          : e.corre ? 'corre' : e.mueve || e.velocidad > .05 ? 'camina' : e.apunta ? 'apunta' : 'quieto';
      }
      estado = alias[estado] || estado;
      dt = Math.max(0, Math.min(dt, .1)); reloj += dt;
      estado = trav.filtrar(estado, dt, reloj); // gestos pedidos y travesuras
      const sentado = estado === 'sentado', tirado = estado === 'tirado';
      let clip = sentado ? 'quieto' : tirado ? 'muerto' : estado === 'apose' ? null : estado;
      if (clip === 'quieto' && reloj < hablaHasta && acciones.habla) clip = 'habla';
      if (estado !== estadoActual) { transcurrido = 0; estadoActual = estado; } else transcurrido += dt;
      if (mixer) {
        if (clip) { poner(clip); mixer.update(dt); }
        else { mixer.stopAllAction(); actual = null; }
        // sentado: piernas dobladas a 90° sobre la animación de parado
        if (sentado && huesos.LeftUpLeg) {
          for (const l of ['Left', 'Right']) {
            huesos[l + 'UpLeg'].quaternion.multiply(qMuslo);
            huesos[l + 'Leg'].quaternion.multiply(qRodilla);
          }
        }
      }
      cuerpo.position.y = sentado ? .43 - alturaCadera : 0;
      cuerpo.position.z = 0;
      if (tirado && !acciones.muerto) { cuerpo.rotation.x = Math.PI / 2; cuerpo.position.y = .17; } else cuerpo.rotation.x = 0;
      if (estado === 'voltereta') voltereta(cuerpo, transcurrido / 1.05, .9, .75); // vuelta carnero encima del salto
      if (globo && reloj > globoHasta) { grupo.remove(globo); liberarSprite(globo); globo = null; }
    },
    dispose() {
      // geometrías y materiales son del modelo compartido: solo se sacan los carteles y la sombra
      if (globo) liberarSprite(globo);
      if (cartel) liberarSprite(cartel);
      sombra.geometry.dispose(); sombra.material.dispose();
      mixer?.stopAllAction(); grupo.removeFromParent();
    },
  };
  return api;
}
