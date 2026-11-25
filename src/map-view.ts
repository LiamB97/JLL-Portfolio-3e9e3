import {distance, type Station} from './types.ts';

// A consistent central London starting point for ordinary and reset views.
export const CENTRAL_LONDON={centre:[51.5074,-.1278] as [number,number],zoom:13};

export type StationLabelSide = 'left' | 'right' | 'top' | 'bottom';
type MapPoint = {x: number; y: number};
type LabelBox = {left: number; right: number; top: number; bottom: number};

export function stationLineIds(station: Station, networkStops: readonly Station[] = []) {
  const key = station.name.trim().replace(/ \(London\)$/i, '').toLowerCase();
  const ids = new Set(station.lineIds ?? []);
  // TfL may give each mode at an interchange a separate stop ID.
  for (const stop of networkStops) {
    if (stop === station || stop.name.trim().replace(/ \(London\)$/i, '').toLowerCase() !== key || distance(station, stop) > .35) continue;
    for (const id of stop.lineIds ?? []) ids.add(id);
  }
  return [...ids];
}

// The input order determines which station gets the space when labels compete.
export function placeStationLabels(stations: readonly (MapPoint & {labelWidth: number})[], size: MapPoint, controls: readonly LabelBox[] = []) {
  const dotRadius = 8, gap = 10, labelHeight = 28;
  const occupied: LabelBox[] = stations.map(({x, y}) => ({
    left: x - dotRadius, right: x + dotRadius, top: y - dotRadius, bottom: y + dotRadius,
  }));
  occupied.push(...controls);
  return stations.map(({x, y, labelWidth}): StationLabelSide | undefined => {
    const placements = [
      {side: 'right', left: x + gap, top: y - labelHeight / 2},
      {side: 'left', left: x - gap - labelWidth, top: y - labelHeight / 2},
      {side: 'top', left: x - labelWidth / 2, top: y - gap - labelHeight},
      {side: 'bottom', left: x - labelWidth / 2, top: y + gap},
    ] as const;
    for (const {side, left, top} of placements) {
      const right = left + labelWidth;
      const bottom = top + labelHeight;
      if (left < 0 || top < 0 || right > size.x || bottom > size.y) continue;
      if (occupied.some(box => left < box.right && right > box.left && top < box.bottom && bottom > box.top)) continue;
      occupied.push({left, right, top, bottom});
      return side;
    }
  });
}
