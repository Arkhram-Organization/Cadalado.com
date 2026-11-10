Sos un desarrollador de videojuegos web senior. Te voy a pasar el código de un battle royale que ya funciona y quiero que lo transformes en **Battle Shmitz**, un battle royale con la jugabilidad de Fortnite (sin copiar su nombre, personajes, arte, música ni mapas: todo es original y con nuestra propia identidad). Vamos a trabajar por etapas. Leé todo antes de empezar.

---

## 1. Contexto del proyecto

- Es **cadalado.com**, un club de juegos entre amigos. Todo el texto de la interfaz va en **español rioplatense con voseo** ("agarrá", "construí", "tocá E").
- Stack: **JavaScript puro con módulos ES**, sin frameworks, sin bundler, sin TypeScript, **sin dependencias nuevas**. three.js 0.170 ya está en el repo (`/comun/vendor/three.module.min.js`) y lo importamos así.
- Hosting en Vercel (funciones serverless) + Redis para el estado de las salas. Hay también un worker de Cloudflare con el mismo código.
- Los nombres de variables, funciones y comentarios van **en español**, igual que el resto del código (por ejemplo `Peleador`, `recoger`, `zona`, `botin`).
- Tests con `node --test` (comando: `npm test`). Tienen que seguir pasando y quiero tests nuevos para la lógica pura.

## 2. Cómo está armado el juego hoy ("Último en pie", carpeta `games/royale/`)

| Archivo | Qué hace |
|---|---|
| `lib/royale.js` | Lógica del **servidor** con `crearJuego()` de `shared/salas.js`. Fases `lobby → cuenta → partida → fin`. Lleva `vivos`, `bajas`, `kills`, botín tomado (`tomados`), objetos soltados (`sueltos`), dueño de cada objeto (`propietarios`). Acciones: `bots`, `empezar`, `agarrar`, `soltar`, `muerte`, `botdice`, `mensaje`, `senal`. Máx. 24 jugadores, 15 bots. |
| `api.js` | Expone el handler HTTP (`/api/royale/...`). |
| `public/js/mundo.js` | Mapa procedural por semilla: grilla `TAM = 96` baldosas de `BALDOSA = 16` px (`LADO = 1536` px). Tipos `T = {AGUA, ARENA, PASTO, PISO, PARED, CAMINO}`. Árboles/rocas en `obstaculos`, botín en `botin`. `ARMAS` (pistola, subfusil, escopeta, rifle con daño, cadencia, cargador, recarga, velocidad, dispersión, alcance, perdigones). `moverCirculo`, `choqueBala`, `seVen`. La **zona** (`zona(semilla, t)`) se cierra en 5 etapas. |
| `public/js/juego.js` | `Peleador` (vida 100, escudo 100, `slots` de 6 casilleros, `actual`, `recargando`, `usando`), balas (`nuevaBala`, `avanzarBala`), daño de zona y `CerebroBot` (IA de los bots). |
| `public/js/inventario.js` | `OBJETOS` (venda, botiquín, mini escudo, escudo grande, granada), `CASILLEROS = 6`, `recoger`, `comenzarUso`, `avanzarUso`. |
| `public/js/escena3d.js` | `Isla3D`: dibuja todo en three.js con cámara ortográfica cenital, sombras, `InstancedMesh` por tipo de baldosa, personajes con `crearPersona()` de `/comun/persona3d.js`, zona como cilindro. |
| `public/js/app.js` | Menú, sala, HUD, controles (WASD, mouse para apuntar y disparar, 1–6 casilleros, R recargar, X soltar, E agarrar), red. **El host simula a los bots**. Movimiento y disparos van **entre navegadores por WebRTC** (`Red` de `/comun/red.js`, con plan B por el servidor): `red.actual.todos({k:'tiro'...})`, `{k:'agarre'}`, `{k:'granada'}`, posiciones codificadas como texto. El servidor solo valida botín, bajas y ganador. |
| `public/js/sprites.js` | Minimapa y restos del modo 2D. |
| `test/royale.test.js`, `test/inventario.test.js` | Tests actuales. |

Otros puntos de contacto:
- Personajes y gestos: `shared/public/persona3d.js`, `modelo3d.js` (modelos de Meshy con animaciones: `quieto`, `corre`, `dispara`, `apunta`, `recarga`, `granada`, `armaCamina`, `muerto`, `baila`, `festeja`, etc.), `shared/public/rueda-gestos.js` (rueda de gestos con B), `shared/public/npcs.js` (el elenco: los bots usan estos NPC) y `shared/public/dichos.js` (frases de los bots).
- Nombre y tarjeta del juego en la portada: `portal/public/js/datos.js` (entrada con `id: 'royale'`).
- **No cambies la URL `/royale/`** ni las rutas de la API: solo cambia el nombre visible. Si tocás rutas, también hay que tocar `vercel.json`, `scripts/build.mjs`, `dev-server.js` y `worker/index.js`; preferimos no hacerlo.

## 3. Cómo quiero que trabajes

1. **Antes de escribir código, pedime los archivos** que necesites para la etapa (empezá por `games/royale/lib/royale.js`, `public/js/mundo.js`, `juego.js`, `inventario.js`, `escena3d.js` y `app.js`). No inventes cómo es un archivo que no viste.
2. Trabajá **una etapa por vez** (sección 5). Al terminar cada una, dame:
   - los **archivos completos** que cambian (o un diff unificado si el archivo es muy largo),
   - los **tests nuevos**,
   - una lista corta de **qué probar a mano** en el navegador.
3. Todo tiene que ser **determinista por semilla** (mapa, cofres, zona, ruta del colectivo) para que todos los navegadores vean lo mismo sin mandar el mapa por la red.
4. Lo que decide quién gana o qué objeto es de quién lo valida el **servidor** (`lib/royale.js`). Lo visual y el movimiento siguen yendo por WebRTC como hoy.
5. Mantené el rendimiento: apuntá a 60 fps en una notebook común y que se pueda jugar en el celular. Usá `InstancedMesh` para lo que se repite (paredes, árboles, piezas construidas).
6. Si algo de lo que pido choca con el código existente, avisame y proponé la alternativa más simple. No reescribas desde cero lo que ya funciona.

## 4. Lo que quiero (el diseño de Battle Shmitz)

### 4.1 Nombre e identidad
- El juego pasa a llamarse **Battle Shmitz** en todos los textos (menú, sala, HUD, portada en `datos.js`, mensajes del sistema, frases de los bots).
- La paleta sigue la del sitio (carbón `#141413` con acentos lima `#c5f04a`), con el rojo del juego (`#ff6b5b`) como color propio.

### 4.2 Mapa más grande con lugares con nombre
- Un mapa **unas 2,5 veces más grande** en superficie (por ejemplo `TAM = 160`, `LADO = 2560` px). Ajustá la zona, la cámara y el minimapa a la nueva escala.
- Lugares con nombre, cada uno con su estilo de edificios y su densidad de botín. Que se vean el nombre en el mapa grande (tecla M) y un cartel al entrar ("Entraste a: El reino del Queque"):
  1. **El reino del Queque**: la ciudad principal y la mejor del mapa (como la ciudad grande y céntrica de cualquier battle royale). Muchos edificios de varias alturas, el mejor botín y más cofres. Va en el centro.
  2. **El despacho de Asman**: un complejo de oficinas.
  3. **Ángeles angieados**: un barrio de casas con jardines.
  4. **Kiwi**: una granja o huerta con galpones.
  5. **Ciudad Fondeana**: un pueblo portuario sobre la costa.
  6. **El templo**: un templo grande con patio y columnas en una loma.
  7. **Macabíes macabros**: un estadio o club deportivo abandonado, con clima tenebroso.
  8. **El Vasquito**: un bar y almacén de ruta en un cruce de caminos.
- Entre los lugares: caminos, bosques, rocas y zonas abiertas. Los lugares se ubican siempre igual (el mapa es fijo); lo que varía por semilla es el botín, los cofres y la zona.

### 4.3 El colectivo de batalla
- Al arrancar, todos van arriba de un **colectivo volador** que cruza el mapa en línea recta. La dirección cambia en cada partida según la semilla.
- Con **Espacio** te tirás. Caés en paracaídas (se abre solo cerca del piso) y podés moverte en el aire para elegir dónde caer.
- Si no saltás, te tira solo al final del recorrido. Los bots eligen un lugar con nombre y saltan cerca.
- El servidor manda la semilla y la hora de inicio, y cada navegador calcula la posición del colectivo. El salto se anuncia por la red como cualquier movimiento.

### 4.4 Recolección y construcción
- Todos arrancan con un **pico** (casillero fijo, no ocupa los 6 de objetos). Con el pico se pegan árboles, rocas, autos o paredes y se juntan **materiales**:
  - **madera** (árboles, cercas),
  - **piedra** (rocas, paredes de ladrillo),
  - **metal** (autos, chapas).
  - Cada golpe da entre 5 y 10, hasta un máximo de 500 de cada uno. Lo que golpeás tiene vida y se rompe.
- Construcción en **una sola capa**: solo **paredes** y **escaleras**, apoyadas en el piso. **No se puede construir encima de otra construcción** ni apilar en altura.
  - Q (o un botón en el celu) entra al modo construcción.
  - F elige entre pared y escalera, R rota y clic coloca. Con la rueda o con 1-2-3 elegís el material.
  - Costo: 10 de material por pieza. Vida de las piezas: madera 150, piedra 300, metal 500. Se construyen en 1 segundo (la vida sube mientras tanto).
  - Las piezas se alinean a una grilla (el doble del tamaño de baldosa, por ejemplo 32 px).
  - Las paredes frenan balas y movimiento. La escalera te sube un nivel: mientras estás arriba de ella, disparás por encima de las paredes de un nivel y tenés ventaja de altura.
  - Las construcciones se pueden romper a tiros o con el pico.
  - Cada pieza se anuncia por la red con un id único (`pieza-<jugador>-<n>`). El servidor guarda la lista para que alguien que se reconecta las vea. El daño a las piezas lo informa quien dispara.

### 4.5 Inventario estilo Fortnite
- **5 casilleros** de objetos más el pico aparte.
- **E agarra automáticamente.**
  - Si hay lugar, va al primer casillero libre.
  - Si el inventario está lleno, **cambia** el objeto del casillero que tenés en la mano por el del piso, y el tuyo queda tirado donde estaba el otro.
  - Ya no hace falta soltar con X antes de agarrar (X sigue sirviendo para tirar a propósito).
- Los consumibles iguales se apilan, como hoy.
- Los materiales y las balas no ocupan casilleros: se juntan solos al pasar por encima.
- Un cartel flotante sobre cada objeto del piso muestra nombre, rareza (con su color) y "E para agarrar".

### 4.6 Armas, rarezas y balas
- **Más lentas que hoy**: bajá la cadencia de todas para que los tiroteos duren más y se pueda construir para cubrirse.
- **Rarezas** que suben el daño y bajan un poco la recarga. Cada objeto del piso y del inventario muestra su color de rareza:

  | Rareza | Color | Daño | Recarga |
  |---|---|---|---|
  | Común | gris | ×1,00 | ×1,00 |
  | Poco común | verde | ×1,08 | ×0,95 |
  | Rara | azul | ×1,16 | ×0,90 |
  | Épica | violeta | ×1,25 | ×0,85 |
  | Legendaria | dorado | ×1,35 | ×0,80 |

- **Armas** (los valores son orientativos, ajustalos para que quede parejo):
  - **Pistola**: 24 de daño base, 2,5 tiros por segundo.
  - **Subfusil**: 14 de daño, 7 tiros por segundo.
  - **Escopeta**: 8 perdigones de 11, un tiro cada 1,1 s.
  - **Rifle de asalto**: 30 de daño, 4 tiros por segundo y buena precisión.
  - **Francotirador** (nuevo): 100 de daño base, un tiro y recarga larga (2,8 s). Mira con clic derecho que aleja la cámara y muestra una mira. Bala con viaje, muy rápida.
  - **Lanzacohetes / RPG** (nuevo): un cohete lento que explota en área (radio de unos 40 px, 70 de daño en el centro que baja hacia afuera). Rompe construcciones de un tiro (doble daño a las piezas). Recarga de 3 s. Es raro: solo épico o legendario.
- **Balas por tipo**: livianas (pistola y subfusil), medianas (rifle), pesadas (francotirador), cartuchos (escopeta) y cohetes. Aparecen en cajas de munición en el piso y salen de los cofres.
- **Cofres**: brillan, se abren manteniendo E durante 1 s y tiran un arma con rareza más alta de lo normal, más consumibles, balas y materiales. Hay más cofres en el reino del Queque.
- El servidor sigue validando que un objeto lo agarra uno solo (como hoy con `agarrar` y `propietarios`). Cada objeto del piso pasa a tener `rareza`.

### 4.7 Curarse y escudos con animación visible
- Las **vendas, el botiquín, el mini escudo y el escudo grande** tienen una **animación que ven todos**:
  - El personaje se queda quieto (o camina muy lento).
  - Pasa al estado `curando` (vendas y botiquín) o `escudando` (escudos). Hacé una pose en `persona3d`/`modelo3d` o reutilizá un clip parecido.
  - Tiene el objeto en la mano: un modelito simple de venda, valija de botiquín o frasco azul de escudo.
  - Un anillo de progreso sobre la cabeza y partículas: cruces verdes o burbujas azules.
- El estado viaja por la red como los gestos (`'g-<id>'`) para que lo vean los demás.
- Si te pegan, te movés rápido o cambiás de casillero, se cancela. Los tiempos y límites siguen los de hoy (`OBJETOS` en `inventario.js`).

### 4.8 HUD
- Abajo a la derecha: los 5 casilleros con el color de su rareza, el pico aparte y las balas del arma en la mano / reserva.
- Abajo a la izquierda: barras de vida y escudo.
- Arriba a la derecha:
  - el minimapa con los nombres de los lugares, la zona actual y la próxima;
  - jugadores vivos, tus bajas y el tiempo hasta que se cierre la zona.
- A la derecha: los materiales (madera, piedra, metal) con su cantidad.
- Al centro: la mira, que se abre según la dispersión.
- Avisos de baja ("Faur eliminó a Julo con Francotirador legendario").
- En el celular: joystick, botones de disparar, construir, agarrar (E), saltar del colectivo y elegir casillero.

### 4.9 Bots (`CerebroBot`)
- Que salten del colectivo a un lugar con nombre.
- Que junten botín con E, prefiriendo armas de mayor rareza.
- Que se curen escondidos.
- Que a veces construyan una pared para cubrirse cuando les disparan.
- Que usen el francotirador de lejos y la escopeta de cerca.
- Que sigan diciendo sus frases (`dichos.js`) al ganar, perder o eliminar a alguien.
- Sin trampas: tienen que poder perder.

## 5. Etapas (una por vez, en este orden)

1. **Nombre y mapa grande con lugares**: renombrar a Battle Shmitz y agrandar el mapa con los 8 lugares, caminos y obstáculos. Mapa grande con la tecla M, minimapa con nombres, cartel al entrar a un lugar, zona reescalada. Tests: el mapa es igual para la misma semilla, los lugares no se pisan y todo lo caminable es alcanzable.
2. **Colectivo y paracaídas**: recorrido por semilla, salto con Espacio, caída controlable, salto automático al final y bots que eligen dónde caer. Tests: posición del colectivo en función del tiempo y salto automático.
3. **Inventario nuevo y E automática**: 5 casilleros más el pico aparte, cambiar el objeto cuando está lleno, balas y materiales sin casillero, carteles flotantes con rareza. Validación en el servidor. Tests de `recoger`/cambio.
4. **Armas, rarezas, balas y cofres**: tabla nueva de armas más lentas, rarezas, francotirador con mira, RPG con explosión, tipos de balas y cofres. Tests de daño por rareza y daño en área.
5. **Pico y materiales**: golpear árboles, rocas y autos que se rompen, y juntar madera, piedra y metal con su máximo. Tests.
6. **Construcción de una sola capa**: paredes y escaleras en grilla, materiales, vida, armado de 1 s, rotura, prohibido apilar, ventaja de la escalera. Sincronización por red y lista en el servidor. Tests: no se puede poner una pieza encima de otra, costos y vida.
7. **Animaciones de curación y escudo**: estados `curando`/`escudando` visibles para todos, objeto en la mano, anillo de progreso y partículas, y cancelación al recibir daño.
8. **Bots y ajuste fino**: la IA de la sección 4.9, balance de daño y cadencia, rendimiento con 24 jugadores y prueba en el celular.

## 6. Condiciones para dar una etapa por terminada

- `npm test` pasa entero (los tests viejos actualizados donde cambió el diseño y los nuevos agregados).
- Funciona una partida con 1 persona y 15 bots, y otra con 2 navegadores reales más bots, sin errores en la consola.
- Si un jugador se desconecta y vuelve, ve el mismo mapa, las mismas construcciones y la misma zona.
- No se rompen los otros juegos ni el lobby del sitio (lo que esté en `shared/` lo usan todos los juegos: si lo tocás, que sea compatible).
- Todo el texto nuevo en español con voseo.

Empezá confirmando que entendiste el plan en 5 líneas y pedime los archivos de la **etapa 1**.
