import {useEffect, useState} from 'react';
import {Search, X} from 'lucide-react';
import {useLocale} from './i18n';

const examples = ['Southbank', 'Mayfair', 'Canary Wharf', 'SW1'];

export default function DiscoverySearch({query, setQuery, narrow}: {query: string; setQuery: (value: string) => void; narrow: boolean}) {
  const {t} = useLocale();
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState('');
  const canPrompt = !query && !focused;

  useEffect(() => {
    if (!canPrompt) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: number | undefined;
    let index = 0;
    let characters = 0;
    let deleting = false;
    function tick() {
      const word = examples[index];
      characters += deleting ? -1 : 1;
      setExample(word.slice(0, characters));
      let delay = deleting ? 52 : 90;
      if (characters === word.length) {
        deleting = true;
        delay = 1650;
      } else if (characters === 0) {
        deleting = false;
        index = (index + 1) % examples.length;
        delay = 520;
      }
      timer = window.setTimeout(tick, delay);
    }
    function refresh() {
      window.clearTimeout(timer);
      setExample('');
      index = characters = 0;
      deleting = false;
      if (!reducedMotion.matches && !document.hidden) timer = window.setTimeout(tick, 1250);
    }
    reducedMotion.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      window.clearTimeout(timer);
      reducedMotion.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [canPrompt]);

  const showExample = canPrompt && Boolean(example);
  return <form className="discovery-search" role="search" onSubmit={event => event.preventDefault()}>
    <Search size={19} aria-hidden="true"/>
    <div className="discovery-search-input" data-show-example={showExample}>
      <input autoComplete="off" aria-label={t('Search by area, development or postcode')}
        placeholder={t(narrow ? 'Area, name or postcode' : 'Search an area, development or postcode')}
        value={query} onChange={event => setQuery(event.target.value)} onFocus={() => {setFocused(true);setExample('');}}
        onBlur={() => setFocused(false)}/>
      {showExample && <span className="discovery-search-example" aria-hidden="true"><bdi>{example}</bdi></span>}
    </div>
    {query && <button type="button" className="clear-search" aria-label={t('Clear search')} onClick={() => setQuery('')}><X size={15}/></button>}
  </form>;
}
