# cadalado.com

**Elegí tu lado.** Juegos clásicos para jugar online con amigos: sin cuentas ni descargas, mandás un link y se juega.

La identidad (logo, colores, tipografía, tono) está en [`MARCA.md`](MARCA.md).

## Qué hay en el repo

| Qué | Carpeta | Rama | Dirección | Worker de Cloudflare |
|---|---|---|---|---|
| 🏠 Portal (inicio, juegos, creadores) | [`portal`](portal) | `main` | `cadalado.com` | `cadalado` |
| ♟️ Ajedrez | [`games/chessort`](games/chessort) | `chessort` | `ajedrez.cadalado.com` | `chessort` |
| 🃏 Truco | `games/truco` | `truco` | `truco.cadalado.com` | `truco` |

Cada juego es una app independiente: tiene su carpeta, su rama y su propio Worker.
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

1. Creá `games/truco/` con todo el juego (su `package.json`, `wrangler.jsonc`, etc.).
   Podés copiar `games/chessort` como punto de partida: ya trae salas multijugador por WebSocket, lobby y chat.
   Cambiá el `"name"` de `wrangler.jsonc` (por ejemplo `"truco"`).
2. Usá el logo de cadalado (`portal/public/favicon.svg`) y poné un link de vuelta a `https://cadalado.com`.
3. Para que aparezca en el portal, agregalo (o cambiá su `estado` a `'disponible'`) en
   [`portal/public/js/datos.js`](portal/public/js/datos.js). En ese mismo archivo se suman los creadores.

```bash
git push -u origin truco
```

## Publicar (Cloudflare)

Cada carpeta es un Worker distinto. En el panel: **Workers & Pages → Create → Import a repository**,
elegí este repo y configurá:

| Campo | Portal | Ajedrez | Truco |
|---|---|---|---|
| Production branch | `main` | `chessort` | `truco` |
| Root directory | `portal` | `games/chessort` | `games/truco` |
| Build watch paths | `portal/*` | `games/chessort/*` | `games/truco/*` |
| Deploy command | `npx wrangler deploy` | `npx wrangler deploy` | `npx wrangler deploy` |

## Dominios

`cadalado.com` tiene que estar agregado a la cuenta de Cloudflare (**Add a domain**, y cambiar los nameservers
donde se compró). Después, en cada Worker: **Settings → Domains & Routes → Add → Custom domain**:

- Worker `cadalado` → `cadalado.com` y `www.cadalado.com`
- Worker `chessort` → `ajedrez.cadalado.com`
- Worker `truco` → `truco.cadalado.com`

## Probar en tu compu

Dentro de la carpeta que quieras (`portal` o `games/chessort`):

```bash
npm install
```

```bash
npm run dev
```
