import 'server-only';
import {z} from 'zod';
import {identity} from '../../../lib/smart-textbook-legacy-adapter/identity.server.ts';
import {activityResponseSchema} from '../core/activity.ts';
import {pageResponseSchema} from '../core/activity-pages.ts';
import {patternResponseSchema} from '../core/patterns.ts';
import type {RuntimeServices} from '../core/services.ts';
import type {createRuntimeLearningSessionResolver} from './learning-session.server.ts';

const token=z.string().regex(/^activity-ref-[0-9a-f]{32}$/);
const stable=z.string().min(1).max(200);
const requestSchema=z.discriminatedUnion('op',[
  z.strictObject({op:z.literal('scene-image')}),
  z.strictObject({op:z.enum(['content','activities','pages','patterns','repeat','tools','restore','refresh','recording-load'])}),
  z.strictObject({op:z.literal('submit'),activity:token,response:activityResponseSchema}),
  z.strictObject({op:z.literal('native-submit'),activity:token,response:stable}),
  z.strictObject({op:z.literal('page-check'),pageId:stable,response:pageResponseSchema}),
  z.strictObject({op:z.enum(['page-reveal','audio','transcript']),pageId:stable}),
  z.strictObject({op:z.literal('pages-finish'),activity:token}),
  z.strictObject({op:z.literal('pattern-check'),activity:token,response:patternResponseSchema}),
  z.strictObject({op:z.literal('pattern-finish'),activity:token,responses:z.array(patternResponseSchema)}),
  z.strictObject({op:z.literal('pattern-audio'),turnId:stable}),
  z.strictObject({op:z.literal('repeat-mark'),trackId:stable,segmentId:stable}),
  z.strictObject({op:z.literal('open')}),
  z.strictObject({op:z.literal('recording-restore'),activity:token}),
  z.strictObject({op:z.literal('recording-upload'),activity:token,durationSeconds:z.number().positive()}),
  z.strictObject({op:z.enum(['recording-delete','recording-audio']),activity:token,recordingId:stable}),
  z.strictObject({op:z.literal('speaking-complete'),activity:token,recordingId:stable,criteriaIds:z.array(stable).max(20)}),
  z.strictObject({op:z.literal('roleplay-complete'),activity:token,sceneId:stable,side:z.enum(['left','right'])}),
]);
const envelope=z.strictObject({sessionRef:z.string().regex(/^learning-session-[0-9a-f-]{36}$/),generation:z.number().int().nonnegative(),target:z.string().max(400),request:requestSchema});
// Rendering/domain ports share this authority subset. Published-only private
// association data must not become a requirement of isolated owner Preview.
type Authority=Omit<Awaited<ReturnType<ReturnType<typeof createRuntimeLearningSessionResolver>['resolve']>>,'manifestDigest'|'privateBindingDigest'|'publishedData'>;
type Ports=Pick<RuntimeServices,'sceneImage'|'learning'|'refresh'|'learningFlow'|'activities'|'pages'|'patterns'|'guidedRepeat'|'learningTools'|'recording'>&Partial<Pick<RuntimeServices,'submit'>>;

/** Route-free server boundary. The concrete resolver re-authenticates/revalidates
 * on EVERY request. The factory supplies existing domain adapters, never browser
 * callbacks. No student route installs this boundary in Phase 4A-11. */
export function createLearningBoundary(resolver:{resolve:(input:unknown)=>Promise<Authority>},
  createPorts:(authority:Authority)=>Promise<Ports>){
  const sessions=new Map<string,{generation:number;stepId:string;digest:string;abort:AbortController;ports:Promise<Ports>;expiresAt:number}>();
  async function resolve(sessionRef:string){
    const a=await resolver.resolve({sessionRef});
    for(const [key,s]of sessions)if(s.expiresAt<=Date.now()){s.abort.abort();sessions.delete(key);}
    let s=sessions.get(sessionRef);
    if(s&&s.digest!==a.manifest.snapshot.contentDigest){s.abort.abort();sessions.delete(sessionRef);throw Error('LEARNING_BOUNDARY_REVISION');}
    if(!s){if(sessions.size>=32)throw Error('LEARNING_BOUNDARY_CAPACITY');s={generation:0,stepId:a.manifest.navigation.entryStep,digest:a.manifest.snapshot.contentDigest,abort:new AbortController(),ports:createPorts(a),expiresAt:a.expiresAt};sessions.set(sessionRef,s);}
    return {a,s};
  }
  const target=(a:Authority,address:string)=>{const t=a.manifest.runtimeTargets.find(t=>t.id===address),block=a.manifest.blocks.find(b=>b.id===t?.blockId);if(!t||!block||block.type!=='compat.learning.v1')throw Error('LEARNING_BOUNDARY_TARGET');return {t,block};};
  return {
    async resume(input:unknown){const {sessionRef}=envelope.pick({sessionRef:true}).parse(input),{s}=await resolve(sessionRef);return {generation:s.generation,activeStepId:s.stepId};},
    async catalog(input:unknown){
      const {sessionRef}=envelope.pick({sessionRef:true}).parse(input),{a}=await resolve(sessionRef);
      return a.manifest.activityRefs.map(ref=>({runtimeRef:ref.id,serviceRef:identity('activity-ref',ref.id)}));
    },
    async enter(input:unknown){
      const r=envelope.omit({request:true}).parse(input),{a,s}=await resolve(r.sessionRef),{t}=target(a,r.target);
      if(r.generation!==s.generation)throw Error('LEARNING_BOUNDARY_GENERATION');
      if(t.stepId!==s.stepId){
        if(a.manifest.navigation.access==='completed-prefix'){
          const p=await s.ports;if(!p.refresh)throw Error('LEARNING_BOUNDARY_HISTORY');
          const state=await p.refresh(s.abort.signal),pos=a.manifest.navigation.items.indexOf(t.stepId);
          if(pos<0||a.manifest.navigation.items.slice(0,pos).some(id=>!state.completedStepIds.includes(id)))throw Error('LEARNING_BOUNDARY_LOCKED_STEP');
          if(r.generation!==s.generation)throw Error('LEARNING_BOUNDARY_GENERATION');
        }
        s.abort.abort();s.abort=new AbortController();s.stepId=t.stepId;s.generation++;
      }
      return {generation:s.generation};
    },
    async dispatch(input:unknown,signal:AbortSignal,upload?:Blob){
      const r=envelope.parse(input),{a,s}=await resolve(r.sessionRef),{t,block}=target(a,r.target);
      if(r.generation!==s.generation||t.stepId!==s.stepId)throw Error('LEARNING_BOUNDARY_GENERATION_OR_STEP');
      const combined=AbortSignal.any([signal,s.abort.signal]);combined.throwIfAborted();
      const p=await s.ports,c=block.props.capsuleRef,q=r.request;
      const activity='activity'in q?a.bindings.activities.find(b=>identity('activity-ref',b.ref)===q.activity&&b.versionId===a.manifest.version.id&&a.bindings.capsules.some(capsule=>capsule.id===c&&capsule.kind==='learning'&&capsule.activities.some(x=>x.activityId===b.activityId))):null;
      if('activity'in q&&!activity)throw Error('LEARNING_BOUNDARY_ACTIVITY');
      if(upload&&q.op!=='recording-upload')throw Error('LEARNING_BOUNDARY_UNEXPECTED_BYTES');
      const required=<T>(value:T|undefined):T=>{if(!value)throw Error('LEARNING_BOUNDARY_PORT_UNAVAILABLE');return value;};
      const recordingScope={capsuleRef:c,activityRef:activity?.ref??'',target:t.id};
      const run=async()=>{switch(q.op){
        case 'content':return p.learning(c,combined);
        case 'scene-image':return required(p.sceneImage)(c,combined);
        case 'activities':return required(p.activities).load(c,combined);
        case 'pages':return required(p.pages).load(c,combined);
        case 'patterns':return required(p.patterns).load(c,combined);
        case 'repeat':return required(p.guidedRepeat).load(c,combined);
        case 'tools':return required(p.learningTools).load(c,combined);
        case 'restore':return required(p.learningFlow).restore(c,combined);
        case 'refresh':return required(p.refresh)(combined);
        case 'submit':await required(p.activities).load(c,combined);return required(p.activities).submit(activity!.ref,q.response,combined);
        case 'native-submit':{
          const native=a.manifest.blocks.find(b=>b.type==='multiple_choice'&&b.stepId===t.stepId&&b.props.activityRef===activity!.ref);
          if(!native)throw Error('LEARNING_BOUNDARY_NATIVE_ACTIVITY');
          return required(p.submit)(activity!.ref,q.response,combined);
        }
        case 'page-check':return required(p.pages).check(c,q.pageId,q.response,combined);
        case 'page-reveal':return required(p.learningFlow).revealPage(c,q.pageId,combined);
        case 'pages-finish':return required(p.learningFlow).finishPages(c,activity!.ref,combined);
        case 'audio':return required(required(p.pages).audio)(c,q.pageId,combined);
        case 'transcript':return required(required(p.pages).transcript)(c,q.pageId,combined);
        case 'pattern-check':return required(p.patterns).check(c,activity!.ref,q.response,combined);
        case 'pattern-finish':return required(p.learningFlow).finishPattern(c,activity!.ref,q.responses,combined);
        case 'pattern-audio':return required(required(p.patterns).audio)(c,q.turnId,combined);
        case 'repeat-mark':return required(p.guidedRepeat).mark(c,q.trackId,q.segmentId,combined);
        case 'open':if(!t.capabilities.includes('open'))throw Error('TARGET_CAPABILITY_DENIED');return required(p.learningTools).open(c,t.id,combined);
        case 'recording-load':return required(p.recording).load(c,combined);
        case 'recording-restore':return required(p.recording).restore(c,activity!.ref,combined);
        case 'recording-upload':if(!upload)throw Error('LEARNING_BOUNDARY_MISSING_BYTES');return required(p.recording).upload(recordingScope,upload,q.durationSeconds,combined);
        case 'recording-audio':return required(p.recording).audio(recordingScope,q.recordingId,combined);
        case 'recording-delete':return required(p.recording).remove(recordingScope,q.recordingId,combined);
        case 'speaking-complete':return required(p.recording).complete({kind:'speaking-introduction',capsuleRef:c,activityRef:activity!.ref,recordingId:q.recordingId,criteriaIds:q.criteriaIds},combined);
        case 'roleplay-complete':return required(p.recording).complete({kind:'dialogue-roleplay',capsuleRef:c,activityRef:activity!.ref,sceneId:q.sceneId,side:q.side},combined);
      }};
      combined.throwIfAborted();const result=await run();combined.throwIfAborted();
      if(s.generation!==r.generation)throw Error('LEARNING_BOUNDARY_GENERATION');return result;
    },
  };
}
