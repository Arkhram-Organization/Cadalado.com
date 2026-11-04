# cadalado.com

**Elegí tu lado.** Juegos clásicos para jugar online con amigos: sin cuentas ni descargas, mandás un link y se juega.

La identidad (logo, colores, tipografía, tono) está en [`MARCA.md`](MARCA.md).

## Qué hay en el repo

Todo es **un solo sitio en Vercel**, con cada juego en su ruta:

| Qué | Carpeta | Rama de trabajo | Dirección |
|---|---|---|---|
| 🏠 Portal (inicio, juegos, creadores) | [`portal`](portal) | `main` | `cadalado.com` |
| ♟️ Ajedrez | [`games/chessort`](games/chessort) | `chessort` | `cadalado.com/ajedrez` |
| 🃏 Truco | `games/truco` | `truco` | `cadalado.com/truco` |

```
portal/public/         el portal (estático)
games/<juego>/         cada juego: public/ (lo que ve el navegador), api/ y lib/ (servidor), test/
api/<ruta>/            puntos de entrada de Vercel: solo llaman al código de games/<juego>/api/
scripts/build.mjs      arma dist/: portal en la raíz y cada juego en /<ruta>
vercel.json            configuración del sitio (rutas de cada juego)
dev-server.js          todo el sitio en tu compu (npm run dev)
```

## Cómo trabajamos

- **Cada juego tiene su carpeta y su rama**, y cada rama toca solo su carpeta (`games/<juego>/`).
  Así nunca hay conflictos entre equipos.
- `main` junta lo que ya funciona de todos. No se programa directo ahí: cuando algo queda estable,
  se abre un Pull Request de la rama del juego hacia `main`.
- El portal vive en `main` y se publica desde ahí.

### Sumar un juego nuevo

```bash
git checkout main
```

```bash
git pull
```

```bash
git checkout -b truco
```

1. Creá `games/truco/public/` con lo que ve el navegador. Va a quedar en `cadalado.com/truco/`, así que usá
   rutas relativas (o `<base href="/truco/">` en el HTML, como hace el ajedrez).
2. Si tiene servidor (salas online), poné el código en `games/truco/api/` y `games/truco/lib/`.
   Vercel no tiene WebSockets: copiá el esquema del ajedrez (`games/chessort/lib/room.js`), que guarda las salas en Redis
   y los navegadores consultan el estado cada ~1 segundo. Después agregá sus puntos de entrada en `api/truco/`.
3. Sumalo a `scripts/build.mjs`, a `vercel.json` (sus rutas) y a `dev-server.js`.
   Si necesita paquetes de npm, van en el `package.json` de la raíz.
4. Usá el logo de cadalado y poné un link de vuelta a `/` (el portal).
5. Para que aparezca en el portal, cambiá su `estado` a `'disponible'` en
   [`portal/public/js/datos.js`](portal/public/js/datos.js). En ese mismo archivo se suman los creadores.

```bash
git push -u origin truco
```

## Publicar (Vercel)

Un solo proyecto para todo el sitio:

1. **Add New → Project**, importá este repo. **Root Directory:** vacío (la raíz). **Framework Preset:** Other.
   El resto lo toma de `vercel.json`.
2. **Settings → Git → Production Branch:** `main`.
3. Pestaña **Storage** → conectá una base **Redis** (Upstash, plan gratis). Crea sola la variable `REDIS_URL`
   (o `KV_URL`), que es la que usan los juegos. Después: **Deployments → Redeploy**.
4. **Settings → Domains:** `cadalado.com` y `www.cadalado.com`.

Cada push a `main` publica el sitio. Las ramas de cada juego (`chessort`, `truco`) generan
**previews** con su propia dirección, para probar antes de pasar a `main`.

## Probar en tu compu

Necesitás [Node.js](https://nodejs.org) 22 o superior. Desde la raíz del repo:

```bash
npm install
```

```bash
npm run dev
```

Abrí http://localhost:3000 (portal) y http://localhost:3000/ajedrez/ (ajedrez).
Sin Redis, las partidas se guardan en memoria. Los tests: `npm test`.
