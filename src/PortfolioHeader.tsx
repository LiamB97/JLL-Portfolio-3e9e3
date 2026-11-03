import {useState} from 'react';
import {Columns2,Heart,LayoutGrid,Map as MapIcon,Menu,Settings,CircleHelp} from 'lucide-react';
import Modal from './Modal';
import Preferences from './Preferences';
import ShareWithFriend from './ShareWithFriend';
import {useLocale} from './i18n';
import WhatsAppIcon from './WhatsAppIcon';
import {buyerShareLink} from './sharing';
import type {BrokerCard,BuyerCollection} from './types';
export type PortfolioView='map'|'split'|'list';
const views=([{value:'map',label:'Map',Icon:MapIcon},{value:'split',label:'Split',Icon:Columns2},{value:'list',label:'List',Icon:LayoutGrid}] as const);
export default function PortfolioHeader({exploring,staff,view,setView,saved,openFavourites,onNavigate,broker=null,collection=null,onContact}:{exploring:boolean;staff:boolean;view:PortfolioView;setView:(view:PortfolioView)=>void;saved:number;openFavourites:()=>void;onNavigate:()=>void;broker?:BrokerCard|null;collection?:BuyerCollection|null;onContact?:()=>void}){
 const {t,dark}=useLocale(),[menu,setMenu]=useState(false);
 const homeHref=buyerShareLink(location.href);
 const contactHref=broker?'https://wa.me/'+broker.whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent(t("Hi, I'd like more information about your London developments.")+'\n'+buyerShareLink(location.href)):'';
 function navigate(){setMenu(false);onNavigate();}
 return <header className={'portfolio-header'+(exploring?' with-views':'')} dir="ltr">
  <a className="portfolio-header-brand" href={homeHref} aria-label={t('JLL Residential home')} onClick={onNavigate}><img src={dark?'/images/jll-residential-dark.svg?v=2026-01':'/images/jll-residential-light.svg?v=2026-01'} alt="JLL Residential"/></a>
  {exploring&&<h1 className="portfolio-header-title"><a href={homeHref} onClick={onNavigate}>London New Homes Portfolio</a></h1>}
  <div className="portfolio-header-buttons">{exploring&&broker&&<a className="portfolio-mobile-broker" href={contactHref} target="_blank" rel="noopener noreferrer" aria-label={t('WhatsApp {name}',{name:broker.name})} title={t('WhatsApp {name}',{name:broker.name})} onClick={onContact}>{broker.photo?<img src={broker.photo} alt=""/>:<WhatsAppIcon size={22}/>}</a>}{exploring&&<button className="portfolio-saved" aria-label={t('Favourites, {count} saved',{count:saved})} title={t('Favourites')} onClick={openFavourites}><Heart size={20}/>{saved>0&&<b>{saved}</b>}</button>}<button aria-label={t('Open menu')} aria-haspopup="dialog" aria-expanded={menu} onClick={()=>setMenu(true)}><Menu size={22}/></button></div>
  {exploring&&<div className="portfolio-views" role="group" aria-label={t('Portfolio view')}>{views.map(({value,label,Icon})=><button key={value} aria-label={t(label)} aria-pressed={view===value} onClick={()=>setView(value)}><Icon size={17}/><span>{t(label)}</span></button>)}</div>}
  {menu&&<Modal title={t('Portfolio menu')} close={()=>setMenu(false)} className="portfolio-menu">
   {exploring&&<section className="portfolio-menu-section portfolio-mobile-view-picker"><h3>{t('Portfolio view')}</h3><div className="portfolio-menu-view-options" role="group" aria-label={t('Portfolio view')}>{views.map(({value,label,Icon})=><button key={value} aria-pressed={view===value} onClick={()=>{setView(value);setMenu(false);}}><Icon size={18}/>{t(label)}</button>)}</div></section>}
   {exploring&&(broker||collection)&&<section className="portfolio-menu-section portfolio-mobile-context">{collection&&<><h3>{collection.title}</h3><p>{collection.developmentIds.length} {t('featured developments · Picked by')} {collection.brokerName}</p></>}{broker&&<><h3>{t('Your JLL broker')}</h3><a className="whatsapp-action" href={contactHref} target="_blank" rel="noopener noreferrer" onClick={onContact}><WhatsAppIcon size={18}/>{broker.name}</a></>}</section>}
   {!staff&&<section className="portfolio-menu-section"><h3>{t('Share with a friend')}</h3><ShareWithFriend inline/></section>}
   <section className="portfolio-menu-section"><h3>{t('Appearance and language')}</h3><Preferences onOpenAnalytics={()=>setMenu(false)}/></section>
   <nav className="portfolio-menu-links" aria-label={t('Portfolio navigation')}><a href="#" onClick={navigate}><MapIcon size={18}/>{t('Back to the map')}</a>{!staff&&<a href="#how-it-works" onClick={navigate}><CircleHelp size={18}/>{t('How it works')}</a>}<a href="#admin" onClick={navigate}><Settings size={18}/>{t('Broker workspace')}</a></nav>
  </Modal>}
 </header>;
}
