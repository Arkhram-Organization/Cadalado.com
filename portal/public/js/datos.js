// ─────────────────────────────────────────────────────────────
//  Catálogo de cadalado.com
//  Para sumar un juego o un creador, agregá un objeto a la lista.
// ─────────────────────────────────────────────────────────────

// estado: 'disponible' (se puede jugar) | 'desarrollo' (se ve, pero no se juega todavía)
export const JUEGOS = [
  {
    id: 'ajedrez',
    nombre: 'Ajedrez',
    estado: 'disponible',
    url: '/ajedrez/',
    descripcion: 'El de siempre, en serio: relojes, revancha, chat y espectadores. Mandá el link y jugá.',
    etiquetas: ['2 jugadores', 'Con reloj', 'Espectadores'],
    color: '#81b64c',
    icono: 'peon',
    // Si el juego expone /api/lobby, el portal muestra cuánta gente está jugando.
    lobby: true,
  },
  {
    id: 'truco',
    nombre: 'Truco',
    estado: 'desarrollo',
    url: '/truco/',
    descripcion: 'Envido, truco, retruco y vale cuatro. El clásico de la mesa, ahora online.',
    etiquetas: ['2, 4 o 6', 'Por equipos', 'Baraja española'],
    color: '#ff5a1f',
    icono: 'carta',
  },
];

// Los links son opcionales: { github: 'usuario', instagram: 'usuario', web: 'https://…' }
export const CREADORES = [
  {
    nombre: 'Seba',
    rol: 'Ajedrez',
    bio: 'Armó el ajedrez de cadalado. Pronto, más sobre él.',
    juegos: ['ajedrez'],
    links: {},
  },
  {
    nombre: 'Equipo Truco',
    rol: 'Truco',
    bio: 'Están repartiendo las cartas. Muy pronto se presentan.',
    juegos: ['truco'],
    links: {},
    pendiente: true,
  },
];
