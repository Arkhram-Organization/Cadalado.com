// Genera el poster de Make it Meme (portal/public/img/memes-poster.webp y -chico) con los modelos actuales.
// Necesita el servidor de desarrollo en :8787. Uso: node scripts/poster-memes.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '../portal/public/img');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8787/404.html');
  await p.addScriptTag({ type: 'module', content: `
    import * as THREE from '/comun/vendor/three.module.min.js';
    import { crearPersona } from '/comun/persona3d.js';
    import { POR_ID } from '/comun/npcs.js';
    const W = 1280, H = 720;
    const c3 = document.createElement('canvas'); c3.width = W; c3.height = H;
    const r = new THREE.WebGLRenderer({ canvas: c3, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setClearColor(0, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
    const esc = new THREE.Scene(); esc.add(new THREE.HemisphereLight('#fff0fa', '#5a3a70', 2.2));
    const l = new THREE.DirectionalLight('#fff', 3); l.position.set(-2, 3, -4); esc.add(l);
    const l2 = new THREE.DirectionalLight('#ff9be0', 2.4); l2.position.set(3, 2, 3); esc.add(l2);
    const cam = new THREE.PerspectiveCamera(28, W / H, .1, 50); cam.position.set(0, 1.25, -6.2); cam.lookAt(0, 1.0, 0);
    window.poster = async () => {
      const elenco = [['angie', -2.0, 'g-festeja', 1.0, .35], ['elidiprimio', -.68, 'g-baila', 1.2, .15], ['volcho', .68, 'g-baila', .8, -.15], ['maica', 2.0, 'g-saluda', .9, -.35]];
      for (const [id, x, pose, t, rot] of elenco) {
        const per = crearPersona(THREE, { ...POR_ID[id].look, travesuras: {}, alBailar: null }, { sombras: false }); await per.listo;
        per.grupo.position.x = -x; per.grupo.rotation.y = rot; esc.add(per.grupo);
        for (let s = 0; s < t; s += 1 / 30) per.animar(pose, 1 / 30);
        const fuera = []; per.grupo.traverse((o) => { if (o.isSprite) fuera.push(o); }); fuera.forEach((o) => o.removeFromParent());
      }
      r.render(esc, cam);
      const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ff3fb4'); gr.addColorStop(.5, '#b23be0'); gr.addColorStop(1, '#4a1fa8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // rayos y tarjetas de memes de fondo
      g.save(); g.translate(W / 2, H * .55); g.fillStyle = '#fff'; g.globalAlpha = .07; for (let i = 0; i < 18; i++) { g.rotate(Math.PI * 2 / 18); g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -90); g.lineTo(1400, 90); g.fill(); } g.restore();
      const tarjeta = (x, y, w, h, rot, arriba, abajo, color) => { g.save(); g.translate(x, y); g.rotate(rot); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24; g.fillStyle = '#fff'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
        g.fillStyle = color; g.fillRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
        g.font = '900 30px Impact, sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = '#000'; g.fillStyle = '#fff';
        g.strokeText(arriba, 0, -h / 2 + 52); g.fillText(arriba, 0, -h / 2 + 52); g.strokeText(abajo, 0, h / 2 - 26); g.fillText(abajo, 0, h / 2 - 26); g.restore(); };
      tarjeta(190, 170, 300, 240, -.12, 'CUANDO DECÍS', '"UNA MÁS Y ME VOY"', '#ffb84a');
      tarjeta(1080, 160, 300, 240, .1, 'YO: VOY A ESTUDIAR', 'TAMBIÉN YO:', '#4ad0ff');
      tarjeta(640, 120, 280, 210, .03, 'NADIE:', 'EL VOLCHO:', '#c5f04a');
      const v = g.createLinearGradient(0, H * .55, 0, H); v.addColorStop(0, 'rgba(40,10,70,0)'); v.addColorStop(1, 'rgba(40,10,70,.75)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
      g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 26; g.shadowOffsetY = 10; g.drawImage(c3, 0, 0); g.shadowColor = 'transparent';
      const chico = document.createElement('canvas'); chico.width = 640; chico.height = 360; chico.getContext('2d').drawImage(out, 0, 0, 640, 360);
      return [out.toDataURL('image/webp', .88), chico.toDataURL('image/webp', .85)];
    };
    window.listo = true;` });
  await p.waitForFunction(() => window.listo);
  const [grande, chico] = await p.evaluate(() => window.poster());
  fs.writeFileSync(path.join(OUT, 'memes-poster.webp'), Buffer.from(grande.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'memes-poster-chico.webp'), Buffer.from(chico.split(',')[1], 'base64'));
  console.log('ok');
  await b.close();
})();
