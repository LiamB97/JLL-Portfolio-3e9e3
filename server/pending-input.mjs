import {randomBytes} from 'node:crypto';
import requests from '../scripts/stock-intake/requests.json' with {type:'json'};
import prepared from './data/pending-input-prepared.json' with {type:'json'};
import {AccessError} from './access.mjs';
import {recordStaff} from './activity.mjs';
import {validateDevelopment} from './model.mjs';
import {duplicateDevelopment,rejectDuplicate} from './duplicates.mjs';
import {collectPendingSource,emptyPendingData,intakeNotes} from './pending-source.mjs';

const batchId='sales-team-2026-10';
export function pendingIssues(data={}){
 const issues=[];
 const missing=(field,message)=>issues.push({field,message,kind:'input'});
 for(const [key,label]of [['name','development name'],['area','area'],['postcode','full postcode'],['description','development description']])if(typeof data[key]!=='string'||!data[key].trim())missing(key,'Provide the '+label+'.');
 if(data.postcode&&!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(data.postcode))missing('postcode','Check the full UK postcode.');
 if(!Number.isFinite(data.lat)||!Number.isFinite(data.lng)||data.lat<51.28||data.lat>51.7||data.lng<-.52||data.lng>.34)missing('location','Set the correct development pin coordinates.');
 if(!Number.isSafeInteger(data.priceFrom)||data.priceFrom<=0)missing('priceFrom','Confirm the full-market GBP starting price.');
 if(!Array.isArray(data.bedrooms)||!data.bedrooms.length||data.bedrooms.some(b=>!Number.isInteger(b)||b<0||b>10))missing('bedrooms','Confirm available bedroom options (0 means studio).');
 if(!Array.isArray(data.propertyTypes)||!data.propertyTypes.some(t=>typeof t==='string'&&t.trim()))missing('propertyTypes','Confirm the property types.');
 if(!Array.isArray(data.images)||!data.images.some(u=>typeof u==='string'&&/^https:\/\//.test(u)&&!/(?:logo|watermark)|\.(?:mp4|svg|pdf)(?:\?|$)/i.test(u)))missing('images','Add suitable development photography, excluding logos and floorplans.');
 if(data._locationApproximate)issues.push({field:'locationReview',message:'The pin is a postcode centre. Check and confirm the exact position.',kind:'review'});
 issues.push({field:'review',message:'Review the description, amenities, prices, availability and media; remove other agents’ branding and confirm permission to use the content.',kind:'review'});
 return issues;
}
function partialData(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AccessError('Pending input needs development data.');
 const result={};for(const key of ['name','area','postcode','description','status','sourceUrl','importSource']){if(raw[key]!==undefined&&typeof raw[key]!=='string')throw new AccessError(key+' must be text.');result[key]=String(raw[key]||'').trim().slice(0,key==='description'?6000:key.endsWith('Url')||key==='importSource'?2000:200);}
 for(const key of ['lat','lng','priceFrom']){const value=raw[key]??null;if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw new AccessError(key+' must be a number or blank.');result[key]=value;}
 for(const key of ['bedrooms','propertyTypes','amenities','images','videos']){const list=raw[key]??[];if(!Array.isArray(list)||list.length>30)throw new AccessError(key+' must contain up to 30 items.');if(key==='bedrooms'){if(list.some(x=>!Number.isInteger(x)||x<0||x>10))throw new AccessError('Bedroom options must be whole numbers from 0 to 10.');result[key]=list;}else{if(list.some(x=>typeof x!=='string'))throw new AccessError(key+' must contain text.');result[key]=list.map(x=>x.trim().slice(0,2000)).filter(Boolean);}}
 result.unitPrices={};for(const [beds,price]of Object.entries(raw.unitPrices||{})){if(!/^(?:[0-9]|10)$/.test(beds)||!Number.isSafeInteger(price)||price<=0)throw new AccessError('Check the starting prices by bedroom count.');result.unitPrices[beds]=price;}
 result.translations={};for(const language of ['ar','zh-CN','tr']){const t=raw.translations?.[language];if(t&&typeof t.description==='string')result.translations[language]={description:t.description.slice(0,6000),amenities:Array.isArray(t.amenities)?t.amenities.filter(a=>typeof a==='string').slice(0,30).map(a=>a.slice(0,500)):[]};}
 result._locationApproximate=raw._locationApproximate===true;result._requiresReview=true;result.sample=false;return result;
}
export function pendingInputService(repository,{sourceRequests=requests,preparedBatch=prepared,collect=collectPendingSource,now=()=>new Date().toISOString()}={}){
 const guard=(check,state)=>{check?.(state);};
 async function initialize(check){
  const current=await repository.read();guard(check,current);
  if(current.pendingInputSeed?.batchId===batchId&&current.pendingInputSeed?.revision===preparedBatch.revision)return;
  await repository.update(state=>{guard(check,state);state.pendingInputs||=[];
   for(const request of sourceRequests){const id=batchId+'-'+request.row;let entry=state.pendingInputs.find(e=>e.id===id);const content=preparedBatch.items?.find(p=>p.row===request.row);
    if(!entry){entry={id,batchId,row:request.row,requestedName:request.requestedName,sourceUrls:request.urls,originalRows:request.rows,knownExistingId:request.existingId||null,knownExistingName:request.existingName||null,data:emptyPendingData(request),notes:intakeNotes(request.row),teamNote:'',assignedTo:null,sourceStatus:'not_attempted',attempts:[],version:1,createdAt:now(),updatedAt:now(),editedAt:null};state.pendingInputs.push(entry);}
    // A newer prepared bundle can populate an untouched skeleton. Saved team work
    // (including deliberately cleared fields) is never overwritten by a deploy.
    if(content&&!entry.editedAt&&entry.preparedRevision!==preparedBatch.revision){if(content.data)entry.data=partialData(content.data);entry.sourceStatus=content.sourceStatus;entry.attempts=content.attempts||[];entry.collectedAt=content.collectedAt||preparedBatch.collectedAt;entry.locationNote=content.locationNote||'';entry.preparedRevision=preparedBatch.revision;entry.updatedAt=now();entry.version++;}
   }
   state.pendingInputSeed={batchId,revision:preparedBatch.revision};
  });
 }
 function find(state,id){const entry=(state.pendingInputs||[]).find(e=>e.id===id);if(!entry)throw new AccessError('Pending development not found.',404);return entry;}
 function checkVersion(entry,body){if(!Number.isInteger(body?.version)||body.version!==entry.version)throw new AccessError('A teammate has changed this entry. Reopen it before saving; your current text is still in the form.',409);}
 function match(state,entry){return state.developments.find(d=>d.id===entry.publishedId||d.id===entry.knownExistingId)||duplicateDevelopment(state.developments,entry.data)||((entry.knownExistingName&&duplicateDevelopment(state.developments,{name:entry.knownExistingName}))||null);}
 function view(state,entry,full=false){const published=match(state,entry),issues=pendingIssues(entry.data),status=published?(entry.publishedId?'published':'listed'):entry.archivedAt?'not_required':issues.some(i=>i.kind==='input')?'needs_input':'ready_review';const {data,...safe}=entry;return {...safe,status,issues,publishedId:published?.id||null,publishedName:published?.name||null,assigneeName:(state.users||[]).find(u=>u.id===entry.assignedTo)?.name||'',name:published?.name||data.name,area:published?.area||data.area,priceFrom:published?.priceFrom??data.priceFrom,imageCount:published?.images?.length||data.images?.length||0,...(full?{data}:{}),coverageException:entry.row===57};}
 async function list(check){await initialize(check);const state=await repository.read();guard(check,state);const entries=(state.pendingInputs||[]).filter(e=>e.batchId===batchId).map(e=>view(state,e));return {batchId,title:'Sales team development requests',collectedAt:preparedBatch.collectedAt,entries,assignees:(state.users||[]).filter(u=>u.active&&['admin','broker_admin'].includes(u.role)).map(u=>({id:u.id,name:u.name,role:u.role}))};}
 async function get(id,check){await initialize(check);const state=await repository.read();guard(check,state);return view(state,find(state,id),true);}
 function saveMetadata(state,entry,body){if(body.teamNote!==undefined){if(typeof body.teamNote!=='string'||body.teamNote.length>3000)throw new AccessError('Team notes must be up to 3,000 characters.');entry.teamNote=body.teamNote.trim();}if(body.assignedTo!==undefined&&body.assignedTo!==entry.assignedTo){if(body.assignedTo!==null&&!(state.users||[]).some(u=>u.id===body.assignedTo&&u.active&&['admin','broker_admin'].includes(u.role)))throw new AccessError('Assign an active Admin or Broker admin, or leave unassigned.');entry.assignedTo=body.assignedTo;}}
 async function save(id,body,check,actor){
  await initialize(check);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new AccessError('Send pending input changes.');
  const hasData=Object.hasOwn(body,'data'),data=hasData?partialData(body.data):undefined;
  if(!hasData&&body.assignedTo===undefined&&body.teamNote===undefined)throw new AccessError('Choose an assignee or update team notes before saving.');
  return repository.update(state=>{guard(check,state);const entry=find(state,id);checkVersion(entry,body);if(match(state,entry))throw new AccessError('This development is already published. Edit its published record instead.',409);saveMetadata(state,entry,body);if(hasData)entry.data=data;entry.editedAt=now();entry.updatedAt=now();entry.version++;recordStaff(state,actor,'pending_save',{id,label:entry.data.name});return view(state,entry,true);});
 }
 async function extract(id,body,check,actor){const entry=await get(id,check);checkVersion(entry,body);if(['listed','published'].includes(entry.status))throw new AccessError('This development is already published. Review its existing record instead.',409);const request=sourceRequests.find(r=>r.row===entry.row);let urls=entry.sourceUrls;if(body.url){let u;try{u=new URL(body.url);}catch{throw new AccessError('Enter a valid HTTPS source URL.');}if(u.protocol!=='https:'||u.username||u.password||u.port)throw new AccessError('Use a public HTTPS source URL.');urls=[u.href];}
  const result=await collect({...request,url:urls[0],urls});return repository.update(state=>{guard(check,state);const current=find(state,id);checkVersion(current,body);if(match(state,current))throw new AccessError('A teammate has already published this development.',409);if(result.data){const incoming=partialData(result.data);for(const [k,v]of Object.entries(incoming)){const old=current.data[k];if(old===null||old===undefined||old===''||Array.isArray(old)&&!old.length)current.data[k]=v;}if((entry.data.lat===null||entry.data.lng===null)&&incoming._locationApproximate)current.data._locationApproximate=true;}
   current.sourceStatus=result.sourceStatus;current.attempts=result.attempts;current.collectedAt=result.collectedAt;current.locationNote=result.locationNote||'';current.sourceUrls=[...new Set([...urls,...current.sourceUrls])].slice(0,10);current.version++;current.editedAt=now();current.updatedAt=now();recordStaff(state,actor,'pending_extract',{id,label:current.data.name});return view(state,current,true);});
 }
 async function archive(id,body,check,actor){await initialize(check);if(typeof body.archived!=='boolean')throw new AccessError('Choose whether this entry is required.');return repository.update(state=>{guard(check,state);const entry=find(state,id);checkVersion(entry,body);entry.archivedAt=body.archived?now():null;entry.updatedAt=now();entry.editedAt=now();entry.version++;recordStaff(state,actor,'pending_archive',{id,label:entry.data.name});return view(state,entry,true);});}
 async function publish(id,body,check,actor){await initialize(check);return repository.update(state=>{guard(check,state);const entry=find(state,id);checkVersion(entry,body);if(entry.archivedAt)throw new AccessError('Restore this entry to the work queue before publishing.');if(match(state,entry))throw new AccessError('This development is already published. Open the published record instead.',409);const data=partialData(body.data);if(body._reviewConfirmed!==true)throw new AccessError('Review and confirm every detail and media item before publishing.');if(data._locationApproximate)throw new AccessError('Check and confirm the exact development pin before publishing.');const missing=pendingIssues(data).filter(i=>i.kind==='input');if(missing.length)throw new AccessError(missing.map(i=>i.message).join(' '));let validated;try{validated=validateDevelopment({...data,_reviewConfirmed:true});}catch(e){throw new AccessError(e.message);}
   const published={...validated,id:randomBytes(12).toString('hex'),createdBy:actor.id};rejectDuplicate(state.developments,published);saveMetadata(state,entry,body);state.developments.push(published);entry.data=data;entry.publishedId=published.id;entry.publishedAt=now();entry.updatedAt=now();entry.editedAt=now();entry.version++;recordStaff(state,actor,'stock_add',{id:published.id,label:data.name});recordStaff(state,actor,'pending_publish',{id,label:data.name});return view(state,entry,true);});}
 return {list,get,save,extract,archive,publish};
}
