/** Explicit real public data endpoints. No guessed event listings or invented coverage. */
export const EVENT_FEED_CATALOG = [
  {
    key:'pakistan-super-league',
    name:'TheSportsDB — Pakistan Super League',
    feed_type:'json', category:'sports', city_hint:null,
    feed_url:'https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=5067',
    documentation:'https://www.thesportsdb.com/docs/api',
    attribution:'TheSportsDB',
    notes:'Free API documented by provider; schedules may be empty outside PSL season. Third-party fixture database; venue and city must be explicitly present. Review provider reuse terms before enabling.',
    verification:'provider_documented'
  },
  {
    key:'think-tank-calendar',
    name:'Think Tank Calendar — public policy events',
    feed_type:'json',category:'conferences',city_hint:null,
    feed_url:'https://thinktankcalendar.com/feeds/events.json',
    documentation:'https://thinktankcalendar.com/feeds',
    attribution:'Event data from Think Tank Calendar',
    notes:'Provider explicitly offers free JSON/RSS/ICS feeds with attribution. Global feed may have no qualifying Pakistan city entries; no dates or venues are guessed.',
    verification:'provider_documented'
  },
  {
    key:'confs-tech-2027-general',
    name:'Confs.tech — open 2027 conference listings',
    feed_type:'json',category:'conferences',city_hint:null,
    feed_url:'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/general.json',
    documentation:'https://github.com/tech-conferences/conference-data',
    attribution:'confs.tech contributors — MIT',
    notes:'MIT-licensed, crowd-maintained JSON. A conference may provide city but no physical venue: incomplete entries stay rejected rather than creating a fake map pin. Coverage of Pakistan not guaranteed.',
    verification:'open_repository'
  },
  {
    key:'confs-tech-2027-data',
    name:'Confs.tech — open 2027 data conferences',
    feed_type:'json',category:'conferences',city_hint:null,
    feed_url:'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/data.json',
    documentation:'https://github.com/tech-conferences/conference-data',
    attribution:'confs.tech contributors — MIT',
    notes:'Open dataset. Only event records explicitly naming a supported Pakistan city, future date and venue can be imported; others are rejected.',
    verification:'open_repository'
  },
] as const;
export type CatalogSource=(typeof EVENT_FEED_CATALOG)[number];
export function catalogEntry(key:string){return EVENT_FEED_CATALOG.find(p=>p.key===key);}
export function catalogSourceInput(p:CatalogSource){
 return {id:'preview',name:p.name,feed_type:p.feed_type,feed_url:p.feed_url,category:p.category,city_hint:p.city_hint,
  enabled:false,official_confirmed:false,rights_confirmed:false};
}
