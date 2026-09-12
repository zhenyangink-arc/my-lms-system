import "server-only";

import { requireManagementAppAccess } from "@/lib/management-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInsightReport, emptyFacts, type Activity, type Classroom, type Enrollment, type Grade, type InsightFilters, type InsightMode, type Note, type Scenario, type Skill, type Tenant } from "./model";

type PageResult = { data: unknown[] | null; error: { message: string } | null };
// A failed page invalidates its dataset; partial pages must never look like complete totals.
export async function readInsightPages<T>(load: (from: number, to: number) => PromiseLike<PageResult>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await load(from, from + 999);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []) as T[]);
    if ((result.data?.length ?? 0) < 1000) return rows;
  }
}

export type AppRegistration = { tenant_id: string; is_enabled: boolean; status: string; custom_title: string | null; updated_at: string; tenant: Tenant | Tenant[] | null };
export async function getPlatformAppDirectory(appId: string): Promise<AppRegistration[]> {
  const admin = createAdminClient();
  return readInsightPages<AppRegistration>((from, to) => admin.from("tenant_student_apps")
    .select("tenant_id,is_enabled,status,custom_title,updated_at,tenant:tenants!inner(id,name,slug,status)")
    .eq("app_id", appId).order("tenant_id").range(from, to));
}

/** Called only by a server page, rechecking platform capability before any service-role read. */
export async function loadPlatformInsights(appSlug: string, mode: InsightMode, filters: InsightFilters) {
  const access = await requireManagementAppAccess("platform", appSlug);
  const allowed = mode === "conversation" ? access.capabilities.manageAssessments : access.capabilities.viewAnalytics;
  if (access.scope !== "platform" || !allowed) throw new Error("当前账号没有此应用的分析权限。");
  const admin = createAdminClient();
  const facts = emptyFacts();
  const errors: string[] = [];
  let registrations: AppRegistration[] = [];
  try { registrations = await getPlatformAppDirectory(access.appId); }
  catch { errors.push("机构目录"); }
  facts.tenants = registrations.flatMap(row => { const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant; return tenant ? [tenant] : []; });
  const tenants = facts.tenants;
  type Course = { id: string; title: string; tenant_id: string | null };
  let courses: Course[] = [];
  if (mode === "grades") {
    try { courses = await readInsightPages<Course>((from, to) => admin.from("courses").select("id,title,tenant_id").eq("student_app_id", access.appId).order("id").range(from, to)); }
    catch { errors.push("课程目录"); }
    courses = courses.filter(course => course.tenant_id === null || (!filters.tenant ? tenants.some(tenant => tenant.id === course.tenant_id) : course.tenant_id === filters.tenant));
  }
  const invalidCourse = mode === "grades" && Boolean(filters.course) && !courses.some(course => course.id === filters.course);

  if (filters.tenant && !tenants.some(row => row.id === filters.tenant)) {
    return { access, tenants, courses, invalidCourse, report: buildInsightReport(facts, filters, mode), errors, invalidTenant: true };
  }
  // Only the requested module is queried. Fact queries are bounded to two comparison periods.
  const collect = async <T>(label: string, task: Promise<T[]>, accept: (rows: T[]) => void) => {
    try { accept(await task); } catch { errors.push(label); }
  };
  const tasks: Promise<void>[] = [];
  if (invalidCourse) return { access, tenants, courses, invalidCourse, report: buildInsightReport(facts, filters, mode), errors, invalidTenant: false };
  if (mode === "records") {
    tasks.push(collect("学生授权", readInsightPages<Enrollment>((from, to) => admin.from("student_app_enrollments").select("tenant_id,student_id").eq("app_id", access.appId).eq("status", "active").match(filters.tenant ? { tenant_id: filters.tenant } : {}).order("tenant_id").order("student_id").range(from, to)), rows => { facts.enrollments = rows; }));
    tasks.push(collect("辅导关注", readInsightPages<Note>((from, to) => admin.from("learning_record_notes").select("tenant_id,student_id,record_type,status,occurred_at").eq("student_app_id", access.appId).match(filters.tenant ? { tenant_id: filters.tenant } : {}).or(`status.eq.active,occurred_at.gte.${filters.previousStart}`).lt("occurred_at", filters.end).order("id").range(from, to)), rows => { facts.notes = rows; }));
  }
  if (mode === "records" || mode === "conversation") {
    tasks.push(collect("学习活动", readInsightPages<Activity>((from, to) => {
      let query = admin.from("student_learning_activity_events").select("tenant_id,student_id,event_type,source_id,duration_seconds,occurred_at,metadata").eq("student_app_id", access.appId).match(filters.tenant ? { tenant_id: filters.tenant } : {}).gte("occurred_at", filters.previousStart).lt("occurred_at", filters.end);
      if (mode === "conversation") query = query.eq("event_type", "conversation_practiced");
      return query.order("id").range(from, to);
    }), rows => { facts.activities = rows; }));
  }
  if (mode === "grades") {
    type Submission = { tenant_id: string; student_id: string; assignment_id: string; score: number; graded_at: string; assignment: { tenant_id: string; assignment_type: string; total_points: number } | { tenant_id: string; assignment_type: string; total_points: number }[] };
    if (filters.source !== "chapter") tasks.push(collect("作业与考试成绩", readInsightPages<Submission>((from, to) => {
      let query = admin.from("learning_submissions").select("tenant_id,student_id,assignment_id,score,graded_at,assignment:learning_assignments!learning_submissions_assignment_id_fkey!inner(tenant_id,student_app_id,assignment_type,total_points,course_id)").eq("status", "graded").not("score", "is", null).match(filters.tenant ? { tenant_id: filters.tenant } : {}).eq("assignment.student_app_id", access.appId).gte("graded_at", filters.previousStart).lt("graded_at", filters.end);
      if (filters.course) query = query.eq("assignment.course_id", filters.course);
      if (filters.source !== "all") query = query.eq("assignment.assignment_type", filters.source);
      return query.order("id").range(from, to);
    }), rows => { facts.grades.push(...rows.flatMap(row => {
      const assignment = Array.isArray(row.assignment) ? row.assignment[0] : row.assignment;
      if (!assignment || assignment.tenant_id !== row.tenant_id || !(Number(assignment.total_points) > 0)) return [];
      const score = Number(row.score) / Number(assignment.total_points) * 100;
      if (!Number.isFinite(score) || score < 0 || score > 100) return [];
      return [{ tenant_id: row.tenant_id, student_id: row.student_id, source: assignment.assignment_type === "exam" ? "exam" : "homework", sourceId: row.assignment_id, at: row.graded_at, score, passed: score >= 60 } satisfies Grade];
    })); }));
    type Attempt = { tenant_id: string; student_id: string; test_slug: string; score: number; passed: boolean; attempted_at: string };
    if (filters.source === "all" || filters.source === "chapter") tasks.push(collect("章节测试成绩", readInsightPages<Attempt>((from, to) => {
      const relation = filters.course ? "test:chapter_tests!inner(student_app_id,lesson:lessons!inner(course_id))" : "test:chapter_tests!inner(student_app_id)";
      let query = admin.from("chapter_test_attempts").select(`tenant_id,student_id,test_slug,score,passed,attempted_at,${relation}`).match(filters.tenant ? { tenant_id: filters.tenant } : {}).eq("test.student_app_id", access.appId).gte("attempted_at", filters.previousStart).lt("attempted_at", filters.end);
      if (filters.course) query = query.eq("test.lesson.course_id", filters.course);
      return query.order("id").range(from, to);
    }), rows => { facts.grades.push(...rows.map(row => ({ tenant_id: row.tenant_id, student_id: row.student_id, source: "chapter", sourceId: row.test_slug, score: Number(row.score), passed: row.passed, at: row.attempted_at }))); }));
    // The existing view is a cumulative, latest-assessment profile, explicitly labelled as such in the UI.
    if (!filters.course) tasks.push(collect("累计六维能力", readInsightPages<Skill>((from, to) => admin.from("student_grade_skill_profiles").select("tenant_id,skill,earned_points,total_points,question_count").eq("student_app_id", access.appId).match(filters.tenant ? { tenant_id: filters.tenant } : {}).order("tenant_id").order("student_id").order("grade_category").order("skill").range(from, to)), rows => { facts.skills = rows; }));
  }
  if (mode === "conversation") {
    tasks.push(collect("会话场景", readInsightPages<Scenario>((from, to) => admin.from("conversation_practice_scenarios").select("tenant_id,status").eq("student_app_id", access.appId).order("id").range(from, to)), rows => { facts.scenarios = rows; }));
    tasks.push(collect("实时课堂", readInsightPages<Classroom>((from, to) => admin.from("live_class_sessions").select("tenant_id,status,mode,created_at,ended_at,course:courses!inner(student_app_id)").match(filters.tenant ? { tenant_id: filters.tenant } : {}).eq("course.student_app_id", access.appId).or(`status.eq.active,created_at.gte.${filters.previousStart}`).lt("created_at", filters.end).order("id").range(from, to)), rows => { facts.classrooms = rows; }));
  }
  await Promise.all(tasks);
  return { access, tenants, courses, invalidCourse, report: buildInsightReport(facts, filters, mode), errors, invalidTenant: false };
}
