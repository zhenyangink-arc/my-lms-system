-- Keep the Korean course-cover catalog reproducible across Supabase environments.

update public.course_categories
set
  cover_object_key = 'course-covers/category/1a933f0d-0f75-4e65-bdba-6a0097bcfc2c/v2-category-cover-v2.webp',
  cover_alt = '基础韩语课程封面',
  cover_focal_point = 'center'
where id = '1a933f0d-0f75-4e65-bdba-6a0097bcfc2c';

update public.courses
set
  cover_object_key = case id
    when '2f79a679-6e25-4cf9-9f71-455905584787' then 'course-covers/course/2f79a679-6e25-4cf9-9f71-455905584787/v2-korean-beginner-cover-v2.webp'
    when 'fd05a8ad-ea0c-4c3f-846d-71bcf69135b8' then 'course-covers/course/fd05a8ad-ea0c-4c3f-846d-71bcf69135b8/v2-korean-intermediate-cover-v2.webp'
    when '8a8608c6-840b-426a-a1e5-d2e49dc665c4' then 'course-covers/course/8a8608c6-840b-426a-a1e5-d2e49dc665c4/v2-korean-advanced-cover-v2.webp'
  end,
  cover_alt = case id
    when '2f79a679-6e25-4cf9-9f71-455905584787' then '韩语初级课程封面'
    when 'fd05a8ad-ea0c-4c3f-846d-71bcf69135b8' then '韩语中级课程封面'
    when '8a8608c6-840b-426a-a1e5-d2e49dc665c4' then '韩语高级课程封面'
  end,
  cover_focal_point = 'center'
where id in (
  '2f79a679-6e25-4cf9-9f71-455905584787',
  'fd05a8ad-ea0c-4c3f-846d-71bcf69135b8',
  '8a8608c6-840b-426a-a1e5-d2e49dc665c4'
);

update public.lessons
set
  cover_object_key = case id
    when '6ad20a2b-2306-4173-9d3f-73eb9691ff58' then 'course-covers/lesson/6ad20a2b-2306-4173-9d3f-73eb9691ff58/v1-hangul-introduction-cover-v1.webp'
    when '26fd3e57-e6cf-4df9-8514-646786f61e1d' then 'course-covers/lesson/26fd3e57-e6cf-4df9-8514-646786f61e1d/v1-korean-level-one-cover-v1.webp'
    when 'e1e77ed7-832e-48af-9ac3-07d2af546c15' then 'course-covers/lesson/e1e77ed7-832e-48af-9ac3-07d2af546c15/v1-korean-level-two-cover-v1.webp'
  end,
  cover_alt = case id
    when '6ad20a2b-2306-4173-9d3f-73eb9691ff58' then '第 1 课：韩文字母入门课程封面'
    when '26fd3e57-e6cf-4df9-8514-646786f61e1d' then '第 2 课：韩国语1级课程封面'
    when 'e1e77ed7-832e-48af-9ac3-07d2af546c15' then '第 3 课：韩国语2级课程封面'
  end,
  cover_focal_point = 'center'
where id in (
  '6ad20a2b-2306-4173-9d3f-73eb9691ff58',
  '26fd3e57-e6cf-4df9-8514-646786f61e1d',
  'e1e77ed7-832e-48af-9ac3-07d2af546c15'
);
