import {mergeSource} from './source-review.mjs';
import * as cheerio from 'cheerio';
import {validateDevelopment} from './model.mjs';
export const SEARCH_URL='https://residential.jll.co.uk/search?tenureType=sale&flags=new-home&sortBy=newestListed&currencyType=GBP';
export function sourceRecords(html){const $=cheerio.load(html);const text=$('#__NEXT_DATA__').text();if(!text)throw Error('JLL changed its page format; existing stock was kept.');const p=JSON.parse(text).props?.pageProps;if(!Array.isArray(p?.allDevelopments)||!p.allDevelopments.length||p.allDevelopments.length!==p.propertiesTotalResults)throw Error('JLL returned an incomplete development collection; existing stock was kept.');return p.allDevelopments;}
function plain(value){return cheerio.load(String(value||'').replace(/<br\s*\/?>/gi,'\n')).text().trim();}
export function convertSource(p){
 if(p.city!=='London'||!p.tenureType?.includes('sale')||!p.isNewDevelopment)throw Error('Not a London new-home sale development.');
 const bedrooms=[...new Set((p.rooms?.bedrooms||[]).flatMap(s=>{if(/^studio$/i.test(s))return [0];const m=String(s).match(/^(\d+)\s*(?:bed(?:room)?s?)?$/i);return m?[Number(m[1])]:[];}))];
 const description=plain(p.description).split(/\n\s*\n/).filter(x=>!/(?:register your interest|contact us|call us|enquire now|arrange a viewing)/i.test(x)).join('\n\n');
 const headline=plain(p.developmentHeadline);const area=headline.includes(',')?headline.split(',').slice(1).join(',').trim():String(p.postcode||'').split(' ')[0];
 const videos=(p.videos||[]).map(v=>typeof v==='string'?v:v.url).filter(v=>typeof v==='string'&&/^https:\/\//.test(v));
 const d=validateDevelopment({name:plain(p.title),area,postcode:p.postcode,lat:Number(p.lat),lng:Number(p.lng),priceFrom:Number(p.price?.minAmount),bedrooms,propertyTypes:[/penthouse/i.test(p.title)?'Penthouses':'New homes'],amenities:(p.amenities||[]).slice(0,30).map(plain),images:(p.images||[]).slice(0,30),videos:videos.slice(0,30),description,status:p.showComingSoon?'Coming soon':'Available',sample:false,sourceUrl:new URL(p.pageUrl,'https://residential.jll.co.uk').href});
 if(p.price?.currencyCode!=='GBP')throw Error('Listing price is not in GBP.');
 if(!p.id)throw Error('Missing stable source identifier.');
 return {...d,id:'jll-'+p.id,source:'JLL website',lastSyncedAt:new Date().toISOString()};
}
export async function fetchSource(){const r=await fetch(SEARCH_URL,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`JLL returned HTTP ${r.status}; existing stock was kept.`);const text=await r.text();if(text.length>10_000_000)throw Error('JLL page is unexpectedly large.');return sourceRecords(text);}
export function applySource(db,records){
 const ready=[],skipped=[];for(const p of records){try{ready.push(convertSource(p));}catch(e){skipped.push({name:plain(p.title),reason:e.message});}}
 if(!ready.length)throw Error('No valid London developments found; existing stock was kept.');
 const statement=db.prepare('INSERT INTO developments(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data');
 db.exec('BEGIN');try{const access=db.prepare("SELECT value FROM metadata WHERE key='access-state'").get();const state=access?JSON.parse(access.value):{};for(const d of ready){const row=db.prepare('SELECT data FROM developments WHERE id=?').get(d.id);statement.run(d.id,JSON.stringify(mergeSource(row?JSON.parse(row.data):null,d,{legacyEdited:state.activity?.timeline?.some(e=>e.event==='stock_edit'&&e.resourceId===d.id)})));}for(const row of db.prepare('SELECT id,data FROM developments').all()){const d=JSON.parse(row.data);if(d.sample===true)db.prepare('DELETE FROM developments WHERE id=?').run(row.id);}
 const report={imported:ready.length,skipped,syncedAt:new Date().toISOString(),note:'Manual edits are preserved; website differences await a stock manager’s review. Missing website stock is retained for review, not automatically withdrawn.'};db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('last-sync',JSON.stringify(report));db.exec('COMMIT');return report;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
