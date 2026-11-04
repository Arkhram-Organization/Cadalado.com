// Arma la carpeta dist/ que publica Vercel:
//   portal/public          → dist/          (cadalado.com)
//   games/<juego>/public   → dist/<ruta>/   (cadalado.com/<ruta>)
// Para sumar un juego, agregalo a JUEGOS.
import { cp, rm, mkdir } from 'node:fs/promises';

export const JUEGOS = [{ carpeta: 'games/chessort', ruta: 'ajedrez' }];

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('portal/public', 'dist', { recursive: true });
for (const j of JUEGOS) {
  await cp(`${j.carpeta}/public`, `dist/${j.ruta}`, { recursive: true });
}
console.log('dist/ listo:', ['portal', ...JUEGOS.map((j) => j.ruta)].join(', '));
