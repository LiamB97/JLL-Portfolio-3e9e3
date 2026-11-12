import {useState} from 'react';
import {useLocale} from './i18n';
import type {Development} from './types';

const jllPhoto = /^(https:\/\/res\.cloudinary\.com\/jll-global-olm-np\/image\/upload\/)w_\d+,c_limit,q_auto:good,f_auto,fl_progressive\//;

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
    url.replace(jllPhoto, `$1w_${width},c_limit,q_auto:good,f_jpg/`), url,
  ]);
  const source = sources.find(url => !failed.has(url));
  const alt = decorative || !source ? '' : development.sample ? 'Architectural illustration' : development.name;

  return <>
    <img key={source} src={source ?? '/images/city.svg'} alt={alt} loading={loading}
      onError={source ? () => setFailed(previous => new Set(previous).add(source)) : undefined}/>
    {!source && !development.sample && !decorative && <span className="photo-unavailable">{t('Photo unavailable')}</span>}
  </>;
}
