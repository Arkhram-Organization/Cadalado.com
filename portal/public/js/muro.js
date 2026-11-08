// Muro del club (publicaciones con texto y foto) y sugerencias. Se usan sin cuenta: lo que publicás
// queda marcado en este navegador para poder borrarlo. Con cuenta salís con tu nombre y tu personaje.
import { api, yo, esc, hace, pidDe } from './comun.js';
import { avatarSvg, lookDeNombre } from '/comun/avatar.js';
import { lookParaDibujo } from '/comun/look.js';

const dispositivo = pidDe('cadalado.dispositivo');
const guardado = (k, def) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? def;
  } catch {
    return def;
  }
};
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const NOMBRE = 'cadalado.muro.nombre';
const claves = guardado('cadalado.muro.claves', {});
const likes = new Set(guardado('cadalado.muro.likes', []));
const sugClaves = guardado('cadalado.sug.claves', {});
const votos = new Set(guardado('cadalado.sug.votos', []));

const ICONO = {
  corazon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
  globo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5L9 5h6l1.5 2H20v12H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  flecha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

const lookDe = (a) => (a.look ? lookParaDibujo(a.look) : lookDeNombre(a.nombre));
const cara = (a, clase = '') => `<span class="mu-av ${clase}">${avatarSvg(lookDe(a), { titulo: a.nombre })}</span>`;
const firma = (a) => `<b class="mu-nombre">${esc(a.nombre)}</b>${a.cuenta ? `<span class="mu-cuenta" title="Publicó con su cuenta del club">${ICONO.check}</span>` : ''}`;
const fecha = (t) => `<time datetime="${new Date(t).toISOString()}" title="${new Date(t).toLocaleString('es-AR')}">${hace(t)}</time>`;

function aviso(el, texto, mal = true) {
  el.textContent = texto;
  el.classList.toggle('mal', mal);
  el.hidden = !texto;
}

// Achica la foto en el navegador (lado mayor 1280 px, JPG) para que suba rápido y pese poco.
async function achicar(archivo) {
  if (!/^image\//.test(archivo.type)) throw new Error('Eso no es una foto.');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No pudimos abrir esa foto. Probá con otra (JPG o PNG).'));
      i.src = url;
    });
    let lado = 1280;
    for (let intento = 0; intento < 5; intento++) {
      const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const datos = c.toDataURL('image/jpeg', 0.82 - intento * 0.08);
      if (datos.length < 850_000) return datos;
      lado = Math.round(lado * 0.75);
    }
    throw new Error('La foto es muy pesada. Probá con otra.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function lightbox(src, alt) {
  const d = document.createElement('div');
  d.className = 'mu-lightbox';
  d.innerHTML = `<img src="${src}" alt="${esc(alt)}"><button class="mu-cerrar" aria-label="Cerrar">×</button>`;
  const cerrar = () => {
    d.remove();
    removeEventListener('keydown', tecla);
  };
  const tecla = (e) => e.key === 'Escape' && cerrar();
  d.onclick = cerrar;
  addEventListener('keydown', tecla);
  document.body.append(d);
}

// ---------------------------------------------------------------- muro
export async function montarMuro(raiz) {
  const u = await yo();
  raiz.innerHTML = `
    <form class="mu-nuevo" data-nuevo>
      <span data-yo-av></span>
      <div class="mu-campos">
        ${u ? `<p class="mu-como">Publicás como <b>${esc(u.nombre)}</b></p>` : `<input class="mu-input mu-nombre-in" name="nombre" maxlength="30" placeholder="Tu nombre (opcional)" autocomplete="nickname" value="${esc(guardado(NOMBRE, ''))}">`}
        <textarea class="mu-input" name="texto" maxlength="600" rows="2" placeholder="¿Qué onda? Contá algo, subí una foto, tirá un chiste…"></textarea>
        <div class="mu-previa" data-previa hidden><img alt="Foto elegida"><button type="button" class="mu-quitar" data-quitar aria-label="Sacar la foto">×</button></div>
        <div class="mu-barra">
          <label class="mu-boton">${ICONO.foto}<span>Foto</span><input type="file" accept="image/*" data-archivo hidden></label>
          <span class="mu-cuenta-letras" data-letras>0 / 600</span>
          <button class="button primary mu-publicar" data-publicar>Publicar</button>
        </div>
        <p class="mu-aviso" data-aviso hidden></p>
      </div>
    </form>
    <div class="mu-lista" data-lista><p class="muted">Cargando el muro…</p></div>
    <div class="mu-mas"><button class="button" data-mas hidden>Ver más publicaciones</button></div>`;
  const $ = (s) => raiz.querySelector(s);
  const form = $('[data-nuevo]');
  const pintarYo = () => {
    const nombre = u?.nombre || form.nombre?.value.trim() || 'Anónimo';
    $('[data-yo-av]').innerHTML = cara(u ? { nombre, look: u.look } : { nombre }, 'mu-av-grande');
  };
  pintarYo();
  let fotoElegida = null;
  form.texto.addEventListener('input', () => {
    $('[data-letras]').textContent = `${form.texto.value.length} / 600`;
    form.texto.style.height = 'auto';
    form.texto.style.height = Math.min(220, form.texto.scrollHeight + 2) + 'px';
  });
  form.nombre?.addEventListener('change', () => {
    guardar(NOMBRE, form.nombre.value.trim());
    pintarYo();
  });
  $('[data-archivo]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      aviso($('[data-aviso]'), 'Preparando la foto…', false);
      fotoElegida = await achicar(f);
      $('[data-previa] img').src = fotoElegida;
      $('[data-previa]').hidden = false;
      aviso($('[data-aviso]'), '');
    } catch (err) {
      aviso($('[data-aviso]'), err.message);
    }
  });
  $('[data-quitar]').onclick = () => {
    fotoElegida = null;
    $('[data-previa]').hidden = true;
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const boton = $('[data-publicar]');
    boton.disabled = true;
    boton.textContent = 'Publicando…';
    try {
      const nombre = form.nombre?.value.trim() || '';
      if (form.nombre) guardar(NOMBRE, nombre);
      const r = await api('/api/club/muro', { nombre, texto: form.texto.value, foto: fotoElegida });
      claves[r.post.id] = r.clave;
      guardar('cadalado.muro.claves', claves);
      posts.unshift(r.post);
      visibles++;
      form.texto.value = '';
      form.texto.dispatchEvent(new Event('input'));
      $('[data-quitar]').click();
      aviso($('[data-aviso]'), '');
      pintar();
    } catch (err) {
      aviso($('[data-aviso]'), err.message);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Publicar';
    }
  };

  let posts = [];
  let hayMas = false;
  let visibles = 6;
  const abiertos = new Set();

  const tarjeta = (p) => `<article class="mu-post" data-id="${p.id}">
      <header>${cara(p)}<div>${firma(p)}<span class="mu-meta">${fecha(p.t)}</span></div></header>
      ${p.texto ? `<p class="mu-texto">${esc(p.texto)}</p>` : ''}
      ${p.foto ? `<button class="mu-foto" data-ver><img src="/api/club/muro/foto?id=${p.id}" alt="Foto de ${esc(p.nombre)}" loading="lazy"></button>` : ''}
      <footer>
        <button class="mu-accion ${likes.has(p.id) ? 'on' : ''}" data-like aria-pressed="${likes.has(p.id)}" aria-label="Me gusta">${ICONO.corazon}<span>${p.likes || ''}</span></button>
        <button class="mu-accion" data-resp aria-expanded="${abiertos.has(p.id)}">${ICONO.globo}<span>${p.respuestas ? p.respuestas : 'Comentar'}</span></button>
        ${claves[p.id] || p.puedeBorrar ? '<button class="mu-borrar" data-borrar>Borrar</button>' : ''}
      </footer>
      <div class="mu-hilo" data-hilo ${abiertos.has(p.id) ? '' : 'hidden'}></div>
    </article>`;

  function pintar() {
    const lista = $('[data-lista]');
    const ver = posts.slice(0, visibles);
    lista.innerHTML = ver.length ? ver.map(tarjeta).join('') : '<p class="mu-vacio">Todavía no publicó nadie. ¡Estrenalo vos!</p>';
    for (const id of abiertos) abrirHilo(id, false);
    $('[data-mas]').hidden = !(posts.length > visibles || hayMas);
  }

  async function cargar() {
    try {
      const d = await api('/api/club/muro');
      posts = d.posts;
      hayMas = d.mas;
      pintar();
    } catch (err) {
      $('[data-lista]').innerHTML = `<p class="mu-vacio">No pudimos cargar el muro (${esc(err.message)}).</p>`;
    }
  }
  // Cada tanto trae lo nuevo sin desarmar lo que estás mirando.
  async function refrescar() {
    if (document.hidden || raiz.contains(document.activeElement)) return;
    try {
      const d = await api('/api/club/muro');
      const ids = new Set(posts.map((p) => p.id));
      const nuevos = d.posts.filter((p) => !ids.has(p.id));
      const porId = Object.fromEntries(d.posts.map((p) => [p.id, p]));
      posts = posts.filter((p) => porId[p.id] || p.t < d.posts.at(-1)?.t).map((p) => (porId[p.id] ? { ...p, likes: porId[p.id].likes, respuestas: porId[p.id].respuestas } : p));
      posts.unshift(...nuevos);
      visibles += nuevos.length;
      pintar();
    } catch {}
  }

  async function abrirHilo(id, recargar = true) {
    const art = raiz.querySelector(`.mu-post[data-id="${id}"]`);
    if (!art) return;
    const hilo = art.querySelector('[data-hilo]');
    hilo.hidden = false;
    if (!hilo.dataset.listo || recargar) {
      hilo.dataset.listo = '1';
      hilo.innerHTML = `<div class="mu-resps"><p class="muted">Cargando…</p></div>
        <form class="mu-responder">${u ? '' : `<input class="mu-input" name="nombre" maxlength="30" placeholder="Tu nombre" value="${esc(guardado(NOMBRE, ''))}">`}<input class="mu-input" name="texto" maxlength="300" placeholder="Escribí un comentario…" required><button class="button primary">Enviar</button></form>`;
      const form = hilo.querySelector('form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const nombre = form.nombre?.value.trim() || '';
        if (form.nombre) guardar(NOMBRE, nombre);
        try {
          const r = await api('/api/club/muro/responder', { id, nombre, texto: form.texto.value });
          const p = posts.find((x) => x.id === id);
          if (p) p.respuestas = r.respuestas;
          art.querySelector('[data-resp] span').textContent = r.respuestas;
          form.texto.value = '';
          cargarResps(id, hilo);
        } catch (err) {
          alert(err.message);
        }
      };
      cargarResps(id, hilo);
    }
  }
  async function cargarResps(id, hilo) {
    try {
      const { respuestas } = await api('/api/club/muro/respuestas?id=' + id);
      hilo.querySelector('.mu-resps').innerHTML = respuestas.length
        ? respuestas.map((r) => `<div class="mu-resp">${cara(r, 'mu-av-chico')}<div><p>${firma(r)} <span class="mu-meta">${fecha(r.t)}</span></p><p class="mu-resp-texto">${esc(r.texto)}</p></div></div>`).join('')
        : '<p class="mu-meta">Sin comentarios todavía.</p>';
    } catch (err) {
      hilo.querySelector('.mu-resps').innerHTML = `<p class="mu-meta">${esc(err.message)}</p>`;
    }
  }

  $('[data-lista]').addEventListener('click', async (e) => {
    const art = e.target.closest('.mu-post');
    if (!art) return;
    const id = art.dataset.id;
    const p = posts.find((x) => x.id === id);
    if (e.target.closest('[data-ver]')) return lightbox(`/api/club/muro/foto?id=${id}`, `Foto de ${p?.nombre}`);
    const b = e.target.closest('[data-like]');
    if (b) {
      b.disabled = true;
      try {
        const r = await api('/api/club/muro/like', { id, dispositivo });
        r.diste ? likes.add(id) : likes.delete(id);
        guardar('cadalado.muro.likes', [...likes].slice(-500));
        if (p) p.likes = r.likes;
        b.classList.toggle('on', r.diste);
        b.setAttribute('aria-pressed', r.diste);
        b.querySelector('span').textContent = r.likes || '';
      } catch (err) {
        alert(err.message);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (e.target.closest('[data-resp]')) {
      if (abiertos.has(id)) {
        abiertos.delete(id);
        art.querySelector('[data-hilo]').hidden = true;
      } else {
        abiertos.add(id);
        abrirHilo(id);
        art.querySelector('[data-hilo] input[name=texto]')?.focus();
      }
      art.querySelector('[data-resp]').setAttribute('aria-expanded', abiertos.has(id));
      return;
    }
    if (e.target.closest('[data-borrar]')) {
      if (!confirm('¿Borrar esta publicación?')) return;
      try {
        await api('/api/club/muro/borrar', { id, clave: claves[id] });
        delete claves[id];
        guardar('cadalado.muro.claves', claves);
        posts = posts.filter((x) => x.id !== id);
        pintar();
      } catch (err) {
        alert(err.message);
      }
    }
  });
  $('[data-mas]').onclick = async () => {
    visibles += 9;
    if (posts.length < visibles && hayMas) {
      try {
        const d = await api('/api/club/muro?antes=' + posts.at(-1).t);
        posts.push(...d.posts);
        hayMas = d.mas;
      } catch {}
    }
    pintar();
  };

  await cargar();
  setInterval(refrescar, 30000);
  document.addEventListener('visibilitychange', () => !document.hidden && refrescar());
}

// ---------------------------------------------------------------- sugerencias
const TIPOS = [['juego', 'Juego nuevo'], ['cambio', 'Cambio en la página'], ['otro', 'Otra idea']];
const ESTADO = { camino: 'En camino', hecho: 'Hecho' };

export async function montarSugerencias(raiz) {
  const u = await yo();
  let tipo = 'juego';
  let filtro = '';
  let lista = [];
  let admin = false;
  raiz.innerHTML = `
    <form class="sg-form" data-form>
      <span class="eyebrow">Proponé algo</span>
      <div class="sg-tipos" role="radiogroup" aria-label="Tipo de idea">${TIPOS.map(([k, t]) => `<button type="button" role="radio" data-tipo="${k}" aria-checked="${k === tipo}">${t}</button>`).join('')}</div>
      <textarea class="mu-input" name="texto" maxlength="400" rows="4" placeholder="Ej.: un Pictionary para jugar en grupo, un modo por equipos en la carrera, que el casino tenga póker…"></textarea>
      ${u ? `<p class="mu-como">Sugerís como <b>${esc(u.nombre)}</b></p>` : `<input class="mu-input" name="nombre" maxlength="30" placeholder="Tu nombre (opcional)" value="${esc(guardado(NOMBRE, ''))}">`}
      <button class="button primary">Mandar idea <span class="arrow">↗</span></button>
      <p class="mu-aviso" data-aviso hidden></p>
    </form>
    <div class="sg-lado">
      <div class="sg-filtros" role="tablist">${[['', 'Todas'], ['juego', 'Juegos'], ['cambio', 'Cambios'], ['otro', 'Otras']].map(([k, t]) => `<button role="tab" data-filtro="${k}" aria-selected="${k === filtro}">${t}</button>`).join('')}</div>
      <ol class="sg-lista" data-lista><li class="muted">Cargando ideas…</li></ol>
    </div>`;
  const $ = (s) => raiz.querySelector(s);
  const form = $('[data-form]');

  function pintar() {
    const ver = lista.filter((x) => !filtro || x.tipo === filtro);
    $('[data-lista]').innerHTML = ver.length
      ? ver
          .map(
            (x) => `<li class="sg-item ${x.estado === 'hecho' ? 'hecho' : ''}" data-id="${x.id}">
        <button class="sg-voto ${votos.has(x.id) ? 'on' : ''}" data-votar aria-pressed="${votos.has(x.id)}" aria-label="Apoyar esta idea">${ICONO.flecha}<b>${x.votos}</b></button>
        <div class="sg-cuerpo">
          <div class="sg-tags"><span class="sg-tipo">${TIPOS.find(([k]) => k === x.tipo)?.[1] || 'Idea'}</span>${x.estado ? `<span class="sg-estado ${x.estado}">${ESTADO[x.estado]}</span>` : ''}</div>
          <p>${esc(x.texto)}</p>
          <span class="mu-meta">${esc(x.nombre)} · ${fecha(x.t)}${sugClaves[x.id] || x.puedeBorrar ? ' · <button class="mu-borrar" data-borrar>Borrar</button>' : ''}</span>
          ${admin ? `<span class="sg-admin">${['', 'camino', 'hecho'].map((e) => `<button data-estado="${e}" ${x.estado === e ? 'disabled' : ''}>${ESTADO[e] || 'Pendiente'}</button>`).join('')}</span>` : ''}
        </div></li>`
          )
          .join('')
      : `<li class="mu-vacio">${filtro ? 'No hay ideas de este tipo todavía.' : 'Todavía no hay ideas. ¡Tirá la primera!'}</li>`;
  }
  async function cargar() {
    try {
      const d = await api('/api/club/sugerencias');
      lista = d.sugerencias;
      admin = d.admin;
      pintar();
    } catch (err) {
      $('[data-lista]').innerHTML = `<li class="mu-vacio">No pudimos cargar las ideas (${esc(err.message)}).</li>`;
    }
  }

  raiz.querySelector('.sg-tipos').onclick = (e) => {
    const b = e.target.closest('[data-tipo]');
    if (!b) return;
    tipo = b.dataset.tipo;
    raiz.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-checked', x === b));
  };
  raiz.querySelector('.sg-filtros').onclick = (e) => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    filtro = b.dataset.filtro;
    raiz.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-selected', x === b));
    pintar();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const boton = form.querySelector('button.primary');
    boton.disabled = true;
    try {
      const nombre = form.nombre?.value.trim() || '';
      if (form.nombre) guardar(NOMBRE, nombre);
      const r = await api('/api/club/sugerencias', { tipo, texto: form.texto.value, nombre });
      sugClaves[r.sugerencia.id] = r.clave;
      guardar('cadalado.sug.claves', sugClaves);
      lista.push(r.sugerencia);
      form.texto.value = '';
      aviso($('[data-aviso]'), '¡Gracias! Ya quedó en la lista.', false);
      filtro = '';
      raiz.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-selected', x.dataset.filtro === ''));
      pintar();
    } catch (err) {
      aviso($('[data-aviso]'), err.message);
    } finally {
      boton.disabled = false;
    }
  };
  $('[data-lista]').addEventListener('click', async (e) => {
    const li = e.target.closest('.sg-item');
    if (!li) return;
    const id = li.dataset.id;
    const x = lista.find((y) => y.id === id);
    try {
      if (e.target.closest('[data-votar]')) {
        const r = await api('/api/club/sugerencias/votar', { id, dispositivo });
        r.diste ? votos.add(id) : votos.delete(id);
        guardar('cadalado.sug.votos', [...votos].slice(-500));
        x.votos = r.votos;
        pintar();
      } else if (e.target.closest('[data-borrar]')) {
        if (!confirm('¿Borrar esta idea?')) return;
        await api('/api/club/sugerencias/borrar', { id, clave: sugClaves[id] });
        delete sugClaves[id];
        guardar('cadalado.sug.claves', sugClaves);
        lista = lista.filter((y) => y.id !== id);
        pintar();
      } else if (e.target.closest('[data-estado]')) {
        const estado = e.target.closest('[data-estado]').dataset.estado;
        await api('/api/club/sugerencias/estado', { id, estado });
        x.estado = estado;
        pintar();
      }
    } catch (err) {
      alert(err.message);
    }
  });
  await cargar();
}
