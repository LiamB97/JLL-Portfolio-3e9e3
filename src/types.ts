export interface Development {unitPrices?:Record<string,number>;translations?:Record<string,{description:string;amenities:string[]}>;canEdit?:boolean;id:string;name:string;area:string;postcode:string;lat:number;lng:number;priceFrom:number;bedrooms:number[];propertyTypes:string[];amenities:string[];images:string[];videos:string[];description:string;sample:boolean;status:string;sourceUrl:string}
export interface Station {id?:string;lineIds?:string[];name:string;lat:number;lng:number;lines:string}
export const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
export const bedroomLabel=(b:number[])=>b.map(x=>x===0?'Studio':String(x)).join(', ');
export function distance(a:{lat:number;lng:number},b:{lat:number;lng:number}){const r=(x:number)=>x*Math.PI/180;const h=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lng-a.lng)/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export interface TransportLine {id:string;name:string;mode:string;colour:string;paths:[number,number][][]}
export interface TransportNetwork {source:string;attribution:string;updatedAt:string;stations:Station[];lines:TransportLine[];missingGeometry?:string[];stale?:boolean}
export interface StationRoute extends Station {straightLineKm:number;walking:{distanceMeters:number;durationMinutes:number}|null;cycling:{distanceMeters:number;durationMinutes:number}|null}
export interface Connections {source:string;updatedAt:string;stations:StationRoute[]}

export interface BrokerCard {photo?:string;name:string;whatsapp:string;slug:string}
export interface BuyerCollection {transportDefaults?:TransportDefaults;broker?:BrokerCard|null;slug:string;title:string;brokerName:string;developmentIds:string[]}

// New homes describes this entire portfolio, rather than a useful unit type.
export const specificPropertyTypes=(types:string[])=>types.filter(type=>!/^new[\s-]*homes?$/i.test(type.trim()));

export interface TransportDefaults {showLines:boolean;showStations:boolean;lineIds:string[];stationIds:string[]}
