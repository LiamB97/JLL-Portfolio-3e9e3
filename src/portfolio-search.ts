import {startingPrice} from '../shared/pricing.ts';
import {nearArea,regionFor} from './explore.ts';
import {commuteMatches,type CommuteReport} from './commute.ts';
import type {Development} from './types';
export interface PortfolioFilters {query:string;region:string;area:string;beds:string;budget:string;featuredOnly:boolean;featuredIds:string[];favouritesOnly:boolean;favouriteIds:string[];commute:CommuteReport|null;sort:string}
export function searchDevelopments(items:Development[],filters:PortfolioFilters){
 const f=filters,journeys=new Map(f.commute?.results.map(r=>[r.id,r])||[]),query=f.query.trim().toLowerCase();
 return items.filter(d=>
  `${d.name} ${d.area} ${d.postcode}`.toLowerCase().includes(query)&&
  (!f.region||(f.region==='Prime central'?d.lat>=51.475&&d.lat<=51.535&&d.lng>=-.215&&d.lng<=-.105:regionFor(d)===f.region))&&(!f.area||nearArea(d,f.area))&&
  (!f.featuredOnly||f.featuredIds.includes(d.id))&&(!f.favouritesOnly||f.favouriteIds.includes(d.id))&&
  (!f.beds||d.bedrooms.includes(Number(f.beds)))&&
  (!f.budget||((startingPrice(d,f.beds)??Infinity)<=Number(f.budget)))&&
  (!f.commute||commuteMatches(journeys.get(d.id),f.commute.maxMinutes))
 ).sort((a,b)=>f.sort==='name'?a.name.localeCompare(b.name):f.sort==='area'?a.area.localeCompare(b.area):f.sort==='price'?((startingPrice(a,f.beds)??Infinity)-(startingPrice(b,f.beds)??Infinity)):f.sort==='price-desc'?((startingPrice(b,f.beds)??-Infinity)-(startingPrice(a,f.beds)??-Infinity)):Number(f.featuredIds.includes(b.id))-Number(f.featuredIds.includes(a.id)));
}
