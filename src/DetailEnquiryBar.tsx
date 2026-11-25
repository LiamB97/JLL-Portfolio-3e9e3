import {useState, type ReactNode} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {developmentLink} from '../shared/sharing';
import {track} from './analytics';
import {useLocale} from './i18n';
import WhatsAppIcon from './WhatsAppIcon';
import WeChatContact,{hasWeChat} from './WeChatContact';
import type {BrokerCard, Development} from './types';

const JLL_WHATSAPP = '447711939577';

export default function DetailEnquiryBar({broker, development, collection, closeButton}: {
  broker: BrokerCard | null;
  development: Pick<Development, 'id' | 'name'>;
  collection?: string;
  closeButton: ReactNode;
}) {
  const {t, language} = useLocale();
  const campaign=broker?.campaign==='your-first-home';
  const [unavailablePhoto, setUnavailablePhoto] = useState<string>();
  const name = broker?.name ?? 'JLL Residential';
  const photo = broker?.photo;
  const words = name.trim().split(/\s+/);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase();
  const number = broker?.whatsapp.replace(/\D/g, '') ?? JLL_WHATSAPP;
  const message = campaign?`Hi ${broker?.slug==='your-first-home'?'Your First Home team':name}, I’m interested in ${development.name}. Could you confirm current availability, prices and potential scheme participation?`:t(broker
    ? 'Hi, I’m interested in {name}. Could you share current availability, pricing and viewing options?'
    : 'Hi, I’d like to enquire about {name}. Could you share more information?', {name: development.name});
  const shareLanguage = language !== 'en' || new URLSearchParams(location.search).has('lang') ? language : undefined;
  const link = developmentLink(location.origin, development.id, broker ? collection : undefined, broker?.slug, shareLanguage);
  const href = `https://wa.me/${number}?text=${encodeURIComponent(`${message}\n${link}`)}`;

  const wechat = hasWeChat(broker);
  const whatsapp = <a className="detail-enquiry-action" href={href} target="_blank" rel="noopener noreferrer"
    aria-label={t('Enquire on WhatsApp')} onClick={() => track('whatsapp_click', {surface: 'detail', development_id: development.id})}>
    <WhatsAppIcon size={19}/><span>{wechat?'WhatsApp':t('Enquire on WhatsApp')}</span><ArrowUpRight size={16} aria-hidden="true"/>
  </a>;

  return <div className={'detail-viewing-bar'+(campaign?' yfh-detail-contact':'')}>
    <div className="detail-broker-contact">
      <span className={broker ? 'detail-broker-avatar' : 'detail-broker-avatar detail-jll-avatar'} aria-hidden="true">
        {campaign?<img src="/images/your-first-home-logo.png" alt="" width={32} height={40}/>:!broker ? <img src="/images/jll-logo.svg" alt="" width={38} height={17}/> : photo && photo !== unavailablePhoto
          ? <img src={photo} alt="" width={48} height={48} onError={() => setUnavailablePhoto(photo)}/>
          : initials}
      </span>
      <div className="detail-broker-identity">
        {broker && <span className="detail-broker-role">{campaign?'JLL Residential':t('Your JLL broker')}</span>}
        <strong><bdi>{name}</bdi></strong>
        <span className="detail-broker-help">{t(broker
          ? 'Ask about availability, pricing or viewings.'
          : 'Speak to us about availability, pricing or booking a viewing.')}</span>
      </div>
    </div>
    {wechat ? <div className="detail-contact-actions">{whatsapp}<WeChatContact broker={broker} className="detail-wechat-action"/></div> : whatsapp}
    {closeButton}
  </div>;
}
