// Objetos 3D de Piña Final, todos armados con geometría (sin archivos): armas, poderes de cada
// elemento y un sistema de partículas para chispas, fuego, humo, sangre y polvo.
import * as THREE from '/comun/vendor/three.module.min.js';
import { ELEMENTOS } from './motor.js';

const metal = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: .85, roughness: .25, ...extra });
const mate = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra });
const brillo = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

// textura redonda difusa (para chispas, fuego y halos)
let texPunto = null;
export function texturaPunto() {
  if (texPunto) return texPunto;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  texPunto = new THREE.CanvasTexture(c);
  return texPunto;
}
export function halo(color, tam = 1, opacity = .8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaPunto(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(tam);
  return s;
}

// ---------------------------------------------------------------- armas
// Se arman con el mango en el origen y la hoja hacia +Y; la escena las acomoda en la mano.
export function crearArma(tipo, elem) {
  const E = ELEMENTOS[elem] || ELEMENTOS.fuego;
  const g = new THREE.Group();
  const filo = new THREE.MeshStandardMaterial({ color: '#dfe6ee', metalness: .95, roughness: .12, emissive: E.color, emissiveIntensity: .55 });
  const mango = mate('#1c1612');
  if (tipo === 'katana') {
    // hoja curva: varios tramos que se van inclinando
    const tramos = 8, largo = .95;
    let y = .12, x = 0;
    for (let i = 0; i < tramos; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(.04 - i * .002, largo / tramos + .01, .02), filo);
      const ang = i * .018;
      t.position.set(x, y + largo / tramos / 2, 0); t.rotation.z = -ang;
      x += Math.sin(ang) * largo / tramos; y += Math.cos(ang) * largo / tramos;
      g.add(t);
    }
    const punta = new THREE.Mesh(new THREE.ConeGeometry(.018, .07, 4), filo); punta.position.set(x + .004, y + .03, 0); punta.rotation.z = -.2; g.add(punta);
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .015, 16), metal('#b8912f')); tsuba.position.y = .11; g.add(tsuba);
    const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(.02, .022, .24, 8), mango); g.add(tsuka);
    for (let i = 0; i < 5; i++) { const v = new THREE.Mesh(new THREE.TorusGeometry(.022, .005, 4, 8), mate('#7a1e1e')); v.rotation.x = Math.PI / 2; v.position.y = -.09 + i * .045; g.add(v); }
    const aura = new THREE.Mesh(new THREE.BoxGeometry(.07, largo, .02), brillo(E.color, .35)); aura.position.set(x / 2, .12 + largo / 2, 0); aura.rotation.z = -.07; g.add(aura);
  } else if (tipo === 'hacha') {
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .85, 8), mate('#5a3a22')); palo.position.y = .3; g.add(palo);
    const forma = new THREE.Shape();
    forma.moveTo(0, -.09); forma.quadraticCurveTo(.16, -.2, .26, -.16); forma.quadraticCurveTo(.21, 0, .26, .16); forma.quadraticCurveTo(.16, .2, 0, .09); forma.lineTo(0, -.09);
    const cabeza = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: .025, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1 }), filo);
    cabeza.position.set(.01, .62, -.0125); g.add(cabeza);
    const atras = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 4), metal('#666')); atras.rotation.z = Math.PI / 2; atras.position.set(-.06, .62, 0); g.add(atras);
    const aura = halo(E.color, .55, .55); aura.position.set(.17, .62, 0); g.add(aura);
  } else if (tipo === 'martillo') {
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(.024, .028, .8, 8), mate('#3b2a1e')); palo.position.y = .28; g.add(palo);
    const cabeza = new THREE.Mesh(new THREE.BoxGeometry(.34, .17, .17), new THREE.MeshStandardMaterial({ color: '#5b6068', metalness: .8, roughness: .35, emissive: E.color, emissiveIntensity: .25 }));
    cabeza.position.y = .7; g.add(cabeza);
    for (const s of [-1, 1]) { const tapa = new THREE.Mesh(new THREE.BoxGeometry(.03, .2, .2), metal('#2a2d33')); tapa.position.set(s * .17, .7, 0); g.add(tapa); }
    const aura = halo(E.color, .7, .5); aura.position.y = .7; g.add(aura);
  } else {
    // nunchaku: un palo en la mano, la cadena y el otro colgando (se balancea al pegar)
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .3, 10), mate('#1d1d1f')); palo.position.y = .08; g.add(palo);
    const banda = mate('#c9a227');
    for (const y of [-.05, .2]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.024, .024, .02, 10), banda); b.position.y = y; g.add(b); }
    const cadena = new THREE.Group(); cadena.position.y = .23; g.add(cadena);
    for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.TorusGeometry(.012, .004, 4, 8), metal('#aab')); e.position.y = i * .022; e.rotation.y = i % 2 ? Math.PI / 2 : 0; cadena.add(e); }
    const otro = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .3, 10), mate('#1d1d1f')); otro.position.y = .24; cadena.add(otro);
    const aura = halo(E.color, .45, .5); aura.position.y = .24; cadena.add(aura);
    g.userData.cadena = cadena;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- poderes
// Devuelve { grupo, actualizar(dt, p) }. El poder viaja por x; dir = 1 a la derecha, -1 a la izquierda.
export function crearPoder(elem, grande = false) {
  const E = ELEMENTOS[elem] || ELEMENTOS.fuego;
  const g = new THREE.Group();
  const k = grande ? 2.1 : 1;
  let t = 0;
  let actualizar = () => {};
  if (E.poder === 'bola') {
    const nucleo = new THREE.Mesh(new THREE.SphereGeometry(.16 * k, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8' }));
    const capa = new THREE.Mesh(new THREE.SphereGeometry(.27 * k, 16, 12), brillo(E.color, .55));
    const h = halo(E.color, 1.3 * k, .9);
    g.add(nucleo, capa, h);
    actualizar = (dt) => { t += dt; capa.scale.setScalar(1 + Math.sin(t * 30) * .08); h.material.rotation += dt * 4; };
  } else if (E.poder === 'cristal') {
    const mat = new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#3aa8d8', emissiveIntensity: .6, transparent: true, opacity: .85, roughness: .1, metalness: .1, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(.07 * k, (.5 - i * .06) * k, 5), mat);
      c.rotation.z = -Math.PI / 2; // punta hacia +x
      const a = (i / 5) * Math.PI * 2;
      c.position.set(-i * .04 * k, Math.cos(a) * .07 * k * (i ? 1 : 0), Math.sin(a) * .07 * k * (i ? 1 : 0));
      g.add(c);
    }
    g.add(halo('#bfefff', .9 * k, .55));
    actualizar = (dt) => { g.rotation.x += dt * 7; };
  } else if (E.poder === 'rayo') {
    const pts = 12;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts * 3), 3));
    const linea = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#fffbd0', transparent: true, opacity: 1, blending: THREE.AdditiveBlending }));
    const geo2 = geo.clone();
    const linea2 = new THREE.Line(geo2, new THREE.LineBasicMaterial({ color: E.color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending }));
    const cabeza = halo('#fffbd0', .8 * k, 1);
    const cola = halo(E.color, 1.6 * k, .45); cola.position.x = -.5 * k;
    g.add(linea, linea2, cabeza, cola);
    const zigzag = (geom, amp) => {
      const a = geom.attributes.position.array;
      for (let i = 0; i < pts; i++) { a[i * 3] = -i * .11 * k; a[i * 3 + 1] = i && i < pts - 1 ? (Math.random() - .5) * amp * k : 0; a[i * 3 + 2] = (Math.random() - .5) * amp * .5; }
      geom.attributes.position.needsUpdate = true;
    };
    actualizar = (dt) => { t += dt; if (t > .035) { t = 0; zigzag(geo, .28); zigzag(geo2, .4); } };
  } else if (E.poder === 'gota') {
    const mat = new THREE.MeshStandardMaterial({ color: '#4cff3a', emissive: '#1f9e12', emissiveIntensity: .8, transparent: true, opacity: .88, roughness: .2 });
    const bola = new THREE.Mesh(new THREE.SphereGeometry(.22 * k, 18, 14), mat);
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(.07 * k, 10, 8), new THREE.MeshBasicMaterial({ color: '#0f3d08' })); ojo.position.set(.14 * k, .05 * k, .1 * k);
    const calavera = halo('#b6ff6a', .9 * k, .5);
    g.add(bola, ojo, calavera);
    actualizar = (dt) => { t += dt; bola.scale.set(1 + Math.sin(t * 13) * .12, 1 + Math.cos(t * 11) * .12, 1 + Math.sin(t * 9) * .1); };
  } else if (E.poder === 'shuriken') {
    const forma = new THREE.Shape();
    const R = .2, r = .05;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 4, rad = i % 2 ? r : R;
      i ? forma.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : forma.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    const agujero = new THREE.Path(); agujero.absarc(0, 0, .022, 0, Math.PI * 2, true); forma.holes.push(agujero);
    const est = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: .014, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1 }), metal('#c7ccd6', { emissive: E.color, emissiveIntensity: .35 }));
    est.geometry.center();
    const giro = new THREE.Group(); giro.add(est); giro.rotation.x = -.35;
    g.add(giro, halo(E.color, .5, .35));
    actualizar = (dt) => { est.rotation.z -= dt * 28; };
  } else if (E.poder === 'roca') {
    const roca = new THREE.Mesh(new THREE.DodecahedronGeometry(.36 * k, 0), new THREE.MeshStandardMaterial({ color: '#7d5a3a', roughness: 1, flatShading: true }));
    const vetas = new THREE.Mesh(new THREE.DodecahedronGeometry(.37 * k, 0), new THREE.MeshBasicMaterial({ color: '#ff8a2a', wireframe: true, transparent: true, opacity: .35 }));
    g.add(roca, vetas);
    actualizar = (dt) => { roca.rotation.z -= dt * 6; roca.rotation.x += dt * 2; vetas.rotation.copy(roca.rotation); };
  } else if (E.poder === 'tornado') {
    const anillos = [];
    for (let i = 0; i < 7; i++) {
      const a = new THREE.Mesh(new THREE.TorusGeometry((.1 + i * .07) * k, .025 * k, 6, 20, Math.PI * 1.5), brillo(i % 2 ? '#ffffff' : E.color, .55));
      a.rotation.x = Math.PI / 2; a.position.y = (-.45 + i * .16) * k;
      g.add(a); anillos.push(a);
    }
    actualizar = (dt) => { t += dt; anillos.forEach((a, i) => { a.rotation.z += dt * (9 + i); a.position.x = Math.sin(t * 8 + i * .7) * .04 * k; }); };
  }
  return { grupo: g, actualizar: (dt, p) => actualizar(dt, p) };
}

// ---------------------------------------------------------------- partículas
// Sprites con textura difusa; cada uno con su color, tamaño, gravedad y vida.
export function crearParticulas(escena, max = 520) {
  const libres = [], vivas = [];
  for (let i = 0; i < max; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaPunto(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false; escena.add(s); libres.push(s);
  }
  const color = new THREE.Color();
  return {
    // o: { x, y, z, vx, vy, vz, color, tam, vida, g (gravedad), crece, aditivo, opacidad }
    emitir(o) {
      const s = libres.pop() || vivas.shift()?.s;
      if (!s) return;
      s.visible = true;
      s.position.set(o.x, o.y, o.z || 0);
      s.material.color.copy(color.set(o.color || '#ffffff'));
      s.material.blending = o.aditivo === false ? THREE.NormalBlending : THREE.AdditiveBlending;
      s.material.opacity = o.opacidad ?? 1;
      s.material.rotation = Math.random() * 6;
      vivas.push({ s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, vida: o.vida || .5, total: o.vida || .5, tam: o.tam || .2, g: o.g || 0, crece: o.crece ?? 0, op: o.opacidad ?? 1, roce: o.roce ?? 1 });
    },
    actualizar(dt) {
      for (let i = vivas.length - 1; i >= 0; i--) {
        const p = vivas[i];
        p.vida -= dt;
        if (p.vida <= 0) { p.s.visible = false; libres.push(p.s); vivas.splice(i, 1); continue; }
        p.vy -= p.g * dt;
        p.vx *= p.roce; p.vy *= p.roce; p.vz *= p.roce;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        if (p.g > 0 && p.s.position.y < .02) { p.s.position.y = .02; p.vy *= -.25; p.vx *= .5; }
        const k = p.vida / p.total;
        p.s.scale.setScalar(Math.max(.001, p.tam * (1 + p.crece * (1 - k))));
        p.s.material.opacity = p.op * Math.min(1, k * 1.6);
      }
    },
    destruir() { for (const s of [...libres, ...vivas.map((v) => v.s)]) { s.material.dispose(); s.removeFromParent(); } },
  };
}

// estallido de partículas en un punto
export function estallido(part, x, y, { color = '#fff', color2 = null, n = 14, vel = 4, tam = .18, vida = .45, g = 0, z = .25, crece = 0, aditivo = true, roce = .96 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = vel * (.35 + Math.random() * .75);
    part.emitir({ x, y, z: z + (Math.random() - .5) * .2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (Math.random() - .5) * v * .5, color: color2 && i % 2 ? color2 : color, tam: tam * (.6 + Math.random() * .8), vida: vida * (.6 + Math.random() * .7), g, crece, aditivo, roce });
  }
}
