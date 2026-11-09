import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {buildBrochure,brochureDevelopmentName,brochureIntroduction} from '../src/brochure.ts';
import {layoutBrochurePins} from '../src/brochure-map-layout.ts';
import {brochureMapBounds,BROCHURE_LONDON_BOUNDS,BROCHURE_MAP_BAND} from '../src/brochure-map-view.ts';
import seed from './data/initial-portfolio.json' with {type:'json'};
const b64=file=>readFileSync(new URL('../public/fonts/'+file,import.meta.url)).toString('base64');
const assets={regular:b64('source-sans-3-regular.ttf'),semibold:b64('source-sans-3-semibold.ttf'),light:b64('source-sans-3-light.ttf'),serifItalic:b64('source-serif-4-light-italic.ttf'),photos:{}};
const input={title:'Your London New Homes',intro:'Chosen around your priorities.',notes:{},items:seed.developments.slice(0,7),broker:{name:'Test Broker',title:'Residential Sales',whatsapp:'+447900000001',email:'broker@example.test'},origin:'https://portfolio.example',collection:'shared-selection'};
const jpeg='data:image/jpeg;base64,'+readFileSync(new URL('./fixtures/profile-square.jpg',import.meta.url)).toString('base64');
test('numbered map shares the opening page and preserves development and broker links',()=>{
 const map={image:jpeg,points:input.items.map((d,i)=>({id:d.id,x:.2+i*.1,y:.3+i*.07})),areas:[],attribution:'© OpenStreetMap contributors'};
 const doc=buildBrochure(input,{...assets,map});assert.equal(doc.getNumberOfPages(),8);
 const mapLinks=doc.internal.getPageInfo(1).pageContext.annotations.filter(a=>a.type==='link');for(const d of input.items)assert.ok(mapLinks.some(a=>a.options.url.includes('development='+d.id)&&a.options.url.includes('collection=shared-selection')));
 const contacts=doc.internal.getPageInfo(8).pageContext.annotations.filter(a=>a.type==='link').map(a=>a.options.url);for(const url of ['tel:+447900000001','mailto:broker@example.test','https://wa.me/447900000001'])assert.ok(contacts.includes(url));
 assert.equal(buildBrochure(input,assets).getNumberOfPages(),8);assert.throws(()=>buildBrochure(input,{...assets,map:{...map,points:[]}}),/does not match/);
});
test('crowded numbered pins fit the combined opening map and retain geographic anchors',()=>{
 const points=Array.from({length:20},(_,i)=>({id:String(i),x:.5,y:.5})),placed=layoutBrochurePins(points,210,BROCHURE_MAP_BAND.height);
 for(const p of placed){assert.ok(p.pin.x>=6&&p.pin.x<=204);assert.ok(p.pin.y>=12&&p.pin.y<=BROCHURE_MAP_BAND.height-7);assert.deepEqual(p.anchor,{x:105,y:52});}
 for(let a=0;a<placed.length;a++)for(let b=a+1;b<placed.length;b++)assert.ok(Math.abs(placed[a].pin.x-placed[b].pin.x)>=9-1e-7||Math.abs(placed[a].pin.y-placed[b].pin.y)>=11-1e-7,'Numbered pins overlap');
});
test('London map keeps the wider central context for a single home and includes named outer exceptions',()=>{
 const b=BROCHURE_LONDON_BOUNDS;assert.deepEqual(brochureMapBounds([{lat:51.5,lng:-.12}]),[[b.west,b.south],[b.east,b.north]]);
 const outer=brochureMapBounds([{lat:51.33,lng:-.51}]);assert.ok(outer[0][0]<-.51&&outer[0][1]<51.33);assert.ok(outer[1][0]>=b.east&&outer[1][1]>=b.north);
});
test('brochure naming uses the requested display names without changing source records',()=>{assert.equal(brochureDevelopmentName('Opus - Bankside Yards'),'Opus, Bankside Yards');assert.equal(brochureDevelopmentName('SEVEN, Southbank Place'),'SEVEN, Southbank Place');assert.equal(brochureDevelopmentName('Another Southbank Place building'),'Another Southbank Place building');});
test('twenty-home editorial brochure keeps one page per home and all links inside A4',()=>{
 const items=seed.developments.slice(0,20),data={...input,items,broker:{...input.broker,name:'A particularly long professional broker name with multiple surnames',title:'Director of New Homes Sales and Residential Marketing, London',email:'broker.with.a.long.email.address@residential.example.test'},intro:'A personal introduction to the selected homes. '.repeat(50),notes:Object.fromEntries(items.map(d=>[d.id,'A considered personal recommendation for your home search. '.repeat(35).slice(0,1600)]))};
 const doc=buildBrochure(data,assets);assert.equal(doc.getNumberOfPages(),21);assert.ok(doc.brochureWarnings.includes('Cover introduction'));
 for(let page=1;page<=21;page++)for(const a of doc.internal.getPageInfo(page).pageContext.annotations.filter(a=>a.type==='link'))for(const [key,limit]of [['x',596],['w',596],['y',842],['h',842]])assert.ok(Number(a.finalBounds[key])>=0&&Number(a.finalBounds[key])<=limit,`Out-of-page link on ${page}`);
 const body=doc.output();assert.match(body,/SourceSerif/);assert.match(body,/https:\/\/wa.me\/447900000001/);assert.match(body,/mailto:broker.with.a.long.email.address/);
});

test('editorial introductions use listing information instead of a sales-page contact prompt',()=>{assert.equal(brochureIntroduction('Book your appointment at the sales gallery\n\nA collection of beautifully considered homes overlooking the Thames. Explore the neighbourhood.'),'A collection of beautifully considered homes overlooking the Thames.');});
