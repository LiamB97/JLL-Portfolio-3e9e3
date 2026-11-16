import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {portfolioRepository,ConflictError,refreshPortfolio,applyStockSnapshot} from './netlify-store.mjs';import {createNetlifyApi} from './netlify-api.mjs';import {samples} from './model.mjs';
function memoryStore(){let entry=null,version=0;return{async getWithMetadata(){return entry?{data:structuredClone(entry),etag:String(version)}:null;},async setJSON(key,data,options){if(options.onlyIfNew&&entry||options.onlyIfMatch&&options.onlyIfMatch!==String(version))return{modified:false};entry=structuredClone(data);version++;return{modified:true,etag:String(version)};}};}
test('Netlify storage preserves all concurrent edits using conditional writes',async()=>{const store=memoryStore();const repo=portfolioRepository(store);const initial=(await repo.read()).developments.length;await Promise.all([repo.update(s=>s.developments.push({...samples[0],id:'one'})),repo.update(s=>s.developments.push({...samples[0],id:'two'}))]);const next=await portfolioRepository(store).read();assert.equal(next.developments.length,initial+2);assert.ok(next.developments.some(d=>d.id==='one'));assert.ok(next.developments.some(d=>d.id==='two'));});
test('repeated write conflicts fail without overwriting another administrator',async()=>{const repo=portfolioRepository({getWithMetadata:async()=>null,setJSON:async()=>({modified:false})});await assert.rejects(repo.update(s=>s.developments=[]),ConflictError);});
test('Netlify API enforces auth and supports atomic create, update and delete after cold starts',async()=>{const store=memoryStore();const password=randomBytes(24).toString('hex');const repo=portfolioRepository(store);const api=createNetlifyApi({repository:repo,password});const call=(route,body,auth=true,method='POST')=>api(new Request('https://portfolio.example/api/'+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+password}:{})},...(body?{body:JSON.stringify(body)}:{})}));const initial=(await repo.read()).developments.length;
 assert.equal((await call('admin/login',{},false)).status,401);assert.equal((await call('admin/login',{})).status,200);assert.equal((await call('admin/import',{developments:[samples[0],{...samples[0],lat:90}]})).status,422);assert.equal((await repo.read()).developments.length,initial);
 assert.equal((await call('admin/import',{developments:[{...samples[0],name:'Netlify test',sample:false}]})).status,201);const item=(await portfolioRepository(store).read()).developments.find(d=>d.name==='Netlify test');assert.ok(item);assert.equal((await call('admin/developments/'+item.id,{...item,priceFrom:800000},true,'PUT')).status,200);assert.equal((await repo.read()).developments.find(d=>d.id===item.id).priceFrom,800000);assert.equal((await call('admin/developments/'+item.id,null,true,'DELETE')).status,200);assert.equal((await repo.read()).developments.length,initial);
 const response=await api(new Request('https://portfolio.example/.netlify/functions/api/developments'));assert.equal(response.status,200);assert.equal((await response.json()).length,initial);
 assert.equal((await call('admin/import',{developments:[]},true)).status,422);
});
test('admin is closed if the Netlify secret is not configured',async()=>{const api=createNetlifyApi({repository:portfolioRepository(memoryStore())});assert.equal((await api(new Request('https://portfolio.example/api/admin/login',{method:'POST'}))).status,503);});
test('Netlify refresh replaces website data and preserves manual entries',async()=>{const repo=portfolioRepository(memoryStore());await repo.update(s=>s.developments=[{...samples[0],id:'manual',sample:false}]);const raw={id:'website',city:'London',tenureType:['sale'],isNewDevelopment:true,title:'Website home',developmentHeadline:'Website home, Greenwich',postcode:'SE10',lat:51.48,lng:-.01,price:{minAmount:600000,currencyCode:'GBP'},rooms:{bedrooms:['1 Bed']},description:'London homes',images:[],amenities:[],videos:[],pageUrl:'/sale-development/home'};await refreshPortfolio(repo,[raw]);await refreshPortfolio(repo,[{...raw,price:{minAmount:700000,currencyCode:'GBP'}}]);const state=await repo.read();assert.equal(state.developments.length,2);assert.equal(state.developments.find(d=>d.id==='jll-website').priceFrom,700000);assert.equal(state.lastSync.imported,1);});
test('a newer stock snapshot merges into live data once and keeps staff changes',async()=>{
 const repo=portfolioRepository(memoryStore());
 const existing={...samples[0],sample:false,id:'jll-old',source:'JLL website'};
 const added={...samples[1],sample:false,id:'jll-new',source:'JLL website',priceFrom:0};
 const collection={id:'collection',developmentIds:[existing.id]};
 await repo.update(state=>{
  state.developments=[{...existing,priceFrom:650000,unitPrices:{1:700000},_manualFields:['priceFrom']}];
  state.collections=[collection];
  state.lastSync={syncedAt:'2026-10-26T10:00:00.000Z'};
 });
 const snapshot={developments:[{...existing,description:'Updated website description'},added],lastSync:{imported:2,skipped:[],syncedAt:'2026-11-16T10:00:00.000Z'}};
 const report=await applyStockSnapshot(repo,snapshot);
 assert.equal(report.conflicts,1);
 const state=await repo.read();
 assert.deepEqual(state.collections,[collection]);
 assert.equal(state.developments[0].id,existing.id);
 assert.equal(state.developments[0].description,'Updated website description');
 assert.equal(state.developments[0].priceFrom,650000);
 assert.deepEqual(state.developments[0].unitPrices,{1:700000});
 assert.equal(state.developments[1].priceFrom,0);
 assert.equal(await applyStockSnapshot(repo,snapshot),null);
 assert.deepEqual(await repo.read(),state);
});
