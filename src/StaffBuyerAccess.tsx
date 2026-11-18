import {useEffect, useState} from 'react';
import {Copy, KeyRound} from 'lucide-react';
import type {StaffRequest} from './staff-types';

interface Settings {
  enabled: boolean;
  instructedOnly: boolean;
  brokers: {id: string; name: string; password: string | null}[];
}

export default function StaffBuyerAccess({request}: {request: StaffRequest}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [instructedOnly, setInstructedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function receive(data: Settings) {
    setSettings(data);
    setEnabled(data.enabled);
    setInstructedOnly(data.instructedOnly);
  }

  useEffect(() => {
    let active = true;
    void request('buyer-access', undefined, 'GET').then(data => {
      if (active) receive(data);
    }).catch(error => {
      if (active) setError(error.message);
    });
    return () => {active = false;};
  }, [request]);

  async function update(route: string, body: object, method: 'PUT' | 'POST', success: string) {
    setMessage('');
    setError('');
    setBusy(true);
    try {
      receive(await request(route, body, method));
      setMessage(success);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Buyer access could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const changes = settings ? {
    ...(settings.enabled !== enabled ? {enabled} : {}),
    ...(settings.instructedOnly !== instructedOnly ? {instructedOnly} : {}),
  } : {};
  const changed = Object.keys(changes).length > 0;

  return <section className="staff-section staff-buyer-access">
    <h1>Buyer access</h1>
    <p>Manage who can open the buyer portfolio and the developments they can see.</p>
    {error && <p role="alert" className="admin-message">{error}</p>}
    {message && <p role="status" className="admin-message">{message}</p>}
    {!settings && !error && <p role="status">Loading buyer access…</p>}
    {settings && <>
      <form className="admin-panel" onSubmit={event => {
        event.preventDefault();
        if (changed && !busy) void update('buyer-access', changes, 'PUT', 'Buyer access settings saved.');
      }}>
        <label className="buyer-access-choice">
          <input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)}/>
          <span><strong>Password protect the full portfolio</strong><small>Each broker gets a unique password in My profile. A protected collection can still open its own selected homes.</small></span>
        </label>
        <label className="buyer-access-choice">
          <input type="checkbox" checked={instructedOnly} disabled={busy} onChange={event => setInstructedOnly(event.target.checked)}/>
          <span><strong>Show only JLL-instructed developments</strong><small>The buyer portfolio and collection links will show developments from the last verified JLL Residential new homes list.</small></span>
        </label>
        <button className="primary" disabled={busy || !changed}>Save settings</button>
      </form>
      {settings.enabled && <section className="admin-panel">
        <h2><KeyRound size={18}/> Broker passwords</h2>
        <p>Replacing a password ends access for buyers using the previous one.</p>
        {[...settings.brokers].sort((a, b) => a.name.localeCompare(b.name)).map(broker => <div className="buyer-access-broker" key={broker.id}>
          <strong>{broker.name}</strong>
          <div className="action-row">
            {broker.password && <><code>{broker.password}</code><button type="button" onClick={() => {
              void navigator.clipboard.writeText(broker.password!).then(() => setMessage('Password copied.'))
                .catch(() => setError('Select the password and copy it manually.'));
            }} aria-label={`Copy password for ${broker.name}`}><Copy size={15}/> Copy</button></>}
            <button type="button" disabled={busy || changed} onClick={() => void update(
              'buyer-access/rotate', {brokerId: broker.id}, 'POST', 'New broker password generated.',
            )}>Replace password</button>
          </div>
        </div>)}
      </section>}
    </>}
  </section>;
}
