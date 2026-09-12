import test from "node:test";
import assert from "node:assert/strict";
import { resolveCurriculumExecution } from "../src/features/curriculum-plans/execution.ts";
import { parsePolicyRequirements, POLICY_FIELDS, POLICY_CHECKS } from "../src/features/course-completion/policy-form.ts";

const schedule = { startsAt: new Date("2026-01-01T00:00Z"), endsAt: new Date("2026-01-01T01:00Z") };
const after = new Date("2026-01-02T00:00Z");
const fact = { completed: false, started: false, pending_grading: false, available: true, tracked: true, progress_percent: 0, starts_at: null, due_at: null };
test("real completion wins over overdue, including unpublished historical material", () => {
  assert.equal(resolveCurriculumExecution({...fact,completed:true,available:false},schedule,true,after).status,"completed");
});
test("submitted work waits for grading instead of becoming overdue", () => {
  assert.equal(resolveCurriculumExecution({...fact,pending_grading:true},schedule,true,after).status,"pending_grading");
});
test("missing sources and read failures never look like zero-progress overdue work", () => {
  assert.equal(resolveCurriculumExecution(undefined,schedule,true,after).status,"unavailable");
  assert.equal(resolveCurriculumExecution({...fact,tracked:false},schedule,true,after).progressPercent,null);
  assert.equal(resolveCurriculumExecution({...fact,available:false},schedule,true,after).status,"unavailable");
});
test("not started, started and optional late tasks remain distinct", () => {
  const during = new Date("2026-01-01T00:30Z");
  assert.equal(resolveCurriculumExecution(fact,schedule,true,during).status,"available");
  assert.equal(resolveCurriculumExecution({...fact,started:true},schedule,true,during).status,"in_progress");
  assert.equal(resolveCurriculumExecution(fact,schedule,true,after).status,"overdue");
  assert.equal(resolveCurriculumExecution(fact,schedule,false,after).status,"available");
});
test("actual assignment dates override the original plan calendar", () => {
  assert.equal(resolveCurriculumExecution({...fact,starts_at:"2026-01-03T00:00Z",due_at:"2026-01-04T00:00Z"},schedule,true,after).status,"not_started");
});
test("policy form validates ranges, missing values and passed/completed consistency", () => {
  const form = new FormData();
  for (const f of POLICY_FIELDS) form.set(`${f.section}.${f.key}`,String(f.initial));
  for (const f of POLICY_CHECKS) form.set(`${f.section}.${f.key}`,"on");
  assert.equal(parsePolicyRequirements(form).textbook.required_chapter_count,16);
  form.delete("final_exam.require_published_grade");
  assert.equal(parsePolicyRequirements(form).final_exam.require_published_grade,true,"engine-enforced conditions cannot be disabled in the form");
  form.set("formal_chapter_exams.minimum_passed_count","17");
  assert.throws(() => parsePolicyRequirements(form),/通过数/);
  form.set("formal_chapter_exams.minimum_passed_count","16");
  form.set("overall_score.minimum_score","101");
  assert.throws(() => parsePolicyRequirements(form),/综合成绩/);
  form.delete("overall_score.minimum_score");
  assert.throws(() => parsePolicyRequirements(form),/综合成绩/);
});
