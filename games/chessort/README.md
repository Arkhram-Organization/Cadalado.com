# Ajedrez · cadalado ♟️

Ajedrez online de [cadalado.com](../../README.md) para jugar con amigos en tiempo real. Corre en **Vercel**.

> Se trabaja en la rama **`chessort`** y todo vive en esta carpeta (`games/chessort`).
> "chessort" es el nombre interno (carpeta y rama); para la gente el juego es **Ajedrez**.
> Dirección: `cadalado.com/ajedrez`.

## Qué incluye

- **Multijugador**: creás una partida, compartís el enlace y juegan.
- **Lobby**: la portada muestra los desafíos abiertos (unirse con un clic) y las partidas en vivo (para mirarlas).
- **Espectadores** y **chat** dentro de la partida.
- **Relojes** controlados por el servidor (1, 2|1, 3, 3|2, 5, 10, 15|10, 30 min o sin reloj).
- Reglas completas (vía [chess.js](https://github.com/jhlywa/chess.js)): jaque mate, ahogado, triple repetición,
  50 movimientos, material insuficiente, enroque, captura al paso y coronación.
- Abandonar, ofrecer/aceptar tablas, abortar (antes de la 2ª jugada) y **revancha** (con los colores invertidos).
- Tablero: arrastrar y soltar o clic-clic, puntos de jugadas legales, última jugada resaltada, rey en jaque en rojo,
  **flechas y marcas con clic derecho**, selector de coronación, piezas capturadas y ventaja de material.
- Repasar la partida: botones ⏮ ◀ ▶ ⏭ o flechas del teclado (`F` gira el tablero).
- Modo **local** (dos personas en el mismo dispositivo) y **ajustes** (7 tableros, sonidos, coordenadas…).
- Si recargás la página o se corta internet, volvés a tu asiento.

## Cómo funciona

Vercel no tiene WebSockets, así que el navegador consulta el estado de la partida cada ~1 segundo
(más seguido cuando mueve el rival, menos cuando la pestaña está oculta) y manda las acciones por POST.
Las partidas se guardan en **Redis**. Si a alguien se le acaba el tiempo, la primera consulta que llega lo detecta y cierra la partida.

```
api/                  ← funciones (las publica /api/ajedrez/ en la raíz del repo)
  games.js            POST /api/games          crear partida
  lobby.js            GET  /api/lobby          desafíos abiertos y partidas en vivo
  game/[id].js        GET/POST /api/game/:id   estado y acciones de una partida
lib/
  room.js             salas: unirse, jugar, chat, presencia, lobby
  store.js            Redis (o memoria cuando probás en tu compu)
public/               ← lo que ve el navegador (HTML/CSS/JS sin frameworks)
  js/core.js          reglas y relojes, COMPARTIDO por servidor y navegador
  js/board.js         tablero
  js/game-view.js     pantalla de partida
  js/controllers.js   conexión con el servidor / partida local
  js/app.js           portada, navegación y ajustes
test/                 tests (npm test, desde la raíz)
```

## Probar y publicar

Se hace desde la raíz del repo, para todo el sitio a la vez: ver el [README principal](../../README.md).
En tu compu queda en http://localhost:3000/ajedrez/ (`npm run dev`).

## Licencias

- Piezas: set "Cburnett" de Wikimedia Commons, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), adaptadas de [cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT).
- [chess.js](https://github.com/jhlywa/chess.js): licencia BSD-2-Clause (`public/vendor/chess.js.LICENSE.txt`).
