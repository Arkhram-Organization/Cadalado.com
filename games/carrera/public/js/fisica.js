// Física del jugador propio (cada navegador simula a su personaje; los demás llegan por la red).
import { estaticos, moviles, alturaRampa, RAMPA, META_Z, CHECKPOINTS } from './pista.js';

const RADIO = 0.45;
const ALTO = 1.7;
const VEL = 8.6;
const ACEL_SUELO = 60;
const ACEL_AIRE = 16;
const SALTO = 10.8;
const G = 30;
const BUCEO = 12.5;

export class Jugador {
  constructor(semilla) {
    this.cajas = estaticos(semilla);
    this.semilla = semilla;
    this.cp = 0;
    this.llego = false;
    this.ubicar(0, 0, -3);
  }

  ubicar(x, y, z) {
    Object.assign(this, { x, y, z, vx: 0, vy: 0, vz: 0, ry: 0, enSuelo: true, coyote: 0, aturdido: 0, buceo: 0, anim: 'quieto', plataformaVx: 0 });
  }

  respawn() {
    const c = CHECKPOINTS[this.cp];
    this.ubicar((Math.random() - 0.5) * 4, c.y + 1.5, c.z);
    this.aturdido = 0.4;
  }

  // Superficie más alta sobre la que se puede pisar en (x, z), por debajo de yMax.
  suelo(x, z, yMax, mov) {
    let mejor = -Infinity;
    let vx = 0;
    const borde = RADIO * 0.5;
    const probar = (c, velx = 0) => {
      if (Math.abs(x - c.x) > c.w / 2 + borde || Math.abs(z - c.z) > c.d / 2 + borde) return;
      const top = c.y + c.h / 2;
      if (top <= yMax && top > mejor) {
        mejor = top;
        vx = velx;
      }
    };
    for (const c of this.cajas) probar(c);
    for (const p of mov.plataformas) probar(p, p.vx);
    if (Math.abs(x) <= RAMPA.ancho / 2 + borde && z <= RAMPA.z0 && z >= RAMPA.z1) {
      const top = alturaRampa(z);
      if (top <= yMax && top > mejor) {
        mejor = top;
        vx = 0;
      }
    }
    return { y: mejor, vx };
  }

  // input: { x, z (entre -1 y 1, relativos a la cámara), salto, buceo }; camYaw: hacia dónde mira la cámara
  paso(dt, t, input, camYaw, otros = []) {
    const ev = [];
    if (this.llego) {
      this.vx *= 0.9;
      this.vz *= 0.9;
    }
    const mov = moviles(t, this.semilla);
    this.aturdido = Math.max(0, this.aturdido - dt);
    this.buceo = Math.max(0, this.buceo - dt);
    this.coyote = this.enSuelo ? 0.12 : Math.max(0, this.coyote - dt);

    // dirección deseada según la cámara
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
    const qx = (fx * iz + rx * ix) * VEL;
    const qz = (fz * iz + rz * ix) * VEL;
    const control = this.aturdido > 0 ? 0.15 : this.buceo > 0 ? 0.1 : 1;
    const acel = (this.enSuelo ? ACEL_SUELO : ACEL_AIRE) * control * dt;
    const acercar = (v, obj) => (Math.abs(obj - v) <= acel ? obj : v + Math.sign(obj - v) * acel);
    this.vx = acercar(this.vx, qx);
    this.vz = acercar(this.vz, qz);

    if (input.salto && this.coyote > 0 && this.aturdido <= 0 && !this.llego) {
      this.vy = SALTO;
      this.enSuelo = false;
      this.coyote = 0;
      ev.push('salto');
    }
    if (input.buceo && this.buceo <= 0 && this.aturdido <= 0 && !this.llego) {
      const ax = -Math.sin(this.ry);
      const az = -Math.cos(this.ry);
      this.vx = ax * BUCEO;
      this.vz = az * BUCEO;
      this.vy = Math.max(this.vy, 4.5);
      this.buceo = 0.75;
      this.enSuelo = false;
      ev.push('buceo');
    }

    this.vy = Math.max(-45, this.vy - G * dt);
    const yAntes = this.y;
    this.x += (this.vx + (this.enSuelo ? this.plataformaVx : 0)) * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;

    // piso
    const s = this.suelo(this.x, this.z, Math.max(yAntes, this.y) + 0.6, mov);
    const estaba = this.enSuelo;
    if (this.vy <= 0 && this.y <= s.y && yAntes >= s.y - 0.7) {
      this.y = s.y;
      this.vy = 0;
      this.enSuelo = true;
      this.plataformaVx = s.vx;
      if (!estaba) ev.push('aterriza');
    } else if (this.y > s.y + 0.05 || s.y === -Infinity) {
      this.enSuelo = false;
    }

    // paredes (cajas más altas que un escalón)
    for (const c of this.cajas) {
      const top = c.y + c.h / 2;
      const bottom = c.y - c.h / 2;
      if (top <= this.y + 0.45 || bottom >= this.y + ALTO) continue;
      const cx = Math.max(c.x - c.w / 2, Math.min(this.x, c.x + c.w / 2));
      const cz = Math.max(c.z - c.d / 2, Math.min(this.z, c.z + c.d / 2));
      const dx = this.x - cx;
      const dz = this.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < RADIO && d > 1e-6) {
        this.x = cx + (dx / d) * RADIO;
        this.z = cz + (dz / d) * RADIO;
        const vn = this.vx * (dx / d) + this.vz * (dz / d);
        if (vn < 0) {
          this.vx -= vn * (dx / d) * 1.2;
          this.vz -= vn * (dz / d) * 1.2;
        }
        if (c.puerta && !this.choquePuerta) {
          this.choquePuerta = 0.5;
          ev.push('puerta');
        }
      } else if (d <= 1e-6) {
        this.z = c.z + c.d / 2 + RADIO; // quedó adentro: lo saca para atrás
      }
    }
    if (this.choquePuerta) this.choquePuerta = Math.max(0, this.choquePuerta - dt) || 0;

    // obstáculos
    const golpe = (vx, vy, vz, dur = 0.65) => {
      if (this.aturdido > 0.3) return;
      this.vx = vx;
      this.vy = vy;
      this.vz = vz;
      this.enSuelo = false;
      this.aturdido = dur;
      this.buceo = 0;
      ev.push('golpe');
    };
    for (const b of mov.barras) {
      if (this.y > b.y + b.r + 0.1 || this.y + ALTO < b.y - b.r) continue;
      const ux = Math.cos(b.ang);
      const uz = Math.sin(b.ang);
      const px = this.x - b.x;
      const pz = this.z - b.z;
      const k = Math.max(-b.largo, Math.min(b.largo, px * ux + pz * uz));
      const dx = px - ux * k;
      const dz = pz - uz * k;
      const d = Math.hypot(dx, dz);
      if (d < b.r + RADIO) {
        // la barra empuja hacia donde gira
        const tx = -uz * Math.sign(b.w) * Math.sign(k || 1);
        const tz = ux * Math.sign(b.w) * Math.sign(k || 1);
        const fuerza = 9 + Math.abs(b.w * k) * 1.2;
        this.x += (dx / (d || 1)) * (b.r + RADIO - d);
        this.z += (dz / (d || 1)) * (b.r + RADIO - d);
        golpe(tx * fuerza, 6.5, tz * fuerza);
      }
    }
    for (const m of mov.martillos) {
      const d = Math.hypot(this.x - m.x, this.y + 0.9 - m.y, this.z - m.z);
      if (d < m.r + 0.6) golpe(Math.sign(m.vx || this.x - m.x) * (12 + Math.abs(m.vx) * 0.8), 8, 3, 0.9);
    }
    for (const b of mov.bolas) {
      const d = Math.hypot(this.x - b.x, this.y + 0.9 - b.y, this.z - b.z);
      if (d < b.r + 0.55) golpe((this.x - b.x) * 3, 7, 14, 0.75);
    }

    // los demás personajes empujan un poco
    for (const o of otros) {
      if (Math.abs(o.y - this.y) > 1.5) continue;
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < RADIO * 2 && d > 1e-4) {
        const empuje = (RADIO * 2 - d) / 2;
        this.x += (dx / d) * empuje;
        this.z += (dz / d) * empuje;
      }
    }

    // caída al vacío
    if (this.y < -14) {
      this.respawn();
      ev.push('caida');
    }
    // checkpoints
    while (this.cp + 1 < CHECKPOINTS.length && this.enSuelo && this.z <= CHECKPOINTS[this.cp + 1].z) {
      this.cp++;
      ev.push('checkpoint');
    }
    // meta
    if (!this.llego && this.z <= META_Z && this.y > 4) {
      this.llego = true;
      ev.push('meta');
    }

    // hacia dónde mira y animación
    const vh = Math.hypot(this.vx, this.vz);
    if (vh > 0.6 && this.aturdido <= 0) {
      const obj = Math.atan2(-this.vx, -this.vz);
      let d = obj - this.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ry += d * Math.min(1, dt * 14);
    }
    this.anim = this.llego ? 'festeja' : this.aturdido > 0 ? 'golpe' : this.buceo > 0 ? 'buceo' : !this.enSuelo ? 'salto' : vh > 1 ? 'corre' : 'quieto';
    return ev;
  }

  estado() {
    return { x: this.x, y: this.y, z: this.z, ry: this.ry, a: this.anim };
  }
}
