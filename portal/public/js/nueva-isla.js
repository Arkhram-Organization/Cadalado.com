import {JUEGOS,salasAbiertas} from './datos.js';
import {NPCS} from '/comun/npcs.js';
import {montarElenco} from './elenco.js';
import {montarMuro,montarSugerencias} from './muro.js';
import {montarLobby} from './lobby.js';
const $=s=>document.querySelector(s);
const elenco=montarElenco($('#elenco'));
const perfiles={vicky:'La jefa del comedor. Medialunas y paninis: tarjeta o efectivo.',ferchus:'El del kiosco. Panini, medialunas, café… y un TikTok.',dorin:'Racing, Macabeadas y una frente amplia (no está pelado).',glinsky:'El de las tecnologías exponenciales.',julo:'Compila código. Descompila rivales.',faur:'Una más y se va. Mentira, se queda.',dobro:'La casa siempre gana. La casa es él.',volcho:'No necesita presentación. Es el volcho.',colon:'Descubrió la isla. Ahora falta sobrevivir.',claude:'Armó el juego. También quiere ganar.',mate:'Siempre hay tiempo para otro mate.',chapa:'Corazón de metal. Espíritu de club.',mati:'Una aparición que vale oro.',angeles:'Informática, danza artística y boludeces. En ese orden.',angie:'Solo habla de Nacho. Y de Chicha.',olcho:'La rata. La ratatata. Shana Tova Umeka.',sandra:'Desde el caso Bernstein no volvió a ser la misma.',franba:'Hijo del ciber, hincha del Rojo. No se está quedando pelado.',marti:'La profe de Lengua. Prolepsis, Operación Masacre y Nul, callate.',maica:'Pelotudeces de alto nivel. Mejor amiga de Mica. ¿Tenés el resumen?',teo:'Shofar, tefilín y Aieka con Dani. T-t-todo bien.',elidiprimio:'¿Qué hacen, manga de wops? Dale MXD, dale dale MXD.'};
function ficha(){const n=elenco.npc;$('#npc-name').textContent=n.nombre;$('#npc-desc').textContent=perfiles[n.id]||'Uno de los nuestros.';$('#npc-quote').textContent='“'+n.frases[0]+'”';$('#npc-index').textContent=String(NPCS.indexOf(n)+1).padStart(2,'0')+' / '+NPCS.length;document.querySelectorAll('[data-npc]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.npc===NPCS.indexOf(n))));}
$('#npc-pills').innerHTML=NPCS.map((n,i)=>`<button data-npc="${i}" aria-pressed="false">${n.nombre}</button>`).join('');
$('#npc-pills').onclick=e=>{if(e.target.dataset.npc!==undefined){elenco.set(+e.target.dataset.npc);ficha();}};
$('#npc-prev').onclick=()=>{elenco.previous();ficha();};$('#npc-next').onclick=()=>{elenco.next();ficha();};
document.querySelectorAll('[data-anim]').forEach(b=>b.onclick=()=>elenco.animar(b.dataset.anim));ficha();
// el casino de Dobro: la tarjeta grande y dorada que ocupa toda la fila
const casinoGrande=j=>`<a class="game casino-oro" href="${j.url}"><div class="oro-luz"></div><div class="oro-chispas">${Array.from({length:14},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><div class="game-art"><img src="${j.poster||j.captura}" alt="${j.nombre}" loading="lazy"><span class="tag oro">El juego de la casa</span></div><div class="game-body"><div class="oro-titulo"><small>Abierto toda la noche</small><h3>${j.nombre}</h3></div><p>${j.linea}</p><div class="oro-juegos">${j.datos[1][1].split(' · ').map(x=>`<span>${x}</span>`).join('')}</div><div class="game-meta"><span>${j.datos[2][1]}</span><span data-room="${j.id}"></span><span class="game-jugar">Jugar</span></div></div></a>`;
$('#games').innerHTML=[...JUEGOS].sort((a,b)=>(b.id==='casino')-(a.id==='casino')).map(j=>j.id==='casino'?casinoGrande(j):`<a class="game" href="${j.url}"><div class="game-art"><img src="${j.captura}" alt="${j.nombre}" loading="lazy"><span class="tag ${j.id==='royale'?'lime':''}">${j.id==='royale'?'Nueva isla · 3D':j.id==='casino'?'Fichas de mentira':j.id==='carrera'?'Carrera 3D':'Multijugador'}</span></div><div class="game-body"><div class="game-top"><h3>${j.nombre}</h3></div><p>${j.linea}</p><div class="game-meta"><span>${j.datos[0][1]}</span><span data-room="${j.id}"></span><span class="game-jugar">Jugar</span></div></div></a>`).join('');
async function cargar(){const todas=await salasAbiertas();for(const j of JUEGOS){try{const d=todas[j.id];if(!d)continue;const n=(d.salas||d.open||[]).length;const el=document.querySelector('[data-room="'+j.id+'"]');el.textContent=n?n+(n===1?' sala abierta':' salas abiertas'):'';el.classList.toggle('room-status',n>0);}catch{}}}
cargar();setInterval(()=>{if(!document.hidden)cargar();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cargar();});
// Muro de publicaciones (arriba) y sugerencias (abajo de todo).
montarMuro($('[data-muro]'));
montarSugerencias($('[data-sugerencias]'));
montarLobby(document.querySelector('#lobby'));
