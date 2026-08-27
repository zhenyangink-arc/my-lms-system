-- Publish numbered Korean beginner lesson covers.
update public.lessons
set
  cover_object_key = case id
    when '6ad20a2b-2306-4173-9d3f-73eb9691ff58' then 'course-covers/lesson/6ad20a2b-2306-4173-9d3f-73eb9691ff58/v2-hangul-introduction-cover-v2.webp'
    when '26fd3e57-e6cf-4df9-8514-646786f61e1d' then 'course-covers/lesson/26fd3e57-e6cf-4df9-8514-646786f61e1d/v2-korean-level-one-cover-v2.webp'
  end,
  cover_alt = case id
    when '6ad20a2b-2306-4173-9d3f-73eb9691ff58' then '00 韩文字母入门课程封面'
    when '26fd3e57-e6cf-4df9-8514-646786f61e1d' then '01 韩国语1级课程封面'
  end,
  cover_focal_point = 'center'
where id in (
  '6ad20a2b-2306-4173-9d3f-73eb9691ff58',
  '26fd3e57-e6cf-4df9-8514-646786f61e1d'
);
