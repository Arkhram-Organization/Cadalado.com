// Física del jugador propio (cada navegador simula a su personaje; los demás llegan por la red).
import { MAPAS, estaticos, moviles, alturaRampa } from './pista.js';

const RADIO = 0.42;
const ALTO = 1.8;
const VEL = 7.1;
const ACEL_SUELO = 40;
const ACEL_AIRE = 13;
const SALTO = 9.4;
const DOBLE = 8.2;
const G = 27;
const BUCEO = 9;
const TURBO = 1.55; // cuánto más rápido corrés arriba de una placa turbo
const DUR_TURBO = 1.7;
const REBOTE = 17; // velocidad con la que te despide un trampolín
export const Y_AGUA = -9; // altura del agua: al tocarla volvés al último punto
export const ENFRIAR_GOLPE = 4; // segundos entre piñas
const TIRADO = 1.35; // cuánto queda en el piso cuando lo voltean

export class Jugador {
  constructor(mapaId, semilla) {
    this.mapaId = mapaId;
    this.mapa = MAPAS[mapaId];
    this.est = estaticos(mapaId);
    this.semilla = semilla;
    this.cp = 0;
    this.llego = false;
    this.enfriar = 0;
    this.ubicar(0, 0, -3);
  }

  ubicar(x, y, z) {
    Object.assign(this, { x, y, z, vx: 0, vy: 0, vz: 0, ry: 0, enSuelo: true, coyote: 0, saltos: 0, aturdido: 0, buceo: 0, pina: 0, anim: 'quieto', arrastreX: 0, arrastreZ: 0, turbo: 0, bufSalto: 0 });
  }

  respawn() {
    const c = this.mapa.CHECKPOINTS[this.cp];
    this.ubicar((Math.random() - 0.5) * 3, c.y + 1.2, c.z);
    this.aturdido = 0.4;
  }

  // Superficie más alta sobre la que se puede pisar en (x, z), por debajo de yMax.
  suelo(x, z, yMax, mov) {
    let mejor = -Infinity;
    let ax = 0;
    let az = 0;
    const borde = RADIO * 0.5;
    const probar = (c, vx = 0, vz = 0) => {
      if (Math.abs(x - c.x) > c.w / 2 + borde || Math.abs(z - c.z) > c.d / 2 + borde) return;
      const top = c.y + c.h / 2;
      if (top <= yMax && top > mejor) {
        mejor = top;
        ax = vx;
        az = vz;
      }
    };
    for (const c of this.est.cajas) probar(c);
    for (const c of this.est.cintas) probar({ ...c, y: c.y - 0.5, h: 1 }, 0, c.vz);
    for (const p of mov.plataformas) probar(p, p.vx, 0);
    for (const b of mov.baldosas) if (b.solida) probar(b);
    for (const r of this.est.rampas) {
      if (Math.abs(x - r.x) <= r.ancho / 2 + borde && z <= r.z0 && z >= r.z1) {
        const top = alturaRampa(r, z);
        if (top <= yMax && top > mejor) {
          mejor = top;
          ax = az = 0;
        }
      }
    }
    return { y: mejor, ax, az };
  }

  // Piña/patada: devuelve true si se puede (y arranca la animación). Quien recibe lo resuelve la red.
  golpear() {
    if (this.enfriar > 0 || this.aturdido > 0 || this.llego) return false;
    this.enfriar = ENFRIAR_GOLPE;
    this.pina = 0.4;
    // alterna: la primera es piña, la siguiente patada, y así
    this.tipoGolpe = this.tipoGolpe === 'pina' ? 'patada' : 'pina';
    return true;
  }

  // Lo voltean (piña, obstáculo): vuela un poco, cae y queda tirado un ratito, como un muñeco.
  voltear(vx, vy, vz, dur = TIRADO) {
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.enSuelo = false;
    this.aturdido = dur;
    this.aturdidoMax = dur;
    this.buceo = 0;
  }

  recibirGolpe(dx, dz) {
    const d = Math.hypot(dx, dz) || 1;
    this.voltear((dx / d) * 6.5, 5.5, (dz / d) * 6.5, TIRADO + 0.15);
  }

  // input: { x, z (entre -1 y 1, relativos a la cámara), salto, buceo }; camYaw: hacia dónde mira la cámara
  paso(dt, t, input, camYaw, otros = []) {
    const ev = [];
    const mov = moviles(this.mapaId, t, this.semilla);
    this.aturdido = Math.max(0, this.aturdido - dt);
    this.buceo = Math.max(0, this.buceo - dt);
    this.pina = Math.max(0, this.pina - dt);
    this.enfriar = Math.max(0, this.enfriar - dt);
    this.turbo = Math.max(0, this.turbo - dt);
    this.coyote = this.enSuelo ? 0.12 : Math.max(0, this.coyote - dt);
    if (this.enSuelo) this.saltos = 0;

    let ix = this.llego ? 0 : input.x;
    let iz = this.llego ? 0 : input.z;
    const n = Math.hypot(ix, iz);
    if (n > 1) {
      ix /= n;
      iz /= n;
    }
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    const vmax = VEL * (this.turbo > 0 ? TURBO : 1);
    const qx = (fx * iz + rx * ix) * vmax;
    const qz = (fz * iz + rz * ix) * vmax;
    const control = this.aturdido > 0 ? 0 : this.buceo > 0 ? 0.1 : 1;
    const acel = (this.enSuelo ? ACEL_SUELO : ACEL_AIRE) * (this.turbo > 0 ? 1.6 : 1) * control * dt;
    const acercar = (v, obj) => (Math.abs(obj - v) <= acel ? obj : v + Math.sign(obj - v) * acel);
    if (this.aturdido > 0 && this.enSuelo) {
      // tirado en el piso: se frena de a poco
      const fr = 14 * dt;
      this.vx = Math.abs(this.vx) <= fr ? 0 : this.vx - Math.sign(this.vx) * fr;
      this.vz = Math.abs(this.vz) <= fr ? 0 : this.vz - Math.sign(this.vz) * fr;
    } else if (control > 0) {
      this.vx = acercar(this.vx, qx);
      this.vz = acercar(this.vz, qz);
    }

    // salto y doble salto. Si apretás un toque antes de tocar el piso, el salto queda "guardado"
    // y sale apenas aterrizás (así no se pierde ningún salto por apurarse).
    if (input.salto) this.bufSalto = 0.15;
    else this.bufSalto = Math.max(0, this.bufSalto - dt);
    if (this.bufSalto > 0 && this.aturdido <= 0 && !this.llego) {
      if (this.coyote > 0) {
        this.vy = SALTO;
        this.enSuelo = false;
        this.coyote = 0;
        this.saltos = 1;
        this.bufSalto = 0;
        ev.push('salto');
      } else if (input.salto && this.saltos < 2) {
        this.vy = DOBLE;
        this.saltos = 2;
        this.bufSalto = 0;
        ev.push('doble');
      }
    }
    if (input.buceo && this.buceo <= 0 && this.aturdido <= 0 && !this.llego) {
      this.vx = -Math.sin(this.ry) * BUCEO;
      this.vz = -Math.cos(this.ry) * BUCEO;
      this.vy = Math.max(this.vy, 3.5);
      this.buceo = 0.7;
      this.enSuelo = false;
      ev.push('buceo');
    }

    this.vy = Math.max(-40, this.vy - G * dt);
    const yAntes = this.y;
    this.x += (this.vx + (this.enSuelo ? this.arrastreX : 0)) * dt;
    this.z += (this.vz + (this.enSuelo ? this.arrastreZ : 0)) * dt;
    this.y += this.vy * dt;

    // piso
    const s = this.suelo(this.x, this.z, Math.max(yAntes, this.y) + 0.6, mov);
    const estaba = this.enSuelo;
    if (this.vy <= 0 && this.y <= s.y && yAntes >= s.y - 0.7) {
      this.y = s.y;
      this.vy = 0;
      this.enSuelo = true;
      this.arrastreX = s.ax;
      this.arrastreZ = s.az;
      if (!estaba) ev.push('aterriza');
    } else if (this.y > s.y + 0.05 || s.y === -Infinity) this.enSuelo = false;

    // placas turbo y trampolines
    if (this.enSuelo && this.aturdido <= 0) {
      for (const p of this.est.impulsos || []) {
        if (Math.abs(this.y - p.y) > 0.3) continue;
        if (p.tipo === 'turbo') {
          if (Math.abs(this.x - p.x) > p.w / 2 || Math.abs(this.z - p.z) > p.d / 2) continue;
          if (this.turbo <= 0.3) ev.push('turbo');
          this.turbo = DUR_TURBO;
        } else if (Math.hypot(this.x - p.x, this.z - p.z) <= p.w / 2 + 0.15) {
          this.vy = REBOTE;
          this.vz = Math.min(this.vz, -VEL); // siempre te despide hacia adelante: alcanza para cruzar el hueco
          this.enSuelo = false;
          this.coyote = 0;
          this.saltos = 1; // en el aire todavía queda el doble salto
          this.bufSalto = 0;
          this.rebote = p;
          ev.push('rebote');
        }
      }
    }

    // paredes fijas y pistones (que además empujan)
    const empujar = (c, vx = 0) => {
      const top = c.y + c.h / 2;
      const bottom = c.y - c.h / 2;
      if (top <= this.y + 0.45 || bottom >= this.y + ALTO) return;
      const cx = Math.max(c.x - c.w / 2, Math.min(this.x, c.x + c.w / 2));
      const cz = Math.max(c.z - c.d / 2, Math.min(this.z, c.z + c.d / 2));
      let dx = this.x - cx;
      let dz = this.z - cz;
      let d = Math.hypot(dx, dz);
      if (d >= RADIO) return;
      if (d < 1e-6) {
        // quedó adentro: sale por el lado más cercano (o hacia donde empuja el pistón)
        dx = vx ? Math.sign(vx) : this.x >= c.x ? 1 : -1;
        dz = 0;
        d = 1;
        this.x = c.x + dx * (c.w / 2 + RADIO);
      } else {
        this.x = cx + (dx / d) * RADIO;
        this.z = cz + (dz / d) * RADIO;
      }
      const nx = dx / d;
      const nz = dz / d;
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        this.vx -= vn * nx;
        this.vz -= vn * nz;
      }
      if (vx && Math.sign(vx) === Math.sign(nx) && Math.abs(vx) > 1) {
        if (this.aturdido <= 0.2) {
          this.voltear(vx * 1.2, 4.5, (Math.random() - 0.5) * 2);
          ev.push('golpe');
        } else this.vx = vx * 1.2;
      }
    };
    for (const c of this.est.cajas) empujar(c);
    for (const p of mov.pistones) empujar(p, p.vx);

    // obstáculos que te voltean (más suave que antes)
    // los golpes de los obstáculos empujan bastante más fuerte (te pueden tirar de la pista)
    const golpe = (vx, vy, vz) => {
      if (this.aturdido > 0) return;
      this.voltear(vx * 1.45, vy * 1.2, vz * 1.45);
      ev.push('golpe');
    };
    for (const b of mov.barras) {
      if (this.y > b.y + b.r + 0.05 || this.y + ALTO < b.y - b.r) continue;
      const ux = Math.cos(b.ang);
      const uz = Math.sin(b.ang);
      const px = this.x - b.x;
      const pz = this.z - b.z;
      const k = Math.max(-b.largo, Math.min(b.largo, px * ux + pz * uz));
      const dx = px - ux * k;
      const dz = pz - uz * k;
      const d = Math.hypot(dx, dz);
      if (d < b.r + RADIO) {
        const sgn = Math.sign(b.w) * Math.sign(k || 1);
        const fuerza = 5 + Math.abs(b.w * k) * 0.6;
        this.x += (dx / (d || 1)) * (b.r + RADIO - d);
        this.z += (dz / (d || 1)) * (b.r + RADIO - d);
        golpe(-uz * sgn * fuerza, 4.5, ux * sgn * fuerza);
      }
    }
    for (const m of mov.martillos) {
      const d = Math.hypot(this.x - m.x, this.y + 0.9 - m.y, this.z - m.z);
      if (d < m.r + 0.55) golpe(Math.sign(m.vx || this.x - m.x) * (6.5 + Math.abs(m.vx) * 0.4), 5.5, 1.5, 0.8);
    }
    for (const w of mov.molinos) {
      if (Math.abs(this.z - w.z) > w.grosor / 2 + RADIO) continue;
      for (let i = 0; i < w.brazos; i++) {
        const a = w.ang + (i * Math.PI * 2) / w.brazos;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const px = this.x - w.x;
        const py = this.y + 0.9 - w.y;
        const k = Math.max(0, Math.min(w.largo, px * ux + py * uy));
        const d = Math.hypot(px - ux * k, py - uy * k);
        if (d < 0.35 + 0.6) {
          const tx = -uy * Math.sign(w.w);
          golpe(tx * 6, 5, 2.5, 0.7);
        }
      }
    }
    for (const b of mov.bolas) {
      const d = Math.hypot(this.x - b.x, this.y + 0.9 - b.y, this.z - b.z);
      if (d < b.r + 0.55) golpe((this.x - b.x) * 2, 5, 7.5, 0.7);
    }

    // los demás personajes empujan un poco
    for (const o of otros) {
      if (Math.abs(o.y - this.y) > 1.5) continue;
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < RADIO * 2 && d > 1e-4) {
        const e = (RADIO * 2 - d) / 2;
        this.x += (dx / d) * e;
        this.z += (dz / d) * e;
      }
    }

    if (this.y < Y_AGUA) {
      this.caida = { x: this.x, z: this.z };
      this.respawn();
      ev.push('caida');
    }
    const cps = this.mapa.CHECKPOINTS;
    while (this.cp + 1 < cps.length && this.enSuelo && this.z <= cps[this.cp + 1].z) {
      this.cp++;
      ev.push('checkpoint');
    }
    if (!this.llego && this.z <= this.mapa.META_Z && this.y > this.mapa.metaY - 1) {
      this.llego = true;
      ev.push('meta');
    }

    const vh = Math.hypot(this.vx, this.vz);
    if (vh > 0.6 && this.aturdido <= 0 && this.pina <= 0) {
      let d = Math.atan2(-this.vx, -this.vz) - this.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ry += d * Math.min(1, dt * 12);
    }
    const tirado = this.aturdido > 0 && this.enSuelo && this.aturdido < (this.aturdidoMax || TIRADO) - 0.2;
    // gesto pedido con la B: dura lo que dura; moverse, saltar o recibir un golpe lo corta
    if (this.gesto) {
      this.gestoT -= dt;
      if (this.gestoT <= 0 || this.llego || this.aturdido > 0 || !this.enSuelo || (vh > 0.8 && this.gesto !== 'voltereta')) this.gesto = null;
    }
    this.anim = this.gesto ? 'g-' + this.gesto : this.llego ? 'festeja' : this.pina > 0 ? this.tipoGolpe : tirado ? 'tirado' : this.aturdido > 0 ? 'golpe' : this.buceo > 0 ? 'buceo' : !this.enSuelo ? 'salto' : vh > 0.8 ? 'corre' : 'quieto';
    return ev;
  }

  // gestos (la duración la manda quien lo pide, para no depender de nada del navegador)
  pedirGesto(id, dur) {
    if (this.llego || this.aturdido > 0 || !this.enSuelo) return;
    this.gesto = id;
    this.gestoT = dur;
  }

  estado() {
    return { x: this.x, y: this.y, z: this.z, ry: this.ry, a: this.anim };
  }
}
