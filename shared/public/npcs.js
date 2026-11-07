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
    look: { piel: '#e8c4a8', pelo: { estilo: 'corto', color: '#eeeeea' }, ojos: '#4a2c18', cuerpo: 'flaco', ropa: { remera: '#3f5a7a', pantalon: '#2b2b33', franja: '#f4f1ea' }, genero: 'h' },
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
    look: { piel: '#f0cfb4', pelo: { estilo: 'calvo', color: '#000' }, ojos: '#2f6fd6', cuerpo: 'gordito', auriculares: '#1d1d22', ropa: { remera: '#2f6b4f', pantalon: '#33302c', franja: '#c5f04a' }, genero: 'h' },
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
    look: { piel: '#ecc8a6', pelo: { estilo: 'calvo', color: '#3b2a1e' }, ojos: '#4a3424', cuerpo: 'gordito', barba: '#3b2a1e', kipa: '#1d2c5e', ropa: { remera: '#f4f1ea', pantalon: '#2b2b33' }, genero: 'h' },
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
    look: { piel: '#e9c3a0', pelo: { estilo: 'calvo', color: '#1e1610' }, ojos: '#4a3322', cuerpo: 'normal', lentes: '#151515', ropa: { remera: '#1d2c5e', pantalon: '#1b1b22' }, genero: 'h' },
    // en el casino aparece de smoking (ver casino)
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
    look: { piel: '#f2d2b8', pelo: { estilo: 'largo', color: '#7a4b2a' }, ojos: '#5b3b22', cuerpo: 'flaco', ropa: { remera: '#c084fc', pantalon: '#2f3a5c' }, genero: 'm' },
    frases: ['Soy el volcho.', 'Soy el volcho, che.', '¿Quién? El volcho.', 'Acá está el volcho.', 'El volcho no pierde.'],
  },
  {
    id: 'colon',
    nombre: 'Cristóbal Colón',
    look: { piel: '#efcfb2', pelo: { estilo: 'largo', color: '#e8e4dc' }, ojos: '#4a5e7a', cuerpo: 'normal', sombrero: '#2b2018', ropa: { remera: '#7a1f2b', pantalon: '#2b2018' }, genero: 'h' },
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
    look: { piel: '#d97757', pelo: { estilo: 'calvo', color: '#d97757' }, ojos: '#2b1a12', cuerpo: 'normal', ropa: { remera: '#c4623f', pantalon: '#a84f30' }, genero: 'h', liso: true },
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
    look: { piel: '#e3b48f', pelo: { estilo: 'corto', color: '#2b1a10' }, ojos: '#3b6e3b', cuerpo: 'normal', capa: '#2f8f4e', antifaz: '#123d22', ropa: { remera: '#f2c94c', pantalon: '#2f8f4e' }, genero: 'h' },
    frases: ['¡El Capitán Mate llegó para salvar la ronda!', 'Con agua a 80 grados, ni un grado más.', '¡Ningún pibe se queda sin mate!', '¡Mi superpoder es cebar rápido!'],
  },
  {
    id: 'chapa',
    nombre: 'Chapa Max',
    look: { piel: '#b9c2cc', pelo: { estilo: 'calvo', color: '#000' }, ojos: '#38d9e6', cuerpo: 'normal', robot: true, ropa: { remera: '#8a96a3', pantalon: '#5d6773' }, genero: 'h' },
    frases: ['Soy Chapa Max. Hecho de chapa y ganas.', 'Bip bup. Calculando la victoria.', 'Necesito aceite. Y un abrazo.', 'Mi batería está al 3%. Igual corro.'],
  },
  {
    id: 'mati',
    nombre: 'Mati Nadeo',
    raro: true, // easter egg: aparece poco y con brillo dorado
    look: { piel: '#e6bd98', pelo: { estilo: 'rulosPoco', color: '#141414' }, ojos: '#3a2a1c', cuerpo: 'gordito', dorado: true, ropa: { remera: '#f2c94c', pantalon: '#3a2f1c' }, genero: 'h' },
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
