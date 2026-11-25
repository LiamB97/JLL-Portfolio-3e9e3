import {useState} from 'react';
import {Copy, Download, MessagesSquare} from 'lucide-react';
import Modal from './Modal';
import WhatsAppIcon from './WhatsAppIcon';
import {useLocale} from './i18n';
import type {BrokerCard} from './types';

export function hasWeChat(broker: BrokerCard | null | undefined): broker is BrokerCard & ({wechatId: string} | {wechatQr: string}) {
  return Boolean(broker?.wechatId || broker?.wechatQr);
}

export default function WeChatContact({broker, whatsappHref, onWhatsApp, className = '', compact = false}: {
  broker: BrokerCard; whatsappHref?: string; onWhatsApp?: () => void; className?: string; compact?: boolean;
}) {
  const {t} = useLocale();
  const [open, setOpen] = useState(false);
  if (!hasWeChat(broker)) return null;
  const action = whatsappHref ? t('Contact broker') : 'WeChat';
  const name = t('Contact {name}', {name: broker.name});
  return <>
    <button type="button" className={'wechat-contact-action ' + className}
      aria-label={whatsappHref ? name : t('WeChat {name}', {name: broker.name})} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}>
      <MessagesSquare size={18} aria-hidden="true"/>{!compact && <span>{action}</span>}
    </button>
    {open && <WeChatDialog broker={broker} whatsappHref={whatsappHref} onWhatsApp={onWhatsApp} close={() => setOpen(false)}/>}
  </>;
}

export function WeChatDialog({broker, whatsappHref, onWhatsApp, close}: {
  broker: BrokerCard; whatsappHref?: string; onWhatsApp?: () => void; close: () => void;
}) {
  const {t} = useLocale();
  const [notice, setNotice] = useState('');
  const id = broker.wechatId;
  const title = t(whatsappHref ? 'Contact {name}' : 'WeChat {name}', {name: broker.name});
  return <Modal title={title} className="wechat-contact-dialog" close={close}>
      {whatsappHref && <div className="wechat-whatsapp action-row">
        <a href={whatsappHref} className="whatsapp-action" target="_blank" rel="noopener noreferrer" onClick={onWhatsApp}>
          <WhatsAppIcon size={17}/> WhatsApp
        </a>
      </div>}
      <section className="wechat-details" aria-label="WeChat">
        {whatsappHref && <h3>WeChat</h3>}
        <p>{t(broker.wechatQr && broker.wechatId
          ? 'Scan the QR code in WeChat or search for the WeChat ID.'
          : broker.wechatQr ? 'Scan the QR code in WeChat. On this phone, save the image and open it from WeChat.'
            : 'Copy the WeChat ID and search for it in WeChat.')}</p>
        {broker.wechatQr && <div className="wechat-qr">
          <img src={broker.wechatQr} alt={t('WeChat QR code for {name}', {name: broker.name})}/>
          <a href={broker.wechatQr} download="jll-broker-wechat.jpg"><Download size={16}/>{t('Save QR image')}</a>
        </div>}
        {id && <div className="wechat-id">
          <label>{t('WeChat ID')}<input readOnly dir="ltr" value={id} onFocus={event => event.currentTarget.select()}/></label>
          <button type="button" onClick={async () => {
            try {await navigator.clipboard.writeText(id); setNotice(t('WeChat ID copied.'));}
            catch {setNotice(t('Select and copy the WeChat ID above.'));}
          }}><Copy size={16}/>{t('Copy ID')}</button>
        </div>}
        {notice && <p role="status">{notice}</p>}
      </section>
    </Modal>;
}
