import {CENTRAL_LONDON} from './map-view';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '@maplibre/maplibre-gl-leaflet';
import {GraduationCap, Landmark, Layers, TrainFront, AlertCircle, SlidersHorizontal,LocateFixed,RotateCcw} from 'lucide-react';
import Modal from './Modal';
import StationPicker from './StationPicker';
import {landmarks} from './explore';
import {universities} from './universities';
import {styleNeighbourhoodMap} from './map-style';
import {useLocale} from './i18n';
import type {Development, TransportNetwork, TransportDefaults} from './types';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
const osmAttribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const vectorAttribution='<a href="https://openfreemap.org">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org">OpenMapTiles</a>';
const universityIcon=L.divIcon({className:'university-pin',iconSize:[26,26],iconAnchor:[13,13],html:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 10l10-5 10 5-10 5-10-5zM6 12v5c3 3 9 3 12 0v-5m4-2v6"/></svg>'});
const stationIcon=L.divIcon({className:'highlighted-station-pin',iconSize:[36,36],iconAnchor:[18,18],html:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8 17l-2 4m10-4 2 4M9 14h.01M15 14h.01"/></svg>'});
function mapLabel(text:string){const label=document.createElement('span');label.textContent=text;return label;}
function frameOptions(m:L.Map):L.FitBoundsOptions{
 // Read the actual overlay bounds, so framing also fits translated controls and
 // short landscape viewports. Desktop and Split controls remain in normal flow.
 const toolbar=m.getContainer().closest('.discovery-page')?.querySelector<HTMLElement>('.discovery-toolbar');
 const overlay=toolbar&&getComputedStyle(toolbar).position==='absolute';
 const top=overlay?Math.max(24,toolbar.getBoundingClientRect().bottom-m.getContainer().getBoundingClientRect().top+16):24;
 const size=m.getSize();
 return {paddingTopLeft:[24,Math.min(top,size.y*.45)],paddingBottomRight:[24,Math.min(84,size.y*.25)],maxZoom:14};
}

function stationPopup(station:TransportNetwork['stations'][number], network:TransportNetwork, action?:{label:string;run:()=>void}) {
  const popup=document.createElement('div');popup.className='transport-popup';
  const name=document.createElement('strong');name.textContent=station.name;popup.append(name);
  for(const id of station.lineIds || []) {
    const line=network.lines.find(l=>l.id===id);if(!line)continue;
    const badge=document.createElement('div');badge.className='transport-popup-line';
    const swatch=document.createElement('i');swatch.style.background=line.colour;
    badge.append(swatch,document.createTextNode(line.name));popup.append(badge);
  }
  if(action){const button=document.createElement('button');button.type='button';button.className='station-highlight-action';button.textContent=action.label;button.addEventListener('click',action.run);popup.append(button);}
  return popup;
}
export default function PortfolioMap({items, selected, onSelect, network, transportError,featuredIds=[],favouriteIds=[],favouritesOnly=false,transportDefaults,commuteDestination,commuteTimes={},resetKey=0,collectionFrameKey=0,dimOthers=true,onDimOthers,onReset}:{items:Development[];selected:string|null;onSelect:(id:string)=>void;network:TransportNetwork|null;transportError:string;featuredIds?:string[];favouriteIds?:string[];favouritesOnly?:boolean;transportDefaults?:TransportDefaults;commuteDestination?:{postcode:string;lat:number;lng:number};commuteTimes?:Record<string,number>;resetKey?:number;collectionFrameKey?:number;dimOthers?:boolean;onDimOthers?:()=>void;onReset?:()=>void}) {
  const {t,dark}=useLocale();
  const lastView=useRef<{centre:L.LatLngExpression;zoom:number}>({centre:CENTRAL_LONDON.centre,zoom:CENTRAL_LONDON.zoom});
  const el=useRef<HTMLDivElement>(null), map=useRef<L.Map|null>(null);
  const markers=useRef<L.MarkerClusterGroup|null>(null), lines=useRef<L.LayerGroup|null>(null), stationLayer=useRef<L.LayerGroup|null>(null),featuredLayer=useRef<L.LayerGroup|null>(null);
  const [showLines,setShowLines]=useState(false),[showStations,setShowStations]=useState(false),[failed,setFailed]=useState(false),[baseReady,setBaseReady]=useState(false);
  const commuteLayer=useRef<L.LayerGroup|null>(null);
  const landmarkLayer=useRef<L.LayerGroup|null>(null);
  const universityLayer=useRef<L.LayerGroup|null>(null);
  const [showLandmarks,setShowLandmarks]=useState(false),[showUniversities,setShowUniversities]=useState(false),[toolsOpen,setToolsOpen]=useState(false);
  const [lineFilter,setLineFilter]=useState<string[]>([]);
  const [stationFilter,setStationFilter]=useState<string[]>([]);
  useEffect(()=>{setShowLines(transportDefaults?.showLines??false);setShowStations(transportDefaults?.showStations??false);setLineFilter(transportDefaults?.lineIds??[]);setStationFilter(transportDefaults?.stationIds??[]);},[transportDefaults]);
  const collectionActive=useRef(false);collectionActive.current=featuredIds.length>0&&dimOthers;
  const shownLines=useMemo(()=>network?.lines.filter(l=>!lineFilter.length||lineFilter.includes(l.id))||[],[network,lineFilter]);
  const shownStations=useMemo(()=>network?.stations.filter(station=>stationFilter.length
    ? station.id && stationFilter.includes(station.id)
    : !lineFilter.length || station.lineIds?.some(id=>lineFilter.includes(id)))??[],[network,stationFilter,lineFilter]);
  const changeStations=useCallback((ids:string[])=>{
    setStationFilter(ids);
    if(!ids.some(id=>!stationFilter.includes(id)))return;
    const m=map.current,selected=network?.stations.filter(station=>station.id&&ids.includes(station.id))??[];
    if(!m||!selected.length)return;
    if(selected.length===1)m.setView([selected[0].lat,selected[0].lng],Math.max(13,m.getZoom()),{animate:false});
    else m.fitBounds(L.latLngBounds(selected.map(({lat,lng})=>[lat,lng])),frameOptions(m));
  },[network,stationFilter]);
  useEffect(()=>{
    if(!el.current)return;setBaseReady(false);setFailed(false);
    const m=L.map(el.current,{zoomControl:false,scrollWheelZoom:true,minZoom:8,maxZoom:19}).setView(lastView.current.centre,lastView.current.zoom);map.current=m;const reportZoom=()=>m.getContainer().setAttribute('data-zoom',String(m.getZoom()));reportZoom();m.on('zoomend',reportZoom);
    L.control.zoom({position:'bottomright'}).addTo(m);
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution(osmAttribution);
    m.attributionControl.addAttribution('Powered by <a href="https://tfl.gov.uk">TfL Open Data</a>');
    m.createPane('transportLines');m.getPane('transportLines')!.style.zIndex='410';
    m.createPane('landmarks');m.getPane('landmarks')!.style.zIndex='430';
    m.createPane('transportStations');m.getPane('transportStations')!.style.zIndex='450';
    m.createPane('universities');m.getPane('universities')!.style.zIndex='510';
    m.createPane('highlightedStations');m.getPane('highlightedStations')!.style.zIndex='620';
    let vector:L.MaplibreGL|null=null, fallback=false, vectorLoaded=false;
    const rasterFallback=()=>{if(fallback)return;fallback=true;vector?.remove();m.attributionControl.removeAttribution(vectorAttribution);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:osmAttribution,maxZoom:19}).on('load',()=>setBaseReady(true)).on('tileerror',()=>setFailed(true)).addTo(m);};
    try{vector=L.maplibreGL({style:'https://tiles.openfreemap.org/styles/'+(dark?'dark':'positron'),attributionControl:false,interactive:false}).addTo(m);m.attributionControl.addAttribution(vectorAttribution);}catch{rasterFallback();}
    const gl=vector?.getMaplibreMap();
    const styleTimeout=window.setTimeout(()=>{if(!vectorLoaded)rasterFallback();},12000);
    gl?.on('load',()=>{
      vectorLoaded=true;window.clearTimeout(styleTimeout);setFailed(false);setBaseReady(true);
      styleNeighbourhoodMap(gl,dark);
      const style=gl.getStyle(),source=Object.entries(style.sources).find(([,s])=>s.type==='vector')?.[0];
      if(!source)return;
      const universityFilter=['any',['==',['get','class'],'college'],['==',['get','class'],'university'],['==',['get','subclass'],'university']] as import('maplibre-gl').ExpressionSpecification;
      gl.addLayer({id:'london-university-points',type:'circle',source,'source-layer':'poi',minzoom:13,filter:universityFilter,paint:{'circle-radius':3,'circle-color':'#5a6890','circle-stroke-color':'#fff','circle-stroke-width':1}});
      gl.addLayer({id:'london-university-labels',type:'symbol',source,'source-layer':'poi',minzoom:13,filter:universityFilter,layout:{'text-field':['coalesce',['get','name:en'],['get','name:latin'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':14,'text-anchor':'left','text-offset':[.6,0],'text-max-width':13},paint:{'text-color':dark?'#b6bbd2':'#536183','text-halo-color':dark?'#1F2A35':'#fff','text-halo-width':2}});
      gl.addLayer({id:'london-local-places',type:'symbol',source,'source-layer':'poi',minzoom:16,filter:['!',universityFilter],layout:{'text-field':['coalesce',['get','name:en'],['get','name:latin'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':14,'text-max-width':12},paint:{'text-color':dark?'#a3ada6':'#8b938d','text-halo-color':dark?'#1F2A35':'#fff','text-halo-width':1.5}});
    });
    commuteLayer.current=L.layerGroup().addTo(m);
    landmarkLayer.current=L.layerGroup().addTo(m);
    universityLayer.current=L.layerGroup().addTo(m);
    markers.current=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:40,spiderfyOnMaxZoom:true,iconCreateFunction:cluster=>L.divIcon({html:`<span>${cluster.getChildCount()}</span>`,className:'development-cluster'+(collectionActive.current?' subdued-cluster':''),iconSize:[42,42],iconAnchor:[21,21]})}).addTo(m);
    lines.current=L.layerGroup().addTo(m);stationLayer.current=L.layerGroup().addTo(m);featuredLayer.current=L.layerGroup().addTo(m);
    const resize=new ResizeObserver(()=>m.invalidateSize({pan:false}));resize.observe(el.current);
    return()=>{window.clearTimeout(styleTimeout);resize.disconnect();m.stop();
      // Leaflet 1.9 leaves its CSS zoom-completion timeout pending after remove().
      // End that animation before removing the pane so a theme/view switch is safe.
      (m as L.Map & {_animatingZoom?:boolean})._animatingZoom=false;
      lastView.current={centre:m.getCenter(),zoom:m.getZoom()};m.remove();map.current=null;};
  },[dark]);
  useEffect(()=>{
    const group=markers.current,featured=featuredLayer.current;if(!group||!featured)return;group.clearLayers();featured.clearLayers();
    for(const d of items){
      const highlighted=featuredIds.includes(d.id),saved=favouriteIds.includes(d.id);
      const icon=L.divIcon({className:'development-pin-wrap',html:`<span class="development-pin ${d.id===selected?'active':''} ${highlighted?'featured-pin':''} ${saved?'favourite-pin':''}">${highlighted?'<svg class="pin-feature-star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/></svg>':saved?'<svg class="pin-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>':'<span class="pin-centre"></span>'}${highlighted&&saved?'<b class="pin-saved-badge">♥</b>':''}</span>`,iconSize:highlighted?[46,54]:[34,40],iconAnchor:highlighted?[23,50]:[17,38]});
      const marker=L.marker([d.lat,d.lng],{icon,keyboard:true,title:d.name+(highlighted?' · '+t('FEATURED'):'')+(saved?' · '+t('Saved to favourites'):''),opacity:dimOthers&&featuredIds.length&&!highlighted&&!saved&&d.id!==selected ? 0.32 : 1,zIndexOffset:d.id===selected?3000:highlighted?2000:saved?1000:0});
      if(commuteTimes[d.id]!==undefined){const label=document.createElement('span');label.textContent=d.name+' · '+commuteTimes[d.id]+' min commute';marker.bindTooltip(label);}
      marker.on('add',()=>marker.getElement()?.setAttribute('aria-label',`${d.name}${highlighted?', '+t('FEATURED'):''}${saved?', '+t('Saved to favourites'):''}`)).on('click',()=>onSelect(d.id)).addTo(highlighted||saved?featured:group);
    }
  },[items,selected,onSelect,featuredIds,favouriteIds,commuteTimes,dimOthers,dark,t]);
  useEffect(()=>{
    const m=map.current,group=landmarkLayer.current;if(!m||!group)return;
    function render(){
      group!.clearLayers();const zoom=m!.getZoom();if(!showLandmarks||zoom<11)return;
      const labels:L.Bounds[]=[],viewport=m!.getBounds().pad(.1);
      for(const place of [...landmarks].sort((a,b)=>a.minZoom-b.minZoom)){
        if(zoom<place.minZoom||!viewport.contains([place.lat,place.lng]))continue;
        const position=m!.latLngToContainerPoint([place.lat,place.lng]);
        const bounds=L.bounds([position.x+8,position.y-10],[position.x+8+Math.min(260,place.name.length*7+14),position.y+10]);
        const permanent=zoom>=(place.minZoom===11?11:13)&&!labels.some(other=>other.intersects(bounds));
        if(permanent)labels.push(bounds);
        const label=document.createElement('span');label.textContent=place.name;
        L.circleMarker([place.lat,place.lng],{pane:'landmarks',radius:place.minZoom===11?4:3.5,color:dark?'#E0C6AD':'#003E51',fillColor:dark?'#131E29':'#fff',fillOpacity:1,weight:1.7})
          .bindTooltip(label,{permanent,direction:'right',offset:[5,0],className:'landmark-label'})
          .on('add',event=>{(event.target as L.CircleMarker).getElement()?.setAttribute('aria-label',place.name);}).addTo(group!);
      }
    }
    render();m.on('moveend',render);return()=>{m.off('moveend',render);};
  },[showLandmarks,dark]);
  useEffect(()=>{
    const m=map.current,group=universityLayer.current;if(!m||!group)return;
    function render(){
      group!.clearLayers();if(!showUniversities)return;
      const viewport=m!.getBounds().pad(.15),labels:L.Bounds[]=[];
      for(const university of universities){
        const location:L.LatLngTuple=[university.lat,university.lng];
        if(!viewport.contains(location))continue;
        const point=m!.latLngToContainerPoint(location);
        const bounds=L.bounds([point.x-14,point.y-16],[point.x+Math.min(200,university.name.length*7+26),point.y+16]);
        const permanent=!labels.some(label=>label.intersects(bounds));
        if(permanent)labels.push(bounds);
        L.marker(location,{icon:universityIcon,pane:'universities',title:university.name})
          .bindTooltip(mapLabel(university.name),{permanent,direction:'right',offset:[15,0],className:'university-label'})
          .on('add',event=>(event.target as L.Marker).getElement()?.setAttribute('aria-label',university.name)).addTo(group!);
      }
    }
    render();m.on('moveend',render);return()=>{m.off('moveend',render);};
  },[showUniversities,dark]);
  const framedFavourites=useRef(false);
  useEffect(()=>{if(!favouritesOnly){framedFavourites.current=false;return;}if(framedFavourites.current||!items.length||!map.current)return;map.current.fitBounds(L.latLngBounds(items.map(d=>[d.lat,d.lng] as [number,number])),frameOptions(map.current));framedFavourites.current=true;},[favouritesOnly,items,dark]);
  const framedCollection=useRef('');
  useEffect(()=>{
    if(!collectionFrameKey||favouritesOnly||commuteDestination)return;
    const homes=items.filter(d=>featuredIds.includes(d.id));
    if(!homes.length)return;
    // Frame only explicitly selected, visible stations, never whole routes or
    // every stop on a selected line. Recompute when the network arrives later.
    const stations=transportDefaults?.showStations
      ?network?.stations.filter(s=>s.id&&transportDefaults.stationIds.includes(s.id))||[]
      :[];
    const points=[...homes,...stations]
      .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng))
      .map(p=>[p.lat,p.lng] as [number,number]);
    const key=collectionFrameKey+'|'+JSON.stringify(points)+'|'+items.length;
    if(!points.length||key===framedCollection.current)return;
    const m=map.current;
    if(m){

      m.fitBounds(L.latLngBounds(points),frameOptions(m));
      framedCollection.current=key;
    }
  },[featuredIds,items,network,transportDefaults,dark,favouritesOnly,commuteDestination,collectionFrameKey]);
  useEffect(()=>{if(!resetKey)return;const m=map.current;if(m){m.stop();m.setView(CENTRAL_LONDON.centre,CENTRAL_LONDON.zoom,{animate:false});}setShowLines(false);setShowStations(false);setShowLandmarks(false);setShowUniversities(false);setLineFilter([]);setStationFilter([]);setToolsOpen(false);framedCollection.current='';framedFavourites.current=false;},[resetKey]);
  const framedCommute=useRef('');
  useEffect(()=>{
    const layer=commuteLayer.current,m=map.current;if(!layer||!m)return;layer.clearLayers();
    if(!commuteDestination){framedCommute.current='';return;}
    const destination=commuteDestination;
    const label=document.createElement('span');label.textContent='Commute destination: '+destination.postcode;
    L.circleMarker([destination.lat,destination.lng],{radius:10,color:dark?'#E0C6AD':'#003E51',fillColor:dark?'#003E51':'#fff',fillOpacity:1,weight:4}).bindTooltip(label,{permanent:true,direction:'right',className:'commute-destination-label'}).addTo(layer);
    const points=[...items,destination].map(p=>[p.lat,p.lng] as [number,number]),key=JSON.stringify(points);
    if(key!==framedCommute.current){m.fitBounds(L.latLngBounds(points),frameOptions(m));framedCommute.current=key;}
  },[commuteDestination,items,dark]);
  useEffect(()=>{const d=items.find(d=>d.id===selected);if(d)map.current?.flyTo([d.lat,d.lng],14,{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:.7});},[selected,dark]);
  useEffect(()=>{
    const group=lines.current;if(!group)return;group.clearLayers();if(!showLines)return;
    for(const line of shownLines) for(const path of line.paths){
      L.polyline(path,{pane:'transportLines',color:dark?'#1F2A35':'#fff',weight:6,opacity:.9,interactive:false}).addTo(group);
      L.polyline(path,{pane:'transportLines',color:line.colour,weight:3.5,opacity:.9}).bindTooltip(line.name,{sticky:true}).addTo(group);
    }
  },[showLines,shownLines,dark]);
  useEffect(()=>{
    const group=stationLayer.current;if(!group)return;group.clearLayers();if(!showStations||!network)return;
    for(const station of shownStations){
      const id=station.id,highlighted=Boolean(id&&stationFilter.includes(id));
      const location:L.LatLngTuple=[station.lat,station.lng];
      const popup=stationPopup(station,network,id?{label:t(highlighted?'Remove highlight':'Highlight station'),run:()=>changeStations(highlighted?stationFilter.filter(s=>s!==id):[...stationFilter,id])}:undefined);
      if(highlighted){
        L.marker(location,{icon:stationIcon,pane:'highlightedStations',title:station.name})
          .bindTooltip(mapLabel(station.name),{permanent:true,direction:'right',offset:[21,0],className:'highlighted-station-label'})
          .bindPopup(popup).on('add',event=>(event.target as L.Marker).getElement()?.setAttribute('aria-label',station.name)).addTo(group);
        continue;
      }
      const colour=network.lines.find(l=>l.id===(lineFilter.find(id=>station.lineIds?.includes(id))||station.lineIds?.[0]))?.colour||'#596575';
      L.circleMarker(location,{pane:'transportStations',radius:6,color:colour,fillColor:dark?'#1F2A35':'#fff',fillOpacity:1,weight:2.5}).bindTooltip(mapLabel(station.name)).bindPopup(popup).addTo(group);
    }
  },[showStations,shownStations,network,lineFilter,stationFilter,dark,changeStations,t]);
  const activeLayerCount=[showLines,showStations,showLandmarks,showUniversities].filter(Boolean).length;
  return <div className="map-shell" data-map-ready={baseReady}>{!baseReady&&<div className="map-loading-indicator" role="status">{t("Loading London map…")}</div>}<div ref={el} className="map" aria-label={t("Map of London developments")}/>
    <div className="map-utilities"><button className="map-layer-button" aria-haspopup="dialog" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(true)}><SlidersHorizontal size={16}/>{t('Map layers')}{activeLayerCount>0&&<span className="layer-count">{activeLayerCount}</span>}</button>
    <button className="map-fit-button" aria-label={t('Show matching homes')} title={t('Show matching homes')} disabled={!items.length} onClick={()=>{const m=map.current;if(!m||!items.length)return;m.fitBounds(L.latLngBounds([...items,...(commuteDestination?[commuteDestination]:[])].map(d=>[d.lat,d.lng] as [number,number])),frameOptions(m));}}><LocateFixed size={19}/><span>{t('Show matching homes')}</span></button>
    {onReset&&<button className="map-reset-button" aria-label={t('Reset map')} title={t('Reset map')} onClick={onReset}><RotateCcw size={18}/><span>{t('Reset map')}</span></button>}
    </div>
    {toolsOpen&&<Modal title={t('Map layers')} close={()=>setToolsOpen(false)} className="map-layers-dialog" footer={<button onClick={()=>{setShowLines(false);setShowStations(false);setShowLandmarks(false);setShowUniversities(false);setLineFilter([]);setStationFilter([]);}}>{t('Hide all layers')}</button>}>
      <p className="muted">{t('Keep the focus on homes, or add local context to your map.')}</p>
      {featuredIds.length>0&&onDimOthers&&<label className="collection-opacity-setting"><input type="checkbox" checked={dimOthers} onChange={onDimOthers}/><span>{t('Fade other homes')}</span></label>}
      <div className="map-layer-toggles">{[{label:'Landmarks',checked:showLandmarks,set:setShowLandmarks,Icon:Landmark},{label:'Universities',checked:showUniversities,set:setShowUniversities,Icon:GraduationCap},{label:'Stations',checked:showStations,set:setShowStations,Icon:TrainFront,transport:true},{label:'TfL lines',checked:showLines,set:setShowLines,Icon:Layers,transport:true}].map(({label,checked,set,Icon,transport})=><label key={label}><Icon size={18}/><span>{t(label)}</span><input type="checkbox" checked={checked} disabled={transport&&!network} onChange={e=>set(e.target.checked)}/></label>)}</div>
      {showStations&&network&&<section className="map-line-picker"><h3>{t('Highlight specific stations')}</h3><StationPicker stations={network.stations} selectedIds={stationFilter} onChange={changeStations} t={t}/></section>}
      {network&&(showLines||showStations)&&<section className="map-line-picker"><h3>{t('Show specific lines')}</h3><p>{t('All lines are shown until you pick a specific selection below.')}</p><button aria-pressed={!lineFilter.length} className={!lineFilter.length?'selected':''} onClick={()=>setLineFilter([])}>{t('Show all lines')}</button><div className="map-line-options">{network.lines.map(line=><label key={line.id}><i style={{background:line.colour}}/><span>{line.name}</span><input type="checkbox" checked={lineFilter.includes(line.id)} onChange={()=>setLineFilter(old=>old.includes(line.id)?old.filter(id=>id!==line.id):[...old,line.id])}/></label>)}</div><small>{t('Powered by TfL Open Data')}{network.stale?' · Last available network':''}</small>{Boolean(network.missingGeometry?.length)&&<small>{t('Route geometry unavailable for:')} {network.missingGeometry!.join(', ')}</small>}</section>}
      {!network&&<p role="status">{t('Transport layers are temporarily unavailable. You can still browse developments and landmarks.')}</p>}
    </Modal>}
    <span className="map-note">{showStations&&network?t('{count} TfL rail stops · Click a station for its lines',{count:shownStations.length}):t('Select a development to explore homes, photos and viewing details')}</span>
    {transportError&&<div className="transport-notice" role="status">{t("TfL network temporarily unavailable. Development browsing is still available.")}</div>}
    {failed&&<div className="map-error"><AlertCircle size={16}/> {t("Some map detail could not load. You can still browse developments in List.")}</div>}
  </div>;
}
