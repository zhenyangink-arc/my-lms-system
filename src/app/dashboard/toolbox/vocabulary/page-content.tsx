import { Sparkles } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { ToolboxStudyTimer } from "@/app/dashboard/toolbox/StudyTimer";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import {
  VocabularyPractice,
  type Word,
} from "./VocabularyPractice";

type LibraryRow = {
  id: string;
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
  source: "textbook" | "custom";
  sort_order: number;
};

export default async function VocabularyPage() {
  const { supabase } = await requireActiveUser();

  const { data: rows } = await supabase
    .from("growth_toolbox_vocabulary")
    .select("id,ko,zh,pos,collocation,transcription,source,sort_order")
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .order("sort_order", { ascending: true });

  const library = (rows ?? []) as LibraryRow[];
  const words: Word[] = library.map((row) => ({
    ko: row.ko,
    zh: row.zh,
    pos: row.pos,
    collocation: row.collocation,
    transcription: row.transcription,
  }));
  const textbookCount = library.filter((row) => row.source === "textbook").length;
  const customCount = words.length - textbookCount;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ToolboxStudyTimer skill="vocabulary" />
      <Hero totalWords={words.length} textbookCount={textbookCount} customCount={customCount} />
      <VocabularyPractice words={words} textbookCount={textbookCount} customCount={customCount} />
    </div>
  );
}

function Hero({
  totalWords,
  textbookCount,
  customCount,
}: {
  totalWords: number;
  textbookCount: number;
  customCount: number;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(125deg, var(--accent), var(--card) 48%, var(--status-warning-surface))",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full opacity-50 blur-3xl"
        style={{ backgroundColor: "var(--accent)" }}
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-wide"
            style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}
          >
            <Sparkles size={12} aria-hidden="true" />
            巩固中心 · 词汇专项
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">单词练习</h2>
          <p className="app-muted-text mt-2 max-w-xl text-sm font-bold leading-6">
            练习词库独立于互动教材，可自由扩充。翻卡巩固，越练越牢。
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <StatCard value={totalWords} label="个单词" />
          <StatCard value={textbookCount} label="来自教材" />
          <StatCard value={customCount} label="自定义" />
        </div>
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="min-w-[86px] rounded-2xl border px-5 py-3.5 text-center backdrop-blur"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in srgb, var(--card) 82%, transparent)",
      }}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--primary)" }}>
        {value}
      </p>
      <p className="app-muted-text mt-0.5 text-[10px] font-bold">{label}</p>
    </div>
  );
}
