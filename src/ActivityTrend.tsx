import {useState} from 'react';
import type {ActivityBucket, ActivityCounts, ActivityMetric, ActivityStaff} from '../shared/activity-overview';

export type TrendMetric = ActivityMetric | 'activeStaff';
export const metricLabels: Record<TrendMetric, string> = {
  activeStaff: 'Active staff',
  activeDays: 'Active days',
  staffActions: 'Staff actions',
  signIns: 'Sign-ins',
  collectionsCreated: 'Collections created',
  shares: 'Share actions',
  visits: 'Buyer link visits',
  developmentViews: 'Development views',
  favourites: 'Favourite saves',
  whatsapp: 'WhatsApp clicks',
};
const date = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});
const dateWithYear = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
export const formatActivityCount = new Intl.NumberFormat('en-GB').format;
export function activityDates(from: string, to: string, year = false) {
  return (year ? dateWithYear : date).formatRange(new Date(from), new Date(to));
}
export function activityMetric(rows: ActivityCounts[], metric: TrendMetric) {
  if (metric === 'activeStaff') return rows.filter(row => row.activeDays > 0).length;
  return rows.reduce((total, row) => total + row[metric], 0);
}

function axisStep(peak: number) {
  if (peak <= 4) return 1;
  const step = peak / 4;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  return ([1, 2, 2.5, 5, 10].find(factor => factor * magnitude >= step) ?? 10) * magnitude;
}

export default function ActivityTrend({staff, buckets, metric, setMetric, compare, individual}: {
  staff: ActivityStaff[];
  buckets: ActivityBucket[];
  metric: TrendMetric;
  setMetric: (metric: TrendMetric) => void;
  compare: boolean;
  individual: boolean;
}) {
  const [selected, setSelected] = useState(buckets.length - 1);
  const [preview, setPreview] = useState<number | null>(null);
  const points = buckets.map((bucket, index) => ({
    label: activityDates(bucket.from, bucket.to),
    previousLabel: activityDates(bucket.previousFrom, bucket.previousTo),
    columnLabel: date.format(new Date(bucket.from)),
    current: activityMetric(staff.map(person => person.series[index].current), metric),
    previous: activityMetric(staff.map(person => person.series[index].previous), metric),
  }));
  const point = points[preview ?? selected];
  const peak = Math.max(...points.map(row => Math.max(row.current, compare ? row.previous : 0)));
  const step = axisStep(peak);
  const maximum = step * 4;
  const columns = {gridTemplateColumns: 'repeat(' + points.length + ', minmax(0, 1fr))'};
  const label = metricLabels[metric];
  const metrics = ['visits', 'collectionsCreated', individual ? 'activeDays' : 'activeStaff', 'staffActions', 'signIns', 'shares', 'developmentViews', 'favourites', 'whatsapp'] as const;
  const bucketDays = (Date.parse(buckets[0].to) - Date.parse(buckets[0].from)) / 86_400_000 + 1;

  return <section className="insight-panel insight-trend" aria-labelledby="insight-trend-title" id="insight-trend">
    <header className="insight-panel-header">
      <div><h3 id="insight-trend-title">Activity over time</h3><p>{bucketDays === 1 ? 'Daily totals' : bucketDays + '-day totals'}</p></div>
      <select aria-label="Chart metric" value={metric} onChange={event => setMetric(event.target.value as TrendMetric)}>
        {metrics.map(value => <option key={value} value={value}>{metricLabels[value]}</option>)}
      </select>
    </header>
    <div className="insight-plot">
      <div className="insight-axis-y" aria-hidden="true">
        {[4, 3, 2, 1, 0].map(level => <span key={level} style={{top: (4 - level) * 25 + '%'}}>
          {formatActivityCount(level * step)}
        </span>)}
      </div>
      <div className="insight-columns" style={columns} role="group" aria-label={label + ' by date range'}>
        <div className="insight-gridlines" aria-hidden="true"/>
        {points.map((row, index) => <button type="button" key={row.label} aria-pressed={selected === index}
          aria-label={row.label + ', ' + formatActivityCount(row.current) + ' ' + label.toLowerCase() +
            (compare ? ', previous period ' + formatActivityCount(row.previous) : '')}
          data-preview={(preview ?? selected) === index}
          onFocus={() => setPreview(index)} onBlur={() => setPreview(null)}
          onPointerEnter={event => {if (event.pointerType === 'mouse') setPreview(index);}}
          onPointerLeave={() => setPreview(null)} onClick={() => setSelected(index)}>
          <span className="insight-column" aria-hidden="true" style={{height: row.current / maximum * 100 + '%'}}/>
          {compare && <span className="insight-column insight-column-prior" aria-hidden="true"
            style={{height: row.previous / maximum * 100 + '%'}}/>}
        </button>)}
      </div>
      <div className="insight-axis-x" style={columns} aria-hidden="true">
        {points.map(row => <span key={row.label}>{row.columnLabel}</span>)}
      </div>
    </div>
    <div className="insight-chart-readout">
      <span className="insight-series"><i aria-hidden="true"/><strong>{formatActivityCount(point.current)}</strong> {point.label}</span>
      {compare && <span className="insight-series insight-series-prior"><i aria-hidden="true"/>
        <strong>{formatActivityCount(point.previous)}</strong> {point.previousLabel} · Previous period
      </span>}
    </div>
    {!peak && <p className="insight-empty">No {label.toLowerCase()} recorded in this period.</p>}
    <details className="insight-chart-table">
      <summary>View chart data</summary>
      <table>
        <thead><tr><th scope="col">Dates</th><th scope="col">{label}</th>{compare && <th scope="col">Previous period</th>}</tr></thead>
        <tbody>{points.map(row => <tr key={row.label}><th scope="row">{row.label}</th>
          <td>{formatActivityCount(row.current)}</td>{compare && <td>{formatActivityCount(row.previous)} · {row.previousLabel}</td>}
        </tr>)}</tbody>
      </table>
    </details>
  </section>;
}
