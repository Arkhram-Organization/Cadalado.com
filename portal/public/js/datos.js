// ─────────────────────────────────────────────────────────────
//  Catálogo de cadalado: juegos, ideas y novedades.
//  Para sumar algo, agregá un objeto a la lista que corresponda.
// ─────────────────────────────────────────────────────────────

// estado: 'disponible' | 'desarrollo'
// lobby: dirección de su lista de salas. formato: cómo leerla (ver LECTORES en inicio.js).
export const JUEGOS = [
  {
    id: 'royale',
    nombre: 'Último en pie',
    estado: 'disponible',
    nuevo: true,
    url: '/royale/',
    linea: 'Battle royale 3D con inventario y personajes animados: armas, botín, una zona que se achica y el último que queda gana.',
    datos: [['Jugadores', 'Hasta 24, con bots'], ['Modalidad', 'Online, tiempo real'], ['Partida', '3 a 6 min']],
    color: '#ff6b5b',
    captura: '/img/royale-nuevo.jpg',
    lobby: '/api/royale/lobby',
    formato: 'salas',
  },
  {
    id: 'carrera',
    nombre: 'Ángeles Peña',
    estado: 'disponible',
    nuevo: true,
    url: '/carrera/',
    linea: 'Carrera de obstáculos en 3D por rondas: barras, martillos, molinos, baldosas que se caen y piñas.',
    datos: [['Jugadores', 'Hasta 16 + bots'], ['Modalidad', 'Online, tiempo real'], ['Partida', '30 a 60 s']],
    color: '#4fd1c5',
    captura: '/img/carrera.webp',
    lobby: '/api/carrera/lobby',
    formato: 'salas',
  },
  {
    id: 'casino',
    nombre: 'El casino de Dobro',
    estado: 'disponible',
    nuevo: true,
    url: '/casino/',
    linea: 'Ruleta, blackjack y tragamonedas con fichas de mentira, en mesas compartidas.',
    datos: [['Jugadores', 'Todos en la misma mesa'], ['Juegos', 'Ruleta · Blackjack · Slots'], ['Fichas', '10.000 para arrancar']],
    color: '#f2c94c',
    captura: '/img/casino.webp',
    lobby: '/api/casino/lobby',
    formato: 'salas',
  },
  {
    id: 'memes',
    nombre: 'Make it Meme',
    estado: 'disponible',
    nuevo: true,
    url: '/memes/',
    linea: 'Te toca una plantilla, le ponés el texto y todos votan. El meme más gracioso gana.',
    datos: [['Jugadores', '2 a 12'], ['Plantillas', '100 populares'], ['Rondas', '2 a 5']],
    color: '#ff4fa3',
    captura: '/img/memes.webp',
    lobby: '/api/memes/lobby',
    formato: 'salas',
  },
  {
    id: 'truco',
    nombre: 'Truco',
    estado: 'disponible',
    url: '/truco/',
    linea: 'Mesa de bar en 3D, con señas, envido y bots si falta gente.',
    datos: [['Jugadores', '1 vs 1, 2 vs 2 o 3 vs 3'], ['Modalidad', 'Online, con bots'], ['Partida', 'A 15 o a 30']],
    color: '#ff7a45',
    captura: '/img/truco-nuevo.jpg',
    lobby: '/api/truco/lobby',
    formato: 'truco',
  },
  {
    id: 'ajedrez',
    nombre: 'Ajedrez',
    estado: 'disponible',
    url: '/ajedrez/',
    linea: 'Con reloj, revancha y gente mirando. El de siempre, en serio.',
    datos: [['Jugadores', '2'], ['Modalidad', 'Online o en la misma compu'], ['Ritmos', '1 a 30 min o sin reloj']],
    color: '#7aa2ff',
    captura: '/img/ajedrez.webp',
    lobby: '/ajedrez/api/lobby',
    formato: 'ajedrez',
  },
];

// Ideas que todavía no son juegos (se muestran como propuestas, no como algo que se puede jugar).
export const IDEAS = [
  { titulo: 'Dibujá y adiviná', texto: 'Uno dibuja, el resto adivina en el chat. Rondas cortas y palabras argentas.', etiqueta: 'Idea' },
  { titulo: 'Generala', texto: 'Cinco dados, cubilete y anotador, como en la mesa de la casa.', etiqueta: 'Idea' },
  { titulo: 'Preguntados criollo', texto: 'Trivia por categorías en tiempo real: el que contesta primero y bien, suma.', etiqueta: 'Idea' },
];


export const NOVEDADES = [
  { etiqueta: 'Nuevo', titulo: 'Último en pie', texto: 'Battle royale 3D con inventario y personajes animados con los personajes de cadalado.', juego: 'royale' },
  { etiqueta: 'Nuevo', titulo: 'Ángeles Peña', texto: 'Obstáculos en 3D, en tiempo real y con bots para llenar la largada.', juego: 'carrera' },
  { etiqueta: 'Nuevo', titulo: 'El casino de Dobro', texto: 'Ruleta, blackjack y tragamonedas con pozo compartido. Fichas de mentira.', juego: 'casino' },
  { etiqueta: 'Nuevo', titulo: 'Make it Meme', texto: '100 plantillas, textos donde quieras y votación anónima.', juego: 'memes' },
  { etiqueta: 'Club', titulo: 'Tu cuenta', texto: 'Historial de todos los juegos, amigos y chat. Desafiá desde el perfil.', enlace: '/club' },
];
