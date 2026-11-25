import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBrochure, brochureDevelopmentName, brochureFilename, brochureIntroduction} from '../src/brochure.ts';
import {layoutBrochurePins, MAP_TAG_MAX_WIDTH} from '../src/brochure-map-layout.ts';
import {A4_HEIGHT, A4_WIDTH, brochureMapBounds, shortlistMapHeight} from '../src/brochure-map-view.ts';
import seed from './data/initial-portfolio.json' with {type: 'json'};

const b64 = file => readFileSync(new URL(file, import.meta.url)).toString('base64');
const jpeg = 'data:image/jpeg;base64,' + b64('./fixtures/profile-square.jpg');
const assets = {
  regular: b64('../public/fonts/source-sans-3-regular.ttf'),
  semibold: b64('../public/fonts/source-sans-3-semibold.ttf'),
  light: b64('../public/fonts/source-sans-3-light.ttf'),
  serifItalic: b64('../public/fonts/source-serif-4-light-italic.ttf'),
  photos: {},
};
const items = seed.developments.slice(0, 20);
const input = {
  title: 'Your London New Homes', clientName: 'A test buyer', intro: 'Chosen around your priorities.', notes: {},
  items: items.slice(0, 3), broker: {name: 'Test Broker', title: 'Residential Sales', whatsapp: '+447700900027', email: 'broker@example.test'},
  origin: 'https://portfolio.example', collection: 'shared-selection', brokerSlug: 'own-broker',
};
const mapFor = homes => ({
  image: jpeg,
  points: homes.map((d, i) => ({id: d.id, x: .15 + (i % 5) * .16, y: .2 + Math.floor(i / 5) * .18})),
  attribution: '© OpenStreetMap contributors',
});
const generate = (data = input) => buildBrochure(data, {...assets, map: mapFor(data.items)});
const links = (doc, page) => doc.internal.getPageInfo(page).pageContext.annotations.filter(a => a.type === 'link');
const urls = (doc, page) => links(doc, page).map(a => a.options.url);

test('a translated brochure links to the same buyer language and the owning broker’s WeChat details', () => {
  const data = {...input, language:'tr', title:'Londra konutları', items: input.items.slice(0, 1), broker:{...input.broker,wechatId:'test_broker'}};
  const doc = generate(data);
  const target = new URL(urls(doc,2)[0]);
  assert.equal(target.searchParams.get('lang'),'tr');
  assert.equal(target.searchParams.get('collection'),input.collection);
  assert.match(urls(doc,4).find(url=>url.includes('contact=wechat')),/collection=shared-selection&lang=tr&contact=wechat/);
  assert.ok(urls(doc,3).filter(url=>url.startsWith('https://wa.me')).some(url=>new URL(url).searchParams.get('text').startsWith('Merhaba')));
});

test('a named map and linked shortlist precede the development pages in broker order', () => {
  const doc = generate();
  assert.equal(doc.getNumberOfPages(), 6);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - A4_WIDTH) < .01);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - A4_HEIGHT) < .01);
  const detailLinks = input.items.map(home => input.origin + '/?development=' + home.id + '&collection=shared-selection');
  assert.deepEqual(urls(doc, 2), [...detailLinks, ...detailLinks]);
  for (const [index, url] of detailLinks.entries()) assert.ok(urls(doc, 3 + index).includes(url));
  const personal = generate({...input, collection: undefined});
  assert.match(urls(personal, 3).find(url => url.includes('development=')), /broker=own-broker/);
  assert.throws(() => buildBrochure(input, assets), /map does not match/);
  assert.throws(() => buildBrochure(input, {...assets, map: {...mapFor(input.items), points: []}}), /map does not match/);
});

test('contact actions reach the broker and prefill the appropriate enquiry', () => {
  const doc = generate();
  for (const page of [1, 6]) {
    const contact = urls(doc, page);
    assert.ok(contact.includes('tel:+447700900027'));
    assert.ok(contact.includes('mailto:broker@example.test?subject=Your%20London%20New%20Homes'));
    const whatsapp = new URL(contact.find(url => url.startsWith('https://wa.me/')));
    assert.equal(whatsapp.pathname, '/447700900027');
    assert.equal(whatsapp.searchParams.get('text'), "Hi Test, I've been looking at the New Homes you sent me and would like to arrange some viewings.");
  }
  const whatsapp = new URL(urls(doc, 3).find(url => url.startsWith('https://wa.me/')));
  assert.equal(whatsapp.pathname, '/447700900027');
  assert.equal(whatsapp.searchParams.get('text'), `Hi Test, I'm interested in ${brochureDevelopmentName(input.items[0].name)}. Could we arrange a viewing?`);
  assert.doesNotMatch(generate({...input, broker: {...input.broker, email: undefined}}).output(), /mailto:/);
});

test('twenty crowded labels stay inside the print map and retain geographic anchors', () => {
  const points = Array.from({length: 20}, (_, i) => ({id: String(i), x: .5, y: .5, width: MAP_TAG_MAX_WIDTH}));
  const height = shortlistMapHeight(points.length);
  const placed = layoutBrochurePins(points, A4_WIDTH, height);
  assert.deepEqual(placed.map(item => item.id), points.map(item => item.id));
  for (const {rect, tip, anchor} of placed) {
    assert.ok(rect.x >= 8 && rect.x + rect.width <= A4_WIDTH - 8);
    assert.ok(rect.y >= 8 && tip.y < height - 18);
    assert.deepEqual(anchor, {x: A4_WIDTH / 2, y: height / 2});
  }
  for (const [index, a] of placed.entries()) for (const b of placed.slice(index + 1)) {
    assert.ok(a.rect.x + a.rect.width <= b.rect.x || b.rect.x + b.rect.width <= a.rect.x ||
      a.rect.y + a.rect.height <= b.rect.y || b.rect.y + b.rect.height <= a.rect.y);
  }
});

test('map bounds centre on the selected homes with a minimum span and margin', () => {
  const [[west, south], [east, north]] = brochureMapBounds([{lat: 51.5, lng: -.12}]);
  assert.ok(Math.abs((east + west) / 2 + .12) < 1e-7);
  assert.equal(south, 51.5);
  assert.equal(north, 51.5);
  assert.ok((east - west) * 111.32 * Math.cos(51.5 * Math.PI / 180) >= 5.99);
  const outer = brochureMapBounds([{lat: 51.33, lng: -.51}, {lat: 51.55, lng: .06}]);
  assert.ok(outer[0][0] < -.51 && outer[0][1] < 51.33);
  assert.ok(outer[1][0] > .06 && outer[1][1] > 51.55);
});

test('brochure pagination reserves the cover, map and contact pages for every selection size', () => {
  for (const [count, pages] of [[1, 4], [2, 5], [5, 8], [6, 9], [7, 11], [20, 25]]) {
    const doc = generate({...input, items: items.slice(0, count)});
    assert.equal(doc.getNumberOfPages(), pages);
    assert.match(doc.output(), /^%PDF-/);
  }
  assert.throws(() => generate({...input, items: []}));
  assert.throws(() => generate({...input, title: ' '}));
  assert.equal(brochureFilename('London / Homes: 2026'), 'London-Homes-2026.pdf');
});

test('long saved copy fits on the dedicated pages and keeps all link areas within A4', () => {
  const data = {
    ...input,
    items: items.slice(0, 7).map(home => ({...home, amenities: Array(6).fill('A spacious reception room with extraordinary light and far-reaching views across London')})),
    broker: {...input.broker, name: 'A particularly long professional broker name with multiple surnames', title: 'Director of New Homes Sales and Residential Marketing, London', email: 'broker.with.a.long.email.address@residential.example.test'},
    intro: 'A personal introduction to the selected homes. '.repeat(30),
    notes: Object.fromEntries(items.map(d => [d.id, 'A considered personal recommendation for your home search. '.repeat(20)])),
  };
  const saved = JSON.stringify(data);
  const doc = generate(data);
  assert.equal(doc.getNumberOfPages(), 11);
  assert.equal(JSON.stringify(data), saved);
  assert.ok(doc.brochureWarnings.includes('Cover introduction'));
  assert.ok(doc.brochureWarnings.some(warning => warning.endsWith('broker note')));
  for (let page = 1; page <= doc.getNumberOfPages(); page++) for (const link of links(doc, page)) {
    const {x, y, w, h} = link.finalBounds;
    for (const edge of [x, w]) assert.ok(Number(edge) >= 0 && Number(edge) <= A4_WIDTH, `Out-of-page link on ${page}`);
    for (const edge of [y, h]) assert.ok(Number(edge) >= 0 && Number(edge) <= A4_HEIGHT, `Out-of-page link on ${page}`);
  }
  assert.match(doc.output(), /SourceSerif/);
});

test('the cover, broker note and contact page use circular portrait clipping', () => {
  const doc = generate({...input, broker: {...input.broker, photo: jpeg}, notes: {[input.items[0].id]: 'A short note.'}});
  const operations = doc.internal.pages.slice(1).flat().join('\n');
  assert.equal((operations.match(/ c\nW\nn/g) || []).length, 3);
});

test('editorial brochure names and summaries use listing information', () => {
  assert.equal(brochureDevelopmentName('Opus - Bankside Yards'), 'Opus, Bankside Yards');
  assert.equal(brochureDevelopmentName('SEVEN, Southbank Place'), 'SEVEN, Southbank Place');
  assert.equal(brochureDevelopmentName('Another Southbank Place building'), 'Another Southbank Place building');
  assert.equal(brochureIntroduction('Book your appointment at the sales gallery\n\nA collection of beautifully considered homes overlooking the Thames. Explore the neighbourhood.'), 'A collection of beautifully considered homes overlooking the Thames.');
});
