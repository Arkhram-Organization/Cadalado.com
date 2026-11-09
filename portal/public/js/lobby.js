// Lobby de la portada (estilo Fortnite): tu personaje y un compañero del elenco en plataformas
// luminosas, el muro a la izquierda, el selector de juego y el botón de jugar a la derecha.
import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { NPCS, POR_ID } from '/comun/npcs.js';
import { lookParaDibujo, LOOK_BASE } from '/comun/look.js';
import { ruedaGestos } from '/comun/rueda-gestos.js';
import { JUEGOS } from './datos.js';
import { yo, esc, api } from './comun.js';

const $ = (s, r = document) => r.querySelector(s);
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export async function montarLobby(raiz) {
  const u = await yo().catch(() => null);
  const miNombre = u?.nombre || localStorage.getItem('cadalado.nombre') || 'Vos';
  const miLook = lookParaDibujo(u?.look || leer('cadalado.look', null) || LOOK_BASE);

  // ---------------- cuenta, arriba a la derecha
  const cuenta = $('[data-cuenta]', raiz);
  if (u) { cuenta.textContent = u.nombre; cuenta.href = '/club'; }

  // ---------------- selector de juego
  let modo = Math.max(0, JUEGOS.findIndex((j) => j.id === (localStorage.getItem('cadalado.modo') || 'royale')));
  const pintarModo = () => {
    const j = JUEGOS[modo];
    $('[data-modo-nombre]', raiz).textContent = j.nombre;
    $('[data-modo-linea]', raiz).textContent = j.linea;
    $('[data-jugar]', raiz).href = j.url;
    raiz.style.setProperty('--modo', j.color || '#f9e53b');
  };
  const lista = $('[data-modos]', raiz);
  lista.innerHTML = JUEGOS.map((j, i) => `<button data-i="${i}"><i style="background:${j.color}"></i><b>${esc(j.nombre)}</b><span>${esc(j.linea)}</span></button>`).join('');
  $('[data-cambiar]', raiz).onclick = () => (lista.hidden = !lista.hidden);
  lista.onclick = (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    modo = +b.dataset.i; localStorage.setItem('cadalado.modo', JUEGOS[modo].id);
    lista.hidden = true; pintarModo();
  };
  pintarModo();

  // ---------------- salas abiertas (arriba a la derecha) y chat del club (abajo a la izquierda)
  async function salas() {
    let n = 0;
    await Promise.all(JUEGOS.map(async (j) => { try { const d = await (await fetch(j.lobby)).json(); n += (d.salas || d.open || []).length; } catch {} }));
    $('[data-salas]', raiz).textContent = `${n} ${n === 1 ? 'sala abierta' : 'salas abiertas'}`;
  }
  const hora = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  async function chat() {
    try {
      const { mensajes } = await api('/api/club/chat?con=general');
      const ult = mensajes.slice(-3);
      $('[data-chat]', raiz).innerHTML = (ult.length ? ult : [{ ts: Date.now(), nombre: 'Club', texto: `${miNombre} entró al lobby.` }])
        .map((m) => `<p><span>[${hora(m.ts || m.t || Date.now())}]</span> <b>${esc(m.nombre || m.de || 'Club')}:</b> ${esc(m.texto)}</p>`).join('');
    } catch {}
  }
  salas(); chat();
  setInterval(() => { if (!document.hidden) { salas(); chat(); } }, 20000);

  // ---------------- escena 3D
  const canvas = $('[data-escena]', raiz);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#cfe3ff', '#1a2a55', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(-2, 6, -5); key.castShadow = true; escena.add(key);
  const rim = new THREE.DirectionalLight('#66d9ff', 2.2); rim.position.set(2, 3, 4); escena.add(rim);
  const camara = new THREE.PerspectiveCamera(30, 1, .1, 100);

  const plataforma = (x) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0); escena.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.95, 1.05, .16, 48), new THREE.MeshStandardMaterial({ color: '#16264f', roughness: .4, metalness: .3 }));
    base.position.y = -.08; base.receiveShadow = true; g.add(base);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(.97, .035, 10, 64), new THREE.MeshBasicMaterial({ color: '#4fe6ff' }));
    aro.rotation.x = Math.PI / 2; aro.position.y = .005; g.add(aro);
    const luz = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshBasicMaterial({ color: '#39c8ff', transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending }));
    luz.rotation.x = -Math.PI / 2; luz.position.y = .01; g.add(luz);
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(.85, .95, 2.6, 40, 1, true), new THREE.MeshBasicMaterial({ color: '#5fe0ff', transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    haz.position.y = 1.3; g.add(haz);
    return g;
  };
  // la cámara mira desde adelante: +x queda a la izquierda de la pantalla (vos a la izquierda, como en Fortnite)
  const puestos = [{ x: 1.25, quien: 'yo' }, { x: -1.35, quien: 'npc' }];
  for (const p of puestos) p.plat = plataforma(p.x);

  const companero = NPCS.filter((n) => n.look.modelo)[Math.floor(Math.random() * NPCS.filter((n) => n.look.modelo).length)] || NPCS[0];
  const yoP = crearPersona(THREE, miLook, { sombras: true });
  const npcP = crearPersona(THREE, { ...companero.look }, { sombras: true });
  yoP.grupo.position.x = puestos[0].x; npcP.grupo.position.x = puestos[1].x;
  yoP.grupo.rotation.y = .2; npcP.grupo.rotation.y = -.25;
  escena.add(yoP.grupo, npcP.grupo);

  // carteles con nombre y estado arriba de cada uno, y lugares libres para invitar
  const etiquetas = $('[data-etiquetas]', raiz);
  etiquetas.innerHTML = `<div class="fn-tag" data-tag="yo"><b>${esc(miNombre)}</b><span class="no">En el lobby</span></div>
    <div class="fn-tag" data-tag="npc"><b>${esc(companero.nombre)}</b><span class="si">Listo</span></div>
    <a class="fn-mas" data-mas="0" href="/club#amigos" title="Invitar amigos">+</a><a class="fn-mas" data-mas="1" href="/club#amigos" title="Invitar amigos">+</a>`;
  const proyectar = (v) => { const p = v.clone().project(camara); return [(p.x + 1) / 2 * canvas.clientWidth, (1 - p.y) / 2 * canvas.clientHeight]; };

  // girar tu personaje arrastrando; gestos con la B
  let giro = .2, arr = null;
  canvas.addEventListener('pointerdown', (e) => { arr = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (arr == null) return; giro += (e.clientX - arr) * .012; arr = e.clientX; });
  addEventListener('pointerup', () => (arr = null));
  ruedaGestos({ alElegir: (id) => yoP.gesto?.(id) });

  let ultimo = performance.now();
  function cuadro(ms) {
    requestAnimationFrame(cuadro);
    const dt = Math.min(.05, (ms - ultimo) / 1000); ultimo = ms;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
    }
    // encuadre: en pantallas angostas la cámara se aleja
    const angosto = w / h < 1;
    const lejos = angosto ? 10.5 : 10.8, cx = angosto ? 0 : .55; // en compu, el grupo se corre a la derecha del muro
    camara.position.set(cx, 1.8, -lejos); camara.lookAt(cx, 1.15, 0);
    yoP.grupo.rotation.y += (giro - yoP.grupo.rotation.y) * Math.min(1, dt * 8);
    yoP.animar('quieto', dt); npcP.animar('quieto', dt);
    renderer.render(escena, camara);
    for (const [k, p] of [['yo', yoP], ['npc', npcP]]) {
      const [x, y] = proyectar(new THREE.Vector3(p.grupo.position.x, 2.12, 0));
      const t = etiquetas.querySelector(`[data-tag="${k}"]`); t.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
    [2.95, -3.45].forEach((xx, i) => {
      const [x, y] = proyectar(new THREE.Vector3(xx, 1.1, 0));
      etiquetas.querySelector(`[data-mas="${i}"]`).style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });
  }
  requestAnimationFrame(cuadro);
}
