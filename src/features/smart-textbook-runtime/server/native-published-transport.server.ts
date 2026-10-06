import 'server-only';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assertActiveNativeSessionAuthority, type NativeSessionAuthority } from './native-learning-session.server.ts';
import { certifyNativeVideoPublication, type NativeVideoPublicationBundle } from '../../../lib/smart-textbook-publishing/native-video-publication.server.ts';
import { canonical, digest } from '../../../lib/smart-textbook-legacy-adapter/identity.server.ts';
import { publishedNodeFactsSql } from './durable-activity-repository.server.ts';
import { projectPublishedDurableFacts } from './durable-activity-completion.server.ts';
import { nativeSessionCompletionReceiptSchema } from '../core/native-published-media-contracts.ts';

const expectedSchema=z.strictObject({snapshotId:z.string(),manifestDigest:z.string(),privateDigest:z.string(),cueId:z.literal('pause-1'),activityRevision:z.string(),mediaRevision:z.string()});
type Expected=z.infer<typeof expectedSchema>;
const responseSchema=z.strictObject({contract:z.literal('native-video-choice-response/1'),requestId:z.uuid(),sessionRef:z.string().refine(v=>v.startsWith('learning-session-')&&z.uuid().safeParse(v.slice(17)).success),snapshotId:z.string(),activityRevision:z.string(),mediaRevision:z.string(),cueId:z.literal('pause-1'),optionIndex:z.number().int().min(0).max(99),generation:z.number().int().nonnegative()});
const atomicSchema=z.strictObject({attempt_number:z.number().int().min(1).max(20),node_completed:z.boolean(),completion_percent:z.number().min(0).max(100),mastery_score:z.number().min(0).max(100),node_attempt_count:z.number().int().min(1).max(20)});
function scope(a:NativeSessionAuthority){const b=a.bundle.privatePayload.bindings[0];return {actorId:a.actorId,tenantId:a.tenantId,versionId:a.bundle.scope.versionId,nodeId:b.executionNodeId,activityId:b.activityId};}
function check(a:NativeSessionAuthority,expected:Expected,signal:AbortSignal,deadline:number){
 assertActiveNativeSessionAuthority(a);signal.throwIfAborted();if(Date.now()>deadline)throw Error('NATIVE_READ_TIMEOUT');
 const b=a.bundle.privatePayload.bindings[0];if(canonical(expectedSchema.parse(expected))!==canonical({snapshotId:a.bundle.snapshotId,manifestDigest:a.bundle.manifestDigest,privateDigest:a.bundle.privateDigest,cueId:b.cueId,activityRevision:b.activityRevision,mediaRevision:b.mediaRevision}))throw Error('NATIVE_EXPECTED_BINDING');
}
function connection(){
 const connectionString=process.env.UPLY_PUBLISHED_FACTS_DATABASE_URL,identity=process.env.UPLY_PUBLISHED_FACTS_DATABASE_IDENTITY;
 if(!connectionString||!identity||!/^sha256:[a-f0-9]{64}$/.test(identity))throw Error('NATIVE_TRANSPORT_UNAVAILABLE');
 return {identity,client:new Client({connectionString,connectionTimeoutMillis:3000,statement_timeout:8000,query_timeout:9000,application_name:'uply-native-published-session'})};
}
async function begin(client:Client,identity:string,read:boolean){
 await client.connect();await client.query(read?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL READ COMMITTED');
 const row=(await client.query('SELECT current_database() AS database, system_identifier::text AS system_identifier FROM pg_control_system()')).rows[0];
 const actual={database:row?.database,system_identifier:row?.system_identifier};
 if(`sha256:${createHash('sha256').update(JSON.stringify(actual)).digest('hex')}`!==identity)throw Error('NATIVE_DATABASE_IDENTITY');
 await client.query("SET LOCAL ROLE service_role; SET LOCAL request.jwt.claim.role='service_role'");
}
const args=(a:NativeSessionAuthority,e:Expected)=>[a.actorId,a.tenantId,a.sessionRef.slice(17),a.leaseId,JSON.stringify(e)];
async function guard(client:Client,a:NativeSessionAuthority,e:Expected){
 const raw=(await client.query('SELECT public.read_native_video_session_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb) AS bundle',args(a,e))).rows[0]?.bundle;
 const result=z.strictObject({bundle:z.unknown(),attemptOrigins:z.array(z.strictObject({sessionRef:responseSchema.shape.sessionRef,actorId:z.uuid(),tenantId:z.uuid(),bundle:z.unknown()})).max(20)}).parse(raw);
 const b=certifyNativeVideoPublication(result.bundle);
 if(b.seal!==a.bundle.seal||b.privateDigest!==e.privateDigest||b.manifestDigest!==e.manifestDigest||b.snapshotId!==e.snapshotId)throw Error('NATIVE_PINNED_BINDING');
 const fence=await client.query('SELECT public.assert_runtime_dependency_fence_v1($1::text,$2::jsonb) AS valid',[b.snapshotId,JSON.stringify(b.privatePayload.dependencies)]);
 if(fence.rows[0]?.valid!==true)throw Error('NATIVE_DEPENDENCY_FENCE');
 return {bundle:b,attemptOrigins:result.attemptOrigins};
}
export async function readNativePublishedFacts(a:NativeSessionAuthority,expected:Expected,signal:AbortSignal){
 const acceptedAt=new Date().toISOString(),deadline=Math.min(a.expiresAt,Date.parse(acceptedAt)+10000);check(a,expected,signal,deadline);
 const readStartedAt=new Date().toISOString(),{client,identity}=connection();
 try{
  await begin(client,identity,true);const guarded=await guard(client,a,expected),b=guarded.bundle;check(a,expected,signal,deadline);const s=scope(a);
  const rows=await client.query(`SELECT result.facts, clock_timestamp() AS as_of FROM (${publishedNodeFactsSql(s)}) result`);
  const asOf=z.date().parse(rows.rows[0]?.as_of).toISOString();
  const attempts=await client.query('SELECT id,attempt_number,response,is_correct,score FROM public.digital_textbook_attempts WHERE tenant_id=$1 AND student_id=$2 AND version_id=$3 AND activity_id=$4 ORDER BY attempt_number',[s.tenantId,s.actorId,s.versionId,s.activityId]);
  const origins=new Map<string,NativeVideoPublicationBundle>();
  const definition=(bundle:NativeVideoPublicationBundle)=>{
   const {snapshot: _snapshot,...semantic}=bundle.manifest;void _snapshot;
   return canonical({scope:bundle.scope,sourceRevision:bundle.sourceRevision,pins:bundle.pins,source:bundle.privatePayload.source,
    bindings:bundle.privatePayload.bindings,dependencies:bundle.privatePayload.dependencies,manifestDigest:bundle.manifestDigest,semantic});
  };
  for(const origin of guarded.attemptOrigins){
   if(origin.actorId!==a.actorId||origin.tenantId!==a.tenantId||origins.has(origin.sessionRef))throw Error('NATIVE_HISTORY_OWNER');
   const certified=certifyNativeVideoPublication(origin.bundle);
   if(definition(certified)!==definition(b))throw Error('NATIVE_HISTORY_DEFINITION');
   origins.set(origin.sessionRef,certified);
  }
  const scoreValue=z.union([z.number().finite(),z.string().regex(/^(?:0(?:\.0+)?|100(?:\.0+)?)$/)]).transform(Number);
  const referenced=new Set<string>();
  const seen=new Set<string>(),answer=z.strictObject({kind:z.literal('index'),value:z.number().int().nonnegative()}).parse(b.privatePayload.dependencies.digital_textbook_activity_secrets[0].answer_key);
  const options=b.privatePayload.source.activities[0].options;
  for(const [i,row] of attempts.rows.entries()){
   const r=responseSchema.parse(row.response),origin=origins.get(r.sessionRef);
   if(!origin||origin.snapshotId!==r.snapshotId)throw Error('NATIVE_HISTORY_SNAPSHOT');referenced.add(r.sessionRef);
   if(row.attempt_number!==i+1||seen.has(r.requestId)||r.activityRevision!==expected.activityRevision||r.mediaRevision!==expected.mediaRevision||r.cueId!==expected.cueId||r.optionIndex>=options.length||row.is_correct!==(r.optionIndex===answer.value)||scoreValue.parse(row.score)!==(row.is_correct?100:0))throw Error('NATIVE_ATTEMPT_INTEGRITY');
   seen.add(r.requestId);
  }
  if(referenced.size!==origins.size)throw Error('NATIVE_HISTORY_SET');
  const facts=projectPublishedDurableFacts(rows.rows[0]?.facts,s,b.privatePayload.source.activities);
  if(facts.attemptCount!==attempts.rows.length)throw Error('NATIVE_ATTEMPT_SET');
  const asOfTime=Date.parse(asOf),startedTime=Date.parse(readStartedAt);
  if(!(Date.parse(acceptedAt)<=startedTime&&startedTime<=asOfTime&&asOfTime<=deadline&&asOfTime<=Date.now()
    &&asOfTime-startedTime<=30000)||[facts.completedAt,facts.latestAttemptAt,facts.progressUpdatedAt].some(t=>t!==null&&Date.parse(t)>asOfTime))throw Error('NATIVE_READ_FRESHNESS');
  check(a,expected,signal,deadline);await client.query('COMMIT');check(a,expected,signal,deadline);
  const receipt=nativeSessionCompletionReceiptSchema.parse({contract:'activity-completion/4',status:facts.completionStatus,attemptNumber:facts.attemptCount,completedAt:facts.completedAt,
   provenance:{...a.nativeBindings[0].native,kind:'native-published-session',storage:'PINNED_PUBLISHED_DB',source:'activity-domain',publicationRevision:'publish-foundation/3',activityRevision:expected.activityRevision,mediaRevision:expected.mediaRevision,
    readStartedAt,asOf,observedAt:asOf,deadlineAt:new Date(deadline).toISOString(),revision:`native-state-${digest([a.nativeBindings[0].native,facts.stateDigest])}`},
   evidence:{kind:'durable-attempt-sequence',attemptSequence:facts.attemptCount,stateDigest:facts.stateDigest,latestAttemptAt:facts.latestAttemptAt,progressUpdatedAt:facts.progressUpdatedAt}});
  return {acceptedAt,receipt,facts,lastResponse:attempts.rows.length?responseSchema.parse(attempts.rows.at(-1)!.response):null};
 }catch{try{await client.query('ROLLBACK');}catch{/* Discard, never retry. */}throw Error('NATIVE_READ_UNAVAILABLE');}
 finally{await client.end().catch(()=>{});}
}
export async function recordNativePublishedAttempt(a:NativeSessionAuthority,expected:Expected,submission:{requestId:string;generation:number;optionIndex:number},grade:{correct:boolean;score:number},signal:AbortSignal){
 const request=z.strictObject({requestId:z.uuid(),generation:z.number().int().nonnegative(),optionIndex:z.number().int().min(0).max(99)}).parse(submission);
 const checkedGrade=z.strictObject({correct:z.boolean(),score:z.number().min(0).max(100)}).parse(grade),deadline=Math.min(a.expiresAt,Date.now()+10000);check(a,expected,signal,deadline);
 const {client,identity}=connection();
 try{
  await begin(client,identity,false);await guard(client,a,expected);check(a,expected,signal,deadline);
  const row=(await client.query('SELECT public.record_native_video_attempt_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,$6::jsonb,$7::integer,$8::boolean,$9::numeric) AS result',[...args(a,expected),JSON.stringify({requestId:request.requestId,generation:request.generation}),request.optionIndex,checkedGrade.correct,checkedGrade.score])).rows[0]?.result;
  const r=z.strictObject({status:z.enum(['RECORDED','REPLAYED','ALREADY_COMPLETED']),activityId:z.uuid(),nodeId:z.uuid(),versionId:z.uuid(),response:responseSchema,isCorrect:z.boolean(),score:z.number(),atomicResult:atomicSchema}).parse(row),s=scope(a);
  if(r.activityId!==s.activityId||r.nodeId!==s.nodeId||r.versionId!==s.versionId||r.response.optionIndex!==request.optionIndex||r.isCorrect!==checkedGrade.correct||r.score!==checkedGrade.score)throw Error('NATIVE_ATOMIC_RESULT');
  if(r.status!=='ALREADY_COMPLETED'&&(r.response.requestId!==request.requestId||r.response.sessionRef!==a.sessionRef||r.response.snapshotId!==a.bundle.snapshotId))throw Error('NATIVE_ATOMIC_REQUEST');
  if(r.response.activityRevision!==expected.activityRevision||r.response.mediaRevision!==expected.mediaRevision||r.response.cueId!==expected.cueId)throw Error('NATIVE_ATOMIC_BINDING');
  check(a,expected,signal,deadline);await client.query('COMMIT');check(a,expected,signal,deadline);return r.atomicResult;
 }catch{try{await client.query('ROLLBACK');}catch{/* A lost commit response is resolved only by an independent read. */}throw Error('NATIVE_ATOMIC_UNAVAILABLE');}
 finally{await client.end().catch(()=>{});}
}
