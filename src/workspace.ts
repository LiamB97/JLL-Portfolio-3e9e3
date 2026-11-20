import type {StaffUser} from './staff-types';
export function workspaceGroups(role:StaffUser['role']){
 return [
  {label:'Your workspace',items:[{id:'home',label:'Overview'},{id:'collections',label:'Buyer collections'},{id:'your-first-home',label:'Your First Home'},{id:'brochures',label:'PDF brochures'},{id:'reviews',label:'Development reviews'},{id:'profile',label:'My profile'}]},
  ...(role!=='broker'?[{label:'Portfolio stock',items:[{id:'developments',label:'Developments'},{id:'pending',label:'Pending input'}]}]:[]),
  {label:'Team',items:[{id:'users',label:role==='admin'?'People & roles':'Invite brokers'},...(role==='admin'?[{id:'buyer-access',label:'Buyer access'},{id:'activity',label:'Team activity'},{id:'analytics',label:'Analytics'}]:[])]},
  {label:'Help',items:[{id:'guide',label:'How it works'}]},
 ];
}

export function workspaceStartTab(search: string, role: StaffUser['role'] = 'broker') {
 const requested = new URLSearchParams(search).get('staff') ?? 'home';
 return workspaceGroups(role).some(group => group.items.some(item => item.id === requested)) ? requested : 'home';
}
