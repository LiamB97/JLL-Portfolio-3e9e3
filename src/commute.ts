export interface CommuteResult {id:string;status:'ok'|'unavailable';durationMinutes?:number;modes?:string[];arrival?:string|null;departure?:string|null}
export type CommuteDestination = {lat:number;lng:number} & ({postcode:string;name?:never}|{id:string;name:string;postcode?:never});
export interface CommuteReport {destination:CommuteDestination;results:CommuteResult[];source:string;checkedAt:string;date:string;time:string;mode:'public'|'walking'|'cycle';maxMinutes:number}
export function commuteMatches(result:CommuteResult|undefined,maxMinutes:number){return result?.status==='ok'&&typeof result.durationMinutes==='number'&&Number.isFinite(result.durationMinutes)&&result.durationMinutes>=0&&result.durationMinutes<=maxMinutes;}
export function londonDate(now=new Date()){return Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function nextCommuteDay(now=new Date()){const day=new Date(londonDate(now)+'T12:00:00Z');do{day.setUTCDate(day.getUTCDate()+1);}while([0,6].includes(day.getUTCDay()));return day.toISOString().slice(0,10);}
