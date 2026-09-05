import { CalendarClock, CheckCircle2, Clock3, Send, UsersRound } from "lucide-react";

import {
  addCurriculumTemplateItemAction,
  createCurriculumTemplateAction,
  publishCurriculumTemplateAction,
  publishInstitutionCurriculumPlanAction,
} from "../actions";
import type {
  CurriculumPlanStudent,
  CurriculumPlanTemplate,
  CurriculumPlanTemplateItem,
  InstitutionCurriculumPlan,
} from "../types";

type CourseOption = { id: string; title: string };
type LessonOption = { id: string; courseId: string; title: string };

const ACTIVITY_LABELS: Record<CurriculumPlanTemplateItem["activityType"], string> = {
  course: "课程学习",
  listening: "听力练习",
  speaking: "口语练习",
  reading: "阅读练习",
  writing: "写作练习",
  vocabulary: "单词练习",
  grammar: "语法练习",
  chapter_test: "章节测试",
  stage_exam: "阶段考试",
  final_exam: "结课考试",
  review: "复习整理",
};

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function timeLabel(item: CurriculumPlanTemplateItem) {
  const hour = Math.floor(item.startMinute / 60).toString().padStart(2, "0");
  const minute = (item.startMinute % 60).toString().padStart(2, "0");
  return `第 ${item.dayOffset + 1} 天 · ${hour}:${minute} · ${item.durationMinutes} 分钟`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusMessage({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <div
      role="status"
      className={`rounded-2xl border px-4 py-3 text-sm ${
        error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {error || success}
    </div>
  );
}

function TemplateSchedule({ items }: { items: CurriculumPlanTemplateItem[] }) {
  if (!items.length) return <p className="py-3 text-sm text-slate-500">尚未添加课程、练习或考试安排。</p>;
  return (
    <ol className="mt-4 grid gap-2 lg:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm text-slate-800">{item.title}</strong>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">
              {ACTIVITY_LABELS[item.activityType]}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{timeLabel(item)}{item.isRequired ? " · 必修" : " · 选修"}</p>
        </li>
      ))}
    </ol>
  );
}

function PlatformWorkspace({
  space,
  appSlug,
  courses,
  lessons,
  templates,
  items,
}: {
  space: string;
  appSlug: string;
  courses: CourseOption[];
  lessons: LessonOption[];
  templates: CurriculumPlanTemplate[];
  items: CurriculumPlanTemplateItem[];
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><CalendarClock size={20} /></div>
          <div><h2 className="font-semibold text-slate-900">新建标准计划</h2><p className="text-sm text-slate-500">先建立周期，再逐项编排 1–16 章课程、六维练习、测试与考试。</p></div>
        </div>
        <form action={createCurriculumTemplateAction.bind(null, space, appSlug)} className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">对应课程<select name="course_id" className={`${inputClass} mt-1`} defaultValue=""><option value="">暂不绑定课程</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-600 md:col-span-2">计划名称<input name="title" required maxLength={160} className={`${inputClass} mt-1`} placeholder="韩国语一级 · 30 天标准计划" /></label>
          <label className="text-xs font-medium text-slate-600">计划天数<input name="duration_days" type="number" required min={1} max={366} defaultValue={30} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-medium text-slate-600 md:col-span-3">计划说明<input name="description" maxLength={1000} className={`${inputClass} mt-1`} placeholder="说明适用对象和完成目标" /></label>
          <button className="mt-5 h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">建立草稿</button>
        </form>
      </section>

      {templates.map((template) => {
        const templateItems = items.filter((item) => item.templateId === template.id);
        const templateLessons = lessons.filter((lesson) => lesson.courseId === template.courseId);
        return (
          <section key={template.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">{template.title}</h2><span className={`rounded-full px-2 py-1 text-[11px] ${template.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{template.status === "published" ? "已发布" : template.status === "draft" ? "草稿" : "已停用"}</span></div><p className="mt-1 text-sm text-slate-500">版本 {template.version} · {template.durationDays} 天 · {templateItems.length} 项安排</p></div>
              {template.status === "draft" && templateItems.length > 0 ? <form action={publishCurriculumTemplateAction.bind(null, space, appSlug, template.id)}><button className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800"><Send size={15} />发布标准计划</button></form> : null}
            </div>
            <TemplateSchedule items={templateItems} />
            {template.status === "draft" ? (
              <details className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">添加课程、练习或考试</summary>
                <form action={addCurriculumTemplateItemAction.bind(null, space, appSlug, template.id)} className="mt-4 grid gap-3 md:grid-cols-6">
                  <label className="text-xs font-medium text-slate-600">第几天<input name="day" type="number" min={1} max={template.durationDays} required defaultValue={1} className={`${inputClass} mt-1`} /></label>
                  <label className="text-xs font-medium text-slate-600">开始时间<input name="start_time" type="time" required defaultValue="09:00" className={`${inputClass} mt-1`} /></label>
                  <label className="text-xs font-medium text-slate-600">时长（分钟）<input name="duration_minutes" type="number" min={5} max={720} required defaultValue={50} className={`${inputClass} mt-1`} /></label>
                  <label className="text-xs font-medium text-slate-600">活动类型<select name="activity_type" className={`${inputClass} mt-1`}>{Object.entries(ACTIVITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-xs font-medium text-slate-600 md:col-span-2">绑定真实课时<select name="lesson_id" className={`${inputClass} mt-1`} defaultValue=""><option value="">非课程活动，不绑定课时</option>{templateLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>
                  <label className="text-xs font-medium text-slate-600 md:col-span-2">标题<input name="title" maxLength={200} className={`${inputClass} mt-1`} placeholder="绑定课时后可留空，其他活动必填" /></label>
                  <label className="text-xs font-medium text-slate-600 md:col-span-3">学生端入口<input name="destination_path" className={`${inputClass} mt-1`} placeholder="/dashboard/courses/...（可选）" /></label>
                  <label className="text-xs font-medium text-slate-600 md:col-span-2">学习要求<input name="instructions" maxLength={1000} className={`${inputClass} mt-1`} placeholder="完成课程后进行听力练习" /></label>
                  <label className="mt-5 flex h-10 items-center gap-2 text-sm text-slate-700"><input name="is_required" type="checkbox" defaultChecked />设为必修</label>
                  <button className="h-10 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 md:col-start-6">加入计划</button>
                </form>
              </details>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function InstitutionWorkspace({ space, appSlug, templates, items, students, plans }: { space: string; appSlug: string; templates: CurriculumPlanTemplate[]; items: CurriculumPlanTemplateItem[]; students: CurriculumPlanStudent[]; plans: InstitutionCurriculumPlan[] }) {
  return (
    <div className="space-y-5">
      {templates.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">平台尚未发布可采用的标准学习计划。</div> : templates.map((template) => {
        const templateItems = items.filter((item) => item.templateId === template.id);
        return <section key={template.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-sky-50 p-2 text-sky-700"><CheckCircle2 size={20} /></div><div><h2 className="font-semibold text-slate-900">{template.title}</h2><p className="text-sm text-slate-500">平台标准 · {template.durationDays} 天 · {templateItems.length} 项安排</p></div></div>
          <TemplateSchedule items={templateItems} />
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">采用此计划并发布给学生</summary>
            <form action={publishInstitutionCurriculumPlanAction.bind(null, space, appSlug, template.id)} className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-medium text-slate-600">机构计划名称<input name="title" defaultValue={template.title} className={`${inputClass} mt-1`} /></label><label className="text-xs font-medium text-slate-600">第一项开始时间（韩国时间）<input name="starts_at" type="datetime-local" required className={`${inputClass} mt-1`} /></label></div>
              <fieldset><legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><UsersRound size={16} />选择学生</legend><div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">{students.length ? students.map((student) => <label key={student.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><input type="checkbox" name="student_ids" value={student.id} /><span>{student.name}{student.loginId ? <small className="ml-1 text-slate-400">{student.loginId}</small> : null}</span></label>) : <p className="text-sm text-slate-500">当前没有可分配的已开通学生。</p>}</div></fieldset>
              <button disabled={!students.length} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} />发布机构计划</button>
            </form>
          </details>
        </section>;
      })}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><Clock3 size={18} className="text-slate-500" /><h2 className="font-semibold text-slate-900">已发布计划</h2></div>{plans.length ? <ul className="divide-y divide-slate-100">{plans.map((plan) => <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><strong className="text-slate-800">{plan.title}</strong><p className="text-xs text-slate-500">{formatDateTime(plan.startsAt)} 至 {formatDateTime(plan.endsAt)}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{plan.studentIds.length} 名学生 · 已发布</span></li>)}</ul> : <p className="text-sm text-slate-500">还没有机构执行计划。</p>}</section>
    </div>
  );
}

export function CurriculumPlanWorkspace({ space, appSlug, scope, courses, lessons, templates, items, students, plans, success, error }: { space: string; appSlug: string; scope: "platform" | "tenant"; courses: CourseOption[]; lessons: LessonOption[]; templates: CurriculumPlanTemplate[]; items: CurriculumPlanTemplateItem[]; students: CurriculumPlanStudent[]; plans: InstitutionCurriculumPlan[]; success?: string; error?: string }) {
  return <div className="space-y-5"><StatusMessage success={success} error={error} />{scope === "platform" ? <PlatformWorkspace space={space} appSlug={appSlug} courses={courses} lessons={lessons} templates={templates} items={items} /> : <InstitutionWorkspace space={space} appSlug={appSlug} templates={templates} items={items} students={students} plans={plans} />}</div>;
}
