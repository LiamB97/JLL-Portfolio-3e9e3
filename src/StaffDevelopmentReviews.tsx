import {useEffect, useRef, useState} from 'react';
import {ExternalLink, Pencil} from 'lucide-react';
import {reviewRegions, type ReviewRegion} from '../shared/development-review';
import {canReviewDevelopments} from '../shared/staff-roles';
import type {StaffRequest, StaffUser} from './staff-types';

type DevelopmentSummary = {id: string; name: string; area: string; postcode: string; region: ReviewRegion | null};
type Review = {
  development: DevelopmentSummary & {bedrooms: number[]; unitPrices: Record<string, number>};
  assigneeId: string; assigneeName: string; assigneeActive: boolean;
  version: string; nextReminderAt: number; lastConfirmedAt?: number; lastFailureAt?: number;
};
export type ReviewWorkspace = {
  reviews: Review[]; developments: DevelopmentSummary[]; consultants: {id: string; name: string; email: string}[];
  canAssign: boolean; emailConfigured: boolean;
};

const formatDate = new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeZone: 'Europe/London'}).format;
const regions = [...reviewRegions, null] as const;
const regionLabel = (region: ReviewRegion | null) => region ?? 'No region';

export default function StaffDevelopmentReviews({request, user, onStockChange}: {request: StaffRequest; user: StaffUser; onStockChange: () => Promise<void>}) {
  const [data, setData] = useState<ReviewWorkspace | null>(null);
  const [developmentId, setDevelopmentId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [region, setRegion] = useState<ReviewRegion | null>(null);
  const [priceEditor, setPriceEditor] = useState<{review: Review; values: Record<string, string>} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const developmentSelect = useRef<HTMLSelectElement>(null);

  async function refresh() {
    const next: ReviewWorkspace = await request('development-reviews', undefined, 'GET');
    setData(next);
  }

  useEffect(() => {void refresh().catch(e => setError(e.message));}, [request]);

  function selectDevelopment(id: string) {
    setDevelopmentId(id);
    setAssigneeIds(data?.reviews.filter(review => review.development.id === id).map(review => review.assigneeId) ?? []);
    setRegion(data?.developments.find(development => development.id === id)?.region ?? null);
  }

  async function saveReview(body: object, method: 'PUT' | 'POST' | 'PATCH', success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('development-reviews', body, method);
      await refresh();
      if (method === 'PATCH') await onStockChange();
      setMessage(success);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save the review.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const assignments = data?.reviews.filter(review => review.development.id === developmentId) ?? [];
  const assignedRegion = data?.developments.find(development => development.id === developmentId)?.region ?? null;
  const changed = assignedRegion !== region || assignments.length !== assigneeIds.length ||
    assignments.some(review => !assigneeIds.includes(review.assigneeId));
  const consultants = [
    ...(data?.consultants ?? []),
    ...assignments.filter(review => !review.assigneeActive).map(review => ({id: review.assigneeId, name: review.assigneeName + ' (reviews paused)'})),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const developments = [...(data?.developments ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const reviews = [...(data?.reviews ?? [])].sort((a, b) => a.nextReminderAt - b.nextReminderAt || a.development.name.localeCompare(b.development.name));

  async function savePrices(editor: NonNullable<typeof priceEditor>) {
    const {review, values} = editor;
    const unitPrices = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '').map(([beds, value]) => [beds, Number(value)]));
    const saved = await saveReview({
      developmentId: review.development.id,
      version: review.version,
      expectedBedrooms: review.development.bedrooms,
      expectedUnitPrices: review.development.unitPrices,
      unitPrices,
    }, 'PATCH', 'Bedroom prices saved.');
    if (saved) setPriceEditor(null);
  }

  return <section className="staff-section development-reviews">
    <h1>{user.role === 'admin' ? 'Review assignments' : 'Development reviews'}</h1>
    <p>{user.role === 'admin'
      ? 'Assign Broker admins and Development consultants to check published details and bedroom prices.'
      : 'Check the published description, pricing and availability, then confirm the details. Each confirmation starts a new 14-day review period.'}</p>
    {error && <p role="alert" className="admin-message">{error} <button type="button" onClick={() => {
      setError('');setPriceEditor(null);void refresh().catch(e => setError(e.message));
    }}>Refresh list</button></p>}
    {message && <p role="status" className="admin-message">{message}</p>}
    {!data && !error && <p role="status">Loading reviews…</p>}
    {data?.canAssign && <form className="admin-panel" onSubmit={event => {
      event.preventDefault();
      if (!developmentId || !changed || busy) return;
      void saveReview({
        developmentId, assigneeIds, expectedAssignments: Object.fromEntries(assignments.map(review => [review.assigneeId, review.version])),
        region, expectedRegion: assignedRegion,
      }, 'PUT', 'Region and review assignment saved.');
    }}>
      <h2>Assign reviews by region</h2>
      <p>{data.emailConfigured ? 'Due developments are grouped into one email per consultant.' : 'Automatic email delivery needs to be configured. You can assign reviews now.'}</p>
      <label>Published development<select ref={developmentSelect} value={developmentId} onChange={event => selectDevelopment(event.target.value)} disabled={busy} required>
        <option value="">Choose a development</option>
        {regions.map(group => {
          const stock = developments.filter(development => development.region === group);
          return stock.length > 0 && <optgroup key={regionLabel(group)} label={regionLabel(group)}>
            {stock.map(development => <option key={development.id} value={development.id}>{development.name} · {development.area}</option>)}
          </optgroup>;
        })}
      </select></label>
      <label>Region<select value={region ?? ''} onChange={event => setRegion(reviewRegions.find(group => group === event.target.value) ?? null)} disabled={busy || !developmentId}>
        <option value="">No region</option>
        {reviewRegions.map(group => <option key={group}>{group}</option>)}
      </select></label>
      <fieldset className="review-consultants" disabled={busy || !developmentId}>
        <legend>Reviewers</legend>
        {consultants.map(consultant => <label key={consultant.id}>
          <input type="checkbox" checked={assigneeIds.includes(consultant.id)} onChange={event => {
            setAssigneeIds(ids => event.target.checked ? [...ids, consultant.id] : ids.filter(id => id !== consultant.id));
          }}/>
          {consultant.name}{'email' in consultant && <> · {consultant.email}</>}
        </label>)}
      </fieldset>
      <button className="primary" disabled={busy || !developmentId || !changed}>Save region and assignment</button>
    </form>}
    {data && <section className="admin-panel">
      <h2>{data.canAssign ? 'Assigned developments' : 'Your assigned developments'}</h2>
      {data.reviews.length === 0 && <p>No developments are assigned{data.canAssign ? '.' : ' to you.'}</p>}
      {regions.map(group => {
        const assigned = new Map<string, Review[]>();
        for (const row of reviews) {
          if (row.development.region !== group) continue;
          const id = row.development.id;
          const assignments = assigned.get(id) ?? [];
          assignments.push(row);
          assigned.set(id, assignments);
        }
        if (!assigned.size) return null;
        return <section className="development-review-group" key={regionLabel(group)}>
          <h3>{regionLabel(group)}</h3>
          {[...assigned].map(([id, developmentReviews]) => {
            const ownAssignment = developmentReviews.find(row => row.assigneeId === user.id);
            const review = ownAssignment ?? developmentReviews[0];
            const ownReview = Boolean(ownAssignment && canReviewDevelopments(user.role));
            const priced = review.development.bedrooms.filter(beds => review.development.unitPrices[beds]).length;
            const editingPrices = priceEditor?.review.development.id === id ? priceEditor : null;
            return <article className="development-review-row" key={id}>
              <div>
                <h4>{review.development.name}</h4>
                <p>{review.development.area} · {review.development.postcode}</p>
                {developmentReviews.map(row => <p key={row.assigneeId}>
                  {data.canAssign && <>{row.assigneeName} · </>}
                  {row.lastConfirmedAt ? `Last confirmed ${formatDate(row.lastConfirmedAt)}` : 'Awaiting first review'} · {row.assigneeActive ? `Next review ${formatDate(row.nextReminderAt)}` : 'Reminders paused'}
                  {data.canAssign && row.lastFailureAt && <> · Previous email delivery unconfirmed</>}
                </p>)}
                {(ownReview || data.canAssign) && <p>{priced} of {review.development.bedrooms.length} bedroom prices entered</p>}
              </div>
              <div className="action-row">
                <a className="back-link" href={'/?development=' + encodeURIComponent(id)} target="_blank" rel="noopener noreferrer">View development <ExternalLink size={14}/></a>
                {ownReview && !editingPrices && <button type="button" disabled={busy} onClick={() => setPriceEditor({
                  review, values: Object.fromEntries(Object.entries(review.development.unitPrices).map(([beds, price]) => [beds, String(price)])),
                })}><Pencil size={14}/> Bedroom prices</button>}
                {ownReview && <button type="button" className="primary" disabled={busy || Boolean(editingPrices)} onClick={() => void saveReview({developmentId: id, version: review.version}, 'POST', 'Details confirmed. The next review is due in 14 days.')}>Confirm details</button>}
                {data.canAssign && <button type="button" disabled={busy} onClick={() => {
                  selectDevelopment(id);
                  developmentSelect.current?.focus();
                }}>Change assignment</button>}
              </div>
              {editingPrices && <form className="development-review-pricing" onSubmit={event => {
                event.preventDefault();
                void savePrices(editingPrices);
              }}>
                <fieldset className="unit-price-editor" disabled={busy}>
                  <legend>Starting prices by bedroom type</legend>
                  <div className="unit-price-fields">
                    {[...editingPrices.review.development.bedrooms].sort((a, b) => a - b).map(beds => <label key={beds}>
                      {beds === 0 ? 'Studio' : beds === 1 ? '1 bedroom' : `${beds} bedrooms`} (£)
                      <input type="number" min={1} step={1} placeholder="Not confirmed" value={editingPrices.values[beds] ?? ''} onChange={event => {
                        const value = event.target.value;
                        setPriceEditor(current => current && {...current, values: {...current.values, [beds]: value}});
                      }}/>
                    </label>)}
                  </div>
                </fieldset>
                <div className="action-row">
                  <button className="primary" disabled={busy}>Save prices</button>
                  <button type="button" disabled={busy} onClick={() => setPriceEditor(null)}>Cancel</button>
                </div>
              </form>}
            </article>;
          })}
        </section>;
      })}
    </section>}
  </section>;
}
