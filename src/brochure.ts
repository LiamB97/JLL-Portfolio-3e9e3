import {encode} from 'fast-png';
import {jsPDF} from 'jspdf';
import {BROCHURE_MAX_CLIENT_NAME, BROCHURE_MAX_DEVELOPMENTS, BROCHURE_MAX_INTRO, BROCHURE_MAX_NOTE} from '../shared/brochure-settings.ts';
import {startingPrice} from '../shared/pricing.ts';
import {developmentLink} from '../shared/sharing.ts';
import {layoutBrochurePins, MAP_TAG_HEIGHT, MAP_TAG_MAX_WIDTH, MAP_TAG_TIP_HEIGHT, type BrochureMapImage} from './brochure-map-layout.ts';
import {A4_HEIGHT, A4_WIDTH, SHORTLIST_MAP_TOP, shortlistMapHeight} from './brochure-map-view.ts';
import type {Development} from './types';

export interface BrochureInput {
  title: string;
  clientName?: string;
  intro: string;
  notes: Record<string, string>;
  items: Development[];
  broker: {name: string; whatsapp: string; photo?: string; title?: string; email?: string};
  origin: string;
  collection?: string;
  brokerSlug?: string;
  date?: Date;
  coverImage?: string;
}
export interface BrochureAssets {
  regular: string;
  semibold: string;
  light?: string;
  serifItalic?: string;
  logoDark?: string;
  whatsappMidnight?: string;
  whatsappSand?: string;
  photos: Record<string, string>;
  map: BrochureMapImage;
}

type Face = 'light' | 'normal' | 'bold' | 'italic';
interface TextStyle {face?: Face; colour?: string; opacity?: number; align?: 'left' | 'center' | 'right'; leading?: number}
interface FittedText {lines: string[]; size: number; shortened: boolean}
const colour = {midnight: '#131E29', space: '#003E51', sand: '#E0C6AD', white: '#FFFFFF'};
const left = 36;
const right = A4_WIDTH - left;
const contentWidth = right - left;
const firstShortlistLimit = 6;
const continuationLimit = 11;
const money = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP', maximumFractionDigits: 0});
const priceLabel = (price: number | null) => price === null ? 'To be confirmed' : money.format(price % 1000 === 999 ? price + 1 : price);
const bedLabel = (beds: number) => beds === 0 ? 'Studio' : `${beds} ${beds === 1 ? 'bed' : 'beds'}`;
const bedroomTypes = (development: Development) => [...new Set(development.bedrooms)].sort((a, b) => a - b);
const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim().replace(/\bnew homes\b/gi, 'New Homes');

function listingText(value: string) {
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:p|div|li)\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|#160);/gi, ' ').replace(/&amp;/gi, '&').replace(/&(?:apos|#39);/gi, '’').replace(/&quot;/gi, '"');
}

function bedRange(development: Development) {
  const beds = bedroomTypes(development);
  if (beds.length <= 1) return beds.length ? bedLabel(beds[0]) : '';
  if (beds.length === 2) return `${beds[0] === 0 ? 'Studio' : beds[0]} and ${beds[1]} beds`;
  return `${beds[0] === 0 ? 'Studio' : beds[0]} to ${beds.at(-1)} beds`;
}

export function brochureFilename(title: string) {
  return (title.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70) || 'JLL-brochure') + '.pdf';
}

export function brochureDevelopmentName(name: string) {
  if (/^opus\b/i.test(name) && /bankside/i.test(name)) return 'Opus, Bankside Yards';
  if (/^seven(?:\b|,)/i.test(name) && (/southbank/i.test(name) || /^seven$/i.test(name.trim()))) return 'SEVEN, Southbank Place';
  return clean(name);
}

export function brochureIntroduction(description: string) {
  const paragraphs = listingText(description).split(/\n+/).map(clean).filter(Boolean);
  const substantive = paragraphs.filter(value => !/^(?:book\b|contact\b|register\b|enquire\b|request\b|call\s|email\s|please\b|up to £)/i.test(value));
  const summary = substantive.find(value => value.length > 60) || substantive[0] || '';
  return summary.match(/^.+?[.!?](?:\s|$)/)?.[0].trim() || summary;
}

function brochureFeatures(development: Development) {
  return development.amenities.map(feature => clean(listingText(feature)).replace(/\s*(?:…|\.{3})$/, ''))
    .filter(feature => feature && !/^(?:(?:prices?\s+)?(?:from|starting (?:at|from))\s+£|£[\d,]+\s*$)/i.test(feature))
    .slice(0, 6);
}

function heroFadePng(photoHeight: number, bottomFadeStart: number) {
  const samplesPerPoint = 4;
  const height = (photoHeight + 1) * samplesPerPoint;
  const data = new Uint8Array(height * 4);
  const midnight = Number.parseInt(colour.midnight.slice(1), 16);
  const red = (midnight >> 16) & 255;
  const green = (midnight >> 8) & 255;
  const blue = midnight & 255;
  for (let row = 0; row < height; row++) {
    const y = (row + .5) / samplesPerPoint;
    const topOpacity = .55 * Math.max(0, 1 - y / 110);
    const progress = Math.min(1, Math.max(0, (y - bottomFadeStart) / (photoHeight - bottomFadeStart)));
    const bottomOpacity = progress <= .5 ? progress * 1.6 : .8 + (progress - .5) * .4;
    const offset = row * 4;
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = Math.round((topOpacity + bottomOpacity) * 255);
  }
  return encode({data, width: 1, height, channels: 4});
}

export function buildBrochure(input: BrochureInput, assets: BrochureAssets) {
  const total = input.items.length;
  if (!input.title.trim() || total < 1 || total > BROCHURE_MAX_DEVELOPMENTS) throw Error('Choose 1–20 developments and add a title.');
  const pointsById = new Map(assets.map?.points.map(point => [point.id, point]));
  if (!assets.map?.image || input.items.some(item => {
    const point = pointsById.get(item.id);
    return !point || ![point.x, point.y].every(coordinate => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1);
  })) throw Error('The shortlist map does not match the selected developments. Generate it again.');

  const doc = new jsPDF({unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true});
  for (const [face, data] of [['normal', assets.regular], ['bold', assets.semibold], ['light', assets.light || assets.regular]]) {
    const file = `SourceSans-${face}.ttf`;
    doc.addFileToVFS(file, data);
    doc.addFont(file, 'SourceSans', face);
  }
  if (assets.serifItalic) {
    doc.addFileToVFS('SourceSerif-Italic.ttf', assets.serifItalic);
    doc.addFont('SourceSerif-Italic.ttf', 'SourceSerif', 'italic');
  }
  const warnings = new Set<string>();
  const heroFades = new Map<string, Uint8Array>();
  const brokerName = clean(input.broker.name);
  const firstName = brokerName.split(' ')[0];
  const brokerTitle = clean(input.broker.title || '');
  const role = brokerTitle && !/JLL Residential/i.test(brokerTitle) ? `${brokerTitle}, JLL Residential` : brokerTitle || 'JLL Residential';
  const digits = input.broker.whatsapp.replace(/\D/g, '');
  const phone = digits.startsWith('447') && digits.length === 12 ? `+44 ${digits.slice(2, 6)} ${digits.slice(6)}` : `+${digits}`;
  const callLink = `tel:+${digits}`;
  const email = input.broker.email?.trim() || '';
  const emailLink = email ? `mailto:${email}?subject=${encodeURIComponent('Your London New Homes')}` : '';
  const whatsapp = (message: string) => `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  const generalEnquiry = whatsapp(`Hi ${firstName}, I've been looking at the New Homes you sent me and would like to arrange some viewings.`);
  const developmentEnquiry = (name: string) => whatsapp(`Hi ${firstName}, I'm interested in ${name}. Could we arrange a viewing?`);
  const homeLink = (id: string) => developmentLink(input.origin, id, input.collection, input.brokerSlug);

  function font(size: number, face: Face) {
    if (face === 'italic') doc.setFont(assets.serifItalic ? 'SourceSerif' : 'times', 'italic');
    else doc.setFont('SourceSans', face);
    doc.setFontSize(size);
  }

  function text(value: string | string[], x: number, y: number, size: number, style: TextStyle = {}) {
    const {face = 'light', colour: ink = colour.white, opacity = 1, align = 'left', leading = size * 1.2} = style;
    doc.saveGraphicsState();
    if (opacity < 1) doc.setGState(doc.GState({opacity}));
    font(size, face);
    doc.setTextColor(ink);
    doc.text(value, x, y, {align, lineHeightFactor: leading / size});
    doc.restoreGraphicsState();
  }

  function spanWidth(value: string, size: number, face: Face) {
    font(size, face);
    return doc.getTextWidth(value);
  }

  function limitedCopy(value: string, max: number, label: string) {
    const plain = clean(value);
    if (plain.length <= max) return plain;
    warnings.add(label);
    const prefix = plain.slice(0, max - 1);
    const boundary = plain[max - 1] === ' ' ? prefix.length : prefix.lastIndexOf(' ');
    return prefix.slice(0, boundary > 0 ? boundary : prefix.length).trimEnd() + '…';
  }

  function fit(value: string, width: number, size: number, maxLines: number, face: Face = 'light', minSize = size): FittedText {
    if (!value) return {lines: [], size, shortened: false};
    while (true) {
      font(size, face);
      const lines: string[] = doc.splitTextToSize(value, width);
      if (lines.length <= maxLines) return {lines, size, shortened: false};
      if (size > minSize) {size = Math.max(minSize, size - 1); continue;}
      const kept = lines.slice(0, maxLines);
      let last = kept[maxLines - 1].replace(/[\s.…]+$/, '');
      while (last.includes(' ') && doc.getTextWidth(last + '…') > width) last = last.slice(0, last.lastIndexOf(' '));
      while (last && doc.getTextWidth(last + '…') > width) last = last.slice(0, -1);
      kept[maxLines - 1] = last + '…';
      return {lines: kept, size, shortened: true};
    }
  }

  function fitted(value: string, x: number, baseline: number, width: number, size: number, maxLines: number,
    style: TextStyle = {}, minSize = size, warning?: string) {
    const content = fit(value, width, size, maxLines, style.face, minSize);
    if (warning && content.shortened) warnings.add(warning);
    if (content.lines.length) text(content.lines, x, baseline, content.size, style);
    return content;
  }

  function rect(x: number, y: number, width: number, height: number, fill: string) {
    doc.setFillColor(fill);
    doc.rect(x, y, width, height, 'F');
  }

  function rule(x: number, y: number, length: number, opacity: number) {
    doc.saveGraphicsState();
    doc.setGState(doc.GState({'stroke-opacity': opacity}));
    doc.setDrawColor(colour.white);
    doc.setLineWidth(.5);
    doc.line(x, y, x + length, y);
    doc.restoreGraphicsState();
  }

  function newPage() {
    doc.addPage();
    rect(0, 0, A4_WIDTH, A4_HEIGHT, colour.midnight);
  }

  function lockup(cover = false) {
    const width = cover ? 150 : 120;
    const y = cover ? 32 : 28;
    if (assets.logoDark) {
      const logo = doc.getImageProperties(assets.logoDark);
      doc.addImage(assets.logoDark, 'PNG', left, y, width, width * logo.height / logo.width);
    } else {
      text('JLL Residential', left, y + 18, 18, {face: 'bold'});
    }
  }

  function photo(image: string, x: number, y: number, width: number, height: number) {
    const info = doc.getImageProperties(image);
    const scale = Math.max(width / info.width, height / info.height);
    const imageWidth = info.width * scale;
    const imageHeight = info.height * scale;
    doc.saveGraphicsState();
    doc.rect(x, y, width, height, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(image, 'JPEG', x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight);
    doc.restoreGraphicsState();
  }

  function hero(image: string | undefined, bottom: number, bottomFadeStart = bottom - 195) {
    if (!image) return;
    photo(image, 0, 0, A4_WIDTH, bottom);
    const alias = `brochure-fade-${bottom}-${bottomFadeStart}`;
    let fade = heroFades.get(alias);
    if (!fade) {
      fade = heroFadePng(bottom, bottomFadeStart);
      heroFades.set(alias, fade);
    }
    // A single alpha image avoids the seams PDF viewers draw between translucent fills.
    doc.addImage(fade, 'PNG', 0, 0, A4_WIDTH, bottom + 1, alias, 'FAST');
  }

  function portrait(x: number, y: number, diameter: number) {
    const radius = diameter / 2;
    const centreX = x + radius;
    const centreY = y + radius;
    doc.setFillColor(colour.sand);
    doc.circle(centreX, centreY, radius, 'F');
    if (input.broker.photo) {
      doc.saveGraphicsState();
      doc.circle(centreX, centreY, radius - 1.5, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(input.broker.photo, 'JPEG', x + 1.5, y + 1.5, diameter - 3, diameter - 3);
      doc.restoreGraphicsState();
    } else {
      const initials = brokerName.split(' ').slice(0, 2).map(word => Array.from(word)[0]).join('');
      text(initials, centreX, centreY + diameter * .12, diameter * .32, {align: 'center', colour: colour.midnight});
    }
  }

  function heading(value: string, y: number, size: number, width: number, minSize: number, warning?: string) {
    const title = fit(value, width, size, 2, 'light', minSize);
    if (warning && title.shortened) warnings.add(warning);
    const leading = title.size + 4;
    const baseline = y - (title.lines.length - 1) * leading;
    text(title.lines, left - 2, baseline, title.size, {leading});
    return baseline - title.size * .8 - 8;
  }

  function textLink(label: string, x: number, y: number, width: number, size: number, url: string, style: TextStyle = {}) {
    const fittedLabel = fit(label, width, size, 1, style.face, 11);
    const line = fittedLabel.lines[0];
    if (!line || !url) return;
    text(line, x, y, fittedLabel.size, style);
    doc.link(x, y - fittedLabel.size - 3, spanWidth(line, fittedLabel.size, style.face || 'light'), fittedLabel.size + 10, {url});
  }

  function whatsappButtonWidth(maxWidth: number) {
    return Math.min(maxWidth, Math.max(144, spanWidth(`WhatsApp ${firstName}`, 14, 'bold') + 53));
  }

  function button(label: string, x: number, y: number, width: number, url: string, style: 'sand' | 'midnight' | 'outline', icon?: string) {
    const height = 38;
    const fill = style === 'midnight' ? colour.midnight : colour.sand;
    const ink = style === 'midnight' ? colour.sand : style === 'outline' ? colour.white : colour.midnight;
    doc.setFillColor(fill);
    doc.setDrawColor(colour.white);
    doc.setLineWidth(1);
    doc.roundedRect(x, y, width, height, 2, 2, style === 'outline' ? 'S' : 'F');
    const iconSpace = icon ? 21 : 0;
    const labelText = fit(label, width - 30 - iconSpace, 14, 1, 'bold', 11);
    const line = labelText.lines[0];
    const start = x + (width - iconSpace - spanWidth(line, labelText.size, 'bold')) / 2;
    if (icon) doc.addImage(icon, 'PNG', start, y + 12, 14, 14);
    text(line, start + iconSpace, y + 24, labelText.size, {face: 'bold', colour: ink});
    doc.link(x, y, width, height, {url});
  }

  function whatsappButton(x: number, y: number, width: number, url: string, dark = false) {
    button(`WhatsApp ${firstName}`, x, y, width, url, dark ? 'midnight' : 'sand', dark ? assets.whatsappSand : assets.whatsappMidnight);
  }

  function numberCircle(number: number, x: number, y: number, diameter = 20) {
    doc.setFillColor(colour.sand);
    doc.circle(x + diameter / 2, y + diameter / 2, diameter / 2, 'F');
    text(String(number), x + diameter / 2, y + diameter / 2 + 4, 12, {face: 'bold', align: 'center', colour: colour.midnight});
  }

  function tag(label: string | string[], number: number, x: number, y: number, width: number, fontSize: number) {
    doc.setFillColor(colour.midnight);
    doc.roundedRect(x, y, width, MAP_TAG_HEIGHT, 15, 15, 'F');
    numberCircle(number, x + 5, y + 5);
    const multiline = Array.isArray(label) && label.length > 1;
    text(label, x + 31, y + (multiline ? 12.5 : 19.5), fontSize, {face: 'bold', leading: 12});
  }

  function pageNumber(y = 827) {
    text(String(doc.getNumberOfPages()), right, y, 10, {align: 'right', opacity: .6});
  }

  function cover() {
    rect(0, 0, A4_WIDTH, A4_HEIGHT, colour.midnight);
    hero(input.coverImage, 480, 210);
    lockup(true);
    const labelY = heading(clean(input.title), 442, 46, 540, 34, 'Cover headline');
    const client = limitedCopy(input.clientName || '', BROCHURE_MAX_CLIENT_NAME, 'Client name');
    if (client) fitted(`Selected for ${client}`, left, labelY, contentWidth, 20, 1, {face: 'italic', colour: colour.sand}, 16, 'Client name');
    const date = (input.date || new Date()).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London'});
    text(`${total} ${total === 1 ? 'development' : 'developments'} · ${date}`, left, 465, 13, {face: 'normal', opacity: .75});
    rule(left, 500, contentWidth, .25);
    const intro = limitedCopy(input.intro, BROCHURE_MAX_INTRO, 'Cover introduction');
    const actionTop = intro ? 786 : 629;
    const portraitSize = 64;
    let portraitTop = actionTop - portraitSize - 30;
    if (intro) {
      const introBaseline = 550;
      const introLeading = 23;
      fitted(`A note from ${firstName}`, left, 526, contentWidth, 18, 1, {face: 'italic', colour: colour.sand}, 14);
      const copy = fitted(intro, left, introBaseline, contentWidth, 16, 7, {leading: introLeading}, 16, 'Cover introduction');
      const lastIntroBaseline = introBaseline + (copy.lines.length - 1) * introLeading;
      portraitTop = Math.max(portraitTop, lastIntroBaseline + 16);
    }
    portrait(left, portraitTop, portraitSize);
    fitted(brokerName, 114, portraitTop + 26, right - 114, 18, 1, {face: 'bold'}, 14, 'Cover broker name');
    fitted(role, 114, portraitTop + 45, right - 114, 13, 2, {opacity: .75, leading: 15}, 12, 'Cover job title');
    const whatsappWidth = whatsappButtonWidth(188);
    whatsappButton(left, actionTop, whatsappWidth, generalEnquiry);
    const callX = left + whatsappWidth + 20;
    const callLabel = `Call ${phone}`;
    textLink(callLabel, callX, actionTop + 24, 140, 13, callLink, {face: 'bold'});
    const emailX = callX + spanWidth(callLabel, 13, 'bold') + 20;
    textLink(email, emailX, actionTop + 24, right - emailX, 13, emailLink, {opacity: .8});
  }

  function shortlistHeading(continued: boolean) {
    newPage();
    lockup();
    text(continued ? 'Your shortlist (continued)' : 'Your shortlist', left, 102, 32);
    if (!continued) text('Development locations', left, 133, 16, {face: 'italic', colour: colour.sand});
  }

  function shortlistMap(height: number) {
    const map = assets.map;
    doc.addImage(map.image, doc.getImageProperties(map.image).fileType, 0, SHORTLIST_MAP_TOP, A4_WIDTH, height);
    const labels = input.items.map((development, index) => {
      const name = brochureDevelopmentName(development.name);
      const single = fit(name, MAP_TAG_MAX_WIDTH - 41, 13, 1, 'bold', 11);
      const label = single.shortened ? fit(name, MAP_TAG_MAX_WIDTH - 41, 11, 2, 'bold') : single;
      const width = Math.max(...label.lines.map(line => spanWidth(line, label.size, 'bold'))) + 41;
      return {...pointsById.get(development.id)!, label: label.lines, size: label.size, number: index + 1, width};
    });
    const placements = layoutBrochurePins(labels, A4_WIDTH, height);
    for (const {anchor, tip} of placements) {
      if (Math.hypot(anchor.x - tip.x, anchor.y - tip.y) < 1) continue;
      doc.setDrawColor(colour.midnight);
      doc.setLineWidth(.6);
      doc.line(anchor.x, SHORTLIST_MAP_TOP + anchor.y, tip.x, SHORTLIST_MAP_TOP + tip.y);
      doc.setFillColor(colour.midnight);
      doc.circle(anchor.x, SHORTLIST_MAP_TOP + anchor.y, 2, 'F');
    }
    placements.forEach(({rect: box, tip}, index) => {
      const label = labels[index];
      const y = SHORTLIST_MAP_TOP + box.y;
      tag(label.label, label.number, box.x, y, box.width, label.size);
      doc.setFillColor(colour.midnight);
      doc.triangle(tip.x - 5.5, SHORTLIST_MAP_TOP + tip.y - MAP_TAG_TIP_HEIGHT,
        tip.x + 5.5, SHORTLIST_MAP_TOP + tip.y - MAP_TAG_TIP_HEIGHT,
        tip.x, SHORTLIST_MAP_TOP + tip.y, 'F');
      doc.link(box.x, y, box.width, box.height + MAP_TAG_TIP_HEIGHT, {url: homeLink(label.id)});
    });
    const creditRight = A4_WIDTH - 10;
    const creditY = SHORTLIST_MAP_TOP + height - 7;
    const creditWidth = spanWidth(map.attribution, 8, 'light');
    doc.saveGraphicsState();
    doc.setGState(doc.GState({opacity: .84}));
    rect(creditRight - creditWidth - 4, creditY - 8, creditWidth + 8, 12, colour.white);
    doc.restoreGraphicsState();
    text(map.attribution, creditRight, creditY, 8, {align: 'right', colour: colour.midnight});
  }

  function shortlistRows(start: number, end: number, y: number, rowHeight: number) {
    for (let index = start; index < end; index++, y += rowHeight) {
      const development = input.items[index];
      const image = assets.photos[development.id];
      if (image) photo(image, left, y, 75, 52);
      else rect(left, y, 75, 52, colour.space);
      numberCircle(index + 1, 123, y + 4, 18);
      const name = fitted(brochureDevelopmentName(development.name), 150, y + 18, 278, 16, 2, {face: 'bold', leading: 16}, 13);
      fitted(`${development.area}, ${development.postcode} · ${bedRange(development)}`, 150, y + (name.lines.length === 2 ? 48 : 38), 278, 12, 1, {opacity: .8}, 11);
      text('From', right, y + 19, 12, {face: 'italic', align: 'right', colour: colour.sand});
      const price = startingPrice(development);
      fitted(priceLabel(price), right, y + 41, 120, price === null ? 14 : 18, 1, {align: 'right', face: 'bold'}, 11);
      rule(left, y + rowHeight - 4, contentWidth, .2);
      doc.link(left, y, contentWidth, rowHeight - 4, {url: homeLink(development.id)});
    }
  }

  function shortlist() {
    shortlistHeading(false);
    const height = shortlistMapHeight(total);
    shortlistMap(height);
    const firstPageEnd = Math.min(total, firstShortlistLimit);
    const rowHeight = total <= 3 ? 72 : total >= 6 ? 56 : 60;
    shortlistRows(0, firstPageEnd, SHORTLIST_MAP_TOP + height + (total <= 3 ? 20 : 14), rowHeight);
    pageNumber();
    for (let start = firstPageEnd; start < total; start += continuationLimit) {
      shortlistHeading(true);
      shortlistRows(start, Math.min(start + continuationLimit, total), 144, 60);
      pageNumber();
    }
  }

  function developmentPage(development: Development, index: number) {
    newPage();
    const name = brochureDevelopmentName(development.name);
    hero(assets.photos[development.id], 320);
    lockup();
    const tagLabel = `${index + 1} of ${total} on your shortlist`;
    const tagWidth = spanWidth(tagLabel, 13, 'bold') + 41;
    tag(tagLabel, index + 1, right - tagWidth, 28, tagWidth, 13);
    const areaY = heading(name, 300, 48, contentWidth + 2, 34, `${name} headline`);
    fitted(clean(`${development.area}, ${development.postcode}`), left, areaY, contentWidth, 18, 1, {face: 'italic', colour: colour.sand}, 14);

    const bedTypes = bedroomTypes(development).slice(0, 5);
    const priceTop = 340;
    const priceBottom = priceTop + 110 + bedTypes.length * 25;
    rect(340, priceTop, right - 340, priceBottom - priceTop, colour.space);
    text('Prices from', 358, 371, 16, {face: 'italic', colour: colour.sand});
    const price = startingPrice(development);
    fitted(priceLabel(price), 358, 409, right - 376, price === null ? 21 : 32, 1, {face: 'bold'}, 16);
    rule(358, 435, right - 376, .3);
    bedTypes.forEach((beds, row) => {
      const y = 460 + row * 25;
      text(bedLabel(beds), 358, y, 13);
      const unitPrice = startingPrice(development, beds);
      fitted(unitPrice === null ? 'Speak to your broker' : priceLabel(unitPrice), right - 18, y, 114, 14, 1, {align: 'right', face: 'bold'}, 11);
    });

    const description = brochureIntroduction(development.description);
    const features = brochureFeatures(development);
    const note = limitedCopy(input.notes[development.id] || '', BROCHURE_MAX_NOTE, `${name} broker note`);
    const layout = (descriptionLimit: number, featureLimit: number, noteLimit: number) => {
      const summary = fit(description, 280, 14, descriptionLimit);
      const visibleFeatures = features.slice(0, featureLimit).map(feature => fit(feature, 264, 13, 1));
      const summaryBottom = summary.lines.length ? 352 + (summary.lines.length - 1) * 21 : 331;
      const featuresTitle = summaryBottom + 28;
      const featuresBottom = visibleFeatures.length ? featuresTitle + 24 + (visibleFeatures.length - 1) * 21 + 4 : summaryBottom + 4;
      const noteText = fit(note, contentWidth - 86, 13, noteLimit);
      const noteY = Math.max(featuresBottom, priceBottom) + 18;
      const noteHeight = noteText.lines.length ? 65 + (noteText.lines.length - 1) * 19 : 0;
      return {summary, visibleFeatures, featuresTitle, noteText, noteY, noteHeight};
    };
    let body = layout(6, 6, 4);
    if (body.noteHeight && body.noteY + body.noteHeight > 718) body = layout(5, 6, 4);
    if (body.noteHeight && body.noteY + body.noteHeight > 718) body = layout(5, 5, 4);
    if (body.noteHeight && body.noteY + body.noteHeight > 718) body = layout(5, 5, 3);
    if (body.summary.shortened) warnings.add(`${name} description`);
    if (body.visibleFeatures.length < features.length || body.visibleFeatures.some(feature => feature.shortened)) warnings.add(`${name} features`);
    if (body.noteText.shortened) warnings.add(`${name} broker note`);
    if (body.summary.lines.length) text(body.summary.lines, left, 352, 14, {leading: 21});
    if (body.visibleFeatures.length) {
      text('Key features', left, body.featuresTitle, 16, {face: 'italic', colour: colour.sand});
      body.visibleFeatures.forEach((feature, row) => {
        const y = body.featuresTitle + 24 + row * 21;
        rect(left, y - 4, 9, 1, colour.sand);
        text(feature.lines, 52, y, 13);
      });
    }
    if (body.noteHeight) {
      rect(left, body.noteY, contentWidth, body.noteHeight, colour.space);
      rect(left, body.noteY, 3, body.noteHeight, colour.sand);
      portrait(left + 18, body.noteY + 16, 38);
      fitted(`A note from ${firstName}`, left + 68, body.noteY + 29, contentWidth - 86, 16, 1, {face: 'italic', colour: colour.sand}, 13);
      text(body.noteText.lines, left + 68, body.noteY + 49, 13, {leading: 19});
    }

    rect(0, 732, A4_WIDTH, A4_HEIGHT - 732, colour.sand);
    const buttonWidth = whatsappButtonWidth(184);
    const buttonX = right - buttonWidth;
    const copyWidth = buttonX - left - 16;
    fitted(`Interested in ${name}?`, left, 762, copyWidth, 16, 1, {face: 'italic', colour: colour.midnight}, 13);
    fitted(`Message ${firstName} to arrange a viewing`, left, 787, copyWidth, 17, 1, {face: 'bold', colour: colour.midnight}, 13);
    whatsappButton(buttonX, 758, buttonWidth, developmentEnquiry(name), true);
    textLink('View in the JLL portfolio →', left, 815, copyWidth, 12, homeLink(development.id), {face: 'bold', colour: colour.midnight});
    const disclaimer = development.sample ? 'Illustrative sample. Prices are indicative.' : 'Prices and availability subject to change.';
    text(disclaimer, right, 815, 10, {align: 'right', colour: colour.midnight});
    text(String(doc.getNumberOfPages()), right - spanWidth(disclaimer, 10, 'light') - 20, 815, 10, {align: 'right', colour: colour.midnight});
  }

  function nextSteps() {
    newPage();
    hero(input.coverImage, 320);
    lockup();
    heading('Let’s arrange your viewings', 300, 40, contentWidth, 36);
    const body = 'Message me on WhatsApp with the developments you’d like to see and a few times that suit you. I’ll arrange the viewings and send you everything you need beforehand.';
    fitted(body, left, 359, contentWidth, 15, 3, {leading: 22});
    const steps = [
      ['Message me', 'Tell me which homes you like'],
      ['Book a viewing', 'I’ll confirm the time and place'],
      ['Reserve', 'I’ll guide you through each step'],
    ];
    steps.forEach(([title, copy], index) => {
      const x = left + 180 * index;
      doc.setDrawColor(colour.sand);
      doc.setLineWidth(1);
      doc.circle(x + 14, 454, 14, 'S');
      text(String(index + 1), x + 14, 459, 15, {face: 'italic', align: 'center', colour: colour.sand});
      text(title, x, 493, 15, {face: 'bold'});
      fitted(copy, x, 511, Math.min(165, right - x), 12, 2, {opacity: .8, leading: 16});
    });
    rect(left, 560, contentWidth, 180, colour.space);
    portrait(56, 580, 84);
    const contactX = 161;
    const contactWidth = right - 18 - contactX;
    text('Your contact', contactX, 596, 15, {face: 'italic', colour: colour.sand});
    fitted(brokerName, contactX, 624, contactWidth, 22, 1, {face: 'bold'}, 16, 'Contact name');
    fitted(role, contactX, 644, contactWidth, 13, 1, {opacity: .8}, 11, 'Contact job title');
    if (email) {
      text('Email', contactX, 666, 13, {face: 'bold', colour: colour.sand});
      textLink(email, contactX + 37, 666, contactWidth - 37, 13, emailLink);
    }
    const width = whatsappButtonWidth(204);
    whatsappButton(56, 682, width, generalEnquiry);
    const callLabel = `Call ${phone}`;
    button(callLabel, 66 + width, 682, Math.max(155, spanWidth(callLabel, 14, 'bold') + 32), callLink, 'outline');
    text('Prices and availability subject to change. Images are indicative and may include CGIs or show homes.', left, 803, 10, {opacity: .6});
    pageNumber();
  }

  cover();
  shortlist();
  input.items.forEach(developmentPage);
  nextSteps();
  doc.setProperties({title: clean(input.title), author: brokerName, subject: 'Selected London New Homes', creator: 'JLL New Homes Portfolio'});
  return Object.assign(doc, {brochureWarnings: [...warnings]});
}
