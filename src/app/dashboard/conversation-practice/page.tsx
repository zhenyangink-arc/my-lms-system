import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Eye, MessageCircleMore, MessagesSquare, Sparkles } from "lucide-react";

import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import {
  CONVERSATION_CATEGORY_LABELS,
  CONVERSATION_DIFFICULTY_LABELS,
  type ConversationCategory,
  type ConversationDifficulty,
} from "./config";

type ScenarioRow = {
  id: string;
  title: string;
  description: string;
  category: ConversationCategory;
  difficulty: ConversationDifficulty;
  duration_minutes: number;
  is_featured: boolean;
};
type ProgressRow = { scenario_id: string; status: "practicing" | "completed"; practice_count: number; confidence: number | null };

const difficultyTone: Record<ConversationDifficulty, { color: string; soft: string }> = {
  beginner: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  intermediate: { color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
  advanced: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
};

export default async function ConversationPracticePage() {
  const { supabase, user, canManage, role } = await getConversationPracticeAccess();
  const [scenariosResult, progressResult] = await Promise.all([
    supabase
      .from("conversation_practice_scenarios")
      .select("id,title,description,category,difficulty,duration_minutes,is_featured")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    role === "student"
      ? supabase
          .from("conversation_practice_progress")
          .select("scenario_id,status,practice_count,confidence")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] as ProgressRow[], error: null }),
  ]);
  const scenarios = (scenariosResult.data ?? []) as ScenarioRow[];
  const progress = (progressResult.data ?? []) as ProgressRow[];
  const progressByScenario = new Map(progress.map((item) => [item.scenario_id, item]));
  const completedCount = progress.filter((item) => item.status === "completed").length;
  const practiceCount = progress.reduce((sum, item) => sum + item.practice_count, 0);
  const metricCards = canManage
    ? [["已发布场景", scenarios.length, MessagesSquare, "var(--app-accent)", "var(--app-accent-soft)"], ["入门场景", scenarios.filter((item) => item.difficulty === "beginner").length, Sparkles, "var(--app-success)", "var(--app-success-soft)"], ["推荐场景", scenarios.filter((item) => item.is_featured).length, MessageCircleMore, "var(--app-warm)", "var(--app-warm-soft)"]]
    : [["开放场景", scenarios.length, MessagesSquare, "var(--app-accent)", "var(--app-accent-soft)"], ["累计练习", practiceCount, MessageCircleMore, "var(--app-secondary)", "var(--app-secondary-soft)"], ["已经掌握", completedCount, CheckCircle2, "var(--app-success)", "var(--app-success-soft)"]];

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {canManage && (
          <div className="flex justify-end">
            <Link href="/dashboard/admin/conversation-practice" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>进入后台管理<ArrowRight size={15} /></Link>
          </div>
        )}
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-accent-soft))" }}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{canManage ? <Eye size={14} /> : <MessageCircleMore size={14} />}{canManage ? "学生端只读预览" : "情景开口训练"}</span><h2 className="mt-3 text-2xl font-black tracking-tight">{canManage ? "检查学生实际看到的会话内容" : "从一句开场白，练到完整对话"}</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">{canManage ? "这里仅展示已发布场景，不提供编辑入口。需要修改内容、发布场景或查看练习数据时，请进入后台管理。" : "先读情景和示范对话，再替换重点表达完成自己的版本。每次练习都可以记录自信程度与复盘。"}</p></div>
            <div className="grid grid-cols-3 gap-3">{metricCards.map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof MessagesSquare; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text text-xs font-black">{String(label)}</p></div>; })}</div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/conversation-practice/ai-experience" className="app-card group flex items-center gap-4 rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><MessageCircleMore size={21} /></span>
            <span className="min-w-0 flex-1"><b className="block text-base">与 AI 交流体验</b><span className="app-muted-text mt-1 block text-xs leading-5">进入口语 AI 陪练，开始即时对话与表达练习。</span></span>
            <ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={18} style={{ color: "var(--app-accent)" }} />
          </Link>
          <Link href="/dashboard/conversation-practice/course" className="app-card group flex items-center gap-4 rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><BookOpen size={21} /></span>
            <span className="min-w-0 flex-1"><b className="block text-base">进入课程</b><span className="app-muted-text mt-1 block text-xs leading-5">返回课程中心，继续系统学习与巩固表达。</span></span>
            <ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={18} style={{ color: "var(--app-success)" }} />
          </Link>
        </section>

        {(scenariosResult.error || progressResult.error) && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>会话练习数据暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {scenarios.map((scenario) => {
            const itemProgress = progressByScenario.get(scenario.id);
            const tone = difficultyTone[scenario.difficulty];
            return (
              <Link key={scenario.id} href={`/dashboard/conversation-practice/${scenario.id}`} className="app-card group flex h-full flex-col rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{CONVERSATION_CATEGORY_LABELS[scenario.category]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{CONVERSATION_DIFFICULTY_LABELS[scenario.difficulty]}</span>{scenario.is_featured && <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>推荐</span>}<ArrowRight className="ml-auto transition group-hover:translate-x-1" size={16} /></div>
                <h3 className="mt-4 text-lg font-black leading-7">{scenario.title}</h3><p className="app-muted-text mt-2 line-clamp-3 text-xs leading-5">{scenario.description || "打开场景查看完整情景、示范对话和重点表达。"}</p>
                <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}><span className="app-muted-text inline-flex items-center gap-1 text-xs font-bold"><Clock3 size={12} />建议 {scenario.duration_minutes} 分钟</span>{itemProgress && <span className="text-xs font-black" style={{ color: itemProgress.status === "completed" ? "var(--app-success)" : "var(--app-accent)" }}>{itemProgress.status === "completed" ? "已掌握" : `已练习 ${itemProgress.practice_count} 次`}</span>}</div>
              </Link>
            );
          })}
          {!scenariosResult.error && scenarios.length === 0 && <div className="app-card col-span-full rounded-[1.75rem] border border-dashed p-8 text-center"><MessagesSquare className="mx-auto opacity-30" size={36} /><p className="mt-4 font-black">当前还没有开放的会话场景</p><p className="app-muted-text mt-2 text-sm">后台发布第一个场景后，会自动显示在这里。</p></div>}
        </section>
      </div>
    </div>
  );
}
