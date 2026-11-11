import {brochureService,memoryBrochureFiles} from './brochures.mjs';
import {markManualEdit,resolveSourceField} from './source-review.mjs';
import {defaultCommute,CommuteError} from './commute.mjs';
import {pendingInputService} from './pending-input.mjs';
import {assignDevelopmentReview,confirmDevelopmentReview,developmentReviewWorkspace} from './development-reviews.mjs';
import {recordStaff,touchStaff,initializeActivity,engagementService,activityReport} from './activity.mjs';
import {translations as defaultTranslations} from './translations.mjs';
import {staffGuide} from './staff-guide.mjs';
import {analyticsConfiguration,validateAnalyticsConfiguration} from './analytics-config.mjs';
import {importForReview} from './review-import.mjs';
import {postcodeLocation} from './location.mjs';
import {parsePastedListing} from './pasted-import.mjs';
import {rejectDuplicate} from './duplicates.mjs';
import {accessService,AccessError,checkOrigin,sessionCookie,publicDevelopment,publicUser} from './access.mjs';
import {randomBytes} from 'node:crypto';
import {validateDevelopment} from './model.mjs';
import {extractListing} from './import.mjs';
import {fetchSource} from './sync.mjs';
import {ConflictError,refreshPortfolio} from './netlify-store.mjs';
const reviewedDevelopment=raw=>{try{return validateDevelopment(raw);}catch(e){throw new AccessError(e.message);}};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createNetlifyApi({repository,password,fetchListings=fetchSource,extract=extractListing,network,connections,translations=defaultTranslations,visitorRepository,pendingOptions,brochureFiles,commute=defaultCommute,reviewEmailConfigured=false}){
 const access=accessService(repository,password);
 const brochures=brochureService(repository,brochureFiles||memoryBrochureFiles());
 const pending=pendingInputService(repository,pendingOptions);
 visitorRepository||={readDay:async date=>(await repository.read()).buyerActivityDays?.[date]||{people:{}},updateDay:async(date,change)=>repository.update(s=>{s.buyerActivityDays||={};s.buyerActivityDays[date]||={people:{}};change(s.buyerActivityDays[date]);})};
 const engagement=engagementService(visitorRepository);
 return async(request)=>{
  const url=new URL(request.url);const route=url.pathname.replace(/^\/\.netlify\/functions\/api/,'/api');const method=request.method;
  try{
   if(method==='GET'&&route==='/api/analytics-config')return json({...analyticsConfiguration(await repository.read()),teamTracking:true});
   if(method==='POST'&&route==='/api/activity'){checkOrigin(request);if(request.headers.get('origin')!==url.origin)throw new AccessError('Use the portfolio to record activity.',403);if(Number(request.headers.get('content-length')||0)>8000)return json({error:'Activity payload is too large.'},413);const text=await request.text();if(Buffer.byteLength(text)>8000)return json({error:'Activity payload is too large.'},413);let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid activity payload.'},400);}const state=await repository.read(),result=await engagement.collect(state,body);if(result.recorded&&!state.activity)await repository.update(s=>initializeActivity(s,Date.parse(result.recordedAt)));return json({ok:true});}
   if(method==='GET'&&route==='/api/health'){await repository.read();return json({ok:true});}
   if(method==='GET'&&route==='/api/developments')return json((await repository.read()).developments.map(publicDevelopment));
   if(method==='GET'&&route.startsWith('/api/brokers/'))return json(await access.publicBroker(decodeURIComponent(route.slice('/api/brokers/'.length))));
   if(method==='GET'&&route.startsWith('/api/collections/'))return json(await access.publicCollection(decodeURIComponent(route.slice('/api/collections/'.length))));
   if(method==='GET'&&route==='/api/access/status')return json(await access.status());
   if(method==='GET'&&route==='/api/access/me'){const actor=await access.authenticate(request,{allowLegacy:false});return json({user:publicUser(actor),csrf:actor.csrf});}
   if(method==='POST'&&['/api/access/bootstrap','/api/access/login','/api/access/accept'].includes(route)){checkOrigin(request);if(Number(request.headers.get('content-length')||0)>10000)return json({error:'Request is too large.'},413);const text=await request.text();if(Buffer.byteLength(text)>10000)return json({error:'Request is too large.'},413);let body;try{body=JSON.parse(text);}catch{return json({error:'Request must contain valid JSON.'},400);}const action=route.split('/').pop();const result=await access[action](body);const response=json({user:result.user,csrf:result.csrf});response.headers.set('Set-Cookie',sessionCookie(result.token,request));return response;}
   if(method==='POST'&&route==='/api/access/logout'){const actor=await access.authenticate(request,{allowLegacy:false});access.csrf(request,actor);await access.logout(actor);const response=json({ok:true});response.headers.set('Set-Cookie',sessionCookie('',request,true));return response;}
   if(method==='GET'&&route.startsWith('/api/translations/')){const id=decodeURIComponent(route.slice('/api/translations/'.length)),language=url.searchParams.get('language');const d=(await repository.read()).developments.find(x=>x.id===id);if(!d)return json({error:'Development not found.'},404);if(!['ar','zh-CN','tr'].includes(language))return json({error:'Unsupported language.'},422);try{return json(await translations(d,language));}catch(e){console.error('Public listing translation failed:',e.code||e.name,e.message);return json({error:'Automatic translation is unavailable. The original English description is shown.',code:/^provider_http_\d+$/.test(e.code||'')?e.code:'translation_unavailable'},503);}}
   if(method==='POST'&&route==='/api/commute'){
    checkOrigin(request);const raw=await request.text();if(Buffer.byteLength(raw)>6000)return json({error:'Commute request is too large.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'Enter a valid commute request.'},400);}
    try{return json(await commute(body,(await repository.read()).developments));}catch(e){if(e instanceof CommuteError)return json({error:e.message},e.status);return json({error:'Commute planning is temporarily unavailable. Please try again.'},503);}
   }
   if(method==='GET'&&route==='/api/transport'){try{return json(await network());}catch{return json({error:'The TfL network is temporarily unavailable.'},503);}}
   if(method==='GET'&&route==='/api/stations'){try{return json((await network()).stations);}catch{return json({error:'The TfL station directory is temporarily unavailable.'},503);}}
   if(method==='GET'&&route.startsWith('/api/connections/')){const id=decodeURIComponent(route.slice('/api/connections/'.length));const d=(await repository.read()).developments.find(d=>d.id===id);if(!d)return json({error:'Development not found.'},404);try{return json(await connections(d));}catch{return json({error:'Station routes are temporarily unavailable.'},503);}}
   if(!route.startsWith('/api/admin/'))return json({error:'API endpoint not found.'},404);
   if((await access.status()).setupRequired&&(!password||password.length<12))return json({error:'Administrator access is not configured for this deployment.'},503);
   const actor=await access.authenticate(request);
   if(!['GET','HEAD'].includes(method))access.csrf(request,actor);
   if(route==='/api/admin/development-reviews'){
    if(actor.legacy)throw new AccessError('Sign in with a staff account.',401);
    if(method==='GET'){
     const state=await repository.read();
     return json(developmentReviewWorkspace(state,access.current(state,actor),reviewEmailConfigured));
    }
    if(method==='PUT'||method==='POST'){
     const text=await request.text();
     if(Buffer.byteLength(text)>4000)throw new AccessError('Development review request is too large.',413);
     let body;try{body=JSON.parse(text);}catch{throw new AccessError('Send valid development review data.');}
     return json(await repository.update(state=>{
      const acting=access.current(state,actor);
      if(method==='POST')return confirmDevelopmentReview(state,acting,body);
      access.admin(acting);
      return assignDevelopmentReview(state,body);
     }));
    }
    return json({error:'Development review action not found.'},404);
   }
   if(route==='/api/admin/brochures'||route.startsWith('/api/admin/brochures/')||route==='/api/admin/brochure-cover'){
    const check=state=>{const user=access.current(state,actor);if(user.legacy)throw new AccessError('Sign in with a staff account.',401);return user;};check(await repository.read());
    if(route==='/api/admin/brochure-cover'&&method==='GET'){const file=await brochures.cover(check);return file?new Response(file.bytes,{headers:{'Content-Type':file.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}):new Response(null,{status:204});}
    const parts=route.slice('/api/admin/brochures'.length).split('/').filter(Boolean),id=parts[0];
    if(route==='/api/admin/brochures'&&method==='GET')return json(await brochures.list(check));
    if(id&&parts[1]==='pdf'&&method==='GET'){const file=await brochures.pdf(id,check);return new Response(file.bytes,{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="'+file.filename+'"'}});}
    if(id&&parts.length===1&&method==='DELETE')return json(await brochures.remove(id,check));
    if(method==='POST'&&(route==='/api/admin/brochures'||route==='/api/admin/brochure-cover')){const text=await request.text();if(Buffer.byteLength(text)>5000000)throw new AccessError('The saved brochure request is too large.',413);let body;try{body=JSON.parse(text);}catch{throw new AccessError('Send valid brochure data.');}return json(route==='/api/admin/brochure-cover'?await brochures.saveCover(body.photo,check):await brochures.save(body,check));}
    throw new AccessError('Brochure action not found.',404);
   }
   if(method==='POST'&&route==='/api/admin/login')return json({ok:true});
   if(route==='/api/admin/pending-input'||route.startsWith('/api/admin/pending-input/')){
    const check=state=>access.stock(access.current(state,actor));check(await repository.read());
    if(actor.legacy)throw new AccessError('Create a staff account to use Pending input.',409);
    const parts=route.slice('/api/admin/pending-input'.length).split('/').filter(Boolean),id=parts[0],action=parts[1];
    if(method==='GET'&&!id)return json(await pending.list(check));
    if(method==='GET'&&id&&!action)return json(await pending.get(id,check));
    if(!['POST','PUT'].includes(method))throw new AccessError('Pending input action not found.',404);
    const text=await request.text();if(Buffer.byteLength(text)>100000)throw new AccessError('Pending input exceeds the 100KB limit.',413);
    let body;try{body=JSON.parse(text);}catch{throw new AccessError('Send valid pending input data.');}
    if(method==='PUT'&&id&&!action)return json(await pending.save(id,body,check,actor));
    if(method==='POST'&&id&&['extract','archive','publish'].includes(action))return json(await pending[action](id,body,check,actor));
    throw new AccessError('Pending input action not found.',404);
   }

   if(method==='GET'&&route==='/api/admin/activity'){const state=await repository.read();access.admin(access.current(state,actor));return json(await activityReport(state,visitorRepository,url.searchParams));}
   if(method==='POST'&&route==='/api/admin/heartbeat'){if(actor.legacy)throw new AccessError('Sign in with a staff account.',401);const s=await repository.read();const last=s.activity?.people?.[actor.id]?.lastActivityAt;if(!last||Date.now()-Date.parse(last)>=5*60000)await repository.update(state=>touchStaff(state,access.current(state,actor)));return json({ok:true});}
   if(method==='GET'&&route==='/api/admin/guide')return json(staffGuide(actor.role));
   if(method==='GET'&&route==='/api/admin/analytics'){access.admin(actor);return json(analyticsConfiguration(await repository.read(),{privateView:true}));}
   if(route==='/api/admin/drafts'){access.stock(actor);if(method==='GET')return json(((await repository.read()).drafts||[]).filter(d=>actor.role==='admin'||d.ownerId===actor.id));}
   if(method==='DELETE'&&route.startsWith('/api/admin/drafts/')){access.stock(actor);return json(await repository.update(s=>{const acting=access.current(s,actor);access.stock(acting);const id=route.slice('/api/admin/drafts/'.length),d=(s.drafts||[]).find(d=>d.id===id);if(!d)throw new AccessError('Draft not found.',404);if(acting.role!=='admin'&&d.ownerId!==actor.id)throw new AccessError('You can only remove your own drafts.',403);s.drafts=s.drafts.filter(d=>d.id!==id);recordStaff(s,acting,'draft_remove',{id,label:d.name});return {ok:true};}));}
   if(method==='GET'&&route==='/api/admin/invites')return json(await access.invites(actor));
   if(method==='DELETE'&&route.startsWith('/api/admin/invites/'))return json(await access.revokeInvite(actor,decodeURIComponent(route.slice('/api/admin/invites/'.length))));
   if(method==='GET'&&route==='/api/admin/users')return json(await access.users(actor));
   if(method==='GET'&&route==='/api/admin/collections')return json(await access.collections(actor));
   if(method==='GET'&&route==='/api/admin/developments'){const state=await repository.read(),acting=access.current(state,actor);return json(state.developments.map(d=>({...((acting.role==='broker')?publicDevelopment(d):d),canEdit:access.canEdit(acting,d)})));}
   if(method==='DELETE'&&route.startsWith('/api/admin/collections/'))return json(await access.deleteCollection(actor,decodeURIComponent(route.slice('/api/admin/collections/'.length))));
   if(method==='GET'&&route==='/api/admin/sync')return json((await repository.read()).lastSync||{syncedAt:null});
   if(method==='POST'&&route==='/api/admin/sync'){access.stock(actor);return json(await refreshPortfolio(repository,await fetchListings(),state=>{const acting=access.current(state,actor);access.stock(acting);recordStaff(state,acting,'stock_sync');}));}
   if(method==='DELETE'&&route.startsWith('/api/admin/developments/')){
    const id=decodeURIComponent(route.slice('/api/admin/developments/'.length));
    const found=await repository.update(state=>{const acting=access.current(state,actor);access.stock(acting);const target=state.developments.find(d=>d.id===id);if(target&&!access.canEdit(acting,target))throw new AccessError('You can only remove your own developments.',403);const before=state.developments.length;state.developments=state.developments.filter(d=>d.id!==id);if(target&&state.developmentReviews)state.developmentReviews=state.developmentReviews.filter(review=>review.developmentId!==id);if(target)recordStaff(state,acting,'stock_remove',{id,label:target.name});return before!==state.developments.length;});return json(found?{ok:true}:{error:'Development not found.'},found?200:404);
   }
   if(!['POST','PUT','PATCH'].includes(method))return json({error:'API endpoint not found.'},404);
   if(Number(request.headers.get('content-length')||0)>2_000_000)return json({error:'Import exceeds the 2MB limit.'},413);
   const text=await request.text();if(Buffer.byteLength(text)>2_000_000)return json({error:'Import exceeds the 2MB limit.'},413);
   let body;try{body=JSON.parse(text);}catch{return json({error:'Request must contain valid JSON.'},400);}
   if(method==='POST'&&route==='/api/admin/activity'){if(actor.legacy)throw new AccessError('Sign in with a staff account.',401);if(!['personal_link_copy','personal_whatsapp_click','personal_email_click','collection_link_copy','collection_whatsapp_click','collection_email_click'].includes(body?.event))throw new AccessError('Unsupported staff activity.');return json(await repository.update(state=>{const acting=access.current(state,actor);let c;if(body.event.startsWith('collection_')){c=(state.collections||[]).find(c=>c.id===body.collectionId);if(!c)throw new AccessError('Collection not found.',404);if(acting.role!=='admin'&&c.ownerId!==acting.id)throw new AccessError('This collection belongs to another broker.',403);}else if(!acting.whatsapp||!acting.shareSlug)throw new AccessError('Add your WhatsApp number first.');recordStaff(state,acting,body.event,{id:c?.id||'',label:c?.title||''});return {ok:true};}));}
   if(method==='PUT'&&route==='/api/admin/analytics'){access.admin(actor);let settings;try{settings=validateAnalyticsConfiguration(body);}catch(e){throw new AccessError(e.message);}return json(await repository.update(state=>{access.admin(access.current(state,actor));state.analytics=settings;return analyticsConfiguration(state,{privateView:true});}));}
   if(method==='POST'&&route==='/api/admin/source-review'){access.stock(actor);return json(await repository.update(state=>{const acting=access.current(state,actor);access.stock(acting);const i=state.developments.findIndex(d=>d.id===body.id);if(i<0)throw new AccessError('Development not found.',404);let next;try{next=resolveSourceField(state.developments[i],body.field,body.choice,body.version);validateDevelopment(next);}catch(e){throw new AccessError(e.message,409);}state.developments[i]=next;recordStaff(state,acting,'stock_edit',{id:next.id,label:next.name});return {ok:true};}));}
   if(method==='POST'&&route==='/api/admin/profile')return json(await access.updateProfile(actor,body));
   if(method==='POST'&&route==='/api/admin/drafts'){access.stock(actor);if(!body||typeof body.data!=='object'||!body.data)throw new AccessError('A draft needs development data.');return json(await repository.update(s=>{const acting=access.current(s,actor);access.stock(acting);s.drafts||=[];let d=body.id?s.drafts.find(d=>d.id===body.id):null;if(body.id&&!d)throw new AccessError('Draft no longer exists. Save a new draft.',404);if(d&&acting.role!=='admin'&&d.ownerId!==actor.id)throw new AccessError('You can only edit your own drafts.',403);if(!d){if(s.drafts.length>=200)throw new AccessError('Remove an old draft before adding another.');d={id:randomBytes(12).toString('hex'),ownerId:actor.id};s.drafts.push(d);}d.data=structuredClone(body.data);d.editingId=typeof body.editingId==='string'?body.editingId:null;d.name=String(body.name||'Untitled development').slice(0,100);d.updatedAt=new Date().toISOString();recordStaff(s,acting,'draft_save',{id:d.id,label:d.name});return structuredClone(d);}),201);}
   if(method==='POST'&&route==='/api/admin/users/invite')return json(await access.invite(actor,body),201);
   if(method==='PATCH'&&route.startsWith('/api/admin/users/'))return json(await access.updateUser(actor,decodeURIComponent(route.slice('/api/admin/users/'.length)),body));
   if(method==='POST'&&route==='/api/admin/collections')return json(await access.saveCollection(actor,body),201);
   if(method==='PUT'&&route.startsWith('/api/admin/collections/'))return json(await access.saveCollection(actor,body,decodeURIComponent(route.slice('/api/admin/collections/'.length))));
   if(method==='POST'&&route==='/api/admin/location'){access.stock(actor);try{return json(await postcodeLocation(body.postcode));}catch(e){return json({error:e.message},422);}}
   if(method==='POST'&&route==='/api/admin/parse-text'){access.stock(actor);try{return json({development:parsePastedListing(body.text,body.url||undefined),warning:'Text loaded as an unpublished draft. Complete missing fields and review all details before publishing.'});}catch(e){return json({error:e.message},422);}}
   if(method==='POST'&&route==='/api/admin/extract'){access.stock(actor);try{return json(await importForReview(body?.url,(await repository.read()).developments,{extract,fetchListings}));}catch(e){return json({error:e.message},422);}}
   if(method==='POST'&&route==='/api/admin/import'){
    access.stock(actor);const rows=body?.developments;if(!Array.isArray(rows)||!rows.length||rows.length>200)throw Error('Import 1–200 developments at a time.');
    const items=rows.map((raw,i)=>{try{return {...reviewedDevelopment(raw),id:randomBytes(12).toString('hex'),createdBy:actor.id};}catch(e){throw new AccessError(`Row ${i+1}: ${e.message}`);}});
    await repository.update(state=>{const acting=access.current(state,actor);access.stock(acting);const checked=[...state.developments];for(const item of items){rejectDuplicate(checked,item);checked.push(item);}state.developments.push(...items);for(const item of items)recordStaff(state,acting,'stock_add',{id:item.id,label:item.name});});return json({created:items.length},201);
   }
   if(method==='PUT'&&route.startsWith('/api/admin/developments/')){
    const id=decodeURIComponent(route.slice('/api/admin/developments/'.length));const data={...reviewedDevelopment(body),id};
    const found=await repository.update(state=>{const acting=access.current(state,actor);access.stock(acting);const i=state.developments.findIndex(d=>d.id===id);if(i<0)return false;if(!access.canEdit(acting,state.developments[i]))throw new AccessError('You can only edit your own developments.',403);rejectDuplicate(state.developments,data,id);state.developments[i]=markManualEdit(state.developments[i],data,acting);recordStaff(state,acting,'stock_edit',{id,label:data.name});return true;});return json(found?{ok:true}:{error:'Development not found.'},found?200:404);
   }
   return json({error:'API endpoint not found.'},404);
  }catch(e){if(e.duplicateId)return json({error:e.message,duplicateId:e.duplicateId},409);if(e instanceof AccessError)return json({error:e.message},e.status);if(e instanceof ConflictError)return json({error:e.message},409);console.error('Portfolio API request failed:',e.message);return json({error:'Unable to complete the request. Check your data or retry shortly; saved stock has been preserved.'},422);}
 };
}
