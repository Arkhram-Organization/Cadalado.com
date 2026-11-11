// Gestos de los personajes: los que elegís con la B (como en Fortnite) y las "travesuras" que los
// del elenco hacen solos de vez en cuando (estar parado y ponerse a bailar, dar una voltereta corriendo…).
// Es solo de dibujo: cada navegador decide sus travesuras; los gestos pedidos viajan como estado 'g-<id>'.

// Catálogo de gestos (el orden no se cambia: los juegos los mandan por número). Los nuevos van al final.
export const GESTOS = [
  { id: 'baila', nombre: 'Bailar', tecla: '1', dur: 4.5, que: '¡Bailando!' },
  { id: 'festeja', nombre: 'Festejar', tecla: '2', dur: 2.4, que: '¡Festejando!' },
  { id: 'saluda', nombre: 'Saludar', tecla: '3', dur: 2.4, que: '¡Hola!' },
  { id: 'voltereta', nombre: 'Voltereta', tecla: '4', dur: 1.1, que: '¡Voltereta!' },
  { id: 'habla', nombre: 'Charlar', tecla: '5', dur: 3.2, que: 'Charlando…' },
  { id: 'flexiones', nombre: 'Flexiones', tecla: '6', dur: 3, que: 'Haciendo flexiones' },
  { id: 'duerme', nombre: 'Dormir', tecla: '7', dur: 9.5, que: 'Zzz…' },
  { id: 'musculos', nombre: 'Músculos', tecla: '8', dur: 3, que: '¡Mirá estos músculos!' },
  { id: 'abdominales', nombre: 'Abdominales', dur: 3.2, que: 'Haciendo abdominales' },
  { id: 'vertical', nombre: 'Vertical', dur: 3, que: '¡Vertical!' },
  { id: 'mortal', nombre: 'Mortal', dur: 1.6, que: '¡Mortal!' },
  { id: 'pavoneo', nombre: 'Pavoneo', dur: 3, que: 'Pavoneándose' },
  { id: 'parkour', nombre: 'Parkour', dur: 1.8, que: '¡Parkour!' },
  { id: 'pina', nombre: 'Piña al aire', dur: 1.6, que: '¡Piña!' },
  { id: 'patada', nombre: 'Patada', dur: 1.6, que: '¡Patada!' },
  { id: 'salto', nombre: 'Saltito', dur: 1.3, que: '¡Salto!' },
  { id: 'tiktok', nombre: 'TikTok', dur: 5.9, que: 'Grabando un TikTok' },
];
// La rueda de la B tiene 8 lugares; cada uno elige qué gesto va en cada lugar (en el casillero).
export const RUEDA_BASE = ['baila', 'festeja', 'saluda', 'voltereta', 'habla', 'flexiones', 'duerme', 'musculos'];
export const POR_GESTO = Object.fromEntries(GESTOS.map((g) => [g.id, g]));
export function limpiarRueda(x) {
  const r = Array.isArray(x) ? x.slice(0, 8).map((id) => (POR_GESTO[id] ? id : null)) : [];
  return RUEDA_BASE.map((base, i) => r[i] || base);
}
// La rueda de este jugador (guardada con su look); cada lugar con su tecla 1-8.
export function miRueda() {
  let l = null;
  try { l = JSON.parse(localStorage.getItem('cadalado.look') || 'null'); } catch {}
  return limpiarRueda(l?.gestos).map((id, i) => ({ ...POR_GESTO[id], tecla: String(i + 1) }));
}
export const DURACION = Object.fromEntries(GESTOS.map((g) => [g.id, g.dur]));

// look.travesuras = { quieto: [gestos que hace parado], corre: gesto que hace corriendo }
// Los del elenco (modelo propio, foto o estilo meshy) tienen travesuras por defecto.
export function travieso(look = {}) {
  const delElenco = !!(look.modelo || look.foto || look.estilo === 'meshy');
  // los del elenco hacen muchos gestos: parados y también corriendo
  const cfg = look.travesuras || (delElenco ? { quieto: ['saluda', 'festeja', 'habla', 'baila', 'baila'], corre: ['voltereta', 'festeja'] } : null);
  const azar = (a, b) => a + Math.random() * (b - a);
  let auto = null, hasta = 0, quietoT = 0, correT = 0, proxQ = cfg?.pausa ? azar(.5, 2) : azar(3, 9), proxC = azar(3, 8);
  let pedido = null, pedidoHasta = -1;
  return {
    // gesto pedido a mano (dura lo que dura el gesto; moverse lo corta)
    pedir(id) { if (DURACION[id]) { pedido = id; pedidoHasta = -1; } },
    // Devuelve el estado a dibujar: el que pide el juego o un gesto encima.
    filtrar(estado, dt, reloj) {
      if (typeof estado === 'string' && estado.startsWith('g-')) return estado.slice(2);
      if (pedido) {
        if (pedidoHasta < 0) pedidoHasta = reloj + DURACION[pedido];
        if (reloj < pedidoHasta && (estado === 'quieto' || (pedido === 'voltereta' && estado === 'corre'))) return pedido;
        pedido = null;
      }
      if (!cfg) return estado;
      if (estado === 'quieto') {
        quietoT += dt;
        if (!auto && cfg.quieto?.length && quietoT > proxQ) {
          auto = cfg.quieto[Math.floor(Math.random() * cfg.quieto.length)];
          hasta = reloj + DURACION[auto];
          // look.travesuras.pausa = [min, max]: cada cuánto vuelve a hacer algo (Ferchus casi no para)
          const [pmin, pmax] = cfg.pausa || [3, 10];
          proxQ = quietoT + DURACION[auto] + azar(pmin, pmax);
        }
      } else { quietoT = 0; proxQ = azar(3, 9); }
      if (estado === 'corre' && cfg.corre) {
        correT += dt;
        if (!auto && correT > proxC) {
          auto = Array.isArray(cfg.corre) ? cfg.corre[Math.floor(Math.random() * cfg.corre.length)] : cfg.corre;
          hasta = reloj + Math.min(DURACION[auto], 1.6); // corriendo, el gesto es cortito
          proxC = correT + azar(4, 9);
        }
      } else if (estado !== 'corre') { correT = 0; }
      if (auto) {
        const enCarrera = Array.isArray(cfg.corre) ? cfg.corre.includes(auto) : auto === cfg.corre;
        const vale = estado === 'quieto' || (estado === 'corre' && enCarrera);
        if (reloj < hasta && vale) return auto;
        auto = null;
      }
      return estado;
    },
  };
}

// Voltereta hacia adelante: giro completo alrededor de la cintura con un salto. k va de 0 a 1.
export function voltereta(cuerpo, k, centro = .9, alto = .75) {
  const t = Math.min(1, Math.max(0, k));
  const th = -Math.PI * 2 * (t * t * (3 - 2 * t)); // empieza y termina suave
  cuerpo.rotation.x = th;
  cuerpo.position.y = centro - centro * Math.cos(th) + Math.sin(t * Math.PI) * alto;
  cuerpo.position.z = -centro * Math.sin(th);
}
