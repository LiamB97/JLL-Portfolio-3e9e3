export function validateDevelopment(raw) {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Each development must be an object.');
 if(raw._requiresReview&&raw._reviewConfirmed!==true)throw Error('Review and confirm the imported details and media before publishing.');
 const d = {};
 for (const key of ['name','area','postcode','description']) {
  if (typeof raw[key] !== 'string' || !raw[key].trim()) throw Error(`${key} is required.`);
  d[key] = raw[key].trim().slice(0,key==='description'?6000:200);
 }
 for (const key of ['lat','lng','priceFrom']) {
  if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) throw Error(`${key} must be a number.`);
  d[key] = raw[key];
 }
 if(d.lat<51.28 || d.lat>51.7 || d.lng<-.52 || d.lng>.34) throw Error('Coordinates must be within Greater London.');
 if(d.priceFrom<=0 || !Number.isSafeInteger(d.priceFrom)) throw Error('priceFrom must be a positive whole number in GBP.');
 for(const key of ['bedrooms','propertyTypes','amenities','images','videos']) {
  if(!Array.isArray(raw[key]) || raw[key].length>30) throw Error(`${key} must be an array of up to 30 items.`);
  d[key]=raw[key].map(x=>{
   if(key==='bedrooms') {if(!Number.isInteger(x)||x<0||x>10)throw Error('Bedrooms must be whole numbers from 0 to 10.');return x;}
   if(typeof x!=='string'||!x.trim())throw Error(`${key} contains an invalid item.`);
   if(key==='images'||key==='videos') {
    if(key==='images'&&/^\/images\/[\w.-]+\.svg$/.test(x)) return x;
    let u;try{u=new URL(x);}catch{throw Error(`${key} must contain HTTPS URLs.`);}
    if(u.protocol!=='https:'||u.username||u.password)throw Error(`${key} must contain HTTPS URLs.`);
   }
   return x.trim().slice(0,2000);
  });
 }
 if(!d.bedrooms.length||!d.propertyTypes.length)throw Error('At least one bedroom option and property type are required.');
 d.unitPrices={};
 if(raw.unitPrices!==undefined){if(!raw.unitPrices||typeof raw.unitPrices!=='object'||Array.isArray(raw.unitPrices))throw Error('unitPrices must contain prices by bedroom count.');
  for(const [beds,price] of Object.entries(raw.unitPrices)){if(!/^(?:[0-9]|10)$/.test(beds)||!d.bedrooms.includes(Number(beds))||!Number.isSafeInteger(price)||price<=0)throw Error('Unit prices must be positive whole GBP amounts for available bedroom options.');d.unitPrices[beds]=price;}
 }
 d.status = raw.status==='Coming soon'?'Coming soon':'Available';
 d.sample = raw.sample === true;
 d.sourceUrl = '';
 if(raw.sourceUrl) {const u=new URL(raw.sourceUrl);if(u.protocol!=='https:'||u.hostname!=='residential.jll.co.uk'||u.username||u.password)throw Error('Source must be an HTTPS residential.jll.co.uk URL.');d.sourceUrl=u.href;}
 d.importSource='';
 if(raw.importSource){const u=new URL(raw.importSource);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Import provenance must be a public HTTPS URL.');d.importSource=u.href.slice(0,2000);}
 d.translations={};for(const language of ['ar','zh-CN','tr']){const value=raw.translations?.[language];if(value&&typeof value.description==='string'&&value.description.trim()){if(value.description.length>6000)throw Error('Translated descriptions must be at most 6000 characters.');d.translations[language]={description:value.description.trim(),amenities:Array.isArray(value.amenities)?value.amenities.filter(x=>typeof x==='string'&&x.trim()).slice(0,30).map(x=>x.trim().slice(0,500)):[]};}}
 return d;
}
export function distanceKm(a,b) {
 const rad=x=>x*Math.PI/180;
 const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export const samples = [
 ['Thameside Collection','Canary Wharf','E14',51.501,-.024,625000,[0,1,2,3],['Apartments'],['Concierge','Residents’ gym','River views','Roof terrace'],'riverside'],
 ['The Parkside Collection','Battersea','SW11',51.477,-.147,790000,[1,2,3],['Apartments','Penthouses'],['Landscaped gardens','Concierge','Residents’ lounge','Cycle storage'],'park'],
 ['Peninsula Collection','Greenwich','SE10',51.495,.008,485000,[0,1,2],['Apartments'],['River walks','Co-working space','Residents’ gym','Balconies'],'riverside'],
 ['West London Collection','White City','W12',51.509,-.225,595000,[1,2,3],['Apartments','Penthouses'],['Cinema room','Swimming pool','Concierge','Gardens'],'park'],
 ['East London Collection','Stratford','E20',51.545,-.009,450000,[1,2,3],['Apartments'],['Park access','Cycle storage','Residents’ lounge','Balconies'],'city'],
 ['Nine Elms Collection','Nine Elms','SW8',51.481,-.133,710000,[1,2,3],['Apartments','Penthouses'],['Concierge','Wellness suite','Roof terrace','Co-working space'],'city']
].map(([name,area,postcode,lat,lng,priceFrom,bedrooms,propertyTypes,amenities,img],i)=>({id:'sample-'+(i+1),name,area,postcode,lat,lng,priceFrom,bedrooms,propertyTypes,amenities,images:[`/images/${img}.svg`],videos:[],status:'Available',sample:true,sourceUrl:'',description:`An illustrative collection of contemporary homes in ${area}, created to demonstrate the portfolio experience. Explore the neighbourhood, nearby transport and apartment options. These are sample details, not a live JLL development or an offer for sale.`}));
