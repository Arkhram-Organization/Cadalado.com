// Arma la carpeta dist/ que publica Vercel:
//   portal/public          → dist/          (cadalado.com)
//   games/<juego>/public   → dist/<ruta>/   (cadalado.com/<ruta>)
//   shared/public          → dist/comun/    (lo común de los juegos nuevos)
// Para sumar un juego, agregalo a JUEGOS.
import { cp, rm, mkdir } from 'node:fs/promises';

export const JUEGOS = [
  { carpeta: 'games/chessort', ruta: 'ajedrez' },
  { carpeta: 'games/truco', ruta: 'truco' },
  { carpeta: 'games/memes', ruta: 'memes' },
  { carpeta: 'games/haxball', ruta: 'haxball' },
  { carpeta: 'games/pelea', ruta: 'pelea' },
  { carpeta: 'games/futbol', ruta: 'futbol' },
  { carpeta: 'games/empujon', ruta: 'empujon' },
  { carpeta: 'games/casino', ruta: 'casino' },
  { carpeta: 'games/carrera', ruta: 'carrera' },
  { carpeta: 'games/royale', ruta: 'royale' },
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('portal/public', 'dist', { recursive: true });
await cp('shared/public', 'dist/comun', { recursive: true }); // logo, estilos y cliente de salas comunes
for (const j of JUEGOS) {
  await cp(`${j.carpeta}/public`, `dist/${j.ruta}`, { recursive: true });
}
console.log('dist/ listo:', ['portal', ...JUEGOS.map((j) => j.ruta)].join(', '));
