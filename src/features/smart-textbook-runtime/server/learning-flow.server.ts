import 'server-only';
import { z } from 'zod';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { ReadinessBindings } from '../../../lib/smart-textbook-legacy-adapter/readiness-contracts.server.ts';
import type { ServiceScope } from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import { assertServiceScope } from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import { activityExecutions,boundActivityResponse } from './activity-binding.server.ts';
import { activityPages,boundPageResponse } from './activity-pages.server.ts';
import { patternExecutions,boundPatternCheck } from './pattern-binding.server.ts';
import { learningRestoreSchema,type LearningRestore } from '../core/learning-flow.ts';
import { pageResponseSchema,type PageResponse,type PageCheck } from '../core/activity-pages.ts';
import { patternResponseSchema,type PatternResponse } from '../core/patterns.ts';
import type { ActivityResponse } from '../core/activity.ts';
import type { ActivityResult } from '../core/services.ts';

type SavedPage={response:PageResponse;check:PageCheck;expected:Array<number|string>;ready:boolean};
type Practice={expiresAt:number;responses:Map<string,ActivityResponse>;results:Map<string,ActivityResult>;pages:Map<string,SavedPage>;patterns:Map<string,PatternResponse[]>};
/** Only preview practice / in-flight domain request state. Not a progress DB. */
export function createLearningPracticeStore(now=()=>Date.now()){
  const scopes=new Map<string,Practice>();
  return (key:string,expiresAt:number)=>{for(const [k,s]of scopes)if(s.expiresAt<=now())scopes.delete(k);if(expiresAt<=now())throw Error('LEARNING_SESSION_EXPIRED');let s=scopes.get(key);if(!s){if(scopes.size>=32)throw Error('LEARNING_STORE_FULL');s={expiresAt,responses:new Map(),results:new Map(),pages:new Map(),patterns:new Map()};scopes.set(key,s);}return s;};
}
export type FlowAuthority={
  ownerId:string;sessionScope:string;expiresAt:number;manifest:LessonManifestV1;bindings:PrivateBindings;services:ReadinessBindings;scope:ServiceScope;locale:'zh-CN'|'ko-KR';preview:boolean;
  check(input:{activityId:string;itemIndices:number[];response:Array<number|string>;pageIndex?:number}):Promise<{ok:boolean;results?:boolean[];answers?:Array<number|string>}>;
  submit(activityId:string,response:unknown):Promise<ActivityResult>;
  history?(capsuleRef:string):Promise<LearningRestore>;
};
export function createLearningFlow(authorize:()=>Promise<FlowAuthority>,store:ReturnType<typeof createLearningPracticeStore>){
  async function scoped(capsuleRef:string){const a=await authorize();assertServiceScope(a.services,a.scope);const c=a.bindings.capsules.find(c=>c.id===capsuleRef);if(!c||c.kind!=='learning'||a.manifest.version.id!==a.scope.versionId)throw Error('FLOW_CAPSULE_SCOPE');const state=store(JSON.stringify([a.ownerId,a.sessionScope,a.manifest.snapshot.id,a.scope.sourceRevision,c.id]),a.expiresAt);return {a,c,state};}
  async function restore(capsuleRef:string){const {a,c,state}=await scoped(capsuleRef);const native=a.manifest.blocks.filter(b=>b.type==='multiple_choice'&&b.stepId===c.stepId).map(b=>b.type==='multiple_choice'?b.props.activityRef:'');const refs=[...new Set([...activityExecutions(a.manifest,a.bindings,capsuleRef,a.locale).map(x=>x.ref),...native])];const base=a.history?await a.history(capsuleRef):{snapshotId:a.manifest.snapshot.id,capsuleRef,revision:a.scope.sourceRevision,activities:refs.map(activityRef=>({activityRef,completed:false,response:null,feedback:null})),pages:[],patterns:[],practiceAcceptedRefs:[]};
    return learningRestoreSchema.parse({...base,activities:base.activities.map(x=>({...x,response:state.responses.get(x.activityRef)??x.response,feedback:state.results.get(x.activityRef)??x.feedback})),pages:[...base.pages.filter(p=>!state.pages.has(p.pageId)),...[...state.pages].map(([pageId,p])=>({pageId,response:p.response,checked:true,ready:p.ready,items:p.check.items}))],patterns:[...base.patterns.filter(p=>!state.patterns.has(p.activityRef)),...[...state.patterns].map(([activityRef,responses])=>({activityRef,responses}))],practiceAcceptedRefs:a.preview?[...state.results].filter(([,r])=>r.ok&&r.correct!==false).map(([id])=>id):[]});}
  async function pageCheck(capsuleRef:string,pageId:string,input:unknown){
    const {a,state}=await scoped(capsuleRef),page=activityPages(a.bindings,a.services,capsuleRef,a.locale).find(p=>p.pageId===pageId);if(!page)throw Error('FLOW_PAGE_SCOPE');
    const response=pageResponseSchema.parse(input),args=boundPageResponse(a.services,a.scope,page,response);
    const result=await a.check(a.preview?{activityId:args.activityId,itemIndices:args.itemIndices,response:args.response}:args);
    if(!result.ok||result.results?.length!==page.items.length||result.answers?.length!==page.items.length)throw Error('FLOW_CHECK_FAILED');
    const check:PageCheck={pageId,items:page.items.map((i,n)=>({partId:i.partId,correct:result.results![n]})),formalCompletion:false,progressDelta:null};
    state.pages.set(pageId,{response,check,expected:result.answers,ready:result.results.every(Boolean)});return check;
  }
  async function revealPage(capsuleRef:string,pageId:string){
    const {a,state}=await scoped(capsuleRef);let saved=state.pages.get(pageId);
    if(!saved){const history=(await restore(capsuleRef)).pages.find(p=>p.pageId===pageId&&p.checked);if(!history)throw Error('REVEAL_REQUIRES_CHECK');await pageCheck(capsuleRef,pageId,history.response);saved=state.pages.get(pageId)!;}
    const page=activityPages(a.bindings,a.services,capsuleRef,a.locale).find(p=>p.pageId===pageId);if(!page)throw Error('FLOW_PAGE_SCOPE');
    // Explicit post-check correction only, matching old revealGrammarAnswers.
    // Never part of Manifest, initial load, or raw answer_key disclosure.
    const response=page.items.map((i,n)=>{if(i.kind==='fill')return {kind:'fill' as const,partId:i.partId,text:z.string().parse(saved.expected[n])};const option=i.options[z.number().int().nonnegative().parse(saved.expected[n])];if(!option)throw Error('FLOW_CORRECTION_SCOPE');return {kind:'choice' as const,partId:i.partId,optionId:option.id};});
    const check=await pageCheck(capsuleRef,pageId,response);return {response,check};
  }
  async function finishPages(capsuleRef:string,activityRef:string){
    const {a,state}=await scoped(capsuleRef),pages=activityPages(a.bindings,a.services,capsuleRef,a.locale).filter(p=>p.activityRef===activityRef),history=await restore(capsuleRef);
    if(!pages.length)throw Error('FLOW_ACTIVITY_SCOPE');const rows=pages.map(p=>{const saved=history.pages.find(x=>x.pageId===p.pageId&&x.ready);if(!saved)throw Error('FLOW_PAGES_INCOMPLETE');return boundPageResponse(a.services,a.scope,p,saved.response);});
    const ordered=rows.flatMap(r=>r.itemIndices.map((index,n)=>({index,value:r.response[n]}))).sort((a,b)=>a.index-b.index);
    if(new Set(ordered.map(r=>r.index)).size!==ordered.length||ordered.some((r,n)=>r.index!==n))throw Error('FLOW_PAGE_COVERAGE');
    const result=await a.submit(activityRef,ordered.map(x=>x.value));state.results.set(activityRef,result);return result;
  }
  async function submit(capsuleRef:string,activityRef:string,response:ActivityResponse){const {a,state}=await scoped(capsuleRef);const descriptor=activityExecutions(a.manifest,a.bindings,capsuleRef,a.locale).find(x=>x.ref===activityRef);if(!descriptor)throw Error('FLOW_ACTIVITY_SCOPE');const result=await a.submit(activityRef,boundActivityResponse(descriptor,response,a.bindings));state.responses.set(activityRef,response);state.results.set(activityRef,result);return result;}
  async function patternCheck(capsuleRef:string,activityRef:string,input:unknown){const {a,state}=await scoped(capsuleRef),response=patternResponseSchema.parse(input),args=boundPatternCheck(a.manifest,a.bindings,capsuleRef,activityRef,response);const result=await a.check(args);if(!result.ok||result.results?.length!==1)throw Error('FLOW_PATTERN_CHECK');if(result.results[0]){const old=state.patterns.get(activityRef)??[];state.patterns.set(activityRef,[...old.filter(x=>x.partId!==response.partId),response]);}return {activityRef,partId:response.partId,correct:result.results[0],formalCompletion:false as const,progressDelta:null};}
  async function finishPattern(capsuleRef:string,activityRef:string,input:PatternResponse[]){const {a,state}=await scoped(capsuleRef),pattern=patternExecutions(a.manifest,a.bindings,capsuleRef,a.locale).find(p=>p.ref===activityRef),responses=z.array(patternResponseSchema).max(100).parse(input);if(!pattern)throw Error('FLOW_PATTERN_SCOPE');const turns=pattern.turns.filter(t=>t.kind!=='line');if(responses.length!==turns.length||new Set(responses.map(r=>r.partId)).size!==responses.length)throw Error('FLOW_PATTERN_COVERAGE');const args=turns.map(t=>{const response=responses.find(r=>r.partId===t.id);if(!response)throw Error('FLOW_PATTERN_COVERAGE');return boundPatternCheck(a.manifest,a.bindings,capsuleRef,activityRef,response);});const result=await a.submit(activityRef,args.flatMap<number|string>(x=>x.response));state.results.set(activityRef,result);if(result.ok&&result.correct!==false)state.patterns.set(activityRef,responses);return result;}
  async function submitNative(capsuleRef:string,activityRef:string,optionId:string){
    const {a,c,state}=await scoped(capsuleRef),block=a.manifest.blocks.find(b=>b.type==='multiple_choice'&&b.stepId===c.stepId&&b.props.activityRef===activityRef);
    const activity=a.manifest.activityRefs.find(r=>r.id===activityRef),binding=a.bindings.activities.find(b=>b.ref===activityRef&&b.versionId===a.manifest.version.id);
    const index=activity?.publicPresentation.options.findIndex(o=>o.id===optionId)??-1;
    if(!block||!binding||activity?.type!=='single_choice'||index<0)throw Error('NATIVE_ACTIVITY_SCOPE');
    const result=await a.submit(binding.activityId,index);state.responses.set(activityRef,{kind:'single',optionId});state.results.set(activityRef,result);return result;
  }
  return {restore,pageCheck,revealPage,finishPages,submit,submitNative,patternCheck,finishPattern};
}
