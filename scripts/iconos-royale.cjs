// Renderiza las fotos de las curaciones de Battle Shmitz (games/royale/public/img/objetos/<tipo>.webp)
// con los mismos modelos 3D que aparecen en la isla. Necesita el servidor de desarrollo en :8787.
// Uso: node scripts/iconos-royale.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '../games/royale/public/img/objetos');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8787/404.html');
  await p.addScriptTag({ type: 'module', content: `
    import * as THREE from '/comun/vendor/three.module.min.js';
    import { modeloConsumible } from '/royale/js/modelos.js';
    const W = 384, H = 216;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.setClearColor(0, 0);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    const esc = new THREE.Scene(); esc.add(new THREE.HemisphereLight('#ffffff', '#5a6470', 2.2));
    const l = new THREE.DirectionalLight('#fff6ea', 2.4); l.position.set(-3, 6, 5); esc.add(l);
    const l2 = new THREE.DirectionalLight('#cfe0ff', 1.2); l2.position.set(4, 2, -3); esc.add(l2);
    const cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 200);
    window.foto = (tipo) => {
      const g = modeloConsumible(tipo); esc.add(g);
      g.rotation.set(0.12, -0.55, 0);
      const caja = new THREE.Box3().setFromObject(g), c = caja.getCenter(new THREE.Vector3()), t = caja.getSize(new THREE.Vector3());
      const d = (Math.max(t.y, t.x / (W / H), t.z) * 1.02) / 2 / Math.tan((12 * Math.PI) / 180);
      cam.position.set(c.x + d * 0.35, c.y + d * 0.28, c.z + d); cam.lookAt(c);
      r.render(esc, cam); esc.remove(g);
      return r.domElement.toDataURL('image/webp', 0.9);
    };
    window.listo = true;` });
  await p.waitForFunction(() => window.listo);
  for (const tipo of ['venda', 'botiquin', 'mini', 'escudo', 'granada']) {
    const url = await p.evaluate((t) => window.foto(t), tipo);
    fs.writeFileSync(path.join(OUT, tipo + '.webp'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', tipo);
  }
  await b.close();
})();
