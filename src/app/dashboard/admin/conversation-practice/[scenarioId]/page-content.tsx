import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, Eye, MessageCircleMore } from "lucide-react";

import { CONVERSATION_DATE_TIME_OPTIONS, CONVERSATION_STATUS_LABELS, type ConversationCategory, type ConversationDifficulty, type ConversationStatus, type DialogueLine, type KeyExpression } from "@/app/dashboard/conversation-practice/config";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireConversationPracticeContentManager } from "@/lib/conversation-practice";
import { ConversationScenarioForm, type ConversationScenarioFormValue } from "../ConversationScenarioForm";
import { ConversationScenarioStatusActions } from "../ConversationScenarioStatusActions";


type ScenarioRow = ConversationScenarioFormValue;
type ProfileRow = { id: string; full_name: string | null; email: string | null };
type ProgressRow = { user_id: string; status: "practicing" | "completed"; practice_count: number; confidence: number | null; reflection: string; last_practiced_at: string; student: ProfileRow | ProfileRow[] | null };

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function dialogues(value: unknown): DialogueLine[] { return Array.isArray(value) ? value.filter((item): item is DialogueLine => Boolean(item) && typeof item === "object" && typeof (item as DialogueLine).speaker === "string" && typeof (item as DialogueLine).korean === "string" && typeof (item as DialogueLine).chinese === "string") : []; }
function expressions(value: unknown): KeyExpression[] { return Array.isArray(value) ? value.filter((item): item is KeyExpression => Boolean(item) && typeof item === "object" && typeof (item as KeyExpression).korean === "string" && typeof (item as KeyExpression).chinese === "string") : []; }
function oneProfile(profile: ProgressRow["student"]): ProfileRow | null { return Array.isArray(profile) ? (profile[0] ?? null) : profile; }

export default async function ConversationScenarioManagementPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const { supabase } = await requireConversationPracticeContentManager();
  const [scenarioResult, progressResult] = await Promise.all([
    supabase.from("conversation_practice_scenarios").select("id,title,description,category,difficulty,situation,learning_objectives,sample_dialogue,key_expressions,starter_prompt,practice_tips,duration_minutes,status,is_featured,sort_order").eq("id", scenarioId).maybeSingle(),
    supabase.from("conversation_practice_progress").select("user_id,status,practice_count,confidence,reflection,last_practiced_at,student:profiles!conversation_practice_progress_user_id_fkey(id,full_name,email)").eq("scenario_id", scenarioId).order("last_practiced_at", { ascending: false }),
  ]);
  if (scenarioResult.error) throw new Error("会话场景读取失败");
  if (!scenarioResult.data) notFound();
  const raw = scenarioResult.data as Omit<ScenarioRow, "learning_objectives" | "sample_dialogue" | "key_expressions"> & { learning_objectives: unknown; sample_dialogue: unknown; key_expressions: unknown };
  const scenario: ScenarioRow = { ...raw, category: raw.category as ConversationCategory, difficulty: raw.difficulty as ConversationDifficulty, status: raw.status as ConversationStatus, learning_objectives: strings(raw.learning_objectives), sample_dialogue: dialogues(raw.sample_dialogue), key_expressions: expressions(raw.key_expressions) };
  const progress = (progressResult.data ?? []) as ProgressRow[];
  const studentNames = new Map(progress.flatMap((item) => { const student = oneProfile(item.student); return student ? [[student.id, student.full_name?.trim() || student.email || "学生"] as const] : []; }));

  return (
    <>
      <DashboardPageHeader title="会话场景详情" description="编辑场景内容、管理发布状态并检查学生练习记录。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/admin/conversation-practice" className={`inline-flex items-center gap-2 rounded-md text-xs font-semibold app-muted-text ${focusRing}`}><ArrowLeft size={14} aria-hidden="true" />返回场景管理</Link>
      {progressResult.error && <section role="alert" className="rounded-2xl border p-4 text-sm font-semibold" style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)", borderColor: "var(--status-danger)" }}>学生练习数据暂时无法完整读取，请刷新页面重试。</section>}
      <section className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{CONVERSATION_STATUS_LABELS[scenario.status]}</p><h2 className="mt-2 text-2xl font-semibold">{scenario.title}</h2><p className="app-muted-text mt-2 text-xs">内容编辑和发布状态分别保存，避免误发布未完成内容。</p></div><ConversationScenarioStatusActions id={scenario.id} status={scenario.status} /><Link href={`/dashboard/conversation-practice/${scenario.id}`} className={`app-soft-card inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${focusRing}`}><Eye size={14} aria-hidden="true" />学生端预览</Link></div></section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.65fr)]"><ConversationScenarioForm scenario={scenario} /><section className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }} aria-hidden="true"><BarChart3 size={20} aria-hidden="true" /></span><div><h2 className="text-lg font-semibold">学生练习数据</h2><p className="app-muted-text mt-1 text-xs">{progress.length} 名学生留下了练习记录</p></div></div>{!progressResult.error && <div className="mt-5 space-y-3">{progress.map((item) => <article key={item.user_id} className="app-soft-card rounded-2xl border p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: item.status === "completed" ? "var(--status-success)" : "var(--primary)", backgroundColor: item.status === "completed" ? "var(--status-success-surface)" : "var(--accent)" }} aria-hidden="true">{item.status === "completed" ? <CheckCircle2 size={16} aria-hidden="true" /> : <MessageCircleMore size={16} aria-hidden="true" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{studentNames.get(item.user_id) || "学生"}</p><p className="app-muted-text mt-1 text-xs">练习 {item.practice_count} 次 · 自信 {item.confidence ?? "未评"} 级 · {item.status === "completed" ? "已完成" : "练习中"}</p></div><span className="app-muted-text text-[10px]"><LocalDateTime value={item.last_practiced_at} options={CONVERSATION_DATE_TIME_OPTIONS} /></span></div>{item.reflection && <p className="app-muted-text mt-3 border-t pt-3 text-xs leading-5" style={{ borderColor: "var(--border-subtle)" }}>{item.reflection}</p>}</article>)}{progress.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center"><MessageCircleMore className="mx-auto opacity-30" size={28} aria-hidden="true" /><p className="mt-3 text-sm font-semibold">还没有学生练习记录</p><p className="app-muted-text mt-2 text-xs">场景发布后，学生保存练习复盘时会显示在这里。</p></div>}</div>}</section></div>
      </div>
    </>
  );
}
