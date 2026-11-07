import { SIMBOLO, NOMBRES_SIMBOLO, fmt } from './piezas.js';

const APUESTAS = [10, 50, 100, 500, 1000];
const LINEAS = [
  [[0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];
const TABLA = [['siete', 'Pozo (línea del medio, apuesta 100+)'], ['siete', '250×'], ['diamante', '150×'], ['bar', '80×'], ['campana', '40×'], ['uva', '25×'], ['naranja', '15×'], ['limon', '12×'], ['cereza', '10×']];
const azar = () => NOMBRES_SIMBOLO[Math.floor(Math.random() * NOMBRES_SIMBOLO.length)];

export function montarSlots(zona, h) {
  let apuesta = 100;
  let est = null;
  let girando = false;
  let ultimaN = null;
  let pozoMostrado = null;
  zona.innerHTML = `
    <div class="slots-zona">
      <div class="maquina">
        <div class="marquesina"><span class="etq">Pozo acumulado · lo comparte todo el salón</span><div class="pozo" data-pozo>—</div></div>
        <div class="luces">${'<i></i>'.repeat(14)}</div>
        <div class="ventana">
          ${[0, 1, 2].map((i) => `<div class="rodillo" data-rod="${i}"><div class="tira">${[azar(), azar(), azar()].map((s) => `<div class="s">${SIMBOLO[s]}</div>`).join('')}</div></div>`).join('')}
          <div class="lineas-premio" data-lineas></div>
        </div>
        <div class="premio-slot" data-premio></div>
        <div class="panel-slots">
          <div><span class="etq" style="color:#ffe9a8">Apuesta por tirada</span><div class="apuestas-slot" data-apuestas style="margin-top:6px">${APUESTAS.map((v) => `<button data-v="${v}" class="${v === apuesta ? 'on' : ''}">${fmt(v)}</button>`).join('')}</div></div>
          <button class="palanca" data-tirar>TIRAR</button>
        </div>
      </div>
      <aside style="display:flex;flex-direction:column;gap:14px">
        <div class="panel"><h3 style="font-size:16px;margin-bottom:10px">Premios del salón</h3><div class="feed" data-feed></div></div>
        <div class="panel"><h3 style="font-size:16px;margin-bottom:10px">Pagos (3 iguales en una línea)</h3>
          <div class="tabla-premios">${TABLA.map(([s, t]) => `<span>${SIMBOLO[s].repeat(3)}</span><span>${t}</span>`).join('')}<span>${SIMBOLO.cereza.repeat(2)}</span><span>5×</span><span>${SIMBOLO.cereza}</span><span>2×</span></div>
          <p class="etq" style="margin-top:10px">5 líneas · cada línea vale la apuesta ÷ 5</p></div>
      </aside>
    </div>`;
  const $ = (s) => zona.querySelector(s);
  const alto = () => $('.rodillo .s').getBoundingClientRect().height || 100;

  zona.querySelectorAll('[data-apuestas] button').forEach((b) => (b.onclick = () => {
    apuesta = Number(b.dataset.v);
    zona.querySelectorAll('[data-apuestas] button').forEach((x) => x.classList.toggle('on', x === b));
    h.sonar('clic');
  }));

  // mientras se espera la respuesta, los rodillos giran rápido con símbolos al azar
  function arrancarGiro() {
    zona.querySelectorAll('.rodillo').forEach((r) => {
      const tira = r.querySelector('.tira');
      tira.style.transition = 'none';
      tira.style.transform = '';
      tira.innerHTML = Array.from({ length: 8 }, () => `<div class="s">${SIMBOLO[azar()]}</div>`).join('');
      r.classList.add('girando');
    });
  }

  function frenar(u) {
    const h1 = alto();
    return Promise.all(
      [0, 1, 2].map(
        (i) =>
          new Promise((ok) => {
            const r = zona.querySelector(`[data-rod="${i}"]`);
            const tira = r.querySelector('.tira');
            const relleno = Array.from({ length: 14 + i * 5 }, azar);
            const todos = [...u.rod[i], ...relleno]; // el resultado arriba; la tira baja hasta mostrarlo
            tira.innerHTML = todos.map((s) => `<div class="s">${SIMBOLO[s]}</div>`).join('');
            r.classList.remove('girando');
            tira.style.transition = 'none';
            tira.style.transform = `translateY(${-(todos.length - 3) * h1}px)`;
            void tira.offsetWidth;
            const dur = 0.9 + i * 0.45;
            tira.style.transition = `transform ${dur}s cubic-bezier(.18,.9,.25,1.06)`;
            tira.style.transform = 'translateY(0)';
            setTimeout(() => {
              h.sonar('clic');
              ok();
            }, dur * 1000);
          })
      )
    );
  }

  function pintarLineas(lineas) {
    const cont = $('[data-lineas]');
    if (!lineas?.length) return (cont.innerHTML = '');
    const x = (c) => 16.6 + c * 33.3;
    const y = (f) => 16.6 + f * 33.3;
    cont.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lineas.map((i) => {
      const l = LINEAS[i];
      return `<line x1="${x(l[0][0]) - 12}" y1="${y(l[0][1])}" x2="${x(l[2][0]) + 12}" y2="${y(l[2][1])}" vector-effect="non-scaling-stroke"/>`;
    }).join('')}</svg>`;
  }

  $('[data-tirar]').onclick = async () => {
    if (girando) return;
    girando = true;
    $('[data-tirar]').disabled = true;
    $('[data-premio]').textContent = '';
    pintarLineas(null);
    h.sonar('ficha');
    arrancarGiro();
    const r = await h.enviar({ t: 'tirar', apuesta });
    const u = r?.estado?.ultima || est?.ultima;
    if (!r || r.error || !u || u.n === ultimaN) {
      zona.querySelectorAll('.rodillo').forEach((x) => x.classList.remove('girando'));
      girando = false;
      $('[data-tirar]').disabled = false;
      return;
    }
    ultimaN = u.n;
    await frenar(u);
    pintarLineas(u.lineas);
    if (u.pozo) {
      $('[data-premio]').textContent = `¡POZO! +${fmt(u.gana)}`;
      h.sonar('jackpot');
    } else if (u.gana) {
      $('[data-premio]').textContent = `+${fmt(u.gana)}`;
      h.sonar(u.gana >= u.apuesta * 5 ? 'jackpot' : 'gana');
    }
    h.mostrarSaldo();
    girando = false;
    $('[data-tirar]').disabled = false;
  };

  function pozo(n) {
    const el = $('[data-pozo]');
    if (pozoMostrado == null) {
      pozoMostrado = n;
      el.textContent = fmt(n);
      return;
    }
    const desde = pozoMostrado;
    pozoMostrado = n;
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / 800);
      el.textContent = fmt(Math.round(desde + (n - desde) * k));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  return {
    estado(e) {
      est = e;
      if (ultimaN == null && e.ultima && !girando) ultimaN = e.ultima.n; // última tirada de antes de entrar
      h.estadoMesa(`${fmt(e.tiradas)} tiradas en el salón`, 'abierta');
      pozo(e.pozo);
      $('[data-feed]').innerHTML = e.feed.length
        ? e.feed.map((f) => `<div class="${f.pozo ? 'pozo' : ''}"><b>${h.esc(f.nombre)}</b> ${f.pozo ? 'se llevó el pozo:' : 'ganó'} <b>${fmt(f.gana)}</b></div>`).join('')
        : '<p class="etq">Acá aparecen los premios grandes de todos.</p>';
    },
    reloj() {},
    // el saldo se actualiza recién cuando frenan los rodillos (para no adelantar el resultado)
    retenerSaldo: () => girando,
  };
}
