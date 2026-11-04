# Ajedrez · cadalado ♟️

Ajedrez online de [cadalado.com](../../README.md), con estética oscura y tablero verde, para jugar con amigos
en tiempo real. Corre entera en **Cloudflare Workers**, gratis.

> Se trabaja en la rama **`chessort`** y todo vive en esta carpeta (`games/chessort`).
> "chessort" quedó como nombre interno (carpeta, rama y Worker de Cloudflare); para la gente el juego es **Ajedrez**.
> Dirección: `ajedrez.cadalado.com`.

## Qué incluye

- **Multijugador en tiempo real** por WebSocket: creas una partida, compartes el enlace y juegas.
- **Lobby**: la portada muestra los desafíos abiertos (para unirse con un clic) y las partidas en vivo (para mirarlas).
- **Espectadores** ilimitados y **chat** dentro de la partida.
- **Relojes** controlados por el servidor (1, 2|1, 3, 3|2, 5, 10, 15|10, 30 min o sin reloj). Si a alguien se le acaba el tiempo, el servidor cierra la partida aunque nadie tenga la página abierta.
- Reglas completas (vía [chess.js](https://github.com/jhlywa/chess.js)): jaque mate, ahogado, triple repetición, 50 movimientos, material insuficiente, enroque, captura al paso y coronación.
- Abandonar, ofrecer/aceptar tablas, abortar (antes de la 2ª jugada) y **revancha** (con los colores invertidos).
- Tablero: arrastrar y soltar o clic-clic, puntos de jugadas legales, última jugada resaltada, rey en jaque en rojo,
  **flechas y marcas con clic derecho**, selector de coronación, piezas capturadas y ventaja de material.
- Repasar la partida: botones ⏮ ◀ ▶ ⏭ o flechas del teclado (`F` gira el tablero).
- Modo **local** (dos personas en el mismo dispositivo).
- **Ajustes**: 7 colores de tablero, sonidos, coordenadas, mostrar jugadas legales y animaciones.
- Reconexión automática: si recargas la página o se corta internet, vuelves a tu asiento.
- Diseño adaptable a móvil.

## Estructura

```
src/                  ← servidor (Cloudflare Worker)
  index.js            rutas /api (crear partida, lobby, WebSocket)
  game-room.js        Durable Object: una sala por partida (estado, validación, relojes, chat)
  lobby.js            Durable Object: lista de partidas abiertas/en vivo
public/               ← cliente (HTML/CSS/JS sin frameworks ni build)
  index.html
  css/style.css       todo el diseño (colores en variables al inicio)
  js/core.js          reglas y relojes, COMPARTIDO por servidor y navegador
  js/board.js         componente del tablero
  js/game-view.js     pantalla de partida
  js/app.js           navegación, portada y ajustes
  js/controllers.js   conexión online / partida local
  js/settings.js      preferencias y temas de tablero
  js/sound.js         sonidos sintetizados
  pieces/             piezas SVG
  vendor/chess.js     chess.js para el navegador
test/                 tests de reglas (npm test)
```

## Probarlo en tu PC

Necesitas [Node.js](https://nodejs.org) 22 o superior. Todos los comandos se ejecutan dentro de esta carpeta:

```bash
cd games/chessort
```

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:8787. Para probar el multijugador, abre el enlace de la partida en otra ventana de incógnito.

## Publicarlo en workers.dev

Opción A, desde la terminal:

```bash
npx wrangler login
```

```bash
npm run deploy
```

Al terminar te muestra la URL, algo como `https://chessort.TU-SUBDOMINIO.workers.dev`.

Opción B, desde GitHub (se publica solo en cada push a la rama `chessort`):
en el Worker `chessort` de Cloudflare, **Settings → Build**:
Production branch `chessort`, Root directory `games/chessort`, Build watch paths `games/chessort/*`,
Deploy command `npx wrangler deploy`.

Para usar `ajedrez.cadalado.com`: en el Worker, **Settings → Domains & Routes → Add → Custom domain**
(requiere que `cadalado.com` esté agregado a Cloudflare), o descomenta la línea `routes` de `wrangler.jsonc`.

> Los Durable Objects usan almacenamiento SQLite, que está incluido en el plan gratuito de Workers.

## Ideas para seguir

- Jugar contra la computadora (por ejemplo, Stockfish en WebAssembly dentro de un Web Worker).
- Cuentas de usuario y ranking Elo (con D1).
- Premovimientos, análisis de la partida y exportar PGN.
- Más sets de piezas: suma SVGs en `public/pieces/` y un selector en `settings.js`.

## Licencias

- Código: tuyo, haz lo que quieras.
- Piezas: set "Cburnett" de Wikimedia Commons, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), adaptadas de [cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT).
- [chess.js](https://github.com/jhlywa/chess.js): licencia BSD-2-Clause (`public/vendor/chess.js.LICENSE.txt`).
