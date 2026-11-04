import test from 'node:test';import assert from 'node:assert/strict';import {mergeSource,markManualEdit,resolveSourceField} from './source-review.mjs';import {samples} from './model.mjs';
const original={...samples[0],id:'jll-demo',sample:false,unitPrices:{},lastSyncedAt:'2026-11-01T00:00:00Z'};
test('refresh preserves a manual price and unit prices; keep suppresses the same source value while new changes reappear',()=>{
 const baseline=mergeSource(null,original),edited=markManualEdit(baseline,{...baseline,priceFrom:900000,unitPrices:{'3':1400000}},{id:'admin'});
 let fresh=mergeSource(edited,{...original,priceFrom:700000,description:'New website description'});assert.equal(fresh.priceFrom,900000);assert.equal(fresh.unitPrices['3'],1400000);assert.equal(fresh.description,'New website description');assert.ok(fresh._refreshConflicts.priceFrom);
 assert.throws(()=>resolveSourceField(fresh,'priceFrom','website','old-version'));assert.throws(()=>resolveSourceField(fresh,'__proto__','website',undefined));
 fresh=resolveSourceField(fresh,'priceFrom','keep',fresh._refreshConflicts.priceFrom.version);assert.equal(fresh.priceFrom,900000);
 fresh=mergeSource(fresh,{...original,priceFrom:700000});assert.equal(fresh._refreshConflicts.priceFrom,undefined);
 fresh=mergeSource(fresh,{...original,priceFrom:750000});assert.ok(fresh._refreshConflicts.priceFrom);
 fresh=resolveSourceField(fresh,'priceFrom','website',fresh._refreshConflicts.priceFrom.version);assert.equal(fresh.priceFrom,750000);assert.equal(fresh._manualFields.includes('priceFrom'),false);
 fresh=mergeSource(fresh,{...original,priceFrom:800000});assert.equal(fresh.priceFrom,800000);assert.equal(fresh.unitPrices['3'],1400000);
});
test('legacy edited records are protected conservatively and manually priced room types cannot disappear silently',()=>{
 const edited={...original,priceFrom:999000,unitPrices:{'3':1500000}};const fresh=mergeSource(edited,{...original,bedrooms:[0,1,2],priceFrom:650000},{legacyEdited:true});assert.equal(fresh.priceFrom,999000);assert.ok(fresh.bedrooms.includes(3));assert.ok(fresh._refreshConflicts.bedrooms);assert.ok(fresh._refreshConflicts.priceFrom);
});

test('editing a flagged field refreshes its displayed live value and rejects the old review version',()=>{
 const baseline=mergeSource(null,original),edited=markManualEdit(baseline,{...baseline,priceFrom:700000},{id:'broker-admin'});let fresh=mergeSource(edited,{...original,priceFrom:800000});const previous=fresh._refreshConflicts.priceFrom.version;
 fresh=markManualEdit(fresh,{...fresh,priceFrom:900000},{id:'another-manager'});assert.equal(fresh._refreshConflicts.priceFrom.current,900000);assert.notEqual(fresh._refreshConflicts.priceFrom.version,previous);assert.throws(()=>resolveSourceField(fresh,'priceFrom','website',previous));
 fresh=markManualEdit(fresh,{...fresh,priceFrom:800000},{id:'another-manager'});assert.equal(fresh._refreshConflicts.priceFrom,undefined);assert.equal(fresh._manualFields.includes('priceFrom'),false);
});
