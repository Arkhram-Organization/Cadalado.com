// ─────────────────────────────────────────────────────────────
//  Catálogo de cadalado: juegos, ideas, equipo y novedades.
//  Para sumar algo, agregá un objeto a la lista que corresponda.
// ─────────────────────────────────────────────────────────────

// estado: 'disponible' | 'desarrollo'
// lobby: dirección de su lista de salas. formato: cómo leerla (ver LECTORES en inicio.js).
export const JUEGOS = [
  {
    id: 'royale',
    nombre: 'Battle Shmitz',
    estado: 'disponible',
    nuevo: true,
    url: '/royale/',
    linea: 'Saltá del colectivo, explorá ocho lugares, juntá botín y construí para ser quien gane Battle Shmitz.',
    datos: [['Jugadores', 'Hasta 24, con bots'], ['Modalidad', 'Online, tiempo real'], ['Partida', '3 a 6 min']],
    color: '#ff6b5b',
    captura: '/img/royale-poster-chico.webp',
    poster: '/img/royale-poster.webp',
    lobby: '/api/royale/lobby',
    formato: 'salas',
  },
  {
    id: 'carrera',
    nombre: 'Full Gays',
    estado: 'disponible',
    nuevo: true,
    url: '/carrera/',
    linea: 'Carrera de obstáculos en 3D por rondas: barras, martillos, molinos, baldosas que se caen y piñas.',
    datos: [['Jugadores', 'Hasta 16 + bots'], ['Modalidad', 'Online, tiempo real'], ['Partida', '30 a 60 s']],
    color: '#4fd1c5',
    captura: '/img/carrera-poster-chico.webp',
    poster: '/img/carrera-poster.webp',
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
    datos: [['Jugadores', 'Todos en la misma mesa'], ['Juegos', 'Ruleta · Blackjack · Slots'], ['Fichas', '8.000 para arrancar']],
    color: '#f2c94c',
    captura: '/img/casino-poster-chico.webp',
    poster: '/img/casino-poster.webp',
    lobby: '/api/casino/lobby',
    formato: 'salas',
  },
  {
    id: 'empujon',
    nombre: 'Empujón',
    estado: 'disponible',
    nuevo: true,
    url: '/empujon/',
    linea: 'Todos contra todos arriba de la ciudad: empujá, agarrá y revoleá a los demás afuera. Hasta 20 por sala o equipos de hasta 4v4.',
    datos: [['Jugadores', 'Hasta 20'], ['Modos', 'Todos o equipos'], ['Ronda', '2 a 5 min']],
    color: '#ff8a3a',
    captura: '/img/empujon-poster-chico.jpg',
    poster: '/img/empujon-poster.jpg',
    lobby: '/api/empujon/lobby',
    formato: 'salas',
  },
  {
    id: 'futbol',
    nombre: 'La Canchita',
    estado: 'disponible',
    nuevo: true,
    url: '/futbol/',
    linea: 'Fútbol 5 a fútbol 8 en 3D con los personajes del club: paredes, voleas, barridas y arqueros que vuelan.',
    datos: [['Jugadores', 'F5 a F8'], ['Rivales', 'Bots o amigos'], ['Partido', '2 a 8 min']],
    color: '#5ae07a',
    captura: '/img/futbol-poster-chico.jpg',
    poster: '/img/futbol-poster.jpg',
    lobby: '/api/futbol/lobby',
    formato: 'salas',
  },
  {
    id: 'pelea',
    nombre: 'Piña Final',
    estado: 'disponible',
    nuevo: true,
    url: '/pelea/',
    linea: 'Pelea 2D con los personajes del club: combos, katanas, shurikens y poderes. En cada ronda te toca un elemento al azar.',
    datos: [['Jugadores', '1v1 o 2v2'], ['Rivales', 'Bots o amigos'], ['Pelea', 'Al mejor de 3']],
    color: '#ff4a3a',
    captura: '/img/pelea-poster-chico.jpg',
    poster: '/img/pelea-poster.jpg',
    lobby: '/api/pelea/lobby',
    formato: 'salas',
  },
  {
    id: 'haxball',
    nombre: 'Haxball',
    estado: 'disponible',
    nuevo: true,
    url: '/haxball/',
    linea: 'Fútbol 2D por equipos: cada jugador es la cabeza de su personaje. Rojo contra azul.',
    datos: [['Jugadores', '2 a 12'], ['Equipos', 'Rojo y azul'], ['Partido', '2 a 5 min']],
    color: '#4fd1c5',
    captura: '/img/haxball-poster-chico.webp',
    poster: '/img/haxball-poster.webp',
    lobby: '/api/haxball/lobby',
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
    captura: '/img/memes-poster-chico.webp',
    poster: '/img/memes-poster.webp',
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
    captura: '/img/truco-poster-chico.webp',
    poster: '/img/truco-poster.webp',
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
    captura: '/img/ajedrez-poster-chico.webp',
    poster: '/img/ajedrez-poster.webp',
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

// Solo datos confirmados y sin nombres: cada tarjeta dice qué hizo, no quién.
export const EQUIPO = [
  { rol: 'Sitio y juegos', juegos: ['ajedrez', 'carrera', 'casino', 'memes', 'royale'] },
  { rol: 'Truco', juegos: ['truco'] },
  { rol: 'Equipo', juegos: [] },
];

export const NOVEDADES = [
  { etiqueta: 'Nuevo', titulo: 'Battle Shmitz', texto: 'Colectivo, ocho lugares, cofres, construcción y partidas con amigos y bots.', juego: 'royale' },
  { etiqueta: 'Nuevo', titulo: 'Full Gays', texto: 'Obstáculos en 3D, en tiempo real y con bots para llenar la largada.', juego: 'carrera' },
  { etiqueta: 'Nuevo', titulo: 'El casino de Dobro', texto: 'Ruleta, blackjack y tragamonedas con pozo compartido. Fichas de mentira.', juego: 'casino' },
  { etiqueta: 'Nuevo', titulo: 'Make it Meme', texto: '100 plantillas, textos donde quieras y votación anónima.', juego: 'memes' },
  { etiqueta: 'Club', titulo: 'Tu cuenta', texto: 'Historial de todos los juegos, amigos y chat. Desafiá desde el perfil.', enlace: '/club' },
];

// Salas abiertas de todos los juegos: una sola consulta, compartida por toda la página (y guardada 15 s).
// Si el servidor es viejo y no la tiene, se pide juego por juego como antes.
let salasCache = null;
export function salasAbiertas() {
  if (salasCache && Date.now() - salasCache.t < 15000) return salasCache.p;
  const p = fetch('/api/club/salas')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
    .catch(async () => {
      const out = {};
      await Promise.all(JUEGOS.filter((j) => j.lobby).map(async (j) => {
        try { out[j.id] = await (await fetch(j.lobby, { cache: 'no-store' })).json(); } catch {}
      }));
      return out;
    });
  salasCache = { t: Date.now(), p };
  return p;
}
