import type {TransportDefaults} from './types';
export interface StaffUser {jobTitle?:string;photo?:string;whatsapp:string;shareSlug:string;id:string;name:string;email:string;role:'admin'|'broker_admin'|'broker';active:boolean}
export interface StaffCollection {transportDefaults?:TransportDefaults;id:string;slug:string;title:string;ownerId:string;developmentIds:string[];createdAt:string;updatedAt:string}
export type StaffRequest=(route:string,body?:unknown,method?:string)=>Promise<any>;
