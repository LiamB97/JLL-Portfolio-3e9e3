import test from 'node:test';import assert from 'node:assert/strict';import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';import {styleNeighbourhoodMap} from '../src/map-style.ts';
test('map tints retain neutral buildings and valid zoom-dependent styling in both themes',()=>{
 for(const dark of [false,true]){
  const fill=(id,sourceLayer,colour)=>({id,type:'fill',source:'base','source-layer':sourceLayer,paint:{'fill-color':colour}});
  const style={version:8,sources:{base:{type:'vector',tiles:['https://example.test/{z}/{x}/{y}.pbf']}},layers:[fill('park','park','#eeeeee'),fill('water','water','#cccccc'),fill('landcover_wood','landcover','#dddddd'),fill('landuse','landuse','#f0f0f0'),fill('zoom-landuse','landuse',['interpolate',['linear'],['zoom'],5,'#eee',12,'#ddd']),fill('building','building','#eaeae5')]};
  styleNeighbourhoodMap({getStyle:()=>style,setPaintProperty:(id,key,value)=>style.layers.find(l=>l.id===id).paint[key]=value},dark);
  assert.equal(style.layers[5].paint['fill-color'],'#eaeae5');assert.notEqual(style.layers[0].paint['fill-color'],'#eeeeee');assert.notEqual(style.layers[1].paint['fill-color'],'#cccccc');assert.equal(style.layers[4].paint['fill-color'][0],'interpolate');assert.deepEqual(validateStyleMin(style).map(e=>e.message),[]);
 }
});
