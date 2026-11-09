import { handle as royale } from '../games/royale/api.js';
import { handle as carrera } from '../games/carrera/api.js';
import { handle as casino } from '../games/casino/api.js';
import { handle as memes } from '../games/memes/api.js';
import { handle as haxball } from '../games/haxball/api.js';
import { handle as truco } from '../games/truco/api.js';
import { handle as ajedrez } from '../games/chessort/api.js';
import { handle as club } from '../shared/club-api.js';
import assets from './assets.generated.js';
const api=[['/api/royale/',royale],['/api/carrera/',carrera],['/api/casino/',casino],['/api/memes/',memes],['/api/haxball/',haxball],['/api/truco/',truco],['/ajedrez/api/',ajedrez],['/api/club/',club]];
export default { async fetch(request,env) {
  const url=new URL(request.url),path=url.pathname;
  const match=api.find(([prefix])=>path.startsWith(prefix));
  if(match) {try{return await match[1](request);}catch(e){console.error(e);return Response.json({error:'No se pudo completar la operación. Probá de nuevo.'},{status:500});}}
  let file=path==='/'?'/index.html':path;
  if(/^\/(royale|carrera|casino|memes|haxball|truco|ajedrez)(\/.*)?$/.test(path)&&!path.split('/').pop().includes('.')) file='/'+path.split('/')[1]+'/index.html';
  if(!assets[file] && assets[file+'.html'])file+='.html';
  const a=assets[file]||assets['/404.html'];
  if(!a)return new Response('No encontrado',{status:404});
  const data=Uint8Array.from(atob(a[1]),c=>c.charCodeAt(0));
  return new Response(data,{status:assets[file]?200:404,headers:{'content-type':a[0],'cache-control':file.endsWith('.html')?'no-cache':'public, max-age=300','x-content-type-options':'nosniff'}});
}};
