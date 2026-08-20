import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mapRetakeExamTask } from "../src/features/student-home-learning/api/assignment-exam-mapper.ts";

const migrationPath = "supabase/migrations/202608200007_completion_retake_connections.sql";

test("资格缺口只为真实可执行页面保留深链", async () => {
  const [migration, studentView] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("src/features/course-completion/StudentCompletionPage.tsx", "utf8"),
  ]);

  assert.match(migration, /pending_grading'[\s\S]*gap - 'href'/);
  assert.match(migration, /'stage_exam', 'midterm_exam', 'final_exam'[\s\S]*status' = 'failed'/);
  assert.doesNotMatch(
    migration.match(/create or replace function private\.normalize_completion_gaps[\s\S]*?\$\$;/)?.[0] ?? "",
    /'chapter_exam'/,
  );
  assert.match(migration, /老师将根据本次成绩布置补考/);
  assert.match(migration, /\^\/dashboard/);
  assert.match(studentView, /Boolean\(gap\.href\)/);
  assert.match(studentView, /已提交，无需重复提交/);
  assert.match(studentView, /老师将根据本次成绩布置补考/);
});

test("资格明细补考操作复用 learning_assignments 补考能力并重新鉴权", async () => {
  const [migration, action, view] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("src/features/course-completion/review-actions.ts", "utf8"),
    readFile("src/features/course-completion/CompletionReviewWorkspace.tsx", "utf8"),
  ]);

  assert.match(migration, /configure_learning_assignment_retake/);
  assert.match(migration, /current_staff_has_app_capability[\s\S]*manage_assessments/);
  assert.match(migration, /update public\.learning_assignments[\s\S]*retake_paper_id/);
  assert.match(migration, /insert into public\.learning_assignment_retake_students/);
  assert.match(migration, /gap ->> 'sourceId' = p_assignment_id::text/);
  assert.match(action, /configureCompletionRetakeAction/);
  assert.match(action, /requireCompletionRetakeManager/);
  assert.match(migration, /current_teacher_has_student_app_access/);
  assert.doesNotMatch(migration, /v_paper\.id is distinct from v_assignment\.source_paper_id/);
  assert.match(migration, /delivery_paper_id/);
  assert.match(migration, /source_paper_question_id/);
  assert.match(migration, /current_user_assignment_delivery_paper_id/);
  assert.match(migration, /from public\.assessment_paper_questions/);
  assert.match(migration, /from public\.assessment_paper_question_keys/);
  assert.match(migration, /v_paper\.total_points is distinct from v_assignment\.total_points/);
  assert.match(view, /paperIdByAssignmentId/);
  for (const field of [
    "assignment_id",
    "retake_paper_id",
    "retake_starts_at",
    "retake_due_at",
    "retake_score_policy",
  ]) assert.match(view, new RegExp(`name="${field}"`));
});

test("真实补考名单映射为独立任务，等待批改不产生第二个可提交状态", () => {
  const assignment = {
    id: "exam-1",
    title: "期末考试",
    description: "正式考试",
    assignment_type: "exam",
    course_id: "course-1",
    starts_at: "2026-08-01T00:00:00.000Z",
    due_at: "2026-08-02T00:00:00.000Z",
    allow_late_submission: false,
    unlock_after_chapter_completion: false,
    unlock_test_slug: null,
    due_days_after_unlock: null,
    retake_paper_id: "paper-2",
    retake_starts_at: "2026-08-20T00:00:00.000Z",
    retake_due_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-19T00:00:00.000Z",
  };
  const available = mapRetakeExamTask({
    assignment,
    studentAppId: "app-1",
    appSlug: "korean",
    appLabel: "韩语",
    space: "school",
    now: new Date("2026-08-20T01:00:00.000Z"),
  });
  assert.equal(available?.status, "available");
  assert.equal(available?.title, "期末考试补考");
  assert.equal(available?.href, "/school/apps/korean/assignments/exam-1");

  const pending = mapRetakeExamTask({
    assignment,
    submission: {
      assignment_id: "exam-1",
      submission_state: "objective_graded_pending_manual",
      submitted_at: "2026-08-20T02:00:00.000Z",
    },
    studentAppId: "app-1",
    appSlug: "korean",
    appLabel: "韩语",
    space: "school",
    now: new Date("2026-08-20T03:00:00.000Z"),
  });
  assert.equal(pending?.status, "pending_grading");
  assert.equal(pending?.priority, "low");
});

test("补考成绩发布仍由 Packet8 事件触发资格重算", async () => {
  const refresh = await readFile(
    "supabase/migrations/202608200005_completion_refresh_orchestration.sql",
    "utf8",
  );
  assert.match(refresh, /补考最终成绩发布/);
  assert.match(refresh, /evaluate_student_course_completion/);
});

test("今日学习只聚合真实发布投递，并用补考有效窗口开放详情", async () => {
  const [source, detail, actions, workspace, migration] = await Promise.all([
    readFile("src/features/student-home-learning/api/assignment-exam-source.ts", "utf8"),
    readFile("src/app/dashboard/assignments/[assignmentId]/page-content.tsx", "utf8"),
    readFile("src/app/dashboard/assignments/actions.ts", "utf8"),
    readFile("src/app/dashboard/DailyLearningWorkspace.tsx", "utf8"),
    readFile(migrationPath, "utf8"),
  ]);
  assert.match(source, /\.eq\("status", "published"\)/);
  assert.match(source, /learning_assignment_targets!inner/);
  assert.match(source, /learning_assignment_retake_students/);
  assert.match(detail, /effectiveStartsAt/);
  assert.match(detail, /current_user_assignment_delivery_paper_id/);
  assert.match(detail, /question\.delivery_paper_id === effectivePaperId/);
  assert.match(actions, /current_user_assignment_delivery_paper_id/);
  assert.match(actions, /questionQuery\.eq\("delivery_paper_id", deliveryPaperId\)/);
  assert.match(detail, /当前为老师布置的补考/);
  assert.match(workspace, /task\.status === "pending_grading"[\s\S]*无需重复提交/);
  assert.match(migration, /assignment\.retake_starts_at <= now\(\)/);
  assert.match(migration, /not exists \([\s\S]*assigned_retake/);
});
