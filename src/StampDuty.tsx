import {useId, useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {useLocale} from './i18n';
import {calculateStampDuty, parseStampDutyPrice, type StampDutyPurchase} from './stamp-duty';
import {money} from './types';
import './stamp-duty.css';

const hmrcCalculator = 'https://www.tax.service.gov.uk/calculate-stamp-duty-land-tax';

export default function StampDuty({startingPrice}: {startingPrice: number | null}) {
  const {t} = useLocale();
  const id = useId();
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<StampDutyPurchase>('standard');
  const [nonResident, setNonResident] = useState(false);
  const price = priceOverride ?? (startingPrice === null ? '' : String(startingPrice));
  const pricePence = parseStampDutyPrice(price);
  const estimate = pricePence === null ? null : calculateStampDuty(pricePence, purchase, nonResident);
  const invalidPrice = Boolean(price.trim() && pricePence === null);

  return <section className="stamp-duty" aria-labelledby={id + '-heading'}>
    <h2 id={id + '-heading'}>{t('Stamp duty estimate')}</h2>
    <div className="stamp-duty-fields">
      <label>
        {t('Purchase price (£)')}
        <input
          dir="ltr" inputMode="decimal" value={price} aria-invalid={invalidPrice || undefined}
          aria-describedby={id + '-result'} onChange={event => setPriceOverride(event.target.value)}
        />
      </label>
      <label>
        {t('Purchase type')}
        <select value={purchase} onChange={event => setPurchase(event.target.value as StampDutyPurchase)}>
          <option value="standard">{t('Standard purchase')}</option>
          <option value="first-time">{t('Eligible first-time buyer')}</option>
          <option value="additional">{t('Additional property')}</option>
        </select>
      </label>
    </div>
    <label className="stamp-duty-surcharge">
      <input type="checkbox" checked={nonResident} onChange={event => setNonResident(event.target.checked)}/>
      {t('Apply the non-UK resident surcharge')}
    </label>
    <div id={id + '-result'} className="stamp-duty-result" role="status">
      {estimate ? <>
        <div><span>{t('Estimated stamp duty')}</span><strong><bdi dir="ltr">{money(estimate.pounds)}</bdi></strong></div>
        {purchase === 'first-time' && !estimate.firstTimeRelief &&
          <p>{t('First-time buyer relief applies up to £500,000. This estimate uses standard rates.')}</p>}
      </> : <p>{t(invalidPrice ? 'Enter a valid purchase price in pounds.' : 'Enter a purchase price to see your estimate.')}</p>}
    </div>
    {purchase === 'first-time' && estimate?.firstTimeRelief !== false && <p className="stamp-duty-note">
      {t('To qualify, every buyer must be a first-time buyer and intend to live here as their main home.')}
    </p>}
    <p className="stamp-duty-note">{t('Uses current rates on the purchase price in England. Check your completion date or options for shared ownership, company purchases and lease rent with HMRC.')}</p>
    <a className="stamp-duty-link" href={hmrcCalculator} target="_blank" rel="noopener noreferrer">
      {t('Check with HMRC')} <ArrowUpRight size={15} aria-hidden="true"/>
    </a>
  </section>;
}
