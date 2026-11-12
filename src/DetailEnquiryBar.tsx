import {useState, type ReactNode} from 'react';
import {ArrowUpRight, Bot} from 'lucide-react';
import {developmentLink} from '../shared/sharing';
import {track} from './analytics';
import {useLocale} from './i18n';
import WhatsAppIcon from './WhatsAppIcon';
import type {BrokerCard, Development} from './types';

const JLL_ASSISTANT_WHATSAPP = '447711939577';

export default function DetailEnquiryBar({broker, development, collection, closeButton}: {
  broker: BrokerCard | null;
  development: Pick<Development, 'id' | 'name'>;
  collection?: string;
  closeButton: ReactNode;
}) {
  const {t} = useLocale();
  const [unavailablePhoto, setUnavailablePhoto] = useState<string>();
  const name = broker?.name ?? 'JLL Residential';
  const photo = broker?.photo;
  const words = name.trim().split(/\s+/);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase();
  const number = broker?.whatsapp.replace(/\D/g, '') ?? JLL_ASSISTANT_WHATSAPP;
  const message = t(broker
    ? 'Hi, I’m interested in {name}. Could you share current availability, pricing and viewing options?'
    : 'Hi, I’d like to enquire about {name}. Could you share more information?', {name: development.name});
  const link = developmentLink(location.origin, development.id, broker ? collection : undefined, broker?.slug);
  const href = `https://wa.me/${number}?text=${encodeURIComponent(`${message}\n${link}`)}`;

  return <div className="detail-viewing-bar">
    <div className="detail-broker-contact">
      <span className="detail-broker-avatar" aria-hidden="true">
        {!broker ? <Bot size={24}/> : photo && photo !== unavailablePhoto
          ? <img src={photo} alt="" width={48} height={48} onError={() => setUnavailablePhoto(photo)}/>
          : initials}
      </span>
      <div className="detail-broker-identity">
        <span className="detail-broker-role">{t(broker ? 'Your JLL broker' : 'Automated assistant')}</span>
        <strong><bdi>{name}</bdi></strong>
        <span className="detail-broker-help">{t('Ask about availability, pricing or viewings.')}</span>
      </div>
    </div>
    <a className="detail-enquiry-action" href={href} target="_blank" rel="noopener noreferrer"
      onClick={() => track('whatsapp_click', {surface: 'detail', development_id: development.id})}>
      <WhatsAppIcon size={19}/><span>{t('Enquire on WhatsApp')}</span><ArrowUpRight size={16} aria-hidden="true"/>
    </a>
    {closeButton}
  </div>;
}
