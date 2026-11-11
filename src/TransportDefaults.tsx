import {useEffect,useState} from 'react';
import {Check,ChevronDown,Layers,TrainFront} from 'lucide-react';
import StationPicker from './StationPicker';
import type {TransportDefaults as Defaults,TransportNetwork} from './types';
export const emptyTransportDefaults=():Defaults=>({showLines:false,showStations:false,lineIds:[],stationIds:[]});
export default function TransportDefaults({value,onChange}:{value:Defaults;onChange:(value:Defaults)=>void}){
 const [network,setNetwork]=useState<TransportNetwork|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setError('');void fetch('/api/transport').then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(active)setNetwork(data);}).catch(()=>{if(active)setError('Transport choices could not load.');});return()=>{active=false;};},[attempt]);
 const toggle=(key:'lineIds'|'stationIds',id:string)=>onChange({...value,[key]:value[key].includes(id)?value[key].filter(x=>x!==id):[...value[key],id]});
 return <section className="transport-defaults" aria-label="Collection map settings">
  <div className="transport-heading"><span className="transport-heading-icon"><TrainFront size={18}/></span><div><h3>Set the scene for your buyer</h3><p>Choose the transport shown when this collection opens.</p></div><span className="transport-optional">Optional</span></div>
  <div className="transport-toggles">{([{key:'showLines',title:'TfL lines',description:'Show routes on the map',Icon:Layers},{key:'showStations',title:'Stations',description:'Show station pins',Icon:TrainFront}] as const).map(({key,title,description,Icon})=><button type="button" key={key} role="switch" aria-checked={value[key]} aria-label={title} className="transport-toggle" onClick={()=>onChange({...value,[key]:!value[key]})}><Icon size={17}/><span><strong>{title}</strong><small>{description}</small></span><span className="transport-switch" aria-hidden="true"><span/></span></button>)}</div>
  {(value.showLines||value.showStations)&&<div className="transport-selections">{error?<p role="status">{error} <button type="button" className="transport-text-button" onClick={()=>setAttempt(n=>n+1)}>Try again</button></p>:!network?<p role="status">Loading transport choices…</p>:<>
   <details className="transport-picker"><summary><span>Lines<small>{value.lineIds.length?`${value.lineIds.length} selected`:'All lines'}</small></span><ChevronDown size={16}/></summary><div className="transport-picker-body"><p>Choose specific lines, or leave all lines available.</p><div className="transport-line-chips">{network.lines.map(line=><button type="button" key={line.id} aria-pressed={value.lineIds.includes(line.id)} onClick={()=>toggle('lineIds',line.id)}><i style={{background:line.colour}}/>{line.name}{value.lineIds.includes(line.id)&&<Check size={13}/>}</button>)}</div>{value.lineIds.length>0&&<button type="button" className="transport-text-button" onClick={()=>onChange({...value,lineIds:[]})}>Use all lines</button>}</div></details>
   {value.showStations&&<details className="transport-picker"><summary><span>Stations<small>{value.stationIds.length?`${value.stationIds.length} selected`:value.lineIds.length?'All stops on selected lines':'All stations'}</small></span><ChevronDown size={16}/></summary><div className="transport-picker-body"><p>Leave all stops visible, or search for individual stations. Individual stations can be on any line.</p><StationPicker stations={network.stations} selectedIds={value.stationIds} onChange={stationIds=>onChange({...value,stationIds})}/></div></details>}
  </>}</div>}
  <p className="transport-footer">Saved with this collection. Buyers can adjust the view in Map tools.</p>
 </section>;
}
