import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {checkOrigin} from './access.mjs';
import {createNetlifyApi} from './netlify-api.mjs';
import {samples} from './model.mjs';

const publicOrigin='https://digitalportfolio.live.jll.com';
const backendOrigin='https://jll-residential-digital-portfolio.netlify.app';

function environment(){
 let state={developments:structuredClone(samples),lastSync:null};
 const repository={read:async()=>structuredClone(state),update:async fn=>{const next=structuredClone(state),result=fn(next);state=next;return result;}};
 const secret=randomBytes(24).toString('hex'),api=createNetlifyApi({repository,password:secret});
 async function call(path,{method='GET',body,actor,cookie,origin=publicOrigin,csrf=true}={}){
  const headers={'Content-Type':'application/json'};
  if(origin!==null)headers.Origin=origin;
  if(actor||cookie)headers.Cookie=[actor?.cookie,cookie].filter(Boolean).join('; ');
  if(actor&&csrf)headers['X-CSRF-Token']=actor.csrf;
  const response=await api(new Request(backendOrigin+'/api/'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}));
  const data=await response.json();
  return {status:response.status,data,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0],csrf:data.csrf};
 }
 async function owner(){
  const password=randomBytes(18).toString('hex'),email='owner@example.test';
  const result=await call('access/bootstrap',{origin:backendOrigin,method:'POST',body:{setupSecret:secret,name:'Owner',email,password,whatsapp:'+447700900001'}});
  assert.equal(result.status,200);
  return {...result,email,password};
 }
 return {repository,call,owner};
}

test('the production backend trusts only its exact JLL public alias and ordinary same-origin requests',()=>{
 for(const [backend,origin]of [[backendOrigin,publicOrigin],[backendOrigin,backendOrigin],[publicOrigin,publicOrigin],['http://localhost:3001','http://localhost:3001']]){
  assert.doesNotThrow(()=>checkOrigin(new Request(backend+'/api/access/login',{headers:{Origin:origin}})));
 }
 const forwarded={Host:'digitalportfolio.live.jll.com','X-Forwarded-Host':'digitalportfolio.live.jll.com',Forwarded:'host=digitalportfolio.live.jll.com;proto=https'};
 for(const origin of ['https://evil.example','https://digitalportfolio.live.jll.com.evil.example','https://other.live.jll.com','https://engaged-emea.jll.com','http://digitalportfolio.live.jll.com','https://digitalportfolio.live.jll.com:8443','null']){
  assert.throws(()=>checkOrigin(new Request(backendOrigin+'/api/access/login',{headers:{...forwarded,Origin:origin}})),error=>error.status===403);
 }
 for(const backend of ['https://other.netlify.app','https://deploy-preview-1--jll-residential-digital-portfolio.netlify.app','http://localhost:3001']){
  assert.throws(()=>checkOrigin(new Request(backend+'/api/access/login',{headers:{...forwarded,Origin:publicOrigin}})),error=>error.status===403);
 }
});

test('existing staff accounts of every role can sign in, save and sign out through the JLL proxy without weakening CSRF or permissions',async()=>{
 const e=environment(),owner=await e.owner(),accounts=[{email:owner.email,password:owner.password,role:'admin'}];
 for(const role of ['broker_admin','broker']){
  const email=role+'@example.test',password=randomBytes(18).toString('hex');
  const invitation=await e.call('admin/users/invite',{method:'POST',actor:owner,body:{name:role,email,role}});
  assert.equal(invitation.status,201);
  const accepted=await e.call('access/accept',{method:'POST',body:{token:invitation.data.token,email,password,whatsapp:'+447700900002'}});
  assert.equal(accepted.status,200);
  accounts.push({email,password,role});
 }
 for(const account of accounts){
  const signed=await e.call('access/login',{method:'POST',body:{email:account.email,password:account.password}});
  assert.equal(signed.status,200);assert.equal(signed.data.user.role,account.role);
  assert.match(signed.headers.get('set-cookie'),/Path=\/api; HttpOnly; SameSite=Strict/);
  assert.match(signed.headers.get('set-cookie'),/; Secure$/);
  assert.doesNotMatch(signed.headers.get('set-cookie'),/Domain=/i);
  assert.equal((await e.call('access/me',{actor:signed})).status,200);
  const profile={jobTitle:'Origin regression check'};
  assert.equal((await e.call('admin/profile',{method:'POST',actor:signed,body:profile,csrf:false})).status,403);
  assert.equal((await e.call('admin/profile',{method:'POST',actor:signed,body:profile,origin:'https://evil.example'})).status,403);
  assert.equal((await e.call('admin/profile',{method:'POST',actor:signed,body:profile})).status,200);
  if(account.role!=='admin')assert.equal((await e.call('admin/users',{actor:signed})).status,403);
  assert.equal((await e.call('access/logout',{method:'POST',actor:signed})).status,200);
  assert.equal((await e.call('access/me',{actor:signed})).status,401);
 }
});

test('buyer collection and portfolio passwords unlock through the public domain and consented activity uses the same origin check',async()=>{
 const e=environment(),owner=await e.owner();
 const created=await e.call('admin/collections',{method:'POST',actor:owner,body:{title:'Protected homes',developmentIds:[samples[0].id],passwordAction:'protect',password:'buyer-test-password'}});
 assert.equal(created.status,201);
 const path='?collection='+created.data.slug;
 assert.equal((await e.call('buyer/portfolio'+path)).status,423);
 const unlocked=await e.call('buyer/unlock'+path,{method:'POST',body:{password:created.data.password}});
 assert.equal(unlocked.status,200);assert.ok(unlocked.cookie);
 assert.equal((await e.call('buyer/portfolio'+path,{cookie:unlocked.cookie})).status,200);
 const protectedPortfolio=await e.call('admin/buyer-access',{method:'PUT',actor:owner,body:{enabled:true}});
 assert.equal(protectedPortfolio.status,200);
 assert.equal((await e.call('buyer/portfolio')).status,423);
 const password=protectedPortfolio.data.brokers.find(row=>row.id===owner.data.user.id).password;
 const portfolioUnlock=await e.call('buyer/unlock',{method:'POST',body:{password}});
 assert.equal(portfolioUnlock.status,200);
 assert.equal((await e.call('buyer/portfolio',{cookie:portfolioUnlock.cookie})).status,200);
 const body={consent:'accepted',events:[{event:'page_view'}]};
 assert.equal((await e.call('activity',{method:'POST',body})).status,200);
 assert.equal((await e.call('activity',{method:'POST',body,origin:null})).status,403);
 assert.equal((await e.call('activity',{method:'POST',body,origin:'https://evil.example'})).status,403);
});
