import {startingPrice,unitLabel} from '../shared/pricing.ts';
import {jsPDF} from 'jspdf';
import QRCode from 'qrcode';
import {layoutBrochureMap,type BrochureMapImage} from './brochure-map-layout.ts';
import type {Development} from './types';

export interface BrochureInput {title:string;intro:string;notes:Record<string,string>;items:Development[];broker:{name:string;whatsapp:string;photo?:string;title?:string;email?:string};origin:string;collection?:string;brokerSlug?:string;date?:Date;coverImage?:string}
export interface BrochureAssets {regular:string;semibold:string;light?:string;serifItalic?:string;logoLight?:string;logoDark?:string;whatsappIcon?:string;photos:Record<string,string>;galleries?:Record<string,string[]>;map?:BrochureMapImage;developmentLogos?:Record<string,string>;fadedCover?:string;fadedPhotos?:Record<string,string>}
export function brochureFilename(title:string){return (title.normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,70)||'JLL-brochure')+'.pdf';}
export function brochureDevelopmentName(name:string){
 if(/^opus\b/i.test(name)&&/bankside/i.test(name))return 'Opus, Bankside Yards';
 if(/^seven(?:\b|,)/i.test(name)&&(/southbank/i.test(name)||/^seven$/i.test(name.trim())))return 'SEVEN, Southbank Place';
 return name.replace(/\bnew homes\b/gi,'New Homes');
}
export function brochureIntroduction(description:string){const paragraphs=description.split(/\n+/).map(s=>s.trim()).filter(Boolean);const text=paragraphs.find(s=>s.length>60&&!/^(?:book\b|contact\b|register\b|enquire\b|request\b|call\s|email\s|please\b)/i.test(s))||paragraphs.find(s=>!/^(?:book\b|contact\b|register\b|enquire\b)/i.test(s))||'';return text.match(/^.+?[.!?](?:\s|$)/)?.[0].trim()||text;}
const clean=(value:string)=>String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[\u2010-\u2015]/g,'-').replace(/\u00a0/g,' ').replace(/\bnew homes\b/gi,'New Homes');
const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const price=(n:number|null|undefined)=>n&&Number.isFinite(n)&&n>0?'From '+money(n):'From £[ ]';
const C={midnight:'#131E29',sand:'#E0C6AD',white:'#FFFFFF',space:'#003E51',card:'#1F2A35',border:'#6B7783',green:'#25D366'};
const M=14,W=182,MM=25.4/72;
export const coverHeroHeight=(intro:string)=>intro.trim().length>650?116:136;
export const developmentHeroHeight=(note?:string)=>note?.trim()?88:108;

export function buildBrochure(input:BrochureInput,assets:BrochureAssets){
 if(!input.title.trim()||input.items.length<1||input.items.length>20)throw Error('Choose 1–20 developments and add a title.');
 if(assets.map&&input.items.some(d=>!assets.map!.points.some(p=>p.id===d.id)))throw Error('The location map does not match the selected developments. Generate it again.');
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 for(const [file,weight,data]of [['Regular','normal',assets.regular],['Semibold','bold',assets.semibold],['Light','light',assets.light||assets.regular]]){doc.addFileToVFS('SourceSans'+file+'.ttf',data!);doc.addFont('SourceSans'+file+'.ttf','SourceSans',weight!);}
 if(assets.serifItalic){doc.addFileToVFS('SourceSerifLightItalic.ttf',assets.serifItalic);doc.addFont('SourceSerifLightItalic.ttf','SourceSerif','italic');}
 const warnings=new Set<string>(),date=(input.date||new Date()).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
 const portfolio=new URL('/',input.origin);if(input.collection)portfolio.searchParams.set('collection',input.collection);else if(input.brokerSlug)portfolio.searchParams.set('broker',input.brokerSlug);
 const whatsapp='https://wa.me/'+input.broker.whatsapp.replace(/\D/g,''),tel='tel:'+input.broker.whatsapp.replace(/[^+\d]/g,'');
 const devLink=(id:string)=>{const url=new URL(portfolio);url.searchParams.set('development',id);return url.href;};
 function style(size=12,weight='light',colour=C.white,opacity=1){doc.setGState(doc.GState({opacity,'stroke-opacity':1}));doc.setFont('SourceSans',weight);doc.setFontSize(size);doc.setTextColor(colour);doc.setCharSpace(0);}
 function serif(size=16,colour=C.sand){style(size,'light',colour);if(assets.serifItalic)doc.setFont('SourceSerif','italic');else doc.setFont('times','italic');}
 function page(){doc.addPage();background();}
 function background(){style();doc.setFillColor(C.midnight);doc.rect(0,0,210,297,'F');}
 function fit(value:string,width:number,size:number,maxLines:number,weight='light',label?:string,min=size){
  let lines:string[]=[];for(;size>=min;size-=.5){style(size,weight);lines=doc.splitTextToSize(clean(value).replace(/\s+/g,' ').trim(),width);if(lines.length<=maxLines)break;}size=Math.max(size,min);
  if(lines.length>maxLines){if(label)warnings.add(label);lines=lines.slice(0,maxLines);style(size,weight);let last=lines.at(-1)||'';while(last&&doc.getTextWidth(last+'…')>width)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
  return {lines,size};
 }
 function block(value:string,x:number,y:number,width:number,size:number,maxLines:number,{weight='light',colour=C.white,leading=1.5,label,opacity=1}:{weight?:string;colour?:string;leading?:number;label?:string;opacity?:number}={}){
  const text=fit(value,width,size,Math.max(1,maxLines),weight,label);style(size,weight,colour,opacity);doc.text(text.lines,x,y,{lineHeightFactor:leading});return y+text.lines.length*size*MM*leading;
 }
 function logo(x=M,y=279,width=48){style();const img=assets.logoDark;if(img)doc.addImage(img,'PNG',x,y,width,width*94.065/517.30957);else{style(16,'bold');doc.text('JLL Residential',x,y+6);}}
 function footer(){logo();style(9,'light',C.white,.65);doc.text(String(doc.getNumberOfPages()),196,287,{align:'right'});}
 function image(image:string,x:number,y:number,w:number,h:number){const p=doc.getImageProperties(image),scale=Math.max(w/p.width,h/p.height);doc.saveGraphicsState();doc.rect(x,y,w,h,null);doc.clip();doc.discardPath();doc.addImage(image,'JPEG',x+(w-p.width*scale)/2,y+Math.min(0,(h-p.height*scale)*.3),p.width*scale,p.height*scale,undefined,'MEDIUM');doc.restoreGraphicsState();}
 // A true photo-to-Midnight fade, restricted to the photograph behind the headline.
 function photoFade(top:number,bottom:number){for(let y=top;y<bottom;y+=.2){const opacity=Math.pow((y-top)/(bottom-top),1.15);doc.setGState(doc.GState({opacity}));doc.setFillColor(C.midnight);doc.rect(0,y,210,Math.min(.2,bottom-y),'F');}doc.setGState(doc.GState({opacity:1}));}
 function portrait(x:number,y:number,r:number){doc.setFillColor(C.sand);doc.circle(x,y,r,'F');if(input.broker.photo){doc.saveGraphicsState();doc.circle(x,y,r-.3,null);doc.clip();doc.discardPath();doc.addImage(input.broker.photo,'JPEG',x-r+.3,y-r+.3,(r-.3)*2,(r-.3)*2,undefined,'MEDIUM');doc.restoreGraphicsState();}else{style(r*.95,'light',C.midnight);doc.text(input.broker.name.split(/\s+/).map(s=>s[0]).slice(0,2).join(''),x,y+r*.13,{align:'center'});}}
 function qr(url:string,x:number,y:number,size:number){const code=QRCode.create(url,{errorCorrectionLevel:'M'}),n=code.modules.size,step=size/(n+8);style();doc.setFillColor(C.white);doc.rect(x,y,size,size,'F');doc.setFillColor(C.midnight);for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(code.modules.get(row,col))doc.rect(x+(col+4)*step,y+(row+4)*step,step+.01,step+.01,'F');doc.link(x,y,size,size,{url});}
 function pin(x:number,y:number,n:number,scale=1){
  const shape=(x:number,y:number)=>[{op:'m',c:[x,y]},{op:'c',c:[x-scale,y-1.5*scale,x-4*scale,y-4.2*scale,x-4*scale,y-6*scale]},{op:'c',c:[x-4*scale,y-11*scale,x+4*scale,y-11*scale,x+4*scale,y-6*scale]},{op:'c',c:[x+4*scale,y-4.2*scale,x+scale,y-1.5*scale,x,y]},{op:'h',c:[]}];
  style();doc.setGState(doc.GState({opacity:.15}));doc.setFillColor(C.midnight);doc.path(shape(x+.45*scale,y+.55*scale));doc.fill();style();doc.setFillColor(C.space);doc.setDrawColor(C.white);doc.setLineWidth(.53*scale);doc.path(shape(x,y));doc.fillStroke();style(10*scale,'bold');doc.text(String(n),x,y-4.7*scale,{align:'center'});
 }
 function contactCard(y:number,measureOnly=false){
  const x=M,textX=50,textW=146,name=fit(input.broker.name,textW,15,2,'bold',undefined,12),role=fit(input.broker.title||'',textW,11,2,'light');
  const nameY=y+17,roleY=nameY+name.lines.length*name.size*MM*1.2+2,phoneY=roleY+(input.broker.title?.trim()?role.lines.length*11*MM*1.3+2:0)+5;
  style(10.5,'bold',C.sand);const phoneLabel='WhatsApp or call',phoneWidth=doc.getTextWidth(phoneLabel+'  '+input.broker.whatsapp)+6;
  const email=fit(input.broker.email||'',textW,10.5,2,'bold'),inline=Boolean(input.broker.email&&email.lines.length===1&&phoneWidth+5+doc.getTextWidth(input.broker.email)<textW),emailY=inline?phoneY:phoneY+7;
  const height=Math.max(48,(input.broker.email?emailY-y+(email.lines.length-1)*5:phoneY-y)+9);
  if(measureOnly)return height;
  style();doc.setFillColor(C.card);doc.setDrawColor(C.border);doc.setLineWidth(.2);doc.roundedRect(x,y,W,height,2.5,2.5,'FD');portrait(31,y+height/2,11);
  serif(12);doc.text('Your contact',textX,y+9);style(name.size,'bold');doc.text(name.lines,textX,nameY,{lineHeightFactor:1.2});
  if(input.broker.title?.trim()){style(11,'light',C.white,.8);doc.text(role.lines,textX,roleY,{lineHeightFactor:1.3});}
  style(10.5,'light');if(assets.whatsappIcon){doc.addImage(assets.whatsappIcon,'PNG',textX,phoneY-3.3,3.7,3.7);doc.link(textX,phoneY-4,4,5,{url:whatsapp});}style(10.5,'light');doc.textWithLink(phoneLabel,textX+5,phoneY,{url:whatsapp});
  const phoneX=textX+5+doc.getTextWidth(phoneLabel)+2;style(10.5,'bold',C.sand);doc.textWithLink(input.broker.whatsapp,phoneX,phoneY,{url:tel});
  if(input.broker.email){style(10.5,'bold',C.sand);email.lines.forEach((line,i)=>doc.textWithLink(line,inline?textX+phoneWidth+5:textX,emailY+i*5,{url:'mailto:'+input.broker.email}));}
  return y+height;
 }
 background();
 // Cover: editorial hero, Sand callout, personal introduction and broker details.
 const intro=clean(input.intro.trim().slice(0,1600)||'Explore a personal selection of London New Homes, chosen for you. Browse these neighbourhoods and contact me to discuss the available homes and arrange your next steps.');
 const hero=input.coverImage||input.items.map(d=>assets.photos[d.id]).find(Boolean),heroEnd=coverHeroHeight(input.intro);
 if(assets.fadedCover)image(assets.fadedCover,0,0,210,heroEnd);else if(hero){image(hero,0,0,210,heroEnd);photoFade(heroEnd-65,heroEnd);}else background();
 const headline=fit(input.title.trim().slice(0,100),W,34,3,'light','Cover headline',26);style(headline.size);doc.text(headline.lines,M,heroEnd-10-(headline.lines.length-1)*headline.size*MM*1.12,{lineHeightFactor:1.12});
 serif(17);doc.text('Your handpicked London New Homes',M,heroEnd+11);
 const contactTop=Math.min(218,274-contactCard(0,true));
 block(intro,M,heroEnd+25,W,11.5,Math.floor((contactTop-8-heroEnd-25)/(11.5*MM*1.5)),{label:'Cover introduction'});
 contactCard(contactTop);logo(M,282,48);style(9,'light',C.white,.65);doc.text(date,196,287,{align:'right'});
 // Full-width light map band, hard Sand dividers, numbered vector pins and name cards.
 if(assets.map){
  page();style(30);doc.text('Your London New Homes',M,27);serif(16);doc.text('Explore your selected neighbourhoods',M,40);
  const top=54,height=177,map=assets.map;doc.addImage(map.image,'JPEG',0,top,210,height,undefined,'MEDIUM');style();doc.setDrawColor(C.sand);doc.setLineWidth(.53);doc.line(0,top,210,top);doc.line(0,top+height,210,top+height);
  for(const area of map.areas){const x=area.x*210,y=top+area.y*height;serif(area.major?11:7.5,'#6B7783');if(area.major)style(11,'bold',C.midnight);else doc.setCharSpace(.4);doc.setDrawColor(C.white);doc.setLineWidth(.7);doc.text(area.major?area.name:area.name.toUpperCase(),x,y,{align:'center',renderingMode:'fillThenStroke'});doc.text(area.major?area.name:area.name.toUpperCase(),x,y,{align:'center'});doc.setCharSpace(0);}
  const names=new Map(input.items.map(d=>[d.id,brochureDevelopmentName(d.name)]));
  const labels=map.points.map(p=>{const text=fit(names.get(p.id)||'',51,9.5,2,'bold');style(9.5,'bold');return {...p,width:Math.min(58,Math.max(...text.lines.map(s=>doc.getTextWidth(s)),15)+7),height:text.lines.length>1?12:8};});
  const placements=layoutBrochureMap(labels,210,height);
  for(const p of placements){style();doc.setDrawColor('#6B7783');doc.setLineWidth(.25);if(Math.hypot(p.pin.x-p.anchor.x,p.pin.y-p.anchor.y)>1)doc.line(p.anchor.x,top+p.anchor.y,p.pin.x,top+p.pin.y);const r=p.label;doc.line(p.pin.x,top+p.pin.y-5,Math.max(r.x,Math.min(p.pin.x,r.x+r.width)),top+r.y+r.height/2);}
  for(const p of placements){const n=input.items.findIndex(d=>d.id===p.id)+1,r=p.label;style();doc.setGState(doc.GState({opacity:.1}));doc.setFillColor(C.midnight);doc.roundedRect(r.x+.5,top+r.y+.6,r.width,r.height,1.8,1.8,'F');style();doc.setFillColor(C.white);doc.setDrawColor('#D6D1CB');doc.setLineWidth(.2);doc.roundedRect(r.x,top+r.y,r.width,r.height,1.8,1.8,'FD');const text=fit(names.get(p.id)||'',r.width-5,9.5,2,'bold');style(9.5,'bold',C.midnight);doc.text(text.lines,r.x+2.5,top+r.y+5.1,{lineHeightFactor:1.2});doc.link(r.x,top+r.y,r.width,r.height,{url:devLink(p.id)});pin(p.pin.x,top+p.pin.y,n);}
  style(5.5,'light',C.midnight,.8);doc.text('© OpenStreetMap contributors',208,top+height-1.8,{align:'right'});
  style(12);doc.text(`${input.items.length} selected ${input.items.length===1?'development':'developments'}. One connected city.`,M,246);serif(14);doc.text('Find your next London home',M,257);style(11,'bold',C.sand);doc.textWithLink('Explore your interactive portfolio',M,268,{url:portfolio.href});style(6.5,'light',C.white,.65);doc.text(map.attribution,M,275);footer();
 }
 // Every development still owns one page, with matching numbers throughout.
 for(const [index,d]of input.items.entries()){
  page();const name=brochureDevelopmentName(d.name),note=input.notes[d.id]?.trim().slice(0,1600),heroEnd=developmentHeroHeight(note),photo=assets.photos[d.id];
  if(assets.fadedPhotos?.[d.id])image(assets.fadedPhotos[d.id],0,0,210,heroEnd);else if(photo){image(photo,0,0,210,heroEnd);photoFade(heroEnd-48,heroEnd);}
  pin(19,24,index+1,.9);const title=fit(name,W,28,2,'bold',name+' headline',22);style(title.size,'bold');doc.text(title.lines,M,heroEnd-10-(title.lines.length-1)*title.size*MM*1.15,{lineHeightFactor:1.15});
  const developmentLogo=assets.developmentLogos?.[d.id];if(developmentLogo){const p=doc.getImageProperties(developmentLogo),scale=Math.min(40/p.width,14/p.height);doc.addImage(developmentLogo,'PNG',196-p.width*scale,12,p.width*scale,p.height*scale);}
  style(10.5,'bold',C.sand);doc.text(clean(d.area+' / '+d.postcode),M,heroEnd+9);
  const introduction=clean(brochureIntroduction(d.description)).replace(/\s+/g,' ').trim();const summary=fit(introduction,W,12.5,2,'light',name+' introduction');serif(12.5);doc.text(summary.lines,M,heroEnd+19,{lineHeightFactor:1.5});
  style(20,'bold',C.sand);doc.text(price(d.priceFrom),M,heroEnd+39);if(d.sample){style(9,'light');doc.text('Illustrative sample, not live stock',196,heroEnd+39,{align:'right'});}
  let y=heroEnd+49;const bedrooms=[...new Set(d.bedrooms)].sort((a,b)=>a-b),columns=bedrooms.length>6?3:2,cellW=(W-8*(columns-1))/columns;
  for(let row=0;row<Math.ceil(bedrooms.length/columns);row++){
   for(let col=0;col<columns;col++){const beds=bedrooms[row*columns+col];if(beds===undefined)continue;const x=M+col*(cellW+8);style(10.5,'light',C.white,.8);doc.text(unitLabel(beds),x,y);style(12,'bold',C.sand);doc.text(price(startingPrice(d,beds)),x,y+5.5);}
   y+=14;
  }
  y+=3;style();doc.setDrawColor(C.white);doc.setGState(doc.GState({opacity:.15,'stroke-opacity':.15}));doc.setLineWidth(.2);doc.line(M,y,196,y);style();y+=9;
  if(d.amenities.length){style(12,'bold');doc.text('Key features',M,y);y+=7;const features=d.amenities.slice(0,6);for(let row=0;row<Math.ceil(features.length/2);row++){
   let rows=1;for(let col=0;col<2;col++){const feature=features[row*2+col];if(!feature)continue;const f=fit('• '+feature,87,11,2,'light',name+' features');style(11);doc.text(f.lines,M+col*95,y,{lineHeightFactor:1.5});rows=Math.max(rows,f.lines.length);}y+=rows*11*MM*1.5+3;
  }}
  if(note){y+=4;style(12,'bold',C.sand);doc.text('Your broker’s perspective',M,y);y+=7;block(note,M,y,W,11,Math.max(1,Math.floor((262-y)/(11*MM*1.5))),{label:name+' broker notes'});}
  style(10.5,'bold',C.sand);doc.textWithLink('View this home in your portfolio',M,271,{url:devLink(d.id)});footer();
 }
 // Final numbered index and personalised contact, with no call-to-action buttons.
 page();style(30);doc.text('Your selected New Homes',M,27);serif(16);doc.text('Let’s find the right home for you',M,40);
 const half=Math.ceil(input.items.length/2),rowHeight=input.items.length>12?13.5:17;
 for(const [index,d]of input.items.entries()){
  const col=index<half?0:1,row=index%half,x=M+col*95,y=50+row*rowHeight,name=brochureDevelopmentName(d.name);pin(x+3,y+7,index+1,.58);
  style(11,'bold',C.sand);const amount=price(d.priceFrom),amountWidth=doc.getTextWidth(amount),nameWidth=87-amountWidth-12;
  const title=fit(name,nameWidth,11.5,2,'bold',name+' index name');style(11.5,'bold');doc.text(title.lines,x+9,y+2.5,{lineHeightFactor:1.2});style(11,'bold',C.sand);doc.text(amount,x+87,y+2.5,{align:'right'});doc.link(x,y-3,87,rowHeight-1,{url:devLink(d.id)});
  style();doc.setGState(doc.GState({opacity:.15,'stroke-opacity':.15}));doc.setDrawColor(C.white);doc.setLineWidth(.2);doc.line(x,y+rowHeight-4,x+87,y+rowHeight-4);style();
 }
 const end=50+half*rowHeight;style(9.5,'light',C.white,.65);doc.text('Prices and availability subject to change.',M,end+4);const finalContactTop=Math.max(169,end+16);contactCard(finalContactTop);footer();
 doc.setProperties({title:clean(input.title),author:input.broker.name,subject:'Selected London New Homes',creator:'JLL New Homes Portfolio'});
 return Object.assign(doc,{brochureWarnings:[...warnings]});
}
