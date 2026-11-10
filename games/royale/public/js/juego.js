// Lógica de la partida en el navegador: mi personaje, las balas y la IA de los bots (los simula el anfitrión).
import { ARMAS, VIDA, ESCUDO_MAX, LADO, danoRareza, RAREZAS, moverCirculo, choqueBala, seVen, zona, tipoEn, T } from './mundo.js';
import { CASILLEROS, OBJETOS, recoger, comenzarUso, avanzarUso } from './inventario.js';

export const RADIO = 5;
const VEL = 78; // px/s
const VEL_AGUA = 44;
export const CODIGO_ARMA = { pistola: 'p', subfusil: 's', escopeta: 'e', rifle: 'r', francotirador: 'f', rpg: 'g' };
export const ARMA_DE_CODIGO = { p: 'pistola', s: 'subfusil', e: 'escopeta', r: 'rifle', f: 'francotirador', g: 'rpg' };

export class Peleador {
  constructor(id, x, y) {
    Object.assign(this, { id, x, y, ang: 0, vida: VIDA, escudo: 0, vivo: true, mueve: false });
    this.slots = Array.from({length: CASILLEROS}, (_,i) => i ? null : {tipo:'pistola',bala:ARMAS.pistola.cargador,id:'inicio-'+id,rareza:'comun'});
    this.municion = { livianas: 48, medianas: 0, pesadas: 0, cartuchos: 0, cohetes: 0 };
    this.usando = null;
    this.actual = 0;
    this.enfriar = 0;
    this.recargando = 0;
    this.enColectivo = false;
    this.altura = 0;
    this.paracaidas = false;
    this.nivel = 0;
  }
  get arma() {
    return this.slots[this.actual] || {tipo:'vacio',bala:0};
  }
  get datosArma() {
    return ARMAS[this.arma.tipo] || ARMAS.pistola;
  }
  cambiar(i = null) {
    let n = i;
    if (n == null) { n=(this.actual+1)%CASILLEROS;for(let k=0;k<CASILLEROS&&!this.slots[n];k++) n=(n+1)%CASILLEROS; }
    if (this.slots[n]) {
      this.actual = n;
      this.recargando = 0;
      this.usando = null;
    }
  }
  recargar() {
    const a = this.arma;
    if (!ARMAS[a.tipo] || this.usando || this.recargando > 0 || a.bala >= ARMAS[a.tipo].cargador || !this.municion[ARMAS[a.tipo].municion]) return;
    this.recargando = ARMAS[a.tipo].recarga * (RAREZAS[a.rareza]?.recarga || 1);
  }
  // Agarra un arma: si tiene lugar va al slot libre, si no reemplaza la actual. Devuelve el arma que suelta (o null).
  agarrarArma(tipo) {
    const nueva = { tipo, bala: ARMAS[tipo].cargador, rareza: 'comun' };
    if (!this.slots[1]) {
      this.slots[1] = nueva;
      this.actual = 1;
      return null;
    }
    const vieja = this.slots[this.actual];
    this.slots[this.actual] = nueva;
    this.recargando = 0;
    return vieja?.tipo || null;
  }
  recoger(tipo,item=null) { return recoger(this,tipo,ARMAS,item); }
  usar() { return comenzarUso(this); }
  // Recibe daño (primero se gasta el escudo). Devuelve true si murió.
  dano(d) {
    if (!this.vivo) return false;
    this.usando = null;
    const contra = Math.min(this.escudo, d);
    this.escudo -= contra;
    this.vida -= d - contra;
    if (this.vida <= 0) {
      this.vida = 0;
      this.vivo = false;
      return true;
    }
    return false;
  }
  // Movimiento con el mapa (paredes, árboles, agua más lenta)
  mover(mundo, dx, dy, dt, factor = 1) {
    if (this.enColectivo || this.altura > 0) return;
    const n = Math.hypot(dx, dy);
    this.mueve = n > 0.1;
    if(this.mueve) this.usando = null;
    if (!this.mueve) return;
    const v = (tipoEn(mundo, this.x, this.y) === T.AGUA ? VEL_AGUA : VEL) * factor;
    const p = moverCirculo(mundo, this.x, this.y, (dx / n) * v * dt, (dy / n) * v * dt, RADIO);
    this.x = p.x;
    this.y = p.y;
    this.nivel = (mundo.construcciones || []).some(pieza => pieza.vida > 0 && pieza.tipo === 'escalera' && Math.abs(pieza.x - this.x) < 16 && Math.abs(pieza.y - this.y) < 16) ? 1 : 0;
  }
  subirColectivo() { this.enColectivo = true; this.altura = 85; this.paracaidas = false; }
  saltar(x, y) {
    if (!this.enColectivo) return false;
    this.enColectivo = false; this.x = x; this.y = y;
    this.altura = 85; this.paracaidas = false;
    return true;
  }
  caer(dt, dx = 0, dy = 0) {
    if (this.enColectivo || this.altura <= 0) return false;
    const n = Math.hypot(dx, dy);
    const vel = this.paracaidas ? 76 : 115;
    if (n > .1) {
      this.x = Math.max(8, Math.min(LADO - 8, this.x + dx / n * vel * dt));
      this.y = Math.max(8, Math.min(LADO - 8, this.y + dy / n * vel * dt));
    }
    if (this.altura <= 30) this.paracaidas = true;
    this.altura = Math.max(0, this.altura - (this.paracaidas ? 13 : 31) * dt);
    return this.altura === 0;
  }
  // Intenta disparar: devuelve la lista de balas nuevas (o []).
  disparar(rnd = Math.random) {
    const a = this.arma;
    const d = ARMAS[a.tipo];
    if (!d || this.usando || !this.vivo || this.enColectivo || this.altura > 0 || this.enfriar > 0 || this.recargando > 0) return [];
    if (a.bala <= 0) {
      this.recargar();
      return [];
    }
    a.bala -= 1;
    this.enfriar = d.cadencia;
    const balas = [];
    for (let k = 0; k < d.perdigones; k++) {
      const ang = this.ang + (rnd() - 0.5) * d.dispersion * 2;
      const bala = nuevaBala(this.id, this.x + Math.cos(this.ang) * 8, this.y + Math.sin(this.ang) * 8, ang, a.tipo, a.rareza);
      bala.altura = this.nivel;
      balas.push(bala);
    }
    if (a.bala === 0) this.recargar();
    return balas;
  }
  tiempo(dt) {
    avanzarUso(this,dt);
    this.enfriar = Math.max(0, this.enfriar - dt);
    if (this.recargando > 0) {
      this.recargando -= dt;
      if (this.recargando <= 0) {
        this.recargando = 0;
        const arma = ARMAS[this.arma.tipo];
        if (arma) {
          const cantidad = Math.min(arma.cargador - this.arma.bala, this.municion[arma.municion] || 0);
          this.arma.bala += cantidad;
          this.municion[arma.municion] -= cantidad;
        }
      }
    }
  }
}

export function nuevaBala(de, x, y, ang, tipo, rareza = 'comun') {
  const d = ARMAS[tipo];
  return { de, x, y, vx: Math.cos(ang) * d.vel, vy: Math.sin(ang) * d.vel, recorrido: 0, alcance: d.alcance, dano: danoRareza(d.dano, rareza), tipo, rareza, viva: true };
}

// Avanza una bala; si toca a alguien de `blancos` (lista de {id,x,y,vivo}) devuelve ese blanco.
export function avanzarBala(mundo, b, dt, blancos) {
  const x1 = b.x + b.vx * dt;
  const y1 = b.y + b.vy * dt;
  // ¿a quién toca primero en este tramo?
  let mejor = null;
  let fMejor = 2;
  for (const o of blancos) {
    if (!o.vivo || o.id === b.de) continue;
    const vx = x1 - b.x;
    const vy = y1 - b.y;
    const l2 = vx * vx + vy * vy || 1;
    const f = Math.max(0, Math.min(1, ((o.x - b.x) * vx + (o.y - b.y) * vy) / l2));
    if (Math.hypot(b.x + vx * f - o.x, b.y + vy * f - (o.y - 4)) < RADIO + 3 && f < fMejor) {
      mejor = o;
      fMejor = f;
    }
  }
  const pared = choqueBala(mundo, b.x, b.y, x1, y1, b.altura || 0);
  if (pared !== null && pared < fMejor) {
    b.x += (x1 - b.x) * pared;
    b.y += (y1 - b.y) * pared;
    b.viva = false;
    return null;
  }
  if (mejor) {
    b.x += (x1 - b.x) * fMejor;
    b.y += (y1 - b.y) * fMejor;
    b.viva = false;
    return b.tipo === 'rpg' ? null : mejor;
  }
  b.recorrido += Math.hypot(x1 - b.x, y1 - b.y);
  b.x = x1;
  b.y = y1;
  if (b.recorrido > b.alcance) b.viva = false;
  return null;
}

// Daño de la zona por segundo si estás afuera
export function danoZona(semilla, t, x, y) {
  const z = zona(semilla, t);
  return Math.hypot(x - z.x, y - z.y) > z.r ? z.dano : 0;
}

// ---------------------------------------------------------------- IA de los bots
// No son perfectos: tardan en reaccionar, apuntan con error y a veces se distraen con el botín.
export class CerebroBot {
  constructor(p, rnd) {
    this.p = p;
    this.rnd = rnd;
    this.destino = null;
    this.objetivo = null;
    this.pensar = rnd() * 0.5;
    this.reaccion = 0;
    this.errorPunteria = 0.22 + rnd() * 0.12;
    this.lado = rnd() < 0.5 ? 1 : -1;
    this.atascado = 0;
    this.ultimo = { x: p.x, y: p.y };
  }
  // enemigos: [{id,x,y,vivo}], botin: [{id,x,y,tipo}] (libres). Devuelve { balas, agarra }
  paso(dt, mundo, semilla, t, enemigos, botin) {
    const p = this.p;
    const r = this.rnd;
    const salida = { balas: [], agarra: null };
    if (!p.vivo) return salida;
    p.tiempo(dt);
    if (p.usando) { p.mueve = false; return salida; }
    if (!ARMAS[p.arma.tipo]) { const arma = p.slots.findIndex(s => ARMAS[s?.tipo]); if (arma >= 0) p.cambiar(arma); }
    this.pensar -= dt;
    const z = zona(semilla, t);
    const enZona = Math.hypot(p.x - z.x, p.y - z.y) < z.r - 20;
    if (this.pensar <= 0) {
      this.pensar = 0.3 + r() * 0.2;
      // ¿veo a alguien cerca?
      let cerca = null;
      let dMin = 230;
      for (const e of enemigos) {
        if (!e.vivo || e.id === p.id) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < dMin && seVen(mundo, p, e)) {
          dMin = d;
          cerca = e;
        }
      }
      if (cerca && cerca !== this.objetivo) this.reaccion = 0.55 + r() * 0.45;
      this.objetivo = cerca;
      if (!this.objetivo) {
        const cura = p.slots.findIndex(s => s && ((s.tipo === 'botiquin' && p.vida < 55) || (s.tipo === 'venda' && p.vida < 65) || (s.tipo === 'mini' && p.escudo < 25) || (s.tipo === 'escudo' && p.escudo < 50)));
        if (cura >= 0) { p.cambiar(cura); p.usar(); p.mueve = false; return salida; }
        // sin pelea: a la zona si estoy afuera, si no al botín más cercano o a pasear
        if (!enZona) this.destino = { x: z.siguiente.x + (r() - 0.5) * z.siguiente.r * 0.6, y: z.siguiente.y + (r() - 0.5) * z.siguiente.r * 0.6 };
        else if (!this.destino || Math.hypot(this.destino.x - p.x, this.destino.y - p.y) < 10) {
          const valor = { comun: 0, poco_comun: 35, rara: 70, epica: 110, legendaria: 160 };
          const quiero = botin.filter(b => ARMAS[b.tipo] || b.tipo === 'botiquin' && p.vida < 80 || b.tipo === 'escudo' && p.escudo < ESCUDO_MAX || b.tipo === 'mini' && p.escudo < 50 || b.tipo === 'venda' && p.vida < 75).sort((a, b) => (Math.hypot(a.x-p.x,a.y-p.y) - (valor[a.rareza]||0)) - (Math.hypot(b.x-p.x,b.y-p.y) - (valor[b.rareza]||0)))[0];
          if (quiero && Math.hypot(quiero.x - p.x, quiero.y - p.y) < 320) this.destino = { x: quiero.x, y: quiero.y, botin: quiero.id };
          else {
            const a = r() * Math.PI * 2;
            const d = r() * z.r * 0.7;
            this.destino = { x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d };
          }
        }
      }
      // ¿me quedé trabado?
      if (Math.hypot(p.x - this.ultimo.x, p.y - this.ultimo.y) < 3 && p.mueve) this.atascado += 1;
      else this.atascado = 0;
      this.ultimo = { x: p.x, y: p.y };
      if (this.atascado > 3) {
        this.destino = { x: p.x + (r() - 0.5) * 160, y: p.y + (r() - 0.5) * 160 };
        this.lado *= -1;
        this.atascado = 0;
      }
    }
    if (this.objetivo && this.objetivo.vivo) {
      const e = this.objetivo;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      const armas = p.slots.map((s,i)=>({s,i})).filter(x=>ARMAS[x.s?.tipo]);
      const elegida = armas.sort((a,b) => {
        const puntaje = x => (x.s.tipo === 'francotirador' ? d > 250 ? 4 : 0 : x.s.tipo === 'escopeta' ? d < 100 ? 4 : 0 : x.s.tipo === 'rifle' ? 3 : 1) + (RAREZAS[x.s.rareza]?.dano || 1);
        return puntaje(b) - puntaje(a);
      })[0];
      if (elegida && elegida.i !== p.actual) p.cambiar(elegida.i);
      const ideal = p.arma.tipo === 'escopeta' ? 60 : p.arma.tipo === 'rifle' ? 190 : 120;
      // se mueve de costado y regula la distancia
      const adelante = d > ideal + 20 ? 1 : d < ideal - 30 ? -1 : 0;
      const mx = (dx / d) * adelante + (-dy / d) * this.lado * 0.8;
      const my = (dy / d) * adelante + (dx / d) * this.lado * 0.8;
      p.mover(mundo, mx, my, dt, 0.85);
      if (r() < dt * 0.4) this.lado *= -1;
      p.ang = Math.atan2(dy, dx) + (r() - 0.5) * this.errorPunteria * 2;
      this.reaccion -= dt;
      if (this.reaccion <= 0 && d < ARMAS[p.arma.tipo].alcance * 0.95) salida.balas = p.disparar(r);
    } else {
      this.objetivo = null;
      if (this.destino) {
        const dx = this.destino.x - p.x;
        const dy = this.destino.y - p.y;
        if (Math.hypot(dx, dy) > 6) {
          p.mover(mundo, dx, dy, dt, 0.9);
          p.ang = Math.atan2(dy, dx);
        } else p.mueve = false;
      }
      if (p.arma.bala < ARMAS[p.arma.tipo].cargador * 0.5) p.recargar();
    }
    // botín al pasar por arriba
    for (const b of botin) if (Math.hypot(b.x - p.x, b.y - p.y) < 12) {
      salida.agarra = b;
      break;
    }
    return salida;
  }
}
