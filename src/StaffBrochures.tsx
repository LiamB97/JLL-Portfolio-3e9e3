import {useEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowRight, ArrowUp, Download, FileText, FolderOpen, Mail, Save, Search, Share2, Trash2, X} from 'lucide-react';
import {BROCHURE_MAX_CLIENT_NAME, BROCHURE_MAX_DEVELOPMENTS, BROCHURE_MAX_INTRO, BROCHURE_MAX_NOTE, BROCHURE_MAX_SAVED_BYTES} from '../shared/brochure-settings';
import {brochureShareLinks} from '../shared/brochure-sharing';
import {outlookDraft} from '../shared/email-draft';
import {brochureTitles,buyerLanguage,buyerLanguages,type BuyerLanguage} from '../shared/buyer-language';
import BrochureCover from './BrochureCover';
import StaffBrochureManagement from './StaffBrochureManagement';
import WhatsAppIcon from './WhatsAppIcon';
import type {BrochureInput} from './brochure';
import type {Development} from './types';
import type {BrochureCollection, StaffCollection, StaffRequest, StaffUser} from './staff-types';

interface Settings {
  title: string;
  language?: BuyerLanguage;
  clientName?: string;
  intro: string;
  notes: Record<string, string>;
  collection: string;
  developmentIds: string[];
}
interface Saved {
  id: string;
  title: string;
  version: number;
  config: Settings;
  hasPdf: boolean;
  size: number;
  filename: string;
  updatedAt: string;
}

async function base64(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let value = '';
  for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}

function download(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}

export default function StaffBrochures({items, user, request, startCollection, active = true, onProfile}: {
  items: Development[];
  user: StaffUser;
  request: StaffRequest;
  startCollection?: BrochureCollection | null;
  active?: boolean;
  onProfile: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [collections, setCollections] = useState<StaffCollection[]>([]);
  const [collectionChoice, setCollectionChoice] = useState('');
  const [collection, setCollection] = useState('');
  const [title, setTitle] = useState(brochureTitles.en);
  const [language, setLanguage] = useState<BuyerLanguage>('en');
  const [clientName, setClientName] = useState('');
  const [intro, setIntro] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');
  const [managing, setManaging] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedId, setSavedId] = useState('');
  const [version, setVersion] = useState<number | undefined>();
  const [result, setResult] = useState<{url: string; file: File; missing: string[]; warnings: string[]; assetWarnings: string[]; count: number} | null>(null);
  const appliedCollection = useRef<BrochureCollection | null>(null);

  async function refresh() {
    setSaved(await request('brochures', undefined, 'GET'));
  }

  useEffect(() => {
    if (!active) return;
    void request('collections', undefined, 'GET').then((data: StaffCollection[]) => {
      setCollections(data.filter(c => c.ownerId === user.id));
    }).catch(() => setMessage('Saved collections could not load.'));
    void refresh().catch(() => setMessage('Saved brochures could not load. Retry before saving a new copy.'));
  }, [request, active, user.id]);
  useEffect(() => () => {if (result) URL.revokeObjectURL(result.url);}, [result]);
  useEffect(() => {setResult(null);}, [user.name, user.photo, user.whatsapp, user.jobTitle, user.email, user.shareSlug, user.wechatId, user.wechatQr]);
  useEffect(() => {
    if (!startCollection || appliedCollection.current === startCollection || busy || !items.length) return;
    appliedCollection.current = startCollection;
    newBrochure(startCollection);
  }, [startCollection, busy, items]);

  const chosen = selected.flatMap(id => {
    const development = items.find(d => d.id === id);
    return development ? [development] : [];
  });
  const shareLinks = brochureShareLinks(location.origin, user.shareSlug, collection, title, user.name, language);
  const config: Settings = {title, language, clientName, intro, notes, collection, developmentIds: chosen.map(d => d.id)};
  const eligibleCollections = collections.filter(row => row.developmentIds.some(id => items.some(item => item.id === id)));
  const selectedCollection = eligibleCollections.find(row => row.slug === collectionChoice);
  const linkedCollection = collections.find(row => row.slug === collection);

  function edit() {
    setResult(null);
    setMessage('');
  }

  function move(index: number, offset: number) {
    edit();
    const ids = chosen.map(d => d.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    setSelected(ids);
  }

  async function persist(file?: File) {
    const pdf = file && file.size <= BROCHURE_MAX_SAVED_BYTES ? await base64(file) : undefined;
    const row: Saved = await request('brochures', {
      ...(savedId ? {id: savedId, version} : {}),
      config,
      ...(pdf ? {pdfBase64: pdf} : file ? {clearPdf: true} : {}),
    });
    setSavedId(row.id);
    setVersion(row.version);
    await refresh();
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await persist(result?.file);
      setMessage(result && result.file.size > BROCHURE_MAX_SAVED_BYTES
        ? 'Brochure settings saved. Download the PDF now. It exceeds the 3.5MB limit for saved files.'
        : 'Brochure saved in your workspace. You can reopen it after signing in again.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the brochure.');
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    let preparing = true;
    setBusy(true);
    setMessage('');
    setResult(null);
    setProgress('Preparing your brochure…');
    try {
      const [{buildBrochure, brochureFilename}, {brochureFonts, brochurePhotos, brochureBrand, defaultBrochureCover}, {brochureMap}, {localiseBrochureListings}] =
        await Promise.all([import('./brochure'), import('./brochure-assets'), import('./brochure-map'), import('./brochure-translations')]);
      setProgress(language === 'en' ? 'Preparing your shortlist map and photos…' : 'Preparing listing translations, map and photos…');
      const [fonts, brand, cover, {photos, missing}, map, localized] = await Promise.all([
        brochureFonts(language), brochureBrand(), defaultBrochureCover(),
        brochurePhotos(chosen, completed => {
          if (preparing) setProgress(completed < chosen.length
            ? `Preparing photography ${completed} of ${chosen.length}…` : 'Finishing the shortlist map and cover…');
        }),
        brochureMap(chosen), localiseBrochureListings(chosen, language),
      ]);
      setProgress('Designing your New Homes brochure…');
      const input: BrochureInput = {
        title, language, clientName, intro, notes, items: localized.items, untranslated: localized.untranslated,
        broker: {...user, title: user.jobTitle || ''},
        origin: location.origin, brokerSlug: user.shareSlug, collection: collection || undefined, coverImage: cover.image,
      };
      const pdf = buildBrochure(input, {...fonts, ...brand, photos, map});
      const file = new File([pdf.output('blob')], brochureFilename(title), {type: 'application/pdf'});
      const assetWarnings = [];
      if (!cover.image) assetWarnings.push('The cover photo was unavailable. A plain cover was used.');
      else if (cover.fallback) assetWarnings.push('The saved cover could not load. The standard London skyline was used.');
      if (brand.fallback) assetWarnings.push('Some branding images could not load. Review the text and contact links before sharing.');
      if (localized.untranslated.length) assetWarnings.push('English listing copy was used for ' +
        chosen.filter(item => localized.untranslated.includes(item.id)).map(item => item.name).join(', ') + '. Review before sharing.');
      setResult({url: URL.createObjectURL(file), file, missing, assetWarnings, warnings: pdf.brochureWarnings, count: chosen.length});
      try {
        await persist(file);
        setMessage(file.size > BROCHURE_MAX_SAVED_BYTES
          ? 'PDF ready and settings saved. Download the PDF now. It exceeds the 3.5MB limit for saved files.'
          : 'PDF generated and saved in your workspace. Preview it before sharing.');
      } catch (error) {
        setMessage('PDF ready. Saving failed. ' + (error instanceof Error ? error.message : 'Try Save brochure again.'));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create the PDF.');
    } finally {
      preparing = false;
      setBusy(false);
      setProgress('');
    }
  }

  async function open(row: Saved) {
    setBusy(true);
    setMessage('');
    setResult(null);
    const c = row.config;
    setSavedId(row.id);
    setVersion(row.version);
    setSelected(c.developmentIds.filter(id => items.some(d => d.id === id)));
    setTitle(c.title);
    setLanguage(buyerLanguage(c.language));
    setClientName(c.clientName ?? '');
    setIntro(c.intro);
    setNotes(c.notes);
    setCollection(c.collection);
    try {
      if (row.hasPdf) {
        const response = await fetch('/api/admin/brochures/' + encodeURIComponent(row.id) + '/pdf');
        if (!response.ok) throw Error('The saved PDF could not load. Regenerate it from this draft.');
        const file = new File([await response.blob()], row.filename, {type: 'application/pdf'});
        setResult({url: URL.createObjectURL(file), file, missing: [], warnings: [], assetWarnings: [], count: c.developmentIds.length});
      }
      setMessage('Saved brochure opened. Regenerate the PDF to include the latest layout, prices and profile details.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open the saved PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Saved) {
    if (!confirm('Remove the saved brochure “' + row.title + '”?')) return;
    setBusy(true);
    try {
      await request('brochures/' + row.id, undefined, 'DELETE');
      if (savedId === row.id) {
        setSavedId('');
        setVersion(undefined);
      }
      await refresh();
      setMessage('Saved brochure removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove this brochure.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({files: [result.file], title});
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Download the PDF and attach it in the app you use.');
    }
  }

  function canShareFile() {
    try {return Boolean(result && typeof navigator.share === 'function' && navigator.canShare?.({files: [result.file]}));}
    catch {return false;}
  }

  async function email() {
    if (!result) return;
    const draft = new URL(shareLinks.email);
    const body = draft.searchParams.get('body') || '';
    const eml = new Blob([outlookDraft(title, body, result.file.name, await base64(result.file))], {type: 'message/rfc822'});
    const url = URL.createObjectURL(eml);
    download(url, result.file.name.replace(/\.pdf$/i, '.eml'));
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    setMessage('Outlook draft downloaded. Open it in Outlook, add your recipient and review the draft before sending.');
  }

  function newBrochure(source?: BrochureCollection) {
    setManaging(false);
    const ids = source?.developmentIds.filter(id => items.some(item => item.id === id)) ?? [];
    setSavedId('');
    setVersion(undefined);
    setSelected(ids.slice(0, BROCHURE_MAX_DEVELOPMENTS));
    setCollection(source?.slug ?? '');
    setCollectionChoice(source?.slug ?? '');
    const nextLanguage = buyerLanguage(source?.language);
    setLanguage(nextLanguage);
    setTitle(source?.title ?? brochureTitles[nextLanguage]);
    setClientName('');
    setIntro('');
    setNotes({});
    setQuery('');
    edit();
    if (ids.length > BROCHURE_MAX_DEVELOPMENTS) {
      setMessage('The first ' + BROCHURE_MAX_DEVELOPMENTS + ' developments were added. You can change the selection below.');
    }
  }

  function forgetBrochures(ids: string[]) {
    const removed = new Set(ids);
    setSaved(old => old.filter(row => !removed.has(row.id)));
    if (removed.has(savedId)) {
      setSavedId('');
      setVersion(undefined);
      setResult(null);
      setMessage('The saved brochure was deleted. You can save the current settings as a new draft.');
    }
  }

  if (user.role === 'admin' && managing) return <StaffBrochureManagement request={request} active={active}
    onBack={() => setManaging(false)} onDelete={forgetBrochures}/>;

  return <section className="staff-section brochure-workspace">
    <div className="staff-section-title">
      <div><h1>Brochures for your buyers</h1><p>Build a mapped shortlist with your own introduction and contact details.</p></div>
      <div className="action-row">
        {user.role === 'admin' && <button disabled={busy} onClick={() => setManaging(true)}><FolderOpen size={16}/> Manage saved brochures</button>}
        <button disabled={busy} onClick={() => newBrochure()}>New brochure</button>
      </div>
    </div>
    <section className="admin-panel brochure-collection-start" aria-labelledby="brochure-collection-heading">
      <span className="brochure-collection-icon"><FileText size={23} aria-hidden="true"/></span>
      <div>
        <h2 id="brochure-collection-heading">Create from a buyer collection</h2>
        <p>Start a new brochure with its title and featured developments.</p>
      </div>
      {eligibleCollections.length > 0 && <div className="brochure-collection-picker">
        <select aria-label="Saved buyer collection" disabled={busy} value={collectionChoice} onChange={event => setCollectionChoice(event.target.value)}>
          <option value="">Choose a collection</option>
          {eligibleCollections.map(row => <option key={row.id} value={row.slug}>{row.title} · {row.developmentIds.length} homes</option>)}
        </select>
        <button className="primary" disabled={busy || !selectedCollection} onClick={() => selectedCollection && newBrochure(selectedCollection)}>
          Use collection <ArrowRight size={16}/>
        </button>
      </div>}
    </section>
    <section className="admin-panel saved-brochures">
      <h2>Saved brochures · {saved.length}</h2>
      <p>Private to your account. Save up to 50 brochures and 100MB of PDFs, with a 3.5MB limit per PDF.</p>
      {!saved.length && <p>No saved brochures yet. Save a draft or generate a brochure below.</p>}
      {saved.map(row => <div className="saved-brochure-row" key={row.id}>
        <div><strong>{row.title}</strong><small>{row.config.developmentIds.length} developments · {row.hasPdf ? (row.size / 1000000).toFixed(1) + 'MB PDF' : 'Draft settings'} · Saved {new Date(row.updatedAt).toLocaleString('en-GB')}</small></div>
        <div className="action-row">
          <button disabled={busy} onClick={() => void open(row)}>Open brochure</button>
          {row.hasPdf && <a href={'/api/admin/brochures/' + row.id + '/pdf'} download={row.filename}>Download PDF</a>}
          <button disabled={busy} onClick={() => void remove(row)} aria-label={'Remove saved brochure ' + row.title}><Trash2 size={16}/></button>
        </div>
      </div>)}
    </section>
    <div className="brochure-grid">
      <section className="admin-panel">
        <h2>1. Choose your developments</h2>
        {linkedCollection && <p className="brochure-linked-collection"><FileText size={16}/> From {linkedCollection.title}</p>}
        <fieldset disabled={busy}>
          <label className="brochure-search">
            <Search size={16}/><input type="search" aria-label="Find developments for brochure" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, area or postcode"/>
          </label>
          <p>{chosen.length} of {BROCHURE_MAX_DEVELOPMENTS} developments selected</p>
          <div className="collection-choices">
            {items.filter(d => `${d.name} ${d.area} ${d.postcode}`.toLowerCase().includes(query.toLowerCase())).map(d =>
              <label className="collection-choice" key={d.id}>
                <input type="checkbox" checked={selected.includes(d.id)} disabled={!selected.includes(d.id) && chosen.length >= BROCHURE_MAX_DEVELOPMENTS} onChange={() => {
                  edit();
                  setSelected(ids => ids.includes(d.id) ? ids.filter(id => id !== d.id) : [...ids, d.id]);
                }}/>
                <span><strong>{d.name}</strong><small>{d.area} · {d.postcode}</small></span>
              </label>)}
          </div>
        </fieldset>
      </section>
      <section className="admin-panel">
        <h2>2. Personalise your brochure</h2>
        <fieldset disabled={busy}>
          <BrochureCover user={user} request={request} changed={edit}/>
          <label>Buyer language<select value={language} onChange={event => {
            edit();
            const next = buyerLanguage(event.target.value);
            if (title === brochureTitles[language]) setTitle(brochureTitles[next]);
            setLanguage(next);
          }}>{buyerLanguages.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {language !== 'en' && <p>Enter your headline, introduction and notes in the buyer’s language. The brochure translates the listing copy and labels.</p>}
          <label>Brochure headline
            <input dir="auto" placeholder="e.g. Your handpicked homes in Battersea" maxLength={100} value={title} onChange={e => {edit(); setTitle(e.target.value);}}/>
          </label>
          <label>Client name (optional)
            <input dir="auto" aria-describedby="brochure-client-help" placeholder="e.g. Alex" maxLength={BROCHURE_MAX_CLIENT_NAME} value={clientName} onChange={e => {edit(); setClientName(e.target.value);}}/>
          </label>
          <p id="brochure-client-help">Adds the buyer’s name to the cover.</p>
          {!user.jobTitle?.trim() && <div className="brochure-profile-title">
            <strong>Add your job title to the brochure</strong>
            <p>Your work here is kept while you update My profile.</p>
            <button type="button" onClick={onProfile}>Add job title in My profile</button>
          </div>}
          <label>Introduction (optional)
            <textarea dir="auto" aria-describedby="brochure-intro-help" placeholder="Tell your buyer why you chose these homes." rows={5} maxLength={BROCHURE_MAX_INTRO} value={intro} onChange={e => {edit(); setIntro(e.target.value);}}/>
          </label>
          <p id="brochure-intro-help">{intro.length}/{BROCHURE_MAX_INTRO} characters. The PDF preview flags copy shortened to fit the page.</p>
          <p className="brochure-contact">
            {user.photo && <img className="broker-avatar" src={user.photo} alt="Your broker photo"/>}
            Prepared by <strong>{user.name}</strong> · {user.whatsapp || 'Add your WhatsApp number in My profile.'} · {user.email}
          </p>
          {chosen.map((d, index) => <details className="brochure-property-note" key={d.id}>
            <summary><span>{index + 1}. {d.name}</span><small>{notes[d.id]?.trim() ? 'Note added' : 'Add a note or reorder'}</small></summary>
            <label>Your note for {d.name}
              <textarea dir="auto" rows={4} aria-describedby={'note-limit-' + d.id} maxLength={BROCHURE_MAX_NOTE} value={notes[d.id] || ''} onChange={e => {edit(); setNotes(old => ({...old, [d.id]: e.target.value}));}}/>
            </label>
            <p id={'note-limit-' + d.id}>{(notes[d.id] || '').length}/{BROCHURE_MAX_NOTE} characters</p>
            <div className="action-row">
              <button aria-label={'Move ' + d.name + ' earlier'} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14}/></button>
              <button aria-label={'Move ' + d.name + ' later'} disabled={index === chosen.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14}/></button>
              <button onClick={() => {edit(); setSelected(ids => ids.filter(id => id !== d.id));}}><X size={14}/> Remove</button>
            </div>
          </details>)}
        </fieldset>
        <div className="action-row">
          <button disabled={busy || !chosen.length || !title.trim()} onClick={() => void save()}><Save size={16}/> Save brochure</button>
          <button className="primary" disabled={busy || !chosen.length || !title.trim() || !user.whatsapp || !user.shareSlug} onClick={() => void generate()}><FileText size={16}/>{busy ? 'Preparing…' : 'Generate & save PDF'}</button>
        </div>
        <p>Your PDF includes a cover, a shortlist map, one page per development and a contact page.</p>
      </section>
    </div>
    {(message || progress) && <p role="status" className="admin-message">{progress || message}</p>}
    {result && <section className="admin-panel brochure-result">
      <h2>3. Review and share</h2>
      <p>{(result.file.size / 1000000).toFixed(1)}MB · {result.count} developments · PDF brochure</p>
      {result.missing.length > 0 && <p role="status">Photography could not be included for {result.missing.join(', ')}. Review the placeholders before sharing.</p>}
      {result.assetWarnings.length > 0 && <p role="status">{result.assetWarnings.join(' ')}</p>}
      {result.warnings.length > 0 && <p role="status">Copy shortened to fit the page for {result.warnings.join(', ')}.</p>}
      <div className="action-row">
        <a href={result.url} download={result.file.name}><Download size={16}/> Download PDF</a>
        <a className="whatsapp-action" href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => {
          download(result.url, result.file.name);
          setMessage('PDF downloaded. Attach it as a document in WhatsApp.');
        }}><WhatsAppIcon size={16}/> Share via WhatsApp</a>
        <button onClick={() => void email()}><Mail size={16}/>Outlook draft · PDF attached</button>
        {canShareFile() && <button onClick={() => void share()}><Share2 size={16}/> Share file…</button>}
      </div>
      <p>Open the downloaded .eml file in Outlook and add the recipient. To share in WhatsApp, attach the downloaded PDF in your conversation.</p>
      <object data={result.url} type="application/pdf" className="brochure-preview" aria-label="Generated brochure preview"><p>Use Download PDF to review this brochure.</p></object>
    </section>}
  </section>;
}
