import {useId, useState, type ReactNode} from 'react';
import {Trash2} from 'lucide-react';
import Modal from './Modal';

export interface AdminSavedItem {
  id: string;
  ownerId: string;
  ownerName: string | null;
  title: string;
}

interface OwnerGroup<T> {
  ownerId: string;
  name: string;
  items: T[];
}

export default function AdminSavedItems<T extends AdminSavedItem>({items, noun, consequence, empty, disabled, details, actions, onDelete}: {
  items: T[];
  noun: 'collection' | 'brochure';
  consequence: string;
  empty: string;
  disabled?: boolean;
  details: (item: T) => ReactNode;
  actions?: (item: T) => ReactNode;
  onDelete: (ids: string[]) => Promise<number>;
}) {
  const heading = useId();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<T[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = items.filter(item => checked.has(item.id));
  const groups = new Map<string, OwnerGroup<T>>();
  for (const item of items) {
    const group = groups.get(item.ownerId);
    if (group) group.items.push(item);
    else groups.set(item.ownerId, {ownerId: item.ownerId, name: item.ownerName || 'Unknown broker', items: [item]});
  }
  const owners = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  const description = (size: number) => size + ' ' + noun + (size === 1 ? '' : 's');
  const canDelete = !disabled && !deleting && selected.length > 0;

  function toggle(ids: string[], select: boolean) {
    setNotice('');
    setChecked(previous => {
      const updated = new Set(previous);
      for (const id of ids) {
        if (select) updated.add(id);
        else updated.delete(id);
      }
      return updated;
    });
  }

  async function confirmDeletion() {
    if (!confirming || deleting) return;
    setDeleting(true);
    setError('');
    try {
      const ids = confirming.map(item => item.id);
      const removed = await onDelete(ids);
      toggle(ids, false);
      setNotice(removed ? description(removed) + ' deleted.' : 'The selected ' + noun + (ids.length === 1 ? ' was' : 's were') + ' already deleted.');
      setConfirming(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Deletion failed. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  return <section className="admin-saved-items" aria-labelledby={heading}>
    <div className="admin-saved-toolbar">
      <div>
        <h2 id={heading}>Saved {noun}s</h2>
        <p role="status">{notice || (selected.length ? selected.length + ' selected' : description(items.length))}</p>
      </div>
      {items.length > 0 && <div className="action-row">
        {selected.length > 0 && <button type="button" disabled={disabled || deleting} onClick={() => {setChecked(new Set()); setNotice('');}}>Clear selection</button>}
        <button className="admin-trigger-delete" type="button" disabled={!canDelete}
          onClick={() => {setError(''); setConfirming(selected);}}><Trash2 size={16}/> Delete selected</button>
      </div>}
    </div>
    {items.length === 0 && <p className="admin-saved-empty">{empty}</p>}
    {owners.map(owner => {
      const count = owner.items.filter(item => checked.has(item.id)).length;
      const all = count === owner.items.length;
      return <div className="admin-saved-group" key={owner.ownerId}>
        <div className="admin-saved-group-heading">
          <h3>{owner.name} <small>{description(owner.items.length)}</small></h3>
          <label><input type="checkbox" aria-label={'Select all ' + noun + 's for ' + owner.name} checked={all}
            ref={input => {if (input) input.indeterminate = count > 0 && !all;}} disabled={disabled || deleting}
            onChange={event => toggle(owner.items.map(item => item.id), event.target.checked)}/> Select all</label>
        </div>
        <ul className="admin-saved-list">
          {owner.items.map(item => <li key={item.id} className="admin-saved-row" data-selected={checked.has(item.id)}>
            <label>
              <input type="checkbox" aria-label={'Select ' + item.title + ' by ' + owner.name}
                checked={checked.has(item.id)} disabled={disabled || deleting} onChange={event => toggle([item.id], event.target.checked)}/>
              <span><strong>{item.title}</strong><small>{details(item)}</small></span>
            </label>
            {actions && <div className="action-row">{actions(item)}</div>}
          </li>)}
        </ul>
      </div>;
    })}
    {confirming && <Modal title={'Delete ' + description(confirming.length) + '?'} doneLabel={null}
      close={() => {if (!deleting) setConfirming(null);}} className="admin-delete-dialog"
      footer={<>
        <button type="button" disabled={deleting} onClick={() => setConfirming(null)}>Cancel</button>
        <button className="admin-confirm-delete" type="button" disabled={deleting} onClick={() => void confirmDeletion()}>
          <Trash2 size={16}/> {deleting ? 'Deleting…' : 'Delete ' + description(confirming.length)}
        </button>
      </>}>
      <p>{consequence}</p>
      <ul className="admin-delete-summary">
        {confirming.map(item => <li key={item.id}><strong>{item.title}</strong><small>{groups.get(item.ownerId)?.name || item.ownerName || 'Unknown broker'}</small></li>)}
      </ul>
      {error && <p role="alert">{error}</p>}
    </Modal>}
  </section>;
}
