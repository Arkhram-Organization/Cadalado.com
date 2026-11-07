// Desafío de mesa: alguien propone X fichas, los demás aceptan o no.
// El que más gane en la próxima ronda se lleva el pozo. (Fichas de mentira.)
import { fmt } from './piezas.js';

export function montarDesafio(el, h) {
  let monto = 1000;
  let firma = '';
  let resVisto = null;
  el.classList.add('desafio');
  function pintar(e) {
    const d = e.desafio;
    const abierta = e.fase === 'apuestas';
    const f = JSON.stringify([d, abierta, e.yo]);
    if (f === firma) return;
    firma = f;
    if (!d) {
      el.innerHTML = `<div class="d-tit"><b>Desafío de mesa</b><span>El que más gane en la ronda se lleva el pozo</span></div>
        ${abierta ? `<div class="d-fila"><div class="d-montos">${[500, 1000, 5000, 10000].map((m) => `<button class="btn btn-chico ${m === monto ? 'btn-lima' : ''}" data-m="${m}">${fmt(m)}</button>`).join('')}</div>
        <button class="btn btn-chico btn-oro" data-desafiar>Proponer ${fmt(monto)}</button></div>` : '<p class="d-nota">Se propone mientras están abiertas las apuestas.</p>'}`;
    } else {
      const mio = d.de === e.yo;
      const adentro = mio || d.aceptan.includes(e.yo);
      const pozo = d.monto * (d.aceptan.length + 1);
      const quienes = [d.nombre, ...d.aceptan.map((id) => h.nombreDe(id))];
      el.innerHTML = `<div class="d-tit"><b>${d.jugando ? 'Desafío en juego' : `${h.esc(d.nombre)} desafía a la mesa`}</b><span>${fmt(d.monto)} cada uno · pozo <b class="d-pozo">${fmt(pozo)}</b></span></div>
        <div class="d-fila"><span class="d-quienes">${quienes.map((n) => `<i>${h.esc(n)}</i>`).join('')}</span>
        ${!d.jugando && abierta && !adentro ? `<button class="btn btn-chico btn-oro" data-aceptar>Aceptar ${fmt(d.monto)}</button>` : ''}
        ${!d.jugando && mio && !d.aceptan.length ? '<button class="btn btn-chico" data-retirar>Retirar</button>' : ''}
        ${adentro && !d.jugando ? '<span class="d-nota">Estás adentro</span>' : ''}</span></div>`;
    }
    el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
      monto = Number(b.dataset.m);
      firma = '';
      pintar(e);
    }));
    el.querySelector('[data-desafiar]')?.addEventListener('click', () => h.enviar({ t: 'desafiar', monto }));
    el.querySelector('[data-aceptar]')?.addEventListener('click', () => {
      h.sonar('ficha');
      h.enviar({ t: 'aceptar' });
    });
    el.querySelector('[data-retirar]')?.addEventListener('click', () => h.enviar({ t: 'retirar' }));
  }
  return {
    estado(e) {
      pintar(e);
      const r = e.desafioRes;
      if (r && resVisto !== null && r.n !== resVisto) {
        el.classList.remove('gano');
        void el.offsetWidth;
        el.classList.add('gano');
        if (r.ganan.includes(e.yo)) h.sonar('gana');
      }
      if (r) resVisto = r.n;
      else resVisto ??= 0;
    },
  };
}
