import {useState} from 'react';
import type {Development} from './types';
import type {StaffRequest} from './staff-types';
interface Difference {field:string;current:unknown;website:unknown;version:string;detectedAt:string}
const labels:Record<string,string>={priceFrom:'Development starting price',unitPrices:'Bedroom starting prices',bedrooms:'Bedroom options',images:'Photography',description:'Description',amenities:'Key features',lat:'Latitude',lng:'Longitude'};
const display=(value:unknown)=>Array.isArray(value)?value.join('\n'):value&&typeof value==='object'?JSON.stringify(value,null,2):String(value??'Not supplied');
export default function SourceReview({items,request,onChange}:{items:Development[];request:StaffRequest;onChange:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const changed=items.map(d=>({...d,changes:Object.values((d as Development&{_refreshConflicts?:Record<string,Difference>})._refreshConflicts||{})})).filter(d=>d.changes.length);
 if(!changed.length)return null;
 async function resolve(id:string,d:Difference,choice:string){setBusy(true);setMessage('');try{await request('source-review',{id,field:d.field,choice,version:d.version});await onChange();setMessage(choice==='keep'?'Manual value kept. This same website value will not be flagged again.':'Website value accepted.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to save the review.');}finally{setBusy(false);}}
 return <section className="admin-panel source-review"><h2>Website changes needing review · {changed.length}</h2><p>These records were edited by your team. Your manual values remain live until you choose otherwise. Where older edits have no field history, all differences are shown for safety.</p>{message&&<p role="status">{message}</p>}{changed.map(d=><details key={d.id}><summary>{d.name} · {d.changes.length} differences</summary>{d.changes.map(change=><section className="source-difference" key={change.field}><h3>{labels[change.field]||change.field}</h3><div className="source-value-grid"><div><strong>Live manual value</strong><pre>{display(change.current)}</pre></div><div><strong>Latest website value</strong><pre>{display(change.website)}</pre></div></div><div className="action-row"><button disabled={busy} className="primary" onClick={()=>void resolve(d.id,change,'keep')}>Keep manual value</button><button disabled={busy} onClick={()=>void resolve(d.id,change,'website')}>Use website value</button></div></section>)}</details>)}</section>;
}
