// Cara redonda de un personaje sacada de su modelo 3D (no del avatar dibujado): se renderiza la cabeza
// de frente y se recorta en un círculo. La usan el haxball y cualquier juego que muestre "fichas" con cara.
import * as THREE from './vendor/three.module.min.js';
import { crearPersona } from './persona3d.js';

let motor = null;
const cache = new Map();
let cola = Promise.resolve();

function prepararMotor() {
  if (motor) return motor;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(256, 256); renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#ffffff', '#6a6f78', 2.4));
  const luz = new THREE.DirectionalLight('#fff3e2', 2.2); luz.position.set(-1.5, 2, -4); escena.add(luz);
  const camara = new THREE.OrthographicCamera(-.2, .2, .2, -.2, .1, 20);
  motor = { renderer, escena, camara };
  return motor;
}

// Devuelve un canvas de `tam`×`tam` con la cara recortada en círculo (fondo transparente).
export function caraRedonda(look, tam = 128) {
  const clave = JSON.stringify(look) + tam;
  if (!cache.has(clave)) {
    cache.set(clave, (cola = cola.then(async () => {
      const { renderer, escena, camara } = prepararMotor();
      const p = crearPersona(THREE, look, { sombras: false });
      await p.listo;
      p.animar('apose', 0); p.animar('quieto', 0);
      escena.add(p.grupo); p.grupo.updateMatrixWorld(true);
      // centro y tamaño de la cabeza: en los modelos, el hueso está en la base del cráneo
      const caja = new THREE.Box3().setFromObject(p.cabeza);
      let c, r;
      if (caja.isEmpty()) {
        c = p.cabeza.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .13, 0)); r = .2;
      } else {
        c = caja.getCenter(new THREE.Vector3()); r = Math.max(.17, caja.getSize(new THREE.Vector3()).y * .56);
      }
      camara.left = camara.bottom = -r; camara.right = camara.top = r; camara.updateProjectionMatrix();
      camara.position.set(c.x, c.y, c.z - 5); camara.lookAt(c.x, c.y, c.z);
      renderer.render(escena, camara);
      const out = document.createElement('canvas'); out.width = out.height = tam;
      const g = out.getContext('2d');
      g.beginPath(); g.arc(tam / 2, tam / 2, tam / 2, 0, Math.PI * 2); g.closePath();
      g.fillStyle = '#d9d6cc'; g.fill(); g.save(); g.clip();
      g.drawImage(renderer.domElement, 0, 0, tam, tam); g.restore();
      escena.remove(p.grupo); p.dispose();
      return out;
    })));
  }
  return cache.get(clave);
}
