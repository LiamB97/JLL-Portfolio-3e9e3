import type {Development} from '../src/types';
import {buyerLanguage, isBuyerLanguage, type BuyerLanguage} from './buyer-language.ts';
import {shareCopy} from './share-copy.ts';
import {isYourFirstHomeSlug,YOUR_FIRST_HOME_SLUG} from './your-first-home.ts';

export const portfolioInvitation = shareCopy.en.invite;

export function collectionInvitation(link: string) {
 const language = buyerLanguage(new URL(link).searchParams.get('lang'));
 return shareCopy[language].invite + '\n' + link;
}

export function portfolioEmail(link:string,items:Development[]=[],title?:string,contactOptions=false){
 const {origin,searchParams:params}=new URL(link);
 const preferred=params.get('lang'),language=buyerLanguage(preferred),copy=shareCopy[language];
 const picks=items.map((d,i)=>(i+1)+'. '+d.name+' — '+d.area+'\n'+
  developmentLink(origin,d.id,params.get('collection')||undefined,params.get('broker')||undefined,isBuyerLanguage(preferred)?preferred:undefined));
 const lines=[
  copy.greeting,
  items.length?copy.picks:copy.portfolio,
  ...picks,
  copy.invite+':\n'+link,
  contactOptions?copy.contactOptions:copy.contact,
  copy.signoff,
 ];
 return {subject:(title||copy.subject).replace(/[\r\n]/g,' '),body:lines.join('\n\n')};
}
export function emailHref(subject:string,body:string){return 'mailto:?subject='+encodeURIComponent(subject.replace(/[\r\n]/g,' '))+'&body='+encodeURIComponent(body);}

export function buyerShareLink(href:string,id?:string){
 const incoming=new URL(href),params=incoming.searchParams;
 const collection=params.get('collection'),broker=params.get('broker'),preferred=params.get('lang');
 const url=new URL(portfolioLink(incoming.origin,collection||undefined,broker||undefined,isBuyerLanguage(preferred)?preferred:undefined));
 if(id)url.searchParams.set('development',id);
 return url.href;
}

export function portfolioLink(origin:string,collection?:string,broker?:string,language?:BuyerLanguage,development?:string){
 const url=new URL('/',origin);
 if(development)url.searchParams.set('development',development);
 if(collection)url.searchParams.set('collection',collection);
 if(broker&&broker!=='your-first-home'&&(!collection||isYourFirstHomeSlug(collection)))url.searchParams.set('broker',broker);
 if(language)url.searchParams.set('lang',language);
 return url.href;
}

export function developmentLink(origin:string,id:string,collection?:string,broker?:string,language?:BuyerLanguage){
 return portfolioLink(origin,collection,broker,language,id);
}

export function yourFirstHomeShareLink(origin:string,broker?:string){
 return portfolioLink(origin,YOUR_FIRST_HOME_SLUG,broker);
}
