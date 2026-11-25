import CollectionBar,{MobileCollectionBar} from './CollectionBar';
import {YourFirstHomeBar,YourFirstHomeInformation} from './YourFirstHome';
import {isYourFirstHomeSlug} from '../shared/your-first-home';
import {isYourFirstHomeEmbed,PortfolioEmbedToolbar,PortfolioEmbedNotice} from './PortfolioEmbed';
import BuyerPasswordGate from './BuyerPasswordGate';
import {buyerApiPath,type BuyerLock,type BuyerPortfolio} from './buyer-access';
import {startingPrice} from '../shared/pricing';
import {staffLocation} from '../shared/analytics-events';
import Modal from './Modal';
import PortfolioHeader,{type PortfolioView as View} from './PortfolioHeader';
import {searchDevelopments} from './portfolio-search';
import CommuteSearch from './CommuteSearch';
import {commuteMatches,type CommuteReport} from './commute';
import WhatsAppIcon from './WhatsAppIcon';
import WeChatContact,{hasWeChat,WeChatDialog} from './WeChatContact';
import React, {useCallback, useEffect, useState, useRef, useMemo, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight,ArrowRight,BedDouble,MapPin,Search,SlidersHorizontal,X,TrainFront,Building2,Heart,Star,ChevronDown} from 'lucide-react';
const PortfolioMap=lazy(()=>import('./Map'));
const BuyerGuide=lazy(()=>import('./BuyerGuide'));
const StaffPortal=lazy(()=>import('./StaffPortal'));
import {areas,regions} from './explore';
import Favourites from './Favourites';
import {useFavourites} from './shortlist';
import {type Development,type TransportNetwork, type BuyerCollection,type BrokerCard, money, bedroomLabel,specificPropertyTypes} from './types';
import './style.css';
import './brand.css';
import './workspace.css';
import './portfolio-ui.css';
import './discovery.css';
import './readability.css';
import './review-updates.css';
import './collection-updates.css';
import './buyer-access.css';
import './your-first-home.css';
import './portfolio-embed.css';
import './buyer-contact.css';
import {PreferencesProvider,useLocale} from './i18n';
import Detail from './Detail';
import DevelopmentPhoto from './DevelopmentPhoto';
import AnalyticsConsent from './AnalyticsConsent';
import {track,setAnalyticsContext,setCurrentDevelopment} from './analytics';

const narrowViewport = '(max-width: 760px)';
const embedRequested=isYourFirstHomeEmbed();

function App() {
  const {t,language,setCollectionLanguage}=useLocale();
  const [wechatFromLink,setWechatFromLink]=useState(()=>new URLSearchParams(location.search).get('contact')==='wechat');
  const [items, setItems] = useState<Development[]>([]);
  const [network, setNetwork] = useState<TransportNetwork|null>(null);
  const [transportError,setTransportError]=useState('');
  const stations=network?.stations||[];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commute,setCommute]=useState<CommuteReport|null>(null),[commuteResetKey,setCommuteResetKey]=useState(0);
  const commuteTimes=useMemo(()=>Object.fromEntries((commute?.results||[]).filter(r=>commuteMatches(r,commute!.maxMinutes)).map(r=>[r.id,r.durationMinutes!])),[commute]);
  const [query, setQuery] = useState('');
  const [region,setRegion]=useState(''),[area,setArea]=useState('');
  const [beds, setBeds] = useState(''),[budget,setBudget]=useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [chosenView, setView] = useState<View | null>(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia(narrowViewport).matches);
  const view = chosenView ?? (embedRequested||narrow ? 'map' : 'split');
  useEffect(() => {
    const viewport = window.matchMedia(narrowViewport);
    const update = () => setNarrow(viewport.matches);
    update();
    viewport.addEventListener('change', update);
    return () => viewport.removeEventListener('change', update);
  }, []);
  const [sort, setSort] = useState(()=>isYourFirstHomeSlug(new URLSearchParams(location.search).get('collection'))?'price':'price-desc');
  const [commuteSort, setCommuteSort] = useState('commute');
  const listingSort = commute ? commuteSort : sort;
  const changeCommute = (report: CommuteReport | null) => {
    setCommute(report);
    if (!report) setCommuteSort('commute');
  };
  const isStaff=()=>staffLocation(location.hash);
  const [admin, setAdmin] = useState(isStaff);
  const [howItWorks,setHowItWorks]=useState(()=>location.hash==='#how-it-works');
  const embedded=embedRequested&&!admin&&!howItWorks;
  const favourites=useFavourites();
  const [showFavourites,setShowFavourites]=useState(false),[favouritesOnly,setFavouritesOnly]=useState(false);
  const [buyerLock,setBuyerLock]=useState<BuyerLock|null>(null);
  const [collectionOnly,setCollectionOnly]=useState(false);
  const [broker,setBroker]=useState<BrokerCard|null>(null);
  const [collection,setCollection]=useState<BuyerCollection|null>(null),[collectionError,setCollectionError]=useState(''),[featuredOnly,setFeaturedOnly]=useState(false);
  const yourFirstHome=collection?.campaign==='your-first-home';
  useEffect(()=>{document.title=yourFirstHome&&!admin?'Your First Home | JLL Residential':'London New Homes Portfolio | JLL Residential';},[yourFirstHome,admin]);
  const [showFirstHomeInformation,setShowFirstHomeInformation]=useState(false);
  const [showFavouriteHighlights,setShowFavouriteHighlights]=useState(true);
  const [highlightsEnabled,setHighlightsEnabled]=useState(true),[dimOthers,setDimOthers]=useState(true),[mapResetKey,setMapResetKey]=useState(0),[collectionFrameKey,setCollectionFrameKey]=useState(0);
  const showHighlights=collectionOnly||highlightsEnabled;
  const featuredIds=useMemo(()=>showHighlights?collection?.developmentIds||[]:[],[collection,showHighlights]);
  const initialLink=useRef(false);
  useEffect(()=>{if(loading||initialLink.current||!items.length)return;initialLink.current=true;const id=new URLSearchParams(location.search).get('development');if(id&&items.some(d=>d.id===id))setSelected(id);},[items,loading]);
  const [filters, setFilters] = useState(false);
  const loadVersion=useRef(0);
  const refresh = useCallback(async () => {
    const version=++loadVersion.current;
    const response=await fetch(buyerApiPath('/api/buyer/portfolio'),{cache:'no-store'});
    if(version!==loadVersion.current)return false;
    if(response.status===423){
      const {passwordRequired}=await response.json();
      if(version!==loadVersion.current)return false;
      setBuyerLock(passwordRequired==='collection'?'collection':'portfolio');
      setCollectionLanguage(undefined);
      setCollection(null);setBroker(null);setCollectionOnly(false);setItems([]);setSelected(null);setShowFavourites(false);setCommute(null);
      initialLink.current=false;
      return false;
    }
    if (!response.ok) throw Error('Unable to load the portfolio. Please try again.');
    const data:BuyerPortfolio=await response.json();
    if(version!==loadVersion.current)return false;
    setBuyerLock(null);setItems(data.developments);setCollection(data.collection);
    setCollectionLanguage(data.collection?.language);
    setBroker(data.broker);setCollectionOnly(data.collectionOnly);setCollectionError(data.linkError);setError('');
    return true;
  }, [setCollectionLanguage]);
  const load=useCallback(()=>void refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false)),[refresh]);
  async function unlock(password:string){
    const response=await fetch(buyerApiPath('/api/buyer/unlock'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    if(!response.ok){const data=await response.json().catch(()=>null);throw Error(data?.error||'Unable to open this link. Please try again.');}
    if(!await refresh())throw Error('Unable to open this link. Please try again.');
  }
  useEffect(()=>{
    if(admin)return;
    load();
    const recheck=()=>{if(document.visibilityState==='visible')load();};
    const restore=(event:PageTransitionEvent)=>{if(event.persisted)recheck();};
    document.addEventListener('visibilitychange',recheck);
    window.addEventListener('pageshow',restore);
    return ()=>{document.removeEventListener('visibilitychange',recheck);window.removeEventListener('pageshow',restore);};
  },[admin,load]);
  useEffect(() => {
    void fetch('/api/transport').then(response => {
        if (!response.ok) throw Error('The TfL network is temporarily unavailable.');
        return response.json();
      }).then(setNetwork).catch(e=>setTransportError(e.message));
    let wasStaff=isStaff();
    const change = () => {
      const staff=isStaff();
      if(wasStaff&&!staff)setLoading(true);
      wasStaff=staff;
      setAdmin(staff);setHowItWorks(location.hash==='#how-it-works');
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const select = useCallback((id: string) => setSelected(id), []);
  const visibleFavourites = collectionOnly ? favourites.ids.filter(id => items.some(item => item.id === id)) : favourites.ids;
  const filtered = searchDevelopments(items,{query,region,area,beds,budget,featuredOnly:featuredOnly&&!collectionOnly,featuredIds,favouritesOnly,favouriteIds:favourites.ids,commute,sort:listingSort});
  const active = items.find(d => d.id === selected);
  useEffect(()=>{setAnalyticsContext({language,link_kind:collection?'collection':broker?'broker':'general',...(broker?{broker_link_id:broker.slug}:{}),...(collection?{collection_id:collection.slug}:{})},!loading&&!buyerLock&&!admin&&!embedded);},[language,broker,collection,loading,buyerLock,admin,embedded]);
  useEffect(()=>{setCurrentDevelopment(!admin&&!howItWorks&&active?active.id:null);},[selected,active?.id,admin,howItWorks]);
  useEffect(()=>{if(!query.trim()||admin)return;const timer=setTimeout(()=>track('search_used',{result_count:filtered.length}),700);return()=>clearTimeout(timer);},[query,admin]);
  const activeFilters = [
    {id:'region', label:region && t(region), clear:()=>setRegion('')},
    {id:'area', label:area, clear:()=>setArea('')},
    {id:'beds', label:beds && (beds==='0'?t('Studio'):t('{count} bedrooms',{count:Number(beds)})), clear:()=>setBeds('')},
    {id:'budget', label:budget && t('Up to {price}',{price:money(Number(budget))}), clear:()=>setBudget('')},
    {id:'favourites', label:favouritesOnly && t('Show favourites only'), clear:()=>setFavouritesOnly(false)},
    {id:'featured', label:featuredOnly&&!collectionOnly && t('Show featured only'), clear:()=>setFeaturedOnly(false)},
  ].filter(filter=>filter.label);
  const filterCount = activeFilters.length;
  const resultCount = filtered.length===1 ? t('1 development') : t('{count} developments',{count:filtered.length});
  const reset = () => {changeCommute(null);setCommuteResetKey(n=>n+1); setQuery(''); setBeds('');setBudget(''); setFeaturedOnly(false);setFavouritesOnly(false);setRegion('');setArea(''); };

  const toggleFavourite=(id:string)=>{setShowFavouriteHighlights(true);favourites.toggle(id);};
  const resetMap=()=>{reset();setHighlightsEnabled(false);setShowFavouriteHighlights(false);setDimOthers(false);setCollectionFrameKey(0);setSelected(null);setShowFavourites(false);setFilters(false);setView('map');setSort(yourFirstHome?'price':'price-desc');setMapResetKey(n=>n+1);};
  const changeView=(next:View)=>{setView(next);track('view_change',{view_mode:next});};
  const mobileCollection=!admin&&!howItWorks&&!embedded&&!yourFirstHome&&narrow?collection:null;
  const collectionActions={
    broker,active:showHighlights,dimOthers,onlyPicked:featuredOnly,collectionOnly,
    onView:()=>{setHighlightsEnabled(true);changeView('map');setCollectionFrameKey(n=>n+1);},
    onDim:()=>setDimOthers(value=>!value),
    onOnly:()=>{if(!featuredOnly)setHighlightsEnabled(true);setFeaturedOnly(!featuredOnly);},
    onRestore:()=>{setHighlightsEnabled(true);setDimOthers(true);changeView('map');setCollectionFrameKey(n=>n+1);},
    onContact:()=>track('whatsapp_click',{surface:'broker_banner'}),
  };
  return <div className={`portfolio-app ${admin ? 'admin-active' : 'explorer-active'}${yourFirstHome&&!admin?' your-first-home':''}${embedded?' portfolio-embed':''}${mobileCollection?' mobile-collection':''}`}>
    {!embedded&&<PortfolioHeader onResetMap={resetMap} broker={broker} collection={collection} onContact={collectionActions.onContact} exploring={!admin&&!howItWorks&&!buyerLock&&!loading} staff={admin} view={view} setView={changeView} saved={visibleFavourites.length} openFavourites={()=>{setSelected(null);setShowFavourites(true);track('shortlist_open',{saved_count:visibleFavourites.length});}} onNavigate={()=>{setSelected(null);setShowFavourites(false);setFilters(false);}}/>}
    {admin ? <Suspense fallback={<p className="staff-portal">{t("Loading staff workspace…")}</p>}><div dir="ltr" lang="en"><StaffPortal/></div></Suspense> : loading?<main className="buyer-loading" role="status">{t('Loading London homes…')}</main> : buyerLock?<BuyerPasswordGate key={buyerLock} scope={buyerLock} unlock={unlock}/> : howItWorks?<Suspense fallback={<p className="staff-portal">{t('Loading guide…')}</p>}><BuyerGuide/></Suspense> : <main className={`discovery-page view-${view}`} aria-label={t("London development explorer")}>
      {mobileCollection&&<MobileCollectionBar collection={mobileCollection} view={view} setView={changeView}
        onBrowsePicks={()=>{reset();setSelected(null);setHighlightsEnabled(true);setFeaturedOnly(!collectionOnly);changeView('list');}} {...collectionActions}/>}
      <div className="discovery-toolbar">
        {embedded?<PortfolioEmbedToolbar query={query} setQuery={setQuery} count={filtered.length} view={view} setView={setView}/>:<>
        <form className="discovery-search" role="search" onSubmit={e=>e.preventDefault()}>
          <Search size={19} aria-hidden="true"/>
          <input autoComplete="off" aria-label={t("Search by area, development or postcode")} placeholder={t(narrow?"Area, name or postcode":"Search an area, development or postcode")} value={query} onChange={e => setQuery(e.target.value)}/>
          {query && <button type="button" className="clear-search" aria-label={t("Clear search")} onClick={() => setQuery('')}><X size={15}/></button>}
        </form>
        <button type="button" className={`discovery-filter-trigger ${filterCount ? 'filtered' : ''}`} aria-label={t('Filters')} aria-expanded={filters} aria-haspopup="dialog" onClick={() => setFilters(true)}>
          <SlidersHorizontal size={17}/><span>{t("Filters")}</span>{filterCount > 0 && <b aria-hidden="true">{filterCount}</b>}
        </button>
        {filters && <Modal title={t("Find your London home")} close={()=>setFilters(false)} className="buyer-filter-dialog" doneLabel={t('Show {count} developments',{count:filtered.length})} footer={<button onClick={reset}>{t("Reset filters")}</button>}>

          {collection&&<section className="filter-collection-context"><strong><Star size={16}/>{collection.title}</strong><p>{featuredIds.length} {t('featured developments · Picked by')} {collection.brokerName}</p></section>}<div className="explorer-filter-fields"><label>{t("London region")}<select aria-label={t("London region")} value={region} onChange={e=>{setRegion(e.target.value);track('filter_apply',{filter_kind:'region'});}}><option value="">{t("All London")}</option>{['Prime central',...regions].map(r=><option key={r} value={r}>{t(r)}</option>)}</select></label><label>{t("Near an area")}<select aria-label={t("Near an area")} value={area} onChange={e=>{setArea(e.target.value);track('filter_apply',{filter_kind:'area'});}}><option value="">{t("All areas")}</option>{areas.map(a=><option key={a.name}>{a.name}</option>)}</select></label>
            <label>{t("Bedrooms")}<select aria-label={t("Bedrooms")} value={beds} onChange={e => {setBeds(e.target.value);track('filter_apply',{filter_kind:'bedrooms'});}}><option value="">{t("Any bedrooms")}</option><option value="0">{t("Studio")}</option>{[1,2,3,4].map(n => <option key={n} value={n}>{t('{count} bedrooms',{count:n})}</option>)}</select></label>
            <label>{t('Budget (starting price)')}<select aria-label={t('Budget (starting price)')} value={budget} onChange={e=>{setBudget(e.target.value);track('filter_apply',{filter_kind:'budget'});}}><option value="">{t('Any price')}</option>{[500000,750000,1000000,1500000,2000000,3000000,5000000].map(n=><option key={n} value={n}>{t('Up to {price}',{price:money(n)})}</option>)}</select></label>
          </div><div className="discovery-filter-checks"><label><input type="checkbox" checked={favouritesOnly} onChange={e=>{setFavouritesOnly(e.target.checked);if(e.target.checked)setShowFavouriteHighlights(true);setSelected(null);}}/><span>{t('Show favourites only')} ({visibleFavourites.length})</span></label>{collection&&!collectionOnly&&<label><input type="checkbox" checked={featuredOnly} onChange={e=>{setFeaturedOnly(e.target.checked);if(e.target.checked)setHighlightsEnabled(true);}}/><span>{t('Show featured only')}</span></label>}</div>
          <p className="area-filter-note">{t("Areas show developments within 2 km of the named centre. Regions are approximate geographic sectors.")}</p>
        </Modal>}
        <CommuteSearch items={items} onChange={changeCommute} resetKey={commuteResetKey}/>
        {view==='map'&&(!mobileCollection||Boolean(query.trim())||filterCount>0||commute)&&<div className="discovery-count" role="status">{resultCount}</div>}
        {(filterCount>0||commute)&&<div className="discovery-active-filters">
          {activeFilters.map(({id,label,clear})=><button key={id} onClick={clear} aria-label={t('Remove filter {filter}',{filter:label||''})}>
            <span>{label}</span><X size={14} aria-hidden="true"/>
          </button>)}
          <button className="clear-filters" onClick={reset}>{t('Clear all')}</button>
        </div>}
        {yourFirstHome?<YourFirstHomeBar broker={broker} count={items.length} onExplore={()=>{setView('map');setCollectionFrameKey(n=>n+1);}} onInformation={()=>setShowFirstHomeInformation(true)} onContact={collectionActions.onContact}/>:collection&&!mobileCollection&&<CollectionBar collection={collection} {...collectionActions}/>}

        {broker&&!collection&&<section className="discovery-broker"><span className="broker-label">{t('Your JLL broker')}</span><a aria-label={t('WhatsApp {name}',{name:broker.name})} title={t('WhatsApp {name}',{name:broker.name})} onClick={()=>track('whatsapp_click',{surface:'broker_banner'})} href={'https://wa.me/'+broker.whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent(t("Hi, I'd like more information about your London developments."))} target="_blank" rel="noopener noreferrer">{broker.photo?<img className="broker-avatar" src={broker.photo} alt=""/>:<WhatsAppIcon size={18}/>}<strong>{broker.name}</strong></a><WeChatContact broker={broker}/></section>}
        {collectionError&&<div className="explorer-message" role="status">{collectionError} {t("You can still explore the full portfolio.")}</div>}
        </>}
        {error && <div className="explorer-message" role="alert">{error}<button onClick={() => { setError(''); void refresh().catch(e => setError(e.message)); }}>{t("Retry")}</button></div>}
        {!loading && !filtered.length && !error && view === 'map' && <div className="explorer-message"><Building2 size={20}/><div><strong>{t(favouritesOnly?"No favourites match this view":"No homes found")}</strong><p>{t(favouritesOnly?"Save developments with the heart button, or clear your filters to see more favourites.":"Try a different area or broaden your filters.")}</p></div><button onClick={reset}>{t("Reset")}</button></div>}
      </div>
      <div className="discovery-workspace">
        {view !== 'list' && <Suspense fallback={<div className="map-shell map-loading" role="status">{t("Loading your London map…")}</div>}><PortfolioMap embedded={embedded} clusterFeatured={yourFirstHome} clusterCollection={Boolean(mobileCollection)} resetKey={mapResetKey} collectionFrameKey={collectionFrameKey} dimOthers={dimOthers&&!collectionOnly} onDimOthers={collectionOnly?undefined:()=>setDimOthers(v=>!v)} onReset={resetMap} commuteDestination={commute?.destination} commuteTimes={commuteTimes} transportDefaults={showHighlights?collection?.transportDefaults:undefined} items={filtered} selected={selected} onSelect={select} network={network} transportError={transportError} featuredIds={featuredIds} favouriteIds={showFavouriteHighlights?favourites.ids:[]} favouritesOnly={favouritesOnly}/></Suspense>}
        {view !== 'map' && <section className="explorer-list" aria-label={t("Development listings")}>
          {!embedded&&<div className="listing-heading">
            <h2><span role="status">{resultCount}</span>{narrow&&view==='split'&&<ChevronDown size={17} aria-hidden="true"/>}</h2>
            <label className="listing-sort">
              <span className="listing-sort-caption">{t('Sort by')}</span>
              <select value={listingSort} onChange={e => (commute ? setCommuteSort : setSort)(e.target.value)}>
                {commute && <option value="commute">{t('Shortest journey')}</option>}
                <option value="curated">{t('Our collection')}</option>
                <option value="price-desc">{t('Starting price: high to low')}</option>
                <option value="price">{t('Starting price: low to high')}</option>
                <option value="name">{t('Name: A–Z')}</option>
                <option value="area">{t('Area: A–Z')}</option>
              </select>
            </label>
          </div>}
          {loading ? <p className="empty-state">{t("Loading London New Homes…")}</p> : !filtered.length ? <div className="empty-state"><Building2 size={30}/><h2>{t(favouritesOnly?"No favourites match this view":"No homes found")}</h2><p>{t(favouritesOnly?"Save developments with the heart button, or clear your filters to see more favourites.":"Try a different area or broaden your filters.")}</p><button onClick={reset}>{t("Reset filters")}</button></div> : <div className="cards">
            {filtered.map(d => {
              const featured = featuredIds.includes(d.id);
              const price = startingPrice(d,beds);
              const propertyTypes = specificPropertyTypes(d.propertyTypes);
              const bedroomText = d.bedrooms.length===1&&d.bedrooms[0]===0
                ? t('Studio')
                : d.bedrooms.length ? `${bedroomLabel(d.bedrooms).replace('Studio',t('Studio'))} ${t("bedrooms")}` : t('To be confirmed');
              return <article className={`property-card-wrap${featured ? ' featured-card' : ''}`} key={d.id}><button className={`property-card ${selected === d.id ? 'selected' : ''}`} onClick={() => setSelected(d.id)}>
                <div className="card-image"><DevelopmentPhoto development={d} loading="lazy"/>
                  <span className={featured?"card-tag featured-tag":"card-tag"}>{yourFirstHome?'Potential scheme home':featured?<><Star size={14} fill="currentColor" aria-hidden="true"/>{t('Featured')}</>:d.sample ? t('Sample collection') : t(d.status)}</span>
                  {embedded&&<span className="card-arrow"><ArrowUpRight size={18}/></span>}
                </div>
                <div className="card-body">
                  <p className="card-area"><MapPin size={13} aria-hidden="true"/>{d.area}<span>· {d.postcode}</span></p>
                  <h2>{d.name}</h2>
                  {commute&&commuteTimes[d.id]!==undefined&&<span className="commute-duration"><TrainFront size={13}/>{commuteTimes[d.id]} min commute</span>}
                  <p className="card-beds">{!embedded&&<BedDouble size={15} aria-hidden="true"/>}{bedroomText}{propertyTypes.length>0&&<><span>·</span>{propertyTypes.map(ptype=>t(ptype)).join(' & ')}</>}</p>
                  <div className="card-bottom"><span>{beds?(beds==='0'?t('Studio'):t('{count} bedrooms',{count:Number(beds)}))+' '+t('Prices from'):t('Prices from')}
                    <strong>{price!==null?money(price):t('To be confirmed')}</strong>
                  </span><span className="explore">{t("View development")} <ArrowRight size={14}/></span></div>
                </div>
              </button><button className={favourites.ids.includes(d.id)?"save-card saved":"save-card"} aria-pressed={favourites.ids.includes(d.id)} aria-label={favourites.ids.includes(d.id)?`Remove ${d.name} from favourites`:`Save ${d.name} to favourites`} onClick={()=>toggleFavourite(d.id)}><Heart size={17} fill={favourites.ids.includes(d.id)?"currentColor":"none"}/></button></article>;
            })}
          </div>}
        </section>}
      </div>
      <div className="discovery-disclaimer">{embedded?<PortfolioEmbedNotice/>:<>{beds&&budget?'Only homes with a confirmed starting price for the selected bedroom count are shown. ':''}{items.some(d => d.sample) ? 'Preview collection · Illustrative stock and prices' : 'Prices & availability subject to broker confirmation'}</>}</div>
    </main>}
    {/* The lean embed has no analytics collection or second consent prompt. */}
    {!embedded&&<AnalyticsConsent/>}
    {showFirstHomeInformation&&yourFirstHome&&!admin&&!buyerLock&&<YourFirstHomeInformation items={items} broker={broker} close={()=>setShowFirstHomeInformation(false)}/>}
    {showFavourites&&!admin&&!howItWorks&&!buyerLock&&<Favourites items={items} ids={visibleFavourites} toggle={toggleFavourite} persistent={favourites.persistent} broker={broker} collection={collection?.slug} close={()=>setShowFavourites(false)} open={id=>{setShowFavourites(false);setSelected(id);}}/>}
    {active && !admin && !howItWorks && !buyerLock && <Detail selectedBedrooms={beds} key={active.id} broker={broker} collection={collection?.slug} d={active} stations={stations} network={network} saved={favourites.ids.includes(active.id)} toggleFavourite={()=>toggleFavourite(active.id)} close={() => setSelected(null)}/>}
    {wechatFromLink && !admin && !howItWorks && !loading && !buyerLock && hasWeChat(broker) &&
      <WeChatDialog broker={broker} close={()=>setWechatFromLink(false)}/>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><PreferencesProvider themeOverride={embedRequested?'light':undefined}><App/></PreferencesProvider></React.StrictMode>);
