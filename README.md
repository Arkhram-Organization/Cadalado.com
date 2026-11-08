# cadalado.com

**¿A qué jugamos hoy?** Club de juegos online con amigos: sin descargas, mandás un link y se juega.

La identidad (logo, colores, tipografía, tono) está en [`MARCA.md`](MARCA.md).

## Qué hay en el repo

Todo es **un solo sitio en Vercel**, con cada juego en su ruta:

| Qué | Carpeta | Dirección |
|---|---|---|
| Portal (inicio, personaje, equipo, entrar, club) | [`portal`](portal) | `cadalado.com` |
| Ajedrez | [`games/chessort`](games/chessort) | `cadalado.com/ajedrez` |
| Truco | [`games/truco`](games/truco) | `cadalado.com/truco` |
| Ángeles Peña (carrera de obstáculos 3D) | [`games/carrera`](games/carrera) | `cadalado.com/carrera` |
| El casino de Dobro (ruleta, blackjack, slots) | [`games/casino`](games/casino) | `cadalado.com/casino` |
| Make it Meme | [`games/memes`](games/memes) | `cadalado.com/memes` |
| Último en pie (battle royale 3D) | [`games/royale`](games/royale) | `cadalado.com/royale` |
| Cuentas, historial, amigos y chats | [`shared`](shared) | `cadalado.com/club` |

```
portal/public/         el portal: inicio, /personaje, /equipo, /entrar, /club (HTML, CSS y JS sin frameworks)
  js/datos.js          catálogo: juegos, ideas y novedades (lo único que hay que tocar para sumar algo)
games/chessort/        ajedrez: public/ (navegador), api.js + lib/ (servidor), test/
games/truco/           truco:   public/ (navegador, 3D), api.js + lib/sala.js (servidor), test/
games/memes|casino|carrera/   los juegos nuevos: public/, api.js, lib/ (reglas), test/
shared/                lo común: store.js (Redis), cuenta.js (cuentas, historial, amigos, chats), http.js,
                       salas.js (motor de salas que usan memes, casino y carrera)
shared/public/         se publica en /comun: logo, estilos y cliente de salas de los juegos nuevos
api/                   funciones de Vercel: juegos/<juego>.js (una por juego) y club.js
scripts/build.mjs      arma dist/: portal en la raíz y cada juego en /<ruta>
vercel.json            rutas del sitio
dev-server.js          todo el sitio en tu compu (npm run dev)
```

### Cómo funciona el multijugador

Vercel no tiene WebSockets: cada navegador consulta su partida cerca de una vez por segundo y manda
las jugadas por POST. Las partidas, cuentas y chats se guardan en **Redis** (Upstash). En el truco, lo que
antes hacían las "alarmas" (bots, pausas entre manos, tiempos) lo hace el servidor en esas consultas,
y `public/js/polling-socket.js` imita un WebSocket para que el código del juego casi no cambie.

### Motor de salas (memes, casino, carrera)

`shared/salas.js` resuelve lo común de cualquier juego por salas: código e invitación, candado en Redis
para que dos acciones no se pisen, presencia, chat, eventos numerados y un "tick" para los tiempos.
Cada juego solo escribe sus reglas (`nueva`, `accion`, `tick`, `vista`). Para sumar un juego nuevo,
mirá `games/memes/lib/memes.js`: es el ejemplo más corto.

- **Casino:** las fichas son de mentira. Con cuenta se guardan en la cuenta; sin cuenta, en el dispositivo.
  Las mesas públicas (`RULETA`, `BLACKJACK-1`, `SLOTS`…) existen siempre; también hay mesas privadas.
- **Carrera:** las posiciones viajan **directo entre navegadores** (WebRTC, ~15 por segundo); el servidor solo
  los presenta y ordena las llegadas con su reloj. Si una red bloquea la conexión directa, se usa el servidor
  como plan B. Los bots y los obstáculos salen de una "semilla", así que todos ven lo mismo sin mandarse nada.
- **Make it Meme:** las 100 plantillas son las más usadas de imgflip.com y se cargan desde ahí.

### Cuentas

- Registro y entrada con usuario y contraseña (guardada con scrypt, nunca en texto plano). La sesión es una cookie.
- Con cuenta, las partidas de ajedrez, truco, memes y carrera quedan en el **historial** (victorias, derrotas, rivales).
- **Amigos** por nombre de usuario, **chat privado** entre amigos y un **chat general** del club.
- Desde el club se **desafía** a un amigo: se crea la mesa y le llega el link por chat.
- Para jugar no hace falta cuenta.

### Muro y sugerencias (portada)

- **El muro** (arriba de la portada): cualquiera publica texto y fotos, comenta y da me gusta, **sin cuenta**.
  La foto se achica en el navegador (JPG, lado mayor 1280 px) y se guarda en Redis; se sirve en `/api/club/muro/foto?id=…`.
  Quedan las últimas 200 publicaciones. Con cuenta salís con tu nombre, tu personaje y una marca de "con cuenta".
- **Sugerencias** (abajo de todo): ideas de juegos o cambios, con votos (uno por dispositivo). Las más votadas van primero.
- Sin cuenta, cada navegador guarda una clave para poder borrar lo suyo. Hay topes por IP para frenar el spam.
- **Moderar:** poné en Vercel la variable `CLUB_ADMINS` con los usuarios admin separados por coma (ej. `seba,theo`).
  Esos usuarios, con su cuenta, pueden borrar cualquier publicación o idea y marcar ideas como "En camino" o "Hecho".

## Cómo trabajamos

Hay **dos ramas**, nada más:

| Rama | Para qué |
|---|---|
| `chessort` | **Todo el trabajo.** Acá se programa y se prueba (Vercel arma un preview con su propia dirección). |
| `main` | **Producción** (`cadalado.com`). Solo recibe lo que ya anda en `chessort`, por Pull Request o merge. No se programa directo. |

```bash
git checkout chessort
```

```bash
git pull origin chessort
```

Cuando algo queda estable, se abre un Pull Request de `chessort` hacia `main` (o se hace merge directo si
`main` no tiene nada distinto). Las ramas viejas de la época de Cloudflare (`truco`, `claude/...`) quedaron guardadas en la rama
`archivo` (no se trabaja ahí); lo del truco ya estaba integrado en `games/truco`.

### Sumar un juego nuevo

1. Creá `games/<juego>/public/` con lo que ve el navegador. Va a quedar en `cadalado.com/<juego>/`.
2. Si tiene salas online, usá el motor de `shared/salas.js` (mirá `games/memes/lib/memes.js`) o poné el servidor en
   `games/<juego>/api.js` y `games/<juego>/lib/`, guardando en Redis con `shared/store.js`. Para el historial,
   llamá a `registrarPartida` de `shared/cuenta.js` cuando termine la partida.
3. Agregá su función en `api/juegos/<juego>.js` (3 líneas, como las otras), sus rutas en `vercel.json`,
   y sumalo a `scripts/build.mjs` y `dev-server.js`. Los paquetes de npm van en el `package.json` de la raíz.
4. Usá el logo de cadalado y poné un link de vuelta a `/`.
5. Sumalo al portal en [`portal/public/js/datos.js`](portal/public/js/datos.js), con una captura real en `portal/public/img/`.

## Publicar (Vercel)

Un solo proyecto para todo el sitio:

1. **Add New → Project**, importá este repo. **Root Directory:** vacío (la raíz). **Framework Preset:** Other.
   El resto lo toma de `vercel.json`.
2. **Settings → Git → Production Branch:** `main`.
3. Pestaña **Storage** → conectá una base **Redis** (Upstash, plan gratis). Crea sola la variable `REDIS_URL`
   (o `KV_URL`), que es la que usan los juegos. Después: **Deployments → Redeploy**.
4. **Settings → Domains:** `cadalado.com` y `www.cadalado.com`.

El plan gratis de Upstash tiene un límite mensual de operaciones. Para un grupo de amigos alcanza; si se queda
corto, se pasa al plan por uso desde su panel. Para revisar la conexión: `cadalado.com/ajedrez/api/estado`.

Cada push a `main` publica el sitio. Cada push a `chessort` genera un **preview** con su propia dirección,
para probar antes de pasar a `main`.

## Probar en tu compu

Necesitás [Node.js](https://nodejs.org) 22 o superior. Desde la raíz del repo:

```bash
npm install
```

```bash
npm run dev
```

Abrí http://localhost:3000 (portal), http://localhost:3000/ajedrez/ y http://localhost:3000/truco/.
Sin Redis, las partidas se guardan en memoria. Los tests: `npm test`.
