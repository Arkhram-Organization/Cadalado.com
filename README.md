# cadalado.com

**Elegí tu lado.** Juegos clásicos para jugar online con amigos: sin cuentas ni descargas, mandás un link y se juega.

La identidad (logo, colores, tipografía, tono) está en [`MARCA.md`](MARCA.md).

## Qué hay en el repo

| Qué | Carpeta | Rama | Dirección | Proyecto de Vercel |
|---|---|---|---|---|
| 🏠 Portal (inicio, juegos, creadores) | [`portal`](portal) | `main` | `cadalado.com` | `cadalado` |
| ♟️ Ajedrez | [`games/chessort`](games/chessort) | `chessort` | `ajedrez.cadalado.com` | `chessort` |
| 🃏 Truco | `games/truco` | `truco` | `truco.cadalado.com` | `truco` |

Todo se publica en **Vercel**. Cada juego es una app independiente: tiene su carpeta, su rama y su propio proyecto.
El portal solo lista los juegos y los linkea.

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

1. Creá `games/truco/` con todo el juego (su `package.json`, `vercel.json`, etc.).
   Podés copiar `games/chessort` como punto de partida: ya trae salas multijugador guardadas en Redis
   (`lib/room.js`, `api/`), lobby, presencia y chat, y un servidor para probar en tu compu (`npm run dev`).
2. Usá el logo de cadalado (`portal/public/favicon.svg`) y poné un link de vuelta a `https://cadalado.com`.
3. Para que aparezca en el portal, agregalo (o cambiá su `estado` a `'disponible'`) en
   [`portal/public/js/datos.js`](portal/public/js/datos.js). En ese mismo archivo se suman los creadores.

```bash
git push -u origin truco
```

## Publicar (Vercel)

Cada carpeta es un proyecto distinto de Vercel, todos desde este mismo repo.
**Add New → Project**, importá el repo y configurá:

| Campo | Portal | Ajedrez | Truco |
|---|---|---|---|
| Root Directory | `portal` | `games/chessort` | `games/truco` |
| Framework Preset | Other | Other | (lo que use) |
| Production Branch (Settings → Git) | `main` | `chessort` | `truco` |
| Dominio (Settings → Domains) | `cadalado.com` y `www.cadalado.com` | `ajedrez.cadalado.com` | `truco.cadalado.com` |

El ajedrez además necesita una base **Redis** conectada desde la pestaña **Storage** (Upstash tiene plan gratis).
Los detalles están en [`games/chessort/README.md`](games/chessort/README.md).

Como el dominio `cadalado.com` ya está en Vercel, los subdominios se agregan directo en cada proyecto.

## Probar en tu compu

El ajedrez (abre en http://localhost:3000):

```bash
cd games/chessort
```

```bash
npm install
```

```bash
npm run dev
```

El portal es estático:

```bash
npx serve portal/public
```
