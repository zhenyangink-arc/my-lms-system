import 'server-only';
import { canonicalFreeze as F } from '../../digital-textbook/server/native-activity-authoring.server.ts';
import { DEVELOPMENT_BINDING as B } from './provisioning-contract.ts';
import type { ProvisioningReadPort, ProvisioningReadOnlyTransport } from './provisioning-contract.ts';
const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
const h = (s: string) => `encode(sha256(convert_to(${s},'UTF8')),'hex')`;
/** Transport comes from an explicitly installed development composition, with
 * independently pinned connection identity. Every call opens a new READ ONLY
 * transaction. No Auth tokens/passwords/private Activity answers are selected. */
export function createProvisioningReadback(transport: ProvisioningReadOnlyTransport, connectionIdentity: string): ProvisioningReadPort {
  return { async read() {
    return transport.transaction(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='8s';
WITH l AS (SELECT * FROM public.learning_agent_lessons WHERE ${h('id::text')}=${q(F.lesson)}),
v AS (SELECT * FROM public.learning_agent_script_versions WHERE lesson_id IN (SELECT id FROM l)),
n AS (SELECT * FROM public.learning_agent_script_nodes WHERE script_version_id IN (SELECT id FROM v)),
m AS (SELECT * FROM public.digital_textbook_modules WHERE id IN (SELECT module_id FROM l)),
c AS (SELECT * FROM public.digital_textbook_chapters WHERE id IN (SELECT chapter_id FROM m)),
bv AS (SELECT * FROM public.digital_textbook_versions WHERE id IN (SELECT version_id FROM c)),
b AS (SELECT * FROM public.digital_textbooks WHERE id IN (SELECT textbook_id FROM bv)),
cat AS (SELECT * FROM public.lessons WHERE id IN (SELECT lesson_id FROM b)),
en AS (SELECT * FROM public.digital_textbook_nodes WHERE module_id IN (SELECT id FROM m)),
a AS (SELECT * FROM public.digital_textbook_activities WHERE node_id IN (SELECT id FROM en)),
actors AS (SELECT id,email,banned_until,raw_app_meta_data FROM auth.users
 WHERE email=${q(B.email)} OR raw_app_meta_data->>'purpose'=${q(B.actorAlias)}),
tenants AS (SELECT id,slug,plan_key FROM public.tenants WHERE slug=${q(B.tenantAlias)})
SELECT json_build_object('databaseIdentity',${q(connectionIdentity)},'observedAt',clock_timestamp(),
'canonicalValid',coalesce((SELECT count(*)=1 FROM l) AND (SELECT count(*)=1 AND bool_and(version_number=1 AND status='draft') FROM v)
 AND (SELECT ${h('jsonb_agg(to_jsonb(v))::text')}=${q(F.versionRow)} FROM v)
 AND (SELECT jsonb_agg(${h('to_jsonb(n)::text')} ORDER BY sort_order)=${q(JSON.stringify(F.nodes))}::jsonb FROM n)
 ${[['l','learning_agent_lessons'],['m','digital_textbook_modules'],['c','digital_textbook_chapters'],['bv','digital_textbook_versions'],['b','digital_textbooks'],['cat','lessons']].map(([alias,table]) => `AND (SELECT ${h(`jsonb_agg(to_jsonb(${alias}))::text`)}=${q(F.parents[table as keyof typeof F.parents])} FROM ${alias})`).join('\n')}
 AND (SELECT count(*)=1 AND bool_and(node_code='hangul-introduction-vowel-recognition' AND node_type='practice' AND content='{}'::jsonb) FROM en)
 AND (SELECT count(*)=1 AND bool_and(activity_key='hangul-introduction-vowel-recognition' AND activity_type='single_choice' AND prompt='{"zh-CN":"哪个是元音？"}'::jsonb AND options='[{"zh-CN":"ㄱ"},{"zh-CN":"ㅏ"},{"zh-CN":"ㄴ"}]'::jsonb AND public_config='{}'::jsonb) FROM a)
 AND (SELECT count(*)=1 FROM public.digital_textbook_activity_secrets WHERE activity_id IN (SELECT id FROM a)),false),
 'tenants',(SELECT coalesce(json_agg(json_build_object('id',id,'alias',slug,'plan',plan_key)),'[]') FROM tenants),
 'actors',(SELECT coalesce(json_agg(json_build_object('id',u.id,'email',u.email,'purpose',u.raw_app_meta_data->>'purpose',
 'human',u.raw_app_meta_data->'human','productionAllowed',u.raw_app_meta_data->'production_allowed','banUntil',u.banned_until,
 'sessions',(SELECT count(*) FROM auth.sessions WHERE user_id=u.id),
 'refreshTokens',(SELECT count(*) FROM auth.refresh_tokens WHERE user_id=u.id::text),
 'identityCount',(SELECT count(*) FROM auth.identities WHERE user_id=u.id),
 'emailIdentityCount',(SELECT count(*) FROM auth.identities WHERE user_id=u.id AND provider='email'),
 'provisionedProductionAccount',EXISTS(SELECT 1 FROM public.tenant_provisioned_accounts WHERE user_id=u.id),
 'profile',(SELECT json_build_object('role',role,'globalRole',global_role,'status',status) FROM public.profiles WHERE id=u.id),
 'memberships',(SELECT coalesce(json_agg(json_build_object('tenantId',tenant_id,'role',role,'status',status,'isDefault',is_default)),'[]') FROM public.tenant_memberships WHERE user_id=u.id)
 )),'[]') FROM actors u)); COMMIT;`);
  } };
}
