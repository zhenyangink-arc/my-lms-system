import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePolicyRequirements, POLICY_FIELDS, POLICY_CHECKS } from "../src/features/course-completion/policy-form.ts";
const runtime = await import(process.env.LMS_PGLITE_MODULE ?? "@electric-sql/pglite").catch(() => null);
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const read = file => readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8");

test("policy drafts, atomic replacement, immutable published versions and refresh retry require owner authorization", {skip: !runtime && "Set LMS_PGLITE_MODULE for isolated PostgreSQL verification"}, async () => {
  const db = new runtime.PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role; create schema private; create schema auth;
      alter default privileges in schema public grant execute on functions to anon, authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function private.is_platform_owner() returns boolean language sql stable as $$select current_setting('test.owner',true) = 'true'$$;
      create table public.student_apps(id uuid primary key,slug text);
      create table public.courses(id uuid primary key,student_app_id uuid,content_scope text);
      create table public.course_completion_policies(id uuid primary key default gen_random_uuid(), student_app_id uuid,course_id uuid,policy_code text,version integer,title text,
        status text default 'draft',is_default boolean default true,effective_from timestamptz,effective_until timestamptz,requirements jsonb,created_by uuid,
        published_by uuid,published_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),unique(policy_code,version));
      create table public.course_completion_refresh_tasks(id uuid primary key default gen_random_uuid(),status text default 'pending',finished_at timestamptz,
        available_at timestamptz,worker_token uuid,dedupe_key text,created_at timestamptz default now());
      insert into student_apps values('${id(1)}','korean');
      insert into courses values('${id(2)}','${id(1)}','platform');
      select set_config('test.uid','${id(3)}',false),set_config('test.owner','true',false);
    `);
    const original = await read("202608200003_course_completion_policies_and_evaluations.sql");
    await db.exec(original.slice(original.indexOf("create or replace function private.completion_policy_requirements_are_valid"),original.indexOf("create table public.course_completion_policies")));
    await db.exec(original.slice(original.indexOf("create or replace function private.enforce_course_completion_policy_lifecycle"),original.indexOf("create table public.student_course_completion_evaluations")));
    await db.exec(await read("202609080005_completion_policy_management.sql"));
    const form = new FormData();
    for (const f of POLICY_FIELDS) form.set(`${f.section}.${f.key}`,String(f.initial));
    for (const f of POLICY_CHECKS) form.set(`${f.section}.${f.key}`,"on");
    const requirements = parsePolicyRequirements(form);
    const save = async (policy = null, values = requirements) => (await db.query("select public.save_completion_policy_draft($1,$2,$3,$4) id",[policy,id(2),"测试结课政策",JSON.stringify(values)])).rows[0].id;
    const publish = policy => db.query("select public.publish_completion_policy_draft($1)",[policy]);
    const policies = async () => (await db.query("select id,version,status from course_completion_policies order by version")).rows;
    await db.exec("set role authenticated");
    const first = await save();
    await publish(first);
    await assert.rejects(save(first),/草稿/);
    await assert.rejects(publish(first),/草稿/);
    const second = await save();
    await save(second);
    await db.exec("reset role");
    assert.deepEqual((await policies()).map(p => p.status),["published","draft"]);
    await db.exec("set role authenticated");
    await publish(second);
    await db.exec("reset role");
    assert.deepEqual((await policies()).map(p => p.status),["retired","published"]);
    await assert.rejects(db.query("update course_completion_policies set requirements='{}' where id=$1",[second]),/不可直接修改/);
    const third = await save();
    // Simulate an invalid legacy draft. Publishing it must roll back retirement of the current version.
    await db.query("update course_completion_policies set requirements='{}' where id=$1",[third]);
    await assert.rejects(publish(third),/requirements/);
    assert.equal((await policies()).find(p => p.id === second).status,"published");
    await assert.rejects(save(null,{}),/要求无效/);
    await db.exec("insert into course_completion_refresh_tasks(status,dedupe_key) values('failed','a'),('partial_failed','b'),('pending','c')");
    await db.exec("set role authenticated");
    let health = (await db.query("select public.get_completion_refresh_health() h")).rows[0].h;
    assert.equal(health.failed,2);
    assert.equal((await db.query("select public.retry_failed_completion_refresh() n")).rows[0].n,2);
    health = (await db.query("select public.get_completion_refresh_health() h")).rows[0].h;
    assert.equal(health.pending,3);
    await db.exec("select set_config('test.owner','false',false)");
    await assert.rejects(save(),/平台负责人/);
    await assert.rejects(publish(third),/平台负责人/);
    await assert.rejects(db.query("select public.get_completion_refresh_health()"),/平台负责人/);
    await assert.rejects(db.query("select public.retry_failed_completion_refresh()"),/平台负责人/);
    await db.exec("reset role; set role anon");
    await assert.rejects(save(),/permission denied/);
    await assert.rejects(publish(third),/permission denied/);
  } finally { await db.close(); }
});
