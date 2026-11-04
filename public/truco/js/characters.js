// Personajes 2D ilustrados (se dibujan en un canvas y se usan como "recorte" dentro de la escena 3D).
// Cada personaje tiene un aspecto fijo (según su nombre) y una cara que cambia con las señas,
// con lo que dice y con hacia dónde mira.

export const W = 512;
export const H = 768;

// Señas: id -> { label, expr, desc }. La expresión es la cara que pone el personaje.
export const SENAS = {
  ancho_espada: { label: 'Ancho de espada', expr: 'brows', desc: 'Levantar las cejas' },
  ancho_basto: { label: 'Ancho de basto', expr: 'wink', desc: 'Guiñar un ojo' },
  siete_espada: { label: 'Siete de espada', expr: 'mouthRight', desc: 'Torcer la boca a la derecha' },
  siete_oro: { label: 'Siete de oro', expr: 'mouthLeft', desc: 'Torcer la boca a la izquierda' },
  tres: { label: 'Un tres', expr: 'bite', desc: 'Morderse el labio' },
  dos: { label: 'Un dos', expr: 'kiss', desc: 'Trompita (beso)' },
  ancho_falso: { label: 'Ancho falso', expr: 'tongue', desc: 'Mostrar la punta de la lengua' },
  ciego: { label: 'Nada (ciego)', expr: 'eyesClosed', desc: 'Cerrar los ojos' },
  envido_alto: { label: 'Tengo envido', expr: 'puff', desc: 'Inflar los cachetes' },
  treinta: { label: '30 o más de envido', expr: 'nose', desc: 'Fruncir la nariz' },
  nada_envido: { label: 'No tengo envido', expr: 'frown', desc: 'Boca para abajo' },
};

const SKINS = ['#f1c7a5', '#e0ac85', '#c98d64', '#a86f4c', '#7d4f33', '#f5d6bd'];
const HAIRS = ['#2b1d14', '#4a3020', '#7a4b26', '#b88a4a', '#d9c7a0', '#8a8a8a', '#1c1c1c', '#a33b1f'];
const SHIRTS = ['#2f5d8a', '#8a2f2f', '#2f7a4d', '#6b4a8a', '#c7922f', '#3a3a3a', '#d9d4c7', '#1f6f7a', '#7a2f5d'];
const STYLES = ['short', 'long', 'bald', 'curly', 'cap', 'boina', 'bun', 'mohawk'];

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function lookFor(name, seat) {
  const h = hash(name + '#' + seat);
  const pick = (arr, k) => arr[(h >>> k) % arr.length];
  return {
    skin: pick(SKINS, 0),
    hair: pick(HAIRS, 3),
    shirt: pick(SHIRTS, 7),
    style: pick(STYLES, 11),
    beard: (h >>> 15) % 4 === 0,
    mustache: (h >>> 17) % 3 === 0,
    glasses: (h >>> 19) % 5 === 0,
    collar: (h >>> 21) % 2 === 0,
    faceW: 84 + ((h >>> 23) % 14),
    faceH: 102 + ((h >>> 26) % 12),
  };
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function ell(ctx, x, y, rx, ry, fill, stroke, lw = 3) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// state: { expr, talking, gx, gy, cards, team, highlight }
// gx/gy: hacia dónde mira, en coordenadas de la imagen (-1..1). gx>0 = a la derecha de la imagen.
export function drawCharacter(ctx, look, state) {
  const { expr = 'neutral', talking = false, gx = 0, gy = 0, cards = 0 } = state;
  ctx.clearRect(0, 0, W, H);
  const line = '#2a1a12';
  const cx = 256 + gx * 10; // la cabeza gira un poquito hacia donde mira
  const cy = 250 + gy * 6;
  const fw = look.faceW;
  const fh = look.faceH;
  const skinD = shade(look.skin, 0.82);

  // ---- cuerpo
  ctx.save();
  ctx.fillStyle = look.shirt;
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(256 - 70, 350);
  ctx.quadraticCurveTo(256 - 175, 370, 256 - 200, 470);
  ctx.lineTo(256 - 215, 768);
  ctx.lineTo(256 + 215, 768);
  ctx.lineTo(256 + 200, 470);
  ctx.quadraticCurveTo(256 + 175, 370, 256 + 70, 350);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // pliegues
  ctx.strokeStyle = shade(look.shirt, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(256 - 120, 480);
  ctx.quadraticCurveTo(256 - 100, 560, 256 - 130, 640);
  ctx.moveTo(256 + 120, 480);
  ctx.quadraticCurveTo(256 + 100, 560, 256 + 130, 640);
  ctx.stroke();
  // cuello
  ctx.fillStyle = skinD;
  ctx.beginPath();
  ctx.moveTo(256 - 36, 310);
  ctx.lineTo(256 - 40, 368);
  ctx.quadraticCurveTo(256, 392, 256 + 40, 368);
  ctx.lineTo(256 + 36, 310);
  ctx.closePath();
  ctx.fill();
  if (look.collar) {
    ctx.fillStyle = shade(look.shirt, 1.25);
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256 - 48, 352);
    ctx.lineTo(256 - 10, 410);
    ctx.lineTo(256 - 62, 395);
    ctx.closePath();
    ctx.moveTo(256 + 48, 352);
    ctx.lineTo(256 + 10, 410);
    ctx.lineTo(256 + 62, 395);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = shade(look.shirt, 0.6);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 345, 46, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  // ---- brazos y cartas en la mano
  drawArmsAndCards(ctx, look, cards, line);

  // ---- pelo de atrás
  ctx.save();
  const hair = look.hair;
  if (look.style === 'long') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(cx - fw - 14, cy - 30);
    ctx.quadraticCurveTo(cx - fw - 30, cy + 120, cx - fw + 6, cy + 150);
    ctx.lineTo(cx + fw - 6, cy + 150);
    ctx.quadraticCurveTo(cx + fw + 30, cy + 120, cx + fw + 14, cy - 30);
    ctx.closePath();
    ctx.fill();
  }
  if (look.style === 'bun') ell(ctx, cx, cy - fh - 18, 36, 30, hair, line, 3);
  ctx.restore();

  // ---- orejas
  ell(ctx, cx - fw + 2, cy + 6, 16, 24, look.skin, line, 3);
  ell(ctx, cx + fw - 2, cy + 6, 16, 24, look.skin, line, 3);

  // ---- cachetes inflados (se dibujan antes de la cara para ensanchar)
  const puff = expr === 'puff';
  if (puff) {
    ell(ctx, cx - fw * 0.62, cy + 40, 44, 40, look.skin, line, 3);
    ell(ctx, cx + fw * 0.62, cy + 40, 44, 40, look.skin, line, 3);
  }

  // ---- cara
  ctx.save();
  const grd = ctx.createRadialGradient(cx - 20, cy - 30, 10, cx, cy, fh * 1.1);
  grd.addColorStop(0, shade(look.skin, 1.06));
  grd.addColorStop(1, shade(look.skin, 0.9));
  ell(ctx, cx, cy, fw, fh, grd, line, 4);
  ctx.restore();
  if (puff) {
    // tapa el contorno interno de los cachetes
    ell(ctx, cx - fw * 0.55, cy + 40, 38, 34, shade(look.skin, 0.95));
    ell(ctx, cx + fw * 0.55, cy + 40, 38, 34, shade(look.skin, 0.95));
  }

  // rubor
  ctx.globalAlpha = puff ? 0.55 : 0.22;
  ell(ctx, cx - fw * 0.55, cy + 34, 20, 12, '#e86a6a');
  ell(ctx, cx + fw * 0.55, cy + 34, 20, 12, '#e86a6a');
  ctx.globalAlpha = 1;

  // ---- pelo de adelante / gorros
  drawHairFront(ctx, look, cx, cy, fw, fh, line);

  // ---- ojos
  const eyeY = cy - 8;
  const eyeDX = fw * 0.4;
  const squint = expr === 'nose';
  // izquierda y derecha DE LA IMAGEN. El ojo derecho del personaje está a la izquierda de la imagen.
  const closedL = expr === 'eyesClosed';
  const closedR = expr === 'eyesClosed' || expr === 'wink'; // guiña su ojo izquierdo = derecha de la imagen
  drawEye(ctx, cx - eyeDX, eyeY, closedL, squint, gx, gy, line);
  drawEye(ctx, cx + eyeDX, eyeY, closedR, squint, gx, gy, line);
  if (look.glasses) {
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - eyeDX - 30, eyeY - 22, 60, 44, 12);
    ctx.roundRect(cx + eyeDX - 30, eyeY - 22, 60, 44, 12);
    ctx.moveTo(cx - eyeDX + 30, eyeY - 4);
    ctx.lineTo(cx + eyeDX - 30, eyeY - 4);
    ctx.stroke();
  }

  // ---- cejas
  const up = expr === 'brows' ? 22 : 0;
  const browCol = look.style === 'bald' ? shade(look.hair, 0.8) : look.hair;
  ctx.strokeStyle = browCol;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = cx + side * eyeDX;
    const by = eyeY - 30 - up + (squint ? 8 : 0);
    ctx.beginPath();
    if (expr === 'brows') {
      ctx.moveTo(bx - 26, by + 8);
      ctx.quadraticCurveTo(bx, by - 14, bx + 26, by + 8);
    } else if (squint || expr === 'frown') {
      ctx.moveTo(bx - 24 * side, by - 2);
      ctx.lineTo(bx + 24 * side, by + 8);
    } else {
      ctx.moveTo(bx - 24, by + 4);
      ctx.quadraticCurveTo(bx, by - 4, bx + 24, by + 4);
    }
    ctx.stroke();
  }
  if (expr === 'brows') {
    // arrugas en la frente
    ctx.strokeStyle = shade(look.skin, 0.7);
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy - 74 - i * 10);
      ctx.quadraticCurveTo(cx, cy - 82 - i * 10, cx + 34, cy - 74 - i * 10);
      ctx.stroke();
    }
  }

  // ---- nariz
  ctx.strokeStyle = shade(look.skin, 0.6);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 2, eyeY + 6);
  ctx.quadraticCurveTo(cx + 12, eyeY + 40, cx + 2, eyeY + 48);
  ctx.quadraticCurveTo(cx - 8, eyeY + 52, cx - 14, eyeY + 44);
  ctx.stroke();
  if (squint) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = shade(look.skin, 0.55);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, eyeY + 6 + i * 7);
      ctx.lineTo(cx + 10, eyeY + 2 + i * 7);
      ctx.stroke();
    }
  }

  // ---- bigote / barba
  if (look.beard) {
    ctx.fillStyle = look.hair;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(cx - fw + 6, cy + 10);
    ctx.quadraticCurveTo(cx - fw + 10, cy + fh + 10, cx, cy + fh + 18);
    ctx.quadraticCurveTo(cx + fw - 10, cy + fh + 10, cx + fw - 6, cy + 10);
    ctx.quadraticCurveTo(cx + fw * 0.5, cy + 60, cx, cy + 58);
    ctx.quadraticCurveTo(cx - fw * 0.5, cy + 60, cx - fw + 6, cy + 10);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- boca
  drawMouth(ctx, look, cx, cy + 62, expr, talking, line);

  if (look.mustache || look.beard) {
    ctx.fillStyle = look.hair;
    const tilt = expr === 'mouthRight' ? -10 : expr === 'mouthLeft' ? 10 : 0;
    ctx.beginPath();
    ctx.moveTo(cx - 40 + tilt, cy + 56);
    ctx.quadraticCurveTo(cx + tilt, cy + 36, cx + 40 + tilt, cy + 56);
    ctx.quadraticCurveTo(cx + tilt, cy + 48, cx - 40 + tilt, cy + 56);
    ctx.fill();
  }
}

function drawEye(ctx, x, y, closed, squint, gx, gy, line) {
  if (closed) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    ctx.quadraticCurveTo(x, y + 10, x + 20, y);
    ctx.stroke();
    // pestañas
    ctx.lineWidth = 3;
    for (const dx of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + 6);
      ctx.lineTo(x + dx * 1.2, y + 13);
      ctx.stroke();
    }
    return;
  }
  const ry = squint ? 8 : 15;
  ell(ctx, x, y, 21, ry, '#fbfbf7', line, 3);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, 20, ry - 1, 0, 0, Math.PI * 2);
  ctx.clip();
  const px = x + gx * 9;
  const py = y + gy * 6;
  ell(ctx, px, py, 10, 11, '#5a3a1e');
  ell(ctx, px, py, 5.5, 6, '#111');
  ell(ctx, px - 3, py - 4, 2.5, 2.5, '#fff');
  ctx.restore();
  // párpado superior
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x, y, 21, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawMouth(ctx, look, x, y, expr, talking, line) {
  const lip = '#b5534d';
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  switch (expr) {
    case 'mouthRight': // a la derecha del personaje = izquierda de la imagen
    case 'mouthLeft': {
      const s = expr === 'mouthRight' ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x - 16 * s, y + 4);
      ctx.quadraticCurveTo(x + 14 * s, y + 6, x + 40 * s, y - 12);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 42 * s, y - 14, 6, 0, Math.PI * 2);
      ctx.strokeStyle = shade(look.skin, 0.7);
      ctx.stroke();
      return;
    }
    case 'bite': {
      ell(ctx, x, y + 2, 30, 14, '#5a1f1f', line, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 22, y - 8, 44, 12);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      for (const dx of [-11, 0, 11]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y - 8);
        ctx.lineTo(x + dx, y + 4);
        ctx.stroke();
      }
      ell(ctx, x, y + 10, 26, 7, lip);
      return;
    }
    case 'kiss': {
      ell(ctx, x + 4, y, 16, 14, lip, line, 4);
      ell(ctx, x + 4, y, 6, 5, '#5a1f1f');
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8);
      ctx.lineTo(x - 3, y - 4);
      ctx.moveTo(x - 8, y + 8);
      ctx.lineTo(x - 3, y + 4);
      ctx.stroke();
      return;
    }
    case 'tongue': {
      ctx.beginPath();
      ctx.moveTo(x - 30, y);
      ctx.quadraticCurveTo(x, y + 6, x + 30, y);
      ctx.stroke();
      ell(ctx, x + 6, y + 10, 13, 12, '#e0707a', line, 3);
      ctx.strokeStyle = '#b44a55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 4);
      ctx.lineTo(x + 6, y + 14);
      ctx.stroke();
      return;
    }
    case 'puff': {
      ell(ctx, x, y, 12, 6, lip, line, 3);
      return;
    }
    case 'frown': {
      ctx.beginPath();
      ctx.moveTo(x - 30, y + 10);
      ctx.quadraticCurveTo(x, y - 12, x + 30, y + 10);
      ctx.stroke();
      return;
    }
  }
  if (talking) {
    ell(ctx, x, y + 4, 22, 16, '#5a1f1f', line, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 14, y - 10, 28, 6);
    ell(ctx, x, y + 14, 12, 5, '#d0606a');
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x - 28, y);
  ctx.quadraticCurveTo(x, y + 10, x + 28, y);
  ctx.stroke();
}

function drawHairFront(ctx, look, cx, cy, fw, fh, line) {
  const hair = look.hair;
  ctx.fillStyle = hair;
  ctx.strokeStyle = shade(hair, 0.6);
  ctx.lineWidth = 3;
  const top = cy - fh;
  switch (look.style) {
    case 'bald':
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ell(ctx, cx - 25, top + 30, 26, 12, 'rgba(255,255,255,0.25)');
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.ellipse(cx - fw + 8, cy - 20, 10, 34, 0.1, 0, Math.PI * 2);
      ctx.ellipse(cx + fw - 8, cy - 20, 10, 34, -0.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'curly':
      for (let i = 0; i < 13; i++) {
        const a = Math.PI * (1.0 + i / 12);
        ell(ctx, cx + Math.cos(a) * fw * 0.98, cy - 18 + Math.sin(a) * fh * 0.92, 24, 22, hair, shade(hair, 0.6), 2);
      }
      return;
    case 'mohawk':
      ctx.beginPath();
      ctx.moveTo(cx - 18, top + 30);
      for (let i = 0; i <= 6; i++) ctx.lineTo(cx - 18 + i * 6, top - 30 - (i % 2) * 14);
      ctx.lineTo(cx + 18, top + 30);
      ctx.closePath();
      ctx.fill();
      return;
    case 'cap': {
      ctx.fillStyle = shade(look.shirt, 1.1);
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.ellipse(cx, top + 38, fw + 6, 62, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(look.shirt, 0.8);
      ctx.beginPath();
      ctx.ellipse(cx + 20, top + 40, fw + 22, 16, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'boina': {
      ctx.fillStyle = '#1f2533';
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.ellipse(cx + 10, top + 22, fw + 26, 40, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ell(ctx, cx + 10, top - 16, 6, 8, '#1f2533', line, 2);
      return;
    }
    default: {
      // corto / largo / rodete: flequillo
      ctx.beginPath();
      ctx.moveTo(cx - fw - 4, cy - 8);
      ctx.quadraticCurveTo(cx - fw - 6, top - 14, cx, top - 16);
      ctx.quadraticCurveTo(cx + fw + 6, top - 14, cx + fw + 4, cy - 8);
      ctx.quadraticCurveTo(cx + fw - 8, top + 30, cx + 20, top + 34);
      ctx.quadraticCurveTo(cx - 10, top + 20, cx - 30, top + 40);
      ctx.quadraticCurveTo(cx - fw + 4, top + 40, cx - fw - 4, cy - 8);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawArmsAndCards(ctx, look, cards, line) {
  // antebrazos que vienen hacia adelante, apoyados sobre la mesa
  ctx.fillStyle = look.shirt;
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(256 + s * 190, 470);
    ctx.quadraticCurveTo(256 + s * 200, 600, 256 + s * 90, 650);
    ctx.lineTo(256 + s * 60, 610);
    ctx.quadraticCurveTo(256 + s * 140, 570, 256 + s * 140, 480);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // cartas (dorso) en abanico
  const n = Math.max(0, Math.min(3, cards));
  for (let i = 0; i < n; i++) {
    const ang = (i - (n - 1) / 2) * 0.28;
    ctx.save();
    ctx.translate(256, 640);
    ctx.rotate(ang);
    ctx.fillStyle = '#f4f1ea';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-34, -118, 68, 104, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#26306a';
    ctx.beginPath();
    ctx.roundRect(-28, -112, 56, 92, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let k = -24; k <= 24; k += 8) {
      ctx.beginPath();
      ctx.moveTo(k, -110);
      ctx.lineTo(-k, -22);
      ctx.stroke();
    }
    ctx.restore();
  }
  // manos
  for (const s of [-1, 1]) ell(ctx, 256 + s * 66, 636, 26, 22, look.skin, line, 3);
}
