begin;

-- saveUniversityAssessmentAction always did a plain insert, so re-running the
-- match assessment for the same university (criteria tweaks, retries) just
-- kept appending rows forever with no way to tell which one is current.
-- No rows exist yet for this feature, so adding the constraint is safe.
alter table public.student_university_assessments
  add constraint student_university_assessments_tenant_user_university_key
  unique (tenant_id, user_id, university_id);

comment on constraint student_university_assessments_tenant_user_university_key
  on public.student_university_assessments is
  '每个学生对每所大学只保留最近一次评估结果，重复评估用 upsert 覆盖而不是无限追加。';

commit;
