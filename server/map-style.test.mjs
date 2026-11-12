import test from 'node:test';import assert from 'node:assert/strict';import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';import {styleNeighbourhoodMap} from '../src/map-style.ts';
import {placeStationLabels} from '../src/map-view.ts';
test('map tints retain neutral buildings and valid zoom-dependent styling in both themes',()=>{
 for(const dark of [false,true]){
  const fill=(id,sourceLayer,colour)=>({id,type:'fill',source:'base','source-layer':sourceLayer,paint:{'fill-color':colour}});
  const style={version:8,sources:{base:{type:'vector',tiles:['https://example.test/{z}/{x}/{y}.pbf']}},layers:[fill('park','park','#eeeeee'),fill('water','water','#cccccc'),fill('landcover_wood','landcover','#dddddd'),fill('landuse','landuse','#f0f0f0'),fill('zoom-landuse','landuse',['interpolate',['linear'],['zoom'],5,'#eee',12,'#ddd']),fill('building','building','#eaeae5')]};
  styleNeighbourhoodMap({getStyle:()=>style,addLayer:layer=>style.layers.push(layer),setPaintProperty:(id,key,value)=>style.layers.find(l=>l.id===id).paint[key]=value},dark);
  assert.equal(style.layers[5].paint['fill-color'],'#eaeae5');assert.notEqual(style.layers[0].paint['fill-color'],'#eeeeee');assert.notEqual(style.layers[1].paint['fill-color'],'#cccccc');assert.equal(style.layers[4].paint['fill-color'][0],'interpolate');assert.deepEqual(validateStyleMin(style).map(e=>e.message),[]);
 }
});
test('station names leave neighbouring dots visible and fit more labels as the map zooms in',()=>{
 const crowded=[{x:30,y:50,labelWidth:90},{x:95,y:50,labelWidth:50},{x:200,y:50,labelWidth:85}];
 assert.deepEqual(placeStationLabels(crowded,{x:230,y:100}),[undefined,'right',undefined]);
 const spread=[crowded[0],{...crowded[1],x:175},{...crowded[2],x:370}];
 assert.deepEqual(placeStationLabels(spread,{x:460,y:100}),['right','right','left']);
 const row=[110,55,170].map(x=>({x,y:55,labelWidth:80}));
 assert.deepEqual(placeStationLabels(row,{x:220,y:130}),['top','bottom','bottom']);
 const controls=[{left:100,right:210,top:55,bottom:100}];
 assert.deepEqual(placeStationLabels([{x:90,y:68,labelWidth:60}],{x:220,y:100},controls),['left']);
});
