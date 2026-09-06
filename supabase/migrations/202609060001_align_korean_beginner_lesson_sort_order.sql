-- Keep the preparatory lesson outside the numbered lesson sequence so that
-- sort_order and the learner-facing lesson numbers remain aligned.

begin;

select set_config('app.platform_content_migration', 'on', true);
alter table public.lessons disable trigger user;

update public.lessons
set sort_order = case slug
  when 'hangul-introduction' then 0
  when 'basic-pronunciation' then 1
  when 'daily-greetings' then 2
end
where slug in (
    'hangul-introduction',
    'basic-pronunciation',
    'daily-greetings'
  )
  and course_id = (
    select id
    from public.courses
    where slug = 'korean-beginner'
      and content_scope = 'platform'
      and tenant_id is null
  );

alter table public.lessons enable trigger user;

commit;
