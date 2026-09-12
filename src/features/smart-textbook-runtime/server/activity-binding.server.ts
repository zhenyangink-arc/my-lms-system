import 'server-only';
import { capsuleSchema,type PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { activityExecutionSchema,activityResponseSchema,type ActivityExecution,type ActivityResponse } from '../core/activity.ts';

export function activityExecutions(manifest:LessonManifestV1,bindings:PrivateBindings,ref:string,locale:'zh-CN'|'ko-KR'):ActivityExecution[]{
  const capsule=capsuleSchema.parse(bindings.capsules.find(c=>c.id===ref));if(capsule.kind!=='learning')throw Error('CAPSULE_SCOPE');
  const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.props.capsuleRef===ref);if(!block||block.type!=='compat.learning.v1')throw Error('BLOCK_SCOPE');
  const part=(activityId:string,path:string)=>{const row=bindings.identities.find(i=>i.owner===activityId&&i.legacyPath===path);if(!row)throw Error('FROZEN_ACTIVITY_ID_MISSING');return row.partId;};
  return capsule.activities.filter(c=>block.props.activityRefs.includes(c.activityId)).map(c=>{
    const a=manifest.activityRefs.find(a=>a.id===c.activityId);if(!a)throw Error('ACTIVITY_REF_MISSING');
    const local=(v:{'zh-CN'?:string;'ko-KR'?:string})=>v[locale]??v['zh-CN']??v['ko-KR']??'';
    const base={ref:a.id,title:local(a.publicPresentation.prompt),instruction:a.publicPresentation.instruction?local(a.publicPresentation.instruction):''};
    let value:ActivityExecution;
    switch(c.activityKey){
      case 'vocabulary-check':case 'grammar-choice':case 'grammar-judgment':case 'reading-profile':
        value={...base,kind:'choice-group',items:c.settings.items.map((item,i)=>({id:part(a.id,`public_config.items[${i}]`),prompt:item.question,placeholder:'',options:item.options.map((text,j)=>({id:part(a.id,`public_config.items[${i}].options[${j}]`),text}))}))};break;
      case 'grammar-fill':value={...base,kind:'fill-group',items:c.settings.items.map((item,i)=>({id:part(a.id,`public_config.items[${i}]`),prompt:item.label,placeholder:item.placeholder,options:[]}))};break;
      case 'dialogue-fact-check':case 'dialogue-response':value={...base,kind:'single',options:a.publicPresentation.options.map(o=>({id:o.id,text:local(o.text)}))};break;
      case 'review-multiple':value={...base,kind:'multiple',options:a.publicPresentation.options.map(o=>({id:o.id,text:local(o.text)}))};break;
      case 'pattern-order':value={...base,kind:'ordering',options:a.publicPresentation.options.map(o=>({id:o.id,text:local(o.text)}))};break;
      case 'write-profile':value={...base,kind:'writing',checklist:c.settings.informationChecklist.map((text,i)=>({id:part(a.id,`public_config.informationChecklist[${i}]`),text})),confirmation:c.settings.rubricConfirmation};break;
      case 'self-check':value={...base,kind:'self-check',items:c.settings.items.map((i,index)=>({id:part(a.id,`public_config.items[${index}]`),text:i.label})),returnTargets:c.settings.returnNodes.map((n,i)=>({id:part(a.id,`public_config.returnNodes[${i}]`),text:n.label}))};break;
      default:value={...base,kind:'unavailable',reason:'此复合流程尚未完成领域服务与历史恢复验收。'};
    }
    return activityExecutionSchema.parse(value);
  });
}

/** Converts stable responses to the unchanged legacy grader's expected vector.
 * Uses explicit frozen identity lookups; never computes correctness. */
export function boundActivityResponse(descriptor:ActivityExecution,input:unknown,bindings?:PrivateBindings):number|number[]|string[]|{text:string;informationKinds:boolean[];rubricConfirmed:boolean}|{checks:Array<'can'|'review'>;returnNodes:string[];note:string}{
  const response=activityResponseSchema.parse(input);if(response.kind!==descriptor.kind)throw Error('RESPONSE_KIND_MISMATCH');
  const unique=(ids:string[])=>{if(new Set(ids).size!==ids.length)throw Error('DUPLICATE_RESPONSE_ID');};
  const optionIndex=(options:Array<{id:string}>,id:string)=>{const index=options.findIndex(o=>o.id===id);if(index<0)throw Error('UNBOUND_OPTION');return index;};
  if(descriptor.kind==='writing'&&response.kind==='writing'){
    unique(response.information.map(i=>i.partId));if(response.information.length!==descriptor.checklist.length)throw Error('WRITING_CHECKLIST_COVERAGE');
    return {text:response.text,informationKinds:descriptor.checklist.map(item=>{const value=response.information.find(i=>i.partId===item.id);if(!value)throw Error('UNKNOWN_INFORMATION');return value.checked;}),rubricConfirmed:response.rubricConfirmed};
  }
  if(descriptor.kind==='self-check'&&response.kind==='self-check'){
    unique(response.checks.map(i=>i.partId));unique(response.returnTargetIds);if(response.checks.length!==descriptor.items.length||!bindings)throw Error('SELF_CHECK_COVERAGE');
    const capsule=bindings.capsules.find(c=>c.kind==='learning'&&c.activities.some(a=>a.activityId===descriptor.ref));if(!capsule||capsule.kind!=='learning')throw Error('SELF_CHECK_SCOPE');
    const activity=capsule.activities.find(a=>a.activityId===descriptor.ref);if(activity?.activityKey!=='self-check')throw Error('SELF_CHECK_SCOPE');
    return {checks:descriptor.items.map(item=>{const value=response.checks.find(i=>i.partId===item.id);if(!value)throw Error('UNKNOWN_CHECK');return value.value;}),returnNodes:response.returnTargetIds.map(id=>{
      const index=optionIndex(descriptor.returnTargets,id),identity=bindings.identities.find(i=>i.owner===descriptor.ref&&i.legacyPath===`public_config.returnNodes[${index}]`);if(identity?.partId!==id)throw Error('RETURN_BINDING_MISMATCH');return activity.settings.returnNodes[index].value;
    }),note:response.note};
  }
  if(descriptor.kind==='single'&&response.kind==='single')return optionIndex(descriptor.options,response.optionId);
  if((descriptor.kind==='multiple'||descriptor.kind==='ordering')&&(response.kind==='multiple'||response.kind==='ordering')){
    unique(response.optionIds);if(descriptor.kind==='ordering'&&response.optionIds.length!==descriptor.options.length)throw Error('INCOMPLETE_ORDER');return response.optionIds.map(id=>optionIndex(descriptor.options,id));
  }
  if((descriptor.kind==='choice-group'||descriptor.kind==='fill-group')&&(response.kind==='choice-group'||response.kind==='fill-group')){
    unique(response.items.map(i=>i.partId));if(response.items.length!==descriptor.items.length)throw Error('INCOMPLETE_RESPONSE');
    return descriptor.items.map(item=>{const r=response.items.find(r=>r.partId===item.id);if(!r)throw Error('UNBOUND_PART');return 'optionId'in r?optionIndex(item.options,r.optionId):r.text;}) as number[]|string[];
  }
  throw Error('ACTIVITY_EXECUTOR_UNAVAILABLE');
}
