// Pasa los datos del club de Upstash (Redis) a Cloudflare: cuentas, sesiones, fichas, skins, amigos,
// chats, historial, muro, sugerencias… Las salas en curso, lobbys, candados y presencias no se pasan
// (duran minutos). Se puede correr más de una vez: lo que ya está se pisa con lo de Upstash.
//
// Uso:
//   UPSTASH_URL=https://xxx.upstash.io UPSTASH_TOKEN=… DESTINO=https://cadalado.com IMPORTAR_CLAVE=… \
//     node scripts/migrar-upstash.mjs            (agregar --prueba para solo contar, sin mandar nada)
const { UPSTASH_URL, UPSTASH_TOKEN, DESTINO, IMPORTAR_CLAVE } = process.env;
const prueba = process.argv.includes('--prueba');
if (!UPSTASH_URL || !UPSTASH_TOKEN || (!prueba && (!DESTINO || !IMPORTAR_CLAVE))) {
  console.error('Faltan variables: UPSTASH_URL, UPSTASH_TOKEN, DESTINO e IMPORTAR_CLAVE (ver arriba).');
  process.exit(1);
}

async function redis(...cmd) {
  const r = await fetch(UPSTASH_URL, { method: 'POST', headers: { authorization: `Bearer ${UPSTASH_TOKEN}` }, body: JSON.stringify(cmd.map(String)) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`Upstash: ${d.error || r.status}`);
  return d.result;
}
// varios comandos en un solo viaje
async function tubo(cmds) {
  const r = await fetch(UPSTASH_URL.replace(/\/$/, '') + '/pipeline', { method: 'POST', headers: { authorization: `Bearer ${UPSTASH_TOKEN}` }, body: JSON.stringify(cmds.map((c) => c.map(String))) });
  const d = await r.json();
  if (!r.ok || !Array.isArray(d)) throw new Error(`Upstash: ${d.error || r.status}`);
  return d.map((x) => (x.error ? null : x.result));
}

// lo que no se pasa: salas y cosas de segundos/minutos
const NO = /^(sala|lock|pres|pos|room|truco|grupo|grupo-de|lobby|grupos|invit):|^(lobby|grupos:abiertos)$/;

let cursor = '0', claves = [];
do {
  const [sig, lote] = await redis('SCAN', cursor, 'COUNT', 1000);
  cursor = sig;
  claves.push(...lote);
} while (cursor !== '0');
const pasar = claves.filter((k) => !NO.test(k));
console.log(`Upstash: ${claves.length} claves; se pasan ${pasar.length} (el resto son salas y cosas temporales).`);

const entradas = [];
for (let i = 0; i < pasar.length; i += 100) {
  const lote = pasar.slice(i, i + 100);
  const tipos = await tubo(lote.map((k) => ['TYPE', k]));
  const ttl = await tubo(lote.map((k) => ['PTTL', k]));
  const valores = await tubo(lote.map((k, j) => (tipos[j] === 'hash' ? ['HGETALL', k] : tipos[j] === 'list' ? ['LRANGE', k, 0, -1] : ['GET', k])));
  lote.forEach((k, j) => {
    const tipo = tipos[j];
    let v = valores[j];
    if (v === null || v === undefined || !['string', 'hash', 'list'].includes(tipo)) return;
    if (tipo === 'hash' && Array.isArray(v)) {
      const o = {};
      for (let x = 0; x < v.length; x += 2) o[v[x]] = v[x + 1];
      v = o;
    }
    const exp = Number(ttl[j]) > 0 ? Date.now() + Number(ttl[j]) : 0;
    entradas.push({ k, e: { v, exp } });
  });
}
const porTipo = entradas.reduce((m, { k }) => ((m[k.split(':')[0]] = (m[k.split(':')[0]] || 0) + 1), m), {});
console.log('Por tipo:', porTipo);
if (prueba) process.exit(0);

// en tandas de ~800 KB
let tanda = [], peso = 0, enviadas = 0;
async function mandar() {
  if (!tanda.length) return;
  const r = await fetch(DESTINO.replace(/\/$/, '') + '/api/club/importar', { method: 'POST', headers: { 'content-type': 'application/json', 'x-importar-token': IMPORTAR_CLAVE }, body: JSON.stringify({ entradas: tanda }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Cloudflare: ${d.error || r.status}`);
  enviadas += d.ok;
  tanda = [];
  peso = 0;
}
for (const e of entradas) {
  const t = JSON.stringify(e).length;
  if (peso + t > 800_000) await mandar();
  tanda.push(e);
  peso += t;
}
await mandar();
console.log(`Listo: ${enviadas} datos pasados a ${DESTINO}.`);
