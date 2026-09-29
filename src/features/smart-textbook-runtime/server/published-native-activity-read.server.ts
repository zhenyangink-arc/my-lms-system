import 'server-only';
import { assertProductionFactsReadAuthorized } from '../../teaching-agent/server/domain-ports/production-lesson-facts-binding.server.ts';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { publicationRepository, type PublicationRpcClient } from '../../../lib/smart-textbook-publishing/repository.server.ts';
import { createPublishedDurableActivityReadRepository, publishedNodeFactsSql } from './durable-activity-repository.server.ts';
import { projectPublishedDurableFacts } from './durable-activity-completion.server.ts';
import type { StudentTeachingScope } from '../../teaching-agent/server/selection/selection-types.ts';
import type { ToolExecutionContext } from '../../agent-core/contracts/tool.ts';
import { assertExecution } from '../../agent-core/runtime/deadline.ts';
import { publishedCompletionReceiptSchema } from '../core/execution-contracts.ts';
import { teachingRef } from '../../teaching-agent/server/selection/references.ts';

const minted=new WeakSet<object>();
export function isPublishedReadSnapshot(value:object){return minted.has(value);}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** A fixed server transport. Connection/identity/provenance cannot be arguments
 * supplied by a Tool, browser, query parameter or development issuer. */
export async function readPublishedNativeActivity(scope:StudentTeachingScope,context:ToolExecutionContext){
 assertProductionFactsReadAuthorized(scope,context);
 assertExecution(context.signal,context.deadlineAt);
 if(process.env.NODE_ENV!=='production'||context.authority.membershipRole!=='student'||context.authority.actorId!==scope.actorId||context.authority.tenantId!==scope.tenantId||context.authority.scopeRef!==scope.scopeRef)throw Error('PUBLISHED_SUBJECT_DENIED');
 const connectionString=process.env.UPLY_PUBLISHED_FACTS_DATABASE_URL,expectedIdentity=process.env.UPLY_PUBLISHED_FACTS_DATABASE_IDENTITY;
 if(!connectionString||!expectedIdentity||!/^sha256:[a-f0-9]{64}$/.test(expectedIdentity))throw Error('PUBLISHED_TRANSPORT_UNAVAILABLE');
 const client=new Client({connectionString,connectionTimeoutMillis:3000,statement_timeout:8000,query_timeout:9000,application_name:'uply-published-facts-read'}),started=new Date().toISOString();
 try{
  await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const identity=(await client.query("SELECT current_database() AS database, system_identifier::text AS system_identifier FROM pg_control_system()")).rows[0];
  if(`sha256:${hash(identity)}`!==expectedIdentity)throw Error('PUBLISHED_DATABASE_IDENTITY');
  await client.query("SET LOCAL ROLE service_role; SET LOCAL request.jwt.claim.role='service_role'");
  const rpc:PublicationRpcClient={async rpc(name,args){
   if(name!=='read_runtime_publication_v1')throw Error('PUBLISHED_READ_ONLY_RPC');
   const scopeArg=z.object({p_scope:z.object({textbookId:z.uuid(),versionId:z.uuid(),chapterId:z.uuid()}).strict()}).strict().parse(args);
   const row=await client.query('SELECT public.read_runtime_publication_v1($1::jsonb) AS result',[JSON.stringify(scopeArg.p_scope)]);
   return {data:row.rows[0]?.result,error:null};
  }};
  const publication=await publicationRepository(rpc).current({textbookId:scope.textbookId,versionId:scope.textbookVersionId,chapterId:scope.chapterId}),b=publication.bundle;
  if(b.revision!=='publish-foundation/2')throw Error('PUBLISHED_NATIVE_REQUIRED');
  const fence=await client.query('SELECT public.assert_runtime_dependency_fence_v1($1::text,$2::jsonb) AS valid',[b.snapshotId,JSON.stringify(b.privatePayload.dependencies)]);
  if(fence.rows[0]?.valid!==true)throw Error('PUBLISHED_DEPENDENCY_FENCE');
  const matches=b.privatePayload.bindings.filter(x=>x.sourceTeachingNodeId===scope.nodeId&&x.scriptVersionId===scope.scriptVersionId&&x.teachingLessonId===scope.teachingLessonId&&x.moduleId===scope.moduleId);
  if(matches.length!==1||b.privatePayload.source.book.lesson_id!==scope.lessonId||b.privatePayload.source.book.agent_profile_id!==scope.agentProfileId)throw Error('PUBLISHED_ACTIVITY_BINDING');
  const binding=matches[0],domain={actorId:scope.actorId,tenantId:scope.tenantId,versionId:scope.textbookVersionId,nodeId:binding.executionNodeId,activityId:binding.activityId};
  const repository=createPublishedDurableActivityReadRepository({async selectNodeFacts(s){if(s.actorId!==domain.actorId||s.tenantId!==domain.tenantId||s.versionId!==domain.versionId||s.nodeId!==domain.nodeId||s.activityId!==domain.activityId)throw Error('PUBLISHED_READ_SCOPE');return (await client.query(publishedNodeFactsSql(s))).rows[0]?.facts;}});
  const facts=projectPublishedDurableFacts(await repository.read(domain),domain,b.privatePayload.source.activities.filter(a=>a.node_id===domain.nodeId));
  const asOf=new Date().toISOString(),snapshotRef=teachingRef('snapshot',b.snapshotId),contentBinding=teachingRef('revision',[b.snapshotId,b.manifestDigest]);
  const content={lessonRef:teachingRef('lesson',scope.lessonId),lessonTitle:b.manifest.textbook.title[scope.locale]??b.manifest.textbook.title['zh-CN']??'',scriptVersionRef:teachingRef('script',scope.scriptVersionId),versionRef:teachingRef('version',scope.textbookVersionId),version:binding.scriptVersion,contentBinding,sourceTeachingNodeRef:teachingRef('node',binding.sourceTeachingNodeId),executionNodeRef:teachingRef('node',domain.nodeId),activityRef:teachingRef('activity',domain.activityId),activityAlias:binding.activityAlias};
  const revision=teachingRef('state',[snapshotRef,scope.scopeRef,facts.stateDigest]);
  const receipt=publishedCompletionReceiptSchema.parse({contract:'activity-completion/3',status:facts.completionStatus,attemptNumber:facts.attemptCount,completedAt:facts.completedAt,
   provenance:{storage:'CURRENT_PUBLISHED_DB',source:'activity-domain',publicationRevision:b.revision,snapshotRef,scopeRef:scope.scopeRef,contentRef:contentBinding,activityRef:content.activityRef,executionNodeRef:content.executionNodeRef,sourceTeachingNodeRef:content.sourceTeachingNodeRef,versionRef:content.versionRef,runId:context.runId,skillRunId:context.skillRunId,modelCallId:context.modelCallId,toolCallId:context.callId,toolVersion:'1.1.0',skillVersion:'1.1.0',readStartedAt:started,asOf,observedAt:asOf,deadlineAt:context.deadlineAt,revision},
   evidence:{kind:'durable-attempt-sequence',attemptSequence:facts.attemptCount,stateDigest:facts.stateDigest,latestAttemptAt:facts.latestAttemptAt,progressUpdatedAt:facts.progressUpdatedAt}});
  assertExecution(context.signal,context.deadlineAt);if(Date.parse(asOf)-Date.parse(started)>30000)throw Error('PUBLISHED_READ_STALE');
  await client.query('COMMIT');
  const result=Object.freeze({content,facts,receipt,authority:context.authority});minted.add(result);return result;
 }catch{try{await client.query('ROLLBACK');}catch{/* Read-only connection is discarded; never retry. */}throw Error('PUBLISHED_READ_UNAVAILABLE');}
 finally{await client.end().catch(()=>{});}
}
export type PublishedReadSnapshot=Awaited<ReturnType<typeof readPublishedNativeActivity>>;
