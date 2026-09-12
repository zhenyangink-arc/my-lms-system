import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmitButton } from "@/features/curriculum-plans/components/ConfirmSubmitButton";
import { POLICY_CHECKS, POLICY_FIELDS } from "./policy-form";
import { saveCompletionPolicyAction, publishCompletionPolicyAction, processCompletionRefreshAction, retryCompletionRefreshAction, requestCompletionRefreshAction } from "./policy-actions";

const fieldClass = "mt-1 min-h-11 w-full rounded-lg border bg-[var(--card)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";
type Policy = { id: string; course_id: string; title: string; version: number; status: string; requirements: Record<string, Record<string, number | boolean>> };

export async function CompletionPolicyWorkspace({ space, appSlug, appId, platform }: { space: string; appSlug: string; appId: string; platform: boolean }) {
  const supabase = await createClient();
  const [courses, policies, health] = await Promise.all([
    supabase.from("courses").select("id,title").eq("student_app_id",appId).eq("content_scope","platform").order("sort_order"),
    platform ? supabase.from("course_completion_policies").select("id,course_id,title,version,status,requirements").eq("student_app_id",appId).order("version",{ascending:false}) : Promise.resolve({data:[],error:null}),
    platform ? supabase.rpc("get_completion_refresh_health") : Promise.resolve({data:null,error:null}),
  ]);
  if (courses.error || policies.error || health.error) return <p role="alert">结课政策或刷新状态读取失败，请检查数据库更新后重试。</p>;
  if (!platform) return <form action={requestCompletionRefreshAction.bind(null,space,appSlug)} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
    <label className="text-sm">重新核对课程资格<select name="course_id" required className={fieldClass}>{courses.data?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    <button className="min-h-11 rounded-lg border px-4">申请重新计算</button>
  </form>;
  const rows = (policies.data ?? []) as Policy[];
  const status = health.data as { pending: number; failed: number; processing: number; lastFinishedAt: string | null };
  function fields(requirements: Policy["requirements"] = {}) {
    return <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{POLICY_FIELDS.map(f => <label key={f.key} className="text-sm">{f.label}<input className={fieldClass} name={`${f.section}.${f.key}`} type="number" required min={f.min} max={f.max} defaultValue={Number(requirements[f.section]?.[f.key] ?? f.initial)} /></label>)}</div>
      <div className="grid gap-2 sm:grid-cols-2">{POLICY_CHECKS.map(f => <label key={f.key + f.section} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`${f.section}.${f.key}`} disabled={f.section !== "required_assignments"} defaultChecked={f.section !== "required_assignments" || Boolean(requirements[f.section]?.[f.key] ?? true)} />{f.label}{f.section !== "required_assignments" ? "（固定规则）" : ""}</label>)}</div>
    </>;
  }
  return <div className="space-y-4">
    <section className="rounded-xl border p-4">
      <CardTitleWithHint title="资格刷新" description="教材和成绩变化会触发重算；政策发布产生批量任务，由后台刷新服务处理。手动执行处理最多十个到期任务。" headingLevel={2} />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><span>待处理 {status.pending}</span><span>处理中 {status.processing}</span><span>失败／部分失败 {status.failed}</span>
        <span>最近完成：{status.lastFinishedAt ? new Date(status.lastFinishedAt).toLocaleString("zh-CN",{timeZone:"Asia/Seoul"}) : "暂无完成记录"}</span>
        <form action={processCompletionRefreshAction.bind(null,space,appSlug)}><button className="min-h-11 rounded-lg border px-3">执行一批刷新</button></form>
        {status.failed > 0 && <form action={retryCompletionRefreshAction.bind(null,space,appSlug)}><ConfirmSubmitButton className="min-h-11 rounded-lg border px-3" confirmText="确认已处理政策或成绩来源问题？将最多十个失败任务重新排队。">重试失败任务</ConfirmSubmitButton></form>}
      </div>
    </section>
    <section className="rounded-xl border p-4">
      <CardTitleWithHint title="结课政策" description="先保存并核对草稿，再发布为课程当前政策。发布替换旧默认政策并触发重算；已颁发证书保留当时的政策快照。巩固进度在学习计划追踪，当前结课引擎按下列教材和考核条件判定。" headingLevel={2} />
      <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 font-semibold">新建政策草稿</summary>
        <form action={saveCompletionPolicyAction.bind(null,space,appSlug)} className="space-y-4">
          <label className="block text-sm">课程<select className={fieldClass} name="course_id" required>{courses.data?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <label className="block text-sm">政策名称<input className={fieldClass} name="title" required minLength={2} maxLength={160} /></label>
          {fields()}<button className="min-h-11 rounded-lg border px-4">保存草稿</button>
        </form>
      </details>
      {rows.map(p => <details key={p.id} className="mt-2 border-t pt-2"><summary className="min-h-11 cursor-pointer py-3">{courses.data?.find(c => c.id === p.course_id)?.title} · {p.title} · 第 {p.version} 版 · {p.status === "draft" ? "草稿" : p.status === "published" ? "已发布" : "已停用"}</summary>
        <form action={saveCompletionPolicyAction.bind(null,space,appSlug)} className="space-y-4">
          <input type="hidden" name="course_id" value={p.course_id} />
          {p.status === "draft" && <input type="hidden" name="policy_id" value={p.id} />}
          <label className="block text-sm">政策名称<input className={fieldClass} name="title" required minLength={2} maxLength={160} defaultValue={p.title} /></label>
          {fields(p.requirements)}
          <button className="min-h-11 rounded-lg border px-4">{p.status === "draft" ? "保存草稿修改" : "以上述规则建立新草稿"}</button>
        </form>
        {p.status === "draft" && <form className="mt-3" action={publishCompletionPolicyAction.bind(null,space,appSlug,p.id)}>
          <ConfirmSubmitButton className="min-h-11 rounded-lg border px-4 font-semibold" confirmText="发布已保存的草稿并替换本课程旧默认政策？尚未保存的表单修改不会发布；系统会重新计算资格，已有证书保留原快照。">发布已保存的政策</ConfirmSubmitButton>
        </form>}
      </details>)}
    </section>
  </div>;
}
