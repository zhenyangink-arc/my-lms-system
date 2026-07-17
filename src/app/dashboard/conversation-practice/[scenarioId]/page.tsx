import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenText, Check, Clock3, Eye, Lightbulb, MessageCircleMore, Sparkles } from "lucide-react";

import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { PracticeReflectionForm } from "../PracticeReflectionForm";
import { CONVERSATION_CATEGORY_LABELS, CONVERSATION_DIFFICULTY_LABELS, type ConversationCategory, type ConversationDifficulty, type DialogueLine, type KeyExpression } from "../config";

type ScenarioRow = { id: string; title: string; description: string; category: ConversationCategory; difficulty: ConversationDifficulty; situation: string; learning_objectives: unknown; sample_dialogue: unknown; key_expressions: unknown; starter_prompt: string; practice_tips: string; duration_minutes: number };
type ProgressRow = { status: "practicing" | "completed"; practice_count: number; confidence: number | null; reflection: string };

function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function dialogueArray(value: unknown): DialogueLine[] { return Array.isArray(value) ? value.filter((item): item is DialogueLine => Boolean(item) && typeof item === "object" && typeof (item as DialogueLine).speaker === "string" && typeof (item as DialogueLine).korean === "string" && typeof (item as DialogueLine).chinese === "string") : []; }
function expressionArray(value: unknown): KeyExpression[] { return Array.isArray(value) ? value.filter((item): item is KeyExpression => Boolean(item) && typeof item === "object" && typeof (item as KeyExpression).korean === "string" && typeof (item as KeyExpression).chinese === "string") : []; }

export default async function ConversationScenarioPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const { supabase, user, canManage, role } = await getConversationPracticeAccess();
  const [scenarioResult, progressResult] = await Promise.all([
    supabase.from("conversation_practice_scenarios").select("id,title,description,category,difficulty,situation,learning_objectives,sample_dialogue,key_expressions,starter_prompt,practice_tips,duration_minutes").eq("id", scenarioId).eq("status", "published").maybeSingle(),
    role === "student" ? supabase.from("conversation_practice_progress").select("status,practice_count,confidence,reflection").eq("scenario_id", scenarioId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null as ProgressRow | null, error: null }),
  ]);
  if (scenarioResult.error || !scenarioResult.data) notFound();
  const scenario = scenarioResult.data as ScenarioRow;
  const progress = progressResult.data as ProgressRow | null;
  const objectives = stringArray(scenario.learning_objectives);
  const dialogue = dialogueArray(scenario.sample_dialogue);
  const expressions = expressionArray(scenario.key_expressions);

  return (
    <div className="mx-auto w-full max-w-[1250px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/conversation-practice" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回会话练习</Link>
      <section className="app-card rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end), var(--app-accent-soft))" }}><div className="flex flex-col gap-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{CONVERSATION_CATEGORY_LABELS[scenario.category]}</span><span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{CONVERSATION_DIFFICULTY_LABELS[scenario.difficulty]}</span></div><h1 className="mt-4 text-3xl font-black tracking-tight">{scenario.title}</h1><p className="app-muted-text mt-4 text-sm leading-7">{scenario.description || "按照场景任务完成一轮完整会话。"}</p><p className="app-muted-text mt-4 inline-flex items-center gap-1 text-xs"><Clock3 size={13} />建议练习 {scenario.duration_minutes} 分钟</p></div>{progress && <div className="app-card min-w-[190px] rounded-2xl border p-5 text-center"><MessageCircleMore className="mx-auto" size={22} style={{ color: "var(--app-accent)" }} /><p className="mt-2 text-3xl font-black">{progress.practice_count}</p><p className="app-muted-text mt-1 text-xs">累计练习次数</p></div>}</div></section>

      {canManage && <section className="app-card rounded-2xl border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Eye size={19} /></span><div className="min-w-0 flex-1"><h2 className="font-black">学生端只读预览</h2><p className="app-muted-text mt-1 text-xs leading-6">这里显示学生看到的已发布内容，不会写入练习记录。</p></div><Link href={`/dashboard/admin/conversation-practice/${scenario.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>进入后台编辑<ArrowRight size={13} /></Link></div></section>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="space-y-5">
          <section className="app-card rounded-[28px] border p-5 sm:p-7"><h2 className="flex items-center gap-2 text-lg font-black"><BookOpenText size={19} style={{ color: "var(--app-accent)" }} />情景任务</h2><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-8">{scenario.situation || "请根据标题设定完成一轮自然对话。"}</p>{objectives.length > 0 && <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--app-border-soft)" }}><p className="text-xs font-black">本次目标</p><ul className="mt-3 space-y-2">{objectives.map((objective) => <li key={objective} className="flex items-start gap-2 text-sm leading-7"><span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ color: "white", backgroundColor: "var(--app-success)" }}><Check size={10} /></span>{objective}</li>)}</ul></div>}</section>

          <section className="app-card rounded-[28px] border p-5 sm:p-7"><h2 className="flex items-center gap-2 text-lg font-black"><MessageCircleMore size={19} style={{ color: "var(--app-secondary)" }} />示范对话</h2><div className="mt-5 space-y-3">{dialogue.map((line, index) => <article key={`${line.speaker}-${index}`} className="app-soft-card rounded-2xl border p-4"><div className="flex items-start gap-3"><span className="rounded-lg px-2.5 py-1 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{line.speaker}</span><div className="min-w-0"><p className="text-sm font-black leading-7">{line.korean}</p><p className="app-muted-text mt-1 text-xs leading-6">{line.chinese}</p></div></div></article>)}{dialogue.length === 0 && <p className="app-muted-text rounded-2xl border border-dashed p-6 text-center text-xs">该场景暂未填写示范对话。</p>}</div></section>
        </div>

        <div className="space-y-5">
          <section className="app-card rounded-[28px] border p-5 sm:p-6"><h2 className="flex items-center gap-2 text-base font-black"><Sparkles size={17} style={{ color: "var(--app-warm)" }} />重点表达</h2><div className="mt-4 space-y-3">{expressions.map((expression, index) => <div key={`${expression.korean}-${index}`} className="app-soft-card rounded-xl border p-3"><p className="text-sm font-black leading-6">{expression.korean}</p><p className="app-muted-text mt-1 text-xs leading-5">{expression.chinese}</p></div>)}{expressions.length === 0 && <p className="app-muted-text text-xs">该场景暂未填写重点表达。</p>}</div></section>
          {(scenario.starter_prompt || scenario.practice_tips) && <section className="app-card rounded-[28px] border p-5 sm:p-6"><h2 className="flex items-center gap-2 text-base font-black"><Lightbulb size={17} style={{ color: "var(--app-success)" }} />开始开口</h2>{scenario.starter_prompt && <div className="mt-4"><p className="text-[11px] font-black">开场任务</p><p className="app-muted-text mt-2 whitespace-pre-wrap text-xs leading-6">{scenario.starter_prompt}</p></div>}{scenario.practice_tips && <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}><p className="text-[11px] font-black">练习提示</p><p className="app-muted-text mt-2 whitespace-pre-wrap text-xs leading-6">{scenario.practice_tips}</p></div>}</section>}
          {role === "student" && <PracticeReflectionForm scenarioId={scenario.id} confidence={progress?.confidence ?? null} reflection={progress?.reflection ?? ""} completed={progress?.status === "completed"} />}
        </div>
      </div>
    </div>
  );
}
