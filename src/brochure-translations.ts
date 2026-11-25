import type {BuyerLanguage} from '../shared/buyer-language';
import type {Development} from './types';

export async function localiseBrochureListings(items: Development[], language: BuyerLanguage) {
  if (language === 'en') return {items, untranslated: []};
  const translated = [...items];
  const untranslated = new Set<string>();
  const signal = AbortSignal.timeout(16_000);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      const reviewed = item.translations?.[language];
      if (reviewed?.description) {
        translated[index] = {...item, ...reviewed};
        continue;
      }
      try {
        const response = await fetch('/api/admin/brochures/translation/' + encodeURIComponent(item.id) +
          '?language=' + encodeURIComponent(language), {signal});
        if (!response.ok) throw Error('Translation unavailable');
        const data = await response.json();
        if (typeof data.description !== 'string' || !data.description.trim() || !Array.isArray(data.amenities) ||
          !data.amenities.every((feature: unknown) => typeof feature === 'string')) throw Error('Translation unavailable');
        translated[index] = {...item, description: data.description, amenities: data.amenities};
      } catch {
        untranslated.add(item.id);
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, items.length)}, worker));
  return {items: translated, untranslated: items.filter(item => untranslated.has(item.id)).map(item => item.id)};
}
