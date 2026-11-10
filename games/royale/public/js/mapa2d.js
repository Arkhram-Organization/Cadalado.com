// Mapas 2D de Battle Shmitz: la imagen de la isla, el minimapa y el mapa grande (M) donde podés marcar destino.
import { T, TAM, BALDOSA, LADO, LUGARES } from './mundo.js';

const RES = 8; // píxeles de imagen por baldosa
const COLOR = { [T.AGUA]: '#2b8fc9', [T.ARENA]: '#ecdcaa', [T.PASTO]: '#7db457', [T.PISO]: '#c9b08a', [T.PARED]: '#5b4a3e', [T.CAMINO]: '#575b62', [T.TIERRA]: '#b08a5c', [T.PLAZA]: '#d6cebd', [T.MADERA]: '#9a6c40' };
const LETRAS = 'ABCDEFGHIJ';
export const cuadricula = (x, y) => `${LETRAS[Math.max(0, Math.min(9, Math.floor((x / LADO) * 10)))]}${Math.max(1, Math.min(10, Math.floor((y / LADO) * 10) + 1))}`;

const cache = new WeakMap();
export function imagenMapa(m) {
  if (cache.has(m)) return cache.get(m);
  const c = document.createElement('canvas');
  c.width = c.height = TAM * RES;
  const g = c.getContext('2d');
  const tipo = (x, y) => (x < 0 || y < 0 || x >= TAM || y >= TAM ? T.AGUA : m.t[y * TAM + x]);
  // agua: más clara cerca de la costa
  g.fillStyle = '#1f78b4'; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    const v = tipo(x, y);
    if (v === T.AGUA) {
      let cerca = 9;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (tipo(x + i, y + j) !== T.AGUA) cerca = Math.min(cerca, Math.hypot(i, j));
      g.fillStyle = cerca < 1.6 ? '#5cc3e6' : cerca < 3 ? '#3aa3d6' : cerca < 5 ? '#2b8fc9' : '#1f78b4';
    } else if (v === T.PASTO) {
      const n = Math.sin(x * 0.31) * Math.cos(y * 0.27) + Math.sin((x + y) * 0.13);
      g.fillStyle = n > 0.6 ? '#88bf5f' : n < -0.6 ? '#71a74f' : '#7db457';
    } else if (v === T.PISO) {
      const casa = m.casas.find((k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h);
      g.fillStyle = casa?.piso || COLOR[v];
    } else g.fillStyle = COLOR[v];
    g.fillRect(x * RES, y * RES, RES, RES);
  }
  // techos de los edificios con sombra
  for (const k of m.casas) {
    const x = k.x * RES, y = k.y * RES, w = k.w * RES, h = k.h * RES;
    if (k.tipo === 'estadio') {
      g.fillStyle = k.color;
      for (let j = k.y; j < k.y + k.h; j++) for (let i = k.x; i < k.x + k.w; i++) if (tipo(i, j) === T.PARED) g.fillRect(i * RES, j * RES, RES, RES);
      continue;
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 4, y + 5, w, h);
    g.fillStyle = k.tipo === 'contenedor' ? k.color : k.techo; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    if (k.tipo === 'casa') { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 3, y + 3, w - 6, (h - 6) / 2); }
  }
  // decoración que se ve desde arriba
  for (const d of m.decoraciones || []) {
    if (d.tipo === 'raya') { g.fillStyle = 'rgba(255,255,255,.7)'; g.save(); g.translate((d.x / BALDOSA) * RES, (d.y / BALDOSA) * RES); g.rotate(d.rot || 0); g.fillRect((-d.w / 2 / BALDOSA) * RES, (-d.h / 2 / BALDOSA) * RES, Math.max(1, (d.w / BALDOSA) * RES), Math.max(1, (d.h / BALDOSA) * RES)); g.restore(); }
    else if (d.tipo === 'cultivo') { g.fillStyle = '#4e8035'; g.beginPath(); g.arc((d.x / BALDOSA) * RES, (d.y / BALDOSA) * RES, 2.6, 0, 7); g.fill(); }
    else if (d.tipo === 'bote') { g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse((d.x / BALDOSA) * RES, (d.y / BALDOSA) * RES, 12, 5, d.rot || 0, 0, 7); g.fill(); }
    else if (d.tipo === 'faro') { g.fillStyle = '#e2453a'; g.beginPath(); g.arc((d.x / BALDOSA) * RES, (d.y / BALDOSA) * RES, 6, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc((d.x / BALDOSA) * RES, (d.y / BALDOSA) * RES, 3, 0, 7); g.fill(); }
  }
  // árboles, rocas, autos y el monumento
  for (const o of m.obstaculos) {
    const x = (o.x / BALDOSA) * RES, y = (o.y / BALDOSA) * RES;
    if (o.tipo === 'arbol') {
      const r = o.forma === 'palmera' ? 4 : o.forma === 'muerto' ? 3 : 6;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 2, y + 2, r, 0, 7); g.fill();
      g.fillStyle = o.forma === 'muerto' ? '#5b4a40' : o.forma === 'pino' ? '#2f6b45' : '#4a8a3c'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (o.forma !== 'muerto') { g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, r * 0.45, 0, 7); g.fill(); }
    } else if (o.tipo === 'roca') { g.fillStyle = '#9aa09b'; g.beginPath(); g.arc(x, y, (o.r / BALDOSA) * RES * 0.9, 0, 7); g.fill(); }
    else if (o.tipo === 'auto') { g.save(); g.translate(x, y); g.rotate(o.rot || 0); g.fillStyle = '#d9473a'; g.fillRect(-9, -4.5, 18, 9); g.restore(); }
    else if (o.tipo === 'monumento') { g.fillStyle = '#ff9ec4'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.fillStyle = '#e0263a'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    else if (o.tipo === 'silo') { g.fillStyle = '#d8dde0'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
    else if (o.tipo === 'columna') { g.fillStyle = '#efe8d6'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
  }
  cache.set(m, c);
  return c;
}

// Dibuja en `g` (de ancho w y alto h) la parte de la isla centrada en (cx, cy) con `escala` píxeles por px del juego.
export function dibujarIsla(g, img, { w, h, cx, cy, escala, zona, recorrido, marca, yo, gente = [], nombres = true, grilla = false, tamTexto = 1 }) {
  const k = (RES / BALDOSA) * 1;
  const aPantalla = (x, y) => [w / 2 + (x - cx) * escala, h / 2 + (y - cy) * escala];
  g.save();
  g.fillStyle = '#1f78b4'; g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = escala < 0.6;
  const [x0, y0] = aPantalla(0, 0);
  g.drawImage(img, x0, y0, LADO * escala, LADO * escala);
  if (grilla) {
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 ${12 * tamTexto}px "JetBrains Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let i = 0; i <= 10; i++) {
      const [px] = aPantalla((i * LADO) / 10, 0), [, py] = aPantalla(0, (i * LADO) / 10);
      g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y0 + LADO * escala); g.stroke();
      g.beginPath(); g.moveTo(x0, py); g.lineTo(x0 + LADO * escala, py); g.stroke();
      if (i < 10) { g.fillText(LETRAS[i], px + (LADO / 20) * escala, Math.max(4, y0 + 4)); g.textAlign = 'left'; g.fillText(String(i + 1), Math.max(4, x0 + 4), py + (LADO / 20) * escala - 6); g.textAlign = 'center'; }
    }
  }
  // tormenta: afuera violeta, el círculo actual blanco y el próximo punteado
  if (zona) {
    const [zx, zy] = aPantalla(zona.x, zona.y);
    g.fillStyle = 'rgba(122,47,208,.42)';
    g.beginPath(); g.rect(0, 0, w, h); g.arc(zx, zy, Math.max(0, zona.r * escala), 0, Math.PI * 2, true); g.fill('evenodd');
    g.strokeStyle = '#f1e3ff'; g.lineWidth = Math.max(1.5, 2 * tamTexto); g.beginPath(); g.arc(zx, zy, zona.r * escala, 0, Math.PI * 2); g.stroke();
    if (zona.siguiente && zona.siguiente !== zona) {
      const [nx, ny] = aPantalla(zona.siguiente.x, zona.siguiente.y);
      g.setLineDash([8 * tamTexto, 6 * tamTexto]); g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(nx, ny, zona.siguiente.r * escala, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
  }
  // recorrido del colectivo
  if (recorrido) {
    const [ax, ay] = aPantalla(recorrido.inicio.x, recorrido.inicio.y), [bx, by] = aPantalla(recorrido.fin.x, recorrido.fin.y);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3 * tamTexto; g.setLineDash([10 * tamTexto, 8 * tamTexto]);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
    const ang = Math.atan2(by - ay, bx - ax);
    g.fillStyle = '#fff'; g.save(); g.translate(bx, by); g.rotate(ang); g.beginPath(); g.moveTo(8 * tamTexto, 0); g.lineTo(-8 * tamTexto, -7 * tamTexto); g.lineTo(-8 * tamTexto, 7 * tamTexto); g.fill(); g.restore();
    if (recorrido.ahora) {
      const [cx2, cy2] = aPantalla(recorrido.ahora.x, recorrido.ahora.y);
      g.fillStyle = '#c5f04a'; g.strokeStyle = '#141413'; g.lineWidth = 2; g.save(); g.translate(cx2, cy2); g.rotate(ang);
      g.beginPath(); g.roundRect(-11 * tamTexto, -6 * tamTexto, 22 * tamTexto, 12 * tamTexto, 3); g.fill(); g.stroke(); g.restore();
    }
  }
  // nombres de los lugares
  if (nombres) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of LUGARES) {
      const [lx, ly] = aPantalla((l.x + l.w / 2) * BALDOSA, (l.y + l.h / 2) * BALDOSA);
      const texto = (escala * LADO > 700 ? l.nombre : l.corto).toUpperCase();
      g.font = `900 ${Math.round(15 * tamTexto)}px "Barlow Condensed", Impact, sans-serif`;
      g.lineWidth = 4 * tamTexto; g.strokeStyle = 'rgba(20,20,19,.85)'; g.lineJoin = 'round';
      g.strokeText(texto, lx, ly); g.fillStyle = '#ffffff'; g.fillText(texto, lx, ly);
    }
  }
  // gente (solo los que te dejamos ver: vos)
  for (const p of gente) { const [px, py] = aPantalla(p.x, p.y); g.fillStyle = p.color || '#fff'; g.beginPath(); g.arc(px, py, 3.5 * tamTexto, 0, 7); g.fill(); }
  // tu marca
  if (marca) {
    const [mx, my] = aPantalla(marca.x, marca.y);
    g.save(); g.translate(mx, my); g.scale(tamTexto, tamTexto);
    g.fillStyle = '#c5f04a'; g.strokeStyle = '#141413'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-9, -10, -9, -22, 0, -22); g.bezierCurveTo(9, -22, 9, -10, 0, 0); g.fill(); g.stroke();
    g.fillStyle = '#141413'; g.beginPath(); g.arc(0, -15, 3, 0, 7); g.fill(); g.restore();
  }
  // vos: flecha que apunta para donde mirás
  if (yo) {
    const [px, py] = aPantalla(yo.x, yo.y);
    g.save(); g.translate(px, py); g.rotate(yo.ang || 0); g.scale(tamTexto, tamTexto);
    g.fillStyle = '#c5f04a'; g.strokeStyle = '#141413'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(10, 0); g.lineTo(-7, -7); g.lineTo(-3, 0); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  g.restore();
  return aPantalla;
}

// Mapa grande (M): rueda para zoom, arrastrar para mover, clic para marcar destino, clic derecho para borrar.
export class MapaGrande {
  constructor(el, { alMarcar }) {
    this.el = el; this.canvas = el.querySelector('canvas'); this.g = this.canvas.getContext('2d');
    this.zoom = 1; this.cx = LADO / 2; this.cy = LADO / 2; this.alMarcar = alMarcar; this.abierto = false;
    let arrastre = null, movio = false;
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect(), [wx, wy] = this.aMundo(e.clientX - r.left, e.clientY - r.top);
      const antes = this.zoom;
      this.zoom = Math.max(1, Math.min(5, this.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const k = antes / this.zoom; this.cx = wx + (this.cx - wx) * k; this.cy = wy + (this.cy - wy) * k; this.limitar();
    }, { passive: false });
    this.canvas.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy }; movio = false; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!arrastre) return;
      const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (Math.hypot(dx, dy) > 5) movio = true;
      if (movio) { const esc = this.escala(); this.cx = arrastre.cx - dx / esc; this.cy = arrastre.cy - dy / esc; this.limitar(); }
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (arrastre && !movio && e.button === 0) { const r = this.canvas.getBoundingClientRect(); const [x, y] = this.aMundo(e.clientX - r.left, e.clientY - r.top); if (x > 0 && y > 0 && x < LADO && y < LADO) this.alMarcar({ x, y }); }
      arrastre = null;
    });
    this.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.alMarcar(null); });
    el.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => { this.zoom = Math.max(1, Math.min(5, this.zoom * (b.dataset.zoom === '+' ? 1.4 : 1 / 1.4))); this.limitar(); }));
    el.querySelector('[data-centrar]')?.addEventListener('click', () => { this.centrarEn = true; });
  }
  escala() { return (Math.min(this.ancho, this.alto) / LADO) * this.zoom; }
  aMundo(px, py) { const esc = this.escala(); return [this.cx + (px - this.ancho / 2) / esc, this.cy + (py - this.alto / 2) / esc]; }
  limitar() { const medio = LADO / 2 / this.zoom; this.cx = Math.max(medio, Math.min(LADO - medio, this.cx)); this.cy = Math.max(medio, Math.min(LADO - medio, this.cy)); if (this.zoom <= 1.01) { this.cx = this.cy = LADO / 2; } }
  abrir(foco) { this.abierto = true; this.el.classList.remove('hidden'); if (foco && this.zoom > 1) { this.cx = foco.x; this.cy = foco.y; this.limitar(); } }
  cerrar() { this.abierto = false; this.el.classList.add('hidden'); }
  alternar(foco) { if (this.abierto) this.cerrar(); else this.abrir(foco); }
  dibujar(img, datos) {
    if (!this.abierto) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.ancho = r.width; this.alto = r.height;
    if (this.canvas.width !== Math.round(r.width * dpr)) { this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr); }
    if (this.centrarEn && datos.yo) { this.zoom = Math.max(this.zoom, 2.2); this.cx = datos.yo.x; this.cy = datos.yo.y; this.limitar(); this.centrarEn = false; }
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujarIsla(this.g, img, { ...datos, w: this.ancho, h: this.alto, cx: this.cx, cy: this.cy, escala: this.escala(), grilla: true, tamTexto: Math.max(1, Math.min(1.6, this.ancho / 520)) });
  }
}
