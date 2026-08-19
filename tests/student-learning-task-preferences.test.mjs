import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { filterSnoozedHomeLearningTasks } from "../src/features/student-home-learning/api/task-preferences.ts";

const now = new Date("2026-08-19T03:00:00.000Z");

function task(taskKey, required = false) {
  return {
    taskKey,
    studentAppId: "10000000-0000-4000-8000-000000000001",
    appSlug: "korean",
    appLabel: "韩语",
    sourceType: required ? "assignment" : "course",
    sourceId: taskKey.split(":").at(-1),
    title: taskKey,
    description: null,
    status: "available",
    priority: required ? "high" : "normal",
    required,
    startsAt: null,
    dueAt: null,
    progressPercent: null,
    reason: "fixture",
    href: "/fixture",
    courseId: null,
    courseChapterId: null,
    skill: null,
    updatedAt: now.toISOString(),
  };
}

test("未到期暂缓隐藏普通建议，到期后自动恢复", () => {
  const key = "10000000-0000-4000-8000-000000000001:course:course-1";
  const preference = {
    taskKey: key,
    snoozedUntil: "2026-08-19T04:00:00.000Z",
    dismissedForWeek: null,
  };

  assert.deepEqual(filterSnoozedHomeLearningTasks([task(key)], [preference], now), []);
  assert.deepEqual(
    filterSnoozedHomeLearningTasks(
      [task(key)],
      [preference],
      new Date("2026-08-19T04:00:00.000Z"),
    ).map((entry) => entry.taskKey),
    [key],
  );
});

test("本周不再提示跨越韩国时间周界后自动恢复", () => {
  const key = "10000000-0000-4000-8000-000000000001:review:chapter:fixture";
  const preference = {
    taskKey: key,
    snoozedUntil: null,
    dismissedForWeek: "2026-08-17",
  };

  assert.equal(filterSnoozedHomeLearningTasks([task(key)], [preference], now).length, 0);
  assert.equal(
    filterSnoozedHomeLearningTasks(
      [task(key)],
      [preference],
      new Date("2026-08-23T15:00:00.000Z"),
    ).length,
    1,
  );
});

test("必做任务即使存在活跃偏好也永远显示", () => {
  const key = "10000000-0000-4000-8000-000000000001:assignment:required-1";
  const requiredTask = task(key, true);
  const result = filterSnoozedHomeLearningTasks(
    [requiredTask],
    [{ taskKey: key, snoozedUntil: "2026-08-20T03:00:00.000Z", dismissedForWeek: null }],
    now,
  );
  assert.deepEqual(result, [requiredTask]);
});

test("迁移包含本人 RLS、恢复删除授权和数据库必做拦截", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202608190020_student_learning_task_preferences.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /current_student_has_app_access\(/i);
  assert.match(sql, /for delete to authenticated/i);
  assert.match(sql, /validate_student_learning_task_preference/i);
  assert.match(sql, /必做任务不可暂缓/);
  assert.match(sql, /primary key \(tenant_id, student_id, student_app_id, task_key\)/i);
});
