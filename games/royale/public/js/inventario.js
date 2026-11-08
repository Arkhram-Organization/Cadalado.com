export const OBJETOS = {
  venda: { nombre: 'Vendas', cantidad: 5, max: 10, tiempo: 2.2, vida: 15, limite: 75, color: '#f2e7cf' },
  botiquin: { nombre: 'Botiquín', cantidad: 1, max: 3, tiempo: 5, vida: 100, limite: 100, color: '#f4746b' },
  mini: { nombre: 'Mini escudo', cantidad: 3, max: 6, tiempo: 2, escudo: 25, limite: 50, color: '#60ded3' },
  escudo: { nombre: 'Escudo grande', cantidad: 1, max: 3, tiempo: 4, escudo: 50, limite: 100, color: '#6e9dff' },
  granada: { nombre: 'Granadas', cantidad: 3, max: 6, tiempo: 0, color: '#cfcd6b' },
};
export const CASILLEROS = 6;
export function recoger(p, tipo, armas, item = null) {
  const d = OBJETOS[tipo];
  if (!d && !armas[tipo]) return false;
  if (d) {
    let cantidad=item?.cantidad??d.cantidad;
    const capacidad=p.slots.reduce((n,s)=>n+(!s?d.max:s.tipo===tipo?d.max-s.cantidad:0),0);
    if(capacidad<cantidad)return false;
    for(const s of p.slots)if(s?.tipo===tipo){const n=Math.min(cantidad,d.max-s.cantidad);s.cantidad+=n;cantidad-=n;}
    for(let i=0;i<p.slots.length&&cantidad;i++)if(!p.slots[i]){const n=Math.min(cantidad,d.max);p.slots[i]={tipo,cantidad:n};cantidad-=n;}
    return true;
  }
  const libre = p.slots.findIndex(s => !s);
  if (libre < 0) return false;
  p.slots[libre] = { tipo, bala: item?.bala ?? armas[tipo].cargador };
  return true;
}
export function comenzarUso(p) {
  const s = p.slots[p.actual], d = OBJETOS[s?.tipo];
  if (!p.vivo || !d || p.usando || s.cantidad <= 0) return false;
  if (d.vida && p.vida >= d.limite || d.escudo && p.escudo >= d.limite) return false;
  if (s.tipo === 'granada') { s.cantidad--; if (!s.cantidad) p.slots[p.actual] = null; return 'granada'; }
  p.recargando = 0;
  p.usando = { slot: p.actual, tipo: s.tipo, restante: d.tiempo, total: d.tiempo };
  return true;
}
export function avanzarUso(p, dt) {
  if (!p.usando) return;
  const u = p.usando;
  if (!p.vivo || p.actual !== u.slot || p.slots[u.slot]?.tipo !== u.tipo) { p.usando = null; return; }
  u.restante -= dt;
  if (u.restante > 0) return;
  const d = OBJETOS[u.tipo];
  if (d.vida) p.vida = Math.min(d.limite, p.vida + d.vida);
  if (d.escudo) p.escudo = Math.min(d.limite, p.escudo + d.escudo);
  if (--p.slots[u.slot].cantidad <= 0) p.slots[u.slot] = null;
  p.usando = null;
}
