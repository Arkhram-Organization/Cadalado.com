// Genera las portadas de la tienda: cada personaje en su pose, con un fondo distinto y su nombre gigante atrás.
// Necesita el servidor de desarrollo en :8787. Uso: node scripts/portadas-tienda.cjs portal/public/img/tienda
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2];
const P = [
  // id, nombre arriba (chico), nombre grande (contorno), pose, tiempo de animación, giro, estilo de fondo, colores
  ['mati', 'Mati', 'NADEO', 'g-festeja', 1.0, -0.2, 'oro', ['#4a0a3a', '#d4207a', '#ffd23f']],
  ['dobro', 'El casino de', 'DOBRO', 'quieto', 1, 0.15, 'casino', ['#2a0508', '#8a0f1a', '#ffd23f']],
  ['angeles', 'Ángeles', 'PEÑA', 'g-baila', 1.3, 0.3, 'rayos', ['#2a0f5a', '#a43cff', '#ff7ad1']],
  ['franba', 'El hijo del', 'CIBER', 'g-habla', 0.9, -0.15, 'ciber', ['#04140a', '#0b3a1e', '#39ff88']],
  ['julo', 'Julo', 'DEPLOY', 'g-musculos', 1.1, 0.25, 'codigo', ['#03101f', '#0b3a6b', '#4fd1ff']],
  ['glinsky', 'Profe', 'GLINSKY', 'g-habla', 1.2, -0.25, 'exponencial', ['#061a2e', '#14507a', '#7cf0ff']],
  ['faur', 'Una más y me', 'QUEDO', 'g-baila', 1.6, 0.2, 'confeti', ['#1a2a06', '#3f7a14', '#c5f04a']],
  ['volcho', '¿Quién? El', 'VOLCHO', 'g-baila', 0.8, -0.3, 'espiral', ['#3a0a5a', '#c058ff', '#ffe08a']],
  ['olcho', 'La', 'RATA', 'g-musculos', 1.2, 0.2, 'comic', ['#5a1a00', '#ff7a1a', '#ffd23f']],
  ['sandra', 'Caso', 'BERNSTEIN', 'g-habla', 1.0, 0.15, 'estrellas', ['#06143a', '#1f4fb5', '#eaf2ff']],
  ['angie', 'Nacho y', 'ANGIE', 'g-saluda', 0.9, -0.2, 'corazones', ['#5a0a3a', '#ff5fa8', '#ffe0f0']],
  ['capitan', 'Capitán', 'MATE', 'g-festeja', 0.9, 0.2, 'rayos', ['#0a3a1a', '#2fa85a', '#e8ff9a']],
  ['chapa', 'Chapa', 'MAX', 'g-saluda', 0.7, -0.2, 'codigo', ['#1a1a24', '#5a6a7a', '#c9d6e3']],
  ['colon', '¡Tierra a la', 'VISTA!', 'g-saluda', 1.0, 0.25, 'mar', ['#04283a', '#1a7ab5', '#ffe9b0']],
  ['claude', 'Hecho por', 'CLAUDE', 'g-habla', 1.0, -0.2, 'rayos', ['#3a1a08', '#d97b4a', '#ffd9b0']],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
    window.portada = async (id, chico, grande, pose, t, rot, estilo, colores) => {
      const look = { ...POR_ID[id].look };
      const pr = crearPersona(THREE, look, { sombras: false }); await pr.listo;
      esc.add(pr.grupo); pr.grupo.rotation.y = rot;
      const pasos = Math.round(t * 30); for (let i = 0; i < pasos; i++) pr.animar(pose, 1 / 30);
      pr.grupo.traverse((o) => { if (o.isMesh && o.geometry?.type === 'CircleGeometry') o.visible = false; });
      const caja = new THREE.Box3().setFromObject(pr.grupo); const cc = caja.getCenter(new THREE.Vector3()); const sz = caja.getSize(new THREE.Vector3());
      const cam = new THREE.PerspectiveCamera(24, 720 / 960, .1, 50); const d = Math.max(sz.y, sz.x * 960 / 720) * 1.0 / 2 / Math.tan(12 * Math.PI / 180);
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
  for (const a of P) {
    const url = await p.evaluate((a) => window.portada(...a), a);
    fs.writeFileSync(`${OUT}/${a[0]}.webp`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', a[0]);
  }
  await b.close();
})();
