import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildTeacherClassTodayFixtureSnapshot,
  parseTeacherClassTodaySnapshot,
} from "../src/features/teacher-class-today/model.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("fixture aggregates today's class counts with student-home status semantics", () => {
  const now = new Date("2026-08-19T03:00:00.000Z");
  const snapshot = buildTeacherClassTodayFixtureSnapshot({
    now,
    authorizedStudentIds: ["student-a", "student-b", "student-c"],
    students: [
      {
        studentId: "student-a",
        fullName: "安同学",
        trackingStartedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        studentId: "student-b",
        fullName: "白同学",
        trackingStartedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        studentId: "student-c",
        fullName: "陈同学",
        trackingStartedAt: "2026-08-17T00:00:00.000Z",
      },
      {
        studentId: "student-out-of-scope",
        fullName: "越权学生",
        trackingStartedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    tasks: [
      {
        studentId: "student-a",
        assignmentId: "a-completed",
        status: "completed",
        isRequiredToday: true,
      },
      {
        studentId: "student-a",
        assignmentId: "a-pending",
        status: "pending_grading",
        isRequiredToday: true,
      },
      {
        studentId: "student-b",
        assignmentId: "b-not-started",
        status: "not_started",
        isRequiredToday: true,
      },
      {
        studentId: "student-b",
        assignmentId: "b-overdue",
        status: "overdue",
        isRequiredToday: true,
      },
      {
        studentId: "student-c",
        assignmentId: "c-in-progress",
        status: "in_progress",
        isRequiredToday: true,
      },
      {
        studentId: "student-out-of-scope",
        assignmentId: "hidden-overdue",
        status: "overdue",
        isRequiredToday: true,
      },
    ],
    activities: [
      {
        studentId: "student-a",
        occurredAt: "2026-08-19T01:00:00.000Z",
      },
      {
        studentId: "student-b",
        occurredAt: "2026-08-15T04:00:00.000Z",
      },
      {
        studentId: "student-out-of-scope",
        occurredAt: "2026-08-19T02:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(snapshot.summary, {
    studentCount: 3,
    studiedTodayCount: 1,
    requiredTaskTotal: 5,
    requiredTaskCompleted: 1,
    requiredCompletionRate: 20,
    notStartedCount: 1,
    inProgressCount: 1,
    completedCount: 1,
    overdueCount: 1,
    pendingGradingCount: 1,
    continuousNoLearningCount: 1,
  });
  assert.equal(snapshot.students[1].studentId, "student-b");
  assert.equal(snapshot.students[1].inactiveDays, 4);
  assert.equal(snapshot.students[1].continuousNoLearning, true);
});

test("fixture authorization scope excludes every out-of-scope student fact", () => {
  const snapshot = buildTeacherClassTodayFixtureSnapshot({
    now: new Date("2026-08-19T03:00:00.000Z"),
    authorizedStudentIds: ["assigned"],
    students: [
      {
        studentId: "assigned",
        trackingStartedAt: "2026-08-19T00:00:00.000Z",
      },
      {
        studentId: "not-assigned",
        fullName: "不应返回",
        trackingStartedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    tasks: [
      {
        studentId: "not-assigned",
        assignmentId: "hidden-task",
        status: "overdue",
        isRequiredToday: true,
      },
    ],
    activities: [
      {
        studentId: "not-assigned",
        occurredAt: "2026-08-19T01:00:00.000Z",
      },
    ],
  });

  assert.equal(snapshot.summary.studentCount, 1);
  assert.equal(snapshot.summary.studiedTodayCount, 0);
  assert.equal(snapshot.summary.overdueCount, 0);
  assert.deepEqual(snapshot.students.map((student) => student.studentId), [
    "assigned",
  ]);
});

test("RPC payload parser keeps the DTO minimal and typed", () => {
  const snapshot = parseTeacherClassTodaySnapshot({
    generated_at: "2026-08-19T03:00:00.000Z",
    summary: {
      student_count: 1,
      required_completion_rate: "50.0",
    },
    students: [
      {
        student_id: "student-a",
        full_name: "安同学",
        studied_today: true,
        inactive_days: 0,
      },
    ],
    tasks: [
      {
        assignment_id: "assignment-a",
        title: "今日作业",
        assignment_type: "homework",
        status: "pending_grading",
        starts_at: "2026-08-19T00:00:00.000Z",
        due_at: "2026-08-19T12:00:00.000Z",
        is_required_today: true,
      },
    ],
  });

  assert.equal(snapshot.summary.requiredCompletionRate, 50);
  assert.equal(snapshot.students[0].studiedToday, true);
  assert.equal(snapshot.tasks[0].status, "pending_grading");
});

test("database query enforces teacher scope and performs one SQL aggregation", async () => {
  const [migration, service, dashboard] = await Promise.all([
    source("supabase/migrations/202608190021_teacher_class_today_snapshot.sql"),
    source("src/features/teacher-class-today/api/service.ts"),
    source(
      "src/features/teacher-class-today/components/teacher-class-today-dashboard.tsx",
    ),
  ]);

  assert.match(migration, /v_teacher_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(migration, /assignment\.teacher_id = v_teacher_id/i);
  assert.match(migration, /assignment\.student_app_id = p_student_app_id/i);
  assert.match(migration, /private\.current_teacher_has_student_app_access\(/i);
  assert.match(migration, /raise exception using[\s\S]*errcode = '42501'/i);
  assert.match(migration, /count\([^)]*\) filter/i);
  assert.match(migration, /group by/i);
  assert.match(migration, /with authorized_students as materialized/i);
  assert.match(
    migration,
    /activity\.event_type not in \([\s\S]*'assignment_graded'[\s\S]*'assignment_revision_required'/i,
  );
  assert.doesNotMatch(migration, /p_teacher_id/i);

  assert.equal(
    (service.match(/\.rpc\(/g) ?? []).length,
    1,
    "service must issue exactly one RPC",
  );
  assert.doesNotMatch(service, /loadHomeLearningTasks/);
  assert.match(dashboard, /prefetch=\{false\}/);
});
