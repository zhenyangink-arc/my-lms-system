import 'server-only';
import { capsuleSchema,type PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { ReadinessBindings } from '../../../lib/smart-textbook-legacy-adapter/readiness-contracts.server.ts';
import { activityPageServiceInput,type ServiceScope } from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import { activityPageSchema,pageResponseSchema,type ActivityPage,type PageCheck } from '../core/activity-pages.ts';

/** Pages use the Phase 3C frozen progress identities, not authored display positions.
 * Option identities come from Phase 3B. Both are existing ledgers, not new IDs. */
export function activityPages(bindings:PrivateBindings,services:ReadinessBindings,capsuleRef:string,locale:'zh-CN'|'ko-KR'):ActivityPage[]{
  const capsule=capsuleSchema.parse(bindings.capsules.find(c=>c.id===capsuleRef));if(capsule.kind!=='learning')throw Error('CAPSULE_SCOPE');
  return services.activityPages.filter(p=>p.nodeId===capsule.nodeId).sort((a,b)=>a.legacyPage-b.legacyPage).map(page=>{
    const activity=capsule.activities.find(a=>a.activityId===page.activityId);if(!activity)throw Error('PAGE_ACTIVITY_SCOPE');
    const items=[...page.items].sort((a,b)=>a.legacyItem-b.legacyItem).map(item=>{
      if(activity.activityKey==='grammar-fill'){
        const legacy=activity.settings.items[item.legacyItem];if(!legacy)throw Error('PAGE_ITEM_SCOPE');
        return {kind:'fill' as const,partId:item.partId,prompt:legacy.label,placeholder:legacy.placeholder};
      }
      if(activity.activityKey!=='grammar-choice'&&activity.activityKey!=='grammar-judgment'&&activity.activityKey!=='listening-identity')throw Error('UNSUPPORTED_PAGE_ACTIVITY');
      const legacy=activity.settings.items[item.legacyItem];if(!legacy)throw Error('PAGE_ITEM_SCOPE');
      return {kind:'choice' as const,partId:item.partId,prompt:typeof legacy.question==='string'?legacy.question:legacy.question[locale],options:legacy.options.map((text,index)=>{
        const identity=bindings.identities.find(i=>i.owner===activity.activityId&&i.legacyPath===`public_config.items[${item.legacyItem}].options[${index}]`);
        if(!identity)throw Error('FROZEN_OPTION_MISSING');return {id:identity.partId,text};
      })};
    });
    let listening=null;
    if(activity.activityKey==='listening-identity'){
      const track=services.listeningAliases.find(t=>t.activityId===page.activityId&&t.legacyPage===page.legacyPage);if(!track)throw Error('LISTENING_PAGE_UNBOUND');
      listening={trackId:track.trackId,normalLimit:activity.settings.normalReplayLimit,slowLimit:activity.settings.slowReplayLimit};
    }
    return activityPageSchema.parse({pageId:page.pageId,activityRef:page.activityId,title:activity.activityKey==='listening-identity'?'听辨练习':'语法练习',items,listening});
  });
}
export function boundPageResponse(services:ReadinessBindings,scope:ServiceScope,page:ActivityPage,input:unknown){
  const response=pageResponseSchema.parse(input);if(response.length!==page.items.length||new Set(response.map(r=>r.partId)).size!==response.length)throw Error('PAGE_COVERAGE');
  const items=page.items.map(item=>{
    const r=response.find(r=>r.partId===item.partId);if(!r||r.kind!==item.kind)throw Error('PAGE_RESPONSE_SCOPE');
    if(item.kind==='fill'&&r.kind==='fill')return {partId:item.partId,response:r.text};
    if(item.kind!=='choice'||r.kind!=='choice')throw Error('PAGE_KIND');
    const index=item.options.findIndex(o=>o.id===r.optionId);if(index<0)throw Error('PAGE_OPTION_SCOPE');return {partId:item.partId,response:index};
  });
  return activityPageServiceInput(services,scope,page.pageId,items);
}
/** Invokes the EXISTING action. No duplicate page grader or client score/answer key.
 * Preview page check is observation, not a persisted completion. */
export async function checkBoundPage(services:ReadinessBindings,scope:ServiceScope,page:ActivityPage,input:unknown,check:(input:ReturnType<typeof boundPageResponse>)=>Promise<{ok:boolean;results?:boolean[];message?:string}>):Promise<PageCheck>{
  const args=boundPageResponse(services,scope,page,input),result=await check(args);
  if(!result.ok||!result.results||result.results.length!==page.items.length||result.results.some(v=>typeof v!=='boolean'))throw Error('PAGE_CHECK_FAILED');
  const frozen=services.activityPages.find(p=>p.pageId===page.pageId)!;
  return {pageId:page.pageId,items:args.itemIndices.map((index,i)=>({partId:frozen.items.find(r=>r.legacyItem===index)!.partId,correct:result.results![i]})),formalCompletion:false,progressDelta:null};
}
