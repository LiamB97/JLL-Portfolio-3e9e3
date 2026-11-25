import {tflJson} from './transport.mjs';
import {commutePlace,fullCommutePostcode} from '../shared/commute-destinations.ts';
export class CommuteError extends Error{constructor(message,status=422){super(message);this.status=status;}}
const publicModes=new Set(['tube','bus','public-bus','dlr','overground','elizabeth-line','national-rail','train','tram','walking','interchange-keep-sitting','interchange-secure','replacement-bus']);
export function commutePostcode(value){const postcode=fullCommutePostcode(value);if(!postcode)throw new CommuteError('Choose a suggested destination or enter a full UK postcode.');return postcode;}
export function commuteOptions(body,now=Date.now()){
 const place=commutePlace(body.destinationId);
 if(body.destinationId!==undefined&&!place)throw new CommuteError('Choose a destination from the suggestions.');
 const destination=place?{place}:{postcode:commutePostcode(body.postcode)},mode=body.mode||'public';
 if(!['public','walking','cycle'].includes(mode))throw new CommuteError('Choose public transport, walking or cycling.');
 const date=String(body.date||''),time=String(body.time||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new CommuteError('Choose a valid arrival date and time.');
 const day=Date.parse(date+'T00:00:00Z'),today=Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==date||date<today||day>Date.parse(today+'T00:00:00Z')+28*86400000)throw new CommuteError('Choose a travel date between today and 28 days from now.');
 return {...destination,mode,date,time};
}
export function parseCommuteJourney(data,mode){
 const permitted=mode==='walking'?new Set(['walking']):mode==='cycle'?new Set(['cycle','walking']):publicModes;
 const journeys=(data?.journeys||[]).filter(j=>Number.isFinite(j.duration)&&j.duration>=0&&Array.isArray(j.legs)&&j.legs.length&&j.legs.every(l=>permitted.has(l.mode?.id))&&(mode!=='cycle'||j.legs.some(l=>l.mode?.id==='cycle'))).sort((a,b)=>a.duration-b.duration);
 const journey=journeys[0];if(!journey)return null;
 return {durationMinutes:Math.ceil(journey.duration),modes:[...new Set(journey.legs.map(l=>l.mode?.name||l.mode.id).filter(Boolean))],arrival:typeof journey.arrivalDateTime==='string'?journey.arrivalDateTime:null,departure:typeof journey.startDateTime==='string'?journey.startDateTime:null};
}
export function commuteService({get=tflJson,fetcher=fetch,now=Date.now}={}){
 const destinations=new Map(),routes=new Map(),pending=new Map();
 async function destination(postcode){
  const saved=destinations.get(postcode);if(saved&&now()-saved.at<3600000)return saved.value;
  const key='postcode:'+postcode;if(pending.has(key))return pending.get(key);
  const task=(async()=>{const r=await fetcher('https://api.postcodes.io/postcodes/'+encodeURIComponent(postcode),{signal:AbortSignal.timeout(6000),headers:{Accept:'application/json'}});if(r.status===404)throw new CommuteError('That postcode could not be found. Check the full postcode.');if(!r.ok)throw new CommuteError('Postcode lookup is unavailable. Please try again.',503);const {result}=await r.json();if(!result||!Number.isFinite(result.latitude)||!Number.isFinite(result.longitude))throw new CommuteError('That postcode could not be located.');const value={postcode,lat:result.latitude,lng:result.longitude};if(destinations.size>=200)destinations.clear();destinations.set(postcode,{at:now(),value});return value;})();
  pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 }
 async function route(d,target,options){
  const key=JSON.stringify([d.lat,d.lng,target.lat,target.lng,options.date,options.time,options.mode]);const cached=routes.get(key);if(cached&&now()-cached.at<10*60000)return cached.value;
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{const query=new URLSearchParams({date:options.date.replaceAll('-',''),time:options.time.replace(':',''),timeIs:'Arriving',journeyPreference:'LeastTime',nationalSearch:'true',mode:options.mode==='public'?'tube,bus,dlr,overground,elizabeth-line,national-rail,tram,walking':options.mode});if(options.mode==='cycle')query.set('cyclePreference','AllTheWay');
   try{const data=await get(`/Journey/JourneyResults/${d.lat},${d.lng}/to/${target.lat},${target.lng}?${query}`);const value=parseCommuteJourney(data,options.mode);if(value){if(routes.size>=2000)routes.clear();routes.set(key,{at:now(),value});}return value;}catch{return null;}
  })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 }
 return async(body,developments)=>{
  if(!body||typeof body!=='object'||Array.isArray(body))throw new CommuteError('Enter a valid commute request.');
  const options=commuteOptions(body,now());if(!Array.isArray(body.developmentIds)||!body.developmentIds.length||body.developmentIds.length>5||body.developmentIds.some(id=>typeof id!=='string'))throw new CommuteError('Check between 1 and 5 developments per request.');
  const ids=[...new Set(body.developmentIds)];const homes=ids.map(id=>developments.find(d=>d.id===id));if(homes.some(d=>!d))throw new CommuteError('Some developments have changed. Refresh the portfolio.',409);
  let target;
  if(options.place){const {id,name,lat,lng}=options.place;target={id,name,lat,lng};}
  else try{target=await destination(options.postcode);}catch(e){if(e instanceof CommuteError)throw e;throw new CommuteError('Postcode lookup is temporarily unavailable. Please try again.',503);}
  const results=await Promise.all(homes.map(async d=>{const value=await route(d,target,options);return {id:d.id,status:value?'ok':'unavailable',...value};}));
  return {destination:target,results,source:'TfL Journey Planner',checkedAt:new Date(now()).toISOString(),date:options.date,time:options.time,mode:options.mode};
 };
}
export const defaultCommute=commuteService();
