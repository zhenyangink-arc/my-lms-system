begin;

-- 成绩页六维能力画像的数据库事实视图。
-- 只统计每项作业/考试最近一次已批改提交，章节测试与随堂测验不进入成绩中心。
-- 使用 security_invoker，让底层表的 RLS 继续约束学生只能看到自己的记录。
create or replace view public.student_grade_skill_profiles
with (security_invoker = true, security_barrier = true)
as
with latest_graded_submission as (
  select distinct on (
    submission.tenant_id,
    submission.student_id,
    submission.assignment_id
  )
    submission.tenant_id,
    submission.student_id,
    submission.id as submission_id,
    submission.assignment_id,
    submission.graded_at,
    assignment.course_id,
    assignment.source_paper_id,
    case
      when assignment.assignment_type = 'exam' then 'exam'
      else 'homework'
    end as grade_category
  from public.learning_submissions as submission
  join public.learning_assignments as assignment
    on assignment.tenant_id = submission.tenant_id
   and assignment.id = submission.assignment_id
  where submission.status = 'graded'
    and submission.score is not null
    and assignment.assignment_type in ('homework', 'exam')
  order by
    submission.tenant_id,
    submission.student_id,
    submission.assignment_id,
    submission.attempt_number desc,
    coalesce(submission.graded_at, submission.submitted_at) desc,
    submission.id desc
), scored_answer as (
  select
    latest.tenant_id,
    latest.student_id,
    latest.course_id,
    latest.submission_id,
    latest.grade_category,
    latest.graded_at,
    answer.awarded_points,
    assignment_question.points,
    case
      when lower(trim(paper_question.skill)) ~ '(listening|listen|听力|听写|듣기)'
        then 'listening'
      when lower(trim(paper_question.skill)) ~ '(speaking|speak|口语|发音|朗读|录音|말하기)'
        then 'speaking'
      when lower(trim(paper_question.skill)) ~ '(reading|read|阅读|理解|읽기)'
        then 'reading'
      when lower(trim(paper_question.skill)) ~ '(writing|write|写作|作文|书写|쓰기)'
        then 'writing'
      when lower(trim(paper_question.skill)) ~ '(vocabulary|vocab|word|词汇|单词|字词|어휘)'
        then 'vocabulary'
      when lower(trim(paper_question.skill)) ~ '(grammar|language use|语法|句法|语言运用|문법)'
        then 'grammar'
      when assignment_question.question_type = 'long_text' then 'writing'
      when assignment_question.question_type = 'file_link' then 'speaking'
      else null
    end as skill
  from latest_graded_submission as latest
  join public.learning_submission_answers as answer
    on answer.tenant_id = latest.tenant_id
   and answer.submission_id = latest.submission_id
  join public.learning_assignment_questions as assignment_question
    on assignment_question.tenant_id = answer.tenant_id
   and assignment_question.id = answer.question_id
  left join public.assessment_paper_questions as paper_question
    on paper_question.paper_id = latest.source_paper_id
   and paper_question.sort_order = assignment_question.sort_order
  where answer.awarded_points is not null
)
select
  tenant_id,
  student_id,
  grade_category,
  skill,
  round(sum(greatest(awarded_points, 0)), 2)::numeric(12, 2) as earned_points,
  round(sum(greatest(points, 0)), 2)::numeric(12, 2) as total_points,
  case
    when sum(greatest(points, 0)) > 0 then
      round(
        least(
          100,
          greatest(
            0,
            sum(greatest(awarded_points, 0))
              / sum(greatest(points, 0)) * 100
          )
        ),
        1
      )
    else null
  end::numeric(5, 1) as percentage,
  count(*)::bigint as question_count,
  count(distinct submission_id)::bigint as assessment_count,
  max(graded_at) as last_graded_at
from scored_answer
where skill is not null
group by tenant_id, student_id, grade_category, skill;

revoke all on public.student_grade_skill_profiles from public, anon, authenticated;
grant select on public.student_grade_skill_profiles to service_role;

comment on view public.student_grade_skill_profiles is
  '学生成绩六维能力事实视图：按老师作业/正式考试分流，实时汇总最近一次已批改提交的听说读写语法词汇逐题得分。';

commit;
