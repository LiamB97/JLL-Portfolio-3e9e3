import {useState} from 'react';
import {ArrowUpRight, PersonStanding} from 'lucide-react';
import Modal from './Modal';
import {useLocale} from './i18n';
import type {Development} from './types';

const embedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();
export const streetViewEmbedEnabled = Boolean(embedKey);

export function hasStreetView({lat, lng, sample}: Development) {
  return !sample && Number.isFinite(lat) && Math.abs(lat) <= 90
    && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

export function streetViewUrl({lat, lng}: Development) {
  const query = new URLSearchParams({api: '1', map_action: 'pano', viewpoint: `${lat},${lng}`});
  return `https://www.google.com/maps/@?${query}`;
}

export function StreetViewDialog({development, close}: {development: Development; close: () => void}) {
  const {t} = useLocale();
  if (!embedKey || !hasStreetView(development)) return null;
  const {lat, lng, name} = development;
  const title = t('Street View for {name}', {name});
  const query = new URLSearchParams({key: embedKey, location: `${lat},${lng}`});

  return <Modal title={title} close={close} className="street-view-dialog" doneLabel={null}
    footer={<a className="street-view-external" href={streetViewUrl(development)} target="_blank" rel="noopener noreferrer">
      {t('Open in Google Maps')} <ArrowUpRight size={16} aria-hidden="true"/>
    </a>}>
    <iframe title={title} src={`https://www.google.com/maps/embed/v1/streetview?${query}`}
      referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
  </Modal>;
}

export function StreetViewAction({development}: {development: Development}) {
  const {t} = useLocale();
  const [open, setOpen] = useState(false);
  if (!hasStreetView(development)) return null;
  const label = <><PersonStanding size={18} aria-hidden="true"/>{t('Street View')}</>;

  if (!streetViewEmbedEnabled) {
    return <a className="development-street-view" href={streetViewUrl(development)} target="_blank" rel="noopener noreferrer">
      {label}<ArrowUpRight size={14} aria-hidden="true"/>
    </a>;
  }
  return <>
    <button className="development-street-view" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>{label}</button>
    {open && <StreetViewDialog development={development} close={() => setOpen(false)}/>}
  </>;
}
