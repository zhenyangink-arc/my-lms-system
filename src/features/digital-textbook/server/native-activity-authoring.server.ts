import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requirePlatformOwner } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const canonicalFreeze = {"lesson":"870d1e4c70d884294d31fa8da3cb62d5ecadb2d050b4056c03c9ce47525497c3","script":"dd808c0ed6d816809f0a527523473c1da4021f2ece369d82efa902312ed860a8","versionRow":"a26aabb7dec01619d475db395f8ba628aaf48ec0da3f41c553d518b34a9da158","nodes":["ad1d0d94e8c6c10daed7bd05daf1194f9b52300d8bdb87d3fa31e1a498a614b6","892dba849c29f16c336f199667942887992591fc5a6e3fda3fe21abe18262cd8","961b23a6e128744783793a15fb445c6611cbed7e9b94ccb5c6bab32d63229b71","28d7516c505956a7b50b52db44bf61e08839cb7e19d46ef0d23d982c412dc958","3b48b709e005413be9c9599fc428a464f33928655234da13e2751c36da505bb8","b1f9d770a40cb8096ef8df40a375afe15612f4add7c5882b1e8c91f8dd1d2c50","93b340135770be2aed8ded1fa3bb8310ded773f7799cd054d767fd8c29a7bd4e","0e5c8fc654af69801b2977dbc01252668368df6f92a2691f99cbb829fa36168b"],"parents":{"lessons":"5cc6c16a227f695e913acfabf930d26ee08febb20e2251881257a89e6bd99e53","digital_textbooks":"e5a83e4c6eae9a5467dc3b9bc0bc80661c2736f40f1966d72fa4371e6f64ee3c","digital_textbook_versions":"f6e179b2be3b045efcb440219180b33c6844ecd0044f22050504756b12646232","digital_textbook_chapters":"ab9580d2db8ca1bb91a3abcf595a213a78c5e0870f886d95505354a7485a4535","digital_textbook_modules":"85d9512d9a2eacb0d159f6e8b6baecbbffc6e7881f0bdf383fd7edea2d3e5d73","learning_agent_lessons":"1215200610900050bb5c0ac81ea8d7d6cb11e71e897a962a10ff4a35542de953"}} as const;
const hash = (id: string) => createHash('sha256').update(id).digest('hex');
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const bindingReceiptSchema = z.strictObject({
  contract: z.literal('canonical-activity-binding/1'), result: z.enum(['CREATED','EXISTING']),
  targetAlias: z.literal('hangul-introduction'), activityAlias: z.literal('hangul-introduction-vowel-recognition'),
  operatorHash: digest, nodeHash: digest, activityHash: digest,
  insertedRows: z.union([z.literal(0),z.literal(3)]), observedAt: z.iso.datetime({offset:true}), transactionRef: z.string().regex(/^\d+$/),
}).refine(r => r.insertedRows === (r.result === 'CREATED' ? 3 : 0));

// R6F-verified rows, normalized without exposing resource IDs or authoring text.
const preflightFreeze = {"lessons":"20d3ed1038240b59cbcaf6a84f4b5c13cf8b8edaee41e954610db8218213a03d","digital_textbooks":"e2a9d17c4280e26dbf8030ec57cd170fa59dd0dafe17089792e2724bd19750f3","digital_textbook_versions":"d9857a5f9009c1e4f471cb5ea5d46fb210b25c04ede3ca5f310b6d61df37a41e","digital_textbook_chapters":"82e87c2bf77c78d4a6b998e9078ae5907a76b0add6388f487536d709447f9ba8","digital_textbook_modules":"4989045de4558ac0eeceeca869a3f8f4ad4c19312a1887e4f7c6aff11dad6471","learning_agent_lessons":"65a62d45682f971fffc9c74da03cde53de1625fd88b29346f18ed244825d37a9","learning_agent_script_versions":"cc3cb848b79b59184036a3b63aad178ef8c10145f1ae4adf8bd0c32f74e76c52","learning_agent_script_nodes":["b0b31b8e2ae1459830b67596d44e50728955e88042c78b33e2851c1aaa9e8787","3110be1d214e1f8d09b6301e04838ef91e9490ef5c5cf2cd4b81b0cf0e87eb5a","b0ce7a62364e321244f4cc3893189c168adc8c4d1f657c4c71ca3a4618a08e33","f87fd22bd0d29d49596f2befa08f80366779e596d60af74dd7d1b0c0631553f5","f2b309853febdd468d9dea2c444d7ecb0ad83fcad8e1cc88a54441991a9d5a2f","8703b06cc01b21fbf39af9856a4d70014dcd8809de3927a84efdb764461ee6dd","360726469545f02d5cf96f600962db2e697bdec5264c0f2d1b7726979cbcc943","20200e9e9e34008b2d37073744618dac1d101f3b4797886a741560c3b8d4b8ea"]} as const;

/** Stable JSON fingerprint for read-only validation; the atomic RPC remains authority. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(row).sort().map(key => [key, stable(row[key])]));
  }
  return value;
}
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const same = (left: unknown, right: unknown) => fingerprint(left) === fingerprint(right);

/** Owner authoring read only. No privileged client escapes or performs a write. */
export async function readCanonicalBinding(caller: SupabaseClient): Promise<'EMPTY'|'EXISTING'|'BLOCKED'> {
  await requirePlatformOwner(); // Must finish before constructing any privileged reader.
  try {
    const chapters = await caller.from('digital_textbook_chapters').select('*')
      .eq('chapter_number', 0).contains('title', { 'zh-CN': '韩文字母入门' });
    if (chapters.error || chapters.data?.length !== 1) return 'BLOCKED';
    const chapter = chapters.data[0];
    if (chapter.status !== 'draft' || fingerprint(chapter) !== preflightFreeze.digital_textbook_chapters) return 'BLOCKED';
    const modules = await caller.from('digital_textbook_modules').select('*').eq('chapter_id', chapter.id).eq('module_code', 'orientation');
    if (modules.error || modules.data?.length !== 1) return 'BLOCKED';
    const boundModule = modules.data[0];
    if (fingerprint(boundModule) !== preflightFreeze.digital_textbook_modules) return 'BLOCKED';

    // Same Owner-only draft authoring pattern as Script Studio. Bound module only.
    const authoring = createAdminClient();
    const lessons = await authoring.from('learning_agent_lessons').select('*').eq('module_id', boundModule.id);
    if (lessons.error || lessons.data?.length !== 1) return 'BLOCKED';
    const lesson = lessons.data[0];
    if (hash(lesson.id) !== canonicalFreeze.lesson || fingerprint(lesson) !== preflightFreeze.learning_agent_lessons) return 'BLOCKED';
    const versions = await caller.from('digital_textbook_versions').select('*').eq('id', chapter.version_id);
    if (versions.error || versions.data?.length !== 1 || fingerprint(versions.data[0]) !== preflightFreeze.digital_textbook_versions) return 'BLOCKED';
    const books = await caller.from('digital_textbooks').select('*').eq('id', versions.data[0].textbook_id);
    if (books.error || books.data?.length !== 1 || fingerprint(books.data[0]) !== preflightFreeze.digital_textbooks) return 'BLOCKED';
    const catalog = await caller.from('lessons').select('*').eq('id', books.data[0].lesson_id);
    if (catalog.error || catalog.data?.length !== 1 || fingerprint(catalog.data[0]) !== preflightFreeze.lessons) return 'BLOCKED';
    const scripts = await caller.from('learning_agent_script_versions').select('*').eq('lesson_id', lesson.id);
    if (scripts.error || scripts.data?.length !== 1) return 'BLOCKED';
    const script = scripts.data[0];
    if (hash(script.id) !== canonicalFreeze.script || script.status !== 'draft' || script.version_number !== 1 || script.published_at !== null
      || fingerprint(script) !== preflightFreeze.learning_agent_script_versions) return 'BLOCKED';
    const nodes = await caller.from('learning_agent_script_nodes').select('*').eq('script_version_id', script.id).order('sort_order');
    if (nodes.error || nodes.data?.length !== 8 || nodes.data.some((node, i) => fingerprint(node) !== preflightFreeze.learning_agent_script_nodes[i])) return 'BLOCKED';
    const execution = await caller.from('digital_textbook_nodes').select('*').eq('module_id', boundModule.id);
    if (execution.error || !execution.data) return 'BLOCKED';
    if (execution.data.length === 0) return 'EMPTY';
    if (execution.data.length !== 1) return 'BLOCKED';
    const node = execution.data[0];
    const alias = 'hangul-introduction-vowel-recognition';
    if (node.node_code !== alias || node.node_type !== 'practice' || node.sort_order !== 1 || node.estimated_minutes !== 1
      || !same(node.title, { 'zh-CN': '元音辨认' }) || !same(node.content, {}) || !same(node.authoring_grammar_identities, [])) return 'BLOCKED';
    const activities = await caller.from('digital_textbook_activities').select('*').eq('node_id', node.id);
    if (activities.error || activities.data?.length !== 1) return 'BLOCKED';
    const activity = activities.data[0];
    if (activity.activity_key !== alias || activity.activity_type !== 'single_choice' || activity.sort_order !== 1
      || activity.max_attempts !== 3 || activity.counts_toward_completion !== true
      || !same(activity.prompt, { 'zh-CN': '哪个是元音？' }) || !same(activity.instruction, { 'zh-CN': '请选择一个选项。' })
      || !same(activity.options, [{ 'zh-CN': 'ㄱ' }, { 'zh-CN': 'ㅏ' }, { 'zh-CN': 'ㄴ' }]) || !same(activity.public_config, {})) return 'BLOCKED';
    // Presence only: never fetch answer_key or a private answer digest for display.
    const secret = await authoring.from('digital_textbook_activity_secrets').select('activity_id', { count: 'exact', head: true }).eq('activity_id', activity.id);
    return !secret.error && secret.count === 1 ? 'EXISTING' : 'BLOCKED';
  } catch {
    return 'BLOCKED'; // Read/network ambiguity cannot enable authoring.
  }
}

/** A single RPC; neither a returned error nor an ambiguous response is retried. */
export async function createCanonicalBinding(supabase: SupabaseClient) {
  if(await readCanonicalBinding(supabase)!=='EMPTY') throw Error('CANONICAL_BINDING_NOT_EMPTY');
  const result=await supabase.rpc('create_teaching_lesson_activity_binding',{
    p_expected_freeze:canonicalFreeze,
    p_private_answer:{kind:'index',value:1},
  });
  if(result.error) throw Error('CANONICAL_BINDING_VERIFY_REQUIRED');
  return bindingReceiptSchema.parse(result.data);
}
