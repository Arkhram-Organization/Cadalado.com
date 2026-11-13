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

// Biblioteca común: las animaciones de cada modelo de Meshy sirven para todos (mismo esqueleto Mixamo).
const BIBLIOTECA = ['anim-julo', 'anim-angeles', 'anim-glinsky', 'anim-faur', 'anim-volcho', 'anim-mati', 'anim-olcho', 'anim-dobro', 'anim-sandra', 'anim-franba', 'anim-elidiprimio', 'anim-marti', 'anim-teo', 'anim-maica', 'anim-ferchus', 'anim-dorin'];
let biblioteca = null;
function cargarBiblioteca() {
  biblioteca ??= Promise.all(BIBLIOTECA.map((n) => cargar(new URL(`./modelos/${n}.glb`, import.meta.url).href).catch(() => ({ animations: [] }))))
    .then((gs) => { const m = new Map(); for (const g of gs) for (const a of g.animations) if (!m.has(a.name)) m.set(a.name, a); return m; });
  return biblioteca;
}

// Qué animación usa cada estado de los juegos (con alternativas por si falta alguna).
// Cada personaje puede elegir las suyas con look.clips = { estado: 'Nombre' }.
const CLIPS = {
  quieto: ['Short_Breathe_and_Look_Around', 'Long_Breathe_and_Look_Around', 'Idle'],
  habla: ['Talk_with_Hands_Open', 'Talk_with_Left_Hand_Raised', 'Stand_Talking_Angry', 'Talk_Passionately'],
  saluda: ['Waving', 'Wave', 'Talk_with_Left_Hand_Raised', 'Talk_with_Hands_Open'],
  voltereta: ['Run_and_Jump', 'Run_and_Leap', 'Hop_with_Arms_Raised'],
  camina: ['Walking'],
  corre: ['RunFast', 'Running'], // la corrida de Julo
  corre2: ['run_fast_2', 'Run_03', 'Run_02', 'run_fast_5'],
  trota: ['Running'],
  atras: ['Walk_Backward', 'Walk_Backward_inplace'],
  salto: ['Jump_Over_Obstacle_2', 'Jump_Over_Obstacle', 'Run_and_Jump', 'Run_and_Leap'],
  festeja: ['Hop_with_Arms_Raised', 'All_Night_Dance', 'Clapping_Run', 'Cheer_with_Both_Hands'],
  baila: ['Hip_Hop_Dance_4', 'Hip_Hop_Dance_1', 'Breakdance_1990', 'All_Night_Dance', 'Cardio_Dance', 'FunnyDancing_02', 'ymca_dance', 'Shake_It_Off_Dance', 'Denim_Pop_Dance', 'Step_Hip_Hop_Dance', 'FunnyDancing_03', 'Boom_Dance', 'Hip_Hop_Dance_3', 'Ferchus_Breakdance'],
  tiktok: ['Hip_Hop_Dance_3', 'Hip_Hop_Dance_4', 'Boom_Dance'], // baila y se graba con el celular en la mano (pose de selfie, abajo)
  musculos: ['Show_Both_Arm_Muscles'],
  pavoneo: ['Proud_Strut'],
  flexiones: ['push_up', 'situps'],
  abdominales: ['situps'],
  vertical: ['One_Arm_Handstand'],
  parkour: ['Parkour_Vault_with_Roll', 'Run_Jump_and_Roll', 'Unarmed_Vault', 'Parkour_Vault_2', 'Handstand_Flip', 'Jump_Down_from_Wall'],
  mortal: ['Backflip_and_Hooks', 'Handstand_Flip', 'Run_Jump_and_Roll'],
  muerto: ['Shot_and_Blown_Back', 'dying_backwards', 'Shot_and_Fall_Backward', 'Shot_and_Fall_Forward'],
  golpe: ['Shot_and_Blown_Back'],
  pina: ['Punch_Combo', 'Punch_Combo_1', 'Left_Hook_from_Guard', 'Jumping_Punch', 'Punch_Combo_5', 'Right_Hand_Sword_Slash', 'Elbow_Strike', 'Counterstrike', 'Punch_Combo_4'],
  patada: ['Boxing_Guard_Right_Straight_Kick', 'Large_step_then_high_kick', 'Rising_Flying_Kick', 'Spartan_Kick', 'Step_Step_Turn_Kick', 'Sweeping_Kick', 'Step_in_High_Kick', 'Sweep_Kick', 'Roundhouse_Kick'],
  duerme: ['Wake_Up_and_Look_Up'], // su primer cuadro es acostado: dormido se queda ahí
  despierta: ['Wake_Up_and_Look_Up'],
  dispara: ['Run_and_Shoot', 'Rifle_Charge_inplace'],
  apunta: ['Run_and_Shoot', 'Rifle_Charge_inplace'],
  recarga: ['Standing_Reload', 'Kneeling_Reload', 'Running_Reload', 'Running_Reload_inplace'],
  granada: ['Crouch_Pull_and_Throw'],
  armaCamina: ['Rifle_Charge_inplace', 'Walking'],
  armaAtras: ['Walk_Backward_with_Gun_inplace', 'Walk_Backward_While_Shooting', 'Walk_Backward'],
  armaLado: ['Walk_Left_with_Gun_inplace'],
  agachadoLado: ['Crouch_Walk_Left_with_Gun_inplace'],
  salto2: ['Vault_with_Rifle', 'Unarmed_Vault'],
};
// En estos estados se elige al azar entre todas las animaciones que haya (cada baile es distinto).
const VARIADOS = new Set(['baila', 'pina', 'patada', 'habla', 'muerto', 'parkour', 'salto']);
export const SENTADO = { muslo: -Math.PI / 2, rodilla: Math.PI / 2 };
const UNA_VEZ = new Set(['muerto', 'golpe', 'pina', 'patada', 'granada', 'recarga', 'salto', 'voltereta', 'parkour', 'mortal', 'despierta']);
const QUEDA = new Set(['muerto']); // se queda en el último cuadro
const alias = { idle: 'quieto', caminar: 'camina', correr: 'corre', morir: 'muerto', muerte: 'muerto', celebrar: 'festeja', disparar: 'dispara', recargar: 'recarga', curar: 'recarga', cura: 'recarga', cae: 'golpe', buceo: 'parkour' };

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
  const celular = new THREE.Group();
  {
    const cuerpoCel = new THREE.Mesh(new THREE.BoxGeometry(.11, .21, .016), new THREE.MeshStandardMaterial({ color: '#16161a', roughness: .35, metalness: .4 }));
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(.096, .19), new THREE.MeshBasicMaterial({ color: '#ff3b8b' }));
    pantalla.position.z = .0085;
    const luz = new THREE.Mesh(new THREE.CircleGeometry(.007, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    luz.position.set(.034, .085, -.0085); luz.rotation.y = Math.PI;
    cuerpoCel.add(pantalla, luz);
    celular.add(cuerpoCel); celular.visible = false; celular.userData.pantalla = pantalla;
  }
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(.4, 24), new THREE.MeshBasicMaterial({ color: '#17191e', transparent: true, opacity: .17, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = .008; grupo.add(sombra);
  // brillo dorado (Mati, el easter egg)
  let aura = null;
  if (look.dorado) {
    aura = new THREE.Group(); grupo.add(aura);
    const m = new THREE.MeshStandardMaterial({ color: '#ffda5b', emissive: '#c38b20', emissiveIntensity: .7 });
    for (let i = 0; i < 12; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(.035), m); o.userData.a = (i * Math.PI) / 6; aura.add(o); }
  }
  const cartel = nombre ? sprite(THREE, nombre, colorNombre, 'rgba(20,20,19,.76)', tamCartel) : null;
  if (cartel) { cartel.position.y = 2.13; grupo.add(cartel); }

  let mixer = null, acciones = {}, actual = null, estadoActual = '', huesos = {}, alturaCadera = .95;
  const subclips = new Map();
  let todas = new Map(); // todas las animaciones (propias y de la biblioteca), por nombre
  let globo = null, globoHasta = 0, hablaHasta = 0, reloj = 0, transcurrido = 0, zzz = false;
  const trav = travieso(look);
  const listo = Promise.all([cargar(url), cargarBiblioteca()]).then(([g, lib]) => {
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
    todas = new Map(lib); for (const a of g.animations) todas.set(a.name, a); // las propias primero
    for (const [estado, lista] of Object.entries(CLIPS)) {
      // la animación propia del personaje (look.clips) va primero; en los variados entran todas
      // (puede ser una lista: el personaje alterna entre sus propias animaciones, como los bailes de Ferchus)
      const propia = look.clips?.[estado];
      const propias = Array.isArray(propia) ? propia.filter((n) => todas.has(n)) : propia ? [propia] : [];
      const nombres = propias.length ? [...propias, ...lista.filter((n) => !propias.includes(n))] : lista;
      const clips = nombres.map((n) => todas.get(n)).filter(Boolean);
      if (!clips.length) continue;
      const usar = propias.length > 1 ? clips.slice(0, propias.length) : VARIADOS.has(estado) && !propias.length ? clips : [clips[0]];
      acciones[estado] = usar.map((clip) => {
        const a = mixer.clipAction(clip);
        if (UNA_VEZ.has(estado)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
        return a;
      });
    }
    // enganches pegados a los huesos reales
    m.updateMatrixWorld(true);
    // los enganches compensan la escala real del hueso (la del modelo y la del esqueleto)
    const escalaDe = (h) => 1 / h.getWorldScale(new THREE.Vector3()).x;
    if (huesos.Head) { cabeza.position.set(0, 0, 0); huesos.Head.add(cabeza); cabeza.scale.setScalar(escalaDe(huesos.Head)); }
    // kipá (Faur): sobre la coronilla, un poco hacia atrás, pegada al hueso de arriba de la cabeza
    const tope = huesos.HeadTop_End || huesos.Head;
    if (look.kipa && tope) {
      const kp = new THREE.Group(); tope.add(kp); kp.scale.setScalar(escalaDe(tope));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.15, 20, 6, 0, Math.PI * 2, 0, Math.PI * .28), new THREE.MeshStandardMaterial({ color: look.kipa, roughness: .8 }));
      cap.position.set(0, -.1, -.05); cap.rotation.x = -.4; kp.add(cap);
    }
    // en los huesos de Mixamo la mano apunta hacia los dedos (+Y): el enganche se gira para que -Z siga los dedos
    if (huesos.LeftHand) { manoI.position.set(0, 0, 0); manoI.rotation.set(Math.PI / 2, 0, 0); huesos.LeftHand.add(manoI); manoI.scale.setScalar(escalaDe(huesos.LeftHand)); }
    if (huesos.RightHand) { manoD.position.set(0, 0, 0); manoD.rotation.set(Math.PI / 2, 0, 0); huesos.RightHand.add(manoD); manoD.scale.setScalar(escalaDe(huesos.RightHand)); }

    if (huesos.Hips) alturaCadera = huesos.Hips.getWorldPosition(new THREE.Vector3()).y - grupo.position.y;
    poner(estadoActual || 'quieto', 0);
    mixer.update(0);
  });

  // Apunta un hueso hacia una dirección del mundo: mide hacia dónde va (del hueso a su hijo) y lo gira lo justo.
  // (no se asume ningún eje: los esqueletos de Meshy no tienen los huesos alineados igual que Mixamo)
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), ARRIBA = new THREE.Vector3(0, 1, 0);
  function apuntar(hueso, hijo, dir) {
    hueso.updateWorldMatrix(true, true);
    hueso.getWorldPosition(_v2); hijo.getWorldPosition(_v1);
    _v1.sub(_v2).normalize();
    hueso.getWorldQuaternion(_q1);
    _q2.setFromUnitVectors(_v1, dir).multiply(_q1); // rotación nueva en el mundo
    hueso.parent.getWorldQuaternion(_q1).invert();
    hueso.quaternion.copy(_q1.multiply(_q2));
    hueso.updateWorldMatrix(false, true);
  }
  const _der = new THREE.Vector3(), _ade = new THREE.Vector3(), _d = new THREE.Vector3(), _mano = new THREE.Vector3(), _cara = new THREE.Vector3();
  function selfie(t) {
    huesos.RightArm.getWorldPosition(_der); huesos.LeftArm.getWorldPosition(_v2);
    _der.sub(_v2); _der.y = 0; _der.normalize(); // hacia la derecha del personaje
    _ade.crossVectors(ARRIBA, _der).normalize(); // hacia adelante
    const vaiven = Math.sin(t * 2.2) * .12; // la mano se mueve un poco, como cuando grabás
    apuntar(huesos.RightArm, huesos.RightForeArm, _d.copy(_ade).multiplyScalar(.85).addScaledVector(_der, .3 + vaiven).addScaledVector(ARRIBA, .02).normalize());
    if (huesos.RightHand) apuntar(huesos.RightForeArm, huesos.RightHand, _d.copy(_ade).multiplyScalar(.9).addScaledVector(_der, -.12 + vaiven * .5).addScaledVector(ARRIBA, .42).normalize());
    const dedo = huesos.RightHandMiddle1 || huesos.RightHandIndex1;
    if (dedo) apuntar(huesos.RightHand, dedo, _d.copy(ARRIBA).multiplyScalar(.9).addScaledVector(_ade, .25).addScaledVector(_der, -.2).normalize());
    // el celular, en la mano y con la pantalla hacia la cara
    (huesos.RightHand || huesos.RightForeArm).getWorldPosition(_mano);
    _mano.addScaledVector(ARRIBA, .07 * grupo.scale.y);
    (huesos.Head || huesos.Neck).getWorldPosition(_cara);
    if (celular.parent !== grupo) grupo.add(celular);
    celular.position.copy(grupo.worldToLocal(_mano.clone()));
    celular.lookAt(_cara);
  }

  let estadoClip = '';
  function poner(estado, fundido = .22) {
    if (estado === 'clip') return; // suena una animación puntual (api.clip): no se pisa
    const lista = acciones[estado] || acciones.quieto;
    if (!lista) return;
    // al entrar a un estado se elige una variante; mientras dure se mantiene
    if (estado === estadoClip && actual && lista.includes(actual)) return;
    estadoClip = estado;
    const a = lista[opciones.animacionesSincronizadas ? 0 : Math.floor(Math.random() * lista.length)];
    a.timeScale = 1;
    if (estado === 'duerme') { a.time = 0; a.timeScale = 0; } // acostado, quieto (respira con el cuerpo)
    if (a === actual) return;
    a.reset().play();
    if (actual) actual.crossFadeTo(a, fundido, false);
    actual = a;
  }

  const api = {
    grupo, cabeza, altura: 2, listo,
    manos: { izquierda: manoI, derecha: manoD },
    expresar() {},
    // Una animación puntual por nombre (la primera de la lista que exista), estirada para durar `dur` segundos.
    // desde/hasta: qué parte del clip (0 a 1). congelar: queda quieta en `desde` (poses como agacharse).
    // Mientras suena, animar('clip', dt) solo avanza el tiempo. Devuelve false si el modelo no la tiene.
    clip(nombres, { dur = 0, desde = 0, hasta = 1, vez = true, fundido = .1, congelar = false, ida = false } = {}) {
      if (!mixer) return false;
      let c = (Array.isArray(nombres) ? nombres : [nombres]).map((n) => todas.get(n)).find(Boolean);
      if (!c) return false;
      // en bucle sobre un pedazo del clip (ida y vuelta, como respirar en guardia): se arma un sub-clip
      if (!vez && !congelar && (desde > 0 || hasta < 1)) {
        const clave = `${c.name}|${desde}|${hasta}`;
        if (!subclips.has(clave)) subclips.set(clave, THREE.AnimationUtils.subclip(c, clave, Math.floor(desde * c.duration * 30), Math.max(Math.floor(desde * c.duration * 30) + 2, Math.ceil(hasta * c.duration * 30)), 30));
        c = subclips.get(clave); desde = 0; hasta = 1;
      }
      const a = mixer.clipAction(c);
      a.reset();
      a.setLoop(vez ? THREE.LoopOnce : ida ? THREE.LoopPingPong : THREE.LoopRepeat, Infinity); a.clampWhenFinished = vez;
      a.time = desde * c.duration;
      a.timeScale = congelar ? 0 : dur ? ((hasta - desde) * c.duration) / dur : 1;
      a.play();
      if (actual && actual !== a) actual.crossFadeTo(a, fundido, false);
      actual = a; estadoClip = 'clip';
      return true;
    },
    tieneClip: (n) => todas.has(n),
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
      // dormir: acostado quieto (con Zzz) y al final se despierta
      if (estado === 'duerme') {
        if (transcurrido > 6.4 && acciones.despierta) clip = 'despierta';
        if (!zzz) { zzz = true; api.decir('Zzz… zzz…', 6.2); }
      } else zzz = false;
      if (estado !== estadoActual) {
        transcurrido = 0; estadoActual = estado;
        // algunos dicen algo cuando arrancan a bailar (Elidiprimio: "dale MXD")
        if (estado === 'baila' && look.alBailar?.length) api.decir(look.alBailar[Math.floor(Math.random() * look.alBailar.length)], 3);
        // y frases propias al arrancar otros gestos (look.alGesto = { tiktok: [...] })
        const dice = look.alGesto?.[estado];
        if (dice?.length && Math.random() < .8) api.decir(dice[Math.floor(Math.random() * dice.length)], 3);
        celular.visible = estado === 'tiktok';
      } else transcurrido += dt;
      if (mixer) {
        if (clip) { poner(clip); mixer.update(dt); }
        else { mixer.stopAllAction(); actual = null; }
        // TikTok: sobre el baile, el brazo derecho estirado adelante y arriba (selfie) con el celular mirando a la cara
        if (estado === 'tiktok' && huesos.RightArm && huesos.RightForeArm && huesos.LeftArm) selfie(reloj);
        // sentado: piernas dobladas a 90° sobre la animación de parado
        if (sentado && huesos.LeftUpLeg) {
          for (const l of ['Left', 'Right']) {
            huesos[l + 'UpLeg'].quaternion.multiply(qMuslo);
            huesos[l + 'Leg'].quaternion.multiply(qRodilla);
          }
        }
      }
      cuerpo.position.y = sentado ? .55 - alturaCadera : estado === 'duerme' ? Math.sin(reloj * 2) * .01 : 0;
      cuerpo.position.z = 0;
      if (tirado && !acciones.muerto?.length) { cuerpo.rotation.x = Math.PI / 2; cuerpo.position.y = .17; } else cuerpo.rotation.x = 0;
      if (estado === 'voltereta' && !/Roll|Flip/i.test(actual?.getClip().name || '')) voltereta(cuerpo, transcurrido / 1.05, .9, .75); // vuelta carnero encima del salto
      if (aura) aura.children.forEach((c, i) => { const a = c.userData.a + reloj; c.position.set(Math.cos(a) * .48, .3 + (i % 4) * .4 + Math.sin(reloj * 2 + i) * .09, Math.sin(a) * .48); c.rotation.y += dt; });
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
