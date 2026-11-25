import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {recordStaff,touchStaff,activityReport,engagementService,reportRange} from './activity.mjs';
import {createNetlifyApi} from './netlify-api.mjs';import {samples} from './model.mjs';import {portfolioRepository} from './netlify-store.mjs';import {engagementRepository} from './engagement-store.mjs';
function memory(){let state={developments:structuredClone(samples)};return {read:async()=>structuredClone(state),update:async change=>{const next=structuredClone(state),result=change(next);state=next;return result;}};}
function daily(){const days=new Map();return {readDay:async date=>structuredClone(days.get(date)||{people:{}}),updateDay:async(date,change)=>{const next=structuredClone(days.get(date)||{people:{}});change(next);days.set(date,next);},days};}
function env(){const repository=memory(),visitors=daily(),secret=randomBytes(24).toString('hex'),api=createNetlifyApi({repository,visitorRepository:visitors,password:secret});async function call(path,body,actor,method=body?'POST':'GET',origin='https://portfolio.test'){const r=await api(new Request('https://portfolio.test/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})}));const data=await r.json();return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],csrf:data.csrf};}async function owner(){return await call('access/bootstrap',{setupSecret:secret,name:'Owner',email:'owner@example.test',password:randomBytes(18).toString('hex'),whatsapp:'+447900000001'});}async function broker(owner,role='broker'){const password=randomBytes(18).toString('hex'),email=role+'@example.test',invite=await call('admin/users/invite',{name:role,email,role},owner),a=await call('access/accept',{token:invite.data.token,email,password,whatsapp:'+447900000002'});return {...a,email,password};}return {repository,visitors,call,owner,broker};}
test('team reporting is admin-only; genuine successful sign-ins and actions are recorded without secrets',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner),manager=await e.broker(owner,'broker_admin');
 assert.equal((await e.call('admin/activity')).status,401);for(const actor of [broker,manager])assert.equal((await e.call('admin/activity',null,actor)).status,403);
 await e.call('access/login',{email:broker.email,password:'wrong'});const logged=await e.call('access/login',{email:broker.email,password:broker.password});assert.equal(logged.status,200);
 const created=await e.call('admin/collections',{title:'Featured map',developmentIds:[samples[0].id]},broker);assert.equal(created.status,201);
 const edited=await e.call('admin/collections/'+created.data.id,{title:'Updated map',developmentIds:[samples[1].id]},broker,'PUT');assert.equal(edited.status,200);
 assert.equal((await e.call('admin/activity',{event:'personal_link_copy',userId:owner.data.user.id},broker)).status,200);
 assert.equal((await e.call('admin/activity',{event:'collection_link_copy',collectionId:created.data.id},manager)).status,403);
 for(const event of ['collection_link_copy','collection_whatsapp_click','collection_email_click'])assert.equal((await e.call('admin/activity',{event,collectionId:created.data.id},broker)).status,200);
 assert.equal((await e.call('admin/activity',{event:'login',count:100},broker)).status,422);
 const r=(await e.call('admin/activity',null,owner)).data,row=r.rows.find(r=>r.id===broker.data.user.id);assert.equal(row.counts.login,2);assert.equal(row.counts.collection_create,1);assert.equal(row.counts.collection_update,1);assert.equal(row.counts.personal_link_copy,1);assert.equal(row.counts.collection_link_copy,1);assert.equal(row.counts.collection_whatsapp_click,1);assert.equal(row.counts.collection_email_click,1);assert.equal(row.activeCollections,1);assert.ok(row.lastLoginAt);assert.ok(row.lastActivityAt);
 const text=JSON.stringify(r);for(const secret of [broker.password,'passwordHash','tokenHash','jll_session','csrf','setupSecret'])assert.ok(!text.includes(secret));
 assert.equal((await e.call('admin/activity',{event:'personal_link_copy'},broker,'POST','https://evil.test')).status,403);
 await e.call('admin/collections/'+created.data.id,null,broker,'DELETE');const next=(await e.call('admin/activity',null,owner)).data.rows.find(r=>r.id===broker.data.user.id);assert.equal(next.counts.collection_delete,1);assert.equal(next.activeCollections,0);
});
test('stock audit records only successful authorized committed changes including bulk import and refresh',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner),manager=await e.broker(owner,'broker_admin');
 assert.equal((await e.call('admin/import',{developments:[{...samples[0],name:'Forbidden'}]},broker)).status,403);
 assert.equal((await e.call('admin/import',{developments:[{...samples[0],name:'Imported A'},{...samples[1],name:'Imported B'}]},manager)).status,201);
 assert.equal((await e.call('admin/import',{developments:[{...samples[0],name:'Imported A'}]},manager)).status,409);
 await e.call('admin/developments/'+samples[0].id,{...samples[0],priceFrom:555000},manager,'PUT');await e.call('admin/developments/'+samples[0].id,null,manager,'DELETE');
 const report=(await e.call('admin/activity',null,owner)).data,row=report.rows.find(r=>r.id===manager.data.user.id);assert.equal(row.counts.stock_add,2);assert.equal(row.counts.stock_edit,1);assert.equal(row.counts.stock_remove,1);assert.ok(!report.rows.find(r=>r.id===broker.data.user.id).counts.stock_add);
});
test('buyer collection attribution always uses the owner; anonymous collector stores only daily counts',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner),created=await e.call('admin/collections',{title:'Three homes',developmentIds:[samples[0].id]},broker),day=new Date().toISOString().slice(0,10);
 assert.equal((await e.call('activity',{events:[{event:'page_view'}]})).status,422);
 assert.equal((await e.call('activity',{consent:'accepted',events:[{event:'page_view'}]},null,'POST','https://evil.test')).status,403);
 const body={consent:'accepted',events:[{event:'page_view',collection:created.data.slug,broker:owner.data.user.shareSlug,email:'private@example.test',phone:'+447900000002',ip:'127.0.0.1',text:'private',ownerId:owner.data.user.id},{event:'favourite_add',collection:created.data.slug,development:samples[0].id},{event:'development_view',broker:broker.data.user.shareSlug,development:samples[0].id},{event:'whatsapp_click',broker:broker.data.user.shareSlug},{event:'page_view'}]};
 assert.equal((await e.call('activity',body)).status,200);const stored=await e.visitors.readDay(day);assert.deepEqual(stored,{
  people:{[broker.data.user.id]:{page_view:1,favourite_add:1,development_view:1,whatsapp_click:1},unattributed:{page_view:1}},
  links:{['collection:'+created.data.id]:{kind:'collection',resourceId:created.data.id,ownerId:broker.data.user.id,visits:1}},
 });
 assert.equal((await e.call('activity',{consent:'accepted',events:[{event:'login'}]})).status,422);assert.equal((await e.call('activity',{consent:'accepted',events:[{event:'favourite_add',broker:'nonexistent',development:samples[0].id},{event:'favourite_add',broker:broker.data.user.shareSlug,development:'nonexistent'}]})).status,200);assert.deepEqual(await e.visitors.readDay(day),stored);
 await e.call('admin/users/'+broker.data.user.id,{active:false},owner,'PATCH');await e.call('activity',{consent:'accepted',events:[{event:'page_view',collection:created.data.slug}]});assert.deepEqual(await e.visitors.readDay(day),stored);
 const report=(await e.call('admin/activity',null,owner)).data;assert.equal(report.rows.find(r=>r.id===broker.data.user.id).buyer.favourite_add,1);assert.equal(report.rows.find(r=>r.id===broker.data.user.id).savedCollections,1);assert.equal(report.rows.find(r=>r.id===broker.data.user.id).activeCollections,0);assert.equal(report.unattributed.page_view,1);
});
test('admin overview retains historical broker totals and adds link counts, trends and saved picks',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner),manager=await e.broker(owner,'broker_admin');
 const brokerId=broker.data.user.id,slug=broker.data.user.shareSlug,developmentId=samples[0].id;
 const overview='admin/activity?view=overview&days=7';
 assert.equal((await e.call(overview)).status,401);
 assert.equal((await e.call(overview,null,broker)).status,403);
 assert.equal((await e.call(overview,null,manager)).status,403);
 assert.equal((await e.call('admin/activity?view=overview&days=365',null,owner)).status,422);
 assert.equal((await e.call(overview,null,owner)).data.comparisonAvailable,false);
 const collection=await e.call('admin/collections',{title:'River views',developmentIds:[developmentId]},broker);
 const deleted=await e.call('admin/collections',{title:'Removed selection',developmentIds:[developmentId]},broker);
 const now=Date.now(),day=offset=>new Date(now-offset*86400000).toISOString().slice(0,10);
 await e.repository.update(state=>{
  recordStaff(state,broker.data.user,'login',{now:now-14*86400000});
  touchStaff(state,broker.data.user,now-86400000);
  state.brochures=[{ownerId:brokerId,fileKey:'private'}, {ownerId:brokerId,config:{clientName:'Private client'}}];
 });
 await e.visitors.updateDay(day(1),day=>{day.people[brokerId]={page_view:8};});
 await e.visitors.updateDay(day(9),day=>{day.people[brokerId]={page_view:3};});
 assert.equal((await e.call('activity',{consent:'accepted',events:[
  {event:'page_view',collection:collection.data.slug,broker:owner.data.user.shareSlug},
  {event:'page_view',collection:collection.data.slug},
  {event:'page_view',collection:deleted.data.slug},
  {event:'page_view',broker:slug},
  {event:'development_view',broker:slug,development:developmentId},
  {event:'favourite_add',broker:slug,development:developmentId},
  {event:'whatsapp_click',broker:slug},
  {event:'page_view'},
 ]})).status,200);
 assert.equal((await e.call('admin/collections/'+deleted.data.id,null,broker,'DELETE')).status,200);
 const result=await e.call(overview,null,owner);
 assert.equal(result.status,200);
 const report=result.data,row=report.staff.find(row=>row.id===brokerId);
 assert.equal(report.comparisonAvailable,true);
 assert.equal(report.buckets.length,7);
 assert.deepEqual([row.current.activeDays,row.current.signIns,row.current.collectionsCreated,row.current.visits],[2,1,2,12]);
 assert.deepEqual([row.current.developmentViews,row.current.favourites,row.current.whatsapp],[1,1,1]);
 assert.equal(row.previous.visits,3);
 assert.equal(row.series.at(-2).current.visits,8);
 assert.equal(row.series.at(-1).current.visits,4);
 assert.equal(row.savedPdfs,1);
 assert.equal(report.generalVisits,1);
 assert.deepEqual(report.links.map(({kind,visits})=>[kind,visits]),[['collection',2],['personal',1],['removed',1]]);
 assert.ok(report.links.every(link=>link.ownerId===brokerId));
 assert.deepEqual(report.collections,[{id:collection.data.id,title:'River views',ownerId:brokerId,developmentIds:[developmentId]}]);
 assert.deepEqual(report.developments.map(development=>development.id),[developmentId]);
 const serialised=JSON.stringify(report);
 for(const privateValue of [slug,broker.email,broker.password,'fileKey','clientName','tokenHash','shareSlug']){
  assert.ok(!serialised.includes(privateValue));
 }
});

test('date comparisons, role filters, inactivity and retained timelines are honest about existing accounts',async()=>{
 const now=Date.parse('2026-10-27T12:00:00Z'),old=now-40*86400000,recent=now-2*86400000,a={id:'a',name:'A',email:'a@example.test',role:'broker',active:true,createdAt:new Date(old).toISOString()},b={id:'b',name:'B',email:'b@example.test',role:'broker_admin',active:true,createdAt:new Date(old).toISOString()},c={...a,id:'c',active:false},state={users:[a,b,c],developments:[],collections:[{ownerId:'b'}]};
 recordStaff(state,a,'login',{now:old});recordStaff(state,b,'login',{now:recent});recordStaff(state,b,'collection_create',{now:recent});touchStaff(state,b,now);const visitors=daily();await visitors.updateDay('2026-09-17',d=>{d.people={a:{page_view:3}};});await visitors.updateDay('2026-10-25',d=>{d.people={b:{page_view:5,favourite_add:2}};});
 const r=await activityReport(state,visitors,new URLSearchParams({from:'2026-10-01',to:'2026-10-27'}),{now});assert.equal(r.rows[0].inactive,true);assert.equal(r.rows[1].inactive,false);assert.equal(r.rows[2].inactive,false);assert.equal(r.rows[0].previous.login,1);assert.equal(r.rows[1].counts.login,1);assert.equal(r.rows[0].previousBuyer.page_view,3);assert.equal(r.rows[1].buyer.page_view,5);assert.equal(r.rows[1].activeCollections,1);assert.equal(r.rows[2].lastLoginAt,null);assert.equal(r.timelineTotal,2);
 const filtered=await activityReport(state,visitors,new URLSearchParams({role:'broker_admin'}),{now});assert.equal(filtered.rows.length,1);assert.equal(filtered.rows[0].id,'b');assert.equal(filtered.totals.buyer.page_view,5);assert.equal(filtered.timeline.length,2);
 assert.throws(()=>reportRange(new URLSearchParams({from:'2026-02-30',to:'2026-10-27'}),now));assert.throws(()=>reportRange(new URLSearchParams({from:'2026-10-28',to:'2026-10-28'}),now));assert.throws(()=>reportRange(new URLSearchParams({from:'2026-01-01',to:'2026-10-27'}),now));
 for(let i=0;i<5001;i++)recordStaff(state,b,'personal_link_copy',{now});assert.equal(state.activity.timeline.length,5000);assert.equal(state.activity.people.b.counts.personal_link_copy,5001);
 const exported=await activityReport(state,visitors,new URLSearchParams({user:'b',export:'timeline'}),{now});assert.equal(exported.timeline.length,5000);const paged=await activityReport(state,visitors,new URLSearchParams({user:'b',page:'1'}),{now});assert.equal(paged.timeline.length,100);assert.notEqual(paged.timeline[0].id,exported.timeline[0].id);
});
test('heartbeat is throttled, CSRF protected and never fabricates a sign-in',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner);const before=await e.repository.read();await e.call('admin/heartbeat',{},broker);const after=await e.repository.read();assert.deepEqual(after.activity,before.activity);assert.equal((await e.call('admin/heartbeat',{})).status,401);
 await e.repository.update(s=>{s.activity.people[broker.data.user.id].lastActivityAt='2020-01-01T00:00:00Z';});await e.call('admin/heartbeat',{},broker);const state=await e.repository.read();assert.equal(state.activity.people[broker.data.user.id].counts.login,1);assert.ok(state.activity.people[broker.data.user.id].lastActivityAt>'2020');
});
test('audit counters are transactionally retried and daily engagement uses conditional writes',async()=>{
 let state=null,etag=0,reject=true;const store={getWithMetadata:async()=>state?{data:structuredClone(state),etag:String(etag)}:null,setJSON:async(key,next,condition)=>{if(reject){reject=false;return {modified:false};}if(state&&condition.onlyIfMatch!==String(etag))return {modified:false};state=structuredClone(next);etag++;return {modified:true};},get:async()=>structuredClone(state)};
 const repo=portfolioRepository(store);await repo.update(s=>recordStaff(s,{id:'staff',role:'broker'},'login'));assert.equal((await repo.read()).activity.people.staff.counts.login,1);assert.equal((await repo.read()).activity.timeline.length,1);
 state=null;etag=0;reject=true;const visitor=engagementRepository(store);await visitor.updateDay('2026-10-27',d=>{d.people.x={page_view:(d.people.x?.page_view||0)+1};});assert.equal((await visitor.readDay('2026-10-27')).people.x.page_view,1);
});
test('report authorization is rechecked against the latest account and session',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner,'broker_admin');await e.call('admin/users/'+broker.data.user.id,{role:'admin'},owner,'PATCH');const signed=await e.call('access/login',{email:broker.email,password:broker.password});assert.equal((await e.call('admin/activity',null,signed)).status,200);await e.call('admin/users/'+broker.data.user.id,{role:'broker'},owner,'PATCH');assert.equal((await e.call('admin/activity',null,signed)).status,401);
});

test('engagement retention prunes only expired daily keys across all storage pages',async()=>{const removed=[];const store={async *list(){yield {blobs:[{key:'2025-01-01'},{key:'2025-09-23'},{key:'configuration'}]};yield {blobs:[{key:'2024-01-01'},{key:'2026-10-27'}]};},delete:async key=>{removed.push(key);}};await engagementRepository(store).prune('2025-09-23');assert.deepEqual(removed,['2025-01-01','2024-01-01']);});

test('consented buyer activity initializes coverage before an existing staff account next signs in',async()=>{const e=env(),owner=await e.owner();await e.repository.update(s=>{delete s.activity;});const before=Date.now();assert.equal((await e.call('activity',{consent:'accepted',events:[{event:'page_view',broker:owner.data.user.shareSlug}]})).status,200);const state=await e.repository.read();assert.ok(Date.parse(state.activity.startedAt)>=before);assert.deepEqual(state.activity.people,{});assert.equal(state.activity.timeline.length,0);const report=(await e.call('admin/activity',null,owner)).data;assert.equal(report.rows[0].buyer.page_view,1);assert.equal(report.rows[0].lastLoginAt,null);assert.equal(report.rows[0].counts.login,undefined);});

test('an older valid session is shown separately from recorded sign-ins and page reloads never fabricate logins',async()=>{
 const e=env(),owner=await e.owner(),broker=await e.broker(owner);
 // Simulate an account already signed in when reporting was introduced.
 await e.repository.update(s=>{delete s.activity;for(const session of s.sessions)delete session.createdAt;});
 for(let i=0;i<2;i++)assert.equal((await e.call('access/me',null,broker)).status,200);
 assert.equal((await e.call('admin/heartbeat',{},broker)).status,200);
 let report=(await e.call('admin/activity',null,owner)).data,row=report.rows.find(r=>r.id===broker.data.user.id);
 assert.equal(row.activeSessions,1);assert.equal(row.counts.login,undefined);assert.equal(row.lastLoginAt,null);assert.ok(row.lastActivityAt);assert.equal(report.timeline.filter(e=>e.event==='login').length,0);
 const signed=await e.call('access/login',{email:broker.email,password:broker.password});assert.equal(signed.status,200);
 const state=await e.repository.read();assert.ok(state.sessions.some(s=>s.userId===broker.data.user.id&&s.createdAt));
 assert.equal((await e.call('access/me',null,signed)).status,200);
 report=(await e.call('admin/activity',null,owner)).data;row=report.rows.find(r=>r.id===broker.data.user.id);
 assert.equal(row.activeSessions,2);assert.equal(row.counts.login,1);assert.ok(row.lastLoginAt);assert.equal(row.lifetime.login,1);assert.equal(report.timeline.filter(e=>e.userId===broker.data.user.id&&e.event==='login').length,1);
 await e.call('access/logout',{},broker);await e.call('access/logout',{},signed);
 await e.repository.update(s=>s.sessions.push({userId:broker.data.user.id,tokenHash:'expired-test-session',expiresAt:Date.now()-1}));
 row=(await e.call('admin/activity',null,owner)).data.rows.find(r=>r.id===broker.data.user.id);
 assert.equal(row.activeSessions,0);assert.equal(row.counts.login,1);assert.equal(row.lifetime.login,1);
});
