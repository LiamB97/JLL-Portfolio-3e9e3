export interface BrochureMapPoint {id: string; x: number; y: number}
export interface BrochureMapImage {
  image: string;
  points: BrochureMapPoint[];
  attribution: string;
}
interface Rect {x: number; y: number; width: number; height: number}
export const MAP_TAG_HEIGHT = 30;
export const MAP_TAG_MAX_WIDTH = 175;
export const MAP_TAG_TIP_HEIGHT = 8;
const margin = 8;
const gap = 6;
const creditSpace = 19;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

export function layoutBrochurePins(points: (BrochureMapPoint & {width: number})[], width: number, height: number) {
  const maxY = height - creditSpace - MAP_TAG_TIP_HEIGHT - MAP_TAG_HEIGHT;
  const occupied: Rect[] = [];
  const anchors = points.map(point => ({...point, anchor: {x: point.x * width, y: point.y * height}}));
  const place = (point: typeof anchors[number], x: number, y: number) => {
    const rect = {x, y, width: point.width, height: MAP_TAG_HEIGHT};
    const tip = {x: clamp(point.anchor.x, x + 12, x + point.width - 12), y: y + MAP_TAG_HEIGHT + MAP_TAG_TIP_HEIGHT};
    occupied.push(rect);
    return {id: point.id, anchor: point.anchor, rect, tip};
  };
  const positions = anchors.map(point => {
    const {anchor} = point;
    const normalTop = clamp(anchor.y - MAP_TAG_HEIGHT - MAP_TAG_TIP_HEIGHT, margin, maxY);
    const alignments = [anchor.x - 15, anchor.x + 15 - point.width];
    for (let y = normalTop; y >= margin; y -= MAP_TAG_HEIGHT + gap) {
      for (const alignment of alignments) {
        const x = clamp(alignment, margin, width - margin - point.width);
        if (!occupied.some(rect => overlap(rect, {x, y, width: point.width, height: MAP_TAG_HEIGHT}))) {
          return place(point, x, y);
        }
      }
    }
    return null;
  });
  if (positions.every(position => position !== null)) return positions;

  // Dense shortlists can share a coordinate. Use each nearest free slot in an
  // evenly spaced layout, and keep the original anchors for the leader lines.
  occupied.length = 0;
  const columns = 3;
  const columnWidth = (width - 2 * margin) / columns;
  const rowHeight = MAP_TAG_HEIGHT + gap;
  const rows = Math.floor((maxY - margin) / rowHeight) + 1;
  const slots = Array.from({length: rows * columns}, (_, index) => ({
    x: margin + (index % columns) * columnWidth,
    y: margin + Math.floor(index / columns) * rowHeight,
  }));
  return anchors.map(point => {
    const distance = (slot: typeof slots[number]) => Math.hypot(
      slot.x + point.width / 2 - point.anchor.x,
      slot.y + MAP_TAG_HEIGHT + MAP_TAG_TIP_HEIGHT - point.anchor.y,
    );
    const nearest = slots.reduce((best, slot, index) => distance(slot) < distance(slots[best]) ? index : best, 0);
    const [slot] = slots.splice(nearest, 1);
    if (!slot) throw Error('The map cannot fit the selected development labels.');
    return place(point, slot.x, slot.y);
  });
}
