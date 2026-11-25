import {AccessError} from './access.mjs';
import {forEachBuyerActivityDay,reportRange} from './activity.mjs';
import {isYourFirstHomeSlug} from '../shared/your-first-home.ts';
import {activityPeriods,emptyActivityCounts} from '../shared/activity-overview.ts';

const dayMs=86_400_000;
const day=timestamp=>new Date(timestamp).toISOString().slice(0,10);
const comparison=()=>({current:emptyActivityCounts(),previous:emptyActivityCounts()});
const shareEvents=[
 'personal_link_copy','collection_link_copy','personal_whatsapp_click','collection_whatsapp_click',
 'personal_email_click','collection_email_click',
];

function addStaffCounts(total,counts){
 total.activeDays++;
 total.staffActions+=Object.values(counts).reduce((sum,count)=>sum+count,0);
 total.signIns+=counts.login||0;
 total.collectionsCreated+=counts.collection_create||0;
 total.shares+=shareEvents.reduce((sum,event)=>sum+(counts[event]||0),0);
}

function addBuyerCounts(total,counts){
 total.visits+=counts.page_view||0;
 total.developmentViews+=counts.development_view||0;
 total.favourites+=counts.favourite_add||0;
 total.whatsapp+=counts.whatsapp_click||0;
}

export async function activityOverview(state,visitorRepository,params,{now=Date.now()}={}){
 const period=Number(params.get('days')||30);
 if(!activityPeriods.includes(period))throw new AccessError('Choose a 7, 30 or 90 day activity period.');
 const {from,to,previousFrom,previousTo}=reportRange(new URLSearchParams({
  from:day(now-(period-1)*dayMs),to:day(now),
 }),now);
 const range={from,to,previousFrom,previousTo};
 const startedAt=state.activity?.startedAt||null;
 const comparisonAvailable=Boolean(startedAt&&startedAt.slice(0,10)<=previousFrom);
 const bucketDays=period===7?1:period===30?5:10;
 const first=Date.parse(from);
 const prior=Date.parse(previousFrom);
 const buckets=Array.from({length:period/bucketDays},(_,index)=>{
  const offset=index*bucketDays*dayMs,end=offset+(bucketDays-1)*dayMs;
  return {from:day(first+offset),to:day(first+end),previousFrom:day(prior+offset),previousTo:day(prior+end)};
 });
 const staff=(state.users||[]).map(user=>({
  id:user.id,name:user.name,role:user.role,active:user.active,lastActivityAt:state.activity?.people?.[user.id]?.lastActivityAt||null,
  savedPdfs:0,...comparison(),series:buckets.map(comparison),
 }));
 const people=new Map(staff.map(person=>[person.id,person]));
 const developments=new Map(state.developments.map(({id,name,area})=>[id,{id,name,area}]));
 const collections=(state.collections||[]).filter(collection=>people.has(collection.ownerId)&&!isYourFirstHomeSlug(collection.slug))
  .map(({id,title,ownerId,developmentIds})=>({id,title,ownerId,developmentIds:[...new Set(developmentIds)].filter(id=>developments.has(id))}));
 const byCollection=new Map(collections.map(collection=>[collection.id,collection]));
 const includedDevelopments=new Set(collections.flatMap(collection=>collection.developmentIds));
 for(const brochure of state.brochures||[]){
  const owner=people.get(brochure.ownerId);
  if(owner&&brochure.fileKey)owner.savedPdfs++;
 }

 function destinations(person,date){
  const comparisonKey=date<from?'previous':'current';
  const start=comparisonKey==='previous'?prior:first;
  const bucket=person.series[Math.floor((Date.parse(date)-start)/(bucketDays*dayMs))];
  return [person[comparisonKey],bucket[comparisonKey]];
 }
 for(const {date,userId,counts} of state.activity?.daily||[]){
  const person=people.get(userId);
  if(!person||date<previousFrom||date>to)continue;
  for(const target of destinations(person,date))addStaffCounts(target,counts);
 }

 let generalVisits=0;
 const links=new Map();
 await forEachBuyerActivityDay(visitorRepository,range,startedAt,now,(date,record)=>{
  for(const [id,counts] of Object.entries(record?.people||{})){
   const person=people.get(id);
   if(person)for(const target of destinations(person,date))addBuyerCounts(target,counts);
   else if(date>=from&&id==='unattributed')generalVisits+=counts.page_view||0;
  }
  if(date<from)return;
  for(const entry of Object.values(record?.links||{})){
   if(!people.has(entry.ownerId))continue;
   const collection=entry.kind==='collection'?byCollection.get(entry.resourceId):undefined;
   const kind=entry.kind==='collection'&&!collection?'removed':entry.kind;
   const id=kind+':'+(collection?.id||entry.ownerId);
   const label=collection?.title??({
    personal:'Personal portfolio link',campaign:'Your First Home link',removed:'Removed collections',
   })[kind];
   const link=links.get(id)||{id,ownerId:entry.ownerId,kind,label,visits:0,...(collection&&{collectionId:collection.id})};
   link.visits+=entry.visits;
   links.set(id,link);
  }
 });
 return {
  period,range,startedAt,comparisonAvailable,buckets,staff,collections,generalVisits,
  developments:[...includedDevelopments].map(id=>developments.get(id)),
  links:[...links.values()].sort((a,b)=>b.visits-a.visits||a.label.localeCompare(b.label)),
 };
}
