import type {TransportDefaults} from './types';
import type {StaffRole} from '../shared/staff-roles';
export interface StaffUser {jobTitle?:string;photo?:string;whatsapp:string;shareSlug:string;id:string;name:string;email:string;role:StaffRole;active:boolean}
export interface StaffCollection {transportDefaults?:TransportDefaults;id:string;slug:string;title:string;ownerId:string;developmentIds:string[];createdAt:string;updatedAt:string;passwordProtected:boolean;password:string|null}
export type StaffRequest=(route:string,body?:unknown,method?:string)=>Promise<any>;
