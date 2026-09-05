-- ============================================================
-- "韩语初级"课程下，字母入门课占了"第 1 课"，导致"韩国语1级"变成
-- "第 2 课"、"韩国语2级"变成"第 3 课"——课时序号和级别数字对不上，
-- 容易让人误以为标错了。这里把字母入门改成不占"第X课"编号的预备
-- 课，"韩国语1级""韩国语2级"分别改回"第 1 课""第 2 课"，与级别
-- 数字保持一致。只改标题文字，不改 sort_order、slug 或先修关系，
-- 排课顺序和解锁链路不受影响。
-- ============================================================

begin;

select set_config('app.platform_content_migration', 'on', true);
alter table public.lessons disable trigger user;
alter table public.course_chapters disable trigger user;

update public.lessons
set title = '预备课：韩文字母入门'
where slug = 'hangul-introduction'
  and course_id = (
    select id from public.courses
    where slug = 'korean-beginner' and content_scope = 'platform' and tenant_id is null
  );

update public.lessons
set title = '第 1 课：韩国语1级'
where slug = 'basic-pronunciation'
  and course_id = (
    select id from public.courses
    where slug = 'korean-beginner' and content_scope = 'platform' and tenant_id is null
  );

update public.lessons
set title = '第 2 课：韩国语2级'
where slug = 'daily-greetings'
  and course_id = (
    select id from public.courses
    where slug = 'korean-beginner' and content_scope = 'platform' and tenant_id is null
  );

update public.course_chapters
set title = '第 2 课：韩国语2级'
where slug = 'daily-greetings'
  and lesson_id = (
    select id from public.lessons
    where slug = 'daily-greetings'
      and course_id = (
        select id from public.courses
        where slug = 'korean-beginner' and content_scope = 'platform' and tenant_id is null
      )
  );

alter table public.lessons enable trigger user;
alter table public.course_chapters enable trigger user;

commit;
