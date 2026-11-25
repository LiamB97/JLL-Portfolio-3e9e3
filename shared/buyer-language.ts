export const buyerLanguages = [
  {value: 'en', label: 'English'},
  {value: 'zh-CN', label: '简体中文'},
  {value: 'tr', label: 'Türkçe'},
  {value: 'ar', label: 'العربية'},
] as const;

export type BuyerLanguage = typeof buyerLanguages[number]['value'];

export function isBuyerLanguage(value: unknown): value is BuyerLanguage {
  return buyerLanguages.some(language => language.value === value);
}

export const buyerLanguage = (value: unknown): BuyerLanguage => isBuyerLanguage(value) ? value : 'en';

export const collectionTitles: Record<BuyerLanguage, string> = {
  en: 'Homes picked for you', 'zh-CN': '为您精选的住宅', tr: 'Sizin için seçilen konutlar', ar: 'منازل اخترناها لك',
};
export const brochureTitles: Record<BuyerLanguage, string> = {
  en: 'Your London New Homes', 'zh-CN': '为您精选的伦敦新住宅', tr: 'Londra’da sizin için seçilen yeni konutlar', ar: 'منازلك الجديدة في لندن',
};
