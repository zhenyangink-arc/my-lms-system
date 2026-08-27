-- Correct the independent display number above each Korean beginner lesson title.
update public.lessons
set
  cover_object_key = case id
    when '6ad20a2b-2306-4173-9d3f-73eb9691ff58' then 'course-covers/lesson/6ad20a2b-2306-4173-9d3f-73eb9691ff58/v3-hangul-introduction-cover-v3.webp'
    when '26fd3e57-e6cf-4df9-8514-646786f61e1d' then 'course-covers/lesson/26fd3e57-e6cf-4df9-8514-646786f61e1d/v3-korean-level-one-cover-v3.webp'
    when 'e1e77ed7-832e-48af-9ac3-07d2af546c15' then 'course-covers/lesson/e1e77ed7-832e-48af-9ac3-07d2af546c15/v2-korean-level-two-cover-v2.webp'
  end,
  cover_alt = case id
    when '6ad20a2b-2306-4173-9d3f-73eb9691ff58' then '编号 00 的韩文字母入门课程封面'
    when '26fd3e57-e6cf-4df9-8514-646786f61e1d' then '编号 01 的韩国语1级课程封面'
    when 'e1e77ed7-832e-48af-9ac3-07d2af546c15' then '编号 02 的韩国语2级课程封面'
  end,
  cover_focal_point = 'center'
where id in (
  '6ad20a2b-2306-4173-9d3f-73eb9691ff58',
  '26fd3e57-e6cf-4df9-8514-646786f61e1d',
  'e1e77ed7-832e-48af-9ac3-07d2af546c15'
);
