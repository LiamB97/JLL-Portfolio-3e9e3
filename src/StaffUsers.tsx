import {useEffect, useState} from 'react';
import {Copy, KeyRound, UserPlus} from 'lucide-react';
import {staffRoleLabels, type StaffRole} from '../shared/staff-roles';
import Modal from './Modal';
import type {StaffUser, StaffRequest} from './staff-types';

interface Invitation {id: string; name: string; email: string; role: StaffRole; expiresAt: number}
interface ResetLink {user: StaffUser; href: string}

export default function StaffUsers({request, current}: {request: StaffRequest; current: StaffUser}) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('broker');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetLink, setResetLink] = useState<ResetLink | null>(null);
  const [accessTarget, setAccessTarget] = useState<StaffUser | null>(null);
  const isAdmin = current.role === 'admin';
  const inviteRoles = isAdmin ? Object.entries(staffRoleLabels) : [['broker', staffRoleLabels.broker]];
  const activeAdmins = users.filter(user => user.active && user.role === 'admin').length;

  const refresh = () => Promise.all([
    ...(isAdmin ? [request('users', undefined, 'GET').then(setUsers)] : []),
    request('invites', undefined, 'GET').then(setInvitations),
  ]);
  useEffect(() => {void refresh().catch(error => setMessage(error.message));}, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {await action();}
    catch (error) {setMessage(error instanceof Error ? error.message : 'Request failed.');}
    finally {setBusy(false);}
  }

  async function copy(href: string, success: string) {
    try {await navigator.clipboard.writeText(href); setMessage(success);}
    catch {setMessage('Select and copy the private link manually.');}
  }

  function resetPassword(user: StaffUser) {
    void run(async () => {
      const result = await request('users/' + encodeURIComponent(user.id) + '/reset-password', {});
      setResetLink({user, href: location.origin + '/#reset=' + encodeURIComponent(result.token)});
    });
  }

  async function updateAccount(user: StaffUser, changes: {active: boolean} | {role: string}) {
    const saved: StaffUser = await request('users/' + encodeURIComponent(user.id), changes);
    setUsers(previous => previous.map(account => account.id === saved.id ? saved : account));
    await refresh();
    setMessage('active' in changes ? (saved.active ? 'Access enabled.' : 'Access disabled.') :
      'Role updated. This colleague must sign in again.');
    setAccessTarget(null);
  }

  return <section className="staff-section">
    <div className="staff-section-title"><div>
      <h1>People &amp; access</h1>
      <p>Brokers and Broker admins share collections and brochures. Broker admins also manage stock and complete assigned reviews. Development consultants focus on assigned reviews and bedroom prices. Admins manage accounts and assign reviews.</p>
    </div></div>
    {message && !resetLink && !accessTarget && <p role="status" className="admin-message">{message}</p>}
    <div className="staff-users-grid">
      <form className="admin-panel" onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          const result = await request('users/invite', {name, email, role});
          setLink(location.origin + '/#invite=' + encodeURIComponent(result.token));
          await refresh();
          setMessage('Invitation created. Copy the private link and send it to this colleague. It expires in seven days.');
        });
      }}>
        <h2><UserPlus size={19}/> Invite a colleague</h2>
        <label>Full name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} autoComplete="name"/></label>
        <label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email"/></label>
        <label>Role<select aria-label="Invitation role" value={role} onChange={event => setRole(event.target.value)}>
          {inviteRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button className="primary" disabled={busy}>Create invitation link</button>
        <p>Send the invitation link privately to your colleague.</p>
        {link && <div className="collection-share">
          <label>Private invitation link<input readOnly value={link} onFocus={event => event.currentTarget.select()}/></label>
          <button type="button" onClick={() => void copy(link, 'Invitation link copied. Send it privately to your colleague.')}>
            <Copy size={15}/> Copy invitation
          </button>
        </div>}
      </form>
      {isAdmin && <section className="admin-panel">
        <h2>Staff accounts</h2>
        {users.map(user => {
          const lastAdmin = user.active && user.role === 'admin' && activeAdmins === 1;
          return <div className="staff-user" key={user.id}>
            <div><strong>{user.name}{user.id === current.id ? ' (you)' : ''}</strong>
              <span>{user.email}</span>
              <small>{user.active ? 'Active' : 'Access disabled'}{lastAdmin && ' · Last active admin'}</small>
            </div>
            <div className="staff-user-controls">
              <label>Role<select aria-label={'Role for ' + user.name} disabled={busy || lastAdmin} value={user.role}
                onChange={event => {const value = event.target.value; void run(() => updateAccount(user, {role: value}));}}>
                {inviteRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              {user.active && <button type="button" disabled={busy} aria-label={'Reset password for ' + user.name}
                onClick={() => resetPassword(user)}><KeyRound size={15} aria-hidden="true"/> Reset password</button>}
              <button type="button" disabled={busy || lastAdmin} aria-label={(user.active ? 'Disable' : 'Enable') + ' access for ' + user.name}
                onClick={() => {setMessage(''); setAccessTarget(user);}}>{user.active ? 'Disable access' : 'Enable access'}</button>
            </div>
          </div>;
        })}
      </section>}
    </div>
    <section className="admin-panel">
      <h2>Pending invitations</h2>
      {!invitations.length && <p>No pending invitations.</p>}
      {invitations.map(invitation => <div className="staff-user" key={invitation.id}>
        <div><strong>{invitation.name}</strong><span>{invitation.email} · {staffRoleLabels[invitation.role]}</span>
          <small>Expires {new Date(invitation.expiresAt).toLocaleDateString('en-GB')}</small></div>
        <button type="button" disabled={busy} onClick={() => void run(async () => {
          await request('invites/' + invitation.id, undefined, 'DELETE');
          await refresh();
          setMessage('Invitation revoked.');
        })}>Revoke</button>
      </div>)}
    </section>
    {resetLink && <Modal title={'Reset password for ' + resetLink.user.name}
      close={() => {setResetLink(null); setMessage('');}}
      footer={<button type="button" onClick={() => void copy(resetLink.href, 'Reset link copied.')}>
        <Copy size={16}/> Copy reset link
      </button>}>
      <p>Send this private link to {resetLink.user.email}. It expires after 24 hours and can be used once.</p>
      <p>They choose their own password. Existing sessions end when the new password is saved.</p>
      <label>Private password reset link<input dir="ltr" readOnly value={resetLink.href} onFocus={event => event.currentTarget.select()}/></label>
      {message && <p role="status">{message}</p>}
    </Modal>}
    {accessTarget && <Modal title={(accessTarget.active ? 'Disable' : 'Enable') + ' access for ' + accessTarget.name}
      close={() => {if (!busy) {setAccessTarget(null); setMessage('');}}}
      doneLabel="Cancel"
      footer={<button type="button" className="primary" disabled={busy}
        onClick={() => void run(() => updateAccount(accessTarget, {active: !accessTarget.active}))}>
        {accessTarget.active ? 'Disable access' : 'Enable access'}
      </button>}>
      <p>{accessTarget.active
        ? 'This signs them out of the workspace and pauses their personal portfolio and buyer collection links. You can enable access again here.'
        : 'This restores workspace access and their personal portfolio and buyer collection links.'}</p>
      {message && <p role="alert">{message}</p>}
    </Modal>}
  </section>;
}
