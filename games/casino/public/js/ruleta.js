// Ruleta europea como en un casino online: la rueda gira siempre, la bola corre en sentido contrario por la pista,
// baja golpeando los rombos, rebota entre los casilleros y queda en el número. Todos ven lo mismo al mismo tiempo
// (la animación sale del reloj del servidor). Las fichas se arrastran al paño o se ponen con un clic.
import { ficha, enFichas, fmt, VALORES_FICHA } from './piezas.js';
import { montarDesafio } from './desafio.js';
import { avatarSvg, lookDeId, lookDeNombre } from '/comun/avatar.js';

const RUEDA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const color = (n) => (n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro');
const SECTOR = 360 / 37;
const APUESTAS_MS = 35000;
const GIRO_MS = 8000;
const ASENTAR = 6.6; // segundos hasta que la bola queda quieta
const VEL_REPOSO = 18; // grados por segundo de la rueda sola

// Números que cubre cada casillero (para iluminar).
function cubre(k, n) {
  if (k === 'n' + n) return true;
  if (n === 0) return false;
  return {
    rojo: ROJOS.has(n), negro: !ROJOS.has(n), par: n % 2 === 0, impar: n % 2 === 1, falta: n <= 18, pasa: n >= 19,
    d1: n <= 12, d2: n > 12 && n <= 24, d3: n > 24, c1: n % 3 === 1, c2: n % 3 === 2, c3: n % 3 === 0,
  }[k];
}

const pol = (r, a) => [Math.sin((a * Math.PI) / 180) * r, -Math.cos((a * Math.PI) / 180) * r];
function sectorPath(r1, r2, a0, a1) {
  const [x0, y0] = pol(r1, a0);
  const [x1, y1] = pol(r1, a1);
  const [x2, y2] = pol(r2, a1);
  const [x3, y3] = pol(r2, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r2} ${r2} 0 0 0 ${x3} ${y3}Z`;
}

// Rueda en SVG: parte fija (madera, pista de la bola, rombos) y parte que gira (números, casilleros, torreta).
function ruedaSvg() {
  const FILL = { verde: '#0a8f3c', rojo: '#b8102a', negro: '#141414' };
  let numeros = '';
  let casilleros = '';
  RUEDA.forEach((n, i) => {
    const a0 = i * SECTOR - SECTOR / 2;
    const a1 = a0 + SECTOR;
    numeros += `<path d="${sectorPath(80, 68, a0, a1)}" fill="${FILL[color(n)]}" stroke="#d4af37" stroke-width=".5"/>`;
    const [tx, ty] = pol(74, i * SECTOR);
    numeros += `<text x="${tx}" y="${ty}" transform="rotate(${i * SECTOR} ${tx} ${ty})" text-anchor="middle" dominant-baseline="central" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="7" fill="#fff">${n}</text>`;
    casilleros += `<path d="${sectorPath(68, 56, a0, a1)}" fill="${FILL[color(n)]}" opacity=".78"/>`;
    const [fx0, fy0] = pol(68, a0);
    const [fx1, fy1] = pol(55, a0);
    casilleros += `<line x1="${fx0}" y1="${fy0}" x2="${fx1}" y2="${fy1}" stroke="#e8c766" stroke-width="1.1" stroke-linecap="round"/>`;
  });
  let rombos = '';
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5;
    const [x, y] = pol(86, a);
    rombos += `<path d="M0 -4L2.2 0L0 4L-2.2 0Z" fill="#e8c766" stroke="#8a6a1a" stroke-width=".5" transform="translate(${x} ${y}) rotate(${a})"/>`;
  }
  let aspas = '';
  for (let k = 0; k < 4; k++) aspas += `<rect x="-2.4" y="-30" width="4.8" height="60" rx="2.4" fill="url(#oro)" transform="rotate(${k * 45})"/>`;
  const defs = `
    <defs>
      <radialGradient id="madera" r=".75"><stop offset=".55" stop-color="#6b4324"/><stop offset=".85" stop-color="#3a2312"/><stop offset="1" stop-color="#1e1108"/></radialGradient>
      <radialGradient id="pista" r=".5"><stop offset=".8" stop-color="#2a1a0d"/><stop offset=".9" stop-color="#5a3a1e"/><stop offset="1" stop-color="#2a1a0d"/></radialGradient>
      <radialGradient id="cono" r=".6"><stop offset="0" stop-color="#8a5a31"/><stop offset="1" stop-color="#3b2414"/></radialGradient>
      <linearGradient id="oro" x1="0" x2="1"><stop offset="0" stop-color="#8a6a1a"/><stop offset=".5" stop-color="#ffe9a0"/><stop offset="1" stop-color="#8a6a1a"/></linearGradient>
      <radialGradient id="bola" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ddd"/><stop offset="1" stop-color="#7a7a7a"/></radialGradient>
    </defs>`;
  const fija = `<svg viewBox="-104 -104 208 208" aria-hidden="true">${defs}
    <circle r="103" fill="url(#madera)"/>
    <circle r="96" fill="url(#pista)"/>
    <circle r="96" fill="none" stroke="#8a5a31" stroke-width="2"/>
    ${rombos}</svg>`;
  const gira = `<svg viewBox="-104 -104 208 208" aria-hidden="true">${defs.replace(/id="/g, 'id="g-').replace(/url\(#/g, 'url(#g-')}
      <circle r="81" fill="#2b1a0e" stroke="#d4af37" stroke-width="1.2"/>
      ${numeros}${casilleros}
      <circle r="55" fill="url(#cono)" stroke="#d4af37" stroke-width="1"/>
      <circle r="34" fill="#5a3820" stroke="#d4af37" stroke-width=".8"/>
      ${aspas.replace(/url\(#oro\)/g, 'url(#g-oro)')}<circle r="8" fill="url(#g-oro)"/><circle r="3" fill="#fff8d6"/>
  </svg>`;
  return `${fija}<div class="rueda-gira" data-gira>${gira}</div><div class="bola-div" data-bola></div>`;
}

function tableroHtml() {
  let h = '<div class="c cero" data-k="n0">0</div>';
  for (let fila = 0; fila < 3; fila++) {
    for (let col = 1; col <= 12; col++) {
      const n = col * 3 - fila;
      h += `<div class="c num-${color(n)}" data-k="n${n}" style="grid-row:${fila + 1};grid-column:${col + 1}">${n}</div>`;
    }
    h += `<div class="c afuera" data-k="c${3 - fila}" style="grid-row:${fila + 1};grid-column:14">2 a 1</div>`;
  }
  ['1ª docena', '2ª docena', '3ª docena'].forEach((t, i) => (h += `<div class="c afuera" data-k="d${i + 1}" style="grid-row:4;grid-column:${2 + i * 4} / span 4">${t}</div>`));
  const ext = [['falta', '1 a 18'], ['par', 'Par'], ['rojo', '<i class="rombo" style="background:#c8102e"></i>'], ['negro', '<i class="rombo" style="background:#111"></i>'], ['impar', 'Impar'], ['pasa', '19 a 36']];
  ext.forEach(([k, t], i) => (h += `<div class="c afuera" data-k="${k}" style="grid-row:5;grid-column:${2 + i * 2} / span 2">${t}</div>`));
  return `<div class="tablero">${h}</div>`;
}

export function montarRuleta(zona, h) {
  let sel = 100;
  let est = null;
  let ultimasApuestas = []; // las de la ronda que gira (para animar el pago)
  let pagoVisto = null;
  zona.innerHTML = `
    <div class="pano" data-pano>
      <div class="ruleta-zona">
        <div>
          <div class="rueda-caja">
            <div class="rueda" data-rueda>${ruedaSvg()}</div>
            <div class="resultado-grande" data-res></div>
          </div>
          <div class="historial-ruleta" data-hist></div>
          <div class="mesa-gente" data-gente-mesa></div>
          <div class="bots-mesa"><span class="etq">Bots en la mesa</span><button class="btn btn-chico" data-bot="bot-agregar">+ Sumar bot</button><button class="btn btn-chico" data-bot="bot-sacar">Sacar</button></div>
        </div>
        <div>
          ${tableroHtml()}
          <div class="reloj-mesa"><i data-reloj></i></div>
          <div class="controles">
            <div class="selector-fichas" data-fichas>${VALORES_FICHA.map((v) => `<button class="ficha ${v === sel ? 'on' : ''}" data-v="${v}" title="Arrastrala al paño o elegila y tocá un casillero"><span>${v >= 1000 ? v / 1000 + 'K' : v}</span></button>`).join('')}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-chico" data-acc="deshacer">Deshacer</button>
              <button class="btn btn-chico" data-acc="limpiar">Sacar todo</button>
              <button class="btn btn-chico" data-acc="repetir">Repetir</button>
            </div>
          </div>
          <p class="etq" style="margin-top:12px;color:rgba(255,255,255,.7)">En la mesa: <b data-mi-total style="color:#fff">0</b> · Arrastrá las fichas al paño · Pleno paga 35 a 1 · docenas y columnas 2 a 1 · el resto 1 a 1</p>
          <div data-desafio></div>
        </div>
      </div>
      <div class="banner" data-banner><span class="etq" data-banner-t></span><b data-banner-b></b></div>
    </div>`;
  const $ = (s) => zona.querySelector(s);
  const desafio = montarDesafio($('[data-desafio]'), h);
  const tablero = zona.querySelector('.tablero');
  const gira = zona.querySelector('[data-gira]');
  const bola = zona.querySelector('[data-bola]');
  const ruedaEl = zona.querySelector('[data-rueda]');
  // la bola se mueve con transform (sin repintar la rueda): coordenadas del SVG → píxeles
  const ponerBola = (x, y) => {
    const t = ruedaEl.clientWidth / 208;
    bola.style.transform = `translate(${((x + 104) * t).toFixed(1)}px, ${((y + 104) * t).toFixed(1)}px)`;
  };

  // ---------------------------------------------------------------- apostar (clic o arrastre)
  function elegir(v) {
    sel = v;
    zona.querySelectorAll('[data-fichas] .ficha').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) === v));
  }
  // ficha que vuela desde (x, y) hasta el centro del casillero
  function volar(v, x, y, celda) {
    const r = celda.getBoundingClientRect();
    const f = document.createElement('div');
    f.innerHTML = ficha(v);
    const el = f.firstChild;
    el.classList.add('volando');
    el.style.left = `${x - 22}px`;
    el.style.top = `${y - 22}px`;
    document.body.append(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${r.left + r.width / 2 - x}px, ${r.top + r.height / 2 - y}px) scale(.62)`;
    });
    setTimeout(() => el.remove(), 380);
  }
  function apostar(celda, v, desde) {
    if (!celda || est?.fase !== 'apuestas') return;
    const b = desde || zona.querySelector(`[data-fichas] .ficha[data-v="${v}"]`).getBoundingClientRect();
    volar(v, b.x ?? b.left + b.width / 2, b.y ?? b.top + b.height / 2, celda);
    h.sonar('ficha');
    h.enviar({ t: 'apostar', casillero: celda.dataset.k, monto: v });
  }
  tablero.addEventListener('click', (e) => apostar(e.target.closest('[data-k]'), sel));
  // al pasar por un casillero de afuera se iluminan los números que cubre
  tablero.addEventListener('pointerover', (e) => {
    const c = e.target.closest('[data-k]');
    tablero.querySelectorAll('.cubierto').forEach((x) => x.classList.remove('cubierto'));
    if (!c || c.dataset.k.startsWith('n')) return;
    tablero.querySelectorAll('[data-k^="n"]').forEach((x) => cubre(c.dataset.k, Number(x.dataset.k.slice(1))) && x.classList.add('cubierto'));
  });
  tablero.addEventListener('pointerleave', () => tablero.querySelectorAll('.cubierto').forEach((x) => x.classList.remove('cubierto')));
  // arrastrar fichas
  zona.querySelectorAll('[data-fichas] .ficha').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const v = Number(b.dataset.v);
      elegir(v);
      h.sonar('clic');
      const x0 = e.clientX;
      const y0 = e.clientY;
      let fantasma = null;
      let sobre = null;
      const mover = (ev) => {
        if (!fantasma && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) {
          const d = document.createElement('div');
          d.innerHTML = ficha(v);
          fantasma = d.firstChild;
          fantasma.classList.add('arrastrada');
          document.body.append(fantasma);
        }
        if (!fantasma) return;
        fantasma.style.left = `${ev.clientX - 25}px`;
        fantasma.style.top = `${ev.clientY - 25}px`;
        const bajo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tablero [data-k]');
        if (bajo !== sobre) {
          sobre?.classList.remove('apuntado');
          sobre = bajo;
          sobre?.classList.add('apuntado');
        }
      };
      const soltar = (ev) => {
        removeEventListener('pointermove', mover);
        removeEventListener('pointerup', soltar);
        sobre?.classList.remove('apuntado');
        if (fantasma) {
          fantasma.remove();
          if (sobre) apostar(sobre, v, { x: ev.clientX, y: ev.clientY });
        }
      };
      addEventListener('pointermove', mover);
      addEventListener('pointerup', soltar);
    });
  });
  zona.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => h.enviar({ t: b.dataset.acc })));
  zona.querySelectorAll('[data-bot]').forEach((b) => (b.onclick = () => h.enviar({ t: b.dataset.bot })));

  // la gente en la mesa (personas y bots) con su avatar y un globito cuando hablan
  const avs = new Map();
  function pintarGente(e) {
    const lista = [...e.jugadores.filter((j) => j.online).map((j) => ({ id: j.id, nombre: j.nombre, bot: false })), ...(e.bots || []).map((b) => ({ id: b.id, nombre: b.nombre, bot: true }))];
    const el = $('[data-gente-mesa]');
    const firma = lista.map((x) => x.id).join();
    if (el.dataset.firma === firma) return;
    el.dataset.firma = firma;
    el.innerHTML = lista.map((x) => {
      if (!avs.has(x.id)) avs.set(x.id, avatarSvg(x.bot ? lookDeNombre(x.nombre) : lookDeId(x.id, h.colorDe(x.id)), { titulo: x.nombre }));
      return `<div class="persona-mesa" data-quien="${x.id}" data-nombre="${h.esc(x.nombre)}"><span class="av">${avs.get(x.id)}</span><small>${h.esc(x.nombre)}</small><span class="globo-mesa"></span></div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- fichas en el paño
  function pila(lista, clase = '') {
    const porCasillero = {};
    for (const { id, lista: l } of lista) for (const a of l) (porCasillero[a.k] ||= {})[id] = (porCasillero[a.k][id] || 0) + a.m;
    for (const [k, quienes] of Object.entries(porCasillero)) {
      const celda = tablero.querySelector(`[data-k="${k}"]`);
      if (!celda) continue;
      const orden = Object.entries(quienes).sort(([a], [b]) => (a === est.yo) - (b === est.yo));
      const p = document.createElement('div');
      p.className = `pila ${typeof clase === 'function' ? clase(k) : clase}`;
      let n = 0;
      for (const [id, monto] of orden) for (const v of enFichas(monto, 3)) {
        p.insertAdjacentHTML('beforeend', ficha(v, id === est.yo ? '' : 'otro').replace('class="ficha', `style="--av:${h.colorDe(id)};transform:translateY(${-n * 4}px)" class="ficha`));
        n++;
      }
      p.title = orden.map(([id, m]) => `${h.nombreDe(id)}: ${fmt(m)}`).join('\n');
      celda.append(p);
    }
  }
  function pintarFichas() {
    tablero.querySelectorAll('.pila, .dolly').forEach((p) => p.remove());
    let miTotal = 0;
    for (const { id, lista } of est.apuestas) if (id === est.yo) for (const a of lista) miTotal += a.m;
    $('[data-mi-total]').textContent = fmt(miTotal);
    if (est.fase === 'pago' && est.resultado != null) {
      // lo que se jugó: las que ganan brillan, las que pierden se las lleva la banca
      const n = est.resultado;
      pila(ultimasApuestas, (k) => (cubre(k, n) ? 'cobra' : 'barre'));
      tablero.querySelector(`[data-k="n${n}"]`)?.insertAdjacentHTML('beforeend', '<span class="dolly"></span>');
    } else pila(est.apuestas);
  }

  // ---------------------------------------------------------------- rueda y bola
  let angRueda = 0;
  let ultimoCuadro = performance.now();
  let rebotes = 0;
  let mostrado = null;
  function cuadro(ahoraMs) {
    if (!zona.isConnected) return; // se salió de la mesa
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.1, (ahoraMs - ultimoCuadro) / 1000);
    ultimoCuadro = ahoraMs;
    if (!est) return;
    const girando = est.fase === 'girando';
    const t = girando ? (h.ahora() - (est.fin - GIRO_MS)) / 1000 : Infinity;
    // la rueda: cuando se larga la bola acelera y después vuelve a su velocidad tranquila
    const vel = VEL_REPOSO + (girando ? 75 * Math.exp(-Math.max(0, t) / 3) : 0);
    angRueda = (angRueda + vel * dt) % 360;
    gira.style.transform = `rotate(${angRueda.toFixed(2)}deg)`;
    const n = est.resultado ?? est.historial[0] ?? null; // entre giros, la bola queda en el último número
    let rel; // ángulo de la bola respecto de la rueda
    let radio;
    if (n == null) {
      // todavía no se largó: la bola espera en la pista
      ponerBola(0, -91);
      return;
    }
    const destino = RUEDA.indexOf(n) * SECTOR;
    if (girando && t < ASENTAR) {
      const s = Math.max(0, t) / ASENTAR;
      // corre en contra de la rueda, cada vez más lento, y termina en el casillero
      rel = destino + 2600 * (1 - s) ** 2.1;
      if (s > 0.8) {
        const q = (s - 0.8) / 0.2;
        rel += 16 * Math.exp(-q * 4) * Math.sin(q * 26) * (1 - q);
      }
      if (s < 0.6) radio = 91 + Math.sin(t * 9) * 0.4;
      else if (s < 0.8) {
        const q = (s - 0.6) / 0.2;
        radio = 91 - 20 * q + Math.abs(Math.sin(q * Math.PI * 3)) * 5 * (1 - q); // golpea los rombos al bajar
      } else {
        const q = (s - 0.8) / 0.2;
        radio = 71 - 9 * q + Math.abs(Math.sin(q * Math.PI * 4)) * 6 * (1 - q) ** 2; // rebota entre casilleros
        const b = Math.floor(q * 4);
        if (b > rebotes) {
          rebotes = b;
          h.sonar('bola');
        }
      }
    } else {
      rel = destino;
      radio = 62;
      if (girando && mostrado !== est.giro) mostrarNumero(n);
    }
    if (girando && t < 0.2) rebotes = 0;
    const [x, y] = pol(radio, angRueda + rel);
    ponerBola(x, y);
  }
  let raf = requestAnimationFrame(cuadro);

  function mostrarNumero(n) {
    mostrado = est.giro;
    const res = $('[data-res]');
    res.className = `resultado-grande ver ${color(n)}`;
    res.textContent = n;
    tablero.querySelectorAll('[data-k]').forEach((c) => c.classList.toggle('gana', cubre(c.dataset.k, n)));
    h.sonar('aviso');
  }

  return {
    estado(e) {
      const antes = est;
      est = e;
      $('[data-pano]').classList.toggle('cerrado', e.fase !== 'apuestas');
      if (e.fase === 'girando' && antes?.fase === 'apuestas') h.sonar('bola');
      if (e.fase === 'girando') ultimasApuestas = e.apuestas;
      if (e.fase === 'apuestas') {
        h.estadoMesa('Hagan sus apuestas', 'abierta');
        if (antes?.fase !== 'apuestas') {
          $('[data-res]').className = 'resultado-grande';
          tablero.querySelectorAll('.gana').forEach((c) => c.classList.remove('gana'));
          $('[data-banner]').classList.remove('ver');
        }
      } else if (e.fase === 'girando') h.estadoMesa('No va más', 'cerrada');
      else {
        h.estadoMesa('Pagando', '');
        if (mostrado !== e.giro && e.resultado != null) mostrarNumero(e.resultado);
      }
      if (e.fase === 'pago' && pagoVisto !== e.giro) {
        pagoVisto = e.giro;
        const mio = e.pagos.find((p) => p.id === e.yo);
        if (mio && antes) {
          const neto = mio.gana - mio.puso;
          $('[data-banner]').className = `banner ver ${neto < 0 ? 'pierde' : ''}`;
          $('[data-banner-t]').textContent = mio.gana ? `Salió el ${e.resultado} · cobrás` : `Salió el ${e.resultado}`;
          $('[data-banner-b]').textContent = mio.gana ? `+${fmt(mio.gana)}` : `−${fmt(mio.puso)}`;
          h.sonar(mio.gana ? 'gana' : 'pierde');
          setTimeout(() => $('[data-banner]').classList.remove('ver'), 3200);
        }
      }
      $('[data-hist]').innerHTML = e.historial.map((n) => `<span class="r-${color(n)}">${n}</span>`).join('');
      pintarGente(e);
      pintarFichas();
      desafio.estado(e);
      zona.querySelector('[data-acc="repetir"]').disabled = !e.puedeRepetir || e.fase !== 'apuestas';
    },
    // alguien habló en el chat: si está en la mesa, se ve el globito
    dice(ev) {
      const p = [...zona.querySelectorAll('.persona-mesa')].find((x) => x.dataset.nombre === ev.nombre);
      const g = p?.querySelector('.globo-mesa');
      if (!g) return;
      g.textContent = ev.texto;
      g.classList.remove('ver');
      void g.offsetWidth;
      g.classList.add('ver');
      clearTimeout(g._t);
      g._t = setTimeout(() => g.classList.remove('ver'), 4500);
    },
    reloj() {
      if (!est) return;
      const total = est.fase === 'apuestas' ? APUESTAS_MS : est.fase === 'girando' ? GIRO_MS : 6500;
      const q = Math.max(0, est.fin - h.ahora());
      $('[data-reloj]').style.transform = `scaleX(${Math.min(1, q / total)})`;
      if (est.fase === 'apuestas') h.estadoMesa(q < 5000 ? `Últimas apuestas · ${Math.ceil(q / 1000)}` : `Hagan sus apuestas · ${Math.ceil(q / 1000)}`, 'abierta');
    },
  };
}
