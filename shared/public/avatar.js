// Avatares dibujados (SVG) de personas: busto con cara, pelo, ropa y accesorios.
// Usan el mismo "look" que los muñecos 3D (ver npcs.js), así cada personaje se reconoce en todos los juegos.
import { POR_ID, LOOKS_EXTRA, rngNpc } from './npcs.js';

// Look para una persona real (sale de su id, con el color que eligió).
export function lookDeId(id, color = '#7aa2ff') {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rngNpc(h);
  const de = (l) => l[Math.floor(r() * l.length)];
  return {
    piel: de(['#f0cfb4', '#e8c4a8', '#d9a982', '#b98463', '#8d5b3e']),
    pelo: { estilo: de(['corto', 'corto', 'rulos', 'largo', 'poco']), color: de(['#1e1610', '#3b2a1e', '#6b4226', '#c49a5a', '#141414']) },
    ojos: '#1b1410',
    cuerpo: de(['flaco', 'normal', 'normal', 'gordito']),
    ropa: { remera: color, pantalon: '#2b2b33' },
  };
}

// Look de un bot por su nombre (NPC del club o personaje extra de los memes).
export function lookDeNombre(nombre) {
  const n = String(nombre || '').trim();
  const npc = Object.values(POR_ID).find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  if (npc) return { ...npc.look, smoking: npc.smoking };
  return LOOKS_EXTRA[n] || lookDeId(n, '#9be15d');
}

const oscurecer = (hex, k = 0.75) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

// SVG cuadrado (viewBox 100x100): fondo redondo de color, hombros con la remera y la cabeza.
export function avatarSvg(look = {}, { fondo = null, titulo = '' } = {}) {
  const L = { piel: '#e8c4a8', pelo: { estilo: 'corto', color: '#2b1d14' }, ojos: '#1b1410', cuerpo: 'normal', ropa: { remera: '#7aa2ff' }, ...look };
  const remera = L.smoking ? '#141416' : L.ropa?.remera || '#7aa2ff';
  const piel = L.piel;
  const pelo = L.pelo?.color || '#222';
  const est = L.pelo?.estilo || 'corto';
  const ancho = { flaco: 30, normal: 34, gordito: 40 }[L.cuerpo] || 34;
  const bg = fondo || oscurecer(remera, 0.55);
  const cx = 50;
  const cy = 44; // centro de la cabeza
  const rx = L.cuerpo === 'gordito' ? 22 : 20;
  const ry = 22;
  let s = '';
  // hombros
  s += `<path d="M${cx - ancho} 100 Q${cx - ancho} ${70} ${cx} ${68} Q${cx + ancho} ${70} ${cx + ancho} 100 Z" fill="${remera}"/>`;
  if (L.smoking) s += `<path d="M44 70 L50 86 L56 70 Z" fill="#f4f4ee"/><rect x="45" y="70" width="10" height="4" rx="2" fill="#0b0b0b"/>`;
  if (L.ropa?.franja && !L.smoking) s += `<rect x="${cx - ancho + 4}" y="84" width="${ancho * 2 - 8}" height="5" fill="${L.ropa.franja}"/>`;
  if (L.capa) s += `<path d="M${cx - ancho - 2} 100 Q${cx - ancho} 72 ${cx - 14} 70 L${cx - 18} 100Z M${cx + ancho + 2} 100 Q${cx + ancho} 72 ${cx + 14} 70 L${cx + 18} 100Z" fill="${L.capa}"/>`;
  // pelo de atrás (largo)
  if (est === 'largo') s += `<path d="M${cx - rx - 3} ${cy - 4} Q${cx - rx - 6} ${cy + 30} ${cx - rx + 2} ${cy + 32} L${cx + rx - 2} ${cy + 32} Q${cx + rx + 6} ${cy + 30} ${cx + rx + 3} ${cy - 4} Z" fill="${pelo}"/>`;
  // orejas y cabeza
  if (!L.robot) s += `<circle cx="${cx - rx}" cy="${cy + 2}" r="4.5" fill="${piel}"/><circle cx="${cx + rx}" cy="${cy + 2}" r="4.5" fill="${piel}"/>`;
  s += L.robot ? `<rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" rx="10" fill="${piel}" stroke="#5d6773" stroke-width="2"/>` : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${piel}"/>`;
  // pelo de arriba
  const top = `M${cx - rx - 1} ${cy - 2}`;
  if (est === 'corto' || est === 'largo') s += `<path d="${top} Q${cx - rx} ${cy - ry - 8} ${cx} ${cy - ry - 3} Q${cx + rx} ${cy - ry - 8} ${cx + rx + 1} ${cy - 2} Q${cx + rx - 4} ${cy - 14} ${cx + 4} ${cy - 15} Q${cx - 10} ${cy - 15} ${cx - rx + 3} ${cy - 6} Z" fill="${pelo}"/>`;
  else if (est === 'poco') s += `<path d="M${cx - rx - 1} ${cy + 4} Q${cx - rx - 2} ${cy - 10} ${cx - rx + 6} ${cy - 14} L${cx - rx + 6} ${cy + 2} Z M${cx + rx + 1} ${cy + 4} Q${cx + rx + 2} ${cy - 10} ${cx + rx - 6} ${cy - 14} L${cx + rx - 6} ${cy + 2} Z" fill="${pelo}"/>`;
  else if (est === 'rulos' || est === 'rulosPoco') {
    const n = est === 'rulos' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      s += `<circle cx="${cx + Math.cos(a) * (rx - 2)}" cy="${cy - 6 + Math.sin(a) * (ry - 2)}" r="${est === 'rulos' ? 7 : 5}" fill="${pelo}"/>`;
    }
  }
  // cara
  // ojos con blanco, iris, pupila y brillo; nariz; labios
  const iris = L.robot ? '#38d9e6' : L.ojos || '#5a3a22';
  for (const dx of [-7.5, 7.5]) {
    s += `<ellipse cx="${cx + dx}" cy="${cy + 1}" rx="4.6" ry="3.4" fill="#f8f5f0"/>`;
    s += `<circle cx="${cx + dx}" cy="${cy + 1.2}" r="2.5" fill="${iris}"/><circle cx="${cx + dx}" cy="${cy + 1.2}" r="1.2" fill="#0b0b0b"/><circle cx="${cx + dx + 0.9}" cy="${cy + 0.3}" r=".7" fill="#fff"/>`;
    s += `<path d="M${cx + dx - 4.8} ${cy - 0.4} Q${cx + dx} ${cy - 3.8} ${cx + dx + 4.8} ${cy - 0.4}" stroke="#2a1d16" stroke-width="1.1" fill="none"/>`;
  }
  if (!L.robot) {
    s += `<circle cx="${cx - 13}" cy="${cy + 10}" r="3.4" fill="#ff8a7a" opacity=".18"/><circle cx="${cx + 13}" cy="${cy + 10}" r="3.4" fill="#ff8a7a" opacity=".18"/>`;
    s += `<path d="M${cx} ${cy + 2} Q${cx - 2.6} ${cy + 8} ${cx - 2.2} ${cy + 9} Q${cx} ${cy + 10.2} ${cx + 2.2} ${cy + 9}" stroke="${oscurecer(piel, 0.7)}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  }
  s += `<path d="M${cx - 2.2} ${cy - 6.5}" />`;
  const ceja = L.barba || (est === 'calvo' ? oscurecer(piel, 0.6) : pelo);
  s += `<path d="M${cx - 12} ${cy - 5} Q${cx - 7.5} ${cy - 7.5} ${cx - 3} ${cy - 5.5} M${cx + 12} ${cy - 5} Q${cx + 7.5} ${cy - 7.5} ${cx + 3} ${cy - 5.5}" stroke="${ceja}" stroke-width="${est === 'calvo' ? 1.3 : 2}" fill="none" stroke-linecap="round"/>`;
  if (L.barba) s += `<path d="M${cx - rx + 2} ${cy + 6} Q${cx - rx + 2} ${cy + ry + 6} ${cx} ${cy + ry + 6} Q${cx + rx - 2} ${cy + ry + 6} ${cx + rx - 2} ${cy + 6} Q${cx + 8} ${cy + 16} ${cx} ${cy + 16} Q${cx - 8} ${cy + 16} ${cx - rx + 2} ${cy + 6}Z" fill="${L.barba}"/><path d="M${cx - 6} ${cy + 12} Q${cx} ${cy + 10} ${cx + 6} ${cy + 12}" stroke="${L.barba}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M${cx - 4.5} ${cy + 13.5} Q${cx} ${cy + 12.2} ${cx + 4.5} ${cy + 13.5} Q${cx} ${cy + 16.4} ${cx - 4.5} ${cy + 13.5}Z" fill="#b9675e"/>`;
  // accesorios
  if (L.lentes) s += `<g fill="none" stroke="${L.lentes}" stroke-width="2"><circle cx="${cx - 7.5}" cy="${cy + 1}" r="6"/><circle cx="${cx + 7.5}" cy="${cy + 1}" r="6"/><path d="M${cx - 1.5} ${cy + 1}h3"/></g>`;
  if (L.antifaz) s += `<rect x="${cx - rx + 1}" y="${cy - 5}" width="${rx * 2 - 2}" height="10" rx="5" fill="${L.antifaz}" opacity=".9"/><ellipse cx="${cx - 7.5}" cy="${cy}" rx="3" ry="3" fill="#fff"/><ellipse cx="${cx + 7.5}" cy="${cy}" rx="3" ry="3" fill="#fff"/>`;
  if (L.kipa) s += `<path d="M${cx - 9} ${cy - ry + 3} Q${cx} ${cy - ry - 7} ${cx + 9} ${cy - ry + 3} Z" fill="${L.kipa}"/>`;
  if (L.sombrero) s += `<rect x="${cx - rx - 8}" y="${cy - ry - 2}" width="${rx * 2 + 16}" height="5" rx="2" fill="${L.sombrero}"/><rect x="${cx - 13}" y="${cy - ry - 14}" width="26" height="13" rx="3" fill="${L.sombrero}"/>`;
  if (L.auriculares) s += `<path d="M${cx - rx - 2} ${cy + 2} Q${cx - rx} ${cy - ry - 8} ${cx} ${cy - ry - 7} Q${cx + rx} ${cy - ry - 8} ${cx + rx + 2} ${cy + 2}" stroke="${L.auriculares}" stroke-width="3.5" fill="none"/><rect x="${cx - rx - 6}" y="${cy - 4}" width="7" height="12" rx="3" fill="${L.auriculares}"/><rect x="${cx + rx - 1}" y="${cy - 4}" width="7" height="12" rx="3" fill="${L.auriculares}"/>`;
  if (L.robot) s += `<path d="M${cx} ${cy - ry} v-8" stroke="#8a96a3" stroke-width="2"/><circle cx="${cx}" cy="${cy - ry - 9}" r="3" fill="#ff6b5b"/>`;
  const brillo = L.dorado ? `<circle cx="50" cy="50" r="47" fill="none" stroke="#f2c94c" stroke-width="5"/>` : '';
  return `<svg viewBox="0 0 100 100" class="avatar-svg" role="img" aria-label="${String(titulo).replace(/"/g, '')}"><defs><clipPath id="cr"><circle cx="50" cy="50" r="48"/></clipPath></defs><circle cx="50" cy="50" r="48" fill="${bg}"/><g clip-path="url(#cr)">${s}</g>${brillo}</svg>`;
}
