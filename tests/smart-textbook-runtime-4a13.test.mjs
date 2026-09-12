import assert from 'node:assert/strict';
import test from 'node:test';
import { source, manifest, compiled, evidence } from './fixtures/runtime-4a.mjs';
import { serverModule, teacherSession } from './fixtures/runtime-4a2.server.mjs';
import { teacherChecks, teacherCapabilityReadiness, auditTeacherTargets } from '../src/features/smart-textbook-runtime/core/teacher-readiness.ts';
import { runtimeReadiness, rendererRegistry } from '../src/features/smart-textbook-runtime/core/block-registry.ts';

const { createRuntimeTeacherSessions, teacherSessionRequest } = await serverModule('src/features/smart-textbook-runtime/server/teacher-session.server.ts');
const { teacherSourceInventory } = await serverModule('src/features/smart-textbook-runtime/server/teacher-inventory.server.ts');
const teacherBlock = manifest.blocks.find(b => b.type === 'compat.teacher.v1');
const inventory = teacherSourceInventory(teacherSession().data);
const mount = { stepId: teacherBlock.stepId, generation: 1, locale: 'zh-CN' };

/** Only SELECT transport is substituted. Resolver, grant verifier and selector
 * are real. The synthetic answer is NOT asserted to be the published answer. */
function harness(overrides = {}) {
  let caller = { actorId: 'isolated-owner', role: 'platform_owner' };
  const selected = [], reads = [], data = { ...teacherSession().data, result: structuredClone(compiled) };
  const tables = {
    learning_agent_script_audio_assets: evidence.speech,
    learning_agent_script_nodes: source.teachingNodes,
    learning_agent_script_versions: source.teachingVersions,
    digital_textbook_activities: source.activities,
    digital_textbook_activity_secrets: source.activities.map(a => ({ activity_id: a.id,
      answer_key: { kind: 'index', value: 0 }, explanation: { correct: { 'zh-CN': '隔离正确反馈' } } })),
  };
  data.admin = { from(table) {
    assert.ok(table in tables, `Unexpected table/mutation ${table}`); reads.push(table);
    let rows = tables[table];
    return { select() { return this; }, eq(k, v) { rows = rows.filter(r => r[k] === v); return this; },
      async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
      then(resolve) { resolve({ data: rows, error: null }); } };
  } };
  const service = createRuntimeTeacherSessions({ authorize: async () => caller,
    readSpeech: async selection => { selected.push(selection.assetId); return new Blob(['isolated audio transport'], { type: 'audio/wav' }); }, ...overrides });
  return { data, service, selected, reads, setCaller(value) { caller = value; } };
}

test('4A13 source inventory scans actual eight v23 nodes, text/bullets/expression and THREE teacher reference sites', () => {
  assert.equal(inventory.nodes.length, 8);
  assert.deepEqual(inventory.nodes.map(n => n.key), [...source.teachingNodes].sort((a,b) => a.sort_order-b.sort_order).map(n => n.node_key));
  assert.deepEqual([...new Set(inventory.nodes.flatMap(n => n.blackboardTypes))].sort(), ['bullets', 'expression', 'text']);
  assert.equal(inventory.nodes.filter(n => n.taskRequired).length, 1);
  assert.equal(inventory.nodes.filter(n => n.terminal).length, 1);
  assert.equal(inventory.requirements.length, 3); // includes old terminal focus_activity
  assert.deepEqual(inventory.unsupported, []);
  assert.equal(manifest.steps.length, 8); assert.equal(manifest.activityRefs.length, 19);
  assert.equal(manifest.blocks.filter(b => b.type === 'multiple_choice').length, 3);
});

test('4A15 promotion preserves non-UI gate and does not certify missing Teacher evidence', () => {
  assert.equal(rendererRegistry['compat.learning.v1'].rendererStatus, 'implemented');
  assert.equal(rendererRegistry['compat.teacher.v1'].rendererStatus, 'implemented');
  const result = runtimeReadiness(manifest, compiled.nonUiRuntimeReady);
  assert.equal(result.nonUiRuntimeReady, true); assert.equal(result.runtimeReady, true);
  assert.equal(result.unsupported.length, 0);
  assert.equal(runtimeReadiness(manifest,false).runtimeReady,false);
});

test('4A13 teacher coverage cannot reuse learning coverage or accept controlled refusal as execution', () => {
  const absent = auditTeacherTargets(manifest, inventory.requirements, []);
  assert.equal(absent.requiredUnsupported, 3); assert.equal(absent.danglingCommands, 7);
  const witnesses = inventory.requirements.flatMap(r => r.commands.map(command => ({ ...r, command, ownerCount: 1, result: 'controlled-refusal', test: 'isolated-command-test' })));
  assert.equal(auditTeacherTargets(manifest, inventory.requirements, witnesses).requiredUnsupported, 3);
  witnesses.forEach(w => w.result = 'executed');
  assert.equal(auditTeacherTargets(manifest, inventory.requirements, witnesses).requiredUnsupported, 0);
  witnesses[0].ownerCount = 2;
  assert.equal(auditTeacherTargets(manifest, inventory.requirements, witnesses).duplicateOwners, 1);
  witnesses[0].snapshotId = 'wrong-snapshot';
  assert.ok(auditTeacherTargets(manifest, inventory.requirements, witnesses).rows[0].invalid);
});

test('4A13 readiness fails closed for absent/stale/repeated evidence, missing nodes and unsupported renderer', () => {
  const input = { teachingRevision: manifest.teachingRefs[0].revision, requiredNodeKeys: inventory.nodes.map(n => n.key),
    sourceUnsupported: inventory.unsupported, nodes: [], requiredTargets: inventory.requirements, targets: auditTeacherTargets(manifest, inventory.requirements, []), evidence: [] };
  const missing = teacherCapabilityReadiness(manifest, input);
  assert.equal(missing.teacherReady, false); assert.ok(missing.blockers.includes('teacher.strict-complete-runtime'));
  const claims = teacherChecks.map(check => ({ check, snapshotId: manifest.snapshot.id, teachingRevision: input.teachingRevision, status: 'passed', test: 'synthetic negative evaluator input' }));
  const evaluated = teacherCapabilityReadiness(manifest, { ...input, evidence: claims });
  assert.equal(evaluated.teacherReady, false); assert.ok(evaluated.blockers.includes('teacher.node-inventory'));assert.ok(evaluated.blockers.includes('teacher.targets'));
  claims[0].snapshotId = 'wrong'; claims.push({ ...claims[1] });
  const bad = teacherCapabilityReadiness(manifest, { ...input, evidence: claims });
  assert.ok(bad.blockers.includes('teacher.renderer')); assert.ok(bad.blockers.includes('teacher.character'));
  assert.ok(teacherCapabilityReadiness(manifest, { ...input, sourceUnsupported: ['unmapped-task'] }).blockers.includes('teacher.source-unmapped'));
});

test('4A13 strict browser boundary rejects every private identity, completion and generation injection', () => {
  const request = { session: 'teacher-session-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', operation: 'turn', intent: 'start' };
  assert.ok(teacherSessionRequest.safeParse(request).success);
  for (const field of ['scriptVersionId','nodeId','tenantId','userId','speechAssetId','objectKey','generation','snapshot','sourceRevision','score','completion','agentAdvance']) {
    assert.equal(teacherSessionRequest.safeParse({ ...request, [field]: 'injected' }).success, false, field);
  }
});

test('4A13 opaque teacher session reauthorizes owner, snapshot and Step; no private identifiers in cue', async () => {
  const h = harness(), { session } = await h.service.open(h.data, mount);
  const cue = await h.service.request({ session, operation: 'turn', intent: 'start' });
  assert.match(cue.cue, /^teacher-cue-/); assert.equal(cue.speechAvailable, true);
  const json = JSON.stringify(cue);
  for (const forbidden of [...source.teachingNodes.map(n => n.id), ...evidence.speech.map(a => a.id), manifest.teachingRefs[0].revision]) assert.ok(!json.includes(forbidden));
  assert.doesNotMatch(json, /objectKey|object_key|speechAssetId|signedUrl|tenantId|userId|answer_key|scriptVersion/);
  h.setCaller({ actorId: 'other-owner', role: 'platform_owner' });
  await assert.rejects(h.service.request({ session, operation: 'turn', intent: 'ready' }), /OWNER/);
  h.setCaller({ actorId: 'isolated-owner', role: 'student' });
  await assert.rejects(h.service.request({ session, operation: 'turn', intent: 'ready' }), /AUTHORITY/);
  h.setCaller({ actorId: 'isolated-owner', role: 'platform_owner' });
  await assert.rejects(h.service.open(h.data, { ...mount, stepId: manifest.steps[1].id }), /STEP_SCOPE/);
  h.data.result.manifest.snapshot.id = 'changed';
  await assert.rejects(h.service.request({ session, operation: 'turn', intent: 'start' }), /REVISION/);
});

test('4A13 resolver eight-node flow → required grant → task feedback → wrong/remediation → correct → terminal; no learning writes', async () => {
  const h = harness(), { session } = await h.service.open(h.data, mount);
  let cue = await h.service.request({ session, operation: 'turn', intent: 'start' });
  const texts = [], phases = new Set(); let observed = false, wrong = false, question = false;
  for (let i = 0; i < 50; i++) {
    texts.push(cue.text); phases.add(cue.phase);
    if (cue.speechAvailable) await h.service.request({ session, operation: 'speech', cue: cue.cue, kind: 'speech' });
    if (cue.task && !observed) {
      assert.equal(cue.task.playbackAvailable, true);
      await assert.rejects(h.service.request({ session, operation: 'observe-tts', grantId: crypto.randomUUID() }), /Unissued/);
      const grant = await h.service.request({ session, operation: 'issue-tts' });
      const observation = await h.service.request({ session, operation: 'observe-tts', grantId: grant.grantId });
      assert.equal(observation.teachingPlaybackWaitSatisfied, true);
      assert.equal(observation.formalCompletion, false); assert.equal(observation.progressDelta, null);
      assert.equal(observation.score, null); assert.equal(observation.agentAdvance, false);
      const duplicate = await h.service.request({ session, operation: 'observe-tts', grantId: grant.grantId });
      assert.equal(duplicate.duplicate, true); assert.equal(duplicate.teachingPlaybackWaitSatisfied, false);
      observed = true;
    }
    if (cue.terminal) break;
    if (cue.awaitingAnswer) {
      question = true;
      await assert.rejects(h.service.request({ session, operation: 'turn', intent: 'answer', answer: 'not an option' }), /ANSWER_SCOPE/);
      const answer = cue.questionOptions[wrong ? 0 : 1];
      cue = await h.service.request({ session, operation: 'turn', intent: 'answer', answer });
      if (!wrong) { assert.equal(cue.awaitingAnswer, true); assert.ok(cue.text.length); wrong = true; }
    } else cue = await h.service.request({ session, operation: 'turn', intent: 'ready' });
  }
  assert.equal(observed && wrong && question && cue.terminal, true);
  assert.deepEqual([...phases].sort(), ['explanation','question','task','task_feedback']);
  for (const node of source.teachingNodes) {
    const script = node.teacher_script['zh-CN'];
    assert.ok(texts.some(text => script.includes(text) && text.trim()), `Missing real explanation: ${node.node_key}`);
  }
  const terminal = await h.service.request({ session, operation: 'turn', intent: 'ready' });
  assert.deepEqual(terminal, cue); // no additional resolver event or next cue
  assert.ok(h.selected.every(id => evidence.speech.some(a => a.id === id && a.segment_index !== 199)));
  assert.ok(!h.reads.some(t => /attempt|progress|events/.test(t)));
});

test('4A13 cue bytes are current-session scoped; Step cancellation rejects a late media response', async () => {
  let resolveBytes, started;
  const pending = new Promise(resolve => started = resolve);
  const h = harness({ readSpeech: async ({ signal }) => { started(); return new Promise(resolve => { resolveBytes = () => { assert.equal(signal.aborted, true); resolve(new Blob(['audio'], { type: 'audio/wav' })); }; }); } });
  const { session } = await h.service.open(h.data, mount);
  const first = await h.service.request({ session, operation: 'turn', intent: 'start' });
  const next = await h.service.request({ session, operation: 'turn', intent: 'ready' });
  await assert.rejects(h.service.request({ session, operation: 'speech', cue: first.cue, kind: 'speech' }), /CUE_SCOPE/);
  const work = h.service.request({ session, operation: 'speech', cue: next.cue, kind: 'speech' });
  await pending;
  await assert.rejects(h.service.request({ session, operation: 'turn', intent: 'ready' }), /BUSY/);
  await h.service.request({ session, operation: 'cancel' }); resolveBytes();
  await assert.rejects(work, /REVOKED/);
  await assert.rejects(h.service.request({ session, operation: 'turn', intent: 'start' }), /OWNER/);
});

test('4A13 TTL/capacity and page reload establish fresh state rather than reuse consumed grants', async () => {
  let time = Date.now(); const h = harness({ now: () => time, ttlMs: 100, capacity: 1 });
  const old = await h.service.open(h.data, mount);
  await assert.rejects(h.service.open(h.data, mount), /CAPACITY/);
  const first = await h.service.request({ session: old.session, operation: 'turn', intent: 'start' });
  time += 101;
  await assert.rejects(h.service.request({ session: old.session, operation: 'turn', intent: 'start' }), /EXPIRED/);
  const fresh = await h.service.open(h.data, { ...mount, generation: 2 });
  const reset = await h.service.request({ session: fresh.session, operation: 'turn', intent: 'start' });
  assert.notEqual(fresh.session, old.session); assert.notEqual(reset.cue, first.cue); assert.equal(reset.text, first.text);
  await assert.rejects(h.service.request({ session: fresh.session, operation: 'speech', cue: first.cue, kind: 'speech' }), /CUE_SCOPE/);
});

test('4A13 late resolver cannot commit after Step revocation; another session starts cleanly', async () => {
  const h = harness(); let release, entered, blocked = false;
  const barrier = new Promise(resolve => entered = resolve), original = h.data.admin.from;
  h.data.admin.from = table => {
    const query = original(table);
    if (table === 'learning_agent_script_audio_assets') {
      const read = query.maybeSingle;
      query.maybeSingle = async () => { if (!blocked) { blocked = true; entered(); await new Promise(resolve => release = resolve); } return read(); };
    }
    return query;
  };
  const { session } = await h.service.open(h.data, mount);
  const work = h.service.request({ session, operation: 'turn', intent: 'start' });
  await barrier;
  await h.service.request({ session, operation: 'cancel' }); release();
  await assert.rejects(work, /REVOKED/);
  h.data.admin.from = original;
  const second = await h.service.open(h.data, { ...mount, generation: 2 });
  assert.equal((await h.service.request({ session: second.session, operation: 'turn', intent: 'start' })).phase, 'explanation');
});

test('4A13 TTS grant cannot cross sessions or be reused after task phase/Step change', async () => {
  const h = harness(), first = await h.service.open(h.data, mount), second = await h.service.open(h.data, mount);
  const reachTask = async session => {
    let cue = await h.service.request({ session, operation: 'turn', intent: 'start' });
    for (let i = 0; i < 20 && !cue.task; i++) cue = await h.service.request({ session, operation: 'turn', intent: 'ready' });
    assert.ok(cue.task); return cue;
  };
  await assert.rejects(h.service.request({ session: first.session, operation: 'issue-tts' }), /Unauthorized/);
  await reachTask(first.session); await reachTask(second.session);
  const grant = await h.service.request({ session: first.session, operation: 'issue-tts' });
  await assert.rejects(h.service.request({ session: second.session, operation: 'observe-tts', grantId: grant.grantId }), /Unissued/);
  await h.service.request({ session: first.session, operation: 'observe-tts', grantId: grant.grantId });
  const feedback = await h.service.request({ session: first.session, operation: 'turn', intent: 'ready' });
  assert.equal(feedback.phase, 'task_feedback');
  await assert.rejects(h.service.request({ session: first.session, operation: 'observe-tts', grantId: grant.grantId }), /Unauthorized/);
  const pending = await h.service.request({ session: second.session, operation: 'issue-tts' });
  await h.service.request({ session: second.session, operation: 'cancel' });
  await assert.rejects(h.service.request({ session: second.session, operation: 'observe-tts', grantId: pending.grantId }), /OWNER/);
});

test('4A13 authorized byte port rejects empty/non-audio response and missing buffer; no asset-ID request input', async () => {
  for (const blob of [new Blob([], { type: 'audio/wav' }), new Blob(['x'], { type: 'text/html' })]) {
    const h = harness({ readSpeech: async () => blob }), { session } = await h.service.open(h.data, mount);
    const cue = await h.service.request({ session, operation: 'turn', intent: 'start' });
    await assert.rejects(h.service.request({ session, operation: 'speech', cue: cue.cue, kind: 'speech' }), /INVALID_AUDIO_BYTES/);
    // The incoming first-node buffer is now selected explicitly, not confused
    // with the previous implementation's upcoming-node buffer.
    await assert.rejects(h.service.request({ session, operation: 'speech', cue: cue.cue, kind: 'buffer' }), /INVALID_AUDIO_BYTES/);
    assert.equal(teacherSessionRequest.safeParse({ session, operation: 'speech', cue: cue.cue, kind: 'speech', assetId: evidence.speech[0].id }).success, false);
  }
});
