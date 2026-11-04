export interface PricedDevelopment {priceFrom:number;bedrooms:number[];unitPrices?:Record<string,number>}
export const unitLabel=(beds:number)=>beds===0?'Studio':`${beds}-bed`;
export function startingPrice(d:PricedDevelopment,beds?:string|number){
 if(beds!==undefined&&beds!==''){
  const n=Number(beds),explicit=d.unitPrices?.[String(n)];
  if(!d.bedrooms.includes(n))return null;
  if(explicit&&explicit>0)return explicit;
  return d.bedrooms.length===1&&d.priceFrom>0?d.priceFrom:null;
 }
 const prices=Object.values(d.unitPrices||{}).filter(n=>n>0);
 return d.priceFrom>0?Math.min(d.priceFrom,...prices):prices.length?Math.min(...prices):null;
}
