import locations from './data/your-first-home-locations.json' with {type:'json'};
import {startingPrice} from '../shared/pricing.ts';
import {YOUR_FIRST_HOME_SLUG,YOUR_FIRST_HOME_PHONE,yourFirstHomeCaps,isYourFirstHomeSlug} from '../shared/your-first-home.ts';

export class YourFirstHomeError extends Error {constructor(message,status=422){super(message);this.status=status;}}

export function yourFirstHomeCandidates(state) {
 const saved=state.yourFirstHome;
 return state.developments.filter(d=>!d.sample).map(d=>{
  const recorded=locations.developments[d.id];
  const verified=recorded?.postcode===d.postcode?recorded.borough:null;
  const borough=saved?.boroughs?.[d.id]??verified??'';
  const priceCap=yourFirstHomeCaps[borough]??null, price=startingPrice(d);
  const withinCap=Boolean(priceCap&&price!==null&&price>0&&price<=priceCap);
  return {id:d.id,name:d.name,postcode:d.postcode,borough,priceCap,price,withinCap,
   reason:!priceCap?'Confirm local authority':price===null?'Price to be confirmed':!withinCap?'Above the local price cap':''};
 }).sort((a,b)=>(a.price??Infinity)-(b.price??Infinity)||a.name.localeCompare(b.name));
}

export function yourFirstHomeCollection(state) {
 const saved=state.yourFirstHome,legacy=(state.collections??[]).find(c=>c.slug===YOUR_FIRST_HOME_SLUG);
 const candidates=yourFirstHomeCandidates(state);
 const selected=new Set(saved?.developmentIds??candidates.filter(d=>d.withinCap).map(d=>d.id));
 return {id:saved?.id??legacy?.id??'campaign-your-first-home',slug:YOUR_FIRST_HOME_SLUG,
  title:'Your First Home',campaign:'your-first-home',ownerId:legacy?.ownerId,
  developmentIds:candidates.filter(d=>selected.has(d.id)&&d.withinCap).map(d=>d.id),
  transportDefaults:saved?.transportDefaults??legacy?.transportDefaults,
  _buyerPasswordVersion:saved?saved._buyerPasswordVersion:legacy?._buyerPasswordVersion};
}

export function yourFirstHomeWorkspace(state) {
 const candidates=yourFirstHomeCandidates(state),collection=yourFirstHomeCollection(state);
 return {version:state.yourFirstHome?.version??0,slug:collection.slug,
  developmentIds:state.yourFirstHome?.developmentIds??collection.developmentIds,
  visibleCount:collection.developmentIds.length,whatsapp:state.yourFirstHome?.whatsapp??YOUR_FIRST_HOME_PHONE,
  candidates,updatedAt:state.yourFirstHome?.updatedAt??null};
}

export function updateYourFirstHome(state,body) {
 const previous=yourFirstHomeWorkspace(state),collection=yourFirstHomeCollection(state);
 if(body?.version!==previous.version)throw new YourFirstHomeError('The shared collection changed. Reload it before saving.',409);
 if(!Array.isArray(body.developmentIds)||body.developmentIds.length>200||body.developmentIds.some(id=>typeof id!=='string'||!state.developments.some(d=>d.id===id&&!d.sample)))throw new YourFirstHomeError('Choose existing developments for this collection.');
 const whatsapp=String(body.whatsapp??'').replace(/[\s()+.-]/g,'').replace(/^00/,'').replace(/^0(?=7\d{9}$)/,'44');
 if(!/^[1-9]\d{7,14}$/.test(whatsapp))throw new YourFirstHomeError('Enter a WhatsApp number including the country code.');
 const boroughs={...state.yourFirstHome?.boroughs};
 if(body.boroughs!==undefined){
  if(!body.boroughs||typeof body.boroughs!=='object'||Array.isArray(body.boroughs))throw new YourFirstHomeError('Choose valid local authorities.');
  for(const[id,borough]of Object.entries(body.boroughs)){
   if(!state.developments.some(d=>d.id===id)||typeof borough!=='string'||(borough!==''&&!Object.hasOwn(yourFirstHomeCaps,borough)))throw new YourFirstHomeError('Choose a supported local authority for each development.');
   boroughs[id]=borough;
  }
 }
 state.yourFirstHome={...state.yourFirstHome,id:collection.id,developmentIds:[...new Set(body.developmentIds)],
  whatsapp,boroughs,version:previous.version+1,updatedAt:new Date().toISOString(),
  transportDefaults:collection.transportDefaults,_buyerPasswordVersion:collection._buyerPasswordVersion};
 return state.yourFirstHome;
}

export function yourFirstHomeBroker(state) {
 return {name:'Your First Home team',whatsapp:state.yourFirstHome?.whatsapp??YOUR_FIRST_HOME_PHONE,
  slug:'your-first-home',campaign:'your-first-home'};
}

export function publicYourFirstHome(state,visible) {
 const collection=yourFirstHomeCollection(state),ids=new Set(visible.map(d=>d.id));
 const {_buyerPasswordVersion,ownerId,id,...publicFields}=collection;
 return {...publicFields,brokerName:'Your First Home team',broker:yourFirstHomeBroker(state),
  developmentIds:collection.developmentIds.filter(id=>ids.has(id))};
}

export function campaignDevelopment(state,d) {
 const row=yourFirstHomeCandidates(state).find(row=>row.id===d.id);
 return {...d,yourFirstHome:{borough:row?.borough??'',priceCap:row?.priceCap??null}};
}

export function isYourFirstHomeCollection(collection) {return collection?.campaign==='your-first-home'||isYourFirstHomeSlug(collection?.slug);}
