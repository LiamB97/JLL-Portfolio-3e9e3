import test from 'node:test';import assert from 'node:assert/strict';
import {commuteService,commuteOptions,commutePostcode,parseCommuteJourney} from './commute.mjs';
import {commuteMatches,nextCommuteDay,londonDate} from '../src/commute.ts';
import {createNetlifyApi} from './netlify-api.mjs';
import {commutePlaces,commutePlaceSuggestions} from '../shared/commute-destinations.ts';
const stamp=Date.parse('2026-10-28T12:00:00Z');
const options={postcode:'ec2r8ah',date:'2026-10-29',time:'09:00',mode:'public',developmentIds:['home']};
const homes=[{id:'home',lat:51.501,lng:-.141},{id:'other',lat:51.52,lng:-.08}];
const journey=(duration=32,modes=['walking','tube'])=>({journeys:[{duration,arrivalDateTime:'2026-10-29T08:54:00',startDateTime:'2026-10-29T08:22:00',legs:modes.map(id=>({mode:{id,name:id},duration:10}))}]});
const geocode=async()=>Response.json({result:{postcode:'EC2R 8AH',latitude:51.514188,longitude:-.088622}});
test('commute input validates full postcodes, modes and London arrival dates before any route request',()=>{
 assert.equal(commutePostcode(' ec2r8ah '),'EC2R 8AH');assert.equal(commuteOptions(options,stamp).mode,'public');
 for(const change of [{postcode:'E14'},{postcode:'https://example.com'},{mode:'driving'},{date:'2026-02-30'},{date:'2026-12-01'},{date:'2026-10-27'},{time:'24:00'}])assert.throws(()=>commuteOptions({...options,...change},stamp));
});
test('commutes use the full planned duration, reject incorrect travel modes and never invent a failed route',()=>{
 assert.equal(parseCommuteJourney(journey(50),'public').durationMinutes,50);assert.equal(parseCommuteJourney(journey(12.2,['walking']),'walking').durationMinutes,13);
 assert.equal(parseCommuteJourney(journey(20),'walking'),null);assert.equal(parseCommuteJourney(journey(20),'cycle'),null);assert.equal(parseCommuteJourney(journey(20,['walking','cycle']),'cycle').durationMinutes,20);
 assert.equal(parseCommuteJourney(journey(20,['private-car']),'public'),null);assert.equal(parseCommuteJourney({journeys:[]},'public'),null);assert.equal(parseCommuteJourney(journey(-1),'public'),null);
});
test('bounded commute requests use published coordinates, arrival time and recognised TfL modes, with cache coalescing',async()=>{
 let calls=0,lookups=0,clock=stamp;const paths=[];
 const service=commuteService({now:()=>clock,fetcher:async(...args)=>{lookups++;return geocode(...args);},get:async path=>{calls++;paths.push(path);return journey();}});
 const [a,b]=await Promise.all([service(options,homes),service(options,homes)]);assert.equal(calls,1);assert.equal(lookups,1);assert.equal(a.results[0].durationMinutes,32);assert.deepEqual(a,b);
 const url=new URL('https://api.tfl.gov.uk'+paths[0]);assert.ok(url.pathname.includes('51.501,-0.141/to/51.514188,-0.088622'));assert.equal(url.searchParams.get('timeIs'),'Arriving');assert.equal(url.searchParams.get('time'),'0900');assert.ok(url.searchParams.get('mode').includes('national-rail'));assert.ok(!url.searchParams.get('mode').split(',').includes('train'));
 await service(options,homes);assert.equal(calls,1);await service(options,[{...homes[0],lat:51.502}]);assert.equal(calls,2);clock+=11*60000;await service(options,homes);assert.equal(calls,3);
 for(const body of [null,[],{...options,developmentIds:['missing']},{...options,developmentIds:Array(6).fill('home')}])await assert.rejects(()=>service(body,homes));
});
test('partial provider failures are unavailable, excluded from matches and retried instead of cached as estimates',async()=>{
 let failed=true,calls=0;const service=commuteService({now:()=>stamp,fetcher:geocode,get:async path=>{calls++;if(failed&&path.includes('51.52,'))throw Error('provider unavailable');return journey();}});
 const value=await service({...options,developmentIds:['home','other']},homes);assert.equal(value.results[0].status,'ok');assert.equal(value.results[1].status,'unavailable');assert.equal(value.results[1].durationMinutes,undefined);assert.equal(commuteMatches(value.results[1],180),false);
 assert.equal(commuteMatches(value.results[0],32),true);assert.equal(commuteMatches(value.results[0],31),false);failed=false;const retry=await service({...options,developmentIds:['home','other']},homes);assert.equal(retry.results[1].status,'ok');assert.equal(calls,3);
});
test('next commute day uses the London calendar and skips weekends',()=>{
 assert.equal(nextCommuteDay(new Date('2026-10-30T12:00:00Z')),'2026-11-02');assert.equal(londonDate(new Date('2026-07-01T23:30:00Z')),'2026-07-02');assert.equal(commuteMatches({status:'ok',id:'x',durationMinutes:NaN},60),false);
});
test('named commute destinations use their mapped London coordinates and support common search names',async()=>{
 assert.equal(new Set(commutePlaces.map(p=>p.id)).size,commutePlaces.length);
 let lookups=0;const paths=[];
 const service=commuteService({now:()=>stamp,fetcher:async()=>{lookups++;return geocode();},get:async path=>{paths.push(path);return journey();}});
 const {postcode,...request}=options;
 for(const [query,kind] of [['LSE','University'],['Canary Wharf','Area'],['Tower Bridge','Landmark'],['伦敦大学学院','University']]){
  const place=commutePlaceSuggestions(query)[0];
  assert.equal(place.kind,kind);
  const result=await service({...request,destinationId:place.id},homes);
  assert.deepEqual(result.destination,{id:place.id,name:place.name,lat:place.lat,lng:place.lng});
  assert.ok(paths.at(-1).includes('/to/'+place.lat+','+place.lng+'?'));
 }
 assert.equal(lookups,0);
 await assert.rejects(()=>service({...options,destinationId:'unknown'},homes),error=>error.status===422);
});
test('public commute endpoint works without staff access and validates origin, JSON, size and missing stock',async()=>{
 const repository={read:async()=>({developments:homes}),update:async()=>{throw Error('Commutes must not write profile or stock state');}};
 const commute=commuteService({now:()=>stamp,fetcher:geocode,get:async()=>journey()});const api=createNetlifyApi({repository,commute});
 const call=(body,origin='https://portfolio.example')=>api(new Request('https://portfolio.example/api/commute',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)}));
 const r=await call(options);assert.equal(r.status,200);assert.equal((await r.json()).results[0].durationMinutes,32);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await call(options,'https://evil.example')).status,403);assert.equal((await call('{')).status,400);assert.equal((await call('x'.repeat(6001))).status,413);assert.equal((await call({...options,developmentIds:['missing']})).status,409);assert.equal((await call(null)).status,422);
});
