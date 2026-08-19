import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getTeacherRecommendationPath } from "../src/features/student-home-learning/routes.ts";

test("老师推荐深链复用现有真实业务路由", () => {
  assert.equal(
    getTeacherRecommendationPath("demo", {
      sourceType: "course",
      categorySlug: "language",
      subcategorySlug: "beginner",
      courseSlug: "korean-one",
      lessonSlug: "lesson-one",
    }),
    "/demo/apps/korean/courses/language/beginner/korean-one/lesson-one",
  );
  assert.equal(
    getTeacherRecommendationPath("demo", {
      sourceType: "chapter_practice",
      courseKey: "korean-one",
      chapterSlug: "chapter-one",
    }),
    "/demo/apps/korean/practice/course/korean-one/chapter-one",
  );
  assert.equal(
    getTeacherRecommendationPath("demo", {
      sourceType: "specialized_practice",
      skill: "listening",
      courseSlug: "korean-one",
      lessonSlug: "lesson-one",
      chapterSlug: "chapter-one",
    }),
    "/demo/apps/korean/training/listening/korean-one/lesson-one/chapter-one",
  );
  assert.equal(
    getTeacherRecommendationPath("demo", {
      sourceType: "teacher_recommendation",
      recommendedSource: { sourceType: "review" },
    }),
    "/demo/apps/korean/practice/review",
  );
});

test("推荐迁移包含目标互斥、来源触发器、RLS 与无物理删除授权", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202608190019_teacher_learning_recommendations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /teacher_learning_recommendations_target_check/i);
  assert.match(sql, /target_scope = 'class'[\s\S]+class_id is not null[\s\S]+student_id is null/i);
  assert.match(sql, /validate_teacher_learning_recommendation/i);
  assert.match(sql, /source_type = 'chapter_practice'/i);
  assert.match(sql, /source_type = 'specialized_practice'/i);
  assert.match(sql, /current_teacher_can_manage_learning_recommendation/i);
  assert.match(sql, /current_student_can_read_learning_recommendation/i);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /create policy[^;]+for delete/is);
  assert.doesNotMatch(sql, /grant select, insert, update, delete/i);
});

test("创建 Action 从服务端会话注入老师身份且严格拒绝额外输入", async () => {
  const [actions, service] = await Promise.all([
    readFile(
      new URL(
        "../src/features/teacher-learning-recommendation/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/teacher-learning-recommendation/api/service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(actions, /const \{ supabase, tenant, profile, user \} = await requireActiveUser\(\)/);
  assert.match(actions, /teacherId: context\.user\.id/);
  assert.match(actions, /\.strict\(\)/);
  assert.doesNotMatch(actions, /teacherId:\s*z\./);
  assert.match(service, /teacher_id: teacherId/);
  assert.match(service, /getTeacherRecommendationPath/);
});
