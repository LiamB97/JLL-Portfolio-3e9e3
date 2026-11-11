import type {StaffUser} from './staff-types';
export function workspaceGroups(role:StaffUser['role']){
 return [
  {label:'Your workspace',items:[{id:'home',label:'Overview'},{id:'collections',label:'Buyer collections'},{id:'brochures',label:'PDF brochures'},{id:'reviews',label:'Development reviews'},{id:'profile',label:'My profile'}]},
  ...(role!=='broker'?[{label:'Portfolio stock',items:[{id:'developments',label:'Developments'},{id:'pending',label:'Pending input'}]}]:[]),
  {label:'Team',items:[{id:'users',label:role==='admin'?'People & roles':'Invite brokers'},...(role==='admin'?[{id:'activity',label:'Team activity'},{id:'analytics',label:'Analytics'}]:[])]},
  {label:'Help',items:[{id:'guide',label:'How it works'}]},
 ];
}
