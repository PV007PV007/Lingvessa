import { policy } from './policy.js';
import type { Policy } from './policy.js';
export type Candidate = {knowledge_item_id:string;facet:string;skill:string;item_id:string;lesson_id:string;publication_id:string;content_version_id:string;
  surface:string;due_at:string|null;unresolved:boolean;estimate:number;uncertainty:number;selected:boolean;fresh:boolean;reason?:string;source_evidence_id?:string|null};
export function buildSession(input:Candidate[], at:string, cap:number,p:Policy=policy):Candidate[]{
  if(!Number.isInteger(cap)||cap<1||cap>p.session_cap)throw new Error('INVALID_SESSION_CAP');
  const score=(c:Candidate)=>c.due_at!==null&&Date.parse(c.due_at)<=Date.parse(at)?0:c.unresolved?1:
    !c.fresh&&(c.estimate<p.weak_estimate||c.uncertainty>p.high_uncertainty)?2:c.selected?3:4;
  const rows=[...input].sort((a,b)=>score(a)-score(b)||(a.due_at??'9999').localeCompare(b.due_at??'9999')||a.item_id.localeCompare(b.item_id));
  const targets=new Set<string>(),surfaces=new Set<string>();const output:Candidate[]=[];let recycled=0;
  while(rows.length&&output.length<cap){
    const first=rows[0]!;const previous=output.at(-1);const index=previous?rows.findIndex(c=>score(c)===score(first)&&c.skill!==previous.skill&&c.knowledge_item_id!==previous.knowledge_item_id):-1;
    const c=rows.splice(index<0?0:index,1)[0]!;const key=`${c.knowledge_item_id}:${c.facet}`;const surface=c.surface.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase();
    if(targets.has(key)||surfaces.has(surface)||output.at(-1)?.knowledge_item_id===c.knowledge_item_id)continue;
    const rank=score(c);if(rank===4&&recycled++>=p.recycle_cap)continue;
    targets.add(key);surfaces.add(surface);output.push({...c,reason:['due','unresolved_mistake','weak_or_uncertain','selected','limited_recycle'][rank]!});
  }
  return output;
}
