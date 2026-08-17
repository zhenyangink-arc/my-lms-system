import Link from "next/link";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, MessagesSquare } from "lucide-react";

import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { requireStudentPageFeature } from "@/lib/student-permissions-server";
import { CONVERSATION_CATEGORY_LABELS, CONVERSATION_DIFFICULTY_LABELS, type ConversationCategory, type ConversationDifficulty } from "../config";


type Scenario = { id: string; title: string; description: string; category: ConversationCategory; difficulty: ConversationDifficulty; duration_minutes: number };

export default async function ConversationCoursePage() {
  await requireStudentPageFeature("conversation_course");
  const { supabase } = await getConversationPracticeAccess();
  const { data, error } = await withStudentAppSchemaFallback(
    supabase.from("conversation_practice_scenarios").select("id,title,description,category,difficulty,duration_minutes").eq("student_app_id", STUDENT_APP_IDS.korean).eq("status", "published").order("sort_order", { ascending: true }),
    () => supabase.from("conversation_practice_scenarios").select("id,title,description,category,difficulty,duration_minutes").eq("status", "published").order("sort_order", { ascending: true }),
  );
  const scenarios = (data ?? []) as Scenario[];
  return <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8"><Link href="/dashboard/conversation-practice" className="app-muted-text inline-flex items-center gap-2 rounded-lg text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"><ArrowLeft size={14} aria-hidden="true" />返回口语练习</Link><section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--accent), var(--card), var(--status-success-surface))" }}><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}><BookOpen size={14} aria-hidden="true" />口语练习课程</span><DashboardTitleWithHint className="mt-3" headingLevel={2} title="按情境完成你的口语练习" description="从日常交流到面试表达，选择一个课程情境开始练习。" /></section>{error ? <section role="alert" className="app-card rounded-3xl border p-6"><h2 className="text-lg font-bold">课程暂时无法加载</h2><p className="app-muted-text mt-2 text-sm">请稍后刷新页面，或返回会话练习选择其他内容。</p></section> : <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{scenarios.map((scenario) => <Link key={scenario.id} href={`/dashboard/conversation-practice/${scenario.id}`} className="app-card group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"><div className="flex items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{CONVERSATION_CATEGORY_LABELS[scenario.category]}</span><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>{CONVERSATION_DIFFICULTY_LABELS[scenario.difficulty]}</span><ArrowRight className="ml-auto transition group-hover:translate-x-1" size={16} aria-hidden="true" /></div><h2 className="mt-4 text-lg font-bold">{scenario.title}</h2><p className="app-muted-text mt-2 line-clamp-3 text-xs leading-5">{scenario.description}</p><p className="app-muted-text mt-4 inline-flex items-center gap-1 text-xs font-bold"><Clock3 size={12} aria-hidden="true" />建议 {scenario.duration_minutes} 分钟</p></Link>)}{scenarios.length === 0 && <div className="app-card col-span-full rounded-3xl border border-dashed p-8 text-center"><MessagesSquare className="mx-auto opacity-30" size={32} aria-hidden="true" /><h2 className="mt-3 font-bold">暂时没有开放的口语课程</h2><p className="app-muted-text mt-2 text-sm">课程发布后会显示在这里。</p></div>}</section>}</div>;
}
