// A geographic overview of central London around Zones 1 and 2, rather than
// exact fare-zone boundaries. Extend it only when a selected home lies outside.
export const BROCHURE_LONDON_BOUNDS={west:-.30,south:51.43,east:.065,north:51.58};
export const BROCHURE_MAP_BAND={top:128,height:104,width:210};
export const BROCHURE_MAP_CANVAS={width:1500,height:743};
export function brochureMapBounds(items:{lat:number;lng:number}[]){
 const b=BROCHURE_LONDON_BOUNDS;
 return [[Math.min(b.west,...items.map(d=>d.lng-.012)),Math.min(b.south,...items.map(d=>d.lat-.008))],
  [Math.max(b.east,...items.map(d=>d.lng+.012)),Math.max(b.north,...items.map(d=>d.lat+.008))]] as [[number,number],[number,number]];
}
