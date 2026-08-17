import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  FileText,
  ImageIcon,
  MessageCircleMore,
  Mic,
  Sparkles,
  Timer,
} from "lucide-react";

import { requireStudentPageFeature } from "@/lib/student-permissions-server";
import styles from "./ai-experience.module.css";

export default async function AiExperiencePage() {
  await requireStudentPageFeature("ai_conversation_experience");

  return (
    <div className={`${styles.pageShell} min-h-[calc(100vh-76px)] pb-12`}>
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-5 sm:px-6 lg:px-8">
        <Link href="/dashboard/conversation-practice" className="app-muted-text inline-flex items-center gap-2 rounded-lg text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
          <ArrowLeft size={14} aria-hidden="true" />返回会话练习
        </Link>
        <header className="mx-auto max-w-3xl pb-7 pt-8 text-center sm:pt-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">选择练习方式</h2>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Link
            href="/dashboard/conversation-practice/ai-experience/quick"
            className="app-card group flex min-h-[360px] flex-col overflow-hidden rounded-[2rem] border p-6 transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ color: "var(--status-success)", backgroundColor: "var(--card)" }}
              >
                <MessageCircleMore size={25} aria-hidden="true" />
              </span>
              <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--card)" }}>
                立即开始
              </span>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold">快速体验</h2>
              <div className="mt-5 grid gap-3 text-sm font-bold sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <span className="inline-flex items-center gap-2"><FileText size={16} aria-hidden="true" />文字</span>
                <span className="inline-flex items-center gap-2"><Mic size={16} aria-hidden="true" />语音</span>
                <span className="inline-flex items-center gap-2"><ImageIcon size={16} aria-hidden="true" />图片</span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="app-muted-text text-xs font-bold">不保存练习记录</span>
              <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: "var(--status-success)" }}>
                立即体验 <ArrowRight className="transition group-hover:translate-x-1" size={16} aria-hidden="true" />
              </span>
            </div>
          </Link>

          <Link
            href="/dashboard/conversation-practice/ai-experience/practice"
            className="group relative flex min-h-[360px] flex-col overflow-hidden rounded-[2rem] border p-6 transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 sm:p-8"
            style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
          >
            <div className="relative flex items-start justify-between gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border">
                <Mic size={26} aria-hidden="true" />
              </span>
              <span className="rounded-full border px-3 py-1.5 text-xs font-bold">推荐</span>
            </div>

            <div className="relative mt-8">
              <h2 className="text-2xl font-bold">正式练习</h2>
              <div className="mt-5 grid gap-3 text-sm font-bold sm:grid-cols-3">
                <span className="inline-flex items-center gap-2"><Sparkles size={16} aria-hidden="true" />选择情境</span>
                <span className="inline-flex items-center gap-2"><Timer size={16} aria-hidden="true" />5–15 分钟</span>
                <span className="inline-flex items-center gap-2"><Clock3 size={16} aria-hidden="true" />练习摘要</span>
              </div>
            </div>

            <div className="relative mt-auto flex items-center justify-between border-t pt-5">
              <span className="text-xs font-bold">语音交流 · 完整会话</span>
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                开始正式练习 <ArrowRight className="transition group-hover:translate-x-1" size={16} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}
