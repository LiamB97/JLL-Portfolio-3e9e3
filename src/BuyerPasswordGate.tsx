import {useState} from 'react';
import {Eye, EyeOff, LockKeyhole} from 'lucide-react';
import {useLocale} from './i18n';
import type {BuyerLock} from './buyer-access';

export default function BuyerPasswordGate({scope, unlock}: {scope: BuyerLock; unlock: (password: string) => Promise<void>}) {
  const {t} = useLocale();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="buyer-password-gate" aria-labelledby="buyer-password-title">
    <form onSubmit={event => {
      event.preventDefault();
      if (busy || !password.trim()) return;
      setError('');
      setBusy(true);
      void unlock(password).then(() => setPassword(''))
        .catch(error => setError(error instanceof Error ? error.message : 'Unable to open this link. Please try again.'))
        .finally(() => setBusy(false));
    }}>
      <LockKeyhole size={26} aria-hidden="true"/>
      <h1 id="buyer-password-title">{t(scope === 'collection' ? 'Your private collection' : 'JLL Residential portfolio')}</h1>
      <p>{t('Enter the password your JLL consultant shared with you.')}</p>
      <label htmlFor="buyer-password">{t('Password')}</label>
      <div className="buyer-password-field">
        <input id="buyer-password" dir="ltr" type={visible ? 'text' : 'password'} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          required maxLength={24} value={password} onChange={event => setPassword(event.target.value)}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'buyer-password-error' : undefined}/>
        <button type="button" aria-label={t(visible ? 'Hide password' : 'Show password')} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
        </button>
      </div>
      {error && <p id="buyer-password-error" role="alert">{t(error)}</p>}
      <button type="submit" className="primary" disabled={busy || !password.trim()}>
        {t(busy ? 'Unlocking…' : scope === 'collection' ? 'Unlock collection' : 'Unlock portfolio')}
      </button>
    </form>
  </main>;
}
