import {useState} from 'react';
import {useLocale} from './i18n';
import {sizedDevelopmentPhoto} from './development-photo-url';
import type {Development} from './types';

export default function DevelopmentPhoto({development, photoIndex, loading, decorative = false}: {
  development: Pick<Development, 'name' | 'images' | 'sample'>;
  photoIndex?: number;
  loading?: 'eager' | 'lazy';
  decorative?: boolean;
}) {
  const {t} = useLocale();
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const photos = photoIndex === undefined
    ? development.images.slice(0, 3)
    : development.images.slice(photoIndex, photoIndex + 1);
  const width = photoIndex === undefined ? 960 : 1600;
  const sources = photos.filter(Boolean).flatMap(url => [
    sizedDevelopmentPhoto(url, width), url,
  ]);
  const source = sources.find(url => !failed.has(url));
  const alt = decorative || !source ? '' : development.sample ? 'Architectural illustration' : development.name;

  return <>
    <img key={source} src={source ?? '/images/city.svg'} alt={alt} loading={loading}
      onError={source ? () => setFailed(previous => new Set(previous).add(source)) : undefined}/>
    {!source && !development.sample && !decorative && <span className="photo-unavailable">{t('Photo unavailable')}</span>}
  </>;
}
