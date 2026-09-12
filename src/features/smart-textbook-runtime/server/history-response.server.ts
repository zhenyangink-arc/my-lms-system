import 'server-only';
import { z } from 'zod';
import type { ActivityExecution,ActivityResponse } from '../core/activity.ts';
import { activityResponseSchema } from '../core/activity.ts';
import type { PatternExecution,PatternResponse } from '../core/patterns.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';

/** Inverse of boundActivityResponse; only explicit public response fields cross.
 * No raw row, metadata, secret or legacy coordinates leave this adapter. */
export function restoreActivityResponse(a:ActivityExecution,input:unknown,b:PrivateBindings):ActivityResponse|null{
  if(input===null||input===undefined||a.kind==='unavailable')return null;
  const index=(value:unknown,options:{id:string}[])=>{const i=z.number().int().nonnegative().parse(value);if(!options[i])throw Error('HISTORY_OPTION');return options[i].id;};
  const vector=()=>z.array(z.unknown()).parse(input);
  const group=()=>{const rows=vector();if(!('items'in a)||rows.length!==a.items.length)throw Error('HISTORY_COVERAGE');return rows;};
  switch(a.kind){
    case 'single':return {kind:a.kind,optionId:index(input,a.options)};
    case 'multiple':case 'ordering':return activityResponseSchema.parse({kind:a.kind,optionIds:vector().map(x=>index(x,a.options))});
    case 'choice-group':{const rows=group();return {kind:a.kind,items:a.items.map((i,n)=>({partId:i.id,optionId:index(rows[n],i.options)}))};}
    case 'fill-group':{const rows=group();return {kind:a.kind,items:a.items.map((i,n)=>({partId:i.id,text:z.string().parse(rows[n])}))};}
    case 'writing':{const row=z.object({text:z.string(),informationKinds:z.array(z.boolean()),rubricConfirmed:z.boolean()}).parse(input);if(row.informationKinds.length!==a.checklist.length)throw Error('HISTORY_COVERAGE');return {kind:a.kind,text:row.text,information:a.checklist.map((i,n)=>({partId:i.id,checked:row.informationKinds[n]})),rubricConfirmed:row.rubricConfirmed};}
    case 'self-check':{const row=z.object({checks:z.array(z.enum(['can','review'])),returnNodes:z.array(z.string()),note:z.string().optional()}).parse(input);if(row.checks.length!==a.items.length)throw Error('HISTORY_COVERAGE');const c=b.capsules.find(c=>c.kind==='learning'&&c.activities.some(x=>x.activityId===a.ref));const config=c?.kind==='learning'?c.activities.find(x=>x.activityId===a.ref):null;if(config?.activityKey!=='self-check')throw Error('HISTORY_SCOPE');return {kind:a.kind,checks:a.items.map((i,n)=>({partId:i.id,value:row.checks[n]})),returnTargetIds:row.returnNodes.map(value=>{const n=config.settings.returnNodes.findIndex(x=>x.value===value);if(n<0)throw Error('HISTORY_RETURN');return a.returnTargets[n].id;}),note:row.note??''};}
  }
}
export function restorePatternResponses(a:PatternExecution,input:unknown):PatternResponse[]{
  const rows=z.array(z.union([z.string(),z.number()])).parse(input),turns=a.turns.filter(t=>t.kind!=='line');
  if(rows.length!==turns.length)throw Error('PATTERN_HISTORY_COVERAGE');
  return turns.map((t,n)=>{
    if(t.kind==='choice'){const option=t.options[z.number().int().nonnegative().parse(rows[n])];if(!option)throw Error('PATTERN_HISTORY_OPTION');return {kind:'choice',partId:t.id,optionId:option.id};}
    if(t.kind!=='composition')throw Error('PATTERN_HISTORY_KIND');
    // Legacy stores assembled Korean, not token IDs. Exact tokenization only;
    // ambiguous compositions remain unsupported rather than guessed identities.
    let rest=z.string().parse(rows[n]);const ids:string[]=[];
    while(rest){const matches=t.tokens.filter(x=>rest===x.text||rest.startsWith(x.text+' ')||(/[?.!,]$/.test(rest)&&rest.startsWith(x.text)&&/^[?.!,]/.test(rest.slice(x.text.length))));const longest=matches.sort((a,b)=>b.text.length-a.text.length)[0];if(!longest)throw Error('PATTERN_HISTORY_TOKEN');ids.push(longest.id);rest=rest.slice(longest.text.length).trimStart();if(ids.length>100)throw Error('PATTERN_HISTORY_TOKEN');}
    return {kind:'composition',partId:t.id,tokenIds:ids};
  });
}
