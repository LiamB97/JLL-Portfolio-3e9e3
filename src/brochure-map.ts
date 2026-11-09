import type {Development} from './types';
import type {BrochureMapImage} from './brochure-map-layout';

const areaLabels=[
 ['Paddington',51.517,-.177],['Marylebone',51.52,-.153],['Mayfair',51.509,-.148],['Soho',51.514,-.133],['Holborn',51.519,-.117],
 ['Covent Garden',51.512,-.123],['Knightsbridge',51.5,-.163],['Belgravia',51.496,-.153],['Victoria',51.493,-.143],
 ['Westminster',51.499,-.13,true],['City of London',51.515,-.091,true],['South Bank',51.505,-.112],['Bankside',51.506,-.097],
 ['Vauxhall',51.486,-.124],['Pimlico',51.488,-.14],['Chelsea',51.487,-.169],['Battersea',51.475,-.156],
 ['Canary Wharf',51.505,-.02],['Greenwich',51.482,-.009],['Stratford',51.542,-.003],['Islington',51.539,-.103],['Camden Town',51.539,-.144],
] as const;

// Same public, key-free vector basemap as the portfolio. Rendering is local to
// the broker's browser; no screenshot service or new external account is needed.
export async function brochureMap(items:Development[]):Promise<BrochureMapImage>{
 if(!items.length||items.some(d=>!Number.isFinite(d.lat)||!Number.isFinite(d.lng)))throw Error('Check the selected development locations before creating the map.');
 const message='The location map could not load. Try again, or turn off “Include a location map” to generate the brochure without it.';
 const response=await fetch('https://tiles.openfreemap.org/styles/positron',{signal:AbortSignal.timeout(15000)}).catch(()=>{throw Error(message);});
 if(!response.ok)throw Error(message);
 const style=await response.json();
 const [maplibre,{default:workerUrl}]=await Promise.all([import('maplibre-gl'),import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')]);
 maplibre.setWorkerUrl(workerUrl);
 const node=document.createElement('div');Object.assign(node.style,{position:'fixed',left:'-10000px',top:'0',width:'1500px',height:'1260px',pointerEvents:'none'});node.setAttribute('aria-hidden','true');document.body.append(node);
 let map:InstanceType<typeof maplibre.Map>|undefined;
 try{
  return await new Promise<BrochureMapImage>((resolve,reject)=>{
   const timer=window.setTimeout(()=>reject(Error(message)),40000);
   const fail=()=>{clearTimeout(timer);reject(Error(message));};
   try{
    map=new maplibre.Map({container:node,style,interactive:false,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},pixelRatio:1,fadeDuration:0,renderWorldCopies:false});
    map.on('error',fail);
    const lngs=items.map(d=>d.lng),lats=items.map(d=>d.lat),cx=(Math.min(...lngs)+Math.max(...lngs))/2,cy=(Math.min(...lats)+Math.max(...lats))/2;
    const dx=Math.max(.035,(Math.max(...lngs)-Math.min(...lngs))/2),dy=Math.max(.022,(Math.max(...lats)-Math.min(...lats))/2);
    map.fitBounds([[cx-dx,cy-dy],[cx+dx,cy+dy]],{padding:{top:145,right:245,bottom:130,left:245},duration:0,maxZoom:14});
    map.once('load',()=>{
     if(!map)return;try{
     for(const layer of map.getStyle().layers){
      const source=('source-layer' in layer?layer['source-layer']:'')||'';
      if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#F2F2F0');
      if(layer.type==='fill'){
       if(source==='water')map.setPaintProperty(layer.id,'fill-color','#CBDEEC');
       else if(source==='park'||/park|wood|forest|grass/.test(layer.id)){map.setPaintProperty(layer.id,'fill-color','#DBE7CF');map.setPaintProperty(layer.id,'fill-opacity',1);}
       else if(source==='building')map.setPaintProperty(layer.id,'fill-color','#E6E5E1');
       else if(['landuse','landcover'].includes(source))map.setPaintProperty(layer.id,'fill-color',['match',['get','class'],['wood','forest','grass','grassland','park','garden','recreation_ground','village_green','allotments','cemetery'],'#DBE7CF','#F2F2F0']);
      }
      if(layer.type==='line'&&source==='transportation'&&!/rail|tunnel/.test(layer.id))map.setPaintProperty(layer.id,'line-color','#FFFFFF');
      if(layer.type==='symbol'){
       if(/place.*(?:suburb|neighbourhood|city)|poi/.test(layer.id))map.setLayoutProperty(layer.id,'visibility','none');
       else{map.setPaintProperty(layer.id,'text-color','#6B7783');map.setPaintProperty(layer.id,'text-halo-color','#FFFFFF');}
      }
     }
     map.once('idle',()=>{requestAnimationFrame(()=>{
      try{if(!map)return;const project=(lng:number,lat:number)=>{const p=map!.project([lng,lat]);return {x:p.x/1500,y:p.y/1260};};
       const result:BrochureMapImage={image:map.getCanvas().toDataURL('image/jpeg',.9),points:items.map(d=>({id:d.id,...project(d.lng,d.lat)})),areas:areaLabels.map(([name,lat,lng,major])=>({name,...project(lng,lat),major})).filter(p=>p.x>.05&&p.x<.95&&p.y>.04&&p.y<.94),attribution:'© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap'};
       clearTimeout(timer);resolve(result);
      }catch{fail();}
     });});
     }catch{fail();}
    });
   }catch{fail();}
  });
 }finally{map?.remove();node.remove();}
}
