// Avatares dibujados (SVG) de personas: busto con cara, pelo, ropa y accesorios.
// Usan el mismo "look" que los muñecos 3D (ver npcs.js), así cada personaje se reconoce en todos los juegos.
import { POR_ID, LOOKS_EXTRA, rngNpc } from './npcs.js';
import { lookParaDibujo } from './look.js';

// Look para una persona real (sale de su id, con el color que eligió).
export function lookDeId(id, color = '#7aa2ff') {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rngNpc(h);
  const de = (l) => l[Math.floor(r() * l.length)];
  return {
    piel: de(['#f0cfb4', '#e8c4a8', '#d9a982', '#b98463', '#8d5b3e']),
    pelo: { estilo: de(['corto', 'corto', 'rulos', 'largo', 'poco']), color: de(['#1e1610', '#3b2a1e', '#6b4226', '#c49a5a', '#141414']) },
    ojos: '#1b1410',
    cuerpo: de(['flaco', 'normal', 'normal', 'gordito']),
    ropa: { remera: color, pantalon: '#2b2b33' },
  };
}

// Look de una persona en una sala: el personaje que armó en /personaje, o uno que sale de su id.
export const lookDeJugador = (j, id, color) => (j?.look ? lookParaDibujo(j.look) : lookDeId(id, color));

// Look de un bot por su nombre (NPC del club o personaje extra de los memes).
export function lookDeNombre(nombre) {
  const n = String(nombre || '').trim().replace(/\s\d+$/, ''); // un bot repetido ("Dobro 2") es el mismo personaje
  const npc = Object.values(POR_ID).find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  if (npc) return { ...npc.look }; // el smoking de Dobro es solo para el casino
  return LOOKS_EXTRA[n] || lookDeId(n, '#9be15d');
}

const oscurecer = (hex, k = 0.75) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

// SVG cuadrado (viewBox 100x100): fondo redondo de color, hombros con la remera y la cabeza.
export function avatarSvg(look = {}, { fondo = null, titulo = '' } = {}) {
  const L = { piel: '#e8c4a8', pelo: { estilo: 'corto', color: '#2b1d14' }, ojos: '#1b1410', cuerpo: 'normal', ropa: { remera: '#7aa2ff' }, ...look };
  const remera = L.smoking ? '#141416' : L.ropa?.remera || '#7aa2ff';
  const piel = L.piel;
  const pelo = L.pelo?.color || '#222';
  const est = L.pelo?.estilo || 'corto';
  const ancho = { flaco: 30, normal: 34, gordito: 40 }[L.cuerpo] || 34;
  const bg = fondo || oscurecer(remera, 0.55);
  const cx = 50;
  const cy = 44; // centro de la cabeza
  const rx = L.cuerpo === 'gordito' ? 22 : 20;
  const ry = 22;
  let s = '';
  // hombros
  s += `<path d="M${cx - ancho} 100 Q${cx - ancho} ${70} ${cx} ${68} Q${cx + ancho} ${70} ${cx + ancho} 100 Z" fill="${remera}"/>`;
  if (L.smoking) s += `<path d="M44 70 L50 86 L56 70 Z" fill="#f4f4ee"/><rect x="45" y="70" width="10" height="4" rx="2" fill="#0b0b0b"/>`;
  if (L.ropa?.franja && !L.smoking) s += `<rect x="${cx - ancho + 4}" y="84" width="${ancho * 2 - 8}" height="5" fill="${L.ropa.franja}"/>`;
  const cap = !L.smoking && L.capucha;
  if (!L.smoking && L.ropa?.estampado === 'cuadros') {
    // camisa a cuadros: franjas cruzadas semitransparentes del color de la remera sobre blanco
    s += `<path d="M${cx - ancho} 100 Q${cx - ancho} 70 ${cx} 68 Q${cx + ancho} 70 ${cx + ancho} 100 Z" fill="#f3f1ec"/>`;
    for (let x = cx - ancho; x < cx + ancho; x += 8) s += `<rect x="${x}" y="68" width="4" height="32" fill="${remera}" opacity=".55"/>`;
    for (let y = 70; y < 100; y += 8) s += `<rect x="${cx - ancho}" y="${y}" width="${ancho * 2}" height="4" fill="${remera}" opacity=".55"/>`;
  }
  if (L.campera && !L.smoking) s += `<path d="M${cx - ancho} 100 Q${cx - ancho} 70 ${cx - 6} 68 L${cx - 10} 100Z M${cx + ancho} 100 Q${cx + ancho} 70 ${cx + 6} 68 L${cx + 10} 100Z" fill="${L.campera}"/>`;
  if ((L.polo || L.camisa) && !L.smoking) {
    s += `<path d="M${cx - 9} 68 L${cx - 1} 76 L${cx - 2} 68Z M${cx + 9} 68 L${cx + 1} 76 L${cx + 2} 68Z" fill="${oscurecer(remera, 0.82)}"/>`;
    for (let i = 0; i < (L.camisa ? 4 : 2); i++) s += `<circle cx="${cx}" cy="${79 + i * 6}" r="1" fill="${L.camisa ? '#f4f1ea' : '#0b0b0b'}"/>`;
  }
  if (cap) s += `<path d="M${cx - 4} 74 v12 M${cx + 4} 74 v12" stroke="#eeeae0" stroke-width="1.4"/>`;
  if (L.mochila) s += `<path d="M${cx - ancho + 9} 100 L${cx - ancho + 11} 70 M${cx + ancho - 9} 100 L${cx + ancho - 11} 70" stroke="${L.mochila}" stroke-width="4"/>`;
  if (L.camara) s += `<path d="M${cx - 12} 70 L${cx + 2} 90" stroke="#111" stroke-width="1.6"/><rect x="${cx - 4}" y="88" width="14" height="9" rx="2" fill="#18181b"/><circle cx="${cx + 3}" cy="92.5" r="3.2" fill="#3a5f86" stroke="#0b0b0b" stroke-width="1.2"/>`;
  if (L.capa) s += `<path d="M${cx - ancho - 2} 100 Q${cx - ancho} 72 ${cx - 14} 70 L${cx - 18} 100Z M${cx + ancho + 2} 100 Q${cx + ancho} 72 ${cx + 14} 70 L${cx + 18} 100Z" fill="${L.capa}"/>`;
  if (cap) s += `<ellipse cx="${cx}" cy="${cy + 2}" rx="${rx + 8}" ry="${ry + 9}" fill="${oscurecer(L.capucha, 0.85)}"/>`;
  // pelo de atrás (largo)
  if (est === 'largo') s += `<path d="M${cx - rx - 3} ${cy - 4} Q${cx - rx - 6} ${cy + 30} ${cx - rx + 2} ${cy + 32} L${cx + rx - 2} ${cy + 32} Q${cx + rx + 6} ${cy + 30} ${cx + rx + 3} ${cy - 4} Z" fill="${pelo}"/>`;
  // orejas y cabeza
  if (!L.robot) s += `<circle cx="${cx - rx}" cy="${cy + 2}" r="4.5" fill="${piel}"/><circle cx="${cx + rx}" cy="${cy + 2}" r="4.5" fill="${piel}"/>`;
  s += L.robot ? `<rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" rx="10" fill="${piel}" stroke="#5d6773" stroke-width="2"/>` : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${piel}"/>`;
  // pelo de arriba
  const top = `M${cx - rx - 1} ${cy - 2}`;
  if (est === 'corto' || est === 'largo') s += `<path d="${top} Q${cx - rx} ${cy - ry - 8} ${cx} ${cy - ry - 3} Q${cx + rx} ${cy - ry - 8} ${cx + rx + 1} ${cy - 2} Q${cx + rx - 4} ${cy - 14} ${cx + 4} ${cy - 15} Q${cx - 10} ${cy - 15} ${cx - rx + 3} ${cy - 6} Z" fill="${pelo}"/>`;
  else if (est === 'rapado') s += `<path d="${top} Q${cx - rx} ${cy - ry - 6} ${cx} ${cy - ry - 1} Q${cx + rx} ${cy - ry - 6} ${cx + rx + 1} ${cy - 2} Q${cx + rx - 5} ${cy - 12} ${cx} ${cy - 13} Q${cx - rx + 5} ${cy - 12} ${cx - rx - 1} ${cy - 2}Z" fill="${pelo}" opacity=".5"/>`;
  else if (est === 'entradas') s += `<path d="${top} Q${cx - rx} ${cy - ry - 7} ${cx} ${cy - ry - 2} Q${cx + rx} ${cy - ry - 7} ${cx + rx + 1} ${cy - 2} Q${cx + rx - 3} ${cy - 10} ${cx + 10} ${cy - 14} Q${cx + 4} ${cy - 19} ${cx} ${cy - 18} Q${cx - 4} ${cy - 19} ${cx - 10} ${cy - 14} Q${cx - rx + 3} ${cy - 10} ${cx - rx - 1} ${cy - 2}Z" fill="${pelo}"/>`;
  else if (est === 'rulosCorto') {
    s += `<path d="${top} Q${cx - rx} ${cy - ry - 6} ${cx} ${cy - ry - 1} Q${cx + rx} ${cy - ry - 6} ${cx + rx + 1} ${cy - 2} Q${cx + rx - 4} ${cy - 14} ${cx} ${cy - 16} Q${cx - rx + 4} ${cy - 14} ${cx - rx - 1} ${cy - 2}Z" fill="${pelo}" opacity=".85"/>`;
    for (const [dx, dy] of [[-10, -20], [-3, -23], [5, -23], [11, -19], [0, -17], [-7, -15], [8, -15]]) s += `<circle cx="${cx + dx}" cy="${cy + dy}" r="5" fill="${pelo}"/>`;
  }
  else if (est === 'poco') s += `<path d="M${cx - rx - 1} ${cy + 4} Q${cx - rx - 2} ${cy - 10} ${cx - rx + 6} ${cy - 14} L${cx - rx + 6} ${cy + 2} Z M${cx + rx + 1} ${cy + 4} Q${cx + rx + 2} ${cy - 10} ${cx + rx - 6} ${cy - 14} L${cx + rx - 6} ${cy + 2} Z" fill="${pelo}"/>`;
  else if (est === 'rulos' || est === 'rulosPoco') {
    const n = est === 'rulos' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      s += `<circle cx="${cx + Math.cos(a) * (rx - 2)}" cy="${cy - 6 + Math.sin(a) * (ry - 2)}" r="${est === 'rulos' ? 7 : 5}" fill="${pelo}"/>`;
    }
  }
  // cara
  // ojos con blanco, iris, pupila y brillo; nariz; labios
  const iris = L.robot ? '#38d9e6' : L.ojos || '#5a3a22';
  for (const dx of [-7.5, 7.5]) {
    s += `<ellipse cx="${cx + dx}" cy="${cy + 1}" rx="4.6" ry="3.4" fill="#f8f5f0"/>`;
    s += `<circle cx="${cx + dx}" cy="${cy + 1.2}" r="2.5" fill="${iris}"/><circle cx="${cx + dx}" cy="${cy + 1.2}" r="1.2" fill="#0b0b0b"/><circle cx="${cx + dx + 0.9}" cy="${cy + 0.3}" r=".7" fill="#fff"/>`;
    s += `<path d="M${cx + dx - 4.8} ${cy - 0.4} Q${cx + dx} ${cy - 3.8} ${cx + dx + 4.8} ${cy - 0.4}" stroke="#2a1d16" stroke-width="1.1" fill="none"/>`;
  }
  if (!L.robot) {
    s += `<path d="M${cx} ${cy + 2} Q${cx - 2.6} ${cy + 8} ${cx - 2.2} ${cy + 9} Q${cx} ${cy + 10.2} ${cx + 2.2} ${cy + 9}" stroke="${oscurecer(piel, 0.7)}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  }
  s += `<path d="M${cx - 2.2} ${cy - 6.5}" />`;
  const ceja = L.barba || (est === 'calvo' ? oscurecer(piel, 0.6) : pelo);
  s += `<path d="M${cx - 12} ${cy - 5} Q${cx - 7.5} ${cy - 7.5} ${cx - 3} ${cy - 5.5} M${cx + 12} ${cy - 5} Q${cx + 7.5} ${cy - 7.5} ${cx + 3} ${cy - 5.5}" stroke="${ceja}" stroke-width="${est === 'calvo' ? 1.3 : 2}" fill="none" stroke-linecap="round"/>`;
  if (L.barba) s += `<g opacity="${L.barbaCorta ? 0.75 : 1}"><path d="M${cx - rx + 2} ${cy + 6} Q${cx - rx + 2} ${cy + ry + 6} ${cx} ${cy + ry + 6} Q${cx + rx - 2} ${cy + ry + 6} ${cx + rx - 2} ${cy + 6} Q${cx + 8} ${cy + 16} ${cx} ${cy + 16} Q${cx - 8} ${cy + 16} ${cx - rx + 2} ${cy + 6}Z" fill="${L.barba}"/><path d="M${cx - 6} ${cy + 12} Q${cx} ${cy + 10} ${cx + 6} ${cy + 12}" stroke="${L.barba}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
  s += `<path d="M${cx - 4.5} ${cy + 13.5} Q${cx} ${cy + 12.2} ${cx + 4.5} ${cy + 13.5} Q${cx} ${cy + 16.4} ${cx - 4.5} ${cy + 13.5}Z" fill="#b9675e"/>`;
  // accesorios
  if (L.lentes) {
    const vidrio = L.lentesClaros ? `fill="#dff0f5" fill-opacity=".25"` : 'fill="none"';
    s += L.lentesForma === 'cuadrada'
      ? `<g stroke="${L.lentes}" stroke-width="2.2" ${vidrio}><rect x="${cx - 14}" y="${cy - 4}" width="12" height="9.5" rx="2.5"/><rect x="${cx + 2}" y="${cy - 4}" width="12" height="9.5" rx="2.5"/><path d="M${cx - 2} ${cy}h4" fill="none"/></g>`
      : `<g stroke="${L.lentes}" stroke-width="2" ${vidrio}><circle cx="${cx - 7.5}" cy="${cy + 1}" r="6"/><circle cx="${cx + 7.5}" cy="${cy + 1}" r="6"/><path d="M${cx - 1.5} ${cy + 1}h3" fill="none"/></g>`;
  }
  // capucha puesta: el borde tapa la frente y los costados
  if (cap) s += `<path d="M${cx - rx - 7} ${cy + 22} Q${cx - rx - 9} ${cy - ry - 12} ${cx} ${cy - ry - 11} Q${cx + rx + 9} ${cy - ry - 12} ${cx + rx + 7} ${cy + 22} L${cx + rx + 1} ${cy + 20} Q${cx + rx + 2} ${cy - ry - 3} ${cx} ${cy - ry - 3} Q${cx - rx - 2} ${cy - ry - 3} ${cx - rx - 1} ${cy + 20}Z" fill="${L.capucha}"/>`;
  if (L.antifaz) s += `<rect x="${cx - rx + 1}" y="${cy - 5}" width="${rx * 2 - 2}" height="10" rx="5" fill="${L.antifaz}" opacity=".9"/><ellipse cx="${cx - 7.5}" cy="${cy}" rx="3" ry="3" fill="#fff"/><ellipse cx="${cx + 7.5}" cy="${cy}" rx="3" ry="3" fill="#fff"/>`;
  if (L.kipa) s += `<path d="M${cx - 13} ${cy - ry + 4} Q${cx} ${cy - ry - 9} ${cx + 13} ${cy - ry + 4} Z" fill="${L.kipa}"/>`;
  if (L.gorra) s += `<path d="M${cx - rx - 1} ${cy - 4} Q${cx - rx} ${cy - ry - 9} ${cx} ${cy - ry - 8} Q${cx + rx} ${cy - ry - 9} ${cx + rx + 1} ${cy - 4}Z" fill="${L.gorra}"/><path d="M${cx - rx + 2} ${cy - 5} Q${cx} ${cy - 1} ${cx + rx + 12} ${cy - 6} L${cx + rx + 10} ${cy - 3} Q${cx} ${cy + 2} ${cx - rx + 2} ${cy - 2}Z" fill="${oscurecer(L.gorra, 0.8)}"/>`;
  if (L.sombrero) s += `<rect x="${cx - rx - 8}" y="${cy - ry - 2}" width="${rx * 2 + 16}" height="5" rx="2" fill="${L.sombrero}"/><rect x="${cx - 13}" y="${cy - ry - 14}" width="26" height="13" rx="3" fill="${L.sombrero}"/>`;
  if (L.auriculares) s += `<path d="M${cx - rx - 2} ${cy + 2} Q${cx - rx} ${cy - ry - 8} ${cx} ${cy - ry - 7} Q${cx + rx} ${cy - ry - 8} ${cx + rx + 2} ${cy + 2}" stroke="${L.auriculares}" stroke-width="3.5" fill="none"/><rect x="${cx - rx - 6}" y="${cy - 4}" width="7" height="12" rx="3" fill="${L.auriculares}"/><rect x="${cx + rx - 1}" y="${cy - 4}" width="7" height="12" rx="3" fill="${L.auriculares}"/>`;
  if (L.robot) s += `<path d="M${cx} ${cy - ry} v-8" stroke="#8a96a3" stroke-width="2"/><circle cx="${cx}" cy="${cy - ry - 9}" r="3" fill="#ff6b5b"/>`;
  const brillo = L.dorado ? `<circle cx="50" cy="50" r="47" fill="none" stroke="#f2c94c" stroke-width="5"/>` : '';
  const clave = encodeURIComponent(JSON.stringify(L));
  const clip = `retrato-${++numeroAvatar}`;
  return `<svg viewBox="0 0 100 100" class="avatar-svg" data-retrato-3d="${clave}" data-fondo="${bg}" role="img" aria-label="${String(titulo).replace(/[&<>"']/g, '')}"><defs><clipPath id="${clip}"><circle cx="50" cy="50" r="48"/></clipPath></defs><circle cx="50" cy="50" r="48" fill="${bg}"/><g clip-path="url(#${clip})">${s}</g>${brillo}</svg>`;
}

let numeroAvatar = 0;

// Cada avatar es una foto del mismo muñeco que aparece en la isla, la carrera y las mesas.
// Se conserva el SVG inmediato como fallback accesible si WebGL no está disponible.
// Un único contexto y caché compartidos evitan abrir un renderer por cada jugador.
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const pendientes = new Set(), cache = new Map();
  let ocupado = false, motor = null, fallido = false;
  async function procesar() {
    if (ocupado || fallido || !pendientes.size) return;
    ocupado = true;
    try {
      if (!motor) {
        const [THREE, { crearPersona }] = await Promise.all([import('./vendor/three.module.min.js'), import('./persona3d.js')]);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(256, 256); renderer.setPixelRatio(1); renderer.setClearColor(0, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
        const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#f7f0e5', '#5e6874', 2.4));
        const luz = new THREE.DirectionalLight('#fff0dc', 3.1); luz.position.set(-3, 5, -4); scene.add(luz);
        const relleno = new THREE.DirectionalLight('#c1d9ff', 1.9); relleno.position.set(4, 3, 2); scene.add(relleno);
        const camara = new THREE.OrthographicCamera(-.60, .60, .60, -.60, .1, 20);
        camara.position.set(1.6, 1.8, -5); camara.lookAt(0, 1.36, 0);
        motor = { THREE, crearPersona, renderer, scene, camara };
        renderer.domElement.addEventListener('webglcontextlost', () => { fallido = true; });
      }
      // Una foto por cuadro: entrar a una sala poblada no congela los controles.
      const el = pendientes.values().next().value; pendientes.delete(el);
      if (el?.isConnected && el.dataset.retrato3d) {
        const key = el.dataset.retrato3d;
        let url = cache.get(key);
        if (!url) {
          const p = motor.crearPersona(motor.THREE, JSON.parse(decodeURIComponent(key)), { sombras: false });
          await p.listo; // los del elenco con modelo propio esperan sus texturas
          motor.scene.add(p.grupo); p.animar('quieto', 0); p.grupo.updateMatrixWorld(true);
          // encuadre centrado en la cabeza (cada modelo tiene la cabeza a su altura)
          const caja = new motor.THREE.Box3().setFromObject(p.cabeza);
          // los modelos de Meshy tienen la cabeza como un punto en el hueso (base del cráneo)
          const c = caja.isEmpty() ? p.cabeza.getWorldPosition(new motor.THREE.Vector3()).add(new motor.THREE.Vector3(0, .17, 0)) : caja.getCenter(new motor.THREE.Vector3());
          motor.camara.position.set(c.x + 1.6, c.y + .29, c.z - 5); motor.camara.lookAt(c.x, c.y - .15, c.z);
          motor.renderer.render(motor.scene, motor.camara); url = motor.renderer.domElement.toDataURL('image/png');
          p.dispose(); cache.set(key, url);
          if (cache.size > 128) cache.delete(cache.keys().next().value);
        }
        const clip = `retrato-${++numeroAvatar}`, bg = el.dataset.fondo || '#414c47';
        el.innerHTML = `<defs><clipPath id="${clip}"><circle cx="50" cy="50" r="48"/></clipPath><radialGradient id="${clip}-luz" cx="35%" cy="20%" r="80%"><stop stop-color="#aaa998"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#${clip}-luz)"/><image href="${url}" width="100" height="100" clip-path="url(#${clip})"/>`;
        delete el.dataset.retrato3d;
      }
    } catch (e) {
      // Mantener el retrato vectorial en equipos sin WebGL.
      fallido = true; motor?.renderer.dispose(); console.info('Retratos: se usa la versión vectorial.', e.message);
    } finally { ocupado = false; if (pendientes.size && !fallido) requestAnimationFrame(procesar); }
  }
  const visible = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { pendientes.add(e.target); visible.unobserve(e.target); }
    procesar();
  }, { rootMargin: '200px' }) : null;
  function buscar(root) {
    const lista = [];
    if (root.matches?.('[data-retrato-3d]')) lista.push(root);
    root.querySelectorAll?.('[data-retrato-3d]').forEach(e => lista.push(e));
    for (const el of lista) { if (visible) visible.observe(el); else pendientes.add(el); }
    if (!visible) procesar();
  }
  new MutationObserver(registros => {
    for (const r of registros) for (const n of r.addedNodes) if (n.nodeType === 1) buscar(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  buscar(document);
}
