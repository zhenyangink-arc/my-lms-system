import assert from "node:assert/strict";
import test from "node:test";

import { mapAssignmentExamTask } from "../src/features/student-home-learning/api/assignment-exam-mapper.ts";
import { selectRequiredTodayTasks } from "../src/features/student-home-learning/api/required-today.ts";

const now = new Date("2026-08-19T03:00:00.000Z");

function task(overrides = {}) {
  const assignment = {
    id: "assignment-1",
    title: "第 1 课作业",
    description: "完成本课练习",
    assignment_type: "homework",
    course_id: "course-1",
    starts_at: "2026-08-19T02:00:00.000Z",
    due_at: "2026-08-20T03:00:00.000Z",
    allow_late_submission: false,
    unlock_after_chapter_completion: false,
    unlock_test_slug: null,
    due_days_after_unlock: null,
    updated_at: "2026-08-19T01:00:00.000Z",
    ...overrides.assignment,
  };

  return mapAssignmentExamTask({
    assignment,
    progress: overrides.progress,
    studentAppId: "app-1",
    appSlug: "korean",
    appLabel: "韩语",
    space: "school",
    now: overrides.now ?? now,
  });
}

const scenarios = [
  {
    name: "未到开始时间映射为 locked",
    input: { assignment: { starts_at: "2026-08-19T04:00:00.000Z" } },
    status: "locked",
  },
  { name: "已开放无草稿映射为 available", input: {}, status: "available" },
  {
    name: "有草稿映射为 in_progress",
    input: {
      progress: {
        assignment_id: "assignment-1",
        progress_state: "in_progress",
        updated_at: "2026-08-19T02:30:00.000Z",
      },
    },
    status: "in_progress",
  },
  {
    name: "已提交待人工批改映射为 pending_grading",
    input: {
      progress: {
        assignment_id: "assignment-1",
        progress_state: "objective_graded_pending_manual",
        updated_at: "2026-08-19T02:30:00.000Z",
      },
    },
    status: "pending_grading",
  },
  {
    name: "批改流程结束映射为 completed",
    input: {
      progress: {
        assignment_id: "assignment-1",
        progress_state: "grading_completed",
        updated_at: "2026-08-19T02:30:00.000Z",
      },
    },
    status: "completed",
  },
  {
    name: "已逾期且禁止迟交映射为 overdue",
    input: { assignment: { due_at: "2026-08-19T02:59:59.000Z" } },
    status: "overdue",
    reason: "已逾期，不可提交",
  },
  {
    name: "已逾期且允许迟交仍为 overdue 并说明可提交",
    input: {
      assignment: {
        due_at: "2026-08-19T02:59:59.000Z",
        allow_late_submission: true,
      },
    },
    status: "overdue",
    reason: "已逾期，仍可提交",
  },
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const result = task(scenario.input);
    assert.equal(result.status, scenario.status);
    if (scenario.reason) assert.equal(result.reason, scenario.reason);
  });
}

test("正式考试使用 Packet 1 深链并且不返回成绩字段", () => {
  const result = task({
    assignment: { id: "exam-1", assignment_type: "exam" },
  });

  assert.equal(result.sourceType, "exam");
  assert.equal(result.href, "/school/apps/korean/assignments/exam-1");
  assert.equal("score" in result, false);
  assert.equal("feedback" in result, false);
});

test("开始与截止瞬间使用包含边界，截止后一毫秒才进入逾期", () => {
  const startsNow = task({
    assignment: {
      starts_at: now.toISOString(),
      due_at: "2026-08-19T04:00:00.000Z",
    },
  });
  assert.equal(startsNow.status, "available");

  const dueNow = task({
    assignment: { due_at: now.toISOString() },
  });
  assert.equal(dueNow.status, "available");

  const afterDue = task({
    assignment: { due_at: now.toISOString() },
    now: new Date(now.getTime() + 1),
  });
  assert.equal(afterDue.status, "overdue");
});

test("首尔时间今天 23:59 与明天 23:59 分别进入今日必做和明日优先级", () => {
  const dueTodayAt2359 = task({
    assignment: { due_at: "2026-08-19T14:59:00.000Z" },
  });
  assert.equal(dueTodayAt2359.priority, "high");
  assert.deepEqual(selectRequiredTodayTasks([dueTodayAt2359], now), [dueTodayAt2359]);

  const dueTomorrowAt2359 = task({
    assignment: {
      starts_at: "2026-08-18T02:00:00.000Z",
      due_at: "2026-08-20T14:59:00.000Z",
    },
  });
  assert.equal(dueTomorrowAt2359.priority, "normal");
  assert.deepEqual(selectRequiredTodayTasks([dueTomorrowAt2359], now), []);
});

test("补考在开始、截止和截止后边界保持可进入状态一致", () => {
  const retake = {
    id: "retake-exam-1",
    title: "第 1 课补考",
    assignment_type: "exam",
    starts_at: "2026-08-19T03:00:00.000Z",
    due_at: "2026-08-19T04:00:00.000Z",
  };
  assert.equal(task({ assignment: retake, now }).status, "available");
  assert.equal(
    task({ assignment: retake, now: new Date("2026-08-19T04:00:00.000Z") }).status,
    "available",
  );
  assert.equal(
    task({ assignment: retake, now: new Date("2026-08-19T04:00:00.001Z") }).status,
    "overdue",
  );
});
