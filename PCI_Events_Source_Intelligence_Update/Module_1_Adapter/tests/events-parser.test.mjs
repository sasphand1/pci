import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHttpsUrl,parseRssFeed,parseIcsFeed,parseJsonFeed,normalizeEvent} from '../src/modules/events/parse.mjs';
const future='2028-03-17T14:00:00+05:00';
const src={category:'community',city_hint:'Karachi'};
test('reject localhost, credentials, IPs, HTTP and nonstandard ports',()=>{
 for(const url of ['http://example.org/rss','https://localhost/feed','https://127.0.0.1/feed','https://[::1]/','https://a:b@example.org/feed','https://example.org:8443/rss','file:///tmp/secret'])assert.throws(()=>validateHttpsUrl(url));
 assert.equal(validateHttpsUrl('https://example.org/feed'),'https://example.org/feed');
});
test('RSS article publishing dates are NOT events',()=>{
 const items=parseRssFeed('<rss><channel><item><title>Yesterday news</title><pubDate>Wed, 21 Nov 2026 06:00:00 GMT</pubDate><description>City expo</description></item></channel></rss>');
 assert.equal(items.length,1);assert.equal(items[0].start,'');assert.equal(normalizeEvent(items[0],src,Date.parse('2026-01-01')).ok,false);
});
test('RSS reads explicit future event fields',()=>{
 const items=parseRssFeed(`<rss><channel><item><title><![CDATA[Public Fair]]></title><event:startDate>${future}</event:startDate><event:venue>Venue, Karachi</event:venue><geo:lat>24.92</geo:lat><geo:long>67.04</geo:long></item></channel></rss>`);
 const normalized=normalizeEvent(items[0],src,Date.parse('2026-11-22'));assert.equal(normalized.ok,true);assert.equal(normalized.item.city,'Karachi');assert.equal(normalized.item.latitude,24.92);
});
test('ICS handles UTC, date-only and excludes recurring or unsupported time zones',()=>{
 const entries=parseIcsFeed('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fair1\nSUMMARY:Art Fair\nDTSTART:20280317T140000Z\nLOCATION:Lahore Gallery, Lahore\nGEO:31.50;74.35\nEND:VEVENT\nBEGIN:VEVENT\nUID:fair2\nSUMMARY:All day fair\nDTSTART;VALUE=DATE:20280319\nLOCATION:Karachi Park\nEND:VEVENT\nBEGIN:VEVENT\nUID:rec1\nSUMMARY:Unexpanded recurrence\nDTSTART:20280317T110000Z\nRRULE:FREQ=WEEKLY\nLOCATION:Karachi Park\nEND:VEVENT\nEND:VCALENDAR');
 assert.equal(entries.length,3);assert.equal(entries[0].start,'2028-03-17T14:00:00.000Z');assert.equal(entries[1].allDay,true);assert.equal(entries[2].start,null);
});
test('JSON feed parser handles explicit ISO events',()=>{
 const items=parseJsonFeed(JSON.stringify({events:[{id:'x',title:'Food Weekend',startDate:future,location:{name:'Park, Karachi',latitude:24.94,longitude:67.05},ticketType:'free'}]}));
 const result=normalizeEvent(items[0],src,Date.parse('2026-11-22'));assert.equal(result.ok,true);assert.equal(result.item.ticket_type,'free');assert.equal(result.item.price_text,'');
});
test('no guessing venue, date, city or tickets',()=>{
 const x={name:'TBD',venue:'',start:future};assert.equal(normalizeEvent(x,src,Date.parse('2026-11-22')).ok,false);
 const y=normalizeEvent({name:'Open',venue:'Venue',start:future,ticket:'free'},src,Date.parse('2026-11-22'));
 assert.equal(y.ok,true);assert.equal(y.item.latitude,null);assert.equal(y.item.city,'Karachi');
});
test('expired events are not publishable',()=>assert.equal(normalizeEvent({name:'Old',start:'2024-01-01T00:00:00Z',venue:'Lahore Expo',city:'Lahore'},{...src,city_hint:null},Date.parse('2026-11-22')).ok,false));

test('TheSportsDB structured records are supported without inventing admission or venue coordinates',()=>{
 const events=parseJsonFeed(JSON.stringify({events:[{idEvent:'123',strEvent:'Home Match',dateEvent:'2028-11-12',strTime:'14:00:00',strVenue:'Karachi Arena',strCity:'Karachi',strCountry:'Pakistan'}]}));
 const a=normalizeEvent(events[0],{category:'sports',city_hint:null},Date.parse('2026-11-22'));
 assert.equal(a.ok,true);assert.equal(a.item.latitude,null);assert.equal(a.item.ticket_type,'unknown');
 const foreign=parseJsonFeed(JSON.stringify({events:[{idEvent:'124',strEvent:'Home Match',dateEvent:'2028-11-12',strVenue:'Lahore Arena',strCity:'Lahore',strCountry:'England'}]}));
 assert.equal(normalizeEvent(foreign[0],{category:'sports',city_hint:'Lahore'},Date.parse('2026-11-22')).ok,false);
});
