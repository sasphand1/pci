/** PCI Events category intelligence v1.
 * Pure, deterministic, no LLM calls, API keys, external services or speculative classification.
 * An uncertain result is ALWAYS held for human review; categorization never publishes events.
 */
export const ENGINE_VERSION='events-rules-2.0.0';
export const EVENT_CATEGORIES=Object.freeze([
 {id:'sports',label:'Sports'},
 {id:'education',label:'Education & Learning'},
 {id:'gaming',label:'Gaming & Esports'},
 {id:'technology',label:'Technology & Innovation'},
 {id:'business',label:'Business & Expos'},
 {id:'arts',label:'Arts & Entertainment'},
 {id:'community',label:'Community & Festivals'},
 {id:'fashion',label:'Fashion & Beauty'},
 {id:'health',label:'Medical & Health'},
 {id:'food',label:'Food & Dining'}
]);
const CANONICAL=new Set(EVENT_CATEGORIES.map(e=>e.id));
export const LEGACY_MAP=Object.freeze({sports:'sports',arts:'arts',expos:'business',conferences:'education',community:'community'});
export function canonicalCategory(value){
 const key=typeof value==='string'?value.trim().toLowerCase():'';
 return CANONICAL.has(key)?key:(LEGACY_MAP[key]||null);
}
const PATTERNS={
 sports:[/\bcricket\b/i,/\bpsl\b/i,/\bfootball\b/i,/\bfutsal\b/i,/\bmarathon\b/i,/\bat(hletics|hlete)\b/i,/\bbadminton\b/i,/\bbasketball\b/i,/\btennis\b/i,/\bwrestling\b/i,/\bmatch\b/i,/\bcycling\b/i],
 education:[/\buniversity\b/i,/\bscholarship\b/i,/\bstudent\b/i,/\bacademic\b/i,/\bseminar\b/i,/\bcareer fair\b/i,/\beducation\b/i,/\bbook fair\b/i,/\bliterary\b/i,/\blecture\b/i,/\btraining\b/i,/\bcollege\b/i],
 gaming:[/\besports?\b/i,/\be-sports\b/i,/\bgaming\b/i,/\bgamers?\b/i,/\blan party\b/i,/\bpubg\b/i,/\bvalorant\b/i,/\bdota\b/i,/\btekken\b/i,/\bcounter.?strike\b/i,/\bplaystation\b/i],
 technology:[/\bhackathon\b/i,/\bartificial intelligence\b/i,/\bmachine learning\b/i,/\brobotics?\b/i,/\bsoftware\b/i,/\bstartup\b/i,/\btechnology\b/i,/\bdeveloper\b/i,/\bcybersecurity\b/i,/\bcloud computing\b/i,/\bfintech\b/i,/\bblockchain\b/i,/\btech fest\b/i],
 business:[/\btrade (fair|show|expo)\b/i,/\bindustry expo\b/i,/\bbusiness\b/i,/\bcommerce\b/i,/\bexhibition\b/i,/\bbuilding materials\b/i,/\bconstruction expo\b/i,/\bentrepreneurship\b/i,/\bnetworking\b/i,/\binvestment\b/i,/\bconsumer expo\b/i],
 arts:[/\bconcert\b/i,/\bmusic\b/i,/\btheat(re|er)\b/i,/\bfilm\b/i,/\bcinema\b/i,/\bcomedy\b/i,/\bpoetry\b/i,/\barts?\b/i,/\bcultural performance\b/i,/\bpainting\b/i,/\bqawwali\b/i],
 community:[/\bcommunity\b/i,/\bfestival\b/i,/\bcelebration\b/i,/\bheritage\b/i,/\bcharity\b/i,/\bvolunteer\b/i,/\breligious\b/i,/\beid\b/i,/\bmela\b/i,/\bpublic gathering\b/i],
 fashion:[/\bfashion\b/i,/\bclothing\b/i,/\bcouture\b/i,/\brunway\b/i,/\bdesigner showcase\b/i,/\bbeauty expo\b/i,/\btextile fashion\b/i,/\bmakeup\b/i,/\bbridal wear\b/i],
 health:[/\bmedical\b/i,/\bhealthcare\b/i,/\bhospital\b/i,/\bpharma\b/i,/\bpharmaceutical\b/i,/\bdoctors?\b/i,/\bdental\b/i,/\bcardiology\b/i,/\bmedicine\b/i,/\bpublic health\b/i,/\bclinical\b/i,/\bhepatology\b/i],
 food:[/\bfood\b/i,/\bculinary\b/i,/\brestaurant\b/i,/\bstreet food\b/i,/\bdining\b/i,/\bfood festival\b/i,/\bfood fest\b/i,/\bchef\b/i,/\bfoodtech\b/i,/\bfood & beverage\b/i,/\bhospitality expo\b/i]
};
export function classifyEvent({name='',description='',venue='',sourceCategory=''}={}){
 const text=[name,description,venue].filter(s=>typeof s==='string').join(' ').slice(0,1600);
 const title=String(name||'').slice(0,250);
 const scores=[];
 for(const [category,terms] of Object.entries(PATTERNS)){
  const hits=terms.filter(rx=>rx.test(text));
  const titleHits=terms.filter(rx=>rx.test(title));
  scores.push({category,points:hits.length*2+titleHits.length*3,hits:titleHits.map(x=>x.source).slice(0,2)});
 }
 scores.sort((a,b)=>b.points-a.points || EVENT_CATEGORIES.findIndex(x=>x.id===a.category)-EVENT_CATEGORIES.findIndex(x=>x.id===b.category));
 const first=scores[0],second=scores[1];
 const fallback=canonicalCategory(sourceCategory)||'community';
 if(!first||!first.points)return {category:fallback,confidence:20,state:'needs_review',reason:'No matching category evidence; source fallback only',engineVersion:ENGINE_VERSION};
 const margin=first.points-(second?.points||0);
 const ambiguous=second?.points>0&&margin<=2;
 const confidence=ambiguous?45:Math.min(95,first.points>=10?88:first.points>=6?76:62);
 return {category:first.category,confidence,state:confidence>=60?'suggested':'needs_review',reason:ambiguous?'Ambiguous evidence across categories; human review required':`Keyword evidence for ${first.category}`,engineVersion:ENGINE_VERSION};
}
