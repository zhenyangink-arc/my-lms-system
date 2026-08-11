// 阶段一：验证 1 对多公共课堂数据模型。
// 只创建临时课堂并在同一 SQL 事务末尾回滚，不保留测试数据。
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const env = fs.readFileSync(".env.local", "utf8");
const token = env
  .split(/\r?\n/)
  .find((line) => line.startsWith("SUPABASE_ACCESS_TOKEN="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN_MISSING");
  process.exit(1);
}

const projectRef = "jubdbsjsalpecfvseskz";

function runQuery(query) {
  const bodyPath = path.join(
    os.tmpdir(),
    `verify_live_class_model_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
  fs.writeFileSync(bodyPath, JSON.stringify({ query }), "utf8");
  try {
    const result = spawnSync(
      "curl.exe",
      [
        "-sS",
        "-X",
        "POST",
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        "-H",
        `Authorization: Bearer ${token}`,
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        `@${bodyPath}`,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    if (result.status !== 0) {
      throw new Error(`SUPABASE_QUERY_FAILED: ${String(result.stderr).trim()}`);
    }
    return result.stdout;
  } finally {
    try {
      fs.unlinkSync(bodyPath);
    } catch {
      // 临时文件清理失败不影响数据库校验结果。
    }
  }
}

const structure = runQuery(`
  select json_build_object(
    'mode_column', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'live_class_sessions'
        and column_name = 'mode' and is_nullable = 'NO' and column_default is not null
    ),
    'student_id_nullable', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'live_class_sessions'
        and column_name = 'student_id' and is_nullable = 'YES'
    ),
    'members_table', to_regclass('public.live_class_members') is not null,
    'members_unique', exists (
      select 1
      from pg_constraint
      where conrelid = 'public.live_class_members'::regclass
        and contype = 'u'
        and pg_get_constraintdef(oid) = 'UNIQUE (session_id, student_id)'
    ),
    'members_session_cascade', exists (
      select 1
      from pg_constraint
      where conrelid = 'public.live_class_members'::regclass
        and contype = 'f'
        and pg_get_constraintdef(oid) like 'FOREIGN KEY (session_id)%ON DELETE CASCADE'
    ),
    'mode_student_consistency_constraint', exists (
      select 1
      from pg_constraint
      where conrelid = 'public.live_class_sessions'::regclass
        and conname = 'live_class_sessions_mode_student_consistency'
        and contype = 'c'
        and convalidated
    ),
    'member_validation_trigger', exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.live_class_members'::regclass
        and tgname = 'live_class_members_validate_trigger'
        and tgenabled <> 'D'
    ),
    'invalid_mode_rows', (select count(*) from public.live_class_sessions where mode not in ('one_on_one', 'group')),
    'legacy_null_mode_rows', (select count(*) from public.live_class_sessions where mode is null),
    'one_on_one_without_student', (select count(*) from public.live_class_sessions where mode = 'one_on_one' and student_id is null),
    'group_with_student', (select count(*) from public.live_class_sessions where mode = 'group' and student_id is not null)
  ) as result;
`);

const behavior = runQuery(`
  begin;

  create temporary table stage1_results (
    test text primary key,
    passed boolean not null,
    detail text not null
  ) on commit drop;

  do $$
  declare
    source_session public.live_class_sessions%rowtype;
    test_group_id uuid;
    test_member_id bigint;
  begin
    select * into source_session
    from public.live_class_sessions
    where mode = 'one_on_one' and student_id is not null
    order by created_at
    limit 1;

    if source_session.id is null then
      raise exception '没有可用于事务测试的一对一课堂基准数据';
    end if;

    begin
      insert into public.live_class_sessions (
        tenant_id, teacher_id, student_id, course_id, lesson_id,
        chapter_slug, status, mode
      ) values (
        source_session.tenant_id, source_session.teacher_id, null,
        source_session.course_id, source_session.lesson_id,
        source_session.chapter_slug, 'active', 'group'
      ) returning id into test_group_id;
      insert into stage1_results values ('group_accepts_null_student', true, 'group 课堂可使用空 student_id');
    exception when others then
      insert into stage1_results values ('group_accepts_null_student', false, sqlerrm);
    end;

    begin
      insert into public.live_class_sessions (
        tenant_id, teacher_id, student_id, course_id, lesson_id,
        chapter_slug, status, mode
      ) values (
        source_session.tenant_id, source_session.teacher_id, source_session.student_id,
        source_session.course_id, source_session.lesson_id,
        source_session.chapter_slug, 'active', 'group'
      );
      insert into stage1_results values ('group_rejects_direct_student', false, '错误地接受了非空 student_id');
    exception when others then
      insert into stage1_results values ('group_rejects_direct_student', true, sqlerrm);
    end;

    begin
      insert into public.live_class_members (session_id, student_id)
      values (test_group_id, source_session.student_id)
      returning id into test_member_id;
      insert into stage1_results values ('group_accepts_member', true, 'group 课堂成员写入成功');
    exception when others then
      insert into stage1_results values ('group_accepts_member', false, sqlerrm);
    end;

    begin
      insert into public.live_class_members (session_id, student_id)
      values (test_group_id, source_session.student_id);
      insert into stage1_results values ('member_unique', false, '错误地接受了重复成员');
    exception when unique_violation then
      insert into stage1_results values ('member_unique', true, sqlerrm);
    when others then
      insert into stage1_results values ('member_unique', false, sqlerrm);
    end;

    begin
      insert into public.live_class_members (session_id, student_id)
      values (source_session.id, source_session.student_id);
      insert into stage1_results values ('one_on_one_rejects_member_row', false, '错误地允许 one_on_one 写成员表');
    exception when others then
      insert into stage1_results values ('one_on_one_rejects_member_row', true, sqlerrm);
    end;

    delete from public.live_class_sessions where id = test_group_id;
    insert into stage1_results
    select
      'member_cascade_delete',
      not exists (select 1 from public.live_class_members where id = test_member_id),
      '删除课堂后成员行应被级联删除';
  end;
  $$;

  select json_agg(stage1_results order by test) as result from stage1_results;
  rollback;
`);

console.log(JSON.stringify({
  structure: JSON.parse(structure),
  behavior: JSON.parse(behavior),
}, null, 2));
