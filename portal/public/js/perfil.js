// Perfil: /perfil (el tuyo, editable) o /perfil?u=usuario (el de otro).
// Foto, portada, fondo, color, bio, estado, frase, lugar, juego favorito, tu personaje 3D y tus partidas.
import { JUEGOS } from './datos.js';
import { iniciarPagina, api, yo, esc, avatar, toast, hace } from './comun.js';
import { lookParaDibujo } from '/comun/look.js';
import { lookDeNombre } from '/comun/avatar.js';

iniciarPagina();
const $ = (s, r = document) => r.querySelector(s);
const juego = (id) => JUEGOS.find((j) => j.id === id);
const RESULTADO = { victoria: 'Victoria', derrota: 'Derrota', tablas: 'Tablas', abortada: 'Abortada' };
export const FONDOS = {
  lima: { nombre: 'Lima', css: 'radial-gradient(circle at 20% 120%, #c5f04a88, transparent 55%), radial-gradient(circle at 90% -20%, #8fb52a66, transparent 50%), linear-gradient(135deg, #1d2614, #121510)' },
  noche: { nombre: 'Noche', css: 'radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 20%, #fff, transparent), radial-gradient(1px 1px at 45% 60%, #fffc, transparent), radial-gradient(1px 1px at 85% 70%, #fff9, transparent), radial-gradient(circle at 80% 10%, #3b4f9a88, transparent 45%), linear-gradient(180deg, #0b1026, #1a1f3d)' },
  atardecer: { nombre: 'Atardecer', css: 'radial-gradient(circle at 50% 110%, #ffd27a, transparent 45%), linear-gradient(180deg, #2b1840 0%, #b8466a 55%, #ff9a5a 100%)' },
  cancha: { nombre: 'Cancha', css: 'repeating-linear-gradient(90deg, #6f8c56 0 60px, #7a9a5e 60px 120px)' },
  casino: { nombre: 'Casino', css: 'radial-gradient(circle at 50% -10%, #f2c94c88, transparent 50%), repeating-linear-gradient(45deg, #ffffff06 0 2px, transparent 2px 14px), linear-gradient(180deg, #3a0d12, #1a0607)' },
  oceano: { nombre: 'Océano', css: 'radial-gradient(circle at 30% 0%, #7ff3e888, transparent 50%), linear-gradient(180deg, #0f5c74, #082436)' },
  fuego: { nombre: 'Fuego', css: 'radial-gradient(circle at 50% 120%, #ffd04a, transparent 40%), radial-gradient(circle at 20% 110%, #ff6b2b, transparent 45%), linear-gradient(180deg, #1c0806, #6b1408)' },
  violeta: { nombre: 'Violeta', css: 'radial-gradient(circle at 80% 20%, #ff4fa388, transparent 45%), radial-gradient(circle at 10% 90%, #7aa2ff66, transparent 45%), linear-gradient(135deg, #24104a, #120a24)' },
};
const COLORES = ['#c5f04a', '#4fd1c5', '#7aa2ff', '#c084fc', '#ff4fa3', '#ff6b5b', '#ff7a45', '#f2c94c', '#f4f1ea'];
const imgUrl = (u, tipo) => `/api/club/perfil/imagen?usuario=${encodeURIComponent(u.usuario)}&tipo=${tipo}&v=${u.perfil[tipo]}`;

const quien = new URLSearchParams(location.search).get('u');
const yoMismo = await yo();
let datos = null; // lo que devuelve /perfil
let u = null; // usuario público (con su perfil)
let visor = null;

async function cargar() {
  const usuario = quien || yoMismo?.usuario;
  if (!usuario) {
    $('[data-pf-estado]').innerHTML = `<b>Entrá para tener tu perfil</b>Con cuenta podés poner foto, portada, bio y mostrar tu personaje.
      <div class="btns"><a class="btn btn-lima" href="/entrar?volver=/perfil">Entrar o crear cuenta</a></div>`;
    return;
  }
  try {
    datos = await api('/api/club/perfil?usuario=' + encodeURIComponent(usuario));
  } catch (e) {
    $('[data-pf-estado]').innerHTML = `<b>No encontramos ese perfil</b>${esc(e.message)}`;
    return;
  }
  u = datos.usuario;
  document.title = `${u.nombre} · cadalado`;
  $('[data-pf-estado]').classList.add('hidden');
  $('[data-pf-contenido]').classList.remove('hidden');
  pintar();
}

const esMio = () => datos?.relacion === 'yo';

function pintar(p = u.perfil) {
  const raiz = $('[data-pf]');
  raiz.style.setProperty('--acento', p.color);
  // portada
  const portada = $('[data-portada]');
  portada.style.backgroundImage = p.portada ? `linear-gradient(transparent 55%, #141413cc), url("${imgUrl(u, 'portada')}")` : FONDOS[p.fondo]?.css || FONDOS.lima.css;
  portada.classList.toggle('con-imagen', !!p.portada);
  portada.dataset.fondo = p.fondo;
  // foto: la tuya, o la cara de tu personaje, o tus iniciales
  const foto = $('[data-foto]');
  foto.querySelectorAll('img, canvas, .avatar').forEach((e) => e.remove());
  if (p.foto) foto.insertAdjacentHTML('afterbegin', `<img src="${imgUrl(u, 'foto')}" alt="">`);
  else {
    foto.insertAdjacentHTML('afterbegin', avatar(u.nombre));
    import('/comun/caras3d.js').then(async (m) => {
      const c = await m.caraRedonda(lookParaDibujo(u.look || lookDeNombre(u.nombre)), 256);
      if (u.perfil.foto || !c) return;
      const copia = document.createElement('canvas');
      copia.width = copia.height = 256;
      copia.getContext('2d').drawImage(c, 0, 0);
      foto.querySelector('.avatar')?.replaceWith(copia);
    }).catch(() => {});
  }
  $('[data-nombre]').textContent = u.nombre;
  $('[data-usuario]').textContent = '@' + u.usuario;
  $('[data-linea]').innerHTML = datos.enLinea ? '<i class="pf-punto"></i> en línea' : '';
  const est = $('[data-estado-txt]');
  est.textContent = p.estado;
  est.classList.toggle('hidden', !p.estado);
  // sobre mí
  $('[data-bio]').textContent = p.bio || (esMio() ? 'Todavía no escribiste nada. Tocá «Editar perfil».' : 'Sin bio por ahora.');
  $('[data-bio]').classList.toggle('vacia', !p.bio);
  const frase = $('[data-frase]');
  frase.textContent = p.frase ? `“${p.frase}”` : '';
  frase.classList.toggle('hidden', !p.frase);
  $('[data-datos]').innerHTML = [
    p.lugar && `<li><span>De</span>${esc(p.lugar)}</li>`,
    `<li><span>En cadalado desde</span>${new Date(u.creado).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</li>`,
    `<li><span>Amigos</span>${datos.amigos}</li>`,
  ].filter(Boolean).join('');
  // juego favorito
  const fav = $('[data-fav]');
  const j = juego(p.favorito);
  fav.classList.toggle('hidden', !j);
  if (j) fav.innerHTML = `<a href="${j.url}" style="--c:${j.color}"><img src="${j.captura}" alt="" loading="lazy"><span><small>Juego favorito</small><b>${esc(j.nombre)}</b></span><em>Jugar</em></a>`;
  // personaje 3D
  $('[data-pj]').classList.toggle('hidden', !p.personaje);
  if (p.personaje) montarPersonaje();
  // estadísticas y partidas
  const r = datos.resumen;
  const pct = r.jugadas ? Math.round((r.victorias / r.jugadas) * 100) : 0;
  $('[data-stats]').innerHTML = `
    <div class="stat"><b>${r.jugadas}</b><span>Partidas</span></div>
    <div class="stat lima"><b>${r.victorias}</b><span>Victorias</span></div>
    <div class="stat"><b>${r.derrotas}</b><span>Derrotas</span></div>
    <div class="stat"><b>${pct}%</b><span>Efectividad</span></div>`;
  $('[data-ultimas]').innerHTML = datos.ultimas.length
    ? datos.ultimas.map((h) => {
        const jj = juego(h.juego) || { nombre: h.juego, color: '#888' };
        const rivales = h.rivales?.length ? 'vs ' + h.rivales.join(', ') : jj.nombre;
        return `<div class="fila" style="--color:${jj.color}"><span class="tag"></span><span class="quien"><b>${esc(rivales)}</b><small>${esc([jj.nombre, h.marcador, hace(h.fecha)].filter(Boolean).join(' · '))}</small></span>
          <span class="resultado ${esc(h.resultado)}">${RESULTADO[h.resultado] || esc(h.resultado)}</span></div>`;
      }).join('')
    : `<div class="vacio">Todavía no hay partidas.</div>`;
  pintarAcciones();
}

function pintarAcciones() {
  const el = $('[data-acciones]');
  document.querySelectorAll('[data-cambiar]').forEach((b) => b.classList.toggle('hidden', !esMio()));
  if (esMio()) {
    el.innerHTML = `<button class="btn btn-lima btn-chico" data-editar>Editar perfil</button><a class="btn btn-borde btn-chico" href="/personaje">Tu personaje</a><a class="btn btn-borde btn-chico" href="/club">Club</a>`;
    return;
  }
  const rel = datos.relacion;
  const amistad = !yoMismo
    ? `<a class="btn btn-lima btn-chico" href="/entrar?volver=${encodeURIComponent(location.pathname + location.search)}">Entrá para sumarlo</a>`
    : rel === 'amigo' ? `<span class="pf-amigos">Son amigos</span><a class="btn btn-lima btn-chico" href="/club#chats:${esc(u.usuario)}">Chatear</a>`
    : rel === 'recibida' ? `<button class="btn btn-lima btn-chico" data-amistad="aceptar">Aceptar solicitud</button>`
    : rel === 'enviada' ? `<button class="btn btn-borde btn-chico" disabled>Solicitud enviada</button>`
    : `<button class="btn btn-lima btn-chico" data-amistad="pedir">Sumar amigo</button>`;
  el.innerHTML = amistad;
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-amistad], [data-editar], [data-cambiar]');
  if (!b) return;
  if (b.dataset.editar !== undefined) return abrirEditor();
  if (b.dataset.cambiar) return $(`[data-archivo="${b.dataset.cambiar}"]`).click();
  b.disabled = true;
  try {
    const r = await api('/api/club/amigos', { accion: b.dataset.amistad, usuario: u.usuario });
    datos.relacion = r.estado === 'amigo' ? 'amigo' : 'enviada';
    toast(datos.relacion === 'amigo' ? '¡Ya son amigos!' : 'Solicitud enviada');
    pintarAcciones();
  } catch (err) {
    toast(err.message, true);
    b.disabled = false;
  }
});

// ---------------------------------------------------------------- personaje 3D
async function montarPersonaje() {
  if (visor) return visor.cambiar(u.look);
  const caja = $('[data-pj]');
  const canvas = caja.querySelector('canvas');
  const THREE = await import('/comun/vendor/three.module.min.js');
  const { crearPersona } = await import('/comun/persona3d.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight(0xfff4e0, 0x4a5560, 1.8));
  const sol = new THREE.DirectionalLight(0xffffff, 2.4);
  sol.position.set(2, 4, -4);
  escena.add(sol);
  const contra = new THREE.DirectionalLight(new THREE.Color(u.perfil.color), 3);
  contra.position.set(-2, 2.5, 3);
  escena.add(contra);
  const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camara.position.set(0, 1.2, -4.4);
  camara.lookAt(0, 0.92, 0);
  let persona = null, giro = Math.PI * 0.12, giroObj = giro, arrastre = null;
  const armar = (look) => {
    if (persona) { escena.remove(persona.grupo); persona.dispose?.(); }
    persona = crearPersona(THREE, lookParaDibujo(look || lookDeNombre(u.nombre)), { sombras: false });
    escena.add(persona.grupo);
  };
  armar(u.look);
  const medir = () => { const w = caja.clientWidth, h = caja.clientHeight; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  new ResizeObserver(medir).observe(caja);
  canvas.addEventListener('pointerdown', (e) => { arrastre = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (arrastre == null) return; giroObj += (e.clientX - arrastre) * 0.012; arrastre = e.clientX; });
  canvas.addEventListener('pointerup', () => (arrastre = null));
  let ultimo = performance.now();
  const cuadro = (ms) => {
    requestAnimationFrame(cuadro);
    if (caja.classList.contains('hidden') || document.hidden) return;
    const dt = Math.min(0.05, (ms - ultimo) / 1000); ultimo = ms;
    if (arrastre == null) giroObj += dt * 0.25;
    giro += (giroObj - giro) * Math.min(1, dt * 8);
    persona.grupo.rotation.y = giro;
    persona.animar('quieto', dt);
    contra.color.set(getComputedStyle($('[data-pf]')).getPropertyValue('--acento').trim() || '#c5f04a');
    renderer.render(escena, camara);
  };
  requestAnimationFrame(cuadro);
  visor = { cambiar: armar };
}

// ---------------------------------------------------------------- editor
const dlg = $('[data-editor]');
const form = $('[data-form]');
let borrador = null;
const imagenes = { foto: undefined, portada: undefined }; // data URL nueva, null = sacar, undefined = sin cambio

$('[data-favoritos]').innerHTML = '<option value="">Ninguno</option>' + JUEGOS.filter((j) => j.estado === 'disponible').map((j) => `<option value="${j.id}">${esc(j.nombre)}</option>`).join('');
$('[data-fondos]').innerHTML = Object.entries(FONDOS).map(([id, f]) => `<button type="button" class="pf-fondo" data-fondo="${id}" style="background:${f.css}" title="${f.nombre}"><span>${f.nombre}</span></button>`).join('');
$('[data-colores]').innerHTML = COLORES.map((c) => `<button type="button" class="pf-color" data-color="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join('') +
  '<label class="pf-color pf-color-libre" title="Otro color"><input type="color" data-color-libre></label>';

function abrirEditor() {
  borrador = { ...u.perfil, nombre: u.nombre };
  imagenes.foto = imagenes.portada = undefined;
  for (const k of ['nombre', 'estado', 'bio', 'frase', 'lugar', 'favorito']) form.elements[k].value = borrador[k] || '';
  form.elements.personaje.checked = borrador.personaje;
  marcarElecciones();
  previsualizarImgs();
  contar();
  dlg.showModal();
}
function marcarElecciones() {
  document.querySelectorAll('[data-fondo]').forEach((b) => b.classList.toggle('on', b.dataset.fondo === borrador.fondo));
  document.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === borrador.color));
  $('[data-color-libre]').value = borrador.color;
  $('[data-color-libre]').closest('label').classList.toggle('on', !COLORES.includes(borrador.color));
  $('[data-color-libre]').closest('label').style.setProperty('--c', borrador.color);
}
function previsualizarImgs() {
  const ver = (tipo) => (imagenes[tipo] !== undefined ? imagenes[tipo] : u.perfil[tipo] ? imgUrl(u, tipo) : null);
  const f = ver('foto'), p = ver('portada');
  $('[data-prev-foto]').style.backgroundImage = f ? `url("${f}")` : 'none';
  $('[data-prev-portada]').style.backgroundImage = p ? `url("${p}")` : FONDOS[borrador.fondo].css;
}
function contar() {
  $('[data-cuenta-bio]').textContent = `${form.elements.bio.value.length}/280`;
  $('[data-cuenta-estado]').textContent = `${form.elements.estado.value.length}/60`;
}
// vista previa en vivo mientras editás
function enVivo() {
  const p = { ...u.perfil, ...borrador, personaje: form.elements.personaje.checked };
  for (const k of ['estado', 'bio', 'frase', 'lugar', 'favorito']) p[k] = form.elements[k].value.trim();
  const real = u.perfil;
  if (imagenes.portada === null) p.portada = 0;
  if (imagenes.foto === null) p.foto = 0;
  pintar(p);
  if (imagenes.portada) $('[data-portada]').style.backgroundImage = `linear-gradient(transparent 55%, #141413cc), url("${imagenes.portada}")`;
  if (imagenes.foto) { const f = $('[data-foto]'); f.querySelectorAll('img, canvas, .avatar').forEach((e) => e.remove()); f.insertAdjacentHTML('afterbegin', `<img src="${imagenes.foto}" alt="">`); }
  u.perfil = real;
}
form.addEventListener('input', () => { contar(); enVivo(); });
form.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fondo]');
  const c = e.target.closest('[data-color]');
  const s = e.target.closest('[data-sacar]');
  if (f) { borrador.fondo = f.dataset.fondo; if (imagenes.portada === undefined && u.perfil.portada) imagenes.portada = null; }
  else if (c) borrador.color = c.dataset.color;
  else if (s) imagenes[s.dataset.sacar] = null;
  else return;
  marcarElecciones(); previsualizarImgs(); enVivo();
});
$('[data-color-libre]').addEventListener('input', (e) => { borrador.color = e.target.value.toLowerCase(); marcarElecciones(); enVivo(); });

// achica y recorta la imagen en el navegador (la foto cuadrada, la portada apaisada)
async function preparar(archivo, tipo) {
  const bmp = await createImageBitmap(archivo);
  const [w, h] = tipo === 'foto' ? [400, 400] : [1500, 500];
  const r = Math.max(w / bmp.width, h / bmp.height);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, (w - bmp.width * r) / 2, (h - bmp.height * r) / 2, bmp.width * r, bmp.height * r);
  const max = tipo === 'foto' ? 440_000 : 880_000;
  for (const q of [0.86, 0.75, 0.62, 0.5, 0.38]) {
    const url = c.toDataURL('image/webp', q);
    if (url.startsWith('data:image/webp') && url.length < max) return url;
    const jpg = c.toDataURL('image/jpeg', q);
    if (jpg.length < max) return jpg;
  }
  throw new Error('La imagen es muy pesada.');
}
document.querySelectorAll('[data-archivo]').forEach((input) => input.addEventListener('change', async () => {
  const archivo = input.files[0];
  input.value = '';
  if (!archivo) return;
  try {
    const url = await preparar(archivo, input.dataset.archivo);
    if (!dlg.open) abrirEditor();
    imagenes[input.dataset.archivo] = url;
    previsualizarImgs(); enVivo();
  } catch (e) {
    toast(e.message || 'No se pudo leer la imagen', true);
  }
}));

dlg.addEventListener('close', async () => {
  if (dlg.returnValue !== 'guardar') { pintar(); return; }
  const cambios = { ...borrador, personaje: form.elements.personaje.checked };
  for (const k of ['nombre', 'estado', 'bio', 'frase', 'lugar', 'favorito']) cambios[k] = form.elements[k].value.trim();
  try {
    let nuevo = (await api('/api/club/perfil', cambios)).usuario;
    for (const tipo of ['foto', 'portada']) {
      if (imagenes[tipo] !== undefined) nuevo = (await api('/api/club/perfil/imagen', { tipo, dato: imagenes[tipo] })).usuario;
    }
    u = { ...u, ...nuevo };
    try { localStorage.setItem('cadalado.nombre', u.nombre); } catch {}
    pintar();
    document.querySelectorAll('.cuenta-link span:not(.avatar)').forEach((s) => (s.textContent = u.nombre));
    toast('Perfil guardado');
  } catch (e) {
    toast(e.message, true);
    pintar();
  }
});

cargar();
