begin;

-- 同一学生的同一章节测试只保留最近一次提交。
with ranked_attempts as (
  select
    id,
    row_number() over (
      partition by tenant_id, student_id, test_slug
      order by attempted_at desc, id desc
    ) as attempt_rank
  from public.course_test_attempts
)
delete from public.course_test_attempts as attempt
using ranked_attempts as ranked
where attempt.id = ranked.id
  and ranked.attempt_rank > 1;

create unique index if not exists course_test_attempts_student_test_unique_idx
  on public.course_test_attempts (tenant_id, student_id, test_slug);

create or replace function private.overwrite_previous_course_test_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- 串行化同一学生、同一测试的并发提交，避免产生重复成绩。
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.tenant_id::text || ':' || new.student_id::text || ':' || new.test_slug,
      0
    )
  );

  delete from public.course_test_attempts
  where tenant_id = new.tenant_id
    and student_id = new.student_id
    and test_slug = new.test_slug;

  return new;
end;
$function$;

drop trigger if exists overwrite_previous_course_test_attempt
  on public.course_test_attempts;

create trigger overwrite_previous_course_test_attempt
before insert on public.course_test_attempts
for each row
execute function private.overwrite_previous_course_test_attempt();

comment on function private.overwrite_previous_course_test_attempt() is
  '提交章节测试前删除同一学生的旧成绩，使每份测试仅保留最近一次结果。';

commit;
