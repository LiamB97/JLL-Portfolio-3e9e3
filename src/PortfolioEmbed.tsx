import {LayoutList,Map,Search,X,Info} from 'lucide-react';
import {YOUR_FIRST_HOME_SLUG,isYourFirstHomeSlug} from '../shared/your-first-home';
import {useLocale} from './i18n';

// Existing landing-page iframes pick up the compact view without an Eloqua edit.
// Direct collection links keep the complete portfolio; embed=1 is a preview URL.
export function isYourFirstHomeEmbed(){
 const params=new URLSearchParams(location.search);
 return isYourFirstHomeSlug(params.get('collection'))&&(params.get('embed')==='1'||window.self!==window.top);
}

export const yourFirstHomeEmbedLink=()=>location.origin+'/?collection='+YOUR_FIRST_HOME_SLUG+'&embed=1';
export const yourFirstHomeEmbedCode=()=>`<iframe src="${yourFirstHomeEmbedLink().replace(/&/g,'&amp;')}" title="Map of JLL Residential homes for first-time buyers" width="100%" height="680" style="display:block;border:0" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

export function PortfolioEmbedToolbar({query,setQuery,count,view,setView}:{query:string;setQuery:(value:string)=>void;count:number;view:'map'|'split'|'list';setView:(value:'map'|'list')=>void}){
 const {t}=useLocale();
 return <div className="embed-toolbar">
  <form className="embed-search" role="search" onSubmit={e=>e.preventDefault()}><Search size={18} aria-hidden="true"/><input type="search" aria-label={t('Search by area, development or postcode')} placeholder="Search homes or areas" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label={t('Clear search')} onClick={()=>setQuery('')}><X size={18}/></button>}</form>
  <span className="embed-count" role="status" aria-live="polite">{count} {count===1?'home':'homes'}</span>
  <div className="embed-views" role="group" aria-label="Choose map or homes"><button aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={17} aria-hidden="true"/>Map</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><LayoutList size={17} aria-hidden="true"/>Homes</button></div>
 </div>;
}

export function PortfolioEmbedNotice(){
 return <><Info size={15} aria-hidden="true"/><span>Scheme participation is unconfirmed. Check individual homes with our team.</span></>;
}
