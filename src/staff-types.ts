import type {TransportDefaults} from './types';
import type {StaffRole} from '../shared/staff-roles';
import type {BuyerLanguage} from '../shared/buyer-language';
export interface StaffUser {jobTitle?:string;photo?:string;wechatId?:string;wechatQr?:string;whatsapp:string;shareSlug:string;id:string;name:string;email:string;role:StaffRole;active:boolean}
export interface StaffCollection {language?:BuyerLanguage;transportDefaults?:TransportDefaults;id:string;slug:string;title:string;ownerId:string;ownerName:string|null;developmentIds:string[];createdAt:string;updatedAt:string;passwordProtected:boolean;password:string|null}
export type BrochureCollection = Pick<StaffCollection, 'slug' | 'title' | 'developmentIds' | 'language'>;
export type StaffRequest=(route:string,body?:unknown,method?:string)=>Promise<any>;
