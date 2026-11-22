/** Source discovery registry. A website is NOT silently treated as an API or an authorized dataset. */
export type SourceDirectoryEntry={id:string;name:string;category:string;url:string;mode:'structured_feed'|'official_announcements'|'calendar_support'|'discovery_only';note:string};
export const OFFICIAL_EVENT_DIRECTORY:readonly SourceDirectoryEntry[]=Object.freeze([
 {id:'tdap',name:'TDAP — Karachi Expo Centre',category:'business',url:'https://tdap.gov.pk/',mode:'official_announcements',note:'Government exhibition notices and booking schedules. Extract verified facts under applicable reuse terms; PDF is not a JSON feed.'},
 {id:'pakexcel',name:'Pakistan Expo Centres — Lahore',category:'business',url:'https://www.pakexcel.com/events-upcoming',mode:'official_announcements',note:'Primary exhibition listings; verify organizer, dates and venue.'},
 {id:'pcb',name:'Pakistan Cricket Board',category:'sports',url:'https://www.pcb.com.pk/',mode:'official_announcements',note:'Official cricket competitions and fixture announcements.'},
 {id:'nust',name:'NUST University',category:'education',url:'https://nust.edu.pk/events/',mode:'official_announcements',note:'Academic and technology events; confirmation needed.'},
 {id:'lums',name:'LUMS University',category:'education',url:'https://lums.edu.pk/events',mode:'official_announcements',note:'Academic and student events; confirmation needed.'},
 {id:'pnca',name:'Pakistan National Council of the Arts',category:'arts',url:'https://pnca.org.pk/events/',mode:'official_announcements',note:'Cultural exhibitions, performances and workshops.'},
 {id:'arts-council',name:'Arts Council of Pakistan Karachi',category:'arts',url:'https://www.artscouncil.org.pk/',mode:'official_announcements',note:'Festival, theatre and arts announcements.'},
 {id:'laam',name:'LAAM Fashion Week',category:'fashion',url:'https://laamfashionweek.com/',mode:'official_announcements',note:'Primary fashion show announcements; future dates must be confirmed.'},
 {id:'health-asia',name:'Health Asia International',category:'health',url:'https://health-asia.com/home.php',mode:'official_announcements',note:'Organizer announcements for healthcare exhibitions.'},
 {id:'psh',name:'Pakistan Society of Hepatology',category:'health',url:'https://psh.com.pk/conference/about.php',mode:'official_announcements',note:'Organizer medical-conference announcements.'},
 {id:'iftech',name:'IFTECH Food & Beverage Technology',category:'food',url:'https://foodtechpakistan.com/',mode:'official_announcements',note:'Food industry exhibition announcements; not a food festival feed.'},
 {id:'cothm',name:'COTHM culinary event calendar',category:'food',url:'https://pak.cothmglobal.com/event-calendar/',mode:'official_announcements',note:'Culinary championships and hospitality event notices.'},
 {id:'ecgateway',name:'Ecommerce Gateway Pakistan',category:'business',url:'https://ecgateway.net/',mode:'official_announcements',note:'Trade show organizer event schedules across several categories.'},
 {id:'gcal',name:'Google public calendars — iCalendar',category:'community',url:'https://support.google.com/calendar/answer/37083',mode:'calendar_support',note:'Configure a public organizer iCal URL in Event Sources; calendar URLs are supplied by the organizer.'},
 {id:'sportsdb',name:'TheSportsDB v1',category:'sports',url:'https://www.thesportsdb.com/docs/api',mode:'structured_feed',note:'Existing free preset. Coverage is limited; verify event records and licensing.'},
 {id:'confs',name:'Confs.tech open conference JSON',category:'technology',url:'https://github.com/tech-conferences/conference-data',mode:'structured_feed',note:'Existing structured presets; Pakistan venue coverage varies.'},
 {id:'google-news',name:'Google News RSS — discovery only',category:'community',url:'https://news.google.com/',mode:'discovery_only',note:'Search headlines are leads, NOT event records. Never infer dates or publish automatically.'}
]);
