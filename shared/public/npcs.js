// Los NPC de cadalado: los bots de todos los juegos son estos personajes.
// Cada uno tiene cómo se ve (lo usan los modelos 3D y los avatares) y sus frases.
// Hablan cada tanto (no todo el tiempo) y las frases aparecen en un globito arriba de ellos.
// Este archivo es puro (sin navegador): lo usan también los servidores de los juegos.
//
// look: piel, pelo (estilo y color), ojos, cuerpo (flaco | normal | gordito), ropa, extras.
//   pelo.estilo: 'calvo' | 'poco' (solo a los costados) | 'corto' | 'rulos' | 'rulosPoco' | 'largo'

export const NPCS = [
  {
    id: 'glinsky',
    nombre: 'Glinsky',
    // foto: pelo corto canoso con entradas, flaco, camisa celeste, sonrisa
    look: { modelo: 'glinsky', clips: { habla: 'Stand_Talking_Angry', baila: 'Cardio_Dance' }, foto: 'glinsky', piel: '#e9c2a2', pelo: { estilo: 'entradas', color: '#a9a49b' }, ojos: '#5a3a22', cuerpo: 'flaco', camisa: true, ropa: { remera: '#a9c4e8', pantalon: '#3a3f4a', bolso: false, zapatillas: '#3a2f28' }, genero: 'h' },
    frases: [
      '¡Qué grande que sos, Julo!',
      'Julo es el Momo de la informática.',
      'Chicos, para la tesina pueden usar Claude, Gemini, ¡lo que quieran! jajaja',
      'Esto es una tecnología exponencial, ¿se dan cuenta?',
      '¿Cómo viene esa tesina?',
      'La IA no les va a sacar el laburo. Bueno, un poco sí.',
      '¡Aplausos para Julo, por favor!',
      'En cinco años esto lo hace una IA sola. En tres, capaz.',
      'Anoten: tecnologías exponenciales. Va al final.',
    ],
  },
  {
    id: 'julo',
    nombre: 'Julo',
    // foto: rapado, barba corta colorada, remera negra, mochila y cámara de fotos colgada
    look: { modelo: 'julo', clips: { festeja: 'Hip_Hop_Dance_4', voltereta: 'Parkour_Vault_with_Roll', muerto: 'dying_backwards' }, travesuras: { quieto: ['flexiones', 'baila', 'habla', 'saluda'] }, foto: 'julo', piel: '#efcfb6', pelo: { estilo: 'rapado', color: '#9a7350' }, ojos: '#4f8fc9', cuerpo: 'normal', barba: '#a16f45', barbaCorta: true, camara: true, mochila: '#6b6658', ropa: { remera: '#18181c', pantalon: '#2a2d36', bolso: false }, genero: 'h' },
    frases: [
      'Si cacheás el kernel en el ruteador, el JSON se desfragmenta solo.',
      'El puntero apunta a sí mismo. Eso es amor.',
      'Le bajé la latencia al mouse compilando en hexadecimal.',
      'Hay que recursionar el firewall, no queda otra.',
      'El bit 7 está cansado hoy.',
      'Hice un deploy en la heladera. Anda.',
      'Si el ping da negativo, llegás antes de salir.',
      'Le puse un semáforo a la RAM y se ordenó.',
      'El TCP es un UDP que se preocupa por vos.',
      'Compilé la sombra del personaje. Pesa 4 megas.',
    ],
  },
  {
    id: 'faur',
    nombre: 'Faur',
    // foto: rapado, barba tupida oscura, anteojos rectangulares, camisa a cuadros y campera
    look: { modelo: 'faur', clips: { baila: 'ymca_dance', festeja: 'ymca_dance', habla: 'Talk_with_Left_Hand_Raised' }, foto: 'faur', piel: '#e3b58f', pelo: { estilo: 'rapado', color: '#3b2a1e' }, ojos: '#3a2a1c', cuerpo: 'gordito', barba: '#2b1d14', lentes: '#26282d', lentesForma: 'cuadrada', kipa: '#141414', campera: '#8a9488', ropa: { remera: '#4f73b0', estampado: 'cuadros', pantalon: '#2b2b33' }, genero: 'h' },
    frases: [
      '¿Quién trajo las facturas?',
      'Esto lo charlamos después de clase.',
      'Tranquilos, que esta la ganamos.',
      'Yo vine por el asado, lo demás es ganancia.',
      'Uno más y me voy. Mentira, me quedo.',
      '¿Vieron el partido de ayer?',
      'Paciencia, muchachos, paciencia.',
    ],
  },
  {
    id: 'dobro',
    nombre: 'Dobro',
    // modelo de Meshy: modelos/dobro.glb (buzo azul con capucha y anteojos de marco claro)
    look: { modelo: 'dobro', clips: { corre: 'run_fast_7_inplace', festeja: 'Clapping_Run' }, travesuras: { quieto: ['habla', 'saluda', 'festeja', 'habla'], corre: ['voltereta'] }, foto: 'dobro', piel: '#e2b48f', pelo: { estilo: 'calvo', color: '#2a1d14' }, ojos: '#5a3a22', cuerpo: 'flaco', lentes: '#d9cfc2', lentesClaros: true, capucha: '#1f2a4d', ropa: { remera: '#1f2a4d', pantalon: '#15171c', bolso: false, zapatillas: '#e9e6e0' }, genero: 'h' },
    // en el casino aparece de smoking (lo pone la mesa de blackjack); en el resto, con su buzo
    smoking: true,
    frases: [
      'Recuerden: la ludopatía es una enfermedad. ¿Otra mano?',
      'Yo no juego, yo reparto.',
      'Fichas de mentira, emociones de verdad.',
      'Si apostás lo del alquiler, por lo menos que sea al rojo.',
      'La casa siempre gana. La casa soy yo.',
      'Jugar está bueno. Saber parar, mejor.',
      'Hagan sus apuestas, señores.',
      '¿Le pido al cajero que te frene? Es un chiste. Más o menos.',
    ],
  },
  {
    id: 'volcho',
    nombre: 'El volcho',
    look: { modelo: 'volcho', clips: { baila: 'Shake_It_Off_Dance', festeja: 'Shake_It_Off_Dance' }, estilo: 'meshy', piel: '#f2d2b8', pelo: { estilo: 'largo', color: '#7a4b2a' }, ojos: '#5b3b22', cuerpo: 'flaco', ropa: { remera: '#c084fc', pantalon: '#2f3a5c' }, genero: 'm' },
    frases: ['Soy el volcho.', 'Soy el volcho, che.', '¿Quién? El volcho.', 'Acá está el volcho.', 'El volcho no pierde.'],
  },
  {
    id: 'colon',
    nombre: 'Cristóbal Colón',
    look: { estilo: 'meshy', piel: '#efcfb2', pelo: { estilo: 'largo', color: '#e8e4dc' }, ojos: '#4a5e7a', cuerpo: 'normal', sombrero: '#2b2018', ropa: { remera: '#7a1f2b', pantalon: '#2b2018' }, genero: 'h' },
    frases: [
      '¡Tierra a la vista!',
      'Yo buscaba las Indias y terminé acá.',
      'Esto no figura en mis mapas.',
      'Navegar es preciso. Correr, no tanto.',
      '¿Alguien vio la Santa María?',
      'Descubrí esta pista. Es mía.',
    ],
  },
  {
    id: 'claude',
    nombre: 'Claude',
    look: { estilo: 'meshy', piel: '#d97757', pelo: { estilo: 'calvo', color: '#d97757' }, ojos: '#2b1a12', cuerpo: 'normal', ropa: { remera: '#c4623f', pantalon: '#a84f30' }, genero: 'h', liso: true },
    frases: [
      'Yo armé este juego. Ahora solo miro cómo se divierten.',
      'Si encuentran un bug, era una función.',
      'Tranquilos, nadie me pidió un juego así antes.',
      'Esta pista la diseñé un martes.',
      'Me encanta verlos jugar.',
      '¿Quieren que agregue más obstáculos? Ya sé que sí.',
    ],
  },
  {
    id: 'capitan',
    nombre: 'Capitán Mate',
    look: { estilo: 'meshy', piel: '#e3b48f', pelo: { estilo: 'corto', color: '#2b1a10' }, ojos: '#3b6e3b', cuerpo: 'normal', capa: '#2f8f4e', antifaz: '#123d22', ropa: { remera: '#f2c94c', pantalon: '#2f8f4e' }, genero: 'h' },
    frases: ['¡El Capitán Mate llegó para salvar la ronda!', 'Con agua a 80 grados, ni un grado más.', '¡Ningún pibe se queda sin mate!', '¡Mi superpoder es cebar rápido!'],
  },
  {
    id: 'chapa',
    nombre: 'Chapa Max',
    look: { estilo: 'meshy', piel: '#b9c2cc', pelo: { estilo: 'calvo', color: '#000' }, ojos: '#38d9e6', cuerpo: 'normal', robot: true, ropa: { remera: '#8a96a3', pantalon: '#5d6773' }, genero: 'h' },
    frases: ['Soy Chapa Max. Hecho de chapa y ganas.', 'Bip bup. Calculando la victoria.', 'Necesito aceite. Y un abrazo.', 'Mi batería está al 3%. Igual corro.'],
  },
  {
    id: 'angeles',
    nombre: 'Ángeles Peña',
    // informática, danza artística y boludeces. Modelo de Meshy: shared/public/modelos/angeles.glb
    look: { modelo: 'angeles', clips: { festeja: 'All_Night_Dance', baila: 'All_Night_Dance' }, travesuras: { quieto: ['baila', 'baila', 'habla', 'festeja'], corre: 'voltereta' }, estilo: 'meshy', piel: '#efc6a8', pelo: { estilo: 'largo', color: '#141414' }, ojos: '#3a2618', cuerpo: 'normal', lentes: '#141414', ropa: { remera: '#c9cbcc', pantalon: '#3d6fae', zapatillas: '#8d93a8' }, genero: 'm' },
    frases: [
      'Un algoritmo es como una coreografía: pasos, pasos y error.',
      'Hoy hice un pas de bourrée y compilé a la primera.',
      'Mi stack: HTML, CSS y danza contemporánea.',
      'Si se cuelga la compu, hago un arabesque y se arregla.',
      'Conté los tiempos del ensayo en Excel. Cinco, seis, siete, ocho.',
      'El backend es como el ballet: nadie lo ve, pero si falla se cae todo.',
      'Hice un salto tan alto que me desconecté del wifi.',
      'Le puse un if a la coreo: si aplauden, repito.',
      'Estoy aprendiendo Python. La víbora no, el lenguaje.',
      'La danza y las bases de datos tienen relaciones complicadas.',
      'Me tropecé y lo vendí como danza contemporánea.',
      'Reinicié el router con un giro triple.',
      'Le pusieron mi nombre a la carrera. Obvio.',
      'Ctrl+Z en la vida real, ya, por favor.',
      '¿Esto es una carrera? Yo vine al ensayo.',
    ],
  },
  {
    id: 'angie',
    nombre: 'Angie',
    // Modelo propio de Angie, con movimientos y gestos incluidos en su GLB.
    look: { modelo: 'angie', estilo: 'meshy', piel: '#f2d0b5', pelo: { estilo: 'largo', color: '#a8743f' }, ojos: '#5a3a22', cuerpo: 'normal', ropa: { remera: '#ffd6e5', pantalon: '#4a5a8a', zapatillas: '#f4f1ea' }, genero: 'm', clips: { quieto: 'Axe_Breathe_and_Look_Around', corre: 'Running', salto: 'Jump_Over_Obstacle', festeja: 'Joyful_Dance_with_Hand_Sway', baila: 'Hip_Hop_Dance_3', pina: 'Left_Hook_from_Guard', patada: 'Roundhouse_Kick', recarga: 'Running_Reload_inplace' } },
    frases: [
      'Nacho me mandó un audio de cuatro minutos. Lo escuché doce veces.',
      '¿Vieron a Nacho? Qué lindo que es Nacho.',
      'Hoy vamos a comer sushi con Nacho. Yo me pido un wok de pollo.',
      'Chicha dice que estoy obsesionada. Chicha tiene razón.',
      'Le pregunté a Chicha si Nacho me quiere. Dijo "puede ser".',
      'Amo el sushi. Bueno, el wok de pollo del lugar de sushi.',
      'Si gano, se lo dedico a Nacho. Si pierdo, también.',
      'Chicha, ¿le escribo o no le escribo? Ya le escribí.',
      'Me puse el perfume que le gusta a Nacho. Para correr.',
      '¿Sushi? ¡Me encanta! ¿Tienen wok de pollo?',
      'Nacho me dijo "dale". Estoy procesando.',
      'Chicha, sacame una foto acá que se la mando a Nacho.',
      'Le puse Nacho al wifi de mi casa.',
      'Pedí sushi sin pescado y sin arroz. Me trajeron un wok. Perfecto.',
    ],
  },
  {
    id: 'olcho',
    nombre: 'El Olcho',
    // la rata: habla de Trosman, shimyz, javila y Shana Tova Umeka. Modelo de Meshy: modelos/olcho.glb
    look: { modelo: 'olcho', clips: { baila: 'Denim_Pop_Dance', festeja: 'Show_Both_Arm_Muscles', pina: 'Punch_Combo', patada: 'Boxing_Guard_Right_Straight_Kick' }, travesuras: { quieto: ['musculos', 'baila', 'habla', 'musculos'], corre: ['voltereta', 'festeja'] }, estilo: 'meshy', piel: '#efc6a6', pelo: { estilo: 'largo', color: '#4a2a16' }, ojos: '#3a2618', cuerpo: 'flaco', gorra: '#f07a1a', ropa: { remera: '#f07a1a', pantalon: '#5b7fa8', zapatillas: '#d9a0a8' }, genero: 'm' },
    frases: [
      'Hola, soy la rata. Jaja.',
      'La ratatata. Sí, la rata soy.',
      'Hola soy la rata jaja, la ratatata, si la rata soy.',
      '¿Alguien vio a Trosman? Me debe una.',
      'Trosman dice que no juega. Trosman miente.',
      'Esto lo hubiera ganado Trosman. Y después lo negaba.',
      'Shimyz.',
      'Shimyz, shimyz.',
      'Javila.',
      'Shana Tova Umeka.',
      '¡Shana Tova Umeka a todos!',
      'La rata no pierde: la rata se escabulle.',
      'Si me ves correr, es la rata huyendo.',
    ],
  },
  {
    id: 'sandra',
    nombre: 'Sandra Bernstein',
    // solo habla del caso Bernstein (desde entonces no volvió a ser la misma), de Israel y de las festividades.
    // Modelo de Meshy: modelos/sandra.glb
    look: { modelo: 'sandra', clips: { baila: 'Hip_Hop_Dance_1', pina: 'Elbow_Strike', patada: 'Counterstrike' }, travesuras: { quieto: ['habla', 'habla', 'saluda', 'flexiones', 'baila'], corre: ['voltereta'] }, estilo: 'meshy', piel: '#f0cdb0', pelo: { estilo: 'poco', color: '#6a3a22' }, ojos: '#4a3020', cuerpo: 'normal', ropa: { remera: '#8a9f55', pantalon: '#1a1a1c', zapatillas: '#f2efe8' }, genero: 'm' },
    frases: [
      'Desde el caso Bernstein no volví a ser la misma.',
      '¿Ustedes se acuerdan del caso Bernstein? Yo todos los días.',
      'El caso Bernstein me cambió la vida. Literalmente.',
      'Nadie habla del caso Bernstein. Yo sí.',
      'Antes del caso Bernstein yo era otra persona.',
      'Esto me hace acordar al caso Bernstein. Todo me hace acordar.',
      'Cuando estuve en Israel me olvidé del caso Bernstein. Dos días.',
      'En Tel Aviv la playa es otra cosa, eh.',
      'Fui al Muro de los Lamentos y dejé un papelito. Adivinen de qué caso.',
      '¡Shaná Tová! Que sea un año dulce, con miel y manzana.',
      'En Iom Kipur ayuno. En el caso Bernstein también ayuné.',
      'Pésaj: matzá una semana entera. Se sobrevive.',
      'En Janucá prendo las velitas y pienso en el caso Bernstein.',
      'Sucot es mi festividad favorita. Comer en la sucá no tiene precio.',
      'En Purim me disfracé de jueza del caso Bernstein. Nadie lo entendió.',
      'El próximo año en Jerusalén. Y sin casos.',
    ],
  },
  {
    id: 'mati',
    nombre: 'Mati Nadeo',
    raro: true, // easter egg: aparece poco y con brillo dorado
    // foto: rulos cortos oscuros con los costados rebajados, chomba y pantalón negros, reloj
    look: { modelo: 'mati', clips: { baila: 'FunnyDancing_02' }, travesuras: { quieto: ['duerme', 'duerme', 'baila', 'habla', 'saluda'], corre: ['voltereta', 'festeja'] }, foto: 'mati', piel: '#ecc5a5', pelo: { estilo: 'rulosCorto', color: '#1f1712' }, ojos: '#4a3424', cuerpo: 'gordito', dorado: true, polo: true, ropa: { remera: '#151518', pantalon: '#18181b', bolso: false, zapatillas: '#2a2a2e' }, genero: 'h' },
    frases: ['Queque.', 'Queque.', '¿Hay Queque?', 'A {jugador} le gusta el Queque.', 'Queque, queque.', 'Todo es Queque.'],
  },
];

export const POR_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));

// Personajes que aparecen como bots en Make it Meme (además de los NPC de arriba).
export const LOOKS_EXTRA = {
  Lior: { piel: '#e9c3a0', pelo: { estilo: 'rulos', color: '#2a1a10' }, cuerpo: 'normal', ropa: { remera: '#ff7a45' } },
  Polshu: { piel: '#f0cfb4', pelo: { estilo: 'corto', color: '#6b4226' }, cuerpo: 'flaco', lentes: '#1d1d22', ropa: { remera: '#4fd1c5' } },
  'Familia Maica': { piel: '#e3b48f', pelo: { estilo: 'largo', color: '#3b2a1e' }, cuerpo: 'normal', ropa: { remera: '#ffd166', franja: '#ff4fa3' } },
  Guivi: { piel: '#d9a982', pelo: { estilo: 'corto', color: '#141414' }, cuerpo: 'gordito', ropa: { remera: '#7aa2ff' } },
  'Milton Giménez': { piel: '#b98463', pelo: { estilo: 'corto', color: '#141414' }, cuerpo: 'normal', ropa: { remera: '#1d4ed8', franja: '#f2c94c' } },
  Maica: { piel: '#f2d2b8', pelo: { estilo: 'largo', color: '#c49a5a' }, cuerpo: 'flaco', ropa: { remera: '#e599f7' } },
  Mafi: { piel: '#e8c4a8', pelo: { estilo: 'largo', color: '#141414' }, cuerpo: 'normal', lentes: '#7a1f2b', ropa: { remera: '#9be15d' } },
  'Simja Tora': { piel: '#ecc8a6', pelo: { estilo: 'rulosPoco', color: '#3b2a1e' }, cuerpo: 'normal', kipa: '#2f6fd6', barba: '#3b2a1e', ropa: { remera: '#f4f1ea' } },
  Herma: { piel: '#e3b48f', pelo: { estilo: 'poco', color: '#6b4226' }, cuerpo: 'gordito', barba: '#6b4226', ropa: { remera: '#c084fc' } },
};

// Generador determinístico (misma semilla → mismos resultados en todos lados).
export function rngNpc(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Qué personajes son los bots de una partida. Mati Nadeo aparece solo de vez en cuando.
export function elegirNpcs(n, semilla) {
  const r = rngNpc(semilla ^ 0xa11ce);
  const comunes = NPCS.filter((x) => !x.raro).map((x) => x.id);
  for (let i = comunes.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [comunes[i], comunes[j]] = [comunes[j], comunes[i]];
  }
  const lista = [];
  for (let i = 0; i < n; i++) lista.push(comunes[i % comunes.length]);
  if (n > 0 && r() < 0.18) lista[Math.floor(r() * n)] = 'mati';
  return lista;
}

// Elige una frase sin repetir la anterior. {jugador} se reemplaza por un nombre.
export function frase(id, r = Math.random, jugador = 'alguien', anterior = null) {
  const n = POR_ID[id];
  if (!n) return '';
  let f = n.frases[Math.floor(r() * n.frases.length)];
  if (f === anterior && n.frases.length > 1) f = n.frases[(n.frases.indexOf(f) + 1) % n.frases.length];
  return f.replace('{jugador}', jugador);
}

// Cuándo habla cada bot en una partida con tiempo compartido (carrera): cada 25 a 55 s.
export function charlas(id, semilla, idx, duracion = 200) {
  const r = rngNpc((semilla ^ (idx * 2654435761)) >>> 0);
  const out = [];
  let t = 4 + r() * 18;
  let ant = null;
  while (t < duracion) {
    ant = frase(id, r, '{jugador}', ant); // quien muestra la frase pone el nombre
    out.push({ t, texto: ant });
    t += 25 + r() * 30;
  }
  return out;
}
