// Caras pintadas para los personajes del elenco que no tienen captura de Meshy: mismo formato que las
// capturas (frente | espalda en una sola textura) y una silueta de cabeza con forma de huevo y orejas.
// Así comparten el cuerpo low-poly de Glinsky, Julo, Faur, Dobro y Mati.

const lerp = (a, b, t) => a + (b - a) * t;
function mezclar(hex, otro, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(otro.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Silueta: filas [y, xl, xr] en metros, de arriba (0) al mentón (alto).
export function siluetaCabeza({ ancho = .46, alto = .56, pelo = 'corto' } = {}) {
  const filas = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    let w = Math.sqrt(Math.max(0, 1 - ((v - .47) / .53) ** 2)) * ancho / 2;
    if (v > .6) w *= 1 - .3 * ((v - .6) / .4) ** 1.5; // mandíbula y mentón
    if (v > .42 && v < .66) w += .028 * Math.sin(((v - .42) / .24) * Math.PI); // orejas
    if (pelo === 'rulos' || pelo === 'largo') w *= v < .3 ? 1.07 : 1;
    filas.push([+(v * alto).toFixed(4), -w, w]);
  }
  return { perfil: filas, x0: -ancho / 2 - .03, x1: ancho / 2 + .03, alto };
}

// Textura 512×(alto) con la cara adelante y la nuca atrás.
export function pintarCara(L, { ancho = 256, alto = 312 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = ancho * 2; cv.height = alto;
  const g = cv.getContext('2d');
  const piel = L.piel || '#e8c4a8';
  const pelo = L.pelo?.color || '#2b1d14';
  const estilo = L.pelo?.estilo || 'corto';
  const W = ancho, H = alto, cx = W / 2;
  const robot = !!L.robot;

  // ---- frente
  g.fillStyle = piel; g.fillRect(0, 0, W, H);
  // volumen: más oscuro en los bordes, luz en la frente y los pómulos
  let gr = g.createRadialGradient(cx * .92, H * .42, W * .1, cx, H * .5, W * .62);
  gr.addColorStop(0, 'rgba(255,240,225,.22)'); gr.addColorStop(.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,25,10,.28)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // orejas
  for (const s of [-1, 1]) {
    g.fillStyle = mezclar(piel, '#7a3b2a', .18);
    g.beginPath(); g.ellipse(cx + s * W * .47, H * .54, W * .05, H * .07, 0, 0, Math.PI * 2); g.fill();
  }
  if (!robot) {
    // mejillas apenas rosadas
    for (const s of [-1, 1]) {
      const m = g.createRadialGradient(cx + s * W * .22, H * .66, 2, cx + s * W * .22, H * .66, W * .13);
      m.addColorStop(0, 'rgba(225,110,95,.22)'); m.addColorStop(1, 'rgba(225,110,95,0)');
      g.fillStyle = m; g.fillRect(0, 0, W, H);
    }
  }
  // pelo (vista de frente)
  if (estilo !== 'calvo' && !robot) {
    g.fillStyle = pelo;
    g.beginPath();
    if (estilo === 'largo') {
      g.moveTo(0, H * .95); g.lineTo(0, H * .2);
      g.quadraticCurveTo(cx, -H * .12, W, H * .2); g.lineTo(W, H * .95);
      g.lineTo(W * .86, H * .95); g.quadraticCurveTo(W * .84, H * .42, W * .62, H * .26);
      g.quadraticCurveTo(cx, H * .32, W * .36, H * .25); g.quadraticCurveTo(W * .16, H * .4, W * .14, H * .95); g.closePath();
    } else if (estilo === 'rulos' || estilo === 'rulosCorto') {
      g.moveTo(0, H * .42); g.quadraticCurveTo(cx, -H * .2, W, H * .42); g.lineTo(W * .88, H * .36);
      for (let i = 0; i <= 8; i++) g.lineTo(W * (.88 - i * .095), H * (.27 + (i % 2) * .05));
      g.closePath();
    } else if (estilo === 'poco' || estilo === 'entradas') {
      g.moveTo(0, H * .55); g.quadraticCurveTo(W * .02, H * .12, W * .22, H * .1); g.quadraticCurveTo(cx, H * .22, W * .78, H * .1);
      g.quadraticCurveTo(W * .98, H * .12, W, H * .55); g.lineTo(W * .9, H * .55); g.lineTo(W * .9, H * .32); g.lineTo(W * .1, H * .32); g.lineTo(W * .1, H * .55); g.closePath();
    } else {
      g.moveTo(0, H * .5); g.quadraticCurveTo(0, -H * .05, cx, -H * .02); g.quadraticCurveTo(W, -H * .05, W, H * .5);
      g.lineTo(W * .9, H * .44); g.quadraticCurveTo(W * .82, H * .24, W * .62, H * .22); g.quadraticCurveTo(cx, H * .26, W * .3, H * .21);
      g.quadraticCurveTo(W * .14, H * .26, W * .1, H * .44); g.closePath();
    }
    g.fill();
    // brillo del pelo
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.beginPath(); g.ellipse(cx * .8, H * .1, W * .25, H * .05, -.2, 0, Math.PI * 2); g.fill();
  }
  // ojos
  const ojoY = H * .52, sep = W * .17;
  for (const s of [-1, 1]) {
    const x = cx + s * sep;
    if (robot) {
      g.fillStyle = '#111b22'; g.beginPath(); g.roundRect(x - W * .1, ojoY - H * .05, W * .2, H * .1, 8); g.fill();
      g.fillStyle = L.ojos || '#38d9e6'; g.shadowColor = L.ojos || '#38d9e6'; g.shadowBlur = 12;
      g.beginPath(); g.ellipse(x, ojoY, W * .055, H * .03, 0, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      continue;
    }
    g.fillStyle = '#f7f2ea';
    g.beginPath(); g.ellipse(x, ojoY, W * .075, H * .036, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = L.ojos || '#5a3a22';
    g.beginPath(); g.arc(x + s * -2, ojoY + 1, W * .036, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#120c08'; g.beginPath(); g.arc(x + s * -2, ojoY + 1, W * .017, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + s * -2 - 3, ojoY - 3, W * .009, 0, Math.PI * 2); g.fill();
    // párpado de arriba y línea de abajo
    g.strokeStyle = 'rgba(40,20,10,.85)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(x, ojoY + 2, W * .08, H * .042, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.strokeStyle = 'rgba(80,35,20,.25)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, ojoY + 1, W * .07, H * .04, 0, Math.PI * .15, Math.PI * .85); g.stroke();
    // cejas
    g.strokeStyle = estilo === 'calvo' ? mezclar(piel, '#3a2416', .7) : mezclar(pelo, '#000000', .25); g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s * W * .085, ojoY - H * .065); g.quadraticCurveTo(x, ojoY - H * .095, x + s * W * .075, ojoY - H * .072); g.stroke();
  }
  if (!robot) {
    // nariz: sombra al costado y fosas
    g.fillStyle = mezclar(piel, '#6b2f1f', .22);
    g.beginPath(); g.moveTo(cx - W * .02, H * .55); g.quadraticCurveTo(cx - W * .07, H * .64, cx - W * .055, H * .67); g.lineTo(cx - W * .02, H * .66); g.closePath(); g.fill();
    g.fillStyle = mezclar(piel, '#5a2416', .35);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * W * .03, H * .675, W * .016, H * .008, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,240,230,.25)'; g.beginPath(); g.ellipse(cx + W * .008, H * .62, W * .018, H * .035, 0, 0, Math.PI * 2); g.fill();
    // boca con sonrisa
    g.fillStyle = mezclar(piel, '#9b3b35', .45);
    g.beginPath(); g.moveTo(cx - W * .1, H * .76); g.quadraticCurveTo(cx, H * .81, cx + W * .1, H * .76); g.quadraticCurveTo(cx, H * .785, cx - W * .1, H * .76); g.fill();
    g.strokeStyle = 'rgba(70,25,20,.8)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - W * .1, H * .757); g.quadraticCurveTo(cx, H * .79, cx + W * .1, H * .757); g.stroke();
    // barba
    if (L.barba) {
      g.fillStyle = L.barba; g.globalAlpha = L.barbaCorta ? .75 : .95;
      g.beginPath(); g.moveTo(W * .08, H * .58); g.quadraticCurveTo(W * .1, H * 1.02, cx, H * 1.0); g.quadraticCurveTo(W * .9, H * 1.02, W * .92, H * .58);
      g.lineTo(W * .82, H * .62); g.quadraticCurveTo(cx + W * .2, H * .86, cx, H * .84); g.quadraticCurveTo(cx - W * .2, H * .86, W * .18, H * .62); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx - W * .12, H * .735); g.quadraticCurveTo(cx, H * .7, cx + W * .12, H * .735); g.quadraticCurveTo(cx, H * .725, cx - W * .12, H * .735); g.fill();
      g.globalAlpha = 1;
    }
  } else {
    // robot: rejilla de la boca
    g.fillStyle = '#26323b';
    for (let i = 0; i < 5; i++) g.fillRect(cx - W * .12 + i * W * .055, H * .74, W * .03, H * .05);
  }
  // antifaz
  if (L.antifaz) {
    g.fillStyle = L.antifaz;
    g.beginPath(); g.roundRect(W * .1, ojoY - H * .07, W * .8, H * .13, 20); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#f7f2ea'; g.beginPath(); g.ellipse(cx + s * sep, ojoY, W * .06, H * .03, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = L.ojos || '#333'; g.beginPath(); g.arc(cx + s * sep, ojoY, W * .03, 0, Math.PI * 2); g.fill(); }
  }
  // anteojos
  if (L.lentes) {
    g.strokeStyle = L.lentes; g.lineWidth = 5;
    for (const s of [-1, 1]) { g.beginPath(); g.roundRect(cx + s * sep - W * .1, ojoY - H * .05, W * .2, H * .1, 8); g.stroke(); }
    g.beginPath(); g.moveTo(cx - W * .07, ojoY - 2); g.lineTo(cx + W * .07, ojoY - 2); g.stroke();
  }
  facetas(g, 0, 0, W, H);

  // ---- espalda: pelo o piel, con los costados del color del borde de la cara
  g.fillStyle = piel; g.fillRect(W, 0, W, H);
  if (estilo !== 'calvo' && !robot) {
    g.fillStyle = pelo;
    const hasta = estilo === 'largo' ? 1 : estilo === 'poco' || estilo === 'entradas' ? .8 : .78;
    g.fillRect(W, estilo === 'poco' || estilo === 'entradas' ? H * .3 : 0, W, H * hasta);
  }
  if (robot) { g.fillStyle = mezclar(piel, '#000000', .12); g.fillRect(W, 0, W, H); }
  facetas(g, W, 0, W, H);
  return cv;
}

// Facetas como las del low-poly de Meshy: triángulos con un poco más o menos de luz.
function facetas(g, x0, y0, W, H) {
  const paso = 26;
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y += paso) for (let x = 0; x < W; x += paso) {
    for (const t of [0, 1]) {
      const k = azar() * .1 - .05;
      g.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${-k})`;
      g.beginPath();
      if (t) { g.moveTo(x0 + x, y0 + y); g.lineTo(x0 + x + paso, y0 + y); g.lineTo(x0 + x, y0 + y + paso); }
      else { g.moveTo(x0 + x + paso, y0 + y); g.lineTo(x0 + x + paso, y0 + y + paso); g.lineTo(x0 + x, y0 + y + paso); }
      g.fill();
    }
  }
}
