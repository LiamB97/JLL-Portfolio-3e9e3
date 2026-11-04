import express from 'express';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import initialTransport from './data/tfl-network.json' with {type:'json'};
import {transportService} from './transport.mjs';
import {connectionsService} from './connections.mjs';
import {samples} from './model.mjs';
import {applySource,fetchSource} from './sync.mjs';
import {createNetlifyApi} from './netlify-api.mjs';
import {refreshPortfolio} from './netlify-store.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=process.env.DATA_DIR||path.join(root,'.data');mkdirSync(dataDir,{recursive:true,mode:0o700});
const passwordFile=path.join(dataDir,'admin-password');
if(!process.env.ADMIN_PASSWORD&&!existsSync(passwordFile))writeFileSync(passwordFile,randomBytes(24).toString('base64url'),{mode:0o600});
const password=process.env.ADMIN_PASSWORD||readFileSync(passwordFile,'utf8').trim();
if(password.length<12)throw Error('ADMIN_PASSWORD must have at least 12 characters.');
const db=new DatabaseSync(path.join(dataDir,'portfolio.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS developments(id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL)');
if(!db.prepare("SELECT value FROM metadata WHERE key='seeded'").get()){
 const insert=db.prepare('INSERT INTO developments VALUES (?,?)');db.exec('BEGIN');try{for(const d of samples)insert.run(d.id,JSON.stringify(d));db.prepare('INSERT INTO metadata VALUES (?,?)').run('seeded','1');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'6mb'}));
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');next();});
function localState(){const access=db.prepare("SELECT value FROM metadata WHERE key='access-state'").get();const sync=db.prepare("SELECT value FROM metadata WHERE key='last-sync'").get();return {...(access?JSON.parse(access.value):{}),developments:db.prepare('SELECT data FROM developments ORDER BY rowid').all().map(r=>JSON.parse(r.data)),lastSync:sync?JSON.parse(sync.value):null};}
const repository={read:async()=>localState(),update:async change=>{db.exec('BEGIN');try{const state=localState(),result=change(state);const {developments,lastSync,...access}=state;db.exec('DELETE FROM developments');const insert=db.prepare('INSERT INTO developments VALUES (?,?)');for(const d of developments)insert.run(d.id,JSON.stringify(d));const meta=db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');meta.run('access-state',JSON.stringify(access));if(lastSync)meta.run('last-sync',JSON.stringify(lastSync));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
const network=transportService({seed:initialTransport});const localRouteCache=new Map();const connections=connectionsService({network,read:async key=>localRouteCache.get(key),write:async(key,value)=>{if(localRouteCache.size>500)localRouteCache.clear();localRouteCache.set(key,value);}});
const visitorRepository={readDay:async date=>{const row=db.prepare('SELECT value FROM metadata WHERE key=?').get('engagement:'+date);return row?JSON.parse(row.value):{people:{}};},updateDay:async(date,change)=>{db.exec('BEGIN');try{db.prepare("DELETE FROM metadata WHERE key LIKE 'engagement:%' AND key < ?").run('engagement:'+new Date(Date.now()-399*86400000).toISOString().slice(0,10));const key='engagement:'+date,row=db.prepare('SELECT value FROM metadata WHERE key=?').get(key),next=row?JSON.parse(row.value):{people:{}};change(next);db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(next));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};
const brochureDir=path.join(dataDir,'brochure-files');mkdirSync(brochureDir,{recursive:true,mode:0o700});
const brochureFiles={put:async(key,bytes,type)=>{const file=path.join(brochureDir,key.replaceAll('/','-'));writeFileSync(file,bytes,{mode:0o600});writeFileSync(file+'.type',type,{mode:0o600});},get:async key=>{const file=path.join(brochureDir,key.replaceAll('/','-'));return existsSync(file)?{bytes:readFileSync(file),type:readFileSync(file+'.type','utf8')}:null;},remove:async key=>{const file=path.join(brochureDir,key.replaceAll('/','-'));if(existsSync(file))unlinkSync(file);if(existsSync(file+'.type'))unlinkSync(file+'.type');}};
const api=createNetlifyApi({repository,password,brochureFiles,network,connections,visitorRepository});
app.use('/api',async(req,res,next)=>{try{const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);const body=['GET','HEAD'].includes(req.method)?undefined:JSON.stringify(req.body||{});const response=await api(new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`,{method:req.method,headers,...(body?{body}:{})}));res.status(response.status);response.headers.forEach((value,key)=>res.set(key,value));res.send(Buffer.from(await response.arrayBuffer()));}catch(error){next(error);}});
app.use(express.static(path.join(root,'dist')));app.get('/{*path}',(_,res)=>{if(existsSync(path.join(root,'dist/index.html')))res.sendFile(path.join(root,'dist/index.html'));else res.status(503).send('Run npm run build, or use npm run dev.');});
app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.status===413?'Import exceeds the 2MB limit.':'Request failed.'}));
const syncHours=Number(process.env.AUTO_SYNC_HOURS??6);
if(Number.isFinite(syncHours)&&syncHours>0){
 let syncing=false;
 const sync=async()=>{if(syncing)return;syncing=true;try{const result=applySource(db,await fetchSource());console.log(`JLL stock refreshed: ${result.imported} developments; ${result.skipped.length} require review.`);}catch(e){console.error('JLL refresh failed; existing stock preserved:',e.message);}finally{syncing=false;}};
 setTimeout(sync,5000).unref();setInterval(sync,Math.max(syncHours,1)*3600000).unref();
}
const port=Number(process.env.PORT||3001);app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Portfolio API listening on port ${port}. Admin password: ADMIN_PASSWORD or .data/admin-password (not logged).`));
