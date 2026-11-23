import {canManagePortfolioStock, canReviewDevelopments, canUseBuyerTools, type StaffRole} from '../shared/staff-roles.ts';

export function workspaceGroups(role: StaffRole) {
  const isAdmin = role === 'admin';
  const buyerTools = canUseBuyerTools(role);
  return [
    {label:'Your workspace',items:[
      {id:'home',label:'Overview'},
      ...(buyerTools ? [
        {id:'collections',label:'Buyer collections'},
        {id:'your-first-home',label:'Your First Home'},
        {id:'brochures',label:'PDF brochures'},
      ] : []),
      ...(canReviewDevelopments(role) ? [{id:'reviews',label:'Development reviews'}] : []),
      {id:'profile',label:'My profile'},
    ]},
    ...(canManagePortfolioStock(role) ? [{label:'Portfolio stock',items:[
      {id:'developments',label:'Developments'},
      {id:'pending',label:'Pending input'},
      ...(isAdmin ? [{id:'reviews',label:'Review assignments'}] : []),
    ]}] : []),
    ...(buyerTools ? [{label:'Team',items:[
      {id:'users',label:isAdmin?'People & roles':'Invite brokers'},
      ...(isAdmin ? [
        {id:'buyer-access',label:'Buyer access'},
        {id:'activity',label:'Team activity'},
        {id:'analytics',label:'Analytics'},
      ] : []),
    ]}] : []),
    {label:'Help',items:[{id:'guide',label:'How it works'}]},
  ];
}

export function workspaceStartTab(search: string, role: StaffRole = 'broker') {
 const requested = new URLSearchParams(search).get('staff') ?? 'home';
 return workspaceGroups(role).some(group => group.items.some(item => item.id === requested)) ? requested : 'home';
}
