import { Sala, marco, api, pid, esc, toast, recordar, nombreGuardado, guardarNombre } from '/comun/sala.js';
import { avatarSvg, lookDeId, lookDeNombre } from '/comun/avatar.js';
import { PLANTILLAS } from './plantillas.js';

const PL = new Map(PLANTILLAS.map((p) => [p.id, p]));
const app = document.querySelector('#app');
const COLOR = '#ff4fa3';
const VOTOS = [
  [1, '1', 'Nada'],
  [2, '2', 'Meh'],
  [3, '3', 'Bien'],
  [4, '4', 'Bueno'],
  [5, '5', 'Genio'],
];
const COLORES = { blanco: '#fff', negro: '#111', amarillo: '#ffe100', rojo: '#ff3b3b' };
const AV = ['#ff4fa3', '#c5f04a', '#7aa2ff', '#ff7a45', '#f2c94c', '#4fd1c5', '#c084fc'];
const colorDe = (id) => AV[parseInt(String(id).slice(0, 6), 36) % AV.length];

const cuenta = await marco({ juego: 'Make it Meme', color: COLOR, volver: '/memes/' });
let sala = null;
let limpiar = [];

function ir(ruta) {
  history.pushState(null, '', ruta);
  ruteo();
}
window.addEventListener('popstate', ruteo);

function ruteo() {
  limpiar.forEach((f) => f());
  limpiar = [];
  sala?.cerrar();
  sala = null;
  const m = location.pathname.match(/^\/memes\/sala\/([A-Za-z0-9-]{3,16})/);
  if (m) abrirSala(m[1].toUpperCase());
  else menu();
}

// ---------------------------------------------------------------- meme (plantilla + textos)
function memeHtml(plantillaId, textos, { editor = false } = {}) {
  const p = PL.get(plantillaId);
  if (!p) return '<div class="meme" style="aspect-ratio:1"></div>';
  return `<div class="meme" style="aspect-ratio:${p.w}/${p.h}">
    <img src="${esc(p.url)}" alt="${esc(p.nombre)}" referrerpolicy="no-referrer" draggable="false">
    ${textos.map((t, i) => textoHtml(t, i, editor)).join('')}
  </div>`;
}
function textoHtml(t, i, editor) {
  const vacio = !t.t.trim();
  return `<div class="tx ${t.c} ${editor && vacio ? 'vacio' : ''}" data-i="${i}" data-ph="Texto ${i + 1}"
    style="left:${t.x * 100}%;top:${t.y * 100}%;width:${t.w * 100}%;--s:${t.s}">${esc(t.t)}${editor ? '<span class="asa" data-asa></span>' : ''}</div>`;
}

// ---------------------------------------------------------------- menú
function menu() {
  document.title = 'Make it Meme · cadalado';
  app.innerHTML = `
  <div class="menu">
    <div class="menu-hero">
      <div><span class="etq">Juego de memes · de 2 a 12</span><h1>Make it <em>meme.</em></h1>
      <p>Te toca una plantilla, le ponés el texto donde quieras y todos votan. El meme más gracioso suma más.</p></div>
    </div>
    <section class="panel">
      <h2>Armar una sala</h2>
      <form data-crear style="display:grid;gap:12px">
        ${cuenta ? '' : `<label><span class="etq">Tu nombre</span><input class="entrada" name="nombre" maxlength="20" required value="${esc(nombreGuardado())}" placeholder="¿Cómo te llaman?"></label>`}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label><span class="etq">Bots</span><select class="entrada" name="bots"><option>0</option><option selected>2</option><option>3</option><option>4</option></select></label>
          <label><span class="etq">Rondas</span><select class="entrada" name="rondas"><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label>
        </div>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="publica" checked style="accent-color:${COLOR};width:18px;height:18px"> Sala pública (aparece en la lista)</label>
        <button class="btn btn-lima btn-grande">Crear sala</button>
      </form>
    </section>
    <section class="panel">
      <h2>Entrar a una sala</h2>
      <form class="fila-form" data-unirse><input class="entrada" maxlength="16" placeholder="Código, ej: K7QX2" autocapitalize="characters" required><button class="btn">Entrar</button></form>
      <h2 style="margin-top:22px">Salas abiertas</h2>
      <div class="salas" data-salas><div class="vacio">Buscando…</div></div>
    </section>
  </div>`;
  app.querySelector('[data-crear]').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!cuenta) guardarNombre(f.get('nombre'));
    e.target.querySelector('button').disabled = true;
    try {
      const { code } = await api('/api/memes/crear', { pid: pid(), nombre: f.get('nombre'), opciones: { bots: Number(f.get('bots')), rondas: f.get('rondas'), publica: f.get('publica') === 'on' } });
      ir(`/memes/sala/${code}`);
    } catch (err) {
      toast(err.message, true);
      e.target.querySelector('button').disabled = false;
    }
  };
  app.querySelector('[data-unirse]').onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.querySelector('input').value.trim().toUpperCase().replace(/.*\//, '');
    if (c) ir(`/memes/sala/${c}`);
  };
  const cargar = async () => {
    try {
      const { salas } = await api('/api/memes/lobby');
      const el = app.querySelector('[data-salas]');
      if (!el) return;
      el.innerHTML = salas.length
        ? salas.map((s) => `<a class="sala-fila" href="/memes/sala/${s.code}" data-ir><span class="avatar" style="--av:${COLOR}">${s.jugadores}</span>
            <span class="q"><b>${esc(s.titulo)}</b><small>${s.fase === 'lobby' ? 'Esperando jugadores' : s.fase === 'final' ? 'Terminó · pueden jugar otra' : `Ronda ${s.ronda} de ${s.rondas}`}</small></span>
            <span class="btn btn-chico btn-lima">Entrar</span></a>`).join('')
        : '<div class="vacio">No hay salas abiertas. ¡Armá la primera!</div>';
    } catch {}
  };
  cargar();
  const t = setInterval(cargar, 5000);
  limpiar.push(() => clearInterval(t));
}
app.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ir]');
  if (!a) return;
  e.preventDefault();
  ir(a.getAttribute('href'));
});

// ---------------------------------------------------------------- sala
function abrirSala(code) {
  document.title = `Sala ${code} · Make it Meme`;
  document.body.classList.add('memes-sala');
  limpiar.push(() => document.body.classList.remove('memes-sala'));
  app.innerHTML = `
  <div class="sala">
    <aside class="lateral izq">
      <div class="panel">
        <div class="codigo"><div><span class="etq">Sala</span><br><b>${esc(code)}</b></div><button class="btn btn-chico" data-copiar>Copiar link</button></div>
      </div>
      <div class="panel"><span class="etq">Jugadores</span><div class="jugadores" data-jugadores style="margin-top:10px"></div></div>
    </aside>
    <section class="centro" data-centro><div class="panel espera"><h2>Entrando…</h2></div></section>
    <aside class="lateral der">
      <div class="panel chat"><h3>Chat</h3><div class="chat-log" data-log></div>
        <form data-chat><input class="entrada" maxlength="280" placeholder="Escribí algo…" autocomplete="off"><button class="btn btn-chico btn-lima">Enviar</button></form></div>
    </aside>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const link = `${location.origin}/memes/sala/${code}`;
  $('[data-copiar]').onclick = async (e) => {
    try { await navigator.clipboard.writeText(link); } catch {}
    e.target.textContent = 'Link copiado';
    setTimeout(() => (e.target.textContent = 'Copiar link'), 1600);
  };
  $('[data-chat]').onsubmit = (e) => {
    e.preventDefault();
    const i = e.target.querySelector('input');
    if (i.value.trim()) sala.enviar({ t: 'chat', texto: i.value });
    i.value = '';
  };

  let est = null;
  let faseKey = '';
  let ed = null; // editor: { plantilla, textos, sel, enviado, auto }

  sala = new Sala('/api/memes', code, {
    intervalo: (e) => (e?.fase === 'votando' ? 700 : e?.fase === 'lobby' ? 1500 : 1000),
    onEstado: (e) => {
      est = e;
      // los bots aparecen como jugadores más (siempre conectados)
      est.jugadores = [...e.jugadores, ...(e.bots || []).map((b) => ({ ...b, online: true, bot: true }))];
      pintarJugadores();
      pintarFase();
    },
    onEvento: (ev) => {
      if (ev.k !== 'chat') return;
      const log = $('[data-log]');
      const d = document.createElement('div');
      if (ev.sistema) {
        d.className = 'sis';
        d.textContent = ev.texto;
      } else d.innerHTML = `<b>${esc(ev.nombre)}:</b> ${esc(ev.texto)}`;
      log.append(d);
      log.scrollTop = log.scrollHeight;
    },
    onError: (m) => toast(m, true),
    onNoExiste: () => {
      toast('Esa sala no existe o ya cerró.', true);
      ir('/memes/');
    },
    onConexion: (ok) => !ok && toast('Se cortó la conexión. Reintentando…', true),
  });
  recordar('memes', `/memes/sala/${code}`, `Sala ${code}`);

  const reloj = setInterval(() => {
    const bar = app.querySelector('[data-reloj]');
    if (!bar || !est?.fin) return;
    const total = est.fase === 'creando' ? est.segCrear * 1000 : est.fase === 'votando' ? 10000 : 16000;
    const queda = Math.max(0, est.fin - sala.ahora());
    // círculo que se va vaciando
    const C = 2 * Math.PI * 19;
    bar.querySelector('.arco').style.strokeDasharray = C;
    bar.querySelector('.arco').style.strokeDashoffset = C * (1 - Math.min(1, queda / total));
    bar.querySelector('[data-seg-ring]').textContent = Math.ceil(queda / 1000);
    bar.classList.toggle('apurado', queda < Math.min(10000, total * 0.3));
    const seg = app.querySelector('[data-seg]');
    if (seg) seg.textContent = Math.ceil(queda / 1000);
    // envío automático: si se acaba el tiempo y escribiste algo, se manda solo
    if (est.fase === 'creando' && ed && !ed.enviado && !ed.auto && queda < 1800 && ed.textos.some((t) => t.t.trim())) {
      ed.auto = true;
      enviarMeme();
    }
  }, 200);
  limpiar.push(() => clearInterval(reloj));

  const nombreDe = (id) => est.jugadores.find((j) => j.id === id)?.nombre || '—';
  const avatares = new Map();
  const avatarDe = (j) => {
    const k = j.id + j.nombre;
    if (!avatares.has(k)) avatares.set(k, avatarSvg(j.bot ? lookDeNombre(j.nombre) : lookDeId(j.id, colorDe(j.id)), { titulo: j.nombre }));
    return avatares.get(k);
  };

  function pintarJugadores() {
    const lista = [...est.jugadores].sort((a, b) => (est.puntos[b.id] || 0) - (est.puntos[a.id] || 0));
    $('[data-jugadores]').innerHTML = lista.map((j) => {
      const listo = est.fase === 'creando' && est.listos.includes(j.id);
      const sub = j.bot && est.fase !== 'creando' ? 'bot' : j.id === est.host ? 'arma la sala' : est.fase === 'creando' ? (listo ? 'meme listo' : est.participantes.includes(j.id) ? 'creando…' : 'entra en la próxima') : j.online ? 'conectado' : 'desconectado';
      return `<div class="jug ${j.online ? '' : 'off'} ${j.bot ? 'bot' : ''}"><span class="av">${avatarDe(j)}</span>
        <span class="n">${esc(j.nombre)}${j.id === est.yo ? ' (vos)' : ''}<small>${sub}</small></span>
        ${listo ? '<span class="ok">✓</span>' : ''}<span class="pts">${est.puntos[j.id] || 0}</span></div>`;
    }).join('');
  }

  function cabeza(titulo, extra = '') {
    return `<div class="cabeza-fase"><div><span class="etq">Ronda <b>${est.ronda}</b> de <b>${est.rondas}</b></span><h2>${titulo}</h2></div><div class="cabeza-der">${extra}<div class="reloj-circ" data-reloj><svg viewBox="0 0 44 44"><circle class="fondo" cx="22" cy="22" r="19"/><circle class="arco" cx="22" cy="22" r="19"/></svg><b data-seg-ring></b></div></div></div>
      `;
  }

  function pintarFase() {
    const c = $('[data-centro]');
    const esHost = est.host === est.yo;
    const key = `${est.fase}:${est.ronda}:${est.fase === 'creando' ? est.miPlantilla : ''}:${est.fase === 'votando' ? est.voto.idx : ''}`;
    const cambio = key !== faseKey;
    faseKey = key;

    if (est.fase === 'lobby') {
      ed = null;
      const n = est.jugadores.filter((j) => j.online).length;
      c.innerHTML = `<div class="panel espera">
        <h2>¿Quiénes juegan?</h2>
        <p>Mandá el link de la sala. Cuando estén todos, ${esHost ? 'tocá empezar' : 'el que armó la sala empieza'}.</p>
        <div class="fila-form" style="max-width:520px;margin:0 auto"><input class="entrada mono" readonly value="${esc(link)}"><button class="btn" data-copiar2>Copiar</button></div>
        ${esHost ? `<div class="fila-bots"><span class="etq">Bots que memean</span>${[0, 1, 2, 3, 4].map((k) => `<button class="btn btn-chico ${k === (est.bots || []).length ? 'btn-lima' : ''}" data-bots="${k}">${k}</button>`).join('')}</div>` : ''}
        <div style="margin-top:18px">${esHost ? `<button class="btn btn-lima btn-grande" data-empezar ${n < 2 ? 'disabled' : ''}>Empezar (${n} ${n === 1 ? 'jugador' : 'jugadores'})</button>` : `<span class="chip">${n} conectados · esperando que empiece</span>`}</div>
        <div class="reglas">
          <div><b>1 · Plantilla</b>Te toca una al azar. Si no te convence, pedí otra.</div>
          <div><b>2 · Texto</b>Escribí y arrastrá los textos a donde quieras.</div>
          <div><b>3 · Votación</b>Se ven de a uno, sin autor. Del 1 al 5.</div>
        </div></div>`;
      c.querySelector('[data-copiar2]').onclick = () => app.querySelector('[data-copiar]').click();
      c.querySelector('[data-empezar]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
      c.querySelectorAll('[data-bots]').forEach((b) => (b.onclick = () => sala.enviar({ t: 'bots', n: Number(b.dataset.bots) })));
      return;
    }

    if (est.fase === 'creando') {
      if (!est.miPlantilla) {
        c.innerHTML = `${cabeza('Están creando…')}<div class="panel espera"><h2>Entrás en la próxima ronda</h2><p>Mientras tanto, mirá el chat.</p></div>`;
        return;
      }
      if (!cambio && ed) {
        // solo actualizar el aviso de "listo"
        const ban = c.querySelector('[data-listo]');
        if (ban) ban.classList.toggle('hidden', !est.miMeme);
        const faltan = est.participantes.length - est.listos.length;
        const txt = c.querySelector('[data-faltan]');
        if (txt) txt.textContent = faltan > 0 ? `Faltan ${faltan}` : 'Están todos';
        return;
      }
      const textos = ed?.textos?.length && ed.ronda === est.ronda ? ed.textos : inicialTextos(PL.get(est.miPlantilla));
      ed = { plantilla: est.miPlantilla, ronda: est.ronda, textos, sel: 0, enviado: !!est.miMeme, auto: false, fallos: ed?.fallos || 0 };
      pintarEditor(c);
      return;
    }

    if (est.fase === 'votando') {
      const v = est.voto;
      c.innerHTML = `${cabeza(`Meme ${v.idx + 1} de ${v.total}`, `<span class="chip">${v.votaron}/${v.pueden} votaron</span>`)}
        <div class="marco-meme">${memeHtml(v.plantilla, v.textos)}</div>
        ${v.esMio ? '<div class="secreto">Este es tuyo. No digas nada y mirá cómo lo votan.</div>' : `<div class="votos">${VOTOS.map(([n, e, t]) => `<button data-voto="${n}" class="${v.miVoto === n ? 'on' : ''}"><span>${e}</span>${t}</button>`).join('')}</div>`}`;
      c.querySelectorAll('[data-voto]').forEach((b) => (b.onclick = () => {
        c.querySelectorAll('[data-voto]').forEach((x) => x.classList.toggle('on', x === b));
        sala.enviar({ t: 'votar', n: Number(b.dataset.voto) });
      }));
      return;
    }

    if (est.fase === 'resultados' || est.fase === 'final') {
      if (!cambio) return;
      const grilla = !est.resultados.length ? '<div class="panel espera"><h2>Nadie mandó meme</h2><p>Esta ronda quedó vacía.</p></div>' : `<div class="grilla-res">${est.resultados.map((m, i) => `<div class="res ${i === 0 ? 'top' : ''}" style="animation-delay:${i * 0.12}s">
          ${memeHtml(m.plantilla, m.textos)}<div class="pie"><b>${i === 0 ? '1º · ' : ''}${esc(m.nombre)}</b><span class="mono">+${m.puntos}</span></div></div>`).join('')}</div>`;
      if (est.fase === 'resultados') {
        c.innerHTML = `${cabeza('Resultados de la ronda', esHost ? '<button class="btn btn-lima" data-sig>Siguiente ronda</button>' : '')}${grilla}`;
        c.querySelector('[data-sig]')?.addEventListener('click', () => sala.enviar({ t: 'siguiente' }));
      } else {
        const tabla = Object.entries(est.puntos).sort((a, b) => b[1] - a[1]);
        const pod = [tabla[1], tabla[0], tabla[2]];
        c.innerHTML = `<div class="cabeza-fase"><div><span class="etq">Final</span><h2>¡Terminó!</h2></div>${esHost ? '<button class="btn btn-lima" data-otra>Jugar otra vez</button>' : ''}</div>
          <div class="podio">${pod.map((p, i) => (p ? `<div class="p${[2, 1, 3][i]}"><span class="mono" style="font-size:26px;color:var(--blanco)">${['2º', '1º', '3º'][i]}</span><b>${esc(nombreDe(p[0]))}</b><span class="mono">${p[1]} pts</span></div>` : '<div style="visibility:hidden"></div>')).join('')}</div>
          ${est.mejor ? `<div class="panel"><span class="etq">El mejor meme · ronda ${est.mejor.ronda} · ${esc(est.mejor.nombre)}</span><div class="marco-meme" style="margin-top:10px">${memeHtml(est.mejor.plantilla, est.mejor.textos)}</div></div>` : ''}
          <span class="etq">Última ronda</span>${grilla}`;
        c.querySelector('[data-otra]')?.addEventListener('click', () => sala.enviar({ t: 'empezar' }));
      }
    }
  }

  // ---------------------------------------------------------------- editor
  function inicialTextos(p) {
    const n = Math.max(2, Math.min(4, p?.cajas || 2));
    if (n === 2) return [{ x: 0.05, y: 0.03, w: 0.9, s: 0.08, c: 'blanco', t: '' }, { x: 0.05, y: 0.8, w: 0.9, s: 0.08, c: 'blanco', t: '' }];
    return Array.from({ length: n }, (_, i) => ({ x: 0.08, y: 0.04 + (i * 0.82) / (n - 1), w: 0.84, s: 0.06, c: 'blanco', t: '' }));
  }

  function pintarEditor(c) {
    const p = PL.get(ed.plantilla);
    c.innerHTML = `${cabeza('Armá tu meme', `<span class="chip"><span data-seg>${est.segCrear}</span> s · <span data-faltan></span></span>`)}
      <div class="editor"><div class="marco-meme" data-lienzo>${memeHtml(ed.plantilla, ed.textos, { editor: true })}</div></div>
      <div class="listo-banner ${est.miMeme ? '' : 'hidden'}" data-listo><span><b>¡Mandado!</b> Si querés, seguí cambiándolo y volvé a mandar antes de que se termine el tiempo.</span></div>
      <div class="barra-edicion">
        <button class="btn" data-agregar>+ Texto</button>
        <button class="btn" data-otra title="${esc(p?.nombre || '')}">Otra plantilla</button>
        <span style="flex:1"></span>
        <button class="btn btn-lima btn-grande" data-enviar>¡Listo!</button>
      </div>
      <div class="textos" data-textos></div>`;
    pintarFilas();
    const lienzo = c.querySelector('[data-lienzo]');
    lienzo.querySelector('img').onerror = () => {
      // si la imagen no carga, pedimos otra plantilla
      if (ed.fallos++ < 5) {
        toast('Esa plantilla no cargó. Te damos otra.');
        sala.enviar({ t: 'cambiar' });
      }
    };
    c.querySelector('[data-agregar]').onclick = () => {
      if (ed.textos.length >= 8) return toast('Hasta 8 textos por meme');
      ed.textos.push({ x: 0.15, y: 0.42, w: 0.7, s: 0.07, c: 'blanco', t: '' });
      ed.sel = ed.textos.length - 1;
      refrescarLienzo();
      pintarFilas(true);
    };
    c.querySelector('[data-otra]').onclick = () => {
      sala.enviar({ t: 'cambiar' });
    };
    c.querySelector('[data-enviar]').onclick = enviarMeme;
    arrastre(lienzo);
  }

  function refrescarLienzo() {
    const l = app.querySelector('[data-lienzo] .meme');
    if (!l) return;
    l.querySelectorAll('.tx').forEach((x) => x.remove());
    l.insertAdjacentHTML('beforeend', ed.textos.map((t, i) => textoHtml(t, i, true)).join(''));
    l.querySelectorAll('.tx').forEach((x) => x.classList.toggle('sel', Number(x.dataset.i) === ed.sel));
  }

  function pintarFilas(enfocar = false) {
    const cont = app.querySelector('[data-textos]');
    cont.innerHTML = ed.textos.map((t, i) => `<div class="texto-fila ${i === ed.sel ? 'sel' : ''}" data-fila="${i}">
      <textarea class="entrada" maxlength="140" placeholder="Texto ${i + 1}">${esc(t.t)}</textarea>
      <input type="range" min="0.03" max="0.16" step="0.005" value="${t.s}" title="Tamaño">
      <span class="colores">${Object.entries(COLORES).map(([k, v]) => `<button style="background:${v}" data-color="${k}" class="${t.c === k ? 'on' : ''}" title="${k}"></button>`).join('')}</span>
      <button class="borrar" data-borrar title="Borrar">✕</button></div>`).join('');
    cont.querySelectorAll('[data-fila]').forEach((f) => {
      const i = Number(f.dataset.fila);
      const t = ed.textos[i];
      const caja = () => app.querySelector(`[data-lienzo] .tx[data-i="${i}"]`);
      f.querySelector('textarea').oninput = (e) => {
        t.t = e.target.value;
        const x = caja();
        x.firstChild?.nodeType === 3 ? (x.firstChild.textContent = t.t) : x.prepend(document.createTextNode(t.t));
        x.classList.toggle('vacio', !t.t.trim());
      };
      f.querySelector('textarea').onfocus = () => seleccionar(i);
      f.querySelector('input[type=range]').oninput = (e) => {
        t.s = Number(e.target.value);
        caja().style.setProperty('--s', t.s);
      };
      f.querySelectorAll('[data-color]').forEach((b) => (b.onclick = () => {
        t.c = b.dataset.color;
        f.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b));
        const x = caja();
        x.classList.remove(...Object.keys(COLORES));
        x.classList.add(t.c);
      }));
      f.querySelector('[data-borrar]').onclick = () => {
        ed.textos.splice(i, 1);
        ed.sel = Math.max(0, Math.min(ed.sel, ed.textos.length - 1));
        refrescarLienzo();
        pintarFilas();
      };
    });
    if (enfocar) cont.querySelector(`[data-fila="${ed.sel}"] textarea`)?.focus();
  }

  function seleccionar(i) {
    ed.sel = i;
    app.querySelectorAll('[data-lienzo] .tx').forEach((x) => x.classList.toggle('sel', Number(x.dataset.i) === i));
    app.querySelectorAll('[data-fila]').forEach((x) => x.classList.toggle('sel', Number(x.dataset.fila) === i));
  }

  // arrastrar los textos por la imagen (y estirar su ancho con la manija)
  function arrastre(lienzo) {
    let d = null;
    lienzo.addEventListener('pointerdown', (e) => {
      const caja = e.target.closest('.tx');
      if (!caja) return;
      const i = Number(caja.dataset.i);
      seleccionar(i);
      const r = lienzo.querySelector('.meme').getBoundingClientRect();
      const t = ed.textos[i];
      d = { i, caja, r, x0: e.clientX, y0: e.clientY, t0: { ...t }, asa: !!e.target.closest('[data-asa]'), movio: false };
      caja.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    lienzo.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = (e.clientX - d.x0) / d.r.width;
      const dy = (e.clientY - d.y0) / d.r.height;
      if (Math.abs(dx) + Math.abs(dy) > 0.004) d.movio = true;
      const t = ed.textos[d.i];
      if (d.asa) t.w = Math.min(1 - t.x, Math.max(0.12, d.t0.w + dx));
      else {
        t.x = Math.min(1 - t.w * 0.3, Math.max(-t.w * 0.7, d.t0.x + dx));
        t.y = Math.min(0.97, Math.max(-0.02, d.t0.y + dy));
      }
      d.caja.style.left = t.x * 100 + '%';
      d.caja.style.top = t.y * 100 + '%';
      d.caja.style.width = t.w * 100 + '%';
    });
    const fin = () => {
      if (d && !d.movio) app.querySelector(`[data-fila="${d.i}"] textarea`)?.focus();
      d = null;
    };
    lienzo.addEventListener('pointerup', fin);
    lienzo.addEventListener('pointercancel', fin);
  }

  async function enviarMeme() {
    if (!ed.textos.some((t) => t.t.trim())) return toast('Escribí algo en tu meme', true);
    const r = await sala.enviar({ t: 'enviar', textos: ed.textos });
    if (r && !r.error) {
      ed.enviado = true;
      app.querySelector('[data-listo]')?.classList.remove('hidden');
    }
  }
}

ruteo();
