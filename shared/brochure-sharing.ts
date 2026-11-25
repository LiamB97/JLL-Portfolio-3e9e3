import type {BuyerLanguage} from './buyer-language.ts';
import {portfolioLink} from './sharing.ts';
import {shareCopy} from './share-copy.ts';

export function brochureShareLinks(origin:string,broker:string,collection:string,title:string,name:string,language?:BuyerLanguage){
 const link=portfolioLink(origin,collection,broker,language),copy=shareCopy[language??'en'];
 const subject=title.replace(/[\r\n]/g,' ').trim();
 const body=[copy.greeting,copy.brochure.replace('{title}',()=>subject),copy.online+'\n'+link,copy.signoff+',\n'+name].join('\n\n');
 return {portfolio:link,whatsapp:'https://wa.me/?text='+encodeURIComponent(body),email:'mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)};
}
