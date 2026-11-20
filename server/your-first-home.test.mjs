import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import seed from './data/initial-portfolio.json' with {type:'json'};
import {createNetlifyApi} from './netlify-api.mjs';
import {yourFirstHomeCandidates,yourFirstHomeCollection,yourFirstHomeWorkspace} from './your-first-home.mjs';
import {YOUR_FIRST_HOME_SLUG,yourFirstHomeCaps,yourFirstHomeIllustration} from '../shared/your-first-home.ts';

function environment(){
 let state=structuredClone(seed);const secret=randomBytes(24).toString('hex');
 const repository={read:async()=>structuredClone(state),update:async fn=>{const next=structuredClone(state),result=fn(next);state=next;return result;}};
 const api=createNetlifyApi({repository,password:secret});
 async function call(path,{actor,method='GET',body,cookie,csrf=true}={}){
  const headers={'Content-Type':'application/json',Origin:'https://portfolio.example'};
  if(actor||cookie)headers.Cookie=[actor?.cookie,cookie].filter(Boolean).join('; ');
  if(actor&&csrf)headers['X-CSRF-Token']=actor.csrf;
  const response=await api(new Request('https://portfolio.example/api/'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function owner(){const r=await call('access/bootstrap',{method:'POST',body:{setupSecret:secret,name:'Owner',email:'owner@example.test',whatsapp:'+447900000001',password:randomBytes(18).toString('hex')}});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.data.csrf,user:r.data.user};}
 async function broker(admin,role='broker'){const email=role+'@example.test';const invite=await call('admin/users/invite',{method:'POST',actor:admin,body:{name:role,email,role}});assert.equal(invite.status,201);const r=await call('access/accept',{method:'POST',body:{token:invite.data.token,email,whatsapp:'+447900000002',password:randomBytes(18).toString('hex')}});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.data.csrf,user:r.data.user};}
 return {repository,call,owner,broker};
}
const buyerPath='buyer/portfolio?collection='+YOUR_FIRST_HOME_SLUG;
const settingsPath='admin/your-first-home';
const settingsBody=data=>({version:data.version,developmentIds:data.developmentIds,whatsapp:data.whatsapp});

test('candidate selection uses verified local authorities and current prices without modifying stock',()=>{
 const state=structuredClone(seed),before=structuredClone(state);
 const rows=yourFirstHomeCandidates(state),ids=yourFirstHomeCollection(state).developmentIds;
 assert.ok(ids.length>14);assert.ok(ids.every(id=>rows.some(row=>row.id===id&&row.withinCap)));
 assert.equal(rows.find(row=>row.name==='Royal Gateway').priceCap,500000);
 assert.equal(rows.find(row=>row.name==='Upper East').priceCap,650000);
 assert.equal(rows.find(row=>row.name==='The Exchange, Watford').priceCap,420000);
 assert.ok(!ids.includes(rows.find(row=>row.name==='The Lanes').id));
 assert.deepEqual(state,before);
 const upper=state.developments.find(d=>d.name==='Upper East');upper.priceFrom=700000;
 assert.ok(!yourFirstHomeCollection(state).developmentIds.includes(upper.id));
 upper.unitPrices={'1':400000};assert.ok(yourFirstHomeCollection(state).developmentIds.includes(upper.id));
 assert.equal(upper.unitPrices['1'],400000);
});

test('public campaign is shared, preserves its old link and returns only potential homes with the team WhatsApp',async()=>{
 const e=environment(),admin=await e.owner();
 await e.repository.update(state=>{state.collections=[{id:'legacy-campaign',slug:YOUR_FIRST_HOME_SLUG,ownerId:admin.user.id,title:'Old collection',developmentIds:state.developments.map(d=>d.id)}];state.users[0].active=false;});
 const result=await e.call(buyerPath);assert.equal(result.status,200);assert.equal(result.data.collectionOnly,true);
 assert.equal(result.data.collection.campaign,'your-first-home');assert.equal(result.data.collection.slug,YOUR_FIRST_HOME_SLUG);
 assert.equal(result.data.broker.whatsapp,'447354821292');assert.equal(result.data.broker.name,'Your First Home team');
 assert.ok(result.data.developments.length>0&&result.data.developments.length<seed.developments.length);
 assert.deepEqual(result.data.developments.map(d=>d.id).sort(),result.data.collection.developmentIds.toSorted());
 assert.ok(result.data.developments.every(d=>d.yourFirstHome?.priceCap>0));
 assert.equal('version' in result.data.collection,false);assert.equal('ownerId' in result.data.collection,false);
 assert.equal((await e.call('buyer/portfolio?collection=your-first-home')).data.developments.length,result.data.developments.length);
 assert.equal((await e.call('developments')).data.length,seed.developments.length);
});

test('all staff can share, only admins and broker admins can save, and revisions prevent lost updates',async()=>{
 const e=environment(),admin=await e.owner(),broker=await e.broker(admin),manager=await e.broker(admin,'broker_admin');
 assert.equal((await e.call(settingsPath)).status,401);
 const saved=(await e.call(settingsPath,{actor:broker})).data;assert.equal(saved.canManage,false);
 assert.equal((await e.call(settingsPath,{actor:broker,method:'PUT',body:settingsBody(saved)})).status,403);
 assert.equal((await e.call(settingsPath,{actor:manager,method:'PUT',body:settingsBody(saved),csrf:false})).status,403);
 const updated=await e.call(settingsPath,{actor:manager,method:'PUT',body:{...settingsBody(saved),whatsapp:'07354 821292'}});
 assert.equal(updated.status,200);assert.equal(updated.data.whatsapp,'447354821292');assert.equal(updated.data.version,1);
 assert.equal((await e.call(settingsPath,{actor:admin,method:'PUT',body:settingsBody(saved)})).status,409);
 assert.equal((await e.call('admin/your-first-home/share',{actor:broker,method:'POST',body:{}})).status,200);
 assert.equal((await e.call(settingsPath,{actor:admin,method:'PUT',body:{...settingsBody(updated.data),developmentIds:['missing']}})).status,422);
 assert.equal((await e.call(settingsPath,{actor:broker})).data.version,1);
});

test('an empty or newly over-cap selection never exposes the rest of the portfolio through any buyer endpoint',async()=>{
 const e=environment(),admin=await e.owner(),settings=(await e.call(settingsPath,{actor:admin})).data;
 const id=settings.developmentIds[0];
 assert.equal((await e.call(settingsPath,{actor:admin,method:'PUT',body:{...settingsBody(settings),developmentIds:[id]}})).status,200);
 await e.repository.update(state=>{const d=state.developments.find(d=>d.id===id);d.priceFrom=900000;d.unitPrices={};});
 assert.deepEqual((await e.call(buyerPath)).data.developments,[]);
 assert.deepEqual((await e.call('developments?collection='+YOUR_FIRST_HOME_SLUG)).data,[]);
 assert.equal((await e.call('connections/'+id+'?collection='+YOUR_FIRST_HOME_SLUG)).status,404);
 const latest=(await e.call(settingsPath,{actor:admin})).data;
 assert.equal((await e.call(settingsPath,{actor:admin,method:'PUT',body:{...settingsBody(latest),developmentIds:[]}})).status,200);
 assert.deepEqual((await e.call(buyerPath)).data.collection.developmentIds,[]);
 assert.equal((await e.call('developments')).data.length,seed.developments.length);
});

test('shared collection passwords, rotation and the portfolio gate remain enforced',async()=>{
 const e=environment(),admin=await e.owner(),broker=await e.broker(admin),manager=await e.broker(admin,'broker_admin');
 const original=(await e.call(settingsPath,{actor:admin})).data;
 const protectedResult=await e.call(settingsPath,{actor:manager,method:'PUT',body:{...settingsBody(original),passwordAction:'protect'}});
 assert.equal(protectedResult.status,200);const password=protectedResult.data.password;assert.ok(password);
 assert.equal((await e.call(buyerPath)).status,423);
 assert.equal((await e.call(settingsPath,{actor:broker})).data.password,password);
 const unlocked=await e.call('buyer/unlock?collection='+YOUR_FIRST_HOME_SLUG,{method:'POST',body:{password}});assert.equal(unlocked.status,200);
 assert.equal((await e.call(buyerPath,{cookie:unlocked.cookie})).status,200);
 const rotation=await e.call(settingsPath,{actor:manager,method:'PUT',body:{...settingsBody(protectedResult.data),passwordAction:'rotate'}});
 assert.equal(rotation.status,200);assert.notEqual(rotation.data.password,password);
 assert.equal((await e.call(buyerPath,{cookie:unlocked.cookie})).status,423);
 assert.equal((await e.call('admin/buyer-access',{actor:admin,method:'PUT',body:{enabled:true}})).status,200);
 const now=(await e.call(settingsPath,{actor:admin})).data;
 assert.equal((await e.call(settingsPath,{actor:admin,method:'PUT',body:{...settingsBody(now),passwordAction:'remove'}})).status,200);
 assert.equal((await e.call(buyerPath)).status,423);
 const mine=(await e.call(settingsPath,{actor:broker})).data.password;assert.ok(mine);
 const fullUnlock=await e.call('buyer/unlock?collection='+YOUR_FIRST_HOME_SLUG,{method:'POST',body:{password:mine}});assert.equal(fullUnlock.status,200);
 assert.equal((await e.call(buyerPath,{cookie:fullUnlock.cookie})).status,200);
 assert.equal((await e.call(buyerPath,{cookie:fullUnlock.cookie})).data.collectionOnly,true);
});

test('calculator matches the government illustration and rejects invalid inputs',()=>{
 const n=yourFirstHomeIllustration(300000);assert.equal(n.deposit,7500);assert.equal(n.equityLoan,60000);assert.equal(n.mortgage,232500);
 assert.equal(Math.round(n.monthlyMortgage),1248);assert.equal(Math.round(n.yearSix),1323);assert.equal(Math.round(n.yearSeven),1398);
 assert.equal(yourFirstHomeIllustration(400000,5).deposit,20000);
 assert.equal(yourFirstHomeIllustration(300000,2.5,0).monthlyMortgage,232500/360);
 for(const price of [NaN,Infinity,0,-1,2000001])assert.equal(yourFirstHomeIllustration(price),null);
 assert.equal(yourFirstHomeIllustration(300000,1),null);assert.equal(yourFirstHomeIllustration(300000,80),null);
 assert.equal(yourFirstHomeCaps.Haringey,500000);
});
