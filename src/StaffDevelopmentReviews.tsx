import {useEffect, useRef, useState} from 'react';
import {ExternalLink} from 'lucide-react';
import type {StaffRequest, StaffUser} from './staff-types';

type DevelopmentSummary = {id: string; name: string; area: string; postcode: string};
type Review = {
  development: DevelopmentSummary; assigneeId: string; assigneeName: string; assigneeActive: boolean;
  version: string; nextReminderAt: number; lastConfirmedAt?: number; lastFailureAt?: number;
};
type ReviewWorkspace = {
  reviews: Review[]; developments: DevelopmentSummary[]; consultants: {id: string; name: string; email: string}[];
  canAssign: boolean; emailConfigured: boolean;
};

const formatDate = new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeZone: 'Europe/London'}).format;

export default function StaffDevelopmentReviews({request, user}: {request: StaffRequest; user: StaffUser}) {
  const [data, setData] = useState<ReviewWorkspace | null>(null);
  const [developmentId, setDevelopmentId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
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
    setAssigneeId(data?.reviews.find(review => review.development.id === id)?.assigneeId ?? '');
  }

  async function saveReview(body: object, method: 'PUT' | 'POST', success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('development-reviews', body, method);
      await refresh();
      setMessage(success);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save the review.');
    } finally {
      setBusy(false);
    }
  }

  const assignment = data?.reviews.find(review => review.development.id === developmentId);
  const changed = (assignment?.assigneeId ?? '') !== assigneeId;

  return <section className="staff-section development-reviews">
    <h1>Development reviews</h1>
    <p>Check the published description, pricing and availability, then confirm the details. Each confirmation starts a new 14-day review period.</p>
    {error && <p role="alert" className="admin-message">{error} <button type="button" onClick={() => {
      setError('');void refresh().catch(e => setError(e.message));
    }}>Refresh list</button></p>}
    {message && <p role="status" className="admin-message">{message}</p>}
    {!data && !error && <p role="status">Loading reviews…</p>}
    {data?.canAssign && <form className="admin-panel" onSubmit={event => {
      event.preventDefault();
      if (!developmentId || !changed || busy) return;
      void saveReview({developmentId, assigneeId: assigneeId || null, version: assignment?.version ?? null}, 'PUT', assigneeId ? 'Review assignment saved.' : 'Review assignment removed.');
    }}>
      <h2>Assign a consultant</h2>
      <p>{data.emailConfigured ? 'Due developments are grouped into one email per consultant.' : 'Automatic email delivery needs to be configured. You can assign reviews now.'}</p>
      <label>Published development<select ref={developmentSelect} value={developmentId} onChange={event => selectDevelopment(event.target.value)} disabled={busy} required>
        <option value="">Choose a development</option>
        {[...data.developments].sort((a, b) => a.name.localeCompare(b.name)).map(development => <option key={development.id} value={development.id}>{development.name} · {development.area}</option>)}
      </select></label>
      <label>Consultant<select value={assigneeId} onChange={event => setAssigneeId(event.target.value)} disabled={busy || !developmentId}>
        <option value="">Unassigned</option>
        {assignment && !assignment.assigneeActive && <option value={assignment.assigneeId} disabled>{assignment.assigneeName} (inactive)</option>}
        {[...data.consultants].sort((a, b) => a.name.localeCompare(b.name)).map(consultant => <option key={consultant.id} value={consultant.id}>{consultant.name} · {consultant.email}</option>)}
      </select></label>
      <button className="primary" disabled={busy || !developmentId || !changed}>Save assignment</button>
    </form>}
    {data && <section className="admin-panel">
      <h2>{data.canAssign ? 'Assigned developments' : 'Your assigned developments'}</h2>
      {data.reviews.length === 0 && <p>No developments are assigned{data.canAssign ? '.' : ' to you.'}</p>}
      {[...data.reviews].sort((a, b) => a.nextReminderAt - b.nextReminderAt || a.development.name.localeCompare(b.development.name)).map(review => <article className="development-review-row" key={review.development.id}>
        <div><h3>{review.development.name}</h3><p>{review.development.area} · {review.development.postcode} · {review.assigneeName}{review.assigneeActive ? '' : ' (inactive)'}</p>
          <p>{review.lastConfirmedAt ? `Last confirmed ${formatDate(review.lastConfirmedAt)}` : 'Awaiting first review'} · {review.assigneeActive ? `Next review ${formatDate(review.nextReminderAt)}` : 'Reminders paused'}</p>
          {data.canAssign && review.lastFailureAt && <p>Previous email could not be confirmed as sent.</p>}
        </div>
        <div className="action-row">
          <a className="back-link" href={'/?development=' + encodeURIComponent(review.development.id)} target="_blank" rel="noopener noreferrer">View development <ExternalLink size={14}/></a>
          {review.assigneeId === user.id && <button type="button" className="primary" disabled={busy} onClick={() => void saveReview({developmentId: review.development.id, version: review.version}, 'POST', 'Details confirmed. The next review is due in 14 days.')}>Confirm details</button>}
          {data.canAssign && <button type="button" disabled={busy} onClick={() => {
            selectDevelopment(review.development.id);
            developmentSelect.current?.focus();
          }}>Change assignment</button>}
        </div>
      </article>)}
    </section>}
  </section>;
}
