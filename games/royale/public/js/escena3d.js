import * as THREE from '/comun/vendor/three.module.min.js';
import { crearPersona } from '/comun/persona3d.js';
import { T, TAM, BALDOSA, LADO, ARMAS } from './mundo.js';
import { OBJETOS } from './inventario.js';

export class Isla3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#79bfc1');
    this.camera = new THREE.OrthographicCamera(-200,200,112.5,-112.5,1,1500);
    this.scene.add(new THREE.HemisphereLight('#ecf4ff','#667d41',1.9));
    this.sun = new THREE.DirectionalLight('#fff1d3',2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-310,right:310,top:310,bottom:-310,near:1,far:1000});
    this.sun.shadow.bias = -.0006;
    this.scene.add(this.sun,this.sun.target);
    this.people = new Map(); this.loot = new Map(); this.effects = [];
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.bullets = new THREE.Group(); this.scene.add(this.bullets);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.zone = new THREE.Mesh(new THREE.CylinderGeometry(1,1,80,128,1,true),new THREE.MeshBasicMaterial({color:'#b791ff',transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));
    this.scene.add(this.zone); this.zone.visible = false;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1,.002,6,128),new THREE.MeshBasicMaterial({color:'#e5d4ff'}));
    this.ring.rotation.x = Math.PI/2; this.scene.add(this.ring); this.ring.visible=false;
  }
  mesh(geo,color,x,y,z,parent=this.world) {
    const m = new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.85}));
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
  }
  clear(group) { group.traverse(o=>{o.geometry?.dispose(); if(o.material) for(const m of [].concat(o.material)) {m.map?.dispose();m.dispose();}});group.clear(); }
  preparar(m) {
    this.clear(this.world); this.loot.clear();
    for(const p of this.people.values()) {this.scene.remove(p.persona.grupo);this.clear(p.persona.grupo);} this.people.clear();
    const colors=['#65adb5','#e0d2a3','#8fa866','#c4ab87','#ded1b1','#b5a17e'];
    const dummy=new THREE.Object3D();
    for(let tipo=0;tipo<6;tipo++) {
      const indexes=[];m.t.forEach((t,i)=>{if(t===tipo) indexes.push(i);});
      const height=tipo===T.PARED?17:tipo===T.AGUA?.6:2;
      const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(16.1,height,16.1),new THREE.MeshStandardMaterial({color:colors[tipo],roughness:tipo===0?.3:.96}),indexes.length);
      indexes.forEach((i,k)=>{dummy.position.set((i%TAM+.5)*16,height/2-2,(Math.floor(i/TAM)+.5)*16);dummy.updateMatrix();inst.setMatrixAt(k,dummy.matrix);inst.setColorAt(k,new THREE.Color('#ffffff').multiplyScalar(.97+((i*17)%13)/400));});
      inst.receiveShadow=true; inst.castShadow=tipo===T.PARED; this.world.add(inst);
    }
    for(const o of m.obstaculos) {
      if(o.tipo==='roca') { const r=this.mesh(new THREE.DodecahedronGeometry(o.r,1),'#8d9690',o.x,3,o.y);r.scale.set(1,.7,1);r.rotation.y=o.tono*6; }
      else {
        this.mesh(new THREE.CylinderGeometry(2,3.2,15,8),'#7f6246',o.x,6,o.y);
        const tree=this.mesh(new THREE.IcosahedronGeometry(o.copa,2),['#496b3c','#5b7742','#3f7050'][Math.floor(o.tono*3)],o.x,21,o.y);tree.scale.set(1,1.1,1);
        tree.userData.tree=true;tree.material.transparent=true;
      }
    }
    for(const b of m.botin) {
      const g=new THREE.Group();g.position.set(b.x,3,b.y);this.world.add(g);
      const color=OBJETOS[b.tipo]?.color||ARMAS[b.tipo]?.color||'#fff';
      const pad=this.mesh(new THREE.CylinderGeometry(6,6,.45,24),color,0,-1.9,0,g);
      pad.material.emissive.set(color);pad.material.emissiveIntensity=.25;
      if(ARMAS[b.tipo]) {this.mesh(new THREE.BoxGeometry(b.tipo==='pistola'?7:11,2,2),'#363b3b',0,1,0,g);this.mesh(new THREE.BoxGeometry(2,4,1.8),color,-2,-1,0,g);}
      else if(b.tipo==='granada') {this.mesh(new THREE.SphereGeometry(2.7,12,10),'#697148',0,1,0,g);this.mesh(new THREE.BoxGeometry(1,2,1),'#ddd',0,3,0,g);}
      else if(b.tipo==='mini'||b.tipo==='escudo') {const jar=this.mesh(new THREE.CylinderGeometry(b.tipo==='mini'?1.8:2.8,b.tipo==='mini'?1.8:2.8,5,16),color,0,1,0,g);jar.material.emissive.set(color);jar.material.emissiveIntensity=.4;this.mesh(new THREE.CylinderGeometry(2,2,.8,12),'#d8e6de',0,4,0,g);}
      else {this.mesh(new THREE.BoxGeometry(6,4,4),'#f4eee0',0,1,0,g);this.mesh(new THREE.BoxGeometry(1.2,2.8,.2),'#d76051',0,1,2.1,g);this.mesh(new THREE.BoxGeometry(3,1,.2),'#d76051',0,1,2.2,g);}
      this.loot.set(b.id,g);
    }
  }
  apuntar(x,y) {this.ray.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),this.camera);const p=new THREE.Vector3();this.ray.ray.intersectPlane(this.plane,p);return {x:p.x,y:p.z};}
  proyectar(x,y,height=0) {const p=new THREE.Vector3(x,height,y).project(this.camera);return {x:(p.x+1)/2,y:(1-p.y)/2};}
  explosion(x,y) {
    for(let i=0;i<16;i++){const m=this.mesh(new THREE.IcosahedronGeometry(1.8,0),i%2?'#ffc56d':'#ec7950',x,3,y,this.scene);this.effects.push({m,t:.65,v:new THREE.Vector3((Math.random()-.5)*70,Math.random()*55,(Math.random()-.5)*70)});}
  }
  dibujar({mundo,gente,balas,tomados,foco,W,H,dt,ms,zona,granadas=[]}) {
    const width=this.renderer.domElement.clientWidth,height=this.renderer.domElement.clientHeight;
    if(this.w!==width||this.h!==height){this.w=width;this.h=height;this.renderer.setSize(width,height,false);}
    Object.assign(this.camera,{left:-W/2,right:W/2,top:H/2,bottom:-H/2});this.camera.updateProjectionMatrix();
    this.camera.position.set(foco.x,320,foco.y+210);this.camera.lookAt(foco.x,0,foco.y);
    this.sun.position.set(foco.x-100,260,foco.y-140);this.sun.target.position.set(foco.x,0,foco.y);
    const ids=new Set(gente.map(p=>p.id));
    for(const p of gente) {
      let a=this.people.get(p.id);
      if(!a){const persona=crearPersona(THREE,p.look,{sombras:true});persona.grupo.scale.setScalar(10);this.scene.add(persona.grupo);const gun=new THREE.Group();this.mesh(new THREE.BoxGeometry(.09,.12,.38),'#333d3e',0,0,-.12,gun);this.mesh(new THREE.BoxGeometry(.08,.18,.09),'#555e4c',0,-.1,.01,gun);gun.position.set(.28,1.04,-.42);persona.grupo.add(gun);const flash=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,0),new THREE.MeshBasicMaterial({color:'#ffe5a1'}));flash.position.z=-.38;gun.add(flash);a={persona,gun,flash,death:0,alive:true,health:p.vida};this.people.set(p.id,a);}
      a.persona.grupo.position.set(p.x,0,p.y);a.persona.grupo.rotation.y=-p.ang-Math.PI/2;
      if(p.vivo){a.death=0;a.persona.grupo.rotation.z=0;a.persona.grupo.scale.setScalar(10);const fire=balas.some(b=>b.de===p.id&&Math.hypot(b.x-p.x,b.y-p.y)<30);a.persona.animar(p.gesto?'g-'+p.gesto:{mueve:p.mueve,corre:p.mueve,velocidad:p.mueve?1:0,apunta:true,dispara:fire,recargando:p.recargando>0,curando:!!p.usando,golpe:p.vida<a.health},dt);a.health=p.vida;a.gun.visible=!!ARMAS[p.arma]&&!p.gesto;a.flash.visible=fire;a.gun.scale.z=p.arma==='pistola'?.7:1.2;}
      a.alive=p.vivo;
    }
    for(const [id,a] of this.people) {
      if(!ids.has(id)||!a.alive){a.death+=dt;a.persona.animar({muerto:true,caido:true},dt);a.gun.visible=false;a.persona.grupo.position.y=Math.sin(Math.min(1,a.death*2)*Math.PI)*3;if(a.death>1.8){const s=Math.max(0,1-(a.death-1.8));a.persona.grupo.scale.setScalar(s*10);}if(a.death>3){this.scene.remove(a.persona.grupo);this.clear(a.persona.grupo);this.people.delete(id);}}
    }
    for(const [id,g] of this.loot){const fase=typeof id==='number'?id:0;g.visible=!tomados.has(id);g.position.y=3+Math.sin(ms/400+fase)*.6;g.rotation.y=ms/1600+fase;}
    for(const tree of this.world.children)if(tree.userData.tree)tree.material.opacity=gente.some(p=>Math.hypot(p.x-tree.position.x,p.y-tree.position.z)<21)?.28:1;
    this.clear(this.bullets);
    for(const b of balas) {const g=this.mesh(new THREE.BoxGeometry(5,.6,.6),'#ffe59b',b.x,7,b.y,this.bullets);g.rotation.y=-Math.atan2(b.vy,b.vx);g.material.emissive.set('#ffbc48');g.material.emissiveIntensity=3;}
    for(const b of granadas)this.mesh(new THREE.SphereGeometry(2,10,8),'#545e37',b.x,3+Math.sin(Math.min(1,b.t/.8)*Math.PI)*18,b.y,this.bullets);
    this.effects=this.effects.filter(e=>{e.t-=dt;e.m.position.addScaledVector(e.v,dt);e.v.y-=65*dt;e.m.scale.setScalar(Math.max(.01,e.t));if(e.t<=0){this.scene.remove(e.m);e.m.geometry.dispose();e.m.material.dispose();return false;}return true;});
    this.zone.visible=this.ring.visible=!!zona;
    if(zona){this.zone.position.set(zona.x,35,zona.y);this.zone.scale.set(zona.r,1,zona.r);this.ring.position.set(zona.x,1,zona.y);this.ring.scale.setScalar(zona.r);}
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.clear(this.scene);this.renderer.dispose();}
}
