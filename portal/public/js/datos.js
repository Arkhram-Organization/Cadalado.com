// ─────────────────────────────────────────────────────────────
//  Catálogo de cadalado: juegos, equipo y novedades.
//  Para sumar algo, agregá un objeto a la lista que corresponda.
// ─────────────────────────────────────────────────────────────

// estado: 'disponible' | 'desarrollo'
// lobby: dirección de su lista de mesas (si tiene). formato: cómo leerla (ver inicio.js).
export const JUEGOS = [
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
  {
    id: 'truco',
    nombre: 'Truco',
    estado: 'disponible',
    nuevo: true,
    url: '/truco/',
    linea: 'Mesa de bar en 3D, con señas, envido y bots si falta gente.',
    datos: [['Jugadores', '1 vs 1, 2 vs 2 o 3 vs 3'], ['Modalidad', 'Online, con bots'], ['Partida', 'A 15 o a 30']],
    color: '#ff7a45',
    captura: '/img/truco.webp',
    lobby: '/api/truco/lobby',
    formato: 'truco',
  },
];

// Solo datos confirmados: el rol se completa cuando cada uno lo defina.
export const EQUIPO = [
  { nombre: 'Sebastián Calviño', rol: 'Ajedrez y sitio', juegos: ['ajedrez'] },
  { nombre: 'Theo Trosman', rol: 'Truco', juegos: ['truco'] },
  { nombre: 'Ignacio Eskenazi', rol: 'Equipo', juegos: [] },
];

export const NOVEDADES = [
  { etiqueta: 'Nuevo', titulo: 'Truco en 3D', texto: 'Mesa de bar, señas a tu compañero, envido, truco y bots para completar la mesa.', juego: 'truco' },
  { etiqueta: 'Nuevo', titulo: 'Tu cuenta en cadalado', texto: 'Historial de partidas, amigos y chat. Desafiá a un amigo desde su perfil.', enlace: '/club' },
  { etiqueta: 'Ajedrez', titulo: 'Relojes y revancha', texto: 'Ritmos de bala a rápidas, revancha con colores invertidos y espectadores.', juego: 'ajedrez' },
  { etiqueta: 'Próximo', titulo: 'El próximo juego', texto: 'Lo elegimos entre todos. Si tenés una idea, escribinos en el chat del club.', enlace: '/club#chats' },
];
