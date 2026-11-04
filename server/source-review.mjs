import {createHash} from 'node:crypto';
export const sourceFields=['name','area','postcode','lat','lng','priceFrom','unitPrices','bedrooms','propertyTypes','amenities','images','videos','description','status','translations'];
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const version=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
export function markManualEdit(old,data,actor){
 const next={...old,...data},fields=new Set(old._manualFields||[]),conflicts=structuredClone(old._refreshConflicts||{});
 for(const key of sourceFields)if(!equal(old[key],data[key])&&data[key]!==undefined){if(old._sourceSnapshot&&equal(old._sourceSnapshot[key],data[key]))fields.delete(key);else fields.add(key);const change=conflicts[key];if(change){if(equal(data[key],change.website)){delete conflicts[key];fields.delete(key);}else conflicts[key]={...change,current:data[key],version:version([key,data[key],change.website])};}}
 return {...next,_manualFields:[...fields],_refreshConflicts:conflicts,updatedBy:actor.id,_manualEditedAt:new Date().toISOString()};
}
export function mergeSource(old,incoming,{legacyEdited=false}={}){
 const snapshot=Object.fromEntries(sourceFields.map(key=>[key,incoming[key]??null]));
 if(!old)return {...incoming,_sourceSnapshot:snapshot,_manualFields:[],_refreshConflicts:{}};
 const protectedFields=new Set(old._manualFields||[]);
 // Older versions recorded the editing action but not which fields changed.
 if(!old._sourceSnapshot&&(legacyEdited||old.updatedBy))for(const key of sourceFields)protectedFields.add(key);
 if(Object.keys(old.unitPrices||{}).length)protectedFields.add('unitPrices');
 if(protectedFields.has('unitPrices')&&Object.keys(old.unitPrices||{}).some(b=>!incoming.bedrooms.includes(Number(b))))protectedFields.add('bedrooms');
 const next={...old,...incoming},conflicts={},dismissed=old._sourceDismissed||{};
 for(const key of sourceFields){
  if(key==='unitPrices'&&!Object.keys(incoming.unitPrices||{}).length){next.unitPrices=old.unitPrices||{};continue;}
  if(protectedFields.has(key)){
   next[key]=old[key];
   if(!equal(old[key],incoming[key])&&!equal(dismissed[key],incoming[key]))conflicts[key]={field:key,current:old[key]??null,website:incoming[key]??null,detectedAt:incoming.lastSyncedAt,version:version([key,old[key]??null,incoming[key]??null])};
  }
 }
 return {...next,_manualFields:[...protectedFields],_sourceSnapshot:snapshot,_refreshConflicts:conflicts};
}
export function resolveSourceField(old,field,choice,expected){
 if(!sourceFields.includes(field)||typeof expected!=='string')throw Error('Choose a current website field change.');
 const conflict=old._refreshConflicts?.[field];if(!conflict||conflict.version!==expected||!equal(old[field],conflict.current))throw Error('This website change has moved on. Reload and review it again.');
 if(!['keep','website'].includes(choice))throw Error('Choose Keep manual value or Use website value.');
 const next=structuredClone(old);delete next._refreshConflicts[field];
 if(choice==='website'){next[field]=conflict.website;if(field==='description'){next.translations={};next._manualFields=(next._manualFields||[]).filter(k=>k!=='translations');delete next._refreshConflicts.translations;}next._manualFields=(next._manualFields||[]).filter(k=>k!==field);if(next._sourceDismissed)delete next._sourceDismissed[field];}
 else{next._sourceDismissed||={};next._sourceDismissed[field]=conflict.website;}
 return next;
}
