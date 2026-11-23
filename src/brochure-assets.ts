import type {Development} from './types';
import {SHORTLIST_MAP_WIDTH_PX} from './brochure-map-view';

function base64(bytes: Uint8Array) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}

let fonts: Promise<{regular: string; semibold: string; light: string; serifItalic: string}> | undefined;
export function brochureFonts() {
  fonts ??= Promise.all(['source-sans-3-regular.ttf', 'source-sans-3-semibold.ttf', 'source-sans-3-light.ttf', 'source-serif-4-light-italic.ttf'].map(async file => {
    const response = await fetch('/fonts/' + file, {signal: AbortSignal.timeout(15_000)});
    if (!response.ok) throw Error('Brochure fonts could not load. Please try again.');
    return base64(new Uint8Array(await response.arrayBuffer()));
  })).then(([regular, semibold, light, serifItalic]) => ({regular, semibold, light, serifItalic})).catch(error => {
    fonts = undefined;
    throw error;
  });
  return fonts;
}

function loadImage(url: string, timeout: number) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => {
      image.onload = image.onerror = null;
      image.src = '';
      reject(Error('Image loading timed out.'));
    }, timeout);
    image.onload = () => {clearTimeout(timer); resolve(image);};
    image.onerror = () => {clearTimeout(timer); reject(Error('Image could not load.'));};
    image.src = url;
  });
}

async function brochurePhoto(url: string, targetHeight: number) {
  try {
    const image = await loadImage(url, 7000);
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

export async function brochurePhotos(items: Development[], progress: (value: string) => void) {
  const photos: Record<string, string> = {};
  const missing: string[] = [];
  let completed = 0;
  for (let start = 0; start < items.length; start += 3) {
    await Promise.all(items.slice(start, start + 3).map(async development => {
      const images = [...new Set(development.images)];
      const urls = [...new Set([images.find(isExterior), ...images])].filter((url): url is string => Boolean(url));
      for (const url of urls.slice(0, 3)) {
        const image = await brochurePhoto(url, 640);
        if (!image) continue;
        photos[development.id] = image;
        break;
      }
      if (!photos[development.id]) missing.push(development.name);
      progress(`Preparing photography ${++completed} of ${items.length}…`);
    }));
  }
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
  const [logoDark, icons] = await Promise.all([brandLogo(), pdfWhatsAppIcons()]);
  return {logoDark, ...icons};
}

export async function defaultBrochureCover() {
  const response = await fetch('/api/admin/brochure-cover', {signal: AbortSignal.timeout(15_000)});
  if (!response.ok) throw Error('The London skyline cover could not load. Try again.');
  if (response.status === 204) return brochurePhoto('/images/london-skyline-cover.jpg', 960);
  const url = URL.createObjectURL(await response.blob());
  try {return await brochurePhoto(url, 960);}
  finally {URL.revokeObjectURL(url);}
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
