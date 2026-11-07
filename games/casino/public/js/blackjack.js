import { ficha, enFichas, fmt, carta, VALORES_FICHA } from './piezas.js';

const RES = { gana: 'Ganó', pierde: 'Perdió', empate: 'Empate', blackjack: 'Blackjack' };

export function montarBlackjack(zona, h) {
  let sel = 100;
  let est = null;
  const vistas = {}; // cartas ya mostradas por lugar (para animar solo las nuevas)
  zona.innerHTML = `
    <div class="pano" style="padding:14px">
      <div class="bj-mesa">
        <div class="bj-banca"><span class="etq">Banca</span><div class="mano" data-banca style="margin-top:8px;min-height:96px"></div><div style="margin-top:8px" data-banca-total></div></div>
        <div class="bj-leyenda">Blackjack paga 3 a 2<b>La banca se planta en 17</b></div>
        <div class="asientos" data-asientos></div>
      </div>
      <div class="reloj-mesa"><i data-reloj></i></div>
      <div data-controles style="margin-top:14px"></div>
      <div class="banner" data-banner><span class="etq" data-banner-t></span><b data-banner-b></b></div>
    </div>`;
  const $ = (s) => zona.querySelector(s);

  function mano(cartas, clave) {
    const ya = vistas[clave] || 0;
    vistas[clave] = cartas.length;
    if (cartas.length > ya && ya >= 0) h.sonar('carta');
    return cartas.map((c, i) => carta(c, { nueva: i >= ya, rot: (i - (cartas.length - 1) / 2) * 4 })).join('');
  }

  function pintar() {
    const e = est;
    $('[data-banca]').innerHTML = mano(e.banca, 'banca');
    $('[data-banca-total]').innerHTML = e.banca.length ? `<span class="total ${e.bancaTotal > 21 ? 'pasado' : ''}">${e.bancaTotal}${e.banca.includes('X') ? ' + ?' : ''}</span>` : '';
    const mio = e.asientos.findIndex((a) => a?.soyYo);
    $('[data-asientos]').innerHTML = e.asientos.map((a, i) => {
      if (!a) {
        vistas['a' + i] = 0;
        return `<div class="asiento">${mio < 0 ? `<button class="lugar" data-sentarse="${i}">Sentarse</button>` : '<div class="lugar">Libre</div>'}</div>`;
      }
      const fichas = enFichas(a.apuesta, 4).map((v, k) => ficha(v).replace('class="ficha', `style="position:absolute;transform:translateY(${-k * 4}px)" class="ficha`)).join('');
      const clase = a.total > 21 ? 'pasado' : a.cartas.length === 2 && a.total === 21 ? 'bj' : '';
      return `<div class="asiento ${a.soyYo ? 'yo' : ''} ${e.fase === 'jugando' && e.turno === i ? 'turno' : ''}">
        ${a.res ? `<span class="res-asiento ${a.res}">${RES[a.res]}${a.cobra > a.apuesta ? ` +${fmt(a.cobra)}` : ''}</span>` : ''}
        <div class="mano">${mano(a.cartas, 'a' + i)}</div>
        ${a.cartas.length ? `<span class="total ${clase}">${clase === 'bj' ? 'BJ' : a.total}</span>` : ''}
        <div class="lugar" style="position:relative">${a.apuesta ? `<span style="display:grid;place-items:center;position:relative;width:40px;height:40px">${fichas}</span>` : ''}</div>
        <span class="mono" style="font-size:12px;color:#fff">${a.apuesta ? fmt(a.apuesta) : ''}</span>
        <span class="quien">${h.esc(a.nombre)}${a.soyYo ? ' (vos)' : ''}</span>
      </div>`;
    }).join('');
    zona.querySelectorAll('[data-sentarse]').forEach((b) => (b.onclick = () => {
      h.sonar('clic');
      h.enviar({ t: 'sentarse', asiento: Number(b.dataset.sentarse) });
    }));

    // controles
    const a = e.asientos[mio];
    let c = '';
    if (mio < 0) c = `<p style="text-align:center;color:var(--blanco-2)">Tocá un lugar libre para sentarte a la mesa.</p>`;
    else if (e.fase === 'apuestas' || e.fase === 'espera') {
      c = `<div class="controles" style="margin-top:0">
        <div class="selector-fichas">${VALORES_FICHA.map((v) => `<button class="ficha ${v === sel ? 'on' : ''}" data-v="${v}"><span>${v >= 1000 ? v / 1000 + 'K' : v}</span></button>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-lima" data-apostar>Apostar ${fmt(sel)}</button><button class="btn btn-chico" data-acc="limpiar" ${a.apuesta ? '' : 'disabled'}>Sacar</button><button class="btn btn-chico btn-borde" data-acc="levantarse">Levantarme</button></div></div>`;
    } else if (e.fase === 'jugando' && e.turno === mio) {
      c = `<div class="bj-acciones"><button class="btn btn-lima btn-grande" data-acc="pedir">Pedir carta</button><button class="btn btn-grande" data-acc="plantarse">Plantarme</button>${a.cartas.length === 2 ? `<button class="btn btn-grande" data-acc="doblar">Doblar (${fmt(a.apuesta)})</button>` : ''}</div>`;
    } else if (e.fase === 'jugando') c = `<p style="text-align:center;color:var(--blanco-2)">${e.turno >= 0 ? `Juega ${h.esc(e.asientos[e.turno]?.nombre || '')}…` : ''}</p>`;
    $('[data-controles]').innerHTML = c;
    $('[data-controles]').querySelectorAll('.ficha').forEach((b) => (b.onclick = () => {
      sel = Number(b.dataset.v);
      h.sonar('clic');
      pintar();
    }));
    $('[data-controles]').querySelector('[data-apostar]')?.addEventListener('click', () => {
      h.sonar('ficha');
      h.enviar({ t: 'apostar', monto: sel });
    });
    $('[data-controles]').querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => {
      h.sonar(b.dataset.acc === 'pedir' || b.dataset.acc === 'doblar' ? 'carta' : 'clic');
      h.enviar({ t: b.dataset.acc });
    }));

    // resultado propio
    if (e.fase === 'pago' && a?.res && !$('[data-banner]').classList.contains('ver')) {
      const neto = a.cobra - a.apuesta;
      $('[data-banner]').className = `banner ver ${neto < 0 ? 'pierde' : ''}`;
      $('[data-banner-t]').textContent = RES[a.res];
      $('[data-banner-b]').textContent = neto > 0 ? `+${fmt(neto)}` : neto < 0 ? `−${fmt(-neto)}` : 'Recuperás tu apuesta';
      h.sonar(neto > 0 ? 'gana' : neto < 0 ? 'pierde' : 'aviso');
    }
    if (e.fase !== 'pago') $('[data-banner]').classList.remove('ver');
  }

  return {
    estado(e) {
      const antes = est;
      est = e;
      if (e.fase === 'apuestas' && antes?.fase !== 'apuestas') for (const k of Object.keys(vistas)) vistas[k] = 0;
      const mio = e.asientos.findIndex((a) => a?.soyYo);
      if (e.fase === 'jugando' && e.turno === mio && antes?.turno !== mio) h.sonar('aviso');
      h.estadoMesa(
        { espera: 'Esperando jugadores', apuestas: 'Hagan sus apuestas', jugando: 'Mano en juego', banca: 'Juega la banca', pago: 'Pagando' }[e.fase],
        e.fase === 'apuestas' ? 'abierta' : e.fase === 'jugando' || e.fase === 'banca' ? 'cerrada' : ''
      );
      pintar();
    },
    reloj() {
      if (!est) return;
      const total = { apuestas: 15000, jugando: 20000, banca: 950, pago: 6000 }[est.fase] || 1;
      const q = est.fase === 'espera' ? 0 : Math.max(0, est.fin - h.ahora());
      $('[data-reloj]').style.transform = `scaleX(${Math.min(1, q / total)})`;
      if (est.fase === 'apuestas') h.estadoMesa(`Hagan sus apuestas · ${Math.ceil(q / 1000)}`, 'abierta');
    },
  };
}
