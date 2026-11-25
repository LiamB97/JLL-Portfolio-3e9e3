import type {Development} from './types';
import {SHORTLIST_MAP_WIDTH_PX} from './brochure-map-view.ts';
import {sizedDevelopmentPhoto} from './development-photo-url.ts';
import type {BuyerLanguage} from '../shared/buyer-language';

const PHOTO_WIDTH = 1280;
const PHOTO_ATTEMPT_MS = 6000;
const DEVELOPMENT_PHOTO_BUDGET_MS = 12000;

function base64(bytes: Uint8Array) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}

let fonts: Promise<{regular: string; semibold: string; light: string; serifItalic: string}> | undefined;
const scriptFonts = new Map<'ar' | 'zh-CN', Promise<string>>();

async function loadFont(file: string, timeout = 15_000) {
  const response = await fetch('/fonts/' + file, {signal: AbortSignal.timeout(timeout)});
  if (!response.ok) throw Error('Brochure fonts could not load. Please try again.');
  return base64(new Uint8Array(await response.arrayBuffer()));
}

export async function brochureFonts(language: BuyerLanguage = 'en') {
  fonts ??= Promise.all(['source-sans-3-regular.ttf', 'source-sans-3-semibold.ttf', 'source-sans-3-light.ttf', 'source-serif-4-light-italic.ttf'].map(file => loadFont(file)))
    .then(([regular, semibold, light, serifItalic]) => ({regular, semibold, light, serifItalic})).catch(error => {
    fonts = undefined;
    throw error;
  });
  if (language !== 'ar' && language !== 'zh-CN') return fonts;
  let script = scriptFonts.get(language);
  if (!script) {
    script = loadFont(language === 'ar' ? 'noto-sans-arabic-pdf.ttf' : 'noto-sans-sc-pdf.ttf', 30_000)
      .catch(error => {scriptFonts.delete(language); throw error;});
    scriptFonts.set(language, script);
  }
  const [latin, scriptFont] = await Promise.all([fonts, script]);
  return {...latin, scriptFont};
}

function loadImage(url: string, timeout: number) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => {
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      reject(Error('Image loading timed out.'));
    }, timeout);
    image.onload = () => {clearTimeout(timer); resolve(image);};
    image.onerror = () => {clearTimeout(timer); reject(Error('Image could not load.'));};
    image.src = url;
  });
}

async function brochurePhoto(url: string, targetHeight: number, timeout = PHOTO_ATTEMPT_MS) {
  try {
    const image = await loadImage(url, timeout);
    // Keep the whole photograph. The PDF clips it to the placement, with its own fade.
    const {naturalWidth: width, naturalHeight: height} = image;
    const scale = Math.min(1, Math.max(SHORTLIST_MAP_WIDTH_PX / width, targetHeight / height), 2048 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#131E29';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .8);
  } catch {
    return null;
  }
}

function isExterior(url: string) {
  const filename = url.split(/[?#]/, 1)[0].split('/').at(-1) ?? '';
  return /exterior|external|fa(?:c|ç|%c3%a7)ade/i.test(filename);
}

export async function brochurePhotos(items: Development[], progress: (completed: number) => void) {
  const photos: Record<string, string> = {};
  let next = 0;
  let completed = 0;
  async function preparePhotos() {
    while (next < items.length) {
      const development = items[next++];
      const images = [...new Set(development.images)];
      const originals = [...new Set([images.find(isExterior), ...images])]
        .filter((url): url is string => Boolean(url)).slice(0, 3);
      const candidates = new Set([...originals.map(url => sizedDevelopmentPhoto(url, PHOTO_WIDTH)), ...originals]);
      const deadline = performance.now() + DEVELOPMENT_PHOTO_BUDGET_MS;
      for (const url of candidates) {
        const remaining = deadline - performance.now();
        if (remaining <= 0) break;
        const image = await brochurePhoto(url, 640, Math.min(remaining, PHOTO_ATTEMPT_MS));
        if (!image) continue;
        photos[development.id] = image;
        break;
      }
      progress(++completed);
    }
  }
  await Promise.all(Array.from({length: Math.min(items.length, 4)}, preparePhotos));
  const missing = items.filter(item => !photos[item.id]).map(item => item.name);
  return {photos, missing};
}

async function brandLogo() {
  const image = await loadImage('/images/jll-residential-dark.svg', 10_000);
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
  const context = canvas.getContext('2d');
  if (!context) throw Error('Brochure branding could not load. Please try again.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export async function brochureBrand() {
  const [logoDark, icons] = await Promise.all([
    brandLogo().catch(() => undefined),
    pdfWhatsAppIcons().catch(() => undefined),
  ]);
  return {logoDark, ...icons, fallback: !logoDark || !icons};
}

export async function defaultBrochureCover() {
  let fallback = false;
  try {
    const response = await fetch('/api/admin/brochure-cover', {signal: AbortSignal.timeout(6_000)});
    if (response.status !== 204) {
      if (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/')) throw Error('Cover unavailable');
      const url = URL.createObjectURL(await response.blob());
      try {
        const image = await brochurePhoto(url, 960);
        if (image) return {image, fallback};
        fallback = true;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    fallback = true;
  }
  const image = await brochurePhoto('/images/london-skyline-cover.jpg', 960);
  return {image: image ?? undefined, fallback};
}

async function pdfWhatsAppIcons() {
  const image = await loadImage('/images/whatsapp.svg', 10_000);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 42;
  const context = canvas.getContext('2d');
  if (!context) throw Error('The WhatsApp icon could not load.');
  const icon = (colour: string) => {
    context.clearRect(0, 0, 42, 42);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(image, 0, 0, 42, 42);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = colour;
    context.fillRect(0, 0, 42, 42);
    return canvas.toDataURL('image/png');
  };
  return {whatsappMidnight: icon('#131E29'), whatsappSand: icon('#E0C6AD')};
}
