/** Candidate matching is a suggestion, never proof that two accounts belong to one person. */
export type IdentityAccount={personId:string;slug:string;name:string;platform:string;handle:string};
export type IdentityMatch={personId:string;slug:string;name:string;accounts:{platform:string;handle:string;reason:string}[]};
const key=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
// Long handle variants differing by one repeated letter (e.g. anjum / annjum).
// Do not use generic edit distance: a single changed digit/letter can identify another creator.
function repeatedLetterVariant(a:string,b:string){
 if(a.length>b.length)[a,b]=[b,a];
 if(a.length<9||b.length!==a.length+1)return false;
 for(let i=0;i<b.length;i++)if(/[a-z]/.test(b[i])&&(b[i]===b[i-1]||b[i]===b[i+1])&&b.slice(0,i)+b.slice(i+1)===a)return true;
 return false;
}
export function matchIdentity(handle:string,name:string,accounts:IdentityAccount[]):IdentityMatch[]{
 const h=key(handle),n=key(name),matches=new Map<string,IdentityMatch>();
 for(const a of accounts){
  const k=key(a.handle),person=key(a.name);
  const reason=h.length>=4&&h===k?'same normalized handle':n.length>=5&&n===person?'same normalized name':n.length>=5&&n===k?'name matches handle':repeatedLetterVariant(h,k)?'similar handle (repeated letter; verify manually)':null;
  if(!reason)continue;
  const m=matches.get(a.personId)??{personId:a.personId,slug:a.slug,name:a.name,accounts:[]};
  m.accounts.push({platform:a.platform,handle:a.handle,reason});matches.set(a.personId,m);
 }
 return [...matches.values()].sort((a,b)=>a.slug.localeCompare(b.slug)).map(m=>({...m,accounts:m.accounts.sort((a,b)=>a.platform.localeCompare(b.platform)||a.handle.localeCompare(b.handle))}));
}
