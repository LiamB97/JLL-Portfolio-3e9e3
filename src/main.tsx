import CollectionBar from './CollectionBar';
import {startingPrice} from '../shared/pricing';
import Modal from './Modal';
import PortfolioHeader,{type PortfolioView as View} from './PortfolioHeader';
import {searchDevelopments} from './portfolio-search';
import CommuteSearch from './CommuteSearch';
import {commuteMatches,type CommuteReport} from './commute';
import WhatsAppIcon from './WhatsAppIcon';
import React, {useCallback, useEffect, useState, useRef, useMemo, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight,ArrowRight,MapPin,Search,SlidersHorizontal,X,TrainFront,Building2,Heart,Star,ChevronDown} from 'lucide-react';
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
import {PreferencesProvider,useLocale} from './i18n';
import Detail from './Detail';
import AnalyticsConsent from './AnalyticsConsent';
import {track,setAnalyticsContext,setCurrentDevelopment} from './analytics';

function App() {
  const {t,language}=useLocale();
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
  const [view, setView] = useState<View>('map');
  const [sort, setSort] = useState('price-desc');
  const isStaff=()=>location.hash==='#admin'||location.hash.startsWith('#invite=');
  const [admin, setAdmin] = useState(isStaff);
  const [howItWorks,setHowItWorks]=useState(()=>location.hash==='#how-it-works');
  const favourites=useFavourites();
  const [showFavourites,setShowFavourites]=useState(false),[favouritesOnly,setFavouritesOnly]=useState(false);
  const [linkLoading,setLinkLoading]=useState(()=>{const q=new URLSearchParams(location.search);return Boolean(q.get('broker')||q.get('collection'));});
  const [broker,setBroker]=useState<BrokerCard|null>(null);
  const [collection,setCollection]=useState<BuyerCollection|null>(null),[collectionError,setCollectionError]=useState(''),[featuredOnly,setFeaturedOnly]=useState(false);
  const [showFavouriteHighlights,setShowFavouriteHighlights]=useState(true);
  const [highlightsEnabled,setHighlightsEnabled]=useState(true),[dimOthers,setDimOthers]=useState(true),[mapResetKey,setMapResetKey]=useState(0),[collectionFrameKey,setCollectionFrameKey]=useState(0);
  const featuredIds=useMemo(()=>highlightsEnabled?collection?.developmentIds||[]:[],[collection,highlightsEnabled]);
  const initialLink=useRef(false);
  useEffect(()=>{const slug=new URLSearchParams(location.search).get('collection');if(!slug)return;fetch('/api/collections/'+encodeURIComponent(slug)).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'This collection is unavailable.');setCollection(d);setBroker(d.broker||null);}).catch(e=>setCollectionError(e.message)).finally(()=>setLinkLoading(false));},[]);
  useEffect(()=>{const params=new URLSearchParams(location.search);if(params.has('collection'))return;const slug=params.get('broker');if(!slug)return;fetch('/api/brokers/'+encodeURIComponent(slug)).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'This broker link is unavailable.');setBroker(d);}).catch(e=>setCollectionError(e.message)).finally(()=>setLinkLoading(false));},[]);
  useEffect(()=>{if(loading||initialLink.current||!items.length)return;initialLink.current=true;const id=new URLSearchParams(location.search).get('development');if(id&&items.some(d=>d.id===id))setSelected(id);},[items,loading]);
  const [filters, setFilters] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/developments');
    if (!response.ok) throw Error('Unable to load the portfolio. Please try again.');
    setItems(await response.json());
  }, []);
  useEffect(() => {
    void refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));
    void fetch('/api/transport').then(response => {
        if (!response.ok) throw Error('The TfL network is temporarily unavailable.');
        return response.json();
      }).then(setNetwork).catch(e=>setTransportError(e.message));
    const change = () => {setAdmin(isStaff());setHowItWorks(location.hash==='#how-it-works');};
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [refresh]);
  const select = useCallback((id: string) => setSelected(id), []);
  const filtered = searchDevelopments(items,{query,region,area,beds,budget,featuredOnly,featuredIds,favouritesOnly,favouriteIds:favourites.ids,commute,sort});
  const active = items.find(d => d.id === selected);
  useEffect(()=>{setAnalyticsContext({language,link_kind:collection?'collection':broker?'broker':'general',...(broker?{broker_link_id:broker.slug}:{}),...(collection?{collection_id:collection.slug}:{})},!loading&&!linkLoading);},[language,broker,collection,loading,linkLoading]);
  useEffect(()=>{setCurrentDevelopment(!admin&&!howItWorks&&active?active.id:null);},[selected,active?.id,admin,howItWorks]);
  useEffect(()=>{if(!query.trim()||admin)return;const timer=setTimeout(()=>track('search_used',{result_count:filtered.length}),700);return()=>clearTimeout(timer);},[query,admin]);
  const filterCount = [beds,budget,region,area,favouritesOnly,featuredOnly].filter(Boolean).length;
  const reset = () => {setCommute(null);setCommuteResetKey(n=>n+1); setQuery(''); setBeds('');setBudget(''); setFeaturedOnly(false);setFavouritesOnly(false);setRegion('');setArea(''); };

  const toggleFavourite=(id:string)=>{setShowFavouriteHighlights(true);favourites.toggle(id);};
  const resetMap=()=>{reset();setHighlightsEnabled(false);setShowFavouriteHighlights(false);setDimOthers(false);setCollectionFrameKey(0);setSelected(null);setShowFavourites(false);setFilters(false);setView('map');setSort('price-desc');setMapResetKey(n=>n+1);};
  return <div className={`portfolio-app ${admin ? 'admin-active' : 'explorer-active'}`}>
    <PortfolioHeader onResetMap={resetMap} broker={broker} collection={collection} onContact={()=>track('whatsapp_click',{surface:'broker_banner'})} exploring={!admin&&!howItWorks} staff={admin} view={view} setView={next=>{setView(next);track('view_change',{view_mode:next});}} saved={favourites.ids.length} openFavourites={()=>{setSelected(null);setShowFavourites(true);track('shortlist_open',{saved_count:favourites.ids.length});}} onNavigate={()=>{setSelected(null);setShowFavourites(false);setFilters(false);}}/>
    {admin ? <Suspense fallback={<p className="staff-portal">{t("Loading staff workspace…")}</p>}><div dir="ltr" lang="en"><StaffPortal items={items} onChange={refresh}/></div></Suspense> : howItWorks?<Suspense fallback={<p className="staff-portal">{t('Loading guide…')}</p>}><BuyerGuide/></Suspense> : <main className={`discovery-page view-${view}`} aria-label={t("London development explorer")}>
      <div className="discovery-toolbar">
        <form className="discovery-search" onSubmit={e=>e.preventDefault()}>
          <Search size={18}/>
          <input aria-label={t("Search by area, development or postcode")} placeholder={t("Search an area, development or postcode")} value={query} onChange={e => setQuery(e.target.value)}/>
          {query && <button type="button" className="clear-search" aria-label={t("Clear search")} onClick={() => setQuery('')}><X size={15}/></button>}
          <button type="button" aria-label={t("Filters")} className={`discovery-filter-trigger ${filterCount ? 'filtered' : ''}`} aria-expanded={filters} aria-haspopup="dialog" onClick={() => {setFilters(!filters);}}><SlidersHorizontal size={16}/><span>{t("Filters")}</span>{filterCount > 0 && <b>{filterCount}</b>}</button>
        </form>
        {filters && <Modal title={t("Find your London home")} close={()=>setFilters(false)} className="buyer-filter-dialog" doneLabel={t('Show {count} developments',{count:filtered.length})} footer={<button onClick={reset}>{t("Reset filters")}</button>}>

          {collection&&<section className="filter-collection-context"><strong><Star size={16}/>{collection.title}</strong><p>{featuredIds.length} {t('featured developments · Picked by')} {collection.brokerName}</p></section>}<div className="explorer-filter-fields"><label>{t("London region")}<select aria-label={t("London region")} value={region} onChange={e=>{setRegion(e.target.value);track('filter_apply',{filter_kind:'region'});}}><option value="">{t("All London")}</option>{['Prime central',...regions].map(r=><option key={r} value={r}>{t(r)}</option>)}</select></label><label>{t("Near an area")}<select aria-label={t("Near an area")} value={area} onChange={e=>{setArea(e.target.value);track('filter_apply',{filter_kind:'area'});}}><option value="">{t("All areas")}</option>{areas.map(a=><option key={a.name}>{a.name}</option>)}</select></label>
            <label>{t("Bedrooms")}<select aria-label={t("Bedrooms")} value={beds} onChange={e => {setBeds(e.target.value);track('filter_apply',{filter_kind:'bedrooms'});}}><option value="">{t("Any bedrooms")}</option><option value="0">{t("Studio")}</option>{[1,2,3,4].map(n => <option key={n} value={n}>{t('{count} bedrooms',{count:n})}</option>)}</select></label>
            <label>{t('Budget (starting price)')}<select aria-label={t('Budget (starting price)')} value={budget} onChange={e=>{setBudget(e.target.value);track('filter_apply',{filter_kind:'budget'});}}><option value="">{t('Any price')}</option>{[500000,750000,1000000,1500000,2000000,3000000,5000000].map(n=><option key={n} value={n}>{t('Up to {price}',{price:money(n)})}</option>)}</select></label>
          </div><div className="discovery-filter-checks"><label><input type="checkbox" checked={favouritesOnly} onChange={e=>{setFavouritesOnly(e.target.checked);if(e.target.checked)setShowFavouriteHighlights(true);setSelected(null);}}/><span>{t('Show favourites only')} ({favourites.ids.length})</span></label>{collection&&<label><input type="checkbox" checked={featuredOnly} onChange={e=>{setFeaturedOnly(e.target.checked);if(e.target.checked)setHighlightsEnabled(true);}}/><span>{t('Show featured only')}</span></label>}</div>
          <p className="area-filter-note">{t("Areas show developments within 2 km of the named centre. Regions are approximate geographic sectors.")}</p>
        </Modal>}
        <CommuteSearch items={items} onChange={setCommute} resetKey={commuteResetKey}/>
        <div className="discovery-count" role="status" aria-live="polite">{loading?t('Loading London homes…'):<><strong>{t('{count} developments',{count:filtered.length})}</strong>{(query||filterCount>0||commute)&&<button onClick={reset}>{t('Clear all')}</button>}</>}</div>
        {collection&&<CollectionBar collection={collection} broker={broker} active={highlightsEnabled} dimOthers={dimOthers} onlyPicked={featuredOnly} onView={()=>{setView('map');setCollectionFrameKey(n=>n+1);}} onDim={()=>setDimOthers(v=>!v)} onOnly={()=>setFeaturedOnly(v=>!v)} onRestore={()=>{setHighlightsEnabled(true);setDimOthers(true);setView('map');}} onContact={()=>track('whatsapp_click',{surface:'broker_banner'})}/>}

        {broker&&!collection&&<section className="discovery-broker"><span className="broker-label">{t('Your JLL broker')}</span><a aria-label={t('WhatsApp {name}',{name:broker.name})} title={t('WhatsApp {name}',{name:broker.name})} onClick={()=>track('whatsapp_click',{surface:'broker_banner'})} href={'https://wa.me/'+broker.whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent(t("Hi, I'd like more information about your London developments."))} target="_blank" rel="noopener noreferrer">{broker.photo?<img className="broker-avatar" src={broker.photo} alt=""/>:<WhatsAppIcon size={18}/>}<strong>{broker.name}</strong></a></section>}
        {collectionError&&<div className="explorer-message" role="status">{collectionError} {t("You can still explore the full portfolio.")}</div>}
        {error && <div className="explorer-message" role="alert">{error}<button onClick={() => { setError(''); void refresh().catch(e => setError(e.message)); }}>{t("Retry")}</button></div>}
        {!loading && !filtered.length && !error && view === 'map' && <div className="explorer-message"><Building2 size={20}/><div><strong>{t(favouritesOnly?"No favourites match this view":"No homes found")}</strong><p>{t(favouritesOnly?"Save developments with the heart button, or clear your filters to see more favourites.":"Try a different area or broaden your filters.")}</p></div><button onClick={reset}>{t("Reset")}</button></div>}
        {view==='split'&&<button className="discovery-list-jump" onClick={()=>{const heading=document.getElementById('homes-heading');heading?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});heading?.focus({preventScroll:true});}}>{t('View {count} homes below',{count:filtered.length})}<ChevronDown size={17}/></button>}
      </div>
      <div className="discovery-workspace">
        {view !== 'list' && <Suspense fallback={<div className="map-shell map-loading" role="status">{t("Loading your London map…")}</div>}><PortfolioMap resetKey={mapResetKey} collectionFrameKey={collectionFrameKey} dimOthers={dimOthers} onDimOthers={()=>setDimOthers(v=>!v)} onReset={resetMap} commuteDestination={commute?.destination} commuteTimes={commuteTimes} transportDefaults={highlightsEnabled?collection?.transportDefaults:undefined} items={filtered} selected={selected} onSelect={select} network={network} transportError={transportError} featuredIds={featuredIds} favouriteIds={showFavouriteHighlights?favourites.ids:[]} favouritesOnly={favouritesOnly}/></Suspense>}
        {view !== 'map' && <section className="explorer-list" aria-label={t("Development listings")}>
          <div className="listing-heading"><h2 id="homes-heading" tabIndex={-1}>{t("London New Homes")}</h2><label>{t("Sort by")}<select aria-label={t("Sort developments")} value={sort} onChange={e => setSort(e.target.value)}><option value="curated">{t("Our collection")}</option><option value="price-desc">{t('Starting price: high to low')}</option><option value="price">{t('Starting price: low to high')}</option><option value="name">{t("Name: A–Z")}</option><option value="area">{t("Area: A–Z")}</option></select></label></div>
          {loading ? <p className="empty-state">{t("Loading London New Homes…")}</p> : !filtered.length ? <div className="empty-state"><Building2 size={30}/><h2>{t(favouritesOnly?"No favourites match this view":"No homes found")}</h2><p>{t(favouritesOnly?"Save developments with the heart button, or clear your filters to see more favourites.":"Try a different area or broaden your filters.")}</p><button onClick={reset}>{t("Reset filters")}</button></div> : <div className="cards">
            {filtered.map(d => <article className="property-card-wrap" key={d.id}><button className={`property-card ${selected === d.id ? 'selected' : ''}`} key={d.id} onClick={() => setSelected(d.id)}>
              <div className="card-image"><img src={d.images[0] || '/images/city.svg'} alt={d.sample ? 'Architectural illustration' : d.name} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/city.svg'; }}/><span className={featuredIds.includes(d.id)?"card-tag featured-tag":"card-tag"}>{featuredIds.includes(d.id)?t('Featured'):d.sample ? t('Sample collection') : t(d.status)}</span><span className="card-arrow"><ArrowUpRight size={18}/></span></div>
              <div className="card-body"><p className="card-area"><MapPin size={12}/>{d.area}<span>· {d.postcode}</span></p><h2>{d.name}</h2>{commute&&commuteTimes[d.id]!==undefined&&<span className="commute-duration"><TrainFront size={13}/>{commuteTimes[d.id]} min commute</span>}<p className="card-beds">{bedroomLabel(d.bedrooms).replace('Studio',t('Studio'))} {t("bedrooms")} {specificPropertyTypes(d.propertyTypes).length>0&&<><span>·</span> {specificPropertyTypes(d.propertyTypes).map(ptype=>t(ptype)).join(' & ')}</>}</p><div className="card-bottom"><span>{beds?(Number(beds)===0?t('Studio'):t('{count} bedrooms',{count:Number(beds)}))+' '+t('Prices from'):t('Prices from')} <strong>{startingPrice(d,beds)!==null?money(startingPrice(d,beds)!):t('To be confirmed')}</strong></span><span className="explore">{t("View development")} <ArrowRight size={14}/></span></div></div>
            </button><button className={favourites.ids.includes(d.id)?"save-card saved":"save-card"} aria-pressed={favourites.ids.includes(d.id)} aria-label={favourites.ids.includes(d.id)?`Remove ${d.name} from favourites`:`Save ${d.name} to favourites`} onClick={()=>toggleFavourite(d.id)}><Heart size={17} fill={favourites.ids.includes(d.id)?"currentColor":"none"}/></button></article>)}
          </div>}
        </section>}
      </div>
      <div className="discovery-disclaimer">{beds&&budget?'Only homes with a confirmed starting price for the selected bedroom count are shown. ':''}{items.some(d => d.sample) ? 'Preview collection · Illustrative stock and prices' : 'Prices & availability subject to broker confirmation'}</div>
    </main>}
    <AnalyticsConsent/>
    {showFavourites&&!admin&&!howItWorks&&<Favourites items={items} ids={favourites.ids} toggle={toggleFavourite} persistent={favourites.persistent} broker={broker} collection={collection?.slug} close={()=>setShowFavourites(false)} open={id=>{setShowFavourites(false);setSelected(id);}}/>}
    {active && !admin && !howItWorks && <Detail selectedBedrooms={beds} key={active.id} broker={broker} collection={collection?.slug} d={active} stations={stations} network={network} saved={favourites.ids.includes(active.id)} toggleFavourite={()=>toggleFavourite(active.id)} close={() => setSelected(null)}/>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><PreferencesProvider><App/></PreferencesProvider></React.StrictMode>);
