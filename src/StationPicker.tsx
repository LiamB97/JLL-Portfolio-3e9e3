import {useRef, useState} from 'react';
import {Plus, Search, X} from 'lucide-react';
import type {Station} from './types';

export default function StationPicker({stations, selectedIds, onChange, t = text => text}: {
  stations: Station[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  t?: (text: string, values?: Record<string, string | number>) => string;
}) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const term = query.trim().toLowerCase();
  const selected = stations.filter(station => station.id && selectedIds.includes(station.id));
  const matches = term ? stations.filter(station => station.id && !selectedIds.includes(station.id) && station.name.toLowerCase().includes(term)) : [];

  return <div className="transport-station-picker">
    {selected.length > 0 && <div className="transport-station-chips">
      {selected.map(station => <button key={station.id} type="button" aria-label={t('Remove station') + ': ' + station.name}
        onClick={() => onChange(selectedIds.filter(id => id !== station.id))}>{station.name}<X size={14}/></button>)}
    </div>}
    <label className="transport-search"><Search size={16}/><input ref={search} aria-label={t('Find a station')} type="search"
      value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search stations…')}/></label>
    {term && <>
      <div className="transport-station-results">
        {matches.slice(0, 40).map(station => <button key={station.id} type="button" onClick={() => {
          onChange([...selectedIds, station.id!]);
          setQuery('');
          search.current?.focus();
        }}><span><strong>{station.name}</strong><small>{station.lines}</small></span><Plus size={16} aria-hidden="true"/></button>)}
      </div>
      {!matches.length && <p className="transport-result-note" role="status">{t('No other stations found.')}</p>}
      {matches.length > 40 && <p className="transport-result-note" role="status">{t('Keep typing to narrow your search.')}</p>}
    </>}
    {selectedIds.length > 0 && <button type="button" className="transport-text-button" onClick={() => onChange([])}>{t('Clear selected stations')}</button>}
  </div>;
}
