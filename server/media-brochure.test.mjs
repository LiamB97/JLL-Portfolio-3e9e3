import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {videoSource,videoThumbnails} from '../src/video-source.ts';
import {buildBrochure,brochureFilename} from '../src/brochure.ts';
import seed from './data/initial-portfolio.json' with {type:'json'};
const assets={regular:readFileSync(new URL('../public/fonts/source-sans-3-regular.ttf',import.meta.url)).toString('base64'),semibold:readFileSync(new URL('../public/fonts/source-sans-3-semibold.ttf',import.meta.url)).toString('base64'),photos:{}};
const input={title:'Homes for your next chapter',intro:'An introduction from your broker.',notes:{},items:seed.developments.slice(0,2),broker:{name:'Test Broker',whatsapp:'+447900000001'},origin:'https://portfolio.example',brokerSlug:'own-broker',date:new Date('2026-10-28T12:00:00Z')};
test('all bundled stock video URLs resolve to in-app media sources',()=>{for(const d of seed.developments)for(const url of d.videos)assert.ok(videoSource(url),url);});
test('provider URLs preserve video identity and privacy hashes without arbitrary iframe destinations',()=>{
 assert.equal(videoSource('https://youtu.be/M7lc1UVf-VE?t=20').src,'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&start=20');
 assert.equal(videoSource('https://www.youtube.com/shorts/M7lc1UVf-VE').kind,'embed');
 assert.equal(videoSource('https://vimeo.com/123456/abc123').src,'https://player.vimeo.com/video/123456?h=abc123&dnt=1');
 assert.equal(videoSource('https://player.vimeo.com/video/123456?h=abc123').src,'https://player.vimeo.com/video/123456?h=abc123&dnt=1');
 assert.equal(videoSource('https://players.brightcove.net/123/default_default/index.html?videoId=456&autoplay=true').src,'https://players.brightcove.net/123/default_default/index.html?videoId=456&playsinline=true');
 assert.equal(videoSource('https://cdn.example/video.mp4?signature=abc').kind,'file');
 for(const url of ['javascript:alert(1)','http://youtu.be/M7lc1UVf-VE','https://www.youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://evil.test/embed/123','https://user:secret@youtu.be/M7lc1UVf-VE'])assert.equal(videoSource(url),null);
});
test('brochure PDFs fit development notes to one A4 page, retain input and attach links to the correct broker',()=>{
 const value={...input,intro:'A longer introduction. '.repeat(70),notes:{[input.items[0].id]:'A detailed broker recommendation. '.repeat(48)}};
 const before=JSON.stringify(value);const doc=buildBrochure(value,assets);assert.equal(JSON.stringify(value),before);assert.ok(doc.getNumberOfPages()>=3);assert.match(doc.output(),/^%PDF-/);assert.match(doc.output(),/https:\/\/wa.me\/447900000001/);assert.match(doc.output(),/broker=own-broker/);
 assert.equal(buildBrochure(input,assets).getNumberOfPages(),3);
 const collection=buildBrochure({...input,collection:'selected-collection'},assets);assert.match(collection.output(),/collection=selected-collection/);assert.doesNotMatch(collection.output(),/broker=own-broker/);
 assert.throws(()=>buildBrochure({...input,items:[]},assets));assert.throws(()=>buildBrochure({...input,title:' '},assets));assert.equal(brochureFilename('London / Homes: 2026'),'London-Homes-2026.pdf');
});

test('PDF portraits use an active circular clipping path on the cover and contact pages',()=>{
 const photo='data:image/jpeg;base64,'+readFileSync(new URL('./fixtures/profile-square.jpg',import.meta.url)).toString('base64');
 const doc=buildBrochure({...input,broker:{...input.broker,photo}},assets);
 const operations=doc.internal.pages.slice(1).flat().join('\n');
 assert.equal((operations.match(/ c\nW\nn/g)||[]).length,2);
 assert.ok(Math.abs(doc.internal.pageSize.getWidth()-210)<.01);assert.ok(Math.abs(doc.internal.pageSize.getHeight()-297)<.01);
});

test('each selected development stays on exactly one page even with maximum-length notes',()=>{
 const items=seed.developments.slice(0,20).map((d,i)=>({...d,name:i===0?'A very long development name with more detail '.repeat(4):d.name,amenities:Array.from({length:6},(_,n)=>'Key feature '+n+' '+('spacious living '.repeat(10)))}));
 const notes=Object.fromEntries(items.map(d=>[d.id,'Personal broker advice and viewing information. '.repeat(40).slice(0,1600)]));
 const doc=buildBrochure({...input,items,notes},assets);assert.equal(doc.getNumberOfPages(),21);
});
test('video posters use a real YouTube thumbnail with development and illustration fallbacks',()=>{
 assert.deepEqual(videoThumbnails('https://youtu.be/M7lc1UVf-VE','/cover.jpg'),['https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg','/cover.jpg','/images/city.svg']);
 assert.deepEqual(videoThumbnails('https://players.brightcove.net/123/default_default/index.html?videoId=456','/cover.jpg'),['/cover.jpg','/images/city.svg']);
 assert.deepEqual(videoThumbnails('https://cdn.example/video.mp4'),['/images/city.svg']);
});

test('the combined opening page fits both long and short introductions without an extra page',()=>{
 const doc=buildBrochure({...input,intro:'A considered introduction to your London home search. '.repeat(60),broker:{...input.broker,title:'Senior Residential Sales Broker'},items:input.items.slice(0,1)},assets);
 assert.equal(doc.getNumberOfPages(),2);assert.ok(doc.internal.pages[1].length>0);assert.equal(buildBrochure({...input,intro:'A short personal note.',items:input.items.slice(0,1)},assets).getNumberOfPages(),2);
});

test('brochure opening and contact pages include the broker email with WhatsApp and keep A4 link bounds',()=>{
 const email='residential.broker@example.test';
 for(const intro of ['A short introduction.','A considered introduction to the selected London homes. '.repeat(40)]){
  const doc=buildBrochure({...input,intro,items:input.items.slice(0,1),broker:{...input.broker,title:'Senior Residential Sales Broker',email}},assets);
  assert.equal(doc.getNumberOfPages(),2);
  for(const page of [1,2]){
   const links=doc.internal.getPageInfo(page).pageContext.annotations.filter(a=>a.type==='link');
   assert.ok(links.some(a=>a.options.url==='mailto:'+email));
   assert.ok(links.some(a=>a.options.url==='https://wa.me/447900000001'));
   for(const a of links){const b=a.finalBounds;for(const key of ['x','w'])assert.ok(Number(b[key])>=0&&Number(b[key])<=596);for(const key of ['y','h'])assert.ok(Number(b[key])>=0&&Number(b[key])<=842);}
  }
 }
 const without=buildBrochure(input,assets);assert.doesNotMatch(without.output(),/mailto:/);
});
