import '../smart-textbook-legacy-adapter/register-server-only.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const root = '../../../src/features/teaching-agent/server/';
const { SupabaseStudentTeachingReadRepository } = await import(root + 'repositories/supabase-student-teaching-repository.ts');
const { createStudentDomainRuntime } = await import(root + 'composition/create-student-domain-runtime.ts');
const { selectionPins, teachingRef } = await import(root + 'selection/references.ts');

const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ids = { A: uuid(1), B: uuid(2), A1: uuid(11), A2: uuid(12), B1: uuid(13), app: '10000000-0000-4000-8000-000000000001' };
const timestamp = '2026-01-01T00:00:00.000Z';
const lock = { unlock_mode: 'immediate', is_manually_locked: false, available_from: null };
const execution = () => ({ runId: randomUUID(), signal: new AbortController().signal, deadlineAt: new Date(Date.now() + 44000).toISOString() });
const badRef = teachingRef('revision', 'placeholder');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fixtureRows() {
  const rows = {
    profiles: [ids.A1, ids.A2, ids.B1].map(id => ({ id, status: 'active', role: 'student', global_role: 'member' })),
    tenants: [ids.A, ids.B].map(id => ({ id, status: 'active' })),
    tenant_memberships: [[ids.A, ids.A1], [ids.A, ids.A2], [ids.B, ids.B1]].map(([tenant_id, user_id]) =>
      ({ tenant_id, user_id, role: 'student', status: 'active', membership_tier: 'vip2' })),
    tenant_student_apps: [ids.A, ids.B].map(tenant_id => ({ tenant_id, app_id: ids.app, is_enabled: true, status: 'active' })),
    student_app_enrollments: [[ids.A, ids.A1], [ids.A, ids.A2], [ids.B, ids.B1]].map(([tenant_id, student_id]) =>
      ({ tenant_id, student_id, app_id: ids.app, status: 'active', starts_at: timestamp, ends_at: null })),
    course_categories: [], courses: [], lessons: [], digital_textbooks: [], digital_textbook_versions: [],
    digital_textbook_chapters: [], digital_textbook_modules: [], course_chapters: [], learning_agent_profiles: [],
    learning_agent_lessons: [], learning_agent_script_versions: [], learning_agent_script_nodes: [], learning_agent_sessions: [],
    learning_agent_messages: [{ id: uuid(701), session_id: uuid(114), content: 'synthetic-private-message' }],
    learning_agent_node_attempts: [{ id: uuid(702), student_id: ids.A1, tenant_id: ids.A, session_id: uuid(114), response: { private: 'attempt-sentinel' } }],
    learning_agent_task_events: [{ id: uuid(703), student_id: ids.A1, tenant_id: ids.A, session_id: uuid(114), metadata: { private: 'event-sentinel' } }],
    lesson_progress: [{ id: uuid(704), user_id: ids.A1, tenant_id: ids.A, course_id: uuid(102), lesson_id: uuid(103), status: 'not_started' }],
    digital_textbook_node_progress: [{ node_id: uuid(705), version_id: uuid(105), student_id: ids.A1, tenant_id: ids.A, status: 'not_started' }],
  };
  for (const [offset, tenant, actor] of [[100, ids.A, ids.A1], [200, ids.B, ids.B1]]) {
    const id = n => uuid(offset + n), scoped = { content_scope: 'tenant', tenant_id: tenant };
    rows.course_categories.push({ id: id(1), parent_id: null, is_published: true, ...scoped });
    rows.courses.push({ id: id(2), category_id: id(1), student_app_id: ids.app, is_published: true, ...scoped, ...lock });
    rows.lessons.push({ id: id(3), course_id: id(2), title: '合成课时', is_published: true, ...scoped, ...lock });
    rows.digital_textbooks.push({ id: id(4), lesson_id: id(3), student_app_id: ids.app, agent_profile_id: id(8), status: 'published', updated_at: timestamp });
    rows.digital_textbook_versions.push({ id: id(5), textbook_id: id(4), version_number: 1, status: 'published', updated_at: timestamp });
    rows.digital_textbook_chapters.push({ id: id(6), version_id: id(5), chapter_test_id: id(20), status: 'published', updated_at: timestamp });
    rows.course_chapters.push({ id: id(21), lesson_id: id(3), chapter_test_id: id(20), is_published: true, ...scoped, ...lock });
    rows.digital_textbook_modules.push({ id: id(7), chapter_id: id(6), title: { 'zh-CN': '合成模块', 'ko-KR': '합성 모듈' }, updated_at: timestamp });
    rows.learning_agent_profiles.push({ id: id(8), access_feature: 'korean_course', status: 'published' });
    rows.learning_agent_lessons.push({ id: id(9), module_id: id(7), agent_profile_id: id(8), objectives: { 'zh-CN': ['练习合成句子'] }, status: 'published', updated_at: timestamp });
    rows.learning_agent_script_versions.push({ id: id(10), lesson_id: id(9), version_number: 1, status: 'published', updated_at: timestamp },
      { id: id(11), lesson_id: id(9), version_number: 2, status: 'draft', updated_at: timestamp });
    const teacher_script = { 'zh-CN': '第一句。\n\n第二句。', 'ko-KR': '첫 문장입니다.\n\n둘째 문장입니다.' };
    rows.learning_agent_script_nodes.push({ id: id(12), script_version_id: id(10), teacher_script,
      configuration: { scriptSegments: { 'zh-CN': ['第一句。', '第二句。'] }, teacherVideo: { mode: 'legacy' },
        interaction: { correct_option_index: 2, answer_key: 'SECRET-ANSWER-SENTINEL' },
        private_remediation_secret: 'PRIVATE-REMEDIATION-SENTINEL', incorrectFeedback: 'UNPUBLISHED-FEEDBACK-SENTINEL' }, updated_at: timestamp },
    { id: id(13), script_version_id: id(11), teacher_script: { 'zh-CN': '未发布正文-SENTINEL' }, configuration: {}, updated_at: timestamp });
    rows.learning_agent_sessions.push({ id: id(14), tenant_id: tenant, student_id: actor, lesson_id: id(9), agent_profile_id: id(8),
      script_version_id: id(10), current_node_id: id(12), teaching_state: { scriptSegmentNodeId: id(12), scriptSegmentIndex: 1,
        teachingTurnNodeId: id(12), teachingTurnPhase: 'explanation', correct_index: 2, private_grading_key: 'STATE-SECRET-SENTINEL' }, status: 'active', updated_at: timestamp });
  }
  rows.learning_agent_sessions.push({ ...structuredClone(rows.learning_agent_sessions[0]), id: uuid(115), student_id: ids.A2 });
  return rows;
}

// Real Supabase JS -> PostgREST URL parser -> in-memory/isolated SQL read transport.
// This tests SDK serialization, NOT the target PostgREST server or production RLS.
function plan(url) {
  const u = new URL(url); assert.equal(u.origin, 'https://synthetic.invalid');
  assert.ok(u.pathname.startsWith('/rest/v1/'));
  const table = u.pathname.split('/').at(-1);
  const select = u.searchParams.get('select'); assert.ok(select && !select.includes('*'));
  const fields = select.split(',').map(field => {
    const [alias, expression] = field.includes(':') ? field.split(':') : [field, field];
    assert.match(alias, /^[a-z_]+$/);
    const base = expression.split('->')[0]; assert.match(base, /^[a-z_]+$/);
    const path = [...expression.matchAll(/(->>?)([a-zA-Z_]+)/g)].map(match => ({ text: match[1] === '->>', key: match[2] }));
    return { alias, base, path };
  });
  const filters = [...u.searchParams].filter(([key]) => !['select', 'order', 'limit'].includes(key)).map(([key, value]) => {
    assert.match(key, /^[a-z_]+$/); assert.ok(value.startsWith('eq.'));
    return [key, value.slice(3)];
  });
  return { table, fields, filters, order: u.searchParams.get('order'), limit: Number(u.searchParams.get('limit')) };
}
function projected(row, fields) {
  return Object.fromEntries(fields.map(({ alias, base, path }) => {
    let value = row[base] ?? null;
    for (const step of path) { value = value?.[step.key] ?? null; if (step.text && value != null) value = String(value); }
    return [alias, value];
  }));
}
function harness(rows = fixtureRows(), readPlan) {
  const calls = [], events = [];
  let identity = { actorId: ids.A1, tenantId: ids.A };
  const client = createClient('https://synthetic.invalid', 'synthetic-noncredential', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      assert.equal(options.method, 'GET'); assert.equal(options.body, undefined);
      const p = plan(url); calls.push(p);
      assert.ok(p.table === 'student_learning_agent_script_nodes' || Object.hasOwn(rows, p.table), `unapproved table ${p.table}`);
      let selected;
      if (readPlan) selected = readPlan(p, identity);
      else {
        selected = (p.table === 'student_learning_agent_script_nodes' ? rows.learning_agent_script_nodes.map(row=>({...row, segments: row.configuration?.scriptSegments, video_mode: row.configuration?.teacherVideo?.mode})) : rows[p.table]).filter(row => p.filters.every(([key, value]) => String(row[key]) === value));
        if (p.order) { const [key, direction] = p.order.split('.'); selected.sort((a, b) => (a[key] - b[key]) * (direction === 'desc' ? -1 : 1)); }
        selected = selected.slice(0, p.limit).map(row => projected(row, p.fields));
      }
      return new Response(JSON.stringify(selected), { status: 200, headers: { 'content-type': 'application/json' } });
    } },
  });
  const repository = new SupabaseStudentTeachingReadRepository(client);
  const runtime = createStudentDomainRuntime({ repository, authenticate: async () => identity, trace: { emit: event => events.push(event) } });
  const locator = { lessonId: uuid(103), moduleId: uuid(107), teachingSessionId: uuid(114), scriptVersionId: uuid(110),
    nodeId: uuid(112), segmentIndex: 0, locale: 'zh-CN', expectedRevision: badRef, segmentRef: teachingRef('segment', 'placeholder') };
  return { rows, calls, events, runtime, repository, locator, authenticate: async () => identity, setIdentity: value => { identity = value; },
    async pin(overrides = {}) {
      const input = { ...locator, ...overrides };
      const content = await runtime.policy.resolve(input, execution()); assert.ok(content, 'synthetic authorized page read');
      const pins = selectionPins(content, input.locale, input.segmentIndex); assert.ok(pins);
      return { ...input, expectedRevision: pins.expectedRevision, segmentRef: pins.segmentRef };
    },
  };
}
function lessonInput(binding) { return { binding, lessonRef: binding.selection.lessonRef, segmentRef: binding.selection.segmentRef,
  expectedRevision: binding.selection.contentRevision, segmentBinding: 'verified_selection' }; }
function stateInput(binding) { return { binding, teachingSessionRef: teachingRef('session', [binding.scope.tenantId, binding.scope.actorId, binding.scope.teachingSessionId]),
  expectedRevision: binding.selection.contentRevision }; }


export async function withIsolatedStudentDatabase(runFixture) {
    const image = 'public.ecr.aws/supabase/postgres:17.6.1.141', name = `uply-teaching-1a-test-${randomUUID()}`;
    const docker = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    let created = false;
    const literal = value => `'${String(value).replaceAll("'", "''")}'`;
    const ident = value => { assert.match(value, /^[a-z_]+$/); return `"${value}"`; };
    try {
      docker(['run', '-d', '--pull=never', '--name', name, '--label', 'uply.stage=teaching-1a-isolated-test', '--network', 'none',
        '--read-only', '--tmpfs', '/tmp:rw,size=256m,mode=1777', '--user', '100:101', '--entrypoint', '/bin/sh', image, '-c',
        "initdb -D /tmp/teachingpg -A trust --no-locale >/tmp/init.log && exec postgres -D /tmp/teachingpg -k /tmp -c listen_addresses='' -c max_connections=20"]);
      created = true;
      const inspected = JSON.parse(docker(['inspect', name]))[0];
      assert.equal(inspected.HostConfig.NetworkMode, 'none'); assert.equal(inspected.HostConfig.ReadonlyRootfs, true);
      assert.equal(inspected.HostConfig.Binds, null); assert.deepEqual(inspected.HostConfig.PortBindings, {});
      const sql = statement => docker(['exec', '-i', name, 'psql', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: statement }).trim();
      const sqlAsync = statement => new Promise((resolve, reject) => {
        const child = execFile('docker', ['exec', '-i', name, 'psql', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], { encoding: 'utf8' }, (error, stdout, stderr) => { if (error) { error.stderr = stderr; reject(error); } else resolve(stdout.trim()); });
        child.stdin.end(statement);
      });
      let ready = false;
      for (let i = 0; i < 50; i++) { try { sql('select 1;'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
      assert.equal(ready, true);
      const rows = fixtureRows();
      // Minimal schema: exact selected columns/types, key relationships and publication uniqueness.
      // Unread side-effect sentinel tables deliberately omit unrelated production columns/triggers.
      const schemas = {
        profiles: 'id uuid primary key,status text,role text,global_role text',
        tenants: 'id uuid primary key,status text not null',
        tenant_memberships: 'tenant_id uuid references tenants(id),user_id uuid references profiles(id),role text,status text,membership_tier text,primary key(tenant_id,user_id)',
        tenant_student_apps: 'tenant_id uuid references tenants(id),app_id uuid,is_enabled boolean,status text,primary key(tenant_id,app_id)',
        student_app_enrollments: 'tenant_id uuid references tenants(id),student_id uuid references profiles(id),app_id uuid,status text,starts_at timestamptz not null,ends_at timestamptz,primary key(tenant_id,student_id,app_id),check(ends_at is null or ends_at>starts_at)',
        course_categories: 'id uuid primary key,parent_id uuid references course_categories(id),is_published boolean,content_scope text,tenant_id uuid references tenants(id)',
        courses: 'id uuid primary key,category_id uuid references course_categories(id),student_app_id uuid,is_published boolean,content_scope text,tenant_id uuid references tenants(id),unlock_mode text,is_manually_locked boolean,available_from timestamptz',
        lessons: 'id uuid primary key,course_id uuid references courses(id),title text,is_published boolean,content_scope text,tenant_id uuid references tenants(id),unlock_mode text,is_manually_locked boolean,available_from timestamptz',
        learning_agent_profiles: 'id uuid primary key,access_feature text,status text',
        digital_textbooks: 'id uuid primary key,lesson_id uuid unique references lessons(id),student_app_id uuid,agent_profile_id uuid references learning_agent_profiles(id),status text,updated_at timestamptz',
        digital_textbook_versions: 'id uuid primary key,textbook_id uuid references digital_textbooks(id),version_number integer check(version_number>0),status text,updated_at timestamptz,unique(textbook_id,version_number)',
        digital_textbook_chapters: 'id uuid primary key,version_id uuid references digital_textbook_versions(id),chapter_test_id uuid,status text,updated_at timestamptz',
        digital_textbook_modules: 'id uuid primary key,chapter_id uuid references digital_textbook_chapters(id),title jsonb,updated_at timestamptz',
        course_chapters: 'id uuid primary key,lesson_id uuid references lessons(id),chapter_test_id uuid unique,is_published boolean,content_scope text,tenant_id uuid references tenants(id),unlock_mode text,is_manually_locked boolean,available_from timestamptz',
        learning_agent_lessons: 'id uuid primary key,module_id uuid references digital_textbook_modules(id),agent_profile_id uuid references learning_agent_profiles(id),objectives jsonb,status text,updated_at timestamptz,unique(module_id,agent_profile_id)',
        learning_agent_script_versions: 'id uuid primary key,lesson_id uuid references learning_agent_lessons(id),version_number integer check(version_number>0),status text,updated_at timestamptz,unique(lesson_id,version_number)',
        learning_agent_script_nodes: 'id uuid primary key,script_version_id uuid references learning_agent_script_versions(id),teacher_script jsonb,configuration jsonb,updated_at timestamptz',
        learning_agent_sessions: "id uuid primary key,tenant_id uuid references tenants(id),student_id uuid references profiles(id),lesson_id uuid references learning_agent_lessons(id),agent_profile_id uuid references learning_agent_profiles(id),script_version_id uuid references learning_agent_script_versions(id),current_node_id uuid references learning_agent_script_nodes(id),teaching_state jsonb,status text check(status in ('active','completed','abandoned')),updated_at timestamptz",
        learning_agent_messages: 'id uuid primary key,session_id uuid references learning_agent_sessions(id),content text',
        learning_agent_node_attempts: 'id uuid primary key,student_id uuid references profiles(id),tenant_id uuid references tenants(id),session_id uuid references learning_agent_sessions(id),response jsonb',
        learning_agent_task_events: 'id uuid primary key,student_id uuid references profiles(id),tenant_id uuid references tenants(id),session_id uuid references learning_agent_sessions(id),metadata jsonb',
        lesson_progress: 'id uuid primary key,user_id uuid references profiles(id),tenant_id uuid references tenants(id),course_id uuid references courses(id),lesson_id uuid references lessons(id),status text',
        digital_textbook_node_progress: 'node_id uuid,version_id uuid references digital_textbook_versions(id),student_id uuid references profiles(id),tenant_id uuid references tenants(id),status text,primary key(tenant_id,student_id,node_id,version_id)',
      };
      let bootstrap = 'create role student_fixture; grant usage on schema public to student_fixture;';
      for (const [table, columns] of Object.entries(schemas)) {
        bootstrap += `create table ${ident(table)}(${columns});`;
        if (['course_categories', 'courses', 'lessons', 'course_chapters'].includes(table)) bootstrap += `alter table ${ident(table)} add check((content_scope='platform' and tenant_id is null) or (content_scope='tenant' and tenant_id is not null));`;
        for (const row of rows[table]) bootstrap += `insert into ${ident(table)}(${Object.keys(row).map(ident).join(',')}) values(${Object.values(row).map(value => value === null ? 'null' : literal(typeof value === 'object' ? JSON.stringify(value) : value)).join(',')});`;
      }
      bootstrap += "create unique index one_published_script on learning_agent_script_versions(lesson_id) where status='published';";
      const actor = "current_setting('fixture.actor')::uuid", tenant = "current_setting('fixture.tenant')::uuid";
      for (const table of Object.keys(schemas)) {
        let predicate = 'true';
        if (table === 'profiles') predicate = `id=${actor}`;
        else if (table === 'tenants') predicate = `id=${tenant}`;
        else if (table === 'tenant_memberships') predicate = `user_id=${actor} and tenant_id=${tenant}`;
        else if (table === 'tenant_student_apps') predicate = `tenant_id=${tenant}`;
        else if (Object.hasOwn(rows[table][0] ?? {}, 'student_id')) predicate = `student_id=${actor} and tenant_id=${tenant}`;
        else if (table === 'lesson_progress') predicate = `user_id=${actor} and tenant_id=${tenant}`;
        else if (['course_categories', 'courses', 'lessons', 'course_chapters'].includes(table)) predicate = `is_published and (content_scope='platform' or tenant_id=${tenant})`;
        else if (['digital_textbooks', 'digital_textbook_versions', 'digital_textbook_chapters', 'learning_agent_lessons', 'learning_agent_profiles', 'learning_agent_script_versions'].includes(table)) predicate = "status='published'";
        else if (table === 'learning_agent_script_nodes') predicate = "exists(select 1 from learning_agent_script_versions v where v.id=script_version_id and v.status='published')";
        else if (table === 'learning_agent_messages') predicate = 'exists(select 1 from learning_agent_sessions s where s.id=session_id)';
        bootstrap += `alter table ${ident(table)} enable row level security; grant select on ${ident(table)} to student_fixture; create policy fixture_read on ${ident(table)} for select to student_fixture using(${predicate});`;
      }
      // Contract-only projection in the synthetic SQL adapter, not production RLS evidence.
      bootstrap += "create view student_learning_agent_script_nodes with(security_invoker=true) as select id,script_version_id,updated_at,teacher_script,configuration->'scriptSegments' as segments,configuration->'teacherVideo'->>'mode' as video_mode from learning_agent_script_nodes; grant select on student_learning_agent_script_nodes to student_fixture;";
      sql(bootstrap);
      const readPlan = (p, identity) => {
        const projection = p.fields.map(field => {
          let expression = ident(field.base);
          for (const step of field.path) expression += `${step.text ? '->>' : '->'}${literal(step.key)}`;
          return `${expression} as ${ident(field.alias)}`;
        }).join(',');
        const where = p.filters.map(([key, value]) => `${ident(key)}=${literal(value)}`).join(' and ');
        let order = '';
        if (p.order) { const [column, direction] = p.order.split('.'); assert.ok(['asc', 'desc'].includes(direction)); order = ` order by ${ident(column)} ${direction}`; }
        assert.ok(Number.isInteger(p.limit) && p.limit > 0 && p.limit <= 2);
        return JSON.parse(sql(`begin read only; set local role student_fixture; set local fixture.actor=${literal(identity.actorId)}; set local fixture.tenant=${literal(identity.tenantId)};
          select coalesce(json_agg(projected),'[]') from (select ${projection} from ${ident(p.table)} where ${where || 'true'}${order} limit ${p.limit}) projected; commit;`));
      };
      const hashes = () => Object.fromEntries(Object.keys(schemas).map(table => [table, sql(`select count(*)||':'||md5(coalesce(string_agg(to_jsonb(t)::text,',' order by to_jsonb(t)::text),'')) from ${ident(table)} t;`)]));
      return await runFixture({ rows, readPlan, hashes, sql, sqlAsync, literal, schemas });
    } finally {
      if (created) docker(['rm', '-f', name]); // This fixture's unique disposable container only.
    }
}

export { uuid, ids, timestamp, execution, badRef, digest, fixtureRows, harness, lessonInput, stateInput };
