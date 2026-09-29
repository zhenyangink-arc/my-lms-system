import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { withStudentRuntimeDatabase, requestFixture } from './fixtures/teaching-agent/student-runtime.mjs';
import { ids, digest } from './fixtures/teaching-agent/student-domain.mjs';
const { DeepSeekProviderAdapter } = await import('../src/features/agent-core/providers/deepseek/adapter.ts');
const enabled = process.env.RUN_STUDENT_AGENT_LIVE_TESTS === '1';
const realFetch = globalThis.fetch;
// Only the explicitly configured DeepSeek adapter below can use the captured transport.
globalThis.fetch = async () => { throw new Error('UNAPPROVED_LIVE_NETWORK'); };
const reportPath = '/tmp/uply-stage1c-live-results.json';

test('opt-in ONLY: at most two synthetic live DeepSeek product Agent Runs in disposable integrated PostgreSQL',
  { skip: !enabled, timeout: 180000 }, async t => {
    assert.ok(process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY must exist; never print its value');
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8'))
      : { scope: 'ISOLATED SYNTHETIC ONLY', targetSupabase: 'PARTIAL', liveRuns: 0, providerRequests: 0, runs: [] };
    assert.ok(report.liveRuns < 2, 'This Stage 1C live allowance is already consumed; do not repeat live tests');
    const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
    save();
    await withStudentRuntimeDatabase(async f => {
      for (const session of [true, false].slice(report.liveRuns)) {
        assert.ok(report.liveRuns < 2); report.liveRuns++; save();
        let requests = 0; const calls = [], wire = [];
        const adapter = new DeepSeekProviderAdapter({ readApiKey: () => process.env.DEEPSEEK_API_KEY,
          fetchImpl: async (url, init) => {
            assert.equal(url, 'https://api.deepseek.com/chat/completions');
            assert.ok(requests < 3 && report.providerRequests < 6);
            const body = JSON.parse(init.body);
            assert.equal(body.model, 'deepseek-v4-flash'); assert.deepEqual(body.thinking, { type: 'disabled' });
            assert.equal(body.stream, true); assert.ok(['auto','none'].includes(body.tool_choice));
            const text = JSON.stringify(body);
            for (const privateId of Object.values(ids)) assert.ok(!text.includes(privateId));
            assert.ok(!text.includes('SENTINEL'));
            if (!requests) {
              assert.equal(body.tool_choice, 'auto'); assert.ok(!text.includes('저는 학생입니다.'));
              assert.deepEqual(body.tools.map(tool => tool.function.name), session
                ? ['get_current_lesson_context','get_current_teaching_state'] : ['get_current_lesson_context']);
            }
            wire.push({ toolChoice: body.tool_choice, toolNames: body.tools.map(tool => tool.function.name),
              toolResults: body.messages.filter(m => m.role === 'tool').length });
            requests++; report.providerRequests++; save();
            return realFetch(url, init);
          } });
        const provider = { providerId: adapter.providerId, getCapabilities: adapter.getCapabilities,
          async *stream(request, context) {
            const started = performance.now();
            const entry = { model: request.model.model, configVersion: request.model.configVersion, toolChoice: request.toolChoice,
              finishReason: 'unknown', toolNames: [], usage: { status: 'unknown' }, durationMs: 0 };
            calls.push(entry);
            try {
              for await (const event of adapter.stream(request, context)) {
                if (event.type === 'usage') entry.usage = event.usage;
                if (event.type === 'done') { entry.finishReason = event.response.finishReason; entry.toolNames = event.response.toolCalls.map(c => c.name); }
                yield event;
              }
            } finally { entry.durationMs = Math.round(performance.now() - started); }
          } };
        const runtime = f.createRuntime(provider), before = f.hashes(), input = await requestFixture(f.h, { session }), events = [];
        input.emit = event => events.push(event);
        input.metadata.receivedAt = new Date().toISOString();
        const started = performance.now();
        const result = await runtime.run(input);
        const totalMs = Math.round(performance.now() - started);
        const rows = JSON.parse(f.sql(`select json_agg(json_build_object('kind',kind,'at',created_at,'metadata',metadata,'modelCallId',model_call_id,'toolCallId',tool_call_id,'skillRunId',skill_run_id) order by seq) from agent_run_events where run_id=${f.literal(result.run.id)};`));
        const stats = { session, status: result.run.status, totalMs, providerRequests: requests, calls,
          teachingBeforeHash: digest(before), teachingAfterHash: digest(f.hashes()),
          persistedUsageRecords: Number(f.sql(`select count(*) from agent_run_events where kind='model.usage' and run_id=${f.literal(result.run.id)};`)),
          phaseMs: {} };
        const at = kind => Date.parse(rows.find(r => r.kind === kind)?.at ?? '');
        stats.phaseMs = {
          intakeAndAdmission: Math.max(0, at('run.started') - Date.parse(input.metadata.receivedAt)),
          contextAndPrompt: at('model.started') - at('run.started'),
          planning: calls[0]?.durationMs,
          firstTool: at('tool.completed') - at('tool.requested'),
          final: calls.at(-1)?.durationMs,
          terminalPersistence: at('run.completed') - at('output.checked'),
        };
        report.runs.push(stats); save();
        assert.equal(result.run.status, 'completed', 'Live run did not complete; see safe metadata report');
        assert.ok(totalMs < 45000); assert.ok(requests >= 2 && requests <= 3);
        assert.ok(calls.some(call => call.toolNames.includes('get_current_lesson_context')));
        assert.equal(wire.at(-1).toolChoice, 'none'); assert.ok(wire.at(-1).toolResults >= 1);
        assert.ok(rows.some(r => r.kind === 'tool.completed' && r.metadata.details.toolRef.name === 'get_current_lesson_context' && ['ok','partial'].includes(r.metadata.details.status)));
        for (const kind of ['evidence.checked','output.checked']) assert.ok(rows.some(r => r.kind === kind && r.metadata.details.status === 'pass'));
        assert.deepEqual(f.hashes(), before); assert.equal(stats.persistedUsageRecords, requests);
        assert.equal(new Set(rows.filter(r => r.kind === 'model.usage').map(r => r.modelCallId)).size, requests);
        assert.ok(calls.every(c => c.usage.status === 'reported'));
        assert.equal(f.sql(`select count(*) from agent_messages where run_id=${f.literal(result.run.id)};`), '2');
        assert.deepEqual(events.slice(-2).map(e => e.type), ['answer.final','run.completed']);
        assert.ok(!events.some(e => e.type === 'answer.delta'));
        // Deliberately no prompt, question, answer, arguments, ToolResult or credentials in diagnostics.
        t.diagnostic(JSON.stringify(stats));
      }
    });
    t.diagnostic(`Live Runs=${report.liveRuns}; Provider Requests=${report.providerRequests}; safe metadata=${reportPath}`);
  });
