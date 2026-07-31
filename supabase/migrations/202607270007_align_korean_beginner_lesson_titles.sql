begin;

-- 目标记录是 tenant_id 为空的共享平台课程；显式声明平台内容迁移上下文。
select set_config('app.platform_content_migration', 'on', true);

alter table public.lessons disable trigger user;

update public.lessons as lesson
set title = case lesson.slug
      when 'basic-pronunciation' then '第 2 课：韩国语1级'
      when 'daily-greetings' then '第 3 课：韩国语2级'
      else lesson.title
    end,
    updated_at = now()
from public.courses as course
join public.course_categories as subcategory
  on subcategory.id = course.category_id
join public.course_categories as category
  on category.id = subcategory.parent_id
where lesson.course_id = course.id
  and course.slug = 'korean-beginner'
  and subcategory.slug = 'korean-basic'
  and category.slug = 'korean'
  and lesson.slug in ('basic-pronunciation', 'daily-greetings');

alter table public.lessons enable trigger user;

commit;
