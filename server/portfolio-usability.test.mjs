import test from 'node:test';
import assert from 'node:assert/strict';
import {searchDevelopments} from '../src/portfolio-search.ts';
import {workspaceGroups} from '../src/workspace.ts';
const defaults={query:'',region:'',area:'',beds:'',budget:'',featuredOnly:false,featuredIds:[],favouritesOnly:false,favouriteIds:[],commute:null,sort:'curated'};
const homes=[
 {id:'unknown',name:'Abbey Homes',area:'Westminster',postcode:'SW1A 1AA',lat:51.501,lng:-.141,priceFrom:0,bedrooms:[1]},
 {id:'studio',name:'Central Studios',area:'Westminster',postcode:'SW1A 2AA',lat:51.502,lng:-.14,priceFrom:500000,bedrooms:[0,1],unitPrices:{'0':500000}},
 {id:'family',name:'Riverside Homes',area:'Greenwich',postcode:'SE10 9AA',lat:51.48,lng:0,priceFrom:900000,bedrooms:[2,3]},
];
const find=(change={})=>searchDevelopments(homes,{...defaults,...change}).map(d=>d.id);
test('the portfolio opens with every home, while featured pins only change the default order',()=>{
 assert.deepEqual(find(),['unknown','studio','family']);assert.deepEqual(find({featuredIds:['family']}),['family','unknown','studio']);assert.deepEqual(find({featuredIds:['family'],featuredOnly:true}),['family']);assert.deepEqual(homes.map(d=>d.id),['unknown','studio','family']);
});
test('starting-price filters include their boundary and never treat an unknown price as an affordable home',()=>{
 assert.deepEqual(find({budget:'500000'}),['studio']);assert.deepEqual(find({budget:'1000000',sort:'price'}),['studio','family']);assert.deepEqual(find({sort:'price'}),['studio','family','unknown']);assert.deepEqual(find({beds:'0'}),['studio']);assert.deepEqual(find({query:'  sw1a 2aa  '}),['studio']);
});
test('commute, budget, bedrooms and saved/featured filters intersect without admitting unconfirmed routes',()=>{
 const commute={maxMinutes:40,results:[{id:'unknown',status:'unavailable'},{id:'studio',status:'ok',durationMinutes:40},{id:'family',status:'ok',durationMinutes:41}]};
 assert.deepEqual(find({commute}),['studio']);assert.deepEqual(find({commute,budget:'500000',beds:'0',favouritesOnly:true,favouriteIds:['studio','family']}),['studio']);assert.deepEqual(find({commute,featuredOnly:true,featuredIds:['family']}),[]);assert.deepEqual(find({favouritesOnly:true,favouriteIds:[]}),[]);
});
test('broker navigation exposes buyer tasks while stock and account administration follow existing roles',()=>{
 const ids=role=>workspaceGroups(role).flatMap(g=>g.items.map(i=>i.id));
 for(const role of ['broker','broker_admin','admin']){const menu=ids(role);assert.equal(new Set(menu).size,menu.length);for(const task of ['home','collections','brochures','profile','guide','users'])assert.ok(menu.includes(task));}
 assert.ok(!ids('broker').includes('developments'));assert.ok(!ids('broker').includes('pending'));assert.ok(ids('broker_admin').includes('pending'));assert.ok(!ids('broker_admin').includes('activity'));assert.ok(!ids('broker_admin').includes('analytics'));assert.ok(ids('admin').includes('analytics'));
});
