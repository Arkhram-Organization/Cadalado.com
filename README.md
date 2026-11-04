# ChessORT ♟️

Plataforma de ajedrez online propia, con estética oscura y tablero verde, para jugar con amigos
en tiempo real. Corre entera en **Cloudflare Workers** (`*.workers.dev`), gratis.

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

## 🃏 Truco argentino (en `/truco`)

Truco online en 3D para **1 vs 1, 2 vs 2 y 3 vs 3**, sin flor, con las reglas del reglamento argentino.

- **Escena 3D en primera persona**: estás sentado a la mesa. Arrastrá (o usá A/D y W/S) para mirar a los costados
  y para abajo. Al mirar la mesa te inclinás sobre ella. Los jugadores son personajes 2D ilustrados dentro del salón 3D.
- **Señas con la cara**: menú desplegable con todas las señas (ancho de espada = cejas, ancho de basto = guiño,
  7 de espada/oro = boca torcida, 3 = morderse el labio, 2 = trompita, ancho falso = lengua, ciego = ojos cerrados,
  envido = inflar los cachetes, 30+ = fruncir la nariz…). **El servidor solo se la manda a quien te esté mirando en ese
  momento**, así que un rival te puede cazar una seña si te está mirando. Se ve hacia dónde mira cada uno (y el 👁 si te mira a vos).
- **Cartas encimadas** para disimular cómo venía la mano (se nota un poquito), **cartas tapadas** desde segunda,
  y botón **¡Trampa!** para denunciar: si había una encimada, el tramposo pierde la mano; si no, 1 punto para el rival.
- Truco / retruco / vale cuatro, envido / real envido / falta envido, “el envido está primero”, son buenas,
  irse al mazo, pardas, malas y buenas, anotador con fósforos.
- **Online** con salas por código de 5 letras: crear sala (privada o pública), unirse con código, enlace directo
  `/truco/sala/CÓDIGO`, WhatsApp / compartir, **partida rápida** (te sienta en una mesa pública), lista de mesas
  públicas, **mirar** partidas en vivo y **practicar con bots**. Los bots completan lugares y juegan si alguien se desconecta.
- Chat con frases rápidas, globos de diálogo sobre cada jugador, voz que canta los cantos y revancha.

Código: `src/truco-room.js` (sala, Durable Object), `public/truco/js/engine.js` (reglas, compartidas con los tests),
`public/truco/js/bot.js`, `public/truco/js/scene.js` (Three.js), `public/truco/js/characters.js` (personajes y caras),
`public/truco/js/main.js` (interfaz). Tests: `test/truco.test.js`.

Cartas: diseño “Naipes Libres” de [Basquetteur](https://commons.wikimedia.org/wiki/User:Basquetteur) (Wikimedia Commons),
vectorizado por [gjenkins20](https://github.com/gjenkins20/spanish-playing-cards-svg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/);
convertidas a WebP. [Three.js](https://threejs.org) (MIT, `public/truco/vendor/three.LICENSE.txt`).

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

Necesitas [Node.js](https://nodejs.org) 18 o superior.

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

Al terminar te muestra la URL, algo como `https://chessort.TU-SUBDOMINIO.workers.dev`. Pásasela a tus amigos y listo.

Opción B, desde GitHub (se publica solo en cada push):
en el panel de Cloudflare entra en **Workers & Pages → Create → Import a repository**, elige este repositorio
y deja los valores por defecto (comando de deploy: `npx wrangler deploy`).

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
