import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

const WRITE_PATHS = [
  "src/app/dashboard/assignments/actions.ts",
  "src/app/dashboard/toolbox/actions.ts",
  "src/features/chapter-practice/progress-actions.ts",
  "src/features/chapter-practice/listening-actions.ts",
  "src/features/chapter-practice/student/progress-service.ts",
  "src/features/chapter-practice/api/management-service.ts",
  "src/features/student-review-center/actions.ts",
  "src/features/teacher-practice-insights/actions.ts",
];

test("2C：写入操作不再固定使用韩语应用", () => {
  for (const path of WRITE_PATHS) {
    assert.doesNotMatch(
      read(path),
      /STUDENT_APP_IDS\.korean|appSlug: "korean"|\/apps\/korean\//,
      path,
    );
  }
});

test("学生写入后的首页刷新使用服务端读取的记录所属应用", () => {
  const cases = [
    ["src/app/dashboard/assignments/actions.ts", /studentAppId: assignmentApp\?\.student_app_id/, /from\("learning_assignments"\)\s*\.select\("student_app_id"\)/],
    ["src/app/dashboard/toolbox/actions.ts", /studentAppId: exercise\?\.student_app_id/, /from\("growth_toolbox_exercises"\)\s*\.select\("student_app_id"\)/],
    ["src/features/chapter-practice/progress-actions.ts", /studentAppId: unit\?\.student_app_id/, /from\("chapter_practice_units"\)\s*\.select\("student_app_id"\)/],
    ["src/features/chapter-practice/listening-actions.ts", /studentAppId: unit\.student_app_id/, /\.select\("id,student_app_id"\)/],
    ["src/features/student-review-center/actions.ts", /studentAppId: data\.student_app_id/, /\.select\("id,status,mastered_at,student_app_id"\)/],
  ];
  for (const [path, refresh, source] of cases) {
    const text = read(path);
    assert.match(text, /refreshStudentHomeLearningForApp\(/, path);
    assert.match(text, refresh, path);
    assert.match(text, source, path);
    assert.doesNotMatch(text, /refreshStudentHomeLearning\(\{/, path);
  }
});

test("学生写入的输入参数不携带应用，唯一例外是工具箱计时并在服务端核对权限", () => {
  const progress = read("src/features/chapter-practice/progress-actions.ts");
  const schema = progress.match(/const mutationSchema = z\.object\(\{[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.ok(schema.length > 0);
  assert.doesNotMatch(schema, /app/i);

  const listening = read("src/features/chapter-practice/listening-actions.ts");
  const listeningInput = listening.match(/export async function evaluateChapterPracticeListening\(input: \{[\s\S]*?\}\)/)?.[0] ?? "";
  assert.ok(listeningInput.length > 0);
  assert.doesNotMatch(listeningInput, /app/i);

  const toolbox = read("src/app/dashboard/toolbox/actions.ts");
  const timer = toolbox.match(/export async function recordToolboxStudyTime[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(timer, /if \(!isSubjectSlug\(appSlug\)\) return;/);
  assert.match(timer, /hasActiveStudentAppAccess\(\{/);
  assert.ok(timer.indexOf("hasActiveStudentAppAccess") < timer.indexOf('from("learning_time_log")'));
});

test("听辨判定在使用管理员权限读取答案前核对练习所属应用的学生权限", () => {
  const listening = read("src/features/chapter-practice/listening-actions.ts");
  const access = listening.indexOf("hasActiveStudentAppAccess({");
  const admin = listening.indexOf("createAdminClient()");
  assert.ok(access > 0 && admin > 0 && access < admin);
  assert.match(listening, /appId: unit\.student_app_id/);
});

test("老师巩固推荐接收页面学科后在服务端核对分区和负责关系", () => {
  const actions = read("src/features/teacher-practice-insights/actions.ts");
  assert.match(actions, /export async function recommendStudentPracticeAction\(\n  appSlug: string,/);
  assert.match(actions, /!isSubjectSlug\(appSlug\) \|\| !isSubjectSectionEnabled\(appSlug, "practice-insights"\)/);
  assert.match(actions, /const appId = STUDENT_APP_IDS\[appSlug\];/);
  assert.match(actions, /getTeacherAssignedStudentIds\(\s*supabase,\s*tenant\.id,\s*user\.id,\s*appId,\s*\)/);
  assert.match(read("src/features/teacher-practice-insights/recommendation-button.tsx"), /bind\(null, appSlug, studentId, target\)/);
});

test("巩固中心后台只处理开放巩固中心的学科内容，应用来自课程或练习单元", () => {
  const service = read("src/features/chapter-practice/api/management-service.ts");
  assert.match(service, /isSubjectSectionEnabled\(appSlug, "practice-center"\)/);
  assert.match(service, /!isPracticeCenterApp\(course\.student_app_id\)/);
  assert.match(service, /student_app_id: context\.course\.student_app_id,/);
  assert.equal((service.match(/isPracticeCenterApp\((unit|unitBefore)\.student_app_id\)/g) ?? []).length, 4);
  assert.doesNotMatch(service, /\.eq\("student_app_id", STUDENT_APP_IDS/);
});
