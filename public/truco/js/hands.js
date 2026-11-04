// Manos en primera persona (dibujadas en canvas, mismo estilo que los personajes).
// - holdBack: antebrazo y palma de la mano izquierda, detrás del abanico de cartas.
// - holdThumb: el pulgar que va por encima de las cartas.
// - reach: la mano derecha que agarra una carta y la apoya en la mesa (con el antebrazo hacia abajo a la derecha).

const INK = '#2b2320';

function mix(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return c;
}

function stroke(ctx, fill, lw = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// Mano izquierda (vista desde los ojos): el antebrazo entra desde abajo a la izquierda,
// la palma queda detrás de las cartas y asoman las puntas de los dedos a la derecha.
export function drawHoldBack(skin, sleeve) {
  return canvas(512, 512, (ctx) => {
    // manga
    ctx.beginPath();
    ctx.moveTo(40, 512);
    ctx.lineTo(150, 330);
    ctx.quadraticCurveTo(210, 300, 262, 352);
    ctx.lineTo(210, 512);
    ctx.closePath();
    stroke(ctx, sleeve, 5);
    ctx.strokeStyle = mix(sleeve.startsWith('#') ? sleeve : '#444444', 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120, 470);
    ctx.quadraticCurveTo(150, 420, 140, 380);
    ctx.stroke();
    // puño de la manga
    ctx.beginPath();
    ctx.moveTo(150, 330);
    ctx.quadraticCurveTo(210, 300, 262, 352);
    ctx.lineTo(250, 372);
    ctx.quadraticCurveTo(200, 330, 158, 352);
    ctx.closePath();
    stroke(ctx, mix(sleeve.startsWith('#') ? sleeve : '#444444', 1.15), 4);
    // muñeca y palma
    ctx.beginPath();
    ctx.moveTo(170, 340);
    ctx.bezierCurveTo(170, 250, 220, 190, 300, 196);
    ctx.bezierCurveTo(372, 202, 392, 270, 360, 320);
    ctx.bezierCurveTo(330, 360, 270, 372, 238, 352);
    ctx.closePath();
    stroke(ctx, skin, 5);
    ctx.fillStyle = 'rgba(80,40,30,0.18)';
    ctx.beginPath();
    ctx.ellipse(300, 300, 50, 26, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // puntas de los dedos que asoman por el costado derecho de las cartas
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(388 + i * 6, 150 + i * 34, 26, 15, -0.5 + i * 0.1, 0, Math.PI * 2);
      stroke(ctx, skin, 4);
      ctx.strokeStyle = 'rgba(80,40,30,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(398 + i * 6, 146 + i * 34);
      ctx.lineTo(408 + i * 6, 156 + i * 34);
      ctx.stroke();
    }
  });
}

// Pulgar por encima de las cartas (abajo a la izquierda del abanico).
export function drawHoldThumb(skin) {
  return canvas(256, 256, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(30, 230);
    ctx.bezierCurveTo(40, 160, 90, 100, 150, 86);
    ctx.bezierCurveTo(190, 76, 214, 104, 196, 130);
    ctx.bezierCurveTo(170, 160, 120, 190, 96, 240);
    ctx.closePath();
    stroke(ctx, skin, 5);
    // uña
    ctx.beginPath();
    ctx.ellipse(176, 104, 18, 12, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = mix(skin, 1.08);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,40,30,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// Mano derecha que agarra la carta desde arriba y el antebrazo que va hacia abajo a la derecha.
export function drawReach(skin, sleeve) {
  return canvas(512, 512, (ctx) => {
    // antebrazo con manga
    ctx.beginPath();
    ctx.moveTo(300, 290);
    ctx.lineTo(512, 470);
    ctx.lineTo(512, 512);
    ctx.lineTo(430, 512);
    ctx.lineTo(240, 330);
    ctx.closePath();
    stroke(ctx, sleeve, 5);
    ctx.beginPath();
    ctx.moveTo(238, 300);
    ctx.lineTo(300, 260);
    ctx.lineTo(320, 300);
    ctx.lineTo(262, 344);
    ctx.closePath();
    stroke(ctx, skin, 4);
    // dorso de la mano
    ctx.beginPath();
    ctx.moveTo(150, 240);
    ctx.bezierCurveTo(150, 190, 220, 170, 268, 196);
    ctx.bezierCurveTo(312, 220, 306, 290, 262, 318);
    ctx.bezierCurveTo(220, 340, 170, 310, 150, 240);
    ctx.closePath();
    stroke(ctx, skin, 5);
    // dedos sobre la carta (índice y mayor) y pulgar abajo
    const fingers = [
      [150, 230, 96, 214],
      [160, 262, 102, 252],
      [178, 290, 124, 290],
    ];
    for (const [x1, y1, x2, y2] of fingers) {
      ctx.beginPath();
      ctx.moveTo(x1, y1 - 14);
      ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 22, x2, y2 - 10);
      ctx.quadraticCurveTo(x2 - 16, y2 + 2, x2, y2 + 12);
      ctx.quadraticCurveTo((x1 + x2) / 2, y1 + 8, x1, y1 + 14);
      ctx.closePath();
      stroke(ctx, skin, 4);
    }
    ctx.strokeStyle = 'rgba(80,40,30,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(200 + i * 18, 210 + i * 10);
      ctx.lineTo(214 + i * 18, 236 + i * 10);
      ctx.stroke();
    }
  });
}
