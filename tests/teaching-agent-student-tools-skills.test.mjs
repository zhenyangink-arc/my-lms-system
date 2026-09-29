import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import Ajv from 'ajv';
import { z } from 'zod';
import { harness, execution, ids, uuid, digest, withIsolatedStudentDatabase } from './fixtures/teaching-agent/student-domain.mjs';
const root = '../src/features/teaching-agent/';
const { createStudentAiTeacherCapabilities } = await import(root + 'server/composition/create-student-ai-teacher-capabilities.ts');
const { createStudentAiTeacherProfile, lessonToolRef, stateToolRef, explainSkillRef } = await import(root + 'profiles/student-ai-teacher.ts');
const { createStudentAiTeacherToolRegistry } = await import(root + 'server/tools/student-tool-registry.ts');
const { createStudentToolPolicy } = await import(root + 'server/policies/student-tool-policy.ts');
const { createStudentAiTeacherSkillRegistry, selectStudentExplainSkill } = await import(root + 'server/skills/student-skill-registry.ts');
const { checkExplainEvidence } = await import(root + 'skills/explain-pinned-korean-segment/evidence.ts');
const { teachingRef } = await import(root + 'server/selection/references.ts');
const { executeAllowedTool } = await import('../src/features/agent-core/tools/executor.ts');
const { resolveAllowedToolDefinitions } = await import('../src/features/agent-core/permissions/tool-policy.ts');
const { createToolRegistry, productionToolRegistry } = await import('../src/features/agent-core/tools/registry.ts');
const { createSkillRegistry, productionSkillRegistry } = await import('../src/features/agent-core/skills/registry.ts');
let deepSeekFetches = 0, qwenFetches = 0, otherNetworkFetches = 0;
globalThis.fetch = async url => {
  if (/deepseek/i.test(String(url))) deepSeekFetches++;
  else if (/qwen|dashscope/i.test(String(url))) qwenFetches++;
  else otherNetworkFetches++;
  throw new Error('ALL_NETWORK_FORBIDDEN');
};
after(() => { assert.equal(deepSeekFetches, 0); assert.equal(qwenFetches, 0); assert.equal(otherNetworkFetches, 0); });

async function setup({ h = harness(), overrides = {}, persona, korean = true } = {}) {
  if (korean) h.rows.learning_agent_script_nodes[0].teacher_script['zh-CN'] = '저는 학생입니다.\n\n이것은 책입니다.';
  const ctx = execution(), locator = await h.pin(overrides);
  const verified = await h.runtime.selection.verify(locator, ctx); assert.equal(verified.status, 'ok');
  const binding = verified.data, events = [];
  const input = { domain: h.runtime, binding, execution: ctx, skillRunId: randomUUID() };
  const cap = await createStudentAiTeacherCapabilities({ ...input, intent: 'explain_segment', persona, trace: { emit: e => events.push(e) } });
  const registry = createStudentAiTeacherToolRegistry(input), policy = createStudentToolPolicy(input);
  return { h, binding, cap, events, input, registry, policy };
}
const args = b => ({ lessonRef: b.selection.lessonRef, segmentRef: b.selection.segmentRef });
const call = (name, input = {}) => ({ id: randomUUID(), name, arguments: JSON.stringify(input) });
const lesson = x => x.cap.executeTool(call(lessonToolRef.name, args(x.binding)), randomUUID());
const state = x => x.cap.executeTool(call(stateToolRef.name), randomUUID());
const output = (patch = {}) => ({ responseText: '는 标记话题：这里谈论的是“我”。', locale: 'zh-CN', completeness: 'complete', ...patch });
// Test-only planner: no Provider, no natural-language routing and no model inference.
async function syntheticPlanner(x) {
  const result = await lesson(x);
  assert.equal(result.status, 'ok');
  return x.cap.validateOutput(output({ checkQuestion: '这句话的话题是谁？', supplements: [{ text: '저는 선생님입니다.（补充例句）', provenance: 'model_generated' }] }));
}

test('synthetic planner -> actual Core executor -> production tools -> 1A ports/repository -> evidence/output; no side effects', async t => {
  const x = await setup(), before = digest(x.h.rows);
  const final = await syntheticPlanner(x); assert.equal(final.status, 'accepted');
  assert.deepEqual(final.output.sourceRefs, [x.binding.selection.segmentRef]);
  assert.deepEqual(final.output.evidenceRefs.map(e => e.kind), ['lesson_sentence', 'learning_objectives']);
  assert.equal(final.output.supplements[0].provenance, 'model_generated');
  assert.equal(digest(x.h.rows), before);
  assert.deepEqual(x.events.map(e => e.kind), ['skill.loaded', 'tool.requested', 'tool.completed', 'skill.evidence']);
  assert.ok(x.h.calls.length > 0);
  t.diagnostic(`23 fixture tables unchanged SHA256=${before}; Provider calls=0`);
});

test('student definition is versioned; Kim persona changes presentation only, generic Core empty', async () => {
  const kim = await setup(), generic = await setup({ persona: 'generic' });
  const p = kim.cap.profile;
  assert.equal(p.agentCode, 'student-ai-teacher'); assert.equal(p.agentType, 'student_teacher');
  for (const field of ['definitionVersion', 'personaRef', 'privateInstructionsRef', 'contextPolicyRef', 'permissionPolicyRef', 'outputPolicyRef']) assert.ok(p[field].version);
  assert.deepEqual(p.allowedSkillRefs, [explainSkillRef]); assert.deepEqual(p.allowedToolRefs, [lessonToolRef, stateToolRef]);
  assert.deepEqual(kim.cap.modelTools, generic.cap.modelTools);
  const withoutPersona = profile => { const { personaRef, ...rest } = profile; void personaRef; return rest; };
  assert.deepEqual(withoutPersona(p), withoutPersona(generic.cap.profile));
  assert.notDeepEqual(p.personaRef, generic.cap.profile.personaRef);
  assert.equal(p.model.model, 'deepseek-v4-flash'); assert.equal(p.defaultModelRequirements.requiresStructuredOutput, false);
  for (const ref of [lessonToolRef, stateToolRef]) { assert.equal(kim.registry.get(ref).definition.riskLevel, 0); assert.equal(productionToolRegistry.get(ref), undefined); }
  assert.equal(productionSkillRegistry.get(explainSkillRef), undefined);
  assert.throws(() => createStudentAiTeacherProfile({ name: 'kim', permissions: ['admin'] }));
});

test('Tool registry exactly two names/versions, Skill one exact published version; no latest or disabled selection', async () => {
  const x = await setup(), skills = createStudentAiTeacherSkillRegistry();
  assert.equal(x.cap.modelTools.length, 2); assert.equal(skills.get(explainSkillRef).name, explainSkillRef.name);
  for (const version of ['latest', '1.0.1', '2.0.0']) {
    assert.equal(x.registry.get({ ...lessonToolRef, version }), undefined);
    assert.equal(skills.get({ ...explainSkillRef, version }), undefined);
    assert.throws(() => selectStudentExplainSkill(x.cap.profile, skills, 'explain_segment', { ...explainSkillRef, version }));
  }
  for (const intent of ['chat', 'grade', undefined]) assert.throws(() => selectStudentExplainSkill(x.cap.profile, skills, intent));
  assert.throws(() => selectStudentExplainSkill({ ...x.cap.profile, allowedSkillRefs: [] }, skills, 'explain_segment'));
  assert.throws(() => selectStudentExplainSkill({ ...x.cap.profile, agentCode: 'guide' }, skills, 'explain_segment'));
  assert.throws(() => selectStudentExplainSkill(x.cap.profile, createSkillRegistry([{ ...x.cap.skill, status: 'disabled' }]), 'explain_segment'));
});

const invalidArgs = [
  ['extra tenant', b => ({ ...args(b), tenantId: ids.B })], ['extra actor', b => ({ ...args(b), studentId: ids.B1 })],
  ['extra role', b => ({ ...args(b), role: 'teacher' })], ['extra session', b => ({ ...args(b), scriptVersionId: uuid(210) })],
  ['extra section', b => ({ ...args(b), section: 'with_adjacent_explanation' })], ['missing required', () => ({})],
  ['wrong type', b => ({ ...args(b), segmentRef: 42 })], ['malformed ref', b => ({ ...args(b), lessonRef: uuid(103) })],
  ['wrong ref kind', b => ({ ...args(b), lessonRef: b.selection.segmentRef })],
  ['trailing newline ref', b => ({ ...args(b), lessonRef: b.selection.lessonRef + '\n' })],
];
for (const [label, make] of invalidArgs) test(`JSON schema and Core runtime both reject ${label}`, async () => {
  const x = await setup(), d = x.registry.get(lessonToolRef).definition;
  assert.deepEqual(d.inputSchema, z.toJSONSchema(d.inputValidator));
  const schema = structuredClone(d.inputSchema); delete schema.$schema; // Installed Ajv 6 validates the draft-07-compatible input subset.
  const jsonValidate = new Ajv().compile(schema), input = make(x.binding);
  assert.equal(jsonValidate(input), false); assert.equal(d.inputValidator.safeParse(input).success, false);
  const before = x.h.calls.length;
  await assert.rejects(x.cap.executeTool(call(d.name, input), randomUUID()), /TOOL_INVALID_INPUT/);
  assert.equal(x.h.calls.length, before);
});

test('valid provider schemas, state strict empty input; no arbitrary session/ref', async () => {
  const x = await setup();
  for (const ref of [lessonToolRef, stateToolRef]) {
    const d = x.registry.get(ref).definition, schema = structuredClone(d.inputSchema); delete schema.$schema;
    const input = ref === lessonToolRef ? args(x.binding) : {};
    assert.equal(new Ajv().compile(schema)(input), true);
    assert.deepEqual(d.inputSchema, z.toJSONSchema(d.inputValidator));
  }
  for (const extra of [{ sessionId: uuid(214) }, { teachingSessionRef: teachingRef('session', 'other') }, { role: 'admin' }])
    await assert.rejects(x.cap.executeTool(call(stateToolRef.name, extra), randomUUID()), /TOOL_INVALID_INPUT/);
});

for (const name of ['get_student_progress', 'publish_script', 'grade_student', 'http_fetch', 'get_current_lesson_context@2.0.0'])
  test(`unknown Tool rejected: ${name}`, async () => {
    const x = await setup(); await assert.rejects(x.cap.executeTool(call(name), randomUUID()), /TOOL_NOT_ALLOWED/);
    assert.equal((await x.cap.validateOutput(output())).status, 'rejected');
  });

for (const kind of ['lessonRef', 'segmentRef']) test(`opaque cross-scope ${kind} cannot expand Run`, async () => {
  const x = await setup();
  const result = await x.cap.executeTool(call(lessonToolRef.name, { ...args(x.binding), [kind]: teachingRef(kind === 'lessonRef' ? 'lesson' : 'segment', 'tenant-B-selection') }), randomUUID());
  assert.equal(result.status, 'not_found_or_not_visible');
  assert.equal((await x.cap.validateEvidence()).status, 'invalid');
});

test('last_saved state is optional and may point to a different segment; redaction across result/evidence/output/trace', async () => {
  const x = await setup(), lr = await lesson(x), sr = await state(x);
  assert.equal(sr.status, 'ok'); assert.equal(sr.data.semantic, 'last_saved_teaching_position');
  assert.equal(sr.data.lastSavedSegmentIndex, 1); assert.notEqual(sr.data.lastSavedSegmentRef, lr.data.segmentRef);
  assert.match(x.registry.get(stateToolRef).definition.description, /已持久化.*last_saved_teaching_position.*不是当前/);
  const evidence = await x.cap.validateEvidence(), final = await x.cap.validateOutput(output());
  assert.equal(evidence.status, 'satisfied'); assert.equal(final.status, 'accepted');
  assert.ok(evidence.evidenceRefs.some(ref => ref.kind === 'saved_teaching_state'));
  const serialized = JSON.stringify([lr, sr, evidence, final, x.events]);
  for (const secret of ['SENTINEL', 'correct_option_index', 'answer_key', 'private_remediation_secret', 'incorrectFeedback', 'private_grading_key', ids.A, ids.A1, uuid(112), 'configuration']) assert.ok(!serialized.includes(secret), secret);
  assert.ok(!JSON.stringify(x.events).includes('저는')); assert.ok(!JSON.stringify(evidence).includes('저는'));
  const noSession = await setup({ overrides: { teachingSessionId: undefined } });
  assert.deepEqual(noSession.cap.modelTools.map(t => t.name), [lessonToolRef.name]);
  assert.equal((await syntheticPlanner(noSession)).status, 'accepted');
});

test('lesson mandatory; state alone and forged model refs cannot complete Skill', async () => {
  const x = await setup();
  assert.equal((await x.cap.validateEvidence()).status, 'missing');
  await state(x); assert.equal((await x.cap.validateEvidence()).status, 'missing');
  assert.equal((await x.cap.validateOutput(output({ sourceRefs: [x.binding.selection.segmentRef] }))).status, 'rejected');
  await lesson(x);
  assert.equal((await x.cap.validateOutput(output({ sourceRefs: [x.binding.selection.segmentRef] }))).status, 'rejected');
  assert.equal((await x.cap.validateOutput(output({ supplements: [{ text: '补充例句', provenance: 'model_generated', sourceRef: x.binding.selection.segmentRef }] }))).status, 'rejected');
});

test('deterministic evidence rejects tampered status/revision/segment/refs/asOf/completeness/text; private ledger isolated from caller mutation', async () => {
  const x = await setup(), result = await lesson(x);
  const mutations = [r => { r.status = 'stale'; }, r => { r.status = 'unavailable'; }, r => { r.status = 'not_found_or_not_visible'; },
    r => { r.sourceRefs = []; }, r => { r.data.revision = teachingRef('revision', 'wrong'); },
    r => { r.data.segmentRef = teachingRef('segment', 'wrong'); }, r => { r.data.originalSentence = '伪造'; },
    r => { r.data.evidenceRefs = []; }, r => { r.data.evidenceRefs[0].revision = teachingRef('revision', 'wrong'); },
    r => { r.data.asOf = '2020-01-01T00:00:00.000Z'; }, r => { r.data.truncated = true; },
    r => { r.status = 'partial'; }, r => { r.data.evidenceRefs[0].sourceRef = teachingRef('segment', 'fake'); }];
  for (const mutate of mutations) { const r = structuredClone(result); mutate(r); assert.equal(checkExplainEvidence(x.binding, r).status, 'invalid'); }
  result.data.originalSentence = 'FAKE'; result.sourceRefs.length = 0;
  const evidence = await x.cap.validateEvidence(); assert.equal(evidence.status, 'satisfied');
  evidence.sourceRefs.length = 0; x.cap.profile.allowedToolRefs.push({ name: 'publish_script', version: '1.0.0' });
  x.cap.skill.allowedTools.push({ name: 'publish_script', version: '1.0.0' });
  x.cap.modelTools.push({ name: 'publish_script' });
  await assert.rejects(x.cap.executeTool(call('publish_script'), randomUUID()), /TOOL_NOT_ALLOWED/);
  assert.equal((await x.cap.validateEvidence()).sourceRefs.length, 1);
});

for (const [label, mutate] of [
  ['revision', h => { h.rows.learning_agent_script_nodes[0].updated_at = '2026-02-01T00:00:00Z'; }],
  ['sentence', h => { h.rows.learning_agent_script_nodes[0].teacher_script['zh-CN'] = '改动'; }],
]) test(`stale after exposure: ${label}`, async () => {
  const x = await setup(); mutate(x.h);
  assert.equal((await lesson(x)).status, 'stale'); assert.equal((await x.cap.validateOutput(output())).status, 'rejected');
});

for (const [label, mutate] of [
  ['enrollment revoked', h => { h.rows.student_app_enrollments[0].status = 'cancelled'; }],
  ['wrong tenant', h => h.setIdentity({ actorId: ids.A1, tenantId: ids.B })],
  ['wrong actor', h => h.setIdentity({ actorId: ids.A2, tenantId: ids.A })],
  ['teacher role', h => { h.rows.tenant_memberships[0].role = 'teacher'; }],
  ['previous_completed', h => { h.rows.lessons[0].unlock_mode = 'previous_completed'; }],
  ['prerequisite_completed', h => { h.rows.lessons[0].unlock_mode = 'prerequisite_completed'; }],
]) test(`authorization re-evaluated after Skill selection: ${label}`, async () => {
  const x = await setup(); mutate(x.h); await assert.rejects(lesson(x), /TOOL_NOT_ALLOWED/);
  assert.equal((await x.cap.validateEvidence()).status, 'invalid');
});

test('authorization and content also rechecked before accepting output after a successful Tool', async () => {
  const x = await setup(); await lesson(x); x.h.rows.student_app_enrollments[0].status = 'cancelled';
  assert.equal((await x.cap.validateOutput(output())).status, 'rejected');
  const y = await setup(); await lesson(y); y.h.rows.learning_agent_script_nodes[0].updated_at = '2026-02-02T00:00:00Z';
  assert.equal((await y.cap.validateOutput(output())).status, 'rejected');
});

test('revocation between Core permission check and Domain Port read is denied without cached content', async () => {
  const x = await setup(), portRead = x.h.runtime.currentLesson.read;
  x.h.runtime.currentLesson.read = async (...input) => {
    x.h.rows.student_app_enrollments[0].status = 'cancelled';
    return portRead(...input);
  };
  assert.equal((await lesson(x)).status, 'not_found_or_not_visible');
  assert.equal((await x.cap.validateEvidence()).status, 'invalid');
});

test('new failed lesson read invalidates earlier successful evidence; optional state failure does not replace mandatory evidence', async () => {
  const x = await setup(); await lesson(x);
  x.h.runtime.currentLesson.read = async () => ({ status: 'unavailable' });
  await lesson(x); assert.equal((await x.cap.validateOutput(output())).status, 'rejected');
  const y = await setup(); await lesson(y);
  y.h.runtime.teachingState.read = async () => ({ status: 'unavailable' });
  await state(y); assert.equal((await y.cap.validateOutput(output())).status, 'accepted');
  assert.ok(!(await y.cap.validateEvidence()).evidenceRefs.some(e => e.kind === 'saved_teaching_state'));
});

test('other tenant legitimate selection works only for that tenant; copied binding/authority rejected', async () => {
  const h = harness(); h.setIdentity({ actorId: ids.B1, tenantId: ids.B });
  const b = await setup({ h, overrides: { lessonId: uuid(203), moduleId: uuid(207), teachingSessionId: uuid(214), scriptVersionId: uuid(210), nodeId: uuid(212) } });
  assert.equal((await lesson(b)).status, 'ok');
  await assert.rejects(createStudentAiTeacherCapabilities({ ...b.input, binding: structuredClone(b.binding), intent: 'explain_segment' }), /FORBIDDEN/);
  const d = b.registry.get(lessonToolRef).definition;
  await assert.rejects(executeAllowedTool(call(d.name, args(b.binding)), [d], b.registry, b.policy,
    { ...b.input.execution, authority: structuredClone(b.binding.authority), skillRunId: b.input.skillRunId, callId: randomUUID(), modelCallId: randomUUID() }), /TOOL_NOT_ALLOWED/);
});

test('Profile ∩ Skill ∩ exact registry ∩ real permissions; risk>0 and disabled Tool denied by Core', async () => {
  const x = await setup(), { profile, skill } = x.cap;
  const visible = (p = profile, s = skill, registry = x.registry) => resolveAllowedToolDefinitions(p, s, x.binding.authority, registry, x.policy);
  assert.equal((await visible({ ...profile, allowedToolRefs: [lessonToolRef] })).length, 1);
  assert.equal((await visible(profile, { ...skill, allowedTools: [] })).length, 0);
  assert.equal((await visible({ ...profile, status: 'disabled' })).length, 0);
  assert.equal((await visible({ ...profile, allowedToolRefs: [{ ...lessonToolRef, version: '2.0.0' }] })).length, 0);
  for (const change of [{ riskLevel: 1 }, { status: 'disabled' }, { requiredPermissions: ['admin.all'] }]) {
    const reg = x.registry.get(lessonToolRef), definition = { ...reg.definition, ...change };
    const registry = createToolRegistry([{ ...reg, definition }]);
    assert.equal((await visible(profile, skill, registry)).length, 0);
    await assert.rejects(executeAllowedTool(call(definition.name, args(x.binding)), [definition], registry, x.policy,
      { ...x.input.execution, authority: x.binding.authority, skillRunId: x.input.skillRunId, callId: randomUUID(), modelCallId: randomUUID() }), /TOOL_NOT_ALLOWED/);
  }
});

test('bounded partial unicode/context output cannot claim complete; executor rejects oversized JSON', async () => {
  const h = harness(); h.rows.learning_agent_script_nodes[0].teacher_script['zh-CN'] = '한'.repeat(5000);
  h.rows.learning_agent_lessons[0].objectives['zh-CN'] = Array(10).fill('目'.repeat(500));
  const x = await setup({ h, korean: false }), result = await lesson(x);
  assert.equal(result.status, 'partial'); assert.equal(result.data.originalSentence.length, 4000);
  assert.equal(result.data.truncated, true); assert.equal(result.data.objectives.length, 6);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < x.registry.get(lessonToolRef).definition.maxResultBytes);
  assert.equal((await x.cap.validateOutput(output())).status, 'rejected');
  assert.equal((await x.cap.validateOutput(output({ completeness: 'partial', limitation: '原句及目标已截断，只依据可见部分解释。' }))).status, 'accepted');
  const reg = x.registry.get(lessonToolRef), registry = createToolRegistry([{ ...reg, definition: { ...reg.definition, maxResultBytes: 100 } }]);
  await assert.rejects(executeAllowedTool(call(reg.definition.name, args(x.binding)), [reg.definition], registry, x.policy,
    { ...x.input.execution, authority: x.binding.authority, skillRunId: x.input.skillRunId, callId: randomUUID(), modelCallId: randomUUID() }), /TOOL_FAILED/);
});

test('invalid/unknown saved cursor stays partial, last_saved only; Korean output locale', async () => {
  const h = harness(); h.rows.learning_agent_sessions[0].teaching_state.scriptSegmentIndex = 999;
  const x = await setup({ h, overrides: { locale: 'ko-KR' } });
  await lesson(x); const result = await state(x); assert.equal(result.status, 'partial');
  assert.equal(result.data.lastSavedSegmentRef, null); assert.equal(result.data.semantic, 'last_saved_teaching_position');
  assert.equal((await x.cap.validateOutput(output())).status, 'rejected');
  assert.equal((await x.cap.validateOutput(output({ locale: 'ko-KR', responseText: '는은 화제를 나타냅니다.', completeness: 'partial', limitation: '저장된 위치는 확인되지 않았습니다.' }))).status, 'accepted');
});

for (const patch of [
  { responseText: '我已经为你更新进度。' }, { responseText: 'I have completed the lesson.' }, { responseText: '점수를 저장했습니다.' },
  { nextNode: 'other' }, { completeLesson: true }, { markCorrect: true }, { unlock: true }, { grade: 100 },
  { responseText: 'x'.repeat(6001) }, { completeness: 'partial', supplements: [{ text: '例句', provenance: '教材' }] },
]) test(`output contract rejects state claims/commands/invalid supplement: ${Object.keys(patch).join(',')}`, async () => {
  const x = await setup(); await lesson(x);
  assert.equal((await x.cap.validateOutput(output(patch))).status, 'rejected');
});

test('safe unavailable result; SQL/stack never included; cancellation is not a successful Tool', async () => {
  const x = await setup();
  x.h.runtime.currentLesson.read = async () => { throw new Error('SQL PRIVATE RLS SENTINEL'); };
  assert.deepEqual(await lesson(x), { status: 'unavailable', code: 'READ_UNAVAILABLE' });
  assert.equal((await x.cap.validateEvidence()).status, 'invalid');
  assert.ok(!JSON.stringify(x.events).includes('SENTINEL'));
  const y = await setup(), controller = new AbortController();
  const cap = await createStudentAiTeacherCapabilities({ ...y.input, execution: { ...y.input.execution, signal: controller.signal }, intent: 'explain_segment' });
  controller.abort(); await assert.rejects(cap.executeTool(call(lessonToolRef.name, args(y.binding)), randomUUID()), /RUN_CANCELLED/);
});

test('unavailable fresh authorization denies; Core receipt metadata cannot be forged by execution context', async () => {
  const x = await setup();
  const reg = x.registry.get(lessonToolRef);
  for (const patch of [{ runId: randomUUID() }, { skillRunId: randomUUID() }, { deadlineAt: new Date(Date.now() + 1000).toISOString() }]) {
    const context = { ...x.input.execution, authority: x.binding.authority, skillRunId: x.input.skillRunId, callId: randomUUID(), modelCallId: randomUUID(), ...patch };
    assert.equal((await executeAllowedTool(call(reg.definition.name, args(x.binding)), [reg.definition], x.registry, x.policy, context)).status, 'not_found_or_not_visible');
  }
  x.h.repository.readAuthorizedContent = async () => { throw new Error('SECRET_SQL'); };
  await assert.rejects(lesson(x), /TOOL_NOT_ALLOWED/);
});

test('one run has bounded execution and duplicate call guard; no hidden retry', async () => {
  const x = await setup(), request = call(lessonToolRef.name, args(x.binding)), modelId = randomUUID();
  await x.cap.executeTool(request, modelId);
  await assert.rejects(x.cap.executeTool(request, modelId), /TOOL_NOT_ALLOWED/);
  for (let i = 0; i < 3; i++) await state(x);
  await assert.rejects(lesson(x), /TOOL_NOT_ALLOWED/);
  assert.equal(x.events.filter(e => e.kind === 'tool.completed').length, 4);
});

test('deadline cancels an in-flight Domain Port and a pending Tool prevents evidence acceptance', async () => {
  const x = await setup();
  const short = { ...x.input, execution: { ...x.input.execution, deadlineAt: new Date(Date.now() + 100).toISOString() } };
  const cap = await createStudentAiTeacherCapabilities({ ...short, intent: 'explain_segment' });
  x.h.runtime.currentLesson.read = async () => new Promise(() => {});
  const pending = cap.executeTool(call(lessonToolRef.name, args(x.binding)), randomUUID());
  assert.equal((await cap.validateEvidence()).status, 'invalid');
  await assert.rejects(cap.executeTool(call(lessonToolRef.name, args(x.binding)), randomUUID()), /TOOL_NOT_ALLOWED/);
  await assert.rejects(pending, /DEADLINE_EXCEEDED/);
});

test('invalid output projection is unavailable and trace sink failure cannot alter read result', async () => {
  const x = await setup();
  x.h.runtime.currentLesson.read = async () => ({ status: 'ok', sourceRevision: x.binding.selection.contentRevision,
    sources: [{ ref: ids.B, retrievedAt: new Date().toISOString() }], data: { originalSentence: 'RAW SQL SENTINEL', configuration: { answer_key: 'SECRET' } } });
  assert.deepEqual(await lesson(x), { status: 'unavailable', code: 'READ_UNAVAILABLE' });
  const y = await setup();
  const cap = await createStudentAiTeacherCapabilities({ ...y.input, intent: 'explain_segment', trace: { emit() { throw new Error('TRACE_FAILED'); } } });
  assert.equal((await cap.executeTool(call(lessonToolRef.name, args(y.binding)), randomUUID())).status, 'ok');
});

test('static: no new UI/API/Provider/write imports, server-only tools reuse domain ports, global registries unchanged', () => {
  assert.equal(existsSync('src/app/api/teaching-agent/tools/route.ts'), false);
  const dir = 'src/features/teaching-agent';
  for (const file of readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.ts') && !f.startsWith('server/transport/') && !f.startsWith('client/'))) {
    const s = readFileSync(`${dir}/${file}`, 'utf8');
    assert.match(s, /import 'server-only'/);
    assert.doesNotMatch(s.replace(/createHash\('sha256'\)\.update\(/g, 'HASH('), /\.\s*(insert|update|upsert|delete|rpc)\s*\(/, file);
    assert.doesNotMatch(s, /qwen.*adapter|learning-agent\/respond|resolveScriptStep|use client|from ['"][^'"]*(?:components|react|next\/navigation)/, file);
    if (file !== 'server/runtime/create-student-ai-teacher-runtime.ts') assert.doesNotMatch(s, /DeepSeekProviderAdapter/, file);
    if (file.startsWith('server/tools/')) assert.doesNotMatch(s, /from ['"][^'"]*(?:supabase|repositories)\b|fetch\(/, file);
  }
  assert.match(readFileSync('src/features/agent-core/tools/registry.ts', 'utf8'), /productionToolRegistry = createToolRegistry\(\)/);
});

test('isolated PostgreSQL: real Student Tools through Core/1A repository, hashes unchanged on 23 tables',
  { skip: process.env.RUN_TEACHING_AGENT_ISOLATED_DB_TESTS !== '1', timeout: 120000 }, async t => {
    await withIsolatedStudentDatabase(async ({ rows, readPlan, hashes, sql, literal }) => {
      const h = harness(rows, readPlan), before = hashes();
      const x = await setup({ h, korean: false });
      const started = performance.now();
      assert.equal((await lesson(x)).status, 'ok'); assert.equal((await state(x)).status, 'ok');
      assert.equal((await x.cap.validateOutput(output())).status, 'accepted');
      assert.deepEqual(hashes(), before);
      t.diagnostic(`PostgreSQL tools/evidence=${(performance.now() - started).toFixed(1)}ms; 23 tables before=after SHA256=${digest(before)}`);
      for (const table of ['learning_agent_sessions', 'learning_agent_messages', 'learning_agent_node_attempts', 'learning_agent_task_events', 'lesson_progress', 'digital_textbook_node_progress']) t.diagnostic(`${table} before=after ${before[table]}`);
      // Fixture maintenance only, after the read-only measurement. No target DB is connected.
      sql(`update learning_agent_script_nodes set updated_at='2026-02-02T00:00:00Z' where id=${literal(uuid(112))};`);
      assert.equal((await lesson(x)).status, 'stale');
      sql(`update student_app_enrollments set status='cancelled' where student_id=${literal(ids.A1)};`);
      await assert.rejects(state(x), /TOOL_NOT_ALLOWED/);
    });
  });
