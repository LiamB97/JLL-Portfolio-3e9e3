import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Clock3, GraduationCap, Landmark, MapPin, TrainFront, X} from 'lucide-react';
import {commutePlaceSuggestions, fullCommutePostcode, type CommutePlace} from '../shared/commute-destinations';
import {buyerApiPath} from './buyer-access';
import Modal from './Modal';
import {commuteMatches, londonDate, nextCommuteDay, type CommuteReport, type CommuteResult} from './commute';
import {useLocale} from './i18n';
import type {Development} from './types';

const placeIcon = {University: GraduationCap, Area: MapPin, Landmark};

export default function CommuteSearch({items, onChange, resetKey}: {
  items: Development[]; onChange: (value: CommuteReport | null) => void; resetKey: number;
}) {
  const {language, t} = useLocale();
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<CommutePlace | null>(null);
  const [suggest, setSuggest] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [date, setDate] = useState(nextCommuteDay);
  const [time, setTime] = useState('09:00');
  const [mode, setMode] = useState<CommuteReport['mode']>('public');
  const [minutes, setMinutes] = useState(45);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checked, setChecked] = useState(0);
  const [report, setReport] = useState<CommuteReport | null>(null);
  const controller = useRef<AbortController | null>(null);
  const run = useRef(0);
  const postcode = fullCommutePostcode(query);
  const options = suggest && !busy && !postcode ? commutePlaceSuggestions(query) : [];
  const optionId = (index: number) => optionsId + '-' + index;
  const matching = report?.results.filter(result => commuteMatches(result, report.maxMinutes)).length ?? 0;
  const unavailable = report?.results.filter(result => result.status !== 'ok').length ?? 0;
  const today = londonDate();

  useEffect(() => () => {run.current++; controller.current?.abort();}, []);
  useEffect(() => {
    if (highlight >= 0) document.getElementById(optionsId + '-' + highlight)?.scrollIntoView({block: 'nearest'});
  }, [highlight, optionsId]);
  useEffect(() => {
    run.current++;
    controller.current?.abort();
    setOpen(false);
    setBusy(false);
    setReport(null);
    setQuery('');
    setPlace(null);
    setSuggest(false);
    setHighlight(-1);
    setMessage('');
    setChecked(0);
  }, [resetKey]);

  function edit() {
    setReport(null);
    onChange(null);
    setMessage('');
  }

  function choose(destination: CommutePlace) {
    edit();
    setPlace(destination);
    setQuery(destination.name);
    setSuggest(false);
    setHighlight(-1);
  }

  function cancel() {
    run.current++;
    controller.current?.abort();
    setBusy(false);
    setMessage('Commute search stopped.');
  }

  async function search() {
    const destination = place ? {destinationId: place.id} : postcode ? {postcode} : null;
    if (!destination) {
      setMessage('Choose a suggested destination or enter a full UK postcode.');
      setSuggest(true);
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++run.current;
    setSuggest(false);
    setBusy(true);
    edit();
    setChecked(0);

    let cursor = 0, finished = 0, last: Omit<CommuteReport, 'maxMinutes'> | null = null;
    const results: CommuteResult[] = [];
    const batches = Array.from({length: Math.ceil(items.length / 5)}, (_, index) => items.slice(index * 5, index * 5 + 5));
    async function worker() {
      while (cursor < batches.length && !abort.signal.aborted) {
        const homes = batches[cursor++];
        const response = await fetch(buyerApiPath('/api/commute'), {
          method: 'POST', signal: abort.signal, headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({...destination, date, time, mode, developmentIds: homes.map(home => home.id)}),
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Commute search is unavailable.');
        if (abort.signal.aborted || run.current !== id) return;
        last = data;
        results.push(...data.results);
        finished += homes.length;
        setChecked(finished);
      }
    }
    try {
      await Promise.all(Array.from({length: Math.min(2, batches.length)}, worker));
      if (run.current !== id || abort.signal.aborted || !last) return;
      const complete = {...(last as Omit<CommuteReport, 'maxMinutes'>), results, maxMinutes: minutes};
      setReport(complete);
      onChange(complete);
    } catch (error) {
      if (run.current === id && !abort.signal.aborted) {
        setMessage(error instanceof Error ? error.message : 'Commute search is unavailable.');
        abort.abort();
      }
    } finally {
      if (run.current === id) setBusy(false);
    }
  }

  return <div className={report ? 'commute-search has-results' : 'commute-search'}>
    <button className="commute-search-trigger" aria-label={t('Find homes by commute')} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}>
      <span><Clock3 size={16}/><span className="commute-label-long">{t('Find homes by commute')}</span>
        <span className="commute-label-short">{t('Commute')}</span>
        {busy ? <small>{t('Checking {checked} of {total}…', {checked, total: items.length})}</small>
          : report && <small>{t('{count} matches', {count: matching})}</small>}</span><ChevronDown size={15}/>
    </button>
    {open && <Modal title={t('Find homes by commute')} close={() => {setOpen(false); setSuggest(false);}} className="commute-dialog">
      <div className="commute-search-body">
        <form onSubmit={event => {event.preventDefault(); void search();}}>
          <fieldset disabled={busy}>
            <div className="commute-destination-picker">
              <label>{t('Destination')}
                <input required role="combobox" aria-autocomplete="list" aria-expanded={options.length > 0}
                  aria-controls={options.length ? optionsId : undefined}
                  aria-activedescendant={options[highlight] ? optionId(highlight) : undefined}
                  maxLength={120} autoComplete="off" spellCheck={false} value={query}
                  placeholder={t('University, area, landmark or postcode')}
                  onFocus={() => {if (!place) setSuggest(true);}}
                  onBlur={() => {setSuggest(false); setHighlight(-1);}}
                  onChange={event => {edit(); setQuery(event.target.value); setPlace(null); setSuggest(true); setHighlight(-1);}}
                  onKeyDown={event => {
                    if (event.key === 'Escape' && options.length) {
                      event.preventDefault(); event.stopPropagation(); setSuggest(false); setHighlight(-1);
                    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      if (place || postcode) return;
                      event.preventDefault();
                      setSuggest(true);
                      const count = options.length || commutePlaceSuggestions(query).length;
                      if (!count) return;
                      const step = event.key === 'ArrowDown' ? 1 : -1;
                      setHighlight(index => index < 0 ? (step === 1 ? 0 : count - 1) : (index + step + count) % count);
                    } else if (event.key === 'Enter' && options[highlight]) {
                      event.preventDefault(); choose(options[highlight]);
                    }
                  }}/>
              </label>
              {options.length > 0 && <ul className="commute-destination-options" id={optionsId} role="listbox" aria-label={t('Suggested destinations')}>
                {options.map((option, index) => {
                  const Icon = placeIcon[option.kind];
                  return <li key={option.id} id={optionId(index)} role="option" aria-selected={index === highlight}
                    onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>
                    <Icon size={16} aria-hidden="true"/>
                    <span><strong>{option.name}</strong><small>{t(option.kind)}</small></span>
                  </li>;
                })}
              </ul>}
            </div>
            <div className="commute-fields">
              <label>{t('Travel by')}<select value={mode} onChange={event => {edit(); setMode(event.target.value as CommuteReport['mode']);}}>
                <option value="public">{t('Public transport')}</option><option value="walking">{t('Walking')}</option><option value="cycle">{t('Cycling')}</option>
              </select></label>
              <label>{t('Maximum minutes')}<input required type="number" min="5" max="180" step="1" value={minutes}
                onChange={event => {
                  const value = Number(event.target.value);
                  setMinutes(value);
                  if (report && value >= 5 && value <= 180) {const next = {...report, maxMinutes: value}; setReport(next); onChange(next);}
                }}/></label>
              <label>{t('Arrive on')}<input required type="date" min={today}
                max={new Date(Date.parse(today + 'T12:00:00Z') + 28 * 86400000).toISOString().slice(0, 10)}
                value={date} onChange={event => {edit(); setDate(event.target.value);}}/></label>
              <label>{t('Arrive by (London time)')}<input required type="time" value={time}
                onChange={event => {edit(); setTime(event.target.value);}}/></label>
            </div>
            <button className="primary" disabled={!items.length}><TrainFront size={15}/>{t('Find suitable homes')}</button>
          </fieldset>
          {busy && <div className="commute-progress" role="status">{t('Checking {checked} of {total}…', {checked, total: items.length})}
            <button type="button" onClick={cancel}>{t('Stop')}</button>
          </div>}
        </form>
        {message && <p role="status" className="commute-status">{t(message)}</p>}
        {report && <section className="commute-summary" aria-label={t('Commute search results')}>
          <strong>{t('{count} confirmed matches within {minutes} minutes', {count: matching, minutes: report.maxMinutes})}</strong>
          <p>{t('To {place} · arrive by {time} on {date}', {place: report.destination.name ?? report.destination.postcode, time: report.time, date: report.date})}</p>
          {unavailable > 0 && <p>{t('{count} journeys could not be confirmed and are excluded.', {count: unavailable})}</p>}
          <small>{t('TfL Journey Planner')} · {t('Checked {time}', {time: new Date(report.checkedAt).toLocaleTimeString(language, {hour: '2-digit', minute: '2-digit'})})}</small>
          <button type="button" onClick={() => {cancel(); edit(); setChecked(0);}}><X size={13}/>{t('Clear commute filter')}</button>
        </section>}
        <p className="commute-privacy">{t('Journey times use TfL routes and the selected location or postcode centre. Your destination is used only for this search.')}</p>
      </div>
    </Modal>}
  </div>;
}
