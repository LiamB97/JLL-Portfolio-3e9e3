import {useEffect, useState} from 'react';
import {ArrowRight, ArrowUpRight, ClipboardCheck, Copy, FileText, FolderOpen, Link, LockKeyhole} from 'lucide-react';
import {canReviewDevelopments, canUseBuyerTools} from '../shared/staff-roles';
import {personalPortfolioLink} from './sharing';
import type {ReviewWorkspace} from './StaffDevelopmentReviews';
import {YourFirstHomeShortcut} from './StaffYourFirstHome';
import type {StaffRequest, StaffUser} from './staff-types';

const reviewDate = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', timeZone:'Europe/London'});
const needsPrices = (development: ReviewWorkspace['reviews'][number]['development']) =>
  development.bedrooms.some(beds => !development.unitPrices[beds]);

export default function StaffHome({user, navigate, request}: {
  user: StaffUser;
  navigate: (tab: string) => void;
  request: StaffRequest;
}) {
  const [reviews, setReviews] = useState<ReviewWorkspace['reviews'] | null>(null);
  const [reviewError, setReviewError] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const buyerTools = canUseBuyerTools(user.role);
  const reviewTools = canReviewDevelopments(user.role);
  const portfolioLink = buyerTools && user.whatsapp ? personalPortfolioLink(location.origin, user.shareSlug) : '';

  useEffect(() => {
    let active = true;
    if (reviewTools) {
      void request('development-reviews', undefined, 'GET').then((data: ReviewWorkspace) => {
        if (!active) return;
        setReviewError(false);
        setReviews([...data.reviews].sort((a, b) =>
          a.nextReminderAt - b.nextReminderAt || a.development.name.localeCompare(b.development.name)));
      }).catch(() => {if (active) setReviewError(true);});
    }
    if (portfolioLink) {
      void request('buyer-access/mine', undefined, 'GET').then(({password}) => {
        if (active) setPasswordRequired(Boolean(password));
      }).catch(() => {});
    }
    return () => {active = false;};
  }, [request, user.id, portfolioLink, reviewTools]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(portfolioLink);
      setShareMessage('Portfolio link copied.');
      void request('activity', {event:'personal_link_copy'}).catch(() => {});
    } catch {
      setShareMessage('Open My profile to select and copy the link.');
    }
  }

  const now = Date.now();
  const due = reviews?.filter(review => review.nextReminderAt <= now).length ?? 0;
  const missingPrices = reviews?.filter(({development}) => needsPrices(development)).length ?? 0;

  return <section className="staff-section staff-home">
    <header className="workspace-home-heading"><h1>Overview</h1></header>
    <div className={buyerTools ? 'workspace-home-grid' : 'workspace-home-grid workspace-home-grid-reviews'}>
      <div className="workspace-work">
        {buyerTools && <section className="workspace-creation" aria-labelledby="workspace-tools-title">
          <header className="workspace-section-heading"><h2 id="workspace-tools-title">Buyer materials</h2></header>
          <div className="workspace-tool-tiles">
            <button className="workspace-task" onClick={() => navigate('collections')}>
              <span className="workspace-task-icon"><FolderOpen size={22} aria-hidden="true"/></span>
              <span className="workspace-task-copy"><strong>Buyer collections</strong>Create and manage buyer shortlists.</span>
              <ArrowRight size={18} aria-hidden="true"/>
            </button>
            <button className="workspace-task" onClick={() => navigate('brochures')}>
              <span className="workspace-task-icon"><FileText size={22} aria-hidden="true"/></span>
              <span className="workspace-task-copy"><strong>PDF brochures</strong>Create or reopen a branded brochure.</span>
              <ArrowRight size={18} aria-hidden="true"/>
            </button>
          </div>
        </section>}
        {reviewTools && <section className="workspace-review-summary" aria-labelledby="workspace-review-title">
          <header className="workspace-section-heading">
            <h2 id="workspace-review-title"><ClipboardCheck size={18} aria-hidden="true"/>Development reviews</h2>
            <button onClick={() => navigate('reviews')}>Open reviews <ArrowRight size={15}/></button>
          </header>
          {reviewError ? <p role="status">Open Development reviews to reload your assignments.</p>
          : !reviews ? <p role="status">Loading your assignments…</p>
          : reviews.length === 0 ? <p>No developments are assigned to you.</p>
          : <>
            <dl className="workspace-review-stats">
              <div><dt>Assigned to you</dt><dd>{reviews.length}</dd></div>
              <div><dt>Due now</dt><dd className={due>0?'review-stat-due':undefined}>{due}</dd></div>
              <div><dt>Need bedroom prices</dt><dd>{missingPrices}</dd></div>
            </dl>
            <table className="workspace-review-table" aria-labelledby="workspace-review-title">
              <thead><tr><th scope="col">Development</th><th scope="col">Bedroom prices</th><th scope="col">Review due</th></tr></thead>
              <tbody>
                {reviews.slice(0, 3).map(({development, nextReminderAt}) => <tr key={development.id}>
                  <th scope="row"><strong>{development.name}</strong><small>{development.area} · {development.postcode}</small></th>
                  <td>{development.bedrooms.length ? needsPrices(development)?'To add':'Added' : '—'}</td>
                  <td><span className={nextReminderAt <= now ? 'workspace-review-due' : undefined}>
                    {nextReminderAt <= now ? 'Due now' : reviewDate.format(nextReminderAt)}
                  </span></td>
                </tr>)}
              </tbody>
            </table>
          </>}
        </section>}
      </div>
      {buyerTools && <aside className="workspace-home-aside" aria-labelledby="workspace-share-heading">
        <h2 id="workspace-share-heading">Sharing</h2>
        <section className="workspace-personal-link" aria-labelledby="workspace-link-title">
          <h3 id="workspace-link-title"><Link size={17} aria-hidden="true"/>Your personal portfolio link</h3>
          <p>{portfolioLink ? 'Buyer enquiries go to your WhatsApp.' : 'Add a WhatsApp number to start sharing.'}</p>
          <div className="workspace-link-actions">
            {portfolioLink ? <>
              <button className="primary" onClick={() => void copyLink()}><Copy size={15}/>Copy portfolio link</button>
              <a href={portfolioLink} target="_blank" rel="noopener noreferrer">Preview buyer link <ArrowUpRight size={15}/></a>
            </> : <button className="primary" onClick={() => navigate('profile')}>Set up my profile <ArrowRight size={15}/></button>}
          </div>
          {portfolioLink && passwordRequired && <div className="workspace-password-note">
            <LockKeyhole size={15} aria-hidden="true"/>
            <div><p>Portfolio password required.</p><button onClick={() => navigate('profile')}>Get it in My profile <ArrowRight size={14}/></button></div>
          </div>}
          {shareMessage && <p role="status" className="workspace-link-status">{shareMessage}</p>}
        </section>
        <YourFirstHomeShortcut user={user} request={request} onOpen={() => navigate('your-first-home')}/>
        {user.role === 'admin' && <section className="workspace-aside-card">
          <h3><LockKeyhole size={17} aria-hidden="true"/>Buyer access</h3>
          <p>Manage portfolio passwords and choose which developments buyers see.</p>
          <button onClick={() => navigate('buyer-access')}>Manage buyer access <ArrowRight size={16}/></button>
        </section>}
      </aside>}
    </div>
  </section>;
}
