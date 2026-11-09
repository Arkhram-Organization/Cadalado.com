// Gestos de los personajes: los que elegís con la B (como en Fortnite) y las "travesuras" que los
// del elenco hacen solos de vez en cuando (estar parado y ponerse a bailar, dar una voltereta corriendo…).
// Es solo de dibujo: cada navegador decide sus travesuras; los gestos pedidos viajan como estado 'g-<id>'.

export const GESTOS = [
  { id: 'baila', nombre: 'Bailar', tecla: '1', dur: 4.5 },
  { id: 'festeja', nombre: 'Festejar', tecla: '2', dur: 2.4 },
  { id: 'saluda', nombre: 'Saludar', tecla: '3', dur: 2.4 },
  { id: 'voltereta', nombre: 'Voltereta', tecla: '4', dur: 1.1 },
  { id: 'habla', nombre: 'Charlar', tecla: '5', dur: 3.2 },
  { id: 'flexiones', nombre: 'Flexiones', tecla: '6', dur: 3 },
  { id: 'duerme', nombre: 'Dormir', tecla: '7', dur: 9.5 },
  { id: 'musculos', nombre: 'Músculos', tecla: '8', dur: 3 },
];
export const DURACION = Object.fromEntries(GESTOS.map((g) => [g.id, g.dur]));

// look.travesuras = { quieto: [gestos que hace parado], corre: gesto que hace corriendo }
// Los del elenco (modelo propio, foto o estilo meshy) tienen travesuras por defecto.
export function travieso(look = {}) {
  const delElenco = !!(look.modelo || look.foto || look.estilo === 'meshy');
  // los del elenco hacen muchos gestos: parados y también corriendo
  const cfg = look.travesuras || (delElenco ? { quieto: ['saluda', 'festeja', 'habla', 'baila', 'baila'], corre: ['voltereta', 'festeja'] } : null);
  const azar = (a, b) => a + Math.random() * (b - a);
  let auto = null, hasta = 0, quietoT = 0, correT = 0, proxQ = azar(3, 9), proxC = azar(3, 8);
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
          proxQ = quietoT + DURACION[auto] + azar(3, 10);
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
