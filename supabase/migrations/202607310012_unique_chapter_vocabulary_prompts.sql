-- 同一章节的三道中等词汇题需要独立题干，避免审计和抽题时被视为重复。
update public.chapter_test_questions as question
set
  prompt = format(
    '[중급] 제%s과의 핵심 어휘 %s로 알맞은 것을 고르세요.',
    test.chapter_number,
    substring(question.question_key from 2)::integer - 14
  ),
  version = question.version + 1,
  updated_at = now()
from public.chapter_tests as test
where test.id = question.test_id
  and test.course_key = 'korean-level-one'
  and question.question_key in ('m15', 'm16', 'm17');
