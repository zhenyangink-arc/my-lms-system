import 'server-only';
import { createProvisioningReadback } from './provisioning-readback.server.ts';
import { assertExecutionScope, type ExecutionScope } from './execution-scope.server.ts';
const q=(s:string)=>`'${s.replaceAll("'","''")}'`;
/** Runs INSIDE the existing repository transaction, before its seven-parameter
 * RPC. Locks fixed actor safety rows; no schema changes or ad-hoc business DML. */
export async function executionMutationGuard(s:ExecutionScope,slot:0|1){
 assertExecutionScope(s);
 let captured='';await createProvisioningReadback({transaction:async sql=>{captured=sql;return null;}},s.databaseIdentity).read();
 const snapshot=captured.slice(captured.indexOf('WITH l AS'),captured.lastIndexOf('; COMMIT;'));
 const a=q(s.domain.actorId),t=q(s.domain.tenantId),id=q(s.domain.activityId),n=q(s.domain.nodeId),v=q(s.domain.versionId),expiry=q(s.expiresAt);
 return `
RESET ROLE;
SELECT id FROM auth.users WHERE id=${a}::uuid FOR SHARE;
SELECT id FROM public.profiles WHERE id=${a}::uuid FOR SHARE;
SELECT user_id FROM public.tenant_memberships WHERE user_id=${a}::uuid AND tenant_id=${t}::uuid FOR SHARE;
DO $b3guard$ DECLARE state jsonb; ac integer; pc integer; BEGIN
SELECT (${snapshot})::jsonb INTO state;
IF coalesce(clock_timestamp() >= ${expiry}::timestamptz OR NOT (state->>'canonicalValid')::boolean
 OR jsonb_array_length(state->'actors')<>1 OR jsonb_array_length(state->'tenants')<>1
 OR state#>>'{actors,0,id}'<>${a} OR state#>>'{tenants,0,id}'<>${t}
 OR state#>>'{actors,0,purpose}'<>'development-domain-execution'
 OR state#>>'{actors,0,human}'<>'false' OR state#>>'{actors,0,productionAllowed}'<>'false'
 OR (state#>>'{actors,0,banUntil}')::timestamptz <= ${expiry}::timestamptz + interval '24 hours'
 OR state#>>'{actors,0,sessions}'<>'0' OR state#>>'{actors,0,refreshTokens}'<>'0'
 OR state#>>'{actors,0,profile,role}'<>'student' OR state#>>'{actors,0,profile,globalRole}'<>'member' OR state#>>'{actors,0,profile,status}'<>'inactive'
 OR state#>>'{actors,0,provisionedProductionAccount}'<>'false'
 OR jsonb_array_length(state#>'{actors,0,memberships}')<>1
 OR state#>>'{actors,0,memberships,0,tenantId}'<>${t}
 OR state#>>'{actors,0,memberships,0,status}'<>'suspended' OR state#>>'{actors,0,memberships,0,role}'<>'student' OR state#>>'{actors,0,memberships,0,isDefault}'<>'false'
, true) THEN RAISE EXCEPTION 'B3_ACTOR_OR_CONTENT_UNSAFE'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.digital_textbook_activities a JOIN public.digital_textbook_nodes n ON n.id=a.node_id JOIN public.digital_textbook_modules m ON m.id=n.module_id JOIN public.digital_textbook_chapters c ON c.id=m.chapter_id WHERE a.id=${id}::uuid AND n.id=${n}::uuid AND c.version_id=${v}::uuid AND a.max_attempts=3 AND a.counts_toward_completion AND c.chapter_test_id IS NULL) THEN RAISE EXCEPTION 'B3_ACTIVITY_BINDING'; END IF;
SELECT count(*) INTO ac FROM public.digital_textbook_attempts WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND activity_id=${id}::uuid;
SELECT count(*) INTO pc FROM public.digital_textbook_node_progress WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND node_id=${n}::uuid;
IF ac<>${slot} OR pc<>${slot} THEN RAISE EXCEPTION 'B3_WRITE_BUDGET'; END IF;
IF ${slot}=1 AND (EXISTS(SELECT 1 FROM public.digital_textbook_attempts WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND activity_id=${id}::uuid AND (is_correct IS DISTINCT FROM false OR attempt_number<>1 OR version_id<>${v}::uuid)) OR NOT EXISTS(SELECT 1 FROM public.digital_textbook_node_progress WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND node_id=${n}::uuid AND version_id=${v}::uuid AND status='in_progress' AND completion_percent=0 AND mastery_score=0 AND attempt_count=1)) THEN RAISE EXCEPTION 'B3_BASELINE_INCONSISTENT'; END IF;
IF EXISTS(SELECT 1 FROM public.digital_textbook_activity_page_progress WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND activity_id=${id}::uuid) THEN RAISE EXCEPTION 'B3_PAGE_PROGRESS_UNEXPECTED'; END IF;
END $b3guard$;
SET LOCAL ROLE service_role;
`;
}

export function executionPostcondition(s:ExecutionScope,slot:0|1){
 const a=q(s.domain.actorId),t=q(s.domain.tenantId),id=q(s.domain.activityId),n=q(s.domain.nodeId),v=q(s.domain.versionId);
 return `DO $b3post$ BEGIN
 IF clock_timestamp() >= ${q(s.expiresAt)}::timestamptz OR (SELECT count(*) FROM public.digital_textbook_attempts WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND activity_id=${id}::uuid)<>${slot+1}
 OR NOT EXISTS(SELECT 1 FROM public.digital_textbook_node_progress WHERE tenant_id=${t}::uuid AND student_id=${a}::uuid AND node_id=${n}::uuid AND version_id=${v}::uuid AND attempt_count=${slot+1} AND status=${q(slot?'completed':'in_progress')} AND completion_percent=${slot?100:0} AND mastery_score=${slot?100:0})
 THEN RAISE EXCEPTION 'B3_POSTCONDITION'; END IF;
 END $b3post$;`;
}
