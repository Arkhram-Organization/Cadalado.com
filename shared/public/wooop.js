// El WOOOOOP de Elidiprimio es contagioso: cuando él lo grita, durante unos 5 segundos todos los demás
// personajes que están en pantalla también gritan WOOOOOP, cada uno a su tiempo (desincronizados).
const vivos = new Set();
let hasta = 0;
export const esWooop = (t) => /\bW[OÓ]{3,}P+/i.test(String(t || ''));
const grito = () => 'W' + 'O'.repeat(5 + Math.floor(Math.random() * 9)) + (Math.random() < 0.4 ? 'PP' : 'P') + (Math.random() < 0.3 ? '!' : '');

export function contagiar(origen) {
  const ahora = Date.now();
  if (ahora < hasta) return; // ya está sonando el coro
  hasta = ahora + 5000;
  for (const p of vivos) {
    if (p === origen || !p.grupo?.parent) continue;
    const espera = 250 + Math.random() * 4500;
    setTimeout(() => { if (p.grupo?.parent && vivos.has(p)) p.decir(grito(), 1.4 + Math.random() * 0.8); }, espera);
  }
}

// Envuelve la interfaz de un personaje: lo anota para el coro y, si es quien contagia, dispara el coro al gritar.
export function enganchar(api, contagia = false) {
  const decir = api.decir, dispose = api.dispose;
  api.decir = function (texto, ...resto) {
    const r = decir.call(this, texto, ...resto);
    if (contagia && esWooop(texto)) contagiar(api);
    return r;
  };
  api.dispose = function (...a) { vivos.delete(api); return dispose?.apply(this, a); };
  vivos.add(api);
  return api;
}
