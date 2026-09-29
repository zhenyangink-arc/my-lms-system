import 'server-only';
import { z } from 'zod';
import { gradeSmartTextbookActivity } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts';
import { completionRequestSchema, completionReceiptSchema, type CompletionRequest, type ExecutionBinding, type ActivityCompletionReceipt } from '../core/execution-contracts.ts';
import { assertNativeRequest, nativeResponseEnvelopeSchema, validateNativeActivity, safeDigest, type NativeActivityScope } from './native-activity-binding.server.ts';
import type { DurableActivityRepository } from './durable-activity-repository.server.ts';
const attempt=z.strictObject({id:z.uuid(),attemptNumber:z.number().int().positive(),correct:z.boolean(),score:z.number(),createdAt:z.iso.datetime({offset:true}),response:nativeResponseEnvelopeSchema});
const rowsSchema=z.strictObject({definition:z.unknown(),attempts:z.array(attempt).max(20),progress:z.object({tenant_id:z.uuid(),student_id:z.uuid(),node_id:z.uuid(),version_id:z.uuid(),attempt_count:z.number().int().nonnegative(),status:z.enum(['not_started','in_progress','completed']),completion_percent:z.number().min(0).max(100),mastery_score:z.number().min(0).max(100),updated_at:z.iso.datetime({offset:true})}).nullable()});
function assertProgressConsistency(count:number,correct:boolean,p:{attempt_count:number;status:string;completion_percent:number}|null){
 if(count && (!p || p.attempt_count!==count || p.status!==(correct?'completed':'in_progress') || p.completion_percent!==(correct?100:0)))throw Error('DURABLE_COMPLETION_INCONSISTENT');
}
export type DurableFactsReadInput={repository:Pick<DurableActivityRepository,'read'|'evidenceStorage'>;authorize:()=>Promise<NativeActivityScope>;binding:ExecutionBinding;definitionDigest:string;policy?:'two-attempt-development'};
async function readValidatedRows(input: DurableFactsReadInput){
 const {repository,authorize,binding,definitionDigest}=input;
  const scope=await authorize(),raw=rowsSchema.parse(await repository.read(scope));
  const d=validateNativeActivity(raw.definition,scope);if(d.digest!==definitionDigest)throw Error('DURABLE_CONTENT_CHANGED');
  const p=raw.progress;
  if(p&&(p.tenant_id!==scope.tenantId||p.student_id!==scope.actorId||p.node_id!==scope.nodeId||p.version_id!==scope.versionId))throw Error('DURABLE_PROGRESS_SCOPE');
  if(raw.attempts.some((a,i)=>a.attemptNumber!==i+1||a.response.bindingDigest!==safeDigest(binding)||a.response.definitionDigest!==definitionDigest))throw Error('DURABLE_ATTEMPT_BINDING');
  if(raw.attempts.length&&(!p||p.attempt_count<raw.attempts.length))throw Error('DURABLE_PROGRESS_INCONSISTENT');
  if(!raw.attempts.length&&p&&p.status!=='not_started')throw Error('DURABLE_PROGRESS_WITHOUT_ATTEMPT');
  const count=raw.attempts.length, correct=raw.attempts.some(a=>a.correct);
  assertProgressConsistency(count,correct,p);
  if(input.policy==='two-attempt-development'){
   if(count>2 || (!count && p) || (count===1 && correct) || (count===2 && !correct) || raw.attempts[0]?.correct || (count===2 && !raw.attempts[1].correct) || (p && p.mastery_score!==(correct?100:0)))throw Error('DEVELOPMENT_SCENARIO_INCONSISTENT');
  }
  return {scope,d,raw};
 }

/** All public metrics and the receipt derive from ONE validated repository snapshot.
 * No grader, submit method or raw row escapes this read service. */
export async function readDurableActivityFacts(input:DurableFactsReadInput,value:unknown){
 const r=completionRequestSchema.parse(value);assertNativeRequest(r,input.binding);
 const {raw}=await readValidatedRows(input),last=raw.attempts.at(-1),completed=raw.attempts.find(a=>a.correct),repository=input.repository;
 const receipt=completionReceiptSchema.parse({...r,contract:'activity-completion/2',status:completed?'COMPLETED':'INCOMPLETE',attemptNumber:last?.attemptNumber??0,completedAt:completed?.createdAt??null,evidence:{source:'activity-domain',storage:repository.evidenceStorage,kind:'durable-attempt-sequence',attemptSequence:last?.attemptNumber??0,stateDigest:safeDigest({attempts:raw.attempts.map(a=>({id:a.id,sequence:a.attemptNumber,correct:a.correct,createdAt:a.createdAt})),progress:raw.progress}),observedAt:new Date().toISOString(),latestAttemptAt:last?.createdAt??null,progressUpdatedAt:raw.progress?.updated_at??null}});
 const p=raw.progress;
 return {receipt,attemptCount:raw.attempts.length,latestResult:last?(last.correct?'CORRECT' as const:'INCORRECT' as const):'UNKNOWN' as const,
 nodeProgress:p?{status:p.status,completionPercent:p.completion_percent,masteryScore:p.mastery_score,attemptCount:p.attempt_count}:null};
}
/** Only a trusted authorized test execution scope can be injected in R7C.
 * This does not admit Draft content as a published student lesson. */
export async function createDurableActivityCompletion(input:{repository:DurableActivityRepository;authorize:()=>Promise<NativeActivityScope>;binding:ExecutionBinding;definitionDigest:string;policy?:'two-attempt-development'}){
 const {repository,binding,definitionDigest}=input;
 const readRows=()=>readValidatedRows(input);
 // Validate the binding before exposing any service. Readback repeats it.
 await readRows();
 function request(value:unknown){const r=completionRequestSchema.parse(value);assertNativeRequest(r,binding);return r;}
 function unknown(r:CompletionRequest):ActivityCompletionReceipt{return completionReceiptSchema.parse({...r,contract:'activity-completion/2',status:'UNKNOWN',attemptNumber:0,completedAt:null,evidence:{source:'activity-domain',storage:repository.evidenceStorage,kind:'durable-attempt-sequence',attemptSequence:0,stateDigest:safeDigest({unavailable:true,binding}),observedAt:new Date().toISOString(),latestAttemptAt:null,progressUpdatedAt:null}});}
 async function readback(value:unknown){const r=request(value);try{
  return (await readDurableActivityFacts(input,r)).receipt;
 }catch{return unknown(r);}}
 return {
  readback,
  async restore(value:unknown,pendingHint=false){const r=request(value),receipt=await readback(r);return {...r,pending:receipt.status!=='COMPLETED'&&(pendingHint||receipt.attemptNumber>0),receipt};},
  checkpoint:readback,
  async submit(value:unknown,optionId:string){
   const r=request(value),{scope,d}=await readRows();
   const match=/^option-([0-2])$/.exec(optionId);if(!match)throw Error('NATIVE_OPTION_SCOPE');
   const index=Number(match[1]),grade=gradeSmartTextbookActivity(d.secret.answer_key,index,'single_choice',d.activity.public_config,d.activity.options);
   if(!grade.ok||typeof grade.correct!=='boolean'||typeof grade.score!=='number')throw Error('NATIVE_GRADER_REJECTED');
   const result=z.object({status:z.enum(['RECORDED','REPLAYED','ALREADY_COMPLETED','BINDING_CHANGED','REQUEST_CONFLICT'])}).parse(await repository.submit(scope,definitionDigest,{contract:'native-choice-response/1',requestId:r.requestId,bindingDigest:safeDigest(binding),definitionDigest,optionIndex:index,generation:r.generation},{correct:grade.correct,score:grade.score}));
   if(result.status==='BINDING_CHANGED'||result.status==='REQUEST_CONFLICT')throw Error('DURABLE_SUBMISSION_REJECTED');
   // Even this response is not authoritative for media: the Runtime performs
   // another independent readback through its own port before resuming.
   const receipt=await readback(r);
   return {receipt,result:{ok:true,correct:grade.correct,score:grade.score,explanation:grade.correct?'作答已记录，请核对完成状态。':'请再想一想。',attemptNumber:receipt.attemptNumber,preview:true,nodeId:null,nodeCompleted:false,completionPercent:0}};
  },
 };
}

/** Production projection of trusted repository rows. The node's complete attempt
 * set is read in the same snapshot; optional Activities do not inflate target
 * attemptCount, but do contribute to the formal node attempt_count. */
export function projectPublishedDurableFacts(value:unknown,scope:NativeActivityScope,activities:readonly {id:string;counts_toward_completion:boolean;max_attempts:number}[]){
 const parsed=rowsSchema.omit({definition:true,attempts:true}).extend({attempts:z.array(attempt.omit({response:true}).extend({activityId:z.uuid()})).max(10000)}).parse(value);
 const required=activities.filter(a=>a.counts_toward_completion);
 if(required.length>1||!activities.some(a=>a.id===scope.activityId))throw Error('DURABLE_ACTIVITY_AGGREGATION');
 const p=parsed.progress;
 if(p&&(p.tenant_id!==scope.tenantId||p.student_id!==scope.actorId||p.node_id!==scope.nodeId||p.version_id!==scope.versionId))throw Error('DURABLE_PROGRESS_SCOPE');
 if(new Set(parsed.attempts.map(a=>a.id)).size!==parsed.attempts.length)throw Error('DURABLE_ATTEMPT_SEQUENCE');
 for(const row of parsed.attempts)if(!activities.some(a=>a.id===row.activityId))throw Error('DURABLE_ATTEMPT_SCOPE');
 for(const a of activities){const attempts=parsed.attempts.filter(r=>r.activityId===a.id);
  if(attempts.length>a.max_attempts||attempts.some((r,i)=>r.attemptNumber!==i+1||r.score!==(r.correct?100:0)))throw Error('DURABLE_ATTEMPT_SEQUENCE');
 }
 const target=parsed.attempts.filter(a=>a.activityId===scope.activityId),last=target.at(-1),completed=target.find(a=>a.correct);
 const nodeCorrect=required.length===1&&parsed.attempts.some(a=>a.activityId===required[0].id&&a.correct);
 assertProgressConsistency(parsed.attempts.length,nodeCorrect,p);
 if(!parsed.attempts.length&&p&&(p.status!=='not_started'||p.attempt_count!==0||p.completion_percent!==0||p.mastery_score!==0))throw Error('DURABLE_PROGRESS_WITHOUT_ATTEMPT');
 if(p&&p.mastery_score!==(nodeCorrect?100:0))throw Error('DURABLE_MASTERY_INCONSISTENT');
 return {completionStatus:completed?'COMPLETED' as const:'INCOMPLETE' as const,attemptCount:target.length,latestResult:last?(last.correct?'CORRECT' as const:'INCORRECT' as const):'UNKNOWN' as const,
 completedAt:completed?.createdAt??null,latestAttemptAt:last?.createdAt??null,progressUpdatedAt:p?.updated_at??null,
 stateDigest:safeDigest(parsed),nodeProgress:p?{status:p.status,completionPercent:p.completion_percent,masteryScore:p.mastery_score,attemptCount:p.attempt_count}:null};
}
