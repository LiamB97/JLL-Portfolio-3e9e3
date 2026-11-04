import type {Development} from './types';
import {money} from './types';
import {startingPrice} from '../shared/pricing';
import {useLocale} from './i18n';
export default function UnitPrices({development:d,selectedBedrooms}:{development:Development;selectedBedrooms?:string}){const {t}=useLocale();return <section className="unit-prices" aria-label={t('Starting prices by bedroom')}><h2>{t('Starting prices by bedroom')}</h2><dl>{[...new Set(d.bedrooms)].sort((a,b)=>a-b).map(beds=><div key={beds} data-selected={selectedBedrooms!==undefined&&selectedBedrooms!==''&&Number(selectedBedrooms)===beds}><dt>{beds===0?t('Studio'):t('{count} bedrooms',{count:beds})}</dt><dd>{startingPrice(d,beds)!==null?`${t('From')} ${money(startingPrice(d,beds)!)}`:t('Price to be confirmed')}</dd></div>)}</dl><p>{t('Prices are for the stated bedroom type and remain subject to availability. Ask your broker to confirm the available homes.')}</p></section>;}
