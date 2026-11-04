# cada-lado.com 🎲

Juegos online para jugar entre amigos. Cada juego vive en su propia carpeta, es una app
independiente (su propio Worker de Cloudflare) y tiene su propia rama de trabajo.

| Juego | Carpeta | Rama | Dirección |
|---|---|---|---|
| ♟️ Ajedrez (ChessORT) | [`games/chessort`](games/chessort) | `chessort` | `chessort.cada-lado.com` |
| 🃏 Truco | `games/truco` | `truco` | `truco.cada-lado.com` |

## Cómo trabajamos

**Cada juego tiene su carpeta y su rama.**

- `main`: lo que ya funciona de todos los juegos juntos. No se programa directo acá.
- `chessort`, `truco`, …: la rama de cada equipo. Ahí se programa y desde ahí publica Cloudflare.
- **Cada rama toca solo la carpeta de su juego** (`games/<juego>/`). Así nunca hay conflictos
  entre equipos y unir todo en `main` es automático.
- Cuando algo queda estable, se abre un Pull Request de la rama del juego hacia `main`.

### Empezar un juego nuevo

```bash
git checkout main
```

```bash
git pull
```

```bash
git checkout -b truco
```

Crea la carpeta `games/truco/` y pon ahí todo el juego (su `package.json`, `wrangler.jsonc`, etc.).
Si quieres, copia `games/chessort` como punto de partida: ya trae servidor con salas multijugador
por WebSocket, lobby y chat. Cambia el `"name"` en `wrangler.jsonc` (por ejemplo `"truco"`).

```bash
git push -u origin truco
```

## Publicar un juego (Cloudflare)

Cada juego es un Worker distinto. En el panel de Cloudflare: **Workers & Pages → Create → Import a repository**,
elige este repo y configura:

| Campo | Valor (ejemplo para el truco) |
|---|---|
| Production branch | `truco` |
| Root directory | `games/truco` |
| Build watch paths | `games/truco/*` |
| Deploy command | `npx wrangler deploy` |

## Dominio cada-lado.com

Para usar subdominios como `truco.cada-lado.com`, el dominio tiene que estar agregado a la cuenta de Cloudflare
(**Add a domain** y cambiar los nameservers donde lo compraron). Después, en cada Worker:
**Settings → Domains & Routes → Add → Custom domain** → `truco.cada-lado.com`.
También se puede hacer desde el código: en `wrangler.jsonc` de ChessORT hay un ejemplo comentado.
