import StaffHome from './StaffHome';
import StaffNavigation from './StaffNavigation';
import './workspace-overview.css';
import {workspaceGroups,workspaceStartTab} from './workspace';
import {canManagePortfolioStock,canReviewDevelopments,canUseBuyerTools} from '../shared/staff-roles';
import StaffBrochures from './StaffBrochures';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,LockKeyhole} from 'lucide-react';
import PendingInput from './PendingInput';
import DevelopmentManager from './Admin';
import StaffCollections from './StaffCollections';
import StaffYourFirstHome from './StaffYourFirstHome';
import StaffGuide from './StaffGuide';
import StaffAnalytics from './StaffAnalytics';
import StaffActivity from './StaffActivity';
import StaffBuyerAccess from './StaffBuyerAccess';
import StaffDevelopmentReviews from './StaffDevelopmentReviews';
import BrokerProfile from './BrokerProfile';
import StaffUsers from './StaffUsers';
import type {Development} from './types';
import type {StaffUser,StaffRequest} from './staff-types';
const staffStartTab=(role?:StaffUser['role'])=>workspaceStartTab(location.search,role);
export default function StaffPortal(){
 const [user,setUser]=useState<StaffUser|null>(null),[csrf,setCsrf]=useState(''),[ready,setReady]=useState(false),[status,setStatus]=useState({setupRequired:false,setupConfigured:false}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState(staffStartTab),[visited,setVisited]=useState<string[]>(()=>[staffStartTab()]),[privateItems,setPrivateItems]=useState<Development[]>([]);
 const buyerTools=!!user&&canUseBuyerTools(user.role), stockTools=!!user&&canManagePortfolioStock(user.role);
 const content=useRef<HTMLDivElement>(null), focusSection=useRef(false);
 useEffect(()=>{
  if(!focusSection.current||!content.current)return;
  focusSection.current=false;
  const heading=Array.from(content.current.querySelectorAll<HTMLElement>('h1,h2')).find(node=>!node.closest('[hidden]'));
  const target=heading??content.current;
  target.tabIndex=-1;
  target.focus({preventScroll:true});
 },[tab]);
 const [whatsapp,setWhatsapp]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[setupSecret,setSetupSecret]=useState(''),[invite,setInvite]=useState(()=>{try{return location.hash.startsWith('#invite=')?decodeURIComponent(location.hash.slice(8)):'';}catch{return '';}});
 useEffect(()=>{void Promise.all([fetch('/api/access/status').then(r=>r.json()).then(setStatus),fetch('/api/access/me').then(async r=>{if(r.ok){const d=await r.json();setUser(d.user);setCsrf(d.csrf);const start=staffStartTab(d.user.role);setTab(start);setVisited([start]);}})]).catch(()=>setMessage('Unable to load staff access. Please refresh.')).finally(()=>setReady(true));},[]);
 const request:StaffRequest=useCallback(async(route,body,method='POST')=>{const r=await fetch('/api/admin/'+route,{method,credentials:'same-origin',keepalive:route==='activity',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await r.json();if(r.status===401){setUser(null);setCsrf('');}if(!r.ok)throw Error(data.error||'Request failed.');return data;},[csrf]);
 const refreshPrivate=useCallback(async()=>{if(buyerTools)setPrivateItems(await request('developments',undefined,'GET'));},[buyerTools,request]);
 useEffect(()=>{void refreshPrivate().catch(e=>setMessage(e.message));},[refreshPrivate]);
 useEffect(()=>{if(!user||!csrf)return;let lastInteraction=Date.now();const interaction=()=>{lastInteraction=Date.now();};const ping=()=>{if(document.visibilityState==='visible'&&Date.now()-lastInteraction<5*60000)void request('heartbeat',{}).catch(()=>{});};ping();const timer=window.setInterval(ping,5*60000);document.addEventListener('pointerdown',interaction,{passive:true});document.addEventListener('keydown',interaction);document.addEventListener('scroll',interaction,{passive:true,capture:true});document.addEventListener('visibilitychange',ping);return()=>{clearInterval(timer);document.removeEventListener('pointerdown',interaction);document.removeEventListener('keydown',interaction);document.removeEventListener('scroll',interaction,true);document.removeEventListener('visibilitychange',ping);};},[user?.id,csrf,request]);
 async function authenticate(){setBusy(true);setMessage('');try{const mode=invite?'accept':status.setupRequired?'bootstrap':'login';const body=mode==='accept'?{token:invite,password,email,whatsapp}:mode==='bootstrap'?{name,email,password,setupSecret,whatsapp}:{email,password};const r=await fetch('/api/access/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Sign-in failed.');setUser(d.user);setCsrf(d.csrf);const start=staffStartTab(d.user.role);setTab(start);setVisited([start]);setPassword('');setSetupSecret('');setInvite('');setStatus(s=>({...s,setupRequired:false}));location.hash='#admin';}catch(e){setMessage(e instanceof Error?e.message:'Sign-in failed.');}finally{setBusy(false);}}
 async function logout(){setBusy(true);try{const r=await fetch('/api/access/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});if(!r.ok&&r.status!==401)throw Error('Sign-out failed. Please retry.');setUser(null);setCsrf('');setPrivateItems([]);setMessage('Signed out.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to sign out.');}finally{setBusy(false);}}
 function navigate(next:string){if(!user||!workspaceGroups(user.role).some(g=>g.items.some(i=>i.id===next)))return;focusSection.current=tab!==next;setTab(next);setVisited(old=>old.includes(next)?old:[...old,next]);window.scrollTo({top:0,behavior:'instant'});}
 if(!ready)return <main className="staff-portal"><p role="status">Loading staff access…</p></main>;
 return <main className={user&&!invite?"staff-portal staff-workspace":"staff-portal"}>{!user||invite?<><a className="back-link" href="#"><ArrowLeft size={16}/> Back to portfolio</a><p className="eyebrow">JLL Residential · Staff access</p><form className="staff-login" onSubmit={e=>{e.preventDefault();void authenticate();}}><LockKeyhole size={25}/><h1>{invite?'Accept your invitation':status.setupRequired?'Set up your owner account':'Welcome back'}</h1><p>{invite?'Choose a password to activate your staff account.':status.setupRequired?'Create the first administrator account. You can then invite brokers and manage their access.':'Sign in to access your workspace.'}</p>{status.setupRequired&&!invite&&!status.setupConfigured&&<div className="owner-setup-note"><strong>One Netlify setting is needed first</strong><ol><li>Open this project in Netlify and choose <b>Environment variables</b>.</li><li>Add <b>ADMIN_PASSWORD</b> with a private code of at least 12 characters. Include the Functions scope, or leave all scopes selected.</li><li>Redeploy the site, return here and refresh.</li></ol><p>You’ll use that code once to create your owner account. Don’t share it with brokers.</p></div>}{status.setupRequired&&!invite&&<><label>Your full name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label><label>Owner setup code<input required type="password" autoComplete="off" value={setupSecret} onChange={e=>setSetupSecret(e.target.value)}/></label></>}{<label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>}{(invite||status.setupRequired)&&<label>WhatsApp number<input aria-label="WhatsApp number" required={!invite} type="tel" autoComplete="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+447900123456"/><small>{invite?'Include your country code when setting up a buyer-facing account. Development consultants can leave this blank.':'Include your country code. Your number appears on buyer links created from your account.'}</small></label>}<label>{invite||status.setupRequired?'Choose your account password':'Password'}<input required type="password" minLength={invite||status.setupRequired?12:undefined} maxLength={128} autoComplete={invite||status.setupRequired?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy||(status.setupRequired&&!status.setupConfigured&&!invite)}>{invite?'Activate account':status.setupRequired?'Create owner account':'Sign in'}</button>{!invite&&!status.setupRequired&&<p className="muted">Need a password reset? Ask your administrator for a new invitation link.</p>}</form></>:<>
 <div className="staff-workspace-layout">
  <StaffNavigation user={user} tab={tab} navigate={navigate} signOut={()=>void logout()} busy={busy}/>
  <div className="workspace-content" key={user.id} ref={content}>
 {tab==='home'&&<StaffHome user={user} navigate={navigate} request={request}/>}
 {visited.includes('profile')&&<div hidden={tab!=='profile'}>{buyerTools
  ? <BrokerProfile user={user} request={request} updated={setUser} active={tab==='profile'}/>
  : <section className="broker-share-panel"><h1>My profile</h1><p><strong>{user.name}</strong></p><p>{user.email}</p><p>Development consultant</p></section>}</div>}
 {tab==='guide'&&<StaffGuide request={request} onNavigate={navigate} role={user.role}/>}
 {tab==='reviews'&&(user.role==='admin'||canReviewDevelopments(user.role))&&<StaffDevelopmentReviews request={request} user={user} onStockChange={refreshPrivate}/>}
 {tab==='activity'&&user.role==='admin'&&<StaffActivity request={request}/>}
 {tab==='analytics'&&user.role==='admin'&&<StaffAnalytics request={request}/>}
 {tab==='buyer-access'&&user.role==='admin'&&<StaffBuyerAccess request={request}/>}
 {buyerTools&&visited.includes('brochures')&&<div hidden={tab!=='brochures'}><StaffBrochures onProfile={()=>navigate('profile')} active={tab==='brochures'} items={privateItems} user={user} request={request}/></div>}
 {buyerTools&&visited.includes('collections')&&<div hidden={tab!=='collections'}><StaffCollections user={user} onCampaign={()=>navigate('your-first-home')} active={tab==='collections'} items={privateItems} request={request}/></div>}
 {buyerTools&&tab==='your-first-home'&&<StaffYourFirstHome user={user} request={request}/>}
 {stockTools&&visited.includes('developments')&&<div hidden={tab!=='developments'}><DevelopmentManager items={privateItems} user={user} request={request} onChange={refreshPrivate}/></div>}
 {stockTools&&visited.includes('pending')&&<div hidden={tab!=='pending'}><PendingInput items={privateItems} user={user} request={request} onChange={refreshPrivate}/></div>}
 {buyerTools&&tab==='users'&&<StaffUsers request={request} current={user}/>}
 </div></div><details className="workspace-privacy"><summary>About workspace activity</summary><p>Administrators can review staff sign-ins, workspace activity, link copies and share-button clicks. Buyer engagement is anonymous and requires the buyer’s analytics consent.</p></details></>}{message&&<p className="admin-message" role="status">{message}</p>}</main>;
}
