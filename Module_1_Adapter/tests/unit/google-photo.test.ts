import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGooglePhoto,GooglePhotoError} from '../../src/modules/local/google-photo.ts';
const id='ChIJexample1234';
const name=`places/${id}/photos/AbC_123`;
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('one fresh metadata request then one media request; attribution and source returned, no key exposed',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];const stages:string[]=[];
 const fake:typeof fetch=async(input,init)=>{calls.push({url:String(input),init});return calls.length===1?response({photos:[{name,googleMapsUri:'https://www.google.com/maps/place/example',authorAttributions:[{displayName:'Author',uri:'https://www.google.com/maps/contrib/1',photoUri:'https://lh3.googleusercontent.com/avatar'}]}]}):response({photoUri:'https://lh3.googleusercontent.com/photo'});};
 const r=await fetchGooglePhoto(id,'SECRET',async s=>{stages.push(s);},fake);
 assert.deepEqual(stages,['details','media']);assert.equal(calls.length,2);assert.equal((calls[0].init?.headers as Record<string,string>)['X-Goog-FieldMask'],'photos');assert.equal(calls[1].url,`https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&skipHttpRedirect=true`);assert.equal(calls[0].init?.cache,'no-store');assert.equal(r.authorAttributions[0].displayName,'Author');assert.equal(r.photoUri,'https://lh3.googleusercontent.com/photo');assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('no photo metadata means no media call',async()=>{const stages:string[]=[];await assert.rejects(fetchGooglePhoto(id,'k',async s=>{stages.push(s);},async()=>response({photos:[]})),(e:unknown)=>e instanceof GooglePhotoError&&e.code==='GOOGLE_PHOTO_UNAVAILABLE');assert.deepEqual(stages,['details']);});
test('quota denied before media prevents the media call',async()=>{let n=0;await assert.rejects(fetchGooglePhoto(id,'k',async s=>{if(s==='media')throw Error('quota');},async()=>{n++;return response({photos:[{name}]});}),/quota/);assert.equal(n,1);});
test('resource from another place cannot trigger photo media',async()=>{let n=0;await assert.rejects(fetchGooglePhoto(id,'k',async()=>{},async()=>{n++;return response({photos:[{name:'places/otherPlace123/photos/abc'}]});}),GooglePhotoError);assert.equal(n,1);});
test('429 does not retry',async()=>{let n=0;await assert.rejects(fetchGooglePhoto(id,'k',async()=>{},async()=>{n++;return response({},429);}),{code:'GOOGLE_PHOTO_QUOTA'});assert.equal(n,1);});
test('unexpected media domain rejected',async()=>{let n=0;await assert.rejects(fetchGooglePhoto(id,'k',async()=>{},async()=>++n===1?response({photos:[{name}]}):response({photoUri:'https://googleusercontent.com.evil.test/photo'})),{code:'GOOGLE_PHOTO_RESPONSE'});});
