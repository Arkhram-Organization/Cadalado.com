import {JUEGOS} from './datos.js';
import {NPCS} from '/comun/npcs.js';
import {montarElenco} from './elenco.js';
import {montarMuro,montarSugerencias} from './muro.js';
import {montarLobby} from './lobby.js';
const $=s=>document.querySelector(s);
const elenco=montarElenco($('#elenco'));
const perfiles={glinsky:'El de las tecnologías exponenciales.',julo:'Compila código. Descompila rivales.',faur:'Una más y se va. Mentira, se queda.',dobro:'La casa siempre gana. La casa es él.',volcho:'No necesita presentación. Es el volcho.',colon:'Descubrió la isla. Ahora falta sobrevivir.',claude:'Armó el juego. También quiere ganar.',mate:'Siempre hay tiempo para otro mate.',chapa:'Corazón de metal. Espíritu de club.',mati:'Una aparición que vale oro.',angeles:'Informática, danza artística y boludeces. En ese orden.',angie:'Solo habla de Nacho. Y de Chicha.'};
function ficha(){const n=elenco.npc;$('#npc-name').textContent=n.nombre;$('#npc-desc').textContent=perfiles[n.id]||'Uno de los nuestros.';$('#npc-quote').textContent='“'+n.frases[0]+'”';$('#npc-index').textContent=String(NPCS.indexOf(n)+1).padStart(2,'0')+' / '+NPCS.length;document.querySelectorAll('[data-npc]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.npc===NPCS.indexOf(n))));}
$('#npc-pills').innerHTML=NPCS.map((n,i)=>`<button data-npc="${i}" aria-pressed="false">${n.nombre}</button>`).join('');
$('#npc-pills').onclick=e=>{if(e.target.dataset.npc!==undefined){elenco.set(+e.target.dataset.npc);ficha();}};
$('#npc-prev').onclick=()=>{elenco.previous();ficha();};$('#npc-next').onclick=()=>{elenco.next();ficha();};
document.querySelectorAll('[data-anim]').forEach(b=>b.onclick=()=>elenco.animar(b.dataset.anim));ficha();
$('#games').innerHTML=JUEGOS.map(j=>`<a class="game" href="${j.url}"><div class="game-art"><img src="${j.captura}" alt="${j.nombre}" loading="lazy"><span class="tag ${j.id==='royale'?'lime':''}">${j.id==='royale'?'Nueva isla · 3D':j.id==='casino'?'Fichas de mentira':j.id==='carrera'?'Carrera 3D':'Multijugador'}</span></div><div class="game-body"><div class="game-top"><h3>${j.nombre}</h3><span aria-hidden="true">↗</span></div><p>${j.linea}</p><div class="game-meta"><span>${j.datos[0][1]}</span><span data-room="${j.id}">Explorar →</span></div></div></a>`).join('');
async function cargar(){for(const j of JUEGOS){try{const r=await fetch(j.lobby);if(!r.ok)continue;const d=await r.json();const n=(d.salas||d.open||[]).length;const el=document.querySelector('[data-room="'+j.id+'"]');el.textContent=n?n+(n===1?' sala abierta':' salas abiertas'):'Armá una partida';el.classList.toggle('room-status',n>0);}catch{}}}
cargar();setInterval(cargar,20000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cargar();});
// Muro de publicaciones (arriba) y sugerencias (abajo de todo).
montarMuro($('[data-muro]'));
montarSugerencias($('[data-sugerencias]'));
montarLobby(document.querySelector('#lobby'));
