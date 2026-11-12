// Genera las portadas de la tienda: cada personaje en su pose, con un fondo distinto (del color de su rareza;
// las míticas tienen el suyo) y su nombre gigante atrás.
// Necesita el servidor de desarrollo en :8787. Uso: node scripts/portadas-tienda.cjs portal/public/img/tienda [id,id]
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2];
const P = [
  ['trosman', 'Theotrosman', 'TROSMAN', 'g-baila', 1.1, .15, 'confeti', ['#1d0636','#8a3cf0','#e3c2ff']],
  ['batata', 'Católico y Gasolero', 'BATATA', 'g-festeja', 1.3, -.2, 'oro', ['#31102c','#90402d','#ffd166']],
  // id, nombre arriba (chico), nombre grande (contorno), pose, tiempo de animación, giro, estilo de fondo, colores
  ['mati', 'Mati', 'NADEO', 'g-festeja', 1.0, -0.2, 'oro', ['#4a0a3a', '#d4207a', '#ffd23f']],
  ['dobro', 'El casino de', 'DOBRO', 'quieto', 1, 0.15, 'casino', ['#2a0508', '#8a0f1a', '#ffd23f']],
  ['angeles', 'Ángeles', 'PEÑA', 'g-baila', 1.3, 0.3, 'rayos', ['#3a1a02', '#e08a10', '#ffe08a']],
  ['franba', 'El hijo del', 'CIBER', 'g-habla', 0.9, -0.15, 'ciber', ['#3a1a02', '#e08a10', '#ffe08a']],
  ['elidiprimio', 'Elidiprimio', 'WOOOP', 'g-baila', 1.1, 0.25, 'confeti', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['ferchus', 'El del kiosco', 'FERCHUS', 'g-tiktok', 1.4, 0.35, 'kiosco', ['#3a1a02', '#e08a10', '#ffe08a']],
  ['vicky', 'La jefa del comedor', 'VICKY', 'g-tiktok', 1.2, -0.3, 'kiosco', ['#3a1a02', '#e08a10', '#ffe08a'], 1.1],
  ['dorin', 'La Academia', 'DORIN', 'g-festeja', 0.9, -0.2, 'racing', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['teo', 'Am Israel Jai', 'TEO', 'g-festeja', 1.1, 0.2, 'israel', ['#0b2e7a', '#3c7be0', '#ffffff']],
  ['marti', 'La profe', 'MARTI', 'g-habla', 1.2, -0.25, 'estrellas', ['#3a1a02', '#e08a10', '#ffe08a']],
  ['maica', 'Mejor amiga de Mica', 'MAICA', 'g-baila', 1.4, 0.25, 'corazones', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['julo', 'Julo', 'DEPLOY', 'g-musculos', 1.1, 0.25, 'codigo', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['glinsky', 'Profe', 'GLINSKY', 'g-habla', 1.2, -0.25, 'exponencial', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['faur', 'Una más y me', 'QUEDO', 'g-baila', 1.6, 0.2, 'confeti', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['volcho', '¿Quién? El', 'VOLCHO', 'g-baila', 0.8, -0.3, 'espiral', ['#1d0636', '#8a3cf0', '#e3c2ff']],
  ['olcho', 'La', 'RATA', 'g-musculos', 1.2, 0.2, 'comic', ['#051634', '#1f5fd0', '#9cc8ff']],
  ['sandra', 'Caso', 'BERNSTEIN', 'g-habla', 1.0, 0.15, 'estrellas', ['#051634', '#1f5fd0', '#9cc8ff']],
  ['angie', 'Nacho y', 'ANGIE', 'g-saluda', 0.9, -0.2, 'corazones', ['#051634', '#1f5fd0', '#9cc8ff']],
  ['capitan', 'Capitán', 'MATE', 'g-festeja', 0.9, 0.2, 'rayos', ['#16191e', '#56616d', '#e2e8ee']],
  ['chapa', 'Chapa', 'MAX', 'g-saluda', 0.7, -0.2, 'codigo', ['#16191e', '#56616d', '#e2e8ee']],
  ['colon', '¡Tierra a la', 'VISTA!', 'g-saluda', 1.0, 0.25, 'mar', ['#16191e', '#56616d', '#e2e8ee']],
  ['claude', 'Hecho por', 'CLAUDE', 'g-habla', 1.0, -0.2, 'rayos', ['#16191e', '#56616d', '#e2e8ee']],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8787/404.html');
  // Barlow Condensed 900 (bajala de Google Fonts y dejala al lado de este script)
  const fuente = fs.existsSync(__dirname + '/barlow900.woff2') ? [...fs.readFileSync(__dirname + '/barlow900.woff2')] : null;
  if (fuente) await p.evaluate(async (bytes) => { const f = new FontFace('Barlow Condensed', new Uint8Array(bytes).buffer, { weight: '900' }); await f.load(); document.fonts.add(f); }, fuente);
  await p.addScriptTag({ type: 'module', content: `
    import * as THREE from '/comun/vendor/three.module.min.js';
    import { crearPersona } from '/comun/persona3d.js';
    import { POR_ID } from '/comun/npcs.js';
    const W = 600, H = 800;
    const c3 = document.createElement('canvas'); c3.width = 720; c3.height = 960;
    const r = new THREE.WebGLRenderer({ canvas: c3, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setClearColor(0, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
    const esc = new THREE.Scene();
    esc.add(new THREE.HemisphereLight('#fff6e8', '#4a5560', 2.1));
    const key = new THREE.DirectionalLight('#fff0d8', 3.2); key.position.set(-2, 3, -4); esc.add(key);
    const rim = new THREE.DirectionalLight('#ffffff', 3.5); rim.position.set(3, 2.5, 3); esc.add(rim);
    const rim2 = new THREE.DirectionalLight('#ffffff', 2); rim2.position.set(-3, 2, 3); esc.add(rim2);
    const azar = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
    function fondo(g, estilo, [a, b, c], rr) {
      const gr = g.createRadialGradient(W * .55, H * .45, 40, W * .5, H * .5, H * .8); gr.addColorStop(0, b); gr.addColorStop(1, a);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const cx = W * .58, cy = H * .42;
      const rayos = (n, alfa, color = '#ffffff') => { g.save(); g.translate(cx, cy); g.fillStyle = color; g.globalAlpha = alfa; for (let i = 0; i < n; i++) { g.rotate(Math.PI * 2 / n); g.beginPath(); g.moveTo(0, 0); g.lineTo(H * 1.2, -H * .09); g.lineTo(H * 1.2, H * .09); g.fill(); } g.restore(); };
      if (estilo === 'rayos' || estilo === 'oro') rayos(18, estilo === 'oro' ? .18 : .12, estilo === 'oro' ? c : '#ffffff');
      if (estilo === 'oro') { for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,215,90,' + (.3 + rr() * .6) + ')'; const x = rr() * W, y = rr() * H, s = 2 + rr() * 5; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.fill(); } }
      if (estilo === 'espiral') { g.save(); g.translate(cx, cy); for (let i = 0; i < 26; i++) { g.rotate(.24); g.fillStyle = i % 2 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'; g.fillRect(0, -10, H, 20 + i * 2); } g.restore(); }
      if (estilo === 'casino') { g.fillStyle = 'rgba(255,215,90,.08)'; for (let y = 0; y < H; y += 26) for (let x = (y / 26) % 2 * 13; x < W; x += 26) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.fill(); }
        const sp = g.createRadialGradient(cx, 0, 10, cx, H * .4, H * .6); sp.addColorStop(0, 'rgba(255,240,200,.55)'); sp.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = sp; g.beginPath(); g.moveTo(cx - 60, 0); g.lineTo(cx + 60, 0); g.lineTo(cx + 260, H); g.lineTo(cx - 260, H); g.fill();
        const cartas = ['A♠', 'K♥', '7♦', 'Q♣']; for (let i = 0; i < 7; i++) { g.save(); g.translate(rr() * W, rr() * H * .9); g.rotate(rr() * 1.4 - .7); g.fillStyle = '#f4f1ea'; g.globalAlpha = .55; g.fillRect(-26, -36, 52, 72); g.fillStyle = i % 2 ? '#c8102e' : '#141414'; g.font = '900 26px serif'; g.textAlign = 'center'; g.fillText(cartas[i % 4], 0, 8); g.restore(); }
        for (let i = 0; i < 9; i++) { g.save(); g.globalAlpha = .7; g.fillStyle = ['#c8102e', '#ffd23f', '#1f4fb5'][i % 3]; g.beginPath(); g.ellipse(rr() * W, rr() * H, 18, 8, rr() * 3, 0, 7); g.fill(); g.restore(); } }
      if (estilo === 'ciber') { g.fillStyle = 'rgba(57,255,136,.06)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
        g.font = '700 15px monospace'; for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(57,255,136,' + (.1 + rr() * .35) + ')'; g.fillText(['CS 1.6', 'GG', '$0.50/30min', 'DE_DUST2', 'LAN', 'FPS 99', 'RUSH B', 'ctrl+alt+supr'][Math.floor(rr() * 8)], rr() * W, rr() * H); }
        g.strokeStyle = 'rgba(57,255,136,.35)'; g.lineWidth = 3; g.strokeRect(20, 20, W - 40, H - 40); }
      if (estilo === 'codigo') { g.font = '700 14px monospace'; for (let x = 0; x < W; x += 18) { const n = 6 + Math.floor(rr() * 30); for (let k = 0; k < n; k++) { g.fillStyle = 'rgba(120,220,255,' + (k / n * .5) + ')'; g.fillText(rr() < .5 ? '1' : '0', x, rr() * H); } } }
      if (estilo === 'exponencial') { g.strokeStyle = 'rgba(124,240,255,.13)'; g.lineWidth = 1; for (let x = 0; x < W; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        g.strokeStyle = c; g.lineWidth = 6; g.shadowColor = c; g.shadowBlur = 18; g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * .92 - Math.exp(x / W * 4.2) * 10; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.shadowBlur = 0; }
      if (estilo === 'confeti') { rayos(14, .08); for (let i = 0; i < 90; i++) { g.save(); g.translate(rr() * W, rr() * H); g.rotate(rr() * 6); g.fillStyle = ['#c5f04a', '#ffd23f', '#ff5fa8', '#4fd1ff', '#ffffff'][i % 5]; g.fillRect(-5, -2, 10, 4); g.restore(); } }
      if (estilo === 'comic') { g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 14) for (let x = (y / 14) % 2 * 7; x < W; x += 14) { const d = Math.hypot(x - cx, y - cy) / H; g.beginPath(); g.arc(x, y, 1 + d * 5, 0, 7); g.fill(); }
        g.save(); g.translate(cx, cy); g.fillStyle = c; g.globalAlpha = .9; g.beginPath(); for (let i = 0; i < 28; i++) { const ang = i / 28 * Math.PI * 2, rad = i % 2 ? 190 : 260; g.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); } g.fill(); g.restore(); }
      if (estilo === 'estrellas') { rayos(12, .09); for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(234,242,255,' + (.25 + rr() * .6) + ')'; const x = rr() * W, y = rr() * H, s = 1 + rr() * 3; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); } }
      if (estilo === 'corazones') { rayos(16, .1); g.fillStyle = 'rgba(255,224,240,.35)'; for (let i = 0; i < 26; i++) { const x = rr() * W, y = rr() * H, s = 8 + rr() * 16; g.beginPath(); g.moveTo(x, y + s * .9); g.bezierCurveTo(x - s * 1.6, y - s * .3, x - s * .6, y - s * 1.3, x, y - s * .3); g.bezierCurveTo(x + s * .6, y - s * 1.3, x + s * 1.6, y - s * .3, x, y + s * .9); g.fill(); } }
      if (estilo === 'mar') { for (let k = 0; k < 9; k++) { g.strokeStyle = 'rgba(255,255,255,' + (.06 + k * .01) + ')'; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= W; x += 10) { const y = H * .45 + k * 45 + Math.sin(x / 40 + k) * 10; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } }
      if (estilo === 'kiosco') {
        rayos(16, .1, '#fff3c4');
        // medialunas, tazas de café y corazoncitos de TikTok flotando
        const medialuna = (x, y, esc, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(esc, esc);
          const gr2 = g.createLinearGradient(-40, -20, 40, 20); gr2.addColorStop(0, '#ffd27a'); gr2.addColorStop(1, '#c97a22');
          g.fillStyle = gr2; g.beginPath(); g.moveTo(-46, 8); g.quadraticCurveTo(0, -46, 46, 8); g.quadraticCurveTo(30, 0, 22, 16); g.quadraticCurveTo(0, -12, -22, 16); g.quadraticCurveTo(-30, 0, -46, 8); g.fill();
          g.strokeStyle = 'rgba(120,60,10,.5)'; g.lineWidth = 3; for (const k of [-16, 0, 16]) { g.beginPath(); g.moveTo(k - 6, -14 + Math.abs(k) * .45); g.lineTo(k + 6, -2 + Math.abs(k) * .45); g.stroke(); } g.restore(); };
        const taza = (x, y, esc) => { g.save(); g.translate(x, y); g.scale(esc, esc); g.globalAlpha = .9;
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-24, -20); g.lineTo(24, -20); g.lineTo(18, 22); g.lineTo(-18, 22); g.closePath(); g.fill();
          g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(28, 0, 10, -1.3, 1.3); g.stroke();
          g.fillStyle = '#6b3d1e'; g.fillRect(-21, -20, 42, 6);
          g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; for (const k of [-8, 6]) { g.beginPath(); g.moveTo(k, -28); g.bezierCurveTo(k - 8, -40, k + 8, -48, k, -60); g.stroke(); } g.restore(); };
        medialuna(80, 110, 1.3, -.3); medialuna(W - 90, 150, 1.1, .4); medialuna(70, H * .7, 1.2, .2); medialuna(W - 80, H * .78, 1.4, -.25); medialuna(W * .5, 60, .8, .1);
        taza(W - 120, H * .45, 1.2); taza(110, H * .45, .9);
        // el celular grabando (REC)
        g.save(); g.translate(W - 150, H * .2); g.rotate(.18); g.fillStyle = '#16161a'; g.beginPath(); g.roundRect(-34, -62, 68, 124, 12); g.fill(); g.fillStyle = '#ff3b8b'; g.beginPath(); g.roundRect(-28, -54, 56, 108, 8); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-12, -40, 5, 0, 7); g.fill(); g.font = '900 13px sans-serif'; g.fillText('REC', -4, -35); g.restore();
        for (let i = 0; i < 18; i++) { const x = rr() * W, y = rr() * H, s2 = 5 + rr() * 9; g.fillStyle = ['rgba(255,59,139,.5)', 'rgba(56,217,230,.5)', 'rgba(255,255,255,.4)'][i % 3]; g.beginPath(); g.moveTo(x, y + s2 * .9); g.bezierCurveTo(x - s2 * 1.6, y - s2 * .3, x - s2 * .4, y - s2 * 1.3, x, y - s2 * .3); g.bezierCurveTo(x + s2 * .4, y - s2 * 1.3, x + s2 * 1.6, y - s2 * .3, x, y + s2 * .9); g.fill(); }
      }
      if (estilo === 'racing') {
        // rayas celestes y blancas de la Academia, con luces de estadio
        g.save(); g.globalAlpha = .34; for (let x = -40, k = 0; x < W + 40; x += 64, k++) { g.fillStyle = k % 2 ? '#ffffff' : '#7cc6ee'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 64, 0); g.lineTo(x + 34, H); g.lineTo(x - 30, H); g.fill(); } g.restore();
        rayos(14, .08, '#ffffff');
        for (const [x, y] of [[40, 40], [W - 40, 40]]) { const lz = g.createRadialGradient(x, y, 0, x, y, 260); lz.addColorStop(0, 'rgba(255,255,255,.55)'); lz.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lz; g.fillRect(0, 0, W, H);
          g.fillStyle = '#2a2f3a'; g.fillRect(x - 30, y - 18, 60, 30); g.fillStyle = '#fffbe6'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x - 22 + (k % 3) * 22, y - 8 + Math.floor(k / 3) * 14, 5, 0, 7); g.fill(); } }
        // papelitos celestes y blancos
        for (let i = 0; i < 80; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.75)' : 'rgba(124,198,238,.85)'; g.save(); g.translate(rr() * W, rr() * H); g.rotate(rr() * 6); g.fillRect(-5, -3, 10, 6); g.restore(); }
        // pelota
        g.save(); g.translate(W - 110, H * .82); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill(); g.fillStyle = '#1e1e22';
        for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; g.beginPath(); g.arc(Math.cos(a) * 22, Math.sin(a) * 22, 8, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); g.restore();
      }
      if (estilo === 'israel') {
        rayos(16, .1, '#ffffff');
        const estrella = (x, y, rad, color, ancho) => { g.save(); g.strokeStyle = color; g.lineWidth = ancho; for (const off of [0, Math.PI]) { g.beginPath(); for (let k = 0; k < 3; k++) { const a = off - Math.PI / 2 + k * Math.PI * 2 / 3; k ? g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.stroke(); } g.restore(); };
        // banderas de Israel flameando
        const bandera = (x, y, w, rot) => { const h = w * .72; g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = .9;
          g.fillStyle = '#5a4630'; g.fillRect(-6, -10, 5, h * 2.2);
          g.beginPath(); for (let i = 0; i <= 20; i++) { const xx = i / 20 * w; g.lineTo(xx, Math.sin(i / 3) * 6); } for (let i = 20; i >= 0; i--) { const xx = i / 20 * w; g.lineTo(xx, h + Math.sin(i / 3) * 6); } g.closePath(); g.fillStyle = '#ffffff'; g.fill();
          g.fillStyle = '#0038b8'; for (const yy of [h * .1, h * .78]) { g.beginPath(); for (let i = 0; i <= 20; i++) g.lineTo(i / 20 * w, yy + Math.sin(i / 3) * 6); for (let i = 20; i >= 0; i--) g.lineTo(i / 20 * w, yy + h * .12 + Math.sin(i / 3) * 6); g.closePath(); g.fill(); }
          estrella(w / 2, h / 2 + Math.sin(10 / 3) * 6, h * .2, '#0038b8', w * .03); g.restore(); };
        bandera(22, 40, 150, -.12); bandera(W - 170, 70, 140, .1); bandera(30, H * .62, 120, -.05);
        // shofares
        const shofar = (x, y, esc, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(esc, esc);
          const gr2 = g.createLinearGradient(0, 0, 160, 0); gr2.addColorStop(0, '#f3e2b8'); gr2.addColorStop(.6, '#c79a5b'); gr2.addColorStop(1, '#6e4a26');
          g.fillStyle = gr2; g.beginPath(); g.moveTo(0, -4); g.bezierCurveTo(60, -10, 110, -40, 150, -95); g.lineTo(172, -80); g.bezierCurveTo(130, -20, 70, 14, 0, 6); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(80,50,20,.35)'; g.lineWidth = 2; for (let k = 1; k < 7; k++) { const t = k / 7; g.beginPath(); g.moveTo(t * 150 - 2, -t * t * 95 - 6); g.lineTo(t * 150 + 8, -t * t * 95 + 12); g.stroke(); }
          g.fillStyle = '#4a2f16'; g.beginPath(); g.ellipse(161, -88, 13, 9, -.6, 0, 7); g.fill(); g.restore(); };
        shofar(W - 210, H * .7, 1.1, -.15); shofar(70, H * .38, .8, .35); shofar(W - 120, H * .33, .7, -.6);
        // la Torá abierta
        g.save(); g.translate(W * .5, H * .86); g.globalAlpha = .95;
        g.fillStyle = '#f4e7c4'; g.fillRect(-120, -60, 240, 110);
        g.fillStyle = 'rgba(60,40,20,.55)'; for (let fila = 0; fila < 7; fila++) for (let col = 0; col < 2; col++) { const x0 = col ? 10 : -110; g.fillRect(x0, -48 + fila * 14, 90 - (fila * 7) % 25, 3); }
        for (const xx of [-128, 128]) { g.fillStyle = '#7a4a22'; g.fillRect(xx - 9, -78, 18, 146); g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(xx, -82, 11, 0, 7); g.fill(); g.beginPath(); g.arc(xx, 72, 11, 0, 7); g.fill(); }
        g.restore();
        // estrellas de David chiquitas
        for (let i = 0; i < 16; i++) estrella(rr() * W, rr() * H * .8, 6 + rr() * 10, 'rgba(255,255,255,' + (.25 + rr() * .4) + ')', 2);
      }
      // viñeta
      const v = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    function nombre(g, chico, grande, color) {
      g.save(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      let tam = 210; g.font = '900 ' + tam + 'px "Barlow Condensed", Impact, sans-serif';
      while (g.measureText(grande).width > W - 40 && tam > 80) { tam -= 6; g.font = '900 ' + tam + 'px "Barlow Condensed", Impact, sans-serif'; }
      const y = H * .58;
      g.globalAlpha = .22; g.fillStyle = '#ffffff'; g.fillText(grande, 18, y - tam * .78);
      g.globalAlpha = 1; g.lineWidth = 5; g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 14; g.strokeText(grande, 18, y);
      g.shadowBlur = 0; g.font = '900 64px "Barlow Condensed", Impact, sans-serif'; g.globalAlpha = .9; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText(chico.toUpperCase(), 24, y - tam * .78 - tam * .62);
      g.restore();
    }
    window.portada = async (id, chico, grande, pose, t, rot, estilo, colores, lejos = 1) => {
      const look = { ...POR_ID[id].look };
      const pr = crearPersona(THREE, look, { sombras: false }); await pr.listo;
      esc.add(pr.grupo); pr.grupo.rotation.y = rot;
      const pasos = Math.round(t * 30); for (let i = 0; i < pasos; i++) pr.animar(pose, 1 / 30);
      const fuera = []; pr.grupo.traverse((o) => { if ((o.isMesh && o.geometry?.type === 'CircleGeometry') || o.isSprite) fuera.push(o); }); fuera.forEach((o) => o.removeFromParent());
      const caja = new THREE.Box3().setFromObject(pr.grupo); const cc = caja.getCenter(new THREE.Vector3()); const sz = caja.getSize(new THREE.Vector3());
      const cam = new THREE.PerspectiveCamera(24, 720 / 960, .1, 50); const d = Math.max(sz.y, sz.x * 960 / 720) * lejos / 2 / Math.tan(12 * Math.PI / 180);
      cam.position.set(cc.x, cc.y + .15, cc.z - d); cam.lookAt(cc.x, cc.y + .05, cc.z);
      r.render(esc, cam); esc.remove(pr.grupo); pr.dispose?.();
      const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
      const rr = azar([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 2147483646 + 1);
      fondo(g, estilo, colores, rr);
      nombre(g, chico, grande, colores[2]);
      // el personaje: grande, abajo a la derecha, con sombra de color
      g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
      g.drawImage(c3, W * .02, H * .02, W * 1.05, H * 1.05); g.restore();
      // brillitos
      for (let i = 0; i < 6; i++) { const x = rr() * W, y = rr() * H * .7, s = 6 + rr() * 9; g.fillStyle = '#fff6c4'; g.beginPath(); g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s * 2); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s * 2); g.fill(); }
      return out.toDataURL('image/webp', .86);
    };
    window.listo = true;` });
  await p.waitForFunction(() => window.listo);
  await p.evaluate(() => document.fonts.ready);
  const solo = process.argv[3]?.split(','); // opcional: solo estos ids
  for (const a of P.filter((x) => !solo || solo.includes(x[0]))) {
    const url = await p.evaluate((a) => window.portada(...a), a);
    fs.writeFileSync(`${OUT}/${a[0]}.webp`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', a[0]);
  }
  await b.close();
})();
