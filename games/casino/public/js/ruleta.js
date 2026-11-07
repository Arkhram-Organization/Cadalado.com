import { ficha, enFichas, fmt, VALORES_FICHA } from './piezas.js';

const RUEDA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const color = (n) => (n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro');
const SECTOR = 360 / 37;

// Números que cubre cada casillero (para iluminar los ganadores).
function cubre(k, n) {
  if (k === 'n' + n) return true;
  if (n === 0) return false;
  return {
    rojo: ROJOS.has(n), negro: !ROJOS.has(n), par: n % 2 === 0, impar: n % 2 === 1, falta: n <= 18, pasa: n >= 19,
    d1: n <= 12, d2: n > 12 && n <= 24, d3: n > 24, c1: n % 3 === 1, c2: n % 3 === 2, c3: n % 3 === 0,
  }[k];
}

function ruedaSvg() {
  const r1 = 96;
  const r2 = 70;
  const r3 = 44;
  const p = (r, a) => [Math.sin((a * Math.PI) / 180) * r, -Math.cos((a * Math.PI) / 180) * r];
  let s = '';
  RUEDA.forEach((n, i) => {
    const a0 = i * SECTOR - SECTOR / 2;
    const a1 = a0 + SECTOR;
    const [x0, y0] = p(r1, a0);
    const [x1, y1] = p(r1, a1);
    const [x2, y2] = p(r2, a1);
    const [x3, y3] = p(r2, a0);
    const fill = { verde: '#0a8f3c', rojo: '#c8102e', negro: '#161616' }[color(n)];
    s += `<path d="M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r2} ${r2} 0 0 0 ${x3} ${y3}Z" fill="${fill}" stroke="#d4af37" stroke-width=".6"/>`;
    const [tx, ty] = p(84, i * SECTOR);
    s += `<text x="${tx}" y="${ty}" transform="rotate(${i * SECTOR} ${tx} ${ty})" text-anchor="middle" dominant-baseline="central" font-family="Unbounded, sans-serif" font-weight="800" font-size="8.5" fill="#fff">${n}</text>`;
  });
  // centro con aspas doradas
  let aspas = '';
  for (let k = 0; k < 4; k++) aspas += `<rect x="-3" y="-38" width="6" height="76" rx="3" fill="#d4af37" transform="rotate(${k * 45})"/>`;
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true">
    <circle r="99" fill="#2a170b"/>${s}
    <circle r="${r2}" fill="#3b2414"/><circle r="${r3 + 18}" fill="#5a3820" stroke="#d4af37" stroke-width="1.5"/>
    <circle r="${r3}" fill="#7a4a24"/>${aspas}<circle r="10" fill="#d4af37"/><circle r="4" fill="#fff8d6"/></svg>`;
}

function tableroHtml() {
  let h = '<div class="c cero" data-k="n0">0</div>';
  // 3 filas (arriba 3,6,9…; medio 2,5…; abajo 1,4…) y 12 columnas
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
  let angulo = 0;
  let giroVisto = null;
  let est = null;
  zona.innerHTML = `
    <div class="pano" data-pano>
      <div class="ruleta-zona">
        <div>
          <div class="rueda-caja">
            <div class="puntero"></div>
            <div class="rueda" data-rueda>${ruedaSvg()}</div>
            <div class="bola-pista" data-pista><div class="bola"></div></div>
            <div class="resultado-grande" data-res></div>
          </div>
          <div class="historial-ruleta" data-hist></div>
        </div>
        <div>
          ${tableroHtml()}
          <div class="reloj-mesa"><i data-reloj></i></div>
          <div class="controles">
            <div class="selector-fichas" data-fichas>${VALORES_FICHA.map((v) => `<button class="ficha ${v === sel ? 'on' : ''}" data-v="${v}" title="Ficha de ${fmt(v)}"><span>${v >= 1000 ? v / 1000 + 'K' : v}</span></button>`).join('')}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-chico" data-acc="deshacer">↶ Deshacer</button>
              <button class="btn btn-chico" data-acc="limpiar">Sacar todo</button>
              <button class="btn btn-chico" data-acc="repetir">Repetir</button>
            </div>
          </div>
          <p class="etq" style="margin-top:12px;color:rgba(255,255,255,.7)">En la mesa: <b data-mi-total style="color:#fff">0</b> · Pleno paga 35 a 1 · docenas y columnas 2 a 1 · el resto 1 a 1</p>
        </div>
      </div>
      <div class="banner" data-banner><span class="etq" data-banner-t></span><b data-banner-b></b></div>
    </div>`;
  const $ = (s) => zona.querySelector(s);
  $('[data-hist]').innerHTML = '';

  zona.querySelectorAll('[data-fichas] .ficha').forEach((b) => (b.onclick = () => {
    sel = Number(b.dataset.v);
    zona.querySelectorAll('[data-fichas] .ficha').forEach((x) => x.classList.toggle('on', x === b));
    h.sonar('clic');
  }));
  zona.querySelector('.tablero').addEventListener('click', (e) => {
    const c = e.target.closest('[data-k]');
    if (!c || est?.fase !== 'apuestas') return;
    h.sonar('ficha');
    h.enviar({ t: 'apostar', casillero: c.dataset.k, monto: sel });
  });
  zona.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => h.enviar({ t: b.dataset.acc })));

  function pintarFichas() {
    zona.querySelectorAll('.tablero .pila').forEach((p) => p.remove());
    const porCasillero = {};
    let miTotal = 0;
    for (const { id, lista } of est.apuestas) for (const a of lista) {
      (porCasillero[a.k] ||= {})[id] = (porCasillero[a.k][id] || 0) + a.m;
      if (id === est.yo) miTotal += a.m;
    }
    $('[data-mi-total]').textContent = fmt(miTotal);
    for (const [k, quienes] of Object.entries(porCasillero)) {
      const celda = zona.querySelector(`.tablero [data-k="${k}"]`);
      if (!celda) continue;
      // las mías arriba de todo; las de otros con un borde de su color
      const orden = Object.entries(quienes).sort(([a], [b]) => (a === est.yo) - (b === est.yo));
      const pila = document.createElement('div');
      pila.className = 'pila';
      let n = 0;
      for (const [id, monto] of orden) for (const v of enFichas(monto, 3)) {
        pila.insertAdjacentHTML('beforeend', ficha(v, id === est.yo ? '' : 'otro').replace('class="ficha', `style="--av:${h.colorDe(id)};transform:translateY(${-n * 4}px)" class="ficha`));
        n++;
      }
      pila.title = orden.map(([id, m]) => `${h.nombreDe(id)}: ${fmt(m)}`).join('\n');
      celda.append(pila);
    }
  }

  function girar(n, pasado) {
    const idx = RUEDA.indexOf(n);
    // dar varias vueltas y frenar con el número debajo de la bola (arriba)
    const destino = -idx * SECTOR;
    const base = angulo - (angulo % 360) - 360 * 5;
    angulo = base + destino;
    const rueda = $('[data-rueda]');
    const pista = $('[data-pista]');
    if (pasado > 3500) {
      rueda.style.transition = 'none';
      rueda.style.transform = `rotate(${angulo}deg)`;
      void rueda.offsetWidth;
      rueda.style.transition = '';
      pista.classList.remove('gira');
      return mostrarNumero(n);
    }
    rueda.style.transform = `rotate(${angulo}deg)`;
    pista.classList.remove('gira');
    void pista.offsetWidth;
    pista.classList.add('gira');
    let ticks = 0;
    const t = setInterval(() => {
      if (++ticks > 22) return clearInterval(t);
      h.sonar('bola');
    }, 120 + ticks * 12);
    setTimeout(() => mostrarNumero(n), 7000 - Math.max(0, pasado));
  }

  function mostrarNumero(n) {
    const res = $('[data-res]');
    res.className = `resultado-grande ver ${color(n)}`;
    res.textContent = n;
    zona.querySelectorAll('.tablero [data-k]').forEach((c) => c.classList.toggle('gana', cubre(c.dataset.k, n)));
  }

  return {
    estado(e) {
      const nuevoGiro = e.fase === 'girando' && e.giro !== giroVisto;
      const primera = !est;
      est = e;
      $('[data-pano]').classList.toggle('cerrado', e.fase !== 'apuestas');
      if (e.fase === 'apuestas') {
        h.estadoMesa('Hagan sus apuestas', 'abierta');
        $('[data-res]').className = 'resultado-grande';
        zona.querySelectorAll('.tablero .gana').forEach((c) => c.classList.remove('gana'));
        $('[data-banner]').classList.remove('ver');
      } else if (e.fase === 'girando') h.estadoMesa('No va más', 'cerrada');
      else h.estadoMesa('Pagando', '');
      if (nuevoGiro) {
        giroVisto = e.giro;
        girar(e.resultado, primera ? 7000 - (e.fin - h.ahora() - 1000) : 0);
      } else if (primera && e.resultado != null) {
        giroVisto = e.giro;
        girar(e.resultado, 99999);
      }
      if (e.fase === 'pago') {
        const mio = e.pagos.find((p) => p.id === e.yo);
        if (mio && !$('[data-banner]').classList.contains('ver')) {
          const neto = mio.gana - mio.puso;
          $('[data-banner]').className = `banner ver ${neto < 0 ? 'pierde' : ''}`;
          $('[data-banner-t]').textContent = mio.gana ? `Salió el ${e.resultado} · cobrás` : `Salió el ${e.resultado}`;
          $('[data-banner-b]').textContent = mio.gana ? `+${fmt(mio.gana)}` : `−${fmt(mio.puso)}`;
          h.sonar(mio.gana ? 'gana' : 'pierde');
        }
      }
      $('[data-hist]').innerHTML = e.historial.map((n) => `<span class="r-${color(n)}">${n}</span>`).join('');
      pintarFichas();
      zona.querySelector('[data-acc="repetir"]').disabled = !e.puedeRepetir || e.fase !== 'apuestas';
    },
    reloj() {
      if (!est) return;
      const total = est.fase === 'apuestas' ? 22000 : est.fase === 'girando' ? 8000 : 6500;
      const q = Math.max(0, est.fin - h.ahora());
      $('[data-reloj]').style.transform = `scaleX(${Math.min(1, q / total)})`;
      if (est.fase === 'apuestas') h.estadoMesa(`Hagan sus apuestas · ${Math.ceil(q / 1000)}`, 'abierta');
    },
  };
}
