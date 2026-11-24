import assert from 'node:assert/strict';
import test from 'node:test';
import {brochurePhotos, defaultBrochureCover} from '../src/brochure-assets.ts';

const jpeg = 'data:image/jpeg;base64,cGhvdG8=';
function mockImages(t, outcome) {
  const active = new Set(), requested = [];
  let busiest = 0;
  class FakeImage {
    naturalWidth = 1280;
    naturalHeight = 800;
    set src(url) {
      requested.push(url);
      active.add(this);
      busiest = Math.max(busiest, active.size);
      const result = outcome(url);
      if (result === 'timeout') return;
      queueMicrotask(() => {
        active.delete(this);
        if (result === 'ok') this.onload();
        else this.onerror();
      });
    }
    removeAttribute() {
      active.delete(this);
    }
  }
  const original = {Image: globalThis.Image, window: globalThis.window, document: globalThis.document};
  Object.assign(globalThis, {
    Image: FakeImage,
    window: {setTimeout: callback => setTimeout(callback, 10)},
    document: {createElement: () => ({getContext: () => ({fillRect() {}, drawImage() {}}), toDataURL: () => jpeg})},
  });
  t.after(() => Object.assign(globalThis, original));
  return {requested, busiest: () => busiest};
}

test('a slow photo does not hold up later homes in an eight-development brochure', async t => {
  const {requested, busiest} = mockImages(t, url => {
    if (url.includes('development-8.jpg')) return 'error';
    if (url.includes('development-1.jpg') && url.includes('w_1280')) return 'timeout';
    return 'ok';
  });
  const items = Array.from({length: 8}, (_, index) => {
    const id = `development-${index + 1}`;
    return {id, name: id, images: [
      `https://res.cloudinary.com/jll-global-olm-np/image/upload/w_1920,c_limit,q_auto:good,f_auto,fl_progressive/resi/${id}.jpg`,
    ]};
  });
  const progress = [];
  const result = await brochurePhotos(items, count => progress.push(count));
  const originalFirst = requested.indexOf(items[0].images[0]);
  assert.ok(originalFirst > requested.findIndex(url => url.includes('development-5.jpg')));
  assert.match(requested[0], /w_1280,c_limit,q_auto:good,f_jpg/);
  assert.equal(busiest(), 4);
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(result.photos[items[0].id], jpeg);
  assert.equal(Object.keys(result.photos).length, 7);
  assert.deepEqual(result.missing, [items[7].name]);
});

test('brochure generation uses the packaged skyline when the cover service returns a web page', async t => {
  const {requested} = mockImages(t, () => 'ok');
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('<html>Cover service unavailable</html>', {headers: {'Content-Type': 'text/html'}}));
  const result = await defaultBrochureCover();
  assert.deepEqual(result, {image: jpeg, fallback: true});
  assert.deepEqual(requested, ['/images/london-skyline-cover.jpg']);
});
