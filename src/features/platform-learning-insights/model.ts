export type InsightMode = "grades" | "records" | "conversation";
export type SearchParams = Record<string, string | string[] | undefined>;
export type InsightFilters = { days: 7 | 30 | 90; tenant: string; course: string; source: "all" | "homework" | "exam" | "chapter"; start: string; previousStart: string; end: string };
export type Tenant = { id: string; name: string; slug: string; status: string };
export type Enrollment = { tenant_id: string; student_id: string };
export type Activity = { tenant_id: string; student_id: string; event_type: string; source_id: string; duration_seconds: number; occurred_at: string; metadata?: { status?: string } };
export type Grade = { tenant_id: string; student_id: string; source: string; sourceId: string; at: string; score: number; passed: boolean };
export type Note = { tenant_id: string; student_id: string; record_type: string; status: string; occurred_at: string };
export type Classroom = { tenant_id: string; status: string; mode: string; created_at: string; ended_at: string | null };
export type Scenario = { tenant_id: string | null; status: string };
export type Skill = { tenant_id: string; skill: string; earned_points: number | string; total_points: number | string; question_count: number | string };
export type InsightFacts = { tenants: Tenant[]; enrollments: Enrollment[]; grades: Grade[]; activities: Activity[]; notes: Note[]; classrooms: Classroom[]; scenarios: Scenario[]; skills: Skill[] };
export type Metrics = { students: number; participants: number; samples: number; average: number | null; passRate: number | null; seconds: number; completed: number; attention: number; notes: number; inactive: number; practices: number; classes: number; endedClasses: number; activeClasses: number; scenarios: number; publishedScenarios: number; distribution: number[] };
export type InsightRow = { tenant: Tenant; current: Metrics; previous: Metrics };
export type InsightReport = { rows: InsightRow[]; current: Metrics; previous: Metrics; trend: { date: string; value: number }[]; skills: { skill: string; value: number | null; evidenceCount: number }[] };

const DAY = 86_400_000;
export function parseInsightFilters(params: SearchParams, now = new Date()): InsightFilters {
  const first = (key: string) => { const value = params[key]; return Array.isArray(value) ? value[0] : value; };
  const requested = Number(first("days"));
  const days = requested === 7 || requested === 90 ? requested : 30;
  const source = first("source");
  const tenant = first("tenant") ?? "";
  const course = first("course") ?? "";
  return { days, course: /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(course) ? course : "", tenant: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(tenant) ? tenant : "", source: source === "homework" || source === "exam" || source === "chapter" ? source : "all", start: new Date(now.getTime() - days * DAY).toISOString(), previousStart: new Date(now.getTime() - days * 2 * DAY).toISOString(), end: now.toISOString() };
}

export function emptyMetrics(): Metrics {
  return { students: 0, participants: 0, samples: 0, average: null, passRate: null, seconds: 0, completed: 0, attention: 0, notes: 0, inactive: 0, practices: 0, classes: 0, endedClasses: 0, activeClasses: 0, scenarios: 0, publishedScenarios: 0, distribution: [0, 0, 0, 0] };
}
export const emptyFacts = (): InsightFacts => ({ tenants: [], enrollments: [], grades: [], activities: [], notes: [], classrooms: [], scenarios: [], skills: [] });
const identity = (row: { tenant_id: string; student_id: string }) => `${row.tenant_id}:${row.student_id}`;
export function inPeriod(at: string, start: string, end: string) {
  const stamp = Date.parse(at);
  return stamp >= Date.parse(start) && stamp < Date.parse(end);
}
export function formatHours(seconds: number) { return (seconds / 3600).toFixed(1); }

function summarize(facts: InsightFacts, start: string, end: string, source: string): Metrics {
  const result = emptyMetrics();
  const enrolled = new Set(facts.enrollments.map(identity));
  result.students = enrolled.size;
  // Latest result per student and assessment within each period, not the mean of retries.
  const latest = new Map<string, Grade>();
  for (const grade of facts.grades) {
    if (!inPeriod(grade.at, start, end) || (source !== "all" && grade.source !== source)) continue;
    const key = `${identity(grade)}:${grade.source}:${grade.sourceId}`;
    if (!latest.has(key) || Date.parse(latest.get(key)!.at) < Date.parse(grade.at)) latest.set(key, grade);
  }
  const grades = [...latest.values()];
  result.samples = grades.length;
  result.average = grades.length ? grades.reduce((sum, row) => sum + row.score, 0) / grades.length : null;
  result.passRate = grades.length ? grades.filter(row => row.passed).length / grades.length * 100 : null;
  for (const row of grades) result.distribution[row.score < 60 ? 0 : row.score < 75 ? 1 : row.score < 90 ? 2 : 3]++;
  const activities = facts.activities.filter(row => inPeriod(row.occurred_at, start, end));
  // Grading feedback is a staff action, not evidence of student activity.
  const learning = activities.filter(row => !["assignment_graded", "assignment_returned"].includes(row.event_type));
  const active = new Set(learning.map(identity));
  result.participants = active.size;
  result.inactive = [...enrolled].filter(id => !active.has(id)).length;
  result.seconds = activities.filter(row => row.event_type === "learning_time_recorded").reduce((sum, row) => sum + Math.max(0, Number(row.duration_seconds) || 0), 0);
  result.completed = new Set(activities.filter(row => row.event_type === "lesson_completed").map(row => `${identity(row)}:${row.source_id}`)).size;
  const practice = activities.filter(row => row.event_type === "conversation_practiced");
  result.practices = practice.length;
  const currentNotes = facts.notes.filter(row => inPeriod(row.occurred_at, start, end));
  result.notes = currentNotes.length;
  result.attention = new Set(facts.notes.filter(row => row.status === "active" && row.record_type === "attention").map(identity)).size;
  const classes = facts.classrooms.filter(row => inPeriod(row.created_at, start, end));
  result.classes = classes.length;
  result.endedClasses = classes.filter(row => row.status === "ended").length;
  result.activeClasses = facts.classrooms.filter(row => row.status === "active").length;
  result.scenarios = facts.scenarios.length;
  result.publishedScenarios = facts.scenarios.filter(row => row.status === "published").length;
  return result;
}

export function buildInsightReport(facts: InsightFacts, filters: InsightFilters, mode: InsightMode): InsightReport {
  const tenants = facts.tenants.filter(row => !filters.tenant || row.id === filters.tenant);
  const tenantIds = new Set(tenants.map(row => row.id));
  const scope = (ids: Set<string>): InsightFacts => ({ tenants: facts.tenants.filter(row => ids.has(row.id)), enrollments: facts.enrollments.filter(row => ids.has(row.tenant_id)), grades: facts.grades.filter(row => ids.has(row.tenant_id)), activities: facts.activities.filter(row => ids.has(row.tenant_id)), notes: facts.notes.filter(row => ids.has(row.tenant_id)), classrooms: facts.classrooms.filter(row => ids.has(row.tenant_id)), scenarios: facts.scenarios.filter(row => row.tenant_id === null || ids.has(row.tenant_id)), skills: facts.skills.filter(row => ids.has(row.tenant_id)) });
  const scoped = scope(tenantIds);
  const metrics = (data: InsightFacts, start: string, end: string) => {
    const result = summarize(data, start, end, filters.source);
    if (mode === "conversation") {
      const practices = data.activities.filter(row => row.event_type === "conversation_practiced" && inPeriod(row.occurred_at, start, end));
      result.participants = new Set(practices.map(identity)).size;
      result.completed = new Set(practices.filter(row => row.metadata?.status === "completed").map(row => `${identity(row)}:${row.source_id}`)).size;
    }
    return result;
  };
  const current = metrics(scoped, filters.start, filters.end);
  const previous = metrics(scoped, filters.previousStart, filters.start);
  const rows = tenants.map(tenant => { const data = scope(new Set([tenant.id])); return { tenant, current: metrics(data, filters.start, filters.end), previous: metrics(data, filters.previousStart, filters.start) }; });
  const trend: InsightReport["trend"] = [];
  const width = Math.max(1, Math.ceil(filters.days / 12));
  for (let day = 0; day < filters.days; day += width) {
    const start = new Date(Date.parse(filters.start) + day * DAY).toISOString();
    const end = new Date(Math.min(Date.parse(filters.end), Date.parse(start) + width * DAY)).toISOString();
    const data = metrics(scoped, start, end);
    trend.push({ date: new Date(start).toLocaleDateString("zh-CN", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }), value: mode === "grades" ? data.average ?? -1 : mode === "records" ? data.seconds / 3600 : data.practices });
  }
  const skills = ["listening", "speaking", "reading", "writing", "grammar", "vocabulary"].map(skill => {
    const evidence = scoped.skills.filter(row => row.skill === skill);
    const earned = evidence.reduce((sum, row) => sum + Number(row.earned_points), 0);
    const total = evidence.reduce((sum, row) => sum + Number(row.total_points), 0);
    return { skill, value: total > 0 ? Math.max(0, Math.min(100, earned / total * 100)) : null, evidenceCount: evidence.reduce((sum, row) => sum + Number(row.question_count), 0) };
  });
  return { rows, current, previous, trend, skills };
}

export type InstitutionSignal = { key: string; title: string; reason: string; nextAction: string };
/** Operational screening only: never diagnose individual learners or silently invent targets. */
export function institutionSignals(row: InsightRow, mode: InsightMode): InstitutionSignal[] {
  const current = row.current;
  const signals: InstitutionSignal[] = [];
  if (mode === "grades" && current.samples >= 10 && row.previous.samples >= 10 && current.average !== null && row.previous.average !== null && row.previous.average - current.average >= 10) {
    signals.push({ key: "grade_drop", title: "平均分下降", reason: `两期各有至少 10 份成绩，平均分下降 ${(row.previous.average - current.average).toFixed(1)} 分。`, nextAction: "先按课程及成绩来源核对考核难度和样本变化，再请机构确认教学情况。" });
  }
  if (mode === "records" && current.students >= 5 && current.inactive / current.students >= 0.5) {
    signals.push({ key: "low_activity", title: "未活跃比例较高", reason: `当前授权 ${current.students} 人，本期 ${current.inactive} 人无学习活动（至少 50%）。`, nextAction: "先核对开课日期、假期与新增授权，再在机构学习记录中跟进；未活跃不直接等于学习落后。" });
  }
  if (mode === "records" && current.attention > 0) {
    signals.push({ key: "manual_attention", title: "有未归档关注", reason: `${current.attention} 名学生仍有有效人工关注备注。`, nextAction: "请机构负责人核对辅导处理情况，完成后在机构端归档对应备注。" });
  }
  return signals;
}
