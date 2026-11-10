export const OBJETOS = {
  venda: { rareza: 'comun', nombre: 'Vendas', cantidad: 5, max: 10, tiempo: 2.2, vida: 15, limite: 75, color: '#f2e7cf' },
  botiquin: { rareza: 'poco_comun', nombre: 'Botiquín', cantidad: 1, max: 3, tiempo: 5, vida: 100, limite: 100, color: '#f4746b' },
  mini: { rareza: 'rara', nombre: 'Mini escudo', cantidad: 3, max: 6, tiempo: 2, escudo: 25, limite: 50, color: '#60ded3' },
  escudo: { rareza: 'rara', nombre: 'Escudo grande', cantidad: 1, max: 3, tiempo: 4, escudo: 50, limite: 100, color: '#6e9dff' },
  granada: { rareza: 'poco_comun', nombre: 'Granadas', cantidad: 3, max: 6, tiempo: 0, color: '#cfcd6b' },
};
export const CASILLEROS = 5;
export function recoger(p, tipo, armas, item = null) {
  const d = OBJETOS[tipo];
  if (!d && !armas[tipo]) return false;
  if (d) {
    let cantidad=item?.cantidad??d.cantidad;
    const capacidad=p.slots.reduce((n,s)=>n+(!s?d.max:s.tipo===tipo?d.max-s.cantidad:0),0);
    if(capacidad<cantidad) {
      const anterior = p.slots[p.actual];
      if (!anterior) return false;
      p.slots[p.actual] = { tipo, cantidad, id: item?.id, rareza: d.rareza };
      return { soltado: anterior };
    }
    for(const s of p.slots)if(s?.tipo===tipo){const n=Math.min(cantidad,d.max-s.cantidad);s.cantidad+=n;cantidad-=n;}
    for(let i=0;i<p.slots.length&&cantidad;i++)if(!p.slots[i]){const n=Math.min(cantidad,d.max);p.slots[i]={tipo,cantidad:n,id:item?.id,rareza:d.rareza};cantidad-=n;}
    return { soltado: null };
  }
  const libre = p.slots.findIndex(s => !s);
  const nuevo = { tipo, bala: item?.bala ?? armas[tipo].cargador, id: item?.id, rareza: item?.rareza || 'comun' };
  if (libre < 0) {
    const anterior = p.slots[p.actual];
    p.slots[p.actual] = nuevo;
    return { soltado: anterior };
  }
  p.slots[libre] = nuevo;
  return { soltado: null };
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
