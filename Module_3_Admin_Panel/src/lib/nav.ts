import type {Role} from './types';
export const NAV:{title:string;href:string;roles:Role[]}[]=[
 {title:'Overview',href:'/',roles:['owner','editor','moderator']},
 {title:'Bucket',href:'/bucket',roles:['owner','editor']},
 {title:'Pipeline',href:'/pipeline',roles:['owner','editor']},
 {title:'Categories',href:'/categories',roles:['owner','editor']},
 {title:'Videos',href:'/videos',roles:['owner','editor']},
 {title:'Live wall',href:'/wall',roles:['owner','moderator']},
 {title:'Website content',href:'/content',roles:['owner','editor']},
 {title:'Admin accounts',href:'/admins',roles:['owner']},
 {title:'System health',href:'/system',roles:['owner']},
 {title:'Settings',href:'/settings',roles:['owner','editor','moderator']},
 {title:'Audit log',href:'/audit',roles:['owner']},
 {title:'My security',href:'/security',roles:['owner','editor','moderator']}
];
