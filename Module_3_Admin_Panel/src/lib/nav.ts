import type {Role} from './types';
export const NAV:{title:string;href:string;roles:Role[]}[]=[
 {title:'Overview',href:'/',roles:['owner','editor','moderator']},
 {title:'Creators',href:'/creators',roles:['owner','editor']},
 {title:'Unified human review',href:'/unified',roles:['owner','editor']},
 {title:'Instagram creators',href:'/instagram',roles:['owner','editor']},
 {title:'Unified Top 10',href:'/cross-platform',roles:['owner','editor']},
 {title:'Categories',href:'/categories',roles:['owner','editor']},
 {title:'Sync operations',href:'/sync',roles:['owner','editor']},
 {title:'Ranking preview',href:'/rankings',roles:['owner','editor']},
 {title:'Videos',href:'/videos',roles:['owner','editor']},
 {title:'Live wall',href:'/wall',roles:['owner','moderator']},
 {title:'Website content',href:'/content',roles:['owner','editor']},
 {title:'Admin accounts',href:'/admins',roles:['owner']},
 {title:'System health',href:'/system',roles:['owner']},
 {title:'Settings',href:'/settings',roles:['owner','editor','moderator']},
 {title:'Audit log',href:'/audit',roles:['owner']},
 {title:'My security',href:'/security',roles:['owner','editor','moderator']}
];
