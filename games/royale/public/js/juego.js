// Lógica de la partida en el navegador: mi personaje, las balas y la IA de los bots (los simula el anfitrión).
import { ARMAS, VIDA, ESCUDO_MAX, moverCirculo, choqueBala, seVen, zona, tipoEn, T } from './mundo.js';

export const RADIO = 5;
const VEL = 78; // px/s
const VEL_AGUA = 44;
export const CODIGO_ARMA = { pistola: 'p', subfusil: 's', escopeta: 'e', rifle: 'r' };
export const ARMA_DE_CODIGO = { p: 'pistola', s: 'subfusil', e: 'escopeta', r: 'rifle' };

export class Peleador {
  constructor(id, x, y) {
    Object.assign(this, { id, x, y, ang: 0, vida: VIDA, escudo: 0, vivo: true, mueve: false });
    this.slots = [{ tipo: 'pistola', bala: ARMAS.pistola.cargador }, null];
    this.actual = 0;
    this.enfriar = 0;
    this.recargando = 0;
  }
  get arma() {
    return this.slots[this.actual] || this.slots[0];
  }
  get datosArma() {
    return ARMAS[this.arma.tipo];
  }
  cambiar(i = null) {
    const n = i ?? (this.actual === 0 ? 1 : 0);
    if (this.slots[n]) {
      this.actual = n;
      this.recargando = 0;
    }
  }
  recargar() {
    const a = this.arma;
    if (this.recargando > 0 || a.bala >= ARMAS[a.tipo].cargador) return;
    this.recargando = ARMAS[a.tipo].recarga;
  }
  // Agarra un arma: si tiene lugar va al slot libre, si no reemplaza la actual. Devuelve el arma que suelta (o null).
  agarrarArma(tipo) {
    const nueva = { tipo, bala: ARMAS[tipo].cargador };
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
  // Recibe daño (primero se gasta el escudo). Devuelve true si murió.
  dano(d) {
    if (!this.vivo) return false;
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
    const n = Math.hypot(dx, dy);
    this.mueve = n > 0.1;
    if (!this.mueve) return;
    const v = (tipoEn(mundo, this.x, this.y) === T.AGUA ? VEL_AGUA : VEL) * factor;
    const p = moverCirculo(mundo, this.x, this.y, (dx / n) * v * dt, (dy / n) * v * dt, RADIO);
    this.x = p.x;
    this.y = p.y;
  }
  // Intenta disparar: devuelve la lista de balas nuevas (o []).
  disparar(rnd = Math.random) {
    const a = this.arma;
    const d = ARMAS[a.tipo];
    if (!this.vivo || this.enfriar > 0 || this.recargando > 0) return [];
    if (a.bala <= 0) {
      this.recargar();
      return [];
    }
    a.bala -= 1;
    this.enfriar = d.cadencia;
    const balas = [];
    for (let k = 0; k < d.perdigones; k++) {
      const ang = this.ang + (rnd() - 0.5) * d.dispersion * 2;
      balas.push(nuevaBala(this.id, this.x + Math.cos(this.ang) * 8, this.y + Math.sin(this.ang) * 8, ang, a.tipo));
    }
    if (a.bala === 0) this.recargar();
    return balas;
  }
  tiempo(dt) {
    this.enfriar = Math.max(0, this.enfriar - dt);
    if (this.recargando > 0) {
      this.recargando -= dt;
      if (this.recargando <= 0) {
        this.recargando = 0;
        this.arma.bala = ARMAS[this.arma.tipo].cargador;
      }
    }
  }
}

export function nuevaBala(de, x, y, ang, tipo) {
  const d = ARMAS[tipo];
  return { de, x, y, vx: Math.cos(ang) * d.vel, vy: Math.sin(ang) * d.vel, recorrido: 0, alcance: d.alcance, dano: d.dano, tipo, viva: true };
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
  const pared = choqueBala(mundo, b.x, b.y, x1, y1);
  if (pared !== null && pared < fMejor) {
    b.x += (x1 - b.x) * pared;
    b.y += (y1 - b.y) * pared;
    b.viva = false;
    return null;
  }
  if (mejor) {
    b.viva = false;
    return mejor;
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
        // sin pelea: a la zona si estoy afuera, si no al botín más cercano o a pasear
        if (!enZona) this.destino = { x: z.siguiente.x + (r() - 0.5) * z.siguiente.r * 0.6, y: z.siguiente.y + (r() - 0.5) * z.siguiente.r * 0.6 };
        else if (!this.destino || Math.hypot(this.destino.x - p.x, this.destino.y - p.y) < 10) {
          const quiero = botin.filter((b) => (b.tipo === 'botiquin' ? p.vida < 80 : b.tipo === 'escudo' ? p.escudo < ESCUDO_MAX : !p.slots[1] || b.tipo === 'rifle' || b.tipo === 'escopeta')).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
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
