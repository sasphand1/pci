import type {Role} from './types';
export type NavItem={title:string;href:string;icon:string;roles:Role[]};
export type NavGroup={label:string|null;items:NavItem[]};
/** Grouped by how often they are used: daily work first, rarely used settings last. */
export const NAV_GROUPS:NavGroup[]=[
 {label:null,items:[{title:'Overview',href:'/',icon:'overview',roles:['owner','editor','moderator']}]},
 {label:'Rankings',items:[
  {title:'People',href:'/bucket',icon:'people',roles:['owner','editor']},
  {title:'Pipeline',href:'/pipeline',icon:'pipeline',roles:['owner','editor']},
  {title:'Categories',href:'/categories',icon:'tag',roles:['owner','editor']}]},
 {label:'Website',items:[
  {title:'Page content',href:'/content',icon:'edit',roles:['owner','editor']},
  {title:'Event sources',href:'/events/sources',icon:'settings',roles:['owner','editor']},
  {title:'Events Intelligence',href:'/events/intelligence',icon:'settings',roles:['owner','editor']},
  {title:'Live wall',href:'/wall',icon:'chat',roles:['owner','moderator']}]},
 {label:'Administration',items:[
  {title:'Satellite APIs',href:'/satellite',icon:'settings',roles:['owner']},
  {title:'System health',href:'/system',icon:'pulse',roles:['owner']},
  {title:'Audit log',href:'/audit',icon:'clock',roles:['owner']},
  {title:'Team',href:'/admins',icon:'team',roles:['owner']},
  {title:'My security',href:'/security',icon:'shield',roles:['owner','editor','moderator']},
  {title:'Settings',href:'/settings',icon:'settings',roles:['owner','editor','moderator']}]}
];
/** Flat list, kept for code that only needs the routes. */
export const NAV:NavItem[]=NAV_GROUPS.flatMap(g=>g.items);
export function visibleGroups(role:Role):NavGroup[]{
 return NAV_GROUPS.map(g=>({...g,items:g.items.filter(i=>i.roles.includes(role))})).filter(g=>g.items.length>0);
}
