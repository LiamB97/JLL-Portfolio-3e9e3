import {useEffect, useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import AdminSavedItems, {type AdminSavedItem} from './AdminSavedItems';
import type {StaffRequest} from './staff-types';

interface ManagedBrochure extends AdminSavedItem {
  developmentCount: number;
  hasPdf: boolean;
  updatedAt: string;
}

interface Inventory {
  brochures: ManagedBrochure[];
  pendingFiles: number;
}

const savedDate = new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium'});

export default function StaffBrochureManagement({request, active, onBack, onDelete}: {
  request: StaffRequest;
  active: boolean;
  onBack: () => void;
  onDelete: (ids: string[]) => void;
}) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [cleanupError, setCleanupError] = useState('');
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    setLoadError('');
    void request('brochures/manage', undefined, 'GET').then((data: Inventory) => {
      if (current) setInventory(data);
    }).catch((error: unknown) => {
      if (current) setLoadError(error instanceof Error ? error.message : 'Unable to load saved brochures.');
    });
    return () => {current = false;};
  }, [active, attempt, request]);

  async function remove(ids: string[]) {
    const result: {removedIds: string[]; pendingFiles: number} = await request('brochures/bulk-delete', {ids});
    const removed = new Set(ids);
    setInventory(previous => previous && ({
      brochures: previous.brochures.filter(row => !removed.has(row.id)),
      pendingFiles: result.pendingFiles,
    }));
    setCleanupError('');
    onDelete(ids);
    return result.removedIds.length;
  }

  async function retryFileCleanup() {
    setCleanupError('');
    setCleaning(true);
    try {
      const result: {pendingFiles: number} = await request('brochures/retry-file-cleanup');
      setInventory(previous => previous && {...previous, pendingFiles: result.pendingFiles});
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : 'Unable to finish PDF removal.');
    } finally {
      setCleaning(false);
    }
  }

  return <section className="staff-section">
    <div className="staff-section-title">
      <div><h1>Manage saved brochures</h1><p>Find and delete saved drafts and PDFs by broker.</p></div>
      <button type="button" disabled={cleaning} onClick={onBack}><ArrowLeft size={16}/> My brochures</button>
    </div>
    {loadError && <div className="admin-panel action-row">
      <p role="alert">{loadError}</p>
      <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button>
    </div>}
    {!inventory && !loadError && <p role="status">Loading saved brochures…</p>}
    {Boolean(inventory?.pendingFiles) && <div className="admin-panel admin-pdf-cleanup">
      <p role="status">{inventory?.pendingFiles} {inventory?.pendingFiles === 1 ? 'PDF still needs' : 'PDFs still need'} to be removed from storage.</p>
      <button type="button" disabled={cleaning} onClick={() => void retryFileCleanup()}>{cleaning ? 'Removing PDFs…' : 'Finish PDF removal'}</button>
      {cleanupError && <p role="alert">{cleanupError}</p>}
    </div>}
    {inventory && <AdminSavedItems items={inventory.brochures} noun="brochure" disabled={cleaning} onDelete={remove}
      empty="No brokers have saved brochures." consequence="The selected drafts and PDFs will be removed from their brokers’ workspaces."
      details={row => {
        const updated = new Date(row.updatedAt);
        return <>{row.hasPdf ? 'Saved PDF' : 'Draft'} · {row.developmentCount} {row.developmentCount === 1 ? 'development' : 'developments'}
          {Number.isFinite(updated.getTime()) && <> · Saved {savedDate.format(updated)}</>}</>;
      }}/>}
  </section>;
}
