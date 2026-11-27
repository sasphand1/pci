import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,effectiveDeliveryState,canCancel,sameDraft,sameReceipt} from '../../src/modules/broadcast/model.ts';
const now=Date.parse('2026-11-27T00:00:00Z');
const d=(state,claim_deadline=null)=>({state,claim_deadline});
test('drafts and cancelled jobs are never queued',()=>{
 assert.equal(summarize('draft',[d('pending')],now),'draft');
 assert.equal(summarize('cancelled',[d('cancelled')],now),'cancelled');
});
test('confirmed jobs report real per-channel progress',()=>{
 assert.equal(summarize('confirmed',[d('pending')],now),'queued');
 assert.equal(summarize('confirmed',[d('pending'),d('delivered')],now),'dispatching');
 assert.equal(summarize('confirmed',[d('claimed',new Date(now+1))],now),'dispatching');
 assert.equal(summarize('confirmed',[d('delivered'),d('delivered')],now),'delivered');
 assert.equal(summarize('confirmed',[d('delivered'),d('failed')],now),'partial');
 assert.equal(summarize('confirmed',[d('failed')],now),'failed');
});
test('expired claims are uncertain, never failed or delivered',()=>{
 assert.equal(effectiveDeliveryState(d('claimed',new Date(now)),now),'uncertain');
 assert.equal(summarize('confirmed',[d('claimed',new Date(now-1)),d('pending')],now),'attention');
 assert.equal(summarize('confirmed',[d('uncertain'),d('delivered')],now),'attention');
 assert.equal(summarize('confirmed',[],now),'attention');
});
test('cancellation is only available before dispatch',()=>{
 assert.equal(canCancel('draft',['pending']),true);
 assert.equal(canCancel('confirmed',['pending','pending']),true);
 for(const state of ['claimed','delivered','failed','uncertain','cancelled'])assert.equal(canCancel('confirmed',['pending',state]),false);
 assert.equal(canCancel('confirmed',[]),false);
 assert.equal(canCancel('cancelled',['cancelled']),false);
});
test('idempotent draft replay is exact and insensitive to destination order',()=>{
 const draft={title:'A',body:'B',mediaRef:'asset/1',destinations:['youtube','instagram']};
 assert.ok(sameDraft(draft,{...draft,destinations:['instagram','youtube']}));
 for(const change of [{title:'different'},{body:'different'},{mediaRef:null},{destinations:['youtube']}])assert.equal(sameDraft(draft,{...draft,...change}),false);
});
test('receipt replay must match outcome, provider reference and code',()=>{
 const r={outcome:'delivered',externalId:'platform-id',code:null};assert.ok(sameReceipt(r,{...r}));
 assert.equal(sameReceipt(r,{...r,externalId:'other'}),false);
 assert.equal(sameReceipt(r,{...r,outcome:'uncertain'}),false);
 assert.equal(sameReceipt(r,{...r,code:'other'}),false);
});
