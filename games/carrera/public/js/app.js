import { Sala, marco, api, pid, esc, toast, sonar, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { Escena } from './escena.js';
import { Jugador } from './fisica.js';
import { Red } from './red.js';
import { rutaBot, posBot, COLORES, NOMBRES_BOT, CHECKPOINTS, META_Z } from './pista.js';

const app = document.querySelector('#app');
const COLOR = '#4fd1c5';
const cuenta = await marco({ juego: 'Carrera loca', color: COLOR, volver: '/carrera/' });
let limpiar = [];

function ir(ruta) {
  history.pushState(null, '', ruta);
  ruteo();
}
window.addEventListener('popstate', ruteo);
app.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ir]');
  if (!a) return;
  e.preventDefault();
  ir(a.getAttribute('href'));
});
function ruteo() {
  limpiar.forEach((f) => f());
  limpiar = [];
  document.body.classList.remove('en-carrera');
  const m = location.pathname.match(/^\/carrera\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else menu();
}

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Carrera loca · cadalado';
  app.innerHTML = `
  <div class="menu">
    <div class="menu-hero"><div><span class="etq">Carrera de obstáculos 3D · hasta 16</span><h1>Carrera <em>loca.</em></h1>
      <p>Barras que giran, plataformas sobre el agua, martillos, puertas falsas y una rampa con bolas. Llegá primero a la meta.</p></div></div>
    <section class="panel">
      <h2>Armar una carrera</h2>
      <form data-crear style="display:grid;gap:12px">
        ${cuenta ? '' : `<label><span class="etq">Tu nombre</span><input class="entrada" name="nombre" maxlength="20" required value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?"></label>`}
        <label><span class="etq">Bots para completar</span><select class="entrada" name="bots">${[0, 3, 5, 7, 9, 11].map((n) => `<option ${n === 7 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="publica" checked style="accent-color:${COLOR};width:18px;height:18px"> Pública (cualquiera puede entrar)</label>
        <button class="btn btn-lima btn-grande">Crear carrera</button>
      </form>
    </section>
    <section class="panel">
      <h2>Entrar a una carrera</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Entrar</button></form>
      <h2 style="margin-top:22px">Carreras abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
    </section>
  </div>`;
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(f.get('nombre'));
    try {
      const { code } = await api('/api/carrera/crear', { pid: pid(), nombre: f.get('nombre'), opciones: { bots: Number(f.get('bots')), publica: f.get('publica') === 'on' } });
      ir(`/carrera/sala/${code}`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/carrera/sala/${c}`);
  };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/carrera/lobby');
      const el = app.querySelector('[data-salas]');
      if (!el) return;
      el.innerHTML = salas.length
        ? salas.map((s) => `<a class="sala-fila" href="/carrera/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR}">${s.jugadores}</span>
          <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'En la largada, esperando' : s.fase === 'podio' ? 'En el podio' : 'Corriendo ahora'} · ${s.bots} bots</small></span>
          <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay carreras abiertas. ¡Armá una!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}

// ---------------------------------------------------------------- sala y carrera
function abrirSala(code) {
  document.title = `Carrera ${code} · cadalado`;
  document.body.classList.add('en-carrera');
  app.innerHTML = `
  <div class="juego">
    <canvas data-lienzo></canvas>
    <div class="capa hud-arriba">
      <div class="hud-chip"><span class="etq" style="color:#fff">Sala</span><b>${esc(code)}</b><button class="btn btn-chico" data-copiar>Invitar</button></div>
      <div class="hud-centro hidden" data-hud><div class="puesto" data-puesto>—</div><div class="cronometro" data-crono>0.00</div></div>
      <div class="hud-chip" data-red title="Conexión con los demás">● <span>—</span></div>
    </div>
    <div class="capa panel-flota hidden" data-lobby></div>
    <div class="capa cuenta" data-cuenta></div>
    <div class="capa aviso" data-aviso></div>
    <div class="capa panel-flota podio-flota hidden" data-podio></div>
    <div class="capa chat-mini"><div class="log" data-log></div><form data-chat><input class="entrada" maxlength="200" placeholder="Chat…" autocomplete="off"></form></div>
    <div class="capa tactil" data-tactil><div class="joy" data-joy><i></i></div><div class="botones-t"><button class="chico" data-boton="buceo">TIRARSE</button><button data-boton="salto">SALTAR</button></div></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const escena = new Escena($('[data-lienzo]'));
  escena.construirPista(1);

  let est = null;
  let fase = null;
  let semilla = 1;
  let jugador = new Jugador(1);
  let camYaw = 0;
  let enviadoMeta = false;
  let rutas = [];
  const remotos = new Map(); // id -> { obj (suavizado), meta (último recibido), t }
  const entrada = { x: 0, z: 0, salto: false, buceo: false };
  const yo = () => est?.yo;
  const nombreDe = (id) => est?.jugadores.find((j) => j.id === id)?.nombre || '';
  const colorDe = (id) => COLORES[est?.skins?.[id] ?? 0];

  const red = { actual: null };
  const sala = new Sala('/api/carrera', code, {
    intervalo: (e) => (e?.fase === 'carrera' ? 1500 : e?.fase === 'cuenta' ? 500 : 900),
    onEstado: (e) => {
      est = e;
      red.actual ??= new Red({ sala, code, miId: e.yo, alRecibir: recibir });
      red.actual.sincronizar(e.jugadores.filter((j) => j.online && j.id !== e.yo).map((j) => j.id));
      if (e.fase !== fase) cambioDeFase(e.fase);
      pintarPaneles();
    },
    onEvento: (ev) => {
      if (ev.k === 'senal') return red.actual?.senal(ev.de, ev.data);
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis';
        d.textContent = ev.texto;
      } else d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`;
      log.append(d);
      while (log.children.length > 30) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => toast(m, true),
    onNoExiste: () => {
      toast('Esa carrera no existe.', true);
      ir('/carrera/');
    },
  });
  recordar('carrera', `/carrera/sala/${code}`, `Carrera ${code}`);
  limpiar.push(() => {
    sala.cerrar();
    red.actual?.cerrar();
    cancelAnimationFrame(raf);
    escena.renderer.dispose();
  });

  function recibir(id, e) {
    let r = remotos.get(id);
    if (!r) remotos.set(id, (r = { obj: { ...e }, meta: e, t: e.t }));
    if (e.t < r.t - 0.05 && Math.abs(e.t - r.t) < 30) return; // llegó desordenado
    r.meta = e;
    r.t = e.t;
    r.visto = performance.now();
  }

  // ---------------------------------------------------------------- fases
  function cambioDeFase(nueva) {
    const antes = fase;
    fase = nueva;
    if ((nueva === 'cuenta' || nueva === 'carrera') && est.semilla !== semilla) {
      semilla = est.semilla;
      escena.construirPista(semilla);
      rutas = Array.from({ length: est.botsCarrera }, (_, i) => rutaBot(semilla, i));
    }
    if (nueva === 'cuenta' || (nueva === 'carrera' && antes === null)) {
      jugador = new Jugador(semilla);
      const i = Math.max(0, est.participantes.indexOf(yo()));
      jugador.ubicar(((i % 6) - 2.5) * 1.5, 0, -2 - Math.floor(i / 6) * 1.6);
      if (!est.participantes.includes(yo())) jugador.espectador = true;
      enviadoMeta = false;
      camYaw = 0;
    }
    if (nueva === 'lobby') {
      jugador = new Jugador(semilla);
      jugador.ubicar((Math.random() - 0.5) * 8, 0, -3 - Math.random() * 6);
      for (let i = 0; i < 16; i++) escena.quitar('bot' + i);
    }
    if (nueva === 'podio') sonar('gana');
    $('[data-hud]').classList.toggle('hidden', !(nueva === 'carrera' || nueva === 'cuenta'));
  }
  function pintarPaneles() {
    const e = est;
    const esHost = e.host === e.yo;
    // lobby
    const lob = $('[data-lobby]');
    lob.classList.toggle('hidden', e.fase !== 'lobby');
    if (e.fase === 'lobby') {
      const online = e.jugadores.filter((j) => j.online);
      const mio = e.skins[e.yo] ?? 0;
      lob.innerHTML = `<h2>En la largada</h2>
        <p>Mientras esperan, practicá en la plataforma. ${esHost ? 'Cuando estén todos, ¡largá!' : `Larga ${esc(nombreDe(e.host))}.`}</p>
        <div class="lista-j">${online.map((j) => `<div><i style="background:${colorDe(j.id)}"></i>${esc(j.nombre)}${j.id === e.yo ? ' (vos)' : ''}<small>${j.id === e.host ? 'arma' : ''}</small></div>`).join('')}
          ${e.bots ? `<div><i style="background:#888"></i>${e.bots} bots<small>completan</small></div>` : ''}</div>
        <span class="etq">Tu color</span>
        <div class="colores">${COLORES.map((c, i) => `<button style="background:${c}" class="${i === mio ? 'on' : ''}" data-color="${i}" aria-label="Color ${i + 1}"></button>`).join('')}</div>
        ${esHost ? `<div style="display:flex;gap:8px;align-items:center"><select class="entrada" data-bots style="width:auto">${[0, 3, 5, 7, 9, 11].map((n) => `<option ${n === e.bots ? 'selected' : ''} value="${n}">${n} bots</option>`).join('')}</select>
          <button class="btn btn-lima btn-grande" data-largar style="flex:1">¡Largar!</button></div>` : ''}
        <div class="teclas"><span><kbd>W A S D</kbd> / <kbd>flechas</kbd></span><span>moverse</span><span><kbd>Espacio</kbd></span><span>saltar</span>
          <span><kbd>Shift</kbd></span><span>tirarse de palomita</span><span>Arrastrá el mouse</span><span>girar la cámara</span></div>`;
      lob.querySelectorAll('[data-color]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'skin', color: Number(b.dataset.color) })));
      lob.querySelector('[data-bots]')?.addEventListener('change', (ev) => sala.enviar({ t: 'bots', n: Number(ev.target.value) }));
      lob.querySelector('[data-largar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
    }
    // podio
    const pod = $('[data-podio]');
    pod.classList.toggle('hidden', e.fase !== 'podio');
    if (e.fase === 'podio' && pod.dataset.carrera !== String(e.carreras)) {
      pod.dataset.carrera = e.carreras;
      const r = e.resultados;
      const top = [r[1], r[0], r[2]];
      const t = (ms) => (ms == null ? 'no llegó' : `${(ms / 1000).toFixed(2)} s`);
      const miPuesto = r.findIndex((x) => x.id === e.yo) + 1;
      pod.innerHTML = `<h2>${miPuesto === 1 ? '¡Ganaste! 🏆' : miPuesto ? `Llegaste ${miPuesto}º` : 'Resultados'}</h2>
        <div class="podio-top">${top.map((x, i) => (x ? `<div class="p${[2, 1, 3][i]}"><span style="font-size:28px">${['🥈', '🥇', '🥉'][i]}</span><b>${esc(x.nombre)}</b><span class="mono">${t(x.tiempo)}</span></div>` : '<div style="visibility:hidden"></div>')).join('')}</div>
        <div class="tabla-res">${r.map((x, i) => `<div class="${x.id === e.yo ? 'yo' : ''}"><b>${i + 1}º</b><span>${esc(x.nombre)}${x.bot ? ' 🤖' : ''}</span><span class="mono">${t(x.tiempo)}</span></div>`).join('')}</div>
        ${esHost ? '<button class="btn btn-lima btn-grande" data-otra style="width:100%;margin-top:14px">Otra carrera</button>' : '<p style="margin-top:12px">En unos segundos vuelven a la largada.</p>'}`;
      pod.querySelector('[data-otra]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
    }
  }

  // ---------------------------------------------------------------- controles
  const teclas = new Set();
  const abajo = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (k === 'Space' && !teclas.has(k)) entrada.salto = true;
    if ((k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyE') && !teclas.has(k)) entrada.buceo = true;
    teclas.add(k);
  };
  const arriba = (e) => teclas.delete(e.code);
  addEventListener('keydown', abajo);
  addEventListener('keyup', arriba);
  limpiar.push(() => {
    removeEventListener('keydown', abajo);
    removeEventListener('keyup', arriba);
  });
  // girar cámara arrastrando el mouse
  let arrastre = null;
  const lienzo = $('[data-lienzo]');
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') arrastre = e.clientX;
  });
  addEventListener('pointerup', () => (arrastre = null));
  addEventListener('pointermove', (e) => {
    if (arrastre == null) return;
    camYaw -= (e.clientX - arrastre) * 0.006;
    arrastre = e.clientX;
  });
  // táctil: joystick + botones
  const tactil = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  $('[data-tactil]').classList.toggle('ver', tactil);
  const joy = { id: null, x: 0, z: 0 };
  const joyEl = $('[data-joy]');
  joyEl.addEventListener('pointerdown', (e) => {
    joy.id = e.pointerId;
    joyEl.setPointerCapture(e.pointerId);
    moverJoy(e);
  });
  joyEl.addEventListener('pointermove', (e) => e.pointerId === joy.id && moverJoy(e));
  const soltar = () => {
    joy.id = null;
    joy.x = joy.z = 0;
    joyEl.querySelector('i').style.transform = '';
  };
  joyEl.addEventListener('pointerup', soltar);
  joyEl.addEventListener('pointercancel', soltar);
  function moverJoy(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const n = Math.hypot(dx, dy);
    if (n > 1) {
      dx /= n;
      dy /= n;
    }
    joy.x = dx;
    joy.z = -dy;
    joyEl.querySelector('i').style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  }
  app.querySelectorAll('[data-boton]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    entrada[b.dataset.boton] = true;
  }));

  $('[data-copiar]').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); } catch {}
    toast('Link de la carrera copiado');
  };
  $('[data-chat]').onsubmit = (e) => {
    e.preventDefault();
    const i = e.target.querySelector('input');
    if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value });
    i.value = '';
    i.blur();
  };

  function aviso(texto, malo = false) {
    $('[data-aviso]').innerHTML = `<span class="${malo ? 'malo' : ''}">${esc(texto)}</span>`;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => ($('[data-aviso]').innerHTML = ''), 1600);
  }

  // ---------------------------------------------------------------- bucle
  // para pruebas automáticas (no cambia nada del juego)
  window.__carrera = { get jugador() { return jugador; }, get remotos() { return remotos; }, get estado() { return est; } };
  let raf;
  let ultimo = performance.now();
  let acumulado = 0;
  let envio = 0;
  let ultimaCuenta = null;
  const reloj0 = performance.now();
  function cuadro(ahoraMs) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.1, (ahoraMs - ultimo) / 1000);
    ultimo = ahoraMs;
    if (!est) return escena.render(dt);
    const corriendo = fase === 'carrera' || fase === 'cuenta';
    // tiempo de la pista: el de la carrera (igual para todos) o uno local para practicar
    const t = corriendo ? (sala.ahora() - est.inicio) / 1000 : (ahoraMs - reloj0) / 1000;
    escena.actualizarMoviles(Math.max(0, t));

    // cuenta regresiva
    if (fase === 'cuenta' || (fase === 'carrera' && t < 1)) {
      const n = Math.ceil(-t);
      const txt = n > 0 && n <= 3 ? String(n) : t >= 0 && t < 1 ? '¡YA!' : '';
      if (txt !== ultimaCuenta) {
        ultimaCuenta = txt;
        $('[data-cuenta]').innerHTML = txt ? `<span>${txt}</span>` : '';
        if (txt) sonar(txt === '¡YA!' ? 'aviso' : 'tick');
      }
    } else if (ultimaCuenta) {
      ultimaCuenta = null;
      $('[data-cuenta]').innerHTML = '';
    }

    // mi personaje
    const puedeMover = !jugador.espectador && (fase === 'lobby' || fase === 'podio' || (fase === 'carrera' && t >= 0));
    entrada.x = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) + joy.x;
    entrada.z = (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) - (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) + joy.z;
    if (teclas.has('KeyQ')) camYaw += dt * 2;
    if (!jugador.espectador) {
      const otros = [...remotos.values()].map((r) => r.obj);
      acumulado += dt;
      while (acumulado >= 1 / 60) {
        acumulado -= 1 / 60;
        const ent = puedeMover ? entrada : { x: 0, z: 0 };
        const ev = jugador.paso(1 / 60, Math.max(0, t), ent, camYaw, otros);
        entrada.salto = entrada.buceo = false;
        for (const e of ev) {
          if (e === 'salto' || e === 'buceo') sonar('salto');
          if (e === 'golpe') sonar('clic');
          if (e === 'caida') aviso('¡Al agua! Volvés al último punto', true);
          if (e === 'puerta') aviso('Puerta falsa 🚪', true);
          if (e === 'checkpoint' && fase === 'carrera') aviso(`Punto de control: ${CHECKPOINTS[jugador.cp].nombre}`);
          if (e === 'meta' && fase === 'carrera' && !enviadoMeta) {
            enviadoMeta = true;
            sonar('gana');
            escena.confeti(jugador.x, jugador.y, jugador.z);
            aviso('¡LLEGASTE!');
            sala.enviar({ t: 'meta' });
          }
        }
      }
      // en el lobby la "meta" no cuenta: si llegás practicando, volvés a la largada
      if (fase !== 'carrera' && jugador.llego) {
        jugador.llego = false;
        jugador.ubicar(0, 0, -4);
      }
      escena.personaje(yo(), colorDe(yo()), nombreDe(yo()) + ' (vos)', true);
      escena.mover(yo(), jugador.estado(), dt);
      envio += dt;
      if (envio > 1 / 15) {
        envio = 0;
        red.actual?.enviar(jugador.estado(), t);
      }
    }

    // los demás jugadores (suavizado hacia la última posición recibida)
    for (const [id, r] of remotos) {
      const j = est.jugadores.find((x) => x.id === id);
      if (!j || !j.online || performance.now() - (r.visto || 0) > 6000) {
        escena.quitar(id);
        if (!j || !j.online) remotos.delete(id);
        continue;
      }
      escena.personaje(id, colorDe(id), j.nombre);
      const k = Math.min(1, dt * 12);
      const salto = Math.hypot(r.meta.x - r.obj.x, r.meta.z - r.obj.z) > 6;
      for (const c of ['x', 'y', 'z']) r.obj[c] = salto ? r.meta[c] : r.obj[c] + (r.meta[c] - r.obj[c]) * k;
      let d = r.meta.ry - r.obj.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      r.obj.ry += d * k;
      r.obj.a = r.meta.a;
      escena.mover(id, r.obj, dt);
    }

    // bots (iguales en todos los navegadores)
    if (corriendo) rutas.forEach((ruta, i) => {
      const id = 'bot' + i;
      escena.personaje(id, COLORES[(i + 5) % COLORES.length], NOMBRES_BOT[i % NOMBRES_BOT.length]);
      escena.mover(id, posBot(ruta, Math.max(0, t), semilla), dt);
    });

    // puesto y cronómetro
    if (corriendo) {
      const yoZ = jugador.espectador ? null : jugador.z;
      const avance = [];
      if (yoZ != null) avance.push({ id: yo(), z: est.llegadas[yo()] != null ? -1000 - (1e6 - est.llegadas[yo()]) / 1e6 : yoZ });
      for (const [id, r] of remotos) if (est.participantes.includes(id)) avance.push({ id, z: est.llegadas[id] != null ? -1000 - (1e6 - est.llegadas[id]) / 1e6 : r.obj.z });
      rutas.forEach((ruta, i) => avance.push({ id: 'bot' + i, z: t >= ruta.fin ? -1000 - (1e6 - ruta.fin * 1000) / 1e6 : posBot(ruta, Math.max(0, t), semilla).z }));
      avance.sort((a, b) => a.z - b.z);
      const p = avance.findIndex((a) => a.id === yo()) + 1;
      $('[data-puesto]').innerHTML = p ? `${p}º<small>/${avance.length}</small>` : '';
      const tt = est.llegadas[yo()] != null ? est.llegadas[yo()] / 1000 : Math.max(0, t);
      $('[data-crono]').textContent = `${tt.toFixed(2)} s`;
    }

    // estado de la red
    const c = red.actual?.estadoConexiones();
    if (c) $('[data-red]').innerHTML = c.total ? `<span style="color:${c.directas === c.total ? 'var(--lima)' : '#ffd166'}">●</span> ${c.directas}/${c.total} directas` : '<span style="color:var(--gris)">●</span> solo vos';

    // cámara: sigue a mi personaje; si estoy mirando, al que va primero
    let foco = jugador.estado();
    if (jugador.espectador) {
      const lider = [...remotos.values()].map((r) => r.obj).sort((a, b) => a.z - b.z)[0];
      foco = lider || (rutas[0] ? posBot(rutas[0], Math.max(0, t), semilla) : foco);
    }
    if (fase === 'podio') camYaw += dt * 0.25;
    escena.seguir(foco, camYaw, dt);
    escena.render(dt);
  }
  raf = requestAnimationFrame(cuadro);
}

ruteo();
