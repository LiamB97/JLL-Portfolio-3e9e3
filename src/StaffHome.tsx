import {useEffect,useState} from 'react';
import {ArrowRight,ClipboardCheck,FileText,Link,Star,Camera,LockKeyhole} from 'lucide-react';
import type {ReviewWorkspace} from './StaffDevelopmentReviews';
import {YourFirstHomeShortcut} from './StaffYourFirstHome';
import type {StaffRequest,StaffUser} from './staff-types';
export default function StaffHome({user,navigate,request}:{user:StaffUser;navigate:(tab:string)=>void;request:StaffRequest}){
 const [reviews,setReviews]=useState<ReviewWorkspace['reviews']>([]);
 useEffect(()=>{
  let active=true;
  void request('development-reviews',undefined,'GET').then((data:ReviewWorkspace)=>{
   if(active)setReviews(data.reviews.filter(review=>review.assigneeId===user.id));
  }).catch(()=>{if(active)setReviews([]);});
  return ()=>{active=false;};
 },[request,user.id]);
 const needsPrices=reviews.filter(({development})=>development.bedrooms.some(beds=>!development.unitPrices[beds])).length;
 return <section className="staff-section staff-home">
 <YourFirstHomeShortcut user={user} request={request} onOpen={()=>navigate('your-first-home')}/>
 {user.role==='admin'&&<div className="workspace-profile-shortcut"><LockKeyhole size={24} aria-hidden="true"/><div><strong>Buyer access</strong><p>Password protect the portfolio or show only JLL-instructed developments.</p></div><button className="primary" onClick={()=>navigate('buyer-access')}>Manage buyer access <ArrowRight size={16}/></button></div>}
 {reviews.length>0&&<div className="workspace-profile-shortcut workspace-review-shortcut"><ClipboardCheck size={25} aria-hidden="true"/><div><strong>Your development reviews</strong><p>{reviews.length} assigned{user.role!=='broker'&&needsPrices>0&&` · ${needsPrices} with bedroom prices to add`}</p></div><button className="primary" onClick={()=>navigate('reviews')}>Open reviews <ArrowRight size={16}/></button></div>}
 <div className="staff-section-title"><div><p className="eyebrow">Ready for your next buyer</p><h1>What would you like to share?</h1><p>Send the full portfolio, handpick homes for a buyer, or put together a brochure.</p></div></div>{!user.whatsapp&&<div className="workspace-setup"><strong>Add your WhatsApp number first</strong><p>Your buyer links and brochures use this number for viewing enquiries.</p><button className="primary" onClick={()=>navigate('profile')}>Set up my profile <ArrowRight size={15}/></button></div>}<div className="workspace-profile-shortcut"><Camera size={24} aria-hidden="true"/><div><strong>Your profile, your buyer relationship</strong><p>Add or change your photo and WhatsApp details in My profile.</p></div><button onClick={()=>navigate('profile')}>{user.photo?'Edit my profile':'Add my photo'} <ArrowRight size={16}/></button></div><div className="workspace-task-grid">{[
 {id:'collections',Icon:Star,title:'Handpick a collection',copy:'Feature the right developments on a map with your contact details.',action:'Open buyer collections'},
 {id:'brochures',Icon:FileText,title:'Create a PDF brochure',copy:'Add your introduction and notes, then download a brochure to share.',action:'Open brochures'},
 {id:'profile',Icon:Link,title:'Share the full portfolio',copy:'Find your personal buyer link, update your WhatsApp number and add your photo.',action:'Open my profile & link'},
 ].map(({id,Icon,title,copy,action})=><button className="workspace-task" key={id} onClick={()=>navigate(id)}><Icon size={23}/><strong>{title}</strong><span>{copy}</span><b>{action}<ArrowRight size={15}/></b></button>)}</div><div className="workspace-help"><strong>One portfolio, your relationship.</strong><p>Your links keep you as the buyer’s contact. Collections highlight your selection, and buyers can still explore other homes.</p><button onClick={()=>navigate('guide')}>Read the broker guide <ArrowRight size={14}/></button></div></section>;
}
