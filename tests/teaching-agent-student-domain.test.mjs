import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = '../src/features/teaching-agent/server/';
const { createStudentDomainRuntime } = await import(root + 'composition/create-student-domain-runtime.ts');
const { teachingRef, nodeSegments } = await import(root + 'selection/references.ts');
const { teachingScriptSegments } = await import('../src/lib/teaching-video.ts');
const { productionToolRegistry } = await import('../src/features/agent-core/tools/registry.ts');
const { productionSkillRegistry } = await import('../src/features/agent-core/skills/registry.ts');

import { uuid, ids, timestamp, execution, digest, harness, lessonInput, stateInput, withIsolatedStudentDatabase } from './fixtures/teaching-agent/student-domain.mjs';
let providerCalls = 0;
// Any accidental network outside the explicitly injected fixture transport fails immediately.
globalThis.fetch = async () => { providerCalls++; throw new Error('NETWORK_FORBIDDEN_IN_STUDENT_DOMAIN_TEST'); };

test('positive A1 selection, both real repository ports and CoreContext; zero writes/provider calls', async t => {
  const h = harness(), before = digest(h.rows), locator = await h.pin();
  const started = performance.now();
  const verified = await h.runtime.selection.verify(locator, execution()); assert.equal(verified.status, 'ok');
  const b = verified.data;
  assert.equal(b.scope.actorId, ids.A1); assert.equal(b.scope.tenantId, ids.A); assert.equal(b.scope.teachingLessonId, uuid(109));
  const lesson = await h.runtime.currentLesson.read(lessonInput(b), b.authority, execution()); assert.equal(lesson.status, 'ok');
  assert.equal(lesson.data.originalSentence, '第一句。');
  const state = await h.runtime.teachingState.read(stateInput(b), b.authority, execution()); assert.equal(state.status, 'ok');
  assert.equal(state.data.semantic, 'last_saved_teaching_position'); assert.equal(state.data.segmentIndex, 1);
  assert.notEqual(state.data.segmentRef, b.selection.segmentRef);
  const context = await h.runtime.context.resolveBinding(b, execution()); assert.equal(context.status, 'ok');
  assert.equal(context.data.values.selection.provenance, 'verified_selection');
  const refs = new Set(context.data.sources.map(source => source.ref));
  for (const value of Object.values(context.data.values)) { assert.ok(value.sourceRefs.length); assert.ok(value.sourceRefs.every(ref => refs.has(ref))); }
  const output = JSON.stringify(context);
  for (const denied of ['SENTINEL', 'correct_option_index', 'private_grading_key', ids.A1, ids.A, uuid(112), 'selectedText']) assert.ok(!output.includes(denied), denied);
  assert.equal(digest(h.rows), before); assert.equal(providerCalls, 0);
  assert.ok(h.events.some(event => event.kind === 'context.resolve' && event.phase === 'started'));
  assert.ok(h.events.some(event => event.kind === 'context.resolve' && event.phase === 'completed'));
  assert.ok(!JSON.stringify(h.events).includes('第一句')); assert.ok(!JSON.stringify(h.events).includes('SENTINEL'));
  assert.ok(h.calls.every(call => !call.fields.some(field => ['configuration', 'teaching_state'].includes(field.base) && !field.path.length)));
  const elapsed = performance.now() - started; assert.ok(elapsed < 45000);
  t.diagnostic(`SMOKE ONLY memory/Supabase SDK selection+ports+context=${elapsed.toFixed(1)}ms; queries=${h.calls.length}; before=after=${before}`);
});

const changes = [
  ['other student session', h => { h.locator.teachingSessionId = uuid(115); }],
  ['other tenant session', h => { h.locator.teachingSessionId = uuid(214); }],
  ['tenant null', h => h.setIdentity({ actorId: ids.A1, tenantId: null })],
  ['unauthenticated', h => h.setIdentity(null)],
  ['wrong actor', h => h.setIdentity({ actorId: ids.B1, tenantId: ids.A })],
  ['inactive profile', h => { h.rows.profiles[0].status = 'inactive'; }],
  ['null profile status', h => { h.rows.profiles[0].status = null; }],
  ['inactive tenant', h => { h.rows.tenants[0].status = 'suspended'; }],
  ['inactive membership', h => { h.rows.tenant_memberships[0].status = 'inactive'; }],
  ['teacher membership', h => { h.rows.tenant_memberships[0].role = 'teacher'; }],
  ['tenant admin membership', h => { h.rows.tenant_memberships[0].role = 'tenant_super_admin'; }],
  ['platform owner', h => { h.rows.profiles[0].global_role = 'platform_owner'; }],
  ['platform inspector', h => { h.rows.profiles[0].global_role = 'platform_course_inspector'; }],
  ['legacy operator', h => { h.rows.profiles[0].role = 'tenant_operator'; }],
  ['legacy platform owner without global role', h => { h.rows.profiles[0].role = 'platform_super_admin'; h.rows.profiles[0].global_role = null; }],
  ['low membership tier', h => { h.rows.tenant_memberships[0].membership_tier = 'vip1'; }],
  ['missing enrollment', h => { h.rows.student_app_enrollments.shift(); }],
  ['expired enrollment', h => { h.rows.student_app_enrollments[0].ends_at = '2026-02-01T00:00:00Z'; }],
  ['inactive enrollment', h => { h.rows.student_app_enrollments[0].status = 'paused'; }],
  ['future enrollment', h => { h.rows.student_app_enrollments[0].starts_at = '2099-01-01T00:00:00Z'; }],
  ['malformed enrollment date', h => { h.rows.student_app_enrollments[0].starts_at = 'invalid'; }],
  ['disabled app', h => { h.rows.tenant_student_apps[0].is_enabled = false; }],
  ['hidden app', h => { h.rows.tenant_student_apps[0].status = 'hidden'; }],
  ['wrong app', h => { h.rows.courses[0].student_app_id = uuid(999); }],
  ['wrong textbook app', h => { h.rows.digital_textbooks[0].student_app_id = uuid(999); }],
  ['unpublished lesson', h => { h.rows.lessons[0].is_published = false; }],
  ['unpublished course', h => { h.rows.courses[0].is_published = false; }],
  ['unpublished category', h => { h.rows.course_categories[0].is_published = false; }],
  ['draft textbook', h => { h.rows.digital_textbooks[0].status = 'draft'; }],
  ['draft textbook version', h => { h.rows.digital_textbook_versions[0].status = 'draft'; }],
  ['draft chapter', h => { h.rows.digital_textbook_chapters[0].status = 'draft'; }],
  ['disabled profile', h => { h.rows.learning_agent_profiles[0].status = 'archived'; }],
  ['unsupported access feature', h => { h.rows.learning_agent_profiles[0].access_feature = 'dashboard_section'; }],
  ['draft teaching lesson', h => { h.rows.learning_agent_lessons[0].status = 'draft'; }],
  ['no published script', h => { h.rows.learning_agent_script_versions[0].status = 'draft'; }],
  ['module from other tenant', h => { h.locator.moduleId = uuid(207); }],
  ['module chapter relation changed', h => { h.rows.digital_textbook_modules[0].chapter_id = uuid(206); }],
  ['textbook catalog relation changed', h => { h.rows.digital_textbooks[0].lesson_id = uuid(203); }],
  ['catalog course belongs to B', h => { h.rows.lessons[0].course_id = uuid(202); }],
  ['session owner changed', h => { h.rows.learning_agent_sessions[0].student_id = ids.A2; }],
  ['session tenant changed', h => { h.rows.learning_agent_sessions[0].tenant_id = ids.B; }],
  ['session lesson changed', h => { h.rows.learning_agent_sessions[0].lesson_id = uuid(209); }],
  ['session profile changed', h => { h.rows.learning_agent_sessions[0].agent_profile_id = uuid(208); }],
  ['inactive session', h => { h.rows.learning_agent_sessions[0].status = 'completed'; }],
  ['manually locked lesson', h => { h.rows.lessons[0].is_manually_locked = true; }],
  ['future scheduled lesson', h => { h.rows.lessons[0].unlock_mode = 'scheduled'; h.rows.lessons[0].available_from = '2099-01-01'; }],
  ['unsupported prerequisite lesson', h => { h.rows.lessons[0].unlock_mode = 'prerequisite_completed'; }],
  ['locked catalog chapter', h => { h.rows.course_chapters[0].is_manually_locked = true; }],
];
for (const [name, change] of changes) test(`authorization deny: ${name}`, async () => {
  const h = harness(); const pinned = await h.pin(); h.locator = { ...pinned }; change(h);
  const result = await h.runtime.resolve(h.locator, execution()); assert.equal(result.status, 'not_found_or_not_visible');
  assert.deepEqual(Object.keys(result), ['status']);
});

test('cross tenant course request cannot become authority; unknown identity keys reject before reads', async () => {
  const h = harness(), locator = await h.pin();
  for (const key of ['studentId', 'userId', 'tenantId', 'role', 'membership', 'permissions', 'organizationId', 'published']) {
    const count = h.calls.length; const result = await h.runtime.resolve({ ...locator, [key]: ids.B }, execution());
    assert.equal(result.status, 'not_found_or_not_visible'); assert.equal(h.calls.length, count);
  }
  const result = await h.runtime.resolve({ ...locator, lessonId: uuid(203), moduleId: uuid(207) }, execution());
  assert.equal(result.status, 'not_found_or_not_visible');
});

test('A2 and B1 can each read only their own independently authorized fixture', async () => {
  const h = harness(); h.setIdentity({ actorId: ids.A2, tenantId: ids.A });
  let locator = await h.pin({ teachingSessionId: uuid(115) }); assert.equal((await h.runtime.resolve(locator, execution())).status, 'ok');
  h.setIdentity({ actorId: ids.B1, tenantId: ids.B });
  locator = await h.pin({ lessonId: uuid(203), moduleId: uuid(207), teachingSessionId: uuid(214), scriptVersionId: uuid(210), nodeId: uuid(212) });
  assert.equal((await h.runtime.resolve(locator, execution())).status, 'ok');
});

test('legitimate platform content is not mistaken for a tenant leak', async () => {
  const h = harness();
  for (const table of ['course_categories', 'courses', 'lessons', 'course_chapters']) Object.assign(h.rows[table][0], { content_scope: 'platform', tenant_id: null });
  assert.equal((await h.runtime.resolve(await h.pin(), execution())).status, 'ok');
});

const staleChanges = [
  ['new authoritative script', h => { h.rows.learning_agent_script_versions[0].status = 'archived'; h.rows.learning_agent_script_versions[1].status = 'published'; }],
  ['same-version sentence edited', h => { h.rows.learning_agent_script_nodes[0].teacher_script['zh-CN'] = '正文已经修改。'; }],
  ['node removed', h => { h.rows.learning_agent_script_nodes.shift(); }],
  ['wrong node', h => { h.locator.nodeId = uuid(999); }],
  ['draft node/version', h => { h.locator.scriptVersionId = uuid(111); h.locator.nodeId = uuid(113); }],
  ['index changed', h => { h.locator.segmentIndex = 1; }],
  ['out of range', h => { h.locator.segmentIndex = 1999; }],
  ['wrong locale binding', h => { h.locator.locale = 'ko-KR'; }],
  ['forged content digest', h => { h.locator.segmentRef = teachingRef('segment', 'forgery'); }],
  ['session old script', h => { h.rows.learning_agent_sessions[0].script_version_id = uuid(111); }],
  ['node update revision changed', h => { h.rows.learning_agent_script_nodes[0].updated_at = '2026-09-01T00:00:00Z'; }],
];
for (const [name, change] of staleChanges) test(`stale without remapping: ${name}`, async () => {
  const h = harness(); h.locator = await h.pin(); change(h);
  assert.deepEqual(await h.runtime.resolve(h.locator, execution()), { status: 'stale' });
});

test('negative index/invalid locale reject; selected text is only an ignored hint', async () => {
  const h = harness(), locator = await h.pin();
  for (const patch of [{ segmentIndex: -1 }, { segmentIndex: 0.5 }, { locale: 'en-US' }, { expectedRevision: undefined }])
    assert.equal((await h.runtime.resolve({ ...locator, ...patch }, execution())).status, 'not_found_or_not_visible');
  const result = await h.runtime.resolve({ ...locator, selectedText: 'FAKE-TEXT-SENTINEL' }, execution());
  assert.equal(result.data.values.selection.value.originalSentence, '第一句。');
  assert.ok(!JSON.stringify(result).includes('FAKE-TEXT-SENTINEL'));
  assert.ok(!JSON.stringify(h.events).includes('FAKE-TEXT-SENTINEL'));
});

test('shared segmentation: explicit multi-paragraph rows, empty rows, fallback and video locale', async () => {
  const h = harness(), node = h.rows.learning_agent_script_nodes[0];
  node.teacher_script['zh-CN'] = '甲\n\n乙\n\n丙';
  node.configuration.scriptSegments = { 'zh-CN': ['甲\n\n乙', '丙'] }; node.configuration.teacherVideo.mode = 'video';
  const locator = await h.pin({ locale: 'ko-KR' });
  const content = await h.runtime.policy.resolve(locator, execution());
  assert.deepEqual(nodeSegments(content.node, 'ko-KR'), teachingScriptSegments(node.teacher_script, node.configuration, 'ko-KR'));
  const result = await h.runtime.selection.verify(locator, execution());
  assert.equal(result.data.selection.originalSentence, '甲\n\n乙'); assert.equal(result.data.selection.sourceLocale, 'zh-CN');
  node.configuration.teacherVideo.mode = 'legacy'; delete node.teacher_script['ko-KR'];
  node.configuration.scriptSegments = { 'zh-CN': ['', '甲', '乙', '丙'] };
  const fallback = await h.runtime.policy.resolve({ ...locator, locale: 'ko-KR' }, execution());
  assert.deepEqual(nodeSegments(fallback.node, 'ko-KR'), teachingScriptSegments(node.teacher_script, node.configuration, 'ko-KR'));
});

test('issued bindings are immutable capabilities and both ports recheck revoked access', async () => {
  const h = harness(), verified = await h.runtime.selection.verify(await h.pin(), execution()), b = verified.data;
  assert.throws(() => { b.scope.tenantId = ids.B; }, TypeError);
  const copied = structuredClone(b);
  assert.equal((await h.runtime.currentLesson.read(lessonInput(copied), copied.authority, execution())).status, 'not_found_or_not_visible');
  assert.equal((await h.runtime.teachingState.read(stateInput(copied), copied.authority, execution())).status, 'not_found_or_not_visible');
  assert.equal((await h.runtime.currentLesson.read(lessonInput(b), { ...b.authority }, execution())).status, 'not_found_or_not_visible');
  h.rows.student_app_enrollments[0].status = 'cancelled';
  assert.equal((await h.runtime.currentLesson.read(lessonInput(b), b.authority, execution())).status, 'not_found_or_not_visible');
  assert.equal((await h.runtime.teachingState.read(stateInput(b), b.authority, execution())).status, 'not_found_or_not_visible');
});

test('already issued ports reject a new script, and no-session bindings reject a new authenticated actor', async () => {
  const h = harness(), b = (await h.runtime.selection.verify(await h.pin(), execution())).data;
  h.rows.learning_agent_script_versions[0].status = 'archived'; h.rows.learning_agent_script_versions[1].status = 'published';
  assert.equal((await h.runtime.currentLesson.read(lessonInput(b), b.authority, execution())).status, 'stale');
  assert.equal((await h.runtime.teachingState.read(stateInput(b), b.authority, execution())).status, 'stale');
  const other = harness(), own = (await other.runtime.selection.verify(await other.pin({ teachingSessionId: undefined }), execution())).data;
  other.setIdentity({ actorId: ids.A2, tenantId: ids.A });
  assert.equal((await other.runtime.currentLesson.read(lessonInput(own), own.authority, execution())).status, 'not_found_or_not_visible');
});

test('existing-node segmentation equality holds for both supported locales and invalid editor rows', async () => {
  const h = harness();
  for (const mode of ['legacy', 'video']) for (const locale of ['zh-CN', 'ko-KR']) {
    const node = h.rows.learning_agent_script_nodes[0]; node.configuration.teacherVideo.mode = mode;
    node.configuration.scriptSegments = { 'zh-CN': ['invalid-row'], 'ko-KR': ['invalid-row'] };
    const content = await h.runtime.policy.resolve({ ...h.locator, locale }, execution());
    assert.deepEqual(nodeSegments(content.node, locale), teachingScriptSegments(node.teacher_script, node.configuration, locale));
  }
});

test('state revision rejects changed cursor; missing/misaligned cursor becomes partial without guessing', async () => {
  const h = harness(), b = (await h.runtime.selection.verify(await h.pin(), execution())).data;
  const initial = await h.runtime.teachingState.read(stateInput(b), b.authority, execution());
  h.rows.learning_agent_sessions[0].teaching_state.scriptSegmentIndex = 0;
  assert.equal((await h.runtime.teachingState.read({ ...stateInput(b), expectedStateRevision: initial.sourceRevision }, b.authority, execution())).status, 'stale');
  h.rows.learning_agent_sessions[0].teaching_state.scriptSegmentNodeId = uuid(999);
  const partial = await h.runtime.teachingState.read(stateInput(b), b.authority, execution());
  assert.equal(partial.status, 'partial'); assert.equal(partial.data.segmentRef, null); assert.equal(partial.data.segmentIndex, null);
});

test('optional session omitted; projections are bounded and context advertises omissions', async () => {
  const h = harness(); h.rows.learning_agent_script_nodes[0].teacher_script['zh-CN'] = '句'.repeat(5000);
  h.rows.learning_agent_lessons[0].objectives['zh-CN'] = Array(10).fill('目'.repeat(500));
  const locator = await h.pin({ teachingSessionId: undefined });
  const result = await h.runtime.resolve(locator, execution()); assert.equal(result.status, 'partial');
  const selection = result.data.values.selection.value;
  assert.equal(selection.originalSentence.length, 4000); assert.equal(selection.objectives.length, 6);
  assert.ok(selection.truncatedFields.includes('originalSentence')); assert.ok(!result.data.values.teachingState);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 40000);
});

test('Core adapter binds exact scope and never consumes selectedText or message as teaching source', async () => {
  const h = harness(), b = (await h.runtime.selection.verify(await h.pin(), execution())).data;
  const resolver = h.runtime.context.forBinding(b);
  const request = { scope: b.authority.scope, clientContext: { selectedText: 'SENTINEL' }, message: 'SENTINEL' };
  const result = await resolver.resolve(request, b.authority, execution()); assert.ok(!JSON.stringify(result).includes('SENTINEL'));
  await assert.rejects(resolver.resolve({ ...request, scope: { ...request.scope, moduleId: uuid(207) } }, b.authority, execution()), /FORBIDDEN/);
});

test('DB failure is safe; cancellation and deadline remain Core errors', async () => {
  const h = harness(); const locator = await h.pin();
  h.repository.readAuthorizedContent = async () => { throw new Error('DB-PRIVATE-SENTINEL'); };
  assert.deepEqual(await h.runtime.resolve(locator, execution()), { status: 'unavailable' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(h.runtime.resolve(locator, { ...execution(), signal: controller.signal }), /RUN_CANCELLED/);
  await assert.rejects(h.runtime.resolve(locator, { ...execution(), deadlineAt: timestamp }), /DEADLINE_EXCEEDED/);
});

test('static boundary: no mutations/respond/provider/tool runtime; production registries remain empty', () => {
  const directory = 'src/features/teaching-agent/server';
  const files = readdirSync(directory, { recursive: true }).filter(path => path.endsWith('.ts') && !path.startsWith('transport/'));
  for (const path of files) {
    const text = readFileSync(`${directory}/${path}`, 'utf8'); assert.ok(text.includes("import 'server-only'"), path);
    // crypto.Hash.update is hashing, not a database write.
    assert.doesNotMatch(text.replace(/createHash\('sha256'\)\.update\(/g, 'HASH('), /\.\s*(insert|update|upsert|delete|rpc)\s*\(/, path);
    assert.doesNotMatch(text, /learning-agent\/respond|resolveScriptStep|createAdminClient|service_role/, path);
    // Stage 1C's explicit server composition may instantiate the already-verified adapter.
    if (path !== 'runtime/create-student-ai-teacher-runtime.ts') assert.doesNotMatch(text, /DeepSeekProviderAdapter|\/providers\//, path);
    // Stage 1B explicitly authorizes its new capability composition to use Core's executor.
    // The original 1A domain modules must still never execute tools.
    if (path !== 'composition/create-student-ai-teacher-capabilities.ts') assert.doesNotMatch(text, /\/tools\/executor/, path);
  }
  assert.equal(existsSync('src/app/api/teaching-agent/tools/route.ts'), false);
  for (const name of ['get_current_lesson_context', 'get_current_teaching_state']) assert.equal(productionToolRegistry.get({ name, version: '1.0.0' }), undefined);
  assert.equal(productionSkillRegistry.get({ name: 'explain', version: '1.0.0' }), undefined);
  assert.match(readFileSync('src/features/agent-core/tools/registry.ts', 'utf8'), /productionToolRegistry = createToolRegistry\(\)/);
  assert.match(readFileSync('src/features/agent-core/skills/registry.ts', 'utf8'), /productionSkillRegistry = createSkillRegistry\(\)/);
  assert.equal(providerCalls, 0);
});

test('in-flight auth deadline terminates without returning a context', async () => {
  const h = harness(), locator = await h.pin();
  const runtime = createStudentDomainRuntime({ repository: h.repository, authenticate: () => new Promise(() => {}) });
  await assert.rejects(runtime.resolve(locator, { ...execution(), deadlineAt: new Date(Date.now() + 25).toISOString() }), /DEADLINE_EXCEEDED/);
});

test('isolated PostgreSQL: production Supabase SDK/repository domain reads, RLS, hashes and smoke',
  { skip: process.env.RUN_TEACHING_AGENT_ISOLATED_DB_TESTS !== '1', timeout: 120000 }, async t => {
    await withIsolatedStudentDatabase(async ({ rows, readPlan, hashes, sql, literal, schemas }) => {
      const before = hashes(), h = harness(rows, readPlan), pinned = await h.pin();
      const started = performance.now();
      const b = (await h.runtime.selection.verify(pinned, execution())).data; assert.ok(b);
      assert.equal((await h.runtime.currentLesson.read(lessonInput(b), b.authority, execution())).status, 'ok');
      assert.equal((await h.runtime.teachingState.read(stateInput(b), b.authority, execution())).status, 'ok');
      const context = await h.runtime.context.resolveBinding(b, execution()); assert.equal(context.status, 'ok');
      const elapsed = performance.now() - started; assert.ok(elapsed < 45000);
      assert.ok(!JSON.stringify(context).includes('SENTINEL'));
      for (const patch of [{ teachingSessionId: uuid(115) }, { teachingSessionId: uuid(214) }, { lessonId: uuid(203), moduleId: uuid(207) }])
        assert.equal((await h.runtime.resolve({ ...pinned, ...patch }, execution())).status, 'not_found_or_not_visible');
      const after = hashes(); assert.deepEqual(after, before); assert.equal(providerCalls, 0);
      t.diagnostic(`SMOKE ONLY PostgreSQL selection+ports+context=${elapsed.toFixed(1)}ms; SDK SELECT requests=${h.calls.length}; tables=${Object.keys(schemas).length}; before=after SHA256=${digest(before)}`);
      for (const table of ['learning_agent_sessions', 'learning_agent_messages', 'learning_agent_node_attempts', 'learning_agent_task_events', 'lesson_progress', 'digital_textbook_node_progress']) t.diagnostic(`${table} before=after ${before[table]}`);
      assert.throws(() => sql(`set role student_fixture; update learning_agent_sessions set status='abandoned';`), error => /permission denied/.test(String(error.stderr)));
      // Fixture maintenance occurs only AFTER the no-side-effect measurement.
      sql(`update learning_agent_script_versions set status='archived' where id=${literal(uuid(110))}; update learning_agent_script_versions set status='published' where id=${literal(uuid(111))};`);
      assert.equal((await h.runtime.resolve(pinned, execution())).status, 'stale');
      sql(`update student_app_enrollments set status='cancelled' where student_id=${literal(ids.A1)};`);
      assert.equal((await h.runtime.resolve(pinned, execution())).status, 'not_found_or_not_visible');
    });
  });
