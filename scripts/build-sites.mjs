import {build} from 'esbuild';
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
await import('./build.mjs');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2','.txt':'text/plain'};
const assets={};
async function walk(dir,prefix='') {for(const f of await readdir(dir,{withFileTypes:true})){const rel=prefix+'/'+f.name;if(f.isDirectory())await walk(dir+'/'+f.name,rel);else assets[rel]=[mime[extname(f.name)]||'application/octet-stream',(await readFile(dir+'/'+f.name)).toString('base64')];}}
await walk('dist');
await writeFile('worker/assets.generated.js','export default '+JSON.stringify(assets)+';');
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'neutral',mainFields:['module','main'],target:'es2022',minify:true,external:['node:*','cloudflare:workers'],plugins:[{name:'sites-storage',setup(b){b.onResolve({filter:/store\.js$/},a=>a.path.endsWith('/store.js')?{path:resolve('worker/store-d1.js')}:null);}}]});
await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'cadalado',main:'index.js',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat']},null,2));
console.log('Worker Sites listo con todos los juegos y assets locales.');
