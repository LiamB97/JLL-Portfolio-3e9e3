import {useEffect, useState} from 'react';
import {ArrowDown, ArrowUp, Download, FileText, Mail, Save, Search, Share2, Trash2, X} from 'lucide-react';
import {BROCHURE_MAX_CLIENT_NAME, BROCHURE_MAX_DEVELOPMENTS, BROCHURE_MAX_INTRO, BROCHURE_MAX_NOTE, BROCHURE_MAX_SAVED_BYTES} from '../shared/brochure-settings';
import {brochureShareLinks} from '../shared/brochure-sharing';
import {outlookDraft} from '../shared/email-draft';
import BrochureCover from './BrochureCover';
import WhatsAppIcon from './WhatsAppIcon';
import type {BrochureInput} from './brochure';
import type {Development} from './types';
import type {StaffCollection, StaffRequest, StaffUser} from './staff-types';

const defaultTitle = 'Your London New Homes';

interface Settings {
  title: string;
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

export default function StaffBrochures({items, user, request, active = true, onProfile}: {
  items: Development[];
  user: StaffUser;
  request: StaffRequest;
  active?: boolean;
  onProfile: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [collections, setCollections] = useState<StaffCollection[]>([]);
  const [collection, setCollection] = useState('');
  const [title, setTitle] = useState(defaultTitle);
  const [clientName, setClientName] = useState('');
  const [intro, setIntro] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedId, setSavedId] = useState('');
  const [version, setVersion] = useState<number | undefined>();
  const [result, setResult] = useState<{url: string; file: File; missing: string[]; warnings: string[]; count: number} | null>(null);

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
  useEffect(() => {setResult(null);}, [user.name, user.photo, user.whatsapp, user.jobTitle, user.email, user.shareSlug]);

  const chosen = selected.flatMap(id => {
    const development = items.find(d => d.id === id);
    return development ? [development] : [];
  });
  const shareLinks = brochureShareLinks(location.origin, user.shareSlug, collection, title, user.name);
  const config: Settings = {title, clientName, intro, notes, collection, developmentIds: chosen.map(d => d.id)};

  function edit() {
    setResult(null);
    setMessage('');
  }

  function startFromCollection(slug: string) {
    edit();
    setCollection(slug);
    const match = collections.find(c => c.slug === slug);
    setSelected(match?.developmentIds.filter(id => items.some(d => d.id === id)).slice(0, BROCHURE_MAX_DEVELOPMENTS) ?? []);
    if (match) setTitle(old => old && old !== 'Your London homes' && old !== defaultTitle ? old : match.title);
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
    setBusy(true);
    setMessage('');
    setResult(null);
    setProgress('Preparing your brochure…');
    try {
      const [{buildBrochure, brochureFilename}, {brochureFonts, brochurePhotos, brochureBrand, defaultBrochureCover}, {brochureMap}] =
        await Promise.all([import('./brochure'), import('./brochure-assets'), import('./brochure-map')]);
      const [fonts, brand, coverImage] = await Promise.all([brochureFonts(), brochureBrand(), defaultBrochureCover()]);
      if (!coverImage) throw Error('The London skyline cover could not load. Try again.');
      const {photos, missing} = await brochurePhotos(chosen, setProgress);
      setProgress('Preparing your shortlist map…');
      const map = await brochureMap(chosen);
      setProgress('Designing your New Homes brochure…');
      const input: BrochureInput = {
        title, clientName, intro, notes, items: chosen, broker: {...user, title: user.jobTitle || ''},
        origin: location.origin, brokerSlug: user.shareSlug, collection: collection || undefined, coverImage,
      };
      const pdf = buildBrochure(input, {...fonts, ...brand, photos, map});
      const file = new File([pdf.output('blob')], brochureFilename(title), {type: 'application/pdf'});
      setResult({url: URL.createObjectURL(file), file, missing, warnings: pdf.brochureWarnings, count: chosen.length});
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
    setClientName(c.clientName ?? '');
    setIntro(c.intro);
    setNotes(c.notes);
    setCollection(c.collection);
    try {
      if (row.hasPdf) {
        const response = await fetch('/api/admin/brochures/' + encodeURIComponent(row.id) + '/pdf');
        if (!response.ok) throw Error('The saved PDF could not load. Regenerate it from this draft.');
        const file = new File([await response.blob()], row.filename, {type: 'application/pdf'});
        setResult({url: URL.createObjectURL(file), file, missing: [], warnings: [], count: c.developmentIds.length});
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

  function newBrochure() {
    setSavedId('');
    setVersion(undefined);
    setSelected([]);
    setCollection('');
    setTitle(defaultTitle);
    setClientName('');
    setIntro('');
    setNotes({});
    edit();
  }

  return <section className="staff-section brochure-workspace">
    <div className="staff-section-title">
      <div><h1>Brochures for your buyers</h1><p>Build a mapped shortlist with your own introduction and contact details.</p></div>
      <button disabled={busy} onClick={newBrochure}>New brochure</button>
    </div>
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
        <fieldset disabled={busy}>
          <label>Start from a saved collection
            <select value={collection} onChange={e => startFromCollection(e.target.value)}>
              <option value="">Choose developments individually</option>
              {collections.map(c => <option key={c.id} value={c.slug}>{c.title}</option>)}
            </select>
          </label>
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
          <label>Brochure headline
            <input placeholder="e.g. Your handpicked homes in Battersea" maxLength={100} value={title} onChange={e => {edit(); setTitle(e.target.value);}}/>
          </label>
          <label>Client name (optional)
            <input aria-describedby="brochure-client-help" placeholder="e.g. Alex" maxLength={BROCHURE_MAX_CLIENT_NAME} value={clientName} onChange={e => {edit(); setClientName(e.target.value);}}/>
          </label>
          <p id="brochure-client-help">Adds “Selected for {clientName.trim() || 'Alex'}” to the cover.</p>
          {!user.jobTitle?.trim() && <div className="brochure-profile-title">
            <strong>Add your job title to the brochure</strong>
            <p>Your work here is kept while you update My profile.</p>
            <button type="button" onClick={onProfile}>Add job title in My profile</button>
          </div>}
          <label>Introduction (optional)
            <textarea aria-describedby="brochure-intro-help" placeholder="Tell your buyer why you chose these homes." rows={5} maxLength={BROCHURE_MAX_INTRO} value={intro} onChange={e => {edit(); setIntro(e.target.value);}}/>
          </label>
          <p id="brochure-intro-help">{intro.length}/{BROCHURE_MAX_INTRO} characters. The PDF preview flags copy shortened to fit the page.</p>
          <p className="brochure-contact">
            {user.photo && <img className="broker-avatar" src={user.photo} alt="Your broker photo"/>}
            Prepared by <strong>{user.name}</strong> · {user.whatsapp || 'Add your WhatsApp number in My profile.'} · {user.email}
          </p>
          {chosen.map((d, index) => <details className="brochure-property-note" key={d.id}>
            <summary><span>{index + 1}. {d.name}</span><small>{notes[d.id]?.trim() ? 'Note added' : 'Add a note or reorder'}</small></summary>
            <label>Your note for {d.name}
              <textarea rows={4} aria-describedby={'note-limit-' + d.id} maxLength={BROCHURE_MAX_NOTE} value={notes[d.id] || ''} onChange={e => {edit(); setNotes(old => ({...old, [d.id]: e.target.value}));}}/>
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
