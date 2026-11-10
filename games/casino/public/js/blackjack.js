import { fmt, VALORES_FICHA } from './piezas.js';
import { montarDesafio } from './desafio.js';
import { MesaBJ } from './mesa3d.js';

const RES = { gana: 'Ganó', pierde: 'Perdió', empate: 'Empate', blackjack: 'Blackjack' };

export function montarBlackjack(zona, h) {
  let sel = 100;
  let est = null;
  let miLugar = null;
  let sentandose = false;
  zona.innerHTML = `
    <div class="pano bj3d-pano">
      <div class="bj3d" data-escena><div class="bj3d-ayuda">Arrastrá para mirar la mesa · rueda para acercar</div><button class="btn btn-chico bj3d-full" data-full title="Pantalla completa">Pantalla completa</button></div>
      <div class="reloj-mesa"><i data-reloj></i></div>
      <div data-controles style="margin-top:14px"></div>
      <div data-desafio></div>
      <div class="banner" data-banner><span class="etq" data-banner-t></span><b data-banner-b></b></div>
    </div>`;
  const $ = (s) => zona.querySelector(s);
  const mesa = new MesaBJ($('[data-escena]'));
  const desafio = montarDesafio($('[data-desafio]'), h);
  $('[data-full]').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const alCambiarPantalla = () => {
    zona.querySelector('[data-full]').textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
    setTimeout(() => mesa.redimensionar(), 60);
  };
  document.addEventListener('fullscreenchange', alCambiarPantalla);
  // la primera vez que tocás la mesa, pasa a pantalla completa de verdad (el navegador lo pide con un toque)
  zona.addEventListener('pointerdown', () => {
    if (!document.fullscreenElement && !zona.dataset.yaFull) {
      zona.dataset.yaFull = '1';
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, { once: true });

  function pintarControles() {
    const e = est;
    const mio = e.asientos.findIndex((a) => a?.soyYo);
    const a = e.asientos[mio];
    let c = '';
    if (mio < 0) {
      c = `<div class="bj-lugares"><span class="etq" style="color:#fff">Elegí un lugar</span>${e.asientos.map((x, i) => `<button class="btn ${x ? '' : 'btn-lima'}" data-sentarse="${i}" ${x ? 'disabled' : ''}>${x ? h.esc(x.nombre) : `Lugar ${i + 1}`}</button>`).join('')}</div>`;
    } else if (e.fase === 'apuestas' || e.fase === 'espera' || e.fase === 'pago') {
      const libres = e.asientos.some((x) => !x);
      const bots = e.asientos.map((x, i) => (x?.bot ? i : -1)).filter((i) => i >= 0);
      c = `<div class="controles" style="margin-top:0">
        ${e.fase !== 'pago' ? `<div class="selector-fichas">${VALORES_FICHA.map((v) => `<button class="ficha ${v === sel ? 'on' : ''}" data-v="${v}"><span>${v >= 1000 ? v / 1000 + 'K' : v}</span></button>`).join('')}</div>` : '<span></span>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${e.fase !== 'pago' ? `<span class="mono" style="color:#fff">En juego: <b>${fmt(a.apuesta)}</b></span><button class="btn btn-lima" data-apostar>Apostar ${fmt(sel)}</button><button class="btn btn-chico" data-acc="limpiar" ${a.apuesta ? '' : 'disabled'}>Sacar</button>` : ''}
        ${libres ? '<button class="btn btn-chico" data-bot="bot-sentar">+ Sentar un bot</button>' : ''}${bots.length ? `<button class="btn btn-chico" data-bot="bot-sacar" data-asiento="${bots.at(-1)}">Sacar bot</button>` : ''}
        <button class="btn btn-chico btn-borde" data-acc="levantarse">Levantarme</button></div></div>`;
    } else if (e.fase === 'jugando' && e.turno === mio) {
      c = `<div class="bj-acciones"><button class="btn btn-lima btn-grande" data-acc="pedir">Pedir carta</button><button class="btn btn-grande" data-acc="plantarse">Plantarme</button>${a.cartas.length === 2 ? `<button class="btn btn-grande" data-acc="doblar">Doblar (${fmt(a.apuesta)})</button>` : ''}</div>`;
    } else if (e.fase === 'jugando') c = `<p style="text-align:center;color:var(--blanco-2)">${e.turno >= 0 ? `Juega ${h.esc(e.asientos[e.turno]?.nombre || '')}…` : ''}</p>`;
    else c = `<p style="text-align:center;color:var(--blanco-2)">Juega la banca…</p>`;
    const el = $('[data-controles]');
    if (el.dataset.firma === c) return;
    el.dataset.firma = c;
    el.innerHTML = c;
    el.querySelectorAll('[data-bot]').forEach((b) => (b.onclick = () => h.enviar({ t: b.dataset.bot, asiento: b.dataset.asiento != null ? Number(b.dataset.asiento) : undefined })));
    el.querySelectorAll('[data-sentarse]').forEach((b) => (b.onclick = () => {
      h.sonar('clic');
      h.enviar({ t: 'sentarse', asiento: Number(b.dataset.sentarse) });
    }));
    el.querySelectorAll('.ficha').forEach((b) => (b.onclick = () => {
      sel = Number(b.dataset.v);
      h.sonar('clic');
      el.dataset.firma = '';
      pintarControles();
    }));
    el.querySelector('[data-apostar]')?.addEventListener('click', () => {
      h.sonar('ficha');
      h.enviar({ t: 'apostar', monto: sel });
    });
    el.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => {
      h.sonar(b.dataset.acc === 'pedir' || b.dataset.acc === 'doblar' ? 'carta' : 'clic');
      h.enviar({ t: b.dataset.acc });
    }));
  }

  return {
    estado(e) {
      const antes = est;
      est = e;
      const mio = e.asientos.findIndex((a) => a?.soyYo);
      // Entrar a una mesa libre significa sentarse: se evita la pantalla previa de elección.
      if (mio < 0 && !sentandose) {
        const libre = e.asientos.findIndex((a) => !a);
        if (libre >= 0) {
          sentandose = true;
          h.enviar({ t: 'sentarse', asiento: libre }).then(() => { sentandose = false; });
        }
      }
      if (mio !== miLugar) {
        miLugar = mio;
        mesa.mirarDesde(mio);
      }
      if (e.fase === 'jugando' && e.turno === mio && antes?.turno !== mio) h.sonar('aviso');
      const nuevas = (lista, prev) => lista.length > (prev?.length || 0);
      if (antes && (nuevas(e.banca, antes.banca) || e.asientos.some((a, i) => a && nuevas(a.cartas, antes.asientos[i]?.cartas)))) h.sonar('carta');
      mesa.actualizar(e, { color: h.colorDe, look: h.lookDe });
      h.estadoMesa(
        { espera: 'Esperando jugadores', apuestas: 'Hagan sus apuestas', jugando: 'Mano en juego', banca: 'Juega la banca', pago: 'Pagando' }[e.fase],
        e.fase === 'apuestas' ? 'abierta' : e.fase === 'jugando' || e.fase === 'banca' ? 'cerrada' : ''
      );
      pintarControles();
      desafio.estado(e);
      const a = e.asientos[mio];
      if (e.fase === 'pago' && a?.res && !$('[data-banner]').classList.contains('ver')) {
        const neto = a.cobra - a.apuesta;
        $('[data-banner]').className = `banner ver ${neto < 0 ? 'pierde' : ''}`;
        $('[data-banner-t]').textContent = RES[a.res];
        $('[data-banner-b]').textContent = neto > 0 ? `+${fmt(neto)}` : neto < 0 ? `−${fmt(-neto)}` : 'Recuperás tu apuesta';
        h.sonar(neto > 0 ? 'gana' : neto < 0 ? 'pierde' : 'aviso');
        setTimeout(() => $('[data-banner]').classList.remove('ver'), 3000);
      }
      if (e.fase !== 'pago') $('[data-banner]').classList.remove('ver');
    },
    // alguien habló en el chat: Dobro o el que está sentado lo dice en su globito
    dice(ev) {
      if (ev.npc === 'dobro') return mesa.hablar(ev.texto);
      const i = est?.asientos.findIndex((a) => a?.nombre === ev.nombre);
      if (i >= 0) mesa.decirAsiento(i, ev.texto);
    },
    destruir() {
      document.removeEventListener('fullscreenchange', alCambiarPantalla);
      mesa.destruir();
    },
    reloj() {
      if (!est) return;
      const total = { apuestas: 35000, jugando: 30000, banca: 950, pago: 6000 }[est.fase] || 1;
      const q = est.fase === 'espera' ? 0 : Math.max(0, est.fin - h.ahora());
      $('[data-reloj]').style.transform = `scaleX(${Math.min(1, q / total)})`;
      if (est.fase === 'apuestas') h.estadoMesa(`Hagan sus apuestas · ${Math.ceil(q / 1000)}`, 'abierta');
    },
  };
}
