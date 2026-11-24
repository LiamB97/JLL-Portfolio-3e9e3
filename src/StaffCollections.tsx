import TransportDefaults, {emptyTransportDefaults} from './TransportDefaults';
import EmailShare from './EmailShare';
import {portfolioInvitation} from './sharing';
import WhatsAppIcon from './WhatsAppIcon';
import {useEffect, useState} from 'react';
import {Copy, ExternalLink, FileText, LockKeyhole, Plus, Star, Trash2} from 'lucide-react';
import type {Development} from './types';
import type {BrochureCollection, StaffCollection, StaffRequest, StaffUser} from './staff-types';
import {YourFirstHomeShortcut} from './StaffYourFirstHome';
import AdminSavedItems from './AdminSavedItems';

export default function StaffCollections({items, request, user, active = true, onCampaign, onBrochure}: {
  items: Development[]; request: StaffRequest; user: StaffUser; active?: boolean;
  onCampaign: () => void; onBrochure: (collection: BrochureCollection) => void;
}) {
  const [transport, setTransport] = useState(emptyTransportDefaults);
  const [collections, setCollections] = useState<StaffCollection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('Homes picked for you');
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [protectedLink, setProtectedLink] = useState(false);
  const [savedVersion, setSavedVersion] = useState({fields: '', passwordProtected: false});
  const isAdmin = user.role === 'admin';
  const saved = collections.find(collection => collection.id === editing);
  const fields = {title, developmentIds: selected, transportDefaults: transport};
  const dirty = Boolean(link && (savedVersion.fields !== JSON.stringify(fields) || savedVersion.passwordProtected !== protectedLink));
  const choices = items.filter(d => `${d.name} ${d.area} ${d.postcode}`.toLowerCase().includes(query.toLowerCase()));
  const buyerLink = (slug: string) => location.origin + '/?collection=' + encodeURIComponent(slug);
  const canStartBrochure = (collection: StaffCollection) =>
    collection.ownerId === user.id && collection.developmentIds.some(id => items.some(item => item.id === id));

  useEffect(() => {
    if (!active) return;
    let current = true;
    void request('collections', undefined, 'GET').then(data => {
      if (current) setCollections(data);
    }).catch(e => {
      if (current) setMessage(e.message);
    });
    return () => {current = false;};
  }, [active, request]);

  async function save(rotate = false) {
    setBusy(true);
    setMessage('');
    const passwordAction = rotate ? 'rotate' : protectedLink !== savedVersion.passwordProtected
      ? (protectedLink ? 'protect' : 'remove') : undefined;
    try {
      const collection: StaffCollection = await request(editing ? 'collections/' + editing : 'collections',
        {...fields, passwordAction}, editing ? 'PUT' : 'POST');
      setCollections(old => editing ? old.map(row => row.id === collection.id ? collection : row) : [...old, collection]);
      setSavedVersion({fields: JSON.stringify(fields), passwordProtected: collection.passwordProtected});
      setProtectedLink(collection.passwordProtected);
      setEditing(collection.id);
      setLink(buyerLink(collection.slug));
      setMessage(rotate ? 'New collection password generated.' : 'Collection saved. Copy the link to share with your buyer.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }

  function fresh() {
    setEditorOpen(true);
    setQuery('');
    setTransport(emptyTransportDefaults());
    setEditing(null);
    setSelected([]);
    setTitle('Homes picked for you');
    setLink('');
    setProtectedLink(false);
    setSavedVersion({fields: '', passwordProtected: false});
    setMessage('');
  }

  function edit(collection: StaffCollection) {
    const ids = collection.developmentIds.filter(id => items.some(d => d.id === id));
    const defaults = collection.transportDefaults ?? emptyTransportDefaults();
    setSavedVersion({
      fields: JSON.stringify({title: collection.title, developmentIds: ids, transportDefaults: defaults}),
      passwordProtected: collection.passwordProtected,
    });
    setEditorOpen(true);
    setQuery('');
    setTransport(defaults);
    setEditing(collection.id);
    setTitle(collection.title);
    setSelected(ids);
    setLink(buyerLink(collection.slug));
    setProtectedLink(Boolean(collection.passwordProtected));
    setMessage('');
  }

  function shareEvent(event: string, failure: string) {
    void request('activity', {event, collectionId: editing}).catch(() => setMessage(failure));
  }

  async function remove(collection: StaffCollection) {
    if (!confirm('Stop sharing this collection? Existing links will no longer open it.')) return;
    setBusy(true);
    try {
      await request('collections/' + collection.id, undefined, 'DELETE');
      forgetCollections([collection.id]);
      setMessage('Collection link removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove the link.');
    } finally {
      setBusy(false);
    }
  }

  function forgetCollections(ids: string[]) {
    const removed = new Set(ids);
    setCollections(old => old.filter(row => !removed.has(row.id)));
    if (editing && removed.has(editing)) {
      fresh();
      setEditorOpen(false);
    }
  }

  async function bulkDelete(ids: string[]) {
    const result: {removedIds: string[]} = await request('collections/bulk-delete', {ids});
    forgetCollections(ids);
    return result.removedIds.length;
  }

  function collectionActions(collection: StaffCollection) {
    return <>
      {canStartBrochure(collection) && <button className="primary collection-create-brochure" disabled={busy}
        aria-label={'Create brochure from ' + collection.title} onClick={() => onBrochure(collection)}><FileText size={17}/> Create brochure</button>}
      <a href={buyerLink(collection.slug)} target="_blank" rel="noopener noreferrer">Preview <ExternalLink size={13}/></a>
      <button disabled={busy} onClick={() => edit(collection)}>Edit & share</button>
      {!isAdmin && <button aria-label={'Delete ' + collection.title} onClick={() => void remove(collection)} disabled={busy}><Trash2 size={14}/> Remove</button>}
    </>;
  }

  function collectionDetails(collection: StaffCollection) {
    return <>
      {collection.developmentIds.length} featured {collection.developmentIds.length === 1 ? 'development' : 'developments'}
      {collection.password && <> · {collection.passwordProtected ? 'Password protected' : 'Portfolio password required'}</>}
    </>;
  }

  return <section className="staff-section">
    {!editorOpen&&<YourFirstHomeShortcut user={user} request={request} onOpen={onCampaign} active={active}/>}
    <div className="staff-section-title">
      <div><h1>{isAdmin ? 'Buyer collections' : 'Collections for your buyers'}</h1><p>{isAdmin ? 'Find saved collections by broker.' : 'Choose developments to feature on the buyer’s map.'}</p></div>
      <div className="action-row">
        {editorOpen ? <button disabled={busy} onClick={() => setEditorOpen(false)}>Back to saved collections</button>
          : (editing || selected.length > 0) && <button disabled={busy} onClick={() => setEditorOpen(true)}>Continue editing</button>}
        <button disabled={busy} className="primary" onClick={fresh}><Plus size={15}/> New collection</button>
      </div>
    </div>
    <div className={editorOpen ? 'collection-editor editing' : 'collection-editor'}>
      <section hidden={!editorOpen} className="admin-panel collection-form-panel">
        <h2><Star size={18}/> {editing ? 'Edit collection' : 'Create a featured collection'}</h2>
        <label>Collection title<input value={title} maxLength={100} onChange={e => setTitle(e.target.value)}/></label>
        <label>Find developments<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, area or postcode"/></label>
        <p>{selected.length} selected · Choose up to 50 developments</p>
        <div className="collection-choices">
          {!choices.length && <p>No developments match this search.</p>}
          {choices.map(d => <label className="collection-choice" key={d.id}>
            <input type="checkbox" checked={selected.includes(d.id)} disabled={!selected.includes(d.id) && selected.length >= 50}
              onChange={() => setSelected(old => old.includes(d.id) ? old.filter(id => id !== d.id) : [...old, d.id])}/>
            <span><strong>{d.name}</strong><small>{d.area} · {d.postcode}</small></span>
          </label>)}
        </div>
        <details className="collection-map-options">
          <summary>Map layers on opening <small>{transport.showLines || transport.showStations ? 'Custom transport settings' : 'Off by default'}</small></summary>
          <TransportDefaults value={transport} onChange={setTransport}/>
        </details>
        <label className="buyer-access-choice">
          <input type="checkbox" checked={protectedLink} disabled={busy} onChange={e => setProtectedLink(e.target.checked)}/>
          <span><strong>Password protect this collection</strong><small>Buyers enter a simple password generated when you save.</small></span>
        </label>
        <button className="primary" disabled={busy || !selected.length || !title.trim()} onClick={() => void save()}>{editing ? 'Save changes' : 'Create buyer link'}</button>
        <p>Use a general title without buyer details.</p>
        {dirty && <p role="status">Save your changes before sharing the buyer link.</p>}
        {link && !dirty && <div className="collection-share">
          <label>Buyer link<input aria-label="Buyer collection link" readOnly value={link} onFocus={e => e.currentTarget.select()}/></label>
          {saved?.password && <div className="buyer-share-password">
            <label>{saved.passwordProtected ? 'Collection password' : 'Portfolio password'}<input readOnly value={saved.password} onFocus={e => e.currentTarget.select()}/></label>
            <p>Share the password separately with your buyer.</p>
            <div className="action-row">
              <button onClick={() => void navigator.clipboard.writeText(saved.password!).then(() => setMessage('Password copied.'))
                .catch(() => setMessage('Select and copy the password manually.'))}><Copy size={15}/> Copy password</button>
              {saved.passwordProtected && <button disabled={busy} onClick={() => void save(true)}>Replace collection password</button>}
            </div>
          </div>}
          <div className="action-row">
            {saved && canStartBrochure(saved) && <button className="primary collection-create-brochure" disabled={busy}
              onClick={() => onBrochure(saved)}><FileText size={17}/> Create brochure</button>}
            <button onClick={() => void navigator.clipboard.writeText(link).then(() => {
              setMessage('Buyer link copied.');
              shareEvent('collection_link_copy', 'Link copied, but the activity count could not be saved.');
            }).catch(() => setMessage('Select the link above and copy it manually.'))}><Copy size={15}/> Copy link</button>
            <a className="whatsapp-action" href={'https://wa.me/?text=' + encodeURIComponent(portfolioInvitation + '\n' + link)} target="_blank" rel="noopener noreferrer"
              onClick={() => shareEvent('collection_whatsapp_click', 'WhatsApp opened, but the activity count could not be saved.')}>
              <WhatsAppIcon size={16}/> Share on WhatsApp
            </a>
          </div>
          <EmailShare link={link} title={saved?.password ? 'Your private JLL portfolio link' : saved?.title}
            items={saved?.password ? [] : (saved?.developmentIds ?? []).flatMap(id => {const d = items.find(item => item.id === id);return d ? [d] : [];})}
            onShare={() => shareEvent('collection_email_click', 'Email prepared, but the activity count could not be saved.')}/>
          <a href={link} target="_blank" rel="noopener noreferrer">Preview collection <ExternalLink size={13}/></a>
        </div>}
      </section>
      {isAdmin ? <div hidden={editorOpen}>
        <AdminSavedItems items={collections} noun="collection" disabled={busy} details={collectionDetails} actions={collectionActions}
          empty="No buyer collections have been saved." consequence="Links to these collections will stop opening." onDelete={bulkDelete}/>
      </div> : <section hidden={editorOpen} className="admin-panel collection-saved-panel">
        <h2>Your saved collections</h2>
        {!collections.length && <p>Create your first collection to highlight homes for a buyer. Your contact details stay attached to the link.</p>}
        {collections.map(collection => <div className="saved-collection" key={collection.id}>
          <strong>{collection.title}</strong>
          <p>{collection.developmentIds.length} featured developments</p>
          {collection.password && <p className="collection-password-status"><LockKeyhole size={14}/> {collection.passwordProtected ? 'Password protected' : 'Portfolio password required'}</p>}
          <div className="saved-collection-actions action-row">{collectionActions(collection)}</div>
        </div>)}
      </section>}
    </div>
    {message && <p role="status" className="admin-message">{message}</p>}
  </section>;
}
