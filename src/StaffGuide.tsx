import {useEffect,useState} from 'react';
import {BookOpen,ArrowRight} from 'lucide-react';
import {canManagePortfolioStock,canReviewDevelopments,canUseBuyerTools,type StaffRole} from '../shared/staff-roles';
import type {StaffRequest} from './staff-types';

interface Guide {
  title:string;
  chapters:{id:string;title:string;steps:string[]}[];
  faqs?:{id:string;question:string;answer:string}[];
}

export default function StaffGuide({request,onNavigate,role}: {
  request:StaffRequest;
  onNavigate:(tab:string)=>void;
  role:StaffRole;
}) {
  const [guide,setGuide] = useState<Guide|null>(null), [error,setError] = useState('');
  const buyerTools = canUseBuyerTools(role);
  useEffect(()=>{
    let active=true;
    void request('guide',undefined,'GET').then(data=>{if(active)setGuide(data);})
      .catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[request]);
  if(error)return <p role="alert">{error}</p>;
  if(!guide)return <p role="status">Loading your staff guide…</p>;
  return <section className="staff-section staff-guide">
    <p className="eyebrow"><BookOpen size={16}/> Staff guide</p>
    <h1>{guide.title}</h1>
    <div className="guide-quick-links action-row">
      {buyerTools&&<>
        <button onClick={()=>onNavigate('collections')}>Create a buyer collection <ArrowRight size={14}/></button>
        <button onClick={()=>onNavigate('your-first-home')}>Your First Home <ArrowRight size={14}/></button>
      </>}
      {(role==='admin'||canReviewDevelopments(role))&&<button onClick={()=>onNavigate('reviews')}>
        {role==='admin'?'Review assignments':'Open development reviews'} <ArrowRight size={14}/>
      </button>}
      {canManagePortfolioStock(role)&&<button onClick={()=>onNavigate('developments')}>Manage developments <ArrowRight size={14}/></button>}
      {buyerTools&&<a className="back-link" href="/#how-it-works" target="_blank" rel="noopener noreferrer">Buyer FAQs <ArrowRight size={14}/></a>}
    </div>
    {Boolean(guide.faqs?.length)&&<section className="guide-faq" aria-labelledby="staff-faq-title">
      <h2 id="staff-faq-title">Workspace FAQs</h2>
      {guide.faqs?.map(faq=><details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
    </section>}
    <div className="guide-chapters">
      {guide.chapters.map(chapter=><article className="guide-chapter" key={chapter.id}>
        <h2>{chapter.title}</h2>
        <ol>{chapter.steps.map(step=><li key={step}>{step}</li>)}</ol>
      </article>)}
    </div>
  </section>;
}
