import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {createNetlifyApi} from './netlify-api.mjs';import {accessService,digest} from './access.mjs';import {samples} from './model.mjs';
function environment(config={}){let state={developments:structuredClone(samples),lastSync:null};const secret=randomBytes(24).toString('hex');const repository={read:async()=>structuredClone(state),update:async fn=>{const next=structuredClone(state);const result=fn(next);state=next;return result;}};const api=createNetlifyApi({repository,password:secret,...config});
 async function call(path,{body,method='GET',actor,origin='https://portfolio.example',csrf=true}={}){const r=await api(new Request('https://portfolio.example/api/'+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(actor?{Cookie:actor.cookie,...(csrf?{'X-CSRF-Token':actor.csrf}:{})}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}));const data=await r.json();return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
 async function owner(){const r=await call('access/bootstrap',{method:'POST',body:{setupSecret:secret,name:'Owner',email:'owner@example.test',whatsapp:'+447900000001',password:randomBytes(18).toString('hex')}});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.data.csrf,user:r.data.user};}
 async function broker(admin,email='broker@example.test',role='broker'){const invited=await call('admin/users/invite',{method:'POST',actor:admin,body:{name:'Broker',email,role}});assert.equal(invited.status,201);const password=randomBytes(18).toString('hex');const accepted=await call('access/accept',{method:'POST',body:{token:invited.data.token,email,whatsapp:'+447900000002',password,role:'admin'}});assert.equal(accepted.status,200);return {cookie:accepted.cookie,csrf:accepted.data.csrf,user:accepted.data.user,password,email,invited};}
 return {call,owner,broker,repository,secret};}
test('owner setup needs the server secret, is one-time, and shared-secret access stops after setup',async()=>{const e=environment();assert.equal((await e.call('access/bootstrap',{method:'POST',body:{setupSecret:'wrong'}})).status,401);const admin=await e.owner();assert.equal(admin.user.role,'admin');assert.equal((await e.call('access/bootstrap',{method:'POST',body:{setupSecret:e.secret,name:'Other',email:'other@example.test',password:randomBytes(18).toString('hex')}})).status,409);const legacyApi=createNetlifyApi({repository:e.repository,password:e.secret});const r=await legacyApi(new Request('https://portfolio.example/api/admin/users',{headers:{Authorization:'Bearer '+e.secret}}));assert.equal(r.status,401);});
test('staff sessions are HttpOnly, Secure, same-site, CSRF protected and revoked on logout',async()=>{const e=environment();const admin=await e.owner();const status=await e.call('access/me',{actor:admin});assert.equal(status.status,200);assert.equal(status.data.user.email,'owner@example.test');assert.equal('token' in status.data,false);assert.equal((await e.call('admin/collections',{method:'POST',actor:admin,csrf:false,body:{title:'Homes',developmentIds:[samples[0].id]}})).status,403);assert.equal((await e.call('admin/collections',{method:'POST',actor:admin,origin:'https://evil.example',body:{title:'Homes',developmentIds:[samples[0].id]}})).status,403);const logout=await e.call('access/logout',{method:'POST',actor:admin});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/HttpOnly/);assert.match(logout.headers.get('set-cookie'),/Secure/);assert.match(logout.headers.get('set-cookie'),/SameSite=Strict/);assert.equal((await e.call('access/me',{actor:admin})).status,401);});
test('regular brokers cannot change stock, sync, extract, manage staff or assign elevated roles',async()=>{
 const e=environment(),admin=await e.owner(),broker=await e.broker(admin);assert.equal(broker.user.role,'broker');
 assert.equal((await e.call('admin/users',{actor:broker})).status,403);assert.equal((await e.call('admin/invites',{actor:broker})).status,200);
 for(const [path,body,method]of [['admin/sync',{},'POST'],['admin/extract',{url:'https://example.com/home'},'POST'],['admin/import',{developments:[samples[0]]},'POST'],['admin/developments/'+samples[0].id,samples[0],'PUT'],['admin/developments/'+samples[0].id,undefined,'DELETE'],['admin/users/'+admin.user.id,{role:'admin'},'PATCH']])assert.equal((await e.call(path,{method,actor:broker,body})).status,403);
 assert.ok((await e.call('admin/developments',{actor:broker})).data.every(d=>!d.canEdit));
 for(const role of ['admin','broker_admin'])assert.equal((await e.call('admin/users/invite',{method:'POST',actor:broker,body:{name:'Escalation',email:'elevated@example.test',role}})).status,403);
 assert.equal((await e.call('admin/users/invite',{method:'POST',actor:broker,body:{name:'Reset owner',email:'owner@example.test',role:'broker'}})).status,403);
 const invitation=await e.call('admin/users/invite',{method:'POST',actor:broker,body:{name:'New broker',email:'newbroker@example.test',role:'broker'}});assert.equal(invitation.status,201);
 const accepted=await e.call('access/accept',{method:'POST',body:{token:invitation.data.token,email:'newbroker@example.test',whatsapp:'+447900000003',password:randomBytes(18).toString('hex'),role:'admin'}});assert.equal(accepted.status,200);assert.equal(accepted.data.user.role,'broker');
 assert.ok((await e.call('developments')).data.every(d=>!('createdBy' in d)));
});
test('broker admins manage shared stock but cannot administer accounts or other brokers collections',async()=>{
 const e=environment(),admin=await e.owner(),manager=await e.broker(admin,'manager@example.test','broker_admin'),broker=await e.broker(admin);
 assert.equal(manager.user.role,'broker_admin');assert.ok((await e.call('admin/developments',{actor:manager})).data.every(d=>d.canEdit));
 assert.equal((await e.call('admin/import',{method:'POST',actor:manager,body:{developments:[{...samples[0],name:'New stock'}]}})).status,201);
 assert.equal((await e.call('admin/developments/'+samples[0].id,{method:'PUT',actor:manager,body:{...samples[0],priceFrom:800000}})).status,200);
 assert.equal((await e.call('admin/developments/'+samples[0].id,{method:'DELETE',actor:manager})).status,200);
 assert.equal((await e.call('admin/users',{actor:manager})).status,403);assert.equal((await e.call('admin/users/'+broker.user.id,{method:'PATCH',actor:manager,body:{role:'broker_admin'}})).status,403);
 const collection=await e.call('admin/collections',{method:'POST',actor:broker,body:{title:'Private staff collection',developmentIds:[samples[1].id]}});
 assert.equal((await e.call('admin/collections/'+collection.data.id,{method:'DELETE',actor:manager})).status,403);
});
test('non-admin invitations cannot replace pending invitations and fail when their issuer loses access',async()=>{
 const e=environment(),admin=await e.owner(),a=await e.broker(admin),b=await e.broker(admin,'b@example.test');
 const pending=await e.call('admin/users/invite',{method:'POST',actor:admin,body:{name:'Marketing',email:'marketing@example.test',role:'admin'}});
 assert.equal((await e.call('admin/users/invite',{method:'POST',actor:a,body:{name:'Hijack',email:'marketing@example.test',role:'broker'}})).status,403);
 assert.equal((await e.call('admin/invites/'+pending.data.id,{method:'DELETE',actor:a})).status,403);
 assert.equal((await e.call('admin/invites',{actor:a})).data.length,0);
 const own=await e.call('admin/users/invite',{method:'POST',actor:a,body:{name:'Colleague',email:'colleague@example.test',role:'broker'}});
 assert.equal((await e.call('admin/invites/'+own.data.id,{method:'DELETE',actor:b})).status,403);
 await e.call('admin/users/'+a.user.id,{method:'PATCH',actor:admin,body:{active:false}});
 assert.equal((await e.call('access/accept',{method:'POST',body:{token:own.data.token,password:randomBytes(18).toString('hex')}})).status,410);await e.call('admin/users/'+a.user.id,{method:'PATCH',actor:admin,body:{active:true}});assert.equal((await e.call('access/accept',{method:'POST',body:{token:own.data.token,password:randomBytes(18).toString('hex')}})).status,410);
});
test('collections enforce ownership, validate stock, and expose only buyer-safe metadata',async()=>{const e=environment(),admin=await e.owner(),a=await e.broker(admin),b=await e.broker(admin,'other@example.test');const ids=samples.slice(0,3).map(d=>d.id);const created=await e.call('admin/collections',{method:'POST',actor:a,body:{title:'Three homes',developmentIds:ids,ownerId:admin.user.id}});assert.equal(created.status,201);assert.equal(created.data.ownerId,a.user.id);assert.equal((await e.call('admin/collections/'+created.data.id,{method:'PUT',actor:b,body:{title:'Hijacked',developmentIds:ids}})).status,403);assert.equal((await e.call('admin/collections/'+created.data.id,{method:'DELETE',actor:b})).status,403);assert.equal((await e.call('admin/collections',{method:'POST',actor:a,body:{title:'Missing',developmentIds:['does-not-exist']}})).status,422);const shared=await e.call('collections/'+created.data.slug);assert.equal(shared.status,200);assert.deepEqual(shared.data.developmentIds,ids);assert.equal(shared.data.brokerName,a.user.name);assert.equal('email' in shared.data,false);assert.equal('ownerId' in shared.data,false);assert.equal((await e.call('admin/collections',{actor:b})).data.length,0);await e.call('admin/users/'+a.user.id,{method:'PATCH',actor:admin,body:{active:false}});assert.equal((await e.call('collections/'+created.data.slug)).status,404);assert.equal((await e.call('access/me',{actor:a})).status,401);});
test('admin role changes revoke existing sessions and the last active admin cannot be removed',async()=>{const e=environment(),admin=await e.owner();assert.equal((await e.call('admin/users/'+admin.user.id,{method:'PATCH',actor:admin,body:{role:'broker'}})).status,422);assert.equal((await e.call('admin/users/'+admin.user.id,{method:'PATCH',actor:admin,body:{active:false}})).status,422);const broker=await e.broker(admin);assert.equal((await e.call('admin/users/'+broker.user.id,{method:'PATCH',actor:admin,body:{role:'admin'}})).status,200);assert.equal((await e.call('admin/users',{actor:broker})).status,401);const logged=await e.call('access/login',{method:'POST',body:{email:broker.email,password:broker.password}});assert.equal(logged.status,200);assert.equal(logged.data.user.role,'admin');assert.match(logged.headers.get('set-cookie'),/HttpOnly/);});
test('invitations are single-use, revocable, and never expose hashes or passwords',async()=>{const e=environment(),admin=await e.owner(),broker=await e.broker(admin);assert.equal((await e.call('access/accept',{method:'POST',body:{token:broker.invited.data.token,password:randomBytes(18).toString('hex')}})).status,410);const invitation=await e.call('admin/users/invite',{method:'POST',actor:admin,body:{name:'Pending',email:'pending@example.test',role:'broker'}});const pending=(await e.call('admin/invites',{actor:admin})).data;assert.equal(pending.length,1);assert.equal('tokenHash' in pending[0],false);assert.equal('token' in pending[0],false);await e.call('admin/invites/'+invitation.data.id,{method:'DELETE',actor:admin});assert.equal((await e.call('access/accept',{method:'POST',body:{token:invitation.data.token,password:randomBytes(18).toString('hex')}})).status,410);const users=(await e.call('admin/users',{actor:admin})).data;assert.ok(users.every(u=>!('passwordHash' in u)));const state=await e.repository.read();assert.ok(state.users.every(u=>u.passwordHash.startsWith('scrypt-v1:')));assert.ok(state.sessions.every(s=>typeof s.tokenHash==='string'&&!('token' in s)));});
test('login failures lock the account temporarily and invalid tokens do not grant access',async()=>{const e=environment(),admin=await e.owner(),broker=await e.broker(admin);for(let i=0;i<5;i++)assert.equal((await e.call('access/login',{method:'POST',body:{email:broker.email,password:'wrong'}})).status,401);assert.equal((await e.call('access/login',{method:'POST',body:{email:broker.email,password:broker.password}})).status,429);assert.equal((await e.call('access/me',{actor:{cookie:'jll_session=forged',csrf:'forged'}})).status,401);});
test('expired invitations fail and stale actor permissions are rechecked during writes',async()=>{const e=environment(),admin=await e.owner();let time=Date.now();const access=accessService(e.repository,e.secret,{now:()=>time});const request=new Request('https://portfolio.example/api/admin/users',{headers:{Cookie:admin.cookie}});const actor=await access.authenticate(request);const invited=await access.invite(actor,{name:'Expiry',email:'expires@example.test',role:'broker'});time+=8*24*3600000;await assert.rejects(access.accept({token:invited.token,password:randomBytes(18).toString('hex')}),/invalid or expired/);const s=await e.repository.read();await e.repository.update(state=>{state.sessions=[];});await assert.rejects(access.saveCollection(actor,{title:'Stale',developmentIds:[samples[0].id]}),/session has ended/);assert.equal(s.collections?.length||0,0);});

test('website extraction creates only a review draft and publishing requires explicit confirmation',async()=>{
 const draft={...samples[0],name:'External reviewed property',_requiresReview:true};const e=environment({extract:async()=>draft}),admin=await e.owner();const before=(await e.call('developments')).data.length;
 const extracted=await e.call('admin/extract',{method:'POST',actor:admin,body:{url:'https://developer.com/home'}});assert.equal(extracted.status,200);assert.equal(extracted.data.development._requiresReview,true);assert.equal((await e.call('developments')).data.length,before);
 assert.equal((await e.call('admin/import',{method:'POST',actor:admin,body:{developments:[extracted.data.development]}})).status,422);assert.equal((await e.call('developments')).data.length,before);
 assert.equal((await e.call('admin/import',{method:'POST',actor:admin,body:{developments:[{...extracted.data.development,_reviewConfirmed:true}]}})).status,201);assert.equal((await e.call('developments')).data.length,before+1);
});
test('activation requires the invited email and international WhatsApp number',async()=>{
 const e=environment(),admin=await e.owner();const invitation=await e.call('admin/users/invite',{method:'POST',actor:admin,body:{name:'Phone test',email:'phone@example.test',role:'broker'}});const body={token:invitation.data.token,email:'phone@example.test',password:randomBytes(18).toString('hex')};
 assert.equal((await e.call('access/accept',{method:'POST',body})).status,422);assert.equal((await e.call('access/accept',{method:'POST',body:{...body,email:'wrong@example.test',whatsapp:'+447900000002'}})).status,422);
 const accepted=await e.call('access/accept',{method:'POST',body:{...body,whatsapp:'+44 7900 000002'}});assert.equal(accepted.status,200);assert.equal(accepted.data.user.whatsapp,'+447900000002');assert.ok(accepted.data.user.shareSlug);
});
test('personal and collection links keep the owning broker, expose no email and revoke disabled users',async()=>{
 const e=environment(),admin=await e.owner(),a=await e.broker(admin),b=await e.broker(admin,'second@example.test');
 const card=await e.call('brokers/'+a.user.shareSlug);assert.equal(card.status,200);assert.equal(card.data.whatsapp,a.user.whatsapp);assert.equal('email' in card.data,false);assert.equal('id' in card.data,false);
 const collection=await e.call('admin/collections',{method:'POST',actor:a,body:{title:'My homes',developmentIds:[samples[0].id]}});
 const shared=await e.call('collections/'+collection.data.slug);assert.equal(shared.data.broker.slug,a.user.shareSlug);assert.notEqual(shared.data.broker.slug,b.user.shareSlug);
 const changed=await e.call('admin/profile',{method:'POST',actor:a,body:{whatsapp:'+447900000009',id:b.user.id,role:'admin'}});assert.equal(changed.status,200);assert.equal(changed.data.role,'broker');assert.equal((await e.call('brokers/'+a.user.shareSlug)).data.whatsapp,'+447900000009');assert.equal((await e.call('access/me',{actor:b})).data.user.whatsapp,b.user.whatsapp);
 await e.call('admin/users/'+a.user.id,{method:'PATCH',actor:admin,body:{active:false}});assert.equal((await e.call('brokers/'+a.user.shareSlug)).status,404);assert.equal((await e.call('collections/'+collection.data.slug)).status,404);assert.equal((await e.call('brokers/unknown')).status,404);
});
test('drafts stay private, survive saves, enforce ownership and never add published stock',async()=>{
 const e=environment(),admin=await e.owner(),manager=await e.broker(admin,'manager@example.test','broker_admin'),broker=await e.broker(admin);
 const before=(await e.call('developments')).data.length;assert.equal((await e.call('admin/drafts',{actor:broker})).status,403);
 const created=await e.call('admin/drafts',{method:'POST',actor:manager,body:{name:'Incomplete',data:{name:'Incomplete',lat:null}}});assert.equal(created.status,201);assert.equal((await e.call('developments')).data.length,before);
 assert.equal((await e.call('admin/drafts',{actor:manager})).data.length,1);assert.equal((await e.call('admin/drafts',{actor:admin})).data.length,1);
 const other=await e.broker(admin,'othermanager@example.test','broker_admin');assert.equal((await e.call('admin/drafts',{actor:other})).data.length,0);assert.equal((await e.call('admin/drafts/'+created.data.id,{method:'DELETE',actor:other})).status,403);
 assert.equal((await e.call('admin/drafts/'+created.data.id,{method:'DELETE',actor:manager})).status,200);
});
test('duplicate names are rejected atomically and reviewed updates keep stable development IDs',async()=>{
 const e=environment(),admin=await e.owner();const before=(await e.call('developments')).data.length;
 const duplicate=await e.call('admin/import',{method:'POST',actor:admin,body:{developments:[{...samples[0],name:'Unique first'},samples[0]]}});assert.equal(duplicate.status,409);assert.equal(duplicate.data.duplicateId,samples[0].id);assert.equal((await e.call('developments')).data.length,before);
 const update=await e.call('admin/developments/'+samples[0].id,{method:'PUT',actor:admin,body:{...samples[0],priceFrom:700000}});assert.equal(update.status,200);assert.equal((await e.call('developments')).data.find(d=>d.id===samples[0].id).priceFrom,700000);
});
test('only admins can configure analytics and public configuration exposes no private state',async()=>{const e=environment(),admin=await e.owner(),broker=await e.broker(admin),manager=await e.broker(admin,'analytics-manager@example.test','broker_admin');assert.deepEqual((await e.call('analytics-config')).data,{enabled:false,measurementId:'',teamTracking:true});for(const actor of [broker,manager]){assert.equal((await e.call('admin/analytics',{actor})).status,403);assert.equal((await e.call('admin/analytics',{method:'PUT',actor,body:{enabled:true,measurementId:'G-TEST123456',manualTrackingConfirmed:true}})).status,403);}assert.equal((await e.call('admin/analytics',{method:'PUT',actor:admin,body:{enabled:true,measurementId:'G-TEST123456',teamTracking:true}})).status,422);const saved=await e.call('admin/analytics',{method:'PUT',actor:admin,body:{enabled:true,measurementId:'G-TEST123456',manualTrackingConfirmed:true}});assert.equal(saved.status,200);assert.deepEqual((await e.call('analytics-config')).data,{enabled:true,measurementId:'G-TEST123456',teamTracking:true});const cold=createNetlifyApi({repository:e.repository,password:e.secret});const read=await cold(new Request('https://portfolio.example/api/analytics-config'));assert.deepEqual(await read.json(),{enabled:true,measurementId:'G-TEST123456',teamTracking:true});await e.call('admin/analytics',{method:'PUT',actor:admin,body:{enabled:false,measurementId:'G-TEST123456',manualTrackingConfirmed:true}});assert.deepEqual((await e.call('analytics-config')).data,{enabled:false,measurementId:'',teamTracking:true});});
test('staff instructions require authentication and respect stock and analytics roles',async()=>{const e=environment();assert.equal((await e.call('admin/guide')).status,401);const admin=await e.owner(),broker=await e.broker(admin),manager=await e.broker(admin,'guide-manager@example.test','broker_admin');const a=(await e.call('admin/guide',{actor:admin})).data,b=(await e.call('admin/guide',{actor:broker})).data,m=(await e.call('admin/guide',{actor:manager})).data;assert.ok(a.chapters.some(x=>x.id==='analytics'));assert.ok(a.chapters.some(x=>x.id==='activity'));assert.ok(a.chapters.some(x=>x.id==='stock'));assert.ok(m.chapters.some(x=>x.id==='stock'));assert.ok(!m.chapters.some(x=>x.id==='analytics'));assert.ok(!m.chapters.some(x=>x.id==='activity'));assert.ok(!b.chapters.some(x=>x.id==='stock'));assert.ok(!b.chapters.some(x=>x.id==='analytics'));assert.ok(!b.chapters.some(x=>x.id==='activity'));assert.ok(b.chapters.some(x=>x.id==='collections'));assert.ok(!JSON.stringify(a).includes(e.secret));});

test('transport defaults belong only to collections, never personal links',async()=>{
 const e=environment(),admin=await e.owner(),a=await e.broker(admin),b=await e.broker(admin,'second@example.test');
 const defaults={showLines:true,showStations:true,lineIds:['jubilee'],stationIds:['940GZZDLABR']};
 const saved=await e.call('admin/profile',{method:'POST',actor:a,body:{transportDefaults:defaults}});
 assert.equal(saved.status,422);
 // Old personal settings must not leak into either public link type.
 await e.repository.update(s=>{s.users.find(u=>u.id===a.user.id).transportDefaults=defaults;});
 assert.equal((await e.call('brokers/'+a.user.shareSlug)).data.transportDefaults,undefined);
 assert.equal((await e.call('access/me',{actor:a})).data.user.transportDefaults,undefined);
 const old=await e.call('admin/collections',{method:'POST',actor:a,body:{title:'Older collection',developmentIds:[samples[0].id]}});
 assert.equal((await e.call('collections/'+old.data.slug)).data.transportDefaults,undefined);
 assert.equal((await e.call('collections/'+old.data.slug)).data.broker.transportDefaults,undefined);
 await e.call('admin/profile',{method:'POST',actor:a,body:{whatsapp:'+447900000099'}});
 assert.equal((await e.call('brokers/'+a.user.shareSlug)).data.whatsapp,'+447900000099');
 const off={showLines:false,showStations:false,lineIds:[],stationIds:[]};
 const c=await e.call('admin/collections',{method:'POST',actor:a,body:{title:'Transport selection',developmentIds:[samples[0].id],transportDefaults:off}});
 assert.equal(c.status,201);assert.deepEqual((await e.call('collections/'+c.data.slug)).data.transportDefaults,off);
 const update={title:'Updated transport',developmentIds:[samples[0].id],transportDefaults:defaults};
 assert.equal((await e.call('admin/collections/'+c.data.id,{method:'PUT',actor:b,body:update})).status,403);
 assert.equal((await e.call('admin/collections/'+c.data.id,{method:'PUT',actor:a,body:update})).status,200);
 assert.deepEqual((await e.call('collections/'+c.data.slug)).data.transportDefaults,defaults);
 for(const invalid of [null,{}, {...defaults,showLines:'yes'},{...defaults,lineIds:['fake-line']},{...defaults,stationIds:['fake-stop']},{...defaults,lineIds:['jubilee',42]}]){
  assert.equal((await e.call('admin/profile',{method:'POST',actor:a,body:{transportDefaults:invalid}})).status,422);
  assert.equal((await e.call('admin/collections/'+c.data.id,{method:'PUT',actor:a,body:{...update,transportDefaults:invalid}})).status,422);
 }
 assert.deepEqual((await e.call('collections/'+c.data.slug)).data.transportDefaults,defaults);
});

test('broker portraits save only to the signed-in profile, persist and can be removed',async()=>{
 const {readFileSync}=await import('node:fs');const photo='data:image/jpeg;base64,'+readFileSync(new URL('./fixtures/profile-square.jpg',import.meta.url)).toString('base64');
 const e=environment(),admin=await e.owner(),a=await e.broker(admin),b=await e.broker(admin,'another@example.test');
 assert.equal((await e.call('admin/profile',{method:'POST',actor:a,csrf:false,body:{photo}})).status,403);
 const saved=await e.call('admin/profile',{method:'POST',actor:a,body:{photo,userId:b.user.id}});assert.equal(saved.status,200);assert.equal(saved.data.photo,photo);assert.equal(saved.data.whatsapp,a.user.whatsapp);
 assert.equal((await e.call('access/me',{actor:a})).data.user.photo,photo);assert.equal((await e.call('brokers/'+a.user.shareSlug)).data.photo,photo);assert.equal((await e.call('brokers/'+b.user.shareSlug)).data.photo,'');
 const c=await e.call('admin/collections',{method:'POST',actor:a,body:{title:'With portrait',developmentIds:[samples[0].id]}});assert.equal((await e.call('collections/'+c.data.slug)).data.broker.photo,photo);
 await e.call('admin/profile',{method:'POST',actor:a,body:{whatsapp:'+447900000099'}});assert.equal((await e.call('brokers/'+a.user.shareSlug)).data.photo,photo);
 assert.equal((await e.repository.read()).users.find(u=>u.id===a.user.id).photo,photo);
 const cold=accessService(e.repository,e.secret);assert.equal((await cold.publicBroker(a.user.shareSlug)).photo,photo);
 for(const invalid of ['data:image/svg+xml;base64,PHN2Zy8+','https://example.com/photo.jpg','data:image/jpeg;base64,aGVsbG8=',null,'x'.repeat(180001)])assert.equal((await e.call('admin/profile',{method:'POST',actor:a,body:{photo:invalid}})).status,422);
 assert.equal((await e.call('admin/profile',{method:'POST',actor:a,body:{photo:''}})).data.photo,'');assert.equal((await e.call('brokers/'+a.user.shareSlug)).data.photo,'');
});

test('Admin, Broker admin and Broker can all update their own profile photo without changing another account',async()=>{
 const {readFileSync}=await import('node:fs');const photo='data:image/jpeg;base64,'+readFileSync(new URL('./fixtures/profile-square.jpg',import.meta.url)).toString('base64');
 const e=environment(),owner=await e.owner(),broker=await e.broker(owner),manager=await e.broker(owner,'photo-manager@example.test','broker_admin');
 for(const actor of [broker,manager,owner]){
  const result=await e.call('admin/profile',{method:'POST',actor,body:{photo,userId:owner.user.id,role:'admin'}});
  assert.equal(result.status,200);assert.equal(result.data.role,actor.user.role);assert.equal(result.data.whatsapp,actor.user.whatsapp);assert.equal(result.data.photo,photo);
  assert.equal((await e.call('access/me',{actor})).data.user.photo,photo);
 }
 assert.equal((await e.call('admin/profile',{method:'POST',actor:broker,body:{photo:''}})).status,200);
 assert.equal((await e.call('access/me',{actor:owner})).data.user.photo,photo);assert.equal((await e.call('access/me',{actor:manager})).data.user.photo,photo);
});

test('saved brochures are private per broker, versioned and available after a cold API instance',async()=>{
 const {memoryBrochureFiles}=await import('./brochures.mjs'),files=memoryBrochureFiles(),e=environment({brochureFiles:files}),admin=await e.owner(),a=await e.broker(admin),b=await e.broker(admin,'other-brochures@example.test');
 const {jsPDF}=await import('jspdf'),pdf=new jsPDF();pdf.text('Saved brochure fixture',20,20);const bytes=Buffer.from(pdf.output('arraybuffer')),config={title:'My saved London homes',intro:'A personal selection',brokerTitle:'Broker',developmentIds:[samples[0].id],notes:{[samples[0].id]:'Near the river.'},collection:'',cover:{kind:'default'}};
 const body={config,pdfBase64:bytes.toString('base64'),ownerId:b.user.id};assert.equal((await e.call('admin/brochures',{method:'POST',actor:a,body,csrf:false})).status,403);
 const saved=await e.call('admin/brochures',{method:'POST',actor:a,body});assert.equal(saved.status,200);assert.equal(saved.data.hasPdf,true);assert.equal(saved.data.ownerId,a.user.id);assert.equal((await e.call('admin/brochures',{actor:b})).data.length,0);
 assert.equal((await e.call('admin/brochures',{method:'POST',actor:b,body:{...body,id:saved.data.id,version:saved.data.version}})).status,404);
 assert.equal((await e.call('admin/brochures',{method:'POST',actor:a,body:{...body,id:saved.data.id,version:0}})).status,409);
 const cold=createNetlifyApi({repository:e.repository,password:e.secret,brochureFiles:files});const response=await cold(new Request('https://portfolio.example/api/admin/brochures/'+saved.data.id+'/pdf',{headers:{Cookie:a.cookie}}));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 assert.equal((await cold(new Request('https://portfolio.example/api/admin/brochures/'+saved.data.id+'/pdf',{headers:{Cookie:b.cookie}}))).status,404);
 const edited=await e.call('admin/brochures',{method:'POST',actor:a,body:{config:{...config,title:'Updated draft'},id:saved.data.id,version:saved.data.version}});assert.equal(edited.status,200);assert.equal(edited.data.hasPdf,false);assert.equal((await e.call('admin/brochures/'+saved.data.id,{method:'DELETE',actor:a})).status,200);assert.equal((await e.call('admin/brochures',{actor:a})).data.length,0);
 assert.equal((await e.call('admin/brochure-cover',{method:'POST',actor:a,body:{photo:'data:image/jpeg;base64,AAAA'}})).status,403);
});

test('manual website edits survive real refreshes and only stock managers can resolve current differences',async()=>{
 let price=600000;const raw=()=>({id:'review-website',city:'London',tenureType:['sale'],isNewDevelopment:true,title:'Refresh protected home',developmentHeadline:'Refresh protected home, Angel',postcode:'N1 7AA',lat:51.53,lng:-.1,price:{minAmount:price,currencyCode:'GBP'},rooms:{bedrooms:['1 Bed','3 Bed']},description:'London homes near transport.',amenities:['Garden'],images:['https://example.test/photo.jpg'],videos:[],pageUrl:'/sale-development/protected'});
 const e=environment({fetchListings:async()=>[raw()]}),owner=await e.owner(),manager=await e.broker(owner,'review-manager@example.test','broker_admin'),broker=await e.broker(owner);await e.call('admin/sync',{method:'POST',actor:owner,body:{}});
 let d=(await e.call('admin/developments',{actor:manager})).data.find(d=>d.id==='jll-review-website');assert.equal((await e.call('admin/developments/'+d.id,{method:'PUT',actor:manager,body:{...d,priceFrom:700000,unitPrices:{'3':1300000}}})).status,200);
 price=800000;const refreshed=await e.call('admin/sync',{method:'POST',actor:owner,body:{}});assert.ok(refreshed.data.conflicts>=1);d=(await e.call('admin/developments',{actor:manager})).data.find(d=>d.id==='jll-review-website');assert.equal(d.priceFrom,700000);assert.equal(d.unitPrices['3'],1300000);const change=d._refreshConflicts.priceFrom;assert.ok(change);
 const publicD=(await e.call('developments')).data.find(row=>row.id==='jll-review-website');assert.ok(Object.keys(publicD).every(k=>!k.startsWith('_')));const brokerView=(await e.call('admin/developments',{actor:broker})).data.find(row=>row.id==='jll-review-website');assert.ok(Object.keys(brokerView).every(k=>!k.startsWith('_')));
 const body={id:d.id,field:'priceFrom',choice:'website',version:change.version};assert.equal((await e.call('admin/source-review',{method:'POST',actor:broker,body})).status,403);assert.equal((await e.call('admin/source-review',{method:'POST',actor:manager,body:{...body,version:'stale'}})).status,409);assert.equal((await e.call('admin/source-review',{method:'POST',actor:manager,body})).status,200);
 d=(await e.call('developments')).data.find(d=>d.id==='jll-review-website');assert.equal(d.priceFrom,800000);assert.equal(d.unitPrices['3'],1300000);
});

test('brochure quotas and revoked accounts reject writes without replacing saved work',async()=>{
 const {memoryBrochureFiles}=await import('./brochures.mjs'),files=memoryBrochureFiles(),e=environment({brochureFiles:files}),admin=await e.owner(),broker=await e.broker(admin);const config={title:'Quota draft',developmentIds:[samples[0].id],notes:{},cover:{kind:'default'}};
 await e.repository.update(s=>{s.brochures=Array.from({length:50},(_,i)=>({id:'quota-'+i,ownerId:broker.user.id,version:1,config,title:'Existing',size:0,updatedAt:'2026-11-01'}));});assert.equal((await e.call('admin/brochures',{method:'POST',actor:broker,body:{config}})).status,422);assert.equal((await e.call('admin/brochures',{actor:broker})).data.length,50);
 await e.repository.update(s=>{s.brochures=[{id:'quota-0',ownerId:broker.user.id,version:1,config,title:'Existing',size:100000000,updatedAt:'2026-11-01'}];});const pdf=Buffer.from('%PDF-1.4\nsmall fixture\n%%EOF').toString('base64');assert.equal((await e.call('admin/brochures',{method:'POST',actor:broker,body:{config,pdfBase64:pdf}})).status,422);assert.equal((await e.call('admin/brochures',{actor:broker})).data.length,1);
 await e.call('admin/users/'+broker.user.id,{method:'PATCH',actor:admin,body:{active:false}});assert.equal((await e.call('admin/brochures',{method:'POST',actor:broker,body:{config}})).status,401);
});

test('profile job titles belong to the signed-in user and override per-brochure title inputs',async()=>{
 const e=environment(),owner=await e.owner(),broker=await e.broker(owner),manager=await e.broker(owner,'titles-manager@example.test','broker_admin');
 for(const actor of [owner,broker,manager]){
  const changed=await e.call('admin/profile',{method:'POST',actor,body:{jobTitle:'  Senior Sales Broker  ',id:owner.user.id,role:'admin'}});assert.equal(changed.status,200);assert.equal(changed.data.jobTitle,'Senior Sales Broker');assert.equal(changed.data.role,actor.user.role);assert.equal((await e.call('access/me',{actor})).data.user.jobTitle,'Senior Sales Broker');
  const saved=await e.call('admin/brochures',{method:'POST',actor,body:{config:{title:'Profile title brochure',brokerTitle:'An unauthoritative title',developmentIds:[samples[0].id],cover:{kind:'default'}}}});assert.equal(saved.status,200);assert.equal(saved.data.config.brokerTitle,'Senior Sales Broker');
 }
 assert.equal((await e.call('admin/profile',{method:'POST',actor:broker,body:{jobTitle:'x'.repeat(101)}})).status,422);
 await e.call('admin/profile',{method:'POST',actor:broker,body:{jobTitle:''}});assert.equal((await e.call('access/me',{actor:broker})).data.user.jobTitle,'');assert.equal((await e.call('access/me',{actor:owner})).data.user.jobTitle,'Senior Sales Broker');
});

test('brochure map choice is validated, saved privately and preserved when reopening',async()=>{
 const e=environment(),owner=await e.owner(),broker=await e.broker(owner),config={title:'Map selection',developmentIds:[samples[0].id],cover:{kind:'default'}};
 const created=await e.call('admin/brochures',{method:'POST',actor:broker,body:{config}});assert.equal(created.status,200);assert.equal(created.data.config.includeMap,true);
 const changed=await e.call('admin/brochures',{method:'POST',actor:broker,body:{id:created.data.id,version:created.data.version,config:{...config,includeMap:false}}});assert.equal(changed.status,200);assert.equal(changed.data.config.includeMap,false);
 const invalid=await e.call('admin/brochures',{method:'POST',actor:broker,body:{config:{...config,includeMap:'no'}}});assert.equal(invalid.status,422);
 const rows=(await e.call('admin/brochures',{actor:broker})).data;assert.equal(rows.length,1);assert.equal(rows[0].config.includeMap,false);assert.equal((await e.call('admin/brochures',{actor:owner})).data.length,0);
});
