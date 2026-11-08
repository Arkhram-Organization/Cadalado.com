import { env } from 'cloudflare:workers';
export class StoreNotConfigured extends Error {}
const q=(sql,...params)=>env.DB.prepare(sql).bind(...params);
const exp=s=>s?Date.now()+s*1000:0;
const store={
  async get(k){return (await q('SELECT value FROM club_kv WHERE key=? AND (expires=0 OR expires>?)',k,Date.now()).first())?.value??null;},
  async set(k,v,ttl){await q('INSERT INTO club_kv(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires',k,String(v),exp(ttl)).run();},
  async setNX(k,v,ttl){const r=await q('INSERT INTO club_kv(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires WHERE club_kv.expires>0 AND club_kv.expires<=?',k,String(v),Date.now()+ttl,Date.now()).run();return r.meta.changes>0;},
  async del(k){await env.DB.batch([q('DELETE FROM club_kv WHERE key=?',k),q('DELETE FROM club_hash WHERE key=?',k)]);},
  async hset(k,f,v,ttl){await q('INSERT INTO club_hash(key,field,value,expires) VALUES(?,?,?,?) ON CONFLICT(key,field) DO UPDATE SET value=excluded.value,expires=excluded.expires',k,String(f),String(v),exp(ttl)).run();},
  async hgetall(k){const r=await q('SELECT field,value FROM club_hash WHERE key=? AND (expires=0 OR expires>?)',k,Date.now()).all();return Object.fromEntries(r.results.map(r=>[r.field,r.value]));},
  async hget(k,f){return (await q('SELECT value FROM club_hash WHERE key=? AND field=? AND (expires=0 OR expires>?)',k,String(f),Date.now()).first())?.value??null;},
  async hdel(k,fs){if(fs.length) await env.DB.batch(fs.map(f=>q('DELETE FROM club_hash WHERE key=? AND field=?',k,String(f))));},
  async lpush(k,v,max,ttl){await q(`INSERT INTO club_kv(key,value,expires) VALUES(?,json_array(?),?) ON CONFLICT(key) DO UPDATE SET value=(SELECT json_group_array(value) FROM (SELECT ? AS value,-1 AS ord UNION ALL SELECT value,CAST(key AS INTEGER) AS ord FROM json_each(CASE WHEN club_kv.expires>0 AND club_kv.expires<=? THEN '[]' ELSE club_kv.value END) ORDER BY ord ASC LIMIT ?)),expires=excluded.expires`,k,String(v),exp(ttl),String(v),Date.now(),max||10000).run();},
  async lrange(k,a,b){const r=JSON.parse(await this.get(k)||'[]');return r.slice(a,b===-1?undefined:b+1);},
  async incr(k,ttl){const r=await q(`INSERT INTO club_kv(key,value,expires) VALUES(?,'1',?) ON CONFLICT(key) DO UPDATE SET value=CAST(CASE WHEN club_kv.expires>0 AND club_kv.expires<=? THEN 1 ELSE CAST(club_kv.value AS INTEGER)+1 END AS TEXT),expires=CASE WHEN ?>0 THEN ? ELSE club_kv.expires END RETURNING value`,k,exp(ttl),Date.now(),ttl||0,exp(ttl)).first();return Number(r.value);},
  async incrby(k,n){const r=await q('INSERT INTO club_kv(key,value,expires) VALUES(?,?,0) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(club_kv.value AS INTEGER)+? AS TEXT) RETURNING value',k,String(n),Number(n)).first();return Number(r.value);},
  ping:async()=>{await q('SELECT 1').first();return 'PONG';}
};
export const getStore=()=>store;
export const storeKind=()=> 'sites-d1';
