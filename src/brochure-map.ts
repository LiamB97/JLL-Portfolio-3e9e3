import type {Map as VectorMap} from 'maplibre-gl';
import type {Development} from './types';
import type {BrochureMapImage} from './brochure-map-layout';
import {brochureMapBounds, shortlistMapHeight, SHORTLIST_MAP_WIDTH_PX} from './brochure-map-view';

const mapError = 'The shortlist map could not load. Check your connection and try generating the PDF again.';

function stylePrintMap(map: VectorMap) {
  for (const layer of map.getStyle().layers) {
    const source = 'source-layer' in layer ? layer['source-layer'] : '';
    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#F0F0EF');
    if (layer.type === 'fill') {
      if (source === 'water') map.setPaintProperty(layer.id, 'fill-color', '#CBCCD1');
      else if (source === 'park' || /park|wood|forest|grass/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', '#DEE3DC');
      else if (source === 'building') map.setPaintProperty(layer.id, 'fill-color', '#E4E4E2');
      else if (['landuse', 'landcover'].includes(source ?? '')) map.setPaintProperty(layer.id, 'fill-color', [
        'match', ['get', 'class'], ['wood', 'forest', 'grass', 'grassland', 'park', 'garden', 'recreation_ground', 'allotments', 'cemetery'], '#DEE3DC', '#F0F0EF',
      ]);
    }
    if (layer.type === 'line' && source === 'transportation' && !/rail|tunnel/.test(layer.id)) {
      map.setPaintProperty(layer.id, 'line-color', '#FFFFFF');
    }
    if (layer.type === 'symbol') {
      if (/poi|housenumber/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
      else if (layer.layout?.['text-field']) {
        map.setPaintProperty(layer.id, 'text-color', '#686D76');
        map.setPaintProperty(layer.id, 'text-halo-color', '#FFFFFF');
      }
    }
  }
}

// Capture the existing portfolio basemap at the PDF's aspect ratio. Pins and
// their links are added as vectors, using positions from the real map projection.
export async function brochureMap(items: Development[]): Promise<BrochureMapImage> {
  if (!items.length || items.some(item => !Number.isFinite(item.lat) || !Number.isFinite(item.lng))) {
    throw Error('Check the selected development locations before creating the shortlist map.');
  }
  const [response, maplibre, {default: workerUrl}] = await Promise.all([
    fetch('https://tiles.openfreemap.org/styles/positron', {signal: AbortSignal.timeout(15_000)}),
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
  ]).catch(() => {throw Error(mapError);});
  if (!response.ok) throw Error(mapError);
  const style = await response.json().catch(() => {throw Error(mapError);});
  maplibre.setWorkerUrl(workerUrl);
  const width = SHORTLIST_MAP_WIDTH_PX;
  const height = shortlistMapHeight(items.length) * 2;
  const node = document.createElement('div');
  Object.assign(node.style, {position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: `${height}px`, pointerEvents: 'none'});
  node.setAttribute('aria-hidden', 'true');
  node.inert = true;
  document.body.append(node);
  let map: VectorMap | undefined;
  try {
    map = new maplibre.Map({
      container: node, style, interactive: false, attributionControl: false,
      canvasContextAttributes: {preserveDrawingBuffer: true}, pixelRatio: 1, fadeDuration: 0, renderWorldCopies: false,
    });
    const printMap = map;
    return await new Promise<BrochureMapImage>((resolve, reject) => {
      const timer = window.setTimeout(fail, 40_000);
      function fail() {clearTimeout(timer); reject(Error(mapError));}
      printMap.on('error', fail);
      printMap.once('load', () => {
        try {
          stylePrintMap(printMap);
          printMap.once('idle', () => {
            try {
              const points = items.map(item => {
                const {x, y} = printMap.project([item.lng, item.lat]);
                return {id: item.id, x: x / width, y: y / height};
              });
              const image = printMap.getCanvas().toDataURL('image/png');
              if (!image.startsWith('data:image/png;base64,')) return fail();
              clearTimeout(timer);
              resolve({image, points, attribution: '© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap'});
            } catch {fail();}
          });
        } catch {fail();}
      });
      printMap.fitBounds(brochureMapBounds(items), {duration: 0});
    });
  } catch {
    throw Error(mapError);
  } finally {
    map?.remove();
    node.remove();
  }
}
