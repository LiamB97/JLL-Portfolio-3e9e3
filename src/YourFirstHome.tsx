import {useState} from 'react';
import {Calculator,LocateFixed,ArrowUpRight,Info} from 'lucide-react';
import Modal from './Modal';
import WhatsAppIcon from './WhatsAppIcon';
import {buyerShareLink} from './sharing';
import {startingPrice} from '../shared/pricing';
import {YOUR_FIRST_HOME_NOTICE,YOUR_FIRST_HOME_GUIDANCE,YOUR_FIRST_HOME_CAPS,yourFirstHomeCaps,yourFirstHomeIllustration} from '../shared/your-first-home';
import {money,type BrokerCard,type Development} from './types';

export function yourFirstHomeContact(broker:BrokerCard,development?:string) {
 const message=development?`Hi Your First Home team, I’m interested in ${development}. Could you confirm availability, prices and whether any homes may qualify for Your First Home?`:'Hi Your First Home team, I’d like to find out about potential homes, scheme participation and arranging a viewing.';
 return 'https://wa.me/'+broker.whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent(message+'\n'+buyerShareLink(location.href));
}

export function YourFirstHomeBar({broker,onExplore,onInformation,onContact,count}:{broker:BrokerCard|null;onExplore:()=>void;onInformation:()=>void;onContact:()=>void;count:number}) {
 return <section className="yfh-collection-bar" aria-label="Your First Home collection">
  <div className="yfh-collection-identity"><img src="/images/your-first-home-logo.png" alt="Your First Home" width={44} height={55}/><div><p className="yfh-eyebrow">Your first step, your new home</p><strong>Your First Home</strong><span>{count} potential developments</span></div></div>
  <p className="yfh-participation-note"><Info size={16} aria-hidden="true"/><span>Scheme participation is unconfirmed.<span className="yfh-notice-extra"> Individual homes must meet the local price cap and all scheme requirements.</span></span></p>
  <div className="yfh-collection-actions"><button onClick={onExplore} aria-label="View candidate homes"><LocateFixed size={17}/><span>View homes</span></button><button onClick={onInformation}><Calculator size={17}/><span>Calculator & FAQs</span></button>{broker&&<a className="yfh-whatsapp" href={yourFirstHomeContact(broker)} target="_blank" rel="noopener noreferrer" onClick={onContact} aria-label="Speak to our Your First Home team on WhatsApp"><WhatsAppIcon size={18}/><span>WhatsApp</span></a>}</div>
 </section>;
}

export function YourFirstHomeNotice({development}:{development:Development}) {
 if(!development.yourFirstHome)return null;
 return <aside className="yfh-development-notice"><Info size={20} aria-hidden="true"/><div><strong>Potential Your First Home development</strong><p>Scheme participation is unconfirmed. {development.yourFirstHome.priceCap&&<>The local home price cap is {money(development.yourFirstHome.priceCap)}. </>}Only qualifying individual homes could be included; not every bedroom type or home at this development will qualify. Ask our team for the latest position.</p></div></aside>;
}

export function YourFirstHomeInformation({items,broker,close}:{items:Development[];broker:BrokerCard|null;close:()=>void}) {
 const [home,setHome]=useState(''),[borough,setBorough]=useState(items[0]?.yourFirstHome?.borough||'Tower Hamlets');
 const [price,setPrice]=useState(400000),[depositPercent,setDepositPercent]=useState(2.5);
 const illustration=yourFirstHomeIllustration(price,depositPercent),cap=yourFirstHomeCaps[borough];
 const pickHome=(id:string)=>{setHome(id);const d=items.find(item=>item.id===id);if(d){setPrice(startingPrice(d)??400000);setBorough(d.yourFirstHome?.borough||borough);}};
 const faq=[
  ['Are these developments confirmed for the scheme?',YOUR_FIRST_HOME_NOTICE],
  ['Which homes could qualify?','The home must be a qualifying new build in England, offered by a participating developer and priced within the applicable local authority cap. A development appearing here does not confirm participation or that every home within it qualifies.'],
  ['Who is the scheme intended for?','First-time buyers purchasing their main home, with household income of up to £140,000 in London or £110,000 elsewhere. Participating lenders will carry out their own affordability and credit checks. Full eligibility rules are still to be published.'],
  ['How does the equity loan work?','The published outline combines a deposit of at least 2.5%, a 20% government equity loan and a repayment mortgage. The equity loan is interest-free for five years, with interest at 1.5% in year six and 3% from year seven. Interest does not repay the loan. The amount repaid is normally linked to the home’s value and may rise or fall.'],
  ['When could I apply?','Government guidance currently expects applications to open in February 2027. Further information on participating developers, lenders and the full rules is due before launch. Our team can explain the latest position.'],
 ];
 return <Modal title="Your First Home · Calculator & FAQs" close={close} className="yfh-information" doneLabel="Back to homes">
  <div className="yfh-information-intro"><img src="/images/your-first-home-logo.png" alt="Your First Home" width={48} height={60}/><p>Explore a potential first home. Scheme participation is unconfirmed, and individual homes and buyers must meet the full eligibility rules.</p></div>
  <section className="yfh-calculator" aria-labelledby="yfh-calculator-title"><p className="yfh-eyebrow">Explore the possibilities</p><h3 id="yfh-calculator-title">What would you need to buy?</h3>
   <div className="yfh-calculator-fields"><label>Start with a development<select value={home} onChange={e=>pickHome(e.target.value)}><option value="">Choose a home or explore a budget</option>{[...items].sort((a,b)=>(startingPrice(a)??Infinity)-(startingPrice(b)??Infinity)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
   <label className="yfh-price-control"><span>Home price <strong>{money(price)}</strong></span><input type="range" min={100000} max={800000} step={50} value={price} onChange={e=>{setHome('');setPrice(Number(e.target.value));}} aria-valuetext={money(price)}/></label>
   <p className={'yfh-cap-check'+(price>cap?' over-cap':'')} role="status">{price<=cap?`Within the ${money(cap)} price cap for ${borough}. Participation and buyer eligibility still need confirmation.`:`Above the ${money(cap)} price cap for ${borough}. A home at this price would not meet the local price cap.`}</p>
   {illustration&&<><dl className="yfh-funding" aria-live="polite"><div><dt>Your deposit</dt><dd>{money(illustration.deposit)}</dd></div><div><dt>Government equity loan <small>20%</small></dt><dd>{money(illustration.equityLoan)}</dd></div><div><dt>Repayment mortgage</dt><dd>{money(illustration.mortgage)}</dd></div></dl><div className="yfh-monthly"><h4>Illustrative monthly costs</h4><dl><div><dt>Years 1–5</dt><dd>{money(illustration.monthlyMortgage)}</dd></div><div><dt>Year 6</dt><dd>{money(illustration.yearSix)}</dd></div><div><dt>From year 7</dt><dd>{money(illustration.yearSeven)}</dd></div></dl></div></>}
   <details className="yfh-calculator-options"><summary>Change area or deposit <small>{borough} · {depositPercent}% deposit</small></summary><label>Local authority<select value={borough} onChange={e=>{setHome('');setBorough(e.target.value);}}>{Object.keys(yourFirstHomeCaps).sort().map(name=><option key={name}>{name}</option>)}</select></label><label className="yfh-price-control"><span>Your deposit <strong>{depositPercent}%</strong></span><input type="range" min={2.5} max={20} step={.5} value={depositPercent} onChange={e=>setDepositPercent(Number(e.target.value))} aria-valuetext={depositPercent+' percent'}/></label></details>
   <p className="yfh-calculator-assumptions">Illustrative only, assuming a 30-year repayment mortgage at 5%, with no equity loan repayment. Includes the published equity loan interest rates, but excludes fees, insurance, council tax, service charges and other ownership costs. This is not a mortgage offer or an affordability assessment. JLL does not provide mortgage advice. Figures are calculated in your browser and are not saved.</p>
  </section>
  <section className="yfh-faqs" aria-labelledby="yfh-faq-title"><h3 id="yfh-faq-title">Your questions, answered</h3>{faq.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
  <p className="yfh-guidance">Based on guidance updated 3 November 2026. Terms may change. <a href={YOUR_FIRST_HOME_GUIDANCE} target="_blank" rel="noopener noreferrer">Read government guidance <ArrowUpRight size={13}/></a><a href={YOUR_FIRST_HOME_CAPS} target="_blank" rel="noopener noreferrer">Check local price caps <ArrowUpRight size={13}/></a></p>
  {broker&&<a className="yfh-whatsapp yfh-team-cta" href={yourFirstHomeContact(broker)} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={19}/>Speak to our Your First Home team</a>}
 </Modal>;
}
