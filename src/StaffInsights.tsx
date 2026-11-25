import {useEffect, useState, type ReactNode} from 'react';
import {Activity, ArrowDown, ArrowRight, ArrowUp, ChartNoAxesColumnIncreasing, FolderOpen, Link2, MessageCircle, RefreshCw, UserMinus, UsersRound} from 'lucide-react';
import {activityPeriods, type ActivityMetric, type ActivityOverview, type ActivityPeriod} from '../shared/activity-overview';
import {staffRoleLabels} from '../shared/staff-roles';
import ActivityTrend, {activityDates, activityMetric, formatActivityCount, metricLabels, type TrendMetric} from './ActivityTrend';
import Modal from './Modal';
import type {StaffRequest} from './staff-types';
import './activity-insights.css';

const summary = [
  {metric: 'activeStaff', icon: UsersRound},
  {metric: 'collectionsCreated', icon: FolderOpen},
  {metric: 'visits', icon: Link2},
  {metric: 'whatsapp', icon: MessageCircle},
] as const;
const rankMetrics = ['activeDays', 'collectionsCreated', 'visits', 'shares', 'staffActions', 'signIns'] as const;
const previewLimit = 5;
type RoleScope = 'all' | 'both' | 'broker' | 'broker_admin';

type RankRow = {
  id: string;
  label: string;
  detail?: string;
  value: number;
  selected?: boolean;
  onSelect?: () => void;
};

function RankedList({rows, empty, itemLabel}: {rows: RankRow[]; empty: string; itemLabel: string}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return <p className="insight-empty">{empty}</p>;
  const maximum = Math.max(...rows.map(row => row.value), 1);
  return <>
    <ol className="insight-ranking">
      {rows.slice(0, expanded ? rows.length : previewLimit).map(row => {
        const content = <>
          <span className="insight-rank-label"><strong>{row.label}</strong>{row.detail && <small>{row.detail}</small>}</span>
          <b className="insight-rank-number">{formatActivityCount(row.value)}</b>
          <span className="insight-track" aria-hidden="true"><span style={{width: row.value / maximum * 100 + '%'}}/></span>
        </>;
        return <li key={row.id}>{row.onSelect ? <button type="button" className="insight-rank-row"
          aria-label={row.label + ', ' + formatActivityCount(row.value) + ' ' + itemLabel}
          aria-pressed={row.selected} aria-haspopup={row.selected === undefined ? 'dialog' : undefined}
          onClick={row.onSelect}>{content}</button>
          : <div className="insight-rank-row">{content}</div>}
        </li>;
      })}
    </ol>
    {rows.length > previewLimit && <button type="button" className="insight-more" aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top ' + previewLimit : 'Show all ' + rows.length}</button>}
  </>;
}

function InsightPanel({id, title, detail, action, children}: {
  id: string; title: string; detail: string; action?: ReactNode; children: ReactNode;
}) {
  return <section className="insight-panel" aria-labelledby={id}>
    <header className="insight-panel-header">
      <div><h3 id={id}>{title}</h3><p>{detail}</p></div>
      {action}
    </header>
    {children}
  </section>;
}

export default function StaffInsights({request, viewerId, openReport}: {request: StaffRequest; viewerId: string; openReport: () => void}) {
  const [period, setPeriod] = useState<ActivityPeriod>(30);
  const [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<ActivityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [person, setPerson] = useState('');
  const [roleScope, setRoleScope] = useState<RoleScope>('all');
  const [excludedIds, setExcludedIds] = useState<string[]>([viewerId]);
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [metric, setMetric] = useState<TrendMetric>('visits');
  const [rank, setRank] = useState<ActivityMetric>('activeDays');
  const [inspection, setInspection] = useState<{kind: 'development' | 'collection'; id: string} | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(false);
    void request('activity?view=overview&days=' + period, undefined, 'GET').then((data: ActivityOverview) => {
      if (ignore) return;
      setReport(data);
      setPerson(current => data.staff.some(user => user.id === current) ? current : '');
    }).catch(() => {if (!ignore) setError(true);}).finally(() => {if (!ignore) setLoading(false);});
    return () => {ignore = true;};
  }, [period, refresh, request]);

  const team = report?.staff ?? [];
  const staffOptions = [...team].sort((a, b) => a.name.localeCompare(b.name));
  const includedStaff = staffOptions.filter(user => !excludedIds.includes(user.id) &&
    (roleScope === 'all' || user.role === roleScope || (roleScope === 'both' && (user.role === 'broker' || user.role === 'broker_admin'))));
  const staff = person ? includedStaff.filter(user => user.id === person) : includedStaff;
  const staffIds = new Set(staff.map(user => user.id));
  const excludedCount = team.filter(user => excludedIds.includes(user.id)).length;
  const chartMetric = metric === 'activeStaff' || metric === 'activeDays' ? (person ? 'activeDays' : 'activeStaff') : metric;
  const names = new Map(team.map(user => [user.id, user.name]));
  const collections = (report?.collections ?? []).filter(collection => staffIds.has(collection.ownerId));
  const links = (report?.links ?? []).filter(link => staffIds.has(link.ownerId));
  const developments = report?.developments ?? [];
  const stock = new Map(developments.map(development => [development.id, development]));
  const visits = activityMetric(staff.map(user => user.current), 'visits');
  const visitsWithoutLink = Math.max(0, visits - links.reduce((sum, link) => sum + link.visits, 0));
  const savedPdfs = staff.reduce((sum, user) => sum + user.savedPdfs, 0);
  const leaderboard = includedStaff.filter(user => user.current[rank] > 0)
    .sort((a, b) => b.current[rank] - a.current[rank] || a.name.localeCompare(b.name));
  const pickedBy = new Map<string, typeof collections>();
  for (const collection of collections) for (const id of collection.developmentIds) {
    const picks = pickedBy.get(id) ?? [];
    picks.push(collection);
    pickedBy.set(id, picks);
  }
  const popularDevelopments = developments.filter(development => pickedBy.has(development.id))
    .map(development => ({...development, count: pickedBy.get(development.id)!.length}))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const inspectedDevelopment = inspection?.kind === 'development' ? stock.get(inspection.id) : undefined;
  const inspectedCollection = inspection?.kind === 'collection' ? collections.find(collection => collection.id === inspection.id) : undefined;

  return <section className="workspace-insights" aria-labelledby="portfolio-activity-title" aria-busy={loading}>
    <header className="insights-heading">
      <div className="insights-heading-title">
        <span className="insights-heading-icon"><ChartNoAxesColumnIncreasing size={22} aria-hidden="true"/></span>
        <div><h2 id="portfolio-activity-title">Portfolio activity</h2>
          {report && <p>{activityDates(report.range.from, report.range.to, true)}</p>}
        </div>
      </div>
      <div className="insights-controls">
        <div className="insights-period" role="group" aria-label="Activity period">
          {activityPeriods.map(days => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>
            {days} days
          </button>)}
        </div>
        <button type="button" className="insight-refresh" onClick={() => setRefresh(value => value + 1)} disabled={loading}
          aria-label="Refresh portfolio activity" title="Refresh portfolio activity"><RefreshCw size={17} aria-hidden="true"/></button>
      </div>
    </header>
    {team.length > 0 && <div className="insights-controls insights-filters" role="group" aria-label="Activity staff filters">
      <select aria-label="Staff role" value={roleScope} onChange={event => {
        setRoleScope(event.target.value as RoleScope);
        setPerson('');
        setInspection(null);
      }}>
        <option value="all">All roles</option>
        <option value="both">Brokers and broker admins</option>
        <option value="broker">Brokers only</option>
        <option value="broker_admin">Broker admins only</option>
      </select>
      <select aria-label="Staff member" value={person} onChange={event => {
        setPerson(event.target.value);
        setInspection(null);
      }}>
        <option value="">Everyone in this filter</option>
        {includedStaff.map(user => <option key={user.id} value={user.id}>
          {user.name}{user.id === viewerId ? ' (you)' : ''}{!user.active ? ' · Disabled' : ''}
        </option>)}
      </select>
      <button type="button" className="insights-exclusions-button" aria-haspopup="dialog" onClick={() => setExclusionsOpen(true)}>
        <UserMinus size={16} aria-hidden="true"/> Exclude users{excludedCount > 0 && ' (' + excludedCount + ')'}
      </button>
    </div>}
    {exclusionsOpen && <Modal title="Exclude users" close={() => setExclusionsOpen(false)} className="activity-exclusions-dialog"
      footer={excludedIds.length ? <button type="button" onClick={() => setExcludedIds([])}>Clear exclusions</button> : undefined}>
      <fieldset className="activity-exclusions">
        <legend>Hide activity from</legend>
        {staffOptions.map(user => <label key={user.id}>
          <input type="checkbox" checked={excludedIds.includes(user.id)} onChange={event => {
            const excluded = event.target.checked;
            setExcludedIds(ids => excluded ? [...ids, user.id] : ids.filter(id => id !== user.id));
            if (excluded && user.id === person) setPerson('');
            setInspection(null);
          }}/>
          <span>{user.name}{user.id === viewerId ? ' (you)' : ''}<small>{staffRoleLabels[user.role]}</small></span>
        </label>)}
      </fieldset>
    </Modal>}
    {loading && <p className="insight-status" role="status">{report ? 'Updating activity…' : 'Loading portfolio activity…'}</p>}
    {error && <p className="insight-status" role="alert">Couldn’t load portfolio activity. Use Refresh to try again.</p>}
    {report && <>
      <div className="insight-kpis">
        {summary.map(({metric: summaryMetric, icon: Icon}) => {
          const key = summaryMetric === 'activeStaff' && person ? 'activeDays' : summaryMetric;
          const value = activityMetric(staff.map(user => user.current), key);
          const previous = activityMetric(staff.map(user => user.previous), key);
          const delta = value - previous;
          return <button type="button" key={summaryMetric} className="insight-kpi" aria-pressed={chartMetric === key}
            aria-controls="insight-trend" onClick={() => setMetric(key)}>
            <span><Icon size={17} aria-hidden="true"/>{metricLabels[key]}</span>
            <strong>{formatActivityCount(value)}</strong>
            {report.comparisonAvailable && <small>{delta > 0 ? <ArrowUp size={13} aria-hidden="true"/> : delta < 0 ? <ArrowDown size={13} aria-hidden="true"/> : null}
              {delta === 0 ? 'No change' : (delta > 0 ? '+' : '−') + formatActivityCount(Math.abs(delta))} vs previous period
            </small>}
          </button>;
        })}
      </div>
      <div className="insights-primary">
        <ActivityTrend key={report.range.from} staff={staff} buckets={report.buckets} metric={chartMetric}
          setMetric={setMetric} compare={report.comparisonAvailable} individual={Boolean(person)}/>
        <InsightPanel id="insight-team-title" title="Staff leaderboard" detail="Select a colleague to see their activity."
          action={<select aria-label="Rank staff by" value={rank} onChange={event => setRank(event.target.value as ActivityMetric)}>
            {rankMetrics.map(value => <option key={value} value={value}>{metricLabels[value]}</option>)}
          </select>}>
          <RankedList rows={leaderboard.map(user => ({
            id: user.id, label: user.name, detail: staffRoleLabels[user.role] + (!user.active ? ' · Disabled' : ''),
            value: user.current[rank], selected: user.id === person, onSelect: () => setPerson(user.id === person ? '' : user.id),
          }))} empty="No staff recorded activity for this measure in the period." itemLabel={metricLabels[rank].toLowerCase()}/>
        </InsightPanel>
      </div>
      <div className="insights-secondary">
        <InsightPanel id="insight-picks-title" title="Developments in collections"
          detail={formatActivityCount(collections.length) + ' saved ' + (collections.length === 1 ? 'collection' : 'collections') + ' today'}>
          <RankedList rows={popularDevelopments.map(development => ({
            ...development, label: development.name, detail: development.area, value: development.count,
            onSelect: () => setInspection({kind: 'development', id: development.id}),
          }))} empty="Saved collection picks will appear here." itemLabel="saved collections"/>
        </InsightPanel>
        <InsightPanel id="insight-links-title" title="Most viewed links"
          detail={person ? names.get(person) || 'Selected staff member' : 'Personal portfolio and collection links'}>
          <RankedList rows={links.map(link => ({
            ...link, detail: person ? undefined : names.get(link.ownerId), value: link.visits,
            onSelect: link.collectionId ? () => setInspection({kind: 'collection', id: link.collectionId!}) : undefined,
          }))} empty="Per-link visits will appear as new visits are recorded." itemLabel="visits"/>
          {visitsWithoutLink > 0 && <p className="insight-footnote">{formatActivityCount(visitsWithoutLink)} earlier visits are included in broker totals without a link breakdown.</p>}
        </InsightPanel>
      </div>
      <footer className="insights-footer">
        <div className="insights-footnotes">
          <p>{formatActivityCount(savedPdfs)} saved {savedPdfs === 1 ? 'PDF' : 'PDFs'} now
            {!person && roleScope === 'all' && excludedCount === 0 && <> · {formatActivityCount(report.generalVisits)} visits to links without a broker in this period</>}</p>
          <details><summary>How activity is counted</summary>
            <p>Active days count the dates on which staff used the workspace. Buyer visits include repeat visits from people who accepted analytics. WhatsApp counts measure button clicks. Collection picks and PDFs reflect what’s saved today.</p>
            <p>{report.startedAt ? 'Recording began ' + activityDates(report.startedAt, report.startedAt, true) + '. ' : 'Tracking starts when activity is recorded. '}
              {report.comparisonAvailable ? 'Compared with ' + activityDates(report.range.previousFrom, report.range.previousTo, true) + '. ' :
                'A full previous period is needed to show comparisons. '}Reporting dates use UTC.</p>
          </details>
        </div>
        <button type="button" className="insight-open-report" onClick={openReport}>
          <Activity size={16} aria-hidden="true"/> Team activity <ArrowRight size={16} aria-hidden="true"/>
        </button>
      </footer>
    </>}
    {inspectedDevelopment && <Modal title={inspectedDevelopment.name} close={() => setInspection(null)} className="insight-inspection">
      <p>{inspectedDevelopment.area} · Included in {(pickedBy.get(inspectedDevelopment.id) ?? []).length} saved collections</p>
      <ul>{(pickedBy.get(inspectedDevelopment.id) ?? []).map(collection => <li key={collection.id}>
        <strong>{collection.title}</strong><span>{names.get(collection.ownerId)}</span>
      </li>)}</ul>
    </Modal>}
    {inspectedCollection && <Modal title={inspectedCollection.title} close={() => setInspection(null)} className="insight-inspection">
      <p>{names.get(inspectedCollection.ownerId)} · Current collection picks</p>
      <ul>{inspectedCollection.developmentIds.map(id => <li key={id}>
        <strong>{stock.get(id)?.name}</strong><span>{stock.get(id)?.area}</span>
      </li>)}</ul>
    </Modal>}
  </section>;
}
