import {startingPrice,unitLabel} from '../shared/pricing.ts';
import {jsPDF} from 'jspdf';
import QRCode from 'qrcode';
import type {Development} from './types';
export interface BrochureInput {title:string;intro:string;notes:Record<string,string>;items:Development[];broker:{name:string;whatsapp:string;photo?:string;title?:string};origin:string;collection?:string;brokerSlug?:string;date?:Date;coverImage?:string}
export interface BrochureAssets {regular:string;semibold:string;light?:string;logoLight?:string;logoDark?:string;photos:Record<string,string>;galleries?:Record<string,string[]>}
export function brochureFilename(title:string){return (title.normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,70)||'JLL-brochure')+'.pdf';}
const clean=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[\u2010-\u2015]/g,'-').replace(/\u00a0/g,' ');
const brief=(s:string)=>{const value=s.replace(/\s+/g,' ').trim();return value.length<=450?value:value.slice(0,447).replace(/\s+\S*$/,'')+'…';};
export function buildBrochure(input:BrochureInput,assets:BrochureAssets){
 if(!input.title.trim()||input.items.length<1||input.items.length>20)throw Error('Choose 1–20 developments and add a title.');
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 for(const [file,weight,data]of [['Regular','normal',assets.regular],['Semibold','bold',assets.semibold],['Light','light',assets.light||assets.regular]]){doc.addFileToVFS('SourceSans'+file+'.ttf',data!);doc.addFont('SourceSans'+file+'.ttf','SourceSans',weight!);}
 const ink='#131e29',blue='#003e51',muted='#65707a',white='#ffffff',pale='#edf3f4';
 const date=(input.date||new Date()).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
 const portfolio=new URL('/',input.origin);if(input.collection)portfolio.searchParams.set('collection',input.collection);else if(input.brokerSlug)portfolio.searchParams.set('broker',input.brokerSlug);
 const whatsapp='https://wa.me/'+input.broker.whatsapp.replace(/\D/g,'');
 const condensedNotes:string[]=[];let y=20,dark=false,continuation='';
 function style(size=11,weight='normal',colour=dark?white:ink){doc.setFont('SourceSans',weight);doc.setFontSize(size);doc.setTextColor(colour===blue&&dark?'#e0c6ad':colour);doc.setCharSpace(0);}
 function logo(x:number,top:number,width:number,onDark=false){const image=onDark?assets.logoDark:assets.logoLight;if(image)doc.addImage(image,'PNG',x,top,width,width*94.065/517.30957);else{style(17,'bold',onDark?white:ink);doc.text('JLL',x,top+6);style(12,'light',onDark?white:ink);doc.text('Residential',x+14,top+6);}}
 function background(){doc.setFillColor(dark?ink:white);doc.rect(0,0,210,297,'F');}
 function page(isDark=false,label=''){doc.addPage();dark=isDark;continuation=label;background();y=22;if(label){style(12,'light');const lines=doc.splitTextToSize(clean(label)+' / continued',174);doc.text(lines,18,y);y+=lines.length*6+10;}}
 function room(height:number){if(y+height>268)page(dark,continuation);}
 function text(value:string,size=11,weight='normal',colour=dark?white:ink,gap=6){const h=size*.47;for(const paragraph of clean(value).split('\n')){style(size,weight,colour);const lines:string[]=doc.splitTextToSize(paragraph||' ',174);for(const line of lines){room(h);style(size,weight,colour);doc.text(line,18,y);y+=h;}}y+=gap;}
 function eyebrow(value:string){room(10);style(10,'normal',blue);doc.setCharSpace(.65);doc.text(value,18,y);doc.setCharSpace(0);y+=12;}
 function section(label:string,value:string){room(18);text(label,10,'normal',blue,2);text(value,11,'light');}
 function link(label:string,url:string){room(12);style(11,'normal',blue);doc.textWithLink(label,18,y,{url});y+=10;}
 function imageCover(image:string,x:number,top:number,w:number,h:number){const p=doc.getImageProperties(image),scale=Math.max(w/p.width,h/p.height);doc.saveGraphicsState();doc.rect(x,top,w,h,null);doc.clip();doc.discardPath();doc.addImage(image,'JPEG',x+(w-p.width*scale)/2,top+(h-p.height*scale)/2,p.width*scale,p.height*scale,undefined,'MEDIUM');doc.restoreGraphicsState();}
 function tint(x:number,top:number,w:number,h:number,opacity:number){doc.saveGraphicsState();doc.setGState(doc.GState({opacity}));doc.setFillColor(ink);doc.rect(x,top,w,h,'F');doc.restoreGraphicsState();}
 function portrait(cx:number,cy:number,r:number,onDark=false){doc.setFillColor(onDark?white:pale);doc.circle(cx,cy,r,'F');if(input.broker.photo){doc.saveGraphicsState();doc.circle(cx,cy,r-.6,null);doc.clip();doc.discardPath();doc.addImage(input.broker.photo,'JPEG',cx-r+.6,cy-r+.6,(r-.6)*2,(r-.6)*2,undefined,'MEDIUM');doc.restoreGraphicsState();}else{style(r*.8,'light',ink);doc.text(input.broker.name.split(/\s+/).map(s=>s[0]).slice(0,2).join(''),cx,cy+r*.1,{align:'center'});}doc.setDrawColor(onDark?white:pale);doc.setLineWidth(.7);doc.circle(cx,cy,r,'S');}
 function qr(url:string,x:number,top:number,size:number){const code=QRCode.create(url,{errorCorrectionLevel:'M'}),n=code.modules.size,step=size/(n+8);doc.setFillColor(white);doc.rect(x,top,size,size,'F');doc.setFillColor('#000000');for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(code.modules.get(row,col))doc.rect(x+(col+4)*step,top+(row+4)*step,step+.01,step+.01,'F');doc.link(x,top,size,size,{url});}
 function fitted(value:string,width:number,size:number,maxLines:number){let lines:string[]=[];for(;size>=8;size--){style(size,'light');lines=doc.splitTextToSize(clean(value),width);if(lines.length<=maxLines)break;}size=Math.max(8,size);if(lines.length>maxLines){lines=lines.slice(0,maxLines);style(size,'light');let last=lines[maxLines-1];while(last&&doc.getTextWidth(last+'…')>width)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}return {lines,size};}
 // Photographic cover, like the supplied editorial brochure; no crop or bleed marks.
 dark=true;background();const hero=input.coverImage||input.items.map(d=>assets.photos[d.id]).find(Boolean);
 if(hero){imageCover(hero,0,0,210,297);tint(0,0,210,297,.15);tint(0,190,210,107,.58);}else{doc.setDrawColor('#203d4a');doc.setLineWidth(.3);doc.circle(180,40,105,'S');doc.circle(180,40,85,'S');}
 logo(18,16,68,true);qr(whatsapp,163,16,29);style(9,'normal',white);doc.text('Scan to connect',177.5,50,{align:'center'});
 const cover=fitted(input.title.trim().slice(0,100),119,34,3);style(cover.size,'light',white);doc.text(cover.lines,18,220,{lineHeightFactor:1.13});
 doc.setFont('times','italic');doc.setFontSize(17);doc.setTextColor(white);doc.text('A snapshot of our portfolio',18,280);
 portrait(168,224,16,true);const name=fitted(input.broker.name,53,13,3);style(name.size,'light',white);doc.text(name.lines,168,249,{align:'center',lineHeightFactor:1.1});if(input.broker.title?.trim()){const role=fitted(input.broker.title.trim().slice(0,100),53,10,2);style(role.size,'light',white);doc.text(role.lines,168,274,{align:'center',lineHeightFactor:1.1});}
 // A dark introduction page keeps the broker's own words separate from stock facts.
 page(true);continuation='Your introduction';eyebrow('Your handpicked collection');text('Homes, chosen for you.',30,'light',white,10);
 text(input.intro.trim().slice(0,1600)||'Explore a personal selection of London homes. Browse the developments in this guide, then contact your JLL broker to discuss availability and arrange your next steps.',14,'light',white,10);
 room(26);text(`${input.items.length} selected developments`,13,'light',blue,2);text(`Prepared by ${input.broker.name} / ${date}`,10,'light','#c7d1d5',6);link('Explore the interactive collection',portfolio.href);
 // Every development owns exactly one A4 page: no continuation or overview duplicates.
 for(const d of input.items){
  page();
  const gallery=[...new Set(assets.galleries?.[d.id]||[assets.photos[d.id]].filter(Boolean))].slice(0,3);
  if(gallery.length){
   const hasExtras=gallery.length>1;
   imageCover(gallery[0],0,0,210,hasExtras?62:82);
   if(hasExtras){const extras=gallery.slice(1);const width=extras.length===2?86:174;extras.forEach((img,i)=>imageCover(img,18+i*88,66,width,35));}
   y=hasExtras?115:96;
  }else{y=23;eyebrow('The collection');}
  const heading=fitted(d.name,174,26,2);style(heading.size,'light',ink);doc.text(heading.lines,18,y,{lineHeightFactor:1.12});y+=heading.lines.length*heading.size*.4+4;
  const address=fitted(`${d.area} / ${d.postcode}`,174,10,1);style(address.size,'light',muted);doc.text(address.lines,18,y);y+=8;
  const price=d.priceFrom>0?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(d.priceFrom):'Price to be confirmed';
  const beds=d.bedrooms.length?d.bedrooms.map(b=>b===0?'Studio':String(b)).join(', ')+(d.bedrooms.some(b=>b>0)?' bedrooms':''):'Bedrooms to be confirmed';
  const unitFacts=d.bedrooms.map(b=>unitLabel(b)+': '+(startingPrice(d,b)!==null?'from '+new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(startingPrice(d,b)!):'price to confirm')).join(' | ');const facts=fitted(unitFacts||`${d.priceFrom>0?'Development from ':''}${price} | ${beds}`,174,11,3);style(facts.size,'normal',blue);doc.text(facts.lines,18,y);y+=facts.lines.length*facts.size*.4+5;
  if(d.sample){style(8,'normal','#a32222');doc.text('ILLUSTRATIVE SAMPLE - NOT LIVE STOCK',18,y);y+=6;}
  // Features use two columns so imagery and broker notes retain room.
  if(d.amenities.length){style(10,'normal',blue);doc.text('Key features',18,y);y+=6;const features=d.amenities.slice(0,6);for(let row=0;row<Math.ceil(features.length/2);row++){let height=0;for(let col=0;col<2;col++){const value=features[row*2+col];if(!value)continue;const feature=fitted('• '+value.replace(/\s+/g,' ').trim(),83,9.5,2);style(feature.size,'light',ink);doc.text(feature.lines,18+col*88,y,{lineHeightFactor:1.16});height=Math.max(height,feature.lines.length*feature.size*.42);}y+=height+3;}y+=2;}
  if(d.description.trim()){
   style(10,'normal',blue);doc.text('At a glance',18,y);y+=6;
   const overview=fitted(brief(d.description.trim()),174,10,4);style(overview.size,'light',ink);doc.text(overview.lines,18,y,{lineHeightFactor:1.16});y+=overview.lines.length*overview.size*.42+7;
  }
  const note=input.notes[d.id]?.trim().slice(0,1600);
  if(note){
   style(10,'normal',blue);doc.text('Your broker’s notes',18,y);y+=6;
   let size=10.5,lines:string[]=[];const value=clean(note).replace(/\s+/g,' ').trim();const available=Math.max(8,263-y);
   for(;size>=8.5;size-=.5){style(size,'light',ink);lines=doc.splitTextToSize(value,174);if(lines.length*size*.42<=available)break;}
   size=Math.max(8.5,size);const maxLines=Math.max(1,Math.floor(available/(size*.42)));
   if(lines.length>maxLines){condensedNotes.push(d.name);lines=lines.slice(0,maxLines);style(size,'light',ink);let last=lines[maxLines-1];while(last&&doc.getTextWidth(last+'…')>174)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
   style(size,'light',ink);doc.text(lines,18,y,{lineHeightFactor:1.16});
  }
  const url=new URL(portfolio);url.searchParams.set('development',d.id);style(10,'normal',blue);doc.textWithLink('View this home and enquire',18,277,{url:url.href});
 }
 page();eyebrow('Get in touch');text('Let’s talk about London',32,'light',ink,10);doc.setFont('times','italic');doc.setFontSize(15);doc.setTextColor(ink);doc.text(['For a conversation about any of the','developments in this guide.'],18,61,{lineHeightFactor:1.4});
 portrait(44,103,25);const contactName=fitted(input.broker.name,102,23,3);style(contactName.size,'light',ink);doc.text(contactName.lines,80,90,{lineHeightFactor:1.1});const contactY=90+contactName.lines.length*contactName.size*.39+8;if(input.broker.title?.trim()){const role=fitted(input.broker.title.trim().slice(0,100),102,12,2);style(role.size,'light',muted);doc.text(role.lines,80,contactY,{lineHeightFactor:1.1});}style(10,'normal',blue);doc.text('Mobile / WhatsApp',80,contactY+13);style(14,'light',ink);doc.textWithLink(input.broker.whatsapp,80,contactY+21,{url:whatsapp});
 qr(whatsapp,18,178,32);style(12,'light',ink);doc.text(['Scan to connect','with your JLL broker'],58,190,{lineHeightFactor:1.35});
 style(8,'light',muted);doc.text(`Prepared ${date}. Prices and availability subject to broker confirmation.`,18,264);doc.text('Images are indicative. Full details are available in the interactive portfolio.',18,269);
 const pages=doc.getNumberOfPages();for(let n=2;n<=pages;n++){doc.setPage(n);style(8,'light',n===2?'#bdc9cd':muted);doc.text(String(n),192,287,{align:'right'});}
 doc.setProperties({title:input.title,author:input.broker.name,subject:'Selected London new homes',creator:'JLL New Homes Portfolio'});return Object.assign(doc,{brochureWarnings:condensedNotes});
}
