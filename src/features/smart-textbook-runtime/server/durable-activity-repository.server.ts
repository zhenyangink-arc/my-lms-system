import 'server-only';
import { z } from 'zod';
import { nativeActivityScopeSchema, nativeResponseEnvelopeSchema, type NativeActivityScope, type NativeResponseEnvelope } from './native-activity-binding.server.ts';
/** Trusted server-only SQL transport. Must execute each supplied transaction on
 * one connection and return its JSON SELECT result only after confirmed COMMIT.
 * R7C wires only the owned isolated test database; no production credentials. */
export type NativeActivitySqlTransport={transaction(sql:string):Promise<unknown>; readonly evidenceStorage?:'CURRENT_DEVELOPMENT_DB'; beforeMutation?:(scope:NativeActivityScope,envelope:NativeResponseEnvelope,grade:{correct:boolean;score:number})=>Promise<{beforeRpc:string;afterRpc:string;beforeDispatch:()=>Promise<void>}>};
const q=(v:string)=>`'${v.replaceAll("'","''")}'`;
const j=(v:unknown)=>`${q(JSON.stringify(v))}::jsonb`;
const sha=(v:string)=>`encode(sha256(convert_to(${v},'UTF8')),'hex')`;
function where(s:NativeActivityScope){return `tenant_id=${q(s.tenantId)}::uuid AND student_id=${q(s.actorId)}::uuid AND activity_id=${q(s.activityId)}::uuid AND version_id=${q(s.versionId)}::uuid`;}
function definition(s:NativeActivityScope){return `SELECT jsonb_build_object('activity',to_jsonb(a),'secret',to_jsonb(k),'node',to_jsonb(n),'module',to_jsonb(m),'chapter',to_jsonb(c),'version',to_jsonb(v)) AS body FROM public.digital_textbook_activities a JOIN public.digital_textbook_activity_secrets k ON k.activity_id=a.id JOIN public.digital_textbook_nodes n ON n.id=a.node_id JOIN public.digital_textbook_modules m ON m.id=n.module_id JOIN public.digital_textbook_chapters c ON c.id=m.chapter_id JOIN public.digital_textbook_versions v ON v.id=c.version_id WHERE a.id=${q(s.activityId)}::uuid AND n.id=${q(s.nodeId)}::uuid AND v.id=${q(s.versionId)}::uuid`;}
const begin=(read:boolean)=>`BEGIN ISOLATION LEVEL ${read?'REPEATABLE READ READ ONLY':'READ COMMITTED'}; SET LOCAL standard_conforming_strings=on; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='5s'; SET LOCAL ROLE service_role; SET LOCAL request.jwt.claim.role='service_role';`;
export function createDurableActivityRepository(transport:NativeActivitySqlTransport){
 return {
  evidenceStorage:transport.evidenceStorage ?? 'isolated-test-db' as const,
  async read(scope:NativeActivityScope){const s=nativeActivityScopeSchema.parse(scope);
   return transport.transaction(`${begin(true)}
WITH d AS (${definition(s)}) SELECT jsonb_build_object('definition',(SELECT body||jsonb_build_object('digest',${sha('body::text')}) FROM d),
'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'attemptNumber',attempt_number,'correct',is_correct,'score',score,'createdAt',created_at,'response',response) ORDER BY attempt_number),'[]') FROM public.digital_textbook_attempts WHERE ${where(s)}),
'progress',(SELECT to_jsonb(p) FROM public.digital_textbook_node_progress p WHERE tenant_id=${q(s.tenantId)}::uuid AND student_id=${q(s.actorId)}::uuid AND node_id=${q(s.nodeId)}::uuid AND version_id=${q(s.versionId)}::uuid)); COMMIT;`);
  },
  async submit(scope:NativeActivityScope,pinnedDigest:string,envelope:NativeResponseEnvelope,grade:{correct:boolean;score:number}){
   const s=nativeActivityScopeSchema.parse(scope),e=nativeResponseEnvelopeSchema.parse(envelope);
   z.string().regex(/^[a-f0-9]{64}$/).parse(pinnedDigest);z.object({correct:z.boolean(),score:z.number().min(0).max(100)}).parse(grade);
   const guard=await transport.beforeMutation?.(s,e,grade);
   if(guard)await guard.beforeDispatch();
   // Exact same lock key and seed as the existing seven-argument atomic RPC.
   // A separate statement acquires the lock BEFORE READ COMMITTED takes the
   // request lookup snapshot, so concurrent duplicate requests see the winner.
   return transport.transaction(`${begin(false)}
SELECT pg_advisory_xact_lock(hashtextextended(${q(`${s.tenantId}:${s.actorId}:${s.activityId}`)},0));
${definition(s)} FOR SHARE OF a,k,n,m,c,v;
${guard?.beforeRpc??''}
WITH d AS (${definition(s)}), prior AS (SELECT response FROM public.digital_textbook_attempts WHERE ${where(s)} AND response->>'requestId'=${q(e.requestId)}), checks AS (SELECT (SELECT ${sha('body::text')} FROM d) IS NOT DISTINCT FROM ${q(pinnedDigest)} AS bound, (SELECT count(*) FROM prior) AS copies, (SELECT response - 'generation' FROM prior LIMIT 1) IS NOT DISTINCT FROM ${j(e)} - 'generation' AS same)
SELECT CASE WHEN NOT bound THEN jsonb_build_object('status','BINDING_CHANGED') WHEN copies>1 OR (copies=1 AND NOT same) THEN jsonb_build_object('status','REQUEST_CONFLICT') WHEN copies=1 THEN jsonb_build_object('status','REPLAYED')
WHEN EXISTS(SELECT 1 FROM public.digital_textbook_attempts WHERE ${where(s)} AND is_correct=true) THEN jsonb_build_object('status','ALREADY_COMPLETED')
ELSE jsonb_build_object('status','RECORDED','atomicResult',(SELECT to_jsonb(result) FROM public.record_smart_textbook_attempt(${q(s.tenantId)}::uuid,${q(s.actorId)}::uuid,${q(s.activityId)}::uuid,${q(s.versionId)}::uuid,${j(e)},${grade.correct},${grade.score}::numeric) result)) END FROM checks;
${guard?.afterRpc??''}
COMMIT;`);
  },
 };
}
export type DurableActivityRepository=ReturnType<typeof createDurableActivityRepository>;

/** Repository-owned SELECT in an already verified read-only snapshot. This seam
 * exposes no submission/RPC/transaction control to the Lesson Tool. */
export interface PublishedActivityReadConnection {
 selectNodeFacts(scope:NativeActivityScope):Promise<unknown>;
}
export function publishedNodeFactsSql(scope:NativeActivityScope):string {
 const s=nativeActivityScopeSchema.parse(scope);
 return `SELECT jsonb_build_object('attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'activityId',a.activity_id,'attemptNumber',a.attempt_number,'correct',a.is_correct,'score',a.score,'createdAt',a.created_at) ORDER BY a.activity_id,a.attempt_number),'[]') FROM public.digital_textbook_attempts a JOIN public.digital_textbook_activities d ON d.id=a.activity_id WHERE a.tenant_id=${q(s.tenantId)}::uuid AND a.student_id=${q(s.actorId)}::uuid AND a.version_id=${q(s.versionId)}::uuid AND d.node_id=${q(s.nodeId)}::uuid),'progress',(SELECT to_jsonb(p) FROM public.digital_textbook_node_progress p WHERE tenant_id=${q(s.tenantId)}::uuid AND student_id=${q(s.actorId)}::uuid AND node_id=${q(s.nodeId)}::uuid AND version_id=${q(s.versionId)}::uuid)) AS facts`;
}
export function createPublishedDurableActivityReadRepository(connection:PublishedActivityReadConnection) {
 return Object.freeze({read:(scope:NativeActivityScope)=>connection.selectNodeFacts(nativeActivityScopeSchema.parse(scope))});
}
