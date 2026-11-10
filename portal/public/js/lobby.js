// Lobby de la portada: un escenario de noche con todo el elenco en semicírculo y vos adelante,
// el muro a la izquierda, los juegos como entradas a la derecha y una cinta con el chat del club.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { NPCS } from '/comun/npcs.js';
import { lookParaDibujo, LOOK_BASE } from '/comun/look.js';
import { ruedaGestos } from '/comun/rueda-gestos.js';
import { frase } from '/comun/npcs.js';
import { JUEGOS } from './datos.js';
import { yo, esc, api, toast } from './comun.js';
import { montarGrupo } from './grupo.js';
import { lookDeNombre } from '/comun/avatar.js';

const $ = (s, r = document) => r.querySelector(s);
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export async function montarLobby(raiz) {
  const u = await yo().catch(() => null);
  const miNombre = u?.nombre || localStorage.getItem('cadalado.nombre') || 'Vos';
  const guardado = u?.look || leer('cadalado.look', null) || LOOK_BASE;
  const miLook = lookParaDibujo(guardado);
  const cuenta = $('[data-cuenta]', raiz);
  if (u) { cuenta.textContent = u.nombre; cuenta.href = '/club'; }

  // ---------------- entradas de los juegos
  let modo = Math.max(0, JUEGOS.findIndex((j) => j.id === (localStorage.getItem('cadalado.modo') || 'casino')));
  const entradas = $('[data-entradas]', raiz);
  // el casino va primero y grande (con la mesa de Dobro); cada juego con su imagen y su botón Jugar
  const orden = JUEGOS.map((j, i) => i).filter((i) => JUEGOS[i].id !== 'casino');
  const iCasino = JUEGOS.findIndex((j) => j.id === 'casino');
  if (iCasino >= 0) orden.unshift(iCasino);
  entradas.innerHTML = orden.map((i) => { const j = JUEGOS[i]; return `<div class="lb-entrada ${j.id === 'casino' ? 'grande' : ''}" data-i="${i}" style="--c:${j.color}" tabindex="0" role="button" aria-label="Ver ${esc(j.nombre)}">
      <span class="lb-img"><img src="${j.captura}" alt="" loading="lazy"><span class="lb-sala" data-sala="${j.id}"></span></span>
      <span class="lb-txt"><b>${esc(j.nombre)}</b><small>${esc(j.linea)}</small></span>
      <button class="lb-jugar-chico" data-jugar-juego="${i}">Jugar</button></div>`; }).join('');
  let grupoApi = null;
  const elegir = (i, desdeGrupo = false) => {
    if (!desdeGrupo && grupoApi?.grupo?.miembros.length > 1 && !grupoApi.grupo.soyLider) { toast('El líder elige el juego para toda la lobby.'); return false; }
    modo = i; localStorage.setItem('cadalado.modo', JUEGOS[i].id);
    if (!desdeGrupo) grupoApi?.elegirJuego(JUEGOS[i].id);
    entradas.querySelectorAll('.lb-entrada').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    $('[data-jugar]', raiz).href = JUEGOS[i].url;
    $('[data-jugar-nombre]', raiz).textContent = JUEGOS[i].nombre;
    // vista previa: el póster del juego de fondo, detrás de los personajes
    const fondo = $('[data-fondo]', raiz);
    if (fondo && JUEGOS[i].poster) {
      const capa = document.createElement('div');
      capa.className = 'lb-fondo-capa'; capa.style.backgroundImage = `url(${JUEGOS[i].poster})`;
      fondo.append(capa); requestAnimationFrame(() => capa.classList.add('ver'));
      while (fondo.children.length > 2) fondo.firstChild.remove();
    }
    return true;
  };
  entradas.onclick = (e) => {
    const jb = e.target.closest('[data-jugar-juego]');
    if (jb) { e.stopPropagation(); const i = +jb.dataset.jugarJuego; if(elegir(i)) return grupoApi?.jugar(JUEGOS[i].id, JUEGOS[i].url); return; }
    const b = e.target.closest('[data-i]'); if (b) elegir(+b.dataset.i);
  };
  entradas.onkeydown = (e) => { const b = e.target.closest('[data-i]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(+b.dataset.i); } };
  elegir(modo);

  // ---------------- salas abiertas y cinta con el chat del club
  async function salas() {
    let total = 0;
    await Promise.all(JUEGOS.map(async (j) => {
      try {
        const d = await (await fetch(j.lobby)).json();
        const n = (d.salas || d.open || []).length; total += n;
        const el = entradas.querySelector(`[data-sala="${j.id}"]`);
        if (el) el.textContent = n ? `${n} ${n === 1 ? 'sala' : 'salas'}` : '';
      } catch {}
    }));
    $('[data-salas]', raiz).textContent = total ? `${total} ${total === 1 ? 'sala abierta' : 'salas abiertas'}` : 'Sin salas: armá una';
  }
  async function cinta() {
    let items = [];
    try { items = (await api('/api/club/chat?con=general')).mensajes.slice(-8).map((m) => `<b>${esc(m.nombre || 'Club')}</b> ${esc(m.texto)}`); } catch {}
    items.push(...NPCS.slice(0, 6).map((n) => `<b>${esc(n.nombre)}</b> ${esc(frase(n.id))}`));
    const html = items.map((t) => `<span>${t}</span>`).join('<i>✦</i>');
    $('[data-cinta]', raiz).innerHTML = `<div>${html}<i>✦</i>${html}<i>✦</i></div>`;
  }
  salas(); cinta();
  setInterval(() => { if (!document.hidden) salas(); }, 20000);

  // ---------------- escenario 3D
  const canvas = $('[data-escena]', raiz);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const escena = new THREE.Scene();
  
  escena.add(new THREE.HemisphereLight('#e9f2d6', '#20241c', 1.6));
  const foco = new THREE.SpotLight('#fff6e0', 60, 20, .55, .6, 1.4); foco.position.set(0, 7, -3.5); foco.target.position.set(0, 0, .6); foco.castShadow = true; foco.shadow.mapSize.set(1024, 1024); escena.add(foco, foco.target);
  const lima = new THREE.PointLight('#c5f04a', .7, 2.5); lima.position.set(0, .15, -1.3); escena.add(lima);
  const contra = new THREE.DirectionalLight('#9ec3ff', .8); contra.position.set(3, 4, 6); escena.add(contra);
  // piso: oscuro, con anillos finos y un círculo lima para vos
  const piso = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: '#1b1f19', roughness: .9, transparent: true, opacity: .55 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; escena.add(piso);
  for (const r of [1.6, 3.2, 4.8]) {
    const a = new THREE.Mesh(new THREE.RingGeometry(r, r + .012, 96), new THREE.MeshBasicMaterial({ color: '#c5f04a', transparent: true, opacity: .16 }));
    a.rotation.x = -Math.PI / 2; a.position.set(0, .002, 1.2); escena.add(a);
  }
  const aro = new THREE.Mesh(new THREE.RingGeometry(.55, .62, 64), new THREE.MeshBasicMaterial({ color: '#c5f04a' }));
  aro.rotation.x = -Math.PI / 2; aro.position.set(0, .004, -.9); escena.add(aro);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(.95, 48), new THREE.MeshBasicMaterial({ color: '#c5f04a', transparent: true, opacity: .14, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.set(0, .003, -.9); escena.add(halo);
  const camara = new THREE.PerspectiveCamera(30, 1, .1, 60);

  // el elenco en semicírculo detrás tuyo; vos adelante, en el aro
  // en el celular, menos personajes y sin sombras (para que ande liviano)
  const chico = innerWidth < 860;
  if (chico) { renderer.shadowMap.enabled = false; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); }
  const elenco = []; // el escenario es para vos y tu lobby (sin el elenco de fondo)
  const personas = [];
  elenco.forEach((n, i) => {
    const k = elenco.length === 1 ? .5 : i / (elenco.length - 1);
    const ang = (k - .5) * 2.3;
    const p = crearPersona(THREE, { ...n.look }, { sombras: !chico, tamGlobo: .32 });
    p.grupo.position.set(Math.sin(ang) * 2.9, 0, Math.cos(ang) * 2.2 + .9);
    p.grupo.rotation.y = -ang * .35; // miran a cámara, un poco hacia el centro
    p.npc = n; escena.add(p.grupo); personas.push(p);
  });
  const yoP = crearPersona(THREE, { ...miLook, travesuras: {} }, { sombras: true, tamGlobo: .4, animacionesSincronizadas: true });
  yoP.grupo.position.set(0, 0, -.9); yoP.grupo.rotation.y = 0; escena.add(yoP.grupo);
  $('[data-yo-nombre]', raiz).textContent = miNombre;
  $('[data-yo-como]', raiz).textContent = guardado?.npc ? `Jugás como ${NPCS.find((n) => n.id === guardado.npc)?.nombre || ''}` : 'Tu personaje';

  // cada tanto alguien del elenco dice algo
  setInterval(() => {
    if (document.hidden || !personas.length) return;
    const p = personas[Math.floor(Math.random() * personas.length)];
    p.decir(frase(p.npc.id, Math.random, miNombre), 4);
  }, 6500);

  // tocar a alguien: dice algo; arrastrar: girar tu personaje
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let giro = 0, arr = null, movio = false;
  canvas.addEventListener('pointerdown', (e) => { arr = e.clientX; movio = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (arr == null) return; if (Math.abs(e.clientX - arr) > 2) movio = true; giro += (e.clientX - arr) * .012; arr = e.clientX; });
  canvas.addEventListener('pointerup', (e) => {
    arr = null;
    if (movio) return;
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camara);
    const toc = ray.intersectObjects(personas.map((p) => p.grupo), true)[0];
    if (!toc) return;
    const p = personas.find((x) => { let o = toc.object; while (o) { if (o === x.grupo) return true; o = o.parent; } return false; });
    if (p) { p.decir(frase(p.npc.id, Math.random, miNombre), 4); p.gesto?.(['saluda', 'festeja', 'baila'][Math.floor(Math.random() * 3)]); }
  });
  const QUE_HACE = { baila: '¡Bailando!', festeja: '¡Festejando!', saluda: '¡Hola!', voltereta: '¡Voltereta!', habla: 'Charlando…', flexiones: 'Haciendo flexiones', duerme: 'Zzz…', musculos: '¡Mirá estos músculos!' };
  ruedaGestos({ alElegir: (id) => { if (grupoApi?.grupo?.miembros.length > 1) grupoApi.gesto(id); else yoP.gesto?.(id); } });

  // ---------------- lobby compartida: los del grupo aparecen al lado tuyo
  const compas = new Map(); // nombre → persona
  const LUGARES = [[1.25, -.55], [-1.25, -.55], [2.3, -.1], [-2.3, -.1], [3.2, .4], [-3.2, .4], [3.9, 1]];
  function ponerCompas(g) {
    const propio = g?.miembros.find(m => m.yo);
    if (propio?.gesto) yoP.gestoPendiente = propio.gesto;
    const otros = (g?.miembros || []).filter((m) => !m.yo);
    const nombres = new Set(otros.map((m) => m.id || m.nombre));
    for (const [n, p] of compas) if (!nombres.has(n)) { escena.remove(p.grupo); p.dispose(); compas.delete(n); }
    otros.forEach((m, i) => {
      let p = compas.get(m.id || m.nombre);
      const firmaLook = JSON.stringify(m.look);
      if (p && p.firmaLook !== firmaLook) { escena.remove(p.grupo); p.dispose(); compas.delete(m.id || m.nombre); p = null; }
      if (!p) {
        p = crearPersona(THREE, { ...(m.look ? lookParaDibujo(m.look) : lookDeNombre(m.nombre)), travesuras: {} }, { animacionesSincronizadas: true, sombras: !chico, nombre: m.nombre + (m.lider ? ' ★' : ''), colorNombre: '#c5f04a', tamCartel: .32, tamGlobo: .32 });
        p.firmaLook = firmaLook; escena.add(p.grupo); compas.set(m.id || m.nombre, p);
        p.decir('¡Llegué!', 2.5);
      }
      // si hizo un gesto, se ve acá también (y qué está haciendo)
      if (m.gesto) p.gestoPendiente = m.gesto;
      const [x, z] = LUGARES[i % LUGARES.length];
      p.grupo.position.set(x, 0, z); p.grupo.rotation.y = -x * .12;
    });
    // el elenco se corre para atrás cuando hay gente
    personas.forEach((p) => (p.grupo.visible = otros.length < 3 || p.grupo.position.z > 2.2));
  }
  // lugares libres al lado tuyo con la flechita para sumar gente (abre las lobbys para invitar)
  const lugaresEl = $('[data-invitar-lugares]', raiz);
  let libres = [];
  function pintarLibres(g) {
    const ocupados = (g?.miembros || []).filter((m) => !m.yo).length;
    libres = [0, 1].map((k) => LUGARES[ocupados + k]).filter(Boolean);
    lugaresEl.innerHTML = libres.map((_, k) => `<button class="lb-mas" data-mas="${k}" title="Sumar a alguien a tu lobby"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></span><small>Invitar</small></button>`).join('');
    lugaresEl.querySelectorAll('[data-mas]').forEach((b) => (b.onclick = () => grupoApi.mostrar(true)));
  }
  const proyectar = new THREE.Vector3();
  const btnLobbys = $('[data-lobbys]', raiz);
  const jugarBtn = $('[data-jugar]', raiz);
  grupoApi = montarGrupo({
    usuario: u, nombre: () => miNombre,
    irA: (url) => (location.href = url),
    alCambiar: (g) => {
      ponerCompas(g);
      pintarLibres(g);
      const n = g?.miembros.length || 1;
      btnLobbys.querySelector('b').textContent = n > 1 ? n : '+';
      btnLobbys.classList.toggle('con-gente', n > 1);
      const lider = g?.miembros.find((m) => m.lider);
      const sigo = n > 1 && !g.soyLider;
      if (n > 1 && g.juego) { const i = JUEGOS.findIndex((j) => j.id === g.juego); if (i >= 0 && i !== modo) elegir(i, true); }
      jugarBtn.classList.toggle('esperando', sigo);
      jugarBtn.querySelector('small').textContent = sigo ? `Elige ${lider?.nombre || 'el líder'}` : n > 1 ? `Jugar con tu lobby (${n})` : 'Jugar a';
    },
  });
  btnLobbys.onclick = () => grupoApi.mostrar();
  jugarBtn.addEventListener('click', (e) => { e.preventDefault(); grupoApi.jugar(JUEGOS[modo].id, JUEGOS[modo].url); });

  let ultimo = performance.now();
  function cuadro(ms) {
    requestAnimationFrame(cuadro);
    const dt = Math.min(.05, (ms - ultimo) / 1000); ultimo = ms;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
    }
    const angosto = w / h < 1.05;
    const t = ms / 1000;
    // la cámara respira despacito alrededor del escenario
    camara.position.set(Math.sin(t * .08) * .6, angosto ? 2.6 : 2.2, angosto ? -10.5 : -8.4);
    camara.lookAt(0, angosto ? 1.05 : 1.15, .7);
    yoP.grupo.rotation.y += (giro - yoP.grupo.rotation.y) * Math.min(1, dt * 8);
    halo.material.opacity = .12 + Math.sin(t * 2) * .04;
    for (const p of [yoP, ...compas.values()]) { const g = p.gestoPendiente; if (g && g.ts !== p.ultimoGesto && (Date.now() + (grupoApi?.grupo?.relojOffset || 0)) >= g.ts) { p.ultimoGesto = g.ts; if ((Date.now() + (grupoApi?.grupo?.relojOffset || 0)) - g.ts < 1800) p.gesto?.(g.id); } }
    yoP.animar('quieto', dt);
    for (const p of personas) p.animar('quieto', dt);
    for (const p of compas.values()) p.animar('quieto', dt);
    renderer.render(escena, camara);
    libres.forEach(([x, z], k) => {
      const b = lugaresEl.children[k];
      if (!b) return;
      proyectar.set(x, .95, z).project(camara);
      b.style.transform = `translate(${((proyectar.x + 1) / 2) * w}px, ${((1 - proyectar.y) / 2) * h}px) translate(-50%, -50%)`;
    });
  }
  requestAnimationFrame(cuadro);
}
