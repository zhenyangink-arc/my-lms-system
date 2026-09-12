import { readFileSync } from 'node:fs';
export const readMigration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
export function functionDdl(name, migration) {
  const sql = readMigration(migration), start = sql.indexOf(`create or replace function ${name}(`);
  if (start < 0) throw Error(`Missing real function ${name}`);
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start));
  if (end < 0) throw Error(`Incomplete function ${name}`);
  return sql.slice(start, end + 3);
}
/** Isolated database ONLY. Replaces the empty minimal 4A5 dependency tables
 * with the actual attempt/progress DDL and current downstream write triggers.
 * Auth/GUID identities are synthetic; no production dump, credentials or rows.
 */
export async function installRecordingWriteChain(db) {
  const original = readMigration('202607310013_smart_digital_textbook_chapter_one.sql');
  const table = name => {
    const begin = original.indexOf(`create table if not exists public.${name} (`);
    return original.slice(begin, original.indexOf('\n);', begin) + 3);
  };
  await db.query(`create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function private.current_tenant_id() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.tenant',true),'')::uuid$$;
    create table public.student_applications(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users on delete cascade);
    create table public.digital_textbook_versions(id uuid primary key);
    create table public.chapter_tests(id uuid primary key,slug text unique not null,student_app_id uuid not null references public.student_applications,status text not null);
    alter table public.digital_textbook_chapters add foreign key(version_id) references public.digital_textbook_versions on delete restrict;
    alter table public.digital_textbook_chapters add column chapter_test_id uuid references public.chapter_tests;
    drop table public.digital_textbook_attempts,public.digital_textbook_node_progress;
    ${table('digital_textbook_attempts')}
    alter table public.digital_textbook_attempts add column meets_completion_requirements boolean not null default false;
    ${table('digital_textbook_node_progress')}
    create table public.course_ebook_progress(
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null default private.current_tenant_id() references public.tenants on delete cascade,
      student_id uuid not null references public.profiles on delete cascade,
      student_app_id uuid not null references public.student_applications,
      test_slug text not null references public.chapter_tests(slug),
      current_page integer not null default 0 check(current_page>=0),total_pages integer not null check(total_pages>0),
      progress_percent integer not null default 0 check(progress_percent between 0 and 100),
      read_pages integer[] not null default '{}', reading_seconds integer not null default 0 check(reading_seconds>=0),
      completion_source text not null default 'ebook' check(completion_source in ('ebook','smart_textbook','both')),
      last_read_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
      unique(tenant_id,student_id,test_slug));
    create table public.digital_textbook_activity_secrets(activity_id uuid primary key references public.digital_textbook_activities,answer_key jsonb,explanation jsonb);
    grant usage on schema private to service_role; grant all on all tables in schema public to service_role;
    alter table public.digital_textbook_attempts enable row level security;
    alter table public.digital_textbook_node_progress enable row level security;
    alter table public.course_ebook_progress enable row level security;`);
  await db.query(functionDdl('private.set_updated_at', '202607200002_multi_tenant_foundation.sql'));
  await db.query(readMigration('202608180027_restore_objective_activity_recording.sql'));
  await db.query(functionDdl('private.sync_smart_textbook_chapter_completion', '202608180007_chapter_two_golden_smart_textbook.sql'));
  await db.query(functionDdl('private.sync_student_app_ownership', '202608160001_application_domain_hardening.sql'));
  await db.query(functionDdl('private.validate_student_app_activity', '202608170002_platform_conversation_practice_management.sql'));
  await db.query(`create trigger digital_textbook_node_progress_set_updated_at before update on public.digital_textbook_node_progress for each row execute function private.set_updated_at();
    create trigger sync_smart_textbook_chapter_completion after insert or update on public.digital_textbook_node_progress for each row execute function private.sync_smart_textbook_chapter_completion();
    create trigger course_ebook_progress_sync_student_app before insert or update of test_slug,student_app_id on public.course_ebook_progress for each row execute function private.sync_student_app_ownership();
    create trigger ebook_progress_student_app_access before insert or update on public.course_ebook_progress for each row execute function private.validate_student_app_activity();
    create trigger course_ebook_progress_set_updated_at before update on public.course_ebook_progress for each row execute function private.set_updated_at();`);
}
