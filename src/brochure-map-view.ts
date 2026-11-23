export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const SHORTLIST_MAP_TOP = 150;
export const SHORTLIST_MAP_WIDTH_PX = 1190;

export function shortlistMapHeight(count: number) {
  return count <= 3 ? 380 : 300;
}

export function brochureMapBounds(items: {lat: number; lng: number}[]) {
  const west = Math.min(...items.map(item => item.lng));
  const east = Math.max(...items.map(item => item.lng));
  const south = Math.min(...items.map(item => item.lat));
  const north = Math.max(...items.map(item => item.lat));
  const latitude = (south + north) / 2;
  const longitude = (west + east) / 2;
  const kilometresPerDegree = 111.32 * Math.cos(latitude * Math.PI / 180);
  const halfWidth = Math.max((east - west) * .65, 3 / kilometresPerDegree);
  const halfHeight = (north - south) * .65;
  return [[longitude - halfWidth, latitude - halfHeight], [longitude + halfWidth, latitude + halfHeight]] as [[number, number], [number, number]];
}
