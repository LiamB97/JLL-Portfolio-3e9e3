export interface PricedDevelopment {priceFrom:number;bedrooms:number[];unitPrices?:Record<string,number>}
export const unitLabel=(beds:number)=>beds===0?'Studio':`${beds}-bed`;

export function priceFromAfterBedroomRemoval(development: PricedDevelopment, bedrooms: number[], unitPrices: Record<string, number>) {
 const removed = development.bedrooms.filter(beds => !bedrooms.includes(beds));
 if (!removed.length) return development.priceFrom;
 const confirmed = Object.values(unitPrices).filter(price => price > 0);
 if (confirmed.includes(development.priceFrom)) return development.priceFrom;
 const removedStartingPrice = removed.some(beds => development.unitPrices?.[beds] === development.priceFrom);
 const onlyRemainingTypeUnpriced = bedrooms.length === 1 && !confirmed.length;
 if (!removedStartingPrice && !onlyRemainingTypeUnpriced) return development.priceFrom;
 return confirmed.length ? Math.min(...confirmed) : 0;
}
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
