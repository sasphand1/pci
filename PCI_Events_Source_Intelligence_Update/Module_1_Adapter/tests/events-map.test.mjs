import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const html=fs.readFileSync(path.resolve(import.meta.dirname,'../../Module_2_Public_Website/public/events-radar.html'),'utf8');
const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const js=blocks.at(-1)[1].replace(/\ninit\(\);\s*$/,'');
function runtime(){
 const ctx=vm.createContext({console,Intl,URL,Date,Number,String,Array,Map,Set,Math,JSON,encodeURIComponent,
 window:{location:{hostname:'pci.example',protocol:'https:',origin:'https://pci.example'},self:{},top:{}},
 document:{querySelector:()=>null}});
 vm.runInContext(js,ctx,{timeout:1000});return ctx;
}
const fixture={id:'test-event-1',name:'Karachi Public Expo',city:'Karachi',category:'expos',start_at:'2028-03-17T10:00:00+05:00',all_day:false,venue:'Karachi Expo Centre',latitude:24.9019,longitude:67.0765,ticket_type:'paid',price_text:'PKR 950',description:'Officially announced event',source_name:'Official organizer',event_url:'https://example.org/expo'};
test('approved JSON event generates accurate Waze coordinates in card and retains universal share control',()=>{
 const c=runtime();c.data=fixture;
 const card=vm.runInContext('eventCardMarkup(asPublishedEvent(data))',c);
 assert.match(card,/waze\.com\/ul\?ll=24\.9019%2C67\.0765&navigate=yes/);
 assert.match(card,/mini-card-share/);assert.match(card,/Official details/);assert.match(card,/PKR 950/);
});
test('map events can be filtered by city and category without adding fake events',()=>{
 const c=runtime();c.data=fixture;
 assert.equal(vm.runInContext('PUBLIC_EVENTS.length',c),0);
 vm.runInContext('PUBLIC_EVENTS=[asPublishedEvent(data)];state.city="Islamabad";state.category="all"',c);
 assert.equal(vm.runInContext('eligibleEvents().length',c),0);
 vm.runInContext('state.city="Karachi";state.category="expos"',c);
 assert.equal(vm.runInContext('eligibleEvents().length',c),1);
});
test('WhatsApp message retains all event details and Rackelto signature',()=>{
 const c=runtime();c.data=fixture;const message=vm.runInContext('eventShareText(asPublishedEvent(data))',c);
 for(const x of ['Karachi Public Expo','Category:','Date:','Time:','Venue:','PKR 950','Rackelto Technologies Ltd'])assert.ok(message.includes(x));
});
test('event card HTML escapes untrusted event titles',()=>{
 const c=runtime();c.data={...fixture,name:'<img src=x onerror=alert(1)>'};
 const card=vm.runInContext('eventCardMarkup(asPublishedEvent(data))',c);
 assert.ok(card.includes('&lt;img'));assert.ok(!card.includes('<img src=x'));
});
