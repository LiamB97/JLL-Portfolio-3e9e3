import {randomBytes} from 'node:crypto';
import {AccessError,publicUser} from './access.mjs';
import {isYourFirstHomeSlug} from '../shared/your-first-home.ts';
export const STAFF_EVENTS=['login','logout','personal_link_created','personal_link_copy','personal_whatsapp_click','personal_email_click','collection_create','collection_update','collection_delete','collection_link_copy','collection_whatsapp_click','collection_email_click','stock_add','stock_edit','stock_remove','stock_sync','invite_create','invite_revoke','user_update','profile_update','draft_save','draft_remove','pending_save','pending_extract','pending_publish','pending_archive'];
export const BUYER_EVENTS=['page_view','development_view','favourite_add','favourite_remove','whatsapp_click','shortlist_copy'];
const DAY=86400000;
const isoDay=ms=>new Date(ms).toISOString().slice(0,10);
export function initializeActivity(state,now=Date.now()){
 const at=new Date(now).toISOString();state.activity||={startedAt:at,daily:[],people:{},timeline:[]};
 if(state.activity.startedAt>at)state.activity.startedAt=at;
}
export function recordStaff(state,actor,event,{id='',label='',count=1,now=Date.now()}={}){
 if(!actor?.id||actor.legacy||!STAFF_EVENTS.includes(event))return;
 initializeActivity(state,now);
 const a=state.activity,at=new Date(now).toISOString(),person=a.people[actor.id]||={counts:{}};
 person.lastActivityAt=at;person.counts[event]=(person.counts[event]||0)+count;if(event==='login')person.lastLoginAt=at;
 a.daily=a.daily.filter(d=>d.date>=isoDay(now-399*DAY));let row=a.daily.find(d=>d.date===isoDay(now)&&d.userId===actor.id);
 if(!row){row={date:isoDay(now),userId:actor.id,counts:{}};a.daily.push(row);}row.counts[event]=(row.counts[event]||0)+count;
 a.timeline.push({id:randomBytes(12).toString('hex'),at,userId:actor.id,role:actor.role,event,resourceId:String(id).slice(0,100),label:String(label).slice(0,100),count});
 a.timeline=a.timeline.filter(e=>e.at>=new Date(now-399*DAY).toISOString()).slice(-5000);
}
export function touchStaff(state,actor,now=Date.now()){
 initializeActivity(state,now);
 const p=state.activity.people[actor.id]||={counts:{}};p.lastActivityAt=new Date(now).toISOString();
}
export function engagementService(repository,{now=Date.now}={}){
 return {async collect(state,body){
  if(body?.consent!=='accepted'||!Array.isArray(body.events)||body.events.length<1||body.events.length>20)throw new AccessError('Send 1–20 consented activity counts.');
  const resolved=[],at=now();
  for(const item of body.events){
   if(!item||!BUYER_EVENTS.includes(item.event))throw new AccessError('Unsupported activity count.');
   let owner=null,c=null;
   if(item.collection){c=(state.collections||[]).find(c=>c.slug===item.collection);owner=c&&(state.users||[]).find(u=>u.id===c.ownerId&&u.active);if(!owner&&!isYourFirstHomeSlug(item.collection))continue;}
   else if(item.broker){owner=(state.users||[]).find(u=>u.shareSlug===item.broker&&u.active);if(!owner)continue;}
   if(['development_view','favourite_add','favourite_remove'].includes(item.event)&&!state.developments.some(d=>d.id===item.development))continue;
   resolved.push({ownerId:owner?.id||'unattributed',event:item.event});
  }
  if(resolved.length)await repository.updateDay(isoDay(at),day=>{day.people||={};for(const r of resolved){const p=day.people[r.ownerId]||={};p[r.event]=(p[r.event]||0)+1;}});
  return {ok:true,recorded:resolved.length,recordedAt:new Date(at).toISOString()};
 }};
}
function dates(from,to){const days=[];for(let ms=Date.parse(from);ms<=Date.parse(to);ms+=DAY)days.push(isoDay(ms));return days;}
const sum=(a,b)=>{for(const [key,value]of Object.entries(b||{}))a[key]=(a[key]||0)+value;return a;};
export function reportRange(params,now=Date.now()){
 const to=params.get('to')||isoDay(now),from=params.get('from')||isoDay(now-29*DAY),valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&isoDay(Date.parse(v))===v;
 if(!valid(from)||!valid(to)||from>to||to>isoDay(now)||from<isoDay(now-365*DAY)||(Date.parse(to)-Date.parse(from))/DAY>=180)throw new AccessError('Choose a date range of up to 180 days within the past year, ending today or earlier.');
 const days=(Date.parse(to)-Date.parse(from))/DAY+1,previousTo=isoDay(Date.parse(from)-DAY),previousFrom=isoDay(Date.parse(from)-days*DAY);
 const role=params.get('role')||'',userId=params.get('user')||'',page=Number(params.get('page')||0),inactiveDays=Number(params.get('inactive')||30);
 if(role&&!['admin','broker_admin','broker'].includes(role)||!Number.isInteger(page)||page<0||page>100||![7,14,30,60,90].includes(inactiveDays))throw new AccessError('Invalid report filters.');
 return {from,to,previousFrom,previousTo,role,userId,page,inactiveDays};
}
export async function activityReport(state,visitorRepository,params,{now=Date.now()}={}){
 const range=reportRange(params,now),activity=state.activity||{daily:[],people:{},timeline:[]},since=activity.startedAt||null;
 const rows=(state.users||[]).filter(u=>(!range.role||u.role===range.role)&&(!range.userId||u.id===range.userId)).map(u=>{
  const p=activity.people[u.id]||{},last=p.lastActivityAt||null;
  return {...publicUser(u),counts:{},previous:{},buyer:{},previousBuyer:{},lifetime:p.counts||{},lastLoginAt:p.lastLoginAt||null,lastActivityAt:last,activeSessions:u.active?(state.sessions||[]).filter(session=>session.userId===u.id&&session.expiresAt>now).length:0,savedCollections:(state.collections||[]).filter(c=>c.ownerId===u.id).length,activeCollections:u.active?(state.collections||[]).filter(c=>c.ownerId===u.id).length:0,personalLinkAvailable:Boolean(u.active&&u.whatsapp&&u.shareSlug),inactive:u.active&&(now-Date.parse(last||u.createdAt)>=range.inactiveDays*DAY)};
 });
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(const d of activity.daily){const row=byId.get(d.userId);if(!row)continue;if(d.date>=range.from&&d.date<=range.to)sum(row.counts,d.counts);else if(d.date>=range.previousFrom&&d.date<=range.previousTo)sum(row.previous,d.counts);}
 const unattributed={},previousUnattributed={};
 // Daily aggregate keys contain no buyer IDs, cookies, IP addresses or raw event payloads.
 const allDays=dates(range.previousFrom,range.to).filter(d=>d>=isoDay(now-399*DAY)&&(!since||d>=since.slice(0,10)));
 for(let i=0;i<allDays.length;i+=12){const batch=await Promise.all(allDays.slice(i,i+12).map(d=>visitorRepository.readDay(d)));for(let j=0;j<batch.length;j++){const date=allDays[i+j],previous=date<range.from;for(const [id,counts]of Object.entries(batch[j]?.people||{})){const row=byId.get(id);if(row)sum(previous?row.previousBuyer:row.buyer,counts);else if(id==='unattributed')sum(previous?previousUnattributed:unattributed,counts);}}}
 const totals={counts:{},previous:{},buyer:{},previousBuyer:{},activeCollections:0,savedCollections:0,activeSessions:0,inactive:0};for(const r of rows){sum(totals.counts,r.counts);sum(totals.previous,r.previous);sum(totals.buyer,r.buyer);sum(totals.previousBuyer,r.previousBuyer);totals.activeCollections+=r.activeCollections;totals.savedCollections+=r.savedCollections;totals.activeSessions+=r.activeSessions;if(r.inactive)totals.inactive++;}
 const events=activity.timeline.filter(e=>byId.has(e.userId)&&e.at.slice(0,10)>=range.from&&e.at.slice(0,10)<=range.to).reverse();
 return {range,startedAt:since,retentionDays:400,timelineLimit:5000,rows,totals,unattributed,previousUnattributed,timeline:params.get('export')==='timeline'?events:events.slice(range.page*100,(range.page+1)*100),timelineTotal:events.length};
}
