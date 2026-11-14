// Cómo arma la lobby una sala de cada juego (lo usan la portada y el "Cambiar de juego" de adentro de los juegos).
export const SALAS = {
  truco: () => ({ api: '/api/truco/rooms', url: '/truco/sala/', directo: true, opciones: { mode: '3v3', target: 30, isPublic: false } }),
  ajedrez: () => ({ api: '/ajedrez/api/games', url: '/ajedrez/game/', directo: true, opciones: { tc: '10+0', color: 'w' } }),
  royale: (o) => ({ api: '/api/royale/crear', url: '/royale/sala/', opciones: { bots: 7, publica: false, ...o } }),
  carrera: (o) => ({ api: '/api/carrera/crear', url: '/carrera/sala/', opciones: { bots: 5, publica: false, ...o } }),
  memes: (o) => ({ api: '/api/memes/crear', url: '/memes/sala/', opciones: { bots: 2, publica: false, ...o } }),
  haxball: (o) => ({ api: '/api/haxball/crear', url: '/haxball/sala/', opciones: { bots: 1, publica: false, ...o } }),
  empujon: (o) => ({ api: '/api/empujon/crear', url: '/empujon/sala/', opciones: { publica: false, ...o } }),
  futbol: (o) => ({ api: '/api/futbol/crear', url: '/futbol/sala/', opciones: { publica: false, ...o } }),
  pelea: (o) => ({ api: '/api/pelea/crear', url: '/pelea/sala/', opciones: { publica: false, ...o } }),
  casino: (o) => ({ api: '/api/casino/crear', url: '/casino/mesa/', opciones: { tipo: 'blackjack', publica: false, ...o } }),
};

// Crea la sala del juego para la lobby y devuelve su dirección (/royale/sala/ABCDE…).
export async function crearSalaDeLobby(juego, config, { pid, nombre }) {
  const s = SALAS[juego]?.(config || {});
  if (!s) return `/${juego}/`;
  const res = await fetch(s.api, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pid, nombre, name: nombre, ...(s.directo ? s.opciones : { opciones: s.opciones }) }),
  });
  const d = await res.json().catch(() => ({}));
  const code = d.code || d.id;
  if (!res.ok || !code) throw new Error(d.error || 'No se pudo armar la sala.');
  return s.url + code;
}
