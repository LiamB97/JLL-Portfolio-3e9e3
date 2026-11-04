import type {Map as VectorMap} from 'maplibre-gl';

// Tint geographic layers individually so roads, labels and transport keep their contrast.
export function styleNeighbourhoodMap(map:VectorMap,dark:boolean){
 const style=map.getStyle(),green=dark?'#304D40':'#D8E8CE';
 for(const layer of style.layers){
  const sourceLayer='source-layer' in layer?layer['source-layer']:'';
  if(dark&&layer.type==='background')map.setPaintProperty(layer.id,'background-color','#131E29');
  if(dark&&layer.type==='symbol'&&layer.layout?.['text-field']){
   map.setPaintProperty(layer.id,'text-color','#CDD4DA');
   map.setPaintProperty(layer.id,'text-halo-color','#131E29');
  }
  if(layer.type==='fill'){
   if(sourceLayer==='water'||/^water(?:$|_)/.test(layer.id))map.setPaintProperty(layer.id,'fill-color',dark?'#254D64':'#C5DFED');
   else if(sourceLayer==='park'||/park|wood|forest|grass/.test(layer.id)){map.setPaintProperty(layer.id,'fill-color',green);map.setPaintProperty(layer.id,'fill-opacity',1);}
   else if((sourceLayer==='landcover'||sourceLayer==='landuse')&&typeof layer.paint?.['fill-color']==='string')map.setPaintProperty(layer.id,'fill-color',[
    'match',['get','class'],['wood','forest','grass','grassland','recreation_ground','garden','village_green','allotments'],
    dark?'#304D40':'#D8E8CE',layer.paint?.['fill-color']??(dark?'#1F2A35':'#F4F3EF')
   ]);
  }
  if(layer.type==='line'&&sourceLayer==='waterway')map.setPaintProperty(layer.id,'line-color',dark?'#3B6882':'#B5D7E9');
 }
 const source=Object.entries(style.sources).find(([,s])=>s.type==='vector')?.[0];
 const before=style.layers.find(l=>l.type==='fill')?.id;
 if(source)for(const sourceLayer of ['landcover','landuse'])map.addLayer({id:'london-green-'+sourceLayer,type:'fill',source,'source-layer':sourceLayer,filter:['any',['in',['get','class'],['literal',['wood','forest','grass','grassland','meadow','park','recreation_ground','garden','village_green','allotments','cemetery','golf_course']]],['in',['get','subclass'],['literal',['park','garden','grass','recreation_ground']]]],paint:{'fill-color':green,'fill-opacity':1}},before);
}
