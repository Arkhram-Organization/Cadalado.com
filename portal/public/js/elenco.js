import * as THREE from '/comun/vendor/three.module.min.js';
import {crearPersona} from '/comun/persona3d.js';
import {NPCS} from '/comun/npcs.js';
export function montarElenco(canvas,{grupo=false}={}) {
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);
  camera.position.set(grupo?1.4:1.7,grupo?2.6:1.8,grupo?-6.5:-5.6);camera.lookAt(0,1.05,0);
  scene.add(new THREE.HemisphereLight('#f3f6ef','#93987b',2.9));
  const key=new THREE.DirectionalLight('#ffe7c5',4);key.position.set(-3,5,-4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.DirectionalLight('#d2ff8d',2);rim.position.set(3,4,2);scene.add(rim);
  const plane=new THREE.Mesh(new THREE.CircleGeometry(grupo?2.3:1.1,72),new THREE.MeshStandardMaterial({color:'#343f2b',roughness:.85}));plane.rotation.x=-Math.PI/2;plane.receiveShadow=true;scene.add(plane);
  let modelos=[],actual=0,estado='quieto',animHasta=0,angle=0,drag=false,lastX=0;
  function set(i) {
    modelos.forEach(p=>p.dispose());modelos=[];actual=(i+NPCS.length)%NPCS.length;
    const ids=grupo?[4,actual,3]:[actual];
    ids.forEach((id,k)=>{const npc=NPCS[id];const p=crearPersona(THREE,{...npc.look},{sombras:true});p.grupo.position.x=grupo?(k-1)*1.08:0;p.grupo.position.z=grupo&&k!==1?.2:0;if(grupo&&k===1)p.grupo.scale.setScalar(1.14);p.grupo.rotation.y=grupo?(k-1)*.18:angle;scene.add(p.grupo);modelos.push(p);});
    canvas.dispatchEvent(new CustomEvent('personaje',{detail:NPCS[actual]}));
  }
  canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;angle+=(e.clientX-lastX)*.012;lastX=e.clientX;if(!grupo)modelos[0].grupo.rotation.y=angle;});
  canvas.addEventListener('pointerup',()=>drag=false);
  canvas.addEventListener('pointercancel',()=>drag=false);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last=performance.now(),raf;
  function frame(now){raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}modelos.forEach((p,i)=>p.animar(now<animHasta?estado:'quieto',reduced?0:dt));renderer.render(scene,camera);}
  set(0);raf=requestAnimationFrame(frame);
  return {set,next:()=>set(actual+1),previous:()=>set(actual-1),animar:s=>{estado=s;animHasta=performance.now()+2400;},get npc(){return NPCS[actual]},dispose:()=>{cancelAnimationFrame(raf);modelos.forEach(p=>p.dispose());renderer.dispose();}};
}
