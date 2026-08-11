begin;

-- course_test_attempts_test_slug_check was written when only the 4 hangul
-- intro tests existed. It was never widened when korean-level-one's 16
-- chapter tests (and chapter_tests generally) shipped, so submit_course_test()
-- computes a valid score and then fails on insert for every non-hangul test,
-- e.g. korean-level-one-01..16. Replace the static allow-list with a trigger
-- that validates test_slug against the live chapter_tests catalog, so newly
-- published chapters never need a matching migration here again.
alter table public.chapter_test_attempts
  drop constraint if exists course_test_attempts_test_slug_check;

create or replace function private.chapter_test_attempts_validate_slug()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.test_id is not null then
    if not exists (
      select 1 from public.chapter_tests
      where id = new.test_id and slug = new.test_slug
    ) then
      raise exception '章节测试标识不匹配（test_id 与 test_slug 不一致）';
    end if;
  elsif not exists (
    select 1 from public.chapter_tests where slug = new.test_slug
  ) then
    raise exception '没有找到对应的章节测试：%', new.test_slug;
  end if;
  return new;
end;
$function$;

drop trigger if exists chapter_test_attempts_validate_slug
  on public.chapter_test_attempts;

create trigger chapter_test_attempts_validate_slug
before insert or update on public.chapter_test_attempts
for each row
execute function private.chapter_test_attempts_validate_slug();

comment on function private.chapter_test_attempts_validate_slug() is
  '取代旧的4项静态CHECK白名单：按 chapter_tests 表动态校验 test_slug，新增章节测试无需再改约束。';

commit;
