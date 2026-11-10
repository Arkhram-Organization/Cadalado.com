// Genera recortes 3D de cintura para arriba para el casillero de /personaje.
// Uso: CHROMIUM_PATH=/usr/bin/chromium node scripts/personajes-casillero.cjs [id,id]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const filtro = process.argv[2]?.split(',').filter(Boolean) || null;
const out = path.join(__dirname, '..', 'portal', 'public', 'img', 'personajes');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('browser:', e.message));
  await page.goto('http://localhost:8787/404.html');
  const ids = await page.evaluate(async (solo) => {
    const { NPCS } = await import('/comun/npcs.js');
    return (solo || NPCS.map((n) => n.id)).filter((id) => NPCS.some((n) => n.id === id));
  }, filtro);

  for (const id of ids) {
    const data = await page.evaluate(async (npcId) => {
      const THREE = await import('/comun/vendor/three.module.min.js');
      const { crearPersona } = await import('/comun/persona3d.js');
      const { POR_ID } = await import('/comun/npcs.js');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(512, 512, false); renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#fff7e9', '#4b5565', 2.5));
      const key = new THREE.DirectionalLight('#fff3e2', 3); key.position.set(-2, 3, 4); scene.add(key);
      const rim = new THREE.DirectionalLight('#ffffff', 2); rim.position.set(3, 2, -3); scene.add(rim);
      const p = crearPersona(THREE, { ...POR_ID[npcId].look, travesuras: {} }, { sombras: false, animacionesSincronizadas: true });
      await p.listo;
      p.grupo.rotation.y = Math.PI;
      p.animar('quieto', 0); p.animar('quieto', 1 / 60);
      scene.add(p.grupo); p.grupo.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(p.grupo), size = box.getSize(new THREE.Vector3());
      const y = box.min.y + size.y * .67;
      const visible = size.y * .71;
      const camera = new THREE.PerspectiveCamera(27, 1, .1, 50);
      camera.position.set(0, y, visible / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
      camera.lookAt(0, y, 0);
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/webp', .9);
      p.dispose(); renderer.dispose();
      return url;
    }, id);
    fs.writeFileSync(path.join(out, `${id}.webp`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('ok', id);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
