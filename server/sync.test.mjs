import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {sourceRecords,convertSource,applySource} from './sync.mjs';import {samples} from './model.mjs';
const source={id:'source-id',city:'London',tenureType:['sale'],isNewDevelopment:true,title:'Test development',developmentHeadline:'Test development, Greenwich',postcode:'SE10 8GE',lat:51.48,lng:-.01,price:{minAmount:650000,currencyCode:'GBP'},rooms:{bedrooms:['Studio','1 Bed','2 Bed']},description:'<b>Contemporary London homes.</b>',amenities:['Garden'],images:['https://res.cloudinary.com/example.jpg'],videos:[],pageUrl:'/sale-development/test'};
test('website conversion preserves source prices, bedroom options and provenance',()=>{const d=convertSource(source);assert.deepEqual(d.bedrooms,[0,1,2]);assert.equal(d.priceFrom,650000);assert.equal(d.area,'Greenwich');assert.equal(d.sample,false);assert.equal(d.sourceUrl,'https://residential.jll.co.uk/sale-development/test');assert.equal(d.description,'Contemporary London homes.');assert.throws(()=>convertSource({...source,city:'Manchester'}));assert.throws(()=>convertSource({...source,price:{minAmount:0,currencyCode:'GBP'}}));});
test('website conversion keeps enquiry-only GBP prices and rejects incomplete prices',()=>{
 for(const amount of [0,null]){
  const listing={...source,price:{minAmount:amount,maxAmount:amount,currencyCode:'GBP'}};
  assert.equal(convertSource(listing).priceFrom,0);
 }
 assert.throws(()=>convertSource({...source,price:{minAmount:null,maxAmount:750000,currencyCode:'GBP'}}));
 assert.throws(()=>convertSource({...source,price:{minAmount:0,maxAmount:0,currencyCode:'EUR'}}));
});
test('penthouse bedroom counts can come from unambiguous JLL highlights',()=>{
 const penthouse={...source,rooms:{bedrooms:['Penthouse']},amenities:['Four-bedroom duplex penthouse','Roof terrace']};
 assert.deepEqual(convertSource(penthouse).bedrooms,[4]);
 assert.throws(()=>convertSource({...penthouse,amenities:['Roof terrace']}));
 assert.throws(()=>convertSource({...penthouse,amenities:[...penthouse.amenities,'Three-bedroom layout']}));
 assert.deepEqual(convertSource({...penthouse,rooms:{bedrooms:['Penthouse','3 Bed']}}).bedrooms,[3]);
});
test('only complete website collections are accepted',()=>{const html=x=>'<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:x}})+'</script>';assert.equal(sourceRecords(html({allDevelopments:[source],propertiesTotalResults:1})).length,1);assert.throws(()=>sourceRecords(html({allDevelopments:[source],propertiesTotalResults:2})));assert.throws(()=>sourceRecords('<html/>'));});
test('refresh is repeatable, removes only sample stock and keeps manual and missing website stock',()=>{const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE developments(id TEXT PRIMARY KEY,data TEXT NOT NULL);CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)');const put=db.prepare('INSERT INTO developments VALUES(?,?)');put.run('manual',JSON.stringify({...samples[0],id:'manual',sample:false}));put.run(samples[0].id,JSON.stringify(samples[0]));const first=applySource(db,[source]);assert.equal(first.imported,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM developments').get().n,2);applySource(db,[{...source,price:{minAmount:750000,currencyCode:'GBP'}}]);assert.equal(JSON.parse(db.prepare('SELECT data FROM developments WHERE id=?').get('jll-source-id').data).priceFrom,750000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM developments').get().n,2);applySource(db,[{...source,id:'second-source'}]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM developments').get().n,3);assert.throws(()=>applySource(db,[{...source,city:'Manchester'}]));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM developments').get().n,3);db.close();});
