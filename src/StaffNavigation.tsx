import {
  Activity, BarChart3, Building2, CircleHelp, ClipboardCheck, FileText, FolderOpen,
  Home, LayoutDashboard, ListChecks, LockKeyhole, LogOut, UserRound, Users, type LucideIcon,
} from 'lucide-react';
import type {StaffUser} from './staff-types';
import {staffRoleLabels} from '../shared/staff-roles';
import {workspaceGroups} from './workspace';

const icons: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  collections: FolderOpen,
  'your-first-home': Home,
  brochures: FileText,
  reviews: ClipboardCheck,
  profile: UserRound,
  developments: Building2,
  pending: ListChecks,
  users: Users,
  'buyer-access': LockKeyhole,
  activity: Activity,
  analytics: BarChart3,
  guide: CircleHelp,
};

export default function StaffNavigation({user, tab, navigate, signOut, busy}: {
  user: StaffUser;
  tab: string;
  navigate: (tab: string) => void;
  signOut: () => void;
  busy: boolean;
}) {
  const groups = workspaceGroups(user.role);
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');

  return <nav className="workspace-navigation" aria-label="Broker workspace">
    <label className="workspace-mobile-nav">Workspace section
      <select value={tab} onChange={event => navigate(event.target.value)}>
        {groups.map(group => <optgroup key={group.label} label={group.label}>
          {group.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="workspace-desktop-nav">
      {groups.map(group => <div className="workspace-nav-group" key={group.label}>
        <p>{group.label}</p>
        {group.items.map(({id, label}) => {
          const Icon = icons[id];
          return <button key={id} aria-current={tab===id ? 'page' : undefined} className={tab===id ? 'selected' : ''} onClick={() => navigate(id)}>
            <Icon size={17} aria-hidden="true"/>{label}
          </button>;
        })}
      </div>)}
    </div>
    <div className="workspace-nav-footer">
      <div className="workspace-account">
        <span className="workspace-account-avatar" aria-hidden="true">{user.photo ? <img src={user.photo} alt=""/> : initials}</span>
        <div><strong>{user.name}</strong><span>{staffRoleLabels[user.role]}</span></div>
      </div>
      <button className="workspace-signout" aria-label="Sign out" title="Sign out" disabled={busy} onClick={signOut}>
        <LogOut size={16} aria-hidden="true"/><span>Sign out</span>
      </button>
    </div>
  </nav>;
}
