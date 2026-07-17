import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, Clock3, Eye, FilePenLine, MessageCircleMore, ShieldCheck } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { CONVERSATION_CATEGORY_LABELS, CONVERSATION_DIFFICULTY_LABELS, CONVERSATION_STATUS_LABELS, type ConversationCategory, type ConversationDifficulty, type ConversationStatus } from "@/app/dashboard/conversation-practice/config";
import { requireConversationPracticeManager } from "@/lib/conversation-practice";
import { ConversationPracticeAdminManager } from "./ConversationPracticeAdminManager";
import { ConversationScenarioForm } from "./ConversationScenarioForm";
import { ConversationScenarioStatusActions } from "./ConversationScenarioStatusActions";

type ScenarioRow = { id: string; title: string; description: string; category: ConversationCategory; difficulty: ConversationDifficulty; duration_minutes: number; status: ConversationStatus; is_featured: boolean; updated_at: string };
type ProgressRow = { scenario_id: string; status: "practicing" | "completed"; practice_count: number };
type ProfileRow = { id: string; full_name: string | null; email: string | null };

const statusTone: Record<ConversationStatus, { color: string; soft: string }> = {
  draft: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
  published: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  archived: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
};

export default async function ConversationPracticeManagementPage() {
  const { supabase, canAssignAdmins, role } = await requireConversationPracticeManager();
  const [scenariosResult, progressResult] = await Promise.all([
    supabase.from("conversation_practice_scenarios").select("id,title,description,category,difficulty,duration_minutes,status,is_featured,updated_at").order("sort_order", { ascending: true }).order("updated_at", { ascending: false }),
    supabase.from("conversation_practice_progress").select("scenario_id,status,practice_count"),
  ]);
  const scenarios = (scenariosResult.data ?? []) as ScenarioRow[];
  const progress = (progressResult.data ?? []) as ProgressRow[];
  const progressByScenario = new Map<string, ProgressRow[]>();
  progress.forEach((item) => { const current = progressByScenario.get(item.scenario_id) ?? []; current.push(item); progressByScenario.set(item.scenario_id, current); });

  let adminOptions: Array<{ id: string; name: string; email: string; assigned: boolean }> = [];
  if (canAssignAdmins) {
    const [{ data: admins }, { data: assignments }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").eq("role", "admin").eq("status", "active").order("full_name", { ascending: true }),
      supabase.from("conversation_practice_admin_assignments").select("admin_id").is("revoked_at", null),
    ]);
    const assignedIds = new Set((assignments ?? []).map((assignment) => assignment.admin_id as string));
    adminOptions = ((admins ?? []) as ProfileRow[]).map((admin) => ({ id: admin.id, name: admin.full_name?.trim() || "未填写姓名", email: admin.email || "未填写邮箱", assigned: assignedIds.has(admin.id) }));
  }

  const publishedCount = scenarios.filter((item) => item.status === "published").length;
  const completedCount = progress.filter((item) => item.status === "completed").length;
  const practiceTotal = progress.reduce((sum, item) => sum + item.practice_count, 0);

  return (
    <div className="pb-12">
      <DashboardPageHeader title="会话练习管理" description="创建情景会话、控制发布状态并查看学生练习数据。" action={<Link href="#create-scenario" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><FilePenLine size={16} />新建场景</Link>} />
      <div className="mx-auto mt-6 w-full max-w-[1500px] space-y-6 px-4 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-secondary-soft))" }}><div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><ShieldCheck size={14} />{role === "super_admin" ? "负责人权限" : role === "ceo" ? "运营负责人权限" : "已授权管理员"}</span><h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">把情景内容和练习效果放在一起管理</h2><p className="app-muted-text mt-4 max-w-2xl text-sm leading-7">草稿不会出现在学生端；发布后学生可以学习示范对话并记录每次练习。归档会保留历史记录。</p></div><div className="grid grid-cols-3 gap-3">{[["已发布", publishedCount, BookOpenCheck, "var(--app-success)", "var(--app-success-soft)"], ["累计练习", practiceTotal, MessageCircleMore, "var(--app-accent)", "var(--app-accent-soft)"], ["已经掌握", completedCount, CheckCircle2, "var(--app-secondary)", "var(--app-secondary-soft)"]].map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof BookOpenCheck; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text text-[10px] font-black">{String(label)}</p></div>; })}</div></div></section>

        {(scenariosResult.error || progressResult.error) && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>会话练习后台数据暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.7fr)]">
          <section className="app-card rounded-[28px] border p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">场景记录</h2><p className="app-muted-text mt-1 text-xs">共 {scenarios.length} 个场景</p></div><BarChart3 size={22} style={{ color: "var(--app-accent)" }} /></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{scenarios.map((scenario) => { const scenarioProgress = progressByScenario.get(scenario.id) ?? []; const tone = statusTone[scenario.status]; return <article key={scenario.id} className="app-soft-card rounded-3xl border p-5"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{CONVERSATION_CATEGORY_LABELS[scenario.category]}</span><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{CONVERSATION_STATUS_LABELS[scenario.status]}</span>{scenario.is_featured && <span className="text-[10px] font-black" style={{ color: "var(--app-warm)" }}>推荐</span>}</div><h3 className="mt-4 text-lg font-black">{scenario.title}</h3><p className="app-muted-text mt-2 line-clamp-2 text-xs leading-6">{scenario.description || "暂未填写场景简介。"}</p><div className="mt-4 grid grid-cols-3 gap-2"><div className="app-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{scenarioProgress.length}</p><p className="app-muted-text text-[9px] font-bold">练习学生</p></div><div className="app-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{scenarioProgress.filter((item) => item.status === "completed").length}</p><p className="app-muted-text text-[9px] font-bold">已经掌握</p></div><div className="app-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{scenarioProgress.reduce((sum, item) => sum + item.practice_count, 0)}</p><p className="app-muted-text text-[9px] font-bold">练习次数</p></div></div><div className="app-muted-text mt-4 flex items-center gap-3 text-[10px]"><span>{CONVERSATION_DIFFICULTY_LABELS[scenario.difficulty]}</span><span className="inline-flex items-center gap-1"><Clock3 size={11} />{scenario.duration_minutes} 分钟</span></div><div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--app-border-soft)" }}><ConversationScenarioStatusActions id={scenario.id} status={scenario.status} /><Link href={`/dashboard/admin/conversation-practice/${scenario.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>编辑与数据<ArrowRight size={13} /></Link></div></article>; })}{scenarios.length === 0 && <div className="col-span-full rounded-3xl border border-dashed p-10 text-center"><BookOpenCheck className="mx-auto opacity-30" size={32} /><p className="mt-3 font-black">还没有会话场景</p><p className="app-muted-text mt-2 text-xs">使用右侧表单创建第一项练习。</p></div>}</div></section>
          <div className="space-y-6"><ConversationScenarioForm />{canAssignAdmins && <ConversationPracticeAdminManager admins={adminOptions} />}<Link href="/dashboard/conversation-practice" className="app-soft-card flex items-center gap-3 rounded-2xl border p-4 text-xs font-black"><Eye size={16} style={{ color: "var(--app-accent)" }} />查看学生端已发布内容<ArrowRight className="ml-auto" size={14} /></Link></div>
        </div>
      </div>
    </div>
  );
}
