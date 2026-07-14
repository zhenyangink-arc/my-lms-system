import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";
import {
  initializeVisaTasksAction,
  updateVisaTaskStatusAction,
} from "../planning-actions";

type VisaTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  sort_order: number;
};

const statusOptions = [
  ["pending", "待准备"],
  ["in_progress", "准备中"],
  ["completed", "已完成"],
  ["blocked", "需协助"],
];
const statusLabelMap = Object.fromEntries(statusOptions);

export default async function VisaPage() {
  const { supabase, user } = await requireActiveUser();
  const { data, error } = await supabase
    .from("student_visa_tasks")
    .select("id, title, description, status, due_date, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });
  const tasks = (data ?? []) as VisaTask[];
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <>
      <DashboardPageHeader title="签证准备" description="按步骤管理韩国签证材料、提交节点和处理状态。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-success-soft))" }}>
          <div className="grid items-center gap-7 lg:grid-cols-[1fr_330px]">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><Sparkles size={14} /> 签证任务路线</span><h2 className="mt-5 text-3xl font-black tracking-tight">把签证准备拆成能够逐项完成的任务</h2><p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text">从入学许可、护照和资金证明，到预约递交与结果查询，每一步都有清晰状态。</p></div>
            <div className="app-card rounded-3xl border p-5"><div className="flex items-end justify-between"><div><p className="text-xs font-bold app-muted-text">签证准备度</p><p className="mt-1 text-3xl font-black">{progressPercent}%</p></div><ShieldCheck size={27} style={{ color: "var(--app-success)" }} /></div><div className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full" style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div><p className="mt-3 text-xs app-muted-text">已完成 {completedCount} / {tasks.length} 项</p></div>
          </div>
        </section>

        {error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>签证任务数据表尚未连接，请先执行 Supabase 数据库迁移。</section>}

        <section className="grid grid-cols-3 gap-3">
          {[["全部任务", tasks.length, ClipboardList, "var(--app-secondary)", "var(--app-secondary-soft)"], ["已完成", completedCount, CheckCircle2, "var(--app-success)", "var(--app-success-soft)"], ["需要协助", blockedCount, TriangleAlert, "var(--app-warm)", "var(--app-warm-soft)" ]].map(([label, value, Icon, color, soft]) => {
            const StatIcon = Icon as typeof ClipboardList;
            return <article key={String(label)} className="app-card rounded-2xl border p-4 sm:p-5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ color: String(color), backgroundColor: String(soft) }}><StatIcon size={19} /></span><p className="mt-3 text-xs font-bold app-muted-text">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></article>;
          })}
        </section>

        <section className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-black">签证任务清单</h2><p className="mt-1 text-xs app-muted-text">按顺序推进，遇到问题可标记为“需协助”</p></div>{tasks.length === 0 && !error && <form action={initializeVisaTasksAction}><button type="submit" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-success)" }}><FileCheck2 size={16} /> 生成签证清单</button></form>}</div>
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task, index) => {
                const done = task.status === "completed";
                const blocked = task.status === "blocked";
                return (
                  <article key={task.id} className="app-soft-card rounded-2xl border p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black" style={{ color: done ? "var(--app-success)" : blocked ? "var(--app-warm)" : "var(--app-secondary)", backgroundColor: done ? "var(--app-success-soft)" : blocked ? "var(--app-warm-soft)" : "var(--app-secondary-soft)" }}>{done ? <CheckCircle2 size={20} /> : blocked ? <TriangleAlert size={20} /> : <CircleDashed size={20} />}</span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black app-muted-text">步骤 {index + 1}</span><span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: done ? "var(--app-success)" : blocked ? "var(--app-warm)" : "var(--app-accent-strong)", backgroundColor: done ? "var(--app-success-soft)" : blocked ? "var(--app-warm-soft)" : "var(--app-accent-soft)" }}>{statusLabelMap[task.status] ?? task.status}</span></div><h3 className="mt-1 text-sm font-black">{task.title}</h3>{task.description && <p className="mt-1 text-xs app-muted-text">{task.description}</p>}</div>
                      <form action={updateVisaTaskStatusAction.bind(null, task.id)} className="flex shrink-0 items-center gap-2"><select name="status" defaultValue={task.status} className="app-input rounded-xl border px-3 py-2.5 text-xs font-bold outline-none">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="submit" className="rounded-xl px-3 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-success)" }}>更新</button></form>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="app-soft-card flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center"><FileCheck2 size={28} style={{ color: "var(--app-success)" }} /><p className="mt-3 text-sm font-black">还没有签证任务清单</p><p className="mt-1 text-xs app-muted-text">点击“生成签证清单”建立标准准备路线。</p></div>
          )}
        </section>
      </div>
    </>
  );
}
