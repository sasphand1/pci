/** Bulk add helpers. A line is: account[, person name[, niche]]. Lines starting with # and empty lines are left alone. */
export function applyDefaultNiche(text:string, slug:string):string{
  const niche=slug.trim();
  if(!niche)return text;
  return text.split(/\r?\n/).map(line=>{
    const t=line.trim();
    if(!t||t.startsWith('#'))return line;
    const parts=t.split(',').map(p=>p.trim());
    if(parts.length>=3&&parts[2])return line;          // the line already names a niche: it wins
    const account=parts[0],person=parts[1]??'';
    return `${account}, ${person}, ${niche}`;
  }).join('\n');
}

/** Adds or removes one id from a selection without changing the original list. */
export function togglePage(selected:string[], pageIds:string[], on:boolean):string[]{
  const rest=selected.filter(id=>!pageIds.includes(id));
  return on?[...rest,...pageIds]:rest;
}
