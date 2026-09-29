import '../smart-textbook-legacy-adapter/register-server-only.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { harness, ids, withIsolatedStudentDatabase } from './student-domain.mjs';
const { pinStudentRuntimeDefinition } = await import('../../../src/features/teaching-agent/server/runtime/student-runtime-definition.ts');
const { createStudentAiTeacherRuntime } = await import('../../../src/features/teaching-agent/server/runtime/create-student-ai-teacher-runtime.ts');
const { SupabaseAgentRepositories } = await import('../../../src/features/agent-core/persistence/supabase/repositories.ts');
const { DeepSeekProviderAdapter } = await import('../../../src/features/agent-core/providers/deepseek/adapter.ts');
const { MemoryPersistence, sse, streamResponse } = await import('../agent-core/foundation.mjs');

export async function requestFixture(h, { session = true, question = '为什么这里用 는？' } = {}) {
  const selection = await h.pin({ teachingSessionId: session ? h.locator.teachingSessionId : undefined });
  const scope = { kind: 'lesson', lessonId: selection.lessonId, moduleId: selection.moduleId,
    ...(session ? { teachingSessionId: selection.teachingSessionId } : {}) };
  return { request: { protocolVersion: 1, agentCode: 'student-ai-teacher', idempotencyKey: randomUUID(), message: question, scope },
    selection, intent: 'explain_segment', metadata: { requestId: randomUUID(), receivedAt: new Date().toISOString() }, signal: new AbortController().signal };
}
export function koreanHarness() {
  const h = harness();
  h.rows.learning_agent_script_nodes[0].teacher_script['zh-CN'] = '저는 학생입니다.\n\n이것은 책입니다.';
  return h;
}
export const planningSelection = body => JSON.parse(body.messages[1].content.split('\n').slice(1).join('\n'));
export function toolResponse(body, name = 'get_current_lesson_context', overrides = {}) {
  const context = planningSelection(body);
  return { calls: [{ id: 'synthetic_' + randomUUID(), name,
    arguments: JSON.stringify(name === 'get_current_lesson_context' ? { lessonRef: context.lessonRef, segmentRef: context.segmentRef } : {}), ...overrides }] };
}
export function responseStream({ text = '', calls = [], usage = true, finish, reasoning = 'PRIVATE-REASONING-SENTINEL' } = {}) {
  const chunks = [];
  if (text) chunks.push({ choices: [{ delta: { content: text, reasoning_content: reasoning }, finish_reason: null }] });
  for (const [index, call] of calls.entries()) chunks.push({ choices: [{ delta: { tool_calls: [{ index, id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] }, finish_reason: null }] });
  chunks.push({ choices: [{ delta: {}, finish_reason: finish ?? (calls.length ? 'tool_calls' : 'stop') }] });
  if (usage) chunks.push({ choices: [], usage: { prompt_tokens: 300, completion_tokens: 30, total_tokens: 330 } });
  return streamResponse(sse([...chunks, '[DONE]']), 100);
}
export function providerFixture(steps) {
  const calls = [];
  const provider = new DeepSeekProviderAdapter({ readApiKey: () => 'synthetic-noncredential', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const body = JSON.parse(init.body); calls.push(body);
    assert.deepEqual(body.thinking, { type: 'disabled' }); assert.equal(body.stream, true);
    const step = steps?.[calls.length - 1];
    if (step) return step(body, init, calls);
    return responseStream(calls.length === 1 ? toolResponse(body) : { text: '는 标记话题，这里谈论的是“我”。' });
  } });
  return { provider, calls };
}
export async function memoryRuntime(options = {}) {
  const h = options.h ?? koreanHarness(), fixture = options.providerFixture ?? providerFixture();
  let persistence, authority;
  const runtime = createStudentAiTeacherRuntime({ repository: h.repository, authenticate: options.authenticate ?? h.authenticate,
    provider: fixture.provider, persistence: a => { authority = a; persistence ??= new MemoryPersistence(a); options.configurePersistence?.(persistence); return persistence; } });
  const input = await requestFixture(h, options), events = []; input.emit = event => events.push(event);
  return { h, runtime, input, events, calls: fixture.calls, get persistence() { return persistence; }, get authority() { return authority; } };
}

// Real Supabase SDK + actual Core RPC repository + both real SQL migrations.
// The transport below implements only the tested PostgREST subset; it is NOT target PostgREST/JWT proof.
export async function withStudentRuntimeDatabase(runFixture, { transport = false } = {}) {
  await withIsolatedStudentDatabase(async fixture => {
    const { sql, literal, rows, readPlan } = fixture;
    sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
      insert into auth.users values(${literal(ids.A1)}),(${literal(ids.A2)}),(${literal(ids.B1)});
      create table public.ai_token_usage(id uuid primary key default gen_random_uuid(),user_id uuid,tenant_id uuid,provider text not null,model text not null,feature_code text not null,agent_code text,input_tokens integer not null default 0,output_tokens integer not null default 0,total_tokens integer not null default 0,created_at timestamptz default now());
      alter table public.ai_token_usage enable row level security;grant usage on schema public to service_role,authenticated,anon;`);
    sql(readFileSync('supabase/migrations/202609140000_agent_core_foundation.sql', 'utf8'));
    sql(readFileSync('supabase/migrations/202609140001_agent_runtime_completion_evidence.sql', 'utf8'));
    if (transport) sql(readFileSync('supabase/migrations/202609140002_agent_run_cancel_request.sql', 'utf8'));
    const definition = pinStudentRuntimeDefinition();
    sql(`insert into public.agent_definition_versions(tenant_id,actor_id,agent_code,version,status,manifest)
      values(${literal(ids.A)},${literal(ids.A1)},'student-ai-teacher','1.0.0','published',${literal(JSON.stringify(definition.profile))}::jsonb);`);
    sql(`update learning_agent_script_nodes set teacher_script='{"zh-CN":"저는 학생입니다.\\n\\n이것은 책입니다.","ko-KR":"저는 학생입니다."}'::jsonb where id=${literal(rows.learning_agent_script_nodes[0].id)};`);
    const operations = [];
    const client = createClient('https://synthetic-agent.invalid', 'synthetic-noncredential', { auth: { persistSession: false, autoRefreshToken: false }, global: {
      fetch: async (url, init) => {
        const u = new URL(url); assert.equal(u.origin, 'https://synthetic-agent.invalid');
        let data;
        try {
          if (u.pathname.startsWith('/rest/v1/rpc/')) {
            const name = u.pathname.split('/').at(-1);
            assert.ok(['admit_agent_run_v1','transition_agent_run_v1','append_agent_run_event_v1','append_agent_run_event_v2','record_agent_usage_v1', ...(transport ? ['reserve_student_agent_event_sequence_v1','get_student_agent_run_status_v1','request_agent_run_cancel_v1','check_agent_run_cancel_v1'] : [])].includes(name));
            assert.equal(init.method, 'POST'); const args = JSON.parse(init.body); operations.push({ kind: name });
            const params = Object.entries(args).map(([key, value]) => {
              assert.match(key, /^p_[a-z_]+$/);
              if (value === null) return `${key}=>null`;
              if (typeof value === 'number') return `${key}=>${value}`;
              return `${key}=>${literal(typeof value === 'object' ? JSON.stringify(value) : value)}${typeof value === 'object' ? '::jsonb' : ''}`;
            }).join(',');
            const out = sql(`set role service_role;select public.${name}(${params});`);
            data = name === 'check_agent_run_cancel_v1' ? out === 't' : out ? JSON.parse(out) : null;
          } else {
            assert.equal(init.method, 'GET');
            const table = u.pathname.split('/').at(-1); assert.ok(['agent_definition_versions','agent_runs','agent_conversations','agent_messages'].includes(table));
            const selected = u.searchParams.get('select'); assert.match(selected, /^(\*|[a-z_,]+)$/);
            const where = [...u.searchParams].filter(([key]) => !['select','order','limit'].includes(key)).map(([key, value]) => {
              assert.match(key, /^[a-z_]+$/); assert.ok(value.startsWith('eq.')); return `${key}=${literal(value.slice(3))}`;
            }).join(' and ');
            let suffix = '';
            if (u.searchParams.has('order')) { const [column, direction] = u.searchParams.get('order').split('.'); assert.match(column, /^[a-z_]+$/); assert.ok(['asc','desc'].includes(direction)); suffix += ` order by ${column} ${direction}`; }
            if (u.searchParams.has('limit')) { const limit = Number(u.searchParams.get('limit')); assert.ok(Number.isInteger(limit) && limit <= 40); suffix += ` limit ${limit}`; }
            data = JSON.parse(sql(`set role service_role;select coalesce(json_agg(q),'[]') from (select ${selected} from public.${table} where ${where || 'true'}${suffix}) q;`));
            operations.push({ kind: 'select', table });
          }
          return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
        } catch (error) {
          const known = ['RUN_CANCELLED','REQUIRED_EVIDENCE_MISSING','SKILL_OUTPUT_INVALID','FORBIDDEN','RUN_NOT_FOUND','CONVERSATION_BUSY','IDEMPOTENCY_CONFLICT','BUDGET_UNAVAILABLE','PERSISTENCE_FAILED','DEADLINE_EXCEEDED','INVALID_REQUEST'];
          const safe = known.find(code => String(error.stderr).includes(code)) ?? 'PERSISTENCE_FAILED';
          return new Response(JSON.stringify({ message: safe, code: 'P0001' }), { status: 400, headers: { 'content-type': 'application/json' } });
        }
      },
    } });
    const h = harness(rows, readPlan);
    const createRuntime = provider => createStudentAiTeacherRuntime({ authenticate: h.authenticate, repository: h.repository,
      persistence: authority => new SupabaseAgentRepositories(client, authority), provider });
    await runFixture({ ...fixture, h, client, createRuntime, operations, definition });
  });
}
