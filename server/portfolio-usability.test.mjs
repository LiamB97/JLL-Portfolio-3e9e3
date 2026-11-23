import test from 'node:test';
import assert from 'node:assert/strict';
import {searchDevelopments} from '../src/portfolio-search.ts';
import {workspaceGroups,workspaceStartTab} from '../src/workspace.ts';
const defaults={query:'',region:'',area:'',beds:'',budget:'',featuredOnly:false,featuredIds:[],favouritesOnly:false,favouriteIds:[],commute:null,sort:'curated'};
const homes=[
 {id:'unknown',name:'Abbey Homes',area:'Westminster',postcode:'SW1A 1AA',lat:51.501,lng:-.141,priceFrom:0,bedrooms:[1]},
 {id:'studio',name:'Central Studios',area:'Westminster',postcode:'SW1A 2AA',lat:51.502,lng:-.14,priceFrom:500000,bedrooms:[0,1],unitPrices:{'0':500000}},
 {id:'family',name:'Riverside Homes',area:'Greenwich',postcode:'SE10 9AA',lat:51.48,lng:0,priceFrom:900000,bedrooms:[2,3]},
];
const find=(change={})=>searchDevelopments(homes,{...defaults,...change}).map(d=>d.id);
test('the portfolio opens with every home and puts active collection choices first',()=>{
 assert.deepEqual(find(),['unknown','studio','family']);assert.deepEqual(find({featuredIds:['family']}),['family','unknown','studio']);assert.deepEqual(find({featuredIds:['family'],featuredOnly:true}),['family']);assert.deepEqual(homes.map(d=>d.id),['unknown','studio','family']);
});
test('shared collections keep picked homes first across listing sorts and preserve sorting within each group',()=>{
 const picked={featuredIds:['studio']};
 assert.deepEqual(find({...picked,sort:'price-desc'}),['studio','family','unknown']);
 assert.deepEqual(find({...picked,sort:'price'}),['studio','family','unknown']);
 assert.deepEqual(find({...picked,sort:'name'}),['studio','unknown','family']);
 assert.deepEqual(find({...picked,sort:'area'}),['studio','family','unknown']);
 assert.deepEqual(find({featuredIds:['studio','family'],sort:'price-desc'}),['family','studio','unknown']);
 assert.deepEqual(find({featuredIds:['unknown','studio'],sort:'price-desc'}),['studio','unknown','family']);
 assert.deepEqual(find({featuredIds:['missing'],sort:'price-desc'}),['family','studio','unknown']);
 assert.deepEqual(find({...picked,sort:'price-desc',beds:'2'}),['family']);
});
test('starting-price filters include their boundary and never treat an unknown price as an affordable home',()=>{
 assert.deepEqual(find({budget:'500000'}),['studio']);assert.deepEqual(find({budget:'1000000',sort:'price'}),['studio','family']);assert.deepEqual(find({sort:'price'}),['studio','family','unknown']);assert.deepEqual(find({beds:'0'}),['studio']);assert.deepEqual(find({query:'  sw1a 2aa  '}),['studio']);
});
test('commute, budget, bedrooms and saved/featured filters intersect without admitting unconfirmed routes',()=>{
 const commute={maxMinutes:40,results:[{id:'unknown',status:'unavailable'},{id:'studio',status:'ok',durationMinutes:40},{id:'family',status:'ok',durationMinutes:41}]};
 assert.deepEqual(find({commute}),['studio']);assert.deepEqual(find({commute,budget:'500000',beds:'0',favouritesOnly:true,favouriteIds:['studio','family']}),['studio']);assert.deepEqual(find({commute,featuredOnly:true,featuredIds:['family']}),[]);assert.deepEqual(find({favouritesOnly:true,favouriteIds:[]}),[]);
});
test('commute matches can be ranked by journey time while other sort options remain available',()=>{
 const commute={maxMinutes:40,results:[
  {id:'family',status:'ok',durationMinutes:25},
  {id:'unknown',status:'unavailable'},
  {id:'studio',status:'ok',durationMinutes:12},
 ]};
 assert.deepEqual(find({commute,sort:'commute'}),['studio','family']);
 assert.deepEqual(find({commute,sort:'price-desc'}),['family','studio']);
 assert.deepEqual(find({commute,sort:'commute',featuredIds:['family']}),['family','studio']);
 assert.deepEqual(find({commute,sort:'commute',featuredIds:['family','studio']}),['studio','family']);
});
test('broker navigation exposes buyer tasks while stock and account administration follow existing roles',()=>{
 const ids=role=>workspaceGroups(role).flatMap(g=>g.items.map(i=>i.id));
 for(const role of ['broker','broker_admin','admin']){const menu=ids(role);assert.equal(new Set(menu).size,menu.length);for(const task of ['home','collections','brochures','profile','guide','users'])assert.ok(menu.includes(task));}
 assert.ok(!ids('broker').includes('developments'));assert.ok(!ids('broker').includes('pending'));assert.ok(ids('broker_admin').includes('pending'));assert.ok(!ids('broker_admin').includes('activity'));assert.ok(!ids('broker_admin').includes('analytics'));assert.ok(ids('admin').includes('analytics'));
 assert.ok(ids('admin').includes('buyer-access'));
 assert.ok(!ids('broker').includes('buyer-access'));
 assert.ok(!ids('broker_admin').includes('buyer-access'));
 assert.ok(!ids('broker').includes('reviews'));
 assert.ok(ids('broker_admin').includes('reviews'));
 assert.deepEqual(ids('development_consultant'),['home','reviews','profile','guide']);
 assert.ok(workspaceGroups('admin').some(group=>group.label==='Portfolio stock'&&group.items.some(item=>item.id==='reviews'&&item.label==='Review assignments')));
});
test('workspace deep links open permitted sections for the signed-in staff role',()=>{
 assert.equal(workspaceStartTab('?staff=buyer-access','admin'),'buyer-access');
 for(const role of ['broker','broker_admin']){
  assert.equal(workspaceStartTab('?staff=buyer-access',role),'home');
 }
 assert.equal(workspaceStartTab('?staff=reviews','broker'),'home');
 assert.equal(workspaceStartTab('?staff=reviews','broker_admin'),'reviews');
 assert.equal(workspaceStartTab('?staff=reviews','development_consultant'),'reviews');
 assert.equal(workspaceStartTab('?staff=reviews','admin'),'reviews');
 assert.equal(workspaceStartTab('?staff=collections','development_consultant'),'home');
 assert.equal(workspaceStartTab('?staff=buyer-access'),'home');
 assert.equal(workspaceStartTab('?staff=not-a-section','admin'),'home');
 assert.equal(workspaceStartTab('','admin'),'home');
});
