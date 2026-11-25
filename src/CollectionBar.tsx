import {ArrowRight,Ellipsis,Eye,EyeOff,List,LocateFixed,Map as MapIcon,Star,RotateCcw} from 'lucide-react';
import {useState} from 'react';
import Modal from './Modal';
import {PortfolioViewSwitcher,type PortfolioView} from './PortfolioHeader';
import WhatsAppIcon from './WhatsAppIcon';
import WeChatContact,{hasWeChat} from './WeChatContact';
import {buyerShareLink} from './sharing';
import {useLocale} from './i18n';
import type {BrokerCard,BuyerCollection} from './types';
interface CollectionBarProps {
 collection:BuyerCollection;broker:BrokerCard|null;active:boolean;dimOthers:boolean;onlyPicked:boolean;collectionOnly:boolean;
 onView:()=>void;onDim:()=>void;onOnly:()=>void;onRestore:()=>void;onContact:()=>void;
}

function collectionContact(broker:BrokerCard|null,message:string){
 return broker?'https://wa.me/'+broker.whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent(message+'\n'+buyerShareLink(location.href)):'';
}

export default function CollectionBar({collection,broker,active,dimOthers,onlyPicked,collectionOnly,onView,onDim,onOnly,onRestore,onContact}:CollectionBarProps){
 const {t}=useLocale(),contact=collectionContact(broker,t("Hi, I'd like more information about your London developments."));
 return <section className={'discovery-collection collection-strip'+(active?'':' collection-inactive')} aria-label={t('Your handpicked collection')}>
  <div className="collection-strip-summary"><Star size={22} aria-hidden="true"/><div>
   <strong title={collection.title}>{active?collection.title:t('All London homes')}</strong>
   <small>{active?t('{count} picked homes',{count:collection.developmentIds.length}):t('Collection highlights hidden')}</small>
  </div></div>
  <div className="collection-strip-actions">
   {active?<><button className="collection-view-button" onClick={onView} aria-label={t('View picked homes')}><LocateFixed size={17}/><span>{t('View picks')}</span></button>
    {!collectionOnly&&<>
     <button className="collection-opacity-button" aria-pressed={dimOthers} aria-label={t(dimOthers?'Show other homes normally':'Fade other homes')} title={t(dimOthers?'Show other homes normally':'Fade other homes')} onClick={onDim}>{dimOthers?<Eye size={18}/>:<EyeOff size={18}/>}<span>{t(dimOthers?'Show other homes normally':'Fade other homes')}</span></button>
     <button className="collection-only-button" aria-pressed={onlyPicked} onClick={onOnly}>{t(onlyPicked?'Show all homes':'Picked homes only')}</button>
    </>}
   </>:<button onClick={onRestore}><RotateCcw size={16}/><span>{t('Restore picked collection')}</span></button>}
   {broker&&(hasWeChat(broker)?<WeChatContact broker={broker} whatsappHref={contact} onWhatsApp={onContact} className="collection-broker-contact"/>
    :<a className="whatsapp-action collection-broker-contact" href={contact} target="_blank" rel="noopener noreferrer" aria-label={t('WhatsApp {name}',{name:broker.name})} onClick={onContact}><WhatsAppIcon size={18}/><span>{broker.name}</span></a>)}
  </div>
 </section>;
}

export function MobileCollectionBar({
 collection,broker,view,setView,active,dimOthers,onlyPicked,collectionOnly,onView,onDim,onOnly,onRestore,onContact,onBrowsePicks,
}:CollectionBarProps & {view:PortfolioView;setView:(view:PortfolioView)=>void;onBrowsePicks:()=>void}){
 const {t}=useLocale();
 const [options,setOptions]=useState(false);
 const contact=collectionContact(broker,t("Hi, I'd like more information about your London developments."));
 const showingMap=view==='map';
 return <section className="collection-dock" aria-label={t('Your handpicked collection')}>
  <div className="collection-dock-summary">
   <span className="collection-dock-mark"><Star size={18} fill="currentColor" aria-hidden="true"/></span>
   <div>
    <h2>{collection.title}</h2>
    <p>{t('{count} picked homes',{count:collection.developmentIds.length})}</p>
   </div>
   <button className="collection-dock-options" aria-label={t('Collection options')} aria-haspopup="dialog"
    aria-expanded={options} onClick={()=>setOptions(true)}><Ellipsis size={23}/></button>
  </div>
  <div className="collection-dock-actions">
   <button className="collection-dock-picks" onClick={showingMap?onBrowsePicks:onView}>
    {showingMap?<List size={19}/>:<MapIcon size={19}/>}<span>{t(showingMap?'View picks':'Back to the map')}</span><ArrowRight size={17} aria-hidden="true"/>
   </button>
   {broker&&(hasWeChat(broker)?<WeChatContact broker={broker} whatsappHref={contact} onWhatsApp={onContact} className="collection-dock-contact"/>
    :<a className="collection-dock-contact" href={contact} target="_blank" rel="noopener noreferrer"
     aria-label={t('WhatsApp {name}',{name:broker.name})} onClick={onContact}><WhatsAppIcon size={20}/><span>WhatsApp</span></a>)}
  </div>
  {options&&<Modal title={t('Collection options')} close={()=>setOptions(false)} className="collection-options-dialog">
   <PortfolioViewSwitcher className="collection-options-view" view={view} setView={next=>{setView(next);setOptions(false);}}/>
   <div className="collection-options-actions">
    <button onClick={()=>{onView();setOptions(false);}}><LocateFixed size={18}/>{t('Centre map on picks')}</button>
    {!collectionOnly&&<button aria-pressed={onlyPicked} onClick={onOnly}><Star size={18}/>{t('Picked homes only')}</button>}
    {!collectionOnly&&active&&<button aria-pressed={dimOthers} onClick={onDim}>
     <EyeOff size={18}/>{t('Fade other homes')}
    </button>}
    {!active&&<button onClick={()=>{onRestore();setOptions(false);}}><RotateCcw size={18}/>{t('Restore picked collection')}</button>}
   </div>
  </Modal>}
 </section>;
}
