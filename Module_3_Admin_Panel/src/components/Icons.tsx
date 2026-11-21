import type {ReactElement} from 'react';

const PATHS:Record<string,ReactElement>={
 overview:<><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></>,
 people:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .7 3.3 2.4 3.6 5.2"/></>,
 pipeline:<path d="M7 4l12 8-12 8z"/>,
 tag:<><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/></>,
 edit:<path d="M4 20h4L19 9l-4-4L4 16z"/>,
 chat:<path d="M4 5h16v11H9l-5 4z"/>,
 pulse:<path d="M3 12h4l3-7 4 14 3-7h4"/>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 shield:<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>,
 team:<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></>,
 key:<><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></>,
 settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></>,
 menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
 check:<path d="M5 12l5 5 9-10"/>,
 search:<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>
};
export type IconName=keyof typeof PATHS;
export function Icon({name,size=18}:{name:string;size?:number}){
 return <svg className="gi" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]??PATHS.overview}</svg>;
}
