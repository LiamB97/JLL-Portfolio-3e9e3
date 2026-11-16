import {mergeSource} from './source-review.mjs';
import {getStore} from '@netlify/blobs';
import seed from './data/initial-portfolio.json' with {type:'json'};
import {convertSource} from './sync.mjs';
export class ConflictError extends Error {}
export function portfolioRepository(store=getStore({name:'jll-london-portfolio',consistency:'strong'})) {
 async function read(){return (await store.getWithMetadata('portfolio',{type:'json',consistency:'strong'}))?.data??structuredClone(seed);}
 async function update(change){
  for(let attempt=0;attempt<5;attempt++){
   const current=await store.getWithMetadata('portfolio',{type:'json',consistency:'strong'});
   const next=structuredClone(current?.data??seed);
   const result=change(next);
   const written=await store.setJSON('portfolio',next,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
   if(written.modified)return result;
  }
  throw new ConflictError('Another administrator is updating the collection. Please try again.');
 }
 return {read,update};
}
function mergeStock(state,developments,report){
 const merged=new Map(state.developments.filter(d=>!d.sample).map(d=>[d.id,d]));
 for(const d of developments){
  const old=merged.get(d.id);
  const legacyEdited=state.activity?.timeline?.some(e=>e.event==='stock_edit'&&e.resourceId===d.id);
  merged.set(d.id,mergeSource(old,d,{legacyEdited}));
 }
 state.developments=[...merged.values()];
 const conflicts=state.developments.reduce((count,d)=>count+Object.keys(d._refreshConflicts||{}).length,0);
 state.lastSync={...report,conflicts};
 return state.lastSync;
}
export async function applyStockSnapshot(repository,snapshot=seed){
 const isNewer=state=>snapshot.lastSync.syncedAt>(state.lastSync?.syncedAt??'');
 if(!isNewer(await repository.read()))return null;
 return repository.update(state=>isNewer(state)?mergeStock(state,snapshot.developments,snapshot.lastSync):null);
}
export async function refreshPortfolio(repository,records,guard){
 const ready=[],skipped=[];
 for(const raw of records){try{ready.push(convertSource(raw));}catch(e){skipped.push({name:String(raw.title||'Unknown listing'),reason:e.message});}}
 if(!ready.length)throw Error('No valid London developments found; existing stock was kept.');
 const report={imported:ready.length,skipped,syncedAt:new Date().toISOString(),note:'Manual edits are preserved. Review website differences before accepting them. Missing website listings are retained.'};
 return repository.update(state=>{if(guard)guard(state);return mergeStock(state,ready,report);});
}
